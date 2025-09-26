import { addEventLoginButtonClick } from './events.js';
import { LOGIN_TEMPLATES } from './templates.js';

/**
 * Main entry point for the authentication flow.
 * @function login
 * 
 * @param {Object} options - Login page configuration
 * @param {boolean} options.isLoading - Show loading state
 * @param {string} options.errorMessage - Error message to display
 * 
 * @throws {Error} Throws if 'auth' element is not found in DOM
 */
export const login = (options = {}) => {

    const authDiv = document.getElementById('auth');
    if (!authDiv) {
        console.error('Auth container element not found');
        throw new Error('Required DOM element #auth not found');
    }

    // Render login page using template with configuration options
    authDiv.innerHTML = LOGIN_TEMPLATES.loginPage(options);

    // Attach event handler to login button
    try {
        addEventLoginButtonClick();
    } catch (error) {
        console.error('Failed to attach login event handler:', error);
        authDiv.innerHTML = LOGIN_TEMPLATES.loginPage({ 
            errorMessage: 'Failed to initialize login. Please refresh the page.' 
        });
    }
};