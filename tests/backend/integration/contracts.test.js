// tests/backend/integration/contracts.test.js
require('../setup');
const request = require('supertest');
const app = require('../../../backend/app');
const Contract = require('../../../backend/models/Contract');
const User = require('../../../backend/models/User');

describe('Contracts API Integration Tests', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    testUser = await createTestUser({
      email: 'contracttest@example.com',
      role: 'user'
    });
    authToken = generateAuthToken(testUser);
  });

  describe('GET /api/contracts', () => {
    beforeEach(async () => {
      // Create test contracts
      for (let i = 0; i < 15; i++) {
        await Contract.create({
          title: `Contract ${i}`,
          clientName: `Client ${i}`,
          value: 1000 * (i + 1),
          status: i % 2 === 0 ? 'active' : 'draft',
          createdBy: testUser._id
        });
      }
    });

    it('should return paginated contracts', async () => {
      const response = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.contracts).toHaveLength(10);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 15,
        pages: 2
      });
    });

    it('should filter contracts by status', async () => {
      const response = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'active' });

      expect(response.status).toBe(200);
      response.body.contracts.forEach(contract => {
        expect(contract.status).toBe('active');
      });
    });

    it('should search contracts by title', async () => {
      const response = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'Contract 1' });

      expect(response.status).toBe(200);
      expect(response.body.contracts.length).toBeGreaterThan(0);
      response.body.contracts.forEach(contract => {
        expect(contract.title).toContain('Contract 1');
      });
    });

    it('should sort contracts', async () => {
      const response = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sort: 'value:desc' });

      expect(response.status).toBe(200);
      const values = response.body.contracts.map(c => c.value);
      expect(values).toEqual([...values].sort((a, b) => b - a));
    });
  });

  describe('POST /api/contracts', () => {
    it('should create a new contract', async () => {
      const contractData = {
        title: 'New Test Contract',
        clientName: 'Test Client Inc.',
        clientEmail: 'client@testinc.com',
        value: 50000,
        status: 'draft',
        content: 'This is the contract content',
        tags: ['important', 'renewal']
      };

      const response = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contractData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: contractData.title,
        clientName: contractData.clientName,
        value: contractData.value,
        status: contractData.status,
        createdBy: testUser._id.toString()
      });
      expect(response.body.contractNumber).toMatch(/^CNT-\d{4}-\d{6}$/);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          value: 1000
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/contracts')
        .send({
          title: 'Unauthorized Contract',
          clientName: 'Client'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/contracts/:id', () => {
    let testContract;

    beforeEach(async () => {
      testContract = await Contract.create({
        title: 'Get Test Contract',
        clientName: 'Get Test Client',
        value: 25000,
        createdBy: testUser._id
      });
    });

    it('should return contract details', async () => {
      const response = await request(app)
        .get(`/api/contracts/${testContract._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(testContract._id.toString());
      expect(response.body.title).toBe(testContract.title);
    });

    it('should return 404 for non-existent contract', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/contracts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should not return other users contracts', async () => {
      const otherUser = await createTestUser({
        email: 'other@example.com'
      });
      
      const otherContract = await Contract.create({
        title: 'Other User Contract',
        clientName: 'Other Client',
        createdBy: otherUser._id
      });

      const response = await request(app)
        .get(`/api/contracts/${otherContract._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/contracts/:id', () => {
    let testContract;

    beforeEach(async () => {
      testContract = await Contract.create({
        title: 'Update Test Contract',
        clientName: 'Update Test Client',
        value: 30000,
        status: 'draft',
        createdBy: testUser._id
      });
    });

    it('should update contract', async () => {
      const updates = {
        title: 'Updated Contract Title',
        value: 35000,
        status: 'active'
      };

      const response = await request(app)
        .put(`/api/contracts/${testContract._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(updates.title);
      expect(response.body.value).toBe(updates.value);
      expect(response.body.status).toBe(updates.status);
    });

    it('should track contract history', async () => {
      await request(app)
        .put(`/api/contracts/${testContract._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'First Update' });

      await request(app)
        .put(`/api/contracts/${testContract._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Second Update' });

      const response = await request(app)
        .get(`/api/contracts/${testContract._id}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.history.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('DELETE /api/contracts/:id', () => {
    it('should soft delete contract', async () => {
      const contract = await Contract.create({
        title: 'Delete Test Contract',
        clientName: 'Delete Client',
        createdBy: testUser._id
      });

      const response = await request(app)
        .delete(`/api/contracts/${contract._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Verify soft delete
      const deletedContract = await Contract.findById(contract._id);
      expect(deletedContract.deletedAt).toBeDefined();
    });

    it('should require appropriate permissions', async () => {
      const otherUser = await createTestUser({
        email: 'nopermission@example.com',
        role: 'viewer'
      });
      const otherToken = generateAuthToken(otherUser);

      const contract = await Contract.create({
        title: 'Permission Test Contract',
        clientName: 'Client',
        createdBy: testUser._id
      });

      const response = await request(app)
        .delete(`/api/contracts/${contract._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Contract Sharing', () => {
    it('should share contract with users', async () => {
      const contract = await Contract.create({
        title: 'Share Test Contract',
        clientName: 'Share Client',
        createdBy: testUser._id
      });

      const shareUser = await createTestUser({
        email: 'share@example.com'
      });

      const response = await request(app)
        .post(`/api/contracts/${contract._id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: shareUser._id,
          permissions: ['read', 'comment']
        });

      expect(response.status).toBe(200);
      expect(response.body.sharedWith).toContainEqual(
        expect.objectContaining({
          user: shareUser._id.toString(),
          permissions: ['read', 'comment']
        })
      );
    });
  });
});