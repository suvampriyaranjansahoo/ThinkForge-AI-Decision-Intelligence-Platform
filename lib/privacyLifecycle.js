'use strict';
const VALID=['REQUESTED','VERIFIED','EXPORT_READY','DELETION_SCHEDULED','DELETED','REJECTED'];
function transition(r,next){if(!VALID.includes(next)||!VALID.includes(r.status))throw new Error('Invalid privacy state');const allowed={REQUESTED:['VERIFIED','REJECTED'],VERIFIED:['EXPORT_READY','DELETION_SCHEDULED'],EXPORT_READY:['DELETION_SCHEDULED'],DELETION_SCHEDULED:['DELETED'],DELETED:[],REJECTED:[]};if(!(allowed[r.status]||[]).includes(next))throw new Error(`Invalid privacy transition ${r.status} -> ${next}`);return {...r,status:next,updatedAt:new Date().toISOString()}}
// IMPORTANT: this is a coarse pattern-matching heuristic, not a compliance-grade PII/secret
// scanner. It catches a wider set of common formats than before (emails, US/intl phone numbers,
// SSN-style and payment-card-style digit sequences with common separators, generic long secret
// tokens) but it still cannot catch names, addresses, free-text PII, or any secret format it
// wasn't written to expect. Never use `pii:false`/`secret:false` from this function alone as
// evidence that a privacy or compliance requirement has been satisfied - route flagged content
// to human review, and treat an unflagged result as "nothing obvious found," not "confirmed clean."
const PII_PATTERNS=[
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,                 // email
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,                             // SSN-style (with/without separators)
  /\b(?:\d[ -]?){13,19}\b/,                                      // payment-card-style digit runs, common separators
  /\b\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/, // phone-number-shaped sequences
];
const SECRET_PATTERN=/api[_ -]?key|secret[_ -]?key|access[_ -]?token|password|bearer\s+[a-z0-9._-]{16,}|sk-[a-z0-9]{16,}/i;
function classify(text=''){
  const s=String(text);
  return{
    pii:PII_PATTERNS.some(re=>re.test(s)),
    secret:SECRET_PATTERN.test(s),
    heuristic:true,
    confidence:'low',
  };
}
module.exports={VALID,transition,classify};
