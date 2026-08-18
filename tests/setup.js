/**
 * Jest Setup File
 * Runs before each test file to set up the testing environment
 */

import { jest } from '@jest/globals';
import v8 from 'node:v8';

// Mock browser APIs that aren't available in jsdom
global.alert = jest.fn();

// jsdom omits structuredClone, which IndexedDB relies on to store records
if (typeof global.structuredClone !== 'function') {
    global.structuredClone = (value) => v8.deserialize(v8.serialize(value));
}

// Mock btoa and atob for base64 encoding/decoding
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
// Silence console.error during tests (errors are still thrown, just not logged)
global.console.error = jest.fn();