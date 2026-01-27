/**
 * Orchestrator Factory
 *
 * Creates the appropriate orchestrator based on build mode configuration.
 * This factory ensures the correct orchestrator is used for each build type:
 *
 * - SingleSandboxOrchestrator: DEFAULT for normal builds (95% of cases)
 * - MultiSandboxOrchestrator: For very large builds (100+ features)
 * - TournamentOrchestrator: For competing implementations
 *
 * The factory also handles:
 * - Feature flag checks
 * - Configuration validation
 * - Cost estimation logging
 * - Telemetry for orchestrator selection
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  determineBuildMode,
  getBuildModeConfig,
  estimateBuildCost,
  validateBuildModeConfig,
  getFeatureFlags,
  type BuildMode,
  type BuildModeConfig,
  type BuildComplexityMetrics,
  type CostEstimate,
} from './build-mode-config.js';
import type { IntentContract } from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ImplementationPlan {
  id: string;
  phases: PlanPhase[];
  features: PlanFeature[];
  estimatedDurationMinutes: number;
  dependencies: PlanDependency[];
}

export interface PlanPhase {
  id: string;
  name: string;
  order: number;
  tasks: PlanTask[];
}

export interface PlanTask {
  id: string;
  phaseId: string;
  description: string;
  type: 'ui' | 'api' | 'integration' | 'test' | 'config';
  dependencies: string[];
  estimatedMinutes: number;
  visualIntentId?: string;
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface PlanDependency {
  fromTaskId: string;
  toTaskId: string;
  type: 'blocks' | 'informs';
}

export interface OrchestratorConfig {
  buildId: string;
  intentContract: IntentContract;
  implementationPlan: ImplementationPlan;
  tournamentMode: boolean;
  tournamentCompetitors?: number;
  credentials: Record<string, string>;
  userTier?: 'free' | 'pro' | 'enterprise';
  forceMode?: BuildMode;
}

export interface OrchestrationResult {
  success: boolean;
  buildId: string;
  artifactId?: string;
  previewUrl?: string;
  buildDuration: number;
  verificationScore: number;
  errors?: string[];
  costUsd?: number;
}

/**
 * Base interface for all orchestrators.
 */
export interface BaseOrchestrator extends EventEmitter {
  readonly buildId: string;
  readonly mode: BuildMode;
  readonly config: BuildModeConfig;

  orchestrate(): Promise<OrchestrationResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  getStatus(): OrchestratorStatus;
}

export interface OrchestratorStatus {
  buildId: string;
  mode: BuildMode;
  state: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentPhase?: string;
  tasksCompleted: number;
  tasksPending: number;
  tasksInProgress: number;
  sandboxCount: number;
  activeSandboxes: number;
  startedAt?: string;
  estimatedCompletionAt?: string;
  errors: string[];
}

// =============================================================================
// ORCHESTRATOR FACTORY
// =============================================================================

export class OrchestratorFactory extends EventEmitter {
  private activeOrchestrators: Map<string, BaseOrchestrator> = new Map();

  /**
   * Create an orchestrator for the given configuration.
   *
   * This factory method:
   * 1. Determines the optimal build mode
   * 2. Validates the configuration
   * 3. Estimates costs
   * 4. Creates the appropriate orchestrator
   */
  async createOrchestrator(config: OrchestratorConfig): Promise<BaseOrchestrator> {
    const buildId = config.buildId || uuidv4();

    console.log(`[Orchestrator Factory] Creating orchestrator for build ${buildId}`);

    // Step 1: Determine build mode
    const buildModeConfig = this.determineBuildModeConfig(config);

    // Step 2: Validate configuration
    const validation = validateBuildModeConfig(buildModeConfig);
    if (!validation.valid) {
      throw new Error(`Invalid build mode config: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.warn(`[Orchestrator Factory] Warnings: ${validation.warnings.join(', ')}`);
    }

    // Step 3: Estimate and log costs
    const costEstimate = estimateBuildCost(
      buildModeConfig,
      config.implementationPlan.estimatedDurationMinutes
    );
    this.logCostEstimate(buildId, buildModeConfig, costEstimate);

    // Step 4: Create appropriate orchestrator
    let orchestrator: BaseOrchestrator;

    switch (buildModeConfig.mode) {
      case 'single-sandbox':
        orchestrator = await this.createSingleSandboxOrchestrator(
          buildId,
          buildModeConfig,
          config
        );
        break;

      case 'multi-sandbox':
        orchestrator = await this.createMultiSandboxOrchestrator(
          buildId,
          buildModeConfig,
          config
        );
        break;

      case 'tournament':
        orchestrator = await this.createTournamentOrchestrator(
          buildId,
          buildModeConfig,
          config
        );
        break;

      default:
        throw new Error(`Unknown build mode: ${buildModeConfig.mode}`);
    }

    // Track orchestrator
    this.activeOrchestrators.set(buildId, orchestrator);

    // Forward events
    this.setupEventForwarding(orchestrator, buildId);

    console.log(`[Orchestrator Factory] Created ${buildModeConfig.mode} orchestrator for ${buildId}`);

    return orchestrator;
  }

  /**
   * Get an active orchestrator by build ID.
   */
  getOrchestrator(buildId: string): BaseOrchestrator | undefined {
    return this.activeOrchestrators.get(buildId);
  }

  /**
   * List all active orchestrators.
   */
  listActiveOrchestrators(): Array<{ buildId: string; mode: BuildMode; status: OrchestratorStatus }> {
    const result: Array<{ buildId: string; mode: BuildMode; status: OrchestratorStatus }> = [];

    for (const [buildId, orchestrator] of this.activeOrchestrators) {
      result.push({
        buildId,
        mode: orchestrator.mode,
        status: orchestrator.getStatus(),
      });
    }

    return result;
  }

  /**
   * Cancel all active orchestrators.
   */
  async cancelAll(): Promise<void> {
    const cancelPromises: Promise<void>[] = [];

    for (const [buildId, orchestrator] of this.activeOrchestrators) {
      console.log(`[Orchestrator Factory] Cancelling orchestrator ${buildId}`);
      cancelPromises.push(orchestrator.cancel());
    }

    await Promise.allSettled(cancelPromises);
    this.activeOrchestrators.clear();
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private determineBuildModeConfig(config: OrchestratorConfig): BuildModeConfig {
    // Check feature flags
    const flags = getFeatureFlags();

    // If mode is forced, use that
    if (config.forceMode) {
      console.log(`[Orchestrator Factory] Forced mode: ${config.forceMode}`);
      return getBuildModeConfig(config.forceMode);
    }

    // Calculate complexity metrics
    const metrics: BuildComplexityMetrics = {
      taskCount: config.implementationPlan.phases.reduce(
        (sum, phase) => sum + phase.tasks.length,
        0
      ),
      featureCount: config.implementationPlan.features.length,
      estimatedDurationMinutes: config.implementationPlan.estimatedDurationMinutes,
      hasVisualIntents: config.implementationPlan.phases.some(
        phase => phase.tasks.some(task => task.visualIntentId)
      ),
      hasTournamentMode: config.tournamentMode,
      userTier: config.userTier || 'free',
    };

    // Determine optimal mode
    const buildModeConfig = determineBuildMode(metrics);

    // Apply feature flag overrides
    if (!flags.enableSingleSandboxDefault && buildModeConfig.mode === 'single-sandbox') {
      console.log('[Orchestrator Factory] Single-sandbox disabled by feature flag, using multi-sandbox');
      return getBuildModeConfig('multi-sandbox');
    }

    if (!flags.enableWorkStealing) {
      buildModeConfig.taskDistribution = 'round-robin';
    }

    if (!flags.enableMemorySnapshots) {
      buildModeConfig.useMemorySnapshots = false;
    }

    if (!flags.enableSharedVolumes) {
      buildModeConfig.useSharedVolume = false;
    }

    buildModeConfig.maxAgents = Math.min(
      buildModeConfig.maxAgents,
      flags.maxConcurrentAgents
    );

    return buildModeConfig;
  }

  private logCostEstimate(
    buildId: string,
    config: BuildModeConfig,
    estimate: CostEstimate
  ): void {
    console.log(`[Orchestrator Factory] Cost estimate for ${buildId}:`);
    console.log(`  Mode: ${config.mode}`);
    console.log(`  Sandboxes: ${config.sandboxCount}`);
    console.log(`  Agents: ${config.maxAgents}`);
    console.log(`  Estimated cost: $${estimate.totalCost.toFixed(4)}`);
    console.log(`  ${estimate.explanation}`);

    if (config.mode === 'single-sandbox') {
      console.log(`  Savings vs multi-sandbox: ${estimate.comparison.savings}%`);
    }

    this.emit('costEstimate', { buildId, estimate });
  }

  private async createSingleSandboxOrchestrator(
    buildId: string,
    modeConfig: BuildModeConfig,
    config: OrchestratorConfig
  ): Promise<BaseOrchestrator> {
    // Import dynamically to avoid circular dependencies
    const { SingleSandboxOrchestrator } = await import('./single-sandbox-orchestrator.js');

    return new SingleSandboxOrchestrator({
      buildId,
      modeConfig,
      intentContract: config.intentContract,
      implementationPlan: config.implementationPlan,
      credentials: config.credentials,
    });
  }

  private async createMultiSandboxOrchestrator(
    buildId: string,
    modeConfig: BuildModeConfig,
    config: OrchestratorConfig
  ): Promise<BaseOrchestrator> {
    // Import the existing multi-sandbox orchestrator
    const { MultiSandboxOrchestrator } = await import('./multi-sandbox-orchestrator.js');

    return new MultiSandboxOrchestrator({
      buildId,
      modeConfig,
      intentContract: config.intentContract,
      implementationPlan: config.implementationPlan,
      credentials: config.credentials,
    });
  }

  private async createTournamentOrchestrator(
    buildId: string,
    modeConfig: BuildModeConfig,
    config: OrchestratorConfig
  ): Promise<BaseOrchestrator> {
    // Tournament orchestrator wraps multiple single-sandbox orchestrators
    const { TournamentOrchestrator } = await import('./tournament-orchestrator.js');

    return new TournamentOrchestrator({
      buildId,
      modeConfig,
      intentContract: config.intentContract,
      implementationPlan: config.implementationPlan,
      credentials: config.credentials,
      competitorCount: config.tournamentCompetitors || modeConfig.sandboxCount,
    });
  }

  private setupEventForwarding(orchestrator: BaseOrchestrator, buildId: string): void {
    const events = [
      'started',
      'progress',
      'phaseStarted',
      'phaseCompleted',
      'taskStarted',
      'taskCompleted',
      'taskFailed',
      'verificationStarted',
      'verificationCompleted',
      'mergeStarted',
      'mergeCompleted',
      'completed',
      'failed',
      'cancelled',
    ];

    for (const event of events) {
      orchestrator.on(event, (data: unknown) => {
        this.emit(event, { buildId, ...data as Record<string, unknown> });
      });
    }

    // Handle cleanup when orchestrator finishes
    orchestrator.on('completed', () => {
      this.activeOrchestrators.delete(buildId);
    });

    orchestrator.on('failed', () => {
      this.activeOrchestrators.delete(buildId);
    });

    orchestrator.on('cancelled', () => {
      this.activeOrchestrators.delete(buildId);
    });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let orchestratorFactoryInstance: OrchestratorFactory | null = null;

export function getOrchestratorFactory(): OrchestratorFactory {
  if (!orchestratorFactoryInstance) {
    orchestratorFactoryInstance = new OrchestratorFactory();
  }
  return orchestratorFactoryInstance;
}

export function createOrchestratorFactory(): OrchestratorFactory {
  return new OrchestratorFactory();
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Quick helper to create an orchestrator.
 * This is the main entry point for starting a build.
 */
export async function createOrchestrator(
  config: OrchestratorConfig
): Promise<BaseOrchestrator> {
  const factory = getOrchestratorFactory();
  return factory.createOrchestrator(config);
}
