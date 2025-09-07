// tests/backend/e2e/user-flows.test.js
require('../setup');
const request = require('supertest');
const app = require('../../../backend/app');
const Contract = require('../../../backend/models/Contract');
const User = require('../../../backend/models/User');
const EmailService = require('../../../backend/services/EmailService');

// Mock email service for E2E tests
jest.mock('../../../backend/services/EmailService');

describe('User Flow E2E Tests', () => {
  let emailService;

  beforeEach(() => {
    emailService = new EmailService();
    EmailService.mockImplementation(() => emailService);
    emailService.sendEmail = jest.fn().mockResolvedValue({ messageId: 'test' });
  });

  describe('Complete User Journey', () => {
    it('should complete full user lifecycle', async () => {
      const userData = {
        email: 'e2e-user@example.com',
        password: 'E2EPassword123!',
        firstName: 'E2E',
        lastName: 'User'
      };

      // 1. Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerRes.status).toBe(201);
      const { token: initialToken, user } = registerRes.body;

      // 2. Verify email was sent
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userData.email,
          template: 'welcome'
        })
      );

      // 3. Simulate email verification
      await User.findByIdAndUpdate(user._id, { emailVerified: true });

      // 4. Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      expect(loginRes.status).toBe(200);
      const { token } = loginRes.body;

      // 5. Update profile
      const profileRes = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Updated',
          company: 'E2E Corp'
        });

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.firstName).toBe('Updated');

      // 6. Create contract
      const contractRes = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'E2E Test Contract',
          clientName: 'E2E Client',
          value: 100000
        });

      expect(contractRes.status).toBe(201);
      const contractId = contractRes.body._id;

      // 7. Upload document
      const uploadRes = await request(app)
        .post(`/api/contracts/${contractId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('test file content'), 'test.pdf');

      expect(uploadRes.status).toBe(201);

      // 8. Share contract
      const collaborator = await User.create({
        email: 'collaborator@example.com',
        password: 'CollabPass123!',
        firstName: 'Collab',
        lastName: 'User',
        emailVerified: true
      });

      const shareRes = await request(app)
        .post(`/api/contracts/${contractId}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: collaborator._id,
          permissions: ['read', 'comment']
        });

      expect(shareRes.status).toBe(200);

      // 9. Add comment as collaborator
      const collabToken = generateAuthToken(collaborator);
      const commentRes = await request(app)
        .post(`/api/contracts/${contractId}/comments`)
        .set('Authorization', `Bearer ${collabToken}`)
        .send({
          text: 'This looks good!'
        });

      expect(commentRes.status).toBe(201);

      // 10. Complete contract
      const completeRes = await request(app)
        .put(`/api/contracts/${contractId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'completed'
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.status).toBe('completed');

      // 11. Generate report
      const reportRes = await request(app)
        .get('/api/analytics/report')
        .set('Authorization', `Bearer ${token}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        });

      expect(reportRes.status).toBe(200);
      expect(reportRes.body).toHaveProperty('totalContracts');
      expect(reportRes.body.totalContracts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Contract Approval Workflow', () => {
    it('should complete approval workflow', async () => {
      // Create users with different roles
      const manager = await User.create({
        email: 'manager@example.com',
        password: 'ManagerPass123!',
        firstName: 'Manager',
        lastName: 'User',
        role: 'manager',
        emailVerified: true
      });

      const employee = await User.create({
        email: 'employee@example.com',
        password: 'EmployeePass123!',
        firstName: 'Employee',
        lastName: 'User',
        role: 'user',
        emailVerified: true
      });

      const managerToken = generateAuthToken(manager);
      const employeeToken = generateAuthToken(employee);

      // 1. Employee creates contract
      const contractRes = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Approval Test Contract',
          clientName: 'Approval Client',
          value: 150000,
          requiresApproval: true
        });

      expect(contractRes.status).toBe(201);
      const contract = contractRes.body;

      // 2. Contract should be in pending approval
      expect(contract.status).toBe('pending_approval');

      // 3. Submit for approval
      const submitRes = await request(app)
        .post(`/api/contracts/${contract._id}/submit-approval`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          approverId: manager._id,
          notes: 'Please review and approve'
        });

      expect(submitRes.status).toBe(200);

     // 4. Verify notification was sent
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: manager.email,
          template: 'approval-request'
        })
      );

      // 5. Manager reviews contract
      const reviewRes = await request(app)
        .get(`/api/contracts/${contract._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(reviewRes.status).toBe(200);

      // 6. Manager approves contract
      const approveRes = await request(app)
        .post(`/api/contracts/${contract._id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          comments: 'Approved with minor suggestions',
          conditions: ['Update payment terms to Net 30']
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('approved');
      expect(approveRes.body.approvals).toHaveLength(1);

      // 7. Employee receives notification
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: employee.email,
          template: 'approval-notification'
        })
      );

      // 8. Employee activates contract
      const activateRes = await request(app)
        .put(`/api/contracts/${contract._id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          status: 'active'
        });

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.status).toBe('active');
    });
  });

  describe('Contract Lifecycle with Reminders', () => {
    it('should handle contract expiry and renewal', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      // 1. Create contract expiring soon
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now

      const contractRes = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Expiring Contract',
          clientName: 'Renewal Client',
          value: 50000,
          endDate: expiryDate,
          autoRenew: true,
          renewalNoticeDays: 30
        });

      expect(contractRes.status).toBe(201);
      const contract = contractRes.body;

      // 2. Trigger reminder check (normally done by cron job)
      const reminderRes = await request(app)
        .post('/api/contracts/check-reminders')
        .set('Authorization', `Bearer ${token}`);

      expect(reminderRes.status).toBe(200);

      // 3. Verify reminder email was sent
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'contract-reminder',
          data: expect.objectContaining({
            daysUntilExpiry: 30
          })
        })
      );

      // 4. Initiate renewal
      const renewRes = await request(app)
        .post(`/api/contracts/${contract._id}/renew`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          newEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          updatedTerms: {
            value: 55000 // 10% increase
          }
        });

      expect(renewRes.status).toBe(201);
      expect(renewRes.body.title).toContain('Renewal');
      expect(renewRes.body.value).toBe(55000);
      expect(renewRes.body.parentContract).toBe(contract._id);
    });
  });
});