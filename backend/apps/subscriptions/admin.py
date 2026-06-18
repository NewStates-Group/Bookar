from django.contrib import admin
from django.contrib import messages
from django.utils.html import format_html

from .models import (
    Notification,
    PaymentReceipt,
    SubscriptionHistory,
    SubscriptionPlan,
    UsageRecord,
    UserSubscription,
)


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = [
        "slug", "name", "price", "monthly_limits", "sort_order", "is_active",
    ]
    list_editable = ["price", "monthly_limits", "sort_order", "is_active"]
    search_fields = ["name", "slug"]
    ordering = ["sort_order"]


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        "user", "plan", "status", "payment_gateway",
        "current_period_start", "current_period_end",
    ]
    list_filter = ["status", "plan", "payment_gateway"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    raw_id_fields = ["user"]


@admin.register(UsageRecord)
class UsageRecordAdmin(admin.ModelAdmin):
    list_display = ["user", "metric", "date", "count"]
    list_filter = ["metric", "date"]
    search_fields = ["user__email"]
    date_hierarchy = "date"


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "title", "type", "is_read", "created_at"]
    list_filter = ["type", "is_read"]
    search_fields = ["user__email", "title"]
    raw_id_fields = ["user"]


@admin.action(description="Aprovar comprovativos selecionados")
def approve_receipts(modeladmin, request, queryset):
    from .services import SubscriptionService

    service = SubscriptionService()
    count = 0
    for receipt in queryset.filter(status=PaymentReceipt.Status.PENDING):
        try:
            service.approve_receipt(receipt.id, request.user)
            count += 1
        except Exception as e:
            messages.error(request, f"Erro ao aprovar #{receipt.id}: {e}")
    if count:
        messages.success(request, f"{count} comprovativo(s) aprovado(s) com sucesso.")


@admin.action(description="Recusar comprovativos selecionados (com nota)")
def reject_receipts(modeladmin, request, queryset):
    from .services import SubscriptionService

    service = SubscriptionService()
    count = 0
    for receipt in queryset.filter(status=PaymentReceipt.Status.PENDING):
        try:
            service.reject_receipt(receipt.id, request.user, "Recusado pelo administrador.")
            count += 1
        except Exception as e:
            messages.error(request, f"Erro ao recusar #{receipt.id}: {e}")
    if count:
        messages.success(request, f"{count} comprovativo(s) recusado(s).")


@admin.register(PaymentReceipt)
class PaymentReceiptAdmin(admin.ModelAdmin):
    list_display = [
        "user", "plan_name", "amount_display", "status_colored",
        "created_at", "reviewed_by", "receipt_thumbnail",
    ]
    list_filter = ["status", "plan"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    readonly_fields = ["created_at", "reviewed_at", "receipt_preview"]
    raw_id_fields = ["user", "reviewed_by"]
    actions = [approve_receipts, reject_receipts]

    def plan_name(self, obj):
        return obj.plan.name if obj.plan else "—"
    plan_name.short_description = "Plano"

    def amount_display(self, obj):
        return f"{float(obj.amount):,.0f} Kz"
    amount_display.short_description = "Valor"

    def status_colored(self, obj):
        colors = {
            PaymentReceipt.Status.PENDING: "orange",
            PaymentReceipt.Status.APPROVED: "green",
            PaymentReceipt.Status.REJECTED: "red",
        }
        color = colors.get(obj.status, "grey")
        return format_html('<strong style="color: {};">{}</strong>', color, obj.get_status_display())
    status_colored.short_description = "Estado"

    def receipt_thumbnail(self, obj):
        if obj.receipt and hasattr(obj.receipt, "url"):
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-height: 50px; border-radius: 4px;" /></a>',
                obj.receipt.url, obj.receipt.url,
            )
        return "—"
    receipt_thumbnail.short_description = "Comprovativo"

    def receipt_preview(self, obj):
        if obj.receipt and hasattr(obj.receipt, "url"):
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-width: 400px; border-radius: 8px;" /></a>',
                obj.receipt.url, obj.receipt.url,
            )
        return "Nenhum ficheiro carregado."
    receipt_preview.short_description = "Pré-visualização"

    fieldsets = [
        ("Utilizador", {"fields": ["user", "plan", "amount", "iban", "account_name", "phone"]}),
        ("Comprovativo", {"fields": ["receipt_preview", "receipt"]}),
        ("Estado", {"fields": ["status", "admin_notes", "reviewed_by", "reviewed_at"]}),
        ("Datas", {"fields": ["created_at"]}),
    ]
