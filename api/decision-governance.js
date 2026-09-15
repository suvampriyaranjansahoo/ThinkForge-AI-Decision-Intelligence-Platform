'use strict';
const {requireUser,requestId}=require('../lib/auth');
const {limit}=require('../lib/rateLimit');
const {applySecurityHeaders,bodySizeOk}=require('../lib/security');
const {rpc}=require('../lib/db');
const {diffSnapshots}=require('../lib/decisionGovernance'); // client-side preview only; never authoritative

module.exports=async function(req,res){
  applySecurityHeaders(res); const rid=requestId(req); res.setHeader('x-request-id',rid);
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed',requestId:rid});
  if(!bodySizeOk(req)) return res.status(413).json({error:'Body too large',code:'BODY_TOO_LARGE',requestId:rid});
  const user=await requireUser(req,res); if(!user)return;
  const rl=await limit(req,{scope:'decision-governance-v2',max:120,windowMs:60000}); if(!rl.ok)return res.status(429).json({error:'Rate limit exceeded',code:'RATE_LIMITED',requestId:rid});
  try{
    const b=req.body||{}; if(!b.organizationId||!b.decisionId)return res.status(400).json({error:'organizationId and decisionId required',code:'INVALID_REQUEST',requestId:rid});
    if(b.action==='policy'){
      const out=await rpc('thinkforge_decision_governance_policy_v2',{p_rigor:String(b.rigor||'standard')});
      return res.status(200).json({ok:true,policy:out,requestId:rid});
    }
    if(b.action==='readiness'){
      const out=await rpc('thinkforge_decision_readiness_v4',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId});
      return res.status(200).json({ok:true,readiness:out,requestId:rid});
    }
    if(b.action==='contract'){
      const out=await rpc('thinkforge_decision_contract_v1',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId});
      return res.status(200).json({ok:true,contract:out,requestId:rid});
    }
    if(b.action==='history'){
      const out=await rpc('thinkforge_decision_history_v1',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId});
      return res.status(200).json({ok:true,history:out||[],requestId:rid});
    }
    if(b.action==='authority'){
      const action=String(b.governanceAction||'view').trim().toLowerCase();
      const out=await rpc('thinkforge_decision_authorize_v2',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId,p_action:action});
      return res.status(200).json({ok:true,authorization:out,requestId:rid});
    }
    if(b.action==='materiality'){
      return res.status(200).json({ok:true,...diffSnapshots(b.before||{},b.after||{}),requestId:rid});
    }
    if(b.action==='review'){
      const status=String(b.status||'').trim().toLowerCase();
      if(!['in_review','approved','changes_requested','rejected'].includes(status)) return res.status(400).json({error:'Invalid review status',code:'INVALID_REVIEW_STATUS',requestId:rid});
      const out=await rpc('thinkforge_submit_decision_review_v1',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId,p_status:status,p_notes:String(b.notes||'').slice(0,2000),p_request_id:rid});
      return res.status(200).json({ok:true,...(out||{}),requestId:rid});
    }
    if(b.action==='transition'){
      if(!b.toState)return res.status(400).json({error:'toState required',code:'INVALID_REQUEST',requestId:rid});
      if(String(b.toState).toUpperCase()==='APPROVED') return res.status(409).json({error:'Approval must use the approval action after reviewer approval',code:'APPROVAL_ROUTE_REQUIRED',requestId:rid});
      const out=await rpc('thinkforge_transition_decision_v4',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId,p_to_state:String(b.toState),p_expected_state_version:b.expectedStateVersion??null,p_reason:String(b.reason||'').slice(0,500),p_reopen_reason:String(b.reopenReason||'').slice(0,80),p_request_id:rid,p_conditions:Array.isArray(b.conditions)?b.conditions:[],p_dissent:Array.isArray(b.dissent)?b.dissent:[]});
      return res.status(200).json({ok:true,...(out||{}),requestId:rid});
    }
    if(b.action==='approve'){
      // Authority + readiness are enforced by the canonical DB governance RPC.
      // Client-supplied role/decision objects are never trusted for authorization.
      const reviewId=String(b.reviewId||b.review?.reviewId||'').trim();
      if(!reviewId) return res.status(400).json({error:'reviewId is required for canonical approval',code:'REVIEW_ID_REQUIRED',requestId:rid});
      const out=await rpc('thinkforge_approve_decision_v2',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId,p_review_id:reviewId,p_conditions:Array.isArray(b.conditions)?b.conditions:[],p_dissent:Array.isArray(b.dissent)?b.dissent:[],p_request_id:rid});
      return res.status(200).json({ok:true,...(out||{}),requestId:rid});
    }
    if(b.action==='reopen'){
      const allowed=['new_evidence','assumption_invalidated','outcome_changed','stakeholder_change','external_condition','policy_change','data_correction','implementation_change','other'];
      const reasonCode=String(b.reasonCode||'').trim().toLowerCase();
      if(!allowed.includes(reasonCode)) return res.status(400).json({error:'Invalid reopen reason',code:'REOPEN_REASON_REQUIRED',allowedReasons:allowed,requestId:rid});
      // Authority is enforced by the canonical DB governance RPC.
      const out=await rpc('thinkforge_reopen_decision_v2',{p_user_id:user.id,p_organization_id:b.organizationId,p_decision_id:b.decisionId,p_reason_code:reasonCode,p_reason:String(b.reason||'').slice(0,500),p_request_id:rid});
      return res.status(200).json({ok:true,...(out||{}),requestId:rid});
    }
    return res.status(400).json({error:'Unsupported decision governance action',code:'UNSUPPORTED_ACTION',requestId:rid});
  }catch(e){
    const status=e.status||((/version conflict/i.test(e.message||'')||e.code==='40001'||e.code==='VERSION_CONFLICT')?409:((e.code==='42501'||e.code==='FORBIDDEN')?403:502));
    return res.status(status).json({error:e.message||'Decision governance operation failed',code:e.code||'DECISION_GOVERNANCE_ERROR',requestId:rid});
  }
};
