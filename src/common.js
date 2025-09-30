import { getFiles } from './api.js';

/**
 * Displays an error message to the user via alert
 * @param {string} message - The error message to display
 * @returns {boolean} Always returns true
 */
export const displayError = (message) => {
    console.error(message);
    alert(message);
    return true;
}

/**
 * Finds an object in an array that has a specific key-value pair
 * @param {Array} objects - Array of objects to search through
 * @param {string} key - The property key to match
 * @param {*} value - The value to match
 * @returns {Object|undefined} The first matching object or undefined if not found
 */
export const objectExists = (objects, key, value) => {
    return objects.find(object => object[key] === value);
}

/**
 * Checks if an object is empty (has no enumerable properties)
 * @param {Object} object - The object to check
 * @returns {boolean} True if the object is empty, false otherwise
 */
export const isEmpty = (object) => {
    for(let prop in object) {
        if(Object.prototype.hasOwnProperty.call(object, prop)) {
            return false;
        }
    }

    return true;
}  

/**
 * Extracts all unique keys from an array of objects, excluding 'object_type'
 * @param {Array<Object>} objects - Array of objects to extract keys from
 * @returns {Array<string>} Array of unique keys
 */
export const uniqueKeys = (objects) => {
    const keySet = new Set();

    for(let object of objects) {
        const objectKeys = Object.keys(object);
        
        for(let key of objectKeys) {
            if(key === "object_type") continue;
            keySet.add(key);
        }
    }
    
    return Array.from(keySet);
}

/**
 * Creates a simple state store with setState and getState methods
 * @param {Object} initialState - Initial state object
 * @returns {Object} Store object with setState and getState methods
 */
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

/**
 * Global application state store
 */
export const appState = createStore();

/**
 * Converts a string to base64 encoding
 * @param {string} string - The string to encode
 * @returns {string} Base64 encoded string
 * @throws {Error} If input is not a string or is empty
 */
export const toBase64 = (string) => {
    if (typeof string !== 'string') {
        throw new Error('Input must be a string');
    }
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

/**
 * Shows the loading animation spinner
 * @throws {Error} If spinner element is not found
 */
export const showAnimation = () => {
    const spinner = document.querySelector('.spinner-wrapper');
    if (!spinner) {
        console.warn('Spinner element not found');
        return;
    }
    spinner.style.display = 'flex';
}

/**
 * Hides the loading animation spinner
 * @throws {Error} If spinner element is not found
 */
export const hideAnimation = () => {
    const spinner = document.querySelector('.spinner-wrapper');
    if (!spinner) {
        console.warn('Spinner element not found');
        return;
    }
    spinner.style.display = 'none';
}

/**
 * Checks if the application is running on localhost
 * @returns {boolean} True if running on localhost, false otherwise
 */
export const isLocal = () => {
    return window.location.href.includes('localhost');
}

/**
 * Executes a function with loading animation wrapper
 * @param {Function} func - The function to execute
 * @param {...*} args - Arguments to pass to the function
 * @returns {Promise} Promise that resolves when the function completes
 */
export const executeWithAnimation = async (func, ...args) => {
    showAnimation();
    try {
        await func(...args);
    } finally {
        hideAnimation();
    }
};

/**
 * Prevents default event behavior and stops event propagation
 * @param {Event} e - The event object
 */
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

/**
 * Removes all event listeners from an element by cloning it
 * @param {HTMLElement} element - The DOM element to remove listeners from
 * @returns {HTMLElement} The cloned element with no event listeners
 */
export const removeEventListeners = (element) => {
    const clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    return clone;
}

/**
 * Creates an HTML dropdown for selecting reference concepts
 * @param {Object} field - Field configuration object with referencesType property
 * @param {string} field.id - The field ID for HTML elements
 * @param {string} field.referencesType - The type of concepts to reference
 * @param {boolean} field.required - Whether the field is required
 * @returns {string} HTML string for the dropdown element
 */
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

/**
 * Validates form fields based on a template and populates payload
 * @param {Object} payload - Object to populate with form values
 * @param {Array<Object>} template - Template defining field validation rules
 * @returns {boolean} True if all required fields are valid, false otherwise
 */
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
                // TODO: Handle array field validation
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
 * Creates a display value from a concept filename using the index from appState
 * @param {string} fileName - The concept filename (e.g., "CONCEPT123.json")
 * @returns {string} A formatted display string "[KEY] - [CONCEPT]"
 */
export const formatConceptDisplay = (fileName) => {
    if (!fileName) return '';
    
    const { index } = appState.getState();
    const conceptId = fileName.replace('.json', '');
    const key = index?.[fileName] || '';
    
    return key ? `${key} - ${conceptId}` : conceptId;
};

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Checks if error indicates invalid/expired token
 * @param {Error} error - Error to check
 * @returns {boolean} True if error indicates token issue
 */
export const isTokenError = (error) => {
    return error.message?.includes('401') || 
           error.message?.includes('Unauthorized') ||
           error.message?.includes('token');
};

/**
 * Clears authentication state and session data
 * @param {string} sessionTokenKey - The session storage key for the token
 */
export const clearAuthenticationState = (sessionTokenKey) => {
    sessionStorage.removeItem(sessionTokenKey);
    appState.setState({ 
        isLoggedIn: false, 
        user: null,
        files: [],
        index: {}
    });
};

/**
 * Creates a debounced version of a function that delays execution until after delay milliseconds
 * have elapsed since the last time the debounced function was invoked
 * @param {Function} func - The function to debounce
 * @param {number} delay - The number of milliseconds to delay
 * @returns {Function} The debounced function
 */
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
};

/**
 * Converts API errors to user-friendly error messages
 * @param {Error} error - The error object from API call
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
    if (error.status === 404) return 'Repository not found or access denied';
    if (error.status === 403) return 'Insufficient permissions to access repository';
    if (error.status === 401) return 'Authentication required. Please log in again.';
    if (error.status === 500) return 'GitHub service temporarily unavailable';
    if (error.status === 422) return 'Invalid repository or file format';
    if (error.name === 'NetworkError') return 'Network connection error. Please check your internet connection.';
    return 'Unable to load repository contents. Please try again.';
};

/**
 * Shows a user notification message
 * @param {string} type - The type of notification ('error', 'success', 'warning', 'info')
 * @param {string} message - The message to display
 * @param {number} duration - How long to show the message (milliseconds), 0 for permanent
 */
export const showUserNotification = (type, message, duration = 5000) => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    
    notification.innerHTML = `
        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after duration (if not permanent)
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
};