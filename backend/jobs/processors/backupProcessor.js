const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const config = require('../../config');
const logger = require('../../utils/logger');
const moment = require('moment');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

module.exports = {
  async backupDatabase(job) {
    const { includeFiles = true } = job.data;

    try {
      logger.info('Starting database backup');

      const timestamp = moment().format('YYYY-MM-DD-HH-mm-ss');
      const backupDir = path.join(__dirname, '../../backups', timestamp);
      
      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true });

      // Backup MongoDB
      const dbBackupPath = path.join(backupDir, 'database');
      await this.backupMongoDB(dbBackupPath);

      // Backup files if requested
      let filesBackupPath;
      if (includeFiles) {
        filesBackupPath = path.join(backupDir, 'files');
        await this.backupFiles(filesBackupPath);
      }

      // Create archive
      const archivePath = path.join(backupDir, '..', `backup-${timestamp}.zip`);
      await this.createArchive(backupDir, archivePath);

      // Upload to S3
      let s3Location;
      if (process.env.AWS_ACCESS_KEY_ID) {
        s3Location = await this.uploadBackup(archivePath, timestamp);
      }

      // Clean up local files (keep last 7 days)
      await this.cleanupOldBackups(7);

      // Send notification
      await this.sendBackupNotification({
        timestamp,
        location: s3Location || archivePath,
        size: (await fs.stat(archivePath)).size
      });

      logger.info(`Database backup completed: ${archivePath}`);
      return {
        timestamp,
        location: s3Location || archivePath,
        includesFiles: includeFiles
      };
    } catch (error) {
      logger.error('Database backup failed:', error);
      throw error;
    }
  },

  async backupMongoDB(outputPath) {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management';
    
    // Use mongodump
    const command = `mongodump --uri="${uri}" --out="${outputPath}" --gzip`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr) {
        logger.warn('mongodump warnings:', stderr);
      }
      logger.info('MongoDB backup completed');
    } catch (error) {
      // Fallback to manual backup if mongodump not available
      logger.warn('mongodump failed, using manual backup:', error.message);
      await this.manualMongoBackup(outputPath);
    }
  },

  async manualMongoBackup(outputPath) {
    await fs.mkdir(outputPath, { recursive: true });

    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collectionInfo of collections) {
      const collection = mongoose.connection.db.collection(collectionInfo.name);
      const documents = await collection.find({}).toArray();
      
      const filePath = path.join(outputPath, `${collectionInfo.name}.json`);
      await fs.writeFile(filePath, JSON.stringify(documents, null, 2));
    }
  },

  async backupFiles(outputPath) {
    await fs.mkdir(outputPath, { recursive: true });

    // Backup uploaded files
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    await this.copyDirectory(uploadsDir, path.join(outputPath, 'uploads'));

    // Backup email templates
    const templatesDir = path.join(__dirname, '../../templates');
    await this.copyDirectory(templatesDir, path.join(outputPath, 'templates'));
  },

  async copyDirectory(source, destination) {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  },

  async createArchive(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(outputPath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  },

  async uploadBackup(filePath, timestamp) {
    const fileBuffer = await fs.readFile(filePath);
    
    const result = await config.aws.uploadFile(
      {
        buffer: fileBuffer,
        originalname: `backup-${timestamp}.zip`,
        mimetype: 'application/zip'
      },
      {
        folder: 'backups',
        metadata: {
          type: 'full-backup',
          timestamp,
          automated: 'true'
        }
      }
    );

    return result.location;
  },

  async cleanupOldBackups(keepDays) {
    const backupsDir = path.join(__dirname, '../../backups');
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);

    try {
      const files = await fs.readdir(backupsDir);
      
      for (const file of files) {
        if (file.startsWith('backup-') && file.endsWith('.zip')) {
          const filePath = path.join(backupsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtimeMs < cutoffTime) {
            await fs.unlink(filePath);
            logger.info(`Deleted old backup: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
    }
  },

  async sendBackupNotification(details) {
    if (!process.env.BACKUP_NOTIFICATION_EMAIL) return;

    await config.email.sendMail({
      to: process.env.BACKUP_NOTIFICATION_EMAIL,
      subject: `Database Backup Completed - ${details.timestamp}`,
      template: 'backup-notification',
      context: {
        ...details,
        sizeFormatted: this.formatBytes(details.size)
      }
    });
  },

  async restoreBackup(job) {
    const { backupPath, timestamp } = job.data;

    try {
      logger.warn(`Starting database restore from ${timestamp}`);

      // Download backup if from S3
      let localPath = backupPath;
      if (backupPath.startsWith('https://')) {
        localPath = await this.downloadBackup(backupPath);
      }

      // Extract archive
      const extractPath = path.join(__dirname, '../../temp/restore', timestamp);
      await this.extractArchive(localPath, extractPath);

      // Restore MongoDB
      const dbPath = path.join(extractPath, 'database');
      await this.restoreMongoDB(dbPath);

      // Restore files if included
      const filesPath = path.join(extractPath, 'files');
      if (await this.pathExists(filesPath)) {
        await this.restoreFiles(filesPath);
      }

      // Clean up
      await fs.rm(extractPath, { recursive: true, force: true });

      logger.info(`Database restore completed from ${timestamp}`);
      return { success: true, timestamp };
    } catch (error) {
      logger.error('Database restore failed:', error);
      throw error;
    }
  },

  async restoreMongoDB(backupPath) {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management';
    
    try {
      // Use mongorestore
      const command = `mongorestore --uri="${uri}" --dir="${backupPath}" --gzip --drop`;
      await execAsync(command);
    } catch (error) {
      // Fallback to manual restore
      logger.warn('mongorestore failed, using manual restore:', error.message);
      await this.manualMongoRestore(backupPath);
    }
  },

  async manualMongoRestore(backupPath) {
    const files = await fs.readdir(backupPath);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const collectionName = file.replace('.json', '');
        const filePath = path.join(backupPath, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        const collection = mongoose.connection.db.collection(collectionName);
        await collection.deleteMany({});
        
        if (data.length > 0) {
          await collection.insertMany(data);
        }
      }
    }
  },

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  async pathExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
};