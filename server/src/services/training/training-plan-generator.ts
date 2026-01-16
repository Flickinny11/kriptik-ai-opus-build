/**
 * Training Plan Generator - Flagship Training & Fine-Tuning
 *
 * Creates user-facing implementation plans with approval tiles from
 * TrainingContracts. Similar to how Builder View shows implementation plans.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { randomUUID } from 'crypto';
import {
  TrainingContract,
  TrainingCapability,
  TrainingMethod,
  QualityTier,
  CostEstimate,
  ImplementationStep,
  BaseModelRecommendation,
  TrainingMethodRecommendation,
  DataRequirement,
  GPURequirement,
} from './training-intent-lock.js';
import { ClaudeService, createOrchestratorClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';

// =============================================================================
// TYPES
// =============================================================================

export type TileCategory = 'model' | 'method' | 'data' | 'gpu' | 'config' | 'budget';
export type TileStatus = 'pending' | 'approved' | 'modified' | 'skipped';
export type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'modified' | 'rejected';
export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface Alternative {
  id: string;
  value: string;
  label: string;
  description: string;
  tradeoff: string;
  costImpact?: { min: number; max: number };
  timeImpact?: string;
}

export interface ImplementationTile {
  id: string;
  category: TileCategory;
  title: string;
  description: string;
  recommendation: string;
  alternatives: Alternative[];
  isRecommended: boolean;
  requiresApproval: boolean;
  status: TileStatus;
  userSelection?: string;
  metadata?: Record<string, unknown>;
}

export interface UserDecision {
  id: string;
  question: string;
  options: string[];
  required: boolean;
  answered: boolean;
  answer?: string;
}

export interface UserModification {
  id: string;
  tileId: string;
  timestamp: string;
  type: 'select_alternative' | 'custom_value' | 'nlp_modification';
  previousValue: string;
  newValue: string;
  nlpPrompt?: string;
}

export interface CostRange {
  min: number;
  max: number;
  currency: 'USD';
}

export interface TrainingImplementationPlan {
  id: string;
  contractId: string;
  userId: string;

  // Summary for user
  summary: {
    targetCapability: string;
    qualityBenchmark: string;
    estimatedTime: string;
    estimatedCost: CostRange;
    selectedMethod: string;
    gpuRequirement: string;
  };

  // Approval tiles
  tiles: ImplementationTile[];

  // Detailed steps (hidden by default)
  detailedSteps: ImplementationStep[];

  // User decisions needed
  pendingDecisions: UserDecision[];

  // State
  status: PlanStatus;
  userModifications: UserModification[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}

export interface BudgetAuthorization {
  maxBudget: number;
  notifyAt: number; // percentage
  freezeAt: number; // percentage
  notificationChannels: NotificationChannel[];
  termsAccepted: boolean;
}

export interface ApprovedTrainingPlan {
  id: string;
  planId: string;
  contractId: string;
  userId: string;
  plan: TrainingImplementationPlan;
  budgetAuthorization: BudgetAuthorization;
  lockedAt: string;
  jobId?: string;
}

export interface TileModification {
  type: 'select_alternative' | 'custom_value' | 'nlp_modification';
  value?: string;
  nlpPrompt?: string;
}

export interface PlanChange {
  tileId: string;
  field: string;
  previousValue: string;
  newValue: string;
  reason: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCapabilityName(capability: TrainingCapability): string {
  const names: Record<TrainingCapability, string> = {
    music_generation: 'Music Generation',
    video_generation: 'Video Generation',
    image_generation: 'Image Generation',
    voice_cloning: 'Voice Cloning',
    text_generation: 'Text Generation',
    code_generation: 'Code Generation',
    chat: 'Chat / Conversational AI',
    embeddings: 'Embeddings',
    multimodal: 'Multimodal',
    custom: 'Custom',
  };
  return names[capability] || capability;
}

function formatMethodName(method: TrainingMethod): string {
  return method
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('Lora', 'LoRA')
    .replace('Qlora', 'QLoRA')
    .replace('Dora', 'DoRA')
    .replace('Qdora', 'QDoRA')
    .replace('Dpo', 'DPO')
    .replace('Orpo', 'ORPO')
    .replace('Rlhf', 'RLHF')
    .replace('Ppo', 'PPO')
    .replace('Moe', 'MoE')
    .replace('Fsdp', 'FSDP');
}

function formatDataType(type: string): string {
  const types: Record<string, string> = {
    text: 'Text Data',
    audio: 'Audio Files',
    video: 'Video Files',
    image: 'Image Files',
    code: 'Code/Programming',
    pairs: 'Question-Answer Pairs',
    preferences: 'Preference Pairs',
  };
  return types[type] || type;
}

// =============================================================================
// TRAINING PLAN GENERATOR
// =============================================================================

export class TrainingPlanGenerator {
  private claudeService: ClaudeService;

  constructor() {
    this.claudeService = createOrchestratorClaudeService();
  }

  /**
   * Generate an implementation plan from a training contract
   */
  async generatePlan(contract: TrainingContract): Promise<TrainingImplementationPlan> {
    const planId = randomUUID();

    // Build tiles from contract
    const tiles = this.buildTiles(contract);

    // Build summary
    const summary = this.buildSummary(contract);

    // Build pending decisions
    const pendingDecisions = this.buildPendingDecisions(contract);

    const plan: TrainingImplementationPlan = {
      id: planId,
      contractId: contract.id,
      userId: contract.userId,
      summary,
      tiles,
      detailedSteps: contract.implementationPlan,
      pendingDecisions,
      status: 'draft',
      userModifications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return plan;
  }

  /**
   * Modify a tile in the plan
   */
  async modifyTile(
    plan: TrainingImplementationPlan,
    tileId: string,
    modification: TileModification,
    contract: TrainingContract
  ): Promise<{ plan: TrainingImplementationPlan; affectedTiles: string[] }> {
    const tileIndex = plan.tiles.findIndex(t => t.id === tileId);
    if (tileIndex === -1) {
      throw new Error(`Tile ${tileId} not found`);
    }

    const tile = plan.tiles[tileIndex];
    const affectedTiles: string[] = [tileId];

    // Record modification
    const mod: UserModification = {
      id: randomUUID(),
      tileId,
      timestamp: new Date().toISOString(),
      type: modification.type,
      previousValue: tile.userSelection || tile.recommendation,
      newValue: '',
      nlpPrompt: modification.nlpPrompt,
    };

    if (modification.type === 'nlp_modification' && modification.nlpPrompt) {
      // Parse NLP modification
      const parsed = await this.parseNlpModification(
        modification.nlpPrompt,
        tile,
        contract
      );
      mod.newValue = parsed.newValue;
      tile.userSelection = parsed.newValue;
      tile.status = 'modified';

      // Handle cascading changes
      if (parsed.affectedTiles) {
        for (const affectedTileId of parsed.affectedTiles) {
          if (!affectedTiles.includes(affectedTileId)) {
            affectedTiles.push(affectedTileId);
          }
        }
      }
    } else if (modification.value) {
      mod.newValue = modification.value;
      tile.userSelection = modification.value;
      tile.status = 'modified';
    }

    // Update tile
    plan.tiles[tileIndex] = tile;

    // Add modification to history
    plan.userModifications.push(mod);

    // Recalculate dependencies if needed
    this.recalculateDependencies(plan, affectedTiles, contract);

    // Update plan status and timestamp
    plan.status = 'modified';
    plan.updatedAt = new Date().toISOString();

    return { plan, affectedTiles };
  }

  /**
   * Approve a plan with budget authorization
   */
  async approvePlan(
    plan: TrainingImplementationPlan,
    budgetAuthorization: BudgetAuthorization,
    contract: TrainingContract
  ): Promise<ApprovedTrainingPlan> {
    if (!budgetAuthorization.termsAccepted) {
      throw new Error('Terms must be accepted to approve plan');
    }

    if (budgetAuthorization.maxBudget <= 0) {
      throw new Error('Budget must be greater than 0');
    }

    if (budgetAuthorization.notifyAt >= budgetAuthorization.freezeAt) {
      throw new Error('Notify threshold must be less than freeze threshold');
    }

    // Mark all pending tiles as approved
    for (const tile of plan.tiles) {
      if (tile.status === 'pending') {
        tile.status = 'approved';
      }
    }

    // Update plan status
    plan.status = 'approved';
    plan.approvedAt = new Date().toISOString();
    plan.updatedAt = plan.approvedAt;

    const approvedPlan: ApprovedTrainingPlan = {
      id: randomUUID(),
      planId: plan.id,
      contractId: contract.id,
      userId: contract.userId,
      plan,
      budgetAuthorization,
      lockedAt: plan.approvedAt,
    };

    return approvedPlan;
  }

  /**
   * Modify plan with AI (NLP input)
   */
  async modifyWithAI(
    plan: TrainingImplementationPlan,
    nlpModification: string,
    contract: TrainingContract
  ): Promise<{ plan: TrainingImplementationPlan; changes: PlanChange[] }> {
    const changes: PlanChange[] = [];

    // Parse the NLP modification to determine what needs to change
    const systemPrompt = `You are helping modify a training plan. The user wants to make changes.

Current plan summary:
- Target: ${plan.summary.targetCapability}
- Method: ${plan.summary.selectedMethod}
- Estimated cost: $${plan.summary.estimatedCost.min}-$${plan.summary.estimatedCost.max}
- Estimated time: ${plan.summary.estimatedTime}
- GPU: ${plan.summary.gpuRequirement}

Available tiles to modify:
${plan.tiles.map(t => `- ${t.category}: ${t.title} (current: ${t.userSelection || t.recommendation})`).join('\n')}

User's modification request: "${nlpModification}"

Respond with JSON only:
{
  "modifications": [
    {
      "tileCategory": "model|method|data|gpu|config|budget",
      "newValue": "the new value to set",
      "reason": "why this change addresses the user's request"
    }
  ],
  "explanation": "Brief explanation of what was changed"
}`;

    try {
      const response = await this.claudeService.generate(systemPrompt, {
        model: CLAUDE_MODELS.SONNET_4_5,
        maxTokens: 1000,
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        for (const mod of parsed.modifications || []) {
          const tile = plan.tiles.find(t => t.category === mod.tileCategory);
          if (tile) {
            changes.push({
              tileId: tile.id,
              field: tile.category,
              previousValue: tile.userSelection || tile.recommendation,
              newValue: mod.newValue,
              reason: mod.reason,
            });

            tile.userSelection = mod.newValue;
            tile.status = 'modified';

            plan.userModifications.push({
              id: randomUUID(),
              tileId: tile.id,
              timestamp: new Date().toISOString(),
              type: 'nlp_modification',
              previousValue: tile.recommendation,
              newValue: mod.newValue,
              nlpPrompt: nlpModification,
            });
          }
        }
      }
    } catch (error) {
      console.error('[TrainingPlanGenerator] AI modification error:', error);
    }

    plan.status = changes.length > 0 ? 'modified' : plan.status;
    plan.updatedAt = new Date().toISOString();

    return { plan, changes };
  }

  /**
   * Generate human-readable plan summary
   */
  generateReadableSummary(plan: TrainingImplementationPlan): string {
    const lines: string[] = [
      `Training Plan: ${plan.summary.targetCapability}`,
      ``,
      `Quality Target: ${plan.summary.qualityBenchmark}`,
      `Selected Method: ${plan.summary.selectedMethod}`,
      ``,
      `Resource Requirements:`,
      `- GPU: ${plan.summary.gpuRequirement}`,
      `- Estimated Time: ${plan.summary.estimatedTime}`,
      `- Estimated Cost: $${plan.summary.estimatedCost.min} - $${plan.summary.estimatedCost.max}`,
      ``,
      `Configuration Summary:`,
    ];

    for (const tile of plan.tiles) {
      const value = tile.userSelection || tile.recommendation;
      const status = tile.status === 'modified' ? ' (modified)' : '';
      lines.push(`- ${tile.title}: ${value}${status}`);
    }

    if (plan.status === 'approved' && plan.approvedAt) {
      lines.push(``, `Status: Approved on ${new Date(plan.approvedAt).toLocaleString()}`);
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private buildTiles(contract: TrainingContract): ImplementationTile[] {
    const tiles: ImplementationTile[] = [];

    // 1. Model Selection Tile
    tiles.push(this.buildModelTile(contract));

    // 2. Training Method Tile
    tiles.push(this.buildMethodTile(contract));

    // 3. Data Source Tile
    tiles.push(this.buildDataTile(contract));

    // 4. GPU Configuration Tile
    tiles.push(this.buildGpuTile(contract));

    // 5. Hyperparameter Config Tile
    tiles.push(this.buildConfigTile(contract));

    // 6. Budget Tile
    tiles.push(this.buildBudgetTile(contract));

    return tiles;
  }

  private buildModelTile(contract: TrainingContract): ImplementationTile {
    const recommended = contract.recommendedBaseModels[0];
    const alternatives: Alternative[] = contract.recommendedBaseModels.slice(1, 4).map(model => ({
      id: randomUUID(),
      value: model.modelId,
      label: model.displayName,
      description: `${model.sizeGB}GB, requires ${model.vramRequired}GB VRAM`,
      tradeoff: model.reasoning,
      costImpact: undefined,
    }));

    return {
      id: randomUUID(),
      category: 'model',
      title: 'Base Model',
      description: 'Select the foundation model for training',
      recommendation: recommended?.modelId || 'No model recommended',
      alternatives,
      isRecommended: true,
      requiresApproval: true,
      status: 'pending',
      metadata: {
        recommendedModel: recommended,
        license: recommended?.license,
        size: recommended?.sizeGB,
        vram: recommended?.vramRequired,
      },
    };
  }

  private buildMethodTile(contract: TrainingContract): ImplementationTile {
    const recommended = contract.recommendedMethods[0];
    const alternatives: Alternative[] = contract.recommendedMethods.slice(1, 4).map(method => ({
      id: randomUUID(),
      value: method.method,
      label: method.displayName,
      description: method.description,
      tradeoff: method.reasoning,
      costImpact: method.estimatedCostUsd,
      timeImpact: `${method.estimatedHours} hours`,
    }));

    return {
      id: randomUUID(),
      category: 'method',
      title: 'Training Method',
      description: 'Select the training approach for your model',
      recommendation: recommended?.method || 'lora',
      alternatives,
      isRecommended: true,
      requiresApproval: true,
      status: 'pending',
      metadata: {
        recommendedMethod: recommended,
        tier: recommended?.tier,
        estimatedHours: recommended?.estimatedHours,
        gpuRequirement: recommended?.gpuRequirement,
      },
    };
  }

  private buildDataTile(contract: TrainingContract): ImplementationTile {
    const dataReq = contract.dataRequirements[0];
    const alternatives: Alternative[] = [
      {
        id: randomUUID(),
        value: 'user_upload',
        label: 'Upload Your Data',
        description: 'Upload your own training data',
        tradeoff: 'Full control over data quality and content',
      },
      {
        id: randomUUID(),
        value: 'huggingface',
        label: 'HuggingFace Datasets',
        description: 'Use public datasets from HuggingFace',
        tradeoff: 'Large datasets available, but may need filtering',
      },
      {
        id: randomUUID(),
        value: 'hybrid',
        label: 'Hybrid Approach',
        description: 'Combine your data with public datasets',
        tradeoff: 'Best of both: your domain + scale',
      },
    ];

    return {
      id: randomUUID(),
      category: 'data',
      title: 'Training Data',
      description: `Provide ${formatDataType(dataReq?.type || 'text')} for training`,
      recommendation: contract.dataSourceStrategy,
      alternatives,
      isRecommended: true,
      requiresApproval: true,
      status: 'pending',
      metadata: {
        dataType: dataReq?.type,
        format: dataReq?.format,
        minSamples: dataReq?.minSamples,
        recommendedSamples: dataReq?.recommendedSamples,
        flagshipSamples: dataReq?.flagshipSamples,
        qualityRequirements: dataReq?.qualityRequirements,
      },
    };
  }

  private buildGpuTile(contract: TrainingContract): ImplementationTile {
    const gpuReq = contract.gpuRequirements;
    const recommended = gpuReq.supportedGpus[0];

    const alternatives: Alternative[] = gpuReq.supportedGpus.slice(1, 4).map(gpu => {
      const isHighEnd = gpu.includes('H100') || gpu.includes('A100-80GB');
      return {
        id: randomUUID(),
        value: gpu,
        label: gpu,
        description: `${isHighEnd ? 'High-end' : 'Professional'} GPU`,
        tradeoff: isHighEnd ? 'Faster training, higher cost' : 'Cost-effective option',
        costImpact: isHighEnd ? { min: 3.99, max: 6.84 } : { min: 1.89, max: 2.49 },
      };
    });

    return {
      id: randomUUID(),
      category: 'gpu',
      title: 'GPU Configuration',
      description: 'Select GPU type and count for training',
      recommendation: `${recommended} x${gpuReq.recommendedGpuCount}`,
      alternatives,
      isRecommended: true,
      requiresApproval: true,
      status: 'pending',
      metadata: {
        minVram: gpuReq.minVram,
        recommendedVram: gpuReq.recommendedVram,
        gpuCount: gpuReq.recommendedGpuCount,
        requiresNvlink: gpuReq.requiresNvlink,
        provider: 'runpod', // Default to RunPod
      },
    };
  }

  private buildConfigTile(contract: TrainingContract): ImplementationTile {
    const tier = contract.qualityTier;
    const configPresets: Record<QualityTier, { label: string; description: string }> = {
      consumer: { label: 'Quick Training', description: 'Fast iteration, lower cost' },
      professional: { label: 'Balanced', description: 'Good quality with reasonable cost' },
      flagship: { label: 'Maximum Quality', description: 'Best possible results' },
      research: { label: 'Research Grade', description: 'Experimental settings' },
    };

    const preset = configPresets[tier];

    const alternatives: Alternative[] = [
      {
        id: randomUUID(),
        value: 'recommended',
        label: 'Use Recommended Settings',
        description: `AI-optimized settings for ${formatCapabilityName(contract.targetCapability)}`,
        tradeoff: 'Best balance of quality and cost',
      },
      {
        id: randomUUID(),
        value: 'custom',
        label: 'Custom Configuration',
        description: 'Advanced users can modify hyperparameters',
        tradeoff: 'Full control, requires expertise',
      },
    ];

    return {
      id: randomUUID(),
      category: 'config',
      title: 'Training Configuration',
      description: 'Hyperparameters and training settings',
      recommendation: preset.label,
      alternatives,
      isRecommended: true,
      requiresApproval: false, // Optional
      status: 'pending',
      metadata: {
        tier,
        preset: preset.label,
        configDetails: {
          epochs: tier === 'flagship' ? 5 : tier === 'professional' ? 3 : 2,
          batchSize: tier === 'flagship' ? 8 : 4,
          learningRate: tier === 'flagship' ? 1e-5 : 2e-5,
          warmupRatio: 0.03,
          gradientCheckpointing: true,
        },
      },
    };
  }

  private buildBudgetTile(contract: TrainingContract): ImplementationTile {
    const cost = contract.estimatedCost;
    const recommended = Math.ceil(cost.estimatedTotal.max * 1.2); // 20% buffer

    const alternatives: Alternative[] = [
      {
        id: randomUUID(),
        value: String(cost.estimatedTotal.min),
        label: `Minimum: $${cost.estimatedTotal.min}`,
        description: 'Optimistic estimate, may require extension',
        tradeoff: 'Risk of training interruption',
      },
      {
        id: randomUUID(),
        value: String(recommended),
        label: `Recommended: $${recommended}`,
        description: 'Includes 20% safety buffer',
        tradeoff: 'Best for uninterrupted training',
      },
      {
        id: randomUUID(),
        value: String(cost.estimatedTotal.max * 2),
        label: `Premium: $${cost.estimatedTotal.max * 2}`,
        description: 'For complex training with retries',
        tradeoff: 'Maximum flexibility',
      },
    ];

    return {
      id: randomUUID(),
      category: 'budget',
      title: 'Budget Authorization',
      description: 'Set spending limits and notification preferences',
      recommendation: `$${recommended} (includes 20% buffer)`,
      alternatives,
      isRecommended: true,
      requiresApproval: true,
      status: 'pending',
      metadata: {
        estimatedMin: cost.estimatedTotal.min,
        estimatedMax: cost.estimatedTotal.max,
        recommendedBudget: recommended,
        gpuCostPerHour: cost.gpuCostPerHour,
        estimatedHours: cost.estimatedHours,
        defaultNotifyAt: 80,
        defaultFreezeAt: 100,
      },
    };
  }

  private buildSummary(contract: TrainingContract): TrainingImplementationPlan['summary'] {
    const method = contract.recommendedMethods[0];
    const gpu = contract.gpuRequirements;

    return {
      targetCapability: formatCapabilityName(contract.targetCapability),
      qualityBenchmark: contract.qualityBenchmark,
      estimatedTime: contract.estimatedTrainingTime,
      estimatedCost: {
        min: contract.estimatedCost.estimatedTotal.min,
        max: contract.estimatedCost.estimatedTotal.max,
        currency: 'USD',
      },
      selectedMethod: method ? formatMethodName(method.method) : 'LoRA',
      gpuRequirement: `${gpu.supportedGpus[0]} x${gpu.recommendedGpuCount}`,
    };
  }

  private buildPendingDecisions(contract: TrainingContract): UserDecision[] {
    const decisions: UserDecision[] = [];

    // Add decisions based on contract complexity
    if (contract.qualityTier === 'flagship' || contract.qualityTier === 'research') {
      decisions.push({
        id: randomUUID(),
        question: 'Do you want to enable automatic checkpointing?',
        options: ['Yes, save checkpoints every hour', 'Yes, save every 1000 steps', 'No, only final model'],
        required: false,
        answered: false,
      });
    }

    if (contract.dataRequirements.some(r => r.type === 'preferences')) {
      decisions.push({
        id: randomUUID(),
        question: 'How do you want to generate preference pairs?',
        options: ['Generate synthetically with AI', 'Upload my own pairs', 'Skip alignment training'],
        required: true,
        answered: false,
      });
    }

    return decisions;
  }

  private async parseNlpModification(
    nlpPrompt: string,
    tile: ImplementationTile,
    contract: TrainingContract
  ): Promise<{ newValue: string; affectedTiles?: string[] }> {
    const systemPrompt = `Parse this modification request for a training plan tile.

Tile: ${tile.title} (${tile.category})
Current value: ${tile.userSelection || tile.recommendation}
Available alternatives: ${tile.alternatives.map(a => a.label).join(', ')}

User request: "${nlpPrompt}"

Respond with JSON:
{
  "newValue": "the new value to set",
  "affectedTiles": ["array of tile categories that might need recalculation"],
  "reasoning": "why this value was chosen"
}`;

    try {
      const response = await this.claudeService.generate(systemPrompt, {
        model: CLAUDE_MODELS.HAIKU_3_5,
        maxTokens: 500,
        temperature: 0.2,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          newValue: parsed.newValue || tile.recommendation,
          affectedTiles: parsed.affectedTiles,
        };
      }
    } catch (error) {
      console.error('[TrainingPlanGenerator] NLP parse error:', error);
    }

    return { newValue: tile.recommendation };
  }

  private recalculateDependencies(
    plan: TrainingImplementationPlan,
    affectedTileIds: string[],
    contract: TrainingContract
  ): void {
    // Find tiles that need recalculation
    for (const tileId of affectedTileIds) {
      const tile = plan.tiles.find(t => t.id === tileId);
      if (!tile) continue;

      // Recalculate cost if GPU or method changed
      if (tile.category === 'gpu' || tile.category === 'method') {
        const budgetTile = plan.tiles.find(t => t.category === 'budget');
        if (budgetTile) {
          // Update budget estimates based on new selections
          const gpuTile = plan.tiles.find(t => t.category === 'gpu');
          const methodTile = plan.tiles.find(t => t.category === 'method');

          if (gpuTile?.metadata && methodTile?.metadata) {
            const hours = (methodTile.metadata.estimatedHours as number) || 10;
            const gpuCost = 2.49; // Default A100 cost
            const newMin = Math.round(hours * gpuCost * 0.8);
            const newMax = Math.round(hours * gpuCost * 1.2);

            budgetTile.metadata = {
              ...budgetTile.metadata,
              estimatedMin: newMin,
              estimatedMax: newMax,
            };
          }
        }
      }
    }

    // Update summary
    this.updateSummary(plan);
  }

  private updateSummary(plan: TrainingImplementationPlan): void {
    const methodTile = plan.tiles.find(t => t.category === 'method');
    const gpuTile = plan.tiles.find(t => t.category === 'gpu');
    const budgetTile = plan.tiles.find(t => t.category === 'budget');

    if (methodTile?.userSelection) {
      plan.summary.selectedMethod = formatMethodName(methodTile.userSelection as TrainingMethod);
    }

    if (gpuTile?.userSelection) {
      plan.summary.gpuRequirement = gpuTile.userSelection;
    }

    if (budgetTile?.metadata) {
      plan.summary.estimatedCost = {
        min: (budgetTile.metadata.estimatedMin as number) || plan.summary.estimatedCost.min,
        max: (budgetTile.metadata.estimatedMax as number) || plan.summary.estimatedCost.max,
        currency: 'USD',
      };
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createTrainingPlanGenerator(): TrainingPlanGenerator {
  return new TrainingPlanGenerator();
}

export default TrainingPlanGenerator;
