'use strict';

const crypto = require('node:crypto');

const DEFAULT_SPLIT = { development: 0.20, validation: 0.20, locked_test: 0.60 };

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateRealCase(caseItem, index) {
  const errors = [];
  if (!caseItem || typeof caseItem !== 'object') return [`case[${index}] must be an object`];
  if (!caseItem.id) errors.push(`case[${index}] missing id`);
  if (!caseItem.sourceStudyId) errors.push(`case[${index}] missing sourceStudyId`);
  if (!caseItem.sourceProvenance) errors.push(`case[${index}] missing sourceProvenance`);
  if (caseItem.synthetic === true) errors.push(`case[${index}] is marked synthetic`);
  if (caseItem.generatedByModel === true) errors.push(`case[${index}] is marked model-generated`);
  if (!caseItem.input || typeof caseItem.input !== 'object') errors.push(`case[${index}] missing input object`);
  if (!String(caseItem.input?.prompt || '').trim()) errors.push(`case[${index}] missing input.prompt`);
  return errors;
}

function validateSourceStudies(sources, minimumStudies = 3) {
  const errors = [];
  if (!Array.isArray(sources) || sources.length < minimumStudies) {
    errors.push(`at least ${minimumStudies} independent source studies are required`);
    return errors;
  }
  const ids = new Set();
  for (const [i, s] of sources.entries()) {
    if (!s?.id || !s?.title || !s?.url || !s?.provenance) errors.push(`study[${i}] missing id/title/url/provenance`);
    if (s?.realHumanData !== true) errors.push(`study[${i}] must declare realHumanData=true`);
    if (s?.synthetic === true || s?.generatedByModel === true) errors.push(`study[${i}] cannot be synthetic/model-generated`);
    if (s?.id && ids.has(s.id)) errors.push(`duplicate study id: ${s.id}`);
    if (s?.id) ids.add(s.id);
  }
  return errors;
}

function allocateCounts(total, split = DEFAULT_SPLIT) {
  if (total < 3) throw new Error('At least 3 cases are required.');
  const dev = Math.floor(total * split.development);
  const val = Math.floor(total * split.validation);
  const test = total - dev - val;
  return { development: dev, validation: val, locked_test: test };
}

function deterministicShuffle(items, seed) {
  return [...items].sort((a, b) => stableHash(`${seed}:${a.id}`).localeCompare(stableHash(`${seed}:${b.id}`)));
}

function buildCaseSplits(cases, { seed = 'tf-external-gold-v1', split = DEFAULT_SPLIT } = {}) {
  const counts = allocateCounts(cases.length, split);
  const ordered = deterministicShuffle(cases, seed);
  const map = new Map();
  ordered.forEach((c, i) => {
    const splitName = i < counts.development ? 'development' : i < counts.development + counts.validation ? 'validation' : 'locked_test';
    map.set(c.id, splitName);
  });
  return { counts, assignments: cases.map(c => ({ caseId: c.id, split: map.get(c.id) })) };
}

function buildRaterAssignments(cases, raterIds, {
  studyId = 'stage1-external-gold-v1',
  pilotCount = 25,
  duplicateRate = 0.05,
  seed = 'tf-external-gold-v1'
} = {}) {
  if (!Array.isArray(raterIds) || raterIds.length < 3) throw new Error('Exactly at least 3 independent rater IDs are required.');
  const uniqueRaters = [...new Set(raterIds.map(String))];
  if (uniqueRaters.length < 3) throw new Error('Rater IDs must be unique.');
  if (!Array.isArray(cases) || cases.length < 100) throw new Error('External human gold study requires at least 100 cases.');
  const { assignments } = buildCaseSplits(cases, { seed });
  const pilotIds = new Set(
    deterministicShuffle(cases.filter(c => assignments.find(a => a.caseId === c.id)?.split !== 'locked_test'), `${seed}:pilot`)
      .slice(0, Math.min(pilotCount, 25))
      .map(c => c.id)
  );
  const hiddenDuplicateCount = Math.max(1, Math.round(cases.length * duplicateRate));
  const duplicateCases = deterministicShuffle(cases, `${seed}:duplicates`).slice(0, hiddenDuplicateCount);
  const duplicateIds = new Set(duplicateCases.map(c => c.id));

  const out = {};
  for (const raterId of uniqueRaters) {
    out[raterId] = cases.map((c) => ({
      studyId,
      raterId,
      caseId: c.id,
      split: assignments.find(a => a.caseId === c.id).split,
      studyPhase: pilotIds.has(c.id) ? 'PILOT' : 'MAIN_STUDY',
      isHiddenDuplicate: duplicateIds.has(c.id),
      sourceCaseId: c.id,
      candidateOutputVisible: false,
      goldVisible: false
    }));
  }
  return {
    version: 'tf-external-human-study-v1',
    studyId,
    policy: {
      minimumCases: 100,
      recommendedCases: 150,
      independentRaters: 3,
      pilotCases: Math.min(pilotCount, 25),
      adjudication: 'all_disagreements',
      lockedTestFraction: splitLockedFraction(assignments),
      candidateOutputVisibleDuringGoldCreation: false,
      humanModelContamination: 'prohibited'
    },
    splitCounts: allocateCounts(cases.length),
    raters: uniqueRaters,
    assignments: out
  };
}

function splitLockedFraction(assignments) {
  if (!assignments.length) return 0;
  return assignments.filter(x => x.split === 'locked_test').length / assignments.length;
}

function buildStudyManifest({ studyId, codebookVersion, goldVersion = null, sources, cases, raterIds }) {
  const caseErrors = cases.flatMap(validateRealCase);
  const studyErrors = validateSourceStudies(sources);
  const errors = [...studyErrors, ...caseErrors];
  const caseStudyIds = new Set(cases.map(c => c.sourceStudyId));
  const missingStudies = sources.filter(s => !caseStudyIds.has(s.id)).map(s => s.id);
  if (missingStudies.length) errors.push(`source studies without represented cases: ${missingStudies.join(', ')}`);
  if (new Set(cases.map(c => c.id)).size !== cases.length) errors.push('case IDs must be globally unique');
  if (!Array.isArray(raterIds) || new Set(raterIds).size < 3) errors.push('at least 3 independent rater IDs are required');
  if (errors.length) return { valid: false, errors };
  const payload = { studyId, codebookVersion, goldVersion, sources, cases: cases.map(c => c.id), raterIds };
  return {
    valid: true,
    studyId,
    codebookVersion,
    goldVersion,
    sourceStudies: sources.length,
    cases: cases.length,
    raters: [...new Set(raterIds)].length,
    caseIdsHash: stableHash(payload),
    datasetFingerprint: stableHash({ sources, cases }),
    synthetic: false,
    generatedByModel: false
  };
}

module.exports = {
  DEFAULT_SPLIT,
  stableHash,
  validateRealCase,
  validateSourceStudies,
  allocateCounts,
  buildCaseSplits,
  buildRaterAssignments,
  buildStudyManifest
};
