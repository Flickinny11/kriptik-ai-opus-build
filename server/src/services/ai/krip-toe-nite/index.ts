/**
 * Krip-Toe-Nite - Intelligent Model Orchestration for KripTik AI
 *
 * A unified model interface that appears as a single model selection to users
 * but internally orchestrates multiple frontier models for maximum speed,
 * quality, and cost efficiency.
 *
 * Features:
 * - Intelligent task classification
 * - Complexity-based routing
 * - Speculative execution (fast + smart in parallel)
 * - Automatic fallback chains
 * - Telemetry integration with Learning Engine
 *
 * All models accessed via OpenRouter through the Anthropic SDK.
 */

import { v4 as uuidv4 } from 'uuid';

import {
    type GenerationRequest,
    type GenerationResponse,
    type ExecutionChunk,
    type BuildContext,
    type KripToeNiteConfig,
    type RequestTelemetry,
} from './types.js';

import { getTaskClassifier, TaskClassifier } from './classifier.js';
import { getKripToeNiteRouter, KripToeNiteRouter } from './router.js';
import { getKripToeNiteExecutor, KripToeNiteExecutor } from './executor.js';
import { KTN_MODELS, estimateCost, getAllModelsForDisplay } from './model-registry.js';

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

/**
 * Krip-Toe-Nite Service
 *
 * Main entry point for intelligent model orchestration.
 * Appears as a single model but internally routes to optimal models.
 */
export class KripToeNiteService {
    private classifier: TaskClassifier;
    private router: KripToeNiteRouter;
    private executor: KripToeNiteExecutor;
    private config: Required<KripToeNiteConfig>;

    // Telemetry tracking
    private requestCount = 0;
    private totalCost = 0;
    private totalTokens = 0;
    private telemetryBuffer: RequestTelemetry[] = [];

    constructor(config?: KripToeNiteConfig) {
        this.classifier = getTaskClassifier();
        this.router = getKripToeNiteRouter();
        this.executor = getKripToeNiteExecutor();

        this.config = {
            enableCache: config?.enableCache ?? true,
            cacheSimilarityThreshold: config?.cacheSimilarityThreshold ?? 0.92,
            enableSpeculative: config?.enableSpeculative ?? true,
            defaultMaxLatencyMs: config?.defaultMaxLatencyMs ?? 30000,
            enableTelemetry: config?.enableTelemetry ?? true,
            maxRetries: config?.maxRetries ?? 3,
            retryDelayMs: config?.retryDelayMs ?? 1000,
            complexityThresholds: {
                trivialMaxLength: config?.complexityThresholds?.trivialMaxLength ?? 50,
                simpleMaxLength: config?.complexityThresholds?.simpleMaxLength ?? 200,
                expertMinLength: config?.complexityThresholds?.expertMinLength ?? 1000,
            },
        };

        console.log('[KripToeNite] Service initialized');
    }

    /**
     * Generate a response using intelligent routing
     */
    async *generate(
        request: GenerationRequest
    ): AsyncGenerator<ExecutionChunk> {
        const requestId = uuidv4();
        const startTime = Date.now();
        this.requestCount++;

        try {
            // 1. Route to optimal model(s)
            const decision = this.router.route(request.prompt, request.context);

            // 2. Log routing decision
            if (this.config.enableTelemetry) {
                console.log(`[KripToeNite] Request ${requestId.slice(0, 8)}: ${decision.strategy} -> ${decision.primaryModel.name}`);
            }

            // 3. Execute using selected strategy
            let outputTokens = 0;
            let fullContent = '';

            for await (const chunk of this.executor.execute(request, decision)) {
                if (chunk.type === 'text') {
                    outputTokens += this.estimateTokens(chunk.content);
                    fullContent += chunk.content;
                }
                yield chunk;
            }

            // 4. Calculate cost
            const inputTokens = this.estimateTokens(request.prompt);
            const cost = estimateCost(decision.primaryModel, inputTokens, outputTokens);
            this.totalCost += cost;
            this.totalTokens += inputTokens + outputTokens;

            // 5. Log completion
            if (this.config.enableTelemetry) {
                const latencyMs = Date.now() - startTime;
                console.log(`[KripToeNite] Completed in ${latencyMs}ms, cost: $${cost.toFixed(4)}`);

                // Buffer telemetry for Learning Engine
                this.bufferTelemetry({
                    requestId,
                    timestamp: startTime,
                    promptHash: this.hashPrompt(request.prompt),
                    promptLength: request.prompt.length,
                    promptTokens: inputTokens,
                    context: {
                        framework: request.context?.framework,
                        language: request.context?.language,
                        fileCount: request.context?.fileCount,
                    },
                    routing: {
                        taskType: decision.reasoning.includes('Code') ?
                            this.classifier.classifyTaskType(request.prompt, request.context) :
                            this.classifier.classifyTaskType(request.prompt, request.context),
                        complexity: this.classifier.estimateComplexity(request.prompt, request.context),
                        strategy: decision.strategy,
                        primaryModel: decision.primaryModel.id,
                        parallelModel: decision.parallelModel?.id,
                    },
                    performance: {
                        ttftMs: 0, // Would be captured from executor
                        totalLatencyMs: latencyMs,
                        outputTokens,
                    },
                    cost: {
                        input: (inputTokens / 1_000_000) * decision.primaryModel.costPer1MInput,
                        output: (outputTokens / 1_000_000) * decision.primaryModel.costPer1MOutput,
                        total: cost,
                    },
                });
            }

        } catch (error) {
            yield {
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error',
                model: 'krip-toe-nite',
                strategy: 'single',
                timestamp: Date.now(),
            };
        }
    }

    /**
     * Generate a response (non-streaming)
     */
    async generateSync(request: GenerationRequest): Promise<GenerationResponse> {
        const chunks: ExecutionChunk[] = [];
        let fullContent = '';

        for await (const chunk of this.generate(request)) {
            chunks.push(chunk);
            if (chunk.type === 'text') {
                fullContent += chunk.content;
            }
        }

        const decision = this.router.route(request.prompt, request.context);
        const analysis = this.classifier.analyze(request.prompt, request.context);

        const inputTokens = this.estimateTokens(request.prompt);
        const outputTokens = this.estimateTokens(fullContent);
        const cost = estimateCost(decision.primaryModel, inputTokens, outputTokens);

        return {
            id: uuidv4(),
            content: fullContent,
            model: decision.primaryModel.id,
            modelConfig: decision.primaryModel,
            usage: {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost: cost,
            },
            taskAnalysis: analysis,
            routingDecision: decision,
            latencyMs: 0, // Would be calculated
            strategy: decision.strategy,
            wasEnhanced: chunks.some(c => c.metadata?.isEnhancement),
        };
    }

    /**
     * Get service statistics
     */
    getStats(): {
        requestCount: number;
        totalCost: number;
        totalTokens: number;
        averageCostPerRequest: number;
        averageTokensPerRequest: number;
    } {
        return {
            requestCount: this.requestCount,
            totalCost: this.totalCost,
            totalTokens: this.totalTokens,
            averageCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0,
            averageTokensPerRequest: this.requestCount > 0 ? this.totalTokens / this.requestCount : 0,
        };
    }

    /**
     * Get buffered telemetry for Learning Engine
     */
    getAndClearTelemetry(): RequestTelemetry[] {
        const buffer = [...this.telemetryBuffer];
        this.telemetryBuffer = [];
        return buffer;
    }

    /**
     * Analyze a prompt without generating
     */
    analyzePrompt(prompt: string, context?: BuildContext) {
        const analysis = this.classifier.analyze(prompt, context);
        const decision = this.router.route(prompt, context);

        return {
            analysis,
            decision,
            estimatedCost: this.estimateCostForPrompt(prompt, decision.primaryModel.id),
        };
    }

    /**
     * Estimate cost for a prompt
     */
    private estimateCostForPrompt(prompt: string, modelId: string): number {
        const model = KTN_MODELS[modelId];
        if (!model) return 0;

        const inputTokens = this.estimateTokens(prompt);
        const outputTokens = inputTokens * 2; // Rough estimate

        return estimateCost(model, inputTokens, outputTokens);
    }

    /**
     * Estimate token count for text
     */
    private estimateTokens(text: string): number {
        // Rough estimate: ~4 chars per token
        return Math.ceil(text.length / 4);
    }

    /**
     * Hash prompt for telemetry (privacy)
     */
    private hashPrompt(prompt: string): string {
        // Simple hash for telemetry - not cryptographic
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    /**
     * Buffer telemetry for Learning Engine
     */
    private bufferTelemetry(telemetry: RequestTelemetry): void {
        this.telemetryBuffer.push(telemetry);

        // Keep buffer size manageable
        if (this.telemetryBuffer.length > 100) {
            this.telemetryBuffer = this.telemetryBuffer.slice(-50);
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let serviceInstance: KripToeNiteService | null = null;

/**
 * Get the singleton Krip-Toe-Nite service
 */
export function getKripToeNiteService(config?: KripToeNiteConfig): KripToeNiteService {
    if (!serviceInstance) {
        serviceInstance = new KripToeNiteService(config);
    }
    return serviceInstance;
}

/**
 * Reset the service (for testing)
 */
export function resetKripToeNiteService(): void {
    serviceInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

// Main service
export { KripToeNiteService };

// Types
export * from './types.js';

// Components
export { TaskClassifier, getTaskClassifier } from './classifier.js';
export { KripToeNiteRouter, getKripToeNiteRouter } from './router.js';
export { KripToeNiteExecutor, getKripToeNiteExecutor } from './executor.js';

// Model registry
export {
    KTN_MODELS,
    TIER_PREFERENCES,
    STRATEGY_MODELS,
    getModel,
    getModelsByTier,
    getFastestModel,
    getBestCodeModel,
    getFallbackChain,
    estimateCost,
    getAllModelsForDisplay,
} from './model-registry.js';

// Default export
export default KripToeNiteService;

