import { parseColumns, structureDictionary, structureFiles } from "./dictionary.js";
import { assignConcepts } from "./concepts.js";
import { appState, removeEventListeners } from "./common.js";
import { renderUploadModal, renderAddModal } from "./modals.js";

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

    const importModal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
    const zoneContent = document.getElementById('drop-zone-content');

    const file = await handle.getFile();

    const validFileTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validFileTypes.includes(file.type)) {
        zoneContent.innerHTML = `
            <div class="text-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Only Excel files (.xlsx) are accepted
            </div>
        `;

        return;
    }
    
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
        // Enable the Review Import Button (new modal-based workflow)
        const remoteSaveButton = document.getElementById('remote-save-button');
        remoteSaveButton.innerHTML = 'Review Import';
        remoteSaveButton.disabled = false;
        remoteSaveButton.hidden = false;

        remoteSaveButton.addEventListener('click', async () => {
            const { conceptObjects } = appState.getState();
            
            if (!conceptObjects || conceptObjects.length === 0) {
                alert('No concepts to review.');
                return;
            }
            
            // Start the import review process using our new queue system
            ImportQueue.init(conceptObjects);
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

/**
 * Import Queue Manager - handles sequential review of imported concepts
 */
export const ImportQueue = {
    concepts: [],
    currentIndex: 0,
    acceptedConcepts: [],
    skippedConcepts: [],
    
    /**
     * Initialize import queue with concepts to review
     * @param {Array} conceptsToReview - Array of concept objects from import
     */
    init(conceptsToReview) {
        this.concepts = conceptsToReview;
        this.currentIndex = 0;
        this.acceptedConcepts = [];
        this.skippedConcepts = [];
        
        if (this.concepts.length === 0) {
            alert('No valid concepts found to import.');
            return;
        }
        
        // Close the import modal and start review process
        const importModal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
        if (importModal) importModal.hide();
        
        // Start reviewing concepts
        this.showNext();
    },
    
    /**
     * Show the next concept in the review queue
     */
    showNext() {
        if (this.currentIndex < this.concepts.length) {
            const concept = this.concepts[this.currentIndex];
            const importOptions = {
                title: 'Review Imported Concept',
                current: this.currentIndex + 1,
                total: this.concepts.length,
                onAccept: (acceptedConcept) => this.onConceptAccepted(acceptedConcept),
                onSkip: () => this.onConceptSkipped()
            };
            
            // Open the add modal in import review mode
            renderAddModal(concept, importOptions);
        } else {
            // All concepts reviewed - show completion summary
            this.showCompletionSummary();
        }
    },
    
    /**
     * Handle when a concept is accepted
     * @param {Object} acceptedConcept - The accepted concept data
     */
    onConceptAccepted(acceptedConcept) {
        this.acceptedConcepts.push({
            original: this.concepts[this.currentIndex],
            accepted: acceptedConcept
        });
        this.currentIndex++;
        
        // Small delay to allow modal to close before opening next one
        setTimeout(() => this.showNext(), 100);
    },
    
    /**
     * Handle when a concept is skipped
     */
    onConceptSkipped() {
        this.skippedConcepts.push(this.concepts[this.currentIndex]);
        this.currentIndex++;
        
        // Small delay to allow modal to close before opening next one
        setTimeout(() => this.showNext(), 100);
    },
    
    /**
     * Show import completion summary
     */
    showCompletionSummary() {
        const total = this.concepts.length;
        const accepted = this.acceptedConcepts.length;
        const skipped = this.skippedConcepts.length;
        
        let message = `Import Review Complete!\n\n`;
        message += `✅ ${accepted} concepts accepted and saved\n`;
        message += `⏭️ ${skipped} concepts skipped\n`;
        message += `📊 Total reviewed: ${total}`;
        
        if (skipped > 0) {
            message += `\n\nSkipped concepts:\n`;
            this.skippedConcepts.forEach((concept, index) => {
                message += `• ${concept.key || concept.conceptId || `Concept ${index + 1}`}\n`;
            });
        }
        
        alert(message);
        
        // Refresh the page to show new concepts
        if (accepted > 0) {
            // Assuming we have access to refreshHomePage function
            if (typeof refreshHomePage === 'function') {
                refreshHomePage();
            } else {
                location.reload(); // Fallback
            }
        }
    }
};