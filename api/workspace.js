const { requireUser, requestId }=require('../lib/auth');
const { limit }=require('../lib/rateLimit');
const { applySecurityHeaders, bodySizeOk }=require('../lib/security');
const {saveWorkspace}=require('../lib/domainRepository');
module.exports=async function handler(req,res){
  applySecurityHeaders(res);const rid=requestId(req);res.setHeader('x-request-id',rid);
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed',requestId:rid});
  if(!bodySizeOk(req))return res.status(413).json({error:'Request body too large',code:'BODY_TOO_LARGE',requestId:rid});
  const user=await requireUser(req,res);if(!user)return;const rl=await limit(req,{scope:'workspace',max:60,windowMs:60000});if(!rl.ok)return res.status(429).json({error:'Rate limit exceeded',code:'RATE_LIMITED',requestId:rid});
  const {state,event,expectedVersion}=req.body||{};if(!state||typeof state!=='object')return res.status(400).json({error:'state object required',code:'INVALID_REQUEST',requestId:rid});
  try{
    const out=await saveWorkspace({userId:user.id,state,expectedVersion:expectedVersion||null,requestId:rid});
    return res.status(200).json({ok:true,...(out||{}),requestId:rid});
  }catch(e){return res.status(e.status===409?409:502).json({error:e.message||'Workspace persistence failed',code:e.status===409?'VERSION_CONFLICT':e.code||'DB_ERROR',requestId:rid})}
};
