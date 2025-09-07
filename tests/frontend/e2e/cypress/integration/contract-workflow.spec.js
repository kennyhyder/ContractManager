// tests/frontend/e2e/cypress/integration/contract-workflow.spec.js
describe('Contract Workflow E2E', () => {
  beforeEach(() => {
    cy.task('db:seed');
    cy.login('test@example.com', 'TestPass123!');
  });

  it('should complete full contract workflow', () => {
    // Navigate to contracts
    cy.visit('/contracts');
    
    // Create new contract
    cy.get('[data-testid="create-contract-btn"]').click();
    
    // Fill form
    cy.get('[name="title"]').type('E2E Test Contract');
    cy.get('[name="clientName"]').type('Cypress Test Client');
    cy.get('[name="clientEmail"]').type('cypress@testclient.com');
    cy.get('[name="value"]').type('75000');
    
    // Select template
    cy.get('[data-testid="use-template-checkbox"]').check();
    cy.get('[data-testid="template-select"]').select('Service Agreement');
    
    // Set dates
    cy.get('[name="startDate"]').type('2024-01-01');
    cy.get('[name="endDate"]').type('2024-12-31');
    
    // Submit
    cy.get('[type="submit"]').click();
    
    // Verify redirect to contract detail
    cy.url().should('match', /\/contracts\/[a-f0-9]{24}$/);
    cy.contains('E2E Test Contract').should('be.visible');
    
    // Add comment
    cy.get('[data-testid="add-comment-btn"]').click();
    cy.get('[data-testid="comment-textarea"]').type('This is a test comment');
    cy.get('[data-testid="submit-comment-btn"]').click();
    
    // Verify comment appears
    cy.contains('This is a test comment').should('be.visible');
    
    // Upload document
    cy.get('[data-testid="upload-document-btn"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-document.pdf');
    cy.get('[data-testid="upload-confirm-btn"]').click();
    
    // Verify document uploaded
    cy.contains('test-document.pdf').should('be.visible');
    
    // Share contract
    cy.get('[data-testid="share-contract-btn"]').click();
    cy.get('[data-testid="share-email-input"]').type('colleague@example.com');
    cy.get('[data-testid="share-permission-select"]').select('edit');
    cy.get('[data-testid="send-share-btn"]').click();
    
    // Verify share success
    cy.contains('Contract shared successfully').should('be.visible');
    
    // Change status
    cy.get('[data-testid="status-select"]').select('active');
    cy.get('[data-testid="update-status-btn"]').click();
    
    // Verify status updated
    cy.contains('Status updated to active').should('be.visible');
    cy.get('[data-testid="status-badge"]').should('contain', 'Active');
  });

  it('should handle real-time collaboration', () => {
    // Create contract first
    cy.createContract({
      title: 'Collaboration Test',
      clientName: 'Collab Client'
    }).then((contract) => {
      // Open in first window
      cy.visit(`/contracts/${contract.id}`);
      
      // Open in second window (simulated)
      cy.window().then((win) => {
        // Store reference to first window
        const firstWindow = win;
        
        // Simulate another user joining
        cy.task('websocket:emit', {
          event: 'join:contract',
          data: { contractId: contract.id, userId: 'other-user' }
        });
        
        // Verify presence indicator
        cy.get('[data-testid="active-users"]').should('contain', '2 users active');
        
        // Simulate other user editing
        cy.task('websocket:emit', {
          event: 'contract:update',
          data: {
            contractId: contract.id,
            field: 'title',
            value: 'Updated by Other User'
          }
        });
        
        // Verify real-time update
        cy.get('[name="title"]').should('have.value', 'Updated by Other User');
        
        // Test field locking
        cy.get('[name="clientName"]').focus();
        
        // Simulate other user trying to edit same field
        cy.task('websocket:emit', {
          event: 'field:edit',
          data: {
            contractId: contract.id,
            field: 'clientName'
          }
        });
        
        // Verify lock notification
        cy.contains('Field is currently being edited by another user').should('be.visible');
      });
    });
  });

  it('should handle approval workflow', () => {
    // Create contract requiring approval
    cy.createContract({
      title: 'Approval Test Contract',
      value: 150000, // Above approval threshold
      requiresApproval: true
    }).then((contract) => {
      cy.visit(`/contracts/${contract.id}`);
      
      // Verify pending approval status
      cy.get('[data-testid="status-badge"]').should('contain', 'Pending Approval');
      
      // Submit for approval
      cy.get('[data-testid="submit-approval-btn"]').click();
      cy.get('[data-testid="approver-select"]').select('manager@example.com');
      cy.get('[data-testid="approval-notes"]').type('Please review and approve');
      cy.get('[data-testid="send-approval-btn"]').click();
      
      // Switch to manager account
      cy.logout();
      cy.login('manager@example.com', 'ManagerPass123!');
      
      // Navigate to approvals
      cy.visit('/approvals');
      cy.contains('Approval Test Contract').click();
      
      // Review and approve
      cy.get('[data-testid="approve-btn"]').click();
      cy.get('[data-testid="approval-comments"]').type('Approved with conditions');
      cy.get('[data-testid="confirm-approval-btn"]').click();
      
      // Verify approval
      cy.contains('Contract approved successfully').should('be.visible');
      cy.get('[data-testid="status-badge"]').should('contain', 'Approved');
    });
  });
});