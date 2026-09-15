# Agent hardening changelog

This file records implementation work, verification evidence, and unresolved human decisions. It does not convert simulated tests into production evidence.

## Task 1 — real end-to-end agent runs

- **Status:** Blocked.
- **Changed files:** `CHANGELOG_AGENT_HARDENING.md`.
- **Verification command and output:** `AI_API_KEY_configured : False`; `AI_EMBEDDING_ENABLED :`; `PostgreSQL_port_5432_reachable : False` from a local configuration/port check on 2026-09-10.
- **What this proves:** No server-side provider key or local PostgreSQL service was available in this session, so no live model/retrieval HTTP request and no real end-to-end agent trace could be executed or truthfully saved under `eval/real_runs/`.
- **Open human question:** Which approved provider, account/budget, retention policy, and non-sensitive test corpus should be used for five real runs? Do not put the key in source control or the browser.

## Task 2 — adversarial policy fixtures

- **Status:** Done with verified evidence.
- **Changed files:** `eval/agent_policy_v1.json`, `lib/agentPolicy.js`, `backend/apps/core/agent.py`, `backend/apps/core/tests/test_policy_regression.py`, `CHANGELOG_AGENT_HARDENING.md`.
- **What changed:** The shared fixture grew from 6 to 17 cases. New cases cover exact call-budget boundaries, terminal-state tool attempts, role mutation during a run, exact cost boundary, and an injection-shaped goal. Terminal and role-mutation rejection were implemented consistently in both policy modules. The injection-shaped case proves only that natural-language text does not dynamically register or invoke a forbidden tool; it is not a prompt-injection evaluation of an LLM.
- **Verification commands and output:** `node scripts/eval_agent_policy.js` returned `datasetVersion: agent-policy-v2`, `cases: 17`, `passed: 17`. `py -3.12 manage.py test apps.core.tests.test_policy_regression` returned `Ran 1 test ... OK` and `System check identified no issues`.
- **Open human question:** Concurrent budget races require a real shared database/transaction test; the shared fixture itself is deterministic and single-process.

## Task 3 — organization rolling-hour circuit breaker

- **Status:** Done with verified evidence.
- **Changed files:** `backend/apps/core/models.py`, `backend/apps/core/migrations/0002_agent_circuit_breaker.py`, `backend/apps/core/agent.py`, `backend/apps/core/views.py`, `backend/apps/core/tests/test_agent.py`, `CHANGELOG_AGENT_HARDENING.md`.
- **What changed:** Organizations have configurable hourly external-call and spend limits. An approved external-research run takes a transactional usage reservation while locking its organization row. Limits are enforced before the tool call and reject with `AGENT_ORG_CALL_RATE_LIMIT_EXCEEDED` or `AGENT_ORG_SPEND_LIMIT_EXCEEDED`.
- **Verification commands and output:** `py -3.12 manage.py test apps.core.tests.test_agent` returned `Ran 3 tests ... OK`; the new test creates one approved run against a one-call hourly limit and asserts the second raises `AGENT_ORG_CALL_RATE_LIMIT_EXCEEDED`. `py -3.12 manage.py check` returned `System check identified no issues`.
- **Open human question:** Defaults (10 external calls/hour and 5 USD/hour) are implementation defaults, not a recommended production budget. Set approved limits per organization before enabling a real provider.

## Task 4 — human-review workflow

- **Status:** Done with verified evidence.
- **Changed files:** `backend/apps/core/models.py`, `backend/apps/core/migrations/0003_agent_review_workflow.py`, `backend/apps/core/agent.py`, `backend/apps/core/urls.py`, `backend/apps/core/views.py`, `backend/apps/core/serializers.py`, `backend/apps/core/tests/test_agent.py`, `CHANGELOG_AGENT_HARDENING.md`.
- **What changed:** A reviewable run has an assigned reviewer, assignment/due/resolution timestamps, a review outcome, restricted assign/resolve endpoints, and distinct `REVIEW_ASSIGNED`, `REVIEW_APPROVED`, and `REVIEW_REJECTED` audit event types. Resolution transitions a run to `COMPLETED` or `CANCELLED`; it does not automatically approve a product decision.
- **Verification commands and output:** `py -3.12 manage.py test apps.core.tests.test_agent` returned `Ran 4 tests ... OK`. The new test assigned a reviewer with a 12-hour SLA, rejected the run, then asserted `CANCELLED`, review fields, `REVIEW_ASSIGNED`, and `REVIEW_REJECTED`. `py -3.12 manage.py check` returned `System check identified no issues`.
- **Open human question:** Notification delivery and escalation of overdue reviews need a chosen channel (email, Slack, or in-app) and are intentionally not implemented without that product decision.

## Task 5 — cross-stack state-machine parity

- **Status:** Resolved.
- **Changed files:** `lib/agentState.js`, `eval/agent_state_machine_v1.json`, `CHANGELOG_AGENT_HARDENING.md`.
- **Decision (made by product owner, not by this pass):** Django's simpler lifecycle is canonical. `RETRYING` was never wired into any orchestration logic on the Node side (confirmed by grep across `lib/`, `api/`, `tests/`, `scripts/`, `eval/` before removal — only declared as a reachable state), so removing it was a pure deletion with no dependent behavior to migrate.
- **What changed:** Removed `RETRYING` from Node's `TRANSITIONS` table in `lib/agentState.js`. Updated `eval/agent_state_machine_v1.json` so the four `RETRYING` cases now expect `false` on both stacks, kept as explicit regression guards (if either stack's transition table is later changed to re-add a retry state, these cases will fail and force a conscious decision, not silent drift).
- **Verification commands and output:** `node scripts/eval_agent_state_machine.js` → `nodeMismatches: []`, `declaredNodeDjangoDivergences: []`. `npm test` → 241 tests, 236 pass, 0 fail, 5 skipped (unchanged from before this edit).

## Task 6 — data handling / redaction policy

- **Status:** Done with partial verification. Django-side code is written, reviewed, and its non-Django-dependent parts were actually executed; full `manage.py test` could not be run in this session (no network/Django available in this sandbox — same limitation noted in Task 1/3/4 verification).
- **Changed files:** `backend/apps/core/privacy.py` (new), `backend/apps/core/providers.py`, `backend/apps/core/retrieval.py`, `backend/apps/core/tasks.py`, `backend/apps/core/models.py`, `backend/apps/core/migrations/0004_external_data_sharing_toggle.py`, `backend/apps/core/tests/test_data_sharing.py` (new).
- **What changed:** Added `Organization.external_data_sharing_enabled` (default `True`, preserves existing behavior for orgs that don't set it). `providers.embeddings()` now accepts an `organization` kwarg and raises `ProviderUnavailable` before any network call if that org has disabled sharing. Both real call sites (`retrieval.search()`, `tasks.index_document()`) were updated to actually pass `organization` through — the toggle does nothing if callers don't pass it, and the first version of this change missed that; caught it by grepping for all `embeddings(` call sites before calling this done. Added `redact_for_external_call()`, applied to every text item before it's sent to the embeddings API, labeled explicitly as a coarse heuristic, not a compliance control (same honesty framing as the existing `lib/privacyLifecycle.js` fix).
- **A real bug caught during this work, not after:** the first redaction regex used one combined pattern for "SSN or card number" requiring 12+ digits, which meant it silently missed all 9-digit SSNs — verified by actually running the function (`python3` directly against `privacy.py`, which has no Django dependency) against a set of test strings before writing this up. Fixed by splitting into separate SSN (9-digit) and CARD (13-16 digit) patterns and re-ran the same cases to confirm the fix.
- **What is NOT covered:** `deep_web_research` in `apps/core/agent.py` has no real outbound HTTP call yet (`status='simulated_offline'`) — there is nothing live to gate there today. When Task 1 (real runs) is unblocked and a real call is added, it must use the same `organization.external_data_sharing_enabled` check and `redact_for_external_call()` before that call is considered complete.
- **Open human question:** none blocking — the toggle defaults to preserving current behavior. Decide per-org defaults for new signups (opt-in vs opt-out of external sharing) as a product/legal call before general availability.


## Follow-up pass — targeted fixes, Django-only direction (2026-09-11)

Scope for this pass, per explicit product direction: targeted fixes only (not a rebuild), Django as the sole long-term backend.

**D6 (audit hash-chain concurrency) — actually fixed, not just documented.**
`AuditEvent.previous_hash` existed as a schema field but `agent.audit()` never populated it or used it in the digest -- every event's hash was independent, so the "tamper-evident chain" didn't chain anything. Fixed:
- `agent.audit()` now locks the organization row (`select_for_update`), reads the latest event for that org, and includes its hash in a fresh digest computed from stored fields only (previous_hash, run id, actor id, event_type, canonical JSON payload) -- no wall-clock timestamp, so the digest is fully reproducible later, not just linkage-checkable.
- Added `backend/apps/core/audit_integrity.py::verify_chain()`, the Django equivalent of `lib/auditVerify.js`, built with the missing-hash lesson already applied (a stripped hash fails, it doesn't silently pass).
- **Verified before shipping, not after:** ran the exact hashing/verification scheme standalone in plain Python (no Django needed -- pure hashlib/json) against five scenarios: clean chain, deleted middle event, in-place payload mutation, stripped hash, and a forked chain. All five behaved correctly (`node`/`python3` output captured in this session). Django-side tests (`tests/test_audit_integrity.py`) mirror the same scenarios but were written, not executed (no Django/network in this sandbox).
- Also removed the dead `'RETRYING'` choice left in `AgentRun.STATES` from before the state-machine alignment fix -- Django's `TRANSITIONS` already excluded it, but the choices list still listed it, which is exactly the kind of drift this whole hardening pass exists to catch. Migration `0005_remove_retrying_state_choice.py`.

**M3 (per-request auth round-trip) — checked, not applicable to Django.**
Django uses `rest_framework_simplejwt.authentication.JWTAuthentication` (local signature verification), not a live per-request call to an external auth service. This was a Node/Supabase-specific issue; no Django-side action needed.

**M1 (weak injection heuristic) — no change; already honestly labeled.**
The Django policy test's injection-shaped case already states in its own commit message that it "proves only that natural-language text does not dynamically register or invoke a forbidden tool; it is not a prompt-injection evaluation of an LLM." Re-labeling was the fix; it's already done.

**D5 (decisionHealth READY-state ambiguity) — out of scope, Node-only concept, moot under Django-only direction.**
No Django equivalent exists yet; not fabricated here.

**Node/Vercel retirement — NOT executed, and here's exactly why.**
`DJANGO_MIGRATION.md`'s own cutover sequence requires a rollback rehearsal and passing contract tests against real staging data before retiring Node endpoints -- steps this sandbox cannot perform (no network, no live Supabase, no staging deploy). More importantly: grepped `backend/apps/core/` for discovery/jira/evaluate/study/annotations/quality and confirmed **zero** Django equivalents exist for `api/discovery.js`, `api/jira.js`, `api/evaluate.js`, `api/study.js`, `api/annotations.js`, `api/quality.js`. Deleting Node now would delete live product capability, not duplicate code. Recorded the product decision (Django is the committed target) in `DJANGO_MIGRATION.md` without executing a retirement that would silently regress the product. This is deliberately not "done" -- see that file for the two real options going forward.
