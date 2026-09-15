"""Verify an organization's agent-audit hash chain.

Mirrors lib/auditVerify.js on the Node side, including the lesson already
applied there: a record with no event_hash must FAIL verification, not be
silently skipped (see CHANGELOG_AUDIT_FIXES.md item 5). Because agent.audit()
derives event_hash from stored fields only (no wall-clock timestamp), this
function fully recomputes and compares the digest -- it is not limited to
checking previous_hash linkage.
"""
import hashlib
import json

from .models import AuditEvent


def verify_chain(organization):
    events = list(
        AuditEvent.objects.filter(organization=organization).order_by('created_at', 'id')
    )
    failures = []
    previous_hash = ''
    for i, e in enumerate(events):
        if (e.previous_hash or '') != previous_hash:
            failures.append({'index': i, 'id': e.id, 'reason': 'previous_hash_mismatch'})
        expected = hashlib.sha256(
            f'{previous_hash}:{e.entity_id}:{e.actor_id}:{e.event_type}:{json.dumps(e.payload or {}, sort_keys=True)}'.encode()
        ).hexdigest()
        if not e.event_hash:
            failures.append({'index': i, 'id': e.id, 'reason': 'missing_event_hash'})
        elif e.event_hash != expected:
            failures.append({'index': i, 'id': e.id, 'reason': 'event_hash_mismatch'})
        previous_hash = e.event_hash or expected
    return {'ok': len(failures) == 0, 'events': len(events), 'failures': failures}
