'use strict';
const {canAnnotate,transition}=require('./researchStudy');
function pilotSummary(rows={}){const completed=Number(rows.completed||0),required=Number(rows.required||30),quality=Number(rows.qualityScore??0),hidden=Number(rows.hiddenDuplicateConsistency??0),attention=Number(rows.attentionCheckRate??1);return{completed,required,quality,hidden,attention,eligibleForReview:completed>=required&&quality>=0.8&&hidden>=0.8&&attention>=0.9};}
function qualify({state,pilot}={}){const s=pilotSummary(pilot);if(state!=='PILOT')return{state,eligible:false,reason:'not_in_pilot'};if(!s.eligibleForReview)return{state:'PILOT',eligible:false,reason:'pilot_requirements_not_met',details:s};return{state:transition(state,'QUALIFICATION_REVIEW'),eligible:true,details:s};}
function certify({state,reviewPassed=false}={}){if(state!=='QUALIFICATION_REVIEW')return{state,certified:false,reason:'not_in_qualification_review'};return reviewPassed?{state:transition(state,'CERTIFIED'),certified:true}:{state,certified:false,reason:'review_not_passed'};}
function canStartMainStudy(rater,study){return Boolean(rater&&study&&rater.state==='CERTIFIED'&&study.status==='MAIN_ANNOTATION'&&rater.studyId===study.id)}
module.exports={pilotSummary,qualify,certify,canAnnotate,canStartMainStudy};
