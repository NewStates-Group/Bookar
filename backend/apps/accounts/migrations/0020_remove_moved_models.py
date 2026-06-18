from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_add_phone_fields"),
    ]

    state_operations = [
        migrations.RemoveField(
            model_name="paymentreceipt",
            name="plan",
        ),
        migrations.RemoveField(
            model_name="paymentreceipt",
            name="reviewed_by",
        ),
        migrations.RemoveField(
            model_name="paymentreceipt",
            name="user",
        ),
        migrations.RemoveField(
            model_name="subscriptionhistory",
            name="plan",
        ),
        migrations.RemoveField(
            model_name="subscriptionhistory",
            name="user",
        ),
        migrations.RemoveField(
            model_name="usersubscription",
            name="plan",
        ),
        migrations.AlterUniqueTogether(
            name="usagerecord",
            unique_together=None,
        ),
        migrations.RemoveField(
            model_name="usagerecord",
            name="user",
        ),
        migrations.RemoveField(
            model_name="usersubscription",
            name="user",
        ),
        migrations.DeleteModel(
            name="Notification",
        ),
        migrations.DeleteModel(
            name="PaymentReceipt",
        ),
        migrations.DeleteModel(
            name="SubscriptionHistory",
        ),
        migrations.DeleteModel(
            name="SubscriptionPlan",
        ),
        migrations.DeleteModel(
            name="UsageRecord",
        ),
        migrations.DeleteModel(
            name="UserSubscription",
        ),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(state_operations=state_operations),
    ]
