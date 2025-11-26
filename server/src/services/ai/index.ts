/**
 * AI Services Module
 *
 * Exports all AI-related services for KripTik
 */

// Core AI services
export * from './helicone-client';
export * from './claude-service';

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
} from './model-router';

// Specialized AI capabilities
export * from './image-to-code';
export * from './self-healing';
export * from './test-generator';

