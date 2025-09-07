const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { Contract, User } = require('../models');
const logger = require('../utils/logger');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

class FileService {
  /**
   * Upload file to S3
   */
  async uploadFile(file, options = {}) {
    try {
      const {
        folder = 'general',
        userId,
        resize,
        optimize = true
      } = options;

      let fileBuffer = file.buffer;
      let contentType = file.mimetype;

      // Process image if needed
      if (file.mimetype.startsWith('image/') && (resize || optimize)) {
        fileBuffer = await this.processImage(fileBuffer, { resize, optimize });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(16).toString('hex');
      const extension = path.extname(file.originalname);
      const key = `${folder}/${userId || 'system'}/${timestamp}-${randomString}${extension}`;

      // Upload to S3
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'private',
        Metadata: {
          originalName: file.originalname,
          uploadedBy: userId || 'system',
          uploadedAt: new Date().toISOString()
        }
      };

      const result = await s3.upload(params).promise();

      // Create file record
      const fileRecord = {
        url: result.Location,
        key: result.Key,
        bucket: result.Bucket,
        size: fileBuffer.length,
        mimetype: contentType,
        originalName: file.originalname,
        uploadedBy: userId,
        uploadedAt: new Date()
      };

      logger.info('File uploaded successfully:', fileRecord);

      return fileRecord;
    } catch (error) {
      logger.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(fileUrl) {
    try {
      // Extract key from URL
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        throw new Error('Invalid file URL');
      }

      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      };

      await s3.deleteObject(params).promise();

      logger.info('File deleted successfully:', key);

      return { success: true };
    } catch (error) {
      logger.error('File delete error:', error);
      throw error;
    }
  }

  /**
   * Get signed URL for private file access
   */
  async getSignedUrl(fileUrl, expiresIn = 3600) {
    try {
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        throw new Error('Invalid file URL');
      }

      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Expires: expiresIn
      };

      const signedUrl = await s3.getSignedUrlPromise('getObject', params);

      return signedUrl;
    } catch (error) {
      logger.error('Get signed URL error:', error);
      throw error;
    }
  }

  /**
   * Copy file
   */
  async copyFile(sourceUrl, destinationFolder) {
    try {
      const sourceKey = this.extractKeyFromUrl(sourceUrl);
      if (!sourceKey) {
        throw new Error('Invalid source URL');
      }

      const timestamp = Date.now();
      const randomString = crypto.randomBytes(16).toString('hex');
      const extension = path.extname(sourceKey);
      const destinationKey = `${destinationFolder}/${timestamp}-${randomString}${extension}`;

      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        CopySource: `${process.env.AWS_S3_BUCKET}/${sourceKey}`,
        Key: destinationKey,
        ACL: 'private'
      };

      const result = await s3.copyObject(params).promise();

      return {
        url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${destinationKey}`,
        key: destinationKey
      };
    } catch (error) {
      logger.error('File copy error:', error);
      throw error;
    }
  }

  /**
   * Move file
   */
  async moveFile(sourceUrl, destinationFolder) {
    try {
      // Copy file
      const copyResult = await this.copyFile(sourceUrl, destinationFolder);

      // Delete original
      await this.deleteFile(sourceUrl);

      return copyResult;
    } catch (error) {
      logger.error('File move error:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileUrl) {
    try {
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        throw new Error('Invalid file URL');
      }

      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      };

      const result = await s3.headObject(params).promise();

      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        metadata: result.Metadata
      };
    } catch (error) {
      logger.error('Get file metadata error:', error);
      throw error;
    }
  }

  /**
   * Process image (resize, optimize)
   */
  async processImage(buffer, options = {}) {
    try {
      let image = sharp(buffer);

      // Get metadata
      const metadata = await image.metadata();

      // Resize if specified
      if (options.resize) {
        const { width, height, fit = 'cover' } = options.resize;
        image = image.resize(width, height, { fit });
      }

      // Optimize
      if (options.optimize) {
        switch (metadata.format) {
          case 'jpeg':
          case 'jpg':
            image = image.jpeg({ quality: 85, progressive: true });
            break;
          case 'png':
            image = image.png({ quality: 85, compressionLevel: 9 });
            break;
          case 'webp':
            image = image.webp({ quality: 85 });
            break;
        }
      }

      return await image.toBuffer();
    } catch (error) {
      logger.error('Image processing error:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail
   */
  async generateThumbnail(fileUrl, options = {}) {
    try {
      const {
        width = 200,
        height = 200,
        fit = 'cover'
      } = options;

      // Download file from S3
      const key = this.extractKeyFromUrl(fileUrl);
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      };

      const data = await s3.getObject(params).promise();
      
      // Process image
      const thumbnail = await sharp(data.Body)
        .resize(width, height, { fit })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload thumbnail
      const thumbnailKey = key.replace(/(\.[^.]+)$/, '-thumb$1');
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: thumbnailKey,
        Body: thumbnail,
        ContentType: 'image/jpeg',
        ACL: 'private'
      };

      const result = await s3.upload(uploadParams).promise();

      return {
        url: result.Location,
        key: result.Key
      };
    } catch (error) {
      logger.error('Generate thumbnail error:', error);
      throw error;
    }
  }

  /**
   * Bulk delete files
   */
  async bulkDeleteFiles(fileUrls) {
    try {
      const keys = fileUrls.map(url => this.extractKeyFromUrl(url)).filter(Boolean);

      if (keys.length === 0) {
        return { success: true, deleted: 0 };
      }

      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const result = await s3.deleteObjects(params).promise();

      logger.info(`Bulk deleted ${result.Deleted.length} files`);

      return {
        success: true,
        deleted: result.Deleted.length,
        errors: result.Errors
      };
    } catch (error) {
      logger.error('Bulk delete error:', error);
      throw error;
    }
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(userId) {
    try {
      // This would typically query a database that tracks file uploads
      // For now, we'll calculate from S3
      const prefix = userId ? `${userId}/` : '';
      
      let totalSize = 0;
      let fileCount = 0;
      let continuationToken;

      do {
        const params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken
        };

        const result = await s3.listObjectsV2(params).promise();

        result.Contents.forEach(object => {
          totalSize += object.Size;
          fileCount++;
        });

        continuationToken = result.NextContinuationToken;
      } while (continuationToken);

      return {
        totalSize,
        fileCount,
        formattedSize: this.formatFileSize(totalSize)
      };
    } catch (error) {
      logger.error('Get storage usage error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  extractKeyFromUrl(fileUrl) {
    try {
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      return pathParts.slice(1).join('/');
    } catch (error) {
      return null;
    }
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Create multer upload middleware
   */
  createUploadMiddleware(options = {}) {
    const {
      folder = 'uploads',
      allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize = 10 * 1024 * 1024 // 10MB
    } = options;

    return multer({
      storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET,
        acl: 'private',
        key: (req, file, cb) => {
          const userId = req.user?._id || 'anonymous';
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(16).toString('hex');
          const extension = path.extname(file.originalname);
          const key = `${folder}/${userId}/${timestamp}-${randomString}${extension}`;
          cb(null, key);
        },
        metadata: (req, file, cb) => {
          cb(null, {
            fieldName: file.fieldname,
            originalName: file.originalname,
            uploadedBy: req.user?._id?.toString() || 'anonymous'
          });
        }
      }),
      fileFilter: (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
        }
      },
      limits: {
        fileSize: maxSize
      }
    });
  }
}

module.exports = new FileService();