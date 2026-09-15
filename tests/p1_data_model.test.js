'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase','migration_017_p1_data_model_normalization.sql'),'utf8');

test('P1 migration is additive and mirrored',()=>{
  assert.equal(fs.existsSync(path.join(root,'db/migrations/017_p1_data_model_normalization.sql')),true);
  assert.match(sql,/create table if not exists public\.thinkforge_solutions/);
  assert.match(sql,/create table if not exists public\.thinkforge_contradictions/);
  assert.match(sql,/create table if not exists public\.thinkforge_domain_events/);
});

test('P1 normalizes discovery reasoning objects',()=>{
  assert.match(sql,/thinkforge_research_sessions/);
  assert.match(sql,/thinkforge_research_participants/);
  assert.match(sql,/thinkforge_research_observations/);
  assert.match(sql,/thinkforge_research_themes/);
  assert.match(sql,/thinkforge_solutions/);
  assert.match(sql,/assumption_type/);
  assert.match(sql,/leap_of_faith/);
});

test('P1 adds decision rigor fields',()=>{
  assert.match(sql,/thinkforge_decision_contexts/);
  assert.match(sql,/decision_tier smallint/);
  assert.match(sql,/thinkforge_decision_participants/);
  assert.match(sql,/thinkforge_contradictions/);
});

test('P1 preserves outcome provenance and event history',()=>{
  assert.match(sql,/measurement_source text/);
  assert.match(sql,/verification_status text/);
  assert.match(sql,/thinkforge_domain_events/);
  assert.match(sql,/thinkforge_discovery_lineage_v1/);
});

test('P1 protects cross-tenant links',()=>{
  assert.match(sql,/thinkforge_guard_org_match/);
  assert.match(sql,/trg_tf_solution_org/);
  assert.match(sql,/trg_tf_observation_org/);
  assert.match(sql,/trg_tf_decision_context_org/);
});
