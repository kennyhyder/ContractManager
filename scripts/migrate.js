#!/usr/bin/env node
// scripts/migrate.js

const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Migration configuration
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATION_COLLECTION = 'migrations';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
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

class MigrationRunner {
  constructor() {
    this.connection = null;
    this.MigrationModel = null;
  }

  async connect() {
    try {
      log.info('Connecting to database...');
      
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management';
      this.connection = await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      // Define migration schema
      const migrationSchema = new mongoose.Schema({
        name: { type: String, required: true, unique: true },
        appliedAt: { type: Date, default: Date.now }
      });

      this.MigrationModel = mongoose.model('Migration', migrationSchema, MIGRATION_COLLECTION);
      
      log.success('Database connected');
    } catch (error) {
      log.error('Database connection failed: ' + error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      log.info('Database disconnected');
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(MIGRATIONS_DIR);
      return files
        .filter(f => f.endsWith('.js'))
        .sort();
    } catch (error) {
      log.error('Failed to read migrations directory');
      return [];
    }
  }

  async getAppliedMigrations() {
    const migrations = await this.MigrationModel.find().sort({ name: 1 });
    return migrations.map(m => m.name);
  }

  async runMigration(filename) {
    const migrationPath = path.join(MIGRATIONS_DIR, filename);
    
    try {
      log.info(`Running migration: ${filename}`);
      
      const migration = require(migrationPath);
      
      if (typeof migration.up !== 'function') {
        throw new Error('Migration must export an "up" function');
      }

      // Run the migration
      await migration.up(mongoose.connection.db, mongoose);
      
      // Record migration as applied
      await this.MigrationModel.create({ name: filename });
      
      log.success(`Migration completed: ${filename}`);
    } catch (error) {
      log.error(`Migration failed: ${filename} - ${error.message}`);
      throw error;
    }
  }

  async rollbackMigration(filename) {
    const migrationPath = path.join(MIGRATIONS_DIR, filename);
    
    try {
      log.info(`Rolling back migration: ${filename}`);
      
      const migration = require(migrationPath);
      
      if (typeof migration.down !== 'function') {
        throw new Error('Migration must export a "down" function for rollback');
      }

      // Run the rollback
      await migration.down(mongoose.connection.db, mongoose);
      
      // Remove migration record
      await this.MigrationModel.deleteOne({ name: filename });
      
      log.success(`Rollback completed: ${filename}`);
    } catch (error) {
      log.error(`Rollback failed: ${filename} - ${error.message}`);
      throw error;
    }
  }

  async up() {
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    
    const pendingMigrations = migrationFiles.filter(
      file => !appliedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      log.info('No pending migrations');
      return;
    }

    log.info(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    log.success('All migrations completed');
  }

  async down(steps = 1) {
    const appliedMigrations = await this.getAppliedMigrations();
    
    if (appliedMigrations.length === 0) {
      log.info('No migrations to rollback');
      return;
    }

    const migrationsToRollback = appliedMigrations
      .reverse()
      .slice(0, steps);

    log.info(`Rolling back ${migrationsToRollback.length} migration(s)`);

    for (const migration of migrationsToRollback) {
      await this.rollbackMigration(migration);
    }

    log.success('Rollback completed');
  }

  async status() {
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();

    console.log('\nMigration Status:');
    console.log('=================\n');

    for (const file of migrationFiles) {
      const isApplied = appliedMigrations.includes(file);
      const status = isApplied ? 
        `${colors.green}[✓ Applied]${colors.reset}` : 
        `${colors.yellow}[  Pending]${colors.reset}`;
      
      console.log(`${status} ${file}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${migrationFiles.length} | Applied: ${appliedMigrations.length} | Pending: ${migrationFiles.length - appliedMigrations.length}`);
  }

  async create(name) {
    if (!name) {
      log.error('Please provide a migration name');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const filename = `${timestamp}-${name.toLowerCase().replace(/\s+/g, '-')}.js`;
    const filepath = path.join(MIGRATIONS_DIR, filename);

    const template = `// Migration: ${filename}
// Description: ${name}

module.exports = {
  async up(db, mongoose) {
    // Write migration code here
    // Example:
    // await db.collection('users').createIndex({ email: 1 }, { unique: true });
  },

  async down(db, mongoose) {
    // Write rollback code here
    // Example:
    // await db.collection('users').dropIndex('email_1');
  }
};
`;

    try {
      await fs.writeFile(filepath, template);
      log.success(`Created migration: ${filename}`);
    } catch (error) {
      log.error('Failed to create migration: ' + error.message);
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  const runner = new MigrationRunner();

  try {
    await runner.connect();

    switch (command) {
      case 'up':
        await runner.up();
        break;
      
      case 'down':
        await runner.down(arg ? parseInt(arg) : 1);
        break;
      
      case 'status':
        await runner.status();
        break;
      
      case 'create':
        await runner.create(arg);
        break;
      
      default:
        console.log(`
Contract Management System - Migration Tool

Usage:
  npm run migrate <command> [options]

Commands:
  up              Run all pending migrations
  down [steps]    Rollback migrations (default: 1)
  status          Show migration status
  create <name>   Create a new migration file

Examples:
  npm run migrate up
  npm run migrate down 2
  npm run migrate create "add-user-roles"
  npm run migrate status
        `);
    }
  } catch (error) {
    log.error('Migration error: ' + error.message);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationRunner;