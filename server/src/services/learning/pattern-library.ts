/**
 * Pattern Library
 *
 * Accumulates reusable patterns from successful builds, inspired by
 * Voyager (the Minecraft agent that accumulates skills).
 *
 * This is part of Layer 4 (Meta-Learning) of the Autonomous Learning Engine.
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { patterns } from '../../schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { getModelRouter } from '../ai/model-router.js';
import type {
    Pattern,
    DecisionTrace,
    PatternCategory,
    CodeArtifactTrace,
    ErrorRecoveryTrace,
} from './types.js';

// =============================================================================
// PATTERN LIBRARY SERVICE
// =============================================================================

export class PatternLibraryService {
    private modelRouter = getModelRouter();
    private patternCache: Map<string, Pattern> = new Map();
    private embeddingCache: Map<string, number[]> = new Map();

    // =========================================================================
    // PATTERN EXTRACTION
    // =========================================================================

    /**
     * Extract a reusable pattern from a successful decision trace
     */
    async extractPattern(trace: DecisionTrace): Promise<Pattern | null> {
        // Only extract from successful decisions with high confidence
        if (!trace.outcome || trace.outcome.immediateResult !== 'success') return null;
        if (trace.decision.confidence < 0.7) return null;

        // Skip if verification scores are too low
        if (trace.outcome.verificationScores && trace.outcome.verificationScores.overall < 75) {
            return null;
        }

        const extractionPrompt = `Analyze this successful solution and extract a REUSABLE PATTERN that can be applied to similar problems.

## Decision Context
- Type: ${trace.decisionType}
- Phase: ${trace.phase}
- Intent: ${trace.context.intentSnippet || 'Not provided'}

## Decision Made
${trace.decision.chosenOption}

## Reasoning
${trace.decision.reasoning}

## Outcome
- Result: ${trace.outcome.immediateResult}
- Confidence: ${trace.decision.confidence}

## Extract a Pattern
Output JSON with:
{
  "name": "Descriptive pattern name (e.g., 'Optimistic UI Updates')",
  "category": "react|css|api|state|animation|auth|database|deployment|error_fix|design|architecture",
  "problem": "Abstract description of the problem this solves",
  "solutionTemplate": "General solution approach with placeholders",
  "codeTemplate": "Code template if applicable, with {{PLACEHOLDER}} markers",
  "conditions": ["When to apply this pattern"],
  "antiConditions": ["When NOT to apply this pattern"]
}

Make the pattern GENERAL enough to apply to multiple situations, but SPECIFIC enough to be useful.
Only output JSON, no other text.`;

        try {
            const response = await this.modelRouter.generate({
                prompt: extractionPrompt,
                taskType: 'pattern_extraction',
                temperature: 0.3,
            });

            const parsed = this.parseJSON<{
                name: string;
                category: PatternCategory;
                problem: string;
                solutionTemplate: string;
                codeTemplate: string | null;
                conditions: string[];
                antiConditions: string[];
            }>(response.content);

            // Generate embedding for the problem description
            const problemEmbedding = await this.generateEmbedding(parsed.problem);

            const pattern: Pattern = {
                patternId: uuidv4(),
                name: parsed.name,
                category: parsed.category,
                problem: parsed.problem,
                problemEmbedding,
                solutionTemplate: parsed.solutionTemplate,
                codeTemplate: parsed.codeTemplate,
                conditions: parsed.conditions,
                antiConditions: parsed.antiConditions,
                timesUsed: 1,
                successRate: 100, // Starts at 100%, updated with use
                avgQualityScore: trace.outcome.verificationScores?.overall || 80,
                extractedFromBuildId: trace.buildId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Check for duplicate patterns
            const existingPattern = await this.findSimilarPattern(parsed.problem);
            if (existingPattern && existingPattern.successRate >= 0.8) {
                // Pattern already exists and is successful, just update usage
                await this.recordPatternUsage(existingPattern.patternId, true);
                return existingPattern;
            }

            // Store new pattern
            await this.storePattern(pattern);
            return pattern;
        } catch (error) {
            console.error('[PatternLibrary] Failed to extract pattern:', error);
            return null;
        }
    }

    /**
     * Extract error fix pattern from successful recovery
     */
    async extractErrorFixPattern(recovery: ErrorRecoveryTrace): Promise<Pattern | null> {
        if (!recovery.successfulFix) return null;

        const extractionPrompt = `Extract a REUSABLE ERROR FIX PATTERN from this successful error recovery.

## Error
- Type: ${recovery.error.type}
- Message: ${recovery.error.message}
- File: ${recovery.error.fileLocation}

## Successful Fix
${recovery.successfulFix.fixDescription}

## Code Diff
${recovery.successfulFix.codeDiff}

## Extract Pattern
Output JSON:
{
  "name": "Pattern name (e.g., 'Missing Import Resolution')",
  "category": "error_fix",
  "problem": "General description of error pattern",
  "solutionTemplate": "How to diagnose and fix this type of error",
  "codeTemplate": "Code fix template if applicable",
  "conditions": ["When this error occurs"],
  "antiConditions": ["When this fix won't work"]
}

Only output JSON.`;

        try {
            const response = await this.modelRouter.generate({
                prompt: extractionPrompt,
                taskType: 'pattern_extraction',
                temperature: 0.3,
            });

            const parsed = this.parseJSON<{
                name: string;
                category: PatternCategory;
                problem: string;
                solutionTemplate: string;
                codeTemplate: string | null;
                conditions: string[];
                antiConditions: string[];
            }>(response.content);

            const problemEmbedding = await this.generateEmbedding(parsed.problem);

            const pattern: Pattern = {
                patternId: uuidv4(),
                name: parsed.name,
                category: 'error_fix',
                problem: parsed.problem,
                problemEmbedding,
                solutionTemplate: parsed.solutionTemplate,
                codeTemplate: parsed.codeTemplate,
                conditions: parsed.conditions,
                antiConditions: parsed.antiConditions,
                timesUsed: 1,
                successRate: 100,
                avgQualityScore: 80, // Default for error fixes
                extractedFromBuildId: recovery.buildId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await this.storePattern(pattern);
            return pattern;
        } catch (error) {
            console.error('[PatternLibrary] Failed to extract error fix pattern:', error);
            return null;
        }
    }

    // =========================================================================
    // PATTERN RETRIEVAL
    // =========================================================================

    /**
     * Retrieve relevant patterns for a given context
     */
    async retrievePatterns(params: {
        context: string;
        category?: PatternCategory;
        limit?: number;
        minSuccessRate?: number;
    }): Promise<Pattern[]> {
        const limit = params.limit || 5;
        const minSuccessRate = params.minSuccessRate || 60;

        try {
            // Get all patterns (or filter by category)
            let allPatterns = await db.select().from(patterns);

            if (params.category) {
                allPatterns = allPatterns.filter(p => p.category === params.category);
            }

            // Filter by success rate
            allPatterns = allPatterns.filter(p => (p.successRate || 0) >= minSuccessRate);

            if (allPatterns.length === 0) return [];

            // Generate embedding for the context
            const contextEmbedding = await this.generateEmbedding(params.context);

            // Calculate similarity and rank
            const patternsWithSimilarity = allPatterns.map(p => {
                const patternEmbedding = p.problemEmbedding as number[] | null;
                const similarity = patternEmbedding
                    ? this.cosineSimilarity(contextEmbedding, patternEmbedding)
                    : 0;

                return {
                    pattern: this.dbPatternToPattern(p),
                    similarity,
                };
            });

            // Sort by similarity and return top results
            return patternsWithSimilarity
                .filter(p => p.similarity > 0.6) // Minimum similarity threshold
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit)
                .map(p => p.pattern);
        } catch (error) {
            console.error('[PatternLibrary] Failed to retrieve patterns:', error);
            return [];
        }
    }

    /**
     * Find similar existing pattern
     */
    async findSimilarPattern(problem: string): Promise<Pattern | null> {
        const results = await this.retrievePatterns({
            context: problem,
            limit: 1,
        });

        return results.length > 0 ? results[0] : null;
    }

    /**
     * Inject patterns into agent context/system prompt
     */
    injectPatternsIntoPrompt(patternsToInject: Pattern[], systemPrompt: string): string {
        if (patternsToInject.length === 0) return systemPrompt;

        const patternSection = patternsToInject.map(p => `
## Pattern: ${p.name}
**Problem:** ${p.problem}
**Solution:** ${p.solutionTemplate}
**Apply when:** ${p.conditions.join(', ')}
**Don't apply when:** ${p.antiConditions.join(', ')}
${p.codeTemplate ? `**Code template:**\n\`\`\`\n${p.codeTemplate}\n\`\`\`` : ''}
`).join('\n');

        return `${systemPrompt}

## LEARNED PATTERNS
The following patterns have been learned from successful builds. Apply them when appropriate:

${patternSection}
`;
    }

    // =========================================================================
    // PATTERN LIFECYCLE
    // =========================================================================

    /**
     * Record pattern usage and update metrics
     */
    async recordPatternUsage(patternId: string, wasSuccessful: boolean): Promise<void> {
        try {
            const [pattern] = await db.select()
                .from(patterns)
                .where(eq(patterns.id, patternId))
                .limit(1);

            if (!pattern) return;

            const timesUsed = (pattern.timesUsed || 0) + 1;
            const currentSuccessRate = pattern.successRate || 100;

            // Update success rate with exponential moving average
            const newSuccessRate = Math.round(
                0.9 * currentSuccessRate + 0.1 * (wasSuccessful ? 100 : 0)
            );

            await db.update(patterns)
                .set({
                    timesUsed,
                    successRate: newSuccessRate,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(patterns.id, patternId));

            // Invalidate cache
            this.patternCache.delete(patternId);
        } catch (error) {
            console.error('[PatternLibrary] Failed to record pattern usage:', error);
        }
    }

    /**
     * Update pattern quality score
     */
    async updatePatternQuality(patternId: string, qualityScore: number): Promise<void> {
        try {
            const [pattern] = await db.select()
                .from(patterns)
                .where(eq(patterns.id, patternId))
                .limit(1);

            if (!pattern) return;

            const currentAvg = pattern.avgQualityScore || 80;
            const timesUsed = pattern.timesUsed || 1;

            // Update running average
            const newAvg = Math.round(
                (currentAvg * (timesUsed - 1) + qualityScore) / timesUsed
            );

            await db.update(patterns)
                .set({
                    avgQualityScore: newAvg,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(patterns.id, patternId));

            this.patternCache.delete(patternId);
        } catch (error) {
            console.error('[PatternLibrary] Failed to update pattern quality:', error);
        }
    }

    /**
     * Deprecate patterns with low success rate
     */
    async pruneUnsuccessfulPatterns(minSuccessRate = 40): Promise<number> {
        try {
            const lowSuccessPatterns = await db.select()
                .from(patterns);

            const toDelete = lowSuccessPatterns.filter(p =>
                (p.successRate || 100) < minSuccessRate && (p.timesUsed || 0) >= 5
            );

            for (const pattern of toDelete) {
                await db.delete(patterns).where(eq(patterns.id, pattern.id));
                this.patternCache.delete(pattern.id);
            }

            return toDelete.length;
        } catch (error) {
            console.error('[PatternLibrary] Failed to prune patterns:', error);
            return 0;
        }
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get pattern library statistics
     */
    async getStatistics(): Promise<{
        totalPatterns: number;
        patternsByCategory: Record<string, number>;
        avgSuccessRate: number;
        topPatterns: Array<{ name: string; timesUsed: number; successRate: number }>;
    }> {
        try {
            const allPatterns = await db.select().from(patterns);

            const patternsByCategory: Record<string, number> = {};
            let totalSuccessRate = 0;

            for (const p of allPatterns) {
                patternsByCategory[p.category] = (patternsByCategory[p.category] || 0) + 1;
                totalSuccessRate += p.successRate || 0;
            }

            const avgSuccessRate = allPatterns.length > 0
                ? Math.round(totalSuccessRate / allPatterns.length)
                : 0;

            const topPatterns = allPatterns
                .sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0))
                .slice(0, 10)
                .map(p => ({
                    name: p.name,
                    timesUsed: p.timesUsed || 0,
                    successRate: p.successRate || 0,
                }));

            return {
                totalPatterns: allPatterns.length,
                patternsByCategory,
                avgSuccessRate,
                topPatterns,
            };
        } catch (error) {
            console.error('[PatternLibrary] Failed to get statistics:', error);
            return {
                totalPatterns: 0,
                patternsByCategory: {},
                avgSuccessRate: 0,
                topPatterns: [],
            };
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private async storePattern(pattern: Pattern): Promise<void> {
        try {
            await db.insert(patterns).values({
                id: pattern.patternId,
                name: pattern.name,
                category: pattern.category,
                problem: pattern.problem,
                problemEmbedding: Buffer.from(new Float32Array(pattern.problemEmbedding).buffer),
                solutionTemplate: pattern.solutionTemplate,
                codeTemplate: pattern.codeTemplate,
                conditions: pattern.conditions,
                antiConditions: pattern.antiConditions,
                timesUsed: pattern.timesUsed,
                successRate: pattern.successRate,
                avgQualityScore: pattern.avgQualityScore,
                extractedFromBuildId: pattern.extractedFromBuildId,
            });

            this.patternCache.set(pattern.patternId, pattern);
        } catch (error) {
            console.error('[PatternLibrary] Failed to store pattern:', error);
        }
    }

    private dbPatternToPattern(dbPattern: typeof patterns.$inferSelect): Pattern {
        let embedding: number[] = [];

        if (dbPattern.problemEmbedding) {
            try {
                const buffer = dbPattern.problemEmbedding as Buffer;
                embedding = Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
            } catch {
                embedding = [];
            }
        }

        return {
            patternId: dbPattern.id,
            name: dbPattern.name,
            category: dbPattern.category as PatternCategory,
            problem: dbPattern.problem,
            problemEmbedding: embedding,
            solutionTemplate: dbPattern.solutionTemplate,
            codeTemplate: dbPattern.codeTemplate,
            conditions: (dbPattern.conditions as string[]) || [],
            antiConditions: (dbPattern.antiConditions as string[]) || [],
            timesUsed: dbPattern.timesUsed || 0,
            successRate: dbPattern.successRate || 100,
            avgQualityScore: dbPattern.avgQualityScore || 0,
            extractedFromBuildId: dbPattern.extractedFromBuildId || '',
            createdAt: dbPattern.createdAt,
            updatedAt: dbPattern.updatedAt,
        };
    }

    /**
     * Generate a simple embedding using AI
     * In production, this would use a dedicated embedding model
     */
    private async generateEmbedding(text: string): Promise<number[]> {
        // Check cache first
        const cached = this.embeddingCache.get(text);
        if (cached) return cached;

        // For now, use a simple hash-based pseudo-embedding
        // In production, integrate with OpenAI embeddings or similar
        const embedding = this.simpleEmbedding(text);

        this.embeddingCache.set(text, embedding);
        return embedding;
    }

    /**
     * Simple embedding fallback (bag of words style)
     * Should be replaced with proper embedding model in production
     */
    private simpleEmbedding(text: string): number[] {
        const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const dim = 128;
        const embedding = new Array(dim).fill(0);

        for (const word of words) {
            const hash = this.hashString(word);
            const idx = hash % dim;
            embedding[idx] += 1;
        }

        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
        return embedding.map(v => v / magnitude);
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            magnitudeA += a[i] * a[i];
            magnitudeB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    private parseJSON<T>(content: string): T {
        const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;

        try {
            return JSON.parse(jsonStr.trim());
        } catch {
            const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                return JSON.parse(objectMatch[0]);
            }
            throw new Error('Failed to parse JSON from response');
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: PatternLibraryService | null = null;

export function getPatternLibraryService(): PatternLibraryService {
    if (!instance) {
        instance = new PatternLibraryService();
    }
    return instance;
}

