import uuid
from django.conf import settings
from django.db import models
from pgvector.django import VectorField

class Organization(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);name=models.CharField(max_length=200);created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='organizations_created');agent_external_calls_per_hour_limit=models.PositiveIntegerField(default=10);agent_external_spend_per_hour_limit=models.DecimalField(max_digits=10,decimal_places=6,default=5);external_data_sharing_enabled=models.BooleanField(default=True);created_at=models.DateTimeField(auto_now_add=True)
    def __str__(self): return self.name
class Membership(models.Model):
    ROLES=[(x,x) for x in ('owner','admin','editor','reviewer','viewer')]
    organization=models.ForeignKey(Organization,on_delete=models.CASCADE,related_name='memberships');user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='thinkforge_memberships');role=models.CharField(max_length=16,choices=ROLES);created_at=models.DateTimeField(auto_now_add=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['organization','user'],name='unique_org_member')]
class Workspace(models.Model):
    organization=models.OneToOneField(Organization,on_delete=models.CASCADE,related_name='workspace');state=models.JSONField(default=dict);version=models.PositiveBigIntegerField(default=1);updated_at=models.DateTimeField(auto_now=True)
class Decision(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);organization=models.ForeignKey(Organization,on_delete=models.CASCADE,related_name='decisions');created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT);title=models.CharField(max_length=300);problem=models.TextField(blank=True);status=models.CharField(max_length=32,default='validate');payload=models.JSONField(default=dict);version=models.PositiveBigIntegerField(default=1);created_at=models.DateTimeField(auto_now_add=True);updated_at=models.DateTimeField(auto_now=True)
class Evidence(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);organization=models.ForeignKey(Organization,on_delete=models.CASCADE);decision=models.ForeignKey(Decision,on_delete=models.CASCADE,related_name='evidence');source=models.CharField(max_length=500);source_type=models.CharField(max_length=64);content=models.TextField();stance=models.CharField(max_length=32,default='neutral');strength=models.CharField(max_length=32,default='medium');metadata=models.JSONField(default=dict);created_at=models.DateTimeField(auto_now_add=True)
class Experiment(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);organization=models.ForeignKey(Organization,on_delete=models.CASCADE);decision=models.ForeignKey(Decision,on_delete=models.CASCADE,related_name='experiments');hypothesis=models.TextField();design=models.JSONField(default=dict);outcome=models.JSONField(default=dict);created_at=models.DateTimeField(auto_now_add=True);updated_at=models.DateTimeField(auto_now=True)
class Document(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);organization=models.ForeignKey(Organization,on_delete=models.CASCADE);uploaded_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT);name=models.CharField(max_length=300);mime_type=models.CharField(max_length=120,blank=True);checksum=models.CharField(max_length=64);metadata=models.JSONField(default=dict);created_at=models.DateTimeField(auto_now_add=True)
class Chunk(models.Model):
    document=models.ForeignKey(Document,on_delete=models.CASCADE,related_name='chunks');organization=models.ForeignKey(Organization,on_delete=models.CASCADE);chunk_index=models.PositiveIntegerField();content=models.TextField();embedding=VectorField(dimensions=1536,null=True,blank=True);metadata=models.JSONField(default=dict)
    class Meta: constraints=[models.UniqueConstraint(fields=['document','chunk_index'],name='unique_document_chunk')]
class AgentRun(models.Model):
    STATES=[(x,x) for x in ('PLANNED','AWAITING_APPROVAL','RUNNING','TOOL_CALLING','VALIDATING','NEEDS_HUMAN_REVIEW','COMPLETED','FAILED','CANCELLED')]
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);organization=models.ForeignKey(Organization,on_delete=models.CASCADE,related_name='agent_runs');user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT);decision=models.ForeignKey(Decision,on_delete=models.SET_NULL,null=True,blank=True);request_id=models.CharField(max_length=160);state=models.CharField(max_length=32,choices=STATES,default='PLANNED');agent_version=models.CharField(max_length=80);goal=models.TextField();plan=models.JSONField(default=dict);metrics=models.JSONField(default=dict);reviewer=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.SET_NULL,null=True,blank=True,related_name='thinkforge_reviews');review_assigned_at=models.DateTimeField(null=True,blank=True);review_due_at=models.DateTimeField(null=True,blank=True);reviewed_at=models.DateTimeField(null=True,blank=True);review_outcome=models.CharField(max_length=16,blank=True);created_at=models.DateTimeField(auto_now_add=True);updated_at=models.DateTimeField(auto_now=True)
class AgentStep(models.Model):
    run=models.ForeignKey(AgentRun,on_delete=models.CASCADE,related_name='steps');sequence_no=models.PositiveIntegerField();state=models.CharField(max_length=32);event_type=models.CharField(max_length=80);detail=models.JSONField(default=dict);created_at=models.DateTimeField(auto_now_add=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['run','sequence_no'],name='unique_agent_step_sequence')]
class AgentToolCall(models.Model):
    run=models.ForeignKey(AgentRun,on_delete=models.CASCADE,related_name='tool_calls');tool_name=models.CharField(max_length=80);status=models.CharField(max_length=32);attempt=models.PositiveIntegerField(default=1);input_hash=models.CharField(max_length=64,blank=True);output_hash=models.CharField(max_length=64,blank=True);latency_ms=models.PositiveIntegerField(default=0);cost_usd=models.DecimalField(max_digits=10,decimal_places=6,default=0);error_code=models.CharField(max_length=80,blank=True);created_at=models.DateTimeField(auto_now_add=True)
class AgentUsageReservation(models.Model):
    organization=models.ForeignKey(Organization,on_delete=models.CASCADE,related_name='agent_usage_reservations');run=models.ForeignKey(AgentRun,on_delete=models.CASCADE,related_name='usage_reservations');tool_name=models.CharField(max_length=80);projected_cost_usd=models.DecimalField(max_digits=10,decimal_places=6,default=0);created_at=models.DateTimeField(auto_now_add=True)
class AgentFeedback(models.Model):
    OUTCOMES=[(x,x) for x in ('accepted','rejected','edited','inconclusive')]
    run=models.ForeignKey(AgentRun,on_delete=models.CASCADE,related_name='feedback');user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT);rating=models.PositiveSmallIntegerField(null=True,blank=True);outcome=models.CharField(max_length=16,choices=OUTCOMES);note=models.TextField(blank=True);created_at=models.DateTimeField(auto_now_add=True)
class AuditEvent(models.Model):
    organization=models.ForeignKey(Organization,on_delete=models.CASCADE);actor=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT);event_type=models.CharField(max_length=80);entity_type=models.CharField(max_length=80);entity_id=models.UUIDField(null=True,blank=True);payload=models.JSONField(default=dict);previous_hash=models.CharField(max_length=64,blank=True);event_hash=models.CharField(max_length=64,unique=True);created_at=models.DateTimeField(auto_now_add=True)
