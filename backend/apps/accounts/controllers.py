import logging
from typing import Optional

from injector import inject
from ninja import File, Form
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja_extra import api_controller, route
from ninja_jwt.authentication import AsyncJWTAuth
from ninja_jwt.controller import AsyncNinjaJWTDefaultController, schema

from .schemas import (
    EmailCheckIn,
    EmailCheckOut,
    GoogleLoginIn,
    LoginIn,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    ProfileUpdateIn,
    RegisterIn,
    RegisterOut,
    SendVerificationIn,
)
from .services import AuthService
from .throttling import AnonRateThrottle, DynamicRateThrottle

logger = logging.getLogger(__name__)


@api_controller("auth/", tags=["Auth"])
class AuthController(AsyncNinjaJWTDefaultController):
    @inject
    def __init__(self, auth_service: AuthService):
        self.auth_service = auth_service

    @route.post(
        "pair",
        response=schema.obtain_pair_schema.get_response_schema(),
        throttle=AnonRateThrottle(),
    )
    async def obtain_token(self, data: LoginIn):
        payload = data.dict()
        if not await self.auth_service.averify_turnstile(data.token):
            raise HttpError(400, "TURNSTILE_FAILED")
        payload.pop("token", None)
        return await super().obtain_token(payload)

    @route.post("signup", response=RegisterOut, throttle=AnonRateThrottle())
    async def signup(self, data: RegisterIn):
        return await self.auth_service.create_user(**data.dict())

    @route.post(
        "send-verification", throttle=DynamicRateThrottle(scope="send_verification")
    )
    async def send_verification(self, data: SendVerificationIn):
        await self.auth_service.generate_verification_code(data.email)
        return {"message": "Código enviado para o seu e-mail."}

    @route.post(
        "check-email",
        response=EmailCheckOut,
        throttle=DynamicRateThrottle(scope="email_check"),
    )
    async def check_email(self, data: EmailCheckIn):
        exists = await self.auth_service.user_exists(data.email)
        return {"exists": exists}

    @route.get("me", response=RegisterOut, auth=AsyncJWTAuth())
    async def me(self, request):
        return request.user

    @route.post("profile", response=RegisterOut, auth=AsyncJWTAuth())
    async def update_profile(
        self,
        request,
        data: Form[ProfileUpdateIn],
        avatar: File[UploadedFile] | None = None,
    ):
        user = await self.auth_service.update_profile(
            request.user, data.dict(exclude_none=True), avatar
        )
        return user

    @route.get("google/url")
    async def get_google_url(self, request):
        url = await self.auth_service.get_google_auth_url()
        return {"url": url}

    @route.post("google/callback")
    async def google_callback(self, data: GoogleLoginIn):
        tokens = await self.auth_service.google_callback(data.id_token)
        return tokens

    @route.post(
        "password-reset/request",
        throttle=DynamicRateThrottle(scope="password_reset_request"),
    )
    async def password_reset_request(self, data: PasswordResetRequestIn):
        return await self.auth_service.request_password_reset(data.email)

    @route.post(
        "password-reset/confirm",
        throttle=DynamicRateThrottle(scope="password_reset_confirm"),
    )
    async def password_reset_confirm(self, data: PasswordResetConfirmIn):
        return await self.auth_service.confirm_password_reset(data.token, data.new_password)
