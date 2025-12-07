/**
 * KripToeNite Facade - Single entry point for intelligent model routing
 *
 * Use this instead of direct ClaudeService/OpenRouterClient calls for:
 * - Automatic task classification
 * - Intelligent model routing
 * - Strategy selection (single, speculative, parallel, ensemble)
 * - Cost optimization
 *
 * This provides convenience methods for common use cases while
 * allowing full customization when needed.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    getKripToeNiteService,
    KripToeNiteService,
    getTaskClassifier,
    TaskClassifier,
    getKripToeNiteRouter,
    KripToeNiteRouter,
    type GenerationRequest,
    type GenerationResponse,
    type ExecutionChunk,
    type BuildContext,
    type ExecutionStrategy,
    type TaskType,
    type Complexity,
    type TaskAnalysis,
    type RoutingDecision,
} from './index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RequestContext {
    projectId: string;
    userId: string;
    sessionId?: string;
    framework?: string;
    language?: string;
    fileCount?: number;
    activeFile?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    currentErrors?: string[];
}

export interface KTNResult {
    id: string;
    content: string;
    model: string;
    strategy: ExecutionStrategy;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCost: number;
    };
    analysis?: TaskAnalysis;
    routing?: RoutingDecision;
    latencyMs: number;
    ttftMs?: number;
    wasEnhanced: boolean;
}

export interface StreamingKTNResult {
    chunks: AsyncGenerator<ExecutionChunk>;
    getMetadata: () => Promise<{
        model: string;
        strategy: ExecutionStrategy;
        latencyMs: number;
    }>;
}

// =============================================================================
// FACADE CLASS
// =============================================================================

/**
 * KripToeNite Facade - Unified interface for intelligent model routing
 *
 * Provides:
 * - Simple `generate()` for automatic routing
 * - `intentLock()` for critical decisions (ensemble strategy)
 * - `buildFeature()` for code generation (speculative strategy)
 * - `quickCheck()` for fast verification (single fast model)
 * - `designReview()` for visual/design tasks (intelligent model)
 * - Streaming support via `generateStream()`
 */
export class KripToeNiteFacade {
    private service: KripToeNiteService;
    private classifier: TaskClassifier;
    private router: KripToeNiteRouter;

    constructor() {
        this.service = getKripToeNiteService();
        this.classifier = getTaskClassifier();
        this.router = getKripToeNiteRouter();

        console.log('[KripToeNiteFacade] Initialized');
    }

    // =========================================================================
    // MAIN GENERATION METHODS
    // =========================================================================

    /**
     * Generate a response using intelligent routing
     *
     * Automatically classifies the task, selects optimal strategy and model,
     * and executes the request.
     *
     * @param prompt - The user prompt
     * @param options - Generation options
     * @returns Generated response with metadata
     */
    async generate(
        prompt: string,
        options: {
            taskContext?: string;
            forceStrategy?: ExecutionStrategy;
            forceModel?: string;
            forceComplexity?: Complexity;
            systemPrompt?: string;
            maxTokens?: number;
            temperature?: number;
        } & RequestContext
    ): Promise<KTNResult> {
        const startTime = Date.now();

        // Build context from options
        const context: BuildContext = {
            projectId: options.projectId,
            userId: options.userId,
            sessionId: options.sessionId,
            framework: options.framework,
            language: options.language,
            fileCount: options.fileCount,
            activeFile: options.activeFile,
            conversationHistory: options.conversationHistory,
            currentErrors: options.currentErrors,
        };

        // Modify prompt with task context if provided
        const fullPrompt = options.taskContext
            ? `[Context: ${options.taskContext}]\n\n${prompt}`
            : prompt;

        // Create generation request
        const request: GenerationRequest = {
            prompt: fullPrompt,
            systemPrompt: options.systemPrompt,
            context,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            forceModel: options.forceModel,
            forceComplexity: options.forceComplexity,
        };

        // Generate response
        const response = await this.service.generateSync(request);

        return {
            id: response.id,
            content: response.content,
            model: response.model,
            strategy: response.strategy,
            usage: response.usage,
            analysis: response.taskAnalysis,
            routing: response.routingDecision,
            latencyMs: Date.now() - startTime,
            ttftMs: response.ttftMs,
            wasEnhanced: response.wasEnhanced,
        };
    }

    /**
     * Generate a streaming response
     *
     * @param prompt - The user prompt
     * @param options - Generation options
     * @returns Async generator of execution chunks
     */
    async *generateStream(
        prompt: string,
        options: {
            taskContext?: string;
            forceStrategy?: ExecutionStrategy;
            forceModel?: string;
            systemPrompt?: string;
            maxTokens?: number;
            temperature?: number;
        } & RequestContext
    ): AsyncGenerator<ExecutionChunk> {
        // Build context from options
        const context: BuildContext = {
            projectId: options.projectId,
            userId: options.userId,
            sessionId: options.sessionId,
            framework: options.framework,
            language: options.language,
            fileCount: options.fileCount,
            activeFile: options.activeFile,
            conversationHistory: options.conversationHistory,
            currentErrors: options.currentErrors,
        };

        // Modify prompt with task context if provided
        const fullPrompt = options.taskContext
            ? `[Context: ${options.taskContext}]\n\n${prompt}`
            : prompt;

        // Create generation request
        const request: GenerationRequest = {
            prompt: fullPrompt,
            systemPrompt: options.systemPrompt,
            context,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            forceModel: options.forceModel,
            stream: true,
        };

        // Stream response
        for await (const chunk of this.service.generate(request)) {
            yield chunk;
        }
    }

    // =========================================================================
    // CONVENIENCE METHODS FOR SPECIFIC USE CASES
    // =========================================================================

    /**
     * Generate for Intent Lock phase
     *
     * Uses ENSEMBLE strategy for critical decision-making.
     * Multiple models vote on the result for maximum accuracy.
     *
     * @param prompt - The intent description
     * @param context - Request context
     * @returns Generated intent contract
     */
    async intentLock(prompt: string, context: RequestContext): Promise<KTNResult> {
        return this.generate(prompt, {
            ...context,
            forceStrategy: 'ensemble',
            taskContext: 'CRITICAL: Creating immutable intent contract. Must be accurate and comprehensive.',
            maxTokens: 8000,
            temperature: 0.1, // Low temperature for deterministic output
        });
    }

    /**
     * Generate for Feature Building
     *
     * Uses SPECULATIVE strategy for speed + verification.
     * Fast model streams first, smart model validates.
     *
     * @param prompt - The feature description
     * @param context - Request context
     * @returns Generated feature code
     */
    async buildFeature(prompt: string, context: RequestContext): Promise<KTNResult> {
        return this.generate(prompt, {
            ...context,
            forceStrategy: 'speculative',
            taskContext: 'Building production feature code. Must be complete, no placeholders.',
            maxTokens: 16000,
            temperature: 0.3,
        });
    }

    /**
     * Generate for Quick Verification Checks
     *
     * Uses SINGLE strategy with fast model.
     * Optimized for speed over thoroughness.
     *
     * @param prompt - The verification prompt
     * @param context - Request context
     * @returns Quick check result
     */
    async quickCheck(prompt: string, context: RequestContext): Promise<KTNResult> {
        return this.generate(prompt, {
            ...context,
            forceStrategy: 'single',
            taskContext: 'Quick verification check. Fast response needed.',
            maxTokens: 2000,
            temperature: 0.2,
        });
    }

    /**
     * Generate for Design/Visual Tasks
     *
     * Uses intelligent routing for design-heavy tasks.
     * Selects models good at visual/design reasoning.
     *
     * @param prompt - The design task
     * @param context - Request context
     * @returns Design generation result
     */
    async designReview(prompt: string, context: RequestContext): Promise<KTNResult> {
        return this.generate(prompt, {
            ...context,
            forceStrategy: 'parallel',
            taskContext: 'Design/visual review task. Focus on aesthetics, UX, and visual quality.',
            maxTokens: 8000,
            temperature: 0.4,
        });
    }

    /**
     * Generate for Debugging
     *
     * Uses SPECULATIVE strategy with debugging context.
     *
     * @param prompt - The debug task
     * @param context - Request context
     * @returns Debug analysis result
     */
    async debug(prompt: string, context: RequestContext): Promise<KTNResult> {
        return this.generate(prompt, {
            ...context,
            forceStrategy: 'speculative',
            taskContext: 'Debugging task. Analyze errors, provide fixes.',
            maxTokens: 8000,
            temperature: 0.2,
        });
    }

    /**
     * Generate for Code Review
     *
     * Uses PARALLEL strategy for comprehensive review.
     *
     * @param prompt - The review task
     * @param context - Request context
     * @returns Code review result
     */
    async codeReview(prompt: string, context: RequestContext): Promise<KTNResult> {
        return this.generate(prompt, {
            ...context,
            forceStrategy: 'parallel',
            taskContext: 'Code review task. Check for bugs, performance, security.',
            maxTokens: 8000,
            temperature: 0.3,
        });
    }

    /**
     * Generate for Planning/Architecture
     *
     * Uses ENSEMBLE strategy for critical planning decisions.
     *
     * @param prompt - The planning task
     * @param context - Request context
     * @returns Planning result
     */
    async plan(prompt: string, context: RequestContext): Promise<KTNResult> {
        return this.generate(prompt, {
            ...context,
            forceStrategy: 'ensemble',
            taskContext: 'Architecture/planning task. Critical decision-making required.',
            maxTokens: 12000,
            temperature: 0.2,
        });
    }

    // =========================================================================
    // ANALYSIS & UTILITY METHODS
    // =========================================================================

    /**
     * Analyze a prompt without generating
     *
     * @param prompt - The prompt to analyze
     * @param context - Optional context
     * @returns Analysis and routing decision
     */
    analyzePrompt(prompt: string, context?: Partial<RequestContext>): {
        analysis: TaskAnalysis;
        decision: RoutingDecision;
        estimatedCost: number;
    } {
        const buildContext: BuildContext = {
            projectId: context?.projectId,
            userId: context?.userId,
            framework: context?.framework,
            language: context?.language,
            fileCount: context?.fileCount,
        };

        return this.service.analyzePrompt(prompt, buildContext);
    }

    /**
     * Get service statistics
     */
    getStats() {
        return this.service.getStats();
    }

    /**
     * Get buffered telemetry
     */
    getTelemetry() {
        return this.service.getAndClearTelemetry();
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let facadeInstance: KripToeNiteFacade | null = null;

/**
 * Get the singleton KripToeNite Facade
 */
export function getKripToeNite(): KripToeNiteFacade {
    if (!facadeInstance) {
        facadeInstance = new KripToeNiteFacade();
    }
    return facadeInstance;
}

/**
 * Reset the facade (for testing)
 */
export function resetKripToeNiteFacade(): void {
    facadeInstance = null;
}

// =============================================================================
// AGENT TYPE MAPPING
// =============================================================================

/**
 * Mapping of agent types to KripToeNite methods
 *
 * Use this when integrating with Agents Mode to automatically
 * select the right strategy for each agent type.
 */
export const agentKTNMapping: Record<string, (ktn: KripToeNiteFacade, prompt: string, ctx: RequestContext) => Promise<KTNResult>> = {
    'planning': (ktn, prompt, ctx) => ktn.plan(prompt, ctx),
    'coding': (ktn, prompt, ctx) => ktn.buildFeature(prompt, ctx),
    'testing': (ktn, prompt, ctx) => ktn.quickCheck(prompt, ctx),
    'review': (ktn, prompt, ctx) => ktn.codeReview(prompt, ctx),
    'debug': (ktn, prompt, ctx) => ktn.debug(prompt, ctx),
    'design': (ktn, prompt, ctx) => ktn.designReview(prompt, ctx),
    'deployment': (ktn, prompt, ctx) => ktn.generate(prompt, { ...ctx, forceStrategy: 'single' }),
    'research': (ktn, prompt, ctx) => ktn.generate(prompt, { ...ctx, forceStrategy: 'parallel' }),
    'integration': (ktn, prompt, ctx) => ktn.buildFeature(prompt, ctx),
};

/**
 * Execute a prompt using the appropriate KTN method for an agent type
 */
export async function executeForAgent(
    agentType: string,
    prompt: string,
    context: RequestContext
): Promise<KTNResult> {
    const ktn = getKripToeNite();
    const handler = agentKTNMapping[agentType] || ((k, p, c) => k.generate(p, c));
    return handler(ktn, prompt, context);
}

export default KripToeNiteFacade;

