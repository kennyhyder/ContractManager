const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

// Import seeders
const userSeeder = require('./users');
const templateSeeder = require('./templates');
const contractSeeder = require('./contracts');

class Seeder {
  constructor() {
    this.seeders = {
      users: userSeeder,
      templates: templateSeeder,
      contracts: contractSeeder
    };
  }

  async seed(collections = null) {
    try {
      // Connect to database
      await config.database.connect();

      // Determine which collections to seed
      const collectionsToSeed = collections 
        ? collections.split(',').map(c => c.trim())
        : Object.keys(this.seeders);

      logger.info(`Seeding collections: ${collectionsToSeed.join(', ')}`);

      // Run seeders in order
      for (const collection of collectionsToSeed) {
        if (!this.seeders[collection]) {
          logger.warn(`No seeder found for collection: ${collection}`);
          continue;
        }

        logger.info(`Seeding ${collection}...`);
        const result = await this.seeders[collection].seed();
        logger.info(`${collection} seeded:`, result);
      }

      logger.info('Seeding completed successfully');
    } catch (error) {
      logger.error('Seeding failed:', error);
      throw error;
    }
  }

  async clean(collections = null) {
    try {
      // Connect to database
      await config.database.connect();

      // Determine which collections to clean
      const collectionsToClean = collections 
        ? collections.split(',').map(c => c.trim())
        : Object.keys(this.seeders);

      logger.info(`Cleaning collections: ${collectionsToClean.join(', ')}`);

      // Clean collections in reverse order
      for (const collection of collectionsToClean.reverse()) {
        if (!this.seeders[collection]) {
          logger.warn(`No seeder found for collection: ${collection}`);
          continue;
        }

        logger.info(`Cleaning ${collection}...`);
        const result = await this.seeders[collection].clean();
        logger.info(`${collection} cleaned:`, result);
      }

      logger.info('Cleaning completed successfully');
    } catch (error) {
      logger.error('Cleaning failed:', error);
      throw error;
    }
  }

  async reset() {
    logger.info('Resetting database...');
    await this.clean();
    await this.seed();
    logger.info('Database reset completed');
  }
}

module.exports = new Seeder();