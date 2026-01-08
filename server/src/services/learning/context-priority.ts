/**
 * Context Priority Learning Service
 *
 * Dynamically learns which context is most valuable for specific tasks.
 * Tracks what information leads to successful outcomes and adjusts
 * context retrieval priorities accordingly.
 */

import { db } from '../../db.js';
import { learningRealtimeEvents, learningStrategies, learningContextPriorities } from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Local type definitions for Context Priority
export interface ContextPriorityConfig {
    enablePriority: boolean;
    learningRate: number;
    decayRate: number;
}

export interface ContextWeight {
    contextType: string;
    weight: number;
}

export interface TaskContextProfile {
    taskCategory: string;
    prioritizedContext: string[];
    weights: ContextWeight[];
    lastUpdated: Date;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: ContextPriorityConfig = {
    enablePriority: true,
    learningRate: 0.1,
    decayRate: 0.95,
};

// =============================================================================
// CONTEXT TYPES
// =============================================================================

export type ContextType =
    | 'CODEBASE_STRUCTURE'
    | 'SIMILAR_CODE'
    | 'ERROR_HISTORY'
    | 'DESIGN_PATTERNS'
    | 'DEPENDENCIES'
    | 'USER_PREFERENCES'
    | 'BUILD_HISTORY'
    | 'DOCUMENTATION'
    | 'API_SPECS'
    | 'TEST_COVERAGE';

export const ALL_CONTEXT_TYPES: ContextType[] = [
    'CODEBASE_STRUCTURE',
    'SIMILAR_CODE',
    'ERROR_HISTORY',
    'DESIGN_PATTERNS',
    'DEPENDENCIES',
    'USER_PREFERENCES',
    'BUILD_HISTORY',
    'DOCUMENTATION',
    'API_SPECS',
    'TEST_COVERAGE',
];

// =============================================================================
// TASK CATEGORIES
// =============================================================================

export type TaskCategory =
    | 'FEATURE_IMPLEMENTATION'
    | 'BUG_FIX'
    | 'REFACTORING'
    | 'UI_DESIGN'
    | 'API_INTEGRATION'
    | 'DATABASE_WORK'
    | 'TESTING'
    | 'DOCUMENTATION';

// =============================================================================
// CONTEXT PRIORITY SERVICE
// =============================================================================

export class ContextPriorityService extends EventEmitter {
    private config: ContextPriorityConfig;

    // In-memory weights (loaded from/persisted to DB)
    private weights: Map<string, Map<ContextType, number>> = new Map();

    // Track context usage in current sessions
    private usageTracking: Map<string, {
        taskId: string;
        contextUsed: Set<ContextType>;
        startTime: Date;
    }> = new Map();

    constructor(config?: Partial<ContextPriorityConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeWeights();
    }

    // =========================================================================
    // WEIGHT MANAGEMENT
    // =========================================================================

    /**
     * Initialize default weights for all task categories
     */
    private initializeWeights(): void {
        const defaultWeights: Record<TaskCategory, Record<ContextType, number>> = {
            FEATURE_IMPLEMENTATION: {
                CODEBASE_STRUCTURE: 0.9,
                SIMILAR_CODE: 0.85,
                ERROR_HISTORY: 0.5,
                DESIGN_PATTERNS: 0.7,
                DEPENDENCIES: 0.8,
                USER_PREFERENCES: 0.6,
                BUILD_HISTORY: 0.4,
                DOCUMENTATION: 0.5,
                API_SPECS: 0.75,
                TEST_COVERAGE: 0.5,
            },
            BUG_FIX: {
                CODEBASE_STRUCTURE: 0.7,
                SIMILAR_CODE: 0.6,
                ERROR_HISTORY: 0.95,
                DESIGN_PATTERNS: 0.4,
                DEPENDENCIES: 0.7,
                USER_PREFERENCES: 0.3,
                BUILD_HISTORY: 0.6,
                DOCUMENTATION: 0.4,
                API_SPECS: 0.5,
                TEST_COVERAGE: 0.8,
            },
            REFACTORING: {
                CODEBASE_STRUCTURE: 0.95,
                SIMILAR_CODE: 0.9,
                ERROR_HISTORY: 0.4,
                DESIGN_PATTERNS: 0.9,
                DEPENDENCIES: 0.85,
                USER_PREFERENCES: 0.4,
                BUILD_HISTORY: 0.3,
                DOCUMENTATION: 0.6,
                API_SPECS: 0.5,
                TEST_COVERAGE: 0.85,
            },
            UI_DESIGN: {
                CODEBASE_STRUCTURE: 0.6,
                SIMILAR_CODE: 0.8,
                ERROR_HISTORY: 0.3,
                DESIGN_PATTERNS: 0.95,
                DEPENDENCIES: 0.5,
                USER_PREFERENCES: 0.9,
                BUILD_HISTORY: 0.4,
                DOCUMENTATION: 0.4,
                API_SPECS: 0.3,
                TEST_COVERAGE: 0.4,
            },
            API_INTEGRATION: {
                CODEBASE_STRUCTURE: 0.7,
                SIMILAR_CODE: 0.7,
                ERROR_HISTORY: 0.6,
                DESIGN_PATTERNS: 0.5,
                DEPENDENCIES: 0.9,
                USER_PREFERENCES: 0.3,
                BUILD_HISTORY: 0.5,
                DOCUMENTATION: 0.8,
                API_SPECS: 0.95,
                TEST_COVERAGE: 0.7,
            },
            DATABASE_WORK: {
                CODEBASE_STRUCTURE: 0.8,
                SIMILAR_CODE: 0.7,
                ERROR_HISTORY: 0.6,
                DESIGN_PATTERNS: 0.6,
                DEPENDENCIES: 0.8,
                USER_PREFERENCES: 0.3,
                BUILD_HISTORY: 0.5,
                DOCUMENTATION: 0.7,
                API_SPECS: 0.6,
                TEST_COVERAGE: 0.7,
            },
            TESTING: {
                CODEBASE_STRUCTURE: 0.8,
                SIMILAR_CODE: 0.85,
                ERROR_HISTORY: 0.7,
                DESIGN_PATTERNS: 0.5,
                DEPENDENCIES: 0.6,
                USER_PREFERENCES: 0.4,
                BUILD_HISTORY: 0.6,
                DOCUMENTATION: 0.5,
                API_SPECS: 0.7,
                TEST_COVERAGE: 0.95,
            },
            DOCUMENTATION: {
                CODEBASE_STRUCTURE: 0.9,
                SIMILAR_CODE: 0.6,
                ERROR_HISTORY: 0.3,
                DESIGN_PATTERNS: 0.5,
                DEPENDENCIES: 0.7,
                USER_PREFERENCES: 0.5,
                BUILD_HISTORY: 0.4,
                DOCUMENTATION: 0.95,
                API_SPECS: 0.8,
                TEST_COVERAGE: 0.4,
            },
        };

        for (const [category, contextWeights] of Object.entries(defaultWeights)) {
            const categoryWeights = new Map<ContextType, number>();
            for (const [context, weight] of Object.entries(contextWeights)) {
                categoryWeights.set(context as ContextType, weight);
            }
            this.weights.set(category, categoryWeights);
        }
    }

    /**
     * Get context weights for a task category
     */
    getWeights(taskCategory: TaskCategory): ContextWeight[] {
        const categoryWeights = this.weights.get(taskCategory);
        if (!categoryWeights) {
            return ALL_CONTEXT_TYPES.map(type => ({
                contextType: type,
                weight: 0.5,
            }));
        }

        const weights: ContextWeight[] = [];
        for (const type of ALL_CONTEXT_TYPES) {
            weights.push({
                contextType: type,
                weight: categoryWeights.get(type) || 0.5,
            });
        }

        return weights.sort((a, b) => b.weight - a.weight);
    }

    /**
     * Get prioritized context types for a task
     */
    getPrioritizedContext(
        taskCategory: TaskCategory,
        limit: number = 5
    ): ContextType[] {
        const weights = this.getWeights(taskCategory);
        return weights.slice(0, limit).map(w => w.contextType) as ContextType[];
    }

    // =========================================================================
    // LEARNING FROM OUTCOMES
    // =========================================================================

    /**
     * Start tracking context usage for a task
     */
    startTracking(
        taskId: string,
        buildSessionId: string,
        initialContext: ContextType[]
    ): void {
        this.usageTracking.set(taskId, {
            taskId,
            contextUsed: new Set(initialContext),
            startTime: new Date(),
        });

        this.emit('tracking_started', { taskId, buildSessionId });
    }

    /**
     * Record additional context being used
     */
    recordContextUsage(taskId: string, contextType: ContextType): void {
        const tracking = this.usageTracking.get(taskId);
        if (tracking) {
            tracking.contextUsed.add(contextType);
        }
    }

    /**
     * Record outcome and update weights
     */
    async recordOutcome(
        taskId: string,
        taskCategory: TaskCategory,
        outcome: {
            success: boolean;
            score?: number;
            timeToComplete?: number;
        }
    ): Promise<void> {
        const tracking = this.usageTracking.get(taskId);
        if (!tracking) {
            return;
        }

        const contextUsed = Array.from(tracking.contextUsed);

        // Update weights based on outcome
        await this.updateWeights(taskCategory, contextUsed, outcome);

        // Clean up tracking
        this.usageTracking.delete(taskId);

        this.emit('outcome_recorded', {
            taskId,
            taskCategory,
            outcome,
            contextUsed,
        });
    }

    /**
     * Update weights based on task outcome
     */
    private async updateWeights(
        taskCategory: TaskCategory,
        contextUsed: ContextType[],
        outcome: { success: boolean; score?: number }
    ): Promise<void> {
        const categoryWeights = this.weights.get(taskCategory);
        if (!categoryWeights) {
            return;
        }

        const successMultiplier = outcome.success ? 1 : -1;
        const scoreMultiplier = outcome.score !== undefined ? outcome.score / 100 : 0.5;
        const adjustment = this.config.learningRate * successMultiplier * scoreMultiplier;

        // Increase weights for context that was used
        for (const contextType of contextUsed) {
            const currentWeight = categoryWeights.get(contextType) || 0.5;
            const newWeight = Math.max(0.1, Math.min(1.0, currentWeight + adjustment));
            categoryWeights.set(contextType, newWeight);
        }

        // Apply decay to unused context types (but less aggressively)
        for (const contextType of ALL_CONTEXT_TYPES) {
            if (!contextUsed.includes(contextType)) {
                const currentWeight = categoryWeights.get(contextType) || 0.5;
                const newWeight = currentWeight * this.config.decayRate;
                categoryWeights.set(contextType, Math.max(0.1, newWeight));
            }
        }

        // Persist to database
        await this.persistWeights(taskCategory);
    }

    // =========================================================================
    // TASK PROFILE
    // =========================================================================

    /**
     * Get a context profile for a specific task type
     */
    getTaskProfile(taskCategory: TaskCategory): TaskContextProfile {
        const weights = this.getWeights(taskCategory);

        return {
            taskCategory,
            prioritizedContext: weights.slice(0, 5).map(w => w.contextType),
            weights,
            lastUpdated: new Date(),
        };
    }

    /**
     * Get recommended context retrieval order
     */
    getContextRetrievalOrder(
        taskCategory: TaskCategory,
        tokenBudget: number
    ): Array<{ contextType: ContextType; allocatedTokens: number }> {
        const weights = this.getWeights(taskCategory);
        const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

        const order: Array<{ contextType: ContextType; allocatedTokens: number }> = [];
        let remainingBudget = tokenBudget;

        for (const { contextType, weight } of weights) {
            // Skip very low weight contexts
            if (weight < 0.2) continue;

            const proportionalAllocation = Math.floor(
                (weight / totalWeight) * tokenBudget
            );
            const allocated = Math.min(proportionalAllocation, remainingBudget);

            if (allocated > 100) { // Minimum useful context
                order.push({
                    contextType: contextType as ContextType,
                    allocatedTokens: allocated,
                });
                remainingBudget -= allocated;
            }

            if (remainingBudget < 100) break;
        }

        return order;
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get learning statistics
     */
    async getStats(): Promise<{
        weightsByCategory: Record<TaskCategory, ContextWeight[]>;
        activeTracking: number;
        recentOutcomes: number;
    }> {
        const weightsByCategory: Record<string, ContextWeight[]> = {};

        for (const [category] of this.weights) {
            weightsByCategory[category] = this.getWeights(category as TaskCategory);
        }

        // Count recent outcomes from database
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentEvents = await db.select()
            .from(learningRealtimeEvents)
            .where(
                and(
                    eq(learningRealtimeEvents.eventType, 'verification_passed'),
                    gte(learningRealtimeEvents.createdAt, oneDayAgo.toISOString())
                )
            );

        return {
            weightsByCategory: weightsByCategory as Record<TaskCategory, ContextWeight[]>,
            activeTracking: this.usageTracking.size,
            recentOutcomes: recentEvents.length,
        };
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================

    /**
     * Map TaskCategory to schema's taskType enum
     */
    private mapTaskCategoryToSchemaType(
        taskCategory: TaskCategory
    ): 'code_generation' | 'error_fixing' | 'design' | 'architecture' | 'verification' {
        const mapping: Record<TaskCategory, 'code_generation' | 'error_fixing' | 'design' | 'architecture' | 'verification'> = {
            FEATURE_IMPLEMENTATION: 'code_generation',
            BUG_FIX: 'error_fixing',
            REFACTORING: 'code_generation',
            UI_DESIGN: 'design',
            API_INTEGRATION: 'code_generation',
            DATABASE_WORK: 'architecture',
            TESTING: 'verification',
            DOCUMENTATION: 'code_generation',
        };
        return mapping[taskCategory] || 'code_generation';
    }

    /**
     * Map ContextType to schema's category enum
     */
    private mapContextTypeToSchemaCategory(
        contextType: ContextType
    ): 'intent_contract' | 'current_code' | 'error_message' | 'past_pattern' | 'past_reflexion' | 'past_strategy' | 'file_structure' | 'related_files' | 'user_preference' | 'verification_result' {
        const mapping: Record<ContextType, 'intent_contract' | 'current_code' | 'error_message' | 'past_pattern' | 'past_reflexion' | 'past_strategy' | 'file_structure' | 'related_files' | 'user_preference' | 'verification_result'> = {
            CODEBASE_STRUCTURE: 'file_structure',
            SIMILAR_CODE: 'current_code',
            ERROR_HISTORY: 'error_message',
            DESIGN_PATTERNS: 'past_pattern',
            DEPENDENCIES: 'related_files',
            USER_PREFERENCES: 'user_preference',
            BUILD_HISTORY: 'past_strategy',
            DOCUMENTATION: 'intent_contract',
            API_SPECS: 'related_files',
            TEST_COVERAGE: 'verification_result',
        };
        return mapping[contextType] || 'current_code';
    }

    /**
     * Persist weights to database
     */
    private async persistWeights(taskCategory: TaskCategory): Promise<void> {
        try {
            const categoryWeights = this.weights.get(taskCategory);
            if (!categoryWeights) return;

            const schemaTaskType = this.mapTaskCategoryToSchemaType(taskCategory);

            // Persist each context type weight as a separate row
            for (const [contextType, weight] of categoryWeights) {
                const schemaCategory = this.mapContextTypeToSchemaCategory(contextType);

                // Check if priority already exists for this combination
                const existing = await db.select()
                    .from(learningContextPriorities)
                    .where(
                        and(
                            eq(learningContextPriorities.taskType, schemaTaskType),
                            eq(learningContextPriorities.category, schemaCategory)
                        )
                    )
                    .limit(1);

                if (existing.length > 0) {
                    await db.update(learningContextPriorities)
                        .set({
                            learnedWeight: weight,
                            usageCount: sql`${learningContextPriorities.usageCount} + 1`,
                            updatedAt: new Date().toISOString(),
                        })
                        .where(eq(learningContextPriorities.id, existing[0].id));
                } else {
                    await db.insert(learningContextPriorities).values({
                        priorityId: `cp_${uuidv4()}`,
                        taskType: schemaTaskType,
                        category: schemaCategory,
                        baseWeight: 50,
                        learnedWeight: weight * 100, // Convert 0-1 to 0-100
                        usageCount: 1,
                        successCount: 0,
                        successRate: 0.5,
                    });
                }
            }
        } catch (error) {
            console.error('[ContextPriority] Failed to persist weights:', error);
        }
    }

    /**
     * Load weights from database
     */
    async loadWeights(): Promise<void> {
        try {
            const priorities = await db.select()
                .from(learningContextPriorities);

            // Group by task type
            const taskGroups = new Map<string, Map<ContextType, number>>();

            for (const priority of priorities) {
                // Reverse map from schema task type to TaskCategory
                const taskCategoryMap: Record<string, TaskCategory[]> = {
                    code_generation: ['FEATURE_IMPLEMENTATION', 'REFACTORING', 'API_INTEGRATION', 'DOCUMENTATION'],
                    error_fixing: ['BUG_FIX'],
                    design: ['UI_DESIGN'],
                    architecture: ['DATABASE_WORK'],
                    verification: ['TESTING'],
                };
                const taskCategories = taskCategoryMap[priority.taskType] || ['FEATURE_IMPLEMENTATION'];

                // Reverse map from schema category to ContextType
                const contextTypeMap: Record<string, ContextType> = {
                    file_structure: 'CODEBASE_STRUCTURE',
                    current_code: 'SIMILAR_CODE',
                    error_message: 'ERROR_HISTORY',
                    past_pattern: 'DESIGN_PATTERNS',
                    related_files: 'DEPENDENCIES',
                    user_preference: 'USER_PREFERENCES',
                    past_strategy: 'BUILD_HISTORY',
                    intent_contract: 'DOCUMENTATION',
                    past_reflexion: 'DESIGN_PATTERNS',
                    verification_result: 'TEST_COVERAGE',
                };
                const contextType = contextTypeMap[priority.category] || 'SIMILAR_CODE';

                // Apply to all mapped task categories
                for (const taskCategory of taskCategories) {
                    if (!taskGroups.has(taskCategory)) {
                        taskGroups.set(taskCategory, new Map());
                    }
                    const categoryWeights = taskGroups.get(taskCategory)!;
                    categoryWeights.set(contextType, (priority.learnedWeight || 50) / 100); // Convert 0-100 to 0-1
                }
            }

            // Merge with existing in-memory weights
            for (const [taskCategory, weights] of taskGroups) {
                const existingWeights = this.weights.get(taskCategory);
                if (existingWeights) {
                    for (const [contextType, weight] of weights) {
                        existingWeights.set(contextType, weight);
                    }
                } else {
                    this.weights.set(taskCategory, weights);
                }
            }
        } catch (error) {
            console.error('[ContextPriority] Failed to load weights:', error);
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: ContextPriorityService | null = null;

export async function getContextPriority(
    config?: Partial<ContextPriorityConfig>
): Promise<ContextPriorityService> {
    if (!instance) {
        instance = new ContextPriorityService(config);
        await instance.loadWeights();
    }
    return instance;
}

export function resetContextPriority(): void {
    instance = null;
}
