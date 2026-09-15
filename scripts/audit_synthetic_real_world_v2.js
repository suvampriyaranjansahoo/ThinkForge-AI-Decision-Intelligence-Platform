'use strict';
const fs=require('node:fs'),path=require('node:path');
const p=path.join(__dirname,'..','eval','synthetic_real_world_evaluation_v2');
const d=JSON.parse(fs.readFileSync(path.join(p,'analysis_summary.json'),'utf8'));
if(d.status!=='SIMULATION_COMPLETE_NOT_EMPIRICAL') throw new Error('Invalid synthetic boundary');
if(d.real_world_scenarios!==150||d.synthetic_participants!==60||d.replicates_per_pair!==4||d.observations!==72000) throw new Error('Unexpected size');
if(d.empirical_claim_eligible!==false||d.human_subject_claim_eligible!==false) throw new Error('Synthetic benchmark cannot be empirical');
console.log(JSON.stringify({status:'PASS',observations:d.observations,pairedComparisons:d.paired_comparisons,delta:d.decision_quality.paired_mean_delta,ci95:d.decision_quality.bootstrap_95ci,pApprox:d.decision_quality.paired_sign_flip_p_approx},null,2));
