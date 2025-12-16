/**
 * Unified AI Client - Dual SDK Architecture
 *
 * Smart router that uses native SDKs per provider:
 * - Anthropic SDK for Claude models (Opus 4.5, Sonnet 4.5, Haiku 3.5)
 * - OpenAI SDK for GPT-5.2 models (Pro, Thinking, Instant)
 * - OpenRouter for fallback models (DeepSeek, Gemini, Llama, etc.)
 *
 * This preserves full capabilities of each provider:
 * - Anthropic: 64K thinking budget, precise cache control, effort parameter
 * - OpenAI GPT-5.2: 400K context, 128K output, native thinking mode
 * - OpenRouter: Access to 500+ models as fallback
 *
 * December 2025 Implementation
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
    };
    stopReason: string;
    model: string;
    provider: AIProvider;
}

// =============================================================================
// MODEL CONSTANTS
// =============================================================================

export const ANTHROPIC_MODELS = {
    // December 2025 model IDs (verified against Anthropic/OpenRouter)
    OPUS_4_5: 'claude-opus-4-5',          // Latest Opus 4.5
    SONNET_4_5: 'claude-sonnet-4-5',      // Latest Sonnet 4.5
    SONNET_4: 'claude-sonnet-4',          // Sonnet 4
    HAIKU_3_5: 'claude-3-5-haiku',        // Haiku 3.5
} as const;

export const OPENAI_MODELS = {
    GPT_5_2_PRO: 'gpt-5.2-pro',
    GPT_5_2_THINKING: 'gpt-5.2',
    GPT_5_2_INSTANT: 'gpt-5.2-chat-latest',
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
     */
    getProviderForModel(modelId: string): AIProvider {
        // Check for Anthropic models
        if (modelId.startsWith('claude-') || modelId.includes('anthropic/')) {
            return 'anthropic';
        }

        // Check for OpenAI/GPT-5.2 models
        if (modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.includes('openai/')) {
            return 'openai';
        }

        // Check for OpenRouter fallback models
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
        };

        // Add extended thinking if enabled
        if (params.thinking?.enabled && params.thinking.budgetTokens) {
            requestParams.thinking = {
                type: 'enabled',
                budget_tokens: params.thinking.budgetTokens,
            };
            requestParams.temperature = 1; // Required for extended thinking
            console.log(`[Anthropic] Extended thinking enabled (budget: ${params.thinking.budgetTokens})`);
        } else if (params.temperature !== undefined) {
            requestParams.temperature = params.temperature;
        }

        if (params.stopSequences) {
            requestParams.stop_sequences = params.stopSequences;
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

        const requestParams: OpenAI.ChatCompletionCreateParams = {
            model: modelId,
            messages,
            max_tokens: params.maxTokens || 32000,
            temperature: params.temperature ?? 0.7,
            stream: false,
        };

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

        return {
            id: response.id || uuidv4(),
            content: response.choices[0]?.message?.content || '',
            usage: {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
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
