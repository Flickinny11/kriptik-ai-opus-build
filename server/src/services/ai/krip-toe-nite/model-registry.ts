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
// MODEL DEFINITIONS - DECEMBER 2025 (LATEST VERSIONS)
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

    'gemini-3-flash': {
        id: 'gemini-3-flash',
        openRouterId: 'google/gemini-3-flash',
        name: 'Gemini 3 Flash',
        tier: 'speed',
        avgTtftMs: 120,
        avgTpsMs: 5,
        costPer1MInput: 0.10,
        costPer1MOutput: 0.40,
        maxContext: 2000000,
        maxOutput: 16384,
        strengths: ['speed', 'general', 'multimodal', 'huge-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-5.1-mini': {
        id: 'gpt-5.1-mini',
        openRouterId: 'openai/gpt-5.1-mini',
        name: 'GPT-5.1 Mini',
        tier: 'speed',
        avgTtftMs: 180,
        avgTpsMs: 6,
        costPer1MInput: 0.20,
        costPer1MOutput: 0.80,
        maxContext: 200000,
        maxOutput: 32768,
        strengths: ['speed', 'general', 'openai-ecosystem', 'fast'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'deepseek-v3.2': {
        id: 'deepseek-v3.2',
        openRouterId: 'deepseek/deepseek-v3.2',
        name: 'DeepSeek V3.2',
        tier: 'speed',
        avgTtftMs: 250,
        avgTpsMs: 7,
        costPer1MInput: 0.07,
        costPer1MOutput: 0.14,
        maxContext: 128000,
        maxOutput: 8192,
        strengths: ['speed', 'code', 'reasoning', 'value'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'llama-4-scout': {
        id: 'llama-4-scout',
        openRouterId: 'meta-llama/llama-4-scout-17b',
        name: 'Llama 4 Scout 17B',
        tier: 'speed',
        avgTtftMs: 300,
        avgTpsMs: 8,
        costPer1MInput: 0.25,
        costPer1MOutput: 0.50,
        maxContext: 256000,
        maxOutput: 16384,
        strengths: ['speed', 'code', 'reasoning', 'open-source'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'claude-haiku-4': {
        id: 'claude-haiku-4',
        openRouterId: 'anthropic/claude-haiku-4',
        name: 'Claude Haiku 4',
        tier: 'speed',
        avgTtftMs: 350,
        avgTpsMs: 10,
        costPer1MInput: 1.00,
        costPer1MOutput: 5.00,
        maxContext: 200000,
        maxOutput: 8192,
        strengths: ['speed', 'general', 'code', 'instruction-following'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // INTELLIGENCE TIER - Best quality for complex tasks
    // Latest December 2025 flagship models
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

    'gemini-3-pro': {
        id: 'gemini-3-pro',
        openRouterId: 'google/gemini-3-pro',
        name: 'Gemini 3 Pro',
        tier: 'intelligence',
        avgTtftMs: 600,
        avgTpsMs: 12,
        costPer1MInput: 1.50,
        costPer1MOutput: 6.00,
        maxContext: 2000000,
        maxOutput: 32768,
        strengths: ['multimodal', 'visual', 'reasoning', 'huge-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'grok-5': {
        id: 'grok-5',
        openRouterId: 'x-ai/grok-5',
        name: 'Grok 5',
        tier: 'intelligence',
        avgTtftMs: 600,
        avgTpsMs: 14,
        costPer1MInput: 4.00,
        costPer1MOutput: 12.00,
        maxContext: 4000000,
        maxOutput: 65536,
        strengths: ['real-time-info', 'huge-context', 'reasoning', 'code'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'llama-4-maverick': {
        id: 'llama-4-maverick',
        openRouterId: 'meta-llama/llama-4-maverick-400b',
        name: 'Llama 4 Maverick 400B',
        tier: 'intelligence',
        avgTtftMs: 900,
        avgTpsMs: 8,
        costPer1MInput: 2.00,
        costPer1MOutput: 8.00,
        maxContext: 512000,
        maxOutput: 32768,
        strengths: ['reasoning', 'code', 'math', 'open-source'],
        supportsVision: false,
        supportsStreaming: true,
    },

    // =========================================================================
    // SPECIALIST TIER - Code-focused models
    // Best for specific coding and reasoning tasks
    // =========================================================================

    'gpt-5.1-codex': {
        id: 'gpt-5.1-codex',
        openRouterId: 'openai/gpt-5.1-codex',
        name: 'GPT-5.1 Codex',
        tier: 'specialist',
        avgTtftMs: 400,
        avgTpsMs: 10,
        costPer1MInput: 1.25,
        costPer1MOutput: 10.00,
        maxContext: 400000,
        maxOutput: 32768,
        strengths: ['code-generation', 'software-engineering', 'agentic-coding'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'qwen-3-coder': {
        id: 'qwen-3-coder',
        openRouterId: 'qwen/qwen-3-coder-32b',
        name: 'Qwen 3 Coder 32B',
        tier: 'specialist',
        avgTtftMs: 350,
        avgTpsMs: 8,
        costPer1MInput: 0.25,
        costPer1MOutput: 0.60,
        maxContext: 256000,
        maxOutput: 16384,
        strengths: ['code-generation', 'multi-language', 'reasoning'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'codestral-25.12': {
        id: 'codestral-25.12',
        openRouterId: 'mistralai/codestral-25.12',
        name: 'Codestral 25.12',
        tier: 'specialist',
        avgTtftMs: 280,
        avgTpsMs: 7,
        costPer1MInput: 0.30,
        costPer1MOutput: 0.90,
        maxContext: 512000,
        maxOutput: 16384,
        strengths: ['code-generation', 'fill-in-middle', 'fast'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'deepseek-r1-turbo': {
        id: 'deepseek-r1-turbo',
        openRouterId: 'deepseek/deepseek-r1-turbo',
        name: 'DeepSeek R1 Turbo',
        tier: 'specialist',
        avgTtftMs: 400,
        avgTpsMs: 6,
        costPer1MInput: 0.40,
        costPer1MOutput: 1.60,
        maxContext: 164000,
        maxOutput: 16384,
        strengths: ['reasoning', 'math', 'code', 'chain-of-thought'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'mistral-large-25.12': {
        id: 'mistral-large-25.12',
        openRouterId: 'mistralai/mistral-large-25.12',
        name: 'Mistral Large 25.12',
        tier: 'specialist',
        avgTtftMs: 400,
        avgTpsMs: 9,
        costPer1MInput: 1.50,
        costPer1MOutput: 4.50,
        maxContext: 256000,
        maxOutput: 16384,
        strengths: ['code', 'reasoning', 'multilingual'],
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
        'gemini-3-flash',     // Fastest TTFT ~120ms
        'gpt-5.1-mini',       // ~180ms, OpenAI ecosystem
        'deepseek-v3.2',      // ~250ms, excellent value
        'llama-4-scout',      // ~300ms, open-source
        'claude-haiku-4',     // ~350ms, Anthropic quality
    ],
    intelligence: [
        'claude-sonnet-4.5',  // Best coding model
        'gpt-5.1',            // OpenAI flagship
        'gemini-3-pro',       // Google flagship
        'grok-5',             // xAI flagship
        'llama-4-maverick',   // Open-source flagship
        'claude-opus-4.5',    // Maximum quality (slower)
    ],
    specialist: [
        'gpt-5.1-codex',      // OpenAI code specialist
        'qwen-3-coder',       // Excellent code quality
        'codestral-25.12',    // Fast code generation
        'deepseek-r1-turbo',  // Reasoning specialist
        'mistral-large-25.12',// Good general coding
    ],
};

/**
 * Strategy-specific model selection
 * Maps complexity levels to optimal model configurations
 */
export const STRATEGY_MODELS = {
    // Trivial: Single fastest model
    trivial: {
        primary: 'gemini-3-flash',
        fallback: 'gpt-5.1-mini',
    },

    // Simple: Fast model, code specialist preferred
    simple: {
        primary: 'deepseek-v3.2',
        fallback: 'codestral-25.12',
    },

    // Medium: Speculative execution - fast + smart
    medium: {
        fast: 'deepseek-v3.2',
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

    return candidates[0] || KTN_MODELS['gemini-3-flash'];
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
            description: 'OpenAI flagship with 400K context',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'standard',
        },
        {
            id: 'gemini-3-pro',
            name: 'Gemini 3 Pro',
            tier: 'intelligence',
            description: 'Google flagship with 2M context',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'standard',
        },
        {
            id: 'grok-5',
            name: 'Grok 5',
            tier: 'intelligence',
            description: 'xAI with 4M context + real-time info',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'premium',
        },
        // Speed Tier
        {
            id: 'gemini-3-flash',
            name: 'Gemini 3 Flash',
            tier: 'speed',
            description: 'Ultra-fast with 2M context',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        {
            id: 'deepseek-v3.2',
            name: 'DeepSeek V3.2',
            tier: 'speed',
            description: 'Excellent value for code tasks',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        {
            id: 'claude-haiku-4',
            name: 'Claude Haiku 4',
            tier: 'speed',
            description: 'Fast Anthropic model',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
        },
        // Specialist Tier
        {
            id: 'gpt-5.1-codex',
            name: 'GPT-5.1 Codex',
            tier: 'specialist',
            description: 'OpenAI code specialist',
            speed: 'fast',
            quality: 'excellent',
            costTier: 'standard',
        },
        {
            id: 'qwen-3-coder',
            name: 'Qwen 3 Coder 32B',
            tier: 'specialist',
            description: 'Excellent code quality',
            speed: 'fast',
            quality: 'excellent',
            costTier: 'economy',
        },
        {
            id: 'deepseek-r1-turbo',
            name: 'DeepSeek R1 Turbo',
            tier: 'specialist',
            description: 'Reasoning with chain-of-thought',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'economy',
        },
    ];
}

export default KTN_MODELS;
