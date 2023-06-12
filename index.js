let conceptObjects = [];

const dictionary_import = async (e) => {  
    
    console.log("start dictionary_import");

    const file = e.target.files[0];
    const data = await file.arrayBuffer();

    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const arrayData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const columns = parseColumns(arrayData[0]);

    arrayData.shift();

    const mapping = assignConcepts(columns, arrayData);
    if(!mapping) {
        console.log("failed to create key -> concept mapping");
        return;
    }

    structureDictionary(mapping, columns, arrayData);

    generateFiles(conceptObjects);

    console.log("end dictionary_import");
}

const requestFolderAccess = async () => {
    try {
        const handle = await window.showDirectoryPicker();
        return handle;
    } catch (error) {
        console.error("Error requesting directory access:", error);
    }
}

const structureDictionary = (mapping, columns, data, parent = {}, index = 0, startRow = 0, endRow = data.length - 1) => {

    let rangeStart = null;
    let category = columns[index];
    let column = category['KEY'];

    const masterColumns = ['KEY', 'CID', 'object_type'];
    const extraColumns = getExtraKeys(category, masterColumns);

    if(index + 1 < columns.length) {
        for (let row = startRow; row <= endRow; row++) {

            if(data[row][column] !== undefined) {

                if(rangeStart !== null) {
                    
                    let parentKey = mapping.filter(x => x.concept === data[rangeStart][column])[0].id;
                    let responses = structureDictionary(mapping, columns, data, {"id": parentKey}, index + 1, rangeStart, row - 1);

                    if(responses) {
                        addResponses(data[rangeStart][column], responses);
                    }
                }

                let extraFields = {};
                if(extraColumns.length > 0) {
                    extraColumns.forEach(ec => {
                        if(data[row][category[ec]] !== undefined) {
                            extraFields[`${ec}`] = data[row][category[ec]];
                        }
                    })
                }
                buildObject(mapping, data[row][column], parent, extraFields);
                rangeStart = row;
            }

            if(row === endRow) {
                let parentKey = mapping.filter(x => x.concept === data[rangeStart][column])[0].id;
                let responses = structureDictionary(mapping, columns, data, {"id": parentKey}, index + 1, rangeStart, row);

                if(responses) {
                    addResponses(data[rangeStart][column], responses);
                }
            }
        }
    }
    else {
        
        let responses = [];

        for (let row = startRow; row <= endRow; row++) {
            if(data[row][column] !== undefined) {
                responses.push(buildObject(mapping, data[row][column]));
            }
        }

        return responses;
    }
}

const buildObject = (mapping, value, parent, fields) => {

    let conceptObject = objectExists(conceptObjects, 'key', value);

    if(!conceptObject) {

        conceptObject = {};
        let id = mapping.filter(x => x.concept === value)[0].id;

        conceptObject['key'] = value;
        conceptObject['conceptID'] = id;

        if(parent && !isEmpty(parent) && parent.id) {
            conceptObject['parent'] = parent.id;
        }

        if(fields && !isEmpty(fields)) {
            Object.keys(fields).forEach(field => {
                conceptObject[`${field.toLowerCase()}`] = fields[field];
            });
        }

        conceptObjects.push(conceptObject);
    }

    return conceptObject.conceptID;
}

const addResponses = (value, responses) => {

    if(responses.length > 0) {
        let object = conceptObjects.find(x => x.key === value);

        if(object) {
            object['responses'] = responses;
        }
    }    
}

const getExtraKeys = (object, keys) => {

    let set = new Set(keys);
    return Object.keys(object).filter(key => !set.has(key));
}

const parseColumns = (headers) => {
    
    const keys = ["PRIMARY", "SECONDARY", "SOURCE", "QUESTION", "RESPONSE"];
    const results = [];

    keys.forEach(key => {

        let result = {}

        headers.forEach(item => {
            const regex = new RegExp(`^${key}_([a-zA-Z]+)`);
            const match = item.match(regex);
            if(match) {
                result[match[1]] = headers.indexOf(item);
                console.log();
            }
        });
        
        result.object_type = key;
        results.push(result);
    });

    return results;
} 

const generateFiles = async (conceptObjects) => {

    const folderHandler = await requestFolderAccess();

    if (!folderHandler) {
        console.error("File system access not granted");
        return;
    }

    conceptObjects.forEach(async conceptObject => {
        const blob = new Blob([JSON.stringify(conceptObject)], { type: "application/json" });
        const name = `${conceptObject.conceptID}.json`;
        const fileHandle = await folderHandler.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();

        await writable.write(blob);
        await writable.close();
    
        console.log(`JSON file "${name}" saved successfully`);
    });

    return;
}

const assignConcepts = (categories, data) => {

    let concepts = [];

    for(const category of categories) {
        
        const key = category.KEY;
        const id = category.CID
        
        for(let i = 0; i < data.length; i++) {
            if(data[i][key] && concepts.indexOf(data[i][key]) === -1) {
                
                if(data[i][id] !== undefined) {
                    if(!validateConceptID(data[i][id])) {
                        displayError("Incorrect Structure for Concept ID - " + data[i][id]);
                        return false;
                    }
                }
                
                concepts.push({
                    concept: data[i][key],
                    id: data[i][id]
                });
            } 
        }
    }

    if(!validateInitialMapping(concepts)) {
        return false;
    }

    concepts = filterDuplicateMapping(concepts);
    concepts = backfillConceptIDs(concepts);

    return concepts;
}

const validateConceptID = (id) => {

    if (typeof id !== 'number') return false;

    const regex = /^\d{9}$/;

    return regex.test(id);
}

const validateInitialMapping = (objects) => {

    const concepts = new Map();

    for(const object of objects) {

        if(object.id === undefined || object.id === null) continue;

        if(concepts.has(object.concept)) {
            if(concepts.get(object.concept) !== object.id) {
                displayError("Multiple Concept IDs used for same Key (" + object.concept + ")");
                return false;
            }
        }
        else {
            concepts.set(object.concept, object.id);
        }
    }

    return true;
}

const filterDuplicateMapping = (objects) => {

    let temp = new Set();
    let conceptsWithID = new Set();

    let filtered = objects.filter(object => {
        
        let key = `${object.concept}-${object.id}`;

        if(temp.has(key)) {
            return false;
        } 
        else {
            temp.add(key);
            if(object.id !== undefined) conceptsWithID.add(object.concept);

            return true;
        }
    });

    filtered = filtered.filter(object => {
        if(object.id === undefined && conceptsWithID.has(object.concept)) return false;

        return true;
    });
    

    return filtered;
}

const backfillConceptIDs = (objects) => {

    const ids = new Set(objects.map(object => object.id));

    for (let object of objects) {
        if(object.id === undefined) {
            let id;
            
            do {
                id = generateConceptID();
            } while(ids.has(id));

            ids.add(id);
            object.id = id;
        }
    }

    return objects
}

const displayError = (message) => {
    alert(message);
    return true;
}

const generateConceptID = () => {
    return Math.floor(100000000 + Math.random() * 900000000);
}

const objectExists = (objects, key, value) => {
    return objects.find(object => object[key] === value);
}

const isEmpty = (object) => {
    for(let prop in object) {
        if(Object.prototype.hasOwnProperty.call(object, prop)) {
            return false;
        }
    }

    return true;
}  

document.getElementById('input_dom_element').addEventListener('change', dictionary_import);