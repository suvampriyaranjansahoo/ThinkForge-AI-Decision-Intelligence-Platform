'use strict';
const {requireUser,requestId}=require('../lib/auth');
const {limit}=require('../lib/rateLimit');
const {applySecurityHeaders,bodySizeOk}=require('../lib/security');
const {decisionHealth}=require('../lib/decisionHealth');
const {experimentReadiness}=require('../lib/experimentDesign');
const {summarizeClaims}=require('../lib/claimEvaluation');
const {aggregateTraces}=require('../lib/llmOps');
const {compareSystems}=require('../lib/ragExperiment');
const {validateJiraWrite}=require('../lib/jiraSafety');
const {buildInsights}=require('../lib/insightEngine');
const {buildReasoningContext,verifyClaims}=require('../lib/reasoning');
module.exports=async function(req,res){applySecurityHeaders(res);const rid=requestId(req);res.setHeader('x-request-id',rid);if(req.method!=='POST')return res.status(405).json({error:'Method not allowed',requestId:rid});if(!bodySizeOk(req))return res.status(413).json({error:'Body too large',requestId:rid});const user=await requireUser(req,res);if(!user)return;const rl=await limit(req,{scope:'quality',max:60,windowMs:60000});if(!rl.ok)return res.status(429).json({error:'Rate limited',requestId:rid});const b=req.body||{};try{switch(String(b.action||'')){
case 'decision_health': return res.status(200).json({result:decisionHealth(b.decision||{}),requestId:rid});
case 'experiment_readiness': return res.status(200).json({result:experimentReadiness(b.experiment||{}),requestId:rid});
case 'claim_summary': return res.status(200).json({result:summarizeClaims(b.claimLabels||[]),requestId:rid});
case 'llmops_summary': return res.status(200).json({result:aggregateTraces(b.traces||[]),requestId:rid});
case 'rag_compare': return res.status(200).json({result:compareSystems(b.runs||[]),requestId:rid});
case 'jira_write_check': return res.status(200).json({result:validateJiraWrite(b.input||{}),requestId:rid});
case 'insights': return res.status(200).json({result:buildInsights(b.decisions||[]),requestId:rid});
case 'reasoning_verify': { const ctx=buildReasoningContext(b.input||{}); return res.status(200).json({result:verifyClaims((b.input||{}).claims||[],ctx.evidence),requestId:rid}); }
default:return res.status(400).json({error:'Unsupported quality action',requestId:rid})}}
catch(e){return res.status(400).json({error:e.message||'Quality operation failed',code:'QUALITY_OPERATION_FAILED',requestId:rid})}};
