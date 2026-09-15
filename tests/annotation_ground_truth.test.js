const test=require('node:test');
const assert=require('node:assert/strict');
const {buildAssignments}=require('../lib/annotationAssignments');
const bench=require('../eval/benchmark_300.json');

test('annotation assignments are deterministic per rater',()=>{
  const a=buildAssignments(bench.cases,'rater-a');
  const b=buildAssignments(bench.cases,'rater-a');
  assert.deepEqual(a,b);
});

test('annotation assignments add hidden duplicates without changing source case set',()=>{
  const a=buildAssignments(bench.cases,'rater-b');
  assert.equal(a.length,315);
  assert.equal(a.filter(x=>x.isHiddenDuplicate).length,15);
  assert.equal(new Set(a.map(x=>x.sourceCaseId)).size,300);
  assert.equal(new Set(a.map(x=>x.presentationId)).size,315);
});

test('different raters receive different deterministic presentation orders',()=>{
  const a=buildAssignments(bench.cases,'rater-a').map(x=>x.presentationId);
  const b=buildAssignments(bench.cases,'rater-b').map(x=>x.presentationId);
  assert.notDeepEqual(a,b);
});
