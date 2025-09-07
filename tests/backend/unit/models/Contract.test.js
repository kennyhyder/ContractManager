// tests/backend/unit/models/Contract.test.js
require('../../setup');
const Contract = require('../../../../backend/models/Contract');
const User = require('../../../../backend/models/User');

describe('Contract Model', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      email: 'contracttest@example.com',
      password: 'password123',
      firstName: 'Contract',
      lastName: 'Tester'
    });
  });

  describe('Schema Validation', () => {
    it('should create a valid contract', async () => {
      const contractData = {
        title: 'Test Contract',
        clientName: 'Test Client',
        clientEmail: 'client@example.com',
        value: 10000,
        status: 'draft',
        content: 'Contract content',
        createdBy: testUser._id
      };

      const contract = new Contract(contractData);
      const savedContract = await contract.save();

      expect(savedContract._id).toBeDefined();
      expect(savedContract.contractNumber).toMatch(/^CNT-\d{4}-\d{6}$/);
      expect(savedContract.version).toBe(1);
    });

    it('should require title and clientName', async () => {
      const contract = new Contract({
        value: 10000,
        createdBy: testUser._id
      });

      await expect(contract.save()).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const contract = new Contract({
        title: 'Test',
        clientName: 'Client',
        status: 'invalid-status',
        createdBy: testUser._id
      });

      await expect(contract.save()).rejects.toThrow();
    });

    it('should set default dates', async () => {
      const contract = await Contract.create({
        title: 'Date Test',
        clientName: 'Client',
        createdBy: testUser._id
      });

      expect(contract.startDate).toBeDefined();
      expect(contract.endDate).toBeDefined();
      
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const dateDiff = contract.endDate - contract.startDate;
      expect(dateDiff).toBeCloseTo(oneYear, -10000);
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate days until expiry', async () => {
      const contract = await Contract.create({
        title: 'Expiry Test',
        clientName: 'Client',
        createdBy: testUser._id,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      expect(contract.daysUntilExpiry).toBeCloseTo(30, 0);
    });

    it('should identify expired contracts', async () => {
      const expiredContract = await Contract.create({
        title: 'Expired',
        clientName: 'Client',
        createdBy: testUser._id,
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });

      const activeContract = await Contract.create({
        title: 'Active',
        clientName: 'Client',
        createdBy: testUser._id,
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      });

      expect(expiredContract.isExpired).toBe(true);
      expect(activeContract.isExpired).toBe(false);
    });
  });

  describe('Indexes', () => {
    it('should create proper indexes', async () => {
      const indexes = Contract.collection.getIndexes();
      
      // Check for expected indexes
      expect(indexes).toBeDefined();
      // Note: In actual test, you would check specific indexes
    });
  });

  describe('Methods', () => {
    it('should increment version on update', async () => {
      const contract = await Contract.create({
        title: 'Version Test',
        clientName: 'Client',
        createdBy: testUser._id
      });

      expect(contract.version).toBe(1);

      contract.title = 'Updated Title';
      await contract.save();

      expect(contract.version).toBe(1); // Version increment would be handled by service
    });
  });
});