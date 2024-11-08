import { appState, hideAnimation, showAnimation } from "./src/common.js";
import { getAccessToken, getUserDetails } from "./src/api.js";
import { login } from "./src/login.js";
import { renderHomePage } from "./src/homepage.js";
import { addEventFileDrop, addEventDropClicked } from "./src/events.js";

window.onload = async () => {
    router();
}

window.onhashchange = () => {
    router();
}

addEventDropClicked();
addEventFileDrop();

const router = async () => {
    
    // Check if access token is in sessionStorage
    const accessToken = sessionStorage.getItem('gh_access_token');

    appState.setState({ 
        isLoggedIn: accessToken ? true : false,
        files: [],
        index: {},
        currentPage: 1,
        itemsPerPage: 10 
    });

    let route = window.location.hash || '#';
    
    // Check for 'code' parameter in URL which indicates we are on the callback URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // If there's a code, handle the OAuth callback
        await handleCallback();
    } else {
        // Continue with existing routing logic
        const { isLoggedIn } = appState.getState();
        if (isLoggedIn) {
            showAnimation();

            const userData = await getUserDetails();
            console.log(userData.data);

            appState.setState({ user: userData.data });

            // set welcomeUser div
            document.getElementById('welcomeUser').innerHTML = `Welcome, <strong>${userData.data.name}</strong>`;


            document.getElementById('welcomeUser').innerHTML = `
                <span>
                    <i id="homeIcon" class="bi bi-house-fill" style="cursor: pointer; font-size: 1.5rem;"></i>
                    Welcome, <strong>${userData.data.name}</strong>
                    <img src="${userData.data.avatar_url}" class="rounded-circle" style="width: 30px; height: 30px; margin-left: 8px; margin-right: 8px;">
                </span>
            `;

            document.getElementById('homeIcon').addEventListener('click', async () => {
                showAnimation();
                await renderHomePage();
                hideAnimation();
            });

            await renderHomePage();
            hideAnimation();
        } else {
            if (route === '#') {
                login();
            } else {
                window.location.hash = '#';
            }
        }
    }
}

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