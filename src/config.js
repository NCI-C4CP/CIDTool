export const CLIENT_ID = 'Ov23liu5RSq1PMWSLLqh';
export const REDIRECT_URI = 'https://nci-c4cp.github.io/CIDTool/';
export const CLIENT_ID_LOCAL = 'Ov23liVVaSBQIH0ahnn7';
export const REDIRECT_URI_LOCAL = 'http://localhost:5000/';

/**
 * Application configuration constants
 * Centralized configuration for consistent application behavior
 */
export const CONFIG = {
    ITEMS_PER_PAGE: 10,
    SESSION_TOKEN_KEY: 'gh_access_token',
    URL_PARAMS: {
        AUTH_CODE: 'code'
    },
    CONCEPT_FORMAT: '^\\d{9}$'
};

/**
 * DOM element identifiers used throughout the application
 * Centralized to avoid magic strings and enable easy refactoring
 */
export const DOM_ELEMENTS = {
    // Header/Navigation elements
    WELCOME_USER: 'welcomeUser',
    HOME_ICON: 'homeIcon',
    
    // Authentication elements
    LOGIN_BUTTON: 'login',
    
    // File import/drop elements
    DROP_ZONE: 'drop-zone',
    DROP_ZONE_CONTENT: 'drop-zone-content',
    IMPORT_BUTTON: 'import-button',
    IMPORT_MODAL: 'importModal',
    
    // Save/Action buttons
    REMOTE_SAVE_BUTTON: 'remote-save-button',
    SAVE_BUTTON: 'save-button'
};

/**
 * Pagination configuration constants
 * Centralized pagination settings for consistent behavior across the application
 */
export const PAGINATION_CONFIG = {
    DEFAULT_ITEMS_PER_PAGE: 10,
    DEFAULT_CURRENT_PAGE: 1
};

/**
 * File filtering configuration
 * Defines which files should be excluded from repository browsing
 */
export const FILE_FILTERS = {
    EXCLUDED_FILES: ['index.json', '.gitkeep', 'object.json', 'config.json']
};

/**
 * Performance optimization settings
 */
export const PERFORMANCE_CONFIG = {
    /** Delay in milliseconds for search input debouncing */
    SEARCH_DEBOUNCE_DELAY: 300,
    /** Duration in milliseconds for UI animations */
    ANIMATION_DURATION: 250
};

/**
 * API configuration settings
 */
export const API_CONFIG = {
    /** Base URL for the GitHub authentication API */
    BASE_URL: 'https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=',
    /** Development base URL for local testing */
    BASE_URL_LOCAL: 'http://localhost:8080/ghauth?api=',
    /** Session storage key for GitHub access token */
    TOKEN_KEY: 'gh_access_token',
    /** Default commit messages for different operations */
    COMMIT_MESSAGES: {
        ADD_FILE: 'file added via CID Tool',
        ADD_FOLDER: 'folder added via CID Tool',
        UPDATE_FILE: 'file modified via CID Tool',
        DELETE_FILE: 'file deleted via CID Tool'
    },
    /** HTTP status codes for error handling */
    STATUS_CODES: {
        OK: 200,
        CREATED: 201,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        UNPROCESSABLE_ENTITY: 422,
        INTERNAL_SERVER_ERROR: 500
    },
    /** Request timeout in milliseconds */
    TIMEOUT: 30000
};

/**
 * Modal configuration settings
 */
export const MODAL_CONFIG = {
    /** Default modal element selector */
    MODAL_SELECTOR: '#modal',

    /** CSS classes for different modal types */
    MODAL_CLASSES: {
        SUCCESS: 'btn-outline-success',
        DANGER: 'btn-outline-danger',
        PRIMARY: 'btn-outline-primary',
        SECONDARY: 'btn-outline-secondary'
    },

    /** Default concept types for configuration */
    CONCEPT_TYPES: ['PRIMARY', 'SECONDARY', 'SOURCE', 'QUESTION', 'RESPONSE'],

    /** Field types available in configuration */
    FIELD_TYPES: [
        { value: 'text', label: 'Text' },
        { value: 'concept', label: 'Concept' },
        { value: 'reference', label: 'Reference' },
        { value: 'array', label: 'Array' }
    ],

    /** Validation messages */
    VALIDATION_MESSAGES: {
        REQUIRED_FIELD: 'This field is required.',
        INVALID_FORMAT: 'Invalid format.',
        KEY_EXISTS: 'This key already exists. Please use a unique key.',
        INVALID_FOLDER_NAME: 'Folder Name contains illegal characters.',
        SAVE_ERROR: 'An error occurred while saving.',
        DELETE_CONFIRM: 'Are you sure you want to delete this item?'
    },
    
    /** File name validation regex */
    ILLEGAL_CHARS_REGEX: /[\\/:*?"<>|]/
};