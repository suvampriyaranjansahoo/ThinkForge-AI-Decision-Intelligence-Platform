'use strict';
function createOutcome(input={}){if(!input.predictionId||input.actual===undefined)throw new Error('predictionId and actual are required');return{...input,id:input.id||`out_${Date.now()}`,observedAt:input.observedAt||new Date().toISOString(),source:input.source||'user_reported',verified:Boolean(input.verified)}}
function linkLearning(prediction={},outcome={}){if(!prediction.id||prediction.id!==outcome.predictionId)throw new Error('Prediction/outcome linkage invalid');return{predictionId:prediction.id,error:Number(prediction.predicted)-Number(outcome.actual),assumptionIds:prediction.assumptionIds||[],decisionId:prediction.decisionId||null}}
module.exports={createOutcome,linkLearning};
