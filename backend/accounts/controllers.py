from accounts.schemas import GoogleLoginIn
from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController

from .schemas import RegisterIn, RegisterOut
from .services import AuthService


from ninja import File, Form
from ninja.files import UploadedFile
from .schemas import RegisterIn, RegisterOut, ProfileUpdateIn, PasswordResetRequestIn, PasswordResetConfirmIn


@api_controller("auth/", tags=["Auth"])
class AuthController(NinjaJWTDefaultController):
    @inject
    def __init__(self, auth_service: AuthService):
        self.auth_service = auth_service

    @route.post("signup", response=RegisterOut)
    def signup(self, data: RegisterIn):
        return self.auth_service.create_user(**data.dict())

    @route.get("me", response=RegisterOut, auth=JWTAuth())
    def me(self, request):
        user = request.user
        user.stats = self.auth_service.get_user_stats(user)
        return user

    @route.put("profile", response=RegisterOut, auth=JWTAuth())
    def update_profile(self, request, data: ProfileUpdateIn):
        user = self.auth_service.update_profile(request.user, data.dict(exclude_none=True))
        user.stats = self.auth_service.get_user_stats(user)
        return user

    @route.post("avatar", response=RegisterOut, auth=JWTAuth())
    def update_avatar(self, request, avatar: UploadedFile = File(...)):
        user = self.auth_service.update_profile(request.user, {}, avatar=avatar)
        user.stats = self.auth_service.get_user_stats(user)
        return user

    @route.post("google")
    def google_auth(self, data: GoogleLoginIn):
        result = self.auth_service.google_login(data.id_token)
        return {
            "access": result['access'],
            "refresh": result['refresh'],
        }

    @route.get("google/login")
    def google_login_init(self, request):
        from django.shortcuts import redirect
        return redirect(self.auth_service.get_google_auth_url())

    @route.get("google/callback")
    def google_callback_handler(self, request, code: str):
        from django.shortcuts import redirect
        from django.conf import settings
        try:
            tokens = self.auth_service.google_callback(code)
            return redirect(f"{settings.SITE_URL}/auth/callback?access={tokens['access']}&refresh={tokens['refresh']}")
        except Exception as e:
            return redirect(f"{settings.SITE_URL}/login?error={str(e)}")

    @route.post("password-reset/request")
    def password_reset_request(self, data: PasswordResetRequestIn):
        return self.auth_service.request_password_reset(data.email)

    @route.post("password-reset/confirm")
    def password_reset_confirm(self, data: PasswordResetConfirmIn):
        return self.auth_service.confirm_password_reset(data.token, data.new_password)
