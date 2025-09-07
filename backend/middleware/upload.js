const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Configure S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * File type configurations
 */
const FILE_TYPES = {
  documents: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf'
    ],
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  images: {
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 5 * 1024 * 1024 // 5MB
  },
  spreadsheets: {
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ],
    extensions: ['.xls', '.xlsx', '.csv'],
    maxSize: 10 * 1024 * 1024 // 10MB
  }
};

/**
 * Get allowed file types
 */
const getAllowedTypes = (types) => {
  const allowed = { mimeTypes: [], extensions: [], maxSize: 0 };
  
  types.forEach(type => {
    if (FILE_TYPES[type]) {
      allowed.mimeTypes.push(...FILE_TYPES[type].mimeTypes);
      allowed.extensions.push(...FILE_TYPES[type].extensions);
      allowed.maxSize = Math.max(allowed.maxSize, FILE_TYPES[type].maxSize);
    }
  });
  
  return allowed;
};

/**
 * File filter factory
 */
const createFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    const allowed = getAllowedTypes(allowedTypes);
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowed.mimeTypes.includes(file.mimetype) || 
        !allowed.extensions.includes(ext)) {
      return cb(new multer.MulterError('INVALID_FILE_TYPE', 
        `File type not allowed. Allowed types: ${allowed.extensions.join(', ')}`));
    }
    
    cb(null, true);
  };
};

/**
 * S3 storage configuration
 */
const createS3Storage = (folder) => {
  return multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const userId = req.user?._id || 'anonymous';
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(16).toString('hex');
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${folder}/${userId}/${timestamp}-${randomString}${extension}`;
      cb(null, filename);
    },
    metadata: function (req, file, cb) {
      cb(null, {
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedBy: req.user?._id?.toString() || 'anonymous',
        uploadedAt: new Date().toISOString()
      });
    }
  });
};

/**
 * Local storage configuration (for development)
 */
const createLocalStorage = (folder) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadPath = path.join(__dirname, '../public/uploads', folder);
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(16).toString('hex');
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${timestamp}-${randomString}${extension}`;
      cb(null, filename);
    }
  });
};

/**
 * Create multer instance
 */
const createUploader = (options) => {
  const {
    folder = 'general',
    allowedTypes = ['documents', 'images'],
    maxFiles = 1,
    useS3 = process.env.NODE_ENV === 'production'
  } = options;
  
  const allowed = getAllowedTypes(allowedTypes);
  const storage = useS3 
    ? createS3Storage(folder)
    : createLocalStorage(folder);
  
  return multer({
    storage,
    fileFilter: createFileFilter(allowedTypes),
    limits: {
      fileSize: allowed.maxSize,
      files: maxFiles
    }
  });
};

/**
 * Upload middleware instances
 */
const uploaders = {
  // Contract documents
  contractDocument: createUploader({
    folder: 'contracts',
    allowedTypes: ['documents'],
    maxFiles: 1
  }),
  
  // Contract attachments (multiple)
  contractAttachments: createUploader({
    folder: 'contracts/attachments',
    allowedTypes: ['documents', 'images', 'spreadsheets'],
    maxFiles: 10
  }),
  
  // User avatar
  avatar: createUploader({
    folder: 'avatars',
    allowedTypes: ['images'],
    maxFiles: 1
  }),
  
  // Company logo
  companyLogo: createUploader({
    folder: 'company/logos',
    allowedTypes: ['images'],
    maxFiles: 1
  }),
  
  // Template documents
  templateDocument: createUploader({
    folder: 'templates',
    allowedTypes: ['documents'],
    maxFiles: 1
  })
};

/**
 * Error handling middleware
 */
const handleUploadError = (error, req, res, next) => {
  logger.error('Upload error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize: error.field
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES'
      });
    }
    
    if (error.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({
        error: error.message,
        code: 'INVALID_FILE_TYPE'
      });
    }
  }
  
  return res.status(500).json({
    error: 'Upload failed',
    code: 'UPLOAD_ERROR'
  });
};

/**
 * File cleanup middleware
 */
const cleanupFiles = (req, res, next) => {
  // Clean up uploaded files on response finish
  res.on('finish', () => {
    if (res.statusCode >= 400 && req.files) {
      // TODO: Delete uploaded files from S3/local storage
      logger.info('Cleaning up failed upload files');
    }
  });
  next();
};

module.exports = {
  uploaders,
  handleUploadError,
  cleanupFiles,
  createUploader
};