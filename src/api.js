import { REDIRECT_URI } from '../index.js';
import { toBase64, appState } from './common.js';

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

export const getAccessToken = async (code, local) => {

    try {
        const response = await fetch(`https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=accessToken${local ? '&environment=dev' : ''}`, {
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

        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}

export const addFile = async (repo, path, content) => {
    
    try {
        const response = await fetch('https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=addFile', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                owner: 'anthonypetersen',
                repo,
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

export const modifyFile = async (repo, path, content, sha) => {

    try {
        const response = await fetch('https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=modifyFile', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                owner: appState.getState().user.login,
                repo,
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

export const deleteFile = async () => {


}

export const getFiles = async () => {

    try {
        const response = await fetch('https://us-central1-nih-nci-dceg-connect-dev.cloudfunctions.net/ghauth?api=getFiles', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('gh_access_token')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                owner: appState.getState().user.login,
                repo,
                path
            })
        });
    
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error(error);
    }
}