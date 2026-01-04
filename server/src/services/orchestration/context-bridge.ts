/**
 * Context Bridge Service
 *
 * Enables real-time context sharing between cloud sandboxes.
 * Uses Redis for pub/sub and Turso for persistent state.
 *
 * This service coordinates parallel sandbox builds by:
 * - Managing atomic file ownership to prevent conflicts
 * - Broadcasting discoveries (patterns, errors, completions) in real-time
 * - Maintaining shared context across all sandboxes
 * - Managing the merge queue for verified code integration
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { eq } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

export interface SandboxSharedContext {
    buildId: string;
    intentContract: any;
    completedFeatures: string[];
    inProgressFeatures: Map<string, string>; // feature -> sandboxId
    discoveredPatterns: Pattern[];
    sharedErrors: ErrorRecord[];
    fileOwnership: Map<string, string>; // file path -> sandboxId
    pendingMerges: MergeQueueItem[];
}

export interface ContextBridgeConfig {
    buildId: string;
    sandboxIds: string[];
    intentContract: any;
    redisUrl?: string;
}

export interface Pattern {
    id: string;
    name: string;
    description: string;
    discoveredBy: string;
    sharedAt: string;
}

export interface ErrorRecord {
    id: string;
    sandboxId: string;
    error: string;
    resolution?: string;
    timestamp: string;
}

export interface MergeQueueItem {
    id: string;
    sandboxId: string;
    taskId: string;
    files: string[];
    verificationScore: number;
    status: 'pending' | 'verifying' | 'approved' | 'merged' | 'rejected';
    createdAt: string;
}

export interface Discovery {
    type: 'pattern' | 'error' | 'conflict' | 'completion';
    sandboxId: string;
    data: any;
    timestamp: string;
}

export interface FileClaimResult {
    success: boolean;
    currentOwner?: string;
    message: string;
}

// =============================================================================
// CONTEXT BRIDGE SERVICE
// =============================================================================

export class ContextBridgeService extends EventEmitter {
    private redis: Redis;
    private subscriber: Redis;
    private buildId: string;
    private sandboxIds: string[];
    private sharedContext: SandboxSharedContext;
    private discoveryCallbacks: Array<(discovery: Discovery) => void>;
    private isInitialized: boolean;

    constructor(config: ContextBridgeConfig) {
        super();

        const redisUrl = config.redisUrl || process.env.REDIS_URL;
        if (!redisUrl) {
            throw new Error('REDIS_URL not configured for Context Bridge');
        }

        this.buildId = config.buildId;
        this.sandboxIds = config.sandboxIds;
        this.discoveryCallbacks = [];
        this.isInitialized = false;

        // Initialize Redis clients
        this.redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
                if (times > 3) return null;
                return Math.min(times * 1000, 3000);
            },
        });

        this.subscriber = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
                if (times > 3) return null;
                return Math.min(times * 1000, 3000);
            },
        });

        // Initialize shared context
        this.sharedContext = {
            buildId: this.buildId,
            intentContract: config.intentContract,
            completedFeatures: [],
            inProgressFeatures: new Map(),
            discoveredPatterns: [],
            sharedErrors: [],
            fileOwnership: new Map(),
            pendingMerges: [],
        };

        this.setupErrorHandlers();
    }

    /**
     * Set up error handlers for Redis connections
     */
    private setupErrorHandlers(): void {
        this.redis.on('error', (err: Error) => {
            console.error('[Context Bridge] Redis error:', err);
            this.emit('error', err);
        });

        this.subscriber.on('error', (err: Error) => {
            console.error('[Context Bridge] Subscriber error:', err);
            this.emit('error', err);
        });

        this.redis.on('connect', () => {
            console.log('[Context Bridge] Redis connected');
            this.emit('connected');
        });

        this.subscriber.on('connect', () => {
            console.log('[Context Bridge] Subscriber connected');
        });
    }

    /**
     * Initialize shared context and subscribe to discovery channel
     */
    async initializeSharedContext(config: ContextBridgeConfig): Promise<void> {
        if (this.isInitialized) {
            console.warn('[Context Bridge] Already initialized');
            return;
        }

        try {
            // Store initial shared context in Redis
            const contextKey = `build:${this.buildId}:context`;
            await this.redis.set(
                contextKey,
                JSON.stringify({
                    ...this.sharedContext,
                    inProgressFeatures: Array.from(this.sharedContext.inProgressFeatures.entries()),
                    fileOwnership: Array.from(this.sharedContext.fileOwnership.entries()),
                }),
                'EX',
                86400 // 24 hours TTL
            );

            // Subscribe to discovery channel
            const discoveryChannel = `build:${this.buildId}:discoveries`;
            await this.subscriber.subscribe(discoveryChannel);

            this.subscriber.on('message', (channel: string, message: string) => {
                if (channel === discoveryChannel) {
                    try {
                        const discovery: Discovery = JSON.parse(message);
                        this.handleDiscovery(discovery);
                    } catch (err) {
                        console.error('[Context Bridge] Failed to parse discovery:', err);
                    }
                }
            });

            // Create file ownership locks hash
            const locksKey = `build:${this.buildId}:file_locks`;
            await this.redis.del(locksKey);

            this.isInitialized = true;
            console.log(`[Context Bridge] Initialized for build ${this.buildId}`);
            this.emit('initialized', { buildId: this.buildId, sandboxCount: this.sandboxIds.length });
        } catch (error) {
            console.error('[Context Bridge] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Atomically claim ownership of a file to prevent conflicts
     * Uses Redis HSETNX for atomic operation
     */
    async claimFile(sandboxId: string, filePath: string): Promise<FileClaimResult> {
        try {
            const locksKey = `build:${this.buildId}:file_locks`;
            const normalizedPath = filePath.replace(/\\/g, '/');

            // HSETNX: Set only if field doesn't exist (atomic)
            const claimed = await this.redis.hsetnx(locksKey, normalizedPath, sandboxId);

            if (claimed === 1) {
                // Successfully claimed
                this.sharedContext.fileOwnership.set(normalizedPath, sandboxId);
                this.emit('fileClaimed', { sandboxId, filePath: normalizedPath });

                return {
                    success: true,
                    message: `File ${normalizedPath} claimed by sandbox ${sandboxId}`,
                };
            } else {
                // Already claimed by another sandbox
                const currentOwner = await this.redis.hget(locksKey, normalizedPath);
                return {
                    success: false,
                    currentOwner: currentOwner || undefined,
                    message: `File ${normalizedPath} already claimed by ${currentOwner}`,
                };
            }
        } catch (error) {
            console.error('[Context Bridge] File claim failed:', error);
            return {
                success: false,
                message: `Failed to claim file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Release ownership of a file
     */
    async releaseFile(sandboxId: string, filePath: string): Promise<boolean> {
        try {
            const locksKey = `build:${this.buildId}:file_locks`;
            const normalizedPath = filePath.replace(/\\/g, '/');

            // Check current owner
            const currentOwner = await this.redis.hget(locksKey, normalizedPath);

            if (currentOwner !== sandboxId) {
                console.warn(
                    `[Context Bridge] Sandbox ${sandboxId} cannot release ${normalizedPath} (owned by ${currentOwner})`
                );
                return false;
            }

            // Delete the lock
            await this.redis.hdel(locksKey, normalizedPath);
            this.sharedContext.fileOwnership.delete(normalizedPath);

            this.emit('fileReleased', { sandboxId, filePath: normalizedPath });
            return true;
        } catch (error) {
            console.error('[Context Bridge] File release failed:', error);
            return false;
        }
    }

    /**
     * Broadcast a discovery to all sandboxes
     */
    async broadcastDiscovery(discovery: Discovery): Promise<void> {
        try {
            const discoveryChannel = `build:${this.buildId}:discoveries`;
            const message = JSON.stringify({
                ...discovery,
                timestamp: discovery.timestamp || new Date().toISOString(),
            });

            await this.redis.publish(discoveryChannel, message);

            console.log(
                `[Context Bridge] Discovery broadcasted: ${discovery.type} from ${discovery.sandboxId}`
            );
        } catch (error) {
            console.error('[Context Bridge] Failed to broadcast discovery:', error);
            throw error;
        }
    }

    /**
     * Subscribe to discovery events
     */
    onDiscovery(callback: (discovery: Discovery) => void): void {
        this.discoveryCallbacks.push(callback);
    }

    /**
     * Handle incoming discovery
     */
    private handleDiscovery(discovery: Discovery): void {
        switch (discovery.type) {
            case 'pattern':
                const pattern: Pattern = {
                    id: uuidv4(),
                    name: discovery.data.name,
                    description: discovery.data.description,
                    discoveredBy: discovery.sandboxId,
                    sharedAt: discovery.timestamp,
                };
                this.sharedContext.discoveredPatterns.push(pattern);
                break;

            case 'error':
                const errorRecord: ErrorRecord = {
                    id: uuidv4(),
                    sandboxId: discovery.sandboxId,
                    error: discovery.data.error,
                    resolution: discovery.data.resolution,
                    timestamp: discovery.timestamp,
                };
                this.sharedContext.sharedErrors.push(errorRecord);
                break;

            case 'completion':
                if (discovery.data.featureId) {
                    this.sharedContext.completedFeatures.push(discovery.data.featureId);
                    this.sharedContext.inProgressFeatures.delete(discovery.data.featureId);
                }
                break;

            case 'conflict':
                console.warn(
                    `[Context Bridge] Conflict detected: ${discovery.data.message}`,
                    discovery.data
                );
                break;
        }

        // Emit to local listeners
        this.emit('discovery', discovery);

        // Call registered callbacks
        this.discoveryCallbacks.forEach((callback) => {
            try {
                callback(discovery);
            } catch (err) {
                console.error('[Context Bridge] Discovery callback error:', err);
            }
        });

        // Persist updated context
        this.persistSharedContext().catch((err) => {
            console.error('[Context Bridge] Failed to persist context after discovery:', err);
        });
    }

    /**
     * Get current file ownership map
     */
    async getFileOwnership(): Promise<Map<string, string>> {
        try {
            const locksKey = `build:${this.buildId}:file_locks`;
            const allLocks = await this.redis.hgetall(locksKey);

            const ownership = new Map<string, string>();
            for (const [filePath, sandboxId] of Object.entries(allLocks)) {
                ownership.set(filePath, sandboxId as string);
            }

            return ownership;
        } catch (error) {
            console.error('[Context Bridge] Failed to get file ownership:', error);
            return this.sharedContext.fileOwnership;
        }
    }

    /**
     * Get current shared context
     */
    async getSharedContext(): Promise<SandboxSharedContext> {
        try {
            const contextKey = `build:${this.buildId}:context`;
            const contextJson = await this.redis.get(contextKey);

            if (contextJson) {
                const parsed = JSON.parse(contextJson);
                return {
                    ...parsed,
                    inProgressFeatures: new Map(parsed.inProgressFeatures),
                    fileOwnership: new Map(parsed.fileOwnership),
                };
            }

            return this.sharedContext;
        } catch (error) {
            console.error('[Context Bridge] Failed to get shared context:', error);
            return this.sharedContext;
        }
    }

    /**
     * Update shared context atomically
     */
    async updateSharedContext(updates: Partial<SandboxSharedContext>): Promise<void> {
        try {
            // Merge updates
            this.sharedContext = {
                ...this.sharedContext,
                ...updates,
                inProgressFeatures:
                    updates.inProgressFeatures || this.sharedContext.inProgressFeatures,
                fileOwnership: updates.fileOwnership || this.sharedContext.fileOwnership,
            };

            await this.persistSharedContext();

            this.emit('contextUpdated', this.sharedContext);
        } catch (error) {
            console.error('[Context Bridge] Failed to update shared context:', error);
            throw error;
        }
    }

    /**
     * Persist shared context to Redis
     */
    private async persistSharedContext(): Promise<void> {
        const contextKey = `build:${this.buildId}:context`;
        await this.redis.set(
            contextKey,
            JSON.stringify({
                ...this.sharedContext,
                inProgressFeatures: Array.from(this.sharedContext.inProgressFeatures.entries()),
                fileOwnership: Array.from(this.sharedContext.fileOwnership.entries()),
            }),
            'EX',
            86400 // 24 hours TTL
        );
    }

    /**
     * Add item to merge queue
     */
    async addToMergeQueue(item: Omit<MergeQueueItem, 'id' | 'createdAt'>): Promise<MergeQueueItem> {
        const mergeItem: MergeQueueItem = {
            id: uuidv4(),
            ...item,
            createdAt: new Date().toISOString(),
        };

        this.sharedContext.pendingMerges.push(mergeItem);
        await this.persistSharedContext();

        this.emit('mergeQueued', mergeItem);
        return mergeItem;
    }

    /**
     * Update merge queue item status
     */
    async updateMergeStatus(
        itemId: string,
        status: MergeQueueItem['status']
    ): Promise<void> {
        const item = this.sharedContext.pendingMerges.find((m) => m.id === itemId);
        if (item) {
            item.status = status;
            await this.persistSharedContext();
            this.emit('mergeStatusChanged', { itemId, status });
        }
    }

    /**
     * Get pending merges
     */
    getPendingMerges(): MergeQueueItem[] {
        return this.sharedContext.pendingMerges.filter((m) => m.status === 'pending');
    }

    /**
     * Clean up Redis resources
     */
    async cleanup(): Promise<void> {
        try {
            console.log(`[Context Bridge] Cleaning up build ${this.buildId}`);

            // Unsubscribe from channels
            await this.subscriber.unsubscribe();

            // Clean up Redis keys
            const contextKey = `build:${this.buildId}:context`;
            const locksKey = `build:${this.buildId}:file_locks`;
            await this.redis.del(contextKey, locksKey);

            // Close connections
            await this.redis.quit();
            await this.subscriber.quit();

            this.isInitialized = false;
            this.emit('cleanup');

            console.log('[Context Bridge] Cleanup complete');
        } catch (error) {
            console.error('[Context Bridge] Cleanup failed:', error);
            throw error;
        }
    }
}

// =============================================================================
// FACTORY
// =============================================================================

let contextBridgeInstance: ContextBridgeService | null = null;

export function createContextBridgeService(
    config: ContextBridgeConfig
): ContextBridgeService {
    if (contextBridgeInstance) {
        console.warn('[Context Bridge] Reusing existing instance');
        return contextBridgeInstance;
    }

    contextBridgeInstance = new ContextBridgeService(config);
    return contextBridgeInstance;
}

export function getContextBridgeService(): ContextBridgeService | null {
    return contextBridgeInstance;
}

export function resetContextBridgeService(): void {
    if (contextBridgeInstance) {
        contextBridgeInstance.cleanup().catch((err) => {
            console.error('[Context Bridge] Error during reset cleanup:', err);
        });
        contextBridgeInstance = null;
    }
}
