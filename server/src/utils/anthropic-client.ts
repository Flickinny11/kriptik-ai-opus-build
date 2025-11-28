/**
 * Anthropic Client Factory
 *
 * Creates an Anthropic SDK client configured for OpenRouter.
 * OpenRouter provides full Claude capabilities:
 * - Extended thinking
 * - Effort/Verbosity parameter (Opus 4.5)
 * - Tool calls
 * - 200K context window
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { getOpenRouterClient, OPENROUTER_MODELS } from '../services/ai/openrouter-client.js';

export interface AnthropicClientConfig {
    preferDirect?: boolean; // Ignored - always uses OpenRouter
}

/**
 * Creates an Anthropic client configured for OpenRouter
 */
export function createAnthropicClient(_config?: AnthropicClientConfig): Anthropic | null {
    try {
        const openRouter = getOpenRouterClient();
        return openRouter.getClient();
    } catch (error) {
        console.error('[AnthropicClient] Failed to create client:', error);
        return null;
    }
}

/**
 * Check if Anthropic client can be created
 */
export function isAnthropicAvailable(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Get the model ID to use with the client
 * Returns OpenRouter model paths
 */
export function getClaudeModelId(model: 'opus' | 'sonnet' | 'haiku' = 'sonnet'): string {
    switch (model) {
        case 'opus': return OPENROUTER_MODELS.OPUS_4_5;
        case 'sonnet': return OPENROUTER_MODELS.SONNET_4_5;
        case 'haiku': return OPENROUTER_MODELS.HAIKU_3_5;
        default: return OPENROUTER_MODELS.SONNET_4_5;
    }
}
