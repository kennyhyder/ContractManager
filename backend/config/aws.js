const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const logger = require('../utils/logger');

class AWSConfig {
  constructor() {
    this.s3 = null;
    this.bucketName = process.env.AWS_S3_BUCKET;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    try {
      // Configure AWS SDK
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });

      // Create S3 instance
      this.s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        signatureVersion: 'v4',
      });

      this.initialized = true;
      logger.info('AWS S3 configured successfully');
    } catch (error) {
      logger.error('Failed to configure AWS:', error);
      throw error;
    }
  }

  // Create multer upload middleware
  createUploadMiddleware(options = {}) {
    this.initialize();

    const {
      fieldName = 'file',
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls'],
      folder = 'uploads'
    } = options;

    return multer({
      storage: multerS3({
        s3: this.s3,
        bucket: this.bucketName,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (req, file, cb) => {
          cb(null, {
            uploadedBy: req.user ? req.user.id : 'anonymous',
            originalName: file.originalname,
            uploadTime: new Date().toISOString(),
          });
        },
        key: (req, file, cb) => {
          const fileExtension = path.extname(file.originalname);
          const fileName = `${folder}/${uuidv4()}${fileExtension}`;
          cb(null, fileName);
        },
        serverSideEncryption: 'AES256',
      }),
      limits: {
        fileSize: maxSize,
      },
      fileFilter: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
        
        if (allowedTypes.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${fileExtension} is not allowed`), false);
        }
      },
    }).single(fieldName);
  }

  // Upload file directly to S3
  async uploadFile(file, options = {}) {
    this.initialize();

    const {
      folder = 'uploads',
      isPublic = false,
      metadata = {}
    } = options;

    const fileKey = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;

    const params = {
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256',
      Metadata: {
        ...metadata,
        originalName: file.originalname,
        uploadTime: new Date().toISOString(),
      },
    };

    if (isPublic) {
      params.ACL = 'public-read';
    }

    try {
      const result = await this.s3.upload(params).promise();
      
      return {
        key: result.Key,
        location: result.Location,
        etag: result.ETag,
        bucket: result.Bucket,
        size: file.size,
        mimetype: file.mimetype,
        originalName: file.originalname,
      };
    } catch (error) {
      logger.error('Failed to upload file to S3:', error);
      throw error;
    }
  }

  // Get signed URL for file access
  async getSignedUrl(fileKey, options = {}) {
    this.initialize();

    const {
      expires = 3600, // 1 hour default
      download = false,
      filename
    } = options;

    const params = {
      Bucket: this.bucketName,
      Key: fileKey,
      Expires: expires,
    };

    if (download && filename) {
      params.ResponseContentDisposition = `attachment; filename="${filename}"`;
    }

    try {
      return await this.s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      logger.error('Failed to generate signed URL:', error);
      throw error;
    }
  }

  // Delete file from S3
  async deleteFile(fileKey) {
    this.initialize();

    const params = {
      Bucket: this.bucketName,
      Key: fileKey,
    };

    try {
      await this.s3.deleteObject(params).promise();
      logger.info(`File deleted from S3: ${fileKey}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete file from S3:', error);
      throw error;
    }
  }

  // Delete multiple files
  async deleteFiles(fileKeys) {
    this.initialize();

    if (!fileKeys || fileKeys.length === 0) return;

    const params = {
      Bucket: this.bucketName,
      Delete: {
        Objects: fileKeys.map(key => ({ Key: key })),
        Quiet: false,
      },
    };

    try {
      const result = await this.s3.deleteObjects(params).promise();
      logger.info(`Deleted ${result.Deleted.length} files from S3`);
      return result;
    } catch (error) {
      logger.error('Failed to delete files from S3:', error);
      throw error;
    }
  }

  // Copy file within S3
  async copyFile(sourceKey, destinationKey) {
    this.initialize();

    const params = {
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourceKey}`,
      Key: destinationKey,
      ServerSideEncryption: 'AES256',
    };

    try {
      const result = await this.s3.copyObject(params).promise();
      return {
        key: destinationKey,
        etag: result.CopyObjectResult.ETag,
      };
    } catch (error) {
      logger.error('Failed to copy file in S3:', error);
      throw error;
    }
  }

  // Check if file exists
  async fileExists(fileKey) {
    this.initialize();

    try {
      await this.s3.headObject({
        Bucket: this.bucketName,
        Key: fileKey,
      }).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  // Get file metadata
  async getFileMetadata(fileKey) {
    this.initialize();

    try {
      const result = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: fileKey,
      }).promise();

      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata,
        serverSideEncryption: result.ServerSideEncryption,
      };
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  // List files with prefix
  async listFiles(prefix, options = {}) {
    this.initialize();

    const {
      maxKeys = 1000,
      continuationToken
    } = options;

    const params = {
      Bucket: this.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
    };

    if (continuationToken) {
      params.ContinuationToken = continuationToken;
    }

    try {
      const result = await this.s3.listObjectsV2(params).promise();
      
      return {
        files: result.Contents.map(item => ({
          key: item.Key,
          size: item.Size,
          lastModified: item.LastModified,
          etag: item.ETag,
        })),
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken,
      };
    } catch (error) {
      logger.error('Failed to list files from S3:', error);
      throw error;
    }
  }

  // Create presigned POST data for direct browser uploads
  async createPresignedPost(options = {}) {
    this.initialize();

    const {
      folder = 'uploads',
      expires = 3600,
      conditions = [],
      fields = {}
    } = options;

    const fileKey = `${folder}/${uuidv4()}`;

    const params = {
      Bucket: this.bucketName,
      Expires: expires,
      Conditions: [
        ['content-length-range', 0, 50 * 1024 * 1024], // 50MB max
        ['starts-with', '$key', fileKey],
        ...conditions
      ],
      Fields: {
        key: fileKey,
        'x-amz-server-side-encryption': 'AES256',
        ...fields
      }
    };

    try {
      return await new Promise((resolve, reject) => {
        this.s3.createPresignedPost(params, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    } catch (error) {
      logger.error('Failed to create presigned POST:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    this.initialize();

    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      return { status: 'healthy', message: 'S3 bucket is accessible' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }
}

module.exports = new AWSConfig();