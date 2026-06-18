from django.db import migrations


def backfill_subscriptions(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    UserSubscription = apps.get_model("subscriptions", "UserSubscription")

    free_plan = SubscriptionPlan.objects.filter(slug="free").first()
    if not free_plan:
        return

    for user in User.objects.filter(subscription__isnull=True).iterator():
        UserSubscription.objects.get_or_create(
            user=user,
            defaults={
                "plan": free_plan,
                "status": "active",
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_squashed_0022_backfill_user_subscriptions"),
        ("subscriptions", "0001_initial_state"),
    ]

    operations = [
        migrations.RunPython(backfill_subscriptions, migrations.RunPython.noop),
    ]
