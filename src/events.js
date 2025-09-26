import { isLocal, preventDefaults } from './common.js';
import { CLIENT_ID, REDIRECT_URI, CLIENT_ID_LOCAL, REDIRECT_URI_LOCAL, DOM_ELEMENTS } from '../config.js';
import { objectDropped } from "./files.js";

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
        const dropZone = document.getElementById(DOM_ELEMENTS.DROP_ZONE_CONTENT);
        const remoteSaveButton = document.getElementById(DOM_ELEMENTS.REMOTE_SAVE_BUTTON);
        const saveButton = document.getElementById(DOM_ELEMENTS.SAVE_BUTTON);

        // Reset modal content and state
        if (dropZone) {
            dropZone.innerHTML = "Drag & Drop File or Folder Here";
        }

        if (remoteSaveButton) {
            remoteSaveButton.disabled = true;
            remoteSaveButton.hidden = true;
        }

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.hidden = true;
        }

        importModal.show();
    });
};

/**
 * Adds click event listener to the home icon for navigation
 * @param {string} homeIconId - The ID of the home icon element
 * @param {Function} renderHomePage - Function to render the home page
 * @param {Function} showAnimation - Function to show loading animation
 * @param {Function} hideAnimation - Function to hide loading animation
 */
export const addEventHomeIconClick = (renderHomePage, showAnimation, hideAnimation) => {
    const homeIcon = document.getElementById(DOM_ELEMENTS.HOME_ICON);
    if (!homeIcon) {
        console.warn(`Home icon element '${DOM_ELEMENTS.HOME_ICON}' not found`);
        return;
    }

    homeIcon.addEventListener('click', async () => {
        try {
            showAnimation();
            await renderHomePage();
        } catch (error) {
            console.error('Failed to render home page:', error);
            // Could show error message to user here
        } finally {
            hideAnimation();
        }
    });
};