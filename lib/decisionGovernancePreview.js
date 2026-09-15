'use strict';

/** Stage 4 — NON-AUTHORITATIVE preview policy.
 * Used only for offline UI previews, diffing and tests. The production
 * governance authority is the versioned PostgreSQL RPC policy.
 */

const WORKFLOW_STATES = Object.freeze(['DRAFT','INVESTIGATING','READY_FOR_REVIEW','APPROVED','EXECUTING','OBSERVING','LEARNED','ARCHIVED']);
const TRANSITIONS = Object.freeze({
  DRAFT:['INVESTIGATING','ARCHIVED'],
  INVESTIGATING:['READY_FOR_REVIEW','DRAFT','ARCHIVED'],
  READY_FOR_REVIEW:['INVESTIGATING','ARCHIVED'],
  APPROVED:['EXECUTING','OBSERVING','INVESTIGATING'],
  EXECUTING:['OBSERVING','INVESTIGATING'],
  OBSERVING:['LEARNED','INVESTIGATING'],
  LEARNED:['ARCHIVED','INVESTIGATING'],
  ARCHIVED:[]
});
const RIGOR_POLICIES = Object.freeze({
  quick:{minimumEvidence:1,minQuality:.55,minSegmentCoverage:.25,criticalAssumptionsMustBeValidated:false,highContradictionsBlock:false,optionsMinimum:1,reviewRequired:false,expiryDays:90},
  standard:{minimumEvidence:2,minQuality:.65,minSegmentCoverage:.50,criticalAssumptionsMustBeValidated:true,highContradictionsBlock:true,optionsMinimum:2,reviewRequired:true,expiryDays:180},
  significant:{minimumEvidence:3,minQuality:.75,minSegmentCoverage:.65,criticalAssumptionsMustBeValidated:true,highContradictionsBlock:true,optionsMinimum:2,reviewRequired:true,expiryDays:120},
  high_stakes:{minimumEvidence:4,minQuality:.85,minSegmentCoverage:.80,criticalAssumptionsMustBeValidated:true,highContradictionsBlock:true,optionsMinimum:3,reviewRequired:true,expiryDays:90}
});
const DECISION_RIGOR_ALIASES=Object.freeze({minimal:'quick',moderate:'standard',high:'significant',maximum:'high_stakes'});
const ROLE_CAPABILITIES=Object.freeze({
  owner:['view','comment','edit','submit_review','approve','reopen','archive','manage_policy','manage_reviewers'],
  admin:['view','comment','edit','submit_review','approve','reopen','archive','manage_policy','manage_reviewers'],
  editor:['view','comment','edit','submit_review','reopen'],
  reviewer:['view','comment','review','request_changes'],
  approver:['view','comment','review','approve','request_changes'],
  contributor:['view','comment','edit'],
  observer:['view','comment'],
  viewer:['view','comment']
});
const REOPEN_REASONS=Object.freeze(['new_evidence','assumption_invalidated','outcome_changed','stakeholder_change','external_condition','policy_change','data_correction','implementation_change','other']);
const MATERIAL_CHANGE_TYPES=Object.freeze(['confidence','readiness','critical_assumption','contradiction','recommendation','selected_option','evidence_quality','evidence_coverage','approval_condition']);

function arr(v){return Array.isArray(v)?v:[]}
function str(v){return String(v??'').trim()}
function lower(v){return str(v).toLowerCase()}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,v))}
function bool(v){return v===true||v==='true'||v===1||v==='1'}
function uniq(a){return [...new Set(arr(a).filter(Boolean))]}
function daysFromNow(days){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString()}

function normalizeRigor(v){const x=lower(v);return DECISION_RIGOR_ALIASES[x]||(['quick','standard','significant','high_stakes'].includes(x)?x:'standard')}
function policyFor(d={}){
  const ctx=d.decisionContext||d.contextModel||{};
  const rigor=normalizeRigor(ctx.decisionRigor||ctx.decision_rigor||ctx.requiredEvidenceLevel||ctx.required_evidence_level);
  return {rigor,...RIGOR_POLICIES[rigor]};
}
function assumptionPriority(a={}){return clamp(num(a.impact,num(a.importance,0))*num(a.uncertainty,0)/25,0,1)*25}
function isCriticalAssumption(a={}){return bool(a.leapOfFaith)||bool(a.leap_of_faith)||num(a.criticality,0)>=.75||assumptionPriority(a)>=16}
function isValidated(a={}){return ['validated','supported'].includes(lower(a.status))}
function evidenceDimension(e={},name,fallback=.5){
  const key=name.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
  const raw=e[name]??e[key];
  if(raw==null)return fallback;
  if(typeof raw==='number')return clamp(raw>1?raw/5:raw);
  const map={high:1,strong:1,medium:.65,moderate:.65,low:.35,weak:.25,unknown:.2};
  return map[lower(raw)]??fallback;
}
function evidenceQualityBreakdown(d={}){
  const es=arr(d.evidence); if(!es.length)return {score:0,count:0,directness:0,reliability:0,recency:0,adequacy:0,independence:0,segmentCoverage:0,stalenessRisk:1};
  const avg=(field,fallback=.5)=>es.reduce((s,e)=>s+evidenceDimension(e,field,fallback),0)/es.length;
  const recencyVals=es.map(e=>{if(e.date||e.collectedAt||e.collected_at){const dt=Date.parse(e.date||e.collectedAt||e.collected_at);if(Number.isFinite(dt)){const age=(Date.now()-dt)/(86400000);return clamp(1-age/365)}}return .5});
  const recency=recencyVals.reduce((a,b)=>a+b,0)/recencyVals.length;
  const directness=avg('directness',.55), reliability=avg('reliability',.60), adequacy=avg('sampleAdequacy',.55), independence=avg('independence',.65);
  const segmentCoverage=arr(d.segments).length?clamp(uniq(es.map(e=>e.segment||e.targetSegment||e.segmentId)).length/Math.max(1,arr(d.segments).length)):.5;
  const score=clamp(.22*directness+.22*reliability+.14*recency+.14*adequacy+.14*independence+.14*segmentCoverage);
  return {score:Number(score.toFixed(3)),count:es.length,directness:Number(directness.toFixed(3)),reliability:Number(reliability.toFixed(3)),recency:Number(recency.toFixed(3)),adequacy:Number(adequacy.toFixed(3)),independence:Number(independence.toFixed(3)),segmentCoverage:Number(segmentCoverage.toFixed(3)),stalenessRisk:Number((1-recency).toFixed(3))};
}
function evidenceCoverage(d={}){
  const as=arr(d.assumptions); if(!as.length)return arr(d.evidence).length?1:0;
  const covered=as.filter(a=>arr(a.evidenceIds||a.evidence_ids).length||arr(a.evidence).length).length;
  return covered/as.length;
}
function contradictionSummary(d={}){
  const es=arr(d.evidence).filter(e=>['contradicts','contradicting'].includes(lower(e.stance)));
  const cs=arr(d.contradictions||d.contradictionRecords).filter(c=>!['resolved','accepted','dismissed'].includes(lower(c.status)));
  const high=cs.filter(c=>['high','critical'].includes(lower(c.severity))).length;
  return {total:es.length+cs.length,evidenceCount:es.length,explicitCount:cs.length,highSeverityCount:high,openCount:cs.length};
}
function criticalAssumptions(d={}){return arr(d.assumptions).filter(a=>isCriticalAssumption(a))}
function unresolvedCriticalAssumptions(d={}){return criticalAssumptions(d).filter(a=>!isValidated(a))}
function optionList(d={}){return arr(d.alternatives||d.options)}
function experimentReady(d={}){const e=d.experiment||{};return bool(str(e.hypothesis))&&bool(str(e.primary||e.primaryMetric||e.primary_metric))}
function predictionReady(d={}){return Boolean(d.prediction&&(d.prediction.predicted!==null&&d.prediction.predicted!==undefined||str(d.prediction.metric)))}
function outcomeReady(d={}){return Boolean(d.outcome&&d.outcome.actual!==null&&d.outcome.actual!==undefined)}
function learningReady(d={}){return bool(str(d.learning||d.outcome?.learning))}
function recommendation(d={}){return lower(d.status||d.recommendation||d.decisionRecommendation)}
function recommendationOptions(d={}){return uniq(optionList(d).map(x=>x.name||x.title||x.label))}
function decisionHealth(d={}){
  const q=evidenceQualityBreakdown(d),cov=evidenceCoverage(d),ca=criticalAssumptions(d),uo=unresolvedCriticalAssumptions(d),c=contradictionSummary(d),opts=optionList(d);
  return {evidence:{count:q.count,score:q.score,quality:q.score,coverage:Number(cov.toFixed(3)),freshness:q.recency,segmentCoverage:q.segmentCoverage},assumptions:{critical:ca.length,unresolvedCritical:uo.length,validationRate:ca.length?Number((ca.filter(isValidated).length/ca.length).toFixed(3)):1},contradictions:{open:c.total,highSeverity:c.highSeverityCount,penalty:Number(clamp(c.total*.08,0,.35).toFixed(3))},options:{count:opts.length,credible:opts.filter(o=>num(o.risk,0)<9).length},execution:{experimentReady:experimentReady(d),predictionReady:predictionReady(d),outcomeReady:outcomeReady(d),learningReady:learningReady(d)}};
}
function confidenceBreakdown(d={}){
  const h=decisionHealth(d), outcome=outcomeReady(d)?1:0, optionSignal=clamp(optionList(d).length/3,0,1), ass=h.assumptions.critical?1-h.assumptions.unresolvedCritical/h.assumptions.critical:.35;
  const score=clamp(.30*h.evidence.quality+.18*h.evidence.coverage+.15*h.evidence.freshness+.17*ass+.10*optionSignal+.10*outcome-h.contradictions.penalty);
  return {score:Number(score.toFixed(3)),evidenceQuality:h.evidence.quality,evidenceCoverage:h.evidence.coverage,evidenceFreshness:h.evidence.freshness,assumptionValidation:Number(ass.toFixed(3)),optionSignal:Number(optionSignal.toFixed(3)),outcomeSignal:outcome,contradictionPenalty:h.contradictions.penalty};
}
function readiness(d={}){
  const p=policyFor(d),h=decisionHealth(d),blockers=[];
  if(!str(d.title)||!str(d.problem))blockers.push({code:'MISSING_DECISION_CONTEXT',severity:'critical',label:'Define the decision question and problem.'});
  if(h.evidence.count<p.minimumEvidence)blockers.push({code:'INSUFFICIENT_EVIDENCE',severity:'critical',label:`At least ${p.minimumEvidence} evidence item${p.minimumEvidence===1?'':'s'} required for ${p.rigor} rigor.`});
  if(h.evidence.quality<p.minQuality)blockers.push({code:'LOW_EVIDENCE_QUALITY',severity:'high',label:`Evidence quality ${Math.round(h.evidence.quality*100)}% is below the ${Math.round(p.minQuality*100)}% threshold.`});
  if(h.evidence.segmentCoverage<p.minSegmentCoverage)blockers.push({code:'LOW_SEGMENT_COVERAGE',severity:'high',label:`Segment coverage ${Math.round(h.evidence.segmentCoverage*100)}% is below the ${Math.round(p.minSegmentCoverage*100)}% threshold.`});
  if(p.criticalAssumptionsMustBeValidated&&h.assumptions.unresolvedCritical>0)blockers.push({code:'CRITICAL_ASSUMPTIONS_OPEN',severity:'critical',label:`${h.assumptions.unresolvedCritical} critical assumption${h.assumptions.unresolvedCritical===1?'':'s'} unresolved.`});
  if(p.highContradictionsBlock&&h.contradictions.highSeverity>0)blockers.push({code:'HIGH_CONTRADICTION',severity:'critical',label:`${h.contradictions.highSeverity} high-severity contradiction${h.contradictions.highSeverity===1?'':'s'} unresolved.`});
  if(h.options.count<p.optionsMinimum)blockers.push({code:'INSUFFICIENT_OPTIONS',severity:'high',label:`At least ${p.optionsMinimum} credible options are required for ${p.rigor} rigor.`});
  const gateForReview=blockers.length===0;
  const next=blockers[0]?.code==='MISSING_DECISION_CONTEXT'?'Define the decision question and problem.':blockers[0]?.code==='INSUFFICIENT_EVIDENCE'?'Add direct evidence from the most relevant segment.':blockers[0]?.code==='LOW_EVIDENCE_QUALITY'?'Upgrade evidence quality or add stronger primary evidence.':blockers[0]?.code==='LOW_SEGMENT_COVERAGE'?'Collect evidence from the under-covered segment.':blockers[0]?.code==='CRITICAL_ASSUMPTIONS_OPEN'?'Test the highest-impact unresolved assumption.':blockers[0]?.code==='HIGH_CONTRADICTION'?'Review and resolve the highest-severity contradiction.':blockers[0]?.code==='INSUFFICIENT_OPTIONS'?'Add and compare credible alternatives.':!experimentReady(d)&&recommendation(d)?'Design the test for the largest remaining uncertainty.':experimentReady(d)&&!predictionReady(d)?'Lock the prediction before the experiment runs.':outcomeReady(d)&&!learningReady(d)?'Capture learning and update the affected assumption.':'Ready for governed review.';
  return {workflowState:d.workflowState||d.workflow_state||'DRAFT',...p,health:h,confidence:confidenceBreakdown(d),blockers,readyForReview:gateForReview,nextAction:next,approvalConditions:arr(d.approvalConditions||d.approval_conditions),reviewRequired:p.reviewRequired,expiresAt:d.expiryAt||d.expiry_at||daysFromNow(p.expiryDays)};
}
function capabilities(role){return ROLE_CAPABILITIES[lower(role)]||ROLE_CAPABILITIES.viewer}
function can(role,cap){return capabilities(role).includes(cap)}
function canTransition(from,to){return WORKFLOW_STATES.includes(to)&&(TRANSITIONS[WORKFLOW_STATES.includes(from)?from:'DRAFT']||[]).includes(to)}
function validateTransition({from='DRAFT',to,decision={},role='viewer',reason='',reopenReason=''}){
  if(from==='READY_FOR_REVIEW'&&to==='APPROVED')return {ok:false,code:'APPROVAL_ROUTE_REQUIRED',message:'Approval must use the canonical approval action after reviewer approval.'};
  if(!canTransition(from,to))return {ok:false,code:'INVALID_TRANSITION',message:`Cannot transition decision from ${from} to ${to}.`};
  const gate=readiness(decision),r=lower(role);
  if(to==='READY_FOR_REVIEW'&&!gate.readyForReview)return {ok:false,code:'READINESS_BLOCKED',message:'Decision is not ready for review.',blockers:gate.blockers};
  if(to==='APPROVED'&&!can(r,'approve'))return {ok:false,code:'APPROVER_REQUIRED',message:'Approval requires an owner, admin, or assigned approver.'};
  if(to==='APPROVED'&&gate.reviewRequired&&!hasReviewerDecision(decision))return {ok:false,code:'REVIEW_REQUIRED',message:'A designated reviewer must complete review before approval.'};
  if(to==='EXECUTING'&&!can(r,'edit'))return {ok:false,code:'EDITOR_REQUIRED',message:'Execution requires edit authority.'};
  if(to==='LEARNED'&&!(gate.hasOutcome??outcomeReady(decision))||to==='LEARNED'&&!learningReady(decision))return {ok:false,code:'LEARNING_INCOMPLETE',message:'An observed outcome and learning are required before marking the decision learned.'};
  if(to==='ARCHIVED'&&!can(r,'archive'))return {ok:false,code:'ARCHIVE_REQUIRED',message:'Archiving requires owner or admin authority.'};
  if(['INVESTIGATING'].includes(to)&&['APPROVED','EXECUTING','OBSERVING','LEARNED'].includes(from)&&!can(r,'reopen'))return {ok:false,code:'REOPEN_REQUIRED',message:'Reopening requires owner, admin, editor, or an authorized decision participant.'};
  if(['INVESTIGATING'].includes(to)&&['APPROVED','EXECUTING','OBSERVING','LEARNED'].includes(from)&&!REOPEN_REASONS.includes(lower(reopenReason)))return {ok:false,code:'REOPEN_REASON_REQUIRED',message:'A structured reopen reason is required.',allowedReasons:REOPEN_REASONS};
  if(['APPROVED','EXECUTING','OBSERVING'].includes(to)&&gate.expiresAt&&Date.parse(gate.expiresAt)<=Date.now())return {ok:false,code:'DECISION_EXPIRED',message:'Decision has expired and requires review.'};
  return {ok:true,from,to,readiness:gate};
}
function hasReviewerDecision(d={}){return Boolean(d.review||d.reviewDecision||arr(d.reviews).some(r=>['approved','pass','ready'].includes(lower(r.status||r.decision))))}
function nextBestAction(d={}){return readiness(d).nextAction}
function decisionContract(d={}){
  const r=readiness(d), h=decisionHealth(d);
  return {version:'1.0',decisionId:d.id||null,title:str(d.title),question:str(d.problem),owner:d.ownerId||d.owner_id||null,workflowState:r.workflowState,rigor:r.rigor,desiredOutcome:d.desiredOutcome||d.desired_outcome||null,selectedOption:d.selectedOption||d.selected_option||recommendation(d)||null,criticalAssumptions:unresolvedCriticalAssumptions(d).map(a=>({id:a.id,text:a.text,priority:assumptionPriority(a),confidence:num(a.confidence,.5)})),evidence:{count:h.evidence.count,quality:h.evidence.quality,coverage:h.evidence.coverage,freshness:h.evidence.freshness},contradictions:h.contradictions,approvalConditions:arr(d.approvalConditions||d.approval_conditions),whatWouldChangeMyMind:arr(d.whatWouldChangeMyMind||d.what_would_change_my_mind),expiryAt:r.expiresAt,confidence:r.confidence,snapshotBasis:{capturedAt:new Date().toISOString(),version:d.version||null}};
}
function decisionDossier(d={}){const r=readiness(d);return {contract:decisionContract(d),readiness:r,health:decisionHealth(d),confidence:r.confidence,nextAction:nextBestAction(d),roles:d.roles||{},history:arr(d.workflowHistory),dissent:arr(d.dissent),materialChanges:arr(d.materialChanges),conditions:arr(d.approvalConditions||d.approval_conditions),reviewers:arr(d.reviewers),decisionInputs:{evidence:arr(d.evidence).length,assumptions:arr(d.assumptions).length,challenges:arr(d.challenges).length,options:optionList(d).length,experiments:arr(d.experiments||(d.experiment?[d.experiment]:[])).length,predictions:d.prediction?1:arr(d.predictions).length,outcomes:d.outcome?1:arr(d.outcomes).length}}}
function assessMaterialChange(before={},after={}){
  const b=confidenceBreakdown(before),a=confidenceBreakdown(after),br=readiness(before),ar=readiness(after),flags=[];
  if(Math.abs(a.score-b.score)>=.08)flags.push({type:'confidence',before:b.score,after:a.score,severity:'high'});
  if(br.readyForReview!==ar.readyForReview)flags.push({type:'readiness',before:br.readyForReview,after:ar.readyForReview,severity:'critical'});
  if(unresolvedCriticalAssumptions(before).length!==unresolvedCriticalAssumptions(after).length)flags.push({type:'critical_assumption',before:unresolvedCriticalAssumptions(before).length,after:unresolvedCriticalAssumptions(after).length,severity:'critical'});
  if(contradictionSummary(before).highSeverityCount!==contradictionSummary(after).highSeverityCount)flags.push({type:'contradiction',before:contradictionSummary(before).highSeverityCount,after:contradictionSummary(after).highSeverityCount,severity:'critical'});
  if(recommendation(before)!==recommendation(after))flags.push({type:'recommendation',before:recommendation(before),after:recommendation(after),severity:'critical'});
  if((before.selectedOption||'')!==(after.selectedOption||''))flags.push({type:'selected_option',before:before.selectedOption||null,after:after.selectedOption||null,severity:'critical'});
  return {material:flags.length>0,flags,requiresReview:flags.some(f=>['critical','high'].includes(f.severity))};
}
function diffSnapshots(before={},after={}){
  const fields=['title','problem','status','workflowState','selectedOption','desiredOutcome','ownerId'];
  const changes=fields.filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])).map(k=>({field:k,before:before[k]??null,after:after[k]??null}));
  const collections=['assumptions','evidence','challenges','alternatives','options','experiments','predictions','outcomes','dissent','approvalConditions','whatWouldChangeMyMind'];
  for(const k of collections){const bl=arr(before[k]);const al=arr(after[k]);if(JSON.stringify(bl)!==JSON.stringify(al))changes.push({field:k,beforeCount:bl.length,afterCount:al.length,delta:al.length-bl.length});}
  const material=assessMaterialChange(before,after);return {changed:changes.length>0,changes,material};
}
function approvalDecision({decision={},role='viewer',review={},conditions=[],dissent=[]}){
  const gate=readiness(decision);
  if(!gate.readyForReview)return {ok:false,code:'READINESS_BLOCKED',blockers:gate.blockers};
  if(!can(role,'approve'))return {ok:false,code:'APPROVER_REQUIRED'};
  if(gate.reviewRequired&&!hasReviewerDecision({...decision,reviews:[review]}))return {ok:false,code:'REVIEW_REQUIRED'};
  return {ok:true,contract:decisionContract({...decision,approvalConditions:conditions,dissent}),snapshotRequired:true,lockReason:'decision_approved'};
}
function reopenDecision({decision={},role='viewer',reason}){
  if(!can(role,'reopen'))return {ok:false,code:'REOPEN_REQUIRED'};
  if(!REOPEN_REASONS.includes(lower(reason)))return {ok:false,code:'REOPEN_REASON_REQUIRED',allowedReasons:REOPEN_REASONS};
  return {ok:true,reason:lower(reason)};
}

module.exports={WORKFLOW_STATES,TRANSITIONS,RIGOR_POLICIES,REOPEN_REASONS,MATERIAL_CHANGE_TYPES,ROLE_CAPABILITIES,normalizeRigor,policyFor,assumptionPriority,isCriticalAssumption,isValidated,evidenceQualityBreakdown,evidenceCoverage,contradictionSummary,decisionHealth,confidenceBreakdown,readiness,capabilities,can,canTransition,validateTransition,decisionContract,decisionDossier,assessMaterialChange,diffSnapshots,approvalDecision,reopenDecision,nextBestAction};
