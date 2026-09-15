const test=require('node:test');
const assert=require('node:assert/strict');
const {readiness,confidenceBreakdown,validateTransition,decisionDossier}=require('../lib/decisionWorkflow');

test('Stage 4 readiness blocks a weak decision with explicit reasons',()=>{
  const r=readiness({title:'Pricing',problem:'Choose pricing',evidence:[],assumptions:[{id:'a1',text:'Customers accept price',impact:5,uncertainty:5,status:'open',leapOfFaith:true}],alternatives:[]});
  assert.equal(r.readyForReview,false);
  assert.ok(r.blockers.some(x=>x.code==='INSUFFICIENT_EVIDENCE'));
  assert.ok(r.blockers.some(x=>x.code==='CRITICAL_ASSUMPTIONS_OPEN'));
  assert.ok(r.blockers.some(x=>x.code==='NO_OPTION'));
});

test('Stage 4 readiness unlocks after evidence, assumptions, and option are present',()=>{
  const r=readiness({title:'Pricing',problem:'Choose pricing',evidence:[{id:'e1',strength:'strong',reliability:'high',directness:'high',sampleAdequacy:'high',independence:'high',date:'2026-09-01'},{id:'e2',strength:'strong',reliability:'high',directness:'high',sampleAdequacy:'high',independence:'high',date:'2026-09-01'}],assumptions:[{id:'a1',text:'Customers accept price',impact:3,uncertainty:2,status:'validated',evidenceIds:['e1']}],alternatives:[{name:'A'},{name:'B'}],experiment:{hypothesis:'Test price',primary:'conversion'}});
  assert.equal(r.readyForReview,true);
  assert.deepEqual(r.blockers,[]);
});

test('Stage 4 transitions enforce readiness and approval authority',()=>{
  const d={title:'T',problem:'P',evidence:[{id:'e1',strength:'strong',reliability:'high',directness:'high',sampleAdequacy:'high',independence:'high',date:'2026-09-01'},{id:'e2',strength:'strong',reliability:'high',directness:'high',sampleAdequacy:'high',independence:'high',date:'2026-09-01'}],assumptions:[{text:'A',impact:2,uncertainty:2,status:'validated',evidenceIds:['e1']}],alternatives:[{name:'A'},{name:'B'}],review:{status:'approved'}};
  assert.equal(validateTransition({from:'INVESTIGATING',to:'READY_FOR_REVIEW',decision:d,role:'editor'}).ok,true);
  assert.equal(validateTransition({from:'READY_FOR_REVIEW',to:'APPROVED',decision:d,role:'viewer'}).code,'APPROVAL_ROUTE_REQUIRED');
  assert.equal(validateTransition({from:'READY_FOR_REVIEW',to:'APPROVED',decision:d,role:'approver'}).code,'APPROVAL_ROUTE_REQUIRED');
});

test('Stage 4 confidence exposes its components instead of a black-box percentage',()=>{
  const c=confidenceBreakdown({evidence:[{strength:'strong'}],assumptions:[{status:'validated',impact:2,uncertainty:2}],alternatives:[{name:'A'}]});
  assert.ok(c.score>=0&&c.score<=1);
  assert.ok(Object.hasOwn(c,'evidence'));
  assert.ok(Object.hasOwn(c,'coverage'));
  assert.ok(Object.hasOwn(c,'assumptionValidation'));
});

test('Stage 4 dossier carries readiness plus a next action',()=>{
  const d=decisionDossier({title:'T',problem:'P',evidence:[{strength:'strong'},{strength:'medium'}],assumptions:[],alternatives:[{name:'A'}]});
  assert.equal(d.title,'T');
  assert.ok(d.readiness);
  assert.equal(typeof d.nextAction,'string');
});
