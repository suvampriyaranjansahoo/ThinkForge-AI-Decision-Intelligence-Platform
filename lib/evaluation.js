'use strict';
const {brierScore,expectedCalibrationError,calibrationBuckets,mae,rmse,meanBias,wilsonInterval,bootstrapCI}=require('./statistics');
const {scoreModule,claimGroundingScore,mean}=require('./evaluationMetrics');

function metricSummary(results){
  const executed=results.filter(r=>r.status&&r.status!=='not_run');
  const contracts=executed.filter(r=>r.status==='passed_contract').length;
  const qualityRows=results.flatMap(r=>Object.values(r.scores||{}).filter(v=>typeof v==='number'&&Number.isFinite(v)));
  return {
    n:executed.length,
    contractPassRate:executed.length?contracts/executed.length:null,
    contractCI:executed.length?wilsonInterval(contracts,executed.length):null,
    qualityReady:Boolean(results.some(r=>r.goldValidated)),
    meanGoldMetric:qualityRows.length?mean(qualityRows):null,
    goldMetricCI:qualityRows.length?bootstrapCI(qualityRows):null
  };
}

function extractClaims(output){
  if(!output)return [];
  const claims=[];
  for(const k of ['summary','next_action']) if(typeof output[k]==='string') claims.push(output[k]);
  for(const a of output.assumptions||[]) if(a?.rationale) claims.push(a.rationale);
  for(const c of output.challenges||[]) if(c?.why) claims.push(c.why);
  for(const i of output.insights||[]) if(i?.finding) claims.push(i.finding);
  if(output.experiment){for(const k of ['hypothesis','successRule','failureRule']) if(output.experiment[k]) claims.push(output.experiment[k]);}
  return claims;
}

function scoreGold(gold,output,module,decision={}){
  if(!gold||!output)return null;
  const moduleScore=scoreModule(gold,output,module)||{};
  const s={...moduleScore};
  const evidence=decision.evidence||[];
  if(evidence.length){
    const claims=extractClaims(output);
    const g=claimGroundingScore(claims,evidence);
    s.groundingRate=g.rate;
    s.unsupportedClaimRate=g.rate===null?null:1-g.rate;
  }
  return s;
}

function flattenModuleScore(x){if(!x||typeof x!=='object')return[];const m=x.moduleScore||{};return Object.entries(m).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)).map(([,v])=>v)}

function outcomeMetrics(rows){
  const probabilistic=rows.filter(r=>Number.isFinite(Number(r.probability))&&Number.isFinite(Number(r.outcome))).map(r=>({probability:Number(r.probability),outcome:Number(r.outcome)}));
  const effects=rows.filter(r=>Number.isFinite(Number(r.predicted))&&Number.isFinite(Number(r.actual))).map(r=>({predicted:Number(r.predicted),actual:Number(r.actual)}));
  return {brier:brierScore(probabilistic),ece:expectedCalibrationError(probabilistic),calibrationBuckets:calibrationBuckets(probabilistic),mae:mae(effects),rmse:rmse(effects),meanBias:meanBias(effects)};
}
module.exports={metricSummary,scoreGold,outcomeMetrics,extractClaims,flattenModuleScore};
