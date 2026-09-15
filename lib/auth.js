'use strict';
const crypto = require('node:crypto');
const {getMembership,roleAtLeast}=require('./authorization');
const {fetchWithResilience}=require('./http');
function getBearer(req){return String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim()}
async function getSupabaseUser(req){const token=getBearer(req),url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;if(!token||!url||!anon)return null;try{const r=await fetchWithResilience(`${url.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}},{provider:'supabase_auth',timeoutMs:Number(process.env.SUPABASE_AUTH_TIMEOUT_MS||8000)});if(!r.ok)return null;return r.json()}catch{return null}}
async function requireUser(req,res){const user=await getSupabaseUser(req);if(!user){res.status(401).json({error:'Authentication required',code:'AUTH_REQUIRED'});return null}return user}
function requestId(req){const supplied=String(req.headers?.['x-request-id']||'').trim();return /^[a-zA-Z0-9._:-]{8,160}$/.test(supplied)?supplied:crypto.randomUUID()}
async function requireOrganizationRole(userId,organizationId,minimum='viewer'){const m=await getMembership(userId,organizationId);if(!m||!roleAtLeast(m.role,minimum)){const e=new Error('Insufficient workspace permissions');e.code='FORBIDDEN';e.status=403;throw e}return m}
module.exports={getBearer,getSupabaseUser,requireUser,requestId,requireOrganizationRole};
