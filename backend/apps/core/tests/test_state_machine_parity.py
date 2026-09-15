import json
from pathlib import Path
from django.test import SimpleTestCase
from apps.core.agent import TRANSITIONS

class StateMachineFixtureTests(SimpleTestCase):
    def test_current_django_transition_table_matches_audited_fixture(self):
        fixture = Path(__file__).resolve().parents[4] / 'eval' / 'agent_state_machine_v1.json'
        for case in json.loads(fixture.read_text())['cases']:
            actual = case['to'] in TRANSITIONS.get(case['from'], set())
            self.assertEqual(actual, case['expectedDjango'], case['id'])
