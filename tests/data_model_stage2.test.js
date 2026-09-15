'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateCanonicalGraph,normalizeCanonicalGraph,stableId,entityVersion}=require('../lib/domainModel');

test('canonical graph requires decision and preserves stable ids',()=>{
  const bad=validateCanonicalGraph({assumptions:[]});
  assert.ok(bad.includes('decision is required'));
  const g=normalizeCanonicalGraph({decision:{id:'d-1',title:'Test',problem:'P'},assumptions:[{id:'a-1',text:'A'}]});
  assert.equal(g.decision.id,'d-1');
  assert.equal(g.assumptions[0].id,'a-1');
  assert.equal(g.assumptions[0].clientId,'a-1');
});

test('version increments monotonically and ids reject unsafe values',()=>{
  assert.equal(entityVersion(1),2);
  assert.equal(entityVersion(0),1);
  assert.match(stableId('unsafe id!','decision'),/^decision-/);
});

test('canonical graph rejects duplicate child ids',()=>{
  const issues=validateCanonicalGraph({decision:{title:'T',problem:'P'},evidence:[{id:'e1'},{id:'e1'}]});
  assert.ok(issues.some(x=>x.includes('duplicate id')));
});

test('canonical graph validates bounded collections',()=>{
  const graph={decision:{title:'T',problem:'P'},evidence:[]};
  assert.deepEqual(validateCanonicalGraph(graph),[]);
});
