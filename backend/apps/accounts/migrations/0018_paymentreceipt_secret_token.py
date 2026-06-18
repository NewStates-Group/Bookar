import uuid

from django.db import migrations, models


def populate_secret_tokens(apps, schema_editor):
    PaymentReceipt = apps.get_model("accounts", "PaymentReceipt")
    for receipt in PaymentReceipt.objects.all():
        receipt.secret_token = uuid.uuid4()
        receipt.save(update_fields=["secret_token"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0017_notification"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentreceipt",
            name="secret_token",
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(populate_secret_tokens, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name="paymentreceipt",
            name="secret_token",
            field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False),
        ),
    ]
