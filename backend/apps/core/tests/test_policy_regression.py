import json
from pathlib import Path
from django.test import SimpleTestCase
from apps.core.agent import policy

class PolicyFixtureRegressionTests(SimpleTestCase):
    def test_shared_policy_fixture(self):
        fixture = Path(__file__).resolve().parents[4] / 'eval' / 'agent_policy_v1.json'
        for case in json.loads(fixture.read_text())['cases']:
            allowed, code = policy(case['tool'], case['role'], case['approved'], case.get('calls', 0), case.get('spentUsd', 0), case.get('state', 'RUNNING'), case.get('initialRole'), case.get('roleChanged', False))
            self.assertEqual(allowed, case.get('expectedAllowed', False), case['id'])
            self.assertEqual(code, case.get('expectedCode'), case['id'])
