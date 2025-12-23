/**
 * Krip-Toe-Nite Model Registry
 *
 * Dual-SDK Architecture (December 2025):
 * - directModelId: For direct SDK calls (Anthropic SDK, OpenAI SDK)
 * - openRouterId: For OpenRouter fallback (other providers)
 *
 * VERIFIED: December 16, 2025 - Updated from official API docs
 *
 * Sources:
 * - Anthropic: https://docs.claude.com/en/docs/about-claude/models/overview
 * - OpenAI: https://platform.openai.com/docs/models
 * - Google: https://ai.google.dev/gemini-api/docs/models
 */

import type { KTNModelConfig, ModelTier } from './types.js';

// =============================================================================
// DIRECT SDK MODEL IDS - Anthropic (verified December 16, 2025)
// =============================================================================

export const DIRECT_ANTHROPIC_MODELS = {
    // Latest flagship models
    OPUS_4_5: 'claude-opus-4-5-20251101',
    SONNET_4_5: 'claude-sonnet-4-5-20250929',
    HAIKU_4_5: 'claude-haiku-4-5-20251001',
    // Legacy models (still available)
    OPUS_4_1: 'claude-opus-4-1-20250805',
    SONNET_4: 'claude-sonnet-4-20250514',
    OPUS_4: 'claude-opus-4-20250514',
    SONNET_3_7: 'claude-3-7-sonnet-20250219',
    HAIKU_3_5: 'claude-3-5-haiku-20241022',
} as const;

// =============================================================================
// DIRECT SDK MODEL IDS - OpenAI (verified December 16, 2025)
// =============================================================================

export const DIRECT_OPENAI_MODELS = {
    // GPT-5.2 Series (December 2025 - Latest)
    GPT_5_2: 'gpt-5.2',                    // GPT-5.2 Thinking (reasoning)
    GPT_5_2_CHAT: 'gpt-5.2-chat-latest',   // GPT-5.2 Instant
    GPT_5_2_PRO: 'gpt-5.2-pro',            // GPT-5.2 Pro (max quality)
    // GPT-5.2-Codex Series (December 18, 2025 - Best for agentic coding)
    GPT_5_2_CODEX: 'gpt-5.2-codex',        // 56.4% SWE-Bench Pro, state-of-the-art agentic
    GPT_5_2_CODEX_PRO: 'gpt-5.2-codex-pro', // Codex with enhanced security/audit
    // o3/o4 Reasoning Series (December 2025 - Latest)
    O3: 'o3',                              // Smartest reasoning model ever
    O3_PRO: 'o3-pro',                      // Pro tier with more compute
    O4_MINI: 'o4-mini',                    // Fast, cost-efficient reasoning
    O3_DEEP_RESEARCH: 'o3-deep-research',  // Deep analysis variant
    // GPT-5.1 Series (November 2025)
    GPT_5_1: 'gpt-5.1',                    // GPT-5.1 Thinking
    GPT_5_1_CODEX_MAX: 'gpt-5.1-codex-max', // Agentic coding specialist
    GPT_5_1_CHAT: 'gpt-5.1-chat-latest',   // GPT-5.1 Instant
    // GPT-5 Series (August 2025)
    GPT_5: 'gpt-5',
    GPT_5_MINI: 'gpt-5-mini',
    GPT_5_NANO: 'gpt-5-nano',
    // GPT-4 Series (still available)
    GPT_4O: 'gpt-4o',
    GPT_4O_MINI: 'gpt-4o-mini',
    GPT_4_1: 'gpt-4.1',
    GPT_4_1_MINI: 'gpt-4.1-mini',
} as const;

// =============================================================================
// GOOGLE GEMINI MODEL IDS (via OpenRouter only - no direct SDK)
// =============================================================================

export const GEMINI_MODELS = {
    // Gemini 3 Series (November 2025 - Latest)
    GEMINI_3_PRO: 'google/gemini-3-pro-preview',
    GEMINI_3_DEEP_THINK: 'google/gemini-3-deep-think',
    // Gemini 2.5 Series (Stable)
    GEMINI_2_5_PRO: 'google/gemini-2.5-pro',
    GEMINI_2_5_FLASH: 'google/gemini-2.5-flash',
    GEMINI_2_5_FLASH_LITE: 'google/gemini-2.5-flash-lite',
    // Gemini 2.0 Series
    GEMINI_2_0_FLASH: 'google/gemini-2.0-flash',
    GEMINI_2_0_FLASH_LITE: 'google/gemini-2.0-flash-lite',
} as const;

// =============================================================================
// MODEL DEFINITIONS - VERIFIED DECEMBER 16, 2025
// =============================================================================

export const KTN_MODELS: Record<string, KTNModelConfig> = {
    // =========================================================================
    // ANTHROPIC CLAUDE MODELS - Direct SDK
    // =========================================================================

    'claude-opus-4.5': {
        id: 'claude-opus-4.5',
        directModelId: DIRECT_ANTHROPIC_MODELS.OPUS_4_5,
        openRouterId: 'anthropic/claude-opus-4.5',
        name: 'Claude Opus 4.5',
        tier: 'intelligence',
        avgTtftMs: 1200,
        avgTpsMs: 15,
        costPer1MInput: 15.00,
        costPer1MOutput: 75.00,
        maxContext: 200000,
        maxOutput: 64000,
        strengths: ['best-coding', 'complex-reasoning', 'agentic', 'architecture', 'intent-lock'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'claude-sonnet-4.5': {
        id: 'claude-sonnet-4.5',
        directModelId: DIRECT_ANTHROPIC_MODELS.SONNET_4_5,
        openRouterId: 'anthropic/claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        tier: 'intelligence',
        avgTtftMs: 800,
        avgTpsMs: 12,
        costPer1MInput: 3.00,
        costPer1MOutput: 15.00,
        maxContext: 1000000,
        maxOutput: 64000,
        strengths: ['coding', 'real-world-agents', 'state-of-the-art', 'balanced', '1M-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'claude-haiku-4.5': {
        id: 'claude-haiku-4.5',
        directModelId: DIRECT_ANTHROPIC_MODELS.HAIKU_4_5,
        openRouterId: 'anthropic/claude-haiku-4.5',
        name: 'Claude Haiku 4.5',
        tier: 'speed',
        avgTtftMs: 200,
        avgTpsMs: 25,
        costPer1MInput: 1.00,
        costPer1MOutput: 5.00,
        maxContext: 200000,
        maxOutput: 8192,
        strengths: ['speed', 'cost-efficient', 'simple-tasks', 'formatting', 'quick-edits'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'claude-opus-4.1': {
        id: 'claude-opus-4.1',
        directModelId: DIRECT_ANTHROPIC_MODELS.OPUS_4_1,
        openRouterId: 'anthropic/claude-opus-4.1',
        name: 'Claude Opus 4.1',
        tier: 'intelligence',
        avgTtftMs: 1000,
        avgTpsMs: 14,
        costPer1MInput: 10.00,
        costPer1MOutput: 50.00,
        maxContext: 200000,
        maxOutput: 32000,
        strengths: ['agentic', 'coding', 'reasoning', 'legacy-support'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'claude-sonnet-4': {
        id: 'claude-sonnet-4',
        directModelId: DIRECT_ANTHROPIC_MODELS.SONNET_4,
        openRouterId: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4',
        tier: 'intelligence',
        avgTtftMs: 700,
        avgTpsMs: 12,
        costPer1MInput: 2.50,
        costPer1MOutput: 12.50,
        maxContext: 200000,
        maxOutput: 32000,
        strengths: ['coding', 'balanced', 'cost-effective'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // OPENAI GPT-5.2 MODELS - Direct SDK (December 2025)
    // =========================================================================

    'gpt-5.2-pro': {
        id: 'gpt-5.2-pro',
        directModelId: DIRECT_OPENAI_MODELS.GPT_5_2_PRO,
        openRouterId: 'openai/gpt-5.2-pro',
        name: 'GPT-5.2 Pro',
        tier: 'intelligence',
        avgTtftMs: 1500,
        avgTpsMs: 8,
        costPer1MInput: 1.75,
        costPer1MOutput: 14.00,
        maxContext: 400000,
        maxOutput: 128000,
        strengths: ['max-reasoning', 'xhigh-effort', 'science', 'math', 'professional'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-5.2': {
        id: 'gpt-5.2',
        directModelId: DIRECT_OPENAI_MODELS.GPT_5_2,
        openRouterId: 'openai/gpt-5.2',
        name: 'GPT-5.2 Thinking',
        tier: 'intelligence',
        avgTtftMs: 800,
        avgTpsMs: 10,
        costPer1MInput: 1.75,
        costPer1MOutput: 14.00,
        maxContext: 400000,
        maxOutput: 128000,
        strengths: ['reasoning', 'coding', 'tool-calling', 'professional'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-5.2-chat': {
        id: 'gpt-5.2-chat',
        directModelId: DIRECT_OPENAI_MODELS.GPT_5_2_CHAT,
        openRouterId: 'openai/gpt-5.2-chat-latest',
        name: 'GPT-5.2 Instant',
        tier: 'speed',
        avgTtftMs: 300,
        avgTpsMs: 15,
        costPer1MInput: 0.50,
        costPer1MOutput: 2.00,
        maxContext: 128000,
        maxOutput: 16384,
        strengths: ['speed', 'general', 'chat', 'low-latency'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // GPT-5.2-CODEX MODELS - Best for Agentic Coding (December 18, 2025)
    // 56.4% SWE-Bench Pro (state-of-the-art), context compaction, long-horizon
    // =========================================================================

    'gpt-5.2-codex': {
        id: 'gpt-5.2-codex',
        directModelId: DIRECT_OPENAI_MODELS.GPT_5_2_CODEX,
        openRouterId: 'openai/gpt-5.2-codex',
        name: 'GPT-5.2 Codex',
        tier: 'specialist',
        avgTtftMs: 500,
        avgTpsMs: 14,
        costPer1MInput: 2.00,
        costPer1MOutput: 16.00,
        maxContext: 400000,
        maxOutput: 128000,
        strengths: ['agentic-coding', 'swe-bench-sota', 'context-compaction', 'long-horizon', 'full-projects'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'gpt-5.2-codex-pro': {
        id: 'gpt-5.2-codex-pro',
        directModelId: DIRECT_OPENAI_MODELS.GPT_5_2_CODEX_PRO,
        openRouterId: 'openai/gpt-5.2-codex-pro',
        name: 'GPT-5.2 Codex Pro',
        tier: 'specialist',
        avgTtftMs: 600,
        avgTpsMs: 12,
        costPer1MInput: 3.00,
        costPer1MOutput: 24.00,
        maxContext: 400000,
        maxOutput: 128000,
        strengths: ['agentic-coding', 'security-audit', 'code-review', 'enterprise', 'full-projects'],
        supportsVision: false,
        supportsStreaming: true,
    },

    // =========================================================================
    // o3/o4 REASONING MODELS - Smartest Ever (December 2025)
    // o3 crossed 90% on ARC-AGI-1 (Verified) - breakthrough reasoning
    // =========================================================================

    'o3': {
        id: 'o3',
        directModelId: DIRECT_OPENAI_MODELS.O3,
        openRouterId: 'openai/o3',
        name: 'o3 Reasoning',
        tier: 'intelligence',
        avgTtftMs: 2000,
        avgTpsMs: 6,
        costPer1MInput: 10.00,
        costPer1MOutput: 40.00,
        maxContext: 200000,
        maxOutput: 100000,
        strengths: ['reasoning', 'math', 'science', 'agentic', 'arc-agi-sota', 'visual-reasoning'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'o3-pro': {
        id: 'o3-pro',
        directModelId: DIRECT_OPENAI_MODELS.O3_PRO,
        openRouterId: 'openai/o3-pro',
        name: 'o3 Pro',
        tier: 'intelligence',
        avgTtftMs: 3000,
        avgTpsMs: 4,
        costPer1MInput: 20.00,
        costPer1MOutput: 80.00,
        maxContext: 200000,
        maxOutput: 100000,
        strengths: ['max-reasoning', 'hard-problems', 'consistency', 'science', 'research'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'o4-mini': {
        id: 'o4-mini',
        directModelId: DIRECT_OPENAI_MODELS.O4_MINI,
        openRouterId: 'openai/o4-mini',
        name: 'o4-mini',
        tier: 'speed',
        avgTtftMs: 400,
        avgTpsMs: 15,
        costPer1MInput: 1.10,
        costPer1MOutput: 4.40,
        maxContext: 200000,
        maxOutput: 100000,
        strengths: ['fast-reasoning', 'math', 'coding', 'cost-efficient', 'aime-sota'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // OPENAI GPT-5.1 MODELS - Direct SDK (November 2025)
    // =========================================================================

    'gpt-5.1-codex-max': {
        id: 'gpt-5.1-codex-max',
        directModelId: DIRECT_OPENAI_MODELS.GPT_5_1_CODEX_MAX,
        openRouterId: 'openai/gpt-5.1-codex-max',
        name: 'GPT-5.1 Codex Max',
        tier: 'specialist',
        avgTtftMs: 600,
        avgTpsMs: 12,
        costPer1MInput: 1.25,
        costPer1MOutput: 10.00,
        maxContext: 400000,
        maxOutput: 64000,
        strengths: ['agentic-coding', 'long-running', 'project-scale', 'autonomous-5hr'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'gpt-5.1': {
        id: 'gpt-5.1',
        directModelId: DIRECT_OPENAI_MODELS.GPT_5_1,
        openRouterId: 'openai/gpt-5.1',
        name: 'GPT-5.1 Thinking',
        tier: 'intelligence',
        avgTtftMs: 700,
        avgTpsMs: 11,
        costPer1MInput: 1.50,
        costPer1MOutput: 12.00,
        maxContext: 200000,
        maxOutput: 32000,
        strengths: ['reasoning', 'coding', 'adaptive-effort'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // OPENAI GPT-4o MODELS - Direct SDK (still excellent for many tasks)
    // =========================================================================

    'gpt-4o': {
        id: 'gpt-4o',
        directModelId: DIRECT_OPENAI_MODELS.GPT_4O,
        openRouterId: 'openai/gpt-4o',
        name: 'GPT-4o',
        tier: 'intelligence',
        avgTtftMs: 400,
        avgTpsMs: 12,
        costPer1MInput: 2.50,
        costPer1MOutput: 10.00,
        maxContext: 128000,
        maxOutput: 16384,
        strengths: ['multimodal', 'general', 'vision', 'reliable'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        directModelId: DIRECT_OPENAI_MODELS.GPT_4O_MINI,
        openRouterId: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        tier: 'speed',
        avgTtftMs: 200,
        avgTpsMs: 18,
        costPer1MInput: 0.15,
        costPer1MOutput: 0.60,
        maxContext: 128000,
        maxOutput: 16384,
        strengths: ['speed', 'cheap', 'general', 'vision'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // GOOGLE GEMINI MODELS - OpenRouter only (no direct SDK)
    // =========================================================================

    'gemini-3-pro': {
        id: 'gemini-3-pro',
        openRouterId: GEMINI_MODELS.GEMINI_3_PRO,
        name: 'Gemini 3 Pro',
        tier: 'intelligence',
        avgTtftMs: 600,
        avgTpsMs: 10,
        costPer1MInput: 2.50,
        costPer1MOutput: 10.00,
        maxContext: 1000000,
        maxOutput: 16384,
        strengths: ['reasoning', 'agentic', 'coding', 'adaptive-thinking', '1M-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        openRouterId: GEMINI_MODELS.GEMINI_2_5_FLASH,
        name: 'Gemini 2.5 Flash',
        tier: 'speed',
        avgTtftMs: 150,
        avgTpsMs: 20,
        costPer1MInput: 0.075,
        costPer1MOutput: 0.30,
        maxContext: 1000000,
        maxOutput: 8192,
        strengths: ['ultra-fast', 'cheap', 'reasoning', '1M-context'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gemini-2.5-flash-lite': {
        id: 'gemini-2.5-flash-lite',
        openRouterId: GEMINI_MODELS.GEMINI_2_5_FLASH_LITE,
        name: 'Gemini 2.5 Flash Lite',
        tier: 'speed',
        avgTtftMs: 100,
        avgTpsMs: 25,
        costPer1MInput: 0.02,
        costPer1MOutput: 0.10,
        maxContext: 1000000,
        maxOutput: 8192,
        strengths: ['fastest', 'cheapest', 'simple-tasks'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'gemini-2.5-pro': {
        id: 'gemini-2.5-pro',
        openRouterId: GEMINI_MODELS.GEMINI_2_5_PRO,
        name: 'Gemini 2.5 Pro',
        tier: 'intelligence',
        avgTtftMs: 500,
        avgTpsMs: 12,
        costPer1MInput: 1.25,
        costPer1MOutput: 5.00,
        maxContext: 1000000,
        maxOutput: 16384,
        strengths: ['adaptive-thinking', 'multimodal', '1M-context', 'reasoning'],
        supportsVision: true,
        supportsStreaming: true,
    },

    // =========================================================================
    // SPECIALIST MODELS - OpenRouter (code-focused, reasoning)
    // =========================================================================

    'deepseek-v3': {
        id: 'deepseek-v3',
        openRouterId: 'deepseek/deepseek-chat-v3-0324',
        name: 'DeepSeek V3',
        tier: 'speed',
        avgTtftMs: 250,
        avgTpsMs: 20,
        costPer1MInput: 0.14,
        costPer1MOutput: 0.28,
        maxContext: 128000,
        maxOutput: 8192,
        strengths: ['speed', 'code', 'reasoning', 'value'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'deepseek-r1': {
        id: 'deepseek-r1',
        openRouterId: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        tier: 'specialist',
        avgTtftMs: 400,
        avgTpsMs: 10,
        costPer1MInput: 0.55,
        costPer1MOutput: 2.19,
        maxContext: 164000,
        maxOutput: 16384,
        strengths: ['reasoning', 'math', 'code', 'chain-of-thought'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'qwen3-coder': {
        id: 'qwen3-coder',
        openRouterId: 'qwen/qwen3-coder-480b-a35b',
        name: 'Qwen3 Coder 480B',
        tier: 'specialist',
        avgTtftMs: 350,
        avgTpsMs: 12,
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
        avgTpsMs: 15,
        costPer1MInput: 0.30,
        costPer1MOutput: 0.90,
        maxContext: 256000,
        maxOutput: 16384,
        strengths: ['code-generation', 'fill-in-middle', 'low-latency'],
        supportsVision: false,
        supportsStreaming: true,
    },

    'mistral-large-3': {
        id: 'mistral-large-3',
        openRouterId: 'mistralai/mistral-large-2412',
        name: 'Mistral Large 3',
        tier: 'intelligence',
        avgTtftMs: 500,
        avgTpsMs: 10,
        costPer1MInput: 2.00,
        costPer1MOutput: 6.00,
        maxContext: 128000,
        maxOutput: 16384,
        strengths: ['reasoning', 'multilingual', 'code', 'open-source'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'llama-4-maverick': {
        id: 'llama-4-maverick',
        openRouterId: 'meta-llama/llama-4-maverick',
        name: 'Llama 4 Maverick',
        tier: 'intelligence',
        avgTtftMs: 400,
        avgTpsMs: 14,
        costPer1MInput: 0.50,
        costPer1MOutput: 0.70,
        maxContext: 1000000,
        maxOutput: 16384,
        strengths: ['multimodal', 'reasoning', '1M-context', 'open-source'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'grok-4.1': {
        id: 'grok-4.1',
        openRouterId: 'x-ai/grok-4.1',
        name: 'Grok 4.1',
        tier: 'intelligence',
        avgTtftMs: 400,
        avgTpsMs: 12,
        costPer1MInput: 3.00,
        costPer1MOutput: 15.00,
        maxContext: 2000000,
        maxOutput: 32768,
        strengths: ['reasoning', 'multimodal', 'huge-context', 'tool-calling', '#1-lmarena'],
        supportsVision: true,
        supportsStreaming: true,
    },

    'grok-4.1-fast': {
        id: 'grok-4.1-fast',
        openRouterId: 'x-ai/grok-4.1-fast',
        name: 'Grok 4.1 Fast',
        tier: 'speed',
        avgTtftMs: 200,
        avgTpsMs: 18,
        costPer1MInput: 0.20,
        costPer1MOutput: 0.50,
        maxContext: 2000000,
        maxOutput: 32768,
        strengths: ['speed', 'multimodal', 'huge-context', 'tool-calling', 'agentic'],
        supportsVision: true,
        supportsStreaming: true,
    },
};

// =============================================================================
// TIER PREFERENCES - Ordered by preference for each tier
// =============================================================================

export const TIER_PREFERENCES: Record<ModelTier, string[]> = {
    speed: [
        'claude-haiku-4.5',     // Best quality per cost for fast tasks
        'o4-mini',              // NEW: Fast reasoning, AIME SOTA
        'gemini-2.5-flash',     // Ultra-fast, 1M context
        'gpt-4o-mini',          // OpenAI fast option
        'gpt-5.2-chat',         // GPT-5.2 Instant
        'deepseek-v3',          // Excellent value
        'grok-4.1-fast',        // 2M context, #1 tool-calling
        'gemini-2.5-flash-lite', // Cheapest option
    ],
    intelligence: [
        'o3',                   // NEW: Smartest reasoning model (90% ARC-AGI)
        'claude-opus-4.5',      // Best for intent lock and complex reasoning
        'o3-pro',               // NEW: Pro tier max reasoning
        'gpt-5.2-pro',          // OpenAI best standard model
        'claude-sonnet-4.5',    // Great balance of speed and quality
        'gpt-5.2',              // GPT-5.2 Thinking
        'grok-4.1',             // #1 on LMArena, 2M context
        'gemini-3-pro',         // Google flagship
        'gpt-4o',               // Reliable multimodal
        'mistral-large-3',      // Open-source flagship
        'llama-4-maverick',     // Meta flagship
    ],
    specialist: [
        'gpt-5.2-codex',        // NEW: 56.4% SWE-Bench Pro SOTA
        'gpt-5.2-codex-pro',    // NEW: Codex with security/audit
        'gpt-5.1-codex-max',    // 5hr autonomous coding
        'deepseek-r1',          // Reasoning specialist
        'qwen3-coder',          // MoE code specialist
        'codestral-2508',       // Fast code generation
    ],
};

// =============================================================================
// STRATEGY MODELS - Task-based model selection
// =============================================================================

export const STRATEGY_MODELS = {
    // Trivial: Single fastest model (formatting, typos)
    trivial: {
        primary: 'claude-haiku-4.5',
        fallback: 'gemini-2.5-flash-lite',
    },

    // Simple: Fast model, good quality (basic components, simple edits)
    simple: {
        primary: 'claude-haiku-4.5',
        fallback: 'o4-mini',              // NEW: Fast reasoning
    },

    // Medium: Speculative execution - fast + smart (feature implementation)
    medium: {
        fast: 'o4-mini',                  // NEW: Fast reasoning (AIME SOTA)
        smart: 'claude-sonnet-4.5',
        fallback: 'gpt-5.2-codex',        // NEW: SWE-Bench SOTA
    },

    // Complex: Intelligence tier primary (architecture, multi-file)
    complex: {
        primary: 'claude-opus-4.5',
        reasoning: 'o3',                  // NEW: Use o3 for complex reasoning
        fallback: 'gpt-5.2-pro',
    },

    // Expert: Best available with deep reasoning (intent lock, critical decisions)
    expert: {
        primary: 'o3',                    // NEW: Smartest reasoning (90% ARC-AGI)
        validation: 'claude-opus-4.5',    // Cross-validate with Opus
        fallback: 'o3-pro',               // NEW: Pro tier if needed
    },

    // Autonomous coding: Specialized for long-running agentic coding (December 2025)
    autonomous: {
        primary: 'gpt-5.2-codex',         // NEW: 56.4% SWE-Bench Pro SOTA
        validation: 'claude-opus-4.5',    // Validate at checkpoints
        fallback: 'gpt-5.2-codex-pro',    // NEW: Enterprise security
    },

    // Intent Lock: Maximum quality for sacred contracts
    intentLock: {
        primary: 'claude-opus-4.5',       // Best for nuanced understanding
        reasoning: 'o3',                  // NEW: Add o3 for deep reasoning
        fallback: 'gpt-5.2-pro',
    },

    // Deep Analysis: Root cause analysis, comprehensive fixes
    deepAnalysis: {
        primary: 'o3-pro',                // NEW: Max reasoning with more compute
        fallback: 'o3',
        validation: 'claude-opus-4.5',
    },

    // Coding: Feature building, bug fixes, refactoring
    coding: {
        primary: 'gpt-5.2-codex',         // NEW: State-of-the-art agentic coding
        fast: 'o4-mini',                  // NEW: Fast reasoning for simple fixes
        fallback: 'claude-sonnet-4.5',
    },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function getModel(id: string): KTNModelConfig | undefined {
    return KTN_MODELS[id];
}

export function getModelsByTier(tier: ModelTier): KTNModelConfig[] {
    return TIER_PREFERENCES[tier].map(id => KTN_MODELS[id]).filter(Boolean);
}

export function getFastestModel(
    options?: {
        requireVision?: boolean;
        maxCostPer1MOutput?: number;
        minContext?: number;
        requireDirectSdk?: boolean;
    }
): KTNModelConfig {
    const candidates = Object.values(KTN_MODELS)
        .filter(m => {
            if (options?.requireVision && !m.supportsVision) return false;
            if (options?.maxCostPer1MOutput && m.costPer1MOutput > options.maxCostPer1MOutput) return false;
            if (options?.minContext && m.maxContext < options.minContext) return false;
            if (options?.requireDirectSdk && !m.directModelId) return false;
            return true;
        })
        .sort((a, b) => a.avgTtftMs - b.avgTtftMs);

    return candidates[0] || KTN_MODELS['claude-haiku-4.5'];
}

export function getBestCodeModel(): KTNModelConfig {
    return KTN_MODELS['gpt-5.1-codex-max'];
}

export function getBestReasoningModel(): KTNModelConfig {
    return KTN_MODELS['claude-opus-4.5'];
}

export function getAutonomousBuildModel(): KTNModelConfig {
    return KTN_MODELS['gpt-5.1-codex-max'];
}

export function getIntentLockModel(): KTNModelConfig {
    return KTN_MODELS['claude-opus-4.5'];
}

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

export function estimateCost(
    model: KTNModelConfig,
    inputTokens: number,
    outputTokens: number
): number {
    const inputCost = (inputTokens / 1_000_000) * model.costPer1MInput;
    const outputCost = (outputTokens / 1_000_000) * model.costPer1MOutput;
    return inputCost + outputCost;
}

export function getAllModelsForDisplay(): Array<{
    id: string;
    name: string;
    tier: ModelTier;
    description: string;
    speed: 'fast' | 'medium' | 'slow';
    quality: 'good' | 'excellent' | 'best';
    costTier: 'economy' | 'standard' | 'premium';
    isRecommended?: boolean;
    hasDirectSdk?: boolean;
}> {
    return [
        // Krip-Toe-Nite is THE recommended option
        {
            id: 'krip-toe-nite',
            name: 'Krip-Toe-Nite',
            tier: 'intelligence' as ModelTier,
            description: 'Intelligent orchestration - fastest + best quality',
            speed: 'fast',
            quality: 'best',
            costTier: 'standard',
            isRecommended: true,
        },
        // Intelligence Tier - Anthropic
        {
            id: 'claude-opus-4.5',
            name: 'Claude Opus 4.5',
            tier: 'intelligence',
            description: 'Maximum quality for complex reasoning & intent lock',
            speed: 'slow',
            quality: 'best',
            costTier: 'premium',
            hasDirectSdk: true,
        },
        {
            id: 'claude-sonnet-4.5',
            name: 'Claude Sonnet 4.5',
            tier: 'intelligence',
            description: 'Best coding model with 1M context',
            speed: 'medium',
            quality: 'best',
            costTier: 'standard',
            hasDirectSdk: true,
        },
        // Intelligence Tier - OpenAI
        {
            id: 'gpt-5.2-pro',
            name: 'GPT-5.2 Pro',
            tier: 'intelligence',
            description: 'OpenAI max reasoning with 400K context, 128K output',
            speed: 'slow',
            quality: 'best',
            costTier: 'standard',
            hasDirectSdk: true,
        },
        {
            id: 'gpt-5.1-codex-max',
            name: 'GPT-5.1 Codex Max',
            tier: 'specialist',
            description: 'Agentic coding for 5hr autonomous builds',
            speed: 'medium',
            quality: 'best',
            costTier: 'standard',
            hasDirectSdk: true,
        },
        // Speed Tier
        {
            id: 'claude-haiku-4.5',
            name: 'Claude Haiku 4.5',
            tier: 'speed',
            description: 'Fast, cheap, matches Sonnet 4 quality',
            speed: 'fast',
            quality: 'excellent',
            costTier: 'economy',
            hasDirectSdk: true,
        },
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
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            tier: 'speed',
            description: 'OpenAI fast option with vision',
            speed: 'fast',
            quality: 'good',
            costTier: 'economy',
            hasDirectSdk: true,
        },
        // Specialist Tier
        {
            id: 'deepseek-r1',
            name: 'DeepSeek R1',
            tier: 'specialist',
            description: 'Reasoning specialist with chain-of-thought',
            speed: 'medium',
            quality: 'excellent',
            costTier: 'economy',
        },
        {
            id: 'qwen3-coder',
            name: 'Qwen3 Coder 480B',
            tier: 'specialist',
            description: 'MoE code specialist',
            speed: 'fast',
            quality: 'excellent',
            costTier: 'economy',
        },
    ];
}

export default KTN_MODELS;
