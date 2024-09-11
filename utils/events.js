import { addFile } from '../index.js';

export const addEventAddFile = (element, event) => {
    const button = document.getElementById('addFile');
    if(!button) return;

    button.addEventListener('click', async () => {
        addFile();
    });
}