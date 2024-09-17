import { addEventLoginButtonClick } from './events.js';

export const login = () => {

    const authDiv = document.getElementById('auth');

    authDiv.innerHTML = `
        <div id="homepage" class="d-flex justify-content-center align-items-center vh-100">
            <div class="text-center">
                <button id="login" class="btn btn-primary btn-lg">
                    <i class="bi bi-github"></i> Login with GitHub
                </button>
            </div>
        </div>
    `;

    addEventLoginButtonClick();
}