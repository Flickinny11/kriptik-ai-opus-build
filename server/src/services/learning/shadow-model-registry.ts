/**
 * Shadow Model Registry (Layer 3)
 *
 * Manages the registry of continuously trained shadow models.
 * These are specialized open-source models trained on KripTik's
 * accumulated experience data.
 *
 * Shadow models are trained using:
 * - Preference pairs from RLAIF
 * - Decision traces from successful builds
 * - Error fix patterns
 *
 * Training happens externally (Modal Labs, RunPod) but this registry
 * tracks versions, metrics, and promotion status.
 */

import { db } from '../../db.js';
import { learningShadowModels, learningTrainingRuns } from '../../schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import type {
    ShadowModel,
    ShadowModelStatus,
    ShadowModelMetrics,
    TrainingRun,
    TrainingRunStatus,
    TrainingConfig,
    TrainingMetrics,
    PreferencePair,
} from './types.js';

// =============================================================================
// MODEL DEFINITIONS
// =============================================================================

export const SHADOW_MODEL_CONFIGS = {
    code_specialist: {
        baseModel: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        purpose: 'Code generation and error fixing',
        defaultConfig: {
            framework: 'unsloth' as const,
            method: 'qlora' as const,
            loraRank: 64,
            loraAlpha: 128,
            learningRate: 2e-4,
            batchSize: 4,
            epochs: 3,
            datasetPath: '',
        },
    },
    architecture_specialist: {
        baseModel: 'deepseek-ai/deepseek-coder-6.7b-instruct',
        purpose: 'Architecture decisions and file structure',
        defaultConfig: {
            framework: 'llama-factory' as const,
            method: 'qlora' as const,
            loraRank: 32,
            loraAlpha: 64,
            learningRate: 1e-4,
            batchSize: 2,
            epochs: 2,
            datasetPath: '',
        },
    },
    reasoning_specialist: {
        baseModel: 'meta-llama/Llama-3.1-8B-Instruct',
        purpose: 'Complex reasoning and decision making',
        defaultConfig: {
            framework: 'unsloth' as const,
            method: 'lora' as const,
            loraRank: 64,
            loraAlpha: 128,
            learningRate: 1e-4,
            batchSize: 2,
            epochs: 2,
            datasetPath: '',
        },
    },
    design_specialist: {
        baseModel: 'Qwen/Qwen2.5-7B-Instruct',
        purpose: 'Design decisions and Anti-Slop compliance',
        defaultConfig: {
            framework: 'unsloth' as const,
            method: 'qlora' as const,
            loraRank: 32,
            loraAlpha: 64,
            learningRate: 2e-4,
            batchSize: 4,
            epochs: 3,
            datasetPath: '',
        },
    },
} as const;

export type ShadowModelType = keyof typeof SHADOW_MODEL_CONFIGS;

// =============================================================================
// SHADOW MODEL REGISTRY SERVICE
// =============================================================================

export class ShadowModelRegistry extends EventEmitter {
    private activeModels: Map<ShadowModelType, ShadowModel> = new Map();
    private lastRefresh: Date = new Date(0);
    private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    constructor() {
        super();
        this.loadActiveModels();
    }

    // =========================================================================
    // MODEL MANAGEMENT
    // =========================================================================

    /**
     * Load currently active models
     */
    private async loadActiveModels(): Promise<void> {
        try {
            const rows = await db.select()
                .from(learningShadowModels)
                .where(eq(learningShadowModels.status, 'promoted'))
                .orderBy(desc(learningShadowModels.evalScore));

            // Keep only the highest scoring promoted model per type
            const modelsByType: Map<string, typeof rows[0]> = new Map();
            for (const row of rows) {
                const existing = modelsByType.get(row.modelName);
                if (!existing || (row.evalScore || 0) > (existing.evalScore || 0)) {
                    modelsByType.set(row.modelName, row);
                }
            }

            this.activeModels.clear();
            for (const [name, row] of modelsByType) {
                this.activeModels.set(name as ShadowModelType, this.mapShadowModelRow(row));
            }

            this.lastRefresh = new Date();
            console.log(`[ShadowModelRegistry] Loaded ${this.activeModels.size} active models`);
        } catch (error) {
            console.error('[ShadowModelRegistry] Failed to load active models:', error);
        }
    }

    /**
     * Get active model for a specific type
     */
    async getActiveModel(type: ShadowModelType): Promise<ShadowModel | null> {
        if (this.shouldRefresh()) {
            await this.loadActiveModels();
        }
        return this.activeModels.get(type) || null;
    }

    /**
     * Get all active models
     */
    async getAllActiveModels(): Promise<Map<ShadowModelType, ShadowModel>> {
        if (this.shouldRefresh()) {
            await this.loadActiveModels();
        }
        return new Map(this.activeModels);
    }

    /**
     * Register a new model version
     */
    async registerModel(input: {
        modelName: ShadowModelType;
        version: string;
        adapterName: string;
        trainingDataCount: number;
        adapterPath?: string;
    }): Promise<ShadowModel> {
        const config = SHADOW_MODEL_CONFIGS[input.modelName];
        if (!config) {
            throw new Error(`Unknown model type: ${input.modelName}`);
        }

        const now = new Date();
        const model: ShadowModel = {
            modelName: input.modelName,
            baseModel: config.baseModel,
            adapterName: input.adapterName,
            version: input.version,
            trainingDataCount: input.trainingDataCount,
            trainingDate: now.toISOString(),
            status: 'training',
            adapterPath: input.adapterPath,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(learningShadowModels).values({
            id: uuidv4(),
            modelName: model.modelName,
            baseModel: model.baseModel,
            adapterName: model.adapterName,
            version: model.version,
            trainingDataCount: model.trainingDataCount,
            trainingDate: model.trainingDate,
            status: model.status,
            adapterPath: model.adapterPath,
            createdAt: model.createdAt.toISOString(),
            updatedAt: model.updatedAt.toISOString(),
        });

        this.emit('model_registered', { modelName: input.modelName, version: input.version });
        return model;
    }

    /**
     * Update model status after training
     */
    async updateModelStatus(
        modelName: ShadowModelType,
        version: string,
        status: ShadowModelStatus,
        evalScore?: number,
        metrics?: ShadowModelMetrics
    ): Promise<void> {
        await db.update(learningShadowModels)
            .set({
                status,
                evalScore,
                metrics,
                updatedAt: new Date().toISOString(),
            })
            .where(and(
                eq(learningShadowModels.modelName, modelName),
                eq(learningShadowModels.version, version)
            ));

        // Refresh active models if status changed to promoted
        if (status === 'promoted') {
            await this.loadActiveModels();
        }

        this.emit('model_updated', { modelName, version, status, evalScore });
    }

    /**
     * Promote a model to active status
     */
    async promoteModel(
        modelName: ShadowModelType,
        version: string
    ): Promise<void> {
        // First, demote any currently promoted version
        await db.update(learningShadowModels)
            .set({
                status: 'deprecated',
                updatedAt: new Date().toISOString(),
            })
            .where(and(
                eq(learningShadowModels.modelName, modelName),
                eq(learningShadowModels.status, 'promoted')
            ));

        // Then promote the new version
        await db.update(learningShadowModels)
            .set({
                status: 'promoted',
                updatedAt: new Date().toISOString(),
            })
            .where(and(
                eq(learningShadowModels.modelName, modelName),
                eq(learningShadowModels.version, version)
            ));

        await this.loadActiveModels();
        this.emit('model_promoted', { modelName, version });
    }

    /**
     * Get model history
     */
    async getModelHistory(modelName: ShadowModelType): Promise<ShadowModel[]> {
        const rows = await db.select()
            .from(learningShadowModels)
            .where(eq(learningShadowModels.modelName, modelName))
            .orderBy(desc(learningShadowModels.createdAt));

        return rows.map(this.mapShadowModelRow);
    }

    // =========================================================================
    // TRAINING RUNS
    // =========================================================================

    /**
     * Create a training run
     */
    async createTrainingRun(input: {
        modelName: ShadowModelType;
        config: TrainingConfig;
        computeProvider?: string;
        gpuType?: string;
    }): Promise<TrainingRun> {
        const runId = `run_${uuidv4()}`;
        const now = new Date();

        const run: TrainingRun = {
            runId,
            modelName: input.modelName,
            config: input.config,
            computeProvider: input.computeProvider,
            gpuType: input.gpuType,
            status: 'pending',
            createdAt: now,
        };

        await db.insert(learningTrainingRuns).values({
            id: uuidv4(),
            runId: run.runId,
            modelName: run.modelName,
            config: run.config,
            computeProvider: run.computeProvider,
            gpuType: run.gpuType,
            status: run.status,
            createdAt: run.createdAt.toISOString(),
        });

        this.emit('training_run_created', { runId, modelName: input.modelName });
        return run;
    }

    /**
     * Update training run status
     */
    async updateTrainingRun(
        runId: string,
        status: TrainingRunStatus,
        updates?: {
            modelVersion?: string;
            metrics?: TrainingMetrics;
            error?: string;
        }
    ): Promise<void> {
        const updateData: Record<string, unknown> = {
            status,
            updatedAt: new Date().toISOString(),
        };

        if (updates?.modelVersion) {
            updateData.modelVersion = updates.modelVersion;
        }
        if (updates?.metrics) {
            updateData.metrics = updates.metrics;
        }
        if (updates?.error) {
            updateData.error = updates.error;
        }

        if (status === 'running') {
            updateData.startedAt = new Date().toISOString();
        } else if (status === 'completed' || status === 'failed') {
            updateData.completedAt = new Date().toISOString();
        }

        await db.update(learningTrainingRuns)
            .set(updateData as typeof learningTrainingRuns.$inferInsert)
            .where(eq(learningTrainingRuns.runId, runId));

        this.emit('training_run_updated', { runId, status });
    }

    /**
     * Get recent training runs
     */
    async getRecentTrainingRuns(limit: number = 20): Promise<TrainingRun[]> {
        const rows = await db.select()
            .from(learningTrainingRuns)
            .orderBy(desc(learningTrainingRuns.createdAt))
            .limit(limit);

        return rows.map(this.mapTrainingRunRow);
    }

    /**
     * Get pending training runs
     */
    async getPendingTrainingRuns(): Promise<TrainingRun[]> {
        const rows = await db.select()
            .from(learningTrainingRuns)
            .where(eq(learningTrainingRuns.status, 'pending'))
            .orderBy(learningTrainingRuns.createdAt);

        return rows.map(this.mapTrainingRunRow);
    }

    // =========================================================================
    // TRAINING DATA PREPARATION
    // =========================================================================

    /**
     * Prepare training data from preference pairs
     */
    prepareTrainingData(
        pairs: PreferencePair[],
        modelType: ShadowModelType
    ): { prompt: string; chosen: string; rejected: string }[] {
        // Filter pairs relevant to model type
        const relevantDomains: Record<ShadowModelType, string[]> = {
            code_specialist: ['code', 'error_fix'],
            architecture_specialist: ['architecture', 'code'],
            reasoning_specialist: ['code', 'architecture', 'design', 'error_fix'],
            design_specialist: ['design'],
        };

        const domains = relevantDomains[modelType] || [];
        const filteredPairs = pairs.filter(p => domains.includes(p.domain));

        // Format for DPO training
        return filteredPairs.map(pair => ({
            prompt: pair.prompt,
            chosen: pair.chosen,
            rejected: pair.rejected,
        }));
    }

    /**
     * Export training data to JSONL format
     */
    exportToJsonl(
        data: { prompt: string; chosen: string; rejected: string }[]
    ): string {
        return data.map(item => JSON.stringify({
            prompt: item.prompt,
            chosen: [{ role: 'assistant', content: item.chosen }],
            rejected: [{ role: 'assistant', content: item.rejected }],
        })).join('\n');
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get registry statistics
     */
    async getRegistryStats(): Promise<{
        totalModels: number;
        activeModels: number;
        totalTrainingRuns: number;
        pendingRuns: number;
        avgEvalScore: number;
        modelsByType: Record<string, number>;
    }> {
        const models = await db.select().from(learningShadowModels);
        const runs = await db.select().from(learningTrainingRuns);

        let activeCount = 0;
        let totalScore = 0;
        let scoredCount = 0;
        const modelsByType: Record<string, number> = {};

        for (const model of models) {
            if (model.status === 'promoted') activeCount++;
            if (model.evalScore) {
                totalScore += model.evalScore;
                scoredCount++;
            }
            modelsByType[model.modelName] = (modelsByType[model.modelName] || 0) + 1;
        }

        const pendingRuns = runs.filter(r => r.status === 'pending').length;

        return {
            totalModels: models.length,
            activeModels: activeCount,
            totalTrainingRuns: runs.length,
            pendingRuns,
            avgEvalScore: scoredCount > 0 ? totalScore / scoredCount : 0,
            modelsByType,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private shouldRefresh(): boolean {
        return Date.now() - this.lastRefresh.getTime() > this.REFRESH_INTERVAL_MS;
    }

    private mapShadowModelRow = (row: typeof learningShadowModels.$inferSelect): ShadowModel => ({
        modelName: row.modelName,
        baseModel: row.baseModel,
        adapterName: row.adapterName,
        version: row.version,
        evalScore: row.evalScore || undefined,
        metrics: row.metrics as ShadowModelMetrics | undefined,
        trainingDataCount: row.trainingDataCount || undefined,
        trainingDate: row.trainingDate || undefined,
        status: row.status as ShadowModelStatus,
        adapterPath: row.adapterPath || undefined,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    });

    private mapTrainingRunRow = (row: typeof learningTrainingRuns.$inferSelect): TrainingRun => ({
        runId: row.runId,
        modelName: row.modelName,
        modelVersion: row.modelVersion || undefined,
        config: row.config as TrainingConfig,
        computeProvider: row.computeProvider || undefined,
        gpuType: row.gpuType || undefined,
        status: row.status as TrainingRunStatus,
        metrics: row.metrics as TrainingMetrics | undefined,
        startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
        completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
        error: row.error || undefined,
        createdAt: new Date(row.createdAt),
    });
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: ShadowModelRegistry | null = null;

export function getShadowModelRegistry(): ShadowModelRegistry {
    if (!instance) {
        instance = new ShadowModelRegistry();
    }
    return instance;
}

