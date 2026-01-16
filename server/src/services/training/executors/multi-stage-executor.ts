/**
 * Multi-Stage Executor - Pipeline Training for Flagship Quality
 *
 * Orchestrates multi-stage training pipelines (e.g., LoRA → DPO → RLHF)
 * for flagship-level model quality. Handles checkpointing between stages
 * and optional user approval gates.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type {
  TrainingExecutor,
  TrainingProgress,
  TrainingResult,
  TrainingCheckpoint,
  TrainingMetrics,
  MultiStageConfig,
  StageConfig,
  StageResult,
  BaseExecutorConfig,
} from './types.js';
import { DoRAExecutor } from './dora-executor.js';
import { DPOExecutor } from './dpo-executor.js';
import { RLHFExecutor } from './rlhf-executor.js';
import { DeepSpeedExecutor } from './deepspeed-executor.js';

// =============================================================================
// MULTI-STAGE EXECUTOR
// =============================================================================

export class MultiStageExecutor extends EventEmitter implements TrainingExecutor<MultiStageConfig> {
  readonly name = 'Multi-Stage Executor';
  readonly method = 'multi_stage';

  private config: MultiStageConfig | null = null;
  private progress: TrainingProgress;
  private isRunning = false;
  private isPaused = false;
  private stageResults: StageResult[] = [];
  private currentStageIndex = 0;
  private currentExecutor: TrainingExecutor<unknown> | null = null;
  private startTime = 0;
  private awaitingApproval = false;
  private approvalResolver: ((approved: boolean) => void) | null = null;

  constructor() {
    super();
    this.progress = this.initializeProgress();
  }

  private initializeProgress(): TrainingProgress {
    return {
      step: 0,
      totalSteps: 0,
      epoch: 0,
      totalEpochs: 0,
      loss: 0,
      learningRate: 0,
      eta: '--:--:--',
      gpuMemoryUsed: 0,
      gpuMemoryTotal: 80,
      gpuUtilization: 0,
    };
  }

  /**
   * Execute multi-stage training pipeline
   */
  async execute(config: MultiStageConfig): Promise<TrainingResult> {
    this.config = config;
    this.isRunning = true;
    this.startTime = Date.now();
    this.stageResults = [];
    this.currentStageIndex = 0;

    const totalStages = config.stages.length;
    this.emit('log', { level: 'info', message: `Starting multi-stage pipeline with ${totalStages} stages` });

    try {
      for (let i = 0; i < config.stages.length && this.isRunning; i++) {
        this.currentStageIndex = i;
        const stage = config.stages[i];

        this.emit('log', { level: 'info', message: `Stage ${i + 1}/${totalStages}: ${stage.name} (${stage.method})` });
        this.emit('stageStart', { stageIndex: i, stage });

        // Get appropriate executor for this stage
        const executor = this.getExecutor(stage.method);
        this.currentExecutor = executor;

        // Prepare stage config with checkpoint from previous stage
        const stageConfig = this.prepareStageConfig(stage, i);

        // Forward executor events
        this.forwardExecutorEvents(executor, i);

        // Execute stage
        const stageStartTime = Date.now();
        const result = await executor.execute(stageConfig);
        const duration = Date.now() - stageStartTime;

        // Store result
        const stageResult: StageResult = {
          stageId: stage.id,
          stageName: stage.name,
          result,
          checkpoint: result.bestCheckpoint || result.checkpoints[result.checkpoints.length - 1],
          duration,
        };
        this.stageResults.push(stageResult);

        if (result.status === 'failed') {
          throw new Error(`Stage ${stage.name} failed: ${result.error}`);
        }

        this.emit('stageComplete', { stageIndex: i, stage, result: stageResult });

        // Check if approval is required before next stage
        if (stage.requiresApproval && i < config.stages.length - 1) {
          this.emit('log', { level: 'info', message: `Waiting for user approval to proceed to next stage...` });
          this.emit('approvalRequired', { stageIndex: i, stage });

          const approved = await this.waitForUserApproval(stage);
          if (!approved) {
            this.emit('log', { level: 'info', message: 'Pipeline stopped by user after approval rejection' });
            break;
          }
        }
      }

      // Merge results from all stages
      const finalResult = this.mergeResults(this.stageResults);
      this.emit('completed', finalResult);

      return finalResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { message: errorMessage });

      return {
        id: config.id,
        status: 'failed',
        finalLoss: this.progress.loss,
        bestLoss: this.stageResults.length > 0
          ? Math.min(...this.stageResults.map(r => r.result.bestLoss))
          : Infinity,
        checkpoints: this.stageResults.flatMap(r => r.result.checkpoints),
        metrics: this.mergeMetrics(this.stageResults),
        outputModelPath: '',
        totalTrainingTime: Date.now() - this.startTime,
        totalCost: this.stageResults.reduce((sum, r) => sum + r.result.totalCost, 0),
        error: errorMessage,
      };
    } finally {
      this.isRunning = false;
      this.currentExecutor = null;
    }
  }

  /**
   * Get executor for a training method
   */
  private getExecutor(method: string): TrainingExecutor<unknown> {
    switch (method) {
      case 'dora':
      case 'lora':
      case 'qlora':
        return new DoRAExecutor();
      case 'dpo':
      case 'orpo':
        return new DPOExecutor();
      case 'rlhf_ppo':
      case 'rlhf':
        return new RLHFExecutor();
      case 'deepspeed':
      case 'deepspeed_zero3':
      case 'full_finetune_deepspeed':
        return new DeepSpeedExecutor();
      default:
        return new DoRAExecutor(); // Default to DoRA
    }
  }

  /**
   * Prepare stage config with previous checkpoint
   */
  private prepareStageConfig(stage: StageConfig, stageIndex: number): unknown {
    const config = { ...stage.config };

    // Use checkpoint from previous stage if available
    if (stageIndex > 0 && this.stageResults.length > 0) {
      const previousResult = this.stageResults[stageIndex - 1];
      if (previousResult.checkpoint) {
        (config as BaseExecutorConfig).baseModelId = previousResult.checkpoint.path;
        this.emit('log', {
          level: 'info',
          message: `Using checkpoint from previous stage: ${previousResult.checkpoint.path}`,
        });
      }
    }

    return config;
  }

  /**
   * Forward events from stage executor
   */
  private forwardExecutorEvents(executor: TrainingExecutor<unknown>, stageIndex: number): void {
    executor.on('progress', (progress: TrainingProgress) => {
      this.progress = progress;
      this.emit('progress', { ...progress, stageIndex, stageName: this.config?.stages[stageIndex]?.name });
    });

    executor.on('checkpoint', (checkpoint: TrainingCheckpoint) => {
      this.emit('checkpoint', { ...checkpoint, stageIndex });
    });

    executor.on('log', (log: { level: string; message: string }) => {
      this.emit('log', { ...log, stageIndex });
    });
  }

  /**
   * Wait for user approval
   */
  private async waitForUserApproval(stage: StageConfig): Promise<boolean> {
    this.awaitingApproval = true;

    return new Promise((resolve) => {
      this.approvalResolver = resolve;

      // Auto-approve after timeout (configurable, default 24 hours)
      const timeout = 24 * 60 * 60 * 1000;
      setTimeout(() => {
        if (this.awaitingApproval) {
          this.emit('log', { level: 'warn', message: 'Approval timeout - auto-approving' });
          this.approveStage(true);
        }
      }, timeout);
    });
  }

  /**
   * Approve or reject stage continuation
   */
  approveStage(approved: boolean): void {
    this.awaitingApproval = false;
    if (this.approvalResolver) {
      this.approvalResolver(approved);
      this.approvalResolver = null;
    }
  }

  /**
   * Merge results from all stages
   */
  private mergeResults(stageResults: StageResult[]): TrainingResult {
    if (stageResults.length === 0) {
      return {
        id: this.config?.id || randomUUID(),
        status: 'failed',
        finalLoss: 0,
        bestLoss: Infinity,
        checkpoints: [],
        metrics: { trainLoss: [], learningRates: [] },
        outputModelPath: '',
        totalTrainingTime: 0,
        totalCost: 0,
        error: 'No stages completed',
      };
    }

    const lastStage = stageResults[stageResults.length - 1];
    const allCheckpoints = stageResults.flatMap(r => r.result.checkpoints);
    const mergedMetrics = this.mergeMetrics(stageResults);

    return {
      id: this.config?.id || randomUUID(),
      status: 'completed',
      finalLoss: lastStage.result.finalLoss,
      bestLoss: Math.min(...stageResults.map(r => r.result.bestLoss)),
      checkpoints: allCheckpoints,
      bestCheckpoint: lastStage.result.bestCheckpoint,
      metrics: mergedMetrics,
      outputModelPath: lastStage.result.outputModelPath,
      totalTrainingTime: Date.now() - this.startTime,
      totalCost: stageResults.reduce((sum, r) => sum + r.result.totalCost, 0),
    };
  }

  /**
   * Merge metrics from all stages
   */
  private mergeMetrics(stageResults: StageResult[]): TrainingMetrics {
    return {
      trainLoss: stageResults.flatMap(r => r.result.metrics.trainLoss),
      evalLoss: stageResults.flatMap(r => r.result.metrics.evalLoss || []),
      learningRates: stageResults.flatMap(r => r.result.metrics.learningRates),
      gradNorms: stageResults.flatMap(r => r.result.metrics.gradNorms || []),
    };
  }

  /**
   * Get current stage info
   */
  getCurrentStage(): { index: number; stage: StageConfig } | null {
    if (!this.config || this.currentStageIndex >= this.config.stages.length) {
      return null;
    }
    return {
      index: this.currentStageIndex,
      stage: this.config.stages[this.currentStageIndex],
    };
  }

  /**
   * Get all stage results
   */
  getStageResults(): StageResult[] {
    return this.stageResults;
  }

  /**
   * Check if awaiting approval
   */
  isAwaitingApproval(): boolean {
    return this.awaitingApproval;
  }

  getProgress(): TrainingProgress {
    return this.progress;
  }

  async pause(): Promise<void> {
    this.isPaused = true;
    if (this.currentExecutor) {
      await this.currentExecutor.pause();
    }
    this.emit('log', { level: 'info', message: 'Multi-stage pipeline paused' });
  }

  async resume(): Promise<void> {
    this.isPaused = false;
    if (this.currentExecutor) {
      await this.currentExecutor.resume();
    }
    this.emit('log', { level: 'info', message: 'Multi-stage pipeline resumed' });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.currentExecutor) {
      await this.currentExecutor.stop();
    }
    // Resolve any pending approval
    if (this.awaitingApproval) {
      this.approveStage(false);
    }
    this.emit('log', { level: 'info', message: 'Multi-stage pipeline stopped' });
  }
}

export function createMultiStageExecutor(): MultiStageExecutor {
  return new MultiStageExecutor();
}

export default MultiStageExecutor;
