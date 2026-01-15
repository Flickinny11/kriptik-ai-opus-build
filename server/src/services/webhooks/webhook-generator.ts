/**
 * Webhook Endpoint Generator
 * 
 * Generates unique webhook URLs for each project/integration.
 * Handles incoming webhook events with signature verification.
 * 
 * URL Pattern: https://api.kriptik.app/webhooks/{projectId}/{integrationId}/{secret}
 * 
 * Features:
 * - Cryptographically secure secret generation
 * - Per-integration signature verification
 * - Event storage and history
 * - Async event processing with retry
 */

import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { db } from '../../db.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface WebhookEndpoint {
  id: string;
  projectId: string;
  integrationId: string;
  secret: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
  events: string[]; // Subscribed event types
  lastEventAt: Date | null;
  eventCount: number;
}

export interface WebhookEvent {
  id: string;
  endpointId: string;
  projectId: string;
  integrationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt: Date | null;
  status: 'pending' | 'processed' | 'failed' | 'retrying';
  attempts: number;
  lastError: string | null;
}

export interface SignatureVerification {
  valid: boolean;
  integrationId: string;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECRET_LENGTH = 32; // 256 bits
const API_BASE_URL = process.env.API_URL || 'https://api.kriptik.app';

// Integration-specific signature headers and verification methods
const SIGNATURE_CONFIGS: Record<string, {
  header: string;
  algorithm: 'sha256' | 'sha1';
  prefix?: string;
  payloadKey?: string;
}> = {
  stripe: {
    header: 'stripe-signature',
    algorithm: 'sha256',
    prefix: 't=',
  },
  github: {
    header: 'x-hub-signature-256',
    algorithm: 'sha256',
    prefix: 'sha256=',
  },
  supabase: {
    header: 'x-supabase-signature',
    algorithm: 'sha256',
  },
  clerk: {
    header: 'svix-signature',
    algorithm: 'sha256',
  },
  resend: {
    header: 'resend-signature',
    algorithm: 'sha256',
  },
  twilio: {
    header: 'x-twilio-signature',
    algorithm: 'sha1',
  },
  default: {
    header: 'x-webhook-signature',
    algorithm: 'sha256',
  },
};

// In-memory storage for webhooks (replace with DB in production)
const webhookEndpoints = new Map<string, WebhookEndpoint>();
const webhookEvents = new Map<string, WebhookEvent>();

// ============================================================================
// ENDPOINT MANAGEMENT
// ============================================================================

/**
 * Generate a new webhook endpoint for a project/integration
 */
export async function generateWebhookEndpoint(
  projectId: string,
  integrationId: string,
  events: string[] = ['*']
): Promise<WebhookEndpoint> {
  const id = uuidv4();
  const secret = randomBytes(SECRET_LENGTH).toString('hex');
  const url = `${API_BASE_URL}/webhooks/${projectId}/${integrationId}/${secret}`;
  
  const endpoint: WebhookEndpoint = {
    id,
    projectId,
    integrationId,
    secret,
    url,
    createdAt: new Date(),
    updatedAt: new Date(),
    enabled: true,
    events,
    lastEventAt: null,
    eventCount: 0,
  };
  
  // Store endpoint
  webhookEndpoints.set(id, endpoint);
  
  // Also store by project/integration for lookup
  const lookupKey = `${projectId}:${integrationId}`;
  webhookEndpoints.set(lookupKey, endpoint);
  
  console.log(`[WebhookGenerator] Created endpoint for ${integrationId} in project ${projectId}`);
  
  return endpoint;
}

/**
 * Get existing webhook endpoint
 */
export async function getWebhookEndpoint(
  projectId: string,
  integrationId: string
): Promise<WebhookEndpoint | null> {
  const lookupKey = `${projectId}:${integrationId}`;
  return webhookEndpoints.get(lookupKey) || null;
}

/**
 * Get or create webhook endpoint
 */
export async function getOrCreateWebhookEndpoint(
  projectId: string,
  integrationId: string,
  events: string[] = ['*']
): Promise<WebhookEndpoint> {
  const existing = await getWebhookEndpoint(projectId, integrationId);
  if (existing) return existing;
  return generateWebhookEndpoint(projectId, integrationId, events);
}

/**
 * Disable a webhook endpoint
 */
export async function disableWebhookEndpoint(
  projectId: string,
  integrationId: string
): Promise<boolean> {
  const lookupKey = `${projectId}:${integrationId}`;
  const endpoint = webhookEndpoints.get(lookupKey);
  
  if (endpoint) {
    endpoint.enabled = false;
    endpoint.updatedAt = new Date();
    return true;
  }
  
  return false;
}

/**
 * Rotate webhook secret (regenerate)
 */
export async function rotateWebhookSecret(
  projectId: string,
  integrationId: string
): Promise<WebhookEndpoint | null> {
  const lookupKey = `${projectId}:${integrationId}`;
  const endpoint = webhookEndpoints.get(lookupKey);
  
  if (!endpoint) return null;
  
  const newSecret = randomBytes(SECRET_LENGTH).toString('hex');
  endpoint.secret = newSecret;
  endpoint.url = `${API_BASE_URL}/webhooks/${projectId}/${integrationId}/${newSecret}`;
  endpoint.updatedAt = new Date();
  
  return endpoint;
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify webhook signature based on integration type
 */
export function verifySignature(
  integrationId: string,
  payload: string | Buffer,
  signature: string,
  secret: string
): SignatureVerification {
  const config = SIGNATURE_CONFIGS[integrationId] || SIGNATURE_CONFIGS.default;
  
  try {
    // Special handling for Stripe
    if (integrationId === 'stripe') {
      return verifyStripeSignature(payload, signature, secret);
    }
    
    // Standard HMAC verification
    const expectedSignature = createHmac(config.algorithm, secret)
      .update(payload)
      .digest('hex');
    
    // Remove prefix if present
    let providedSignature = signature;
    if (config.prefix && signature.startsWith(config.prefix)) {
      providedSignature = signature.slice(config.prefix.length);
    }
    
    // Timing-safe comparison
    const expected = Buffer.from(expectedSignature, 'hex');
    const provided = Buffer.from(providedSignature, 'hex');
    
    if (expected.length !== provided.length) {
      return { valid: false, integrationId, error: 'Signature length mismatch' };
    }
    
    const valid = timingSafeEqual(expected, provided);
    return { valid, integrationId, error: valid ? undefined : 'Invalid signature' };
    
  } catch (error) {
    return {
      valid: false,
      integrationId,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Stripe-specific signature verification
 * Stripe uses a special format: t=timestamp,v1=signature
 */
function verifyStripeSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string
): SignatureVerification {
  try {
    // Parse Stripe signature header
    const elements = signatureHeader.split(',');
    const timestamp = elements.find(e => e.startsWith('t='))?.slice(2);
    const signature = elements.find(e => e.startsWith('v1='))?.slice(3);
    
    if (!timestamp || !signature) {
      return { valid: false, integrationId: 'stripe', error: 'Invalid signature format' };
    }
    
    // Check timestamp (tolerance of 5 minutes)
    const timestampMs = parseInt(timestamp, 10) * 1000;
    const now = Date.now();
    if (Math.abs(now - timestampMs) > 300000) {
      return { valid: false, integrationId: 'stripe', error: 'Timestamp too old' };
    }
    
    // Create signed payload
    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');
    const signedPayload = `${timestamp}.${payloadString}`;
    
    // Compute expected signature
    const expectedSignature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    
    // Timing-safe comparison
    const expected = Buffer.from(expectedSignature, 'hex');
    const provided = Buffer.from(signature, 'hex');
    
    if (expected.length !== provided.length) {
      return { valid: false, integrationId: 'stripe', error: 'Signature length mismatch' };
    }
    
    const valid = timingSafeEqual(expected, provided);
    return { valid, integrationId: 'stripe', error: valid ? undefined : 'Invalid signature' };
    
  } catch (error) {
    return {
      valid: false,
      integrationId: 'stripe',
      error: error instanceof Error ? error.message : 'Stripe verification failed',
    };
  }
}

// ============================================================================
// EVENT HANDLING
// ============================================================================

/**
 * Store incoming webhook event
 */
export async function storeWebhookEvent(
  endpointId: string,
  projectId: string,
  integrationId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<WebhookEvent> {
  const event: WebhookEvent = {
    id: uuidv4(),
    endpointId,
    projectId,
    integrationId,
    eventType,
    payload,
    receivedAt: new Date(),
    processedAt: null,
    status: 'pending',
    attempts: 0,
    lastError: null,
  };
  
  webhookEvents.set(event.id, event);
  
  // Update endpoint stats
  const lookupKey = `${projectId}:${integrationId}`;
  const endpoint = webhookEndpoints.get(lookupKey);
  if (endpoint) {
    endpoint.lastEventAt = new Date();
    endpoint.eventCount++;
  }
  
  return event;
}

/**
 * Process webhook event (called asynchronously)
 */
export async function processWebhookEvent(eventId: string): Promise<boolean> {
  const event = webhookEvents.get(eventId);
  if (!event) return false;
  
  event.attempts++;
  
  try {
    // Process based on integration type
    await handleEvent(event);
    
    event.status = 'processed';
    event.processedAt = new Date();
    event.lastError = null;
    
    return true;
  } catch (error) {
    event.lastError = error instanceof Error ? error.message : 'Unknown error';
    
    // Retry logic
    if (event.attempts < 3) {
      event.status = 'retrying';
      // Schedule retry with exponential backoff
      setTimeout(() => processWebhookEvent(eventId), Math.pow(2, event.attempts) * 1000);
    } else {
      event.status = 'failed';
    }
    
    return false;
  }
}

/**
 * Integration-specific event handling
 */
async function handleEvent(event: WebhookEvent): Promise<void> {
  const { integrationId, eventType, payload, projectId } = event;
  
  console.log(`[WebhookGenerator] Processing ${integrationId}:${eventType} for project ${projectId}`);
  
  switch (integrationId) {
    case 'stripe':
      await handleStripeEvent(eventType, payload, projectId);
      break;
    case 'github':
      await handleGitHubEvent(eventType, payload, projectId);
      break;
    case 'supabase':
      await handleSupabaseEvent(eventType, payload, projectId);
      break;
    default:
      // Generic handling - just log
      console.log(`[WebhookGenerator] Received ${eventType} event for ${integrationId}`);
  }
}

async function handleStripeEvent(
  eventType: string,
  payload: Record<string, unknown>,
  projectId: string
): Promise<void> {
  switch (eventType) {
    case 'checkout.session.completed':
      console.log(`[Stripe] Checkout completed for project ${projectId}`);
      // Trigger fulfillment logic
      break;
    case 'invoice.paid':
      console.log(`[Stripe] Invoice paid for project ${projectId}`);
      break;
    case 'customer.subscription.updated':
      console.log(`[Stripe] Subscription updated for project ${projectId}`);
      break;
    case 'customer.subscription.deleted':
      console.log(`[Stripe] Subscription cancelled for project ${projectId}`);
      break;
  }
}

async function handleGitHubEvent(
  eventType: string,
  payload: Record<string, unknown>,
  projectId: string
): Promise<void> {
  switch (eventType) {
    case 'push':
      console.log(`[GitHub] Push event for project ${projectId}`);
      break;
    case 'pull_request':
      console.log(`[GitHub] PR event for project ${projectId}`);
      break;
    case 'issues':
      console.log(`[GitHub] Issue event for project ${projectId}`);
      break;
  }
}

async function handleSupabaseEvent(
  eventType: string,
  payload: Record<string, unknown>,
  projectId: string
): Promise<void> {
  console.log(`[Supabase] ${eventType} event for project ${projectId}`);
}

// ============================================================================
// EVENT HISTORY
// ============================================================================

/**
 * Get recent webhook events for a project
 */
export async function getRecentEvents(
  projectId: string,
  limit: number = 50
): Promise<WebhookEvent[]> {
  const events = Array.from(webhookEvents.values())
    .filter(e => e.projectId === projectId)
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, limit);
  
  return events;
}

/**
 * Get events by status
 */
export async function getEventsByStatus(
  projectId: string,
  status: WebhookEvent['status']
): Promise<WebhookEvent[]> {
  return Array.from(webhookEvents.values())
    .filter(e => e.projectId === projectId && e.status === status);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateWebhookEndpoint,
  getWebhookEndpoint,
  getOrCreateWebhookEndpoint,
  disableWebhookEndpoint,
  rotateWebhookSecret,
  verifySignature,
  storeWebhookEvent,
  processWebhookEvent,
  getRecentEvents,
  getEventsByStatus,
};
