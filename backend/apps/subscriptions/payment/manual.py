import logging

from django.utils import timezone

from ..models import PaymentReceipt, SubscriptionPlan, UserSubscription
from .base import BasePaymentProvider

logger = logging.getLogger(__name__)


class ManualPaymentProvider(BasePaymentProvider):
    gateway = "manual"

    def create_checkout_session(
        self, plan, user, success_url: str, cancel_url: str
    ) -> dict:
        receipt = PaymentReceipt.objects.create(
            user=user,
            plan=plan,
            amount=plan.price,
            iban=plan.manual_payment_iban,
            account_name=plan.manual_payment_account_name,
            phone=plan.manual_payment_phone,
            status=PaymentReceipt.Status.PENDING,
        )
        return {
            "url": success_url.replace("{CHECKOUT_SESSION_ID}", str(receipt.id)),
            "session_id": str(receipt.id),
        }

    def retrieve_checkout_session(self, session_id: str) -> dict | None:
        try:
            receipt = PaymentReceipt.objects.get(id=session_id)
            return {
                "id": str(receipt.id),
                "status": "complete" if receipt.status == PaymentReceipt.Status.APPROVED else "pending",
                "metadata": {
                    "plan_slug": receipt.plan.slug if receipt.plan else "",
                    "user_id": str(receipt.user.id),
                },
            }
        except PaymentReceipt.DoesNotExist:
            return None

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
