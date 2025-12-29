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

// Integration catalog - maps our IDs to Nango provider IDs
export const NANGO_INTEGRATIONS = {
  // Payments
  stripe: { nangoId: 'stripe', name: 'Stripe', category: 'payments', scopes: ['read_write'] },

  // Databases
  supabase: { nangoId: 'supabase', name: 'Supabase', category: 'database', scopes: ['read', 'write'] },
  planetscale: { nangoId: 'planetscale', name: 'PlanetScale', category: 'database' },
  neon: { nangoId: 'neon', name: 'Neon', category: 'database' },

  // Auth Providers
  clerk: { nangoId: 'clerk', name: 'Clerk', category: 'auth' },
  auth0: { nangoId: 'auth0', name: 'Auth0', category: 'auth' },

  // AI Services
  openai: { nangoId: 'openai', name: 'OpenAI', category: 'ai' },
  anthropic: { nangoId: 'anthropic', name: 'Anthropic', category: 'ai' },
  replicate: { nangoId: 'replicate', name: 'Replicate', category: 'ai' },
  'fal-ai': { nangoId: 'fal', name: 'Fal.ai', category: 'ai' },
  huggingface: { nangoId: 'huggingface', name: 'Hugging Face', category: 'ai' },

  // Cloud/Deployment
  vercel: { nangoId: 'vercel', name: 'Vercel', category: 'deployment' },
  netlify: { nangoId: 'netlify', name: 'Netlify', category: 'deployment' },
  aws: { nangoId: 'aws', name: 'AWS', category: 'cloud' },

  // Version Control
  github: { nangoId: 'github', name: 'GitHub', category: 'vcs', scopes: ['repo', 'user'] },
  gitlab: { nangoId: 'gitlab', name: 'GitLab', category: 'vcs' },

  // Email
  resend: { nangoId: 'resend', name: 'Resend', category: 'email' },
  sendgrid: { nangoId: 'sendgrid', name: 'SendGrid', category: 'email' },

  // Storage
  's3': { nangoId: 'aws-s3', name: 'AWS S3', category: 'storage' },
  cloudflare: { nangoId: 'cloudflare', name: 'Cloudflare R2', category: 'storage' },

  // Analytics
  posthog: { nangoId: 'posthog', name: 'PostHog', category: 'analytics' },
  mixpanel: { nangoId: 'mixpanel', name: 'Mixpanel', category: 'analytics' },

  // Communication
  twilio: { nangoId: 'twilio', name: 'Twilio', category: 'communication' },
  slack: { nangoId: 'slack', name: 'Slack', category: 'communication' },
  discord: { nangoId: 'discord', name: 'Discord', category: 'communication' },
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
