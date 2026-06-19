import logging

from asgiref.sync import sync_to_async

from .models import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    async def create_notification(self, user, title, message="", type="info", link=""):
        notification = await sync_to_async(Notification.objects.create)(
            user=user,
            title=title,
            message=message,
            type=type,
            link=link,
        )
        try:
            from utils.websocket import send_user_update
            await send_user_update(
                user.id,
                {
                    "event": "notification",
                    "notification": {
                        "id": notification.id,
                        "title": notification.title,
                        "message": notification.message,
                        "type": notification.type,
                        "link": notification.link,
                        "is_read": notification.is_read,
                        "created_at": notification.created_at.isoformat(),
                    },
                },
            )
        except Exception:
            pass
        return notification

    async def mark_read(self, notification_id, user):
        try:
            notification = await sync_to_async(Notification.objects.get)(
                id=notification_id, user=user
            )
            notification.is_read = True
            await sync_to_async(notification.save)(update_fields=["is_read"])
            return notification
        except Notification.DoesNotExist:
            return None

    async def mark_all_read(self, user):
        await sync_to_async(
            lambda: Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        )()

    async def get_unread_count(self, user):
        count = await sync_to_async(
            Notification.objects.filter(user=user, is_read=False).count
        )()
        return count

    async def list_notifications(self, user, limit=50):
        notifications = await sync_to_async(
            lambda: list(Notification.objects.filter(user=user)[:limit])
        )()
        return notifications
