# Nango OAuth Integration - Complete Implementation Plan

> **Goal**: Replace manual credential input with OAuth "Connect" buttons that appear in the build workflow.
> **Date**: December 29, 2025
> **Status**: Ready for implementation

---

## Executive Summary

This plan implements a seamless OAuth integration system using **Nango** that:
1. Shows required integrations with "Connect" buttons in the Implementation Plan view
2. Users click "Connect" → OAuth flow opens → Tokens stored automatically
3. Build proceeds only when all required integrations are connected
4. Works identically in Builder View and Feature Agent workflows
5. Uses real branded SVG icons from `BrandIcons.tsx`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER WORKFLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User enters NLP: "Build a Stripe payment system"            │
│                          ↓                                       │
│  2. Intent Lock analyzes and identifies dependencies:           │
│     → Stripe (payment processing)                                │
│     → Supabase (database)                                        │
│                          ↓                                       │
│  3. Implementation Plan shows:                                   │
│     ┌─────────────────────────────────────────┐                 │
│     │ Required Integrations                    │                 │
│     │                                          │                 │
│     │ [Stripe Icon] Stripe     [Connect ✓]    │                 │
│     │ [Supabase]    Supabase   [Connect →]    │                 │
│     │                                          │                 │
│     │ ⚠ Connect all integrations to continue │                 │
│     └─────────────────────────────────────────┘                 │
│                          ↓                                       │
│  4. User clicks "Connect" → Nango OAuth popup opens             │
│                          ↓                                       │
│  5. OAuth completes → Token stored in Nango                     │
│                          ↓                                       │
│  6. All connected → Build proceeds automatically                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Prompts

Each prompt below is designed for **Claude Opus 4.5** in Cursor. Execute them in order.

---

### PROMPT 1: Database Schema for OAuth Connections

```
Create the database schema for storing Nango OAuth connections.

## Context
- File: `server/src/schema.ts`
- Pattern: Follow existing table patterns (e.g., `userCredentials`, `projectEnvVars`)
- ORM: Drizzle ORM with SQLite (Turso)

## Requirements

Add these tables to schema.ts:

### 1. `integrationConnections` table
Stores OAuth connections made through Nango.

```typescript
export const integrationConnections = sqliteTable('integration_connections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // Nango-specific fields
  integrationId: text('integration_id').notNull(), // e.g., 'stripe', 'supabase', 'github'
  nangoConnectionId: text('nango_connection_id').notNull(), // Nango's connection reference

  // Status tracking
  status: text('status', { enum: ['connected', 'expired', 'error', 'revoked'] }).notNull().default('connected'),
  lastSyncAt: text('last_sync_at'),
  expiresAt: text('expires_at'),

  // Metadata
  scopes: text('scopes'), // JSON array of granted scopes
  metadata: text('metadata'), // Additional provider-specific data

  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});
```

### 2. `integrationRequirements` table
Tracks which integrations a build/feature requires.

```typescript
export const integrationRequirements = sqliteTable('integration_requirements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  buildIntentId: text('build_intent_id').references(() => buildIntents.id, { onDelete: 'cascade' }),
  featureAgentId: text('feature_agent_id'), // For Feature Agent builds

  integrationId: text('integration_id').notNull(), // e.g., 'stripe'
  integrationName: text('integration_name').notNull(), // Display name
  reason: text('reason').notNull(), // Why this is needed
  required: integer('required', { mode: 'boolean' }).default(true).notNull(),

  // Status
  connected: integer('connected', { mode: 'boolean' }).default(false).notNull(),
  connectionId: text('connection_id').references(() => integrationConnections.id),

  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});
```

### 3. Add relations
```typescript
export const integrationConnectionsRelations = relations(integrationConnections, ({ one }) => ({
  user: one(users, { fields: [integrationConnections.userId], references: [users.id] }),
  project: one(projects, { fields: [integrationConnections.projectId], references: [projects.id] }),
}));

export const integrationRequirementsRelations = relations(integrationRequirements, ({ one }) => ({
  buildIntent: one(buildIntents, { fields: [integrationRequirements.buildIntentId], references: [buildIntents.id] }),
  connection: one(integrationConnections, { fields: [integrationRequirements.connectionId], references: [integrationConnections.id] }),
}));
```

## Validation
- Run `npm run build` to verify schema compiles
- Tables follow existing naming conventions (snake_case in SQL, camelCase in JS)

## DO NOT
- Modify any existing tables
- Use emojis anywhere
- Add placeholder comments
```

---

### PROMPT 2: Nango Service Integration

```
Create the Nango integration service for managing OAuth connections.

## Context
- Location: `server/src/services/integrations/nango-service.ts`
- Nango provides: OAuth flow management, token refresh, 400+ API connectors
- Nango is FREE for auth (we only need the auth, not the sync features)

## Environment Variables Required
```
NANGO_SECRET_KEY=your_nango_secret_key
NANGO_PUBLIC_KEY=your_nango_public_key
```

## Service Implementation

```typescript
/**
 * Nango Integration Service
 *
 * Handles OAuth connections via Nango's unified API.
 * Nango manages token refresh, storage, and 400+ provider integrations.
 */

import Nango from '@nangohq/node';

/**
 * COMPLETE Nango Integration Catalog
 *
 * ALL 500+ integrations supported by Nango as of December 2025.
 * Source: https://nango.dev/api-integrations
 *
 * IMPORTANT: In the workflow, only show integrations that are:
 * 1. Detected as required by the Intent Lock analysis
 * 2. Listed in the implementation plan's requiredIntegrations
 *
 * The full catalog is here for reference and future expansion.
 */

// Categories for filtering and organization
export const INTEGRATION_CATEGORIES = [
  'payments',
  'database',
  'auth',
  'ai',
  'deployment',
  'cloud',
  'vcs',
  'email',
  'storage',
  'analytics',
  'communication',
  'crm',
  'hr',
  'accounting',
  'ecommerce',
  'project-management',
  'documentation',
  'customer-support',
  'marketing',
  'security',
  'productivity',
  'other'
] as const;

export type IntegrationCategory = typeof INTEGRATION_CATEGORIES[number];

interface NangoIntegration {
  nangoId: string;
  name: string;
  category: IntegrationCategory;
  scopes?: string[];
  description?: string;
}

// COMPLETE INTEGRATION CATALOG (500+)
export const NANGO_INTEGRATIONS: Record<string, NangoIntegration> = {
  // ============================================================================
  // PAYMENTS & BILLING (15+)
  // ============================================================================
  'stripe': { nangoId: 'stripe', name: 'Stripe', category: 'payments', scopes: ['read_write'] },
  'stripe-connect': { nangoId: 'stripe-connect', name: 'Stripe Connect', category: 'payments' },
  'stripe-app': { nangoId: 'stripe-app', name: 'Stripe App', category: 'payments' },
  'paypal': { nangoId: 'paypal', name: 'PayPal', category: 'payments' },
  'paypal-sandbox': { nangoId: 'paypal-sandbox', name: 'PayPal Sandbox', category: 'payments' },
  'braintree': { nangoId: 'braintree', name: 'Braintree', category: 'payments' },
  'braintree-sandbox': { nangoId: 'braintree-sandbox', name: 'Braintree Sandbox', category: 'payments' },
  'squareup': { nangoId: 'squareup', name: 'Square', category: 'payments' },
  'squareup-sandbox': { nangoId: 'squareup-sandbox', name: 'Square Sandbox', category: 'payments' },
  'adyen': { nangoId: 'adyen', name: 'Adyen', category: 'payments' },
  'checkout-com': { nangoId: 'checkout-com', name: 'Checkout.com', category: 'payments' },
  'chargebee': { nangoId: 'chargebee', name: 'Chargebee', category: 'payments' },
  'bill': { nangoId: 'bill', name: 'Bill', category: 'payments' },
  'brex': { nangoId: 'brex', name: 'Brex', category: 'payments' },
  'ramp': { nangoId: 'ramp', name: 'Ramp', category: 'payments' },
  'razorpay': { nangoId: 'razorpay', name: 'Razorpay', category: 'payments' },
  'gumroad': { nangoId: 'gumroad', name: 'Gumroad', category: 'payments' },
  'tremendous': { nangoId: 'tremendous', name: 'Tremendous', category: 'payments' },

  // ============================================================================
  // DATABASES & BACKEND (20+)
  // ============================================================================
  'supabase': { nangoId: 'supabase', name: 'Supabase', category: 'database', scopes: ['read', 'write'] },
  'neon': { nangoId: 'neon', name: 'Neon', category: 'database' },
  'planetscale': { nangoId: 'planetscale', name: 'PlanetScale', category: 'database' },
  'firebase': { nangoId: 'firebase', name: 'Firebase', category: 'database' },
  'mongodb': { nangoId: 'mongodb', name: 'MongoDB', category: 'database' },
  'airtable': { nangoId: 'airtable', name: 'Airtable', category: 'database' },
  'airtable-pat': { nangoId: 'airtable-pat', name: 'Airtable (PAT)', category: 'database' },
  'notion': { nangoId: 'notion', name: 'Notion', category: 'database' },
  'notion-scim': { nangoId: 'notion-scim', name: 'Notion SCIM', category: 'database' },
  'coda': { nangoId: 'coda', name: 'Coda', category: 'database' },
  'grist': { nangoId: 'grist', name: 'Grist', category: 'database' },
  'quickbase': { nangoId: 'quickbase', name: 'Quickbase', category: 'database' },
  'snowflake': { nangoId: 'snowflake', name: 'Snowflake', category: 'database' },
  'snowflake-jwt': { nangoId: 'snowflake-jwt', name: 'Snowflake (JWT)', category: 'database' },
  'databricks-account': { nangoId: 'databricks-account', name: 'Databricks Account', category: 'database' },
  'databricks-workspace': { nangoId: 'databricks-workspace', name: 'Databricks Workspace', category: 'database' },
  'twenty-crm': { nangoId: 'twenty-crm', name: 'Twenty CRM', category: 'database' },
  'contentful': { nangoId: 'contentful', name: 'Contentful', category: 'database' },
  'contentstack': { nangoId: 'contentstack', name: 'Contentstack', category: 'database' },
  'smartsheet': { nangoId: 'smartsheet', name: 'Smartsheet', category: 'database' },

  // ============================================================================
  // AUTH PROVIDERS (15+)
  // ============================================================================
  'clerk': { nangoId: 'clerk', name: 'Clerk', category: 'auth' },
  'auth0': { nangoId: 'auth0', name: 'Auth0', category: 'auth' },
  'auth0-cc': { nangoId: 'auth0-cc', name: 'Auth0 (Client Credentials)', category: 'auth' },
  'okta': { nangoId: 'okta', name: 'Okta', category: 'auth' },
  'okta-preview': { nangoId: 'okta-preview', name: 'Okta Preview', category: 'auth' },
  'onelogin': { nangoId: 'onelogin', name: 'OneLogin', category: 'auth' },
  'pingone': { nangoId: 'pingone', name: 'PingOne', category: 'auth' },
  'jumpcloud': { nangoId: 'jumpcloud', name: 'JumpCloud', category: 'auth' },
  'microsoft-entra': { nangoId: 'microsoft-entra', name: 'Microsoft Entra ID', category: 'auth' },
  'cloudentity': { nangoId: 'cloudentity', name: 'Cloudentity', category: 'auth' },
  'ory': { nangoId: 'ory', name: 'Ory', category: 'auth' },
  'lastpass': { nangoId: 'lastpass', name: 'LastPass', category: 'auth' },
  '1password-scim': { nangoId: '1password-scim', name: '1Password SCIM', category: 'auth' },

  // ============================================================================
  // AI & ML SERVICES (25+)
  // ============================================================================
  'openai': { nangoId: 'openai', name: 'OpenAI', category: 'ai' },
  'openai-admin': { nangoId: 'openai-admin', name: 'OpenAI Administration', category: 'ai' },
  'anthropic': { nangoId: 'anthropic', name: 'Anthropic', category: 'ai' },
  'anthropic-admin': { nangoId: 'anthropic-admin', name: 'Anthropic Administrator', category: 'ai' },
  'replicate': { nangoId: 'replicate', name: 'Replicate', category: 'ai' },
  'fal-ai': { nangoId: 'fal', name: 'Fal.ai', category: 'ai' },
  'huggingface': { nangoId: 'huggingface', name: 'Hugging Face', category: 'ai' },
  'google-gemini': { nangoId: 'google-gemini', name: 'Google Gemini', category: 'ai' },
  'xai': { nangoId: 'xai', name: 'xAI', category: 'ai' },
  'perplexity': { nangoId: 'perplexity', name: 'Perplexity', category: 'ai' },
  'elevenlabs': { nangoId: 'elevenlabs', name: 'ElevenLabs', category: 'ai' },
  'retell-ai': { nangoId: 'retell-ai', name: 'Retell AI', category: 'ai' },
  'bland-ai': { nangoId: 'bland-ai', name: 'Bland.ai', category: 'ai' },
  'recall-ai': { nangoId: 'recall-ai', name: 'Recall.ai', category: 'ai' },
  'grammarly': { nangoId: 'grammarly', name: 'Grammarly', category: 'ai' },
  'cursor': { nangoId: 'cursor', name: 'Cursor', category: 'ai' },
  'cursor-admin': { nangoId: 'cursor-admin', name: 'Cursor Admin', category: 'ai' },
  'codegen': { nangoId: 'codegen', name: 'Codegen', category: 'ai' },
  'devin': { nangoId: 'devin', name: 'Devin', category: 'ai' },
  'openhands': { nangoId: 'openhands', name: 'OpenHands', category: 'ai' },
  'minimax': { nangoId: 'minimax', name: 'MiniMax', category: 'ai' },
  'ragie': { nangoId: 'ragie', name: 'Ragie.ai', category: 'ai' },
  'exa': { nangoId: 'exa', name: 'Exa', category: 'ai' },
  'apify': { nangoId: 'apify', name: 'Apify', category: 'ai' },

  // ============================================================================
  // CLOUD & DEPLOYMENT (20+)
  // ============================================================================
  'vercel': { nangoId: 'vercel', name: 'Vercel', category: 'deployment' },
  'netlify': { nangoId: 'netlify', name: 'Netlify', category: 'deployment' },
  'aws': { nangoId: 'aws', name: 'AWS', category: 'cloud' },
  'aws-iam': { nangoId: 'aws-iam', name: 'AWS IAM', category: 'cloud' },
  'aws-scim': { nangoId: 'aws-scim', name: 'AWS SCIM', category: 'cloud' },
  'azure-devops': { nangoId: 'azure-devops', name: 'Azure DevOps', category: 'cloud' },
  'azure-blob': { nangoId: 'azure-blob', name: 'Azure Blob Storage', category: 'storage' },
  'google-cloud-storage': { nangoId: 'google-cloud-storage', name: 'Google Cloud Storage', category: 'storage' },
  'google-service-account': { nangoId: 'google-service-account', name: 'Google Service Account', category: 'cloud' },
  'cloudflare': { nangoId: 'cloudflare', name: 'Cloudflare', category: 'cloud' },
  'digital-ocean': { nangoId: 'digital-ocean', name: 'Digital Ocean', category: 'cloud' },
  'heroku': { nangoId: 'heroku', name: 'Heroku', category: 'deployment' },
  'terraform': { nangoId: 'terraform', name: 'Terraform', category: 'cloud' },
  'docker': { nangoId: 'docker', name: 'Docker', category: 'cloud' },
  'tailscale': { nangoId: 'tailscale', name: 'Tailscale', category: 'cloud' },
  'tailscale-apikey': { nangoId: 'tailscale-apikey', name: 'Tailscale (API Key)', category: 'cloud' },

  // ============================================================================
  // VERSION CONTROL & DEV TOOLS (25+)
  // ============================================================================
  'github': { nangoId: 'github', name: 'GitHub', category: 'vcs', scopes: ['repo', 'user'] },
  'github-app': { nangoId: 'github-app', name: 'GitHub App', category: 'vcs' },
  'github-app-oauth': { nangoId: 'github-app-oauth', name: 'GitHub App OAuth', category: 'vcs' },
  'github-pat': { nangoId: 'github-pat', name: 'GitHub (PAT)', category: 'vcs' },
  'gitlab': { nangoId: 'gitlab', name: 'GitLab', category: 'vcs' },
  'gitlab-pat': { nangoId: 'gitlab-pat', name: 'GitLab (PAT)', category: 'vcs' },
  'bitbucket': { nangoId: 'bitbucket', name: 'Bitbucket', category: 'vcs' },
  'gerrit': { nangoId: 'gerrit', name: 'Gerrit', category: 'vcs' },
  'jira': { nangoId: 'jira', name: 'Jira', category: 'project-management' },
  'jira-basic': { nangoId: 'jira-basic', name: 'Jira Basic Auth', category: 'project-management' },
  'jira-datacenter': { nangoId: 'jira-datacenter', name: 'Jira Data Center', category: 'project-management' },
  'confluence': { nangoId: 'confluence', name: 'Confluence', category: 'documentation' },
  'confluence-basic': { nangoId: 'confluence-basic', name: 'Confluence Basic', category: 'documentation' },
  'confluence-datacenter': { nangoId: 'confluence-datacenter', name: 'Confluence Data Center', category: 'documentation' },
  'atlassian': { nangoId: 'atlassian', name: 'Atlassian', category: 'vcs' },
  'atlassian-admin': { nangoId: 'atlassian-admin', name: 'Atlassian Cloud Admin', category: 'vcs' },
  'linear': { nangoId: 'linear', name: 'Linear', category: 'project-management' },
  'shortcut': { nangoId: 'shortcut', name: 'Shortcut', category: 'project-management' },
  'pivotaltracker': { nangoId: 'pivotaltracker', name: 'Pivotal Tracker', category: 'project-management' },
  'sentry': { nangoId: 'sentry', name: 'Sentry', category: 'vcs' },
  'codeclimate': { nangoId: 'codeclimate', name: 'CodeClimate', category: 'vcs' },
  'snipe-it': { nangoId: 'snipe-it', name: 'Snipe-IT', category: 'vcs' },
  'datadog': { nangoId: 'datadog', name: 'Datadog', category: 'vcs' },
  'grafana': { nangoId: 'grafana', name: 'Grafana', category: 'vcs' },

  // ============================================================================
  // EMAIL & MESSAGING (20+)
  // ============================================================================
  'gmail': { nangoId: 'gmail', name: 'Gmail', category: 'email' },
  'outlook': { nangoId: 'outlook', name: 'Outlook', category: 'email' },
  'sendgrid': { nangoId: 'sendgrid', name: 'SendGrid', category: 'email' },
  'resend': { nangoId: 'resend', name: 'Resend', category: 'email' },
  'mailgun': { nangoId: 'mailgun', name: 'Mailgun', category: 'email' },
  'mailchimp': { nangoId: 'mailchimp', name: 'Mailchimp', category: 'email' },
  'brevo': { nangoId: 'brevo', name: 'Brevo', category: 'email' },
  'loops': { nangoId: 'loops', name: 'Loops.so', category: 'email' },
  'listmonk': { nangoId: 'listmonk', name: 'Listmonk', category: 'email' },
  'beehiiv': { nangoId: 'beehiiv', name: 'Beehiiv', category: 'email' },
  'convertkit': { nangoId: 'convertkit', name: 'ConvertKit', category: 'email' },
  'front': { nangoId: 'front', name: 'Front', category: 'email' },
  'missive': { nangoId: 'missive', name: 'Missive', category: 'email' },
  'emarsys': { nangoId: 'emarsys', name: 'Emarsys', category: 'email' },
  'cyberimpact': { nangoId: 'cyberimpact', name: 'Cyberimpact', category: 'email' },

  // ============================================================================
  // COMMUNICATION & CHAT (20+)
  // ============================================================================
  'slack': { nangoId: 'slack', name: 'Slack', category: 'communication' },
  'discord': { nangoId: 'discord', name: 'Discord', category: 'communication' },
  'twilio': { nangoId: 'twilio', name: 'Twilio', category: 'communication' },
  'microsoft-teams': { nangoId: 'microsoft-teams', name: 'Microsoft Teams', category: 'communication' },
  'zoom': { nangoId: 'zoom', name: 'Zoom', category: 'communication' },
  'google-chat': { nangoId: 'google-chat', name: 'Google Chat', category: 'communication' },
  'webex': { nangoId: 'webex', name: 'Webex', category: 'communication' },
  'whatsapp-business': { nangoId: 'whatsapp-business', name: 'WhatsApp Business', category: 'communication' },
  'ringcentral': { nangoId: 'ringcentral', name: 'RingCentral', category: 'communication' },
  'ringcentral-sandbox': { nangoId: 'ringcentral-sandbox', name: 'RingCentral Sandbox', category: 'communication' },
  'dialpad': { nangoId: 'dialpad', name: 'Dialpad', category: 'communication' },
  'dialpad-sandbox': { nangoId: 'dialpad-sandbox', name: 'Dialpad Sandbox', category: 'communication' },
  'aircall': { nangoId: 'aircall', name: 'Aircall', category: 'communication' },
  'aircall-basic': { nangoId: 'aircall-basic', name: 'Aircall (Basic Auth)', category: 'communication' },
  'callrail': { nangoId: 'callrail', name: 'CallRail', category: 'communication' },
  'clicksend': { nangoId: 'clicksend', name: 'ClickSend', category: 'communication' },
  'vimeo': { nangoId: 'vimeo', name: 'Vimeo', category: 'communication' },
  'loom-scim': { nangoId: 'loom-scim', name: 'Loom SCIM', category: 'communication' },
  'grain': { nangoId: 'grain', name: 'Grain', category: 'communication' },
  'tldv': { nangoId: 'tldv', name: 'tl;dv', category: 'communication' },
  'fathom': { nangoId: 'fathom', name: 'Fathom', category: 'communication' },
  'fireflies': { nangoId: 'fireflies', name: 'Fireflies', category: 'communication' },
  'chorus': { nangoId: 'chorus', name: 'Chorus', category: 'communication' },
  'gong': { nangoId: 'gong', name: 'Gong', category: 'communication' },
  'gong-oauth': { nangoId: 'gong-oauth', name: 'Gong OAuth', category: 'communication' },
  'avoma': { nangoId: 'avoma', name: 'Avoma', category: 'communication' },
  'clari-copilot': { nangoId: 'clari-copilot', name: 'Clari Copilot', category: 'communication' },

  // ============================================================================
  // CRM & SALES (40+)
  // ============================================================================
  'salesforce': { nangoId: 'salesforce', name: 'Salesforce', category: 'crm' },
  'salesforce-sandbox': { nangoId: 'salesforce-sandbox', name: 'Salesforce Sandbox', category: 'crm' },
  'salesforce-experience': { nangoId: 'salesforce-experience', name: 'Salesforce Experience Cloud', category: 'crm' },
  'salesforce-datacloud': { nangoId: 'salesforce-datacloud', name: 'Salesforce Data Cloud', category: 'crm' },
  'hubspot': { nangoId: 'hubspot', name: 'HubSpot', category: 'crm' },
  'pipedrive': { nangoId: 'pipedrive', name: 'Pipedrive', category: 'crm' },
  'zoho-crm': { nangoId: 'zoho-crm', name: 'Zoho CRM', category: 'crm' },
  'zoho': { nangoId: 'zoho', name: 'Zoho', category: 'crm' },
  'zoho-bigin': { nangoId: 'zoho-bigin', name: 'Zoho Bigin', category: 'crm' },
  'zoho-desk': { nangoId: 'zoho-desk', name: 'Zoho Desk', category: 'customer-support' },
  'zoho-recruit': { nangoId: 'zoho-recruit', name: 'Zoho Recruit', category: 'hr' },
  'zoho-people': { nangoId: 'zoho-people', name: 'Zoho People', category: 'hr' },
  'zoho-books': { nangoId: 'zoho-books', name: 'Zoho Books', category: 'accounting' },
  'zoho-invoice': { nangoId: 'zoho-invoice', name: 'Zoho Invoice', category: 'accounting' },
  'zoho-inventory': { nangoId: 'zoho-inventory', name: 'Zoho Inventory', category: 'ecommerce' },
  'zoho-mail': { nangoId: 'zoho-mail', name: 'Zoho Mail', category: 'email' },
  'zoho-calendar': { nangoId: 'zoho-calendar', name: 'Zoho Calendar', category: 'productivity' },
  'close': { nangoId: 'close', name: 'Close', category: 'crm' },
  'copper': { nangoId: 'copper', name: 'Copper', category: 'crm' },
  'copper-apikey': { nangoId: 'copper-apikey', name: 'Copper (API Key)', category: 'crm' },
  'affinity': { nangoId: 'affinity', name: 'Affinity', category: 'crm' },
  'attio': { nangoId: 'attio', name: 'Attio', category: 'crm' },
  'folk': { nangoId: 'folk', name: 'Folk', category: 'crm' },
  'streak': { nangoId: 'streak', name: 'Streak', category: 'crm' },
  'insightly': { nangoId: 'insightly', name: 'Insightly', category: 'crm' },
  'wealthbox': { nangoId: 'wealthbox', name: 'Wealthbox', category: 'crm' },
  'redtail-crm': { nangoId: 'redtail-crm', name: 'Redtail CRM', category: 'crm' },
  'apollo': { nangoId: 'apollo', name: 'Apollo', category: 'crm' },
  'apollo-oauth': { nangoId: 'apollo-oauth', name: 'Apollo OAuth', category: 'crm' },
  'outreach': { nangoId: 'outreach', name: 'Outreach', category: 'crm' },
  'salesloft': { nangoId: 'salesloft', name: 'SalesLoft', category: 'crm' },
  'lemlist': { nangoId: 'lemlist', name: 'lemlist', category: 'crm' },
  'instantly': { nangoId: 'instantly', name: 'Instantly', category: 'crm' },
  'smartlead': { nangoId: 'smartlead', name: 'Smartlead.ai', category: 'crm' },
  'aimfox': { nangoId: 'aimfox', name: 'Aimfox', category: 'crm' },
  'la-growth-machine': { nangoId: 'la-growth-machine', name: 'La Growth Machine', category: 'crm' },
  'heyreach': { nangoId: 'heyreach', name: 'HeyReach', category: 'crm' },
  'contactout': { nangoId: 'contactout', name: 'ContactOut', category: 'crm' },
  'findymail': { nangoId: 'findymail', name: 'FindyMail', category: 'crm' },
  'icypeas': { nangoId: 'icypeas', name: 'Icypeas', category: 'crm' },
  'prospeo': { nangoId: 'prospeo', name: 'Prospeo', category: 'crm' },
  'leadmagic': { nangoId: 'leadmagic', name: 'LeadMagic', category: 'crm' },
  'bettercontact': { nangoId: 'bettercontact', name: 'BetterContact', category: 'crm' },
  'wiza': { nangoId: 'wiza', name: 'Wiza', category: 'crm' },
  'zoominfo': { nangoId: 'zoominfo', name: 'ZoomInfo', category: 'crm' },
  'people-data-labs': { nangoId: 'people-data-labs', name: 'People Data Labs', category: 'crm' },
  'builtwith': { nangoId: 'builtwith', name: 'BuiltWith', category: 'crm' },

  // ============================================================================
  // ANALYTICS & BI (20+)
  // ============================================================================
  'posthog': { nangoId: 'posthog', name: 'PostHog', category: 'analytics' },
  'mixpanel': { nangoId: 'mixpanel', name: 'Mixpanel', category: 'analytics' },
  'amplitude': { nangoId: 'amplitude', name: 'Amplitude', category: 'analytics' },
  'segment': { nangoId: 'segment', name: 'Segment', category: 'analytics' },
  'heap': { nangoId: 'heap', name: 'Heap', category: 'analytics' },
  'google-analytics': { nangoId: 'google-analytics', name: 'Google Analytics', category: 'analytics' },
  'google-search-console': { nangoId: 'google-search-console', name: 'Google Search Console', category: 'analytics' },
  'semrush': { nangoId: 'semrush', name: 'Semrush', category: 'analytics' },
  'statista': { nangoId: 'statista', name: 'Statista', category: 'analytics' },
  'klipfolio': { nangoId: 'klipfolio', name: 'Klipfolio', category: 'analytics' },
  'tapclicks': { nangoId: 'tapclicks', name: 'TapClicks', category: 'analytics' },
  'metabase': { nangoId: 'metabase', name: 'Metabase', category: 'analytics' },
  'tableau': { nangoId: 'tableau', name: 'Tableau', category: 'analytics' },
  'microsoft-power-bi': { nangoId: 'microsoft-power-bi', name: 'Microsoft Power BI', category: 'analytics' },
  'pendo': { nangoId: 'pendo', name: 'Pendo', category: 'analytics' },
  'chattermill': { nangoId: 'chattermill', name: 'Chattermill', category: 'analytics' },
  'evaluagent': { nangoId: 'evaluagent', name: 'EvaluAgent', category: 'analytics' },
  'medallia': { nangoId: 'medallia', name: 'Medallia', category: 'analytics' },

  // ============================================================================
  // HR & RECRUITING (50+)
  // ============================================================================
  'workday': { nangoId: 'workday', name: 'Workday', category: 'hr' },
  'workday-oauth': { nangoId: 'workday-oauth', name: 'Workday OAuth', category: 'hr' },
  'bamboohr': { nangoId: 'bamboohr', name: 'BambooHR', category: 'hr' },
  'bamboohr-basic': { nangoId: 'bamboohr-basic', name: 'BambooHR (Basic Auth)', category: 'hr' },
  'hibob': { nangoId: 'hibob', name: 'HiBob', category: 'hr' },
  'personio': { nangoId: 'personio', name: 'Personio', category: 'hr' },
  'personio-v2': { nangoId: 'personio-v2', name: 'Personio v2', category: 'hr' },
  'personio-recruiting': { nangoId: 'personio-recruiting', name: 'Personio Recruiting', category: 'hr' },
  'rippling': { nangoId: 'rippling', name: 'Rippling', category: 'hr' },
  'gusto': { nangoId: 'gusto', name: 'Gusto', category: 'hr' },
  'gusto-demo': { nangoId: 'gusto-demo', name: 'Gusto Demo', category: 'hr' },
  'deel': { nangoId: 'deel', name: 'Deel', category: 'hr' },
  'deel-sandbox': { nangoId: 'deel-sandbox', name: 'Deel Sandbox', category: 'hr' },
  'justworks': { nangoId: 'justworks', name: 'Justworks', category: 'hr' },
  'zenefits': { nangoId: 'zenefits', name: 'Zenefits', category: 'hr' },
  'lattice': { nangoId: 'lattice', name: 'Lattice', category: 'hr' },
  'namely': { nangoId: 'namely', name: 'Namely', category: 'hr' },
  'namely-pat': { nangoId: 'namely-pat', name: 'Namely (PAT)', category: 'hr' },
  'paylocity': { nangoId: 'paylocity', name: 'Paylocity', category: 'hr' },
  'paylocity-weblink': { nangoId: 'paylocity-weblink', name: 'Paylocity Weblink', category: 'hr' },
  'paychex': { nangoId: 'paychex', name: 'Paychex', category: 'hr' },
  'paycom': { nangoId: 'paycom', name: 'Paycom', category: 'hr' },
  'paycor': { nangoId: 'paycor', name: 'Paycor', category: 'hr' },
  'paycor-sandbox': { nangoId: 'paycor-sandbox', name: 'Paycor Sandbox', category: 'hr' },
  'payfit': { nangoId: 'payfit', name: 'PayFit', category: 'hr' },
  'adp': { nangoId: 'adp', name: 'ADP', category: 'hr' },
  'adp-lyric': { nangoId: 'adp-lyric', name: 'ADP Lyric', category: 'hr' },
  'adp-workforce-now': { nangoId: 'adp-workforce-now', name: 'ADP Workforce Now', category: 'hr' },
  'adp-run': { nangoId: 'adp-run', name: 'RUN Powered by ADP', category: 'hr' },
  'ukg-pro': { nangoId: 'ukg-pro', name: 'UKG Pro', category: 'hr' },
  'ukg-ready': { nangoId: 'ukg-ready', name: 'UKG Ready', category: 'hr' },
  'ukg-pro-wfm': { nangoId: 'ukg-pro-wfm', name: 'UKG Pro (Workforce Management)', category: 'hr' },
  'dayforce': { nangoId: 'dayforce', name: 'Dayforce', category: 'hr' },
  'employment-hero': { nangoId: 'employment-hero', name: 'Employment Hero', category: 'hr' },
  'factorial': { nangoId: 'factorial', name: 'Factorial', category: 'hr' },
  'sage-hr': { nangoId: 'sage-hr', name: 'Sage HR', category: 'hr' },
  'sage-people': { nangoId: 'sage-people', name: 'Sage People', category: 'hr' },
  'sap-successfactors': { nangoId: 'sap-successfactors', name: 'SAP SuccessFactors', category: 'hr' },
  'oracle-hcm': { nangoId: 'oracle-hcm', name: 'Oracle Fusion Cloud HCM', category: 'hr' },
  'greenhouse': { nangoId: 'greenhouse', name: 'Greenhouse', category: 'hr' },
  'greenhouse-basic': { nangoId: 'greenhouse-basic', name: 'Greenhouse (Basic Auth)', category: 'hr' },
  'greenhouse-harvest': { nangoId: 'greenhouse-harvest', name: 'Greenhouse Harvest API', category: 'hr' },
  'greenhouse-jobboard': { nangoId: 'greenhouse-jobboard', name: 'Greenhouse Job Board API', category: 'hr' },
  'lever': { nangoId: 'lever', name: 'Lever', category: 'hr' },
  'lever-basic': { nangoId: 'lever-basic', name: 'Lever Basic Auth', category: 'hr' },
  'lever-sandbox': { nangoId: 'lever-sandbox', name: 'Lever Sandbox', category: 'hr' },
  'ashby': { nangoId: 'ashby', name: 'Ashby', category: 'hr' },
  'teamtailor': { nangoId: 'teamtailor', name: 'Teamtailor', category: 'hr' },
  'workable': { nangoId: 'workable', name: 'Workable', category: 'hr' },
  'workable-oauth': { nangoId: 'workable-oauth', name: 'Workable OAuth', category: 'hr' },
  'jobvite': { nangoId: 'jobvite', name: 'Jobvite', category: 'hr' },
  'jazzhr': { nangoId: 'jazzhr', name: 'JazzHR', category: 'hr' },
  'breezy-hr': { nangoId: 'breezy-hr', name: 'Breezy HR', category: 'hr' },
  'smartrecruiters': { nangoId: 'smartrecruiters', name: 'SmartRecruiters', category: 'hr' },
  'recruitee': { nangoId: 'recruitee', name: 'Recruitee', category: 'hr' },
  'recruiterflow': { nangoId: 'recruiterflow', name: 'Recruiterflow', category: 'hr' },
  'recruit-crm': { nangoId: 'recruit-crm', name: 'Recruit CRM', category: 'hr' },
  'manatal': { nangoId: 'manatal', name: 'Manatal', category: 'hr' },
  'firefish': { nangoId: 'firefish', name: 'Firefish', category: 'hr' },
  'jobadder': { nangoId: 'jobadder', name: 'JobAdder', category: 'hr' },
  'jobdiva': { nangoId: 'jobdiva', name: 'JobDiva', category: 'hr' },
  'bullhorn': { nangoId: 'bullhorn', name: 'Bullhorn', category: 'hr' },
  'hackerrank': { nangoId: 'hackerrank', name: 'HackerRank', category: 'hr' },
  'certn': { nangoId: 'certn', name: 'Certn', category: 'hr' },
  'certn-partner': { nangoId: 'certn-partner', name: 'Certn Partner', category: 'hr' },
  'checkr': { nangoId: 'checkr', name: 'Checkr', category: 'hr' },
  'checkr-staging': { nangoId: 'checkr-staging', name: 'Checkr Staging', category: 'hr' },
  'trakstar-hire': { nangoId: 'trakstar-hire', name: 'Trakstar Hire', category: 'hr' },
  'lessonly': { nangoId: 'lessonly', name: 'Lessonly', category: 'hr' },
  'guru': { nangoId: 'guru', name: 'Guru', category: 'hr' },
  'guru-scim': { nangoId: 'guru-scim', name: 'Guru SCIM', category: 'hr' },

  // ============================================================================
  // ACCOUNTING & FINANCE (30+)
  // ============================================================================
  'quickbooks': { nangoId: 'quickbooks', name: 'QuickBooks', category: 'accounting' },
  'quickbooks-sandbox': { nangoId: 'quickbooks-sandbox', name: 'QuickBooks Sandbox', category: 'accounting' },
  'xero': { nangoId: 'xero', name: 'Xero', category: 'accounting' },
  'xero-cc': { nangoId: 'xero-cc', name: 'Xero (Client Credentials)', category: 'accounting' },
  'freshbooks': { nangoId: 'freshbooks', name: 'FreshBooks', category: 'accounting' },
  'wave-accounting': { nangoId: 'wave-accounting', name: 'Wave Accounting', category: 'accounting' },
  'sage': { nangoId: 'sage', name: 'Sage', category: 'accounting' },
  'sage-intacct': { nangoId: 'sage-intacct', name: 'Sage Intacct', category: 'accounting' },
  'sage-intacct-oauth': { nangoId: 'sage-intacct-oauth', name: 'Sage Intacct (OAuth)', category: 'accounting' },
  'netsuite': { nangoId: 'netsuite', name: 'NetSuite', category: 'accounting' },
  'netsuite-tba': { nangoId: 'netsuite-tba', name: 'NetSuite TBA', category: 'accounting' },
  'microsoft-business-central': { nangoId: 'microsoft-business-central', name: 'Microsoft Business Central', category: 'accounting' },
  'sap-business-one': { nangoId: 'sap-business-one', name: 'SAP Business One', category: 'accounting' },
  'sap-concur': { nangoId: 'sap-concur', name: 'SAP Concur', category: 'accounting' },
  'sap-fieldglass': { nangoId: 'sap-fieldglass', name: 'SAP Fieldglass', category: 'accounting' },
  'sap-s4hana': { nangoId: 'sap-s4hana', name: 'SAP S/4HANA Cloud', category: 'accounting' },
  'oracle-cloud-identity': { nangoId: 'oracle-cloud-identity', name: 'Oracle Cloud Identity', category: 'accounting' },
  'e-conomic': { nangoId: 'e-conomic', name: 'e-conomic', category: 'accounting' },
  'fortnox': { nangoId: 'fortnox', name: 'Fortnox', category: 'accounting' },
  'holded': { nangoId: 'holded', name: 'Holded', category: 'accounting' },
  'pennylane': { nangoId: 'pennylane', name: 'Pennylane', category: 'accounting' },
  'pennylane-company': { nangoId: 'pennylane-company', name: 'Pennylane (Company API)', category: 'accounting' },
  'datev': { nangoId: 'datev', name: 'Datev', category: 'accounting' },
  'twinfield': { nangoId: 'twinfield', name: 'Twinfield', category: 'accounting' },
  'harvest': { nangoId: 'harvest', name: 'Harvest', category: 'accounting' },
  'float': { nangoId: 'float', name: 'Float', category: 'accounting' },
  'anrok': { nangoId: 'anrok', name: 'Anrok', category: 'accounting' },
  'avalara': { nangoId: 'avalara', name: 'Avalara', category: 'accounting' },
  'avalara-sandbox': { nangoId: 'avalara-sandbox', name: 'Avalara Sandbox', category: 'accounting' },
  'checkhq': { nangoId: 'checkhq', name: 'Check HQ', category: 'accounting' },
  'expensify': { nangoId: 'expensify', name: 'Expensify', category: 'accounting' },
  'zuora': { nangoId: 'zuora', name: 'Zuora', category: 'accounting' },

  // ============================================================================
  // E-COMMERCE & RETAIL (30+)
  // ============================================================================
  'shopify': { nangoId: 'shopify', name: 'Shopify', category: 'ecommerce' },
  'shopify-apikey': { nangoId: 'shopify-apikey', name: 'Shopify (API Key)', category: 'ecommerce' },
  'shopify-partner': { nangoId: 'shopify-partner', name: 'Shopify Partner', category: 'ecommerce' },
  'shopify-scim': { nangoId: 'shopify-scim', name: 'Shopify SCIM', category: 'ecommerce' },
  'woocommerce': { nangoId: 'woocommerce', name: 'WooCommerce', category: 'ecommerce' },
  'bigcommerce': { nangoId: 'bigcommerce', name: 'BigCommerce', category: 'ecommerce' },
  'squarespace': { nangoId: 'squarespace', name: 'Squarespace', category: 'ecommerce' },
  'webflow': { nangoId: 'webflow', name: 'Webflow', category: 'ecommerce' },
  'amazon': { nangoId: 'amazon', name: 'Amazon', category: 'ecommerce' },
  'amazon-selling-partner': { nangoId: 'amazon-selling-partner', name: 'Amazon Selling Partner', category: 'ecommerce' },
  'amazon-selling-partner-beta': { nangoId: 'amazon-selling-partner-beta', name: 'Amazon Selling Partner (Beta)', category: 'ecommerce' },
  'ebay': { nangoId: 'ebay', name: 'eBay', category: 'ecommerce' },
  'ebay-sandbox': { nangoId: 'ebay-sandbox', name: 'eBay Sandbox', category: 'ecommerce' },
  'etsy': { nangoId: 'etsy', name: 'Etsy', category: 'ecommerce' },
  'recharge': { nangoId: 'recharge', name: 'ReCharge', category: 'ecommerce' },
  'skio': { nangoId: 'skio', name: 'Skio', category: 'ecommerce' },
  'appstle': { nangoId: 'appstle', name: 'Appstle Subscriptions', category: 'ecommerce' },
  'loop-returns': { nangoId: 'loop-returns', name: 'Loop Returns', category: 'ecommerce' },
  'fairing': { nangoId: 'fairing', name: 'Fairing', category: 'ecommerce' },
  'thrivecart': { nangoId: 'thrivecart', name: 'ThriveCart', category: 'ecommerce' },
  'thrivecart-oauth': { nangoId: 'thrivecart-oauth', name: 'ThriveCart OAuth', category: 'ecommerce' },
  'shipstation': { nangoId: 'shipstation', name: 'ShipStation', category: 'ecommerce' },
  'shipstation-v2': { nangoId: 'shipstation-v2', name: 'ShipStation v2', category: 'ecommerce' },
  'commercetools': { nangoId: 'commercetools', name: 'Commercetools', category: 'ecommerce' },
  'odoo': { nangoId: 'odoo', name: 'Odoo', category: 'ecommerce' },
  'odoo-cc': { nangoId: 'odoo-cc', name: 'Odoo Client Credentials', category: 'ecommerce' },
  'yotpo': { nangoId: 'yotpo', name: 'Yotpo', category: 'ecommerce' },
  'sellsy': { nangoId: 'sellsy', name: 'Sellsy', category: 'ecommerce' },
  'sellsy-cc': { nangoId: 'sellsy-cc', name: 'Sellsy (Client Credentials)', category: 'ecommerce' },

  // ============================================================================
  // PROJECT MANAGEMENT (20+)
  // ============================================================================
  'monday': { nangoId: 'monday', name: 'Monday.com', category: 'project-management' },
  'asana': { nangoId: 'asana', name: 'Asana', category: 'project-management' },
  'asana-scim': { nangoId: 'asana-scim', name: 'Asana SCIM', category: 'project-management' },
  'trello': { nangoId: 'trello', name: 'Trello', category: 'project-management' },
  'trello-scim': { nangoId: 'trello-scim', name: 'Trello SCIM', category: 'project-management' },
  'clickup': { nangoId: 'clickup', name: 'ClickUp', category: 'project-management' },
  'wrike': { nangoId: 'wrike', name: 'Wrike', category: 'project-management' },
  'basecamp': { nangoId: 'basecamp', name: 'Basecamp', category: 'project-management' },
  'teamwork': { nangoId: 'teamwork', name: 'Teamwork', category: 'project-management' },
  'teamleader-focus': { nangoId: 'teamleader-focus', name: 'Teamleader Focus', category: 'project-management' },
  'productboard': { nangoId: 'productboard', name: 'Productboard', category: 'project-management' },
  'canny': { nangoId: 'canny', name: 'Canny', category: 'project-management' },
  'rocketlane': { nangoId: 'rocketlane', name: 'Rocketlane', category: 'project-management' },
  'plain': { nangoId: 'plain', name: 'Plain', category: 'project-management' },
  'rootly': { nangoId: 'rootly', name: 'Rootly', category: 'project-management' },
  'incident-io': { nangoId: 'incident-io', name: 'Incident.io', category: 'project-management' },
  'pagerduty': { nangoId: 'pagerduty', name: 'PagerDuty', category: 'project-management' },
  'timely': { nangoId: 'timely', name: 'Timely', category: 'project-management' },
  'todoist': { nangoId: 'todoist', name: 'Todoist', category: 'project-management' },
  'ticktick': { nangoId: 'ticktick', name: 'TickTick', category: 'project-management' },

  // ============================================================================
  // CUSTOMER SUPPORT (25+)
  // ============================================================================
  'zendesk': { nangoId: 'zendesk', name: 'Zendesk', category: 'customer-support' },
  'zendesk-sell': { nangoId: 'zendesk-sell', name: 'Zendesk Sell', category: 'customer-support' },
  'intercom': { nangoId: 'intercom', name: 'Intercom', category: 'customer-support' },
  'freshdesk': { nangoId: 'freshdesk', name: 'Freshdesk', category: 'customer-support' },
  'freshsales': { nangoId: 'freshsales', name: 'Freshsales', category: 'customer-support' },
  'freshservice': { nangoId: 'freshservice', name: 'Freshservice', category: 'customer-support' },
  'freshteam': { nangoId: 'freshteam', name: 'Freshteam', category: 'customer-support' },
  'helpscout-mailbox': { nangoId: 'helpscout-mailbox', name: 'Help Scout Mailbox', category: 'customer-support' },
  'helpscout-docs': { nangoId: 'helpscout-docs', name: 'Help Scout Docs', category: 'customer-support' },
  'gorgias': { nangoId: 'gorgias', name: 'Gorgias', category: 'customer-support' },
  'gorgias-basic': { nangoId: 'gorgias-basic', name: 'Gorgias Basic Auth', category: 'customer-support' },
  'kustomer': { nangoId: 'kustomer', name: 'Kustomer', category: 'customer-support' },
  'crisp': { nangoId: 'crisp', name: 'Crisp', category: 'customer-support' },
  'dixa': { nangoId: 'dixa', name: 'Dixa', category: 'customer-support' },
  'gainsight-cc': { nangoId: 'gainsight-cc', name: 'Gainsight CC', category: 'customer-support' },
  'refiner': { nangoId: 'refiner', name: 'Refiner', category: 'customer-support' },
  'typeform': { nangoId: 'typeform', name: 'Typeform', category: 'customer-support' },
  'jotform': { nangoId: 'jotform', name: 'JotForm', category: 'customer-support' },
  'fillout': { nangoId: 'fillout', name: 'Fillout', category: 'customer-support' },
  'fillout-apikey': { nangoId: 'fillout-apikey', name: 'Fillout (API Key)', category: 'customer-support' },
  'qualtrics': { nangoId: 'qualtrics', name: 'Qualtrics', category: 'customer-support' },
  'survey-monkey': { nangoId: 'survey-monkey', name: 'Survey Monkey', category: 'customer-support' },
  'atlas': { nangoId: 'atlas', name: 'Atlas.so', category: 'customer-support' },
  'elevio': { nangoId: 'elevio', name: 'Elevio', category: 'customer-support' },
  'document360': { nangoId: 'document360', name: 'Document360', category: 'customer-support' },
  'slab': { nangoId: 'slab', name: 'Slab', category: 'customer-support' },

  // ============================================================================
  // DESIGN & CREATIVE (15+)
  // ============================================================================
  'figma': { nangoId: 'figma', name: 'Figma', category: 'productivity' },
  'figma-scim': { nangoId: 'figma-scim', name: 'Figma SCIM', category: 'productivity' },
  'figjam': { nangoId: 'figjam', name: 'FigJam', category: 'productivity' },
  'canva': { nangoId: 'canva', name: 'Canva', category: 'productivity' },
  'canva-scim': { nangoId: 'canva-scim', name: 'Canva SCIM', category: 'productivity' },
  'miro': { nangoId: 'miro', name: 'Miro', category: 'productivity' },
  'miro-scim': { nangoId: 'miro-scim', name: 'Miro SCIM', category: 'productivity' },
  'mural': { nangoId: 'mural', name: 'Mural', category: 'productivity' },
  'lucid-scim': { nangoId: 'lucid-scim', name: 'Lucid SCIM', category: 'productivity' },
  'adobe': { nangoId: 'adobe', name: 'Adobe', category: 'productivity' },
  'adobe-umapi': { nangoId: 'adobe-umapi', name: 'Adobe UMAPI', category: 'productivity' },
  'adobe-workfront': { nangoId: 'adobe-workfront', name: 'Adobe Workfront', category: 'productivity' },
  'autodesk': { nangoId: 'autodesk', name: 'Autodesk', category: 'productivity' },
  'builder-io': { nangoId: 'builder-io', name: 'Builder.io', category: 'productivity' },
  'builder-io-private': { nangoId: 'builder-io-private', name: 'Builder.io Private', category: 'productivity' },

  // ============================================================================
  // SOCIAL MEDIA & MARKETING (30+)
  // ============================================================================
  'facebook': { nangoId: 'facebook', name: 'Facebook', category: 'marketing' },
  'instagram': { nangoId: 'instagram', name: 'Instagram', category: 'marketing' },
  'twitter': { nangoId: 'twitter', name: 'Twitter', category: 'marketing' },
  'twitter-v2': { nangoId: 'twitter-v2', name: 'Twitter v2', category: 'marketing' },
  'twitter-oauth2-cc': { nangoId: 'twitter-oauth2-cc', name: 'Twitter OAuth2 CC', category: 'marketing' },
  'linkedin': { nangoId: 'linkedin', name: 'LinkedIn', category: 'marketing' },
  'tiktok': { nangoId: 'tiktok', name: 'TikTok', category: 'marketing' },
  'tiktok-ads': { nangoId: 'tiktok-ads', name: 'TikTok Ads', category: 'marketing' },
  'tiktok-personal': { nangoId: 'tiktok-personal', name: 'TikTok Personal', category: 'marketing' },
  'snapchat': { nangoId: 'snapchat', name: 'Snapchat', category: 'marketing' },
  'snapchat-ads': { nangoId: 'snapchat-ads', name: 'Snapchat Ads', category: 'marketing' },
  'pinterest': { nangoId: 'pinterest', name: 'Pinterest', category: 'marketing' },
  'youtube': { nangoId: 'youtube', name: 'YouTube', category: 'marketing' },
  'reddit': { nangoId: 'reddit', name: 'Reddit', category: 'marketing' },
  'tumblr': { nangoId: 'tumblr', name: 'Tumblr', category: 'marketing' },
  'twitch': { nangoId: 'twitch', name: 'Twitch', category: 'marketing' },
  'spotify': { nangoId: 'spotify', name: 'Spotify', category: 'marketing' },
  'spotify-oauth2-cc': { nangoId: 'spotify-oauth2-cc', name: 'Spotify OAuth2 CC', category: 'marketing' },
  'google-ads': { nangoId: 'google-ads', name: 'Google Ads', category: 'marketing' },
  'microsoft-ads': { nangoId: 'microsoft-ads', name: 'Microsoft Ads', category: 'marketing' },
  'marketo': { nangoId: 'marketo', name: 'Marketo', category: 'marketing' },
  'activecampaign': { nangoId: 'activecampaign', name: 'ActiveCampaign', category: 'marketing' },
  'klaviyo': { nangoId: 'klaviyo', name: 'Klaviyo', category: 'marketing' },
  'klaviyo-oauth': { nangoId: 'klaviyo-oauth', name: 'Klaviyo OAuth', category: 'marketing' },
  'braze': { nangoId: 'braze', name: 'Braze', category: 'marketing' },
  'podium': { nangoId: 'podium', name: 'Podium', category: 'marketing' },
  'typefully': { nangoId: 'typefully', name: 'Typefully', category: 'marketing' },
  'linkhut': { nangoId: 'linkhut', name: 'Linkhut', category: 'marketing' },
  'bitly': { nangoId: 'bitly', name: 'Bitly', category: 'marketing' },
  'eventbrite': { nangoId: 'eventbrite', name: 'Eventbrite', category: 'marketing' },
  'luma': { nangoId: 'luma', name: 'Luma', category: 'marketing' },

  // ============================================================================
  // SECURITY & COMPLIANCE (20+)
  // ============================================================================
  'vanta': { nangoId: 'vanta', name: 'Vanta', category: 'security' },
  'drata': { nangoId: 'drata', name: 'Drata', category: 'security' },
  'lumos': { nangoId: 'lumos', name: 'Lumos', category: 'security' },
  'conductorone': { nangoId: 'conductorone', name: 'ConductorOne', category: 'security' },
  'torii': { nangoId: 'torii', name: 'Torii', category: 'security' },
  'crowdstrike': { nangoId: 'crowdstrike', name: 'CrowdStrike', category: 'security' },
  'malwarebytes': { nangoId: 'malwarebytes', name: 'Malwarebytes', category: 'security' },
  'bitdefender': { nangoId: 'bitdefender', name: 'Bitdefender', category: 'security' },
  'sophos': { nangoId: 'sophos', name: 'Sophos Central', category: 'security' },
  'knowbe4': { nangoId: 'knowbe4', name: 'KnowBe4', category: 'security' },
  'perimeter81': { nangoId: 'perimeter81', name: 'Perimeter81', category: 'security' },
  'ironclad': { nangoId: 'ironclad', name: 'Ironclad', category: 'security' },
  'docusign': { nangoId: 'docusign', name: 'DocuSign', category: 'security' },
  'docusign-sandbox': { nangoId: 'docusign-sandbox', name: 'DocuSign Sandbox', category: 'security' },
  'signnow': { nangoId: 'signnow', name: 'SignNow', category: 'security' },
  'signnow-sandbox': { nangoId: 'signnow-sandbox', name: 'SignNow Sandbox', category: 'security' },
  'boldsign': { nangoId: 'boldsign', name: 'BoldSign', category: 'security' },
  'dropbox-sign': { nangoId: 'dropbox-sign', name: 'Dropbox Sign', category: 'security' },
  'pandadoc': { nangoId: 'pandadoc', name: 'PandaDoc', category: 'security' },
  'pandadoc-apikey': { nangoId: 'pandadoc-apikey', name: 'PandaDoc (API Key)', category: 'security' },

  // ============================================================================
  // IT & DEVICE MANAGEMENT (20+)
  // ============================================================================
  'jamf-pro': { nangoId: 'jamf-pro', name: 'Jamf Pro', category: 'security' },
  'jamf-pro-bearer': { nangoId: 'jamf-pro-bearer', name: 'Jamf Pro (Bearer)', category: 'security' },
  'kandji': { nangoId: 'kandji', name: 'Kandji', category: 'security' },
  'ninjaone': { nangoId: 'ninjaone', name: 'NinjaOne RMM', category: 'security' },
  'datto-rmm': { nangoId: 'datto-rmm', name: 'Datto RMM', category: 'security' },
  'datto-rmm-password': { nangoId: 'datto-rmm-password', name: 'Datto RMM (Password Grant)', category: 'security' },
  'auvik': { nangoId: 'auvik', name: 'Auvik', category: 'security' },
  'connectwise-psa': { nangoId: 'connectwise-psa', name: 'ConnectWise PSA', category: 'security' },
  'connectwise-psa-staging': { nangoId: 'connectwise-psa-staging', name: 'ConnectWise PSA Staging', category: 'security' },
  'autotask': { nangoId: 'autotask', name: 'AutoTask', category: 'security' },
  'servicenow': { nangoId: 'servicenow', name: 'ServiceNow', category: 'security' },
  'passportal': { nangoId: 'passportal', name: 'Passportal', category: 'security' },
  'keeper-scim': { nangoId: 'keeper-scim', name: 'Keeper SCIM', category: 'security' },
  'roam-scim': { nangoId: 'roam-scim', name: 'Roam SCIM', category: 'security' },

  // ============================================================================
  // PRODUCTIVITY & OFFICE (30+)
  // ============================================================================
  'microsoft': { nangoId: 'microsoft', name: 'Microsoft', category: 'productivity' },
  'microsoft-tenant': { nangoId: 'microsoft-tenant', name: 'Microsoft Tenant Specific', category: 'productivity' },
  'microsoft-cc': { nangoId: 'microsoft-cc', name: 'Microsoft (Client Credentials)', category: 'productivity' },
  'microsoft-admin': { nangoId: 'microsoft-admin', name: 'Microsoft Admin', category: 'productivity' },
  'microsoft-excel': { nangoId: 'microsoft-excel', name: 'Microsoft Excel', category: 'productivity' },
  'onenote': { nangoId: 'onenote', name: 'OneNote', category: 'productivity' },
  'onedrive-business': { nangoId: 'onedrive-business', name: 'OneDrive for Business', category: 'storage' },
  'onedrive-personal': { nangoId: 'onedrive-personal', name: 'OneDrive Personal', category: 'storage' },
  'sharepoint': { nangoId: 'sharepoint', name: 'SharePoint Online', category: 'storage' },
  'sharepoint-v2': { nangoId: 'sharepoint-v2', name: 'SharePoint Online v2', category: 'storage' },
  'sharepoint-cc': { nangoId: 'sharepoint-cc', name: 'SharePoint (Client Credentials)', category: 'storage' },
  'google': { nangoId: 'google', name: 'Google', category: 'productivity' },
  'google-calendar': { nangoId: 'google-calendar', name: 'Google Calendar', category: 'productivity' },
  'google-docs': { nangoId: 'google-docs', name: 'Google Docs', category: 'productivity' },
  'google-slides': { nangoId: 'google-slides', name: 'Google Slides', category: 'productivity' },
  'google-sheets': { nangoId: 'gsheet', name: 'Google Sheets', category: 'productivity' },
  'google-drive': { nangoId: 'google-drive', name: 'Google Drive', category: 'storage' },
  'google-workspace-admin': { nangoId: 'google-workspace-admin', name: 'Google Workspace Admin', category: 'productivity' },
  'dropbox': { nangoId: 'dropbox', name: 'Dropbox', category: 'storage' },
  'box': { nangoId: 'box', name: 'Box', category: 'storage' },
  'egnyte': { nangoId: 'egnyte', name: 'Egnyte', category: 'storage' },
  'calendly': { nangoId: 'calendly', name: 'Calendly', category: 'productivity' },
  'acuity': { nangoId: 'acuity', name: 'Acuity Scheduling', category: 'productivity' },
  'cal-com': { nangoId: 'cal-com', name: 'Cal.com', category: 'productivity' },
  'cal-com-v1': { nangoId: 'cal-com-v1', name: 'Cal.com v1', category: 'productivity' },
  'setmore': { nangoId: 'setmore', name: 'Setmore', category: 'productivity' },
  'trafft': { nangoId: 'trafft', name: 'Trafft', category: 'productivity' },
  'wakatime': { nangoId: 'wakatime', name: 'WakaTime', category: 'productivity' },
  'exist': { nangoId: 'exist', name: 'Exist', category: 'productivity' },
  'readwise': { nangoId: 'readwise', name: 'Readwise', category: 'productivity' },
  'readwise-reader': { nangoId: 'readwise-reader', name: 'Readwise Reader', category: 'productivity' },

  // ============================================================================
  // AUTOMATION & INTEGRATION (15+)
  // ============================================================================
  'zapier': { nangoId: 'zapier', name: 'Zapier', category: 'other' },
  'zapier-nla': { nangoId: 'zapier-nla', name: 'Zapier NLA', category: 'other' },
  'zapier-scim': { nangoId: 'zapier-scim', name: 'Zapier SCIM', category: 'other' },
  'make': { nangoId: 'make', name: 'Make', category: 'other' },
  'pipedream': { nangoId: 'pipedream', name: 'Pipedream', category: 'other' },
  'pipedream-cc': { nangoId: 'pipedream-cc', name: 'Pipedream (Client Credentials)', category: 'other' },
  'rapidapi': { nangoId: 'rapidapi', name: 'RapidAPI', category: 'other' },
  'mcp-generic': { nangoId: 'mcp-generic', name: 'MCP Generic', category: 'other' },
  'private-api-basic': { nangoId: 'private-api-basic', name: 'Private API (Basic Auth)', category: 'other' },
  'private-api-bearer': { nangoId: 'private-api-bearer', name: 'Private API (Bearer Auth)', category: 'other' },
  'unauthenticated': { nangoId: 'unauthenticated', name: 'Unauthenticated', category: 'other' },

  // ============================================================================
  // HEALTHCARE & FITNESS (15+)
  // ============================================================================
  'drchrono': { nangoId: 'drchrono', name: 'DrChrono', category: 'other' },
  'practicefusion': { nangoId: 'practicefusion', name: 'PracticeFusion', category: 'other' },
  'health-gorilla': { nangoId: 'health-gorilla', name: 'Health Gorilla', category: 'other' },
  'availity': { nangoId: 'availity', name: 'Availity', category: 'other' },
  'veeva-vault': { nangoId: 'veeva-vault', name: 'Veeva Vault', category: 'other' },
  'mindbody': { nangoId: 'mindbody', name: 'Mindbody', category: 'other' },
  'rock-gym-pro': { nangoId: 'rock-gym-pro', name: 'Rock Gym Pro', category: 'other' },
  'fitbit': { nangoId: 'fitbit', name: 'Fitbit', category: 'other' },
  'garmin': { nangoId: 'garmin', name: 'Garmin', category: 'other' },
  'strava': { nangoId: 'strava', name: 'Strava', category: 'other' },
  'strava-web': { nangoId: 'strava-web', name: 'Strava Web', category: 'other' },
  'whoop': { nangoId: 'whoop', name: 'Whoop', category: 'other' },
  'oura': { nangoId: 'oura', name: 'Oura', category: 'other' },
  'coros': { nangoId: 'coros', name: 'Coros', category: 'other' },
  'coros-sandbox': { nangoId: 'coros-sandbox', name: 'Coros Sandbox', category: 'other' },

  // ============================================================================
  // MISCELLANEOUS (30+)
  // ============================================================================
  'wordpress': { nangoId: 'wordpress', name: 'WordPress', category: 'other' },
  'drupal': { nangoId: 'drupal', name: 'Drupal', category: 'other' },
  'ghost-admin': { nangoId: 'ghost-admin', name: 'Ghost Admin', category: 'other' },
  'ghost-content': { nangoId: 'ghost-content', name: 'Ghost Content', category: 'other' },
  'discourse': { nangoId: 'discourse', name: 'Discourse', category: 'other' },
  'circle': { nangoId: 'circle', name: 'Circle.so', category: 'other' },
  'nationbuilder': { nangoId: 'nationbuilder', name: 'NationBuilder', category: 'other' },
  'blackbaud': { nangoId: 'blackbaud', name: 'Blackbaud', category: 'other' },
  'blackbaud-basic': { nangoId: 'blackbaud-basic', name: 'Blackbaud (Basic Auth)', category: 'other' },
  'keap': { nangoId: 'keap', name: 'Keap', category: 'other' },
  'intuit': { nangoId: 'intuit', name: 'Intuit', category: 'other' },
  'apple-app-store': { nangoId: 'apple-app-store', name: 'Apple App Store', category: 'other' },
  'google-play': { nangoId: 'google-play', name: 'Google Play', category: 'other' },
  'epic-games': { nangoId: 'epic-games', name: 'Epic Games', category: 'other' },
  'battlenet': { nangoId: 'battlenet', name: 'Battle.net', category: 'other' },
  'osu': { nangoId: 'osu', name: 'osu!', category: 'other' },
  'uber': { nangoId: 'uber', name: 'Uber', category: 'other' },
  'booking': { nangoId: 'booking', name: 'Booking.com', category: 'other' },
  'apaleo': { nangoId: 'apaleo', name: 'Apaleo', category: 'other' },
  'buildium': { nangoId: 'buildium', name: 'Buildium', category: 'other' },
  'entrata': { nangoId: 'entrata', name: 'Entrata', category: 'other' },
  'unanet': { nangoId: 'unanet', name: 'Unanet', category: 'other' },
  'accelo': { nangoId: 'accelo', name: 'Accelo', category: 'other' },
  'servicem8': { nangoId: 'servicem8', name: 'ServiceM8', category: 'other' },
  'jobber': { nangoId: 'jobber', name: 'Jobber', category: 'other' },
  'companycam': { nangoId: 'companycam', name: 'CompanyCam', category: 'other' },
  'fellow': { nangoId: 'fellow', name: 'Fellow', category: 'other' },
  'momentum': { nangoId: 'momentum', name: 'Momentum.io', category: 'other' },
  'envoy': { nangoId: 'envoy', name: 'Envoy', category: 'other' },
  'pingboard': { nangoId: 'pingboard', name: 'Pingboard', category: 'other' },
  'brightcrowd': { nangoId: 'brightcrowd', name: 'BrightCrowd', category: 'other' },
  'fanvue': { nangoId: 'fanvue', name: 'Fanvue', category: 'other' },
  'unipile': { nangoId: 'unipile', name: 'Unipile', category: 'other' },
  'valley': { nangoId: 'valley', name: 'Valley', category: 'other' },
  'valley-apikey': { nangoId: 'valley-apikey', name: 'Valley (API Key)', category: 'other' },
  'firstbase': { nangoId: 'firstbase', name: 'Firstbase', category: 'other' },
  'prive': { nangoId: 'prive', name: 'Prive', category: 'other' },
  'pax8': { nangoId: 'pax8', name: 'Pax8', category: 'other' },
  'hover': { nangoId: 'hover', name: 'Hover', category: 'other' },
  'algolia': { nangoId: 'algolia', name: 'Algolia', category: 'other' },
  'scrape-do': { nangoId: 'scrape-do', name: 'Scrape.do', category: 'other' },
  'sedna': { nangoId: 'sedna', name: 'Sedna', category: 'other' },
  'sedna-basic': { nangoId: 'sedna-basic', name: 'Sedna Basic Auth', category: 'other' },
  'kintone': { nangoId: 'kintone', name: 'Kintone', category: 'other' },
  'kintone-user': { nangoId: 'kintone-user', name: 'Kintone User API', category: 'other' },
  'nextcloud': { nangoId: 'nextcloud', name: 'NextCloud', category: 'other' },
  'docuware': { nangoId: 'docuware', name: 'DocuWare', category: 'other' },
  'coupa': { nangoId: 'coupa', name: 'Coupa Compass', category: 'other' },
  'addepar': { nangoId: 'addepar', name: 'Addepar', category: 'other' },
  'addepar-basic': { nangoId: 'addepar-basic', name: 'Addepar (Basic Auth)', category: 'other' },
  'datacandy': { nangoId: 'datacandy', name: 'DataCandy', category: 'other' },
  'fiserv': { nangoId: 'fiserv', name: 'Fiserv', category: 'other' },
  'fiserv-apikey': { nangoId: 'fiserv-apikey', name: 'Fiserv API Key', category: 'other' },
  'gebrüder-weiss': { nangoId: 'gebrüder-weiss', name: 'Gebrüder Weiss', category: 'other' },
  'highlevel': { nangoId: 'highlevel', name: 'HighLevel', category: 'other' },
  'highlevel-whitelabel': { nangoId: 'highlevel-whitelabel', name: 'HighLevel White Label', category: 'other' },
  'mip-cloud': { nangoId: 'mip-cloud', name: 'Mip Cloud', category: 'other' },
  'mip-onpremise': { nangoId: 'mip-onpremise', name: 'Mip On Premise', category: 'other' },
  'onlogist': { nangoId: 'onlogist', name: 'OnLogist', category: 'other' },
  'precisefp': { nangoId: 'precisefp', name: 'PreciseFP', category: 'other' },
  'smugmug': { nangoId: 'smugmug', name: 'Smugmug', category: 'other' },
  'splitwise': { nangoId: 'splitwise', name: 'Splitwise', category: 'other' },
  'stack-exchange': { nangoId: 'stack-exchange', name: 'Stack Exchange', category: 'other' },
  'tsheets-team': { nangoId: 'tsheets-team', name: 'TSheets Team', category: 'other' },
  'wildix-pbx': { nangoId: 'wildix-pbx', name: 'Wildix PBX', category: 'other' },
  'yahoo': { nangoId: 'yahoo', name: 'Yahoo', category: 'other' },
  'yandex': { nangoId: 'yandex', name: 'Yandex', category: 'other' },
} as const;

export type IntegrationId = keyof typeof NANGO_INTEGRATIONS;

interface NangoConnection {
  connectionId: string;
  providerConfigKey: string;
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    expiresAt?: string;
  };
}

class NangoService {
  private client: Nango;

  constructor() {
    const secretKey = process.env.NANGO_SECRET_KEY;
    if (!secretKey) {
      console.warn('[NangoService] NANGO_SECRET_KEY not set - OAuth features disabled');
    }
    this.client = new Nango({ secretKey: secretKey || '' });
  }

  /**
   * Generate the OAuth URL for a user to connect an integration
   */
  async getOAuthUrl(params: {
    integrationId: IntegrationId;
    userId: string;
    projectId?: string;
    redirectUrl: string;
  }): Promise<string> {
    const integration = NANGO_INTEGRATIONS[params.integrationId];
    if (!integration) {
      throw new Error(`Unknown integration: ${params.integrationId}`);
    }

    // Connection ID is unique per user+integration
    const connectionId = `${params.userId}_${params.integrationId}`;

    const authUrl = await this.client.auth(integration.nangoId, connectionId, {
      detectClosedAuthWindow: true,
    });

    return authUrl.url;
  }

  /**
   * Get connection status and credentials for an integration
   */
  async getConnection(params: {
    integrationId: IntegrationId;
    userId: string;
  }): Promise<NangoConnection | null> {
    const integration = NANGO_INTEGRATIONS[params.integrationId];
    if (!integration) return null;

    const connectionId = `${params.userId}_${params.integrationId}`;

    try {
      const connection = await this.client.getConnection(integration.nangoId, connectionId);
      return {
        connectionId,
        providerConfigKey: integration.nangoId,
        credentials: connection.credentials as NangoConnection['credentials'],
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the access token for an integration (auto-refreshes if expired)
   */
  async getAccessToken(params: {
    integrationId: IntegrationId;
    userId: string;
  }): Promise<string | null> {
    const connection = await this.getConnection(params);
    if (!connection) return null;

    // Nango handles token refresh automatically
    return connection.credentials.accessToken || connection.credentials.apiKey || null;
  }

  /**
   * Delete a connection
   */
  async deleteConnection(params: {
    integrationId: IntegrationId;
    userId: string;
  }): Promise<void> {
    const integration = NANGO_INTEGRATIONS[params.integrationId];
    if (!integration) return;

    const connectionId = `${params.userId}_${params.integrationId}`;
    await this.client.deleteConnection(integration.nangoId, connectionId);
  }

  /**
   * Check if a user has connected a specific integration
   */
  async isConnected(params: {
    integrationId: IntegrationId;
    userId: string;
  }): Promise<boolean> {
    const connection = await this.getConnection(params);
    return connection !== null;
  }

  /**
   * Get all connections for a user
   */
  async getUserConnections(userId: string): Promise<Array<{
    integrationId: IntegrationId;
    connected: boolean;
    connectionId?: string;
  }>> {
    const results: Array<{
      integrationId: IntegrationId;
      connected: boolean;
      connectionId?: string;
    }> = [];

    for (const integrationId of Object.keys(NANGO_INTEGRATIONS) as IntegrationId[]) {
      const connection = await this.getConnection({ integrationId, userId });
      results.push({
        integrationId,
        connected: connection !== null,
        connectionId: connection?.connectionId,
      });
    }

    return results;
  }

  /**
   * Get integration metadata
   */
  getIntegrationInfo(integrationId: IntegrationId) {
    return NANGO_INTEGRATIONS[integrationId];
  }

  /**
   * List all supported integrations
   */
  listIntegrations() {
    return Object.entries(NANGO_INTEGRATIONS).map(([id, info]) => ({
      id: id as IntegrationId,
      ...info,
    }));
  }
}

export const nangoService = new NangoService();
export default nangoService;
```

## Validation
- Run `npm run build`
- Verify service exports correctly
- Check that NANGO_INTEGRATIONS covers all needed providers

## DO NOT
- Use mock data
- Add placeholder API keys
- Use emojis
```

---

### PROMPT 3: OAuth API Routes

```
Create the API routes for OAuth connection management.

## Context
- Location: `server/src/routes/integrations.ts`
- Pattern: Follow existing route patterns in `server/src/routes/`
- Must integrate with existing auth middleware

## Implementation

```typescript
/**
 * Integration OAuth Routes
 *
 * Handles OAuth connection flows via Nango.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { nangoService, NANGO_INTEGRATIONS, type IntegrationId } from '../services/integrations/nango-service';
import { db } from '../db';
import { integrationConnections, integrationRequirements } from '../schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/integrations/available
 * List all available integrations
 */
router.get('/available', async (_req, res) => {
  try {
    const integrations = nangoService.listIntegrations();
    res.json({ integrations });
  } catch (error) {
    console.error('[Integrations] Failed to list integrations:', error);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

/**
 * GET /api/integrations/connections
 * Get user's current connections
 */
router.get('/connections', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get connections from database
    const dbConnections = await db.select()
      .from(integrationConnections)
      .where(eq(integrationConnections.userId, userId));

    // Verify each connection is still valid with Nango
    const connections = await Promise.all(
      dbConnections.map(async (conn) => {
        const isValid = await nangoService.isConnected({
          integrationId: conn.integrationId as IntegrationId,
          userId,
        });
        return {
          ...conn,
          isValid,
        };
      })
    );

    res.json({ connections });
  } catch (error) {
    console.error('[Integrations] Failed to get connections:', error);
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

/**
 * POST /api/integrations/connect
 * Initiate OAuth flow for an integration
 */
router.post('/connect', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { integrationId, projectId, redirectUrl } = req.body as {
      integrationId: string;
      projectId?: string;
      redirectUrl: string;
    };

    if (!integrationId || !NANGO_INTEGRATIONS[integrationId as IntegrationId]) {
      return res.status(400).json({ error: 'Invalid integration ID' });
    }

    const authUrl = await nangoService.getOAuthUrl({
      integrationId: integrationId as IntegrationId,
      userId,
      projectId,
      redirectUrl,
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('[Integrations] Failed to initiate OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * POST /api/integrations/callback
 * Handle OAuth callback and store connection
 */
router.post('/callback', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { integrationId, projectId } = req.body as {
      integrationId: string;
      projectId?: string;
    };

    // Verify connection exists in Nango
    const connection = await nangoService.getConnection({
      integrationId: integrationId as IntegrationId,
      userId,
    });

    if (!connection) {
      return res.status(400).json({ error: 'Connection not found' });
    }

    // Store in database
    const [stored] = await db.insert(integrationConnections)
      .values({
        userId,
        projectId,
        integrationId,
        nangoConnectionId: connection.connectionId,
        status: 'connected',
        expiresAt: connection.credentials.expiresAt,
        lastSyncAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [integrationConnections.userId, integrationConnections.integrationId],
        set: {
          status: 'connected',
          nangoConnectionId: connection.connectionId,
          expiresAt: connection.credentials.expiresAt,
          lastSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    // Update any pending requirements for this integration
    if (projectId) {
      await db.update(integrationRequirements)
        .set({
          connected: true,
          connectionId: stored.id
        })
        .where(and(
          eq(integrationRequirements.integrationId, integrationId),
          // Match by buildIntentId that belongs to this project
        ));
    }

    res.json({
      success: true,
      connection: stored,
      integration: nangoService.getIntegrationInfo(integrationId as IntegrationId),
    });
  } catch (error) {
    console.error('[Integrations] OAuth callback failed:', error);
    res.status(500).json({ error: 'OAuth callback failed' });
  }
});

/**
 * DELETE /api/integrations/disconnect/:integrationId
 * Disconnect an integration
 */
router.delete('/disconnect/:integrationId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { integrationId } = req.params;

    // Delete from Nango
    await nangoService.deleteConnection({
      integrationId: integrationId as IntegrationId,
      userId,
    });

    // Update database
    await db.update(integrationConnections)
      .set({ status: 'revoked', updatedAt: new Date().toISOString() })
      .where(and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.integrationId, integrationId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('[Integrations] Disconnect failed:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * GET /api/integrations/requirements/:buildIntentId
 * Get integration requirements for a build
 */
router.get('/requirements/:buildIntentId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { buildIntentId } = req.params;

    // Get requirements
    const requirements = await db.select()
      .from(integrationRequirements)
      .where(eq(integrationRequirements.buildIntentId, buildIntentId));

    // Check connection status for each
    const enrichedRequirements = await Promise.all(
      requirements.map(async (req) => {
        const isConnected = await nangoService.isConnected({
          integrationId: req.integrationId as IntegrationId,
          userId,
        });
        return {
          ...req,
          connected: isConnected,
          integration: nangoService.getIntegrationInfo(req.integrationId as IntegrationId),
        };
      })
    );

    res.json({ requirements: enrichedRequirements });
  } catch (error) {
    console.error('[Integrations] Failed to get requirements:', error);
    res.status(500).json({ error: 'Failed to get requirements' });
  }
});

/**
 * GET /api/integrations/token/:integrationId
 * Get access token for an integration (for backend use)
 */
router.get('/token/:integrationId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { integrationId } = req.params;

    const token = await nangoService.getAccessToken({
      integrationId: integrationId as IntegrationId,
      userId,
    });

    if (!token) {
      return res.status(404).json({ error: 'No connection found' });
    }

    res.json({ token });
  } catch (error) {
    console.error('[Integrations] Failed to get token:', error);
    res.status(500).json({ error: 'Failed to get token' });
  }
});

export default router;
```

## Register Route
In `server/src/index.ts`, add:
```typescript
import integrationsRouter from './routes/integrations';
app.use('/api/integrations', integrationsRouter);
```

## Validation
- Run `npm run build`
- All routes follow existing patterns
- Auth middleware is properly applied

## DO NOT
- Skip auth middleware on protected routes
- Use mock tokens
- Add placeholder data
```

---

### PROMPT 4: Integration Connect UI Component

```
Create the OAuth Connect UI component that replaces manual credential input.

## Context
- Location: `src/components/integrations/IntegrationConnectView.tsx`
- Replaces: `CredentialsCollectionView.tsx` in the workflow
- Must use brand icons from `src/components/icons/BrandIcons.tsx`
- Design: Premium glassmorphism, amber accents, no emojis

## Implementation

```tsx
/**
 * Integration Connect View
 *
 * Displays required integrations with OAuth "Connect" buttons.
 * Replaces manual credential input with one-click OAuth.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandIcon, BrandIcon } from '@/components/icons/BrandIcons';
import { apiClient } from '@/lib/api-client';
import './IntegrationConnectView.css';

interface IntegrationRequirement {
  id: string;
  integrationId: string;
  integrationName: string;
  reason: string;
  required: boolean;
  connected: boolean;
  integration?: {
    name: string;
    category: string;
  };
}

interface IntegrationConnectViewProps {
  requirements: IntegrationRequirement[];
  buildIntentId?: string;
  featureAgentId?: string;
  projectId?: string;
  onAllConnected: () => void;
}

// Custom SVG icons
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M5 6V4a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M5 1h6v6M11 1L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 7v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export function IntegrationConnectView({
  requirements,
  buildIntentId,
  featureAgentId,
  projectId,
  onAllConnected,
}: IntegrationConnectViewProps) {
  const [connectionStates, setConnectionStates] = useState<Record<string, 'idle' | 'connecting' | 'connected' | 'error'>>({});
  const [oauthWindow, setOauthWindow] = useState<Window | null>(null);

  const connectedCount = requirements.filter(r => r.connected || connectionStates[r.integrationId] === 'connected').length;
  const requiredCount = requirements.filter(r => r.required).length;
  const allRequiredConnected = requirements
    .filter(r => r.required)
    .every(r => r.connected || connectionStates[r.integrationId] === 'connected');

  // Check for OAuth callback completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'nango-oauth-complete') {
        const { integrationId, success } = event.data;
        setConnectionStates(prev => ({
          ...prev,
          [integrationId]: success ? 'connected' : 'error',
        }));
        oauthWindow?.close();
        setOauthWindow(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [oauthWindow]);

  // Auto-proceed when all required are connected
  useEffect(() => {
    if (allRequiredConnected && requirements.length > 0) {
      const timer = setTimeout(onAllConnected, 1000);
      return () => clearTimeout(timer);
    }
  }, [allRequiredConnected, requirements.length, onAllConnected]);

  const handleConnect = useCallback(async (integrationId: string) => {
    setConnectionStates(prev => ({ ...prev, [integrationId]: 'connecting' }));

    try {
      const redirectUrl = `${window.location.origin}/oauth-callback`;
      const { authUrl } = await apiClient.post<{ authUrl: string }>('/api/integrations/connect', {
        integrationId,
        projectId,
        redirectUrl,
      });

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'oauth-popup',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      setOauthWindow(popup);

      // Poll for popup closure
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Verify connection was made
          apiClient.post('/api/integrations/callback', { integrationId, projectId })
            .then(() => {
              setConnectionStates(prev => ({ ...prev, [integrationId]: 'connected' }));
            })
            .catch(() => {
              setConnectionStates(prev => ({ ...prev, [integrationId]: 'idle' }));
            });
        }
      }, 500);

    } catch (error) {
      console.error('[IntegrationConnect] OAuth failed:', error);
      setConnectionStates(prev => ({ ...prev, [integrationId]: 'error' }));
    }
  }, [projectId]);

  return (
    <div className="integration-connect">
      {/* Header */}
      <motion.div
        className="integration-connect__header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="integration-connect__header-icon">
          <LockIcon />
        </div>
        <div className="integration-connect__header-text">
          <h3 className="integration-connect__title">Connect Integrations</h3>
          <p className="integration-connect__subtitle">
            {connectedCount}/{requiredCount} required connected
          </p>
        </div>
      </motion.div>

      {/* Progress bar */}
      <div className="integration-connect__progress">
        <motion.div
          className="integration-connect__progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${(connectedCount / Math.max(requiredCount, 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Integration cards */}
      <div className="integration-connect__cards">
        <AnimatePresence mode="sync">
          {requirements.map((req, index) => {
            const state = connectionStates[req.integrationId] || (req.connected ? 'connected' : 'idle');
            const isConnected = state === 'connected' || req.connected;

            return (
              <motion.div
                key={req.id}
                className={`integration-card ${isConnected ? 'integration-card--connected' : ''} ${req.required ? 'integration-card--required' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={!isConnected ? { y: -2, scale: 1.01 } : {}}
              >
                {/* Card glow effect */}
                <div className="integration-card__glow" />

                <div className="integration-card__content">
                  {/* Integration icon and info */}
                  <div className="integration-card__header">
                    <div className="integration-card__icon">
                      <BrandIcon name={req.integrationId} size={24} />
                    </div>
                    <div className="integration-card__info">
                      <div className="integration-card__name">
                        {req.integrationName}
                        {req.required && (
                          <span className="integration-card__required-badge">Required</span>
                        )}
                      </div>
                      <div className="integration-card__reason">{req.reason}</div>
                    </div>
                  </div>

                  {/* Connect button or status */}
                  <div className="integration-card__action">
                    {isConnected ? (
                      <motion.div
                        className="integration-card__connected"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <CheckIcon />
                        <span>Connected</span>
                      </motion.div>
                    ) : state === 'connecting' ? (
                      <div className="integration-card__connecting">
                        <span className="integration-card__spinner" />
                        <span>Connecting...</span>
                      </div>
                    ) : (
                      <motion.button
                        className="integration-card__connect-btn"
                        onClick={() => handleConnect(req.integrationId)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span>Connect</span>
                        <ArrowRightIcon />
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* 3D edge effects */}
                <div className="integration-card__edge-right" />
                <div className="integration-card__edge-bottom" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* All connected message */}
      {allRequiredConnected && requirements.length > 0 && (
        <motion.div
          className="integration-connect__complete"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <CheckIcon />
          <span>All integrations connected! Starting build...</span>
        </motion.div>
      )}

      {/* Security note */}
      <div className="integration-connect__security">
        <LockIcon />
        <span>OAuth tokens are securely stored and automatically refreshed</span>
      </div>
    </div>
  );
}

export default IntegrationConnectView;
```

## Validation
- Uses `BrandIcon` from `@/components/icons/BrandIcons`
- No emojis anywhere
- Premium design with glassmorphism
- Smooth animations with Framer Motion

## DO NOT
- Use Lucide React icons
- Use emojis
- Add placeholder integrations
```

---

### PROMPT 5: CSS Styles for Integration Connect

```
Create the CSS styles for the Integration Connect View.

## Context
- Location: `src/components/integrations/IntegrationConnectView.css`
- Must match KripTik AI design system (glassmorphism, amber accents, depth)
- No purple/pink gradients (anti-slop rule)

## Implementation

```css
/**
 * Integration Connect View Styles
 * Premium glassmorphism design with 3D depth
 */

.integration-connect {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Header */
.integration-connect__header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.integration-connect__header-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(245, 168, 108, 0.15), rgba(245, 168, 108, 0.05));
  border: 1px solid rgba(245, 168, 108, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #F5A86C;
}

.integration-connect__title {
  font-family: var(--font-heading, 'Cal Sans', system-ui);
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.integration-connect__subtitle {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  margin-top: 0.25rem;
}

/* Progress bar */
.integration-connect__progress {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.integration-connect__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #F5A86C, #E89B5C);
  border-radius: 2px;
  transform-origin: left;
}

/* Cards container */
.integration-connect__cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Individual integration card */
.integration-card {
  position: relative;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    rgba(30, 30, 35, 0.9),
    rgba(25, 25, 30, 0.95)
  );
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.25s cubic-bezier(0.23, 1, 0.32, 1);
  overflow: hidden;
}

.integration-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.integration-card--connected {
  border-color: rgba(52, 211, 153, 0.3);
  background: linear-gradient(
    135deg,
    rgba(52, 211, 153, 0.05),
    rgba(30, 30, 35, 0.9)
  );
}

.integration-card--required:not(.integration-card--connected) {
  border-color: rgba(245, 168, 108, 0.2);
}

/* Card glow effect */
.integration-card__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 0%,
    rgba(245, 168, 108, 0.08) 0%,
    transparent 60%
  );
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.integration-card:hover .integration-card__glow {
  opacity: 1;
}

.integration-card--connected .integration-card__glow {
  background: radial-gradient(
    ellipse at 50% 0%,
    rgba(52, 211, 153, 0.08) 0%,
    transparent 60%
  );
  opacity: 1;
}

/* 3D edge effects */
.integration-card__edge-right {
  position: absolute;
  right: 0;
  top: 10%;
  bottom: 10%;
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.08),
    transparent
  );
}

.integration-card__edge-bottom {
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    rgba(255, 255, 255, 0.06),
    transparent
  );
}

/* Card content */
.integration-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.integration-card__header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex: 1;
  min-width: 0;
}

.integration-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.integration-card--connected .integration-card__icon {
  background: rgba(52, 211, 153, 0.1);
  border-color: rgba(52, 211, 153, 0.2);
}

.integration-card__info {
  flex: 1;
  min-width: 0;
}

.integration-card__name {
  font-family: var(--font-heading, 'Outfit', system-ui);
  font-size: 0.9375rem;
  font-weight: 500;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.integration-card__required-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: rgba(245, 168, 108, 0.15);
  color: #F5A86C;
  border: 1px solid rgba(245, 168, 108, 0.2);
}

.integration-card__reason {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 0.25rem;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Action area */
.integration-card__action {
  flex-shrink: 0;
}

.integration-card__connect-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  background: linear-gradient(135deg, #F5A86C, #E89B5C);
  color: #1a1a1a;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(245, 168, 108, 0.25);
}

.integration-card__connect-btn:hover {
  box-shadow: 0 6px 16px rgba(245, 168, 108, 0.35);
}

.integration-card__connected {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  background: rgba(52, 211, 153, 0.15);
  color: #34D399;
  border: 1px solid rgba(52, 211, 153, 0.25);
}

.integration-card__connecting {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.integration-card__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #F5A86C;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Complete message */
.integration-connect__complete {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(52, 211, 153, 0.05));
  border: 1px solid rgba(52, 211, 153, 0.2);
  color: #34D399;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Security note */
.integration-connect__security {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  justify-content: center;
  padding-top: 0.5rem;
}
```

## Validation
- Amber accent color: #F5A86C
- No purple/pink gradients
- Glassmorphism backgrounds
- 3D depth effects
- Smooth animations

## DO NOT
- Use purple or pink colors
- Use flat designs without depth
```

---

### PROMPT 6: Wire Integration Connect into Workflow

```
Wire the IntegrationConnectView into the Feature Agent and Builder View workflows.

## Context
The new flow is:
1. Implementation Plan shows required integrations
2. After plan approval, IntegrationConnectView shows (replaces CredentialsCollectionView)
3. User clicks "Connect" for each required integration
4. Once all connected, build proceeds

## Files to Modify

### 1. FeatureAgentTile.tsx
Replace CredentialsCollectionView with IntegrationConnectView.

```tsx
// Add import
import { IntegrationConnectView } from '@/components/integrations/IntegrationConnectView';

// In the render, replace the credentials section:

// BEFORE:
{tile.status === 'awaiting_credentials' && (tile.requiredCredentials?.length || 0) > 0 && (
  <CredentialsCollectionView
    credentials={tile.requiredCredentials || []}
    onCredentialsSubmit={submitCredentials}
  />
)}

// AFTER:
{tile.status === 'awaiting_credentials' && (tile.integrationRequirements?.length || 0) > 0 && (
  <IntegrationConnectView
    requirements={tile.integrationRequirements || []}
    featureAgentId={agentId}
    projectId={tile.projectId}
    onAllConnected={() => {
      addMessage(agentId, {
        type: 'status',
        content: 'All integrations connected. Starting implementation...',
        timestamp: Date.now()
      });
      setTileStatus(agentId, 'implementing');
    }}
  />
)}
```

### 2. useFeatureAgentTileStore.ts
Add integration requirements to the tile state.

```typescript
// Add to FeatureAgentTile interface:
interface FeatureAgentTile {
  // ... existing fields
  integrationRequirements?: IntegrationRequirement[];
}

interface IntegrationRequirement {
  id: string;
  integrationId: string;
  integrationName: string;
  reason: string;
  required: boolean;
  connected: boolean;
}

// Add action:
setIntegrationRequirements: (agentId: string, requirements: IntegrationRequirement[]) => void;
```

### 3. ImplementationPlanView.tsx
Show required integrations in the plan view.

Add a section at the top of the plan that shows required integrations:

```tsx
{plan.requiredIntegrations && plan.requiredIntegrations.length > 0 && (
  <div className="plan-integrations">
    <h4 className="plan-integrations__title">Required Integrations</h4>
    <div className="plan-integrations__list">
      {plan.requiredIntegrations.map(int => (
        <div key={int.id} className="plan-integration">
          <BrandIcon name={int.integrationId} size={20} />
          <span className="plan-integration__name">{int.name}</span>
          <span className="plan-integration__reason">{int.reason}</span>
        </div>
      ))}
    </div>
    <p className="plan-integrations__note">
      You'll connect these after approving the plan
    </p>
  </div>
)}
```

### 4. Build Loop Integration
In `server/src/services/automation/build-loop.ts`, modify Phase 1 to:
1. Analyze intent for required integrations
2. Store requirements in database
3. Wait for user to connect integrations before proceeding

```typescript
// In Phase 1 (INITIALIZATION):
async executePhase1_Initialization(): Promise<void> {
  // ... existing code

  // Identify required integrations from intent
  const integrations = await this.identifyRequiredIntegrations();

  if (integrations.length > 0) {
    // Store requirements
    await this.storeIntegrationRequirements(integrations);

    // Emit event for frontend
    this.emit('integrations_required', { integrations });

    // Wait for connections (frontend handles OAuth flow)
    await this.waitForIntegrationConnections(integrations);
  }

  // Load integration tokens for build
  await this.loadIntegrationTokens();

  // ... continue with initialization
}

private async identifyRequiredIntegrations(): Promise<IntegrationRequirement[]> {
  // Analyze intent lock for technology requirements
  const intent = this.state.intentContract;
  const requirements: IntegrationRequirement[] = [];

  // Check for payment references
  if (this.containsPaymentFeatures(intent)) {
    requirements.push({
      integrationId: 'stripe',
      integrationName: 'Stripe',
      reason: 'Payment processing',
      required: true,
    });
  }

  // Check for database references
  if (this.containsDatabaseFeatures(intent)) {
    requirements.push({
      integrationId: 'supabase',
      integrationName: 'Supabase',
      reason: 'Database and authentication',
      required: true,
    });
  }

  // Check for AI features
  if (this.containsAIFeatures(intent)) {
    requirements.push({
      integrationId: 'openai',
      integrationName: 'OpenAI',
      reason: 'AI/ML capabilities',
      required: true,
    });
  }

  // ... more detection logic

  return requirements;
}
```

## Validation
- IntegrationConnectView appears at awaiting_credentials status
- OAuth flow works end-to-end
- Build only proceeds when all required integrations connected
- Works in both Feature Agent and Builder View

## DO NOT
- Leave CredentialsCollectionView as fallback (remove it from workflow)
- Skip any integration step
- Use mock OAuth flows
```

---

### PROMPT 7: OAuth Callback Page

```
Create the OAuth callback page that handles Nango redirects.

## Context
- Location: `src/pages/OAuthCallback.tsx`
- Route: `/oauth-callback`
- Receives OAuth response and communicates back to opener window

## Implementation

```tsx
/**
 * OAuth Callback Page
 *
 * Handles OAuth redirects from Nango.
 * Posts message to opener window and closes.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get params from Nango
        const connectionId = searchParams.get('connection_id');
        const integrationId = searchParams.get('provider_config_key');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(error);
        }

        if (!connectionId || !integrationId) {
          throw new Error('Missing OAuth parameters');
        }

        // Notify opener window
        if (window.opener) {
          window.opener.postMessage({
            type: 'nango-oauth-complete',
            integrationId,
            connectionId,
            success: true,
          }, window.location.origin);
        }

        setStatus('success');
        setMessage('Connected successfully! Closing...');

        // Close after brief delay
        setTimeout(() => {
          window.close();
        }, 1500);

      } catch (err) {
        console.error('[OAuthCallback] Error:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Authentication failed');

        // Notify opener of failure
        if (window.opener) {
          window.opener.postMessage({
            type: 'nango-oauth-complete',
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          }, window.location.origin);
        }
      }
    };

    processCallback();
  }, [searchParams]);

  return (
    <div className="oauth-callback">
      <div className="oauth-callback__card">
        {status === 'processing' && (
          <>
            <div className="oauth-callback__spinner" />
            <p>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="oauth-callback__check">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#34D399" strokeWidth="4"/>
                <path d="M14 24l8 8 12-16" stroke="#34D399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p>{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="oauth-callback__error">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#EF4444" strokeWidth="4"/>
                <path d="M16 16l16 16M32 16l-16 16" stroke="#EF4444" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <p>{message}</p>
            <button onClick={() => window.close()}>Close</button>
          </>
        )}
      </div>

      <style>{`
        .oauth-callback {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0a, #1a1a1a);
        }

        .oauth-callback__card {
          padding: 3rem;
          background: rgba(30, 30, 35, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          text-align: center;
          max-width: 320px;
        }

        .oauth-callback__card p {
          color: rgba(255, 255, 255, 0.7);
          margin-top: 1.5rem;
          font-size: 0.9375rem;
        }

        .oauth-callback__spinner {
          width: 48px;
          height: 48px;
          margin: 0 auto;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: #F5A86C;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .oauth-callback__check,
        .oauth-callback__error {
          display: flex;
          justify-content: center;
        }

        .oauth-callback button {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
```

## Add Route
In `src/App.tsx` or router config:
```tsx
<Route path="/oauth-callback" element={<OAuthCallback />} />
```

## Validation
- Page handles success and error states
- Communicates back to opener window
- Auto-closes on success
- Premium design (no purple/pink)

## DO NOT
- Use placeholder success/error messages
- Skip error handling
```

---

### PROMPT 8: Add Missing Brand Icons

```
Add any missing brand icons to BrandIcons.tsx.

## Context
- File: `src/components/icons/BrandIcons.tsx`
- Must add icons for: Replicate, Fal.ai, PostHog, Mixpanel, Twilio, Neon, Clerk

## Implementation

Add these icons to BrandIcons.tsx:

```tsx
// ============================================================================
// AI SERVICES (Additional)
// ============================================================================

export const ReplicateIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/>
  </svg>
);

export const FalAIIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <defs>
      <linearGradient id="fal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF6B6B" />
        <stop offset="100%" stopColor="#4ECDC4" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#fal-gradient)" />
    <path d="M8 8l8 4-8 4V8z" fill="#fff" />
  </svg>
);

// ============================================================================
// ANALYTICS
// ============================================================================

export const PostHogIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <path fill="#1D4AFF" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/>
    <path fill="#F9BD2B" d="M8 12l4-4v8l-4-4z"/>
    <path fill="#fff" d="M12 8l4 4-4 4V8z"/>
  </svg>
);

export const MixpanelIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <defs>
      <linearGradient id="mixpanel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7856FF" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="4" fill="url(#mixpanel-gradient)" />
    <path d="M7 17V9l5 4 5-4v8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ============================================================================
// COMMUNICATION
// ============================================================================

export const TwilioIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="#F22F46">
    <path d="M12 0C5.381 0 0 5.381 0 12s5.381 12 12 12 12-5.381 12-12S18.619 0 12 0zm0 20.8c-4.857 0-8.8-3.943-8.8-8.8S7.143 3.2 12 3.2s8.8 3.943 8.8 8.8-3.943 8.8-8.8 8.8zm0-14.4a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2zm2.4 7.2a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2zm-4.8 0a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z"/>
  </svg>
);

// Add to BrandIconMap:
export const BrandIconMap: Record<string, React.FC<IconProps>> = {
  // ... existing entries

  // AI Services
  replicate: ReplicateIcon,
  'fal-ai': FalAIIcon,
  fal: FalAIIcon,

  // Analytics
  posthog: PostHogIcon,
  mixpanel: MixpanelIcon,

  // Communication
  twilio: TwilioIcon,
};
```

## Validation
- All icons are proper SVGs
- No emojis or text fallbacks
- Icons work with BrandIcon dynamic lookup
- All Nango integrations have matching icons

## DO NOT
- Use emoji fallbacks
- Leave any integration without an icon
```

---

## Environment Setup

Add these environment variables:

### Backend (.env)
```
NANGO_SECRET_KEY=your_secret_key_from_nango_dashboard
NANGO_PUBLIC_KEY=your_public_key_from_nango_dashboard
```

### Nango Dashboard Setup
1. Create account at https://nango.dev
2. Add integrations you want to support
3. Configure OAuth credentials for each provider
4. Copy API keys to your environment

---

## Testing Checklist

After implementation:

- [ ] Database migrations run successfully
- [ ] NangoService connects to Nango API
- [ ] `/api/integrations/connect` returns OAuth URL
- [ ] OAuth popup opens and completes flow
- [ ] Callback page handles success/error
- [ ] Connection stored in database
- [ ] IntegrationConnectView shows correct status
- [ ] Build proceeds after all connected
- [ ] Works in Feature Agent workflow
- [ ] Works in Builder View workflow
- [ ] All brand icons display correctly
- [ ] No console errors

---

## Optional: Apideck or Paragon Extension

If Nango doesn't cover all needed integrations:

### Apideck (for CRM, Accounting, ATS)
```bash
npm install @apideck/node
```

### Paragon (for embedded workflows)
```bash
npm install @useparagon/connect
```

These can be added as secondary providers following the same pattern - create a service class that handles OAuth and integrates with the same `IntegrationConnectView`.

---

*Last updated: December 29, 2025*
