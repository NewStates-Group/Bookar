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
            raise ValueError("Too short username")
        if User.objects.filter(username=value).exists():
            raise ValueError("Username was taken")
        return username

    @field_validator("email", mode="after")
    def validate_email(cls, value: str) -> str:
        if User.objects.filter(email=value).exists():
            raise ValueError("Invalid e-mail")
        return value

    @field_validator("password", mode="after")
    @classmethod
    def validate_password(cls, value: EmailStr) -> EmailStr:
        if len(value) < 12:
            raise ValueError("Weak password")
        return value


class RegisterOut(Schema):
    username: str
    email: str
