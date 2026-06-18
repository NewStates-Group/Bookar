from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_user_update(user_id, data):
    """
    Send a message to a user's WebSocket group.
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{user_id}",
        {
            "type": "user.update",
            "data": data,
        },
    )


def send_admin_update(data):
    """
    Send a message to all connected admin users via the admin_updates group.
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "admin_updates",
        {
            "type": "admin.update",
            "data": data,
        },
    )
