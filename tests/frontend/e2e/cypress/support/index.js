// cypress/support/index.js
// Import commands
import './commands';

// Import custom commands and utilities
import 'cypress-real-events/support';
import 'cypress-file-upload';
import '@testing-library/cypress/add-commands';

// Cypress Recording
import addContext from 'mochawesome/addContext';

// Preserve cookies between tests
Cypress.Cookies.defaults({
  preserve: ['token', 'sessionId']
});

// Global before hooks
before(() => {
  // Clear all data before test suite
  cy.task('db:clean');
  cy.clearLocalStorage();
  cy.clearCookies();
});

// Before each test
beforeEach(() => {
  // Set up interceptors for common requests
  cy.intercept('GET', '**/api/auth/me', { fixture: 'auth/user.json' }).as('getMe');
  cy.intercept('GET', '**/api/config', { fixture: 'config.json' }).as('getConfig');
  
  // Preserve authentication between tests in same suite
  cy.restoreLocalStorage();
});

// After each test
afterEach(() => {
  cy.saveLocalStorage();
});

// Screenshot on failure
Cypress.on('test:after:run', (test, runnable) => {
  if (test.state === 'failed') {
    const screenshot = `${Cypress.config('screenshotsFolder')}/${Cypress.spec.name}/${runnable.parent.title} -- ${test.title} (failed).png`;
    addContext({ test }, screenshot);
  }
});

// Uncaught exception handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing tests on uncaught exceptions
  // Log the error for debugging
  console.error('Uncaught exception:', err);
  
  // Return false to prevent the error from failing the test
  // unless it's a critical error we want to catch
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  
  return true;
});

// Custom viewport commands
Cypress.Commands.add('setMobileViewport', () => {
  cy.viewport('iphone-x');
});

Cypress.Commands.add('setTabletViewport', () => {
  cy.viewport('ipad-2');
});

Cypress.Commands.add('setDesktopViewport', () => {
  cy.viewport(1920, 1080);
});

// Local storage commands
const LOCAL_STORAGE_MEMORY = {};

Cypress.Commands.add('saveLocalStorage', () => {
  Object.keys(localStorage).forEach(key => {
    LOCAL_STORAGE_MEMORY[key] = localStorage[key];
  });
});

Cypress.Commands.add('restoreLocalStorage', () => {
  Object.keys(LOCAL_STORAGE_MEMORY).forEach(key => {
    localStorage.setItem(key, LOCAL_STORAGE_MEMORY[key]);
  });
});

// Accessibility testing
Cypress.Commands.add('checkA11y', (context, options) => {
  cy.injectAxe();
  cy.checkA11y(context, options);
});