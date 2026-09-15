'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const files=['supabase/migration_015_stage2_canonical_data_model.sql','supabase/migration_016_p0_decision_memory.sql','supabase/migration_017_p1_data_model_normalization.sql','supabase/migration_018_p2_canonical_data_integrity.sql'];
const sql=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const mirror=fs.readFileSync(path.join(root,'db/migrations/018_p2_canonical_data_integrity.sql'),'utf8');
const checks=[
 ['decision hierarchy guard',/trg_tf_decision_hierarchy/],
 ['outcome hierarchy guard',/trg_tf_outcome_hierarchy/],
 ['all graph-link org guards',/trg_tf_claim_evidence_org[\s\S]*trg_tf_decision_learning_org/],
 ['research lineage guard',/trg_tf_research_lineage/],
 ['theme-observation guard',/trg_tf_theme_observation_org/],
 ['locked prediction immutability',/trg_tf_prediction_lock_v2/],
 ['immutable decision snapshots',/trg_tf_snapshot_immutable_update[\s\S]*trg_tf_snapshot_immutable_delete/],
 ['canonical integrity view',/thinkforge_canonical_integrity_v1/],
 ['relationship drift view',/thinkforge_relationship_drift_v1/],
 ['P2 mirror matches migration content',()=>mirror===fs.readFileSync(path.join(root,'supabase/migration_018_p2_canonical_data_integrity.sql'),'utf8')]
];
const failures=checks.filter(([,check])=>(typeof check==='function'? !check(): !check.test(sql))).map(([n])=>n);
const required=[...files,'scripts/p2_data_model_check.js','tests/p2_data_model.test.js','docs/STAGE2_P2_CANONICALIZATION.md'];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
const result={target:'P2',pass:!failures.length&&!missing.length,checks:checks.map(([name,check])=>({name,pass:typeof check==='function'?check():check.test(sql)})),missing};
console.log(JSON.stringify(result,null,2));
if(!result.pass)process.exit(1);
