// scripts/update-imports.js
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');

const globAsync = promisify(glob);

// Import mappings - old path to new path
const importMappings = {
  // Model imports
  './models/user.js': './models/index.js',
  './models/User.js': './models/index.js',
  '../models/user.js': '../models/index.js',
  '../models/User.js': '../models/index.js',
  '../../models/user.js': '../../models/index.js',
  
  // Service imports
  './services/emailService.js': './services/email.js',
  './services/EmailService.js': './services/email.js',
  '../services/emailService.js': '../services/email.js',
  '../services/EmailService.js': '../services/email.js',
  
  // Middleware imports
  '../middleware/auth-old.js': '../middleware/auth.js',
  './middleware/auth-old.js': './middleware/auth.js',
  '../middleware/authenticate.js': '../middleware/auth.js',
  
  // Controller imports
  './controllers/userController-old.js': './controllers/userController.js',
  './controllers/authController-old.js': './controllers/authController.js',
  
  // Utility imports
  './utils/old-helpers.js': './utils/helpers.js',
  '../utils/old-helpers.js': '../utils/helpers.js'
};

// Patterns to update require/import statements
const patterns = [
  // CommonJS require
  {
    regex: /require\(['"]([^'"]+)['"]\)/g,
    replacer: (match, importPath) => {
      const newPath = importMappings[importPath];
      return newPath ? `require('${newPath}')` : match;
    }
  },
  // ES6 import
  {
    regex: /from ['"]([^'"]+)['"]/g,
    replacer: (match, importPath) => {
      const newPath = importMappings[importPath];
      return newPath ? `from '${newPath}'` : match;
    }
  },
  // Dynamic import
  {
    regex: /import\(['"]([^'"]+)['"]\)/g,
    replacer: (match, importPath) => {
      const newPath = importMappings[importPath];
      return newPath ? `import('${newPath}')` : match;
    }
  }
];

// Update named imports
const namedImportUpdates = {
  // Update model imports
  '{ User }': '{ models }',
  '{ User, Product }': '{ models }',
  '{ User, Order, Product }': '{ models }',
  
  // Update service imports
  '{ EmailService }': '{ emailService }',
  '{ UserService }': '{ userService }',
  
  // Update destructuring after import
  'const { User } = models;': 'const { User } = models;',
  'const { User, Product } = models;': 'const { User, Product } = models;'
};

async function updateImports() {
  console.log('🔄 Updating import statements...\n');
  
  // Find all JavaScript files
  const files = await globAsync('**/*.js', { 
    ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.git/**'] 
  });
  
  console.log(`Found ${files.length} JavaScript files to process\n`);
  
  let updatedFiles = 0;
  const updates = [];
  
  for (const file of files) {
    try {
      let content = await fs.readFile(file, 'utf8');
      const originalContent = content;
      let modified = false;
      
      // Apply import mappings
      for (const pattern of patterns) {
        const newContent = content.replace(pattern.regex, pattern.replacer);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }
      
      // Update named imports
      for (const [oldImport, newImport] of Object.entries(namedImportUpdates)) {
        if (content.includes(oldImport)) {
          content = content.replace(new RegExp(escapeRegex(oldImport), 'g'), newImport);
          modified = true;
        }
      }
      
      // Fix specific patterns
      content = fixSpecificPatterns(content);
      
      if (modified && content !== originalContent) {
        await fs.writeFile(file, content);
        updatedFiles++;
        
        // Track what was updated
        const changes = findChanges(originalContent, content);
        if (changes.length > 0) {
          updates.push({ file, changes });
          console.log(`✅ Updated: ${file}`);
          changes.forEach(change => console.log(`   - ${change}`));
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }
  
  // Generate update report
  await generateReport(updates);
  
  console.log(`\n✨ Import update completed!`);
  console.log(`📊 Updated ${updatedFiles} files out of ${files.length} total files\n`);
  
  if (updatedFiles > 0) {
    console.log('Next steps:');
    console.log('1. Run "npm run lint:fix" to fix any formatting issues');
    console.log('2. Run "npm test" to ensure all imports are correct');
    console.log('3. Review the update-imports-report.md for details');
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fixSpecificPatterns(content) {
  // Fix model access patterns
  content = content.replace(
    /const user = new User\(/g,
    'const user = new models.User('
  );
  
  content = content.replace(
    /await User\.findById\(/g,
    'await models.User.findById('
  );
  
  content = content.replace(
    /await User\.find\(/g,
    'await models.User.find('
  );
  
  content = content.replace(
    /await User\.findOne\(/g,
    'await models.User.findOne('
  );
  
  // Fix duplicate model imports
  content = content.replace(
    /const { models } = require\('\.\.\/models\/index\.js'\);\s*const { models } = require/g,
    'const { models } = require'
  );
  
  // Fix service patterns
  content = content.replace(
    /new EmailService\(/g,
    'emailService.'
  );
  
  return content;
}

function findChanges(original, updated) {
  const changes = [];
  const originalLines = original.split('\n');
  const updatedLines = updated.split('\n');
  
  for (let i = 0; i < Math.max(originalLines.length, updatedLines.length); i++) {
    if (originalLines[i] !== updatedLines[i]) {
      if (originalLines[i] && updatedLines[i]) {
        changes.push(`Line ${i + 1}: "${originalLines[i].trim()}" → "${updatedLines[i].trim()}"`);
      }
    }
  }
  
  return changes.slice(0, 5); // Limit to first 5 changes
}

async function generateReport(updates) {
  const report = [
    '# Import Update Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Total files updated: ${updates.length}`,
    `- Import mappings applied: ${Object.keys(importMappings).length}`,
    '',
    '## Updated Files',
    ''
  ];
  
  for (const { file, changes } of updates) {
    report.push(`### ${file}`);
    report.push('');
    changes.forEach(change => report.push(`- ${change}`));
    report.push('');
  }
  
  report.push('## Import Mappings Used');
  report.push('');
  report.push('| Old Import | New Import |');
  report.push('|------------|------------|');
  
  for (const [oldPath, newPath] of Object.entries(importMappings)) {
    report.push(`| ${oldPath} | ${newPath} |`);
  }
  
  await fs.writeFile('update-imports-report.md', report.join('\n'));
}

// Run the script
updateImports().catch(console.error);