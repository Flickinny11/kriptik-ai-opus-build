/**
 * Unified Model Discovery Service
 * 
 * Searches multiple model registries to find the best models for user requirements.
 * Supports HuggingFace, Replicate, Together AI, Ollama, and custom registries.
 */

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import {
    ModelRecommendation,
    ModelSource,
    ModelRequirements,
    ModelPopularity,
    ModelPricing,
    WorkflowPlan,
    WorkflowStep,
    CostEstimate,
} from '../agents/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ModelSearchQuery {
    requirement: string;
    taskType?: string;
    sources?: ModelSource[];
    maxResults?: number;
    minDownloads?: number;
    preferOpenSource?: boolean;
    maxVRAM?: number;
    framework?: string;
}

export interface ModelSearchResult {
    recommendations: ModelRecommendation[];
    searchTime: number;
    sourcesSearched: ModelSource[];
    totalFound: number;
}

interface HuggingFaceModel {
    id: string;
    modelId: string;
    pipeline_tag?: string;
    library_name?: string;
    tags?: string[];
    downloads?: number;
    likes?: number;
    lastModified?: string;
    private?: boolean;
    gated?: boolean;
    config?: {
        model_type?: string;
    };
}

interface ReplicateModel {
    url: string;
    owner: string;
    name: string;
    description: string;
    run_count: number;
    latest_version?: {
        id: string;
    };
}

// ============================================================================
// MODEL DISCOVERY SERVICE
// ============================================================================

export class ModelDiscoveryService {
    private hfToken?: string;
    private replicateToken?: string;
    private togetherToken?: string;
    private anthropicClient?: Anthropic;
    
    constructor() {
        this.hfToken = process.env.HF_TOKEN;
        this.replicateToken = process.env.REPLICATE_API_TOKEN;
        this.togetherToken = process.env.TOGETHER_API_KEY;
        
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
    }
    
    /**
     * Search for models across all sources
     */
    async searchModels(query: ModelSearchQuery): Promise<ModelSearchResult> {
        const startTime = Date.now();
        const sources = query.sources || ['huggingface', 'replicate', 'together'];
        const allRecommendations: ModelRecommendation[] = [];
        
        // Search each source in parallel
        const searchPromises: Promise<ModelRecommendation[]>[] = [];
        
        if (sources.includes('huggingface')) {
            searchPromises.push(this.searchHuggingFace(query));
        }
        
        if (sources.includes('replicate')) {
            searchPromises.push(this.searchReplicate(query));
        }
        
        if (sources.includes('together')) {
            searchPromises.push(this.searchTogether(query));
        }
        
        const results = await Promise.allSettled(searchPromises);
        
        for (const result of results) {
            if (result.status === 'fulfilled') {
                allRecommendations.push(...result.value);
            }
        }
        
        // Use AI to rank and filter recommendations if available
        let ranked = allRecommendations;
        if (this.anthropicClient && allRecommendations.length > 0) {
            ranked = await this.rankWithAI(query.requirement, allRecommendations);
        }
        
        // Sort by popularity/downloads as fallback
        ranked.sort((a, b) => b.popularity.downloads - a.popularity.downloads);
        
        // Apply max results limit
        const limited = ranked.slice(0, query.maxResults || 10);
        
        return {
            recommendations: limited,
            searchTime: Date.now() - startTime,
            sourcesSearched: sources,
            totalFound: allRecommendations.length,
        };
    }
    
    /**
     * Search HuggingFace Hub
     */
    private async searchHuggingFace(query: ModelSearchQuery): Promise<ModelRecommendation[]> {
        try {
            const params = new URLSearchParams({
                search: query.requirement,
                limit: String(query.maxResults || 20),
                sort: 'downloads',
                direction: '-1',
            });
            
            if (query.taskType) {
                params.append('filter', query.taskType);
            }
            
            const response = await fetch(`https://huggingface.co/api/models?${params}`, {
                headers: this.hfToken ? { Authorization: `Bearer ${this.hfToken}` } : {},
            });
            
            if (!response.ok) {
                console.error('HuggingFace search failed:', response.status);
                return [];
            }
            
            const models: HuggingFaceModel[] = await response.json();
            
            return models
                .filter(m => !m.private && !m.gated)
                .filter(m => !query.minDownloads || (m.downloads || 0) >= query.minDownloads)
                .map(m => this.mapHuggingFaceModel(m));
        } catch (error) {
            console.error('Error searching HuggingFace:', error);
            return [];
        }
    }
    
    /**
     * Search Replicate
     */
    private async searchReplicate(query: ModelSearchQuery): Promise<ModelRecommendation[]> {
        if (!this.replicateToken) {
            return [];
        }
        
        try {
            // Replicate doesn't have a search API, so we use their collections
            const response = await fetch('https://api.replicate.com/v1/models', {
                headers: {
                    Authorization: `Token ${this.replicateToken}`,
                },
            });
            
            if (!response.ok) {
                console.error('Replicate search failed:', response.status);
                return [];
            }
            
            const data = await response.json();
            const models: ReplicateModel[] = data.results || [];
            
            // Filter by query (simple keyword match)
            const keywords = query.requirement.toLowerCase().split(/\s+/);
            const filtered = models.filter(m => {
                const text = `${m.name} ${m.description}`.toLowerCase();
                return keywords.some(k => text.includes(k));
            });
            
            return filtered.slice(0, query.maxResults || 10).map(m => this.mapReplicateModel(m));
        } catch (error) {
            console.error('Error searching Replicate:', error);
            return [];
        }
    }
    
    /**
     * Search Together AI
     */
    private async searchTogether(query: ModelSearchQuery): Promise<ModelRecommendation[]> {
        if (!this.togetherToken) {
            return [];
        }
        
        try {
            const response = await fetch('https://api.together.xyz/v1/models', {
                headers: {
                    Authorization: `Bearer ${this.togetherToken}`,
                },
            });
            
            if (!response.ok) {
                console.error('Together AI search failed:', response.status);
                return [];
            }
            
            const models = await response.json();
            
            // Filter by query
            const keywords = query.requirement.toLowerCase().split(/\s+/);
            const filtered = models.filter((m: any) => {
                const text = `${m.id} ${m.display_name || ''} ${m.description || ''}`.toLowerCase();
                return keywords.some(k => text.includes(k));
            });
            
            return filtered.slice(0, query.maxResults || 10).map((m: any) => this.mapTogetherModel(m));
        } catch (error) {
            console.error('Error searching Together AI:', error);
            return [];
        }
    }
    
    /**
     * Get detailed model info from HuggingFace
     */
    async getHuggingFaceModelInfo(modelId: string): Promise<ModelRecommendation | null> {
        try {
            const response = await fetch(`https://huggingface.co/api/models/${modelId}`, {
                headers: this.hfToken ? { Authorization: `Bearer ${this.hfToken}` } : {},
            });
            
            if (!response.ok) {
                return null;
            }
            
            const model: HuggingFaceModel = await response.json();
            return this.mapHuggingFaceModel(model);
        } catch (error) {
            console.error('Error getting HuggingFace model info:', error);
            return null;
        }
    }
    
    /**
     * Use AI to rank recommendations based on user requirement
     */
    private async rankWithAI(
        requirement: string,
        recommendations: ModelRecommendation[]
    ): Promise<ModelRecommendation[]> {
        if (!this.anthropicClient || recommendations.length <= 3) {
            return recommendations;
        }
        
        try {
            const modelsInfo = recommendations.slice(0, 20).map(r => ({
                id: r.modelId,
                source: r.source,
                task: r.task,
                downloads: r.popularity.downloads,
                vram: r.requirements.vram,
            }));
            
            const response = await this.anthropicClient.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: `Given this user requirement: "${requirement}"

Rank these models from best to worst match. Return only a JSON array of model IDs in order:

${JSON.stringify(modelsInfo, null, 2)}

Return format: ["model_id_1", "model_id_2", ...]`,
                    }
                ],
            });
            
            const content = response.content[0];
            const text = content.type === 'text' ? content.text : '[]';
            
            // Extract JSON array
            const match = text.match(/\[[\s\S]*\]/);
            if (!match) return recommendations;
            
            const rankedIds: string[] = JSON.parse(match[0]);
            
            // Reorder recommendations based on AI ranking
            const ranked: ModelRecommendation[] = [];
            for (const id of rankedIds) {
                const model = recommendations.find(r => r.modelId === id);
                if (model) ranked.push(model);
            }
            
            // Add any models not in ranking at the end
            for (const model of recommendations) {
                if (!ranked.includes(model)) {
                    ranked.push(model);
                }
            }
            
            return ranked;
        } catch (error) {
            console.error('Error ranking with AI:', error);
            return recommendations;
        }
    }
    
    // ========================================================================
    // MAPPING FUNCTIONS
    // ========================================================================
    
    private mapHuggingFaceModel(model: HuggingFaceModel): ModelRecommendation {
        const vram = this.estimateVRAM(model);
        
        return {
            modelId: model.modelId || model.id,
            source: 'huggingface',
            name: model.modelId?.split('/').pop() || model.id,
            task: model.pipeline_tag || 'unknown',
            reasoning: `Popular ${model.pipeline_tag || 'model'} with ${(model.downloads || 0).toLocaleString()} downloads`,
            alternatives: [],
            requirements: {
                gpu: vram > 24 ? 'A100' : vram > 16 ? 'A10G' : 'T4',
                vram,
                estimatedLatency: this.estimateLatency(model),
                supportedFormats: this.getSupportedFormats(model),
                framework: model.library_name || 'transformers',
            },
            popularity: {
                downloads: model.downloads || 0,
                likes: model.likes || 0,
                lastUpdated: new Date(model.lastModified || Date.now()),
                trending: (model.downloads || 0) > 10000,
            },
        };
    }
    
    private mapReplicateModel(model: ReplicateModel): ModelRecommendation {
        return {
            modelId: `${model.owner}/${model.name}`,
            source: 'replicate',
            name: model.name,
            task: this.inferTaskFromDescription(model.description),
            reasoning: `${model.run_count.toLocaleString()} runs on Replicate - ${model.description.slice(0, 100)}`,
            alternatives: [],
            requirements: {
                gpu: 'A40',  // Replicate uses A40s typically
                vram: 24,
                estimatedLatency: 5,
                supportedFormats: ['replicate'],
                framework: 'replicate',
            },
            popularity: {
                downloads: model.run_count,
                likes: 0,
                lastUpdated: new Date(),
                trending: model.run_count > 10000,
            },
            pricing: {
                provider: 'replicate',
                costPerSecond: 0.00055,  // A40 pricing estimate
            },
        };
    }
    
    private mapTogetherModel(model: any): ModelRecommendation {
        return {
            modelId: model.id,
            source: 'together',
            name: model.display_name || model.id,
            task: model.type || 'text-generation',
            reasoning: `Together AI hosted model: ${model.description || model.id}`,
            alternatives: [],
            requirements: {
                gpu: 'hosted',
                vram: 0,  // Hosted, no local requirements
                estimatedLatency: 1,
                supportedFormats: ['together-api'],
                framework: 'together',
            },
            popularity: {
                downloads: 0,
                likes: 0,
                lastUpdated: new Date(),
                trending: false,
            },
            pricing: {
                provider: 'together',
                costPerToken: model.pricing?.input || 0.0002,
            },
        };
    }
    
    // ========================================================================
    // ESTIMATION HELPERS
    // ========================================================================
    
    private estimateVRAM(model: HuggingFaceModel): number {
        // Estimate VRAM based on model name/tags
        const name = (model.modelId || model.id).toLowerCase();
        
        if (name.includes('70b')) return 140;
        if (name.includes('34b') || name.includes('33b')) return 70;
        if (name.includes('13b')) return 28;
        if (name.includes('7b') || name.includes('8b')) return 16;
        if (name.includes('3b')) return 8;
        if (name.includes('1b')) return 4;
        
        // Image models
        if (name.includes('xl')) return 12;
        if (name.includes('sdxl')) return 8;
        if (name.includes('flux')) return 24;
        
        // Default
        return 8;
    }
    
    private estimateLatency(model: HuggingFaceModel): number {
        const task = model.pipeline_tag || '';
        
        if (task.includes('image')) return 10;
        if (task.includes('video')) return 30;
        if (task.includes('audio')) return 5;
        if (task.includes('text-generation')) return 2;
        
        return 5;
    }
    
    private getSupportedFormats(model: HuggingFaceModel): string[] {
        const formats: string[] = [];
        const tags = model.tags || [];
        
        if (tags.includes('gguf') || tags.includes('ggml')) formats.push('gguf');
        if (tags.includes('gptq')) formats.push('gptq');
        if (tags.includes('awq')) formats.push('awq');
        if (tags.includes('safetensors')) formats.push('safetensors');
        
        if (formats.length === 0) {
            formats.push('pytorch');
        }
        
        return formats;
    }
    
    private inferTaskFromDescription(description: string): string {
        const desc = description.toLowerCase();
        
        if (desc.includes('image generation') || desc.includes('text to image')) return 'text-to-image';
        if (desc.includes('language model') || desc.includes('chat')) return 'text-generation';
        if (desc.includes('speech') || desc.includes('audio')) return 'audio';
        if (desc.includes('video')) return 'video-generation';
        if (desc.includes('embedding')) return 'embedding';
        
        return 'unknown';
    }
    
    // ========================================================================
    // WORKFLOW GENERATION
    // ========================================================================
    
    /**
     * Generate a workflow plan from user requirement and discovered models
     */
    async generateWorkflowPlan(
        requirement: string,
        selectedModels: ModelRecommendation[],
        options?: {
            deploymentTarget?: string;
            maxCost?: number;
        }
    ): Promise<WorkflowPlan> {
        // Use AI to generate workflow if available
        if (this.anthropicClient && selectedModels.length > 0) {
            return this.generateWorkflowWithAI(requirement, selectedModels, options);
        }
        
        // Fallback to simple workflow
        return this.generateSimpleWorkflow(requirement, selectedModels, options);
    }
    
    private async generateWorkflowWithAI(
        requirement: string,
        models: ModelRecommendation[],
        options?: { deploymentTarget?: string; maxCost?: number }
    ): Promise<WorkflowPlan> {
        const modelsInfo = models.map(m => ({
            id: m.modelId,
            name: m.name,
            task: m.task,
            source: m.source,
            vram: m.requirements.vram,
        }));
        
        const response = await this.anthropicClient!.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [
                {
                    role: 'user',
                    content: `Create a workflow plan for this requirement: "${requirement}"

Available models:
${JSON.stringify(modelsInfo, null, 2)}

Return a JSON object with this structure:
{
  "name": "workflow name",
  "description": "what this workflow does",
  "steps": [
    {
      "id": "step-1",
      "type": "model",
      "name": "step name",
      "description": "what this step does",
      "modelId": "model id from the list",
      "inputs": [],
      "outputs": ["output-name"],
      "dependencies": []
    }
  ],
  "dataFlow": [
    { "source": "step-1", "target": "step-2", "sourceOutput": "output-name", "targetInput": "input-name", "dataType": "text" }
  ]
}`,
                }
            ],
        });
        
        const content = response.content[0];
        const text = content.type === 'text' ? content.text : '{}';
        
        // Extract JSON
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) {
            return this.generateSimpleWorkflow(requirement, models, options);
        }
        
        try {
            const parsed = JSON.parse(match[0]);
            
            // Map to proper WorkflowPlan structure
            const steps: WorkflowStep[] = (parsed.steps || []).map((s: any, i: number) => ({
                id: s.id || `step-${i + 1}`,
                type: s.type || 'model',
                name: s.name || `Step ${i + 1}`,
                description: s.description || '',
                model: models.find(m => m.modelId === s.modelId),
                config: {},
                inputs: s.inputs || [],
                outputs: s.outputs || [],
                dependencies: s.dependencies || [],
                position: { x: i * 200, y: 100 },
            }));
            
            return {
                id: uuidv4(),
                name: parsed.name || 'AI Workflow',
                description: parsed.description || requirement,
                steps,
                totalEstimatedCost: this.estimateCost(steps, models),
                requiredCredentials: this.getRequiredCredentials(models),
                deploymentTargets: [{
                    id: 'default',
                    provider: options?.deploymentTarget || 'runpod',
                    config: {},
                }],
                dataFlow: parsed.dataFlow || [],
            };
        } catch (error) {
            console.error('Error parsing AI workflow:', error);
            return this.generateSimpleWorkflow(requirement, models, options);
        }
    }
    
    private generateSimpleWorkflow(
        requirement: string,
        models: ModelRecommendation[],
        options?: { deploymentTarget?: string; maxCost?: number }
    ): WorkflowPlan {
        // Create simple linear workflow
        const steps: WorkflowStep[] = models.map((model, i) => ({
            id: `step-${i + 1}`,
            type: 'model' as const,
            name: model.name,
            description: `Run ${model.name} for ${model.task}`,
            model,
            config: {},
            inputs: i > 0 ? [`step-${i}`] : [],
            outputs: [`output-${i + 1}`],
            dependencies: i > 0 ? [`step-${i}`] : [],
            position: { x: i * 200, y: 100 },
        }));
        
        return {
            id: uuidv4(),
            name: 'Generated Workflow',
            description: requirement,
            steps,
            totalEstimatedCost: this.estimateCost(steps, models),
            requiredCredentials: this.getRequiredCredentials(models),
            deploymentTargets: [{
                id: 'default',
                provider: options?.deploymentTarget || 'runpod',
                config: {},
            }],
            dataFlow: steps.slice(1).map((s, i) => ({
                id: `flow-${i}`,
                source: steps[i].id,
                target: s.id,
                sourceOutput: steps[i].outputs[0],
                targetInput: 'input',
                dataType: 'any',
            })),
        };
    }
    
    private estimateCost(steps: WorkflowStep[], models: ModelRecommendation[]): CostEstimate {
        let hourlyRunningCost = 0;
        const breakdown: { item: string; cost: number; unit: string }[] = [];
        
        for (const step of steps) {
            if (step.model) {
                const gpuCost = this.getGPUCost(step.model.requirements.gpu);
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
            estimatedMonthlyCost: hourlyRunningCost * 730,  // Assuming 24/7 operation
            breakdown: breakdown as CostEstimate['breakdown'],
            currency: 'USD',
        };
    }
    
    private getGPUCost(gpu: string): number {
        const costs: Record<string, number> = {
            'T4': 0.20,
            'A10G': 0.40,
            'A40': 0.60,
            'A100': 1.50,
            'H100': 3.00,
            'hosted': 0,
        };
        return costs[gpu] || 0.30;
    }
    
    private getRequiredCredentials(models: ModelRecommendation[]): string[] {
        const credentials = new Set<string>();
        
        for (const model of models) {
            switch (model.source) {
                case 'huggingface':
                    credentials.add('huggingface');
                    break;
                case 'replicate':
                    credentials.add('replicate');
                    break;
                case 'together':
                    credentials.add('together');
                    break;
            }
        }
        
        // Add deployment credential
        credentials.add('runpod');  // Default deployment target
        
        return Array.from(credentials);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: ModelDiscoveryService | null = null;

export function getModelDiscoveryService(): ModelDiscoveryService {
    if (!instance) {
        instance = new ModelDiscoveryService();
    }
    return instance;
}

