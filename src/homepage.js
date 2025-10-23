/**
 * Homepage and Repository Browser Module
 * 
 * @module homepage
 * 
 * @requires common - Utility functions and state management
 * @requires api - GitHub API interaction functions
 * @requires modals - Modal dialog rendering functions
 * @requires files - File processing and spreadsheet generation
 * @requires dictionary - Data structuring functions
 * @requires templates - HTML template functions
 * @requires events - UI event handling functions
 */

import { appState, executeWithAnimation, fromBase64, showUserNotification, getErrorMessage, showAnimation, hideAnimation } from './common.js';
import { getFiles, getRepoContents, getUserRepositories, getConfigurationSettings, rebuildIndex } from './api.js';
import { renderAddModal, renderDeleteModal, renderAddFolderModal, renderViewModal, renderConfigModal } from './modals.js';
import { generateSpreadsheet } from './files.js';
import { structureFiles } from './dictionary.js';
import { HOMEPAGE_TEMPLATES } from './templates.js';
import { addEventOpenRepoButtons, addEventSearchBarControls, addEventFileListButtons, addEventPaginationControls } from './events.js';
import { PAGINATION_CONFIG, FILE_FILTERS, CONFIG } from './config.js';

/**
 * Renders the main homepage displaying the user's GitHub repositories
 * 
 * @async
 * @function renderHomePage
 * @description This is the main entry point for the authenticated user interface.
 * It fetches and displays a list of the user's GitHub repositories, allowing them
 * to select which repository to browse for concept dictionary management.
 * 
 * @throws {Error} If GitHub API fails or user repositories cannot be fetched
 */
export const renderHomePage = async () => {
    
    appState.setState({ 
        files: [], 
        index: {}, 
        objects: {}, 
        currentPage: PAGINATION_CONFIG.DEFAULT_CURRENT_PAGE, 
        itemsPerPage: PAGINATION_CONFIG.DEFAULT_ITEMS_PER_PAGE,
        repo: null
    });

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
    addEventOpenRepoButtons(repos.data, renderRepoContent);
}

/**
 * @async
 * @function refreshHomePage
 * @description Refreshes the currently displayed repository content without
 * losing the user's current location (directory path). Used when files have
 * been modified and the display needs to be updated.
 * 
 * @throws {Error} If repository content cannot be refreshed or API calls fail
 */
export const refreshHomePage = async () => {
    
    const { repo, directory } = appState.getState();
    if (repo) {
        await executeWithAnimation(renderRepoContent, repo, directory || '');
    }
}

/**
 * @async
 * @function renderRepoContent
 * @description Fetches and displays the contents of a GitHub repository directory,
 * including concept files, folders, and metadata. Handles index.json
 * files for concept dictionary functionality.
 * 
 * @param {Object} repo - Repository object from GitHub API
 * @param {string} repo.owner.login - Repository owner's username
 * @param {string} repo.name - Repository name
 * @param {Object} repo.permissions - User's permissions for this repository
 * @param {string} directory - Path to the directory within the repository
 * 
 * @throws {Error} If repository content cannot be fetched or parsed
 */
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

        // Exclude files using configuration constants
        let filesWithoutIndex = files.filter(file => !FILE_FILTERS.EXCLUDED_FILES.includes(file.name));

        // If 'index.json' does NOT exist, display only directories
        if (!indexFile) {
            filesWithoutIndex = filesWithoutIndex.filter(file => file.type === 'dir');
        }

        // Update appState with files and index
        appState.setState({ files: filesWithoutIndex, index: indexContent });

        await getConfigurationSettings();
        renderSearchBar();
        renderFileList();
    } catch (error) {
        console.error('Error fetching files or index:', error);
        showUserNotification('error', getErrorMessage(error));
        
        // Still render the basic interface so user can navigate back
        renderSearchBar();
        document.getElementById('file-list').innerHTML = '<div class="alert alert-danger">Unable to load repository contents.</div>';
    }
}

/**
 * Renders the search bar and control buttons for repository browsing
 * 
 * @function renderSearchBar
 * @description Creates the main interface for repository browsing including:
 * - Search input for filtering files
 * - Navigation buttons (refresh, back)
 * - Action buttons (add folder, add concept, configure, download)
 * - Placeholders for file list and pagination
 */
const renderSearchBar = () => {
    const authDiv = document.getElementById('auth');

    // Use template for search bar and controls
    authDiv.innerHTML = HOMEPAGE_TEMPLATES.searchBarAndControls();

    // Add event listeners for search bar and control buttons
    addEventSearchBarControls(
        renderFileList,
        renderAddFolderModal,
        renderAddModal,
        refreshHomePage,
        directoryBack,
        renderConfigModal,
        handleDownloadRepo,
        handleRebuildIndex
    );
};

/**
 * Renders the paginated file list with search functionality
 * 
 * @function renderFileList
 * @description Displays repository files and directories in a paginated, searchable list.
 * Handles filtering, sorting, and pagination of repository contents.
 * 
 * @param {string} [searchTerm=''] - Optional search term to filter files
 */
const renderFileList = (searchTerm = '') => {
    const fileListDiv = document.getElementById('fileList');
    const { repo, files, index, currentPage, itemsPerPage } = appState.getState();

    // If no files, display message
    if (!files || files.length === 0) {
       return;
    }

    const hasWritePermission = repo.permissions.push;

    /**
     * Removes file extension from filename for display purposes
     * @param {string} fileName - The filename to process
     * @returns {string} Filename without extension
     */
    const getFileNameWithoutExtension = (fileName) => {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1) return fileName; // No dot found, return original name
        return fileName.substring(0, lastDotIndex);
    };

    // Filter files based on the search term
    const filteredFiles = files.filter(file => {
        // Access key from new index structure: index._files[filename].key
        const fileData = index._files?.[file.name];
        const keyValue = fileData?.key || '';
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
    const totalPages = Math.ceil(totalItems / CONFIG.ITEMS_PER_PAGE);

    // Ensure currentPage is within valid range
    const page = Math.min(Math.max(currentPage, 1), totalPages);

    // Calculate start and end indices
    const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + CONFIG.ITEMS_PER_PAGE, totalItems);

    // Get the files for the current page
    const filesToDisplay = filteredFiles.slice(startIndex, endIndex);

    // Generate HTML for the file list using templates
    fileListDiv.innerHTML = filesToDisplay.map(file => {
        // Access key from new index structure: index._files[filename].key
        const fileData = index._files?.[file.name];
        const keyValue = fileData?.key || '';
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

    // Add event listeners for file list buttons
    addEventFileListButtons(renderRepoContent, renderDeleteModal, renderViewModal, appState);
};

/**
 * @function renderPaginationControls
 * @description Creates pagination interface with previous/next buttons and page numbers.
 * Automatically hides pagination if there's only one page or no content.
 * 
 * @param {number} totalPages - Total number of pages available
 * @param {number} currentPage - Currently active page number (1-indexed)
 */
const renderPaginationControls = (totalPages, currentPage) => {
    const paginationDiv = document.getElementById('paginationControls');

    // Use template for pagination controls
    paginationDiv.innerHTML = HOMEPAGE_TEMPLATES.paginationControls(totalPages, currentPage);

    // Attach event listeners to pagination links
    addEventPaginationControls(appState, renderFileList);
};

/**
 * @async
 * @function directoryBack
 * @description Moves up one level in the directory hierarchy by removing the last
 * directory segment from the current path and re-rendering the repository content.
 * 
 * @throws {Error} If navigation fails or parent directory cannot be accessed
 */
const directoryBack = async () => {
    const { repo, directory } = appState.getState();
    const newDirectory = directory.split('/').slice(0, -1).join('/');
    await executeWithAnimation(renderRepoContent, repo, newDirectory);
};

/**
 * Handles repository download functionality
 * 
 * @async
 * @function handleDownloadRepo
 * @description Downloads the entire repository as a ZIP file, extracts JSON concept files,
 * structures the data, and generates an Excel spreadsheet for download.
 * 
 * @throws {Error} If download fails, ZIP extraction fails, or spreadsheet generation fails
 */
const handleDownloadRepo = async () => {
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
                console.error(`Error processing file ${file.name}:`, error);
            }
        }
    }

    let structuredData = structureFiles(jsonDataArray);
    generateSpreadsheet(structuredData);
};

/**
 * Handles index rebuild functionality
 * 
 * @async
 * @function handleRebuildIndex
 * @param {Function} refreshHomePage - Function to refresh the homepage after rebuild
 * @description Calls the backend API to rebuild the index.json file for the current repository
 * 
 * @throws {Error} If rebuild fails or API call fails
 */
export const handleRebuildIndex = async (refreshHomePage) => {
    try {
        // Confirm with user before rebuilding
        const confirmed = confirm('Are you sure you want to rebuild the index.json file? This will scan all concept files and regenerate the index.');
        
        if (!confirmed) {
            return;
        }

        // Show loading animation
        showAnimation();
        
        // Call the rebuild API
        await rebuildIndex();
        
        // Show success message
        showUserNotification('success', 'Index rebuilt successfully!');
        
        // Refresh the page to show updated index
        if (refreshHomePage) {
            await refreshHomePage();
        }
        
    } catch (error) {
        console.error('Error rebuilding index:', error);
        showUserNotification('error', `Failed to rebuild index: ${getErrorMessage(error)}`);
    } finally {
        // Hide loading animation
        hideAnimation();
    }
};