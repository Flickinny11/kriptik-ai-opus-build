/**
 * Credit Ceiling Integration Helpers
 *
 * Utilities for integrating credit ceiling checks into build loops,
 * feature agents, and other long-running operations.
 */

import { EventEmitter } from 'events';
import { getCreditCeilingService, type CeilingWarning, type CeilingCheckResult } from './credit-ceiling.js';

export interface CeilingCheckOptions {
    userId: string;
    buildId?: string;
    operationName: string;
    estimatedCost: number;
    onWarning?: (warning: CeilingWarning) => Promise<void>;
    onPause?: (reason: string) => Promise<void>;
}

export interface BuildLoopCeilingGuard extends EventEmitter {
    checkBeforeOperation(options: CeilingCheckOptions): Promise<boolean>;
    shouldContinue(userId: string, buildId?: string): Promise<boolean>;
    recordUsage(userId: string, actualCost: number, buildId?: string): Promise<void>;
}

/**
 * Create a ceiling guard for build loops
 *
 * Emits:
 * - 'warning': When approaching ceiling
 * - 'pause': When ceiling exceeded
 * - 'usage_recorded': When usage is recorded
 */
export function createBuildLoopCeilingGuard(): BuildLoopCeilingGuard {
    const emitter = new EventEmitter();
    const ceilingService = getCreditCeilingService();

    return Object.assign(emitter, {
        /**
         * Check if operation can proceed
         */
        async checkBeforeOperation(options: CeilingCheckOptions): Promise<boolean> {
            try {
                const result = await ceilingService.checkCeiling(
                    options.userId,
                    options.estimatedCost,
                    options.buildId
                );

                // Emit warning if present
                if (result.warning) {
                    emitter.emit('warning', {
                        warning: result.warning,
                        userId: options.userId,
                        buildId: options.buildId,
                        operationName: options.operationName,
                    });

                    // Call custom warning handler if provided
                    if (options.onWarning) {
                        await options.onWarning(result.warning);
                    }
                }

                // Handle pause
                if (result.shouldPause) {
                    const reason = result.reason || 'Credit ceiling exceeded';

                    emitter.emit('pause', {
                        userId: options.userId,
                        buildId: options.buildId,
                        reason,
                        operationName: options.operationName,
                    });

                    // Call custom pause handler if provided
                    if (options.onPause) {
                        await options.onPause(reason);
                    }

                    return false;
                }

                return result.allowed;
            } catch (error) {
                console.error('Error checking ceiling:', error);
                // On error, allow operation to proceed (fail open)
                return true;
            }
        },

        /**
         * Quick check if build should continue
         */
        async shouldContinue(userId: string, buildId?: string): Promise<boolean> {
            try {
                const status = await ceilingService.getCeilingStatus(userId, buildId);
                return status.canProceed;
            } catch (error) {
                console.error('Error checking ceiling status:', error);
                return true; // Fail open
            }
        },

        /**
         * Record actual usage after operation completes
         */
        async recordUsage(userId: string, actualCost: number, buildId?: string): Promise<void> {
            try {
                emitter.emit('usage_recorded', {
                    userId,
                    buildId,
                    actualCost,
                    timestamp: new Date().toISOString(),
                });

                // Clear estimation cache since we have actual usage now
                if (buildId) {
                    ceilingService.clearEstimationCache(buildId);
                }
            } catch (error) {
                console.error('Error recording usage:', error);
            }
        },
    });
}

/**
 * Middleware-style ceiling check for operations
 */
export async function withCeilingCheck<T>(
    options: CeilingCheckOptions,
    operation: () => Promise<T>
): Promise<T> {
    const guard = createBuildLoopCeilingGuard();

    const canProceed = await guard.checkBeforeOperation(options);

    if (!canProceed) {
        throw new Error('Operation blocked: Credit ceiling exceeded');
    }

    const result = await operation();

    // Record that operation completed
    await guard.recordUsage(options.userId, options.estimatedCost, options.buildId);

    return result;
}

/**
 * Helper to check ceiling before Phase 2 (Parallel Build)
 */
export async function checkCeilingForPhase(
    userId: string,
    buildId: string,
    phaseName: string,
    estimatedCredits: number
): Promise<CeilingCheckResult> {
    const ceilingService = getCreditCeilingService();
    return ceilingService.checkCeiling(userId, estimatedCredits, buildId);
}

/**
 * Helper to get warning popup data for UI
 */
export async function getWarningPopupData(
    userId: string,
    buildId?: string
): Promise<CeilingWarning | null> {
    try {
        const ceilingService = getCreditCeilingService();
        const status = await ceilingService.getCeilingStatus(userId, buildId);

        // Return warning if status is warning, critical, or exceeded
        if (status.status !== 'ok') {
            const result = await ceilingService.checkCeiling(userId, 0, buildId);
            return result.warning || null;
        }

        return null;
    } catch (error) {
        console.error('Error getting warning popup data:', error);
        return null;
    }
}

/**
 * Periodic ceiling check for long-running operations
 *
 * Usage:
 * ```ts
 * const checker = createPeriodicCeilingChecker(userId, buildId, {
 *   interval: 30000, // Check every 30 seconds
 *   onWarning: async (warning) => {
 *     // Show popup to user
 *   },
 *   onExceeded: async () => {
 *     // Pause build
 *   }
 * });
 *
 * // Start checking
 * checker.start();
 *
 * // Stop when done
 * checker.stop();
 * ```
 */
export interface PeriodicCeilingChecker {
    start(): void;
    stop(): void;
    isRunning(): boolean;
}

export interface PeriodicCheckerOptions {
    interval?: number; // ms, default 30000 (30 seconds)
    onWarning?: (warning: CeilingWarning) => Promise<void>;
    onExceeded?: () => Promise<void>;
}

export function createPeriodicCeilingChecker(
    userId: string,
    buildId: string,
    options: PeriodicCheckerOptions = {}
): PeriodicCeilingChecker {
    const interval = options.interval || 30000;
    let intervalId: NodeJS.Timeout | null = null;
    let lastWarningThreshold = 0;

    const ceilingService = getCreditCeilingService();

    const check = async () => {
        try {
            const status = await ceilingService.getCeilingStatus(userId, buildId);

            // Ceiling exceeded
            if (status.status === 'exceeded' && options.onExceeded) {
                await options.onExceeded();
                return;
            }

            // Warning threshold crossed
            if (status.status !== 'ok' && options.onWarning) {
                const currentThreshold = status.percentUsed >= 100 ? 100 :
                                        status.percentUsed >= 90 ? 90 : 75;

                // Only trigger if we've crossed a new threshold
                if (currentThreshold > lastWarningThreshold) {
                    lastWarningThreshold = currentThreshold;

                    const result = await ceilingService.checkCeiling(userId, 0, buildId);
                    if (result.warning) {
                        await options.onWarning(result.warning);
                    }
                }
            }
        } catch (error) {
            console.error('Error in periodic ceiling check:', error);
        }
    };

    return {
        start() {
            if (intervalId) {
                return; // Already running
            }

            // Check immediately
            check();

            // Then check periodically
            intervalId = setInterval(check, interval);
        },

        stop() {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        },

        isRunning() {
            return intervalId !== null;
        },
    };
}
