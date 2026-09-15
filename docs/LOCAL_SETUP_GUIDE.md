# Local setup — get to a real ThinkForge decision run

This is the missing piece between "the system is built" and "RESULTS.md has real numbers
in it." Everything here runs on your own machine, not in a sandbox — because filling
RESULTS.md requires an actual `AI_API_KEY` and a real database, neither of which can exist
in an isolated build environment.

Verified before you get here: the Django backend (18/18 tests) and the Node suite
(236/236, 5 correctly skipped for needing a live DB) both pass for real — see
`CHANGELOG_AUDIT_FIXES.md` for what was actually run. This guide is only about getting
the *product* running, not re-proving the code works.

## What you need before starting

- Docker + Docker Compose (for Postgres/pgvector + Redis)
- Node 22+ and Python 3.12+ (already pinned via `.nvmrc` / `backend/requirements.txt`)
- An API key from any OpenAI-compatible provider (OpenAI itself, or any compatible
  endpoint) — this is the one thing nothing in this repo can substitute for

## 1. Bring up the database and cache

```bash
docker compose up -d postgres redis
```

`docker-compose.yml` already pins `pgvector/pgvector:pg16` and waits on a healthcheck, so
the Django `web`/`worker` services won't start until Postgres is actually ready.

## 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in:
- `DJANGO_SECRET_KEY` — any long random string for local dev
- `AI_API_KEY` — your real key
- `AI_BASE_URL` / `AI_MODEL` — defaults to OpenAI (`gpt-4o-mini`); change if you're using a
  different OpenAI-compatible provider

Leave `POSTGRES_HOST=postgres` / `CELERY_BROKER_URL=redis://redis:6379/0` as-is — those
point at the Compose service names, not `localhost`, because the backend itself also runs
in Compose.

## 3. Run migrations and bring up the full stack

```bash
docker compose up -d web worker
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

All 5 migrations (`0001` through `0005_remove_retrying_state_choice`) apply cleanly against
Postgres — this was verified against sqlite in this session; the SQL itself is
Postgres/pgvector-specific so run this step for the real check.

## 4. Sanity-check before running real decisions

```bash
docker compose exec web python manage.py test apps.core.tests
curl http://localhost:8000/api/health/
```

If both come back clean, the stack is live.

## 5. Run real decisions (the actual RESULTS.md work)

`docs/RESULTS.md` already documents the process: pick 10–15 real decisions from your other
projects, run each through the agent, and record what it surfaced. To make that
mechanical instead of manual copy-paste, use the capture script below.

## 6. Capture runs automatically

```bash
node scripts/capture_decision_run.js --goal "Should MediFlowRT add feature X?" --org <org-id>
```

This calls the same `create_run` path the tests exercise, but against your live stack, and
appends a structured record to `eval/decision_log.jsonl` — see
`scripts/capture_decision_run.js` for what it captures (latency, tool calls, final state,
assumption/evidence data from the run's plan and steps). Once you have 10+ real entries:

```bash
node scripts/render_results_md.js
```

This reads `eval/decision_log.jsonl` and rewrites the `## Summary` table and `## Case log`
table in `docs/RESULTS.md` from what's actually in the log — it never invents a row. Rows
stay blank until a real run produces them, exactly as the file's own header instructs.

## What this does and doesn't solve

- Solves: the empty-RESULTS.md and placeholder-metrics gaps, with real numbers instead of
  fabricated ones.
- Doesn't solve: the Django/Node cutover decision in `DJANGO_MIGRATION.md` — that needs a
  real staging deploy and rollback rehearsal, which is a separate, larger effort with its
  own runbook (`docs/STAGING_RUNBOOK.md`).
