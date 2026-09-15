'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'eval','stage1_external_benchmark_manifest.json'),'utf8'));
const goldPath=process.env.STAGE1_GOLD_PATH||path.join(root,'eval','external_gold','stage1_gold.json');
const policy={...manifest.policy};

function fail(message,details={}){
  const status = message.includes('candidate-run') || message.includes('Candidate-run') || message.includes('Candidate run') ? 'BLOCKED_UNTIL_SEPARATE_CANDIDATE_RUN' : 'BLOCKED_UNTIL_REAL_GOLD';
  console.log(JSON.stringify({status,message,...details},null,2));
  process.exit(2);
}
if(!fs.existsSync(goldPath)) fail('No external expert/adjudicated gold file is present; empirical Stage 1 quality must not be fabricated.',{goldPath,requiredMinimumGoldCases:policy.minimumGoldCases,sources:manifest.sources});
let gold;
try{gold=JSON.parse(fs.readFileSync(goldPath,'utf8'));}catch(e){fail('Gold file is not valid JSON.',{goldPath,error:e.message});}
const cases=Array.isArray(gold.cases)?gold.cases:[];
const requiredEvaluators=Number(policy.minimumIndependentEvaluators||3);
const minimumCases=Number(policy.minimumGoldCases||100);
if(cases.length<minimumCases) fail('Insufficient gold cases for the Stage 1 empirical gate.',{goldCases:cases.length,minimum:minimumCases});
if(!gold.adjudicated || Number(gold.independentEvaluators||0)<requiredEvaluators) fail('Gold set lacks the required independent evaluation/adjudication provenance.',{adjudicated:Boolean(gold.adjudicated),independentEvaluators:Number(gold.independentEvaluators||0),minimum:requiredEvaluators});
if(gold.synthetic===true || gold.generatedByModel===true) fail('Synthetic/model-generated gold is never eligible for empirical validation.',{goldPath});
if(!gold.studyManifest?.perCaseProvenance && (!Array.isArray(gold.studyManifest?.sources) || gold.studyManifest.sources.length<Number(policy.minimumStudies||3))) fail('Gold set must preserve provenance for the required number of real source studies (or use per-case provenance with a real sourceUrl on every case).',{requiredStudies:Number(policy.minimumStudies||3)});
if(gold.studyManifest?.perCaseProvenance){const missing=gold.cases.filter(c=>!c.sourceUrl||!/^https?:\/\//.test(c.sourceUrl));if(missing.length)fail('Per-case provenance mode requires every case to carry a real sourceUrl.',{missingCount:missing.length,examples:missing.slice(0,3).map(c=>c.id)});}
if(gold.goldFrozen!==true || !gold.goldVersion || !gold.codebookVersion) fail('Gold set must be explicitly frozen with versioned provenance and a codebook version.',{goldFrozen:gold.goldFrozen===true,goldVersion:gold.goldVersion||null,codebookVersion:gold.codebookVersion||null});
if(gold.cases.some(c=>Object.prototype.hasOwnProperty.call(c,'prediction'))) fail('Empirical gold contains embedded predictions; predictions must be supplied as a separate candidate-run artifact.',{goldPath});
const predictionPath=process.env.STAGE1_PREDICTIONS_PATH||'';
if(!predictionPath) fail('A separate blinded ThinkForge candidate-run artifact is required.',{requiredEnv:'STAGE1_PREDICTIONS_PATH',goldCases:cases.length,goldVersion:gold.goldVersion});
if(!fs.existsSync(predictionPath)) fail('Candidate-run artifact does not exist.',{predictionPath});
let candidate; try{candidate=JSON.parse(fs.readFileSync(predictionPath,'utf8'));}catch(e){fail('Candidate-run artifact is not valid JSON.',{predictionPath,error:e.message});}
if(candidate.synthetic===true || candidate.generatedByModel===true) fail('Candidate-run metadata cannot be synthetic/model-generated for empirical evaluation.',{predictionPath});
if(candidate.goldVersion && candidate.goldVersion!==gold.goldVersion) fail('Candidate run is bound to a different gold version.',{goldVersion:gold.goldVersion,candidateGoldVersion:candidate.goldVersion});
if(candidate.goldDatasetHash && gold.datasetHash && candidate.goldDatasetHash!==gold.datasetHash) fail('Candidate run is bound to a different gold dataset hash.',{goldDatasetHash:gold.datasetHash,candidateGoldDatasetHash:candidate.goldDatasetHash});
const candidateRows=Array.isArray(candidate.cases)?candidate.cases:[];
const candidateById=new Map(candidateRows.map(x=>[String(x.id||x.case_id||''),x]));
if(candidateById.size!==candidateRows.length) fail('Candidate-run contains duplicate case IDs.',{predictionPath});
for(const c of gold.cases){if(!candidateById.has(String(c.id)))fail('Candidate-run is missing a gold case.',{caseId:c.id});}
if(candidateRows.some(x=>!gold.cases.some(c=>String(c.id)===String(x.id||x.case_id||'')))) fail('Candidate-run contains a case not present in frozen gold.',{predictionPath});

function setOf(xs){return new Set((xs||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean));}
function f1(p,r){if(p+r===0)return 0;return 2*p*r/(p+r);}
function prf(pred,goldSet){const predArr=[...new Set((pred||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean))];let tp=0;for(const x of predArr)if(goldSet.has(x))tp++;const p=predArr.length?tp/predArr.length:(goldSet.size?0:1);const r=goldSet.size?tp/goldSet.size:(predArr.length?0:1);return {precision:p,recall:r,f1:f1(p,r),predicted:predArr.length,gold:goldSet.size,tp};}
function percentile(sorted,p){if(!sorted.length)return 0;const idx=(sorted.length-1)*p;const lo=Math.floor(idx),hi=Math.ceil(idx);if(lo===hi)return sorted[lo];return sorted[lo]+(sorted[hi]-sorted[lo])*(idx-lo);}
function bootstrap(rows,accessor,reps=1000){if(!rows.length)return {mean:0,lower:0,upper:0};const vals=rows.map(accessor).map(Number);const rng=seededRandom(`${gold.goldVersion}:${goldPath}:${vals.length}:${accessor.toString()}`);const means=[];for(let b=0;b<reps;b++){let s=0;for(let i=0;i<vals.length;i++)s+=vals[Math.floor(rng()*vals.length)];means.push(s/vals.length);}means.sort((a,b)=>a-b);return {mean:vals.reduce((a,v)=>a+v,0)/vals.length,lower:percentile(means,.025),upper:percentile(means,.975),reps};}
function seededRandom(seed){let h=crypto.createHash('sha256').update(seed).digest();let x=h.readUInt32LE(0)>>>0;return ()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function normalizeList(v){return Array.isArray(v)?v:(v==null?[]:[v]);}
const dimensions=['evidenceIds','themes','opportunities','contradictions'];
function evaluateCase(c){
  const candidateRow=candidateById.get(String(c.id||c.case_id||''))||{}; const pred=candidateRow.prediction||candidateRow; const g=c.gold||{};
  const out={id:String(c.id||c.case_id||''),sourceStudyId:c.sourceStudyId||c.studyId||null};
  for(const d of dimensions)out[d]=prf(normalizeList(pred[d]),setOf(g[d]));
  out.abstention=Boolean(pred.shouldAbstain)===Boolean(g.shouldAbstain)?1:0;
  out.unsupportedClaimRate=Number.isFinite(Number(pred.unsupportedClaimRate))?Number(pred.unsupportedClaimRate):null;
  return out;
}
const rows=cases.map(evaluateCase);
const mean=k=>rows.length?rows.reduce((s,r)=>s+Number(r[k]||0),0)/rows.length:0;
const avgNested=k=>rows.length?rows.reduce((s,r)=>s+Number(r[k]?.f1||0),0)/rows.length:0;
const metrics={
  evidenceGroundingPrecision:rows.length?rows.reduce((s,r)=>s+r.evidenceIds.precision,0)/rows.length:0,
  evidenceGroundingRecall:rows.length?rows.reduce((s,r)=>s+r.evidenceIds.recall,0)/rows.length:0,
  evidenceGroundingF1:rows.length?rows.reduce((s,r)=>s+r.evidenceIds.f1,0)/rows.length:0,
  themeRecall:rows.length?rows.reduce((s,r)=>s+r.themes.recall,0)/rows.length:0,
  themeF1:avgNested('themes'),
  opportunityPrecision:rows.length?rows.reduce((s,r)=>s+r.opportunities.precision,0)/rows.length:0,
  opportunityRecall:rows.length?rows.reduce((s,r)=>s+r.opportunities.recall,0)/rows.length:0,
  opportunityF1:avgNested('opportunities'),
  contradictionRecall:rows.length?rows.reduce((s,r)=>s+r.contradictions.recall,0)/rows.length:0,
  contradictionF1:avgNested('contradictions'),
  abstentionCalibration:mean('abstention'),
  unsupportedClaimRate:rows.filter(r=>r.unsupportedClaimRate!==null).length?rows.filter(r=>r.unsupportedClaimRate!==null).reduce((s,r)=>s+r.unsupportedClaimRate,0)/rows.filter(r=>r.unsupportedClaimRate!==null).length:null
};
const scoring=manifest.scoring||{};
const weighted=Object.entries(scoring).reduce((s,[k,w])=>s+(metrics[k]||0)*Number(w),0);
const ci={evidenceF1:bootstrap(rows,r=>r.evidenceIds.f1),themeF1:bootstrap(rows,r=>r.themes.f1),opportunityF1:bootstrap(rows,r=>r.opportunities.f1),contradictionF1:bootstrap(rows,r=>r.contradictions.f1),abstention:bootstrap(rows,r=>r.abstention)};
const expectedThresholds=manifest.empiricalThresholds||{};
const thresholdResults=Object.entries(expectedThresholds).map(([k,t])=>({metric:k,minimum:Number(t),observed:Number(metrics[k]||0),pass:Number(metrics[k]||0)>=Number(t)}));
const requiredDimensions=manifest.requiredDimensions||dimensions;
const dimensionCoverage=Object.fromEntries(requiredDimensions.map(d=>[d,cases.filter(c=>Array.isArray(c.gold?.[d])).length]));
const allDimensionCovered=requiredDimensions.every(d=>dimensionCoverage[d]>=minimumCases);
const thresholdsPass=thresholdResults.length?thresholdResults.every(x=>x.pass):true;
const status=allDimensionCovered&&thresholdsPass?'EMPIRICALLY_VALIDATED':'EMPIRICAL_RESULT_BELOW_PRESET_THRESHOLD';
console.log(JSON.stringify({status,goldCases:cases.length,independentEvaluators:Number(gold.independentEvaluators),adjudicated:Boolean(gold.adjudicated),goldVersion:gold.goldVersion,codebookVersion:gold.codebookVersion,candidateRunId:candidate.runId||candidate.id||null,candidateDatasetHash:candidate.goldDatasetHash||null,datasetHash:gold.datasetHash||crypto.createHash('sha256').update(fs.readFileSync(goldPath)).digest('hex'),dimensionCoverage,metrics,confidenceIntervals95:ci,thresholdResults,weightedScore:Number(weighted.toFixed(4)),sourceManifestVersion:manifest.version,warning:'Empirical results are valid only for the frozen imported gold dataset, its provenance, evaluator protocol, and evaluated domains; do not generalize beyond them.'},null,2));
if(status!=='EMPIRICALLY_VALIDATED')process.exit(3);
