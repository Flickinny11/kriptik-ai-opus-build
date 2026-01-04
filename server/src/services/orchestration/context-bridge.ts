/**
 * Context Bridge Service
 *
 * Enables real-time context sharing between cloud sandboxes.
 * Uses Upstash Redis REST API for state storage and coordination.
 *
 * This service coordinates parallel sandbox builds by:
 * - Managing atomic file ownership to prevent conflicts
 * - Broadcasting discoveries (patterns, errors, completions) via queues
 * - Maintaining shared context across all sandboxes
 * - Managing the merge queue for verified code integration
 *
 * Note: Uses Upstash Redis REST (HTTP-based) instead of ioredis (TCP-based)
 * to work with Vercel KV integration.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getRedis, getConnectionMode } from '../infrastructure/redis.js';
import type { Redis } from '@upstash/redis';

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
    redisUrl?: string; // Kept for API compatibility but not used (uses Vercel KV env vars)
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
    private buildId: string;
    private sandboxIds: string[];
    private sharedContext: SandboxSharedContext;
    private discoveryCallbacks: Array<(discovery: Discovery) => void>;
    private isInitialized: boolean;
    private pollingInterval: NodeJS.Timeout | null;
    private lastPolledIndex: number;

    constructor(config: ContextBridgeConfig) {
        super();

        // Get Redis from the existing infrastructure (supports Vercel KV + Upstash)
        this.redis = getRedis();

        const mode = getConnectionMode();
        console.log(`[Context Bridge] Using Redis mode: ${mode}`);

        this.buildId = config.buildId;
        this.sandboxIds = config.sandboxIds;
        this.discoveryCallbacks = [];
        this.isInitialized = false;
        this.pollingInterval = null;
        this.lastPolledIndex = 0;

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

        // Note: @upstash/redis is stateless HTTP, no persistent connection events
        console.log('[Context Bridge] Initialized with Upstash REST client');
        this.emit('connected');
    }

    /**
     * Initialize shared context and start discovery polling
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
                { ex: 86400 } // 24 hours TTL
            );

            // Initialize discovery queue key
            const discoveryQueueKey = `build:${this.buildId}:discoveries`;
            const exists = await this.redis.exists(discoveryQueueKey);
            if (!exists) {
                // Initialize with empty array if not exists
                await this.redis.set(discoveryQueueKey, JSON.stringify([]), { ex: 86400 });
            }

            // Create file ownership locks hash
            const locksKey = `build:${this.buildId}:file_locks`;
            await this.redis.del(locksKey);

            // Start polling for discoveries (replaces pub/sub)
            this.startDiscoveryPolling();

            this.isInitialized = true;
            console.log(`[Context Bridge] Initialized for build ${this.buildId}`);
            this.emit('initialized', { buildId: this.buildId, sandboxCount: this.sandboxIds.length });
        } catch (error) {
            console.error('[Context Bridge] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start polling for new discoveries (replaces pub/sub which isn't supported in REST API)
     */
    private startDiscoveryPolling(): void {
        const pollInterval = 1000; // Poll every second

        this.pollingInterval = setInterval(async () => {
            try {
                const discoveryQueueKey = `build:${this.buildId}:discoveries`;
                const queueData = await this.redis.get<string>(discoveryQueueKey);

                if (queueData) {
                    const discoveries: Discovery[] = JSON.parse(queueData);

                    // Process any new discoveries since last poll
                    if (discoveries.length > this.lastPolledIndex) {
                        const newDiscoveries = discoveries.slice(this.lastPolledIndex);
                        this.lastPolledIndex = discoveries.length;

                        for (const discovery of newDiscoveries) {
                            this.handleDiscovery(discovery);
                        }
                    }
                }
            } catch (err) {
                console.error('[Context Bridge] Discovery polling error:', err);
            }
        }, pollInterval);
    }

    /**
     * Stop discovery polling
     */
    private stopDiscoveryPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Atomically claim ownership of a file to prevent conflicts
     * Simulates HSETNX behavior with Upstash
     */
    async claimFile(sandboxId: string, filePath: string): Promise<FileClaimResult> {
        try {
            const locksKey = `build:${this.buildId}:file_locks`;
            const normalizedPath = filePath.replace(/\\/g, '/');

            // Check if already claimed
            const currentOwner = await this.redis.hget<string>(locksKey, normalizedPath);

            if (currentOwner) {
                // Already claimed
                return {
                    success: false,
                    currentOwner,
                    message: `File ${normalizedPath} already claimed by ${currentOwner}`,
                };
            }

            // Claim the file (not truly atomic in REST, but sufficient for most cases)
            await this.redis.hset(locksKey, { [normalizedPath]: sandboxId });

            // Verify we got it (handle race conditions)
            const verifyOwner = await this.redis.hget<string>(locksKey, normalizedPath);

            if (verifyOwner !== sandboxId) {
                return {
                    success: false,
                    currentOwner: verifyOwner || undefined,
                    message: `File ${normalizedPath} was claimed by ${verifyOwner} (race condition)`,
                };
            }

            this.sharedContext.fileOwnership.set(normalizedPath, sandboxId);
            this.emit('fileClaimed', { sandboxId, filePath: normalizedPath });

            return {
                success: true,
                message: `File ${normalizedPath} claimed by sandbox ${sandboxId}`,
            };
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
            const currentOwner = await this.redis.hget<string>(locksKey, normalizedPath);

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
     * Broadcast a discovery to all sandboxes (via queue instead of pub/sub)
     */
    async broadcastDiscovery(discovery: Discovery): Promise<void> {
        try {
            const discoveryQueueKey = `build:${this.buildId}:discoveries`;

            // Get current discoveries
            const queueData = await this.redis.get<string>(discoveryQueueKey);
            const discoveries: Discovery[] = queueData ? JSON.parse(queueData) : [];

            // Add new discovery
            const newDiscovery = {
                ...discovery,
                timestamp: discovery.timestamp || new Date().toISOString(),
            };
            discoveries.push(newDiscovery);

            // Keep only last 1000 discoveries to prevent unbounded growth
            const trimmedDiscoveries = discoveries.slice(-1000);

            // Store updated queue
            await this.redis.set(discoveryQueueKey, JSON.stringify(trimmedDiscoveries), { ex: 86400 });

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
            const allLocks = await this.redis.hgetall<Record<string, string>>(locksKey);

            const ownership = new Map<string, string>();
            if (allLocks) {
                for (const [filePath, sandboxId] of Object.entries(allLocks)) {
                    ownership.set(filePath, sandboxId);
                }
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
            const contextJson = await this.redis.get<string>(contextKey);

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
            { ex: 86400 } // 24 hours TTL
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

            // Stop polling
            this.stopDiscoveryPolling();

            // Clean up Redis keys
            const contextKey = `build:${this.buildId}:context`;
            const locksKey = `build:${this.buildId}:file_locks`;
            const discoveryKey = `build:${this.buildId}:discoveries`;
            await this.redis.del(contextKey, locksKey, discoveryKey);

            // Note: @upstash/redis is stateless HTTP, no connection to close

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
