/**
 * User Model Manager
 *
 * Manages user-specific personalized models that learn from:
 * - User coding habits and style preferences
 * - Code patterns and architecture choices
 * - Design preferences (colors, layouts, components)
 * - Error patterns and recovery strategies
 * - Project-specific context and domain knowledge
 *
 * Features:
 * - Create custom models per project
 * - Load existing models into projects
 * - Save models for reuse
 * - Share models in marketplace
 * - Multi-model support per project
 * - Assistive learning for inexperienced users
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

export interface UserModel {
    id: string;
    userId: string;
    name: string;
    description?: string;
    baseModelId: string;  // Which shadow model type it's based on
    adapterPath?: string;  // Path to trained LoRA adapter

    // Learning data
    trainingDataCount: number;
    lastTrainingDate?: Date;
    trainingStatus: 'idle' | 'collecting' | 'training' | 'ready';

    // Learned preferences
    preferences: UserModelPreferences;

    // Metrics
    metrics: UserModelMetrics;

    // Sharing
    visibility: 'private' | 'public' | 'team';
    marketplaceId?: string;  // If published to marketplace

    // Metadata
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserModelPreferences {
    // Code style preferences
    codeStyle: {
        indentation: 'tabs' | 'spaces';
        indentSize: number;
        namingConvention: 'camelCase' | 'snake_case' | 'PascalCase' | 'kebab-case';
        preferredFrameworks: string[];
        preferredLibraries: string[];
        commentStyle: 'minimal' | 'moderate' | 'verbose';
        errorHandlingStyle: 'try-catch' | 'result-types' | 'exceptions';
    };

    // Design preferences
    designStyle: {
        colorSchemes: string[];
        typography: string[];
        layoutPreference: 'grid' | 'flex' | 'mixed';
        animationLevel: 'none' | 'subtle' | 'moderate' | 'rich';
        componentLibraries: string[];
        iconSets: string[];
    };

    // Architecture preferences
    architecture: {
        fileStructure: 'flat' | 'by-feature' | 'by-type' | 'domain-driven';
        stateManagement: string[];
        apiStyle: 'REST' | 'GraphQL' | 'tRPC' | 'mixed';
        testingPreference: 'unit' | 'integration' | 'e2e' | 'all';
    };

    // User skill level (for assistive mode)
    skillLevel: {
        overall: 'beginner' | 'intermediate' | 'advanced' | 'expert';
        frontend: number;  // 0-100
        backend: number;
        database: number;
        devops: number;
        design: number;
    };

    // Custom tags/categories learned
    customTags: string[];
}

export interface UserModelMetrics {
    totalInteractions: number;
    successfulPredictions: number;
    predictionAccuracy: number;  // 0-100
    userSatisfactionScore: number;  // 0-100
    codeQualityImprovement: number;  // Percentage improvement
    errorReductionRate: number;  // Percentage reduction
    averageResponseTime: number;  // ms
    projectsUsedIn: number;
    totalCodeGenerated: number;  // Lines
    totalSuggestionsAccepted: number;
    totalSuggestionsRejected: number;
}

export interface ProjectModelAssociation {
    id: string;
    projectId: string;
    modelId: string;
    role: 'primary' | 'secondary' | 'specialized';
    specialization?: 'code' | 'design' | 'architecture' | 'testing';
    isTraining: boolean;  // Whether the model is actively learning from this project
    addedAt: Date;
}

export interface TrainingDataPoint {
    id: string;
    userId: string;
    modelId: string;
    projectId?: string;
    type: 'code_generation' | 'code_edit' | 'design_choice' | 'error_fix' | 'suggestion_feedback';
    context: string;
    input: string;
    output: string;
    userFeedback?: 'accepted' | 'rejected' | 'modified';
    modifiedOutput?: string;
    quality?: number;  // AI-judged quality 0-100
    timestamp: Date;
}

export interface ModelSuggestion {
    type: 'create_new' | 'use_existing' | 'marketplace';
    modelId?: string;
    name?: string;
    reason: string;
    confidence: number;
}

// =============================================================================
// USER MODEL MANAGER SERVICE
// =============================================================================

export class UserModelManager extends EventEmitter {
    private models: Map<string, UserModel> = new Map();
    private projectAssociations: Map<string, ProjectModelAssociation[]> = new Map();
    private trainingQueue: Map<string, TrainingDataPoint[]> = new Map();
    private readonly MIN_TRAINING_SAMPLES = 50;
    private readonly TRAINING_BATCH_SIZE = 100;

    constructor() {
        super();
    }

    // =========================================================================
    // MODEL LIFECYCLE
    // =========================================================================

    /**
     * Create a new user model
     */
    async createModel(input: {
        userId: string;
        name: string;
        description?: string;
        baseModelId?: string;
        projectId?: string;
    }): Promise<UserModel> {
        const modelId = `umodel-${uuidv4().slice(0, 12)}`;
        const now = new Date();

        const model: UserModel = {
            id: modelId,
            userId: input.userId,
            name: input.name,
            description: input.description,
            baseModelId: input.baseModelId || 'code_specialist',
            trainingDataCount: 0,
            trainingStatus: 'idle',
            preferences: this.getDefaultPreferences(),
            metrics: this.getDefaultMetrics(),
            visibility: 'private',
            version: 1,
            createdAt: now,
            updatedAt: now,
        };

        this.models.set(modelId, model);
        this.trainingQueue.set(modelId, []);

        // Associate with project if provided
        if (input.projectId) {
            await this.associateModelWithProject(input.projectId, modelId, 'primary', true);
        }

        this.emit('model_created', { model, projectId: input.projectId });
        console.log(`[UserModelManager] Created model ${modelId} for user ${input.userId}`);

        return model;
    }

    /**
     * Get a user's models
     */
    async getUserModels(userId: string): Promise<UserModel[]> {
        return Array.from(this.models.values())
            .filter(m => m.userId === userId);
    }

    /**
     * Get a specific model
     */
    async getModel(modelId: string): Promise<UserModel | undefined> {
        return this.models.get(modelId);
    }

    /**
     * Update model preferences
     */
    async updateModelPreferences(
        modelId: string,
        preferences: Partial<UserModelPreferences>
    ): Promise<void> {
        const model = this.models.get(modelId);
        if (!model) throw new Error(`Model ${modelId} not found`);

        model.preferences = { ...model.preferences, ...preferences };
        model.updatedAt = new Date();

        this.emit('model_preferences_updated', { modelId, preferences });
    }

    /**
     * Delete a model
     */
    async deleteModel(modelId: string): Promise<void> {
        const model = this.models.get(modelId);
        if (!model) return;

        // Remove from all projects
        for (const [projectId, associations] of this.projectAssociations) {
            const filtered = associations.filter(a => a.modelId !== modelId);
            this.projectAssociations.set(projectId, filtered);
        }

        this.models.delete(modelId);
        this.trainingQueue.delete(modelId);

        this.emit('model_deleted', { modelId });
    }

    // =========================================================================
    // PROJECT ASSOCIATIONS
    // =========================================================================

    /**
     * Associate a model with a project
     */
    async associateModelWithProject(
        projectId: string,
        modelId: string,
        role: 'primary' | 'secondary' | 'specialized' = 'primary',
        isTraining: boolean = true,
        specialization?: 'code' | 'design' | 'architecture' | 'testing'
    ): Promise<ProjectModelAssociation> {
        const model = this.models.get(modelId);
        if (!model) throw new Error(`Model ${modelId} not found`);

        const association: ProjectModelAssociation = {
            id: `assoc-${uuidv4().slice(0, 8)}`,
            projectId,
            modelId,
            role,
            specialization,
            isTraining,
            addedAt: new Date(),
        };

        const existing = this.projectAssociations.get(projectId) || [];
        existing.push(association);
        this.projectAssociations.set(projectId, existing);

        // Update model metrics
        model.metrics.projectsUsedIn++;
        model.updatedAt = new Date();

        this.emit('model_associated', { projectId, modelId, role });
        return association;
    }

    /**
     * Get models for a project
     */
    async getProjectModels(projectId: string): Promise<{
        model: UserModel;
        association: ProjectModelAssociation;
    }[]> {
        const associations = this.projectAssociations.get(projectId) || [];

        return associations
            .map(assoc => {
                const model = this.models.get(assoc.modelId);
                return model ? { model, association: assoc } : null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }

    /**
     * Remove model from project
     */
    async removeModelFromProject(projectId: string, modelId: string): Promise<void> {
        const associations = this.projectAssociations.get(projectId) || [];
        const filtered = associations.filter(a => a.modelId !== modelId);
        this.projectAssociations.set(projectId, filtered);

        const model = this.models.get(modelId);
        if (model) {
            model.metrics.projectsUsedIn = Math.max(0, model.metrics.projectsUsedIn - 1);
        }

        this.emit('model_removed_from_project', { projectId, modelId });
    }

    // =========================================================================
    // TRAINING DATA COLLECTION
    // =========================================================================

    /**
     * Record a user interaction for training
     */
    async recordInteraction(input: {
        userId: string;
        modelId: string;
        projectId?: string;
        type: TrainingDataPoint['type'];
        context: string;
        input: string;
        output: string;
        userFeedback?: 'accepted' | 'rejected' | 'modified';
        modifiedOutput?: string;
    }): Promise<void> {
        const model = this.models.get(input.modelId);
        if (!model) return;

        const dataPoint: TrainingDataPoint = {
            id: uuidv4(),
            userId: input.userId,
            modelId: input.modelId,
            projectId: input.projectId,
            type: input.type,
            context: input.context,
            input: input.input,
            output: input.output,
            userFeedback: input.userFeedback,
            modifiedOutput: input.modifiedOutput,
            timestamp: new Date(),
        };

        // Add to training queue
        const queue = this.trainingQueue.get(input.modelId) || [];
        queue.push(dataPoint);
        this.trainingQueue.set(input.modelId, queue);

        // Update model metrics
        model.metrics.totalInteractions++;
        if (input.userFeedback === 'accepted') {
            model.metrics.totalSuggestionsAccepted++;
            model.metrics.successfulPredictions++;
        } else if (input.userFeedback === 'rejected') {
            model.metrics.totalSuggestionsRejected++;
        }

        // Recalculate prediction accuracy
        const total = model.metrics.totalSuggestionsAccepted + model.metrics.totalSuggestionsRejected;
        if (total > 0) {
            model.metrics.predictionAccuracy = (model.metrics.totalSuggestionsAccepted / total) * 100;
        }

        model.trainingDataCount = queue.length;
        model.trainingStatus = 'collecting';
        model.updatedAt = new Date();

        // Learn preferences from interaction
        await this.learnFromInteraction(model, dataPoint);

        // Check if ready for training
        if (queue.length >= this.TRAINING_BATCH_SIZE) {
            this.emit('training_ready', { modelId: input.modelId, samples: queue.length });
        }

        this.emit('interaction_recorded', { modelId: input.modelId, type: input.type });
    }

    /**
     * Learn user preferences from an interaction
     */
    private async learnFromInteraction(model: UserModel, data: TrainingDataPoint): Promise<void> {
        // Analyze the interaction to extract preferences
        if (data.type === 'code_generation' || data.type === 'code_edit') {
            const output = data.modifiedOutput || data.output;
            await this.analyzeCodePreferences(model, output);
        }

        if (data.type === 'design_choice') {
            await this.analyzeDesignPreferences(model, data.output);
        }
    }

    /**
     * Analyze code to learn preferences
     */
    private async analyzeCodePreferences(model: UserModel, code: string): Promise<void> {
        // Detect indentation
        if (code.includes('\t')) {
            model.preferences.codeStyle.indentation = 'tabs';
        } else {
            const spaceMatch = code.match(/^( +)/m);
            if (spaceMatch) {
                model.preferences.codeStyle.indentation = 'spaces';
                model.preferences.codeStyle.indentSize = spaceMatch[1].length;
            }
        }

        // Detect naming conventions (simple heuristic)
        if (code.match(/const [a-z][a-zA-Z]+/)) {
            model.preferences.codeStyle.namingConvention = 'camelCase';
        } else if (code.match(/const [a-z_]+/)) {
            model.preferences.codeStyle.namingConvention = 'snake_case';
        }

        // Detect frameworks
        const frameworks = [
            { pattern: /from ['"]react['"]/, name: 'React' },
            { pattern: /from ['"]vue['"]/, name: 'Vue' },
            { pattern: /from ['"]@angular/, name: 'Angular' },
            { pattern: /from ['"]svelte['"]/, name: 'Svelte' },
            { pattern: /from ['"]next/, name: 'Next.js' },
            { pattern: /from ['"]express['"]/, name: 'Express' },
            { pattern: /from ['"]fastify['"]/, name: 'Fastify' },
        ];

        for (const { pattern, name } of frameworks) {
            if (pattern.test(code) && !model.preferences.codeStyle.preferredFrameworks.includes(name)) {
                model.preferences.codeStyle.preferredFrameworks.push(name);
            }
        }
    }

    /**
     * Analyze design choices to learn preferences
     */
    private async analyzeDesignPreferences(model: UserModel, designData: string): Promise<void> {
        // Parse design data and extract preferences
        // This would analyze colors, typography, layouts, etc.
        try {
            const design = JSON.parse(designData);

            if (design.colors) {
                model.preferences.designStyle.colorSchemes = design.colors;
            }
            if (design.fonts) {
                model.preferences.designStyle.typography = design.fonts;
            }
            if (design.layout) {
                model.preferences.designStyle.layoutPreference = design.layout;
            }
        } catch {
            // Not JSON, ignore
        }
    }

    // =========================================================================
    // TRAINING TRIGGER
    // =========================================================================

    /**
     * Trigger training for a model
     */
    async triggerTraining(modelId: string): Promise<{
        status: 'started' | 'insufficient_data' | 'already_training';
        message: string;
    }> {
        const model = this.models.get(modelId);
        if (!model) throw new Error(`Model ${modelId} not found`);

        if (model.trainingStatus === 'training') {
            return { status: 'already_training', message: 'Model is already training' };
        }

        const queue = this.trainingQueue.get(modelId) || [];
        if (queue.length < this.MIN_TRAINING_SAMPLES) {
            return {
                status: 'insufficient_data',
                message: `Need at least ${this.MIN_TRAINING_SAMPLES} samples (have ${queue.length})`,
            };
        }

        model.trainingStatus = 'training';

        // Emit event for training pipeline to pick up
        this.emit('training_triggered', {
            modelId,
            userId: model.userId,
            baseModelId: model.baseModelId,
            trainingData: queue.slice(0, this.TRAINING_BATCH_SIZE),
            preferences: model.preferences,
        });

        return { status: 'started', message: 'Training started' };
    }

    /**
     * Handle training completion
     */
    async onTrainingComplete(modelId: string, result: {
        success: boolean;
        adapterPath?: string;
        evalScore?: number;
        error?: string;
    }): Promise<void> {
        const model = this.models.get(modelId);
        if (!model) return;

        if (result.success && result.adapterPath) {
            model.adapterPath = result.adapterPath;
            model.trainingStatus = 'ready';
            model.lastTrainingDate = new Date();
            model.version++;

            // Clear processed training data
            const queue = this.trainingQueue.get(modelId) || [];
            this.trainingQueue.set(modelId, queue.slice(this.TRAINING_BATCH_SIZE));
            model.trainingDataCount = this.trainingQueue.get(modelId)?.length || 0;
        } else {
            model.trainingStatus = 'idle';
        }

        model.updatedAt = new Date();
        this.emit('training_completed', { modelId, success: result.success });
    }

    // =========================================================================
    // MODEL SUGGESTIONS
    // =========================================================================

    /**
     * Suggest models for a new project
     */
    async suggestModelsForProject(input: {
        userId: string;
        projectType?: string;
        projectDescription?: string;
        technologies?: string[];
    }): Promise<ModelSuggestion[]> {
        const suggestions: ModelSuggestion[] = [];

        // Get user's existing models
        const userModels = await this.getUserModels(input.userId);

        // Always suggest creating a new model
        suggestions.push({
            type: 'create_new',
            name: `${input.projectType || 'Project'} Model`,
            reason: 'Create a new model that learns from your work on this project',
            confidence: 0.8,
        });

        // Suggest existing models that match the project
        for (const model of userModels) {
            const match = this.calculateModelMatch(model, input);
            if (match > 0.5) {
                suggestions.push({
                    type: 'use_existing',
                    modelId: model.id,
                    name: model.name,
                    reason: `This model has learned from ${model.metrics.projectsUsedIn} similar projects`,
                    confidence: match,
                });
            }
        }

        // Sort by confidence
        suggestions.sort((a, b) => b.confidence - a.confidence);

        return suggestions;
    }

    /**
     * Calculate how well a model matches project requirements
     */
    private calculateModelMatch(model: UserModel, input: {
        projectType?: string;
        technologies?: string[];
    }): number {
        let score = 0;
        let factors = 0;

        // Check technology overlap
        if (input.technologies) {
            const modelTech = [
                ...model.preferences.codeStyle.preferredFrameworks,
                ...model.preferences.codeStyle.preferredLibraries,
            ];

            const overlap = input.technologies.filter(t =>
                modelTech.some(mt => mt.toLowerCase().includes(t.toLowerCase()))
            ).length;

            if (input.technologies.length > 0) {
                score += overlap / input.technologies.length;
                factors++;
            }
        }

        // Bonus for model usage/quality
        if (model.metrics.predictionAccuracy > 70) {
            score += 0.3;
            factors++;
        }

        if (model.metrics.projectsUsedIn > 2) {
            score += 0.2;
            factors++;
        }

        return factors > 0 ? score / factors : 0;
    }

    // =========================================================================
    // ASSISTIVE FEATURES
    // =========================================================================

    /**
     * Provide assistive suggestions for inexperienced users
     */
    async getAssistiveSuggestions(modelId: string, context: {
        code: string;
        cursorPosition: number;
        filename: string;
    }): Promise<{
        suggestions: string[];
        explanations: string[];
        skillBoosters: string[];
    }> {
        const model = this.models.get(modelId);
        if (!model) throw new Error(`Model ${modelId} not found`);

        const skillLevel = model.preferences.skillLevel.overall;
        const result = {
            suggestions: [] as string[],
            explanations: [] as string[],
            skillBoosters: [] as string[],
        };

        // For beginners, provide more context and explanation
        if (skillLevel === 'beginner') {
            result.explanations.push('💡 Tip: Consider breaking this function into smaller parts');
            result.skillBoosters.push('📚 Learn more about error handling in TypeScript');
        }

        // For intermediate users, suggest best practices
        if (skillLevel === 'intermediate') {
            result.suggestions.push('Consider using TypeScript strict mode for better type safety');
            result.skillBoosters.push('📚 Explore advanced patterns: Repository, Factory');
        }

        return result;
    }

    /**
     * Update user skill level based on interactions
     */
    async updateSkillLevel(modelId: string): Promise<void> {
        const model = this.models.get(modelId);
        if (!model) return;

        // Analyze recent interactions to gauge skill level
        const queue = this.trainingQueue.get(modelId) || [];
        const recentInteractions = queue.slice(-50);

        let codeComplexityScore = 0;
        let errorPatterns = 0;

        for (const interaction of recentInteractions) {
            // Simple heuristics for skill assessment
            if (interaction.type === 'error_fix') {
                errorPatterns++;
            }
            if (interaction.userFeedback === 'rejected') {
                codeComplexityScore += 0.5; // User knows what they don't want
            }
        }

        // Update skill level based on patterns
        if (errorPatterns < 5 && model.metrics.predictionAccuracy > 80) {
            model.preferences.skillLevel.overall = 'advanced';
        } else if (errorPatterns < 15) {
            model.preferences.skillLevel.overall = 'intermediate';
        } else {
            model.preferences.skillLevel.overall = 'beginner';
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private getDefaultPreferences(): UserModelPreferences {
        return {
            codeStyle: {
                indentation: 'spaces',
                indentSize: 2,
                namingConvention: 'camelCase',
                preferredFrameworks: [],
                preferredLibraries: [],
                commentStyle: 'moderate',
                errorHandlingStyle: 'try-catch',
            },
            designStyle: {
                colorSchemes: [],
                typography: [],
                layoutPreference: 'flex',
                animationLevel: 'subtle',
                componentLibraries: [],
                iconSets: [],
            },
            architecture: {
                fileStructure: 'by-feature',
                stateManagement: [],
                apiStyle: 'REST',
                testingPreference: 'unit',
            },
            skillLevel: {
                overall: 'intermediate',
                frontend: 50,
                backend: 50,
                database: 50,
                devops: 30,
                design: 40,
            },
            customTags: [],
        };
    }

    private getDefaultMetrics(): UserModelMetrics {
        return {
            totalInteractions: 0,
            successfulPredictions: 0,
            predictionAccuracy: 0,
            userSatisfactionScore: 0,
            codeQualityImprovement: 0,
            errorReductionRate: 0,
            averageResponseTime: 0,
            projectsUsedIn: 0,
            totalCodeGenerated: 0,
            totalSuggestionsAccepted: 0,
            totalSuggestionsRejected: 0,
        };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: UserModelManager | null = null;

export function getUserModelManager(): UserModelManager {
    if (!instance) {
        instance = new UserModelManager();
    }
    return instance;
}
