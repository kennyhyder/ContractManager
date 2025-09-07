// tests/backend/unit/models/User.test.js
require('../../setup');
const User = require('../../../../backend/models/User');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
  describe('Schema Validation', () => {
    it('should create a valid user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.password).not.toBe(userData.password); // Should be hashed
    });

    it('should require email', async () => {
      const user = new User({
        password: 'password123',
        firstName: 'John'
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should enforce unique email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      await User.create(userData);
      
      const duplicateUser = new User(userData);
      await expect(duplicateUser.save()).rejects.toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('should hash password before saving', async () => {
      const user = new User({
        email: 'hash@example.com',
        password: 'plaintext',
        firstName: 'Test',
        lastName: 'User'
      });

      await user.save();
      
      expect(user.password).not.toBe('plaintext');
      expect(user.password).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash pattern
    });

    it('should not rehash password if not modified', async () => {
      const user = await User.create({
        email: 'nohash@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      });

      const originalHash = user.password;
      
      user.firstName = 'Updated';
      await user.save();
      
      expect(user.password).toBe(originalHash);
    });
  });

  describe('Methods', () => {
    it('should compare password correctly', async () => {
      const user = await User.create({
        email: 'compare@example.com',
        password: 'correctpassword',
        firstName: 'Test',
        lastName: 'User'
      });

      const isValid = await user.comparePassword('correctpassword');
      const isInvalid = await user.comparePassword('wrongpassword');
      
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it('should generate auth token', async () => {
      const user = await User.create({
        email: 'token@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin'
      });

      const token = user.generateAuthToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should return safe user object', async () => {
      const user = await User.create({
        email: 'safe@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      });

      const safeUser = user.toJSON();
      
      expect(safeUser).not.toHaveProperty('password');
      expect(safeUser).toHaveProperty('email');
      expect(safeUser).toHaveProperty('_id');
    });
  });
});