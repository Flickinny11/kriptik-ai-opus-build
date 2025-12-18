/**
 * Shared Context Pool
 *
 * Provides persistent memory across requests for projects.
 * This enables:
 * 1. Cross-request learning (agents remember previous builds)
 * 2. Intent contract persistence (locked contracts survive sessions)
 * 3. Pattern accumulation (successful patterns are reused)
 * 4. Decision history (avoid repeating mistakes)
 *
 * CRITICAL: This solves the "fresh orchestrator per request" problem
 */

import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { projects, buildIntents, learningDecisionTraces, learningPatterns } from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import type { IntentContract, IntentAppSoul } from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildDecision {
    id: string;
    buildId: string;
    phase: string;
    decision: string;
    alternatives: string[];
    outcome: 'success' | 'failure' | 'partial';
    reasoning: string;
    timestamp: Date;
}

export interface BuildPattern {
    id: string;
    name: string;
    problem: string;
    solution: string;
    successRate: number;
    usageCount: number;
    lastUsed: Date;
}

export interface BuildMemory {
    decisions: BuildDecision[];
    patterns: BuildPattern[];
    errorHistory: Array<{
        error: string;
        fix: string;
        effectiveLevel: number;
        timestamp: Date;
    }>;
    successfulApproaches: Array<{
        task: string;
        approach: string;
        outcome: string;
        timestamp: Date;
    }>;
}

export interface ProjectContext {
    projectId: string;
    userId: string;
    projectName: string;

    // Intent Contract (persisted across sessions)
    intentContract: IntentContract | null;

    // Build history
    buildHistory: Array<{
        buildId: string;
        status: string;
        doneContract: {
            satisfied: boolean;
            criteriaPassRate: number;
            workflowsVerified: number;
            blockers: string[];
        };
        completedAt: Date;
    }>;

    // Cross-request memory
    memory: BuildMemory;

    // Last activity
    lastBuildId: string | null;
    lastBuildStatus: string | null;
    lastBuildCompletedAt: Date | null;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// SHARED CONTEXT POOL
// =============================================================================

export class SharedContextPool extends EventEmitter {
    private contexts: Map<string, ProjectContext> = new Map();
    private persistenceInterval: NodeJS.Timeout | null = null;

    constructor() {
        super();

        // Persist contexts every 30 seconds
        this.persistenceInterval = setInterval(() => {
            this.persistAllContexts().catch(err => {
                console.error('[SharedContextPool] Persistence error:', err);
            });
        }, 30000);

        console.log('[SharedContextPool] Initialized with 30s persistence interval');
    }

    // =========================================================================
    // CONTEXT MANAGEMENT
    // =========================================================================

    /**
     * Load existing context or create new one for a project
     */
    async loadOrCreateContext(projectId: string, userId: string): Promise<ProjectContext> {
        // Check memory cache first
        let context = this.contexts.get(projectId);
        if (context) {
            console.log(`[SharedContextPool] Using cached context for project ${projectId}`);
            return context;
        }

        // Try to load from database
        const loadedContext = await this.loadContextFromDatabase(projectId);
        if (loadedContext) {
            context = loadedContext;
            this.contexts.set(projectId, context);
            console.log(`[SharedContextPool] Loaded context from database for project ${projectId}`);
            return context;
        }

        // Create new context
        context = this.createEmptyContext(projectId, userId);
        this.contexts.set(projectId, context);
        console.log(`[SharedContextPool] Created new context for project ${projectId}`);

        return context;
    }

    /**
     * Get context if it exists
     */
    async getContext(projectId: string): Promise<ProjectContext | null> {
        // Check memory cache
        const cached = this.contexts.get(projectId);
        if (cached) return cached;

        // Try database
        return this.loadContextFromDatabase(projectId);
    }

    /**
     * Update context with partial data
     */
    async updateContext(
        projectId: string,
        updates: Partial<Omit<ProjectContext, 'projectId' | 'userId' | 'createdAt'>>
    ): Promise<ProjectContext> {
        let context = this.contexts.get(projectId);
        if (!context) {
            throw new Error(`Context not found for project: ${projectId}`);
        }

        // Merge updates
        context = {
            ...context,
            ...updates,
            updatedAt: new Date(),
        };

        // Handle array merging for buildHistory
        if (updates.buildHistory && context.buildHistory) {
            context.buildHistory = [
                ...context.buildHistory,
                ...updates.buildHistory,
            ].slice(-50); // Keep last 50 builds
        }

        this.contexts.set(projectId, context);
        this.emit('context_updated', { projectId, updates });

        return context;
    }

    // =========================================================================
    // MEMORY MANAGEMENT
    // =========================================================================

    /**
     * Record a build decision for learning
     */
    async recordDecision(
        projectId: string,
        decision: Omit<BuildDecision, 'id' | 'timestamp'>
    ): Promise<void> {
        const context = this.contexts.get(projectId);
        if (!context) return;

        const fullDecision: BuildDecision = {
            ...decision,
            id: `dec_${Date.now()}`,
            timestamp: new Date(),
        };

        context.memory.decisions.push(fullDecision);

        // Keep last 100 decisions
        if (context.memory.decisions.length > 100) {
            context.memory.decisions = context.memory.decisions.slice(-100);
        }

        context.updatedAt = new Date();
    }

    /**
     * Record a successful pattern for reuse
     */
    async recordPattern(
        projectId: string,
        pattern: Omit<BuildPattern, 'id' | 'usageCount' | 'lastUsed'>
    ): Promise<void> {
        const context = this.contexts.get(projectId);
        if (!context) return;

        // Check if pattern already exists
        const existing = context.memory.patterns.find(p => p.name === pattern.name);
        if (existing) {
            existing.usageCount++;
            existing.successRate = (existing.successRate * (existing.usageCount - 1) + pattern.successRate) / existing.usageCount;
            existing.lastUsed = new Date();
        } else {
            const fullPattern: BuildPattern = {
                ...pattern,
                id: `pat_${Date.now()}`,
                usageCount: 1,
                lastUsed: new Date(),
            };
            context.memory.patterns.push(fullPattern);
        }

        // Keep top 50 patterns by success rate
        context.memory.patterns.sort((a, b) => b.successRate - a.successRate);
        if (context.memory.patterns.length > 50) {
            context.memory.patterns = context.memory.patterns.slice(0, 50);
        }

        context.updatedAt = new Date();
    }

    /**
     * Record error and its fix for future reference
     */
    async recordErrorFix(
        projectId: string,
        error: string,
        fix: string,
        effectiveLevel: number
    ): Promise<void> {
        const context = this.contexts.get(projectId);
        if (!context) return;

        context.memory.errorHistory.push({
            error,
            fix,
            effectiveLevel,
            timestamp: new Date(),
        });

        // Keep last 100 errors
        if (context.memory.errorHistory.length > 100) {
            context.memory.errorHistory = context.memory.errorHistory.slice(-100);
        }

        context.updatedAt = new Date();
    }

    /**
     * Record a successful approach for a task type
     */
    async recordSuccessfulApproach(
        projectId: string,
        task: string,
        approach: string,
        outcome: string
    ): Promise<void> {
        const context = this.contexts.get(projectId);
        if (!context) return;

        context.memory.successfulApproaches.push({
            task,
            approach,
            outcome,
            timestamp: new Date(),
        });

        // Keep last 100 approaches
        if (context.memory.successfulApproaches.length > 100) {
            context.memory.successfulApproaches = context.memory.successfulApproaches.slice(-100);
        }

        context.updatedAt = new Date();
    }

    /**
     * Get relevant patterns for a task
     */
    getRelevantPatterns(projectId: string, taskDescription: string): BuildPattern[] {
        const context = this.contexts.get(projectId);
        if (!context) return [];

        const keywords = taskDescription.toLowerCase().split(/\s+/);

        return context.memory.patterns
            .filter(pattern => {
                const patternText = `${pattern.name} ${pattern.problem} ${pattern.solution}`.toLowerCase();
                return keywords.some(kw => kw.length > 3 && patternText.includes(kw));
            })
            .slice(0, 5);
    }

    /**
     * Get similar past decisions for a situation
     */
    getSimilarDecisions(projectId: string, phase: string, decision: string): BuildDecision[] {
        const context = this.contexts.get(projectId);
        if (!context) return [];

        return context.memory.decisions
            .filter(d => d.phase === phase)
            .slice(-10);
    }

    /**
     * Get fix history for an error type
     */
    getErrorFixHistory(projectId: string, errorPattern: string): Array<{
        error: string;
        fix: string;
        effectiveLevel: number;
    }> {
        const context = this.contexts.get(projectId);
        if (!context) return [];

        return context.memory.errorHistory
            .filter(h => h.error.toLowerCase().includes(errorPattern.toLowerCase()))
            .slice(-5);
    }

    // =========================================================================
    // DATABASE OPERATIONS
    // =========================================================================

    /**
     * Parse success criteria from database format to IntentContract format
     */
    private parseSuccessCriteria(criteria: string[]): IntentContract['successCriteria'] {
        if (!Array.isArray(criteria)) return [];
        return criteria.map((c, i) => ({
            id: `sc_${i}`,
            description: typeof c === 'string' ? c : String(c),
            verificationMethod: 'functional' as const,
            passed: false,
        }));
    }

    /**
     * Parse user workflows from database format to IntentContract format
     */
    private parseUserWorkflows(workflows: Record<string, string>): IntentContract['userWorkflows'] {
        if (!workflows || typeof workflows !== 'object') return [];
        return Object.entries(workflows).map(([name, description]) => ({
            name,
            steps: [description],
            success: 'User completes workflow successfully',
            verified: false,
        }));
    }

    private async loadContextFromDatabase(projectId: string): Promise<ProjectContext | null> {
        try {
            // Load project info
            const projectRecords = await db.select()
                .from(projects)
                .where(eq(projects.id, projectId))
                .limit(1);

            if (projectRecords.length === 0) return null;

            const project = projectRecords[0];

            // Load latest intent contract
            const intentRecords = await db.select()
                .from(buildIntents)
                .where(eq(buildIntents.projectId, projectId))
                .orderBy(desc(buildIntents.createdAt))
                .limit(1);

            let intentContract: IntentContract | null = null;
            if (intentRecords.length > 0) {
                const intent = intentRecords[0];
                // Map database fields to IntentContract type
                const visualId = intent.visualIdentity as Record<string, string> || {};
                intentContract = {
                    id: intent.id,
                    originalPrompt: intent.originalPrompt,
                    userId: intent.userId,
                    projectId: intent.projectId,
                    orchestrationRunId: intent.orchestrationRunId || undefined,
                    appType: intent.appType,
                    appSoul: intent.appSoul as IntentAppSoul,
                    coreValueProp: intent.coreValueProp,
                    successCriteria: this.parseSuccessCriteria(intent.successCriteria as string[]),
                    userWorkflows: this.parseUserWorkflows(intent.userWorkflows as Record<string, string>),
                    visualIdentity: {
                        soul: (visualId.soul || 'utility') as IntentAppSoul,
                        primaryEmotion: visualId.primaryEmotion || visualId.emotion || '',
                        depthLevel: (visualId.depthLevel || visualId.depth || 'medium') as 'low' | 'medium' | 'high',
                        motionPhilosophy: visualId.motionPhilosophy || visualId.motion || '',
                    },
                    antiPatterns: (intent.antiPatterns as string[]) || [],
                    locked: intent.locked,
                    generatedBy: intent.generatedBy || 'claude-opus-4.5',
                    thinkingTokensUsed: intent.thinkingTokensUsed || 0,
                    createdAt: intent.createdAt || new Date().toISOString(),
                    lockedAt: intent.lockedAt || undefined,
                };
            }

            // Load learned patterns for memory
            const patternRecords = await db.select()
                .from(learningPatterns)
                .limit(50);

            const patterns: BuildPattern[] = patternRecords.map(p => ({
                id: p.id,
                name: p.name,
                problem: p.problem,
                solution: p.solutionTemplate || '',
                successRate: p.successRate || 0,
                usageCount: p.usageCount || 0,
                lastUsed: p.updatedAt ? new Date(p.updatedAt) : new Date(),
            }));

            // Load recent decision traces for memory
            const decisionRecords = await db.select()
                .from(learningDecisionTraces)
                .where(eq(learningDecisionTraces.projectId, projectId))
                .orderBy(desc(learningDecisionTraces.createdAt))
                .limit(100);

            const decisions: BuildDecision[] = decisionRecords.map(d => {
                const decisionData = d.decision as Record<string, unknown> || {};
                const outcomeData = d.outcome as Record<string, unknown> || {};
                return {
                    id: d.id,
                    buildId: d.buildId || '',
                    phase: d.phase || 'unknown',
                    decision: (decisionData.chosenOption as string) || '',
                    alternatives: (decisionData.rejectedOptions as string[]) || [],
                    outcome: (outcomeData.immediateResult as 'success' | 'failure' | 'partial') || 'partial',
                    reasoning: (decisionData.reasoning as string) || '',
                    timestamp: d.createdAt ? new Date(d.createdAt) : new Date(),
                };
            });

            return {
                projectId,
                userId: project.ownerId,
                projectName: project.name,
                intentContract,
                buildHistory: [],
                memory: {
                    decisions,
                    patterns,
                    errorHistory: [],
                    successfulApproaches: [],
                },
                lastBuildId: null,
                lastBuildStatus: null,
                lastBuildCompletedAt: null,
                createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
                updatedAt: new Date(),
            };

        } catch (error) {
            console.error('[SharedContextPool] Failed to load context from database:', error);
            return null;
        }
    }

    private createEmptyContext(projectId: string, userId: string): ProjectContext {
        return {
            projectId,
            userId,
            projectName: `Project ${projectId.slice(0, 8)}`,
            intentContract: null,
            buildHistory: [],
            memory: {
                decisions: [],
                patterns: [],
                errorHistory: [],
                successfulApproaches: [],
            },
            lastBuildId: null,
            lastBuildStatus: null,
            lastBuildCompletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    private async persistAllContexts(): Promise<void> {
        const contextsToSave = Array.from(this.contexts.values())
            .filter(c => c.updatedAt > new Date(Date.now() - 60000)); // Only save recently updated

        for (const context of contextsToSave) {
            try {
                // Persist patterns to database using learningPatterns table
                for (const pattern of context.memory.patterns) {
                    const patternId = `pat_${context.projectId}_${pattern.name.replace(/\s+/g, '_').toLowerCase()}`;
                    await db.insert(learningPatterns)
                        .values({
                            id: pattern.id,
                            patternId,
                            category: 'code',
                            name: pattern.name,
                            problem: pattern.problem,
                            solutionTemplate: pattern.solution,
                            conditions: [],
                            antiConditions: [],
                            codeTemplate: null,
                            embedding: null,
                            usageCount: pattern.usageCount,
                            successRate: Math.round(pattern.successRate),
                            sourceTraceId: null,
                            createdAt: new Date().toISOString(),
                            updatedAt: pattern.lastUsed.toISOString(),
                        })
                        .onConflictDoUpdate({
                            target: learningPatterns.id,
                            set: {
                                successRate: Math.round(pattern.successRate),
                                usageCount: pattern.usageCount,
                                updatedAt: pattern.lastUsed.toISOString(),
                            },
                        });
                }

                console.log(`[SharedContextPool] Persisted context for project ${context.projectId}`);
            } catch (error) {
                console.error(`[SharedContextPool] Failed to persist context for ${context.projectId}:`, error);
            }
        }
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================

    /**
     * Clear context from memory (but not database)
     */
    clearContext(projectId: string): void {
        this.contexts.delete(projectId);
    }

    /**
     * Clear all contexts from memory
     */
    clearAllContexts(): void {
        this.contexts.clear();
    }

    /**
     * Stop the persistence interval
     */
    stop(): void {
        if (this.persistenceInterval) {
            clearInterval(this.persistenceInterval);
            this.persistenceInterval = null;
        }
    }

    // =========================================================================
    // STATS
    // =========================================================================

    getStats(): {
        cachedContexts: number;
        totalDecisions: number;
        totalPatterns: number;
    } {
        let totalDecisions = 0;
        let totalPatterns = 0;

        for (const context of this.contexts.values()) {
            totalDecisions += context.memory.decisions.length;
            totalPatterns += context.memory.patterns.length;
        }

        return {
            cachedContexts: this.contexts.size,
            totalDecisions,
            totalPatterns,
        };
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let sharedContextPoolInstance: SharedContextPool | null = null;

export function getSharedContextPool(): SharedContextPool {
    if (!sharedContextPoolInstance) {
        sharedContextPoolInstance = new SharedContextPool();
    }
    return sharedContextPoolInstance;
}

export function createSharedContextPool(): SharedContextPool {
    return new SharedContextPool();
}
