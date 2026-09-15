const test = require('node:test');
const assert = require('node:assert/strict');
const { schemas, validateBusinessRules } = require('../lib/contracts');

test('assumption contract rejects invalid confidence', () => {
  const r = schemas.safeParse('assumptions',{assumptions:[{text:'x',impact:5,uncertainty:5,confidence:2,status:'open'}]});
  assert.equal(r.success,false);
});

test('challenge contract requires exactly 3 challenges', () => {
  const r = schemas.safeParse('challenge',{challenges:[]});
  assert.equal(r.success,false);
});

test('challenge business rules reject unknown evidence ids', () => {
  const d={evidence:[{id:'e1'}]};
  const v={challenges:[{evidence_refs:['missing']},{evidence_refs:[]},{evidence_refs:[]}]};
  assert.deepEqual(validateBusinessRules('challenge',v,d),['Unknown evidence reference: missing']);
});
