import { addEventAddFile, addEventModifyFile } from './events.js';
import { showAnimation, hideAnimation, fromBase64, appState } from './common.js';
import { addFile, updateFile } from './api.js';

export const renderHomePage = () => {
    renderSearchBar();
    renderFileList();
}

const renderSearchBar = () => {
    const authDiv = document.getElementById('auth');

    authDiv.innerHTML = `
        <div class="container mt-5">

            <!-- Top bar with search and add button -->
            <div class="row mb-3">
                <div class="col-8">
                    <input type="text" id="searchFiles" class="form-control" placeholder="Search files...">
                </div>
                <div class="col-4 text-end">
                    <button id="addFile" class="btn btn-primary">
                        <i class="bi bi-plus-lg"></i> Add Concept
                    </button>
                </div>
            </div>

            <!-- File list -->
            <div id="fileList" class="list-group"></div>
        </div>
    `;

    // Attach search event listener once
    const searchInput = document.getElementById('searchFiles');
    searchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
        renderFileList(searchTerm);  // Pass the search term to filter files
    });
};

const renderFileList = (searchTerm = '') => {
    const fileListDiv = document.getElementById('fileList');
    const files = appState.getState().files;

    // Filter files based on the search term
    const filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    fileListDiv.innerHTML = `
        ${filteredFiles.map(file => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div class="col-6">
                    <strong>${file.name}</strong>
                </div>
                <div class="col-3"></div> <!-- Empty space -->
                <div class="col-3 text-end">
                    <button class="btn btn-outline-primary btn-sm modifyFileBtn" data-file="${file}">
                        <i class="bi bi-pencil"></i> Modify
                    </button>
                    <button class="btn btn-outline-danger btn-sm deleteFileBtn" data-file="${file}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('')}
    `;

    // Add event listeners for Modify buttons
    const modifyButtons = document.querySelectorAll('.modifyFileBtn');
    modifyButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const fileId = event.currentTarget.getAttribute('data-file');
            console.log(`Modify button clicked for file ID: ${fileId}`);
        });
    });

    // Add event listeners for Delete buttons
    const deleteButtons = document.querySelectorAll('.deleteFileBtn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const fileId = event.currentTarget.getAttribute('data-file');
            console.log(`Delete button clicked for file ID: ${fileId}`);
        });
    });
};

export const renderAddFile = () => {
    const authDiv = document.getElementById('auth');

    authDiv.innerHTML = `
        <h1>Add Concept</h1>
        <input type="text" id="conceptID" placeholder="Concept ID">
        <input type="text" id="conceptName" placeholder="Concept Name">
        <button id="addFileButton">Submit</button>
    `;

    const addFileButton = document.getElementById('addFileButton');

    addFileButton.addEventListener('click', async () => {
        const conceptID = document.getElementById('conceptID').value;
        const conceptName = document.getElementById('conceptName').value;

        const infoObject = {
            id: conceptID,
            name: conceptName
        };

        const path = `${conceptID}.json`;
        const content = JSON.stringify(infoObject);

        showAnimation();
        const check = await addFile(path, content);
        hideAnimation();

        console.log(check);
    });
}

const renderModifyFile = (fileContent) => {

    const authDiv = document.getElementById('auth');
    const jsonContent = fromBase64(fileContent.data.content);

    const { id, name } = JSON.parse(jsonContent);

    authDiv.innerHTML = `
        <h1>Modify Concept</h1>
        <div class="container">
            <div class="row mb-3">
                <div class="col-4 text-start">
                    <label>Concept ID</label>
                </div>
                <div class="col-8">
                    <input type="text" id="conceptID" class="form-control" value="${id}">
                </div>
            </div>
            <div class="row mb-3">
                <div class="col-4 text-start">
                    <label>Concept Name</label>
                </div>
                <div class="col-8">
                    <input type="text" id="conceptName" class="form-control" value="${name}">
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-6">
                    <button id="backButton" class="btn btn-secondary w-100">Back</button>
                </div>
                <div class="col-6">
                    <button id="saveButton" class="btn btn-success w-100">Save</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('backButton').addEventListener('click', async () => {
        renderFileList();
    });

    document.getElementById('saveButton').addEventListener('click', async () => {
        const updatedID = document.getElementById('conceptID').value;
        const updatedName = document.getElementById('conceptName').value;

        const payload = {
            id: updatedID,
            name: updatedName
        };

        showAnimation();
        await updateFile(fileContent.data.path, JSON.stringify(payload), fileContent.data.sha);
        hideAnimation();
    });
}