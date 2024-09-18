import { showAnimation, hideAnimation, fromBase64 } from './common.js';
import { addFile, updateFile, deleteFile, getFiles } from './api.js';

export const renderAddModal = () => {

    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    modalHeader.innerHTML = `
        <h5 class="modal-title">Add Concept</h5>
    `;

    modalBody.innerHTML = `
        <!-- Dropdown for Concept Type -->
        <div class="row mb-3">
            <div class="col-4">
                <label for="conceptType" class="col-form-label">Concept Type</label>
            </div>
            <div class="col-8">
                <select class="form-select" id="conceptType">
                    <option value="Primary Source">Primary Source</option>
                    <option value="Secondary Source">Secondary Source</option>
                    <option value="Source Question">Source Question</option>
                    <option value="Question">Question</option>
                    <option value="Response">Response</option>
                </select>
            </div>
        </div>

        <!-- Input for Concept ID -->
        <div class="row mb-3">
            <div class="col-4">
                <label for="fileId" class="col-form-label" id="labelFileId">Concept ID</label>
            </div>
            <div class="col-8">
                <input type="text" class="form-control" id="fileId" placeholder="Enter Concept ID">
            </div>
        </div>

        <!-- Input for Concept Name -->
        <div class="row mb-3">
            <div class="col-4">
                <label for="fileName" class="col-form-label" id="labelFileName">Concept Name</label>
            </div>
            <div class="col-8">
                <input type="text" class="form-control" id="fileName" placeholder="Enter Concept Name">
            </div>
        </div>
    `;

    modalFooter.innerHTML = `
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-outline-success">Save</button>
    `;

    new bootstrap.Modal(modal).show();

    // Function to update labels based on the selected dropdown option
    const updateLabels = (selectedValue) => {
        document.getElementById('labelFileId').textContent = `${selectedValue} ID`;
        document.getElementById('labelFileName').textContent = `${selectedValue} Name`;
    };

    // Add event listener to dropdown to change labels dynamically
    const conceptTypeSelect = document.getElementById('conceptType');
    conceptTypeSelect.addEventListener('change', (event) => {
        const selectedValue = event.target.value;
        updateLabels(selectedValue);
    });

    // Initialize labels based on the default selected dropdown option
    updateLabels(conceptTypeSelect.value);

    // Add event listener for the save button
    const confirmButton = modal.querySelector('.btn-outline-success');
    confirmButton.addEventListener('click', async () => {
        const conceptType = document.getElementById('conceptType').value;
        const id = document.getElementById('fileId').value;
        const name = document.getElementById('fileName').value;

        const payload = {
            type: conceptType,
            id,
            name
        };

        const path = `${id}.json`;
        const content = JSON.stringify(payload);
        
        showAnimation();
        
        await addFile(path, content);

        bootstrap.Modal.getInstance(modal).hide();

        renderHomePage();
        hideAnimation();
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

        renderHomePage();
        hideAnimation();
    });
}

export const renderModifyModal = async (event) => {
    const button = event.target;
    const file = button.getAttribute('data-bs-file');

    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    const contents = await getFiles(file);
    const fileContentString = fromBase64(contents.data.content);
    const fileContent = JSON.parse(fileContentString);

    modalHeader.innerHTML = `
        <h5 class="modal-title">Modify File</h5>
    `;

    modalBody.innerHTML = `
        <div class="row mb-3">
            <div class="col-4">
                <label for="fileId" class="col-form-label">File ID</label>
            </div>
            <div class="col-8">
                <input type="text" class="form-control" id="fileId" value="${fileContent.id}" readonly>
            </div>
        </div>

        <div class="row mb-3">
            <div class="col-4">
                    <label for="fileName" class="col-form-label">File Name</label>
                </div>
                <div class="col-8">
                    <input type="text" class="form-control" id="fileName" value="${fileContent.name}">
                </div>
            </div>
        </div>
    `;

    modalFooter.innerHTML = `
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-outline-success">Save</button>
    `;

    new bootstrap.Modal(modal).show();

    // add event listener for save button
    const confirmButton = modal.querySelector('.btn-outline-success');
    confirmButton.addEventListener('click', async () => {

        const payload = {
            id: document.getElementById('fileId').value,
            name: document.getElementById('fileName').value
        };
        
        showAnimation();
        
        await updateFile(contents.data.path, JSON.stringify(payload), contents.data.sha);

        bootstrap.Modal.getInstance(modal).hide();

        renderHomePage();
        hideAnimation();
    });
}