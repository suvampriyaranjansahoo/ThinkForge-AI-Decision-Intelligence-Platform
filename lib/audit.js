'use strict';
const {hash}=require('./security');
function nextHash(previous,event){return hash({previous_hash:previous||'',event});}
function buildEvent({userId,eventType,entityType,entityId,before=null,after=null,requestId,metadata={}}){const payload={before,after,metadata};return {user_id:userId,event_type:eventType,entity_type:entityType,entity_id:entityId||null,request_id:requestId||null,payload,previous_hash:metadata.previousHash||null,event_hash:nextHash(metadata.previousHash,payload),created_at:new Date().toISOString()};}
module.exports={buildEvent,nextHash};
