from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('core', '0001_initial')]
    operations = [
        migrations.AddField(model_name='organization', name='agent_external_calls_per_hour_limit', field=models.PositiveIntegerField(default=10)),
        migrations.AddField(model_name='organization', name='agent_external_spend_per_hour_limit', field=models.DecimalField(decimal_places=6, default=5, max_digits=10)),
        migrations.CreateModel(name='AgentUsageReservation', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('tool_name', models.CharField(max_length=80)),
            ('projected_cost_usd', models.DecimalField(decimal_places=6, default=0, max_digits=10)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_usage_reservations', to='core.organization')),
            ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usage_reservations', to='core.agentrun')),
        ]),
    ]
