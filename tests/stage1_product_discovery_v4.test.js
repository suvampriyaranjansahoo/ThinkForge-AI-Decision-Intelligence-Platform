const test=require('node:test');
const assert=require('node:assert/strict');
const {
  discoveryBrief,scoreQuestionQuality,methodRecommendation,evidenceAtomize,
  evidenceIndependence,advancedTriangulation,segmentSynthesis,solutionQuality,
  opportunityQuality,opportunitySaturation,discoveryCoverageMatrix,
  discoveryStopCondition,discoveryNextActions,researchUpdate,analyzeDiscovery
}=require('../lib/productDiscovery');

test('discovery brief establishes outcome, segment, decision and constraints',()=>{
  const b=discoveryBrief({desiredOutcome:'increase activation',decision:{title:'Should onboarding change?'},segments:['SMB'],constraints:['8 weeks'],timeHorizon:'8 weeks'});
  assert.equal(b.outcome,'increase activation'); assert.equal(b.targetSegments[0],'SMB'); assert.equal(b.decision,'Should onboarding change?'); assert.equal(b.constraints[0],'8 weeks');
});

test('question quality is multidimensional and rewrites biased questions',()=>{
  const b=discoveryBrief({desiredOutcome:'increase activation',segments:['SMB']});
  const q=scoreQuestionQuality('Why do users abandon onboarding?',b);
  assert.ok(q.score>=.7); assert.equal(q.decision,'PASS'); assert.ok(q.dimensions.biasRisk>.8); assert.match(q.rewrite,/SMB/);
});

test('method recommendation returns primary method and alternatives',()=>{
  const r=methodRecommendation('causal',{constraints:['limited budget']});
  assert.equal(r.primary,'experiment'); assert.ok(r.alternatives.length>=2);
});

test('atomic evidence preserves provenance and epistemic level',()=>{
  const a=evidenceAtomize([{id:'E1',content:'Users struggled',sourceType:'interview',sourceId:'I1',segment:'SMB',quote:'struggled'}]);
  assert.equal(a[0].evidenceId,'E1'); assert.equal(a[0].sourceId,'I1'); assert.equal(a[1].type,'quote');
});

test('independence clusters prevent correlated sources being counted repeatedly',()=>{
  const r=evidenceIndependence([{id:'E1',content:'a',sourceType:'analytics',sourceId:'A',provenance:{datasetId:'D1'}},{id:'E2',content:'b',sourceType:'analytics',sourceId:'A',provenance:{datasetId:'D1'}},{id:'E3',content:'c',sourceType:'interview',sourceId:'I1'}]);
  assert.equal(r.independentUnits,2);
});

test('advanced triangulation includes independence and quality',()=>{
  const r=advancedTriangulation([{id:'E1',content:'x',sourceType:'interview',sourceId:'I1',segment:'SMB'},{id:'E2',content:'x',sourceType:'analytics',sourceId:'A1',segment:'SMB'},{id:'E3',content:'x',sourceType:'support',sourceId:'S1',segment:'ENT'}]);
  assert.ok(r.independentUnits>=3); assert.ok(r.confidence>0); assert.ok(r.independence>=.5);
});

test('segment synthesis exposes per-segment evidence and methods',()=>{
  const r=segmentSynthesis([{id:'E1',content:'friction',sourceType:'interview',segment:'SMB'},{id:'E2',content:'friction',sourceType:'analytics',segment:'ENT'}],[]);
  assert.equal(r.length,2); assert.ok(r.some(x=>x.segment==='SMB'&&x.methodCount===1));
});

test('solution quality flags feature-shaped ideas',()=>{
  const r=solutionQuality({opportunityId:'O1',title:'Build a dashboard',description:'Add a feature'});
  assert.equal(r.solutionShaped,true); assert.equal(r.issue,'contains_solution_or_feature_language');
});

test('opportunity quality exposes evidence and contradiction penalties',()=>{
  const ev=new Map([['E1',{quality:.9}],['E2',{quality:.8}]]);
  const r=opportunityQuality({id:'O1',label:'Reduce setup friction',evidenceIds:['E1','E2'],themeSupport:.8},ev,[{evidenceA:'E1',evidenceB:'E9'}],[{severity:'medium'}]);
  assert.ok(r.score>0); assert.equal(r.evidenceCount,2); assert.equal(r.contradictionCount,1);
});

test('opportunity saturation distinguishes reinforcement from new signals',()=>{
  const r=opportunitySaturation([{id:'E1',content:'setup friction during onboarding'}],[{id:'O1',label:'setup friction'}]);
  assert.equal(r[0].status,'REINFORCES');
});

test('coverage matrix is segment-aware',()=>{
  const r=discoveryCoverageMatrix([{id:'E1',content:'users',sourceType:'interview',segment:'SMB'}],['SMB'],['direct user language']);
  assert.equal(r[0].segment,'SMB'); assert.equal(r[0].evidenceCount,1); assert.equal(r[0].requirements.length,1);
});

test('stop condition only becomes ready when critical uncertainty is resolved',()=>{
  const blocked=discoveryStopCondition({questionQuality:{score:.9},triangulation:{confidence:.8},opportunities:[{confidence:.8,quality:{score:.8}}],contradictions:[{severity:'high'}],evidenceGaps:[],assumptions:[]});
  assert.equal(blocked.status,'CONTINUE_LEARNING');
  const ready=discoveryStopCondition({questionQuality:{score:.9},triangulation:{confidence:.8},opportunities:[{confidence:.8,quality:{score:.8}}],contradictions:[],evidenceGaps:[],assumptions:[]});
  assert.equal(ready.status,'STOP_READY');
});

test('next actions prioritize question, contradictions, gaps and risky assumptions',()=>{
  const r=discoveryNextActions({questionQuality:{score:.5,decision:'BLOCK'},contradictions:[{id:'C1',severity:'high'}],evidenceGaps:[{requirement:'counterfactual',severity:'high'}],triangulation:{confidence:.2},opportunities:[{id:'O1',score:8}],assumptions:[{id:'A1',importance:10,uncertainty:10,evidenceStrength:0,costOfError:10}]});
  assert.equal(r[0].priority,'P0'); assert.ok(r.length>=3);
});

test('research update is additive and surfaces opportunity reinforcement',()=>{
  const r=researchUpdate({evidence:[{id:'E0',content:'old',sourceType:'interview'}],opportunities:[{id:'O1',label:'setup friction'}]},[{id:'E1',content:'setup friction',sourceType:'interview'}]);
  assert.equal(r.evidence.length,2); assert.deepEqual(r.delta.reinforcedOpportunities,['O1']);
});

test('analyzeDiscovery exposes the complete Stage 1 v4 discovery layer',()=>{
  const r=analyzeDiscovery({id:'D1',desiredOutcome:'increase activation',researchQuestion:'Why do users abandon onboarding?',segments:['SMB','ENT'],method:'interview',evidence:[
    {id:'E1',content:'Users find setup confusing.',sourceType:'interview',sourceId:'I1',segment:'SMB',participantId:'P1',quote:'confusing'},
    {id:'E2',content:'Users abandon at setup.',sourceType:'analytics',sourceId:'A1',segment:'SMB'},
    {id:'E3',content:'Enterprise users complete setup.',sourceType:'usability_test',sourceId:'U1',segment:'ENT'}
  ]});
  assert.ok(r.discoveryBrief); assert.ok(r.questionQuality); assert.ok(r.atomicEvidence.length); assert.ok(r.segmentInsights.length); assert.ok(r.coverageMatrix.length); assert.ok(r.confidenceDecomposition); assert.ok(r.stopCondition); assert.ok(r.nextActions); assert.equal(r.researchLoop.cadence,'continuous');
});
