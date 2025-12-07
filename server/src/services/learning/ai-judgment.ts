// @ts-nocheck - Learning module has complex nullable types from DB schema
/**
 * AI Judgment Service (Layer 2 - RLAIF)
 *
 * Implements AI judges that evaluate build artifacts and generate
 * preference pairs for reinforcement learning from AI feedback.
 *
 * Judges:
 * 1. Code Quality Judge - Evaluates code structure, patterns, maintainability
 * 2. Design Quality Judge - Evaluates visual design against Anti-Slop principles
 * 3. Success Predictor - Predicts likelihood of successful build completion
 * 4. Preference Pair Generator - Creates training data from judge evaluations
 */

import { db } from '../../db.js';
import { learningJudgments, learningPreferencePairs } from '../../schema.js';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';
import type {
    Judgment,
    JudgmentScores,
    JudgmentIssue,
    JudgeType,
    PreferencePair,
    PreferenceDomain,
    DecisionTrace,
    CodeArtifactTrace,
    DesignChoiceTrace,
    ErrorRecoveryTrace,
    JudgmentConfig,
} from './types.js';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: JudgmentConfig = {
    enableCodeQualityJudge: true,
    enableDesignQualityJudge: true,
    enableSuccessPredictor: true,
    enableAntiSlopJudge: true,
    judgmentModel: 'anthropic/claude-sonnet-4-20250514',
    thinkingBudget: 8000,
};

// =============================================================================
// PROMPTS
// =============================================================================

const CODE_QUALITY_PROMPT = `You are a senior code quality expert judging AI-generated code.

Evaluate the following code on these criteria (0-100 each):
1. **Structure**: Clean architecture, proper separation of concerns
2. **Patterns**: Correct use of React patterns, hooks, TypeScript
3. **Maintainability**: Readable, documented, testable
4. **Security**: No vulnerabilities, proper validation
5. **Performance**: No obvious performance issues

Respond with JSON:
{
    "scores": {
        "overall": <0-100>,
        "categories": {
            "structure": <0-100>,
            "patterns": <0-100>,
            "maintainability": <0-100>,
            "security": <0-100>,
            "performance": <0-100>
        }
    },
    "issues": [
        {
            "category": "<category>",
            "severity": "critical|major|minor",
            "description": "<issue description>",
            "location": "<file:line or component name>",
            "suggestion": "<how to fix>"
        }
    ],
    "recommendations": ["<improvement suggestion>"],
    "reasoning": "<your analysis>"
}`;

const DESIGN_QUALITY_PROMPT = `You are an elite UI/UX designer judging AI-generated designs against the Anti-Slop Design Manifesto.

ANTI-SLOP PRINCIPLES:
- Depth & Atmosphere: No flat white/gray backgrounds. Use gradients, patterns, contextual effects
- Motion & Life: Meaningful animations, orchestrated reveals, micro-interactions
- Typography: Distinctive fonts, NOT Inter/Arial/system fonts. Typography with character
- Color with Courage: Bold palettes, sharp accents, committed aesthetic choices
- Soul & Context: Design that matches the app's purpose and personality

Evaluate:
1. **Depth Score**: Visual layering, backgrounds, shadows, atmosphere
2. **Motion Score**: Animation quality, timing, purposeful movement
3. **Typography Score**: Font choices, hierarchy, distinctiveness
4. **Soul Match Score**: Does design embody the app's personality?
5. **Overall Anti-Slop**: Is this genuinely designed, not "AI generic"?

Respond with JSON:
{
    "scores": {
        "overall": <0-100>,
        "categories": {
            "depth": <0-100>,
            "motion": <0-100>,
            "typography": <0-100>,
            "soulMatch": <0-100>,
            "antiSlop": <0-100>
        }
    },
    "issues": [
        {
            "category": "<category>",
            "severity": "critical|major|minor",
            "description": "<issue description>",
            "suggestion": "<how to fix>"
        }
    ],
    "recommendations": ["<design improvement>"],
    "reasoning": "<your analysis>"
}`;

const SUCCESS_PREDICTOR_PROMPT = `You are predicting the likelihood of successful build completion.

Based on the current build state, predict:
1. **Completion Probability**: Will this build complete successfully? (0-100)
2. **Risk Factors**: What could cause failure?
3. **Time to Completion**: Estimated remaining time
4. **Blocking Issues**: Issues that must be resolved

Respond with JSON:
{
    "scores": {
        "overall": <0-100 completion probability>,
        "categories": {
            "codeHealth": <0-100>,
            "integrationRisk": <0-100>,
            "designCompleteness": <0-100>,
            "testCoverage": <0-100>
        }
    },
    "issues": [
        {
            "category": "risk",
            "severity": "critical|major|minor",
            "description": "<risk description>",
            "suggestion": "<mitigation>"
        }
    ],
    "recommendations": ["<what to prioritize>"],
    "reasoning": "<your analysis>"
}`;

// =============================================================================
// AI JUDGMENT SERVICE
// =============================================================================

export class AIJudgmentService extends EventEmitter {
    private config: JudgmentConfig;
    private anthropic: ReturnType<typeof createAnthropicClient>;

    constructor(config?: Partial<JudgmentConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.anthropic = createAnthropicClient();
    }

    // =========================================================================
    // CODE QUALITY JUDGE
    // =========================================================================

    /**
     * Judge code quality for an artifact
     */
    async judgeCodeQuality(
        artifact: CodeArtifactTrace,
        context?: { buildId?: string; projectId?: string; userId: string }
    ): Promise<Judgment> {
        if (!this.config.enableCodeQualityJudge) {
            throw new Error('Code quality judge is disabled');
        }

        const latestVersion = artifact.versions[artifact.versions.length - 1];
        if (!latestVersion) {
            throw new Error('No code version to judge');
        }

        const judgmentId = `jdg_${uuidv4()}`;
        const prompt = `${CODE_QUALITY_PROMPT}

FILE: ${artifact.filePath}
CODE:
\`\`\`
${latestVersion.code.slice(0, 15000)}
\`\`\`

Quality trajectory: ${JSON.stringify(artifact.qualityTrajectory.slice(-5))}
Patterns used: ${JSON.stringify(artifact.patternsUsed)}`;

        try {
            const response = await this.anthropic.messages.create({
                model: this.config.judgmentModel,
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            const result = this.parseJudgmentResponse(content.text);

            const judgment: Judgment = {
                judgmentId,
                artifactId: artifact.artifactId,
                buildId: context?.buildId,
                projectId: context?.projectId,
                userId: context?.userId || artifact.userId,
                judgeType: 'code_quality',
                modelUsed: this.config.judgmentModel,
                thinkingTrace: result.reasoning,
                scores: result.scores,
                issues: result.issues,
                recommendations: result.recommendations,
                createdAt: new Date(),
            };

            await this.persistJudgment(judgment);
            this.emit('judgment_complete', { judgmentId, type: 'code_quality', score: result.scores.overall });

            return judgment;
        } catch (error) {
            console.error('[AIJudgment] Code quality judgment failed:', error);
            throw error;
        }
    }

    // =========================================================================
    // DESIGN QUALITY JUDGE
    // =========================================================================

    /**
     * Judge design quality against Anti-Slop principles
     */
    async judgeDesignQuality(
        designChoice: DesignChoiceTrace,
        codeArtifacts?: CodeArtifactTrace[],
        context?: { buildId?: string; projectId?: string; userId: string }
    ): Promise<Judgment> {
        if (!this.config.enableDesignQualityJudge) {
            throw new Error('Design quality judge is disabled');
        }

        const judgmentId = `jdg_${uuidv4()}`;

        // Collect CSS and styling code from artifacts
        const styleCode = codeArtifacts
            ?.filter(a => a.filePath.match(/\.(css|scss|tsx|jsx)$/))
            .map(a => {
                const latest = a.versions[a.versions.length - 1];
                return latest ? `// ${a.filePath}\n${latest.code.slice(0, 3000)}` : '';
            })
            .join('\n\n')
            .slice(0, 20000);

        const prompt = `${DESIGN_QUALITY_PROMPT}

APP SOUL: ${designChoice.appSoul || 'Not specified'}

TYPOGRAPHY CHOICES:
${JSON.stringify(designChoice.typography, null, 2)}

COLOR SYSTEM:
${JSON.stringify(designChoice.colorSystem, null, 2)}

MOTION LANGUAGE:
${JSON.stringify(designChoice.motionLanguage, null, 2)}

LAYOUT DECISIONS:
${JSON.stringify(designChoice.layoutDecisions, null, 2)}

STYLE CODE SAMPLES:
\`\`\`
${styleCode || 'No style code provided'}
\`\`\``;

        try {
            const response = await this.anthropic.messages.create({
                model: this.config.judgmentModel,
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            const result = this.parseJudgmentResponse(content.text);

            const judgment: Judgment = {
                judgmentId,
                choiceId: designChoice.choiceId,
                buildId: context?.buildId,
                projectId: context?.projectId,
                userId: context?.userId || designChoice.userId,
                judgeType: 'design_quality',
                modelUsed: this.config.judgmentModel,
                thinkingTrace: result.reasoning,
                scores: result.scores,
                issues: result.issues,
                recommendations: result.recommendations,
                createdAt: new Date(),
            };

            await this.persistJudgment(judgment);
            this.emit('judgment_complete', { judgmentId, type: 'design_quality', score: result.scores.overall });

            return judgment;
        } catch (error) {
            console.error('[AIJudgment] Design quality judgment failed:', error);
            throw error;
        }
    }

    // =========================================================================
    // SUCCESS PREDICTOR
    // =========================================================================

    /**
     * Predict build success probability
     */
    async predictSuccess(
        buildState: {
            phase: string;
            completedFeatures: number;
            totalFeatures: number;
            errorCount: number;
            codeArtifacts: CodeArtifactTrace[];
            recentDecisions: DecisionTrace[];
        },
        context: { buildId: string; projectId?: string; userId: string }
    ): Promise<Judgment> {
        if (!this.config.enableSuccessPredictor) {
            throw new Error('Success predictor is disabled');
        }

        const judgmentId = `jdg_${uuidv4()}`;

        const recentQuality = buildState.codeArtifacts
            .slice(-5)
            .flatMap(a => a.qualityTrajectory.slice(-1))
            .map(q => q.codeQualityScore);

        const avgQuality = recentQuality.length > 0
            ? recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length
            : 50;

        const prompt = `${SUCCESS_PREDICTOR_PROMPT}

BUILD STATE:
- Current Phase: ${buildState.phase}
- Progress: ${buildState.completedFeatures}/${buildState.totalFeatures} features
- Error Count: ${buildState.errorCount}
- Average Code Quality: ${avgQuality.toFixed(1)}
- Files Modified: ${buildState.codeArtifacts.length}

RECENT DECISIONS:
${buildState.recentDecisions.slice(-5).map(d =>
    `- ${d.decisionType}: ${d.decision.chosenOption} (confidence: ${d.decision.confidence})`
).join('\n')}

QUALITY TRENDS:
${JSON.stringify(buildState.codeArtifacts.slice(-3).map(a => ({
    file: a.filePath,
    versions: a.versions.length,
    quality: a.qualityTrajectory.slice(-1)[0]?.codeQualityScore || 'N/A'
})), null, 2)}`;

        try {
            const response = await this.anthropic.messages.create({
                model: this.config.judgmentModel,
                max_tokens: 3000,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            const result = this.parseJudgmentResponse(content.text);

            const judgment: Judgment = {
                judgmentId,
                buildId: context.buildId,
                projectId: context.projectId,
                userId: context.userId,
                judgeType: 'success_predictor',
                modelUsed: this.config.judgmentModel,
                thinkingTrace: result.reasoning,
                scores: result.scores,
                issues: result.issues,
                recommendations: result.recommendations,
                createdAt: new Date(),
            };

            await this.persistJudgment(judgment);
            this.emit('judgment_complete', { judgmentId, type: 'success_predictor', score: result.scores.overall });

            return judgment;
        } catch (error) {
            console.error('[AIJudgment] Success prediction failed:', error);
            throw error;
        }
    }

    // =========================================================================
    // PREFERENCE PAIR GENERATION
    // =========================================================================

    /**
     * Generate preference pairs from decision traces
     */
    async generatePreferencePairs(
        traces: DecisionTrace[],
        domain: PreferenceDomain = 'code'
    ): Promise<PreferencePair[]> {
        const pairs: PreferencePair[] = [];

        // Filter traces with outcomes
        const tracesWithOutcomes = traces.filter(t =>
            t.outcome && t.decision.rejectedOptions.length > 0
        );

        for (const trace of tracesWithOutcomes) {
            if (!trace.outcome) continue;

            // Generate pair for each rejected option
            for (const rejectedOption of trace.decision.rejectedOptions) {
                const wasSuccessful = trace.outcome.immediateResult === 'success';

                // Calculate margin based on outcome quality
                const margin = this.calculatePreferenceMargin(trace);

                // Only create pairs where outcome clearly indicates preference
                if (margin < 20) continue;

                const pair: PreferencePair = {
                    pairId: `pp_${uuidv4()}`,
                    domain,
                    prompt: this.constructPairPrompt(trace),
                    chosen: wasSuccessful ? trace.decision.chosenOption : rejectedOption,
                    rejected: wasSuccessful ? rejectedOption : trace.decision.chosenOption,
                    judgmentReasoning: trace.decision.reasoning,
                    margin,
                    sourceTraceId: trace.traceId,
                    usedInTraining: false,
                    createdAt: new Date(),
                };

                await this.persistPreferencePair(pair);
                pairs.push(pair);
            }
        }

        this.emit('pairs_generated', { count: pairs.length, domain });
        console.log(`[AIJudgment] Generated ${pairs.length} preference pairs for ${domain}`);

        return pairs;
    }

    /**
     * Generate preference pairs from code quality judgments
     */
    async generateCodePreferencePairs(
        artifacts: CodeArtifactTrace[],
        judgments: Map<string, Judgment>
    ): Promise<PreferencePair[]> {
        const pairs: PreferencePair[] = [];

        // Group artifacts by file type/purpose
        const componentFiles = artifacts.filter(a => a.filePath.match(/\.(tsx|jsx)$/));

        // Compare versions within same file - earlier vs later if quality improved
        for (const artifact of componentFiles) {
            if (artifact.versions.length < 2) continue;

            const qualityPoints = artifact.qualityTrajectory;
            if (qualityPoints.length < 2) continue;

            // Find quality improvements
            for (let i = 1; i < qualityPoints.length; i++) {
                const before = qualityPoints[i - 1];
                const after = qualityPoints[i];

                if (after.codeQualityScore - before.codeQualityScore > 10) {
                    const beforeVersion = artifact.versions.find(v => v.timestamp <= before.timestamp);
                    const afterVersion = artifact.versions.find(v => v.timestamp >= after.timestamp);

                    if (beforeVersion && afterVersion && beforeVersion.code !== afterVersion.code) {
                        const pair: PreferencePair = {
                            pairId: `pp_${uuidv4()}`,
                            domain: 'code',
                            prompt: `Implement the component for ${artifact.filePath}`,
                            chosen: afterVersion.code.slice(0, 5000),
                            rejected: beforeVersion.code.slice(0, 5000),
                            judgmentReasoning: `Quality improved from ${before.codeQualityScore} to ${after.codeQualityScore}`,
                            margin: after.codeQualityScore - before.codeQualityScore,
                            usedInTraining: false,
                            createdAt: new Date(),
                        };

                        await this.persistPreferencePair(pair);
                        pairs.push(pair);
                    }
                }
            }
        }

        return pairs;
    }

    /**
     * Generate preference pairs from error recovery successes
     */
    async generateErrorFixPreferencePairs(
        recoveries: ErrorRecoveryTrace[]
    ): Promise<PreferencePair[]> {
        const pairs: PreferencePair[] = [];

        for (const recovery of recoveries) {
            if (!recovery.successfulFix) continue;

            // Find failed attempts to contrast with success
            const failedAttempts = recovery.recoveryJourney.filter(a => a.result === 'failed');

            for (const failed of failedAttempts) {
                const pair: PreferencePair = {
                    pairId: `pp_${uuidv4()}`,
                    domain: 'error_fix',
                    prompt: `Fix error: ${recovery.error.type} - ${recovery.error.message}\nLocation: ${recovery.error.fileLocation}`,
                    chosen: recovery.successfulFix.fixDescription,
                    rejected: failed.fixApplied,
                    judgmentReasoning: `Successful fix at level ${recovery.successfulFix.levelRequired} vs failed at level ${failed.level}`,
                    margin: (recovery.successfulFix.levelRequired - failed.level + 1) * 20,
                    sourceTraceId: recovery.errorId,
                    usedInTraining: false,
                    createdAt: new Date(),
                };

                await this.persistPreferencePair(pair);
                pairs.push(pair);
            }
        }

        return pairs;
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get judgments for a build
     */
    async getJudgmentsForBuild(buildId: string): Promise<Judgment[]> {
        const rows = await db.select()
            .from(learningJudgments)
            .where(eq(learningJudgments.buildId, buildId))
            .orderBy(desc(learningJudgments.createdAt));

        return rows.map(this.mapJudgmentRow);
    }

    /**
     * Get recent judgments by type
     */
    async getRecentJudgments(type: JudgeType, limit: number = 100): Promise<Judgment[]> {
        const rows = await db.select()
            .from(learningJudgments)
            .where(eq(learningJudgments.judgeType, type))
            .orderBy(desc(learningJudgments.createdAt))
            .limit(limit);

        return rows.map(this.mapJudgmentRow);
    }

    /**
     * Get unused preference pairs for training
     */
    async getUnusedPreferencePairs(
        domain?: PreferenceDomain,
        limit: number = 1000
    ): Promise<PreferencePair[]> {
        let query = db.select()
            .from(learningPreferencePairs)
            .where(eq(learningPreferencePairs.usedInTraining, false))
            .orderBy(desc(learningPreferencePairs.margin))
            .limit(limit);

        if (domain) {
            query = db.select()
                .from(learningPreferencePairs)
                .where(and(
                    eq(learningPreferencePairs.usedInTraining, false),
                    eq(learningPreferencePairs.domain, domain)
                ))
                .orderBy(desc(learningPreferencePairs.margin))
                .limit(limit);
        }

        const rows = await query;
        return rows.map(this.mapPreferencePairRow);
    }

    /**
     * Mark preference pairs as used in training
     */
    async markPairsAsUsed(pairIds: string[], trainingRunId: string): Promise<void> {
        for (const pairId of pairIds) {
            await db.update(learningPreferencePairs)
                .set({
                    usedInTraining: true,
                    trainingRunId,
                })
                .where(eq(learningPreferencePairs.pairId, pairId));
        }
    }

    /**
     * Get preference pair statistics
     */
    async getPreferencePairStats(): Promise<{
        total: number;
        unused: number;
        byDomain: Record<string, number>;
        avgMargin: number;
    }> {
        const all = await db.select().from(learningPreferencePairs);

        const unused = all.filter(p => !p.usedInTraining).length;
        const byDomain: Record<string, number> = {};
        let totalMargin = 0;

        for (const pair of all) {
            byDomain[pair.domain] = (byDomain[pair.domain] || 0) + 1;
            totalMargin += pair.margin ?? 0;
        }

        return {
            total: all.length,
            unused,
            byDomain,
            avgMargin: all.length > 0 ? totalMargin / all.length : 0,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private parseJudgmentResponse(text: string): {
        scores: JudgmentScores;
        issues: JudgmentIssue[];
        recommendations: string[];
        reasoning: string;
    } {
        try {
            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                scores: parsed.scores || { overall: 50, categories: {} },
                issues: parsed.issues || [],
                recommendations: parsed.recommendations || [],
                reasoning: parsed.reasoning || '',
            };
        } catch (error) {
            console.error('[AIJudgment] Failed to parse response:', error);
            return {
                scores: { overall: 50, categories: {} },
                issues: [],
                recommendations: [],
                reasoning: text.slice(0, 500),
            };
        }
    }

    private calculatePreferenceMargin(trace: DecisionTrace): number {
        if (!trace.outcome) return 0;

        let margin = 0;

        // Base margin from immediate result
        if (trace.outcome.immediateResult === 'success') margin += 40;
        else if (trace.outcome.immediateResult === 'partial') margin += 20;

        // Bonus for verification scores
        if (trace.outcome.verificationScores) {
            const avgScore = Object.values(trace.outcome.verificationScores)
                .reduce((a, b) => a + b, 0) / Object.values(trace.outcome.verificationScores).length;
            margin += avgScore / 5; // 0-20 bonus
        }

        // Bonus for making it to production
        if (trace.outcome.finalInProduction) margin += 20;

        // Penalty for fixes needed
        margin -= trace.outcome.requiredFixes * 5;

        // Bonus for user satisfaction
        if (trace.outcome.userSatisfaction) {
            margin += (trace.outcome.userSatisfaction - 3) * 10; // -20 to +20
        }

        return Math.max(0, Math.min(100, margin));
    }

    private constructPairPrompt(trace: DecisionTrace): string {
        const context = trace.context;
        let prompt = `Decision Type: ${trace.decisionType}\n`;
        prompt += `Phase: ${trace.phase}\n`;

        if (context.intentSnippet) {
            prompt += `Intent: ${context.intentSnippet.slice(0, 200)}\n`;
        }

        if (context.errorIfAny) {
            prompt += `Error to fix: ${context.errorIfAny}\n`;
        }

        return prompt;
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================

    private async persistJudgment(judgment: Judgment): Promise<void> {
        try {
            await db.insert(learningJudgments).values({
                id: uuidv4(),
                judgmentId: judgment.judgmentId,
                traceId: judgment.traceId,
                artifactId: judgment.artifactId,
                choiceId: judgment.choiceId,
                errorId: judgment.errorId,
                buildId: judgment.buildId,
                projectId: judgment.projectId,
                userId: judgment.userId,
                judgeType: judgment.judgeType,
                modelUsed: judgment.modelUsed,
                thinkingTrace: judgment.thinkingTrace,
                scores: judgment.scores,
                issues: judgment.issues,
                recommendations: judgment.recommendations,
                createdAt: judgment.createdAt.toISOString(),
            });
        } catch (error) {
            console.error('[AIJudgment] Failed to persist judgment:', error);
        }
    }

    private async persistPreferencePair(pair: PreferencePair): Promise<void> {
        try {
            await db.insert(learningPreferencePairs).values({
                id: uuidv4(),
                pairId: pair.pairId,
                domain: pair.domain,
                prompt: pair.prompt,
                chosen: pair.chosen,
                rejected: pair.rejected,
                judgmentReasoning: pair.judgmentReasoning,
                margin: pair.margin,
                sourceTraceId: pair.sourceTraceId,
                sourceJudgmentId: pair.sourceJudgmentId,
                usedInTraining: pair.usedInTraining,
                trainingRunId: pair.trainingRunId,
                createdAt: pair.createdAt.toISOString(),
            });
        } catch (error) {
            console.error('[AIJudgment] Failed to persist preference pair:', error);
        }
    }

    // =========================================================================
    // ROW MAPPING
    // =========================================================================

    private mapJudgmentRow = (row: typeof learningJudgments.$inferSelect): Judgment => ({
        judgmentId: row.judgmentId,
        traceId: row.traceId || undefined,
        artifactId: row.artifactId || undefined,
        choiceId: row.choiceId || undefined,
        errorId: row.errorId || undefined,
        buildId: row.buildId || undefined,
        projectId: row.projectId || undefined,
        userId: row.userId,
        judgeType: row.judgeType as JudgeType,
        modelUsed: row.modelUsed,
        thinkingTrace: row.thinkingTrace || undefined,
        scores: row.scores as JudgmentScores,
        issues: (row.issues as JudgmentIssue[]) || [],
        recommendations: (row.recommendations as string[]) || [],
        createdAt: new Date(row.createdAt),
    });

    private mapPreferencePairRow = (row: typeof learningPreferencePairs.$inferSelect): PreferencePair => ({
        pairId: row.pairId,
        domain: row.domain as PreferenceDomain,
        prompt: row.prompt,
        chosen: row.chosen,
        rejected: row.rejected,
        judgmentReasoning: row.judgmentReasoning || '',
        margin: row.margin ?? 0,
        sourceTraceId: row.sourceTraceId || undefined,
        sourceJudgmentId: row.sourceJudgmentId || undefined,
        usedInTraining: row.usedInTraining ?? false,
        trainingRunId: row.trainingRunId || undefined,
        createdAt: new Date(row.createdAt),
    });
}

// =============================================================================
// FACTORY & SINGLETON
// =============================================================================

export function createAIJudgmentService(
    config?: Partial<JudgmentConfig>
): AIJudgmentService {
    return new AIJudgmentService(config);
}

let globalInstance: AIJudgmentService | null = null;

export function getAIJudgmentService(
    config?: Partial<JudgmentConfig>
): AIJudgmentService {
    if (!globalInstance) {
        globalInstance = new AIJudgmentService(config);
    }
    return globalInstance;
}

