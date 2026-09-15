const test=require('node:test');
const assert=require('node:assert/strict');
const {allocateCounts,buildCaseSplits,buildRaterAssignments,buildStudyManifest,validateRealCase}=require('../lib/externalGoldStudy');

function cases(n=100){return Array.from({length:n},(_,i)=>({
  id:`CASE_${String(i+1).padStart(3,'0')}`,
  sourceStudyId:`S${(i%3)+1}`,
  sourceProvenance:`public-study:S${(i%3)+1}:case:${i+1}`,
  synthetic:false,
  generatedByModel:false,
  input:{prompt:`Real human research material placeholder ${i+1}`}
}));}

test('external study uses >=50% locked test and exactly 25 pilot cases for a 100-case minimum',()=>{
  const out=buildRaterAssignments(cases(),['r1','r2','r3']);
  assert.deepEqual(out.splitCounts,{development:20,validation:20,locked_test:60});
  assert.equal(out.policy.pilotCases,25);
  assert.equal(out.policy.lockedTestFraction,0.6);
  assert.equal(out.policy.candidateOutputVisibleDuringGoldCreation,false);
  for(const r of out.raters) assert.equal(out.assignments[r].length,100);
});

test('all raters receive the same real cases independently and no gold/candidate leakage is enabled',()=>{
  const out=buildRaterAssignments(cases(),['r1','r2','r3']);
  const ids=Object.fromEntries(out.raters.map(r=>[r,out.assignments[r].map(x=>x.caseId)]));
  assert.deepEqual(ids.r1,ids.r2);
  assert.deepEqual(ids.r2,ids.r3);
  for(const r of out.raters) for(const a of out.assignments[r]){
    assert.equal(a.goldVisible,false);
    assert.equal(a.candidateOutputVisible,false);
  }
});

test('real study manifest rejects synthetic/model-generated or missing-provenance cases',()=>{
  const bad=cases();
  bad[0].generatedByModel=true;
  assert.match(validateRealCase(bad[0],0).join('\n'),/model-generated/i);
  const manifest=buildStudyManifest({
    studyId:'s1',codebookVersion:'c1',sources:[
      {id:'S1',title:'A',url:'https://example.org/a',realHumanData:true,provenance:'p'},
      {id:'S2',title:'B',url:'https://example.org/b',realHumanData:true,provenance:'p'},
      {id:'S3',title:'C',url:'https://example.org/c',realHumanData:true,provenance:'p'}
    ],cases:bad,raterIds:['r1','r2','r3']
  });
  assert.equal(manifest.valid,false);
  assert.ok(manifest.errors.some(x=>/model-generated/i.test(x)));
});

test('split allocator preserves every case exactly once',()=>{
  const c=cases(150);
  const {counts,assignments}=buildCaseSplits(c,{seed:'fixed'});
  assert.equal(counts.development,30);
  assert.equal(counts.validation,30);
  assert.equal(counts.locked_test,90);
  assert.equal(new Set(assignments.map(x=>x.caseId)).size,150);
  assert.equal(assignments.filter(x=>x.split==='locked_test').length,90);
});
