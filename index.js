import { assignConcepts } from "./utils/concepts.js";
import { readSpreadsheet, readFiles, generateSpreadsheet } from "./utils/files.js";
import { parseColumns, structureDictionary, structureFiles } from "./utils/dictionary.js";
import { appState } from "./utils/common.js";
import { addEventAddFile } from "./utils/events.js";

const local = true;

let CLIENT_ID = 'Ov23liVVaSBQIH0ahnn7'
let REDIRECT_URI = 'http://localhost:5000/';

if(!local) {
    CLIENT_ID = 'Ov23liu5RSq1PMWSLLqh';
    REDIRECT_URI = 'https://analyticsphere.github.io/CIDTool/';
}

window.onload = async () => {
    router();
}

window.onhashchange = () => {
    router();
}

const router = async () => {
    
    const { loggedIn } = appState.getState();

    if(!loggedIn) {
        appState.setState({ loggedIn: false });
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
        if (loggedIn) {
            if (route === '#home') {
                homePage();
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

const login = () => {

    const homepage = document.getElementById('homepage');
    const callback = document.getElementById('callback');
    const loginButton = document.getElementById('login');

    homepage.style.display = '';
    callback.style.display = 'none';    

    loginButton.addEventListener('click', () => {
        const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
        window.location.href = url;
    });
}

const homePage = async () => {
    
    const homepage = document.getElementById('homepage');
    const callback = document.getElementById('callback');
    
    homepage.style.display = 'none';
    callback.style.display = '';

    callback.innerHTML = `<h1>Please Wait...</h1>`;

    const response = await fetch(`https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=getUser`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
    });

    const data = await response.json();

    console.log(data);

    callback.innerHTML = `
        <h1>Welcome ${data.data.name}</h1>
        
        <button id="addFile">Add File</button>
    `;

    addEventAddFile();
}

const handleCallback = async () => {

    const homepage = document.getElementById('homepage');
    const callback = document.getElementById('callback');
    
    homepage.style.display = 'none';
    callback.style.display = '';

    callback.innerHTML = `<h1>Fetching Access...</h1>`;


    const code = new URL(window.location.href).searchParams.get('code');
    if (code) {
        const url = new URL(window.location);
        url.searchParams.delete('code');
        window.history.pushState({}, '', url);

        const accessToken = await fetchAccessToken(code);
        if (accessToken) {
            // Save the access token securely, for example in sessionStorage
            sessionStorage.setItem('gh_access_token', accessToken);
            window.location.hash = '#home';
            appState.setState({ loggedIn: true });
        } else {
            console.error('Failed to obtain access token');
            window.location.hash = '#';
        }
    }
};

const fetchAccessToken = async (code) => {
    const tokenResponse = await fetch(`https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=accessToken${local ? '&environment=dev' : ''}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            code: code,
            redirect: REDIRECT_URI
        })
    });

    if (tokenResponse.ok) {
        const jsonResponse = await tokenResponse.json();
        return jsonResponse.access_token;
    } else {
        console.error('Failed to fetch access token', tokenResponse);
        return null;
    }
};

export const addFile = async () => {
    console.log()
    const response = await fetch('https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=createFile', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            owner: 'Davinkjohnson',
            repo: 'AuthTest',
            path: 'concepts/file.json',
            message: 'modify file again',
            content: 'eyJ0ZXN0aW5nIjogInN1Y2Nlc3MgYWdhaW4ifQ=='
        })
    });

    const data = await response.json();
    console.log(data);
}