from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.core.models import Chunk, Document, Organization
from apps.core.retrieval import search

class RetrievalTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user('researcher', password='test-password')
        self.organization = Organization.objects.create(name='Research org', created_by=user)
        document = Document.objects.create(organization=self.organization, uploaded_by=user, name='Onboarding interviews', checksum='a' * 64)
        Chunk.objects.create(document=document, organization=self.organization, chunk_index=0, content='New SMB users abandon onboarding before they reach activation.')
    def test_lexical_retrieval_returns_a_citation(self):
        hits, metadata = search(organization=self.organization, query='SMB onboarding')
        self.assertEqual(metadata['mode'], 'lexical_fallback')
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]['citation']['document'], 'Onboarding interviews')
    def test_retrieval_cannot_cross_organization_boundary(self):
        other_user = get_user_model().objects.create_user('other', password='test-password')
        other = Organization.objects.create(name='Other org', created_by=other_user)
        hits, _ = search(organization=other, query='SMB onboarding')
        self.assertEqual(hits, [])
