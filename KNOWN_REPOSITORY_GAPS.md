# Known public-repository gaps

Status checked 2026-09-21. This page makes the limits of the public checkout visible
instead of presenting incomplete evidence as a finished result.

## Verified checks

| Check | Result |
|---|---:|
| Django core tests | 18 passed |
| Django system check | passed |
| Agent policy evaluation | 17 / 17 passed |
| Agent state-machine evaluation | 15 cases, no mismatches or declared divergences |
| Full Node suite | 235 passed, 0 failed, 9 skipped (244 total) |

## Why the Node suite is not green yet

1. `eval/external_gold/capstone_gold_layer_v1/` is deliberately ignored because it is
   marked as confidential human-study material. Public CI now marks only its dependent
   checks as skipped; when the directory is present, those same checks execute. Do not
   add it to GitHub without a privacy review and explicit permission to publish every
   included record.
2. The current public RAG freeze manifest matches the committed `eval/rag_gold_v1.csv`.
   The check normalizes Windows CRLF line endings before hashing, so the frozen manifest
   remains portable across developer machines and CI.

## Public-release decision still needed

Choose one before claiming that the confidential capstone data itself is publicly verifiable:

- Publish a privacy-reviewed, sanitized capstone fixture and keep integrity tests on it.
- Or make those tests explicitly report a skipped private-artifact check in public CI,
  while retaining a private CI job that verifies the confidential layer.

Until then, do not describe the capstone data as publicly verifiable. This does not
change the verified Django and agent-policy results above.
