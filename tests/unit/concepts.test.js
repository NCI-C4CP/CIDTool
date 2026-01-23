/**
 * Unit Tests for concepts.js
 * 
 * Tests the core concept validation and mapping functions:
 * - validateImportData: Validates import data against existing repository
 * - assignConcepts: Creates concept mappings from spreadsheet data
 */

import { validateImportData } from '../../src/concepts.js';

// ============================================================================
// validateImportData Tests
// ============================================================================

describe('validateImportData', () => {
    
    // Mock existing repository index
    const createMockIndex = (files = {}) => ({
        _files: files
    });
    
    // Helper to create concept objects
    const createConcept = (key, conceptID, objectType = 'PRIMARY', sourceRow = 2) => ({
        key,
        conceptID,
        object_type: objectType,
        _sourceRow: sourceRow
    });

    describe('Duplicate Concept ID Detection', () => {
        
        test('detects duplicate concept ID in existing repository', () => {
            const existingIndex = createMockIndex({
                '123456789.json': { key: 'ExistingKey', object_type: 'PRIMARY' }
            });
            
            const conceptObjects = [
                createConcept('NewKey', 123456789)
            ];
            
            const result = validateImportData(conceptObjects, existingIndex, {});
            
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe('DUPLICATE_CONCEPT_ID');
            expect(result.errors[0].conceptId).toBe('123456789');
        });
        
        test('detects duplicate concept ID within import file', () => {
            const conceptObjects = [
                createConcept('Key1', 111111111, 'PRIMARY', 2),
                createConcept('Key2', 111111111, 'PRIMARY', 3)
            ];
            
            const result = validateImportData(conceptObjects, createMockIndex(), {});
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'DUPLICATE_CONCEPT_ID_IMPORT')).toBe(true);
        });
        
        test('passes when concept IDs are unique', () => {
            const existingIndex = createMockIndex({
                '123456789.json': { key: 'ExistingKey', object_type: 'PRIMARY' }
            });
            
            const conceptObjects = [
                createConcept('NewKey', 987654321)
            ];
            
            const result = validateImportData(conceptObjects, existingIndex, {});
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('Duplicate Key Detection', () => {
        
        test('detects duplicate key in existing repository', () => {
            const existingIndex = createMockIndex({
                '123456789.json': { key: 'Survey', object_type: 'PRIMARY' }
            });
            
            const conceptObjects = [
                createConcept('Survey', 999999999)
            ];
            
            const result = validateImportData(conceptObjects, existingIndex, {});
            
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe('DUPLICATE_KEY');
            expect(result.errors[0].key).toBe('Survey');
            expect(result.errors[0].existingConceptId).toBe('123456789');
        });
        
        test('detects duplicate key case-insensitively', () => {
            const existingIndex = createMockIndex({
                '123456789.json': { key: 'Survey', object_type: 'PRIMARY' }
            });
            
            const conceptObjects = [
                createConcept('SURVEY', 999999999)
            ];
            
            const result = validateImportData(conceptObjects, existingIndex, {});
            
            expect(result.valid).toBe(false);
            expect(result.errors[0].type).toBe('DUPLICATE_KEY');
        });
        
        test('detects duplicate key within import file with different IDs', () => {
            const conceptObjects = [
                createConcept('SameKey', 111111111, 'PRIMARY', 2),
                createConcept('SameKey', 222222222, 'PRIMARY', 3)
            ];
            
            const result = validateImportData(conceptObjects, createMockIndex(), {});
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'DUPLICATE_KEY_IMPORT')).toBe(true);
        });
        
        test('allows same key with same ID within import (duplicate rows)', () => {
            const conceptObjects = [
                createConcept('SameKey', 111111111, 'PRIMARY', 2),
                createConcept('SameKey', 111111111, 'PRIMARY', 3)
            ];
            
            const result = validateImportData(conceptObjects, createMockIndex(), {});
            
            // Should have duplicate concept ID error but NOT duplicate key error
            const duplicateKeyErrors = result.errors.filter(e => e.type === 'DUPLICATE_KEY_IMPORT');
            expect(duplicateKeyErrors).toHaveLength(0);
        });
    });

    describe('Required Fields Validation', () => {
        
        test('detects missing required fields based on config', () => {
            const config = {
                PRIMARY: [
                    { id: 'description', label: 'Description', required: true },
                    { id: 'notes', label: 'Notes', required: false }
                ]
            };
            
            const conceptObjects = [
                createConcept('TestKey', 123456789, 'PRIMARY')
                // Missing 'description' field
            ];
            
            const result = validateImportData(conceptObjects, createMockIndex(), config);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'MISSING_REQUIRED_FIELD')).toBe(true);
            expect(result.errors.find(e => e.type === 'MISSING_REQUIRED_FIELD').field).toBe('Description');
        });
        
        test('skips conceptId and key when checking required fields', () => {
            const config = {
                PRIMARY: [
                    { id: 'conceptId', label: 'Concept ID', required: true },
                    { id: 'key', label: 'Key', required: true }
                ]
            };
            
            const conceptObjects = [
                createConcept('TestKey', 123456789, 'PRIMARY')
            ];
            
            const result = validateImportData(conceptObjects, createMockIndex(), config);
            
            // Should pass because conceptId and key are handled separately
            expect(result.valid).toBe(true);
        });
        
        test('passes when all required fields are present', () => {
            const config = {
                PRIMARY: [
                    { id: 'description', label: 'Description', required: true }
                ]
            };
            
            const conceptObjects = [
                { ...createConcept('TestKey', 123456789, 'PRIMARY'), description: 'Test description' }
            ];
            
            const result = validateImportData(conceptObjects, createMockIndex(), config);
            
            expect(result.valid).toBe(true);
        });
    });

    describe('Error Summary', () => {
        
        test('provides accurate error summary counts', () => {
            const existingIndex = createMockIndex({
                '111111111.json': { key: 'Key1', object_type: 'PRIMARY' },
                '222222222.json': { key: 'Key2', object_type: 'PRIMARY' }
            });
            
            const conceptObjects = [
                createConcept('Key1', 333333333, 'PRIMARY', 2), // Duplicate key
                createConcept('Key2', 444444444, 'PRIMARY', 3), // Duplicate key
                createConcept('NewKey', 111111111, 'PRIMARY', 4) // Duplicate ID
            ];
            
            const result = validateImportData(conceptObjects, existingIndex, {});
            
            expect(result.summary.total).toBe(3);
            expect(result.summary.duplicateKeys).toBe(2);
            expect(result.summary.duplicateIds).toBe(1);
        });
        
        test('uses _sourceRow for row numbers in errors', () => {
            const existingIndex = createMockIndex({
                '123456789.json': { key: 'ExistingKey', object_type: 'PRIMARY' }
            });
            
            const conceptObjects = [
                createConcept('ExistingKey', 999999999, 'PRIMARY', 15) // Source row 15
            ];
            
            const result = validateImportData(conceptObjects, existingIndex, {});
            
            expect(result.errors[0].row).toBe(15);
        });
    });

    describe('Edge Cases', () => {
        
        test('handles empty concept objects array', () => {
            const result = validateImportData([], createMockIndex(), {});
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.summary.total).toBe(0);
        });
        
        test('handles empty existing index', () => {
            const conceptObjects = [
                createConcept('NewKey', 123456789)
            ];
            
            const result = validateImportData(conceptObjects, {}, {});
            
            expect(result.valid).toBe(true);
        });
        
        test('handles null/undefined existing index', () => {
            const conceptObjects = [
                createConcept('NewKey', 123456789)
            ];
            
            const result = validateImportData(conceptObjects, null, {});
            
            expect(result.valid).toBe(true);
        });
        
        test('handles concept IDs as numbers and strings', () => {
            const existingIndex = createMockIndex({
                '123456789.json': { key: 'ExistingKey', object_type: 'PRIMARY' }
            });
            
            // Concept ID as number should still match string filename
            const conceptObjects = [
                createConcept('NewKey', 123456789) // Number, but filename is string
            ];
            
            const result = validateImportData(conceptObjects, existingIndex, {});
            
            expect(result.valid).toBe(false);
            expect(result.errors[0].type).toBe('DUPLICATE_CONCEPT_ID');
        });
    });
});
