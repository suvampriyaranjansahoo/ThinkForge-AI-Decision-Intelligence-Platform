# ThinkForge Human Ground Truth — Data Collection Runbook

## Before participants

- Freeze benchmark version.
- Freeze rubric version.
- Freeze candidate snapshot.
- Record checksums.
- Create study ID.
- Create rater IDs that are not model identifiers.
- Configure attention checks and hidden duplicates.

## Pilot

- Assign 30 cases per rater.
- Keep ratings independent.
- Record confidence and time.
- Review disagreement patterns.
- Revise rubric only before the main study.

## Qualification

A rater reaches `CERTIFIED` only after completing the pilot, meeting the configured pilot quality/consistency gates, and passing qualification review.

## Main annotation

- Use only frozen candidates.
- Do not expose other raters' labels.
- Do not expose gold labels.
- Preserve raw annotations.
- Record claim-level evidence labels where applicable.
- Randomize comparative presentation order.

## Adjudication

Disagreement is sent to a senior adjudicator. Raw ratings are never overwritten. The adjudicated score and rationale become part of the versioned canonical gold set.

## Publication gate

Do not publish a quality claim until the study meets the configured evidence gates for expert gold, RAG gold, and (where claimed) decision-impact/outcome evidence.
