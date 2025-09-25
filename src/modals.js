import { showAnimation, hideAnimation, getFileContent, appState, createReferenceDropdown, validateFormFields } from './common.js';
import { addFile, deleteFile, addFolder, getConcept, getFiles, updateFile } from './api.js';
import { refreshHomePage } from './homepage.js';

export const renderAddModal = async () => {

    console.log(appState.getState());
    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    const concept = await getConcept();
    console.log(concept);

    modalHeader.innerHTML = `
        <h5 class="modal-title">Add Concept</h5>
    `;

    // Add the concept type selector
    modalBody.innerHTML = `
        <div class="row mb-3">
            <div class="col-4">
                <label for="conceptType" class="col-form-label">Concept Type</label>
            </div>
            <div class="col-8">
                <select class="form-select" id="conceptType">
                    <option value="PRIMARY" selected>PRIMARY</option>
                    <option value="SECONDARY">SECONDARY</option>
                    <option value="SOURCE">SOURCE</option>
                    <option value="QUESTION">QUESTION</option>
                    <option value="RESPONSE">RESPONSE</option>
                </select>
            </div>
        </div>
        <div id="templateFields"></div>
        <div id="additionalFields"></div>
    `;

    // Update the modal footer with the Add Field button on the left and Cancel/Save on the right
    modalFooter.innerHTML = `
        <div class="w-100 d-flex justify-content-between">
            <div>
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-outline-success">Save</button>
            </div>
        </div>
    `;

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

    new bootstrap.Modal(modal).show();

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

export const renderDeleteModal = (event) => {
    const button = event.target;
    const file = button.getAttribute('data-bs-file');

    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    modalHeader.innerHTML = `
        <h5 class="modal-title">Delete File</h5>
    `;

    modalBody.innerHTML = `
        <p>Are you sure you want to delete <strong>${file}?</strong></p>
    `;

    modalFooter.innerHTML = `
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-outline-danger">Confirm</button>
    `;

    new bootstrap.Modal(modal).show();

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
}

export const renderViewModal = async (event) => {
    showAnimation();
    
    const button = event.target;
    const file = button.getAttribute('data-bs-file');
    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');
    
    try {
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
            modalHeader.innerHTML = `
                <h5 class="modal-title d-flex align-items-center">
                    ${modal.isEditMode ? 'Edit' : 'View'} Concept 
                    <span class="badge bg-primary ms-2">${conceptType}</span>
                </h5>
            `;

            // Clear modal body
            modalBody.innerHTML = '';
            
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
            modalBody.appendChild(contentContainer);
            
            // Set up footer buttons based on mode
            if (modal.isEditMode) {
                modalFooter.innerHTML = `
                    <div class="w-100 d-flex justify-content-between">
                        <button type="button" id="cancelButton" class="btn btn-outline-secondary">Cancel</button>
                        <button type="button" id="saveButton" class="btn btn-outline-success">Save Changes</button>
                    </div>
                `;
                
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
                modalFooter.innerHTML = `
                    <div class="w-100 d-flex justify-content-between">
                        <button type="button" id="closeButton" class="btn btn-outline-secondary">Close</button>
                        <button type="button" id="editButton" class="btn btn-outline-primary" disabled>Edit</button>
                    </div>
                `;
                
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
        
        // Show user-friendly error message
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="bi bi-exclamation-triangle"></i> Error Loading Concept</h6>
                <p>${error.message}</p>
                <small class="text-muted">File: ${file}</small>
            </div>
        `;
        
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-outline-secondary" onclick="bootstrap.Modal.getInstance(this.closest('.modal')).hide()">Close</button>
        `;
        
        new bootstrap.Modal(modal).show();
    } finally {
        hideAnimation();
    }
}

// Function to render view mode (only fields with values)
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

// Function to render edit mode (all configured fields)
function renderEditMode(container, content, typeConfig) {
    container.innerHTML = `
        <div class="alert alert-info mb-3">
            <i class="bi bi-info-circle"></i> 
            Editing concept. All configured fields are shown below.
        </div>
        <form id="editConceptForm">
            <div class="edit-fields"></div>
        </form>
    `;
    
    const editFields = container.querySelector('.edit-fields');
    
    // Render all configured fields, regardless of whether they have values
    typeConfig.forEach(field => {
        const fieldValue = content[field.id] !== undefined ? content[field.id] : '';
        const fieldRow = document.createElement('div');
        fieldRow.className = 'mb-3';
        
        let fieldInput;
        
        // Create appropriate input based on field type
        switch (field.type) {
            case 'concept':
                // Concept ID is read-only
                fieldInput = `
                    <input type="text" class="form-control" id="edit_${field.id}" 
                           value="${fieldValue}" ${field.id === 'conceptId' ? 'readonly' : ''}>
                `;
                break;
                
            case 'reference':
                // Reference fields use the existing dropdown function
                fieldInput = createReferenceDropdown(field);
                // We'll need to set the selected value after rendering
                setTimeout(() => {
                    const selectElement = document.getElementById(`edit_${field.id}`);
                    if (selectElement) {
                        selectElement.value = fieldValue;
                    }
                }, 0);
                break;
                
            case 'array':
                if (Array.isArray(fieldValue)) {
                    fieldInput = `
                        <textarea class="form-control" id="edit_${field.id}" rows="3">${fieldValue.join(', ')}</textarea>
                        <div class="form-text">Enter multiple values separated by commas</div>
                    `;
                } else {
                    fieldInput = `
                        <textarea class="form-control" id="edit_${field.id}" rows="3">${fieldValue}</textarea>
                        <div class="form-text">Enter multiple values separated by commas</div>
                    `;
                }
                break;
                
            case 'textarea':
                fieldInput = `
                    <textarea class="form-control" id="edit_${field.id}" rows="3">${fieldValue}</textarea>
                `;
                break;
                
            default:
                fieldInput = `
                    <input type="${field.type}" class="form-control" id="edit_${field.id}" 
                           value="${fieldValue}" ${field.required ? 'required' : ''}>
                `;
        }
        
        fieldRow.innerHTML = `
            <label for="edit_${field.id}" class="form-label">
                ${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}
            </label>
            ${fieldInput}
        `;
        
        editFields.appendChild(fieldRow);
    });
}

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

export const renderUploadModal = async (files) => {

    // Get the modal element
    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    // Set modal title
    modalHeader.innerHTML = `
        <h5 class="modal-title">Uploading Files</h5>
    `;

    // Clear previous content
    modalBody.innerHTML = '';

    // Array to hold file rows for status updates
    const fileRows = [];

    // Create file rows in the modal body
    files.forEach((file) => {
        const fileRow = document.createElement('div');
        fileRow.classList.add('d-flex', 'align-items-center', 'mb-2');
        fileRow.innerHTML = `
            <div class="flex-grow-1">${file.name}</div>
            <div class="status-indicator">
            <span class="status-text ms-1">Pending...</span>
            </div>
        `;
        
        modalBody.appendChild(fileRow);
        fileRows.push({ file, fileRow });
    });

    // Modal footer
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-outline-secondary">Close</button>
    `;

    // Show the modal
    new bootstrap.Modal(modal).show();

    // Upload files sequentially
    for (const { file, fileRow } of fileRows) {
        // Update status to "Processing..."
        const statusIndicator = fileRow.querySelector('.status-indicator');
        statusIndicator.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span class="status-text ms-1">Processing...</span>
        `;

        try {
            await addFile(file.name, file.content);
            // On success, update the status indicator
            statusIndicator.innerHTML = '<span class="text-success">Uploaded successfully</span>';
        } catch (error) {
            // On failure, update the status indicator
            statusIndicator.innerHTML = '<span class="text-danger">Upload failed</span>';
            console.error(`Failed to upload ${file.name}:`, error);
        }
    }

    // add event listener for save button
    const closeButton = modal.querySelector('.btn-outline-secondary');
    closeButton.addEventListener('click', async () => {
        bootstrap.Modal.getInstance(modal).hide();

        await refreshHomePage();
    });
}

export const renderAddFolderModal = () => {

    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    // Set the modal title
    modalHeader.innerHTML = `
        <h5 class="modal-title">Add Folder</h5>
    `;

    // Initialize the modal body with Folder Name field
    modalBody.innerHTML = `
        <div class="row mb-3">
            <div class="col-4">
                <label for="folderName" class="col-form-label">Folder Name*</label>
            </div>
            <div class="col-8">
                <input type="text" class="form-control" id="folderName" required>
            </div>
        </div>
    `;

    // Update the modal footer with Cancel and Create buttons
    modalFooter.innerHTML = `
        <div class="w-100 d-flex justify-content-end">
            <button type="button" class="btn btn-outline-secondary me-2" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-outline-success">Create</button>
        </div>
    `;

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
}

export const renderConfigModal = async () => {
    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');
    
    // Get current config from appState
    const { config } = appState.getState();
    
    // Set the modal title
    modalHeader.innerHTML = `
        <h5 class="modal-title">Configuration Settings</h5>
    `;
    
    // Create the tab structure for different concept types
    const conceptTypes = ['PRIMARY', 'SECONDARY', 'SOURCE', 'QUESTION', 'RESPONSE'];
    
    // Create tab headers
    let tabHeaders = '<ul class="nav nav-tabs" id="configTabs" role="tablist">';
    conceptTypes.forEach((type, index) => {
        tabHeaders += `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${index === 0 ? 'active' : ''}" 
                    id="${type.toLowerCase()}-tab" 
                    data-bs-toggle="tab" 
                    data-bs-target="#${type.toLowerCase()}-pane" 
                    type="button" 
                    role="tab" 
                    aria-controls="${type.toLowerCase()}-pane" 
                    aria-selected="${index === 0 ? 'true' : 'false'}">
                    ${type}
                </button>
            </li>
        `;
    });
    tabHeaders += '</ul>';
    
    // Create tab content
    let tabContent = '<div class="tab-content mt-3" id="configTabContent">';
    conceptTypes.forEach((type, index) => {
        tabContent += `
            <div class="tab-pane fade ${index === 0 ? 'show active' : ''}" 
                id="${type.toLowerCase()}-pane" 
                role="tabpanel" 
                aria-labelledby="${type.toLowerCase()}-tab" 
                tabindex="0">
                <div class="mb-3">
                    <h6>${type} Fields</h6>
                    <table class="table table-bordered table-sm">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Label</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Reference Type</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="${type.toLowerCase()}-fields">
                            ${generateFieldRows(config[type] || [], type)}
                        </tbody>
                    </table>
                    <button class="btn btn-sm btn-outline-primary add-field-btn" 
                        data-type="${type}">
                        <i class="bi bi-plus-circle"></i> Add Field
                    </button>
                </div>
            </div>
        `;
    });
    tabContent += '</div>';
    
    // Full modal body content
    modalBody.innerHTML = `
        ${tabHeaders}
        ${tabContent}
    `;
    
    // Set up the modal footer
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-outline-primary" id="saveConfigBtn">Save Changes</button>
    `;
    
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
}

function generateFieldRows(fields, conceptType) {
    if (!fields || !Array.isArray(fields)) return '';
    
    return fields.map(field => `
        <tr>
            <td><input type="text" class="form-control form-control-sm field-id" value="${field.id || ''}"></td>
            <td><input type="text" class="form-control form-control-sm field-label" value="${field.label || ''}"></td>
            <td>
                <select class="form-select form-select-sm field-type">
                    <option value="text" ${field.type === 'text' ? 'selected' : ''}>text</option>
                    <option value="concept" ${field.type === 'concept' ? 'selected' : ''}>concept</option>
                    <option value="reference" ${field.type === 'reference' ? 'selected' : ''}>reference</option>
                    <option value="array" ${field.type === 'array' ? 'selected' : ''}>array</option>
                    <option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>textarea</option>
                </select>
            </td>
            <td>
                <div class="form-check">
                    <input class="form-check-input field-required" type="checkbox" ${field.required ? 'checked' : ''}>
                </div>
            </td>
            <td>
                <select class="form-select form-select-sm field-reference-type" ${field.type !== 'reference' ? 'disabled' : ''}>
                    <option value="">None</option>
                    <option value="PRIMARY" ${field.referencesType === 'PRIMARY' ? 'selected' : ''}>PRIMARY</option>
                    <option value="SECONDARY" ${field.referencesType === 'SECONDARY' ? 'selected' : ''}>SECONDARY</option>
                    <option value="SOURCE" ${field.referencesType === 'SOURCE' ? 'selected' : ''}>SOURCE</option>
                    <option value="QUESTION" ${field.referencesType === 'QUESTION' ? 'selected' : ''}>QUESTION</option>
                    <option value="RESPONSE" ${field.referencesType === 'RESPONSE' ? 'selected' : ''}>RESPONSE</option>
                </select>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-field-btn">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

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