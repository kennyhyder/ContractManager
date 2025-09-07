// tests/backend/unit/services/EmailService.test.js
const EmailService = require('../../../../backend/services/EmailService');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;

jest.mock('nodemailer');
jest.mock('handlebars');
jest.mock('fs').promises;

describe('EmailService', () => {
  let emailService;
  let mockTransporter;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
    };
    
    nodemailer.createTransport.mockReturnValue(mockTransporter);
    handlebars.compile.mockReturnValue((data) => `Compiled template with ${JSON.stringify(data)}`);
    fs.readFile.mockResolvedValue('Template content');
    
    emailService = new EmailService();
  });

  describe('sendEmail', () => {
    it('should send email with compiled template', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome',
        data: { name: 'John' }
      };

      const result = await emailService.sendEmail(emailData);

      expect(fs.readFile).toHaveBeenCalled();
      expect(handlebars.compile).toHaveBeenCalledWith('Template content');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: emailData.to,
        subject: emailData.subject,
        html: expect.stringContaining('John')
      });
      expect(result).toHaveProperty('messageId', 'test-id');
    });

    it('should handle email sending errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        template: 'welcome'
      })).rejects.toThrow('SMTP error');
    });
  });

  describe('sendContractNotification', () => {
    it('should send contract notification email', async () => {
      const contract = {
        _id: 'contractId',
        title: 'Test Contract',
        clientName: 'Test Client'
      };
      
      const recipient = {
        email: 'client@example.com',
        firstName: 'Client'
      };

      await emailService.sendContractNotification(contract, recipient, 'created');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: recipient.email,
        subject: expect.stringContaining('Contract'),
        html: expect.any(String)
      });
    });
  });
});