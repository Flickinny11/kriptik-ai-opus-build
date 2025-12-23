/**
 * Google Cloud Platform Integration
 *
 * Supports Cloud Run, GKE, Compute Engine (GPU)
 */

import { v4 as uuidv4 } from 'uuid';
import { createSign } from 'crypto';
import {
    CloudProviderInterface,
    DeploymentConfig,
    Deployment,
    DeploymentLog,
    GPUPricing,
    CostEstimate,
    DeploymentStatus,
    GCPCredentials,
} from './types.js';
import { pricingCalculator } from './pricing.js';

// GCP API Base URLs
const CLOUD_RUN_API = 'https://run.googleapis.com/v2';
const COMPUTE_API = 'https://compute.googleapis.com/compute/v1';

/**
 * Google Cloud Platform Provider
 */
export class GCPProvider implements CloudProviderInterface {
    readonly provider = 'gcp' as const;
    private credentials: GCPCredentials;
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(credentials: GCPCredentials) {
        this.credentials = credentials;
    }

    /**
     * Get access token for API calls
     */
    private async getAccessToken(): Promise<string> {
        // Check if we have a valid token
        if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
            return this.accessToken;
        }

        // For Application Default Credentials (ADC)
        if (this.credentials.useADC) {
            // In production, this would use the metadata server or local credentials
            throw new Error('ADC not implemented - use service account key');
        }

        // For Service Account Key
        if (this.credentials.serviceAccountKey) {
            const key = JSON.parse(this.credentials.serviceAccountKey);
            const token = await this.getServiceAccountToken(key);
            this.accessToken = token.access_token;
            this.tokenExpiry = new Date(Date.now() + (token.expires_in - 60) * 1000);
            return this.accessToken;
        }

        throw new Error('No valid GCP credentials provided');
    }

    /**
     * Get token from service account
     */
    private async getServiceAccountToken(key: any): Promise<{ access_token: string; expires_in: number }> {
        const jwt = this.createJWT(key);

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to get GCP access token');
        }

        return response.json();
    }

    /**
     * Create JWT for service account authentication
     * Uses RS256 signing with the service account's private key
     */
    private createJWT(key: { client_email: string; private_key: string }): string {
        const now = Math.floor(Date.now() / 1000);
        const header = { alg: 'RS256', typ: 'JWT' };
        const payload = {
            iss: key.client_email,
            sub: key.client_email,
            aud: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/cloud-platform',
            iat: now,
            exp: now + 3600,
        };

        // Base64URL encode header and payload
        const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const unsignedToken = `${base64Header}.${base64Payload}`;

        // Sign with RS256 using the service account's private key
        const sign = createSign('RSA-SHA256');
        sign.update(unsignedToken);
        sign.end();
        const signature = sign.sign(key.private_key, 'base64url');

        return `${unsignedToken}.${signature}`;
    }

    /**
     * Make authenticated API request
     */
    private async apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
        const token = await this.getAccessToken();

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`GCP API error: ${response.status} - ${error}`);
        }

        return response.json();
    }

    /**
     * Validate credentials
     */
    async validateCredentials(): Promise<boolean> {
        try {
            await this.getAccessToken();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get GPU pricing
     */
    async getGPUPricing(): Promise<GPUPricing[]> {
        return pricingCalculator.getGPUPricing('gcp');
    }

    /**
     * Estimate deployment cost
     */
    async estimateCost(config: DeploymentConfig): Promise<CostEstimate> {
        return pricingCalculator.estimateCost(config);
    }

    /**
     * Deploy based on resource type
     */
    async deploy(config: DeploymentConfig): Promise<Deployment> {
        const deploymentId = uuidv4();
        const now = new Date();

        switch (config.resourceType) {
            case 'serverless':
            case 'container':
                return this.deployCloudRun(deploymentId, config, now);
            case 'vm':
            case 'gpu':
                return this.deployComputeEngine(deploymentId, config, now);
            default:
                throw new Error(`Unsupported resource type: ${config.resourceType}`);
        }
    }

    /**
     * Deploy to Cloud Run
     */
    private async deployCloudRun(
        deploymentId: string,
        config: DeploymentConfig,
        now: Date
    ): Promise<Deployment> {
        const serviceName = `kriptik-${config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
        const parent = `projects/${this.credentials.projectId}/locations/${config.region}`;

        // Create Cloud Run service
        const serviceSpec = {
            template: {
                containers: [{
                    image: config.containerImage || 'gcr.io/cloudrun/hello',
                    ports: [{ containerPort: config.port || 8080 }],
                    env: Object.entries(config.environmentVariables || {}).map(([name, value]) => ({
                        name,
                        value,
                    })),
                    resources: {
                        limits: {
                            cpu: this.mapSizeToCPU(config.instanceSize),
                            memory: this.mapSizeToMemory(config.instanceSize),
                        },
                    },
                }],
                scaling: {
                    minInstanceCount: config.scaling?.minReplicas || 0,
                    maxInstanceCount: config.scaling?.maxReplicas || 10,
                },
                timeout: `${config.timeoutSeconds || 300}s`,
            },
        };

        try {
            const response = await this.apiRequest<{ name: string; uri: string }>(
                `${CLOUD_RUN_API}/${parent}/services?serviceId=${serviceName}`,
                {
                    method: 'POST',
                    body: JSON.stringify(serviceSpec),
                }
            );

            return {
                id: deploymentId,
                projectId: '',
                userId: '',
                provider: 'gcp',
                config,
                status: 'deploying',
                providerResourceId: response.name,
                url: response.uri,
                createdAt: now,
                updatedAt: now,
            };
        } catch (error) {
            // If service exists, update it
            const response = await this.apiRequest<{ name: string; uri: string }>(
                `${CLOUD_RUN_API}/${parent}/services/${serviceName}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(serviceSpec),
                }
            );

            return {
                id: deploymentId,
                projectId: '',
                userId: '',
                provider: 'gcp',
                config,
                status: 'deploying',
                providerResourceId: response.name,
                url: response.uri,
                createdAt: now,
                updatedAt: now,
            };
        }
    }

    /**
     * Deploy to Compute Engine (for GPU workloads)
     */
    private async deployComputeEngine(
        deploymentId: string,
        config: DeploymentConfig,
        now: Date
    ): Promise<Deployment> {
        const instanceName = `kriptik-${config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${deploymentId.slice(0, 8)}`;
        const zone = `${config.region}-a`; // Default to zone 'a'

        const machineType = config.gpu
            ? this.mapGPUToMachineType(config.gpu.type)
            : this.mapSizeToMachineType(config.instanceSize);

        const instanceSpec: any = {
            name: instanceName,
            machineType: `zones/${zone}/machineTypes/${machineType}`,
            disks: [{
                boot: true,
                initializeParams: {
                    sourceImage: config.gpu
                        ? 'projects/ml-images/global/images/c0-deeplearning-common-cu121-v20231209-debian-11'
                        : 'projects/debian-cloud/global/images/family/debian-11',
                    diskSizeGb: '100',
                },
            }],
            networkInterfaces: [{
                network: 'global/networks/default',
                accessConfigs: [{ type: 'ONE_TO_ONE_NAT', name: 'External NAT' }],
            }],
            metadata: {
                items: [
                    {
                        key: 'startup-script',
                        value: `#!/bin/bash
# KripTik AI deployment
apt-get update
apt-get install -y docker.io
systemctl start docker
${config.containerImage ? `docker pull ${config.containerImage}` : ''}
${config.containerImage ? `docker run -d -p ${config.port || 80}:${config.port || 80} ${config.containerImage}` : ''}
`,
                    },
                ],
            },
            labels: {
                'kriptik-deployment-id': deploymentId,
                'managed-by': 'kriptik-ai',
            },
        };

        // Add GPU accelerator if specified
        if (config.gpu) {
            instanceSpec.guestAccelerators = [{
                acceleratorType: `zones/${zone}/acceleratorTypes/${this.mapGPUToAcceleratorType(config.gpu.type)}`,
                acceleratorCount: config.gpu.count,
            }];
            instanceSpec.scheduling = {
                onHostMaintenance: 'TERMINATE',
                automaticRestart: true,
            };
        }

        const response = await this.apiRequest<{ targetLink: string }>(
            `${COMPUTE_API}/projects/${this.credentials.projectId}/zones/${zone}/instances`,
            {
                method: 'POST',
                body: JSON.stringify(instanceSpec),
            }
        );

        return {
            id: deploymentId,
            projectId: '',
            userId: '',
            provider: 'gcp',
            config,
            status: 'deploying',
            providerResourceId: instanceName,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Get deployment
     */
    async getDeployment(deploymentId: string): Promise<Deployment | null> {
        return null;
    }

    /**
     * List deployments
     */
    async listDeployments(projectId?: string): Promise<Deployment[]> {
        const deployments: Deployment[] = [];

        // List Cloud Run services
        try {
            const regions = ['us-central1', 'us-east1', 'europe-west1'];

            for (const region of regions) {
                const parent = `projects/${this.credentials.projectId}/locations/${region}`;
                const response = await this.apiRequest<{ services: any[] }>(
                    `${CLOUD_RUN_API}/${parent}/services`
                );

                for (const service of response.services || []) {
                    if (service.name?.includes('kriptik-')) {
                        deployments.push({
                            id: service.uid,
                            projectId: projectId || '',
                            userId: '',
                            provider: 'gcp',
                            config: {
                                provider: 'gcp',
                                resourceType: 'container',
                                region,
                                name: service.name.split('/').pop(),
                            },
                            status: this.mapCloudRunStatus(service.conditions),
                            providerResourceId: service.name,
                            url: service.uri,
                            createdAt: new Date(service.createTime),
                            updatedAt: new Date(service.updateTime),
                        });
                    }
                }
            }
        } catch {
            // Ignore errors for regions without services
        }

        return deployments;
    }

    /**
     * Update deployment
     */
    async updateDeployment(deploymentId: string, config: Partial<DeploymentConfig>): Promise<Deployment> {
        throw new Error('Not implemented');
    }

    /**
     * Stop deployment
     */
    async stopDeployment(deploymentId: string): Promise<void> {
        // For Compute Engine instances
        const zones = ['us-central1-a', 'us-east1-b', 'europe-west1-b'];

        for (const zone of zones) {
            try {
                await this.apiRequest(
                    `${COMPUTE_API}/projects/${this.credentials.projectId}/zones/${zone}/instances/${deploymentId}/stop`,
                    { method: 'POST' }
                );
                return;
            } catch {
                // Try next zone
            }
        }
    }

    /**
     * Delete deployment
     */
    async deleteDeployment(deploymentId: string): Promise<void> {
        // Try Cloud Run first
        const regions = ['us-central1', 'us-east1', 'europe-west1'];

        for (const region of regions) {
            try {
                await this.apiRequest(
                    `${CLOUD_RUN_API}/projects/${this.credentials.projectId}/locations/${region}/services/${deploymentId}`,
                    { method: 'DELETE' }
                );
                return;
            } catch {
                // Try next region or resource type
            }
        }

        // Try Compute Engine
        const zones = ['us-central1-a', 'us-east1-b', 'europe-west1-b'];

        for (const zone of zones) {
            try {
                await this.apiRequest(
                    `${COMPUTE_API}/projects/${this.credentials.projectId}/zones/${zone}/instances/${deploymentId}`,
                    { method: 'DELETE' }
                );
                return;
            } catch {
                // Try next zone
            }
        }
    }

    /**
     * Get deployment logs
     */
    async getDeploymentLogs(deploymentId: string, options?: {
        since?: Date;
        limit?: number;
    }): Promise<DeploymentLog[]> {
        // Would use Cloud Logging API
        return [];
    }

    /**
     * Stream deployment logs
     */
    streamDeploymentLogs(deploymentId: string, callback: (log: DeploymentLog) => void): () => void {
        let isActive = true;

        const poll = async () => {
            while (isActive) {
                const logs = await this.getDeploymentLogs(deploymentId, { limit: 50 });
                logs.forEach(callback);
                await new Promise(r => setTimeout(r, 2000));
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
        // For Cloud Run, update the service's scaling config
        const regions = ['us-central1', 'us-east1', 'europe-west1'];

        for (const region of regions) {
            try {
                const parent = `projects/${this.credentials.projectId}/locations/${region}`;
                await this.apiRequest(
                    `${CLOUD_RUN_API}/${parent}/services/${deploymentId}`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            template: {
                                scaling: {
                                    minInstanceCount: replicas,
                                    maxInstanceCount: Math.max(replicas, 10),
                                },
                            },
                        }),
                    }
                );
                return;
            } catch {
                // Try next region
            }
        }
    }

    /**
     * Get available regions
     */
    async getAvailableRegions(): Promise<Array<{ id: string; name: string; available: boolean }>> {
        return [
            { id: 'us-central1', name: 'Iowa', available: true },
            { id: 'us-east1', name: 'South Carolina', available: true },
            { id: 'us-west1', name: 'Oregon', available: true },
            { id: 'europe-west1', name: 'Belgium', available: true },
            { id: 'europe-west2', name: 'London', available: true },
            { id: 'asia-east1', name: 'Taiwan', available: true },
            { id: 'asia-northeast1', name: 'Tokyo', available: true },
        ];
    }

    // Helper methods

    private mapSizeToCPU(size?: string): string {
        const mapping: Record<string, string> = {
            small: '1',
            medium: '2',
            large: '4',
            xlarge: '8',
        };
        return mapping[size || 'medium'] || '2';
    }

    private mapSizeToMemory(size?: string): string {
        const mapping: Record<string, string> = {
            small: '512Mi',
            medium: '1Gi',
            large: '2Gi',
            xlarge: '4Gi',
        };
        return mapping[size || 'medium'] || '1Gi';
    }

    private mapSizeToMachineType(size?: string): string {
        const mapping: Record<string, string> = {
            small: 'e2-micro',
            medium: 'e2-small',
            large: 'e2-medium',
            xlarge: 'e2-standard-2',
        };
        return mapping[size || 'medium'] || 'e2-small';
    }

    private mapGPUToMachineType(gpuType: string): string {
        const mapping: Record<string, string> = {
            'nvidia-a100-40gb': 'a2-highgpu-1g',
            'nvidia-a100-80gb': 'a2-ultragpu-1g',
            'nvidia-t4': 'n1-standard-4',
            'nvidia-v100': 'n1-standard-8',
            'nvidia-l40': 'g2-standard-4',
        };
        return mapping[gpuType] || 'n1-standard-4';
    }

    private mapGPUToAcceleratorType(gpuType: string): string {
        const mapping: Record<string, string> = {
            'nvidia-a100-40gb': 'nvidia-a100-40gb',
            'nvidia-a100-80gb': 'nvidia-a100-80gb',
            'nvidia-t4': 'nvidia-tesla-t4',
            'nvidia-v100': 'nvidia-tesla-v100',
            'nvidia-l40': 'nvidia-l4',
        };
        return mapping[gpuType] || 'nvidia-tesla-t4';
    }

    private mapCloudRunStatus(conditions: any[]): DeploymentStatus {
        const ready = conditions?.find((c: any) => c.type === 'Ready');
        if (ready?.status === 'True') return 'running';
        if (ready?.status === 'False') return 'failed';
        return 'deploying';
    }
}

/**
 * Create a GCP provider instance
 */
export function createGCPProvider(credentials: GCPCredentials): GCPProvider {
    return new GCPProvider(credentials);
}

