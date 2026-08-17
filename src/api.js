/**
 * GitHub API Integration Module
 * 
 * @module api
 * 
 * @requires config - Application configuration constants
 * @requires common - Utility functions and state management
 */

import { REDIRECT_URI, REDIRECT_URI_LOCAL, API_CONFIG, RATE_LIMIT_WARN_THRESHOLD } from './config.js';
import { toBase64, isLocal, appState, fromBase64, isTokenError, showUserNotification, getErrorMessage } from './common.js';

/**
 * Gets the appropriate API base URL based on environment
 * 
 * @returns {string} The API base URL
 */
const getApiBaseUrl = () => {
    return isLocal() ? API_CONFIG.BASE_URL_LOCAL : API_CONFIG.BASE_URL;
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
    if (response.ok) return response;

    // Clone so the caller's responseType handling is unaffected if this ever stops throwing
    const details = await response.clone().json().catch(() => ({}));

    const error = new Error(`${operation} failed`);
    error.status = response.status;
    error.statusText = response.statusText;
    error.retryAfter = details.retryAfter;
    error.rateLimit = details.rateLimit;
    error.isRateLimit = response.status === 429;

    if (error.isRateLimit) {
        showUserNotification('error', getRateLimitMessage(error));
    } else if (isTokenError(error)) {
        showUserNotification('error', 'Your session has expired. Please log in again.');
        // Could trigger logout flow here
    } else {
        showUserNotification('error', getErrorMessage(error));
    }

    throw error;
};

/**
 * Builds the user-facing message for a GitHub rate limit rejection
 * @param {Error} error - Error carrying retryAfter/rateLimit details from the backend
 * @returns {string} Message describing the limit and when it lifts
 */
const getRateLimitMessage = (error) => {
    const resource = error.rateLimit?.resource ? `${error.rateLimit.resource} ` : '';
    const waitSeconds = error.retryAfter ?? error.rateLimit?.resetIn;

    if (waitSeconds) {
        return `GitHub ${resource}rate limit reached. Try again in ${formatDuration(waitSeconds)}.`;
    }

    return `GitHub ${resource}rate limit reached. Please wait before retrying.`;
};

/**
 * Formats a duration in seconds as a short human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} e.g. '45 seconds' or '12 minutes'
 */
const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
    return `${Math.ceil(seconds / 60)} minutes`;
};

/**
 * Records rate limit telemetry returned by the backend and warns when the budget runs low
 * 
 * @param {Object} payload - Parsed backend response, optionally carrying a rateLimit object
 * @param {string} operation - Description of the operation, for the console record
 */
let lastWarnedReset = null;

const recordRateLimit = (payload, operation) => {
    const rateLimit = payload?.rateLimit;
    if (!rateLimit || typeof rateLimit.remaining !== 'number') return;

    appState.setState({ rateLimit });

    const { limit, remaining, used, resource, resetIn, reset } = rateLimit;
    console.debug('[rate-limit]', { operation, resource, limit, remaining, used, resetIn });

    // Warn at most once per reset window so a long import doesn't spam the user
    if (limit > 0 && remaining / limit <= RATE_LIMIT_WARN_THRESHOLD && lastWarnedReset !== reset) {
        lastWarnedReset = reset;
        showUserNotification(
            'warning',
            `GitHub ${resource || 'API'} rate limit is nearly exhausted: ${remaining} of ${limit} remaining. Resets in ${formatDuration(resetIn ?? 0)}.`
        );
    }
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    requestOptions.signal = controller.signal;
    
    try {
        const response = await fetch(url, requestOptions);
        await validateResponse(response, operation);
        
        // Handle different response types
        if (options.responseType === 'blob') {
            return await response.blob();
        } else if (options.responseType === 'text') {
            return await response.text();
        } else {
            const payload = await response.json();
            recordRateLimit(payload, operation);
            return payload;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            const timeoutError = new Error(`${operation} timed out`);
            timeoutError.status = 408;
            showUserNotification('error', `${operation} timed out. Please try again.`);
            console.error(`${operation} timed out after ${API_CONFIG.TIMEOUT}ms`);
            throw timeoutError;
        }

        console.error(`${operation} failed:`, error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
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

    return await makeApiRequest(
        'addFile',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                path: fileName,
                message: API_CONFIG.COMMIT_MESSAGES.ADD_FILE,
                content: toBase64(content)
            })
        },
        'Add file'
    );
};

/**
 * Updates an existing file in the repository
 * 
 * @async
 * @function updateFile
 * @param {string} fileName - Name of the file to update
 * @param {string} content - New file content as string
 * @param {string} sha - Current SHA hash of the file (needed for updates)
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

    return await makeApiRequest(
        'updateFile',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                path: fileName,
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
 * @param {string} sha - Current SHA hash of the file (needed for deletion)
 * 
 * @returns {Promise<Object>} GitHub API response confirming deletion
 * @throws {Error} Throws error if file deletion fails
 */
export const deleteFile = async (fileName, sha) => {
    const { owner, repoName } = appState.getState();

    return await makeApiRequest(
        'deleteFile',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                path: fileName,
                sha,
                message: API_CONFIG.COMMIT_MESSAGES.DELETE_FILE
            })
        },
        'Delete file'
    );
};

/**
 * Retrieves files from the repository
 * 
 * @async
 * @function getFiles
 * @param {string} [fileName=''] - Optional specific file name to retrieve
 * 
 * @returns {Promise<Object>} GitHub API response with file listing or file content
 * @throws {Error} Throws error if file retrieval fails
 */
export const getFiles = async (fileName = '') => {
    const { owner, repoName } = appState.getState();
    
    return await makeApiRequest(
        `getFiles&owner=${owner}&repo=${repoName}&path=${fileName}`,
        { method: 'GET' },
        'Get files'
    );
};

/**
 * Lists every root-level .json file in the repository via the Git Trees API
 * 
 * Replaces the contents-API directory listing, which silently stops at 1,000 entries.
 * 
 * @async
 * @function getRepoTree
 * @param {string} ref - Branch name or commit SHA to read the tree from
 * 
 * @returns {Promise<Object>} `{ files, truncated }` where each file is `{ name, sha, size }`
 * @throws {Error} Throws error if the tree cannot be read
 */
export const getRepoTree = async (ref) => {
    const { owner, repoName } = appState.getState();

    const response = await makeApiRequest(
        `getTree&owner=${owner}&repo=${repoName}&ref=${encodeURIComponent(ref)}`,
        { method: 'GET' },
        'Get repository tree'
    );

    return {
        // `name` keeps the shape the file list already renders from
        files: (response.data || []).map(entry => ({
            name: entry.path,
            sha: entry.sha,
            size: entry.size
        })),
        truncated: response.truncated === true
    };
};

/**
 * Reads a repository file as raw text, bypassing the 1MB contents-API ceiling
 * 
 * @async
 * @function getFileContentRaw
 * @param {string} path - Repository-relative file path
 * 
 * @returns {Promise<string|null>} File contents, or null if the file does not exist
 * @throws {Error} Throws error for any failure other than a missing file
 */
export const getFileContentRaw = async (path) => {
    const { owner, repoName } = appState.getState();

    try {
        const response = await makeApiRequest(
            `getFileContent&owner=${owner}&repo=${repoName}&path=${encodeURIComponent(path)}`,
            { method: 'GET' },
            'Get file content'
        );

        return typeof response.content === 'string' ? response.content : null;
    } catch (error) {
        if (error.status === 404) return null;
        throw error;
    }
};

/**
 * Loads and parses the repository index.json
 * 
 * @async
 * @function getIndexContent
 * 
 * @returns {Promise<Object>} Parsed index, or an empty object when the repository has none
 * @throws {Error} Throws error if the index exists but cannot be read or parsed
 */
export const getIndexContent = async () => {
    const content = await getFileContentRaw('index.json');
    if (!content || !content.trim()) return {};

    return JSON.parse(content);
};

/**
 * Commits many files as a single commit via the Git Data API
 * 
 * The per-file Contents API costs 2 writes per concept against GitHub's 500-per-hour
 * secondary limit, which makes a large import impossible. This is 3 writes per batch,
 * and the files land atomically with index.json.
 * 
 * @async
 * @function commitFiles
 * @param {Array<Object>} files - Files to write, each `{ name, content }` with content as text
 * @param {Array<string>} [deletions=[]] - Paths to remove in the same commit
 * @param {string} [message] - Commit message
 * 
 * @returns {Promise<Object>} `{ commitSha, treeSha, committed, deleted }`
 * @throws {Error} Throws error if the commit fails or the branch moved
 */
export const commitFiles = async (files, deletions = [], message) => {
    const { owner, repoName, repo } = appState.getState();

    return await makeApiRequest(
        'commitFiles',
        {
            method: 'POST',
            body: JSON.stringify({
                owner,
                repo: repoName,
                branch: repo.default_branch,
                message: message || API_CONFIG.COMMIT_MESSAGES.IMPORT_FILES(files.length),
                files: files.map(file => ({ path: file.name, content: file.content })),
                deletions
            })
        },
        'Commit files'
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
 * Retrieves concept ID from the repository index.json file
 * 
 * @async
 * @function getConcept
 * 
 * @returns {Promise<string>} The concept ID from the index.json file
 * @throws {Error} Throws error if concept retrieval fails or index.json doesn't exist
 */
export const getConcept = async () => {
    const { owner, repoName } = appState.getState();
    
    const data = await makeApiRequest(
        `getConcept&owner=${owner}&repo=${repoName}&path=index.json`,
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
    
    try {
        const responseData = await makeApiRequest(
            `getConfig&owner=${owner}&repo=${repoName}&path=config.json`,
            { 
                method: 'GET' 
            },
            'Get configuration settings'
        );
        
        // Validate response structure before attempting to decode
        if (!responseData?.data?.content || typeof responseData.data.content !== 'string') {
            console.warn('Configuration file response missing content, using defaults');
            return;
        }
        
        const configContent = fromBase64(responseData.data.content);
        const config = JSON.parse(configContent);
        
        appState.setState({ config });
    } catch (error) {
        // Configuration is optional, so we don't want to show user errors for missing config
        // Check if it's a 404 (file not found) or other expected error
        if (error.status === 404) {
            console.warn('Configuration file not found, using defaults');
        } else {
            console.warn('Configuration file invalid or cannot be loaded, using defaults:', error.message);
        }
    }
};

/**
 * Retrieves concepts by their object type from the index
 * Filters the _files in index.json by object_type
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
    
    // Filter files by object_type from the _files index
    const files = index._files || {};
    const matchingFiles = Object.entries(files)
        .filter(([filename, fileData]) => fileData?.object_type === conceptType)
        .map(([filename, fileData]) => ({
            name: filename,
            ...fileData
        }));
    
    return { files: matchingFiles };
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