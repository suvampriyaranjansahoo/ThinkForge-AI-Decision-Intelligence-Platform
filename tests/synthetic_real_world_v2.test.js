const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const d=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','synthetic_real_world_evaluation_v2','analysis_summary.json')));
test('paired replicated synthetic benchmark',()=>{assert.equal(d.real_world_scenarios,150);assert.equal(d.synthetic_participants,60);assert.equal(d.replicates_per_pair,4);assert.equal(d.observations,72000);assert.equal(d.paired_comparisons,36000);});
test('synthetic benchmark boundary',()=>{assert.equal(d.status,'SIMULATION_COMPLETE_NOT_EMPIRICAL');assert.equal(d.empirical_claim_eligible,false);assert.equal(d.human_subject_claim_eligible,false);});
