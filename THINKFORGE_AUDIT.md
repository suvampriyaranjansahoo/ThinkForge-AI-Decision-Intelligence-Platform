# ThinkForge v15 — Engineering Audit

Scope: `api/`, `lib/`, `supabase/` migrations, `tests/`, `.github/workflows/`, `frontend/src/app.js`.
Method: direct code review of the code you shipped in this zip — no live backend was reachable, so nothing below is guessed at; every finding cites the file/behavior it's based on.

## Verdict up front

This is a more carefully engineered system than its own marketing page (the Streamlit "Overview" tab) suggests. The core architectural decisions — defense-in-depth authorization, durable rate limiting, LLM output validation — are sound. The real risk is **not spread evenly**: it's concentrated in a handful of specific gaps, which is good news, because fixing ~4 things closes most of the exposure.

---

## Critical

### C1. The one test that proves tenant isolation works never runs in CI
`tests/live_stage1_stage2.integration.test.js` contains the test that verifies a user's JWT cannot read another organization's decision data:
```js
const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const run = configured ? test : test.skip;
```
`.github/workflows/ci.yml`'s `npm test` step sets neither variable, so this test **silently skips on every push and PR**. The separate `live-db-verify.yml` workflow does hit a real linked Supabase DB, but only runs `scripts/verify_live_db.js`, which calls a structural-integrity RPC (`thinkforge_verify_stage1_stage2_live`) — not the cross-tenant read test. Net effect: the single test that would catch a tenant-isolation regression appears to never execute automatically, anywhere.

**Fix:** add `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (pointed at a disposable staging project) as CI secrets and run `npm test` with them set, on every PR — not just on `supabase/**` changes. Treat a skip of this specific test as a CI failure, not a silent pass.

---

## High

### H1. `api/evaluate.js` live mode has no role gate and can run unbounded paid LLM calls
`mode==='live'` only requires `requireUser()` — any authenticated user, not an admin/owner. A single request can run up to `body.limit` (capped at 300) real model calls; the route's own rate limit (5 req/min) still allows up to ~1,500 LLM calls/minute per user. It also exposes the full composition of the 300-case gold benchmark (`publicCases()`) to any logged-in user.
**Fix:** require an admin/owner org role for `mode='live'`; give it its own tight per-user/per-day budget, not just a per-minute counter.

### H2. `api/discovery.js` `deep_research` has the same shape of gap
Each call can fan out to up to 24 Tavily search queries, gated only by a shared 60 req/min limit across *all* discovery actions (analyze/reason/save/deep_research together). Any authenticated user can repeat this to run up real third-party spend.
**Fix:** split `deep_research` into its own rate-limit scope with a lower ceiling; consider a daily budget per org, not just per minute.

### H3. CSP allows `'unsafe-inline'` for `script-src` and `style-src`
(`lib/security.js`) This neutralizes CSP as an XSS backstop. The frontend currently escapes dynamic content carefully (see Strengths), so there's no active exploit visible — but CSP is supposed to be the safety net for the mistake nobody's caught yet, and `unsafe-inline` removes that net.
**Fix:** move to nonce- or hash-based CSP for the specific inline scripts/styles actually in use.

---

## Medium

### M1. `hasInjectionSignals()` is a decorative prompt-injection filter
It's a single regex for phrases like "ignore previous instructions." Its own test (`tests/security.test.js`) asserts the regex matches the exact phrase it was written to catch — which proves nothing about resistance to paraphrase, translation, or splitting across fields.
**Fix:** either invest in real adversarial testing for this control, or relabel it internally as a logging/telemetry signal, not a security boundary — so nobody downstream builds false confidence on it.

### M2. RAG evidence is scoped per-user, not per-organization
Everywhere else (decisions, governance, discovery) the app scopes data by `organizationId` + membership. `api/rag.js` scopes chunks/documents by `user_id` alone — one teammate's uploaded evidence isn't searchable by another teammate on the same decision. This is safe (more restrictive, not less) but looks like an unintentional gap relative to the product's stated "team decision intelligence" positioning.
**Fix:** confirm intent with product; if evidence should be shared within an org, migrate `thinkforge_chunks`/`thinkforge_documents` to org-scoped RLS + the same `thinkforge_require_membership` pattern used elsewhere.

### M3. Auth check does a live HTTP round-trip on every single request
`lib/auth.js`'s `getSupabaseUser()` calls Supabase's `/auth/v1/user` per request instead of verifying the JWT locally against Supabase's JWKS. Correct, but couples every endpoint's latency and availability to Supabase Auth being up, and adds cost at scale.
**Fix:** verify JWTs locally with a cached JWKS; fall back to the live check only when needed (e.g. token revocation checks).

### M4. `embed()` in `api/rag.js` has no timeout, unlike `lib/ai.js`
`lib/ai.js`'s `rawCall()` uses an `AbortController` with a configurable timeout; `rag.js`'s `embed()` calls OpenAI's embeddings endpoint with no timeout at all. A hung embeddings call ties up the function until the platform's own timeout.
**Fix:** reuse the same timeout/circuit-breaker pattern already built for `lib/ai.js`.

---

## Low

### L1. 27 sequential migrations with heavy naming churn
("stage4_governance_finalization" → "...consolidation" → "...canonical_governance") suggests real schema thrash. Not a bug, but a maintainability risk — confirm there's a tested rollback path and mark superseded migrations as such.

### L2. `api/evaluate.js` loads an 895 KB benchmark file synchronously at module import
Fine today; will add cold-start latency as the benchmark grows. Consider lazy-loading on first use.

---

## Strengths worth preserving (don't refactor these away)

- **Defense-in-depth authorization**: RLS on every canonical table *and* an explicit `thinkforge_require_membership()` check inside the write RPCs themselves — so even though the app uses the service-role key (which bypasses RLS), a missed check doesn't automatically mean a breach.
- **Durable rate limiting that fails safe**: Upstash-backed, and *hard-fails in production* if Redis isn't configured rather than silently degrading to a per-instance counter that wouldn't work on serverless.
- **LLM governance**: explicit anti-hallucination system prompt, schema validation with a repair-retry loop, per-model circuit breaker, per-call cost budget cutoff.
- **Governance workflow correctness**: `transition` explicitly refuses to set state to `APPROVED` directly, forcing all approvals through a dedicated `approve` action that requires a `reviewId` — closing a common "skip review by transitioning state" hole.
- **Frontend XSS discipline**: all four `innerHTML` call sites in `app.js` route dynamic content through a real `esc()` HTML-entity escaper, not string concatenation.
- **Honest data labeling**: the synthetic benchmark JSON self-labels `empirical_claim_eligible: false` / `human_subject_claim_eligible: false`, and `evaluate.js` explicitly refuses to fabricate quality scores in offline mode.
- **No SSRF surface in deep research**: `runDeepWebSweep` never fetches user-supplied URLs itself — it only sends query strings to Tavily's search API, which does the fetching.

---

## Roadmap to close the gap (highest leverage first)

**This week**
1. Wire real (staging) Supabase credentials into CI so C1's test actually runs on every PR.
2. Add an admin/owner role check + a dedicated tight budget to `evaluate.js` live mode and `discovery.js` deep_research (H1, H2).
3. Move CSP off `unsafe-inline` (H3).

**Next sprint**
4. Decide and implement RAG's intended scope (org vs. user) and migrate accordingly (M2).
5. Add timeout/circuit-breaker parity to `embed()` (M4).
6. Switch auth verification to local JWT + JWKS caching (M3).

**Ongoing hygiene**
7. Annotate/consolidate the migration history so it's clear which of the 27 are superseded (L1).
8. Make the cross-tenant test also run on a schedule against staging, not only on `supabase/**` diffs, so a regression introduced elsewhere still gets caught.

Closing items 1–3 removes the two failure modes that could actually cause real damage (a silent regression in tenant isolation, and uncapped third-party cost exposure) — that's most of the risk in this list, done in the least code.

---

## Deep-dive pass 2 — `lib/` internals (governance, audit, privacy, reasoning)

This pass opened every remaining `lib/` file under ~500 lines, including several whose names promise more rigor than their (very short) implementations deliver.

### High

**D1. `lib/privacyLifecycle.js`'s PII/secret detector is not real PII detection.**
```js
function classify(text=''){const s=String(text);return{pii:/\b(?:\d{12}|\d{10}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i.test(s),secret:/api[_ -]?key|password|secret|token/i.test(s)}}
```
This only catches emails and bare 10/12-digit number sequences — it misses names, addresses, standard 16-digit card numbers, non-US phone formats, and any secret whose variable name isn't literally "api key/password/secret/token." If this function gates what's allowed into evidence text, AI prompts, or a privacy/compliance report anywhere, it will produce false confidence that PII has been screened. Treat it as a coarse hint for a human reviewer, never as a compliance control, and say so explicitly in the code/docs.

**D2. `lib/auditVerify.js`'s tamper-evidence chain doesn't flag a missing hash.**
```js
if(e.event_hash&&e.event_hash!==expected)failures.push({index:i,reason:'event_hash_mismatch'});
```
The mismatch check only runs `if(e.event_hash)` — an audit record with its `event_hash` field stripped out (accidentally or deliberately) passes `verifyChain()` with zero failures, because the check is simply skipped rather than treated as an anomaly. For a hash chain whose entire purpose is tamper evidence, "the integrity hash is just absent" is exactly the case that should fail loudly.
**Fix:** require `event_hash` to be present on every event; treat its absence as a `missing_event_hash` failure, not a pass.

### Medium

**D3. `lib/qualityGate.js` verifies nothing itself — it's a boolean AND over externally-supplied claims.**
```js
function gate(report={}){const rules={tests:true,syntax:true,security:true,study:true,benchmark:true};const failures=Object.entries(rules).filter(([k])=>report[k]!==true).map(([k])=>k);...}
```
It trusts whatever sets `report.tests`, `report.security`, etc. to have actually run those checks honestly. That's a fine composition pattern *if* every caller populates those flags from a real, tamper-resistant source — worth tracing who calls `gate()` and confirming none of those five booleans can be set by a step that didn't actually run the corresponding check.

**D4. `lib/e2eLifecycle.js` verifies wiring, not outcomes.**
`runLifecycle(adapter)` calls each of the eight required adapter methods in sequence and reports `passed:true` as long as none of them throw — it never inspects what they returned. A `validateAI` that's a silent no-op, or a `recordOutcome` that does nothing, would still produce a "passed" end-to-end lifecycle result. Fine as a smoke test for "is the adapter shape correct"; misleading if read as "the lifecycle behaved correctly."

**D5. `lib/decisionHealth.js`: a decision can be `READY` with unresolved assumptions still open.**
```js
if(contradictions>0)state='INVESTIGATE';
else if(unresolved>0&&evidenceCoverage<0.75)state='BLOCKED';
else if(evidenceCoverage>=0.75&&(challenges.length>0||readiness))state='READY';
```
If `unresolvedAssumptions > 0` but `evidenceCoverage >= 0.75`, the `BLOCKED` branch doesn't fire (its condition requires low coverage), and the `READY` branch can fire instead. So a decision with open, unvalidated assumptions can still be reported `READY` for governance as long as overall evidence coverage is high and at least one challenge or experiment exists. This may be an intentional "coverage matters more than per-item status" design choice — but as written it's easy to read the state machine and assume `READY` implies zero open assumptions, which isn't true. Worth an explicit product decision and a code comment either way.

**D6. `lib/audit.js`'s hash-chain linkage is caller-supplied, not self-serializing.**
`buildEvent()` takes `previous_hash` from `metadata.previousHash`, i.e. whatever the caller says the prior event's hash was — it doesn't itself read the true last-committed hash from storage inside a transaction. Under concurrent writes to the same chain, nothing in this file prevents two events from being built against the same "previous" hash, which would fork the chain rather than serialize it. Whether this is actually exploitable depends entirely on whether the persistence layer (the Postgres insert path, not shown in this file) enforces serialized appends — worth verifying directly against the audit-table migration/constraints rather than assuming this file protects it.

### Notable strengths from this pass (worth keeping as the house style)

- **`lib/jiraSafety.js`** — a genuinely good minimal gate for any outbound, side-effecting integration: refuses a Jira write unless it's explicitly confirmed, authorized, has a project key, *and* an idempotency key. This is the right template for any future outbound integration (email sends, webhook calls, etc.).
- **`lib/reasoning.js`'s `verifyClaims()`** — instead of trusting the LLM's self-reported `supportStatus`, it independently re-derives support status via lexical overlap against the actual evidence text, and labels its own output `verificationMode:'hybrid_lexical_guardrail'` so nothing downstream mistakes it for ground truth. The one caveat: the "supported" threshold (lexical overlap ≥ 0.18) is a fairly low bar — a claim can share enough vocabulary with unrelated evidence to score as supported without true semantic entailment. Not a flaw, just a limitation worth documenting alongside the label.
- **`lib/domainModel.js`'s `validateRelationships()`** — genuinely thorough referential-integrity checking: every assumption/claim/opportunity/solution/theme/observation reference is checked against real IDs in the same graph before it's accepted. This is the kind of validation that prevents silent data corruption and it's applied consistently.
- **`lib/decisionGovernance.js` / `lib/decisionWorkflow.js`** — both are explicitly, loudly documented as non-authoritative preview facades (`PREVIEW_ONLY:true`, a comment stating they must never be used to authorize a real decision), consistent with the same pattern already noted in `api/decision-governance.js`. Good internal discipline about which layer is allowed to be the source of truth.
- **`lib/discoveryContracts.js`** — uses `zod` (a real declared dependency, not just a dev tool) for schema validation, with a hand-written `manualValidate` fallback only for resilience if the `zod` import fails at runtime. Confirmed this isn't an environment-inconsistency risk: `zod` is pinned in `dependencies`, so the fallback path is a safety net, not the default.

### Updated priority list (adds D1, D2 to the "fix soon" tier)

1. Cross-tenant isolation test running in CI (unchanged — still top).
2. Role/budget gates on `evaluate.js` live mode and `discovery.js` deep_research (unchanged).
3. **D2** — make a missing `event_hash` a verification failure, not a silent pass.
4. **D1** — relabel/replace the privacy `classify()` PII detector so it isn't relied on as a real compliance control.
5. CSP `unsafe-inline` removal.
6. D5/D6 — get explicit product sign-off on the `READY`-with-open-assumptions behavior, and verify the audit hash chain's concurrency guarantees at the DB layer.

