import json
from channels.generic.websocket import AsyncWebsocketConsumer
from ninja_jwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async

User = get_user_model()

class UserUpdateConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Authenticate using token from query string
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        params = dict(x.split("=") for x in query_string.split("&") if "=" in x)
        token_str = params.get("token")

        self.user = await self.get_user(token_str)

        if self.user.is_authenticated:
            self.group_name = f"user_{self.user.id}"
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def user_update(self, event):
        """
        Custom event handler for 'user.update' type.
        """
        await self.send(text_data=json.dumps(event["data"]))

    @sync_to_async
    def get_user(self, token_str):
        try:
            token = AccessToken(token_str)
            user_id = token.payload.get("user_id")
            return User.objects.get(pk=user_id)
        except Exception:
            from django.contrib.auth.models import AnonymousUser
            return AnonymousUser()
