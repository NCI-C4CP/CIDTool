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
    }
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