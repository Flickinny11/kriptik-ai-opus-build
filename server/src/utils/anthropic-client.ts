/**
 * Anthropic Client Factory
 *
 * Creates a DIRECT Anthropic SDK client for Claude models.
 * Uses direct API access for full capabilities:
 * - Extended thinking (64K budget for Opus 4.5)
 * - Precise cache control (prompt caching)
 * - Tool calls with streaming
 * - 200K context window
 *
 * ARCHITECTURE (December 2025):
 * - Claude models: DIRECT Anthropic SDK (this file)
 * - GPT models: Direct OpenAI SDK
 * - Gemini/DeepSeek/Llama: OpenRouter (fallback only)
 */

import { Anthropic } from '@anthropic-ai/sdk';

// Claude model IDs for direct Anthropic SDK access
export const CLAUDE_MODELS = {
    OPUS_4_5: 'claude-opus-4-5-20251101',     // Claude Opus 4.5 - maximum reasoning
    SONNET_4_5: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 - best for coding
    SONNET_4: 'claude-sonnet-4-20250514',     // Claude Sonnet 4 (legacy)
    HAIKU_4_5: 'claude-haiku-4-5-20251001',   // Claude Haiku 4.5 (fastest)
    HAIKU_3_5: 'claude-3-5-haiku-20241022',   // Claude Haiku 3.5 (legacy)
} as const;

export interface AnthropicClientConfig {
    apiKey?: string;  // Override ANTHROPIC_API_KEY
}

// Singleton instance
let anthropicClientInstance: Anthropic | null = null;

/**
 * Creates a DIRECT Anthropic SDK client
 * Uses ANTHROPIC_API_KEY for direct access (not OpenRouter)
 */
export function createAnthropicClient(config?: AnthropicClientConfig): Anthropic | null {
    // Return cached instance if available and no custom config
    if (anthropicClientInstance && !config?.apiKey) {
        return anthropicClientInstance;
    }

    const apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.warn('[AnthropicClient] ANTHROPIC_API_KEY not set - Claude models unavailable');
        return null;
    }

    try {
        const client = new Anthropic({
            apiKey,
        });

        // Cache instance if using default config
        if (!config?.apiKey) {
            anthropicClientInstance = client;
        }

        console.log('[AnthropicClient] Initialized with direct Anthropic SDK');
        return client;
    } catch (error) {
        console.error('[AnthropicClient] Failed to create client:', error);
        return null;
    }
}

/**
 * Check if Anthropic client can be created
 * Now checks for ANTHROPIC_API_KEY (direct access)
 */
export function isAnthropicAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Get the model ID to use with direct Anthropic SDK
 * Returns direct model IDs (not OpenRouter paths)
 */
export function getClaudeModelId(model: 'opus' | 'sonnet' | 'haiku' = 'sonnet'): string {
    switch (model) {
        case 'opus': return CLAUDE_MODELS.OPUS_4_5;
        case 'sonnet': return CLAUDE_MODELS.SONNET_4_5;
        case 'haiku': return CLAUDE_MODELS.HAIKU_3_5;
        default: return CLAUDE_MODELS.SONNET_4_5;
    }
}

/**
 * Reset the cached Anthropic client instance
 * Useful for testing or when API key changes
 */
export function resetAnthropicClient(): void {
    anthropicClientInstance = null;
}
