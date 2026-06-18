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
    return notification


def notify_staff_users(title, message="", type="info", link=""):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    staff_users = User.objects.filter(is_staff=True)
    for user in staff_users:
        try:
            create_notification(user, title, message, type, link)
        except Exception as e:
            logger.warning(f"Failed to notify staff user {user.id}: {e}")


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
