/**
 * Custom ESLint rules for auth protection
 * This file contains regex-based checks that ESLint can't easily do
 * Run this separately: node .eslintrc.auth-protection.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const AUTH_FILES = [
  'server/src/auth.ts',
  'server/src/schema.ts',
  'server/src/middleware/auth.ts',
  'src/lib/auth-client.ts',
];

const PROTECTED_PATTERNS = [
  {
    pattern: /(http:\/\/localhost:3001|https:\/\/api\.kriptik\.app|https:\/\/kriptik-ai-opus-build-backend)/g,
    message: 'Hardcoded API URL detected. Use: import { API_URL } from "@/lib/api-config"',
    severity: 'warn',
  },
  {
    pattern: /fetch\s*\([^)]*\)\s*\{[^}]*\}/gs,
    check: (match) => {
      // Check if fetch call has credentials: 'include'
      return !match.includes('credentials') && !match.includes('authenticatedFetch');
    },
    message: 'Fetch call missing credentials: "include". Use authenticatedFetch() from "@/lib/api-config"',
    severity: 'error',
  },
];

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const issues = [];
  
  for (const { pattern, check, message, severity } of PROTECTED_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (check && !check(match[0])) continue;
      issues.push({
        file: filePath,
        line: content.substring(0, match.index).split('\n').length,
        message,
        severity,
      });
    }
  }
  
  return issues;
}

// This is a helper script - actual linting happens via ESLint config
export { checkFile, AUTH_FILES, PROTECTED_PATTERNS };
