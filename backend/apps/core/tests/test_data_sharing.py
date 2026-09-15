from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from apps.core.models import Organization
from apps.core.privacy import redact_for_external_call
from apps.core.providers import ProviderUnavailable, embeddings


class RedactionTests(TestCase):
    def test_redacts_email_ssn_and_secret_token(self):
        text = "Contact jane@example.com, SSN 123-45-6789, api_key: sk-abcdefghijklmnop1234567890"
        redacted, counts = redact_for_external_call(text)
        self.assertNotIn("jane@example.com", redacted)
        self.assertNotIn("123-45-6789", redacted)
        self.assertNotIn("sk-abcdefghijklmnop1234567890", redacted)
        self.assertEqual(counts.get("EMAIL"), 1)
        self.assertEqual(counts.get("SSN"), 1)
        self.assertEqual(counts.get("SECRET_TOKEN"), 1)

    def test_leaves_clean_text_untouched(self):
        text = "This decision has no sensitive fields in it."
        redacted, counts = redact_for_external_call(text)
        self.assertEqual(redacted, text)
        self.assertEqual(counts, {})


@override_settings(AI_EMBEDDING_ENABLED=True, AI_API_KEY="test-key")
class OrgDataSharingToggleTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("owner", password="test-password")

    def test_disabled_org_blocks_call_before_any_network_request_is_attempted(self):
        org = Organization.objects.create(
            name="Locked Down Co", created_by=self.user, external_data_sharing_enabled=False
        )
        with patch("apps.core.providers.urlrequest.urlopen") as mock_urlopen:
            with self.assertRaises(ProviderUnavailable):
                embeddings(["some evidence text"], organization=org)
            mock_urlopen.assert_not_called()

    def test_enabled_org_is_not_blocked_by_the_toggle(self):
        org = Organization.objects.create(
            name="Opted In Co", created_by=self.user, external_data_sharing_enabled=True
        )
        # Still expected to fail here because urlopen isn't mocked to return a
        # real response -- this only proves the toggle itself does not block
        # an org that has opted in; it is not a live-network test.
        with patch("apps.core.providers.urlrequest.urlopen", side_effect=OSError("no network in test")):
            with self.assertRaises(ProviderUnavailable) as ctx:
                embeddings(["some evidence text"], organization=org)
            self.assertNotIn("External data sharing is disabled", str(ctx.exception))
