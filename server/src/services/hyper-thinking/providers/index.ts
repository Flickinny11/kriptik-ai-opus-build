/**
 * Hyper-Thinking Provider Clients
 * 
 * Unified interfaces for reasoning providers:
 * - Anthropic: Direct SDK with extended thinking (budget_tokens, interleaved thinking)
 * - OpenAI: Direct SDK with reasoning effort (low/medium/high)
 * - OpenRouter: Fallback for Gemini, DeepSeek, Qwen with reasoning parameter
 */

import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  type ProviderType,
  type TokenUsage,
  type ReasoningStep,
  type StreamingEvent,
  type ModelConfig,
  type ExtendedThinkingConfig,
  HyperThinkingError,
} from '../types.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Common Types
// ============================================================================

export interface ReasoningRequest {
  /** The prompt to reason about */
  prompt: string;
  /** System instructions */
  systemPrompt?: string;
  /** Model configuration */
  model: ModelConfig;
  /** Thinking budget in tokens */
  thinkingBudget: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
  /** Enable streaming */
  stream?: boolean;
  /** Stop sequences */
  stopSequences?: string[];
  /** Previous context */
  previousContext?: string;
}

export interface ReasoningResponse {
  /** The reasoning output */
  content: string;
  /** Thinking/reasoning content (if available) */
  thinking?: string;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Latency in ms */
  latencyMs: number;
  /** Model used */
  model: string;
  /** Provider used */
  provider: ProviderType;
  /** Stop reason */
  stopReason?: string;
}

export interface StreamingReasoningResponse {
  /** Async generator of streaming events */
  stream: AsyncGenerator<StreamingEvent>;
  /** Promise that resolves to final response */
  response: Promise<ReasoningResponse>;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface ReasoningProvider {
  /** Provider type */
  readonly provider: ProviderType;
  
  /** Check if provider is available */
  isAvailable(): boolean;
  
  /** Execute reasoning request */
  reason(request: ReasoningRequest): Promise<ReasoningResponse>;
  
  /** Execute streaming reasoning request */
  reasonStream(request: ReasoningRequest): StreamingReasoningResponse;
  
  /** Health check */
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// Anthropic Provider
// ============================================================================

class AnthropicReasoningClient implements ReasoningProvider {
  readonly provider: ProviderType = 'anthropic';
  private client: Anthropic | null = null;
  
  constructor() {
    this.initializeClient();
  }
  
  private initializeClient(): void {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }
  
  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY && !!this.client;
  }
  
  async reason(request: ReasoningRequest): Promise<ReasoningResponse> {
    if (!this.client) {
      throw new HyperThinkingError('MODEL_UNAVAILABLE', 'Anthropic client not available');
    }
    
    const startTime = Date.now();
    
    // Build messages
    const messages: Anthropic.MessageParam[] = [];
    
    if (request.previousContext) {
      messages.push({
        role: 'user',
        content: `Previous context:\n${request.previousContext}`,
      });
      messages.push({
        role: 'assistant',
        content: 'I understand the context. Please continue.',
      });
    }
    
    messages.push({
      role: 'user',
      content: request.prompt,
    });
    
    // Build request with extended thinking
    const response = await this.client.messages.create({
      model: request.model.modelId,
      max_tokens: request.maxOutputTokens || 8192,
      system: request.systemPrompt || 'You are an expert reasoning assistant. Think deeply and systematically.',
      messages,
      temperature: request.temperature,
      // Extended thinking configuration
      thinking: {
        type: 'enabled',
        budget_tokens: request.thinkingBudget,
      },
    } as Anthropic.MessageCreateParamsNonStreaming);
    
    const latencyMs = Date.now() - startTime;
    
    // Extract content and thinking
    let content = '';
    let thinking = '';
    
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'thinking') {
        thinking += (block as unknown as { thinking: string }).thinking || '';
      }
    }
    
    // Build token usage
    const tokenUsage: TokenUsage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      thinkingTokens: (response.usage as unknown as { thinking_tokens?: number }).thinking_tokens || 0,
      cacheReadTokens: (response.usage as unknown as { cache_read_input_tokens?: number }).cache_read_input_tokens,
      cacheWriteTokens: (response.usage as unknown as { cache_creation_input_tokens?: number }).cache_creation_input_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };
    
    return {
      content,
      thinking,
      tokenUsage,
      latencyMs,
      model: request.model.modelId,
      provider: this.provider,
      stopReason: response.stop_reason || undefined,
    };
  }
  
  reasonStream(request: ReasoningRequest): StreamingReasoningResponse {
    if (!this.client) {
      throw new HyperThinkingError('MODEL_UNAVAILABLE', 'Anthropic client not available');
    }
    
    const self = this;
    let resolveResponse: (response: ReasoningResponse) => void;
    let rejectResponse: (error: Error) => void;
    
    const responsePromise = new Promise<ReasoningResponse>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    
    const streamGenerator = async function* (): AsyncGenerator<StreamingEvent> {
      const startTime = Date.now();
      let content = '';
      let thinking = '';
      let tokenUsage: TokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
      };
      
      try {
        // Build messages
        const messages: Anthropic.MessageParam[] = [];
        
        if (request.previousContext) {
          messages.push({
            role: 'user',
            content: `Previous context:\n${request.previousContext}`,
          });
          messages.push({
            role: 'assistant',
            content: 'I understand the context. Please continue.',
          });
        }
        
        messages.push({
          role: 'user',
          content: request.prompt,
        });
        
        // Create streaming request
        const stream = await self.client!.messages.stream({
          model: request.model.modelId,
          max_tokens: request.maxOutputTokens || 8192,
          system: request.systemPrompt || 'You are an expert reasoning assistant.',
          messages,
          temperature: request.temperature,
          thinking: {
            type: 'enabled',
            budget_tokens: request.thinkingBudget,
          },
        } as Anthropic.MessageStreamParams);
        
        yield {
          type: 'thinking_start',
          content: 'Starting reasoning...',
          metadata: {},
          timestamp: new Date(),
        };
        
        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if ('text' in delta) {
              content += delta.text;
              yield {
                type: 'thinking_step',
                content: delta.text,
                metadata: { progress: 0.5 },
                timestamp: new Date(),
              };
            } else if ('thinking' in delta) {
              thinking += (delta as unknown as { thinking: string }).thinking;
              yield {
                type: 'thinking_step',
                content: (delta as unknown as { thinking: string }).thinking,
                metadata: { depth: 1 },
                timestamp: new Date(),
              };
            }
          } else if (event.type === 'message_delta') {
            if ('usage' in event) {
              tokenUsage = {
                promptTokens: (event.usage as unknown as { input_tokens?: number }).input_tokens || 0,
                completionTokens: event.usage.output_tokens || 0,
                thinkingTokens: 0,
                totalTokens: ((event.usage as unknown as { input_tokens?: number }).input_tokens || 0) + (event.usage.output_tokens || 0),
              };
            }
          }
        }
        
        const latencyMs = Date.now() - startTime;
        
        yield {
          type: 'thinking_complete',
          content: 'Reasoning complete.',
          metadata: { tokensUsed: tokenUsage.totalTokens },
          timestamp: new Date(),
        };
        
        resolveResponse({
          content,
          thinking,
          tokenUsage,
          latencyMs,
          model: request.model.modelId,
          provider: self.provider,
        });
      } catch (error) {
        yield {
          type: 'error',
          content: error instanceof Error ? error.message : 'Unknown error',
          metadata: {},
          timestamp: new Date(),
        };
        rejectResponse(error instanceof Error ? error : new Error('Unknown error'));
      }
    };
    
    return {
      stream: streamGenerator(),
      response: responsePromise,
    };
  }
  
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      // Simple health check with minimal token usage
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// OpenAI Provider
// ============================================================================

class OpenAIReasoningClient implements ReasoningProvider {
  readonly provider: ProviderType = 'openai';
  private client: OpenAI | null = null;
  
  constructor() {
    this.initializeClient();
  }
  
  private initializeClient(): void {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  
  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY && !!this.client;
  }
  
  private getReasoningEffort(thinkingBudget: number): 'low' | 'medium' | 'high' {
    if (thinkingBudget >= 64000) return 'high';
    if (thinkingBudget >= 32000) return 'medium';
    return 'low';
  }
  
  async reason(request: ReasoningRequest): Promise<ReasoningResponse> {
    if (!this.client) {
      throw new HyperThinkingError('MODEL_UNAVAILABLE', 'OpenAI client not available');
    }
    
    const startTime = Date.now();
    
    // Build messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }
    
    if (request.previousContext) {
      messages.push({
        role: 'user',
        content: `Previous context:\n${request.previousContext}`,
      });
      messages.push({
        role: 'assistant',
        content: 'I understand the context. Please continue.',
      });
    }
    
    messages.push({
      role: 'user',
      content: request.prompt,
    });
    
    // Check if this is an o3/o3-mini model (reasoning models)
    const isReasoningModel = request.model.modelId.includes('o3') || request.model.modelId.includes('o4');
    
    // Build request parameters
    const params: Record<string, unknown> = {
      model: request.model.modelId,
      messages,
      max_tokens: request.maxOutputTokens || 8192,
      temperature: request.temperature,
    };
    
    // Add reasoning effort for o3/o3-mini models
    if (isReasoningModel) {
      params.reasoning_effort = this.getReasoningEffort(request.thinkingBudget);
    }
    
    const response = await this.client.chat.completions.create(params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming);
    
    const latencyMs = Date.now() - startTime;
    
    // Extract content
    const content = response.choices[0]?.message?.content || '';
    
    // Build token usage
    const tokenUsage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      thinkingTokens: (response.usage as unknown as { reasoning_tokens?: number })?.reasoning_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    };
    
    return {
      content,
      tokenUsage,
      latencyMs,
      model: request.model.modelId,
      provider: this.provider,
      stopReason: response.choices[0]?.finish_reason || undefined,
    };
  }
  
  reasonStream(request: ReasoningRequest): StreamingReasoningResponse {
    if (!this.client) {
      throw new HyperThinkingError('MODEL_UNAVAILABLE', 'OpenAI client not available');
    }
    
    const self = this;
    let resolveResponse: (response: ReasoningResponse) => void;
    let rejectResponse: (error: Error) => void;
    
    const responsePromise = new Promise<ReasoningResponse>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    
    const streamGenerator = async function* (): AsyncGenerator<StreamingEvent> {
      const startTime = Date.now();
      let content = '';
      let tokenUsage: TokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
      };
      
      try {
        // Build messages
        const messages: OpenAI.ChatCompletionMessageParam[] = [];
        
        if (request.systemPrompt) {
          messages.push({
            role: 'system',
            content: request.systemPrompt,
          });
        }
        
        if (request.previousContext) {
          messages.push({
            role: 'user',
            content: `Previous context:\n${request.previousContext}`,
          });
          messages.push({
            role: 'assistant',
            content: 'I understand the context. Please continue.',
          });
        }
        
        messages.push({
          role: 'user',
          content: request.prompt,
        });
        
        const isReasoningModel = request.model.modelId.includes('o3') || request.model.modelId.includes('o4');
        
        const params: Record<string, unknown> = {
          model: request.model.modelId,
          messages,
          max_tokens: request.maxOutputTokens || 8192,
          temperature: request.temperature,
          stream: true,
          stream_options: { include_usage: true },
        };
        
        if (isReasoningModel) {
          params.reasoning_effort = self.getReasoningEffort(request.thinkingBudget);
        }
        
        const stream = await self.client!.chat.completions.create(params as unknown as OpenAI.ChatCompletionCreateParamsStreaming);
        
        yield {
          type: 'thinking_start',
          content: 'Starting reasoning...',
          metadata: {},
          timestamp: new Date(),
        };
        
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            content += delta;
            yield {
              type: 'thinking_step',
              content: delta,
              metadata: { progress: 0.5 },
              timestamp: new Date(),
            };
          }
          
          if (chunk.usage) {
            tokenUsage = {
              promptTokens: chunk.usage.prompt_tokens || 0,
              completionTokens: chunk.usage.completion_tokens || 0,
              thinkingTokens: 0,
              totalTokens: chunk.usage.total_tokens || 0,
            };
          }
        }
        
        const latencyMs = Date.now() - startTime;
        
        yield {
          type: 'thinking_complete',
          content: 'Reasoning complete.',
          metadata: { tokensUsed: tokenUsage.totalTokens },
          timestamp: new Date(),
        };
        
        resolveResponse({
          content,
          tokenUsage,
          latencyMs,
          model: request.model.modelId,
          provider: self.provider,
        });
      } catch (error) {
        yield {
          type: 'error',
          content: error instanceof Error ? error.message : 'Unknown error',
          metadata: {},
          timestamp: new Date(),
        };
        rejectResponse(error instanceof Error ? error : new Error('Unknown error'));
      }
    };
    
    return {
      stream: streamGenerator(),
      response: responsePromise,
    };
  }
  
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// OpenRouter Provider (Fallback)
// ============================================================================

class OpenRouterReasoningClient implements ReasoningProvider {
  readonly provider: ProviderType = 'openrouter';
  private client: OpenAI | null = null;
  
  constructor() {
    this.initializeClient();
  }
  
  private initializeClient(): void {
    if (process.env.OPENROUTER_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://kriptik.app',
          'X-Title': 'KripTik AI',
        },
      });
    }
  }
  
  isAvailable(): boolean {
    return !!process.env.OPENROUTER_API_KEY && !!this.client;
  }
  
  private getThinkingLevel(thinkingBudget: number): 'minimal' | 'low' | 'medium' | 'high' {
    if (thinkingBudget >= 64000) return 'high';
    if (thinkingBudget >= 32000) return 'medium';
    if (thinkingBudget >= 16000) return 'low';
    return 'minimal';
  }
  
  async reason(request: ReasoningRequest): Promise<ReasoningResponse> {
    if (!this.client) {
      throw new HyperThinkingError('MODEL_UNAVAILABLE', 'OpenRouter client not available');
    }
    
    const startTime = Date.now();
    
    // Build messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }
    
    if (request.previousContext) {
      messages.push({
        role: 'user',
        content: `Previous context:\n${request.previousContext}`,
      });
      messages.push({
        role: 'assistant',
        content: 'I understand the context. Please continue.',
      });
    }
    
    messages.push({
      role: 'user',
      content: request.prompt,
    });
    
    // Check if model supports thinking (Gemini, DeepSeek-R1)
    const supportsThinking = request.model.modelId.includes('gemini') || 
                            request.model.modelId.includes('deepseek-reasoner') ||
                            request.model.modelId.includes('qwen');
    
    // Build request with OpenRouter-specific parameters
    const params: Record<string, unknown> = {
      model: request.model.modelId,
      messages,
      max_tokens: request.maxOutputTokens || 8192,
      temperature: request.temperature,
    };
    
    // Add thinking/reasoning for supported models
    if (supportsThinking) {
      if (request.model.modelId.includes('gemini')) {
        params.thinking_level = this.getThinkingLevel(request.thinkingBudget);
      } else {
        params.reasoning = true;
      }
    }
    
    // Server-side external API call, credentials not needed
    const response = await this.client.chat.completions.create(
      params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming
    );
    
    const latencyMs = Date.now() - startTime;
    
    // Extract content
    const content = response.choices[0]?.message?.content || '';
    
    // Build token usage
    const tokenUsage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      thinkingTokens: 0,
      totalTokens: response.usage?.total_tokens || 0,
    };
    
    return {
      content,
      tokenUsage,
      latencyMs,
      model: request.model.modelId,
      provider: this.provider,
      stopReason: response.choices[0]?.finish_reason || undefined,
    };
  }
  
  reasonStream(request: ReasoningRequest): StreamingReasoningResponse {
    if (!this.client) {
      throw new HyperThinkingError('MODEL_UNAVAILABLE', 'OpenRouter client not available');
    }
    
    const self = this;
    let resolveResponse: (response: ReasoningResponse) => void;
    let rejectResponse: (error: Error) => void;
    
    const responsePromise = new Promise<ReasoningResponse>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    
    const streamGenerator = async function* (): AsyncGenerator<StreamingEvent> {
      const startTime = Date.now();
      let content = '';
      let tokenUsage: TokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
      };
      
      try {
        const messages: OpenAI.ChatCompletionMessageParam[] = [];
        
        if (request.systemPrompt) {
          messages.push({
            role: 'system',
            content: request.systemPrompt,
          });
        }
        
        if (request.previousContext) {
          messages.push({
            role: 'user',
            content: `Previous context:\n${request.previousContext}`,
          });
          messages.push({
            role: 'assistant',
            content: 'I understand the context. Please continue.',
          });
        }
        
        messages.push({
          role: 'user',
          content: request.prompt,
        });
        
        const supportsThinking = request.model.modelId.includes('gemini') || 
                                request.model.modelId.includes('deepseek-reasoner');
        
        const params: Record<string, unknown> = {
          model: request.model.modelId,
          messages,
          max_tokens: request.maxOutputTokens || 8192,
          temperature: request.temperature,
          stream: true,
        };
        
        if (supportsThinking) {
          if (request.model.modelId.includes('gemini')) {
            params.thinking_level = self.getThinkingLevel(request.thinkingBudget);
          } else {
            params.reasoning = true;
          }
        }
        
        const stream = await self.client!.chat.completions.create(
          params as unknown as OpenAI.ChatCompletionCreateParamsStreaming
        );
        
        yield {
          type: 'thinking_start',
          content: 'Starting reasoning...',
          metadata: {},
          timestamp: new Date(),
        };
        
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            content += delta;
            yield {
              type: 'thinking_step',
              content: delta,
              metadata: { progress: 0.5 },
              timestamp: new Date(),
            };
          }
        }
        
        const latencyMs = Date.now() - startTime;
        
        // Estimate token usage (OpenRouter doesn't always provide this in streams)
        tokenUsage = {
          promptTokens: Math.ceil(request.prompt.length / 4),
          completionTokens: Math.ceil(content.length / 4),
          thinkingTokens: 0,
          totalTokens: Math.ceil((request.prompt.length + content.length) / 4),
        };
        
        yield {
          type: 'thinking_complete',
          content: 'Reasoning complete.',
          metadata: { tokensUsed: tokenUsage.totalTokens },
          timestamp: new Date(),
        };
        
        resolveResponse({
          content,
          tokenUsage,
          latencyMs,
          model: request.model.modelId,
          provider: self.provider,
        });
      } catch (error) {
        yield {
          type: 'error',
          content: error instanceof Error ? error.message : 'Unknown error',
          metadata: {},
          timestamp: new Date(),
        };
        rejectResponse(error instanceof Error ? error : new Error('Unknown error'));
      }
    };
    
    return {
      stream: streamGenerator(),
      response: responsePromise,
    };
  }
  
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.chat.completions.create({
        model: 'google/gemini-2.0-flash-001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

const providers: Map<ProviderType, ReasoningProvider> = new Map();

/**
 * Get provider instance
 */
export function getProvider(type: ProviderType): ReasoningProvider {
  if (!providers.has(type)) {
    switch (type) {
      case 'anthropic':
        providers.set(type, new AnthropicReasoningClient());
        break;
      case 'openai':
        providers.set(type, new OpenAIReasoningClient());
        break;
      case 'openrouter':
        providers.set(type, new OpenRouterReasoningClient());
        break;
    }
  }
  return providers.get(type)!;
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): ReasoningProvider[] {
  return (['anthropic', 'openai', 'openrouter'] as ProviderType[])
    .map(type => getProvider(type))
    .filter(provider => provider.isAvailable());
}

/**
 * Reset all providers
 */
export function resetProviders(): void {
  providers.clear();
}

export {
  AnthropicReasoningClient,
  OpenAIReasoningClient,
  OpenRouterReasoningClient,
};
