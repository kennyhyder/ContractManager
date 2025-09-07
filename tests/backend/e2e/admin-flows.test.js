// tests/backend/e2e/admin-flows.test.js
require('../setup');
const request = require('supertest');
const app = require('../../../backend/app');
const User = require('../../../backend/models/User');
const Contract = require('../../../backend/models/Contract');

describe('Admin Flow E2E Tests', () => {
  let adminUser;
  let adminToken;

  beforeEach(async () => {
    adminUser = await User.create({
      email: 'admin@example.com',
      password: 'AdminPass123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      emailVerified: true
    });
    adminToken = generateAuthToken(adminUser);
  });

  describe('User Management', () => {
    it('should manage users as admin', async () => {
      // 1. Create multiple users
      const users = [];
      for (let i = 0; i < 5; i++) {
        const user = await User.create({
          email: `user${i}@example.com`,
          password: 'UserPass123!',
          firstName: `User${i}`,
          lastName: 'Test',
          role: i === 0 ? 'manager' : 'user',
          emailVerified: true
        });
        users.push(user);
      }

      // 2. List all users with pagination
      const listRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 });

      expect(listRes.status).toBe(200);
      expect(listRes.body.users.length).toBeGreaterThanOrEqual(5);

      // 3. Update user role
      const updateRes = await request(app)
        .put(`/api/users/${users[1]._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'manager' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.role).toBe('manager');

      // 4. Deactivate user
      const deactivateRes = await request(app)
        .put(`/api/users/${users[2]._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.isActive).toBe(false);

      // 5. Bulk operations
      const bulkRes = await request(app)
        .post('/api/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userIds: [users[3]._id, users[4]._id],
          action: 'activate',
          data: { isActive: true }
        });

      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.updated).toBe(2);

      // 6. Export users
      const exportRes = await request(app)
        .get('/api/users/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' });

      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toContain('csv');
    });
  });

  describe('System Configuration', () => {
    it('should manage system settings', async () => {
      // 1. Get current settings
      const getRes = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);

      // 2. Update settings
      const updateRes = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          emailNotifications: true,
          defaultContractDuration: 365,
          requireApprovalAbove: 100000,
          allowedFileTypes: ['pdf', 'docx', 'doc'],
          maxFileSize: 10485760 // 10MB
        });

      expect(updateRes.status).toBe(200);

      // 3. Configure email templates
      const templateRes = await request(app)
        .put('/api/settings/email-templates/welcome')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Welcome to {{companyName}}!',
          content: 'Custom welcome message'
        });

      expect(templateRes.status).toBe(200);

      // 4. Set up integrations
      const integrationRes = await request(app)
        .post('/api/settings/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          service: 'salesforce',
          config: {
            clientId: 'test-client-id',
            clientSecret: 'test-secret',
            redirectUri: 'http://localhost:3000/callback'
          }
        });

      expect(integrationRes.status).toBe(201);
    });
  });

  describe('Audit and Compliance', () => {
    it('should track and export audit logs', async () => {
      // Create test data and activities
      const testUser = await createTestUser({ email: 'audit-test@example.com' });
      const testToken = generateAuthToken(testUser);

      // 1. User creates contract
      const contractRes = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: 'Audit Test Contract',
          clientName: 'Audit Client',
          value: 75000
        });

      const contractId = contractRes.body._id;

      // 2. User updates contract
      await request(app)
        .put(`/api/contracts/${contractId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ value: 80000 });

      // 3. Admin views audit log
      const auditRes = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date(),
          userId: testUser._id
        });

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'create',
            resourceType: 'contract',
            userId: testUser._id.toString()
          }),
          expect.objectContaining({
            action: 'update',
            resourceType: 'contract',
            userId: testUser._id.toString()
          })
        ])
      );

      // 4. Export audit logs
      const exportRes = await request(app)
        .get('/api/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'pdf',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        });

      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toContain('pdf');

      // 5. Generate compliance report
      const complianceRes = await request(app)
        .get('/api/reports/compliance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ period: 'monthly' });

      expect(complianceRes.status).toBe(200);
      expect(complianceRes.body).toHaveProperty('totalActivities');
      expect(complianceRes.body).toHaveProperty('userActivities');
      expect(complianceRes.body).toHaveProperty('securityEvents');
    });
  });

  describe('Backup and Restore', () => {
    it('should create and restore backups', async () => {
      // 1. Create backup
      const backupRes = await request(app)
        .post('/api/admin/backup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          includeDocuments: true,
          compress: true
        });

      expect(backupRes.status).toBe(201);
      expect(backupRes.body).toHaveProperty('backupId');
      expect(backupRes.body).toHaveProperty('size');
      expect(backupRes.body).toHaveProperty('location');

      const backupId = backupRes.body.backupId;

      // 2. List backups
      const listRes = await request(app)
        .get('/api/admin/backups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.backups).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backupId })
        ])
      );

      // 3. Verify backup integrity
      const verifyRes = await request(app)
        .post(`/api/admin/backups/${backupId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);

      // Note: Actual restore would be dangerous in tests
      // This is just to show the endpoint exists
      const restoreRes = await request(app)
        .post(`/api/admin/backups/${backupId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dryRun: true }); // Dry run only

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.dryRun).toBe(true);
    });
  });
});