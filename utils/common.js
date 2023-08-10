export const displayError = (message) => {
    alert(message);
    return true;
}

export const objectExists = (objects, key, value) => {
    return objects.find(object => object[key] === value);
}

export const isEmpty = (object) => {
    for(let prop in object) {
        if(Object.prototype.hasOwnProperty.call(object, prop)) {
            return false;
        }
    }

    return true;
}  