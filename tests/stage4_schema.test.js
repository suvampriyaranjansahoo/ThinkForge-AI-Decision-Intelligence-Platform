const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Stage 4 migration defines governed decision state and RPCs',()=>{
  const sql=fs.readFileSync('db/migrations/022_stage4_decision_governance.sql','utf8');
  for(const token of ['thinkforge_decision_governance','thinkforge_decision_readiness_v1','thinkforge_transition_decision_v1','thinkforge_decision_workspace_v1']) assert.match(sql,new RegExp(token));
  assert.match(sql,/READY_FOR_REVIEW/);
  assert.match(sql,/approved_snapshot_id/);
});

test('Stage 4 legacy decision API is a compatibility adapter to canonical governance',()=>{
  const api=fs.readFileSync('api/decision.js','utf8');
  assert.match(api,/module\.exports=require\('\.\/decision-governance'\)/);
  assert.doesNotMatch(api,/thinkforge_decision_readiness_v1/);
  assert.doesNotMatch(api,/thinkforge_transition_decision_v1/);
});
