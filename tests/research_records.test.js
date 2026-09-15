const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('research schemas and templates exist',()=>{
 for(const f of ['eval/rater_profile_schema.json','eval/pairwise_schema.json','eval/rag_annotation_schema.json','eval/decision_impact_schema.json','eval/expert_curation_template.json','eval/rag_gold_template.json','eval/decision_impact_template.json']) assert.equal(fs.existsSync(f),true,f);
});

test('study manifest gates require real evidence',()=>{
 const m=JSON.parse(fs.readFileSync('eval/study_manifest.json','utf8'));
 assert.equal(m.candidate_policy.no_lazy_generation,true);
 assert.equal(m.rater_policy.qualification_required,true);
 assert.equal(m.research_claim_gate.minimum_expert_gold_cases,100);
 assert.equal(m.research_claim_gate.minimum_real_rag_gold_queries,50);
 assert.equal(m.research_claim_gate.minimum_decision_impact_participants,20);
});
