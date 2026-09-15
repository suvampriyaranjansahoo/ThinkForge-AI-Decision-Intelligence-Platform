'use strict';
const {fetchWithResilience}=require('./http');
async function rest(path,method,body,prefer='return=representation'){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Object.assign(new Error('Supabase server configuration missing'),{code:'DB_NOT_CONFIGURED'});
  return fetchWithResilience(`${url.replace(/\/$/,'')}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)},{provider:'supabase_rest',timeoutMs:Number(process.env.SUPABASE_TIMEOUT_MS||15000)});
}
async function rpc(name,args){const r=await rest(`rpc/${name}`,'POST',args);let j={};try{j=await r.json()}catch{}if(!r.ok)throw Object.assign(new Error(JSON.stringify(j)),{code:'DB_RPC_FAILED',status:r.status});return j;}
module.exports={rest,rpc};
