import { appState, executeWithAnimation, fromBase64 } from './common.js';
import { getFiles, getRepoContents, getUserRepositories, getConfigurationSettings } from './api.js';
import { renderAddModal, renderDeleteModal, renderAddFolderModal, renderViewModal, renderConfigModal } from './modals.js';
import { generateSpreadsheet } from './files.js';
import { structureFiles } from './dictionary.js';
import { HOMEPAGE_TEMPLATES } from './templates.js';

export const renderHomePage = async () => {
    
    appState.setState({ files: [], index: {}, objects: {}, currentPage: 1, itemsPerPage: 10 });

    const repos = await getUserRepositories();
    const homeDiv = document.getElementById('auth');

    // Use template to render repository list
    homeDiv.innerHTML = `
        <div class="container mt-4">
            <div class="list-group">
                ${repos.data.map(repo => HOMEPAGE_TEMPLATES.repositoryListItem(repo)).join('')}
            </div>
        </div>
    `;

    // Add event listeners for repository open buttons
    const openRepoButtons = document.querySelectorAll('.openRepoBtn');
    openRepoButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const repoName = event.currentTarget.getAttribute('data-repo-name');
            const permissions = JSON.parse(event.currentTarget.getAttribute('data-permissions'));
            const repo = repos.data.find(r => r.name === repoName);
            
            // Update repo object with permissions for consistency
            repo.permissions = permissions;
            
            await executeWithAnimation(renderRepoContent, repo, '');
        });
    });
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
        let objectContent = {};

        // Find 'index.json' in the files list
        const indexFile = files.find(file => file.name === 'index.json');
        const objectFile = files.find(file => file.name === 'object.json');

        if (indexFile) {
            const indexResponse = await getFiles(indexFile.name); // Assuming getFiles can fetch individual files
            const indexContentString = fromBase64(indexResponse.data.content);
            indexContent = JSON.parse(indexContentString);
        }

        if (objectFile) {
            const objectResponse = await getFiles(objectFile.name);
            const objectContentString = fromBase64(objectResponse.data.content);
            objectContent = JSON.parse(objectContentString);
        }

        // Exclude index.json from the files list
        let filesWithoutIndex = files
                                .filter(file => file.name !== 'index.json')
                                .filter(file => file.name !== '.gitkeep')
                                .filter(file => file.name !== 'object.json')
                                .filter(file => file.name !== 'config.json');

        // If 'index.json' does NOT exist, display only directories
        if (!indexFile) {
            filesWithoutIndex = filesWithoutIndex.filter(file => file.type === 'dir');
        }

        // Update appState with files and index
        appState.setState({ files: filesWithoutIndex, index: indexContent, objects: objectContent });

        await getConfigurationSettings();
        renderSearchBar();
        renderFileList();
    } catch (error) {
        console.error('Error fetching files or index:', error);
    }
}

const renderSearchBar = () => {
    const authDiv = document.getElementById('auth');

    // Use template for search bar and controls
    authDiv.innerHTML = HOMEPAGE_TEMPLATES.searchBarAndControls();

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
        executeWithAnimation(renderAddModal);
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

    const configButton = document.getElementById('configButton');
    configButton.addEventListener('click', () => {
        renderConfigModal();
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

    // Generate HTML for the file list using templates
    fileListDiv.innerHTML = filesToDisplay.map(file => {
        const keyValue = index[file.name] || '';
        const displayName = getFileNameWithoutExtension(file.name);

        // Use appropriate template based on file type
        if (file.type === 'dir') {
            return HOMEPAGE_TEMPLATES.directoryItem(file);
        } else {
            return HOMEPAGE_TEMPLATES.fileItem(file, displayName, keyValue, hasWritePermission);
        }
    }).join('');

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

    // Use template for pagination controls
    paginationDiv.innerHTML = HOMEPAGE_TEMPLATES.paginationControls(totalPages, currentPage);

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