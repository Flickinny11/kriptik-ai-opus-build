/**
 * Unified Metrics Collector
 *
 * Aggregates metrics from ALL systems (billing, vectors, thinking, learning, models)
 * into a unified view, enabling cross-system optimization and comprehensive monitoring.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import {
  learningMetricsHistory,
  learningCorrelations,
  learningAnomalies,
  continuousLearningSessions,
} from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

import type {
  UnifiedMetrics,
  SystemHealthState,
  CorrelationReport,
  LearningCorrelation,
  AnomalyAlert,
  TrendAnalysis,
  MetricTrend,
  MetricPrediction,
} from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface MetricsCollectorConfig {
  collectionInterval: number;
  anomalyThreshold: number;
  trendWindow: number; // Days
}

const DEFAULT_CONFIG: MetricsCollectorConfig = {
  collectionInterval: 60000, // 1 minute
  anomalyThreshold: 2.0, // 2 standard deviations
  trendWindow: 7, // 7 days
};

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

interface MetricDefinition {
  name: string;
  source: string;
  collect: () => Promise<number>;
  unit: string;
  warningThreshold?: number;
  criticalThreshold?: number;
}

// =============================================================================
// UNIFIED METRICS COLLECTOR
// =============================================================================

export class UnifiedMetricsCollector extends EventEmitter {
  private config: MetricsCollectorConfig;
  private metrics: Map<string, MetricDefinition> = new Map();
  private collectionInterval: ReturnType<typeof setInterval> | null = null;
  private metricsHistory: Map<string, number[]> = new Map();
  private lastCollection: UnifiedMetrics | null = null;
  private isCollecting: boolean = false;

  constructor(config?: Partial<MetricsCollectorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultMetrics();
  }

  /**
   * Register default metrics
   */
  private registerDefaultMetrics(): void {
    // Session metrics
    this.registerMetric({
      name: 'active_sessions',
      source: 'continuous_learning',
      collect: async () => {
        const result = await db.select({ count: sql<number>`count(*)` })
          .from(continuousLearningSessions)
          .where(sql`completedAt IS NULL`)
          .get();
        return result?.count || 0;
      },
      unit: 'sessions',
      warningThreshold: 50,
      criticalThreshold: 90,
    });

    this.registerMetric({
      name: 'sessions_today',
      source: 'continuous_learning',
      collect: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const result = await db.select({ count: sql<number>`count(*)` })
          .from(continuousLearningSessions)
          .where(gte(continuousLearningSessions.startedAt, today.toISOString()))
          .get();
        return result?.count || 0;
      },
      unit: 'sessions',
    });

    this.registerMetric({
      name: 'success_rate',
      source: 'continuous_learning',
      collect: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sessions = await db.select()
          .from(continuousLearningSessions)
          .where(
            and(
              gte(continuousLearningSessions.startedAt, today.toISOString()),
              sql`completedAt IS NOT NULL`
            )
          )
          .all();
        if (sessions.length === 0) return 1.0;
        const successful = sessions.filter(s => s.outcome === 'success').length;
        return successful / sessions.length;
      },
      unit: 'ratio',
      warningThreshold: 0.7,
      criticalThreshold: 0.5,
    });

    this.registerMetric({
      name: 'total_cost_today',
      source: 'billing',
      collect: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sessions = await db.select()
          .from(continuousLearningSessions)
          .where(gte(continuousLearningSessions.startedAt, today.toISOString()))
          .all();
        return sessions.reduce((sum, s) => sum + (s.totalCostUsd || 0), 0);
      },
      unit: 'USD',
    });

    this.registerMetric({
      name: 'patterns_applied_today',
      source: 'component28',
      collect: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sessions = await db.select()
          .from(continuousLearningSessions)
          .where(gte(continuousLearningSessions.startedAt, today.toISOString()))
          .all();
        return sessions.reduce((sum, s) => sum + (s.patternsApplied || 0), 0);
      },
      unit: 'patterns',
    });

    this.registerMetric({
      name: 'hyper_thinking_sessions',
      source: 'hyper_thinking',
      collect: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sessions = await db.select()
          .from(continuousLearningSessions)
          .where(
            and(
              gte(continuousLearningSessions.startedAt, today.toISOString()),
              eq(continuousLearningSessions.hyperThinkingUsed, true)
            )
          )
          .all();
        return sessions.length;
      },
      unit: 'sessions',
    });
  }

  /**
   * Register a new metric
   */
  registerMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.metricsHistory.set(definition.name, []);
  }

  /**
   * Start collecting metrics
   */
  start(): void {
    if (this.collectionInterval) return;

    console.log('[UnifiedMetricsCollector] Starting metrics collection...');

    // Collect immediately
    this.collectAll();

    // Schedule periodic collection
    this.collectionInterval = setInterval(() => {
      this.collectAll();
    }, this.config.collectionInterval);

    this.emit('started');
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    this.emit('stopped');
  }

  /**
   * Collect all metrics
   */
  async collectAll(): Promise<UnifiedMetrics> {
    if (this.isCollecting) {
      return this.lastCollection || this.getEmptyMetrics();
    }

    this.isCollecting = true;
    const timestamp = new Date().toISOString();

    try {
      // Collect each metric
      const collectedMetrics: Record<string, number> = {};

      for (const [name, definition] of this.metrics) {
        try {
          const value = await definition.collect();
          collectedMetrics[name] = value;

          // Store in history
          const history = this.metricsHistory.get(name) || [];
          history.push(value);
          if (history.length > 1440) { // 24 hours at 1 min intervals
            history.shift();
          }
          this.metricsHistory.set(name, history);

          // Store in database
          await this.recordMetric(name, value, { source: definition.source });

          // Check for anomalies
          await this.checkForAnomaly(name, value, history);

        } catch (error) {
          console.error(`[UnifiedMetricsCollector] Failed to collect ${name}:`, error);
          collectedMetrics[name] = 0;
        }
      }

      // Build unified metrics object
      const unifiedMetrics: UnifiedMetrics = {
        timestamp,
        activeSessions: collectedMetrics['active_sessions'] || 0,
        totalCostToday: collectedMetrics['total_cost_today'] || 0,
        creditBurnRate: collectedMetrics['total_cost_today'] / Math.max(1, collectedMetrics['sessions_today'] || 1),
        vectorQueriesPerMin: 0, // Would need real-time tracking
        cacheHitRate: 0,
        avgRetrievalTimeMs: 0,
        patternsAppliedToday: collectedMetrics['patterns_applied_today'] || 0,
        improvementRate: collectedMetrics['success_rate'] || 0,
        cyclesCompletedToday: 0,
        shadowModelsActive: 0,
        shadowModelSuccessRate: 0,
        deploymentsActive: 0,
        reasoningSessionsToday: collectedMetrics['hyper_thinking_sessions'] || 0,
        avgReasoningQuality: 0,
        systemHealth: {
          overall: 'healthy',
          components: [],
          lastCheck: timestamp,
        },
      };

      this.lastCollection = unifiedMetrics;
      this.emit('metrics_collected', unifiedMetrics);

      return unifiedMetrics;

    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Analyze correlations between metrics
   */
  async analyzeCorrelations(): Promise<CorrelationReport> {
    const correlations: LearningCorrelation[] = [];
    const insights: string[] = [];
    const recommendations: string[] = [];

    // Get recent correlations from database
    const recentCorrelations = await db.select()
      .from(learningCorrelations)
      .orderBy(desc(learningCorrelations.createdAt))
      .limit(50);

    correlations.push(...recentCorrelations.map(c => ({
      id: c.id,
      correlationType: c.correlationType as 'cost_reduction' | 'quality_improvement' | 'speed_increase',
      triggerSystem: c.triggerSystem,
      triggerEvent: c.triggerEvent,
      improvedSystem: c.improvedSystem,
      improvementMetric: c.improvementMetric,
      improvementValue: c.improvementValue,
      confidence: c.confidence,
      samplesCount: c.samplesCount || 1,
    })));

    // Generate insights
    const costCorrelations = correlations.filter(c => c.correlationType === 'cost_reduction');
    if (costCorrelations.length > 0) {
      const avgSavings = costCorrelations.reduce((sum, c) => sum + c.improvementValue, 0) / costCorrelations.length;
      insights.push(`Average cost reduction from learning: ${(avgSavings * 100).toFixed(1)}%`);
    }

    const qualityCorrelations = correlations.filter(c => c.correlationType === 'quality_improvement');
    if (qualityCorrelations.length > 0) {
      const avgImprovement = qualityCorrelations.reduce((sum, c) => sum + c.improvementValue, 0) / qualityCorrelations.length;
      insights.push(`Average quality improvement: ${(avgImprovement * 100).toFixed(1)}%`);
    }

    // Generate recommendations
    if (this.lastCollection) {
      if (this.lastCollection.improvementRate < 0.8) {
        recommendations.push('Consider enabling more hyper-thinking for complex tasks');
      }
      if (this.lastCollection.patternsAppliedToday < 10) {
        recommendations.push('Pattern usage is low - check if pattern library is being queried');
      }
    }

    return { correlations, insights, recommendations };
  }

  /**
   * Detect anomalies in metrics
   */
  async detectAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    // Get recent unresolved anomalies
    const recentAnomalies = await db.select()
      .from(learningAnomalies)
      .where(eq(learningAnomalies.resolved, false))
      .orderBy(desc(learningAnomalies.timestamp))
      .limit(20);

    alerts.push(...recentAnomalies.map(a => ({
      id: a.id,
      type: a.anomalyType as 'spike' | 'drop' | 'drift' | 'error_surge',
      severity: a.severity as 'low' | 'medium' | 'high' | 'critical',
      system: a.system,
      metric: a.metric,
      currentValue: a.currentValue,
      expectedValue: a.expectedValue,
      deviation: a.deviation,
      timestamp: a.timestamp,
      resolved: a.resolved || false,
    })));

    return alerts;
  }

  /**
   * Get historical trends for metrics
   */
  async getHistoricalTrends(period: string = '7d'): Promise<TrendAnalysis> {
    const daysMap: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
    };
    const days = daysMap[period] || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const metrics: MetricTrend[] = [];
    const predictions: MetricPrediction[] = [];

    // Get historical data for each metric
    for (const [name] of this.metrics) {
      const history = await db.select()
        .from(learningMetricsHistory)
        .where(
          and(
            eq(learningMetricsHistory.metricName, name),
            gte(learningMetricsHistory.timestamp, startDate)
          )
        )
        .orderBy(learningMetricsHistory.timestamp)
        .all();

      if (history.length < 2) continue;

      const values = history.map(h => ({
        timestamp: h.timestamp,
        value: h.metricValue,
      }));

      // Calculate trend
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((sum, v) => sum + v.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, v) => sum + v.value, 0) / secondHalf.length;
      const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (changePercent > 5) trend = 'increasing';
      if (changePercent < -5) trend = 'decreasing';

      metrics.push({
        name,
        values,
        trend,
        changePercent,
      });

      // Simple linear prediction
      const slope = (secondAvg - firstAvg) / (days / 2);
      predictions.push({
        name,
        predictedValue: secondAvg + slope * 7, // 7-day prediction
        confidence: Math.min(0.9, 1 - Math.abs(changePercent) / 100),
        horizon: '7d',
      });
    }

    return { period, metrics, predictions };
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(userId?: string): Promise<{
    metrics: UnifiedMetrics;
    correlations: CorrelationReport;
    anomalies: AnomalyAlert[];
    trends: TrendAnalysis;
  }> {
    const [metrics, correlations, anomalies, trends] = await Promise.all([
      this.collectAll(),
      this.analyzeCorrelations(),
      this.detectAnomalies(),
      this.getHistoricalTrends(),
    ]);

    return { metrics, correlations, anomalies, trends };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

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
      console.warn('[UnifiedMetricsCollector] Failed to record metric:', error);
    }
  }

  private async checkForAnomaly(
    name: string,
    value: number,
    history: number[]
  ): Promise<void> {
    if (history.length < 10) return; // Need enough data points

    // Calculate mean and standard deviation
    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    // Check if current value is anomalous
    const deviation = Math.abs(value - mean) / Math.max(stdDev, 0.001);

    if (deviation > this.config.anomalyThreshold) {
      const anomalyType = value > mean ? 'spike' : 'drop';
      const severity = deviation > 3 ? 'high' : deviation > 2.5 ? 'medium' : 'low';

      await db.insert(learningAnomalies).values({
        id: `anomaly_${uuidv4()}`,
        anomalyType,
        severity,
        system: 'metrics',
        metric: name,
        currentValue: value,
        expectedValue: mean,
        deviation,
        resolved: false,
        timestamp: new Date().toISOString(),
      });

      this.emit('anomaly_detected', {
        metric: name,
        type: anomalyType,
        severity,
        value,
        expected: mean,
        deviation,
      });
    }
  }

  private getEmptyMetrics(): UnifiedMetrics {
    return {
      timestamp: new Date().toISOString(),
      activeSessions: 0,
      totalCostToday: 0,
      creditBurnRate: 0,
      vectorQueriesPerMin: 0,
      cacheHitRate: 0,
      avgRetrievalTimeMs: 0,
      patternsAppliedToday: 0,
      improvementRate: 0,
      cyclesCompletedToday: 0,
      shadowModelsActive: 0,
      shadowModelSuccessRate: 0,
      deploymentsActive: 0,
      reasoningSessionsToday: 0,
      avgReasoningQuality: 0,
      systemHealth: {
        overall: 'healthy',
        components: [],
        lastCheck: new Date().toISOString(),
      },
    };
  }

  // =========================================================================
  // GETTERS
  // =========================================================================

  getLastCollection(): UnifiedMetrics | null {
    return this.lastCollection;
  }

  getMetricHistory(name: string): number[] {
    return this.metricsHistory.get(name) || [];
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let collectorInstance: UnifiedMetricsCollector | null = null;

export function getUnifiedMetricsCollector(): UnifiedMetricsCollector {
  if (!collectorInstance) {
    collectorInstance = new UnifiedMetricsCollector();
  }
  return collectorInstance;
}

export function resetUnifiedMetricsCollector(): void {
  if (collectorInstance) {
    collectorInstance.stop();
  }
  collectorInstance = null;
}

export default UnifiedMetricsCollector;
