from injector import inject
from ninja import File, Form
from ninja.files import UploadedFile
from ninja_extra import api_controller, route
from ninja_jwt.authentication import JWTAuth

from .schemas import (
    CancelOut,
    CheckoutIn,
    CheckoutOut,
    ConfirmCheckoutIn,
    ConfirmCheckoutOut,
    ManualPaymentReceiptOut,
    NotificationOut,
    ReceiptActionOut,
    ReceiptRejectIn,
    SubscriptionHistoryOut,
    SubscriptionPlanOut,
    UnreadCountOut,
    UsageSummaryOut,
    UserSubscriptionOut,
)
from .services import SubscriptionService


@api_controller("subscriptions", tags=["Subscriptions"], auth=JWTAuth())
class SubscriptionController:
    @inject
    def __init__(self, subscription_service: SubscriptionService):
        self.subscription_service = subscription_service

    @route.get("plans", response=list[SubscriptionPlanOut], auth=None)
    def list_plans(self, request):
        return self.subscription_service.list_plans()

    @route.get("my", response=UserSubscriptionOut)
    def my_subscription(self, request):
        return self.subscription_service.get_user_subscription(request.user)

    @route.get("usage", response=UsageSummaryOut)
    def my_usage(self, request):
        return self.subscription_service.get_usage_summary(request.user)

    @route.get("history", response=list[SubscriptionHistoryOut])
    def my_history(self, request):
        return self.subscription_service.get_history(request.user)

    @route.post("checkout", response=CheckoutOut)
    def create_checkout(self, request, data: CheckoutIn):
        result = self.subscription_service.upgrade(
            request.user,
            data.plan_slug,
            gateway=data.gateway,
            success_url=data.success_url,
            cancel_url=data.cancel_url,
        )
        if isinstance(result, dict) and "url" in result:
            return result
        return {"url": "", "session_id": ""}

    @route.post("cancel", response=CancelOut)
    def cancel_subscription(self, request):
        return self.subscription_service.cancel(request.user)

    @route.post("webhook/{gateway}", auth=None)
    def webhook(self, request, gateway: str):
        return self.subscription_service.handle_webhook(request, gateway)

    @route.post("confirm", response=ConfirmCheckoutOut)
    def confirm_checkout(self, request, data: ConfirmCheckoutIn):
        return self.subscription_service.confirm_checkout(
            request.user, data.session_id, data.gateway
        )

    @route.post("manual/submit", auth=JWTAuth())
    def submit_manual_receipt(
        self, request, plan_slug: Form[str], receipt: File[UploadedFile]
    ):
        return self.subscription_service.submit_manual_receipt(
            request.user, plan_slug, receipt
        )

    @route.get(
        "manual/receipts", response=list[ManualPaymentReceiptOut], auth=JWTAuth()
    )
    def my_manual_receipts(self, request):
        return self.subscription_service.get_user_receipts(request.user)

    @route.get("manual/receipts/{token}/approve", response=ReceiptActionOut, auth=None)
    def approve_receipt_public(self, request, token: str):
        return self.subscription_service.approve_receipt_by_token(token)

    @route.get("manual/receipts/{token}/reject", response=ReceiptActionOut, auth=None)
    def reject_receipt_get(self, request, token: str):
        return self.subscription_service.reject_receipt_by_token(token, "")

    @route.post("manual/receipts/{token}/reject", response=ReceiptActionOut, auth=None)
    def reject_receipt_public(self, request, token: str, data: ReceiptRejectIn = None):
        notes = data.notes if data else ""
        return self.subscription_service.reject_receipt_by_token(token, notes)

    @route.get("notifications", response=list[NotificationOut], auth=JWTAuth())
    def list_notifications(self, request):
        return self.subscription_service.get_notifications(request.user)

    @route.get("notifications/unread-count", response=UnreadCountOut, auth=JWTAuth())
    def unread_notification_count(self, request):
        count = self.subscription_service.get_unread_count(request.user)
        return {"count": count}

    @route.post("notifications/{id}/read", auth=JWTAuth())
    def mark_notification_read(self, request, id: int):
        self.subscription_service.mark_notification_read(id, request.user)
        return {"success": True}

    @route.post("notifications/read-all", auth=JWTAuth())
    def mark_all_notifications_read(self, request):
        self.subscription_service.mark_all_notifications_read(request.user)
        return {"success": True}
