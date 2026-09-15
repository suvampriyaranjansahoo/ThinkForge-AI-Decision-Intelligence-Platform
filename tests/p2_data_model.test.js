'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase','migration_018_p2_canonical_data_integrity.sql'),'utf8');

test('P2 keeps all changes additive and mirrored',()=>{
  assert.match(sql,/add column if not exists/);
  assert.equal(fs.existsSync(path.join(root,'db/migrations/018_p2_canonical_data_integrity.sql')),true);
});

test('P2 enforces hierarchy and graph tenant integrity',()=>{
  for(const token of ['trg_tf_decision_hierarchy','trg_tf_outcome_hierarchy','trg_tf_claim_evidence_org','trg_tf_assumption_evidence_org','trg_tf_opportunity_evidence_org','trg_tf_solution_assumption_org','trg_tf_assumption_experiment_org','trg_tf_prediction_outcome_org','trg_tf_learning_evidence_org','trg_tf_decision_learning_org']) assert.match(sql,new RegExp(token));
});

test('P2 protects immutable decision evidence',()=>{
  assert.match(sql,/Locked prediction is immutable/);
  assert.match(sql,/Locked prediction cannot be unlocked/);
  assert.match(sql,/Decision snapshots are immutable/);
});

test('P2 exposes drift diagnostics',()=>{
  assert.match(sql,/thinkforge_canonical_integrity_v1/);
  assert.match(sql,/thinkforge_relationship_drift_v1/);
});

test('Discovery confidence normalization accepts both fractions and percentages',()=>{
  const {normalizeEvidence}=require('../lib/productDiscovery');
  assert.equal(normalizeEvidence({content:'x',confidence:0.8}).confidence,0.8);
  assert.equal(normalizeEvidence({content:'x',confidence:8}).confidence,0.8);
});
