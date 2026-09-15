'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const sql15=fs.readFileSync(path.join(root,'supabase','migration_015_stage2_canonical_data_model.sql'),'utf8');
const sql16=fs.readFileSync(path.join(root,'supabase','migration_016_p0_decision_memory.sql'),'utf8');
const sql19=fs.readFileSync(path.join(root,'supabase','migration_019_canonical_write_paths.sql'),'utf8');
const sql=sql15+'\n'+sql16+'\n'+sql19;
const checks=[
 ['canonical decision writer',/thinkforge_upsert_decision_graph_v2/],
 ['canonical graph reader',/thinkforge_read_decision_graph_v2/],
 ['transactional workspace writer',/thinkforge_sync_workspace_v2/],
 ['append-only entity history',/thinkforge_entity_versions/],
 ['stable client uniqueness',/uq_tf_(decision|assumption|evidence|challenge|alternative|experiment|prediction|outcome|learning)_client/],
 ['optimistic version conflict',/Decision version conflict/],
 ['archive instead of delete',/ARCHIVE/],
 ['organization membership enforcement',/thinkforge_require_membership/],
 ['tenant-aware RLS',/thinkforge_has_org_role/],
 ['Stage 1 discovery compatibility',/thinkforge_discoveries/],
 ['RAG domain tenancy',/thinkforge_documents/],
 ['AI telemetry tenancy',/thinkforge_ai_interactions/],
 ['canonical v3 workspace writer',/thinkforge_sync_workspace_v3/],
 ['canonical discovery writer',/thinkforge_upsert_discovery_v1/],
 ['relational first cache second',/canonical graph is written FIRST/],
 ['canonical domain facade functions',/thinkforge_sync_workspace_v3[\s\S]*thinkforge_upsert_discovery_v1/]
];
const failures=checks.filter(([,rx])=>!rx.test(sql)).map(([n])=>n);
const files=['lib/domainModel.js','supabase/migration_016_p0_decision_memory.sql','db/migrations/016_p0_decision_memory.sql','api/domain.js','supabase/migration_015_stage2_canonical_data_model.sql','db/migrations/015_stage2_canonical_data_model.sql','tests/data_model_stage2.test.js','docs/STAGE2_CANONICAL_DATA_MODEL_9_5.md'];
const missing=files.filter(f=>!fs.existsSync(path.join(root,f)));
const result={target:9.5,pass:failures.length===0&&missing.length===0,checks:checks.map(([name,rx])=>({name,pass:rx.test(sql)})),missing};
console.log(JSON.stringify(result,null,2));
if(!result.pass)process.exit(1);
