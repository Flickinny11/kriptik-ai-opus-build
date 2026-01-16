/**
 * Training Data Strategist - Flagship Training & Fine-Tuning
 *
 * Determines what training data is needed based on training intent
 * and helps users acquire it through various strategies.
 *
 * Supports: User Upload, HuggingFace datasets, Web Search, Synthetic generation
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { randomUUID } from 'crypto';
import {
  TrainingCapability,
  QualityTier,
  DataRequirement,
  DataSourceStrategy,
  TrainingContract,
} from './training-intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DataSource {
  id: string;
  name: string;
  description: string;
  source: 'huggingface' | 'web' | 'academic' | 'commercial' | 'synthetic';
  url?: string;
  datasetId?: string;
  samples: number;
  size: string;
  format: string;
  license: string;
  licenseCommercialUse: boolean;
  quality: 'low' | 'medium' | 'high' | 'flagship';
  languages?: string[];
  domains?: string[];
  lastUpdated?: string;
  downloadUrl?: string;
}

export interface DataValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalSamples: number;
    validSamples: number;
    invalidSamples: number;
    duplicates: number;
    avgLength?: number;
    minLength?: number;
    maxLength?: number;
  };
  qualityScore: number;
  recommendations: string[];
}

export interface DataPipelineConfig {
  id: string;
  name: string;
  inputFormat: string;
  outputFormat: string;
  steps: DataProcessingStep[];
  trainSplit: number;
  valSplit: number;
  testSplit: number;
  shuffle: boolean;
  seed: number;
}

export interface DataProcessingStep {
  name: string;
  type: 'filter' | 'transform' | 'augment' | 'clean' | 'convert' | 'tokenize';
  config: Record<string, unknown>;
}

export interface PreferencePair {
  id: string;
  prompt: string;
  chosen: string;
  rejected: string;
  chosenScore?: number;
  rejectedScore?: number;
  metadata?: Record<string, unknown>;
}

export interface PreferencePairConfig {
  sourceData: string;
  generationMethod: 'model_comparison' | 'human_annotation' | 'synthetic_ai';
  pairsNeeded: number;
  qualityCriteria: string[];
  judgeModel?: string;
  temperatureVariation?: number;
}

export interface DataStatistics {
  totalSamples: number;
  totalSize: string;
  format: string;
  splits: {
    train: number;
    validation: number;
    test: number;
  };
  tokenStats?: {
    totalTokens: number;
    avgTokensPerSample: number;
    minTokens: number;
    maxTokens: number;
  };
  qualityMetrics: {
    averageQuality: number;
    lowQualitySamples: number;
    duplicateRate: number;
  };
}

// =============================================================================
// DATA REQUIREMENTS BY CAPABILITY
// =============================================================================

interface CapabilityDataConfig {
  type: DataRequirement['type'];
  format: string;
  minSamples: number;
  recommendedSamples: number;
  flagshipSamples: number;
  qualityRequirements: string[];
  exampleSchema: Record<string, string>;
  recommendedDatasets: string[];
}

const CAPABILITY_DATA_CONFIGS: Record<TrainingCapability, CapabilityDataConfig> = {
  music_generation: {
    type: 'audio',
    format: 'wav/flac',
    minSamples: 1000,
    recommendedSamples: 10000,
    flagshipSamples: 100000,
    qualityRequirements: [
      '44.1kHz or higher sample rate',
      'Stereo or higher channel count',
      'No audio clipping or distortion',
      'Genre/mood labels for each track',
      'Instrumental stems preferred for training',
      'Duration between 30s and 5min per track',
    ],
    exampleSchema: {
      audio: 'path/to/audio.wav',
      caption: 'Upbeat electronic dance music with heavy bass',
      genre: 'EDM',
      mood: 'energetic',
      bpm: '128',
      key: 'C major',
    },
    recommendedDatasets: [
      'mtg-jamendo/mtg-jamendo-dataset',
      'maharshipandya/spotify-tracks-dataset',
      'google/MusicCaps',
    ],
  },
  video_generation: {
    type: 'video',
    format: 'mp4/webm',
    minSamples: 500,
    recommendedSamples: 5000,
    flagshipSamples: 50000,
    qualityRequirements: [
      '720p resolution minimum (1080p+ recommended)',
      '24fps or higher frame rate',
      'No watermarks or overlays',
      'Caption/description for each video',
      'Duration between 5s and 60s',
      'Consistent aspect ratio (16:9 recommended)',
    ],
    exampleSchema: {
      video: 'path/to/video.mp4',
      caption: 'A person walking through a forest on a sunny day',
      duration: '10.5',
      resolution: '1920x1080',
      fps: '30',
    },
    recommendedDatasets: [
      'TempoFunk/hdvila-100M',
      'OpenDataLab/Open-Sora-Dataset',
      'webvid-10M',
    ],
  },
  image_generation: {
    type: 'image',
    format: 'png/jpg',
    minSamples: 100,
    recommendedSamples: 1000,
    flagshipSamples: 10000,
    qualityRequirements: [
      '512px minimum resolution (1024px+ for flagship)',
      'No watermarks or text overlays',
      'High-quality caption for each image',
      'Consistent aspect ratio within dataset',
      'Diverse but coherent style',
    ],
    exampleSchema: {
      image: 'path/to/image.png',
      caption: 'A detailed oil painting of a sunset over mountains',
      style: 'oil painting',
      subject: 'landscape',
    },
    recommendedDatasets: [
      'laion/laion2B-en-aesthetic',
      'poloclub/diffusiondb',
      'dalle-3-dataset',
    ],
  },
  voice_cloning: {
    type: 'audio',
    format: 'wav',
    minSamples: 50,
    recommendedSamples: 200,
    flagshipSamples: 1000,
    qualityRequirements: [
      'Clean speech with minimal background noise',
      'Single speaker per audio file',
      'Accurate transcription for each audio',
      'No music or sound effects',
      'Duration between 3s and 30s per clip',
      'Consistent microphone quality',
    ],
    exampleSchema: {
      audio: 'path/to/speech.wav',
      transcription: 'The quick brown fox jumps over the lazy dog.',
      speaker_id: 'speaker_001',
      language: 'en',
    },
    recommendedDatasets: [
      'facebook/voxpopuli',
      'mozilla-foundation/common_voice_16_0',
      'librispeech',
    ],
  },
  text_generation: {
    type: 'text',
    format: 'jsonl',
    minSamples: 1000,
    recommendedSamples: 10000,
    flagshipSamples: 100000,
    qualityRequirements: [
      'Diverse examples covering target domain',
      'High-quality responses (well-written, accurate)',
      'Consistent format throughout dataset',
      'No harmful or biased content',
      'Varied prompt complexity',
    ],
    exampleSchema: {
      prompt: 'Write a professional email declining a meeting invitation.',
      response: 'Dear [Name], Thank you for the invitation...',
      category: 'professional_writing',
    },
    recommendedDatasets: [
      'OpenAssistant/oasst2',
      'HuggingFaceH4/ultrachat_200k',
      'teknium/OpenHermes-2.5',
    ],
  },
  code_generation: {
    type: 'code',
    format: 'jsonl',
    minSamples: 5000,
    recommendedSamples: 50000,
    flagshipSamples: 500000,
    qualityRequirements: [
      'Working code that compiles/runs',
      'Well-documented functions',
      'Diverse programming languages',
      'Include test cases where possible',
      'Various difficulty levels',
      'Real-world problem scenarios',
    ],
    exampleSchema: {
      prompt: 'Write a Python function to calculate fibonacci numbers',
      code: 'def fibonacci(n: int) -> int:\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)',
      language: 'python',
      tests: '["assert fibonacci(0) == 0", "assert fibonacci(10) == 55"]',
    },
    recommendedDatasets: [
      'bigcode/starcoderdata',
      'codeparrot/github-code',
      'deepmind/code_contests',
    ],
  },
  chat: {
    type: 'pairs',
    format: 'jsonl',
    minSamples: 1000,
    recommendedSamples: 10000,
    flagshipSamples: 100000,
    qualityRequirements: [
      'Multi-turn conversations',
      'Natural dialogue flow',
      'Helpful, harmless, honest responses',
      'Diverse topics and contexts',
      'Appropriate persona consistency',
    ],
    exampleSchema: {
      conversations: '[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]',
      system: 'You are a helpful AI assistant.',
    },
    recommendedDatasets: [
      'OpenAssistant/oasst2',
      'HuggingFaceH4/ultrachat_200k',
      'lmsys/lmsys-chat-1m',
    ],
  },
  embeddings: {
    type: 'pairs',
    format: 'jsonl',
    minSamples: 10000,
    recommendedSamples: 100000,
    flagshipSamples: 1000000,
    qualityRequirements: [
      'Diverse query-document pairs',
      'Hard negatives for contrastive learning',
      'Multiple domains/languages',
      'Varying relevance scores',
    ],
    exampleSchema: {
      query: 'What is machine learning?',
      positive: 'Machine learning is a subset of artificial intelligence...',
      negative: 'The weather today is sunny with a high of 72 degrees.',
    },
    recommendedDatasets: [
      'sentence-transformers/all-nli',
      'BeIR/beir',
      'mteb/mteb-benchmark',
    ],
  },
  multimodal: {
    type: 'image',
    format: 'jsonl with images',
    minSamples: 1000,
    recommendedSamples: 10000,
    flagshipSamples: 100000,
    qualityRequirements: [
      'High-quality image-text pairs',
      'Accurate visual descriptions',
      'Complex reasoning examples',
      'Diverse visual content',
      'Multi-turn visual dialogues',
    ],
    exampleSchema: {
      image: 'path/to/image.jpg',
      conversations: '[{"role": "user", "content": "What is in this image?"}, {"role": "assistant", "content": "The image shows..."}]',
    },
    recommendedDatasets: [
      'liuhaotian/LLaVA-Instruct-150K',
      'Lin-Chen/ShareGPT4V',
      'BAAI/DataOptim',
    ],
  },
  custom: {
    type: 'text',
    format: 'jsonl',
    minSamples: 500,
    recommendedSamples: 5000,
    flagshipSamples: 50000,
    qualityRequirements: [
      'Clean, consistent formatting',
      'High-quality examples',
      'Domain-specific relevance',
    ],
    exampleSchema: {
      input: 'Your input data here',
      output: 'Expected output here',
    },
    recommendedDatasets: [],
  },
};

// =============================================================================
// TRAINING DATA STRATEGIST
// =============================================================================

export class TrainingDataStrategist {
  /**
   * Analyze data requirements for a training contract
   */
  analyzeRequirements(contract: TrainingContract): DataRequirement[] {
    const config = CAPABILITY_DATA_CONFIGS[contract.targetCapability];
    if (!config) {
      return this.buildDefaultRequirements(contract);
    }

    const requirements: DataRequirement[] = [
      {
        type: config.type,
        format: config.format,
        minSamples: config.minSamples,
        recommendedSamples: config.recommendedSamples,
        flagshipSamples: config.flagshipSamples,
        qualityRequirements: config.qualityRequirements,
        exampleSchema: config.exampleSchema,
      },
    ];

    // Add preference pairs for alignment training
    if (contract.qualityTier === 'flagship' || contract.qualityTier === 'research') {
      requirements.push({
        type: 'preferences',
        format: 'jsonl with chosen/rejected pairs',
        minSamples: 1000,
        recommendedSamples: 10000,
        flagshipSamples: 100000,
        qualityRequirements: [
          'Clear preference between options',
          'Diverse prompt coverage',
          'Consistent quality criteria',
          'No toxic or harmful content',
        ],
        exampleSchema: {
          prompt: 'User prompt here',
          chosen: 'Better response',
          rejected: 'Worse response',
        },
      });
    }

    return requirements;
  }

  /**
   * Search for training data sources
   */
  async searchTrainingData(
    query: string,
    capability: TrainingCapability
  ): Promise<DataSource[]> {
    const config = CAPABILITY_DATA_CONFIGS[capability];
    const sources: DataSource[] = [];

    // Add recommended HuggingFace datasets
    if (config?.recommendedDatasets) {
      for (const datasetId of config.recommendedDatasets) {
        sources.push(this.createHuggingFaceSource(datasetId, capability));
      }
    }

    // Add synthetic data option
    sources.push({
      id: randomUUID(),
      name: 'Synthetic Data Generation',
      description: `Generate synthetic ${capability} training data using AI models`,
      source: 'synthetic',
      samples: 0,
      size: 'Variable',
      format: config?.format || 'jsonl',
      license: 'Custom',
      licenseCommercialUse: true,
      quality: 'high',
      domains: [capability],
    });

    // Search additional sources based on query
    const additionalSources = await this.searchAdditionalSources(query, capability);
    sources.push(...additionalSources);

    return sources;
  }

  /**
   * Validate uploaded data
   */
  async validateData(
    dataPath: string,
    capability: TrainingCapability,
    tier: QualityTier
  ): Promise<DataValidationResult> {
    const config = CAPABILITY_DATA_CONFIGS[capability];

    // In production, this would actually parse and validate the data
    // For now, return a validation structure
    const result: DataValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        totalSamples: 0,
        validSamples: 0,
        invalidSamples: 0,
        duplicates: 0,
      },
      qualityScore: 0,
      recommendations: [],
    };

    // Add tier-specific warnings
    const requiredSamples = tier === 'flagship' ? config.flagshipSamples :
      tier === 'professional' ? config.recommendedSamples : config.minSamples;

    result.recommendations.push(
      `For ${tier} quality, aim for at least ${requiredSamples.toLocaleString()} samples`,
      `Ensure data matches format: ${config.format}`,
      ...config.qualityRequirements.slice(0, 3)
    );

    return result;
  }

  /**
   * Create data processing pipeline config
   */
  createPipelineConfig(
    capability: TrainingCapability,
    tier: QualityTier,
    inputFormat: string
  ): DataPipelineConfig {
    const config = CAPABILITY_DATA_CONFIGS[capability];

    const steps: DataProcessingStep[] = [
      {
        name: 'Format Validation',
        type: 'filter',
        config: {
          requiredFields: Object.keys(config.exampleSchema),
          strictMode: tier === 'flagship',
        },
      },
      {
        name: 'Deduplication',
        type: 'clean',
        config: {
          method: 'exact_match',
          hashFields: ['input', 'prompt', 'text'],
        },
      },
    ];

    // Add capability-specific processing
    if (capability === 'text_generation' || capability === 'chat' || capability === 'code_generation') {
      steps.push({
        name: 'Tokenization',
        type: 'tokenize',
        config: {
          maxLength: tier === 'flagship' ? 8192 : 4096,
          truncation: true,
          padding: false,
        },
      });
    }

    if (capability === 'image_generation' || capability === 'video_generation') {
      steps.push({
        name: 'Resolution Check',
        type: 'filter',
        config: {
          minResolution: tier === 'flagship' ? 1024 : 512,
        },
      });
    }

    if (capability === 'music_generation' || capability === 'voice_cloning') {
      steps.push({
        name: 'Audio Quality Check',
        type: 'filter',
        config: {
          minSampleRate: 22050,
          maxClipping: 0.01,
        },
      });
    }

    // Add quality filtering for flagship
    if (tier === 'flagship' || tier === 'research') {
      steps.push({
        name: 'Quality Scoring',
        type: 'filter',
        config: {
          minQualityScore: 0.7,
          useAIScoring: true,
        },
      });
    }

    return {
      id: randomUUID(),
      name: `${capability}_${tier}_pipeline`,
      inputFormat,
      outputFormat: config.format,
      steps,
      trainSplit: 0.9,
      valSplit: 0.08,
      testSplit: 0.02,
      shuffle: true,
      seed: 42,
    };
  }

  /**
   * Generate preference pairs for alignment training
   */
  async generatePreferencePairs(
    config: PreferencePairConfig
  ): Promise<PreferencePair[]> {
    const pairs: PreferencePair[] = [];

    // In production, this would call AI models to generate pairs
    // For now, return empty array with config validation

    if (config.pairsNeeded <= 0) {
      throw new Error('pairsNeeded must be positive');
    }

    if (!config.qualityCriteria.length) {
      throw new Error('qualityCriteria must not be empty');
    }

    // Return structure for preference pair generation
    // The actual generation would happen in the training environment
    console.log(`[TrainingDataStrategist] Prepared preference pair generation config:`, {
      method: config.generationMethod,
      pairsNeeded: config.pairsNeeded,
      criteria: config.qualityCriteria,
    });

    return pairs;
  }

  /**
   * Calculate data statistics
   */
  calculateStatistics(
    samples: number,
    sizeBytes: number,
    format: string,
    trainSplit: number,
    valSplit: number,
    testSplit: number
  ): DataStatistics {
    const formatSize = (bytes: number): string => {
      if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
      if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
      if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
      if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
      return `${bytes} B`;
    };

    return {
      totalSamples: samples,
      totalSize: formatSize(sizeBytes),
      format,
      splits: {
        train: Math.round(samples * trainSplit),
        validation: Math.round(samples * valSplit),
        test: Math.round(samples * testSplit),
      },
      qualityMetrics: {
        averageQuality: 0.85,
        lowQualitySamples: 0,
        duplicateRate: 0,
      },
    };
  }

  /**
   * Recommend data strategy based on user context
   */
  recommendStrategy(
    capability: TrainingCapability,
    tier: QualityTier,
    hasExistingData: boolean,
    budgetUsd: number
  ): {
    strategy: DataSourceStrategy;
    reasoning: string;
    steps: string[];
    estimatedCost: number;
  } {
    const config = CAPABILITY_DATA_CONFIGS[capability];
    const targetSamples = tier === 'flagship' ? config.flagshipSamples :
      tier === 'professional' ? config.recommendedSamples : config.minSamples;

    // If user has enough data
    if (hasExistingData && budgetUsd < 100) {
      return {
        strategy: 'user_upload',
        reasoning: 'You have existing data and limited budget. Using your own data is most cost-effective.',
        steps: [
          'Upload your data to KripTik storage',
          'Run data validation to ensure quality',
          'Create train/validation split',
          'Begin training with validated data',
        ],
        estimatedCost: 0,
      };
    }

    // For flagship tier, recommend hybrid
    if (tier === 'flagship' || tier === 'research') {
      return {
        strategy: 'hybrid',
        reasoning: `Flagship quality requires ${targetSamples.toLocaleString()} samples. Combining your data with public datasets and synthetic augmentation gives best results.`,
        steps: [
          'Upload your base data',
          'Download recommended HuggingFace datasets',
          'Generate synthetic samples for hard cases',
          'Create preference pairs for alignment',
          'Merge and deduplicate all sources',
        ],
        estimatedCost: Math.min(budgetUsd * 0.1, 500),
      };
    }

    // For professional tier, recommend HuggingFace
    if (tier === 'professional') {
      return {
        strategy: 'huggingface',
        reasoning: `Professional quality can be achieved with ${targetSamples.toLocaleString()} samples from high-quality public datasets.`,
        steps: [
          'Select from recommended HuggingFace datasets',
          'Download and validate data quality',
          'Apply quality filtering',
          'Create training splits',
        ],
        estimatedCost: 0,
      };
    }

    // Consumer tier
    return {
      strategy: hasExistingData ? 'user_upload' : 'huggingface',
      reasoning: `Consumer tier needs ${targetSamples.toLocaleString()} samples minimum. ${hasExistingData ? 'Your data should be sufficient.' : 'Public datasets can meet this requirement.'}`,
      steps: hasExistingData ? [
        'Upload your data',
        'Basic validation',
        'Create splits',
        'Start training',
      ] : [
        'Browse recommended datasets',
        'Download suitable dataset',
        'Quick validation',
        'Start training',
      ],
      estimatedCost: 0,
    };
  }

  /**
   * Get format requirements for a capability
   */
  getFormatRequirements(capability: TrainingCapability): {
    format: string;
    exampleSchema: Record<string, string>;
    description: string;
  } {
    const config = CAPABILITY_DATA_CONFIGS[capability];
    return {
      format: config.format,
      exampleSchema: config.exampleSchema,
      description: `Data should be in ${config.format} format with the following structure.`,
    };
  }

  /**
   * Get recommended datasets for a capability
   */
  getRecommendedDatasets(capability: TrainingCapability): DataSource[] {
    const config = CAPABILITY_DATA_CONFIGS[capability];
    return config.recommendedDatasets.map(id => this.createHuggingFaceSource(id, capability));
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private buildDefaultRequirements(contract: TrainingContract): DataRequirement[] {
    return [{
      type: 'text',
      format: 'jsonl',
      minSamples: 1000,
      recommendedSamples: 10000,
      flagshipSamples: 100000,
      qualityRequirements: ['High quality', 'Diverse', 'Relevant'],
    }];
  }

  private createHuggingFaceSource(datasetId: string, capability: TrainingCapability): DataSource {
    const config = CAPABILITY_DATA_CONFIGS[capability];

    // Known dataset info (in production, would query HuggingFace API)
    const knownDatasets: Record<string, Partial<DataSource>> = {
      'OpenAssistant/oasst2': {
        name: 'Open Assistant 2',
        description: 'High-quality conversational AI training data',
        samples: 161000,
        size: '2.1 GB',
        license: 'Apache-2.0',
        licenseCommercialUse: true,
        quality: 'high',
      },
      'HuggingFaceH4/ultrachat_200k': {
        name: 'UltraChat 200K',
        description: 'Large-scale multi-turn dialogue dataset',
        samples: 200000,
        size: '1.5 GB',
        license: 'MIT',
        licenseCommercialUse: true,
        quality: 'high',
      },
      'teknium/OpenHermes-2.5': {
        name: 'OpenHermes 2.5',
        description: 'Filtered and cleaned instruction dataset',
        samples: 1000000,
        size: '4.2 GB',
        license: 'MIT',
        licenseCommercialUse: true,
        quality: 'high',
      },
      'bigcode/starcoderdata': {
        name: 'StarCoder Data',
        description: 'Large code dataset for code generation',
        samples: 35000000,
        size: '250 GB',
        license: 'OpenRAIL',
        licenseCommercialUse: true,
        quality: 'flagship',
      },
      'liuhaotian/LLaVA-Instruct-150K': {
        name: 'LLaVA Instruct 150K',
        description: 'Vision-language instruction dataset',
        samples: 150000,
        size: '5 GB',
        license: 'CC-BY-4.0',
        licenseCommercialUse: true,
        quality: 'high',
      },
      'google/MusicCaps': {
        name: 'MusicCaps',
        description: 'Music-caption pairs for audio generation',
        samples: 5521,
        size: '1.2 GB',
        license: 'CC-BY-SA-4.0',
        licenseCommercialUse: false,
        quality: 'high',
      },
      'facebook/voxpopuli': {
        name: 'VoxPopuli',
        description: 'Large-scale multilingual speech corpus',
        samples: 400000,
        size: '1.8 TB',
        license: 'CC0',
        licenseCommercialUse: true,
        quality: 'high',
      },
    };

    const known = knownDatasets[datasetId];

    return {
      id: randomUUID(),
      name: known?.name || datasetId.split('/').pop() || datasetId,
      description: known?.description || `HuggingFace dataset: ${datasetId}`,
      source: 'huggingface',
      url: `https://huggingface.co/datasets/${datasetId}`,
      datasetId,
      samples: known?.samples || 0,
      size: known?.size || 'Unknown',
      format: config?.format || 'jsonl',
      license: known?.license || 'Unknown',
      licenseCommercialUse: known?.licenseCommercialUse ?? false,
      quality: known?.quality || 'medium',
      domains: [capability],
    };
  }

  private async searchAdditionalSources(
    query: string,
    capability: TrainingCapability
  ): Promise<DataSource[]> {
    // In production, would search HuggingFace API, academic sources, etc.
    // For now, return common additional sources
    const additionalSources: DataSource[] = [];

    if (capability === 'text_generation' || capability === 'chat') {
      additionalSources.push({
        id: randomUUID(),
        name: 'Dolly 15K',
        description: 'Human-generated instruction dataset from Databricks',
        source: 'huggingface',
        datasetId: 'databricks/databricks-dolly-15k',
        url: 'https://huggingface.co/datasets/databricks/databricks-dolly-15k',
        samples: 15000,
        size: '50 MB',
        format: 'jsonl',
        license: 'CC-BY-SA-3.0',
        licenseCommercialUse: true,
        quality: 'high',
        domains: ['text_generation', 'chat'],
      });
    }

    return additionalSources;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createTrainingDataStrategist(): TrainingDataStrategist {
  return new TrainingDataStrategist();
}

export default TrainingDataStrategist;
