/**
 * Build Integration Hooks
 *
 * Wires webhook generation, integration orchestration, GPU discovery,
 * and resource metering into the build loop lifecycle.
 *
 * Hooks into specific build phases:
 * - Phase 0.5: After Intent Lock, set up integration webhooks
 * - Phase 1.5: After Dependencies, configure MCP and external services
 * - Phase 2+: During build, provision GPU resources as needed
 *
 * Integrates:
 * - WebhookGenerator: Auto-generate webhook endpoints for integrations
 * - IntegrationOrchestrator: Coordinate external service setup
 * - GPUDiscoveryService: Find available GPU resources
 * - ResourceMeteringService: Track and bill resource usage
 */

import { EventEmitter } from 'events';
import {
    generateWebhookEndpoint,
    getOrCreateWebhookEndpoint,
    type WebhookEndpoint,
} from '../webhooks/webhook-generator.js';
import {
    IntegrationOrchestrator,
    getIntegrationOrchestrator,
    type BuildIntegrationContext,
    type OrchestrationResult,
} from '../orchestration/integration-orchestrator.js';
import {
    GPUDiscoveryService,
    getGPUDiscoveryService,
    type GPUResource,
    type ResourceRecommendation,
    type WorkloadRequirements,
} from '../cloud/gpu-discovery.js';
import {
    getResourceMeteringService,
    type ResourceAllocation,
    type ApprovalRequest,
    type UsageReport,
} from '../billing/resource-metering.js';
import { getCredentialVault } from '../security/credential-vault.js';
import {
    RunPodDeployer,
    getRunPodDeployer,
    type RunPodDeployConfig,
    type RunPodDeployResult,
    type RunPodEndpointStatus,
} from '../deployment/runpod-deployer.js';
import {
    getGPUAvailability,
    recommendGPU,
    type GPUType,
    type GPUAvailabilityResponse,
} from '../compute/runpod-availability.js';

// =============================================================================
// Types
// =============================================================================

export interface BuildHookContext {
    buildId: string;
    projectId: string;
    userId: string;
    phase: string;
    requiredIntegrations: string[];
    modelRequirements?: WorkloadRequirements;
    metadata?: Record<string, unknown>;
}

export interface WebhookSetupResult {
    integrationId: string;
    endpoint: WebhookEndpoint;
    configured: boolean;
    error?: string;
}

export interface GPUProvisionResult {
    success: boolean;
    allocationId?: string;
    resource?: GPUResource;
    approvalRequired: boolean;
    approvalRequest?: ApprovalRequest;
    error?: string;
}

export interface IntegrationHookResult {
    phase: string;
    webhooksConfigured: WebhookSetupResult[];
    integrationsOrchestrated: OrchestrationResult[];
    gpuProvisioned: GPUProvisionResult | null;
    runpodDeployment: RunPodDeploymentResult | null;
    errors: string[];
    timestamp: string;
}

// RunPod Deployment Types
export interface RunPodDeploymentRequest {
    buildId: string;
    userId: string;
    projectId: string;
    modelUrl: string;
    modelType: 'llm' | 'image' | 'video' | 'audio' | 'embedding' | 'multimodal';
    modelName?: string;
    gpuType?: string;
    scalingConfig?: {
        minWorkers: number;
        maxWorkers: number;
        idleTimeout: number;
    };
    containerImage?: string;
    environmentVariables?: Record<string, string>;
}

export interface RunPodDeploymentResult {
    success: boolean;
    endpointId?: string;
    endpointUrl?: string;
    allocationId?: string;
    gpuType?: string;
    status?: string;
    inferenceCode?: {
        python: string;
        typescript: string;
        curl: string;
    };
    approvalRequired: boolean;
    approvalRequest?: ApprovalRequest;
    error?: string;
}

export interface RunPodStatusUpdate {
    buildId: string;
    endpointId: string;
    status: RunPodEndpointStatus;
    metering: {
        allocationId: string;
        totalSecondsUsed: number;
        totalCostCents: number;
    } | null;
}

// =============================================================================
// Build Integration Hooks Service
// =============================================================================

export class BuildIntegrationHooks extends EventEmitter {
    private orchestrator: IntegrationOrchestrator;
    private gpuDiscovery: GPUDiscoveryService;
    private runpodDeployer: RunPodDeployer;
    private activeDeployments: Map<string, { endpointId: string; allocationId?: string }> = new Map();

    constructor() {
        super();
        this.orchestrator = getIntegrationOrchestrator();
        this.gpuDiscovery = getGPUDiscoveryService();
        this.runpodDeployer = getRunPodDeployer();
    }

    // =========================================================================
    // Phase 0.5: Webhook Setup (After Intent Lock)
    // =========================================================================

    /**
     * Set up webhook endpoints for all required integrations
     */
    async setupWebhooks(context: BuildHookContext): Promise<WebhookSetupResult[]> {
        const results: WebhookSetupResult[] = [];

        this.emit('webhook_setup_start', { buildId: context.buildId, integrations: context.requiredIntegrations });

        for (const integrationId of context.requiredIntegrations) {
            try {
                // Create or get webhook endpoint
                const endpoint = await getOrCreateWebhookEndpoint(
                    context.projectId,
                    integrationId,
                    ['*'] // Subscribe to all events for now
                );

                results.push({
                    integrationId,
                    endpoint,
                    configured: true,
                });

                this.emit('webhook_created', {
                    buildId: context.buildId,
                    integrationId,
                    url: endpoint.url,
                });

                console.log(`[BuildIntegrationHooks] Created webhook for ${integrationId}: ${endpoint.url}`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    integrationId,
                    endpoint: null as unknown as WebhookEndpoint,
                    configured: false,
                    error: errorMsg,
                });

                console.error(`[BuildIntegrationHooks] Failed to create webhook for ${integrationId}:`, error);
            }
        }

        this.emit('webhook_setup_complete', {
            buildId: context.buildId,
            results,
            successCount: results.filter(r => r.configured).length,
            failCount: results.filter(r => !r.configured).length,
        });

        return results;
    }

    // =========================================================================
    // Phase 1.5: Integration Orchestration (After Dependencies)
    // =========================================================================

    /**
     * Orchestrate all required integrations for the build
     */
    async orchestrateIntegrations(context: BuildHookContext): Promise<OrchestrationResult[]> {
        this.emit('orchestration_start', { buildId: context.buildId });

        try {
            // Get credentials from vault
            const vault = getCredentialVault();
            const credentials: Record<string, string> = {};

            for (const integrationId of context.requiredIntegrations) {
                const cred = await vault.getCredentials(context.userId, integrationId);
                if (cred) {
                    Object.assign(credentials, cred);
                }
            }

            // Create orchestration context
            const orchContext: BuildIntegrationContext = {
                buildId: context.buildId,
                projectId: context.projectId,
                userId: context.userId,
                requiredIntegrations: context.requiredIntegrations,
                credentials,
                projectPath: `/tmp/builds/${context.buildId}`,
            };

            // Run orchestration
            const results = await this.orchestrator.orchestrateBuildIntegrations(orchContext);

            this.emit('orchestration_complete', {
                buildId: context.buildId,
                results,
                successCount: results.filter(r => r.success).length,
                failCount: results.filter(r => !r.success).length,
            });

            return results;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[BuildIntegrationHooks] Orchestration failed:`, error);

            this.emit('orchestration_error', { buildId: context.buildId, error: errorMsg });

            return [{
                integrationId: 'orchestration',
                success: false,
                actions: [],
                error: errorMsg,
            }];
        }
    }

    // =========================================================================
    // Phase 2+: GPU Resource Provisioning
    // =========================================================================

    /**
     * Discover and recommend GPU resources for the build
     */
    async discoverGPUResources(requirements: WorkloadRequirements): Promise<{
        available: GPUResource[];
        recommendations: ResourceRecommendation[];
    }> {
        this.emit('gpu_discovery_start', { requirements });

        try {
            // Get available resources
            const available = await this.gpuDiscovery.getAvailableResources();

            // Get recommendations
            const recommendations = await this.gpuDiscovery.getRecommendations(requirements);

            this.emit('gpu_discovery_complete', {
                available: available.length,
                recommendations: recommendations.length,
            });

            return { available, recommendations };
        } catch (error) {
            console.error('[BuildIntegrationHooks] GPU discovery failed:', error);
            return { available: [], recommendations: [] };
        }
    }

    /**
     * Request GPU resource allocation (requires approval)
     */
    async requestGPUAllocation(
        context: BuildHookContext,
        recommendation: ResourceRecommendation
    ): Promise<GPUProvisionResult> {
        const metering = getResourceMeteringService();

        try {
            // Create allocation request
            const approvalRequest = await metering.createAllocation({
                buildId: context.buildId,
                userId: context.userId,
                resourceType: 'gpu',
                provider: recommendation.resource.provider as 'runpod' | 'aws' | 'gcp' | 'azure' | 'lambda-labs',
                resourceId: recommendation.resource.id,
                resourceName: `${recommendation.resource.gpuType} (${recommendation.resource.provider})`,
                pricePerHour: recommendation.resource.pricePerHour,
                estimatedDurationMinutes: recommendation.estimatedDurationMinutes,
                operationType: context.modelRequirements?.operationType || 'training',
                isUserInitiated: true,
                metadata: {
                    vram: recommendation.resource.vramGb,
                    region: recommendation.resource.region,
                    matchScore: recommendation.matchScore,
                    buildId: context.buildId,
                },
            });

            this.emit('gpu_allocation_requested', {
                buildId: context.buildId,
                allocationId: approvalRequest.allocationId,
                resource: recommendation.resource,
                estimatedCost: approvalRequest.estimatedCostCents,
            });

            return {
                success: true,
                allocationId: approvalRequest.allocationId,
                resource: recommendation.resource,
                approvalRequired: approvalRequest.userPaymentRequired,
                approvalRequest,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[BuildIntegrationHooks] GPU allocation request failed:', error);

            return {
                success: false,
                approvalRequired: false,
                error: errorMsg,
            };
        }
    }

    /**
     * Start metering after allocation is approved
     */
    async startGPUMetering(allocationId: string): Promise<{ success: boolean; error?: string }> {
        const metering = getResourceMeteringService();
        return metering.startMetering(allocationId);
    }

    /**
     * Stop metering and finalize billing
     */
    async stopGPUMetering(allocationId: string): Promise<UsageReport | null> {
        const metering = getResourceMeteringService();
        return metering.stopMetering(allocationId);
    }

    // =========================================================================
    // Phase 3+: RunPod Model Deployment
    // =========================================================================

    /**
     * Initialize RunPod deployer with user's API key
     */
    async initializeRunPodDeployer(userId: string): Promise<boolean> {
        try {
            const vault = getCredentialVault();
            const credentials = await vault.getCredentials(userId, 'runpod');

            if (credentials?.apiKey) {
                this.runpodDeployer.initialize(credentials.apiKey);
                return true;
            }

            // Fall back to environment variable
            const envKey = process.env.RUNPOD_API_KEY;
            if (envKey) {
                this.runpodDeployer.initialize(envKey);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[BuildIntegrationHooks] Failed to initialize RunPod:', error);
            return false;
        }
    }

    /**
     * Get real-time RunPod GPU availability
     */
    async getRunPodAvailability(userId?: string): Promise<GPUAvailabilityResponse> {
        return getGPUAvailability(userId);
    }

    /**
     * Get recommended GPU for model requirements
     */
    getRecommendedRunPodGPU(requiredVRAM: number, preferSpeed: boolean = true): GPUType | null {
        return recommendGPU(requiredVRAM, preferSpeed);
    }

    /**
     * Deploy a model to RunPod with metering integration
     */
    async deployToRunPod(request: RunPodDeploymentRequest): Promise<RunPodDeploymentResult> {
        this.emit('runpod_deployment_start', {
            buildId: request.buildId,
            modelUrl: request.modelUrl,
            modelType: request.modelType,
        });

        try {
            // Initialize deployer with user's credentials
            const initialized = await this.initializeRunPodDeployer(request.userId);
            if (!initialized) {
                return {
                    success: false,
                    approvalRequired: false,
                    error: 'RunPod API key not configured. Please add your RunPod API key in Integrations.',
                };
            }

            // Get GPU availability and recommendation
            const availability = await this.getRunPodAvailability(request.userId);
            const requiredVRAM = this.estimateVRAMRequirement(request.modelType);
            const recommendedGPU = request.gpuType
                ? availability.gpus.find(g => g.name === request.gpuType || g.id === request.gpuType)
                : recommendGPU(requiredVRAM, true);

            if (!recommendedGPU) {
                return {
                    success: false,
                    approvalRequired: false,
                    error: 'No suitable GPU available. Please try again later.',
                };
            }

            // Check if the GPU is available
            if (!recommendedGPU.available) {
                return {
                    success: false,
                    approvalRequired: false,
                    error: `${recommendedGPU.displayName} is currently unavailable. Please select a different GPU type.`,
                };
            }

            // Create resource allocation for metering
            const metering = getResourceMeteringService();
            const estimatedDurationMinutes = this.estimateDeploymentDuration(request.modelType);

            const approvalRequest = await metering.createAllocation({
                buildId: request.buildId,
                userId: request.userId,
                resourceType: 'gpu',
                provider: 'runpod',
                resourceId: recommendedGPU.id,
                resourceName: `RunPod ${recommendedGPU.displayName}`,
                pricePerHour: recommendedGPU.pricePerHour,
                estimatedDurationMinutes,
                operationType: 'deployment',
                isUserInitiated: true,
                metadata: {
                    modelUrl: request.modelUrl,
                    modelType: request.modelType,
                    modelName: request.modelName,
                    vram: recommendedGPU.vram,
                },
            });

            // If user payment required, return for approval
            if (approvalRequest.userPaymentRequired) {
                this.emit('runpod_deployment_pending_approval', {
                    buildId: request.buildId,
                    allocationId: approvalRequest.allocationId,
                    estimatedCostCents: approvalRequest.estimatedCostCents,
                    gpu: recommendedGPU,
                });

                return {
                    success: true,
                    allocationId: approvalRequest.allocationId,
                    gpuType: recommendedGPU.name,
                    approvalRequired: true,
                    approvalRequest,
                };
            }

            // Auto-approve if within KripTik budget
            await metering.approveAllocation(approvalRequest.allocationId, request.userId);

            // Deploy to RunPod
            const deployResult = await this.executeRunPodDeployment(request, recommendedGPU, approvalRequest.allocationId);
            return deployResult;

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[BuildIntegrationHooks] RunPod deployment failed:', error);

            this.emit('runpod_deployment_error', {
                buildId: request.buildId,
                error: errorMsg,
            });

            return {
                success: false,
                approvalRequired: false,
                error: errorMsg,
            };
        }
    }

    /**
     * Execute the actual RunPod deployment after approval
     */
    async executeRunPodDeployment(
        request: RunPodDeploymentRequest,
        gpu: GPUType,
        allocationId: string
    ): Promise<RunPodDeploymentResult> {
        const metering = getResourceMeteringService();

        try {
            // Start metering
            await metering.startMetering(allocationId);

            // Deploy the model
            const deployConfig: RunPodDeployConfig = {
                userId: request.userId,
                modelUrl: request.modelUrl,
                modelType: request.modelType,
                gpuType: gpu.name,
                modelName: request.modelName,
                scalingConfig: request.scalingConfig || {
                    minWorkers: 0,
                    maxWorkers: 3,
                    idleTimeout: 300,
                },
                containerImage: request.containerImage,
                environmentVariables: request.environmentVariables,
            };

            const result = await this.runpodDeployer.deployModel(deployConfig);

            // Track the deployment
            this.activeDeployments.set(request.buildId, {
                endpointId: result.endpointId,
                allocationId,
            });

            // Generate inference code
            const inferenceCode = this.runpodDeployer.generateInferenceCode(
                result.endpointId,
                request.modelType
            );

            this.emit('runpod_deployment_complete', {
                buildId: request.buildId,
                endpointId: result.endpointId,
                endpointUrl: result.endpointUrl,
                gpuType: gpu.name,
                allocationId,
            });

            console.log(`[BuildIntegrationHooks] RunPod deployment successful: ${result.endpointId}`);

            return {
                success: true,
                endpointId: result.endpointId,
                endpointUrl: result.endpointUrl,
                allocationId,
                gpuType: gpu.name,
                status: result.status,
                inferenceCode,
                approvalRequired: false,
            };

        } catch (error) {
            // Stop metering on failure
            await metering.stopMetering(allocationId);

            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[BuildIntegrationHooks] RunPod deployment execution failed:', error);

            return {
                success: false,
                allocationId,
                approvalRequired: false,
                error: errorMsg,
            };
        }
    }

    /**
     * Complete a pending RunPod deployment after user approval
     */
    async completeRunPodDeploymentAfterApproval(
        buildId: string,
        allocationId: string,
        request: RunPodDeploymentRequest
    ): Promise<RunPodDeploymentResult> {
        const metering = getResourceMeteringService();

        // Get the allocation to verify and get GPU info
        const allocations = metering.getAllocationsForBuild(buildId);
        const allocation = allocations.find(a => a.id === allocationId);

        if (!allocation) {
            return {
                success: false,
                approvalRequired: false,
                error: 'Allocation not found',
            };
        }

        if (allocation.status !== 'approved') {
            return {
                success: false,
                approvalRequired: false,
                error: `Allocation status is ${allocation.status}, expected approved`,
            };
        }

        // Get GPU info
        const availability = await this.getRunPodAvailability(request.userId);
        const gpu = availability.gpus.find(g => g.id === allocation.resourceId);

        if (!gpu) {
            return {
                success: false,
                approvalRequired: false,
                error: 'GPU no longer available',
            };
        }

        return this.executeRunPodDeployment(request, gpu, allocationId);
    }

    /**
     * Get status of a RunPod deployment
     */
    async getRunPodDeploymentStatus(buildId: string): Promise<RunPodStatusUpdate | null> {
        const deployment = this.activeDeployments.get(buildId);
        if (!deployment) {
            return null;
        }

        try {
            const status = await this.runpodDeployer.getEndpointStatus(deployment.endpointId);

            let metering = null;
            if (deployment.allocationId) {
                const meteringService = getResourceMeteringService();
                const allocation = meteringService.getAllocationsForBuild(buildId)
                    .find(a => a.id === deployment.allocationId);

                if (allocation) {
                    metering = {
                        allocationId: allocation.id,
                        totalSecondsUsed: allocation.totalSecondsUsed,
                        totalCostCents: allocation.totalCostCents,
                    };
                }
            }

            return {
                buildId,
                endpointId: deployment.endpointId,
                status,
                metering,
            };
        } catch (error) {
            console.error('[BuildIntegrationHooks] Failed to get deployment status:', error);
            return null;
        }
    }

    /**
     * Terminate a RunPod deployment
     */
    async terminateRunPodDeployment(buildId: string): Promise<{ success: boolean; error?: string }> {
        const deployment = this.activeDeployments.get(buildId);
        if (!deployment) {
            return { success: false, error: 'No deployment found for this build' };
        }

        try {
            // Stop metering first
            if (deployment.allocationId) {
                await this.stopGPUMetering(deployment.allocationId);
            }

            // Delete the endpoint
            await this.runpodDeployer.deleteEndpoint(deployment.endpointId);

            // Clean up tracking
            this.activeDeployments.delete(buildId);

            this.emit('runpod_deployment_terminated', {
                buildId,
                endpointId: deployment.endpointId,
            });

            console.log(`[BuildIntegrationHooks] RunPod deployment terminated: ${deployment.endpointId}`);

            return { success: true };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[BuildIntegrationHooks] Failed to terminate deployment:', error);
            return { success: false, error: errorMsg };
        }
    }

    /**
     * Update scaling configuration for a RunPod deployment
     */
    async updateRunPodScaling(
        buildId: string,
        minWorkers: number,
        maxWorkers: number
    ): Promise<{ success: boolean; error?: string }> {
        const deployment = this.activeDeployments.get(buildId);
        if (!deployment) {
            return { success: false, error: 'No deployment found for this build' };
        }

        try {
            await this.runpodDeployer.updateScaling(deployment.endpointId, minWorkers, maxWorkers);

            this.emit('runpod_scaling_updated', {
                buildId,
                endpointId: deployment.endpointId,
                minWorkers,
                maxWorkers,
            });

            return { success: true };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMsg };
        }
    }

    /**
     * Estimate VRAM requirement based on model type
     */
    private estimateVRAMRequirement(modelType: string): number {
        const vramEstimates: Record<string, number> = {
            'llm': 24,           // Most LLMs need at least 24GB
            'image': 12,         // Stable Diffusion / image models
            'video': 24,         // Video generation needs more VRAM
            'audio': 8,          // Audio models are smaller
            'embedding': 4,      // Embedding models are compact
            'multimodal': 40,    // Multimodal needs more for vision+text
        };
        return vramEstimates[modelType] || 16;
    }

    /**
     * Estimate deployment duration based on model type
     */
    private estimateDeploymentDuration(modelType: string): number {
        const durationEstimates: Record<string, number> = {
            'llm': 60,           // LLMs may run for hours
            'image': 30,         // Image generation sessions
            'video': 120,        // Video generation takes longer
            'audio': 15,         // Audio processing is quick
            'embedding': 30,     // Embedding inference
            'multimodal': 60,    // Similar to LLM
        };
        return durationEstimates[modelType] || 30;
    }

    // =========================================================================
    // Full Phase Hook Execution
    // =========================================================================

    /**
     * Execute all hooks for a specific phase
     */
    async executePhaseHooks(context: BuildHookContext): Promise<IntegrationHookResult> {
        const result: IntegrationHookResult = {
            phase: context.phase,
            webhooksConfigured: [],
            integrationsOrchestrated: [],
            gpuProvisioned: null,
            runpodDeployment: null,
            errors: [],
            timestamp: new Date().toISOString(),
        };

        try {
            switch (context.phase) {
                case 'post_intent_lock':
                case 'phase_0.5':
                    // Set up webhooks for all required integrations
                    result.webhooksConfigured = await this.setupWebhooks(context);
                    break;

                case 'post_dependencies':
                case 'phase_1.5':
                    // Orchestrate integrations (MCP, env vars, etc.)
                    result.integrationsOrchestrated = await this.orchestrateIntegrations(context);
                    break;

                case 'gpu_required':
                case 'phase_2_gpu':
                    // Discover and provision GPU resources
                    if (context.modelRequirements) {
                        const { recommendations } = await this.discoverGPUResources(context.modelRequirements);

                        if (recommendations.length > 0) {
                            result.gpuProvisioned = await this.requestGPUAllocation(
                                context,
                                recommendations[0]
                            );
                        }
                    }
                    break;

                case 'model_deployment':
                case 'phase_3_deploy':
                    // Deploy model to RunPod
                    if (context.metadata?.modelUrl && context.metadata?.modelType) {
                        result.runpodDeployment = await this.deployToRunPod({
                            buildId: context.buildId,
                            userId: context.userId,
                            projectId: context.projectId,
                            modelUrl: context.metadata.modelUrl as string,
                            modelType: context.metadata.modelType as 'llm' | 'image' | 'video' | 'audio' | 'embedding' | 'multimodal',
                            modelName: context.metadata.modelName as string | undefined,
                            gpuType: context.metadata.gpuType as string | undefined,
                            scalingConfig: context.metadata.scalingConfig as RunPodDeploymentRequest['scalingConfig'] | undefined,
                        });
                    }
                    break;

                default:
                    console.log(`[BuildIntegrationHooks] No hooks for phase: ${context.phase}`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(errorMsg);
            console.error(`[BuildIntegrationHooks] Phase ${context.phase} hooks failed:`, error);
        }

        this.emit('phase_hooks_complete', result);

        return result;
    }

    // =========================================================================
    // Build Lifecycle Integration
    // =========================================================================

    /**
     * Wire hooks into build loop events
     * Call this to set up event listeners on the build loop
     */
    wireIntoBuildLoop(buildLoop: EventEmitter, buildId: string, projectId: string, userId: string): void {
        // Listen for phase transitions
        buildLoop.on('phase_complete', async (data: { phase: string; requiredIntegrations?: string[] }) => {
            const context: BuildHookContext = {
                buildId,
                projectId,
                userId,
                phase: `post_${data.phase}`,
                requiredIntegrations: data.requiredIntegrations || [],
            };

            // Execute phase-specific hooks
            if (data.phase === 'intent_lock') {
                await this.executePhaseHooks({ ...context, phase: 'post_intent_lock' });
            } else if (data.phase === 'dependencies') {
                await this.executePhaseHooks({ ...context, phase: 'post_dependencies' });
            }
        });

        // Listen for GPU requirement events
        buildLoop.on('gpu_required', async (data: { requirements: WorkloadRequirements }) => {
            const context: BuildHookContext = {
                buildId,
                projectId,
                userId,
                phase: 'gpu_required',
                requiredIntegrations: [],
                modelRequirements: data.requirements,
            };

            await this.executePhaseHooks(context);
        });

        // Listen for model deployment events
        buildLoop.on('deploy_model', async (data: {
            modelUrl: string;
            modelType: string;
            modelName?: string;
            gpuType?: string;
            scalingConfig?: RunPodDeploymentRequest['scalingConfig'];
        }) => {
            const context: BuildHookContext = {
                buildId,
                projectId,
                userId,
                phase: 'model_deployment',
                requiredIntegrations: [],
                metadata: {
                    modelUrl: data.modelUrl,
                    modelType: data.modelType,
                    modelName: data.modelName,
                    gpuType: data.gpuType,
                    scalingConfig: data.scalingConfig,
                },
            };

            await this.executePhaseHooks(context);
        });

        // Listen for build completion to finalize metering and terminate deployments
        buildLoop.on('build_complete', async () => {
            const metering = getResourceMeteringService();
            const activeAllocations = metering.getAllocationsForBuild(buildId);

            for (const allocation of activeAllocations) {
                if (allocation.status === 'active') {
                    await this.stopGPUMetering(allocation.id);
                }
            }
        });

        console.log(`[BuildIntegrationHooks] Wired into build loop for ${buildId}`);
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

let integrationHooksInstance: BuildIntegrationHooks | null = null;

export function getBuildIntegrationHooks(): BuildIntegrationHooks {
    if (!integrationHooksInstance) {
        integrationHooksInstance = new BuildIntegrationHooks();
    }
    return integrationHooksInstance;
}

export default BuildIntegrationHooks;
