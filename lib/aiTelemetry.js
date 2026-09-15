'use strict';
const {rest}=require('./db');
// Telemetry write failures used to vanish into an empty catch block, making
// data loss invisible. recordInteraction() must still never throw (an AI
// response must not fail because telemetry is down), but the failure is now
// counted and logged so it can be surfaced by scripts/telemetry_health_check.js
// or any future monitoring instead of disappearing silently.
let writeFailures=0;let lastFailureAt=null;let lastSuccessAt=null;
function telemetryHealth(){return{writeFailures,lastFailureAt,lastSuccessAt}}
function resetTelemetryHealth(){writeFailures=0;lastFailureAt=null;lastSuccessAt=null}
async function recordInteraction({userId,decisionId,requestId,module,meta,validationStatus='passed',failureCode=null,output=null,inputHash=null}){
  try{
    const r=await rest('thinkforge_ai_interactions','POST',{user_id:userId,decision_id:decisionId||null,request_id:requestId,module,model:meta?.model||null,prompt_version:meta?.promptVersion||null,retriever_version:meta?.retrieverVersion||null,input_tokens:Number(meta?.usage?.prompt_tokens||meta?.usage?.input_tokens||0),output_tokens:Number(meta?.usage?.completion_tokens||meta?.usage?.output_tokens||0),latency_ms:Number(meta?.latencyMs||0),cost_usd:Number(meta?.costUsd||0),validation_status:validationStatus,failure_code:failureCode,output_json:output,input_hash:inputHash||null});
    if(r&&r.ok===false){writeFailures++;lastFailureAt=new Date().toISOString();console.error(`[aiTelemetry] write rejected (request ${requestId}): HTTP ${r.status}`)}
    else{lastSuccessAt=new Date().toISOString()}
  }catch(e){writeFailures++;lastFailureAt=new Date().toISOString();console.error(`[aiTelemetry] write failed (request ${requestId}): ${e.message}`)}
}
module.exports={recordInteraction,telemetryHealth,resetTelemetryHealth};
