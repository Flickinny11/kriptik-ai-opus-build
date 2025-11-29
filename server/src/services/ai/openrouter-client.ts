/**
 * OpenRouter AI Client
 *
 * Primary AI client for KripTik AI using OpenRouter's API.
 * OpenRouter provides access to Claude models with full capabilities:
 * - Extended thinking
 * - Effort/Verbosity parameter (low/medium/high)
 * - Tool calls
 * - 200K context
 * - Parallel agent execution support
 *
 * Uses the Anthropic SDK pointed at OpenRouter's Anthropic-compatible endpoint.
 */

import { Anthropic } from '@anthropic-ai/sdk';

// OpenRouter model IDs
export const OPENROUTER_MODELS = {
    // Claude Opus 4.5 - For critical tasks, infrastructure, deep analysis
    // Supports effort/verbosity parameter
    OPUS_4_5: 'anthropic/claude-opus-4.5',

    // Claude Sonnet 4.5 - Main coding model, extended thinking
    SONNET_4_5: 'anthropic/claude-sonnet-4.5',

    // Claude Sonnet 4 - Standard tasks
    SONNET_4: 'anthropic/claude-sonnet-4',

    // Claude Haiku 3.5 - Fast, cost-effective for simple tasks
    HAIKU_3_5: 'anthropic/claude-3.5-haiku',

    // DeepSeek V3 - Cost-effective for bulk operations
    DEEPSEEK_V3: 'deepseek/deepseek-chat-v3-0324',

    // GPT-4o - Alternative for certain tasks
    GPT_4O: 'openai/gpt-4o',
} as const;

export type OpenRouterModel = typeof OPENROUTER_MODELS[keyof typeof OPENROUTER_MODELS];

// Effort levels for Opus 4.5 (maps to OpenRouter's verbosity parameter)
export type EffortLevel = 'low' | 'medium' | 'high';

export interface OpenRouterConfig {
    apiKey: string;
    defaultModel?: OpenRouterModel;
    siteUrl?: string;
    siteName?: string;
}

export interface RequestContext {
    userId?: string;
    projectId?: string;
    agentType?: string;
    sessionId?: string;
    feature?: string;
}

/**
 * OpenRouter client that uses Anthropic SDK
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
        };

        // Initialize Anthropic SDK pointing to OpenRouter
        this.client = new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': this.config.siteUrl!,
                'X-Title': this.config.siteName!,
            },
        });

        console.log('[OpenRouterClient] Initialized with OpenRouter API');
    }

    /**
     * Get the underlying Anthropic client
     */
    getClient(): Anthropic {
        return this.client;
    }

    /**
     * Create a client instance with request-specific headers
     */
    withContext(context: RequestContext): Anthropic {
        const headers: Record<string, string> = {
            'HTTP-Referer': this.config.siteUrl!,
            'X-Title': this.config.siteName!,
        };

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

        return new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: headers,
        });
    }

    /**
     * Build request parameters with OpenRouter-specific options
     */
    buildRequestParams(options: {
        model?: OpenRouterModel;
        maxTokens?: number;
        temperature?: number;
        effort?: EffortLevel;
        useExtendedThinking?: boolean;
        thinkingBudgetTokens?: number;
    }): Record<string, unknown> {
        const params: Record<string, unknown> = {
            model: options.model || this.config.defaultModel,
            max_tokens: options.maxTokens || 32000,
        };

        // Temperature (required to be 1 for extended thinking)
        if (options.useExtendedThinking) {
            params.temperature = 1;
        } else if (options.temperature !== undefined) {
            params.temperature = options.temperature;
        }

        // Extended thinking configuration
        if (options.useExtendedThinking) {
            params.thinking = {
                type: 'enabled',
                budget_tokens: options.thinkingBudgetTokens || 16000,
            };
        }

        // Effort/Verbosity parameter for Opus 4.5
        // This is passed via provider-specific parameters in OpenRouter
        if (options.effort && options.model === OPENROUTER_MODELS.OPUS_4_5) {
            // OpenRouter uses 'verbosity' parameter
            params.provider = {
                anthropic: {
                    verbosity: options.effort,
                },
            };
        }

        return params;
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
        costPer1MInput: number;
        costPer1MOutput: number;
    } {
        const modelInfo: Record<string, {
            contextWindow: number;
            maxOutput: number;
            supportsThinking: boolean;
            supportsEffort: boolean;
            costPer1MInput: number;
            costPer1MOutput: number;
        }> = {
            [OPENROUTER_MODELS.OPUS_4_5]: {
                contextWindow: 200000,
                maxOutput: 64000,
                supportsThinking: true,
                supportsEffort: true,
                costPer1MInput: 5,
                costPer1MOutput: 25,
            },
            [OPENROUTER_MODELS.SONNET_4_5]: {
                contextWindow: 200000,
                maxOutput: 64000,
                supportsThinking: true,
                supportsEffort: false,
                costPer1MInput: 3,
                costPer1MOutput: 15,
            },
            [OPENROUTER_MODELS.SONNET_4]: {
                contextWindow: 200000,
                maxOutput: 64000,
                supportsThinking: true,
                supportsEffort: false,
                costPer1MInput: 3,
                costPer1MOutput: 15,
            },
            [OPENROUTER_MODELS.HAIKU_3_5]: {
                contextWindow: 200000,
                maxOutput: 8192,
                supportsThinking: false,
                supportsEffort: false,
                costPer1MInput: 0.8,
                costPer1MOutput: 4,
            },
            [OPENROUTER_MODELS.DEEPSEEK_V3]: {
                contextWindow: 64000,
                maxOutput: 8192,
                supportsThinking: false,
                supportsEffort: false,
                costPer1MInput: 0.14,
                costPer1MOutput: 0.28,
            },
            [OPENROUTER_MODELS.GPT_4O]: {
                contextWindow: 128000,
                maxOutput: 16384,
                supportsThinking: false,
                supportsEffort: false,
                costPer1MInput: 2.5,
                costPer1MOutput: 10,
            },
        };

        return modelInfo[model] || modelInfo[OPENROUTER_MODELS.SONNET_4_5];
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

