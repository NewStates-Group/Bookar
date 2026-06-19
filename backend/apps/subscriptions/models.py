import uuid

from cloudinary_storage.storage import MediaCloudinaryStorage
from django.conf import settings
from django.db import models


class SubscriptionPlan(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    monthly_limits = models.BooleanField(
        default=False,
        help_text="True = limites mensais (Pro/Pro+), False = limites totais/vitalícios (Free)",
    )

    max_explicador_messages = models.IntegerField(
        null=True, blank=True, help_text="None = ilimitado"
    )
    max_explicador_participants = models.IntegerField(null=True, blank=True)
    max_courses_generated = models.IntegerField(null=True, blank=True)
    max_mindmaps_generated = models.IntegerField(null=True, blank=True)
    max_mindmap_modules = models.IntegerField(null=True, blank=True)
    max_mindmap_quizzes = models.IntegerField(null=True, blank=True)
    max_mindmap_materials = models.IntegerField(null=True, blank=True)

    gateway_price_id = models.CharField(max_length=255, blank=True, default="")
    manual_payment_iban = models.CharField(max_length=50, blank=True, default="")
    manual_payment_account_name = models.CharField(
        max_length=200, blank=True, default=""
    )
    manual_payment_phone = models.CharField(max_length=50, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order"]
        db_table = "accounts_subscriptionplan"

    def __str__(self):
        return self.name


class UserSubscription(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Activo"
        CANCELED = "canceled", "Cancelado"
        PAST_DUE = "past_due", "Vencido"
        EXPIRED = "expired", "Expirado"
        TRIALING = "trialing", "Em teste"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        related_name="subscriptions",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    current_period_start = models.DateTimeField(auto_now_add=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)

    payment_gateway = models.CharField(max_length=20, blank=True, default="")
    gateway_subscription_id = models.CharField(max_length=255, blank=True, default="")
    gateway_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_usersubscription"

    def __str__(self):
        plan_name = self.plan.name if self.plan else "Nenhum"
        return f"{self.user.email} - {plan_name} ({self.status})"


class SubscriptionHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription_history",
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20)
    payment_gateway = models.CharField(max_length=20, blank=True, default="")
    period_start = models.DateTimeField()
    period_end = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "subscription histories"
        ordering = ["-period_start"]
        db_table = "accounts_subscriptionhistory"

    def __str__(self):
        plan_name = self.plan.name if self.plan else "Nenhum"
        return f"{self.user.email} - {plan_name} ({self.status})"


class UsageRecord(models.Model):
    METRIC_CHOICES = [
        ("explicador_message", "Mensagem no Explicador"),
        ("course_generated", "Curso Gerado"),
        ("mindmap_generated", "Mapa Mental Gerado"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="usage_records"
    )
    date = models.DateField()
    metric = models.CharField(max_length=50, choices=METRIC_CHOICES)
    count = models.IntegerField(default=0)

    class Meta:
        unique_together = ("user", "date", "metric")
        db_table = "accounts_usagerecord"

    def __str__(self):
        return f"{self.user.email} - {self.metric} - {self.date}: {self.count}"


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    type = models.CharField(max_length=50, default="info")
    link = models.CharField(max_length=500, blank=True, default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "accounts_notification"

    def __str__(self):
        return f"{self.user.email} - {self.title[:50]}"


class PaymentReceipt(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovado"
        REJECTED = "rejected", "Recusado"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_receipts",
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.SET_NULL, null=True, related_name="receipts"
    )
    receipt = models.ImageField(upload_to="receipts/", storage=MediaCloudinaryStorage())
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    iban = models.CharField(max_length=50, blank=True, default="")
    account_name = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    secret_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    admin_notes = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_receipts",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "accounts_paymentreceipt"

    def __str__(self):
        plan_name = self.plan.name if self.plan else "Nenhum"
        return f"{self.user.email} - {plan_name} - {self.get_status_display()}"
