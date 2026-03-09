from django.contrib.auth import get_user_model
from ninja import Schema
from pydantic import EmailStr, field_validator

User = get_user_model()


class RegisterIn(Schema):
    username: str
    email: EmailStr
    password: str

    @field_validator("username", mode="after")
    @classmethod
    def validate_username(cls, value: str) -> str:
        username = value.strip()
        if len(username) < 3:
            raise ValueError("USERNAME_TOO_SHORT")
        if User.objects.filter(username=value).exists():
            raise ValueError("USERNAME_TAKEN")
        return username

    @field_validator("email", mode="after")
    @classmethod
    def validate_email(cls, value: str) -> EmailStr:
        if User.objects.filter(email=value).exists():
            raise ValueError("EMAIL_TAKEN")
        return value

    @field_validator("password", mode="after")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 12:
            raise ValueError("PASSWORD_TOO_SHORT")
        return value


class UserStatsSchema(Schema):
    ongoing_courses: int
    finished_courses: int
    certificates_issued: int

class RegisterOut(Schema):
    id: int
    username: str
    email: str
    first_name: str = ""
    last_name: str = ""
    bio: str = ""
    avatar: str | None = None
    stats: UserStatsSchema | None = None

    @staticmethod
    def resolve_avatar(obj):
        if obj.avatar:
            return obj.avatar.url
        return None

class ProfileUpdateIn(Schema):
    username: str = None
    email: EmailStr = None
    first_name: str = None
    last_name: str = None
    bio: str = None

class GoogleLoginIn(Schema):
    id_token: str

class PasswordResetRequestIn(Schema):
    email: EmailStr

class PasswordResetConfirmIn(Schema):
    token: str
    new_password: str

    @field_validator("new_password", mode="after")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 12:
            raise ValueError("PASSWORD_TOO_SHORT")
        return value
