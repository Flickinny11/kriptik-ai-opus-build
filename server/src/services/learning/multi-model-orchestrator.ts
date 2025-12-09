/**
 * Multi-Model Orchestrator
 *
 * Enables users to run multiple models simultaneously in a single project.
 * This allows combining the strengths of different models:
 *
 * - One model for code style preferences
 * - Another for design aesthetics
 * - A third for architecture decisions
 *
 * Features:
 * - Model composition and routing
 * - Conflict resolution between model outputs
 * - Weighted blending of model suggestions
 * - Specialized model delegation
 * - User's own model learning from all active models
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { UserModel, getUserModelManager } from './user-model-manager.js';
import { getServerlessInferenceService, InferenceRequest, InferenceResponse } from './serverless-inference.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectModelConfig {
    projectId: string;
    userId: string;

    // Active models
    models: ModelSlot[];

    // User's own learning model (if enabled)
    learningModelId?: string;
    learningEnabled: boolean;

    // Routing configuration
    routingStrategy: 'round-robin' | 'capability-based' | 'weighted' | 'consensus';

    // Conflict resolution
    conflictResolution: 'primary-wins' | 'highest-confidence' | 'blend' | 'user-choose';

    // Performance settings
    parallelExecution: boolean;
    maxConcurrentModels: number;
    timeout: number;

    createdAt: Date;
    updatedAt: Date;
}

export interface ModelSlot {
    id: string;
    modelId: string;
    role: 'primary' | 'secondary' | 'specialized';
    specialization?: ModelSpecialization;
    weight: number;  // 0-1, higher = more influence
    enabled: boolean;
    capabilities: string[];

    // Performance metrics for this slot
    metrics: {
        requestsHandled: number;
        avgLatencyMs: number;
        successRate: number;
        userSatisfaction: number;
    };
}

export type ModelSpecialization =
    | 'code-generation'
    | 'code-completion'
    | 'code-review'
    | 'design-ui'
    | 'design-ux'
    | 'architecture'
    | 'testing'
    | 'documentation'
    | 'debugging'
    | 'optimization'
    | 'security';

export interface MultiModelRequest {
    id: string;
    projectId: string;
    userId: string;
    type: ModelSpecialization | 'general';
    prompt: string;
    context?: {
        currentFile?: string;
        selectedCode?: string;
        recentFiles?: string[];
        projectType?: string;
    };
    options?: {
        preferredModels?: string[];
        excludeModels?: string[];
        forceParallel?: boolean;
        maxResponses?: number;
    };
}

export interface MultiModelResponse {
    id: string;
    requestId: string;
    responses: ModelResponseWithMeta[];
    finalResponse: string;
    strategy: ProjectModelConfig['routingStrategy'];
    models used: string[];
    processingTimeMs: number;
    learningCapture?: {
        capturedForTraining: boolean;
        modelId?: string;
    };
}

export interface ModelResponseWithMeta {
    modelId: string;
    modelName: string;
    role: ModelSlot['role'];
    content: string;
    confidence: number;  // 0-1
    latencyMs: number;
    tokens: number;
    specialization?: ModelSpecialization;
}

// =============================================================================
// MULTI-MODEL ORCHESTRATOR SERVICE
// =============================================================================

export class MultiModelOrchestrator extends EventEmitter {
    private projectConfigs: Map<string, ProjectModelConfig> = new Map();
    private activeRequests: Map<string, MultiModelRequest> = new Map();

    constructor() {
        super();
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /**
     * Configure models for a project
     */
    async configureProject(input: {
        projectId: string;
        userId: string;
        models?: Partial<ModelSlot>[];
        learningModelId?: string;
        learningEnabled?: boolean;
        routingStrategy?: ProjectModelConfig['routingStrategy'];
        conflictResolution?: ProjectModelConfig['conflictResolution'];
    }): Promise<ProjectModelConfig> {
        const existing = this.projectConfigs.get(input.projectId);

        const config: ProjectModelConfig = {
            projectId: input.projectId,
            userId: input.userId,
            models: existing?.models || [],
            learningModelId: input.learningModelId ?? existing?.learningModelId,
            learningEnabled: input.learningEnabled ?? existing?.learningEnabled ?? true,
            routingStrategy: input.routingStrategy ?? existing?.routingStrategy ?? 'capability-based',
            conflictResolution: input.conflictResolution ?? existing?.conflictResolution ?? 'highest-confidence',
            parallelExecution: true,
            maxConcurrentModels: 3,
            timeout: 30000,
            createdAt: existing?.createdAt ?? new Date(),
            updatedAt: new Date(),
        };

        // Add new models
        if (input.models) {
            for (const modelInput of input.models) {
                if (modelInput.modelId) {
                    await this.addModelToProject(input.projectId, modelInput);
                }
            }
        }

        this.projectConfigs.set(input.projectId, config);
        this.emit('project_configured', { projectId: input.projectId });

        return config;
    }

    /**
     * Add a model to a project
     */
    async addModelToProject(
        projectId: string,
        model: Partial<ModelSlot>
    ): Promise<ModelSlot> {
        const config = this.projectConfigs.get(projectId);
        if (!config) {
            throw new Error(`Project ${projectId} not configured. Call configureProject first.`);
        }

        // Check if model already added
        const existingIndex = config.models.findIndex(m => m.modelId === model.modelId);
        if (existingIndex >= 0) {
            // Update existing
            Object.assign(config.models[existingIndex], model);
            return config.models[existingIndex];
        }

        // Determine role based on existing models
        let role: ModelSlot['role'] = 'secondary';
        if (config.models.length === 0 || model.role === 'primary') {
            // Demote existing primary
            const existingPrimary = config.models.find(m => m.role === 'primary');
            if (existingPrimary && model.role === 'primary') {
                existingPrimary.role = 'secondary';
            }
            role = 'primary';
        } else if (model.specialization) {
            role = 'specialized';
        }

        const slot: ModelSlot = {
            id: `slot-${uuidv4().slice(0, 8)}`,
            modelId: model.modelId!,
            role,
            specialization: model.specialization,
            weight: model.weight ?? (role === 'primary' ? 1.0 : 0.5),
            enabled: model.enabled ?? true,
            capabilities: model.capabilities ?? [],
            metrics: {
                requestsHandled: 0,
                avgLatencyMs: 0,
                successRate: 100,
                userSatisfaction: 0,
            },
        };

        config.models.push(slot);
        config.updatedAt = new Date();

        this.emit('model_added_to_project', { projectId, slotId: slot.id, modelId: slot.modelId });
        return slot;
    }

    /**
     * Remove a model from a project
     */
    async removeModelFromProject(projectId: string, modelId: string): Promise<void> {
        const config = this.projectConfigs.get(projectId);
        if (!config) return;

        const index = config.models.findIndex(m => m.modelId === modelId);
        if (index >= 0) {
            const removed = config.models.splice(index, 1)[0];

            // If we removed primary, promote first secondary
            if (removed.role === 'primary' && config.models.length > 0) {
                const newPrimary = config.models.find(m => m.role === 'secondary');
                if (newPrimary) {
                    newPrimary.role = 'primary';
                    newPrimary.weight = 1.0;
                }
            }

            config.updatedAt = new Date();
            this.emit('model_removed_from_project', { projectId, modelId });
        }
    }

    /**
     * Update model weight
     */
    async updateModelWeight(projectId: string, modelId: string, weight: number): Promise<void> {
        const config = this.projectConfigs.get(projectId);
        if (!config) throw new Error(`Project ${projectId} not found`);

        const slot = config.models.find(m => m.modelId === modelId);
        if (!slot) throw new Error(`Model ${modelId} not in project`);

        slot.weight = Math.max(0, Math.min(1, weight));
        config.updatedAt = new Date();
    }

    /**
     * Toggle model enabled/disabled
     */
    async toggleModel(projectId: string, modelId: string, enabled: boolean): Promise<void> {
        const config = this.projectConfigs.get(projectId);
        if (!config) throw new Error(`Project ${projectId} not found`);

        const slot = config.models.find(m => m.modelId === modelId);
        if (!slot) throw new Error(`Model ${modelId} not in project`);

        slot.enabled = enabled;
        config.updatedAt = new Date();
    }

    // =========================================================================
    // INFERENCE
    // =========================================================================

    /**
     * Process a request through multiple models
     */
    async processRequest(request: MultiModelRequest): Promise<MultiModelResponse> {
        const startTime = Date.now();
        const config = this.projectConfigs.get(request.projectId);

        if (!config) {
            throw new Error(`Project ${request.projectId} not configured`);
        }

        this.activeRequests.set(request.id, request);

        try {
            // Select models based on request type
            const selectedModels = this.selectModels(config, request);

            if (selectedModels.length === 0) {
                throw new Error('No models available for this request');
            }

            // Execute inference on selected models
            let responses: ModelResponseWithMeta[];

            if (config.parallelExecution && selectedModels.length > 1) {
                responses = await this.executeParallel(selectedModels, request, config.timeout);
            } else {
                responses = await this.executeSequential(selectedModels, request, config.timeout);
            }

            // Resolve to final response
            const finalResponse = await this.resolveResponses(responses, config);

            // Capture for learning if enabled
            let learningCapture: MultiModelResponse['learningCapture'];
            if (config.learningEnabled && config.learningModelId) {
                learningCapture = await this.captureForLearning(
                    config.learningModelId,
                    request,
                    responses,
                    finalResponse
                );
            }

            // Update model metrics
            for (const response of responses) {
                const slot = config.models.find(m => m.modelId === response.modelId);
                if (slot) {
                    slot.metrics.requestsHandled++;
                    slot.metrics.avgLatencyMs =
                        (slot.metrics.avgLatencyMs * (slot.metrics.requestsHandled - 1) + response.latencyMs) /
                        slot.metrics.requestsHandled;
                }
            }

            const result: MultiModelResponse = {
                id: uuidv4(),
                requestId: request.id,
                responses,
                finalResponse,
                strategy: config.routingStrategy,
                'models used': selectedModels.map(m => m.modelId),
                processingTimeMs: Date.now() - startTime,
                learningCapture,
            };

            this.emit('request_completed', result);
            return result;

        } finally {
            this.activeRequests.delete(request.id);
        }
    }

    /**
     * Select models for a request based on routing strategy
     */
    private selectModels(config: ProjectModelConfig, request: MultiModelRequest): ModelSlot[] {
        let candidates = config.models.filter(m => m.enabled);

        // Apply filters from request options
        if (request.options?.preferredModels?.length) {
            candidates = candidates.filter(m =>
                request.options!.preferredModels!.includes(m.modelId)
            );
        }

        if (request.options?.excludeModels?.length) {
            candidates = candidates.filter(m =>
                !request.options!.excludeModels!.includes(m.modelId)
            );
        }

        // Route based on strategy
        switch (config.routingStrategy) {
            case 'capability-based':
                return this.selectByCapability(candidates, request.type);

            case 'weighted':
                return this.selectByWeight(candidates);

            case 'consensus':
                // Use all available models for consensus
                return candidates.slice(0, config.maxConcurrentModels);

            case 'round-robin':
            default:
                // Just use primary, or first available
                const primary = candidates.find(m => m.role === 'primary');
                return primary ? [primary] : [candidates[0]].filter(Boolean);
        }
    }

    /**
     * Select models by capability match
     */
    private selectByCapability(slots: ModelSlot[], type: ModelSpecialization | 'general'): ModelSlot[] {
        if (type === 'general') {
            // Use primary + any high-weight secondaries
            const primary = slots.find(s => s.role === 'primary');
            const highWeight = slots.filter(s => s.weight >= 0.7 && s.role !== 'primary');
            return [primary, ...highWeight.slice(0, 2)].filter((s): s is ModelSlot => !!s);
        }

        // Find specialized model for this type
        const specialized = slots.filter(s => s.specialization === type);
        if (specialized.length > 0) {
            return specialized;
        }

        // Fall back to primary
        const primary = slots.find(s => s.role === 'primary');
        return primary ? [primary] : [slots[0]].filter(Boolean);
    }

    /**
     * Select models by weight
     */
    private selectByWeight(slots: ModelSlot[]): ModelSlot[] {
        // Sort by weight descending
        const sorted = [...slots].sort((a, b) => b.weight - a.weight);

        // Take top models up to max
        return sorted.slice(0, 3);
    }

    /**
     * Execute inference in parallel
     */
    private async executeParallel(
        slots: ModelSlot[],
        request: MultiModelRequest,
        timeout: number
    ): Promise<ModelResponseWithMeta[]> {
        const inferenceService = getServerlessInferenceService();
        const modelManager = getUserModelManager();

        const promises = slots.map(async (slot) => {
            const startTime = Date.now();

            try {
                const model = await modelManager.getModel(slot.modelId);
                const modelName = model?.name ?? 'Unknown';

                // Build inference request
                const inferRequest: InferenceRequest = {
                    id: uuidv4(),
                    endpointId: slot.modelId, // In practice, map to actual endpoint
                    prompt: this.buildPrompt(request, slot),
                    systemPrompt: this.buildSystemPrompt(slot),
                    maxTokens: 2048,
                    temperature: 0.7,
                    userId: request.userId,
                    projectId: request.projectId,
                };

                // For now, simulate response (would call actual inference service)
                const response = await this.simulateInference(inferRequest, slot);

                return {
                    modelId: slot.modelId,
                    modelName,
                    role: slot.role,
                    content: response.content,
                    confidence: this.estimateConfidence(response.content, slot),
                    latencyMs: Date.now() - startTime,
                    tokens: response.tokenUsage.total,
                    specialization: slot.specialization,
                };
            } catch (error) {
                console.error(`[MultiModel] Error from model ${slot.modelId}:`, error);
                return {
                    modelId: slot.modelId,
                    modelName: 'Error',
                    role: slot.role,
                    content: '',
                    confidence: 0,
                    latencyMs: Date.now() - startTime,
                    tokens: 0,
                };
            }
        });

        // Race against timeout
        const results = await Promise.race([
            Promise.all(promises),
            new Promise<ModelResponseWithMeta[]>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeout)
            ),
        ]);

        return results.filter(r => r.content.length > 0);
    }

    /**
     * Execute inference sequentially
     */
    private async executeSequential(
        slots: ModelSlot[],
        request: MultiModelRequest,
        timeout: number
    ): Promise<ModelResponseWithMeta[]> {
        const responses: ModelResponseWithMeta[] = [];
        const deadline = Date.now() + timeout;

        for (const slot of slots) {
            if (Date.now() >= deadline) break;

            const remainingTime = deadline - Date.now();
            const [response] = await this.executeParallel([slot], request, remainingTime);
            if (response) {
                responses.push(response);
            }
        }

        return responses;
    }

    /**
     * Resolve multiple responses to final output
     */
    private async resolveResponses(
        responses: ModelResponseWithMeta[],
        config: ProjectModelConfig
    ): Promise<string> {
        if (responses.length === 0) {
            return 'No response available';
        }

        if (responses.length === 1) {
            return responses[0].content;
        }

        switch (config.conflictResolution) {
            case 'primary-wins':
                const primary = responses.find(r => r.role === 'primary');
                return primary?.content ?? responses[0].content;

            case 'highest-confidence':
                const highestConf = responses.reduce((a, b) =>
                    a.confidence > b.confidence ? a : b
                );
                return highestConf.content;

            case 'blend':
                return this.blendResponses(responses, config);

            case 'user-choose':
                // In practice, would present options to user
                // For now, return highest confidence
                const best = responses.reduce((a, b) =>
                    a.confidence > b.confidence ? a : b
                );
                return best.content;

            default:
                return responses[0].content;
        }
    }

    /**
     * Blend responses from multiple models
     */
    private blendResponses(
        responses: ModelResponseWithMeta[],
        config: ProjectModelConfig
    ): string {
        // For code, we can't easily blend, so pick best
        // For design/text, could potentially merge
        // This is a simplified version

        // Weight by slot weight * confidence
        const scored = responses.map(r => {
            const slot = config.models.find(m => m.modelId === r.modelId);
            const weight = slot?.weight ?? 0.5;
            return {
                ...r,
                score: weight * r.confidence,
            };
        });

        const best = scored.reduce((a, b) => a.score > b.score ? a : b);
        return best.content;
    }

    /**
     * Capture interaction for user's learning model
     */
    private async captureForLearning(
        learningModelId: string,
        request: MultiModelRequest,
        responses: ModelResponseWithMeta[],
        finalResponse: string
    ): Promise<MultiModelResponse['learningCapture']> {
        const modelManager = getUserModelManager();

        // Record the interaction with all model responses
        // This helps the user's model learn from the combined outputs
        for (const response of responses) {
            await modelManager.recordInteraction({
                userId: request.userId,
                modelId: learningModelId,
                projectId: request.projectId,
                type: this.mapRequestTypeToInteraction(request.type),
                context: JSON.stringify(request.context),
                input: request.prompt,
                output: response.content,
                // If this was the chosen response, mark as accepted
                userFeedback: response.content === finalResponse ? 'accepted' : undefined,
            });
        }

        return {
            capturedForTraining: true,
            modelId: learningModelId,
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private buildPrompt(request: MultiModelRequest, slot: ModelSlot): string {
        let prompt = request.prompt;

        // Add context if available
        if (request.context?.currentFile) {
            prompt = `Current file: ${request.context.currentFile}\n\n${prompt}`;
        }

        if (request.context?.selectedCode) {
            prompt = `Selected code:\n\`\`\`\n${request.context.selectedCode}\n\`\`\`\n\n${prompt}`;
        }

        return prompt;
    }

    private buildSystemPrompt(slot: ModelSlot): string {
        const base = 'You are a helpful AI assistant integrated into KripTik AI.';

        if (slot.specialization) {
            const specializations: Record<ModelSpecialization, string> = {
                'code-generation': 'You specialize in generating high-quality, well-structured code.',
                'code-completion': 'You specialize in smart code completion and suggestions.',
                'code-review': 'You specialize in reviewing code and suggesting improvements.',
                'design-ui': 'You specialize in UI design with modern, accessible components.',
                'design-ux': 'You specialize in UX patterns and user-centered design.',
                'architecture': 'You specialize in software architecture and system design.',
                'testing': 'You specialize in writing comprehensive tests.',
                'documentation': 'You specialize in clear, helpful documentation.',
                'debugging': 'You specialize in finding and fixing bugs.',
                'optimization': 'You specialize in performance optimization.',
                'security': 'You specialize in secure coding practices.',
            };

            return `${base} ${specializations[slot.specialization]}`;
        }

        return base;
    }

    private estimateConfidence(content: string, slot: ModelSlot): number {
        // Simple heuristic confidence estimation
        let confidence = 0.7;

        // Longer, more detailed responses suggest higher confidence
        if (content.length > 500) confidence += 0.1;
        if (content.length > 1000) confidence += 0.05;

        // Code blocks suggest structured response
        if (content.includes('```')) confidence += 0.05;

        // Primary models get slight boost
        if (slot.role === 'primary') confidence += 0.05;

        // Specialized models get boost for their domain
        if (slot.specialization) confidence += 0.05;

        return Math.min(1, confidence);
    }

    private mapRequestTypeToInteraction(type: ModelSpecialization | 'general'): 'code_generation' | 'code_edit' | 'design_choice' | 'error_fix' | 'suggestion_feedback' {
        const mapping: Record<string, 'code_generation' | 'code_edit' | 'design_choice' | 'error_fix' | 'suggestion_feedback'> = {
            'code-generation': 'code_generation',
            'code-completion': 'code_generation',
            'code-review': 'code_edit',
            'design-ui': 'design_choice',
            'design-ux': 'design_choice',
            'architecture': 'code_generation',
            'testing': 'code_generation',
            'debugging': 'error_fix',
            'optimization': 'code_edit',
            'security': 'code_edit',
            'documentation': 'code_generation',
            'general': 'code_generation',
        };

        return mapping[type] || 'code_generation';
    }

    private async simulateInference(
        request: InferenceRequest,
        slot: ModelSlot
    ): Promise<InferenceResponse> {
        // Simulate inference for development
        // In production, this would call the actual inference service
        await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

        return {
            id: uuidv4(),
            requestId: request.id,
            content: `[Simulated response from ${slot.modelId}]\n\nThis would be the actual model response to: ${request.prompt.slice(0, 100)}...`,
            tokenUsage: {
                prompt: 100,
                completion: 200,
                total: 300,
            },
            latencyMs: 150,
            provider: 'simulated',
            modelVersion: '1.0',
            cost: 0.001,
        };
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    /**
     * Get project configuration
     */
    async getProjectConfig(projectId: string): Promise<ProjectModelConfig | undefined> {
        return this.projectConfigs.get(projectId);
    }

    /**
     * Get all projects using a model
     */
    async getProjectsUsingModel(modelId: string): Promise<string[]> {
        const projects: string[] = [];

        for (const [projectId, config] of this.projectConfigs) {
            if (config.models.some(m => m.modelId === modelId)) {
                projects.push(projectId);
            }
        }

        return projects;
    }

    /**
     * Get active requests
     */
    getActiveRequests(): MultiModelRequest[] {
        return Array.from(this.activeRequests.values());
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: MultiModelOrchestrator | null = null;

export function getMultiModelOrchestrator(): MultiModelOrchestrator {
    if (!instance) {
        instance = new MultiModelOrchestrator();
    }
    return instance;
}
