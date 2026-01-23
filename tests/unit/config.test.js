/**
 * Unit Tests for config.js
 * 
 * Tests configuration constants and their structure:
 * - CONFIG: Application configuration
 * - MODAL_CONFIG: Modal settings and concept types
 * - CONCEPT_TYPE_COLORS: Color scheme for concept types
 */

import { 
    CONFIG, 
    MODAL_CONFIG, 
    CONCEPT_TYPE_COLORS,
    PAGINATION_CONFIG,
    FILE_FILTERS,
    API_CONFIG
} from '../../src/config.js';

// ============================================================================
// CONFIG Tests
// ============================================================================

describe('CONFIG', () => {
    
    test('has valid CONCEPT_FORMAT regex', () => {
        const regex = new RegExp(CONFIG.CONCEPT_FORMAT);
        
        // Valid 9-digit concept IDs
        expect(regex.test('123456789')).toBe(true);
        expect(regex.test('000000000')).toBe(true);
        expect(regex.test('999999999')).toBe(true);
        
        // Invalid concept IDs
        expect(regex.test('12345678')).toBe(false);   // 8 digits
        expect(regex.test('1234567890')).toBe(false); // 10 digits
        expect(regex.test('12345678a')).toBe(false);  // Contains letter
        expect(regex.test('')).toBe(false);           // Empty
    });
    
    test('has ITEMS_PER_PAGE set', () => {
        expect(CONFIG.ITEMS_PER_PAGE).toBeDefined();
        expect(typeof CONFIG.ITEMS_PER_PAGE).toBe('number');
        expect(CONFIG.ITEMS_PER_PAGE).toBeGreaterThan(0);
    });
    
    test('has SESSION_TOKEN_KEY set', () => {
        expect(CONFIG.SESSION_TOKEN_KEY).toBeDefined();
        expect(typeof CONFIG.SESSION_TOKEN_KEY).toBe('string');
    });
});

// ============================================================================
// MODAL_CONFIG Tests
// ============================================================================

describe('MODAL_CONFIG', () => {
    
    test('has all five concept types', () => {
        expect(MODAL_CONFIG.CONCEPT_TYPES).toEqual([
            'PRIMARY', 'SECONDARY', 'SOURCE', 'QUESTION', 'RESPONSE'
        ]);
    });
    
    test('concept types are in hierarchical order', () => {
        // Order matters for reference resolution during import
        const types = MODAL_CONFIG.CONCEPT_TYPES;
        
        expect(types.indexOf('PRIMARY')).toBeLessThan(types.indexOf('SECONDARY'));
        expect(types.indexOf('SECONDARY')).toBeLessThan(types.indexOf('SOURCE'));
        expect(types.indexOf('SOURCE')).toBeLessThan(types.indexOf('QUESTION'));
        expect(types.indexOf('QUESTION')).toBeLessThan(types.indexOf('RESPONSE'));
    });
    
    test('has validation messages', () => {
        expect(MODAL_CONFIG.VALIDATION_MESSAGES).toBeDefined();
        expect(MODAL_CONFIG.VALIDATION_MESSAGES.REQUIRED_FIELD).toBeDefined();
        expect(MODAL_CONFIG.VALIDATION_MESSAGES.KEY_EXISTS).toBeDefined();
    });
    
    test('has field types', () => {
        expect(MODAL_CONFIG.FIELD_TYPES).toContainEqual({ value: 'text', label: 'Text' });
        expect(MODAL_CONFIG.FIELD_TYPES).toContainEqual({ value: 'reference', label: 'Reference' });
    });
    
    test('ILLEGAL_CHARS_REGEX rejects invalid characters', () => {
        const regex = MODAL_CONFIG.ILLEGAL_CHARS_REGEX;
        
        expect(regex.test('valid-name')).toBe(false);
        expect(regex.test('valid_name')).toBe(false);
        expect(regex.test('name\\with\\backslash')).toBe(true);
        expect(regex.test('name:with:colon')).toBe(true);
        expect(regex.test('name*with*star')).toBe(true);
        expect(regex.test('name?with?question')).toBe(true);
        expect(regex.test('name"with"quote')).toBe(true);
        expect(regex.test('name<with>brackets')).toBe(true);
        expect(regex.test('name|with|pipe')).toBe(true);
    });
});

// ============================================================================
// CONCEPT_TYPE_COLORS Tests
// ============================================================================

describe('CONCEPT_TYPE_COLORS', () => {
    
    test('has colors for all concept types', () => {
        MODAL_CONFIG.CONCEPT_TYPES.forEach(type => {
            expect(CONCEPT_TYPE_COLORS[type]).toBeDefined();
        });
    });
    
    test('each color has required properties', () => {
        Object.values(CONCEPT_TYPE_COLORS).forEach(color => {
            expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
            expect(color.rgb).toHaveProperty('r');
            expect(color.rgb).toHaveProperty('g');
            expect(color.rgb).toHaveProperty('b');
            expect(color.light).toMatch(/^#[0-9A-Fa-f]{6}$/);
            expect(color.name).toBeDefined();
        });
    });
    
    test('RGB values are valid (0-255)', () => {
        Object.values(CONCEPT_TYPE_COLORS).forEach(color => {
            expect(color.rgb.r).toBeGreaterThanOrEqual(0);
            expect(color.rgb.r).toBeLessThanOrEqual(255);
            expect(color.rgb.g).toBeGreaterThanOrEqual(0);
            expect(color.rgb.g).toBeLessThanOrEqual(255);
            expect(color.rgb.b).toBeGreaterThanOrEqual(0);
            expect(color.rgb.b).toBeLessThanOrEqual(255);
        });
    });
    
    test('colors are distinct for each type', () => {
        const hexColors = Object.values(CONCEPT_TYPE_COLORS).map(c => c.hex);
        const uniqueHexColors = [...new Set(hexColors)];
        
        expect(uniqueHexColors.length).toBe(hexColors.length);
    });
});

// ============================================================================
// PAGINATION_CONFIG Tests
// ============================================================================

describe('PAGINATION_CONFIG', () => {
    
    test('has default items per page', () => {
        expect(PAGINATION_CONFIG.DEFAULT_ITEMS_PER_PAGE).toBeDefined();
        expect(PAGINATION_CONFIG.DEFAULT_ITEMS_PER_PAGE).toBeGreaterThan(0);
    });
    
    test('has default current page', () => {
        expect(PAGINATION_CONFIG.DEFAULT_CURRENT_PAGE).toBe(1);
    });
});

// ============================================================================
// FILE_FILTERS Tests
// ============================================================================

describe('FILE_FILTERS', () => {
    
    test('excludes system files', () => {
        expect(FILE_FILTERS.EXCLUDED_FILES).toContain('index.json');
        expect(FILE_FILTERS.EXCLUDED_FILES).toContain('.gitkeep');
        expect(FILE_FILTERS.EXCLUDED_FILES).toContain('config.json');
    });
});

// ============================================================================
// API_CONFIG Tests
// ============================================================================

describe('API_CONFIG', () => {
    
    test('has base URLs defined', () => {
        expect(API_CONFIG.BASE_URL).toBeDefined();
        expect(API_CONFIG.BASE_URL_LOCAL).toBeDefined();
    });
    
    test('has commit messages for all operations', () => {
        expect(API_CONFIG.COMMIT_MESSAGES.ADD_FILE).toBeDefined();
        expect(API_CONFIG.COMMIT_MESSAGES.UPDATE_FILE).toBeDefined();
        expect(API_CONFIG.COMMIT_MESSAGES.DELETE_FILE).toBeDefined();
        expect(API_CONFIG.COMMIT_MESSAGES.ADD_FOLDER).toBeDefined();
    });
    
    test('has standard HTTP status codes', () => {
        expect(API_CONFIG.STATUS_CODES.OK).toBe(200);
        expect(API_CONFIG.STATUS_CODES.CREATED).toBe(201);
        expect(API_CONFIG.STATUS_CODES.UNAUTHORIZED).toBe(401);
        expect(API_CONFIG.STATUS_CODES.FORBIDDEN).toBe(403);
        expect(API_CONFIG.STATUS_CODES.NOT_FOUND).toBe(404);
    });
    
    test('has reasonable timeout', () => {
        expect(API_CONFIG.TIMEOUT).toBeGreaterThanOrEqual(5000);
        expect(API_CONFIG.TIMEOUT).toBeLessThanOrEqual(60000);
    });
});
