'use strict';
const {requireUser,requestId}=require('../lib/auth');
const {limit}=require('../lib/rateLimit');
const {applySecurityHeaders,bodySizeOk}=require('../lib/security');
const {rpc}=require('../lib/db');
const {validateCanonicalGraph,normalizeCanonicalGraph}=require('../lib/domainModel');

module.exports=async function(req,res){
  applySecurityHeaders(res);
  const rid=requestId(req);res.setHeader('x-request-id',rid);
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed',requestId:rid});
  if(!bodySizeOk(req))return res.status(413).json({error:'Body too large',code:'BODY_TOO_LARGE',requestId:rid});
  const user=await requireUser(req,res);if(!user)return;
  const rl=await limit(req,{scope:'domain',max:120,windowMs:60000});
  if(!rl.ok)return res.status(429).json({error:'Rate limit exceeded',code:'RATE_LIMITED',requestId:rid});
  try{
    const b=req.body||{};
    if(b.action==='save'){
      const graph=normalizeCanonicalGraph(b.graph||{});
      const issues=validateCanonicalGraph(graph);
      if(issues.length)return res.status(400).json({error:'Invalid canonical graph',code:'INVALID_DOMAIN_GRAPH',issues,requestId:rid});
      if(!b.organizationId)return res.status(400).json({error:'organizationId required',code:'ORGANIZATION_REQUIRED',requestId:rid});
      const out=await rpc('thinkforge_upsert_decision_graph_v2',{p_user_id:user.id,p_organization_id:b.organizationId,p_graph:graph,p_expected_version:b.expectedVersion||null,p_request_id:rid});
      return res.status(200).json({ok:true,...(out||{}),requestId:rid});
    }
    if(b.action==='read'){
      if(!b.organizationId||!b.decisionId)return res.status(400).json({error:'organizationId and decisionId required',code:'INVALID_REQUEST',requestId:rid});
      const out=await rpc('thinkforge_read_decision_graph_v2',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId});
      return res.status(200).json({ok:true,graph:out||null,requestId:rid});
    }
    if(b.action==='snapshot'){
      if(!b.organizationId||!b.decisionId)return res.status(400).json({error:'organizationId and decisionId required',code:'INVALID_REQUEST',requestId:rid});
      const out=await rpc('thinkforge_create_decision_snapshot_v1',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId,p_reason:String(b.reason||'decision_state_capture').slice(0,160),p_request_id:rid});
      return res.status(200).json({ok:true,snapshot:out,requestId:rid});
    }
    if(b.action==='lock_prediction'){
      if(!b.organizationId||!b.predictionId)return res.status(400).json({error:'organizationId and predictionId required',code:'INVALID_REQUEST',requestId:rid});
      const out=await rpc('thinkforge_lock_prediction_v1',{p_user_id:user.id,p_organization_id:b.organizationId,p_prediction_id:b.predictionId,p_reason:String(b.reason||'decision_prediction_lock').slice(0,160),p_request_id:rid});
      return res.status(200).json({ok:true,prediction:out,requestId:rid});
    }
    return res.status(400).json({error:'Unsupported domain action',code:'UNSUPPORTED_ACTION',requestId:rid});
  }catch(e){
    const status=e.status||((e.code==='VERSION_CONFLICT'||/version conflict/i.test(e.message||''))?409:502);
    return res.status(status).json({error:e.message||'Canonical domain operation failed',code:e.code||'DOMAIN_OPERATION_FAILED',requestId:rid});
  }
};
