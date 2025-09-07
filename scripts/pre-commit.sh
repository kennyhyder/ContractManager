#!/bin/bash
# scripts/pre-commit.sh
# Pre-commit hook script to run tests and linting before commits

set -e

echo "🔍 Running pre-commit checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        exit 1
    fi
}

# Function to print section headers
print_header() {
    echo -e "\n${YELLOW}$1${NC}"
}

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx|json|md)$' || true)

if [ -z "$STAGED_FILES" ]; then
    echo "No JavaScript/JSON/Markdown files to check"
    exit 0
fi

# Store the current directory
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"

# 1. Check for debugging statements
print_header "Checking for debugging statements..."
DEBUG_STATEMENTS=$(echo "$STAGED_FILES" | xargs grep -n "console\.\(log\|debug\|trace\)" 2>/dev/null || true)
if [ -n "$DEBUG_STATEMENTS" ]; then
    echo -e "${RED}✗${NC} Found console statements:"
    echo "$DEBUG_STATEMENTS"
    echo -e "${YELLOW}Remove console statements before committing${NC}"
    exit 1
else
    print_status 0 "No debugging statements found"
fi

# 2. Check for merge conflicts
print_header "Checking for merge conflicts..."
CONFLICTS=$(echo "$STAGED_FILES" | xargs grep -n "<<<<<<< \|======= \|>>>>>>> " 2>/dev/null || true)
if [ -n "$CONFLICTS" ]; then
    echo -e "${RED}✗${NC} Found merge conflict markers:"
    echo "$CONFLICTS"
    exit 1
else
    print_status 0 "No merge conflicts found"
fi

# 3. Run ESLint
print_header "Running ESLint..."
if command -v eslint &> /dev/null; then
    echo "$STAGED_FILES" | xargs ./node_modules/.bin/eslint --quiet
    print_status $? "ESLint passed"
else
    echo -e "${YELLOW}⚠${NC} ESLint not found, skipping..."
fi

# 4. Run Prettier check
print_header "Checking code formatting..."
if command -v prettier &> /dev/null; then
    echo "$STAGED_FILES" | xargs ./node_modules/.bin/prettier --check 2>/dev/null
    PRETTIER_STATUS=$?
    if [ $PRETTIER_STATUS -ne 0 ]; then
        echo -e "${RED}✗${NC} Code formatting issues found"
        echo -e "${YELLOW}Run 'npm run format' to fix formatting${NC}"
        exit 1
    else
        print_status 0 "Code formatting is correct"
    fi
else
    echo -e "${YELLOW}⚠${NC} Prettier not found, skipping..."
fi

# 5. Check for large files
print_header "Checking file sizes..."
LARGE_FILES=$(echo "$STAGED_FILES" | while read file; do
    if [ -f "$file" ]; then
        SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [ $SIZE -gt 1048576 ]; then  # 1MB
            echo "$file ($(($SIZE / 1024))KB)"
        fi
    fi
done)

if [ -n "$LARGE_FILES" ]; then
    echo -e "${YELLOW}⚠${NC} Large files detected:"
    echo "$LARGE_FILES"
    echo "Consider using Git LFS for large files"
fi

# 6. Run security audit (quick check)
print_header "Running security check..."
if [ -f "package-lock.json" ]; then
    npm audit --production --audit-level=high --json 2>/dev/null | jq -r '.vulnerabilities | to_entries | .[] | select(.value.severity == "high" or .value.severity == "critical") | .key' > /tmp/audit_issues.txt
    
    if [ -s /tmp/audit_issues.txt ]; then
        echo -e "${YELLOW}⚠${NC} Security vulnerabilities found:"
        cat /tmp/audit_issues.txt
        echo -e "${YELLOW}Run 'npm audit fix' to resolve${NC}"
    else
        print_status 0 "No high/critical vulnerabilities"
    fi
    rm -f /tmp/audit_issues.txt
fi

# 7. Check for sensitive data
print_header "Checking for sensitive data..."
SENSITIVE_PATTERNS="password=|api_key=|API_KEY=|secret=|SECRET=|private_key=|PRIVATE_KEY=|token=|TOKEN="
SENSITIVE_DATA=$(echo "$STAGED_FILES" | xargs grep -E "$SENSITIVE_PATTERNS" 2>/dev/null || true)
if [ -n "$SENSITIVE_DATA" ]; then
    echo -e "${YELLOW}⚠${NC} Possible sensitive data found:"
    echo "$SENSITIVE_DATA"
    echo "Make sure no credentials are being committed"
fi

# 8. Validate JSON files
print_header "Validating JSON files..."
JSON_FILES=$(echo "$STAGED_FILES" | grep '\.json$' || true)
if [ -n "$JSON_FILES" ]; then
    for file in $JSON_FILES; do
        if [ -f "$file" ]; then
            jq empty "$file" 2>/dev/null
            if [ $? -ne 0 ]; then
                echo -e "${RED}✗${NC} Invalid JSON in $file"
                exit 1
            fi
        fi
    done
    print_status 0 "All JSON files are valid"
fi

# 9. Run unit tests for changed files
print_header "Running unit tests..."
# Only run tests if test files exist
if [ -d "tests" ] || [ -d "test" ] || [ -d "__tests__" ]; then
    # Get list of test files related to staged files
    TEST_FILES=""
    for file in $STAGED_FILES; do
        if [[ $file == *.test.js ]] || [[ $file == *.spec.js ]]; then
            TEST_FILES="$TEST_FILES $file"
        else
            # Look for corresponding test file
            BASE_NAME=$(basename "$file" .js)
            DIR_NAME=$(dirname "$file")
            POSSIBLE_TESTS=(
                "$DIR_NAME/__tests__/$BASE_NAME.test.js"
                "$DIR_NAME/__tests__/$BASE_NAME.spec.js"
                "tests/unit/$BASE_NAME.test.js"
                "test/$BASE_NAME.test.js"
            )
            for test_file in "${POSSIBLE_TESTS[@]}"; do
                if [ -f "$test_file" ]; then
                    TEST_FILES="$TEST_FILES $test_file"
                    break
                fi
            done
        fi
    done
    
    if [ -n "$TEST_FILES" ]; then
        echo "Running tests for: $TEST_FILES"
        npm test -- $TEST_FILES --passWithNoTests
        print_status $? "Tests passed"
    else
        echo -e "${YELLOW}No related test files found${NC}"
    fi
fi

# 10. Check branch naming convention
print_header "Checking branch name..."
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
VALID_BRANCH_REGEX="^(main|develop|feature|bugfix|hotfix|release)\/[a-z0-9-]+$|^(main|develop)$"
if [[ ! "$BRANCH_NAME" =~ $VALID_BRANCH_REGEX ]]; then
    echo -e "${YELLOW}⚠${NC} Branch name '$BRANCH_NAME' does not follow naming convention"
    echo "Valid formats: feature/name, bugfix/name, hotfix/name, release/name"
fi

# Success!
echo -e "\n${GREEN}✅ All pre-commit checks passed!${NC}"
echo "Proceeding with commit..."

# Re-add files that might have been modified by formatters
git add $STAGED_FILES

exit 0