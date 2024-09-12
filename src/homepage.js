import { addEventAddFile } from './events.js';
import { appState, showAnimation, hideAnimation } from './common.js';
import { addFile } from './api.js';
import { REPO } from '../config.js';

export const homePage = async () => {
    
    const authDiv = document.getElementById('auth');
    const user = appState.getState().user;

    authDiv.innerHTML = `
        <h1>Welcome ${user.name}</h1>
        <button id="addFile">Add Concept</button>
        <button id="modifyFile">Modify Concept</button>
        <button id="deleteFile">Delete Concept</button>
    `;

    addEventAddFile();
}

export const renderAddFile = () => {
    const authDiv = document.getElementById('auth');

    authDiv.innerHTML = `
        <h1>Add Concept</h1>
        <input type="text" id="conceptID" placeholder="Concept ID">
        <input type="text" id="conceptName" placeholder="Concept Name">
        <button id="addFileButton">Submit</button>
    `;

    const addFileButton = document.getElementById('addFileButton');

    addFileButton.addEventListener('click', async () => {
        const conceptID = document.getElementById('conceptID').value;
        const conceptName = document.getElementById('conceptName').value;

        const infoObject = {
            id: conceptID,
            name: conceptName
        };

        const path = `concepts/${conceptID}.json`;
        const content = JSON.stringify(infoObject);

        showAnimation();
        const check = await addFile(REPO, path, content);
        hideAnimation();
        
        console.log(check);
    });
}