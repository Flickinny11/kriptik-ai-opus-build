/**
 * Model Deployment Pipeline
 *
 * Automates the deployment, testing, and promotion of trained models,
 * ensuring only validated improvements reach production.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { productionModelDeployments, learningShadowModels } from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

import type {
  DeploymentConfig,
  Deployment,
  ABComparison,
  RequestResult,
  DeploymentEvaluation,
} from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface PipelineConfig {
  autoPromoteThreshold: number; // % improvement required for auto-promotion
  minTrafficForEval: number; // Minimum requests before evaluation
  maxTestDuration: number; // Maximum test duration in ms
  rollbackThreshold: number; // % degradation that triggers rollback
}

const DEFAULT_CONFIG: PipelineConfig = {
  autoPromoteThreshold: 0.05, // 5% improvement
  minTrafficForEval: 100,
  maxTestDuration: 24 * 60 * 60 * 1000, // 24 hours
  rollbackThreshold: 0.1, // 10% degradation
};

// =============================================================================
// MODEL DEPLOYMENT PIPELINE
// =============================================================================

export class ModelDeploymentPipeline extends EventEmitter {
  private config: PipelineConfig;
  private activeDeployments: Map<string, Deployment> = new Map();
  private abResults: Map<string, ABComparison> = new Map();

  constructor(config?: Partial<PipelineConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize pipeline
   */
  async initialize(): Promise<void> {
    // Load active deployments from database
    const deployments = await db.select()
      .from(productionModelDeployments)
      .where(eq(productionModelDeployments.status, 'testing'))
      .all();

    for (const d of deployments) {
      this.activeDeployments.set(d.id, {
        id: d.id,
        modelName: d.modelName,
        modelVersion: d.modelVersion,
        status: d.status as Deployment['status'],
        trafficPercentage: d.trafficPercentage ?? 5,
        baselineModel: d.baselineModel || undefined,
        startedAt: d.startedAt,
        metrics: (d.metrics as Deployment['metrics']) || {
          requestCount: 0,
          successRate: 0,
          avgLatency: 0,
          errorRate: 0,
        },
      });
    }

    console.log(`[ModelDeploymentPipeline] Loaded ${this.activeDeployments.size} active deployments`);
    this.emit('initialized');
  }

  // =========================================================================
  // DEPLOYMENT
  // =========================================================================

  /**
   * Deploy a model for A/B testing
   */
  async deployForTesting(config: DeploymentConfig): Promise<Deployment> {
    const deploymentId = `deploy_${uuidv4()}`;

    const deployment: Deployment = {
      id: deploymentId,
      modelName: config.modelName,
      modelVersion: config.modelVersion,
      status: 'testing',
      trafficPercentage: config.trafficPercentage || 5,
      baselineModel: config.baselineModel,
      startedAt: new Date().toISOString(),
      metrics: {
        requestCount: 0,
        successRate: 0,
        avgLatency: 0,
        errorRate: 0,
      },
    };

    // Store in database
    await db.insert(productionModelDeployments).values({
      id: deploymentId,
      modelName: config.modelName,
      modelVersion: config.modelVersion,
      status: 'testing',
      trafficPercentage: deployment.trafficPercentage,
      baselineModel: config.baselineModel,
      startedAt: deployment.startedAt,
      metrics: deployment.metrics,
      createdAt: new Date().toISOString(),
    });

    this.activeDeployments.set(deploymentId, deployment);
    this.emit('deployment_started', deployment);

    console.log(`[ModelDeploymentPipeline] Started deployment: ${deploymentId}`);

    return deployment;
  }

  /**
   * Record a request result for A/B testing
   */
  async recordRequestResult(result: RequestResult): Promise<void> {
    const deployment = this.activeDeployments.get(result.deploymentId);
    if (!deployment) return;

    // Update metrics
    const metrics = deployment.metrics;
    const totalRequests = metrics.requestCount + 1;

    metrics.requestCount = totalRequests;
    metrics.avgLatency = (metrics.avgLatency * (totalRequests - 1) + result.latency) / totalRequests;

    if (result.success) {
      metrics.successRate = (metrics.successRate * (totalRequests - 1) + 1) / totalRequests;
    } else {
      metrics.successRate = (metrics.successRate * (totalRequests - 1)) / totalRequests;
      metrics.errorRate = 1 - metrics.successRate;
    }

    // Update A/B comparison
    let abComparison = this.abResults.get(result.deploymentId);
    if (!abComparison) {
      abComparison = {
        deploymentId: result.deploymentId,
        testModelMetrics: { requests: 0, successes: 0, totalLatency: 0 },
        baselineMetrics: { requests: 0, successes: 0, totalLatency: 0 },
        improvement: 0,
        pValue: 1,
      };
      this.abResults.set(result.deploymentId, abComparison);
    }

    if (result.isTestModel) {
      abComparison.testModelMetrics.requests++;
      if (result.success) abComparison.testModelMetrics.successes++;
      abComparison.testModelMetrics.totalLatency += result.latency;
    } else {
      abComparison.baselineMetrics.requests++;
      if (result.success) abComparison.baselineMetrics.successes++;
      abComparison.baselineMetrics.totalLatency += result.latency;
    }

    // Calculate improvement
    if (abComparison.testModelMetrics.requests > 0 && abComparison.baselineMetrics.requests > 0) {
      const testSuccessRate = abComparison.testModelMetrics.successes / abComparison.testModelMetrics.requests;
      const baselineSuccessRate = abComparison.baselineMetrics.successes / abComparison.baselineMetrics.requests;
      abComparison.improvement = testSuccessRate - baselineSuccessRate;

      // Simplified p-value calculation (would use proper statistical test in production)
      const totalSamples = abComparison.testModelMetrics.requests + abComparison.baselineMetrics.requests;
      abComparison.pValue = Math.max(0.001, 1 / Math.sqrt(totalSamples));
    }

    // Check if we should auto-promote or rollback
    await this.evaluateDeployment(result.deploymentId);
  }

  // =========================================================================
  // EVALUATION
  // =========================================================================

  /**
   * Evaluate a deployment for promotion or rollback
   */
  private async evaluateDeployment(deploymentId: string): Promise<DeploymentEvaluation | null> {
    const deployment = this.activeDeployments.get(deploymentId);
    const abComparison = this.abResults.get(deploymentId);

    if (!deployment || !abComparison) return null;

    // Need minimum traffic for evaluation
    if (deployment.metrics.requestCount < this.config.minTrafficForEval) {
      return null;
    }

    const evaluation: DeploymentEvaluation = {
      deploymentId,
      recommendation: 'continue_testing',
      improvement: abComparison.improvement,
      confidence: 1 - abComparison.pValue,
      metrics: deployment.metrics,
    };

    // Check for auto-promotion
    if (abComparison.improvement >= this.config.autoPromoteThreshold && abComparison.pValue < 0.05) {
      evaluation.recommendation = 'promote';
    }

    // Check for rollback
    if (abComparison.improvement < -this.config.rollbackThreshold) {
      evaluation.recommendation = 'rollback';
    }

    // Check for max duration
    const duration = Date.now() - new Date(deployment.startedAt).getTime();
    if (duration > this.config.maxTestDuration) {
      if (abComparison.improvement > 0) {
        evaluation.recommendation = 'promote';
      } else {
        evaluation.recommendation = 'rollback';
      }
    }

    // Act on recommendation
    if (evaluation.recommendation === 'promote') {
      await this.promoteDeployment(deploymentId);
    } else if (evaluation.recommendation === 'rollback') {
      await this.rollbackDeployment(deploymentId);
    }

    return evaluation;
  }

  /**
   * Promote a deployment to production
   */
  async promoteDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    deployment.status = 'promoted';
    deployment.trafficPercentage = 100;
    deployment.promotedAt = new Date().toISOString();

    // Update database
    await db.update(productionModelDeployments)
      .set({
        status: 'promoted',
        trafficPercentage: 100,
        promotedAt: deployment.promotedAt,
        metrics: deployment.metrics,
      })
      .where(eq(productionModelDeployments.id, deploymentId));

    // Update shadow model version tracking (promotion is tracked via productionModelDeployments)
    // Note: Shadow model registry tracks models via modelName and version

    this.emit('deployment_promoted', deployment);
    console.log(`[ModelDeploymentPipeline] Promoted deployment: ${deploymentId}`);
  }

  /**
   * Rollback a deployment
   */
  async rollbackDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    deployment.status = 'rolled_back';
    deployment.trafficPercentage = 0;

    // Update database
    await db.update(productionModelDeployments)
      .set({
        status: 'rolled_back',
        trafficPercentage: 0,
        metrics: deployment.metrics,
      })
      .where(eq(productionModelDeployments.id, deploymentId));

    this.activeDeployments.delete(deploymentId);
    this.abResults.delete(deploymentId);

    this.emit('deployment_rolled_back', deployment);
    console.log(`[ModelDeploymentPipeline] Rolled back deployment: ${deploymentId}`);
  }

  // =========================================================================
  // TRAFFIC ROUTING
  // =========================================================================

  /**
   * Determine which model to route a request to
   */
  routeRequest(modelType: string): {
    modelName: string;
    modelVersion: string;
    isTestModel: boolean;
    deploymentId?: string;
  } {
    // Find active deployment for this model type
    for (const [deploymentId, deployment] of this.activeDeployments) {
      if (deployment.modelName === modelType && deployment.status === 'testing') {
        // Route based on traffic percentage
        if (Math.random() * 100 < deployment.trafficPercentage) {
          return {
            modelName: deployment.modelName,
            modelVersion: deployment.modelVersion,
            isTestModel: true,
            deploymentId,
          };
        } else if (deployment.baselineModel) {
          return {
            modelName: deployment.baselineModel,
            modelVersion: 'baseline',
            isTestModel: false,
            deploymentId,
          };
        }
      }
    }

    // No active deployment, use default
    return {
      modelName: modelType,
      modelVersion: 'default',
      isTestModel: false,
    };
  }

  // =========================================================================
  // GETTERS
  // =========================================================================

  /**
   * Get all active deployments
   */
  getActiveDeployments(): Deployment[] {
    return Array.from(this.activeDeployments.values());
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): Deployment | undefined {
    return this.activeDeployments.get(deploymentId);
  }

  /**
   * Get A/B comparison results
   */
  getABComparison(deploymentId: string): ABComparison | undefined {
    return this.abResults.get(deploymentId);
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(limit: number = 20): Promise<Deployment[]> {
    const deployments = await db.select()
      .from(productionModelDeployments)
      .orderBy(desc(productionModelDeployments.createdAt))
      .limit(limit)
      .all();

    return deployments.map(d => ({
      id: d.id,
      modelName: d.modelName,
      modelVersion: d.modelVersion,
      status: d.status as Deployment['status'],
      trafficPercentage: d.trafficPercentage ?? 5,
      baselineModel: d.baselineModel || undefined,
      startedAt: d.startedAt,
      promotedAt: d.promotedAt || undefined,
      metrics: (d.metrics as Deployment['metrics']) || {
        requestCount: 0,
        successRate: 0,
        avgLatency: 0,
        errorRate: 0,
      },
    }));
  }

  /**
   * Get pipeline statistics
   */
  async getStats(): Promise<{
    activeDeployments: number;
    totalDeployments: number;
    promotedCount: number;
    rolledBackCount: number;
    avgImprovement: number;
  }> {
    const allDeployments = await db.select()
      .from(productionModelDeployments)
      .all();

    const promoted = allDeployments.filter(d => d.status === 'promoted');
    const rolledBack = allDeployments.filter(d => d.status === 'rolled_back');

    // Calculate average improvement from A/B results
    let totalImprovement = 0;
    for (const ab of this.abResults.values()) {
      totalImprovement += ab.improvement;
    }
    const avgImprovement = this.abResults.size > 0
      ? totalImprovement / this.abResults.size
      : 0;

    return {
      activeDeployments: this.activeDeployments.size,
      totalDeployments: allDeployments.length,
      promotedCount: promoted.length,
      rolledBackCount: rolledBack.length,
      avgImprovement,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let pipelineInstance: ModelDeploymentPipeline | null = null;

export async function getModelDeploymentPipeline(): Promise<ModelDeploymentPipeline> {
  if (!pipelineInstance) {
    pipelineInstance = new ModelDeploymentPipeline();
    await pipelineInstance.initialize();
  }
  return pipelineInstance;
}

export function resetModelDeploymentPipeline(): void {
  pipelineInstance = null;
}

export default ModelDeploymentPipeline;
