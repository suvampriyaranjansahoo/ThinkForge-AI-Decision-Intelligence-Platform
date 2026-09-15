from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.core.agent import AgentCircuitOpen, assign_review, create_run, resolve_review
from apps.core.models import AuditEvent, Membership, Organization

class AgentSafetyTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('analyst', password='test-password')
        self.organization = Organization.objects.create(name='Acme', created_by=self.user)
        Membership.objects.create(organization=self.organization, user=self.user, role='editor')
    def test_plan_requires_approval_before_paid_research(self):
        run = create_run(organization=self.organization, user=self.user, goal='Test demand', request_id='one', approved=False)
        self.assertEqual(run.state, 'AWAITING_APPROVAL')
        self.assertFalse(run.tool_calls.exists())
    def test_approved_run_still_requires_human_review(self):
        run = create_run(organization=self.organization, user=self.user, goal='Test demand', request_id='two', approved=True)
        self.assertEqual(run.state, 'NEEDS_HUMAN_REVIEW')
        self.assertEqual(run.tool_calls.count(), 1)
    def test_org_hourly_circuit_breaker_blocks_second_external_run(self):
        self.organization.agent_external_calls_per_hour_limit = 1
        self.organization.save(update_fields=['agent_external_calls_per_hour_limit'])
        create_run(organization=self.organization, user=self.user, goal='First run', request_id='three', approved=True)
        with self.assertRaisesRegex(AgentCircuitOpen, 'AGENT_ORG_CALL_RATE_LIMIT_EXCEEDED'):
            create_run(organization=self.organization, user=self.user, goal='Second run', request_id='four', approved=True)
    def test_review_assignment_and_rejection_create_distinct_audit_event(self):
        reviewer = get_user_model().objects.create_user('reviewer', password='test-password')
        Membership.objects.create(organization=self.organization, user=reviewer, role='reviewer')
        run = create_run(organization=self.organization, user=self.user, goal='Review this', request_id='five', approved=True)
        assign_review(run=run, reviewer=reviewer, assigned_by=self.user, sla_hours=12)
        self.assertEqual(run.reviewer, reviewer); self.assertIsNotNone(run.review_assigned_at); self.assertIsNotNone(run.review_due_at)
        resolve_review(run=run, reviewer=reviewer, outcome='rejected', note='Need stronger evidence')
        self.assertEqual(run.state, 'CANCELLED'); self.assertEqual(run.review_outcome, 'rejected')
        self.assertTrue(AuditEvent.objects.filter(event_type='REVIEW_ASSIGNED', entity_id=run.id).exists())
        self.assertTrue(AuditEvent.objects.filter(event_type='REVIEW_REJECTED', entity_id=run.id).exists())
