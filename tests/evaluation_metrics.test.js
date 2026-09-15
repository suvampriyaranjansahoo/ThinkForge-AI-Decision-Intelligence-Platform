const test=require('node:test');const assert=require('node:assert/strict');const {bootstrapCI,scoreModule}=require('../lib/evaluationMetrics');
test('bootstrap CI contains estimate',()=>{const x=bootstrapCI([1,1,0,1,0,1]);assert.ok(x.lower<=x.estimate&&x.estimate<=x.upper)});
test('module scoring is bounded',()=>{const s=scoreModule({assumptions:[{text:'foo'}]},{assumptions:[{text:'foo'}]},'assumptions');assert.equal(s.f1,1)});
