'use strict';
// Stage 12 (LLMOps/Analytics) enhancement: lib/aiTelemetry.js's recordInteraction()
// writes are best-effort and can fail silently (network blip, RLS misconfig,
// schema drift). This script queries the most recent successful telemetry row
// and flags it if the gap since that write exceeds a threshold, so telemetry
// loss becomes an observable operational signal instead of invisible data loss.
//
// This does NOT fabricate a "telemetry is healthy" claim when the table is
// simply empty (e.g. a fresh environment, or zero AI traffic yet) -- that case
// is reported as BLOCKED, not PASS or FAIL, per the project's no-fabrication rule.
async function main(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key){
    console.error(JSON.stringify({status:'BLOCKED',reason:'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to query telemetry.'},null,2));
    process.exitCode=2;return;
  }
  const staleMinutes=Number(process.env.TELEMETRY_STALE_MINUTES||60);
  const endpoint=`${url.replace(/\/$/,'')}/rest/v1/thinkforge_ai_interactions?select=created_at,validation_status&order=created_at.desc&limit=1`;
  const started=Date.now();
  let res;
  try{
    res=await fetch(endpoint,{headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'}});
  }catch(e){
    console.error(JSON.stringify({status:'FAIL',reason:'Telemetry query failed to reach Supabase',error:e.message},null,2));
    process.exitCode=1;return;
  }
  let rows=[];
  try{rows=await res.json()}catch{}
  if(!res.ok){
    console.error(JSON.stringify({status:'FAIL',httpStatus:res.status,body:rows,latencyMs:Date.now()-started},null,2));
    process.exitCode=1;return;
  }
  if(!rows.length){
    console.log(JSON.stringify({status:'BLOCKED',reason:'No telemetry rows exist yet (no AI traffic recorded, or table not yet populated). Cannot claim healthy or stale without data.',latencyMs:Date.now()-started},null,2));
    process.exitCode=2;return;
  }
  const last=rows[0];
  const lastAt=new Date(last.created_at);
  const gapMinutes=(Date.now()-lastAt.getTime())/60000;
  const stale=gapMinutes>staleMinutes;
  console.log(JSON.stringify({
    status:stale?'STALE':'PASS',
    lastRecordAt:last.created_at,
    lastValidationStatus:last.validation_status,
    gapMinutes:Number(gapMinutes.toFixed(1)),
    staleThresholdMinutes:staleMinutes,
    latencyMs:Date.now()-started
  },null,2));
  if(stale)process.exitCode=1;
}
main().catch(err=>{
  console.error(JSON.stringify({status:'FAIL',error:err.message,code:err.code||'TELEMETRY_HEALTH_CHECK_ERROR'},null,2));
  process.exitCode=1;
});
