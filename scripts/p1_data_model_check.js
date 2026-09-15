'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const files=['supabase/migration_015_stage2_canonical_data_model.sql','supabase/migration_016_p0_decision_memory.sql','supabase/migration_017_p1_data_model_normalization.sql'];
const sql=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const checks=[
 ['solution first-class entity',/thinkforge_solutions/],
 ['solution reuse metadata',/status text not null default 'candidate'/],
 ['assumption semantic types',/assumption_type text/],
 ['leap-of-faith field',/leap_of_faith boolean/],
 ['experiment analysis plan',/analysis_plan jsonb/],
 ['research sessions',/thinkforge_research_sessions/],
 ['research participants',/thinkforge_research_participants/],
 ['observations separated from inference',/thinkforge_research_observations/],
 ['research themes',/thinkforge_research_themes/],
 ['decision context and tiering',/thinkforge_decision_contexts/],
 ['decision participants',/thinkforge_decision_participants/],
 ['first-class contradictions',/thinkforge_contradictions/],
 ['outcome measurement provenance',/measurement_source text/],
 ['outcome verification status',/verification_status text/],
 ['append-only domain events',/thinkforge_domain_events/],
 ['cross-org solution guard',/trg_tf_solution_org/],
 ['cross-org observation guard',/trg_tf_observation_org/],
 ['cross-org decision context guard',/trg_tf_decision_context_org/],
 ['P1 RLS',/tf_solutions_org on public.thinkforge_solutions/],
 ['discovery lineage view',/thinkforge_discovery_lineage_v1/],
 ['normalized evidence health view',/thinkforge_opportunity_evidence_health_v1/]
];
const failures=checks.filter(([,rx])=>!rx.test(sql)).map(([n])=>n);
const required=[...files,'tests/p1_data_model.test.js','docs/STAGE2_P1_NORMALIZATION.md'];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
const result={target:'P1',pass:!failures.length&&!missing.length,checks:checks.map(([name,rx])=>({name,pass:rx.test(sql)})),missing,files};
console.log(JSON.stringify(result,null,2));
if(!result.pass)process.exit(1);
