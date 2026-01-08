/**
 * Direct-RLAIF Service
 *
 * Implements Direct Reinforcement Learning from AI Feedback (d-RLAIF)
 * which bypasses reward model training by getting rewards directly from
 * an LLM labeler during evaluation.
 *
 * This is more efficient than canonical RLAIF and achieves superior results
 * according to 2026 research (RLAIF-V achieves 82.9% hallucination reduction).
 */

import { db } from '../../db.js';
import { learningDirectRLAIFEvals } from '../../schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';
import type {
    DirectRLAIFEvaluationType,
    DirectRewardResult,
    DirectRLAIFConfig,
} from './types.js';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: DirectRLAIFConfig = {
    labelerModel: 'anthropic/claude-sonnet-4-20250514',
    enableCache: true,
    cacheTTLMs: 5 * 60 * 1000, // 5 minutes
    maxConcurrentEvals: 5,
};

// =============================================================================
// REWARD PROMPTS BY CATEGORY
// =============================================================================

const CODE_REWARD_PROMPT = `You are an expert code quality evaluator providing direct reward scores for AI training.

Evaluate the following code response on these criteria (each 0-100):
1. **Correctness** (25%): Does it solve the problem correctly?
2. **Structure** (20%): Clean architecture, proper separation of concerns
3. **Patterns** (20%): Correct use of React/TypeScript patterns
4. **Maintainability** (15%): Readable, documented, testable
5. **Security** (10%): No vulnerabilities, proper validation
6. **Performance** (10%): No obvious performance issues

PROMPT:
{{PROMPT}}

RESPONSE:
{{RESPONSE}}

{{CONTEXT}}

Respond with JSON only:
{
    "rewardScore": <0-100 weighted overall score>,
    "categoryScores": {
        "correctness": <0-100>,
        "structure": <0-100>,
        "patterns": <0-100>,
        "maintainability": <0-100>,
        "security": <0-100>,
        "performance": <0-100>
    },
    "reasoning": "<brief analysis explaining the scores>"
}`;

const DESIGN_REWARD_PROMPT = `You are an elite UI/UX designer evaluator providing direct reward scores for Anti-Slop design quality.

ANTI-SLOP PRINCIPLES:
- NO flat white/gray backgrounds - use gradients, patterns, depth
- NO generic fonts (Inter, Arial) - use distinctive typography
- NO purple-to-pink gradients - these are AI slop indicators
- YES to motion, layers, shadows, atmosphere, soul

Evaluate the following design/styling code:

PROMPT:
{{PROMPT}}

RESPONSE:
{{RESPONSE}}

{{CONTEXT}}

Rate on these criteria (each 0-100):
1. **Depth** (25%): Visual layering, backgrounds, shadows
2. **Typography** (20%): Font choices, hierarchy, distinctiveness  
3. **Color** (20%): Palette intentionality, contrast, NO AI slop gradients
4. **Motion** (15%): Animation quality, purposeful movement
5. **Soul Match** (20%): Does design embody app's personality?

Respond with JSON only:
{
    "rewardScore": <0-100 weighted overall score>,
    "categoryScores": {
        "depth": <0-100>,
        "typography": <0-100>,
        "color": <0-100>,
        "motion": <0-100>,
        "soulMatch": <0-100>
    },
    "reasoning": "<brief analysis explaining the scores>"
}`;

const ERROR_FIX_REWARD_PROMPT = `You are an expert debugging evaluator providing direct reward scores for error fix quality.

Evaluate how well the following fix addresses the error:

ERROR:
{{PROMPT}}

FIX APPLIED:
{{RESPONSE}}

{{CONTEXT}}

Rate on these criteria (each 0-100):
1. **Correctness** (40%): Does it actually fix the error?
2. **Completeness** (25%): Are all related issues addressed?
3. **Side Effects** (20%): Does it avoid introducing new problems?
4. **Elegance** (15%): Is the fix clean and maintainable?

Respond with JSON only:
{
    "rewardScore": <0-100 weighted overall score>,
    "categoryScores": {
        "correctness": <0-100>,
        "completeness": <0-100>,
        "sideEffects": <0-100>,
        "elegance": <0-100>
    },
    "reasoning": "<brief analysis explaining the scores>"
}`;

const ARCHITECTURE_REWARD_PROMPT = `You are a senior architect evaluator providing direct reward scores for architectural decisions.

Evaluate the following architecture/structure decision:

PROMPT:
{{PROMPT}}

RESPONSE:
{{RESPONSE}}

{{CONTEXT}}

Rate on these criteria (each 0-100):
1. **Scalability** (25%): Will this scale well?
2. **Maintainability** (25%): Easy to modify and extend?
3. **Separation** (20%): Proper concern separation?
4. **Patterns** (15%): Correct architectural patterns?
5. **Simplicity** (15%): Not over-engineered?

Respond with JSON only:
{
    "rewardScore": <0-100 weighted overall score>,
    "categoryScores": {
        "scalability": <0-100>,
        "maintainability": <0-100>,
        "separation": <0-100>,
        "patterns": <0-100>,
        "simplicity": <0-100>
    },
    "reasoning": "<brief analysis explaining the scores>"
}`;

const PROMPTS: Record<DirectRLAIFEvaluationType, string> = {
    code: CODE_REWARD_PROMPT,
    design: DESIGN_REWARD_PROMPT,
    error_fix: ERROR_FIX_REWARD_PROMPT,
    architecture: ARCHITECTURE_REWARD_PROMPT,
};

// =============================================================================
// DIRECT-RLAIF SERVICE
// =============================================================================

export class DirectRLAIFService extends EventEmitter {
    private config: DirectRLAIFConfig;
    private anthropic: ReturnType<typeof createAnthropicClient>;
    private cache: Map<string, { result: DirectRewardResult; timestamp: number }> = new Map();
    private concurrentEvals = 0;

    constructor(config?: Partial<DirectRLAIFConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.anthropic = createAnthropicClient();
    }

    // =========================================================================
    // DIRECT REWARD SCORING
    // =========================================================================

    /**
     * Get a direct reward score from the LLM labeler
     */
    async getDirectReward(
        evaluationType: DirectRLAIFEvaluationType,
        prompt: string,
        response: string,
        context?: { buildId?: string; artifactId?: string; additionalContext?: string }
    ): Promise<DirectRewardResult> {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(evaluationType, prompt, response);

        // Check cache
        if (this.config.enableCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.config.cacheTTLMs) {
                this.emit('cache_hit', { evaluationType, cacheKey });
                return cached.result;
            }
        }

        // Wait if too many concurrent evals
        while (this.concurrentEvals >= this.config.maxConcurrentEvals) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.concurrentEvals++;

        try {
            const evalId = `dre_${uuidv4()}`;
            const template = PROMPTS[evaluationType];

            const additionalContext = context?.additionalContext || '';
            const fullPrompt = template
                .replace('{{PROMPT}}', prompt.slice(0, 8000))
                .replace('{{RESPONSE}}', response.slice(0, 12000))
                .replace('{{CONTEXT}}', additionalContext
                    ? `ADDITIONAL CONTEXT:\n${additionalContext.slice(0, 2000)}`
                    : '');

            if (!this.anthropic) {
                throw new Error('Anthropic client not initialized');
            }

            const apiResponse = await this.anthropic.messages.create({
                model: this.config.labelerModel,
                max_tokens: 2000,
                messages: [{ role: 'user', content: fullPrompt }],
            });

            const content = apiResponse.content[0];
            if (!content || content.type !== 'text') {
                throw new Error('Unexpected response type from labeler');
            }

            const parsed = this.parseRewardResponse(content.text);
            const processingTimeMs = Date.now() - startTime;

            const result: DirectRewardResult = {
                evalId,
                rewardScore: parsed.rewardScore,
                categoryScores: parsed.categoryScores,
                reasoning: parsed.reasoning,
                labelerModel: this.config.labelerModel,
                processingTimeMs,
            };

            // Persist to database
            await this.persistEvaluation({
                evalId,
                buildId: context?.buildId,
                artifactId: context?.artifactId,
                evaluationType,
                prompt,
                response,
                context: context?.additionalContext,
                rewardScore: result.rewardScore,
                categoryScores: result.categoryScores,
                reasoning: result.reasoning,
                labelerModel: result.labelerModel,
            });

            // Update cache
            if (this.config.enableCache) {
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
            }

            this.emit('reward_scored', {
                evalId,
                evaluationType,
                score: result.rewardScore,
                processingTimeMs,
            });

            return result;
        } finally {
            this.concurrentEvals--;
        }
    }

    /**
     * Batch evaluate multiple responses for the same prompt
     */
    async batchEvaluate(
        evaluationType: DirectRLAIFEvaluationType,
        prompt: string,
        responses: string[],
        context?: { buildId?: string; additionalContext?: string }
    ): Promise<DirectRewardResult[]> {
        const results = await Promise.all(
            responses.map(response =>
                this.getDirectReward(evaluationType, prompt, response, context)
            )
        );

        this.emit('batch_evaluated', {
            evaluationType,
            count: results.length,
            scores: results.map(r => r.rewardScore),
        });

        return results;
    }

    /**
     * Select the best candidate from multiple responses using direct scoring
     */
    async selectBestCandidate(
        evaluationType: DirectRLAIFEvaluationType,
        prompt: string,
        candidates: string[],
        context?: { buildId?: string; additionalContext?: string }
    ): Promise<{ bestIndex: number; bestScore: number; allResults: DirectRewardResult[] }> {
        const results = await this.batchEvaluate(evaluationType, prompt, candidates, context);

        let bestIndex = 0;
        let bestScore = results[0].rewardScore;

        for (let i = 1; i < results.length; i++) {
            if (results[i].rewardScore > bestScore) {
                bestScore = results[i].rewardScore;
                bestIndex = i;
            }
        }

        this.emit('best_selected', {
            evaluationType,
            bestIndex,
            bestScore,
            candidateCount: candidates.length,
        });

        return { bestIndex, bestScore, allResults: results };
    }

    /**
     * Iteratively improve a response using direct feedback
     */
    async generateWithDirectFeedback(
        evaluationType: DirectRLAIFEvaluationType,
        prompt: string,
        generateFn: (previousResponse: string | null, feedback: string | null) => Promise<string>,
        maxIterations: number = 3,
        targetScore: number = 85,
        context?: { buildId?: string; additionalContext?: string }
    ): Promise<{ finalResponse: string; finalScore: number; iterations: DirectRewardResult[] }> {
        const iterations: DirectRewardResult[] = [];
        let currentResponse: string | null = null;
        let currentFeedback: string | null = null;

        for (let i = 0; i < maxIterations; i++) {
            // Generate new response
            const newResponse = await generateFn(currentResponse, currentFeedback);

            // Evaluate it
            const result = await this.getDirectReward(evaluationType, prompt, newResponse, context);
            iterations.push(result);

            currentResponse = newResponse;
            currentFeedback = result.reasoning;

            // Check if we've reached target
            if (result.rewardScore >= targetScore) {
                this.emit('target_reached', {
                    evaluationType,
                    iterations: i + 1,
                    finalScore: result.rewardScore,
                });
                break;
            }
        }

        const finalResult = iterations[iterations.length - 1];

        return {
            finalResponse: currentResponse!,
            finalScore: finalResult.rewardScore,
            iterations,
        };
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get recent evaluations
     */
    async getRecentEvaluations(
        evaluationType?: DirectRLAIFEvaluationType,
        limit: number = 100
    ): Promise<Array<{
        evalId: string;
        evaluationType: string;
        rewardScore: number;
        reasoning: string;
        createdAt: Date;
    }>> {
        // Build query based on whether we have an evaluation type filter
        const rows = evaluationType
            ? await db.select()
                .from(learningDirectRLAIFEvals)
                .where(eq(learningDirectRLAIFEvals.evaluationType, evaluationType))
                .orderBy(desc(learningDirectRLAIFEvals.createdAt))
                .limit(limit)
            : await db.select()
                .from(learningDirectRLAIFEvals)
                .orderBy(desc(learningDirectRLAIFEvals.createdAt))
                .limit(limit);

        return rows.map(row => ({
            evalId: row.evalId,
            evaluationType: row.evaluationType,
            rewardScore: row.rewardScore,
            reasoning: row.reasoning,
            createdAt: new Date(row.createdAt),
        }));
    }

    /**
     * Get unused evaluations for training
     */
    async getUnusedForTraining(limit: number = 500): Promise<Array<{
        evalId: string;
        evaluationType: string;
        prompt: string;
        response: string;
        rewardScore: number;
    }>> {
        const rows = await db.select()
            .from(learningDirectRLAIFEvals)
            .where(eq(learningDirectRLAIFEvals.usedInTraining, false))
            .orderBy(desc(learningDirectRLAIFEvals.rewardScore))
            .limit(limit);

        return rows.map(row => ({
            evalId: row.evalId,
            evaluationType: row.evaluationType,
            prompt: row.prompt,
            response: row.response,
            rewardScore: row.rewardScore,
        }));
    }

    /**
     * Mark evaluations as used in training
     */
    async markAsUsedInTraining(evalIds: string[]): Promise<void> {
        for (const evalId of evalIds) {
            await db.update(learningDirectRLAIFEvals)
                .set({ usedInTraining: true })
                .where(eq(learningDirectRLAIFEvals.evalId, evalId));
        }
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<{
        totalEvals: number;
        avgScore: number;
        byType: Record<string, { count: number; avgScore: number }>;
        recentScores: number[];
    }> {
        const all = await db.select().from(learningDirectRLAIFEvals);

        if (all.length === 0) {
            return {
                totalEvals: 0,
                avgScore: 0,
                byType: {},
                recentScores: [],
            };
        }

        const byType: Record<string, { count: number; totalScore: number }> = {};
        let totalScore = 0;

        for (const row of all) {
            totalScore += row.rewardScore;
            if (!byType[row.evaluationType]) {
                byType[row.evaluationType] = { count: 0, totalScore: 0 };
            }
            byType[row.evaluationType].count++;
            byType[row.evaluationType].totalScore += row.rewardScore;
        }

        const byTypeAvg: Record<string, { count: number; avgScore: number }> = {};
        for (const [type, stats] of Object.entries(byType)) {
            byTypeAvg[type] = {
                count: stats.count,
                avgScore: stats.totalScore / stats.count,
            };
        }

        // Get recent scores (last 20)
        const recent = all
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 20)
            .map(r => r.rewardScore);

        return {
            totalEvals: all.length,
            avgScore: totalScore / all.length,
            byType: byTypeAvg,
            recentScores: recent,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private generateCacheKey(
        evaluationType: DirectRLAIFEvaluationType,
        prompt: string,
        response: string
    ): string {
        // Simple hash for caching
        const content = `${evaluationType}:${prompt.slice(0, 500)}:${response.slice(0, 500)}`;
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `dre_cache_${hash}`;
    }

    private parseRewardResponse(text: string): {
        rewardScore: number;
        categoryScores: Record<string, number>;
        reasoning: string;
    } {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                rewardScore: Math.max(0, Math.min(100, parsed.rewardScore || 50)),
                categoryScores: parsed.categoryScores || {},
                reasoning: parsed.reasoning || 'No reasoning provided',
            };
        } catch (error) {
            console.error('[DirectRLAIF] Failed to parse reward response:', error);
            return {
                rewardScore: 50,
                categoryScores: {},
                reasoning: text.slice(0, 500),
            };
        }
    }

    private async persistEvaluation(data: {
        evalId: string;
        buildId?: string;
        artifactId?: string;
        evaluationType: DirectRLAIFEvaluationType;
        prompt: string;
        response: string;
        context?: string;
        rewardScore: number;
        categoryScores: Record<string, number>;
        reasoning: string;
        labelerModel: string;
    }): Promise<void> {
        try {
            await db.insert(learningDirectRLAIFEvals).values({
                id: uuidv4(),
                evalId: data.evalId,
                buildId: data.buildId,
                artifactId: data.artifactId,
                evaluationType: data.evaluationType,
                prompt: data.prompt,
                response: data.response,
                context: data.context ? { additionalContext: data.context } : undefined,
                rewardScore: data.rewardScore,
                categoryScores: data.categoryScores,
                reasoning: data.reasoning,
                labelerModel: data.labelerModel,
                usedInTraining: false,
            });
        } catch (error) {
            console.error('[DirectRLAIF] Failed to persist evaluation:', error);
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
        this.emit('cache_cleared');
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: DirectRLAIFService | null = null;

export function getDirectRLAIF(config?: Partial<DirectRLAIFConfig>): DirectRLAIFService {
    if (!instance) {
        instance = new DirectRLAIFService(config);
    }
    return instance;
}

export function resetDirectRLAIF(): void {
    instance = null;
}
