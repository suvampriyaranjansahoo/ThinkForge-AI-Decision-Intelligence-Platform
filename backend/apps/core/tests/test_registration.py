from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.core.models import Membership, Organization, Workspace


class RegistrationTests(APITestCase):
    def test_registration_creates_an_owner_and_workspace(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'new-user@example.com',
            'password': 'safe-password-123',
            'organizationName': 'New workspace',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(email='new-user@example.com')
        organization = Organization.objects.get(id=response.data['organizationId'])
        self.assertTrue(Membership.objects.filter(user=user, organization=organization, role='owner').exists())
        self.assertTrue(Workspace.objects.filter(organization=organization).exists())

    def test_registration_rejects_a_short_password(self):
        response = self.client.post('/api/auth/register/', {'email': 'new@example.com', 'password': 'short'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(get_user_model().objects.filter(email='new@example.com').exists())
