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

import { appState, executeWithAnimation, showUserNotification, getErrorMessage } from './common.js';
import { getRepoTree, getIndexContent, getRepoContents, getUserRepositories, getConfigurationSettings } from './api.js';
import { renderAddModal, renderDeleteModal, renderViewModal, renderConfigModal } from './modals.js';
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
 * @description Refreshes the currently displayed repository content. Used when files
 * have been modified and the display needs to be updated.
 * 
 * @throws {Error} If repository content cannot be refreshed or API calls fail
 */
export const refreshHomePage = async () => {
    
    const { repo } = appState.getState();
    if (repo) {
        await executeWithAnimation(renderRepoContent, repo);
    }
}

/**
 * @async
 * @function renderRepoContent
 * @description Fetches and displays the concept files in a GitHub repository,
 * including index.json metadata for concept dictionary functionality.
 * 
 * @param {Object} repo - Repository object from GitHub API
 * @param {string} repo.owner.login - Repository owner's username
 * @param {string} repo.name - Repository name
 * @param {Object} repo.permissions - User's permissions for this repository
 * 
 * @throws {Error} If repository content cannot be fetched or parsed
 */
const renderRepoContent = async (repo) => {

    const owner = repo.owner.login;
    const repoName = repo.name;

    appState.setState({ repo, owner, repoName });

    try {
        // Trees API rather than a directory listing: contents caps at 1,000 entries
        const { files, truncated } = await getRepoTree(repo.default_branch);

        if (truncated) {
            showUserNotification('warning', 'This repository is too large to list completely. Some concepts are not shown.');
        }

        const indexContent = files.some(file => file.name === 'index.json')
            ? await getIndexContent()
            : {};

        // Exclude non-concept files: filter out excluded files and non-JSON files (e.g., README.md)
        const filesWithoutIndex = files.filter(file =>
            !FILE_FILTERS.EXCLUDED_FILES.includes(file.name) &&
            file.name.endsWith('.json')
        );

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
        document.getElementById('fileList').innerHTML = '<div class="alert alert-danger">Unable to load repository contents.</div>';
    }
}

/**
 * Renders the search bar and control buttons for repository browsing
 * 
 * @function renderSearchBar
 * @description Creates the main interface for repository browsing including:
 * - Search input for filtering files
 * - Refresh button
 * - Action buttons (add concept, configure, download)
 * - Placeholders for file list and pagination
 */
const renderSearchBar = () => {
    const authDiv = document.getElementById('auth');

    // Use template for search bar and controls
    authDiv.innerHTML = HOMEPAGE_TEMPLATES.searchBarAndControls();

    // Add event listeners for search bar and control buttons
    addEventSearchBarControls(
        renderFileList,
        renderAddModal,
        refreshHomePage,
        renderConfigModal,
        handleDownloadRepo
    );
};

/**
 * Renders the paginated file list with search functionality
 * 
 * @function renderFileList
 * @description Displays repository concept files in a paginated, searchable list.
 * Handles filtering, sorting, and pagination of repository contents.
 * 
 * @param {string} [searchTerm=''] - Optional search term to filter files
 */
const renderFileList = (searchTerm = '') => {
    const fileListDiv = document.getElementById('fileList');
    const { repo, files, index, currentPage } = appState.getState();

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

    // Sort alphabetically by file name
    filteredFiles.sort((a, b) => a.name.localeCompare(b.name));

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

        return HOMEPAGE_TEMPLATES.fileItem(file, displayName, keyValue, hasWritePermission);
    }).join('');

    // Render pagination controls
    renderPaginationControls(totalPages, page);

    // Add event listeners for file list buttons
    addEventFileListButtons(renderDeleteModal, renderViewModal);
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
    const { files } = appState.getState();
    const conceptFiles = files.filter(file => file.name.endsWith('.json'));
    const failed = [];

    for (const file of conceptFiles) {
        const fullPath = `${basePath}${file.name}`;

        if (zip.files[fullPath]) {
            try {
                const fileContent = await zip.files[fullPath].async('string');
                const jsonData = JSON.parse(fileContent);
                jsonDataArray.push(jsonData);
            } catch (error) {
                failed.push(file.name);
                console.error(`Error processing file ${file.name}:`, error);
            }
        } else {
            failed.push(file.name);
        }
    }

    if (failed.length > 0) {
        showUserNotification('warning', `${failed.length} of ${conceptFiles.length} concepts could not be read and were left out of the export.`);
    }

    const { data: structuredData, columnTypes } = structureFiles(jsonDataArray);
    generateSpreadsheet(structuredData, columnTypes);
};
