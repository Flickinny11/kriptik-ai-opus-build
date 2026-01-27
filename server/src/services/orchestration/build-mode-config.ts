/**
 * Build Mode Configuration
 *
 * CRITICAL ARCHITECTURE DECISION:
 * - SINGLE-SANDBOX is the DEFAULT for normal builds (95% of cases)
 * - MULTI-SANDBOX is only used for very large builds (100+ features)
 * - TOURNAMENT mode uses 3 sandboxes (one per competitor), NOT 15
 *
 * This configuration determines:
 * - How many sandboxes to spawn
 * - How agents are distributed
 * - Which context sharing strategy to use
 * - Cost and performance characteristics
 *
 * Cost Comparison (5-minute build):
 * - Single-sandbox: ~$0.002 (1 sandbox × 5 min)
 * - Multi-sandbox (5): ~$0.008 (5 sandboxes × 5 min ÷ 5 parallelism)
 * - Tournament (3 competitors): ~$0.006 (3 sandboxes × 5 min)
 */

// =============================================================================
// TYPES
// =============================================================================

export type BuildMode = 'single-sandbox' | 'multi-sandbox' | 'tournament';

export type ContextStrategy = 'local-memory' | 'redis-pubsub';

export interface BuildModeConfig {
  mode: BuildMode;
  maxAgents: number;
  sandboxCount: number;
  contextStrategy: ContextStrategy;
  useSharedVolume: boolean;
  useMemorySnapshots: boolean;
  taskDistribution: 'work-stealing' | 'round-robin' | 'dependency-aware';
  faultTolerance: 'retry-in-sandbox' | 'respawn-sandbox' | 'fail-fast';
}

export interface BuildComplexityMetrics {
  taskCount: number;
  featureCount: number;
  estimatedDurationMinutes: number;
  hasVisualIntents: boolean;
  hasTournamentMode: boolean;
  userTier: 'free' | 'pro' | 'enterprise';
}

export interface CostEstimate {
  sandboxCost: number;
  storageCost: number;
  totalCost: number;
  explanation: string;
  comparison: {
    singleSandbox: number;
    multiSandbox: number;
    savings: number;
  };
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

/**
 * Single-sandbox configuration (DEFAULT for normal builds)
 *
 * Benefits:
 * - Same speed as multi-sandbox (5 concurrent agents)
 * - Lower overhead (1 cold start instead of 5)
 * - No Redis latency (local memory context)
 * - No merge conflicts (shared filesystem)
 * - 75% cost savings vs multi-sandbox
 */
export const SINGLE_SANDBOX_CONFIG: BuildModeConfig = {
  mode: 'single-sandbox',
  maxAgents: 5,
  sandboxCount: 1,
  contextStrategy: 'local-memory',
  useSharedVolume: true,
  useMemorySnapshots: true,
  taskDistribution: 'work-stealing',
  faultTolerance: 'retry-in-sandbox',
};

/**
 * Multi-sandbox configuration (for very large builds)
 *
 * When to use:
 * - 100+ features
 * - Tasks with heavy I/O that benefit from true parallelism
 * - When fault isolation is critical
 */
export const MULTI_SANDBOX_CONFIG: BuildModeConfig = {
  mode: 'multi-sandbox',
  maxAgents: 5,
  sandboxCount: 5,
  contextStrategy: 'redis-pubsub',
  useSharedVolume: true,
  useMemorySnapshots: true,
  taskDistribution: 'dependency-aware',
  faultTolerance: 'respawn-sandbox',
};

/**
 * Tournament configuration (for competing implementations)
 *
 * Key optimization:
 * - 3 sandboxes total (one per competitor)
 * - NOT 15 sandboxes (5 agents × 3 competitors)
 * - Each sandbox runs 5 concurrent agents
 * - 80% cost savings vs naive approach
 */
export const TOURNAMENT_CONFIG: BuildModeConfig = {
  mode: 'tournament',
  maxAgents: 5,
  sandboxCount: 3, // One per competitor, NOT per agent!
  contextStrategy: 'redis-pubsub', // Cross-sandbox coordination for judging
  useSharedVolume: true,
  useMemorySnapshots: true,
  taskDistribution: 'work-stealing',
  faultTolerance: 'fail-fast', // Competitor fails = disqualified
};

// =============================================================================
// BUILD MODE DETERMINATION
// =============================================================================

/**
 * Determine the optimal build mode based on task complexity.
 *
 * Decision tree:
 * 1. Tournament mode requested? → TOURNAMENT (3 sandboxes)
 * 2. 100+ features? → MULTI-SANDBOX (for true parallelism)
 * 3. Default → SINGLE-SANDBOX (recommended for 95% of builds)
 */
export function determineBuildMode(metrics: BuildComplexityMetrics): BuildModeConfig {
  // Tournament mode: Always use tournament config
  if (metrics.hasTournamentMode) {
    console.log('[Build Mode] Tournament mode selected: 3 sandboxes (one per competitor)');
    return {
      ...TOURNAMENT_CONFIG,
      // Enterprise users get more competitors
      sandboxCount: metrics.userTier === 'enterprise' ? 5 : 3,
    };
  }

  // Very large builds: Consider multi-sandbox for true parallelism
  if (metrics.featureCount >= 100 || metrics.taskCount >= 50) {
    console.log('[Build Mode] Large build detected: Using multi-sandbox for parallelism');
    return {
      ...MULTI_SANDBOX_CONFIG,
      // Scale sandboxes with task count, max 10
      sandboxCount: Math.min(10, Math.ceil(metrics.taskCount / 10)),
    };
  }

  // Long builds (30+ min): Consider multi-sandbox for fault tolerance
  if (metrics.estimatedDurationMinutes >= 30 && metrics.userTier !== 'free') {
    console.log('[Build Mode] Long build detected: Using multi-sandbox for fault tolerance');
    return {
      ...MULTI_SANDBOX_CONFIG,
      sandboxCount: 3,
    };
  }

  // DEFAULT: Single-sandbox with concurrent agents
  console.log('[Build Mode] Standard build: Using single-sandbox (recommended)');
  return { ...SINGLE_SANDBOX_CONFIG };
}

/**
 * Get build mode configuration by name.
 */
export function getBuildModeConfig(mode: BuildMode): BuildModeConfig {
  switch (mode) {
    case 'single-sandbox':
      return { ...SINGLE_SANDBOX_CONFIG };
    case 'multi-sandbox':
      return { ...MULTI_SANDBOX_CONFIG };
    case 'tournament':
      return { ...TOURNAMENT_CONFIG };
    default:
      return { ...SINGLE_SANDBOX_CONFIG };
  }
}

// =============================================================================
// COST ESTIMATION
// =============================================================================

/**
 * Modal pricing (approximate, January 2026):
 * - CPU: ~$0.0000131 per core per second
 * - Memory: ~$0.0000016 per GB per second
 * - GPU (if used): ~$0.0004 per second for A10G
 *
 * Our standard sandbox: 2 cores, 4GB RAM
 * Cost per sandbox per second: ~$0.000033
 * Cost per sandbox per minute: ~$0.002
 */
const SANDBOX_COST_PER_SECOND = 0.000033;
const STORAGE_COST_PER_GB_MONTH = 0.015; // R2 pricing

/**
 * Estimate build cost for a given configuration.
 */
export function estimateBuildCost(
  config: BuildModeConfig,
  estimatedMinutes: number
): CostEstimate {
  const seconds = estimatedMinutes * 60;

  // Calculate sandbox cost
  // For single-sandbox, duration is full
  // For multi-sandbox, divide by parallelism factor
  const effectiveSeconds = config.mode === 'single-sandbox'
    ? seconds
    : seconds / Math.min(config.sandboxCount, config.maxAgents);

  const sandboxCost = config.sandboxCount * effectiveSeconds * SANDBOX_COST_PER_SECOND;

  // Storage cost (minimal, ~10MB per build artifact)
  const storageCost = (10 / 1024) * STORAGE_COST_PER_GB_MONTH / 30 / 24; // Cost for 1 hour

  const totalCost = sandboxCost + storageCost;

  // Calculate comparison with alternatives
  const singleSandboxCost = 1 * seconds * SANDBOX_COST_PER_SECOND;
  const multiSandboxCost = 5 * (seconds / 5) * SANDBOX_COST_PER_SECOND;

  return {
    sandboxCost: Math.round(sandboxCost * 10000) / 10000,
    storageCost: Math.round(storageCost * 10000) / 10000,
    totalCost: Math.round(totalCost * 10000) / 10000,
    explanation: generateCostExplanation(config, estimatedMinutes, totalCost),
    comparison: {
      singleSandbox: Math.round(singleSandboxCost * 10000) / 10000,
      multiSandbox: Math.round(multiSandboxCost * 10000) / 10000,
      savings: config.mode === 'single-sandbox'
        ? Math.round((1 - singleSandboxCost / multiSandboxCost) * 100)
        : 0,
    },
  };
}

function generateCostExplanation(
  config: BuildModeConfig,
  minutes: number,
  cost: number
): string {
  const mode = config.mode;
  const sandboxes = config.sandboxCount;

  if (mode === 'single-sandbox') {
    return `Single sandbox with ${config.maxAgents} concurrent agents for ${minutes} min = $${cost.toFixed(4)}. ` +
           `This is the most cost-effective option with same build speed.`;
  }

  if (mode === 'tournament') {
    return `${sandboxes} competing sandboxes (one per competitor) for ${minutes} min = $${cost.toFixed(4)}. ` +
           `Each sandbox runs ${config.maxAgents} concurrent agents.`;
  }

  return `${sandboxes} parallel sandboxes for ${Math.round(minutes / sandboxes)} min effective = $${cost.toFixed(4)}. ` +
         `True parallelism for large builds.`;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate build mode configuration.
 */
export function validateBuildModeConfig(config: BuildModeConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate sandbox count
  if (config.sandboxCount < 1) {
    errors.push('sandboxCount must be at least 1');
  }
  if (config.sandboxCount > 10) {
    errors.push('sandboxCount cannot exceed 10');
  }

  // Validate agent count
  if (config.maxAgents < 1) {
    errors.push('maxAgents must be at least 1');
  }
  if (config.maxAgents > 10) {
    warnings.push('maxAgents > 10 may cause performance issues');
  }

  // Validate context strategy matches mode
  if (config.mode === 'single-sandbox' && config.contextStrategy === 'redis-pubsub') {
    warnings.push('Single-sandbox mode should use local-memory context for best performance');
  }
  if (config.mode === 'multi-sandbox' && config.contextStrategy === 'local-memory') {
    errors.push('Multi-sandbox mode requires redis-pubsub context strategy');
  }

  // Validate tournament mode
  if (config.mode === 'tournament' && config.sandboxCount < 2) {
    errors.push('Tournament mode requires at least 2 sandboxes (competitors)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// FEATURE FLAGS
// =============================================================================

/**
 * Feature flags for gradual rollout of new build modes.
 */
export interface BuildModeFeatureFlags {
  enableSingleSandboxDefault: boolean;
  enableWorkStealing: boolean;
  enableMemorySnapshots: boolean;
  enableSharedVolumes: boolean;
  enableTournamentOptimization: boolean;
  maxConcurrentAgents: number;
}

export const DEFAULT_FEATURE_FLAGS: BuildModeFeatureFlags = {
  enableSingleSandboxDefault: true, // NEW DEFAULT: Single-sandbox
  enableWorkStealing: true,
  enableMemorySnapshots: true,
  enableSharedVolumes: true,
  enableTournamentOptimization: true, // 3 sandboxes instead of 15
  maxConcurrentAgents: 5,
};

/**
 * Get feature flags (can be overridden by environment variables).
 */
export function getFeatureFlags(): BuildModeFeatureFlags {
  return {
    enableSingleSandboxDefault:
      process.env.BUILD_SINGLE_SANDBOX_DEFAULT !== 'false',
    enableWorkStealing:
      process.env.BUILD_WORK_STEALING !== 'false',
    enableMemorySnapshots:
      process.env.BUILD_MEMORY_SNAPSHOTS !== 'false',
    enableSharedVolumes:
      process.env.BUILD_SHARED_VOLUMES !== 'false',
    enableTournamentOptimization:
      process.env.BUILD_TOURNAMENT_OPTIMIZATION !== 'false',
    maxConcurrentAgents:
      parseInt(process.env.BUILD_MAX_CONCURRENT_AGENTS || '5', 10),
  };
}
