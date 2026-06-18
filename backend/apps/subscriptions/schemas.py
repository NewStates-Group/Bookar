from datetime import datetime

from ninja import Schema


class SubscriptionPlanOut(Schema):
    id: int
    slug: str
    name: str
    description: str
    price: float
    sort_order: int
    monthly_limits: bool
    max_explicador_messages: int | None = None
    max_explicador_participants: int | None = None
    max_courses_generated: int | None = None
    max_mindmaps_generated: int | None = None
    max_mindmap_modules: int | None = None
    max_mindmap_quizzes: int | None = None
    max_mindmap_materials: int | None = None
    manual_payment_iban: str = ""
    manual_payment_account_name: str = ""
    manual_payment_phone: str = ""

    @staticmethod
    def resolve_price(obj):
        return float(obj.price)


class UserSubscriptionOut(Schema):
    id: int
    plan: SubscriptionPlanOut | None = None
    status: str
    current_period_start: datetime
    current_period_end: datetime | None = None
    canceled_at: datetime | None = None
    payment_gateway: str


class UsageMetricOut(Schema):
    metric: str
    used: int
    limit: int | None
    remaining: int | None


class UsageSummaryOut(Schema):
    metrics: list[UsageMetricOut]


class CheckoutIn(Schema):
    plan_slug: str
    success_url: str
    cancel_url: str
    gateway: str = "stripe"


class CheckoutOut(Schema):
    url: str
    session_id: str


class CancelOut(Schema):
    success: bool
    message: str


class ConfirmCheckoutIn(Schema):
    session_id: str
    gateway: str = "stripe"


class ConfirmCheckoutOut(Schema):
    success: bool
    plan: str


class SubscriptionHistoryOut(Schema):
    id: int
    plan: SubscriptionPlanOut | None = None
    status: str
    payment_gateway: str
    period_start: datetime
    period_end: datetime | None = None
    canceled_at: datetime | None = None
    created_at: datetime


class ManualPaymentReceiptOut(Schema):
    id: int
    plan_name: str
    amount: float
    iban: str
    account_name: str
    phone: str
    status: str
    admin_notes: str
    receipt_url: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None

    @staticmethod
    def resolve_amount(obj):
        return float(obj.amount)

    @staticmethod
    def resolve_plan_name(obj):
        return obj.plan.name if obj.plan else ""

    @staticmethod
    def resolve_receipt_url(obj):
        if obj.receipt and hasattr(obj.receipt, "url"):
            return obj.receipt.url
        return None


class SubmitManualReceiptIn(Schema):
    plan_slug: str


class NotificationOut(Schema):
    id: int
    title: str
    message: str
    type: str
    link: str
    is_read: bool
    created_at: datetime


class UnreadCountOut(Schema):
    count: int


class ReceiptRejectIn(Schema):
    notes: str = ""


class ReceiptActionOut(Schema):
    success: bool
    message: str
