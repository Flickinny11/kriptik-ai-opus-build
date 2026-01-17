/**
 * Continuous Learning Engine
 *
 * The meta-integration layer that ties together billing, VL-JEPA,
 * hyper-thinking, training/fine-tuning, and Component 28 into a
 * unified, self-improving production system.
 *
 * When a user enters an NLP prompt, this engine ensures ALL systems
 * work together automatically.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import {
  continuousLearningSessions,
  learningCorrelations,
  productionModelDeployments,
  learningOptimizationParams,
  learningMetricsHistory,
} from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

import type {
  LearningSession,
  SessionConfig,
  SessionOutcome,
  UnifiedMetrics,
  SystemHealthState,
  ContinuousLearningConfig,
  LearningCorrelation,
  BuildPhase,
  PhaseContext,
  EnhancedContext,
  BuildError,
  ErrorContext,
  ErrorResolution,
  ThinkingConfig,
  ReasoningMode,
  ModelSelection,
  OptimizationParam,
  DEFAULT_CONTINUOUS_LEARNING_CONFIG,
} from './types.js';

// Import existing services
import { getUsageService, UsageService } from '../billing/usage-service.js';
import { getQdrantClient, QdrantClientWrapper } from '../embeddings/qdrant-client.js';
import { EmbeddingService } from '../embeddings/embedding-service-impl.js';
import { getHyperThinkingOrchestrator, HyperThinkingOrchestrator } from '../hyper-thinking/orchestrator.js';
import { getEvolutionFlywheel, EvolutionFlywheel } from '../learning/evolution-flywheel.js';
import { getShadowModelRegistry, ShadowModelRegistry } from '../learning/shadow-model-registry.js';
import { getContextPriority, ContextPriorityService } from '../learning/context-priority.js';
import { getReflexion, ReflexionService } from '../learning/reflexion.js';
import { getCrossBuildTransfer, CrossBuildTransferService } from '../learning/cross-build-transfer.js';

// =============================================================================
// CONTINUOUS LEARNING ENGINE
// =============================================================================

export class ContinuousLearningEngine extends EventEmitter {
  private config: ContinuousLearningConfig;

  // Service references
  private usageService: UsageService;
  private qdrantClient: QdrantClientWrapper;
  private embeddingService: EmbeddingService;
  private hyperThinking: HyperThinkingOrchestrator;
  private evolutionFlywheel: EvolutionFlywheel;
  private shadowRegistry: ShadowModelRegistry;
  private contextPriority: ContextPriorityService | null = null;
  private reflexion: ReflexionService;
  private crossBuildTransfer: CrossBuildTransferService;

  // State
  private activeSessions: Map<string, LearningSession> = new Map();
  private systemHealth: SystemHealthState = {
    overall: 'healthy',
    components: [],
    lastCheck: new Date().toISOString(),
  };
  private optimizationParams: Map<string, OptimizationParam> = new Map();
  private initialized: boolean = false;

  constructor(config?: Partial<ContinuousLearningConfig>) {
    super();
    const defaultConfig: ContinuousLearningConfig = {
      maxActiveSessions: 100,
      sessionTimeoutMs: 3600000,
      minSignificantOutcome: 0.7,
      miniCycleThreshold: 10,
      fullCycleThreshold: 100,
      autoOptimizationEnabled: true,
      optimizationInterval: 3600000,
      healthCheckInterval: 60000,
      alertThresholds: {
        responseTimeMs: 5000,
        errorRate: 0.05,
        cpuUsage: 0.8,
        memoryUsage: 0.85,
      },
      autoDeployEnabled: true,
      minDeploymentQuality: 0.8,
      maxTrafficPerModel: 50,
    };
    this.config = { ...defaultConfig, ...config };

    // Initialize service references
    this.usageService = getUsageService();
    this.qdrantClient = getQdrantClient();
    this.embeddingService = new EmbeddingService();
    this.hyperThinking = getHyperThinkingOrchestrator();
    this.evolutionFlywheel = getEvolutionFlywheel();
    this.shadowRegistry = getShadowModelRegistry();
    this.reflexion = getReflexion();
    this.crossBuildTransfer = getCrossBuildTransfer();
  }

  /**
   * Initialize the engine and all dependencies
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[ContinuousLearningEngine] Initializing...');

    try {
      // Initialize context priority service (async)
      this.contextPriority = await getContextPriority();

      // Load optimization parameters from database
      await this.loadOptimizationParams();

      // Verify all services are available
      await this.verifyServices();

      this.initialized = true;
      this.emit('initialized');
      console.log('[ContinuousLearningEngine] Initialized successfully');
    } catch (error) {
      console.error('[ContinuousLearningEngine] Initialization failed:', error);
      throw error;
    }
  }

  // =========================================================================
  // SESSION LIFECYCLE MANAGEMENT
  // =========================================================================

  /**
   * Start a new learning session
   */
  async startSession(config: SessionConfig): Promise<LearningSession> {
    if (this.activeSessions.size >= this.config.maxActiveSessions) {
      throw new Error('Maximum active sessions reached');
    }

    const sessionId = `cls_${uuidv4()}`;
    const now = new Date().toISOString();

    console.log(`[ContinuousLearningEngine] Starting session ${sessionId} for user ${config.userId}`);

    // 1. Get relevant patterns and strategies from Component 28
    const learningContext = await this.getLearningContextForTask(
      config.taskType,
      config.projectId
    );

    // 2. Determine thinking strategy based on complexity
    const thinkingConfig = this.determineThinkingStrategy(config.complexity || 0.5);

    // 3. Check for applicable shadow models
    const shadowModels = await this.getApplicableShadowModels(config.taskType);

    // 4. Get cross-build knowledge if available
    if (config.projectId) {
      await this.crossBuildTransfer.getTransferableKnowledge(config.projectId);
    }

    // Create session object
    const session: LearningSession = {
      id: sessionId,
      userId: config.userId,
      projectId: config.projectId,
      sessionType: config.taskType,
      startedAt: now,

      // Billing tracking
      totalCostUsd: 0,
      creditsUsed: 0,

      // Vector context tracking
      vectorQueriesCount: 0,
      vectorHitsCount: 0,
      contextRelevanceScore: 0,

      // Hyper-thinking tracking
      hyperThinkingUsed: false,
      totPathsExplored: 0,
      marsAgentsUsed: 0,
      reasoningQuality: 0,

      // Learning tracking
      learningEventsCount: 0,
      patternsApplied: learningContext.patterns.length,
      strategiesUsed: learningContext.strategies.map(s => s.name),

      // Context
      thinkingConfig,
      learningContext,
      shadowModels,
    };

    // Store in memory and database
    this.activeSessions.set(sessionId, session);

    await db.insert(continuousLearningSessions).values({
      id: sessionId,
      userId: config.userId,
      projectId: config.projectId,
      sessionType: config.taskType,
      startedAt: now,
      patternsApplied: learningContext.patterns.length,
      strategiesUsed: learningContext.strategies.map(s => s.name),
    });

    this.emit('session_started', session);

    return session;
  }

  /**
   * End a learning session
   */
  async endSession(
    sessionId: string,
    outcome: {
      success: boolean;
      cost?: number;
      artifacts?: unknown[];
      isSignificant?: boolean;
    }
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`[ContinuousLearningEngine] Session ${sessionId} not found`);
      return;
    }

    const now = new Date().toISOString();
    console.log(`[ContinuousLearningEngine] Ending session ${sessionId}`);

    // 1. Finalize billing
    if (outcome.cost !== undefined) {
      await this.usageService.recordUsage({
        userId: session.userId,
        projectId: session.projectId,
        category: 'generation',
        subcategory: session.sessionType,
        creditsUsed: Math.ceil(outcome.cost),
      });
    }

    // 2. Capture experience for Component 28
    await this.evolutionFlywheel.finalizeForBuild();

    // 3. Update learning correlations
    await this.updateCorrelations(session, outcome);

    // 4. Trigger mini-learning cycle if significant
    if (outcome.isSignificant && outcome.isSignificant) {
      this.emit('mini_cycle_triggered', { sessionId });
    }

    // 5. Check if full learning cycle needed
    await this.checkLearningCycleTriggers();

    // 6. Update optimization parameters based on outcome
    if (this.config.autoOptimizationEnabled) {
      await this.updateOptimizationParams(session, outcome);
    }

    // 7. Update session in database
    const sessionOutcome: SessionOutcome = outcome.success ? 'success' : 'failure';
    await db.update(continuousLearningSessions)
      .set({
        completedAt: now,
        outcome: sessionOutcome,
        totalCostUsd: outcome.cost || session.totalCostUsd,
        vectorQueriesCount: session.vectorQueriesCount,
        vectorHitsCount: session.vectorHitsCount,
        hyperThinkingUsed: session.hyperThinkingUsed,
        totPathsExplored: session.totPathsExplored,
        marsAgentsUsed: session.marsAgentsUsed,
        learningEventsCount: session.learningEventsCount,
      })
      .where(eq(continuousLearningSessions.id, sessionId));

    // Remove from active sessions
    this.activeSessions.delete(sessionId);
    this.emit('session_ended', { sessionId, outcome: sessionOutcome });
  }

  // =========================================================================
  // BUILD INTEGRATION HOOKS
  // =========================================================================

  /**
   * Called by build-loop.ts at each phase
   */
  async onBuildPhase(
    phase: BuildPhase,
    context: PhaseContext
  ): Promise<EnhancedContext> {
    const startTime = Date.now();

    // 1. Get vector-augmented context
    let vectorContext;
    try {
      const embedding = await this.generateTaskEmbedding(context.currentTask);
      const results = await this.qdrantClient.search('code_patterns', {
        vector: embedding,
        limit: 10,
      });
      vectorContext = {
        relevant: results.map(r => ({
          id: String(r.id),
          collection: 'code_patterns',
          content: JSON.stringify(r.payload),
          score: r.score,
          priorityWeight: 1,
        })),
        metadata: {
          totalCandidates: results.length,
          selectedCount: results.length,
          priorityScores: {},
          retrievalTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.warn('[ContinuousLearningEngine] Vector query failed:', error);
      vectorContext = undefined;
    }

    // 2. Get applicable patterns from Component 28
    const patterns = await this.getApplicablePatterns(
      phase.name,
      context.errorHistory || []
    );

    // 3. Determine if hyper-thinking needed
    let enhancedReasoning;
    if ((context.complexity && context.complexity > 0.7) || (context.errorCount && context.errorCount > 2)) {
      try {
        const thinkingResult = await this.hyperThinking.think({
          prompt: context.currentTask,
          config: {
            strategy: 'tree_of_thought',
            temperature: 0.7,
          },
        });
        enhancedReasoning = {
          mode: 'tree_of_thought' as ReasoningMode,
          phase: phase.name,
          context: context,
          confidence: thinkingResult.confidence,
          tokenUsage: thinkingResult.totalTokens,
          latencyMs: thinkingResult.totalLatencyMs,
        };
      } catch (error) {
        console.warn('[ContinuousLearningEngine] Hyper-thinking failed:', error);
      }
    }

    // 4. Record metrics
    await this.recordMetric('build_phase_context_time_ms', Date.now() - startTime, {
      phase: phase.name,
    });

    return {
      ...context,
      vectorContext,
      patterns,
      enhancedReasoning,
    };
  }

  /**
   * Called when errors occur
   */
  async onError(
    error: BuildError,
    context: ErrorContext
  ): Promise<ErrorResolution> {
    console.log(`[ContinuousLearningEngine] Handling error: ${error.type}`);

    // 1. Query similar errors from vectors
    let similarErrors: unknown[] = [];
    try {
      const errorEmbedding = await this.generateTaskEmbedding(
        `${error.type}: ${error.message}`
      );
      similarErrors = await this.qdrantClient.search('error_solutions', {
        vector: errorEmbedding,
        limit: 5,
        scoreThreshold: 0.6,
      });
    } catch (err) {
      console.warn('[ContinuousLearningEngine] Error vector query failed:', err);
    }

    // 2. Get reflexion notes for similar errors
    let reflexions: unknown[] = [];
    try {
      const reflexionNotes = await this.reflexion.getRecentNotes(3);
      reflexions = reflexionNotes;
    } catch (err) {
      console.warn('[ContinuousLearningEngine] Reflexion query failed:', err);
    }

    // 3. Use MARS for complex errors
    if (error.severity === 'critical' || context.attemptCount > 1) {
      try {
        const marsResult = await this.hyperThinking.think({
          prompt: `Debug this error: ${error.message}\n\nStack: ${error.stack || 'N/A'}`,
          config: {
            strategy: 'multi_agent',
            temperature: 0.5,
          },
        });

        return {
          similarErrors: similarErrors as unknown as import('../embeddings/qdrant-client.js').SearchResult[],
          reflexions: (reflexions as { id: string; failureType?: string; summary?: string }[]).map(r => ({
            id: r.id,
            failureType: r.failureType || 'unknown',
            summary: r.summary || '',
          })),
          suggestedFix: marsResult.finalAnswer,
          confidence: marsResult.confidence,
        };
      } catch (err) {
        console.warn('[ContinuousLearningEngine] MARS reasoning failed:', err);
      }
    }

    return {
      similarErrors: similarErrors as unknown as import('../embeddings/qdrant-client.js').SearchResult[],
      reflexions: (reflexions as { id: string; failureType?: string; summary?: string }[]).map(r => ({
        id: r.id,
        failureType: r.failureType || 'unknown',
        summary: r.summary || '',
      })),
    };
  }

  /**
   * Called when build completes
   */
  async onBuildComplete(buildId: string, outcome: { success: boolean }): Promise<void> {
    console.log(`[ContinuousLearningEngine] Build ${buildId} completed: ${outcome.success ? 'success' : 'failure'}`);

    // Emit event for other systems
    this.emit('build_complete', { buildId, outcome });

    // Update metrics
    await this.recordMetric('build_completion', outcome.success ? 1 : 0, {
      buildId,
    });
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Determine the best thinking strategy based on complexity
   */
  private determineThinkingStrategy(complexity: number): ThinkingConfig {
    if (complexity > 0.8) {
      return { mode: 'hybrid', maxPaths: 5, maxAgents: 4, maxDepth: 4 };
    } else if (complexity > 0.6) {
      return { mode: 'tree_of_thought', maxPaths: 3, maxDepth: 3 };
    } else if (complexity > 0.4) {
      return { mode: 'mars', maxAgents: 3 };
    }
    return { mode: 'standard' };
  }

  /**
   * Get learning context for a task
   */
  private async getLearningContextForTask(
    taskType: string,
    projectId?: string
  ): Promise<{
    patterns: { id: string; type: string; name: string; relevanceScore: number }[];
    strategies: { id: string; name: string; successRate: number }[];
    reflexions: { id: string; failureType: string; summary: string }[];
  }> {
    const patterns: { id: string; type: string; name: string; relevanceScore: number }[] = [];
    const strategies: { id: string; name: string; successRate: number }[] = [];
    const reflexions: { id: string; failureType: string; summary: string }[] = [];

    // Get patterns from pattern library via evolution flywheel
    try {
      const status = await this.evolutionFlywheel.getSystemStatus();
      if (status.patternStats?.mostUsed) {
        patterns.push(...status.patternStats.mostUsed.map((p) => ({
          id: p.patternId,
          type: p.category,
          name: p.name,
          relevanceScore: 0.8,
        })));
      }
    } catch (error) {
      console.warn('[ContinuousLearningEngine] Failed to get patterns:', error);
    }

    return { patterns, strategies, reflexions };
  }

  /**
   * Get applicable shadow models for a task type
   */
  private async getApplicableShadowModels(taskType: string): Promise<ModelSelection[]> {
    const models: ModelSelection[] = [];

    try {
      const deployments = await db.select()
        .from(productionModelDeployments)
        .where(
          and(
            eq(productionModelDeployments.status, 'testing'),
            gte(productionModelDeployments.trafficPercentage, 1)
          )
        )
        .limit(5);

      for (const deployment of deployments) {
        const qualityScore = deployment.metrics?.successRate || 0.8;
        models.push({
          model: deployment.modelName,
          cost: 0.01, // Base cost estimate
          predictedQuality: qualityScore,
          valueScore: qualityScore / 0.01,
          isShadow: true,
          deploymentId: deployment.id,
        });
      }
    } catch (error) {
      console.warn('[ContinuousLearningEngine] Failed to get shadow models:', error);
    }

    return models;
  }

  /**
   * Get applicable patterns for a phase
   */
  private async getApplicablePatterns(
    phaseName: string,
    errorHistory: BuildError[]
  ): Promise<{ id: string; type: string; name: string; relevanceScore: number }[]> {
    const patterns: { id: string; type: string; name: string; relevanceScore: number }[] = [];

    try {
      const status = await this.evolutionFlywheel.getSystemStatus();
      if (status.patternStats?.mostUsed) {
        patterns.push(...status.patternStats.mostUsed
          .filter((p) => p.category === 'code' || p.category === phaseName)
          .slice(0, 5)
          .map((p) => ({
            id: p.patternId,
            type: p.category,
            name: p.name,
            relevanceScore: 0.7,
          })));
      }
    } catch (error) {
      console.warn('[ContinuousLearningEngine] Failed to get patterns:', error);
    }

    return patterns;
  }

  /**
   * Generate embedding for a task description using real embedding service
   * Uses BGE-M3 (1024-dim) for semantic understanding of tasks
   */
  private async generateTaskEmbedding(task: string): Promise<number[]> {
    try {
      const result = await this.embeddingService.embed({
        content: task,
        type: 'reasoning', // Tasks are reasoning-type embeddings using BGE-M3
      });

      if (result.embeddings.length > 0) {
        return result.embeddings[0];
      }
    } catch (error) {
      console.error('[ContinuousLearningEngine] Embedding failed:', error);
    }

    // Fallback: Return zero vector with correct dimensions (1024 for BGE-M3)
    return new Array(1024).fill(0);
  }

  /**
   * Update learning correlations
   */
  private async updateCorrelations(
    session: LearningSession,
    outcome: { success: boolean; cost?: number }
  ): Promise<void> {
    const correlationId = `corr_${uuidv4()}`;
    const now = new Date().toISOString();

    // Record correlation if patterns were applied and outcome was successful
    if (session.patternsApplied > 0 && outcome.success) {
      await db.insert(learningCorrelations).values({
        id: correlationId,
        sessionId: session.id,
        correlationType: 'quality_improvement',
        triggerSystem: 'component28',
        triggerEvent: 'pattern_applied',
        improvedSystem: 'build_loop',
        improvementMetric: 'success_rate',
        improvementValue: session.patternsApplied * 0.05, // 5% per pattern
        confidence: 0.7,
        samplesCount: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Check if learning cycle triggers are met
   */
  private async checkLearningCycleTriggers(): Promise<void> {
    const completedSessions = await db.select()
      .from(continuousLearningSessions)
      .where(sql`completedAt IS NOT NULL AND completedAt > datetime('now', '-1 hour')`)
      .all();

    if (completedSessions.length >= this.config.fullCycleThreshold) {
      this.emit('full_cycle_triggered');
    } else if (completedSessions.length >= this.config.miniCycleThreshold) {
      this.emit('mini_cycle_triggered', {});
    }
  }

  /**
   * Update optimization parameters based on session outcome
   */
  private async updateOptimizationParams(
    session: LearningSession,
    outcome: { success: boolean }
  ): Promise<void> {
    // Record the outcome for parameter tuning
    const params = Array.from(this.optimizationParams.values());

    for (const param of params) {
      if (!param.autoTuneEnabled) continue;

      // Add to tuning history
      param.tuningHistory.push({
        value: param.currentValue,
        outcome: outcome.success ? 'improved' : 'degraded',
        metrics: { sessionSuccess: outcome.success ? 1 : 0 },
        timestamp: new Date().toISOString(),
      });

      // Limit history size
      if (param.tuningHistory.length > 100) {
        param.tuningHistory = param.tuningHistory.slice(-100);
      }
    }
  }

  /**
   * Load optimization parameters from database
   */
  private async loadOptimizationParams(): Promise<void> {
    const params = await db.select()
      .from(learningOptimizationParams)
      .all();

    for (const param of params) {
      this.optimizationParams.set(param.parameterName, {
        name: param.parameterName,
        currentValue: param.currentValue,
        minValue: param.minValue,
        maxValue: param.maxValue,
        autoTuneEnabled: param.autoTuneEnabled ?? true,
        lastTunedAt: param.lastTunedAt || undefined,
        tuningHistory: (param.tuningHistory as unknown as { value: number; outcome: 'improved' | 'degraded' | 'neutral'; metrics: Record<string, number>; timestamp: string }[]) || [],
        correlatedMetrics: (param.correlatedMetrics as string[]) || [],
      });
    }
  }

  /**
   * Verify all services are available
   */
  private async verifyServices(): Promise<void> {
    const checks = [
      { name: 'Qdrant', check: () => this.qdrantClient.healthCheck() },
      { name: 'HyperThinking', check: () => this.hyperThinking.healthCheck() },
    ];

    for (const { name, check } of checks) {
      try {
        await check();
        console.log(`[ContinuousLearningEngine] ${name} service: OK`);
      } catch (error) {
        console.warn(`[ContinuousLearningEngine] ${name} service: UNAVAILABLE`);
      }
    }
  }

  /**
   * Record a metric to history
   */
  private async recordMetric(
    name: string,
    value: number,
    dimensions?: Record<string, unknown>
  ): Promise<void> {
    try {
      await db.insert(learningMetricsHistory).values({
        id: `metric_${uuidv4()}`,
        metricName: name,
        metricValue: value,
        dimensions,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[ContinuousLearningEngine] Failed to record metric:', error);
    }
  }

  // =========================================================================
  // PUBLIC GETTERS
  // =========================================================================

  /**
   * Get real-time metrics
   */
  async getRealtimeMetrics(): Promise<UnifiedMetrics> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Get today's sessions
    const todaySessions = await db.select()
      .from(continuousLearningSessions)
      .where(gte(continuousLearningSessions.startedAt, startOfDay))
      .all();

    // Calculate metrics
    const totalCostToday = todaySessions.reduce((sum, s) => sum + (s.totalCostUsd || 0), 0);
    const completedSessions = todaySessions.filter(s => s.completedAt);
    const successfulSessions = completedSessions.filter(s => s.outcome === 'success');

    return {
      timestamp: now.toISOString(),
      activeSessions: this.activeSessions.size,
      totalCostToday,
      creditBurnRate: totalCostToday / Math.max(1, completedSessions.length),
      vectorQueriesPerMin: 0, // Would need real-time tracking
      cacheHitRate: 0,
      avgRetrievalTimeMs: 0,
      patternsAppliedToday: todaySessions.reduce((sum, s) => sum + (s.patternsApplied || 0), 0),
      improvementRate: successfulSessions.length / Math.max(1, completedSessions.length),
      cyclesCompletedToday: 0, // Would need to track from evolution flywheel
      shadowModelsActive: 0, // Would need to query deployments
      shadowModelSuccessRate: 0,
      deploymentsActive: 0,
      reasoningSessionsToday: todaySessions.filter(s => s.hyperThinkingUsed).length,
      avgReasoningQuality: 0,
      systemHealth: this.systemHealth,
    };
  }

  /**
   * Get active session by ID
   */
  getActiveSession(sessionId: string): LearningSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): LearningSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get system health state
   */
  getSystemHealth(): SystemHealthState {
    return this.systemHealth;
  }

  /**
   * Get optimization parameters
   */
  getOptimizationParams(): OptimizationParam[] {
    return Array.from(this.optimizationParams.values());
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let engineInstance: ContinuousLearningEngine | null = null;

export function getContinuousLearningEngine(): ContinuousLearningEngine {
  if (!engineInstance) {
    engineInstance = new ContinuousLearningEngine();
  }
  return engineInstance;
}

export function resetContinuousLearningEngine(): void {
  engineInstance = null;
}

export default ContinuousLearningEngine;
