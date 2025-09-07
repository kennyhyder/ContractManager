#!/usr/bin/env node
// scripts/seed.js

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const User = require('../models/User');
const Contract = require('../models/Contract');
const Template = require('../models/Template');
const Activity = require('../models/Activity');
const Comment = require('../models/Comment');

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Helper functions
const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}→${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

class DatabaseSeeder {
  constructor() {
    this.users = [];
    this.contracts = [];
    this.templates = [];
  }

  async connect() {
    try {
      log.info('Connecting to database...');
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management';
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      log.success('Database connected');
    } catch (error) {
      log.error('Database connection failed: ' + error.message);
      throw error;
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    log.info('Database disconnected');
  }

  async cleanDatabase() {
    log.warning('Cleaning existing data...');
    
    await User.deleteMany({});
    await Contract.deleteMany({});
    await Template.deleteMany({});
    await Activity.deleteMany({});
    await Comment.deleteMany({});
    
    log.success('Database cleaned');
  }

  async seedUsers() {
    log.info('Seeding users...');

    const users = [
      {
        email: 'admin@example.com',
        password: await bcrypt.hash('Password123!', 10),
        name: 'Admin User',
        role: 'admin',
        department: 'IT',
        jobTitle: 'System Administrator',
        emailVerified: true,
        isActive: true
      },
      {
        email: 'john.doe@example.com',
        password: await bcrypt.hash('Password123!', 10),
        name: 'John Doe',
        role: 'user',
        department: 'Sales',
        jobTitle: 'Sales Manager',
        emailVerified: true,
        isActive: true
      },
      {
        email: 'jane.smith@example.com',
        password: await bcrypt.hash('Password123!', 10),
        name: 'Jane Smith',
        role: 'manager',
        department: 'Legal',
        jobTitle: 'Legal Manager',
        emailVerified: true,
        isActive: true
      },
      {
        email: 'bob.wilson@example.com',
        password: await bcrypt.hash('Password123!', 10),
        name: 'Bob Wilson',
        role: 'user',
        department: 'Finance',
        jobTitle: 'Financial Analyst',
        emailVerified: true,
        isActive: true
      }
    ];

    // Add some random users
    for (let i = 0; i < 10; i++) {
      users.push({
        email: faker.internet.email(),
        password: await bcrypt.hash('Password123!', 10),
        name: faker.person.fullName(),
        role: faker.helpers.arrayElement(['user', 'manager']),
        department: faker.helpers.arrayElement(['Sales', 'Marketing', 'HR', 'Finance', 'Operations']),
        jobTitle: faker.person.jobTitle(),
        emailVerified: faker.datatype.boolean(),
        isActive: true
      });
    }

    this.users = await User.insertMany(users);
    log.success(`Created ${this.users.length} users`);
  }

  async seedTemplates() {
    log.info('Seeding templates...');

    const templates = [
      {
        name: 'Non-Disclosure Agreement',
        category: 'legal',
        description: 'Standard NDA template for confidential information protection',
        content: `<h1>Non-Disclosure Agreement</h1>
<p>This Non-Disclosure Agreement (the "Agreement") is entered into as of {{date}} by and between {{party1}} and {{party2}}.</p>
<h2>1. Confidential Information</h2>
<p>The parties acknowledge that they may disclose certain confidential information to each other...</p>`,
        variables: ['date', 'party1', 'party2'],
        tags: ['nda', 'confidential', 'legal'],
        createdBy: this.users[0]._id,
        isPublic: true,
        status: 'active'
      },
      {
        name: 'Service Agreement',
        category: 'business',
        description: 'Standard service agreement for professional services',
        content: `<h1>Service Agreement</h1>
<p>This Service Agreement is made between {{client}} and {{provider}} on {{date}}.</p>
<h2>1. Services</h2>
<p>The Provider agrees to provide the following services: {{services}}</p>
<h2>2. Payment Terms</h2>
<p>The Client agrees to pay {{amount}} for the services...</p>`,
        variables: ['client', 'provider', 'date', 'services', 'amount'],
        tags: ['service', 'agreement', 'business'],
        createdBy: this.users[1]._id,
        isPublic: true,
        status: 'active'
      },
      {
        name: 'Employment Contract',
        category: 'hr',
        description: 'Standard employment contract template',
        content: `<h1>Employment Contract</h1>
<p>This Employment Contract is between {{employer}} and {{employee}}.</p>
<h2>1. Position</h2>
<p>The Employee will serve as {{position}} starting from {{startDate}}.</p>
<h2>2. Compensation</h2>
<p>The annual salary will be {{salary}}...</p>`,
        variables: ['employer', 'employee', 'position', 'startDate', 'salary'],
        tags: ['employment', 'hr', 'contract'],
        createdBy: this.users[2]._id,
        isPublic: true,
        status: 'active'
      }
    ];

    this.templates = await Template.insertMany(templates);
    log.success(`Created ${this.templates.length} templates`);
  }

  async seedContracts() {
    log.info('Seeding contracts...');

    const contracts = [];
    const statuses = ['draft', 'pending_approval', 'approved', 'active', 'completed'];
    const types = ['service', 'purchase', 'nda', 'employment', 'lease'];

    for (let i = 0; i < 20; i++) {
      const createdBy = faker.helpers.arrayElement(this.users);
      const status = faker.helpers.arrayElement(statuses);
      
      contracts.push({
        title: faker.company.catchPhrase() + ' Agreement',
        description: faker.lorem.paragraph(),
        content: faker.lorem.paragraphs(5, '<br/><br/>'),
        type: faker.helpers.arrayElement(types),
        status: status,
        parties: [
          {
            name: faker.company.name(),
            email: faker.internet.email(),
            role: 'client',
            signedAt: status === 'active' || status === 'completed' ? faker.date.recent() : null
          },
          {
            name: faker.company.name(),
            email: faker.internet.email(),
            role: 'vendor',
            signedAt: status === 'active' || status === 'completed' ? faker.date.recent() : null
          }
        ],
        value: faker.number.int({ min: 1000, max: 100000 }),
        currency: 'USD',
        startDate: faker.date.future(),
        endDate: faker.date.future({ years: 2 }),
        createdBy: createdBy._id,
        assignedTo: faker.helpers.arrayElement(this.users.filter(u => u.role !== 'user'))._id,
        template: faker.datatype.boolean() ? faker.helpers.arrayElement(this.templates)._id : null,
        tags: faker.helpers.arrayElements(['important', 'urgent', 'review', 'client', 'vendor'], 2),
        metadata: {
          department: createdBy.department,
          project: faker.company.buzzPhrase()
        }
      });
    }

    this.contracts = await Contract.insertMany(contracts);
    log.success(`Created ${this.contracts.length} contracts`);
  }

  async seedActivities() {
    log.info('Seeding activities...');

    const activities = [];
    const actions = [
      'contract.created',
      'contract.updated',
      'contract.viewed',
      'contract.signed',
      'contract.approved',
      'comment.added',
      'template.created'
    ];

    // Create activities for contracts
    for (const contract of this.contracts.slice(0, 10)) {
      activities.push({
        user: contract.createdBy,
        action: 'contract.created',
        resource: {
          type: 'contract',
          id: contract._id
        },
        details: {
          title: contract.title
        }
      });

      // Add some random activities
      for (let i = 0; i < faker.number.int({ min: 1, max: 5 }); i++) {
        activities.push({
          user: faker.helpers.arrayElement(this.users)._id,
          action: faker.helpers.arrayElement(actions),
          resource: {
            type: 'contract',
            id: contract._id
          },
          details: {
            title: contract.title,
            changes: faker.datatype.boolean() ? {
              status: { from: 'draft', to: 'pending_approval' }
            } : undefined
          },
          createdAt: faker.date.recent({ days: 30 })
        });
      }
    }

    await Activity.insertMany(activities);
    log.success(`Created ${activities.length} activities`);
  }

  async seedComments() {
    log.info('Seeding comments...');

    const comments = [];

    // Add comments to some contracts
    for (const contract of this.contracts.slice(0, 10)) {
      const numComments = faker.number.int({ min: 0, max: 5 });
      
      for (let i = 0; i < numComments; i++) {
        comments.push({
          contract: contract._id,
          author: faker.helpers.arrayElement(this.users)._id,
          text: faker.lorem.paragraph(),
          mentions: faker.datatype.boolean() ? [faker.helpers.arrayElement(this.users)._id] : [],
          attachments: faker.datatype.boolean() ? [{
            filename: faker.system.fileName(),
            url: faker.internet.url(),
            size: faker.number.int({ min: 1000, max: 5000000 })
          }] : [],
          createdAt: faker.date.recent({ days: 20 })
        });
      }
    }

    await Comment.insertMany(comments);
    log.success(`Created ${comments.length} comments`);
  }

  async run() {
    try {
      await this.connect();
      
      // Ask for confirmation in development
      if (process.env.NODE_ENV !== 'test') {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise(resolve => {
          readline.question('\n⚠️  This will delete all existing data. Continue? (yes/no) ', resolve);
        });

        readline.close();

        if (answer.toLowerCase() !== 'yes') {
          log.warning('Seeding cancelled');
          process.exit(0);
        }
      }

      await this.cleanDatabase();
      await this.seedUsers();
      await this.seedTemplates();
      await this.seedContracts();
      await this.seedActivities();
      await this.seedComments();

      console.log('\n' + '='.repeat(50));
      log.success('Database seeding completed!');
      console.log('='.repeat(50) + '\n');

      console.log('Test Credentials:');
      console.log('----------------');
      console.log('Admin: admin@example.com / Password123!');
      console.log('User: john.doe@example.com / Password123!');
      console.log('Manager: jane.smith@example.com / Password123!');

    } catch (error) {
      log.error('Seeding failed: ' + error.message);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.run();
}

module.exports = DatabaseSeeder;