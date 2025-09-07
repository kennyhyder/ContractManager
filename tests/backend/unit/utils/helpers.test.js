// tests/backend/unit/utils/helpers.test.js
const helpers = require('../../../../backend/utils/helpers');

describe('Helper Functions', () => {
  describe('formatCurrency', () => {
    it('should format numbers as currency', () => {
      expect(helpers.formatCurrency(1000)).toBe('$1,000.00');
      expect(helpers.formatCurrency(1234.56)).toBe('$1,234.56');
      expect(helpers.formatCurrency(0)).toBe('$0.00');
    });

    it('should handle different locales', () => {
      expect(helpers.formatCurrency(1000, 'EUR')).toBe('€1,000.00');
      expect(helpers.formatCurrency(1000, 'GBP')).toBe('£1,000.00');
    });
  });

  describe('generateContractNumber', () => {
    it('should generate unique contract numbers', () => {
      const numbers = new Set();
      
      for (let i = 0; i < 100; i++) {
        const number = helpers.generateContractNumber();
        expect(number).toMatch(/^CNT-\d{4}-\d{6}$/);
        numbers.add(number);
      }
      
      expect(numbers.size).toBe(100); // All unique
    });
  });

  describe('parseQueryParams', () => {
    it('should parse pagination params', () => {
      const query = {
        page: '2',
        limit: '20',
        sort: 'createdAt:desc'
      };

      const parsed = helpers.parseQueryParams(query);
      
      expect(parsed).toEqual({
        page: 2,
        limit: 20,
        skip: 20,
        sort: { createdAt: -1 }
      });
    });

    it('should apply defaults', () => {
      const parsed = helpers.parseQueryParams({});
      
      expect(parsed).toEqual({
        page: 1,
        limit: 10,
        skip: 0,
        sort: { createdAt: -1 }
      });
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove dangerous HTML', () => {
      const dirty = '<script>alert("xss")</script><p>Safe content</p>';
      const clean = helpers.sanitizeHtml(dirty);
      
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>Safe content</p>');
    });

    it('should preserve allowed tags', () => {
      const html = '<p>Paragraph</p><strong>Bold</strong><em>Italic</em>';
      const sanitized = helpers.sanitizeHtml(html);
      
      expect(sanitized).toBe(html);
    });
  });

  describe('calculateDateDifference', () => {
    it('should calculate days between dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-31');
      
      expect(helpers.calculateDateDifference(date1, date2)).toBe(30);
    });

    it('should handle negative differences', () => {
      const date1 = new Date('2024-01-31');
      const date2 = new Date('2024-01-01');
      
      expect(helpers.calculateDateDifference(date1, date2)).toBe(-30);
    });
  });

  describe('retry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'Success';
      });

      const result = await helpers.retry(operation, 3, 100);
      
      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Permanent failure'));

      await expect(helpers.retry(operation, 3, 100))
        .rejects.toThrow('Permanent failure');
      
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });
});