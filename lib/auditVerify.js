'use strict';
const crypto=require('node:crypto');
function eventHash(previousHash,eventPayload,requestId=''){return crypto.createHash('sha256').update(String(previousHash||'')+String(eventPayload||'')+String(requestId||'')).digest('hex')}
function verifyChain(events=[]){let previous='';const failures=[];for(let i=0;i<events.length;i++){const e=events[i];if((e.previous_hash||'')!==previous)failures.push({index:i,reason:'previous_hash_mismatch'});const expected=eventHash(previous,JSON.stringify(e.payload??{}),e.request_id||'');
  // A record with no event_hash at all must fail, not silently pass: for a tamper-evident
  // chain, "the integrity hash is missing" is precisely the anomaly this function exists to catch.
  // Previously `if(e.event_hash && ...)` skipped verification entirely when the field was absent.
  if(!e.event_hash)failures.push({index:i,reason:'missing_event_hash'});
  else if(e.event_hash!==expected)failures.push({index:i,reason:'event_hash_mismatch'});
  previous=e.event_hash||expected;}return {ok:failures.length===0,events:events.length,failures};}
module.exports={eventHash,verifyChain};
