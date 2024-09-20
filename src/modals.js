import { showAnimation, hideAnimation, fromBase64 } from './common.js';
import { addFile, updateFile, deleteFile, getFiles } from './api.js';
import { fields } from '../config.js';
import { renderHomePage } from './homepage.js';

export const renderAddModal = () => {

    const modal = document.getElementById('modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    modalHeader.innerHTML = `
        <h5 class="modal-title">Add Concept</h5>
    `;

    // Initial dropdown value
    let selectedOption = "Primary Source";

    const renderFields = (option) => {
        selectedOption = option; // Update selected option
        
        // Render dropdown menu
        modalBody.innerHTML = `
            <div class="row mb-3">
                <div class="col-4">
                    <label for="dropdownMenu" class="col-form-label">Select Type</label>
                </div>
                <div class="col-8">
                    <select id="dropdownMenu" class="form-select">
                        <option value="Primary Source" ${selectedOption === 'Primary Source' ? 'selected' : ''}>Primary Source</option>
                        <option value="Secondary Source" ${selectedOption === 'Secondary Source' ? 'selected' : ''}>Secondary Source</option>
                        <option value="Source Question" ${selectedOption === 'Source Question' ? 'selected' : ''}>Source Question</option>
                        <option value="Question" ${selectedOption === 'Question' ? 'selected' : ''}>Question</option>
                        <option value="Response" ${selectedOption === 'Response' ? 'selected' : ''}>Response</option>
                    </select>
                </div>
            </div>
        `;
    
        // Append the dynamic fields based on the selected option
        const selectedConfig = fields[option];
        if (selectedConfig) {
            selectedConfig.forEach(field => {
                if (field.type === 'concept') {

                }
                else {
                    
                }
                modalBody.innerHTML += `
                    <div class="row mb-3">
                        <div class="col-4">
                            <label for="${field.id}" class="col-form-label">
                                ${field.label} ${field.required ? '*' : ''}
                            </label>
                        </div>
                        <div class="col-8">
                            ${field.type === "select" 
                                ? `<select class="form-select" id="${field.id}">
                                      ${field.options.map(option => `<option value="${option}">${option}</option>`).join('')}
                                   </select>`
                                : `<input type="${field.type}" class="form-control" id="${field.id}" ${field.required ? 'required' : ''}>`}
                        </div>
                    </div>
                `;
            });
        }
    
        // Add event listener to dropdown to re-render fields on change
        const dropdown = document.getElementById('dropdownMenu');
        dropdown.addEventListener('change', (e) => renderFields(e.target.value));
    };

    // Initially render fields for the default dropdown option
    renderFields(selectedOption);

    modalFooter.innerHTML = `
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-outline-success">Save</button>
    `;

    new bootstrap.Modal(modal).show();

    // Add event listener to dropdown to change labels dynamically
    document.getElementById('dropdownMenu').addEventListener('change', (event) => {
        const selectedOption = event.target.value;
        renderFields(selectedOption);
    });

    // Add event listener for the save button
    const confirmButton = modal.querySelector('.btn-outline-success');
    confirmButton.addEventListener('click', async () => {
       
        const conceptType = document.getElementById('dropdownMenu').value;
        const selectedFields = fields[conceptType] || [];

        const payload = {
            type: conceptType
        };

        selectedFields.forEach(field => {
            const fieldValue = document.getElementById(field.id).value;
            payload[field.id] = fieldValue;
        });

        const path = `${payload.concept}.json`;
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

    showAnimation();

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

    hideAnimation();
}