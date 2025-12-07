/**
 * Krip-Toe-Nite Model Registry
 *
 * Defines all available models via OpenRouter with performance characteristics.
 * All models are accessed through OpenRouter's unified API.
 *
 * VERIFIED: December 7, 2025 - Actual models from OpenRouter
 * - Speed Tier: Sub-500ms TTFT models for trivial/simple tasks
 * - Intelligence Tier: Best-in-class models for complex tasks
 * - Specialist Tier: Code-focused models for development tasks
 */

import type { KTNModelConfig, ModelTier } from './types.js';

// =============================================================================
// MODEL DEFINITIONS - VERIFIED DECEMBER 7, 2025
// =============================================================================

/**
 * Complete model registry for Krip-Toe-Nite
 * All models verified on OpenRouter as of December 7, 2025
 */
export const KTN_MODELS: Record<string, KTNModelConfig> = {
    // =========================================================================
    // SPEED TIER - Ultra-fast responses for trivial/simple tasks
    // Target: <500ms TTFT
    // =========================================================================

    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        openRouterId: 'google/gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        tier: 'speed',
        avgTtftMs: 150,
        avgTpsMs: 5,
        costPer1MInput: 0.30,
        costPer1MOutput: 2.50,
        maxContext: 1050000,
        maxOutput: 8192,
        strengths: ['speed', 'reasoning', 'coding', 'math', 'science'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        openRouterId: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        tier: 'speed',
        avgTtftMs: 200,
        avgTpsMs: 6,
        costPer1MInput: 0.15,
        costPer1MOutput: 0.60,
        maxContext: 128000,
        maxOutput: 16384,
        strengths: ['speed', 'general', 'vision', 'fast'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'deepseek-v3': {
        id: 'deepseek-v3',
        openRouterId: 'deepseek/deepseek-chat-v3-0324',
        name: 'DeepSeek V3',
        tier: 'speed',
        avgTtftMs: 250,
        avgTpsMs: 7,
        costPer1MInput: 0.15,
        costPer1MOutput: 0.70,
        maxContext: 128000,
        maxOutput: 8192,
        strengths: ['speed', 'code', 'reasoning', 'value'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'grok-4-fast': {
        id: 'grok-4-fast',
        openRouterId: 'x-ai/grok-4-fast',
        name: 'Grok 4 Fast',
        tier: 'speed',
        avgTtftMs: 280,
        avgTpsMs: 8,
        costPer1MInput: 0.20,
        costPer1MOutput: 0.50,
        maxContext: 2000000,
        maxOutput: 32768,
        strengths: ['speed', 'multimodal', 'huge-context', 'cost-efficient'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'nova-2-lite': {
        id: 'nova-2-lite',
        openRouterId: 'amazon/nova-2-lite',
        name: 'Amazon Nova 2 Lite',
        tier: 'speed',
        avgTtftMs: 300,
        avgTpsMs: 6,
        costPer1MInput: 0.00,
        costPer1MOutput: 0.00,
        maxContext: 1000000,
        maxOutput: 8192,
        strengths: ['speed', 'free', 'reasoning', 'multimodal'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // INTELLIGENCE TIER - Best quality for complex tasks
    // Verified December 7, 2025
    // =========================================================================

    'claude-opus-4.5': {
        id: 'claude-opus-4.5',
        openRouterId: 'anthropic/claude-opus-4.5',
        name: 'Claude Opus 4.5',
        tier: 'intelligence',
        avgTtftMs: 1200,
        avgTpsMs: 15,
        costPer1MInput: 5.00,
        costPer1MOutput: 25.00,
        maxContext: 200000,
        maxOutput: 64000,
        strengths: ['best-coding', 'complex-reasoning', 'agentic', 'architecture'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'claude-sonnet-4.5': {
        id: 'claude-sonnet-4.5',
        openRouterId: 'anthropic/claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        tier: 'intelligence',
        avgTtftMs: 800,
        avgTpsMs: 12,
        costPer1MInput: 3.00,
        costPer1MOutput: 15.00,
        maxContext: 1000000,
        maxOutput: 64000,
        strengths: ['coding', 'real-world-agents', 'state-of-the-art', 'balanced'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gemini-3-pro': {
        id: 'gemini-3-pro',
        openRouterId: 'google/gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        tier: 'intelligence',
        avgTtftMs: 600,
        avgTpsMs: 10,
        costPer1MInput: 2.00,
        costPer1MOutput: 12.00,
        maxContext: 1050000,
        maxOutput: 16384,
        strengths: ['multimodal', 'precision', 'reasoning', 'huge-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-5.1-codex-max': {
        id: 'gpt-5.1-codex-max',
        openRouterId: 'openai/gpt-5.1-codex-max',
        name: 'GPT-5.1 Codex Max',
        tier: 'intelligence',
        avgTtftMs: 700,
        avgTpsMs: 10,
        costPer1MInput: 1.25,
        costPer1MOutput: 10.00,
        maxContext: 400000,
        maxOutput: 32768,
        strengths: ['agentic-coding', 'long-running', 'high-context', 'software-dev'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'mistral-large-3': {
        id: 'mistral-large-3',
        openRouterId: 'mistralai/mistral-large-3-2512',
        name: 'Mistral Large 3',
        tier: 'intelligence',
        avgTtftMs: 600,
        avgTpsMs: 10,
        costPer1MInput: 2.00,
        costPer1MOutput: 6.00,
        maxContext: 256000,
        maxOutput: 16384,
        strengths: ['reasoning', 'multilingual', 'code', 'open-source'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // SPECIALIST TIER - Code-focused models
    // Best for specific coding and reasoning tasks
    // =========================================================================

    'qwen3-coder': {
        id: 'qwen3-coder',
        openRouterId: 'qwen/qwen3-coder-480b-a35b',
        name: 'Qwen3 Coder 480B',
        tier: 'specialist',
        avgTtftMs: 350,
        avgTpsMs: 8,
        costPer1MInput: 0.22,
        costPer1MOutput: 0.95,
        maxContext: 262000,
        maxOutput: 16384,
        strengths: ['code-generation', 'agentic-coding', 'MoE', 'multi-language'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'codestral-2508': {
        id: 'codestral-2508',
        openRouterId: 'mistralai/codestral-2508',
        name: 'Codestral 2508',
        tier: 'specialist',
        avgTtftMs: 280,
        avgTpsMs: 7,
        costPer1MInput: 0.30,
        costPer1MOutput: 0.90,
        maxContext: 256000,
        maxOutput: 16384,
        strengths: ['code-generation', 'fill-in-middle', 'low-latency', 'fast'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'grok-code-fast': {
        id: 'grok-code-fast',
        openRouterId: 'x-ai/grok-code-fast-1',
        name: 'Grok Code Fast 1',
        tier: 'specialist',
        avgTtftMs: 300,
        avgTpsMs: 7,
        costPer1MInput: 0.20,
        costPer1MOutput: 1.50,
        maxContext: 256000,
        maxOutput: 16384,
        strengths: ['agentic-coding', 'reasoning-traces', 'economical', 'fast'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'deepseek-r1': {
        id: 'deepseek-r1',
        openRouterId: 'deepseek/deepseek-r1t2-chimera',
        name: 'DeepSeek R1 Chimera',
        tier: 'specialist',
        avgTtftMs: 400,
        avgTpsMs: 6,
        costPer1MInput: 0.00,
        costPer1MOutput: 0.00,
        maxContext: 164000,
        maxOutput: 16384,
        strengths: ['reasoning', 'math', 'code', 'chain-of-thought', 'free'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'ministral-3': {
        id: 'ministral-3',
        openRouterId: 'mistralai/ministral-3-14b-2512',
        name: 'Ministral 3 14B',
        tier: 'specialist',
        avgTtftMs: 250,
        avgTpsMs: 9,
        costPer1MInput: 0.10,
        costPer1MOutput: 0.30,
        maxContext: 262000,
        maxOutput: 8192,
        strengths: ['efficient', 'vision', 'frontier-performance', 'fast'],
        supportsVision: true,
        supportsStreaming: true,
    },
};

// =============================================================================
// TIER PREFERENCES
// =============================================================================

/**
 * Model preferences by tier (ordered by preference)
 * First model is tried first, fallback to next if unavailable
 */
export const TIER_PREFERENCES: Record<ModelTier, string[]> = {
    speed: [
        'gemini-2.5-flash',   // Fastest, great quality
        'gpt-4o-mini',        // OpenAI fast option
        'deepseek-v3',        // Excellent value
        'grok-4-fast',        // 2M context, multimodal
        'nova-2-lite',        // Free option
    ],
    intelligence: [
        'claude-sonnet-4.5',  // Best coding, 1M context
        'gpt-5.1-codex-max',  // Agentic coding specialist
        'gemini-3-pro',       // Google flagship
        'mistral-large-3',    // Open-source flagship
        'claude-opus-4.5',    // Maximum quality
    ],
    specialist: [
        'qwen3-coder',        // MoE code specialist
        'codestral-2508',     // Fast code generation
        'grok-code-fast',     // Agentic coding
        'deepseek-r1',        // Reasoning specialist (free!)
        'ministral-3',        // Efficient with vision
    ],
};

/**
 * Strategy-specific model selection
 * Maps complexity levels to optimal model configurations
 */
export const STRATEGY_MODELS = {
    // Trivial: Single fastest model
    trivial: {
        primary: 'gemini-2.5-flash',
        fallback: 'gpt-4o-mini',
    },

    // Simple: Fast model, code specialist preferred
    simple: {
        primary: 'deepseek-v3',
        fallback: 'codestral-2508',
    },

    // Medium: Speculative execution - fast + smart
    medium: {
        fast: 'deepseek-v3',
        smart: 'claude-sonnet-4.5',
        fallback: 'gpt-5.1-codex-max',
    },

    // Complex: Intelligence tier primary
    complex: {
        primary: 'claude-sonnet-4.5',
        fallback: 'gpt-5.1-codex-max',
    },

    // Expert: Best available
    expert: {
        primary: 'claude-opus-4.5',
        fallback: 'claude-sonnet-4.5',
    },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get model by ID
 */
export function getModel(id: string): KTNModelConfig | undefined {
    return KTN_MODELS[id];
}

/**
 * Get models by tier
 */
export function getModelsByTier(tier: ModelTier): KTNModelConfig[] {
    return TIER_PREFERENCES[tier].map(id => KTN_MODELS[id]).filter(Boolean);
}

/**
 * Get fastest model that meets requirements
 */
export function getFastestModel(
    options?: {
        requireVision?: boolean;
        maxCostPer1MOutput?: number;
        minContext?: number;
    }
): KTNModelConfig {
    const candidates = Object.values(KTN_MODELS)
        .filter(m => {
            if (options?.requireVision && !m.supportsVision) return false;
            if (options?.maxCostPer1MOutput && m.costPer1MOutput > options.maxCostPer1MOutput) return false;
            if (options?.minContext && m.maxContext < options.minContext) return false;
            return true;
        })
        .sort((a, b) => a.avgTtftMs - b.avgTtftMs);

    return candidates[0] || KTN_MODELS['gemini-2.5-flash'];
}

/**
 * Get best model for code tasks
 */
export function getBestCodeModel(): KTNModelConfig {
    return KTN_MODELS['claude-sonnet-4.5'];
}

/**
 * Get model fallback chain
 */
export function getFallbackChain(modelId: string): KTNModelConfig[] {
    const model = KTN_MODELS[modelId];
    if (!model) return [];

    const tierModels = TIER_PREFERENCES[model.tier];
    const currentIndex = tierModels.indexOf(modelId);

    if (currentIndex === -1) return [];

    return tierModels
        .slice(currentIndex + 1)
        .map(id => KTN_MODELS[id])
        .filter(Boolean);
}

/**
 * Estimate cost for a request
 */
export function estimateCost(
    model: KTNModelConfig,
    inputTokens: number,
    outputTokens: number
): number {
    const inputCost = (inputTokens / 1_000_000) * model.costPer1MInput;
    const outputCost = (outputTokens / 1_000_000) * model.costPer1MOutput;
    return inputCost + outputCost;
}

/**
 * Get all available models for UI display
 */
export function getAllModelsForDisplay(): Array<{
    id: string;
    name: string;
    tier: ModelTier;
    description: string;
    speed: 'fast' | 'medium' | 'slow';
    quality: 'good' | 'excellent' | 'best';
    costTier: 'economy' | 'standard' | 'premium';
    isRecommended?: boolean;
}> {
    return [
        // Krip-Toe-Nite is THE recommended option
        {
            id: 'krip-toe-nite',
            name: 'Krip-Toe-Nite ✨',
            tier: 'intelligence' as ModelTier,
            description: 'Intelligent orchestration - fastest + best quality',
            speed: 'fast',
            quality: 'best',
            costTier: 'standard',
            isRecommended: true,
        },
        // Intelligence Tier
        {
            id: 'claude-opus-4.5',
            name: 'Claude Opus 4.5',
            tier: 'intelligence',
            description: 'Maximum quality for complex reasoning',
            speed: 'slow',
            quality: 'best',
            costTier: 'premium',
        },
        {
            id: 'claude-sonnet-4.5',
            name: 'Claude Sonnet 4.5',
            tier: 'intelligence',
            description: 'Best coding model with 1M context',
            speed: 'medium',
            quality: 'best',
            costTier: 'standard',
        },
        {
            id: 'gpt-5.1-codex-max',
            name: 'GPT-5.1 Codex Max',
            tier: 'intelligence',
            description: 'OpenAI agentic coding with 400K context',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'standard',
        },
        {
            id: 'gemini-3-pro',
            name: 'Gemini 3 Pro',
            tier: 'intelligence',
            description: 'Google flagship with 1M context',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'standard',
        },
        // Speed Tier
        {
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            tier: 'speed',
            description: 'Ultra-fast with 1M context',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        {
            id: 'grok-4-fast',
            name: 'Grok 4 Fast',
            tier: 'speed',
            description: '2M context with multimodal',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        {
            id: 'deepseek-v3',
            name: 'DeepSeek V3',
            tier: 'speed',
            description: 'Excellent value for code tasks',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        // Specialist Tier
        {
            id: 'qwen3-coder',
            name: 'Qwen3 Coder 480B',
            tier: 'specialist',
            description: 'MoE code specialist',
            speed: 'fast',
            quality: 'excellent',
            costTier: 'economy',
        },
        {
            id: 'codestral-2508',
            name: 'Codestral 2508',
            tier: 'specialist',
            description: 'Fast code with fill-in-middle',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        {
            id: 'deepseek-r1',
            name: 'DeepSeek R1 Chimera',
            tier: 'specialist',
            description: 'Reasoning specialist (FREE)',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'economy',
        },
    ];
}

export default KTN_MODELS;
