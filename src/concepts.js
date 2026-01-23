import { CONFIG } from "./config.js";
import { displayError } from "./common.js";

/**
 * Assigns concept IDs to keys from spreadsheet data
 * @param {Array} categories - Column mapping for each concept type
 * @param {Array} data - Spreadsheet data rows
 * @param {Set} existingRepoIds - Set of Concept IDs already in the repository (optional)
 * @returns {Array|false} Array of concept mappings or false if validation fails
 */
export const assignConcepts = (categories, data, existingRepoIds = new Set()) => {

    let concepts = [];
    const seenConcepts = new Set(); // Track concept keys we've already processed

    for(const category of categories) {
        
        const key = category.KEY;
        const id = category.CID;
        
        // Skip if this category doesn't have a KEY column
        if (key === undefined) continue;
        
        for(let i = 0; i < data.length; i++) {
            const conceptKey = data[i][key];
            
            // Skip empty cells or already-seen concepts
            if (!conceptKey || seenConcepts.has(conceptKey)) {
                continue;
            }
            
            // Get the concept ID value (may be undefined if not provided)
            const conceptId = id !== undefined ? data[i][id] : undefined;
            
            // Validate concept ID if provided
            if (conceptId !== undefined && conceptId !== null && conceptId !== '') {
                if (!validateConceptID(conceptId)) {
                    displayError("Incorrect Structure for Concept ID - " + conceptId);
                    return false;
                }
            }
            
            // Mark as seen and add to concepts array
            seenConcepts.add(conceptKey);
            concepts.push({
                concept: conceptKey,
                id: conceptId,
                type: category.object_type // Track which type this concept belongs to
            });

            console.log(`[${category.object_type}] Line ${i}: "${conceptKey}" -> ID: ${conceptId || '(auto-generate)'}`);
        }
    }

    if(!validateInitialMapping(concepts)) {
        return false;
    }

    concepts = filterDuplicateMapping(concepts);
    concepts = backfillConceptIDs(concepts, existingRepoIds);

    return concepts;
}

const validateConceptID = (id) => {

    if (typeof id !== 'number') return false;

    const regex = new RegExp(CONFIG.CONCEPT_FORMAT);

    return regex.test(id);
}

const validateInitialMapping = (objects) => {

    const concepts = new Map();

    for(const object of objects) {

        if(object.id === undefined || object.id === null) continue;

        if(concepts.has(object.concept)) {
            if(concepts.get(object.concept) !== object.id) {
                displayError("Multiple Concept IDs used for same Key (" + object.concept + ")");
                return false;
            }
        }
        else {
            concepts.set(object.concept, object.id);
        }
    }

    return true;
}

const filterDuplicateMapping = (objects) => {

    let temp = new Set();
    let conceptsWithID = new Set();

    let filtered = objects.filter(object => {
        
        let key = `${object.concept}-${object.id}`;

        if(temp.has(key)) {
            return false;
        } 
        else {
            temp.add(key);
            // Check for actual ID value (not undefined, null, or empty string)
            if(object.id !== undefined && object.id !== null && object.id !== '') {
                conceptsWithID.add(object.concept);
            }

            return true;
        }
    });

    filtered = filtered.filter(object => {
        // Treat empty strings same as undefined
        const hasNoId = object.id === undefined || object.id === null || object.id === '';
        if(hasNoId && conceptsWithID.has(object.concept)) return false;

        return true;
    });
    

    return filtered;
}

/**
 * Fills in missing Concept IDs with auto-generated unique values
 * @param {Array} objects - Concept objects that may be missing IDs
 * @param {Set} existingRepoIds - Set of Concept IDs already in the repository
 * @returns {Array} Objects with all IDs populated
 */
const backfillConceptIDs = (objects, existingRepoIds = new Set()) => {

    // Collect IDs from the import file (exclude empty strings and null)
    const fileIds = new Set(
        objects
            .map(object => object.id)
            .filter(id => id !== undefined && id !== null && id !== '')
    );
    
    // Combine file IDs with existing repository IDs to avoid all collisions
    const allUsedIds = new Set([...fileIds, ...existingRepoIds]);

    for (let object of objects) {
        // Check if ID is missing (undefined, null, or empty string)
        if (object.id === undefined || object.id === null || object.id === '') {
            let id;
            
            do {
                id = generateConceptID();
            } while(allUsedIds.has(id) || allUsedIds.has(String(id)));

            allUsedIds.add(id);
            object.id = id;
        }
    }

    return objects
}

const generateConceptID = () => {
    return Math.floor(100000000 + Math.random() * 900000000);
}

// ============================================================================
// IMPORT VALIDATION
// ============================================================================

/**
 * Validates import data against existing repository data
 * Performs comprehensive checks before allowing import
 * 
 * @param {Array<Object>} conceptObjects - Structured concept objects from dictionary parsing
 * @param {Object} existingIndex - Current repository index (index._files)
 * @param {Object} config - Field configuration for each concept type
 * @returns {Object} Validation result with { valid: boolean, errors: Array<Object> }
 */
export const validateImportData = (conceptObjects, existingIndex, config) => {
    const errors = [];
    const existingFiles = existingIndex?._files || {};
    
    // Build lookup sets from existing data
    // The filename IS the concept ID (e.g., "164242418.json" -> "164242418")
    const existingConceptIds = new Set();
    const existingKeys = new Map(); // key (lowercase) -> conceptID
    
    Object.entries(existingFiles).forEach(([filename, fileData]) => {
        // Extract concept ID from filename (remove .json extension)
        const conceptIdFromFile = filename.replace('.json', '');
        existingConceptIds.add(conceptIdFromFile);
        
        if (fileData.key) {
            existingKeys.set(fileData.key.toLowerCase(), conceptIdFromFile);
        }
    });
    
    // Track what we're importing to catch duplicates within the import itself
    const importConceptIds = new Set();
    const importKeys = new Map(); // key -> conceptID (case-insensitive)
    
    // Validate each concept
    conceptObjects.forEach((concept, index) => {
        // Use _sourceRow if available, otherwise fall back to index-based calculation
        const rowNum = concept._sourceRow || (index + 2);
        const conceptKey = concept.key;
        const conceptId = String(concept.conceptID);
        const objectType = concept.object_type;
        
        // 1. Check for duplicate Concept ID in existing repository
        if (existingConceptIds.has(conceptId)) {
            errors.push({
                type: 'DUPLICATE_CONCEPT_ID',
                severity: 'error',
                row: rowNum,
                key: conceptKey,
                conceptId: conceptId,
                message: `Concept ID "${conceptId}" is already in use in the repository`,
                suggestion: 'Remove the Concept ID from this row to auto-generate a new one, or use a different ID'
            });
        }
        
        // 2. Check for duplicate Concept ID within this import
        if (importConceptIds.has(conceptId)) {
            errors.push({
                type: 'DUPLICATE_CONCEPT_ID_IMPORT',
                severity: 'error',
                row: rowNum,
                key: conceptKey,
                conceptId: conceptId,
                message: `Concept ID "${conceptId}" is used multiple times in this file`,
                suggestion: 'Each concept must have a unique ID. Remove duplicates or leave blank to auto-generate'
            });
        }
        importConceptIds.add(conceptId);
        
        // 3. Check for duplicate Key in existing repository
        const keyLower = conceptKey.toLowerCase();
        if (existingKeys.has(keyLower)) {
            const existingId = existingKeys.get(keyLower);
            errors.push({
                type: 'DUPLICATE_KEY',
                severity: 'error',
                row: rowNum,
                key: conceptKey,
                existingConceptId: existingId,
                message: `Key "${conceptKey}" already exists in the repository (Concept ID: ${existingId})`,
                suggestion: 'Use a unique key name or update the existing concept instead'
            });
        }
        
        // 4. Check for duplicate Key within this import
        if (importKeys.has(keyLower)) {
            const conflictingId = importKeys.get(keyLower);
            if (conflictingId !== conceptId) {
                errors.push({
                    type: 'DUPLICATE_KEY_IMPORT',
                    severity: 'error',
                    row: rowNum,
                    key: conceptKey,
                    conceptId: conceptId,
                    conflictingConceptId: conflictingId,
                    message: `Key "${conceptKey}" is used multiple times in this file with different Concept IDs`,
                    suggestion: 'Each key must map to exactly one Concept ID'
                });
            }
        }
        importKeys.set(keyLower, conceptId);
        
        // 5. Check required fields based on config
        // Skip conceptId/conceptID and key - these are handled separately
        // (key is required from spreadsheet, conceptID is auto-generated if missing)
        const typeConfig = config?.[objectType] || [];
        typeConfig.forEach(field => {
            // Skip core fields that are always handled by the import process
            if (field.id === 'conceptId' || field.id === 'conceptID' || field.id === 'key') {
                return;
            }
            
            if (field.required) {
                const fieldValue = concept[field.id];
                if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
                    errors.push({
                        type: 'MISSING_REQUIRED_FIELD',
                        severity: 'error',
                        row: rowNum,
                        key: conceptKey,
                        conceptId: conceptId,
                        field: field.label || field.id,
                        fieldId: field.id,
                        objectType: objectType,
                        message: `Missing required field "${field.label || field.id}" for ${objectType} concept "${conceptKey}"`,
                        suggestion: `Add a value to the ${objectType}_${field.id.toUpperCase()} column for this row`
                    });
                }
            }
        });
    });
    
    return {
        valid: errors.length === 0,
        errors: errors,
        summary: {
            total: conceptObjects.length,
            errorCount: errors.length,
            duplicateIds: errors.filter(e => e.type.includes('DUPLICATE_CONCEPT_ID')).length,
            duplicateKeys: errors.filter(e => e.type.includes('DUPLICATE_KEY')).length,
            missingFields: errors.filter(e => e.type === 'MISSING_REQUIRED_FIELD').length
        }
    };
};