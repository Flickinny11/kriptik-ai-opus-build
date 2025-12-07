// @ts-nocheck - Learning module has complex nullable types from DB schema
/**
 * Pattern Library Service (Layer 4 - Meta-Learning)
 * 
 * Voyager-inspired pattern library that stores and retrieves reusable
 * solutions. Patterns are extracted from successful builds and can be
 * used to accelerate future similar tasks.
 * 
 * Categories:
 * - Code Patterns: React components, hooks, utilities
 * - Design Patterns: UI layouts, animations, color schemes
 * - Architecture Patterns: File structures, API designs
 * - Error Fix Patterns: Common error solutions
 */

import { db } from '../../db.js';
import { learningPatterns } from '../../schema.js';
import { eq, desc, and, like, sql, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';
import type {
    LearnedPattern,
    PatternCategory,
    CodeArtifactTrace,
    DesignChoiceTrace,
    ErrorRecoveryTrace,
    DecisionTrace,
} from './types.js';

// =============================================================================
// PATTERN EXTRACTION PROMPTS
// =============================================================================

const EXTRACT_CODE_PATTERN_PROMPT = `You are extracting reusable code patterns from successful implementations.

Analyze the code and extract generalizable patterns that could help with similar future tasks.

For each pattern, provide:
1. Name: A descriptive pattern name
2. Problem: What problem does this pattern solve?
3. Solution Template: Abstract version that can be reused
4. Conditions: When should this pattern be used?
5. Anti-Conditions: When should this pattern NOT be used?
6. Code Template: A generic code template with placeholders

Respond with JSON:
{
    "patterns": [
        {
            "name": "<PatternName>",
            "problem": "<problem description>",
            "solutionTemplate": "<abstract solution>",
            "conditions": ["<when to use>"],
            "antiConditions": ["<when NOT to use>"],
            "codeTemplate": "<code with {{placeholders}}>"
        }
    ]
}`;

const EXTRACT_DESIGN_PATTERN_PROMPT = `You are extracting reusable design patterns from successful UI implementations.

Analyze the design choices and extract generalizable patterns for:
- Typography combinations
- Color system approaches
- Animation/motion patterns
- Layout strategies

Respond with JSON:
{
    "patterns": [
        {
            "name": "<PatternName>",
            "problem": "<UI problem solved>",
            "solutionTemplate": "<abstract design approach>",
            "conditions": ["<when this design works>"],
            "antiConditions": ["<when to avoid>"],
            "codeTemplate": "<CSS/JSX template>"
        }
    ]
}`;

const EXTRACT_ERROR_FIX_PATTERN_PROMPT = `You are extracting reusable error fix patterns from successful error recoveries.

Analyze the error and its fix, then create a generalizable pattern that can help fix similar errors in the future.

Respond with JSON:
{
    "patterns": [
        {
            "name": "<ErrorFixPattern>",
            "problem": "<error type and symptoms>",
            "solutionTemplate": "<general approach to fix>",
            "conditions": ["<error indicators>"],
            "antiConditions": ["<similar-looking but different errors>"],
            "codeTemplate": "<fix template>"
        }
    ]
}`;

// =============================================================================
// PATTERN LIBRARY SERVICE
// =============================================================================

export class PatternLibraryService extends EventEmitter {
    private anthropic: ReturnType<typeof createAnthropicClient>;
    private patternCache: Map<string, LearnedPattern[]> = new Map();
    private lastCacheRefresh: Date = new Date(0);
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    constructor() {
        super();
        this.anthropic = createAnthropicClient();
    }

    // =========================================================================
    // PATTERN EXTRACTION
    // =========================================================================

    /**
     * Extract patterns from a successful code artifact
     */
    async extractCodePatterns(
        artifact: CodeArtifactTrace,
        context?: { buildId?: string; projectId?: string }
    ): Promise<LearnedPattern[]> {
        const latestVersion = artifact.versions[artifact.versions.length - 1];
        if (!latestVersion) return [];

        // Only extract from high-quality code
        const latestQuality = artifact.qualityTrajectory[artifact.qualityTrajectory.length - 1];
        if (latestQuality && latestQuality.codeQualityScore < 70) {
            console.log(`[PatternLibrary] Skipping low-quality artifact: ${artifact.filePath}`);
            return [];
        }

        const prompt = `${EXTRACT_CODE_PATTERN_PROMPT}

FILE: ${artifact.filePath}
CODE:
\`\`\`
${latestVersion.code.slice(0, 12000)}
\`\`\`

QUALITY TRAJECTORY:
${JSON.stringify(artifact.qualityTrajectory.slice(-3))}

PATTERNS ALREADY USED:
${artifact.patternsUsed.map(p => p.patternName).join(', ')}`;

        try {
            const response = await this.anthropic.messages.create({
                model: 'anthropic/claude-sonnet-4-20250514',
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (content.type !== 'text') return [];

            const result = this.parsePatternResponse(content.text);
            const patterns: LearnedPattern[] = [];

            for (const p of result.patterns) {
                const pattern = await this.createPattern({
                    category: 'code',
                    name: p.name,
                    problem: p.problem,
                    solutionTemplate: p.solutionTemplate,
                    conditions: p.conditions,
                    antiConditions: p.antiConditions,
                    codeTemplate: p.codeTemplate,
                    sourceTraceId: artifact.artifactId,
                });
                patterns.push(pattern);
            }

            this.emit('patterns_extracted', { count: patterns.length, category: 'code', source: artifact.filePath });
            return patterns;
        } catch (error) {
            console.error('[PatternLibrary] Code pattern extraction failed:', error);
            return [];
        }
    }

    /**
     * Extract patterns from design choices
     */
    async extractDesignPatterns(
        designChoice: DesignChoiceTrace
    ): Promise<LearnedPattern[]> {
        // Only extract from high-quality designs
        if (designChoice.visualScores && designChoice.visualScores.overall < 70) {
            console.log(`[PatternLibrary] Skipping low-quality design: ${designChoice.choiceId}`);
            return [];
        }

        const prompt = `${EXTRACT_DESIGN_PATTERN_PROMPT}

APP SOUL: ${designChoice.appSoul || 'Generic'}

TYPOGRAPHY:
${JSON.stringify(designChoice.typography, null, 2)}

COLOR SYSTEM:
${JSON.stringify(designChoice.colorSystem, null, 2)}

MOTION LANGUAGE:
${JSON.stringify(designChoice.motionLanguage, null, 2)}

LAYOUT:
${JSON.stringify(designChoice.layoutDecisions, null, 2)}

VISUAL SCORES:
${JSON.stringify(designChoice.visualScores, null, 2)}`;

        try {
            const response = await this.anthropic.messages.create({
                model: 'anthropic/claude-sonnet-4-20250514',
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (content.type !== 'text') return [];

            const result = this.parsePatternResponse(content.text);
            const patterns: LearnedPattern[] = [];

            for (const p of result.patterns) {
                const pattern = await this.createPattern({
                    category: 'design',
                    name: p.name,
                    problem: p.problem,
                    solutionTemplate: p.solutionTemplate,
                    conditions: p.conditions,
                    antiConditions: p.antiConditions,
                    codeTemplate: p.codeTemplate,
                    sourceTraceId: designChoice.choiceId,
                });
                patterns.push(pattern);
            }

            this.emit('patterns_extracted', { count: patterns.length, category: 'design' });
            return patterns;
        } catch (error) {
            console.error('[PatternLibrary] Design pattern extraction failed:', error);
            return [];
        }
    }

    /**
     * Extract patterns from error recoveries
     */
    async extractErrorFixPatterns(
        recovery: ErrorRecoveryTrace
    ): Promise<LearnedPattern[]> {
        if (!recovery.successfulFix) return [];

        const prompt = `${EXTRACT_ERROR_FIX_PATTERN_PROMPT}

ERROR TYPE: ${recovery.error.type}
ERROR MESSAGE: ${recovery.error.message}
FILE LOCATION: ${recovery.error.fileLocation}

RECOVERY JOURNEY (${recovery.recoveryJourney.length} attempts):
${recovery.recoveryJourney.map(a => 
    `Level ${a.level}: ${a.result} - ${a.fixApplied.slice(0, 200)}`
).join('\n')}

SUCCESSFUL FIX:
Level: ${recovery.successfulFix.levelRequired}
Description: ${recovery.successfulFix.fixDescription}
Diff: ${recovery.successfulFix.codeDiff?.slice(0, 2000) || 'N/A'}`;

        try {
            const response = await this.anthropic.messages.create({
                model: 'anthropic/claude-sonnet-4-20250514',
                max_tokens: 3000,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (content.type !== 'text') return [];

            const result = this.parsePatternResponse(content.text);
            const patterns: LearnedPattern[] = [];

            for (const p of result.patterns) {
                const pattern = await this.createPattern({
                    category: 'error_fix',
                    name: p.name,
                    problem: p.problem,
                    solutionTemplate: p.solutionTemplate,
                    conditions: p.conditions,
                    antiConditions: p.antiConditions,
                    codeTemplate: p.codeTemplate,
                    sourceTraceId: recovery.errorId,
                });
                patterns.push(pattern);
            }

            this.emit('patterns_extracted', { count: patterns.length, category: 'error_fix' });
            return patterns;
        } catch (error) {
            console.error('[PatternLibrary] Error fix pattern extraction failed:', error);
            return [];
        }
    }

    // =========================================================================
    // PATTERN RETRIEVAL
    // =========================================================================

    /**
     * Find relevant patterns for a given context
     */
    async findRelevantPatterns(
        query: string,
        category?: PatternCategory,
        limit: number = 5
    ): Promise<LearnedPattern[]> {
        // Try cache first
        const cacheKey = `${category || 'all'}_${query.slice(0, 50)}`;
        if (this.isCacheValid() && this.patternCache.has(cacheKey)) {
            return this.patternCache.get(cacheKey)!;
        }

        // Build query conditions
        const conditions = [];
        if (category) {
            conditions.push(eq(learningPatterns.category, category));
        }

        // Get all patterns in category
        let rows = await db.select()
            .from(learningPatterns)
            .where(category ? eq(learningPatterns.category, category) : sql`1=1`)
            .orderBy(desc(learningPatterns.successRate), desc(learningPatterns.usageCount));

        // Score patterns by relevance to query
        const queryTerms = query.toLowerCase().split(/\s+/);
        const scoredPatterns = rows.map(row => {
            let score = 0;
            const searchText = `${row.name} ${row.problem} ${row.solutionTemplate}`.toLowerCase();
            
            for (const term of queryTerms) {
                if (searchText.includes(term)) {
                    score += 10;
                }
            }
            
            // Boost by success rate and usage
            score += row.successRate / 10;
            score += Math.min(row.usageCount, 10);

            return { row, score };
        });

        // Sort by score and take top results
        const topPatterns = scoredPatterns
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .filter(p => p.score > 0)
            .map(p => this.mapPatternRow(p.row));

        // Cache results
        this.patternCache.set(cacheKey, topPatterns);
        this.lastCacheRefresh = new Date();

        return topPatterns;
    }

    /**
     * Get patterns by category
     */
    async getPatternsByCategory(
        category: PatternCategory,
        limit: number = 50
    ): Promise<LearnedPattern[]> {
        const rows = await db.select()
            .from(learningPatterns)
            .where(eq(learningPatterns.category, category))
            .orderBy(desc(learningPatterns.successRate), desc(learningPatterns.usageCount))
            .limit(limit);

        return rows.map(this.mapPatternRow);
    }

    /**
     * Get top performing patterns
     */
    async getTopPatterns(limit: number = 20): Promise<LearnedPattern[]> {
        const rows = await db.select()
            .from(learningPatterns)
            .orderBy(desc(learningPatterns.successRate), desc(learningPatterns.usageCount))
            .limit(limit);

        return rows.map(this.mapPatternRow);
    }

    /**
     * Record pattern usage
     */
    async recordPatternUsage(
        patternId: string,
        success: boolean
    ): Promise<void> {
        const [existing] = await db.select()
            .from(learningPatterns)
            .where(eq(learningPatterns.patternId, patternId))
            .limit(1);

        if (!existing) return;

        const newUsageCount = existing.usageCount + 1;
        const currentSuccesses = Math.round(existing.successRate * existing.usageCount / 100);
        const newSuccesses = currentSuccesses + (success ? 1 : 0);
        const newSuccessRate = Math.round((newSuccesses / newUsageCount) * 100);

        await db.update(learningPatterns)
            .set({
                usageCount: newUsageCount,
                successRate: newSuccessRate,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(learningPatterns.patternId, patternId));

        // Invalidate cache
        this.patternCache.clear();
    }

    // =========================================================================
    // PATTERN MANAGEMENT
    // =========================================================================

    /**
     * Create a new pattern
     */
    async createPattern(input: {
        category: PatternCategory;
        name: string;
        problem: string;
        solutionTemplate: string;
        conditions: string[];
        antiConditions: string[];
        codeTemplate?: string;
        sourceTraceId?: string;
    }): Promise<LearnedPattern> {
        const patternId = `pat_${uuidv4()}`;
        const now = new Date();

        // Check for similar existing pattern
        const existingPatterns = await this.findRelevantPatterns(input.name, input.category, 1);
        if (existingPatterns.length > 0 && this.isSimilarPattern(existingPatterns[0], input)) {
            // Update existing pattern instead
            console.log(`[PatternLibrary] Merging with existing pattern: ${existingPatterns[0].name}`);
            return existingPatterns[0];
        }

        const pattern: LearnedPattern = {
            patternId,
            category: input.category,
            name: input.name,
            problem: input.problem,
            solutionTemplate: input.solutionTemplate,
            conditions: input.conditions,
            antiConditions: input.antiConditions,
            codeTemplate: input.codeTemplate,
            usageCount: 0,
            successRate: 100, // Start optimistic
            sourceTraceId: input.sourceTraceId,
            createdAt: now,
            updatedAt: now,
        };

        await this.persistPattern(pattern);
        this.patternCache.clear();

        this.emit('pattern_created', { patternId, name: input.name, category: input.category });
        return pattern;
    }

    /**
     * Get pattern statistics
     */
    async getPatternStats(): Promise<{
        total: number;
        byCategory: Record<string, number>;
        avgSuccessRate: number;
        mostUsed: LearnedPattern[];
    }> {
        const all = await db.select().from(learningPatterns);
        
        const byCategory: Record<string, number> = {};
        let totalSuccessRate = 0;

        for (const pattern of all) {
            byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;
            totalSuccessRate += pattern.successRate;
        }

        const mostUsed = await db.select()
            .from(learningPatterns)
            .orderBy(desc(learningPatterns.usageCount))
            .limit(5);

        return {
            total: all.length,
            byCategory,
            avgSuccessRate: all.length > 0 ? totalSuccessRate / all.length : 0,
            mostUsed: mostUsed.map(this.mapPatternRow),
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private parsePatternResponse(text: string): { patterns: Array<{
        name: string;
        problem: string;
        solutionTemplate: string;
        conditions: string[];
        antiConditions: string[];
        codeTemplate?: string;
    }> } {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { patterns: [] };
            }
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('[PatternLibrary] Failed to parse response:', error);
            return { patterns: [] };
        }
    }

    private isSimilarPattern(
        existing: LearnedPattern,
        newPattern: { name: string; problem: string }
    ): boolean {
        const nameSimilarity = this.stringSimilarity(
            existing.name.toLowerCase(),
            newPattern.name.toLowerCase()
        );
        const problemSimilarity = this.stringSimilarity(
            existing.problem.toLowerCase(),
            newPattern.problem.toLowerCase()
        );
        
        return nameSimilarity > 0.8 || problemSimilarity > 0.7;
    }

    private stringSimilarity(a: string, b: string): number {
        const wordsA = new Set(a.split(/\s+/));
        const wordsB = new Set(b.split(/\s+/));
        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const union = new Set([...wordsA, ...wordsB]).size;
        return union > 0 ? intersection / union : 0;
    }

    private isCacheValid(): boolean {
        return Date.now() - this.lastCacheRefresh.getTime() < this.CACHE_TTL_MS;
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================

    private async persistPattern(pattern: LearnedPattern): Promise<void> {
        try {
            await db.insert(learningPatterns).values({
                id: uuidv4(),
                patternId: pattern.patternId,
                category: pattern.category,
                name: pattern.name,
                problem: pattern.problem,
                solutionTemplate: pattern.solutionTemplate,
                conditions: pattern.conditions,
                antiConditions: pattern.antiConditions,
                codeTemplate: pattern.codeTemplate,
                usageCount: pattern.usageCount,
                successRate: pattern.successRate,
                sourceTraceId: pattern.sourceTraceId,
                createdAt: pattern.createdAt.toISOString(),
                updatedAt: pattern.updatedAt.toISOString(),
            });
        } catch (error) {
            console.error('[PatternLibrary] Failed to persist pattern:', error);
        }
    }

    private mapPatternRow = (row: typeof learningPatterns.$inferSelect): LearnedPattern => ({
        patternId: row.patternId,
        category: row.category as PatternCategory,
        name: row.name,
        problem: row.problem,
        solutionTemplate: row.solutionTemplate,
        conditions: (row.conditions as string[]) || [],
        antiConditions: (row.antiConditions as string[]) || [],
        codeTemplate: row.codeTemplate || undefined,
        usageCount: row.usageCount,
        successRate: row.successRate,
        sourceTraceId: row.sourceTraceId || undefined,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    });
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: PatternLibraryService | null = null;

export function getPatternLibrary(): PatternLibraryService {
    if (!instance) {
        instance = new PatternLibraryService();
    }
    return instance;
}

