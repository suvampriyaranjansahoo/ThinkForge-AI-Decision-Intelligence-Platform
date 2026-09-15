# Migration integrity note — 2026-09-09

`db/migrations/025_stage4_governance_consolidation.sql` and
`supabase/migration_025_stage4_governance_consolidation.sql` are not byte-identical.
The differences affect readiness-function safety checks, the readiness version used
by approval/transition paths, and a trigger definition.

The subsequent canonical finalization migration, `026_stage4_governance_finalization.sql`,
is byte-identical between both migration trees and is the protected Stage 4 finalization
surface used by the regression gate.

Conclusion: the duplicate migration trees contain historical drift at 025, but the
final 026 migration is synchronized. Live database equivalence is still an environment
verification task and is not inferred from file presence alone.
