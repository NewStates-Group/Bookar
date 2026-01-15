from injector import inject
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController

from .schemas import RegisterIn, RegisterOut
from .services import AuthService


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
        return request.user
