/**
 * Modal Management Module
 * 
 * @module modals
 * @description Provides modal dialog functionality for concept management, file operations,
 * configuration settings, and repository interactions. All modals share common utilities
 * and consistent error handling patterns.
 * 
 * @requires common - Utility functions and state management
 * @requires api - GitHub API interaction functions
 * @requires homepage - Homepage rendering and refresh functions
 * @requires config - Modal configuration constants
 */

import { showAnimation, hideAnimation, getFileContent, appState, createReferenceDropdown, validateFormFields, showUserNotification } from './common.js';
import { addFile, deleteFile, addFolder, getConcept, getFiles, updateFile } from './api.js';
import { refreshHomePage } from './homepage.js';
import { MODAL_CONFIG } from './config.js';
import { MODAL_TEMPLATES, FORM_UTILS } from './templates.js';

/**
 * Common modal utilities for consistent modal management
 */
const ModalUtils = {
    /**
     * Gets modal elements and validates they exist
     * @function getModalElements
     * @returns {Object} Object containing modal, header, body, and footer elements
     * @throws {Error} Throws error if modal elements are not found
     */
    getModalElements() {
        const modal = document.querySelector(MODAL_CONFIG.MODAL_SELECTOR);
        if (!modal) {
            throw new Error(`Modal element ${MODAL_CONFIG.MODAL_SELECTOR} not found`);
        }
        
        return {
            modal,
            header: modal.querySelector('.modal-header'),
            body: modal.querySelector('.modal-body'),
            footer: modal.querySelector('.modal-footer')
        };
    },

    /**
     * Sets up basic modal structure with title
     * @function setupModal
     * @param {string} title - Modal title text
     * @returns {Object} Object containing modal elements
     * @throws {Error} Throws error if modal setup fails
     */
    setupModal(title) {
        const elements = this.getModalElements();
        
        elements.header.innerHTML = `<h5 class="modal-title">${title}</h5>`;
        elements.body.innerHTML = '';
        elements.footer.innerHTML = '';
        
        return elements;
    },

    /**
     * Shows the modal with Bootstrap modal component
     * @function showModal
     * @param {HTMLElement} modal - Modal element to show
     * @returns {bootstrap.Modal} Bootstrap modal instance
     */
    showModal(modal) {
        return new bootstrap.Modal(modal).show();
    },

    /**
     * Hides the modal and cleans up Bootstrap modal instance
     * @function hideModal
     * @param {HTMLElement} modal - Modal element to hide
     */
    hideModal(modal) {
        const modalInstance = bootstrap.Modal.getInstance(modal);
        if (modalInstance) {
            modalInstance.hide();
        }
    },

    /**
     * Creates standard modal footer with buttons
     * @function createFooter
     * @param {Array} buttons - Array of button configurations
     * @returns {string} HTML string for modal footer
     */
    createFooter(buttons) {
        const buttonElements = buttons.map(btn => 
            `<button type="button" class="btn ${btn.class}" ${btn.attributes || ''}>${btn.text}</button>`
        ).join('');
        
        return `<div class="w-100 d-flex justify-content-between">
            <div></div>
            <div>${buttonElements}</div>
        </div>`;
    },

    /**
     * Handles modal errors with user feedback
     * @function handleModalError
     * @param {Error} error - Error object
     * @param {string} operation - Description of failed operation
     * @param {HTMLElement} modal - Modal element for cleanup
     */
    handleModalError(error, operation, modal) {
        console.error(`${operation} failed:`, error);
        showUserNotification('error', `${operation} failed: ${error.message}`);
        hideAnimation();
        
        if (modal) {
            this.hideModal(modal);
        }
    },

    /**
     * Validates form fields and shows user feedback
     * @function validateFormField
     * @param {string} fieldId - ID of field to validate
     * @param {*} value - Value to validate
     * @param {string} errorMessage - Error message to show
     * @returns {boolean} True if valid, false if invalid
     */
    validateFormField(fieldId, value, errorMessage) {
        const fieldElement = document.getElementById(fieldId);
        if (!fieldElement) return false;
        
        const isValid = value && value.toString().trim() !== '';
        
        if (!isValid) {
            fieldElement.classList.add('is-invalid');
            let errorElement = document.getElementById(`${fieldId}-error`);
            
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.id = `${fieldId}-error`;
                errorElement.className = 'invalid-feedback';
                fieldElement.parentNode.appendChild(errorElement);
            }
            
            errorElement.textContent = errorMessage;
            fieldElement.focus();
        } else {
            fieldElement.classList.remove('is-invalid');
        }
        
        return isValid;
    },

    /**
     * Creates a loading state for modal operations
     * @function showLoadingState
     * @param {HTMLElement} button - Button element to show loading state
     * @param {string} loadingText - Text to show during loading
     */
    showLoadingState(button, loadingText = 'Processing...') {
        if (!button) return;
        
        button.disabled = true;
        button.originalText = button.textContent;
        button.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            ${loadingText}
        `;
    },

    /**
     * Restores button from loading state
     * @function hideLoadingState
     * @param {HTMLElement} button - Button element to restore
     */
    hideLoadingState(button) {
        if (!button || !button.originalText) return;
        
        button.disabled = false;
        button.textContent = button.originalText;
        delete button.originalText;
    }
};

/**
 * Renders a modal for adding new concepts with dynamic form fields based on concept type
 * 
 * @async
 * @function renderAddModal
 * 
 * @returns {Promise<void>} Resolves when modal is rendered and event listeners are attached
 * @throws {Error} Throws error if concept retrieval, modal setup, or form validation fails
 */
export const renderAddModal = async () => {
    try {
        console.log(appState.getState());
        const { modal, header, body, footer } = ModalUtils.setupModal('Add Concept');

        const concept = await getConcept();

        // Use template for concept type selector and form containers
        body.innerHTML = `
            ${MODAL_TEMPLATES.conceptTypeSelector(MODAL_CONFIG.CONCEPT_TYPES)}
            ${MODAL_TEMPLATES.dynamicFieldContainers()}
        `;

        // Use template for modal footer
        footer.innerHTML = MODAL_TEMPLATES.footer([
            { text: 'Cancel', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY, attributes: 'data-bs-dismiss="modal"' },
            { text: 'Save', class: MODAL_CONFIG.MODAL_CLASSES.SUCCESS }
        ]);

        // Function to render template fields based on selected type
        const renderTemplateFields = (type) => {
            const templateFields = document.getElementById('templateFields');
            templateFields.innerHTML = '';

            const conceptTemplates = appState.getState().config;
            
            conceptTemplates[type].forEach(field => {
                const fieldRow = document.createElement('div');
                fieldRow.classList.add('row', 'mb-3');

                let fieldHTML;

                switch (field.type) {
                    case 'concept':
                        fieldHTML = `
                            <input type="text" class="form-control" id="${field.id}" value="${concept}" readonly>
                        `;
                        break;
                    case 'reference':
                        fieldHTML = createReferenceDropdown(field);
                        break;
                    default:
                        fieldHTML = `<input type="${field.type}" class="form-control" id="${field.id}">`;
                }

                fieldRow.innerHTML = `
                    <div class="col-4">
                        <label for="${field.id}" class="col-form-label">${field.label}</label>
                    </div>
                    <div class="col-8">
                        ${fieldHTML}
                    </div>
                `;
                
                templateFields.appendChild(fieldRow);
            });
        };

        // Show the modal
        ModalUtils.showModal(modal);

        // Render the default template (PRIMARY)
        renderTemplateFields('PRIMARY');
        
        // Add event listener for type change
        document.getElementById('conceptType').addEventListener('change', (e) => {
            renderTemplateFields(e.target.value);

            if (e.target.value === 'QUESTION') {
                setTimeout(setupResponseMultiSelect, 100);
            }
        });

        // Add event listener for the Save button
        const confirmButton = modal.querySelector('.btn-outline-success');
        confirmButton.addEventListener('click', async () => {
            // Collect all the fields into a payload object
            const payload = {
                'object_type': document.getElementById('conceptType').value,
            };

            // Get Concept ID and Key
            const conceptId = document.getElementById('conceptId').value.trim();
            const key = document.getElementById('key').value.trim();
            const keyInput = document.getElementById('key');

            // Validate required fields
            if (!conceptId || !key) {
                alert('Concept ID and Key are required.');
                return;
            }

            const { index } = appState.getState();
            const existingKeys = Object.values(index);
            const keyExists = existingKeys.some(existingKey => 
                existingKey.toLowerCase() === key.toLowerCase()
            );

            if (keyExists) {
                keyInput.classList.add('is-invalid');
                let errorMessage = document.getElementById('key-error');
                if (!errorMessage) {
                    errorMessage = document.createElement('div');
                    errorMessage.id = 'key-error';
                    errorMessage.className = 'invalid-feedback';
                    keyInput.parentNode.appendChild(errorMessage);
                }
                errorMessage.textContent = 'This key already exists. Please use a unique key.';
            
                keyInput.focus();
                return;
            }

            keyInput.classList.remove('is-invalid');

            payload['conceptId'] = conceptId;
            payload['key'] = key;

            const conceptTemplates = appState.getState().config;
            const validForm = validateFormFields(payload, conceptTemplates[document.getElementById('conceptType').value]);

            if (!validForm) {
                alert('Please fill in all required fields.');
                return;
            }

            // Prepare the file path and content
            const path = `${conceptId}.json`;
            const content = JSON.stringify(payload, null, 2); // Pretty-print JSON with indentation

            // Show loading animation (assuming this function exists)
            showAnimation();

            // Add the file (assuming addFile is defined elsewhere)
            try {
                await addFile(path, content);
                // Hide the modal
                bootstrap.Modal.getInstance(modal).hide();
                // Refresh the home page (assuming renderHomePage is defined elsewhere)
                refreshHomePage();
            } catch (error) {
                console.error('Error adding file:', error);
                alert('An error occurred while saving the concept.');
            } finally {
                // Hide loading animation
                hideAnimation();
            }
        });
        } catch (error) {
            ModalUtils.handleModalError(error, 'Add concept modal setup', modal);
        }
}

const setupResponseMultiSelect = () => {
    const container = document.getElementById('responses_container');
    const pillsContainer = document.getElementById('responses_pills');
    const hiddenInput = document.getElementById('responses');
    const checkboxes = document.querySelectorAll('.response-checkbox');

    const updatePills = () => {
        // Clear existing pills
        pillsContainer.innerHTML = '';
        
        // Get all checked checkboxes
        const selectedOptions = [];
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const optionId = checkbox.value;
                const optionLabel = checkbox.nextElementSibling.textContent.trim();
                selectedOptions.push({ id: optionId, label: optionLabel });
                
                // Create a pill for this selection
                const pill = document.createElement('span');
                pill.className = 'response-pill';
                pill.innerHTML = `
                    ${optionLabel}
                    <span class="pill-remove" data-id="${optionId}">&times;</span>
                `;
                pillsContainer.appendChild(pill);
            }
        });
        
        // Update hidden input with JSON array of IDs
        hiddenInput.value = JSON.stringify(selectedOptions.map(opt => opt.id));
    };
    
    // Add event listeners to checkboxes
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updatePills);
    });

    // Click handler for pill remove buttons
    pillsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill-remove')) {
            const optionId = e.target.getAttribute('data-id');
            const checkbox = document.getElementById(`responses_${optionId}`);
            if (checkbox) {
                checkbox.checked = false;
                updatePills();
            }
        }
    });
}

/**
 * Renders a confirmation modal for deleting files from the repository
 * 
 * @function renderDeleteModal
 * 
 * @param {Event} event - Click event from delete button containing file metadata
 * @throws {Error} Throws error if file deletion fails or modal setup fails
 */
export const renderDeleteModal = (event) => {
    try {
        const button = event.target;
        const file = button.getAttribute('data-bs-file');

        const { modal, header, body, footer } = ModalUtils.setupModal('Delete File');

        // Use template for confirmation dialog
        body.innerHTML = MODAL_TEMPLATES.confirmationDialog('Are you sure you want to delete', file);

        // Use template for modal footer
        footer.innerHTML = MODAL_TEMPLATES.footer([
            { text: 'Cancel', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY, attributes: 'data-bs-dismiss="modal"' },
            { text: 'Confirm', class: MODAL_CONFIG.MODAL_CLASSES.DANGER }
        ]);

        ModalUtils.showModal(modal);

    // add event listener for confirm button
    const confirmButton = modal.querySelector('.btn-outline-danger');
    confirmButton.addEventListener('click', async () => {
        
        showAnimation();
        
        const sha = button.getAttribute('data-bs-sha');
        await deleteFile(file, sha);

        bootstrap.Modal.getInstance(modal).hide();

        refreshHomePage();
        hideAnimation();
    });
    } catch (error) {
        ModalUtils.handleModalError(error, 'Delete confirmation modal', modal);
    }
}

/**
 * Renders a modal for viewing and editing concept files with dynamic field rendering
 * 
 * @async
 * @function renderViewModal
 * 
 * @param {Event} event - Click event from view button containing file metadata
 * @returns {Promise<void>} Resolves when modal is rendered with concept data
 * @throws {Error} Throws error if file retrieval, parsing, or modal rendering fails
 */
export const renderViewModal = async (event) => {
    showAnimation();
    
    try {
        const button = event.target;
        const file = button.getAttribute('data-bs-file');
        const { modal, header, body, footer } = ModalUtils.getModalElements();
        
        const { content } = await getFileContent(file);
        
        // Validate that we have content and it's a proper concept
        if (!content || typeof content !== 'object') {
            throw new Error('Invalid concept data');
        }
        
        const { config, repo } = appState.getState();
        const conceptType = content['object_type'] || 'PRIMARY'; // Default to PRIMARY if not specified
        const typeConfig = config[conceptType] || [];

        const hasWritePermission = repo.permissions.push;

        modal.originalData = content;
        modal.isEditMode = false;

        const renderModalContent = () => {
            // Render header with badge showing concept type
            header.innerHTML = `
                <h5 class="modal-title d-flex align-items-center">
                    ${modal.isEditMode ? 'Edit' : 'View'} Concept 
                    <span class="badge bg-primary ms-2">${conceptType}</span>
                </h5>
            `;

            // Clear modal body
            body.innerHTML = '';
            
            // Create container for concept content
            const contentContainer = document.createElement('div');
            contentContainer.classList.add('concept-container');
            
            if (modal.isEditMode) {
                // EDIT MODE - Show all configured fields
                renderEditMode(contentContainer, content, typeConfig);
            } else {
                // VIEW MODE - Only show fields with values
                renderViewMode(contentContainer, content, typeConfig);
            }
            
            // Add the container to the modal body
            body.appendChild(contentContainer);
            
            // Set up footer buttons based on mode
            if (modal.isEditMode) {
                footer.innerHTML = MODAL_TEMPLATES.footer([
                    { text: 'Cancel', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY, attributes: 'id="cancelButton"' },
                    { text: 'Save Changes', class: MODAL_CONFIG.MODAL_CLASSES.SUCCESS, attributes: 'id="saveButton"' }
                ]);
                
                // Add event listeners for edit mode
                document.getElementById('cancelButton').addEventListener('click', () => {
                    // Switch back to view mode without saving
                    modal.isEditMode = false;
                    renderModalContent();
                });
                
                document.getElementById('saveButton').addEventListener('click', async () => {
                    // Collect edited data and save
                    await saveEditedConcept(content, typeConfig, file);
                });
            } else {
                footer.innerHTML = MODAL_TEMPLATES.footer([
                    { text: 'Close', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY, attributes: 'id="closeButton"' },
                    { text: 'Edit', class: MODAL_CONFIG.MODAL_CLASSES.PRIMARY, attributes: 'id="editButton" disabled' }
                ]);
                
                // Add event listeners for view mode
                document.getElementById('closeButton').addEventListener('click', () => {
                    bootstrap.Modal.getInstance(modal).hide();
                });

                if (hasWritePermission) {
                    document.getElementById('editButton').removeAttribute('disabled');
                }

                document.getElementById('editButton').addEventListener('click', () => {
                    // Switch to edit mode
                    modal.isEditMode = true;
                    renderModalContent();
                });
            }
        };

        renderModalContent();

        new bootstrap.Modal(modal).show();

    } catch (error) {
        console.error('Error fetching file:', error);
        
        // Show user-friendly error message using template
        body.innerHTML = MODAL_TEMPLATES.errorAlert('Error Loading Concept', error.message, `File: ${file}`);

        footer.innerHTML = MODAL_TEMPLATES.footer([
            { text: 'Close', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY, attributes: 'onclick="bootstrap.Modal.getInstance(this.closest(\'.modal\')).hide()"' }
        ]);        
        
        ModalUtils.showModal(modal);
    } finally {
        hideAnimation();
    }
}

/**
 * Renders view mode display for concept data with organized field sections
 * 
 * @function renderViewMode
 * 
 * @param {HTMLElement} container - Container element to render content into
 * @param {Object} content - Concept data to display
 * @param {Array<Object>} typeConfig - Field configuration for proper rendering
 * @returns {void}
 * @throws {Error} Throws error if rendering fails
 */
function renderViewMode(container, content, typeConfig) {
    // Add styling for view mode
    container.innerHTML = `
        <style>
            .field-group {
                padding: 12px 15px;
                border-bottom: 1px solid #eee;
            }
            .field-group:last-child {
                border-bottom: none;
            }
            .field-label {
                color: #495057;
                font-weight: 500;
                margin-bottom: 4px;
            }
            .field-value {
                padding: 6px 0;
            }
            .badge-reference {
                background-color: #6c757d;
            }
            .badge-array {
                background-color: #f8f9fa;
                color: #212529;
                border: 1px solid #dee2e6;
            }
            .metadata-section {
                background-color: #f8f9fa;
                border-radius: 5px;
                padding: 12px;
                margin-top: 15px;
            }
            .section-header {
                margin-bottom: 10px;
                padding-bottom: 6px;
                border-bottom: 1px solid #e9ecef;
                color: #6c757d;
                font-weight: 500;
            }
        </style>
    `;

    // Create sections based on field types
    const coreFields = document.createElement('div');
    coreFields.className = 'core-fields';
    
    const referenceFields = document.createElement('div');
    referenceFields.className = 'reference-fields';
    
    const otherFields = document.createElement('div');
    otherFields.className = 'other-fields';

    // Track which fields have been displayed
    const displayedFields = new Set();
    
    // First, display fields according to the configuration
    if (typeConfig.length > 0) {
        typeConfig.forEach(field => {
            // Only show fields that have values
            if (content[field.id] !== undefined && content[field.id] !== null && content[field.id] !== '') {
                const fieldValue = content[field.id];
                const fieldGroup = document.createElement('div');
                fieldGroup.className = 'field-group';
                
                let fieldHTML = '';
                
                // Format different field types
                switch (field.type) {
                    case 'concept':
                        fieldHTML = `<div class="field-value concept-id">${fieldValue}</div>`;
                        coreFields.appendChild(fieldGroup);
                        break;
                    case 'reference':
                        fieldHTML = `<div class="field-value"><span class="badge badge-reference">${fieldValue}</span></div>`;
                        referenceFields.appendChild(fieldGroup);
                        break;
                    case 'array':
                        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
                            fieldHTML = `<div class="field-value">${fieldValue.map(item => 
                                `<span class="badge badge-array me-1 mb-1">${item}</span>`
                            ).join('')}</div>`;
                        } else if (typeof fieldValue === 'string') {
                            fieldHTML = `<div class="field-value">${fieldValue}</div>`;
                        }
                        otherFields.appendChild(fieldGroup);
                        break;
                    default:
                        fieldHTML = `<div class="field-value">${fieldValue}</div>`;
                        
                        // Add core fields to their section, others to the other section
                        if (field.id === 'key' || field.id === 'conceptId') {
                            coreFields.appendChild(fieldGroup);
                        } else {
                            otherFields.appendChild(fieldGroup);
                        }
                }
                
                // Add label and value to the field group
                fieldGroup.innerHTML = `
                    <div class="field-label">${field.label}</div>
                    ${fieldHTML}
                `;
                
                displayedFields.add(field.id);
            }
        });
    }
    
    // Add sections to container if they have content
    if (coreFields.children.length > 0) {
        const coreHeader = document.createElement('div');
        coreHeader.className = 'section-header mt-4';
        coreHeader.innerHTML = '<h6>Core Fields</h6>';
        container.appendChild(coreHeader);
        container.appendChild(coreFields);
    }
    
    if (referenceFields.children.length > 0) {
        // Add a section header
        const referenceHeader = document.createElement('div');
        referenceHeader.className = 'section-header mt-4';
        referenceHeader.innerHTML = '<h6>References</h6>';
        container.appendChild(referenceHeader);
        container.appendChild(referenceFields);
    }

    if (otherFields.children.length > 0 && otherFields.querySelector(':not(.metadata-section)')) {
        // Add a section header for other fields (not including metadata)
        const otherHeader = document.createElement('div');
        otherHeader.className = 'section-header mt-4';
        otherHeader.innerHTML = '<h6>Other Fields</h6>';
        container.appendChild(otherHeader);
        container.appendChild(otherFields);
    }
}

/**
 * Renders edit mode form for concept data with all configured fields
 * 
 * @function renderEditMode
 * 
 * @param {HTMLElement} container - Container element to render form into
 * @param {Object} content - Current concept data for pre-population
 * @param {Array<Object>} typeConfig - Field configuration for form generation
 * @returns {void}
 * @throws {Error} Throws error if form rendering fails
 */
function renderEditMode(container, content, typeConfig) {
    container.innerHTML = `
        ${MODAL_TEMPLATES.infoAlert('Editing concept. All configured fields are shown below.')}
        <form id="editConceptForm">
            <div class="edit-fields"></div>
        </form>
    `;
    
    const editFields = container.querySelector('.edit-fields');
    
    // Render all configured fields using form utilities
    typeConfig.forEach(field => {
        const fieldValue = content[field.id] !== undefined ? content[field.id] : '';
        
        // Handle reference fields specially (still need createReferenceDropdown)
        if (field.type === 'reference') {
            const fieldRow = document.createElement('div');
            fieldRow.innerHTML = FORM_UTILS.generateFormField(field, fieldValue, 'edit');

            // Replace the select with reference dropdown
            const selectElement = fieldRow.querySelector('select');
            if (selectElement) {
                selectElement.outerHTML = createReferenceDropdown(field);
                // Set the selected value after rendering
                setTimeout(() => {
                    const newSelectElement = document.getElementById(`edit_${field.id}`);
                    if (newSelectElement) {
                        newSelectElement.value = fieldValue;
                    }
                }, 0);
            }
            editFields.appendChild(fieldRow);
        } else {
            // Use form utility for other field types
            const fieldHTML = FORM_UTILS.generateFormField(field, fieldValue, 'edit');
            const fieldRow = document.createElement('div');
            fieldRow.innerHTML = fieldHTML;
            editFields.appendChild(fieldRow);
        }
    });
}

/**
 * Creates a formatted row for displaying field data in view mode
 * 
 * @function createFieldRow
 * 
 * @param {string} key - Field name/label
 * @param {*} value - Field value to display
 * @param {Object|null} fieldConfig - Optional field configuration for type-specific formatting
 * @returns {HTMLElement} DOM element containing the formatted field row
 * @throws {Error} Throws error if row creation fails
 */
function createFieldRow(key, value, fieldConfig = null) {
    const row = document.createElement('div');
    row.classList.add('row', 'mb-3', 'align-items-center');
    
    // Format the value based on its type
    let formattedValue = value;
    
    if (fieldConfig) {
        // Format based on field type
        switch (fieldConfig.type) {
            case 'reference':
                // Format reference fields specially
                formattedValue = `<span class="badge bg-secondary">${value}</span>`;
                break;
                
            case 'array':
                // Format arrays
                if (Array.isArray(value)) {
                    formattedValue = value.map(item => 
                        `<span class="badge bg-light text-dark me-1 mb-1">${item}</span>`
                    ).join('');
                }
                break;
        }
    } else {
        // Format based on value type if no field config
        if (Array.isArray(value)) {
            formattedValue = value.map(item => 
                `<span class="badge bg-light text-dark me-1 mb-1">${item}</span>`
            ).join('');
        } else if (typeof value === 'object' && value !== null) {
            formattedValue = `<pre class="mb-0">${JSON.stringify(value, null, 2)}</pre>`;
        }
    }
    
    row.innerHTML = `
        <div class="col-4">
            <strong>${key}</strong>
        </div>
        <div class="col-8">
            <div class="form-control-plaintext">${formattedValue}</div>
        </div>
    `;
    
    return row;
}

/**
 * Renders a modal showing file upload progress with real-time status updates
 * 
 * @async
 * @function renderUploadModal
 * 
 * @param {Array<Object>} files - Array of file objects with name and content properties
 * @returns {Promise<void>} Resolves when all uploads are complete and modal is shown
 * @throws {Error} Throws error if modal setup or file upload fails
 */
export const renderUploadModal = async (files) => {
    try {
        // Validate input
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error('No files provided for upload');
        }

        const { modal, header, body, footer } = ModalUtils.setupModal('Uploading Files');

        // Clear previous content  
        body.innerHTML = '';

        // Array to hold file rows for status updates
        const fileRows = [];

        // Create file rows in the modal body using templates
        files.forEach((file) => {
            const fileRow = document.createElement('div');
            fileRow.innerHTML = MODAL_TEMPLATES.uploadProgressItem(file.name);
            body.appendChild(fileRow);
            fileRows.push({ file, fileRow });
        });

        // Modal footer using template
        footer.innerHTML = MODAL_TEMPLATES.footer([
            { text: 'Close', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY }
        ]);

        // Show the modal
        ModalUtils.showModal(modal);

        // Upload files sequentially
        for (const { file, fileRow } of fileRows) {
            // Update status to "Processing..." using template
            const statusIndicator = fileRow.querySelector('.status-indicator');
            statusIndicator.innerHTML = MODAL_TEMPLATES.uploadStatus.processing();

            try {
                await addFile(file.name, file.content);
                // On success, update the status indicator using template
                statusIndicator.innerHTML = MODAL_TEMPLATES.uploadStatus.success();
            } catch (error) {
                // On failure, update the status indicator using template
                statusIndicator.innerHTML = MODAL_TEMPLATES.uploadStatus.failed();
                console.error(`Failed to upload ${file.name}:`, error);
            }
        }

        // add event listener for save button
        const closeButton = modal.querySelector('.btn-outline-secondary');
        closeButton.addEventListener('click', async () => {
            bootstrap.Modal.getInstance(modal).hide();

            await refreshHomePage();
        });
    } catch (error) {
        ModalUtils.handleModalError(error, 'File upload modal', modal);
    }
}

/**
 * Renders a modal for creating new folders in the repository
 * 
 * @function renderAddFolderModal
 * 
 * @returns {void}
 * @throws {Error} Throws error if modal setup or folder creation fails
 */
export const renderAddFolderModal = () => {
    try {
        const { modal, header, body, footer } = ModalUtils.setupModal('Add Folder');

        // Initialize the modal body with Folder Name field using form utility
        const folderNameField = { id: 'folderName', label: 'Folder Name', required: true, type: 'text' };
        body.innerHTML = FORM_UTILS.generateFormField(folderNameField);

        // Update the modal footer using template
        footer.innerHTML = MODAL_TEMPLATES.footer([
            { text: 'Cancel', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY, attributes: 'data-bs-dismiss="modal"' },
            { text: 'Create', class: MODAL_CONFIG.MODAL_CLASSES.SUCCESS }
        ]);

    // Show the modal
    new bootstrap.Modal(modal).show();

    // Add event listener for the Create button
    const createButton = modal.querySelector('.btn-outline-success');
    createButton.addEventListener('click', async () => {
        // Get the folder name
        const folderName = document.getElementById('folderName').value.trim();

        // Validate the folder name
        if (!folderName) {
            alert('Folder Name is required.');
            return;
        }

        // Optional: Validate folder name for illegal characters
        const illegalChars = /[\\/:*?"<>|]/;
        if (illegalChars.test(folderName)) {
            alert('Folder Name contains illegal characters.');
            return;
        }

        // Show loading animation (assuming this function exists)
        showAnimation();

        // Create the folder (assuming addFolder is defined elsewhere)
        try {
            await addFolder(folderName);
            // Hide the modal
            bootstrap.Modal.getInstance(modal).hide();
            // Refresh the home page (assuming renderHomePage is defined elsewhere)
            refreshHomePage();
        } catch (error) {
            console.error('Error creating folder:', error);
            alert('An error occurred while creating the folder.');
        } finally {
            // Hide loading animation
            hideAnimation();
        }
    });
    } catch (error) {
        ModalUtils.handleModalError(error, 'Add folder modal setup', modal);
    }
}

/**
 * Renders a comprehensive configuration modal for managing concept field definitions
 * 
 * @async
 * @function renderConfigModal
 * 
 * @returns {Promise<void>} Resolves when modal is rendered and configuration is loaded
 * @throws {Error} Throws error if configuration loading, parsing, or saving fails
 */
export const renderConfigModal = async () => {
    try {
        const { modal, header, body, footer } = ModalUtils.setupModal('Configuration Settings');
    
        // Get current config from appState
        const { config } = appState.getState();
    
        // Use template for configuration tabs
        body.innerHTML = MODAL_TEMPLATES.configurationTabs(
            MODAL_CONFIG.CONCEPT_TYPES,
            (type) => FORM_UTILS.generateConfigTable(type, config[type] || [], MODAL_CONFIG.CONCEPT_TYPES)
        );
        
        // Set up the modal footer using template
        footer.innerHTML = MODAL_TEMPLATES.footer([
            { text: 'Cancel', class: MODAL_CONFIG.MODAL_CLASSES.SECONDARY, attributes: 'data-bs-dismiss="modal"' },
            { text: 'Save Changes', class: MODAL_CONFIG.MODAL_CLASSES.PRIMARY, attributes: 'id="saveConfigBtn"' }
        ]);
    
    // Show the modal
    new bootstrap.Modal(modal).show();
    
    // Attach event listeners for adding new fields
    document.querySelectorAll('.add-field-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.closest('button').getAttribute('data-type');
            const tableBody = document.getElementById(`${type.toLowerCase()}-fields`);
            
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td><input type="text" class="form-control form-control-sm field-id" value=""></td>
                <td><input type="text" class="form-control form-control-sm field-label" value=""></td>
                <td>
                    <select class="form-select form-select-sm field-type">
                        <option value="text">text</option>
                        <option value="concept">concept</option>
                        <option value="reference">reference</option>
                        <option value="array">array</option>
                        <option value="textarea">textarea</option>
                    </select>
                </td>
                <td>
                    <div class="form-check">
                        <input class="form-check-input field-required" type="checkbox">
                    </div>
                </td>
                <td>
                    <select class="form-select form-select-sm field-reference-type" disabled>
                        <option value="">None</option>
                        <option value="PRIMARY">PRIMARY</option>
                        <option value="SECONDARY">SECONDARY</option>
                        <option value="SOURCE">SOURCE</option>
                        <option value="QUESTION">QUESTION</option>
                        <option value="RESPONSE">RESPONSE</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger delete-field-btn">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(newRow);
            
            // Enable/disable reference type selector based on field type
            const typeSelect = newRow.querySelector('.field-type');
            const refTypeSelect = newRow.querySelector('.field-reference-type');
            
            typeSelect.addEventListener('change', () => {
                refTypeSelect.disabled = typeSelect.value !== 'reference';
            });
            
            // Add delete event listener
            newRow.querySelector('.delete-field-btn').addEventListener('click', () => {
                tableBody.removeChild(newRow);
            });
        });
    });
    
    // Attach event listeners to existing field type selectors
    document.querySelectorAll('.field-type').forEach(select => {
        select.addEventListener('change', (e) => {
            const row = e.target.closest('tr');
            const refTypeSelect = row.querySelector('.field-reference-type');
            refTypeSelect.disabled = select.value !== 'reference';
        });
    });
    
    // Attach event listeners to delete buttons
    document.querySelectorAll('.delete-field-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            row.parentNode.removeChild(row);
        });
    });
    
    // Save button event listener
    document.getElementById('saveConfigBtn').addEventListener('click', async () => {
        showAnimation();
        
        try {
            // Build new config object from UI
            const newConfig = {};
            
            conceptTypes.forEach(type => {
                newConfig[type] = [];
                
                const fieldRows = document.querySelectorAll(`#${type.toLowerCase()}-fields tr`);
                fieldRows.forEach(row => {
                    const id = row.querySelector('.field-id').value.trim();
                    const label = row.querySelector('.field-label').value.trim();
                    const fieldType = row.querySelector('.field-type').value;
                    const required = row.querySelector('.field-required').checked;
                    const referenceType = row.querySelector('.field-reference-type').value;
                    
                    // Skip empty rows
                    if (!id || !label) return;
                    
                    const fieldConfig = {
                        id,
                        label,
                        type: fieldType,
                        required
                    };
                    
                    // Add reference type if applicable
                    if (fieldType === 'reference' && referenceType) {
                        fieldConfig.referencesType = referenceType;
                    }
                    
                    newConfig[type].push(fieldConfig);
                });
            });

            console.log(newConfig);
            
            // Save to a config file in the repository
            const file = await getFiles('config.json');
            await updateFile(file.data.path, JSON.stringify(newConfig, null, 2), file.data.sha);
            
            // Update appState
            appState.setState({ config: newConfig });
            
            // Close the modal
            bootstrap.Modal.getInstance(modal).hide();
        } catch (error) {
            console.log(error);
            alert('An error occurred while saving the configuration.');
        } finally {
            hideAnimation();
        }
    });
    } catch (error) {
        ModalUtils.handleModalError(error, 'Configuration modal setup', modal);
    }
}

/**
 * Generates HTML table rows for configuration field editing
 * 
 * @function generateFieldRows
 * 
 * @param {Array<Object>} fields - Array of field configuration objects
 * @param {string} conceptType - Type of concept (PRIMARY, SECONDARY, etc.)
 * @returns {string} HTML string containing table rows for field editing
 * @throws {Error} Throws error if field rendering fails
 */
function generateFieldRows(fields, conceptType) {
    if (!fields || !Array.isArray(fields)) return '';
    
    const conceptTypes = Object.keys(MODAL_CONFIG.CONCEPT_TYPES);
    return fields.map(field => FORM_UTILS.generateConfigRow(field, conceptTypes)).join('');
}

/**
 * Saves edited concept data back to the repository with validation
 * 
 * @async
 * @function saveEditedConcept
 * 
 * @param {Object} originalContent - Original concept data before editing
 * @param {Array<Object>} typeConfig - Field configuration for the concept type
 * @param {string} file - Filename of the concept being edited
 * @returns {Promise<void>} Resolves when concept is successfully saved
 * @throws {Error} Throws error if validation fails or file update fails
 */
async function saveEditedConcept(originalContent, typeConfig, file) {
    try {
        showAnimation();
        
        // Create a new object with updated values
        const updatedContent = { ...originalContent };
        
        // Update each field from the form
        typeConfig.forEach(field => {
            const fieldElement = document.getElementById(`edit_${field.id}`);
            if (!fieldElement) return;
            
            let value = fieldElement.value;
            
            // Handle arrays and special types
            if (field.type === 'array') {
                if (value.trim()) {
                    try {
                        if (value.startsWith('[') && value.endsWith(']')) {
                            // Try parsing as JSON
                            value = JSON.parse(value);
                        } else {
                            // Split by comma
                            value = value.split(',').map(item => item.trim()).filter(item => item);
                        }
                    } catch (e) {
                        // If parsing fails, treat as a single value
                        console.error('Error parsing array value:', e);
                    }
                } else {
                    value = [];
                }
            }
            
            // Check if the field should be removed or updated
            const isEmpty = (field.type === 'array' && Array.isArray(value) && value.length === 0) ||
                           (field.type !== 'array' && (!value || value.trim() === ''));
            
            if (isEmpty && !field.required) {
                // Remove the key from the object for non-required empty fields
                delete updatedContent[field.id];
            } else {
                // Update the content with the new value
                updatedContent[field.id] = value;
            }
        });
        
        // Prepare the file content
        const content = JSON.stringify(updatedContent, null, 2);
        
        // Get the file SHA (needed for update)
        const fileDetails = await getFiles(file);
        const sha = fileDetails.data.sha;
        
        // Update the file
        await updateFile(file, content, sha);
        
        // Close the modal
        const modal = document.getElementById('modal');
        bootstrap.Modal.getInstance(modal).hide();
        
    } catch (error) {
        console.error('Error saving concept:', error);
        alert('An error occurred while saving the concept.');
    } finally {
        hideAnimation();
    }
}