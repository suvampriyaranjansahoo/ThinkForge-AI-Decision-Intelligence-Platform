# Stage 1 Development Optimization — v9.1

Implemented only on the development/production logic; the locked-test gold is not used for tuning.

## Changes
- Question classification now prioritizes specific diagnostic/evaluative patterns over generic `why` matches and exposes ambiguity.
- Contradiction detection now combines explicit stance, polarity/negation, topic overlap, segment, method, source and temporal context.
- Contradiction reports carry a deterministic signal score, topic overlap, context metadata and a human-review requirement.
- Contradiction reports are deduplicated deterministically.

## Safety constraints
- No synthetic labels were added.
- No ThinkForge predictions were used as gold.
- Locked-test labels are not used by the optimization logic.
- Human adjudication remains human work; unresolved adjudications are not silently converted to gold.

## Verification
Stage 1 discovery + Stage 2 hardening tests: 34/34 passing.
