import logging
import os
import random
import string
import urllib.parse
import uuid

import httpx
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.db import transaction, IntegrityError
from google.auth.transport import requests
from google.oauth2 import id_token
from ninja.errors import HttpError
from ninja_jwt.tokens import RefreshToken

from .tasks import send_verification_email_task, send_welcome_email_task, send_password_reset_email_task
from .models import EmailVerificationCode
from courses.models import Course

User = get_user_model()
logger = logging.getLogger(__name__)


class AuthService:
    def create_user(self, first_name, last_name, email, password, code):
        if not self.verify_verification_code(email, code):
            raise HttpError(400, "Código de verificação inválido ou expirado.")

        user = User.objects.create_user(
            email=email,
            password=password,
            username=email.split('@')[0],  # Default username from email
            first_name=first_name,
            last_name=last_name,
        )
        try:
            send_welcome_email_task.delay(user.id)
        except Exception as e:
            print(f"Failed to queue welcome email: {e}")
        
        # Success, clear code
        EmailVerificationCode.objects.filter(email=email).delete()
        
        return user

    def generate_verification_code(self, email):
        code = "".join(random.choices(string.digits, k=6))
        EmailVerificationCode.objects.update_or_create(
            email=email,
            defaults={"code": code}
        )
        send_verification_email_task.delay(email, code)
        return True

    def verify_verification_code(self, email, code):
        from django.utils import timezone
        from datetime import timedelta
        
        # Expire after 10 minutes
        ten_minutes_ago = timezone.now() - timedelta(minutes=10)
        
        return EmailVerificationCode.objects.filter(
            email=email, 
            code=code, 
            created_at__gte=ten_minutes_ago
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
        all_courses = Course.objects.filter(user=user, deleted=False)
        
        # This is a bit expensive if many courses, but okay for MVP
        finished_ids = [c.id for c in all_courses if c.is_fully_completed]
        
        return {
            "ongoing_courses": all_courses.count() - len(finished_ids),
            "finished_courses": len(finished_ids),
            "certificates_issued": len(finished_ids), # Assuming 1:1 for now
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
            res = client.post(token_url, data=data)
            if not res.is_success:
                raise HttpError(400, f"Failed to exchange Google code: {res.text}")
            tokens = res.json()

        id_token_str = tokens.get("id_token")
        if not id_token_str:
            raise HttpError(400, "No id_token returned from Google")

        # 2. Verify token and get user
        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, 
                requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )

            email = id_info.get('email')
            first_name = id_info.get('given_name', '')
            last_name = id_info.get('family_name', '')
            
            print(f">>> GOOGLE LOGIN DEBUG: email='{email}', first='{first_name}', last='{last_name}'")
            
            # Normalize email for common providers if needed (e.g. Gmail dots)
            lookup_email = email.lower()
            
            user = User.objects.filter(email__iexact=lookup_email).first()
            if user:
                print(f">>> DEBUG: Found user by email: ID={user.id}, Username='{user.username}'")
            
            if not user:
                print(f">>> DEBUG: No user found for '{lookup_email}', checking all users...")
                # Create or find
                base_username = email.split('@')[0].replace('.', '').replace('-', '_') # Simple normalization
                username = base_username
                
                # Check if username exists independently of email
                existing_by_uname = User.objects.filter(username__iexact=username).first()
                if existing_by_uname:
                    print(f">>> DEBUG: Username '{username}' taken by user with email '{existing_by_uname.email}'")
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
                    print(f">>> DEBUG: Proceeding to create user with username='{username}'")
                    try:
                        with transaction.atomic():
                            user = User.objects.create_user(
                                email=email,
                                username=email.split('@')[0], # Default username
                                first_name=first_name,
                                last_name=last_name,
                                is_active=True
                            )
                        print(f">>> DEBUG: User created: ID={user.id}")
                    except Exception as e:
                        print(f">>> DEBUG: Creation failed: {type(e).__name__}: {e}")
                        # Final, final fallback
                        user = User.objects.filter(email__iexact=lookup_email).first()
                        if not user:
                            user = User.objects.filter(username=username).first()
                        
                        if not user:
                            print(">>> DEBUG: CRITICAL FAILURE: Could not find or create user.")
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
            picture_url = id_info.get('picture')
            if picture_url and not user.avatar:
                try:
                    with httpx.Client() as client:
                        resp = client.get(picture_url)
                        if resp.is_success:
                            ext = os.path.splitext(picture_url.split('?')[0])[1] or '.jpg'
                            user.avatar.save(f"{user.username}_google{ext}", ContentFile(resp.content), save=True)
                except Exception as img_err:
                    print(f"Failed to save Google profile picture: {img_err}")

            refresh = RefreshToken.for_user(user)
            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
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
                id_token_str, 
                requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )

            iss = id_info.get('iss')
            if iss not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError(f'Wrong issuer: {iss}')

            email = id_info.get('email')
            if not email:
                raise ValueError('Email not found in Google Token')

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                base_username = email.split('@')[0]
                username = base_username
                
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{''.join(random.choices(string.digits, k=4))}"
                    counter += 1
                    if counter > 10:
                        username = f"{base_username}_{uuid.uuid4().hex[:8]}"
                        break

                user = User.objects.create_user(
                    email=email,
                    username=username,
                    is_active=True
                )

            refresh = RefreshToken.for_user(user)
            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': user
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
        return {"message": "Se o e-mail existir no nosso sistema, você receberá um link de recuperação."}

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
            raise HttpError(400, "Token inválido ou expirado.")
        except User.DoesNotExist:
            raise HttpError(404, "Usuário não encontrado.")
