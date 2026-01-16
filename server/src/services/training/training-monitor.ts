/**
 * Training Monitor Service - Real-Time Training Monitoring
 *
 * Provides comprehensive real-time monitoring for flagship training jobs.
 * Handles metrics collection, data visibility, stage tracking, and log streaming.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { trainingJobs } from '../../schema.js';
import { eq } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingMetrics {
  // Progress
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  estimatedTimeRemaining: string;

  // Performance
  loss: number;
  lossHistory: Array<{ step: number; value: number; timestamp: string }>;
  learningRate: number;
  gradientNorm: number;

  // Resources
  gpuUtilization: number[];
  gpuMemoryUsed: number[];
  gpuMemoryTotal: number[];
  cpuUtilization: number;
  ramUsed: number;

  // Cost
  currentCost: number;
  estimatedTotalCost: number;
  costPerHour: number;
  budgetUsedPercent: number;

  // Data
  samplesProcessed: number;
  totalSamples: number;
  currentBatch: unknown;
  dataSource: string;

  // Quality (for alignment methods)
  rewardScore?: number;
  preferenceAccuracy?: number;
  klDivergence?: number;

  // Checkpoints
  lastCheckpoint: string;
  checkpointHistory: CheckpointInfo[];

  // Timestamps
  startedAt: string;
  lastUpdatedAt: string;
}

export interface CheckpointInfo {
  id: string;
  step: number;
  epoch: number;
  loss: number;
  path: string;
  sizeBytes: number;
  createdAt: string;
  metrics: Record<string, number>;
}

export interface CurrentDataSample {
  index: number;
  content: unknown;
  contentType: 'text' | 'image' | 'audio' | 'video';
  preview: string;
  source: string;
  timestamp: string;
}

export interface PipelineProgress {
  currentStage: number;
  totalStages: number;
  stageName: string;
  stageMethod: string;
  stageProgress: number;
  stageMetrics: TrainingMetrics;
  completedStages: StageResult[];
  remainingStages: string[];
}

export interface StageResult {
  stageId: string;
  stageName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  finalLoss: number;
  checkpointPath: string;
}

export interface QualityCheckpoint {
  id: string;
  jobId: string;
  step: number;
  epoch: number;
  timestamp: string;
  metrics: {
    loss: number;
    evalLoss?: number;
    customMetrics: Record<string, number>;
  };
  sample: {
    input: unknown;
    output: unknown;
    expected?: unknown;
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface MonitoringConfig {
  metricsIntervalMs: number;
  checkpointIntervalSteps: number;
  qualitySampleIntervalSteps: number;
  logBufferSize: number;
}

// =============================================================================
// TRAINING MONITOR SERVICE
// =============================================================================

export class TrainingMonitorService extends EventEmitter {
  private config: MonitoringConfig;
  private metricsCache: Map<string, TrainingMetrics> = new Map();
  private logsCache: Map<string, LogEntry[]> = new Map();
  private qualityCheckpoints: Map<string, QualityCheckpoint[]> = new Map();
  private dataSamples: Map<string, CurrentDataSample> = new Map();
  private activePollers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.config = {
      metricsIntervalMs: 2000,
      checkpointIntervalSteps: 500,
      qualitySampleIntervalSteps: 1000,
      logBufferSize: 1000,
      ...config,
    };
  }

  // =============================================================================
  // METRICS STREAMING
  // =============================================================================

  /**
   * Start monitoring a job
   */
  async startMonitoring(jobId: string): Promise<void> {
    if (this.activePollers.has(jobId)) {
      return; // Already monitoring
    }

    // Initialize caches
    this.metricsCache.set(jobId, this.createInitialMetrics());
    this.logsCache.set(jobId, []);
    this.qualityCheckpoints.set(jobId, []);

    // Start polling
    const poller = setInterval(async () => {
      await this.pollMetrics(jobId);
    }, this.config.metricsIntervalMs);

    this.activePollers.set(jobId, poller);
    this.addLog(jobId, 'info', 'Monitoring started');
  }

  /**
   * Stop monitoring a job
   */
  stopMonitoring(jobId: string): void {
    const poller = this.activePollers.get(jobId);
    if (poller) {
      clearInterval(poller);
      this.activePollers.delete(jobId);
    }
    this.addLog(jobId, 'info', 'Monitoring stopped');
  }

  /**
   * Stream metrics for a job
   */
  async *streamMetrics(jobId: string): AsyncGenerator<TrainingMetrics> {
    await this.startMonitoring(jobId);

    while (this.activePollers.has(jobId)) {
      const metrics = this.metricsCache.get(jobId);
      if (metrics) {
        yield metrics;
      }
      await this.sleep(this.config.metricsIntervalMs);
    }
  }

  /**
   * Get current metrics for a job
   */
  getMetrics(jobId: string): TrainingMetrics | null {
    return this.metricsCache.get(jobId) || null;
  }

  /**
   * Update metrics for a job (called by executor callbacks)
   */
  updateMetrics(jobId: string, update: Partial<TrainingMetrics>): void {
    const current = this.metricsCache.get(jobId) || this.createInitialMetrics();
    const updated = {
      ...current,
      ...update,
      lastUpdatedAt: new Date().toISOString(),
    };

    // Update loss history
    if (update.loss !== undefined && update.currentStep !== undefined) {
      updated.lossHistory = [
        ...current.lossHistory,
        { step: update.currentStep, value: update.loss, timestamp: new Date().toISOString() },
      ].slice(-1000); // Keep last 1000 points
    }

    // Calculate percent complete
    if (updated.totalSteps > 0) {
      updated.percentComplete = (updated.currentStep / updated.totalSteps) * 100;
    }

    // Calculate ETA
    updated.estimatedTimeRemaining = this.calculateETA(updated);

    this.metricsCache.set(jobId, updated);
    this.emit('metrics', jobId, updated);
  }

  // =============================================================================
  // DATA VISIBILITY
  // =============================================================================

  /**
   * Get current data sample being trained on
   */
  async getCurrentDataSample(jobId: string): Promise<CurrentDataSample | null> {
    return this.dataSamples.get(jobId) || null;
  }

  /**
   * Update current data sample
   */
  updateDataSample(jobId: string, sample: CurrentDataSample): void {
    this.dataSamples.set(jobId, sample);
    this.emit('dataSample', jobId, sample);
  }

  /**
   * Create preview for data sample based on type
   */
  createSamplePreview(content: unknown, contentType: 'text' | 'image' | 'audio' | 'video'): string {
    switch (contentType) {
      case 'text':
        const text = String(content);
        return text.length > 200 ? text.slice(0, 200) + '...' : text;

      case 'image':
        // Return base64 thumbnail or URL
        return typeof content === 'string' ? content : '[Image data]';

      case 'audio':
        // Return audio metadata or waveform data
        return '[Audio sample]';

      case 'video':
        // Return frame thumbnail
        return '[Video frame]';

      default:
        return String(content).slice(0, 100);
    }
  }

  // =============================================================================
  // STAGE TRACKING (Multi-Stage Pipelines)
  // =============================================================================

  /**
   * Get pipeline progress for multi-stage training
   */
  async getPipelineProgress(jobId: string): Promise<PipelineProgress | null> {
    const metrics = this.metricsCache.get(jobId);
    if (!metrics) return null;

    // Get job from database for stage info
    const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, jobId)).limit(1);

    if (!job || !job.config) return null;

    // Parse config and metrics (progress is stored in metrics)
    const config = typeof job.config === 'string' ? JSON.parse(job.config) : job.config;
    const progress = typeof job.metrics === 'string' ? JSON.parse(job.metrics) : job.metrics;

    const stages = config.stages || [];
    const currentStage = progress?.currentStage || 0;

    return {
      currentStage,
      totalStages: stages.length,
      stageName: stages[currentStage]?.name || 'Training',
      stageMethod: stages[currentStage]?.method || 'lora',
      stageProgress: metrics.percentComplete,
      stageMetrics: metrics,
      completedStages: (progress?.completedStages || []) as StageResult[],
      remainingStages: stages.slice(currentStage + 1).map((s: { name: string }) => s.name),
    };
  }

  /**
   * Update stage progress
   */
  updateStageProgress(jobId: string, stageResult: StageResult): void {
    this.emit('stageComplete', jobId, stageResult);
  }

  // =============================================================================
  // QUALITY CHECKPOINTS
  // =============================================================================

  /**
   * Capture quality checkpoint with sample output
   */
  async captureQualityCheckpoint(
    jobId: string,
    input: unknown,
    output: unknown,
    expected?: unknown
  ): Promise<QualityCheckpoint> {
    const metrics = this.metricsCache.get(jobId);

    const checkpoint: QualityCheckpoint = {
      id: `qc-${jobId}-${Date.now()}`,
      jobId,
      step: metrics?.currentStep || 0,
      epoch: metrics?.currentEpoch || 0,
      timestamp: new Date().toISOString(),
      metrics: {
        loss: metrics?.loss || 0,
        evalLoss: undefined,
        customMetrics: {},
      },
      sample: {
        input,
        output,
        expected,
      },
    };

    // Add alignment-specific metrics if available
    if (metrics?.rewardScore !== undefined) {
      checkpoint.metrics.customMetrics.rewardScore = metrics.rewardScore;
    }
    if (metrics?.preferenceAccuracy !== undefined) {
      checkpoint.metrics.customMetrics.preferenceAccuracy = metrics.preferenceAccuracy;
    }
    if (metrics?.klDivergence !== undefined) {
      checkpoint.metrics.customMetrics.klDivergence = metrics.klDivergence;
    }

    // Store checkpoint
    const existing = this.qualityCheckpoints.get(jobId) || [];
    existing.push(checkpoint);
    this.qualityCheckpoints.set(jobId, existing.slice(-100)); // Keep last 100

    this.emit('qualityCheckpoint', jobId, checkpoint);
    return checkpoint;
  }

  /**
   * Get quality checkpoints for a job
   */
  getQualityCheckpoints(jobId: string): QualityCheckpoint[] {
    return this.qualityCheckpoints.get(jobId) || [];
  }

  // =============================================================================
  // LOG STREAMING
  // =============================================================================

  /**
   * Stream logs for a job
   */
  async *streamLogs(jobId: string, filter?: 'info' | 'warn' | 'error' | 'debug'): AsyncGenerator<LogEntry> {
    let lastIndex = 0;
    const logs = this.logsCache.get(jobId) || [];

    // Yield existing logs
    for (const log of logs) {
      if (!filter || log.level === filter) {
        yield log;
      }
    }
    lastIndex = logs.length;

    // Stream new logs
    while (this.activePollers.has(jobId)) {
      const currentLogs = this.logsCache.get(jobId) || [];
      for (let i = lastIndex; i < currentLogs.length; i++) {
        const log = currentLogs[i];
        if (!filter || log.level === filter) {
          yield log;
        }
      }
      lastIndex = currentLogs.length;
      await this.sleep(500);
    }
  }

  /**
   * Get all logs for a job
   */
  getLogs(jobId: string, filter?: 'info' | 'warn' | 'error' | 'debug'): LogEntry[] {
    const logs = this.logsCache.get(jobId) || [];
    if (filter) {
      return logs.filter(l => l.level === filter);
    }
    return logs;
  }

  /**
   * Add a log entry
   */
  addLog(jobId: string, level: LogEntry['level'], message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    };

    const logs = this.logsCache.get(jobId) || [];
    logs.push(entry);

    // Limit buffer size
    if (logs.length > this.config.logBufferSize) {
      logs.shift();
    }

    this.logsCache.set(jobId, logs);
    this.emit('log', jobId, entry);
  }

  // =============================================================================
  // CHECKPOINT MANAGEMENT
  // =============================================================================

  /**
   * Record a training checkpoint
   */
  recordCheckpoint(jobId: string, checkpoint: CheckpointInfo): void {
    const metrics = this.metricsCache.get(jobId);
    if (metrics) {
      metrics.checkpointHistory.push(checkpoint);
      metrics.lastCheckpoint = checkpoint.path;
      this.metricsCache.set(jobId, metrics);
    }

    this.addLog(jobId, 'info', `Checkpoint saved: step ${checkpoint.step}, loss ${checkpoint.loss.toFixed(4)}`);
    this.emit('checkpoint', jobId, checkpoint);
  }

  /**
   * Get checkpoint history
   */
  getCheckpointHistory(jobId: string): CheckpointInfo[] {
    return this.metricsCache.get(jobId)?.checkpointHistory || [];
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Poll metrics from training process
   */
  private async pollMetrics(jobId: string): Promise<void> {
    try {
      // Get job status from database
      const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, jobId)).limit(1);

      if (!job) {
        this.stopMonitoring(jobId);
        return;
      }

      // Check if job is still running
      if (['completed', 'failed', 'stopped'].includes(job.status)) {
        this.stopMonitoring(jobId);
        return;
      }

      // Parse progress from database (stored in metrics)
      if (job.metrics) {
        const progress = typeof job.metrics === 'string' ? JSON.parse(job.metrics) : job.metrics;

        this.updateMetrics(jobId, {
          currentStep: progress.currentStep || 0,
          totalSteps: progress.totalSteps || 0,
          currentEpoch: progress.currentEpoch || 0,
          totalEpochs: progress.totalEpochs || 0,
          loss: progress.loss || 0,
          learningRate: progress.learningRate || 0,
          gpuUtilization: progress.gpuUtilization || [0],
          gpuMemoryUsed: progress.gpuMemoryUsed || [0],
          gpuMemoryTotal: progress.gpuMemoryTotal || [80],
        });
      }
    } catch (error) {
      this.addLog(jobId, 'error', `Failed to poll metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create initial metrics structure
   */
  private createInitialMetrics(): TrainingMetrics {
    return {
      currentEpoch: 0,
      totalEpochs: 0,
      currentStep: 0,
      totalSteps: 0,
      percentComplete: 0,
      estimatedTimeRemaining: '--:--:--',
      loss: 0,
      lossHistory: [],
      learningRate: 0,
      gradientNorm: 0,
      gpuUtilization: [0],
      gpuMemoryUsed: [0],
      gpuMemoryTotal: [80],
      cpuUtilization: 0,
      ramUsed: 0,
      currentCost: 0,
      estimatedTotalCost: 0,
      costPerHour: 0,
      budgetUsedPercent: 0,
      samplesProcessed: 0,
      totalSamples: 0,
      currentBatch: null,
      dataSource: '',
      lastCheckpoint: '',
      checkpointHistory: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(metrics: TrainingMetrics): string {
    if (metrics.currentStep === 0 || metrics.totalSteps === 0) {
      return '--:--:--';
    }

    const startTime = new Date(metrics.startedAt).getTime();
    const elapsed = Date.now() - startTime;
    const stepsPerMs = metrics.currentStep / elapsed;
    const remainingSteps = metrics.totalSteps - metrics.currentStep;
    const remainingMs = remainingSteps / stepsPerMs;

    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    for (const [jobId] of this.activePollers) {
      this.stopMonitoring(jobId);
    }
    this.metricsCache.clear();
    this.logsCache.clear();
    this.qualityCheckpoints.clear();
    this.dataSamples.clear();
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let monitorInstance: TrainingMonitorService | null = null;

export function getTrainingMonitorService(): TrainingMonitorService {
  if (!monitorInstance) {
    monitorInstance = new TrainingMonitorService();
  }
  return monitorInstance;
}

export function createTrainingMonitorService(config?: Partial<MonitoringConfig>): TrainingMonitorService {
  return new TrainingMonitorService(config);
}

export default TrainingMonitorService;
