'use strict';
/**
 * Generates blank case_bank.json cases in the shape lib/externalGoldStudy.js
 * validateRealCase() requires, so `npm run external:study:bootstrap` can
 * consume them once you fill in real content.
 *
 * Usage:
 *   node scripts/generate_case_bank_skeleton.js <totalCases> <sourceStudyIds,comma,separated> [outputPath]
 *
 * Example:
 *   node scripts/generate_case_bank_skeleton.js 120 XAI-FUNGI,QUAL-INTERVIEW-CORPUS,TRIPLE eval/external_gold/case_bank.json
 *
 * What you still have to fill in per case, by hand:
 *   - input.prompt: the real (anonymized) research material / decision
 *     context drawn from the named source study.
 *   - prediction: what your actual Stage 1 module produced for that input
 *     (run the real pipeline against input.prompt and paste its output here
 *     — never hand-write a plausible-looking prediction).
 *   - sourceProvenance: transcript/participant/case ID within the source
 *     study, so provenance is auditable back to the original dataset.
 */

const fs = require('node:fs');
const path = require('node:path');

const total = parseInt(process.argv[2], 10);
const sourceIds = (process.argv[3] || 'SOURCE-1,SOURCE-2,SOURCE-3').split(',').map(s => s.trim());
const outPath = process.argv[4] || path.join(__dirname, '..', 'eval', 'external_gold', 'case_bank.json');

if (!total || total < 100) {
  console.error('Usage: node generate_case_bank_skeleton.js <totalCases (>=100)> <sourceIds,comma,separated> [outputPath]');
  process.exit(1);
}

const pad = (n, width) => String(n).padStart(width, '0');

const cases = [];
for (let i = 0; i < total; i++) {
  cases.push({
    id: `CASE-${pad(i + 1, 4)}`,
    sourceStudyId: sourceIds[i % sourceIds.length],
    sourceProvenance: 'TODO: transcript/participant/case ID within the source study',
    synthetic: false,
    generatedByModel: false,
    input: {
      prompt: 'TODO: paste the real (anonymized) research material / decision context here'
    },
    prediction: {
      evidenceIds: [],
      themes: [],
      opportunities: [],
      contradictions: [],
      shouldAbstain: false
      // TODO: replace with the actual output of running your Stage 1
      // module against input.prompt — this is the system output raters
      // will be judging, not a hand-written guess.
    }
  });
}

const bank = {
  studyId: 'stage1-external-gold-v1',
  codebookVersion: 'tf-rubric-v3.1',
  synthetic: false,
  generatedByModel: false,
  studyManifest: {
    sources: sourceIds.map(id => ({
      id,
      title: 'TODO: real study title',
      url: 'TODO: real DOI / repository URL',
      realHumanData: true,
      provenance: 'TODO: how you obtained/accessed this dataset, version/date',
      synthetic: false,
      generatedByModel: false,
      ...(id === 'XAI-FUNGI' ? { themeCodebookFile: 'eval/external_gold/reference/xai_fungi_codebook.csv' } : {})
    }))
  },
  _note: sourceIds.includes('XAI-FUNGI')
    ? 'For XAI-FUNGI cases: themeCodebookFile is set to eval/external_gold/reference/xai_fungi_codebook.csv (REAL, published, CC-BY-4.0, DOI 10.5281/zenodo.15222484). build_external_stage1_gold.js MECHANICALLY REJECTS any gold.themes/prediction.themes value for this source that is not a real code from that file -- invented theme labels will fail the freeze step, not just look wrong. Transcript text itself (input.prompt) must still be pasted in by a human who has downloaded and unzipped TRANSCRIPTS.zip locally.'
    : undefined,
  cases
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(bank, null, 2));
console.log(JSON.stringify({ status: 'CASE_BANK_SKELETON_WRITTEN', output: outPath, cases: total, sources: sourceIds }, null, 2));
