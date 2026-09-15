from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('core', '0002_agent_circuit_breaker')]
    operations = [
        migrations.AddField(model_name='agentrun', name='reviewer', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='thinkforge_reviews', to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='agentrun', name='review_assigned_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='agentrun', name='review_due_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='agentrun', name='reviewed_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='agentrun', name='review_outcome', field=models.CharField(blank=True, max_length=16)),
    ]
