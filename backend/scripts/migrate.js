#!/usr/bin/env node

require('dotenv').config();
const config = require('../config');
const MigrationRunner = require('../migrations');
const logger = require('../utils/logger');

async function run() {
  try {
    const args = process.argv.slice(2);
    const command = args[0] || 'up';

    console.log('🔄 Contract Management System - Database Migrations\n');

    // Initialize database connection
    await config.database.connect();

    // Initialize migration runner
    const runner = new MigrationRunner();
    await runner.initialize();

    switch (command) {
      case 'up':
        console.log('Running pending migrations...');
        await runner.run();
        break;
      
      case 'down':
      case 'rollback':
        const steps = parseInt(args[1]) || 1;
        console.log(`Rolling back ${steps} migration(s)...`);
        await runner.rollback(steps);
        break;
      
      case 'status':
        await runner.status();
        break;
      
      default:
        console.error(`Unknown command: ${command}`);
        console.log('\nUsage:');
        console.log('  npm run migrate [command] [options]');
        console.log('\nCommands:');
        console.log('  up       - Run pending migrations (default)');
        console.log('  down     - Rollback migrations');
        console.log('  rollback - Rollback migrations (alias for down)');
        console.log('  status   - Show migration status');
        console.log('\nExamples:');
        console.log('  npm run migrate');
        console.log('  npm run migrate up');
        console.log('  npm run migrate down 2');
        console.log('  npm run migrate status');
        process.exit(1);
    }

    console.log('\n✅ Migration operation completed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    logger.error('Migration error:', error);
    process.exit(1);
  }
}

run();