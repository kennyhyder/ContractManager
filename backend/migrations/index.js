const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class MigrationRunner {
  constructor() {
    this.migrations = [];
    this.migrationModel = null;
  }

  async initialize() {
    // Define migration schema
    const migrationSchema = new mongoose.Schema({
      name: { type: String, required: true, unique: true },
      executedAt: { type: Date, default: Date.now },
      success: { type: Boolean, default: true },
      error: String,
      metadata: mongoose.Schema.Types.Mixed
    });

    this.migrationModel = mongoose.model('Migration', migrationSchema);
    
    // Load all migration files
    await this.loadMigrations();
  }

  async loadMigrations() {
    const migrationsDir = path.join(__dirname);
    const files = await fs.readdir(migrationsDir);
    
    const migrationFiles = files
      .filter(file => file.match(/^\d{3}-.*\.js$/) && file !== 'index.js')
      .sort();

    for (const file of migrationFiles) {
      const migration = require(path.join(migrationsDir, file));
      this.migrations.push({
        name: file,
        up: migration.up,
        down: migration.down,
        description: migration.description
      });
    }

    logger.info(`Loaded ${this.migrations.length} migrations`);
  }

  async run() {
    logger.info('Starting migration runner...');

    const executedMigrations = await this.migrationModel.find().select('name');
    const executedNames = executedMigrations.map(m => m.name);

    const pendingMigrations = this.migrations.filter(
      m => !executedNames.includes(m.name)
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    logger.info('All migrations completed');
  }

  async executeMigration(migration) {
    logger.info(`Executing migration: ${migration.name}`);
    logger.info(`Description: ${migration.description}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Execute migration
      const result = await migration.up(session);

      // Record successful migration
      await this.migrationModel.create([{
        name: migration.name,
        success: true,
        metadata: result
      }], { session });

      await session.commitTransaction();
      logger.info(`Migration ${migration.name} completed successfully`);
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Migration ${migration.name} failed:`, error);

      // Record failed migration
      await this.migrationModel.create({
        name: migration.name,
        success: false,
        error: error.message
      });

      throw error;
    } finally {
      session.endSession();
    }
  }

  async rollback(steps = 1) {
    logger.info(`Rolling back ${steps} migration(s)...`);

    const executedMigrations = await this.migrationModel
      .find({ success: true })
      .sort({ executedAt: -1 })
      .limit(steps);

    if (executedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    for (const executed of executedMigrations) {
      const migration = this.migrations.find(m => m.name === executed.name);
      if (!migration) {
        logger.warn(`Migration ${executed.name} not found in files`);
        continue;
      }

      await this.rollbackMigration(migration, executed);
    }

    logger.info('Rollback completed');
  }

  async rollbackMigration(migration, executedRecord) {
    logger.info(`Rolling back migration: ${migration.name}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Execute rollback
      await migration.down(session);

      // Remove migration record
      await this.migrationModel.deleteOne(
        { _id: executedRecord._id },
        { session }
      );

      await session.commitTransaction();
      logger.info(`Rollback of ${migration.name} completed successfully`);
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Rollback of ${migration.name} failed:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async status() {
    const executed = await this.migrationModel
      .find()
      .sort({ executedAt: 1 });

    const executedNames = executed.map(m => m.name);
    const pending = this.migrations.filter(
      m => !executedNames.includes(m.name)
    );

    console.log('\nMigration Status:');
    console.log('=================\n');

    console.log('Executed Migrations:');
    if (executed.length === 0) {
      console.log('  None');
    } else {
      executed.forEach(m => {
        const status = m.success ? '✓' : '✗';
        const date = m.executedAt.toISOString().split('T')[0];
        console.log(`  ${status} ${m.name} (${date})`);
      });
    }

    console.log('\nPending Migrations:');
    if (pending.length === 0) {
      console.log('  None');
    } else {
      pending.forEach(m => {
        console.log(`  - ${m.name}`);
      });
    }
  }
}

module.exports = MigrationRunner;