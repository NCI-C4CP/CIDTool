import { CLIENT_ID, REDIRECT_URI } from '../index.js';
import { renderAddFile } from './homepage.js';

export const addEventAddFile = () => {
    const button = document.getElementById('addFile');
    if(!button) return;

    button.addEventListener('click', async () => {
        renderAddFile();
    });
}

export const addEventLoginButtonClick = () => {
    const loginButton = document.getElementById('login');
    if(!loginButton) return;
    
    loginButton.addEventListener('click', () => {
        const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
        window.location.href = url;
    });
}