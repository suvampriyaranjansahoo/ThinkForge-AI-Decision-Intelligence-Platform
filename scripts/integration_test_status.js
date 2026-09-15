'use strict';
const configured=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY);
if(configured){console.log(JSON.stringify({status:'CONFIGURED',message:'Live Supabase credentials detected; run the live integration workflow.'}));process.exit(0);}
console.warn(JSON.stringify({status:'SKIPPED',message:'Live integration tests are not executed in this environment because SUPABASE_URL/SUPABASE_ANON_KEY are not configured.'}));
process.exit(0);
