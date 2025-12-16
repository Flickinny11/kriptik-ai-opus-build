/**
 * AI Service Type Definitions
 *
 * Shared types for the dual-SDK architecture:
 * - Anthropic SDK (Claude models)
 * - OpenAI SDK (GPT-5.2 models)
 * - OpenRouter (fallback models)
 *
 * December 2025
 */

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'openrouter';

// =============================================================================
// MODEL INFORMATION
// =============================================================================

export interface ModelInfo {
    id: string;
    provider: AIProvider;
    name: string;
    contextWindow: number;
    maxOutput: number;
    supportsThinking: boolean;
    supportsVision: boolean;
    supportsStreaming: boolean;
    inputCostPer1M: number;
    outputCostPer1M: number;
}

export type ModelTier = 'premium' | 'thinking' | 'critical' | 'standard' | 'simple' | 'vision';

export interface ModelConfig extends ModelInfo {
    tier: ModelTier;
}

// =============================================================================
// PHASE CONFIGURATION
// =============================================================================

export type EffortLevel = 'low' | 'medium' | 'high';

export interface PhaseConfig {
    model: string;
    provider: AIProvider;
    effort?: EffortLevel;
    thinkingBudget: number;
    description: string;
    /** Optional secondary model for verification */
    verificationModel?: string;
    /** Optional model for validation pass */
    validationModel?: string;
    /** Optional model for ensemble voting */
    ensembleModel?: string;
}

// =============================================================================
// GENERATION TYPES
// =============================================================================

export interface GenerationContext {
    projectId: string;
    userId: string;
    sessionId?: string;
    agentType: 'planning' | 'generation' | 'testing' | 'refinement' | 'deployment' | 'verification';
    existingFiles?: Map<string, string>;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
}

export interface GenerationOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    useExtendedThinking?: boolean;
    thinkingBudgetTokens?: number;
    effort?: EffortLevel;
    stopSequences?: string[];
}

export interface GenerationResponse {
    id: string;
    content: string;
    thinking?: string;
    toolCalls?: Array<{ name: string; input: unknown; output?: string }>;
    usage: {
        inputTokens: number;
        outputTokens: number;
        thinkingTokens?: number;
        cacheCreationInputTokens?: number;
        cacheReadInputTokens?: number;
    };
    stopReason: string;
    model: string;
    provider?: AIProvider;
}

export interface StreamCallbacks {
    onThinking?: (thinking: string) => void;
    onText?: (text: string) => void;
    onToolUse?: (tool: { name: string; input: unknown }) => void;
    onComplete?: (response: GenerationResponse) => void;
    onError?: (error: Error) => void;
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

export interface FileOperation {
    type: 'create' | 'update' | 'delete';
    path: string;
    content?: string;
    language?: string;
}

// =============================================================================
// REQUEST CONTEXT
// =============================================================================

export interface RequestContext {
    userId?: string;
    projectId?: string;
    agentType?: string;
    sessionId?: string;
    feature?: string;
    phase?: string;
}

// =============================================================================
// THINKING CONFIGURATION
// =============================================================================

export interface ThinkingConfig {
    enabled: boolean;
    budgetTokens?: number;
    effort?: EffortLevel;
}

// =============================================================================
// UNIFIED GENERATION PARAMS
// =============================================================================

export interface UnifiedGenerationParams {
    model: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    systemPrompt?: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
    maxTokens?: number;
    temperature?: number;
    thinking?: ThinkingConfig;
    structuredOutput?: { schema: Record<string, unknown>; name: string };
    stopSequences?: string[];
}

// =============================================================================
// COST TRACKING
// =============================================================================

export interface UsageStats {
    requestCount: number;
    totalCost: number;
    averageCostPerRequest: number;
    errorCorrectionCost: number;
    byProvider: Record<AIProvider, {
        requestCount: number;
        totalCost: number;
        inputTokens: number;
        outputTokens: number;
    }>;
}
