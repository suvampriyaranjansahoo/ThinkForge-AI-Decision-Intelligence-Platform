'use strict';

// Compatibility facade only. The authoritative Stage 4 governance policy lives
// in the database RPCs. This module reuses decisionGovernance's pure preview
// policy for offline callers/tests without maintaining a second implementation.
const g=require('./decisionGovernance');

function legacyReadinessAdapter(decision={}){
  const r=g.readiness(decision);
  const blockers=r.blockers.map(b=>b.code==='INSUFFICIENT_OPTIONS'?{...b,code:'NO_OPTION',label:'At least one credible option is required before review'}:b);
  const h=r.health||{};
  const ex=h.execution||{};
  return {
    ...r,
    rigorLevel:r.rigor,
    minimumEvidence:g.policyFor(decision).minimumEvidence,
    evidenceCount:h.evidence?.count??0,
    evidenceCoverage:h.evidence?.coverage??0,
    evidenceQuality:h.evidence?.quality??0,
    criticalOpenAssumptions:h.assumptions?.unresolvedCritical??0,
    contradictions:h.contradictions??{evidenceCount:0,explicitCount:0,highSeverityCount:0,total:0},
    hasProblem:Boolean(String(decision.problem??'').trim()),
    hasOptions:Array.isArray(decision.alternatives||decision.options) && (decision.alternatives||decision.options).length>0,
    hasExperiment:Boolean(ex.experimentReady),
    hasPrediction:Boolean(ex.predictionReady),
    hasOutcome:Boolean(ex.outcomeReady),
    hasLearning:Boolean(ex.learningReady),
    blockers
  };
}

function legacyConfidenceAdapter(decision={}){
  const c=g.confidenceBreakdown(decision);
  return {...c,evidence:c.evidenceQuality??c.evidence??0,coverage:c.evidenceCoverage??c.coverage??0,assumptionValidation:c.assumptionValidation??0};
}

function decisionDossier(decision={},workflowState='DRAFT'){
  const r=legacyReadinessAdapter({...decision,workflowState});
  return {title:decision.title||'Untitled decision',problem:decision.problem||'',workflowState,rigorLevel:r.rigorLevel,readiness:r,confidence:r.confidence,nextAction:r.nextAction,decisionInputs:{evidence:Array.isArray(decision.evidence)?decision.evidence.length:0,assumptions:Array.isArray(decision.assumptions)?decision.assumptions.length:0,challenges:Array.isArray(decision.challenges)?decision.challenges.length:0,options:Array.isArray(decision.alternatives||decision.options)?(decision.alternatives||decision.options).length:0,experiments:Array.isArray(decision.experiments)?decision.experiments.length:(decision.experiment?1:0),predictions:decision.prediction?1:(Array.isArray(decision.predictions)?decision.predictions.length:0),outcomes:decision.outcome?1:(Array.isArray(decision.outcomes)?decision.outcomes.length:0)}};
}

module.exports={WORKFLOW_STATES:g.WORKFLOW_STATES,TRANSITIONS:g.TRANSITIONS,EVIDENCE_THRESHOLDS:{minimal:1,moderate:2,high:3,maximum:4},assumptionPriority:g.assumptionPriority,isCriticalAssumption:g.isCriticalAssumption,isValidated:g.isValidated,readiness:legacyReadinessAdapter,confidenceBreakdown:legacyConfidenceAdapter,canTransition:g.canTransition,validateTransition:g.validateTransition,decisionDossier};
