import { appState, fromBase64 } from './common.js';
import { getFiles, getRepoContents } from './api.js';
import { renderAddModal, renderModifyModal, renderDeleteModal } from './modals.js';
import { generateSpreadsheet } from './files.js';
import { structureFiles } from './dictionary.js';

export const renderHomePage = async () => {
    
    try {
        // Fetch the list of files
        const fileData = await getFiles();
        const files = fileData.data;

        // Find and fetch index.json content
        let indexContent = {};
        const indexFile = files.find(file => file.name === 'index.json');
        if (indexFile) {
            const indexResponse = await getFiles(indexFile.path); // Assuming getFiles can fetch individual files
            const indexContentString = fromBase64(indexResponse.data.content);
            indexContent = JSON.parse(indexContentString);
        }

        // Exclude index.json from the files list
        const filesWithoutIndex = files.filter(file => file.name !== 'index.json');

        // Update appState with files and index
        appState.setState({ files: filesWithoutIndex, index: indexContent });

        renderSearchBar();
        renderFileList();
    } catch (error) {
        console.error('Error fetching files or index:', error);
    }
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
                <div class="col-4 d-flex justify-content-end">
                    <button id="addFile" class="btn btn-primary me-2">
                        <i class="bi bi-plus-lg"></i> Add Concept
                    </button>
                    <button id="downloadRepo" class="btn btn-primary">
                        <i class="bi bi-download"></i> Download
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

    const downloadRepoButton = document.getElementById('downloadRepo');
    downloadRepoButton.addEventListener('click', async () => {
        const contents = await getRepoContents();
        const zip = await JSZip.loadAsync(contents);
        console.log(zip);

        const jsonDataArray = [];

        // Get an array of file names in the ZIP
        const files = Object.keys(zip.files);

        // Iterate over the files using a for...of loop
        for (const fileName of files) {
            const zipEntry = zip.files[fileName];

            // Check if the file is a JSON file
            if (fileName.endsWith('.json')) {
                try {
                    // Read the file content
                    const fileContent = await zipEntry.async('string');
                    const jsonData = JSON.parse(fileContent);
                    jsonDataArray.push(jsonData);
                } catch (error) {
                    console.error(`Error processing file ${fileName}:`, error);
                }
            }
        }

        console.log(jsonDataArray);

        let structuredData = structureFiles(jsonDataArray);
        generateSpreadsheet(structuredData);

    });
};

const renderFileList = (searchTerm = '') => {
    const fileListDiv = document.getElementById('fileList');
    const { files, index } = appState.getState();

    // If no files, display message
    if (!files || files.length === 0) {
       return;
    }

    const getFileNameWithoutExtension = (fileName) => {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1) return fileName; // No dot found, return original name
        return fileName.substring(0, lastDotIndex);
    };

    // Filter files based on the search term
    const filteredFiles = files.filter(file => {
        const keyValue = index[file.name] || '';
        const searchLower = searchTerm.toLowerCase();
        const fileNameWithoutExtension = getFileNameWithoutExtension(file.name).toLowerCase();

        return (
            fileNameWithoutExtension.includes(searchLower) ||
            keyValue.toLowerCase().includes(searchLower)
        );
    });

    fileListDiv.innerHTML = `
        ${filteredFiles.map(file => {
            const keyValue = index[file.name] || '';
            const displayName = file.name.replace(/\.json$/i, '');

            return `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${displayName}</strong><br>
                        <small class="text-muted">${keyValue}</small>
                    </div>
                    <div class="d-flex">
                        <button class="btn btn-outline-primary btn-sm modifyFileBtn me-2" data-bs-file="${file.name}">
                            <i class="bi bi-pencil"></i> Modify
                        </button>
                        <button class="btn btn-outline-danger btn-sm deleteFileBtn" data-bs-file="${file.name}" data-bs-sha="${file.sha}">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('')}
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