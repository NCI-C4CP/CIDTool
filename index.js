import { assignConcepts } from "./utils/concepts.js";
import { readSpreadsheet, generateFiles, readFiles, generateSpreadsheet } from "./utils/files.js";
import { parseColumns, structureDictionary, structureFiles } from "./utils/dictionary.js";

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

    generateFiles(conceptObjects);
}

const dictionary_export = async (event) => {
    let data = await readFiles(event.target.files);

    let structuredData = structureFiles(data);
    generateSpreadsheet(structuredData);
}

document.getElementById('input_dom_element').addEventListener('change', dictionary_import);

document.getElementById('output_dom_element').addEventListener('change', dictionary_export);
