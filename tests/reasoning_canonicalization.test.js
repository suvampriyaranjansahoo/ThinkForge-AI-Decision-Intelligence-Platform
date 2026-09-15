'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {buildReasoningContext,validateReasoningOutput,verifyClaims}=require('../lib/reasoning');
const {validate}=require('../lib/contracts');
test('reasoning context ranks candidate evidence and preserves IDs',()=>{
 const ctx=buildReasoningContext({claims:[{id:'c1',text:'Users struggle with setup'}],evidence:[{id:'E1',content:'Users struggled with setup and spent time troubleshooting.'},{id:'E2',content:'Users liked pricing.'}]});
 assert.equal(ctx.candidateEvidence[0].candidateEvidence[0].evidenceId,'E1');
});
test('reasoning validator blocks unsupported references and missing evidence for supported claims',()=>{
 const bad={summary:'valid summary' ,claims:[{id:'c1',text:'claim',supportStatus:'SUPPORTED',evidenceIds:['NOPE'],uncertainty:'low',rationale:'r'}],keyUncertainties:[],nextTests:[]};
 assert.equal(validateReasoningOutput(bad,[{id:'E1'}]).length,1);
 assert.equal(validate('reasoning',bad).some(x=>x.code==='invalid'),false);
});
test('reasoning verifier abstains when no evidence is linked',()=>{
 const out=verifyClaims([{id:'c1',text:'A claim',supportStatus:'SUPPORTED',evidenceIds:[],uncertainty:'high',rationale:'r'}],[{id:'E1',content:'Different topic'}]);
 assert.equal(out[0].supportStatus,'NOT_VERIFIABLE');
});
test('reasoning contract is registered',()=>{const e=validate('reasoning',{summary:'valid summary',claims:[{id:'c1',text:'claim',supportStatus:'NOT_VERIFIABLE',evidenceIds:[],uncertainty:'high',rationale:'no evidence'}],keyUncertainties:[],nextTests:[]});assert.equal(e.length,0);});

test('Stage 1 v14.1 canonical discovery writer and migration are present',()=>{
  const fs=require('node:fs');
  const mig=fs.readFileSync(require('node:path').join(__dirname,'../db/migrations/020_stage1_downstream_materialization.sql'),'utf8');
  const mirror=fs.readFileSync(require('node:path').join(__dirname,'../supabase/migration_020_stage1_downstream_materialization.sql'),'utf8');
  const repo=fs.readFileSync(require('node:path').join(__dirname,'../lib/domainRepository.js'),'utf8');
  assert.match(repo,/thinkforge_upsert_discovery_v2/);
  assert.match(mig,/thinkforge_research_themes/);
  assert.match(mig,/thinkforge_solutions/);
  assert.match(mig,/analysis_payload/);
  assert.equal(mig,mirror);
});

const fs=require('node:fs');
const path=require('node:path');
test('v14.2 semantic and live DB verification artifacts are present',()=>{
  const root=path.join(__dirname,'..');
  assert.ok(fs.existsSync(path.join(root,'db/migrations/021_stage1_live_verification.sql')));
  assert.ok(fs.existsSync(path.join(root,'supabase/migration_021_stage1_live_verification.sql')));
  const sql=fs.readFileSync(path.join(root,'db/migrations/021_stage1_live_verification.sql'),'utf8');
  assert.match(sql,/thinkforge_verify_stage1_live/);
  assert.match(sql,/relrowsecurity/);
});
