'use strict';
const crypto=require('node:crypto');
const {discoveryResearchPlan,buildDeepResearchReport}=require('./productDiscovery');
const {runDeepWebSweep}=require('./deepResearchWeb');
const {evaluateToolPolicy}=require('./agentPolicy');
const {transition}=require('./agentState');

const AGENT_VERSION='research-agent-v1';
const TERMINAL=new Set(['COMPLETED','NEEDS_HUMAN_REVIEW','FAILED']);
function clean(value,max=600){return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);}
function traceEntry(type,detail={}){return {at:new Date().toISOString(),type,...detail};}
function createPlan(input={}){
  const goal=clean(input.goal||input.researchQuestion);
  if(!goal)throw Object.assign(new Error('goal or researchQuestion is required'),{code:'AGENT_GOAL_REQUIRED',status:400});
  const bundle={...input,researchQuestion:input.researchQuestion||goal};
  const researchPlan=discoveryResearchPlan({question:bundle.researchQuestion,questionType:bundle.questionType,decisionImpact:bundle.decisionImpact||'medium',segments:bundle.segments||[],desiredOutcome:bundle.desiredOutcome||''});
  return {agentVersion:AGENT_VERSION,goal,researchPlan,steps:[
    {id:'plan',tool:'research_plan',purpose:'Classify the decision and select evidence sources.',risk:'none'},
    {id:'collect',tool:'deep_web_research',purpose:'Collect independent public evidence using the approved source plan.',risk:'external_paid_read'},
    {id:'synthesize',tool:'evidence_synthesis',purpose:'Deduplicate sources and surface gaps, contradictions, and next actions.',risk:'none'},
    {id:'review',tool:'human_approval',purpose:'Require a human to accept, reject, or extend the recommendation.',risk:'human_required'}
  ],approvalRequiredBefore:['deep_web_research'],limitations:['The agent cannot make product decisions, publish results, create tickets, or treat heuristic checks as proof of safety.','Public-web sources and supplied evidence can be incomplete, biased, or wrong; conclusions remain advisory.']};
}
async function runResearchAgent(input={},options={}){
  const runId=options.runId||crypto.randomUUID(),started=Date.now(),plan=createPlan(input),trace=[traceEntry('RUN_STARTED',{runId,agentVersion:AGENT_VERSION,state:'PLANNED'}),traceEntry('PLAN_CREATED',{sourceClasses:plan.researchPlan.sourceClasses,depth:plan.researchPlan.depth})],role=options.role||'editor',budget={maxToolCalls:Math.max(1,Number(input.budget?.maxToolCalls||4)),maxCostUsd:Math.max(0,Number(input.budget?.maxCostUsd||.25))};
  const supplied=Array.isArray(input.webSources)?input.webSources:(Array.isArray(input.sources)?input.sources:[]);
  if(!input.approved&&!supplied.length){const next=transition(trace,'PLANNED','AWAITING_APPROVAL');trace.push(next.entry,traceEntry('AWAITING_APPROVAL',{blockedTool:'deep_web_research',reason:'External research may use a paid third-party provider.'}));return {runId,status:'AWAITING_APPROVAL',plan,trace,budget,metrics:{durationMs:Date.now()-started,toolCalls:0,externalToolCalls:0,costUsd:0}};}
  let webSources=supplied,toolCalls=0,externalToolCalls=0,spentUsd=0,state='PLANNED';
  try{
    state='RUNNING';trace.push(traceEntry('STATE_CHANGED',{from:'PLANNED',to:'RUNNING'}));
    if(!webSources.length){const policy=evaluateToolPolicy({tool:'deep_web_research',role,approved:input.approved===true,calls:externalToolCalls,spentUsd});trace.push(traceEntry('POLICY_EVALUATED',{tool:'deep_web_research',allowed:policy.allowed,code:policy.code||null}));if(!policy.allowed)throw Object.assign(new Error(policy.reason),{code:policy.code,status:403});if(toolCalls>=budget.maxToolCalls)throw Object.assign(new Error('Agent tool-call budget exhausted'),{code:'AGENT_RUN_BUDGET_EXCEEDED'});const webResearch=options.webResearch||runDeepWebSweep;state='TOOL_CALLING';trace.push(traceEntry('STATE_CHANGED',{from:'RUNNING',to:state}),traceEntry('TOOL_STARTED',{tool:'deep_web_research'}));const sweep=await webResearch({...input,researchQuestion:input.researchQuestion||plan.goal,sourceClasses:plan.researchPlan.sourceClasses});toolCalls++;externalToolCalls++;spentUsd+=Number(sweep.costUsd||0);webSources=sweep.retained||[];state='VALIDATING';trace.push(traceEntry('TOOL_COMPLETED',{tool:'deep_web_research',retainedSources:webSources.length,errors:(sweep.errors||[]).length}),traceEntry('STATE_CHANGED',{from:'TOOL_CALLING',to:state}));}
    else trace.push(traceEntry('EVIDENCE_ACCEPTED',{tool:'supplied_evidence',sources:webSources.length}));
    if(toolCalls>=budget.maxToolCalls)throw Object.assign(new Error('Agent tool-call budget exhausted'),{code:'AGENT_RUN_BUDGET_EXCEEDED'});const synthesisPolicy=evaluateToolPolicy({tool:'evidence_synthesis',role,approved:true,calls:0});if(!synthesisPolicy.allowed)throw Object.assign(new Error(synthesisPolicy.reason),{code:synthesisPolicy.code});const report=buildDeepResearchReport({...input,researchQuestion:input.researchQuestion||plan.goal,webSources});toolCalls++;const status=report.status==='READY_FOR_SYNTHESIS'?'NEEDS_HUMAN_REVIEW':'COMPLETED';trace.push(traceEntry('SYNTHESIS_COMPLETED',{status,independentSources:report.quality?.sources?.independent||0,quality:report.quality?.score||0}),traceEntry('HUMAN_REVIEW_REQUIRED',{reason:'Recommendations are advisory and require accountable human approval.'}));return {runId,status,plan,report,trace,budget,metrics:{durationMs:Date.now()-started,toolCalls,externalToolCalls,costUsd:spentUsd,independentSources:report.quality?.sources?.independent||0,qualityScore:report.quality?.score||0}};
  }catch(error){trace.push(traceEntry('RUN_FAILED',{code:error.code||'AGENT_RUN_FAILED',message:clean(error.message,300)}));return {runId,status:'FAILED',plan,trace,budget,error:{code:error.code||'AGENT_RUN_FAILED',message:clean(error.message,300)},metrics:{durationMs:Date.now()-started,toolCalls,externalToolCalls,costUsd:spentUsd}};}
}
function validateAgentRun(run={}){return Boolean(run.runId&&run.plan?.agentVersion===AGENT_VERSION&&Array.isArray(run.trace)&&run.trace.length&&(!TERMINAL.has(run.status)||run.trace.some(x=>x.type==='HUMAN_REVIEW_REQUIRED'||x.type==='RUN_FAILED')));}
module.exports={AGENT_VERSION,createPlan,runResearchAgent,validateAgentRun};
