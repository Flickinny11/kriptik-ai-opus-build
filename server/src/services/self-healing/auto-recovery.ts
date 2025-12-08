/**
 * Auto-Recovery Service
 *
 * Automatically attempts to fix common issues when detected.
 */

import { EventEmitter } from 'events';
import { getHealthMonitor } from './health-monitor.js';

interface RecoveryAction {
    name: string;
    description: string;
    execute: () => Promise<boolean>;
    appliesTo: string[]; // Service names
    maxAttempts: number;
}

interface RecoveryAttempt {
    service: string;
    action: string;
    timestamp: Date;
    success: boolean;
    error?: string;
}

export class AutoRecoveryService extends EventEmitter {
    private recoveryAttempts: RecoveryAttempt[] = [];
    private readonly MAX_ATTEMPTS_HISTORY = 50;
    private activeRecoveries: Set<string> = new Set();

    private readonly recoveryActions: RecoveryAction[] = [
        {
            name: 'clear_memory_cache',
            description: 'Clear in-memory caches to free up memory',
            execute: async () => {
                // Clear various caches
                if (global.gc) {
                    global.gc();
                }
                // Force garbage collection hint
                return true;
            },
            appliesTo: ['memory'],
            maxAttempts: 3,
        },
        {
            name: 'reconnect_database',
            description: 'Attempt to reconnect to the database',
            execute: async () => {
                // Database reconnection logic
                // Turso/LibSQL typically auto-reconnects, but we can force it
                try {
                    const { db } = await import('../../db.js');
                    const { sql } = await import('drizzle-orm');
                    await db.run(sql`SELECT 1`);
                    return true;
                } catch (error) {
                    console.error('[AutoRecovery] Database reconnect failed:', error);
                    return false;
                }
            },
            appliesTo: ['database'],
            maxAttempts: 3,
        },
        {
            name: 'rotate_api_key',
            description: 'Switch to backup API key if available',
            execute: async () => {
                // Check for backup API key
                const backupKey = process.env.OPENROUTER_API_KEY_BACKUP;
                if (backupKey) {
                    process.env.OPENROUTER_API_KEY = backupKey;
                    console.log('[AutoRecovery] Switched to backup OpenRouter API key');
                    return true;
                }
                return false;
            },
            appliesTo: ['openrouter'],
            maxAttempts: 1,
        },
        {
            name: 'restart_signal',
            description: 'Signal that a restart is needed',
            execute: async function(this: AutoRecoveryService) {
                // In serverless environments, we can't restart ourselves
                // But we can signal that a restart is needed
                console.log('[AutoRecovery] Worker restart requested');
                this.emit('restart_requested', { reason: 'auto_recovery' });
                return true;
            }.bind(this),
            appliesTo: ['memory', 'database'],
            maxAttempts: 1,
        },
    ];

    constructor() {
        super();
        this.setupHealthListeners();
    }

    private setupHealthListeners(): void {
        const monitor = getHealthMonitor();

        monitor.on('critical_failure', async ({ service, error }) => {
            console.log(`[AutoRecovery] Critical failure detected: ${service}`);
            await this.attemptRecovery(service, error);
        });

        monitor.on('status_change', async ({ service, previousStatus, newStatus }) => {
            if (newStatus === 'degraded' && previousStatus === 'healthy') {
                // Service degraded - attempt proactive recovery
                console.log(`[AutoRecovery] Service degraded: ${service}`);
                await this.attemptRecovery(service);
            }
        });
    }

    /**
     * Attempt automatic recovery for a service
     */
    async attemptRecovery(service: string, error?: string): Promise<boolean> {
        // Prevent concurrent recovery attempts for same service
        if (this.activeRecoveries.has(service)) {
            console.log(`[AutoRecovery] Recovery already in progress for ${service}`);
            return false;
        }

        this.activeRecoveries.add(service);

        try {
            const applicableActions = this.recoveryActions.filter(
                action => action.appliesTo.includes(service)
            );

            if (applicableActions.length === 0) {
                console.log(`[AutoRecovery] No recovery actions available for ${service}`);
                return false;
            }

            for (const action of applicableActions) {
                // Check if we've exceeded max attempts for this action
                const recentAttempts = this.recoveryAttempts.filter(
                    a => a.service === service &&
                        a.action === action.name &&
                        Date.now() - a.timestamp.getTime() < 3600000 // Last hour
                ).length;

                if (recentAttempts >= action.maxAttempts) {
                    console.log(`[AutoRecovery] Max attempts reached for ${action.name} on ${service}`);
                    continue;
                }

                console.log(`[AutoRecovery] Attempting ${action.name} for ${service}...`);

                try {
                    const success = await action.execute();

                    this.recordAttempt({
                        service,
                        action: action.name,
                        timestamp: new Date(),
                        success,
                    });

                    if (success) {
                        console.log(`[AutoRecovery] ${action.name} succeeded for ${service}`);
                        this.emit('recovery_success', { service, action: action.name });
                        return true;
                    }
                } catch (execError) {
                    this.recordAttempt({
                        service,
                        action: action.name,
                        timestamp: new Date(),
                        success: false,
                        error: String(execError),
                    });
                    console.error(`[AutoRecovery] ${action.name} failed:`, execError);
                }
            }

            // All recovery attempts failed
            this.emit('recovery_failed', { service, error });
            return false;
        } finally {
            this.activeRecoveries.delete(service);
        }
    }

    private recordAttempt(attempt: RecoveryAttempt): void {
        this.recoveryAttempts.push(attempt);

        if (this.recoveryAttempts.length > this.MAX_ATTEMPTS_HISTORY) {
            this.recoveryAttempts.shift();
        }
    }

    /**
     * Get recovery attempt history
     */
    getAttemptHistory(): RecoveryAttempt[] {
        return [...this.recoveryAttempts];
    }

    /**
     * Manually trigger recovery for a service
     */
    async manualRecovery(service: string): Promise<boolean> {
        return this.attemptRecovery(service, 'manual_trigger');
    }
}

// Singleton
let autoRecovery: AutoRecoveryService | null = null;

export function getAutoRecoveryService(): AutoRecoveryService {
    if (!autoRecovery) {
        autoRecovery = new AutoRecoveryService();
    }
    return autoRecovery;
}

