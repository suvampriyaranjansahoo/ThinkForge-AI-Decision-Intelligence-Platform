'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {validateRelationships}=require('../lib/domainModel');
const {rankMetrics}=require('../lib/ragExperiment');
const {aggregateTraces}=require('../lib/llmOps');
test('Stage 2 rejects broken canonical relationships',()=>{const e=validateRelationships({evidence:[{id:'E1'}],assumptions:[{id:'A1',evidenceIds:['BAD']}],opportunities:[{id:'O1',evidenceIds:['E1']}],solutions:[{id:'S1',opportunityId:'O1',evidenceIds:['E1']} ]});assert.ok(e.some(x=>x.includes('unknown evidence BAD')))});
test('RAG metrics expose nDCG for measured gold retrieval',()=>{const m=rankMetrics(['a','b','c'],['b','c'],3);assert.ok(m.ndcg>0&&m.ndcg<=1);assert.equal(m.recall,1)});
test('LLMOps exposes operational p99/error/module telemetry',()=>{const m=aggregateTraces([{module:'reasoning',model:'m1',latencyMs:10,cost:.01,validationStatus:'passed'},{module:'reasoning',model:'m1',latencyMs:20,cost:.02,validationStatus:'failed'}]);assert.equal(m.p99LatencyMs,20);assert.equal(m.errorRate,.5);assert.equal(m.byModule[0].module,'reasoning')});
test('Stage 1/2 canonical migration is mirrored and versioned',()=>{const a=fs.readFileSync(path.join(__dirname,'..','db/migrations/027_stage1_stage2_canonical_hardening.sql'),'utf8');const b=fs.readFileSync(path.join(__dirname,'..','supabase/migration_027_stage1_stage2_canonical_hardening.sql'),'utf8');assert.equal(a,b);assert.match(a,/thinkforge_upsert_discovery_v3/);assert.match(a,/thinkforge_discovery_claims/)})


test('Stage 1 exposes independent evidence dimensions separately from quality', () => {
  const pd=require('../lib/productDiscovery');
  const d=pd.evidenceDimensions([{id:'E1',content:'User pain',sourceType:'interview',sourceId:'S1',segment:'new'},{id:'E2',content:'Usage dropped',sourceType:'analytics',sourceId:'S2',segment:'existing'},{id:'E3',content:'Survey result',sourceType:'survey',sourceId:'S3',segment:'new'}]);
  assert.equal(d.segmentCount,2); assert.equal(d.methodCount,3); assert.equal(d.independentSourceCount,3); assert.notEqual(d.breadthScore,d.quality);
});

test('Claim grounding metrics are deterministic and bounded', () => {
  const {groundingMetrics}=require('../lib/claimEvaluation');
  const m=groundingMetrics([{id:'C1',supportStatus:'SUPPORTED'},{id:'C2',supportStatus:'UNSUPPORTED'}],[{id:'C1',supportStatus:'SUPPORTED'},{id:'C2',supportStatus:'SUPPORTED'}]);
  assert.equal(m.claimCount,2); assert.equal(m.contradictionRate,0); assert.ok(m.precision>=0&&m.precision<=1); assert.ok(m.recall>=0&&m.recall<=1);
});

test('Stage 1 and Stage 2 canonical migration is additive and points to one discovery writer', () => {
  const fs=require('fs'),path=require('path'); const sql=fs.readFileSync(path.join(__dirname,'..','db/migrations/027_stage1_stage2_canonical_hardening.sql'),'utf8');
  assert.match(sql,/create or replace function public\.thinkforge_upsert_discovery_v3/); assert.match(sql,/analysis_payload.*compatibility_layer/s); assert.match(sql,/thinkforge_discovery_claims/); assert.match(sql,/thinkforge_verify_stage1_stage2_live/);
});
