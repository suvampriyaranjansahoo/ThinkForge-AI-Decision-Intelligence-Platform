'use strict';
const crypto=require('node:crypto');
const MAX_BODY_BYTES=Number(process.env.MAX_BODY_BYTES||1024*1024);
function applySecurityHeaders(res){
  // script-src intentionally has NO 'unsafe-inline': the app never emits <script> tags or
  // on*="" attributes (verified: 0 matches for either pattern across frontend/src/app.js and
  // index.html) - it's loaded as a single external module. Removing 'unsafe-inline' here costs
  // nothing today and closes the main gap that made CSP a no-op against injected <script> payloads.
  // style-src keeps 'unsafe-inline' because generated markup uses inline style="" attributes
  // (e.g. app.js's RAG results list); removing it requires moving those to CSS classes first -
  // tracked separately, lower severity since CSS injection alone can't execute script.
  res.setHeader('Content-Security-Policy', process.env.CSP||"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}
function bodySizeOk(req){const n=Number(req.headers?.['content-length']||0);return !n||n<=MAX_BODY_BYTES;}
function sanitizeId(v){return String(v||'').replace(/[^a-zA-Z0-9._:-]/g,'').slice(0,160);}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(value??null)).digest('hex');}
// Telemetry only: a false result is never evidence that input is safe. Prompt
// isolation, evidence allowlists, contracts, and human review remain controls.
function logInjectionHeuristic(text){return /ignore\s+(all|previous|prior)\s+instructions|system\s+prompt|developer\s+message|reveal\s+secret|exfiltrat/i.test(String(text||''));}
const hasInjectionSignals=logInjectionHeuristic; // Compatibility alias; do not use as an authorization/safety gate.
module.exports={applySecurityHeaders,bodySizeOk,sanitizeId,hash,logInjectionHeuristic,hasInjectionSignals,MAX_BODY_BYTES};
