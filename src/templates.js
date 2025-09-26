/**
 * HTML Templates Module
 * Centralized repository for all HTML template literals used throughout the application
 * 
 * @module templates
 * @description This module contains all HTML templates as functions that return template literals.
 * Templates are organized by feature/page and support dynamic content through parameters.
 * 
 * Benefits:
 * - Separation of concerns (HTML separate from logic)
 * - Reusability across different modules
 * - Easier testing and maintenance
 * - Consistent styling and structure
 * 
 * @example
 * import { LOGIN_TEMPLATES } from './templates.js';
 * const html = LOGIN_TEMPLATES.loginPage({ isLoading: true });
 */

/**
 * Login page templates
 * @namespace LOGIN_TEMPLATES
 */
export const LOGIN_TEMPLATES = {
    /**
     * Main login page template with GitHub OAuth button
     * @param {Object} options - Template configuration options
     * @param {boolean} options.isLoading - Whether to show loading state
     * @param {string} options.errorMessage - Error message to display (optional)
     * @returns {string} HTML template string
     */
    loginPage: ({ isLoading = false, errorMessage = '' } = {}) => `
        <div id="homepage" class="d-flex justify-content-center align-items-center vh-100">
            <div class="text-center">
                ${errorMessage ? LOGIN_TEMPLATES.errorAlert(errorMessage) : ''}
                
                <div class="mb-4">
                    <h2 class="mb-3">Welcome to CIDTool</h2>
                    <p class="text-muted">Connect your GitHub account to manage concept dictionaries</p>
                </div>
                
                ${LOGIN_TEMPLATES.loginButton({ isLoading })}
            </div>
        </div>
    `,

    /**
     * Login button template with loading state support
     * @param {Object} options - Button configuration
     * @param {boolean} options.isLoading - Whether button is in loading state
     * @returns {string} HTML button template
     */
    loginButton: ({ isLoading = false } = {}) => `
        <button id="login" 
                class="btn btn-primary btn-lg ${isLoading ? 'disabled' : ''}" 
                aria-label="Login with GitHub OAuth"
                title="Authenticate using your GitHub account"
                ${isLoading ? 'disabled' : ''}>
            ${isLoading 
                ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Connecting...'
                : '<i class="bi bi-github" aria-hidden="true"></i> Login with GitHub'
            }
        </button>
    `,

    /**
     * Error alert template for OAuth failures
     * @param {string} message - Error message to display
     * @returns {string} HTML alert template
     */
    errorAlert: (message) => `
        <div class="alert alert-danger alert-dismissible fade show mb-4" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Authentication Error:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `
};

/**
 * Common UI templates used across multiple pages
 * @namespace COMMON_TEMPLATES
 * @todo Add loading spinner template
 * @todo Add modal templates
 * @todo Add form field templates
 */
export const COMMON_TEMPLATES = {
    /**
     * Generic loading spinner template
     * @param {Object} options - Spinner configuration
     * @param {string} options.size - Spinner size ('sm', 'md', 'lg')
     * @param {string} options.message - Loading message
     * @returns {string} HTML loading spinner template
     */
    loadingSpinner: ({ size = 'md', message = 'Loading...' } = {}) => `
        <div class="d-flex justify-content-center align-items-center p-4">
            <div class="text-center">
                <div class="spinner-border spinner-border-${size}" role="status" aria-hidden="true"></div>
                <div class="mt-2">${message}</div>
            </div>
        </div>
    `,

    /**
     * Generic error message template
     * @param {Object} options - Error configuration
     * @param {string} options.title - Error title
     * @param {string} options.message - Error message
     * @param {boolean} options.dismissible - Whether error can be dismissed
     * @returns {string} HTML error template
     */
    errorMessage: ({ title = 'Error', message, dismissible = true } = {}) => `
        <div class="alert alert-danger ${dismissible ? 'alert-dismissible' : ''} fade show" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>${title}:</strong> ${message}
            ${dismissible ? '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' : ''}
        </div>
    `
};

/**
 * Welcome/Header templates for authenticated users
 * @namespace WELCOME_TEMPLATES
 * TODO move DOM ELEMENTS to config.js
 */
export const WELCOME_TEMPLATES = {
    /**
     * Template for welcome user interface with avatar and navigation
     * @param {Object} userData - User data from GitHub API
     * @param {Object} domElements - DOM element IDs object
     * @param {Function} escapeHtml - HTML escaping function
     * @returns {string} HTML template for welcome user interface
     */
    userHeader: (userData, domElements, escapeHtml) => `
        <span>
            <i id="${domElements.HOME_ICON}" 
               class="bi bi-house-fill" 
               style="cursor: pointer; font-size: 1.5rem;"
               title="Go to homepage"
               aria-label="Navigate to homepage"></i>
            Welcome, <strong>${escapeHtml(userData.name)}</strong>
            <img src="${userData.avatar_url}" 
                 class="rounded-circle" 
                 style="width: 30px; height: 30px; margin-left: 8px; margin-right: 8px;"
                 alt="${escapeHtml(userData.name)}'s avatar"
                 loading="lazy">
        </span>
    `
};

/**
 * Template utilities and helpers
 * @namespace TEMPLATE_UTILS
 */
export const TEMPLATE_UTILS = {
    /**
     * Sanitizes HTML content to prevent XSS attacks
     * @param {string} content - Content to sanitize
     * @returns {string} Sanitized content
     * 
     * @todo Implement proper HTML sanitization
     * @todo Consider using DOMPurify library for production
     */
    sanitize: (content) => {
        // Basic HTML escaping - TODO: Use proper sanitization library
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    },

    /**
     * Wraps content in a container with optional classes
     * @param {string} content - Content to wrap
     * @param {string} containerClass - CSS classes for container
     * @returns {string} Wrapped content
     */
    wrapContainer: (content, containerClass = 'container') => `
        <div class="${containerClass}">
            ${content}
        </div>
    `
};