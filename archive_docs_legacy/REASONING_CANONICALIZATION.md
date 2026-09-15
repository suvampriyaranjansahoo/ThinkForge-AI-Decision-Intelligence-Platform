# Evidence-Grounded Reasoning + Canonical Write Paths

## Reasoning
ThinkForge now exposes a dedicated `reasoning` AI contract. The reasoning path builds a structured context, ranks candidate evidence, requires claim-level evidence IDs for supported/contradicted claims, and applies a deterministic verification guardrail after the LLM response. It explicitly abstains when evidence is missing.

This is an architectural improvement, not empirical proof. `eval/reasoning_benchmark.json` is a seed benchmark and remains `status=seed_pending_human_gold` until independent human/adjudicated gold labels exist. `npm run reasoning:eval` therefore exits with a blocking status instead of fabricating quality metrics.

## Persistence
Feature APIs now use `lib/domainRepository.js`. `/api/workspace` calls `thinkforge_sync_workspace_v3`, which writes the relational graph first and refreshes workspace JSON only after successful canonical writes in the same transaction. `/api/discovery` uses `thinkforge_upsert_discovery_v1` rather than direct table writes.

Workspace JSON is explicitly a derived compatibility cache, not the source of truth.
