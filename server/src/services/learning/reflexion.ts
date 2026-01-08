/**
 * Reflexion-Based Learning Service
 *
 * Implements self-reflection after failures, generating structured notes
 * that are stored and retrieved to improve future attempts.
 *
 * Based on Reflexion: an autonomous agent with dynamic memory and self-reflection
 * Shinn et al., 2023 - Extended for AI code generation.
 */

import { db } from '../../db.js';
import { learningReflexionNotes, learningErrorRecoveries } from '../../schema.js';
import { eq, desc, sql, and, like } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';

// =============================================================================
// LOCAL TYPES
// =============================================================================

export interface ReflexionConfig {
    reflectionModel: string;
    maxNotesToRetrieve: number;
}

export interface ReflexionNote {
    reflexionId: string;
    buildId?: string;
    agentId?: string;
    phase: string;
    failureDescription: string;
    errorType?: string;
    errorMessage?: string;
    rootCauseAnalysis: string;
    whatWentWrong?: string;
    whatShouldHaveDone?: string;
    lessonLearned: string;
    suggestedApproach: string;
    codePatternToAvoid?: string;
    codePatternToUse?: string;
    effectiveness?: number;
    timesRetrieved: number;
    timesApplied: number;
    createdAt: Date;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: ReflexionConfig = {
    reflectionModel: 'claude-sonnet-4-20250514',
    maxNotesToRetrieve: 10,
};

// =============================================================================
// REFLECTION PROMPTS
// =============================================================================

const FAILURE_REFLECTION_PROMPT = `You are a learning AI assistant analyzing a failed attempt to help improve future performance.

FAILED TASK DESCRIPTION:
{{TASK}}

FAILED ATTEMPT:
{{ATTEMPT}}

ERROR/FAILURE REASON:
{{ERROR}}

SUCCESSFUL RESOLUTION (if available):
{{RESOLUTION}}

Generate a structured reflection note that will help avoid this mistake in the future.

RESPOND WITH JSON ONLY:
{
    "errorType": "CODE_ERROR" | "DESIGN_ERROR" | "ARCHITECTURE_ERROR" | "LOGIC_ERROR" | "API_ERROR" | "OTHER",
    "rootCauseAnalysis": "<deep analysis of why this failed>",
    "whatWentWrong": "<specific description of the mistake>",
    "whatShouldHaveDone": "<what should have been done instead>",
    "lessonLearned": "<key takeaway for future>",
    "suggestedApproach": "<recommended approach for similar situations>",
    "codePatternToAvoid": "<optional: specific code pattern that caused the issue>",
    "codePatternToUse": "<optional: better code pattern to use>"
}`;

// =============================================================================
// REFLEXION SERVICE
// =============================================================================

export class ReflexionService extends EventEmitter {
    private config: ReflexionConfig;
    private anthropic: ReturnType<typeof createAnthropicClient>;

    constructor(config?: Partial<ReflexionConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.anthropic = createAnthropicClient();
    }

    // =========================================================================
    // REFLECTION GENERATION
    // =========================================================================

    /**
     * Generate reflection from a failure/error recovery
     */
    async reflectOnFailure(
        task: string,
        failedAttempt: string,
        error: string,
        resolution?: string,
        context?: { buildId?: string; agentId?: string; phase?: string }
    ): Promise<ReflexionNote> {
        const reflexionId = `ref_${uuidv4()}`;

        const prompt = FAILURE_REFLECTION_PROMPT
            .replace('{{TASK}}', task)
            .replace('{{ATTEMPT}}', failedAttempt.slice(0, 10000))
            .replace('{{ERROR}}', error)
            .replace('{{RESOLUTION}}', resolution || 'No resolution available yet');

        try {
            if (!this.anthropic) {
                throw new Error('Anthropic client not initialized');
            }

            const response = await this.anthropic.messages.create({
                model: this.config.reflectionModel,
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (!content || content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            const parsed = this.parseReflectionResponse(content.text);

            const note: ReflexionNote = {
                reflexionId,
                buildId: context?.buildId,
                agentId: context?.agentId,
                phase: context?.phase || 'unknown',
                failureDescription: task,
                errorType: parsed.errorType,
                errorMessage: error.slice(0, 5000),
                rootCauseAnalysis: parsed.rootCauseAnalysis,
                whatWentWrong: parsed.whatWentWrong,
                whatShouldHaveDone: parsed.whatShouldHaveDone,
                lessonLearned: parsed.lessonLearned,
                suggestedApproach: parsed.suggestedApproach,
                codePatternToAvoid: parsed.codePatternToAvoid,
                codePatternToUse: parsed.codePatternToUse,
                effectiveness: undefined,
                timesRetrieved: 0,
                timesApplied: 0,
                createdAt: new Date(),
            };

            await this.persistNote(note);

            this.emit('reflection_created', {
                reflexionId,
                errorType: parsed.errorType,
                phase: context?.phase,
            });

            return note;
        } catch (error) {
            console.error('[Reflexion] Failed to generate failure reflection:', error);
            throw error;
        }
    }

    /**
     * Auto-reflect on recent error recoveries
     */
    async reflectOnRecentErrors(limit: number = 10): Promise<ReflexionNote[]> {
        // Get recent error recovery traces that haven't been reflected on
        const recentErrors = await db.select()
            .from(learningErrorRecoveries)
            .orderBy(desc(learningErrorRecoveries.createdAt))
            .limit(limit);

        const reflections: ReflexionNote[] = [];

        for (const errorTrace of recentErrors) {
            // Extract error info from nested JSON structure
            const errorInfo = errorTrace.error;
            const errorType = errorInfo?.type || 'UNKNOWN';
            const errorMessage = errorInfo?.message || 'Unknown error';
            const recoveryJourney = errorTrace.recoveryJourney || [];
            const successfulFix = errorTrace.successfulFix;

            // Check if we already have a reflection for this error
            const existing = await db.select()
                .from(learningReflexionNotes)
                .where(like(learningReflexionNotes.errorMessage, `%${errorType}%`))
                .limit(1);

            if (existing.length > 0) {
                continue; // Already reflected
            }

            try {
                const note = await this.reflectOnFailure(
                    `Error during build: ${errorType}`,
                    JSON.stringify(recoveryJourney, null, 2),
                    errorMessage,
                    successfulFix?.fixDescription,
                    { buildId: errorTrace.buildId || undefined, phase: 'error_recovery' }
                );
                reflections.push(note);
            } catch (err) {
                console.error('[Reflexion] Failed to reflect on error:', err);
            }
        }

        return reflections;
    }

    // =========================================================================
    // RETRIEVAL FOR CONTEXT
    // =========================================================================

    /**
     * Retrieve relevant reflection notes for a task
     */
    async getRelevantNotes(
        task: string,
        context?: { phase?: string; errorType?: string }
    ): Promise<ReflexionNote[]> {
        // Get all notes ordered by relevance indicators
        const notes = await db.select()
            .from(learningReflexionNotes)
            .orderBy(
                desc(learningReflexionNotes.effectiveness),
                desc(learningReflexionNotes.timesApplied)
            )
            .limit(this.config.maxNotesToRetrieve * 2);

        // Score and rank by relevance
        const scoredNotes = notes.map(note => {
            let score = 0;

            // Exact phase match
            if (context?.phase && note.phase === context.phase) {
                score += 10;
            }

            // Error type match
            if (context?.errorType && note.errorType === context.errorType) {
                score += 15;
            }

            // Task keyword matching
            const taskWords = task.toLowerCase().split(/\s+/);
            const noteDescWords = (note.failureDescription || '').toLowerCase().split(/\s+/);
            const overlap = taskWords.filter(w => noteDescWords.includes(w)).length;
            score += overlap * 2;

            // Effectiveness bonus
            if (note.effectiveness) {
                score += note.effectiveness / 10;
            }

            return { note, score };
        });

        // Sort by score and return top notes
        scoredNotes.sort((a, b) => b.score - a.score);

        const relevantNotes = scoredNotes
            .slice(0, this.config.maxNotesToRetrieve)
            .map(({ note }) => this.dbRowToNote(note));

        // Update retrieval counts
        for (const note of relevantNotes) {
            await this.incrementRetrieval(note.reflexionId);
        }

        return relevantNotes;
    }

    /**
     * Format notes for inclusion in prompt context
     */
    formatNotesForContext(notes: ReflexionNote[]): string {
        if (notes.length === 0) {
            return '';
        }

        const formatted = notes.map((note, i) => {
            return `[REFLECTION ${i + 1}]
Phase: ${note.phase}
Error Type: ${note.errorType || 'UNKNOWN'}
What Went Wrong: ${note.whatWentWrong || 'N/A'}
Lesson Learned: ${note.lessonLearned}
Suggested Approach: ${note.suggestedApproach}
${note.codePatternToAvoid ? `Pattern to Avoid: ${note.codePatternToAvoid}` : ''}
${note.codePatternToUse ? `Better Pattern: ${note.codePatternToUse}` : ''}`;
        }).join('\n\n');

        return `<PRIOR_REFLECTIONS>
The following reflections from past experiences may be relevant:

${formatted}
</PRIOR_REFLECTIONS>`;
    }

    // =========================================================================
    // EFFECTIVENESS TRACKING
    // =========================================================================

    /**
     * Update effectiveness score based on whether using the note helped
     */
    async updateEffectiveness(
        reflexionId: string,
        wasHelpful: boolean
    ): Promise<void> {
        const existing = await db.select()
            .from(learningReflexionNotes)
            .where(eq(learningReflexionNotes.reflexionId, reflexionId))
            .limit(1);

        if (existing.length === 0) {
            return;
        }

        const current = existing[0].effectiveness || 50;
        const adjustment = wasHelpful ? 5 : -3;
        const newScore = Math.max(0, Math.min(100, current + adjustment));

        await db.update(learningReflexionNotes)
            .set({
                effectiveness: newScore,
                timesApplied: sql`${learningReflexionNotes.timesApplied} + 1`,
            })
            .where(eq(learningReflexionNotes.reflexionId, reflexionId));

        this.emit('effectiveness_updated', {
            reflexionId,
            wasHelpful,
            newScore,
        });
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get statistics about reflection notes
     */
    async getStats(): Promise<{
        totalNotes: number;
        byErrorType: Record<string, number>;
        avgEffectiveness: number;
        topLessons: string[];
    }> {
        const all = await db.select().from(learningReflexionNotes);

        const byErrorType: Record<string, number> = {};
        let effectivenessSum = 0;
        let effectivenessCount = 0;
        const lessonCounts: Record<string, number> = {};

        for (const row of all) {
            const errorType = row.errorType || 'UNKNOWN';
            byErrorType[errorType] = (byErrorType[errorType] || 0) + 1;

            if (row.effectiveness !== null && row.effectiveness !== undefined) {
                effectivenessSum += row.effectiveness;
                effectivenessCount++;
            }

            if (row.lessonLearned) {
                lessonCounts[row.lessonLearned] = (lessonCounts[row.lessonLearned] || 0) + 1;
            }
        }

        const topLessons = Object.entries(lessonCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([lesson]) => lesson);

        return {
            totalNotes: all.length,
            byErrorType,
            avgEffectiveness: effectivenessCount > 0 ? effectivenessSum / effectivenessCount : 0,
            topLessons,
        };
    }

    /**
     * Get recent reflection notes
     */
    async getRecentNotes(limit: number = 20): Promise<ReflexionNote[]> {
        const rows = await db.select()
            .from(learningReflexionNotes)
            .orderBy(desc(learningReflexionNotes.createdAt))
            .limit(limit);

        return rows.map(row => this.dbRowToNote(row));
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private parseReflectionResponse(text: string): {
        errorType: string;
        rootCauseAnalysis: string;
        whatWentWrong?: string;
        whatShouldHaveDone?: string;
        lessonLearned: string;
        suggestedApproach: string;
        codePatternToAvoid?: string;
        codePatternToUse?: string;
    } {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                errorType: parsed.errorType || 'OTHER',
                rootCauseAnalysis: parsed.rootCauseAnalysis || 'Analysis not available',
                whatWentWrong: parsed.whatWentWrong,
                whatShouldHaveDone: parsed.whatShouldHaveDone,
                lessonLearned: parsed.lessonLearned || 'No specific lesson extracted',
                suggestedApproach: parsed.suggestedApproach || 'No approach suggested',
                codePatternToAvoid: parsed.codePatternToAvoid,
                codePatternToUse: parsed.codePatternToUse,
            };
        } catch {
            return {
                errorType: 'OTHER',
                rootCauseAnalysis: text.slice(0, 500),
                lessonLearned: 'Error during reflection parsing',
                suggestedApproach: 'Review error manually',
            };
        }
    }

    private async persistNote(note: ReflexionNote): Promise<void> {
        try {
            await db.insert(learningReflexionNotes).values({
                reflexionId: note.reflexionId,
                buildId: note.buildId,
                agentId: note.agentId,
                phase: note.phase,
                failureDescription: note.failureDescription,
                errorType: note.errorType,
                errorMessage: note.errorMessage,
                attemptsMade: 1,
                rootCauseAnalysis: note.rootCauseAnalysis,
                whatWentWrong: note.whatWentWrong,
                whatShouldHaveDone: note.whatShouldHaveDone,
                lessonLearned: note.lessonLearned,
                suggestedApproach: note.suggestedApproach,
                codePatternToAvoid: note.codePatternToAvoid,
                codePatternToUse: note.codePatternToUse,
                effectiveness: null,
                timesRetrieved: 0,
                timesApplied: 0,
            });
        } catch (error) {
            console.error('[Reflexion] Failed to persist note:', error);
        }
    }

    private async incrementRetrieval(reflexionId: string): Promise<void> {
        try {
            await db.update(learningReflexionNotes)
                .set({
                    timesRetrieved: sql`${learningReflexionNotes.timesRetrieved} + 1`,
                })
                .where(eq(learningReflexionNotes.reflexionId, reflexionId));
        } catch (error) {
            console.error('[Reflexion] Failed to increment retrieval:', error);
        }
    }

    private dbRowToNote(row: typeof learningReflexionNotes.$inferSelect): ReflexionNote {
        return {
            reflexionId: row.reflexionId,
            buildId: row.buildId || undefined,
            agentId: row.agentId || undefined,
            phase: row.phase,
            failureDescription: row.failureDescription,
            errorType: row.errorType || undefined,
            errorMessage: row.errorMessage || undefined,
            rootCauseAnalysis: row.rootCauseAnalysis,
            whatWentWrong: row.whatWentWrong || undefined,
            whatShouldHaveDone: row.whatShouldHaveDone || undefined,
            lessonLearned: row.lessonLearned,
            suggestedApproach: row.suggestedApproach,
            codePatternToAvoid: row.codePatternToAvoid || undefined,
            codePatternToUse: row.codePatternToUse || undefined,
            effectiveness: row.effectiveness || undefined,
            timesRetrieved: row.timesRetrieved || 0,
            timesApplied: row.timesApplied || 0,
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: ReflexionService | null = null;

export function getReflexion(config?: Partial<ReflexionConfig>): ReflexionService {
    if (!instance) {
        instance = new ReflexionService(config);
    }
    return instance;
}

export function resetReflexion(): void {
    instance = null;
}
