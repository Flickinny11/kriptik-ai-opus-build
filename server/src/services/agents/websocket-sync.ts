/**
 * WebSocket Context Synchronization
 * 
 * Real-time synchronization of shared context between server and clients.
 * Enables live updates for agent status, task progress, and deployments.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { getContextStore, ContextStore } from './context-store.js';
import {
    SharedContext,
    ContextEvent,
    ContextEventType,
    Agent,
    Task,
    Message,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

interface WebSocketClient {
    id: string;
    ws: WebSocket;
    contextId: string;
    userId: string;
    subscriptions: ContextEventType[];
    lastPing: Date;
}

interface WebSocketMessage {
    type: string;
    payload: unknown;
    timestamp: string;
}

// ============================================================================
// WEBSOCKET SYNC SERVICE
// ============================================================================

export class WebSocketSyncService {
    private wss: WebSocketServer | null = null;
    private clients: Map<string, WebSocketClient> = new Map();
    private contextStore: ContextStore;
    private pingInterval: NodeJS.Timeout | null = null;
    
    constructor() {
        this.contextStore = getContextStore();
        this.setupContextSubscriptions();
    }
    
    /**
     * Initialize WebSocket server
     */
    initialize(server: Server, path: string = '/ws/context'): void {
        this.wss = new WebSocketServer({ server, path });
        
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });
        
        // Start ping interval to keep connections alive
        this.pingInterval = setInterval(() => {
            this.pingClients();
        }, 30000);
        
        console.log(`WebSocket server initialized at ${path}`);
    }
    
    /**
     * Handle new WebSocket connection
     */
    private handleConnection(ws: WebSocket, request: any): void {
        const clientId = uuidv4();
        
        // Parse query params for initial setup
        const url = new URL(request.url, 'http://localhost');
        const contextId = url.searchParams.get('contextId');
        const userId = url.searchParams.get('userId');
        
        if (!contextId || !userId) {
            ws.close(4001, 'Missing contextId or userId');
            return;
        }
        
        const client: WebSocketClient = {
            id: clientId,
            ws,
            contextId,
            userId,
            subscriptions: [],
            lastPing: new Date(),
        };
        
        this.clients.set(clientId, client);
        
        // Set up message handler
        ws.on('message', (data) => {
            this.handleMessage(client, data.toString());
        });
        
        // Set up close handler
        ws.on('close', () => {
            this.handleDisconnect(client);
        });
        
        // Set up error handler
        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
        });
        
        // Set up pong handler
        ws.on('pong', () => {
            client.lastPing = new Date();
        });
        
        // Send initial context state
        this.sendInitialState(client);
        
        console.log(`Client ${clientId} connected to context ${contextId}`);
    }
    
    /**
     * Handle incoming message from client
     */
    private handleMessage(client: WebSocketClient, rawMessage: string): void {
        try {
            const message: WebSocketMessage = JSON.parse(rawMessage);
            
            switch (message.type) {
                case 'subscribe':
                    this.handleSubscribe(client, message.payload as ContextEventType[]);
                    break;
                    
                case 'unsubscribe':
                    this.handleUnsubscribe(client, message.payload as ContextEventType[]);
                    break;
                    
                case 'add-message':
                    this.handleAddMessage(client, message.payload as { content: string; metadata?: Record<string, unknown> });
                    break;
                    
                case 'create-task':
                    this.handleCreateTask(client, message.payload as { type: string; title: string; description: string; input?: Record<string, unknown> });
                    break;
                    
                case 'get-context':
                    this.sendFullContext(client);
                    break;
                    
                case 'ping':
                    client.lastPing = new Date();
                    this.send(client, 'pong', { timestamp: new Date().toISOString() });
                    break;
                    
                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
            this.send(client, 'error', { message: 'Invalid message format' });
        }
    }
    
    /**
     * Handle client subscribe to event types
     */
    private handleSubscribe(client: WebSocketClient, eventTypes: ContextEventType[]): void {
        client.subscriptions = [...new Set([...client.subscriptions, ...eventTypes])];
        this.send(client, 'subscribed', { eventTypes: client.subscriptions });
    }
    
    /**
     * Handle client unsubscribe from event types
     */
    private handleUnsubscribe(client: WebSocketClient, eventTypes: ContextEventType[]): void {
        client.subscriptions = client.subscriptions.filter(et => !eventTypes.includes(et));
        this.send(client, 'unsubscribed', { eventTypes });
    }
    
    /**
     * Handle add message from client
     */
    private handleAddMessage(client: WebSocketClient, payload: { content: string; metadata?: Record<string, unknown> }): void {
        const message = this.contextStore.addMessage(
            client.contextId,
            'user',
            payload.content,
            payload.metadata
        );
        
        if (message) {
            this.send(client, 'message-added', { message });
        }
    }
    
    /**
     * Handle create task from client
     */
    private handleCreateTask(client: WebSocketClient, payload: { type: string; title: string; description: string; input?: Record<string, unknown> }): void {
        const task = this.contextStore.createTask(
            client.contextId,
            payload.type,
            payload.title,
            payload.description,
            payload.input || {}
        );
        
        if (task) {
            this.send(client, 'task-created', { task });
        }
    }
    
    /**
     * Handle client disconnect
     */
    private handleDisconnect(client: WebSocketClient): void {
        this.clients.delete(client.id);
        console.log(`Client ${client.id} disconnected from context ${client.contextId}`);
    }
    
    /**
     * Send initial state to client
     */
    private sendInitialState(client: WebSocketClient): void {
        const context = this.contextStore.getContext(client.contextId);
        
        if (context) {
            this.send(client, 'initial-state', {
                contextId: context.id,
                projectState: context.projectState,
                implementationPlan: context.implementationPlan,
                activeAgents: context.activeAgents,
                taskQueue: context.taskQueue,
                deploymentState: context.deploymentState,
                activeWorkflow: context.activeWorkflow,
                recentMessages: context.conversationHistory.slice(-20),
            });
        } else {
            this.send(client, 'error', { message: 'Context not found' });
        }
    }
    
    /**
     * Send full context to client
     */
    private sendFullContext(client: WebSocketClient): void {
        const context = this.contextStore.getContext(client.contextId);
        
        if (context) {
            this.send(client, 'full-context', { context });
        } else {
            this.send(client, 'error', { message: 'Context not found' });
        }
    }
    
    /**
     * Set up subscriptions to context store events
     */
    private setupContextSubscriptions(): void {
        // Listen to all events from context store
        const eventTypes: ContextEventType[] = [
            'agent:started',
            'agent:completed',
            'agent:error',
            'task:created',
            'task:started',
            'task:completed',
            'task:failed',
            'plan:updated',
            'file:modified',
            'deployment:started',
            'deployment:completed',
            'deployment:failed',
            'workflow:approved',
            'workflow:started',
            'workflow:completed',
            'credential:added',
            'credential:removed',
            'context:checkpoint',
        ];
        
        for (const eventType of eventTypes) {
            this.contextStore.on(eventType, (data: { contextId: string; event: ContextEvent }) => {
                this.broadcastToContext(data.contextId, data.event);
            });
        }
    }
    
    /**
     * Broadcast event to all clients subscribed to a context
     */
    broadcastToContext(contextId: string, event: ContextEvent): void {
        for (const client of this.clients.values()) {
            if (client.contextId !== contextId) continue;
            
            // Check if client is subscribed to this event type
            if (client.subscriptions.length === 0 || client.subscriptions.includes(event.type)) {
                this.send(client, 'context-event', event);
            }
        }
    }
    
    /**
     * Send message to specific client
     */
    private send(client: WebSocketClient, type: string, payload: unknown): void {
        if (client.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const message: WebSocketMessage = {
            type,
            payload,
            timestamp: new Date().toISOString(),
        };
        
        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`Error sending message to client ${client.id}:`, error);
        }
    }
    
    /**
     * Broadcast message to all clients for a context
     */
    broadcast(contextId: string, type: string, payload: unknown): void {
        for (const client of this.clients.values()) {
            if (client.contextId === contextId) {
                this.send(client, type, payload);
            }
        }
    }
    
    /**
     * Ping all clients to keep connections alive
     */
    private pingClients(): void {
        const staleThreshold = Date.now() - 60000;  // 1 minute
        
        for (const [clientId, client] of this.clients) {
            if (client.lastPing.getTime() < staleThreshold) {
                // Client hasn't responded to pings, disconnect
                client.ws.terminate();
                this.clients.delete(clientId);
                continue;
            }
            
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.ping();
            }
        }
    }
    
    /**
     * Send agent status update
     */
    sendAgentUpdate(contextId: string, agent: Agent): void {
        this.broadcast(contextId, 'agent-update', { agent });
    }
    
    /**
     * Send task progress update
     */
    sendTaskUpdate(contextId: string, task: Task): void {
        this.broadcast(contextId, 'task-update', { task });
    }
    
    /**
     * Send new message to clients
     */
    sendMessage(contextId: string, message: Message): void {
        this.broadcast(contextId, 'new-message', { message });
    }
    
    /**
     * Send deployment status update
     */
    sendDeploymentUpdate(contextId: string, deployment: { id: string; status: string; progress?: number; logs?: string[] }): void {
        this.broadcast(contextId, 'deployment-update', { deployment });
    }
    
    /**
     * Send streaming content (for real-time AI responses)
     */
    sendStreamChunk(contextId: string, messageId: string, chunk: string, done: boolean = false): void {
        this.broadcast(contextId, 'stream-chunk', {
            messageId,
            chunk,
            done,
        });
    }
    
    /**
     * Get connected client count for a context
     */
    getClientCount(contextId: string): number {
        let count = 0;
        for (const client of this.clients.values()) {
            if (client.contextId === contextId) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * Shutdown WebSocket server
     */
    shutdown(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Close all client connections
        for (const client of this.clients.values()) {
            client.ws.close(1001, 'Server shutting down');
        }
        this.clients.clear();
        
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
        
        console.log('WebSocket server shut down');
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: WebSocketSyncService | null = null;

export function getWebSocketSyncService(): WebSocketSyncService {
    if (!instance) {
        instance = new WebSocketSyncService();
    }
    return instance;
}

/**
 * Initialize WebSocket service with HTTP server
 */
export function initializeWebSocketSync(server: Server, path?: string): WebSocketSyncService {
    const service = getWebSocketSyncService();
    service.initialize(server, path);
    return service;
}

