import { appState } from './common.js';
import { getFiles } from './api.js';
import { renderAddModal, renderModifyModal, renderDeleteModal } from './modals.js';

export const renderHomePage = async () => {
    
    const fileData = await getFiles();
    appState.setState({ files: fileData.data });
    
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

    // Attach add file event listener once
    const addFileButton = document.getElementById('addFile');
    addFileButton.addEventListener('click', () => {
        renderAddModal();
    });
};

const renderFileList = (searchTerm = '') => {
    const fileListDiv = document.getElementById('fileList');
    const files = appState.getState().files;

    // If no files, display message
    if (!files || files.length === 0) {
       return;
    }

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
                    <button class="btn btn-outline-primary btn-sm modifyFileBtn" data-bs-file="${file.name}">
                        <i class="bi bi-pencil"></i> Modify
                    </button>
                    <button class="btn btn-outline-danger btn-sm deleteFileBtn" data-bs-file="${file.name}" data-bs-sha="${file.sha}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('')}
    `;

    // for each modify button, add listener to render modify modal
    const modifyButtons = document.querySelectorAll('.modifyFileBtn');
    modifyButtons.forEach(button => {
        button.addEventListener('click', event => {
            renderModifyModal(event);
        });
    });

    // for each delete button, add listener to render delete modal
    const deleteButtons = document.querySelectorAll('.deleteFileBtn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', event => {
            renderDeleteModal(event);
        });
    });
};