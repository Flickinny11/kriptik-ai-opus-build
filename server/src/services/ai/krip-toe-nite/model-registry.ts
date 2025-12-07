/**
 * Krip-Toe-Nite Model Registry
 *
 * Defines all available models via OpenRouter with performance characteristics.
 * All models are accessed through OpenRouter's unified API.
 *
 * Updated: December 7, 2025
 * - Speed Tier: Sub-500ms TTFT models for trivial/simple tasks
 * - Intelligence Tier: Best-in-class models for complex tasks
 * - Specialist Tier: Code-focused models for development tasks
 */

import type { KTNModelConfig, ModelTier } from './types.js';

// =============================================================================
// MODEL DEFINITIONS - DECEMBER 2025
// =============================================================================

/**
 * Complete model registry for Krip-Toe-Nite
 * All models accessible via OpenRouter
 */
export const KTN_MODELS: Record<string, KTNModelConfig> = {
    // =========================================================================
    // SPEED TIER - Ultra-fast responses for trivial/simple tasks
    // Target: <500ms TTFT
    // =========================================================================

    'gemini-flash': {
        id: 'gemini-flash',
        openRouterId: 'google/gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        tier: 'speed',
        avgTtftMs: 150,
        avgTpsMs: 4,
        costPer1MInput: 0.075,
        costPer1MOutput: 0.30,
        maxContext: 1000000,
        maxOutput: 8192,
        strengths: ['speed', 'general', 'multimodal', 'huge-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        openRouterId: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        tier: 'speed',
        avgTtftMs: 200,
        avgTpsMs: 5,
        costPer1MInput: 0.15,
        costPer1MOutput: 0.60,
        maxContext: 128000,
        maxOutput: 16384,
        strengths: ['speed', 'general', 'openai-ecosystem', 'fast'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'deepseek-v3': {
        id: 'deepseek-v3',
        openRouterId: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3',
        tier: 'speed',
        avgTtftMs: 300,
        avgTpsMs: 6,
        costPer1MInput: 0.14,
        costPer1MOutput: 0.28,
        maxContext: 128000,
        maxOutput: 8192,
        strengths: ['speed', 'code', 'reasoning', 'value'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'deepseek-coder': {
        id: 'deepseek-coder',
        openRouterId: 'deepseek/deepseek-coder',
        name: 'DeepSeek Coder',
        tier: 'speed',
        avgTtftMs: 350,
        avgTpsMs: 5,
        costPer1MInput: 0.14,
        costPer1MOutput: 0.28,
        maxContext: 128000,
        maxOutput: 8192,
        strengths: ['code-generation', 'code-completion', 'debugging', 'speed'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'llama-3.3-70b': {
        id: 'llama-3.3-70b',
        openRouterId: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B',
        tier: 'speed',
        avgTtftMs: 350,
        avgTpsMs: 6,
        costPer1MInput: 0.40,
        costPer1MOutput: 0.40,
        maxContext: 128000,
        maxOutput: 8192,
        strengths: ['speed', 'code', 'reasoning', 'open-source'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'haiku-3.5': {
        id: 'haiku-3.5',
        openRouterId: 'anthropic/claude-3.5-haiku',
        name: 'Claude 3.5 Haiku',
        tier: 'speed',
        avgTtftMs: 400,
        avgTpsMs: 8,
        costPer1MInput: 0.80,
        costPer1MOutput: 4.00,
        maxContext: 200000,
        maxOutput: 8192,
        strengths: ['speed', 'general', 'code', 'instruction-following'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // INTELLIGENCE TIER - Best quality for complex tasks
    // Latest December 2025 models
    // =========================================================================

    'claude-opus-4.5': {
        id: 'claude-opus-4.5',
        openRouterId: 'anthropic/claude-opus-4.5',
        name: 'Claude Opus 4.5',
        tier: 'intelligence',
        avgTtftMs: 1200,
        avgTpsMs: 15,
        costPer1MInput: 5.00,  // Updated pricing
        costPer1MOutput: 25.00,
        maxContext: 200000,
        maxOutput: 64000,
        strengths: ['best-coding', 'long-context', 'agentic', 'reasoning', 'architecture'],
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
        maxContext: 200000,
        maxOutput: 64000,
        strengths: ['coding', 'real-world-bugs', 'instruction-following', 'balanced'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'claude-sonnet-4': {
        id: 'claude-sonnet-4',
        openRouterId: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4',
        tier: 'intelligence',
        avgTtftMs: 800,
        avgTpsMs: 12,
        costPer1MInput: 3.00,
        costPer1MOutput: 15.00,
        maxContext: 200000,
        maxOutput: 64000,
        strengths: ['coding', 'instruction-following', 'reliable'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-5.1': {
        id: 'gpt-5.1',
        openRouterId: 'openai/gpt-5.1',
        name: 'GPT-5.1',
        tier: 'intelligence',
        avgTtftMs: 500,
        avgTpsMs: 10,
        costPer1MInput: 1.25,
        costPer1MOutput: 10.00,
        maxContext: 400000,
        maxOutput: 32768,
        strengths: ['conversation', 'general', 'huge-context', 'tools'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-4o': {
        id: 'gpt-4o',
        openRouterId: 'openai/gpt-4o',
        name: 'GPT-4o',
        tier: 'intelligence',
        avgTtftMs: 600,
        avgTpsMs: 10,
        costPer1MInput: 2.50,
        costPer1MOutput: 10.00,
        maxContext: 128000,
        maxOutput: 16384,
        strengths: ['all-rounder', 'writing', 'tools', 'vision'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gemini-3-pro': {
        id: 'gemini-3-pro',
        openRouterId: 'google/gemini-3-pro',
        name: 'Gemini 3 Pro',
        tier: 'intelligence',
        avgTtftMs: 600,
        avgTpsMs: 12,
        costPer1MInput: 1.50,
        costPer1MOutput: 6.00,
        maxContext: 1000000,
        maxOutput: 16384,
        strengths: ['multimodal', 'visual', 'reasoning', 'huge-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gemini-2-pro': {
        id: 'gemini-2-pro',
        openRouterId: 'google/gemini-2.0-flash-thinking-exp',
        name: 'Gemini 2.0 Pro Thinking',
        tier: 'intelligence',
        avgTtftMs: 700,
        avgTpsMs: 10,
        costPer1MInput: 1.25,
        costPer1MOutput: 5.00,
        maxContext: 1000000,
        maxOutput: 8192,
        strengths: ['reasoning', 'math', 'multimodal', 'huge-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'grok-4': {
        id: 'grok-4',
        openRouterId: 'x-ai/grok-4',
        name: 'Grok 4',
        tier: 'intelligence',
        avgTtftMs: 700,
        avgTpsMs: 12,
        costPer1MInput: 5.00,
        costPer1MOutput: 15.00,
        maxContext: 2000000,
        maxOutput: 32768,
        strengths: ['real-time-info', 'huge-context', 'reasoning', 'code'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // SPECIALIST TIER - Code-focused models
    // Best for specific coding tasks
    // =========================================================================

    'qwen-coder-32b': {
        id: 'qwen-coder-32b',
        openRouterId: 'qwen/qwen-2.5-coder-32b-instruct',
        name: 'Qwen 2.5 Coder 32B',
        tier: 'specialist',
        avgTtftMs: 400,
        avgTpsMs: 7,
        costPer1MInput: 0.30,
        costPer1MOutput: 0.80,
        maxContext: 131072,
        maxOutput: 8192,
        strengths: ['code-generation', 'multi-language', 'reasoning'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'codestral': {
        id: 'codestral',
        openRouterId: 'mistralai/codestral-latest',
        name: 'Codestral',
        tier: 'specialist',
        avgTtftMs: 300,
        avgTpsMs: 6,
        costPer1MInput: 0.20,
        costPer1MOutput: 0.60,
        maxContext: 256000,
        maxOutput: 8192,
        strengths: ['code-generation', 'fill-in-middle', 'fast'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'mistral-large': {
        id: 'mistral-large',
        openRouterId: 'mistralai/mistral-large-2411',
        name: 'Mistral Large',
        tier: 'specialist',
        avgTtftMs: 400,
        avgTpsMs: 8,
        costPer1MInput: 2.00,
        costPer1MOutput: 6.00,
        maxContext: 128000,
        maxOutput: 8192,
        strengths: ['code', 'reasoning', 'multilingual'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'deepseek-r1': {
        id: 'deepseek-r1',
        openRouterId: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        tier: 'specialist',
        avgTtftMs: 500,
        avgTpsMs: 5,
        costPer1MInput: 0.55,
        costPer1MOutput: 2.19,
        maxContext: 64000,
        maxOutput: 8192,
        strengths: ['reasoning', 'math', 'code', 'chain-of-thought'],
        supportsVision: false,
        supportsStreaming: true,
    },
};

// =============================================================================
// TIER PREFERENCES
// =============================================================================

/**
 * Model preferences by tier (ordered by preference)
 * First model is tried first, fallback to next if unavailable
 * Updated: December 7, 2025
 */
export const TIER_PREFERENCES: Record<ModelTier, string[]> = {
    speed: [
        'gemini-flash',      // Fastest TTFT ~150ms
        'gpt-4o-mini',       // ~200ms, good quality
        'deepseek-v3',       // ~300ms, excellent value
        'codestral',         // ~300ms, fast code generation
        'deepseek-coder',    // ~350ms, code specialist
        'llama-3.3-70b',     // ~350ms, open-source
        'haiku-3.5',         // ~400ms, Anthropic quality
    ],
    intelligence: [
        'claude-sonnet-4.5', // Best coding model
        'gpt-5.1',           // Latest OpenAI flagship
        'claude-sonnet-4',   // Reliable fallback
        'gemini-3-pro',      // Google latest flagship
        'gpt-4o',            // OpenAI proven flagship
        'gemini-2-pro',      // Google reasoning model
        'grok-4',            // xAI huge context
        'claude-opus-4.5',   // Maximum quality (slower)
    ],
    specialist: [
        'qwen-coder-32b',    // Excellent code quality
        'codestral',         // Fast code generation
        'deepseek-coder',    // Value code model
        'deepseek-r1',       // Reasoning specialist
        'mistral-large',     // Good general coding
    ],
};

/**
 * Strategy-specific model selection
 * Maps complexity levels to optimal model configurations
 * Updated: December 7, 2025
 */
export const STRATEGY_MODELS = {
    // Trivial: Single fastest model
    trivial: {
        primary: 'gemini-flash',
        fallback: 'gpt-4o-mini',
    },

    // Simple: Fast model, code specialist preferred
    simple: {
        primary: 'deepseek-coder',
        fallback: 'codestral',
    },

    // Medium: Speculative execution - fast + smart
    medium: {
        fast: 'deepseek-v3',
        smart: 'claude-sonnet-4.5',
        fallback: 'gpt-5.1',
    },

    // Complex: Intelligence tier primary
    complex: {
        primary: 'claude-sonnet-4.5',
        fallback: 'gpt-5.1',
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

    return candidates[0] || KTN_MODELS['gemini-flash'];
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
 * Updated: December 7, 2025
 */
export function getAllModelsForDisplay(): Array<{
    id: string;
    name: string;
    tier: ModelTier;
    description: string;
    speed: 'fast' | 'medium' | 'slow';
    quality: 'good' | 'excellent' | 'best';
    costTier: 'economy' | 'standard' | 'premium';
    isNew?: boolean;
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
        // Latest December 2025 models
        {
            id: 'claude-opus-4.5',
            name: 'Claude Opus 4.5',
            tier: 'intelligence',
            description: 'Maximum quality for complex tasks',
            speed: 'slow',
            quality: 'best',
            costTier: 'premium',
        },
        {
            id: 'claude-sonnet-4.5',
            name: 'Claude Sonnet 4.5',
            tier: 'intelligence',
            description: 'Best balance of speed and quality',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'standard',
        },
        {
            id: 'gpt-5.1',
            name: 'GPT-5.1',
            tier: 'intelligence',
            description: 'Latest OpenAI with 400K context',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'standard',
            isNew: true,
        },
        {
            id: 'gemini-3-pro',
            name: 'Gemini 3 Pro',
            tier: 'intelligence',
            description: 'Google latest with visual understanding',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'standard',
            isNew: true,
        },
        {
            id: 'grok-4',
            name: 'Grok 4',
            tier: 'intelligence',
            description: 'xAI with 2M context + real-time info',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'premium',
            isNew: true,
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
        {
            id: 'deepseek-r1',
            name: 'DeepSeek R1',
            tier: 'specialist',
            description: 'Reasoning specialist with chain-of-thought',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'economy',
            isNew: true,
        },
        {
            id: 'gemini-flash',
            name: 'Gemini 2.0 Flash',
            tier: 'speed',
            description: 'Ultra-fast with 1M context',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        {
            id: 'haiku-3.5',
            name: 'Claude Haiku 3.5',
            tier: 'speed',
            description: 'Fastest Anthropic model',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        {
            id: 'qwen-coder-32b',
            name: 'Qwen Coder 32B',
            tier: 'specialist',
            description: 'Excellent code quality',
            speed: 'fast',
            quality: 'excellent',
            costTier: 'economy',
        },
        {
            id: 'codestral',
            name: 'Codestral',
            tier: 'specialist',
            description: 'Fast code with fill-in-middle',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
    ];
}

export default KTN_MODELS;

