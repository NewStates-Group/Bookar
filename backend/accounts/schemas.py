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
            raise ValueError("Username must be at least 3 characters long")
        if User.objects.filter(username=value).exists():
            raise ValueError("This username is already taken")
        return username

    @field_validator("email", mode="after")
    def validate_email(cls, value: str) -> str:
        if User.objects.filter(email=value).exists():
            raise ValueError("This email is already registered")
        return value

    @field_validator("password", mode="after")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 12:
            raise ValueError("Password must be at least 12 characters long")
        return value


class RegisterOut(Schema):
    username: str
    email: str
