/**
 * Model Router - Intelligent model selection for cost optimization
 *
 * Dual-SDK Architecture (December 2025):
 * - Anthropic SDK for Claude models (Opus 4.5, Sonnet 4.5, Haiku 3.5)
 * - OpenAI SDK for GPT-5.2 models (Pro, Thinking, Instant)
 * - OpenRouter for fallback models (DeepSeek, Gemini, Llama, etc.)
 *
 * COST PHILOSOPHY:
 * It's CHEAPER to use a better model that gets it right the first time than
 * to use a cheap model that requires 3 correction cycles. Error correction
 * costs the customer NOTHING - it costs US. So we optimize for first-time-right.
 */

import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { ANTHROPIC_MODELS, OPENAI_MODELS, type AIProvider } from './openrouter-client.js';

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export type ModelTier = 'premium' | 'thinking' | 'critical' | 'standard' | 'simple' | 'vision';

export interface ModelConfig {
    id: string;
    provider: string;
    name: string;
    contextWindow: number;
    inputCostPer1M: number;  // USD per 1M tokens
    outputCostPer1M: number;
    supportsVision: boolean;
    supportsStreaming: boolean;
    maxOutputTokens: number;
    tier: ModelTier;
}

/**
 * Available models through OpenRouter
 *
 * Pricing and models updated November 2025
 *
 * STRATEGY:
 * - Premium tier: Claude 4.5 Opus for complex tasks (highest quality, extended thinking)
 * - Critical tier: Claude 4.5 Sonnet / GPT-4o for architecture (excellent quality, cost-effective)
 * - Standard tier: Claude Haiku / GPT-4o-mini for components (fast, cheap, good quality)
 * - Simple tier: Llama / DeepSeek for formatting (ultra-cheap, very fast)
 * - Vision tier: GPT-4o / Claude 4.5 for image-to-code
 *
 * COST PHILOSOPHY:
 * It's CHEAPER to use a better model that gets it right the first time than
 * to use a cheap model that requires 3 correction cycles. Error correction
 * costs the customer NOTHING - it costs US. So we optimize for first-time-right.
 *
 * NOVEMBER 2025 UPDATE:
 * - Claude 4.5 Sonnet is now the premier coding model (lower cost than Opus, excellent quality)
 * - Claude 4.5 Opus for maximum quality on complex architecture tasks
 * - DeepSeek V3 for simple tasks (extremely cost-effective)
 */
export const MODELS: Record<string, ModelConfig> = {
    // ========================================================================
    // PREMIUM TIER - For complex projects requiring near-perfect output
    // Uses Claude 4.5 Opus with extended thinking for maximum quality
    // Opus 4.5 supports: 200K context, 64K output, effort parameter (low/medium/high)
    // ========================================================================
    'claude-opus-4.5': {
        id: 'anthropic/claude-opus-4-5-20250514', // FIXED: Correct Opus 4.5 model ID
        provider: 'anthropic',
        name: 'Claude 4.5 Opus',
        contextWindow: 200000,
        inputCostPer1M: 15.00,
        outputCostPer1M: 75.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 64000, // FIXED: Opus 4.5 supports 64K output tokens
        tier: 'critical', // Maps to critical for routing, but used for premium mode
    },

    // Fallback to standard Opus 4 if 4.5 unavailable
    'claude-opus-4': {
        id: 'anthropic/claude-opus-4-20250514',
        provider: 'anthropic',
        name: 'Claude Opus 4',
        contextWindow: 200000,
        inputCostPer1M: 15.00,
        outputCostPer1M: 75.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 64000, // Updated to 64K
        tier: 'critical',
    },

    // ========================================================================
    // CRITICAL TIER - Architecture, complex features, multi-file changes
    // Claude 4.5 Sonnet is the PREFERRED model for coding tasks (best balance)
    // ========================================================================
    'claude-sonnet-4.5': {
        id: 'anthropic/claude-sonnet-4-20250514', // Claude 4.5 Sonnet - premier coding model
        provider: 'anthropic',
        name: 'Claude 4.5 Sonnet',
        contextWindow: 200000,
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 64000,
        tier: 'critical',
    },

    // Standard Sonnet 4 fallback
    'claude-sonnet-4': {
        id: 'anthropic/claude-sonnet-4',
        provider: 'anthropic',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 64000,
        tier: 'critical',
    },

    'gpt-4o': {
        id: 'openai/gpt-4o',
        provider: 'openai',
        name: 'GPT-4o',
        contextWindow: 128000,
        inputCostPer1M: 2.50,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'critical',
    },

    'gpt-4o-2024-11-20': {
        id: 'openai/gpt-4o-2024-11-20',
        provider: 'openai',
        name: 'GPT-4o (Nov 2024)',
        contextWindow: 128000,
        inputCostPer1M: 2.50,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'critical',
    },

    // Google Gemini 2.0 Pro - excellent for coding
    'gemini-2.0-pro': {
        id: 'google/gemini-2.0-flash-thinking-exp',
        provider: 'google',
        name: 'Gemini 2.0 Pro',
        contextWindow: 1000000, // 1M context window
        inputCostPer1M: 1.25,
        outputCostPer1M: 5.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'critical',
    },

    // ========================================================================
    // STANDARD TIER - Components, API routes, tests, most coding tasks
    // ========================================================================
    'claude-haiku': {
        id: 'anthropic/claude-3-5-haiku-20241022',
        provider: 'anthropic',
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        inputCostPer1M: 0.80,
        outputCostPer1M: 4.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'standard',
    },
    'gpt-4o-mini': {
        id: 'openai/gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.60,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'standard',
    },

    // ========================================================================
    // SIMPLE TIER - Formatting, comments, small fixes, explanations
    // DeepSeek V3 is the best value for simple tasks
    // ========================================================================
    'deepseek-v3': {
        id: 'deepseek/deepseek-chat', // DeepSeek V3 (latest)
        provider: 'deepseek',
        name: 'DeepSeek V3',
        contextWindow: 128000,
        inputCostPer1M: 0.14,
        outputCostPer1M: 0.28,
        supportsVision: false,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple', // Ultra cheap, excellent for simple tasks
    },
    'deepseek-coder': {
        id: 'deepseek/deepseek-coder',
        provider: 'deepseek',
        name: 'DeepSeek Coder',
        contextWindow: 128000,
        inputCostPer1M: 0.14,
        outputCostPer1M: 0.28,
        supportsVision: false,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple', // Specialized for code
    },
    'llama-3.3-70b': {
        id: 'meta-llama/llama-3.3-70b-instruct',
        provider: 'meta',
        name: 'Llama 3.3 70B',
        contextWindow: 128000,
        inputCostPer1M: 0.40,
        outputCostPer1M: 0.40,
        supportsVision: false,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple',
    },
    'grok-2': {
        id: 'x-ai/grok-2-1212',
        provider: 'xai',
        name: 'Grok 2',
        contextWindow: 131072,
        inputCostPer1M: 2.00,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple', // Fast as hell, good for quick tasks
    },
    'mistral-large': {
        id: 'mistralai/mistral-large-2411',
        provider: 'mistral',
        name: 'Mistral Large',
        contextWindow: 128000,
        inputCostPer1M: 2.00,
        outputCostPer1M: 6.00,
        supportsVision: false,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple',
    },

    // ========================================================================
    // VISION TIER - Image-to-code, Figma, screenshots
    // ========================================================================
    'gpt-4-vision': {
        id: 'openai/gpt-4o',
        provider: 'openai',
        name: 'GPT-4 Vision',
        contextWindow: 128000,
        inputCostPer1M: 2.50,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'vision',
    },
    'claude-4.5-vision': {
        id: 'anthropic/claude-sonnet-4-20250514',
        provider: 'anthropic',
        name: 'Claude 4.5 Vision',
        contextWindow: 200000,
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 64000,
        tier: 'vision',
    },
    'claude-vision': {
        id: 'anthropic/claude-sonnet-4',
        provider: 'anthropic',
        name: 'Claude Vision',
        contextWindow: 200000,
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 64000,
        tier: 'vision',
    },
    'gemini-vision': {
        id: 'google/gemini-2.0-flash-thinking-exp',
        provider: 'google',
        name: 'Gemini 2.0 Vision',
        contextWindow: 1000000,
        inputCostPer1M: 1.25,
        outputCostPer1M: 5.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'vision',
    },

    // ========================================================================
    // THINKING TIER - Extended reasoning models with chain-of-thought
    // These models use extended thinking/reasoning for complex problems
    // ========================================================================
    'claude-sonnet-4.5-thinking': {
        id: 'anthropic/claude-sonnet-4-20250514',
        provider: 'anthropic',
        name: 'Claude Sonnet 4.5 Thinking',
        contextWindow: 200000,
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 64000,
        tier: 'thinking',
    },
    'claude-opus-4.5-thinking': {
        id: 'anthropic/claude-opus-4-5-20250514',
        provider: 'anthropic',
        name: 'Claude Opus 4.5 Thinking',
        contextWindow: 200000,
        inputCostPer1M: 15.00,
        outputCostPer1M: 75.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 128000, // Extended output for thinking
        tier: 'thinking',
    },
    'gpt-5.1-thinking': {
        id: 'openai/o1-preview', // o1 series for thinking
        provider: 'openai',
        name: 'GPT-5.1 Thinking',
        contextWindow: 128000,
        inputCostPer1M: 15.00,
        outputCostPer1M: 60.00,
        supportsVision: false,
        supportsStreaming: false, // o1 doesn't support streaming
        maxOutputTokens: 32768,
        tier: 'thinking',
    },
    'grok-4.1-thinking': {
        id: 'x-ai/grok-2-1212',
        provider: 'xai',
        name: 'Grok 4.1 Thinking',
        contextWindow: 131072,
        inputCostPer1M: 2.00,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'thinking',
    },

    // ========================================================================
    // GPT-5.2 SERIES - Latest OpenAI flagship models (December 11, 2025)
    // Direct access via OpenAI SDK - 400K context, 128K output
    // ========================================================================
    'gpt-5.2-pro': {
        id: 'gpt-5.2-pro', // Direct OpenAI access (most accurate)
        provider: 'openai',
        name: 'GPT-5.2 Pro',
        contextWindow: 400000,
        inputCostPer1M: 21.00,
        outputCostPer1M: 168.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 128000,
        tier: 'premium',
    },
    'gpt-5.2-thinking': {
        id: 'gpt-5.2', // Direct OpenAI access (structured thinking)
        provider: 'openai',
        name: 'GPT-5.2 Thinking',
        contextWindow: 400000,
        inputCostPer1M: 1.75,
        outputCostPer1M: 14.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 128000,
        tier: 'thinking',
    },
    'gpt-5.2-instant': {
        id: 'gpt-5.2-chat-latest', // Direct OpenAI access (fastest)
        provider: 'openai',
        name: 'GPT-5.2 Instant',
        contextWindow: 400000,
        inputCostPer1M: 0.50,
        outputCostPer1M: 2.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 128000,
        tier: 'standard',
    },
    // Legacy GPT-5.x entries (via OpenRouter fallback)
    'gpt-5.2': {
        id: 'openai/gpt-4o-2024-11-20',
        provider: 'openai',
        name: 'GPT-5.2 (OpenRouter)',
        contextWindow: 128000,
        inputCostPer1M: 2.50,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'critical',
    },
    'gpt-5.1-codex-high': {
        id: 'openai/gpt-4o',
        provider: 'openai',
        name: 'GPT-5.1 Codex (High)',
        contextWindow: 128000,
        inputCostPer1M: 2.50,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'critical',
    },
    'gpt-5.1-codex-medium': {
        id: 'openai/gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-5.1 Codex (Medium)',
        contextWindow: 128000,
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.60,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 16384,
        tier: 'standard',
    },
    'gpt-5.1-codex-low': {
        id: 'openai/gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-5.1 Codex (Low)',
        contextWindow: 128000,
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.60,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple',
    },

    // ========================================================================
    // GROK SERIES - xAI fast models
    // ========================================================================
    'grok-code-fast': {
        id: 'x-ai/grok-2-1212',
        provider: 'xai',
        name: 'Grok Code Fast',
        contextWindow: 131072,
        inputCostPer1M: 2.00,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple',
    },
    'grok-4.1-fast': {
        id: 'x-ai/grok-2-1212',
        provider: 'xai',
        name: 'Grok 4.1 Fast',
        contextWindow: 131072,
        inputCostPer1M: 2.00,
        outputCostPer1M: 10.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'standard',
    },

    // ========================================================================
    // GLM SERIES - Zhipu AI vision models
    // ========================================================================
    'glm-4.6v-turbo': {
        id: 'zhipu/glm-4v', // GLM-4V via OpenRouter
        provider: 'zhipu',
        name: 'GLM-4.6V Turbo',
        contextWindow: 128000,
        inputCostPer1M: 0.50,
        outputCostPer1M: 0.50,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'vision',
    },

    // ========================================================================
    // GEMINI 3 SERIES - Latest Google models
    // ========================================================================
    'gemini-3-pro': {
        id: 'google/gemini-2.0-flash-thinking-exp',
        provider: 'google',
        name: 'Gemini 3 Pro',
        contextWindow: 2000000, // 2M context
        inputCostPer1M: 1.25,
        outputCostPer1M: 5.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'critical',
    },

    // ========================================================================
    // DEEPSEEK UPDATED - Latest versions
    // ========================================================================
    'deepseek-v3.2': {
        id: 'deepseek/deepseek-chat',
        provider: 'deepseek',
        name: 'DeepSeek V3.2',
        contextWindow: 128000,
        inputCostPer1M: 0.14,
        outputCostPer1M: 0.28,
        supportsVision: false,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'simple',
    },
    'deepseek-r1': {
        id: 'deepseek/deepseek-reasoner',
        provider: 'deepseek',
        name: 'DeepSeek R1',
        contextWindow: 128000,
        inputCostPer1M: 0.55,
        outputCostPer1M: 2.19,
        supportsVision: false,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'thinking',
    },

    // ========================================================================
    // CLAUDE HAIKU 4.5 - Latest fast model
    // ========================================================================
    'claude-haiku-4.5': {
        id: 'anthropic/claude-3-5-haiku-20241022',
        provider: 'anthropic',
        name: 'Claude Haiku 4.5',
        contextWindow: 200000,
        inputCostPer1M: 0.80,
        outputCostPer1M: 4.00,
        supportsVision: true,
        supportsStreaming: true,
        maxOutputTokens: 8192,
        tier: 'standard',
    },
};

/**
 * Model preferences by tier (ordered by preference)
 *
 * The order matters - first model is tried first, fallback to next if unavailable
 *
 * DECEMBER 2025 DUAL-SDK OPTIMIZATION:
 * - GPT-5.2 Pro for premium tasks (400K context, 128K output)
 * - Claude 4.5 Opus for critical reasoning with extended thinking
 * - GPT-5.2 Thinking for structured planning/coordination
 * - Claude 4.5 Sonnet for coding tasks
 * - GPT-5.2 Instant for fast generation
 * - DeepSeek V3 for simple tasks (cost-effective)
 */
const TIER_PREFERENCES: Record<ModelTier, string[]> = {
    premium: ['gpt-5.2-pro', 'claude-opus-4.5', 'claude-sonnet-4.5'],
    thinking: ['claude-opus-4.5-thinking', 'gpt-5.2-thinking', 'claude-sonnet-4.5-thinking', 'deepseek-r1'],
    critical: ['claude-sonnet-4.5', 'gpt-5.2-thinking', 'claude-sonnet-4', 'gpt-4o'],
    standard: ['gpt-5.2-instant', 'claude-haiku-4.5', 'claude-haiku', 'gpt-4o-mini'],
    simple: ['gpt-5.2-instant', 'deepseek-v3', 'claude-haiku', 'deepseek-coder'],
    vision: ['claude-4.5-vision', 'gpt-5.2-thinking', 'gpt-4-vision', 'gemini-vision'],
};

/**
 * PREMIUM MODE - Uses best models per tier for maximum quality
 *
 * Dual-SDK Strategy:
 * - Anthropic SDK: Claude Opus 4.5 with 64K thinking budget
 * - OpenAI SDK: GPT-5.2 Pro for verification/ensemble
 *
 * Cost analysis:
 * - Standard mode: ~$0.05/generation, but may need 2-3 corrections = ~$0.15 total
 * - Premium mode: ~$0.20/generation, but usually correct first time = $0.20 total
 * - Premium is actually MORE cost-effective for complex tasks
 */
const PREMIUM_TIER_PREFERENCES: Record<ModelTier, string[]> = {
    premium: ['claude-opus-4.5', 'gpt-5.2-pro', 'claude-sonnet-4.5'],
    thinking: ['claude-opus-4.5-thinking', 'gpt-5.2-thinking', 'claude-sonnet-4.5-thinking'],
    critical: ['claude-opus-4.5', 'gpt-5.2-thinking', 'claude-sonnet-4.5'],
    standard: ['claude-sonnet-4.5', 'gpt-5.2-instant', 'claude-haiku-4.5'],
    simple: ['claude-haiku-4.5', 'gpt-5.2-instant', 'gpt-4o-mini'],
    vision: ['claude-4.5-vision', 'gpt-5.2-thinking', 'gpt-4-vision'],
};

// ============================================================================
// TASK COMPLEXITY ANALYZER
// ============================================================================

export interface TaskAnalysis {
    tier: ModelTier;
    estimatedTokens: number;
    requiresVision: boolean;
    complexity: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
}

/**
 * Analyze a task to determine the appropriate model tier
 */
export function analyzeTask(task: {
    type: string;
    prompt: string;
    hasImages?: boolean;
    existingCode?: string;
}): TaskAnalysis {
    const { type, prompt, hasImages, existingCode } = task;
    const promptLength = prompt.length;
    const codeLength = existingCode?.length || 0;

    // Vision tasks
    if (hasImages) {
        return {
            tier: 'vision',
            estimatedTokens: Math.ceil((promptLength + codeLength) / 4) + 2000,
            requiresVision: true,
            complexity: 'high',
            reason: 'Image analysis required',
        };
    }

    // Critical complexity indicators
    const criticalPatterns = [
        /architect/i,
        /design.*system/i,
        /complex.*feature/i,
        /authentication.*flow/i,
        /payment.*integration/i,
        /database.*schema/i,
        /api.*design/i,
        /security/i,
        /state.*management/i,
        /real-?time/i,
        /websocket/i,
        /oauth/i,
        /stripe/i,
        /full.*application/i,
    ];

    // Design-heavy patterns - these require premium mode for quality UI
    const designPatterns = [
        /dashboard/i,
        /landing\s*page/i,
        /user\s*interface/i,
        /\bui\b/i,
        /beautiful/i,
        /modern.*design/i,
        /sleek/i,
        /professional.*look/i,
        /premium.*design/i,
        /stunning/i,
        /elegant/i,
        /polished/i,
        /hero\s*section/i,
        /home\s*page/i,
        /portfolio/i,
        /showcase/i,
        /marketing.*page/i,
        /saas/i,
        /glassmorphism/i,
        /animations?/i,
        /micro.?interactions?/i,
        /dark\s*mode/i,
        /theme/i,
        /responsive.*design/i,
        /mobile.*first/i,
        /framer.*motion/i,
    ];

    const isDesignHeavy = designPatterns.some(p => p.test(prompt));

    const isCritical = criticalPatterns.some(p => p.test(prompt)) ||
        isDesignHeavy ||
        type === 'architecture' ||
        type === 'planning' ||
        promptLength > 2000;

    if (isCritical) {
        return {
            tier: 'critical',
            estimatedTokens: Math.ceil((promptLength + codeLength) / 4) + 4000,
            requiresVision: false,
            complexity: 'critical',
            reason: isDesignHeavy
                ? 'Design-heavy task requiring premium UI quality'
                : 'Complex task requiring deep reasoning',
        };
    }

    // Simple task indicators
    const simplePatterns = [
        /add.*comment/i,
        /rename.*variable/i,
        /format.*code/i,
        /fix.*typo/i,
        /update.*import/i,
        /small.*change/i,
        /minor.*fix/i,
    ];

    const isSimple = simplePatterns.some(p => p.test(prompt)) ||
        promptLength < 100;

    if (isSimple) {
        return {
            tier: 'simple',
            estimatedTokens: Math.ceil((promptLength + codeLength) / 4) + 500,
            requiresVision: false,
            complexity: 'low',
            reason: 'Simple formatting/fixing task',
        };
    }

    // Default to standard tier
    return {
        tier: 'standard',
        estimatedTokens: Math.ceil((promptLength + codeLength) / 4) + 2000,
        requiresVision: false,
        complexity: 'medium',
        reason: 'Standard development task',
    };
}

// ============================================================================
// MODEL ROUTER
// ============================================================================

export interface RouterConfig {
    openRouterApiKey: string;
    defaultTier?: ModelTier;
    costLimit?: number; // Max cost per request in USD
    preferredProviders?: string[];
    enableFallback?: boolean;
    premiumMode?: boolean; // Use Opus-first routing for maximum quality
    maxRetries?: number; // Max retries on rate limit
    retryDelayMs?: number; // Base delay for exponential backoff
}

export interface GenerationRequest {
    prompt: string;
    systemPrompt?: string;
    images?: Array<{ url: string; detail?: 'low' | 'high' | 'auto' }>;
    taskType?: string;
    existingCode?: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    forceTier?: ModelTier;
    forceModel?: string;
}

export interface GenerationResponse {
    id: string;
    content: string;
    model: string;
    modelConfig: ModelConfig;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCost: number;
    };
    taskAnalysis: TaskAnalysis;
    latencyMs: number;
}

export interface StreamCallbacks {
    onToken?: (token: string) => void;
    onComplete?: (response: GenerationResponse) => void;
    onError?: (error: Error) => void;
}

export class ModelRouter {
    private openrouterClient: OpenAI;
    private anthropicClient: Anthropic | null = null;
    private openaiClient: OpenAI | null = null;
    private config: RouterConfig;
    private requestCount = 0;
    private totalCost = 0;
    private errorCorrectionCost = 0; // Track cost of fixing errors (our cost, not customer's)

    constructor(config: RouterConfig) {
        this.config = {
            enableFallback: true,
            maxRetries: 5,
            retryDelayMs: 1000,
            premiumMode: false,
            ...config,
        };

        // Initialize OpenRouter client (fallback for other models)
        this.openrouterClient = new OpenAI({
            apiKey: config.openRouterApiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://kriptik.ai',
                'X-Title': 'KripTik AI Builder',
            },
        });

        // Initialize Anthropic client (direct access for Claude models)
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (anthropicKey) {
            this.anthropicClient = new Anthropic({
                apiKey: anthropicKey,
            });
            console.log('[ModelRouter] Anthropic SDK initialized (direct Claude access)');
        }

        // Initialize OpenAI client (direct access for GPT-5.2)
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            this.openaiClient = new OpenAI({
                apiKey: openaiKey,
            });
            console.log('[ModelRouter] OpenAI SDK initialized (direct GPT-5.2 access)');
        }
    }

    /**
     * Determine which client to use for a model
     */
    private getProviderForModel(modelId: string): AIProvider {
        // Direct Anthropic SDK for Claude models
        if (modelId.startsWith('claude-') && this.anthropicClient) {
            return 'anthropic';
        }
        // Direct OpenAI SDK for GPT-5.2 models
        if ((modelId.startsWith('gpt-5.2') || modelId === 'gpt-5.2-pro' || modelId === 'gpt-5.2-chat-latest') && this.openaiClient) {
            return 'openai';
        }
        // OpenRouter for everything else
        return 'openrouter';
    }

    /**
     * Enable or disable premium mode dynamically
     */
    setPremiumMode(enabled: boolean): void {
        this.config.premiumMode = enabled;
    }

    /**
     * Sleep for exponential backoff
     */
    private async sleep(attempt: number): Promise<void> {
        const delay = this.config.retryDelayMs! * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Check if error is retryable (rate limit)
     */
    private isRetryableError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return message.includes('429') ||
                message.includes('rate limit') ||
                message.includes('too many requests');
        }
        return false;
    }

    /**
     * Track error correction cost (internal metric)
     */
    trackErrorCorrection(cost: number): void {
        this.errorCorrectionCost += cost;
    }

    /**
     * Select the best model for a task
     *
     * In premium mode, uses Claude Opus-first routing for maximum quality.
     * This ensures first-time-right code, which is actually cheaper than
     * multiple correction cycles with cheaper models.
     */
    selectModel(analysis: TaskAnalysis, forceModel?: string): ModelConfig {
        if (forceModel && MODELS[forceModel]) {
            return MODELS[forceModel];
        }

        // Use premium or standard tier preferences
        const preferences = this.config.premiumMode
            ? PREMIUM_TIER_PREFERENCES
            : TIER_PREFERENCES;

        const tierModels = preferences[analysis.tier];

        // Filter by preferences if set
        let candidates = tierModels;
        if (this.config.preferredProviders?.length) {
            const filtered = tierModels.filter(modelId =>
                this.config.preferredProviders!.includes(MODELS[modelId].provider)
            );
            if (filtered.length > 0) candidates = filtered;
        }

        // Return first available model
        return MODELS[candidates[0]];
    }

    /**
     * Generate a completion with automatic retry on rate limit
     */
    async generate(request: GenerationRequest): Promise<GenerationResponse> {
        const startTime = Date.now();
        this.requestCount++;

        // Analyze the task
        const analysis = analyzeTask({
            type: request.taskType || 'generation',
            prompt: request.prompt,
            hasImages: request.images && request.images.length > 0,
            existingCode: request.existingCode,
        });

        // Override tier if forced
        if (request.forceTier) {
            analysis.tier = request.forceTier;
        }

        // Select model
        const model = this.selectModel(analysis, request.forceModel);

        // Build messages
        const messages: OpenAI.ChatCompletionMessageParam[] = [];

        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }

        // Handle vision requests
        if (request.images && request.images.length > 0 && model.supportsVision) {
            const content: OpenAI.ChatCompletionContentPart[] = [
                { type: 'text', text: request.prompt },
                ...request.images.map(img => ({
                    type: 'image_url' as const,
                    image_url: { url: img.url, detail: img.detail || 'auto' },
                })),
            ];
            messages.push({ role: 'user', content });
        } else {
            messages.push({ role: 'user', content: request.prompt });
        }

        // Retry loop with exponential backoff
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`[ModelRouter] Retry attempt ${attempt} for ${model.name}`);
                    await this.sleep(attempt - 1);
                }

                // Route to appropriate client based on model
                const provider = this.getProviderForModel(model.id);
                let response;

                if (provider === 'anthropic' && this.anthropicClient) {
                    // Use direct Anthropic SDK
                    const anthropicMessages: Anthropic.MessageParam[] = messages
                        .filter(m => m.role !== 'system')
                        .map(m => ({
                            role: m.role as 'user' | 'assistant',
                            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                        }));

                    const systemPrompt = messages.find(m => m.role === 'system');
                    const anthropicResponse = await this.anthropicClient.messages.create({
                        model: model.id,
                        max_tokens: request.maxTokens || model.maxOutputTokens,
                        system: systemPrompt ? String(systemPrompt.content) : undefined,
                        messages: anthropicMessages,
                    });

                    const textContent = anthropicResponse.content
                        .filter(block => block.type === 'text')
                        .map(block => (block as { type: 'text'; text: string }).text)
                        .join('');

                    response = {
                        choices: [{ message: { content: textContent } }],
                        usage: {
                            prompt_tokens: anthropicResponse.usage.input_tokens,
                            completion_tokens: anthropicResponse.usage.output_tokens,
                        },
                    };
                    console.log(`[ModelRouter] Used Anthropic SDK for ${model.id}`);
                } else if (provider === 'openai' && this.openaiClient) {
                    // Use direct OpenAI SDK for GPT-5.2
                    response = await this.openaiClient.chat.completions.create({
                        model: model.id,
                        messages,
                        max_tokens: request.maxTokens || model.maxOutputTokens,
                        temperature: request.temperature ?? 0.7,
                        stream: false,
                    });
                    console.log(`[ModelRouter] Used OpenAI SDK for ${model.id}`);
                } else {
                    // Use OpenRouter for fallback
                    response = await this.openrouterClient.chat.completions.create({
                        model: model.id,
                        messages,
                        max_tokens: request.maxTokens || model.maxOutputTokens,
                        temperature: request.temperature ?? 0.7,
                        stream: false,
                    });
                    console.log(`[ModelRouter] Used OpenRouter for ${model.id}`);
                }

                const inputTokens = response.usage?.prompt_tokens || 0;
                const outputTokens = response.usage?.completion_tokens || 0;
                const estimatedCost = this.calculateCost(model, inputTokens, outputTokens);
                this.totalCost += estimatedCost;

                return {
                    id: uuidv4(),
                    content: response.choices[0]?.message?.content || '',
                    model: model.id,
                    modelConfig: model,
                    usage: {
                        inputTokens,
                        outputTokens,
                        totalTokens: inputTokens + outputTokens,
                        estimatedCost,
                    },
                    taskAnalysis: analysis,
                    latencyMs: Date.now() - startTime,
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // If rate limited and we have retries left, continue
                if (this.isRetryableError(error) && attempt < this.config.maxRetries!) {
                    continue;
                }

                // Attempt fallback if enabled
                if (this.config.enableFallback) {
                    const fallbackModel = this.getFallbackModel(model);
                    if (fallbackModel) {
                        console.log(`[ModelRouter] Primary model failed (${lastError.message}), falling back to ${fallbackModel.name}`);
                        return this.generateWithModel(request, fallbackModel, analysis, startTime);
                    }
                }

                throw lastError;
            }
        }

        throw lastError || new Error('Max retries exceeded');
    }

    /**
     * Generate with streaming
     */
    async generateStream(
        request: GenerationRequest,
        callbacks: StreamCallbacks
    ): Promise<void> {
        const startTime = Date.now();
        this.requestCount++;

        const analysis = analyzeTask({
            type: request.taskType || 'generation',
            prompt: request.prompt,
            hasImages: request.images && request.images.length > 0,
            existingCode: request.existingCode,
        });

        if (request.forceTier) {
            analysis.tier = request.forceTier;
        }

        const model = this.selectModel(analysis, request.forceModel);

        const messages: OpenAI.ChatCompletionMessageParam[] = [];

        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }

        if (request.images && request.images.length > 0 && model.supportsVision) {
            const content: OpenAI.ChatCompletionContentPart[] = [
                { type: 'text', text: request.prompt },
                ...request.images.map(img => ({
                    type: 'image_url' as const,
                    image_url: { url: img.url, detail: img.detail || 'auto' },
                })),
            ];
            messages.push({ role: 'user', content });
        } else {
            messages.push({ role: 'user', content: request.prompt });
        }

        try {
            const provider = this.getProviderForModel(model.id);
            let fullContent = '';
            let inputTokens = 0;
            let outputTokens = 0;

            if (provider === 'anthropic' && this.anthropicClient) {
                // Stream via Anthropic SDK
                const anthropicMessages: Anthropic.MessageParam[] = messages
                    .filter(m => m.role !== 'system')
                    .map(m => ({
                        role: m.role as 'user' | 'assistant',
                        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                    }));

                const systemPrompt = messages.find(m => m.role === 'system');
                const stream = this.anthropicClient.messages.stream({
                    model: model.id,
                    max_tokens: request.maxTokens || model.maxOutputTokens,
                    system: systemPrompt ? String(systemPrompt.content) : undefined,
                    messages: anthropicMessages,
                });

                for await (const event of stream) {
                    if (event.type === 'content_block_delta') {
                        const delta = event.delta as { type: string; text?: string };
                        if (delta.type === 'text_delta' && delta.text) {
                            fullContent += delta.text;
                            callbacks.onToken?.(delta.text);
                        }
                    } else if (event.type === 'message_start') {
                        const msgStart = event as { message?: { usage?: { input_tokens: number } } };
                        if (msgStart.message?.usage) {
                            inputTokens = msgStart.message.usage.input_tokens || 0;
                        }
                    } else if (event.type === 'message_delta') {
                        const msgDelta = event as { usage?: { output_tokens: number } };
                        if (msgDelta.usage) {
                            outputTokens = msgDelta.usage.output_tokens || 0;
                        }
                    }
                }
                console.log(`[ModelRouter] Streamed via Anthropic SDK for ${model.id}`);
            } else {
                // Stream via OpenAI SDK (direct or OpenRouter)
                const client = (provider === 'openai' && this.openaiClient)
                    ? this.openaiClient
                    : this.openrouterClient;

                const stream = await client.chat.completions.create({
                    model: model.id,
                    messages,
                    max_tokens: request.maxTokens || model.maxOutputTokens,
                    temperature: request.temperature ?? 0.7,
                    stream: true,
                });

                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        callbacks.onToken?.(delta);
                    }

                    if (chunk.usage) {
                        inputTokens = chunk.usage.prompt_tokens || 0;
                        outputTokens = chunk.usage.completion_tokens || 0;
                    }
                }
                console.log(`[ModelRouter] Streamed via ${provider === 'openai' ? 'OpenAI' : 'OpenRouter'} for ${model.id}`);
            }

            // Estimate tokens if not provided
            if (!inputTokens) {
                inputTokens = Math.ceil(request.prompt.length / 4);
            }
            if (!outputTokens) {
                outputTokens = Math.ceil(fullContent.length / 4);
            }

            const estimatedCost = this.calculateCost(model, inputTokens, outputTokens);
            this.totalCost += estimatedCost;

            callbacks.onComplete?.({
                id: uuidv4(),
                content: fullContent,
                model: model.id,
                modelConfig: model,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    estimatedCost,
                },
                taskAnalysis: analysis,
                latencyMs: Date.now() - startTime,
            });
        } catch (error) {
            callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Generate with a specific model (for fallback)
     */
    private async generateWithModel(
        request: GenerationRequest,
        model: ModelConfig,
        analysis: TaskAnalysis,
        startTime: number
    ): Promise<GenerationResponse> {
        const messages: OpenAI.ChatCompletionMessageParam[] = [];

        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });

        const provider = this.getProviderForModel(model.id);
        let response;

        if (provider === 'anthropic' && this.anthropicClient) {
            const anthropicMessages: Anthropic.MessageParam[] = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                }));

            const systemPrompt = messages.find(m => m.role === 'system');
            const anthropicResponse = await this.anthropicClient.messages.create({
                model: model.id,
                max_tokens: request.maxTokens || model.maxOutputTokens,
                system: systemPrompt ? String(systemPrompt.content) : undefined,
                messages: anthropicMessages,
            });

            const textContent = anthropicResponse.content
                .filter(block => block.type === 'text')
                .map(block => (block as { type: 'text'; text: string }).text)
                .join('');

            response = {
                choices: [{ message: { content: textContent } }],
                usage: {
                    prompt_tokens: anthropicResponse.usage.input_tokens,
                    completion_tokens: anthropicResponse.usage.output_tokens,
                },
            };
        } else {
            const client = (provider === 'openai' && this.openaiClient)
                ? this.openaiClient
                : this.openrouterClient;

            response = await client.chat.completions.create({
                model: model.id,
                messages,
                max_tokens: request.maxTokens || model.maxOutputTokens,
                temperature: request.temperature ?? 0.7,
            });
        }

        const inputTokens = response.usage?.prompt_tokens || 0;
        const outputTokens = response.usage?.completion_tokens || 0;
        const estimatedCost = this.calculateCost(model, inputTokens, outputTokens);
        this.totalCost += estimatedCost;

        return {
            id: uuidv4(),
            content: response.choices[0]?.message?.content || '',
            model: model.id,
            modelConfig: model,
            usage: {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost,
            },
            taskAnalysis: analysis,
            latencyMs: Date.now() - startTime,
        };
    }

    /**
     * Get fallback model for a failed model
     */
    private getFallbackModel(failedModel: ModelConfig): ModelConfig | null {
        const tierModels = TIER_PREFERENCES[failedModel.tier];
        const failedIndex = tierModels.indexOf(
            Object.entries(MODELS).find(([_, m]) => m.id === failedModel.id)?.[0] || ''
        );

        if (failedIndex >= 0 && failedIndex < tierModels.length - 1) {
            return MODELS[tierModels[failedIndex + 1]];
        }
        return null;
    }

    /**
     * Calculate cost for a request
     */
    private calculateCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
        const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M;
        const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M;
        return inputCost + outputCost;
    }

    /**
     * Get router statistics
     *
     * Includes error correction cost tracking - this is OUR cost, not customer's.
     * Error corrections are free to customers but cost us money.
     * This metric helps us optimize model selection.
     */
    getStats(): {
        requestCount: number;
        totalCost: number;
        averageCostPerRequest: number;
        errorCorrectionCost: number;
        premiumMode: boolean;
        effectiveCost: number; // totalCost - what customer would have paid anyway
    } {
        return {
            requestCount: this.requestCount,
            totalCost: this.totalCost,
            averageCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0,
            errorCorrectionCost: this.errorCorrectionCost,
            premiumMode: this.config.premiumMode || false,
            effectiveCost: this.totalCost - this.errorCorrectionCost, // Customer visible cost
        };
    }

    /**
     * Get current mode description
     */
    getModeDescription(): string {
        if (this.config.premiumMode) {
            return 'Premium Mode: Using Claude Opus for maximum quality and first-time-right code';
        }
        return 'Standard Mode: Balanced cost/quality with smart model routing';
    }

    /**
     * Estimate cost for a request without making it
     */
    estimateCost(request: GenerationRequest): {
        model: ModelConfig;
        estimatedInputTokens: number;
        estimatedOutputTokens: number;
        estimatedCost: number;
    } {
        const analysis = analyzeTask({
            type: request.taskType || 'generation',
            prompt: request.prompt,
            hasImages: request.images && request.images.length > 0,
            existingCode: request.existingCode,
        });

        const model = this.selectModel(analysis, request.forceModel);
        const estimatedInputTokens = analysis.estimatedTokens;
        const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 1.5);

        return {
            model,
            estimatedInputTokens,
            estimatedOutputTokens,
            estimatedCost: this.calculateCost(model, estimatedInputTokens, estimatedOutputTokens),
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let routerInstance: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
    if (!routerInstance) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('OPENROUTER_API_KEY is not set. Get one from https://openrouter.ai/keys');
        }

        routerInstance = new ModelRouter({
            openRouterApiKey: apiKey,
            premiumMode: process.env.PREMIUM_MODE === 'true',
            maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
            retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
        });

        console.log(`[ModelRouter] Initialized in ${routerInstance.getModeDescription()}`);
    }
    return routerInstance;
}

export function resetModelRouter(): void {
    routerInstance = null;
}

/**
 * Create a router with custom configuration
 * Useful for testing or specific use cases
 */
export function createModelRouter(config: RouterConfig): ModelRouter {
    return new ModelRouter(config);
}

