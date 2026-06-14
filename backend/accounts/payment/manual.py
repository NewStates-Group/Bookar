import logging

from django.utils import timezone

from accounts.models import UserSubscription
from .base import BasePaymentProvider

logger = logging.getLogger(__name__)


class ManualPaymentProvider(BasePaymentProvider):
    gateway = "manual"

    def create_checkout_session(
        self, plan, user, success_url: str, cancel_url: str
    ) -> dict:
        raise NotImplementedError(
            "Manual provider does not support checkout sessions. "
            "Use admin panel to assign plans."
        )

    def cancel_subscription(self, subscription) -> bool:
        subscription.status = UserSubscription.Status.CANCELED
        subscription.canceled_at = timezone.now()
        subscription.save(update_fields=["status", "canceled_at"])
        return True

    def handle_webhook(self, request):
        return None

    def get_subscription_status(self, subscription) -> str:
        return subscription.status

    def sync_subscription(self, subscription) -> object:
        return subscription
