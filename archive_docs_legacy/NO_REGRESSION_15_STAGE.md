# 15-Stage No-Regression Policy

Every Stage 1/2 enhancement must preserve the protected implementation surface of Stages 3–15. `npm run quality:15-regression` is a static structural gate; the full Jest/Node test suite remains the functional regression gate.

A release cannot be described as empirically validated unless expert gold, real RAG gold, real outcomes, and live database execution are present.
