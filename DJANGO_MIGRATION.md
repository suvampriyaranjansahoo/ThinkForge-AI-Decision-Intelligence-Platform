# Node to Django migration status

## New Django platform

`backend/` is a deployable Django/DRF, PostgreSQL/pgvector, Celery, and Redis backend. It owns the normalized product data model, tenant roles, decision workflow APIs, document indexing, evidence retrieval, agent runtime, feedback, and audit-event model.

## Safe cutover sequence

1. Start the Docker stack and run `python manage.py test apps.core.tests`.
2. Create a staging organization and JWT user. Verify that a viewer cannot create decisions and an editor cannot access another organization.
3. Import a copy of existing Supabase data with a one-time, reviewed import command. Reconcile row counts and sample records before changing frontend traffic.
4. Put Django behind the existing frontend origin, or configure `djangoApiBase` as `http://localhost:8000` for local development.
5. Switch core reads/writes one route at a time: organizations, decisions, evidence, experiments, RAG, agent runs, workspace.
6. Keep the Node routes available during a measured staging period. Monitor 4xx/5xx, queue failures, task latency, and cross-tenant access tests.
7. Only after a rollback rehearsal and passing contract tests, retire matching Node endpoints. Do not retire unrelated endpoints merely because Django exists.

## Decision recorded 2026-09 (this changes the target, not today's state)

Product direction is now: **Django is the sole long-term backend; Node/Vercel will be retired.** This is a committed target, not yet an executed cutover.

Before physical retirement can happen safely (per the cutover sequence above, which still applies in full -- nothing below skips it), a real, separate porting effort is needed for capability that exists **only** in Node today, with no Django equivalent:

- `api/discovery.js` -- product discovery / deep web research (no Django equivalent at all)
- `api/jira.js` -- real Jira integration (Django's `FORBIDDEN_TOOLS` only *names* `jira_create`/`jira_update` as disallowed agent actions; there is no actual Jira client)
- `api/evaluate.js` -- benchmark/quality scoring against the gold datasets (no Django equivalent)
- `api/study.js`, `api/annotations.js` -- human-rater study and annotation workflow (no Django equivalent)
- `api/quality.js` -- quality-gate scoring (no Django equivalent)

Confirmed by grep against `backend/apps/core/` on 2026-09-11 -- zero matches for discovery/study/quality/annotations, and the only jira/evaluate string hits are unrelated (a forbidden-tool name, an event-type label).

**What this means concretely:** retiring Node now, before this gap is closed, would delete live product capability, not duplicate code -- it is explicitly out of scope for a "targeted fixes, not a rebuild" pass. The next real decision is not engineering, it's product: either (a) commit to porting each of the five items above to Django one at a time (a genuine multi-session project), or (b) decide some of them are not coming back (e.g., if the human-annotation research apparatus stays Node-only/offline permanently rather than becoming a served Django feature). Until that's decided item-by-item, Node stays in the repo -- not because the decision to retire it was wrong, but because deleting it before (a) or (b) happens for each item would silently ship a regression.

