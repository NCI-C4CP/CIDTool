import { isLocal, appState } from './common.js';
import { CLIENT_ID, REDIRECT_URI, CLIENT_ID_LOCAL, REDIRECT_URI_LOCAL } from '../config.js';
import { readSpreadsheet, readFiles, generateSpreadsheet } from "./files.js";
import { parseColumns, structureDictionary, structureFiles } from "./dictionary.js";
import { assignConcepts } from "./concepts.js";
import { renderUploadModal } from "./modals.js";

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

    const highlight = (e) => {
        dropZone.classList.add('drag-over');
    }
    
    const unhighlight = (e) => {
        dropZone.classList.remove('drag-over');
    }

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Handle drop
    dropZone.addEventListener('drop', handleDrop, false);

    // Highlight drop zone when item is dragged over it
    ['dragenter'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
}

const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
}

const handleDrop = async (e) => {

    const dropObject = e.dataTransfer.items[0];
    const handle = await dropObject.getAsFileSystemHandle();

    if (handle.kind === 'file') {
        await handleFile(handle);
    } 
    else if (handle.kind === 'directory') {
        await handleDirectory(handle);
    }
    else {
        console.log("Unsupported file type");
        return;
    }
}

const handleFile = async (handle) => {

    const file = await handle.getFile();
    const data = await readSpreadsheet(file);
    const columns = parseColumns(data[0]);

    data.shift();

    const mapping = assignConcepts(columns, data);
    if(!mapping) {
        console.log("failed to create key -> concept mapping");
        return;
    }

    const conceptObjects = structureDictionary(mapping, columns, data);
    appState.setState({ conceptObjects });

    const zoneContent = document.getElementById('drop-zone-content');

    // set to name of file
    zoneContent.innerHTML = file.name;

    // Enable the Save button
    const saveButton = document.getElementById('save-button');
    saveButton.disabled = false;
    saveButton.removeAttribute('hidden');

    saveButton.addEventListener('click', async () => {
        const folderHandler = await window.showDirectoryPicker();
        appState.setState({ folderHandler });
    
        const { conceptObjects } = appState.getState();
    
        conceptObjects.forEach(async conceptObject => {
            const blob = new Blob([JSON.stringify(conceptObject)], { type: "application/json" });
            const name = `${conceptObject.conceptID}.json`;
            const fileHandle = await folderHandler.getFileHandle(name, { create: true });
            const writable = await fileHandle.createWritable();
    
            await writable.write(blob);
            await writable.close();
        
            console.log(`JSON file "${name}" saved successfully`);
        });
    });

    const { isLoggedIn } = appState.getState();

    if(isLoggedIn) {
        // Enable the Remote Save Button
        const remoteSaveButton = document.getElementById('remote-save-button');
        remoteSaveButton.disabled = false;
        remoteSaveButton.removeAttribute('hidden');

        remoteSaveButton.addEventListener('click', async () => {
            const { conceptObjects } = appState.getState();
            const files = conceptObjects.map((conceptObject) => {
                const name = `${conceptObject.conceptID}.json`;
                const content = JSON.stringify(conceptObject);
                return { name, content };
            });

            // Sort files by name
            files.sort((a, b) => a.name.localeCompare(b.name));

            renderUploadModal(files);
        });
    }

}

const handleDirectory = async (directoryHandle) => {

    const files = [];

    const zoneContent = document.getElementById('drop-zone-content');

    // set to name of folder
    zoneContent.innerHTML = directoryHandle.name;

    for await (const [name, handle] of directoryHandle.entries()) {
        if (handle.kind === 'file') {
            const file = await handle.getFile();
            files.push(file);
        }
    }

    let data = await readFiles(files);

    let structuredData = structureFiles(data);

    // Enable the Save button
    const saveButton = document.getElementById('save-button');
    saveButton.innerHTML = `Generate Spreadsheet`;
    saveButton.disabled = false;
    saveButton.removeAttribute('hidden');

    saveButton.addEventListener('click', async () => {
        generateSpreadsheet(structuredData);
    });
}