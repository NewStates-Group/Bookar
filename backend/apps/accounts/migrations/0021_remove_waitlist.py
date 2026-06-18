from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_remove_moved_models'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Waitlist',
        ),
    ]
