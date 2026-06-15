import json
import logging
import uuid

import requests
from django.conf import settings
from django.utils import timezone

from accounts.models import SubscriptionPlan, UserSubscription

from .base import BasePaymentProvider

logger = logging.getLogger(__name__)


class KambafyPaymentProvider(BasePaymentProvider):
    gateway = "kambafy"

    def __init__(self):
        self.api_key = settings.KAMBAFY_API_KEY
        self.api_url = settings.KAMBAFY_API_URL
        self.webhook_secret = settings.KAMBAFY_WEBHOOK_SECRET

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def create_checkout_session(
        self, plan, user, success_url: str, cancel_url: str
    ) -> dict:
        if not plan.kambafy_price_id:
            raise ValueError(f"Plan {plan.slug} has no kambafy_price_id configured")

        reference = f"bookar_{user.id}_{uuid.uuid4().hex[:12]}"

        payload = {
            "reference": reference,
            "price_id": plan.kambafy_price_id,
            "customer": {
                "name": user.get_full_name() or user.email,
                "email": user.email,
                "phone": "",
            },
            "success_url": success_url,
            "cancel_url": cancel_url,
            "metadata": {
                "plan_slug": plan.slug,
                "user_id": str(user.id),
            },
        }

        try:
            resp = requests.post(
                f"{self.api_url}/payments",
                json=payload,
                headers=self._headers(),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "url": data.get("payment_url"),
                "session_id": data.get("id", reference),
            }
        except requests.RequestException as e:
            logger.error(f"Kambafy create_checkout_session failed: {e}")
            raise

    def cancel_subscription(self, subscription) -> bool:
        try:
            resp = requests.post(
                f"{self.api_url}/subscriptions/{subscription.gateway_subscription_id}/cancel",
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            return True
        except requests.RequestException as e:
            logger.error(f"Kambafy cancel failed: {e}")
            return False

    def handle_webhook(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_X_KAMBAFY_SIGNATURE", "")

        if not self._verify_signature(payload, sig_header):
            logger.warning("Kambafy webhook: invalid signature")
            return None

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            logger.warning("Kambafy webhook: invalid JSON")
            return None

        event_type = data.get("event", data.get("type", ""))

        if event_type in ("payment.completed", "checkout.completed"):
            metadata = data.get("metadata", {}) or data.get("data", {}).get("metadata", {})
            user_id = metadata.get("user_id")
            plan_slug = metadata.get("plan_slug")
            sub_id = data.get("subscription_id", data.get("id", ""))

            if user_id and plan_slug:
                try:
                    plan = SubscriptionPlan.objects.get(slug=plan_slug)
                    user_sub, created = UserSubscription.objects.get_or_create(
                        user_id=user_id,
                        defaults={
                            "plan": plan,
                            "status": UserSubscription.Status.ACTIVE,
                            "payment_gateway": "kambafy",
                            "gateway_subscription_id": sub_id,
                        },
                    )
                    if not created:
                        user_sub.plan = plan
                        user_sub.status = UserSubscription.Status.ACTIVE
                        user_sub.payment_gateway = "kambafy"
                        user_sub.gateway_subscription_id = sub_id
                        user_sub.canceled_at = None
                        user_sub.save()
                except SubscriptionPlan.DoesNotExist:
                    logger.error(f"Kambafy webhook: plan {plan_slug} not found")

        elif event_type in ("payment.failed", "checkout.expired"):
            metadata = data.get("metadata", {}) or data.get("data", {}).get("metadata", {})
            user_id = metadata.get("user_id")
            if user_id:
                try:
                    user_sub = UserSubscription.objects.get(user_id=user_id)
                    user_sub.status = UserSubscription.Status.PAST_DUE
                    user_sub.save()
                except UserSubscription.DoesNotExist:
                    pass

        elif event_type == "subscription.cancelled":
            sub_id = data.get("subscription_id", data.get("id", ""))
            if sub_id:
                try:
                    user_sub = UserSubscription.objects.get(
                        gateway_subscription_id=sub_id
                    )
                    user_sub.status = UserSubscription.Status.CANCELED
                    user_sub.canceled_at = timezone.now()
                    user_sub.save()
                except UserSubscription.DoesNotExist:
                    pass

        return event_type

    def _verify_signature(self, payload: bytes, signature: str) -> bool:
        if not self.webhook_secret:
            logger.warning("Kambafy webhook secret not configured")
            return False
        import hmac
        expected = hmac.new(
            self.webhook_secret.encode(), payload, "sha256"
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def get_subscription_status(self, subscription) -> str:
        try:
            resp = requests.get(
                f"{self.api_url}/subscriptions/{subscription.gateway_subscription_id}",
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            status_map = {
                "active": "active",
                "cancelled": "canceled",
                "expired": "expired",
                "pending": "trialing",
                "failed": "past_due",
            }
            return status_map.get(data.get("status", ""), "unknown")
        except requests.RequestException as e:
            logger.error(f"Kambafy get_status failed: {e}")
            return "unknown"

    def sync_subscription(self, subscription) -> object:
        try:
            resp = requests.get(
                f"{self.api_url}/subscriptions/{subscription.gateway_subscription_id}",
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            status_map = {
                "active": UserSubscription.Status.ACTIVE,
                "cancelled": UserSubscription.Status.CANCELED,
                "expired": UserSubscription.Status.EXPIRED,
                "pending": UserSubscription.Status.TRIALING,
                "failed": UserSubscription.Status.PAST_DUE,
            }
            subscription.status = status_map.get(
                data.get("status", ""), UserSubscription.Status.ACTIVE
            )
            subscription.save()
            subscription.refresh_from_db()
            return subscription
        except requests.RequestException as e:
            logger.error(f"Kambafy sync failed: {e}")
            return subscription

    def retrieve_checkout_session(self, session_id: str) -> dict | None:
        try:
            resp = requests.get(
                f"{self.api_url}/payments/{session_id}",
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"Kambafy retrieve session failed: {e}")
            return None
