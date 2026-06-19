import logging
import os
from datetime import timedelta

import stripe
from django.utils import timezone

from ..models import SubscriptionPlan, UserSubscription
from .base import BasePaymentProvider

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")


class StripePaymentProvider(BasePaymentProvider):
    gateway = "stripe"

    def create_checkout_session(
        self, plan, user, success_url: str, cancel_url: str
    ) -> dict:
        if not plan.gateway_price_id:
            raise ValueError(
                f"Plano {plan.slug} não tem price_id configurado no Stripe."
            )

        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": plan.gateway_price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "plan_slug": plan.slug,
                "user_id": str(user.id),
            },
            client_reference_id=str(user.id),
        )

        user_sub, _ = UserSubscription.objects.get_or_create(
            user=user,
            defaults={
                "plan": plan,
                "status": UserSubscription.Status.TRIALING,
                "payment_gateway": "stripe",
            },
        )

        return {"url": session.url, "session_id": session.id}

    def retrieve_checkout_session(self, session_id: str):
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return session
        except stripe.error.StripeError:
            return None

    def cancel_subscription(self, subscription) -> bool:
        if subscription.gateway_subscription_id:
            try:
                stripe.Subscription.delete(subscription.gateway_subscription_id)
            except stripe.error.StripeError as e:
                logger.warning(f"Stripe cancel error: {e}")

        subscription.status = UserSubscription.Status.CANCELED
        subscription.canceled_at = timezone.now()
        subscription.save(update_fields=["status", "canceled_at"])
        return True

    def handle_webhook(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

        if endpoint_secret:
            try:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, endpoint_secret
                )
            except (ValueError, stripe.error.SignatureVerificationError) as e:
                logger.warning(f"Stripe webhook signature invalid: {e}")
                return None
        else:
            event = stripe.Event.construct_from(payload, stripe.api_key)

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            metadata = session.get("metadata", {})
            plan_slug = metadata.get("plan_slug")
            user_id = metadata.get("user_id")

            if plan_slug and user_id:
                self._sync_stripe_sub(session.get("subscription"), user_id, plan_slug)

        elif event["type"] == "invoice.payment_succeeded":
            subscription_id = event["data"]["object"].get("subscription")
            if subscription_id:
                self._update_status(subscription_id, UserSubscription.Status.ACTIVE)

        elif event["type"] == "invoice.payment_failed":
            subscription_id = event["data"]["object"].get("subscription")
            if subscription_id:
                self._update_status(subscription_id, UserSubscription.Status.PAST_DUE)

        elif event["type"] == "customer.subscription.updated":
            sub_data = event["data"]["object"]
            self._sync_status_from_stripe(sub_data)

        elif event["type"] == "customer.subscription.deleted":
            sub_data = event["data"]["object"]
            sub_id = sub_data.get("id")
            if sub_id:
                self._update_status(sub_id, UserSubscription.Status.CANCELED)

        return None

    def _sync_stripe_sub(self, sub_id, user_id, plan_slug):
        from ..models import UserSubscription

        try:
            user_sub = UserSubscription.objects.get(user_id=user_id)
            plan = SubscriptionPlan.objects.get(slug=plan_slug)
            user_sub.plan = plan
            user_sub.status = UserSubscription.Status.ACTIVE
            user_sub.payment_gateway = "stripe"
            user_sub.gateway_subscription_id = sub_id
            now = timezone.now()
            user_sub.current_period_start = now
            try:
                stripe_sub = stripe.Subscription.retrieve(sub_id)
                period_end = stripe_sub.get("current_period_end")
                if period_end:
                    user_sub.current_period_end = timezone.datetime.fromtimestamp(
                        period_end, tz=timezone.utc
                    )
                else:
                    user_sub.current_period_end = (
                        now + timedelta(days=30) if plan.monthly_limits else None
                    )
            except stripe.error.StripeError:
                user_sub.current_period_end = (
                    now + timedelta(days=30) if plan.monthly_limits else None
                )
            user_sub.save()
        except (UserSubscription.DoesNotExist, SubscriptionPlan.DoesNotExist) as e:
            logger.warning(f"Stripe sync failed: {e}")

    def _update_status(self, sub_id, status):
        from ..models import UserSubscription

        try:
            user_sub = UserSubscription.objects.get(gateway_subscription_id=sub_id)
            user_sub.status = status
            user_sub.save(update_fields=["status"])
        except UserSubscription.DoesNotExist:
            logger.warning(f"Subscription {sub_id} not found for status update")

    def _sync_status_from_stripe(self, sub_data):
        from ..models import UserSubscription

        sub_id = sub_data.get("id")
        stripe_status = sub_data.get("status", "")
        status_map = {
            "active": UserSubscription.Status.ACTIVE,
            "past_due": UserSubscription.Status.PAST_DUE,
            "canceled": UserSubscription.Status.CANCELED,
            "unpaid": UserSubscription.Status.PAST_DUE,
            "incomplete": UserSubscription.Status.PAST_DUE,
            "incomplete_expired": UserSubscription.Status.EXPIRED,
            "trialing": UserSubscription.Status.TRIALING,
            "paused": UserSubscription.Status.PAUSED
            if hasattr(UserSubscription.Status, "PAUSED")
            else UserSubscription.Status.ACTIVE,
        }
        new_status = status_map.get(stripe_status)
        if new_status:
            try:
                user_sub = UserSubscription.objects.get(gateway_subscription_id=sub_id)
                user_sub.status = new_status
                user_sub.save(update_fields=["status"])
            except UserSubscription.DoesNotExist:
                logger.warning(f"Subscription {sub_id} not found for sync")

    def get_subscription_status(self, subscription) -> str:
        if not subscription.gateway_subscription_id:
            return subscription.status
        try:
            stripe_sub = stripe.Subscription.retrieve(
                subscription.gateway_subscription_id
            )
            status_map = {
                "active": UserSubscription.Status.ACTIVE,
                "past_due": UserSubscription.Status.PAST_DUE,
                "canceled": UserSubscription.Status.CANCELED,
                "unpaid": UserSubscription.Status.PAST_DUE,
                "trialing": UserSubscription.Status.TRIALING,
            }
            return status_map.get(stripe_sub.status, subscription.status)
        except stripe.error.StripeError:
            return subscription.status

    def sync_subscription(self, subscription) -> object:
        remote_status = self.get_subscription_status(subscription)
        if remote_status != subscription.status:
            subscription.status = remote_status
            subscription.save(update_fields=["status"])
        return subscription
