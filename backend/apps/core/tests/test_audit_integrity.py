from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.core.agent import audit, create_run
from apps.core.audit_integrity import verify_chain
from apps.core.models import AuditEvent, Membership, Organization


class AuditChainIntegrityTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('analyst', password='test-password')
        self.organization = Organization.objects.create(name='Acme', created_by=self.user)
        Membership.objects.create(organization=self.organization, user=self.user, role='editor')

    def test_clean_chain_verifies(self):
        run = create_run(organization=self.organization, user=self.user, goal='g', request_id='r1', approved=True)
        result = verify_chain(self.organization)
        self.assertTrue(result['ok'], result['failures'])
        self.assertGreater(result['events'], 0)

    def test_events_are_actually_linked_not_independent(self):
        run = create_run(organization=self.organization, user=self.user, goal='g', request_id='r2', approved=True)
        events = list(AuditEvent.objects.filter(organization=self.organization).order_by('created_at', 'id'))
        self.assertGreaterEqual(len(events), 1)
        # Before this fix, previous_hash was never set (always blank) regardless
        # of how many prior events existed for the organization.
        if len(events) > 1:
            self.assertNotEqual(events[1].previous_hash, '')
            self.assertEqual(events[1].previous_hash, events[0].event_hash)

    def test_deleting_a_middle_event_is_detected(self):
        run = create_run(organization=self.organization, user=self.user, goal='g', request_id='r3', approved=True)
        audit(run=run, actor=self.user, event_type='EXTRA_EVENT_ONE', payload={'n': 1})
        audit(run=run, actor=self.user, event_type='EXTRA_EVENT_TWO', payload={'n': 2})
        middle = AuditEvent.objects.filter(organization=self.organization, event_type='EXTRA_EVENT_ONE').get()
        middle.delete()
        result = verify_chain(self.organization)
        self.assertFalse(result['ok'])
        self.assertTrue(any(f['reason'] == 'previous_hash_mismatch' for f in result['failures']))

    def test_stripped_hash_is_detected_not_silently_skipped(self):
        run = create_run(organization=self.organization, user=self.user, goal='g', request_id='r4', approved=True)
        event = AuditEvent.objects.filter(organization=self.organization).order_by('created_at', 'id').first()
        event.event_hash = ''
        event.save(update_fields=['event_hash'])
        result = verify_chain(self.organization)
        self.assertFalse(result['ok'])
        self.assertTrue(any(f['reason'] == 'missing_event_hash' for f in result['failures']))
