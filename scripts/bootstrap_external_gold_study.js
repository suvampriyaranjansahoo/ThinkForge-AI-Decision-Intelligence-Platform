'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { buildStudyManifest, buildRaterAssignments, validateRealCase, validateSourceStudies } = require('../lib/externalGoldStudy');

const root = path.join(__dirname, '..');
const inputPath = process.argv[2] || path.join(root, 'eval', 'external_gold', 'case_bank.json');
const outDir = process.argv[3] || path.join(root, 'eval', 'external_gold', 'study');
const raterIds = (process.argv[4] || 'rater-1,rater-2,rater-3').split(',').map(x => x.trim()).filter(Boolean);

function die(message, details = {}) {
  console.error(JSON.stringify({ status: 'BLOCKED_UNTIL_REAL_CASE_BANK', message, ...details }, null, 2));
  process.exit(2);
}
if (!fs.existsSync(inputPath)) die('Real external case bank not found. Populate eval/external_gold/case_bank.json from legally reusable/anonymized human research material.', { inputPath });
let bank;
try { bank = JSON.parse(fs.readFileSync(inputPath, 'utf8')); } catch (e) { die('Case bank is not valid JSON.', { error: e.message }); }
if (bank.synthetic === true || bank.generatedByModel === true) die('Synthetic/model-generated case banks cannot be used for the external empirical study.');
const cases = Array.isArray(bank.cases) ? bank.cases : [];
const sources = bank.studyManifest?.sources || [];
const caseErrors = cases.flatMap(validateRealCase);
const sourceErrors = validateSourceStudies(sources);
if (cases.length < 100) die('External study requires at least 100 real cases.', { cases: cases.length, minimum: 100 });
if (caseErrors.length || sourceErrors.length) die('Case bank failed provenance/integrity validation.', { caseErrors, sourceErrors });
const codebookVersion = bank.codebookVersion || 'stage1-codebook-v1';
const studyId = bank.studyId || 'stage1-external-gold-v1';
const manifest = buildStudyManifest({ studyId, codebookVersion, sources, cases, raterIds });
if (!manifest.valid) die('External study manifest failed validation.', { errors: manifest.errors });
const assignments = buildRaterAssignments(cases, raterIds, { studyId, pilotCount: 25 });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'study_manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'rater_assignments.json'), JSON.stringify(assignments, null, 2));
fs.writeFileSync(path.join(outDir, 'README.md'), [
  '# External Stage 1 Human Study',
  '',
  'This directory contains assignment metadata only. It intentionally contains no human labels until independent raters complete the study.',
  '',
  `- Study: ${studyId}`,
  `- Cases: ${cases.length}`,
  `- Independent raters: ${raterIds.length}`,
  `- Pilot: ${assignments.policy.pilotCases} cases`,
  `- Locked test fraction: ${(assignments.policy.lockedTestFraction * 100).toFixed(1)}%`,
  '- Candidate output visible during gold creation: NO',
  '- Gold labels visible to raters: NO',
  '- Adjudication: every disagreement',
  '',
  'Next step: collect independent annotations into a reviewer export, then adjudicate and freeze the gold set.'
].join('\n'));
console.log(JSON.stringify({ status: 'READY_FOR_HUMAN_ANNOTATION', manifest, assignmentFile: path.join(outDir, 'rater_assignments.json') }, null, 2));
