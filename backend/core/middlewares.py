from channels.middleware import BaseMiddleware
from utils.auth import get_user


class AuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope = dict(scope)

        query_string = scope.get("query_string", b"").decode("utf-8")
        params = dict(x.split("=") for x in query_string.split("&") if "=" in x)
        token_str = params.get("t")

        scope["user"] = await get_user(token_str)

        return await super().__call__(scope, receive, send)
