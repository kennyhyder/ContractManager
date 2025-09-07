#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function resetDatabase() {
  try {
    console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!\n');
    
    const environment = process.env.NODE_ENV || 'development';
    console.log(`Environment: ${environment}`);
    console.log(`Database: ${process.env.MONGODB_URI}\n`);

    if (environment === 'production') {
      console.log('🚨 PRODUCTION DATABASE DETECTED! 🚨\n');
      const confirm1 = await prompt('Are you ABSOLUTELY sure you want to reset the PRODUCTION database? (yes/no): ');
      if (confirm1.toLowerCase() !== 'yes') {
        console.log('Operation cancelled.');
        process.exit(0);
      }

      const dbName = await prompt('Please type the database name to confirm: ');
      const expectedName = process.env.MONGODB_URI.split('/').pop().split('?')[0];
      if (dbName !== expectedName) {
        console.log('Database name does not match. Operation cancelled.');
        process.exit(0);
      }
    } else {
      const confirm = await prompt('Are you sure you want to reset the database? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('Operation cancelled.');
process.exit(0);
      }
    }

    console.log('\nConnecting to database...');
    await config.database.connect();

    console.log('Dropping all collections...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      console.log(`  Dropping ${collection.name}...`);
      await mongoose.connection.db.dropCollection(collection.name);
    }

    console.log('\n✅ Database reset completed successfully');
    console.log('\nNext steps:');
    console.log('  1. Run migrations: npm run migrate');
    console.log('  2. Seed database: npm run seed');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database reset failed:', error.message);
    logger.error('Database reset error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the reset
resetDatabase();