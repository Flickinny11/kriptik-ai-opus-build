import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'server/dist', 'server/node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Allow 'any' in some cases (existing codebase pattern)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-namespace': 'off',
      'prefer-const': 'warn',
    },
  },
  // ============================================================================
  // AUTH PROTECTION RULES - Prevent auth-breaking patterns
  // ============================================================================
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Rule 1: Warn about hardcoded API URLs in string literals
      // Note: Using multiple simpler selectors for esquery compatibility
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/localhost:3001/]',
          message: '⚠️ Hardcoded localhost API URL detected. Use: import { API_URL } from "@/lib/api-config"',
        },
        {
          selector: 'Literal[value=/api\\.kriptik\\.app/]',
          message: '⚠️ Hardcoded API URL detected. Use: import { API_URL } from "@/lib/api-config"',
        },
        {
          selector: 'Literal[value=/kriptik-ai-opus-build-backend/]',
          message: '⚠️ Hardcoded backend URL detected. Use: import { API_URL } from "@/lib/api-config"',
        },
      ],
    },
  },
  // ============================================================================
  // PROTECTED AUTH FILES - Warn if modified
  // ============================================================================
  {
    files: [
      'server/src/auth.ts',
      'server/src/schema.ts',
      'server/src/middleware/auth.ts',
      'src/lib/auth-client.ts',
    ],
    rules: {
      'no-console': 'off', // Allow console.log in auth files for debugging
    },
  }
);
