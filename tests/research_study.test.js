const test=require('node:test');
const assert=require('node:assert/strict');
const {transition,canAnnotate,canAnnotateInStudy,makeStudy}=require('../lib/researchStudy');
const {pilotSummary,qualify,certify}=require('../lib/annotationQualification');

test('research study state machine enforces qualification order',()=>{
  assert.equal(transition('UNTRAINED','TRAINING'),'TRAINING');
  assert.throws(()=>transition('UNTRAINED','MAIN_STUDY'),/Invalid rater state/);
  assert.equal(canAnnotate('CERTIFIED'),true);
  assert.equal(canAnnotate('PILOT'),true);
  assert.equal(canAnnotateInStudy('PILOT','PILOT'),true);
  assert.equal(canAnnotateInStudy('CERTIFIED','PILOT'),false);
  assert.equal(canAnnotateInStudy('CERTIFIED','MAIN_ANNOTATION'),true);
});

test('pilot qualification requires completion and quality',()=>{
  assert.equal(pilotSummary({completed:29,qualityScore:1,hiddenDuplicateConsistency:1}).eligibleForReview,false);
  assert.equal(pilotSummary({completed:30,qualityScore:.85,hiddenDuplicateConsistency:.9}).eligibleForReview,true);
  const q=qualify({state:'PILOT',pilot:{completed:30,qualityScore:.85,hiddenDuplicateConsistency:.9}});
  assert.equal(q.state,'QUALIFICATION_REVIEW');
  assert.equal(certify({state:q.state,reviewPassed:true}).state,'CERTIFIED');
});

test('study manifest is explicit and immutable by configuration',()=>{
  const s=makeStudy({id:'HG-TEST'});
  assert.equal(s.pilotCases,30);
  assert.equal(s.minimumIndependentRaters,2);
  assert.equal(s.blindedComparison,true);
});
