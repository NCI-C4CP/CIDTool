import { appState, executeWithAnimation, fromBase64 } from './common.js';
import { getFiles, getRepoContents, getUserRepositories } from './api.js';
import { renderAddModal, renderModifyModal, renderDeleteModal, renderAddFolderModal, renderViewModal } from './modals.js';
import { generateSpreadsheet } from './files.js';
import { structureFiles } from './dictionary.js';

export const renderHomePage = async () => {
    
    appState.setState({ files: [], index: {}, currentPage: 1, itemsPerPage: 10 });

    const repos = await getUserRepositories();
    const homeDiv = document.getElementById('auth');

    // Clear any existing content
    homeDiv.innerHTML = '';

    // Create a container for the list
    const container = document.createElement('div');
    container.classList.add('container', 'mt-4');

    // Create a list group to hold repository items
    const listGroup = document.createElement('ul');
    listGroup.classList.add('list-group');

    // Iterate over repositories and create list items
    repos.data.forEach(repo => {
        // Create a list item
        const listItem = document.createElement('div');
        listItem.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');

        // Left side: icon and repository name
        const leftDiv = document.createElement('div');
        leftDiv.classList.add('d-flex', 'align-items-center');

        // Folder icon (same as directories)
        const icon = document.createElement('i');
        icon.classList.add('bi', 'bi-folder-fill', 'text-warning', 'me-2');

        // Repository name
        const repoName = document.createElement('strong');
        repoName.textContent = repo.name;

        // Append icon and name to the left div
        leftDiv.appendChild(icon);
        leftDiv.appendChild(repoName);

        // Right side: "Open" button
        const openButton = document.createElement('button');
        openButton.classList.add('btn', 'btn-outline-primary', 'btn-sm', 'openRepoBtn');
        openButton.setAttribute('data-repo-name', repo.name);
        openButton.setAttribute('data-permissions', repo.permissions);
        openButton.innerHTML = `<i class="bi bi-arrow-right"></i> Open Repository`;

        // Add click event listener to the "Open" button
        openButton.addEventListener('click', async () => {
            await executeWithAnimation(renderRepoContent, repo, '');
        });

        // Append left div and open button to the list item
        listItem.appendChild(leftDiv);
        listItem.appendChild(openButton);

        // Append the list item to the list group
        listGroup.appendChild(listItem);
    });

    // Append the list group to the container
    container.appendChild(listGroup);

    // Append the container to the main content area
    homeDiv.appendChild(container);
}

const renderRepoContent = async (repo, directory) => {

    const owner = repo.owner.login;
    const repoName = repo.name;

    appState.setState({ repo, directory, owner, repoName });

    try {
        // Fetch the list of files
        const fileData = await getFiles();
        const files = fileData.data;

        // Initialize index content
        let indexContent = {};

        // Find 'index.json' in the files list
        const indexFile = files.find(file => file.name === 'index.json');

        if (indexFile) {
            const indexResponse = await getFiles(indexFile.name); // Assuming getFiles can fetch individual files
            const indexContentString = fromBase64(indexResponse.data.content);
            indexContent = JSON.parse(indexContentString);
        }

        // Exclude index.json from the files list
        let filesWithoutIndex = files.filter(file => file.name !== 'index.json').filter(file => file.name !== '.gitkeep');

        // If 'index.json' does NOT exist, display only directories
        if (!indexFile) {
            filesWithoutIndex = filesWithoutIndex.filter(file => file.type === 'dir');
        }

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
                <div class="col-4">
                    <div class="d-flex align-items-center">
                        <input type="text" id="searchFiles" class="form-control form-control me-2 flex-grow-1" placeholder="Search files...">
                        <button id="refreshButton" class="btn btn-outline-secondary btn me-2 flex-shrink-0">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button id="backButton" class="btn btn-outline-secondary flex-shrink-0">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                    </div>
                </div>
                <div class="col-8 d-flex justify-content-end">
                    <button id="addFolder" class="btn btn-secondary me-2">
                        <i class="bi bi-folder-plus"></i> Add Folder
                    </button>
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

            <!-- Pagination controls -->
            <div id="paginationControls" class="mt-3"></div>
        </div>
    `;

    // Attach search event listener once
    const searchInput = document.getElementById('searchFiles');
    searchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
        renderFileList(searchTerm);  // Pass the search term to filter files
    });

    // Attach add folder event listener
    const addFolderButton = document.getElementById('addFolder');
    addFolderButton.addEventListener('click', () => {
        renderAddFolderModal();
    });

    // Attach add file event listener once
    const addFileButton = document.getElementById('addFile');
    addFileButton.addEventListener('click', () => {
        renderAddModal();
    });

    // Attach refresh event listener
    const refreshButton = document.getElementById('refreshButton');
    refreshButton.addEventListener('click', async () => {
        refreshHomePage();
    });

    const backButton = document.getElementById('backButton');
    backButton.addEventListener('click', async () => {
        directoryBack();
    });

    const downloadRepoButton = document.getElementById('downloadRepo');
    downloadRepoButton.addEventListener('click', async () => {
        const contents = await getRepoContents();
        const zip = await JSZip.loadAsync(contents);
        const jsonDataArray = [];
        const zipFiles = Object.keys(zip.files);
        const basePath = zipFiles[0];
        const { files, directory } = appState.getState();
        const directoryFiles = files.filter(file => file.name.endsWith('.json'));

        for (const file of directoryFiles) {

            const fullPath = directory 
            ? `${basePath}${directory}/${file.name}` 
            : `${basePath}${file.name}`;

            if (zip.files[fullPath]) {
                try {
                    const fileContent = await zip.files[fullPath].async('string');
                    const jsonData = JSON.parse(fileContent);

                    jsonDataArray.push(jsonData);
                } catch (error) {
                    console.error(`Error processing file ${fileName}:`, error);
                }
            }
        }

        let structuredData = structureFiles(jsonDataArray);
        generateSpreadsheet(structuredData);

    });
};

const renderFileList = (searchTerm = '') => {
    const fileListDiv = document.getElementById('fileList');
    const { repo, files, index, currentPage, itemsPerPage } = appState.getState();

    // If no files, display message
    if (!files || files.length === 0) {
       return;
    }

    const hasWritePermission = repo.permissions.push;

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

    // Sort so that directories come first
    filteredFiles.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') {
            return -1;
        } else if (a.type !== 'dir' && b.type === 'dir') {
            return 1;
        } else {
            // If both are of the same type, you can sort alphabetically (optional)
            return a.name.localeCompare(b.name);
        }
    });

    // Calculate pagination
    const totalItems = filteredFiles.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Ensure currentPage is within valid range
    const page = Math.min(Math.max(currentPage, 1), totalPages);

    // Calculate start and end indices
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    // Get the files for the current page
    const filesToDisplay = filteredFiles.slice(startIndex, endIndex);

    // Generate HTML for the file list
    fileListDiv.innerHTML = `
        ${filesToDisplay.map(file => {
            const keyValue = index[file.name] || '';
            // Remove the file extension from the file name for display
            const displayName = getFileNameWithoutExtension(file.name);

            // Check if the item is a directory
            if (file.type === 'dir') {
                // Render directory item
                return `
                    <div class="list-group-item d-flex align-items-center">
                        <div class="d-flex flex-column flex-grow-1 me-3 overflow-hidden">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-folder-fill text-warning me-2"></i>
                                <strong class="text-truncate">${file.name}</strong>
                            </div>
                            <small class="text-muted text-truncate">&nbsp;</small>
                        </div>
                        <div class="d-flex flex-shrink-0">
                            <button class="btn btn-outline-primary btn-sm openDirBtn" data-path="${file.name}">
                                <i class="bi bi-arrow-right"></i> Open
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Render file item
                return `
                    <div class="list-group-item d-flex align-items-center">
                        <div class="d-flex flex-column flex-grow-1 me-3 overflow-hidden">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-file-earmark-text me-2"></i>
                                <strong class="text-truncate">${displayName}</strong>
                            </div>
                            <small class="text-muted text-truncate">${keyValue}</small>
                        </div>
                        <div class="d-flex flex-shrink-0">
                            <button class="btn btn-outline-primary btn-sm viewFileBtn me-2" data-bs-file="${file.name}">
                                <i class="bi bi-eye"></i> View
                            </button>
                            ${hasWritePermission ? 
                                `<button class="btn btn-outline-primary btn-sm modifyFileBtn me-2" data-bs-file="${file.name}">
                                    <i class="bi bi-pencil"></i> Modify
                                </button>
                                <button class="btn btn-outline-danger btn-sm deleteFileBtn" data-bs-file="${file.name}" data-bs-sha="${file.sha}">
                                    <i class="bi bi-trash"></i> Delete
                                </button>`
                                : ``
                            }
                        </div>
                    </div>
                `;
            }
        }).join('')}
    `;

    // Render pagination controls
    renderPaginationControls(totalPages, page);

    // Add event listeners for directory open buttons
    const openDirButtons = document.querySelectorAll('.openDirBtn');
    openDirButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const path = event.currentTarget.getAttribute('data-path');
            const { repo, directory } = appState.getState();
            const fullPath = directory ? `${directory}/${path}` : path;

            await executeWithAnimation(renderRepoContent, repo, fullPath);
        });
    });

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

    // for each view button, add listener to render view modal
    const viewButtons = document.querySelectorAll('.viewFileBtn');
    viewButtons.forEach(button => {
        button.addEventListener('click', event => {
            renderViewModal(event);
        });
    });
};

const renderPaginationControls = (totalPages, currentPage) => {
    const paginationDiv = document.getElementById('paginationControls');

    // If there are no pages or only one page, do not display pagination controls
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let paginationHTML = '<nav aria-label="Page navigation"><ul class="pagination justify-content-center">';

    // Previous Button
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" aria-label="Previous" data-page="${currentPage - 1}">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }

    // Next Button
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" aria-label="Next" data-page="${currentPage + 1}">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;

    paginationHTML += '</ul></nav>';

    paginationDiv.innerHTML = paginationHTML;

    // Attach event listeners to pagination links
    const pageLinks = paginationDiv.querySelectorAll('.page-link');
    pageLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const page = parseInt(link.getAttribute('data-page'));
            if (!isNaN(page)) {
                appState.setState({ currentPage: page });
                renderFileList(document.getElementById('searchFiles').value);
            }
        });
    });
};

export const refreshHomePage = async () => {
    
    const { repo, directory } = appState.getState();
    if (repo) {
        await executeWithAnimation(renderRepoContent, repo, directory || '');
    }
}

const directoryBack = async () => {
    const { repo, directory } = appState.getState();
    const newDirectory = directory.split('/').slice(0, -1).join('/');
    await executeWithAnimation(renderRepoContent, repo, newDirectory);
}