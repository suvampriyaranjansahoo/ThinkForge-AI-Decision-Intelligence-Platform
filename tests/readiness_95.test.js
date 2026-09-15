'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {registerArtifact,selectPromotion}=require('../lib/registry');
const {transition,classify}=require('../lib/privacyLifecycle');
const {runLifecycle}=require('../lib/e2eLifecycle');
const {auditBenchmark,freezeDataset}=require('../lib/benchmarkGovernance');
const {createOutcome,linkLearning}=require('../lib/outcomeStore');
const {gate}=require('../lib/qualityGate');
test('registry requires gates before promotion',()=>{let a=registerArtifact([],{id:'m1',version:'1',type:'model'});assert.throws(()=>selectPromotion(a,{type:'model',id:'m1',version:'1',requiredGates:['eval'],gates:{}}));assert.equal(selectPromotion(a,{type:'model',id:'m1',version:'1',requiredGates:['eval'],gates:{eval:true}}).status,'production')});
test('privacy lifecycle is enforced',()=>{let r={status:'REQUESTED'};r=transition(r,'VERIFIED');r=transition(r,'DELETION_SCHEDULED');assert.throws(()=>transition(r,'EXPORT_READY'));assert.equal(classify('email x@y.com').pii,true)});
test('full lifecycle completes',()=>{const calls=[];const out=runLifecycle({createDecision:()=>({id:'d1'}),addEvidence:d=>calls.push('e'),runAI:d=>({id:'a1'}),validateAI:a=>calls.push('v'),createExperiment:d=>({id:'x1'}),recordPrediction:x=>calls.push('p'),recordOutcome:x=>calls.push('o'),readLearning:d=>'learning'});assert.equal(out.passed,true);assert.deepEqual(calls,['e','v','p','o'])});
test('benchmark governance validates frozen splits',()=>{const c=[];for(const s of ['development','validation','test']){const n=s==='test'?180:60;for(let i=0;i<n;i++)c.push({id:`${s}-${i}`,split:s,provenance:'expert-candidate',taxonomy:{domain:'x'}})}assert.equal(auditBenchmark(c).pass,true);assert.match(freezeDataset(c,'TF-v11').checksum,/^[a-f0-9]{64}$/)});
test('outcome linkage supports learning',()=>{const o=createOutcome({predictionId:'p1',actual:7});assert.equal(linkLearning({id:'p1',predicted:5,decisionId:'d1'},o).error,-2)});
test('quality gate rejects missing controls',()=>{assert.equal(gate({tests:true,syntax:true,security:true,study:true,benchmark:true}).pass,true);assert.equal(gate({tests:false}).pass,false)})
