#!/usr/bin/env node
/**
 * Auth Protection Pre-commit Hook
 *
 * Checks for common patterns that break auth:
 * 1. Hardcoded API URLs
 * 2. Missing credentials: 'include' in fetch calls
 * 3. Modifications to protected auth files
 */

const { readFileSync } = require('fs');
const { execSync } = require('child_process');

const AUTH_FILES = [
  'server/src/auth.ts',
  'server/src/schema.ts',
  'server/src/middleware/auth.ts',
  'src/lib/auth-client.ts',
];

const PROTECTED_SECTIONS = {
  'server/src/index.ts': [
    'CORS',
    'cors',
    'allowedOrigins',
    'Access-Control-Allow-Credentials',
  ],
};

let hasErrors = false;
const errors = [];
const warnings = [];

// Get staged files
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    return [];
  }
}

// Check for hardcoded API URLs
function checkHardcodedUrls(filePath, content) {
  const patterns = [
    { regex: /['"`]http:\/\/localhost:3001['"`]/g, message: 'Hardcoded localhost:3001 URL' },
    { regex: /['"`]https:\/\/api\.kriptik\.app['"`]/g, message: 'Hardcoded api.kriptik.app URL' },
    { regex: /['"`]https:\/\/kriptik-ai-opus-build-backend['"`]/g, message: 'Hardcoded backend URL' },
  ];

  for (const { regex, message } of patterns) {
    const matches = [...content.matchAll(regex)];
    for (const match of matches) {
      const line = content.substring(0, match.index).split('\n').length;
      warnings.push({
        file: filePath,
        line,
        message: `⚠️  ${message}. Use: import { API_URL } from "@/lib/api-config"`,
      });
    }
  }
}

// Check for fetch calls without credentials
function checkMissingCredentials(filePath, content) {
  // Find fetch calls - look for fetch( followed by options object
  const lines = content.split('\n');

  // Track if we're inside a template string (code sample)
  let inTemplateLiteral = false;
  let templateDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track template literal state (for code samples like generateCodeSamples)
    const backtickMatches = (line.match(/`/g) || []).length;
    if (backtickMatches % 2 === 1) {
      inTemplateLiteral = !inTemplateLiteral;
    }

    // Skip if we're inside a template literal (likely a code sample for documentation)
    if (inTemplateLiteral) continue;

    // Check if line contains actual fetch call (not refetch, prefetch, etc.)
    // Use word boundary to avoid false positives like refetch(), prefetch()
    const hasFetchCall = /\bfetch\s*\(/.test(line) && !line.includes('authenticatedFetch');
    if (hasFetchCall) {
      // Check if this fetch call has credentials in the next few lines
      const nextLines = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');

      // Skip if it's using authenticatedFetch or has credentials
      if (!nextLines.includes('credentials') && !nextLines.includes('authenticatedFetch')) {
        // Check if it's actually a fetch call (not a comment or string)
        if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          // Skip if it's a code sample function (like generateCodeSamples)
          if (filePath.includes('CodeSamples') || line.includes('generateCodeSamples')) continue;

          errors.push({
            file: filePath,
            line: i + 1,
            message: '❌ Fetch call missing credentials: "include". Use authenticatedFetch() from "@/lib/api-config" or add credentials: "include"',
          });
          hasErrors = true;
        }
      }
    }
  }
}

// Check if protected auth files are modified
function checkProtectedFiles(filePath) {
  if (AUTH_FILES.includes(filePath)) {
    warnings.push({
      file: filePath,
      line: 1,
      message: `⚠️  WARNING: Protected auth file modified. Ensure changes follow AUTH-IMMUTABLE-SPECIFICATION.md`,
    });
  }
}

// Check protected sections in other files
function checkProtectedSections(filePath, content) {
  if (PROTECTED_SECTIONS[filePath]) {
    const sections = PROTECTED_SECTIONS[filePath];
    for (const section of sections) {
      if (content.includes(section)) {
        warnings.push({
          file: filePath,
          line: 1,
          message: `⚠️  WARNING: Protected section "${section}" modified in ${filePath}. Verify CORS/auth settings are correct.`,
        });
      }
    }
  }
}

// Main check function
function checkFile(filePath) {
  try {
    // Skip api-config files - they're the source of truth
    if (filePath.includes('api-config.ts') || filePath.includes('api-config.js') || filePath.includes('api-config.cjs')) {
      return;
    }

    const content = readFileSync(filePath, 'utf-8');

    // Skip if file doesn't exist or is binary
    if (!content || content.includes('\0')) return;

    // Only check TypeScript/JavaScript files
    if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return;

    // Check protected files and sections for all files
    checkProtectedFiles(filePath);
    checkProtectedSections(filePath, content);

    // Skip server-side files for fetch credential checks - they use API key auth, not cookies
    // Server-to-server calls (e.g., to RunPod API, provider endpoints) don't need credentials: 'include'
    if (filePath.startsWith('server/')) {
      checkHardcodedUrls(filePath, content); // Still check for hardcoded URLs
      return;
    }

    checkHardcodedUrls(filePath, content);
    checkMissingCredentials(filePath, content);
  } catch (error) {
    // File might be deleted, skip it
    if (error.code !== 'ENOENT') {
      console.error(`Error reading ${filePath}:`, error.message);
    }
  }
}

// Run checks
const stagedFiles = getStagedFiles();

if (stagedFiles.length === 0) {
  console.log('No staged files to check.');
  process.exit(0);
}

console.log(`\n🔒 Checking ${stagedFiles.length} staged file(s) for auth-breaking patterns...\n`);

for (const file of stagedFiles) {
  checkFile(file);
}

// Report results
if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:\n');
  for (const warning of warnings) {
    console.log(`  ${warning.file}:${warning.line}`);
    console.log(`  ${warning.message}\n`);
  }
}

if (errors.length > 0) {
  console.log('❌ ERRORS (commit blocked):\n');
  for (const error of errors) {
    console.log(`  ${error.file}:${error.line}`);
    console.log(`  ${error.message}\n`);
  }
}

if (hasErrors) {
  console.log('\n❌ Commit blocked due to auth-breaking patterns.');
  console.log('📖 See AUTH-BREAK-PREVENTION.md for correct patterns.\n');
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('✅ No errors found, but please review warnings above.\n');
} else {
  console.log('✅ No auth-breaking patterns detected.\n');
}

process.exit(0);
