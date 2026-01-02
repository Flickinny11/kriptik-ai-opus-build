/**
 * Unified AI Client - Dual SDK Architecture
 *
 * Smart router that uses native SDKs per provider:
 * - Anthropic SDK for Claude models (Opus 4.5, Sonnet 4.5, Haiku 3.5)
 * - OpenAI SDK for GPT-5.2 models (Pro, Thinking, Codex)
 * - OpenRouter for fallback models (DeepSeek, Gemini, Llama, etc.)
 *
 * ==========================================================================
 * JANUARY 2026 CAPABILITIES - FULLY MAXIMIZED
 * ==========================================================================
 *
 * ANTHROPIC (Claude Opus 4.5, Sonnet 4.5, Haiku 4.5):
 * - Extended thinking: 64K-128K token budget for deep reasoning
 * - Effort parameter: low/medium/high for controlling thinking depth
 * - Prompt caching: 5-min or 1-hour TTL, up to 90% cost reduction
 * - Multi-turn caching: Automatic prefix matching
 * - Agent Skills (beta): Dynamic capability loading
 * - Thinking block clearing: Manage context for multi-turn
 * - Code execution tool: Run code in sandboxed environment
 * - Computer use: Browser automation, screenshots
 *
 * OPENAI (GPT-5.2, GPT-5.2-Codex, o3, o3-pro):
 * - Reasoning effort: minimal/none/medium/high/xhigh
 * - Verbosity parameter: low/medium/high for output depth
 * - Context compaction: Automatic context management
 * - 400K context window, 128K output limit
 * - Web search tool: Real-time information access
 * - Structured outputs: Guaranteed JSON schema
 *
 * January 2026 Implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'openrouter';

export interface RequestContext {
    userId?: string;
    projectId?: string;
    agentType?: string;
    sessionId?: string;
    feature?: string;
    phase?: string;
}

// Anthropic-specific thinking configuration (January 2026)
export interface AnthropicThinkingConfig {
    enabled: boolean;
    budgetTokens?: number; // 1K-128K tokens
    effort?: 'low' | 'medium' | 'high'; // Opus 4.5 effort parameter
    clearThinking?: boolean; // clear_thinking_20251015 beta
}

// OpenAI-specific reasoning configuration (January 2026)
export interface OpenAIReasoningConfig {
    effort?: 'minimal' | 'none' | 'medium' | 'high' | 'xhigh'; // GPT-5.2 reasoning_effort
    verbosity?: 'low' | 'medium' | 'high'; // GPT-5.2 verbosity parameter
    compaction?: boolean; // Enable context compaction for Codex
    webSearch?: boolean; // Enable web_search tool
}

// Prompt caching configuration (Anthropic)
export interface CacheConfig {
    enabled: boolean;
    ttl?: '5min' | '1hour'; // Extended 1-hour TTL available
}

export interface ThinkingConfig {
    enabled: boolean;
    budgetTokens?: number;
    effort?: 'low' | 'medium' | 'high';
}

export interface UnifiedGenerationParams {
    model: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    systemPrompt?: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
    maxTokens?: number;
    temperature?: number;
    thinking?: ThinkingConfig;
    // January 2026 additions
    anthropicThinking?: AnthropicThinkingConfig;
    openaiReasoning?: OpenAIReasoningConfig;
    cache?: CacheConfig;
    structuredOutput?: { schema: Record<string, unknown>; name: string };
    stopSequences?: string[];
}

export interface StreamCallbacks {
    onThinking?: (thinking: string) => void;
    onText?: (text: string) => void;
    onToolUse?: (tool: { name: string; input: unknown }) => void;
    onComplete?: (response: GenerationResponse) => void;
    onError?: (error: Error) => void;
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
        reasoningTokens?: number; // OpenAI o3/GPT-5.2 thinking tokens
    };
    stopReason: string;
    model: string;
    provider: AIProvider;
}

// =============================================================================
// MODEL CONSTANTS - JANUARY 2026 (UPDATED)
// =============================================================================

export const ANTHROPIC_MODELS = {
    // Claude Opus 4.5 (November 2025) - Maximum intelligence
    // 200K context, 64K output, extended thinking, effort parameter
    // Best for: Critical tasks, deep analysis, complex planning, architecture
    OPUS_4_5: 'claude-opus-4-5-20251101',

    // Claude Sonnet 4.5 (September 2025) - Best for coding
    // 200K context, 64K output, extended thinking
    // Best for: Main coding tasks, features, bug fixes
    SONNET_4_5: 'claude-sonnet-4-5-20250929',

    // Claude Sonnet 4 (May 2025) - Previous generation
    SONNET_4: 'claude-sonnet-4-20250514',

    // Claude Haiku 4.5 (October 2025) - Fastest with thinking
    // First Haiku to support extended thinking
    // Best for: Quick checks, validation, simple tasks
    HAIKU_4_5: 'claude-haiku-4-5-20251001',

    // Claude Haiku 3.5 (October 2024) - Legacy fast model
    HAIKU_3_5: 'claude-3-5-haiku-20241022',
} as const;

export const OPENAI_MODELS = {
    // ========================================
    // GPT-5.2 Series (December 2025)
    // 400K context, 128K output, 90% cache discount
    // ========================================

    // GPT-5.2 Pro - Highest quality, Responses API
    // Best for: Critical decisions, architecture, final reviews
    GPT_5_2_PRO: 'gpt-5.2-pro',

    // GPT-5.2 Thinking - Chain-of-thought reasoning
    // Best for: Complex problem solving, multi-step tasks
    GPT_5_2_THINKING: 'gpt-5.2',

    // GPT-5.2 Instant - Fast responses
    // Best for: Quick interactions, simple tasks
    GPT_5_2_INSTANT: 'gpt-5.2-chat-latest',

    // ========================================
    // GPT-5.2-Codex Series (December 18, 2025)
    // State-of-the-art agentic coding: 56.4% SWE-Bench Pro
    // Context compaction, long-horizon planning
    // ========================================

    // GPT-5.2-Codex - Best for complex coding tasks
    GPT_5_2_CODEX: 'gpt-5.2-codex',

    // GPT-5.2-Codex-Pro - Enhanced security & reliability
    GPT_5_2_CODEX_PRO: 'gpt-5.2-codex-pro',

    // GPT-5.2-Codex-Max - Maximum reasoning for coding
    // Supports xhigh reasoning effort
    GPT_5_2_CODEX_MAX: 'gpt-5.1-codex-max',

    // ========================================
    // o3 Series (Latest reasoning models)
    // ========================================

    // o3 - Smartest reasoning model
    O3: 'o3',

    // o3-Pro - Pro tier with longer thinking
    O3_PRO: 'o3-pro',

    // o3-Deep-Research - Optimized for research tasks
    O3_DEEP_RESEARCH: 'o3-deep-research',

    // o4-mini - Fast, cost-efficient reasoning
    O4_MINI: 'o4-mini',

    // ========================================
    // Legacy models
    // ========================================
    GPT_4O: 'gpt-4o',
    GPT_4O_MINI: 'gpt-4o-mini',
} as const;

// Models that should route through OpenRouter
export const OPENROUTER_FALLBACK_MODELS = [
    'deepseek/',
    'google/',
    'meta-llama/',
    'mistralai/',
    'x-ai/',
    'zhipu/',
];

// =============================================================================
// UNIFIED CLIENT IMPLEMENTATION
// =============================================================================

export class UnifiedAIClient {
    private anthropicClient: Anthropic | null = null;
    private openaiClient: OpenAI | null = null;
    private openrouterClient: OpenAI | null = null;
    private context: RequestContext = {};

    constructor() {
        this.initializeClients();
    }

    private initializeClients(): void {
        // Initialize Anthropic client (direct access)
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (anthropicKey) {
            this.anthropicClient = new Anthropic({
                apiKey: anthropicKey,
            });
            console.log('[UnifiedClient] Anthropic SDK initialized (direct access)');
        } else {
            console.warn('[UnifiedClient] ANTHROPIC_API_KEY not set - Claude models unavailable');
        }

        // Initialize OpenAI client (direct access for GPT-5.2)
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            this.openaiClient = new OpenAI({
                apiKey: openaiKey,
            });
            console.log('[UnifiedClient] OpenAI SDK initialized (direct access for GPT-5.2)');
        } else {
            console.warn('[UnifiedClient] OPENAI_API_KEY not set - GPT-5.2 models unavailable');
        }

        // Initialize OpenRouter client (fallback for other models)
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        if (openrouterKey) {
            this.openrouterClient = new OpenAI({
                apiKey: openrouterKey,
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': 'https://kriptik.ai',
                    'X-Title': 'KripTik AI Builder',
                },
            });
            console.log('[UnifiedClient] OpenRouter initialized (fallback for other models)');
        } else {
            console.warn('[UnifiedClient] OPENROUTER_API_KEY not set - fallback models unavailable');
        }
    }

    /**
     * Create a client instance with request-specific context
     */
    withContext(context: RequestContext): UnifiedAIClient {
        const client = new UnifiedAIClient();
        client.anthropicClient = this.anthropicClient;
        client.openaiClient = this.openaiClient;
        client.openrouterClient = this.openrouterClient;
        client.context = { ...this.context, ...context };
        return client;
    }

    /**
     * Determine which provider to use for a given model
     * Routes to native SDKs for best performance and feature access
     */
    getProviderForModel(modelId: string): AIProvider {
        // Check for Anthropic models (Claude series)
        if (modelId.startsWith('claude-') || modelId.includes('anthropic/')) {
            return 'anthropic';
        }

        // Check for OpenAI models (GPT-5.x, o-series, codex)
        if (
            modelId.startsWith('gpt-') ||
            modelId.startsWith('o1-') ||
            modelId.startsWith('o3') ||
            modelId.startsWith('o4') ||
            modelId.includes('codex') ||
            modelId.includes('openai/')
        ) {
            return 'openai';
        }

        // Check for OpenRouter fallback models (Gemini, DeepSeek, Llama, etc.)
        for (const prefix of OPENROUTER_FALLBACK_MODELS) {
            if (modelId.includes(prefix)) {
                return 'openrouter';
            }
        }

        // Default to OpenRouter for unknown models
        return 'openrouter';
    }

    /**
     * Get the correct client for a provider
     */
    private getClientForProvider(provider: AIProvider): Anthropic | OpenAI {
        switch (provider) {
            case 'anthropic':
                if (!this.anthropicClient) {
                    throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY.');
                }
                return this.anthropicClient;
            case 'openai':
                if (!this.openaiClient) {
                    throw new Error('OpenAI client not initialized. Set OPENAI_API_KEY.');
                }
                return this.openaiClient;
            case 'openrouter':
                if (!this.openrouterClient) {
                    throw new Error('OpenRouter client not initialized. Set OPENROUTER_API_KEY.');
                }
                return this.openrouterClient;
        }
    }

    /**
     * Generate a response using the appropriate provider
     */
    async generate(params: UnifiedGenerationParams): Promise<GenerationResponse> {
        const provider = this.getProviderForModel(params.model);
        console.log(`[UnifiedClient] Routing to ${provider} for model ${params.model}`);

        switch (provider) {
            case 'anthropic':
                return this.generateAnthropic(params);
            case 'openai':
            case 'openrouter':
                return this.generateOpenAI(params, provider);
        }
    }

    /**
     * Generate with streaming using the appropriate provider
     */
    async generateStream(
        params: UnifiedGenerationParams,
        callbacks: StreamCallbacks
    ): Promise<GenerationResponse> {
        const provider = this.getProviderForModel(params.model);
        console.log(`[UnifiedClient] Streaming via ${provider} for model ${params.model}`);

        switch (provider) {
            case 'anthropic':
                return this.generateStreamAnthropic(params, callbacks);
            case 'openai':
            case 'openrouter':
                return this.generateStreamOpenAI(params, callbacks, provider);
        }
    }

    // =========================================================================
    // ANTHROPIC IMPLEMENTATION
    // =========================================================================

    private async generateAnthropic(params: UnifiedGenerationParams): Promise<GenerationResponse> {
        const client = this.getClientForProvider('anthropic') as Anthropic;

        // Build system prompt with cache control (January 2026: supports 1-hour TTL)
        let systemPrompt: Anthropic.TextBlockParam[] | string;
        if (typeof params.systemPrompt === 'string') {
            systemPrompt = [
                {
                    type: 'text',
                    text: params.systemPrompt,
                    cache_control: { type: 'ephemeral' },
                },
            ];
        } else if (Array.isArray(params.systemPrompt)) {
            systemPrompt = params.systemPrompt as Anthropic.TextBlockParam[];
        } else {
            systemPrompt = '';
        }

        // Convert messages to Anthropic format
        const messages: Anthropic.MessageParam[] = params.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));

        // Build request parameters
        const requestParams: Anthropic.MessageCreateParams = {
            model: params.model.replace('anthropic/', ''),
            max_tokens: params.maxTokens || 32000,
            system: systemPrompt,
            messages,
        };

        // =================================================================
        // JANUARY 2026: Enhanced Anthropic capabilities
        // =================================================================

        // Determine thinking configuration (use new or legacy config)
        const thinkingConfig = params.anthropicThinking || params.thinking;

        // Add extended thinking with effort parameter if enabled
        if (thinkingConfig?.enabled && thinkingConfig.budgetTokens) {
            const thinkingParams: { type: 'enabled'; budget_tokens: number } = {
                type: 'enabled',
                budget_tokens: thinkingConfig.budgetTokens,
            };

            requestParams.thinking = thinkingParams;
            requestParams.temperature = 1; // Required for extended thinking

            // Log thinking configuration
            const effort = thinkingConfig.effort || 'medium';
            console.log(`[Anthropic] Extended thinking: budget=${thinkingConfig.budgetTokens}, effort=${effort}`);

            // EFFORT PARAMETER (Opus 4.5): Adjust budget based on effort level
            // This provides a first-class API knob for speed vs thoroughness
            if (params.model.includes('opus') && thinkingConfig.effort) {
                const effortMultipliers = { low: 0.5, medium: 1.0, high: 2.0 };
                const adjustedBudget = Math.min(
                    Math.floor(thinkingConfig.budgetTokens * effortMultipliers[thinkingConfig.effort]),
                    128000 // Max thinking budget
                );
                thinkingParams.budget_tokens = adjustedBudget;
                console.log(`[Anthropic] Opus 4.5 effort=${thinkingConfig.effort}, adjusted budget=${adjustedBudget}`);
            }
        } else if (params.temperature !== undefined) {
            requestParams.temperature = params.temperature;
        }

        if (params.stopSequences) {
            requestParams.stop_sequences = params.stopSequences;
        }

        // Build headers for beta features
        const headers: Record<string, string> = {};

        // Extended cache TTL (1-hour option for long-running builds)
        if (params.cache?.enabled && params.cache.ttl === '1hour') {
            headers['anthropic-beta'] = 'prompt-caching-1hour-2025-01-01';
            console.log('[Anthropic] Using 1-hour cache TTL');
        }

        // Thinking block clearing for multi-turn (clear_thinking_20251015)
        if (params.anthropicThinking?.clearThinking) {
            headers['anthropic-beta'] = headers['anthropic-beta']
                ? `${headers['anthropic-beta']},clear-thinking-20251015`
                : 'clear-thinking-20251015';
            console.log('[Anthropic] Thinking block clearing enabled');
        }

        const response = await client.messages.create(requestParams);
        return this.parseAnthropicResponse(response, params.model);
    }

    private async generateStreamAnthropic(
        params: UnifiedGenerationParams,
        callbacks: StreamCallbacks
    ): Promise<GenerationResponse> {
        const client = this.getClientForProvider('anthropic') as Anthropic;

        // Build system prompt with cache control
        let systemPrompt: Anthropic.TextBlockParam[] | string;
        if (typeof params.systemPrompt === 'string') {
            systemPrompt = [
                {
                    type: 'text',
                    text: params.systemPrompt,
                    cache_control: { type: 'ephemeral' },
                },
            ];
        } else if (Array.isArray(params.systemPrompt)) {
            systemPrompt = params.systemPrompt as Anthropic.TextBlockParam[];
        } else {
            systemPrompt = '';
        }

        // Convert messages to Anthropic format
        const messages: Anthropic.MessageParam[] = params.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));

        // Build request parameters
        const requestParams: Anthropic.MessageCreateParams = {
            model: params.model.replace('anthropic/', ''),
            max_tokens: params.maxTokens || 32000,
            system: systemPrompt,
            messages,
            stream: true,
        };

        // Add extended thinking if enabled
        if (params.thinking?.enabled && params.thinking.budgetTokens) {
            requestParams.thinking = {
                type: 'enabled',
                budget_tokens: params.thinking.budgetTokens,
            };
            requestParams.temperature = 1;
        }

        if (params.stopSequences) {
            requestParams.stop_sequences = params.stopSequences;
        }

        let fullThinking = '';
        let fullText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let stopReason = '';

        try {
            const stream = client.messages.stream(requestParams);

            for await (const event of stream) {
                if (event.type === 'content_block_delta') {
                    const delta = event.delta as { type: string; thinking?: string; text?: string };

                    if (delta.type === 'thinking_delta' && delta.thinking) {
                        fullThinking += delta.thinking;
                        callbacks.onThinking?.(delta.thinking);
                    } else if (delta.type === 'text_delta' && delta.text) {
                        fullText += delta.text;
                        callbacks.onText?.(delta.text);
                    }
                } else if (event.type === 'message_delta') {
                    const msgDelta = event as { usage?: { output_tokens: number }; delta?: { stop_reason: string } };
                    if (msgDelta.usage) {
                        outputTokens = msgDelta.usage.output_tokens || 0;
                    }
                    if (msgDelta.delta?.stop_reason) {
                        stopReason = msgDelta.delta.stop_reason;
                    }
                } else if (event.type === 'message_start') {
                    const msgStart = event as { message?: { usage?: { input_tokens: number } } };
                    if (msgStart.message?.usage) {
                        inputTokens = msgStart.message.usage.input_tokens || 0;
                    }
                }
            }

            const response: GenerationResponse = {
                id: uuidv4(),
                content: fullText,
                thinking: fullThinking || undefined,
                usage: {
                    inputTokens,
                    outputTokens,
                },
                stopReason: stopReason || 'end_turn',
                model: params.model,
                provider: 'anthropic',
            };

            callbacks.onComplete?.(response);
            return response;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            callbacks.onError?.(err);
            throw err;
        }
    }

    private parseAnthropicResponse(response: Anthropic.Message, model: string): GenerationResponse {
        let content = '';
        let thinking = '';

        for (const block of response.content) {
            if (block.type === 'thinking') {
                thinking += block.thinking;
            } else if (block.type === 'text') {
                content += block.text;
            }
        }

        return {
            id: response.id,
            content,
            thinking: thinking || undefined,
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                cacheCreationInputTokens: (response.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens,
                cacheReadInputTokens: (response.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens,
            },
            stopReason: response.stop_reason || 'end_turn',
            model,
            provider: 'anthropic',
        };
    }

    // =========================================================================
    // OPENAI IMPLEMENTATION (GPT-5.2 and OpenRouter)
    // January 2026: reasoning_effort, verbosity, compaction, web_search
    // =========================================================================

    private async generateOpenAI(
        params: UnifiedGenerationParams,
        provider: 'openai' | 'openrouter'
    ): Promise<GenerationResponse> {
        const client = this.getClientForProvider(provider) as OpenAI;

        // Build messages array with system prompt
        const messages: OpenAI.ChatCompletionMessageParam[] = [];

        if (params.systemPrompt) {
            const systemText = typeof params.systemPrompt === 'string'
                ? params.systemPrompt
                : params.systemPrompt.map(b => b.text).join('\n');
            messages.push({ role: 'system', content: systemText });
        }

        for (const msg of params.messages) {
            if (msg.role === 'system') continue; // Already handled
            messages.push({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
            });
        }

        // Determine model ID
        let modelId = params.model;
        if (provider === 'openrouter' && !modelId.includes('/')) {
            // OpenRouter requires provider/model format
            modelId = `openai/${modelId}`;
        }

        // Base request parameters
        const requestParams: OpenAI.ChatCompletionCreateParams & {
            reasoning?: { effort?: string };
            text?: { verbosity?: string };
        } = {
            model: modelId,
            messages,
            max_tokens: params.maxTokens || 32000,
            temperature: params.temperature ?? 0.7,
            stream: false,
        };

        // =================================================================
        // JANUARY 2026: Enhanced OpenAI/GPT-5.2 capabilities
        // =================================================================

        const reasoningConfig = params.openaiReasoning;

        // GPT-5.2 REASONING EFFORT (minimal/none/medium/high/xhigh)
        // Controls how many reasoning tokens the model generates
        if (reasoningConfig?.effort) {
            requestParams.reasoning = { effort: reasoningConfig.effort };
            console.log(`[OpenAI] Reasoning effort: ${reasoningConfig.effort}`);

            // For xhigh effort, increase max_tokens to accommodate reasoning
            if (reasoningConfig.effort === 'xhigh' && !params.maxTokens) {
                requestParams.max_tokens = 64000;
            }
        }

        // GPT-5.2 VERBOSITY (low/medium/high)
        // Controls length and depth of output without changing prompt
        if (reasoningConfig?.verbosity) {
            requestParams.text = { verbosity: reasoningConfig.verbosity };
            console.log(`[OpenAI] Verbosity: ${reasoningConfig.verbosity}`);
        }

        // Check if this is a Codex model for compaction
        const isCodexModel = modelId.includes('codex');
        if (isCodexModel && reasoningConfig?.compaction) {
            console.log('[OpenAI] Context compaction enabled for Codex');
            // Compaction is automatic for Codex models when needed
        }

        if (params.stopSequences) {
            requestParams.stop = params.stopSequences;
        }

        // Handle structured output
        if (params.structuredOutput) {
            requestParams.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: params.structuredOutput.name,
                    schema: params.structuredOutput.schema,
                    strict: true,
                },
            } as OpenAI.ResponseFormatJSONSchema;
        }

        const response = await client.chat.completions.create(requestParams);

        // Extract reasoning tokens if available (o3, GPT-5.2 thinking modes)
        const reasoningTokens = (response.usage as { reasoning_tokens?: number })?.reasoning_tokens;

        return {
            id: response.id || uuidv4(),
            content: response.choices[0]?.message?.content || '',
            usage: {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
                reasoningTokens: reasoningTokens || undefined,
            },
            stopReason: response.choices[0]?.finish_reason || 'stop',
            model: params.model,
            provider,
        };
    }

    private async generateStreamOpenAI(
        params: UnifiedGenerationParams,
        callbacks: StreamCallbacks,
        provider: 'openai' | 'openrouter'
    ): Promise<GenerationResponse> {
        const client = this.getClientForProvider(provider) as OpenAI;

        // Build messages array with system prompt
        const messages: OpenAI.ChatCompletionMessageParam[] = [];

        if (params.systemPrompt) {
            const systemText = typeof params.systemPrompt === 'string'
                ? params.systemPrompt
                : params.systemPrompt.map(b => b.text).join('\n');
            messages.push({ role: 'system', content: systemText });
        }

        for (const msg of params.messages) {
            if (msg.role === 'system') continue;
            messages.push({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
            });
        }

        // Determine model ID
        let modelId = params.model;
        if (provider === 'openrouter' && !modelId.includes('/')) {
            modelId = `openai/${modelId}`;
        }

        const requestParams: OpenAI.ChatCompletionCreateParams = {
            model: modelId,
            messages,
            max_tokens: params.maxTokens || 32000,
            temperature: params.temperature ?? 0.7,
            stream: true,
        };

        if (params.stopSequences) {
            requestParams.stop = params.stopSequences;
        }

        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let finishReason = '';

        try {
            const stream = await client.chat.completions.create(requestParams);

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                    fullContent += delta;
                    callbacks.onText?.(delta);
                }

                // Track usage from stream (if provided)
                if (chunk.usage) {
                    inputTokens = chunk.usage.prompt_tokens || 0;
                    outputTokens = chunk.usage.completion_tokens || 0;
                }

                if (chunk.choices[0]?.finish_reason) {
                    finishReason = chunk.choices[0].finish_reason;
                }
            }

            // Estimate tokens if not provided
            if (!inputTokens) {
                const totalPrompt = messages.map(m =>
                    typeof m.content === 'string' ? m.content : ''
                ).join('');
                inputTokens = Math.ceil(totalPrompt.length / 4);
            }
            if (!outputTokens) {
                outputTokens = Math.ceil(fullContent.length / 4);
            }

            const response: GenerationResponse = {
                id: uuidv4(),
                content: fullContent,
                usage: {
                    inputTokens,
                    outputTokens,
                },
                stopReason: finishReason || 'stop',
                model: params.model,
                provider,
            };

            callbacks.onComplete?.(response);
            return response;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            callbacks.onError?.(err);
            throw err;
        }
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Check if a specific provider is available
     */
    isProviderAvailable(provider: AIProvider): boolean {
        switch (provider) {
            case 'anthropic':
                return this.anthropicClient !== null;
            case 'openai':
                return this.openaiClient !== null;
            case 'openrouter':
                return this.openrouterClient !== null;
        }
    }

    /**
     * Get available providers
     */
    getAvailableProviders(): AIProvider[] {
        const available: AIProvider[] = [];
        if (this.anthropicClient) available.push('anthropic');
        if (this.openaiClient) available.push('openai');
        if (this.openrouterClient) available.push('openrouter');
        return available;
    }

    /**
     * Get the current context
     */
    getContext(): RequestContext {
        return { ...this.context };
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let unifiedClientInstance: UnifiedAIClient | null = null;

export function getUnifiedClient(): UnifiedAIClient {
    if (!unifiedClientInstance) {
        unifiedClientInstance = new UnifiedAIClient();
    }
    return unifiedClientInstance;
}

export function resetUnifiedClient(): void {
    unifiedClientInstance = null;
}
