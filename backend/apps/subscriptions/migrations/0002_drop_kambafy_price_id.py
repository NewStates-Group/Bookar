from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0001_initial_state"),
    ]

    operations = [
        migrations.RunSQL(
            "ALTER TABLE accounts_subscriptionplan DROP COLUMN IF EXISTS kambafy_price_id",
            migrations.RunSQL.noop,
        ),
    ]
