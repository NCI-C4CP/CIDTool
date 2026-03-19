/**
 * Integration Tests for Dictionary Import Pipeline
 * 
 * Tests the full import flow using a realistic test dictionary fixture:
 * parseColumns → assignConcepts → structureDictionary → validateImportData
 * 
 * Covers:
 * - Column parsing from fixture headers
 * - Concept ID assignment and mapping
 * - Hierarchical reference resolution (PRIMARY → SECONDARY → QUESTION → RESPONSE)
 * - allowMultiple references (Question shared across multiple Secondaries)
 * - Full validation pass on clean data
 * - Concept count expectations
 */

import { parseColumns, structureDictionary } from '../../src/dictionary.js';
import { assignConcepts, validateImportData } from '../../src/concepts.js';
import { appState } from '../../src/common.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load the test fixture
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixture = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'test-dictionary.json'), 'utf-8'));

// ============================================================================
// Setup: configure appState with fixture config before each test
// ============================================================================

beforeEach(() => {
    appState.setState({ config: fixture.config, index: { _files: {} } });
});

// ============================================================================
// Column Parsing Tests (using fixture headers)
// ============================================================================

describe('Fixture Dictionary - parseColumns', () => {
    
    test('parses all concept type columns from fixture headers', () => {
        const columns = parseColumns(fixture.headers);
        
        const primary = columns.find(c => c.object_type === 'PRIMARY');
        expect(primary.KEY).toBe(0);
        expect(primary.CID).toBe(1);
        expect(primary.DESCRIPTION).toBe(2);
        
        const secondary = columns.find(c => c.object_type === 'SECONDARY');
        expect(secondary.KEY).toBe(3);
        expect(secondary.CID).toBe(4);
        expect(secondary.DESCRIPTION).toBe(5);
        
        const source = columns.find(c => c.object_type === 'SOURCE');
        expect(source.KEY).toBe(6);
        expect(source.CID).toBe(7);
        
        const question = columns.find(c => c.object_type === 'QUESTION');
        expect(question.KEY).toBe(8);
        expect(question.CID).toBe(9);
        expect(question.TEXT).toBe(10);
        
        const response = columns.find(c => c.object_type === 'RESPONSE');
        expect(response.KEY).toBe(11);
        expect(response.CID).toBe(12);
        expect(response.VALUE).toBe(13);
    });
});

// ============================================================================
// Concept Assignment Tests
// ============================================================================

describe('Fixture Dictionary - assignConcepts', () => {
    
    let columns;
    
    beforeEach(() => {
        columns = parseColumns(fixture.headers);
    });
    
    test('assigns all expected concept mappings', () => {
        const mapping = assignConcepts(columns, fixture.fullData);
        
        expect(mapping).not.toBe(false);
        
        // Check total unique concepts
        const expectedKeys = Object.keys(fixture.expectedMappings);
        expect(mapping.length).toBe(expectedKeys.length);
    });
    
    test('preserves provided concept IDs', () => {
        const mapping = assignConcepts(columns, fixture.fullData);
        
        // Spot-check key concepts have their provided IDs
        const study = mapping.find(m => m.concept === 'Study');
        expect(study.id).toBe(100000001);
        
        const baseline = mapping.find(m => m.concept === 'Baseline Survey');
        expect(baseline.id).toBe(200000001);
        
        const age = mapping.find(m => m.concept === 'Age');
        expect(age.id).toBe(400000001);
        
        const version = mapping.find(m => m.concept === 'Version');
        expect(version.id).toBe(400000008);
    });
    
    test('assigns correct concept types', () => {
        const mapping = assignConcepts(columns, fixture.fullData);
        
        const study = mapping.find(m => m.concept === 'Study');
        expect(study.type).toBe('PRIMARY');
        
        const baseline = mapping.find(m => m.concept === 'Baseline Survey');
        expect(baseline.type).toBe('SECONDARY');
        
        const paperForm = mapping.find(m => m.concept === 'Paper Form');
        expect(paperForm.type).toBe('SOURCE');
        
        const age = mapping.find(m => m.concept === 'Age');
        expect(age.type).toBe('QUESTION');
        
        const under40 = mapping.find(m => m.concept === 'Under 40');
        expect(under40.type).toBe('RESPONSE');
    });
    
    test('deduplicates Version question appearing on multiple rows', () => {
        const mapping = assignConcepts(columns, fixture.fullData);
        
        const versionEntries = mapping.filter(m => m.concept === 'Version');
        expect(versionEntries).toHaveLength(1);
        expect(versionEntries[0].id).toBe(400000008);
    });
});

// ============================================================================
// Full Pipeline: structureDictionary Tests
// ============================================================================

describe('Fixture Dictionary - structureDictionary', () => {
    
    let columns;
    let mapping;
    
    beforeEach(() => {
        columns = parseColumns(fixture.headers);
        mapping = assignConcepts(columns, fixture.fullData);
    });
    
    test('produces the expected number of concept objects', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        
        const byType = {};
        concepts.forEach(c => {
            byType[c.object_type] = (byType[c.object_type] || 0) + 1;
        });
        
        expect(byType['PRIMARY']).toBe(fixture.expectedCounts.PRIMARY);
        expect(byType['SECONDARY']).toBe(fixture.expectedCounts.SECONDARY);
        expect(byType['SOURCE']).toBe(fixture.expectedCounts.SOURCE);
        expect(byType['QUESTION']).toBe(fixture.expectedCounts.QUESTION);
        expect(byType['RESPONSE']).toBe(fixture.expectedCounts.RESPONSE);
        expect(concepts.length).toBe(fixture.expectedCounts.total);
    });
    
    test('PRIMARY concepts have correct keys and IDs', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const primaries = concepts.filter(c => c.object_type === 'PRIMARY');
        
        const study = primaries.find(c => c.key === 'Study');
        expect(study).toBeDefined();
        expect(study.conceptID).toBe(100000001);
        expect(study.description).toBe('Cohort study data');
        
        const bio = primaries.find(c => c.key === 'Biospecimen');
        expect(bio).toBeDefined();
        expect(bio.conceptID).toBe(100000002);
    });
    
    test('SECONDARY concepts reference their parent PRIMARY', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const secondaries = concepts.filter(c => c.object_type === 'SECONDARY');
        
        const baseline = secondaries.find(c => c.key === 'Baseline Survey');
        expect(baseline.parentPrimary).toBe(100000001); // Study
        
        const followUp = secondaries.find(c => c.key === 'Follow-Up Survey');
        expect(followUp.parentPrimary).toBe(100000001); // Study
        
        const blood = secondaries.find(c => c.key === 'Blood');
        expect(blood.parentPrimary).toBe(100000002); // Biospecimen
        
        const saliva = secondaries.find(c => c.key === 'Saliva');
        expect(saliva.parentPrimary).toBe(100000002); // Biospecimen
    });
    
    test('QUESTION concepts reference their parent SECONDARY', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const questions = concepts.filter(c => c.object_type === 'QUESTION');
        
        // Age is under Baseline Survey
        const age = questions.find(c => c.key === 'Age');
        expect(age.parentSecondary).toContain(200000001);
        
        // WeightChange is under Follow-Up Survey
        const weight = questions.find(c => c.key === 'WeightChange');
        expect(weight.parentSecondary).toContain(200000002);
        
        // CollectionDate is under Blood
        const collDate = questions.find(c => c.key === 'CollectionDate');
        expect(collDate.parentSecondary).toContain(200000003);
    });
    
    test('QUESTION with allowMultiple references multiple SECONDARYs', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const questions = concepts.filter(c => c.object_type === 'QUESTION');
        
        const version = questions.find(c => c.key === 'Version');
        expect(version).toBeDefined();
        expect(version.conceptID).toBe(400000008);
        
        // Version should reference BOTH Baseline Survey and Follow-Up Survey
        expect(Array.isArray(version.parentSecondary)).toBe(true);
        expect(version.parentSecondary).toHaveLength(2);
        expect(version.parentSecondary).toContain(200000001); // Baseline Survey
        expect(version.parentSecondary).toContain(200000002); // Follow-Up Survey
    });
    
    test('QUESTION concepts reference their SOURCE', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const questions = concepts.filter(c => c.object_type === 'QUESTION');
        
        const age = questions.find(c => c.key === 'Age');
        expect(age.parentSource).toBe(300000001); // Paper Form
        
        const weight = questions.find(c => c.key === 'WeightChange');
        expect(weight.parentSource).toBe(300000002); // Online Form
    });
    
    test('QUESTION concepts collect their RESPONSE arrays', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const questions = concepts.filter(c => c.object_type === 'QUESTION');
        
        // Age has 3 responses
        const age = questions.find(c => c.key === 'Age');
        expect(age.responses).toHaveLength(3);
        expect(age.responses).toContain(500000001); // Under 40
        expect(age.responses).toContain(500000002); // 40 to 59
        expect(age.responses).toContain(500000003); // 60 or older
        
        // Sex has 2 responses
        const sex = questions.find(c => c.key === 'Sex');
        expect(sex.responses).toHaveLength(2);
        
        // SmokingStatus has 3 responses
        const smoking = questions.find(c => c.key === 'SmokingStatus');
        expect(smoking.responses).toHaveLength(3);
        
        // PhysicalActivity has no responses (free text)
        const activity = questions.find(c => c.key === 'PhysicalActivity');
        expect(activity.responses).toBeUndefined();
    });
    
    test('Questions without a source do not have parentSource', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const questions = concepts.filter(c => c.object_type === 'QUESTION');
        
        const collDate = questions.find(c => c.key === 'CollectionDate');
        expect(collDate.parentSource).toBeUndefined();
    });
    
    test('RESPONSE concepts have correct keys', () => {
        const concepts = structureDictionary(mapping, columns, fixture.fullData);
        const responses = concepts.filter(c => c.object_type === 'RESPONSE');
        
        const keys = responses.map(r => r.key);
        expect(keys).toContain('Under 40');
        expect(keys).toContain('Male');
        expect(keys).toContain('Never');
        expect(keys).toContain('Lost weight');
        expect(keys).toContain('v1');
        expect(keys).toContain('v2');
    });
});

// ============================================================================
// Validation Tests (full pipeline output against empty repo)
// ============================================================================

describe('Fixture Dictionary - validateImportData', () => {
    
    let conceptObjects;
    
    beforeEach(() => {
        const columns = parseColumns(fixture.headers);
        const mapping = assignConcepts(columns, fixture.fullData);
        conceptObjects = structureDictionary(mapping, columns, fixture.fullData);
    });
    
    test('passes validation against empty repository', () => {
        const result = validateImportData(conceptObjects, { _files: {} }, fixture.config);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
    
    test('detects conflicts with existing repository data', () => {
        // Simulate Study concept already existing in repo
        const existingIndex = {
            _files: {
                '100000001.json': { key: 'Study', object_type: 'PRIMARY' }
            }
        };
        
        const result = validateImportData(conceptObjects, existingIndex, fixture.config);
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        
        const idError = result.errors.find(e => e.type === 'DUPLICATE_CONCEPT_ID');
        expect(idError).toBeDefined();
    });
});

// ============================================================================
// Data-only import (no Version/shared question rows)
// ============================================================================

describe('Fixture Dictionary - basic data without shared questions', () => {
    
    test('standard data produces single-parent secondary references', () => {
        const columns = parseColumns(fixture.headers);
        const mapping = assignConcepts(columns, fixture.data);
        const concepts = structureDictionary(mapping, columns, fixture.data);
        
        const questions = concepts.filter(c => c.object_type === 'QUESTION');
        
        // Without the Version shared rows, all questions should have single-element arrays
        // (since allowMultiple is enabled, the result is still an array, just with one element)
        const age = questions.find(c => c.key === 'Age');
        expect(Array.isArray(age.parentSecondary)).toBe(true);
        expect(age.parentSecondary).toHaveLength(1);
        expect(age.parentSecondary[0]).toBe(200000001);
    });
});
