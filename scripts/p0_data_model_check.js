'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase','migration_016_p0_decision_memory.sql'),'utf8');
const checks=[
  ['initiative hierarchy',/thinkforge_initiatives/],
  ['first-class product outcomes',/thinkforge_product_outcomes/],
  ['decision initiative linkage',/primary_outcome_id uuid/],
  ['claim entity',/thinkforge_claims/],
  ['claim-evidence relationship',/thinkforge_claim_evidence_links/],
  ['evidence provenance',/thinkforge_evidence_provenance/],
  ['assumption-evidence relationship',/thinkforge_assumption_evidence_links/],
  ['opportunity-evidence relationship',/thinkforge_opportunity_evidence_links/],
  ['solution-assumption relationship',/thinkforge_solution_assumptions/],
  ['assumption-experiment relationship',/thinkforge_assumption_experiments/],
  ['prediction-outcome relationship',/thinkforge_prediction_outcome_links/],
  ['learning-evidence relationship',/thinkforge_learning_evidence_links/],
  ['decision-learning relationship',/thinkforge_decision_learning_links/],
  ['immutable decision snapshots',/thinkforge_decision_snapshots/],
  ['snapshot no overwrite',/on conflict\(decision_id,decision_version\) do nothing/],
  ['prediction lock columns',/locked_by uuid/],
  ['prediction immutability trigger',/thinkforge_guard_locked_prediction/],
  ['locked prediction lock-state protection',/new\.locked_at is distinct from old\.locked_at/],
  ['prediction lock RPC',/thinkforge_lock_prediction_v1/],
  ['snapshot RPC',/thinkforge_create_decision_snapshot_v1/],
  ['tenant RLS',/thinkforge_has_org_role\(organization_id,'viewer'\)/],
  ['migration mirrored in db directory',fs.existsSync(path.join(root,'db','migrations','016_p0_decision_memory.sql'))]
];
const failures=checks.filter(([,ok])=>typeof ok==='boolean'?!ok:!ok.test(sql)).map(([n])=>n);
const result={target:'P0',pass:failures.length===0,checks:checks.map(([name,ok])=>({name,pass:typeof ok==='boolean'?ok:ok.test(sql)})),failures};
console.log(JSON.stringify(result,null,2));
if(!result.pass)process.exit(1);
