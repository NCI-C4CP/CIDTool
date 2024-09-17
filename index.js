import { assignConcepts } from "./src/concepts.js";
import { readSpreadsheet, readFiles, generateSpreadsheet } from "./src/files.js";
import { parseColumns, structureDictionary, structureFiles } from "./src/dictionary.js";
import { appState, hideAnimation, showAnimation } from "./src/common.js";
import { getAccessToken, getFiles, getUserDetails } from "./src/api.js";
import { login } from "./src/login.js";
import { renderHomePage } from "./src/homepage.js";

window.onload = async () => {
    router();
}

window.onhashchange = () => {
    router();
}

const router = async () => {
    
    const { isLoggedIn } = appState.getState();

    if(!isLoggedIn) {
        appState.setState({ isLoggedIn: false });
    }

    let route = window.location.hash || '#';
    
    // Check for 'code' parameter in URL which indicates we are on the callback URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // If there's a code, handle the OAuth callback
        await handleCallback();
    } else {
        // Continue with existing routing logic
        if (isLoggedIn) {
            if (route === '#home') {
                showAnimation();

                const userData = await getUserDetails();
                console.log(userData.data);

                appState.setState({ user: userData.data });

                // set welcomeUser div
                document.getElementById('welcomeUser').innerHTML = `Welcome, <strong>${userData.data.name}</strong>`;


                document.getElementById('welcomeUser').innerHTML = `
                    Welcome, <strong>${userData.data.name}</strong>
                    <img src="${userData.data.avatar_url}" class="rounded-circle" style="width: 30px; height: 30px; margin-right: 8px;">
                `;

                const fileData = await getFiles();
                appState.setState({ files: fileData.data });

                renderHomePage();
                hideAnimation();
            } else {
                window.location.hash = '#';
            }
        } else {
            if (route === '#') {
                login();
            } else {
                window.location.hash = '#';
            }
        }
    }
}


const dictionary_import = async (event) => {  

    const data = await readSpreadsheet(event.target.files[0]);
    const columns = parseColumns(data[0]);

    data.shift();

    const mapping = assignConcepts(columns, data);
    if(!mapping) {
        console.log("failed to create key -> concept mapping");
        return;
    }

    const conceptObjects = structureDictionary(mapping, columns, data);
    appState.setState({ conceptObjects });
}

const dictionary_export = async (event) => {
    let data = await readFiles(event.target.files);

    let structuredData = structureFiles(data);
    generateSpreadsheet(structuredData);
}

/*
document.getElementById('input_dom_element').addEventListener('change', dictionary_import);
document.getElementById('output_dom_element').addEventListener('change', dictionary_export);

document.getElementById('directory_picker').addEventListener('click', async () => {
    const folderHandler = await window.showDirectoryPicker();
    appState.setState({ folderHandler });
});

document.getElementById('file_saver').addEventListener('click', async () => {
    
    const { folderHandler, conceptObjects } = appState.getState();
    
    conceptObjects.forEach(async conceptObject => {
        const blob = new Blob([JSON.stringify(conceptObject)], { type: "application/json" });
        const name = `${conceptObject.conceptID}.json`;
        const fileHandle = await folderHandler.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();

        await writable.write(blob);
        await writable.close();
    
        console.log(`JSON file "${name}" saved successfully`);
    });
});

document.getElementById('input_dom_element').addEventListener('change', async () => {
    const data = await readSpreadsheet(event.target.files[0]);
    const columns = parseColumns(data[0]);

    data.shift();

    const mapping = assignConcepts(columns, data);
    if(!mapping) {
        console.log("failed to create key -> concept mapping");
        return;
    }

    const conceptObjects = structureDictionary(mapping, columns, data);
    appState.setState({ conceptObjects });
});

*/

const handleCallback = async () => {

    showAnimation();

    const code = new URL(window.location.href).searchParams.get('code');
    if (code) {
        const url = new URL(window.location);
        url.searchParams.delete('code');
        window.history.pushState({}, '', url);

        const tokenObject = await getAccessToken(code);
        if (tokenObject?.access_token) {
            sessionStorage.setItem('gh_access_token', tokenObject.access_token);
            window.location.hash = '#home';
            appState.setState({ isLoggedIn: true });
        } else {
            console.error('Failed to obtain access token');
            window.location.hash = '#';
        }
    }

    hideAnimation();
};