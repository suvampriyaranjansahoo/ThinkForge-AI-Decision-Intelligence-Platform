'use strict';

function issue(path, message, code='invalid') { return { path, message, code }; }
const has = (v) => typeof v !== 'undefined' && v !== null;
const str = (v,min=0,max=Infinity) => typeof v === 'string' && v.length >= min && v.length <= max;
const num = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const int = (v,min,max) => Number.isInteger(v) && v >= min && v <= max;
const arr = (v,min=0,max=Infinity) => Array.isArray(v) && v.length >= min && v.length <= max;
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const enumv = (v, values) => values.includes(v);
const {validateSemanticDiscovery} = require('./discoveryContracts');

const ACTIONS = ['assumptions','challenge','experiment','synthesize','prd','insights','reasoning','discovery_semantic'];
const STATUS = ['open','validated','invalidated','superseded'];

function validate(action, value) {
  const e=[];
  if (!obj(value)) return [issue([], 'Response must be an object','type_error')];
  if (!ACTIONS.includes(action)) return [issue([], `Unsupported action: ${action}`,'unsupported_action')];

  if (action==='assumptions') {
    if (!arr(value.assumptions,1,8)) e.push(issue(['assumptions'],'Must contain 1-8 assumptions'));
    for (let i=0;i<(value.assumptions||[]).length;i++) {
      const a=value.assumptions[i];
      if (!obj(a)) { e.push(issue(['assumptions',i],'Must be an object')); continue; }
      if (!str(a.id,1,120) && has(a.id)) e.push(issue(['assumptions',i,'id'],'Invalid id'));
      if (!str(a.text,3,1200)) e.push(issue(['assumptions',i,'text'],'Invalid text'));
      if (!int(a.impact,1,5)) e.push(issue(['assumptions',i,'impact'],'Impact must be 1-5'));
      if (!int(a.uncertainty,1,5)) e.push(issue(['assumptions',i,'uncertainty'],'Uncertainty must be 1-5'));
      if (!num(a.confidence,0,1)) e.push(issue(['assumptions',i,'confidence'],'Confidence must be 0-1'));
      if (!enumv(a.status,STATUS)) e.push(issue(['assumptions',i,'status'],'Invalid status'));
      if (!str(a.rationale,1,2000)) e.push(issue(['assumptions',i,'rationale'],'Rationale required'));
      if (has(a.evidence_refs) && !arr(a.evidence_refs,0,30)) e.push(issue(['assumptions',i,'evidence_refs'],'Invalid evidence refs'));
    }
  }
  if (action==='challenge') {
    if (!arr(value.challenges,3,3)) e.push(issue(['challenges'],'Exactly 3 challenges required'));
    for (let i=0;i<(value.challenges||[]).length;i++) {
      const c=value.challenges[i]; if (!obj(c)) { e.push(issue(['challenges',i],'Must be an object')); continue; }
      if (!int(c.priority,1,5)) e.push(issue(['challenges',i,'priority'],'Priority must be 1-5'));
      if (!str(c.assumption,3,1200)) e.push(issue(['challenges',i,'assumption'],'Invalid assumption'));
      if (!str(c.question,3,1600)) e.push(issue(['challenges',i,'question'],'Invalid question'));
      if (!str(c.why,3,2200)) e.push(issue(['challenges',i,'why'],'Invalid rationale'));
      if (!arr(c.evidence_refs,0,30) || c.evidence_refs.some(x=>!str(x,1,200))) e.push(issue(['challenges',i,'evidence_refs'],'Invalid evidence refs'));
    }
  }
  if (action==='experiment') {
    const x=value.experiment;
    if (!obj(x)) e.push(issue(['experiment'],'Experiment object required')); else {
      for (const k of ['hypothesis','control','intervention','primary','successRule','failureRule']) if (!str(x[k],1,2200)) e.push(issue(['experiment',k],'Required text missing'));
      for (const k of ['baseline','target','prediction']) if (has(x[k]) && !str(x[k],1,1000)) e.push(issue(['experiment',k],'Invalid text'));
      if (!arr(x.guardrails,0,20) || x.guardrails.some(g=>!str(g,1,800))) e.push(issue(['experiment','guardrails'],'Invalid guardrails'));
      if (has(x.alpha) && !num(x.alpha,0.0001,0.5)) e.push(issue(['experiment','alpha'],'Alpha must be between 0.0001 and 0.5'));
      if (has(x.power) && !num(x.power,0.5,0.999)) e.push(issue(['experiment','power'],'Power must be between 0.5 and 0.999'));
      if (has(x.mde) && !num(x.mde,0,Infinity)) e.push(issue(['experiment','mde'],'MDE must be non-negative'));
      if (has(x.sampleSize) && !int(x.sampleSize,2,100000000)) e.push(issue(['experiment','sampleSize'],'Invalid sample size'));
    }
  }
  if (action==='synthesize') {
    if (!str(value.summary,3,3000)) e.push(issue(['summary'],'Invalid summary'));
    if (!enumv(value.recommendation,['validate','build','defer','do_not_build'])) e.push(issue(['recommendation'],'Invalid recommendation'));
    if (!arr(value.evidence_gaps,0,30) || value.evidence_gaps.some(x=>!str(x,1,1000))) e.push(issue(['evidence_gaps'],'Invalid evidence gaps'));
    if (!str(value.next_action,3,1600)) e.push(issue(['next_action'],'Invalid next action'));
    if (has(value.confidence) && !num(value.confidence,0,1)) e.push(issue(['confidence'],'Confidence must be 0-1'));
  }
  if (action==='prd') {
    for (const k of ['title','problem','targetUser','decision','experiment']) if (!str(value[k],1,3000)) e.push(issue([k],'Invalid text'));
    for (const k of ['evidence','assumptions','scope','outOfScope','openQuestions']) if (!arr(value[k],0,50)) e.push(issue([k],'Invalid list'));
    if (!obj(value.metrics) || !str(value.metrics.primary,1,800) || !arr(value.metrics.secondary,0,30) || !arr(value.metrics.guardrails,0,30)) e.push(issue(['metrics'],'Invalid metrics'));
  }
  if (action==='reasoning') {
    if (!str(value.summary,3,4000)) e.push(issue(['summary'],'Invalid summary'));
    if (!arr(value.claims,1,30)) e.push(issue(['claims'],'At least 1 claim required'));
    for (let i=0;i<(value.claims||[]).length;i++) {
      const c=value.claims[i]; if (!obj(c)) { e.push(issue(['claims',i],'Must be an object')); continue; }
      if (!str(c.id,1,120)) e.push(issue(['claims',i,'id'],'Claim id required'));
      if (!str(c.text,3,2400)) e.push(issue(['claims',i,'text'],'Claim text required'));
      if (!enumv(c.supportStatus,['SUPPORTED','PARTIALLY_SUPPORTED','UNSUPPORTED','CONTRADICTED','NOT_VERIFIABLE'])) e.push(issue(['claims',i,'supportStatus'],'Invalid support status'));
      if (!arr(c.evidenceIds,0,30) || c.evidenceIds.some(x=>!str(x,1,200))) e.push(issue(['claims',i,'evidenceIds'],'Invalid evidence IDs'));
      if (!enumv(c.uncertainty,['low','medium','high'])) e.push(issue(['claims',i,'uncertainty'],'Invalid uncertainty'));
      if (!str(c.rationale,1,2500)) e.push(issue(['claims',i,'rationale'],'Rationale required'));
    }
    if (!arr(value.keyUncertainties,0,20) || value.keyUncertainties.some(x=>!str(x,1,1200))) e.push(issue(['keyUncertainties'],'Invalid uncertainty list'));
    if (!arr(value.nextTests,0,20) || value.nextTests.some(x=>!str(x,1,1600))) e.push(issue(['nextTests'],'Invalid next-test list'));
  }
  if (action==='discovery_semantic') {
    const result=validateSemanticDiscovery(value,{evidenceIds:[...evidenceIds]});
    if(!result.success) for(const x of result.error.issues) e.push(issue(x.path,x.message));
  }
  if (action==='insights') {
    if (!arr(value.insights,0,20)) e.push(issue(['insights'],'Invalid insights'));
    for (let i=0;i<(value.insights||[]).length;i++) {
      const x=value.insights[i]; if (!obj(x)) { e.push(issue(['insights',i],'Must be an object')); continue; }
      for (const k of ['title','finding','evidence','recommendation']) if (!str(x[k],1,2200)) e.push(issue(['insights',i,k],'Invalid text'));
    }
  }
  return e;
}

function validateBusinessRules(action,value,decision={}) {
  const errors=[];
  const evidence=Array.isArray(decision.evidence)?decision.evidence:[];
  const assumptions=Array.isArray(decision.assumptions)?decision.assumptions:[];
  const evidenceIds=new Set(evidence.map(e=>e?.id).filter(Boolean));
  const assumptionIds=new Set(assumptions.map(a=>a?.id).filter(Boolean));
  if (action==='challenge') {
    for (const c of value.challenges||[]) {
      for (const ref of c.evidence_refs||[]) if (evidenceIds.size && !evidenceIds.has(ref)) errors.push(`Unknown evidence reference: ${ref}`);
      if (c.assumption && assumptions.length && ![...assumptions].some(a=>a.text===c.assumption || (c.assumption===a.id))) errors.push('Challenge targets an assumption not present in decision context.');
    }
  }
  if (action==='assumptions') for (const a of value.assumptions||[]) for (const ref of (a.evidence_refs||[])) if (evidenceIds.size && !evidenceIds.has(ref)) errors.push(`Unknown evidence reference: ${ref}`);
  if (action==='experiment' && assumptions.length===0) errors.push('Experiment requires at least one decision assumption.');
  if (action==='synthesize' && evidence.length===0 && assumptions.length===0) errors.push('Synthesis requires evidence or assumptions in decision context.');
  if (action==='reasoning') {
    for (const c of value.claims||[]) {
      for (const ref of c.evidenceIds||[]) if (evidenceIds.size && !evidenceIds.has(ref)) errors.push(`Unknown evidence reference: ${ref}`);
      if (['SUPPORTED','PARTIALLY_SUPPORTED','CONTRADICTED'].includes(c.supportStatus) && !(c.evidenceIds||[]).length) errors.push('Supported/contradicted claim requires evidence.');
    }
  }
  return [...new Set(errors)];
}

function safeParse(action,value){ const issues=validate(action,value); return issues.length?{success:false,error:{issues}}:{success:true,data:value}; }
module.exports={schemas:{safeParse},validate,validateBusinessRules,ACTIONS};
