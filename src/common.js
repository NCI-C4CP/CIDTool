import { getFiles } from './api.js';

export const displayError = (message) => {
    alert(message);
    return true;
}

export const objectExists = (objects, key, value) => {
    return objects.find(object => object[key] === value);
}

export const isEmpty = (object) => {
    for(let prop in object) {
        if(Object.prototype.hasOwnProperty.call(object, prop)) {
            return false;
        }
    }

    return true;
}  

export const uniqueKeys = (objects) => {

    let keys = [];

    for(let object of objects) {
        const objectKeys = Object.keys(object);
        
        for(let key of objectKeys) {
            if(key === "object_type") continue;
            if(!keys.includes(key)) keys.push(key);
        }
    }
    
    return keys;
}

const createStore = (initialState = {}) => {
    let state = initialState;
  
    const setState = (update) => {
      const currSlice = typeof update === 'function' ? update(state) : update;
  
      if (currSlice !== state) {
        state = { ...state, ...currSlice };
      }
    };
  
    const getState = () => state;
  
    return { setState, getState };
}

export const appState = createStore();

export const toBase64 = (string) => {
    return btoa(string);
}

export const fromBase64 = (string) => {
    try {
        // Handle null/undefined strings
        if (!string) {
            throw new Error('Base64 string is empty or null');
        }
        
        // Clean the base64 string by removing whitespace and newlines
        const cleanedString = string.replace(/\s/g, '');
        
        // Validate base64 format
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(cleanedString)) {
            throw new Error('Invalid base64 format');
        }
        
        return atob(cleanedString);
    } catch (error) {
        console.error('Error decoding base64 string:', error);
        console.error('Original string:', string);
        throw new Error(`Failed to decode base64: ${error.message}`);
    }
}

export const showAnimation = () => {
    document.querySelector('.spinner-wrapper').style.display = 'flex';
}

export const hideAnimation = () => {
    document.querySelector('.spinner-wrapper').style.display = 'none';
}

export const isLocal = () => {
    return window.location.href.includes('localhost');
}

export const executeWithAnimation = async (func, ...args) => {
    showAnimation();
    try {
        await func(...args);
    } finally {
        hideAnimation();
    }
};

export const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
}

export const getFileContent = async (file) => {
    try {
        const contents = await getFiles(file);
        
        // Check if we have valid content
        if (!contents || !contents.data || !contents.data.content) {
            throw new Error('No content found in file response');
        }
        
        const fileContentString = fromBase64(contents.data.content);
        
        // Validate that we have actual content after decoding
        if (!fileContentString || fileContentString.trim() === '') {
            throw new Error('File content is empty after decoding');
        }
        
        return {
            content: JSON.parse(fileContentString),
            meta: contents.data
        };
    } catch (error) {
        console.error(`Error loading file content for ${file}:`, error);
        
        // Provide more specific error messages
        if (error.message.includes('base64')) {
            throw new Error(`File "${file}" contains invalid or corrupted data that cannot be decoded.`);
        } else if (error.message.includes('JSON')) {
            throw new Error(`File "${file}" contains invalid JSON format.`);
        } else {
            throw new Error(`Failed to load file "${file}": ${error.message}`);
        }
    }
}

export const removeEventListeners = (element) => {
    const clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    return clone;
}

export const createReferenceDropdown = (field) => {
    const { objects } = appState.getState();
    const referencedConcepts = [];
    const targetType = field.referencesType;
    
    // Find all matching concept types from the objects
    for (const [fileName, conceptType] of Object.entries(objects)) {
        if (conceptType === targetType) {
            const displayValue = formatConceptDisplay(fileName);

            referencedConcepts.push({
                id: `${displayValue}`
            });
        }
    }
    
    // Sort concepts for better UX
    referencedConcepts.sort((a, b) => a.id.localeCompare(b.id));
    
    if (referencedConcepts.length === 0) {
        return `
            <select class="form-select" id="${field.id}" ${field.required ? 'required' : ''} disabled>
                <option value="">No ${targetType} concepts available</option>
            </select>
            <div class="form-text text-warning">You need to create a ${targetType} concept first</div>
        `;
    }
    else if (targetType === 'RESPONSE') {
        return `
            <div class="dropdown-container">
                <div class="form-control d-flex flex-wrap align-items-center" 
                    id="${field.id}_container" role="button" data-bs-toggle="dropdown" 
                    aria-expanded="false">
                    <span class="dropdown-text">Select Responses</span>
                </div>
                
                <div class="dropdown-menu p-2 w-100" aria-labelledby="${field.id}_container">
                    <div class="response-options" style="max-height: 200px; overflow-y: auto;">
                        ${referencedConcepts.map(option => `
                            <div class="form-check">
                                <input class="form-check-input response-checkbox" type="checkbox" 
                                    value="${option.id}" id="${field.id}_${option.id}">
                                <label class="form-check-label w-100" for="${field.id}_${option.id}">
                                    ${option.id}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div id="${field.id}_pills" class="selected-pills d-flex flex-wrap mt-2"></div>
                <input type="hidden" id="${field.id}" value="[]">
            </div>
            <style>
                .selected-pills { 
                    gap: 5px; 
                    min-height: 30px;
                }
                .response-pill {
                    background: #e9ecef;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.85em;
                    display: inline-flex;
                    align-items: center;
                    margin-bottom: 4px;
                }
                .pill-remove {
                    margin-left: 5px;
                    cursor: pointer;
                    font-size: 1.2em;
                    line-height: 0.7;
                }
            </style>
        `;
    }
    
    return `
        <select class="form-select" id="${field.id}" ${field.required ? 'required' : ''}>
            <option value="">-- Select a ${targetType} concept --</option>
            ${referencedConcepts.map(concept => 
                `<option value="${concept.id}">${concept.id}</option>`
            ).join('')}
        </select>
    `;
};

export const validateFormFields = (payload, template) => {

    let valid = true;

    template.forEach(field => {
        if (field.id === 'conceptId' || field.id === 'key') {
            return;
        }

        const fieldElement = document.getElementById(field.id);

        if (!fieldElement) {
            valid = false;
            return;
        }

        if (field.required && (!fieldElement.value || fieldElement.value === '')) {
            fieldElement.classList.add('is-invalid');
            valid = false;
            return;
        }

        switch (field.type) {
            case 'array':
                
                break;
                
            case 'reference':
                // Store reference ID directly
                if (fieldElement.value) {
                    payload['parent'] = extractConcept(fieldElement.value);
                }
                break;
                
            default:
                // For regular fields, store value as is
                payload[field.id] = fieldElement.value;
        }
    });

    return valid;
}

/**
 * Extracts the concept ID from a display string formatted as "[KEY] - [CONCEPT]"
 * @param {string} displayValue - The formatted display string
 * @returns {string} The extracted concept ID
 */
export const extractConcept = (displayValue) => {
    if (!displayValue) return '';
    
    // If the string contains a dash, extract everything after the last dash
    if (displayValue.includes(' - ')) {
        // Split by the last dash and trim whitespace
        const parts = displayValue.split(' - ');
        return parts[parts.length - 1].trim();
    }
    
    // If no dash found, return the whole string (likely just a concept ID)
    return displayValue.trim();
};

/**
 * Creates a display value from a concept filename using the index
 * @param {string} fileName - The concept filename (e.g., "CONCEPT123.json")
 * @param {Object} index - The index object mapping filenames to keys
 * @returns {string} A formatted display string "[KEY] - [CONCEPT]"
 */
export const formatConceptDisplay = (fileName) => {
    const { index } = appState.getState();
    const conceptId = fileName.replace('.json', '');
    const key = index[fileName];
    
    return `${key} - ${conceptId}`;
};