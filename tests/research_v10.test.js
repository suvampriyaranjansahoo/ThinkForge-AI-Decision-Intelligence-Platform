const test=require('node:test');
const assert=require('node:assert/strict');
const {makeStudy,transitionStudy,requireFrozenStudy}=require('../lib/researchStudy');
const {pilotSummary,canStartMainStudy}=require('../lib/annotationQualification');
const {buildAssignments}=require('../lib/annotationAssignments');
const bench=require('../eval/benchmark_300.json');

test('study lifecycle enforces freeze before annotation',()=>{
 const s=makeStudy({id:'HG-V10'});
 assert.equal(transitionStudy('DRAFT','REGISTERED'),'REGISTERED');
 assert.throws(()=>requireFrozenStudy({...s,status:'MAIN_ANNOTATION'}),/must be frozen/);
 assert.doesNotThrow(()=>requireFrozenStudy({...s,status:'CANDIDATES_FROZEN'}));
});

test('pilot includes attention check threshold',()=>{
 assert.equal(pilotSummary({completed:30,qualityScore:.85,hiddenDuplicateConsistency:.9,attentionCheckRate:.89}).eligibleForReview,false);
 assert.equal(pilotSummary({completed:30,qualityScore:.85,hiddenDuplicateConsistency:.9,attentionCheckRate:.95}).eligibleForReview,true);
});

test('rater cannot enter main study without certification',()=>{
 const study={id:'HG',status:'MAIN_ANNOTATION'};
 assert.equal(canStartMainStudy({studyId:'HG',state:'PILOT'},study),false);
 assert.equal(canStartMainStudy({studyId:'HG',state:'CERTIFIED'},study),true);
});

test('assignments contain pilot, main splits and hidden duplicates',()=>{
 const rows=buildAssignments(bench.cases,'r1');
 assert.equal(rows.length,315);
 assert.equal(rows.filter(x=>x.studyPhase==='PILOT').length,30);
 assert.equal(rows.filter(x=>x.isHiddenDuplicate).length,15);
 assert.equal(new Set(rows.map(x=>x.presentationId)).size,315);
});
