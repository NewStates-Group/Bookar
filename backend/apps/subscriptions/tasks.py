from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model

from utils.mail import send_receipt_notification_email

User = get_user_model()


@shared_task
def send_receipt_notification_task(user_id, plan_id, receipt_url, secret_token=""):
    try:
        user = User.objects.get(id=user_id)
        from .models import SubscriptionPlan
        plan = SubscriptionPlan.objects.get(id=plan_id) if plan_id else None
        api_url = settings.API_URL
        approve_url = f"{api_url}/subscriptions/manual/receipts/{secret_token}/approve" if secret_token else ""
        reject_url = f"{api_url}/subscriptions/manual/receipts/{secret_token}/reject" if secret_token else ""
        send_receipt_notification_email(user, plan, receipt_url, approve_url, reject_url)
    except User.DoesNotExist:
        pass
