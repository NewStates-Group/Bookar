from datetime import date, datetime
from typing import Optional

from django.contrib.auth import get_user_model
from ninja import Schema
from pydantic import EmailStr, field_validator

User = get_user_model()


class RegisterIn(Schema):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    code: str
    token: str

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
    email: str
    first_name: str = ""
    last_name: str = ""
    bio: str = ""
    avatar: str | None = None
    stats: UserStatsSchema | None = None

    @staticmethod
    def resolve_avatar(obj):
        if hasattr(obj, "avatar") and obj.avatar:
            return obj.avatar.url
        return f"https://api.dicebear.com/7.x/avataaars/svg?seed={obj.id}"


class ProfileUpdateIn(Schema):
    email: EmailStr = None
    first_name: str = None
    last_name: str = None
    bio: str = None


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


class PreWaitlistEmailIn(Schema):
    email: EmailStr
    code: str


class WaitlistEmailIn(Schema):
    email: EmailStr
    code: str
    token: str


class SubscriptionPlanOut(Schema):
    id: int
    slug: str
    name: str
    description: str
    price: float
    sort_order: int
    monthly_limits: bool
    max_explicador_messages: int | None = None
    max_explicador_participants: int | None = None
    max_courses_generated: int | None = None
    max_mindmaps_generated: int | None = None
    max_mindmap_modules: int | None = None
    max_mindmap_quizzes: int | None = None
    max_mindmap_materials: int | None = None

    @staticmethod
    def resolve_price(obj):
        return float(obj.price)


class UserSubscriptionOut(Schema):
    id: int
    plan: SubscriptionPlanOut | None = None
    status: str
    current_period_start: datetime
    current_period_end: datetime | None = None
    canceled_at: datetime | None = None
    payment_gateway: str


class UsageMetricOut(Schema):
    metric: str
    used: int
    limit: int | None
    remaining: int | None


class UsageSummaryOut(Schema):
    metrics: list[UsageMetricOut]


class CheckoutIn(Schema):
    plan_slug: str
    success_url: str
    cancel_url: str
    gateway: str = "stripe"


class CheckoutOut(Schema):
    url: str
    session_id: str


class CancelOut(Schema):
    success: bool
    message: str


class ConfirmCheckoutIn(Schema):
    session_id: str


class ConfirmCheckoutOut(Schema):
    success: bool
    plan: str
