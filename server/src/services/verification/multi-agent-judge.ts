/**
 * Multi-Agent Judging System - Auto-Evaluate Parallel Agent Results
 *
 * From Cursor 2.2 changelog:
 * > "When running multiple agents in parallel, Cursor will now automatically
 * > evaluate all runs and give a recommendation for the best solution."
 *
 * This service provides:
 * 1. Automatic evaluation of all parallel agent outputs
 * 2. Multi-criteria scoring (correctness, performance, style, intent alignment)
 * 3. AI-powered comparison and recommendation
 * 4. Conflict detection between agent outputs
 * 5. Merge path optimization
 *
 * The key insight: Don't just pick the first result. JUDGE all results.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    getOpenRouterClient,
    getPhaseConfig,
} from '../ai/openrouter-client.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentResult {
    agentId: string;
    agentName: string;
    taskDescription: string;
    output: {
        files: Map<string, string>;
        summary: string;
        approach: string;
    };
    metrics: {
        executionTimeMs: number;
        tokensUsed: number;
        creditsUsed: number;
        verificationScore: number;
        errorCount: number;
    };
    completedAt: Date;
}

export interface JudgingCriteria {
    name: string;
    weight: number;
    description: string;
}

export interface CriteriaScore {
    criteria: string;
    score: number;      // 0-100
    reasoning: string;
    evidence: string[];
}

export interface JudgmentResult {
    id: string;
    buildId: string;
    taskDescription: string;
    agentResults: AgentResult[];
    criteriaScores: Map<string, CriteriaScore[]>; // agentId -> scores
    overallScores: Map<string, number>;           // agentId -> overall score
    ranking: string[];                             // agentIds sorted by score
    recommendation: {
        winnerId: string;
        winnerName: string;
        confidence: number;
        reasoning: string;
        tradeoffs: string[];
    };
    conflicts: ConflictAnalysis[];
    mergeStrategy: MergeStrategy;
    judgedAt: Date;
    judgmentDurationMs: number;
}

export interface ConflictAnalysis {
    file: string;
    agents: string[];
    conflictType: 'different_approach' | 'overlapping_changes' | 'incompatible_changes';
    severity: 'low' | 'medium' | 'high';
    resolution?: string;
}

export interface MergeStrategy {
    type: 'single_winner' | 'cherry_pick' | 'hybrid_merge';
    primaryAgent: string;
    filesFromOtherAgents: Array<{ file: string; agentId: string; reason: string }>;
    estimatedConflicts: number;
}

// =============================================================================
// DEFAULT CRITERIA
// =============================================================================

const DEFAULT_CRITERIA: JudgingCriteria[] = [
    {
        name: 'correctness',
        weight: 0.35,
        description: 'Does the code correctly implement the task requirements?',
    },
    {
        name: 'code_quality',
        weight: 0.20,
        description: 'Is the code clean, well-organized, and following best practices?',
    },
    {
        name: 'intent_alignment',
        weight: 0.20,
        description: 'Does the implementation align with the Intent Contract and app soul?',
    },
    {
        name: 'performance',
        weight: 0.10,
        description: 'Is the code efficient and performant?',
    },
    {
        name: 'maintainability',
        weight: 0.10,
        description: 'Is the code easy to understand and maintain?',
    },
    {
        name: 'anti_slop',
        weight: 0.05,
        description: 'Does the code avoid AI slop patterns (placeholders, generic styling)?',
    },
];

// =============================================================================
// MULTI-AGENT JUDGE SERVICE
// =============================================================================

export class MultiAgentJudgeService extends EventEmitter {
    private criteria: JudgingCriteria[];
    private openRouterClient: ReturnType<typeof getOpenRouterClient>;
    private judgments: Map<string, JudgmentResult> = new Map();

    constructor(customCriteria?: JudgingCriteria[]) {
        super();
        this.criteria = customCriteria || DEFAULT_CRITERIA;
        this.openRouterClient = getOpenRouterClient();

        // Validate weights sum to 1
        const weightSum = this.criteria.reduce((sum, c) => sum + c.weight, 0);
        if (Math.abs(weightSum - 1) > 0.01) {
            console.warn(`[MultiAgentJudge] Criteria weights sum to ${weightSum}, normalizing`);
            const normalizer = 1 / weightSum;
            this.criteria = this.criteria.map(c => ({ ...c, weight: c.weight * normalizer }));
        }
    }

    // =========================================================================
    // MAIN JUDGING METHOD
    // =========================================================================

    /**
     * Judge multiple agent results and recommend the best one
     * This is THE core method - evaluates all results and picks a winner
     */
    async judge(
        buildId: string,
        taskDescription: string,
        agentResults: AgentResult[],
        intentContext?: string
    ): Promise<JudgmentResult> {
        const startTime = Date.now();
        const judgmentId = uuidv4();

        console.log(`[MultiAgentJudge] Starting judgment ${judgmentId} for ${agentResults.length} agent results`);

        if (agentResults.length === 0) {
            throw new Error('No agent results to judge');
        }

        if (agentResults.length === 1) {
            // Single result - still score it but auto-recommend
            return this.judgeSingleResult(buildId, taskDescription, agentResults[0], judgmentId, startTime);
        }

        // Score each agent on all criteria
        const criteriaScores = new Map<string, CriteriaScore[]>();
        const overallScores = new Map<string, number>();

        for (const result of agentResults) {
            const scores = await this.scoreAgent(result, taskDescription, intentContext);
            criteriaScores.set(result.agentId, scores);

            // Calculate weighted overall score
            const overall = this.calculateOverallScore(scores);
            overallScores.set(result.agentId, overall);

            console.log(`[MultiAgentJudge] Agent ${result.agentName}: ${overall.toFixed(1)} overall`);
        }

        // Rank agents by score
        const ranking = [...overallScores.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([agentId]) => agentId);

        // Analyze conflicts between agents
        const conflicts = this.analyzeConflicts(agentResults);

        // Generate recommendation
        const recommendation = await this.generateRecommendation(
            agentResults,
            criteriaScores,
            overallScores,
            ranking,
            conflicts,
            taskDescription
        );

        // Determine merge strategy
        const mergeStrategy = this.determineMergeStrategy(
            agentResults,
            ranking,
            conflicts,
            criteriaScores
        );

        const result: JudgmentResult = {
            id: judgmentId,
            buildId,
            taskDescription,
            agentResults,
            criteriaScores,
            overallScores,
            ranking,
            recommendation,
            conflicts,
            mergeStrategy,
            judgedAt: new Date(),
            judgmentDurationMs: Date.now() - startTime,
        };

        this.judgments.set(judgmentId, result);

        this.emit('judgment:complete', result);
        console.log(`[MultiAgentJudge] Judgment complete: Winner is ${recommendation.winnerName} (${recommendation.confidence}% confidence)`);

        return result;
    }

    /**
     * Handle single result case
     */
    private async judgeSingleResult(
        buildId: string,
        taskDescription: string,
        result: AgentResult,
        judgmentId: string,
        startTime: number
    ): Promise<JudgmentResult> {
        const scores = await this.scoreAgent(result, taskDescription);
        const overall = this.calculateOverallScore(scores);

        const criteriaScores = new Map<string, CriteriaScore[]>();
        criteriaScores.set(result.agentId, scores);

        const overallScores = new Map<string, number>();
        overallScores.set(result.agentId, overall);

        return {
            id: judgmentId,
            buildId,
            taskDescription,
            agentResults: [result],
            criteriaScores,
            overallScores,
            ranking: [result.agentId],
            recommendation: {
                winnerId: result.agentId,
                winnerName: result.agentName,
                confidence: 100,
                reasoning: 'Single agent result - auto-selected',
                tradeoffs: [],
            },
            conflicts: [],
            mergeStrategy: {
                type: 'single_winner',
                primaryAgent: result.agentId,
                filesFromOtherAgents: [],
                estimatedConflicts: 0,
            },
            judgedAt: new Date(),
            judgmentDurationMs: Date.now() - startTime,
        };
    }

    // =========================================================================
    // SCORING
    // =========================================================================

    /**
     * Score an agent result on all criteria
     */
    private async scoreAgent(
        result: AgentResult,
        taskDescription: string,
        intentContext?: string
    ): Promise<CriteriaScore[]> {
        const scores: CriteriaScore[] = [];

        // Use AI to evaluate each criteria
        for (const criterion of this.criteria) {
            const score = await this.evaluateCriterion(result, criterion, taskDescription, intentContext);
            scores.push(score);
        }

        return scores;
    }

    /**
     * Evaluate a single criterion using AI
     */
    private async evaluateCriterion(
        result: AgentResult,
        criterion: JudgingCriteria,
        taskDescription: string,
        intentContext?: string
    ): Promise<CriteriaScore> {
        // Build code sample from first few files
        const codePreview = this.buildCodePreview(result.output.files, 3);

        const prompt = `Evaluate this code implementation on the criterion: "${criterion.name}"

## Criterion Description
${criterion.description}

## Task Being Implemented
${taskDescription}

${intentContext ? `## Intent Context\n${intentContext}\n` : ''}

## Agent's Approach
${result.output.approach}

## Agent's Summary
${result.output.summary}

## Code Sample
${codePreview}

## Metrics
- Verification Score: ${result.metrics.verificationScore}
- Error Count: ${result.metrics.errorCount}
- Execution Time: ${result.metrics.executionTimeMs}ms

## Instructions
Score this implementation from 0-100 on the "${criterion.name}" criterion.
Provide specific evidence from the code to justify your score.

Respond in JSON format:
{
    "score": <number 0-100>,
    "reasoning": "<brief explanation>",
    "evidence": ["<specific code/behavior evidence>", ...]
}`;

        try {
            const phaseConfig = getPhaseConfig('tournament_judge');
            const client = this.openRouterClient.getClient();

            const response = await client.messages.create({
                model: phaseConfig.model,
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: prompt,
                }],
            });

            const responseText = response.content
                .filter(block => block.type === 'text')
                .map(block => (block as { type: 'text'; text: string }).text)
                .join('');

            // Parse JSON response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    criteria: criterion.name,
                    score: Math.max(0, Math.min(100, parsed.score)),
                    reasoning: parsed.reasoning || '',
                    evidence: parsed.evidence || [],
                };
            }
        } catch (error) {
            console.error(`[MultiAgentJudge] Failed to evaluate ${criterion.name}:`, error);
        }

        // Fallback to metric-based scoring
        return this.fallbackScore(result, criterion);
    }

    /**
     * Fallback scoring based on metrics when AI evaluation fails
     */
    private fallbackScore(result: AgentResult, criterion: JudgingCriteria): CriteriaScore {
        let score = 70; // Base score

        // Adjust based on criterion
        switch (criterion.name) {
            case 'correctness':
                score = result.metrics.verificationScore;
                break;
            case 'code_quality':
                score = result.metrics.errorCount === 0 ? 85 : Math.max(50, 85 - result.metrics.errorCount * 5);
                break;
            case 'performance':
                score = result.metrics.executionTimeMs < 10000 ? 80 : 60;
                break;
            case 'anti_slop':
                score = result.metrics.verificationScore >= 85 ? 90 : 70;
                break;
            default:
                score = 70;
        }

        return {
            criteria: criterion.name,
            score,
            reasoning: 'Fallback scoring based on metrics',
            evidence: [`Verification score: ${result.metrics.verificationScore}`],
        };
    }

    /**
     * Calculate weighted overall score
     */
    private calculateOverallScore(scores: CriteriaScore[]): number {
        let weightedSum = 0;

        for (const score of scores) {
            const criterion = this.criteria.find(c => c.name === score.criteria);
            if (criterion) {
                weightedSum += score.score * criterion.weight;
            }
        }

        return weightedSum;
    }

    // =========================================================================
    // CONFLICT ANALYSIS
    // =========================================================================

    /**
     * Analyze conflicts between agent outputs
     */
    private analyzeConflicts(results: AgentResult[]): ConflictAnalysis[] {
        const conflicts: ConflictAnalysis[] = [];
        const fileToAgents = new Map<string, string[]>();

        // Build map of files to agents that modified them
        for (const result of results) {
            for (const filePath of result.output.files.keys()) {
                const agents = fileToAgents.get(filePath) || [];
                agents.push(result.agentId);
                fileToAgents.set(filePath, agents);
            }
        }

        // Find files modified by multiple agents
        for (const [filePath, agentIds] of fileToAgents) {
            if (agentIds.length > 1) {
                const conflict = this.analyzeFileConflict(filePath, agentIds, results);
                conflicts.push(conflict);
            }
        }

        return conflicts;
    }

    /**
     * Analyze a specific file conflict
     */
    private analyzeFileConflict(
        filePath: string,
        agentIds: string[],
        results: AgentResult[]
    ): ConflictAnalysis {
        const contents: string[] = [];

        for (const agentId of agentIds) {
            const result = results.find(r => r.agentId === agentId);
            if (result) {
                const content = result.output.files.get(filePath) || '';
                contents.push(content);
            }
        }

        // Compare contents to determine conflict type
        const allSame = contents.every(c => c === contents[0]);
        if (allSame) {
            return {
                file: filePath,
                agents: agentIds,
                conflictType: 'different_approach',
                severity: 'low',
                resolution: 'Contents are identical - no actual conflict',
            };
        }

        // Check if one is a subset of another (overlapping)
        const hasSubset = contents.some((c1, i) =>
            contents.some((c2, j) => i !== j && c2.includes(c1))
        );

        if (hasSubset) {
            return {
                file: filePath,
                agents: agentIds,
                conflictType: 'overlapping_changes',
                severity: 'medium',
                resolution: 'Choose the more complete implementation',
            };
        }

        // Fully different implementations
        return {
            file: filePath,
            agents: agentIds,
            conflictType: 'incompatible_changes',
            severity: 'high',
            resolution: 'Manual review or choose one implementation',
        };
    }

    // =========================================================================
    // RECOMMENDATION GENERATION
    // =========================================================================

    /**
     * Generate recommendation with AI reasoning
     */
    private async generateRecommendation(
        results: AgentResult[],
        criteriaScores: Map<string, CriteriaScore[]>,
        overallScores: Map<string, number>,
        ranking: string[],
        conflicts: ConflictAnalysis[],
        taskDescription: string
    ): Promise<JudgmentResult['recommendation']> {
        const winnerId = ranking[0];
        const winner = results.find(r => r.agentId === winnerId)!;
        const runnerUp = results.find(r => r.agentId === ranking[1]);

        const winnerScore = overallScores.get(winnerId) || 0;
        const runnerUpScore = runnerUp ? overallScores.get(ranking[1]) || 0 : 0;

        // Calculate confidence based on score gap
        const scoreGap = runnerUp ? winnerScore - runnerUpScore : 30;
        const confidence = Math.min(99, Math.max(60, 70 + scoreGap));

        // Build tradeoffs
        const tradeoffs: string[] = [];

        if (runnerUp) {
            const winnerScores = criteriaScores.get(winnerId) || [];
            const runnerUpScores = criteriaScores.get(ranking[1]) || [];

            for (const criterion of this.criteria) {
                const winnerCriterionScore = winnerScores.find(s => s.criteria === criterion.name)?.score || 0;
                const runnerUpCriterionScore = runnerUpScores.find(s => s.criteria === criterion.name)?.score || 0;

                if (runnerUpCriterionScore > winnerCriterionScore + 10) {
                    tradeoffs.push(
                        `${runnerUp.agentName} scored higher on ${criterion.name} (${runnerUpCriterionScore} vs ${winnerCriterionScore})`
                    );
                }
            }
        }

        // Generate reasoning
        const winnerScoresFormatted = (criteriaScores.get(winnerId) || [])
            .map(s => `${s.criteria}: ${s.score}`)
            .join(', ');

        const reasoning = `${winner.agentName} scored ${winnerScore.toFixed(1)} overall (${winnerScoresFormatted}). ` +
            (runnerUp
                ? `${scoreGap.toFixed(1)} points ahead of ${runnerUp.agentName}. `
                : '') +
            (conflicts.length > 0
                ? `${conflicts.length} file conflict(s) detected. `
                : 'No file conflicts. ') +
            `Approach: ${winner.output.approach.substring(0, 100)}...`;

        return {
            winnerId,
            winnerName: winner.agentName,
            confidence,
            reasoning,
            tradeoffs,
        };
    }

    // =========================================================================
    // MERGE STRATEGY
    // =========================================================================

    /**
     * Determine optimal merge strategy
     */
    private determineMergeStrategy(
        results: AgentResult[],
        ranking: string[],
        conflicts: ConflictAnalysis[],
        criteriaScores: Map<string, CriteriaScore[]>
    ): MergeStrategy {
        const winnerId = ranking[0];
        const winner = results.find(r => r.agentId === winnerId)!;

        // If no conflicts, single winner takes all
        if (conflicts.length === 0) {
            return {
                type: 'single_winner',
                primaryAgent: winnerId,
                filesFromOtherAgents: [],
                estimatedConflicts: 0,
            };
        }

        // Check if we can cherry-pick best files from each
        const filesFromOthers: MergeStrategy['filesFromOtherAgents'] = [];

        for (const conflict of conflicts) {
            if (conflict.severity === 'low') continue;

            // Find which agent has the best implementation of this file
            let bestAgent = winnerId;
            let bestScore = 0;

            for (const agentId of conflict.agents) {
                const scores = criteriaScores.get(agentId) || [];
                const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
                if (avgScore > bestScore) {
                    bestScore = avgScore;
                    bestAgent = agentId;
                }
            }

            if (bestAgent !== winnerId) {
                filesFromOthers.push({
                    file: conflict.file,
                    agentId: bestAgent,
                    reason: `Higher quality implementation (score: ${bestScore.toFixed(1)})`,
                });
            }
        }

        if (filesFromOthers.length > 0) {
            return {
                type: 'cherry_pick',
                primaryAgent: winnerId,
                filesFromOtherAgents: filesFromOthers,
                estimatedConflicts: conflicts.filter(c => c.severity === 'high').length,
            };
        }

        // Default to single winner
        return {
            type: 'single_winner',
            primaryAgent: winnerId,
            filesFromOtherAgents: [],
            estimatedConflicts: conflicts.filter(c => c.severity === 'high').length,
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Build a preview of the code for AI evaluation
     */
    private buildCodePreview(files: Map<string, string>, maxFiles: number): string {
        const previews: string[] = [];
        let count = 0;

        for (const [path, content] of files) {
            if (count >= maxFiles) break;

            const truncated = content.length > 500
                ? content.substring(0, 500) + '\n// ... (truncated)'
                : content;

            previews.push(`// ${path}\n${truncated}`);
            count++;
        }

        return previews.join('\n\n');
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    /**
     * Get judgment by ID
     */
    getJudgment(judgmentId: string): JudgmentResult | null {
        return this.judgments.get(judgmentId) || null;
    }

    /**
     * Get all judgments for a build
     */
    getBuildJudgments(buildId: string): JudgmentResult[] {
        return Array.from(this.judgments.values())
            .filter(j => j.buildId === buildId);
    }

    /**
     * Get criteria weights
     */
    getCriteria(): JudgingCriteria[] {
        return [...this.criteria];
    }

    /**
     * Update criteria weights
     */
    setCriteria(criteria: JudgingCriteria[]): void {
        this.criteria = criteria;
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let judgeService: MultiAgentJudgeService | null = null;

export function getMultiAgentJudge(): MultiAgentJudgeService {
    if (!judgeService) {
        judgeService = new MultiAgentJudgeService();
    }
    return judgeService;
}

export function createMultiAgentJudge(
    customCriteria?: JudgingCriteria[]
): MultiAgentJudgeService {
    return new MultiAgentJudgeService(customCriteria);
}
