'use strict';
/**
 * Builds one blank rating sheet per rater from the assignments produced by
 * `npm run external:study:bootstrap` (eval/external_gold/study/rater_assignments.json)
 * plus the case_bank.json, so each rater gets exactly their assigned cases
 * with the right rubric dimensions and a slot to propose gold labels.
 *
 * Usage:
 *   node scripts/build_rating_sheets.js <case_bank.json> <study_dir> <module> [outDir]
 *
 * Example:
 *   node scripts/build_rating_sheets.js eval/external_gold/case_bank.json eval/external_gold/study assumptions eval/external_gold/sheets
 *
 * <module> selects which eval/rubrics.json dimension set applies to every
 * case in this bank (e.g. "assumptions", "challenge", "synthesize" — see
 * eval/rubrics.json `dimensions`). If your case bank mixes modules, split
 * it into per-module banks/studies rather than mixing dimension sets.
 */

const fs = require('node:fs');
const path = require('node:path');

const [, , bankPath, studyDir, moduleName, outDirArg] = process.argv;
if (!bankPath || !studyDir || !moduleName) {
  console.error('Usage: node build_rating_sheets.js <case_bank.json> <study_dir> <module> [outDir]');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const rubrics = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'rubrics.json'), 'utf8'));
const dims = rubrics.dimensions[moduleName];
if (!dims) {
  console.error(JSON.stringify({ status: 'UNKNOWN_MODULE', moduleName, available: Object.keys(rubrics.dimensions) }, null, 2));
  process.exit(1);
}

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const assignmentsPath = path.join(studyDir, 'rater_assignments.json');
const assignments = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8'));
const outDir = outDirArg || path.join(path.dirname(bankPath), 'sheets');
fs.mkdirSync(outDir, { recursive: true });

const casesById = new Map(bank.cases.map(c => [c.id, c]));

for (const raterId of assignments.raters) {
  const rows = assignments.assignments[raterId].map(a => {
    const c = casesById.get(a.caseId);
    return {
      caseId: a.caseId,
      split: a.split,
      studyPhase: a.studyPhase,
      isHiddenDuplicate: a.isHiddenDuplicate,
      sourceStudyId: c?.sourceStudyId || null,
      input: c?.input || null,
      candidateOutput: c?.prediction || null, // what the rater is judging

      // Rater fills these in:
      scores: Object.fromEntries(dims.map(d => [d, null])),   // 1-5 per dimension
      confidence: null,                                        // 1-5
      timeSeconds: null,
      proposedGold: {
        evidenceIds: [],
        themes: [],
        opportunities: [],
        contradictions: [],
        shouldAbstain: false
      },
      notes: ''
    };
  });

  const sheetPath = path.join(outDir, `${raterId}.sheet.json`);
  fs.writeFileSync(sheetPath, JSON.stringify({
    raterId,
    studyId: assignments.studyId,
    module: moduleName,
    dimensions: dims,
    instructions: 'Fill scores (1-5 per dimension, see eval/rubrics.json dimension_anchors), confidence, timeSeconds, and proposedGold per case. Do NOT look at other raters\' sheets or at goldVisible cases. Do not discuss cases with other raters until adjudication.',
    rows
  }, null, 2));
}

console.log(JSON.stringify({ status: 'SHEETS_WRITTEN', outDir, raters: assignments.raters, casesPerRater: assignments.assignments[assignments.raters[0]].length }, null, 2));
