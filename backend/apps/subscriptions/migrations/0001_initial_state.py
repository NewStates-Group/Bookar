import cloudinary_storage.storage
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    state_operations = [
        migrations.CreateModel(
            name="SubscriptionPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(unique=True)),
                ("name", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True, default="")),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.IntegerField(default=0)),
                ("monthly_limits", models.BooleanField(default=False, help_text="True = limites mensais (Pro/Pro+), False = limites totais/vitalícios (Free)")),
                ("max_explicador_messages", models.IntegerField(blank=True, help_text="None = ilimitado", null=True)),
                ("max_explicador_participants", models.IntegerField(blank=True, null=True)),
                ("max_courses_generated", models.IntegerField(blank=True, null=True)),
                ("max_mindmaps_generated", models.IntegerField(blank=True, null=True)),
                ("max_mindmap_modules", models.IntegerField(blank=True, null=True)),
                ("max_mindmap_quizzes", models.IntegerField(blank=True, null=True)),
                ("max_mindmap_materials", models.IntegerField(blank=True, null=True)),
                ("gateway_price_id", models.CharField(blank=True, default="", max_length=255)),
                ("manual_payment_iban", models.CharField(blank=True, default="", max_length=50)),
                ("manual_payment_account_name", models.CharField(blank=True, default="", max_length=200)),
                ("manual_payment_phone", models.CharField(blank=True, default="", max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "accounts_subscriptionplan",
                "ordering": ["sort_order"],
            },
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("message", models.TextField(blank=True, default="")),
                ("type", models.CharField(default="info", max_length=50)),
                ("link", models.CharField(blank=True, default="", max_length=500)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "accounts_notification",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="SubscriptionHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(max_length=20)),
                ("payment_gateway", models.CharField(blank=True, default="", max_length=20)),
                ("period_start", models.DateTimeField()),
                ("period_end", models.DateTimeField(blank=True, null=True)),
                ("canceled_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subscription_history", to=settings.AUTH_USER_MODEL)),
                ("plan", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to="subscriptions.subscriptionplan")),
            ],
            options={
                "verbose_name_plural": "subscription histories",
                "db_table": "accounts_subscriptionhistory",
                "ordering": ["-period_start"],
            },
        ),
        migrations.CreateModel(
            name="PaymentReceipt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("receipt", models.ImageField(storage=cloudinary_storage.storage.MediaCloudinaryStorage(), upload_to="receipts/")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("iban", models.CharField(blank=True, default="", max_length=50)),
                ("account_name", models.CharField(blank=True, default="", max_length=200)),
                ("phone", models.CharField(blank=True, default="", max_length=50)),
                ("status", models.CharField(choices=[("pending", "Pendente"), ("approved", "Aprovado"), ("rejected", "Recusado")], default="pending", max_length=20)),
                ("secret_token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("admin_notes", models.TextField(blank=True, default="")),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_receipts", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payment_receipts", to=settings.AUTH_USER_MODEL)),
                ("plan", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="receipts", to="subscriptions.subscriptionplan")),
            ],
            options={
                "db_table": "accounts_paymentreceipt",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="UserSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("active", "Activo"), ("canceled", "Cancelado"), ("past_due", "Vencido"), ("expired", "Expirado"), ("trialing", "Em teste")], default="active", max_length=20)),
                ("current_period_start", models.DateTimeField(auto_now_add=True)),
                ("current_period_end", models.DateTimeField(blank=True, null=True)),
                ("canceled_at", models.DateTimeField(blank=True, null=True)),
                ("payment_gateway", models.CharField(blank=True, default="", max_length=20)),
                ("gateway_subscription_id", models.CharField(blank=True, default="", max_length=255)),
                ("gateway_data", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("plan", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="subscriptions", to="subscriptions.subscriptionplan")),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="subscription", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "accounts_usersubscription",
            },
        ),
        migrations.CreateModel(
            name="UsageRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("metric", models.CharField(choices=[("explicador_message", "Mensagem no Explicador"), ("course_generated", "Curso Gerado"), ("mindmap_generated", "Mapa Mental Gerado")], max_length=50)),
                ("count", models.IntegerField(default=0)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="usage_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "accounts_usagerecord",
                "unique_together": {("user", "date", "metric")},
            },
        ),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(state_operations=state_operations),
    ]
