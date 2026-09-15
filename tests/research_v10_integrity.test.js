const test=require('node:test');
const assert=require('node:assert/strict');
const {canAnnotateInStudy,studyManifestHash}=require('../lib/researchStudy');
const manifest=require('../eval/study_manifest.json');

test('pilot and main annotation phases are explicitly gated',()=>{
  assert.equal(canAnnotateInStudy('PILOT','PILOT'),true);
  assert.equal(canAnnotateInStudy('PILOT','MAIN_ANNOTATION'),false);
  assert.equal(canAnnotateInStudy('CERTIFIED','MAIN_ANNOTATION'),true);
  assert.equal(canAnnotateInStudy('CERTIFIED','PILOT'),false);
});

test('study manifest hash is stable for identical configuration',()=>{
  const args={id:manifest.study_id,version:manifest.study_version,datasetVersion:manifest.dataset_version,rubricVersion:manifest.rubric_version,protocolVersion:manifest.protocol_version,candidateSnapshot:'pending',pilotCases:manifest.pilot_cases,mainCases:manifest.main_cases,developmentCases:manifest.development_cases,validationCases:manifest.validation_cases,lockedTestCases:manifest.locked_test_cases,minimumIndependentRaters:manifest.minimum_independent_raters,hiddenDuplicateRate:manifest.hidden_duplicate_rate};
  assert.equal(studyManifestHash(args),studyManifestHash(args));
});
