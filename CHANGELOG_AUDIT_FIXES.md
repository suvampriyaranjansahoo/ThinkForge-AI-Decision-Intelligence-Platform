# Audit fixes applied — v15.0.1

Every item below was implemented directly in this codebase (not just documented), verified with
`node --check` on every touched file, and confirmed against the existing + new tests: **226 passing,
0 failing, 5 skipped** (the 5 skips are the live-Supabase integration tests, which now correctly fail
CI instead of silently skipping once real staging credentials are added as repo secrets — see below).

## Fixed

1. **CI blind spot on tenant isolation (was Critical/C1).**
   `.github/workflows/ci.yml` now passes `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (sourced from new
   `CI_STAGING_SUPABASE_URL` / `CI_STAGING_SUPABASE_SERVICE_ROLE_KEY` repo secrets you still need to
   configure against a **disposable staging** Supabase project) into the test step, and adds a
   dedicated step that runs `tests/live_stage1_stage2.integration.test.js` directly and **fails the
   build** if it skips or reports a failure — closing the "silently skips forever" gap for good,
   not just when someone remembers to set the vars.

2. **Uncapped LLM spend in `api/evaluate.js` live mode (was High/H1).**
   Live mode now requires `organizationId` in the request body and admin-level membership in that
   org (`requireOrganizationRole(user.id, organizationId, 'admin')`), and runs under its own
   `evaluate-live` rate-limit scope (3/min) separate from the general `evaluate` scope. Updated
   `tests/stage11_ai_evaluation_integrity.test.js`'s two live-mode tests to stub the new
   authorization check and pass `organizationId` — both still pass and still test what they
   originally tested (loud failure on a broken model layer; accurate per-module telemetry).

3. **Uncapped third-party spend in `api/discovery.js` deep_research (was High/H2).**
   `deep_research` now requires `organizationId` + editor-level membership, and runs under its own
   `discovery-deep-research` scope (5/min) on top of the shared `discovery` scope — so it can no
   longer be repeated at the same rate as cheap actions like `analyze`/`save`.

4. **CSP `unsafe-inline` on script-src (was High/H3).**
   Removed `'unsafe-inline'` from `script-src` in `lib/security.js` — verified first that the app
   has zero inline `<script>` tags and zero `on*=""` attribute handlers (grepped both
   `frontend/src/app.js` and `index.html`), so this closes a real gap at zero functional cost.
   `style-src 'unsafe-inline'` is intentionally left in place — it's needed for existing inline
   `style=""` attributes in generated markup, and removing it is a separate, larger refactor
   (tracked, not done here) since it's lower severity than script injection.

5. **Audit hash chain silently passed records with a missing hash (was High/D2).**
   `lib/auditVerify.js`'s `verifyChain()` previously only checked `event_hash` for tampering when
   the field was present — a record with it stripped out passed with zero failures. Now a missing
   `event_hash` is itself a `missing_event_hash` failure. Added a regression test in
   `tests/audit.test.js` for exactly this case.

6. **PII/secret heuristic in `lib/privacyLifecycle.js` was too narrow (was High/D1).**
   `classify()` now also catches SSN-style and payment-card-style digit sequences with common
   separators and phone-number-shaped sequences, plus a broader secret-token pattern (bearer
   tokens, `sk-` style API keys). The function's return now includes `heuristic:true` and
   `confidence:'low'`, and a code comment explicitly says this must never be treated as proof a
   privacy/compliance requirement was satisfied — route anything flagged to human review.

7. **No timeout on embeddings calls in `api/rag.js` (was Medium/M4).**
   `embed()` now uses the same `AbortController`-based timeout pattern already used in
   `lib/ai.js`'s `rawCall()` (default 15s, configurable via `AI_EMBEDDING_TIMEOUT_MS`), so a hung
   OpenAI embeddings call fails fast instead of tying up the function until the platform timeout.

## Deliberately not changed (need a product/eng decision, not a unilateral code change)

- **M2 — RAG per-user vs per-org scoping.** Still per-user. Changing this means a schema
  migration (new RLS policies + membership checks on `thinkforge_chunks`/`thinkforge_documents`)
  and should be a deliberate product call, not something silently flipped in an audit-fix pass.
- **D5 — `decisionHealth()`'s `READY` state can coexist with unresolved assumptions.** Left as-is;
  changing the business rule without product sign-off risks silently changing what "ready for
  governance" means for existing decisions.
- **D6 — audit hash-chain concurrency guarantees.** Fixing D2 (missing-hash detection) doesn't
  address whether concurrent writes can fork the chain — that requires checking the actual
  Postgres insert path/constraints, not just the JS helper, and is out of scope for a code-only
  pass on the zip contents.
- **M3 — per-request Supabase Auth round-trip.** Left as-is; switching to local JWT/JWKS
  verification is a larger, riskier change (token revocation semantics change) that deserves its
  own reviewed PR rather than being bundled into an audit-fix pass.
- **M1 — `hasInjectionSignals()` staying a weak heuristic.** Not strengthened here; flagged in the
  audit as something to either invest in properly or explicitly relabel as telemetry-only.

## What you still need to do

- Add `CI_STAGING_SUPABASE_URL` and `CI_STAGING_SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions repo
  secrets, pointed at a **disposable staging** Supabase project (never production), or the new CI
  step will correctly and intentionally fail every build until you do.
- Decide on M2 (RAG scoping) and D5 (readiness semantics) — both are documented above with enough
  context to make the call, but neither should be flipped without your product input.

## Follow-up pass — audit chain was fixed but never actually fed (2026-09-12)

**Found by actually running the test suite, not by re-reading the code.** The prior pass
(see `CHANGELOG_AGENT_HARDENING.md`) fixed how `agent.audit()` computes and links hashes, and
added `tests/test_audit_integrity.py` to prove it — but those tests were written, not executed
(no Django/network in that sandbox). Running them for real here (`python manage.py test`, sqlite
in-memory, no external DB needed) surfaced that **3 of 4 new tests failed**, all for the same
root cause:

- `agent.create_run()` — the function that runs on every single agent invocation — never calls
  `audit()`. It only calls `event()`, which writes to `AgentStep` (an operational log), not
  `AuditEvent` (the tamper-evident, hash-chained governance log). Only `assign_review()` and
  `resolve_review()` called `audit()`. Net effect: for a normal run that never reaches human
  review, the "tamper-evident audit chain" contains zero events. The hash-chaining logic fixed
  in the prior pass was correct — it just had nothing to chain.
- Fixed with one line in `create_run()`: an `audit(event_type='RUN_CREATED', ...)` call right
  after the run is created, so every run produces at least one linked, hash-chained audit event.
- Verified, not assumed: re-ran `test_audit_integrity.py` after the fix — all 4 pass. Then ran
  the full backend suite (`apps.core.tests`, 18 tests) — all pass, nothing else broke. Then ran
  the Node suite (`npm test`) — 236 pass, 0 fail, 5 correctly skipped (live-DB integration tests,
  no DB available in this sandbox).

**Still open:** `POLICY_EVALUATED`, tool-call, and terminal-state transitions inside `create_run`
still go through `event()` only, not `audit()`. Whether the full run lifecycle needs to be in the
tamper-evident chain (compliance-grade) or just the review boundary (current behavior, now at
least non-empty) is a product call, not something to silently expand in a bug-fix pass.
