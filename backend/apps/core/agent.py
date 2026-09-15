import hashlib,json,time
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from .models import AgentRun,AgentStep,AgentToolCall,AgentUsageReservation,Organization,AuditEvent
from .permissions import RANK
TOOLS={'retrieve_internal_evidence':{'role':'viewer','approval':False,'max_calls':3,'max_cost_usd':0,'risk':'internal_read'},'deep_web_research':{'role':'editor','approval':True,'max_calls':2,'max_cost_usd':.25,'risk':'external_paid_read'},'evidence_synthesis':{'role':'viewer','approval':False,'max_calls':2,'max_cost_usd':0,'risk':'local_compute'}}
FORBIDDEN_TOOLS={'jira_create','jira_update','email_send','slack_send'}
TRANSITIONS={'PLANNED':{'AWAITING_APPROVAL','RUNNING','CANCELLED'},'AWAITING_APPROVAL':{'RUNNING','CANCELLED'},'RUNNING':{'TOOL_CALLING','VALIDATING','FAILED','CANCELLED'},'TOOL_CALLING':{'VALIDATING','FAILED'},'VALIDATING':{'NEEDS_HUMAN_REVIEW','COMPLETED','FAILED'},'NEEDS_HUMAN_REVIEW':{'COMPLETED','CANCELLED'},'COMPLETED':set(),'FAILED':set(),'CANCELLED':set()}
class AgentCircuitOpen(RuntimeError):
    def __init__(self, code): super().__init__(code); self.code=code
def reserve_org_budget(*,organization,run,tool_name,projected_cost_usd):
    """Atomic, rolling-one-hour circuit breaker for external agent tools."""
    with transaction.atomic():
        locked=Organization.objects.select_for_update().get(pk=organization.pk)
        since=timezone.now()-timedelta(hours=1)
        usage=AgentUsageReservation.objects.filter(organization=locked,created_at__gte=since).aggregate(calls=Sum('id'),spend=Sum('projected_cost_usd'))
        calls=AgentUsageReservation.objects.filter(organization=locked,created_at__gte=since).count()
        spend=usage['spend'] or Decimal('0')
        cost=Decimal(str(projected_cost_usd))
        if calls>=locked.agent_external_calls_per_hour_limit: raise AgentCircuitOpen('AGENT_ORG_CALL_RATE_LIMIT_EXCEEDED')
        if spend+cost>locked.agent_external_spend_per_hour_limit: raise AgentCircuitOpen('AGENT_ORG_SPEND_LIMIT_EXCEEDED')
        return AgentUsageReservation.objects.create(organization=locked,run=run,tool_name=tool_name,projected_cost_usd=cost)
def policy(tool,role,approved,calls=0,spent_usd=0,state='RUNNING',initial_role=None,role_changed=False):
    if tool in FORBIDDEN_TOOLS:return False,'AGENT_TOOL_FORBIDDEN'
    spec=TOOLS.get(tool)
    if not spec:return False,'AGENT_TOOL_UNKNOWN'
    if state in {'COMPLETED','FAILED','CANCELLED'}:return False,'AGENT_RUN_TERMINAL'
    if role_changed or (initial_role is not None and initial_role != role):return False,'AGENT_ROLE_MUTATION_DETECTED'
    if RANK.get(role,-1)<RANK.get(spec['role'],99):return False,'AGENT_ROLE_FORBIDDEN'
    if spec['approval'] and not approved:return False,'AGENT_APPROVAL_REQUIRED'
    if calls>=spec['max_calls']:return False,'AGENT_TOOL_CALL_BUDGET_EXCEEDED'
    if spent_usd>=spec['max_cost_usd'] and spec['max_cost_usd']>0:return False,'AGENT_COST_BUDGET_EXCEEDED'
    return True,None
def event(run,event_type,state,detail=None):
    return AgentStep.objects.create(run=run,sequence_no=run.steps.count(),event_type=event_type,state=state,detail=detail or {})
def change(run,to,detail=None):
    if to not in TRANSITIONS.get(run.state,set()):raise ValueError(f'Invalid transition {run.state}->{to}')
    previous=run.state;run.state=to;run.save(update_fields=['state','updated_at']);event(run,'STATE_CHANGED',to,{'from':previous,'to':to,**(detail or {})})
def audit(*,run,actor,event_type,payload=None):
    """Append-only, tamper-evident audit log.

    Each event's hash is a pure function of stored fields only (previous
    event's hash, run id, actor id, event type, and a canonical JSON dump of
    the payload) -- no wall-clock timestamp, so audit_integrity.verify_chain()
    can fully recompute and compare it later, not just check chain linkage.
    The read-then-write of the "latest" event happens inside a row lock on
    the organization so two concurrent audit() calls for the same org cannot
    both read the same previous hash and fork the chain.
    """
    payload = payload or {}
    with transaction.atomic():
        Organization.objects.select_for_update().get(pk=run.organization_id)
        previous = AuditEvent.objects.filter(organization=run.organization).order_by('-created_at', '-id').first()
        previous_hash = previous.event_hash if previous else ''
        digest = hashlib.sha256(
            f'{previous_hash}:{run.id}:{actor.id}:{event_type}:{json.dumps(payload, sort_keys=True)}'.encode()
        ).hexdigest()
        return AuditEvent.objects.create(organization=run.organization,actor=actor,event_type=event_type,entity_type='agent_run',entity_id=run.id,payload=payload,previous_hash=previous_hash,event_hash=digest)
def assign_review(*,run,reviewer,assigned_by,sla_hours=24):
    if run.state!='NEEDS_HUMAN_REVIEW': raise ValueError('AGENT_RUN_NOT_AWAITING_REVIEW')
    now=timezone.now();run.reviewer=reviewer;run.review_assigned_at=now;run.review_due_at=now+timedelta(hours=sla_hours);run.save(update_fields=['reviewer','review_assigned_at','review_due_at','updated_at'])
    audit(run=run,actor=assigned_by,event_type='REVIEW_ASSIGNED',payload={'reviewerId':str(reviewer.id),'dueAt':run.review_due_at.isoformat()})
    return run
def resolve_review(*,run,reviewer,outcome,note=''):
    if run.state!='NEEDS_HUMAN_REVIEW' or run.reviewer_id!=reviewer.id: raise ValueError('AGENT_REVIEW_ASSIGNMENT_REQUIRED')
    if outcome not in {'approved','rejected'}: raise ValueError('AGENT_REVIEW_OUTCOME_INVALID')
    now=timezone.now();run.reviewed_at=now;run.review_outcome=outcome;run.save(update_fields=['reviewed_at','review_outcome','updated_at'])
    audit(run=run,actor=reviewer,event_type='REVIEW_APPROVED' if outcome=='approved' else 'REVIEW_REJECTED',payload={'note':note[:2000]})
    change(run,'COMPLETED' if outcome=='approved' else 'CANCELLED',{'reviewOutcome':outcome})
    return run
def make_plan(goal):
    return {'agentVersion':'django-research-agent-v1','goal':goal,'steps':[{'id':'plan','tool':'retrieve_internal_evidence','risk':'internal_read'},{'id':'collect','tool':'deep_web_research','risk':'external_paid_read','requiresApproval':True},{'id':'synthesize','tool':'evidence_synthesis','risk':'local_compute'},{'id':'review','tool':'human_approval','risk':'human_required'}],'limitations':['Agent output is advisory. Human review is required.','External writes are not registered tools.']}
def create_run(*,organization,user,goal,request_id,approved=False,role='editor'):
    with transaction.atomic():
        run=AgentRun.objects.create(organization=organization,user=user,request_id=request_id,agent_version='django-research-agent-v1',goal=goal,plan=make_plan(goal),metrics={'costUsd':0,'toolCalls':0})
        event(run,'RUN_STARTED','PLANNED');event(run,'PLAN_CREATED','PLANNED',run.plan)
        audit(run=run,actor=user,event_type='RUN_CREATED',payload={'goal':goal,'requestId':request_id,'approved':approved})
        if not approved:change(run,'AWAITING_APPROVAL',{'blockedTool':'deep_web_research'});return run
        change(run,'RUNNING');allowed,code=policy('deep_web_research',role,True)
        event(run,'POLICY_EVALUATED',run.state,{'tool':'deep_web_research','allowed':allowed,'code':code})
        if not allowed:change(run,'FAILED',{'code':code});return run
        reserve_org_budget(organization=organization,run=run,tool_name='deep_web_research',projected_cost_usd=TOOLS['deep_web_research']['max_cost_usd'])
        change(run,'TOOL_CALLING');started=time.monotonic();AgentToolCall.objects.create(run=run,tool_name='deep_web_research',status='simulated_offline',input_hash=hashlib.sha256(goal.encode()).hexdigest(),latency_ms=0,cost_usd=0)
        change(run,'VALIDATING',{'latencyMs':round((time.monotonic()-started)*1000)})
        event(run,'HUMAN_REVIEW_REQUIRED','VALIDATING',{'reason':'No autonomous product decision is permitted.'});change(run,'NEEDS_HUMAN_REVIEW');return run
