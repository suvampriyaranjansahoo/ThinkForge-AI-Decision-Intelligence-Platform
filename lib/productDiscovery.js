'use strict';
const crypto=require('node:crypto');
const {validateSemanticDiscovery}=require('./discoveryContracts');
const {verifyClaims}=require('./reasoning');

const QUESTION_TYPES=new Set(['exploratory','descriptive','evaluative','causal','predictive','generative','diagnostic']);
const METHODS=['interview','contextual_inquiry','usability_test','prototype_test','survey','diary_study','behavioral_analytics','support_ticket_analysis','competitive_research','experiment'];
const CODE_TYPES=new Set(['need','pain_point','behavior','motivation','workaround','barrier','goal','quote','trust','confusion','adoption','value','risk']);
const LEVELS=['FACT','OBSERVATION','INTERPRETATION','OPPORTUNITY','HYPOTHESIS'];
const ID=p=>`${p}-${crypto.randomUUID().slice(0,12)}`;
const STOP_WORDS=new Set(['that','this','with','from','they','their','have','will','users','user','what','when','where','which','were','been','into','about','after','before','there','would','could','should','because','than','then','more','less','very','just','also','only','some','many','most','does','did','doing','using']);
function normalizeText(v){return String(v??'').trim();}
function clamp(n,min=0,max=10){const x=Number(n);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;}
function clamp01(n){const x=Number(n);return Number.isFinite(x)?Math.max(0,Math.min(1,x)):0;}
function tokenize(text){return normalizeText(text).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3&&!STOP_WORDS.has(x));}
function jaccard(a,b){const A=new Set(tokenize(a)),B=new Set(tokenize(b));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i);}
function canonicalSourceType(v){const t=normalizeText(v).toLowerCase();if(t==='analytics'||t==='behavioral_analytics')return'analytics';if(t.includes('support'))return'support';if(t.includes('survey'))return'survey';if(t.includes('interview')||t==='contextual_inquiry')return'interview';if(t.includes('usability')||t.includes('prototype'))return'usability';if(t.includes('experiment'))return'experiment';if(t.includes('competitive')||t.includes('market'))return'market';return t||'manual';}
function classifyQuestionDetailed(text=''){
  const t=normalizeText(text).toLowerCase();
  if(!t) return {type:'exploratory',confidence:0,signals:[],decisionImpact:'unknown'};
  // More specific diagnostic/evaluative patterns win over generic 'why'/'will' matches.
  const rules=[
    ['diagnostic',/(what is causing|why did .* (change|drop|decline|increase)|root cause|diagnos(e|ing)|debug|where is the failure)/],
    ['evaluative',/(would .* improve|does .* improve|evaluate|test whether|can users|usability|compare|versus|vs\.?)/],
    ['causal',/(why|cause|driver|because|lead to|result in|impact of|effect of)/],
    ['descriptive',/(how many|how often|what percentage|rate|frequency|distribution|how much)/],
    ['predictive',/(will|predict|forecast|likely|probability|expected)/],
    ['generative',/(what could|how might|ideas|generate|what else|ways to)/]
  ];
  const matched=rules.filter(([,r])=>r.test(t)).map(([type])=>type);
  const type=matched[0]||'exploratory';
  const unique=[...new Set(matched)];
  const ambiguity=unique.length>1;
  return {type,confidence:Number(Math.min(0.95,0.62+0.08*Math.max(0,unique.length-1)-(ambiguity?0.03:0)).toFixed(2)),signals:unique,ambiguity,decisionImpact:['causal','evaluative','predictive','diagnostic'].includes(type)?'high':'medium'};
}
function classifyQuestion(text){return classifyQuestionDetailed(text).type;}

const METHOD_SCORES={
  exploratory:{interview:5,contextual_inquiry:5,diary_study:4,support_ticket_analysis:3,survey:2,behavioral_analytics:2,usability_test:2,competitive_research:2,experiment:1},
  descriptive:{survey:5,behavioral_analytics:5,support_ticket_analysis:4,interview:2,diary_study:2,competitive_research:3,usability_test:2,experiment:2},
  evaluative:{usability_test:5,prototype_test:5,experiment:5,survey:3,behavioral_analytics:3,interview:3,diary_study:2},
  causal:{experiment:5,behavioral_analytics:3,interview:2,survey:2,usability_test:2,prototype_test:2},
  predictive:{behavioral_analytics:5,experiment:4,survey:4,interview:2,competitive_research:2},
  generative:{interview:5,contextual_inquiry:5,diary_study:4,support_ticket_analysis:3,survey:2},
  diagnostic:{behavioral_analytics:5,support_ticket_analysis:5,interview:4,contextual_inquiry:4,usability_test:3,survey:2,experiment:3}
};
function methodFit(questionType,method){
  const qt=QUESTION_TYPES.has(questionType)?questionType:'exploratory';
  const m=normalizeText(method).toLowerCase();
  const score=(METHOD_SCORES[qt]||{})[m]||0;
  const fit=score>=5?'HIGH':score>=3?'MEDIUM':'LOW';
  const recommended=Object.entries(METHOD_SCORES[qt]||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([name,s])=>({method:name,score:s}));
  const rationale=fit==='HIGH'?`${m} is well matched to ${qt} questions.`:fit==='MEDIUM'?`${m} can contribute to ${qt} questions but should be triangulated.`:`${m||'No method'} is a weak standalone method for ${qt} questions.`;
  return {fit,score,questionType:qt,method:m||null,rationale,recommended,tradeoff:fit==='HIGH'?'Direct fit':fit==='MEDIUM'?'Useful with corroboration':'Low directness'};
}
function evidenceRequirements(questionType,decisionImpact='medium'){
  const base={exploratory:['direct user language','context','behavior'],descriptive:['quantified measure','denominator','time window'],evaluative:['task/result metric','baseline or comparator'],causal:['temporal ordering','counterfactual/comparator','confounder review'],predictive:['historical observations','measurement definition','forecast horizon'],generative:['user needs','constraints','current workarounds'],diagnostic:['symptom/metric','segment/context','alternative explanations']}[questionType]||['direct evidence'];
  return {required:base,rigor:decisionImpact==='high'?'high':'moderate'};
}
function sourceReliability(sourceType){return ({experiment:0.95,analytics:0.9,survey:0.75,usability:0.82,interview:0.72,support:0.7,market:0.65,manual:0.55})[canonicalSourceType(sourceType)]||0.55;}
function normalizeEvidence(e={}){
  const sourceType=canonicalSourceType(e.sourceType||e.source||e.type);
  const participantId=normalizeText(e.participantId);
  const segment=normalizeText(e.segment||e.audience);
  const date=normalizeText(e.date)||new Date().toISOString().slice(0,10);
  let confidence=typeof e.confidence==='number'?e.confidence:0.5;
  if(confidence>1)confidence=confidence/10;
  return {id:e.id||ID('E'),level:LEVELS.includes(e.level)?e.level:'FACT',content:normalizeText(e.content||e.text),sourceType,sourceId:normalizeText(e.sourceId||e.source),participantId,segment,date,strength:['weak','medium','strong'].includes(e.strength)?e.strength:'medium',confidence:clamp01(confidence),stance:['supports','contradicts','neutral'].includes(e.stance)?e.stance:'neutral',tags:Array.isArray(e.tags)?e.tags.map(String):[],quote:normalizeText(e.quote),interpretation:normalizeText(e.interpretation),provenance:e.provenance&&typeof e.provenance==='object'?e.provenance:{}};
}
function evidenceQuality(evidence=[]){
  const normalized=evidence.map(normalizeEvidence);
  const now=Date.now();
  const rows=normalized.map(e=>{
    const ageDays=Math.max(0,(now-Date.parse(`${e.date}T00:00:00Z`))/(86400000));
    const recency=Number.isFinite(ageDays)?Math.max(0.35,Math.exp(-ageDays/365)):0.5;
    const directness=e.level==='FACT'?1:e.level==='OBSERVATION'?0.9:e.level==='INTERPRETATION'?0.55:e.level==='HYPOTHESIS'?0.35:0.45;
    const sampleAdequacy=e.participantId||e.sourceType==='analytics'||e.sourceType==='experiment'?0.85:0.55;
    const provenance=e.sourceId||e.quote||Object.keys(e.provenance||{}).length?0.9:0.55;
    const quality=clamp01(0.28*sourceReliability(e.sourceType)+0.18*recency+0.18*directness+0.16*sampleAdequacy+0.12*provenance+0.08*e.confidence);
    return {...e,quality:Number(quality.toFixed(3)),qualityDimensions:{sourceReliability:Number(sourceReliability(e.sourceType).toFixed(3)),recency:Number(recency.toFixed(3)),directness,sampleAdequacy,provenanceCompleteness:provenance,confidence:e.confidence}};
  });
  const avg=rows.length?rows.reduce((s,e)=>s+e.quality,0)/rows.length:0;
  return {items:rows,aggregate:Number(avg.toFixed(3)),strongest:[...rows].sort((a,b)=>b.quality-a.quality).slice(0,5).map(e=>e.id),weakest:[...rows].sort((a,b)=>a.quality-b.quality).slice(0,5).map(e=>e.id)};
}
function semanticCodeForEvidence(e){
  const text=e.content.toLowerCase();const out=[];const add=(type,label,confidence)=>out.push({type,label,confidence:Number(confidence.toFixed(2)),evidenceId:e.id});
  if(/confus|unclear|uncertain|don't understand|difficult|hard|friction/.test(text))add('confusion','uncertainty / friction',0.9);
  if(/pain|problem|struggl|frustrat|annoy/.test(text))add('pain_point','pain / frustration',0.88);
  if(/need|want|wish|prefer|looking for/.test(text))add('need','stated need',0.9);
  if(/click|left|abandon|return|used|tried|switched|spent|completed/.test(text))add('behavior','observable behavior',0.84);
  if(/because|so that|in order to|reason/.test(text))add('motivation','stated motivation',0.78);
  if(/workaround|manual|spreadsheet|hack|copy.*paste/.test(text))add('workaround','workaround / compensating behavior',0.92);
  if(/trust|safe|risk|fear|duplicate|privacy|security/.test(text))add('trust','trust / perceived risk',0.86);
  if(/valuable|useful|helpful|benefit|value/.test(text))add('value','perceived value',0.75);
  if(/adopt|use again|repeat|retention|engage/.test(text))add('adoption','adoption / repeat behavior',0.78);
  return out;
}
function codeObservation(e){return semanticCodeForEvidence(normalizeEvidence(e));}
function synthesize(evidence,codes=[]){
  const items=[...evidence.map(normalizeEvidence)];
  const allCodes=[...items.flatMap(codeObservation),...codes.filter(Boolean).map(c=>({...c,evidenceId:c.evidenceId||c.evidence_id||null}))];
  const groups=new Map();
  for(const c of allCodes){const key=c.label||c.type;const row=groups.get(key)||{label:key,type:c.type,count:0,evidenceIds:new Set(),confidence:0};row.count++;if(c.evidenceId)row.evidenceIds.add(c.evidenceId);row.confidence=Math.max(row.confidence,Number(c.confidence||0));groups.set(key,row);}
  return [...groups.values()].sort((a,b)=>b.count-a.count).slice(0,10).map(g=>({id:ID('T'),label:g.label,type:g.type,count:g.count,evidenceIds:[...g.evidenceIds],confidence:Number(g.confidence.toFixed(2)),strength:g.count>=4?'strong':g.count>=2?'medium':'weak',status:'candidate'}));
}
function themeSynthesis(evidence,themes){
  const candidate=themes.map(t=>({...t,evidenceIds:[...(t.evidenceIds||[])],supportingEvidence:(t.evidenceIds||[]).map(id=>evidence.find(e=>e.id===id)).filter(Boolean).map(e=>e.id)}));
  return {themes:candidate,themeCount:candidate.length,coverage:Number((candidate.reduce((s,t)=>s+t.evidenceIds.length,0)/Math.max(1,evidence.length)).toFixed(3))};
}
function contradictionTopic(text){
  return new Set(tokenize(text).filter(t=>!['like','easy','simple','useful','valuable','want','prefer','works','trust','safe','helpful','adopt','dislike','hard','confusing','difficult','friction','problem','avoid','leave','abandon','unsafe','reject','dont','doesnt','not'].includes(t)));
}
function contradictionSignal(a,b){
  const A=contradictionTopic(a.content),B=contradictionTopic(b.content);let overlap=0;
  for(const x of A) if(B.has(x)) overlap++;
  const topicScore=(overlap/Math.max(1,Math.min(A.size,B.size)));
  const explicit=(a.stance==='supports'&&b.stance==='contradicts')||(a.stance==='contradicts'&&b.stance==='supports');
  const negation=/\b(no|not|never|don't|doesn't|dont|doesnt|avoid|reject|unwilling|refuse)\b/i;
  const polarity=(negation.test(a.content)!==negation.test(b.content));
  const positive=/\b(like|easy|simple|useful|valuable|want|prefer|works|trust|safe|helpful|adopt)\b/i;
  const negative=/\b(dislike|hard|confus|difficult|friction|problem|avoid|leave|abandon|don't|doesn't|unsafe|not useful|reject)\b/i;
  const lexical=(positive.test(a.content)&&negative.test(b.content))||(negative.test(a.content)&&positive.test(b.content));
  return {topicScore,explicit,polarity,lexical,signal:Math.max(explicit?.95:0,lexical?.72:0,polarity&&topicScore>=.2?.78:0,topicScore>=.45?.65:0)};
}
function detectContradictions(evidence){
  const ev=evidence.map(normalizeEvidence),out=[];
  for(let i=0;i<ev.length;i++) for(let j=i+1;j<ev.length;j++){
    const a=ev[i],b=ev[j],sim=jaccard(a.content,b.content),sig=contradictionSignal(a,b);
    const sameSegment=Boolean(a.segment&&b.segment&&a.segment===b.segment);
    const sameSource=Boolean((a.sourceId||a.provenance?.documentId)&&(a.sourceId||a.provenance?.documentId)===(b.sourceId||b.provenance?.documentId));
    const sameMethod=a.sourceType===b.sourceType;
    // Explicit stance conflicts are strongest. Lexical/polarity conflicts require topic overlap
    // or shared segment/method so unrelated positive/negative statements are not flagged.
    const related=sig.topicScore>=.2 || sim>=.08 || sameSegment || sameMethod;
    if(sig.signal>=.65 && related){
      const contextDifference=a.segment&&b.segment&&a.segment!==b.segment;
      const temporalDifference=a.date&&b.date&&a.date!==b.date;
      const severity=sig.signal>=.9 && !contextDifference ? 'high' : 'medium';
      out.push({
        id:ID('C'),evidenceA:a.id,evidenceB:b.id,
        reason:contextDifference?'Opposing findings may be segment-specific.':temporalDifference?'Opposing findings may reflect a changed time window.':'Opposing evidence about a related topic.',
        similarity:Number(sim.toFixed(3)),topicOverlap:Number(sig.topicScore.toFixed(3)),
        signal:Number(sig.signal.toFixed(3)),severity,
        context:{sameSegment,sameSource,sameMethod,temporalDifference},
        resolution:contextDifference?'Compare segments before generalizing.':temporalDifference?'Review time window and whether the underlying state changed.':'Review source, time window, measurement definition and alternative explanations.',
        requiresHumanReview:true
      });
    }
  }
  // Deterministically deduplicate mirrored/near-identical contradiction reports.
  const seen=new Set();
  return out.filter(c=>{const k=[c.evidenceA,c.evidenceB].sort().join('|');if(seen.has(k))return false;seen.add(k);return true;});
}
function evidenceGaps({questionType,evidence=[],quality,contradictions=[],decisionImpact='medium'}={}){
  const req=evidenceRequirements(questionType,decisionImpact).required;const gaps=[];const has=(terms)=>evidence.some(e=>terms.some(t=>`${e.content} ${e.sourceType} ${e.level}`.toLowerCase().includes(t)));
  const mapping={
    'direct user language':['quote','interview','support','need','want'],
    'context':['context','segment','interview'],
    'behavior':['analytics','clicked','used','abandon','behavior'],
    'quantified measure':['analytics','survey','percentage','rate'],
    'denominator':['denominator','sample','n=','participants'],
    'time window':['last','week','month','date','2026','2025'],
    'task/result metric':['usability','completion','success','task'],
    'baseline or comparator':['baseline','control','before','after','compare'],
    'temporal ordering':['before','after','precede','during','timeline'],
    'counterfactual/comparator':['control','counterfactual','experiment','comparison'],
    'confounder review':['confound','alternative','segment','control'],
    'historical observations':['history','historical','prior','trend','baseline'],
    'measurement definition':['metric','definition','measure'],
    'forecast horizon':['forecast','week','month','quarter','horizon'],
    'user needs':['need','want','prefer'],
    'constraints':['constraint','budget','time','regulation','technical'],
    'current workarounds':['workaround','manual','spreadsheet','hack'],
    'symptom/metric':['drop','decline','increase','rate','metric','error'],
    'segment/context':['segment','audience','context','participant'],
    'alternative explanations':['because','alternative','other','confound','could']
  };
  req.forEach(r=>{if(!has(mapping[r]||[r]))gaps.push({id:ID('G'),requirement:r,severity:decisionImpact==='high'?'high':'medium',reason:`No clear evidence for ${r}.`});});
  if(quality?.aggregate<0.6)gaps.push({id:ID('G'),requirement:'overall evidence quality',severity:'high',reason:'Aggregate evidence quality is below 0.60.'});
  if(contradictions.length)gaps.push({id:ID('G'),requirement:'contradiction resolution',severity:'high',reason:'Opposing evidence requires contextual review.'});
  return gaps;
}
function coverage(evidence=[],segments=[]){const ev=evidence.map(normalizeEvidence);const segs=[...new Set([...segments.map(normalizeText).filter(Boolean),...ev.map(e=>e.segment).filter(Boolean)])];const methods=[...new Set(ev.map(e=>e.sourceType).filter(Boolean))];const participants=[...new Set(ev.map(e=>e.participantId).filter(Boolean))];return{participants:participants.length,segments:segs.length,methods:methods.length,bySegment:segs.map(s=>({segment:s,count:ev.filter(e=>e.segment===s).length})),methodTypes:methods};}
function evidenceDimensions(evidence=[],segments=[]){ const ev=evidence.map(normalizeEvidence); const segs=new Set([...segments.map(normalizeText).filter(Boolean),...ev.map(e=>e.segment).filter(Boolean)]); const methods=new Set(ev.map(e=>e.sourceType).filter(Boolean)); const sources=new Set(ev.map(e=>e.sourceId||e.participantId||e.provenance?.documentId).filter(Boolean)); const independentSourceCount=sources.size||methods.size; const contradicting=ev.filter(e=>e.stance==='contradicts').length; const supported=ev.filter(e=>e.stance==='supports').length; const qualityRows=evidenceQuality(ev).items; const quality=qualityRows.length?qualityRows.reduce((a,e)=>a+e.quality,0)/qualityRows.length:0; return {segmentCount:segs.size,methodCount:methods.size,independentSourceCount,contradictionRate:Number((contradicting/Math.max(1,ev.length)).toFixed(3)),supportRate:Number((supported/Math.max(1,ev.length)).toFixed(3)),quality:Number(quality.toFixed(3)),breadthScore:Number((0.4*Math.min(1,segs.size/3)+0.35*Math.min(1,independentSourceCount/4)+0.25*Math.min(1,methods.size/3)).toFixed(3))}; }
function triangulation(evidence=[]){
  const ev=evidence.map(normalizeEvidence),counts=new Map();for(const e of ev)counts.set(e.sourceType,(counts.get(e.sourceType)||0)+1);
  const methodCount=counts.size,supporting=ev.filter(e=>e.stance==='supports').length,contradictory=ev.filter(e=>e.stance==='contradicts').length;
  const independentSources=new Set(ev.map(e=>e.sourceId||e.participantId||e.provenance?.documentId||e.sourceType).filter(Boolean)).size;
  const segmentCount=new Set(ev.map(e=>e.segment).filter(Boolean)).size;
  const sourceDiversity=methodCount?Math.min(1,methodCount/3):0;
  const independence=independentSources?Math.min(1,independentSources/4):0;
  const coverage=segmentCount?Math.min(1,segmentCount/3):0;
  const contradictionPenalty=Math.min(.5,contradictory*.15);
  const status=methodCount>=3&&contradictory===0&&independentSources>=3?'CONVERGING':methodCount>=2?'TRIANGULATED':'SINGLE_METHOD';
  const confidence=Math.max(0,Math.min(1,.45*sourceDiversity+.35*independence+.20*coverage-contradictionPenalty));
  return{methodCount,methodCounts:Object.fromEntries(counts),supporting,contradictory,independentSources,segmentCount,sourceDiversity:Number(sourceDiversity.toFixed(3)),independence:Number(independence.toFixed(3)),coverage:Number(coverage.toFixed(3)),status,confidence:Number(confidence.toFixed(3)),convergence:status==='CONVERGING'?'high':status==='TRIANGULATED'?'medium':'low'};
}
function opportunityConfidence({evidenceIds=[],evidenceById=new Map(),themeSupport=1,coverageScore=0.5,contradictions=0,gapCount=0}={}){
  const qs=evidenceIds.map(id=>evidenceById.get(id)?.quality||0.4);const eq=qs.length?qs.reduce((a,b)=>a+b,0)/qs.length:0;const contradictionPenalty=Math.min(0.35,contradictions*0.08);const gapPenalty=Math.min(0.3,gapCount*0.06);const score=clamp01(0.42*eq+0.28*clamp01(themeSupport)+0.2*clamp01(coverageScore)-contradictionPenalty-gapPenalty);return Number(score.toFixed(3));
}
function opportunityScore(o={}){const confidence=typeof o.confidence==='number'?o.confidence:clamp01(Number(o.evidenceStrength||5)/10);const customer=clamp(o.customerImportance)/10,reach=clamp(o.customerReach)/10,strategic=clamp(o.strategicRelevance)/10,market=clamp(o.marketRelevance)/10;return Number((10*(0.3*customer+0.2*reach+0.2*strategic+0.1*market+0.2*confidence)).toFixed(2));}
function assumptionRisk(a={}){const importance=clamp(a.importance||a.impact)/10;const uncertainty=clamp(a.uncertainty||a.risk||5)/10;const evidence=clamp(Number(a.evidenceStrength||0))/10;const cost=clamp(Number(a.costOfError||a.cost_of_error||5))/10;return Number((100*(0.4*importance+0.3*uncertainty+0.2*(1-evidence)+0.1*cost)).toFixed(2));}
function generateAssumptions(opportunities=[]){return opportunities.slice(0,6).map(o=>({id:ID('A'),text:`Users will experience enough value from addressing “${o.label}” to change the target outcome.`,opportunityId:o.id,assumptionType:'desirability',importance:Number(Math.min(10,4+o.score/2).toFixed(1)),uncertainty:Number((10-(o.confidence||0.5)*10).toFixed(1)),evidenceStrength:Number(((o.confidence||0.5)*10).toFixed(1)),costOfError:o.score>=7?8:5,leapOfFaith:(o.confidence||0)<0.5,source:'stage1_opportunity',risk:assumptionRisk({importance:Math.min(10,4+o.score/2),uncertainty:10-(o.confidence||0.5)*10,evidenceStrength:(o.confidence||0.5)*10,costOfError:o.score>=7?8:5})}));}
function generateSolutions(opportunities=[]){return opportunities.slice(0,5).flatMap(o=>[
  {id:ID('SOL'),opportunityId:o.id,title:`Improve the core experience for ${o.label}`,description:'Directly address the identified opportunity with the smallest viable product change.',status:'candidate',rationale:'Direct solution path.',desirabilityScore:o.confidence*10,riskScore:10-o.confidence*10},
  {id:ID('SOL'),opportunityId:o.id,title:`Test an assisted/manual path for ${o.label}`,description:'Validate the opportunity with a low-cost service or concierge intervention before building deeply.',status:'candidate',rationale:'Low-cost validation path.',desirabilityScore:o.confidence*10,riskScore:5},
  {id:ID('SOL'),opportunityId:o.id,title:`Improve guidance and trust around ${o.label}`,description:'Address uncertainty or friction with clearer information, feedback or reassurance.',status:'candidate',rationale:'Risk-reduction path.',desirabilityScore:o.confidence*8,riskScore:4}
 ]);}
function buildOST({outcome,opportunities=[],solutions=[],assumptions=[]}={}){const root={id:ID('OUT'),type:'outcome',label:normalizeText(outcome)||'Desired outcome',children:[]};for(const o of opportunities){const node={id:o.id||ID('OPP'),type:'opportunity',label:normalizeText(o.label||o.text),score:o.score,confidence:o.confidence,evidenceIds:o.evidenceIds||[],children:[]};for(const s of solutions.filter(x=>x.opportunityId===node.id))node.children.push({...s,id:s.id||ID('SOL'),type:'solution',assumptionIds:assumptions.filter(a=>a.solutionId===s.id||a.opportunityId===node.id).map(a=>a.id),children:[]});root.children.push(node);}return root;}
const STAGE1_POLICY={version:'stage1-v3',minimumEvidence:3,minimumQuality:.5,minimumSegmentCoverage:.5,minimumMethods:2,minimumTriangulationConfidence:.35,criticalContradictionsBlock:true,unsupportedHighImpactBlock:true,requireClaimVerification:true};
function discoveryGate(bundle={}){
  const errors=[],warnings=[];const desiredOutcome=normalizeText(bundle.desiredOutcome),question=normalizeText(bundle.researchQuestion);if(!desiredOutcome)errors.push('desired_outcome_missing');if(!question)errors.push('research_question_missing');const qd=bundle.questionUnderstanding||classifyQuestionDetailed(question);const qt=bundle.questionType||qd.type;if(!QUESTION_TYPES.has(qt))errors.push('invalid_question_type');
  if(!bundle.method)warnings.push('research_method_missing');if(bundle.method){const mf=methodFit(qt,bundle.method);if(mf.fit==='LOW')warnings.push('method_fit_low');}
  const ev=bundle.evidence||[],quality=bundle.evidenceQuality||evidenceQuality(ev),contradictions=bundle.contradictions||detectContradictions(ev),cov=bundle.coverage||coverage(ev,bundle.segments||[]),tri=bundle.triangulation||triangulation(ev),dimensions=bundle.evidenceDimensions||evidenceDimensions(ev,bundle.segments||[]),gaps=bundle.evidenceGaps||evidenceGaps({questionType:qt,evidence:ev,quality,contradictions,decisionImpact:qd.decisionImpact});
  if(ev.length<STAGE1_POLICY.minimumEvidence)warnings.push('insufficient_evidence');if(dimensions.segmentCount<2)warnings.push('segment_coverage_low');if(dimensions.independentSourceCount<2)warnings.push('source_independence_low');if(tri.methodCount<STAGE1_POLICY.minimumMethods)warnings.push('single_method_evidence');if(contradictions.length)warnings.push('contradictions_unresolved');if(gaps.length)warnings.push('evidence_gaps');if(!cov.segments)warnings.push('segment_coverage_missing');if(cov.segments<2)warnings.push('low_segment_diversity');if(tri.confidence<STAGE1_POLICY.minimumTriangulationConfidence)warnings.push('low_triangulation_confidence');if(quality.aggregate<STAGE1_POLICY.minimumQuality)warnings.push('low_evidence_quality');
  const assumptions=bundle.assumptions||[],leap=assumptions.filter(a=>Boolean(a.leapOfFaith)||assumptionRisk(a)>=55);if(leap.length)warnings.push('leap_of_faith_assumptions');
  const highContradictions=contradictions.filter(c=>c.severity==='high').length;const status=errors.length?'BLOCK':((STAGE1_POLICY.criticalContradictionsBlock&&highContradictions)||gaps.some(g=>g.severity==='high')||leap.length||quality.aggregate<STAGE1_POLICY.minimumQuality||tri.confidence<STAGE1_POLICY.minimumTriangulationConfidence)?'INVESTIGATE':'READY';
  const nextAction=status==='READY'?'Convert discovery into a decision or low-cost validation.':contradictions.length?'Resolve contradictions before generalizing.':leap.length?'Test the highest-risk leap-of-faith assumption.':gaps.length?'Collect the smallest evidence set that closes the highest-impact gap.':'Improve evidence quality and coverage.';
  return{status,errors,warnings,policyVersion:STAGE1_POLICY.version,policy:STAGE1_POLICY,questionType:qt,questionUnderstanding:qd,coverage:cov,evidenceDimensions:dimensions,triangulation:tri,evidenceQuality:quality,contradictions,evidenceGaps:gaps,criticalAssumptions:leap,nextAction};
}
function analyzeDiscovery(input={}){
  const evidenceQualityResult=evidenceQuality(input.evidence||[]);const evidence=evidenceQualityResult.items;const questionUnderstanding=classifyQuestionDetailed(input.researchQuestion);const qt=input.questionType&&QUESTION_TYPES.has(input.questionType)?input.questionType:questionUnderstanding.type;
  const requirements=evidenceRequirements(qt,questionUnderstanding.decisionImpact);const fit=input.method?methodFit(qt,input.method):null;const codes=(input.codes||[]).filter(c=>CODE_TYPES.has(c.type)||c.type);const themes=themeSynthesis(evidence,synthesize(evidence,codes));const contradictions=detectContradictions(evidence);const cov=coverage(evidence,input.segments||[]);const tri=triangulation(evidence);const gaps=evidenceGaps({questionType:qt,evidence,quality:evidenceQualityResult,contradictions,decisionImpact:questionUnderstanding.decisionImpact});const evMap=new Map(evidence.map(e=>[e.id,e]));
  const baseOpps=(input.opportunities||themes.themes.slice(0,6).map(t=>({id:ID('OPP'),label:t.label,evidenceIds:t.evidenceIds,customerImportance:6,customerReach:cov.segments?7:5,strategicRelevance:6,marketRelevance:5,themeSupport:t.confidence}))).map(o=>{const conf=opportunityConfidence({evidenceIds:o.evidenceIds||[],evidenceById:evMap,themeSupport:o.themeSupport||0.5,coverageScore:cov.segments?1:0.4,contradictions:contradictions.filter(c=>(o.evidenceIds||[]).includes(c.evidenceA)||(o.evidenceIds||[]).includes(c.evidenceB)).length,gapCount:gaps.length});return{...o,confidence:conf,score:opportunityScore({...o,confidence:conf}),evidenceIds:o.evidenceIds||[]};});
  const assumptions=generateAssumptions(baseOpps),solutions=input.solutions?.length?input.solutions:generateSolutions(baseOpps);const ost=buildOST({outcome:input.desiredOutcome,opportunities:baseOpps,solutions,assumptions});const gate=discoveryGate({desiredOutcome:input.desiredOutcome,researchQuestion:input.researchQuestion,questionType:qt,questionUnderstanding,method:input.method,evidence,contradictions,coverage:cov,triangulation:tri,evidenceQuality:evidenceQualityResult,evidenceGaps:gaps,opportunities:baseOpps,assumptions});
  const brief=discoveryBrief(input);const questionQuality=scoreQuestionQuality(input.researchQuestion,brief);const advancedTri=advancedTriangulation(evidence);const segmentInsights=segmentSynthesis(evidence,baseOpps);const opportunityQualityMap=Object.fromEntries(baseOpps.map(o=>[o.id,opportunityQuality(o,evMap,contradictions,gaps)]));const enrichedOpportunities=baseOpps.map(o=>({...o,quality:opportunityQualityMap[o.id]}));const solutionQualityReport=solutions.map(solutionQuality);const coverageMatrix=discoveryCoverageMatrix(evidence,input.segments||[],requirements.required);const stop=discoveryStopCondition({questionQuality,triangulation:advancedTri,opportunities:enrichedOpportunities,contradictions,evidenceGaps:gaps,assumptions});const nextActions=discoveryNextActions({questionQuality,evidenceGaps:gaps,contradictions,opportunities:enrichedOpportunities,triangulation:advancedTri,assumptions});const researchLoop={cadence:'continuous',weeklyTouchpointRecommended:true,updateFunction:'researchUpdate',saturation:opportunitySaturation(evidence,baseOpps)};return{questionType:qt,questionUnderstanding,methodFit:fit,methodRecommendation:methodRecommendation(qt,brief),discoveryBrief:brief,questionQuality,evidenceRequirements:requirements,evidence,atomicEvidence:epistemicNormalize(evidenceAtomize(evidence)),codes:synthesize(evidence,codes),themes:themes.themes,themeCoverage:themes.coverage,contradictions,coverage:cov,coverageMatrix,segmentInsights,triangulation:advancedTri,evidenceQuality:evidenceQualityResult,evidenceGaps:gaps,opportunities:enrichedOpportunities,assumptions,solutions,solutionQuality:solutionQualityReport,ost,gate,stopCondition:stop,nextActions,researchLoop,epistemicLevels:DISCOVERY_EPISTEMIC_LEVELS,confidenceDecomposition:{evidenceQuality:evidenceQualityResult.aggregate,triangulation:advancedTri.confidence,segmentCoverage:Math.min(1,cov.segments/3),sourceIndependence:Math.min(1,advancedTri.independentUnits/4),contradictionResolution:Math.max(0,1-Math.min(1,contradictions.length/5))},downstream:{decisionSeed:{title:input.desiredOutcome||'Discovery-derived decision',problem:input.researchQuestion||'',status:gate.status==='READY'?'validate':'validate',discoveryId:input.id||null},assumptionIds:assumptions.map(a=>a.id),opportunityIds:baseOpps.map(o=>o.id),solutionIds:solutions.map(s=>s.id),evidenceIds:evidence.map(e=>e.id),experimentSeeds:assumptions.filter(a=>a.leapOfFaith).map(a=>({assumptionId:a.id,hypothesis:a.text,testType:'lowest-cost-credible-test'}))},generatedAt:new Date().toISOString()};
}


// --- Stage 1 v4: rigorous continuous-discovery controls --------------------
const QUESTION_QUALITY_POLICY={minScore:0.70,weights:{specificity:.18,decisionRelevance:.18,measurability:.16,falsifiability:.14,biasRisk:.12,actionability:.12,scope:.10}};
const SOLUTION_TERMS=/\b(dashboard|feature|button|screen|api|notification|workflow|ai|chatbot|automation|redesign|build|add|create|implement)\b/i;
const DISCOVERY_EPISTEMIC_LEVELS=['FACT','OBSERVATION','INTERPRETATION','OPPORTUNITY','HYPOTHESIS','RECOMMENDATION'];
function discoveryBrief(input={}){
  const outcome=normalizeText(input.desiredOutcome||input.outcome), question=normalizeText(input.researchQuestion||input.question);
  const segments=[...new Set([...(input.segments||[]).map(normalizeText),...(input.evidence||[]).map(e=>normalizeText(e.segment||e.audience)).filter(Boolean)])];
  const constraints=Array.isArray(input.constraints)?input.constraints.map(normalizeText).filter(Boolean):[];
  return {outcome,question,targetSegments:segments,constraints,decision:normalizeText(input.decision?.title||input.decision),timeHorizon:normalizeText(input.timeHorizon),knownUncertainties:Array.isArray(input.knownUncertainties)?input.knownUncertainties.map(normalizeText).filter(Boolean):[]};
}
function scoreQuestionQuality(question='',brief={}){
  const q=normalizeText(question), lower=q.toLowerCase();
  if(!q) return {score:0,decision:'BLOCK',dimensions:{},issues:['missing_question'],rewrite:'State one observable customer or business question.'};
  const dimensions={
    specificity:Math.min(1,(/\b(users|customers|buyers|operators|admins|segment|persona)\b/i.test(q)?0.35:0)+(/\b(when|during|after|before|within|among)\b/i.test(q)?0.25:0)+Math.min(.4,q.split(/\s+/).length/25)),
    decisionRelevance:brief.outcome||brief.decision?(/\b(should|which|whether|what|why|how)\b/i.test(q)?.95:.65):.55,
    measurability:/\b(rate|frequency|percentage|conversion|retention|time|completion|error|abandon|increase|decrease|metric|measure|how many|how often)\b/i.test(q)?1:.55,
    falsifiability:/\b(why|whether|does|will|can|cause|effect|impact|improve|compare|predict)\b/i.test(q)?1:.58,
    biasRisk:/\b(why don't users like|prove|obviously|best|always|never|everyone|nobody)\b/i.test(lower)?.25:.9,
    actionability:/\b(should|priorit|test|change|improve|reduce|increase|choose|invest|stop|continue)\b/i.test(q)?1:.65,
    scope:q.split(/\s+/).length<=35?1:.55
  };
  const score=Object.entries(QUESTION_QUALITY_POLICY.weights).reduce((a,[k,w])=>a+w*dimensions[k],0);
  const issues=[]; if(dimensions.specificity<.7)issues.push('scope_or_segment_unclear'); if(dimensions.measurability<.7)issues.push('outcome_not_measurable'); if(dimensions.falsifiability<.7)issues.push('not_falsifiable'); if(dimensions.biasRisk<.7)issues.push('leading_or_absolute_language'); if(dimensions.actionability<.7)issues.push('weak_decision_link');
  let rewrite=q; if(issues.length){const segment=brief.targetSegments[0]||'the target segment'; if(/^why\s+/i.test(q)) rewrite=`For ${segment}, what factors explain ${q.replace(/^why\s+/i,'').replace(/[?]$/,'')}?`; else if(/^how often\s+/i.test(q)) rewrite=`Among ${segment}, ${q.replace(/^how often\s+/i,'How often ').replace(/[?]$/,'').replace(/^How often /,'how often ')}?`; else rewrite=`For ${segment}, what evidence could confirm or refute: ${q.replace(/[?]$/,'')}?`; }
  return {score:Number(score.toFixed(3)),decision:score>=QUESTION_QUALITY_POLICY.minScore?'PASS':'BLOCK',dimensions,issues,rewrite};
}
function methodRecommendation(questionType,context={}){
  const ranked=Object.entries(METHOD_SCORES[questionType]||METHOD_SCORES.exploratory).sort((a,b)=>b[1]-a[1]);
  const constraints=(context.constraints||[]).join(' ').toLowerCase();
  const adjusted=ranked.map(([method,score])=>({method,score,tradeoffs:constraints&&method==='experiment'&&/time|budget|ethical/.test(constraints)?'May be slower or constrained by the stated context.':score>=5?'Direct fit':'Use as corroboration.'}));
  return {primary:adjusted[0]?.method||null,alternatives:adjusted.slice(1,4)};
}
function evidenceAtomize(evidence=[]){
  return evidence.map(normalizeEvidence).flatMap(e=>{
    const text=e.content; const atoms=[];
    atoms.push({id:ID('NUG'),evidenceId:e.id,type:'observation',text,epistemicLevel:e.level||'FACT',sourceId:e.sourceId||null,segment:e.segment||null});
    if(e.quote) atoms.push({id:ID('NUG'),evidenceId:e.id,type:'quote',text:e.quote,epistemicLevel:'FACT',sourceId:e.sourceId||null,segment:e.segment||null});
    return atoms;
  });
}
function epistemicNormalize(items=[]){return items.map(x=>{const level=DISCOVERY_EPISTEMIC_LEVELS.includes(x.epistemicLevel)?x.epistemicLevel:(DISCOVERY_EPISTEMIC_LEVELS.includes(x.level)?x.level:'INTERPRETATION');return {...x,epistemicLevel:level};});}
function evidenceIndependence(evidence=[]){
  const ev=evidence.map(normalizeEvidence); const clusters=new Map();
  for(const e of ev){const key=e.provenance?.datasetId||e.provenance?.studyId||e.provenance?.documentId||e.sourceId||e.participantId||`${e.sourceType}:${e.segment}`; if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(e.id);}
  return {independentUnits:clusters.size,clusters:[...clusters.entries()].map(([key,ids])=>({key, evidenceIds:ids}))};
}
function advancedTriangulation(evidence=[]){
  const base=triangulation(evidence),ind=evidenceIndependence(evidence),ev=evidence.map(normalizeEvidence);
  const methods=new Set(ev.map(e=>e.sourceType)),segments=new Set(ev.map(e=>e.segment).filter(Boolean));
  const qualityRows=evidenceQuality(ev).items; const quality=qualityRows.length?qualityRows.reduce((a,e)=>a+e.quality,0)/qualityRows.length:0;
  const independence=Math.min(1,ind.independentUnits/4), methodDiversity=Math.min(1,methods.size/3), segmentDiversity=Math.min(1,segments.size/3);
  const contradictionRate=ev.length?ev.filter(e=>e.stance==='contradicts').length/ev.length:0;
  const confidence=Math.max(0,Math.min(1,.30*quality+.25*independence+.20*methodDiversity+.15*segmentDiversity+.10*(1-contradictionRate)));
  return {...base,independentUnits:ind.independentUnits,independence:Number(independence.toFixed(3)),confidence:Number(confidence.toFixed(3)),independenceClusters:ind.clusters};
}
function segmentSynthesis(evidence=[],opportunities=[]){
  const ev=evidence.map(normalizeEvidence),segments=[...new Set(ev.map(e=>e.segment).filter(Boolean))];
  return segments.map(segment=>{const rows=ev.filter(e=>e.segment===segment), quality=rows.length?rows.reduce((a,e)=>a+e.quality,0)/rows.length:0; const themes=synthesize(rows).slice(0,5).map(t=>t.label); return {segment,evidenceCount:rows.length,methodCount:new Set(rows.map(e=>e.sourceType)).size,quality:Number(quality.toFixed(3)),themes,opportunityIds:opportunities.filter(o=>(o.segments||[]).includes(segment)||(o.evidenceIds||[]).some(id=>rows.some(e=>e.id===id))).map(o=>o.id)};});
}
function solutionQuality(solution={}){const text=`${solution.title||''} ${solution.description||''}`; const solutionShaped=SOLUTION_TERMS.test(text); return {solutionShaped,score:solutionShaped?.55:.95,issue:solutionShaped?'contains_solution_or_feature_language':null,opportunityId:solution.opportunityId||null};}
function opportunityQuality(opportunity={},evidenceById=new Map(),contradictions=[],gaps=[]){
  const ids=opportunity.evidenceIds||[],evs=ids.map(id=>evidenceById.get(id)).filter(Boolean),text=normalizeText(opportunity.label); const solutionShaped=SOLUTION_TERMS.test(text); const direct=evs.length?evs.reduce((a,e)=>a+e.quality,0)/evs.length:0; const contradictionCount=contradictions.filter(c=>ids.includes(c.evidenceA)||ids.includes(c.evidenceB)).length; const gapPenalty=Math.min(.25,gaps.length*.03); const score=Math.max(0,Math.min(1,.45*direct+.20*(opportunity.themeSupport||opportunity.confidence||.5)+.15*Math.min(1,evs.length/4)+.10*(solutionShaped?0:.1)+.10*(contradictionCount?0:.1)-gapPenalty)); return {score:Number(score.toFixed(3)),solutionShaped,solutionLanguageIssue:solutionShaped?'rewrite_as_customer_need':null,evidenceCount:evs.length,contradictionCount,gapCount:gaps.length};
}
function opportunitySaturation(newEvidence=[],existingOpportunities=[]){
  const ev=newEvidence.map(normalizeEvidence); return existingOpportunities.map(o=>{const texts=ev.map(e=>e.content); const sims=texts.map(t=>jaccard(t,o.label)); const max=sims.length?Math.max(...sims):0; return {opportunityId:o.id,similarity:Number(max.toFixed(3)),status:max>=.45?'REINFORCES':max>=.25?'RELATED':'NEW'};});
}
function discoveryCoverageMatrix(evidence=[],segments=[],requirements=[]){
  const ev=evidence.map(normalizeEvidence),segs=[...new Set([...segments.map(normalizeText),...ev.map(e=>e.segment)].filter(Boolean))];
  return segs.map(segment=>{const rows=ev.filter(e=>e.segment===segment); return {segment,requirements:requirements.map(r=>({requirement:r,supported:rows.some(e=>`${e.content} ${e.sourceType}`.toLowerCase().includes(r.toLowerCase().split(' ')[0]))})),evidenceCount:rows.length,methods:[...new Set(rows.map(e=>e.sourceType))]};});
}
function discoveryStopCondition({questionQuality={},gate={},triangulation={},opportunities=[],contradictions=[],evidenceGaps=[],assumptions=[]}={}){
  const unresolvedCritical=contradictions.filter(c=>c.severity==='high').length+evidenceGaps.filter(g=>g.severity==='high').length; const highRisk=assumptions.filter(a=>assumptionRisk(a)>=55).length; const strongOpp=opportunities.filter(o=>(o.quality?.score||o.confidence||0)>=.7).length;
  const ready=questionQuality.score>=.7&&unresolvedCritical===0&&triangulation.confidence>=.55&&strongOpp>0&&highRisk===0;
  return {status:ready?'STOP_READY':'CONTINUE_LEARNING',reasons:ready?['question_is_decision_ready','evidence_is_sufficient','critical_uncertainty_resolved']:['close_high_impact_evidence_gaps',...(unresolvedCritical?['resolve_critical_contradictions_or_gaps']:[]),...(highRisk?['test_high_risk_assumptions']:[]),...(strongOpp===0?['strengthen_opportunity_evidence']:[])],recommendedAction:ready?'Move to decision/low-cost validation.':'Collect the smallest evidence set that reduces the highest-impact uncertainty.'};
}
function discoveryNextActions({questionQuality={},evidenceGaps=[],contradictions=[],opportunities=[],triangulation={},assumptions=[]}={}){
  const actions=[]; if(questionQuality.decision==='BLOCK')actions.push({priority:'P0',action:'Rewrite the research question using the suggested formulation.'});
  contradictions.filter(c=>c.severity==='high').slice(0,2).forEach(c=>actions.push({priority:'P0',action:`Resolve contradiction ${c.id} with segment/time/measurement context.`}));
  evidenceGaps.filter(g=>g.severity==='high').slice(0,3).forEach(g=>actions.push({priority:'P1',action:`Collect evidence for ${g.requirement}.`}));
  if(triangulation.confidence<.55)actions.push({priority:'P1',action:'Add an independent method or source to reduce correlated evidence risk.'});
  const top=[...opportunities].sort((a,b)=>(b.score||0)-(a.score||0))[0]; if(top)actions.push({priority:'P1',action:`Test the riskiest assumption attached to ${top.id}.`});
  assumptions.filter(a=>assumptionRisk(a)>=55).slice(0,2).forEach(a=>actions.push({priority:'P1',action:`Run the lowest-cost credible test for ${a.id}.`}));
  return actions.slice(0,8);
}
function researchUpdate(previous={},incomingEvidence=[]){
  const existing=Array.isArray(previous.evidence)?previous.evidence:[]; const incoming=incomingEvidence.map(normalizeEvidence); const byId=new Map(existing.map(e=>[e.id,e])); for(const e of incoming)byId.set(e.id,e); const evidence=[...byId.values()]; const opportunities=previous.opportunities||[]; const saturation=opportunitySaturation(incoming,opportunities); return {evidence,opportunities,delta:{newEvidenceIds:incoming.map(e=>e.id),reinforcedOpportunities:saturation.filter(x=>x.status==='REINFORCES').map(x=>x.opportunityId),relatedOpportunities:saturation.filter(x=>x.status==='RELATED').map(x=>x.opportunityId),newOpportunitySignal:saturation.filter(x=>x.status==='NEW').length>0},updatedAt:new Date().toISOString()};
}



// --- Stage 1 v5: Deep Research + Human Evidence ----------------------------
const DEEP_RESEARCH_POLICY={
  version:'stage1-v5-deep-research',
  targetSources:60,
  minimumIndependentSources:40,
  minimumReadyQuality:.85,
  minimumPublisherDiversity:6,
  minimumHumanParticipants:{low:3,medium:5,high:10},
  minimumGoldCases:50,
  minimumIndependentEvaluators:2,
  saturationWindow:10,
  saturationNoveltyThreshold:.08,
  minimumSourceQuality:.55,
  allowedEvidenceLevels:DISCOVERY_EPISTEMIC_LEVELS,
  humanEvidenceTypes:['interview','survey','usability','contextual_inquiry','customer_call','support'],
  syntheticHumanLabel:'SYNTHETIC_RESPONSE_NOT_EMPIRICAL'
};
const SOURCE_CLASSES=['primary_research','academic','industry_report','government_regulatory','company_documentation','competitor','customer_voice','news_media','technical_publication','dataset','other'];
function sourceClass(v){const t=normalizeText(v).toLowerCase();if(!t)return'other';const aliases={academic:'academic',research:'primary_research','primary':'primary_research','industry':'industry_report','government':'government_regulatory','regulatory':'government_regulatory','company':'company_documentation','competitor':'competitor','review':'customer_voice','forum':'customer_voice','customer':'customer_voice','news':'news_media','technical':'technical_publication','dataset':'dataset'};return SOURCE_CLASSES.includes(t)?t:aliases[t]||'other';}
function inferSourceClassFromDomain(domain=''){const d=normalizeText(domain).toLowerCase();if(!d)return'other';if(/\.(gov|gov\.[a-z]{2}|gouv\.|go\.)/.test(d))return'government_regulatory';if(/(nih|pubmed|nature|sciencedirect|springer|jstor|arxiv|acm\.|ieee\.)/.test(d))return'academic';if(/(sec\.|investor|annualreport|ir\.)/.test(d))return'primary_research';if(/(statista|gartner|forrester|mckinsey|bcg|deloitte|pwc|kpmg|ey\.)/.test(d))return'industry_report';if(/(reddit\.|quora\.|trustpilot|g2\.|capterra)/.test(d))return'customer_voice';if(/(github\.|gitlab\.|developer\.|docs\.)/.test(d))return'company_documentation';if(/(techcrunch|theverge|wired|reuters|bloomberg|wsj|nytimes)/.test(d))return'news_media';return'other';}
function sourceTopicTerms(text=''){const counts=new Map();for(const t of tokenize(text)){if(t.length<5)continue;counts.set(t,(counts.get(t)||0)+1);}return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t])=>t);}
function normalizeResearchSource(s={},index=0){
  const url=normalizeText(s.url||s.uri||s.link), title=normalizeText(s.title||s.name||`Source ${index+1}`), publisher=normalizeText(s.publisher||s.domain||'');
  const content=normalizeText(s.content||s.excerpt||s.snippet||title), domain=normalizeText(s.domain||(url.match(/^https?:\/\/([^/]+)/i)||[])[1]||publisher), cls=sourceClass(s.sourceClass||s.category||s.type)||inferSourceClassFromDomain(domain);
  const underlyingId=normalizeText(s.underlyingSourceId||s.studyId||s.datasetId||s.provenance?.studyId||s.provenance?.datasetId||'');
  const fingerprint=underlyingId||normalizeText(s.canonicalUrl||url).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/[#?].*$/,'').replace(/\/$/,'');
  const defaultAuthority=(cls==='government_regulatory'||cls==='academic'||cls==='primary_research')?.9:((cls==='industry_report'||cls==='dataset')?.78:(cls==='technical_publication'?.72:.6)); const authority=clamp01(s.authority??defaultAuthority);
  const relevance=clamp01(s.relevance??(content?0.8:0.4)), recency=clamp01(s.recency??0.75), transparency=clamp01(s.methodTransparency??0.65), primary=clamp01(s.primaryEvidence??(['primary_research','academic','government_regulatory','dataset'].includes(cls)?0.9:.55));
  const quality=Number((.28*authority+.22*relevance+.16*recency+.16*transparency+.18*primary).toFixed(3));
  const publisherKey=normalizeText(s.publisherKey||publisher||domain).toLowerCase().replace(/^www\./,'');
  const topicTerms=Array.isArray(s.topicTerms)&&s.topicTerms.length?s.topicTerms.slice(0,8):sourceTopicTerms(content);
  return {id:normalizeText(s.id)||ID('SRC'),url,title,publisher,domain,sourceClass:cls==='other'&&domain?inferSourceClassFromDomain(domain):cls,content,underlyingSourceId:underlyingId,canonicalKey:fingerprint,authority,relevance,recency,methodTransparency:transparency,primaryEvidence:primary,quality,publisherKey,topicTerms,independenceKey:fingerprint||`${publisherKey}|${title.toLowerCase()}`,excluded:Boolean(s.excluded),exclusionReason:normalizeText(s.exclusionReason)};
}
function dedupeResearchSources(sources=[]){
  const groups=new Map(), duplicates=[],related=[];
  for(const raw of sources){
    const s=normalizeResearchSource(raw,groups.size);
    const key=s.independenceKey||s.id;
    if(groups.has(key)){duplicates.push({...s,duplicateOf:groups.get(key).id,duplicateReason:'same_canonical_source'});continue;}
    let relatedTo=null;
    for(const prior of groups.values()){
      const samePublisher=prior.publisherKey&&s.publisherKey&&prior.publisherKey===s.publisherKey;
      const sim=jaccard(`${prior.title} ${prior.content}`,`${s.title} ${s.content}`);
      if((samePublisher&&sim>=.72)||sim>=.96){relatedTo=prior.id;break;}
    }
    if(relatedTo){related.push({...s,relatedTo,relationshipConfidence:'medium'});}
    groups.set(key,s);
  }
  const retained=[...groups.values()];
  const independent=retained.filter(s=>!s.excluded&&s.quality>=DEEP_RESEARCH_POLICY.minimumSourceQuality);
  const publisherKeys=new Set(independent.map(s=>s.publisherKey).filter(Boolean));
  return {retained,duplicates,related,independentCount:independent.length,independentPublisherCount:publisherKeys.size,underlyingGroups:retained.length};
}
function sourceDiversity(sources=[]){
  const rows=sources.filter(s=>!s.excluded).map(s=>normalizeResearchSource(s));
  const counts=Object.fromEntries(SOURCE_CLASSES.map(c=>[c,0]));for(const s of rows)counts[s.sourceClass]=(counts[s.sourceClass]||0)+1;
  const occupied=Object.values(counts).filter(Boolean).length;
  const publisherCount=new Set(rows.map(s=>s.publisherKey).filter(Boolean)).size;
  const classEntropy=occupied>1?(-Object.values(counts).filter(Boolean).reduce((sum,n)=>{const p=n/rows.length;return sum+p*Math.log(p)},0)/Math.log(occupied)):occupied?1:0;
  const publisherConcentration=rows.length?1-(Math.max(...Object.values(rows.reduce((m,s)=>(m[s.publisherKey||'unknown']=(m[s.publisherKey||'unknown']||0)+1,m),{})))/rows.length):0;
  const classScore=rows.length?Math.min(1,classEntropy):0;
  const publisherScore=Math.min(1,publisherCount/10)*Math.max(0,publisherConcentration);
  return {counts,occupiedClasses:occupied,publisherCount,total:rows.length,classEntropy:Number(classScore.toFixed(3)),publisherConcentration:Number(publisherConcentration.toFixed(3)),diversityScore:Number((.65*classScore+.35*publisherScore).toFixed(3))};
}
function discoveryResearchPlan({question='',questionType='exploratory',decisionImpact='medium',segments=[],desiredOutcome=''}={}){
  const qt=QUESTION_TYPES.has(questionType)?questionType:'exploratory';
  const classes=qt==='causal'?['primary_research','academic','dataset','industry_report','customer_voice','technical_publication']:qt==='descriptive'?['dataset','primary_research','industry_report','customer_voice','government_regulatory','news_media']:qt==='evaluative'?['primary_research','customer_voice','technical_publication','competitor','dataset']:['primary_research','academic','industry_report','customer_voice','competitor','technical_publication','government_regulatory','dataset'];
  const depth=decisionImpact==='high'?'deep':DEEP_RESEARCH_POLICY.targetSources>=60?'deep':'standard';
  return {depth,targetSources:depth==='deep'?60:30,minimumIndependentSources:depth==='deep'?40:20,question:normalizeText(question),questionType:qt,desiredOutcome:normalizeText(desiredOutcome),segments:[...new Set((segments||[]).map(normalizeText).filter(Boolean))],sourceClasses:classes,selectionRule:'Prefer independent, relevant, primary or method-transparent sources; deduplicate related publications and stop at evidence saturation.',humanResearchRequired:decisionImpact==='high'};
}
function researchSaturation({orderedSources=[],themesBefore=[],themesAfter=[]}={}){
  const before=new Set(themesBefore.map(x=>typeof x==='string'?x:x.label).filter(Boolean).map(x=>String(x).toLowerCase()));
  const after=new Set(themesAfter.map(x=>typeof x==='string'?x:x.label).filter(Boolean).map(x=>String(x).toLowerCase()));
  const explicitNew=[...after].filter(x=>!before.has(x));
  const n=orderedSources.length;
  const w=DEEP_RESEARCH_POLICY.saturationWindow;
  const prior=orderedSources.slice(Math.max(0,n-(w*2)),Math.max(0,n-w));
  const tail=orderedSources.slice(Math.max(0,n-w));
  const priorTerms=new Set(prior.flatMap(s=>Array.isArray(s.topicTerms)?s.topicTerms:sourceTopicTerms(`${s.title||''} ${s.content||''}`)));
  const tailTerms=[...new Set(tail.flatMap(s=>Array.isArray(s.topicTerms)?s.topicTerms:sourceTopicTerms(`${s.title||''} ${s.content||''}`)))];
  const unseen=tailTerms.filter(t=>!priorTerms.has(t));
  const noveltyRatio=tailTerms.length?unseen.length/tailTerms.length:1;
  const saturated=n>=DEEP_RESEARCH_POLICY.minimumIndependentSources&&((explicitNew.length===0&&noveltyRatio<=DEEP_RESEARCH_POLICY.saturationNoveltyThreshold)||n>=DEEP_RESEARCH_POLICY.targetSources&&noveltyRatio<=DEEP_RESEARCH_POLICY.saturationNoveltyThreshold);
  return {sourcesAnalyzed:n,newThemes:explicitNew.length,newThemeLabels:explicitNew,noveltyTerms:unseen,noveltyRatio:Number(noveltyRatio.toFixed(3)),saturated,window:w,explanation:saturated?'Marginal source novelty is low across the configured rolling window; additional research should be justified by a named evidence gap.':'Continue research until the source target or a defensible saturation signal is reached.'};
}
function humanResearchEvidence(items=[]){
  return items.map((raw,i)=>{
    const synthetic=Boolean(raw.synthetic)||normalizeText(raw.evidenceStatus).toUpperCase()==='SYNTHETIC'||normalizeText(raw.type).toLowerCase()==='synthetic';
    const participantId=normalizeText(raw.participantId||raw.participant||'');
    const type=synthetic?'synthetic':canonicalSourceType(raw.type||raw.method||'interview');
    const response=normalizeText(raw.response||raw.text||raw.content);
    const observation=normalizeText(raw.observation);
    const consentRecorded=Boolean(raw.consentRecorded);
    const sourceId=normalizeText(raw.sourceId||raw.sessionId||`human-${i+1}`);
    const provenanceComplete=Boolean(participantId&&response&&(raw.method||type)&&sourceId&&normalizeText(raw.segment));
    return {id:raw.id||ID('HUM'),type,evidenceStatus:synthetic?DEEP_RESEARCH_POLICY.syntheticHumanLabel:'REAL_HUMAN_EVIDENCE',participantId,segment:normalizeText(raw.segment),date:normalizeText(raw.date)||new Date().toISOString().slice(0,10),response,observation,researcherInterpretation:normalizeText(raw.researcherInterpretation||raw.interpretation),method:normalizeText(raw.method||type),consentRecorded,sourceId,provenanceComplete,usableForEmpiricalClaims:!synthetic&&consentRecorded&&provenanceComplete};
  });
}
function deepResearchQuality({sources=[],humanEvidence=[],questionQuality={},themes=[],contradictions=[]}={}){
  const normalized=dedupeResearchSources(sources);const retained=normalized.retained.filter(s=>!s.excluded&&s.quality>=DEEP_RESEARCH_POLICY.minimumSourceQuality);const diversity=sourceDiversity(retained);const humans=humanResearchEvidence(humanEvidence);const realHumans=humans.filter(h=>h.evidenceStatus==='REAL_HUMAN_EVIDENCE'&&h.usableForEmpiricalClaims);const synthetic=humans.filter(h=>h.evidenceStatus===DEEP_RESEARCH_POLICY.syntheticHumanLabel);
  const independent=normalized.independentCount;const targetProgress=Math.min(1,independent/DEEP_RESEARCH_POLICY.targetSources);const independenceProgress=Math.min(1,independent/DEEP_RESEARCH_POLICY.minimumIndependentSources);const humanCoverage=Math.min(1,realHumans.length/10);const diversityScore=diversity.diversityScore;const contradictionPenalty=Math.min(.25,contradictions.filter(c=>c.severity==='high').length*.08+contradictions.filter(c=>c.severity!=='high').length*.02);const relatedPenalty=Math.min(.10,normalized.related.length/Math.max(1,retained.length)*.10);const score=clamp01(.25*targetProgress+.25*independenceProgress+.18*diversityScore+.12*humanCoverage+.10*(questionQuality.score||0)+.10*(1-contradictionPenalty)-relatedPenalty);
  return {score:Number(score.toFixed(3)),sources:{discovered:sources.length,retained:retained.length,independent,independentPublishers:normalized.independentPublisherCount,related:normalized.related.length,duplicates:normalized.duplicates.length,target:DEEP_RESEARCH_POLICY.targetSources,minimumIndependent:DEEP_RESEARCH_POLICY.minimumIndependentSources,targetMet:independent>=DEEP_RESEARCH_POLICY.targetSources,minimumMet:independent>=DEEP_RESEARCH_POLICY.minimumIndependentSources},sourceDiversity:diversity,humanResearch:{total:humans.length,real:realHumans.length,synthetic:synthetic.length,consentBackedReal:realHumans.filter(h=>h.consentRecorded).length,syntheticExcludedFromEmpiricalClaims:synthetic.length>0},components:{sourceTargetProgress:Number(targetProgress.toFixed(3)),independenceProgress:Number(independenceProgress.toFixed(3)),sourceDiversity:Number(diversityScore.toFixed(3)),humanCoverage:Number(humanCoverage.toFixed(3)),questionQuality:Number((questionQuality.score||0).toFixed(3)),contradictionPenalty:Number(contradictionPenalty.toFixed(3)),relatedContentPenalty:Number(relatedPenalty.toFixed(3))}};
}
function buildDeepResearchReport(input={}){
  const baseline=analyzeDiscovery(input);const plan=discoveryResearchPlan({question:input.researchQuestion,questionType:baseline.questionType,decisionImpact:baseline.questionUnderstanding.decisionImpact,segments:input.segments,desiredOutcome:input.desiredOutcome});
  const sourceSet=dedupeResearchSources(input.webSources||input.sources||[]);const human=humanResearchEvidence(input.humanEvidence||input.humanResponses||[]);const humanEvidenceForSynthesis=human.filter(h=>h.usableForEmpiricalClaims).map(h=>({id:h.id,content:h.response||h.observation,sourceType:h.method||h.type,sourceId:h.sourceId,participantId:h.participantId,segment:h.segment,date:h.date,level:h.observation?'OBSERVATION':'FACT',quote:h.response,provenance:{humanEvidence:true,evidenceStatus:h.evidenceStatus}}));
  const combinedEvidence=[...baseline.evidence,...humanEvidenceForSynthesis];const combined=analyzeDiscovery({...input,evidence:combinedEvidence});const quality=deepResearchQuality({sources:input.webSources||input.sources||[],humanEvidence:human,questionQuality:combined.questionQuality,themes:combined.themes,contradictions:combined.contradictions});
  const beforeThemes=baseline.themes;const saturation=researchSaturation({orderedSources:sourceSet.retained,themesBefore:beforeThemes,themesAfter:combined.themes});
  const requiresHuman=plan.humanResearchRequired;
  const requiredHumans=DEEP_RESEARCH_POLICY.minimumHumanParticipants[plan.depth==='deep'?'high':'medium']||5;
  const humanReady=!requiresHuman||quality.humanResearch.real>=requiredHumans;
  const sourceReady=quality.sources.targetMet&&quality.sourceDiversity.publisherCount>=DEEP_RESEARCH_POLICY.minimumPublisherDiversity;
  const qualityReady=quality.score>=DEEP_RESEARCH_POLICY.minimumReadyQuality;
  const contradictionReady=!combined.contradictions.some(c=>c.severity==='high');
  const status=sourceReady&&qualityReady&&humanReady&&contradictionReady?'READY_FOR_SYNTHESIS':saturation.saturated?'SATURATED_WITH_GAPS':'CONTINUE_RESEARCH';
  const empiricalGate={status:'BLOCKED_UNTIL_REAL_GOLD',requiredGoldCases:DEEP_RESEARCH_POLICY.minimumGoldCases,requiredIndependentEvaluators:DEEP_RESEARCH_POLICY.minimumIndependentEvaluators,reason:'Engineering readiness and benchmark infrastructure do not constitute empirical validation. Real adjudicated gold is required.'};
  return {protocol:DEEP_RESEARCH_POLICY,plan,sourceAudit:{...sourceSet,retained:sourceSet.retained.map(s=>({...s,content:undefined}))},humanResearch:{records:human.map(h=>({...h,response:h.response?undefined:undefined})),realEvidenceCount:humanEvidenceForSynthesis.length,requiredForPlan:requiredHumans},evidence:combined.evidence,analysis:combined,quality,saturation,status,empiricalGate,epistemicRule:'FACT and OBSERVATION remain distinct from INTERPRETATION, OPPORTUNITY, HYPOTHESIS and RECOMMENDATION; synthetic human responses never enter empirical evidence.',generatedAt:new Date().toISOString()};
}

module.exports={QUESTION_TYPES,METHODS,LEVELS,STAGE1_POLICY,DEEP_RESEARCH_POLICY,SOURCE_CLASSES,normalizeResearchSource,dedupeResearchSources,sourceDiversity,discoveryResearchPlan,researchSaturation,humanResearchEvidence,deepResearchQuality,buildDeepResearchReport,normalizeEvidence,evidenceDimensions,classifyQuestion,classifyQuestionDetailed,evidenceRequirements,methodFit,evidenceQuality,detectContradictions,codeObservation,synthesize,themeSynthesis,evidenceGaps,coverage,triangulation,opportunityConfidence,opportunityScore,assumptionRisk,generateAssumptions,generateSolutions,discoveryGate,buildOST,discoveryBrief,scoreQuestionQuality,methodRecommendation,evidenceAtomize,epistemicNormalize,evidenceIndependence,advancedTriangulation,segmentSynthesis,solutionQuality,opportunityQuality,opportunitySaturation,discoveryCoverageMatrix,discoveryStopCondition,discoveryNextActions,researchUpdate,analyzeDiscovery};

/**
 * Model-backed semantic enrichment. The deterministic functions above remain as
 * a safety baseline, but production semantic discovery can now be delegated to
 * the configured LLM and must pass strict evidence-reference validation before
 * being accepted. No model output is allowed to create evidence that was not
 * supplied by the user.
 */
async function analyzeDiscoverySemantically(input={}, {callSemanticModel}={}){
  if(typeof callSemanticModel!=='function') throw Object.assign(new Error('Semantic model adapter is required'),{code:'SEMANTIC_MODEL_ADAPTER_MISSING'});
  const baseline=analyzeDiscovery(input);
  const evidence=baseline.evidence.map(({id,content,sourceType,participantId,segment,date,strength,confidence,stance,quote,provenance})=>({id,content,sourceType,participantId,segment,date,strength,confidence,stance,quote,provenance}));
  const payload=await callSemanticModel({
    desiredOutcome:normalizeText(input.desiredOutcome),
    researchQuestion:normalizeText(input.researchQuestion),
    candidateMethod:normalizeText(input.method),
    evidence,
    segments:input.segments||[],
    baseline:{questionUnderstanding:baseline.questionUnderstanding,evidenceRequirements:baseline.evidenceRequirements,methodFit:baseline.methodFit,discoveryBrief:baseline.discoveryBrief,questionQuality:baseline.questionQuality,triangulation:baseline.triangulation,coverageMatrix:baseline.coverageMatrix,confidenceDecomposition:baseline.confidenceDecomposition}
  });
  const evidenceIds=new Set(evidence.map(e=>e.id));
  const contract=validateSemanticDiscovery(payload,{evidenceIds:[...evidenceIds]});
  if(!contract.success) throw Object.assign(new Error(`Semantic discovery contract failed: ${contract.error.issues.slice(0,8).map(x=>`${x.path.join('.')} ${x.message}`).join('; ')}`),{code:'DISCOVERY_SEMANTIC_CONTRACT_INVALID',issues:contract.error.issues});
  const requireRefs=(items)=>Array.isArray(items)?items.map(x=>({...x,evidenceIds:Array.isArray(x.evidenceIds)?[...new Set(x.evidenceIds)]:[]})):[];
  const modelCodes=requireRefs(payload.codes);
  const modelThemes=requireRefs(payload.themes);
  const modelClaims=verifyClaims(requireRefs(payload.claims),baseline.evidence);
  const modelOpps=requireRefs(payload.opportunities);
  const modelAssumptions=requireRefs(payload.assumptions);
  const modelSolutions=requireRefs(payload.solutions);
  const unsupported=modelOpps.filter(o=>!(o.evidenceIds||[]).length).map(o=>o.id||o.label||'opportunity');
  const verifiedOpportunity=modelOpps.map(o=>{
    const evs=(o.evidenceIds||[]).map(id=>baseline.evidence.find(e=>e.id===id)).filter(Boolean);
    const contra=baseline.contradictions.filter(c=>(o.evidenceIds||[]).includes(c.evidenceA)||(o.evidenceIds||[]).includes(c.evidenceB));
    const conf=opportunityConfidence({evidenceIds:o.evidenceIds||[],evidenceById:new Map(baseline.evidence.map(e=>[e.id,e])),themeSupport:o.themeSupport||o.confidence||0.5,coverageScore:baseline.coverage.segments?1:0.4,contradictions:contra.length,gapCount:baseline.evidenceGaps.length});
    return {...o,confidence:conf,score:opportunityScore({...o,confidence:conf}),semanticVerification:{evidenceCount:evs.length,contradictions:contra.length,unsupported:evs.length===0}};
  });
  const semanticQuestion=payload.questionUnderstanding&&typeof payload.questionUnderstanding==='object'?payload.questionUnderstanding:baseline.questionUnderstanding;
  const semanticFit=payload.methodFit&&typeof payload.methodFit==='object'?payload.methodFit:baseline.methodFit;
  const gate=discoveryGate({...baseline,questionType:semanticQuestion.type||baseline.questionType,questionUnderstanding:semanticQuestion,method:input.method,evidence:baseline.evidence,contradictions:baseline.contradictions,coverage:baseline.coverage,triangulation:baseline.triangulation,evidenceQuality:baseline.evidenceQuality,evidenceGaps:baseline.evidenceGaps,assumptions:modelAssumptions,opportunities:verifiedOpportunity});
  return {...baseline,questionType:semanticQuestion.type||baseline.questionType,questionUnderstanding:semanticQuestion,methodFit:semanticFit,codes:modelCodes.length?modelCodes:baseline.codes,themes:modelThemes.length?modelThemes:baseline.themes,claims:modelClaims,contradictions:Array.isArray(payload.contradictions)?payload.contradictions:baseline.contradictions,opportunities:verifiedOpportunity.length?verifiedOpportunity:baseline.opportunities,assumptions:modelAssumptions.length?modelAssumptions:baseline.assumptions,solutions:modelSolutions.length?modelSolutions:baseline.solutions,triangulation:payload.triangulation||baseline.triangulation,evidenceDimensions:evidenceDimensions(baseline.evidence,input.segments||[]),gate,semantic:{mode:'llm_verified',contractVersion:'discovery-semantic-v2',model:payload.model||null,promptVersion:payload.promptVersion||null,policyVersion:STAGE1_POLICY.version,verified:true,claimVerification:'hybrid_lexical_guardrail',unsupportedOpportunities:unsupported,verification:'Evidence references are allowlisted against supplied evidence IDs; invalid model output fails closed.'}};
}

module.exports.analyzeDiscoverySemantically=analyzeDiscoverySemantically;
