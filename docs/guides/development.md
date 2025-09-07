# Development Guide

## Table of Contents
1. [Development Philosophy](#development-philosophy)
2. [Code Structure](#code-structure)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [API Development](#api-development)
6. [Frontend Development](#frontend-development)
7. [Database Development](#database-development)
8. [Testing Strategy](#testing-strategy)
9. [Performance Guidelines](#performance-guidelines)
10. [Security Guidelines](#security-guidelines)

## Development Philosophy

### Core Principles

1. **Clean Code**: Write code that is easy to read, understand, and maintain
2. **DRY (Don't Repeat Yourself)**: Avoid duplication, extract common functionality
3. **SOLID Principles**: Follow object-oriented design principles
4. **Test-Driven Development**: Write tests first, then implementation
5. **Continuous Refactoring**: Improve code quality incrementally

### Architecture Patterns

- **Backend**: Service-oriented architecture with clear separation of concerns
- **Frontend**: Component-based architecture with hooks and context
- **Database**: Repository pattern with migrations and seeders
- **API**: RESTful design with consistent naming and responses

## Code Structure

### Backend Structure
backend/
├── server.js          # Application entry point
├── app.js            # Express app configuration
├── config/           # Configuration files
│   ├── index.js     # Main config
│   └── database.js  # Database config
├── controllers/      # Request handlers
│   └── contractController.js
├── services/         # Business logic
│   └── ContractService.js
├── models/          # Data models
│   └── Contract.js
├── middleware/      # Express middleware
│   ├── auth.js
│   └── validation.js
├── routes/          # API routes
│   └── contracts.js
├── utils/           # Utility functions
│   └── helpers.js
└── tests/           # Test files
└── contracts.test.js

### Frontend Structure
frontend/
├── src/
│   ├── components/      # React components
│   │   ├── common/     # Shared components
│   │   └── contracts/  # Feature components
│   ├── hooks/          # Custom hooks
│   │   └── useContracts.js
│   ├── services/       # API services
│   │   └── api.js
│   ├── store/          # State management
│   │   └── contractSlice.js
│   ├── utils/          # Utilities
│   │   └── constants.js
│   └── App.js          # Root component
└── tests/              # Test files

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/contract-templates

# Make changes
# ... code ...

# Run tests
npm test

# Commit changes
git add .
git commit -m "feat: add contract template functionality"

# Push branch
git push origin feature/contract-templates

# Create pull request
2. Git Workflow
bash# Commit message format
<type>(<scope>): <subject>

# Types:
# feat: New feature
# fix: Bug fix
# docs: Documentation
# style: Code style
# refactor: Code refactoring
# test: Testing
# chore: Maintenance

# Examples:
git commit -m "feat(contracts): add bulk export functionality"
git commit -m "fix(auth): resolve token expiration issue"
git commit -m "docs(api): update contract endpoint documentation"
3. Code Review Process

Self Review: Review your own code first
Automated Checks: Ensure CI/CD passes
Peer Review: Request review from team members
Address Feedback: Make requested changes
Merge: Squash and merge when approved

Coding Standards
JavaScript/TypeScript Standards
javascript// Use meaningful variable names
// ❌ Bad
const d = new Date();
const u = users.filter(x => x.a);

// ✅ Good
const currentDate = new Date();
const activeUsers = users.filter(user => user.isActive);

// Use async/await over promises
// ❌ Bad
function getUser(id) {
  return User.findById(id)
    .then(user => {
      return processUser(user);
    })
    .catch(error => {
      console.error(error);
    });
}

// ✅ Good
async function getUser(id) {
  try {
    const user = await User.findById(id);
    return await processUser(user);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Use destructuring
// ❌ Bad
const name = user.name;
const email = user.email;

// ✅ Good
const { name, email } = user;

// Use template literals
// ❌ Bad
const message = 'Hello ' + name + ', welcome to ' + appName;

// ✅ Good
const message = `Hello ${name}, welcome to ${appName}`;
React Standards
jsx// Use functional components with hooks
// ❌ Bad
class ContractList extends React.Component {
  constructor(props) {
    super(props);
    this.state = { contracts: [] };
  }
  
  componentDidMount() {
    this.loadContracts();
  }
  
  render() {
    return <div>{/* ... */}</div>;
  }
}

// ✅ Good
const ContractList = () => {
  const [contracts, setContracts] = useState([]);
  
  useEffect(() => {
    loadContracts();
  }, []);
  
  return <div>{/* ... */}</div>;
};

// Use proper prop types
import PropTypes from 'prop-types';

ContractList.propTypes = {
  userId: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  filters: PropTypes.shape({
    status: PropTypes.string,
    type: PropTypes.string
  })
};

// Extract complex logic to custom hooks
const useContracts = (userId) => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoading(true);
        const data = await contractService.getByUser(userId);
        setContracts(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchContracts();
  }, [userId]);
  
  return { contracts, loading, error };
};
CSS/Styling Standards
css/* Use CSS Modules or styled-components */
/* Use semantic class names */
/* Follow BEM naming convention */

/* ❌ Bad */
.btn-1 {
  background: red;
}

.x {
  margin: 10px;
}

/* ✅ Good */
.contract-list__button {
  background-color: var(--color-primary);
}

.contract-list__item--active {
  margin: var(--spacing-md);
}

/* Use CSS variables for consistency */
:root {
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --border-radius: 4px;
}
API Development
RESTful Design
javascript// Route naming conventions
// GET /api/v1/contracts         - List all contracts
// GET /api/v1/contracts/:id     - Get specific contract
// POST /api/v1/contracts        - Create contract
// PUT /api/v1/contracts/:id     - Update contract
// DELETE /api/v1/contracts/:id  - Delete contract

// Nested resources
// GET /api/v1/contracts/:id/comments      - Get contract comments
// POST /api/v1/contracts/:id/comments     - Add comment
// GET /api/v1/contracts/:id/versions      - Get versions
// POST /api/v1/contracts/:id/approve      - Approve contract
Controller Pattern
javascript// controllers/contractController.js
class ContractController {
  constructor(contractService) {
    this.contractService = contractService;
  }
  
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      
      const contracts = await this.contractService.list({
        userId: req.user.id,
        page: parseInt(page),
        limit: parseInt(limit),
        filters
      });
      
      res.json({
        success: true,
        data: contracts,
        meta: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: contracts.total
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async create(req, res, next) {
    try {
      const contract = await this.contractService.create({
        ...req.body,
        createdBy: req.user.id
      });
      
      res.status(201).json({
        success: true,
        data: contract
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ContractController;
Service Layer
javascript// services/ContractService.js
class ContractService {
  constructor({ contractRepository, eventEmitter, validator }) {
    this.contractRepository = contractRepository;
    this.eventEmitter = eventEmitter;
    this.validator = validator;
  }
  
  async create(data) {
    // Validate input
    const validated = await this.validator.validate(data, 'contract.create');
    
    // Business logic
    const contract = await this.contractRepository.create({
      ...validated,
      status: 'draft',
      version: 1
    });
    
    // Emit events
    this.eventEmitter.emit('contract.created', contract);
    
    return contract;
  }
  
  async approve(contractId, userId) {
    const contract = await this.contractRepository.findById(contractId);
    
    if (!contract) {
      throw new NotFoundError('Contract not found');
    }
    
    if (contract.status !== 'pending_approval') {
      throw new ValidationError('Contract must be pending approval');
    }
    
    // Check permissions
    if (!this.canApprove(contract, userId)) {
      throw new ForbiddenError('User cannot approve this contract');
    }
    
    // Update status
    const updated = await this.contractRepository.update(contractId, {
      status: 'approved',
      approvedBy: userId,
      approvedAt: new Date()
    });
    
    // Emit event
    this.eventEmitter.emit('contract.approved', updated);
    
    return updated;
  }
}

module.exports = ContractService;
Error Handling
javascript// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack
      })
    }
  });
};

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND');
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403, 'FORBIDDEN');
  }
}
Frontend Development
Component Structure
jsx// components/contracts/ContractForm.jsx
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { createContract } from '../../store/contractSlice';
import { Button, Input, Select } from '../common';

const ContractForm = ({ onSubmit, initialData = {} }) => {
  const dispatch = useDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: initialData
  });
  
  const handleFormSubmit = useCallback(async (data) => {
    try {
      setIsSubmitting(true);
      await dispatch(createContract(data)).unwrap();
      reset();
      onSubmit?.(data);
    } catch (error) {
      console.error('Failed to create contract:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, onSubmit, reset]);
  
  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="contract-form">
      <Input
        label="Contract Title"
        {...register('title', {
          required: 'Title is required',
          minLength: {
            value: 3,
            message: 'Title must be at least 3 characters'
          }
        })}
        error={errors.title?.message}
      />
      
      <Select
        label="Contract Type"
        {...register('type', { required: 'Type is required' })}
        error={errors.type?.message}
        options={[
          { value: 'service', label: 'Service Agreement' },
          { value: 'nda', label: 'Non-Disclosure Agreement' },
          { value: 'employment', label: 'Employment Contract' }
        ]}
      />
      
      <Button
        type="submit"
        disabled={isSubmitting}
        loading={isSubmitting}
      >
        Create Contract
      </Button>
    </form>
  );
};

ContractForm.propTypes = {
  onSubmit: PropTypes.func,
  initialData: PropTypes.object
};

export default ContractForm;
State Management
javascript// store/contractSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import contractService from '../services/contractService';

// Async thunks
export const fetchContracts = createAsyncThunk(
  'contracts/fetchContracts',
  async ({ page, filters }) => {
    const response = await contractService.list({ page, ...filters });
    return response.data;
  }
);

export const createContract = createAsyncThunk(
  'contracts/createContract',
  async (contractData) => {
    const response = await contractService.create(contractData);
    return response.data;
  }
);

// Slice
const contractSlice = createSlice({
  name: 'contracts',
  initialState: {
    items: [],
    selectedContract: null,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0
    }
  },
  reducers: {
    selectContract: (state, action) => {
      state.selectedContract = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch contracts
      .addCase(fetchContracts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContracts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.contracts;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchContracts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create contract
      .addCase(createContract.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      });
  }
});

export const { selectContract, clearError } = contractSlice.actions;
export default contractSlice.reducer;
Custom Hooks
javascript// hooks/useWebSocket.js
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import io from 'socket.io-client';

export const useWebSocket = (url, options = {}) => {
  const socket = useRef(null);
  const dispatch = useDispatch();
  
  useEffect(() => {
    socket.current = io(url, {
      transports: ['websocket'],
      ...options
    });
    
    socket.current.on('connect', () => {
      console.log('WebSocket connected');
    });
    
    socket.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
    
    socket.current.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    return () => {
      socket.current?.disconnect();
    };
  }, [url]);
  
  const emit = useCallback((event, data) => {
    socket.current?.emit(event, data);
  }, []);
  
  const on = useCallback((event, handler) => {
    socket.current?.on(event, handler);
    
    return () => {
      socket.current?.off(event, handler);
    };
  }, []);
  
  return { socket: socket.current, emit, on };
};

// Usage
const ContractEditor = ({ contractId }) => {
  const { emit, on } = useWebSocket('/contracts');
  
  useEffect(() => {
    const unsubscribe = on('contract:updated', (data) => {
      if (data.contractId === contractId) {
        // Update local state
      }
    });
    
    return unsubscribe;
  }, [contractId, on]);
  
  const handleEdit = (changes) => {
    emit('contract:edit', { contractId, changes });
  };
  
  return <div>{/* Editor UI */}</div>;
};
Database Development
Migration Pattern
javascript// migrations/20240101_create_contracts_table.js
exports.up = async (knex) => {
  await knex.schema.createTable('contracts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('title', 500).notNullable();
    table.text('description');
    table.enum('type', ['service', 'nda', 'employment', 'sales', 'other']).notNullable();
    table.enum('status', ['draft', 'pending_review', 'approved', 'active', 'expired']).defaultTo('draft');
    table.decimal('value', 15, 2);
    table.string('currency', 3).defaultTo('USD');
    table.date('start_date');
    table.date('end_date');
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['status', 'created_by']);
    table.index('created_at');
  });
  
  // Add trigger for updated_at
  await knex.raw(`
    CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('contracts');
};
Repository Pattern
javascript// repositories/ContractRepository.js
class ContractRepository {
  constructor(db) {
    this.db = db;
  }
  
  async findById(id) {
    const contract = await this.db('contracts')
      .where({ id })
      .first();
    
    if (!contract) return null;
    
    // Load relationships
    const [parties, attachments] = await Promise.all([
      this.db('contract_parties').where({ contract_id: id }),
      this.db('attachments').where({ contract_id: id })
    ]);
    
    return {
      ...contract,
      parties,
      attachments
    };
  }
  
  async list({ userId, page = 1, limit = 20, filters = {} }) {
    const query = this.db('contracts')
      .where({ created_by: userId });
    
    // Apply filters
    if (filters.status) {
      query.where({ status: filters.status });
    }
    
    if (filters.type) {
      query.where({ type: filters.type });
    }
    
    if (filters.search) {
      query.where((builder) => {
        builder
          .where('title', 'ilike', `%${filters.search}%`)
          .orWhere('description', 'ilike', `%${filters.search}%`);
      });
    }
    
    // Get total count
    const [{ count }] = await query.clone().count('* as count');
    
    // Get paginated results
    const contracts = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    return {
      contracts,
      total: parseInt(count),
      page,
      limit,
      pages: Math.ceil(count / limit)
    };
  }
  
  async create(data) {
    return this.db.transaction(async (trx) => {
      const { parties, ...contractData } = data;
      
      // Insert contract
      const [contract] = await trx('contracts')
        .insert(contractData)
        .returning('*');
      
      // Insert parties if provided
      if (parties && parties.length > 0) {
        const partyData = parties.map(party => ({
          contract_id: contract.id,
          ...party
        }));
        
        await trx('contract_parties').insert(partyData);
      }
      
      // Create initial version
      await trx('contract_versions').insert({
        contract_id: contract.id,
        version_number: 1,
        content: contractData.content,
        created_by: contractData.created_by
      });
      
      return contract;
    });
  }
  
  async update(id, data) {
    return this.db.transaction(async (trx) => {
      const [updated] = await trx('contracts')
        .where({ id })
        .update({
          ...data,
          updated_at: new Date()
        })
        .returning('*');
      
      // Create version if content changed
      if (data.content) {
        const lastVersion = await trx('contract_versions')
          .where({ contract_id: id })
          .orderBy('version_number', 'desc')
          .first();
        
        await trx('contract_versions').insert({
          contract_id: id,
          version_number: (lastVersion?.version_number || 0) + 1,
          content: data.content,
          created_by: data.updated_by
        });
      }
      
      return updated;
    });
  }
}

module.exports = ContractRepository;
Testing Strategy
Unit Testing
javascript// tests/unit/services/ContractService.test.js
const ContractService = require('../../../services/ContractService');
const { ValidationError, NotFoundError } = require('../../../utils/errors');

describe('ContractService', () => {
  let contractService;
  let mockRepository;
  let mockEventEmitter;
  let mockValidator;
  
  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };
    
    mockEventEmitter = {
      emit: jest.fn()
    };
    
    mockValidator = {
      validate: jest.fn()
    };
    
    contractService = new ContractService({
      contractRepository: mockRepository,
      eventEmitter: mockEventEmitter,
      validator: mockValidator
    });
  });
  
  describe('create', () => {
    it('should create a contract successfully', async () => {
      const inputData = {
        title: 'Test Contract',
        type: 'service',
        createdBy: 'user-123'
      };
      
      const validatedData = { ...inputData };
      const createdContract = { id: 'contract-123', ...validatedData, status: 'draft' };
      
      mockValidator.validate.mockResolvedValue(validatedData);
      mockRepository.create.mockResolvedValue(createdContract);
      
      const result = await contractService.create(inputData);
      
      expect(mockValidator.validate).toHaveBeenCalledWith(inputData, 'contract.create');
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...validatedData,
        status: 'draft',
        version: 1
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('contract.created', createdContract);
      expect(result).toEqual(createdContract);
    });
    
    it('should throw validation error for invalid data', async () => {
      const invalidData = { title: '' };
      
      mockValidator.validate.mockRejectedValue(new ValidationError('Title is required'));
      
      await expect(contractService.create(invalidData)).rejects.toThrow(ValidationError);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
  
  describe('approve', () => {
    it('should approve a contract in pending status', async () => {
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
      
      const result = await contractService.approve(contractId, userId);
      
      expect(result.status).toBe('approved');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('contract.approved', expect.any(Object));
    });
    
    it('should throw error if contract not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      
      await expect(contractService.approve('invalid-id', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
Integration Testing
javascript// tests/integration/contracts.test.js
const request = require('supertest');
const app = require('../../app');
const { setupDatabase, teardownDatabase, createUser, createContract } = require('../helpers');

describe('Contract API', () => {
  let authToken;
  let userId;
  
  beforeAll(async () => {
    await setupDatabase();
  });
  
  afterAll(async () => {
    await teardownDatabase();
  });
  
  beforeEach(async () => {
    const user = await createUser({
      email: 'test@example.com',
      password: 'Test123!'
    });
    
    userId = user.id;
    
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!'
      });
    
    authToken = loginResponse.body.token;
  });
  
  describe('POST /api/v1/contracts', () => {
    it('should create a new contract', async () => {
      const contractData = {
        title: 'Service Agreement',
        type: 'service',
        description: 'Test service agreement',
        value: 5000,
        currency: 'USD'
      };
      
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contractData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: contractData.title,
        type: contractData.type,
        status: 'draft',
        created_by: userId
      });
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('GET /api/v1/contracts', () => {
    beforeEach(async () => {
      // Create test contracts
      await Promise.all([
        createContract({ title: 'Contract 1', created_by: userId, status: 'draft' }),
        createContract({ title: 'Contract 2', created_by: userId, status: 'active' }),
        createContract({ title: 'Contract 3', created_by: userId, status: 'active' })
      ]);
    });
    
    it('should list user contracts', async () => {
      const response = await request(app)
        .get('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.contracts).toHaveLength(3);
      expect(response.body.meta.total).toBe(3);
    });
    
    it('should filter contracts by status', async () => {
      const response = await request(app)
        .get('/api/v1/contracts?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.contracts).toHaveLength(2);
      expect(response.body.data.contracts.every(c => c.status === 'active')).toBe(true);
    });
    
    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/contracts?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.contracts).toHaveLength(2);
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2
      });
    });
  });
});
E2E Testing
javascript// tests/e2e/contract-workflow.test.js
const { chromium } = require('playwright');

describe('Contract Workflow E2E', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000');
  });
  
  afterEach(async () => {
    await page.close();
  });
  
  it('should complete contract creation workflow', async () => {
    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Test123!');
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect
    await page.waitForURL('**/dashboard');
    
    // Navigate to contracts
    await page.click('[data-testid="nav-contracts"]');
    await page.click('[data-testid="create-contract-button"]');
    
    // Fill contract form
    await page.fill('[data-testid="contract-title"]', 'E2E Test Contract');
    await page.selectOption('[data-testid="contract-type"]', 'service');
    await page.fill('[data-testid="contract-value"]', '10000');
    
    // Add party
    await page.click('[data-testid="add-party-button"]');
    await page.fill('[data-testid="party-name-0"]', 'Test Client');
    await page.fill('[data-testid="party-email-0"]', 'client@example.com');
    
    // Submit
    await page.click('[data-testid="submit-contract-button"]');
    
    // Verify success
    await page.waitForSelector('[data-testid="success-message"]');
    const successText = await page.textContent('[data-testid="success-message"]');
    expect(successText).toContain('Contract created successfully');
    
    // Verify in list
    await page.click('[data-testid="nav-contracts"]');
    const contractTitle = await page.textContent('[data-testid="contract-list"] >> text=E2E Test Contract');
    expect(contractTitle).toBeTruthy();
  });
});
Performance Guidelines
Backend Performance
javascript// Use database connection pooling
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Implement caching
const Redis = require('ioredis');
const redis = new Redis();

const cacheMiddleware = (duration = 60) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Cache error:', error);
    }
    
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redis.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};

// Use pagination
const paginate = (query, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return query.limit(limit).offset(offset);
};

// Optimize queries
// ❌ Bad - N+1 query
const contracts = await db('contracts').select('*');
for (const contract of contracts) {
  contract.parties = await db('parties').where({ contract_id: contract.id });
}

// ✅ Good - Single query with join
const contracts = await db('contracts')
  .leftJoin('contract_parties', 'contracts.id', 'contract_parties.contract_id')
  .leftJoin('parties', 'contract_parties.party_id', 'parties.id')
  .select('contracts.*', db.raw('array_agg(parties.*) as parties'))
  .groupBy('contracts.id');
Frontend Performance
javascript// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <ComplexVisualization data={data} />;
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id;
});

// Use useMemo for expensive calculations
const ContractStats = ({ contracts }) => {
  const stats = useMemo(() => {
    return contracts.reduce((acc, contract) => {
      acc.total += 1;
      acc.totalValue += contract.value || 0;
      acc.byStatus[contract.status] = (acc.byStatus[contract.status] || 0) + 1;
      return acc;
    }, { total: 0, totalValue: 0, byStatus: {} });
  }, [contracts]);
  
  return <StatsDisplay stats={stats} />;
};

// Lazy load components
const ContractEditor = lazy(() => import('./ContractEditor'));

const ContractPage = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ContractEditor />
    </Suspense>
  );
};

// Debounce expensive operations
const SearchInput = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  
  const debouncedSearch = useMemo(
    () => debounce(onSearch, 300),
    [onSearch]
  );
  
  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);
  
  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search contracts..."
    />
  );
};

// Virtual scrolling for large lists
import { FixedSizeList } from 'react-window';

const ContractList = ({ contracts }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ContractItem contract={contracts[index]} />
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={contracts.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
Security Guidelines
Input Validation
javascript// Always validate and sanitize input
const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

const validateContract = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .escape(),
  body('content')
    .customSanitizer(value => DOMPurify.sanitize(value)),
  body('value')
    .optional()
    .isFloat({ min: 0 })
    .toFloat(),
  body('email')
    .isEmail()
    .normalizeEmail(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
Authentication & Authorization
javascript// Implement proper authentication
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.userId);
    
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Implement authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Check resource ownership
const checkOwnership = (model) => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params.id);
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      if (resource.created_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};
Security Headers
javascript// Use helmet for security headers
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Add custom security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
Best Practices Summary

Code Quality

Write clean, readable code
Follow consistent naming conventions
Document complex logic
Keep functions small and focused


Testing

Write tests before code (TDD)
Aim for >80% code coverage
Test edge cases
Use meaningful test descriptions


Performance

Profile before optimizing
Use caching strategically
Optimize database queries
Implement pagination


Security

Never trust user input
Use parameterized queries
Implement proper authentication
Keep dependencies updated


Collaboration

Write meaningful commit messages
Review code thoroughly
Document APIs clearly
Share knowledge with team



Remember: Good code is written for humans to read, not just for computers to execute.