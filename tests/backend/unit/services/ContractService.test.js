// tests/backend/unit/services/ContractService.test.js
const ContractService = require('../../../../backend/services/ContractService');
const Contract = require('../../../../backend/models/Contract');
const ActivityService = require('../../../../backend/services/ActivityService');
const EmailService = require('../../../../backend/services/EmailService');

jest.mock('../../../../backend/models/Contract');
jest.mock('../../../../backend/services/ActivityService');
jest.mock('../../../../backend/services/EmailService');

describe('ContractService', () => {
  let contractService;
  let mockActivityService;
  let mockEmailService;

  beforeEach(() => {
    mockActivityService = {
      logActivity: jest.fn()
    };
    mockEmailService = {
      sendContractNotification: jest.fn()
    };
    
    ActivityService.mockImplementation(() => mockActivityService);
    EmailService.mockImplementation(() => mockEmailService);
    
    contractService = new ContractService();
  });

  describe('createContract', () => {
    it('should create a new contract', async () => {
      const contractData = {
        title: 'Test Contract',
        clientName: 'Test Client',
        value: 10000,
        status: 'draft'
      };

      const mockContract = {
        _id: 'contractId',
        ...contractData,
        save: jest.fn().mockResolvedValue(true)
      };

      Contract.mockImplementation(() => mockContract);

      const result = await contractService.createContract(contractData, 'userId');

      expect(mockContract.save).toHaveBeenCalled();
      expect(mockActivityService.logActivity).toHaveBeenCalledWith({
        userId: 'userId',
        action: 'create',
        resourceType: 'contract',
        resourceId: 'contractId',
        details: { title: contractData.title }
      });
      expect(result).toEqual(mockContract);
    });

    it('should handle validation errors', async () => {
      const mockContract = {
        save: jest.fn().mockRejectedValue(new Error('Validation failed'))
      };

      Contract.mockImplementation(() => mockContract);

      await expect(contractService.createContract({}, 'userId'))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('updateContract', () => {
    it('should update existing contract', async () => {
      const mockContract = {
        _id: 'contractId',
        title: 'Old Title',
        value: 5000,
        save: jest.fn().mockResolvedValue(true)
      };

      Contract.findById.mockResolvedValue(mockContract);

      const updates = { title: 'New Title', value: 10000 };
      const result = await contractService.updateContract('contractId', updates, 'userId');

      expect(mockContract.title).toBe('New Title');
      expect(mockContract.value).toBe(10000);
      expect(mockContract.save).toHaveBeenCalled();
      expect(mockActivityService.logActivity).toHaveBeenCalledWith({
        userId: 'userId',
        action: 'update',
        resourceType: 'contract',
        resourceId: 'contractId',
        details: { updates }
      });
    });

    it('should throw error if contract not found', async () => {
      Contract.findById.mockResolvedValue(null);

      await expect(contractService.updateContract('invalidId', {}, 'userId'))
        .rejects.toThrow('Contract not found');
    });
  });

  describe('getContractsByUser', () => {
    it('should return paginated contracts', async () => {
      const mockContracts = [
        { _id: '1', title: 'Contract 1' },
        { _id: '2', title: 'Contract 2' }
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockContracts),
        countDocuments: jest.fn().mockResolvedValue(10)
      };

      Contract.find.mockReturnValue(mockQuery);

      const result = await contractService.getContractsByUser('userId', {
        page: 1,
        limit: 10,
        sortBy: 'createdAt'
      });

      expect(Contract.find).toHaveBeenCalledWith({ createdBy: 'userId' });
      expect(result).toEqual({
        contracts: mockContracts,
        pagination: {
          page: 1,
          limit: 10,
          total: 10,
          pages: 1
        }
      });
    });
  });
});