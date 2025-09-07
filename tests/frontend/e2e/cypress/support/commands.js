// tests/frontend/e2e/cypress/support/commands.js
// Custom commands for Cypress tests

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  cy.get('[name="email"]').type(email);
  cy.get('[name="password"]').type(password);
  cy.get('[type="submit"]').click();
  
  // Wait for redirect after login
  cy.url().should('not.include', '/login');
  
  // Verify auth token is stored
  cy.window().its('localStorage.token').should('exist');
});

Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-btn"]').click();
  cy.url().should('include', '/login');
});

Cypress.Commands.add('createContract', (contractData) => {
  return cy.request({
    method: 'POST',
    url: '/api/contracts',
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('token')}`
    },
    body: {
      title: 'Test Contract',
      clientName: 'Test Client',
      value: 10000,
      status: 'draft',
      ...contractData
    }
  }).then((response) => ({
    id: response.body._id,
    ...response.body
  }));
});

Cypress.Commands.add('uploadFile', (selector, fileName, fileType = '') => {
  cy.get(selector).then(subject => {
    cy.fixture(fileName, 'base64').then(fileContent => {
      const blob = Cypress.Blob.base64StringToBlob(fileContent, fileType);
      const file = new File([blob], fileName, { type: fileType });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      subject[0].files = dataTransfer.files;
      cy.wrap(subject).trigger('change', { force: true });
    });
  });
});

// Intercept and mock API calls
Cypress.Commands.add('mockApi', () => {
  cy.intercept('GET', '/api/contracts*', { fixture: 'contracts.json' }).as('getContracts');
  cy.intercept('GET', '/api/users/me', { fixture: 'user.json' }).as('getUser');
  cy.intercept('GET', '/api/templates*', { fixture: 'templates.json' }).as('getTemplates');
});

// Wait for page to be fully loaded
Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-testid="loading-spinner"]').should('not.exist');
  cy.get('[data-testid="page-content"]').should('be.visible');
});

// Database commands (requires backend support)
Cypress.Commands.add('seedDatabase', (data) => {
  cy.task('db:seed', data);
});

Cypress.Commands.add('cleanDatabase', () => {
  cy.task('db:clean');
});