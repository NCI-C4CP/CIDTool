#!/usr/bin/env node

/**
 * Generates a CID dictionary repository on disk for scale testing.
 *
 * Produces ~8,000 concept files wired into a real
 * PRIMARY -> SECONDARY -> QUESTION -> RESPONSE graph (plus SOURCE), a v2.0 index.json,
 * and a config.json. RESPONSE concepts are shared across questions, matching the import
 * path's dedupe-by-key behaviour, so the graph is a DAG rather than a tree.
 * The index deliberately exceeds the 1MB Contents API ceiling —
 * that is the condition Step 1's raw-media-type read exists to handle.
 *
 * Concept files use the `conceptID` / `object_type` shape written by the bulk import
 * path (src/dictionary.js buildConceptObject + src/files.js), because that is how a
 * real dictionary of this size is created.
 *
 * Output is pushed with git, not the API: 8,000 files via the Contents API would be
 * 16,000 writes against a 500/hour secondary rate limit.
 *
 * Usage:
 *   node tests/fixtures/generate-scale-repo.js [outDir] [--total=8000] [--seed=42] [--force]
 *
 *   cd <outDir> && git init && git add -A && git commit -m "Scale fixture" \
 *     && git branch -M main && git remote add origin <url> && git push -u origin main
 */

import { mkdirSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const match = args.find(a => a.startsWith(`--${name}=`));
    return match ? match.split('=')[1] : fallback;
};

const positional = args.filter(a => !a.startsWith('--'));
const outDir = resolve(positional[0] || join(__dirname, 'scale-repo'));
const targetTotal = Number(flag('total', 8000));
const seed = Number(flag('seed', 42));
const force = args.includes('--force');

if (!Number.isInteger(targetTotal) || targetTotal < 100) {
    console.error('--total must be an integer >= 100');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Deterministic RNG so re-runs produce an identical repo
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

// Matches ghauth/domain/conceptId.js: a 9-digit integer.
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
// Vocabulary
// ---------------------------------------------------------------------------

const PRIMARY_KEYS = ['demographics', 'health_history', 'lifestyle', 'biospecimen', 'follow_up'];

const SECONDARY_TOPICS = [
    'baseline', 'household', 'education', 'employment', 'income', 'insurance',
    'cancer_screening', 'family_history', 'medications', 'comorbidities',
    'tobacco', 'alcohol', 'diet', 'physical_activity', 'sleep', 'stress',
    'blood_draw', 'urine', 'saliva', 'consent'
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

// Third axis: 15 x 30 x 20 = 9,000 distinct question names, more than the ~7,700
// needed once responses are shared, so no key requires a numeric disambiguator.
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
// Build the concept graph
// ---------------------------------------------------------------------------

const concepts = [];

const addConcept = (objectType, key, extra = {}) => {
    const concept = {
        key: nextKey(key),
        conceptID: nextConceptId(),
        object_type: objectType,
        ...extra
    };
    concepts.push(concept);
    return concept;
};

const primaries = PRIMARY_KEYS.map(key => addConcept('PRIMARY', key));

const secondaries = [];
for (const primary of primaries) {
    for (const topic of SECONDARY_TOPICS.slice(0, 8)) {
        secondaries.push(addConcept('SECONDARY', `${primary.key}_${topic}`, {
            primaryConceptId: primary.conceptID
        }));
    }
}

const sources = SOURCE_KEYS.map(key => addConcept('SOURCE', key));

// Drawn without replacement so question names are genuinely distinct, not padded.
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

// Responses are a shared pool, not per-question: the import dedupes concepts by key
// (src/dictionary.js processedKeys), so a repeated label resolves to one concept that
// many questions reference.
const responseSets = [
    ...GENERIC_RESPONSE_SETS,
    ...MEASURES.map(measure => RANGE_BUCKETS.map(bucket => `${measure}_${bucket}`))
];

const responsesByLabel = new Map();
const responseIdsBySet = responseSets.map(labels => labels.map(label => {
    if (!responsesByLabel.has(label)) {
        responsesByLabel.set(label, addConcept('RESPONSE', label));
    }
    return responsesByLabel.get(label).conceptID;
}));

let questionCount = 0;
while (concepts.length < targetTotal) {
    if (questionCount >= questionNames.length) {
        throw new Error(`Vocabulary exhausted at ${questionCount} questions; add more stems, subjects or qualifiers`);
    }

    const question = {
        key: nextKey(questionNames[questionCount]),
        conceptID: nextConceptId(),
        object_type: 'QUESTION',
        secondaryConceptId: pick(secondaries).conceptID
    };
    questionCount++;

    // sourceConceptId is optional in the config; leaving some blank is realistic.
    if (random() < 0.6) {
        question.sourceConceptId = pick(sources).conceptID;
    }

    question.responses = pick(responseIdsBySet);

    concepts.push(question);
}

// ---------------------------------------------------------------------------
// Referential integrity self-check
// ---------------------------------------------------------------------------

const idsByType = new Map();
for (const concept of concepts) {
    if (!idsByType.has(concept.object_type)) idsByType.set(concept.object_type, new Set());
    idsByType.get(concept.object_type).add(concept.conceptID);
}

const expectReference = (id, expectedType, context) => {
    if (!idsByType.get(expectedType)?.has(id)) {
        throw new Error(`${context}: ${id} is not an existing ${expectedType}`);
    }
};

for (const concept of concepts) {
    if (concept.primaryConceptId !== undefined) {
        expectReference(concept.primaryConceptId, 'PRIMARY', `${concept.key}.primaryConceptId`);
    }
    if (concept.secondaryConceptId !== undefined) {
        expectReference(concept.secondaryConceptId, 'SECONDARY', `${concept.key}.secondaryConceptId`);
    }
    if (concept.sourceConceptId !== undefined) {
        expectReference(concept.sourceConceptId, 'SOURCE', `${concept.key}.sourceConceptId`);
    }
    for (const responseId of concept.responses || []) {
        expectReference(responseId, 'RESPONSE', `${concept.key}.responses`);
    }
}

if (usedKeys.size !== concepts.length) {
    throw new Error(`Key collision: ${concepts.length} concepts but ${usedKeys.size} unique keys`);
}

// ---------------------------------------------------------------------------
// index.json — v2.0, mirroring ghauth/domain/indexFile.js
// ---------------------------------------------------------------------------

const index = {
    _metadata: {
        last_updated: new Date().toISOString(),
        total_files: concepts.length,
        version: '2.0'
    },
    _files: {},
    _search: {
        by_key: {},
        by_type: {}
    }
};

for (const concept of concepts) {
    const fileName = `${concept.conceptID}.json`;
    index._files[fileName] = { key: concept.key, object_type: concept.object_type };

    (index._search.by_key[concept.key] ??= []).push(fileName);
    (index._search.by_type[concept.object_type] ??= []).push(fileName);
}

// ---------------------------------------------------------------------------
// config.json — mirrors ghauth/domain/config.js getBaseConfig()
// ---------------------------------------------------------------------------

const conceptIdField = { id: 'conceptId', label: 'Concept ID', required: true, type: 'concept' };
const keyField = { id: 'key', label: 'Key', required: true, type: 'text' };

const config = {
    PRIMARY: [conceptIdField, keyField],
    SECONDARY: [
        conceptIdField,
        keyField,
        { id: 'primaryConceptId', label: 'Primary Concept ID', required: true, type: 'reference', referencesType: 'PRIMARY' }
    ],
    SOURCE: [conceptIdField, keyField],
    QUESTION: [
        conceptIdField,
        keyField,
        { id: 'secondaryConceptId', label: 'Secondary Concept ID', required: true, type: 'reference', referencesType: 'SECONDARY' },
        { id: 'sourceConceptId', label: 'Source Concept ID', required: false, type: 'reference', referencesType: 'SOURCE' },
        { id: 'responses', label: 'Responses', required: false, type: 'reference', referencesType: 'RESPONSE' }
    ],
    RESPONSE: [conceptIdField, keyField]
};

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

if (existsSync(outDir) && readdirSync(outDir).length > 0 && !force) {
    console.error(`Refusing to write into non-empty directory: ${outDir}`);
    console.error('Pass --force to overwrite.');
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const concept of concepts) {
    writeFileSync(join(outDir, `${concept.conceptID}.json`), JSON.stringify(concept, null, 2));
}

writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 2));
writeFileSync(join(outDir, 'config.json'), JSON.stringify(config, null, 2));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const indexBytes = statSync(join(outDir, 'index.json')).size;
const counts = [...idsByType.entries()].map(([type, ids]) => `${type}=${ids.size}`).join(' ');

console.log(`Wrote ${concepts.length} concept files to ${outDir}`);
console.log(`  ${counts} (${responseSets.length} shared response sets)`);
console.log(`  index.json: ${(indexBytes / 1024 / 1024).toFixed(2)} MB`);

if (indexBytes <= 1024 * 1024) {
    console.warn('  WARNING: index.json is under 1MB, so the >1MB Contents API path will NOT be exercised.');
}
