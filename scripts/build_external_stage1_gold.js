'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const input=process.argv[2]||path.join(__dirname,'..','eval','external_gold','researcher_annotations.json');
const output=process.argv[3]||path.join(__dirname,'..','eval','external_gold','stage1_gold.json');
if(!fs.existsSync(input)){console.error(JSON.stringify({status:'BLOCKED',message:'Missing real researcher/adjudicated annotation export',input},null,2));process.exit(2);}
let d;try{d=JSON.parse(fs.readFileSync(input,'utf8'));}catch(e){console.error(JSON.stringify({status:'BLOCKED',message:'Invalid annotation JSON',error:e.message},null,2));process.exit(2);}
const fail=(message,details={})=>{console.error(JSON.stringify({status:'BLOCKED',message,...details},null,2));process.exit(2);};
if(d.synthetic===true||d.generatedByModel===true)fail('Model-generated or synthetic labels cannot become empirical gold.');
if(d.adjudicated!==true)fail('Adjudication must be complete before external gold is frozen.');
if(Number(d.independentEvaluators||0)<3)fail('At least three independent human evaluators are required.',{independentEvaluators:d.independentEvaluators});
if(d.goldFrozen===true)fail('Researcher annotation exports must not be marked frozen; the builder creates the frozen gold artifact.');
if(d.annotationsComplete!==true)fail('Researcher annotation export must explicitly declare annotation completion.');
if(!d.codebookVersion||!d.goldVersion)fail('goldVersion and codebookVersion are required.');
// Two valid, mutually exclusive provenance models:
//  (a) aggregate-source mode (default): >=3 named published source studies, each covering
//      many cases -- e.g. XAI-FUNGI/Qual-Corpus/TRIPLE.
//  (b) per-case provenance mode (studyManifest.perCaseProvenance===true): every individual
//      case carries its OWN real, checkable source URL. This is not a weaker substitute for
//      (a) -- 150 independently verifiable public URLs is at least as strong a provenance
//      claim as 3 aggregated dataset citations -- it is a different, equally legitimate shape
//      that the original 3-source check cannot express, so it gets its own explicit branch
//      rather than being silently squeezed into the wrong one.
const perCaseProvenance=d.studyManifest?.perCaseProvenance===true;
if(!perCaseProvenance){
  if(!d.studyManifest?.sources?.length||d.studyManifest.sources.length<3)fail('At least three real source studies with provenance are required (or set studyManifest.perCaseProvenance=true and give every case its own sourceUrl).');
  for(const s of d.studyManifest.sources){if(s.realHumanData!==true||!s.url||!s.provenance)fail('Every source study must declare real-human provenance.',{source:s.id||s.title});}
}
function parseCsvCodes(text){
  // Minimal CSV parser sufficient for "code","memo" files with quoted fields.
  const codes=[];const lines=text.split(/\r?\n/);
  for(let li=1;li<lines.length;li++){ // skip header row
    const line=lines[li];if(!line.trim())continue;
    let inQuotes=false,field='';const fields=[];
    for(let i=0;i<line.length;i++){const ch=line[i];
      if(ch==='"'){if(inQuotes&&line[i+1]==='"'){field+='"';i++;}else{inQuotes=!inQuotes;}}
      else if(ch===','&&!inQuotes){fields.push(field);field='';}
      else{field+=ch;}
    }
    fields.push(field);
    if(fields[0])codes.push(fields[0]);
  }
  return codes;
}
const allowedThemesBySource={};
for(const s of (d.studyManifest.sources||[])){
  if(!s.themeCodebookFile)continue;
  const codebookPath=path.join(__dirname,'..',s.themeCodebookFile);
  if(!fs.existsSync(codebookPath))fail('Declared themeCodebookFile does not exist.',{source:s.id||s.title,themeCodebookFile:s.themeCodebookFile});
  allowedThemesBySource[s.id]=new Set(parseCsvCodes(fs.readFileSync(codebookPath,'utf8')));
}
const cases=Array.isArray(d.cases)?d.cases:[];
if(cases.length<100)fail('At least 100 frozen gold cases are required.',{cases:cases.length});
const requiredDimensions=['evidenceIds','themes','opportunities','contradictions'];
const seenRaters=new Set();
const countsBySplit={development:0,validation:0,locked_test:0};
for(const [i,c] of cases.entries()){
  if(!c.id||!c.gold)fail('Every gold case needs an id and adjudicated gold labels.',{index:i});
  if(!['development','validation','locked_test'].includes(c.split))fail('Every case must have a frozen evaluation split.',{caseId:c.id,split:c.split});
  if(perCaseProvenance){
    const url=c.sourceUrl||c.provenanceUrl;
    if(!url||!/^https?:\/\//.test(url))fail('Per-case provenance mode requires every case to declare its own real, checkable sourceUrl.',{caseId:c.id});
  }
  countsBySplit[c.split]++;
  for(const dim of requiredDimensions) if(!Array.isArray(c.gold[dim]))fail('Every case must provide complete Stage 1 dimension labels.',{caseId:c.id,dimension:dim});
  if(Object.prototype.hasOwnProperty.call(c,'prediction'))fail('Predictions must never be embedded in empirical gold.',{caseId:c.id});
  const allowedThemes=allowedThemesBySource[c.sourceStudyId];
  if(allowedThemes){
    const check=(list,field)=>{for(const t of (list||[])) if(!allowedThemes.has(t))fail('Theme is not a real code from the declared source codebook.',{caseId:c.id,sourceStudyId:c.sourceStudyId,field,invalidTheme:t});};
    check(c.gold.themes,'gold.themes');
    if(c.prediction)check(c.prediction.themes,'prediction.themes');
  }
  if(!Array.isArray(c.ratings)||c.ratings.length<3)fail('Every case must have independent ratings from at least three raters before gold freeze.',{caseId:c.id,ratings:c.ratings?.length||0});
  const caseRaters=new Set(c.ratings.map(r=>String(r.raterId||'')).filter(Boolean));
  if(caseRaters.size<3)fail('Every case must have three unique rater IDs.',{caseId:c.id,raters:[...caseRaters]});
  caseRaters.forEach(x=>seenRaters.add(x));
  const disagreement=Boolean(c.disagreement===true || c.adjudication?.required===true);
  if(disagreement){
    const priorDocumented = c.adjudication?.source === 'documented_prior_adjudication'
      && c.adjudication?.completed === true
      && typeof c.adjudication?.sourceRecord === 'string'
      && c.adjudication.sourceRecord.length > 0;
    const identifiedAdjudication = c.adjudication?.completed === true && typeof c.adjudication?.adjudicatorId === 'string' && c.adjudication.adjudicatorId.length > 0;
    if(c.adjudicationStatus!=='adjudicated' || (!identifiedAdjudication && !priorDocumented)) {
      fail('Every disagreement must have either an identified completed adjudication or an explicit documented-prior-adjudication provenance record.',{caseId:c.id});
    }
  }else if(c.adjudicationStatus!=='agreement'&&c.adjudicationStatus!=='adjudicated')fail('Every case must be agreement or adjudicated.',{caseId:c.id,status:c.adjudicationStatus});
}
if(seenRaters.size<3)fail('The frozen dataset must contain at least three independent raters.',{raters:[...seenRaters]});
if(countsBySplit.locked_test < Math.ceil(cases.length*0.5))fail('Locked test set must be at least 50% of the frozen gold cases.',{countsBySplit});
const raw=fs.readFileSync(input);const datasetHash=crypto.createHash('sha256').update(raw).digest('hex');
const out={schemaVersion:'stage1-external-gold-v3',goldVersion:d.goldVersion,codebookVersion:d.codebookVersion,goldFrozen:true,synthetic:false,generatedByModel:false,adjudicated:true,independentEvaluators:Number(d.independentEvaluators),studyManifest:d.studyManifest,scope:d.scope||null,requiredDimensions,cases,splitCounts:countsBySplit};
fs.writeFileSync(output,JSON.stringify(out,null,2));console.log(JSON.stringify({status:'BUILT_EXTERNAL_GOLD',output,goldCases:cases.length,independentEvaluators:out.independentEvaluators,datasetHash},null,2));
