from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.core.models import Membership, Organization
from apps.core.permissions import require_role

class TenantPermissionTests(TestCase):
    def test_member_role_is_scoped_to_organization(self):
        user = get_user_model().objects.create_user('viewer', password='test-password')
        owner = get_user_model().objects.create_user('owner', password='test-password')
        allowed = Organization.objects.create(name='Allowed', created_by=owner)
        denied = Organization.objects.create(name='Denied', created_by=owner)
        Membership.objects.create(organization=allowed, user=user, role='viewer')
        self.assertTrue(require_role(user, allowed, 'viewer'))
        with self.assertRaises(PermissionError):
            require_role(user, denied, 'viewer')
