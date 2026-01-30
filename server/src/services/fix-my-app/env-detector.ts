/**
 * Environment Variable Detection Service
 *
 * AI-powered detection of required environment variables based on:
 * - User's intent from their streaming chat conversation
 * - process.env.* / import.meta.env.* references in code
 * - Package dependencies
 * - Existing .env files
 *
 * The detection is DYNAMIC - not limited to predefined services.
 * Uses AI to understand what the user is trying to build and what
 * credentials/services they'll need.
 */

import { createGeminiClient } from '../ai/gemini-client.js';

export interface EnvVarRequirement {
  name: string;
  service?: string;
  serviceName?: string;
  required: boolean;
  source?: string;
  placeholder?: string;
  description?: string;
  docsUrl?: string;
  reason?: string;
}

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface IntentSummary {
  corePurpose: string;
  primaryFeatures: Array<{ name: string; description: string }>;
  secondaryFeatures?: Array<{ name: string; description: string }>;
  targetAudience?: string;
  technicalRequirements?: string[];
}

export interface EnvDetectionResult {
  required: EnvVarRequirement[];
  optional: EnvVarRequirement[];
  existing: string[];
  missing: EnvVarRequirement[];
  aiDetected: EnvVarRequirement[];
}

/**
 * AI-powered detection of required environment variables
 * Analyzes the user's intent from their conversation to determine
 * what services and credentials they'll need.
 */
export async function detectEnvVarsFromIntent(
  chatHistory: ChatMessage[],
  intentSummary?: IntentSummary,
  projectFiles?: ProjectFile[]
): Promise<EnvVarRequirement[]> {
  const gemini = createGeminiClient();

  // Build context from chat history
  const chatContext = chatHistory
    .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
    .join('\n\n');

  // Build context from intent summary if available
  const intentContext = intentSummary
    ? `
User's Intent:
- Core Purpose: ${intentSummary.corePurpose}
- Primary Features: ${intentSummary.primaryFeatures.map(f => f.name).join(', ')}
- Secondary Features: ${intentSummary.secondaryFeatures?.map(f => f.name).join(', ') || 'None'}
- Technical Requirements: ${intentSummary.technicalRequirements?.join(', ') || 'Not specified'}
`
    : '';

  // Extract any env vars already referenced in code
  const codeEnvVars = projectFiles
    ? extractEnvVarsFromCode(projectFiles)
    : [];

  const prompt = `You are an expert developer analyzing a project to determine what environment variables and API credentials will be needed.

## User's Conversation with AI Builder:
${chatContext}

${intentContext}

${codeEnvVars.length > 0 ? `
## Environment Variables Already Referenced in Code:
${codeEnvVars.map(v => `- ${v.name} (found in: ${v.source})`).join('\n')}
` : ''}

## Your Task:
Analyze the user's conversation and intent to determine ALL services and API credentials they will need to make their app work. Think about:

1. **Explicit mentions**: Services the user explicitly mentioned (e.g., "I want to use Stripe", "integrate with OpenAI")
2. **Implicit needs**: Services implied by the features they want (e.g., "send emails" → email service, "store user data" → database, "accept payments" → payment processor)
3. **Technical requirements**: What the architecture needs (e.g., auth system, file storage, CDN)
4. **Third-party integrations**: Any APIs or services needed for the functionality

Be COMPREHENSIVE but REALISTIC. Only include services that are actually needed based on what the user is building.

Return a JSON array of required credentials. For EACH service, include:
- name: The environment variable name (e.g., "OPENAI_API_KEY", "STRIPE_SECRET_KEY")
- serviceName: Human-readable service name (e.g., "OpenAI", "Stripe")
- service: Service identifier (e.g., "openai", "stripe")
- required: boolean (true if essential, false if optional)
- description: What this credential is for
- placeholder: Example format (e.g., "sk-...", "pk_live_...")
- docsUrl: URL where user can get this credential (if known)
- reason: Why the user needs this based on their conversation

IMPORTANT: 
- Return ONLY valid JSON array, no markdown or explanation
- Include ALL variables for each service (e.g., Stripe needs both secret and publishable keys)
- Be specific about why each is needed based on the user's actual requirements
- If user mentioned specific providers, use those. If not, suggest common choices.

Example output format:
[
  {
    "name": "OPENAI_API_KEY",
    "serviceName": "OpenAI",
    "service": "openai",
    "required": true,
    "description": "API key for GPT-4 to power the AI chat feature",
    "placeholder": "sk-...",
    "docsUrl": "https://platform.openai.com/api-keys",
    "reason": "User wants an AI-powered chat assistant in their app"
  }
]`;

  try {
    const response = await gemini.generateText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 4096,
    });

    // Parse the JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[EnvDetector] Failed to parse AI response as JSON');
      return codeEnvVars;
    }

    const detected: EnvVarRequirement[] = JSON.parse(jsonMatch[0]);

    // Merge with code-detected vars
    const merged = mergeEnvVars(detected, codeEnvVars);

    return merged;
  } catch (error) {
    console.error('[EnvDetector] AI detection failed:', error);
    // Fall back to code-based detection
    return codeEnvVars;
  }
}

/**
 * Extract environment variables referenced in code
 */
function extractEnvVarsFromCode(files: ProjectFile[]): EnvVarRequirement[] {
  const detected: EnvVarRequirement[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    // Skip non-code files
    if (!isCodeFile(file.path)) continue;

    // process.env.VAR_NAME
    const processEnvMatches = file.content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
    for (const match of processEnvMatches) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        detected.push({
          name,
          source: file.path,
          required: true,
          description: inferDescription(name),
          service: inferService(name),
        });
      }
    }

    // import.meta.env.VAR_NAME (Vite)
    const viteMatches = file.content.matchAll(/import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g);
    for (const match of viteMatches) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        detected.push({
          name,
          source: file.path,
          required: true,
          description: inferDescription(name),
          service: inferService(name),
        });
      }
    }

    // Deno.env.get("VAR_NAME")
    const denoMatches = file.content.matchAll(/Deno\.env\.get\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g);
    for (const match of denoMatches) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        detected.push({
          name,
          source: file.path,
          required: true,
          description: inferDescription(name),
          service: inferService(name),
        });
      }
    }
  }

  return detected;
}

/**
 * Detect env vars from project files (package.json, code, .env files)
 */
export async function detectRequiredEnvVars(files: ProjectFile[]): Promise<EnvDetectionResult> {
  const detected: EnvVarRequirement[] = [];
  const existingVars = new Set<string>();

  // 1. Extract from code
  const codeVars = extractEnvVarsFromCode(files);
  detected.push(...codeVars);

  // 2. Check package.json for known services
  const pkgJson = files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson.content);
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      for (const [pkgName] of Object.entries(allDeps)) {
        const knownVars = KNOWN_PACKAGE_ENV_VARS[pkgName];
        if (knownVars) {
          for (const v of knownVars) {
            const existing = detected.find(d => d.name === v.name);
            if (!existing) {
              detected.push({ ...v, service: pkgName, source: 'package.json' });
            }
          }
        }
      }
    } catch (e) {
      console.error('[EnvDetector] Failed to parse package.json:', e);
    }
  }

  // 3. Check existing .env files for already-set values
  const envFiles = files.filter(f =>
    f.path === '.env' ||
    f.path === '.env.local' ||
    f.path === '.env.example' ||
    f.path === '.env.development' ||
    f.path === '.env.production' ||
    f.path.endsWith('/.env') ||
    f.path.endsWith('/.env.local') ||
    f.path.endsWith('/.env.example')
  );

  for (const envFile of envFiles) {
    const lines = envFile.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        const [, varName, value] = match;
        // Only consider it "existing" if it has a real value
        if (value && !value.includes('xxx') && !value.includes('your_') && value !== '""' && value !== "''") {
          existingVars.add(varName);
        }
      }
    }
  }

  // Categorize
  const seen = new Set<string>();
  const uniqueDetected = detected.filter(d => {
    if (seen.has(d.name)) return false;
    seen.add(d.name);
    return true;
  });

  const required = uniqueDetected.filter(d => d.required && !existingVars.has(d.name));
  const optional = uniqueDetected.filter(d => !d.required && !existingVars.has(d.name));
  const missing = uniqueDetected.filter(d => !existingVars.has(d.name));

  return {
    required,
    optional,
    existing: Array.from(existingVars),
    missing,
    aiDetected: [], // Will be populated by detectEnvVarsFromIntent
  };
}

/**
 * Full detection combining code analysis and AI intent analysis
 */
export async function detectEnvVarsComprehensive(
  projectFiles: ProjectFile[],
  chatHistory?: ChatMessage[],
  intentSummary?: IntentSummary
): Promise<EnvDetectionResult> {
  // Start with code-based detection
  const codeResult = await detectRequiredEnvVars(projectFiles);

  // If we have chat history, do AI-powered detection
  let aiDetected: EnvVarRequirement[] = [];
  if (chatHistory && chatHistory.length > 0) {
    try {
      aiDetected = await detectEnvVarsFromIntent(chatHistory, intentSummary, projectFiles);
    } catch (error) {
      console.error('[EnvDetector] AI detection failed, using code-only results:', error);
    }
  }

  // Merge results, preferring AI detection (has more context/reasons)
  const allVars = mergeEnvVars(aiDetected, codeResult.missing);

  // Filter out existing vars
  const existingSet = new Set(codeResult.existing);
  const missing = allVars.filter(v => !existingSet.has(v.name));
  const required = missing.filter(v => v.required);
  const optional = missing.filter(v => !v.required);

  return {
    required,
    optional,
    existing: codeResult.existing,
    missing,
    aiDetected,
  };
}

/**
 * Merge two lists of env vars, preferring items with more metadata
 */
function mergeEnvVars(
  primary: EnvVarRequirement[],
  secondary: EnvVarRequirement[]
): EnvVarRequirement[] {
  const merged = new Map<string, EnvVarRequirement>();

  // Add primary first (has priority)
  for (const v of primary) {
    merged.set(v.name, v);
  }

  // Add secondary only if not already present
  for (const v of secondary) {
    if (!merged.has(v.name)) {
      merged.set(v.name, v);
    }
  }

  return Array.from(merged.values());
}

/**
 * Infer service name from env var name
 */
function inferService(varName: string): string | undefined {
  const patterns: Array<[RegExp, string]> = [
    [/^OPENAI/, 'openai'],
    [/^ANTHROPIC/, 'anthropic'],
    [/^GOOGLE_AI|^GEMINI/, 'google'],
    [/^STRIPE/, 'stripe'],
    [/^SUPABASE/, 'supabase'],
    [/^FIREBASE/, 'firebase'],
    [/^TWILIO/, 'twilio'],
    [/^SENDGRID/, 'sendgrid'],
    [/^RESEND/, 'resend'],
    [/^CLERK/, 'clerk'],
    [/^AUTH0/, 'auth0'],
    [/^AWS/, 'aws'],
    [/^CLOUDINARY/, 'cloudinary'],
    [/^VERCEL/, 'vercel'],
    [/^MONGODB/, 'mongodb'],
    [/^POSTGRES|^PG_/, 'postgres'],
    [/^MYSQL/, 'mysql'],
    [/^REDIS/, 'redis'],
    [/^REPLICATE/, 'replicate'],
    [/^GITHUB/, 'github'],
    [/^DISCORD/, 'discord'],
    [/^SLACK/, 'slack'],
    [/^SENTRY/, 'sentry'],
  ];

  for (const [pattern, service] of patterns) {
    if (pattern.test(varName)) {
      return service;
    }
  }

  return undefined;
}

/**
 * Infer description from env var name
 */
function inferDescription(varName: string): string {
  const parts = varName.toLowerCase().split('_');

  // Common suffixes
  if (parts.includes('key') || parts.includes('api')) {
    return `API key for ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}`;
  }
  if (parts.includes('secret')) {
    return `Secret key for ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}`;
  }
  if (parts.includes('token')) {
    return `Auth token for ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}`;
  }
  if (parts.includes('url') || parts.includes('uri')) {
    return `Connection URL for ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}`;
  }
  if (parts.includes('id') || parts.includes('sid')) {
    return `ID for ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}`;
  }

  // Generic
  return varName
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Check if file is a code file
 */
function isCodeFile(path: string): boolean {
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];
  return codeExtensions.some(ext => path.endsWith(ext));
}

/**
 * Known package to env var mappings (fallback reference)
 */
const KNOWN_PACKAGE_ENV_VARS: Record<string, EnvVarRequirement[]> = {
  'openai': [
    { name: 'OPENAI_API_KEY', required: true, placeholder: 'sk-...', description: 'OpenAI API key', docsUrl: 'https://platform.openai.com/api-keys' }
  ],
  '@anthropic-ai/sdk': [
    { name: 'ANTHROPIC_API_KEY', required: true, placeholder: 'sk-ant-...', description: 'Anthropic API key', docsUrl: 'https://console.anthropic.com/settings/keys' }
  ],
  'stripe': [
    { name: 'STRIPE_SECRET_KEY', required: true, placeholder: 'sk_live_...', description: 'Stripe secret key', docsUrl: 'https://dashboard.stripe.com/apikeys' },
    { name: 'STRIPE_PUBLISHABLE_KEY', required: true, placeholder: 'pk_live_...', description: 'Stripe publishable key', docsUrl: 'https://dashboard.stripe.com/apikeys' },
  ],
  '@supabase/supabase-js': [
    { name: 'SUPABASE_URL', required: true, placeholder: 'https://xxx.supabase.co', description: 'Supabase project URL', docsUrl: 'https://supabase.com/dashboard' },
    { name: 'SUPABASE_ANON_KEY', required: true, placeholder: 'eyJ...', description: 'Supabase anon key', docsUrl: 'https://supabase.com/dashboard' },
  ],
  'twilio': [
    { name: 'TWILIO_ACCOUNT_SID', required: true, placeholder: 'AC...', description: 'Twilio account SID', docsUrl: 'https://console.twilio.com' },
    { name: 'TWILIO_AUTH_TOKEN', required: true, description: 'Twilio auth token', docsUrl: 'https://console.twilio.com' },
  ],
  'resend': [
    { name: 'RESEND_API_KEY', required: true, placeholder: 're_...', description: 'Resend email API key', docsUrl: 'https://resend.com/api-keys' }
  ],
  '@clerk/nextjs': [
    { name: 'CLERK_SECRET_KEY', required: true, placeholder: 'sk_live_...', description: 'Clerk secret key', docsUrl: 'https://dashboard.clerk.com' },
    { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', required: true, placeholder: 'pk_live_...', description: 'Clerk publishable key', docsUrl: 'https://dashboard.clerk.com' },
  ],
  '@prisma/client': [
    { name: 'DATABASE_URL', required: true, description: 'Database connection URL' }
  ],
  'mongoose': [
    { name: 'MONGODB_URI', required: true, placeholder: 'mongodb+srv://...', description: 'MongoDB connection URI' }
  ],
};

/**
 * Get documentation URL for a service
 */
export function getDocsUrlForService(service: string): string | null {
  const docsUrls: Record<string, string> = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    google: 'https://aistudio.google.com/app/apikey',
    stripe: 'https://dashboard.stripe.com/apikeys',
    supabase: 'https://supabase.com/dashboard',
    firebase: 'https://console.firebase.google.com',
    twilio: 'https://console.twilio.com',
    sendgrid: 'https://app.sendgrid.com/settings/api_keys',
    resend: 'https://resend.com/api-keys',
    clerk: 'https://dashboard.clerk.com',
    auth0: 'https://manage.auth0.com',
    aws: 'https://console.aws.amazon.com/iam',
    cloudinary: 'https://cloudinary.com/console',
    vercel: 'https://vercel.com/account/tokens',
    mongodb: 'https://cloud.mongodb.com',
    replicate: 'https://replicate.com/account/api-tokens',
    github: 'https://github.com/settings/tokens',
    discord: 'https://discord.com/developers/applications',
    slack: 'https://api.slack.com/apps',
    sentry: 'https://sentry.io/settings',
  };

  return docsUrls[service.toLowerCase()] || null;
}

/**
 * Group environment variables by service for UI display
 */
export function groupEnvVarsByService(vars: EnvVarRequirement[]): Map<string, EnvVarRequirement[]> {
  const grouped = new Map<string, EnvVarRequirement[]>();

  for (const v of vars) {
    const service = v.service || v.serviceName || inferService(v.name) || 'Other';
    if (!grouped.has(service)) {
      grouped.set(service, []);
    }
    grouped.get(service)!.push(v);
  }

  return grouped;
}

/**
 * Validate that required env vars are provided
 */
export function validateEnvVars(
  required: EnvVarRequirement[],
  provided: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const req of required) {
    if (!provided[req.name] || provided[req.name].trim() === '') {
      missing.push(req.name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Legacy export for backward compatibility
export const ENV_VAR_MAPPINGS = KNOWN_PACKAGE_ENV_VARS;

export default {
  detectEnvVarsFromIntent,
  detectRequiredEnvVars,
  detectEnvVarsComprehensive,
  groupEnvVarsByService,
  validateEnvVars,
  getDocsUrlForService,
  ENV_VAR_MAPPINGS,
};
