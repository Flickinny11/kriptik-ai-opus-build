/**
 * Cloud Provider Types - Unified interface for all cloud providers
 *
 * Supports: RunPod, AWS, Google Cloud
 */

// Resource Types
export type ResourceType =
    | 'serverless'      // Lambda, Cloud Run, RunPod Serverless
    | 'container'       // ECS, GKE, RunPod Pods
    | 'vm'              // EC2, Compute Engine
    | 'gpu'             // GPU instances
    | 'storage'         // S3, GCS, RunPod volumes
    | 'database';       // RDS, Cloud SQL

export type CloudProvider = 'runpod' | 'aws' | 'gcp';

export type GPUType =
    | 'nvidia-a100-80gb'
    | 'nvidia-a100-40gb'
    | 'nvidia-h100'
    | 'nvidia-a40'
    | 'nvidia-l40'
    | 'nvidia-rtx-4090'
    | 'nvidia-rtx-3090'
    | 'nvidia-t4'
    | 'nvidia-v100';

export type InstanceSize = 'small' | 'medium' | 'large' | 'xlarge' | 'custom';

// Pricing
export interface PricingTier {
    hourlyRate: number;
    monthlyRate: number;
    currency: 'USD';
}

export interface GPUPricing {
    gpu: GPUType;
    provider: CloudProvider;
    hourlyRate: number;
    spotRate?: number;
    memoryGB: number;
    available: boolean;
}

export interface ResourcePricing {
    resourceType: ResourceType;
    provider: CloudProvider;
    size: InstanceSize;
    gpu?: GPUType;
    pricing: PricingTier;
    specs: {
        vcpu?: number;
        memoryGB?: number;
        storageGB?: number;
        gpuCount?: number;
        gpuMemoryGB?: number;
    };
}

// Deployment Configuration
export interface DeploymentConfig {
    provider: CloudProvider;
    resourceType: ResourceType;
    region: string;
    name: string;

    // Context (for database storage)
    projectId?: string;
    userId?: string;

    // Container/Serverless settings
    containerImage?: string;
    dockerfile?: string;

    // Compute settings
    instanceSize?: InstanceSize;
    gpu?: {
        type: GPUType;
        count: number;
    };

    // Scaling
    scaling?: {
        minReplicas: number;
        maxReplicas: number;
        targetCPUUtilization?: number;
        targetGPUUtilization?: number;
    };

    // Environment
    environmentVariables?: Record<string, string>;
    secrets?: string[];

    // Networking
    port?: number;
    healthCheckPath?: string;
    customDomain?: string;

    // Storage
    volumes?: Array<{
        name: string;
        sizeGB: number;
        mountPath: string;
    }>;

    // Timeout & Limits
    timeoutSeconds?: number;
    memoryMB?: number;

    // Model-specific (for AI workloads)
    model?: {
        huggingFaceId?: string;
        comfyUIWorkflow?: string;
        quantization?: 'fp32' | 'fp16' | 'bf16' | 'int8' | 'int4' | 'awq' | 'gptq' | 'gguf';
    };
}

// Deployment Status
export type DeploymentStatus =
    | 'pending'
    | 'building'
    | 'deploying'
    | 'running'
    | 'scaling'
    | 'updating'
    | 'stopping'
    | 'stopped'
    | 'failed'
    | 'terminated';

export interface Deployment {
    id: string;
    projectId: string;
    userId: string;
    provider: CloudProvider;
    config: DeploymentConfig;
    status: DeploymentStatus;

    // URLs
    url?: string;
    internalUrl?: string;

    // Provider-specific IDs
    providerResourceId?: string;

    // Metrics
    metrics?: {
        requestsPerMinute?: number;
        averageLatencyMs?: number;
        errorRate?: number;
        gpuUtilization?: number;
        memoryUsagePercent?: number;
    };

    // Cost tracking
    costToDate?: number;
    estimatedMonthlyCost?: number;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    stoppedAt?: Date;

    // Logs
    logs?: DeploymentLog[];
}

export interface DeploymentLog {
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    message: string;
    source?: string;
}

// Cost Estimation
export interface CostEstimate {
    provider: CloudProvider;
    resourceType: ResourceType;

    // Base costs
    computeCostPerHour: number;
    gpuCostPerHour?: number;
    storageCostPerMonth?: number;
    networkEgressCostPerGB?: number;

    // Projected costs
    estimatedHourlyCost: number;
    estimatedDailyCost: number;
    estimatedMonthlyCost: number;

    // Breakdown
    breakdown: Array<{
        item: string;
        amount: number;
        unit: 'hour' | 'month' | 'GB' | 'request';
    }>;

    // Comparison
    cheapestAlternative?: {
        provider: CloudProvider;
        estimatedMonthlyCost: number;
        savings: number;
    };
}

// Provider Interface
export interface CloudProviderInterface {
    provider: CloudProvider;

    // Authentication
    validateCredentials(): Promise<boolean>;

    // Pricing
    getGPUPricing(): Promise<GPUPricing[]>;
    estimateCost(config: DeploymentConfig): Promise<CostEstimate>;

    // Deployments
    deploy(config: DeploymentConfig): Promise<Deployment>;
    getDeployment(deploymentId: string): Promise<Deployment | null>;
    listDeployments(projectId?: string): Promise<Deployment[]>;
    updateDeployment(deploymentId: string, config: Partial<DeploymentConfig>): Promise<Deployment>;
    stopDeployment(deploymentId: string): Promise<void>;
    deleteDeployment(deploymentId: string): Promise<void>;

    // Logs
    getDeploymentLogs(deploymentId: string, options?: {
        since?: Date;
        limit?: number;
    }): Promise<DeploymentLog[]>;
    streamDeploymentLogs(deploymentId: string, callback: (log: DeploymentLog) => void): () => void;

    // Scaling
    scaleDeployment(deploymentId: string, replicas: number): Promise<void>;

    // Container Registry
    pushImage?(imageTag: string, dockerfile: string, context: string): Promise<string>;

    // Regions
    getAvailableRegions(): Promise<Array<{ id: string; name: string; available: boolean }>>;
}

// Provider Credentials
export interface RunPodCredentials {
    apiKey: string;
}

export interface AWSCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken?: string;
}

export interface GCPCredentials {
    projectId: string;
    serviceAccountKey?: string; // JSON string
    useADC?: boolean; // Application Default Credentials
}

export type ProviderCredentials =
    | { provider: 'runpod'; credentials: RunPodCredentials }
    | { provider: 'aws'; credentials: AWSCredentials }
    | { provider: 'gcp'; credentials: GCPCredentials };

// Serverless types for specialized providers
export interface ServerlessConfig {
    name: string;
    model?: string;
    runtime?: string;
    memory?: number;
    timeout?: number;
    environmentVariables?: Record<string, string>;
}

export interface ServerlessDeployment {
    id: string;
    name: string;
    status: DeploymentStatus;
    endpoint?: string;
    createdAt: Date;
    updatedAt: Date;
}

