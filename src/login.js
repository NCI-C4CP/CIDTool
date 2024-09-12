import { addEventLoginButtonClick } from './events.js';
import { appState, hideAnimation, showAnimation } from './common.js';
import { homePage } from './homepage.js';
import { getUserDetails } from './api.js';

export const login = () => {

    const authDiv = document.getElementById('auth');

    authDiv.innerHTML = `
        <div id="homepage">
            <h1>Homepage</h1>
            <button id="login">Login with GitHub</button>
        </div>
    `;

    addEventLoginButtonClick();
}

export const loggedIn = async () => {

    showAnimation();

    const data = await getUserDetails();
    console.log(data.data);

    appState.setState({ user: data.data });

    homePage();

    hideAnimation();
}