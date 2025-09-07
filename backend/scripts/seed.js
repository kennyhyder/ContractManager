#!/usr/bin/env node

require('dotenv').config();
const seeder = require('../seeders');
const logger = require('../utils/logger');

async function run() {
  try {
    const args = process.argv.slice(2);
    const command = args[0] || 'seed';
    const collections = args[1] || null;

    console.log('🌱 Contract Management System - Database Seeder\n');

    switch (command) {
      case 'seed':
        console.log('Seeding database...');
        await seeder.seed(collections);
        break;
      
      case 'clean':
        console.log('Cleaning database...');
        await seeder.clean(collections);
        break;
      
      case 'reset':
        console.log('Resetting database...');
        await seeder.reset();
        break;
      
      default:
        console.error(`Unknown command: ${command}`);
        console.log('\nUsage:');
        console.log('  npm run seed [command] [collections]');
        console.log('\nCommands:');
        console.log('  seed    - Seed the database (default)');
        console.log('  clean   - Clean seeded data');
        console.log('  reset   - Clean and reseed');
        console.log('\nExamples:');
        console.log('  npm run seed');
        console.log('  npm run seed seed users,templates');
        console.log('  npm run seed clean contracts');
        console.log('  npm run seed reset');
        process.exit(1);
    }

    console.log('\n✅ Operation completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Operation failed:', error.message);
    logger.error('Seeder error:', error);
    process.exit(1);
  }
}

run();