import { CONFIG } from "./config.js";
import { displayError } from "./common.js";

export const assignConcepts = (categories, data) => {

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
    concepts = backfillConceptIDs(concepts);

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

const backfillConceptIDs = (objects) => {

    // Collect existing valid IDs (exclude empty strings and null)
    const ids = new Set(
        objects
            .map(object => object.id)
            .filter(id => id !== undefined && id !== null && id !== '')
    );

    for (let object of objects) {
        // Check if ID is missing (undefined, null, or empty string)
        if (object.id === undefined || object.id === null || object.id === '') {
            let id;
            
            do {
                id = generateConceptID();
            } while(ids.has(id));

            ids.add(id);
            object.id = id;
        }
    }

    return objects
}

const generateConceptID = () => {
    return Math.floor(100000000 + Math.random() * 900000000);
}