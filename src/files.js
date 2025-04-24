import { parseColumns, structureDictionary, structureFiles } from "./dictionary.js";
import { assignConcepts } from "./concepts.js";
import { appState, removeEventListeners } from "./common.js";
import { renderUploadModal } from "./modals.js";

export const readSpreadsheet = async (file) => {

    const data = await file.arrayBuffer();

    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const arrayData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    return arrayData;
}

const readFiles = async (files) => {

    let filesArray = [];
    let fileData = [];

    for(let file of files) {
        if(file.type === "application/json") {
            filesArray.push(file);
        }
    }

    const filePromises = filesArray.map((file) => {
    
        return new Promise((resolve, reject) => {
          
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    fileData.push(reader.result);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsText(file);
        });
    });

    await Promise.all(filePromises);

    for(let i = 0; i < fileData.length; i++) {
        fileData[i] = JSON.parse(fileData[i]);
    }
    return fileData;
}

export const generateSpreadsheet = (data) => {
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dictionary');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'data.xlsx'; // Default filename
    downloadLink.click();

    // Clean up
    URL.revokeObjectURL(downloadLink.href);
}

export const objectDropped = async (e) => {

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

    const importModal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
    const zoneContent = document.getElementById('drop-zone-content');

    // set to name of file
    zoneContent.innerHTML = file.name;

    // Enable the Save button
    let saveButton = document.getElementById('save-button');
    saveButton = removeEventListeners(saveButton);

    saveButton.innerHTML = `Generate Dictionary`;
    saveButton.disabled = false;
    saveButton.hidden = false;

    saveButton.addEventListener('click', async () => {
        const folderHandler = await window.showDirectoryPicker();
        appState.setState({ folderHandler });
    
        const { conceptObjects } = appState.getState();
    
        const savePromises = conceptObjects.map(async conceptObject => {
            const blob = new Blob([JSON.stringify(conceptObject)], { type: "application/json" });
            const name = `${conceptObject.conceptID}.json`;
            const fileHandle = await folderHandler.getFileHandle(name, { create: true });
            const writable = await fileHandle.createWritable();
    
            await writable.write(blob);
            await writable.close();
        
            console.log(`JSON file "${name}" saved successfully`);
        });

        await Promise.all(savePromises);

        if (importModal) importModal.hide();
    });

    const { isLoggedIn } = appState.getState();

    if(isLoggedIn) {
        // Enable the Remote Save Button
        const remoteSaveButton = document.getElementById('remote-save-button');
        remoteSaveButton.disabled = false;
        remoteSaveButton.hidden = false;

        remoteSaveButton.addEventListener('click', async () => {
            const { conceptObjects } = appState.getState();
            const files = conceptObjects.map((conceptObject) => {
                const name = `${conceptObject.conceptID}.json`;
                const content = JSON.stringify(conceptObject);
                return { name, content };
            });

            // Sort files by name
            files.sort((a, b) => a.name.localeCompare(b.name));

            if (importModal) importModal.hide();

            renderUploadModal(files);
        });
    }

}

const handleDirectory = async (directoryHandle) => {

    const files = [];
    const importModal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
    const zoneContent = document.getElementById('drop-zone-content');

    for await (const [name, handle] of directoryHandle.entries()) {
        if (handle.kind === 'file') {
            const file = await handle.getFile();
            files.push(file);
        }
    }

    let data = await readFiles(files);

    let structuredData = structureFiles(data);

    zoneContent.innerHTML = directoryHandle.name;

    // Enable the Save button
    let saveButton = document.getElementById('save-button');
    saveButton = removeEventListeners(saveButton);

    saveButton.innerHTML = `Generate Spreadsheet`;
    saveButton.disabled = false;
    saveButton.hidden = false;

    saveButton.addEventListener('click', async () => {
        generateSpreadsheet(structuredData);

        if (importModal) importModal.hide();
    });
}