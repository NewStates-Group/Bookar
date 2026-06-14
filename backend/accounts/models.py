from cloudinary_storage.storage import MediaCloudinaryStorage
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)
    avatar = models.ImageField(
        upload_to="avatars/", null=True, blank=True, storage=MediaCloudinaryStorage()
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []


class EmailVerificationCode(models.Model):
    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.email} - {self.code}"


class Waitlist(models.Model):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email


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

    max_explicador_messages = models.IntegerField(null=True, blank=True, help_text="None = ilimitado")
    max_explicador_participants = models.IntegerField(null=True, blank=True)
    max_courses_generated = models.IntegerField(null=True, blank=True)
    max_mindmaps_generated = models.IntegerField(null=True, blank=True)
    max_mindmap_modules = models.IntegerField(null=True, blank=True)
    max_mindmap_quizzes = models.IntegerField(null=True, blank=True)
    max_mindmap_materials = models.IntegerField(null=True, blank=True)

    gateway_price_id = models.CharField(max_length=255, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order"]

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
        User, on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.SET_NULL, null=True, related_name="subscriptions"
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

    def __str__(self):
        plan_name = self.plan.name if self.plan else "Nenhum"
        return f"{self.user.email} - {plan_name} ({self.status})"


class SubscriptionHistory(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="subscription_history"
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.SET_NULL, null=True
    )
    status = models.CharField(max_length=20)
    payment_gateway = models.CharField(max_length=20, blank=True, default="")
    period_start = models.DateTimeField()
    period_end = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "subscription histories"
        ordering = ["-period_start"]

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
        User, on_delete=models.CASCADE, related_name="usage_records"
    )
    date = models.DateField()
    metric = models.CharField(max_length=50, choices=METRIC_CHOICES)
    count = models.IntegerField(default=0)

    class Meta:
        unique_together = ("user", "date", "metric")

    def __str__(self):
        return f"{self.user.email} - {self.metric} - {self.date}: {self.count}"
