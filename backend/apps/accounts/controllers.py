from injector import inject
from ninja import File
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController, schema

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
    UserFullStatsSchema,
)
from .services import AuthService
from .throttling import AnonRateThrottle, DynamicRateThrottle
import logging

logger = logging.getLogger(__name__)


@api_controller("auth/", tags=["Auth"])
class AuthController(NinjaJWTDefaultController):
    @inject
    def __init__(self, auth_service: AuthService):
        self.auth_service = auth_service

    @route.post(
        "pair",
        response=schema.obtain_pair_schema.get_response_schema(),
        throttle=AnonRateThrottle(),
    )
    def pair(self, data: LoginIn):
        payload = data.dict()
        if not self.verify_turnstile(data.token):
            raise HttpError(400, "CAPTCHA falhou")
        payload.pop("token", None)
        return super().obtain_token(payload)

    @route.post("signup", response=RegisterOut, throttle=AnonRateThrottle())
    def signup(self, data: RegisterIn):
        return self.auth_service.create_user(**data.dict())

    @route.post(
        "send-verification", throttle=DynamicRateThrottle(scope="send_verification")
    )
    def send_verification(self, data: SendVerificationIn):
        self.auth_service.generate_verification_code(data.email)
        return {"message": "Código enviado para o seu e-mail."}

    @route.post(
        "check-email",
        response=EmailCheckOut,
        throttle=DynamicRateThrottle(scope="email_check"),
    )
    def check_email(self, data: EmailCheckIn):
        exists = self.auth_service.user_exists(data.email)
        return {"exists": exists}

    @route.get("me", response=RegisterOut, auth=JWTAuth())
    def me(self, request, stats: bool = False):
        user = request.user
        if stats:
            user.stats = self.auth_service.get_user_stats(user)
        return user

    @route.get("stats", response=UserFullStatsSchema, auth=JWTAuth())
    def full_stats(self, request):
        return self.auth_service.get_full_stats(request.user)

    @route.put("profile", response=RegisterOut, auth=JWTAuth())
    def update_profile(self, request, data: ProfileUpdateIn):
        user = self.auth_service.update_profile(
            request.user, data.dict(exclude_none=True)
        )
        user.stats = self.auth_service.get_user_stats(user)
        return user

    @route.post("avatar", response=RegisterOut, auth=JWTAuth())
    def update_avatar(self, request, avatar: UploadedFile = File(...)):
        user = self.auth_service.update_profile(request.user, {}, avatar=avatar)
        user.stats = self.auth_service.get_user_stats(user)
        return user

    @route.get("google/url")
    def get_google_url(self, request):
        return {"url": self.auth_service.get_google_auth_url()}

    @route.post("google/callback")
    def google_callback(self, data: GoogleLoginIn):
        tokens = self.auth_service.google_callback(data.id_token)
        return tokens

    @route.post(
        "password-reset/request",
        throttle=DynamicRateThrottle(scope="password_reset_request"),
    )
    def password_reset_request(self, data: PasswordResetRequestIn):
        return self.auth_service.request_password_reset(data.email)

    @route.post(
        "password-reset/confirm",
        throttle=DynamicRateThrottle(scope="password_reset_confirm"),
    )
    def password_reset_confirm(self, data: PasswordResetConfirmIn):
        return self.auth_service.confirm_password_reset(data.token, data.new_password)

