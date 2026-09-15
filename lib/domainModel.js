'use strict';

const crypto=require('node:crypto');

const ENTITY_LIMITS={
  decisions:500,
  assumptions:5000,
  evidence:5000,
  challenges:2500,
  alternatives:2500,
  experiments:1000,
  predictions:2500,
  outcomes:2500,
  learnings:2500,
  discoveries:1000,
  researchSessions:1000,
  researchParticipants:5000,
  researchObservations:10000,
  researchThemes:2500,
  claims:10000
};

const IDS=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const VERSIONED=['assumptions','evidence','challenges','alternatives','experiments','predictions','outcomes','learnings','researchSessions','researchParticipants','researchObservations','researchThemes','claims'];

function stableId(value,prefix='ent'){
  const s=String(value||'').trim();
  if(IDS.test(s)) return s;
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeArray(value){return Array.isArray(value)?value:[];}
function cleanString(v,max=10000){return String(v??'').trim().slice(0,max);}
function finiteNumber(v){return typeof v==='number'&&Number.isFinite(v)?v:null;}

function normalizeEntity(entity,prefix){
  const x={...(entity||{})};
  x.id=stableId(x.id,prefix);
  x.clientId=x.clientId||x.client_id||x.id;
  x.version=Math.max(1,Number(x.version||1));
  x.createdAt=x.createdAt||x.created_at||null;
  x.updatedAt=x.updatedAt||x.updated_at||null;
  x.archivedAt=x.archivedAt||x.archived_at||null;
  return x;
}

function validateCollection(graph,collection){
  const values=normalizeArray(graph?.[collection]);
  const max=ENTITY_LIMITS[collection]||5000;
  const errors=[];
  if(values.length>max) errors.push(`${collection} exceeds maximum of ${max}`);
  const ids=new Set();
  for(let i=0;i<values.length;i++){
    const item=normalizeEntity(values[i],collection.slice(0,-1));
    if(ids.has(item.id)) errors.push(`${collection}[${i}]: duplicate id ${item.id}`);
    ids.add(item.id);
    if(item.id.length>160||!IDS.test(item.id)) errors.push(`${collection}[${i}]: invalid stable id`);
  }
  return errors;
}


function validateRelationships(graph){
  const errors=[];const idsBy=(collection)=>new Set(normalizeArray(graph?.[collection]).map(x=>normalizeEntity(x,collection.slice(0,-1)).id));
  const evidence=idsBy('evidence'),assumptions=idsBy('assumptions'),opportunities=idsBy('opportunities'),solutions=idsBy('solutions'),observations=idsBy('researchObservations'),themes=idsBy('researchThemes');
  for(const [i,a] of normalizeArray(graph?.assumptions).entries()) for(const ref of [].concat(a?.evidenceIds||a?.evidence_ids||[])) if(!evidence.has(String(ref))) errors.push(`assumptions[${i}] references unknown evidence ${ref}`);
  for(const [i,c] of normalizeArray(graph?.claims).entries()) for(const ref of [].concat(c?.evidenceIds||c?.evidence_ids||[])) if(!evidence.has(String(ref))) errors.push(`claims[${i}] references unknown evidence ${ref}`);
  for(const [i,o] of normalizeArray(graph?.opportunities).entries()) for(const ref of [].concat(o?.evidenceIds||o?.evidence_ids||[])) if(!evidence.has(String(ref))) errors.push(`opportunities[${i}] references unknown evidence ${ref}`);
  for(const [i,s] of normalizeArray(graph?.solutions).entries()) if(s?.opportunityId && !opportunities.has(String(s.opportunityId))) errors.push(`solutions[${i}] references unknown opportunity ${s.opportunityId}`);
  for(const [i,s] of normalizeArray(graph?.solutions).entries()) for(const ref of [].concat(s?.evidenceIds||s?.evidence_ids||[])) if(!evidence.has(String(ref))) errors.push(`solutions[${i}] references unknown evidence ${ref}`);
  for(const [i,t] of normalizeArray(graph?.researchThemes).entries()) for(const ref of [].concat(t?.evidenceIds||t?.evidence_ids||[])) if(!evidence.has(String(ref))) errors.push(`researchThemes[${i}] references unknown evidence ${ref}`);
  for(const [i,o] of normalizeArray(graph?.researchObservations).entries()) if(o?.themeId && !themes.has(String(o.themeId))) errors.push(`researchObservations[${i}] references unknown theme ${o.themeId}`);
  for(const [i,o] of normalizeArray(graph?.researchObservations).entries()) if(o?.sourceEvidenceId && !evidence.has(String(o.sourceEvidenceId))) errors.push(`researchObservations[${i}] references unknown source evidence ${o.sourceEvidenceId}`);
  for(const [i,a] of normalizeArray(graph?.assumptions).entries()) if(a?.opportunityId && !opportunities.has(String(a.opportunityId))) errors.push(`assumptions[${i}] references unknown opportunity ${a.opportunityId}`);
  for(const [i,a] of normalizeArray(graph?.assumptions).entries()) if(a?.solutionId && !solutions.has(String(a.solutionId))) errors.push(`assumptions[${i}] references unknown solution ${a.solutionId}`);
  return [...new Set(errors)];
}

function validateCanonicalGraph(input={}){
  const errors=[];
  if(!input||typeof input!=='object'||Array.isArray(input)) return ['graph must be an object'];
  if(!input.decision||typeof input.decision!=='object') errors.push('decision is required');
  else{
    const d=input.decision;
    if(!cleanString(d.title,300)) errors.push('decision.title is required');
    if(!cleanString(d.problem,5000)) errors.push('decision.problem is required');
    if(d.id && !IDS.test(String(d.id))) errors.push('decision.id is invalid');
  }
  for(const c of VERSIONED) errors.push(...validateCollection(input,c));
  errors.push(...validateRelationships(input));
  return [...new Set(errors)];
}

function normalizeCanonicalGraph(input={}){
  const decision={...normalizeEntity(input.decision,'decision')};
  decision.title=cleanString(decision.title,300)||'Untitled decision';
  decision.problem=cleanString(decision.problem,10000);
  decision.status=['validate','build','defer','do_not_build'].includes(decision.status)?decision.status:'validate';
  const graph={decision};
  for(const c of VERSIONED) graph[c]=normalizeArray(input[c]).map(x=>normalizeEntity(x,c.slice(0,-1)));
  return graph;
}

function entityVersion(existingVersion){
  const n=Number(existingVersion||0);
  return Number.isFinite(n)?Math.max(1,n+1):1;
}

function buildAuditEnvelope({userId,organizationId,requestId,decisionId,operation='UPSERT_GRAPH'}){
  return {userId,organizationId,requestId,decisionId,operation,at:new Date().toISOString()};
}

module.exports={
  ENTITY_LIMITS,VERSIONED,validateRelationships,stableId,normalizeEntity,validateCanonicalGraph,normalizeCanonicalGraph,entityVersion,buildAuditEnvelope,finiteNumber,cleanString
};
