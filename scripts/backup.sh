#!/bin/bash
# scripts/backup.sh

# Backup configuration
BACKUP_DIR="/var/backups/contract-management"
S3_BUCKET=${BACKUP_S3_BUCKET:-"contract-management-backups"}
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}→ $1${NC}"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run with sudo"
    exit 1
fi

echo "🔒 Contract Management System - Backup"
echo "====================================="
echo "Timestamp: $TIMESTAMP"
echo ""

# Create backup directory
mkdir -p $BACKUP_DIR/$TIMESTAMP
cd $BACKUP_DIR/$TIMESTAMP

# 1. Database backup
print_info "Backing up MongoDB database..."

MONGO_URI=${MONGODB_URI:-"mongodb://localhost:27017/contract-management"}
mongodump --uri="$MONGO_URI" --archive="mongodb-$TIMESTAMP.archive" --gzip

if [ $? -eq 0 ]; then
    print_success "MongoDB backup completed"
else
    print_error "MongoDB backup failed"
    exit 1
fi

# 2. Redis backup
print_info "Backing up Redis data..."

REDIS_CLI="redis-cli"
if [ ! -z "$REDIS_HOST" ]; then
    REDIS_CLI="redis-cli -h $REDIS_HOST -p ${REDIS_PORT:-6379}"
fi

$REDIS_CLI BGSAVE
sleep 5

# Find Redis dump file
REDIS_DUMP=$(find /var/lib/redis /usr/local/var/db/redis -name "dump.rdb" 2>/dev/null | head -1)
if [ -f "$REDIS_DUMP" ]; then
    cp $REDIS_DUMP "redis-$TIMESTAMP.rdb"
    print_success "Redis backup completed"
else
    print_error "Redis dump file not found"
fi

# 3. File uploads backup
print_info "Backing up uploaded files..."

UPLOADS_DIR="/var/www/contract-management/current/backend/uploads"
if [ -d "$UPLOADS_DIR" ]; then
    tar -czf "uploads-$TIMESTAMP.tar.gz" -C $UPLOADS_DIR .
    print_success "Uploads backup completed"
else
    print_error "Uploads directory not found"
fi

# 4. Configuration backup
print_info "Backing up configuration files..."

CONFIG_FILES=(
    "/var/www/contract-management/current/backend/.env"
    "/var/www/contract-management/current/ecosystem.config.js"
    "/etc/nginx/sites-enabled/contract-management"
)

mkdir -p config
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp $file config/
    fi
done

tar -czf "config-$TIMESTAMP.tar.gz" config/
rm -rf config
print_success "Configuration backup completed"

# 5. Create master backup archive
print_info "Creating master backup archive..."

tar -czf "$BACKUP_DIR/contract-management-backup-$TIMESTAMP.tar.gz" .
cd ..
rm -rf $TIMESTAMP

print_success "Master backup created"

# 6. Upload to S3 (if AWS CLI is configured)
if command -v aws &> /dev/null && aws s3 ls s3://$S3_BUCKET &> /dev/null; then
    print_info "Uploading to S3..."
    aws s3 cp "contract-management-backup-$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/backups/"
    
    if [ $? -eq 0 ]; then
        print_success "Backup uploaded to S3"
    else
        print_error "S3 upload failed"
    fi
else
    print_info "S3 backup skipped (AWS CLI not configured)"
fi

# 7. Clean up old backups
print_info "Cleaning up old backups..."

# Local cleanup
find $BACKUP_DIR -name "contract-management-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
print_success "Local cleanup completed"

# S3 cleanup (if available)
if command -v aws &> /dev/null && aws s3 ls s3://$S3_BUCKET &> /dev/null; then
    aws s3 ls s3://$S3_BUCKET/backups/ | while read -r line; do
        createDate=$(echo $line | awk '{print $1" "$2}')
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo $line | awk '{print $4}')
            aws s3 rm "s3://$S3_BUCKET/backups/$fileName"
        fi
    done
    print_success "S3 cleanup completed"
fi

# 8. Generate backup report
BACKUP_SIZE=$(du -h "contract-management-backup-$TIMESTAMP.tar.gz" | cut -f1)

echo ""
echo "====================================="
print_success "Backup completed successfully!"
echo ""
echo "Backup details:"
echo "- Filename: contract-management-backup-$TIMESTAMP.tar.gz"
echo "- Size: $BACKUP_SIZE"
echo "- Location: $BACKUP_DIR"
if command -v aws &> /dev/null && aws s3 ls s3://$S3_BUCKET &> /dev/null; then
    echo "- S3 Location: s3://$S3_BUCKET/backups/"
fi
echo "- Retention: $RETENTION_DAYS days"
echo ""

# Send notification (implement your notification logic)
# Example: Send email or Slack notification
if [ ! -z "$BACKUP_NOTIFICATION_EMAIL" ]; then
    echo "Backup completed: contract-management-backup-$TIMESTAMP.tar.gz ($BACKUP_SIZE)" | \
    mail -s "Contract Management Backup Success" $BACKUP_NOTIFICATION_EMAIL
fi