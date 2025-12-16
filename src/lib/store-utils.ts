/**
 * Zustand Store Utilities
 *
 * Memory management utilities for Zustand stores to prevent memory leaks
 * and optimize performance for high-scale applications.
 *
 * Features:
 * - Array size limiting to prevent unbounded growth
 * - Automatic cleanup of old entries
 * - Store reset utilities
 * - Subscription cleanup helpers
 * - Memory usage monitoring
 */

import { StateCreator, StoreApi } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

export interface ArrayLimitConfig {
    maxItems: number;
    removeStrategy: 'fifo' | 'lifo' | 'oldest';
    timestampField?: string;
}

export interface CleanupConfig {
    maxAge: number;                    // Max age in milliseconds
    timestampField: string;            // Field containing timestamp
    cleanupInterval?: number;          // Auto-cleanup interval
}

export interface StoreMemoryStats {
    keys: number;
    estimatedSize: number;
    arrayLengths: Record<string, number>;
}

// ============================================================================
// ARRAY LIMITING
// ============================================================================

/**
 * Limit array size while maintaining newest entries
 */
export function limitArray<T>(
    array: T[],
    config: ArrayLimitConfig
): T[] {
    if (array.length <= config.maxItems) {
        return array;
    }

    switch (config.removeStrategy) {
        case 'fifo':
            // Remove oldest entries (from beginning)
            return array.slice(-config.maxItems);

        case 'lifo':
            // Remove newest entries (from end)
            return array.slice(0, config.maxItems);

        case 'oldest':
            // Remove entries with oldest timestamps
            if (config.timestampField) {
                const sorted = [...array].sort((a, b) => {
                    const aTime = getTimestamp(a, config.timestampField!);
                    const bTime = getTimestamp(b, config.timestampField!);
                    return bTime - aTime; // Newest first
                });
                return sorted.slice(0, config.maxItems);
            }
            return array.slice(-config.maxItems);

        default:
            return array.slice(-config.maxItems);
    }
}

/**
 * Get timestamp from an object
 */
function getTimestamp(obj: unknown, field: string): number {
    if (obj && typeof obj === 'object' && field in obj) {
        const value = (obj as Record<string, unknown>)[field];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return new Date(value).getTime();
        if (value instanceof Date) return value.getTime();
    }
    return 0;
}

// ============================================================================
// CLEANUP UTILITIES
// ============================================================================

/**
 * Remove entries older than maxAge
 */
export function cleanupOldEntries<T>(
    array: T[],
    config: CleanupConfig
): T[] {
    const cutoff = Date.now() - config.maxAge;

    return array.filter(item => {
        const timestamp = getTimestamp(item, config.timestampField);
        return timestamp > cutoff;
    });
}

/**
 * Create an auto-cleanup function
 */
export function createAutoCleanup<T extends Record<string, unknown>>(
    getState: () => T,
    setState: (partial: Partial<T>) => void,
    configs: Array<{
        field: keyof T;
        maxItems?: number;
        maxAge?: number;
        timestampField?: string;
    }>,
    intervalMs: number = 60000
): () => void {
    const cleanup = () => {
        const state = getState();
        const updates: Partial<T> = {};

        for (const config of configs) {
            const value = state[config.field];
            if (!Array.isArray(value)) continue;

            let cleaned = value as unknown[];

            // Apply age limit
            if (config.maxAge && config.timestampField) {
                cleaned = cleanupOldEntries(cleaned, {
                    maxAge: config.maxAge,
                    timestampField: config.timestampField,
                });
            }

            // Apply size limit
            if (config.maxItems && cleaned.length > config.maxItems) {
                cleaned = limitArray(cleaned, {
                    maxItems: config.maxItems,
                    removeStrategy: config.timestampField ? 'oldest' : 'fifo',
                    timestampField: config.timestampField,
                });
            }

            if (cleaned.length !== (value as unknown[]).length) {
                (updates as Record<string, unknown>)[config.field as string] = cleaned;
            }
        }

        if (Object.keys(updates).length > 0) {
            setState(updates);
        }
    };

    // Run initial cleanup
    cleanup();

    // Set up interval
    const timer = setInterval(cleanup, intervalMs);

    // Return cleanup function
    return () => clearInterval(timer);
}

// ============================================================================
// STORE RESET UTILITIES
// ============================================================================

/**
 * Create a reset function that preserves certain keys
 */
export function createResetFunction<T extends Record<string, unknown>>(
    initialState: T,
    preserveKeys: (keyof T)[] = []
): (currentState: T) => T {
    return (currentState: T): T => {
        const preserved: Partial<T> = {};
        for (const key of preserveKeys) {
            preserved[key] = currentState[key];
        }
        return { ...initialState, ...preserved };
    };
}

/**
 * Deep reset a store to initial state
 */
export function resetStore<T>(
    store: StoreApi<T>,
    initialState: T
): void {
    store.setState(initialState, true);
}

// ============================================================================
// SUBSCRIPTION CLEANUP
// ============================================================================

/**
 * Track subscriptions for cleanup
 */
export class SubscriptionManager {
    private subscriptions: Set<() => void> = new Set();

    add(unsubscribe: () => void): void {
        this.subscriptions.add(unsubscribe);
    }

    remove(unsubscribe: () => void): void {
        this.subscriptions.delete(unsubscribe);
    }

    cleanup(): void {
        for (const unsubscribe of this.subscriptions) {
            try {
                unsubscribe();
            } catch (e) {
                console.error('[SubscriptionManager] Error during cleanup:', e);
            }
        }
        this.subscriptions.clear();
    }

    get count(): number {
        return this.subscriptions.size;
    }
}

// Global subscription manager
const globalSubscriptions = new SubscriptionManager();

export function trackSubscription(unsubscribe: () => void): () => void {
    globalSubscriptions.add(unsubscribe);
    return () => {
        globalSubscriptions.remove(unsubscribe);
        unsubscribe();
    };
}

export function cleanupAllSubscriptions(): void {
    globalSubscriptions.cleanup();
}

// ============================================================================
// MEMORY MONITORING
// ============================================================================

/**
 * Estimate memory size of a value
 */
export function estimateSize(value: unknown, seen = new WeakSet()): number {
    if (value === null || value === undefined) return 0;

    const type = typeof value;

    if (type === 'boolean') return 4;
    if (type === 'number') return 8;
    if (type === 'string') return (value as string).length * 2;

    if (type === 'object') {
        if (seen.has(value as object)) return 0;
        seen.add(value as object);

        if (Array.isArray(value)) {
            return value.reduce((acc, item) => acc + estimateSize(item, seen), 0);
        }

        if (value instanceof Date) return 8;
        if (value instanceof Map) {
            let size = 0;
            value.forEach((v, k) => {
                size += estimateSize(k, seen) + estimateSize(v, seen);
            });
            return size;
        }
        if (value instanceof Set) {
            let size = 0;
            value.forEach(v => {
                size += estimateSize(v, seen);
            });
            return size;
        }

        // Regular object
        let size = 0;
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                size += key.length * 2;
                size += estimateSize((value as Record<string, unknown>)[key], seen);
            }
        }
        return size;
    }

    return 0;
}

/**
 * Get memory stats for a store state
 */
export function getStoreMemoryStats<T extends Record<string, unknown>>(
    state: T
): StoreMemoryStats {
    const stats: StoreMemoryStats = {
        keys: Object.keys(state).length,
        estimatedSize: 0,
        arrayLengths: {},
    };

    for (const [key, value] of Object.entries(state)) {
        stats.estimatedSize += estimateSize(value);

        if (Array.isArray(value)) {
            stats.arrayLengths[key] = value.length;
        }
    }

    return stats;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Zustand middleware for automatic array limiting
 */
export const withArrayLimits = <T extends Record<string, unknown>>(
    config: Record<string, ArrayLimitConfig>
): (f: StateCreator<T>) => StateCreator<T> => {
    return (create) => (set, get, api) => {
        const limitedSet: typeof set = (partial, replace?) => {
            const newState = typeof partial === 'function'
                ? partial(get())
                : partial;

            const limited = { ...newState } as Partial<T>;

            for (const [key, limitConfig] of Object.entries(config)) {
                if (key in limited && Array.isArray(limited[key as keyof T])) {
                    (limited as Record<string, unknown>)[key] = limitArray(
                        limited[key as keyof T] as unknown[],
                        limitConfig
                    );
                }
            }

            // @ts-expect-error - Zustand overload types are complex
            set(limited, replace);
        };

        return create(limitedSet, get, api);
    };
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_LIMITS = {
    logs: { maxItems: 1000, removeStrategy: 'fifo' as const },
    messages: { maxItems: 500, removeStrategy: 'fifo' as const },
    notifications: { maxItems: 100, removeStrategy: 'oldest' as const, timestampField: 'createdAt' },
    history: { maxItems: 50, removeStrategy: 'fifo' as const },
    events: { maxItems: 200, removeStrategy: 'fifo' as const },
};

export default {
    limitArray,
    cleanupOldEntries,
    createAutoCleanup,
    createResetFunction,
    resetStore,
    trackSubscription,
    cleanupAllSubscriptions,
    estimateSize,
    getStoreMemoryStats,
    withArrayLimits,
    DEFAULT_LIMITS,
};
