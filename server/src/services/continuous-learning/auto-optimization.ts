/**
 * Auto-Optimization System
 *
 * Automatically tunes parameters across all systems based on observed
 * performance, creating a self-improving platform.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { learningOptimizationParams, learningCorrelations, learningMetricsHistory } from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

import type {
  OptimizationParam,
  OptimizationResult,
  OptimizationCorrelation,
  AdjustedParam,
  ImpactEstimate,
  ParamTuning,
} from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface AutoOptimizationConfig {
  enabled: boolean;
  cycleInterval: number; // ms
  safetyMargin: number; // % change allowed per cycle
  minSamples: number; // Minimum samples before tuning
  rollbackThreshold: number; // Performance drop to trigger rollback
}

const DEFAULT_CONFIG: AutoOptimizationConfig = {
  enabled: true,
  cycleInterval: 3600000, // 1 hour
  safetyMargin: 0.1, // 10% max change
  minSamples: 100,
  rollbackThreshold: 0.1, // 10% drop triggers rollback
};

// =============================================================================
// PARAMETER DEFINITIONS
// =============================================================================

interface ParameterDefinition {
  name: string;
  description: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  correlatedMetrics: string[];
  optimizationGoal: 'maximize' | 'minimize' | 'target';
  targetValue?: number;
}

const DEFAULT_PARAMETERS: ParameterDefinition[] = [
  {
    name: 'pattern_relevance_threshold',
    description: 'Minimum relevance score to apply a pattern',
    defaultValue: 0.7,
    minValue: 0.5,
    maxValue: 0.95,
    correlatedMetrics: ['success_rate', 'patterns_applied'],
    optimizationGoal: 'maximize',
  },
  {
    name: 'hyper_thinking_complexity_threshold',
    description: 'Complexity score above which to enable hyper-thinking',
    defaultValue: 0.7,
    minValue: 0.4,
    maxValue: 0.9,
    correlatedMetrics: ['success_rate', 'total_cost', 'reasoning_quality'],
    optimizationGoal: 'target',
    targetValue: 0.65,
  },
  {
    name: 'shadow_model_traffic_percentage',
    description: 'Default traffic percentage for new shadow model deployments',
    defaultValue: 5,
    minValue: 1,
    maxValue: 30,
    correlatedMetrics: ['total_cost', 'success_rate'],
    optimizationGoal: 'maximize',
  },
  {
    name: 'vector_cache_ttl',
    description: 'TTL for vector query cache in minutes',
    defaultValue: 5,
    minValue: 1,
    maxValue: 30,
    correlatedMetrics: ['cache_hit_rate', 'retrieval_time'],
    optimizationGoal: 'maximize',
  },
  {
    name: 'error_escalation_delay',
    description: 'Delay before escalating to next error level in seconds',
    defaultValue: 30,
    minValue: 10,
    maxValue: 120,
    correlatedMetrics: ['success_rate', 'total_cost'],
    optimizationGoal: 'target',
    targetValue: 45,
  },
  {
    name: 'min_training_pairs',
    description: 'Minimum preference pairs before triggering training',
    defaultValue: 100,
    minValue: 50,
    maxValue: 500,
    correlatedMetrics: ['model_quality', 'training_frequency'],
    optimizationGoal: 'target',
    targetValue: 150,
  },
];

// =============================================================================
// AUTO-OPTIMIZATION SYSTEM
// =============================================================================

export class AutoOptimizationSystem extends EventEmitter {
  private config: AutoOptimizationConfig;
  private parameters: Map<string, OptimizationParam> = new Map();
  private cycleInterval: ReturnType<typeof setInterval> | null = null;
  private lastCycleResult: OptimizationResult | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<AutoOptimizationConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the optimization system
   */
  async initialize(): Promise<void> {
    console.log('[AutoOptimizationSystem] Initializing...');

    // Load parameters from database or create defaults
    await this.loadOrCreateParameters();

    this.emit('initialized');
  }

  /**
   * Load parameters from database or create defaults
   */
  private async loadOrCreateParameters(): Promise<void> {
    const existingParams = await db.select()
      .from(learningOptimizationParams)
      .all();

    const existingNames = new Set(existingParams.map(p => p.parameterName));

    // Load existing
    for (const param of existingParams) {
      this.parameters.set(param.parameterName, {
        name: param.parameterName,
        currentValue: param.currentValue,
        minValue: param.minValue,
        maxValue: param.maxValue,
        autoTuneEnabled: param.autoTuneEnabled ?? true,
        lastTunedAt: param.lastTunedAt || undefined,
        tuningHistory: (param.tuningHistory as ParamTuning[]) || [],
        correlatedMetrics: (param.correlatedMetrics as string[]) || [],
      });
    }

    // Create missing defaults
    for (const def of DEFAULT_PARAMETERS) {
      if (!existingNames.has(def.name)) {
        const param: OptimizationParam = {
          name: def.name,
          currentValue: def.defaultValue,
          minValue: def.minValue,
          maxValue: def.maxValue,
          autoTuneEnabled: true,
          tuningHistory: [],
          correlatedMetrics: def.correlatedMetrics,
        };

        await db.insert(learningOptimizationParams).values({
          id: `param_${uuidv4()}`,
          parameterName: def.name,
          currentValue: def.defaultValue,
          minValue: def.minValue,
          maxValue: def.maxValue,
          autoTuneEnabled: true,
          correlatedMetrics: def.correlatedMetrics,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        this.parameters.set(def.name, param);
      }
    }
  }

  /**
   * Register a new parameter
   */
  async registerParameter(
    name: string,
    config: {
      defaultValue: number;
      minValue: number;
      maxValue: number;
      correlatedMetrics?: string[];
    }
  ): Promise<void> {
    if (this.parameters.has(name)) {
      return;
    }

    const param: OptimizationParam = {
      name,
      currentValue: config.defaultValue,
      minValue: config.minValue,
      maxValue: config.maxValue,
      autoTuneEnabled: true,
      tuningHistory: [],
      correlatedMetrics: config.correlatedMetrics || [],
    };

    await db.insert(learningOptimizationParams).values({
      id: `param_${uuidv4()}`,
      parameterName: name,
      currentValue: config.defaultValue,
      minValue: config.minValue,
      maxValue: config.maxValue,
      autoTuneEnabled: true,
      correlatedMetrics: config.correlatedMetrics,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.parameters.set(name, param);
    this.emit('parameter_registered', { name, config });
  }

  /**
   * Start optimization cycles
   */
  startCycles(): void {
    if (this.cycleInterval || !this.config.enabled) return;

    console.log('[AutoOptimizationSystem] Starting optimization cycles...');
    this.isRunning = true;

    // Run initial cycle after short delay
    setTimeout(() => this.runOptimizationCycle(), 5000);

    // Schedule periodic cycles
    this.cycleInterval = setInterval(() => {
      this.runOptimizationCycle();
    }, this.config.cycleInterval);

    this.emit('started');
  }

  /**
   * Stop optimization cycles
   */
  stopCycles(): void {
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Run a single optimization cycle
   */
  async runOptimizationCycle(): Promise<OptimizationResult> {
    console.log('[AutoOptimizationSystem] Running optimization cycle...');

    const timestamp = new Date().toISOString();
    const correlations: OptimizationCorrelation[] = [];
    const adjustedParams: AdjustedParam[] = [];
    const improvements: Record<string, number> = {};

    try {
      // 1. Analyze correlations
      const correlationData = await this.analyzeCorrelations();
      correlations.push(...correlationData);

      // 2. For each parameter, determine if adjustment is needed
      for (const [name, param] of this.parameters) {
        if (!param.autoTuneEnabled) continue;

        // Check if we have enough samples
        if (param.tuningHistory.length < 10) continue;

        // Find relevant correlations
        const relevantCorrelations = correlations.filter(c =>
          param.correlatedMetrics.includes(c.metrics[0])
        );

        if (relevantCorrelations.length === 0) continue;

        // Calculate optimal value
        const newValue = await this.calculateOptimalValue(param, relevantCorrelations);

        // Check if change is significant and within safety margin
        const changePercent = Math.abs(newValue - param.currentValue) / param.currentValue;

        if (changePercent > 0.01 && changePercent <= this.config.safetyMargin) {
          const adjusted = await this.applyOptimization(name, newValue);
          if (adjusted) {
            adjustedParams.push(adjusted);
            improvements[name] = changePercent;
          }
        }
      }

      const result: OptimizationResult = {
        correlations,
        adjustedParams,
        improvements,
        timestamp,
      };

      this.lastCycleResult = result;
      this.emit('optimization_complete', result);

      return result;

    } catch (error) {
      console.error('[AutoOptimizationSystem] Optimization cycle failed:', error);
      return {
        correlations: [],
        adjustedParams: [],
        improvements: {},
        timestamp,
      };
    }
  }

  /**
   * Analyze correlations between parameters and metrics
   */
  private async analyzeCorrelations(): Promise<OptimizationCorrelation[]> {
    const correlations: OptimizationCorrelation[] = [];

    // Get recent metric history
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const metricsHistory = await db.select()
      .from(learningMetricsHistory)
      .where(gte(learningMetricsHistory.timestamp, oneWeekAgo))
      .orderBy(learningMetricsHistory.timestamp)
      .all();

    // Group by metric name
    const metricsByName: Record<string, number[]> = {};
    for (const metric of metricsHistory) {
      if (!metricsByName[metric.metricName]) {
        metricsByName[metric.metricName] = [];
      }
      metricsByName[metric.metricName].push(metric.metricValue);
    }

    // Calculate correlations between parameters and metrics
    for (const [paramName, param] of this.parameters) {
      for (const metricName of param.correlatedMetrics) {
        const metricValues = metricsByName[metricName];
        if (!metricValues || metricValues.length < 10) continue;

        // Simple correlation based on parameter changes and metric changes
        const correlation = this.calculateCorrelation(param.tuningHistory, metricValues);

        if (Math.abs(correlation) > 0.3) { // Only significant correlations
          correlations.push({
            param: paramName,
            metrics: [metricName],
            correlation,
            confidence: Math.min(0.9, param.tuningHistory.length / 100),
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Calculate correlation between parameter changes and metric changes
   */
  private calculateCorrelation(tuningHistory: ParamTuning[], metricValues: number[]): number {
    if (tuningHistory.length < 2 || metricValues.length < 2) return 0;

    // Simple correlation: positive if improvements correlate with metric improvements
    let positiveCorrelations = 0;
    let totalComparisons = 0;

    for (const tuning of tuningHistory) {
      if (tuning.outcome === 'improved') positiveCorrelations++;
      totalComparisons++;
    }

    return totalComparisons > 0 ? (positiveCorrelations / totalComparisons) * 2 - 1 : 0;
  }

  /**
   * Calculate optimal value for a parameter
   */
  private async calculateOptimalValue(
    param: OptimizationParam,
    correlations: OptimizationCorrelation[]
  ): Promise<number> {
    // Get parameter definition
    const definition = DEFAULT_PARAMETERS.find(d => d.name === param.name);

    if (definition?.optimizationGoal === 'target' && definition.targetValue !== undefined) {
      // Move towards target value
      const direction = definition.targetValue > param.currentValue ? 1 : -1;
      const step = (param.maxValue - param.minValue) * 0.1;
      return Math.max(param.minValue, Math.min(param.maxValue,
        param.currentValue + direction * step
      ));
    }

    // For maximize/minimize, use correlation data
    const avgCorrelation = correlations.length > 0
      ? correlations.reduce((sum, c) => sum + c.correlation, 0) / correlations.length
      : 0;

    const direction = definition?.optimizationGoal === 'minimize' ? -avgCorrelation : avgCorrelation;
    const step = (param.maxValue - param.minValue) * this.config.safetyMargin;

    return Math.max(param.minValue, Math.min(param.maxValue,
      param.currentValue + direction * step
    ));
  }

  /**
   * Evaluate the impact of a parameter change
   */
  async evaluateParameterChange(
    paramName: string,
    newValue: number
  ): Promise<ImpactEstimate> {
    const param = this.parameters.get(paramName);
    if (!param) {
      throw new Error(`Parameter ${paramName} not found`);
    }

    const definition = DEFAULT_PARAMETERS.find(d => d.name === paramName);
    const estimatedChange: Record<string, number> = {};
    const risks: string[] = [];

    // Estimate impact on correlated metrics
    for (const metric of param.correlatedMetrics) {
      const changePercent = (newValue - param.currentValue) / param.currentValue;
      estimatedChange[metric] = changePercent * 0.5; // Conservative estimate
    }

    // Identify risks
    if (Math.abs(newValue - param.currentValue) / param.currentValue > 0.2) {
      risks.push('Large change may cause instability');
    }

    if (newValue < param.minValue + (param.maxValue - param.minValue) * 0.1) {
      risks.push('Value near minimum bound');
    }

    if (newValue > param.maxValue - (param.maxValue - param.minValue) * 0.1) {
      risks.push('Value near maximum bound');
    }

    return {
      param: paramName,
      newValue,
      estimatedChange,
      confidence: 0.6,
      risks,
    };
  }

  /**
   * Apply an optimization (update parameter value)
   */
  async applyOptimization(paramName: string, newValue: number): Promise<AdjustedParam | null> {
    const param = this.parameters.get(paramName);
    if (!param) return null;

    const oldValue = param.currentValue;
    const reason = `Auto-optimized from ${oldValue.toFixed(4)} to ${newValue.toFixed(4)}`;
    const expectedImpact = (newValue - oldValue) / oldValue;

    // Update in memory
    param.currentValue = newValue;
    param.lastTunedAt = new Date().toISOString();
    param.tuningHistory.push({
      value: newValue,
      outcome: 'neutral', // Will be updated after observing results
      metrics: {},
      timestamp: new Date().toISOString(),
    });

    // Limit history size
    if (param.tuningHistory.length > 100) {
      param.tuningHistory = param.tuningHistory.slice(-100);
    }

    // Update in database
    await db.update(learningOptimizationParams)
      .set({
        currentValue: newValue,
        lastTunedAt: param.lastTunedAt,
        tuningHistory: param.tuningHistory,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(learningOptimizationParams.parameterName, paramName));

    this.emit('parameter_adjusted', { name: paramName, oldValue, newValue });

    return {
      name: paramName,
      oldValue,
      newValue,
      reason,
      expectedImpact,
    };
  }

  /**
   * Rollback a parameter to previous value
   */
  async rollbackParameter(paramName: string): Promise<void> {
    const param = this.parameters.get(paramName);
    if (!param || param.tuningHistory.length < 2) return;

    // Get previous value
    const previousTuning = param.tuningHistory[param.tuningHistory.length - 2];
    const oldValue = param.currentValue;

    // Update
    param.currentValue = previousTuning.value;
    param.lastTunedAt = new Date().toISOString();

    // Mark last tuning as degraded
    if (param.tuningHistory.length > 0) {
      param.tuningHistory[param.tuningHistory.length - 1].outcome = 'degraded';
    }

    await db.update(learningOptimizationParams)
      .set({
        currentValue: previousTuning.value,
        lastTunedAt: param.lastTunedAt,
        tuningHistory: param.tuningHistory,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(learningOptimizationParams.parameterName, paramName));

    this.emit('parameter_rolled_back', { name: paramName, from: oldValue, to: previousTuning.value });
  }

  // =========================================================================
  // GETTERS
  // =========================================================================

  getParameter(name: string): OptimizationParam | undefined {
    return this.parameters.get(name);
  }

  getAllParameters(): OptimizationParam[] {
    return Array.from(this.parameters.values());
  }

  getLastCycleResult(): OptimizationResult | null {
    return this.lastCycleResult;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.isRunning;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let optimizationInstance: AutoOptimizationSystem | null = null;

export async function getAutoOptimizationSystem(): Promise<AutoOptimizationSystem> {
  if (!optimizationInstance) {
    optimizationInstance = new AutoOptimizationSystem();
    await optimizationInstance.initialize();
  }
  return optimizationInstance;
}

export function resetAutoOptimizationSystem(): void {
  if (optimizationInstance) {
    optimizationInstance.stopCycles();
  }
  optimizationInstance = null;
}

export default AutoOptimizationSystem;
