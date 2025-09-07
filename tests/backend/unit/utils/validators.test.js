// tests/backend/unit/utils/validators.test.js
const validators = require('../../../../backend/utils/validators');

describe('Validators', () => {
  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@company.co.uk',
        'first+last@domain.com',
        '123@numerical.com'
      ];

      validEmails.forEach(email => {
        expect(validators.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@nodomain.com',
        'no@domain',
        'spaces in@email.com',
        'double@@at.com'
      ];

      invalidEmails.forEach(email => {
        expect(validators.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'StrongP@ss123',
        'C0mpl3x!Pass',
        'Val1d#Password'
      ];

      validPasswords.forEach(password => {
        const result = validators.validatePassword(password);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        { password: 'short', reason: 'length' },
        { password: 'nouppercase123!', reason: 'uppercase' },
        { password: 'NOLOWERCASE123!', reason: 'lowercase' },
        { password: 'NoNumbers!', reason: 'number' },
        { password: 'NoSpecialChar123', reason: 'special' }
      ];

      weakPasswords.forEach(({ password, reason }) => {
        const result = validators.validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expect.stringContaining(reason));
      });
    });
  });

  describe('Contract Validation', () => {
    it('should validate contract data', () => {
      const validContract = {
        title: 'Valid Contract',
        clientName: 'Client Name',
        clientEmail: 'client@example.com',
        value: 10000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000)
      };

      const result = validators.validateContract(validContract);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid contract dates', () => {
      const invalidContract = {
        title: 'Invalid Contract',
        clientName: 'Client',
        startDate: new Date(),
        endDate: new Date(Date.now() - 86400000) // End before start
      };

      const result = validators.validateContract(invalidContract);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End date must be after start date');
    });
  });

  describe('File Validation', () => {
    it('should validate allowed file types', () => {
      const allowedFiles = [
        { name: 'document.pdf', size: 1024 * 1024 },
        { name: 'contract.docx', size: 2 * 1024 * 1024 },
        { name: 'image.png', size: 500 * 1024 }
      ];

      allowedFiles.forEach(file => {
        expect(validators.validateFile(file)).toEqual({
          isValid: true,
          errors: []
        });
      });
    });

    it('should reject invalid files', () => {
      const invalidFiles = [
        { 
          file: { name: 'script.exe', size: 1024 }, 
          reason: 'File type not allowed' 
        },
        { 
          file: { name: 'large.pdf', size: 11 * 1024 * 1024 }, 
          reason: 'File size exceeds limit' 
        }
      ];

      invalidFiles.forEach(({ file, reason }) => {
        const result = validators.validateFile(file);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(reason);
      });
    });
  });
});