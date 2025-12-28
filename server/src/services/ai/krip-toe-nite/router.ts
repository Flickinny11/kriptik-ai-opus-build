/**
 * Krip-Toe-Nite Intelligent Router
 *
 * Makes routing decisions based on:
 * - Task type classification
 * - Complexity estimation
 * - Model performance characteristics
 * - Cost optimization
 *
 * Strategies:
 * - SINGLE: Use fastest appropriate model (trivial/simple)
 * - SPECULATIVE: Fast model streams, smart validates (medium)
 * - PARALLEL: Race multiple models, take best (complex)
 * - ENSEMBLE: Multiple models vote/merge (expert)
 *
 * VERIFIED: December 16, 2025 - Dual-SDK architecture with direct Anthropic/OpenAI calls
 */

import {
    TaskType,
    Complexity,
    type ExecutionStrategy,
    type RoutingDecision,
    type TaskAnalysis,
    type BuildContext,
    type KTNModelConfig,
} from './types.js';

import {
    KTN_MODELS,
    STRATEGY_MODELS,
    getFallbackChain,
} from './model-registry.js';

import { getTaskClassifier } from './classifier.js';

// =============================================================================
// ROUTING CONFIGURATION
// =============================================================================

/**
 * Maximum latency targets by strategy (ms)
 */
const LATENCY_TARGETS: Record<ExecutionStrategy, number> = {
    single: 500,       // Trivial/simple: sub-500ms
    speculative: 5000, // Medium: 5s total
    parallel: 15000,   // Complex: 15s
    ensemble: 30000,   // Expert: 30s
};

/**
 * Complexity to strategy mapping
 */
const COMPLEXITY_STRATEGY: Record<Complexity, ExecutionStrategy> = {
    [Complexity.TRIVIAL]: 'single',
    [Complexity.SIMPLE]: 'single',
    [Complexity.MEDIUM]: 'speculative',
    [Complexity.COMPLEX]: 'parallel',
    [Complexity.EXPERT]: 'ensemble',
};

// =============================================================================
// ROUTER CLASS
// =============================================================================

/**
 * Krip-Toe-Nite Router
 *
 * Intelligent routing engine that selects optimal models and strategies
 * based on task analysis.
 */
export class KripToeNiteRouter {
    private classifier = getTaskClassifier();

    /**
     * Make a routing decision for a prompt
     */
    route(prompt: string, context?: BuildContext): RoutingDecision {
        // 1. Analyze the task
        const analysis = this.classifier.analyze(prompt, context);

        // 2. Determine strategy based on complexity
        const strategy = this.selectStrategy(analysis);

        // 3. Select models based on strategy and task type
        const { primaryModel, parallelModel, fallbackModel } =
            this.selectModels(analysis, strategy);

        // 4. Determine caching and streaming settings
        const useCache = strategy === 'single' || strategy === 'speculative';
        const streamResponse = true; // Always stream for best UX

        // 5. Set latency target
        const maxLatencyMs = LATENCY_TARGETS[strategy];

        // 6. Build reasoning
        const reasoning = this.buildReasoning(analysis, strategy, primaryModel);

        return {
            primaryModel,
            strategy,
            parallelModel,
            useCache,
            streamResponse,
            maxLatencyMs,
            fallbackModel,
            reasoning,
        };
    }

    /**
     * Select execution strategy based on task analysis
     */
    private selectStrategy(analysis: TaskAnalysis): ExecutionStrategy {
        // Override for critical tasks - always use intelligence tier
        if (analysis.isCritical && analysis.complexity < Complexity.COMPLEX) {
            return 'parallel';
        }

        // Design-heavy tasks get speculative minimum for quality
        if (analysis.isDesignHeavy && analysis.complexity < Complexity.MEDIUM) {
            return 'speculative';
        }

        // Default mapping
        return COMPLEXITY_STRATEGY[analysis.complexity];
    }

    /**
     * Select models based on strategy and task type
     */
    private selectModels(
        analysis: TaskAnalysis,
        strategy: ExecutionStrategy
    ): {
        primaryModel: KTNModelConfig;
        parallelModel?: KTNModelConfig;
        fallbackModel?: KTNModelConfig;
    } {
        switch (strategy) {
            case 'single':
                return this.selectSingleModels(analysis);

            case 'speculative':
                return this.selectSpeculativeModels(analysis);

            case 'parallel':
                return this.selectParallelModels(analysis);

            case 'ensemble':
                return this.selectEnsembleModels(analysis);

            default:
                return this.selectSingleModels(analysis);
        }
    }

    /**
     * Select models for SINGLE strategy (trivial/simple tasks)
     */
    private selectSingleModels(analysis: TaskAnalysis): {
        primaryModel: KTNModelConfig;
        fallbackModel?: KTNModelConfig;
    } {
        // Trivial: Fastest possible
        if (analysis.complexity === Complexity.TRIVIAL) {
            return {
                primaryModel: KTN_MODELS[STRATEGY_MODELS.trivial.primary],
                fallbackModel: KTN_MODELS[STRATEGY_MODELS.trivial.fallback],
            };
        }

        // Simple: Task-type specific
        const primary = this.selectByTaskType(analysis.taskType, 'speed');
        const fallback = getFallbackChain(primary.id)[0];

        return {
            primaryModel: primary,
            fallbackModel: fallback,
        };
    }

    /**
     * Select models for SPECULATIVE strategy (medium tasks)
     * Fast model streams immediately, smart model validates
     */
    private selectSpeculativeModels(analysis: TaskAnalysis): {
        primaryModel: KTNModelConfig;
        parallelModel: KTNModelConfig;
        fallbackModel: KTNModelConfig;
    } {
        // For code tasks, use specialized fast model + Claude validation
        const isCodeTask = this.isCodeTask(analysis.taskType);

        if (isCodeTask) {
            return {
                primaryModel: KTN_MODELS['deepseek-v3'],
                parallelModel: KTN_MODELS['claude-sonnet-4.5'],
                fallbackModel: KTN_MODELS['gpt-5.1-codex-max'],
            };
        }

        // For UI/design tasks
        if (analysis.taskType === TaskType.UI_COMPONENT || analysis.isDesignHeavy) {
            return {
                primaryModel: KTN_MODELS['gemini-2.5-flash'],
                parallelModel: KTN_MODELS['claude-sonnet-4.5'],
                fallbackModel: KTN_MODELS['gpt-5.1-codex-max'],
            };
        }

        // Default speculative
        return {
            primaryModel: KTN_MODELS[STRATEGY_MODELS.medium.fast],
            parallelModel: KTN_MODELS[STRATEGY_MODELS.medium.smart],
            fallbackModel: KTN_MODELS[STRATEGY_MODELS.medium.fallback],
        };
    }

    /**
     * Select models for PARALLEL strategy (complex tasks)
     * Race intelligence tier models, take best response
     * Uses Opus 4.5 for complex reasoning - per CLAUDE.md requirements
     */
    private selectParallelModels(analysis: TaskAnalysis): {
        primaryModel: KTNModelConfig;
        parallelModel: KTNModelConfig;
        fallbackModel: KTNModelConfig;
    } {
        // For code-heavy complex tasks - use Opus for maximum quality
        if (this.isCodeTask(analysis.taskType)) {
            return {
                primaryModel: KTN_MODELS['claude-opus-4.5'],
                parallelModel: KTN_MODELS['gpt-5.1-codex-max'],
                fallbackModel: KTN_MODELS['claude-sonnet-4.5'],
            };
        }

        // For architecture/design - Opus is mandatory
        if (analysis.taskType === TaskType.ARCHITECTURE ||
            analysis.taskType === TaskType.DESIGN_SYSTEM) {
            return {
                primaryModel: KTN_MODELS['claude-opus-4.5'],
                parallelModel: KTN_MODELS['gpt-5.2-pro'],
                fallbackModel: KTN_MODELS['claude-sonnet-4.5'],
            };
        }

        // Default complex - always use Opus 4.5 for complex tasks
        return {
            primaryModel: KTN_MODELS[STRATEGY_MODELS.complex.primary], // claude-opus-4.5
            parallelModel: KTN_MODELS['gpt-5.2-pro'],
            fallbackModel: KTN_MODELS[STRATEGY_MODELS.complex.fallback],
        };
    }

    /**
     * Select models for ENSEMBLE strategy (expert tasks)
     * Multiple models contribute, responses merged/voted
     * Uses Opus 4.5 + GPT-5.2 Pro for maximum quality
     */
    private selectEnsembleModels(analysis: TaskAnalysis): {
        primaryModel: KTNModelConfig;
        parallelModel: KTNModelConfig;
        fallbackModel: KTNModelConfig;
    } {
        // Expert tasks always use best available
        // Opus 4.5 for intent lock, GPT-5.2 Pro for validation
        return {
            primaryModel: KTN_MODELS[STRATEGY_MODELS.expert.primary], // claude-opus-4.5
            parallelModel: KTN_MODELS[STRATEGY_MODELS.expert.validation], // claude-opus-4.5 (validation)
            fallbackModel: KTN_MODELS[STRATEGY_MODELS.expert.fallback], // claude-sonnet-4.5
        };
    }

    /**
     * Select model by task type and tier
     * Speed tier now uses Claude Haiku 4.5 (matches Sonnet 4 quality, much faster)
     */
    private selectByTaskType(
        taskType: TaskType,
        tier: 'speed' | 'intelligence' | 'specialist'
    ): KTNModelConfig {
        switch (taskType) {
            case TaskType.CODE_GENERATION:
            case TaskType.CODE_FIX:
            case TaskType.CODE_REFACTOR:
            case TaskType.DEBUGGING:
                return tier === 'speed'
                    ? KTN_MODELS['claude-haiku-4.5']  // Haiku 4.5 matches Sonnet 4 for code
                    : KTN_MODELS['claude-opus-4.5'];  // Opus for intelligence tier

            case TaskType.UI_COMPONENT:
            case TaskType.DESIGN_SYSTEM:
                return tier === 'speed'
                    ? KTN_MODELS['claude-haiku-4.5']
                    : KTN_MODELS['claude-opus-4.5'];

            case TaskType.API_DESIGN:
            case TaskType.DATABASE:
                return tier === 'speed'
                    ? KTN_MODELS['claude-haiku-4.5']
                    : KTN_MODELS['claude-opus-4.5'];

            case TaskType.TESTING:
                return tier === 'speed'
                    ? KTN_MODELS['claude-haiku-4.5']
                    : KTN_MODELS['gpt-5.1-codex-max'];

            case TaskType.EXPLANATION:
            case TaskType.DOCUMENTATION:
                return tier === 'speed'
                    ? KTN_MODELS['claude-haiku-4.5']
                    : KTN_MODELS['claude-sonnet-4.5'];

            case TaskType.ARCHITECTURE:
            case TaskType.COMPLEX_REASONING:
                // Architecture always gets Opus, even for "speed" tier
                return KTN_MODELS['claude-opus-4.5'];

            default:
                return tier === 'speed'
                    ? KTN_MODELS['claude-haiku-4.5']
                    : KTN_MODELS['claude-sonnet-4.5'];
        }
    }

    /**
     * Check if task type is code-related
     */
    private isCodeTask(taskType: TaskType): boolean {
        return [
            TaskType.CODE_GENERATION,
            TaskType.CODE_FIX,
            TaskType.CODE_REFACTOR,
            TaskType.API_DESIGN,
            TaskType.DATABASE,
            TaskType.TESTING,
            TaskType.DEBUGGING,
        ].includes(taskType);
    }

    /**
     * Build human-readable routing reasoning
     */
    private buildReasoning(
        analysis: TaskAnalysis,
        strategy: ExecutionStrategy,
        primaryModel: KTNModelConfig
    ): string {
        const parts: string[] = [];

        // Strategy reasoning
        switch (strategy) {
            case 'single':
                parts.push(`Using fast single-model execution for ${analysis.complexity === Complexity.TRIVIAL ? 'trivial' : 'simple'} task`);
                break;
            case 'speculative':
                parts.push('Using speculative execution: fast model streams while smart model validates');
                break;
            case 'parallel':
                parts.push('Using parallel execution: racing models for best result');
                break;
            case 'ensemble':
                parts.push('Using ensemble: multiple expert models for maximum quality');
                break;
        }

        // Model reasoning
        parts.push(`Primary: ${primaryModel.name} (${primaryModel.tier} tier, ~${primaryModel.avgTtftMs}ms TTFT)`);

        // Task reasoning
        parts.push(analysis.reason);

        return parts.join('. ');
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let routerInstance: KripToeNiteRouter | null = null;

export function getKripToeNiteRouter(): KripToeNiteRouter {
    if (!routerInstance) {
        routerInstance = new KripToeNiteRouter();
    }
    return routerInstance;
}

export default KripToeNiteRouter;
