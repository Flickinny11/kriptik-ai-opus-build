/**
 * DEPRECATED: Helicone Client
 *
 * This file is kept for backwards compatibility.
 * All functionality has moved to openrouter-client.ts
 *
 * KripTik AI now uses OpenRouter exclusively for AI capabilities:
 * - Extended thinking
 * - Effort/Verbosity parameter
 * - Tool calls
 * - 200K context
 * - Full Claude model access
 */

// Re-export everything from OpenRouter client for backwards compatibility
export {
    OpenRouterClient as HeliconeClient,
    getOpenRouterClient as getHeliconeClient,
    resetOpenRouterClient as resetHeliconeClient,
    OPENROUTER_MODELS,
    type OpenRouterModel,
    type EffortLevel,
    type OpenRouterConfig as HeliconeConfig,
    type RequestContext,
} from './openrouter-client.js';
