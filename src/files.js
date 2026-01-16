import { parseColumns, structureDictionary, structureFiles } from "./dictionary.js";
import { assignConcepts } from "./concepts.js";
import { appState, removeEventListeners, showAnimation, hideAnimation } from "./common.js";
import { renderUploadModal } from "./modals.js";
import { MODAL_CONFIG, CONCEPT_TYPE_COLORS } from "./config.js";
import { addFile } from "./api.js";
import { refreshHomePage } from "./homepage.js";

/**
 * Reads an Excel file and returns the data as a 2D array
 * Looks for a "Dictionary" sheet first, falls back to first sheet
 * Filters out completely empty rows (rows where all cells are empty strings)
 * @param {File} file - The Excel file to read
 * @returns {Promise<Array>} 2D array of spreadsheet data
 */
export const readSpreadsheet = async (file) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    
    // Look for "Dictionary" sheet first, fall back to first sheet
    const sheetName = workbook.SheetNames.includes('Dictionary') 
        ? 'Dictionary' 
        : workbook.SheetNames[0];
    
    const sheet = workbook.Sheets[sheetName];
    const arrayData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Filter out completely empty rows (styled cells read as empty strings)
    const filteredData = arrayData.filter((row, index) => {
        // Always keep header row (index 0)
        if (index === 0) return true;
        // Keep row if at least one cell has non-empty content
        return row.some(cell => cell !== undefined && cell !== null && cell !== '');
    });
    
    return filteredData;
}

/**
 * Reads multiple JSON files and returns parsed data
 * @param {Array<File>} files - Array of files to read
 * @returns {Promise<Array>} Array of parsed JSON objects
 */
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

/**
 * Generates and downloads an Excel spreadsheet from data
 * @param {Array} data - 2D array of data to export
 */
export const generateSpreadsheet = (data) => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dictionary');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'data.xlsx';
    downloadLink.click();

    URL.revokeObjectURL(downloadLink.href);
}

/**
 * Handles dropped objects (files or directories)
 * @param {DragEvent} e - The drop event
 */
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

/**
 * Handles file drops - processes Excel dictionary files
 * @param {FileSystemFileHandle} handle - File system handle for the dropped file
 */
const handleFile = async (handle) => {
    const zoneContent = document.getElementById('drop-zone-content');
    const file = await handle.getFile();

    // Validate file type
    const validFileTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validFileTypes.includes(file.type)) {
        showValidationError(['Only Excel files (.xlsx) are accepted']);
        return;
    }
    
    // Process the dictionary file
    await processDictionaryFile(file);
}

/**
 * Processes a dictionary Excel file and prepares for import
 * @param {File} file - The Excel file to process
 */
const processDictionaryFile = async (file) => {
    const zoneContent = document.getElementById('drop-zone-content');
    const validationErrors = document.getElementById('validation-errors');
    const importSummary = document.getElementById('import-summary');
    
    // Reset UI state
    hideValidationErrors();
    hideImportSummary();
    
    // Show loading state
    zoneContent.innerHTML = `
        <div class="text-primary">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Processing dictionary from <strong>${file.name}</strong>...
        </div>
    `;
    
    try {
        // Read and parse the spreadsheet
        const data = await readSpreadsheet(file);
        
        if (!data || data.length < 2) {
            showValidationError(['File is empty or contains no data rows']);
            resetDropZone();
            return;
        }
        
        // Parse column headers to identify concept types
        const columns = parseColumns(data[0]);
        
        // Remove header row for processing
        const dataRows = data.slice(1);
        
        // Validate and create concept mapping
        const mapping = assignConcepts(columns, dataRows);
        
        if (!mapping) {
            showValidationError(['Failed to create concept mapping. Please check your data format.']);
            resetDropZone();
            return;
        }
        
        // Structure the dictionary into concept objects
        const conceptObjects = structureDictionary(mapping, columns, dataRows);
        
        if (!conceptObjects || conceptObjects.length === 0) {
            showValidationError(['No valid concepts found in the file']);
            resetDropZone();
            return;
        }
        
        // Store all parsed data in app state for review before import
        // This allows inspection of the import before committing
        appState.setState({ 
            conceptObjects,           // Final structured objects ready for saving
            importFileName: file.name,
            importMapping: mapping,   // Key-to-ID mapping with auto-generated IDs
            importColumns: columns,   // Column index mapping
            importRawData: dataRows   // Original spreadsheet data (sans header)
        });
        
        console.log('Import data stored in appState for review:', {
            conceptCount: conceptObjects.length,
            mappingCount: mapping.length,
            columns: columns,
            fileName: file.name
        });
        
        // Show success and summary
        zoneContent.innerHTML = `
            <div class="text-success">
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>${file.name}</strong> parsed successfully
            </div>
        `;
        
        // Display import summary
        showImportSummary(conceptObjects);
        
        // Enable import button
        setupImportButton(conceptObjects);
        
    } catch (error) {
        console.error('Error processing dictionary file:', error);
        showValidationError([`Error processing file: ${error.message}`]);
        resetDropZone();
    }
}

/**
 * Shows validation errors in the modal
 * @param {Array<string>} errors - Array of error messages
 */
const showValidationError = (errors) => {
    const validationErrors = document.getElementById('validation-errors');
    const errorsList = document.getElementById('validation-errors-list');
    
    if (validationErrors && errorsList) {
        errorsList.innerHTML = errors.map(err => `
            <div class="mb-1"><i class="bi bi-x-circle text-danger me-1"></i> ${err}</div>
        `).join('');
        validationErrors.style.display = 'block';
    }
}

/**
 * Hides validation errors
 */
const hideValidationErrors = () => {
    const validationErrors = document.getElementById('validation-errors');
    if (validationErrors) {
        validationErrors.style.display = 'none';
    }
}

/**
 * Shows import summary with concept counts using color-coded display
 * @param {Array} conceptObjects - Array of concept objects
 */
const showImportSummary = (conceptObjects) => {
    const importSummary = document.getElementById('import-summary');
    const summaryContent = document.getElementById('import-summary-content');
    
    if (!importSummary || !summaryContent) return;
    
    // Count concepts by type
    const counts = {};
    MODAL_CONFIG.CONCEPT_TYPES.forEach(type => {
        counts[type] = conceptObjects.filter(c => c.object_type === type).length;
    });
    
    // Build summary HTML with color-coded pills
    const summaryHtml = `
        <div class="d-flex flex-wrap justify-content-center gap-2 mb-3">
            ${MODAL_CONFIG.CONCEPT_TYPES.map(type => `
                <div class="import-summary-type concept-type-${type.toLowerCase()}${counts[type] === 0 ? ' opacity-50' : ''}">
                    <span class="count">${counts[type]}</span>
                    <span class="label">${type}</span>
                </div>
            `).join('')}
        </div>
        <div class="text-center">
            <strong>Total: ${conceptObjects.length} concepts</strong> ready to import
        </div>
    `;
    
    summaryContent.innerHTML = summaryHtml;
    importSummary.style.display = 'block';
}

/**
 * Hides import summary
 */
const hideImportSummary = () => {
    const importSummary = document.getElementById('import-summary');
    if (importSummary) {
        importSummary.style.display = 'none';
    }
}

/**
 * Resets the drop zone to its initial state
 */
const resetDropZone = () => {
    const zoneContent = document.getElementById('drop-zone-content');
    if (zoneContent) {
        zoneContent.innerHTML = 'Drag & Drop Dictionary Excel File Here';
    }
}

/**
 * Sets up the import button with click handler
 * @param {Array} conceptObjects - Concept objects to import
 */
const setupImportButton = (conceptObjects) => {
    const actionButtons = document.getElementById('action-buttons');
    let remoteSaveButton = document.getElementById('remote-save-button');
    
    if (!remoteSaveButton || !actionButtons) return;
    
    // Show action buttons
    actionButtons.style.display = 'block';
    
    // Remove existing event listeners
    remoteSaveButton = removeEventListeners(remoteSaveButton);
    
    remoteSaveButton.innerHTML = `<i class="bi bi-cloud-upload"></i> Import ${conceptObjects.length} Concepts to Repository`;
    remoteSaveButton.disabled = false;
    remoteSaveButton.hidden = false;
    
    remoteSaveButton.addEventListener('click', async () => {
        await importConceptsToRepository(conceptObjects);
    });
}

/**
 * Imports all concept objects to the GitHub repository
 * @param {Array} conceptObjects - Array of concept objects to import
 */
const importConceptsToRepository = async (conceptObjects) => {
    const importModal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
    const remoteSaveButton = document.getElementById('remote-save-button');
    
    // Disable button and show progress
    if (remoteSaveButton) {
        remoteSaveButton.disabled = true;
        remoteSaveButton.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Importing concepts...
        `;
    }
    
    showAnimation();
    
    try {
        // Prepare files for upload
        const files = conceptObjects.map(concept => ({
            name: `${concept.conceptID}.json`,
            content: JSON.stringify(concept, null, 2)
        }));
        
        // Close import modal and show upload progress modal
        if (importModal) importModal.hide();
        
        // Use existing upload modal for progress tracking
        await renderUploadModal(files);
        
    } catch (error) {
        console.error('Error importing concepts:', error);
        alert(`Error importing concepts: ${error.message}`);
        
        // Re-enable button on error
        if (remoteSaveButton) {
            remoteSaveButton.disabled = false;
            remoteSaveButton.innerHTML = `<i class="bi bi-cloud-upload"></i> Import to Repository`;
        }
    } finally {
        hideAnimation();
    }
}

/**
 * Handles directory drops - reads JSON files and generates spreadsheet export
 * @param {FileSystemDirectoryHandle} directoryHandle - Directory handle
 */
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

    zoneContent.innerHTML = `
        <div class="text-success">
            <i class="bi bi-folder-fill me-2"></i>
            <strong>${directoryHandle.name}</strong> - ${files.length} files loaded
        </div>
    `;

    // Show export button for directory (export to spreadsheet)
    const actionButtons = document.getElementById('action-buttons');
    if (actionButtons) {
        actionButtons.style.display = 'block';
        actionButtons.innerHTML = `
            <button id="export-spreadsheet-button" class="btn btn-primary">
                <i class="bi bi-file-earmark-spreadsheet"></i> Export to Spreadsheet
            </button>
        `;
        
        document.getElementById('export-spreadsheet-button').addEventListener('click', () => {
            generateSpreadsheet(structuredData);
            if (importModal) importModal.hide();
        });
    }
}

/**
 * Generates a dictionary template Excel file with columns for all concept types
 * Creates a multi-sheet workbook with Instructions and color-coded Data sheet
 * Column naming follows the pattern: TYPE_FIELD (e.g., PRIMARY_KEY, PRIMARY_CID)
 */
export const generateDictionaryTemplate = () => {
    try {
        const { config } = appState.getState();
        
        // Order: PRIMARY -> SECONDARY -> SOURCE -> QUESTION -> RESPONSE
        const conceptTypes = ['PRIMARY', 'SECONDARY', 'SOURCE', 'QUESTION', 'RESPONSE'];
        
        // Build headers and track which type each column belongs to
        const headers = [];
        const columnTypes = []; // Track concept type for each column (for coloring)
        
        conceptTypes.forEach(type => {
            // Always add KEY and CID columns for each type
            headers.push(`${type}_KEY`);
            columnTypes.push(type);
            
            headers.push(`${type}_CID`);
            columnTypes.push(type);
            
            // Add additional NON-REFERENCE fields from config if available
            // Reference fields (parent, source, responses) are determined by row position, not columns
            if (config && config[type]) {
                config[type].forEach(field => {
                    // Skip key and conceptId as we already added them
                    if (field.id === 'key' || field.id === 'conceptId' || field.id === 'conceptID') {
                        return;
                    }
                    
                    // Skip reference-type fields - relationships are determined by row position
                    if (field.type === 'reference') {
                        return;
                    }
                    
                    headers.push(`${type}_${field.id.toUpperCase()}`);
                    columnTypes.push(type);
                });
            }
        });
        
        const workbook = XLSX.utils.book_new();
        
        // ============ CREATE INSTRUCTIONS SHEET ============
        const instructionsSheet = createInstructionsSheet(conceptTypes);
        XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
        
        // ============ CREATE DATA SHEET ============
        const dataSheet = createDataSheet(headers, columnTypes);
        XLSX.utils.book_append_sheet(workbook, dataSheet, 'Dictionary');
        
        // Generate and download
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = 'CIDTool_Dictionary_Template.xlsx';
        downloadLink.click();
        
        URL.revokeObjectURL(downloadLink.href);
        
        // Show success notification
        showTemplateDownloadSuccess('Dictionary');
        
    } catch (error) {
        console.error('Error generating dictionary template:', error);
        alert('Error generating template. Please try again.');
    }
};

/**
 * Creates the Instructions sheet with guidance and color legend
 * @param {Array<string>} conceptTypes - Array of concept type names
 * @returns {Object} XLSX worksheet object
 */
const createInstructionsSheet = (conceptTypes) => {
    const instructions = [
        ['CIDTool Dictionary Import Template'],
        [''],
        ['HOW TO USE THIS TEMPLATE:'],
        ['1. Enter your concept data in the "Dictionary" sheet'],
        ['2. Each column is prefixed with its concept type (e.g., PRIMARY_KEY, SECONDARY_CID)'],
        ['3. KEY columns contain the unique identifier/name for each concept'],
        ['4. CID columns contain the 9-digit Concept ID (leave blank to auto-generate)'],
        ['5. Columns are color-coded by concept type for easy identification'],
        [''],
        ['HIERARCHICAL STRUCTURE (IMPORTANT!):'],
        ['Relationships between concepts are determined by ROW POSITION, not explicit columns.'],
        [''],
        ['• A SECONDARY on a row belongs to the nearest PRIMARY above it (or same row)'],
        ['• A QUESTION belongs to the nearest SECONDARY above it'],
        ['• A SOURCE on the same row as a QUESTION is linked to that QUESTION'],
        ['• RESPONSEs listed below a QUESTION belong to that QUESTION'],
        [''],
        ['EXAMPLE STRUCTURE:'],
        ['Row 1: PRIMARY_KEY="Survey"'],
        ['Row 2:   SECONDARY_KEY="Demographics"    (belongs to Survey)'],
        ['Row 3:     SOURCE_KEY="Form A"  QUESTION_KEY="What is your age?"  (belongs to Demographics, uses Form A)'],
        ['Row 4:       RESPONSE_KEY="Under 18"     (belongs to "What is your age?" question)'],
        ['Row 5:       RESPONSE_KEY="18-65"        (belongs to "What is your age?" question)'],
        ['Row 6:       RESPONSE_KEY="Over 65"      (belongs to "What is your age?" question)'],
        ['Row 7:     QUESTION_KEY="What is your gender?"  (new question under Demographics)'],
        ['Row 8:       RESPONSE_KEY="Male"'],
        ['Row 9:       RESPONSE_KEY="Female"'],
        [''],
        ['CONCEPT HIERARCHY:'],
        ['PRIMARY → SECONDARY → QUESTION → RESPONSE'],
        ['                          ↑'],
        ['                       SOURCE'],
        [''],
        ['COLOR LEGEND:'],
        ...conceptTypes.map(type => [`${type}: ${CONCEPT_TYPE_COLORS[type].name}`]),
        [''],
        ['IMPORTANT NOTES:'],
        ['• Do not rename or reorder columns'],
        ['• Do not modify the header row'],
        ['• Concept IDs must be exactly 9 digits if provided'],
        ['• Each KEY value must be unique within its concept type'],
        ['• Indentation in this example is for illustration only - use the actual columns']
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(instructions);
    
    // Style the title
    if (worksheet['A1']) {
        worksheet['A1'].s = {
            font: { bold: true, sz: 16 },
            alignment: { horizontal: 'left' }
        };
    }
    
    // Style section headers (bold)
    // Row 3: HOW TO USE, Row 10: HIERARCHICAL STRUCTURE, Row 18: EXAMPLE STRUCTURE
    // Row 29: CONCEPT HIERARCHY, Row 34: COLOR LEGEND, Row 41: IMPORTANT NOTES
    const sectionHeaders = [3, 10, 18, 29, 34, 41];
    sectionHeaders.forEach(row => {
        const cellRef = `A${row}`;
        if (worksheet[cellRef]) {
            worksheet[cellRef].s = {
                font: { bold: true }
            };
        }
    });
    
    // Style the color legend items with their respective colors
    const colorLegendStartRow = 35; // After "COLOR LEGEND:" header (row 34)
    conceptTypes.forEach((type, index) => {
        const cellRef = `A${colorLegendStartRow + index}`;
        if (worksheet[cellRef]) {
            const color = CONCEPT_TYPE_COLORS[type];
            worksheet[cellRef].s = {
                fill: { fgColor: { rgb: color.hex.replace('#', '') } },
                font: { color: { rgb: 'FFFFFF' }, bold: true }
            };
        }
    });
    
    // Set column width
    worksheet['!cols'] = [{ width: 100 }];
    
    return worksheet;
};

/**
 * Creates the Data sheet with color-coded headers
 * @param {Array<string>} headers - Column headers
 * @param {Array<string>} columnTypes - Concept type for each column
 * @returns {Object} XLSX worksheet object
 */
const createDataSheet = (headers, columnTypes) => {
    // Create data array with headers and empty rows
    const data = [
        headers,
        ...Array(100).fill(null).map(() => new Array(headers.length).fill(''))
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Apply color styling to header row
    headers.forEach((header, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        const conceptType = columnTypes[colIndex];
        const color = CONCEPT_TYPE_COLORS[conceptType];
        
        if (worksheet[cellRef]) {
            worksheet[cellRef].s = {
                fill: { fgColor: { rgb: color.hex.replace('#', '') } },
                font: { color: { rgb: 'FFFFFF' }, bold: true },
                alignment: { horizontal: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } }
                }
            };
        }
    });
    
    // Apply light background color to data cells for visual grouping
    for (let rowIndex = 1; rowIndex <= 100; rowIndex++) {
        headers.forEach((header, colIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            const conceptType = columnTypes[colIndex];
            const color = CONCEPT_TYPE_COLORS[conceptType];
            
            // Initialize cell if it doesn't exist
            if (!worksheet[cellRef]) {
                worksheet[cellRef] = { v: '', t: 's' };
            }
            
            worksheet[cellRef].s = {
                fill: { fgColor: { rgb: color.light.replace('#', '') } },
                border: {
                    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                    right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                }
            };
        });
    }
    
    // Set column widths based on header length
    worksheet['!cols'] = headers.map(h => ({ width: Math.max(h.length + 2, 15) }));
    
    // Freeze header row
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    
    return worksheet;
};

/**
 * Shows success message after template download
 * @param {string} templateType - The type of template downloaded
 */
const showTemplateDownloadSuccess = (templateType) => {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    successDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    successDiv.innerHTML = `
        <i class="bi bi-check-circle-fill"></i>
        <strong>Template Downloaded!</strong>
        <br>Your ${templateType} template is ready to use.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 5000);
};

/**
 * Sets up event listeners for the import modal
 */
export const setupImportModal = () => {
    // Template download button handler
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        // Remove any existing listeners
        const newBtn = downloadTemplateBtn.cloneNode(true);
        downloadTemplateBtn.parentNode.replaceChild(newBtn, downloadTemplateBtn);
        
        newBtn.addEventListener('click', () => {
            generateDictionaryTemplate();
        });
    }
    
    // File input handler for click-to-browse
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('drop-zone');
    
    if (fileInput && dropZone) {
        // Make drop zone clickable (but not the action buttons area)
        dropZone.addEventListener('click', (e) => {
            // Don't trigger file input if clicking on buttons
            if (e.target.closest('#action-buttons')) {
                return;
            }
            fileInput.click();
        });
        
        // Handle file selection via click
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                await processDictionaryFile(file);
            }
        });
    }
};