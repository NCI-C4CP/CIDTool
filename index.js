import { assignConcepts } from "./utils/concepts.js";
import { readSpreadsheet, generateFiles, requestFolderAccess } from "./utils/files.js";
import { parseColumns, structureDictionary } from "./utils/dictionary.js";

const dictionary_import = async (e) => {  

    const data = await readSpreadsheet(e.target.files[0]);
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

document.getElementById('input_dom_element').addEventListener('change', dictionary_import);
