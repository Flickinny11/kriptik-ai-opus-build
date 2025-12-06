/**
 * Infinite Reflection Engine
 *
 * Self-healing loop that continuously improves code quality.
 * Targets 4x faster self-healing than competition (Replit's 3x claim).
 *
 * Features:
 * - Continuous quality monitoring
 * - Automatic issue detection and fixing
 * - Learning from past fixes
 * - Parallel reflection workers
 * - Escalation to human only as last resort
 *
 * Part of Phase 8: Competitive Enhancements (Ultimate AI-First Builder Architecture)
 */

import { createClaudeService, CLAUDE_MODELS } from './claude-service.js';
import { createErrorEscalationEngine, type BuildError, type EscalationResult, type ErrorCategory } from '../automation/error-escalation.js';
import { createVerificationSwarm, type CombinedVerificationResult, type VerificationResult, type VerificationIssue } from '../verification/swarm.js';
import { createAntiSlopDetector } from '../verification/anti-slop-detector.js';
import type { Feature, FeatureVerificationStatus, FeatureVerificationScores } from './feature-list.js';
import type { AppSoulType } from './app-soul.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// REFLECTION ENGINE TYPES
// ============================================================================

export interface ReflectionConfig {
    // Loop settings
    maxIterations: number;         // Maximum reflection cycles
    targetScore: number;           // Stop when this overall score is reached
    iterationTimeoutMs: number;    // Max time per iteration

    // Quality thresholds
    codeQualityThreshold: number;
    visualThreshold: number;
    antiSlopThreshold: number;
    securityThreshold: number;

    // Speed settings
    parallelWorkers: number;       // Number of parallel reflection workers
    batchSize: number;             // Issues to fix per batch

    // Learning settings
    enableLearning: boolean;       // Learn from successful fixes
    similarityThreshold: number;   // For finding similar past issues

    // Escalation settings
    maxAutoFixAttempts: number;    // Before escalating
    escalateToHuman: boolean;      // Allow human escalation
}

export interface ReflectionIssue {
    id: string;
    type: 'error' | 'quality' | 'visual' | 'security' | 'placeholder' | 'design';
    severity: 'critical' | 'major' | 'minor';
    description: string;
    location?: string;
    suggestion?: string;
    fixAttempts: number;
    status: 'pending' | 'fixing' | 'fixed' | 'escalated' | 'skipped';
}

export interface ReflectionCycle {
    id: string;
    iteration: number;
    startTime: Date;
    endTime?: Date;
    issuesFound: number;
    issuesFixed: number;
    issuesEscalated: number;
    scoresBefore: Record<string, number>;
    scoresAfter: Record<string, number>;
    filesModified: string[];
}

export interface ReflectionResult {
    id: string;
    status: 'complete' | 'timeout' | 'max_iterations' | 'escalated';
    totalIterations: number;
    totalTimeMs: number;
    issuesFound: number;
    issuesFixed: number;
    issuesEscalated: number;
    finalScores: Record<string, number>;
    improvementPercent: number;
    cycles: ReflectionCycle[];
    learnings: string[];
}

export interface ReflectionLearning {
    issuePattern: string;
    successfulFix: string;
    confidence: number;
    timesUsed: number;
    successRate: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: ReflectionConfig = {
    maxIterations: 10,
    targetScore: 90,
    iterationTimeoutMs: 60000,

    codeQualityThreshold: 85,
    visualThreshold: 85,
    antiSlopThreshold: 85,
    securityThreshold: 90,

    parallelWorkers: 3,
    batchSize: 5,

    enableLearning: true,
    similarityThreshold: 0.8,

    maxAutoFixAttempts: 4,
    escalateToHuman: false,
};

// ============================================================================
// INFINITE REFLECTION ENGINE
// ============================================================================

export class InfiniteReflectionEngine extends EventEmitter {
    private projectId: string;
    private userId: string;
    private buildId: string;
    private config: ReflectionConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private errorEscalation: ReturnType<typeof createErrorEscalationEngine>;
    private verificationSwarm: ReturnType<typeof createVerificationSwarm>;
    private antiSlopDetector: ReturnType<typeof createAntiSlopDetector>;

    // Learning storage (in production, would be database-backed)
    private learnings: Map<string, ReflectionLearning> = new Map();

    // State
    private isRunning: boolean = false;
    private currentFiles: Map<string, string> = new Map();
    private issues: Map<string, ReflectionIssue> = new Map();
    private cycles: ReflectionCycle[] = [];

    constructor(
        projectId: string,
        userId: string,
        buildId: string,
        config?: Partial<ReflectionConfig>,
        appSoul?: AppSoulType
    ) {
        super();
        this.projectId = projectId;
        this.userId = userId;
        this.buildId = buildId;
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.claudeService = createClaudeService({
            agentType: 'refinement',
            projectId,
            userId,
        });

        this.errorEscalation = createErrorEscalationEngine(buildId, projectId, userId);
        this.verificationSwarm = createVerificationSwarm(buildId, projectId, userId);
        this.antiSlopDetector = createAntiSlopDetector(userId, projectId, appSoul);
    }

    /**
     * Start the infinite reflection loop
     */
    async reflect(
        files: Map<string, string>,
        buildIntentId: string
    ): Promise<ReflectionResult> {
        const reflectionId = uuidv4();
        const startTime = Date.now();

        this.isRunning = true;
        this.currentFiles = new Map(files);
        this.issues.clear();
        this.cycles = [];

        this.emit('reflection_start', { reflectionId, fileCount: files.size });
        console.log(`[ReflectionEngine] Starting reflection ${reflectionId}`);

        let iteration = 0;
        let totalIssuesFound = 0;
        let totalIssuesFixed = 0;
        let totalIssuesEscalated = 0;
        const learnings: string[] = [];

        // Get initial scores
        const initialScores = await this.getScores();

        // Main reflection loop
        while (this.isRunning && iteration < this.config.maxIterations) {
            iteration++;

            this.emit('iteration_start', { iteration, maxIterations: this.config.maxIterations });
            console.log(`[ReflectionEngine] Iteration ${iteration}/${this.config.maxIterations}`);

            const cycleStart = Date.now();
            const scoresBefore = await this.getScores();

            // Check if we've reached target score
            if (this.meetsTargetScore(scoresBefore)) {
                console.log(`[ReflectionEngine] Target score ${this.config.targetScore} reached!`);
                break;
            }

            // Phase 1: Find issues
            const foundIssues = await this.findIssues();
            totalIssuesFound += foundIssues.length;

            if (foundIssues.length === 0) {
                console.log(`[ReflectionEngine] No issues found in iteration ${iteration}`);
                break;
            }

            // Phase 2: Fix issues in batches
            const { fixed, escalated, fixLearnings } = await this.fixIssuesBatch(
                foundIssues.slice(0, this.config.batchSize),
                buildIntentId
            );

            totalIssuesFixed += fixed;
            totalIssuesEscalated += escalated;
            learnings.push(...fixLearnings);

            // Phase 3: Verify fixes
            const scoresAfter = await this.getScores();

            // Record cycle
            const cycle: ReflectionCycle = {
                id: uuidv4(),
                iteration,
                startTime: new Date(cycleStart),
                endTime: new Date(),
                issuesFound: foundIssues.length,
                issuesFixed: fixed,
                issuesEscalated: escalated,
                scoresBefore,
                scoresAfter,
                filesModified: [], // Would track actual modified files
            };

            this.cycles.push(cycle);

            this.emit('iteration_complete', {
                iteration,
                issuesFixed: fixed,
                scoresBefore,
                scoresAfter,
            });

            // Check for timeout
            if (Date.now() - startTime > this.config.iterationTimeoutMs * this.config.maxIterations) {
                console.log(`[ReflectionEngine] Total timeout reached`);
                break;
            }

            // If no progress in this iteration, consider stopping
            if (fixed === 0 && escalated === 0) {
                console.log(`[ReflectionEngine] No progress in iteration ${iteration}, stopping`);
                break;
            }
        }

        this.isRunning = false;
        const finalScores = await this.getScores();
        const totalTimeMs = Date.now() - startTime;

        // Calculate improvement
        const improvementPercent = this.calculateImprovement(initialScores, finalScores);

        // Determine status
        let status: ReflectionResult['status'] = 'complete';
        if (iteration >= this.config.maxIterations) {
            status = 'max_iterations';
        } else if (totalIssuesEscalated > 0) {
            status = 'escalated';
        } else if (Date.now() - startTime > this.config.iterationTimeoutMs * this.config.maxIterations) {
            status = 'timeout';
        }

        const result: ReflectionResult = {
            id: reflectionId,
            status,
            totalIterations: iteration,
            totalTimeMs,
            issuesFound: totalIssuesFound,
            issuesFixed: totalIssuesFixed,
            issuesEscalated: totalIssuesEscalated,
            finalScores,
            improvementPercent,
            cycles: this.cycles,
            learnings,
        };

        this.emit('reflection_complete', result);
        console.log(`[ReflectionEngine] Complete. Fixed ${totalIssuesFixed}/${totalIssuesFound} issues in ${iteration} iterations`);

        return result;
    }

    /**
     * Stop the reflection loop
     */
    stop(): void {
        this.isRunning = false;
        this.emit('reflection_stopped', { reason: 'manual' });
    }

    /**
     * Get current files
     */
    getFiles(): Map<string, string> {
        return new Map(this.currentFiles);
    }

    /**
     * Get current issues
     */
    getIssues(): ReflectionIssue[] {
        return Array.from(this.issues.values());
    }

    // ==========================================================================
    // INTERNAL METHODS
    // ==========================================================================

    /**
     * Create a synthetic Feature for verification
     */
    private createSyntheticFeature(featureId: string, description: string): Feature {
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
            buildIntentId: this.buildId,
            orchestrationRunId: this.buildId,
            projectId: this.projectId,
            featureId,
            category: 'functional',
            description,
            priority: 1,
            implementationSteps: [],
            visualRequirements: [],
            filesModified: Array.from(this.currentFiles.keys()),
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
     * Get current quality scores
     */
    private async getScores(): Promise<Record<string, number>> {
        try {
            const reflectionFeature = this.createSyntheticFeature('reflection-check', 'Reflection quality check');

            // Run verification
            const swarmResult = await this.verificationSwarm.verifyFeature(
                reflectionFeature,
                this.currentFiles
            );

            const antiSlopResult = await this.antiSlopDetector.analyze(this.currentFiles);

            const scores = this.extractScores(swarmResult);

            return {
                codeQuality: scores.codeQuality,
                visual: scores.visual,
                antiSlop: antiSlopResult.overall,
                security: scores.security,
                overall: Math.round(
                    scores.codeQuality * 0.3 +
                    scores.visual * 0.2 +
                    antiSlopResult.overall * 0.3 +
                    scores.security * 0.2
                ),
            };
        } catch (error) {
            console.error('[ReflectionEngine] Error getting scores:', error);
            return { codeQuality: 70, visual: 70, antiSlop: 70, security: 70, overall: 70 };
        }
    }

    /**
     * Check if scores meet target
     */
    private meetsTargetScore(scores: Record<string, number>): boolean {
        return scores.overall >= this.config.targetScore &&
               scores.codeQuality >= this.config.codeQualityThreshold &&
               scores.visual >= this.config.visualThreshold &&
               scores.antiSlop >= this.config.antiSlopThreshold &&
               scores.security >= this.config.securityThreshold;
    }

    /**
     * Find issues in current files
     */
    private async findIssues(): Promise<ReflectionIssue[]> {
        const issues: ReflectionIssue[] = [];

        try {
            const reflectionFeature = this.createSyntheticFeature('reflection-check', 'Reflection issue check');

            // Run verification to find issues
            const swarmResult = await this.verificationSwarm.verifyFeature(
                reflectionFeature,
                this.currentFiles
            );

            // Extract and convert verification issues to reflection issues
            const verificationIssues = this.extractIssues(swarmResult);
            for (const issue of verificationIssues) {
                const reflectionIssue: ReflectionIssue = {
                    id: uuidv4(),
                    type: this.mapIssueCategory(issue.category),
                    severity: this.mapSeverity(issue.severity),
                    description: issue.description,
                    location: issue.file ? `${issue.file}:${issue.line ?? ''}` : undefined,
                    suggestion: issue.suggestion,
                    fixAttempts: 0,
                    status: 'pending',
                };

                // Skip if we already have this issue
                const existingIssue = this.findSimilarIssue(reflectionIssue);
                if (!existingIssue) {
                    this.issues.set(reflectionIssue.id, reflectionIssue);
                    issues.push(reflectionIssue);
                }
            }

            // Run anti-slop check
            const antiSlopResult = await this.antiSlopDetector.analyze(this.currentFiles);

            for (const violation of antiSlopResult.violations) {
                const reflectionIssue: ReflectionIssue = {
                    id: uuidv4(),
                    type: 'design',
                    severity: this.mapSeverity(violation.severity),
                    description: violation.description,
                    location: violation.location,
                    suggestion: violation.suggestion,
                    fixAttempts: 0,
                    status: 'pending',
                };

                const existingIssue = this.findSimilarIssue(reflectionIssue);
                if (!existingIssue) {
                    this.issues.set(reflectionIssue.id, reflectionIssue);
                    issues.push(reflectionIssue);
                }
            }

        } catch (error) {
            console.error('[ReflectionEngine] Error finding issues:', error);
        }

        // Sort by severity (critical first)
        issues.sort((a, b) => {
            const severityOrder = { critical: 0, major: 1, minor: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        return issues;
    }

    /**
     * Map issue category from verification to reflection type
     */
    private mapIssueCategory(category: string): ReflectionIssue['type'] {
        const typeMap: Record<string, ReflectionIssue['type']> = {
            error: 'error',
            code_quality: 'quality',
            visual: 'visual',
            security: 'security',
            placeholder: 'placeholder',
            design: 'design',
        };
        return typeMap[category] || 'quality';
    }

    /**
     * Map severity
     */
    private mapSeverity(severity: string): 'critical' | 'major' | 'minor' {
        const severityMap: Record<string, 'critical' | 'major' | 'minor'> = {
            critical: 'critical',
            high: 'major',
            medium: 'major',
            low: 'minor',
        };
        return severityMap[severity] || 'minor';
    }

    /**
     * Find similar existing issue
     */
    private findSimilarIssue(issue: ReflectionIssue): ReflectionIssue | undefined {
        for (const existing of this.issues.values()) {
            if (
                existing.type === issue.type &&
                existing.location === issue.location &&
                existing.status !== 'fixed'
            ) {
                return existing;
            }
        }
        return undefined;
    }

    /**
     * Create a BuildError from a ReflectionIssue
     */
    private createBuildError(issue: ReflectionIssue): BuildError {
        const [file, lineStr] = (issue.location || '').split(':');
        const line = lineStr ? parseInt(lineStr, 10) : undefined;
        
        return {
            id: issue.id,
            featureId: 'reflection-fix',
            category: this.mapReflectionTypeToBuildErrorCategory(issue.type),
            message: issue.description,
            file: file || undefined,
            line: isNaN(line as number) ? undefined : line,
            context: {
                suggestion: issue.suggestion,
                severity: issue.severity,
            },
            timestamp: new Date(),
        };
    }

    /**
     * Map reflection issue type to BuildError category
     */
    private mapReflectionTypeToBuildErrorCategory(type: ReflectionIssue['type']): ErrorCategory {
        const categoryMap: Record<ReflectionIssue['type'], ErrorCategory> = {
            error: 'syntax_error',
            quality: 'type_mismatch',
            visual: 'runtime_error',
            security: 'runtime_error',
            placeholder: 'type_mismatch',
            design: 'type_mismatch',
        };
        return categoryMap[type] || 'runtime_error';
    }

    /**
     * Fix a batch of issues
     */
    private async fixIssuesBatch(
        issues: ReflectionIssue[],
        _buildIntentId: string
    ): Promise<{ fixed: number; escalated: number; fixLearnings: string[] }> {
        let fixed = 0;
        let escalated = 0;
        const fixLearnings: string[] = [];

        // Group issues by file for efficiency
        const issuesByFile = new Map<string, ReflectionIssue[]>();
        for (const issue of issues) {
            const file = issue.location?.split(':')[0] || 'unknown';
            if (!issuesByFile.has(file)) {
                issuesByFile.set(file, []);
            }
            issuesByFile.get(file)!.push(issue);
        }

        // Fix issues file by file
        for (const [, fileIssues] of issuesByFile) {
            for (const issue of fileIssues) {
                issue.status = 'fixing';
                issue.fixAttempts++;

                this.emit('fixing_issue', { issueId: issue.id, attempt: issue.fixAttempts });

                try {
                    // Check for learned fix
                    const learnedFix = this.findLearnedFix(issue);

                    if (learnedFix && learnedFix.confidence > 0.8) {
                        // Apply learned fix
                        const success = await this.applyLearnedFix(issue, learnedFix);
                        if (success) {
                            issue.status = 'fixed';
                            fixed++;
                            fixLearnings.push(`Applied learned fix for ${issue.type}: ${issue.description.substring(0, 50)}...`);
                            continue;
                        }
                    }

                    // Create a BuildError from the ReflectionIssue
                    const buildError = this.createBuildError(issue);

                    // Use error escalation service for robust fixing
                    const fixResult: EscalationResult = await this.errorEscalation.fixError(
                        buildError,
                        this.currentFiles
                    );

                    if (fixResult.success && fixResult.fix) {
                        // Apply the fix changes to current files
                        for (const change of fixResult.fix.changes) {
                            if (change.action === 'create' || change.action === 'update') {
                                this.currentFiles.set(change.path, change.newContent || '');
                            } else if (change.action === 'delete') {
                                this.currentFiles.delete(change.path);
                            }
                        }
                        
                        issue.status = 'fixed';
                        fixed++;

                        // Learn from this fix
                        if (this.config.enableLearning) {
                            this.learnFromFix(issue, { success: true, message: fixResult.message });
                            fixLearnings.push(`Learned fix pattern for ${issue.type}: ${issue.description.substring(0, 50)}...`);
                        }
                    } else if (issue.fixAttempts >= this.config.maxAutoFixAttempts) {
                        issue.status = 'escalated';
                        escalated++;
                        this.emit('issue_escalated', { issue });
                    } else {
                        issue.status = 'pending'; // Will retry next iteration
                    }

                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`[ReflectionEngine] Error fixing issue ${issue.id}:`, errorMessage);

                    if (issue.fixAttempts >= this.config.maxAutoFixAttempts) {
                        issue.status = 'escalated';
                        escalated++;
                    } else {
                        issue.status = 'pending';
                    }
                }
            }
        }

        return { fixed, escalated, fixLearnings };
    }

    /**
     * Find a learned fix for an issue
     */
    private findLearnedFix(issue: ReflectionIssue): ReflectionLearning | undefined {
        // Simple pattern matching - in production would use embeddings
        const pattern = `${issue.type}:${issue.description.substring(0, 50)}`;

        for (const [storedPattern, learning] of this.learnings) {
            if (this.calculateSimilarity(pattern, storedPattern) > this.config.similarityThreshold) {
                return learning;
            }
        }

        return undefined;
    }

    /**
     * Calculate string similarity (simple Jaccard)
     */
    private calculateSimilarity(a: string, b: string): number {
        const setA = new Set(a.toLowerCase().split(/\s+/));
        const setB = new Set(b.toLowerCase().split(/\s+/));

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        return intersection.size / union.size;
    }

    /**
     * Apply a learned fix
     */
    private async applyLearnedFix(
        issue: ReflectionIssue,
        learning: ReflectionLearning
    ): Promise<boolean> {
        try {
            // Generate fix using the learned pattern
            const response = await this.claudeService.generate(
                `Apply this learned fix pattern to resolve the issue:

ISSUE: ${issue.description}
LOCATION: ${issue.location || 'unknown'}

LEARNED FIX PATTERN:
${learning.successfulFix}

Apply the pattern to fix this specific issue.`,
                {
                    model: CLAUDE_MODELS.SONNET_4_5,
                    maxTokens: 8000,
                }
            );

            const fileOps = this.claudeService.parseFileOperations(response.content);

            if (fileOps.length > 0) {
                for (const op of fileOps) {
                    if (op.type === 'create' || op.type === 'update') {
                        this.currentFiles.set(op.path, op.content || '');
                    } else if (op.type === 'delete') {
                        this.currentFiles.delete(op.path);
                    }
                }

                // Update learning stats
                learning.timesUsed++;
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Learn from a successful fix
     */
    private learnFromFix(
        issue: ReflectionIssue,
        fixResult: { success: boolean; message: string }
    ): void {
        const pattern = `${issue.type}:${issue.description.substring(0, 50)}`;

        const existing = this.learnings.get(pattern);

        if (existing) {
            // Update existing learning
            existing.successRate = (existing.successRate * existing.timesUsed + 1) / (existing.timesUsed + 1);
            existing.timesUsed++;
            existing.confidence = Math.min(1, existing.confidence + 0.1);
        } else {
            // Create new learning
            this.learnings.set(pattern, {
                issuePattern: pattern,
                successfulFix: fixResult.message,
                confidence: 0.6,
                timesUsed: 1,
                successRate: 1.0,
            });
        }
    }

    /**
     * Calculate improvement percentage
     */
    private calculateImprovement(
        initial: Record<string, number>,
        final: Record<string, number>
    ): number {
        const initialOverall = initial.overall || 70;
        const finalOverall = final.overall || 70;

        if (initialOverall === 0) return finalOverall;

        return Math.round(((finalOverall - initialOverall) / initialOverall) * 100);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createInfiniteReflectionEngine(
    projectId: string,
    userId: string,
    buildId: string,
    config?: Partial<ReflectionConfig>,
    appSoul?: AppSoulType
): InfiniteReflectionEngine {
    return new InfiniteReflectionEngine(projectId, userId, buildId, config, appSoul);
}

export default InfiniteReflectionEngine;
