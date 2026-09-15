'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const g=require('../lib/decisionGovernance');

const strongEvidence=[
 {id:'e1',strength:'strong',reliability:'high',directness:'high',sampleAdequacy:'high',independence:'high',date:'2026-09-01'},
 {id:'e2',strength:'strong',reliability:'high',directness:'high',sampleAdequacy:'medium',independence:'high',date:'2026-08-28'},
 {id:'e3',strength:'medium',reliability:'high',directness:'medium',sampleAdequacy:'medium',independence:'high',date:'2026-07-20'}
];
const base={id:'d1',title:'Recover failed checkout',problem:'Should we redesign payment recovery?',decisionContext:{decisionRigor:'standard'},evidence:strongEvidence,assumptions:[{id:'a1',text:'Users trust recovery guidance',impact:4,uncertainty:3,status:'validated',evidenceIds:['e1']},{id:'a2',text:'Retry reduces abandonment',impact:5,uncertainty:5,status:'validated',evidenceIds:['e2']}],alternatives:[{name:'Recovery explainer'},{name:'Alternate payment method'}],experiment:{hypothesis:'Clear guidance increases retries',primary:'recovery rate'},prediction:{metric:'recovery rate',predicted:10},outcome:{actual:9},learning:'Users need reassurance.',review:{status:'approved'},workflowState:'READY_FOR_REVIEW'};

test('decision rigor policies map to progressively stronger gates',()=>{
  assert.ok(g.policyFor({decisionContext:{decisionRigor:'quick'}}).minimumEvidence < g.policyFor({decisionContext:{decisionRigor:'high_stakes'}}).minimumEvidence);
  assert.equal(g.normalizeRigor('maximum'),'high_stakes');
});
test('evidence quality is multidimensional and includes freshness',()=>{
  const q=g.evidenceQualityBreakdown(base);
  assert.equal(q.count,3); assert.ok(q.score>.7); assert.ok(q.recency>0); assert.ok(q.stalenessRisk<1);
});
test('readiness is quality-aware, not count-only',()=>{
  const d={...base,evidence:Array.from({length:4},(_,i)=>({id:'w'+i,strength:'weak',date:'2024-01-01'})),assumptions:[],alternatives:[{name:'A'},{name:'B'}]};
  const r=g.readiness(d); assert.equal(r.readyForReview,false); assert.ok(r.blockers.some(x=>x.code==='LOW_EVIDENCE_QUALITY'));
});
test('confidence and readiness remain distinct concepts',()=>{
  const low={...base,evidence:strongEvidence,workflowState:'READY_FOR_REVIEW'}; const r=g.readiness(low);
  assert.ok(r.confidence.score>=0&&r.confidence.score<=1); assert.notEqual(typeof r.readyForReview,'number');
});
test('decision health exposes evidence, assumption, contradiction, option and execution dimensions',()=>{
  const h=g.decisionHealth(base); for(const k of ['evidence','assumptions','contradictions','options','execution'])assert.ok(h[k]);
});
test('critical assumptions are identified consistently',()=>{
  assert.equal(g.isCriticalAssumption({impact:5,uncertainty:5}),true); assert.equal(g.isCriticalAssumption({impact:2,uncertainty:2}),false);
});
test('approval requires review for standard rigor',()=>{
  const x=g.approvalDecision({decision:base,role:'approver',review:{status:'approved'}});
  assert.equal(x.ok,true); assert.equal(x.snapshotRequired,true);
});
test('approval blocks without readiness',()=>{
  const x=g.approvalDecision({decision:{...base,evidence:[]},role:'approver',review:{status:'approved'}}); assert.equal(x.ok,false); assert.equal(x.code,'READINESS_BLOCKED');
});
test('role capabilities prevent AI or viewers from becoming approvers implicitly',()=>{
  assert.equal(g.can('viewer','approve'),false); assert.equal(g.can('approver','approve'),true); assert.equal(g.can('owner','manage_policy'),true);
});
test('reopen requires structured reason',()=>{
  assert.equal(g.reopenDecision({decision:base,role:'owner'}).ok,false);
  assert.equal(g.reopenDecision({decision:base,role:'owner',reason:'new_evidence'}).ok,true);
});
test('invalid reopen reason is rejected',()=>{
  const x=g.reopenDecision({decision:base,role:'owner',reason:'because'}); assert.equal(x.ok,false); assert.equal(x.code,'REOPEN_REASON_REQUIRED');
});
test('transition rules prevent arbitrary state jumps',()=>{
  assert.equal(g.canTransition('DRAFT','APPROVED'),false); assert.equal(g.canTransition('READY_FOR_REVIEW','APPROVED'),false);
});
test('transition validation enforces approval authority',()=>{
  assert.equal(g.validateTransition({from:'READY_FOR_REVIEW',to:'APPROVED',decision:base,role:'viewer'}).ok,false);
  assert.equal(g.validateTransition({from:'READY_FOR_REVIEW',to:'APPROVED',decision:base,role:'approver'}).ok,false); assert.equal(g.validateTransition({from:'READY_FOR_REVIEW',to:'APPROVED',decision:base,role:'approver'}).code,'APPROVAL_ROUTE_REQUIRED');
});
test('transition validation requires outcome and learning before learned',()=>{
  const x=g.validateTransition({from:'OBSERVING',to:'LEARNED',decision:{...base,outcome:{actual:null},learning:''},role:'editor'}); assert.equal(x.ok,false); assert.equal(x.code,'LEARNING_INCOMPLETE');
});
test('transition validation protects expired decisions',()=>{
  const x=g.validateTransition({from:'READY_FOR_REVIEW',to:'APPROVED',decision:{...base,expiryAt:'2020-01-01T00:00:00Z'},role:'approver'}); assert.equal(x.ok,false); assert.equal(x.code,'APPROVAL_ROUTE_REQUIRED');
});
test('material change detector catches recommendation changes',()=>{
  const x=g.assessMaterialChange(base,{...base,status:'defer'}); assert.equal(x.material,true); assert.ok(x.flags.some(f=>f.type==='recommendation'));
});
test('material change detector catches confidence shifts',()=>{
  const x=g.assessMaterialChange(base,{...base,evidence:[]}); assert.equal(x.material,true); assert.ok(x.requiresReview);
});
test('snapshot diff compares core fields and collection deltas',()=>{
  const x=g.diffSnapshots(base,{...base,title:'New title',evidence:[...strongEvidence,{id:'e4',strength:'strong'}]}); assert.equal(x.changed,true); assert.ok(x.changes.some(c=>c.field==='title')); assert.ok(x.changes.some(c=>c.field==='evidence'));
});
test('decision contract contains governance-critical fields',()=>{
  const c=g.decisionContract(base); for(const k of ['decisionId','title','workflowState','rigor','criticalAssumptions','evidence','approvalConditions','whatWouldChangeMyMind','confidence'])assert.ok(Object.hasOwn(c,k));
});
test('decision dossier packages contract, health, history and next action',()=>{
  const d=g.decisionDossier({...base,workflowHistory:[{from:'DRAFT',to:'INVESTIGATING'}]}); assert.ok(d.contract); assert.ok(d.health); assert.ok(d.nextAction); assert.equal(d.history.length,1);
});
test('high stakes policy requires stronger evidence and more options',()=>{
  const q=g.policyFor({decisionContext:{decisionRigor:'quick'}}), h=g.policyFor({decisionContext:{decisionRigor:'high_stakes'}});
  assert.ok(h.minimumEvidence>q.minimumEvidence); assert.ok(h.optionsMinimum>q.optionsMinimum); assert.ok(h.minQuality>q.minQuality);
});
test('decision conditions can be treated as first-class pending governance items',()=>{
  const r=g.readiness({...base,approvalConditions:[{metric:'recovery',status:'pending'}]}); assert.equal(r.approvalConditions.length,1);
});
test('unresolved dissent is preserved in the dossier',()=>{
  const d=g.decisionDossier({...base,dissent:[{author:'reviewer',stance:'reject',reason:'Missing segment',unresolved:true}]}); assert.equal(d.dissent.length,1);
});
test('next best action prioritizes critical assumptions',()=>{
  const d={...base,assumptions:[{text:'Critical risk',impact:5,uncertainty:5,status:'open'}]}; assert.match(g.nextBestAction(d),/Test|assumption/i);
});
test('recommendation changes are material governance events',()=>{
  const x=g.assessMaterialChange({...base,status:'build'},{...base,status:'do_not_build'}); assert.ok(x.flags.some(f=>f.type==='recommendation'));
});
test('option changes are material governance events',()=>{
  const x=g.assessMaterialChange({...base,selectedOption:'A'},{...base,selectedOption:'B'}); assert.ok(x.flags.some(f=>f.type==='selected_option'));
});
test('workflow state set is closed and archive is terminal',()=>{
  assert.equal(g.WORKFLOW_STATES.length,8); assert.deepEqual(g.TRANSITIONS.ARCHIVED,[]);
});
test('AI governance never includes approve capability for generic AI',()=>{
  assert.equal(g.can('ai','approve'),false); assert.equal(g.can('viewer','approve'),false);
});
test('governance model returns a usable expiry for policy',()=>{
  const r=g.readiness(base); assert.ok(Date.parse(r.expiresAt)>Date.now());
});
test('material change types cover core decision dimensions',()=>{
  for(const x of ['confidence','readiness','critical_assumption','contradiction','recommendation','selected_option','evidence_quality','evidence_coverage','approval_condition'])assert.ok(g.MATERIAL_CHANGE_TYPES.includes(x));
});
