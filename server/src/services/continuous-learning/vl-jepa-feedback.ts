/**
 * VL-JEPA Feedback Loop
 *
 * Integrates VL-JEPA services (Semantic Intent, Semantic Satisfaction, Visual Understanding)
 * into the continuous learning system for quality improvement over time.
 *
 * Key capabilities:
 * - Track which intent interpretations led to satisfied users
 * - Learn semantic patterns that correlate with successful builds
 * - Improve visual understanding based on anti-slop feedback
 * - Create unified pipelines that combine speed + quality optimization
 *
 * @see BUILDER-VIEW-FIX-IMPLEMENTATION-PLAN-v3.md Phase 0-A Prompt 9
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

/**
 * Build outcome data for learning.
 */
export interface BuildOutcomeData {
    /** Unique build identifier */
    buildId: string;
    /** Original user intent/prompt */
    originalIntent: string;
    /** Intent analysis result */
    intentAnalysis: {
        appType: string;
        appSoul: string;
        complexity: number;
        category: string;
    };
    /** Satisfaction score (0-1) */
    satisfactionScore: number;
    /** Whether visual verification passed */
    visualVerificationPassed: boolean;
    /** Time to first token */
    ttftMs: number;
    /** Total build time */
    totalTimeMs: number;
    /** Build outcome */
    outcome: 'success' | 'failure';
    /** Anti-slop score (0-100) */
    antiSlopScore?: number;
    /** User feedback if any */
    userFeedback?: 'positive' | 'negative' | 'neutral';
}

/**
 * Success pattern learned from builds.
 */
interface SuccessPattern {
    /** Embedding of the intent */
    intentEmbedding: number[];
    /** Average satisfaction score */
    satisfactionScore: number;
    /** Build outcome distribution */
    outcomeDistribution: {
        success: number;
        failure: number;
    };
    /** Average TTFT */
    avgTtft: number;
    /** Number of samples */
    samples: number;
    /** Last updated timestamp */
    lastUpdated: number;
}

/**
 * Satisfaction prediction result.
 */
export interface SatisfactionPrediction {
    /** Predicted satisfaction score */
    predictedScore: number;
    /** Confidence in prediction (0-1) */
    confidence: number;
    /** Number of similar successful builds */
    similarSuccessfulBuilds: number;
    /** Recommended approach based on similar builds */
    recommendedApproach?: string;
}

/**
 * Optimized configuration based on learning.
 */
export interface OptimizedConfig {
    /** Whether to use speculative execution */
    useSpeculative: boolean;
    /** Whether to use HyperThinking */
    useHyperThinking: boolean;
    /** Optimal context size for this type of intent */
    optimalContextSize: number;
    /** Expected TTFT */
    expectedTTFT: number;
    /** Expected satisfaction score */
    expectedSatisfaction: number;
    /** Confidence in these recommendations */
    confidence: number;
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    /** Maximum patterns to store */
    maxPatterns: 5000,
    /** Minimum samples for confident prediction */
    minSamplesForPrediction: 3,
    /** Similarity threshold for pattern matching */
    similarityThreshold: 0.8,
    /** Weight for exponential moving average */
    emaWeight: 0.3,
};

// Default context sizes by category
const DEFAULT_CONTEXT_SIZES: Record<string, number> = {
    'simple_crud': 4000,
    'api_integration': 8000,
    'full_stack_app': 16000,
    'complex_system': 32000,
    'default': 8000,
};

// Expected TTFT by category (with speculative execution)
const DEFAULT_TTFT: Record<string, number> = {
    'simple_crud': 100,
    'api_integration': 125,
    'full_stack_app': 150,
    'complex_system': 200,
    'default': 150,
};

// =============================================================================
// VL-JEPA Feedback Loop Class
// =============================================================================

export class VLJEPAFeedbackLoop extends EventEmitter {
    private successPatterns: Map<string, SuccessPattern> = new Map();
    private categoryStats: Map<string, {
        totalBuilds: number;
        successfulBuilds: number;
        avgSatisfaction: number;
        avgTtft: number;
    }> = new Map();

    constructor() {
        super();
    }

    /**
     * Record build outcome for learning.
     */
    async recordBuildOutcome(data: BuildOutcomeData): Promise<void> {
        // Generate intent embedding (simplified - in production use actual embedding service)
        const intentEmbedding = await this.getIntentEmbedding(data.originalIntent);
        const intentSignature = this.hashEmbedding(intentEmbedding);

        // Update success patterns
        const existing = this.successPatterns.get(intentSignature);

        if (existing) {
            // Update with EMA
            existing.satisfactionScore =
                existing.satisfactionScore * (1 - CONFIG.emaWeight) +
                data.satisfactionScore * CONFIG.emaWeight;
            existing.avgTtft =
                existing.avgTtft * (1 - CONFIG.emaWeight) +
                data.ttftMs * CONFIG.emaWeight;
            existing.samples++;

            // Update outcome distribution
            if (data.outcome === 'success') {
                existing.outcomeDistribution.success++;
            } else {
                existing.outcomeDistribution.failure++;
            }

            existing.lastUpdated = Date.now();
            this.successPatterns.set(intentSignature, existing);
        } else {
            // Create new pattern
            this.successPatterns.set(intentSignature, {
                intentEmbedding,
                satisfactionScore: data.satisfactionScore,
                outcomeDistribution: {
                    success: data.outcome === 'success' ? 1 : 0,
                    failure: data.outcome === 'failure' ? 1 : 0,
                },
                avgTtft: data.ttftMs,
                samples: 1,
                lastUpdated: Date.now(),
            });
        }

        // Update category stats
        const category = data.intentAnalysis.category || 'default';
        const catStats = this.categoryStats.get(category) || {
            totalBuilds: 0,
            successfulBuilds: 0,
            avgSatisfaction: 0,
            avgTtft: 0,
        };

        catStats.totalBuilds++;
        if (data.outcome === 'success') {
            catStats.successfulBuilds++;
        }
        catStats.avgSatisfaction =
            (catStats.avgSatisfaction * (catStats.totalBuilds - 1) + data.satisfactionScore) /
            catStats.totalBuilds;
        catStats.avgTtft =
            (catStats.avgTtft * (catStats.totalBuilds - 1) + data.ttftMs) /
            catStats.totalBuilds;

        this.categoryStats.set(category, catStats);

        // Reinforce successful patterns
        if (data.outcome === 'success' && data.satisfactionScore > 0.85) {
            await this.reinforcePattern(intentSignature, data);
        }

        // Emit event
        this.emit('outcome_recorded', {
            buildId: data.buildId,
            signature: intentSignature,
            outcome: data.outcome,
            satisfactionScore: data.satisfactionScore,
            patternSamples: this.successPatterns.get(intentSignature)?.samples || 1,
        });

        // Prune if needed
        if (this.successPatterns.size > CONFIG.maxPatterns) {
            this.pruneOldPatterns();
        }
    }

    /**
     * Predict satisfaction for a new intent.
     */
    async predictSatisfaction(intent: string): Promise<SatisfactionPrediction> {
        const embedding = await this.getIntentEmbedding(intent);

        // Find similar patterns
        let bestMatch: {
            score: number;
            pattern: SuccessPattern;
        } | null = null;

        for (const [, pattern] of this.successPatterns) {
            const similarity = this.cosineSimilarity(embedding, pattern.intentEmbedding);
            if (similarity > CONFIG.similarityThreshold && pattern.samples >= CONFIG.minSamplesForPrediction) {
                if (!bestMatch || similarity > bestMatch.score) {
                    bestMatch = { score: similarity, pattern };
                }
            }
        }

        if (bestMatch) {
            const successRate = bestMatch.pattern.outcomeDistribution.success /
                (bestMatch.pattern.outcomeDistribution.success + bestMatch.pattern.outcomeDistribution.failure);

            return {
                predictedScore: bestMatch.pattern.satisfactionScore,
                confidence: Math.min(bestMatch.score, bestMatch.pattern.samples / 10),
                similarSuccessfulBuilds: bestMatch.pattern.outcomeDistribution.success,
                recommendedApproach: successRate > 0.8
                    ? 'High success rate - proceed with confidence'
                    : 'Mixed results - consider additional verification',
            };
        }

        // No similar patterns found
        return {
            predictedScore: 0.7, // Conservative estimate
            confidence: 0,
            similarSuccessfulBuilds: 0,
        };
    }

    /**
     * Get optimized configuration for an intent.
     */
    async getOptimizedConfig(intent: string, category?: string): Promise<OptimizedConfig> {
        const prediction = await this.predictSatisfaction(intent);
        const cat = category || 'default';

        // Get category stats for TTFT estimation
        const catStats = this.categoryStats.get(cat);
        const expectedTTFT = catStats?.avgTtft || DEFAULT_TTFT[cat] || DEFAULT_TTFT.default;

        // Analyze complexity from intent
        const complexity = this.estimateComplexity(intent);

        return {
            // Use speculative for speed when we're confident
            useSpeculative: prediction.confidence > 0.6,
            // Use HyperThinking for complex intents
            useHyperThinking: complexity > 0.7,
            // Learned optimal context size
            optimalContextSize: DEFAULT_CONTEXT_SIZES[cat] || DEFAULT_CONTEXT_SIZES.default,
            // Expected performance
            expectedTTFT,
            expectedSatisfaction: prediction.predictedScore,
            confidence: prediction.confidence,
        };
    }

    /**
     * Get all category statistics.
     */
    getCategoryStats(): Map<string, {
        totalBuilds: number;
        successfulBuilds: number;
        avgSatisfaction: number;
        avgTtft: number;
    }> {
        return new Map(this.categoryStats);
    }

    /**
     * Get learning metrics.
     */
    getMetrics(): {
        totalPatterns: number;
        totalSamples: number;
        avgSatisfaction: number;
        successRate: number;
    } {
        let totalSamples = 0;
        let totalSuccess = 0;
        let totalFailure = 0;
        let satisfactionSum = 0;

        for (const pattern of this.successPatterns.values()) {
            totalSamples += pattern.samples;
            totalSuccess += pattern.outcomeDistribution.success;
            totalFailure += pattern.outcomeDistribution.failure;
            satisfactionSum += pattern.satisfactionScore * pattern.samples;
        }

        return {
            totalPatterns: this.successPatterns.size,
            totalSamples,
            avgSatisfaction: totalSamples > 0 ? satisfactionSum / totalSamples : 0,
            successRate: (totalSuccess + totalFailure) > 0
                ? totalSuccess / (totalSuccess + totalFailure)
                : 0,
        };
    }

    /**
     * Reinforce successful patterns.
     */
    private async reinforcePattern(signature: string, data: BuildOutcomeData): Promise<void> {
        // This would integrate with the actual VL-JEPA services in production
        // For now, we just emit an event
        this.emit('pattern_reinforced', {
            signature,
            buildId: data.buildId,
            satisfactionScore: data.satisfactionScore,
            category: data.intentAnalysis.category,
        });
    }

    /**
     * Generate embedding for intent (simplified).
     * In production, this would use the actual SemanticIntentService.
     */
    private async getIntentEmbedding(intent: string): Promise<number[]> {
        // Simplified embedding using character codes and word hashing
        // In production, use actual embedding service
        const words = intent.toLowerCase().split(/\s+/);
        const embedding: number[] = new Array(128).fill(0);

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const hash = this.hashString(word);
            const idx = hash % embedding.length;
            embedding[idx] += 1 / (i + 1); // Weight by position
        }

        // Normalize
        const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
        if (norm > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= norm;
            }
        }

        return embedding;
    }

    /**
     * Hash embedding for storage key.
     */
    private hashEmbedding(embedding: number[]): string {
        return embedding.slice(0, 10).map(v => Math.round(v * 100)).join('_');
    }

    /**
     * Cosine similarity between embeddings.
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator > 0 ? dotProduct / denominator : 0;
    }

    /**
     * Simple string hash function.
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Estimate complexity from intent text.
     */
    private estimateComplexity(intent: string): number {
        // Simplified complexity estimation
        const wordCount = intent.split(/\s+/).length;
        const hasIntegrations = /api|stripe|supabase|auth|payment|database/i.test(intent);
        const hasMultipleFeatures = /and|also|with|including|plus/i.test(intent);
        const hasComplexTerms = /real-?time|websocket|streaming|microservice|distributed/i.test(intent);

        let complexity = 0.3; // Base
        complexity += Math.min(0.2, wordCount / 100); // Word count factor
        if (hasIntegrations) complexity += 0.2;
        if (hasMultipleFeatures) complexity += 0.15;
        if (hasComplexTerms) complexity += 0.15;

        return Math.min(1, complexity);
    }

    /**
     * Prune old patterns.
     */
    private pruneOldPatterns(): void {
        const entries = Array.from(this.successPatterns.entries())
            .sort(([, a], [, b]) => a.lastUpdated - b.lastUpdated);

        const toRemove = entries.slice(0, Math.floor(CONFIG.maxPatterns * 0.1));
        for (const [key] of toRemove) {
            this.successPatterns.delete(key);
        }

        console.log(`[VLJEPAFeedbackLoop] Pruned ${toRemove.length} old patterns`);
    }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let vlJepaFeedbackInstance: VLJEPAFeedbackLoop | null = null;

/**
 * Get the singleton VLJEPAFeedbackLoop instance.
 */
export function getVLJEPAFeedbackLoop(): VLJEPAFeedbackLoop {
    if (!vlJepaFeedbackInstance) {
        vlJepaFeedbackInstance = new VLJEPAFeedbackLoop();
    }
    return vlJepaFeedbackInstance;
}

/**
 * Create a new VLJEPAFeedbackLoop instance (for testing).
 */
export function createVLJEPAFeedbackLoop(): VLJEPAFeedbackLoop {
    return new VLJEPAFeedbackLoop();
}
