'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {normalizeCanonicalGraph}=require('../lib/domainModel');
const sql=fs.readFileSync(path.join(__dirname,'..','supabase','migration_016_p0_decision_memory.sql'),'utf8');

test('P0 preserves canonical graph identity for previous stages',()=>{
  const graph=normalizeCanonicalGraph({
    decision:{id:'decision-1',title:'Pricing',problem:'Choose pricing'},
    assumptions:[{id:'assumption-1',text:'Users will pay'}],
    evidence:[{id:'evidence-1',content:'Interview evidence'}]
  });
  assert.equal(graph.decision.id,'decision-1');
  assert.equal(graph.assumptions[0].clientId,'assumption-1');
  assert.equal(graph.evidence[0].clientId,'evidence-1');
});

test('P0 schema models explicit evidence relationships and provenance',()=>{
  assert.match(sql,/create table if not exists public\.thinkforge_claims/);
  assert.match(sql,/create table if not exists public\.thinkforge_claim_evidence_links/);
  assert.match(sql,/create table if not exists public\.thinkforge_evidence_provenance/);
  assert.match(sql,/relationship text not null check\(relationship in \('supports','partially_supports','contradicts','contextualizes','insufficient'\)\)/);
});

test('P0 schema provides first-class outcome hierarchy',()=>{
  assert.match(sql,/create table if not exists public\.thinkforge_initiatives/);
  assert.match(sql,/create table if not exists public\.thinkforge_product_outcomes/);
  assert.match(sql,/primary_outcome_id uuid references public\.thinkforge_product_outcomes/);
});

test('P0 schema provides immutable decision snapshots',()=>{
  assert.match(sql,/create table if not exists public\.thinkforge_decision_snapshots/);
  assert.match(sql,/unique\(decision_id,decision_version\)/);
  assert.match(sql,/thinkforge_create_decision_snapshot_v1/);
});

test('P0 locks predictions against measured-field mutation',()=>{
  assert.match(sql,/thinkforge_guard_locked_prediction/);
  assert.match(sql,/Locked prediction is immutable/);
  assert.match(sql,/thinkforge_lock_prediction_v1/);
});
