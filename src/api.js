import { REDIRECT_URI, REDIRECT_URI_LOCAL } from '../config.js';
import { toBase64, isLocal, appState } from './common.js';

export const getUserDetails = async () => {
    
    try {
        const response = await fetch(`https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=getUser`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });
        
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}

export const getAccessToken = async (code) => {

    let uri;
    let local = isLocal();

    if (local) {
        uri = REDIRECT_URI_LOCAL;
    }
    else {
        uri = REDIRECT_URI;
    }

    try {
        const response = await fetch(`https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=accessToken${local ? '&environment=dev' : ''}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                redirect: uri
            })
        });

        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}

// used for downloading
export const getRepoContents = async () => {

    const state = appState.getState();
    const { owner, repoName } = state;

    try {
        const response = await fetch(`https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=getRepo&owner=${owner}&repo=${repoName}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });
        
        const data = await response.blob();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}

export const addFile = async (fileName, content) => {
    
    const state = appState.getState();
    const { owner, repoName, directory } = state;

    let path = '';
    if (directory) {
        path = directory + '/';
    }
    
    path = path + fileName;

    try {
        const response = await fetch('https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=addFile', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                owner: owner,
                repo: repoName,
                path,
                message: 'file added via CID Tool',
                content: toBase64(content)
            })
        });
    
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}

export const updateFile = async (fileName, content, sha) => {

    const state = appState.getState();
    const { owner, repoName, directory } = state;

    let path = '';
    if (directory) {
        path = directory + '/';
    }
    
    path = path + fileName;

    try {
        const response = await fetch('https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=updateFile', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                owner: owner,
                repo: repoName,
                path,
                sha,
                message: 'file modified via CID Tool',
                content: toBase64(content)
            })
        });
    
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }

}

export const deleteFile = async (fileName, sha) => {

    const state = appState.getState();
    const { owner, repoName, directory } = state;

    let path = '';
    if (directory) {
        path = directory + '/';
    }
    
    path = path + fileName;

    try {
        const response = await fetch('https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=deleteFile', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                owner: owner,
                repo: repoName,
                path,
                sha,
                message: 'file deleted via CID Tool'
            })
        });
    
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}

export const getFiles = async (fileName = '') => {

    const state = appState.getState();
    const { owner, repoName, directory } = state;

    let path = '';
    if (directory) {
        path = directory;
    }
    if (fileName) {
        path = path + '/' + fileName;
    }

    try {
        const url = `https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=getFiles&owner=${owner}&repo=${repoName}&path=${path}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}

export const getUserRepositories = async () => {

    try {
        const response = await fetch(`https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=getUserRepositories`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });
        
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}