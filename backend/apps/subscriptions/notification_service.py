import logging

from .models import Notification

logger = logging.getLogger(__name__)


def create_notification(user, title, message="", type="info", link=""):
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        type=type,
        link=link,
    )
    try:
        from utils.websocket import send_user_update

        send_user_update(
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


def mark_notification_read(notification_id, user):
    try:
        notification = Notification.objects.get(id=notification_id, user=user)
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return notification
    except Notification.DoesNotExist:
        return None


def mark_all_notifications_read(user):
    return Notification.objects.filter(user=user, is_read=False).update(is_read=True)


def get_unread_count(user):
    return Notification.objects.filter(user=user, is_read=False).count()


def get_notifications(user, limit=50):
    return Notification.objects.filter(user=user)[:limit]
