# ThinkForge v14.2 — Semantic Intelligence + Live DB Verification

## What changed

Stage 1 has two explicit execution modes. Production/default API execution uses a configured LLM through the existing structured AI gateway. Offline `mode=heuristic` is retained only for deterministic development/testing. Production semantic discovery fails closed when `AI_API_KEY` is missing rather than silently returning heuristic intelligence.

The model output is schema-validated and then evidence-reference validated. Evidence IDs not present in the supplied evidence set are dropped before downstream materialization. This makes the LLM the semantic reasoner while keeping the database/evidence boundary deterministic and auditable.

## Semantic pipeline

`product concept → research question → semantic intent → evidence requirements → method fit → evidence quality → semantic coding → theme synthesis → contradiction/gaps → triangulation → opportunities → opportunity confidence → multiple solutions → leap-of-faith assumptions → discovery decision`.

The current implementation deliberately does not claim human-level qualitative validity. That requires expert annotation and a locked benchmark.

## Live database verification

Migration `021_stage1_live_verification.sql` adds the read-only RPC `thinkforge_verify_stage1_live()`. It checks: Stage 1 tables, required columns, canonical discovery writer presence, and RLS being enabled on the Stage 1 tables.

Run after migrations are applied to a real Supabase project:

`npm run db:verify:live`

Required variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The command exits with code 2 when credentials are absent (blocked, not passed) and code 1 when the live verification fails. It exits 0 only when the connected database reports `PASS`.

Supabase's current migration workflow recommends `db reset` to replay migrations locally and `db push` to apply pending migrations to a linked project; the linked project should be verified after deployment.
