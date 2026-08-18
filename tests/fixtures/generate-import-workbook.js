#!/usr/bin/env node

/**
 * Generates the .xlsx used to exercise the bulk-import path at scale.
 *
 * Companion to generate-scale-repo.js. That script writes concept files directly and
 * pushes them with git, bypassing the app; this one produces the spreadsheet a user
 * would actually upload, so the whole chain runs: XLSX parse -> parseColumns ->
 * assignConcepts -> structureDictionary -> validateImportData -> batched commitFiles.
 *
 * LAYOUT — dictated by src/dictionary.js, not by preference:
 *   - PRIMARY / SECONDARY references resolve by walking BACKWARD to the nearest
 *     non-empty key (findParentConceptId), so those columns are filled once at the top
 *     of a block and left blank beneath it, like a spreadsheet outline.
 *   - SOURCE resolves on the SAME ROW ONLY (addHierarchicalReferences), so it is
 *     repeated on every question row that has one.
 *   - RESPONSE references are collected FORWARD from the question row until the next
 *     row carrying a question key (collectResponses), so a question's first response
 *     shares its row and the rest follow beneath it.
 *   - Every concept key must be globally unique and is matched case-insensitively:
 *     assignConcepts shares one `seenConcepts` set across all types.
 *   - CID cells must be real numbers. validateConceptID rejects strings outright
 *     (`typeof id !== 'number'`), and CONFIG.CONCEPT_FORMAT requires exactly 9 digits.
 *
 * Response sets are shared across questions on purpose. The import dedupes concepts by
 * key, so a repeated label collapses to one RESPONSE concept referenced by many
 * questions — the real dictionary is a DAG, not a per-question tree.
 *
 * Usage:
 *   node tests/fixtures/generate-import-workbook.js [outFile] [--questions=7719]
 *                                                   [--sets=48] [--seed=42] [--no-cids]
 *
 * Defaults produce exactly 8,000 concepts, matching the shape of the real dictionary:
 *   5 PRIMARY, 40 SECONDARY, 10 SOURCE, 7,719 QUESTION, 226 RESPONSE
 *
 * Start small before the full run:
 *   node tests/fixtures/generate-import-workbook.js /tmp/smoke.xlsx --questions=40 --sets=4
 */

import { writeFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const match = args.find(a => a.startsWith(`--${name}=`));
    return match ? match.split('=')[1] : fallback;
};

const positional = args.filter(a => !a.startsWith('--'));
const outFile = resolve(positional[0] || join(__dirname, 'import-scale.xlsx'));
const questionTarget = Number(flag('questions', 7719));
const seed = Number(flag('seed', 42));
const omitCids = args.includes('--no-cids');

if (!Number.isInteger(questionTarget) || questionTarget < 1) {
    console.error('--questions must be a positive integer');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Deterministic RNG so re-runs produce an identical workbook
// ---------------------------------------------------------------------------

const mulberry32 = (a) => () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const random = mulberry32(seed);
const pick = (list) => list[Math.floor(random() * list.length)];

// ---------------------------------------------------------------------------
// Identity allocation
// ---------------------------------------------------------------------------

const usedIds = new Set();
const usedKeys = new Set();

// Matches ghauth/domain/conceptId.js and CONFIG.CONCEPT_FORMAT: a 9-digit integer.
const nextConceptId = () => {
    for (;;) {
        const id = Math.floor(100000000 + random() * 900000000);
        if (!usedIds.has(id)) {
            usedIds.add(id);
            return id;
        }
    }
};

const nextKey = (base) => {
    const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!usedKeys.has(clean)) {
        usedKeys.add(clean);
        return clean;
    }
    for (let n = 2; ; n++) {
        const candidate = `${clean}_${n}`;
        if (!usedKeys.has(candidate)) {
            usedKeys.add(candidate);
            return candidate;
        }
    }
};

// ---------------------------------------------------------------------------
// Vocabulary (kept in step with generate-scale-repo.js so both fixtures describe
// the same imaginary dictionary)
// ---------------------------------------------------------------------------

const PRIMARY_KEYS = ['demographics', 'health_history', 'lifestyle', 'biospecimen', 'follow_up'];

const SECONDARY_TOPICS = [
    'baseline', 'household', 'education', 'employment', 'income', 'insurance',
    'cancer_screening', 'family_history'
];

const SOURCE_KEYS = [
    'phenx_toolkit', 'nhanes', 'brfss', 'nhis', 'psid',
    'sf_36', 'promis', 'ihq', 'cancer_registry', 'internal_authored'
];

const QUESTION_STEMS = [
    'has_ever', 'current_status', 'age_at_first', 'frequency_of', 'duration_of',
    'number_of', 'date_of', 'type_of', 'reason_for', 'severity_of',
    'last_occurrence', 'provider_reported', 'self_reported', 'confidence_in', 'change_in'
];

const QUESTION_SUBJECTS = [
    'smoking', 'vaping', 'alcohol_use', 'mammogram', 'colonoscopy', 'pap_test',
    'psa_test', 'skin_exam', 'diabetes', 'hypertension', 'asthma', 'arthritis',
    'depression', 'anxiety', 'sleep_apnea', 'obesity', 'exercise', 'red_meat',
    'fruit_intake', 'vegetable_intake', 'sun_exposure', 'sunscreen_use',
    'hormone_therapy', 'oral_contraceptive', 'pregnancy', 'breastfeeding',
    'radiation_exposure', 'chemotherapy', 'surgery', 'hospitalization'
];

const QUESTION_QUALIFIERS = [
    'baseline', 'follow_up', 'past_12_months', 'past_30_days', 'lifetime',
    'current', 'childhood', 'adulthood', 'self_report', 'proxy_report',
    'screening', 'diagnostic', 'confirmed', 'suspected', 'first_occurrence',
    'most_recent', 'annual', 'quarterly', 'pre_enrollment', 'post_enrollment'
];

const GENERIC_RESPONSE_SETS = [
    ['yes', 'no'],
    ['yes', 'no', 'dont_know'],
    ['yes', 'no', 'prefer_not_to_answer'],
    ['never', 'rarely', 'sometimes', 'often', 'always'],
    ['none', 'mild', 'moderate', 'severe'],
    ['daily', 'weekly', 'monthly', 'yearly', 'never'],
    ['strongly_disagree', 'disagree', 'neutral', 'agree', 'strongly_agree'],
    ['less_than_1_year', '1_to_5_years', '6_to_10_years', 'more_than_10_years']
];

const MEASURES = [
    'cigarettes_per_day', 'drinks_per_week', 'servings_per_day', 'hours_per_night',
    'minutes_per_session', 'days_per_week', 'times_per_year', 'years_since_quitting',
    'age_at_diagnosis', 'pack_years', 'cups_per_day', 'flights_of_stairs',
    'miles_walked', 'body_mass_index', 'systolic_pressure', 'resting_heart_rate',
    'household_size', 'children_born', 'doctor_visits', 'nights_hospitalized',
    'prescriptions_taken', 'supplements_taken', 'hours_seated', 'screen_time_hours',
    'sunburns_per_year', 'dental_visits', 'vision_exams', 'blood_donations',
    'weight_change_pounds', 'height_inches', 'waist_circumference', 'grip_strength',
    'sleep_interruptions', 'caffeine_servings', 'water_glasses', 'meals_skipped',
    'takeout_meals', 'alcohol_binges', 'years_at_residence', 'commute_minutes'
];

const RANGE_BUCKETS = ['none', '1_to_5', '6_to_10', '11_to_20', 'more_than_20'];

// ---------------------------------------------------------------------------
// Build the concept inventory
// ---------------------------------------------------------------------------

const makeConcept = (objectType, baseKey) => ({
    key: nextKey(baseKey),
    conceptID: nextConceptId(),
    object_type: objectType
});

const primaries = PRIMARY_KEYS.map(key => makeConcept('PRIMARY', key));

const secondaries = [];
for (const primary of primaries) {
    for (const topic of SECONDARY_TOPICS) {
        secondaries.push({
            ...makeConcept('SECONDARY', `${primary.key}_${topic}`),
            primary
        });
    }
}

const sources = SOURCE_KEYS.map(key => makeConcept('SOURCE', key));

const allSetLabels = [
    ...GENERIC_RESPONSE_SETS,
    ...MEASURES.map(measure => RANGE_BUCKETS.map(bucket => `${measure}_${bucket}`))
];

const setLimit = Math.min(Number(flag('sets', allSetLabels.length)), allSetLabels.length);
if (!Number.isInteger(setLimit) || setLimit < 1) {
    console.error(`--sets must be an integer between 1 and ${allSetLabels.length}`);
    process.exit(1);
}

// One concept per distinct label, shared across every set that uses it.
const responsesByLabel = new Map();
const responseSets = allSetLabels.slice(0, setLimit).map(labels => labels.map(label => {
    if (!responsesByLabel.has(label)) {
        responsesByLabel.set(label, makeConcept('RESPONSE', label));
    }
    return responsesByLabel.get(label);
}));

const questionNames = [];
for (const stem of QUESTION_STEMS) {
    for (const subject of QUESTION_SUBJECTS) {
        for (const qualifier of QUESTION_QUALIFIERS) {
            questionNames.push(`${stem}_${subject}_${qualifier}`);
        }
    }
}
for (let i = questionNames.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [questionNames[i], questionNames[j]] = [questionNames[j], questionNames[i]];
}

if (questionTarget > questionNames.length) {
    console.error(`--questions cannot exceed ${questionNames.length} distinct names; add more stems, subjects or qualifiers`);
    process.exit(1);
}

// Questions are dealt out in block order because the spreadsheet encodes parentage by
// POSITION: a question belongs to whichever secondary appears above it.
const questions = [];
for (let i = 0; i < questionTarget; i++) {
    questions.push({
        ...makeConcept('QUESTION', questionNames[i]),
        secondary: secondaries[i % secondaries.length],
        // sourceConceptId is optional in the config, so leaving some blank is realistic
        source: random() < 0.6 ? pick(sources) : null,
        responses: pick(responseSets)
    });
}
questions.sort((a, b) => secondaries.indexOf(a.secondary) - secondaries.indexOf(b.secondary));

// ---------------------------------------------------------------------------
// Lay out the sheet
// ---------------------------------------------------------------------------

const COLUMNS = [
    'PRIMARY_KEY', 'PRIMARY_CID',
    'SECONDARY_KEY', 'SECONDARY_CID',
    'SOURCE_KEY', 'SOURCE_CID',
    'QUESTION_KEY', 'QUESTION_CID',
    'RESPONSE_KEY', 'RESPONSE_CID'
];

const col = Object.fromEntries(COLUMNS.map((name, i) => [name, i]));

// parseColumns matches /^TYPE_([a-zA-Z]+)$/ — a digit or second underscore silently
// drops the column, which surfaces later as "missing required field" on every row.
for (const header of COLUMNS) {
    if (!/^(PRIMARY|SECONDARY|SOURCE|QUESTION|RESPONSE)_[a-zA-Z]+$/.test(header)) {
        throw new Error(`Header "${header}" will not be recognised by parseColumns`);
    }
}

const rows = [COLUMNS.slice()];
const blankRow = () => new Array(COLUMNS.length).fill(null);

const setCell = (row, name, value) => {
    row[col[name]] = value;
};

const writeId = (row, name, concept) => {
    if (!omitCids) setCell(row, name, concept.conceptID);
};

let lastPrimary = null;
let lastSecondary = null;

for (const question of questions) {
    const secondary = question.secondary;
    const primary = secondary.primary;

    question.responses.forEach((response, responseIndex) => {
        const row = blankRow();

        if (responseIndex === 0) {
            if (primary !== lastPrimary) {
                setCell(row, 'PRIMARY_KEY', primary.key);
                writeId(row, 'PRIMARY_CID', primary);
                lastPrimary = primary;
                lastSecondary = null;
            }

            if (secondary !== lastSecondary) {
                setCell(row, 'SECONDARY_KEY', secondary.key);
                writeId(row, 'SECONDARY_CID', secondary);
                lastSecondary = secondary;
            }

            setCell(row, 'QUESTION_KEY', question.key);
            writeId(row, 'QUESTION_CID', question);

            // Same-row rule: a source written anywhere else is silently ignored
            if (question.source) {
                setCell(row, 'SOURCE_KEY', question.source.key);
                writeId(row, 'SOURCE_CID', question.source);
            }
        }

        setCell(row, 'RESPONSE_KEY', response.key);
        writeId(row, 'RESPONSE_CID', response);

        rows.push(row);
    });
}

// ---------------------------------------------------------------------------
// Self-check: replay the parser's own resolution rules against the laid-out grid,
// so a layout mistake fails here rather than after an 8,000-file browser run
// ---------------------------------------------------------------------------

const cell = (row, name) => {
    const value = rows[row][col[name]];
    return value === '' || value === null || value === undefined ? undefined : value;
};

const lookBackward = (fromRow, name) => {
    for (let i = fromRow; i >= 1; i--) {
        const value = cell(i, name);
        if (value) return value;
    }
    return undefined;
};

const problems = [];

for (let r = 1; r < rows.length; r++) {
    if (cell(r, 'QUESTION_KEY')) {
        if (!lookBackward(r, 'SECONDARY_KEY')) {
            problems.push(`row ${r + 1}: question "${cell(r, 'QUESTION_KEY')}" has no SECONDARY above it (required field)`);
        }

        // collectResponses stops at the next row carrying a question key
        let found = 0;
        for (let i = r; i < rows.length; i++) {
            if (i > r && cell(i, 'QUESTION_KEY')) break;
            if (cell(i, 'RESPONSE_KEY')) found++;
        }
        if (found === 0) problems.push(`row ${r + 1}: question "${cell(r, 'QUESTION_KEY')}" reaches no response rows`);
    }

    if (cell(r, 'SECONDARY_KEY') && !lookBackward(r, 'PRIMARY_KEY')) {
        problems.push(`row ${r + 1}: secondary "${cell(r, 'SECONDARY_KEY')}" has no PRIMARY above it (required field)`);
    }
}

const seenLower = new Set();
for (const key of usedKeys) {
    if (seenLower.has(key.toLowerCase())) problems.push(`duplicate key (case-insensitive): ${key}`);
    seenLower.add(key.toLowerCase());
}

for (const id of usedIds) {
    if (typeof id !== 'number' || !/^\d{9}$/.test(String(id))) {
        problems.push(`concept id ${id} is not a 9-digit number`);
    }
}

if (problems.length) {
    console.error(`Layout self-check failed (${problems.length} problem(s)):`);
    problems.slice(0, 20).forEach(p => console.error(`  - ${p}`));
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const sheet = XLSX.utils.aoa_to_sheet(rows);
const workbook = XLSX.utils.book_new();
// readSpreadsheet prefers a sheet literally named "Dictionary"
XLSX.utils.book_append_sheet(workbook, sheet, 'Dictionary');
XLSX.writeFile(workbook, outFile);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const responseCount = responsesByLabel.size;
const totalConcepts = primaries.length + secondaries.length + sources.length + questions.length + responseCount;
const COMMIT_BATCH_SIZE = 500;
const batches = Math.ceil(totalConcepts / COMMIT_BATCH_SIZE);

const sizeKb = existsSync(outFile) ? Math.round(statSync(outFile).size / 1024) : 0;

console.log(`Wrote ${outFile} (${sizeKb} KB)`);
console.log(`  sheet          Dictionary, ${rows.length - 1} data rows x ${COLUMNS.length} columns`);
console.log(`  concept ids    ${omitCids ? 'OMITTED - import will generate them (exercises backfillConceptIDs)' : 'supplied in the *_CID columns'}`);
console.log('');
console.log('Expected import result');
console.log(`  PRIMARY        ${primaries.length}`);
console.log(`  SECONDARY      ${secondaries.length}`);
console.log(`  SOURCE         ${sources.length}`);
console.log(`  QUESTION       ${questions.length}`);
console.log(`  RESPONSE       ${responseCount}  (shared across questions, so far fewer than response rows)`);
console.log(`  TOTAL FILES    ${totalConcepts}`);
console.log('');
console.log(`  commits        ${batches}  (${COMMIT_BATCH_SIZE} files per batch)`);
console.log(`  content writes ${batches * 3}  (3 per batch: trees, commits, refs)`);
console.log(`  before C0      ${totalConcepts * 2} writes — against a 500/hour secondary limit`);
