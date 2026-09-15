'use strict';
const {fetchWithResilience}=require('./http');
// Durable limiter via Upstash REST when configured; otherwise best-effort local limiter for development.
const buckets=new Map();
function localKey(req,scope){return `${scope}:${String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].trim()}`;}
async function durable(req,scope,max,windowMs){
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)return null;
  const k=localKey(req,scope);const script="local c=tonumber(redis.call('INCR',KEYS[1])); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return c";
  const r=await fetchWithResilience(`${url}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify([["EVAL",script,1,k,String(windowMs)]])},{provider:'upstash_rate_limit',timeoutMs:Number(process.env.UPSTASH_TIMEOUT_MS||5000)});
  if(!r.ok)return null;const j=await r.json();const count=Number(j?.[0]?.result||0);return {ok:count<=max,remaining:Math.max(0,max-count)};
}
async function limit(req,{scope='default',max=30,windowMs=60000,requireDurable=process.env.NODE_ENV==='production'}={}){
  try{const d=await durable(req,scope,max,windowMs);if(d)return d;}catch{}
  if(requireDurable){const e=new Error('Durable rate limiting is required in production');e.code='DURABLE_RATE_LIMIT_REQUIRED';e.status=503;throw e;}
  const k=localKey(req,scope),now=Date.now(),x=buckets.get(k);if(!x||now-x.start>=windowMs){buckets.set(k,{start:now,count:1});return {ok:true,remaining:max-1};}x.count++;return x.count>max?{ok:false,remaining:0}:{ok:true,remaining:max-x.count};
}
module.exports={limit};
