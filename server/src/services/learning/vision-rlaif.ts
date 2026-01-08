/**
 * Vision RLAIF Service
 *
 * Uses vision-language models to evaluate visual quality of generated UIs,
 * enabling Anti-Slop detection through visual analysis rather than
 * just code-based heuristics.
 */

import { db } from '../../db.js';
import { learningVisionPairs } from '../../schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// LOCAL TYPES
// =============================================================================

export interface VisionRLAIFConfig {
    screenshotDir: string;
    visionModel: string;
}

export interface VisionPair {
    id: string;
    pairId: string;
    buildId?: string;
    componentPath?: string;
    screenshotBefore?: string;
    screenshotAfter?: string;
    codeChanges: string;
    visualScoreBefore?: number;
    visualScoreAfter?: number;
    antiSlopScoreBefore?: number;
    antiSlopScoreAfter?: number;
    improvement?: number;
    judgmentReasoning?: string;
    categories?: Record<string, number>;
    createdAt: Date;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: VisionRLAIFConfig = {
    screenshotDir: './screenshots',
    visionModel: 'claude-sonnet-4-20250514',
};

// =============================================================================
// VISION EVALUATION PROMPTS
// =============================================================================

const ANTI_SLOP_VISION_PROMPT = `You are an expert UI designer evaluating a screenshot for "AI Slop" - generic, uninspired AI-generated designs.

Analyze this screenshot for the following Anti-Slop criteria from the KripTik AI Design Manifesto:

EVALUATE:
1. **Typography**: Are fonts distinctive or generic (Inter, Roboto, Arial)?
2. **Color Palette**: Is it cohesive with character, or purple-gradient-on-white cliché?
3. **Layout**: Surprising and delightful, or cookie-cutter predictable?
4. **Visual Depth**: Rich backgrounds with atmosphere, or flat solid colors?
5. **Motion Potential**: Evidence of considered animation/transitions?
6. **Overall Character**: Does it feel genuinely designed or "AI generated"?

RESPOND WITH JSON:
{
    "antiSlopScore": <0-100, higher = better, less "slop">,
    "typographyScore": <0-100>,
    "colorScore": <0-100>,
    "layoutScore": <0-100>,
    "depthScore": <0-100>,
    "overallImpression": "DISTINCTIVE" | "ACCEPTABLE" | "GENERIC" | "AI_SLOP",
    "slopIndicators": ["<specific issues found>"],
    "strengths": ["<what works well>"],
    "improvements": ["<specific suggestions>"]
}`;

const COMPARISON_PROMPT = `You are comparing two UI designs to determine which is better.

Analyze both screenshots and determine which design is superior in terms of:
1. Visual distinctiveness and character
2. Adherence to modern design principles
3. Avoidance of generic "AI slop" aesthetics
4. Overall user experience quality

IMAGE A is the first design (BEFORE).
IMAGE B is the second design (AFTER).

RESPOND WITH JSON:
{
    "visualScoreBefore": <0-100>,
    "visualScoreAfter": <0-100>,
    "antiSlopScoreBefore": <0-100>,
    "antiSlopScoreAfter": <0-100>,
    "improvement": <positive if AFTER is better, negative if worse>,
    "reasoning": "<explanation of differences>",
    "categories": {
        "typography": <improvement score>,
        "color": <improvement score>,
        "layout": <improvement score>,
        "depth": <improvement score>
    }
}`;

// =============================================================================
// VISION RLAIF SERVICE
// =============================================================================

export class VisionRLAIFService extends EventEmitter {
    private config: VisionRLAIFConfig;
    private anthropic: ReturnType<typeof createAnthropicClient>;

    constructor(config?: Partial<VisionRLAIFConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.anthropic = createAnthropicClient();
    }

    // =========================================================================
    // SINGLE IMAGE EVALUATION
    // =========================================================================

    /**
     * Evaluate a screenshot for Anti-Slop quality
     */
    async evaluateScreenshot(
        imageSource: string | Buffer,
        context?: {
            buildId?: string;
            componentPath?: string;
            phase?: string;
        }
    ): Promise<{
        antiSlopScore: number;
        breakdown: Record<string, number>;
        impression: string;
        issues: string[];
        suggestions: string[];
    }> {
        const imageData = await this.prepareImage(imageSource);

        try {
            if (!this.anthropic) {
                throw new Error('Anthropic client not initialized');
            }

            const response = await this.anthropic.messages.create({
                model: this.config.visionModel,
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: imageData.mediaType,
                                    data: imageData.base64,
                                },
                            },
                            {
                                type: 'text',
                                text: ANTI_SLOP_VISION_PROMPT,
                            },
                        ],
                    },
                ],
            });

            const content = response.content[0];
            if (!content || content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            const parsed = this.parseVisionResponse(content.text);

            // Store for training
            if (context?.buildId) {
                await this.storeVisionPair({
                    buildId: context.buildId,
                    componentPath: context.componentPath || 'unknown',
                    screenshotBefore: imageData.base64.slice(0, 100), // Store hash reference
                    antiSlopScore: parsed.antiSlopScore,
                    visualScore: parsed.antiSlopScore,
                    categories: {
                        typography: parsed.typographyScore,
                        color: parsed.colorScore,
                        layout: parsed.layoutScore,
                        depth: parsed.depthScore,
                    },
                });
            }

            this.emit('screenshot_evaluated', {
                antiSlopScore: parsed.antiSlopScore,
                impression: parsed.overallImpression,
                buildId: context?.buildId,
            });

            return {
                antiSlopScore: parsed.antiSlopScore,
                breakdown: {
                    typography: parsed.typographyScore,
                    color: parsed.colorScore,
                    layout: parsed.layoutScore,
                    depth: parsed.depthScore,
                },
                impression: parsed.overallImpression,
                issues: parsed.slopIndicators || [],
                suggestions: parsed.improvements || [],
            };
        } catch (error) {
            console.error('[VisionRLAIF] Screenshot evaluation failed:', error);
            throw error;
        }
    }

    /**
     * Quick Anti-Slop check (simplified evaluation)
     */
    async quickAntiSlopCheck(imageSource: string | Buffer): Promise<{
        isSlop: boolean;
        confidence: number;
        quickIssues: string[];
    }> {
        const result = await this.evaluateScreenshot(imageSource);

        return {
            isSlop: result.antiSlopScore < 60,
            confidence: Math.abs(result.antiSlopScore - 50) / 50, // Higher when further from 50
            quickIssues: result.issues.slice(0, 3),
        };
    }

    // =========================================================================
    // COMPARISON EVALUATION
    // =========================================================================

    /**
     * Compare two designs to create a preference pair
     */
    async compareDesigns(
        imageA: string | Buffer,
        imageB: string | Buffer,
        codeChanges: string,
        context?: { buildId?: string; componentPath?: string }
    ): Promise<{
        improvement: number;
        visualScoreBefore: number;
        visualScoreAfter: number;
        reasoning: string;
        pairId: string;
    }> {
        const [dataA, dataB] = await Promise.all([
            this.prepareImage(imageA),
            this.prepareImage(imageB),
        ]);

        try {
            if (!this.anthropic) {
                throw new Error('Anthropic client not initialized');
            }

            const response = await this.anthropic.messages.create({
                model: this.config.visionModel,
                max_tokens: 1500,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: dataA.mediaType,
                                    data: dataA.base64,
                                },
                            },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: dataB.mediaType,
                                    data: dataB.base64,
                                },
                            },
                            {
                                type: 'text',
                                text: COMPARISON_PROMPT,
                            },
                        ],
                    },
                ],
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
            const pairId = `vp_${uuidv4()}`;

            // Store comparison result
            await db.insert(learningVisionPairs).values({
                pairId,
                buildId: context?.buildId,
                componentPath: context?.componentPath,
                screenshotBefore: dataA.base64.slice(0, 100), // Store hash reference
                screenshotAfter: dataB.base64.slice(0, 100),
                codeChanges,
                visualScoreBefore: parsed.visualScoreBefore,
                visualScoreAfter: parsed.visualScoreAfter,
                antiSlopScoreBefore: parsed.antiSlopScoreBefore,
                antiSlopScoreAfter: parsed.antiSlopScoreAfter,
                improvement: parsed.improvement,
                judgmentReasoning: parsed.reasoning,
                categories: parsed.categories,
            });

            this.emit('designs_compared', {
                pairId,
                improvement: parsed.improvement,
                visualScoreBefore: parsed.visualScoreBefore,
                visualScoreAfter: parsed.visualScoreAfter,
            });

            return {
                improvement: parsed.improvement,
                visualScoreBefore: parsed.visualScoreBefore,
                visualScoreAfter: parsed.visualScoreAfter,
                reasoning: parsed.reasoning,
                pairId,
            };
        } catch (error) {
            console.error('[VisionRLAIF] Design comparison failed:', error);
            throw error;
        }
    }

    // =========================================================================
    // TRAINING DATA
    // =========================================================================

    /**
     * Get vision pairs for training
     */
    async getTrainingPairs(limit: number = 100): Promise<VisionPair[]> {
        const rows = await db.select()
            .from(learningVisionPairs)
            .orderBy(desc(learningVisionPairs.createdAt))
            .limit(limit);

        return rows.map(row => ({
            id: row.id,
            pairId: row.pairId,
            buildId: row.buildId || undefined,
            componentPath: row.componentPath || undefined,
            screenshotBefore: row.screenshotBefore || undefined,
            screenshotAfter: row.screenshotAfter || undefined,
            codeChanges: row.codeChanges,
            visualScoreBefore: row.visualScoreBefore || undefined,
            visualScoreAfter: row.visualScoreAfter || undefined,
            antiSlopScoreBefore: row.antiSlopScoreBefore || undefined,
            antiSlopScoreAfter: row.antiSlopScoreAfter || undefined,
            improvement: row.improvement || undefined,
            judgmentReasoning: row.judgmentReasoning || undefined,
            categories: row.categories as Record<string, number> || undefined,
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        }));
    }

    /**
     * Get high-quality examples (high improvement scores)
     */
    async getHighQualityPairs(minImprovement: number = 20): Promise<VisionPair[]> {
        const all = await this.getTrainingPairs(500);

        return all.filter(pair =>
            pair.improvement !== undefined && pair.improvement >= minImprovement
        );
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get vision RLAIF statistics
     */
    async getStats(): Promise<{
        totalPairs: number;
        avgImprovement: number;
        avgAntiSlopScore: number;
        slopRate: number;
    }> {
        const pairs = await db.select().from(learningVisionPairs);

        const improvements = pairs
            .map(p => p.improvement)
            .filter((i): i is number => i !== null && i !== undefined);

        const afterScores = pairs
            .map(p => p.antiSlopScoreAfter)
            .filter((s): s is number => s !== null && s !== undefined);

        const avgImprovement = improvements.length > 0
            ? improvements.reduce((a, b) => a + b, 0) / improvements.length
            : 0;

        const avgScore = afterScores.length > 0
            ? afterScores.reduce((a, b) => a + b, 0) / afterScores.length
            : 0;

        const slopCount = afterScores.filter(s => s < 60).length;
        const slopRate = afterScores.length > 0 ? slopCount / afterScores.length : 0;

        return {
            totalPairs: pairs.length,
            avgImprovement,
            avgAntiSlopScore: avgScore,
            slopRate,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private async prepareImage(
        source: string | Buffer
    ): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
        let buffer: Buffer;
        let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';

        if (Buffer.isBuffer(source)) {
            buffer = source;
        } else if (source.startsWith('data:')) {
            // Data URL
            const matches = source.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
                throw new Error('Invalid data URL');
            }
            mediaType = matches[1] as typeof mediaType;
            return { base64: matches[2], mediaType };
        } else if (source.startsWith('http')) {
            // URL - fetch it (external URL - no credentials needed)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (fetch as any)(source);
            buffer = Buffer.from(await response.arrayBuffer());
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
                mediaType = 'image/jpeg';
            } else if (contentType?.includes('webp')) {
                mediaType = 'image/webp';
            } else if (contentType?.includes('gif')) {
                mediaType = 'image/gif';
            }
        } else {
            // File path
            buffer = fs.readFileSync(source);
            const ext = path.extname(source).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') {
                mediaType = 'image/jpeg';
            } else if (ext === '.webp') {
                mediaType = 'image/webp';
            } else if (ext === '.gif') {
                mediaType = 'image/gif';
            }
        }

        return {
            base64: buffer.toString('base64'),
            mediaType,
        };
    }

    private parseVisionResponse(text: string): {
        antiSlopScore: number;
        typographyScore: number;
        colorScore: number;
        layoutScore: number;
        depthScore: number;
        overallImpression: string;
        slopIndicators: string[];
        strengths: string[];
        improvements: string[];
    } {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found');
            }
            const parsed = JSON.parse(jsonMatch[0]);

            return {
                antiSlopScore: parsed.antiSlopScore || 50,
                typographyScore: parsed.typographyScore || 50,
                colorScore: parsed.colorScore || 50,
                layoutScore: parsed.layoutScore || 50,
                depthScore: parsed.depthScore || 50,
                overallImpression: parsed.overallImpression || 'ACCEPTABLE',
                slopIndicators: parsed.slopIndicators || [],
                strengths: parsed.strengths || [],
                improvements: parsed.improvements || [],
            };
        } catch {
            return {
                antiSlopScore: 50,
                typographyScore: 50,
                colorScore: 50,
                layoutScore: 50,
                depthScore: 50,
                overallImpression: 'ACCEPTABLE',
                slopIndicators: [],
                strengths: [],
                improvements: [],
            };
        }
    }

    private async storeVisionPair(data: {
        buildId: string;
        componentPath: string;
        screenshotBefore: string;
        antiSlopScore: number;
        visualScore: number;
        categories: Record<string, number>;
    }): Promise<void> {
        try {
            await db.insert(learningVisionPairs).values({
                pairId: `vp_${uuidv4()}`,
                buildId: data.buildId,
                componentPath: data.componentPath,
                screenshotBefore: data.screenshotBefore,
                codeChanges: '', // Single evaluation, no code changes
                visualScoreBefore: data.visualScore,
                antiSlopScoreBefore: data.antiSlopScore,
                categories: data.categories,
            });
        } catch (error) {
            console.error('[VisionRLAIF] Failed to store vision pair:', error);
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: VisionRLAIFService | null = null;

export function getVisionRLAIF(config?: Partial<VisionRLAIFConfig>): VisionRLAIFService {
    if (!instance) {
        instance = new VisionRLAIFService(config);
    }
    return instance;
}

export function resetVisionRLAIF(): void {
    instance = null;
}
