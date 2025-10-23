import { parseColumns, structureDictionary, structureFiles } from "./dictionary.js";
import { assignConcepts } from "./concepts.js";
import { appState, removeEventListeners } from "./common.js";
import { renderUploadModal, renderAddModal } from "./modals.js";
import { MODAL_CONFIG } from "./config.js";

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

/**
 * Template Generation Functions for Config-Based Import
 */

/**
 * Generates an Excel template based on user's configuration for a specific concept type
 * @param {string} conceptType - The concept type (PRIMARY, SECONDARY, etc.)
 * @returns {void} Downloads the template file
 */
export const generateConfigBasedTemplate = (conceptType) => {
    try {
        const { config } = appState.getState();
        
        if (!config || !config[conceptType]) {
            alert(`No configuration found for ${conceptType} concept type. Please configure your concept types first.`);
            return;
        }

        // Generate template data based on config
        const templateData = createTemplateFromConfig(conceptType, config[conceptType]);
        
        // Create Excel workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(templateData);
        
        // Add some basic formatting and validation hints
        addTemplateFormatting(worksheet, config[conceptType]);
        
        XLSX.utils.book_append_sheet(workbook, worksheet, `${conceptType}_Import`);
        
        // Generate and download file
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `CIDTool_${conceptType}_Template.xlsx`;
        downloadLink.click();
        
        // Clean up
        URL.revokeObjectURL(downloadLink.href);
        
        // Show success message
        showTemplateDownloadSuccess(conceptType);
        
    } catch (error) {
        console.error('Error generating template:', error);
        alert('Error generating template. Please try again.');
    }
};

/**
 * Creates template data array from user configuration
 * @param {string} conceptType - The concept type
 * @param {Array} fieldConfig - User's field configuration for this type
 * @returns {Array} 2D array for Excel sheet
 */
const createTemplateFromConfig = (conceptType, fieldConfig) => {
    const headers = [];
    const exampleRow = [];
    const instructionRow = [];
    
    // Always include the required base fields
    headers.push('conceptId');
    exampleRow.push('123456789');
    instructionRow.push('9-digit concept ID (required)');
    
    headers.push('key');
    exampleRow.push('unique_key_1');
    instructionRow.push('Unique identifier for this concept (required)');
    
    // Add fields from user configuration
    fieldConfig.forEach(field => {
        if (field.id !== 'conceptId' && field.id !== 'key') { // Skip if already added
            headers.push(field.id);
            
            // Generate appropriate example based on field type
            if (field.type === 'reference') {
                exampleRow.push(getExampleReferenceValue(field));
                instructionRow.push(`Reference to ${field.referencesType || 'related'} concept ${field.required ? '(required)' : '(optional)'}`);
            } else if (field.type === 'concept') {
                exampleRow.push('123456789');
                instructionRow.push(`Concept ID ${field.required ? '(required)' : '(optional)'}`);
            } else {
                exampleRow.push(getExampleTextValue(field));
                instructionRow.push(`${field.label || field.id} ${field.required ? '(required)' : '(optional)'}`);
            }
        }
    });
    
    return [
        headers,
        instructionRow,
        exampleRow,
        // Add a few empty rows for user data
        new Array(headers.length).fill(''),
        new Array(headers.length).fill(''),
        new Array(headers.length).fill('')
    ];
};

/**
 * Gets example value for reference fields
 * @param {Object} field - Field configuration
 * @returns {string} Example value
 */
const getExampleReferenceValue = (field) => {
    if (field.referencesType === 'PRIMARY') {
        return 'primary_concept_key';
    } else if (field.referencesType === 'SECONDARY') {
        return 'secondary_concept_key';
    } else if (field.referencesType === 'RESPONSE') {
        return 'response_1,response_2'; // Multiple values for responses
    }
    return 'related_concept_key';
};

/**
 * Gets example value for text fields
 * @param {Object} field - Field configuration
 * @returns {string} Example value
 */
const getExampleTextValue = (field) => {
    const fieldId = field.id.toLowerCase();
    
    if (fieldId.includes('name')) {
        return 'Sample Concept Name';
    } else if (fieldId.includes('description')) {
        return 'Description of this concept';
    } else if (fieldId.includes('value')) {
        return 'sample_value';
    } else if (fieldId.includes('label')) {
        return 'Display Label';
    }
    
    return `Sample ${field.label || field.id}`;
};

/**
 * Adds basic formatting to the template worksheet
 * @param {Object} worksheet - XLSX worksheet object
 * @param {Array} fieldConfig - Field configuration
 */
const addTemplateFormatting = (worksheet, fieldConfig) => {
    // This is a basic implementation - XLSX library has limited formatting in free version
    // But we can add comments and basic structure
    
    if (!worksheet['!cols']) {
        worksheet['!cols'] = [];
    }
    
    // Set column widths
    fieldConfig.forEach((field, index) => {
        if (!worksheet['!cols'][index + 2]) { // +2 for conceptId and key columns
            worksheet['!cols'][index + 2] = {};
        }
        worksheet['!cols'][index + 2].width = field.id.length + 10; // Adjust width based on field name
    });
    
    // Set first two columns (conceptId, key) to reasonable widths
    worksheet['!cols'][0] = { width: 15 }; // conceptId
    worksheet['!cols'][1] = { width: 20 }; // key
};

/**
 * Shows success message after template download
 * @param {string} conceptType - The concept type that was downloaded
 */
const showTemplateDownloadSuccess = (conceptType) => {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    successDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    successDiv.innerHTML = `
        <i class="bi bi-check-circle-fill"></i>
        <strong>Template Downloaded!</strong>
        <br>Your ${conceptType} import template is ready to use.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 5000);
};

/**
 * Sets up event listeners for the enhanced import modal
 */
export const setupImportModal = () => {
    // Check if user has configuration and update UI accordingly
    updateConfigStatus();
    
    // Type selection change handler
    const conceptTypeSelect = document.getElementById('conceptTypeSelect');
    if (conceptTypeSelect) {
        conceptTypeSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            updateModalForSelectedType(selectedType);
        });
    }
    
    // Template download button handler
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', () => {
            const { config } = appState.getState();
            if (!config || Object.keys(config).length === 0) {
                alert('No configuration found. Please configure your concept types first using the Configure button in the main interface.');
                return;
            }
            
            const selectedType = document.getElementById('conceptTypeSelect').value;
            generateConfigBasedTemplate(selectedType);
        });
    }
    
    // File input handler for click-to-browse
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('drop-zone');
    
    if (fileInput && dropZone) {
        // Make drop zone clickable
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                handleSelectedFile(file);
            }
        });
    }
};

/**
 * Updates the config status display in the modal
 */
const updateConfigStatus = () => {
    const { config } = appState.getState();
    const downloadBtn = document.getElementById('downloadTemplateBtn');
    
    if (!downloadBtn) return;
    
    if (!config || Object.keys(config).length === 0) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `
            <i class="bi bi-exclamation-triangle"></i> 
            No Configuration Found
        `;
        downloadBtn.title = 'Please configure your concept types first';
    } else {
        downloadBtn.disabled = false;
        const selectedType = document.getElementById('conceptTypeSelect')?.value || 'PRIMARY';
        downloadBtn.innerHTML = `
            <i class="bi bi-file-earmark-spreadsheet"></i> 
            Download ${selectedType} Template
        `;
        downloadBtn.title = 'Download Excel template based on your configuration';
    }
};

/**
 * Updates modal text elements when concept type changes
 * @param {string} conceptType - Selected concept type
 */
const updateModalForSelectedType = (conceptType) => {
    const elements = {
        'selectedTypeText': conceptType,
        'selectedTypeFileText': conceptType,
        'selectedTypeFileText2': conceptType
    };
    
    Object.entries(elements).forEach(([elementId, text]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    });
    
    // Update download button text
    updateConfigStatus();
};

/**
 * Handles file selection (both drag-drop and click-browse)
 * @param {File} file - Selected file
 */
const handleSelectedFile = async (file) => {
    const zoneContent = document.getElementById('drop-zone-content');
    const selectedType = document.getElementById('conceptTypeSelect').value;
    
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        zoneContent.innerHTML = `
            <div class="text-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Please select an Excel file (.xlsx or .xls)
            </div>
        `;
        return;
    }
    
    try {
        // Show loading state
        zoneContent.innerHTML = `
            <div class="text-primary">
                <i class="bi bi-hourglass-split me-2"></i>
                Processing ${selectedType} concepts from ${file.name}...
            </div>
        `;
        
        // Process the file (this will be enhanced in later steps)
        // For now, just show success
        zoneContent.innerHTML = `
            <div class="text-success">
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>${file.name}</strong> loaded successfully
                <br><small class="text-muted">Ready to import ${selectedType} concepts</small>
            </div>
        `;
        
        // Show action buttons
        document.getElementById('action-buttons').style.display = 'block';
        document.getElementById('remote-save-button').hidden = false;
        document.getElementById('remote-save-button').disabled = false;
        document.getElementById('approve-all-button').hidden = false;
        document.getElementById('approve-all-button').disabled = false;
        
    } catch (error) {
        console.error('Error processing file:', error);
        zoneContent.innerHTML = `
            <div class="text-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Error processing file. Please check the format and try again.
            </div>
        `;
    }
};