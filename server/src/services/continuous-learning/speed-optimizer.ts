/**
 * Speed Optimizer Service
 *
 * Tracks latency patterns and learns optimal configurations for faster response times.
 * Part of the Continuous Learning Engine that makes the system get FASTER over time.
 *
 * Key capabilities:
 * - Track TTFT and total latency for each prompt type
 * - Learn optimal context sizes for each task category
 * - Predict expected TTFT based on historical data
 * - Optimize context prioritization to reduce token count
 *
 * @see BUILDER-VIEW-FIX-IMPLEMENTATION-PLAN-v3.md Phase 0-A Prompt 8
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

/**
 * Latency data recorded for each generation.
 */
export interface LatencyData {
    /** Hash/signature of the prompt for pattern matching */
    promptSignature: string;
    /** Number of context tokens used */
    contextSize: number;
    /** Time to first token in milliseconds */
    ttftMs: number;
    /** Total latency in milliseconds */
    totalLatencyMs: number;
    /** Model used for generation */
    modelUsed: string;
    /** Whether speculative execution was used */
    wasSpeculative?: boolean;
    /** Whether the fast model response was used (speculative hit) */
    speculativeHit?: boolean;
    /** Timestamp of the recording */
    timestamp?: number;
}

/**
 * Learned pattern for a prompt signature.
 */
interface LatencyPattern {
    /** Running average of TTFT */
    avgTtft: number;
    /** Running average of total latency */
    avgTotal: number;
    /** Number of samples */
    samples: number;
    /** Optimal context size that gave best speed */
    optimalContextSize: number;
    /** Best TTFT seen */
    bestTtft: number;
    /** Worst TTFT seen */
    worstTtft: number;
    /** Model that gave best results */
    bestModel: string;
    /** Last updated timestamp */
    lastUpdated: number;
}

/**
 * Speed optimization recommendation.
 */
export interface SpeedRecommendation {
    /** Recommended context size */
    contextSize: number;
    /** Recommended model */
    model: string;
    /** Expected TTFT */
    expectedTtft: number;
    /** Confidence in recommendation (0-1) */
    confidence: number;
    /** Whether to use speculative execution */
    useSpeculative: boolean;
}

/**
 * Speed metrics aggregation.
 */
export interface SpeedMetrics {
    /** Average TTFT across all patterns */
    avgTtft: number;
    /** P50 TTFT */
    p50Ttft: number;
    /** P95 TTFT */
    p95Ttft: number;
    /** P99 TTFT */
    p99Ttft: number;
    /** Total patterns tracked */
    patternCount: number;
    /** Speculative hit rate */
    speculativeHitRate: number;
    /** Average improvement from learning */
    avgImprovement: number;
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    /** Maximum patterns to keep in memory */
    maxPatterns: 10000,
    /** Minimum samples needed for confident recommendations */
    minSamplesForRecommendation: 3,
    /** Weight for exponential moving average */
    emaWeight: 0.3,
    /** Default context size when no pattern exists */
    defaultContextSize: 8000,
    /** Target TTFT in milliseconds */
    targetTtftMs: 150,
    /** Context size reduction factor when optimizing */
    contextReductionFactor: 0.8,
};

// =============================================================================
// Speed Optimizer Class
// =============================================================================

export class SpeedOptimizer extends EventEmitter {
    private latencyPatterns: Map<string, LatencyPattern> = new Map();
    private speculativeStats = {
        totalHits: 0,
        totalMisses: 0,
    };
    private recentTtfts: number[] = [];

    constructor() {
        super();
    }

    /**
     * Record latency data for learning.
     */
    async recordLatency(data: LatencyData): Promise<void> {
        const existing = this.latencyPatterns.get(data.promptSignature);

        if (existing) {
            // Update with exponential moving average
            existing.avgTtft = existing.avgTtft * (1 - CONFIG.emaWeight) + data.ttftMs * CONFIG.emaWeight;
            existing.avgTotal = existing.avgTotal * (1 - CONFIG.emaWeight) + data.totalLatencyMs * CONFIG.emaWeight;
            existing.samples++;

            // Track best and worst
            if (data.ttftMs < existing.bestTtft) {
                existing.bestTtft = data.ttftMs;
                // Update optimal context size when we see improvement
                if (data.contextSize < existing.optimalContextSize) {
                    existing.optimalContextSize = data.contextSize;
                }
                existing.bestModel = data.modelUsed;
            }
            if (data.ttftMs > existing.worstTtft) {
                existing.worstTtft = data.ttftMs;
            }

            existing.lastUpdated = Date.now();
            this.latencyPatterns.set(data.promptSignature, existing);
        } else {
            // Create new pattern
            this.latencyPatterns.set(data.promptSignature, {
                avgTtft: data.ttftMs,
                avgTotal: data.totalLatencyMs,
                samples: 1,
                optimalContextSize: data.contextSize,
                bestTtft: data.ttftMs,
                worstTtft: data.ttftMs,
                bestModel: data.modelUsed,
                lastUpdated: Date.now(),
            });
        }

        // Track speculative stats
        if (data.wasSpeculative !== undefined) {
            if (data.speculativeHit) {
                this.speculativeStats.totalHits++;
            } else {
                this.speculativeStats.totalMisses++;
            }
        }

        // Keep recent TTFTs for percentile calculations
        this.recentTtfts.push(data.ttftMs);
        if (this.recentTtfts.length > 1000) {
            this.recentTtfts = this.recentTtfts.slice(-1000);
        }

        // Emit event for monitoring
        this.emit('latency_recorded', {
            signature: data.promptSignature,
            ttftMs: data.ttftMs,
            totalMs: data.totalLatencyMs,
            pattern: this.latencyPatterns.get(data.promptSignature),
        });

        // Prune old patterns if we have too many
        if (this.latencyPatterns.size > CONFIG.maxPatterns) {
            this.pruneOldPatterns();
        }
    }

    /**
     * Get optimal context size for a prompt signature.
     */
    getOptimalContextSize(promptSignature: string): number | null {
        const pattern = this.latencyPatterns.get(promptSignature);
        if (pattern && pattern.samples >= CONFIG.minSamplesForRecommendation) {
            return pattern.optimalContextSize;
        }
        return null;
    }

    /**
     * Predict TTFT for a prompt signature.
     */
    predictTTFT(promptSignature: string): number | null {
        const pattern = this.latencyPatterns.get(promptSignature);
        if (pattern && pattern.samples >= CONFIG.minSamplesForRecommendation) {
            return pattern.avgTtft;
        }
        return null;
    }

    /**
     * Get speed recommendation for a prompt.
     */
    getRecommendation(
        promptSignature: string,
        currentContextSize: number
    ): SpeedRecommendation {
        const pattern = this.latencyPatterns.get(promptSignature);

        if (pattern && pattern.samples >= CONFIG.minSamplesForRecommendation) {
            // Calculate confidence based on sample size
            const confidence = Math.min(1, pattern.samples / 20);

            // Recommend smaller context if current is larger than optimal
            const recommendedContextSize = currentContextSize > pattern.optimalContextSize * 1.5
                ? Math.floor(pattern.optimalContextSize * CONFIG.contextReductionFactor)
                : pattern.optimalContextSize;

            return {
                contextSize: recommendedContextSize,
                model: pattern.bestModel,
                expectedTtft: pattern.avgTtft,
                confidence,
                useSpeculative: pattern.avgTtft < CONFIG.targetTtftMs * 1.5, // Use speculative if we're close to target
            };
        }

        // Default recommendation for unknown patterns
        return {
            contextSize: Math.min(currentContextSize, CONFIG.defaultContextSize),
            model: 'claude-3-5-haiku-20241022',
            expectedTtft: 150,
            confidence: 0,
            useSpeculative: true, // Always use speculative for unknown patterns
        };
    }

    /**
     * Get aggregated speed metrics.
     */
    getMetrics(): SpeedMetrics {
        const ttfts = Array.from(this.latencyPatterns.values())
            .filter(p => p.samples >= CONFIG.minSamplesForRecommendation)
            .map(p => p.avgTtft);

        const sorted = [...this.recentTtfts].sort((a, b) => a - b);

        const totalSpeculative = this.speculativeStats.totalHits + this.speculativeStats.totalMisses;
        const speculativeHitRate = totalSpeculative > 0
            ? this.speculativeStats.totalHits / totalSpeculative
            : 0;

        // Calculate average improvement (best vs worst)
        let totalImprovement = 0;
        let improvementCount = 0;
        for (const pattern of this.latencyPatterns.values()) {
            if (pattern.samples >= 3 && pattern.worstTtft > pattern.bestTtft) {
                totalImprovement += (pattern.worstTtft - pattern.avgTtft) / pattern.worstTtft;
                improvementCount++;
            }
        }

        return {
            avgTtft: ttfts.length > 0 ? ttfts.reduce((a, b) => a + b, 0) / ttfts.length : 0,
            p50Ttft: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0,
            p95Ttft: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0,
            p99Ttft: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0,
            patternCount: this.latencyPatterns.size,
            speculativeHitRate,
            avgImprovement: improvementCount > 0 ? totalImprovement / improvementCount : 0,
        };
    }

    /**
     * Get all patterns (for debugging/export).
     */
    getAllPatterns(): Map<string, LatencyPattern> {
        return new Map(this.latencyPatterns);
    }

    /**
     * Clear all learned patterns (for testing).
     */
    clearPatterns(): void {
        this.latencyPatterns.clear();
        this.recentTtfts = [];
        this.speculativeStats = { totalHits: 0, totalMisses: 0 };
    }

    /**
     * Prune old patterns to stay within memory limits.
     */
    private pruneOldPatterns(): void {
        // Sort by last updated and remove oldest
        const entries = Array.from(this.latencyPatterns.entries())
            .sort(([, a], [, b]) => a.lastUpdated - b.lastUpdated);

        const toRemove = entries.slice(0, Math.floor(CONFIG.maxPatterns * 0.1));
        for (const [key] of toRemove) {
            this.latencyPatterns.delete(key);
        }

        console.log(`[SpeedOptimizer] Pruned ${toRemove.length} old patterns`);
    }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let speedOptimizerInstance: SpeedOptimizer | null = null;

/**
 * Get the singleton SpeedOptimizer instance.
 */
export function getSpeedOptimizer(): SpeedOptimizer {
    if (!speedOptimizerInstance) {
        speedOptimizerInstance = new SpeedOptimizer();
    }
    return speedOptimizerInstance;
}

/**
 * Create a new SpeedOptimizer instance (for testing).
 */
export function createSpeedOptimizer(): SpeedOptimizer {
    return new SpeedOptimizer();
}
