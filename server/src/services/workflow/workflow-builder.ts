/**
 * Workflow Builder Service
 * 
 * Builds, validates, and executes AI model workflows.
 * Supports interactive modification and cost estimation.
 */

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import {
    WorkflowPlan,
    WorkflowStep,
    WorkflowState,
    WorkflowDeployment,
    CostEstimate,
    ModelRecommendation,
    DataFlowEdge,
    DeploymentTarget,
} from '../agents/types';
import { getModelDiscoveryService } from '../discovery/model-discovery';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowModification {
    type: 'add-step' | 'remove-step' | 'modify-step' | 'reorder' | 'add-connection' | 'remove-connection';
    stepId?: string;
    newStep?: Partial<WorkflowStep>;
    position?: number;
    connection?: { source: string; target: string };
}

export interface WorkflowValidation {
    valid: boolean;
    errors: WorkflowError[];
    warnings: WorkflowWarning[];
}

export interface WorkflowError {
    stepId?: string;
    type: 'missing-dependency' | 'circular-dependency' | 'invalid-connection' | 'missing-model' | 'missing-credential';
    message: string;
}

export interface WorkflowWarning {
    stepId?: string;
    type: 'high-cost' | 'high-latency' | 'deprecated-model' | 'resource-intensive';
    message: string;
}

// ============================================================================
// WORKFLOW BUILDER SERVICE
// ============================================================================

export class WorkflowBuilderService {
    private anthropicClient?: Anthropic;
    
    constructor() {
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
    }
    
    /**
     * Create a new workflow from natural language description
     */
    async createFromDescription(
        description: string,
        options?: {
            preferredModels?: string[];
            maxCost?: number;
            deploymentTarget?: string;
        }
    ): Promise<WorkflowPlan> {
        const discovery = getModelDiscoveryService();
        
        // Search for relevant models
        const searchResult = await discovery.searchModels({
            requirement: description,
            maxResults: 10,
        });
        
        // Generate workflow plan
        const plan = await discovery.generateWorkflowPlan(
            description,
            searchResult.recommendations,
            options
        );
        
        return plan;
    }
    
    /**
     * Apply a modification to a workflow
     */
    applyModification(workflow: WorkflowPlan, modification: WorkflowModification): WorkflowPlan {
        const updated = { ...workflow, steps: [...workflow.steps] };
        
        switch (modification.type) {
            case 'add-step':
                if (modification.newStep) {
                    const newStep: WorkflowStep = {
                        id: modification.newStep.id || uuidv4(),
                        type: modification.newStep.type || 'model',
                        name: modification.newStep.name || 'New Step',
                        description: modification.newStep.description || '',
                        config: modification.newStep.config || {},
                        inputs: modification.newStep.inputs || [],
                        outputs: modification.newStep.outputs || [],
                        dependencies: modification.newStep.dependencies || [],
                        position: modification.newStep.position || { x: 0, y: 0 },
                        model: modification.newStep.model,
                    };
                    
                    if (modification.position !== undefined) {
                        updated.steps.splice(modification.position, 0, newStep);
                    } else {
                        updated.steps.push(newStep);
                    }
                }
                break;
                
            case 'remove-step':
                if (modification.stepId) {
                    updated.steps = updated.steps.filter(s => s.id !== modification.stepId);
                    // Also remove any connections involving this step
                    updated.dataFlow = updated.dataFlow.filter(
                        f => f.source !== modification.stepId && f.target !== modification.stepId
                    );
                }
                break;
                
            case 'modify-step':
                if (modification.stepId && modification.newStep) {
                    updated.steps = updated.steps.map(s => {
                        if (s.id === modification.stepId) {
                            return { ...s, ...modification.newStep };
                        }
                        return s;
                    });
                }
                break;
                
            case 'reorder':
                if (modification.stepId && modification.position !== undefined) {
                    const stepIndex = updated.steps.findIndex(s => s.id === modification.stepId);
                    if (stepIndex >= 0) {
                        const [step] = updated.steps.splice(stepIndex, 1);
                        updated.steps.splice(modification.position, 0, step);
                    }
                }
                break;
                
            case 'add-connection':
                if (modification.connection) {
                    const newEdge: DataFlowEdge = {
                        id: uuidv4(),
                        source: modification.connection.source,
                        target: modification.connection.target,
                        sourceOutput: 'output',
                        targetInput: 'input',
                        dataType: 'any',
                    };
                    updated.dataFlow = [...updated.dataFlow, newEdge];
                }
                break;
                
            case 'remove-connection':
                if (modification.connection) {
                    updated.dataFlow = updated.dataFlow.filter(
                        f => !(f.source === modification.connection!.source && 
                               f.target === modification.connection!.target)
                    );
                }
                break;
        }
        
        // Recalculate cost
        updated.totalEstimatedCost = this.calculateCost(updated);
        
        return updated;
    }
    
    /**
     * Validate a workflow
     */
    validateWorkflow(workflow: WorkflowPlan, availableCredentials: string[]): WorkflowValidation {
        const errors: WorkflowError[] = [];
        const warnings: WorkflowWarning[] = [];
        
        // Check for missing models
        for (const step of workflow.steps) {
            if (step.type === 'model' && !step.model) {
                errors.push({
                    stepId: step.id,
                    type: 'missing-model',
                    message: `Step "${step.name}" requires a model but none is assigned`,
                });
            }
        }
        
        // Check for circular dependencies
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        
        for (const step of workflow.steps) {
            if (this.hasCyclicDependency(step.id, workflow.dataFlow, visited, recursionStack)) {
                errors.push({
                    stepId: step.id,
                    type: 'circular-dependency',
                    message: `Circular dependency detected involving step "${step.name}"`,
                });
            }
        }
        
        // Check for missing credentials
        for (const required of workflow.requiredCredentials) {
            if (!availableCredentials.includes(required)) {
                errors.push({
                    type: 'missing-credential',
                    message: `Missing credential: ${required}`,
                });
            }
        }
        
        // Check for invalid connections
        const stepIds = new Set(workflow.steps.map(s => s.id));
        for (const edge of workflow.dataFlow) {
            if (!stepIds.has(edge.source) || !stepIds.has(edge.target)) {
                errors.push({
                    type: 'invalid-connection',
                    message: `Invalid connection from ${edge.source} to ${edge.target}`,
                });
            }
        }
        
        // Warnings
        if (workflow.totalEstimatedCost.hourlyRunningCost > 5) {
            warnings.push({
                type: 'high-cost',
                message: `High hourly cost: $${workflow.totalEstimatedCost.hourlyRunningCost.toFixed(2)}/hour`,
            });
        }
        
        const totalLatency = workflow.steps.reduce(
            (sum, s) => sum + (s.model?.requirements.estimatedLatency || 0),
            0
        );
        if (totalLatency > 60) {
            warnings.push({
                type: 'high-latency',
                message: `High total latency: ~${totalLatency}s per execution`,
            });
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    
    /**
     * Check for cyclic dependencies using DFS
     */
    private hasCyclicDependency(
        stepId: string,
        edges: DataFlowEdge[],
        visited: Set<string>,
        recursionStack: Set<string>
    ): boolean {
        if (!visited.has(stepId)) {
            visited.add(stepId);
            recursionStack.add(stepId);
            
            const outgoing = edges.filter(e => e.source === stepId);
            for (const edge of outgoing) {
                if (!visited.has(edge.target) && 
                    this.hasCyclicDependency(edge.target, edges, visited, recursionStack)) {
                    return true;
                } else if (recursionStack.has(edge.target)) {
                    return true;
                }
            }
        }
        
        recursionStack.delete(stepId);
        return false;
    }
    
    /**
     * Calculate workflow cost
     */
    calculateCost(workflow: WorkflowPlan): CostEstimate {
        let hourlyRunningCost = 0;
        const breakdown: CostEstimate['breakdown'] = [];
        
        for (const step of workflow.steps) {
            if (step.model) {
                const gpuCost = this.getGPUCostPerHour(step.model.requirements.gpu);
                hourlyRunningCost += gpuCost;
                breakdown.push({
                    item: step.model.name,
                    cost: gpuCost,
                    unit: 'per-hour',
                });
            }
        }
        
        return {
            setupCost: 0,
            hourlyRunningCost,
            estimatedMonthlyCost: hourlyRunningCost * 730,
            breakdown,
            currency: 'USD',
        };
    }
    
    private getGPUCostPerHour(gpu: string): number {
        const costs: Record<string, number> = {
            'T4': 0.20,
            'L4': 0.30,
            'A10G': 0.40,
            'A40': 0.60,
            'A100': 1.50,
            'H100': 3.00,
            'hosted': 0,
        };
        return costs[gpu] || 0.30;
    }
    
    /**
     * Generate execution order for steps (topological sort)
     */
    getExecutionOrder(workflow: WorkflowPlan): WorkflowStep[] {
        const inDegree = new Map<string, number>();
        const adjacency = new Map<string, string[]>();
        
        // Initialize
        for (const step of workflow.steps) {
            inDegree.set(step.id, 0);
            adjacency.set(step.id, []);
        }
        
        // Build graph
        for (const edge of workflow.dataFlow) {
            const targets = adjacency.get(edge.source) || [];
            targets.push(edge.target);
            adjacency.set(edge.source, targets);
            
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }
        
        // Kahn's algorithm
        const queue: string[] = [];
        for (const [stepId, degree] of inDegree) {
            if (degree === 0) {
                queue.push(stepId);
            }
        }
        
        const order: WorkflowStep[] = [];
        while (queue.length > 0) {
            const stepId = queue.shift()!;
            const step = workflow.steps.find(s => s.id === stepId);
            if (step) {
                order.push(step);
            }
            
            for (const target of adjacency.get(stepId) || []) {
                const newDegree = (inDegree.get(target) || 1) - 1;
                inDegree.set(target, newDegree);
                if (newDegree === 0) {
                    queue.push(target);
                }
            }
        }
        
        return order;
    }
    
    /**
     * Generate Dockerfile for a workflow
     */
    async generateDockerfile(workflow: WorkflowPlan): Promise<string> {
        const models = workflow.steps
            .filter(s => s.model)
            .map(s => s.model!);
        
        if (models.length === 0) {
            return this.getBaseDockerfile();
        }
        
        // Determine base image based on requirements
        const maxVRAM = Math.max(...models.map(m => m.requirements.vram));
        const frameworks = new Set(models.map(m => m.requirements.framework));
        
        let baseImage = 'nvidia/cuda:12.1-runtime-ubuntu22.04';
        let pythonVersion = '3.10';
        
        // Check if we need specific framework support
        if (frameworks.has('transformers') || frameworks.has('pytorch')) {
            baseImage = 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime';
        }
        
        const dockerfile = `# Auto-generated Dockerfile for KripTik AI Workflow
# Models: ${models.map(m => m.name).join(', ')}
# Estimated VRAM: ${maxVRAM}GB

FROM ${baseImage}

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TRANSFORMERS_CACHE=/cache/huggingface
ENV HF_HOME=/cache/huggingface

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    git \\
    wget \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create cache directory
RUN mkdir -p /cache/huggingface

# Install Python dependencies
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Pre-download models (optional, increases image size but speeds up cold starts)
${models.map(m => `# Model: ${m.modelId}`).join('\n')}

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;

        return dockerfile;
    }
    
    private getBaseDockerfile(): string {
        return `# Base Dockerfile for KripTik AI Workflow
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
    }
    
    /**
     * Generate requirements.txt for a workflow
     */
    generateRequirements(workflow: WorkflowPlan): string {
        const requirements = new Set<string>([
            'fastapi>=0.104.0',
            'uvicorn>=0.24.0',
            'pydantic>=2.5.0',
            'python-dotenv>=1.0.0',
        ]);
        
        const models = workflow.steps
            .filter(s => s.model)
            .map(s => s.model!);
        
        const frameworks = new Set(models.map(m => m.requirements.framework));
        
        if (frameworks.has('transformers') || frameworks.has('pytorch')) {
            requirements.add('torch>=2.1.0');
            requirements.add('transformers>=4.35.0');
            requirements.add('accelerate>=0.24.0');
        }
        
        if (frameworks.has('diffusers')) {
            requirements.add('diffusers>=0.24.0');
        }
        
        if (frameworks.has('replicate')) {
            requirements.add('replicate>=0.20.0');
        }
        
        if (frameworks.has('together')) {
            requirements.add('together>=0.2.0');
        }
        
        return Array.from(requirements).join('\n');
    }
    
    /**
     * Create a workflow state for execution tracking
     */
    createWorkflowState(workflow: WorkflowPlan): WorkflowState {
        return {
            id: uuidv4(),
            name: workflow.name,
            status: 'planning',
            plan: workflow,
            deployments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: WorkflowBuilderService | null = null;

export function getWorkflowBuilderService(): WorkflowBuilderService {
    if (!instance) {
        instance = new WorkflowBuilderService();
    }
    return instance;
}

