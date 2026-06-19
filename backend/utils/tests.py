import uuid

from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from ninja_jwt.tokens import RefreshToken

User = get_user_model()


def _suffix():
    return uuid.uuid4().hex[:8]


def create_user(email=None, password="Testpass123", **kwargs):
    suffix = _suffix()
    if email is None:
        email = f"user_{suffix}@example.com"
    defaults = {"first_name": "Test", "last_name": "User"}
    defaults.update(kwargs)
    username = defaults.pop("username", f"user_{suffix}")
    user = User.objects.create_user(
        username=username, email=email, password=password, **defaults
    )
    return user


async def acreate_user(email=None, password="Testpass123", **kwargs):
    return await sync_to_async(create_user)(email=email, password=password, **kwargs)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


aget_tokens_for_user = sync_to_async(get_tokens_for_user)


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


LIST_ENDPOINTS = {
    "courses": "/api/courses",
    "mind-maps": "/api/mind-maps",
    "explicador": "/api/explicador",
    "folhas": "/api/folhas",
    "notifications": "/api/notifications",
}
