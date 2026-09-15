const { requireUser, requestId } = require('../lib/auth');
const { limit } = require('../lib/rateLimit');
const { callModel } = require('../lib/ai');
const { applySecurityHeaders, bodySizeOk } = require('../lib/security');
const { recordInteraction } = require('../lib/aiTelemetry');

module.exports = async function handler(req,res){
  applySecurityHeaders(res); const rid=requestId(req); res.setHeader('x-request-id',rid);
  if(!bodySizeOk(req)) return res.status(413).json({error:'Request body too large',code:'BODY_TOO_LARGE',requestId:rid});
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed',requestId:rid});
  const rl=await limit(req,{scope:'ai',max:Number(process.env.AI_RPM||30),windowMs:60_000});
  if(!rl.ok)return res.status(429).json({error:'Rate limit exceeded',code:'RATE_LIMITED',requestId:rid});
  const user=await requireUser(req,res); if(!user)return;
  const {action,decision}=req.body||{};
  if(!action||!decision) return res.status(400).json({error:'Missing action or decision',code:'INVALID_REQUEST',requestId:rid});
  try{
    const out=await callModel(action,decision,rid);
    // Best-effort telemetry; AI response must not fail because telemetry is unavailable.
    await recordInteraction({userId:user.id,decisionId:decision.id,requestId:rid,module:out.meta.module,meta:out.meta,validationStatus:'passed',output:out.data});
    return res.status(200).json({...out,userId:user.id,requestId:rid});
  }catch(e){
    const code=e.code||'AI_REQUEST_FAILED'; let status=502;if(code==='AI_NOT_CONFIGURED')status=503;if(code==='AI_INPUT_TOO_LARGE'||code==='AI_UNSUPPORTED_ACTION')status=400;if(code==='AI_CIRCUIT_OPEN')status=503;
    await recordInteraction({userId:user.id,decisionId:decision.id,requestId:rid,module:action,meta:{model:process.env.AI_MODEL||null,retrieverVersion:process.env.RETRIEVER_VERSION||null},validationStatus:'failed',failureCode:code});
    return res.status(status).json({error:e.message||'AI request failed',code,requestId:rid});
  }
};
