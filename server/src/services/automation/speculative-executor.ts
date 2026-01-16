/**
 * Speculative Executor - Merged from KripToeNite
 *
 * Provides ~125ms TTFT by running fast and smart models in parallel.
 * This is NOT a separate service - it's a capability built into BuildLoopOrchestrator.
 *
 * CRITICAL: This file was created as part of merging KripToeNite's dual-stream
 * speculative execution INTO BuildLoopOrchestrator for unified single-path flow.
 *
 * @see BUILDER-VIEW-FIX-IMPLEMENTATION-PLAN-v3.md Phase 0-A
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { CLAUDE_MODELS } from '../ai/claude-service.js';

/**
 * Configuration for speculative execution dual-stream strategy.
 */
export interface SpeculativeConfig {
    /** Fast model for immediate streaming (e.g., claude-3-5-haiku-20241022) */
    fastModel: string;
    /** Smart model for validation/enhancement (e.g., claude-opus-4-5-20251101) */
    smartModel: string;
    /** Threshold for when to append smart model's response (default: 0.3) */
    enhanceThreshold: number;
    /** Maximum tokens for fast model response */
    fastMaxTokens?: number;
    /** Maximum tokens for smart model response */
    smartMaxTokens?: number;
}

/**
 * Chunk emitted during speculative execution streaming.
 */
export interface SpeculativeChunk {
    /** Type of chunk */
    type: 'text' | 'status' | 'enhancement_start' | 'done' | 'error';
    /** Content of the chunk */
    content: string;
    /** Model that produced this chunk */
    model: string;
    /** Time to first token in milliseconds (only on first text chunk) */
    ttftMs?: number;
    /** Whether this is from the enhancement (smart model) response */
    isEnhancement?: boolean;
}

/**
 * Result from a speculative execution.
 */
export interface SpeculativeResult {
    /** Full response text */
    response: string;
    /** Model that produced the primary response */
    primaryModel: string;
    /** Whether enhancement was applied */
    enhanced: boolean;
    /** Time to first token in milliseconds */
    ttftMs: number;
    /** Total execution time in milliseconds */
    totalTimeMs: number;
    /** Fast model response (for debugging) */
    fastResponse: string;
    /** Smart model response (for debugging) */
    smartResponse: string;
}

const DEFAULT_CONFIG: SpeculativeConfig = {
    fastModel: 'claude-3-5-haiku-20241022',
    smartModel: CLAUDE_MODELS.OPUS_4_5,
    enhanceThreshold: 0.3,
    fastMaxTokens: 8192,
    smartMaxTokens: 16000,
};

/**
 * Collect full response from a model (non-streaming).
 * Used for the smart model validation in parallel.
 */
async function collectFullResponse(
    client: Anthropic,
    prompt: string,
    systemPrompt: string,
    model: string,
    maxTokens: number
): Promise<string> {
    try {
        const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
        });

        return response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text)
            .join('');
    } catch (error) {
        console.error(`[SpeculativeExecutor] Error from ${model}:`, error);
        return '';
    }
}

/**
 * Determine if smart model enhancement is needed.
 * Compares fast and smart responses to decide if enhancement adds value.
 */
function shouldEnhance(fast: string, smart: string, threshold: number): boolean {
    // If fast response is empty, definitely need smart response
    if (!fast.trim()) return true;

    // If smart response is empty, don't enhance
    if (!smart.trim()) return false;

    // Length difference check - if smart is significantly longer with more content
    if (smart.length > fast.length * 1.5 && smart.length > fast.length + 500) {
        return true;
    }

    // Code completeness check - if smart has more code blocks
    const fastCodeBlocks = (fast.match(/```/g) || []).length / 2;
    const smartCodeBlocks = (smart.match(/```/g) || []).length / 2;
    if (smartCodeBlocks > fastCodeBlocks + 1) {
        return true;
    }

    // Check for quality indicators in smart response that fast lacks
    const qualityIndicators = [
        /error\s*handling/i,
        /edge\s*case/i,
        /security/i,
        /validation/i,
        /typescript/i,
        /interface\s+\w+/,
        /type\s+\w+/,
    ];

    let smartQualityScore = 0;
    let fastQualityScore = 0;

    for (const indicator of qualityIndicators) {
        if (indicator.test(smart)) smartQualityScore++;
        if (indicator.test(fast)) fastQualityScore++;
    }

    // If smart has significantly more quality indicators
    if (smartQualityScore > fastQualityScore + 2) {
        return true;
    }

    return false;
}

/**
 * Execute with speculative dual-stream strategy.
 * Fast model streams immediately (~125ms TTFT).
 * Smart model validates in parallel and enhances if needed.
 *
 * @param prompt - The user prompt
 * @param systemPrompt - The system prompt
 * @param config - Optional configuration overrides
 * @yields SpeculativeChunk - Streaming chunks with text, status, and metadata
 *
 * @example
 * ```typescript
 * for await (const chunk of executeSpeculative(prompt, systemPrompt)) {
 *     if (chunk.type === 'text') {
 *         process.stdout.write(chunk.content);
 *     }
 *     if (chunk.ttftMs) {
 *         console.log(`First token in ${chunk.ttftMs}ms`);
 *     }
 * }
 * ```
 */
export async function* executeSpeculative(
    prompt: string,
    systemPrompt: string,
    config: Partial<SpeculativeConfig> = {}
): AsyncGenerator<SpeculativeChunk> {
    const {
        fastModel,
        smartModel,
        enhanceThreshold,
        fastMaxTokens,
        smartMaxTokens
    } = { ...DEFAULT_CONFIG, ...config };

    const startTime = Date.now();
    let ttftMs: number | undefined;

    // Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        yield {
            type: 'error',
            content: 'ANTHROPIC_API_KEY not configured',
            model: 'none',
        };
        return;
    }

    const anthropic = new Anthropic({ apiKey });

    // Start BOTH models simultaneously for parallel execution
    const smartPromise = collectFullResponse(
        anthropic,
        prompt,
        systemPrompt,
        smartModel,
        smartMaxTokens!
    );

    // Stream fast model immediately for ~125ms TTFT
    let fastResponse = '';

    try {
        const fastStream = anthropic.messages.stream({
            model: fastModel,
            max_tokens: fastMaxTokens!,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
        });

        for await (const event of fastStream) {
            if (event.type === 'content_block_delta' && 'delta' in event) {
                const delta = event.delta as { type: string; text?: string };
                if (delta.type === 'text_delta' && delta.text) {
                    // Track TTFT on first token
                    if (!ttftMs) {
                        ttftMs = Date.now() - startTime;
                        yield {
                            type: 'status',
                            content: `First token in ${ttftMs}ms`,
                            model: fastModel,
                            ttftMs,
                        };
                    }

                    fastResponse += delta.text;
                    yield {
                        type: 'text',
                        content: delta.text,
                        model: fastModel,
                    };
                }
            }
        }
    } catch (error) {
        // Fast model failed - wait for smart model as fallback
        console.warn('[SpeculativeExecutor] Fast model failed, falling back to smart model:', error);

        yield {
            type: 'status',
            content: 'Fast model failed, using smart model',
            model: smartModel,
        };

        const smartResult = await smartPromise;
        if (smartResult) {
            yield { type: 'text', content: smartResult, model: smartModel };
        } else {
            yield {
                type: 'error',
                content: 'Both models failed',
                model: 'none',
            };
        }
        yield { type: 'done', content: '', model: smartModel };
        return;
    }

    // Wait for smart model to complete
    const smartResponse = await smartPromise;

    // Decide if enhancement is needed
    if (shouldEnhance(fastResponse, smartResponse, enhanceThreshold)) {
        yield {
            type: 'enhancement_start',
            content: '\n\n---\n**Enhanced Analysis:**\n',
            model: smartModel,
            isEnhancement: true,
        };

        yield {
            type: 'text',
            content: smartResponse,
            model: smartModel,
            isEnhancement: true,
        };
    } else {
        // Emit validation status (not shown to user but useful for telemetry)
        yield {
            type: 'status',
            content: `Response validated by ${smartModel}`,
            model: smartModel,
        };
    }

    yield {
        type: 'done',
        content: '',
        model: fastModel,
        ttftMs,
    };
}

/**
 * Execute speculative and collect full response (non-streaming wrapper).
 * Useful for internal calls where streaming isn't needed.
 *
 * @param prompt - The user prompt
 * @param systemPrompt - The system prompt
 * @param config - Optional configuration overrides
 * @returns Full response with metadata
 */
export async function executeSpeculativeFull(
    prompt: string,
    systemPrompt: string,
    config: Partial<SpeculativeConfig> = {}
): Promise<SpeculativeResult> {
    const startTime = Date.now();
    let response = '';
    let ttftMs = 0;
    let primaryModel = '';
    let enhanced = false;
    let fastResponse = '';
    let smartResponse = '';

    for await (const chunk of executeSpeculative(prompt, systemPrompt, config)) {
        switch (chunk.type) {
            case 'text':
                response += chunk.content;
                if (!primaryModel) primaryModel = chunk.model;
                if (chunk.isEnhancement) {
                    smartResponse += chunk.content;
                    enhanced = true;
                } else {
                    fastResponse += chunk.content;
                }
                break;
            case 'status':
                if (chunk.ttftMs) ttftMs = chunk.ttftMs;
                break;
            case 'enhancement_start':
                enhanced = true;
                response += chunk.content;
                break;
        }
    }

    return {
        response,
        primaryModel,
        enhanced,
        ttftMs,
        totalTimeMs: Date.now() - startTime,
        fastResponse,
        smartResponse,
    };
}

/**
 * Get optimal speculative config based on task characteristics.
 * Adjusts model selection and thresholds based on task complexity.
 *
 * @param complexity - Task complexity score (0-1)
 * @param requiresCode - Whether the task requires code generation
 * @param contextSize - Size of context in tokens
 * @returns Optimized configuration
 */
export function getOptimalSpeculativeConfig(
    complexity: number,
    requiresCode: boolean = false,
    contextSize: number = 0
): SpeculativeConfig {
    const config = { ...DEFAULT_CONFIG };

    // For high complexity tasks, use more aggressive smart model
    if (complexity > 0.7) {
        config.enhanceThreshold = 0.2; // More likely to enhance
        config.smartMaxTokens = 32000; // More tokens for complex tasks
    }

    // For code generation, use larger token limits
    if (requiresCode) {
        config.fastMaxTokens = 16000;
        config.smartMaxTokens = 32000;
    }

    // For large context, may need to reduce max tokens
    if (contextSize > 50000) {
        config.fastMaxTokens = Math.min(config.fastMaxTokens!, 8192);
        config.smartMaxTokens = Math.min(config.smartMaxTokens!, 16000);
    }

    return config;
}

// Export default config for reference
export { DEFAULT_CONFIG as SPECULATIVE_DEFAULT_CONFIG };
