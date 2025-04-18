import { showAnimation, hideAnimation, fromBase64, getFileContent } from './common.js';
import { addFile, updateFile, deleteFile, getFiles, addFolder } from './api.js';
import { refreshHomePage, renderHomePage } from './homepage.js';

export const renderAddModal = () => {

    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    modalHeader.innerHTML = `
        <h5 class="modal-title">Add Concept</h5>
    `;

    // Initialize the modal body with Concept ID and Description fields
    modalBody.innerHTML = `
        <div class="row mb-3">
            <div class="col-4">
                <label for="conceptId" class="col-form-label">Concept ID*</label>
            </div>
            <div class="col-8">
                <input type="text" class="form-control" id="conceptId" required>
            </div>
        </div>
        <div class="row mb-3">
            <div class="col-4">
                <label for="key" class="col-form-label">Key*</label>
            </div>
            <div class="col-8">
                <textarea class="form-control" id="key" required></textarea>
            </div>
        </div>

        <!-- Placeholder for additional fields -->
        <div id="additionalFields"></div>
    `;

    // Update the modal footer with the Add Field button on the left and Cancel/Save on the right
    modalFooter.innerHTML = `
        <div class="w-100 d-flex justify-content-between">
            <button type="button" class="btn btn-outline-primary" id="addFieldButton">
                <i class="bi bi-plus"></i> Add Field
            </button>
            <div>
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-outline-success">Save</button>
            </div>
        </div>
    `;

    new bootstrap.Modal(modal).show();

    // Container for additional fields
    const additionalFieldsContainer = modalBody.querySelector('#additionalFields');

    // Add event listener to the Add Field button
    document.getElementById('addFieldButton').addEventListener('click', () => {
        // Generate a unique identifier for the new field
        const fieldIndex = additionalFieldsContainer.childElementCount;
        const fieldId = `additionalField_${fieldIndex}`;

        // Create a new field row
        const fieldRow = document.createElement('div');
        fieldRow.classList.add('row', 'mb-3');
        fieldRow.innerHTML = `
            <div class="col-4">
                <input type="text" class="form-control" placeholder="Key" id="${fieldId}_key" required>
            </div>
            <div class="col-8">
                <input type="text" class="form-control" placeholder="Value" id="${fieldId}_value" required>
            </div>
        `;
        additionalFieldsContainer.appendChild(fieldRow);
    });

    // Add event listener for the Save button
    const confirmButton = modal.querySelector('.btn-outline-success');
    confirmButton.addEventListener('click', async () => {
        // Collect all the fields into a payload object
        const payload = {};

        // Get Concept ID and Key
        const conceptId = document.getElementById('conceptId').value.trim();
        const key = document.getElementById('key').value.trim();

        // Validate required fields
        if (!conceptId || !key) {
            alert('Concept ID and Key are required.');
            return;
        }

        payload.conceptId = conceptId;
        payload.key = key;

        // Get additional fields
        const additionalFields = additionalFieldsContainer.querySelectorAll('.row.mb-3');
        additionalFields.forEach((fieldRow, index) => {
            const keyInput = fieldRow.querySelector(`#additionalField_${index}_key`);
            const valueInput = fieldRow.querySelector(`#additionalField_${index}_value`);

            const key = keyInput.value.trim();
            const value = valueInput.value.trim();

            // Only include fields where the key is provided
            if (key) {
                payload[key] = value;
            }
        });

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

export const renderModifyModal = async (event) => {
    showAnimation();

    const button = event.target;
    const file = button.getAttribute('data-bs-file');

    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    try {
        // Fetch the file contents
        const contents = await getFiles(file); //UPDATE
        const fileContentString = fromBase64(contents.data.content);
        const fileContent = JSON.parse(fileContentString);

        // Set the modal title
        modalHeader.innerHTML = `
            <h5 class="modal-title">Modify Concept</h5>
        `;

        // Clear the modal body
        modalBody.innerHTML = '';

        // Container for key-value pairs
        const keyValuePairsContainer = document.createElement('div');
        keyValuePairsContainer.id = 'keyValuePairs';

        // Function to add a key-value pair row
        const addKeyValuePairRow = (key = '', value = '', isExisting = false) => {
            const index = keyValuePairsContainer.childElementCount;
            const fieldId = `keyValuePair_${index}`;

            const fieldRow = document.createElement('div');
            fieldRow.classList.add('row', 'mb-3', 'align-items-center');

            if (isExisting) {
                fieldRow.innerHTML = `
                    <div class="col-4">
                        <label class="col-form-label">${key}</label>
                    </div>
                    <div class="col-7">
                        <input type="text" class="form-control" placeholder="Value" id="${fieldId}_value" value="${value}">
                    </div>
                    <div class="col-1 text-end">
                        <!-- Empty space -->
                    </div>
                `;
            } else {
                fieldRow.innerHTML = `
                    <div class="col-4">
                        <input type="text" class="form-control" placeholder="Field" id="${fieldId}_key" required>
                    </div>
                    <div class="col-7">
                        <input type="text" class="form-control" placeholder="Value" id="${fieldId}_value">
                    </div>
                    <div class="col-1 text-end">
                        <button type="button" class="btn btn-sm btn-outline-danger" id="${fieldId}_remove">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;

                // Add event listener to the remove button
                const removeButton = fieldRow.querySelector(`#${fieldId}_remove`);
                removeButton.addEventListener('click', () => {
                    keyValuePairsContainer.removeChild(fieldRow);
                });
            }

            keyValuePairsContainer.appendChild(fieldRow);
        };

        // Add existing key-value pairs to the modal
        for (const [key, value] of Object.entries(fileContent)) {
            addKeyValuePairRow(key, value, true); // 'true' indicates existing fields
        }

        // Append the key-value pairs container to the modal body
        modalBody.appendChild(keyValuePairsContainer);

        // Update the modal footer with the Add Field button and Save/Cancel buttons
        modalFooter.innerHTML = `
            <div class="w-100 d-flex justify-content-between">
                <button type="button" class="btn btn-outline-primary" id="addFieldButton">
                    <i class="bi bi-plus"></i> Add Field
                </button>
                <div>
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-outline-success">Save</button>
                </div>
            </div>
        `;

        // Show the modal
        new bootstrap.Modal(modal).show();

        // Add event listener to the Add Field button
        document.getElementById('addFieldButton').addEventListener('click', () => {
            addKeyValuePairRow(); // Adds an empty key-value pair row
        });

        // Add event listener for the Save button
        const confirmButton = modal.querySelector('.btn-outline-success');
        confirmButton.addEventListener('click', async () => {
            // Collect all the key-value pairs into a payload object
            const payload = {};

            // Iterate over all key-value pair rows
            const keyValuePairRows = keyValuePairsContainer.querySelectorAll('.row.mb-3');
            let valid = true;
            keyValuePairRows.forEach((fieldRow, index) => {
                const isExisting = index < Object.keys(fileContent).length;
                let key, value;

                if (isExisting) {
                    // Existing keys are displayed as labels
                    key = Object.keys(fileContent)[index];
                    const valueInput = fieldRow.querySelector(`#keyValuePair_${index}_value`);
                    value = valueInput.value.trim();
                } else {
                    // New keys are entered in input fields
                    const keyInput = fieldRow.querySelector(`#keyValuePair_${index}_key`);
                    const valueInput = fieldRow.querySelector(`#keyValuePair_${index}_value`);
                    key = keyInput.value.trim();
                    value = valueInput.value.trim();

                    // Validate that key is not empty
                    if (!key) {
                        valid = false;
                        keyInput.classList.add('is-invalid');
                    } else {
                        keyInput.classList.remove('is-invalid');
                    }
                }

                // Add to payload
                payload[key] = value;
            });

            if (!valid) {
                alert('Please fill in all required fields.');
                return;
            }

            // Prepare the file content
            const content = JSON.stringify(payload, null, 2); // Pretty-print JSON with indentation

            // Show loading animation
            showAnimation();

            try {
                // Update the file (assuming updateFile is defined elsewhere)
                await updateFile(contents.data.path, content, contents.data.sha);

                // Hide the modal
                bootstrap.Modal.getInstance(modal).hide();

                // Refresh the home page
                renderHomePage();
            } catch (error) {
                console.error('Error updating file:', error);
                alert('An error occurred while saving the changes.');
            } finally {
                // Hide loading animation
                hideAnimation();
            }
        });
    } catch (error) {
        console.error('Error fetching file:', error);
        alert('An error occurred while loading the file.');
        // Hide loading animation and modal
        hideAnimation();
        bootstrap.Modal.getInstance(modal).hide();
    }

    hideAnimation();
}

export const renderViewModal = async (event) => {
    showAnimation();
    
    const button = event.target;
    const file = button.getAttribute('data-bs-file');
    const modal = document.getElementById('modal');
    const modalBody = modal.querySelector('.modal-body');
    
    try {
        const { content } = await getFileContent(file);

        modal.querySelector('.modal-header').innerHTML = `
            <h5 class="modal-title">View Concept</h5>
        `;

        modalBody.innerHTML = '';

        // Create container for key-value pairs
        const keyValueContainer = document.createElement('div');
        keyValueContainer.id = 'keyValuePairsView';

        // Add each key-value pair to the container
        Object.entries(content).forEach(([key, value]) => {
            const row = document.createElement('div');
            row.classList.add('row', 'mb-3', 'align-items-center');
            
            row.innerHTML = `
                <div class="col-4">
                    <strong>${key}</strong>
                </div>
                <div class="col-8">
                    <div class="form-control-plaintext">${value}</div>
                </div>
            `;
            
            keyValueContainer.appendChild(row);
        });

        // Add the container to the modal body
        modalBody.appendChild(keyValueContainer);

        modal.querySelector('.modal-footer').innerHTML = `
            <div class="w-100 d-flex justify-content-between">
                <div>
                    <button type="button" id="closeButton" class="btn btn-outline-secondary">Close</button>
                </div>
            </div>
        `;

        // Add event listener for the Close button
        const closeButton = modal.querySelector('#closeButton');
        closeButton.addEventListener('click', () => {
            closeButton.blur();
            bootstrap.Modal.getInstance(modal).hide();
        });

        new bootstrap.Modal(modal).show();

    } catch (error) {
        console.error('Error fetching file:', error);
    } finally {
        hideAnimation();
    }
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
        showAnimation();
        bootstrap.Modal.getInstance(modal).hide();
        await renderHomePage();
        hideAnimation();
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