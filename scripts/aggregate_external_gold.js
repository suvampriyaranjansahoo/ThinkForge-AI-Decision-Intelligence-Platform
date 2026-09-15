'use strict';
/**
 * Aggregates 3 completed rater sheets (from build_rating_sheets.js) plus an
 * optional adjudications file into eval/external_gold/researcher_annotations.json
 * — the exact input shape scripts/build_external_stage1_gold.js validates.
 *
 * Usage:
 *   node scripts/aggregate_external_gold.js <case_bank.json> <study_dir> <sheet1.json> <sheet2.json> <sheet3.json> [adjudications.json] [outPath]
 *
 * Agreement rule: a case is "agreement" only if all 3 raters' proposedGold
 * (evidenceIds/themes/opportunities/contradictions/shouldAbstain, compared
 * as sets) are identical. Any difference is flagged as a disagreement and
 * left BLOCKED until it appears (with a completed record) in the
 * adjudications file — raw ratings are never averaged into gold.
 *
 * adjudications.json shape:
 *   [
 *     { "caseId": "CASE-0002", "adjudicatorId": "ADJ-01",
 *       "rationale": "...",
 *       "finalGold": { "evidenceIds": [...], "themes": [...], "opportunities": [...], "contradictions": [...], "shouldAbstain": false },
 *       "finalScores": { "decision_relevance": 4, ... } }
 *   ]
 */

const fs = require('node:fs');
const path = require('node:path');

const [, , bankPath, studyDir, sheetA, sheetB, sheetC, adjArg, outArg] = process.argv;
if (!bankPath || !studyDir || !sheetA || !sheetB || !sheetC) {
  console.error('Usage: node aggregate_external_gold.js <case_bank.json> <study_dir> <sheet1.json> <sheet2.json> <sheet3.json> [adjudications.json] [outPath]');
  process.exit(1);
}

const hasAdjArg = adjArg && fs.existsSync(adjArg);
const adjPath = hasAdjArg ? adjArg : null;
const outPath = (hasAdjArg ? outArg : adjArg) || path.join(path.dirname(bankPath), 'researcher_annotations.json');

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const manifestPath = path.join(studyDir, 'study_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sheets = [sheetA, sheetB, sheetC].map(p => JSON.parse(fs.readFileSync(p, 'utf8')));
const adjudications = adjPath ? JSON.parse(fs.readFileSync(adjPath, 'utf8')) : [];
const adjByCaseId = new Map(adjudications.map(a => [a.caseId, a]));

const raterIds = sheets.map(s => s.raterId);
if (new Set(raterIds).size < 3) {
  console.error(JSON.stringify({ status: 'BLOCKED', message: 'Need 3 distinct raterIds across the 3 sheets', raterIds }, null, 2));
  process.exit(2);
}

// Index each sheet's rows by caseId
const rowsByCase = new Map(); // caseId -> [{raterId, row}]
for (const sheet of sheets) {
  for (const row of sheet.rows) {
    if (!rowsByCase.has(row.caseId)) rowsByCase.set(row.caseId, []);
    rowsByCase.get(row.caseId).push({ raterId: sheet.raterId, row });
  }
}

const normSet = arr => JSON.stringify([...new Set((arr || []).map(String))].sort());
const goldKey = g => [normSet(g.evidenceIds), normSet(g.themes), normSet(g.opportunities), normSet(g.contradictions), Boolean(g.shouldAbstain)].join('|');

const problems = [];
const outCases = [];
const splitCounts = { development: 0, validation: 0, locked_test: 0 };

for (const bankCase of bank.cases) {
  const entries = rowsByCase.get(bankCase.id) || [];
  if (entries.length < 3) {
    problems.push(`case ${bankCase.id}: only ${entries.length}/3 raters have submitted a row — cannot freeze yet`);
    continue;
  }
  const incomplete = entries.filter(({ row }) =>
    Object.values(row.scores || {}).some(v => v === null || v === undefined) ||
    row.confidence === null || row.confidence === undefined
  );
  if (incomplete.length) {
    problems.push(`case ${bankCase.id}: incomplete scores/confidence from rater(s) ${incomplete.map(x => x.raterId).join(', ')}`);
    continue;
  }

  const split = entries[0].row.split;
  const proposedKeys = entries.map(({ row }) => goldKey(row.proposedGold));
  const allAgree = proposedKeys.every(k => k === proposedKeys[0]);

  const ratings = entries.map(({ raterId, row }) => ({
    raterId,
    scores: row.scores,
    confidence: row.confidence,
    timeSeconds: row.timeSeconds
  }));

  let adjudicationStatus, disagreement, gold, adjudication;

  if (allAgree) {
    adjudicationStatus = 'agreement';
    disagreement = false;
    gold = entries[0].row.proposedGold;
    adjudication = null;
  } else {
    const rec = adjByCaseId.get(bankCase.id);
    if (!rec || !rec.adjudicatorId || !rec.finalGold || !rec.rationale) {
      problems.push(`case ${bankCase.id}: raters disagree on gold labels and no completed adjudication record exists`);
      continue;
    }
    adjudicationStatus = 'adjudicated';
    disagreement = true;
    gold = rec.finalGold;
    adjudication = {
      required: true,
      completed: true,
      adjudicatorId: rec.adjudicatorId,
      rationale: rec.rationale,
      finalScores: rec.finalScores || null
    };
  }

  splitCounts[split] = (splitCounts[split] || 0) + 1;
  outCases.push({
    id: bankCase.id,
    sourceStudyId: bankCase.sourceStudyId,
    split,
    adjudicationStatus,
    disagreement,
    gold,
    ratings,
    ...(adjudication ? { adjudication } : {})
  });
}

if (problems.length) {
  console.error(JSON.stringify({ status: 'NOT_YET_FREEZABLE', problems: problems.slice(0, 50), problemCount: problems.length, readyCases: outCases.length, totalCases: bank.cases.length }, null, 2));
  process.exit(2);
}

if (outCases.length < 100) {
  console.error(JSON.stringify({ status: 'BLOCKED', message: 'Fewer than 100 fully-resolved cases', readyCases: outCases.length }, null, 2));
  process.exit(2);
}
if (splitCounts.locked_test < Math.ceil(outCases.length * 0.5)) {
  console.error(JSON.stringify({ status: 'BLOCKED', message: 'locked_test split is below 50% of resolved cases', splitCounts }, null, 2));
  process.exit(2);
}

const out = {
  goldVersion: `${bank.studyId || 'stage1-external-gold'}-${new Date().toISOString().slice(0, 10)}`,
  codebookVersion: bank.codebookVersion,
  goldFrozen: false,
  annotationsComplete: true,
  synthetic: false,
  generatedByModel: false,
  adjudicated: true,
  independentEvaluators: new Set(raterIds).size,
  studyManifest: bank.studyManifest,
  cases: outCases
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  status: 'RESEARCHER_ANNOTATIONS_WRITTEN',
  output: outPath,
  cases: outCases.length,
  splitCounts,
  raters: [...new Set(raterIds)],
  agreementCases: outCases.filter(c => c.adjudicationStatus === 'agreement').length,
  adjudicatedCases: outCases.filter(c => c.adjudicationStatus === 'adjudicated').length,
  nextStep: 'npm run gold:external:build'
}, null, 2));
