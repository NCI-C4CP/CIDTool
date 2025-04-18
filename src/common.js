import { getFiles } from './api.js';

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

export const uniqueKeys = (objects) => {

    let keys = [];

    for(let object of objects) {
        const objectKeys = Object.keys(object);
        
        for(let key of objectKeys) {
            if(key === "object_type") continue;
            if(!keys.includes(key)) keys.push(key);
        }
    }
    
    return keys;
}

const createStore = (initialState = {}) => {
    let state = initialState;
  
    const setState = (update) => {
      const currSlice = typeof update === 'function' ? update(state) : update;
  
      if (currSlice !== state) {
        state = { ...state, ...currSlice };
      }
    };
  
    const getState = () => state;
  
    return { setState, getState };
}

export const appState = createStore();

export const toBase64 = (string) => {
    return btoa(string);
}

export const fromBase64 = (string) => {
    return atob(string);
}

export const showAnimation = () => {
    document.querySelector('.spinner-wrapper').style.display = 'flex';
}

export const hideAnimation = () => {
    document.querySelector('.spinner-wrapper').style.display = 'none';
}

export const isLocal = () => {
    return window.location.href.includes('localhost');
}

export const executeWithAnimation = async (func, ...args) => {
    showAnimation();
    try {
        await func(...args);
    } finally {
        hideAnimation();
    }
};

export const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
}

export const getFileContent = async (file) => {
    const contents = await getFiles(file);
    const fileContentString = fromBase64(contents.data.content);
    return {
        content: JSON.parse(fileContentString)
    };
}