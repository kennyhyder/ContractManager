#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

const services = [
  {
    name: 'API Server',
    url: 'http://localhost:5000/api/health',
    critical: true
  },
  {
    name: 'MongoDB',
    check: async () => {
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management');
      const result = await mongoose.connection.db.admin().ping();
      await mongoose.disconnect();
      return result;
    },
    critical: true
  },
  {
    name: 'Redis',
    check: async () => {
      const redis = require('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();
      await client.ping();
      await client.quit();
      return true;
    },
    critical: false
  },
  {
    name: 'Email Service',
    check: async () => {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      await transporter.verify();
      return true;
    },
    critical: false
  }
];

async function checkService(service) {
  const start = Date.now();
  
  try {
    if (service.url) {
      const response = await axios.get(service.url, { timeout: 5000 });
      const responseTime = Date.now() - start;
      return {
        name: service.name,
        status: 'healthy',
        responseTime,
        details: response.data
      };
    } else if (service.check) {
      await service.check();
      const responseTime = Date.now() - start;
      return {
        name: service.name,
        status: 'healthy',
        responseTime
      };
    }
  } catch (error) {
    return {
      name: service.name,
      status: 'unhealthy',
      error: error.message,
      critical: service.critical
    };
  }
}

async function runHealthCheck() {
  console.log(chalk.bold.blue('\n🏥 Contract Management System - Health Check\n'));
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const results = await Promise.all(services.map(checkService));
  
  let allHealthy = true;
  let criticalFailure = false;

  results.forEach(result => {
    const statusIcon = result.status === 'healthy' ? '✅' : '❌';
    const statusColor = result.status === 'healthy' ? chalk.green : chalk.red;
    
    console.log(`${statusIcon} ${chalk.bold(result.name)}`);
    console.log(`   Status: ${statusColor(result.status.toUpperCase())}`);
    
    if (result.responseTime) {
      console.log(`   Response Time: ${result.responseTime}ms`);
    }
    
    if (result.error) {
      console.log(`   Error: ${chalk.red(result.error)}`);
      allHealthy = false;
      if (result.critical) {
        criticalFailure = true;
      }
    }
    
    console.log();
  });

  // Summary
  console.log(chalk.bold('\nSummary:'));
  if (allHealthy) {
    console.log(chalk.green('✅ All services are healthy'));
    process.exit(0);
  } else if (criticalFailure) {
    console.log(chalk.red('❌ Critical services are down'));
    process.exit(2);
  } else {
    console.log(chalk.yellow('⚠️  Some non-critical services are down'));
    process.exit(1);
  }
}

// Handle missing dependencies gracefully
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Health check failed:'), error.message);
  process.exit(2);
});

runHealthCheck();