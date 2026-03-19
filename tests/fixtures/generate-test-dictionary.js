#!/usr/bin/env node

/**
 * Generates a test dictionary .xlsx file from the test fixture JSON.
 * 
 * Usage:
 *   npm install xlsx          (one-time, if not already installed)
 *   node tests/fixtures/generate-test-dictionary.js
 * 
 * Output:
 *   tests/fixtures/test-dictionary.xlsx
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixture = JSON.parse(readFileSync(join(__dirname, 'test-dictionary.json'), 'utf-8'));

// Build the 2D array: headers + fullData rows
const sheetData = [fixture.headers, ...fixture.fullData];

// Create workbook with a "Dictionary" sheet (the name CIDTool looks for)
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

// Set reasonable column widths
worksheet['!cols'] = fixture.headers.map(h => ({ width: Math.max(String(h).length + 4, 18) }));

XLSX.utils.book_append_sheet(workbook, worksheet, 'Dictionary');

const outputPath = join(__dirname, 'test-dictionary.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`Generated test dictionary: ${outputPath}`);
console.log(`  Headers: ${fixture.headers.length} columns`);
console.log(`  Data rows: ${fixture.fullData.length}`);
console.log(`  Expected concepts: ${fixture.expectedCounts.total}`);
