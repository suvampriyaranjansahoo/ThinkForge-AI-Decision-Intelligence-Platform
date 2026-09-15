'use strict';
let z=null;try{z=require('zod')}catch{}

const QUESTION_TYPES=['exploratory','descriptive','evaluative','causal','predictive','generative','diagnostic'];
const METHODS=['interview','contextual_inquiry','usability_test','prototype_test','survey','diary_study','behavioral_analytics','support_ticket_analysis','competitive_research','experiment'];
const CODE_TYPES=['need','pain_point','behavior','motivation','workaround','barrier','goal','quote','trust','confusion','adoption','value','risk'];
const ASSUMPTION_TYPES=['desirability','usability','feasibility','viability','ethical'];
const TRIANGULATION_STATUS=['SINGLE_METHOD','TRIANGULATED','CONVERGING'];
const SUPPORT_STATUS=['SUPPORTED','PARTIALLY_SUPPORTED','UNSUPPORTED','CONTRADICTED','NOT_VERIFIABLE'];
const RELATION_STANCE=['supports','contradicts','neutral'];
const asId=z?z.string().min(1).max(160):null;
const boundedConfidence=z?z.number().min(0).max(1):null;
const text=(min,max)=>z?z.string().min(min).max(max):null;

function manualValidate(value,{evidenceIds=[]}={}){
  const errors=[];const add=(path,message)=>errors.push({path,message});
  if(!value||typeof value!=='object'||Array.isArray(value)){return [{path:[],message:'Expected object'}]}
  const arrays=['codes','themes','claims','contradictions','opportunities','assumptions','solutions','evidenceGaps','nextActions'];
  if(!value.questionUnderstanding||typeof value.questionUnderstanding!=='object') add(['questionUnderstanding'],'Required object');
  else {
    if(!QUESTION_TYPES.includes(value.questionUnderstanding.type)) add(['questionUnderstanding','type'],'Invalid question type');
    if(!Number.isFinite(Number(value.questionUnderstanding.confidence))||Number(value.questionUnderstanding.confidence)<0||Number(value.questionUnderstanding.confidence)>1) add(['questionUnderstanding','confidence'],'Confidence must be 0-1');
    if(!['low','medium','high'].includes(value.questionUnderstanding.decisionImpact)) add(['questionUnderstanding','decisionImpact'],'Invalid decision impact');
    if(!Array.isArray(value.questionUnderstanding.evidenceRequirements)) add(['questionUnderstanding','evidenceRequirements'],'Must be an array');
  }
  if(!value.methodFit||typeof value.methodFit!=='object') add(['methodFit'],'Required object');
  else {
    if(!METHODS.includes(value.methodFit.method)) add(['methodFit','method'],'Invalid method');
    if(!Number.isFinite(Number(value.methodFit.score))||Number(value.methodFit.score)<0||Number(value.methodFit.score)>5) add(['methodFit','score'],'Score must be 0-5');
    if(!Number.isFinite(Number(value.methodFit.confidence))||Number(value.methodFit.confidence)<0||Number(value.methodFit.confidence)>1) add(['methodFit','confidence'],'Confidence must be 0-1');
  }
  for(const k of arrays) { const optional=['claims']; if(value[k]===undefined&&optional.includes(k)) continue; if(!Array.isArray(value[k])||value[k].length>50) add([k],'Must be an array with at most 50 items'); }
  for(const [i,c] of (value.codes||[]).entries()) {if(!c||typeof c!=='object') add(['codes',i],'Must be object'); else {if(!CODE_TYPES.includes(c.type)) add(['codes',i,'type'],'Invalid code type');if(!Array.isArray(c.evidenceIds)) add(['codes',i,'evidenceIds'],'Must be array');}}
  for(const [i,t] of (value.themes||[]).entries()) {if(!t||typeof t!=='object') add(['themes',i],'Must be object'); else {if(!asString(t.id)||!asString(t.label)) add(['themes',i],'id and label required');if(!Array.isArray(t.evidenceIds)) add(['themes',i,'evidenceIds'],'Must be array');}}
  for(const [i,c] of (value.claims||[]).entries()) {if(!c||typeof c!=='object') add(['claims',i],'Must be object'); else {if(!asString(c.id)||!asString(c.text)) add(['claims',i],'id and text required');if(!Array.isArray(c.evidenceIds)) add(['claims',i,'evidenceIds'],'Must be array');if(!SUPPORT_STATUS.includes(c.supportStatus)) add(['claims',i,'supportStatus'],'Invalid support status');if(!['low','medium','high'].includes(c.uncertainty)) add(['claims',i,'uncertainty'],'Invalid uncertainty');if(c.confidence!==undefined && !Number.isFinite(Number(c.confidence))) add(['claims',i,'confidence'],'Invalid confidence');}}
  for(const [i,c] of (value.contradictions||[]).entries()) {if(!c||typeof c!=='object') add(['contradictions',i],'Must be object'); else {if(!Array.isArray(c.evidenceIds)||c.evidenceIds.length<2) add(['contradictions',i,'evidenceIds'],'Requires at least two evidence IDs');if(!['low','medium','high'].includes(c.severity)) add(['contradictions',i,'severity'],'Invalid severity');if(typeof c.requiresHumanReview!=='boolean') add(['contradictions',i,'requiresHumanReview'],'Must be boolean');}}
  for(const [group,allowed] of [['opportunities',true],['assumptions',true],['solutions',true]]) for(const [i,x] of (value[group]||[]).entries()) {if(!x||typeof x!=='object') add([group,i],'Must be object'); else if(!Array.isArray(x.evidenceIds)) add([group,i,'evidenceIds'],'Must be array');}
  for(const [i,a] of (value.assumptions||[]).entries()) if(a&&typeof a==='object'){if(!ASSUMPTION_TYPES.includes(a.assumptionType)) add(['assumptions',i,'assumptionType'],'Invalid assumption type');if(a.importance!==undefined && (!Number.isFinite(Number(a.importance))||Number(a.importance)<0||Number(a.importance)>10)) add(['assumptions',i,'importance'],'Importance must be 0-10');if(a.uncertainty!==undefined && (!Number.isFinite(Number(a.uncertainty))||Number(a.uncertainty)<0||Number(a.uncertainty)>10)) add(['assumptions',i,'uncertainty'],'Uncertainty must be 0-10');}
  for(const [k,arr] of Object.entries({codes:value.codes||[],themes:value.themes||[],claims:value.claims||[],contradictions:value.contradictions||[],opportunities:value.opportunities||[],assumptions:value.assumptions||[],solutions:value.solutions||[]})) for(const [i,x] of arr.entries()) for(const ref of (Array.isArray(x?.evidenceIds)?x.evidenceIds:[])) if(!evidenceIds.includes(ref)) add([k,i,'evidenceIds'],`Unknown evidence reference: ${ref}`);
  if(!value.triangulation||!TRIANGULATION_STATUS.includes(value.triangulation.status)) add(['triangulation','status'],'Invalid triangulation status');
  if(value.triangulation?.confidence!==undefined && (!Number.isFinite(Number(value.triangulation.confidence))||Number(value.triangulation.confidence)<0||Number(value.triangulation.confidence)>1)) add(['triangulation','confidence'],'Confidence must be 0-1');
  return errors;
}
function asString(v){return typeof v==='string'&&v.trim().length>0}

function zodSchema(){if(!z)return null;
  const evidenceRef=z.string().min(1).max(160);
  const common=z.object({id:z.string().min(1).max(160),evidenceIds:z.array(evidenceRef).max(30)});
  return z.object({
    questionUnderstanding:z.object({type:z.enum(QUESTION_TYPES),confidence:z.number().min(0).max(1),decisionImpact:z.enum(['low','medium','high']),intentRationale:z.string().min(3).max(2500),ambiguities:z.array(z.string().min(1).max(1000)).max(20),evidenceRequirements:z.array(z.string().min(1).max(1000)).max(20)}).strict(),
    methodFit:z.object({method:z.enum(METHODS),score:z.number().min(0).max(5),confidence:z.number().min(0).max(1),rationale:z.string().min(1).max(2500),decisionNeed:z.string().min(1).max(1500),alternatives:z.array(z.object({method:z.enum(METHODS),score:z.number().min(0).max(5),tradeoff:z.string().min(1).max(1200)}).strict()).max(5)}).strict(),
    codes:z.array(common.extend({type:z.enum(CODE_TYPES),label:z.string().min(1).max(1200),confidence:z.number().min(0).max(1)}).strict()).max(30),
    themes:z.array(common.extend({label:z.string().min(1).max(1600),description:z.string().min(1).max(2500),confidence:z.number().min(0).max(1),status:z.enum(['candidate','confirmed','rejected']).optional()}).strict()).max(30),
    claims:z.array(common.extend({text:z.string().min(3).max(3000),supportStatus:z.enum(SUPPORT_STATUS),uncertainty:z.enum(['low','medium','high']),confidence:z.number().min(0).max(1),rationale:z.string().min(1).max(2500)}).strict()).max(50).default([]),
    contradictions:z.array(z.object({id:z.string().min(1).max(160),evidenceIds:z.array(evidenceRef).min(2).max(10),explanation:z.string().min(3).max(2500),context:z.string().min(1).max(1600),severity:z.enum(['low','medium','high']),requiresHumanReview:z.boolean()}).strict()).max(30),
    evidenceGaps:z.array(z.string().min(1).max(1600)).max(30),
    triangulation:z.object({status:z.enum(TRIANGULATION_STATUS),rationale:z.string().min(1).max(1800),confidence:z.number().min(0).max(1),methods:z.array(z.string().min(1).max(120)).max(20).optional()}).strict(),
    opportunities:z.array(common.extend({label:z.string().min(1).max(1600),rationale:z.string().min(1).max(2500),themeIds:z.array(z.string().min(1).max(160)).max(20).optional(),segments:z.array(z.string().min(1).max(400)).max(20).optional(),confidence:z.number().min(0).max(1)}).strict()).max(30),
    assumptions:z.array(common.extend({text:z.string().min(3).max(2000),opportunityId:z.string().min(1).max(160).optional(),assumptionType:z.enum(ASSUMPTION_TYPES),importance:z.number().min(0).max(10),uncertainty:z.number().min(0).max(10),leapOfFaith:z.boolean(),confidence:z.number().min(0).max(1).optional()}).strict()).max(30),
    solutions:z.array(common.extend({opportunityId:z.string().min(1).max(160),title:z.string().min(1).max(1600),description:z.string().min(1).max(2500),rationale:z.string().min(1).max(2000),confidence:z.number().min(0).max(1).optional()}).strict()).max(30),
    nextActions:z.array(z.string().min(1).max(1600)).max(20),
    model:z.string().min(1).max(200).optional(),
    promptVersion:z.string().min(1).max(200).optional()
  }).strict();
}
function validateSemanticDiscovery(payload,opts={}){const schema=zodSchema();const issues=schema?(()=>{const r=schema.safeParse(payload);return r.success?[]:r.error.issues})():manualValidate(payload,opts);const evidenceIds=opts.evidenceIds||[];const allowed=new Set(evidenceIds);const relContainers=['codes','themes','claims','opportunities','assumptions','solutions'];for(const key of relContainers) for(const item of payload?.[key]||[]) for(const id of item.evidenceIds||[]) if(!allowed.has(id)) issues.push({path:[key,item.id||'?','evidenceIds'],message:`Unknown evidence reference: ${id}`});return{success:issues.length===0,data:payload,error:issues.length?{issues}:null};}
module.exports={QUESTION_TYPES,METHODS,CODE_TYPES,ASSUMPTION_TYPES,SUPPORT_STATUS,TRIANGULATION_STATUS,validateSemanticDiscovery};
