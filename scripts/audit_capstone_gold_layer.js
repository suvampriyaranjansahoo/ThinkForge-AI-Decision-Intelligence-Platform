'use strict';
/**
 * Audit the user-supplied ThinkForge Gold Layer v1 without promoting it to
 * empirical gold. This audit distinguishes structural evidence from claims
 * that require real-world provenance or completed study artifacts.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const layer = path.join(root, 'eval', 'external_gold', 'capstone_gold_layer_v1');
const inputs = path.join(layer, '01_inputs');
const gold = path.join(layer, '02_gold');
const locked = path.join(layer, '03_locked_test');
const auditDir = path.join(layer, '04_audit');

const required = [
  'FULL150_RATER-01_annotated(2).csv',
  'FULL150_RATER-02_completed(2).csv',
  'FULL150_RATER-03_audited(3).csv',
  'ThinkForge_150_audited_final(3).csv',
  'ThinkForge_Pilot_Manifest_25 (1).csv',
  'ThinkForge_Pilot_Raw_Annotations_75 (2).csv',
  'ThinkForge_Pilot_Agreement_Statistics.csv',
  'stage1_gold_candidate.json',
  'human_adjudication_queue.json',
  'locked_test_manifest.csv',
  'evaluation_control.json',
  'FINALIZATION_GATE.json'
];

function exists(p) { return fs.existsSync(p); }
function resolve(name) {
  const candidates = [path.join(inputs,name), path.join(locked,name), path.join(gold,name), path.join(auditDir,name)];
  return candidates.find(exists);
}
function readCsv(name) {
  const p = resolve(name);
  if (!p) throw new Error(`Missing CSV: ${name}`);
  const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  return lines.slice(1).map(line => line.split(','));
}
function readCsvHeader(name) {
  const p = resolve(name);
  if (!p) throw new Error(`Missing CSV: ${name}`);
  return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)[0].split(',');
}
function sha256(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}
function parseJson(rel) { return JSON.parse(fs.readFileSync(path.join(layer, rel), 'utf8')); }

if (!exists(layer)) {
  console.error(JSON.stringify({status:'BLOCKED', reason:'capstone gold layer not embedded in repository', layer}, null, 2));
  process.exit(2);
}

const files = Object.fromEntries(required.map(f => [f, Boolean(resolve(f))]));
const r1 = readCsv('FULL150_RATER-01_annotated(2).csv');
const r2 = readCsv('FULL150_RATER-02_completed(2).csv');
const r3 = readCsv('FULL150_RATER-03_audited(3).csv');
const cases = readCsv('ThinkForge_150_audited_final(3).csv');
const pilot = readCsv('ThinkForge_Pilot_Raw_Annotations_75 (2).csv');
const pilotManifest = readCsv('ThinkForge_Pilot_Manifest_25 (1).csv');
const pilotStats = readCsv('ThinkForge_Pilot_Agreement_Statistics.csv');
const lock = readCsv('locked_test_manifest.csv').map(r => ({caseId:r[0], split:r[1], locked:r[2]}));
const candidate = parseJson('02_gold/stage1_gold_candidate.json');
const queue = parseJson('02_gold/human_adjudication_queue.json');
const finalization = parseJson('04_audit/FINALIZATION_GATE.json');
const scopeDecisionPath = path.join(layer,'04_audit','SCOPE_FINALIZATION_DECISION.json');
const scopeDecision = exists(scopeDecisionPath) ? JSON.parse(fs.readFileSync(scopeDecisionPath,'utf8')) : null;
const finalizedScope = scopeDecision?.decision === 'FINALIZE_146_CASE_GOLD' && Number(scopeDecision?.includedCaseCount) === 146;
const externalGoldPath = path.join(root, 'eval', 'external_gold', 'stage1_gold.json');
const externalGold = exists(externalGoldPath) ? JSON.parse(fs.readFileSync(externalGoldPath, 'utf8')) : null;
const confirmedCandidateIds = new Set((candidate.records || []).filter(r => r.status !== 'PENDING_HUMAN_ADJUDICATION').map(r => r.case_id));
const pendingCandidateIds = (candidate.records || []).filter(r => r.status === 'PENDING_HUMAN_ADJUDICATION').map(r => r.case_id).sort();
const externalGoldIds = new Set((externalGold?.cases || []).map(c => c.id));

const report = {
  reportVersion: 'capstone-gold-layer-audit-v1',
  source: 'user-supplied confidential capstone artifacts',
  embedded: true,
  structural: {
    caseCount: cases.length,
    raterRows: {r1:r1.length, r2:r2.length, r3:r3.length},
    pilotManifestCases: pilotManifest.length,
    pilotRawRows: pilot.length,
    lockedTestCases: lock.filter(x => x.split === 'LOCKED_TEST' && x.locked === 'True').length,
    developmentCases: lock.filter(x => x.split === 'DEVELOPMENT').length,
    candidateCases: Number(candidate.total_cases || candidate.records?.length || 0),
    candidateConfirmed: Number(candidate.confirmed_cases || 0),
    pendingAdjudication: Number(candidate.pending_human_adjudication || queue.total_cases || 0)
  },
  quality: {
    pilotRawContainsPlaceholders: pilot.some(r => r.some(v => /HUMAN SUBMISSION/.test(v))),
    pilotAgreementComputable: !pilotStats.some(r => r.join(',').includes('NOT COMPUTABLE')),
    r3HasCaseIdColumn: readCsvHeader('FULL150_RATER-03_audited(3).csv').includes('case_id'),
    r3HasRaterIdColumn: readCsvHeader('FULL150_RATER-03_audited(3).csv').includes('rater_id'),
    candidateHasPredictions: candidate.records?.some(r => Object.prototype.hasOwnProperty.call(r, 'prediction')) ?? false,
    finalizationBlocked: !finalizedScope,
    empiricalValidationBlocked: finalization.empirical_stage1 !== true,
    finalizationPendingCases: finalizedScope ? 0 : Number(finalization.pending_human_adjudication || 0),
    scopeFinalized: finalizedScope,
    frozenExternalGoldCases: externalGold?.cases?.length ?? 0,
    frozenExternalGoldMatchesConfirmedScope: Boolean(externalGold && externalGold.cases.length === candidate.confirmed_cases && externalGold.cases.every(c => confirmedCandidateIds.has(c.id))),
    frozenExternalGoldExcludesOnlyPendingCases: Boolean(externalGold?.scope && JSON.stringify([...(externalGold.scope.excludedPendingCaseIds || [])].sort()) === JSON.stringify(pendingCandidateIds))
  },
  integrity: {
    requiredFilesPresent: Object.values(files).every(Boolean),
    requiredFilesMissing: Object.entries(files).filter(([,ok])=>!ok).map(([f])=>f),
    sourceCaseIdsUnique: new Set(cases.map(r=>r[0])).size === cases.length,
    r1CaseIdsUnique: new Set(r1.map(r=>r[0])).size === r1.length,
    r2CaseIdsUnique: new Set(r2.map(r=>r[0])).size === r2.length,
    raterCaseSetsMatch: new Set(cases.map(r=>r[0])).size === new Set(r1.map(r=>r[0])).size && new Set(cases.map(r=>r[0])).size === new Set(r2.map(r=>r[0])).size,
    lockedFraction: cases.length ? Number((lock.filter(x=>x.split === 'LOCKED_TEST').length / cases.length).toFixed(4)) : 0
  },
  gateInterpretation: {
    annotationCollection: r1.length === 150 && r2.length === 150 && r3.length === 150 ? 'COMPLETE_STRUCTURALLY' : 'INCOMPLETE',
    pilot: pilot.length === 75 && pilotManifest.length === 25 && !pilot.some(r => r.some(v => /HUMAN SUBMISSION/.test(v))) ? 'EVIDENCED' : 'NOT_EVIDENCED',
    adjudication: finalizedScope ? 'COMPLETE_FOR_FINALIZED_146_CASE_SCOPE' : (candidate.confirmed_cases === 150 && queue.total_cases === 0 ? 'COMPLETE' : `${candidate.confirmed_cases} CONFIRMED / ${queue.total_cases} PENDING`),
    lockedTest: lock.filter(x=>x.split==='LOCKED_TEST').length / Math.max(1,cases.length) >= 0.5 ? 'PASS' : 'FAIL',
    frozenGold: externalGold ? (finalizedScope && externalGold.goldFrozen === true && externalGold.cases.length === 146 ? 'PRESENT_FINAL_146_SCOPE' : (externalGold.goldFrozen === true && externalGold.cases.length === candidate.confirmed_cases ? 'PRESENT_146_CONFIRMED' : 'PRESENT_BUT_SCOPE_MISMATCH')) : 'NOT_PRESENT',
    empiricalValidation: externalGold ? 'REQUIRES_SEPARATE_BLIND_CANDIDATE_RUN' : 'NOT_COMPLETE'
  },
  hashes: {
    rater1: sha256(path.join(inputs,'FULL150_RATER-01_annotated(2).csv')),
    rater2: sha256(path.join(inputs,'FULL150_RATER-02_completed(2).csv')),
    rater3: sha256(path.join(inputs,'FULL150_RATER-03_audited(3).csv')),
    caseBank: sha256(path.join(inputs,'ThinkForge_150_audited_final(3).csv'))
  }
};

const out = path.join(auditDir, 'CAPSTONE_INTEGRITY_REPORT.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({status:'AUDIT_COMPLETE', output:out, report}, null, 2));
process.exit(report.integrity.requiredFilesPresent && report.integrity.sourceCaseIdsUnique ? 0 : 2);
