import { appState, hideAnimation, escapeHtml, isTokenError, clearAuthenticationState, executeWithAnimation } from "./src/common.js";
import { getAccessToken, getUserDetails } from "./src/api.js";
import { login } from "./src/login.js";
import { renderHomePage } from "./src/homepage.js";
import { addEventFileDrop, addEventDropClicked, addEventHomeIconClick } from "./src/events.js";
import { WELCOME_TEMPLATES } from "./src/templates.js";
import { CONFIG, PAGINATION_CONFIG, DOM_ELEMENTS } from "./src/config.js";

// Expose appState to window for debugging in console
// Usage in console: appState.getState() or appState.setState({key: value})
window.appState = appState;

/**
 * Initializes the application when the window loads
 */
window.onload = async () => {
    initializeApp();
}

// Initialize event listeners for drag & drop functionality
addEventDropClicked();
addEventFileDrop();

/**
 * Main application initialization handler
 * Simplified flow without hash-based routing
 */
const initializeApp = async () => {
    try {
        // Initialize application state first
        initializeAppState();
        
        // Check for OAuth callback first
        if (isOAuthCallback()) {
            executeWithAnimation(handleCallback);
        } else {
            // Handle normal app flow
            executeWithAnimation(handleAppFlow);
        }
    } catch (error) {
        console.error('Application initialization error:', error);
        hideAnimation();
        handleInitializationError(error);
    }
};

/**
 * Initializes the application state with default values
 * Centralized state initialization for consistency
 */
const initializeAppState = () => {
    const accessToken = sessionStorage.getItem(CONFIG.SESSION_TOKEN_KEY);
    
    appState.setState({ 
        isLoggedIn: !!accessToken,
        files: [],
        index: {},
        currentPage: PAGINATION_CONFIG.DEFAULT_CURRENT_PAGE,
        itemsPerPage: PAGINATION_CONFIG.DEFAULT_ITEMS_PER_PAGE,
        user: null,
        lastError: null
    });
};

/**
 * Checks if current request is an OAuth callback
 * @returns {boolean} True if this is an OAuth callback
 */
const isOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has(CONFIG.URL_PARAMS.AUTH_CODE);
};

/**
 * Handles initialization errors gracefully
 * @param {Error} error - The error that occurred during initialization
 */
const handleInitializationError = (error) => {
    console.error('Initialization failed:', error);
    
    // Store error in state for potential display
    appState.setState({ lastError: error.message });
    
    // Attempt graceful fallback
    try {
        clearAuthenticationState(CONFIG.SESSION_TOKEN_KEY);
        login();
    } catch (fallbackError) {
        console.error('Fallback to login also failed:', fallbackError);
        // Last resort: reload the page
        window.location.reload();
    }
};

/**
 * Handles the main application flow after authentication check
 * Simplified flow without hash-based routing
 */
const handleAppFlow = async () => {
    const { isLoggedIn } = appState.getState();
    
    if (isLoggedIn) {
        await handleAuthenticatedFlow();
    } else {
        login(); // Always show login for unauthenticated users
    }
};

/**
 * Handles authenticated user flow
 * Manages user data loading and UI initialization
 */
const handleAuthenticatedFlow = async () => {
    try {
        await initializeAuthenticatedUser();
    } catch (error) {
        console.error('Authenticated flow error:', error);
        
        // If token is invalid, clear it and show login
        if (isTokenError(error)) {
            clearAuthenticationState(CONFIG.SESSION_TOKEN_KEY);
            login();
        } else {
            // Show error to user but stay authenticated
            appState.setState({ lastError: error.message });
        }
    }
};

/**
 * Initializes the interface for authenticated users
 * Loads user data and sets up the authenticated UI
 */
const initializeAuthenticatedUser = async () => {
    try {
        // Load user data from GitHub API
        const userData = await loadUserData();
        
        // Update application state with user information
        appState.setState({ user: userData });

        // Create user interface elements
        renderUserInterface(userData);
        
        // Always render homepage for authenticated users
        await renderHomePage();
        
    } catch (error) {
        console.error('Failed to initialize authenticated user:', error);
        throw error; // Re-throw to be handled by caller
    }
};

/**
 * Loads user data from GitHub API with error handling
 * @returns {Object} User data from GitHub API
 */
const loadUserData = async () => {
    try {
        const response = await getUserDetails();
        
        if (!response?.data) {
            throw new Error('Invalid user data received from GitHub API');
        }
        
        return response.data;
    } catch (error) {
        console.error('Failed to load user data:', error);
        throw new Error(`Unable to load user information: ${error.message}`);
    }
};

/**
 * Creates the welcome user interface with avatar and navigation
 * Uses templates and events modules
 */
const renderUserInterface = (userData) => {
    const welcomeUserElement = document.getElementById(DOM_ELEMENTS.WELCOME_USER);
    if (!welcomeUserElement) {
        console.warn('Welcome user element not found');
        return;
    }

    // Use template from templates module for consistency
    welcomeUserElement.innerHTML = WELCOME_TEMPLATES.userHeader(userData, DOM_ELEMENTS, escapeHtml);

    // Attach event handlers using events module
    addEventHomeIconClick(renderHomePage);
};

/**
 * Handles OAuth callback from GitHub after user authorization
 * Exchanges authorization code for access token and updates application state
 * TODO: Add token expiration handling and refresh logic
 * TODO: Validate token before storing (check scopes, etc.)
 */
const handleCallback = async () => {
    try {
        const code = new URL(window.location.href).searchParams.get(CONFIG.URL_PARAMS.AUTH_CODE);
        
        if (!code) {
            console.warn('No authorization code found in callback URL');
            login();
            return;
        }

        // Clean up URL by removing the code parameter
        // Security: Prevents code from being logged or shared accidentally
        cleanupCallbackUrl();

        // Exchange code for access token
        const tokenObject = await getAccessToken(code);
        
        if (tokenObject?.access_token) {
            // Store token securely in sessionStorage (not localStorage for security)
            sessionStorage.setItem(CONFIG.SESSION_TOKEN_KEY, tokenObject.access_token);
            appState.setState({ isLoggedIn: true });
            
            // TODO: Store token expiration time if available
            // TODO: Validate token scopes match what we requested
            
            // Initialize authenticated user and render homepage
            await initializeAuthenticatedUser();
        } else {
            console.error('Failed to obtain access token');
            login();
        }
    } catch (error) {
        console.error('OAuth callback error:', error);
        login();
    }
};

/**
 * Cleans up the callback URL by removing sensitive parameters
 * Security: Prevents authorization code from being accidentally logged or shared
 */
const cleanupCallbackUrl = () => {
    const url = new URL(window.location);
    url.searchParams.delete(CONFIG.URL_PARAMS.AUTH_CODE);
    window.history.pushState({}, '', url);
};



