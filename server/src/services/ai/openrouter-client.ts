/**
 * OpenRouter AI Client - Ultimate AI-First Builder Architecture
 *
 * Primary AI client for KripTik AI using OpenRouter's API.
 * OpenRouter provides access to Claude models with full capabilities:
 * - Extended thinking
 * - Effort/Verbosity parameter (low/medium/high)
 * - Tool calls
 * - 200K context / 1M for Sonnet
 * - Parallel agent execution support
 *
 * December 2025 Beta Features:
 * - effort-2025-11-24: Effort parameter control
 * - interleaved-thinking-2025-05-14: Think between tool calls
 * - context-management-2025-06-27: Memory tool + context editing
 * - structured-outputs-2025-11-13: Guaranteed JSON schema
 * - advanced-tool-use-2025-11-20: Enhanced tool capabilities
 * - context-1m-2025-08-07: 1M token context (Sonnet)
 *
 * Uses the Anthropic SDK pointed at OpenRouter's Anthropic-compatible endpoint.
 */

import { Anthropic } from '@anthropic-ai/sdk';

// =============================================================================
// DECEMBER 2025 BETA FEATURES
// =============================================================================

/**
 * OpenRouter beta features for Claude models
 * These enable the most advanced capabilities
 */
export const OPENROUTER_BETAS = {
    EFFORT: 'effort-2025-11-24',
    INTERLEAVED_THINKING: 'interleaved-thinking-2025-05-14',
    CONTEXT_MANAGEMENT: 'context-management-2025-06-27',
    STRUCTURED_OUTPUTS: 'structured-outputs-2025-11-13',
    ADVANCED_TOOL_USE: 'advanced-tool-use-2025-11-20',
    CONTEXT_1M: 'context-1m-2025-08-07',
} as const;

/**
 * Get beta header string for specific features
 */
export function getBetaHeaders(features: (keyof typeof OPENROUTER_BETAS)[]): string {
    return features.map(f => OPENROUTER_BETAS[f]).join(',');
}

/**
 * Get all beta headers for maximum capability mode
 */
export function getAllBetaHeaders(): string {
    return Object.values(OPENROUTER_BETAS).join(',');
}

// =============================================================================
// ANTHROPIC MODELS (Direct SDK Access)
// =============================================================================

/**
 * Claude models accessed via direct Anthropic SDK
 * Full features: 64K thinking budget, precise cache control, effort parameter
 */
export const ANTHROPIC_MODELS = {
    OPUS_4_5: 'claude-opus-4-5-20250514',
    SONNET_4_5: 'claude-sonnet-4-5-20250514',
    SONNET_4: 'claude-sonnet-4-20250514',
    HAIKU_3_5: 'claude-3-5-haiku-20241022',
} as const;

// =============================================================================
// OPENAI MODELS (Direct SDK Access for GPT-5.2)
// =============================================================================

/**
 * GPT-5.2 models accessed via direct OpenAI SDK
 * Full features: 400K context, 128K output, native thinking mode
 * Released December 11, 2025
 */
export const OPENAI_MODELS = {
    GPT_5_2_PRO: 'gpt-5.2-pro',           // Most accurate, $21/$168 per 1M tokens
    GPT_5_2_THINKING: 'gpt-5.2',          // Structured thinking, $1.75/$14 per 1M tokens
    GPT_5_2_INSTANT: 'gpt-5.2-chat-latest', // Fastest, for writing/info seeking
    GPT_4O: 'gpt-4o',
    GPT_4O_MINI: 'gpt-4o-mini',
} as const;

// =============================================================================
// OPENROUTER MODELS (Fallback for other providers)
// =============================================================================

/**
 * Models accessed via OpenRouter (fallback)
 * Used for: DeepSeek, Gemini, Llama, Mistral, etc.
 */
export const OPENROUTER_MODELS = {
    // Claude models (via OpenRouter as fallback)
    OPUS_4_5: 'anthropic/claude-opus-4.5',
    SONNET_4_5: 'anthropic/claude-sonnet-4.5',
    SONNET_4: 'anthropic/claude-sonnet-4',
    HAIKU_3_5: 'anthropic/claude-3.5-haiku',

    // DeepSeek V3 - Cost-effective for bulk operations
    DEEPSEEK_V3: 'deepseek/deepseek-chat-v3-0324',
    DEEPSEEK_CODER: 'deepseek/deepseek-coder',
    DEEPSEEK_R1: 'deepseek/deepseek-reasoner',

    // GPT-4o via OpenRouter (fallback)
    GPT_4O: 'openai/gpt-4o',
    GPT_4O_MINI: 'openai/gpt-4o-mini',

    // Gemini 2.0 - Good for certain use cases
    GEMINI_2_FLASH: 'google/gemini-2.0-flash-thinking-exp',

    // Llama 3.3 - Open source alternative
    LLAMA_3_3_70B: 'meta-llama/llama-3.3-70b-instruct',

    // Grok 2 - Fast
    GROK_2: 'x-ai/grok-2-1212',

    // Mistral Large
    MISTRAL_LARGE: 'mistralai/mistral-large-2411',
} as const;

export type AnthropicModel = typeof ANTHROPIC_MODELS[keyof typeof ANTHROPIC_MODELS];
export type OpenAIModel = typeof OPENAI_MODELS[keyof typeof OPENAI_MODELS];
export type OpenRouterOnlyModel = typeof OPENROUTER_MODELS[keyof typeof OPENROUTER_MODELS];
// OpenRouterModel now includes all model types for backwards compatibility
// Also allows string for dynamic model selection
export type OpenRouterModel = AnthropicModel | OpenAIModel | OpenRouterOnlyModel | (string & {});
export type AIModel = OpenRouterModel;

// Effort levels for Opus 4.5 (maps to OpenRouter's verbosity parameter)
export type EffortLevel = 'low' | 'medium' | 'high';

// =============================================================================
// CONTEXT EDITING CONFIGURATION
// =============================================================================

/**
 * Context editing rules for 84% token reduction
 * These rules automatically manage context as conversations grow
 */
export interface ContextEditRule {
    type: 'clear_tool_uses_20250919' | 'clear_thinking_20251015';
    trigger: {
        type: 'input_tokens';
        value: number;  // Trigger when context exceeds this many tokens
    };
    keep?: {
        type: 'tool_uses';
        value: number;  // Keep last N tool calls
    };
    clear_at_least?: {
        type: 'input_tokens';
        value: number;  // Clear at least this many tokens
    };
    exclude_tools?: string[];  // Never clear these tools (e.g., 'memory')
}

/**
 * Default context editing configuration
 * Achieves 84% token reduction according to Anthropic research
 */
export const DEFAULT_CONTEXT_EDITS: ContextEditRule[] = [
    {
        type: 'clear_tool_uses_20250919',
        trigger: { type: 'input_tokens', value: 150000 },  // At 150K tokens
        keep: { type: 'tool_uses', value: 5 },              // Keep last 5 tool calls
        clear_at_least: { type: 'input_tokens', value: 50000 },
        exclude_tools: ['memory'],  // Never clear memory operations
    },
    {
        type: 'clear_thinking_20251015',
        trigger: { type: 'input_tokens', value: 180000 },  // At 180K tokens
    },
];

// =============================================================================
// PHASE CONFIGURATION
// =============================================================================

/**
 * AI Provider type
 */
export type AIProvider = 'anthropic' | 'openai' | 'openrouter';

/**
 * Model/effort configuration per build phase
 * Dual-SDK architecture: Anthropic + OpenAI direct access
 */
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

export const PHASE_CONFIGS: Record<string, PhaseConfig> = {
    'intent_lock': {
        model: ANTHROPIC_MODELS.OPUS_4_5,
        provider: 'anthropic',
        effort: 'high',
        thinkingBudget: 64000,
        description: 'Sacred Contract creation - maximum reasoning with Opus 4.5',
        verificationModel: OPENAI_MODELS.GPT_5_2_PRO,
    },
    'initialization': {
        model: ANTHROPIC_MODELS.OPUS_4_5,
        provider: 'anthropic',
        effort: 'medium',
        thinkingBudget: 32000,
        description: 'Artifact setup - good reasoning',
    },
    'build_orchestrator': {
        model: OPENAI_MODELS.GPT_5_2_THINKING,
        provider: 'openai',
        thinkingBudget: 16000,
        description: 'Coordination - GPT-5.2 excels at structured planning',
    },
    'build_agent': {
        model: ANTHROPIC_MODELS.SONNET_4_5,
        provider: 'anthropic',
        effort: 'medium',
        thinkingBudget: 16000,
        description: 'Feature building - Sonnet 4.5 for coding',
        validationModel: OPENAI_MODELS.GPT_5_2_THINKING,
    },
    'error_check': {
        model: OPENAI_MODELS.GPT_5_2_THINKING,
        provider: 'openai',
        thinkingBudget: 8000,
        description: 'Error checking - GPT-5.2 pattern recognition',
    },
    'visual_verify': {
        model: ANTHROPIC_MODELS.SONNET_4_5,
        provider: 'anthropic',
        effort: 'high',
        thinkingBudget: 32000,
        description: 'Visual verification - Claude vision + deep analysis',
    },
    'intent_satisfaction': {
        model: ANTHROPIC_MODELS.OPUS_4_5,
        provider: 'anthropic',
        effort: 'high',
        thinkingBudget: 64000,
        description: 'Critical gate - Opus 4.5 maximum reasoning',
    },
    'tournament_judge': {
        model: ANTHROPIC_MODELS.OPUS_4_5,
        provider: 'anthropic',
        effort: 'high',
        thinkingBudget: 64000,
        description: 'Best-of-breed selection - ensemble judging',
        ensembleModel: OPENAI_MODELS.GPT_5_2_PRO,
    },
    'simple_check': {
        model: ANTHROPIC_MODELS.HAIKU_3_5,
        provider: 'anthropic',
        effort: 'low',
        thinkingBudget: 0,
        description: 'Simple checks - fast Haiku execution',
    },
    'quick_generation': {
        model: OPENAI_MODELS.GPT_5_2_INSTANT,
        provider: 'openai',
        thinkingBudget: 0,
        description: 'Fast generation - GPT-5.2 Instant for speed',
    },
};

/**
 * Get phase configuration
 */
export function getPhaseConfig(phase: string): PhaseConfig {
    return PHASE_CONFIGS[phase] || PHASE_CONFIGS['build_agent'];
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface OpenRouterConfig {
    apiKey: string;
    defaultModel?: OpenRouterModel;
    siteUrl?: string;
    siteName?: string;
    enableBetas?: boolean;  // Enable December 2025 beta features
    betaFeatures?: (keyof typeof OPENROUTER_BETAS)[];  // Specific betas to enable
    contextEdits?: ContextEditRule[];  // Context editing rules
}

export interface RequestContext {
    userId?: string;
    projectId?: string;
    agentType?: string;
    sessionId?: string;
    feature?: string;
    phase?: string;  // Build phase for automatic config
}

/**
 * OpenRouter client that uses Anthropic SDK
 * Enhanced with December 2025 beta features
 */
export class OpenRouterClient {
    private client: Anthropic;
    private config: OpenRouterConfig;

    constructor(config?: Partial<OpenRouterConfig>) {
        const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            throw new Error(
                'OPENROUTER_API_KEY is required. Get one from https://openrouter.ai/keys'
            );
        }

        this.config = {
            apiKey,
            defaultModel: config?.defaultModel || OPENROUTER_MODELS.SONNET_4_5,
            siteUrl: config?.siteUrl || 'https://kriptik.ai',
            siteName: config?.siteName || 'KripTik AI Builder',
            enableBetas: config?.enableBetas ?? true,  // Enable betas by default
            betaFeatures: config?.betaFeatures || ['EFFORT', 'INTERLEAVED_THINKING', 'CONTEXT_MANAGEMENT'],
            contextEdits: config?.contextEdits || DEFAULT_CONTEXT_EDITS,
        };

        // Build headers including beta features
        const headers: Record<string, string> = {
            'HTTP-Referer': this.config.siteUrl!,
            'X-Title': this.config.siteName!,
        };

        // Add beta headers if enabled
        if (this.config.enableBetas && this.config.betaFeatures) {
            headers['anthropic-beta'] = getBetaHeaders(this.config.betaFeatures);
        }

        // Initialize Anthropic SDK pointing to OpenRouter
        this.client = new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: headers,
        });

        const betaList = this.config.enableBetas
            ? getBetaHeaders(this.config.betaFeatures || [])
            : 'none';
        console.log(`[OpenRouterClient] Initialized with betas: ${betaList}`);
    }

    /**
     * Get the underlying Anthropic client
     */
    getClient(): Anthropic {
        return this.client;
    }

    /**
     * Create a client instance with request-specific headers
     * Automatically applies phase-based configuration
     */
    withContext(context: RequestContext): Anthropic {
        const headers: Record<string, string> = {
            'HTTP-Referer': this.config.siteUrl!,
            'X-Title': this.config.siteName!,
        };

        // Add beta headers if enabled
        if (this.config.enableBetas && this.config.betaFeatures) {
            headers['anthropic-beta'] = getBetaHeaders(this.config.betaFeatures);
        }

        // Add context as custom headers for tracking
        if (context.userId) {
            headers['X-User-Id'] = context.userId;
        }
        if (context.projectId) {
            headers['X-Project-Id'] = context.projectId;
        }
        if (context.agentType) {
            headers['X-Agent-Type'] = context.agentType;
        }
        if (context.sessionId) {
            headers['X-Session-Id'] = context.sessionId;
        }
        if (context.phase) {
            headers['X-Build-Phase'] = context.phase;
        }

        return new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: headers,
        });
    }

    /**
     * Get configuration for a specific build phase
     */
    getConfigForPhase(phase: string): {
        model: OpenRouterModel;
        effort: EffortLevel;
        thinkingBudget: number;
        useExtendedThinking: boolean;
    } {
        const config = getPhaseConfig(phase);
        return {
            model: config.model as OpenRouterModel,
            effort: config.effort || 'medium',
            thinkingBudget: config.thinkingBudget,
            useExtendedThinking: config.thinkingBudget > 0,
        };
    }

    /**
     * Get context editing rules
     */
    getContextEdits(): ContextEditRule[] {
        return this.config.contextEdits || DEFAULT_CONTEXT_EDITS;
    }

    /**
     * Build request parameters with OpenRouter-specific options
     * Supports December 2025 beta features
     */
    buildRequestParams(options: {
        model?: OpenRouterModel;
        maxTokens?: number;
        temperature?: number;
        effort?: EffortLevel;
        useExtendedThinking?: boolean;
        thinkingBudgetTokens?: number;
        phase?: string;  // Auto-configure from phase
        enableMemory?: boolean;  // Enable memory tool
        structuredOutput?: {
            schema: Record<string, unknown>;
            name: string;
        };
    }): Record<string, unknown> {
        // If phase is provided, get phase-specific configuration
        let model = options.model || this.config.defaultModel;
        let effort = options.effort;
        let thinkingBudget = options.thinkingBudgetTokens;
        let useThinking = options.useExtendedThinking;

        if (options.phase) {
            const phaseConfig = getPhaseConfig(options.phase);
            model = options.model || (phaseConfig.model as OpenRouterModel);
            effort = options.effort || phaseConfig.effort || 'medium';
            thinkingBudget = options.thinkingBudgetTokens || phaseConfig.thinkingBudget;
            useThinking = options.useExtendedThinking ?? (phaseConfig.thinkingBudget > 0);
        }

        const params: Record<string, unknown> = {
            model,
            max_tokens: options.maxTokens || 32000,
        };

        // Temperature (required to be 1 for extended thinking)
        if (useThinking) {
            params.temperature = 1;
        } else if (options.temperature !== undefined) {
            params.temperature = options.temperature;
        }

        // Extended thinking configuration
        if (useThinking && thinkingBudget && thinkingBudget > 0) {
            params.thinking = {
                type: 'enabled',
                budget_tokens: thinkingBudget,
            };
        }

        // Effort/Verbosity parameter for Opus 4.5
        // This is passed via provider-specific parameters in OpenRouter
        if (effort && model === OPENROUTER_MODELS.OPUS_4_5) {
            // OpenRouter uses 'verbosity' parameter
            params.provider = {
                anthropic: {
                    verbosity: effort,
                },
            };
        }

        // Memory tool configuration (beta feature)
        if (options.enableMemory && this.config.enableBetas) {
            params.memory = {
                enabled: true,
                memory_directory: '.claude/memory/',
            };
        }

        // Structured output (beta feature)
        if (options.structuredOutput && this.config.enableBetas) {
            params.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: options.structuredOutput.name,
                    schema: options.structuredOutput.schema,
                    strict: true,
                },
            };
        }

        return params;
    }

    /**
     * Build request parameters from a phase name
     * Convenience method for phase-based configuration
     */
    buildPhaseParams(phase: string, overrides?: {
        maxTokens?: number;
        enableMemory?: boolean;
    }): Record<string, unknown> {
        return this.buildRequestParams({
            phase,
            maxTokens: overrides?.maxTokens,
            enableMemory: overrides?.enableMemory,
        });
    }

    /**
     * Get recommended model for a task type
     */
    getModelForTask(taskType:
        | 'planning'
        | 'architecture'
        | 'critical'
        | 'coding'
        | 'testing'
        | 'simple'
        | 'bulk'
    ): { model: OpenRouterModel; effort?: EffortLevel; useThinking: boolean } {
        switch (taskType) {
            case 'planning':
            case 'architecture':
            case 'critical':
                // Use Opus 4.5 with high effort for critical tasks
                return {
                    model: OPENROUTER_MODELS.OPUS_4_5,
                    effort: 'high',
                    useThinking: true,
                };

            case 'coding':
            case 'testing':
                // Use Sonnet 4.5 with extended thinking for main coding
                return {
                    model: OPENROUTER_MODELS.SONNET_4_5,
                    useThinking: true,
                };

            case 'simple':
                // Use Haiku for simple, fast tasks
                return {
                    model: OPENROUTER_MODELS.HAIKU_3_5,
                    useThinking: false,
                };

            case 'bulk':
                // Use DeepSeek for cost-effective bulk operations
                return {
                    model: OPENROUTER_MODELS.DEEPSEEK_V3,
                    useThinking: false,
                };

            default:
                return {
                    model: OPENROUTER_MODELS.SONNET_4_5,
                    useThinking: true,
                };
        }
    }

    /**
     * Get model info
     */
    getModelInfo(model: OpenRouterModel): {
        contextWindow: number;
        maxOutput: number;
        supportsThinking: boolean;
        supportsEffort: boolean;
        supports1MContext: boolean;
        costPer1MInput: number;
        costPer1MOutput: number;
    } {
        const modelInfo: Record<string, {
            contextWindow: number;
            maxOutput: number;
            supportsThinking: boolean;
            supportsEffort: boolean;
            supports1MContext: boolean;
            costPer1MInput: number;
            costPer1MOutput: number;
        }> = {
            [OPENROUTER_MODELS.OPUS_4_5]: {
                contextWindow: 200000,
                maxOutput: 64000,
                supportsThinking: true,
                supportsEffort: true,
                supports1MContext: false,
                costPer1MInput: 5,
                costPer1MOutput: 25,
            },
            [OPENROUTER_MODELS.SONNET_4_5]: {
                contextWindow: 200000,  // 1M with beta flag
                maxOutput: 64000,
                supportsThinking: true,
                supportsEffort: false,
                supports1MContext: true,  // With CONTEXT_1M beta
                costPer1MInput: 3,
                costPer1MOutput: 15,
            },
            [OPENROUTER_MODELS.SONNET_4]: {
                contextWindow: 200000,
                maxOutput: 64000,
                supportsThinking: true,
                supportsEffort: false,
                supports1MContext: false,
                costPer1MInput: 3,
                costPer1MOutput: 15,
            },
            [OPENROUTER_MODELS.HAIKU_3_5]: {
                contextWindow: 200000,
                maxOutput: 8192,
                supportsThinking: false,
                supportsEffort: false,
                supports1MContext: false,
                costPer1MInput: 0.8,
                costPer1MOutput: 4,
            },
            [OPENROUTER_MODELS.DEEPSEEK_V3]: {
                contextWindow: 64000,
                maxOutput: 8192,
                supportsThinking: false,
                supportsEffort: false,
                supports1MContext: false,
                costPer1MInput: 0.14,
                costPer1MOutput: 0.28,
            },
            [OPENROUTER_MODELS.GPT_4O]: {
                contextWindow: 128000,
                maxOutput: 16384,
                supportsThinking: false,
                supportsEffort: false,
                supports1MContext: false,
                costPer1MInput: 2.5,
                costPer1MOutput: 10,
            },
            [OPENROUTER_MODELS.GEMINI_2_FLASH]: {
                contextWindow: 1000000,  // 1M native
                maxOutput: 8192,
                supportsThinking: true,
                supportsEffort: false,
                supports1MContext: true,
                costPer1MInput: 1.25,
                costPer1MOutput: 5,
            },
        };

        return modelInfo[model] || modelInfo[OPENROUTER_MODELS.SONNET_4_5];
    }

    /**
     * Check if beta features are enabled
     */
    areBetasEnabled(): boolean {
        return this.config.enableBetas ?? false;
    }

    /**
     * Get enabled beta features
     */
    getEnabledBetas(): string[] {
        if (!this.config.enableBetas || !this.config.betaFeatures) {
            return [];
        }
        return this.config.betaFeatures.map(f => OPENROUTER_BETAS[f]);
    }
}

// Singleton instance
let openRouterInstance: OpenRouterClient | null = null;

export function getOpenRouterClient(config?: Partial<OpenRouterConfig>): OpenRouterClient {
    if (!openRouterInstance) {
        openRouterInstance = new OpenRouterClient(config);
    }
    return openRouterInstance;
}

export function resetOpenRouterClient(): void {
    openRouterInstance = null;
}

// Re-export for backwards compatibility with code expecting helicone-client
export const getHeliconeClient = getOpenRouterClient;
export const resetHeliconeClient = resetOpenRouterClient;
export { OpenRouterClient as HeliconeClient };

