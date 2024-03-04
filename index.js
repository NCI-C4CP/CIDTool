import { assignConcepts } from "./utils/concepts.js";
import { readSpreadsheet, readFiles, generateSpreadsheet } from "./utils/files.js";
import { parseColumns, structureDictionary, structureFiles } from "./utils/dictionary.js";
import { appState } from "./utils/common.js";

const dictionary_import = async (event) => {  

    const data = await readSpreadsheet(event.target.files[0]);
    const columns = parseColumns(data[0]);

    data.shift();

    const mapping = assignConcepts(columns, data);
    if(!mapping) {
        console.log("failed to create key -> concept mapping");
        return;
    }

    const conceptObjects = structureDictionary(mapping, columns, data);
    appState.setState({ conceptObjects });
}

const dictionary_export = async (event) => {
    let data = await readFiles(event.target.files);

    let structuredData = structureFiles(data);
    generateSpreadsheet(structuredData);
}

document.getElementById('input_dom_element').addEventListener('change', dictionary_import);

document.getElementById('output_dom_element').addEventListener('change', dictionary_export);

document.getElementById('directory_picker').addEventListener('click', async () => {
    const folderHandler = await window.showDirectoryPicker();
    appState.setState({ folderHandler });
});

document.getElementById('file_saver').addEventListener('click', async () => {
    
    const { folderHandler, conceptObjects } = appState.getState();
    
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

document.getElementById('input_dom_element').addEventListener('change', async () => {
    const data = await readSpreadsheet(event.target.files[0]);
    const columns = parseColumns(data[0]);

    data.shift();

    const mapping = assignConcepts(columns, data);
    if(!mapping) {
        console.log("failed to create key -> concept mapping");
        return;
    }

    const conceptObjects = structureDictionary(mapping, columns, data);
    appState.setState({ conceptObjects });
});