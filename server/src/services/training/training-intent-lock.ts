/**
 * Training Intent Lock Engine - Flagship Training & Fine-Tuning
 *
 * Creates immutable "Training Sacred Contracts" from NLP prompts.
 * Parses user intent to determine target capability, quality benchmark,
 * recommended methods, and data requirements.
 *
 * Uses Claude Opus 4.5 with 64K thinking budget for deep analysis.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { randomUUID } from 'crypto';
import { ClaudeService, createOrchestratorClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';

// =============================================================================
// TYPES
// =============================================================================

export type TrainingCapability =
  | 'music_generation'
  | 'video_generation'
  | 'image_generation'
  | 'voice_cloning'
  | 'text_generation'
  | 'code_generation'
  | 'chat'
  | 'embeddings'
  | 'multimodal'
  | 'custom';

export type TrainingMethod =
  // PEFT Methods
  | 'lora'
  | 'qlora'
  | 'dora'
  | 'qdora'
  | 'adalora'
  | 'vera'
  | 'relora'
  | 'mora'
  | 'galore'
  | 'longlora'
  // Full Training
  | 'full_finetune'
  | 'full_finetune_fsdp'
  | 'full_finetune_deepspeed'
  // Alignment Methods
  | 'dpo'
  | 'orpo'
  | 'rlhf_ppo'
  | 'grpo'
  | 'rlvr'
  | 'rlaif'
  | 'constitutional_ai'
  // Distributed
  | 'deepspeed_zero1'
  | 'deepspeed_zero2'
  | 'deepspeed_zero3'
  | 'deepspeed_infinity'
  | 'fsdp'
  | 'megatron_lm'
  | '3d_parallelism'
  // Specialized
  | 'moe_diffusion'
  | 'dreambooth'
  | 'textual_inversion'
  | 'voice_clone'
  | 'temporal_adaptation'
  // Hybrid
  | 'hybrid_lora_dpo'
  | 'hybrid_full_rlhf'
  | 'hybrid_moe_alignment';

export type QualityTier = 'consumer' | 'professional' | 'flagship' | 'research';

export type DataSourceStrategy = 'user_upload' | 'web_search' | 'huggingface' | 'hybrid';

export interface BaseModelRecommendation {
  modelId: string;
  displayName: string;
  source: 'huggingface' | 'local' | 'custom';
  sizeGB: number;
  vramRequired: number;
  license: string;
  reasoning: string;
  confidence: number;
}

export interface TrainingMethodRecommendation {
  method: TrainingMethod;
  tier: QualityTier;
  displayName: string;
  description: string;
  reasoning: string;
  estimatedHours: number;
  estimatedCostUsd: { min: number; max: number };
  gpuRequirement: string;
  confidence: number;
}

export interface DataRequirement {
  type: 'text' | 'audio' | 'video' | 'image' | 'code' | 'pairs' | 'preferences';
  format: string;
  minSamples: number;
  recommendedSamples: number;
  flagshipSamples: number;
  qualityRequirements: string[];
  exampleSchema?: Record<string, unknown>;
}

export interface TechnicalRequirement {
  category: 'compute' | 'memory' | 'storage' | 'network' | 'framework';
  requirement: string;
  mandatory: boolean;
}

export interface GPURequirement {
  minVram: number;
  recommendedVram: number;
  minGpuCount: number;
  recommendedGpuCount: number;
  supportedGpus: string[];
  requiresNvlink: boolean;
  requiresInfiniband: boolean;
}

export interface CostEstimate {
  gpuCostPerHour: number;
  estimatedHours: { min: number; max: number };
  estimatedTotal: { min: number; max: number };
  currency: 'USD';
}

export interface TrainingSuccessCriterion {
  id: string;
  description: string;
  metric: string;
  targetValue: string;
  verificationMethod: 'automated' | 'manual' | 'comparison';
  passed: boolean;
}

export interface EvaluationStrategy {
  method: 'loss_threshold' | 'benchmark_comparison' | 'human_eval' | 'a_b_test' | 'metric_suite';
  metrics: string[];
  benchmarks?: string[];
  humanEvalCriteria?: string[];
}

export interface ImplementationStep {
  id: string;
  phase: number;
  name: string;
  description: string;
  estimatedHours: number;
  dependencies: string[];
  deliverables: string[];
}

export interface TrainingContract {
  id: string;
  userId: string;

  // Original prompt
  originalPrompt: string;

  // Parsed Intent
  targetCapability: TrainingCapability;
  qualityBenchmark: string;
  benchmarkModel?: string;
  qualityTier: QualityTier;

  // Base Model Selection
  recommendedBaseModels: BaseModelRecommendation[];
  selectedBaseModel?: string;

  // Training Method Selection (AI-determined)
  recommendedMethods: TrainingMethodRecommendation[];
  selectedMethod?: TrainingMethod;

  // Data Requirements
  dataRequirements: DataRequirement[];
  estimatedDataVolume: string;
  dataSourceStrategy: DataSourceStrategy;

  // Technical Requirements
  technicalRequirements: TechnicalRequirement[];
  gpuRequirements: GPURequirement;
  estimatedTrainingTime: string;
  estimatedCost: CostEstimate;

  // Success Criteria
  successCriteria: TrainingSuccessCriterion[];
  evaluationStrategy: EvaluationStrategy;

  // Workflow
  implementationPlan: ImplementationStep[];

  // State
  locked: boolean;
  lockedAt?: string;
  thinkingTokensUsed: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// CAPABILITY MAPPINGS
// =============================================================================

interface CapabilityMapping {
  baseModels: BaseModelRecommendation[];
  defaultMethods: TrainingMethod[];
  gpuTier: string;
  dataType: DataRequirement['type'];
}

const CAPABILITY_MAPPINGS: Record<TrainingCapability, CapabilityMapping> = {
  music_generation: {
    baseModels: [
      { modelId: 'facebook/musicgen-large', displayName: 'MusicGen Large', source: 'huggingface', sizeGB: 7, vramRequired: 24, license: 'CC-BY-NC-4.0', reasoning: 'State-of-the-art music generation with text conditioning', confidence: 0.95 },
      { modelId: 'cvssp/audioldm2-music', displayName: 'AudioLDM2 Music', source: 'huggingface', sizeGB: 5, vramRequired: 16, license: 'CC-BY-NC-SA-4.0', reasoning: 'Diffusion-based music generation with high quality', confidence: 0.88 },
      { modelId: 'stabilityai/stable-audio-open-1.0', displayName: 'Stable Audio Open', source: 'huggingface', sizeGB: 3, vramRequired: 12, license: 'Stability AI License', reasoning: 'Commercial-friendly audio generation', confidence: 0.85 },
    ],
    defaultMethods: ['full_finetune_deepspeed', 'dpo', 'moe_diffusion'],
    gpuTier: 'H100 cluster',
    dataType: 'audio',
  },
  video_generation: {
    baseModels: [
      { modelId: 'Wan-AI/Wan2.1-T2V-14B', displayName: 'Wan 2.1 14B', source: 'huggingface', sizeGB: 28, vramRequired: 80, license: 'Apache-2.0', reasoning: 'Leading open-source video model with temporal consistency', confidence: 0.92 },
      { modelId: 'tencent/HunyuanVideo', displayName: 'HunyuanVideo', source: 'huggingface', sizeGB: 24, vramRequired: 80, license: 'Tencent Hunyuan License', reasoning: 'High-quality video with good motion handling', confidence: 0.88 },
      { modelId: 'hpcai-tech/Open-Sora', displayName: 'Open-Sora 2.0', source: 'huggingface', sizeGB: 12, vramRequired: 48, license: 'Apache-2.0', reasoning: 'Efficient open-source Sora alternative', confidence: 0.85 },
    ],
    defaultMethods: ['lora', 'temporal_adaptation', 'dpo'],
    gpuTier: 'A100-80GB x4',
    dataType: 'video',
  },
  image_generation: {
    baseModels: [
      { modelId: 'black-forest-labs/FLUX.1-dev', displayName: 'FLUX.1 Dev', source: 'huggingface', sizeGB: 23, vramRequired: 32, license: 'FLUX.1 Dev Non-Commercial', reasoning: 'Best quality image generation, excellent prompt following', confidence: 0.95 },
      { modelId: 'stabilityai/stable-diffusion-xl-base-1.0', displayName: 'SDXL', source: 'huggingface', sizeGB: 7, vramRequired: 16, license: 'CreativeML Open RAIL++-M', reasoning: 'Proven architecture with large ecosystem', confidence: 0.90 },
      { modelId: 'stabilityai/stable-diffusion-3.5-large', displayName: 'SD3.5 Large', source: 'huggingface', sizeGB: 8, vramRequired: 24, license: 'Stability AI License', reasoning: 'Latest SD architecture with improved quality', confidence: 0.88 },
    ],
    defaultMethods: ['dora', 'dreambooth', 'lora'],
    gpuTier: 'A100-40GB',
    dataType: 'image',
  },
  voice_cloning: {
    baseModels: [
      { modelId: 'coqui/XTTS-v2', displayName: 'XTTS v2', source: 'huggingface', sizeGB: 2, vramRequired: 8, license: 'CPML', reasoning: 'Best open-source voice cloning with minimal data needed', confidence: 0.95 },
      { modelId: 'collabora/WhisperSpeech', displayName: 'WhisperSpeech', source: 'huggingface', sizeGB: 1.5, vramRequired: 6, license: 'MIT', reasoning: 'Efficient TTS with voice cloning capability', confidence: 0.85 },
      { modelId: 'suno/bark', displayName: 'Bark', source: 'huggingface', sizeGB: 5, vramRequired: 12, license: 'MIT', reasoning: 'Versatile audio generation including voice', confidence: 0.80 },
    ],
    defaultMethods: ['full_finetune', 'voice_clone'],
    gpuTier: 'A40',
    dataType: 'audio',
  },
  text_generation: {
    baseModels: [
      { modelId: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B', source: 'huggingface', sizeGB: 140, vramRequired: 160, license: 'Llama 3.3 License', reasoning: 'Best open-weight LLM for general text generation', confidence: 0.95 },
      { modelId: 'Qwen/Qwen2.5-72B-Instruct', displayName: 'Qwen 2.5 72B', source: 'huggingface', sizeGB: 144, vramRequired: 160, license: 'Apache-2.0', reasoning: 'Excellent multilingual and reasoning capabilities', confidence: 0.92 },
      { modelId: 'mistralai/Mistral-Large-Instruct-2411', displayName: 'Mistral Large', source: 'huggingface', sizeGB: 244, vramRequired: 280, license: 'Apache-2.0', reasoning: 'Top-tier instruction following', confidence: 0.88 },
    ],
    defaultMethods: ['qlora', 'dora', 'dpo'],
    gpuTier: 'A100-80GB x2',
    dataType: 'text',
  },
  code_generation: {
    baseModels: [
      { modelId: 'deepseek-ai/DeepSeek-Coder-V2-Instruct', displayName: 'DeepSeek Coder V2', source: 'huggingface', sizeGB: 32, vramRequired: 80, license: 'MIT', reasoning: 'State-of-the-art code generation with reasoning', confidence: 0.95 },
      { modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct', displayName: 'Qwen 2.5 Coder 32B', source: 'huggingface', sizeGB: 64, vramRequired: 80, license: 'Apache-2.0', reasoning: 'Excellent code understanding and generation', confidence: 0.92 },
      { modelId: 'codellama/CodeLlama-70b-Instruct-hf', displayName: 'CodeLlama 70B', source: 'huggingface', sizeGB: 140, vramRequired: 160, license: 'Llama 2 License', reasoning: 'Proven code model from Meta', confidence: 0.85 },
    ],
    defaultMethods: ['qlora', 'rlvr', 'dpo'],
    gpuTier: 'A100-80GB',
    dataType: 'code',
  },
  chat: {
    baseModels: [
      { modelId: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B Instruct', source: 'huggingface', sizeGB: 140, vramRequired: 160, license: 'Llama 3.3 License', reasoning: 'Best for conversational AI', confidence: 0.95 },
      { modelId: 'Qwen/Qwen2.5-72B-Instruct', displayName: 'Qwen 2.5 72B Chat', source: 'huggingface', sizeGB: 144, vramRequired: 160, license: 'Apache-2.0', reasoning: 'Excellent chat with tool use', confidence: 0.90 },
    ],
    defaultMethods: ['dpo', 'orpo', 'qlora'],
    gpuTier: 'A100-40GB',
    dataType: 'pairs',
  },
  embeddings: {
    baseModels: [
      { modelId: 'intfloat/e5-mistral-7b-instruct', displayName: 'E5 Mistral 7B', source: 'huggingface', sizeGB: 14, vramRequired: 24, license: 'MIT', reasoning: 'Best instruction-following embeddings', confidence: 0.95 },
      { modelId: 'BAAI/bge-m3', displayName: 'BGE-M3', source: 'huggingface', sizeGB: 2, vramRequired: 8, license: 'MIT', reasoning: 'Multi-lingual multi-modal embeddings', confidence: 0.90 },
    ],
    defaultMethods: ['full_finetune', 'lora'],
    gpuTier: 'RTX 4090',
    dataType: 'pairs',
  },
  multimodal: {
    baseModels: [
      { modelId: 'lmms-lab/llava-onevision-qwen2-72b-ov', displayName: 'LLaVA OneVision 72B', source: 'huggingface', sizeGB: 144, vramRequired: 160, license: 'Apache-2.0', reasoning: 'Best open multimodal model', confidence: 0.92 },
      { modelId: 'Qwen/Qwen2-VL-72B-Instruct', displayName: 'Qwen2-VL 72B', source: 'huggingface', sizeGB: 144, vramRequired: 160, license: 'Apache-2.0', reasoning: 'Excellent vision-language understanding', confidence: 0.90 },
    ],
    defaultMethods: ['qlora', 'hybrid_lora_dpo'],
    gpuTier: 'A100-80GB x2',
    dataType: 'image',
  },
  custom: {
    baseModels: [],
    defaultMethods: ['lora', 'qlora'],
    gpuTier: 'A100-40GB',
    dataType: 'text',
  },
};

// =============================================================================
// QUALITY BENCHMARK PATTERNS
// =============================================================================

const QUALITY_PATTERNS: Record<string, { tier: QualityTier; benchmarkModel?: string }> = {
  'suno': { tier: 'flagship', benchmarkModel: 'suno-v4' },
  'suno-level': { tier: 'flagship', benchmarkModel: 'suno-v4' },
  'suno-quality': { tier: 'flagship', benchmarkModel: 'suno-v4' },
  'veo': { tier: 'flagship', benchmarkModel: 'veo-3' },
  'veo-level': { tier: 'flagship', benchmarkModel: 'veo-3' },
  'veo-quality': { tier: 'flagship', benchmarkModel: 'veo-3' },
  'gpt-4': { tier: 'flagship', benchmarkModel: 'gpt-4o' },
  'gpt-4-level': { tier: 'flagship', benchmarkModel: 'gpt-4o' },
  'claude': { tier: 'flagship', benchmarkModel: 'claude-opus-4' },
  'claude-level': { tier: 'flagship', benchmarkModel: 'claude-opus-4' },
  'midjourney': { tier: 'flagship', benchmarkModel: 'midjourney-v6' },
  'dall-e-3': { tier: 'professional', benchmarkModel: 'dall-e-3' },
  'flux': { tier: 'professional', benchmarkModel: 'flux.1-pro' },
  'production': { tier: 'professional' },
  'production-ready': { tier: 'professional' },
  'professional': { tier: 'professional' },
  'quick': { tier: 'consumer' },
  'fast': { tier: 'consumer' },
  'simple': { tier: 'consumer' },
  'basic': { tier: 'consumer' },
  'research': { tier: 'research' },
  'experimental': { tier: 'research' },
  'state-of-the-art': { tier: 'research' },
  'sota': { tier: 'research' },
};

// =============================================================================
// TRAINING INTENT LOCK ENGINE
// =============================================================================

export interface TrainingIntentLockOptions {
  thinkingBudget?: number;
  model?: string;
}

export class TrainingIntentLockEngine {
  private claudeService: ClaudeService;

  constructor() {
    this.claudeService = createOrchestratorClaudeService();
  }

  /**
   * Create a Training Contract from an NLP prompt
   */
  async createContract(
    userId: string,
    prompt: string,
    options: TrainingIntentLockOptions = {}
  ): Promise<TrainingContract> {
    const { thinkingBudget = 64000 } = options;

    const contractId = randomUUID();
    const startTime = Date.now();

    // Parse the prompt using Claude Opus 4.5 with extended thinking
    const parsedIntent = await this.parseTrainingIntent(prompt, thinkingBudget);

    // Get capability mapping
    const mapping = CAPABILITY_MAPPINGS[parsedIntent.capability] || CAPABILITY_MAPPINGS.custom;

    // Build recommended methods based on quality tier
    const recommendedMethods = this.buildMethodRecommendations(
      parsedIntent.capability,
      parsedIntent.qualityTier,
      mapping.defaultMethods
    );

    // Build data requirements
    const dataRequirements = this.buildDataRequirements(parsedIntent.capability, parsedIntent.qualityTier);

    // Build GPU requirements
    const gpuRequirements = this.buildGPURequirements(parsedIntent.capability, parsedIntent.qualityTier);

    // Build cost estimate
    const estimatedCost = this.buildCostEstimate(parsedIntent.qualityTier, gpuRequirements);

    // Build success criteria
    const successCriteria = this.buildSuccessCriteria(parsedIntent.capability, parsedIntent.qualityBenchmark);

    // Build implementation plan
    const implementationPlan = this.buildImplementationPlan(parsedIntent.capability, parsedIntent.qualityTier);

    const thinkingTokensUsed = Date.now() - startTime; // Approximate

    const contract: TrainingContract = {
      id: contractId,
      userId,
      originalPrompt: prompt,
      targetCapability: parsedIntent.capability,
      qualityBenchmark: parsedIntent.qualityBenchmark,
      benchmarkModel: parsedIntent.benchmarkModel,
      qualityTier: parsedIntent.qualityTier,
      recommendedBaseModels: mapping.baseModels,
      selectedBaseModel: mapping.baseModels[0]?.modelId,
      recommendedMethods,
      selectedMethod: recommendedMethods[0]?.method,
      dataRequirements,
      estimatedDataVolume: this.estimateDataVolume(parsedIntent.capability, parsedIntent.qualityTier),
      dataSourceStrategy: parsedIntent.dataSourceStrategy,
      technicalRequirements: this.buildTechnicalRequirements(parsedIntent.capability, parsedIntent.qualityTier),
      gpuRequirements,
      estimatedTrainingTime: this.estimateTrainingTime(parsedIntent.qualityTier),
      estimatedCost,
      successCriteria,
      evaluationStrategy: this.buildEvaluationStrategy(parsedIntent.capability),
      implementationPlan,
      locked: false,
      thinkingTokensUsed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return contract;
  }

  /**
   * Lock a contract (make it immutable)
   */
  async lockContract(contract: TrainingContract): Promise<TrainingContract> {
    if (contract.locked) {
      throw new Error('Contract is already locked');
    }

    return {
      ...contract,
      locked: true,
      lockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Parse training intent from NLP prompt using Claude
   */
  private async parseTrainingIntent(
    prompt: string,
    thinkingBudget: number
  ): Promise<{
    capability: TrainingCapability;
    qualityBenchmark: string;
    benchmarkModel?: string;
    qualityTier: QualityTier;
    dataSourceStrategy: DataSourceStrategy;
  }> {
    const systemPrompt = `You are an expert AI training consultant. Analyze the user's training request and extract:

1. TARGET CAPABILITY: What type of model are they trying to train?
   - music_generation: Creating music, songs, audio compositions
   - video_generation: Creating videos, animations, motion content
   - image_generation: Creating images, art, visual content
   - voice_cloning: Cloning voices, text-to-speech
   - text_generation: Generating text, writing, content
   - code_generation: Generating code, programming
   - chat: Conversational AI, chatbots
   - embeddings: Vector representations, search
   - multimodal: Vision-language, multi-modal understanding
   - custom: Other specialized use cases

2. QUALITY BENCHMARK: What quality level are they targeting?
   - Extract any mentions of "Suno-level", "GPT-4-level", "Veo-quality", etc.
   - Identify if they want "professional", "production-ready", "quick/fast", or "research-grade"

3. DATA SOURCE: How will they get training data?
   - user_upload: They have their own data
   - huggingface: They want to use public datasets
   - web_search: They need help finding data
   - hybrid: Combination of sources

Respond with JSON only:
{
  "capability": "string",
  "qualityBenchmark": "string describing target quality",
  "benchmarkModel": "optional specific model name to match",
  "qualityTier": "consumer|professional|flagship|research",
  "dataSourceStrategy": "user_upload|huggingface|web_search|hybrid",
  "reasoning": "brief explanation of your analysis"
}`;

    try {
      const response = await this.claudeService.generate(
        `${systemPrompt}\n\nAnalyze this training request:\n\n"${prompt}"`,
        {
          model: CLAUDE_MODELS.OPUS_4_5,
          maxTokens: 2000,
          temperature: 0.2,
          useExtendedThinking: true,
          thinkingBudgetTokens: thinkingBudget,
        }
      );

      // Parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate capability
      const validCapabilities: TrainingCapability[] = [
        'music_generation', 'video_generation', 'image_generation', 'voice_cloning',
        'text_generation', 'code_generation', 'chat', 'embeddings', 'multimodal', 'custom'
      ];
      const capability = validCapabilities.includes(parsed.capability)
        ? parsed.capability as TrainingCapability
        : 'custom';

      // Detect quality tier from benchmark patterns
      let qualityTier: QualityTier = parsed.qualityTier || 'professional';
      let benchmarkModel = parsed.benchmarkModel;

      const lowerPrompt = prompt.toLowerCase();
      for (const [pattern, config] of Object.entries(QUALITY_PATTERNS)) {
        if (lowerPrompt.includes(pattern)) {
          qualityTier = config.tier;
          if (config.benchmarkModel && !benchmarkModel) {
            benchmarkModel = config.benchmarkModel;
          }
          break;
        }
      }

      return {
        capability,
        qualityBenchmark: parsed.qualityBenchmark || `${qualityTier}-level`,
        benchmarkModel,
        qualityTier,
        dataSourceStrategy: parsed.dataSourceStrategy || 'hybrid',
      };
    } catch (error) {
      console.error('[TrainingIntentLock] Parse error:', error);
      // Fallback to heuristic parsing
      return this.heuristicParse(prompt);
    }
  }

  /**
   * Fallback heuristic parsing when Claude fails
   */
  private heuristicParse(prompt: string): {
    capability: TrainingCapability;
    qualityBenchmark: string;
    benchmarkModel?: string;
    qualityTier: QualityTier;
    dataSourceStrategy: DataSourceStrategy;
  } {
    const lower = prompt.toLowerCase();

    let capability: TrainingCapability = 'text_generation';
    if (lower.includes('music') || lower.includes('audio') || lower.includes('song')) {
      capability = 'music_generation';
    } else if (lower.includes('video') || lower.includes('animation')) {
      capability = 'video_generation';
    } else if (lower.includes('image') || lower.includes('art') || lower.includes('picture')) {
      capability = 'image_generation';
    } else if (lower.includes('voice') || lower.includes('speech') || lower.includes('tts')) {
      capability = 'voice_cloning';
    } else if (lower.includes('code') || lower.includes('programming') || lower.includes('coding')) {
      capability = 'code_generation';
    } else if (lower.includes('chat') || lower.includes('conversation')) {
      capability = 'chat';
    } else if (lower.includes('embedding') || lower.includes('search') || lower.includes('rag')) {
      capability = 'embeddings';
    } else if (lower.includes('vision') || lower.includes('multimodal')) {
      capability = 'multimodal';
    }

    let qualityTier: QualityTier = 'professional';
    let benchmarkModel: string | undefined;

    for (const [pattern, config] of Object.entries(QUALITY_PATTERNS)) {
      if (lower.includes(pattern)) {
        qualityTier = config.tier;
        benchmarkModel = config.benchmarkModel;
        break;
      }
    }

    return {
      capability,
      qualityBenchmark: `${qualityTier}-level`,
      benchmarkModel,
      qualityTier,
      dataSourceStrategy: lower.includes('upload') ? 'user_upload' : 'hybrid',
    };
  }

  /**
   * Build method recommendations based on capability and quality tier
   */
  private buildMethodRecommendations(
    capability: TrainingCapability,
    tier: QualityTier,
    defaultMethods: TrainingMethod[]
  ): TrainingMethodRecommendation[] {
    const recommendations: TrainingMethodRecommendation[] = [];

    switch (tier) {
      case 'consumer':
        recommendations.push({
          method: 'qlora',
          tier: 'consumer',
          displayName: 'QLoRA (4-bit Quantized LoRA)',
          description: 'Memory-efficient fine-tuning with minimal quality loss',
          reasoning: 'Best for quick experiments and limited GPU resources',
          estimatedHours: 2,
          estimatedCostUsd: { min: 10, max: 50 },
          gpuRequirement: 'RTX 4090 or A40',
          confidence: 0.9,
        });
        break;

      case 'professional':
        recommendations.push({
          method: 'dora',
          tier: 'professional',
          displayName: 'DoRA (Weight-Decomposed Low-Rank Adaptation)',
          description: 'Advanced PEFT with magnitude-direction decomposition',
          reasoning: 'Closer to full fine-tune quality with parameter efficiency',
          estimatedHours: 8,
          estimatedCostUsd: { min: 100, max: 300 },
          gpuRequirement: 'A100-40GB',
          confidence: 0.92,
        });
        recommendations.push({
          method: 'hybrid_lora_dpo',
          tier: 'professional',
          displayName: 'LoRA + DPO Alignment',
          description: 'Two-stage: LoRA fine-tune then DPO preference alignment',
          reasoning: 'Balances efficiency with quality alignment',
          estimatedHours: 16,
          estimatedCostUsd: { min: 200, max: 500 },
          gpuRequirement: 'A100-40GB x2',
          confidence: 0.88,
        });
        break;

      case 'flagship':
        recommendations.push({
          method: 'hybrid_full_rlhf',
          tier: 'flagship',
          displayName: 'Full Fine-tune + RLHF Pipeline',
          description: 'Multi-stage: Full fine-tune → DPO → RLHF with reward model',
          reasoning: 'Maximum quality for flagship-level results',
          estimatedHours: 120,
          estimatedCostUsd: { min: 2500, max: 8000 },
          gpuRequirement: 'H100 cluster (8 GPUs)',
          confidence: 0.95,
        });
        if (capability === 'music_generation' || capability === 'video_generation') {
          recommendations.push({
            method: 'hybrid_moe_alignment',
            tier: 'flagship',
            displayName: 'MoE Expert Specialization + Alignment',
            description: 'Mixture of Experts training with domain-specific experts',
            reasoning: 'Best for complex generative models needing specialization',
            estimatedHours: 200,
            estimatedCostUsd: { min: 5000, max: 15000 },
            gpuRequirement: 'A100-80GB cluster (8+ GPUs)',
            confidence: 0.88,
          });
        }
        break;

      case 'research':
        recommendations.push({
          method: '3d_parallelism',
          tier: 'research',
          displayName: '3D Parallelism Training',
          description: 'Data + Tensor + Pipeline parallelism for massive models',
          reasoning: 'For training models at 100B+ parameters from scratch',
          estimatedHours: 500,
          estimatedCostUsd: { min: 25000, max: 100000 },
          gpuRequirement: 'Multi-node H100 cluster',
          confidence: 0.85,
        });
        break;
    }

    // Add default methods as alternatives
    for (const method of defaultMethods) {
      if (!recommendations.some(r => r.method === method)) {
        recommendations.push({
          method,
          tier,
          displayName: this.getMethodDisplayName(method),
          description: this.getMethodDescription(method),
          reasoning: 'Recommended for this capability',
          estimatedHours: this.estimateMethodHours(method, tier),
          estimatedCostUsd: this.estimateMethodCost(method, tier),
          gpuRequirement: CAPABILITY_MAPPINGS[capability]?.gpuTier || 'A100-40GB',
          confidence: 0.75,
        });
      }
    }

    return recommendations;
  }

  private getMethodDisplayName(method: TrainingMethod): string {
    const names: Record<TrainingMethod, string> = {
      lora: 'LoRA (Low-Rank Adaptation)',
      qlora: 'QLoRA (Quantized LoRA)',
      dora: 'DoRA (Weight-Decomposed LoRA)',
      qdora: 'QDoRA (Quantized DoRA)',
      adalora: 'AdaLoRA (Adaptive LoRA)',
      vera: 'VeRA (Vector-based LoRA)',
      relora: 'ReLoRA (Iterative LoRA)',
      mora: 'MoRA (Mixture of LoRA)',
      galore: 'GaLore (Gradient Low-Rank)',
      longlora: 'LongLoRA (Extended Context)',
      full_finetune: 'Full Fine-tune',
      full_finetune_fsdp: 'Full Fine-tune (FSDP)',
      full_finetune_deepspeed: 'Full Fine-tune (DeepSpeed)',
      dpo: 'DPO (Direct Preference Optimization)',
      orpo: 'ORPO (Odds Ratio Preference)',
      rlhf_ppo: 'RLHF with PPO',
      grpo: 'GRPO (Group Relative Policy)',
      rlvr: 'RLVR (RL from Verifiable Rewards)',
      rlaif: 'RLAIF (RL from AI Feedback)',
      constitutional_ai: 'Constitutional AI',
      deepspeed_zero1: 'DeepSpeed ZeRO-1',
      deepspeed_zero2: 'DeepSpeed ZeRO-2',
      deepspeed_zero3: 'DeepSpeed ZeRO-3',
      deepspeed_infinity: 'DeepSpeed ZeRO-Infinity',
      fsdp: 'PyTorch FSDP',
      megatron_lm: 'Megatron-LM',
      '3d_parallelism': '3D Parallelism',
      moe_diffusion: 'MoE for Diffusion',
      dreambooth: 'DreamBooth',
      textual_inversion: 'Textual Inversion',
      voice_clone: 'Voice Cloning',
      temporal_adaptation: 'Temporal Adaptation',
      hybrid_lora_dpo: 'LoRA + DPO',
      hybrid_full_rlhf: 'Full + RLHF',
      hybrid_moe_alignment: 'MoE + Alignment',
    };
    return names[method] || method;
  }

  private getMethodDescription(method: TrainingMethod): string {
    const descriptions: Record<TrainingMethod, string> = {
      lora: 'Low-rank matrix decomposition for efficient fine-tuning',
      qlora: '4-bit quantized LoRA for memory efficiency',
      dora: 'Separates weight updates into magnitude and direction',
      qdora: 'Quantized DoRA combining both techniques',
      adalora: 'Adaptive rank allocation per layer',
      vera: 'Shared frozen matrices with learnable scaling',
      relora: 'Iterative LoRA with accumulated updates',
      mora: 'Multiple LoRA modules for complex tasks',
      galore: 'Gradient projection for memory efficiency',
      longlora: 'Efficient long-context fine-tuning',
      full_finetune: 'Update all model parameters',
      full_finetune_fsdp: 'Full training with Fully Sharded Data Parallel',
      full_finetune_deepspeed: 'Full training with DeepSpeed optimization',
      dpo: 'Direct optimization from preference pairs without reward model',
      orpo: 'Combined SFT and preference optimization',
      rlhf_ppo: 'PPO-based reinforcement learning with reward model',
      grpo: 'Batch-level relative policy optimization',
      rlvr: 'RL from verifiable binary rewards',
      rlaif: 'Using AI feedback instead of human labels',
      constitutional_ai: 'Self-critique with constitutional principles',
      deepspeed_zero1: 'Optimizer state partitioning',
      deepspeed_zero2: 'Optimizer + gradient partitioning',
      deepspeed_zero3: 'Full model partitioning',
      deepspeed_infinity: 'NVMe offloading for huge models',
      fsdp: 'Native PyTorch distributed training',
      megatron_lm: 'Tensor + pipeline parallelism for massive scale',
      '3d_parallelism': 'Combined data, tensor, and pipeline parallelism',
      moe_diffusion: 'Expert networks for diffusion timesteps',
      dreambooth: 'Subject-specific image fine-tuning',
      textual_inversion: 'Learn custom token embeddings',
      voice_clone: 'Adapt TTS model to specific voice',
      temporal_adaptation: 'Temporal consistency for video models',
      hybrid_lora_dpo: 'Two-stage LoRA then DPO alignment',
      hybrid_full_rlhf: 'Multi-stage full training with RLHF',
      hybrid_moe_alignment: 'MoE expert training with preference alignment',
    };
    return descriptions[method] || 'Specialized training method';
  }

  private estimateMethodHours(method: TrainingMethod, tier: QualityTier): number {
    const baseHours: Record<string, number> = {
      lora: 2, qlora: 2, dora: 4, qdora: 3,
      full_finetune: 24, full_finetune_deepspeed: 48,
      dpo: 12, rlhf_ppo: 36, hybrid_lora_dpo: 16,
      hybrid_full_rlhf: 120, hybrid_moe_alignment: 200,
    };
    const multipliers: Record<QualityTier, number> = {
      consumer: 0.5, professional: 1, flagship: 2, research: 5
    };
    return Math.round((baseHours[method] || 8) * multipliers[tier]);
  }

  private estimateMethodCost(method: TrainingMethod, tier: QualityTier): { min: number; max: number } {
    const baseCosts: Record<string, { min: number; max: number }> = {
      lora: { min: 10, max: 30 },
      qlora: { min: 10, max: 25 },
      dora: { min: 50, max: 150 },
      full_finetune: { min: 200, max: 800 },
      dpo: { min: 100, max: 300 },
      hybrid_lora_dpo: { min: 150, max: 400 },
      hybrid_full_rlhf: { min: 2000, max: 6000 },
      hybrid_moe_alignment: { min: 5000, max: 15000 },
    };
    const multipliers: Record<QualityTier, number> = {
      consumer: 0.5, professional: 1, flagship: 2, research: 5
    };
    const base = baseCosts[method] || { min: 50, max: 200 };
    const mult = multipliers[tier];
    return { min: Math.round(base.min * mult), max: Math.round(base.max * mult) };
  }

  /**
   * Build data requirements based on capability and tier
   */
  private buildDataRequirements(capability: TrainingCapability, tier: QualityTier): DataRequirement[] {
    const requirements: DataRequirement[] = [];

    const dataTypes: Record<TrainingCapability, { type: DataRequirement['type']; format: string }> = {
      music_generation: { type: 'audio', format: 'wav/flac' },
      video_generation: { type: 'video', format: 'mp4/webm' },
      image_generation: { type: 'image', format: 'png/jpg' },
      voice_cloning: { type: 'audio', format: 'wav' },
      text_generation: { type: 'text', format: 'jsonl' },
      code_generation: { type: 'code', format: 'jsonl' },
      chat: { type: 'pairs', format: 'jsonl' },
      embeddings: { type: 'pairs', format: 'jsonl' },
      multimodal: { type: 'image', format: 'jsonl with images' },
      custom: { type: 'text', format: 'jsonl' },
    };

    const sampleCounts: Record<TrainingCapability, { min: number; rec: number; flagship: number }> = {
      music_generation: { min: 1000, rec: 10000, flagship: 100000 },
      video_generation: { min: 500, rec: 5000, flagship: 50000 },
      image_generation: { min: 100, rec: 1000, flagship: 10000 },
      voice_cloning: { min: 50, rec: 200, flagship: 1000 },
      text_generation: { min: 1000, rec: 10000, flagship: 100000 },
      code_generation: { min: 5000, rec: 50000, flagship: 500000 },
      chat: { min: 1000, rec: 10000, flagship: 100000 },
      embeddings: { min: 10000, rec: 100000, flagship: 1000000 },
      multimodal: { min: 1000, rec: 10000, flagship: 100000 },
      custom: { min: 500, rec: 5000, flagship: 50000 },
    };

    const qualityReqs: Record<TrainingCapability, string[]> = {
      music_generation: ['44.1kHz+', 'stereo', 'no clipping', 'genre-labeled'],
      video_generation: ['720p+', '24fps+', 'no watermarks', 'caption-labeled'],
      image_generation: ['512px+', 'no watermarks', 'caption-labeled'],
      voice_cloning: ['clean speech', 'single speaker', 'transcribed', 'no background noise'],
      text_generation: ['diverse examples', 'quality responses', 'formatted correctly'],
      code_generation: ['working code', 'well-documented', 'diverse languages'],
      chat: ['natural conversations', 'appropriate responses', 'diverse topics'],
      embeddings: ['relevant pairs', 'hard negatives', 'diverse domains'],
      multimodal: ['image-text pairs', 'high quality images', 'accurate descriptions'],
      custom: ['clean data', 'consistent format'],
    };

    const { type, format } = dataTypes[capability];
    const samples = sampleCounts[capability];
    const quality = qualityReqs[capability];

    requirements.push({
      type,
      format,
      minSamples: samples.min,
      recommendedSamples: samples.rec,
      flagshipSamples: samples.flagship,
      qualityRequirements: quality,
    });

    // Add preference pairs for alignment
    if (tier === 'flagship' || tier === 'research') {
      requirements.push({
        type: 'preferences',
        format: 'jsonl with chosen/rejected pairs',
        minSamples: 1000,
        recommendedSamples: 10000,
        flagshipSamples: 100000,
        qualityRequirements: ['clear preference', 'diverse examples', 'consistent criteria'],
      });
    }

    return requirements;
  }

  /**
   * Build GPU requirements based on capability and tier
   */
  private buildGPURequirements(capability: TrainingCapability, tier: QualityTier): GPURequirement {
    const requirements: Record<QualityTier, GPURequirement> = {
      consumer: {
        minVram: 16,
        recommendedVram: 24,
        minGpuCount: 1,
        recommendedGpuCount: 1,
        supportedGpus: ['RTX 4090', 'RTX 3090', 'A4000', 'L4'],
        requiresNvlink: false,
        requiresInfiniband: false,
      },
      professional: {
        minVram: 40,
        recommendedVram: 80,
        minGpuCount: 1,
        recommendedGpuCount: 2,
        supportedGpus: ['A100-40GB', 'A100-80GB', 'L40S', 'H100'],
        requiresNvlink: false,
        requiresInfiniband: false,
      },
      flagship: {
        minVram: 80,
        recommendedVram: 80,
        minGpuCount: 4,
        recommendedGpuCount: 8,
        supportedGpus: ['A100-80GB', 'H100'],
        requiresNvlink: true,
        requiresInfiniband: false,
      },
      research: {
        minVram: 80,
        recommendedVram: 80,
        minGpuCount: 8,
        recommendedGpuCount: 64,
        supportedGpus: ['H100'],
        requiresNvlink: true,
        requiresInfiniband: true,
      },
    };

    return requirements[tier];
  }

  /**
   * Build technical requirements
   */
  private buildTechnicalRequirements(capability: TrainingCapability, tier: QualityTier): TechnicalRequirement[] {
    const requirements: TechnicalRequirement[] = [
      { category: 'framework', requirement: 'PyTorch 2.0+', mandatory: true },
      { category: 'framework', requirement: 'CUDA 12.0+', mandatory: true },
    ];

    if (tier === 'flagship' || tier === 'research') {
      requirements.push(
        { category: 'framework', requirement: 'DeepSpeed', mandatory: true },
        { category: 'framework', requirement: 'Flash Attention 2', mandatory: true },
        { category: 'network', requirement: 'NVLink between GPUs', mandatory: true }
      );
    }

    if (capability === 'music_generation' || capability === 'voice_cloning') {
      requirements.push({ category: 'framework', requirement: 'torchaudio', mandatory: true });
    }

    if (capability === 'video_generation') {
      requirements.push(
        { category: 'framework', requirement: 'diffusers', mandatory: true },
        { category: 'storage', requirement: '1TB+ fast storage', mandatory: true }
      );
    }

    return requirements;
  }

  /**
   * Estimate data volume
   */
  private estimateDataVolume(capability: TrainingCapability, tier: QualityTier): string {
    const volumes: Record<TrainingCapability, Record<QualityTier, string>> = {
      music_generation: { consumer: '10GB', professional: '100GB', flagship: '1TB', research: '10TB' },
      video_generation: { consumer: '50GB', professional: '500GB', flagship: '5TB', research: '50TB' },
      image_generation: { consumer: '5GB', professional: '50GB', flagship: '500GB', research: '5TB' },
      voice_cloning: { consumer: '100MB', professional: '1GB', flagship: '10GB', research: '100GB' },
      text_generation: { consumer: '1GB', professional: '10GB', flagship: '100GB', research: '1TB' },
      code_generation: { consumer: '5GB', professional: '50GB', flagship: '500GB', research: '5TB' },
      chat: { consumer: '1GB', professional: '10GB', flagship: '100GB', research: '1TB' },
      embeddings: { consumer: '5GB', professional: '50GB', flagship: '500GB', research: '5TB' },
      multimodal: { consumer: '10GB', professional: '100GB', flagship: '1TB', research: '10TB' },
      custom: { consumer: '1GB', professional: '10GB', flagship: '100GB', research: '1TB' },
    };

    return volumes[capability]?.[tier] || '10GB';
  }

  /**
   * Estimate training time
   */
  private estimateTrainingTime(tier: QualityTier): string {
    const times: Record<QualityTier, string> = {
      consumer: '2-4 hours',
      professional: '8-24 hours',
      flagship: '3-7 days',
      research: '2-4 weeks',
    };
    return times[tier];
  }

  /**
   * Build cost estimate
   */
  private buildCostEstimate(tier: QualityTier, gpuReqs: GPURequirement): CostEstimate {
    const gpuCosts: Record<string, number> = {
      'RTX 4090': 0.69,
      'A100-40GB': 1.89,
      'A100-80GB': 2.49,
      'H100': 3.99,
    };

    const gpuType = gpuReqs.supportedGpus[0];
    const costPerHour = (gpuCosts[gpuType] || 2.49) * gpuReqs.recommendedGpuCount;

    const hourRanges: Record<QualityTier, { min: number; max: number }> = {
      consumer: { min: 2, max: 8 },
      professional: { min: 8, max: 48 },
      flagship: { min: 72, max: 200 },
      research: { min: 336, max: 1000 },
    };

    const hours = hourRanges[tier];

    return {
      gpuCostPerHour: costPerHour,
      estimatedHours: hours,
      estimatedTotal: {
        min: Math.round(hours.min * costPerHour),
        max: Math.round(hours.max * costPerHour),
      },
      currency: 'USD',
    };
  }

  /**
   * Build success criteria
   */
  private buildSuccessCriteria(capability: TrainingCapability, benchmark: string): TrainingSuccessCriterion[] {
    const criteria: TrainingSuccessCriterion[] = [
      {
        id: randomUUID(),
        description: 'Training completes without errors',
        metric: 'completion_status',
        targetValue: 'success',
        verificationMethod: 'automated',
        passed: false,
      },
      {
        id: randomUUID(),
        description: 'Final loss below threshold',
        metric: 'final_loss',
        targetValue: '< initial_loss * 0.5',
        verificationMethod: 'automated',
        passed: false,
      },
      {
        id: randomUUID(),
        description: 'Model generates coherent outputs',
        metric: 'output_quality',
        targetValue: 'coherent',
        verificationMethod: 'comparison',
        passed: false,
      },
    ];

    if (benchmark.includes('suno') || benchmark.includes('veo') || benchmark.includes('gpt')) {
      criteria.push({
        id: randomUUID(),
        description: `Quality comparable to ${benchmark}`,
        metric: 'benchmark_comparison',
        targetValue: 'comparable',
        verificationMethod: 'manual',
        passed: false,
      });
    }

    return criteria;
  }

  /**
   * Build evaluation strategy
   */
  private buildEvaluationStrategy(capability: TrainingCapability): EvaluationStrategy {
    const strategies: Record<TrainingCapability, EvaluationStrategy> = {
      music_generation: {
        method: 'human_eval',
        metrics: ['audio_quality', 'musicality', 'prompt_adherence'],
        humanEvalCriteria: ['Does it sound like real music?', 'Does it match the prompt?', 'Is the quality professional?'],
      },
      video_generation: {
        method: 'metric_suite',
        metrics: ['fvd', 'is', 'clip_score', 'temporal_consistency'],
        benchmarks: ['ucf101', 'kinetics'],
      },
      image_generation: {
        method: 'metric_suite',
        metrics: ['fid', 'clip_score', 'inception_score'],
        benchmarks: ['coco', 'imagenet'],
      },
      voice_cloning: {
        method: 'a_b_test',
        metrics: ['similarity', 'naturalness', 'intelligibility'],
        humanEvalCriteria: ['Does it sound like the target speaker?'],
      },
      text_generation: {
        method: 'benchmark_comparison',
        metrics: ['perplexity', 'bleu', 'rouge'],
        benchmarks: ['mmlu', 'humaneval', 'gsm8k'],
      },
      code_generation: {
        method: 'benchmark_comparison',
        metrics: ['pass@1', 'pass@10', 'syntax_accuracy'],
        benchmarks: ['humaneval', 'mbpp', 'apps'],
      },
      chat: {
        method: 'human_eval',
        metrics: ['helpfulness', 'harmlessness', 'honesty'],
        humanEvalCriteria: ['Is the response helpful?', 'Is it safe?', 'Is it accurate?'],
      },
      embeddings: {
        method: 'benchmark_comparison',
        metrics: ['ndcg', 'mrr', 'recall@k'],
        benchmarks: ['mteb', 'beir'],
      },
      multimodal: {
        method: 'benchmark_comparison',
        metrics: ['vqa_accuracy', 'caption_cider'],
        benchmarks: ['vqav2', 'textvqa', 'okvqa'],
      },
      custom: {
        method: 'loss_threshold',
        metrics: ['final_loss', 'validation_loss'],
      },
    };

    return strategies[capability] || strategies.custom;
  }

  /**
   * Build implementation plan
   */
  private buildImplementationPlan(capability: TrainingCapability, tier: QualityTier): ImplementationStep[] {
    const steps: ImplementationStep[] = [
      {
        id: randomUUID(),
        phase: 1,
        name: 'Environment Setup',
        description: 'Provision GPU resources and install dependencies',
        estimatedHours: 0.5,
        dependencies: [],
        deliverables: ['GPU pod running', 'Dependencies installed', 'Storage mounted'],
      },
      {
        id: randomUUID(),
        phase: 2,
        name: 'Data Preparation',
        description: 'Load, validate, and preprocess training data',
        estimatedHours: tier === 'flagship' ? 4 : 1,
        dependencies: ['phase-1'],
        deliverables: ['Data validated', 'Train/val split created', 'Data pipeline ready'],
      },
      {
        id: randomUUID(),
        phase: 3,
        name: 'Model Initialization',
        description: 'Load base model and configure training parameters',
        estimatedHours: 0.5,
        dependencies: ['phase-2'],
        deliverables: ['Model loaded', 'Optimizer configured', 'Training config set'],
      },
      {
        id: randomUUID(),
        phase: 4,
        name: 'Training Execution',
        description: 'Run training loop with monitoring',
        estimatedHours: tier === 'flagship' ? 100 : tier === 'professional' ? 20 : 4,
        dependencies: ['phase-3'],
        deliverables: ['Training complete', 'Checkpoints saved', 'Metrics logged'],
      },
    ];

    if (tier === 'flagship' || tier === 'research') {
      steps.push({
        id: randomUUID(),
        phase: 5,
        name: 'Alignment Training',
        description: 'Run DPO/RLHF alignment stage',
        estimatedHours: tier === 'research' ? 50 : 20,
        dependencies: ['phase-4'],
        deliverables: ['Aligned model', 'Preference scores', 'Quality metrics'],
      });
    }

    steps.push({
      id: randomUUID(),
      phase: steps.length + 1,
      name: 'Evaluation & Export',
      description: 'Evaluate model quality and export artifacts',
      estimatedHours: 1,
      dependencies: [`phase-${steps.length}`],
      deliverables: ['Evaluation report', 'Model exported', 'Usage examples'],
    });

    return steps;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createTrainingIntentLockEngine(): TrainingIntentLockEngine {
  return new TrainingIntentLockEngine();
}

export default TrainingIntentLockEngine;
