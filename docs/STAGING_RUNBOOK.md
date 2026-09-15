# ThinkForge staging runbook

## Preconditions

- A disposable Supabase staging project—not production.
- Two users in different organizations and one decision owned by the second organization.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `THINKFORGE_TEST_USER_JWT_A`, and `THINKFORGE_TEST_DECISION_ID_B` set as secrets.
- Migrations 028 and 029 applied in order.

## Release sequence

1. Run `npm ci`, `npm run check`, `npm run migrations:check`, and `npm test`.
2. Apply the migrations and deploy with Node 22. Keep AI, Tavily, Supabase, and rate-limit values server-side.
3. Run the live tenant-isolation test. It must pass, not skip.
4. Create an agent plan; confirm it returns `AWAITING_APPROVAL` before external research.
5. Approve one non-production run; inspect its persisted trace, source count, status, latency, and cost.
6. Run a controlled frozen-benchmark evaluation and retain model, prompt, retriever, pass rate, P95 latency, and cost.
7. Run failure drills: provider unavailable, malformed provider response, and cross-organization request.

## Evidence bundle

- Passing CI URL
- Agent approval-pause and completed-trace screenshots/video
- Benchmark JSON output and telemetry screenshot
- Cross-tenant denial assertion
- Anonymized consent log and real outcome record

Never substitute mock or sample records for this evidence.
