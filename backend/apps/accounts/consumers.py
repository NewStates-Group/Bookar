import json

from channels.generic.websocket import AsyncWebsocketConsumer


class UserUpdateConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

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
