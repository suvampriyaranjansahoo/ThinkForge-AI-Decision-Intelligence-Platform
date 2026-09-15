'use strict';

const DEFAULT_ENDPOINT='https://api.tavily.com/search';
const {discoveryResearchPlan,normalizeResearchSource,dedupeResearchSources}=require('./productDiscovery');
const {fetchWithResilience}=require('./http');

function cleanQuery(q){return String(q||'').replace(/\s+/g,' ').trim().slice(0,390);}
function buildDeepResearchQueries({question='',desiredOutcome='',segments=[],sourceClasses=[]}={}){
  const q=cleanQuery(question), outcome=cleanQuery(desiredOutcome), segs=(segments||[]).filter(Boolean).slice(0,4), base=[q,outcome].filter(Boolean).join(' ');
  const classQueries={
    primary_research:`${q} primary research empirical study evidence`,academic:`${q} academic research systematic review evidence`,industry_report:`${q} industry report market research benchmark`,government_regulatory:`${q} ${segs.join(' ')} government regulatory official data`,company_documentation:`${q} company documentation product usage customer evidence`,competitor:`${q} competitor alternatives product comparison`,customer_voice:`${q} customer reviews forums user complaints experience`,news_media:`${q} recent news developments market signals`,technical_publication:`${q} technical analysis implementation evidence`,dataset:`${q} dataset statistics data source`
  };
  const selected=[...new Set((sourceClasses.length?sourceClasses:Object.keys(classQueries)).map(c=>classQueries[c]).filter(Boolean))];
  if(base)selected.unshift(`${base} evidence findings risks alternatives`);
  for(const seg of segs){selected.push(`${q} ${seg} customer experience evidence`);selected.push(`${q} ${seg} pain points needs research`);}
  return [...new Set(selected.map(cleanQuery).filter(Boolean))].slice(0,24);
}

async function tavilySearch(query,{apiKey,fetchImpl=globalThis.fetch,endpoint=DEFAULT_ENDPOINT,maxResults=20,searchDepth='advanced',topic='general',sourceClass='other'}={}){
  if(!apiKey) throw Object.assign(new Error('TAVILY_API_KEY is required for live deep web research'),{code:'DEEP_RESEARCH_PROVIDER_NOT_CONFIGURED'});
  if(typeof fetchImpl!=='function') throw Object.assign(new Error('Fetch implementation unavailable'),{code:'DEEP_RESEARCH_FETCH_UNAVAILABLE'});
  const response=await fetchWithResilience(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`},body:JSON.stringify({query,max_results:Math.min(20,Math.max(1,maxResults)),search_depth:searchDepth,topic,include_answer:false,include_raw_content:false})},{provider:'tavily',fetchImpl,retryUnsafe:true,timeoutMs:Number(process.env.TAVILY_TIMEOUT_MS||15000)});
  if(!response.ok){const body=await response.text().catch(()=> '');throw Object.assign(new Error(`Deep research provider returned HTTP ${response.status}`),{code:'DEEP_RESEARCH_PROVIDER_ERROR',status:502,providerBody:body.slice(0,500)});}
  const data=await response.json();
  return (data.results||[]).map(r=>normalizeResearchSource({url:r.url,title:r.title,content:r.content,domain:r.url?.match(/^https?:\/\/([^/]+)/i)?.[1],relevance:r.score,sourceClass,provenance:{provider:'tavily',requestId:data.request_id||null}}));
}

async function runDeepWebSweep(bundle={},{apiKey=process.env.TAVILY_API_KEY,fetchImpl=globalThis.fetch,concurrency=4}={}){
  const plan=discoveryResearchPlan({question:bundle.researchQuestion,questionType:bundle.questionType,decisionImpact:bundle.decisionImpact||'high',segments:bundle.segments,desiredOutcome:bundle.desiredOutcome});
  const queries=buildDeepResearchQueries({...bundle,sourceClasses:plan.sourceClasses});
  const queryClass=(q,i)=>{if(i===0)return'other';return plan.sourceClasses[(i-1)%plan.sourceClasses.length]||'other';};
  const results=[];let cursor=0;
  async function worker(){while(cursor<queries.length){const i=cursor++;try{results.push(...await tavilySearch(queries[i],{apiKey,fetchImpl,sourceClass:queryClass(queries[i],i)}));}catch(error){results.push({query:queries[i],error:{code:error.code||'SEARCH_FAILED',message:error.message}});}}}
  await Promise.all(Array.from({length:Math.min(concurrency,queries.length||1)},()=>worker()));
  const raw=results.filter(x=>x&&x.url);const dedup=dedupeResearchSources(raw);
  return {provider:'tavily',queries,rawResultCount:raw.length,errors:results.filter(x=>x?.error),...dedup,sourceTargetMet:dedup.independentCount>=plan.targetSources,plan};
}
module.exports={buildDeepResearchQueries,tavilySearch,runDeepWebSweep};
