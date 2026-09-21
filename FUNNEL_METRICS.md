# Five-step funnel metrics

Events already recorded in the frontend event log should be exported by period and deduplicated by decision ID.

| Funnel event | Definition | Metric |
|---|---|---|
| Decision started | `decision_created` recorded | unique decisions created |
| Assumptions reviewed | assumption status changed or evidence linked | decisions with at least one reviewed assumption |
| Recommendation reached | decision receives a recommendation / review-ready status | created → recommendation conversion |
| Experiment set | experiment is non-draft with success rule | recommendation → experiment conversion |
| Outcome recorded | numeric or categorical actual outcome present | experiment → outcome conversion |

For each pilot week, report the denominator, numerator, conversion, known drop-off reason, and data-quality caveat. Do not use the existing demo decisions as product usage.
