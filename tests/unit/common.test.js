/**
 * Unit Tests for common.js
 * 
 * Tests utility functions that don't require DOM or API calls:
 * - extractConcept: Extracts concept ID from display string
 * - objectExists: Finds object in array by key-value
 * - isEmpty: Checks if object has no properties
 * - uniqueKeys: Extracts unique keys from array of objects
 * - toBase64 / fromBase64: Base64 encoding/decoding
 * - debounce: Creates debounced function
 */

import { jest } from '@jest/globals';

// ============================================================================
// Pure Function Tests (no mocking needed)
// ============================================================================

// Import all functions at the top level
const {
    extractConcept,
    objectExists,
    isEmpty,
    uniqueKeys,
    toBase64,
    fromBase64,
    debounce,
    getErrorMessage,
    isTokenError
} = await import('../../src/common.js');

describe('extractConcept', () => {
    
    test('extracts concept ID from "Key - ID" format', () => {
        expect(extractConcept('Survey - 123456789')).toBe('123456789');
    });
    
    test('extracts concept ID from multi-word key', () => {
        expect(extractConcept('Blood Urine Sample - 987654321')).toBe('987654321');
    });
    
    test('handles key with dashes', () => {
        expect(extractConcept('My-Key-Name - 123456789')).toBe('123456789');
    });
    
    test('returns whole string if no dash separator', () => {
        expect(extractConcept('123456789')).toBe('123456789');
    });
    
    test('returns empty string for null/undefined', () => {
        expect(extractConcept(null)).toBe('');
        expect(extractConcept(undefined)).toBe('');
        expect(extractConcept('')).toBe('');
    });
    
    test('trims whitespace from result', () => {
        expect(extractConcept('Key -   123456789  ')).toBe('123456789');
    });
});

describe('objectExists', () => {
    test('finds object by key-value match', () => {
        const objects = [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
            { id: 3, name: 'Charlie' }
        ];
        
        const result = objectExists(objects, 'name', 'Bob');
        
        expect(result).toEqual({ id: 2, name: 'Bob' });
    });
    
    test('returns undefined if no match found', () => {
        const objects = [{ id: 1, name: 'Alice' }];
        
        const result = objectExists(objects, 'name', 'Unknown');
        
        expect(result).toBeUndefined();
    });
    
    test('returns first match if multiple exist', () => {
        const objects = [
            { id: 1, type: 'PRIMARY' },
            { id: 2, type: 'PRIMARY' },
            { id: 3, type: 'SECONDARY' }
        ];
        
        const result = objectExists(objects, 'type', 'PRIMARY');
        
        expect(result.id).toBe(1);
    });
    
    test('handles empty array', () => {
        expect(objectExists([], 'key', 'value')).toBeUndefined();
    });
});

describe('isEmpty', () => {
    test('returns true for empty object', () => {
        expect(isEmpty({})).toBe(true);
    });
    
    test('returns false for object with properties', () => {
        expect(isEmpty({ key: 'value' })).toBe(false);
    });
    
    test('returns true for object with only inherited properties', () => {
        const obj = Object.create({ inherited: 'property' });
        expect(isEmpty(obj)).toBe(true);
    });
    
    test('returns false for object with own properties', () => {
        const obj = Object.create({ inherited: 'property' });
        obj.own = 'property';
        expect(isEmpty(obj)).toBe(false);
    });
});

describe('uniqueKeys', () => {
    test('extracts unique keys from array of objects', () => {
        const objects = [
            { name: 'Alice', age: 30 },
            { name: 'Bob', city: 'NYC' },
            { age: 25, city: 'LA' }
        ];
        
        const result = uniqueKeys(objects);
        
        expect(result).toContain('name');
        expect(result).toContain('age');
        expect(result).toContain('city');
        expect(result).toHaveLength(3);
    });
    
    test('excludes object_type key', () => {
        const objects = [
            { key: 'value', object_type: 'PRIMARY' }
        ];
        
        const result = uniqueKeys(objects);
        
        expect(result).toContain('key');
        expect(result).not.toContain('object_type');
    });
    
    test('handles empty array', () => {
        expect(uniqueKeys([])).toEqual([]);
    });
    
    test('deduplicates keys across objects', () => {
        const objects = [
            { name: 'Alice' },
            { name: 'Bob' },
            { name: 'Charlie' }
        ];
        
        const result = uniqueKeys(objects);
        
        expect(result).toEqual(['name']);
    });
});

describe('toBase64', () => {
    test('encodes string to base64', () => {
        expect(toBase64('Hello World')).toBe('SGVsbG8gV29ybGQ=');
    });
    
    test('encodes empty string', () => {
        expect(toBase64('')).toBe('');
    });
    
    test('encodes JSON string', () => {
        const json = JSON.stringify({ key: 'value' });
        const encoded = toBase64(json);
        
        expect(encoded).toBe('eyJrZXkiOiJ2YWx1ZSJ9');
    });
    
    test('throws error for non-string input', () => {
        expect(() => toBase64(123)).toThrow('Input must be a string');
        expect(() => toBase64(null)).toThrow('Input must be a string');
        expect(() => toBase64({})).toThrow('Input must be a string');
    });
});

describe('fromBase64', () => {
    test('decodes base64 to string', () => {
        expect(fromBase64('SGVsbG8gV29ybGQ=')).toBe('Hello World');
    });
    
    test('handles base64 with whitespace/newlines', () => {
        expect(fromBase64('SGVs\nbG8g\nV29ybGQ=')).toBe('Hello World');
    });
    
    test('throws error for null/undefined input', () => {
        expect(() => fromBase64(null)).toThrow();
        expect(() => fromBase64(undefined)).toThrow();
    });
    
    test('throws error for invalid base64', () => {
        expect(() => fromBase64('not-valid-base64!!!')).toThrow();
    });
});

describe('debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        jest.useRealTimers();
    });
    
    test('delays function execution', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);
        
        debouncedFn();
        
        expect(mockFn).not.toHaveBeenCalled();
        
        jest.advanceTimersByTime(100);
        
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
    
    test('resets delay on subsequent calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);
        
        debouncedFn();
        jest.advanceTimersByTime(50);
        
        debouncedFn(); // Reset the timer
        jest.advanceTimersByTime(50);
        
        expect(mockFn).not.toHaveBeenCalled();
        
        jest.advanceTimersByTime(50);
        
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
    
    test('passes arguments to debounced function', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);
        
        debouncedFn('arg1', 'arg2');
        jest.advanceTimersByTime(100);
        
        expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
    
    test('uses last arguments when called multiple times', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);
        
        debouncedFn('first');
        debouncedFn('second');
        debouncedFn('third');
        
        jest.advanceTimersByTime(100);
        
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('third');
    });
});

describe('getErrorMessage', () => {
    test('returns user-friendly message for 404', () => {
        expect(getErrorMessage({ status: 404 })).toBe('Repository not found or access denied');
    });
    
    test('returns user-friendly message for 403', () => {
        expect(getErrorMessage({ status: 403 })).toBe('Insufficient permissions to access repository');
    });
    
    test('returns user-friendly message for 401', () => {
        expect(getErrorMessage({ status: 401 })).toBe('Authentication required. Please log in again.');
    });
    
    test('returns user-friendly message for 500', () => {
        expect(getErrorMessage({ status: 500 })).toBe('GitHub service temporarily unavailable');
    });
    
    test('returns user-friendly message for 422', () => {
        expect(getErrorMessage({ status: 422 })).toBe('Invalid repository or file format');
    });
    
    test('returns network error message', () => {
        expect(getErrorMessage({ name: 'NetworkError' })).toBe('Network connection error. Please check your internet connection.');
    });
    
    test('returns generic message for unknown errors', () => {
        expect(getErrorMessage({})).toBe('Unable to load repository contents. Please try again.');
    });
});

describe('isTokenError', () => {
    test('returns true for 401 error message', () => {
        expect(isTokenError({ message: 'Error 401: Unauthorized' })).toBe(true);
    });
    
    test('returns true for Unauthorized message', () => {
        expect(isTokenError({ message: 'Unauthorized access' })).toBe(true);
    });
    
    test('returns true for token-related message', () => {
        expect(isTokenError({ message: 'Invalid token' })).toBe(true);
    });
    
    test('returns false for other errors', () => {
        expect(isTokenError({ message: 'Network error' })).toBe(false);
        expect(isTokenError({ message: undefined })).toBeFalsy();
        expect(isTokenError({})).toBeFalsy();
    });
});
