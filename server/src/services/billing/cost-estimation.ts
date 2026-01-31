/**
 * Cost Estimation Service
 *
 * Phase 6: Real-time cost estimation with accurate model pricing
 *
 * Pricing last updated: January 2026
 * Sources:
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - OpenRouter: https://openrouter.ai/models
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ModelPricing {
    id: string;
    name: string;
    provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'meta' | 'xai' | 'mistral';
    inputPer1M: number;      // USD per 1M input tokens
    outputPer1M: number;     // USD per 1M output tokens
    contextWindow: number;
    maxOutput: number;
    tier: 'premium' | 'thinking' | 'critical' | 'standard' | 'simple';
    supportsVision: boolean;
    batchDiscount?: number;  // Percentage discount for batch API
    cacheDiscount?: number;  // Percentage discount for cached prompts
}

export interface CostEstimate {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    model: ModelPricing;
    inputTokens: number;
    outputTokens: number;
    withBatch?: number;      // Cost with batch discount
    withCache?: number;      // Cost with cache discount
}

export interface TaskCostEstimate {
    lowEstimate: CostEstimate;   // Using cheapest suitable model
    mediumEstimate: CostEstimate; // Using balanced model
    highEstimate: CostEstimate;   // Using premium model
    recommended: CostEstimate;
    taskComplexity: 'simple' | 'standard' | 'complex' | 'critical';
}

// =============================================================================
// MODEL PRICING DATABASE (January 2026)
// =============================================================================

export const MODEL_PRICING: Record<string, ModelPricing> = {
    // =========================================================================
    // ANTHROPIC CLAUDE (January 2026 pricing)
    // =========================================================================
    'claude-opus-4.5': {
        id: 'claude-opus-4.5',
        name: 'Claude 4.5 Opus',
        provider: 'anthropic',
        inputPer1M: 5.00,      // 67% price reduction from 4.1
        outputPer1M: 25.00,
        contextWindow: 200000,
        maxOutput: 64000,
        tier: 'premium',
        supportsVision: true,
        batchDiscount: 50,     // 50% off for batch API
        cacheDiscount: 90,     // 90% off for cached prompts
    },
    'claude-opus-4.1': {
        id: 'claude-opus-4.1',
        name: 'Claude 4.1 Opus (Legacy)',
        provider: 'anthropic',
        inputPer1M: 15.00,
        outputPer1M: 75.00,
        contextWindow: 200000,
        maxOutput: 64000,
        tier: 'premium',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 90,
    },
    'claude-sonnet-4.5': {
        id: 'claude-sonnet-4.5',
        name: 'Claude 4.5 Sonnet',
        provider: 'anthropic',
        inputPer1M: 3.00,
        outputPer1M: 15.00,
        contextWindow: 200000,
        maxOutput: 64000,
        tier: 'critical',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 90,
    },
    'claude-sonnet-4.5-long': {
        id: 'claude-sonnet-4.5-long',
        name: 'Claude 4.5 Sonnet (Long Context)',
        provider: 'anthropic',
        inputPer1M: 6.00,      // 2x for >200K input
        outputPer1M: 22.50,    // 1.5x for >200K input
        contextWindow: 1000000,
        maxOutput: 64000,
        tier: 'critical',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 90,
    },
    'claude-haiku-4.5': {
        id: 'claude-haiku-4.5',
        name: 'Claude 4.5 Haiku',
        provider: 'anthropic',
        inputPer1M: 1.00,
        outputPer1M: 5.00,
        contextWindow: 200000,
        maxOutput: 8192,
        tier: 'standard',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 90,
    },
    'claude-haiku-3.5': {
        id: 'claude-haiku-3.5',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        inputPer1M: 0.80,
        outputPer1M: 4.00,
        contextWindow: 200000,
        maxOutput: 8192,
        tier: 'standard',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 90,
    },
    'claude-haiku-3': {
        id: 'claude-haiku-3',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        inputPer1M: 0.25,
        outputPer1M: 1.25,
        contextWindow: 200000,
        maxOutput: 4096,
        tier: 'simple',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 90,
    },

    // =========================================================================
    // OPENAI (January 2026 pricing)
    // =========================================================================
    'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        inputPer1M: 2.50,
        outputPer1M: 10.00,
        contextWindow: 128000,
        maxOutput: 16384,
        tier: 'critical',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 50,
    },
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        inputPer1M: 0.15,
        outputPer1M: 0.60,
        contextWindow: 128000,
        maxOutput: 16384,
        tier: 'standard',
        supportsVision: true,
        batchDiscount: 50,
        cacheDiscount: 50,
    },
    'o1': {
        id: 'o1',
        name: 'O1 (Reasoning)',
        provider: 'openai',
        inputPer1M: 15.00,
        outputPer1M: 60.00,    // Includes reasoning tokens
        contextWindow: 128000,
        maxOutput: 32768,
        tier: 'thinking',
        supportsVision: false,
        batchDiscount: 50,
        cacheDiscount: 50,
    },
    'o1-mini': {
        id: 'o1-mini',
        name: 'O1 Mini (Reasoning)',
        provider: 'openai',
        inputPer1M: 3.00,
        outputPer1M: 12.00,
        contextWindow: 128000,
        maxOutput: 65536,
        tier: 'thinking',
        supportsVision: false,
        batchDiscount: 50,
        cacheDiscount: 50,
    },

    // =========================================================================
    // GOOGLE GEMINI (January 2026 pricing)
    // =========================================================================
    'gemini-2.0-pro': {
        id: 'gemini-2.0-pro',
        name: 'Gemini 2.0 Pro',
        provider: 'google',
        inputPer1M: 1.25,
        outputPer1M: 5.00,
        contextWindow: 2000000,  // 2M context!
        maxOutput: 8192,
        tier: 'critical',
        supportsVision: true,
    },
    'gemini-2.0-flash': {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        inputPer1M: 0.075,
        outputPer1M: 0.30,
        contextWindow: 1000000,
        maxOutput: 8192,
        tier: 'simple',
        supportsVision: true,
    },

    // =========================================================================
    // DEEPSEEK (January 2026 pricing)
    // =========================================================================
    'deepseek-v3': {
        id: 'deepseek-v3',
        name: 'DeepSeek V3',
        provider: 'deepseek',
        inputPer1M: 0.14,
        outputPer1M: 0.28,
        contextWindow: 128000,
        maxOutput: 8192,
        tier: 'simple',
        supportsVision: false,
    },
    'deepseek-r1': {
        id: 'deepseek-r1',
        name: 'DeepSeek R1 (Reasoning)',
        provider: 'deepseek',
        inputPer1M: 0.55,
        outputPer1M: 2.19,
        contextWindow: 128000,
        maxOutput: 8192,
        tier: 'thinking',
        supportsVision: false,
    },

    // =========================================================================
    // META LLAMA (January 2026 pricing via OpenRouter)
    // =========================================================================
    'llama-3.3-70b': {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        provider: 'meta',
        inputPer1M: 0.40,
        outputPer1M: 0.40,
        contextWindow: 128000,
        maxOutput: 8192,
        tier: 'simple',
        supportsVision: false,
    },
};

// =============================================================================
// COST ESTIMATION FUNCTIONS
// =============================================================================

/**
 * Calculate cost for a specific model
 */
export function calculateCost(
    model: ModelPricing,
    inputTokens: number,
    outputTokens: number,
    options?: {
        useBatch?: boolean;
        useCache?: boolean;
    }
): CostEstimate {
    const inputCost = (inputTokens / 1_000_000) * model.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * model.outputPer1M;
    let totalCost = inputCost + outputCost;

    let withBatch: number | undefined;
    let withCache: number | undefined;

    if (model.batchDiscount) {
        withBatch = totalCost * (1 - model.batchDiscount / 100);
    }

    if (model.cacheDiscount) {
        // Cache only applies to input tokens
        const cachedInputCost = inputCost * (1 - model.cacheDiscount / 100);
        withCache = cachedInputCost + outputCost;
    }

    if (options?.useBatch && withBatch !== undefined) {
        totalCost = withBatch;
    }

    if (options?.useCache && withCache !== undefined) {
        // Cache is applied after batch
        totalCost = options.useBatch && withBatch !== undefined
            ? withBatch * (1 - model.cacheDiscount! / 100)
            : withCache;
    }

    return {
        inputCost,
        outputCost,
        totalCost,
        model,
        inputTokens,
        outputTokens,
        withBatch,
        withCache,
    };
}

/**
 * Estimate tokens from text
 */
export function estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
}

/**
 * Get best model for a tier
 */
export function getBestModelForTier(tier: ModelPricing['tier']): ModelPricing {
    const tierPreferences: Record<ModelPricing['tier'], string[]> = {
        premium: ['claude-opus-4.5', 'o1', 'claude-opus-4.1'],
        thinking: ['claude-opus-4.5', 'o1', 'deepseek-r1', 'o1-mini'],
        critical: ['claude-sonnet-4.5', 'gpt-4o', 'gemini-2.0-pro'],
        standard: ['claude-haiku-4.5', 'gpt-4o-mini', 'claude-haiku-3.5'],
        simple: ['deepseek-v3', 'gemini-2.0-flash', 'claude-haiku-3'],
    };

    const preferred = tierPreferences[tier][0];
    return MODEL_PRICING[preferred];
}

/**
 * Estimate task cost with multiple options
 */
export function estimateTaskCost(
    prompt: string,
    taskType: string = 'generation',
    existingCode?: string
): TaskCostEstimate {
    const promptTokens = estimateTokens(prompt);
    const codeTokens = existingCode ? estimateTokens(existingCode) : 0;
    const inputTokens = promptTokens + codeTokens + 500; // Add system prompt overhead

    // Estimate output based on task type
    const outputMultipliers: Record<string, number> = {
        generation: 2.0,
        explanation: 1.5,
        refactoring: 1.8,
        debugging: 1.2,
        architecture: 3.0,
        planning: 2.5,
        formatting: 0.5,
    };

    const multiplier = outputMultipliers[taskType] || 1.5;
    const outputTokens = Math.ceil(inputTokens * multiplier);

    // Determine task complexity
    const complexityPatterns = {
        critical: [/architect/i, /design.*system/i, /payment/i, /auth/i, /security/i],
        complex: [/dashboard/i, /landing/i, /full.*app/i, /database/i, /api.*design/i],
        standard: [/component/i, /feature/i, /page/i, /form/i],
        simple: [/fix/i, /comment/i, /rename/i, /format/i, /typo/i],
    };

    let taskComplexity: TaskCostEstimate['taskComplexity'] = 'standard';

    if (complexityPatterns.critical.some(p => p.test(prompt))) {
        taskComplexity = 'critical';
    } else if (complexityPatterns.complex.some(p => p.test(prompt))) {
        taskComplexity = 'complex';
    } else if (complexityPatterns.simple.some(p => p.test(prompt))) {
        taskComplexity = 'simple';
    }

    // Map complexity to tiers
    const complexityToTier: Record<TaskCostEstimate['taskComplexity'], ModelPricing['tier']> = {
        critical: 'premium',
        complex: 'critical',
        standard: 'standard',
        simple: 'simple',
    };

    const recommendedTier = complexityToTier[taskComplexity];

    // Get estimates for different tiers
    const lowModel = getBestModelForTier('simple');
    const mediumModel = getBestModelForTier('standard');
    const highModel = getBestModelForTier('premium');
    const recommendedModel = getBestModelForTier(recommendedTier);

    return {
        lowEstimate: calculateCost(lowModel, inputTokens, outputTokens),
        mediumEstimate: calculateCost(mediumModel, inputTokens, outputTokens),
        highEstimate: calculateCost(highModel, inputTokens, outputTokens),
        recommended: calculateCost(recommendedModel, inputTokens, outputTokens),
        taskComplexity,
    };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
    if (cost < 0.01) {
        return `$${(cost * 100).toFixed(2)}¢`;
    }
    return `$${cost.toFixed(4)}`;
}

/**
 * Get all available models
 */
export function getAllModels(): ModelPricing[] {
    return Object.values(MODEL_PRICING);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: ModelPricing['provider']): ModelPricing[] {
    return Object.values(MODEL_PRICING).filter(m => m.provider === provider);
}

/**
 * Get models by tier
 */
export function getModelsByTier(tier: ModelPricing['tier']): ModelPricing[] {
    return Object.values(MODEL_PRICING).filter(m => m.tier === tier);
}

// =============================================================================
// EXPORT DEFAULT PRICING TABLE
// =============================================================================

export default MODEL_PRICING;
