from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('core', '0003_agent_review_workflow')]
    operations = [
        migrations.AddField(model_name='organization', name='external_data_sharing_enabled', field=models.BooleanField(default=True)),
    ]
