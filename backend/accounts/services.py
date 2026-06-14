import logging
import os
import random
import string
import urllib.parse
import uuid

import httpx
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.files.base import ContentFile
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import transaction
from google.auth.transport import requests
from google.oauth2 import id_token
from ninja.errors import HttpError
from ninja_jwt.tokens import RefreshToken

from .models import EmailVerificationCode, SubscriptionPlan, UserSubscription
from .tasks import (
    send_password_reset_email_task,
    send_verification_email_task,
    send_welcome_email_task,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class AuthService:
    def create_user(self, first_name, last_name, email, password, code, token):
        if not self.verify_verification_code(email, code):
            raise HttpError(400, "Código de verificação inválido.")

        if not self.verify_turnstile(token):
            raise HttpError(400, "Cadastro falhou. Tente novamente.")

        user = User.objects.create_user(
            email=email,
            password=password,
            username=email.split("@")[0],  # Default username from email
            first_name=first_name,
            last_name=last_name,
        )
        try:
            send_welcome_email_task.delay(user.id)
        except Exception as e:
            print(f"Failed to queue welcome email: {e}")

        # Success, clear code
        EmailVerificationCode.objects.filter(email=email).delete()

        # Create free subscription
        free_plan = SubscriptionPlan.objects.filter(slug="free").first()
        if free_plan:
            UserSubscription.objects.get_or_create(
                user=user,
                defaults={
                    "plan": free_plan,
                    "status": UserSubscription.Status.ACTIVE,
                },
            )

        return user

    def generate_verification_code(self, email):
        code = "".join(random.choices(string.digits, k=6))
        EmailVerificationCode.objects.update_or_create(
            email=email, defaults={"code": code}
        )
        send_verification_email_task.delay(email, code)
        return True

    def authenticate_user(self, email, password, token):
        if not self.verify_turnstile(token):
            raise HttpError(400, "Verificação anti-bot falhou.")

        user = authenticate(email=email, password=password)
        if not user:
            raise HttpError(401, "E-mail ou senha incorretos.")

        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

    def verify_verification_code(self, email, code):
        from datetime import timedelta

        from django.utils import timezone

        ten_minutes_ago = timezone.now() - timedelta(minutes=10)
        return EmailVerificationCode.objects.filter(
            email=email, code=code, updated_at__gte=ten_minutes_ago
        ).exists()

    def user_exists(self, email):
        return User.objects.filter(email=email).exists()

    def update_profile(self, user, data: dict, avatar=None):
        for attr, value in data.items():
            if value is not None:
                setattr(user, attr, value)

        if avatar:
            user.avatar = avatar

        user.save()
        return user

    def get_user_stats(self, user):
        from courses.models import CourseEnrollment

        active_enrollments = CourseEnrollment.objects.filter(user=user, deleted=False)

        # This is a bit expensive if many courses, but okay for MVP
        finished_count = 0
        for enrollment in active_enrollments:
            # Check completion for this user
            if enrollment.course.is_fully_completed(user):
                finished_count += 1

        total_count = active_enrollments.count()

        return {
            "ongoing_courses": total_count - finished_count,
            "finished_courses": finished_count,
            "certificates_issued": finished_count,
        }

    def get_full_stats(self, user):
        from courses.models import CourseEnrollment
        from mind_maps.models import MindMap
        from explicador.models import ExplicadorRoom

        course_enrollments = CourseEnrollment.objects.filter(user=user, deleted=False)
        total_courses = course_enrollments.count()
        finished_courses = 0
        for enrollment in course_enrollments:
            if enrollment.course.is_fully_completed(user):
                finished_courses += 1

        mindmaps = MindMap.objects.filter(user=user)
        total_mindmaps = mindmaps.count()

        rooms = ExplicadorRoom.objects.filter(owner=user)
        total_rooms = rooms.count()
        active_rooms = rooms.filter(is_active=True).count()
        total_messages = 0
        for room in rooms:
            total_messages += len(room.chat_history or [])

        return {
            "total_courses": total_courses,
            "ongoing_courses": total_courses - finished_courses,
            "finished_courses": finished_courses,
            "certificates_issued": finished_courses,
            "total_mindmaps": total_mindmaps,
            "total_rooms": total_rooms,
            "total_messages": total_messages,
            "active_rooms": active_rooms,
        }

    def get_google_auth_url(self):
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": f"{settings.SITE_URL}/auth/callback",
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    def google_callback(self, code):
        # 1. Exchange code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{settings.SITE_URL}/auth/callback",
            "grant_type": "authorization_code",
        }

        with httpx.Client() as client:
            logger.info(
                f"Exchanging code for tokens with redirect_uri: {data['redirect_uri']}"
            )
            res = client.post(token_url, data=data)
            if not res.is_success:
                logger.error(
                    f"Google Token Exchange Error: {res.text}. Redirect URI used: {data['redirect_uri']}"
                )
                raise HttpError(400, f"Failed to exchange Google code: {res.text}")
            tokens = res.json()

        id_token_str = tokens.get("id_token")
        if not id_token_str:
            raise HttpError(400, "No id_token returned from Google")

        # 2. Verify token and get user
        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, requests.Request(), settings.GOOGLE_CLIENT_ID
            )

            email = id_info.get("email")
            first_name = id_info.get("given_name", "")
            last_name = id_info.get("family_name", "")

            print(
                f">>> GOOGLE LOGIN DEBUG: email='{email}', first='{first_name}', last='{last_name}'"
            )

            # Normalize email for common providers if needed (e.g. Gmail dots)
            lookup_email = email.lower()

            user = User.objects.filter(email__iexact=lookup_email).first()
            if user:
                print(
                    f">>> DEBUG: Found user by email: ID={user.id}, Username='{user.username}'"
                )

            if not user:
                print(
                    f">>> DEBUG: No user found for '{lookup_email}', checking all users..."
                )
                # Create or find
                base_username = (
                    email.split("@")[0].replace(".", "").replace("-", "_")
                )  # Simple normalization
                username = base_username

                # Check if username exists independently of email
                existing_by_uname = User.objects.filter(
                    username__iexact=username
                ).first()
                if existing_by_uname:
                    print(
                        f">>> DEBUG: Username '{username}' taken by user with email '{existing_by_uname.email}'"
                    )
                    # Try to find again by that email to see if they match (paranoid)
                    if existing_by_uname.email.lower() == lookup_email:
                        user = existing_by_uname
                    else:
                        # Collision: Generate new one
                        counter = 1
                        while User.objects.filter(username=username).exists():
                            username = f"{base_username}{''.join(random.choices(string.digits, k=4))}"
                            counter += 1
                            if counter > 5:
                                username = f"{base_username}_{uuid.uuid4().hex[:6]}"
                                break

                if not user:
                    print(
                        f">>> DEBUG: Proceeding to create user with username='{username}'"
                    )
                    try:
                        with transaction.atomic():
                            user = User.objects.create_user(
                                email=email,
                                username=email.split("@")[0],  # Default username
                                first_name=first_name,
                                last_name=last_name,
                                is_active=True,
                            )
                        print(f">>> DEBUG: User created: ID={user.id}")
                        free_plan = SubscriptionPlan.objects.filter(slug="free").first()
                        if free_plan:
                            UserSubscription.objects.get_or_create(
                                user=user,
                                defaults={
                                    "plan": free_plan,
                                    "status": UserSubscription.Status.ACTIVE,
                                },
                            )
                    except Exception as e:
                        print(f">>> DEBUG: Creation failed: {type(e).__name__}: {e}")
                        # Final, final fallback
                        user = User.objects.filter(email__iexact=lookup_email).first()
                        if not user:
                            user = User.objects.filter(username=username).first()

                        if not user:
                            print(
                                ">>> DEBUG: CRITICAL FAILURE: Could not find or create user."
                            )
                            raise e
            else:
                # Update existing user profile if fields are empty
                updated = False
                if not user.first_name and first_name:
                    user.first_name = first_name
                    updated = True
                if not user.last_name and last_name:
                    user.last_name = last_name
                    updated = True
                if updated:
                    user.save()

            # 3. Save profile picture from Google if available and user doesn't have one
            picture_url = id_info.get("picture")
            if picture_url and not user.avatar:
                try:
                    with httpx.Client() as client:
                        resp = client.get(picture_url)
                        if resp.is_success:
                            ext = (
                                os.path.splitext(picture_url.split("?")[0])[1] or ".jpg"
                            )
                            user.avatar.save(
                                f"{user.username}_google{ext}",
                                ContentFile(resp.content),
                                save=True,
                            )
                except Exception as img_err:
                    print(f"Failed to save Google profile picture: {img_err}")

            refresh = RefreshToken.for_user(user)
            return {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }

        except Exception as e:
            print(f"Google Token Verification Error: {str(e)}")
            if isinstance(e, HttpError):
                raise e
            raise HttpError(400, f"Erro na verificação do token Google: {str(e)}")

    def google_login(self, id_token_str):
        # Kept for backward compatibility if needed, but redesigned for better use
        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, requests.Request(), settings.GOOGLE_CLIENT_ID
            )

            iss = id_info.get("iss")
            if iss not in ["accounts.google.com", "https://accounts.google.com"]:
                raise ValueError(f"Wrong issuer: {iss}")

            email = id_info.get("email")
            if not email:
                raise ValueError("Email not found in Google Token")

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                base_username = email.split("@")[0]
                username = base_username

                counter = 1
                while User.objects.filter(username=username).exists():
                    username = (
                        f"{base_username}{''.join(random.choices(string.digits, k=4))}"
                    )
                    counter += 1
                    if counter > 10:
                        username = f"{base_username}_{uuid.uuid4().hex[:8]}"
                        break

                user = User.objects.create_user(
                    email=email, username=username, is_active=True
                )
                free_plan = SubscriptionPlan.objects.filter(slug="free").first()
                if free_plan:
                    UserSubscription.objects.get_or_create(
                        user=user,
                        defaults={
                            "plan": free_plan,
                            "status": UserSubscription.Status.ACTIVE,
                        },
                    )

            refresh = RefreshToken.for_user(user)
            return {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": user,
            }

        except Exception as e:
            # Provide more detailed error message for easier debugging
            print(f"Google Token Verification Error: {str(e)}")
            if isinstance(e, HttpError):
                raise e
            raise HttpError(400, f"Erro na verificação do token Google: {str(e)}")

    def request_password_reset(self, email):
        try:
            user = User.objects.get(email=email)
            signer = TimestampSigner()
            token = signer.sign(user.email)
            send_password_reset_email_task.delay(user.id, token)
        except User.DoesNotExist:
            # We don't reveal if user exists for security, but we don't send anything
            pass
        return {
            "message": "Se o e-mail existir no nosso sistema, você receberá um link de recuperação."
        }

    def confirm_password_reset(self, token, new_password):
        signer = TimestampSigner()
        try:
            # Token expires in 1 hour (3600 seconds)
            email = signer.unsign(token, max_age=3600)
            user = User.objects.get(email=email)
            user.set_password(new_password)
            user.save()
            return {"message": "Senha redefinida com sucesso!"}
        except (BadSignature, SignatureExpired):
            raise HttpError(400, "Token inválido")
        except User.DoesNotExist:
            raise HttpError(404, "Usuário não encontrado.")

    def verify_turnstile(self, token: str):
        if settings.DEBUG and token == "XXXX.DUMMY.TOKEN.XXXX":
            return True

        url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        data = {
            "secret": settings.CLOUDFLARE_TURNSTILE_SECRET_KEY,
            "response": token,
        }
        try:
            with httpx.Client() as client:
                res = client.post(url, data=data)
                if res.is_success:
                    return res.json().get("success", False)
        except Exception as e:
            logger.error(f"Turnstile verification error: {e}")
        return False

    def register_waitlist(self, email, code, token):
        if not self.verify_verification_code(email, code):
            raise HttpError(400, "Código de verificação inválido")

        if not self.verify_turnstile(token):
            raise HttpError(400, "Verificação anti-bot falhou. Tente novamente.")

        from .models import Waitlist

        Waitlist.objects.update_or_create(email=email)

        # Clear code after success
        EmailVerificationCode.objects.filter(email=email).delete()

        return {"message": "Inscrito na lista de espera com sucesso!"}

    def get_waitlist_count(self):
        from .models import Waitlist

        return {"count": Waitlist.objects.count()}
