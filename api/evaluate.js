const fs = require('fs');
const path = require('path');
const { requireUser, requireOrganizationRole, requestId } = require('../lib/auth');
const { limit } = require('../lib/rateLimit');
const { callModel } = require('../lib/ai');
const { validateBusinessRules } = require('../lib/contracts');
const { applySecurityHeaders, bodySizeOk } = require('../lib/security');
const { scoreGold } = require('../lib/evaluation');
const { aggregateTraces } = require('../lib/llmOps');

const benchmarkPath = path.join(__dirname, '..', 'eval', 'benchmark_300.json');
const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

function publicCases(cases){
  return cases.map(c => ({
    id:c.id, module:c.module, difficulty:c.difficulty,
    annotation_status:c.annotation_status,
    is_expert_labeled:Boolean(c.provenance?.is_expert_labeled)
  }));
}

// Stage 11 enhancement: a real per-module breakdown of the single aggregate
// contractPassRate that was already being computed. Nothing here is inferred
// or fabricated - it is the same executed results, just grouped by module so
// a weak module can't hide inside a healthy-looking overall average.
function byModuleBreakdown(results){
  const modules=[...new Set(results.map(r=>r.module))];
  return modules.map(module=>{
    const rs=results.filter(r=>r.module===module);
    const passed=rs.filter(r=>r.status==='passed_contract').length;
    return {module, executedCases:rs.length, passedCases:passed, contractPassRate:rs.length?passed/rs.length:null};
  });
}

function offlineResponse(cases){
  return cases.map(c=>({
    id:c.id,module:c.module,status:'not_run',annotation_status:c.annotation_status,
    reason:'Offline mode does not fabricate AI quality scores or ground-truth labels.'
  }));
}

module.exports=async function handler(req,res){
  applySecurityHeaders(res); const rid=requestId(req);res.setHeader('x-request-id',rid);
  if(!bodySizeOk(req))return res.status(413).json({error:'Request body too large',code:'BODY_TOO_LARGE',requestId:rid});
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed',requestId:rid});
  const body=req.body||{};
  const mode=body.mode||'offline';
  const requestedLimit=Math.max(1,Math.min(Number(body.limit||process.env.EVAL_LIMIT||300),300));
  const moduleFilter=body.module;
  let cases=benchmark.cases.filter(c=>!moduleFilter||c.module===moduleFilter).slice(0,requestedLimit);

  if(mode==='offline'){
    return res.status(200).json({
      datasetVersion:benchmark.version,
      totalCases:cases.length,
      cases:publicCases(cases),
      results:offlineResponse(cases),
      qualityScore:null,
      note:'No research-quality score is reported without running the actual AI against expert-validated gold labels.'
    });
  }

  const user=await requireUser(req,res);if(!user)return;
  // Live mode runs real, paid model calls against the full gold benchmark and exposes its
  // composition (publicCases). That's an internal research/ops action, not a customer-facing
  // feature, so it now requires the caller to name an organization where they hold at least
  // admin - not just "any authenticated user" as before. It also gets its own tighter budget
  // (evaluate-live, 3/min) separate from the general 'evaluate' scope, since each call can run
  // up to 300 model calls.
  const organizationId=String(body.organizationId||'').trim();
  if(!organizationId)return res.status(400).json({error:'organizationId required for live evaluation runs',code:'ORGANIZATION_REQUIRED',requestId:rid});
  try{await requireOrganizationRole(user.id,organizationId,'admin');}catch(e){return res.status(e.status||403).json({error:e.message||'Admin role required for live evaluation',code:e.code||'FORBIDDEN',requestId:rid});}
  const rl=await limit(req,{scope:'evaluate-live',max:3,windowMs:60_000});
  if(!rl.ok)return res.status(429).json({error:'Rate limit exceeded',code:'RATE_LIMITED',requestId:rid});

  const results=[];
  const traces=[];
  for(const c of cases){
    try{
      const out=await callModel(c.module,c.decision,`${rid}:${c.id}`);
      const businessErrors=validateBusinessRules(c.module,out.data,c.decision);
      const goldValidated=c.annotation_status==='gold'&&c.provenance?.is_expert_labeled===true&&c.gold;
      const goldScores=goldValidated?scoreGold(c.gold,out.data,c.module):null;
      const status=businessErrors.length?'failed_business_rule':'passed_contract';
      results.push({
        id:c.id,module:c.module,status,
        businessErrors,meta:out.meta,
        expertLabeled:Boolean(c.provenance?.is_expert_labeled),
        annotationStatus:c.annotation_status, goldValidated:Boolean(goldValidated), goldScores
      });
      traces.push({
        requestId:out.meta.requestId, module:out.meta.module, model:out.meta.model,
        promptVersion:out.meta.promptVersion, retrieverVersion:out.meta.retrieverVersion,
        tokensIn:Number(out.meta.usage?.prompt_tokens||out.meta.usage?.input_tokens||0),
        tokensOut:Number(out.meta.usage?.completion_tokens||out.meta.usage?.output_tokens||0),
        latencyMs:out.meta.latencyMs, cost:out.meta.costUsd,
        validationStatus:status==='passed_contract'?'passed':'failed'
      });
    }catch(e){
      results.push({id:c.id,module:c.module,status:'failed_execution',error:e.message,expertLabeled:false,annotationStatus:c.annotation_status});
    }
  }
  const passed=results.filter(x=>x.status==='passed_contract').length;
  const executed=results.length;
  const expertGold=cases.filter(c=>c.annotation_status==='gold'&&c.provenance?.is_expert_labeled).length;
  return res.status(200).json({
    datasetVersion:benchmark.version,
    totalCases:cases.length,
    executedCases:executed,
    contractPassRate:executed?passed/executed:null,
    contractPassRateByModule:byModuleBreakdown(results),
    expertGoldCases:expertGold,
    researchQualityScore:null,
    researchQualityClaimAllowed:false,
    // Same telemetry aggregation Stage 12 uses (lib/llmOps.js), applied to this
    // run's own per-case meta - real cost/latency data already produced by
    // callModel, not a new source of numbers.
    runTelemetry:aggregateTraces(traces),
    results,
    runAt:new Date().toISOString(),
    requestId:rid
  });
};
