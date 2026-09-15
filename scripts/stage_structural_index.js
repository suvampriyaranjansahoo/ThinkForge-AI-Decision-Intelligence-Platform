'use strict';
/**
 * Computed repository-structure index. Never emits a subjective quality score.
 *
 * This script does NOT claim to measure code quality, correctness, or
 * completeness of behavior. It measures exactly two real, checkable things
 * per stage:
 *
 *   1. requiredAssetPresence: (required files that exist) / (required files
 *      listed) -- same requirement list stage_evidence_audit.js already
 *      uses. This is presence, not quality: a 5-line stub scores the same
 *      as a mature implementation.
 *
 *   2. testFileReferences: how many files under tests/ mention the stage's
 *      core module names. This is a proxy for "something automated
 *      exercises this code," not a coverage percentage -- use `npm run
 *      test:coverage` (if configured) for a real line/branch coverage
 *      number if you need one.
 *
 * Neither number says anything about empirical/real-world validation.
 * research_readiness.js remains the source of truth for that.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// Same requirement list as stage_evidence_audit.js, kept in sync manually.
const requiredAssets = {
  '1': ['eval/expert_curation_template.json', 'lib/benchmarkGovernance.js'],
  '2': ['db/migrations/015_stage2_canonical_data_model.sql', 'supabase/migration_015_stage2_canonical_data_model.sql', 'lib/domainModel.js', 'api/domain.js', 'tests/data_model_stage2.test.js'],
  '3': ['frontend/src/features', 'lib/e2eLifecycle.js'],
  '4': ['lib/decisionHealth.js', 'lib/qualityGate.js'],
  '5': ['lib/benchmarkGovernance.js', 'eval/expert_curation_template.json'],
  '6': ['lib/claimEvaluation.js', 'eval/rag_gold_template.json'],
  '7': ['lib/claimEvaluation.js', 'lib/researchStudy.js'],
  '8': ['lib/decisionHealth.js', 'lib/benchmarkGovernance.js'],
  '9': ['lib/experimentDesign.js', 'tests/readiness_95.test.js'],
  '10': ['lib/outcomeAnalytics.js', 'lib/outcomeStore.js', 'lib/registry.js'],
  '11': ['lib/researchStudy.js', 'lib/annotationQualification.js'],
  '12': ['lib/llmOps.js', 'lib/registry.js'],
  '13': ['lib/ragExperiment.js', 'eval/rag_gold_template.json'],
  '14': ['lib/jiraSafety.js', 'lib/rateLimit.js', 'lib/privacyLifecycle.js'],
  '15': ['lib/insightEngine.js', 'lib/outcomeStore.js']
};

// Core module name(s) to grep for in tests/, per stage -- used only to
// count references, not to judge quality.
const coreModuleNames = {
  '1': ['productDiscovery'],
  '2': ['domainModel'],
  '3': ['app.js', 'features'],
  '4': ['decisionHealth'],
  '5': ['claimEvaluation'],
  '6': ['claimEvaluation'],
  '7': ['claimEvaluation', 'researchStudy'],
  '8': ['decisionHealth', 'decisionWorkflow'],
  '9': ['experimentDesign'],
  '10': ['outcomeAnalytics', 'outcomeStore'],
  '11': ['researchStudy', 'annotationQualification'],
  '12': ['llmOps', 'registry'],
  '13': ['ragExperiment'],
  '14': ['jiraSafety', 'rateLimit'],
  '15': ['insightEngine']
};

const testsDir = path.join(root, 'tests');
const testFiles = fs.existsSync(testsDir) ? fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js')) : [];
const testFileContents = new Map(testFiles.map(f => [f, fs.readFileSync(path.join(testsDir, f), 'utf8')]));

function countTestReferences(names) {
  let count = 0;
  for (const [, content] of testFileContents) {
    if (names.some(n => content.includes(n))) count++;
  }
  return count;
}

const stages = {};
for (const stage of Object.keys(requiredAssets)) {
  const assets = requiredAssets[stage].map(p => ({ path: p, exists: fs.existsSync(path.join(root, p)) }));
  const presentCount = assets.filter(a => a.exists).length;
  const requiredAssetPresence = assets.length ? Math.round((presentCount / assets.length) * 1000) / 1000 : null;
  const testFileReferences = countTestReferences(coreModuleNames[stage] || []);
  stages[stage] = {
    requiredAssetPresence,
    assetsPresent: presentCount,
    assetsRequired: assets.length,
    missingAssets: assets.filter(a => !a.exists).map(a => a.path),
    testFileReferences
  };
}

const out = {
  methodology: 'requiredAssetPresence = (required files that exist)/(required files listed). testFileReferences = count of test files mentioning the stage\'s core module name(s). NEITHER of these is a code-quality, correctness, or coverage score, and NEITHER is empirical/real-world validation -- see research_readiness.js for that. A stage can show requiredAssetPresence:1 with a trivial stub implementation; this only proves the file exists.',
  totalTestFiles: testFiles.length,
  stages
};

console.log(JSON.stringify(out, null, 2));
