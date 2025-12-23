from django.db import get_user_model
from ninja.errors import HttpError

User = get_user_model()


class AuthService:
    def create_user(self, username, email, password):
        try:
            return User.objects.create_user(
                username=username,
                email=email,
                password=password,
            )
        except Exception:
            raise HttpError(500, "Internal Error")
