# Stage 2 P2 — Canonicalization & Integrity

P2 hardens the Stage 2 model without destructive migration. It adds hierarchy guards, cross-entity organization integrity, research lineage checks, immutable prediction/snapshot enforcement, canonical integrity/drift views, and corrects discovery confidence normalization for both 0–1 and 0–10 inputs.

## Product intent

The data model now preserves not only records but the integrity of the reasoning graph: outcome → discovery → evidence → opportunity → solution → assumption → experiment → prediction → outcome → learning → decision.

## Compatibility

All P2 changes are additive. Existing JSON compatibility fields and older rows are retained. Legacy organization-null rows remain readable; the canonical migration does not fabricate ownership.
