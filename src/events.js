import { renderAddFile, renderHomePage } from './homepage.js';
import { isLocal } from './common.js';
import { CLIENT_ID, REDIRECT_URI, CLIENT_ID_LOCAL, REDIRECT_URI_LOCAL } from '../config.js';

export const addEventAddFile = () => {
    const button = document.getElementById('addFile');
    if(!button) return;

    button.addEventListener('click', async () => {
        renderAddFile();
    });
}

export const addEventModifyFile = () => {
    const button = document.getElementById('modifyFile');
    if(!button) return;

    button.addEventListener('click', async () => {
        renderHomePage();
    });
}

export const addEventLoginButtonClick = () => {
    const loginButton = document.getElementById('login');
    if (!loginButton) return;

    let id;
    let uri;

    let local = isLocal();

    if (local) {
        id = CLIENT_ID_LOCAL;
        uri = REDIRECT_URI_LOCAL;
    }
    else {
        id = CLIENT_ID;
        uri = REDIRECT_URI;
    }
    
    loginButton.addEventListener('click', () => {
        const url = `https://github.com/login/oauth/authorize?client_id=${id}&redirect_uri=${uri}&scope=repo`;
        window.location.href = url;
    });
}