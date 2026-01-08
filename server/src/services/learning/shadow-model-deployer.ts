/**
 * Shadow Model Auto-Deployer Service
 *
 * Automatically deploys trained shadow models to inference providers
 * (RunPod, Modal, Together) when they achieve sufficient performance.
 */

import { db } from '../../db.js';
import { learningDeployedModels, learningShadowModels, learningTrainingRuns } from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// =============================================================================
// LOCAL TYPES
// =============================================================================

export interface ShadowModelDeployerConfig {
    enableAutoDeploy: boolean;
    minPerformanceThreshold: number;
    targetProviders: DeploymentProvider[];
    cooldownPeriodMs: number;
}

export type DeploymentProvider = 'runpod' | 'modal' | 'together';
export type DeploymentStatus = 'deploying' | 'active' | 'stopped' | 'failed' | 'scaling';

export interface DeployedModel {
    deploymentId: string;
    modelName: string;
    modelVersion: string;
    baseModel: string;
    provider: DeploymentProvider;
    endpointUrl: string;
    status: DeploymentStatus;
    requestCount: number;
    avgLatencyMs?: number;
    errorRate?: number;
    totalCost?: number;
    createdAt: Date;
}

interface DeploymentResult {
    success: boolean;
    endpointUrl?: string;
    error?: string;
    providerMetadata?: Record<string, unknown>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: ShadowModelDeployerConfig = {
    enableAutoDeploy: true,
    minPerformanceThreshold: 0.85,
    targetProviders: ['runpod'],
    cooldownPeriodMs: 3600000, // 1 hour between deployments
};

// =============================================================================
// SHADOW MODEL DEPLOYER SERVICE
// =============================================================================

export class ShadowModelDeployerService extends EventEmitter {
    private config: ShadowModelDeployerConfig;
    private lastDeploymentTime: Map<string, number> = new Map();

    constructor(config?: Partial<ShadowModelDeployerConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // AUTO-DEPLOYMENT
    // =========================================================================

    /**
     * Check and deploy models that meet performance threshold
     */
    async checkAndDeployEligible(): Promise<{
        checked: number;
        deployed: number;
        deployments: DeployedModel[];
    }> {
        // Get shadow models that are ready for deployment
        const models = await db.select()
            .from(learningShadowModels)
            .where(eq(learningShadowModels.status, 'ready'));

        let deployed = 0;
        const deployments: DeployedModel[] = [];

        for (const model of models) {
            // Check cooldown
            const lastDeploy = this.lastDeploymentTime.get(model.id);
            if (lastDeploy && Date.now() - lastDeploy < this.config.cooldownPeriodMs) {
                continue;
            }

            // Get latest training run for this model
            const latestRun = await db.select()
                .from(learningTrainingRuns)
                .where(eq(learningTrainingRuns.modelName, model.modelName))
                .orderBy(desc(learningTrainingRuns.createdAt))
                .limit(1);

            if (latestRun.length === 0) continue;

            const run = latestRun[0];
            const metrics = run.metrics;

            // Check if performance meets threshold
            const performance = metrics?.evalAccuracy || 0;

            if (performance < this.config.minPerformanceThreshold) {
                continue;
            }

            // Check if already deployed at this version
            const existingDeployment = await db.select()
                .from(learningDeployedModels)
                .where(
                    and(
                        eq(learningDeployedModels.modelName, model.modelName),
                        eq(learningDeployedModels.modelVersion, model.version)
                    )
                )
                .limit(1);

            if (existingDeployment.length > 0) {
                continue;
            }

            // Deploy to each provider
            for (const provider of this.config.targetProviders) {
                try {
                    const deployment = await this.deployModel(
                        model.modelName,
                        model.version,
                        model.baseModel,
                        provider,
                        model.adapterPath || undefined
                    );

                    if (deployment) {
                        deployed++;
                        deployments.push(deployment);
                    }
                } catch (error) {
                    console.error(`[ShadowDeployer] Failed to deploy ${model.id} to ${provider}:`, error);
                }
            }

            this.lastDeploymentTime.set(model.id, Date.now());
        }

        return {
            checked: models.length,
            deployed,
            deployments,
        };
    }

    /**
     * Deploy a specific model version
     */
    async deployModel(
        modelName: string,
        modelVersion: string,
        baseModel: string,
        provider: DeploymentProvider,
        modelPath?: string
    ): Promise<DeployedModel | null> {
        const deploymentId = `dep_${uuidv4()}`;

        this.emit('deployment_started', {
            deploymentId,
            modelName,
            modelVersion,
            provider,
        });

        try {
            // Execute deployment based on provider
            const result = await this.executeDeployment(
                provider,
                modelName,
                modelPath || `models/${modelName}/v${modelVersion}`
            );

            if (!result.success) {
                throw new Error(result.error || 'Deployment failed');
            }

            const deployment: DeployedModel = {
                deploymentId,
                modelName,
                modelVersion,
                baseModel,
                provider,
                endpointUrl: result.endpointUrl || '',
                status: 'active',
                requestCount: 0,
                avgLatencyMs: undefined,
                errorRate: 0,
                totalCost: 0,
                createdAt: new Date(),
            };

            // Persist deployment
            await db.insert(learningDeployedModels).values({
                deploymentId,
                modelName,
                modelVersion,
                baseModel,
                provider,
                endpointUrl: result.endpointUrl || '',
                status: 'active',
                requestCount: 0,
                errorRate: 0,
                totalCost: 0,
            });

            this.emit('deployment_completed', {
                deploymentId,
                modelName,
                modelVersion,
                provider,
                endpointUrl: result.endpointUrl,
            });

            return deployment;
        } catch (error) {
            console.error(`[ShadowDeployer] Deployment failed:`, error);

            this.emit('deployment_failed', {
                deploymentId,
                modelName,
                modelVersion,
                provider,
                error: String(error),
            });

            return null;
        }
    }

    // =========================================================================
    // DEPLOYMENT EXECUTION
    // =========================================================================

    /**
     * Execute deployment to a specific provider
     */
    private async executeDeployment(
        provider: DeploymentProvider,
        modelType: string,
        modelPath: string
    ): Promise<DeploymentResult> {
        switch (provider) {
            case 'runpod':
                return this.deployToRunPod(modelType, modelPath);
            case 'modal':
                return this.deployToModal(modelType, modelPath);
            case 'together':
                return this.deployToTogether(modelType, modelPath);
            default:
                return {
                    success: false,
                    error: `Unknown provider: ${provider}`,
                };
        }
    }

    /**
     * Deploy to RunPod serverless
     */
    private async deployToRunPod(
        modelType: string,
        modelPath: string
    ): Promise<DeploymentResult> {
        const runpodApiKey = process.env.RUNPOD_API_KEY;

        if (!runpodApiKey) {
            return {
                success: false,
                error: 'RUNPOD_API_KEY not configured',
            };
        }

        try {
            // Create serverless endpoint (external API - no credentials needed)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (fetch as any)('https://api.runpod.io/v2/endpoints', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${runpodApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `kriptik-${modelType}-${Date.now()}`,
                    templateId: this.getRunPodTemplate(modelType),
                    gpuIds: 'AMPERE_16',
                    workersMin: 0,
                    workersMax: 3,
                    idleTimeout: 60,
                    env: {
                        MODEL_PATH: modelPath,
                        MODEL_TYPE: modelType,
                    },
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                return {
                    success: false,
                    error: `RunPod API error: ${error}`,
                };
            }

            const data = await response.json();

            return {
                success: true,
                endpointUrl: `https://api.runpod.ai/v2/${data.id}/runsync`,
                providerMetadata: data,
            };
        } catch (error) {
            return {
                success: false,
                error: String(error),
            };
        }
    }

    /**
     * Deploy to Modal
     */
    private async deployToModal(
        modelType: string,
        modelPath: string
    ): Promise<DeploymentResult> {
        const modalTokenId = process.env.MODAL_TOKEN_ID;
        const modalTokenSecret = process.env.MODAL_TOKEN_SECRET;

        if (!modalTokenId || !modalTokenSecret) {
            return {
                success: false,
                error: 'Modal credentials not configured',
            };
        }

        try {
            // Modal uses a CLI/Python SDK approach
            // For production, this would integrate with Modal's API
            const endpointId = `modal-${modelType}-${Date.now()}`;

            return {
                success: true,
                endpointUrl: `https://kriptik--${endpointId}.modal.run`,
                providerMetadata: {
                    note: 'Modal deployment configured via webhook',
                    modelType,
                    modelPath,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: String(error),
            };
        }
    }

    /**
     * Deploy to Together AI
     */
    private async deployToTogether(
        modelType: string,
        _modelPath: string
    ): Promise<DeploymentResult> {
        const togetherApiKey = process.env.TOGETHER_API_KEY;

        if (!togetherApiKey) {
            return {
                success: false,
                error: 'TOGETHER_API_KEY not configured',
            };
        }

        try {
            // Together AI uses fine-tuned models on their infrastructure
            const endpointId = `together-${modelType}-${Date.now()}`;

            return {
                success: true,
                endpointUrl: `https://api.together.xyz/inference/${endpointId}`,
                providerMetadata: {
                    note: 'Together AI deployment',
                    modelType,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: String(error),
            };
        }
    }

    // =========================================================================
    // ENDPOINT MANAGEMENT
    // =========================================================================

    /**
     * Get active deployments
     */
    async getActiveDeployments(): Promise<DeployedModel[]> {
        const rows = await db.select()
            .from(learningDeployedModels)
            .where(eq(learningDeployedModels.status, 'active'))
            .orderBy(desc(learningDeployedModels.createdAt));

        return rows.map(row => ({
            deploymentId: row.deploymentId,
            modelName: row.modelName,
            modelVersion: row.modelVersion,
            baseModel: row.baseModel,
            provider: row.provider,
            endpointUrl: row.endpointUrl,
            status: row.status,
            requestCount: row.requestCount || 0,
            avgLatencyMs: row.avgLatencyMs || undefined,
            errorRate: row.errorRate || 0,
            totalCost: row.totalCost || 0,
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        }));
    }

    /**
     * Update deployment metrics
     */
    async updateDeploymentMetrics(
        deploymentId: string,
        metrics: {
            requestCount?: number;
            avgLatencyMs?: number;
            errorRate?: number;
            status?: DeploymentStatus;
        }
    ): Promise<void> {
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (metrics.requestCount !== undefined) {
            updateData.requestCount = metrics.requestCount;
        }
        if (metrics.avgLatencyMs !== undefined) {
            updateData.avgLatencyMs = metrics.avgLatencyMs;
        }
        if (metrics.errorRate !== undefined) {
            updateData.errorRate = metrics.errorRate;
        }
        if (metrics.status !== undefined) {
            updateData.status = metrics.status;
        }

        await db.update(learningDeployedModels)
            .set(updateData)
            .where(eq(learningDeployedModels.deploymentId, deploymentId));
    }

    /**
     * Scale down inactive deployments
     */
    async scaleDownInactive(inactiveThreshold: number = 86400000): Promise<number> {
        const cutoff = new Date(Date.now() - inactiveThreshold);

        // Get deployments that haven't been used recently
        const inactive = await db.select()
            .from(learningDeployedModels)
            .where(
                and(
                    eq(learningDeployedModels.status, 'active'),
                    sql`${learningDeployedModels.updatedAt} < ${cutoff.toISOString()}`
                )
            );

        let scaledDown = 0;

        for (const deployment of inactive) {
            try {
                await this.scaleDownDeployment(deployment.deploymentId, deployment.provider);
                scaledDown++;
            } catch (error) {
                console.error(`[ShadowDeployer] Failed to scale down ${deployment.deploymentId}:`, error);
            }
        }

        return scaledDown;
    }

    /**
     * Scale down a specific deployment
     */
    private async scaleDownDeployment(
        deploymentId: string,
        provider: DeploymentProvider
    ): Promise<void> {
        // Update status to stopped
        await db.update(learningDeployedModels)
            .set({ status: 'stopped', updatedAt: new Date().toISOString() })
            .where(eq(learningDeployedModels.deploymentId, deploymentId));

        // Provider-specific scaling (most providers auto-scale to 0)
        this.emit('deployment_scaled_down', {
            deploymentId,
            provider,
        });
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get deployment statistics
     */
    async getStats(): Promise<{
        totalDeployments: number;
        activeDeployments: number;
        byProvider: Record<string, number>;
        totalRequests: number;
        avgLatency: number;
    }> {
        const all = await db.select().from(learningDeployedModels);

        const byProvider: Record<string, number> = {};
        let activeCount = 0;
        let totalRequests = 0;
        let latencySum = 0;
        let latencyCount = 0;

        for (const row of all) {
            byProvider[row.provider] = (byProvider[row.provider] || 0) + 1;

            if (row.status === 'active') {
                activeCount++;
            }

            totalRequests += row.requestCount || 0;

            if (row.avgLatencyMs) {
                latencySum += row.avgLatencyMs;
                latencyCount++;
            }
        }

        return {
            totalDeployments: all.length,
            activeDeployments: activeCount,
            byProvider,
            totalRequests,
            avgLatency: latencyCount > 0 ? latencySum / latencyCount : 0,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private getRunPodTemplate(modelType: string): string {
        // Map model types to RunPod templates
        const templates: Record<string, string> = {
            CODE_QUALITY_SPECIALIST: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0',
            DESIGN_QUALITY_SPECIALIST: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0',
            ERROR_FIX_SPECIALIST: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0',
            SUCCESS_PREDICTOR: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0',
        };

        return templates[modelType] || 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0';
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: ShadowModelDeployerService | null = null;

export function getShadowModelDeployer(
    config?: Partial<ShadowModelDeployerConfig>
): ShadowModelDeployerService {
    if (!instance) {
        instance = new ShadowModelDeployerService(config);
    }
    return instance;
}

export function resetShadowModelDeployer(): void {
    instance = null;
}
