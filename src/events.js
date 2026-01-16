import { isLocal, preventDefaults, executeWithAnimation, debounce, appState } from './common.js';
import { CLIENT_ID, REDIRECT_URI, CLIENT_ID_LOCAL, REDIRECT_URI_LOCAL, DOM_ELEMENTS, PERFORMANCE_CONFIG } from './config.js';
import { objectDropped, setupImportModal } from "./files.js";

/**
 * Adds click event listener to the login button for GitHub OAuth authentication
 * Redirects to GitHub OAuth with appropriate client ID and redirect URI based on environment
 */
export const addEventLoginButtonClick = () => {
    const loginButton = document.getElementById(DOM_ELEMENTS.LOGIN_BUTTON);
    if (!loginButton) {
        console.warn(`Login button element '${DOM_ELEMENTS.LOGIN_BUTTON}' not found`);
        return;
    }

    const local = isLocal();
    const id = local ? CLIENT_ID_LOCAL : CLIENT_ID;
    const uri = local ? REDIRECT_URI_LOCAL : REDIRECT_URI;
    
    loginButton.addEventListener('click', () => {
        const url = `https://github.com/login/oauth/authorize?client_id=${id}&redirect_uri=${uri}&scope=repo`;
        window.location.href = url;
    });
}

/**
 * Sets up drag and drop event listeners for file/folder dropping functionality
 * Handles visual feedback (highlighting) and prevents default browser drag behavior
 */
export const addEventFileDrop = () => {
    // Get elements
    const dropZone = document.getElementById(DOM_ELEMENTS.DROP_ZONE);
    
    if (!dropZone) {
        console.warn(`Drop zone element '${DOM_ELEMENTS.DROP_ZONE}' not found`);
        return;
    }

    /**
     * Highlights the drop zone when dragging over it
     */
    const highlight = () => {
        dropZone.classList.add('drag-over');
    }
    
    /**
     * Removes highlight from the drop zone
     */
    const unhighlight = () => {
        dropZone.classList.remove('drag-over');
    }
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Handle drop
    dropZone.addEventListener('drop', objectDropped, false);

    // Highlight drop zone when item is dragged over it
    ['dragenter'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });   
}

/**
 * Sets up click event listener for the import button to show the import modal
 * Initializes the modal with default state (disabled buttons and reset content)
 */
export const addEventDropClicked = () => {
    const importButton = document.getElementById(DOM_ELEMENTS.IMPORT_BUTTON);
    
    if (!importButton) {
        console.warn(`Import button element '${DOM_ELEMENTS.IMPORT_BUTTON}' not found`);
        return;
    }
    
    // Set up state watcher to enable/disable import button based on repository
    setupStateWatcher(importButton, 'repo', updateImportButtonState);
    
    // Get the import modal element
    const importModalElement = document.getElementById(DOM_ELEMENTS.IMPORT_MODAL);
    
    if (!importModalElement) {
        console.warn(`Import modal element '${DOM_ELEMENTS.IMPORT_MODAL}' not found`);
        return;
    }

    // Create a Bootstrap modal instance for the import modal
    const importModal = new bootstrap.Modal(importModalElement, {
        backdrop: 'static',
    });

    // Add click event listener to the import button
    importButton.addEventListener('click', () => {
        // Check if we're in a repository before opening modal
        const { repo } = appState.getState();
        if (!repo) {
            alert('Please open a repository first to use the import feature.');
            return;
        }
        
        const dropZoneContent = document.getElementById(DOM_ELEMENTS.DROP_ZONE_CONTENT);
        const remoteSaveButton = document.getElementById(DOM_ELEMENTS.REMOTE_SAVE_BUTTON);

        // Reset modal content and state
        if (dropZoneContent) {
            dropZoneContent.innerHTML = 'Drag & Drop Dictionary Excel File Here';
        }

        // Hide and reset action buttons
        const actionButtons = document.getElementById('action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }

        if (remoteSaveButton) {
            remoteSaveButton.disabled = true;
            remoteSaveButton.hidden = true;
        }
        
        // Hide validation errors and import summary from previous imports
        const validationErrors = document.getElementById('validation-errors');
        if (validationErrors) {
            validationErrors.style.display = 'none';
        }
        
        const importSummary = document.getElementById('import-summary');
        if (importSummary) {
            importSummary.style.display = 'none';
        }
        
        // Reset file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }

        importModal.show();
        
        // Set up import modal functionality after it's shown
        setTimeout(() => {
            setupImportModal();
        }, 100);
    });
};

/**
 * Adds click event listener to the home icon for navigation
 * @param {string} homeIconId - The ID of the home icon element
 * @param {Function} renderHomePage - Function to render the home page
 */
export const addEventHomeIconClick = (renderHomePage) => {
    const homeIcon = document.getElementById(DOM_ELEMENTS.HOME_ICON);
    if (!homeIcon) {
        console.warn(`Home icon element '${DOM_ELEMENTS.HOME_ICON}' not found`);
        return;
    }

    homeIcon.addEventListener('click', async () => {
        try {
            executeWithAnimation(renderHomePage);
        } catch (error) {
            console.error('Failed to render home page:', error);
            // Could show error message to user here
        }
    });
};

/**
 * Adds click event listeners to repository open buttons
 * @param {Array} repos - Array of repository objects
 * @param {Function} renderRepoContent - Function to render repository content
 */
export const addEventOpenRepoButtons = (repos, renderRepoContent) => {
    const openRepoButtons = document.querySelectorAll('.openRepoBtn');
    openRepoButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const repoName = event.currentTarget.getAttribute('data-repo-name');
            const permissions = JSON.parse(event.currentTarget.getAttribute('data-permissions'));
            const repo = repos.find(r => r.name === repoName);
            
            // Update repo object with permissions for consistency
            repo.permissions = permissions;
            
            await executeWithAnimation(renderRepoContent, repo, '');
        });
    });
};

/**
 * Adds event listeners to search bar and control buttons
 * @param {Function} renderFileList - Function to render file list
 * @param {Function} renderAddFolderModal - Function to render add folder modal
 * @param {Function} renderAddModal - Function to render add modal
 * @param {Function} refreshHomePage - Function to refresh homepage
 * @param {Function} directoryBack - Function to navigate back
 * @param {Function} renderConfigModal - Function to render config modal
 * @param {Function} handleDownloadRepo - Function to handle repo download
 * @param {Function} handleRebuildIndex - Function to handle index rebuilding
 */
export const addEventSearchBarControls = (
    renderFileList, 
    renderAddFolderModal, 
    renderAddModal, 
    refreshHomePage, 
    directoryBack, 
    renderConfigModal, 
    handleDownloadRepo,
    handleRebuildIndex
) => {
    // Search input event listener with debouncing for improved performance
    const searchInput = document.getElementById('searchFiles');
    if (searchInput) {
        // Create debounced search function to avoid excessive renders while typing
        const debouncedSearch = debounce((searchTerm) => {
            renderFileList(searchTerm);
        }, PERFORMANCE_CONFIG.SEARCH_DEBOUNCE_DELAY);
        
        searchInput.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            debouncedSearch(searchTerm);
        });
    }

    // Add folder button
    const addFolderButton = document.getElementById('addFolder');
    if (addFolderButton) {
        addFolderButton.addEventListener('click', () => {
            renderAddFolderModal();
        });
    }

    // Add file button
    const addFileButton = document.getElementById('addFile');
    if (addFileButton) {
        addFileButton.addEventListener('click', () => {
            executeWithAnimation(renderAddModal);
        });
    }

    // Refresh button
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            refreshHomePage();
        });
    }

    // Back button
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', async () => {
            directoryBack();
        });
    }

    // Config button
    const configButton = document.getElementById('configButton');
    if (configButton) {
        configButton.addEventListener('click', () => {
            renderConfigModal();
        });
    }

    // Rebuild index button
    const rebuildIndexButton = document.getElementById('rebuildIndexButton');
    if (rebuildIndexButton) {
        rebuildIndexButton.addEventListener('click', async () => {
            await handleRebuildIndex(refreshHomePage);
        });
    }

    // Download repository button
    const downloadRepoButton = document.getElementById('downloadRepo');
    if (downloadRepoButton) {
        downloadRepoButton.addEventListener('click', async () => {
            handleDownloadRepo();
        });
    }
};

/**
 * Adds click event listeners to file list buttons (directory open, view, delete)
 * @param {Function} renderRepoContent - Function to render repository content
 * @param {Function} renderDeleteModal - Function to render delete modal
 * @param {Function} renderViewModal - Function to render view modal
 * @param {Function} appState - Application state manager
 */
export const addEventFileListButtons = (renderRepoContent, renderDeleteModal, renderViewModal, appState) => {
    // Directory open buttons
    const openDirButtons = document.querySelectorAll('.openDirBtn');
    openDirButtons.forEach(button => {
        button.addEventListener('click', async (event) => {
            const path = event.currentTarget.getAttribute('data-path');
            const { repo, directory } = appState.getState();
            const fullPath = directory ? `${directory}/${path}` : path;

            await executeWithAnimation(renderRepoContent, repo, fullPath);
        });
    });

    // Delete file buttons
    const deleteButtons = document.querySelectorAll('.deleteFileBtn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', event => {
            renderDeleteModal(event);
        });
    });

    // View file buttons
    const viewButtons = document.querySelectorAll('.viewFileBtn');
    viewButtons.forEach(button => {
        button.addEventListener('click', event => {
            renderViewModal(event);
        });
    });
};

/**
 * Adds click event listeners to pagination controls
 * @param {Function} appState - Application state manager
 * @param {Function} renderFileList - Function to render file list
 */
export const addEventPaginationControls = (appState, renderFileList) => {
    const paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;

    const pageLinks = paginationDiv.querySelectorAll('.page-link');
    pageLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const page = parseInt(link.getAttribute('data-page'));
            if (!isNaN(page)) {
                appState.setState({ currentPage: page });
                const searchInput = document.getElementById('searchFiles');
                const searchTerm = searchInput ? searchInput.value : '';
                renderFileList(searchTerm);
            }
        });
    });
};

/**
 * Sets up a state watcher for any element with a custom update function
 * @param {HTMLElement} element - The element to watch
 * @param {string} stateKey - The state key to watch for changes
 * @param {Function} updateFunction - Function to call when state changes
 */
const setupStateWatcher = (element, stateKey, updateFunction) => {
    // Set initial state
    updateFunction(element);
    
    // Watch for changes to the specified state key
    appState.watch(stateKey, (newValue) => {
        updateFunction(element);
    });
};

/**
 * Updates the import button's enabled/disabled state
 * @param {HTMLElement} importButton - The import button element
 */
const updateImportButtonState = (importButton) => {
    const { repo } = appState.getState();
    
    if (repo) {
        // Enable button when in repository
        importButton.disabled = false;
        importButton.classList.remove('text-muted');
        importButton.title = 'Import files or folders';
    } else {
        // Disable button when not in repository
        importButton.disabled = true;
        importButton.classList.add('text-muted');
        importButton.title = 'Open a repository to use import feature';
    }
};