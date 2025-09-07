// tests/backend/unit/services/AuthService.test.js
const AuthService = require('../../../../backend/services/AuthService');
const User = require('../../../../backend/models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../../../../backend/models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      bcrypt.hash.mockResolvedValue('hashedPassword');
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'userId',
        ...userData,
        password: 'hashedPassword'
      });

      const result = await authService.register(userData);

      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(User.create).toHaveBeenCalledWith({
        ...userData,
        password: 'hashedPassword'
      });
      expect(result).toHaveProperty('_id', 'userId');
    });

    it('should throw error if user already exists', async () => {
      User.findOne.mockResolvedValue({ email: 'test@example.com' });

      await expect(authService.register({
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow('User already exists');
    });
  });

  describe('login', () => {
    it('should authenticate user and return token', async () => {
      const mockUser = {
        _id: 'userId',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'user',
        isActive: true,
        toObject: jest.fn().mockReturnValue({
          _id: 'userId',
          email: 'test@example.com',
          role: 'user'
        })
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mockToken');

      const result = await authService.login('test@example.com', 'password123');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(jwt.sign).toHaveBeenCalled();
      expect(result).toHaveProperty('token', 'mockToken');
      expect(result).toHaveProperty('user');
    });

    it('should throw error for invalid credentials', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(authService.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode valid token', async () => {
      const mockDecoded = { id: 'userId', email: 'test@example.com' };
      jwt.verify.mockReturnValue(mockDecoded);

      const result = await authService.verifyToken('validToken');

      expect(jwt.verify).toHaveBeenCalledWith('validToken', process.env.JWT_SECRET);
      expect(result).toEqual(mockDecoded);
    });

    it('should throw error for invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyToken('invalidToken'))
        .rejects.toThrow('Invalid token');
    });
  });
});