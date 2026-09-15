'use strict';
const crypto=require('node:crypto');
function seedFor(raterId,studyId='HG-001'){return crypto.createHash('sha256').update(`tf-annotation-v2:${studyId}:${raterId}`).digest('hex');}
function scoreHex(seed,value){const h=crypto.createHash('sha256').update(`${seed}:${value}`).digest('hex');return Number.parseInt(h.slice(0,12),16)/0xffffffffffff;}
function presentationId(seed,caseId,suffix){return crypto.createHash('sha256').update(`${seed}:${caseId}:${suffix}`).digest('hex').slice(0,24)}
function buildAssignments(cases,raterId,{duplicateRate=0.05,studyId='HG-001',pilotCount=30}= {}){
 const seed=seedFor(raterId,studyId);const originals=cases.map((c,i)=>({caseId:c.id,sourceCaseId:c.id,isHiddenDuplicate:false,split:splitForCase(i,cases.length),presentationId:presentationId(seed,c.id,'0')}));
 const dupCount=Math.max(1,Math.round(cases.length*duplicateRate));
 const duplicates=cases.map(c=>({c,s:scoreHex(seed,`dup:${c.id}`)})).sort((a,b)=>a.s-b.s).slice(0,dupCount).map((x,idx)=>({caseId:x.c.id,sourceCaseId:x.c.id,isHiddenDuplicate:true,split:'duplicate_check',presentationId:presentationId(seed,x.c.id,`dup:${idx}`)}));
 const all=originals.concat(duplicates).sort((a,b)=>scoreHex(seed,`${a.presentationId}:order`)-scoreHex(seed,`${b.presentationId}:order`));
 const pilot=all.filter(x=>x.split!=='duplicate_check').slice(0,pilotCount).map(x=>({...x,studyPhase:'PILOT'}));
 const rest=all.filter(x=>!pilot.some(p=>p.presentationId===x.presentationId)).map(x=>({...x,studyPhase:x.split==='locked_test'?'MAIN_STUDY':x.split.toUpperCase()}));
 return pilot.concat(rest);
}
function splitForCase(index,total){if(total!==300)return index<Math.ceil(total*.2)?'development':index<Math.ceil(total*.4)?'validation':'locked_test';if(index<60)return'development';if(index<120)return'validation';return'locked_test';}
module.exports={buildAssignments,splitForCase,seedFor};
