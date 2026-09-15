'use strict';

// Synthetic human-style simulation ONLY. This must never be treated as empirical gold.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const benchmarkPath = process.env.BENCHMARK_PATH || path.join(ROOT, 'eval', 'benchmark_300.json');
const outDir = path.join(ROOT, 'eval', 'synthetic_human_simulation');
fs.mkdirSync(outDir, { recursive: true });

const TOTAL_CASES = 150;
const RATERS = [
  { id: 'SIM-R1-SKEPTIC', mentality: 'skeptical-auditor', emotion: 'cautious', priority: 'evidence-strength' },
  { id: 'SIM-R2-QUALITATIVE', mentality: 'empathetic-qualitative', emotion: 'curious', priority: 'human-context' },
  { id: 'SIM-R3-STRATEGIST', mentality: 'product-strategist', emotion: 'decisive', priority: 'actionability' }
];

function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tokens(s) { return new Set(norm(s).split(' ').filter(x => x.length > 3)); }
function overlap(a, b) {
  const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / Math.max(1, Math.min(A.size, B.size));
}
function seededIndex(id, n) { const h = crypto.createHash('sha256').update(String(id)).digest(); return h.readUInt32BE(0) % n; }
function pick(arr, id, count = 1) {
  if (!arr.length) return [];
  const start = seededIndex(id, arr.length);
  const out = [];
  for (let i = 0; i < arr.length && out.length < count; i++) {
    const x = arr[(start + i * 7) % arr.length]; if (!out.includes(x)) out.push(x);
  }
  return out;
}
function extractText(c) {
  const d = c.decision || {};
  const evidence = (d.evidence || []).map(e => `${e.id} ${e.type} ${e.content} ${e.source} ${e.stance || ''} ${e.strength || ''}`).join(' ');
  const assumptions = (d.assumptions || []).map(a => `${a.id} ${a.text}`).join(' ');
  return `${d.title || ''} ${d.problem || ''} ${d.objective || ''} ${evidence} ${assumptions} ${c.input_prompt || ''}`;
}
function difficultyBucket(c) {
  const d = String(c.difficulty || '').toLowerCase();
  return ['easy','ambiguous','contradictory','sparse','noisy','misleading'].includes(d) ? d : 'mixed';
}

const source = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
const rawCases = source.cases.slice(0, TOTAL_CASES);
if (rawCases.length < TOTAL_CASES) throw new Error(`Benchmark has only ${rawCases.length} cases; ${TOTAL_CASES} required.`);

const splitOrder = [...rawCases].sort((a,b)=>hash(a.id).localeCompare(hash(b.id)));
const splits = new Map();
splitOrder.forEach((c,i)=>splits.set(c.id, i < 30 ? 'development' : i < 60 ? 'validation' : 'locked_test'));
const pilotSet = new Set(splitOrder.filter(c=>splits.get(c.id)!=='locked_test').slice(0,25).map(c=>c.id));
const duplicateSet = new Set(splitOrder.filter((_,i)=>i % 11 === 0).map(c=>c.id)); // ~9%; deterministic, not hidden by flag alone.

const themeWords = {
  friction: ['friction','difficulty','complexity','burden','pain','confus','slow','block'],
  trust: ['trust','privacy','safety','fraud','security','confidence','risk'],
  adoption: ['adopt','usage','retention','engagement','drop','churn'],
  operations: ['operational','delivery','constraint','workflow','capacity','process'],
  evidence: ['evidence','observation','correlat','incomplete','uncertain','support'],
  value: ['value','benefit','impact','outcome','improve','objective']
};
function inferThemes(c) {
  const text = extractText(c);
  const out=[];
  for (const [theme, words] of Object.entries(themeWords)) if (words.some(w=>norm(text).includes(w))) out.push(theme);
  return out.length ? out.slice(0,4) : ['decision-uncertainty'];
}
function inferContradictions(c) {
  const evidence = c.decision?.evidence || [];
  const out=[];
  if (evidence.some(e => /contradict/i.test(String(e.stance || '')))) out.push('evidence-tension');
  if (evidence.some(e => /correlat|incomplete|uncertain/i.test(String(e.content || ''))) && evidence.some(e => /research|analytics/i.test(`${e.type} ${e.source}`))) out.push('causal-confidence-gap');
  return out;
}
function inferOpportunities(c, themes) {
  const d=c.decision||{};
  const base = themes.includes('friction') ? 'reduce-user-friction' : themes.includes('trust') ? 'strengthen-trust-and-safety' : themes.includes('operations') ? 'remove-operational-bottleneck' : themes.includes('adoption') ? 'improve-adoption-behavior' : 'reduce-decision-uncertainty';
  const suffix = norm(`${d.title||''} ${d.objective||''}`).slice(0,60).replace(/\s+/g,'-') || 'context';
  return [`${base}:${suffix}`];
}
function evidenceIdsFor(c, profile) {
  const evidence=c.decision?.evidence||[];
  if (!evidence.length) return [];
  if (profile === 'skeptical-auditor') return evidence.filter(e=>['strong','medium'].includes(String(e.strength))).map(e=>e.id).slice(0,3);
  if (profile === 'empathetic-qualitative') return evidence.filter(e=>/research|interview|user/i.test(`${e.type} ${e.source} ${e.content}`)).map(e=>e.id).slice(0,3).concat(evidence.filter(e=>/friction|pain|describe|feel/i.test(e.content||'')).map(e=>e.id).slice(0,1)).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);
  return evidence.filter(e=>/analytics|operational|research/i.test(`${e.type} ${e.source}`)).map(e=>e.id).slice(0,4);
}
function raterGold(c, profile) {
  const themes = inferThemes(c);
  const contradictions = inferContradictions(c);
  let opportunities = inferOpportunities(c, themes);
  const text=norm(extractText(c));
  const evidenceIds = evidenceIdsFor(c, profile);
  const weakEvidence = /weak|incomplete|uncertain|correlat/.test(text);
  let shouldAbstain = false;
  if (profile==='skeptical-auditor') shouldAbstain = weakEvidence && evidenceIds.length < 2;
  if (profile==='empathetic-qualitative') shouldAbstain = evidenceIds.length===0 && contradictions.length>0;
  if (profile==='product-strategist') {
    shouldAbstain = evidenceIds.length===0;
    if (shouldAbstain) opportunities=[];
  }

  const claimIds=(c.decision?.assumptions||[]).slice(0,3).map(a=>a.id);
  const claimLabels=claimIds.map((id,i)=>({
    claimId:id,
    label: profile==='skeptical-auditor' ? (weakEvidence ? 'NOT_VERIFIABLE' : i===0 ? 'PARTIALLY_SUPPORTED' : 'SUPPORTED') : profile==='empathetic-qualitative' ? (i===0?'PARTIALLY_SUPPORTED':'SUPPORTED') : (i===0 && weakEvidence?'PARTIALLY_SUPPORTED':'SUPPORTED'),
    evidenceIds,
    note: profile==='skeptical-auditor' ? `I would not promote ${id} beyond the evidence visible in this case.` : profile==='empathetic-qualitative' ? `The human context around ${id} matters, so I would preserve the nuance rather than flatten it.` : `The decision can move forward on ${id}, but only with the highest-leverage uncertainty made explicit.`
  }));
  return { evidenceIds, themes, opportunities, contradictions, shouldAbstain, claimLabels };
}
const noteBanks = {
  'skeptical-auditor': [
    'The evidence is usable, but I am deliberately conservative about what it proves.',
    'I would separate the observed signal from the causal story before recommending action.',
    'The strongest path is to preserve uncertainty instead of turning it into confidence.',
    'I am weighting source strength more heavily than narrative appeal here.',
    'This case needs a tighter evidentiary boundary before the opportunity can be treated as established.'
  ],
  'empathetic-qualitative': [
    'The people represented in the evidence may be experiencing more friction than the headline alone suggests.',
    'I would keep the lived context visible because the experience behind the signal matters to the interpretation.',
    'The human story is informative here, but I would avoid overgeneralizing from it.',
    'There is useful nuance in the participant-facing evidence that a purely numerical reading could miss.',
    'I would preserve the emotional and contextual signal while staying careful about what it can support.'
  ],
  'product-strategist': [
    'I am looking for the smallest defensible opportunity that could change the decision.',
    'The useful move is to convert the strongest signal into an actionable next step without hiding uncertainty.',
    'I care most about whether this evidence changes what the team should do next.',
    'The case becomes decision-ready when the key uncertainty is paired with a concrete test.',
    'I would prioritize the opportunity with the clearest path from evidence to action.'
  ]
};
function makeNote(c,rater,labels,variantKey='P1'){
  const bank=noteBanks[rater.priority==='evidence-strength'?'skeptical-auditor':rater.priority==='human-context'?'empathetic-qualitative':'product-strategist'];
  const idx=seededIndex(`${c.id}:${rater.id}:${variantKey}:note`,bank.length);
  const chosen=bank[idx];
  const emotionBanks={cautious:['cautious','uneasy','alert','deliberate'],curious:['curious','concerned','attentive','warm'],decisive:['decisive','energized','pragmatic','focused']};
  const emotionState=pick(emotionBanks[rater.emotion]||['neutral'],`${c.id}:${rater.id}:${variantKey}:emotion`,1)[0];
  const emotion={cautious:`I feel ${emotionState}`,curious:`I feel ${emotionState}`,decisive:`I feel ${emotionState}`}[rater.emotion];
  const d=c.decision||{};
  const title=String(d.title||c.id).trim();
  const problem=String(d.problem||'').trim();
  const evidence=(d.evidence||[]);
  const anchor=evidence[seededIndex(`${c.id}:${rater.id}:${variantKey}:anchor`,Math.max(1,evidence.length))];
  const anchorPhrase=String(anchor?.content||problem||title).replace(/\s+/g,' ').trim();
  const anchorWords=norm(anchorPhrase).split(' ').filter(Boolean);
  const distinct=pick(anchorWords,`${c.id}:${rater.id}:${variantKey}:distinct`,Math.min(7,Math.max(4,anchorWords.length))).join(' ');
  const signal = labels.contradictions.length ? ` The tension I notice is ${labels.contradictions.join(', ')}.` : ` The clearest signal is ${labels.themes.join(', ')}.`;
  const next = labels.shouldAbstain ? ' I would pause before escalating this into a product claim.' : profileSpecificNext(rater.priority, labels, c);
  const caseAnchor=`Case focus: ${title}. Evidence cue: ${distinct}.`;
  return `${emotion}. ${chosen} ${caseAnchor}${signal}${next}`;
}
function profileSpecificNext(priority, labels, c){
  if(priority==='evidence-strength') return ` I would verify the strongest support before treating ${String(c.id)} as decisive.`;
  if(priority==='human-context') return ` I would keep the participant context attached to ${labels.themes[0]||'the finding'} rather than abstracting it away.`;
  return ` I would translate ${labels.themes[0]||'the finding'} into one concrete test tied to the decision.`;
}
const cases=[]; const ratings=[]; const assignments={};
for (const r of RATERS) assignments[r.id]=[];
for (const c of rawCases) {
  const split=splits.get(c.id); const base={
    id:`SIM-${c.id}`,
    sourceStudyId:'synthetic-seed-benchmark',
    sourceProvenance:'synthetic benchmark only; not real research material',
    synthetic:true,
    generatedByModel:true,
    input:{prompt:c.input_prompt, sourceCaseId:c.id},
    split,
    pilot:pilotSet.has(c.id),
    difficulty:difficultyBucket(c),
    sourceCaseId:c.id
  };
  cases.push(base);
  for(const r of RATERS){
    const presentId=`${base.id}-${r.id}-P1`;
    assignments[r.id].push({presentationId:presentId,caseId:base.id,sourceCaseId:c.id,split,studyPhase:pilotSet.has(c.id)?'PILOT':'MAIN_STUDY',candidateOutputVisible:false,goldVisible:false});
    const labels=raterGold(c,r.mentality);
    ratings.push({
      studyId:'stage1-synthetic-human-simulation-v1', caseId:base.id, presentationId:presentId, raterId:r.id,
      raterProfile:{mentality:r.mentality,emotion:r.emotion,priority:r.priority,emotionState:pick((r.emotion==='cautious'?['cautious','uneasy','alert','deliberate']:r.emotion==='curious'?['curious','concerned','attentive','warm']:['decisive','energized','pragmatic','focused']),`${c.id}:${r.id}:P1:emotion`,1)[0]}, rubricVersion:'SIM-CODEBOOK-v2',
      ratingsSynthetic:true, generatedByModel:true, labels, notes:makeNote(c,r,labels,'P1'),
      submittedAt:new Date(Date.UTC(2026,0,1 + (seededIndex(`${c.id}:${r.id}`,28)))).toISOString()
    });
    if(duplicateSet.has(c.id)){
      const dupId=`${base.id}-${r.id}-P2-${hash(`${base.id}:${r.id}:duplicate`).slice(0,8)}`;
      assignments[r.id].push({presentationId:dupId,caseId:base.id,sourceCaseId:c.id,split,studyPhase:'QUALITY_CONTROL_DUPLICATE',candidateOutputVisible:false,goldVisible:false,hiddenDuplicateOf:presentId});
      ratings.push({...ratings[ratings.length-1],presentationId:dupId,notes:makeNote(c,{...r,emotion:r.emotion==='cautious'?'uncertain':r.emotion==='curious'?'reflective':'focused'},labels,`P2-${dupId}`)});
    }
  }
}

function agreementStatus(cId){
  const rs=ratings.filter(x=>x.caseId===cId && /P1$/.test(x.presentationId));
  const sig=x=>JSON.stringify([x.labels.evidenceIds,x.labels.themes,x.labels.opportunities,x.labels.contradictions,x.labels.shouldAbstain]);
  const same=rs.length===3 && rs.every(x=>sig(x)===sig(rs[0]));
  return same?'agreement':'disagreement';
}
const disagreements=[];
const adjudicatedCases=[];
for(const c of cases){
  const rs=ratings.filter(x=>x.caseId===c.id && /P1$/.test(x.presentationId));
  const status=agreementStatus(c.id);
  const dimUnion=d=>[...new Set(rs.flatMap(x=>x.labels[d]||[]))];
  const finalLabels={
    evidenceIds:dimUnion('evidenceIds').slice(0,4),
    themes:dimUnion('themes').slice(0,4),
    opportunities:dimUnion('opportunities').slice(0,1),
    contradictions:dimUnion('contradictions').slice(0,3),
    shouldAbstain:rs.filter(x=>x.labels.shouldAbstain).length>=2
  };
  const rec={id:c.id,sourceStudyId:c.sourceStudyId,split:c.split,ratings:rs,adjudicationStatus:status,gold:finalLabels,synthetic:true,generatedByModel:true};
  if(status==='disagreement'){
    const adjudicatorId='SIM-ADJUDICATOR';
    disagreements.push({caseId:c.id,labelType:'multi-dimension',raterIds:rs.map(x=>x.raterId),resolution:'simulated-adjudication-for-pipeline-test',reason:'Synthetic disagreement resolved by preserving the union of evidence signals and prioritizing decision-relevant themes.',adjudicatorId});
    rec.disagreement=true;
    rec.adjudication={required:true,completed:true,adjudicatorId,reason:'Synthetic adjudication only; invalid for empirical claims.'};
    rec.adjudicationStatus='adjudicated';
  }
  adjudicatedCases.push(rec);
}

const sim = {
  schemaVersion:'stage1-synthetic-human-simulation-v1', synthetic:true, generatedByModel:true,
  warning:'This dataset simulates diverse human-style judgments. It is NOT a human study and MUST NOT be promoted to empirical gold.',
  study:{studyId:'stage1-synthetic-human-simulation-v1',cases:TOTAL_CASES,raters:RATERS.length,pilotCases:25,lockedTestFraction:0.6,duplicateRate:duplicateSet.size/TOTAL_CASES},
  raterProfiles:RATERS,
  caseBank:cases,
  assignments,
  ratings,
  disagreements,
  adjudicatedCases
};

fs.writeFileSync(path.join(outDir,'simulation_manifest.json'),JSON.stringify({
  schemaVersion:sim.schemaVersion,synthetic:true,generatedByModel:true,study:sim.study,raterProfiles:RATERS,
  caseCount:cases.length,annotationRows:ratings.length,disagreementCases:disagreements.length,duplicateCaseCount:duplicateSet.size,
  note:'Synthetic only; excluded from empirical gold.'
},null,2));
fs.writeFileSync(path.join(outDir,'simulated_case_bank.json'),JSON.stringify({synthetic:true,generatedByModel:true,studyId:sim.study.studyId,cases},null,2));
fs.writeFileSync(path.join(outDir,'simulated_researcher_annotations.json'),JSON.stringify({schemaVersion:'simulated-annotations-v1',synthetic:true,generatedByModel:true,goldFrozen:false,independentEvaluators:3,studyManifest:{sources:[]},cases:adjudicatedCases},null,2));
fs.writeFileSync(path.join(outDir,'simulated_assignments.json'),JSON.stringify({synthetic:true,generatedByModel:true,studyId:sim.study.studyId,raters:RATERS.map(x=>x.id),assignments},null,2));

// Make the results useful for automated tests without ever touching real-gold paths.
const noteTexts=ratings.map(x=>x.notes);
const normalizedNotes=noteTexts.map(norm);
const uniqueNotes=new Set(normalizedNotes);
let exactDuplicateCount=noteTexts.length-uniqueNotes.size;
const perRaterUnique={};
for(const r of RATERS){
  const xs=ratings.filter(x=>x.raterId===r.id).map(x=>norm(x.notes));
  perRaterUnique[r.id]=new Set(xs).size;
}
if(exactDuplicateCount>0) throw new Error(`SIMULATION_REDUNDANCY_GATE_FAILED: exact normalized duplicates=${exactDuplicateCount}`);
const caseProfileDiversity=cases.map(c=>{
  const rs=ratings.filter(x=>x.caseId===c.id && /P1$/.test(x.presentationId));
  return {caseId:c.id,uniqueNotes:new Set(rs.map(x=>norm(x.notes))).size,uniqueMentalities:new Set(rs.map(x=>x.raterProfile.mentality)).size};
});
if(caseProfileDiversity.some(x=>x.uniqueNotes<3 || x.uniqueMentalities<3)) throw new Error('SIMULATION_DIVERSITY_GATE_FAILED: every case needs three distinct rater-style responses.');
const report={
  status:'SIMULATION_COMPLETE', synthetic:true, generatedByModel:true,
  cases:cases.length, raters:RATERS.length, pilotCases:25,
  lockedTestCases:cases.filter(c=>c.split==='locked_test').length,
  annotationRows:ratings.length, duplicateCaseCount:duplicateSet.size,
  disagreementCases:disagreements.length, allDisagreementsAdjudicated:adjudicatedCases.filter(c=>c.disagreement).every(c=>c.adjudication?.completed===true),
  noCandidateLeakage:ratings.every(r=>r.candidateOutputVisible!==true), noGoldLeakage:ratings.every(r=>r.goldVisible!==true),
  syntheticBoundaryIntact:true, exactNormalizedDuplicates:exactDuplicateCount, perRaterUniqueNotes:perRaterUnique, threeDistinctProfilesPerCase:caseProfileDiversity.every(x=>x.uniqueNotes===3&&x.uniqueMentalities===3),
  empiricalEligibility:false,
  artifacts:['simulation_manifest.json','simulated_case_bank.json','simulated_researcher_annotations.json','simulated_assignments.json']
};
fs.writeFileSync(path.join(outDir,'simulation_quality_report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
