/**
 * Multi-Judge Consensus Service
 *
 * Implements ensemble AI judging where multiple models provide feedback
 * and a consensus mechanism combines their evaluations.
 *
 * This reduces risk of reinforcing unwanted behaviors that single-judge
 * systems can exhibit, providing more reliable quality scores.
 */

import { db } from '../../db.js';
import { learningJudgeConsensus } from '../../schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';

// Local type definitions for Multi-Judge
export interface JudgeConfig {
    model: string;
    weight: number;
}

export interface IndividualJudgeScore {
    model: string;
    score: number;
    reasoning: string;
    latencyMs: number;
}

export interface ConsensusResult {
    consensusId: string;
    judgmentId: string;
    judges: JudgeConfig[];
    individualScores: IndividualJudgeScore[];
    consensusScore: number;
    disagreementLevel: number;
    finalVerdict: string;
    reasoning: string;
}

export interface MultiJudgeConfig {
    enableConsensus: boolean;
    disagreementThreshold: number;
    tieBreakModel: string;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: MultiJudgeConfig = {
    enableConsensus: true,
    disagreementThreshold: 20, // Trigger analysis if scores diverge >20 points
    tieBreakModel: 'anthropic/claude-sonnet-4-20250514',
};

// =============================================================================
// JUDGE PANELS BY CATEGORY
// =============================================================================

export const JUDGE_PANELS: Record<string, JudgeConfig[]> = {
    code_quality: [
        { model: 'anthropic/claude-sonnet-4-20250514', weight: 0.4 },
        { model: 'openai/gpt-4o', weight: 0.35 },
        { model: 'google/gemini-2.0-flash-001', weight: 0.25 },
    ],
    design_quality: [
        { model: 'anthropic/claude-sonnet-4-20250514', weight: 0.45 },
        { model: 'openai/gpt-4o', weight: 0.35 },
        { model: 'google/gemini-2.0-flash-001', weight: 0.2 },
    ],
    error_fix: [
        { model: 'anthropic/claude-sonnet-4-20250514', weight: 0.45 },
        { model: 'openai/gpt-4o', weight: 0.35 },
        { model: 'deepseek/deepseek-chat', weight: 0.2 },
    ],
    architecture: [
        { model: 'anthropic/claude-sonnet-4-20250514', weight: 0.5 },
        { model: 'openai/gpt-4o', weight: 0.3 },
        { model: 'google/gemini-2.0-flash-001', weight: 0.2 },
    ],
};

// =============================================================================
// JUDGE PROMPT
// =============================================================================

const JUDGE_PROMPT = `You are an expert evaluator providing a quality score for AI-generated content.

CATEGORY: {{CATEGORY}}

ARTIFACT TO EVALUATE:
{{ARTIFACT}}

CONTEXT:
{{CONTEXT}}

Evaluate the quality of this artifact on a scale of 0-100.
Consider correctness, completeness, style, and best practices.

Respond with JSON only:
{
    "score": <0-100>,
    "reasoning": "<brief explanation of your score>"
}`;

// =============================================================================
// MULTI-JUDGE SERVICE
// =============================================================================

export class MultiJudgeService extends EventEmitter {
    private config: MultiJudgeConfig;
    private anthropic: ReturnType<typeof createAnthropicClient>;

    constructor(config?: Partial<MultiJudgeConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.anthropic = createAnthropicClient();
    }

    // =========================================================================
    // CONSENSUS EVALUATION
    // =========================================================================

    /**
     * Evaluate an artifact using multiple judges and return consensus
     */
    async evaluateWithConsensus(
        category: string,
        artifact: string,
        context?: { judgmentId?: string; artifactId?: string; additionalContext?: string }
    ): Promise<ConsensusResult> {
        const judges = this.configureJudgePanel(category);
        const consensusId = `con_${uuidv4()}`;
        const judgmentId = context?.judgmentId || `jdg_${uuidv4()}`;

        // Get scores from all judges in parallel
        const scorePromises = judges.map(judge =>
            this.getJudgeScore(judge.model, category, artifact, context?.additionalContext)
        );

        const settledResults = await Promise.allSettled(scorePromises);

        const individualScores: IndividualJudgeScore[] = [];
        for (let i = 0; i < settledResults.length; i++) {
            const result = settledResults[i];
            if (result.status === 'fulfilled') {
                individualScores.push({
                    model: judges[i].model,
                    score: result.value.score,
                    reasoning: result.value.reasoning,
                    latencyMs: result.value.latencyMs,
                });
            } else {
                console.error(`[MultiJudge] Judge ${judges[i].model} failed:`, result.reason);
                // Use default score for failed judge
                individualScores.push({
                    model: judges[i].model,
                    score: 50,
                    reasoning: 'Judge evaluation failed',
                    latencyMs: 0,
                });
            }
        }

        // Calculate weighted consensus
        const { consensusScore, disagreementLevel } = this.calculateConsensus(
            individualScores,
            judges
        );

        // Resolve disagreement if needed
        let finalVerdict: string;
        let reasoning: string;

        if (disagreementLevel > this.config.disagreementThreshold) {
            const resolution = await this.resolveDisagreement(
                category,
                artifact,
                individualScores,
                context?.additionalContext
            );
            finalVerdict = resolution.verdict;
            reasoning = resolution.reasoning;
        } else {
            finalVerdict = this.scoreToVerdict(consensusScore);
            reasoning = this.generateConsensusReasoning(individualScores);
        }

        const result: ConsensusResult = {
            consensusId,
            judgmentId,
            judges,
            individualScores,
            consensusScore,
            disagreementLevel,
            finalVerdict,
            reasoning,
        };

        // Persist to database
        await this.persistConsensus(result, context?.artifactId);

        this.emit('consensus_reached', {
            consensusId,
            category,
            consensusScore,
            disagreementLevel,
            judgeCount: individualScores.length,
        });

        return result;
    }

    /**
     * Configure the judge panel for a category
     */
    configureJudgePanel(category: string): JudgeConfig[] {
        const panel = JUDGE_PANELS[category];
        if (panel) {
            return panel;
        }

        // Default panel for unknown categories
        return [
            { model: 'anthropic/claude-sonnet-4-20250514', weight: 0.5 },
            { model: 'openai/gpt-4o', weight: 0.5 },
        ];
    }

    // =========================================================================
    // INDIVIDUAL JUDGE EVALUATION
    // =========================================================================

    /**
     * Get score from a single judge
     */
    private async getJudgeScore(
        model: string,
        category: string,
        artifact: string,
        additionalContext?: string
    ): Promise<{ score: number; reasoning: string; latencyMs: number }> {
        const startTime = Date.now();

        const prompt = JUDGE_PROMPT
            .replace('{{CATEGORY}}', category)
            .replace('{{ARTIFACT}}', artifact.slice(0, 15000))
            .replace('{{CONTEXT}}', additionalContext || 'No additional context');

        try {
            // Use Anthropic for all models, mapping to appropriate model
            const anthropicModel = model.startsWith('anthropic/')
                ? model.replace('anthropic/', '')
                : 'claude-sonnet-4-20250514'; // Default to Sonnet for non-Anthropic models

            if (!this.anthropic) {
                throw new Error('Anthropic client not initialized');
            }

            const response = await this.anthropic.messages.create({
                model: anthropicModel,
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }],
            });
            const content = response.content[0];
            const responseText = content && content.type === 'text' ? content.text : '';

            const parsed = this.parseJudgeResponse(responseText);
            const latencyMs = Date.now() - startTime;

            return {
                score: parsed.score,
                reasoning: parsed.reasoning,
                latencyMs,
            };
        } catch (error) {
            console.error(`[MultiJudge] Failed to get score from ${model}:`, error);
            throw error;
        }
    }

    // =========================================================================
    // CONSENSUS CALCULATION
    // =========================================================================

    /**
     * Calculate weighted consensus score
     */
    private calculateConsensus(
        scores: IndividualJudgeScore[],
        judges: JudgeConfig[]
    ): { consensusScore: number; disagreementLevel: number } {
        let weightedSum = 0;
        let totalWeight = 0;

        for (let i = 0; i < scores.length; i++) {
            const weight = judges[i]?.weight || 1 / scores.length;
            weightedSum += scores[i].score * weight;
            totalWeight += weight;
        }

        const consensusScore = totalWeight > 0 ? weightedSum / totalWeight : 50;

        // Calculate disagreement (max spread between scores)
        const scoreValues = scores.map(s => s.score);
        const maxScore = Math.max(...scoreValues);
        const minScore = Math.min(...scoreValues);
        const disagreementLevel = maxScore - minScore;

        return { consensusScore, disagreementLevel };
    }

    /**
     * Resolve significant disagreement between judges
     */
    private async resolveDisagreement(
        category: string,
        artifact: string,
        scores: IndividualJudgeScore[],
        additionalContext?: string
    ): Promise<{ verdict: string; reasoning: string }> {
        const disagreementPrompt = `You are a senior arbiter resolving a disagreement between AI judges.

CATEGORY: ${category}

ARTIFACT:
${artifact.slice(0, 10000)}

JUDGE SCORES:
${scores.map(s => `${s.model}: ${s.score}/100 - "${s.reasoning}"`).join('\n')}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ''}

The judges significantly disagree. Analyze their reasoning and provide a final verdict.

Respond with JSON:
{
    "finalScore": <0-100>,
    "verdict": "APPROVED" | "NEEDS_WORK" | "BLOCKED" | "REJECTED",
    "reasoning": "<explanation of your decision>"
}`;

        try {
            if (!this.anthropic) {
                throw new Error('Anthropic client not initialized');
            }

            const response = await this.anthropic.messages.create({
                model: this.config.tieBreakModel.replace('anthropic/', ''),
                max_tokens: 1500,
                messages: [{ role: 'user', content: disagreementPrompt }],
            });

            const content = response.content[0];
            if (!content || content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            this.emit('disagreement_resolved', {
                category,
                originalScores: scores.map(s => s.score),
                finalScore: parsed.finalScore,
                verdict: parsed.verdict,
            });

            return {
                verdict: parsed.verdict || this.scoreToVerdict(parsed.finalScore || 50),
                reasoning: parsed.reasoning || 'Disagreement resolved by arbiter',
            };
        } catch (error) {
            console.error('[MultiJudge] Failed to resolve disagreement:', error);
            // Fall back to average
            const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
            return {
                verdict: this.scoreToVerdict(avgScore),
                reasoning: 'Disagreement resolution failed, using average score',
            };
        }
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get consensus statistics
     */
    async getStats(): Promise<{
        totalConsensus: number;
        avgConsensusScore: number;
        avgDisagreement: number;
        byCategory: Record<string, { count: number; avgScore: number }>;
    }> {
        const all = await db.select().from(learningJudgeConsensus);

        if (all.length === 0) {
            return {
                totalConsensus: 0,
                avgConsensusScore: 0,
                avgDisagreement: 0,
                byCategory: {},
            };
        }

        let totalScore = 0;
        let totalDisagreement = 0;

        for (const row of all) {
            totalScore += row.consensusScore;
            totalDisagreement += row.disagreementLevel || 0;
        }

        return {
            totalConsensus: all.length,
            avgConsensusScore: totalScore / all.length,
            avgDisagreement: totalDisagreement / all.length,
            byCategory: {}, // Would need category tracking in schema
        };
    }

    /**
     * Get recent consensus records
     */
    async getRecentConsensus(limit: number = 50): Promise<ConsensusResult[]> {
        const rows = await db.select()
            .from(learningJudgeConsensus)
            .orderBy(desc(learningJudgeConsensus.createdAt))
            .limit(limit);

        return rows.map(row => ({
            consensusId: row.consensusId,
            judgmentId: row.judgmentId,
            judges: (row.judges as JudgeConfig[]) || [],
            individualScores: (row.individualScores as IndividualJudgeScore[]) || [],
            consensusScore: row.consensusScore || 0,
            disagreementLevel: row.disagreementLevel || 0,
            finalVerdict: row.finalVerdict,
            reasoning: row.reasoning || '',
        }));
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private parseJudgeResponse(text: string): { score: number; reasoning: string } {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return {
                score: Math.max(0, Math.min(100, parsed.score || 50)),
                reasoning: parsed.reasoning || 'No reasoning provided',
            };
        } catch {
            return { score: 50, reasoning: text.slice(0, 500) };
        }
    }

    private scoreToVerdict(score: number): string {
        if (score >= 85) return 'APPROVED';
        if (score >= 70) return 'NEEDS_WORK';
        if (score >= 50) return 'BLOCKED';
        return 'REJECTED';
    }

    private generateConsensusReasoning(scores: IndividualJudgeScore[]): string {
        const summaries = scores.map(s =>
            `${s.model.split('/').pop()}: ${s.score}/100`
        ).join(', ');
        return `Consensus from ${scores.length} judges: ${summaries}`;
    }

    private async persistConsensus(
        result: ConsensusResult,
        artifactId?: string
    ): Promise<void> {
        try {
            await db.insert(learningJudgeConsensus).values({
                id: uuidv4(),
                consensusId: result.consensusId,
                judgmentId: result.judgmentId,
                artifactId,
                judges: result.judges,
                individualScores: result.individualScores,
                consensusScore: result.consensusScore,
                disagreementLevel: result.disagreementLevel,
                finalVerdict: result.finalVerdict,
                reasoning: result.reasoning,
            });
        } catch (error) {
            console.error('[MultiJudge] Failed to persist consensus:', error);
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: MultiJudgeService | null = null;

export function getMultiJudge(config?: Partial<MultiJudgeConfig>): MultiJudgeService {
    if (!instance) {
        instance = new MultiJudgeService(config);
    }
    return instance;
}

export function resetMultiJudge(): void {
    instance = null;
}
