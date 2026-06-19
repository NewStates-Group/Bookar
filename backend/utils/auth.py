from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from ninja_jwt.tokens import AccessToken

User = get_user_model()


@sync_to_async
def get_user(token_str):
    if not token_str:
        return AnonymousUser()
    try:
        token = AccessToken(token_str)
        user_id = token.payload.get("user_id")
        return User.objects.get(pk=user_id)
    except Exception:
        return AnonymousUser()
