'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const sql=fs.readFileSync(path.join(root,'supabase/migration_025_stage4_governance_consolidation.sql'),'utf8');
const finalSql=fs.readFileSync(path.join(root,'supabase/migration_026_stage4_governance_finalization.sql'),'utf8');

test('Stage 4.2 has one canonical readiness boundary with forward adapters only',()=>{
  const body=sql.slice(sql.indexOf('create or replace function public.thinkforge_decision_readiness_v3'),sql.indexOf('create or replace function public.thinkforge_decision_readiness_v2'));
  assert.match(body,/thinkforge_decision_governance_policy_v2/);
  assert.doesNotMatch(body,/thinkforge_decision_readiness_v1\s*\(/);
  assert.doesNotMatch(body,/thinkforge_decision_readiness_v2\s*\(/);
  assert.match(sql,/create or replace function public\.thinkforge_decision_readiness_v2/);
  assert.match(sql,/create or replace function public\.thinkforge_decision_readiness_v1/);
});

test('Approval is the only route to APPROVED',()=>{
  const transition=sql.slice(sql.indexOf('create or replace function public.thinkforge_transition_decision_v3'),sql.indexOf('-- ---------------------------------------------------------------------------\n-- 11. Canonical reopen'));
  assert.match(transition,/APPROVAL_ROUTE_REQUIRED/);
  assert.match(transition,/approvalOnlyRoute/);
});

test('Material child locks cover direct decision inputs and governance records',()=>{
  assert.match(sql,/trg_tf_stage4_lock_%I/);
  for(const table of ['thinkforge_evidence','thinkforge_assumptions','thinkforge_challenges','thinkforge_alternatives','thinkforge_experiments','thinkforge_predictions','thinkforge_claims','thinkforge_decision_contexts','thinkforge_decision_participants','thinkforge_decision_approval_conditions','thinkforge_decision_dissent','thinkforge_decision_reviews','thinkforge_evidence_provenance','thinkforge_assumption_evidence_links','thinkforge_claim_evidence_links']){
    assert.match(sql,new RegExp(`'${table}'`),`missing governed table ${table}`);
  }
});

test('Revision semantics are explicitly separated',()=>{
  assert.match(sql,/Canonical domain revision from thinkforge_decisions\.version/);
  assert.match(sql,/Aggregate material decision revision, including child graph mutations/);
  assert.match(sql,/Workflow transition counter only/);
  assert.match(sql,/Aggregate revision captured at latest approval/);
  assert.match(sql,/governance_revision/);
});

test('Reviewer identity cannot be spoofed through payload',()=>{
  const fn=sql.slice(sql.indexOf('create or replace function public.thinkforge_approve_decision_v2'),sql.indexOf('-- ---------------------------------------------------------------------------\n-- 10. Canonical transition'));
  assert.match(fn,/reviewer_id/);
  assert.match(fn,/p_review_id/);
  assert.doesNotMatch(fn,/p_review->>\s*'reviewedBy'/);
});

test('Segment coverage and assumption-evidence coverage are distinct metrics',()=>{
  assert.match(sql,/segmentCoverage/);
  assert.match(sql,/assumptionEvidenceCoverage/);
  assert.match(sql,/LOW_ASSUMPTION_EVIDENCE_COVERAGE/);
  assert.match(sql,/LOW_SEGMENT_COVERAGE/);
});

const hasDb=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
const dbTest=test;

dbTest('DB integration: canonical policy function is deployed and versioned',{skip:!hasDb},async()=>{
  const r=await fetch(`${process.env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/thinkforge_decision_governance_policy_v2`,{
    method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({p_rigor:'high_stakes'})
  });
  assert.equal(r.ok,true,await r.text());
  const out=await r.json();
  assert.equal(out.version,'stage4-v4');
  assert.equal(out.rigor,'high_stakes');
  assert.equal(out.approvalConditionsRequired,true);
});

dbTest('DB integration: canonical transition policy forbids direct approval route',{skip:!hasDb},async()=>{
  const r=await fetch(`${process.env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/thinkforge_decision_transition_policy_v1`,{
    method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({p_from_state:'READY_FOR_REVIEW',p_to_state:'APPROVED'})
  });
  assert.equal(r.ok,true,await r.text());
  const out=await r.json();
  assert.equal(out.allowed,false);
  assert.equal(out.approvalOnlyRoute,true);
});

dbTest('DB integration: live readiness exercises canonical v4 when test fixture is configured',{skip:!(hasDb&&process.env.THINKFORGE_TEST_USER_ID&&process.env.THINKFORGE_TEST_ORG_ID&&process.env.THINKFORGE_TEST_DECISION_ID)},async()=>{
  const r=await fetch(`${process.env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/thinkforge_decision_readiness_v4`,{
    method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:process.env.THINKFORGE_TEST_USER_ID,p_organization_id:process.env.THINKFORGE_TEST_ORG_ID,p_decision_id:process.env.THINKFORGE_TEST_DECISION_ID})
  });
  assert.equal(r.ok,true,await r.text());
  const out=await r.json();
  assert.equal(out.governanceVersion,'stage4-v4');
  assert.ok(Object.hasOwn(out,'segmentCoverage'));
  assert.ok(Object.hasOwn(out,'assumptionEvidenceCoverage'));
});


test('Finalization hardening makes readiness and transitions single-boundary',()=>{const rbStart=finalSql.indexOf('create or replace function public.thinkforge_decision_readiness_v4');const rbEnd=finalSql.indexOf('create or replace function public.thinkforge_decision_readiness_v3');assert.ok(rbStart>=0&&rbEnd>rbStart);const rb=finalSql.slice(rbStart,rbEnd);assert.doesNotMatch(rb,/thinkforge_decision_readiness_v[123]\s*\(/);const tbStart=finalSql.indexOf('create or replace function public.thinkforge_transition_decision_v4');const tbEnd=finalSql.indexOf('create or replace function public.thinkforge_transition_decision_v3');assert.ok(tbStart>=0&&tbEnd>tbStart);const tb=finalSql.slice(tbStart,tbEnd);assert.doesNotMatch(tb,/thinkforge_transition_decision_v[123]\s*\(/);assert.match(finalSql,/approval_only_route boolean/);assert.match(finalSql,/decision_version/);});
