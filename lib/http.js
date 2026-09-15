'use strict';
// Shared outbound-HTTP guardrail. Unsafe requests are not retried unless a
// caller can prove its remote operation is idempotent.
const circuits=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function state(provider){return circuits.get(provider)||{failures:0,openUntil:0};}
function success(provider){circuits.set(provider,{failures:0,openUntil:0});}
function failure(provider,threshold,cooldownMs){const c=state(provider);c.failures++;if(c.failures>=threshold)c.openUntil=Date.now()+cooldownMs;circuits.set(provider,c);}
function error(message,code,status){return Object.assign(new Error(message),{code,status});}
async function fetchWithResilience(url,options={},settings={}){
  const provider=settings.provider||'outbound_http',fetchImpl=settings.fetchImpl||globalThis.fetch;
  if(typeof fetchImpl!=='function')throw error('Fetch implementation unavailable','HTTP_FETCH_UNAVAILABLE');
  const timeoutMs=Number(settings.timeoutMs??process.env.OUTBOUND_HTTP_TIMEOUT_MS??15000),retries=Math.max(0,Number(settings.retries??process.env.OUTBOUND_HTTP_RETRIES??2));
  const threshold=Math.max(1,Number(settings.circuitThreshold??process.env.OUTBOUND_HTTP_CIRCUIT_THRESHOLD??5)),cooldownMs=Math.max(1,Number(settings.circuitCooldownMs??process.env.OUTBOUND_HTTP_CIRCUIT_COOLDOWN_MS??30000));
  const method=String(options.method||'GET').toUpperCase(),mayRetry=settings.retryUnsafe===true||['GET','HEAD','OPTIONS'].includes(method),retryable=settings.retryableStatuses||[408,425,429,500,502,503,504];
  if(state(provider).openUntil>Date.now())throw error(`${provider} circuit breaker open`,'HTTP_CIRCUIT_OPEN',503);
  let last;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{const response=await fetchImpl(url,{...options,signal:controller.signal});if(!retryable.includes(response.status)||!mayRetry||attempt===retries){if(response.ok)success(provider);else if(retryable.includes(response.status))failure(provider,threshold,cooldownMs);return response;}last=error(`${provider} returned HTTP ${response.status}`,'HTTP_RETRYABLE_STATUS',response.status);failure(provider,threshold,cooldownMs);}
    catch(e){last=e?.name==='AbortError'?error(`${provider} request timed out`,'HTTP_TIMEOUT',504):e;failure(provider,threshold,cooldownMs);if(!mayRetry||attempt===retries)throw last;}
    finally{clearTimeout(timer);}
    await sleep(Math.min(3000,250*Math.pow(2,attempt)));
  }
  throw last||error(`${provider} request failed`,'HTTP_REQUEST_FAILED');
}
module.exports={fetchWithResilience};
