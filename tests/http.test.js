'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fetchWithResilience}=require('../lib/http');
test('retries transient safe outbound requests',async()=>{let calls=0;const r=await fetchWithResilience('https://example.test',{method:'GET'},{provider:'test-retry',retries:1,fetchImpl:async()=>{calls++;return new Response('',{status:calls===1?503:200});}});assert.equal(r.status,200);assert.equal(calls,2);});
test('does not retry unsafe requests without idempotency opt-in',async()=>{let calls=0;const r=await fetchWithResilience('https://example.test',{method:'POST'},{provider:'test-unsafe',retries:2,fetchImpl:async()=>{calls++;return new Response('',{status:503});}});assert.equal(r.status,503);assert.equal(calls,1);});
