import hashlib
import json
from django.db import transaction
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .agent import AgentCircuitOpen, assign_review, create_run, resolve_review
from .models import (AgentFeedback, AgentRun, Chunk, Decision, Document, Evidence,
                     Experiment, Membership, Organization, Workspace)
from .permissions import member_for, require_role
from .serializers import (AgentFeedbackSerializer, AgentRunSerializer, DecisionSerializer,
                          EvidenceSerializer, ExperimentSerializer, OrganizationSerializer)
from .tasks import index_document
from .retrieval import search as retrieve

def org(request, value):
    try: return Organization.objects.get(pk=value)
    except (Organization.DoesNotExist, ValueError, TypeError): return None

def membership_or_403(request, organization, minimum='viewer'):
    membership = member_for(request.user, organization)
    if not membership or not require_role(request.user, organization, minimum): return None
    return membership

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def health(request):
    return Response({'status': 'ok', 'service': 'thinkforge-django', 'version': '1.0'})

class OrganizationList(generics.ListCreateAPIView):
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return Organization.objects.filter(memberships__user=self.request.user).distinct()
    def perform_create(self, serializer):
        organization = serializer.save(created_by=self.request.user)
        Membership.objects.create(organization=organization, user=self.request.user, role='owner')
        Workspace.objects.create(organization=organization)

class MembershipList(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, organization_id):
        organization = org(request, organization_id)
        if not organization or not membership_or_403(request, organization, 'admin'):
            return Response({'error': 'ORGANIZATION_ADMIN_REQUIRED'}, status=403)
        rows = Membership.objects.filter(organization=organization).select_related('user')
        return Response([{'id': m.id, 'userId': m.user_id, 'email': m.user.email, 'role': m.role} for m in rows])

class DecisionList(generics.ListCreateAPIView):
    serializer_class = DecisionSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        organization_id = self.request.query_params.get('organizationId')
        organization = org(self.request, organization_id)
        if not organization or not membership_or_403(self.request, organization): return Decision.objects.none()
        return Decision.objects.filter(organization=organization).order_by('-updated_at')
    def create(self, request, *args, **kwargs):
        organization = org(request, request.data.get('organizationId'))
        if not organization or not membership_or_403(request, organization, 'editor'):
            return Response({'error': 'ORGANIZATION_EDITOR_REQUIRED'}, status=403)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization, created_by=request.user)
        return Response(serializer.data, status=201)

class DecisionDetail(generics.RetrieveUpdateAPIView):
    serializer_class = DecisionSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return Decision.objects.filter(organization__memberships__user=self.request.user).distinct()
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not membership_or_403(request, instance.organization, 'editor'):
            return Response({'error': 'ORGANIZATION_EDITOR_REQUIRED'}, status=403)
        expected = request.headers.get('If-Match')
        if expected and expected != str(instance.version):
            return Response({'error': 'VERSION_CONFLICT', 'currentVersion': instance.version}, status=409)
        response = super().update(request, *args, **kwargs)
        instance.refresh_from_db(); instance.version += 1; instance.save(update_fields=['version', 'updated_at'])
        response.data['version'] = instance.version
        return response

class EvidenceList(generics.ListCreateAPIView):
    serializer_class = EvidenceSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self): return Evidence.objects.filter(decision_id=self.kwargs['decision_id'], organization__memberships__user=self.request.user).distinct()
    def create(self, request, *args, **kwargs):
        decision = Decision.objects.filter(pk=kwargs['decision_id']).first()
        if not decision or not membership_or_403(request, decision.organization, 'editor'):
            return Response({'error': 'ORGANIZATION_EDITOR_REQUIRED'}, status=403)
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True)
        serializer.save(organization=decision.organization, decision=decision)
        return Response(serializer.data, status=201)

class ExperimentList(generics.ListCreateAPIView):
    serializer_class = ExperimentSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self): return Experiment.objects.filter(decision_id=self.kwargs['decision_id'], organization__memberships__user=self.request.user).distinct()
    def create(self, request, *args, **kwargs):
        decision = Decision.objects.filter(pk=kwargs['decision_id']).first()
        if not decision or not membership_or_403(request, decision.organization, 'editor'):
            return Response({'error': 'ORGANIZATION_EDITOR_REQUIRED'}, status=403)
        serializer = self.get_serializer(data=request.data); serializer.is_valid(raise_exception=True)
        serializer.save(organization=decision.organization, decision=decision)
        return Response(serializer.data, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rag(request):
    payload, action = request.data.get('payload', request.data), request.data.get('action')
    organization = org(request, payload.get('organizationId'))
    if not organization or not membership_or_403(request, organization, 'viewer'):
        return Response({'error': 'ORGANIZATION_ACCESS_REQUIRED'}, status=403)
    if action == 'upsert':
        if not membership_or_403(request, organization, 'editor'): return Response({'error': 'ORGANIZATION_EDITOR_REQUIRED'}, status=403)
        text = payload.get('text') or '\n'.join(payload.get('chunks', []))
        doc = Document.objects.create(organization=organization, uploaded_by=request.user, name=payload.get('name', 'Untitled'), mime_type=payload.get('mimeType', ''), checksum=hashlib.sha256(text.encode()).hexdigest(), metadata={'source': 'api'})
        index_document.delay(str(doc.id), text)
        return Response({'documentId': str(doc.id), 'status': 'queued'}, status=202)
    query = payload.get('query', '').strip()
    if not query: return Response({'hits': []})
    hits, retrieval = retrieve(organization=organization, query=query)
    return Response({'hits': hits, 'retrieval': retrieval})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent(request):
    organization = org(request, request.data.get('organizationId'))
    if not organization: return Response({'error': 'ORGANIZATION_NOT_FOUND'}, status=404)
    membership = membership_or_403(request, organization, 'editor')
    if not membership: return Response({'error': 'ORGANIZATION_EDITOR_REQUIRED'}, status=403)
    body, action = request.data.get('input', {}), request.data.get('action', 'plan')
    goal = body.get('goal') or body.get('researchQuestion')
    if not goal: return Response({'error': 'AGENT_GOAL_REQUIRED'}, status=400)
    try:
        run = create_run(organization=organization, user=request.user, goal=goal, request_id=request.headers.get('Idempotency-Key', hashlib.sha256(goal.encode()).hexdigest()), approved=(action == 'run' and request.data.get('approved') is True), role=membership.role)
    except AgentCircuitOpen as exc:
        return Response({'error': str(exc), 'code': exc.code}, status=429)
    return Response({'result': AgentRunSerializer(run).data}, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent_feedback(request, run_id):
    run = AgentRun.objects.filter(pk=run_id).first()
    if not run or not membership_or_403(request, run.organization, 'reviewer'): return Response({'error': 'AGENT_REVIEWER_REQUIRED'}, status=403)
    serializer = AgentFeedbackSerializer(data=request.data); serializer.is_valid(raise_exception=True); serializer.save(run=run, user=request.user)
    return Response(serializer.data, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent_review_assign(request, run_id):
    run = AgentRun.objects.filter(pk=run_id).first()
    if not run or not membership_or_403(request, run.organization, 'admin'): return Response({'error': 'AGENT_ADMIN_REQUIRED'}, status=403)
    reviewer_id = request.data.get('reviewerId')
    reviewer_membership = Membership.objects.filter(organization=run.organization, user_id=reviewer_id).select_related('user').first()
    if not reviewer_membership or reviewer_membership.role not in {'reviewer','editor','admin','owner'}: return Response({'error': 'VALID_ORGANIZATION_REVIEWER_REQUIRED'}, status=400)
    try: assign_review(run=run, reviewer=reviewer_membership.user, assigned_by=request.user, sla_hours=int(request.data.get('slaHours', 24)))
    except ValueError as exc: return Response({'error': str(exc)}, status=409)
    return Response(AgentRunSerializer(run).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent_review_resolve(request, run_id):
    run = AgentRun.objects.filter(pk=run_id).first()
    if not run or not membership_or_403(request, run.organization, 'reviewer'): return Response({'error': 'AGENT_REVIEWER_REQUIRED'}, status=403)
    try: resolve_review(run=run, reviewer=request.user, outcome=request.data.get('outcome'), note=request.data.get('note',''))
    except ValueError as exc: return Response({'error': str(exc)}, status=409)
    return Response(AgentRunSerializer(run).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def workspace(request):
    organization = org(request, request.data.get('organizationId'))
    if not organization or not membership_or_403(request, organization, 'editor'): return Response({'error': 'ORGANIZATION_EDITOR_REQUIRED'}, status=403)
    with transaction.atomic():
        row, _ = Workspace.objects.select_for_update().get_or_create(organization=organization)
        expected = request.data.get('expectedVersion')
        if expected is not None and int(expected) != row.version: return Response({'error': 'VERSION_CONFLICT', 'version': row.version}, status=409)
        row.state = request.data.get('state', row.state); row.version += 1; row.save()
    return Response({'version': row.version, 'state': row.state})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai(request):
    # Deliberately does not fabricate model output. The browser's labelled offline demo is the free fallback.
    return Response({'error': 'AI_PROVIDER_NOT_CONFIGURED', 'message': 'Configure a server-side provider adapter or use Offline Demo Mode.'}, status=503)
