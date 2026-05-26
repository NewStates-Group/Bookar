from PIL.Image import logger
from accounts.schemas import GoogleLoginIn
from injector import inject
from ninja_extra import api_controller, route

from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController

from .schemas import RegisterIn, RegisterOut
from .services import AuthService
from ninja.errors import HttpError
from ninja import File
from ninja.files import UploadedFile
from .schemas import (
    RegisterIn,
    RegisterOut,
    ProfileUpdateIn,
    PasswordResetRequestIn,
    PasswordResetConfirmIn,
    EmailCheckIn,
    EmailCheckOut,
    SendVerificationIn,
    WaitlistEmailIn,
    PreWaitlistEmailIn,
    LoginIn,
)
from .throttling import AnonRateThrottle, DynamicRateThrottle
from ninja_jwt.controller import schema


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
        # return self.auth_service.authenticate_user(data.email, data.password, data.token)

    @route.post("signup", response=RegisterOut, throttle=AnonRateThrottle())
    def signup(self, data: RegisterIn):
        return self.auth_service.create_user(**data.dict())

    @route.post(
        "send-verification", throttle=DynamicRateThrottle(scope="send_verification")
    )
    def send_verification(self, data: SendVerificationIn):
        self.auth_service.generate_verification_code(data.email)
        return {"message": "Código enviado para o seu e-mail."}

    @route.post("verify-code", throttle=DynamicRateThrottle(scope="verify_code"))
    def verify_code(self, data: PreWaitlistEmailIn):
        if self.auth_service.verify_verification_code(data.email, data.code):
            return {"success": True}
        raise HttpError(400, "Código de verificação inválido")

    @route.post(
        "check-email",
        response=EmailCheckOut,
        throttle=DynamicRateThrottle(scope="email_check"),
    )
    def check_email(self, data: EmailCheckIn):
        exists = self.auth_service.user_exists(data.email)
        return {"exists": exists}

    @route.get("me", response=RegisterOut, auth=JWTAuth())
    def me(self, request):
        user = request.user
        user.stats = self.auth_service.get_user_stats(user)
        return user

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
        # We reuse GoogleLoginIn schema which has 'id_token', let's just treat it as 'code' for now
        # or better, update the schema if needed. Actually, let's just use data.id_token as the code.
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

    @route.post("waitlist", throttle=AnonRateThrottle())
    def register_waitlist(self, data: WaitlistEmailIn):
        return self.auth_service.register_waitlist(**data.dict())

    @route.get("waitlist/count")
    def get_waitlist_count(self):
        return self.auth_service.get_waitlist_count()
