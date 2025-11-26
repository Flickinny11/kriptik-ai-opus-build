/**
 * RunPod Integration
 *
 * RunPod provides GPU serverless and pod computing for AI workloads
 * https://docs.runpod.io/
 */

import { v4 as uuidv4 } from 'uuid';
import {
    CloudProviderInterface,
    DeploymentConfig,
    Deployment,
    DeploymentLog,
    GPUPricing,
    CostEstimate,
    DeploymentStatus,
    RunPodCredentials,
} from './types';
import { pricingCalculator } from './pricing';

const RUNPOD_API_BASE = 'https://api.runpod.io/graphql';

// RunPod GraphQL Types
interface RunPodPod {
    id: string;
    name: string;
    runtime: {
        gpus: Array<{ id: string; gpuUtilPercent: number; memoryUtilPercent: number }>;
    };
    desiredStatus: string;
    lastStatusChange: string;
    machine: {
        gpuDisplayName: string;
    };
    costPerHr: number;
}

interface RunPodEndpoint {
    id: string;
    name: string;
    templateId: string;
    workersMax: number;
    workersMin: number;
    idleTimeout: number;
    gpuIds: string;
}

/**
 * RunPod Cloud Provider
 */
export class RunPodProvider implements CloudProviderInterface {
    readonly provider = 'runpod' as const;
    private apiKey: string;

    constructor(credentials: RunPodCredentials) {
        this.apiKey = credentials.apiKey;
    }

    /**
     * Execute GraphQL query
     */
    private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
        const response = await fetch(RUNPOD_API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            throw new Error(`RunPod API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.errors) {
            throw new Error(data.errors[0]?.message || 'RunPod GraphQL error');
        }

        return data.data;
    }

    /**
     * Validate API credentials
     */
    async validateCredentials(): Promise<boolean> {
        try {
            await this.graphql<{ myself: { id: string } }>(`
                query {
                    myself {
                        id
                    }
                }
            `);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get GPU pricing from RunPod
     */
    async getGPUPricing(): Promise<GPUPricing[]> {
        // RunPod pricing is fetched from our cached pricing calculator
        // In production, this could be updated via RunPod's API
        return pricingCalculator.getGPUPricing('runpod');
    }

    /**
     * Estimate deployment cost
     */
    async estimateCost(config: DeploymentConfig): Promise<CostEstimate> {
        return pricingCalculator.estimateCost(config);
    }

    /**
     * Deploy a serverless endpoint
     */
    async deploy(config: DeploymentConfig): Promise<Deployment> {
        const deploymentId = uuidv4();
        const now = new Date();

        // For serverless GPU workloads
        if (config.resourceType === 'serverless' || config.resourceType === 'gpu') {
            return this.deployServerlessEndpoint(deploymentId, config, now);
        }

        // For persistent pods
        return this.deployPod(deploymentId, config, now);
    }

    /**
     * Deploy a serverless endpoint for AI inference
     */
    private async deployServerlessEndpoint(
        deploymentId: string,
        config: DeploymentConfig,
        now: Date
    ): Promise<Deployment> {
        // Create serverless endpoint
        const result = await this.graphql<{
            saveEndpoint: { id: string };
        }>(`
            mutation CreateEndpoint($input: EndpointInput!) {
                saveEndpoint(input: $input) {
                    id
                }
            }
        `, {
            input: {
                name: config.name,
                templateId: config.containerImage, // Docker image URL
                gpuIds: this.mapGPUToRunPodId(config.gpu?.type),
                workersMin: config.scaling?.minReplicas || 0,
                workersMax: config.scaling?.maxReplicas || 3,
                idleTimeout: config.timeoutSeconds || 60,
                env: Object.entries(config.environmentVariables || {}).map(([key, value]) => ({
                    key,
                    value,
                })),
            },
        });

        return {
            id: deploymentId,
            projectId: '',
            userId: '',
            provider: 'runpod',
            config,
            status: 'deploying',
            providerResourceId: result.saveEndpoint.id,
            url: `https://api.runpod.ai/v2/${result.saveEndpoint.id}/runsync`,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Deploy a persistent GPU pod
     */
    private async deployPod(
        deploymentId: string,
        config: DeploymentConfig,
        now: Date
    ): Promise<Deployment> {
        const result = await this.graphql<{
            podFindAndDeployOnDemand: { id: string };
        }>(`
            mutation DeployPod(
                $cloudType: String!,
                $gpuTypeId: String!,
                $name: String!,
                $imageName: String!,
                $volumeInGb: Int,
                $containerDiskInGb: Int,
                $ports: String,
                $env: [EnvInput!]
            ) {
                podFindAndDeployOnDemand(input: {
                    cloudType: $cloudType,
                    gpuTypeId: $gpuTypeId,
                    name: $name,
                    imageName: $imageName,
                    volumeInGb: $volumeInGb,
                    containerDiskInGb: $containerDiskInGb,
                    ports: $ports,
                    env: $env
                }) {
                    id
                }
            }
        `, {
            cloudType: 'COMMUNITY', // or 'SECURE'
            gpuTypeId: this.mapGPUToRunPodId(config.gpu?.type),
            name: config.name,
            imageName: config.containerImage || 'runpod/pytorch:latest',
            volumeInGb: config.volumes?.[0]?.sizeGB || 20,
            containerDiskInGb: 20,
            ports: config.port ? `${config.port}/http` : '8000/http',
            env: Object.entries(config.environmentVariables || {}).map(([key, value]) => ({
                key,
                value,
            })),
        });

        return {
            id: deploymentId,
            projectId: '',
            userId: '',
            provider: 'runpod',
            config,
            status: 'deploying',
            providerResourceId: result.podFindAndDeployOnDemand.id,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Get deployment status
     */
    async getDeployment(deploymentId: string): Promise<Deployment | null> {
        // This would need to be stored in our database
        // For now, we return a placeholder
        return null;
    }

    /**
     * List all deployments
     */
    async listDeployments(projectId?: string): Promise<Deployment[]> {
        // Get pods
        const podsResult = await this.graphql<{ myself: { pods: RunPodPod[] } }>(`
            query {
                myself {
                    pods {
                        id
                        name
                        desiredStatus
                        lastStatusChange
                        costPerHr
                        machine {
                            gpuDisplayName
                        }
                    }
                }
            }
        `);

        // Get endpoints
        const endpointsResult = await this.graphql<{ myself: { endpoints: RunPodEndpoint[] } }>(`
            query {
                myself {
                    endpoints {
                        id
                        name
                        workersMin
                        workersMax
                    }
                }
            }
        `);

        const deployments: Deployment[] = [];

        // Map pods to deployments
        for (const pod of podsResult.myself.pods || []) {
            deployments.push({
                id: pod.id,
                projectId: projectId || '',
                userId: '',
                provider: 'runpod',
                config: {
                    provider: 'runpod',
                    resourceType: 'gpu',
                    region: 'US',
                    name: pod.name,
                },
                status: this.mapRunPodStatus(pod.desiredStatus),
                providerResourceId: pod.id,
                estimatedMonthlyCost: pod.costPerHr * 24 * 30,
                createdAt: new Date(pod.lastStatusChange),
                updatedAt: new Date(pod.lastStatusChange),
            });
        }

        // Map endpoints to deployments
        for (const endpoint of endpointsResult.myself.endpoints || []) {
            deployments.push({
                id: endpoint.id,
                projectId: projectId || '',
                userId: '',
                provider: 'runpod',
                config: {
                    provider: 'runpod',
                    resourceType: 'serverless',
                    region: 'US',
                    name: endpoint.name,
                    scaling: {
                        minReplicas: endpoint.workersMin,
                        maxReplicas: endpoint.workersMax,
                    },
                },
                status: 'running',
                providerResourceId: endpoint.id,
                url: `https://api.runpod.ai/v2/${endpoint.id}/runsync`,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        return deployments;
    }

    /**
     * Update deployment configuration
     */
    async updateDeployment(deploymentId: string, config: Partial<DeploymentConfig>): Promise<Deployment> {
        // For serverless endpoints
        if (config.scaling) {
            await this.graphql(`
                mutation UpdateEndpoint($id: String!, $workersMin: Int, $workersMax: Int) {
                    saveEndpoint(input: {
                        id: $id,
                        workersMin: $workersMin,
                        workersMax: $workersMax
                    }) {
                        id
                    }
                }
            `, {
                id: deploymentId,
                workersMin: config.scaling.minReplicas,
                workersMax: config.scaling.maxReplicas,
            });
        }

        const deployment = await this.getDeployment(deploymentId);
        return deployment || {
            id: deploymentId,
            projectId: '',
            userId: '',
            provider: 'runpod',
            config: config as DeploymentConfig,
            status: 'running',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    /**
     * Stop a deployment
     */
    async stopDeployment(deploymentId: string): Promise<void> {
        await this.graphql(`
            mutation StopPod($id: String!) {
                podStop(input: { podId: $id }) {
                    id
                }
            }
        `, { id: deploymentId });
    }

    /**
     * Delete a deployment
     */
    async deleteDeployment(deploymentId: string): Promise<void> {
        // Try to delete as pod first, then as endpoint
        try {
            await this.graphql(`
                mutation DeletePod($id: String!) {
                    podTerminate(input: { podId: $id })
                }
            `, { id: deploymentId });
        } catch {
            // Try as endpoint
            await this.graphql(`
                mutation DeleteEndpoint($id: String!) {
                    deleteEndpoint(id: $id)
                }
            `, { id: deploymentId });
        }
    }

    /**
     * Get deployment logs
     */
    async getDeploymentLogs(deploymentId: string, options?: {
        since?: Date;
        limit?: number;
    }): Promise<DeploymentLog[]> {
        // RunPod logs are accessed differently - via their logs API
        // This is a simplified implementation
        return [];
    }

    /**
     * Stream deployment logs
     */
    streamDeploymentLogs(deploymentId: string, callback: (log: DeploymentLog) => void): () => void {
        // RunPod doesn't have a native log streaming API
        // We would poll the logs endpoint
        let isActive = true;

        const poll = async () => {
            while (isActive) {
                const logs = await this.getDeploymentLogs(deploymentId, { limit: 10 });
                logs.forEach(callback);
                await new Promise(r => setTimeout(r, 5000));
            }
        };

        poll();

        return () => {
            isActive = false;
        };
    }

    /**
     * Scale deployment
     */
    async scaleDeployment(deploymentId: string, replicas: number): Promise<void> {
        await this.graphql(`
            mutation ScaleEndpoint($id: String!, $workers: Int!) {
                saveEndpoint(input: {
                    id: $id,
                    workersMin: $workers,
                    workersMax: $workers
                }) {
                    id
                }
            }
        `, {
            id: deploymentId,
            workers: replicas,
        });
    }

    /**
     * Get available regions
     */
    async getAvailableRegions(): Promise<Array<{ id: string; name: string; available: boolean }>> {
        return [
            { id: 'US', name: 'United States', available: true },
            { id: 'EU', name: 'Europe', available: true },
            { id: 'CA', name: 'Canada', available: true },
        ];
    }

    // Helper methods

    /**
     * Map GPU type to RunPod GPU ID
     */
    private mapGPUToRunPodId(gpuType?: string): string {
        const mapping: Record<string, string> = {
            'nvidia-a100-80gb': 'NVIDIA A100 80GB PCIe',
            'nvidia-a100-40gb': 'NVIDIA A100-SXM4-40GB',
            'nvidia-h100': 'NVIDIA H100 PCIe',
            'nvidia-a40': 'NVIDIA A40',
            'nvidia-l40': 'NVIDIA L40',
            'nvidia-rtx-4090': 'NVIDIA GeForce RTX 4090',
            'nvidia-rtx-3090': 'NVIDIA GeForce RTX 3090',
        };
        return mapping[gpuType || ''] || 'NVIDIA RTX A4000';
    }

    /**
     * Map RunPod status to our status
     */
    private mapRunPodStatus(status: string): DeploymentStatus {
        const mapping: Record<string, DeploymentStatus> = {
            'RUNNING': 'running',
            'STOPPED': 'stopped',
            'EXITED': 'stopped',
            'CREATED': 'pending',
            'STARTING': 'deploying',
            'STOPPING': 'stopping',
        };
        return mapping[status] || 'pending';
    }
}

/**
 * Create a RunPod provider instance
 */
export function createRunPodProvider(apiKey: string): RunPodProvider {
    return new RunPodProvider({ apiKey });
}

