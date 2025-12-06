/**
 * Tournament Mode Service
 *
 * Implements competing AI implementations with AI judge panel:
 * - Multiple agents build the same feature in parallel
 * - Each implementation is verified and scored
 * - AI judge panel evaluates and selects the winner
 * - Best implementation wins and gets merged
 *
 * Part of Phase 8: Competitive Enhancements (Ultimate AI-First Builder Architecture)
 */

import { createClaudeService, CLAUDE_MODELS } from './claude-service.js';
import { createVerificationSwarm, type CombinedVerificationResult, type VerificationResult, type VerificationIssue } from '../verification/swarm.js';
import { createAntiSlopDetector } from '../verification/anti-slop-detector.js';
import type { Feature, FeatureVerificationStatus, FeatureVerificationScores } from './feature-list.js';
import type { AppSoulType } from './app-soul.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TOURNAMENT TYPES
// ============================================================================

export interface TournamentConfig {
    competitorCount: number;       // Number of competing implementations
    featureId: string;
    featureName: string;
    featureRequirements: string;
    baseFiles: Map<string, string>;
    appSoul?: AppSoulType;

    // Scoring weights
    weights: {
        codeQuality: number;       // 0-1
        visual: number;            // 0-1
        antiSlop: number;          // 0-1
        security: number;          // 0-1
        creativity: number;        // 0-1
        efficiency: number;        // 0-1 (tokens used / code quality)
    };

    // Judge configuration
    judgeCount: number;            // Number of AI judges (odd number recommended)
    unanimousRequired: boolean;    // Require all judges to agree

    // Time limits
    buildTimeoutMs: number;
    judgeTimeoutMs: number;
}

export interface Competitor {
    id: string;
    name: string;
    status: 'pending' | 'building' | 'verifying' | 'complete' | 'failed';
    files: Map<string, string>;
    startTime?: Date;
    endTime?: Date;
    buildTimeMs?: number;
    tokensUsed?: number;

    // Scores
    scores: {
        codeQuality: number;
        visual: number;
        antiSlop: number;
        security: number;
        creativity: number;
        efficiency: number;
        overall: number;
    };

    // Verification results
    verificationVerdict?: string;
    verificationIssues?: string[];

    // Build logs
    logs: string[];
}

export interface JudgeVerdict {
    judgeId: string;
    winnerId: string;
    reasoning: string;
    scores: Record<string, number>;  // Competitor ID -> score
    confidence: number;              // 0-1
}

export interface TournamentResult {
    id: string;
    featureId: string;
    status: 'complete' | 'failed' | 'tie';
    winnerId?: string;
    winnerFiles?: Map<string, string>;
    competitors: Competitor[];
    judgeVerdicts: JudgeVerdict[];
    consensusReasoning: string;
    totalTimeMs: number;
    totalTokensUsed: number;
}

// ============================================================================
// TOURNAMENT SERVICE
// ============================================================================

export class TournamentService extends EventEmitter {
    private projectId: string;
    private userId: string;
    private claudeService: ReturnType<typeof createClaudeService>;
    private verificationSwarm: ReturnType<typeof createVerificationSwarm>;
    private antiSlopDetector: ReturnType<typeof createAntiSlopDetector>;

    constructor(projectId: string, userId: string, appSoul?: AppSoulType) {
        super();
        this.projectId = projectId;
        this.userId = userId;

        this.claudeService = createClaudeService({
            agentType: 'generation',
            projectId,
            userId,
        });

        this.verificationSwarm = createVerificationSwarm(uuidv4(), projectId, userId);
        this.antiSlopDetector = createAntiSlopDetector(userId, projectId, appSoul);
    }

    /**
     * Run a tournament for a feature
     */
    async runTournament(config: TournamentConfig): Promise<TournamentResult> {
        const tournamentId = uuidv4();
        const startTime = Date.now();

        this.emit('tournament_start', { tournamentId, config });
        console.log(`[Tournament] Starting tournament ${tournamentId} with ${config.competitorCount} competitors`);

        // Initialize competitors
        const competitors: Competitor[] = this.initializeCompetitors(config.competitorCount);

        // Phase 1: Parallel Build
        this.emit('phase', { phase: 'build', tournamentId });
        await this.runBuildPhase(competitors, config);

        // Phase 2: Verification
        this.emit('phase', { phase: 'verify', tournamentId });
        await this.runVerificationPhase(competitors, config);

        // Phase 3: AI Judge Panel
        this.emit('phase', { phase: 'judge', tournamentId });
        const judgeVerdicts = await this.runJudgePhase(competitors, config);

        // Phase 4: Determine Winner
        const result = this.determineWinner(
            tournamentId,
            config.featureId,
            competitors,
            judgeVerdicts,
            startTime
        );

        this.emit('tournament_complete', result);
        console.log(`[Tournament] Complete. Winner: ${result.winnerId || 'TIE'}`);

        return result;
    }

    /**
     * Initialize competitors
     */
    private initializeCompetitors(count: number): Competitor[] {
        const competitors: Competitor[] = [];

        const competitorNames = [
            'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
            'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
        ];

        for (let i = 0; i < count; i++) {
            competitors.push({
                id: uuidv4(),
                name: competitorNames[i] || `Competitor-${i + 1}`,
                status: 'pending',
                files: new Map(),
                scores: {
                    codeQuality: 0,
                    visual: 0,
                    antiSlop: 0,
                    security: 0,
                    creativity: 0,
                    efficiency: 0,
                    overall: 0,
                },
                logs: [],
            });
        }

        return competitors;
    }

    /**
     * Run the build phase - all competitors build in parallel
     */
    private async runBuildPhase(competitors: Competitor[], config: TournamentConfig): Promise<void> {
        const buildPromises = competitors.map(async (competitor) => {
            competitor.status = 'building';
            competitor.startTime = new Date();
            competitor.logs.push(`[${new Date().toISOString()}] Build started`);

            this.emit('competitor_update', { competitorId: competitor.id, status: 'building' });

            try {
                // Each competitor gets slightly different instructions to encourage variety
                const prompt = this.buildCompetitorPrompt(competitor, config);

                const response = await this.claudeService.generate(prompt, {
                    model: CLAUDE_MODELS.SONNET_4_5,
                    maxTokens: 32000,
                    useExtendedThinking: true,
                    thinkingBudgetTokens: 16000,
                });

                // Parse file operations from response
                const fileOps = this.claudeService.parseFileOperations(response.content);

                // Apply to base files
                competitor.files = new Map(config.baseFiles);
                for (const op of fileOps) {
                    if (op.type === 'create' || op.type === 'update') {
                        competitor.files.set(op.path, op.content || '');
                    } else if (op.type === 'delete') {
                        competitor.files.delete(op.path);
                    }
                }

                competitor.endTime = new Date();
                competitor.buildTimeMs = competitor.endTime.getTime() - competitor.startTime.getTime();
                competitor.tokensUsed = (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0);
                competitor.logs.push(`[${new Date().toISOString()}] Build complete (${competitor.buildTimeMs}ms, ${competitor.tokensUsed} tokens)`);

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                competitor.status = 'failed';
                competitor.logs.push(`[${new Date().toISOString()}] Build FAILED: ${errorMessage}`);
                this.emit('competitor_update', { competitorId: competitor.id, status: 'failed', error: errorMessage });
            }
        });

        await Promise.all(buildPromises);
    }

    /**
     * Build unique prompt for each competitor
     */
    private buildCompetitorPrompt(competitor: Competitor, config: TournamentConfig): string {
        // Each competitor gets a slightly different approach emphasis
        const approaches: Record<string, string> = {
            Alpha: 'Focus on clean, maintainable code with excellent separation of concerns.',
            Beta: 'Prioritize performance and efficiency. Optimize for speed.',
            Gamma: 'Emphasize beautiful, polished UI with smooth animations.',
            Delta: 'Take a creative, innovative approach. Try something unique.',
            Epsilon: 'Focus on robustness and error handling. Make it bulletproof.',
        };

        const approachHint = approaches[competitor.name] || 'Build the best implementation you can.';

        return `You are competing in a Tournament to build the best implementation of a feature.

FEATURE: ${config.featureName}
REQUIREMENTS:
${config.featureRequirements}

YOUR APPROACH: ${approachHint}

EXISTING FILES:
${Array.from(config.baseFiles.keys()).map(k => `- ${k}`).join('\n')}

Build a complete, working implementation. Your code will be judged on:
- Code Quality (${config.weights.codeQuality * 100}%)
- Visual Design (${config.weights.visual * 100}%)
- Anti-Slop Compliance (${config.weights.antiSlop * 100}%)
- Security (${config.weights.security * 100}%)
- Creativity (${config.weights.creativity * 100}%)
- Efficiency (${config.weights.efficiency * 100}%)

Output your implementation with proper file operations.`;
    }

    /**
     * Extract scores from CombinedVerificationResult
     */
    private extractScores(swarmResult: CombinedVerificationResult): { codeQuality: number; visual: number; security: number } {
        const getScore = (result: VerificationResult | null, defaultScore: number): number => {
            return result?.score ?? defaultScore;
        };

        return {
            codeQuality: getScore(swarmResult.results.codeQuality, 75),
            visual: getScore(swarmResult.results.visualVerify, 70),
            security: getScore(swarmResult.results.securityScan, 80),
        };
    }

    /**
     * Extract issues from CombinedVerificationResult
     */
    private extractIssues(swarmResult: CombinedVerificationResult): VerificationIssue[] {
        const issues: VerificationIssue[] = [];

        const results = swarmResult.results;
        if (results.errorCheck?.issues) issues.push(...results.errorCheck.issues);
        if (results.codeQuality?.issues) issues.push(...results.codeQuality.issues);
        if (results.visualVerify?.issues) issues.push(...results.visualVerify.issues);
        if (results.securityScan?.issues) issues.push(...results.securityScan.issues);
        if (results.placeholderCheck?.issues) issues.push(...results.placeholderCheck.issues);
        if (results.designStyle?.issues) issues.push(...results.designStyle.issues);

        return issues;
    }

    /**
     * Create a synthetic feature for verification
     */
    private createVerificationFeature(featureId: string, files: Map<string, string>): Feature {
        const now = new Date().toISOString();
        const verificationStatus: FeatureVerificationStatus = {
            errorCheck: 'pending',
            codeQuality: 'pending',
            visualVerify: 'pending',
            placeholderCheck: 'pending',
            designStyle: 'pending',
            securityScan: 'pending',
        };
        const verificationScores: FeatureVerificationScores = {};

        return {
            id: uuidv4(),
            buildIntentId: '',
            orchestrationRunId: '',
            projectId: this.projectId,
            featureId,
            category: 'functional',
            description: 'Tournament competitor verification',
            priority: 1,
            implementationSteps: [],
            visualRequirements: [],
            filesModified: Array.from(files.keys()),
            passes: false,
            assignedAgent: null,
            assignedAt: null,
            verificationStatus,
            verificationScores,
            buildAttempts: 0,
            lastBuildAt: null,
            passedAt: null,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Run the verification phase
     */
    private async runVerificationPhase(competitors: Competitor[], config: TournamentConfig): Promise<void> {
        const verifyPromises = competitors
            .filter(c => c.status !== 'failed')
            .map(async (competitor) => {
                competitor.status = 'verifying';
                competitor.logs.push(`[${new Date().toISOString()}] Verification started`);

                this.emit('competitor_update', { competitorId: competitor.id, status: 'verifying' });

                try {
                    // Create a synthetic feature for verification
                    const feature = this.createVerificationFeature(config.featureId, competitor.files);

                    // Run verification swarm
                    const swarmResult = await this.verificationSwarm.verifyFeature(
                        feature,
                        competitor.files
                    );

                    // Run anti-slop detector
                    const antiSlopResult = await this.antiSlopDetector.analyze(competitor.files);

                    // Extract scores from the swarm result
                    const scores = this.extractScores(swarmResult);

                    // Calculate scores
                    competitor.scores.codeQuality = scores.codeQuality;
                    competitor.scores.visual = scores.visual;
                    competitor.scores.antiSlop = antiSlopResult.overall;
                    competitor.scores.security = scores.security;

                    // Efficiency = code quality / tokens used (normalized)
                    const normalizedTokens = (competitor.tokensUsed || 10000) / 10000;
                    competitor.scores.efficiency = Math.round((competitor.scores.codeQuality / normalizedTokens) * 10) / 10;
                    competitor.scores.efficiency = Math.min(100, Math.max(0, competitor.scores.efficiency));

                    // Creativity will be judged by AI judges
                    competitor.scores.creativity = 70; // Placeholder

                    // Calculate weighted overall score
                    competitor.scores.overall = this.calculateWeightedScore(competitor.scores, config.weights);

                    competitor.verificationVerdict = swarmResult.verdict;

                    // Extract issues from swarm result
                    const issues = this.extractIssues(swarmResult);
                    competitor.verificationIssues = issues.map(i => i.description);

                    competitor.status = 'complete';
                    competitor.logs.push(`[${new Date().toISOString()}] Verification complete (overall: ${competitor.scores.overall})`);

                    this.emit('competitor_update', {
                        competitorId: competitor.id,
                        status: 'complete',
                        scores: competitor.scores,
                    });

                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    competitor.status = 'failed';
                    competitor.logs.push(`[${new Date().toISOString()}] Verification FAILED: ${errorMessage}`);
                    this.emit('competitor_update', { competitorId: competitor.id, status: 'failed', error: errorMessage });
                }
            });

        await Promise.all(verifyPromises);
    }

    /**
     * Run the AI judge phase
     */
    private async runJudgePhase(competitors: Competitor[], config: TournamentConfig): Promise<JudgeVerdict[]> {
        const completedCompetitors = competitors.filter(c => c.status === 'complete');

        if (completedCompetitors.length === 0) {
            console.log('[Tournament] No competitors completed successfully');
            return [];
        }

        if (completedCompetitors.length === 1) {
            // Only one competitor finished - they win by default
            return [{
                judgeId: 'auto',
                winnerId: completedCompetitors[0].id,
                reasoning: 'Only one competitor completed successfully.',
                scores: { [completedCompetitors[0].id]: 100 },
                confidence: 1.0,
            }];
        }

        const judgePromises: Promise<JudgeVerdict>[] = [];

        for (let i = 0; i < config.judgeCount; i++) {
            judgePromises.push(this.runSingleJudge(i + 1, completedCompetitors, config));
        }

        const verdicts = await Promise.all(judgePromises);
        return verdicts;
    }

    /**
     * Run a single AI judge
     */
    private async runSingleJudge(
        judgeNumber: number,
        competitors: Competitor[],
        config: TournamentConfig
    ): Promise<JudgeVerdict> {
        const judgeId = `judge-${judgeNumber}`;

        this.emit('judge_start', { judgeId });

        // Build comparison prompt
        const competitorSummaries = competitors.map(c => `
## ${c.name} (ID: ${c.id})
- Build Time: ${c.buildTimeMs}ms
- Tokens Used: ${c.tokensUsed}
- Verification: ${c.verificationVerdict}
- Issues: ${c.verificationIssues?.length || 0}
- Scores: Code=${c.scores.codeQuality}, Visual=${c.scores.visual}, AntiSlop=${c.scores.antiSlop}, Security=${c.scores.security}

### Files Created:
${Array.from(c.files.keys()).join('\n')}
`).join('\n---\n');

        const judgePrompt = `You are an AI Judge evaluating competing implementations.

FEATURE BEING EVALUATED: ${config.featureName}
REQUIREMENTS:
${config.featureRequirements}

SCORING WEIGHTS:
- Code Quality: ${config.weights.codeQuality * 100}%
- Visual Design: ${config.weights.visual * 100}%
- Anti-Slop: ${config.weights.antiSlop * 100}%
- Security: ${config.weights.security * 100}%
- Creativity: ${config.weights.creativity * 100}%
- Efficiency: ${config.weights.efficiency * 100}%

COMPETITORS:
${competitorSummaries}

As Judge #${judgeNumber}, evaluate each implementation and select a winner.

Respond with JSON only:
{
  "winnerId": "the-winning-competitor-id",
  "reasoning": "Clear explanation of why this implementation won",
  "scores": {
    "competitor-id-1": 0-100,
    "competitor-id-2": 0-100
  },
  "confidence": 0.0-1.0
}`;

        try {
            const response = await this.claudeService.generateStructured<JudgeVerdict>(
                judgePrompt,
                'You are an impartial AI judge. Be objective and thorough in your evaluation.',
                {
                    model: CLAUDE_MODELS.OPUS_4_5,
                    effort: 'high',
                    thinkingBudgetTokens: 32000,
                }
            );

            this.emit('judge_complete', { judgeId, verdict: response });

            return {
                ...response,
                judgeId,
            };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Tournament] Judge ${judgeId} failed:`, errorMessage);

            // Fallback to highest scored competitor
            const fallbackWinner = [...competitors].sort((a, b) => b.scores.overall - a.scores.overall)[0];

            return {
                judgeId,
                winnerId: fallbackWinner.id,
                reasoning: `Judge ${judgeId} failed. Defaulting to highest automated score.`,
                scores: Object.fromEntries(competitors.map(c => [c.id, c.scores.overall])),
                confidence: 0.5,
            };
        }
    }

    /**
     * Determine the winner from judge verdicts
     */
    private determineWinner(
        tournamentId: string,
        featureId: string,
        competitors: Competitor[],
        judgeVerdicts: JudgeVerdict[],
        startTime: number
    ): TournamentResult {
        const endTime = Date.now();
        const totalTimeMs = endTime - startTime;
        const totalTokensUsed = competitors.reduce((sum, c) => sum + (c.tokensUsed || 0), 0);

        if (judgeVerdicts.length === 0) {
            return {
                id: tournamentId,
                featureId,
                status: 'failed',
                competitors,
                judgeVerdicts: [],
                consensusReasoning: 'No valid judge verdicts. Tournament failed.',
                totalTimeMs,
                totalTokensUsed,
            };
        }

        // Count votes for each competitor
        const voteCounts: Record<string, number> = {};
        const totalConfidence: Record<string, number> = {};

        for (const verdict of judgeVerdicts) {
            voteCounts[verdict.winnerId] = (voteCounts[verdict.winnerId] || 0) + 1;
            totalConfidence[verdict.winnerId] = (totalConfidence[verdict.winnerId] || 0) + verdict.confidence;
        }

        // Find the competitor with most votes
        const sortedByVotes = Object.entries(voteCounts)
            .sort(([, a], [, b]) => b - a);

        const topVotes = sortedByVotes[0]?.[1] || 0;
        const topVoters = sortedByVotes.filter(([, votes]) => votes === topVotes);

        // Check for tie
        if (topVoters.length > 1) {
            // Break tie by confidence
            const tieBreaker = topVoters
                .sort(([idA], [idB]) => (totalConfidence[idB] || 0) - (totalConfidence[idA] || 0));

            const winnerId = tieBreaker[0][0];
            const winner = competitors.find(c => c.id === winnerId);

            return {
                id: tournamentId,
                featureId,
                status: 'complete',
                winnerId,
                winnerFiles: winner?.files,
                competitors,
                judgeVerdicts,
                consensusReasoning: `Tie broken by confidence. Winner: ${winner?.name} with ${topVotes} votes and highest confidence.`,
                totalTimeMs,
                totalTokensUsed,
            };
        }

        const winnerId = sortedByVotes[0]?.[0];
        const winner = competitors.find(c => c.id === winnerId);

        // Build consensus reasoning from judge reasonings
        const reasonings = judgeVerdicts
            .filter(v => v.winnerId === winnerId)
            .map(v => v.reasoning);

        const consensusReasoning = reasonings.length > 0
            ? `${winner?.name} won with ${topVotes}/${judgeVerdicts.length} votes. Judges noted: ${reasonings[0]}`
            : `${winner?.name} won by automated scoring.`;

        return {
            id: tournamentId,
            featureId,
            status: 'complete',
            winnerId,
            winnerFiles: winner?.files,
            competitors,
            judgeVerdicts,
            consensusReasoning,
            totalTimeMs,
            totalTokensUsed,
        };
    }

    /**
     * Calculate weighted overall score
     */
    private calculateWeightedScore(
        scores: Competitor['scores'],
        weights: TournamentConfig['weights']
    ): number {
        return Math.round(
            scores.codeQuality * weights.codeQuality +
            scores.visual * weights.visual +
            scores.antiSlop * weights.antiSlop +
            scores.security * weights.security +
            scores.creativity * weights.creativity +
            scores.efficiency * weights.efficiency
        );
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createTournamentService(
    projectId: string,
    userId: string,
    appSoul?: AppSoulType
): TournamentService {
    return new TournamentService(projectId, userId, appSoul);
}

export default TournamentService;
