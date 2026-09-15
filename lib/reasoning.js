'use strict';
const crypto=require('node:crypto');

const LABELS=['SUPPORTED','PARTIALLY_SUPPORTED','UNSUPPORTED','CONTRADICTED','NOT_VERIFIABLE'];
function id(prefix){return `${prefix}-${crypto.randomUUID().slice(0,12)}`;}
function text(v){return String(v??'').trim();}
function uniq(a){return [...new Set((Array.isArray(a)?a:[]).filter(Boolean).map(String))];}
function tokenize(s){return text(s).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3);}
function lexicalScore(a,b){const A=new Set(tokenize(a)),B=new Set(tokenize(b));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i);}
function normalizeEvidence(e){return {id:String(e?.id||''),content:text(e?.content||e?.text),stance:e?.stance||'neutral',strength:e?.strength||'medium',sourceType:e?.sourceType||e?.source_type||'other',sourceId:text(e?.sourceId||e?.source_id),segment:text(e?.segment),date:text(e?.date||e?.collected_at)}}
function buildReasoningContext(input={}){
 const evidence=(input.evidence||[]).map(normalizeEvidence).filter(e=>e.id&&e.content);
 const claims=(input.claims||[]).map((c,i)=>({id:String(c?.id||`claim-${i+1}`),text:text(c?.text||c?.claim)})).filter(c=>c.text);
 const candidates=[];
 for(const c of claims){
   const ranked=evidence.map(e=>({e,score:lexicalScore(c.text,e.content)})).sort((a,b)=>b.score-a.score).slice(0,8);
   candidates.push({claimId:c.id,candidateEvidence:ranked.filter(x=>x.score>=0.08).map(x=>({evidenceId:x.e.id,score:Number(x.score.toFixed(4)),stance:x.e.stance})),claim:c.text});
 }
 return {decision:input.decision||null,desiredOutcome:input.desiredOutcome||null,claims, evidence, assumptions:input.assumptions||[], opportunities:input.opportunities||[], contradictions:input.contradictions||[], candidateEvidence:candidates, instruction:'Use only supplied evidence. Distinguish evidence from inference. Never invent evidence IDs or facts.'};
}
function validateReasoningOutput(output={},evidence=[]){
 const ids=new Set((evidence||[]).map(e=>String(e.id)));
 const errors=[]; const claims=Array.isArray(output.claims)?output.claims:[];
 for(let i=0;i<claims.length;i++){
  const c=claims[i]||{};
  if(!text(c.text))errors.push(`claims[${i}].text required`);
  if(!LABELS.includes(c.supportStatus))errors.push(`claims[${i}].supportStatus invalid`);
  for(const ref of uniq(c.evidenceIds)) if(!ids.has(ref)) errors.push(`claims[${i}] unknown evidence ${ref}`);
  if(['SUPPORTED','PARTIALLY_SUPPORTED','CONTRADICTED'].includes(c.supportStatus)&&!uniq(c.evidenceIds).length)errors.push(`claims[${i}] requires evidenceIds`);
 }
 if(!text(output.summary))errors.push('summary required');
 if(!Array.isArray(output.keyUncertainties))errors.push('keyUncertainties must be array');
 if(!Array.isArray(output.nextTests))errors.push('nextTests must be array');
 return errors;
}
function verifyClaims(claims=[],evidence=[]){
 const byId=new Map(evidence.map(e=>[String(e.id),normalizeEvidence(e)]));
 return (Array.isArray(claims)?claims:[]).map(c=>{
   const refs=uniq(c.evidenceIds).map(id=>byId.get(id)).filter(Boolean);
   const scores=refs.map(e=>lexicalScore(c.text,e.content));
   const max=scores.length?Math.max(...scores):0;
   const hasContradiction=refs.some(e=>e.stance==='contradicts');
   const hasSupport=refs.some(e=>e.stance==='supports');
   let status=c.supportStatus;
   if(hasContradiction&&!hasSupport)status='CONTRADICTED';
   else if(!refs.length)status='NOT_VERIFIABLE';
   else if(max<0.08)status='UNSUPPORTED';
   else if(hasContradiction&&hasSupport)status='PARTIALLY_SUPPORTED';
   else if(max<0.18)status='PARTIALLY_SUPPORTED';
   else status='SUPPORTED';
   return {...c,supportStatus:status,verifiedEvidenceIds:refs.map(e=>e.id),maxEvidenceSimilarity:Number(max.toFixed(4)),verificationMode:'hybrid_lexical_guardrail'};
 });
}
module.exports={LABELS,buildReasoningContext,validateReasoningOutput,verifyClaims,lexicalScore};
