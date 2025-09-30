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
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="bi bi-exclamation-triangle" aria-hidden="true"></i>
            <strong>Authentication Error:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `
};

/**
 * Modal templates for various dialog types
 * @namespace MODAL_TEMPLATES
 */
export const MODAL_TEMPLATES = {
    /**
     * Standard modal footer with button configuration
     * @param {Array<Object>} buttons - Array of button configurations
     * @param {string} buttons[].text - Button text
     * @param {string} buttons[].class - Button CSS classes
     * @param {string} buttons[].attributes - Additional HTML attributes
     * @param {string} layout - Footer layout ('between', 'end', 'start')
     * @returns {string} Modal footer HTML
     */
    footer: (buttons, layout = 'between') => {
        const buttonElements = buttons.map(btn => 
            `<button type="button" class="btn ${btn.class}" ${btn.attributes || ''}>${btn.text}</button>`
        ).join('');
        
        const layoutClass = layout === 'between' ? 'justify-content-between' : 
                           layout === 'end' ? 'justify-content-end' : 'justify-content-start';
        
        return `
            <div class="w-100 d-flex ${layoutClass}">
                ${layout === 'between' ? '<div></div>' : ''}
                <div>${buttonElements}</div>
            </div>
        `;
    },

    /**
     * Concept type selector dropdown
     * @param {Array<string>} conceptTypes - Available concept types
     * @param {string} selectedType - Currently selected type
     * @returns {string} Concept type selector HTML
     */
    conceptTypeSelector: (conceptTypes, selectedType = 'PRIMARY') => `
        <div class="row mb-3">
            <div class="col-4">
                <label for="conceptType" class="col-form-label">Concept Type</label>
            </div>
            <div class="col-8">
                <select class="form-select" id="conceptType">
                    ${conceptTypes.map(type => `
                        <option value="${type}" ${type === selectedType ? 'selected' : ''}>${type}</option>
                    `).join('')}
                </select>
            </div>
        </div>
    `,

    /**
     * Dynamic form field containers
     * @returns {string} Container divs for dynamic field generation
     */
    dynamicFieldContainers: () => `
        <div id="templateFields"></div>
        <div id="additionalFields"></div>
    `,

    /**
     * File upload progress item
     * @param {string} fileName - Name of the file being uploaded
     * @returns {string} File upload progress row HTML
     */
    uploadProgressItem: (fileName) => `
        <div class="d-flex align-items-center mb-2">
            <div class="flex-grow-1">${fileName}</div>
            <div class="status-indicator">
                <span class="status-text ms-1">Pending...</span>
            </div>
        </div>
    `,

    /**
     * Upload progress status indicators
     */
    uploadStatus: {
        processing: () => `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span class="status-text ms-1">Processing...</span>
        `,
        success: () => '<span class="text-success">Uploaded successfully</span>',
        failed: () => '<span class="text-danger">Upload failed</span>'
    },

    /**
     * Form field row with label and input
     * @param {Object} field - Field configuration
     * @param {string} field.id - Field ID
     * @param {string} field.label - Field label
     * @param {string} field.required - Whether field is required
     * @param {string} inputHTML - HTML for the input element
     * @returns {string} Form field row HTML
     */
    formFieldRow: (field, inputHTML) => `
        <div class="row mb-3">
            <div class="col-4">
                <label for="${field.id}" class="col-form-label">
                    ${field.label}${field.required ? ' <span class="text-danger">*</span>' : ''}
                </label>
            </div>
            <div class="col-8">
                ${inputHTML}
            </div>
        </div>
    `,

    /**
     * Simple form field for edit mode
     * @param {Object} field - Field configuration
     * @param {string} inputHTML - HTML for the input element
     * @returns {string} Simple form field HTML
     */
    editFormField: (field, inputHTML) => `
        <div class="mb-3">
            <label for="edit_${field.id}" class="form-label">
                ${field.label}${field.required ? ' <span class="text-danger">*</span>' : ''}
            </label>
            ${inputHTML}
        </div>
    `,

    /**
     * Error message alert
     * @param {string} title - Error title
     * @param {string} message - Error message
     * @param {string} details - Additional error details (optional)
     * @returns {string} Error alert HTML
     */
    errorAlert: (title, message, details = '') => `
        <div class="alert alert-danger">
            <h6><i class="bi bi-exclamation-triangle"></i> ${title}</h6>
            <p>${message}</p>
            ${details ? `<small class="text-muted">${details}</small>` : ''}
        </div>
    `,

    /**
     * Confirmation dialog template with customizable title and message
     * @param {string} title - Dialog title 
     * @param {string} message - Confirmation message
     * @param {string} filePath - File path for context
     * @returns {string} Confirmation dialog HTML
     */
    confirmationDialog: (title, message, filePath) => `
        <div class="text-center py-3">
            <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
            <h5>${title}</h5>
            <p class="text-muted mb-3">${message}</p>
            <p class="small text-muted"><strong>File:</strong> ${filePath}</p>
        </div>
    `,

    /**
     * Info alert template for modal content
     * @param {string} message - Info message to display
     * @param {string} icon - Bootstrap icon class (default: 'info-circle')
     * @returns {string} Info alert HTML
     */
    infoAlert: (message, icon = 'info-circle') => `
        <div class="alert alert-info mb-3">
            <i class="bi bi-${icon}"></i> 
            ${message}
        </div>
    `,

    /**
     * Configuration tab structure
     * @param {Array<string>} tabTypes - Array of tab types
     * @param {Function} contentGenerator - Function to generate tab content
     * @returns {string} Tabbed interface HTML
     */
    configurationTabs: (tabTypes, contentGenerator) => {
        const tabHeaders = tabTypes.map((type, index) => `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${index === 0 ? 'active' : ''}" 
                    id="${type.toLowerCase()}-tab" 
                    data-bs-toggle="tab" 
                    data-bs-target="#${type.toLowerCase()}-pane" 
                    type="button" 
                    role="tab" 
                    aria-controls="${type.toLowerCase()}-pane" 
                    aria-selected="${index === 0 ? 'true' : 'false'}">
                    ${type}
                </button>
            </li>
        `).join('');

        const tabContent = tabTypes.map((type, index) => `
            <div class="tab-pane fade ${index === 0 ? 'show active' : ''}" 
                id="${type.toLowerCase()}-pane" 
                role="tabpanel" 
                aria-labelledby="${type.toLowerCase()}-tab" 
                tabindex="0">
                ${contentGenerator(type)}
            </div>
        `).join('');

        return `
            <ul class="nav nav-tabs" id="configTabs" role="tablist">
                ${tabHeaders}
            </ul>
            <div class="tab-content mt-3" id="configTabContent">
                ${tabContent}
            </div>
        `;
    }
};

/**
 * Form generation utilities for creating dynamic forms
 * @namespace FORM_UTILS
 */
export const FORM_UTILS = {
    /**
     * Generates input HTML based on field type
     * @param {Object} field - Field configuration
     * @param {string} value - Current field value
     * @param {string} prefix - ID prefix for form fields
     * @returns {string} Input HTML
     */
    generateInput: (field, value = '', prefix = '') => {
        const fieldId = prefix ? `${prefix}_${field.id}` : field.id;
        const attributes = field.required ? 'required' : '';
        
        switch (field.type) {
            case 'concept':
                return `<input type="text" class="form-control" id="${fieldId}" value="${value}" readonly>`;
                
            case 'reference':
                // This should use the existing createReferenceDropdown function
                return `<select class="form-select" id="${fieldId}" ${attributes}></select>`;
                
            case 'array':
                return `
                    <textarea class="form-control" id="${fieldId}" rows="3" ${attributes}>${Array.isArray(value) ? value.join(', ') : value}</textarea>
                    <div class="form-text">Enter multiple values separated by commas</div>
                `;
                
            case 'textarea':
                return `<textarea class="form-control" id="${fieldId}" rows="3" ${attributes}>${value}</textarea>`;
                
            case 'checkbox':
                return `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="${fieldId}" ${value ? 'checked' : ''} ${attributes}>
                        <label class="form-check-label" for="${fieldId}">${field.label}</label>
                    </div>
                `;
                
            case 'select':
                const options = field.options || [];
                return `
                    <select class="form-select" id="${fieldId}" ${attributes}>
                        ${options.map(option => `
                            <option value="${option.value}" ${option.value === value ? 'selected' : ''}>${option.label}</option>
                        `).join('')}
                    </select>
                `;
                
            default:
                return `<input type="${field.type}" class="form-control" id="${fieldId}" value="${value}" ${attributes}>`;
        }
    },

    /**
     * Generates a complete form field with label and input
     * @param {Object} field - Field configuration
     * @param {string} value - Current field value
     * @param {string} mode - 'edit' or 'add' mode
     * @returns {string} Complete form field HTML
     */
    generateFormField: (field, value = '', mode = 'add') => {
        const inputHTML = FORM_UTILS.generateInput(field, value, mode === 'edit' ? 'edit' : '');
        
        if (mode === 'edit') {
            return MODAL_TEMPLATES.editFormField(field, inputHTML);
        } else {
            return MODAL_TEMPLATES.formFieldRow(field, inputHTML);
        }
    },

    /**
     * Generates configuration table row for field editing
     * @param {Object} field - Field configuration
     * @param {Array<string>} conceptTypes - Available concept types for references
     * @returns {string} Table row HTML
     */
    generateConfigRow: (field, conceptTypes) => `
        <tr>
            <td><input type="text" class="form-control form-control-sm field-id" value="${field.id || ''}"></td>
            <td><input type="text" class="form-control form-control-sm field-label" value="${field.label || ''}"></td>
            <td>
                <select class="form-select form-select-sm field-type">
                    <option value="text" ${field.type === 'text' ? 'selected' : ''}>text</option>
                    <option value="concept" ${field.type === 'concept' ? 'selected' : ''}>concept</option>
                    <option value="reference" ${field.type === 'reference' ? 'selected' : ''}>reference</option>
                    <option value="array" ${field.type === 'array' ? 'selected' : ''}>array</option>
                    <option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>textarea</option>
                </select>
            </td>
            <td>
                <div class="form-check">
                    <input class="form-check-input field-required" type="checkbox" ${field.required ? 'checked' : ''}>
                </div>
            </td>
            <td>
                <select class="form-select form-select-sm field-reference-type" ${field.type !== 'reference' ? 'disabled' : ''}>
                    <option value="">None</option>
                    ${conceptTypes.map(type => `
                        <option value="${type}" ${field.referencesType === type ? 'selected' : ''}>${type}</option>
                    `).join('')}
                </select>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-field-btn">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `,

    /**
     * Generates configuration table structure
     * @param {string} conceptType - Type of concept
     * @param {Array<Object>} fields - Array of field configurations
     * @param {Array<string>} conceptTypes - Available concept types
     * @returns {string} Configuration table HTML
     */
    generateConfigTable: (conceptType, fields, conceptTypes) => `
        <div class="mb-3">
            <h6>${conceptType} Fields</h6>
            <table class="table table-bordered table-sm">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Label</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Reference Type</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="${conceptType.toLowerCase()}-fields">
                    ${fields.map(field => FORM_UTILS.generateConfigRow(field, conceptTypes)).join('')}
                </tbody>
            </table>
            <button class="btn btn-sm btn-outline-primary add-field-btn" data-type="${conceptType}">
                <i class="bi bi-plus-circle"></i> Add Field
            </button>
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
 * Homepage and repository browser templates
 * @namespace HOMEPAGE_TEMPLATES
 */
export const HOMEPAGE_TEMPLATES = {
    /**
     * Repository list item template
     * @param {Object} repo - Repository object from GitHub API
     * @returns {string} HTML template for repository list item
     */
    repositoryListItem: (repo) => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <i class="bi bi-folder-fill text-warning me-2"></i>
                <strong>${repo.name}</strong>
            </div>
            <button class="btn btn-outline-primary btn-sm openRepoBtn" 
                    data-repo-name="${repo.name}" 
                    data-permissions="${JSON.stringify(repo.permissions)}">
                <i class="bi bi-arrow-right"></i> Open Repository
            </button>
        </div>
    `,

    /**
     * Repository browser search bar and controls
     * @returns {string} HTML template for search bar and action buttons
     */
    searchBarAndControls: () => `
        <div class="container mt-5">
            <!-- Top bar with search and add button -->
            <div class="row mb-3">
                <div class="col-4">
                    <div class="d-flex align-items-center">
                        <input type="text" id="searchFiles" class="form-control form-control me-2 flex-grow-1" placeholder="Search files...">
                        <button id="refreshButton" class="btn btn-outline-secondary btn me-2 flex-shrink-0">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                        <button id="backButton" class="btn btn-outline-secondary flex-shrink-0">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                    </div>
                </div>
                <div class="col-8 d-flex justify-content-end">
                    <button id="addFolder" class="btn btn-secondary me-2">
                        <i class="bi bi-folder-plus"></i> Add Folder
                    </button>
                    <button id="addFile" class="btn btn-primary me-2">
                        <i class="bi bi-plus-lg"></i> Add Concept
                    </button>
                    <button id="configButton" class="btn btn-outline-secondary me-2">
                        <i class="bi bi-gear"></i> Configure
                    </button>
                    <button id="downloadRepo" class="btn btn-primary">
                        <i class="bi bi-download"></i> Download
                    </button>
                </div>
            </div>

            <!-- File list -->
            <div id="fileList" class="list-group"></div>

            <!-- Pagination controls -->
            <div id="paginationControls" class="mt-3"></div>
        </div>
    `,

    /**
     * Directory item template for file list
     * @param {Object} file - Directory file object
     * @returns {string} HTML template for directory item
     */
    directoryItem: (file) => `
        <div class="list-group-item d-flex align-items-center">
            <div class="d-flex flex-column flex-grow-1 me-3 overflow-hidden">
                <div class="d-flex align-items-center">
                    <i class="bi bi-folder-fill text-warning me-2"></i>
                    <strong class="text-truncate">${file.name}</strong>
                </div>
                <small class="text-muted text-truncate">&nbsp;</small>
            </div>
            <div class="d-flex flex-shrink-0">
                <button class="btn btn-outline-primary btn-sm openDirBtn" data-path="${file.name}">
                    <i class="bi bi-arrow-right"></i> Open
                </button>
            </div>
        </div>
    `,

    /**
     * File item template for file list
     * @param {Object} file - File object
     * @param {string} displayName - File name without extension
     * @param {string} keyValue - Index key value for the file
     * @param {boolean} hasWritePermission - Whether user can delete files
     * @returns {string} HTML template for file item
     */
    fileItem: (file, displayName, keyValue, hasWritePermission) => `
        <div class="list-group-item d-flex align-items-center">
            <div class="d-flex flex-column flex-grow-1 me-3 overflow-hidden">
                <div class="d-flex align-items-center">
                    <i class="bi bi-file-earmark-text me-2"></i>
                    <strong class="text-truncate">${displayName}</strong>
                </div>
                <small class="text-muted text-truncate">${keyValue}</small>
            </div>
            <div class="d-flex flex-shrink-0">
                <button class="btn btn-outline-primary btn-sm viewFileBtn me-2" data-bs-file="${file.name}">
                    <i class="bi bi-eye"></i> View
                </button>
                ${hasWritePermission ? 
                    `<button class="btn btn-outline-danger btn-sm deleteFileBtn" data-bs-file="${file.name}" data-bs-sha="${file.sha}">
                        <i class="bi bi-trash"></i> Delete
                    </button>`
                    : ``
                }
            </div>
        </div>
    `,

    /**
     * Pagination controls template
     * @param {number} totalPages - Total number of pages
     * @param {number} currentPage - Current active page
     * @returns {string} HTML template for pagination controls
     */
    paginationControls: (totalPages, currentPage) => {
        if (totalPages <= 1) return '';

        let paginationHTML = '<nav aria-label="Page navigation"><ul class="pagination justify-content-center">';

        // Previous Button
        paginationHTML += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" aria-label="Previous" data-page="${currentPage - 1}">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;

        // Page Numbers
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <li class="page-item ${currentPage === i ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        // Next Button
        paginationHTML += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" aria-label="Next" data-page="${currentPage + 1}">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;

        paginationHTML += '</ul></nav>';
        return paginationHTML;
    }
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