/**
 * Model Router for Hyper-Thinking
 *
 * Routes reasoning tasks to optimal models based on:
 * - Task complexity and requirements
 * - Model tier (maximum, deep, standard, fast)
 * - Available providers (Anthropic direct, OpenAI direct, OpenRouter fallback)
 * - Cost and performance considerations
 *
 * Dual Architecture:
 * - PRIMARY: Anthropic SDK (direct) for Claude models
 * - PRIMARY: OpenAI SDK (direct) for GPT-5.2/o3 models
 * - FALLBACK: OpenRouter for Gemini, DeepSeek, Qwen
 */

import {
  type ModelTier,
  type ProviderType,
  type ModelConfig,
  type RoutingDecision,
  type ComplexityAnalysis,
  type ThinkingBudget,
  DEFAULT_THINKING_BUDGETS,
} from './types.js';

// ============================================================================
// Model Definitions
// ============================================================================

/**
 * All available models for hyper-thinking
 */
export const HYPER_THINKING_MODELS: Record<string, ModelConfig> = {
  // ========================================================================
  // TIER 1: MAXIMUM REASONING
  // ========================================================================

  // Claude Opus 4.5 - Direct Anthropic SDK
  'claude-opus-4.5': {
    modelId: 'claude-opus-4-5-20251101',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.5',
    maxContextTokens: 200000,
    maxThinkingBudget: 128000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 15.0,
    costPerOutputK: 75.0,
    costPerThinkingK: 15.0,
    bestFor: ['complex architecture', 'code generation', 'deep analysis', 'critical decisions'],
    tier: 'maximum',
  },

  // o3-pro - Direct OpenAI SDK
  'o3-pro': {
    modelId: 'o3-pro',
    provider: 'openai',
    displayName: 'OpenAI o3-pro',
    maxContextTokens: 200000,
    maxThinkingBudget: 100000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 20.0,
    costPerOutputK: 100.0,
    costPerThinkingK: 20.0,
    bestFor: ['advanced reasoning', 'mathematical proofs', 'complex logic'],
    tier: 'maximum',
  },

  // GPT-5.2 Pro - Direct OpenAI SDK
  'gpt-5.2-pro': {
    modelId: 'gpt-5.2-pro',
    provider: 'openai',
    displayName: 'GPT-5.2 Pro',
    maxContextTokens: 400000,
    maxThinkingBudget: 64000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 21.0,
    costPerOutputK: 168.0,
    bestFor: ['verification', 'ensemble validation', 'high accuracy'],
    tier: 'maximum',
  },

  // ========================================================================
  // TIER 2: DEEP REASONING
  // ========================================================================

  // o3 - Direct OpenAI SDK
  'o3': {
    modelId: 'o3',
    provider: 'openai',
    displayName: 'OpenAI o3',
    maxContextTokens: 200000,
    maxThinkingBudget: 100000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 10.0,
    costPerOutputK: 50.0,
    costPerThinkingK: 10.0,
    bestFor: ['complex reasoning', 'problem solving', 'code debugging'],
    tier: 'deep',
  },

  // GPT-5.2 Thinking - Direct OpenAI SDK
  'gpt-5.2-thinking': {
    modelId: 'gpt-5.2',
    provider: 'openai',
    displayName: 'GPT-5.2 Thinking',
    maxContextTokens: 400000,
    maxThinkingBudget: 64000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 1.75,
    costPerOutputK: 14.0,
    bestFor: ['structured thinking', 'analysis', 'planning'],
    tier: 'deep',
  },

  // Gemini 3 Pro Deep Think - OpenRouter
  'gemini-3-pro': {
    modelId: 'google/gemini-3-pro-preview',
    provider: 'openrouter',
    displayName: 'Gemini 3 Pro',
    maxContextTokens: 1000000,
    maxThinkingBudget: 32000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 1.25,
    costPerOutputK: 5.0,
    bestFor: ['multimodal reasoning', 'long context', 'video analysis'],
    tier: 'deep',
  },

  // DeepSeek-R1-0528 - OpenRouter
  'deepseek-r1': {
    modelId: 'deepseek/deepseek-reasoner',
    provider: 'openrouter',
    displayName: 'DeepSeek-R1',
    maxContextTokens: 128000,
    maxThinkingBudget: 64000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 0.55,
    costPerOutputK: 2.19,
    bestFor: ['cost-effective reasoning', 'math', 'code'],
    tier: 'deep',
  },

  // ========================================================================
  // TIER 3: STANDARD REASONING
  // ========================================================================

  // Claude Sonnet 4.5 - Direct Anthropic SDK
  'claude-sonnet-4.5': {
    modelId: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    maxContextTokens: 200000,
    maxThinkingBudget: 32000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 3.0,
    costPerOutputK: 15.0,
    costPerThinkingK: 3.0,
    bestFor: ['coding', 'analysis', 'general tasks'],
    tier: 'standard',
  },

  // o3-mini (high effort) - Direct OpenAI SDK
  'o3-mini-high': {
    modelId: 'o3-mini',
    provider: 'openai',
    displayName: 'o3-mini (high)',
    maxContextTokens: 200000,
    maxThinkingBudget: 32000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 1.1,
    costPerOutputK: 4.4,
    bestFor: ['efficient reasoning', 'math', 'code generation'],
    tier: 'standard',
  },

  // Qwen3-235B-Thinking - OpenRouter
  'qwen3-thinking': {
    modelId: 'qwen/qwen3-235b-a22b-thinking',
    provider: 'openrouter',
    displayName: 'Qwen3 Thinking',
    maxContextTokens: 128000,
    maxThinkingBudget: 32000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 0.5,
    costPerOutputK: 2.0,
    bestFor: ['open-source alternative', 'math reasoning'],
    tier: 'standard',
  },

  // ========================================================================
  // TIER 4: FAST REASONING
  // ========================================================================

  // Gemini 3 Flash - OpenRouter
  'gemini-3-flash': {
    modelId: 'google/gemini-3-flash-preview',
    provider: 'openrouter',
    displayName: 'Gemini 3 Flash',
    maxContextTokens: 1000000,
    maxThinkingBudget: 16000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 0.075,
    costPerOutputK: 0.3,
    bestFor: ['fast reasoning', 'simple tasks', 'high volume'],
    tier: 'fast',
  },

  // o3-mini (medium effort) - Direct OpenAI SDK
  'o3-mini-medium': {
    modelId: 'o3-mini',
    provider: 'openai',
    displayName: 'o3-mini (medium)',
    maxContextTokens: 200000,
    maxThinkingBudget: 16000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 1.1,
    costPerOutputK: 4.4,
    bestFor: ['balanced speed/quality', 'routine tasks'],
    tier: 'fast',
  },

  // Claude Haiku 4.5 - Direct Anthropic SDK
  'claude-haiku-4.5': {
    modelId: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    maxContextTokens: 200000,
    maxThinkingBudget: 8000,
    supportsExtendedThinking: true,
    supportsStreaming: true,
    costPerInputK: 0.25,
    costPerOutputK: 1.25,
    bestFor: ['fastest responses', 'simple tasks', 'high volume'],
    tier: 'fast',
  },
};

/**
 * Models grouped by tier
 */
export const MODELS_BY_TIER: Record<ModelTier, string[]> = {
  maximum: ['claude-opus-4.5', 'o3-pro', 'gpt-5.2-pro'],
  deep: ['o3', 'gpt-5.2-thinking', 'gemini-3-pro', 'deepseek-r1'],
  standard: ['claude-sonnet-4.5', 'o3-mini-high', 'qwen3-thinking'],
  fast: ['gemini-3-flash', 'o3-mini-medium', 'claude-haiku-4.5'],
};

/**
 * Default model for each tier
 */
export const DEFAULT_MODEL_BY_TIER: Record<ModelTier, string> = {
  maximum: 'claude-opus-4.5',
  deep: 'claude-sonnet-4.5', // Sonnet 4.5 for deep by default (good balance)
  standard: 'claude-sonnet-4.5',
  fast: 'gemini-3-flash',
};

// ============================================================================
// Model Router Class
// ============================================================================

export class ModelRouter {
  /**
   * Route to optimal model based on analysis and configuration
   */
  async route(
    analysis: ComplexityAnalysis,
    options?: {
      forceModel?: string;
      forceProvider?: ProviderType;
      forceTier?: ModelTier;
      maxBudget?: number;
      preferCost?: boolean;
    }
  ): Promise<RoutingDecision> {
    // If model is forced, use it directly
    if (options?.forceModel && HYPER_THINKING_MODELS[options.forceModel]) {
      const model = HYPER_THINKING_MODELS[options.forceModel];
      return this.createDecision(model, analysis, options?.maxBudget);
    }

    // Determine tier (forced or from analysis)
    const tier = options?.forceTier || analysis.recommendedModelTier;

    // Get available models for tier
    const availableModels = this.getAvailableModels(tier, options?.forceProvider);

    if (availableModels.length === 0) {
      // Fallback to next best available tier
      const fallbackModel = this.getFallbackModel(tier, options?.forceProvider);
      return this.createDecision(fallbackModel, analysis, options?.maxBudget);
    }

    // Select best model based on task
    const selectedModel = options?.preferCost
      ? this.selectCheapestModel(availableModels)
      : this.selectBestModel(availableModels, analysis);

    return this.createDecision(selectedModel, analysis, options?.maxBudget);
  }

  /**
   * Get available models for a tier
   */
  private getAvailableModels(tier: ModelTier, forceProvider?: ProviderType): ModelConfig[] {
    const modelIds = MODELS_BY_TIER[tier];
    const models: ModelConfig[] = [];

    for (const id of modelIds) {
      const model = HYPER_THINKING_MODELS[id];

      // Skip if provider forced and doesn't match
      if (forceProvider && model.provider !== forceProvider) {
        continue;
      }

      // Check if provider is available
      if (this.isProviderAvailable(model.provider)) {
        models.push(model);
      }
    }

    return models;
  }

  /**
   * Check if a provider is available (has API key)
   */
  private isProviderAvailable(provider: ProviderType): boolean {
    switch (provider) {
      case 'anthropic':
        return !!process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return !!process.env.OPENAI_API_KEY;
      case 'openrouter':
        return !!process.env.OPENROUTER_API_KEY;
      default:
        return false;
    }
  }

  /**
   * Get fallback model when preferred tier unavailable
   */
  private getFallbackModel(preferredTier: ModelTier, forceProvider?: ProviderType): ModelConfig {
    // Try tiers in order of capability (descending)
    const tierOrder: ModelTier[] = ['maximum', 'deep', 'standard', 'fast'];
    const startIndex = tierOrder.indexOf(preferredTier);

    // First try lower tiers
    for (let i = startIndex + 1; i < tierOrder.length; i++) {
      const models = this.getAvailableModels(tierOrder[i], forceProvider);
      if (models.length > 0) {
        return models[0];
      }
    }

    // Then try higher tiers
    for (let i = startIndex - 1; i >= 0; i--) {
      const models = this.getAvailableModels(tierOrder[i], forceProvider);
      if (models.length > 0) {
        return models[0];
      }
    }

    // Ultimate fallback - return Sonnet as default
    return HYPER_THINKING_MODELS['claude-sonnet-4.5'];
  }

  /**
   * Select best model based on task analysis
   */
  private selectBestModel(models: ModelConfig[], analysis: ComplexityAnalysis): ModelConfig {
    // Score each model based on fit for task
    let bestModel = models[0];
    let bestScore = 0;

    for (const model of models) {
      let score = 0;

      // Higher thinking budget = better for complex tasks
      if (analysis.level === 'complex' || analysis.level === 'extreme') {
        score += model.maxThinkingBudget / 10000;
      }

      // Extended thinking support
      if (model.supportsExtendedThinking) {
        score += 5;
      }

      // Match task type to model strengths
      const taskLower = analysis.reasoning.toLowerCase();
      for (const strength of model.bestFor) {
        if (taskLower.includes(strength.toLowerCase())) {
          score += 3;
        }
      }

      // Prefer direct SDK providers for reliability
      if (model.provider === 'anthropic' || model.provider === 'openai') {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }

    return bestModel;
  }

  /**
   * Select cheapest available model
   */
  private selectCheapestModel(models: ModelConfig[]): ModelConfig {
    return models.reduce((cheapest, current) => {
      const cheapestCost = cheapest.costPerInputK + cheapest.costPerOutputK;
      const currentCost = current.costPerInputK + current.costPerOutputK;
      return currentCost < cheapestCost ? current : cheapest;
    });
  }

  /**
   * Create routing decision with all details
   */
  private createDecision(
    model: ModelConfig,
    analysis: ComplexityAnalysis,
    maxBudget?: number
  ): RoutingDecision {
    // Calculate thinking budget
    const defaultBudget = DEFAULT_THINKING_BUDGETS[model.tier];
    const thinkingBudget = Math.min(
      maxBudget || defaultBudget,
      model.maxThinkingBudget
    );

    // Estimate cost based on expected tokens
    const estimatedInputTokens = analysis.estimatedTokensNeeded * 0.3;
    const estimatedOutputTokens = analysis.estimatedTokensNeeded * 0.3;
    const estimatedThinkingTokens = analysis.estimatedTokensNeeded * 0.4;

    const estimatedCost = (
      (estimatedInputTokens / 1000) * model.costPerInputK +
      (estimatedOutputTokens / 1000) * model.costPerOutputK +
      (estimatedThinkingTokens / 1000) * (model.costPerThinkingK || model.costPerOutputK)
    );

    // Generate fallback chain
    const fallbacks = this.generateFallbackChain(model);

    // Generate reasoning
    const reasoning = this.generateRoutingReasoning(model, analysis, thinkingBudget);

    return {
      model,
      fallbacks,
      reasoning,
      thinkingBudget,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
    };
  }

  /**
   * Generate fallback model chain
   */
  private generateFallbackChain(primary: ModelConfig): ModelConfig[] {
    const fallbacks: ModelConfig[] = [];

    // Same tier, different provider
    const sameTier = MODELS_BY_TIER[primary.tier];
    for (const id of sameTier) {
      const model = HYPER_THINKING_MODELS[id];
      if (model.modelId !== primary.modelId && this.isProviderAvailable(model.provider)) {
        fallbacks.push(model);
      }
    }

    // Lower tier fallbacks
    const tierOrder: ModelTier[] = ['maximum', 'deep', 'standard', 'fast'];
    const currentIndex = tierOrder.indexOf(primary.tier);

    for (let i = currentIndex + 1; i < tierOrder.length; i++) {
      const lowerTier = MODELS_BY_TIER[tierOrder[i]];
      for (const id of lowerTier) {
        const model = HYPER_THINKING_MODELS[id];
        if (this.isProviderAvailable(model.provider) && fallbacks.length < 3) {
          fallbacks.push(model);
          break;
        }
      }
    }

    return fallbacks;
  }

  /**
   * Generate routing reasoning explanation
   */
  private generateRoutingReasoning(
    model: ModelConfig,
    analysis: ComplexityAnalysis,
    thinkingBudget: number
  ): string {
    const parts: string[] = [];

    parts.push(`Selected ${model.displayName} (${model.tier} tier) via ${model.provider} SDK.`);
    parts.push(`Task complexity: ${analysis.level} (score: ${analysis.score}).`);
    parts.push(`Allocated thinking budget: ${thinkingBudget.toLocaleString()} tokens.`);

    if (model.bestFor.length > 0) {
      parts.push(`Model strengths: ${model.bestFor.slice(0, 3).join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelConfig | undefined {
    return HYPER_THINKING_MODELS[modelId];
  }

  /**
   * Get all available models
   */
  getAvailableModelsList(): ModelConfig[] {
    return Object.values(HYPER_THINKING_MODELS).filter(model =>
      this.isProviderAvailable(model.provider)
    );
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: ProviderType): ModelConfig[] {
    return Object.values(HYPER_THINKING_MODELS).filter(
      model => model.provider === provider && this.isProviderAvailable(provider)
    );
  }

  /**
   * Calculate thinking budget for a model and config
   */
  calculateThinkingBudget(
    model: ModelConfig,
    maxBudget?: number,
    tokensNeeded?: number
  ): ThinkingBudget {
    const defaultBudget = DEFAULT_THINKING_BUDGETS[model.tier];
    const totalTokens = Math.min(
      maxBudget || defaultBudget,
      model.maxThinkingBudget
    );

    // Estimate steps based on budget
    const budgetPerStep = Math.floor(totalTokens / 10); // ~10 steps max
    const maxSteps = Math.ceil(totalTokens / budgetPerStep);

    // Estimate credit cost (rough: 1 credit per 1000 tokens)
    const estimatedCreditCost = Math.ceil(totalTokens / 1000);

    return {
      totalTokens,
      usedTokens: 0,
      remainingTokens: totalTokens,
      budgetPerStep,
      maxSteps,
      estimatedCreditCost,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let routerInstance: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
  if (!routerInstance) {
    routerInstance = new ModelRouter();
  }
  return routerInstance;
}

export function resetModelRouter(): void {
  routerInstance = null;
}

export default ModelRouter;
