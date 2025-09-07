#!/usr/bin/env node

require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const AWS = require('aws-sdk');
const moment = require('moment');
const logger = require('../utils/logger');

class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
  }

  async run() {
    try {
      console.log('🔄 Starting backup process...\n');

      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      const timestamp = moment().format('YYYY-MM-DD-HH-mm-ss');
      const backupName = `backup-${timestamp}`;

      // 1. Backup MongoDB
      console.log('📊 Backing up MongoDB...');
      const dbBackupPath = await this.backupMongoDB(backupName);
      console.log('✅ MongoDB backup completed');

      // 2. Backup uploaded files
      console.log('\n📁 Backing up uploaded files...');
      const filesBackupPath = await this.backupFiles(backupName);
      console.log('✅ Files backup completed');

      // 3. Create archive
      console.log('\n📦 Creating backup archive...');
      const archivePath = await this.createArchive(backupName, [dbBackupPath, filesBackupPath]);
      console.log('✅ Archive created');

      // 4. Upload to S3 if configured
      if (process.env.AWS_ACCESS_KEY_ID) {
        console.log('\n☁️  Uploading to S3...');
        await this.uploadToS3(archivePath, backupName);
        console.log('✅ Uploaded to S3');
      }

      // 5. Clean up old backups
      console.log('\n🧹 Cleaning up old backups...');
      await this.cleanupOldBackups();
      console.log('✅ Cleanup completed');

      console.log('\n✅ Backup process completed successfully');
      console.log(`📍 Backup location: ${archivePath}`);

      // 6. Send notification
      await this.sendNotification(backupName, archivePath);

      process.exit(0);
    } catch (error) {
      console.error('❌ Backup failed:', error);
      logger.error('Backup error:', error);
      process.exit(1);
    }
  }

  async backupMongoDB(backupName) {
    const dbBackupPath = path.join(this.backupDir, backupName, 'database');
    await fs.mkdir(dbBackupPath, { recursive: true });

    return new Promise((resolve, reject) => {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management';
      const args = [
        '--uri', uri,
        '--out', dbBackupPath,
        '--gzip'
      ];

      const mongodump = spawn('mongodump', args);

      mongodump.stdout.on('data', (data) => {
        console.log(`  ${data.toString().trim()}`);
      });

      mongodump.stderr.on('data', (data) => {
        console.error(`  ${data.toString().trim()}`);
      });

      mongodump.on('close', (code) => {
        if (code === 0) {
          resolve(dbBackupPath);
        } else {
          reject(new Error(`mongodump exited with code ${code}`));
        }
      });
    });
  }

  async backupFiles(backupName) {
    const filesBackupPath = path.join(this.backupDir, backupName, 'files');
    const uploadsPath = path.join(__dirname, '../public/uploads');

    await fs.mkdir(filesBackupPath, { recursive: true });

    // Copy uploads directory
    await this.copyDirectory(uploadsPath, path.join(filesBackupPath, 'uploads'));

    return filesBackupPath;
  }

  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async createArchive(backupName, paths) {
    const archivePath = path.join(this.backupDir, `${backupName}.zip`);
    const output = require('fs').createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(archivePath));
      archive.on('error', reject);

      archive.pipe(output);

      // Add all backup paths to archive
      for (const backupPath of paths) {
        const name = path.basename(backupPath);
        archive.directory(backupPath, name);
      }

      archive.finalize();
    });
  }

  async uploadToS3(filePath, backupName) {
    const fileContent = await fs.readFile(filePath);
    const params = {
      Bucket: process.env.AWS_S3_BACKUP_BUCKET || process.env.AWS_S3_BUCKET,
      Key: `backups/${backupName}.zip`,
      Body: fileContent,
      ServerSideEncryption: 'AES256'
    };

    await this.s3.upload(params).promise();
  }

  async cleanupOldBackups() {
    const files = await fs.readdir(this.backupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.zip'));
    
    // Keep only last 7 backups locally
    const maxLocalBackups = 7;
    if (backupFiles.length > maxLocalBackups) {
      const sortedFiles = backupFiles.sort();
      const filesToDelete = sortedFiles.slice(0, -maxLocalBackups);
      
      for (const file of filesToDelete) {
        await fs.unlink(path.join(this.backupDir, file));
        console.log(`  Deleted old backup: ${file}`);
      }
    }

    // Clean up temporary directories
    const dirs = files.filter(f => f.startsWith('backup-') && !f.endsWith('.zip'));
    for (const dir of dirs) {
      await fs.rm(path.join(this.backupDir, dir), { recursive: true, force: true });
    }
  }

  async sendNotification(backupName, archivePath) {
    // Send email notification if configured
    if (process.env.BACKUP_NOTIFICATION_EMAIL) {
      const stats = await fs.stat(archivePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      await require('../config/email').sendMail({
        to: process.env.BACKUP_NOTIFICATION_EMAIL,
        subject: `Backup Completed: ${backupName}`,
        template: 'backup-notification',
        context: {
          backupName,
          size: `${sizeMB} MB`,
          timestamp: new Date().toISOString(),
          location: archivePath
        }
      });
    }
  }
}

// Run backup
if (require.main === module) {
  const backupManager = new BackupManager();
  backupManager.run();
}

module.exports = BackupManager;