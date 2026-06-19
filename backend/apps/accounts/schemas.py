from typing import Optional
from django.contrib.auth import get_user_model
from ninja import Schema
from pydantic import (
    validate_email as _validate_email,
    field_validator,
    EmailStr as DefaultEmailStr,
)
from pydantic_core import PydanticCustomError

User = get_user_model()


class EmailStr(DefaultEmailStr):
    @classmethod
    def _validate(cls, input_value: str, /) -> str:
        try:
            return _validate_email(input_value)[1]
        except PydanticCustomError:
            raise ValueError("INVALID_EMAIL")


class RegisterIn(Schema):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    code: str
    token: str

    @field_validator("email", mode="after")
    @classmethod
    def validate_email(cls, value: EmailStr) -> EmailStr:
        if User.objects.filter(email=value).exists():
            raise ValueError("EMAIL_TAKEN")
        return value

    @field_validator("password", mode="after")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 12:
            raise ValueError("PASSWORD_TOO_SHORT")
        return value


class RegisterOut(Schema):
    email: str
    first_name: str = ""
    last_name: str = ""
    avatar: str | None = None

    @staticmethod
    def resolve_avatar(obj):
        if hasattr(obj, "avatar") and obj.avatar:
            return obj.avatar.url
        return f"https://api.dicebear.com/7.x/avataaars/svg?seed={obj.id}"


class ProfileUpdateIn(Schema):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class GoogleLoginIn(Schema):
    id_token: str


class PasswordResetRequestIn(Schema):
    email: EmailStr


class EmailCheckIn(Schema):
    email: EmailStr


class EmailCheckOut(Schema):
    exists: bool


class LoginIn(Schema):
    email: str
    password: str
    token: str


class PasswordResetConfirmIn(Schema):
    token: str
    new_password: str

    @field_validator("new_password", mode="after")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 12:
            raise ValueError("PASSWORD_TOO_SHORT")
        return value


class SendVerificationIn(Schema):
    email: EmailStr
