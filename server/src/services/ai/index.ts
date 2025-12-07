/**
 * AI Services Module
 *
 * Exports all AI-related services for KripTik
 */

// Core AI services
export * from './helicone-client.js';
export * from './claude-service.js';

// Model routing (OpenRouter) - use explicit exports to avoid conflicts
export {
    ModelRouter,
    getModelRouter,
    resetModelRouter,
    analyzeTask,
    MODELS,
    type ModelConfig,
    type ModelTier,
    type RouterConfig,
    type GenerationRequest,
    type GenerationResponse as RouterGenerationResponse,
    type TaskAnalysis,
} from './model-router.js';

// Specialized AI capabilities
export * from './image-to-code.js';
export * from './self-healing.js';
export * from './test-generator.js';

