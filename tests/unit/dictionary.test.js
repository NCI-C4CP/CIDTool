/**
 * Unit Tests for dictionary.js
 * 
 * Tests the dictionary parsing and structuring functions:
 * - parseColumns: Parses spreadsheet headers to identify column indices
 */

// Import parseColumns directly - it only uses MODAL_CONFIG.CONCEPT_TYPES internally
import { parseColumns } from '../../src/dictionary.js';

// ============================================================================
// parseColumns Tests
// ============================================================================

describe('parseColumns', () => {
    
    describe('Basic Column Parsing', () => {
        
        test('parses PRIMARY columns correctly', () => {
            const headers = ['PRIMARY_KEY', 'PRIMARY_CID', 'PRIMARY_DESCRIPTION'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            expect(primaryMapping.KEY).toBe(0);
            expect(primaryMapping.CID).toBe(1);
            expect(primaryMapping.DESCRIPTION).toBe(2);
        });
        
        test('parses multiple concept types', () => {
            const headers = ['PRIMARY_KEY', 'PRIMARY_CID', 'SECONDARY_KEY', 'SECONDARY_CID'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            const secondaryMapping = result.find(r => r.object_type === 'SECONDARY');
            
            expect(primaryMapping.KEY).toBe(0);
            expect(primaryMapping.CID).toBe(1);
            expect(secondaryMapping.KEY).toBe(2);
            expect(secondaryMapping.CID).toBe(3);
        });
        
        test('returns all concept types even if not present in headers', () => {
            const headers = ['PRIMARY_KEY'];
            
            const result = parseColumns(headers);
            
            expect(result).toHaveLength(5); // All 5 concept types
            expect(result.map(r => r.object_type)).toEqual([
                'PRIMARY', 'SECONDARY', 'SOURCE', 'QUESTION', 'RESPONSE'
            ]);
        });
    });

    describe('Case Handling', () => {
        
        test('handles lowercase headers', () => {
            const headers = ['primary_key', 'primary_cid'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            expect(primaryMapping.KEY).toBe(0);
            expect(primaryMapping.CID).toBe(1);
        });
        
        test('handles mixed case headers', () => {
            const headers = ['Primary_Key', 'PRIMARY_cid'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            expect(primaryMapping.KEY).toBe(0);
            expect(primaryMapping.CID).toBe(1);
        });
        
        test('stores field names as uppercase', () => {
            const headers = ['primary_description'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            expect(primaryMapping.DESCRIPTION).toBe(0);
            expect(primaryMapping.description).toBeUndefined();
        });
    });

    describe('Edge Cases', () => {
        
        test('handles empty headers array', () => {
            const result = parseColumns([]);
            
            expect(result).toHaveLength(5);
            // Each mapping should only have object_type
            result.forEach(mapping => {
                expect(Object.keys(mapping)).toEqual(['object_type']);
            });
        });
        
        test('ignores non-matching headers', () => {
            const headers = ['RANDOM_COLUMN', 'OTHER_DATA', 'PRIMARY_KEY'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            expect(primaryMapping.KEY).toBe(2);
            expect(primaryMapping.RANDOM).toBeUndefined();
        });
        
        test('handles null/undefined values in headers', () => {
            const headers = [null, 'PRIMARY_KEY', undefined, 'PRIMARY_CID'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            expect(primaryMapping.KEY).toBe(1);
            expect(primaryMapping.CID).toBe(3);
        });
        
        test('handles headers with extra underscores', () => {
            // Headers like "PRIMARY_SOME_FIELD" should NOT match because 
            // the regex expects TYPE_FIELD pattern (single underscore)
            const headers = ['PRIMARY_SOME_FIELD', 'PRIMARY_KEY'];
            
            const result = parseColumns(headers);
            
            const primaryMapping = result.find(r => r.object_type === 'PRIMARY');
            expect(primaryMapping.KEY).toBe(1);
            expect(primaryMapping.SOME_FIELD).toBeUndefined();
        });
    });

    describe('All Concept Types', () => {
        
        test('parses all five concept types', () => {
            const headers = [
                'PRIMARY_KEY', 
                'SECONDARY_KEY', 
                'SOURCE_KEY', 
                'QUESTION_KEY', 
                'RESPONSE_KEY'
            ];
            
            const result = parseColumns(headers);
            
            expect(result.find(r => r.object_type === 'PRIMARY').KEY).toBe(0);
            expect(result.find(r => r.object_type === 'SECONDARY').KEY).toBe(1);
            expect(result.find(r => r.object_type === 'SOURCE').KEY).toBe(2);
            expect(result.find(r => r.object_type === 'QUESTION').KEY).toBe(3);
            expect(result.find(r => r.object_type === 'RESPONSE').KEY).toBe(4);
        });
        
        test('parses RESPONSE with VALUE column', () => {
            const headers = ['RESPONSE_KEY', 'RESPONSE_CID', 'RESPONSE_VALUE'];
            
            const result = parseColumns(headers);
            
            const responseMapping = result.find(r => r.object_type === 'RESPONSE');
            expect(responseMapping.KEY).toBe(0);
            expect(responseMapping.CID).toBe(1);
            expect(responseMapping.VALUE).toBe(2);
        });
    });
});
