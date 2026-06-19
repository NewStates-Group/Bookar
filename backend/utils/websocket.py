from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


async def send_user_update(user_id, data):
    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        f"user_{user_id}",
        {
            "type": "user.update",
            "data": data,
        },
    )


def send_user_update_sync(user_id, data):
    async_to_sync(send_user_update)(user_id, data)
