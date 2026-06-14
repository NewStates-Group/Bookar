import logging

from django.conf import settings

from .base import BasePaymentProvider

logger = logging.getLogger(__name__)


class StripePaymentProvider(BasePaymentProvider):
    gateway = "stripe"

    def __init__(self):
        self._stripe = None
        self._init_stripe()

    def _init_stripe(self):
        try:
            import stripe as stripe_lib
            stripe_lib.api_key = settings.STRIPE_SECRET_KEY
            self._stripe = stripe_lib
        except ImportError:
            logger.warning("stripe library not installed")

    def _ensure_stripe(self):
        if self._stripe is None:
            self._init_stripe()

    def create_checkout_session(
        self, plan, user, success_url: str, cancel_url: str
    ) -> dict:
        self._ensure_stripe()
        if not plan.gateway_price_id:
            raise ValueError(f"Plan {plan.slug} has no gateway_price_id configured")

        session = self._stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": plan.gateway_price_id, "quantity": 1}],
            client_reference_id=str(user.id),
            customer_email=user.email,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "plan_slug": plan.slug,
                "user_id": str(user.id),
            },
        )
        return {"url": session.url, "session_id": session.id}

    def cancel_subscription(self, subscription) -> bool:
        self._ensure_stripe()
        try:
            self._stripe.Subscription.delete(
                subscription.gateway_subscription_id
            )
            return True
        except Exception as e:
            logger.error(f"Stripe cancel failed: {e}")
            return False

    def handle_webhook(self, request):
        self._ensure_stripe()
        import json

        from django.conf import settings

        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

        try:
            event = self._stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            logger.warning("Stripe webhook: invalid payload")
            return None
        except self._stripe.error.SignatureVerificationError:
            logger.warning("Stripe webhook: invalid signature")
            return None

        from accounts.models import SubscriptionPlan, UserSubscription

        event_type = event.type

        if event_type == "checkout.session.completed":
            session = event.data.object
            metadata = dict(session.metadata) if session.metadata else {}
            user_id = metadata.get("user_id")
            plan_slug = metadata.get("plan_slug")
            sub_id = getattr(session, "subscription", None)

            if user_id and plan_slug and sub_id:
                try:
                    plan = SubscriptionPlan.objects.get(slug=plan_slug)
                    user_sub, _ = UserSubscription.objects.get_or_create(
                        user_id=user_id,
                        defaults={
                            "plan": plan,
                            "status": UserSubscription.Status.ACTIVE,
                            "payment_gateway": "stripe",
                            "gateway_subscription_id": sub_id,
                        },
                    )
                    if not _:
                        user_sub.plan = plan
                        user_sub.status = UserSubscription.Status.ACTIVE
                        user_sub.payment_gateway = "stripe"
                        user_sub.gateway_subscription_id = sub_id
                        user_sub.save()
                except SubscriptionPlan.DoesNotExist:
                    logger.error(f"Stripe webhook: plan {plan_slug} not found")

        elif event_type == "customer.subscription.updated":
            sub = event.data.object
            self._sync_stripe_sub(sub)

        elif event_type == "customer.subscription.deleted":
            sub = event.data.object
            self._sync_stripe_sub(sub, canceled=True)

        elif event_type == "invoice.payment_failed":
            sub = getattr(event.data.object, "subscription", None)
            if sub:
                try:
                    user_sub = UserSubscription.objects.get(
                        gateway_subscription_id=sub
                    )
                    user_sub.status = UserSubscription.Status.PAST_DUE
                    user_sub.save()
                except UserSubscription.DoesNotExist:
                    pass

        return event_type

    def _sync_stripe_sub(self, sub_data, canceled=False):
        from accounts.models import UserSubscription

        sub_id = getattr(sub_data, "id", None)
        if not sub_id:
            return

        try:
            user_sub = UserSubscription.objects.get(
                gateway_subscription_id=sub_id
            )
            status = getattr(sub_data, "status", "")
            status_map = {
                "active": UserSubscription.Status.ACTIVE,
                "past_due": UserSubscription.Status.PAST_DUE,
                "canceled": UserSubscription.Status.CANCELED,
                "unpaid": UserSubscription.Status.PAST_DUE,
                "incomplete": UserSubscription.Status.PAST_DUE,
                "incomplete_expired": UserSubscription.Status.EXPIRED,
                "trialing": UserSubscription.Status.TRIALING,
            }
            user_sub.status = status_map.get(
                status, UserSubscription.Status.CANCELED
            )
            if canceled:
                user_sub.status = UserSubscription.Status.CANCELED
            user_sub.save()
        except UserSubscription.DoesNotExist:
            logger.warning(f"Stripe webhook: subscription {sub_id} not found locally")

    def get_subscription_status(self, subscription) -> str:
        self._ensure_stripe()
        try:
            sub = self._stripe.Subscription.retrieve(
                subscription.gateway_subscription_id
            )
            return getattr(sub, "status", "unknown")
        except Exception:
            return "unknown"

    def sync_subscription(self, subscription) -> object:
        self._ensure_stripe()
        try:
            sub = self._stripe.Subscription.retrieve(
                subscription.gateway_subscription_id
            )
            self._sync_stripe_sub(sub)
            subscription.refresh_from_db()
            return subscription
        except Exception:
            return subscription

    def retrieve_checkout_session(self, session_id: str):
        self._ensure_stripe()
        try:
            return self._stripe.checkout.Session.retrieve(session_id)
        except Exception as e:
            logger.error(f"Failed to retrieve Stripe session: {e}")
            return None
