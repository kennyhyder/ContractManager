# Testing Guide

## Table of Contents
1. [Testing Overview](#testing-overview)
2. [Testing Setup](#testing-setup)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Test Data Management](#test-data-management)
9. [Continuous Integration](#continuous-integration)
10. [Best Practices](#best-practices)

## Testing Overview

Our testing strategy follows the testing pyramid approach:
     /\
    /  \    E2E Tests (10%)
   /----\   
  /      \  Integration Tests (30%)
 /--------\
/          \ Unit Tests (60%)
/____________\

### Testing Stack

- **Unit Tests**: Jest, React Testing Library
- **Integration Tests**: Supertest, Jest
- **E2E Tests**: Playwright, Cypress
- **Performance Tests**: k6, Artillery
- **Security Tests**: OWASP ZAP, npm audit

### Coverage Goals

- Overall: >80%
- Critical paths: >95%
- New code: 100%

## Testing Setup

### Install Dependencies

```bash
# Backend testing
cd backend
npm install --save-dev jest @types/jest supertest @faker-js/faker

# Frontend testing
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event

# E2E testing
npm install --save-dev playwright @playwright/test
Jest Configuration
javascript// jest.config.js
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/config/*.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000
};
Test Setup File
javascript// tests/setup.js
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  // Setup in-memory database
  mongoServer = await MongoMemoryServer.create();
  process.env.DATABASE_URL = mongoServer.getUri();
  
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
});

afterAll(async () => {
  // Cleanup
  await mongoServer.stop();
});

// Global test utilities
global.createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user'
  };
  
  return User.create({ ...defaultUser, ...overrides });
};

// Mock external services
jest.mock('../src/services/EmailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' })
}));
Unit Testing
Testing Services
javascript// tests/unit/services/ContractService.test.js
const ContractService = require('../../../src/services/ContractService');
const ContractRepository = require('../../../src/repositories/ContractRepository');
const EventEmitter = require('events');

jest.mock('../../../src/repositories/ContractRepository');

describe('ContractService', () => {
  let contractService;
  let mockRepository;
  let mockEventEmitter;
  
  beforeEach(() => {
    mockRepository = new ContractRepository();
    mockEventEmitter = new EventEmitter();
    
    contractService = new ContractService({
      contractRepository: mockRepository,
      eventEmitter: mockEventEmitter
    });
    
    jest.clearAllMocks();
  });
  
  describe('createContract', () => {
    it('should create a contract with default values', async () => {
      // Arrange
      const contractData = {
        title: 'Test Contract',
        type: 'service',
        createdBy: 'user-123'
      };
      
      const expectedContract = {
        id: 'contract-123',
        ...contractData,
        status: 'draft',
        version: 1,
        createdAt: expect.any(Date)
      };
      
      mockRepository.create.mockResolvedValue(expectedContract);
      
      // Act
      const result = await contractService.createContract(contractData);
      
      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...contractData,
        status: 'draft',
        version: 1
      });
      expect(result).toEqual(expectedContract);
    });
    
    it('should emit contract.created event', async () => {
      // Arrange
      const contractData = { title: 'Test', type: 'service', createdBy: 'user-123' };
      const createdContract = { id: 'contract-123', ...contractData };
      
      mockRepository.create.mockResolvedValue(createdContract);
      
      const eventSpy = jest.fn();
      mockEventEmitter.on('contract.created', eventSpy);
      
      // Act
      await contractService.createContract(contractData);
      
      // Assert
      expect(eventSpy).toHaveBeenCalledWith(createdContract);
    });
    
    it('should validate required fields', async () => {
      // Arrange
      const invalidData = { title: '' };
      
      // Act & Assert
      await expect(contractService.createContract(invalidData))
        .rejects.toThrow('Title is required');
      
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
  
  describe('approveContract', () => {
    it('should approve contract when user has permission', async () => {
      // Arrange
      const contractId = 'contract-123';
      const userId = 'user-123';
      const contract = {
        id: contractId,
        status: 'pending_approval',
        approvers: [userId]
      };
      
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue({
        ...contract,
        status: 'approved',
        approvedBy: userId,
        approvedAt: expect.any(Date)
      });
      
      // Act
      const result = await contractService.approveContract(contractId, userId);
      
      // Assert
      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe(userId);
      expect(mockRepository.update).toHaveBeenCalledWith(
        contractId,
        expect.objectContaining({
          status: 'approved',
          approvedBy: userId
        })
      );
    });
    
    it('should throw error when contract is not pending approval', async () => {
      // Arrange
      const contract = {
        id: 'contract-123',
        status: 'draft'
      };
      
      mockRepository.findById.mockResolvedValue(contract);
      
      // Act & Assert
      await expect(contractService.approveContract('contract-123', 'user-123'))
        .rejects.toThrow('Contract must be in pending_approval status');
    });
  });
});
Testing React Components
javascript// tests/unit/components/ContractForm.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ContractForm from '../../../src/components/contracts/ContractForm';
import contractReducer from '../../../src/store/contractSlice';

// Test utilities
const renderWithRedux = (component, { initialState = {}, store = null } = {}) => {
 const testStore = store || configureStore({
   reducer: { contracts: contractReducer },
   preloadedState: initialState
 });
 
 return {
   ...render(<Provider store={testStore}>{component}</Provider>),
   store: testStore
 };
};

describe('ContractForm', () => {
 let user;
 
 beforeEach(() => {
   user = userEvent.setup();
 });
 
 it('should render all form fields', () => {
   renderWithRedux(<ContractForm />);
   
   expect(screen.getByLabelText(/contract title/i)).toBeInTheDocument();
   expect(screen.getByLabelText(/contract type/i)).toBeInTheDocument();
   expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
   expect(screen.getByLabelText(/value/i)).toBeInTheDocument();
   expect(screen.getByRole('button', { name: /create contract/i })).toBeInTheDocument();
 });
 
 it('should validate required fields', async () => {
   const onSubmit = jest.fn();
   renderWithRedux(<ContractForm onSubmit={onSubmit} />);
   
   // Try to submit empty form
   await user.click(screen.getByRole('button', { name: /create contract/i }));
   
   // Check validation messages
   expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
   expect(await screen.findByText(/type is required/i)).toBeInTheDocument();
   expect(onSubmit).not.toHaveBeenCalled();
 });
 
 it('should submit valid form data', async () => {
   const onSubmit = jest.fn();
   renderWithRedux(<ContractForm onSubmit={onSubmit} />);
   
   // Fill form
   await user.type(screen.getByLabelText(/contract title/i), 'Test Contract');
   await user.selectOptions(screen.getByLabelText(/contract type/i), 'service');
   await user.type(screen.getByLabelText(/description/i), 'Test description');
   await user.type(screen.getByLabelText(/value/i), '5000');
   
   // Submit
   await user.click(screen.getByRole('button', { name: /create contract/i }));
   
   // Verify submission
   await waitFor(() => {
     expect(onSubmit).toHaveBeenCalledWith({
       title: 'Test Contract',
       type: 'service',
       description: 'Test description',
       value: 5000
     });
   });
 });
 
 it('should handle submission errors', async () => {
   const error = new Error('Network error');
   const mockCreateContract = jest.fn().mockRejectedValue(error);
   
   // Mock the action
   jest.mock('../../../src/store/contractSlice', () => ({
     ...jest.requireActual('../../../src/store/contractSlice'),
     createContract: mockCreateContract
   }));
   
   renderWithRedux(<ContractForm />);
   
   // Fill and submit
   await user.type(screen.getByLabelText(/contract title/i), 'Test Contract');
   await user.selectOptions(screen.getByLabelText(/contract type/i), 'service');
   await user.click(screen.getByRole('button', { name: /create contract/i }));
   
   // Check error message
   expect(await screen.findByText(/failed to create contract/i)).toBeInTheDocument();
 });
 
 it('should disable form during submission', async () => {
   renderWithRedux(<ContractForm />);
   
   // Fill required fields
   await user.type(screen.getByLabelText(/contract title/i), 'Test Contract');
   await user.selectOptions(screen.getByLabelText(/contract type/i), 'service');
   
   // Submit
   const submitButton = screen.getByRole('button', { name: /create contract/i });
   await user.click(submitButton);
   
   // Check button is disabled
   expect(submitButton).toBeDisabled();
   expect(submitButton).toHaveTextContent(/creating/i);
 });
});
Testing Custom Hooks
javascript// tests/unit/hooks/useContracts.test.js
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import useContracts from '../../../src/hooks/useContracts';
import contractReducer from '../../../src/store/contractSlice';
import * as contractService from '../../../src/services/contractService';

jest.mock('../../../src/services/contractService');

describe('useContracts', () => {
  let store;
  
  beforeEach(() => {
    store = configureStore({
      reducer: { contracts: contractReducer }
    });
    
    jest.clearAllMocks();
  });
  
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );
  
  it('should fetch contracts on mount', async () => {
    const mockContracts = [
      { id: '1', title: 'Contract 1' },
      { id: '2', title: 'Contract 2' }
    ];
    
    contractService.fetchContracts.mockResolvedValue({
      data: { contracts: mockContracts, total: 2 }
    });
    
    const { result } = renderHook(() => useContracts(), { wrapper });
    
    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.contracts).toEqual([]);
    
    // Wait for fetch to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Updated state
    expect(result.current.loading).toBe(false);
    expect(result.current.contracts).toEqual(mockContracts);
  });
  
  it('should handle errors', async () => {
    const error = new Error('Network error');
    contractService.fetchContracts.mockRejectedValue(error);
    
    const { result } = renderHook(() => useContracts(), { wrapper });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(error.message);
    expect(result.current.contracts).toEqual([]);
  });
  
  it('should provide create contract function', async () => {
    const newContract = { id: '3', title: 'New Contract' };
    contractService.createContract.mockResolvedValue({ data: newContract });
    
    const { result } = renderHook(() => useContracts(), { wrapper });
    
    await act(async () => {
      await result.current.createContract({ title: 'New Contract' });
    });
    
    expect(contractService.createContract).toHaveBeenCalledWith({ title: 'New Contract' });
  });
});
Integration Testing
API Integration Tests
javascript// tests/integration/api/contracts.test.js
const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/db');
const { generateToken } = require('../../../src/utils/auth');

describe('Contract API Integration', () => {
  let authToken;
  let testUser;
  
  beforeAll(async () => {
    // Run migrations
    await db.migrate.latest();
  });
  
  afterAll(async () => {
    // Cleanup
    await db.destroy();
  });
  
  beforeEach(async () => {
    // Clear data
    await db('contracts').delete();
    await db('users').delete();
    
    // Create test user
    testUser = await db('users').insert({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    }).returning('*').then(rows => rows[0]);
    
    // Generate auth token
    authToken = generateToken(testUser.id);
  });
  
  describe('GET /api/v1/contracts', () => {
    it('should return user contracts', async () => {
      // Create test contracts
      await db('contracts').insert([
        {
          title: 'Contract 1',
          type: 'service',
          status: 'active',
          created_by: testUser.id
        },
        {
          title: 'Contract 2',
          type: 'nda',
          status: 'draft',
          created_by: testUser.id
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          contracts: expect.arrayContaining([
            expect.objectContaining({ title: 'Contract 1' }),
            expect.objectContaining({ title: 'Contract 2' })
          ]),
          total: 2
        }
      });
    });
    
    it('should filter contracts by status', async () => {
      await db('contracts').insert([
        {
          title: 'Active Contract',
          type: 'service',
          status: 'active',
          created_by: testUser.id
        },
        {
          title: 'Draft Contract',
          type: 'service',
          status: 'draft',
          created_by: testUser.id
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/contracts?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.contracts).toHaveLength(1);
      expect(response.body.data.contracts[0].status).toBe('active');
    });
    
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/contracts')
        .expect(401);
    });
  });
  
  describe('POST /api/v1/contracts', () => {
    it('should create a new contract', async () => {
      const contractData = {
        title: 'New Service Agreement',
        type: 'service',
        description: 'Test description',
        value: 10000,
        currency: 'USD',
        parties: [
          {
            name: 'Client Corp',
            type: 'company',
            role: 'client'
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contractData)
        .expect(201);
      
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          title: contractData.title,
          type: contractData.type,
          status: 'draft',
          created_by: testUser.id
        })
      });
      
      // Verify in database
      const contract = await db('contracts')
        .where({ id: response.body.data.id })
        .first();
      
      expect(contract).toBeTruthy();
      expect(contract.title).toBe(contractData.title);
    });
    
    it('should validate input data', async () => {
      const invalidData = {
        title: '', // Empty title
        type: 'invalid_type'
      };
      
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
      
      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR'
        })
      });
    });
  });
  
  describe('PUT /api/v1/contracts/:id', () => {
    it('should update own contract', async () => {
      const [contract] = await db('contracts')
        .insert({
          title: 'Original Title',
          type: 'service',
          status: 'draft',
          created_by: testUser.id
        })
        .returning('*');
      
      const updates = {
        title: 'Updated Title',
        description: 'New description'
      };
      
      const response = await request(app)
        .put(`/api/v1/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.data.title).toBe(updates.title);
      expect(response.body.data.description).toBe(updates.description);
    });
    
    it('should not update others contracts', async () => {
      const [otherUser] = await db('users')
        .insert({
          email: 'other@example.com',
          password_hash: 'hash',
          first_name: 'Other',
          last_name: 'User'
        })
        .returning('*');
      
      const [contract] = await db('contracts')
        .insert({
          title: 'Other User Contract',
          type: 'service',
          status: 'draft',
          created_by: otherUser.id
        })
        .returning('*');
      
      await request(app)
        .put(`/api/v1/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Hacked!' })
        .expect(403);
    });
  });
});
Database Integration Tests
javascript// tests/integration/repositories/ContractRepository.test.js
const ContractRepository = require('../../../src/repositories/ContractRepository');
const db = require('../../../src/db');

describe('ContractRepository Integration', () => {
  let repository;
  let testUser;
  
  beforeAll(async () => {
    await db.migrate.latest();
    repository = new ContractRepository(db);
  });
  
  afterAll(async () => {
    await db.destroy();
  });
  
  beforeEach(async () => {
    await db('contracts').delete();
    await db('users').delete();
    
    [testUser] = await db('users')
      .insert({
        email: 'test@example.com',
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'User'
      })
      .returning('*');
  });
  
  describe('create', () => {
    it('should create contract with parties', async () => {
      const contractData = {
        title: 'Test Contract',
        type: 'service',
        created_by: testUser.id,
        parties: [
          {
            name: 'Client Corp',
            type: 'company',
            role: 'client'
          },
          {
            name: 'Vendor Inc',
            type: 'company',
            role: 'vendor'
          }
        ]
      };
      
      const contract = await repository.create(contractData);
      
      expect(contract).toMatchObject({
        id: expect.any(String),
        title: contractData.title,
        status: 'draft',
        version: 1
      });
      
      // Verify parties
      const parties = await db('contract_parties')
        .where({ contract_id: contract.id })
        .join('parties', 'contract_parties.party_id', 'parties.id')
        .select('parties.*', 'contract_parties.role');
      
      expect(parties).toHaveLength(2);
      expect(parties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Client Corp', role: 'client' }),
          expect.objectContaining({ name: 'Vendor Inc', role: 'vendor' })
        ])
      );
    });
    
    it('should create version entry', async () => {
      const contract = await repository.create({
        title: 'Test Contract',
        type: 'service',
        content: 'Contract content',
        created_by: testUser.id
      });
      
      const version = await db('contract_versions')
        .where({ contract_id: contract.id })
        .first();
      
      expect(version).toMatchObject({
        version_number: 1,
        content: 'Contract content',
        created_by: testUser.id
      });
    });
  });
  
  describe('findWithRelations', () => {
    it('should load contract with all relations', async () => {
      // Create contract with relations
      const [contract] = await db('contracts')
        .insert({
          title: 'Full Contract',
          type: 'service',
          created_by: testUser.id
        })
        .returning('*');
      
      // Add party
      const [party] = await db('parties')
        .insert({ name: 'Test Party', type: 'company' })
        .returning('*');
      
      await db('contract_parties').insert({
        contract_id: contract.id,
        party_id: party.id,
        role: 'client'
      });
      
      // Add comment
      await db('comments').insert({
        contract_id: contract.id,
        user_id: testUser.id,
        content: 'Test comment'
      });
      
      // Add attachment
      await db('attachments').insert({
        contract_id: contract.id,
        filename: 'test.pdf',
        storage_path: '/uploads/test.pdf',
        uploaded_by: testUser.id
      });
      
      const result = await repository.findWithRelations(contract.id);
      
      expect(result).toMatchObject({
        id: contract.id,
        parties: expect.arrayContaining([
          expect.objectContaining({ name: 'Test Party' })
        ]),
        comments: expect.arrayContaining([
          expect.objectContaining({ content: 'Test comment' })
        ]),
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: 'test.pdf' })
        ])
      });
    });
  });
});
End-to-End Testing
Playwright Tests
javascript// tests/e2e/contract-workflow.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Contract Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Test123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  });
  
  test('should create and submit contract for approval', async ({ page }) => {
    // Navigate to contracts
    await page.click('[data-testid="nav-contracts"]');
    await page.click('[data-testid="create-contract-button"]');
    
    // Fill contract form
    await page.fill('[data-testid="contract-title"]', 'E2E Test Contract');
    await page.selectOption('[data-testid="contract-type"]', 'service');
    await page.fill('[data-testid="contract-description"]', 'This is an E2E test contract');
    await page.fill('[data-testid="contract-value"]', '25000');
    
    // Add parties
    await page.click('[data-testid="add-party-button"]');
    await page.fill('[data-testid="party-name-0"]', 'Test Client Corp');
    await page.fill('[data-testid="party-email-0"]', 'client@testcorp.com');
    await page.selectOption('[data-testid="party-role-0"]', 'client');
    
    await page.click('[data-testid="add-party-button"]');
    await page.fill('[data-testid="party-name-1"]', 'Our Company');
    await page.fill('[data-testid="party-email-1"]', 'contracts@ourcompany.com');
    await page.selectOption('[data-testid="party-role-1"]', 'vendor');
    
    // Upload attachment
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-attachment"]')
    ]);
    await fileChooser.setFiles('./tests/fixtures/sample-contract.pdf');
    
    // Save contract
    await page.click('[data-testid="save-contract-button"]');
    
    // Wait for success message
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Contract created successfully');
    
    // Submit for approval
    await page.click('[data-testid="submit-for-approval-button"]');
    
    // Select approvers
    await page.click('[data-testid="approver-select"]');
    await page.click('[data-testid="approver-option-manager@ourcompany.com"]');
    await page.click('[data-testid="approver-option-legal@ourcompany.com"]');
    
    // Add approval message
    await page.fill('[data-testid="approval-message"]', 'Please review and approve this service contract.');
    
    // Submit
    await page.click('[data-testid="send-for-approval-button"]');
    
    // Verify status change
    await expect(page.locator('[data-testid="contract-status"]')).toContainText('Pending Approval');
    
    // Verify in contract list
    await page.click('[data-testid="nav-contracts"]');
    const contractRow = page.locator('[data-testid="contract-row"]', { hasText: 'E2E Test Contract' });
    await expect(contractRow.locator('[data-testid="status-badge"]')).toContainText('Pending Approval');
  });
  
  test('should handle real-time collaboration', async ({ page, context }) => {
    // Create contract
    await page.goto('http://localhost:3000/contracts/new');
    await page.fill('[data-testid="contract-title"]', 'Collaboration Test');
    await page.selectOption('[data-testid="contract-type"]', 'nda');
    await page.click('[data-testid="save-contract-button"]');
    
    // Get contract URL
    await page.waitForURL(/\/contracts\/[a-f0-9-]+$/);
    const contractUrl = page.url();
    
    // Open second browser tab
    const page2 = await context.newPage();
    await page2.goto(contractUrl);
    
    // User 1 starts editing
    await page.click('[data-testid="contract-content-editor"]');
    await page.type('[data-testid="contract-content-editor"]', 'This is user 1 typing...');
    
    // Verify user 2 sees the changes
    await expect(page2.locator('[data-testid="contract-content-editor"]')).toContainText('This is user 1 typing...');
    
    // User 2 adds a comment
    await page2.fill('[data-testid="comment-input"]', 'Great addition!');
    await page2.click('[data-testid="add-comment-button"]');
    
    // Verify user 1 sees the comment
    await expect(page.locator('[data-testid="comment-list"]')).toContainText('Great addition!');
    
    // Check presence indicators
    await expect(page.locator('[data-testid="active-users"]')).toContainText('2 users active');
  });
  
  test('should export contract to PDF', async ({ page }) => {
    // Navigate to existing contract
    await page.goto('http://localhost:3000/contracts');
    await page.click('[data-testid="contract-row"]:first-child');
    
    // Click export button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-pdf-button"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/contract-.*\.pdf/);
    
    // Save and verify file exists
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
Mobile E2E Tests
javascript// tests/e2e/mobile.spec.js
const { devices, test, expect } = require('@playwright/test');

test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Contract Management', () => {
  test('should navigate and create contract on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Test123!');
    await page.click('[data-testid="login-button"]');
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Navigate to contracts
    await page.click('[data-testid="mobile-nav-contracts"]');
    
    // Create contract
    await page.click('[data-testid="mobile-create-button"]');
    
    // Fill form (mobile optimized)
    await page.fill('[data-testid="contract-title"]', 'Mobile Contract');
    await page.selectOption('[data-testid="contract-type"]', 'service');
    
    // Test mobile-specific interactions
    await page.locator('[data-testid="value-input"]').tap();
    await page.keyboard.type('15000');
    
    // Save
    await page.click('[data-testid="save-contract-button"]');
    
    // Verify success on mobile
    await expect(page.locator('[data-testid="mobile-toast"]')).toBeVisible();
  });
  
  test('should handle touch gestures', async ({ page }) => {
    await page.goto('http://localhost:3000/contracts');
    
    // Swipe to reveal actions
    const contractCard = page.locator('[data-testid="contract-card"]:first-child');
    await contractCard.swipe({ direction: 'left', distance: 100 });
    
    // Verify quick actions appear
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();
    
    // Tap to edit
    await page.locator('[data-testid="quick-edit"]').tap();
    await expect(page).toHaveURL(/\/contracts\/.*\/edit/);
  });
});
Performance Testing
Load Testing with k6
javascript// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],             // Error rate under 10%
  },
};

const BASE_URL = 'http://localhost:8000';

export function setup() {
  // Login and get token
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: 'loadtest@example.com',
    password: 'LoadTest123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  return { token: loginRes.json('token') };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };
  
  // Scenario 1: List contracts
  const listRes = http.get(`${BASE_URL}/api/v1/contracts`, { headers });
  check(listRes, {
    'list contracts status is 200': (r) => r.status === 200,
    'list contracts response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(listRes.status !== 200);
  
  sleep(1);
  
  // Scenario 2: Create contract
  const createRes = http.post(
    `${BASE_URL}/api/v1/contracts`,
    JSON.stringify({
      title: `Load Test Contract ${Date.now()}`,
      type: 'service',
      description: 'Performance test contract',
      value: Math.floor(Math.random() * 100000)
    }),
    { headers }
  );
  
  check(createRes, {
    'create contract status is 201': (r) => r.status === 201,
    'create contract response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(createRes.status !== 201);
  
  if (createRes.status === 201) {
    const contractId = createRes.json('data.id');
    
    sleep(1);
    
    // Scenario 3: Get contract details
    const getRes = http.get(`${BASE_URL}/api/v1/contracts/${contractId}`, { headers });
    check(getRes, {
      'get contract status is 200': (r) => r.status === 200,
      'get contract response time < 300ms': (r) => r.timings.duration < 300,
    });
    errorRate.add(getRes.status !== 200);
  }
  
  sleep(2);
}

export function teardown(data) {
  // Cleanup if needed
}
Stress Testing
javascript// tests/performance/stress-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 200 },   // Ramp to 200 users quickly
    { duration: '3m', target: 500 },   // Push to 500 users
    { duration: '1m', target: 1000 },  // Spike to 1000 users
    { duration: '2m', target: 1000 },  // Maintain peak load
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.5'],     // Less than 50% failure rate
    http_req_duration: ['p(90)<2000'], // 90% under 2 seconds
  },
};

export default function () {
  const responses = http.batch([
    ['GET', 'http://localhost:8000/api/v1/health'],
    ['GET', 'http://localhost:8000/api/v1/contracts'],
    ['GET', 'http://localhost:8000/api/v1/templates'],
  ]);
  
  responses.forEach((res, idx) => {
    check(res, {
      [`request ${idx} succeeded`]: (r) => r.status === 200 || r.status === 401,
    });
  });
}
Security Testing
OWASP ZAP Configuration
yaml# tests/security/zap-config.yaml
env:
  contexts:
    - name: "Contract Management API"
      urls:
        - "http://localhost:8000"
      authentication:
        method: "json"
        parameters:
          loginUrl: "http://localhost:8000/api/v1/auth/login"
          loginRequestData: '{"email":"security@test.com","password":"Security123!"}'
      users:
        - name: "test-user"
          credentials:
            email: "security@test.com"
            password: "Security123!"

jobs:
  - type: spider
    parameters:
      maxDuration: 10
      
  - type: activeScan
    parameters:
      maxRuleDurationInMins: 5
      
  - type: report
    parameters:
      template: "traditional-html"
      reportDir: "./security-reports"
      reportFile: "zap-report.html"
Security Test Script
bash#!/bin/bash
# tests/security/run-security-tests.sh

echo "Running security tests..."

# 1. Dependency scanning
echo "Checking dependencies for vulnerabilities..."
npm audit --production
AUDIT_EXIT=$?

# 2. OWASP Dependency Check
echo "Running OWASP dependency check..."
dependency-check --project "Contract Management" \
  --scan ./package.json \
  --format HTML \
  --out ./security-reports

# 3. Static code analysis
echo "Running static security analysis..."
npm run lint:security

# 4. Dynamic scanning with OWASP ZAP
echo "Starting OWASP ZAP scan..."
docker run -v $(pwd):/zap/wrk/:rw \
  -t owasp/zap2docker-stable zap-baseline.py \
  -t http://host.docker.internal:8000 \
  -c zap-config.yaml \
  -r zap-report.html

# 5. Check for secrets
echo "Scanning for secrets..."
trufflehog --regex --entropy=True --json . > security-reports/secrets-scan.json

# Generate summary
if [ $AUDIT_EXIT -ne 0 ]; then
  echo "FAILED: Vulnerabilities found in dependencies"
  exit 1
fi

echo "Security tests completed. Check security-reports/ for details."
Test Data Management
Test Data Factory
javascript// tests/factories/index.js
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');

class TestDataFactory {
  static async createUser(overrides = {}) {
    const defaultUser = {
      email: faker.internet.email(),
      password_hash: await bcrypt.hash('Test123!', 10),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      role: 'user',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    return { ...defaultUser, ...overrides };
  }
  
  static createContract(overrides = {}) {
    const types = ['service', 'nda', 'employment', 'sales', 'lease'];
    const statuses = ['draft', 'pending_review', 'approved', 'active'];
    
    const defaultContract = {
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      type: faker.helpers.arrayElement(types),
      status: faker.helpers.arrayElement(statuses),
      value: faker.number.float({ min: 1000, max: 100000, precision: 0.01 }),
      currency: 'USD',
      start_date: faker.date.future(),
      end_date: faker.date.future({ years: 2 }),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    return { ...defaultContract, ...overrides };
  }
  
  static createParty(overrides = {}) {
    const types = ['individual', 'company'];
    const type = overrides.type || faker.helpers.arrayElement(types);
    
    const defaultParty = {
      name: type === 'company' ? faker.company.name() : faker.person.fullName(),
      type,
      email: faker.internet.email(),
      phone: faker.phone.number(),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.location.country(),
      postal_code: faker.location.zipCode()
    };
    
    return { ...defaultParty, ...overrides };
  }
  
  static async seedDatabase(db, counts = {}) {
    const { users = 10, contracts = 50, parties = 20 } = counts;
    
    // Create users
    const createdUsers = [];
    for (let i = 0; i < users; i++) {
      const userData = await this.createUser();
      const [user] = await db('users').insert(userData).returning('*');
      createdUsers.push(user);
    }
    
    // Create parties
    const createdParties = [];
    for (let i = 0; i < parties; i++) {
      const partyData = this.createParty();
      const [party] = await db('parties').insert(partyData).returning('*');
      createdParties.push(party);
    }
    
    // Create contracts
    const createdContracts = [];
    for (let i = 0; i < contracts; i++) {
      const user = faker.helpers.arrayElement(createdUsers);
      const contractData = this.createContract({
        created_by: user.id
      });
      
      const [contract] = await db('contracts').insert(contractData).returning('*');
      
      // Add random parties to contract
      const numParties = faker.number.int({ min: 1, max: 3 });
      for (let j = 0; j < numParties; j++) {
        const party = faker.helpers.arrayElement(createdParties);
        await db('contract_parties').insert({
          contract_id: contract.id,
          party_id: party.id,
          role: faker.helpers.arrayElement(['client', 'vendor', 'partner'])
        });
      }
      
      createdContracts.push(contract);
    }
    
    return {
      users: createdUsers,
      contracts: createdContracts,
      parties: createdParties
    };
  }
}

module.exports = TestDataFactory;
Database Seeder
javascript// tests/seeds/test-data.js
const TestDataFactory = require('../factories');

exports.seed = async function(knex) {
  // Clear existing data
  await knex('contract_parties').del();
  await knex('contracts').del();
  await knex('parties').del();
  await knex('users').del();
  
  // Create admin user
  const [adminUser] = await knex('users').insert({
    email: 'admin@test.com',
    password_hash: '$2b$10$YourHashedPasswordHere',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    is_active: true
  }).returning('*');
  
  // Create test users
  const [regularUser] = await knex('users').insert({
    email: 'user@test.com',
    password_hash: '$2b$10$YourHashedPasswordHere',
    first_name: 'Regular',
    last_name: 'User',
    role: 'user',
    is_active: true
  }).returning('*');
  
  // Seed random data
  if (process.env.SEED_RANDOM_DATA === 'true') {
    await TestDataFactory.seedDatabase(knex, {
      users: 50,
      contracts: 200,
      parties: 100
    });
  }
  
  console.log('Test data seeded successfully');
};
Continuous Integration
GitHub Actions CI
yaml# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: contract_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci --prefix backend
        npm ci --prefix frontend
    
    - name: Run linting
      run: |
        npm run lint --prefix backend
        npm run lint --prefix frontend
    
    - name: Run unit tests
      run: |
        npm run test:unit --prefix backend
        npm run test:unit --prefix frontend
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/contract_test
        REDIS_URL: redis://localhost:6379
        JWT_SECRET: test-secret
    
    - name: Run integration tests
      run: npm run test:integration --prefix backend
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/contract_test
        REDIS_URL: redis://localhost:6379
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Run E2E tests
      run: |
        npm run build --prefix frontend
        npm run start --prefix backend &
        npm run serve --prefix frontend &
        sleep 10
        npm run test:e2e
      env:
        CI: true
    
    - name: Run security tests
      run: |
        npm audit --audit-level=high --prefix backend
        npm audit --audit-level=high --prefix frontend
    
    - name: Archive test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: |
          backend/coverage
          frontend/coverage
          test-results/
          playwright-report/
Test Scripts
json// package.json scripts
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest --testPathPattern=unit --coverage",
    "test:integration": "jest --testPathPattern=integration --runInBand",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --coverageReporters=text-lcov | coveralls",
    "test:performance": "k6 run tests/performance/load-test.js",
    "test:security": "./tests/security/run-security-tests.sh",
    "test:all": "npm run test && npm run test:e2e && npm run test:performance"
  }
}
Best Practices
1. Test Structure
javascript// Follow AAA pattern
describe('Feature', () => {
  it('should behavior description', () => {
    // Arrange - Setup test data
    const input = { /* ... */ };
    
    // Act - Execute the function
    const result = functionUnderTest(input);
    
    // Assert - Verify the result
    expect(result).toEqual(expected);
  });
});
2. Test Naming
javascript// Use descriptive test names
// ✅ Good
it('should return 404 when contract does not exist', () => {});
it('should validate email format before creating user', () => {});
it('should emit contract.updated event after successful update', () => {});

// ❌ Bad
it('test contract', () => {});
it('works', () => {});
it('error case', () => {});
3. Test Isolation
javascript// Each test should be independent
beforeEach(() => {
  // Fresh setup for each test
  jest.clearAllMocks();
  // Reset database state
  // Clear caches
});

afterEach(() => {
  // Cleanup
});
4. Mock External Dependencies
javascript// Mock external services
jest.mock('../services/EmailService');
jest.mock('../services/PaymentService');

// But don't mock what you're testing
// If testing ContractService, mock its dependencies but not the service itself
5. Test Data Builders
javascript// Use builders for complex test data
class ContractBuilder {
  constructor() {
    this.contract = {
      title: 'Default Title',
      type: 'service',
      status: 'draft'
    };
  }
  
  withTitle(title) {
    this.contract.title = title;
    return this;
  }
  
  withStatus(status) {
    this.contract.status = status;
    return this;
  }
  
  withParties(parties) {
    this.contract.parties = parties;
    return this;
  }
  
  build() {
    return this.contract;
  }
}

// Usage
const contract = new ContractBuilder()
  .withTitle('Test Contract')
  .withStatus('active')
  .withParties([{ name: 'Client Corp', role: 'client' }])
  .build();
6. Async Testing
javascript// Always handle async properly
// ✅ Good
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// ✅ Good - with promises
it('should handle promises', () => {
  return expectAsync(promiseFunction()).resolves.toBe(expected);
});

// ❌ Bad - missing async/await
it('should handle async operations', () => {
  const result = asyncFunction(); // This won't wait!
  expect(result).toBe(expected);
});
7. Performance Considerations
javascript// Don't test implementation details
// ✅ Good - Test behavior
it('should calculate total contract value', () => {
  const contracts = [{ value: 100 }, { value: 200 }];
  expect(calculateTotal(contracts)).toBe(300);
});

// ❌ Bad - Testing implementation
it('should use reduce to calculate total', () => {
  // Don't test HOW it's done, test WHAT it does
});
Conclusion
A comprehensive testing strategy is essential for maintaining code quality and preventing regressions. By following these guidelines and best practices, you can build a robust test suite that gives confidence in your application's behavior and performance.
Remember:

Write tests first (TDD)
Test behavior, not implementation
Keep tests simple and focused
Maintain high coverage on critical paths
Run tests frequently
Fix broken tests immediately


## **docs/guides/troubleshooting.md**

```markdown
# Troubleshooting Guide

## Table of Contents
1. [Common Issues](#common-issues)
2. [Installation Problems](#installation-problems)
3. [Runtime Errors](#runtime-errors)
4. [Database Issues](#database-issues)
5. [Authentication Problems](#authentication-problems)
6. [Performance Issues](#performance-issues)
7. [Docker Issues](#docker-issues)
8. [Debugging Tips](#debugging-tips)
9. [FAQ](#faq)
10. [Getting Help](#getting-help)

## Common Issues

### Application Won't Start

**Symptoms:**
- Server crashes on startup
- Port already in use error
- Module not found errors

**Solutions:**

1. **Check port availability:**
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill the process using the port
kill -9 <PID>

# Or use a different port
PORT=8001 npm run dev

Verify dependencies:

bash# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for missing dependencies
npm ls

Check environment variables:

bash# Verify .env file exists
ls -la .env

# Check required variables
node -e "console.log(require('./config/env'))"
Build Failures
Symptoms:

TypeScript compilation errors
Webpack build errors
Missing modules during build

Solutions:

Clear build cache:

bash# Clear all build artifacts
rm -rf dist build .cache

# Rebuild
npm run build

Check Node version:

bash# Verify Node version
node --version

# Should be 18.0.0 or higher
# Use nvm to switch versions
nvm use 18

Fix TypeScript errors:

bash# Check TypeScript errors
npx tsc --noEmit

# Generate missing types
npx tsc --declaration
Installation Problems
npm install Fails
Common errors and solutions:

Permission errors (EACCES):

bash# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Or use npm with proper permissions
npm install --unsafe-perm

Network timeout errors:

bash# Use different registry
npm config set registry https://registry.npmjs.org/

# Increase timeout
npm config set fetch-retry-maxtimeout 120000

# Clear npm cache
npm cache clean --force

Node-gyp errors:

bash# Install build tools
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential

# Windows
npm install --global windows-build-tools
PostgreSQL Connection Issues
Error: ECONNREFUSED 127.0.0.1:5432
Solutions:

Verify PostgreSQL is running:

bash# Check status
systemctl status postgresql
# or
brew services list | grep postgresql

# Start PostgreSQL
systemctl start postgresql
# or
brew services start postgresql

Check connection settings:

bash# Test connection
psql -U postgres -h localhost -p 5432

# Verify pg_hba.conf allows connections
sudo nano /etc/postgresql/15/main/pg_hba.conf

Create database:

bash# Create database
createdb contract_management

# Or using psql
psql -U postgres -c "CREATE DATABASE contract_management;"
Redis Connection Issues
Error: Redis connection to localhost:6379 failed
Solutions:

Start Redis:

bash# Check if Redis is running
redis-cli ping

# Start Redis
redis-server
# or
brew services start redis

Check Redis configuration:

bash# Test connection
redis-cli -h localhost -p 6379

# Check Redis config
redis-cli CONFIG GET bind
redis-cli CONFIG GET protected-mode
Runtime Errors
JWT Token Errors
Error: JsonWebTokenError: invalid signature
Solutions:

Verify JWT secret:

javascript// Check if JWT_SECRET is set
console.log(process.env.JWT_SECRET);

// Ensure it's the same across services
// Must be at least 32 characters

Clear browser storage:

javascript// In browser console
localStorage.clear();
sessionStorage.clear();

Regenerate tokens:

bash# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CORS Errors
Error: Access to XMLHttpRequest blocked by CORS policy
Solutions:

Update CORS configuration:

javascript// backend/config/cors.js
module.exports = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ],
  credentials: true
};

Check request headers:

javascript// Ensure credentials are included
fetch(url, {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
});
File Upload Errors
Error: PayloadTooLargeError: request entity too large
Solutions:

Increase body parser limit:

javascript// backend/app.js
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

Configure multer limits:

javascript// backend/middleware/upload.js
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});
Database Issues
Migration Errors
Error: Migration failed: relation already exists
Solutions:

Check migration status:

bash# View completed migrations
npm run migrate:status

# Rollback last migration
npm run migrate:rollback

# Reset all migrations (CAUTION: Deletes data)
npm run migrate:reset

Fix duplicate migrations:

sql-- Check migrations table
SELECT * FROM knex_migrations;

-- Remove duplicate entry
DELETE FROM knex_migrations WHERE name = 'duplicate_migration.js';
Query Performance Issues
Symptoms:

Slow page loads
Database timeouts
High CPU usage

Solutions:

Add missing indexes:

sql-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Add index
CREATE INDEX idx_contracts_user_status 
ON contracts(created_by, status) 
WHERE deleted_at IS NULL;

Optimize queries:

javascript// ❌ Bad - N+1 query
const contracts = await Contract.findAll();
for (const contract of contracts) {
  contract.parties = await contract.getParties();
}

// ✅ Good - Eager loading
const contracts = await Contract.findAll({
  include: ['parties']
});

Use query explain:

sqlEXPLAIN ANALYZE
SELECT * FROM contracts
WHERE created_by = 'user-id'
AND status = 'active';
Authentication Problems
Login Failures
Symptoms:

"Invalid credentials" even with correct password
Session expires immediately
2FA not working

Solutions:

Reset password:

javascript// Generate password reset
const resetToken = crypto.randomBytes(32).toString('hex');
await user.update({
  passwordResetToken: resetToken,
  passwordResetExpires: Date.now() + 3600000 // 1 hour
});

Check session configuration:

javascript// Verify session settings
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

Debug 2FA:

javascript// Verify 2FA secret
const secret = user.twoFactorSecret;
const token = req.body.token;

// Check time sync
const verified = speakeasy.totp.verify({
  secret,
  encoding: 'base32',
  token,
  window: 2 // Allow 2 time windows
});
OAuth Issues
Error: OAuth callback error
Solutions:

Verify callback URLs:

javascript// Check OAuth configuration
console.log({
  clientID: process.env.GOOGLE_CLIENT_ID,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
});

Update OAuth app settings:


Google Console: Add correct redirect URIs
Include both dev and production URLs
Format: http://localhost:8000/api/v1/auth/google/callback

Performance Issues
Slow API Responses
Diagnosis:
javascript// Add request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  next();
});
Solutions:

Enable query caching:

javascript// Redis caching middleware
const cacheMiddleware = async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  res.sendResponse = res.json;
  res.json = (body) => {
    redis.setex(key, 300, JSON.stringify(body));
    res.sendResponse(body);
  };
  next();
};

Optimize database queries:

javascript// Use query optimization
const contracts = await db('contracts')
  .select('contracts.*')
  .leftJoin('users', 'contracts.created_by', 'users.id')
  .where('contracts.status', 'active')
  .limit(20)
  .offset(offset)
  .orderBy('contracts.created_at', 'desc');

Enable compression:

javascriptconst compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
Memory Leaks
Symptoms:

Increasing memory usage
Application crashes
Slow performance over time

Diagnosis:
javascript// Monitor memory usage
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
  });
}, 30000);
Solutions:

Fix event listener leaks:

javascript// ❌ Bad - Memory leak
events.on('contract.updated', handler);

// ✅ Good - Clean up listeners
const handler = (data) => { /* ... */ };
events.on('contract.updated', handler);

// Clean up
events.removeListener('contract.updated', handler);

Close database connections:

javascript// Ensure connections are closed
process.on('SIGTERM', async () => {
  await db.destroy();
  await redis.quit();
  process.exit(0);
});
Docker Issues
Container Won't Start
Error: docker-compose up fails
Solutions:

Check Docker daemon:

bash# Verify Docker is running
docker version

# Start Docker daemon
sudo systemctl start docker
# or
open -a Docker # macOS

Clean up resources:

bash# Remove all containers
docker-compose down

# Clean up volumes
docker volume prune

# Remove dangling images
docker image prune

# Full cleanup (CAUTION)
docker system prune -a

Fix port conflicts:

yaml# docker-compose.yml
services:
  backend:
    ports:
      - "8001:8000" # Change host port if needed
Database Container Issues
Error: Container fails to initialize database
Solutions:

Reset database volume:

bash# Stop containers
docker-compose down

# Remove database volume
docker volume rm contractmanagement_postgres_data

# Restart
docker-compose up -d

Check initialization scripts:

dockerfile# Ensure init scripts are copied
COPY ./scripts/init-db.sql /docker-entrypoint-initdb.d/
Debugging Tips
Enable Debug Logging
javascript// Set debug environment variable
DEBUG=app:* npm run dev

// Or in code
const debug = require('debug')('app:contracts');
debug('Processing contract:', contractId);
Use Chrome DevTools

Start with inspect:

bashnode --inspect server.js

Open Chrome:


Navigate to chrome://inspect
Click "inspect" under your process

Database Query Logging
javascript// Enable query logging
const knex = require('knex')({
  client: 'postgresql',
  debug: true, // Enable debug mode
  // ... other config
});

// Or log specific queries
knex.on('query', (query) => {
  console.log('SQL:', query.sql);
  console.log('Bindings:', query.bindings);
});
API Request Logging
javascript// Use morgan for request logging
const morgan = require('morgan');

// Detailed logging in development
app.use(morgan('dev'));

// Custom format
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
FAQ
Q: How do I reset my local development environment?
A: Run the reset script:
bash# Create reset script
cat > scripts/reset-dev.sh << 'EOF'
#!/bin/bash
echo "Resetting development environment..."

# Stop services
docker-compose down

# Clear data
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf dist build

# Clear Docker
docker system prune -f

# Reinstall
npm install
cd frontend && npm install && cd ..

# Reset database
npm run db:reset
npm run db:seed

echo "Reset complete!"
EOF

chmod +x scripts/reset-dev.sh
./scripts/reset-dev.sh
Q: How do I enable hot reloading?
A: Hot reloading should work by default:

Backend hot reload:

json// package.json
"scripts": {
  "dev": "nodemon server.js"
}

Frontend hot reload:

javascript// vite.config.js
export default {
  server: {
    hmr: true,
    watch: {
      usePolling: true // For Docker
    }
  }
}
Q: How do I run a specific test file?
A:
bash# Run specific test file
npm test -- contracts.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create contract"

# Run tests in watch mode
npm test -- --watch contracts.test.js
Q: How do I profile the application?
A: Use built-in Node.js profiler:
bash# Generate CPU profile
node --prof server.js

# Process the profile
node --prof-process isolate-*.log > profile.txt

# Or use clinic.js
npx clinic doctor -- node server.js
Getting Help
Before Asking for Help

Check the logs:

bash# Application logs
tail -f logs/app.log

# Docker logs
docker-compose logs -f backend

# System logs
journalctl -u postgresql

Search existing issues:


GitHub Issues: https://github.com/your-org/contract-management/issues
Stack Overflow: Search with tags [node.js], [postgresql], [react]


Gather information:

bash# System info
node --version
npm --version
postgres --version

# Error details
npm run diagnose
Creating a Good Bug Report
Include the following information:
markdown## Bug Report

**Environment:**
- OS: macOS 12.6
- Node: 18.12.0
- PostgreSQL: 15.1
- Browser: Chrome 109

**Steps to Reproduce:**
1. Login as admin user
2. Navigate to contracts page
3. Click "Create Contract"
4. Fill in form and submit

**Expected Behavior:**
Contract should be created and appear in the list

**Actual Behavior:**
Error message: "Failed to create contract"

**Error Logs:**
TypeError: Cannot read property 'id' of undefined
at ContractService.create (services/ContractService.js:45:23)
at async ContractController.create (controllers/ContractController.js:23:18)

**Additional Context:**
This started happening after upgrading to version 2.0.0
Debug Information Script
Create a diagnostic script:
javascript// scripts/diagnose.js
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

console.log('=== System Diagnostics ===\n');

// System info
console.log('System Information:');
console.log(`- OS: ${os.type()} ${os.release()}`);
console.log(`- Node: ${process.version}`);
console.log(`- NPM: ${execSync('npm --version').toString().trim()}`);
console.log(`- Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
console.log(`- CPUs: ${os.cpus().length}`);

// Check services
console.log('\nService Status:');
try {
  execSync('pg_isready', { stdio: 'ignore' });
  console.log('- PostgreSQL: ✓ Running');
} catch {
  console.log('- PostgreSQL: ✗ Not running');
}

try {
  execSync('redis-cli ping', { stdio: 'ignore' });
  console.log('- Redis: ✓ Running');
} catch {
  console.log('- Redis: ✗ Not running');
}

// Check environment
console.log('\nEnvironment Variables:');
const requiredEnvVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET'
];

requiredEnvVars.forEach(varName => {
  const exists = process.env[varName] ? '✓' : '✗';
  console.log(`- ${varName}: ${exists}`);
});

// Check file permissions
console.log('\nFile Permissions:');
const checkPaths = [
  '.env',
  'logs',
  'uploads',
  'node_modules'
];

checkPaths.forEach(path => {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
    console.log(`- ${path}: ✓ Read/Write`);
  } catch {
    console.log(`- ${path}: ✗ Permission denied or missing`);
  }
});

// Check disk space
console.log('\nDisk Space:');
const diskSpace = execSync('df -h .').toString();
console.log(diskSpace);

// Recent errors
console.log('\nRecent Application Errors:');
try {
  const errorLog = fs.readFileSync('logs/error.log', 'utf8');
  const lines = errorLog.split('\n').slice(-10);
  lines.forEach(line => console.log(line));
} catch {
  console.log('No error log found');
}
Common Error Codes
Error CodeMeaningSolutionECONNREFUSEDConnection refusedService not runningEADDRINUSEPort already in useKill process or change portEACCESPermission deniedFix file permissionsENOENTFile not foundCheck file pathETIMEDOUTConnection timeoutCheck network/firewallENOMEMOut of memoryIncrease memory limitE11000Duplicate key errorCheck unique constraints
Useful Commands Reference
bash# Database
psql -U postgres -d contract_management  # Connect to database
\dt                                       # List tables
\d+ contracts                            # Describe table
SELECT * FROM contracts LIMIT 10;        # Query data

# Redis
redis-cli                                # Connect to Redis
KEYS *                                   # List all keys
GET "key"                               # Get value
FLUSHALL                                # Clear all data (CAUTION)

# Process Management
ps aux | grep node                      # Find Node processes
lsof -i :8000                          # Find process on port
kill -9 <PID>                          # Force kill process
pm2 list                               # List PM2 processes
pm2 logs                               # View PM2 logs

# Docker
docker ps                              # List containers
docker logs <container>                # View logs
docker exec -it <container> bash       # Enter container
docker-compose restart backend         # Restart service

# Network
netstat -tulpn | grep LISTEN          # List listening ports
curl -I http://localhost:8000/health  # Test endpoint
nslookup api.example.com              # DNS lookup
traceroute api.example.com            # Trace network path

# File System
find . -name "*.log"                  # Find log files
tail -f logs/app.log                  # Follow log file
du -sh *                              # Check directory sizes
df -h                                 # Check disk space

# NPM
npm ls                                # List dependencies
npm outdated                          # Check outdated packages
npm run                               # List available scripts
npm cache clean --force               # Clear npm cache
Emergency Procedures
Application Crash
bash# 1. Check logs
tail -n 100 logs/error.log

# 2. Restart services
pm2 restart all
# or
docker-compose restart

# 3. Check system resources
free -m
df -h
top

# 4. Roll back if needed
git checkout stable
npm install
npm run build
pm2 restart all
Database Corruption
bash# 1. Stop application
pm2 stop all

# 2. Backup current state
pg_dump contract_management > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Check database
psql -U postgres -d contract_management -c "SELECT pg_is_in_recovery();"

# 4. Restore from backup if needed
psql -U postgres -d contract_management < last_known_good_backup.sql

# 5. Restart application
pm2 start all
Security Breach
bash# 1. Isolate the system
# Disable external access

# 2. Preserve evidence
tar -czf evidence_$(date +%Y%m%d_%H%M%S).tar.gz logs/ uploads/

# 3. Revoke all tokens
node -e "require('./scripts/revoke-all-tokens')"

# 4. Reset all passwords
node -e "require('./scripts/force-password-reset')"

# 5. Audit logs
grep -r "suspicious_pattern" logs/

# 6. Notify security team
Support Channels

Documentation: https://docs.contractmanagement.com
GitHub Issues: https://github.com/your-org/contract-management/issues
Discord Community: https://discord.gg/contractmgmt
Email Support: support@contractmanagement.com
Stack Overflow: Tag with contract-management-system

Response Times

Critical Issues (Production down): < 1 hour
High Priority (Major feature broken): < 4 hours
Medium Priority (Minor bugs): < 1 business day
Low Priority (Feature requests): < 1 week

Remember to always check the documentation and search existing issues before creating new support requests!