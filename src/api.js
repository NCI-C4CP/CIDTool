/**
 * GitHub API Integration Module
 * 
 * @module api
 * 
 * @requires config - Application configuration constants
 * @requires common - Utility functions and state management
 */

import { REDIRECT_URI, REDIRECT_URI_LOCAL, API_CONFIG } from './config.js';
import { toBase64, isLocal, appState, fromBase64, isTokenError, showUserNotification, getErrorMessage } from './common.js';

/**
 * Gets the appropriate API base URL based on environment
 * 
 * @returns {string} The API base URL
 */
const getApiBaseUrl = () => {
    return isLocal() ? API_CONFIG.BASE_URL_LOCAL : API_CONFIG.BASE_URL;
    // return API_CONFIG.BASE_URL;
};

/**
 * Creates standard headers for API requests
 * @param {boolean} includeAuth - Whether to include authorization header
 * @returns {Object} Headers object for fetch requests
 */
const createHeaders = (includeAuth = true) => {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    
    if (includeAuth) {
        const token = sessionStorage.getItem(API_CONFIG.TOKEN_KEY);
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }
    
    return headers;
};

/**
 * Validates API response and handles common error scenarios
 * 
 * @param {Response} response - Fetch response object
 * @param {string} operation - Description of the operation for error context
 * 
 * @returns {Promise<Response>} The validated response
 * @throws {Error} Throws error with user-friendly message for failed requests
 */
const validateResponse = async (response, operation) => {
    if (!response.ok) {
        const error = new Error(`${operation} failed`);
        error.status = response.status;
        error.statusText = response.statusText;
        
        // Handle token-related errors
        if (isTokenError(error)) {
            showUserNotification('error', 'Your session has expired. Please log in again.');
            // Could trigger logout flow here
        } else {
            showUserNotification('error', getErrorMessage(error));
        }
        
        throw error;
    }
    
    return response;
};

/**
 * Makes an authenticated API request with error handling
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @param {string} operation - Description of operation for error handling
 * @returns {Promise<any>} Parsed response data
 */
const makeApiRequest = async (endpoint, options = {}, operation = 'API request') => {
    const url = `${getApiBaseUrl()}${endpoint}`;
    
    const requestOptions = {
        headers: createHeaders(options.includeAuth !== false),
        ...options
    };
    
    try {
        const response = await fetch(url, requestOptions);
        await validateResponse(response, operation);
        
        // Handle different response types
        if (options.responseType === 'blob') {
            return await response.blob();
        } else if (options.responseType === 'text') {
            return await response.text();
        } else {
            return await response.json();
        }
    } catch (error) {
        console.error(`${operation} failed:`, error);
        throw error;
    }
};

/**
 * Builds file path from current state and optional filename
 * @param {string} fileName - Optional filename to append
 * @param {string} suffix - Optional suffix to append (e.g., '.json')
 * @returns {string} Complete file path
 */
const buildPath = (fileName = '', suffix = '') => {
    const { directory } = appState.getState();
    let path = directory ? `${directory}/` : '';
    
    if (fileName) {
        path += fileName;
    }
    
    if (suffix) {
        path += suffix;
    }
    
    return path;
};

/**
 * Retrieves the authenticated user's GitHub profile information
 * 
 * @async
 * @function getUserDetails
 * 
 * @returns {Promise<Object>} User profile data including login, name, avatar_url, etc.
 * @throws {Error} Throws error if request fails or user is not authenticated
 */
export const getUserDetails = async () => {
    return await makeApiRequest(
        'getUser', 
        { 
            method: 'GET' 
        }, 
        'Get user details'
    );
};

/**
 * Exchanges GitHub OAuth authorization code for access token
 * 
 * @async
 * @function getAccessToken
 * @param {string} code - OAuth authorization code from GitHub callback
 * 
 * @returns {Promise<Object>} Token response containing access_token and user info
 * @throws {Error} Throws error if token exchange fails
 */
export const getAccessToken = async (code) => {
    const local = isLocal();
    const uri = local ? REDIRECT_URI_LOCAL : REDIRECT_URI;
    const endpoint = `accessToken${local ? '&environment=dev' : ''}`;
    
    return await makeApiRequest(
        endpoint,
        {
            method: 'POST',
            includeAuth: false,
            body: JSON.stringify({
                code: code,
                redirect: uri
            })
        },
        'Get access token'
    );
};

/**
 * Downloads entire repository contents as a compressed archive
 * 
 * @async
 * @function getRepoContents
 * @returns {Promise<Blob>} Repository archive as blob for download
 * 
 * @throws {Error} Throws error if repository download fails
 */
export const getRepoContents = async () => {
    const { owner, repoName } = appState.getState();
    
    return await makeApiRequest(
        `getRepo&owner=${owner}&repo=${repoName}`,
        { 
            method: 'GET', 
            responseType: 'blob' 
        },
        'Download repository contents'
    );
};

/**
 * Creates a new file in the repository
 * 
 * @async
 * @function addFile
 * @param {string} fileName - Name of the file to create
 * @param {string} content - File content as string
 * @returns {Promise<Object>} GitHub API response with file details
 * 
 * @throws {Error} Throws error if file creation fails
 */
export const addFile = async (fileName, content) => {
    const { owner, repoName } = appState.getState();
    const path = buildPath(fileName);

    return await makeApiRequest(
        'addFile',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                path,
                message: API_CONFIG.COMMIT_MESSAGES.ADD_FILE,
                content: toBase64(content)
            })
        },
        'Add file'
    );
};

/**
 * Creates a new folder in the repository by adding a .gitkeep file
 * 
 * @async
 * @function addFolder
 * @param {string} folderName - Name of the folder to create
 * 
 * @returns {Promise<Object>} GitHub API response with .gitkeep file details
 * @throws {Error} Throws error if folder creation fails
 */
export const addFolder = async (folderName) => {
    const { owner, repoName } = appState.getState();
    const path = buildPath(folderName, '/.gitkeep');

    return await makeApiRequest(
        'addFile',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                path,
                message: API_CONFIG.COMMIT_MESSAGES.ADD_FOLDER,
                content: toBase64('')
            })
        },
        'Add folder'
    );
};

/**
 * Updates an existing file in the repository
 * 
 * @async
 * @function updateFile
 * @param {string} fileName - Name of the file to update
 * @param {string} content - New file content as string
 * @param {string} sha - Current SHA hash of the file (required for updates)
 * @returns {Promise<Object>} GitHub API response with updated file details
 * @throws {Error} Throws error if file update fails
 * 
 * @example
 * // Update an existing concept file
 * const result = await updateFile('concept.json', newContent, currentSha);
 * console.log(`File updated with new SHA: ${result.content.sha}`);
 */
export const updateFile = async (fileName, content, sha) => {
    const { owner, repoName } = appState.getState();
    const path = buildPath(fileName);

    return await makeApiRequest(
        'updateFile',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                path,
                sha,
                message: API_CONFIG.COMMIT_MESSAGES.UPDATE_FILE,
                content: toBase64(content)
            })
        },
        'Update file'
    );
};

/**
 * Deletes a file from the repository
 * 
 * @async
 * @function deleteFile
 * @param {string} fileName - Name of the file to delete
 * @param {string} sha - Current SHA hash of the file (required for deletion)
 * 
 * @returns {Promise<Object>} GitHub API response confirming deletion
 * @throws {Error} Throws error if file deletion fails
 */
export const deleteFile = async (fileName, sha) => {
    const { owner, repoName } = appState.getState();
    const path = buildPath(fileName);

    return await makeApiRequest(
        'deleteFile',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                path,
                sha,
                message: API_CONFIG.COMMIT_MESSAGES.DELETE_FILE
            })
        },
        'Delete file'
    );
};

/**
 * Retrieves files and directories from the repository
 * 
 * @async
 * @function getFiles
 * @param {string} [fileName=''] - Optional specific file name to retrieve
 * 
 * @returns {Promise<Object>} GitHub API response with file/directory listing or file content
 * @throws {Error} Throws error if file retrieval fails
 */
export const getFiles = async (fileName = '') => {
    const { owner, repoName } = appState.getState();
    const path = buildPath(fileName);
    
    return await makeApiRequest(
        `getFiles&owner=${owner}&repo=${repoName}&path=${path}`,
        { method: 'GET' },
        'Get files'
    );
};

/**
 * Retrieves all repositories accessible to the authenticated user
 * 
 * @async
 * @function getUserRepositories
 * 
 * @returns {Promise<Array>} Array of repository objects with name, owner, description, etc.
 * @throws {Error} Throws error if repository retrieval fails
 */
export const getUserRepositories = async () => {
    return await makeApiRequest(
        'getUserRepositories',
        { 
            method: 'GET' 
        },
        'Get user repositories'
    );
};

/**
 * Retrieves concept ID from the index.json file in current directory
 * 
 * @async
 * @function getConcept
 * 
 * @returns {Promise<string>} The concept ID from the index.json file
 * @throws {Error} Throws error if concept retrieval fails or index.json doesn't exist
 */
export const getConcept = async () => {
    const { owner, repoName } = appState.getState();
    const path = buildPath('', 'index.json');
    
    const data = await makeApiRequest(
        `getConcept&owner=${owner}&repo=${repoName}&path=${path}`,
        { 
            method: 'GET' 
        },
        'Get concept'
    );
    
    return data.conceptID;
};

/**
 * Retrieves and parses configuration settings from config.json file
 * Updates the application state with the loaded configuration
 * 
 * @async
 * @function getConfigurationSettings
 * 
 * @returns {Promise<void>} Doesn't return data, updates appState directly
 * @throws {Error} Throws error if configuration retrieval or parsing fails
 */
export const getConfigurationSettings = async () => {
    const { owner, repoName } = appState.getState();
    const path = buildPath('config.json');
    
    try {
        const responseData = await makeApiRequest(
            `getConfig&owner=${owner}&repo=${repoName}&path=${path}`,
            { 
                method: 'GET' 
            },
            'Get configuration settings'
        );
        
        const configContent = fromBase64(responseData.data.content);
        const config = JSON.parse(configContent);
        
        appState.setState({ config });
    } catch (error) {
        // Configuration is optional, so we don't want to show user errors for missing config
        console.warn('Configuration file not found or invalid, using defaults');
    }
};

/**
 * Retrieves concepts by their object type from the index
 * Uses the pre-built search index from index.json for instant results
 * @todo THIS ISN'T A LIVE API CALL
 * 
 * @function getConceptsByType
 * @param {string} conceptType - The concept type to search for (e.g., 'PRIMARY', 'SECONDARY', 'RESPONSE')
 * 
 * @returns {Object} Object containing files array that match the concept type
 * 
 * @example
 * const result = getConceptsByType('PRIMARY');
 * // Returns: { files: [{ name: '164242418.json', key: 'Primary3', object_type: 'PRIMARY' }, ...] }
 */
export const getConceptsByType = (conceptType) => {
    const { index } = appState.getState();
    
    // Get list of filenames from the pre-built type index
    const filenames = index._search?.by_type?.[conceptType] || [];
    
    // Return in a format compatible with the old API response
    return {
        files: filenames.map(filename => ({
            name: filename,
            // Include metadata from _files for additional context
            ...index._files?.[filename]
        }))
    };
};

/**
 * Checks if a concept is referenced by other concepts in the repository
 * 
 * @async
 * @function checkReferences
 * @param {string} conceptId - The concept ID to check for references
 * 
 * @returns {Promise<Array<string>>} Array of concept IDs that reference the given concept
 * @throws {Error} Throws error if reference checking fails
 */
export const checkReferences = async (conceptId) => {
    const { owner, repoName } = appState.getState();
    
    return await makeApiRequest(
        `searchFiles&owner=${owner}&repo=${repoName}&query=${conceptId}`,
        { 
            method: 'GET' 
        },
        'Check concept references'
    );
};

/**
 * Rebuilds the index.json file in the repository
 * 
 * @async
 * @function rebuildIndex
 * 
 * @returns {Promise<Object>} API response confirming index rebuild
 * @throws {Error} Throws error if index rebuild fails
 */
export const rebuildIndex = async () => {
    const { owner, repoName } = appState.getState();
    
    return await makeApiRequest(
        'rebuildIndex',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName
            })
        },
        'Rebuild index'
    );
};

/**
 * Validates if the current GitHub access token is still valid
 * 
 * @async
 * @function validateToken
 * 
 * @returns {Promise<boolean>} True if token is valid, false otherwise
 */
export const validateToken = async () => {
    const token = sessionStorage.getItem(API_CONFIG.TOKEN_KEY);
    if (!token) {
        return false;
    }
    
    try {
        await getUserDetails();
        return true;
    } catch (error) {
        if (isTokenError(error)) {
            return false;
        }
        // Other errors don't necessarily mean invalid token
        return true;
    }
};