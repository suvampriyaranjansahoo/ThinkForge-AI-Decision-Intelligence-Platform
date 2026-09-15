from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('core', '0004_external_data_sharing_toggle')]
    operations = [
        migrations.AlterField(
            model_name='agentrun',
            name='state',
            field=models.CharField(
                choices=[(x, x) for x in (
                    'PLANNED', 'AWAITING_APPROVAL', 'RUNNING', 'TOOL_CALLING',
                    'VALIDATING', 'NEEDS_HUMAN_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED',
                )],
                default='PLANNED', max_length=32,
            ),
        ),
    ]
