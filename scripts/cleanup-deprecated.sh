#!/bin/bash
# scripts/cleanup-deprecated.sh

echo "🧹 Starting cleanup of deprecated files..."

# List of deprecated files to remove
DEPRECATED_FILES=(
  "routes/old-auth.js"
  "routes/auth-old.js"
  "middleware/auth-old.js"
  "middleware/old-validation.js"
  "services/email-old.js"
  "services/EmailService-old.js"
  "models/user-old.js"
  "models/User-backup.js"
  "public/css/old-styles.css"
  "public/css/styles-backup.css"
  "public/js/old-scripts.js"
  "public/js/main-old.js"
  "controllers/old-controllers.js"
  "utils/old-helpers.js"
  "config/old-config.js"
  ".env.old"
  ".env.backup"
)

# Count removed files
REMOVED_COUNT=0

# Remove deprecated files
for file in "${DEPRECATED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ❌ Removing: $file"
    rm "$file"
    ((REMOVED_COUNT++))
  fi
done

echo "  ✅ Removed $REMOVED_COUNT deprecated files"

# List of deprecated directories to remove
DEPRECATED_DIRS=(
  "backup"
  "old"
  "deprecated"
  "temp"
  "_old"
  "_backup"
)

# Remove deprecated directories
REMOVED_DIRS=0
for dir in "${DEPRECATED_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "  ❌ Removing directory: $dir"
    rm -rf "$dir"
    ((REMOVED_DIRS++))
  fi
done

echo "  ✅ Removed $REMOVED_DIRS deprecated directories"

# Find and remove backup files
echo ""
echo "🔍 Finding backup files..."
BACKUP_FILES=$(find . -name "*.backup" -o -name "*.old" -o -name "*~" -o -name "*.swp" | grep -v node_modules | grep -v .git)

if [ ! -z "$BACKUP_FILES" ]; then
  echo "$BACKUP_FILES" | while read -r file; do
    echo "  ❌ Removing backup file: $file"
    rm "$file"
  done
fi

# Remove empty directories
echo ""
echo "🗑️  Removing empty directories..."
find . -type d -empty -not -path "./node_modules/*" -not -path "./.git/*" -delete

# Clean up node_modules and reinstall
echo ""
echo "📦 Cleaning node_modules..."
if [ -d "node_modules" ]; then
  rm -rf node_modules
  echo "  ✅ Removed node_modules"
fi

if [ -f "package-lock.json" ]; then
  rm package-lock.json
  echo "  ✅ Removed package-lock.json"
fi

# Remove build artifacts
echo ""
echo "🏗️  Cleaning build artifacts..."
BUILD_DIRS=("dist" "build" ".cache" ".parcel-cache")

for dir in "${BUILD_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "  ✅ Removed $dir"
  fi
done

# Clean test artifacts
echo ""
echo "🧪 Cleaning test artifacts..."
TEST_DIRS=("coverage" "test-results" ".nyc_output" "screenshots")

for dir in "${TEST_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "  ✅ Removed $dir"
  fi
done

# Clean log files
echo ""
echo "📝 Cleaning log files..."
LOG_FILES=$(find . -name "*.log" -not -path "./node_modules/*" -not -path "./.git/*")

if [ ! -z "$LOG_FILES" ]; then
  echo "$LOG_FILES" | while read -r file; do
    echo "  ❌ Removing log file: $file"
    rm "$file"
  done
fi

# Final summary
echo ""
echo "✨ Cleanup completed!"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to reinstall dependencies"
echo "2. Check git status to review changes"
echo "3. Run tests to ensure everything works"