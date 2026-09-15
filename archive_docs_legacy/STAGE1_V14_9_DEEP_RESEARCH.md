# Stage 1 v14.9 — Deep Research + Human Evidence

## Purpose

Stage 1 now supports a high-depth discovery protocol for decisions that warrant broad external research. The protocol targets at least **60 retained independent sources** and requires at least **40 independent sources** before a run can be marked ready for synthesis.

## Live web research

When `TAVILY_API_KEY` is configured, `/api/discovery` with `action=deep_research` runs a multi-query sweep using focused source-class queries. The adapter uses Tavily's advanced search mode, then normalizes, deduplicates and quality-filters results. Tavily documents a maximum of 20 results per request and recommends breaking complex research into focused sub-queries; advanced search is intended for higher-relevance research. See the official API documentation for current limits and parameters.

## Independence

The source layer distinguishes URLs from independent evidence. Canonical URLs, publisher/title fingerprints, and explicit study/dataset identifiers are used to prevent related publications from inflating evidence counts.

## Human evidence

Real participant responses are first-class evidence when a participant/session identifier and response are supplied. Synthetic persona responses are explicitly labelled `SYNTHETIC_RESPONSE_NOT_EMPIRICAL` and cannot enter empirical synthesis.

## Epistemic separation

Discovery maintains the distinction between `FACT`, `OBSERVATION`, `INTERPRETATION`, `OPPORTUNITY`, `HYPOTHESIS`, and `RECOMMENDATION`.

## Saturation

Research does not blindly continue because a numeric target exists. The protocol reports whether the configured saturation window stopped producing new themes. If fewer than 60 independent relevant sources exist, the system reports the shortfall instead of padding the corpus with low-quality or duplicate sources.

## UI

Stage 1 now exposes:

- **Deep Research 60+** action
- **Human evidence** capture
- **Web source import** for curated/provider results
- source and duplicate counts
- human evidence counts
- diversity and saturation status

## Environment

```text
TAVILY_API_KEY=
DEEP_RESEARCH_SEARCH_DEPTH=advanced
DEEP_RESEARCH_TARGET_SOURCES=60
DEEP_RESEARCH_MIN_INDEPENDENT_SOURCES=40
```

The provider key is server-side only and must not be placed in browser code.
