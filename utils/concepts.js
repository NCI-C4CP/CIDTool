export const assignConcepts = (categories, data) => {

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

                console.log("Line - " + i + "\nConcept - " + data[i][key] + "\nID - " + data[i][id] + "\n-----------");
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

const generateConceptID = () => {
    return Math.floor(100000000 + Math.random() * 900000000);
}