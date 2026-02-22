from accounts.schemas import GoogleLoginIn
from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController

from .schemas import RegisterIn, RegisterOut
from .services import AuthService


from ninja import File, Form
from ninja.files import UploadedFile
from .schemas import RegisterIn, RegisterOut, ProfileUpdateIn


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
