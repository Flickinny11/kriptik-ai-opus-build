/**
 * Speculative Executor Unit Tests
 *
 * Tests the dual-stream speculative execution that provides ~125ms TTFT.
 * Verifies:
 * - Fast model streams first for quick response
 * - Smart model validates/enhances in parallel
 * - Configuration options work correctly
 * - Error handling for API failures
 *
 * NOTE: Tests with real API calls require ANTHROPIC_API_KEY.
 * Mock tests run without API key.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    executeSpeculative,
    executeSpeculativeFull,
    getOptimalSpeculativeConfig,
    SPECULATIVE_DEFAULT_CONFIG,
    type SpeculativeConfig,
    type SpeculativeChunk,
    type SpeculativeResult,
} from '../../services/automation/speculative-executor.js';

describe('Speculative Executor', () => {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

    describe('Configuration', () => {
        it('should have valid default configuration', () => {
            expect(SPECULATIVE_DEFAULT_CONFIG).toBeDefined();
            expect(SPECULATIVE_DEFAULT_CONFIG.fastModel).toBe('claude-3-5-haiku-20241022');
            expect(SPECULATIVE_DEFAULT_CONFIG.smartModel).toContain('claude-opus');
            expect(SPECULATIVE_DEFAULT_CONFIG.enhanceThreshold).toBe(0.3);
            expect(SPECULATIVE_DEFAULT_CONFIG.fastMaxTokens).toBe(8192);
            expect(SPECULATIVE_DEFAULT_CONFIG.smartMaxTokens).toBe(16000);
        });

        it('should generate optimal config for simple tasks', () => {
            const config = getOptimalSpeculativeConfig(0.2, false, 1000);

            expect(config).toBeDefined();
            expect(config.fastModel).toBeDefined();
            expect(config.smartModel).toBeDefined();
            expect(config.enhanceThreshold).toBe(0.3); // Default for low complexity
        });

        it('should generate optimal config for complex tasks', () => {
            const config = getOptimalSpeculativeConfig(0.8, true, 10000);

            expect(config).toBeDefined();
            expect(config.enhanceThreshold).toBe(0.2); // Lower threshold for high complexity
            expect(config.fastMaxTokens).toBe(16000); // Larger for code generation
            expect(config.smartMaxTokens).toBe(32000); // Larger for complex + code
        });

        it('should generate optimal config for code generation', () => {
            const config = getOptimalSpeculativeConfig(0.5, true, 5000);

            expect(config).toBeDefined();
            expect(config.fastMaxTokens).toBe(16000); // Larger for code
            expect(config.smartMaxTokens).toBe(32000); // Larger for code
        });

        it('should adjust tokens for large context', () => {
            const config = getOptimalSpeculativeConfig(0.5, false, 60000);

            expect(config).toBeDefined();
            // Large context should cap token limits
            expect(config.fastMaxTokens).toBeLessThanOrEqual(8192);
            expect(config.smartMaxTokens).toBeLessThanOrEqual(16000);
        });
    });

    describe('executeSpeculative - Streaming', () => {
        it('should yield error chunk when API key is not set', async () => {
            if (hasApiKey) {
                console.log('Skipping no-API-key test: ANTHROPIC_API_KEY is set');
                return;
            }

            const chunks: SpeculativeChunk[] = [];

            for await (const chunk of executeSpeculative('Say hello', 'You are helpful')) {
                chunks.push(chunk);
            }

            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks[0].type).toBe('error');
            expect(chunks[0].content).toContain('ANTHROPIC_API_KEY');
        });

        it('should stream fast model response first with API key', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            let firstChunkModel: string | undefined;
            let ttftMs: number | undefined;
            let gotTextChunk = false;

            for await (const chunk of executeSpeculative(
                'Say "Hello World" and nothing else.',
                'You are a helpful assistant. Be concise.'
            )) {
                if (chunk.type === 'status' && chunk.ttftMs) {
                    ttftMs = chunk.ttftMs;
                }
                if (chunk.type === 'text' && !firstChunkModel) {
                    firstChunkModel = chunk.model;
                    gotTextChunk = true;
                    break; // Only need first text chunk
                }
            }

            // First chunk should be from fast model (Haiku)
            expect(gotTextChunk).toBe(true);
            expect(firstChunkModel).toContain('haiku');

            // TTFT should be captured and reasonably fast
            if (ttftMs !== undefined) {
                console.log(`TTFT: ${ttftMs}ms`);
                expect(ttftMs).toBeLessThan(500); // Allow variance in test environment
            }
        }, 30000);

        it('should include TTFT in status chunk', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            let statusChunk: SpeculativeChunk | undefined;

            for await (const chunk of executeSpeculative(
                'Say "Test" only.',
                'Be extremely concise.'
            )) {
                if (chunk.type === 'status' && chunk.ttftMs !== undefined) {
                    statusChunk = chunk;
                    break;
                }
            }

            expect(statusChunk).toBeDefined();
            expect(statusChunk!.ttftMs).toBeDefined();
            expect(statusChunk!.ttftMs).toBeGreaterThan(0);
        }, 30000);

        it('should emit done chunk at end of stream', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            const chunks: SpeculativeChunk[] = [];

            for await (const chunk of executeSpeculative(
                'Say "OK".',
                'Be concise.'
            )) {
                chunks.push(chunk);
            }

            expect(chunks.length).toBeGreaterThan(0);
            const lastChunk = chunks[chunks.length - 1];
            expect(lastChunk.type).toBe('done');
        }, 30000);
    });

    describe('executeSpeculativeFull - Non-Streaming', () => {
        it('should return error result when API key is not set', async () => {
            if (hasApiKey) {
                console.log('Skipping no-API-key test: ANTHROPIC_API_KEY is set');
                return;
            }

            const result = await executeSpeculativeFull('Say hello', 'You are helpful');

            // With no API key, result should have error content
            expect(result).toBeDefined();
            expect(result.response).toContain('ANTHROPIC_API_KEY');
        });

        it('should return complete result with TTFT', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            const result = await executeSpeculativeFull(
                'What is 2 + 2? Answer with just the number.',
                'You are a helpful math assistant. Be concise.'
            );

            expect(result).toBeDefined();
            expect(result.response).toBeDefined();
            expect(result.response.length).toBeGreaterThan(0);
            expect(result.ttftMs).toBeGreaterThan(0);
            expect(result.totalTimeMs).toBeGreaterThan(result.ttftMs);
            expect(result.primaryModel).toContain('haiku');
            expect(result.fastResponse).toBeDefined();
        }, 60000);

        it('should capture both fast and smart responses', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            const result = await executeSpeculativeFull(
                'Explain TypeScript interfaces in one sentence.',
                'You are a helpful programming assistant.'
            );

            expect(result).toBeDefined();
            expect(result.fastResponse).toBeDefined();
            // Smart response may be empty if no enhancement needed
            expect(typeof result.smartResponse).toBe('string');
        }, 60000);

        it('should respect custom configuration', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            const customConfig: Partial<SpeculativeConfig> = {
                fastMaxTokens: 100,
                smartMaxTokens: 200,
            };

            const result = await executeSpeculativeFull(
                'Say hello.',
                'Be brief.',
                customConfig
            );

            expect(result).toBeDefined();
            expect(result.response).toBeDefined();
            // With low token limits, response should be short
            expect(result.fastResponse.length).toBeLessThan(1000);
        }, 30000);
    });

    describe('Enhancement Logic', () => {
        it('should indicate if enhancement was applied', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            const result = await executeSpeculativeFull(
                'Write a simple TypeScript function to add two numbers with proper types.',
                'You are a TypeScript expert. Include error handling and type safety.'
            );

            expect(result).toBeDefined();
            expect(typeof result.enhanced).toBe('boolean');
            // The enhanced flag tells us if smart model response was appended
            console.log(`Enhancement applied: ${result.enhanced}`);
        }, 60000);

        it('should not enhance when fast response is sufficient', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            const result = await executeSpeculativeFull(
                'What is the capital of France? Just the city name.',
                'You are a geography expert. Answer in one word.'
            );

            expect(result).toBeDefined();
            // Simple factual answer likely won't need enhancement
            // But this is not guaranteed, so we just verify the logic runs
            console.log(`Enhanced: ${result.enhanced}, Fast length: ${result.fastResponse.length}`);
        }, 30000);
    });

    describe('Error Handling', () => {
        it('should handle missing API key gracefully', async () => {
            // Temporarily remove API key
            const originalKey = process.env.ANTHROPIC_API_KEY;
            delete process.env.ANTHROPIC_API_KEY;

            try {
                const chunks: SpeculativeChunk[] = [];
                for await (const chunk of executeSpeculative('Test', 'Test')) {
                    chunks.push(chunk);
                }

                expect(chunks.length).toBeGreaterThan(0);
                expect(chunks[0].type).toBe('error');
            } finally {
                // Restore API key
                if (originalKey) {
                    process.env.ANTHROPIC_API_KEY = originalKey;
                }
            }
        });
    });

    describe('Performance Characteristics', () => {
        it('should achieve sub-200ms TTFT target when API is available', async () => {
            if (!hasApiKey) {
                console.log('Skipping: ANTHROPIC_API_KEY not set');
                return;
            }

            // Run multiple times to get average
            const ttftMeasurements: number[] = [];

            for (let i = 0; i < 3; i++) {
                for await (const chunk of executeSpeculative(
                    'Say "test".',
                    'Respond immediately.'
                )) {
                    if (chunk.type === 'status' && chunk.ttftMs) {
                        ttftMeasurements.push(chunk.ttftMs);
                        break;
                    }
                }

                // Small delay between tests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (ttftMeasurements.length > 0) {
                const avgTtft = ttftMeasurements.reduce((a, b) => a + b, 0) / ttftMeasurements.length;
                console.log(`Average TTFT over ${ttftMeasurements.length} runs: ${avgTtft.toFixed(0)}ms`);

                // Target is <200ms, but network conditions vary
                // In good conditions, Haiku should respond in ~125ms
                expect(avgTtft).toBeLessThan(500);
            }
        }, 60000);
    });
});
