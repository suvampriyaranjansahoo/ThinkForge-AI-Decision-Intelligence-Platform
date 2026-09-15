# ThinkForge v14.2 — Semantic Intelligence + Live DB Verification

## Fixed: deterministic/rule-assisted semantic intelligence

Stage 1 production analysis now uses the configured LLM through `discovery_semantic`. The model receives the complete discovery context, including desired outcome and research question, and returns structured semantic findings for intent, method fit, codes, themes, contradictions, evidence gaps, triangulation, opportunities, assumptions, and solutions.

The model output is schema-validated and every evidence reference is allowlisted against the supplied evidence set. Unknown IDs are removed before downstream use. Production/default `/api/discovery` analysis fails closed when `AI_API_KEY` is unavailable. The old deterministic analyzer is retained only through explicit `mode=heuristic` for offline development/tests.

## Fixed: live DB verification gap

Added migration `021_stage1_live_verification.sql` and a mirrored Supabase migration. The new read-only RPC `thinkforge_verify_stage1_live()` verifies Stage 1 tables, required columns, canonical discovery writer presence, and RLS enabled on the Stage 1 tables.

Run against a real linked Supabase project:

```bash
npm run db:verify:live
```

The command exits:
- `0` = connected database passed all live checks
- `1` = live verification failed
- `2` = blocked because database credentials are missing

A GitHub Actions workflow is included at `.github/workflows/live-db-verify.yml` and uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` repository secrets.

## Validation completed in this build

- JavaScript syntax checks: PASS
- Full repository tests: 83/83 PASS
- Semantic Stage 1 adapter tests: PASS
- Evidence-reference allowlisting test: PASS
- Live DB verifier: BLOCKED in this environment because no live Supabase credentials are available; no claim of live deployment verification is made.
