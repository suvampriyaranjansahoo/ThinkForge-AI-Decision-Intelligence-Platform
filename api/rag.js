'use strict';
const {requireUser,requestId}=require('../lib/auth');
const {limit}=require('../lib/rateLimit');
const {applySecurityHeaders,bodySizeOk,hash}=require('../lib/security');
const {rest,rpc}=require('../lib/db');
const {fetchWithResilience}=require('../lib/http');
function normalize(text){return String(text||'').replace(/\u0000/g,' ').replace(/\s+/g,' ').trim()}
function chunk(text,{size=1000,overlap=160,max=500}={}){const clean=normalize(text);const out=[];let i=0;while(i<clean.length&&out.length<max){const t=clean.slice(i,i+size).trim();if(t)out.push(t);if(i+size>=clean.length)break;i+=Math.max(1,size-overlap)}return out}
function lexicalScore(query,text){const q=new Set(normalize(query).toLowerCase().split(/\W+/).filter(x=>x.length>2));const t=new Set(normalize(text).toLowerCase().split(/\W+/));if(!q.size)return 0;let h=0;for(const x of q)if(t.has(x))h++;return h/q.size}
function shingleSet(text,n=5){const words=normalize(text).toLowerCase().split(/\s+/).filter(Boolean);const shingles=new Set();for(let i=0;i+n<=words.length;i++)shingles.add(words.slice(i,i+n).join(' '));if(!shingles.size&&words.length)shingles.add(words.join(' '));return shingles}
function jaccard(a,b){if(!a.size&&!b.size)return 1;if(!a.size||!b.size)return 0;let inter=0;for(const x of a)if(b.has(x))inter++;const union=a.size+b.size-inter;return union?inter/union:0}
// Near-duplicate detection via shingle/Jaccard similarity instead of a naive
// first-80-char prefix match: two chunks that open identically but diverge
// later are no longer wrongly merged, and two chunks with different openings
// but near-identical bodies are now correctly caught.
function rerank(query,hits,{semanticWeight=0.7,lexicalWeight=0.3}={}){
  const scored=[...(hits||[])].map(x=>({...x,rerankScore:semanticWeight*Number(x.rrfScore||0)+lexicalWeight*lexicalScore(query,x.text)})).sort((a,b)=>b.rerankScore-a.rerankScore);
  const threshold=Number(process.env.RAG_DEDUP_JACCARD_THRESHOLD||0.8);
  const seenShingles=[];const out=[];
  for(const item of scored){
    const shingles=shingleSet(item.text);
    if(seenShingles.some(prev=>jaccard(shingles,prev)>=threshold))continue;
    seenShingles.push(shingles);out.push(item);
  }
  return out;
}
// Deterministic fallback used only when no embedding provider is configured
// (AI_API_KEY unset). Mirrors the pattern already used by Assumptions/Discovery:
// the feature keeps working without an AI dependency, just at lower confidence,
// and the response is explicitly labeled 'degraded' so callers never mistake
// it for hybrid-quality retrieval.
async function lexicalOnlyCandidates(user,q,candidateLimit=200){
  const r=await rest(`thinkforge_chunks?user_id=eq.${encodeURIComponent(user.id)}&select=id,document_id,chunk_index,content,source_locator&limit=${candidateLimit}`,'GET');
  let rows=[];try{rows=await r.json()}catch{}
  if(!r.ok)throw Object.assign(new Error('Lexical fallback retrieval failed'),{code:'RAG_LEXICAL_FALLBACK_FAILED'});
  return (rows||[]).map(x=>({id:x.id,docName:null,text:x.content,meta:x.source_locator,semanticScore:null,lexicalScore:lexicalScore(q,x.content),rrfScore:null}));
}
async function embed(texts){
  const key=process.env.AI_API_KEY;if(!key)return null;
  const base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  try{
    const r=await fetchWithResilience(`${base}/embeddings`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:process.env.AI_EMBEDDING_MODEL||'text-embedding-3-small',input:texts})},{provider:'ai_embeddings',retryUnsafe:true,timeoutMs:Number(process.env.AI_EMBEDDING_TIMEOUT_MS||15000)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(j?.error?.message||'Embedding failed'),{code:'EMBEDDING_FAILED'});
    return (j.data||[]).sort((a,b)=>a.index-b.index).map(x=>x.embedding);
  }catch(e){
    if(e.code==='HTTP_TIMEOUT')throw Object.assign(new Error('Embedding request timed out'),{code:'EMBEDDING_TIMEOUT'});
    throw e;
  }
}
async function extractDocument(payload){const mime=String(payload?.mimeType||'text/plain').toLowerCase();const name=String(payload?.name||'document').toLowerCase();if(payload?.text)return {text:normalize(payload.text),parser:'plain-text',parserVersion:'1.0'};if(payload?.contentBase64){const buf=Buffer.from(String(payload.contentBase64),'base64');if(mime.includes('pdf')||name.endsWith('.pdf')){try{const mod=require('pdf-parse');const parsed=await mod(buf);return {text:normalize(parsed.text),parser:'pdf-parse',parserVersion:'1.1'}}catch(e){throw Object.assign(new Error('PDF parser unavailable; install pdf-parse or send extracted text'),{code:'PDF_PARSER_UNAVAILABLE',cause:e.message})}}return {text:normalize(buf.toString('utf8')),parser:'buffer-text',parserVersion:'1.0'}}throw Object.assign(new Error('Document text or contentBase64 required'),{code:'DOCUMENT_CONTENT_REQUIRED'})}
module.exports=async function handler(req,res){applySecurityHeaders(res);const rid=requestId(req);res.setHeader('x-request-id',rid);if(req.method!=='POST')return res.status(405).json({error:'Method not allowed',requestId:rid});if(!bodySizeOk(req))return res.status(413).json({error:'Request body too large',code:'BODY_TOO_LARGE',requestId:rid});const rl=await limit(req,{scope:'rag',max:30,windowMs:60000});if(!rl.ok)return res.status(429).json({error:'Rate limit exceeded',code:'RATE_LIMITED',requestId:rid});const user=await requireUser(req,res);if(!user)return;const {action,payload}=req.body||{};
if(action==='ingest'){try{const extracted=await extractDocument(payload);if(!extracted.text)return res.status(400).json({error:'No extractable text',code:'EMPTY_DOCUMENT',requestId:rid});const chunks=chunk(extracted.text,{size:Number(payload?.chunkSize||1000),overlap:Number(payload?.overlap||160)}).map((text,i)=>({id:`local-${hash({rid,i,text}).slice(0,18)}`,text,meta:{chunk:i+1,locator:`chunk ${i+1}`,parser:extracted.parser}}));return res.status(200).json({name:String(payload.name||'document'),mimeType:payload.mimeType||'text/plain',parser:extracted.parser,parserVersion:extracted.parserVersion,checksum:hash(extracted.text),chunks,requestId:rid})}catch(e){return res.status(422).json({error:e.message||'Document ingestion failed',code:e.code||'DOCUMENT_INGEST_FAILED',requestId:rid})}}
if(action==='chunk'){if(!payload?.text)return res.status(400).json({error:'text required',requestId:rid});return res.status(200).json({chunks:chunk(payload.text).map((text,i)=>({id:`local-${hash({rid,i,text}).slice(0,18)}`,text,meta:{chunk:i+1,locator:`chunk ${i+1}`}})),requestId:rid})}
if(action==='upsert'){if(!payload?.name||!Array.isArray(payload?.chunks))return res.status(400).json({error:'name and chunks required',requestId:rid});if(payload.chunks.length>500)return res.status(413).json({error:'Too many chunks',code:'CHUNK_LIMIT',requestId:rid});try{const checksum=payload.checksum||hash(payload.chunks.map(x=>x.text));const dr=await rest('thinkforge_documents','POST',{user_id:user.id,name:String(payload.name).slice(0,300),mime_type:payload.mimeType||'text/plain',checksum,version:1});const docs=await dr.json();if(!dr.ok)throw Object.assign(new Error(JSON.stringify(docs)),{code:'DOCUMENT_CREATE_FAILED'});const doc=docs[0];let embeddings=null;try{embeddings=await embed(payload.chunks.map(x=>x.text))}catch(e){if(process.env.REQUIRE_EMBEDDINGS==='true')throw e}const rows=payload.chunks.map((x,i)=>({document_id:doc.id,user_id:user.id,chunk_index:i,content:normalize(x.text).slice(0,20000),source_locator:x.meta?.locator||x.meta?.source||`chunk ${i+1}`,embedding:embeddings?.[i]||null,metadata:{...(x.metadata||{}),parser:payload.parser||null,parser_version:payload.parserVersion||null}}));const cr=await rest('thinkforge_chunks','POST',rows);const cj=await cr.json();if(!cr.ok)throw Object.assign(new Error(JSON.stringify(cj)),{code:'CHUNK_WRITE_FAILED'});try{await rest('thinkforge_documents_versions','POST',{document_id:doc.id,version_no:1,checksum,parser:payload.parser||'unknown',parser_version:payload.parserVersion||'1.0',extracted_text:payload.extractedText||null});}catch{}return res.status(200).json({document:doc,chunksStored:cj.length,vectorized:Boolean(embeddings),retrieverVersion:process.env.RETRIEVER_VERSION||'hybrid-v3',requestId:rid})}catch(e){return res.status(500).json({error:e.message||'RAG upsert failed',code:e.code||'RAG_UPSERT_FAILED',requestId:rid})}}
if(action==='search'){const q=normalize(payload?.query);if(!q)return res.status(400).json({error:'query required',requestId:rid});const requestedLimit=Math.max(1,Math.min(Number(payload?.limit||10),20));try{
  const vecs=await embed([q]);
  if(!vecs){
    const candidates=await lexicalOnlyCandidates(user,q);
    const ranked=rerank(q,candidates,{semanticWeight:0,lexicalWeight:1}).slice(0,requestedLimit).map(x=>({...x,citation:{document:x.docName,locator:x.meta}}));
    return res.status(200).json({retrieverVersion:process.env.RETRIEVER_VERSION||'hybrid-v3',strategy:'lexical-only (embedding model not configured)',degraded:true,hits:ranked,requestId:rid});
  }
  const hits=await rpc('match_thinkforge_chunks_hybrid',{query_text:q,query_embedding:vecs[0],match_count:50,filter_user_id:user.id});
  const ranked=rerank(q,(hits||[]).map(x=>({id:x.id,docName:x.document_name,text:x.content,meta:x.source_locator,semanticScore:x.semantic_score,lexicalScore:x.lexical_score,rrfScore:x.rrf_score}))).slice(0,requestedLimit).map(x=>({...x,citation:{document:x.docName,locator:x.meta}}));
  return res.status(200).json({retrieverVersion:process.env.RETRIEVER_VERSION||'hybrid-v3',strategy:'dense+lexical→RRF→light rerank→dedupe',degraded:false,hits:ranked,requestId:rid});
}catch(e){return res.status(500).json({error:e.message||'RAG search failed',code:e.code||'RAG_SEARCH_FAILED',requestId:rid})}}
return res.status(400).json({error:'Unsupported RAG action',code:'INVALID_RAG_ACTION',requestId:rid});};
module.exports._internal={shingleSet,jaccard,rerank,lexicalScore,normalize};
