import { objectExists, isEmpty } from "./common.js";

export const parseColumns = (headers) => {
    
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

const getExtraKeys = (object) => {

    const keys = ['KEY', 'CID', 'object_type'];
    let set = new Set(keys);
    return Object.keys(object).filter(key => !set.has(key));
}

export const structureDictionary = (mapping, columns, data) => {

    let conceptObjects = [];

    conceptObjects = findObjects(mapping, columns, data, 'PRIMARY', conceptObjects);
    conceptObjects = findObjects(mapping, columns, data, 'SECONDARY', conceptObjects);
    conceptObjects = findObjects(mapping, columns, data, 'SOURCE', conceptObjects);
    conceptObjects = findObjects(mapping, columns, data, 'RESPONSE', conceptObjects);
    conceptObjects = findObjects(mapping, columns, data, 'QUESTION', conceptObjects);
    
    return conceptObjects;
}

const findObjects = (mapping, columns, data, objectType, conceptObjects) => {

    const primaryColumns = columns.find(x => x.object_type === objectType);
    const keyColumn = primaryColumns.KEY;
    const extraColumns = getExtraKeys(primaryColumns);

    for (let row = 0; row <= data.length - 1; row++) {
        if(data[row][keyColumn]) {
            if(!objectExists(conceptObjects, 'key', data[row][keyColumn])) {
                
                let fields = {};

                if(extraColumns.length > 0) {
                    extraColumns.forEach(ec => {
                        if(data[row][primaryColumns[ec]] !== undefined) {
                            fields[`${ec}`] = data[row][primaryColumns[ec]];
                        }
                    })
                }

                if(objectType === 'SECONDARY' || objectType === 'QUESTION') {

                    const parentKeyColumn = objectType === 'SECONDARY' ? columns.find(x => x.object_type === 'PRIMARY').KEY : columns.find(x => x.object_type === 'SECONDARY').KEY;

                    for(let i = row; i >= 0; i--) {
                        if(data[i][parentKeyColumn]) {
                            fields.parent = mapping.filter(x => x.concept === data[i][parentKeyColumn])[0].id
                            break;
                        }
                    }
                }

                if(objectType === 'QUESTION') {
                    
                    const sourceKeyColumn = columns.find(x => x.object_type === 'SOURCE').KEY;
                    
                    if(data[row][sourceKeyColumn]) {
                        fields.source = mapping.filter(x => x.concept === data[row][sourceKeyColumn])[0].id
                    }

                    const responseColumns = columns.find(x => x.object_type === 'RESPONSE');
                    
                    let responses = {};
                    let count = 0;
                    do {
                        if(data[row + count][responseColumns.KEY]) {
                            const responseIndex = data[row + count][responseColumns.VALUE];
                            const responseConcept = conceptObjects.find(x => x.key === data[row + count][responseColumns.KEY]).conceptID;

                            responses[responseIndex] = responseConcept;

                            count++;
                        }
                    } while (!data[row + count][keyColumn]);

                    fields.responses = responses;


                }

                if(objectType === 'RESPONSE') {
                    if(fields.VALUE !== undefined) delete fields.VALUE;
                }

                conceptObjects.push(buildObject(mapping, data[row][keyColumn], fields));
            }  
        }
    }
    
    return conceptObjects;
}

const addResponses = (value, responses) => {

    if(responses.length > 0) {
        let object = conceptObjects.find(x => x.key === value);

        if(object) {
            object['responses'] = responses;
        }
    }    
}

const buildObject = (mapping, value, fields) => {

    let conceptObject = {};
    let id = mapping.filter(x => x.concept === value)[0].id;

    conceptObject['key'] = value;
    conceptObject['conceptID'] = id;

    if(fields && !isEmpty(fields)) {
        Object.keys(fields).forEach(field => {
            conceptObject[`${field.toLowerCase()}`] = fields[field];
        });
    }

    return conceptObject;
}