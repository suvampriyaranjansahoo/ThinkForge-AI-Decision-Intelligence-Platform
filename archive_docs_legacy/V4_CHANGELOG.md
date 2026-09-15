# ThinkForge v4 — Enhancement Changelog

- Replaced permissive JSON parsing with strict Zod response contracts.
- Added business-rule validation for evidence references and decision prerequisites.
- Added authenticated server-side AI, Jira and workspace APIs.
- Added request IDs and rate-limit controls.
- Added explicit Jira confirmation gate.
- Rebuilt evaluation endpoint so quality is never scored from synthetic text.
- Added normalized decision, assumption, evidence, AI interaction and audit tables.
- Added pgvector IVFFlat index and bounded similarity search.
- Added health/configuration endpoint.
- Added unit tests for critical AI contracts.
- Added architecture/evaluation documentation for production and research paths.
