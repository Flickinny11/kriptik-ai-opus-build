/**
 * Krip-Toe-Nite Executor
 *
 * Executes model requests using different strategies:
 * - SINGLE: Direct model execution
 * - SPECULATIVE: Fast streams, smart validates
 * - PARALLEL: Race models, take best
 * - ENSEMBLE: Multiple models contribute
 *
 * All models accessed via OpenRouter through the Anthropic SDK pattern.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

import {
    type ExecutionStrategy,
    type RoutingDecision,
    type GenerationRequest,
    type GenerationResponse,
    type ExecutionChunk,
    type BuildContext,
    type KTNModelConfig,
} from './types.js';

import { getOpenRouterClient } from '../openrouter-client.js';

// =============================================================================
// EXECUTOR CLASS
// =============================================================================

/**
 * Krip-Toe-Nite Executor
 *
 * Handles all model execution strategies via OpenRouter.
 */
export class KripToeNiteExecutor {
    private openRouter = getOpenRouterClient();

    /**
     * Execute a generation request
     */
    async *execute(
        request: GenerationRequest,
        decision: RoutingDecision
    ): AsyncGenerator<ExecutionChunk> {
        const startTime = Date.now();

        switch (decision.strategy) {
            case 'single':
                yield* this.executeSingle(request, decision, startTime);
                break;

            case 'speculative':
                yield* this.executeSpeculative(request, decision, startTime);
                break;

            case 'parallel':
                yield* this.executeParallel(request, decision, startTime);
                break;

            case 'ensemble':
                yield* this.executeEnsemble(request, decision, startTime);
                break;

            default:
                yield* this.executeSingle(request, decision, startTime);
        }
    }

    /**
     * SINGLE strategy: Direct model execution
     * Used for trivial/simple tasks
     */
    private async *executeSingle(
        request: GenerationRequest,
        decision: RoutingDecision,
        startTime: number
    ): AsyncGenerator<ExecutionChunk> {
        const model = decision.primaryModel;
        let ttftMs: number | undefined;

        try {
            const client = this.openRouter.getClient();

            const stream = await client.messages.stream({
                model: model.openRouterId,
                max_tokens: request.maxTokens || model.maxOutput,
                temperature: request.temperature ?? 0.7,
                system: request.systemPrompt || this.buildSystemPrompt(request.context),
                messages: [{
                    role: 'user',
                    content: request.prompt,
                }],
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && 'delta' in event) {
                    const delta = event.delta as { type: string; text?: string };
                    if (delta.type === 'text_delta' && delta.text) {
                        // Track TTFT
                        if (!ttftMs) {
                            ttftMs = Date.now() - startTime;
                            yield {
                                type: 'status',
                                content: `⚡ First token in ${ttftMs}ms`,
                                model: model.id,
                                strategy: 'single',
                                timestamp: Date.now(),
                                metadata: { ttftMs },
                            };
                        }

                        yield {
                            type: 'text',
                            content: delta.text,
                            model: model.id,
                            strategy: 'single',
                            timestamp: Date.now(),
                            metadata: {
                                latencyMs: Date.now() - startTime,
                            },
                        };
                    }
                }
            }

            yield {
                type: 'done',
                content: '',
                model: model.id,
                strategy: 'single',
                timestamp: Date.now(),
            };

        } catch (error) {
            // Try fallback model
            if (decision.fallbackModel) {
                yield {
                    type: 'status',
                    content: `Primary model failed, using fallback: ${decision.fallbackModel.name}`,
                    model: decision.fallbackModel.id,
                    strategy: 'single',
                    timestamp: Date.now(),
                };

                yield* this.executeSingleModel(
                    request,
                    decision.fallbackModel,
                    startTime
                );
            } else {
                yield {
                    type: 'error',
                    content: error instanceof Error ? error.message : 'Unknown error',
                    model: model.id,
                    strategy: 'single',
                    timestamp: Date.now(),
                };
            }
        }
    }

    /**
     * SPECULATIVE strategy: Fast streams, smart validates
     * Fast model response shown immediately, smart model runs in parallel
     * If smart model finds issues, enhancement is appended
     */
    private async *executeSpeculative(
        request: GenerationRequest,
        decision: RoutingDecision,
        startTime: number
    ): AsyncGenerator<ExecutionChunk> {
        const fastModel = decision.primaryModel;
        const smartModel = decision.parallelModel!;

        // Start both models simultaneously
        const fastPromise = this.collectFullResponse(request, fastModel);
        const smartPromise = this.collectFullResponse(request, smartModel);

        // Stream fast model immediately
        let fastResponse = '';
        let ttftMs: number | undefined;

        try {
            const client = this.openRouter.getClient();

            const stream = await client.messages.stream({
                model: fastModel.openRouterId,
                max_tokens: request.maxTokens || fastModel.maxOutput,
                temperature: request.temperature ?? 0.7,
                system: request.systemPrompt || this.buildSystemPrompt(request.context),
                messages: [{
                    role: 'user',
                    content: request.prompt,
                }],
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && 'delta' in event) {
                    const delta = event.delta as { type: string; text?: string };
                    if (delta.type === 'text_delta' && delta.text) {
                        // Track TTFT
                        if (!ttftMs) {
                            ttftMs = Date.now() - startTime;
                            yield {
                                type: 'status',
                                content: `⚡ First token in ${ttftMs}ms (speculative)`,
                                model: fastModel.id,
                                strategy: 'speculative',
                                timestamp: Date.now(),
                                metadata: { ttftMs },
                            };
                        }

                        fastResponse += delta.text;
                        yield {
                            type: 'text',
                            content: delta.text,
                            model: fastModel.id,
                            strategy: 'speculative',
                            timestamp: Date.now(),
                        };
                    }
                }
            }

        } catch (error) {
            // Fast model failed, wait for smart
            yield {
                type: 'status',
                content: 'Fast model failed, using smart model response',
                model: smartModel.id,
                strategy: 'speculative',
                timestamp: Date.now(),
            };

            const smartResult = await smartPromise;
            yield {
                type: 'text',
                content: smartResult.content,
                model: smartModel.id,
                strategy: 'speculative',
                timestamp: Date.now(),
            };

            yield {
                type: 'done',
                content: '',
                model: smartModel.id,
                strategy: 'speculative',
                timestamp: Date.now(),
            };
            return;
        }

        // Wait for smart model to complete
        const smartResult = await smartPromise;

        // Compare responses and decide if enhancement needed
        const shouldEnhance = this.shouldEnhance(fastResponse, smartResult.content, request);

        if (shouldEnhance) {
            yield {
                type: 'enhancement_start',
                content: '\n\n---\n🧠 Enhanced response:\n',
                model: smartModel.id,
                strategy: 'speculative',
                timestamp: Date.now(),
                metadata: { isEnhancement: true },
            };

            yield {
                type: 'text',
                content: smartResult.content,
                model: smartModel.id,
                strategy: 'speculative',
                timestamp: Date.now(),
                metadata: { isEnhancement: true },
            };
        } else {
            yield {
                type: 'status',
                content: `✓ Response validated by ${smartModel.name}`,
                model: smartModel.id,
                strategy: 'speculative',
                timestamp: Date.now(),
            };
        }

        yield {
            type: 'done',
            content: '',
            model: fastModel.id,
            strategy: 'speculative',
            timestamp: Date.now(),
        };
    }

    /**
     * PARALLEL strategy: Race models, take best
     * Both models run simultaneously, best response selected
     */
    private async *executeParallel(
        request: GenerationRequest,
        decision: RoutingDecision,
        startTime: number
    ): AsyncGenerator<ExecutionChunk> {
        const primaryModel = decision.primaryModel;
        const secondaryModel = decision.parallelModel!;

        yield {
            type: 'status',
            content: `🏎️ Racing ${primaryModel.name} vs ${secondaryModel.name}`,
            model: primaryModel.id,
            strategy: 'parallel',
            timestamp: Date.now(),
        };

        // Race both models
        const [primaryResult, secondaryResult] = await Promise.all([
            this.collectFullResponse(request, primaryModel),
            this.collectFullResponse(request, secondaryModel),
        ]);

        // Select best response
        const { winner, reason } = this.selectBestResponse(
            primaryResult,
            secondaryResult,
            request
        );

        yield {
            type: 'status',
            content: `🏆 Winner: ${winner.model} (${reason})`,
            model: winner.model,
            strategy: 'parallel',
            timestamp: Date.now(),
        };

        yield {
            type: 'text',
            content: winner.content,
            model: winner.model,
            strategy: 'parallel',
            timestamp: Date.now(),
        };

        yield {
            type: 'done',
            content: '',
            model: winner.model,
            strategy: 'parallel',
            timestamp: Date.now(),
        };
    }

    /**
     * ENSEMBLE strategy: Multiple models contribute
     * Expert tasks get multiple perspectives merged
     */
    private async *executeEnsemble(
        request: GenerationRequest,
        decision: RoutingDecision,
        startTime: number
    ): AsyncGenerator<ExecutionChunk> {
        // For ensemble, we use the primary (Opus) as the main model
        // and validate/enhance with the parallel model

        const primaryModel = decision.primaryModel;

        yield {
            type: 'status',
            content: `🧠 Using ${primaryModel.name} for expert-level task`,
            model: primaryModel.id,
            strategy: 'ensemble',
            timestamp: Date.now(),
        };

        // For now, ensemble behaves like single with Opus
        // Future: Add actual ensemble logic with multiple model merging
        yield* this.executeSingleModel(request, primaryModel, startTime);
    }

    /**
     * Execute a single model and collect full response
     */
    private async collectFullResponse(
        request: GenerationRequest,
        model: KTNModelConfig
    ): Promise<{ content: string; model: string; latencyMs: number }> {
        const startTime = Date.now();
        const client = this.openRouter.getClient();

        try {
            const response = await client.messages.create({
                model: model.openRouterId,
                max_tokens: request.maxTokens || model.maxOutput,
                temperature: request.temperature ?? 0.7,
                system: request.systemPrompt || this.buildSystemPrompt(request.context),
                messages: [{
                    role: 'user',
                    content: request.prompt,
                }],
            });

            const content = response.content
                .filter((block): block is Anthropic.TextBlock => block.type === 'text')
                .map(block => block.text)
                .join('');

            return {
                content,
                model: model.id,
                latencyMs: Date.now() - startTime,
            };
        } catch (error) {
            return {
                content: '',
                model: model.id,
                latencyMs: Date.now() - startTime,
            };
        }
    }

    /**
     * Execute single model with streaming
     */
    private async *executeSingleModel(
        request: GenerationRequest,
        model: KTNModelConfig,
        startTime: number
    ): AsyncGenerator<ExecutionChunk> {
        const client = this.openRouter.getClient();
        let ttftMs: number | undefined;

        const stream = await client.messages.stream({
            model: model.openRouterId,
            max_tokens: request.maxTokens || model.maxOutput,
            temperature: request.temperature ?? 0.7,
            system: request.systemPrompt || this.buildSystemPrompt(request.context),
            messages: [{
                role: 'user',
                content: request.prompt,
            }],
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && 'delta' in event) {
                const delta = event.delta as { type: string; text?: string };
                if (delta.type === 'text_delta' && delta.text) {
                    if (!ttftMs) {
                        ttftMs = Date.now() - startTime;
                    }

                    yield {
                        type: 'text',
                        content: delta.text,
                        model: model.id,
                        strategy: 'ensemble',
                        timestamp: Date.now(),
                    };
                }
            }
        }

        yield {
            type: 'done',
            content: '',
            model: model.id,
            strategy: 'ensemble',
            timestamp: Date.now(),
        };
    }

    /**
     * Determine if smart model response should enhance fast response
     */
    private shouldEnhance(
        fast: string,
        smart: string,
        request: GenerationRequest
    ): boolean {
        // Empty fast response - use smart
        if (!fast.trim()) return true;

        // Length difference check (smart is significantly more comprehensive)
        if (smart.length > fast.length * 1.5 && smart.length > fast.length + 500) {
            return true;
        }

        // Code block count (smart has more code)
        const fastCodeBlocks = (fast.match(/```/g) || []).length / 2;
        const smartCodeBlocks = (smart.match(/```/g) || []).length / 2;
        if (smartCodeBlocks > fastCodeBlocks + 1) {
            return true;
        }

        // Error handling check for code tasks
        const prompt = request.prompt.toLowerCase();
        if (prompt.includes('error') || prompt.includes('fix')) {
            const fastHasErrorHandling = /try\s*\{|catch\s*\(|\.catch\(/.test(fast);
            const smartHasErrorHandling = /try\s*\{|catch\s*\(|\.catch\(/.test(smart);
            if (smartHasErrorHandling && !fastHasErrorHandling) {
                return true;
            }
        }

        // TypeScript types check
        if (prompt.includes('typescript') || prompt.includes('.tsx') || prompt.includes('.ts')) {
            const fastHasTypes = /:\s*(string|number|boolean|any|\{|Array|Promise)/.test(fast);
            const smartHasTypes = /:\s*(string|number|boolean|any|\{|Array|Promise)/.test(smart);
            if (smartHasTypes && !fastHasTypes) {
                return true;
            }
        }

        // Default: fast was good enough
        return false;
    }

    /**
     * Select the best response from parallel execution
     */
    private selectBestResponse(
        primary: { content: string; model: string; latencyMs: number },
        secondary: { content: string; model: string; latencyMs: number },
        request: GenerationRequest
    ): { winner: typeof primary; reason: string } {
        // Empty response check
        if (!primary.content.trim()) {
            return { winner: secondary, reason: 'primary was empty' };
        }
        if (!secondary.content.trim()) {
            return { winner: primary, reason: 'secondary was empty' };
        }

        // Code completeness check
        const primaryCodeBlocks = (primary.content.match(/```/g) || []).length / 2;
        const secondaryCodeBlocks = (secondary.content.match(/```/g) || []).length / 2;

        if (primaryCodeBlocks > secondaryCodeBlocks + 2) {
            return { winner: primary, reason: 'more complete code' };
        }
        if (secondaryCodeBlocks > primaryCodeBlocks + 2) {
            return { winner: secondary, reason: 'more complete code' };
        }

        // Length heuristic (assuming similar quality, more detail is better)
        if (primary.content.length > secondary.content.length * 1.3) {
            return { winner: primary, reason: 'more comprehensive' };
        }
        if (secondary.content.length > primary.content.length * 1.3) {
            return { winner: secondary, reason: 'more comprehensive' };
        }

        // Default to primary (usually higher-tier model)
        return { winner: primary, reason: 'primary model preference' };
    }

    /**
     * Build system prompt from context
     */
    private buildSystemPrompt(context?: BuildContext): string {
        return `You are Krip-Toe-Nite, an expert AI software engineer powering KripTik AI.

Project context:
- Framework: ${context?.framework || 'React/Next.js'}
- Language: ${context?.language || 'TypeScript'}
- Files in project: ${context?.fileCount || 0}
- Styling: ${context?.styling || 'Tailwind CSS'}

Guidelines:
- Write clean, production-ready code
- Follow existing project patterns
- Use TypeScript with proper types
- Include error handling
- Be concise but thorough
- If you're unsure, say so

Your responses should be fast AND high-quality - that's what makes you special.`;
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let executorInstance: KripToeNiteExecutor | null = null;

export function getKripToeNiteExecutor(): KripToeNiteExecutor {
    if (!executorInstance) {
        executorInstance = new KripToeNiteExecutor();
    }
    return executorInstance;
}

export default KripToeNiteExecutor;

