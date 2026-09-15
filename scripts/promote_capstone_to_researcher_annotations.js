'use strict';
/**
 * Reconciles the two previously-parallel Stage 1 gold pipelines.
 *
 * Before this script: capstone_gold_layer_v1/ (real, 150 cases, 3 raters,
 * 4 pending adjudications) and eval/external_gold/{case_bank,researcher_
 * annotations,stage1_gold}.json (the original pipeline, still at 0 real
 * cases) were two disconnected "final gold" concepts -- exactly the
 * parallel-schema entropy the project's own Rule G warns against.
 *
 * This script does NOT invent a third format. It transforms the real
 * capstone data into the researcher_annotations.json shape
 * build_external_stage1_gold.js already validates (using the new
 * per-case-provenance mode, since these 150 cases each have their own real
 * source URL rather than belonging to 3 aggregated published studies), so
 * there is exactly one canonical builder and one canonical output going
 * forward.
 *
 * FAIL-CLOSED BY DEFAULT: 4 of 150 cases are PENDING_HUMAN_ADJUDICATION
 * per human_adjudication_queue.json. This script refuses to produce an
 * output at all unless you explicitly choose how to handle that:
 *
 *   --include-confirmed-only
 *       Produce researcher_annotations.json using ONLY the 146 confirmed
 *       cases. The 4 pending cases are excluded, not guessed, not
 *       adjudicated by this script. This is a real, visible reduction in
 *       scope (146 cases, not 150) -- not a promotion of pending work to
 *       "done".
 *
 * There is deliberately no flag that includes the 4 pending cases with a
 * synthesized resolution. That decision belongs to a real human
 * adjudicator, per human_adjudication_queue.json's own instructions
 * ("resolve each pending case from original evidence without seeing
 * ThinkForge output").
 *
 * Usage:
 *   node scripts/promote_capstone_to_researcher_annotations.js --include-confirmed-only
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const capstoneDir = path.join(root, 'eval', 'external_gold', 'capstone_gold_layer_v1');
const outPath = path.join(root, 'eval', 'external_gold', 'researcher_annotations.json');

const flags = process.argv.slice(2);
const fail = (message, details = {}) => { console.error(JSON.stringify({ status: 'BLOCKED', message, ...details }, null, 2)); process.exit(2); };

const gatePath = path.join(capstoneDir, '04_audit', 'FINALIZATION_GATE.json');
if (!fs.existsSync(gatePath)) fail('FINALIZATION_GATE.json not found; run npm run capstone:audit first.', { gatePath });
const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
const scopeDecisionPath = path.join(capstoneDir, '04_audit', 'SCOPE_FINALIZATION_DECISION.json');
const scopeDecision = fs.existsSync(scopeDecisionPath) ? JSON.parse(fs.readFileSync(scopeDecisionPath,'utf8')) : null;
const finalized146Scope = scopeDecision?.decision === 'FINALIZE_146_CASE_GOLD' && Number(scopeDecision?.includedCaseCount) === 146;

if (gate.pending_human_adjudication > 0 && !flags.includes('--include-confirmed-only') && !finalized146Scope) {
  fail(
    `${gate.pending_human_adjudication} case(s) are still PENDING_HUMAN_ADJUDICATION. This script will not guess a resolution for them.`,
    {
      pendingCases: gate.pending_human_adjudication,
      resolution: 'Either get a real human adjudicator to resolve them in eval/external_gold/capstone_gold_layer_v1/02_gold/human_adjudication_queue.json, or re-run this script with --include-confirmed-only to build gold from only the confirmed cases (a smaller, explicitly reduced set, not the full 150).'
    }
  );
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length);
  const parseLine = (line) => {
    const fields = []; let field = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQuotes && line[i + 1] === '"') { field += '"'; i++; } else inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { fields.push(field); field = ''; }
      else field += ch;
    }
    fields.push(field);
    return fields;
  };
  const header = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, ''));
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = values[i]; });
    return row;
  });
}

// --- Load real capstone artifacts ---
const candidate = JSON.parse(fs.readFileSync(path.join(capstoneDir, '02_gold', 'stage1_gold_candidate.json'), 'utf8'));
const confirmed = JSON.parse(fs.readFileSync(path.join(capstoneDir, '02_gold', 'confirmed_gold_eligible.json'), 'utf8'));
const splitRows = parseCsv(fs.readFileSync(path.join(capstoneDir, '03_locked_test', 'locked_test_manifest.csv'), 'utf8'));
const provenanceRows = parseCsv(fs.readFileSync(path.join(capstoneDir, '01_inputs', 'normalized', '02_real_case_provenance.csv'), 'utf8'));
const raterFiles = {
  'RATER-01': path.join(capstoneDir, '01_inputs', "FULL150_RATER-01_annotated(2).csv"),
  'RATER-02': path.join(capstoneDir, '01_inputs', "FULL150_RATER-02_completed(2).csv"),
  'RATER-03': path.join(capstoneDir, '01_inputs', 'FULL150_RATER-03_normalized.csv')
};
for (const [id, p] of Object.entries(raterFiles)) if (!fs.existsSync(p)) fail(`Expected rater file for ${id} not found.`, { path: p });
const raterRows = Object.fromEntries(Object.entries(raterFiles).map(([id, p]) => [id, parseCsv(fs.readFileSync(p, 'utf8'))]));

const splitByCaseId = new Map(splitRows.map(r => [r.case_id, r.split === 'LOCKED_TEST' ? 'locked_test' : 'development']));
const provenanceByCaseId = new Map(provenanceRows.map(r => [r.case_id, r]));
const ratingsByCaseId = new Map();
for (const [raterId, rows] of Object.entries(raterRows)) {
  for (const row of rows) {
    if (!ratingsByCaseId.has(row.case_id)) ratingsByCaseId.set(row.case_id, []);
    ratingsByCaseId.get(row.case_id).push({
      raterId,
      scores: {
        failure_category: row.failure_category || null,
        severity: row.severity || null,
        affected_stakeholder: row.affected_stakeholder || null,
        root_cause: row.root_cause || null
      },
      contradiction: String(row.contradiction).toLowerCase() === 'true',
      abstention: String(row.abstention).toLowerCase() === 'true',
      confidence: Number(row.confidence) || null
    });
  }
}

const useConfirmedOnly = flags.includes('--include-confirmed-only') || finalized146Scope;
const sourceRecordsRaw = useConfirmedOnly ? confirmed.records : candidate.records.filter(r => r.status !== 'PENDING_HUMAN_ADJUDICATION');

// Some confirmed records use documented prior adjudication but do not carry
// an adjudicator identity in the supplied capstone artifact. Do NOT invent an
// identity. Preserve the documented resolution as an explicit provenance
// record so these confirmed cases remain in the 146-case gold scope without
// pretending that the source supplied a person-level adjudicator identifier.
const priorAdjudicationWithoutIdentity = sourceRecordsRaw
  .filter(r => r.resolution_source === 'documented_prior_adjudication' && !r.adjudicator_id)
  .map(r => r.case_id);
const unsupportedResolutionRecords = sourceRecordsRaw
  .filter(r => r.resolution_source !== 'unanimous_rater_agreement'
    && r.resolution_source !== 'documented_prior_adjudication')
  .map(r => r.case_id);
if (unsupportedResolutionRecords.length) {
  fail('Confirmed record uses an unsupported resolution source.', { caseIds: unsupportedResolutionRecords });
}
const sourceRecords = sourceRecordsRaw;
const cases = [];
for (const rec of sourceRecords) {
  const prov = provenanceByCaseId.get(rec.case_id);
  const sourceUrl = rec.source || prov?.source_url;
  if (!sourceUrl) fail('Case is missing a real source URL.', { caseId: rec.case_id });
  const split = splitByCaseId.get(rec.case_id);
  if (!split) fail('Case is missing a locked/development split assignment.', { caseId: rec.case_id });
  const ratings = ratingsByCaseId.get(rec.case_id) || [];
  if (ratings.length < 3) fail('Case has fewer than 3 rater rows.', { caseId: rec.case_id, ratings: ratings.length });

  const isUnanimous = rec.resolution_source === 'unanimous_rater_agreement';
  cases.push({
    id: rec.case_id,
    sourceUrl,
    sourceStudyId: 'user-supplied-capstone-2026',
    split,
    adjudicationStatus: isUnanimous ? 'agreement' : 'adjudicated',
    disagreement: !isUnanimous,
    gold: {
      evidenceIds: String(rec.final_evidence_ids || '').split(',').map(s => s.trim()).filter(Boolean),
      themes: rec.final_theme ? [rec.final_theme] : [],
      opportunities: rec.final_opportunity ? [rec.final_opportunity] : [],
      contradictions: []
    },
    ratings: ratings.map(({ raterId, scores, confidence }) => ({ raterId, scores, confidence })),
    ...(isUnanimous ? {} : {
      adjudication: {
        required: true,
        completed: true,
        source: 'documented_prior_adjudication',
        sourceRecord: 'capstone_gold_layer_v1/02_gold/confirmed_gold_eligible.json',
        ...(rec.adjudicator_id ? { adjudicatorId: rec.adjudicator_id } : {}),
        rationale: (rec.flags || []).join('; ') || 'Resolved by a documented prior adjudication recorded in the supplied capstone gold-eligible artifact; no adjudicator identity was supplied.'
      }
    })
  });
}

const countsBySplit = { development: 0, locked_test: 0 };
for (const c of cases) countsBySplit[c.split]++;
const pendingCaseIds = candidate.records.filter(r => r.status === 'PENDING_HUMAN_ADJUDICATION').map(r => r.case_id);
const confirmedCaseIds = candidate.records.filter(r => r.status !== 'PENDING_HUMAN_ADJUDICATION').map(r => r.case_id);

const out = {
  goldVersion: `stage1-capstone-confirmed${cases.length}-${new Date().toISOString().slice(0, 10)}`,
  codebookVersion: 'capstone-failure-taxonomy-v1',
  goldFrozen: false,
  annotationsComplete: true,
  synthetic: false,
  generatedByModel: false,
  adjudicated: true,
  independentEvaluators: 3,
  studyManifest: {
    perCaseProvenance: true,
    note: 'Each case carries its own real, individually checkable public source URL (see sourceUrl per case) rather than belonging to a small number of aggregated named studies.'
  },
  scope: {
    sourceCaseCount: candidate.total_cases,
    confirmedCaseCount: candidate.confirmed_cases,
    pendingCaseCount: finalized146Scope ? 0 : candidate.pending_human_adjudication,
    includedCaseCount: cases.length,
    excludedPendingCaseIds: pendingCaseIds,
    scopeFinalized: finalized146Scope,
    scopeStatus: finalized146Scope ? 'FINALIZED_146_CASES' : 'PENDING_ADJUDICATION',
    exclusionReason: finalized146Scope ? scopeDecision.reason : undefined,
    confirmedCaseIdsHash: require('node:crypto').createHash('sha256').update(JSON.stringify(confirmedCaseIds)).digest('hex'),
    priorAdjudicationWithoutIdentityCaseIds: priorAdjudicationWithoutIdentity
  },
  cases
};

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  status: 'RECONCILED',
  output: outPath,
  mode: useConfirmedOnly ? 'confirmed-only (146 target)' : 'all-non-pending',
  totalCases: cases.length,
  splitCounts: countsBySplit,
  excludedPending: pendingCaseIds,
  priorAdjudicationWithoutIdentity,
  nextStep: 'npm run gold:external:build -- eval/external_gold/researcher_annotations.json eval/external_gold/stage1_gold.json'
}, null, 2));
