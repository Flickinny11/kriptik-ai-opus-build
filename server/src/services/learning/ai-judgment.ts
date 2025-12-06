/**
 * AI Judgment Service
 *
 * Implements RLAIF (Reinforcement Learning from AI Feedback) for the
 * Autonomous Learning Engine. AI judges evaluate every decision,
 * creating preference pairs for training.
 *
 * This is Layer 2 of the Autonomous Learning Engine.
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { qualityJudgments, preferencePairs } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { getModelRouter } from '../ai/model-router.js';
import type {
    DecisionTrace,
    CodeArtifactTrace,
    DesignChoiceTrace,
    CodeQualityJudgment,
    DesignQualityJudgment,
    PreferencePair,
    JudgmentDomain,
} from './types.js';

// =============================================================================
// AI JUDGMENT SERVICE
// =============================================================================

export class AIJudgmentService {
    private modelRouter = getModelRouter();

    // =========================================================================
    // CODE QUALITY JUDGMENT
    // =========================================================================

    /**
     * Judge code quality using AI
     */
    async judgeCodeQuality(params: {
        artifactId: string;
        code: string;
        context: {
            appSoul?: string;
            intentSnippet?: string;
            buildPhase?: string;
            filePath: string;
        };
    }): Promise<CodeQualityJudgment> {
        const prompt = `You are a code quality judge. Evaluate this code and provide a comprehensive judgment.

## Context
- File: ${params.context.filePath}
- Build Phase: ${params.context.buildPhase || 'unknown'}
${params.context.appSoul ? `- App Type: ${params.context.appSoul}` : ''}
${params.context.intentSnippet ? `- Intent: ${params.context.intentSnippet}` : ''}

## Code to Evaluate
\`\`\`
${params.code}
\`\`\`

## Instructions
Provide your evaluation in the following JSON format:
{
  "overallScore": 0-100,
  "readabilityScore": 0-100,
  "maintainabilityScore": 0-100,
  "efficiencyScore": 0-100,
  "securityScore": 0-100,
  "testabilityScore": 0-100,
  "issues": [
    {
      "severity": "critical|major|minor|suggestion",
      "type": "bug|style|security|performance|maintainability",
      "description": "...",
      "line": null or number,
      "suggestion": "how to fix"
    }
  ],
  "improvementSuggestions": ["what would make this EXCELLENT, not just good"]
}

Be HARSH but constructive. We want to train models that produce EXCELLENT code, not just acceptable code.
Only output the JSON, no other text.`;

        try {
            const response = await this.modelRouter.generate({
                prompt,
                taskType: 'code_review',
                systemPrompt: 'You are an expert code reviewer focused on producing detailed, actionable feedback.',
                temperature: 0.3,
            });

            const parsed = this.parseJSON<{
                overallScore: number;
                readabilityScore: number;
                maintainabilityScore: number;
                efficiencyScore: number;
                securityScore: number;
                testabilityScore: number;
                issues: CodeQualityJudgment['issues'];
                improvementSuggestions: string[];
            }>(response.content);

            const judgment: CodeQualityJudgment = {
                judgmentId: uuidv4(),
                artifactId: params.artifactId,
                timestamp: new Date().toISOString(),
                overallScore: parsed.overallScore || 50,
                readabilityScore: parsed.readabilityScore || 50,
                maintainabilityScore: parsed.maintainabilityScore || 50,
                efficiencyScore: parsed.efficiencyScore || 50,
                securityScore: parsed.securityScore || 50,
                testabilityScore: parsed.testabilityScore || 50,
                issues: parsed.issues || [],
                improvementSuggestions: parsed.improvementSuggestions || [],
                modelUsed: response.model,
                tokensUsed: response.usage.totalTokens,
            };

            // Store judgment
            await this.storeJudgment({
                targetId: params.artifactId,
                targetType: 'code_artifact',
                judgmentType: 'code_quality',
                scores: {
                    overall: judgment.overallScore,
                    readability: judgment.readabilityScore,
                    maintainability: judgment.maintainabilityScore,
                    efficiency: judgment.efficiencyScore,
                    security: judgment.securityScore,
                    testability: judgment.testabilityScore,
                },
                issues: judgment.issues,
                suggestions: judgment.improvementSuggestions,
                modelUsed: response.model,
                tokensUsed: response.usage.totalTokens,
            });

            return judgment;
        } catch (error) {
            console.error('[AIJudgment] Failed to judge code quality:', error);
            throw error;
        }
    }

    // =========================================================================
    // DESIGN QUALITY JUDGMENT
    // =========================================================================

    /**
     * Judge design quality against Anti-Slop Manifesto
     */
    async judgeDesignQuality(params: {
        choiceId: string;
        css: string;
        typography: {
            fontsChosen: string[];
        };
        appSoul: string;
        screenshotBase64?: string;
    }): Promise<DesignQualityJudgment> {
        const bannedFonts = ['Inter', 'Roboto', 'Arial', 'Poppins', 'Open Sans', 'system-ui'];
        const fontsUsed = params.typography.fontsChosen;
        const bannedFontsUsed = fontsUsed.filter(f =>
            bannedFonts.some(bf => f.toLowerCase().includes(bf.toLowerCase()))
        );

        // Check for emoji crimes in CSS
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/gu;
        const emojiCrimesDetected = emojiRegex.test(params.css);

        const prompt = `You are a design quality judge with expertise in anti-AI-slop design.

## App Soul
${params.appSoul}

## CSS Styles
\`\`\`css
${params.css}
\`\`\`

## Typography
Fonts chosen: ${fontsUsed.join(', ')}

## Anti-Slop Design Manifesto Checklist

EVALUATE against these criteria:

1. DEPTH (0-100):
   - Are there multi-layer shadows?
   - Is there z-axis transformation?
   - Do elements have lift on hover?

2. MOTION (0-100):
   - Are there micro-interactions?
   - Do transitions feel natural?
   - Is there scroll-triggered animation?

3. TYPOGRAPHY (0-100):
   - Are banned fonts (Inter, Poppins, Roboto, Arial) used? → HEAVY PENALTY
   - Is there proper hierarchy?
   - Are letter-spacing and line-heights intentional?

4. SOUL MATCH (0-100):
   - Does this feel like a ${params.appSoul} app should feel?
   - Would a human designer be proud of this?

5. INSTANT FAIL CHECKS:
   - Banned fonts used: ${bannedFontsUsed.length > 0 ? 'YES (' + bannedFontsUsed.join(', ') + ')' : 'NO'}
   - Emoji crimes detected: ${emojiCrimesDetected ? 'YES' : 'NO'}

## Output Format (JSON only)
{
  "depthScore": 0-100,
  "motionScore": 0-100,
  "typographyScore": 0-100,
  "soulMatchScore": 0-100,
  "overallScore": 0-100,
  "verdict": "EXCELLENT|GOOD|ACCEPTABLE|AI-SLOP",
  "reasoning": "detailed explanation"
}

Be HARSH. We want to train models that produce EXCELLENT design, not acceptable.
If banned fonts are used without good reason, typographyScore should be < 30.
If emoji crimes detected, verdict should be "AI-SLOP".

Only output the JSON, no other text.`;

        try {
            const response = await this.modelRouter.generate({
                prompt,
                taskType: 'design_review',
                systemPrompt: 'You are a world-class design critic with zero tolerance for generic AI aesthetics.',
                temperature: 0.3,
            });

            const parsed = this.parseJSON<{
                depthScore: number;
                motionScore: number;
                typographyScore: number;
                soulMatchScore: number;
                overallScore: number;
                verdict: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'AI-SLOP';
                reasoning: string;
            }>(response.content);

            // Apply instant fail penalties
            let verdict = parsed.verdict;
            let typographyScore = parsed.typographyScore;

            if (bannedFontsUsed.length > 0) {
                typographyScore = Math.min(typographyScore, 25);
                if (verdict === 'EXCELLENT' || verdict === 'GOOD') {
                    verdict = 'ACCEPTABLE';
                }
            }

            if (emojiCrimesDetected) {
                verdict = 'AI-SLOP';
            }

            const judgment: DesignQualityJudgment = {
                judgmentId: uuidv4(),
                choiceId: params.choiceId,
                timestamp: new Date().toISOString(),
                depthScore: parsed.depthScore || 50,
                motionScore: parsed.motionScore || 50,
                typographyScore,
                soulMatchScore: parsed.soulMatchScore || 50,
                overallScore: parsed.overallScore || 50,
                bannedFontsUsed,
                emojiCrimesDetected,
                verdict,
                reasoning: parsed.reasoning || '',
                modelUsed: response.model,
                tokensUsed: response.usage.totalTokens,
            };

            // Store judgment
            await this.storeJudgment({
                targetId: params.choiceId,
                targetType: 'design_choice',
                judgmentType: 'design_quality',
                scores: {
                    depth: judgment.depthScore,
                    motion: judgment.motionScore,
                    typography: judgment.typographyScore,
                    soulMatch: judgment.soulMatchScore,
                    overall: judgment.overallScore,
                },
                issues: bannedFontsUsed.map(f => ({
                    severity: 'major',
                    type: 'typography',
                    description: `Banned font used: ${f}`,
                    suggestion: 'Use a distinctive, non-generic font',
                })),
                suggestions: [],
                verdict,
                modelUsed: response.model,
                tokensUsed: response.usage.totalTokens,
            });

            return judgment;
        } catch (error) {
            console.error('[AIJudgment] Failed to judge design quality:', error);
            throw error;
        }
    }

    // =========================================================================
    // PREFERENCE PAIR GENERATION
    // =========================================================================

    /**
     * Generate preference pairs from decision traces
     */
    async generatePreferencePairs(traces: DecisionTrace[]): Promise<PreferencePair[]> {
        const pairs: PreferencePair[] = [];

        for (const trace of traces) {
            // Only generate pairs from decisions with outcomes
            if (!trace.outcome) continue;

            // If successful, compare chosen to rejected options
            if (trace.outcome.immediateResult === 'success' && trace.decision.rejectedOptions.length > 0) {
                for (const rejected of trace.decision.rejectedOptions) {
                    const pair: PreferencePair = {
                        pairId: uuidv4(),
                        prompt: this.buildPromptFromContext(trace),
                        chosen: trace.decision.chosenOption,
                        rejected,
                        judgmentReasoning: trace.decision.reasoning,
                        margin: Math.round(trace.decision.confidence * 100),
                        domain: this.classifyDomain(trace.decisionType),
                        createdAt: new Date().toISOString(),
                        sourceTraceId: trace.traceId,
                        sourceType: 'decision',
                    };

                    pairs.push(pair);

                    // Store in database
                    await this.storePreferencePair(pair);
                }
            }
        }

        return pairs;
    }

    /**
     * Generate preference pairs from error recovery traces
     */
    async generateErrorRecoveryPairs(recoveries: {
        errorId: string;
        error: { type: string; message: string };
        recoveryJourney: Array<{
            attempt: number;
            fixApplied: string;
            result: string;
        }>;
        successfulFix: { fixDescription: string } | null;
    }[]): Promise<PreferencePair[]> {
        const pairs: PreferencePair[] = [];

        for (const recovery of recoveries) {
            if (!recovery.successfulFix) continue;

            const failedAttempts = recovery.recoveryJourney.filter(
                a => a.result === 'failed' || a.result === 'partial'
            );

            // Create pairs comparing successful fix to failed attempts
            for (const failed of failedAttempts) {
                const pair: PreferencePair = {
                    pairId: uuidv4(),
                    prompt: `Fix this error: ${recovery.error.type} - ${recovery.error.message}`,
                    chosen: recovery.successfulFix.fixDescription,
                    rejected: failed.fixApplied,
                    judgmentReasoning: `Attempt ${failed.attempt} ${failed.result}, final fix succeeded`,
                    margin: 80, // Strong preference for success
                    domain: 'error_fix',
                    createdAt: new Date().toISOString(),
                    sourceTraceId: recovery.errorId,
                    sourceType: 'error_recovery',
                };

                pairs.push(pair);
                await this.storePreferencePair(pair);
            }
        }

        return pairs;
    }

    // =========================================================================
    // BATCH JUDGMENT
    // =========================================================================

    /**
     * Run judgments on all unjudged artifacts
     */
    async runBatchJudgments(params: {
        maxItems?: number;
        judgmentTypes?: ('code_quality' | 'design_quality')[];
    }): Promise<{
        codeJudgments: number;
        designJudgments: number;
        preferencePairs: number;
        errors: number;
    }> {
        const results = {
            codeJudgments: 0,
            designJudgments: 0,
            preferencePairs: 0,
            errors: 0,
        };

        // This would typically be called as a background job
        // For now, just return the structure
        console.log('[AIJudgment] Batch judgment would process pending items');

        return results;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private async storeJudgment(params: {
        targetId: string;
        targetType: string;
        judgmentType: string;
        scores: Record<string, number>;
        issues: unknown[];
        suggestions: string[];
        verdict?: string;
        modelUsed: string;
        tokensUsed: number;
    }): Promise<void> {
        try {
            await db.insert(qualityJudgments).values({
                id: uuidv4(),
                targetId: params.targetId,
                targetType: params.targetType,
                judgmentType: params.judgmentType,
                scores: params.scores,
                issues: params.issues,
                suggestions: params.suggestions,
                verdict: params.verdict,
                modelUsed: params.modelUsed,
                tokensUsed: params.tokensUsed,
            });
        } catch (error) {
            console.error('[AIJudgment] Failed to store judgment:', error);
        }
    }

    private async storePreferencePair(pair: PreferencePair): Promise<void> {
        try {
            await db.insert(preferencePairs).values({
                id: pair.pairId,
                prompt: pair.prompt,
                chosen: pair.chosen,
                rejected: pair.rejected,
                judgmentReasoning: pair.judgmentReasoning,
                margin: pair.margin,
                domain: pair.domain,
                sourceTraceId: pair.sourceTraceId,
                sourceType: pair.sourceType,
            });
        } catch (error) {
            console.error('[AIJudgment] Failed to store preference pair:', error);
        }
    }

    private buildPromptFromContext(trace: DecisionTrace): string {
        const parts: string[] = [];

        if (trace.context.intentSnippet) {
            parts.push(`Intent: ${trace.context.intentSnippet}`);
        }

        parts.push(`Phase: ${trace.phase}`);
        parts.push(`Decision Type: ${trace.decisionType}`);

        if (trace.context.errorIfAny) {
            parts.push(`Error to address: ${trace.context.errorIfAny}`);
        }

        if (trace.context.previousAttempts > 0) {
            parts.push(`Previous attempts: ${trace.context.previousAttempts}`);
        }

        return parts.join('\n');
    }

    private classifyDomain(decisionType: string): JudgmentDomain {
        const codeTypes = ['component_structure', 'api_design', 'error_recovery', 'placeholder_resolution'];
        const designTypes = ['styling_approach', 'design_choice', 'motion_implementation'];
        const archTypes = ['architecture_choice', 'model_selection', 'deployment_strategy'];

        if (codeTypes.includes(decisionType)) return 'code';
        if (designTypes.includes(decisionType)) return 'design';
        if (archTypes.includes(decisionType)) return 'architecture';
        if (decisionType === 'error_recovery') return 'error_fix';

        return 'code';
    }

    private parseJSON<T>(content: string): T {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;

        try {
            return JSON.parse(jsonStr.trim());
        } catch {
            // Try to find JSON object in the content
            const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                return JSON.parse(objectMatch[0]);
            }
            throw new Error('Failed to parse JSON from response');
        }
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get judgment statistics
     */
    async getStatistics(): Promise<{
        totalJudgments: number;
        avgCodeQualityScore: number;
        avgDesignQualityScore: number;
        totalPreferencePairs: number;
        pairsPerDomain: Record<string, number>;
    }> {
        try {
            const judgments = await db.select().from(qualityJudgments);
            const pairs = await db.select().from(preferencePairs);

            const codeJudgments = judgments.filter(j => j.judgmentType === 'code_quality');
            const designJudgments = judgments.filter(j => j.judgmentType === 'design_quality');

            const avgCodeScore = codeJudgments.length > 0
                ? codeJudgments.reduce((sum, j) => {
                    const scores = j.scores as Record<string, number>;
                    return sum + (scores.overall || 0);
                }, 0) / codeJudgments.length
                : 0;

            const avgDesignScore = designJudgments.length > 0
                ? designJudgments.reduce((sum, j) => {
                    const scores = j.scores as Record<string, number>;
                    return sum + (scores.overall || 0);
                }, 0) / designJudgments.length
                : 0;

            const pairsPerDomain: Record<string, number> = {};
            for (const pair of pairs) {
                pairsPerDomain[pair.domain] = (pairsPerDomain[pair.domain] || 0) + 1;
            }

            return {
                totalJudgments: judgments.length,
                avgCodeQualityScore: Math.round(avgCodeScore),
                avgDesignQualityScore: Math.round(avgDesignScore),
                totalPreferencePairs: pairs.length,
                pairsPerDomain,
            };
        } catch (error) {
            console.error('[AIJudgment] Failed to get statistics:', error);
            return {
                totalJudgments: 0,
                avgCodeQualityScore: 0,
                avgDesignQualityScore: 0,
                totalPreferencePairs: 0,
                pairsPerDomain: {},
            };
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: AIJudgmentService | null = null;

export function getAIJudgmentService(): AIJudgmentService {
    if (!instance) {
        instance = new AIJudgmentService();
    }
    return instance;
}

