/**
 * Resilient Database Connection
 *
 * Enterprise-grade database connection management for Turso/LibSQL
 * with circuit breaker pattern, retry logic, and health monitoring.
 *
 * Features:
 * - Circuit breaker pattern for failure protection
 * - Exponential backoff with jitter for retries
 * - Connection pooling simulation for serverless
 * - Health monitoring and metrics
 * - Graceful degradation support
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient, Client } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// TYPES
// ============================================================================

interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastFailure: number;
    successCount: number;
}

interface RetryOptions {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter: boolean;
}

interface DBMetrics {
    totalQueries: number;
    failedQueries: number;
    retriedQueries: number;
    circuitBreakerTrips: number;
    avgLatencyMs: number;
    lastError?: string;
    lastErrorTime?: number;
}

interface DBHealthStatus {
    healthy: boolean;
    latencyMs: number;
    circuitState: 'closed' | 'open' | 'half-open';
    lastCheck: number;
    error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,         // Trips after 5 consecutive failures
    recoveryTimeout: 30000,      // 30 seconds before trying again
    successThreshold: 3,         // 3 successful requests to close circuit
};

const RETRY_CONFIG: RetryOptions = {
    maxRetries: 3,
    baseDelay: 100,              // 100ms initial delay
    maxDelay: 5000,              // 5 second max delay
    jitter: true,                // Add randomness to prevent thundering herd
};

const HEALTH_CHECK_INTERVAL = 30000;  // 30 seconds

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

class CircuitBreaker {
    private state: CircuitBreakerState = {
        state: 'closed',
        failures: 0,
        lastFailure: 0,
        successCount: 0,
    };

    private tripCount = 0;

    isOpen(): boolean {
        if (this.state.state === 'open') {
            // Check if recovery timeout has passed
            const now = Date.now();
            if (now - this.state.lastFailure >= CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
                this.state.state = 'half-open';
                this.state.successCount = 0;
                console.log('[CircuitBreaker] Transitioning to half-open state');
                return false;
            }
            return true;
        }
        return false;
    }

    recordSuccess(): void {
        if (this.state.state === 'half-open') {
            this.state.successCount++;
            if (this.state.successCount >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
                this.state.state = 'closed';
                this.state.failures = 0;
                console.log('[CircuitBreaker] Circuit closed - recovered');
            }
        } else if (this.state.state === 'closed') {
            this.state.failures = 0;
        }
    }

    recordFailure(): void {
        this.state.failures++;
        this.state.lastFailure = Date.now();

        if (this.state.state === 'half-open') {
            // Immediately open circuit on failure in half-open state
            this.state.state = 'open';
            console.log('[CircuitBreaker] Circuit opened - half-open test failed');
            this.tripCount++;
        } else if (
            this.state.state === 'closed' &&
            this.state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold
        ) {
            this.state.state = 'open';
            console.log(`[CircuitBreaker] Circuit opened after ${this.state.failures} failures`);
            this.tripCount++;
        }
    }

    getState(): 'closed' | 'open' | 'half-open' {
        return this.state.state;
    }

    getTripCount(): number {
        return this.tripCount;
    }
}

// ============================================================================
// RESILIENT DATABASE CLIENT
// ============================================================================

class ResilientDBClient {
    private client: Client | null = null;
    private db: ReturnType<typeof drizzle<typeof schema>> | null = null;
    private circuitBreaker = new CircuitBreaker();
    private metrics: DBMetrics = {
        totalQueries: 0,
        failedQueries: 0,
        retriedQueries: 0,
        circuitBreakerTrips: 0,
        avgLatencyMs: 0,
    };
    private latencySum = 0;
    private healthCheckTimer?: NodeJS.Timeout;
    private lastHealthStatus: DBHealthStatus | null = null;

    constructor() {
        this.initializeClient();
        this.startHealthMonitor();
    }

    /**
     * Initialize the database client
     */
    private initializeClient(): void {
        const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
        const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

        if (!tursoUrl) {
            throw new Error('TURSO_DATABASE_URL or DATABASE_URL is missing');
        }

        this.client = createClient({
            url: tursoUrl,
            authToken: tursoAuthToken,
        });

        this.db = drizzle(this.client, { schema });
    }

    /**
     * Get the Drizzle database instance
     */
    getDB(): ReturnType<typeof drizzle<typeof schema>> {
        if (!this.db) {
            this.initializeClient();
        }
        return this.db!;
    }

    /**
     * Get the raw LibSQL client
     */
    getClient(): Client {
        if (!this.client) {
            this.initializeClient();
        }
        return this.client!;
    }

    /**
     * Execute a query with retry and circuit breaker protection
     */
    async executeWithResilience<T>(
        operation: () => Promise<T>,
        operationName: string = 'query'
    ): Promise<T> {
        // Check circuit breaker
        if (this.circuitBreaker.isOpen()) {
            this.metrics.failedQueries++;
            throw new Error(`Circuit breaker is open - DB unavailable for ${operationName}`);
        }

        const startTime = Date.now();
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                const result = await operation();

                // Record success
                const latency = Date.now() - startTime;
                this.recordSuccess(latency);
                this.circuitBreaker.recordSuccess();

                if (attempt > 0) {
                    this.metrics.retriedQueries++;
                }

                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry on certain errors
                if (this.isNonRetryableError(lastError)) {
                    this.circuitBreaker.recordFailure();
                    this.recordFailure(lastError);
                    throw lastError;
                }

                // Wait before retrying
                if (attempt < RETRY_CONFIG.maxRetries) {
                    const delay = this.calculateBackoff(attempt);
                    console.log(
                        `[ResilientDB] ${operationName} failed, attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}, retrying in ${delay}ms`
                    );
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted
        this.circuitBreaker.recordFailure();
        this.recordFailure(lastError!);
        throw lastError!;
    }

    /**
     * Calculate exponential backoff with optional jitter
     */
    private calculateBackoff(attempt: number): number {
        let delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
        delay = Math.min(delay, RETRY_CONFIG.maxDelay);

        if (RETRY_CONFIG.jitter) {
            // Add up to 30% jitter
            const jitter = delay * 0.3 * Math.random();
            delay = delay + jitter;
        }

        return Math.floor(delay);
    }

    /**
     * Determine if an error should not be retried
     */
    private isNonRetryableError(error: Error): boolean {
        const nonRetryablePatterns = [
            'UNIQUE constraint failed',
            'NOT NULL constraint failed',
            'FOREIGN KEY constraint failed',
            'syntax error',
            'permission denied',
            'invalid input',
        ];

        const message = error.message.toLowerCase();
        return nonRetryablePatterns.some((pattern) => message.includes(pattern.toLowerCase()));
    }

    /**
     * Record successful operation
     */
    private recordSuccess(latencyMs: number): void {
        this.metrics.totalQueries++;
        this.latencySum += latencyMs;
        this.metrics.avgLatencyMs = this.latencySum / this.metrics.totalQueries;
    }

    /**
     * Record failed operation
     */
    private recordFailure(error: Error): void {
        this.metrics.totalQueries++;
        this.metrics.failedQueries++;
        this.metrics.lastError = error.message;
        this.metrics.lastErrorTime = Date.now();
        this.metrics.circuitBreakerTrips = this.circuitBreaker.getTripCount();
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Start health monitoring
     */
    private startHealthMonitor(): void {
        this.healthCheckTimer = setInterval(async () => {
            try {
                await this.checkHealth();
            } catch (error) {
                console.error('[ResilientDB] Health check failed:', error);
            }
        }, HEALTH_CHECK_INTERVAL);
    }

    /**
     * Stop health monitoring
     */
    stopHealthMonitor(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
    }

    /**
     * Check database health
     */
    async checkHealth(): Promise<DBHealthStatus> {
        const startTime = Date.now();

        try {
            // Skip if circuit breaker is open
            if (this.circuitBreaker.isOpen()) {
                this.lastHealthStatus = {
                    healthy: false,
                    latencyMs: 0,
                    circuitState: 'open',
                    lastCheck: Date.now(),
                    error: 'Circuit breaker is open',
                };
                return this.lastHealthStatus;
            }

            // Simple ping query using raw client
            const client = this.getClient();
            await client.execute('SELECT 1');

            const latency = Date.now() - startTime;
            this.circuitBreaker.recordSuccess();

            this.lastHealthStatus = {
                healthy: true,
                latencyMs: latency,
                circuitState: this.circuitBreaker.getState(),
                lastCheck: Date.now(),
            };

            return this.lastHealthStatus;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.circuitBreaker.recordFailure();

            this.lastHealthStatus = {
                healthy: false,
                latencyMs: Date.now() - startTime,
                circuitState: this.circuitBreaker.getState(),
                lastCheck: Date.now(),
                error: errorMessage,
            };

            return this.lastHealthStatus;
        }
    }

    /**
     * Get last health status without checking
     */
    getLastHealthStatus(): DBHealthStatus | null {
        return this.lastHealthStatus;
    }

    /**
     * Get database metrics
     */
    getMetrics(): DBMetrics {
        return {
            ...this.metrics,
            circuitBreakerTrips: this.circuitBreaker.getTripCount(),
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metrics = {
            totalQueries: 0,
            failedQueries: 0,
            retriedQueries: 0,
            circuitBreakerTrips: this.circuitBreaker.getTripCount(),
            avgLatencyMs: 0,
        };
        this.latencySum = 0;
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let resilientClient: ResilientDBClient | null = null;

function getResilientClient(): ResilientDBClient {
    if (!resilientClient) {
        resilientClient = new ResilientDBClient();
    }
    return resilientClient;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get the resilient database instance
 */
export function getDB(): ReturnType<typeof drizzle<typeof schema>> {
    return getResilientClient().getDB();
}

/**
 * Get the raw LibSQL client
 */
export function getClient(): Client {
    return getResilientClient().getClient();
}

/**
 * Execute a query with resilience (retries + circuit breaker)
 */
export async function executeResilient<T>(
    operation: () => Promise<T>,
    operationName?: string
): Promise<T> {
    return getResilientClient().executeWithResilience(operation, operationName);
}

/**
 * Check database health
 */
export async function checkDBHealth(): Promise<DBHealthStatus> {
    return getResilientClient().checkHealth();
}

/**
 * Get database metrics
 */
export function getDBMetrics(): DBMetrics {
    return getResilientClient().getMetrics();
}

/**
 * Get last known health status (non-blocking)
 */
export function getLastDBHealth(): DBHealthStatus | null {
    return getResilientClient().getLastHealthStatus();
}

/**
 * Stop health monitoring (for graceful shutdown)
 */
export function stopDBHealthMonitor(): void {
    getResilientClient().stopHealthMonitor();
}

/**
 * Reset metrics (for testing)
 */
export function resetDBMetrics(): void {
    getResilientClient().resetMetrics();
}

// Export the db instance for backwards compatibility
export const db = getDB();
export const client = getClient();

export default {
    db,
    client,
    getDB,
    getClient,
    executeResilient,
    checkDBHealth,
    getDBMetrics,
    getLastDBHealth,
    stopDBHealthMonitor,
    resetDBMetrics,
};
