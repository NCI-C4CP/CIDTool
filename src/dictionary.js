import { objectExists, isEmpty, uniqueKeys } from "./common.js";

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

export const structureFiles = (data) => {

    const primaryObjects = data.filter(x => x.object_type === "PRIMARY");
    const secondaryObjects = data.filter(x => x.object_type === "SECONDARY");
    const sourceObjects = data.filter(x => x.object_type === "SOURCE");
    const questionObjects = data.filter(x => x.object_type === "QUESTION");
    const responseObjects = data.filter(x => x.object_type === "RESPONSE");

    const primaryKeys = uniqueKeys(primaryObjects);
    const secondaryKeys = uniqueKeys(secondaryObjects);
    const sourceKeys = uniqueKeys(sourceObjects);
    const questionKeys = uniqueKeys(questionObjects);
    const responseKeys = uniqueKeys(responseObjects);

    let dictionaryArray = [];

    dictionaryArray = filesToArray(primaryObjects, primaryKeys, "Primary", dictionaryArray);
    dictionaryArray = filesToArray(secondaryObjects, secondaryKeys, "Secondary", dictionaryArray);
    dictionaryArray = filesToArray(questionObjects, questionKeys, "Question", dictionaryArray);
    dictionaryArray = filesToArray(sourceObjects, sourceKeys, "Source", dictionaryArray);

    dictionaryArray = sortDictionaryArray(dictionaryArray);

    dictionaryArray = filesToArray(responseObjects, responseKeys, "Response", dictionaryArray);

    return dictionaryArray;
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
                    } while (data[row + count] && !data[row + count]?.[keyColumn]);

                    fields.responses = responses;


                }

                if(objectType === 'RESPONSE') {
                    if(fields.VALUE !== undefined) delete fields.VALUE;
                }

                conceptObjects.push(buildObject(mapping, data[row][keyColumn], fields, objectType));
            }  
        }
    }
    
    return conceptObjects;
}

const buildObject = (mapping, value, fields, type) => {

    let conceptObject = {};
    let id = mapping.filter(x => x.concept === value)[0].id;

    conceptObject['key'] = value;
    conceptObject['conceptID'] = id;
    conceptObject['object_type'] = type;

    if(fields && !isEmpty(fields)) {
        Object.keys(fields).forEach(field => {
            conceptObject[`${field.toLowerCase()}`] = fields[field];
        });
    }

    return conceptObject;
}

const filesToArray = (objects, keys, type, dictionaryArray) => {

    let headers;
    let fieldToIndex = {};

    let typeMapping = {
        'Secondary': 'Primary Concept ID',
        'Question': 'Secondary Concept ID'
    }

    if(keys.includes('responses')) {
        keys = keys.filter(x => x !== 'responses');
        keys.push('responses');
    }

    if(dictionaryArray.length === 0) {
        dictionaryArray.push([]);
    }

    headers = dictionaryArray[0];

    if(type === 'Source') {
        let sourceIndex = headers.indexOf('source');
        dictionaryArray[0][sourceIndex] = 'Source Concept ID';
        keys = keys.filter(x => x !== 'conceptID');

        for(let i = 0; i < dictionaryArray.length; i++) {
            dictionaryArray[i].splice(sourceIndex, 0, "");
        }

        dictionaryArray[0][sourceIndex] = 'Source Key';
        keys = keys.filter(x => x !== 'key');
        fieldToIndex['key'] = sourceIndex;
        fieldToIndex['conceptID'] = sourceIndex + 1;

        for(let i = 1; i < dictionaryArray.length; i++) {
            if(dictionaryArray[i][fieldToIndex['conceptID']]) {
                let targetObject = objects.filter(x => x.conceptID === dictionaryArray[i][fieldToIndex['conceptID']]);
                
                if(targetObject.length === 1) {
                    dictionaryArray[i][fieldToIndex['key']] = targetObject[0].key;
                }
            }
        }

        // add other key headers

        return dictionaryArray;
    }

    if(type === 'Response') {

        fieldToIndex['key'] = headers.length - 1;
        dictionaryArray[0][headers.length - 1] = 'Response Key';
        keys = keys.filter(x => x !== 'key');

        fieldToIndex['value'] = headers.length;
        headers.push(type + ' Value');
        keys = keys.filter(x => x !== 'value');

        fieldToIndex['conceptID'] = headers.length;
        headers.push(type + ' Concept ID');
        keys = keys.filter(x => x !== 'conceptID');


        for(let i = dictionaryArray.length - 1; i > 0; i--) {
            if(dictionaryArray[i][fieldToIndex['key']]) {
                let responsesObject = JSON.parse(dictionaryArray[i][fieldToIndex['key']]);
                let responseKeys = Object.keys(responsesObject);

                let first = true;
                for(let j = 0; j < responseKeys.length; j++) {
                    if(!first) {
                        dictionaryArray.splice(i + j, 0, new Array(headers.length));
                    }

                    let object = objects.filter(x => x.conceptID === responsesObject[responseKeys[j]]);
                    if(object.length === 1) {
                        dictionaryArray[i + j][fieldToIndex['key']] = object[0].key;
                        dictionaryArray[i + j][fieldToIndex['value']] = responseKeys[j];
                        dictionaryArray[i + j][fieldToIndex['conceptID']] = object[0].conceptID;
                    }

                    first = false;
                }
            }
        }

        // add other response key headers

        return dictionaryArray;
    }

    if(keys.includes('source')) {
        fieldToIndex['source'] = headers.length;
        headers.push('source');
        keys = keys.filter(x => x !== 'source');
    }

    if(keys.includes('key')) {
        fieldToIndex['key'] = headers.length;
        headers.push(type + ' Key');
        keys = keys.filter(x => x !== 'key');
    }

    if(keys.includes('conceptID')) {
        fieldToIndex['conceptID'] = headers.length;
        headers.push(type + ' Concept ID');
        keys = keys.filter(x => x !== 'conceptID');
    }

    if(keys.includes('parent')) {
        keys = keys.filter(x => x !== 'parent');
    }

    for(let key of keys) {
        fieldToIndex[`${key}`] = headers.length;
        headers.push(key);
    }

    let mappingKeys = Object.keys(fieldToIndex);

    if(typeMapping[type]) {
        const columnIndex = dictionaryArray[0].findIndex(item => item === typeMapping[type]);
        let columnValues = dictionaryArray.map(row => row[columnIndex]);
        columnValues.shift();
        const uniqueValues = [...new Set(columnValues)];

        for(const uniqueValue of uniqueValues) {

            let rows = [];

            let matchingObjects = objects.filter(x => x['parent'] === uniqueValue);

            let insertIndex = dictionaryArray.findIndex(row => row[columnIndex] === uniqueValue)
            let lineTemplate = dictionaryArray[insertIndex];

            if(lineTemplate.length < headers.length) {
                lineTemplate.length = headers.length;
            }

            for(const object of matchingObjects) {
                let line = lineTemplate.slice();

                for(const mappingKey of mappingKeys) {
                    if(typeof object[mappingKey] === 'object') {
                        if(!isEmpty(object[mappingKey])) {
                            line[fieldToIndex[mappingKey]] = JSON.stringify(object[mappingKey]);
                        }
                    }
                    else {
                        line[fieldToIndex[mappingKey]] = object[mappingKey];
                    }
                }

                rows.push(line);

            }

            dictionaryArray = [
                ...dictionaryArray.slice(0, insertIndex),
                ...rows,
                ...dictionaryArray.slice(insertIndex + 1)
            ];

            console.log();
        }
    }
    else {
        for(const object of objects) {
            let line = new Array(headers.length);
            for(const mappingKey of mappingKeys) {
                line[fieldToIndex[mappingKey]] = object[mappingKey];
            }
            dictionaryArray.push(line);
        }
    }

    return dictionaryArray;
}

const sortDictionaryArray = (dictionaryArray) => {

    const primaryConcept = dictionaryArray[0].findIndex(item => item === 'Primary Concept ID');
    const secondaryConcept = dictionaryArray[0].findIndex(item => item === 'Secondary Concept ID');
    const sourceConcept = dictionaryArray[0].findIndex(item => item === 'Source Concept ID');

    dictionaryArray.sort((a, b) => {
        if (a[primaryConcept] !== b[primaryConcept]) return a[primaryConcept] - b[primaryConcept];
        if (a[secondaryConcept] !== b[secondaryConcept]) return a[secondaryConcept] - b[secondaryConcept];
        if (a[sourceConcept] !== b[sourceConcept]) return a[sourceConcept] - b[sourceConcept];

        return 0;
    });

    return dictionaryArray;
}