/**
 * Anthropic Client Factory
 * 
 * Creates an Anthropic SDK client that can use either:
 * 1. Direct Anthropic API (if ANTHROPIC_API_KEY is set)
 * 2. OpenRouter as a proxy (if only OPENROUTER_API_KEY is set)
 * 
 * This allows using the Anthropic SDK features through OpenRouter.
 */

import { Anthropic } from '@anthropic-ai/sdk';

export interface AnthropicClientConfig {
    preferDirect?: boolean; // Prefer direct Anthropic API if available
}

/**
 * Creates an Anthropic client configured for the available API
 */
export function createAnthropicClient(config?: AnthropicClientConfig): Anthropic | null {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    // If direct Anthropic API key is available and preferred
    if (anthropicKey && config?.preferDirect !== false) {
        return new Anthropic({ apiKey: anthropicKey });
    }

    // Use OpenRouter as a proxy for Anthropic SDK
    if (openRouterKey) {
        return new Anthropic({
            apiKey: openRouterKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://kriptik.ai',
                'X-Title': 'KripTik AI Builder',
            },
        });
    }

    // No API key available
    return null;
}

/**
 * Check if Anthropic client can be created
 */
export function isAnthropicAvailable(): boolean {
    return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY);
}

/**
 * Get the model ID to use with the client
 * OpenRouter requires the full model path
 */
export function getClaudeModelId(model: 'opus' | 'sonnet' | 'haiku' = 'sonnet'): string {
    const isDirect = !!process.env.ANTHROPIC_API_KEY;
    
    if (isDirect) {
        // Direct Anthropic API model names
        switch (model) {
            case 'opus': return 'claude-3-opus-20240229';
            case 'sonnet': return 'claude-sonnet-4-20250514';
            case 'haiku': return 'claude-3-5-haiku-20241022';
            default: return 'claude-sonnet-4-20250514';
        }
    } else {
        // OpenRouter model paths
        switch (model) {
            case 'opus': return 'anthropic/claude-3-opus';
            case 'sonnet': return 'anthropic/claude-sonnet-4';
            case 'haiku': return 'anthropic/claude-3.5-haiku';
            default: return 'anthropic/claude-sonnet-4';
        }
    }
}

