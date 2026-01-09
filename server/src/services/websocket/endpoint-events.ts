/**
 * Endpoint WebSocket Events
 *
 * Real-time WebSocket events for endpoint deployment, status, health, and usage.
 * Sends deployment progress, status changes, health alerts, and usage updates.
 *
 * Integrates with:
 * - AutoDeployer: deployment progress and completion
 * - EndpointMonitor: health alerts and status changes
 * - InferenceGateway: usage updates
 * - EndpointBilling: credit warnings
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature (PROMPT 11).
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import type { EndpointHealth } from '../deployment/endpoint-monitor.js';
import type { UsageStats } from '../deployment/endpoint-registry.js';

// =============================================================================
// TYPES
// =============================================================================

export type EndpointEventType =
  | 'DEPLOYMENT_STARTED'
  | 'DEPLOYMENT_PROGRESS'
  | 'DEPLOYMENT_COMPLETE'
  | 'DEPLOYMENT_FAILED'
  | 'ENDPOINT_STATUS_CHANGED'
  | 'ENDPOINT_HEALTH_ALERT'
  | 'ENDPOINT_USAGE_UPDATE'
  | 'CREDITS_LOW_WARNING'
  | 'ENDPOINT_RECOVERY_STARTED'
  | 'ENDPOINT_RECOVERY_COMPLETE'
  | 'ENDPOINT_RECOVERY_FAILED';

export interface DeploymentStartedEvent {
  type: 'DEPLOYMENT_STARTED';
  endpointId: string;
  modelName: string;
  provider: 'runpod' | 'modal';
  timestamp: string;
}

export interface DeploymentProgressEvent {
  type: 'DEPLOYMENT_PROGRESS';
  endpointId: string;
  stage: string;
  progress: number;
  message?: string;
  timestamp: string;
}

export interface DeploymentCompleteEvent {
  type: 'DEPLOYMENT_COMPLETE';
  endpointId: string;
  endpointUrl: string;
  apiKey: string;
  provider: 'runpod' | 'modal';
  gpuType: string;
  timestamp: string;
}

export interface DeploymentFailedEvent {
  type: 'DEPLOYMENT_FAILED';
  endpointId: string;
  error: string;
  canRetry: boolean;
  timestamp: string;
}

export interface EndpointStatusChangedEvent {
  type: 'ENDPOINT_STATUS_CHANGED';
  endpointId: string;
  status: string;
  previousStatus: string;
  modelName: string;
  timestamp: string;
}

export interface EndpointHealthAlertEvent {
  type: 'ENDPOINT_HEALTH_ALERT';
  endpointId: string;
  health: EndpointHealth;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
}

export interface EndpointUsageUpdateEvent {
  type: 'ENDPOINT_USAGE_UPDATE';
  endpointId: string;
  usage: UsageStats;
  timestamp: string;
}

export interface CreditsLowWarningEvent {
  type: 'CREDITS_LOW_WARNING';
  currentBalance: number;
  threshold: number;
  message: string;
  timestamp: string;
}

export interface EndpointRecoveryEvent {
  type: 'ENDPOINT_RECOVERY_STARTED' | 'ENDPOINT_RECOVERY_COMPLETE' | 'ENDPOINT_RECOVERY_FAILED';
  endpointId: string;
  action: string;
  success?: boolean;
  error?: string;
  timestamp: string;
}

export type EndpointEvent =
  | DeploymentStartedEvent
  | DeploymentProgressEvent
  | DeploymentCompleteEvent
  | DeploymentFailedEvent
  | EndpointStatusChangedEvent
  | EndpointHealthAlertEvent
  | EndpointUsageUpdateEvent
  | CreditsLowWarningEvent
  | EndpointRecoveryEvent;

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId: string;
  endpointSubscriptions: Set<string>;
  globalSubscription: boolean;
  connectedAt: Date;
  lastPing: Date;
}

// =============================================================================
// ENDPOINT EVENT EMITTER
// =============================================================================

export class EndpointEventEmitter extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private userClients: Map<string, Set<string>> = new Map(); // userId -> Set<clientId>
  private pingInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize WebSocket server for endpoint events
   */
  initialize(server: HTTPServer, path: string = '/ws/endpoints'): void {
    if (this.isInitialized) {
      console.log('[EndpointEventEmitter] Already initialized');
      return;
    }

    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    // Ping clients every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000);

    this.isInitialized = true;
    console.log(`[EndpointEventEmitter] WebSocket server initialized at ${path}`);
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    this.userClients.clear();
    this.isInitialized = false;
    console.log('[EndpointEventEmitter] WebSocket server shutdown');
  }

  // =============================================================================
  // EVENT EMISSION METHODS
  // =============================================================================

  /**
   * Emit event to specific user
   */
  emitToUser(userId: string, event: EndpointEvent): void {
    const clientIds = this.userClients.get(userId);
    if (!clientIds || clientIds.size === 0) {
      // User not connected, could queue for later or just skip
      return;
    }

    const message = JSON.stringify({
      channel: 'endpoint:event',
      data: event,
    });

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }

    // Also emit locally for internal listeners
    this.emit('event', { userId, event });
  }

  /**
   * Emit deployment started event
   */
  emitDeploymentStarted(
    userId: string,
    endpointId: string,
    modelName: string,
    provider: 'runpod' | 'modal'
  ): void {
    this.emitToUser(userId, {
      type: 'DEPLOYMENT_STARTED',
      endpointId,
      modelName,
      provider,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit deployment progress event
   */
  emitDeploymentProgress(
    userId: string,
    endpointId: string,
    stage: string,
    progress: number,
    message?: string
  ): void {
    this.emitToUser(userId, {
      type: 'DEPLOYMENT_PROGRESS',
      endpointId,
      stage,
      progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit deployment complete event with connection info
   */
  emitDeploymentComplete(
    userId: string,
    endpointId: string,
    endpointUrl: string,
    apiKey: string,
    provider: 'runpod' | 'modal',
    gpuType: string
  ): void {
    this.emitToUser(userId, {
      type: 'DEPLOYMENT_COMPLETE',
      endpointId,
      endpointUrl,
      apiKey,
      provider,
      gpuType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit deployment failed event
   */
  emitDeploymentFailed(
    userId: string,
    endpointId: string,
    error: string,
    canRetry: boolean = true
  ): void {
    this.emitToUser(userId, {
      type: 'DEPLOYMENT_FAILED',
      endpointId,
      error,
      canRetry,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit endpoint status change event
   */
  emitStatusChanged(
    userId: string,
    endpointId: string,
    status: string,
    previousStatus: string,
    modelName: string
  ): void {
    this.emitToUser(userId, {
      type: 'ENDPOINT_STATUS_CHANGED',
      endpointId,
      status,
      previousStatus,
      modelName,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit health alert event
   */
  emitHealthAlert(
    userId: string,
    endpointId: string,
    health: EndpointHealth,
    severity: 'info' | 'warning' | 'error' | 'critical',
    message: string
  ): void {
    this.emitToUser(userId, {
      type: 'ENDPOINT_HEALTH_ALERT',
      endpointId,
      health,
      severity,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit usage update event
   */
  emitUsageUpdate(userId: string, endpointId: string, usage: UsageStats): void {
    this.emitToUser(userId, {
      type: 'ENDPOINT_USAGE_UPDATE',
      endpointId,
      usage,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit credits low warning
   */
  emitCreditsLowWarning(
    userId: string,
    currentBalance: number,
    threshold: number
  ): void {
    this.emitToUser(userId, {
      type: 'CREDITS_LOW_WARNING',
      currentBalance,
      threshold,
      message: `Your credit balance (${currentBalance}) is below the warning threshold (${threshold}). Please add more credits to avoid service interruption.`,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit recovery event
   */
  emitRecoveryEvent(
    userId: string,
    endpointId: string,
    type: 'ENDPOINT_RECOVERY_STARTED' | 'ENDPOINT_RECOVERY_COMPLETE' | 'ENDPOINT_RECOVERY_FAILED',
    action: string,
    success?: boolean,
    error?: string
  ): void {
    this.emitToUser(userId, {
      type,
      endpointId,
      action,
      success,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // =============================================================================
  // CONNECTION MANAGEMENT
  // =============================================================================

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: unknown): void {
    // Parse request for authentication
    const req = request as { url?: string; headers?: Record<string, string> };
    const url = new URL(req.url || '/', 'http://localhost');
    const userId = url.searchParams.get('userId') || '';
    const token = url.searchParams.get('token') || '';

    // Validate token (basic check - in production use proper auth)
    if (!userId) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      userId,
      endpointSubscriptions: new Set(),
      globalSubscription: true,
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    // Store client
    this.clients.set(clientId, client);

    // Track user's clients
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    this.userClients.get(userId)!.add(clientId);

    console.log(`[EndpointEventEmitter] Client ${clientId} connected for user ${userId}`);

    // Send welcome message
    ws.send(JSON.stringify({
      channel: 'system',
      data: {
        type: 'CONNECTED',
        clientId,
        message: 'Connected to endpoint events',
      },
    }));

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('[EndpointEventEmitter] Invalid message:', error);
      }
    });

    // Handle close
    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[EndpointEventEmitter] Client ${clientId} error:`, error);
      this.handleDisconnect(clientId);
    });
  }

  /**
   * Handle incoming client message
   */
  private handleMessage(clientId: string, message: {
    type: string;
    endpointId?: string;
    data?: unknown;
  }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'SUBSCRIBE_ENDPOINT':
        if (message.endpointId) {
          client.endpointSubscriptions.add(message.endpointId);
        }
        break;

      case 'UNSUBSCRIBE_ENDPOINT':
        if (message.endpointId) {
          client.endpointSubscriptions.delete(message.endpointId);
        }
        break;

      case 'PONG':
        client.lastPing = new Date();
        break;

      default:
        // Unknown message type
        break;
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from user clients
    const userClientSet = this.userClients.get(client.userId);
    if (userClientSet) {
      userClientSet.delete(clientId);
      if (userClientSet.size === 0) {
        this.userClients.delete(client.userId);
      }
    }

    // Remove client
    this.clients.delete(clientId);
    console.log(`[EndpointEventEmitter] Client ${clientId} disconnected`);
  }

  /**
   * Ping all clients to keep connections alive
   */
  private pingClients(): void {
    const now = new Date();
    const timeout = 60000; // 60 seconds

    for (const [clientId, client] of this.clients) {
      // Check if client is stale
      if (now.getTime() - client.lastPing.getTime() > timeout) {
        console.log(`[EndpointEventEmitter] Client ${clientId} timed out`);
        client.ws.close();
        this.handleDisconnect(clientId);
        continue;
      }

      // Send ping
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          channel: 'system',
          data: { type: 'PING' },
        }));
      }
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection stats
   */
  getStats(): {
    totalClients: number;
    totalUsers: number;
    clientsByUser: Record<string, number>;
  } {
    const clientsByUser: Record<string, number> = {};
    for (const [userId, clients] of this.userClients) {
      clientsByUser[userId] = clients.size;
    }

    return {
      totalClients: this.clients.size,
      totalUsers: this.userClients.size,
      clientsByUser,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let eventEmitterInstance: EndpointEventEmitter | null = null;

export function getEndpointEventEmitter(): EndpointEventEmitter {
  if (!eventEmitterInstance) {
    eventEmitterInstance = new EndpointEventEmitter();
  }
  return eventEmitterInstance;
}

export function initializeEndpointWebSocket(server: HTTPServer, path?: string): EndpointEventEmitter {
  const emitter = getEndpointEventEmitter();
  emitter.initialize(server, path);
  return emitter;
}

export default EndpointEventEmitter;
