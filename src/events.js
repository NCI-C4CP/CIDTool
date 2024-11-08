import { isLocal } from './common.js';
import { CLIENT_ID, REDIRECT_URI, CLIENT_ID_LOCAL, REDIRECT_URI_LOCAL } from '../config.js';
import { objectDropped } from "./files.js";
import { preventDefaults } from "./common.js";

export const addEventLoginButtonClick = () => {
    const loginButton = document.getElementById('login');
    if (!loginButton) return;

    let id;
    let uri;

    let local = isLocal();

    if (local) {
        id = CLIENT_ID_LOCAL;
        uri = REDIRECT_URI_LOCAL;
    }
    else {
        id = CLIENT_ID;
        uri = REDIRECT_URI;
    }
    
    loginButton.addEventListener('click', () => {
        const url = `https://github.com/login/oauth/authorize?client_id=${id}&redirect_uri=${uri}&scope=repo`;
        window.location.href = url;
    });
}

export const addEventFileDrop = () => {

    // Get elements
    const dropZone = document.getElementById('drop-zone');

    const highlight = () => {
        dropZone.classList.add('drag-over');
    }
    
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

export const addEventDropClicked = () => {

    const importButton = document.getElementById('import-button');
    
    // Get the import modal element
    const importModalElement = document.getElementById('importModal');

    // Create a Bootstrap modal instance for the import modal
    const importModal = new bootstrap.Modal(importModalElement, {
        backdrop: 'static',
    });

    // Add click event listener to the import button
    importButton.addEventListener('click', () => {
        importModal.show();
    });
}