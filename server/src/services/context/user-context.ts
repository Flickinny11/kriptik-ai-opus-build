/**
 * User Context Memory Service
 *
 * Provides persistent, user-specific AI context that remembers preferences,
 * past decisions, and project history across sessions and projects.
 */

import { createHash } from 'crypto';
import { db } from '../../db';
import { userContextMemories } from '../../schema';
import { eq, and, isNull } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface UserContextMemory {
    userId: string;
    projectId?: string;

    // Preferences learned from interactions
    preferences: UserPreferences;

    // Past decisions and their outcomes
    decisions: DecisionRecord[];

    // Code patterns the user prefers
    codePatterns: CodePattern[];

    // Feedback on AI suggestions
    feedback: FeedbackRecord[];

    // Session continuity
    sessionHistory: SessionSnapshot[];

    // Context sharing settings
    sharing: ContextSharingSettings;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    totalInteractions: number;
}

export interface UserPreferences {
    // UI/UX preferences
    preferredFrameworks: string[];
    preferredUILibraries: string[];
    preferredLanguages: string[];

    // Code style preferences
    codeStyle: {
        indentation: 'tabs' | 'spaces';
        tabSize: number;
        semicolons: boolean;
        singleQuotes: boolean;
        trailingCommas: 'none' | 'es5' | 'all';
        maxLineLength: number;
    };

    // AI interaction preferences
    aiPreferences: {
        verbosity: 'concise' | 'detailed' | 'verbose';
        explanationStyle: 'minimal' | 'step-by-step' | 'educational';
        codeCommentLevel: 'none' | 'minimal' | 'normal' | 'verbose';
        autoApplyFixes: boolean;
        confirmDeployments: boolean;
        showAlternatives: boolean;
    };

    // Learned patterns
    commonImports: string[];
    preferredNamingConventions: Record<string, string>;
    commonPatterns: string[];
}

export interface DecisionRecord {
    id: string;
    timestamp: Date;
    context: string;
    options: string[];
    chosenOption: string;
    outcome: 'success' | 'failure' | 'neutral';
    feedback?: string;
    relatedFiles: string[];
}

export interface CodePattern {
    id: string;
    pattern: string;
    frequency: number;
    lastUsed: Date;
    context: string;
    category: 'component' | 'hook' | 'utility' | 'api' | 'style' | 'other';
}

export interface FeedbackRecord {
    id: string;
    timestamp: Date;
    suggestionId: string;
    suggestionType: 'code' | 'fix' | 'explanation' | 'template';
    rating: 'positive' | 'negative' | 'neutral';
    comment?: string;
    appliedChanges: boolean;
}

export interface SessionSnapshot {
    id: string;
    timestamp: Date;
    projectId?: string;
    summary: string;
    keyDecisions: string[];
    filesModified: string[];
    contextCheckpoint: string;
    tokensUsed: number;
}

export interface ContextSharingSettings {
    shareAcrossProjects: boolean;
    sharePreferences: boolean;
    sharePatterns: boolean;
    shareHistory: boolean;
    enabledProjects: string[];  // Empty = all projects
    excludedProjects: string[];
}

// ============================================================================
// USER CONTEXT SERVICE
// ============================================================================

export class UserContextService {
    private contextCache: Map<string, UserContextMemory> = new Map();
    private readonly MAX_DECISIONS = 100;
    private readonly MAX_PATTERNS = 50;
    private readonly MAX_FEEDBACK = 200;
    private readonly MAX_SESSIONS = 20;

    /**
     * Get or create user context
     */
    async getContext(userId: string, projectId?: string): Promise<UserContextMemory> {
        const cacheKey = this.getCacheKey(userId, projectId);

        // Check cache first
        const cached = this.contextCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Try to load from database
        let context = await this.loadFromDatabase(userId, projectId);

        if (!context) {
            // Create new context
            context = this.createDefaultContext(userId, projectId);
            await this.saveToDatabase(context);
        }

        this.contextCache.set(cacheKey, context);
        return context;
    }

    /**
     * Update user preferences
     */
    async updatePreferences(
        userId: string,
        updates: Partial<UserPreferences>,
        projectId?: string
    ): Promise<void> {
        const context = await this.getContext(userId, projectId);

        context.preferences = {
            ...context.preferences,
            ...updates,
            codeStyle: {
                ...context.preferences.codeStyle,
                ...(updates.codeStyle || {}),
            },
            aiPreferences: {
                ...context.preferences.aiPreferences,
                ...(updates.aiPreferences || {}),
            },
        };

        context.updatedAt = new Date();
        await this.saveToDatabase(context);
        this.contextCache.set(this.getCacheKey(userId, projectId), context);
    }

    /**
     * Record a decision
     */
    async recordDecision(
        userId: string,
        decision: Omit<DecisionRecord, 'id' | 'timestamp'>,
        projectId?: string
    ): Promise<void> {
        const context = await this.getContext(userId, projectId);

        const record: DecisionRecord = {
            id: this.generateId(),
            timestamp: new Date(),
            ...decision,
        };

        context.decisions.unshift(record);

        // Keep only recent decisions
        if (context.decisions.length > this.MAX_DECISIONS) {
            context.decisions = context.decisions.slice(0, this.MAX_DECISIONS);
        }

        context.totalInteractions++;
        context.updatedAt = new Date();

        await this.saveToDatabase(context);
        this.contextCache.set(this.getCacheKey(userId, projectId), context);
    }

    /**
     * Learn from code patterns
     */
    async learnPattern(
        userId: string,
        pattern: string,
        category: CodePattern['category'],
        context: string,
        projectId?: string
    ): Promise<void> {
        const userContext = await this.getContext(userId, projectId);

        // Check if pattern already exists
        const existing = userContext.codePatterns.find(
            p => this.hashPattern(p.pattern) === this.hashPattern(pattern)
        );

        if (existing) {
            existing.frequency++;
            existing.lastUsed = new Date();
        } else {
            userContext.codePatterns.push({
                id: this.generateId(),
                pattern,
                frequency: 1,
                lastUsed: new Date(),
                context,
                category,
            });
        }

        // Sort by frequency and trim
        userContext.codePatterns.sort((a, b) => b.frequency - a.frequency);
        if (userContext.codePatterns.length > this.MAX_PATTERNS) {
            userContext.codePatterns = userContext.codePatterns.slice(0, this.MAX_PATTERNS);
        }

        userContext.updatedAt = new Date();
        await this.saveToDatabase(userContext);
        this.contextCache.set(this.getCacheKey(userId, projectId), userContext);
    }

    /**
     * Record feedback on AI suggestions
     */
    async recordFeedback(
        userId: string,
        feedback: Omit<FeedbackRecord, 'id' | 'timestamp'>,
        projectId?: string
    ): Promise<void> {
        const context = await this.getContext(userId, projectId);

        const record: FeedbackRecord = {
            id: this.generateId(),
            timestamp: new Date(),
            ...feedback,
        };

        context.feedback.unshift(record);

        if (context.feedback.length > this.MAX_FEEDBACK) {
            context.feedback = context.feedback.slice(0, this.MAX_FEEDBACK);
        }

        // Update preferences based on feedback
        if (feedback.rating === 'positive' && feedback.appliedChanges) {
            // This was a good suggestion - might want to learn from it
            context.totalInteractions++;
        }

        context.updatedAt = new Date();
        await this.saveToDatabase(context);
        this.contextCache.set(this.getCacheKey(userId, projectId), context);
    }

    /**
     * Save session snapshot for continuity
     */
    async saveSessionSnapshot(
        userId: string,
        snapshot: Omit<SessionSnapshot, 'id' | 'timestamp'>,
        projectId?: string
    ): Promise<void> {
        const context = await this.getContext(userId, projectId);

        const record: SessionSnapshot = {
            id: this.generateId(),
            timestamp: new Date(),
            ...snapshot,
        };

        context.sessionHistory.unshift(record);

        if (context.sessionHistory.length > this.MAX_SESSIONS) {
            context.sessionHistory = context.sessionHistory.slice(0, this.MAX_SESSIONS);
        }

        context.updatedAt = new Date();
        await this.saveToDatabase(context);
        this.contextCache.set(this.getCacheKey(userId, projectId), context);
    }

    /**
     * Get context for AI prompting
     */
    async getContextForPrompt(userId: string, projectId?: string): Promise<string> {
        const context = await this.getContext(userId, projectId);

        const parts: string[] = [];

        // Add preferences
        if (context.preferences.preferredFrameworks.length > 0) {
            parts.push(`Preferred frameworks: ${context.preferences.preferredFrameworks.join(', ')}`);
        }

        if (context.preferences.preferredUILibraries.length > 0) {
            parts.push(`Preferred UI libraries: ${context.preferences.preferredUILibraries.join(', ')}`);
        }

        // Add code style
        const { codeStyle } = context.preferences;
        parts.push(`Code style: ${codeStyle.indentation} (${codeStyle.tabSize}), ${codeStyle.singleQuotes ? 'single' : 'double'} quotes, ${codeStyle.semicolons ? 'with' : 'no'} semicolons`);

        // Add AI preferences
        const { aiPreferences } = context.preferences;
        parts.push(`Explanation style: ${aiPreferences.explanationStyle}`);
        parts.push(`Code comments: ${aiPreferences.codeCommentLevel}`);

        // Add recent patterns
        const recentPatterns = context.codePatterns.slice(0, 5);
        if (recentPatterns.length > 0) {
            parts.push(`Common patterns user prefers:`);
            for (const p of recentPatterns) {
                parts.push(`- ${p.category}: ${p.context}`);
            }
        }

        // Add recent session context if available
        const lastSession = context.sessionHistory[0];
        if (lastSession) {
            parts.push(`Last session summary: ${lastSession.summary}`);
            if (lastSession.keyDecisions.length > 0) {
                parts.push(`Recent decisions: ${lastSession.keyDecisions.join('; ')}`);
            }
        }

        return parts.join('\n');
    }

    /**
     * Merge context from another project
     */
    async mergeContext(
        userId: string,
        sourceProjectId: string,
        targetProjectId: string
    ): Promise<void> {
        const sourceContext = await this.getContext(userId, sourceProjectId);
        const targetContext = await this.getContext(userId, targetProjectId);

        if (!targetContext.sharing.shareAcrossProjects) {
            return;
        }

        // Merge preferences (target takes priority)
        if (sourceContext.sharing.sharePreferences) {
            targetContext.preferences.preferredFrameworks = [
                ...new Set([
                    ...sourceContext.preferences.preferredFrameworks,
                    ...targetContext.preferences.preferredFrameworks,
                ]),
            ];
            targetContext.preferences.preferredUILibraries = [
                ...new Set([
                    ...sourceContext.preferences.preferredUILibraries,
                    ...targetContext.preferences.preferredUILibraries,
                ]),
            ];
        }

        // Merge patterns
        if (sourceContext.sharing.sharePatterns) {
            for (const pattern of sourceContext.codePatterns) {
                const existing = targetContext.codePatterns.find(
                    p => this.hashPattern(p.pattern) === this.hashPattern(pattern.pattern)
                );
                if (!existing) {
                    targetContext.codePatterns.push({ ...pattern, id: this.generateId() });
                }
            }
        }

        targetContext.updatedAt = new Date();
        await this.saveToDatabase(targetContext);
        this.contextCache.set(this.getCacheKey(userId, targetProjectId), targetContext);
    }

    /**
     * Update sharing settings
     */
    async updateSharingSettings(
        userId: string,
        settings: Partial<ContextSharingSettings>,
        projectId?: string
    ): Promise<void> {
        const context = await this.getContext(userId, projectId);
        context.sharing = { ...context.sharing, ...settings };
        context.updatedAt = new Date();
        await this.saveToDatabase(context);
        this.contextCache.set(this.getCacheKey(userId, projectId), context);
    }

    /**
     * Clear user context
     */
    async clearContext(userId: string, projectId?: string): Promise<void> {
        const context = this.createDefaultContext(userId, projectId);
        await this.saveToDatabase(context);
        this.contextCache.set(this.getCacheKey(userId, projectId), context);
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private getCacheKey(userId: string, projectId?: string): string {
        return projectId ? `${userId}:${projectId}` : userId;
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    private hashPattern(pattern: string): string {
        return createHash('md5').update(pattern).digest('hex').substring(0, 8);
    }

    private createDefaultContext(userId: string, projectId?: string): UserContextMemory {
        return {
            userId,
            projectId,
            preferences: {
                preferredFrameworks: [],
                preferredUILibraries: [],
                preferredLanguages: ['typescript'],
                codeStyle: {
                    indentation: 'spaces',
                    tabSize: 2,
                    semicolons: true,
                    singleQuotes: true,
                    trailingCommas: 'es5',
                    maxLineLength: 100,
                },
                aiPreferences: {
                    verbosity: 'detailed',
                    explanationStyle: 'step-by-step',
                    codeCommentLevel: 'normal',
                    autoApplyFixes: false,
                    confirmDeployments: true,
                    showAlternatives: true,
                },
                commonImports: [],
                preferredNamingConventions: {},
                commonPatterns: [],
            },
            decisions: [],
            codePatterns: [],
            feedback: [],
            sessionHistory: [],
            sharing: {
                shareAcrossProjects: true,
                sharePreferences: true,
                sharePatterns: true,
                shareHistory: false,
                enabledProjects: [],
                excludedProjects: [],
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            totalInteractions: 0,
        };
    }

    private async loadFromDatabase(
        userId: string,
        projectId?: string
    ): Promise<UserContextMemory | null> {
        try {
            const conditions = projectId
                ? and(eq(userContextMemories.userId, userId), eq(userContextMemories.projectId, projectId))
                : and(eq(userContextMemories.userId, userId), isNull(userContextMemories.projectId));

            const [result] = await db.select()
                .from(userContextMemories)
                .where(conditions)
                .limit(1);

            if (result) {
                return result.data as UserContextMemory;
            }
        } catch (error) {
            console.warn('Failed to load user context from database:', error);
        }
        return null;
    }

    private async saveToDatabase(context: UserContextMemory): Promise<void> {
        try {
            const conditions = context.projectId
                ? and(eq(userContextMemories.userId, context.userId), eq(userContextMemories.projectId, context.projectId))
                : and(eq(userContextMemories.userId, context.userId), isNull(userContextMemories.projectId));

            const [existing] = await db.select()
                .from(userContextMemories)
                .where(conditions)
                .limit(1);

            if (existing) {
                await db.update(userContextMemories)
                    .set({
                        data: context,
                        updatedAt: new Date().toISOString()
                    })
                    .where(eq(userContextMemories.id, existing.id));
            } else {
                await db.insert(userContextMemories).values({
                    userId: context.userId,
                    projectId: context.projectId,
                    data: context,
                });
            }
        } catch (error) {
            console.warn('Failed to save user context to database:', error);
        }
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: UserContextService | null = null;

export function getUserContextService(): UserContextService {
    if (!instance) {
        instance = new UserContextService();
    }
    return instance;
}

