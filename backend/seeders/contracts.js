const Contract = require('../models/Contract');
const User = require('../models/User');
const Template = require('../models/Template');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const logger = require('../utils/logger');

module.exports = {
  async seed() {
    try {
      // Check if contracts already exist
      const existingContracts = await Contract.countDocuments();
      if (existingContracts > 0) {
        logger.info('Contracts already exist, skipping seed');
        return { skipped: true, reason: 'Contracts already exist' };
      }

      // Get users and templates
      const users = await User.find().limit(5);
      const templates = await Template.find();

      if (users.length < 2 || templates.length === 0) {
        throw new Error('Not enough users or templates. Please seed them first.');
      }

      const [admin, john, jane, mike, sarah] = users;
      const [ndaTemplate, serviceTemplate, employmentTemplate, salesTemplate] = templates;

      // Create contracts
      const contractsData = [
        {
          title: 'Acme Corp NDA',
          description: 'Non-disclosure agreement with Acme Corporation',
          template: ndaTemplate._id,
          owner: john._id,
          collaborators: [jane._id],
          content: ndaTemplate.content
            .replace('{{date}}', new Date().toLocaleDateString())
            .replace('{{party1_name}}', 'Acme Corporation')
            .replace('{{party2_name}}', 'Tech Solutions Ltd.')
            .replace('{{purpose}}', 'Evaluation of potential business partnership')
            .replace('{{term_years}}', '3'),
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          value: 0,
          tags: ['nda', 'partnership', 'acme'],
          metadata: {
            party1_name: 'Acme Corporation',
            party2_name: 'Tech Solutions Ltd.',
            purpose: 'Evaluation of potential business partnership',
            term_years: 3
          }
        },
        {
          title: 'Website Development Service Agreement',
          description: 'Service agreement for website development project',
          template: serviceTemplate._id,
          owner: jane._id,
          collaborators: [mike._id, john._id],
          content: serviceTemplate.content
            .replace(/{{date}}/g, new Date().toLocaleDateString())
            .replace(/{{client_name}}/g, 'Global Enterprises')
            .replace(/{{provider_name}}/g, 'Tech Solutions Ltd.')
            .replace('{{services_description}}', 'Design and development of corporate website including: responsive design, CMS integration, SEO optimization')
            .replace('{{amount}}', '25000')
            .replace('{{payment_terms}}', '50% upfront, 50% on completion')
            .replace('{{start_date}}', new Date().toLocaleDateString())
            .replace('{{end_date}}', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString())
            .replace('{{deliverables}}', 'Fully functional website, source code, documentation, 30-day support')
            .replace('{{ip_terms}}', 'All intellectual property rights transfer to client upon final payment')
            .replace('{{notice_days}}', '30'),
          status: 'draft',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          value: 25000,
          currency: 'USD',
          tags: ['service', 'website', 'development'],
          isDraft: true
        },
        {
          title: 'Senior Developer Employment Contract',
          description: 'Employment contract for Senior Full Stack Developer position',
          template: employmentTemplate._id,
          owner: sarah._id,
          collaborators: [admin._id],
          content: employmentTemplate.content
            .replace(/{{date}}/g, new Date().toLocaleDateString())
            .replace(/{{company_name}}/g, 'Contract Management Inc.')
            .replace(/{{employee_name}}/g, 'Robert Chen')
            .replace('{{position_title}}', 'Senior Full Stack Developer')
            .replace('{{annual_salary}}', '120000')
            .replace('{{payment_frequency}}', 'Monthly')
            .replace('{{benefits_description}}', 'Health insurance, dental, vision, 401k matching, stock options')
            .replace('{{start_date}}', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString())
            .replace('{{employment_type}}', 'Full-time')
            .replace('{{work_schedule}}', 'Monday to Friday, 9 AM to 6 PM, with flexible hours')
            .replace('{{leave_policy}}', '20 days PTO, 10 sick days, standard federal holidays')
            .replace('{{termination_terms}}', 'At-will employment with 2 weeks notice period'),
          status: 'pending',
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Start in 2 weeks
          value: 120000,
          currency: 'USD',
          tags: ['employment', 'developer', 'full-time'],
          approvalRequired: true,
          approvers: [admin._id]
        },
        {
          title: 'Enterprise Software License Agreement',
          description: 'Annual software license agreement',
          template: salesTemplate._id,
          owner: mike._id,
          collaborators: [john._id, jane._id],
          content: salesTemplate.content
            .replace(/{{date}}/g, new Date().toLocaleDateString())
            .replace(/{{seller_name}}/g, 'Software Solutions Inc.')
            .replace(/{{buyer_name}}/g, 'Global Enterprises')
            .replace('{{products_description}}', 'Enterprise CRM Software License - 100 users, including updates and support')
            .replace('{{total_price}}', '50000')
            .replace('{{payment_method}}', 'Bank Transfer')
            .replace('{{payment_terms}}', 'Net 30')
            .replace('{{delivery_date}}', new Date().toLocaleDateString())
            .replace('{{delivery_location}}', 'Cloud-based delivery')
            .replace('{{delivery_terms}}', 'Immediate access upon payment confirmation')
            .replace('{{warranty_terms}}', '99.9% uptime guarantee, bug fixes within 48 hours')
            .replace('{{liability_terms}}', 'Limited to the license fee paid')
            .replace('{{governing_state}}', 'California'),
          status: 'signed',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
          endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000), // Ends in 11 months
          value: 50000,
          currency: 'USD',
          tags: ['software', 'license', 'enterprise'],
          signedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          signatures: [
            {
              user: mike._id,
              signedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              ipAddress: '192.168.1.100',
              signatureData: 'base64-encoded-signature-data'
            },
            {
              user: john._id,
              signedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
              ipAddress: '192.168.1.101',
              signatureData: 'base64-encoded-signature-data'
            }
          ]
        }
      ];

      // Create contracts
      const createdContracts = await Contract.insertMany(contractsData);

      // Add some comments
      const commentsData = [
        {
          contract: createdContracts[1]._id, // Website Development
          author: mike._id,
          content: 'Should we include mobile app development in the scope?',
          position: { page: 1, x: 100, y: 200 }
        },
        {
          contract: createdContracts[1]._id,
          author: jane._id,
          content: 'Good idea, but that would increase the timeline and budget. Let\'s discuss in the meeting.',
          parentComment: null, // Will be set after creation
          mentions: [mike._id]
        },
        {
          contract: createdContracts[2]._id, // Employment Contract
          author: admin._id,
          content: 'The salary range has been approved by the board.',
          position: { page: 1, x: 150, y: 300 }
        }
      ];

      const createdComments = [];
      for (const commentData of commentsData) {
        const comment = await Comment.create(commentData);
        createdComments.push(comment);
      }

      // Set parent comment
      createdComments[1].parentComment = createdComments[0]._id;
      await createdComments[1].save();

      // Add some activities
      const activities = [
        {
          user: john._id,
          action: 'contract.created',
          resource: 'Contract',
          resourceId: createdContracts[0]._id,
          description: 'Created contract: Acme Corp NDA'
        },
        {
          user: jane._id,
          action: 'contract.created',
          resource: 'Contract',
          resourceId: createdContracts[1]._id,
          description: 'Created contract: Website Development Service Agreement'
        },
        {
          user: mike._id,
          action: 'contract.viewed',
          resource: 'Contract',
          resourceId: createdContracts[1]._id,
          description: 'Viewed contract: Website Development Service Agreement'
        },
        {
          user: mike._id,
          action: 'contract.signed',
          resource: 'Contract',
          resourceId: createdContracts[3]._id,
          description: 'Signed contract: Enterprise Software License Agreement'
        }
      ];

      await Activity.insertMany(activities);

      return {
        created: createdContracts.length,
        contracts: createdContracts.map(c => ({
          id: c._id,
          title: c.title,
          status: c.status,
          owner: c.owner
        })),
        comments: createdComments.length,
        activities: activities.length
      };
    } catch (error) {
      logger.error('Error seeding contracts:', error);
      throw error;
    }
  },

  async clean() {
    try {
      // Clean in reverse order of dependencies
      await Activity.deleteMany({ resource: 'Contract' });
      await Comment.deleteMany({});
      const result = await Contract.deleteMany({});

      return {
        deleted: result.deletedCount,
        commentsDeleted: true,
        activitiesDeleted: true
      };
    } catch (error) {
      logger.error('Error cleaning contracts:', error);
      throw error;
    }
  }
};