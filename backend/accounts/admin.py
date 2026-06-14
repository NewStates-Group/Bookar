from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import SubscriptionPlan, UsageRecord, User, UserSubscription

admin.site.register(User, UserAdmin)


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = [
        "slug", "name", "price", "daily_limits", "sort_order", "is_active",
    ]
    list_editable = ["price", "daily_limits", "sort_order", "is_active"]
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
