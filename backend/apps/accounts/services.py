import logging
import os
import random
import string
import urllib.parse
import uuid
from datetime import timedelta

import httpx
from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils import timezone
from google.auth.transport import requests
from google.oauth2 import id_token
from ninja.errors import HttpError
from ninja_jwt.tokens import RefreshToken

from .models import EmailVerificationCode
from .tasks import (
    send_password_reset_email_task,
    send_verification_email_task,
    send_welcome_email_task,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class AuthService:
    async def create_user(self, first_name, last_name, email, password, code, token):
        if not await self.averify_verification_code(email, code):
            raise HttpError(400, "CODE_VERIFICATION_FAILED")

        if not await self.averify_turnstile(token):
            raise HttpError(400, "SIGNUP_FAILED")

        user = await sync_to_async(
            lambda: User.objects.create_user(
                email=email,
                password=password,
                username=email.split("@")[0],
                first_name=first_name,
                last_name=last_name,
            )
        )()

        await sync_to_async(send_welcome_email_task.delay)(user.id)
        await EmailVerificationCode.objects.filter(email=email).adelete()

        from apps.subscriptions.models import SubscriptionPlan, UserSubscription

        free_plan = await SubscriptionPlan.objects.filter(slug="free").afirst()
        if free_plan:
            await UserSubscription.objects.aget_or_create(
                user=user,
                defaults={
                    "plan": free_plan,
                    "status": UserSubscription.Status.ACTIVE,
                },
            )

        return user

    async def generate_verification_code(self, email):
        code = "".join(random.choices(string.digits, k=6))
        await EmailVerificationCode.objects.aupdate_or_create(
            email=email, defaults={"code": code}
        )
        await sync_to_async(send_verification_email_task.delay)(email, code)
        return True

    async def averify_verification_code(self, email, code):
        ten_minutes_ago = timezone.now() - timedelta(minutes=10)
        return await EmailVerificationCode.objects.filter(
            email=email, code=code, updated_at__gte=ten_minutes_ago
        ).aexists()

    async def user_exists(self, email):
        return await User.objects.filter(email=email).aexists()

    async def update_profile(self, user, data: dict, avatar=None):
        update_fields = []
        for attr, value in data.items():
            if value is not None and getattr(user, attr) != data[attr]:
                update_fields.append(attr)
                setattr(user, attr, value)

        if avatar:
            update_fields.append("avatar")
            user.avatar = avatar
        if update_fields:
            await user.asave(update_fields=update_fields)
        return user

    async def get_google_auth_url(self):
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": f"{settings.SITE_URL}/auth/callback",
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    async def google_callback(self, code):
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{settings.SITE_URL}/auth/callback",
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient() as client:
            logger.info(
                f"Exchanging code for tokens with redirect_uri: {data['redirect_uri']}"
            )
            res = await client.post(token_url, data=data)
            if not res.is_success:
                logger.error(
                    f"Google Token Exchange Error: {res.text}. Redirect URI used: {data['redirect_uri']}"
                )
                raise HttpError(400, f"Failed to exchange Google code: {res.text}")
            tokens = res.json()

        id_token_str = tokens.get("id_token")
        if not id_token_str:
            raise HttpError(400, "No id_token returned from Google")

        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, requests.Request(), settings.GOOGLE_CLIENT_ID
            )

            email = id_info.get("email")
            first_name = id_info.get("given_name", "")
            last_name = id_info.get("family_name", "")

            lookup_email = email.lower()
            user = await User.objects.filter(email__iexact=lookup_email).afirst()

            if not user:
                base_username = email.split("@")[0].replace(".", "").replace("-", "_")
                username = base_username

                existing_by_uname = await User.objects.filter(
                    username__iexact=username
                ).afirst()
                if existing_by_uname:
                    if existing_by_uname.email.lower() == lookup_email:
                        user = existing_by_uname
                    else:
                        counter = 1
                        while await User.objects.filter(username=username).aexists():
                            username = f"{base_username}{''.join(random.choices(string.digits, k=4))}"
                            counter += 1
                            if counter > 5:
                                username = f"{base_username}_{uuid.uuid4().hex[:6]}"
                                break

                if not user:
                    try:
                        from django.db import transaction

                        with transaction.atomic():
                            user = await sync_to_async(
                                lambda: User.objects.create_user(
                                    email=email,
                                    username=email.split("@")[0],
                                    first_name=first_name,
                                    last_name=last_name,
                                    is_active=True,
                                )
                            )()
                        from apps.subscriptions.models import (
                            SubscriptionPlan,
                            UserSubscription,
                        )

                        free_plan = await SubscriptionPlan.objects.filter(
                            slug="free"
                        ).afirst()
                        if free_plan:
                            await UserSubscription.objects.aget_or_create(
                                user=user,
                                defaults={
                                    "plan": free_plan,
                                    "status": UserSubscription.Status.ACTIVE,
                                },
                            )
                    except Exception as e:
                        user = await User.objects.filter(
                            email__iexact=lookup_email
                        ).afirst()
                        if not user:
                            user = await User.objects.filter(
                                username=username
                            ).afirst()
                        if not user:
                            raise e
            else:
                updated = False
                if not user.first_name and first_name:
                    user.first_name = first_name
                    updated = True
                if not user.last_name and last_name:
                    user.last_name = last_name
                    updated = True
                if updated:
                    await user.asave()

            picture_url = id_info.get("picture")
            if picture_url and not user.avatar:
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(picture_url)
                        if resp.is_success:
                            ext = os.path.splitext(picture_url.split("?")[0])[1] or ".jpg"
                            await sync_to_async(user.avatar.save)(
                                f"{user.username}_google{ext}",
                                ContentFile(resp.content),
                                save=True,
                            )
                except Exception as img_err:
                    print(f"Failed to save Google profile picture: {img_err}")

            refresh = await sync_to_async(RefreshToken.for_user)(user)
            return {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }

        except Exception as e:
            print(f"Google Token Verification Error: {str(e)}")
            if isinstance(e, HttpError):
                raise e
            raise HttpError(400, f"Erro na verificação do token Google: {str(e)}")

    async def google_login(self, id_token_str):
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

            user = await User.objects.filter(email__iexact=email).afirst()
            if not user:
                base_username = email.split("@")[0]
                username = base_username
                counter = 1
                while await User.objects.filter(username=username).aexists():
                    username = f"{base_username}{''.join(random.choices(string.digits, k=4))}"
                    counter += 1
                    if counter > 10:
                        username = f"{base_username}_{uuid.uuid4().hex[:8]}"
                        break

                user = await sync_to_async(
                    lambda: User.objects.create_user(
                        email=email, username=username, is_active=True
                    )
                )()
                from apps.subscriptions.models import SubscriptionPlan, UserSubscription

                free_plan = await SubscriptionPlan.objects.filter(
                    slug="free"
                ).afirst()
                if free_plan:
                    await UserSubscription.objects.aget_or_create(
                        user=user,
                        defaults={
                            "plan": free_plan,
                            "status": UserSubscription.Status.ACTIVE,
                        },
                    )

            refresh = await sync_to_async(RefreshToken.for_user)(user)
            return {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": user,
            }

        except Exception as e:
            print(f"Google Token Verification Error: {str(e)}")
            if isinstance(e, HttpError):
                raise e
            raise HttpError(400, f"Erro na verificação do token Google: {str(e)}")

    async def request_password_reset(self, email):
        try:
            user = await User.objects.aget(email=email)
            signer = TimestampSigner()
            token = signer.sign(user.email)
            await sync_to_async(send_password_reset_email_task.delay)(user.id, token)
        except User.DoesNotExist:
            pass
        return {
            "message": "Se o e-mail existir no nosso sistema, você receberá um link de recuperação."
        }

    async def confirm_password_reset(self, token, new_password):
        signer = TimestampSigner()
        try:
            email = signer.unsign(token, max_age=3600)
            user = await User.objects.aget(email=email)
            user.set_password(new_password)
            await user.asave()
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

    async def averify_turnstile(self, token: str):
        if settings.DEBUG and token == "XXXX.DUMMY.TOKEN.XXXX":
            return True
        url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        data = {
            "secret": settings.CLOUDFLARE_TURNSTILE_SECRET_KEY,
            "response": token,
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, data=data)
                if res.is_success:
                    return res.json().get("success", False)
        except Exception as e:
            logger.error(f"Turnstile verification error: {e}")
        return False
