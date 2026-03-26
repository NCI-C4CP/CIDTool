/**
 * Dictionary Processing Module
 * Handles parsing and structuring spreadsheet data into concept objects
 * 
 * @module dictionary
 * @description Processes imported dictionary spreadsheets and converts them into
 * structured concept objects that can be saved to the repository. Uses config-driven
 * field definitions for flexibility.
 */

import { displayError, appState } from "./common.js";
import { MODAL_CONFIG } from "./config.js";

// ============================================================================
// COLUMN PARSING
// ============================================================================

/**
 * Parses spreadsheet headers to identify column indices for each concept type
 * Headers follow the pattern: TYPE_FIELD (e.g., PRIMARY_KEY, SECONDARY_CID)
 * 
 * @param {Array<string>} headers - Array of column header strings
 * @returns {Array<Object>} Array of column mapping objects for each concept type
 * 
 * @example
 * parseColumns(['PRIMARY_KEY', 'PRIMARY_CID', 'SECONDARY_KEY'])
 * // Returns: [
 * //   { KEY: 0, CID: 1, object_type: 'PRIMARY' },
 * //   { KEY: 2, object_type: 'SECONDARY' },
 * //   ...
 * // ]
 */
export const parseColumns = (headers) => {
    const results = [];

    MODAL_CONFIG.CONCEPT_TYPES.forEach(type => {
        const columnMap = { object_type: type };

        headers.forEach((header, index) => {
            if (!header || typeof header !== 'string') return;
            
            // Match headers like PRIMARY_KEY, SECONDARY_CID, QUESTION_DESCRIPTION
            const regex = new RegExp(`^${type}_([a-zA-Z]+)$`, 'i');
            const match = header.match(regex);
            
            if (match) {
                // Store field name (uppercase) -> column index
                columnMap[match[1].toUpperCase()] = index;
            }
        });

        results.push(columnMap);
    });

    return results;
};

// ============================================================================
// DICTIONARY STRUCTURING (IMPORT)
// ============================================================================

/**
 * Main entry point for structuring dictionary data into concept objects
 * Processes concepts in hierarchical order: PRIMARY → SECONDARY → SOURCE → QUESTION → RESPONSE
 * 
 * @param {Array<Object>} mapping - Concept key-to-ID mapping from assignConcepts()
 * @param {Array<Object>} columns - Column index mapping from parseColumns()
 * @param {Array<Array>} data - 2D array of spreadsheet data (excluding header row)
 * @returns {Array<Object>} Array of structured concept objects ready for saving
 */
export const structureDictionary = (mapping, columns, data) => {
    let conceptObjects = [];
    const errors = [];

    // Process in hierarchical order - this order matters for reference resolution
    for (const conceptType of MODAL_CONFIG.CONCEPT_TYPES) {
        try {
            conceptObjects = processConceptType(mapping, columns, data, conceptType, conceptObjects);
        } catch (error) {
            errors.push(`Error processing ${conceptType}: ${error.message}`);
            console.error(`Error processing ${conceptType}:`, error);
        }
    }

    if (errors.length > 0) {
        displayError(`Import completed with errors: ${errors.join('; ')}`);
    }

    return conceptObjects;
};

/**
 * Processes all concepts of a specific type from the spreadsheet
 * 
 * @param {Array<Object>} mapping - Key-to-ID mapping
 * @param {Array<Object>} columns - Column mappings for all types
 * @param {Array<Array>} data - Spreadsheet data rows
 * @param {string} objectType - Concept type to process (PRIMARY, SECONDARY, etc.)
 * @param {Array<Object>} conceptObjects - Accumulated concept objects from previous types
 * @returns {Array<Object>} Updated conceptObjects array with new concepts added
 */
const processConceptType = (mapping, columns, data, objectType, conceptObjects) => {
    const { config } = appState.getState();
    const typeColumns = columns.find(c => c.object_type === objectType);
    const typeConfig = config?.[objectType] || [];
    
    // KEY column is required for any concept type
    const keyColumn = typeColumns?.KEY;
    if (keyColumn === undefined) {
        console.warn(`No KEY column found for ${objectType}, skipping`);
        return conceptObjects;
    }

    // Track processed keys to avoid duplicates (case-insensitive)
    const processedKeys = new Set();

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        const keyValue = getCellValue(row, keyColumn);

        // Skip if no key value or already processed (case-insensitive)
        if (!keyValue || processedKeys.has(keyValue.toLowerCase())) {
            continue;
        }

        processedKeys.add(keyValue.toLowerCase());

        // Build the concept object
        const concept = buildConceptObject(
            mapping,
            columns,
            data,
            rowIndex,
            keyValue,
            objectType,
            typeColumns,
            typeConfig,
            conceptObjects
        );

        if (concept) {
            conceptObjects.push(concept);
        }
    }

    return conceptObjects;
};

/**
 * Builds a single concept object with all its fields
 * 
 * @param {Array<Object>} mapping - Key-to-ID mapping
 * @param {Array<Object>} columns - All column mappings
 * @param {Array<Array>} data - Spreadsheet data
 * @param {number} rowIndex - Current row being processed
 * @param {string} keyValue - The concept's key value
 * @param {string} objectType - Type of concept being built
 * @param {Object} typeColumns - Column mapping for this concept type
 * @param {Array<Object>} typeConfig - Field configuration from config.js
 * @param {Array<Object>} conceptObjects - Already processed concepts (for reference lookups)
 * @returns {Object|null} Structured concept object or null if invalid
 */
const buildConceptObject = (mapping, columns, data, rowIndex, keyValue, objectType, typeColumns, typeConfig, conceptObjects) => {
    // Get concept ID from mapping
    const mappingEntry = mapping.find(m => m.concept.toLowerCase() === keyValue.toLowerCase());
    if (!mappingEntry) {
        console.warn(`No mapping found for concept: ${keyValue}`);
        return null;
    }

    // Start with required fields
    // _sourceRow is internal tracking for validation (row in spreadsheet, 1-indexed + 1 for header)
    const concept = {
        key: keyValue,
        conceptID: mappingEntry.id,
        object_type: objectType,
        _sourceRow: rowIndex + 2 // +2: 1-indexed and +1 for header row
    };

    // Process extra columns from spreadsheet (non-reference fields)
    const extraColumns = getExtraKeys(typeColumns);
    extraColumns.forEach(fieldKey => {
        const columnIndex = typeColumns[fieldKey];
        const value = getCellValue(data[rowIndex], columnIndex);
        
        if (value !== undefined && value !== null && value !== '') {
            // Store with lowercase key to match config field ids
            concept[fieldKey.toLowerCase()] = value;
        }
    });

    // Handle hierarchical reference fields based on type
    addHierarchicalReferences(concept, mapping, columns, data, rowIndex, objectType, conceptObjects);

    // Clean up internal fields that shouldn't be in final object
    if (concept.value !== undefined) {
        delete concept.value; // VALUE is only used for response ordering
    }

    return concept;
};

/**
 * Adds hierarchical reference fields (parent, source, responses) based on row position
 * Uses config to determine the correct field names for each reference type
 * 
 * @param {Object} concept - The concept object being built
 * @param {Array<Object>} mapping - Key-to-ID mapping
 * @param {Array<Object>} columns - All column mappings
 * @param {Array<Array>} data - Spreadsheet data
 * @param {number} rowIndex - Current row index
 * @param {string} objectType - Type of concept
 * @param {Array<Object>} conceptObjects - Already processed concepts
 */
const addHierarchicalReferences = (concept, mapping, columns, data, rowIndex, objectType, conceptObjects) => {
    const { config } = appState.getState();
    const typeConfig = config?.[objectType] || [];
    const row = data[rowIndex];

    // Find all reference fields in the config for this type
    const referenceFields = typeConfig.filter(field => field.type === 'reference');

    referenceFields.forEach(field => {
        const referencesType = field.referencesType;
        const fieldId = field.id;

        if (!referencesType) return;

        // Handle RESPONSE references specially (look forward, build array)
        if (referencesType === 'RESPONSE') {
            const responses = collectResponses(mapping, columns, data, rowIndex, conceptObjects);
            if (responses && responses.length > 0) {
                concept[fieldId] = responses;
            }
            return;
        }

        // Handle allowMultiple reference fields — collect all unique parent IDs
        // across all rows where this concept's key appears
        if (field.allowMultiple) {
            const allParentIds = collectAllParentIds(concept.key, mapping, columns, data, objectType, referencesType);
            if (allParentIds.length > 0) {
                concept[fieldId] = allParentIds;
            }
            return;
        }

        // For PRIMARY and SECONDARY references (single), look backwards for nearest match
        if (referencesType === 'PRIMARY' || referencesType === 'SECONDARY') {
            const parentId = findParentConceptId(mapping, columns, data, rowIndex, referencesType);
            if (parentId) {
                concept[fieldId] = parentId;
            }
            return;
        }

        // For SOURCE references, check same row
        if (referencesType === 'SOURCE') {
            const sourceColumns = columns.find(c => c.object_type === 'SOURCE');
            if (sourceColumns?.KEY !== undefined) {
                const sourceKey = getCellValue(row, sourceColumns.KEY);
                if (sourceKey) {
                    const sourceMapping = mapping.find(m => m.concept.toLowerCase() === sourceKey.toLowerCase());
                    if (sourceMapping) {
                        concept[fieldId] = sourceMapping.id;
                    }
                }
            }
            return;
        }

        // For any other reference types, try to find by looking backwards
        const refId = findParentConceptId(mapping, columns, data, rowIndex, referencesType);
        if (refId) {
            concept[fieldId] = refId;
        }
    });
};

/**
 * Finds the parent concept ID by looking backwards through the data
 * 
 * @param {Array<Object>} mapping - Key-to-ID mapping
 * @param {Array<Object>} columns - Column mappings
 * @param {Array<Array>} data - Spreadsheet data
 * @param {number} currentRow - Current row index
 * @param {string} parentType - Type of parent to find (PRIMARY or SECONDARY)
 * @returns {number|null} Parent concept ID or null if not found
 */
const findParentConceptId = (mapping, columns, data, currentRow, parentType) => {
    const parentColumns = columns.find(c => c.object_type === parentType);
    const parentKeyColumn = parentColumns?.KEY;

    if (parentKeyColumn === undefined) {
        return null;
    }

    // Look backwards from current row to find nearest parent
    for (let i = currentRow; i >= 0; i--) {
        const parentKey = getCellValue(data[i], parentKeyColumn);
        if (parentKey) {
            const parentMapping = mapping.find(m => m.concept.toLowerCase() === parentKey.toLowerCase());
            if (parentMapping) {
                return parentMapping.id;
            }
        }
    }

    return null;
};

/**
 * Collects all unique parent concept IDs for a given concept key across all rows
 * Used for allowMultiple reference fields where the same concept appears on multiple rows
 * with different parents (e.g., a Question under multiple Secondaries)
 * 
 * @param {string} conceptKey - The key of the concept to find parents for
 * @param {Array<Object>} mapping - Key-to-ID mapping
 * @param {Array<Object>} columns - Column mappings
 * @param {Array<Array>} data - Spreadsheet data
 * @param {string} conceptType - The type of the concept (e.g., 'QUESTION')
 * @param {string} parentType - The type of parent to find (e.g., 'SECONDARY')
 * @returns {Array} Array of unique parent concept IDs
 */
const collectAllParentIds = (conceptKey, mapping, columns, data, conceptType, parentType) => {
    const conceptColumns = columns.find(c => c.object_type === conceptType);
    const conceptKeyColumn = conceptColumns?.KEY;
    const parentColumns = columns.find(c => c.object_type === parentType);
    const parentKeyColumn = parentColumns?.KEY;

    if (conceptKeyColumn === undefined || parentKeyColumn === undefined) {
        return [];
    }

    const parentIds = new Set();

    for (let i = 0; i < data.length; i++) {
        const rowKey = getCellValue(data[i], conceptKeyColumn);
        if (!rowKey || rowKey.toLowerCase() !== conceptKey.toLowerCase()) continue;

        // For this row, find the nearest parent by looking backwards
        const parentId = findParentConceptId(mapping, columns, data, i, parentType);
        if (parentId) {
            parentIds.add(parentId);
        }
    }

    return Array.from(parentIds);
};

/**
 * Collects RESPONSE concepts that belong to the current QUESTION
 * Looks forward until the next QUESTION is found
 * Uses mapping instead of conceptObjects since RESPONSEs are processed after QUESTIONs
 * Returns an array of concept IDs to match the format used by the GUI
 * 
 * @param {Array<Object>} mapping - Key-to-ID mapping (already has all concept IDs assigned)
 * @param {Array<Object>} columns - Column mappings
 * @param {Array<Array>} data - Spreadsheet data
 * @param {number} questionRow - Row index of the QUESTION
 * @param {Array<Object>} conceptObjects - Processed concepts (not used, kept for signature compatibility)
 * @returns {Array} Array of response concept IDs (matches GUI format)
 */
const collectResponses = (mapping, columns, data, questionRow, conceptObjects) => {
    const questionColumns = columns.find(c => c.object_type === 'QUESTION');
    const responseColumns = columns.find(c => c.object_type === 'RESPONSE');
    
    const questionKeyColumn = questionColumns?.KEY;
    const responseKeyColumn = responseColumns?.KEY;

    if (responseKeyColumn === undefined) {
        return [];
    }

    const responses = [];

    // Start from the question row and look forward
    for (let i = questionRow; i < data.length; i++) {
        // Stop if we hit another QUESTION (but not on the first row)
        if (i > questionRow && questionKeyColumn !== undefined) {
            const nextQuestionKey = getCellValue(data[i], questionKeyColumn);
            if (nextQuestionKey) {
                break;
            }
        }

        // Check for RESPONSE on this row
        const responseKey = getCellValue(data[i], responseKeyColumn);
        if (responseKey) {
            // Find the response in mapping (which has all IDs assigned already)
            const responseMapping = mapping.find(m => m.concept.toLowerCase() === responseKey.toLowerCase());

            if (responseMapping) {
                responses.push(responseMapping.id);
            }
        }
    }

    return responses;
};

// ============================================================================
// FILE EXPORT (JSON → SPREADSHEET)
// ============================================================================

/**
 * Converts an array of JSON concept files back into spreadsheet format
 * Used when exporting concepts from the repository to a spreadsheet
 * 
 * Produces a denormalized layout where each QUESTION row includes its
 * parent PRIMARY, SECONDARY, and SOURCE info on the same row.
 * RESPONSEs appear as separate rows below their parent QUESTION.
 * 
 * @param {Array<Object>} data - Array of concept objects from JSON files
 * @returns {Array<Array>} 2D array suitable for spreadsheet export
 */
export const structureFiles = (data) => {
    const { config } = appState.getState();

    // Group concepts by type and build CID → concept lookup
    const conceptsByType = {};
    MODAL_CONFIG.CONCEPT_TYPES.forEach(type => {
        conceptsByType[type] = data.filter(x => x.object_type === type);
    });

    const conceptByCID = {};
    data.forEach(c => { if (c.conceptID) conceptByCID[c.conceptID] = c; });

    // Build header row dynamically using labels from config
    const headers = [];
    const columnTypes = [];  // Tracks concept type per column (for styling)
    const columnMapping = {}; // Maps type_field to column index

    MODAL_CONFIG.CONCEPT_TYPES.forEach(type => {
        const typeConfig = config?.[type] || [];

        // Find labels for KEY and CID from config, fall back to defaults
        const keyField = typeConfig.find(f => f.id === 'key');
        const cidField = typeConfig.find(f => f.id === 'conceptID' || f.id === 'conceptId');
        
        columnMapping[`${type}_KEY`] = headers.length;
        headers.push(keyField?.label || `${type} Key`);
        columnTypes.push(type);
        
        columnMapping[`${type}_CID`] = headers.length;
        headers.push(cidField?.label || `${type} CID`);
        columnTypes.push(type);

        // Add extra fields from config (excluding references which are positional)
        typeConfig.forEach(field => {
            if (field.type !== 'reference' && field.id !== 'key' && field.id !== 'conceptID' && field.id !== 'conceptId') {
                columnMapping[`${type}_${field.id.toUpperCase()}`] = headers.length;
                headers.push(field.label || `${type} ${field.id}`);
                columnTypes.push(type);
            }
        });
    });

    // Helper: fill a row with a concept's non-reference fields
    const fillConcept = (row, concept, type) => {
        if (!concept) return;

        const keyCol = columnMapping[`${type}_KEY`];
        if (keyCol !== undefined) row[keyCol] = concept.key || '';

        const cidCol = columnMapping[`${type}_CID`];
        if (cidCol !== undefined) row[cidCol] = concept.conceptID || '';

        const typeConfig = config?.[type] || [];
        Object.keys(concept).forEach(field => {
            if (['key', 'conceptID', 'object_type', '_sourceRow'].includes(field)) return;
            const fieldConfig = typeConfig.find(f => f.id === field);
            if (fieldConfig?.type === 'reference') return;

            const colKey = `${type}_${field.toUpperCase()}`;
            const colIndex = columnMapping[colKey];
            if (colIndex !== undefined) {
                row[colIndex] = concept[field];
            }
        });
    };

    // Helper: find the config field id that references a target type
    const getRefFieldId = (srcType, tgtType) => {
        const tc = config?.[srcType] || [];
        return tc.find(f => f.type === 'reference' && f.referencesType === tgtType)?.id || null;
    };

    // Helper: check if a reference field allows multiple values
    const isRefAllowMultiple = (srcType, tgtType) => {
        const tc = config?.[srcType] || [];
        const field = tc.find(f => f.type === 'reference' && f.referencesType === tgtType);
        return field?.allowMultiple === true;
    };

    // Resolve reference field names from config
    const secToParent = getRefFieldId('SECONDARY', 'PRIMARY');
    const qToSecondary = getRefFieldId('QUESTION', 'SECONDARY');
    const qToSource = getRefFieldId('QUESTION', 'SOURCE');
    const qToResponses = getRefFieldId('QUESTION', 'RESPONSE');
    const qToSecondaryIsMultiple = isRefAllowMultiple('QUESTION', 'SECONDARY');

    const rows = [headers];
    const placed = new Set(); // Track placed concept CIDs

    // Walk the hierarchy: PRIMARY → SECONDARY → QUESTION → RESPONSE
    const primaries = conceptsByType['PRIMARY'] || [];
    const secondaries = conceptsByType['SECONDARY'] || [];
    const questions = conceptsByType['QUESTION'] || [];

    primaries.forEach(primary => {
        placed.add(primary.conceptID);

        // Find secondaries that reference this primary
        const childSecs = secToParent
            ? secondaries.filter(s => s[secToParent] === primary.conceptID)
            : [];

        if (childSecs.length === 0) {
            // Standalone primary with no children
            const row = new Array(headers.length).fill('');
            fillConcept(row, primary, 'PRIMARY');
            rows.push(row);
            return;
        }

        childSecs.forEach(secondary => {
            placed.add(secondary.conceptID);

            // Find questions that reference this secondary
            // Handle both scalar and array (allowMultiple) references
            const childQs = qToSecondary
                ? questions.filter(q => {
                    const ref = q[qToSecondary];
                    if (Array.isArray(ref)) {
                        return ref.includes(secondary.conceptID);
                    }
                    return ref === secondary.conceptID;
                })
                : [];

            if (childQs.length === 0) {
                // Secondary with no questions
                const row = new Array(headers.length).fill('');
                fillConcept(row, primary, 'PRIMARY');
                fillConcept(row, secondary, 'SECONDARY');
                rows.push(row);
                return;
            }

            childQs.forEach(question => {
                placed.add(question.conceptID);

                // Resolve source for this question
                let source = null;
                if (qToSource && question[qToSource]) {
                    source = conceptByCID[question[qToSource]];
                    if (source) placed.add(source.conceptID);
                }

                // Resolve responses for this question
                let resps = [];
                if (qToResponses && question[qToResponses] && Array.isArray(question[qToResponses])) {
                    resps = question[qToResponses]
                        .map(id => conceptByCID[id])
                        .filter(Boolean);
                    resps.forEach(r => placed.add(r.conceptID));
                }

                // Question row: denormalized with PRIMARY + SECONDARY + SOURCE + QUESTION
                // First response goes on the same row as the question
                const qRow = new Array(headers.length).fill('');
                fillConcept(qRow, primary, 'PRIMARY');
                fillConcept(qRow, secondary, 'SECONDARY');
                fillConcept(qRow, source, 'SOURCE');
                fillConcept(qRow, question, 'QUESTION');
                if (resps.length > 0) {
                    fillConcept(qRow, resps[0], 'RESPONSE');
                }
                rows.push(qRow);

                // Additional responses on their own rows below
                for (let i = 1; i < resps.length; i++) {
                    const rRow = new Array(headers.length).fill('');
                    fillConcept(rRow, resps[i], 'RESPONSE');
                    rows.push(rRow);
                }
            });
        });
    });

    // Append any orphan concepts not placed via the hierarchy walk
    data.forEach(concept => {
        if (placed.has(concept.conceptID)) return;
        const row = new Array(headers.length).fill('');
        fillConcept(row, concept, concept.object_type);
        rows.push(row);
    });

    return { data: rows, columnTypes };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely gets a cell value, handling undefined/null/empty cases
 * 
 * @param {Array} row - Row array
 * @param {number} columnIndex - Column index to access
 * @returns {*} Cell value or undefined
 */
const getCellValue = (row, columnIndex) => {
    if (!row || columnIndex === undefined || columnIndex < 0) {
        return undefined;
    }
    
    const value = row[columnIndex];
    
    // Treat empty strings as undefined
    if (value === '' || value === null) {
        return undefined;
    }
    
    return value;
};

/**
 * Gets extra field keys from a column mapping (excludes standard fields)
 * These are additional fields defined in the spreadsheet beyond KEY/CID
 * 
 * @param {Object} columnMap - Column mapping object
 * @returns {Array<string>} Array of extra field keys (uppercase)
 */
const getExtraKeys = (columnMap) => {
    const standardKeys = new Set(['KEY', 'CID', 'object_type']);
    return Object.keys(columnMap).filter(key => !standardKeys.has(key));
};