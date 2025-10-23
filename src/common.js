import { getFiles, getConceptsByType } from './api.js';

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
    const watchers = new Map();
  
    const setState = (update) => {
      const prevState = state;
      const currSlice = typeof update === 'function' ? update(state) : update;
  
      if (currSlice !== state) {
        state = { ...state, ...currSlice };
        
        // Notify watchers of changed keys
        Object.keys(currSlice).forEach(key => {
          if (watchers.has(key) && prevState[key] !== state[key]) {
            watchers.get(key).forEach(callback => {
              try {
                callback(state[key], prevState[key]);
              } catch (error) {
                console.error(`State watcher error for key "${key}":`, error);
              }
            });
          }
        });
      }
    };
  
    const getState = () => state;
    
    const watch = (key, callback) => {
      if (!watchers.has(key)) {
        watchers.set(key, new Set());
      }
      watchers.get(key).add(callback);
      
      // Return unwatch function
      return () => {
        if (watchers.has(key)) {
          watchers.get(key).delete(callback);
          if (watchers.get(key).size === 0) {
            watchers.delete(key);
          }
        }
      };
    };
  
    return { setState, getState, watch };
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
 * @param {Object} field - The field configuration object
 * @param {string} field.referencesType - The type of concepts to reference
 * @param {boolean} field.required - Whether the field is required
 * @param {string} [prefix=''] - Optional prefix for field ID
 * @param {*} [initialValue=null] - Initial value to set after loading
 * @returns {string} HTML string for the dropdown
 */
export const createReferenceDropdown = (field, prefix = '', initialValue = null) => {
    
    const targetType = field.referencesType;
    const fieldId = prefix ? `${prefix}${field.id}` : field.id;
    
    // Create loading placeholder initially
    let dropdownHTML = `
        <select class="form-select" id="${fieldId}" ${field.required ? 'required' : ''} disabled>
            <option value="">Loading ${targetType} concepts...</option>
        </select>
        <div class="form-text text-info">Fetching available concepts...</div>
    `;
    
    // Asynchronously load concepts and update dropdown
    loadConceptsForDropdown(fieldId, targetType, field.required, initialValue);
    
    return dropdownHTML;
};

/**
 * Asynchronously loads concepts for a dropdown and updates the UI
 * @param {string} fieldId - The field ID to update
 * @param {string} targetType - The concept type to load
 * @param {boolean} isRequired - Whether the field is required
 * @param {*} initialValue - Initial value to set after loading
 */
const loadConceptsForDropdown = async (fieldId, targetType, isRequired, initialValue = null) => {
    try {
        const conceptFiles = getConceptsByType(targetType);
        
        const referencedConcepts = conceptFiles?.files.map(file => {
            const fileName = file.name;
            const displayValue = formatConceptDisplay(fileName);
            return { id: displayValue };
        }) || [];
        
        // Sort concepts for better UX
        referencedConcepts.sort((a, b) => a.id.localeCompare(b.id));
        
        // Update the dropdown element
        const selectElement = document.getElementById(fieldId);
        const helpTextElement = selectElement?.nextElementSibling;
        
        if (!selectElement) return; // Element not found, likely unmounted
        
        if (referencedConcepts.length === 0) {
            selectElement.innerHTML = `<option value="">No ${targetType} concepts available</option>`;
            selectElement.disabled = true;
            if (helpTextElement) {
                helpTextElement.className = 'form-text text-warning';
                helpTextElement.textContent = `You need to create a ${targetType} concept first`;
            }
            return;
        }
        
        // Handle RESPONSE type specially
        if (targetType === 'RESPONSE') {
            updateResponseDropdown(fieldId, referencedConcepts, initialValue);
        } else {
            updateStandardDropdown(fieldId, referencedConcepts, isRequired, initialValue);
        }
        
        if (helpTextElement) {
            helpTextElement.remove();
        }
        
    } catch (error) {
        console.error('Error loading concepts for dropdown:', error);
        const selectElement = document.getElementById(fieldId);
        const helpTextElement = selectElement?.nextElementSibling;
        
        if (selectElement) {
            selectElement.innerHTML = `<option value="">Error loading ${targetType} concepts</option>`;
            selectElement.disabled = true;
        }
        if (helpTextElement) {
            helpTextElement.className = 'form-text text-danger';
            helpTextElement.textContent = 'Failed to load concepts. Please try again.';
        }
    }
};

/**
 * Updates a standard dropdown with concepts
 */
const updateStandardDropdown = (fieldId, referencedConcepts, isRequired, initialValue = null) => {
    const selectElement = document.getElementById(fieldId);
    if (!selectElement) return;
    
    selectElement.innerHTML = `
        <option value="">${isRequired ? 'Select a concept' : 'None (optional)'}</option>
        ${referencedConcepts.map(option => `
            <option value="${option.id}">${option.id}</option>
        `).join('')}
    `;
    selectElement.disabled = false;
    
    // Set initial value if provided
    if (initialValue) {
        // Convert stored concept ID back to display format for edit mode
        const { index } = appState.getState();
        const matchingFile = Object.keys(index._files || {}).find(fileName => 
            fileName.replace('.json', '') === initialValue
        );
        if (matchingFile) {
            const displayValue = formatConceptDisplay(matchingFile);
            selectElement.value = displayValue;
        } else {
            // Fallback: try setting the raw value
            selectElement.value = initialValue;
        }
    }
};

/**
 * Updates a RESPONSE type dropdown with multi-select functionality
 */
const updateResponseDropdown = (fieldId, referencedConcepts, initialValue = null) => {
    const selectElement = document.getElementById(fieldId);
    if (!selectElement) return;
    
    const containerHTML = `
        <div class="dropdown-container">
            <div class="form-control d-flex flex-wrap align-items-center" 
                id="${fieldId}_container" role="button" data-bs-toggle="dropdown" 
                aria-expanded="false">
                <span class="dropdown-text">Select Responses</span>
            </div>
            
            <div class="dropdown-menu p-2 w-100" aria-labelledby="${fieldId}_container">
                <div class="response-options" style="max-height: 200px; overflow-y: auto;">
                    ${referencedConcepts.map(option => `
                        <div class="form-check">
                            <input class="form-check-input response-checkbox" type="checkbox" 
                                value="${option.id}" id="${fieldId}_${option.id}">
                            <label class="form-check-label w-100" for="${fieldId}_${option.id}">
                                ${option.id}
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div id="${fieldId}_pills" class="selected-pills d-flex flex-wrap mt-2"></div>
            <input type="hidden" id="${fieldId}" value="[]">
        </div>
    `;
    
    selectElement.outerHTML = containerHTML;
    
    // Setup response dropdown functionality
    setupResponseDropdownEvents(fieldId);
    
    // Set initial values if provided (for RESPONSE multi-select)
    if (initialValue && Array.isArray(initialValue)) {
        setTimeout(() => {
            const { index } = appState.getState();
            initialValue.forEach(conceptId => {
                // Convert concept ID to display format to find matching checkbox
                const matchingFile = Object.keys(index._files || {}).find(fileName => 
                    fileName.replace('.json', '') === conceptId
                );
                if (matchingFile) {
                    const displayValue = formatConceptDisplay(matchingFile);
                    const checkbox = document.getElementById(`${fieldId}_${displayValue}`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                }
            });
            
            // Trigger update to show pills
            updateResponseSelection(fieldId);
        }, 50);
    }
};

/**
 * Sets up event handlers for response dropdown functionality
 */
const setupResponseDropdownEvents = (fieldId) => {
    const container = document.getElementById(`${fieldId}_container`);
    const pillsContainer = document.getElementById(`${fieldId}_pills`);
    const hiddenInput = document.getElementById(fieldId);
    const checkboxes = document.querySelectorAll(`input[id^="${fieldId}_"][type="checkbox"]`);
    
    if (!container || !pillsContainer || !hiddenInput) return;
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateResponseSelection(fieldId);
        });
    });
};

/**
 * Updates the response selection display and hidden input
 */
const updateResponseSelection = (fieldId) => {
    const pillsContainer = document.getElementById(`${fieldId}_pills`);
    const hiddenInput = document.getElementById(fieldId);
    const checkboxes = document.querySelectorAll(`input[id^="${fieldId}_"][type="checkbox"]:checked`);
    
    if (!pillsContainer || !hiddenInput) return;
    
    const selectedValues = Array.from(checkboxes).map(cb => cb.value);
    
    // Update pills display
    pillsContainer.innerHTML = selectedValues.map(value => `
        <span class="badge bg-secondary response-pill">
            ${value}
            <button type="button" class="btn-close btn-close-white ms-1" 
                onclick="removeResponsePill('${fieldId}', '${value}')"></button>
        </span>
    `).join('');
    
    // Update hidden input
    hiddenInput.value = JSON.stringify(selectedValues);
    
    // Update dropdown text
    const container = document.getElementById(`${fieldId}_container`);
    const dropdownText = container?.querySelector('.dropdown-text');
    if (dropdownText) {
        dropdownText.textContent = selectedValues.length > 0 
            ? `${selectedValues.length} Response${selectedValues.length !== 1 ? 's' : ''} Selected`
            : 'Select Responses';
    }
};

// Make removeResponsePill globally available
window.removeResponsePill = (fieldId, value) => {
    const checkbox = document.getElementById(`${fieldId}_${value}`);
    if (checkbox) {
        checkbox.checked = false;
        updateResponseSelection(fieldId);
    }
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

        // concept checking shouldn't be needed
        switch (field.type) {
                
            case 'reference':
                // Handle both single-select and multi-select reference fields
                if (fieldElement.value) {
                    // Check if this is a multi-select field (RESPONSE type with pills)
                    if (field.referencesType === 'RESPONSE') {
                        try {
                            // Parse the JSON array of selected items
                            const selectedItems = JSON.parse(fieldElement.value);
                            if (Array.isArray(selectedItems)) {
                                // Extract concepts from each selected item
                                payload[field.id] = selectedItems.map(item => extractConcept(item));
                            } 
                        } catch (e) {
                            console.error('Error parsing multi-select reference value:', e);
                        }
                    } else {
                        // Single-select reference field - extract one concept
                        payload[field.id] = extractConcept(fieldElement.value);
                    }
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
    const fileData = index._files?.[fileName];
    const key = fileData?.key || '';
    
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