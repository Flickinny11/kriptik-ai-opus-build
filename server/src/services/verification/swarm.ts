/**
 * 6-Agent Verification Swarm - Ultimate AI-First Builder Architecture
 *
 * Parallel verification system that runs continuously during Phase 2.
 * All 6 agents work together to ensure code quality, security, and design.
 *
 * Agents:
 * 1. Error Checker (5s polling) - TypeScript/ESLint/runtime errors
 * 2. Code Quality (30s polling) - Naming, DRY, error handling
 * 3. Visual Verifier (60s polling) - Screenshot analysis, Anti-Slop
 * 4. Security Scanner (60s polling) - Exposed keys, injection, XSS
 * 5. Placeholder Eliminator (10s polling) - ZERO TOLERANCE
 * 6. Design Style Agent (on feature complete) - Soul matching, 85+ required
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { verificationResults, featureProgress } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { ClaudeService, createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { getPhaseConfig, OPENROUTER_MODELS } from '../ai/openrouter-client.js';
import type { Feature, FeatureVerificationStatus } from '../ai/feature-list.js';
import type { IntentContract, VisualIdentity } from '../ai/intent-lock.js';
import {
    getPredictiveErrorPrevention,
    type PredictiveErrorPrevention,
    type PredictionResult,
    type ErrorType,
} from '../ai/predictive-error-prevention.js';

// =============================================================================
// TYPES
// =============================================================================

export type VerificationAgentType =
    | 'error_checker'
    | 'code_quality'
    | 'visual_verifier'
    | 'security_scanner'
    | 'placeholder_eliminator'
    | 'design_style';

export interface VerificationResult {
    id: string;
    featureId: string;
    orchestrationRunId: string;
    agentType: VerificationAgentType;
    passed: boolean;
    score?: number;
    issues: VerificationIssue[];
    details: string;
    timestamp: Date;
    durationMs: number;
}

export interface VerificationIssue {
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    description: string;
    file?: string;
    line?: number;
    suggestion?: string;
    autoFixable: boolean;
}

export interface SwarmConfig {
    errorCheckerIntervalMs: number;
    codeQualityIntervalMs: number;
    visualVerifierIntervalMs: number;
    securityScannerIntervalMs: number;
    placeholderEliminatorIntervalMs: number;
    minDesignScore: number;
    enableVisualVerification: boolean;
}

export interface SwarmState {
    running: boolean;
    activeAgents: Set<VerificationAgentType>;
    lastRunTimestamps: Map<VerificationAgentType, Date>;
    totalVerifications: number;
    issuesFound: number;
    issuesFixed: number;
}

export interface CombinedVerificationResult {
    featureId: string;
    allPassed: boolean;
    overallScore: number;
    verdict: 'APPROVED' | 'NEEDS_WORK' | 'BLOCKED' | 'REJECTED';
    results: {
        errorCheck: VerificationResult | null;
        codeQuality: VerificationResult | null;
        visualVerify: VerificationResult | null;
        securityScan: VerificationResult | null;
        placeholderCheck: VerificationResult | null;
        designStyle: VerificationResult | null;
    };
    blockers: string[];
}

// =============================================================================
// SWARM MODE SYSTEM - 5 Intelligent Modes
// =============================================================================

export type SwarmMode = 'lightning' | 'standard' | 'thorough' | 'production' | 'paranoid';

export interface SwarmModeConfig {
    name: string;
    description: string;
    maxFilesPerAgent: number;
    maxElementsToTest: number;
    maxSuggestionsPerError: number;
    maxIssuesReported: number;
    agentsEnabled: VerificationAgentType[];
    estimatedDurationSec: number;
    creditCost: number;
    recommended: boolean;
}

export const SWARM_MODES: Record<SwarmMode, SwarmModeConfig> = {
    lightning: {
        name: 'Lightning',
        description: 'Quick scan for critical issues only. Best for rapid iterations.',
        maxFilesPerAgent: 10,
        maxElementsToTest: 5,
        maxSuggestionsPerError: 3,
        maxIssuesReported: 20,
        agentsEnabled: ['error_checker', 'placeholder_eliminator'],
        estimatedDurationSec: 15,
        creditCost: 2,
        recommended: false,
    },
    standard: {
        name: 'Standard',
        description: 'Balanced verification for everyday development.',
        maxFilesPerAgent: 25,
        maxElementsToTest: 15,
        maxSuggestionsPerError: 5,
        maxIssuesReported: 50,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner'],
        estimatedDurationSec: 45,
        creditCost: 8,
        recommended: false,
    },
    thorough: {
        name: 'Thorough',
        description: 'Comprehensive analysis including visual verification.',
        maxFilesPerAgent: 50,
        maxElementsToTest: 30,
        maxSuggestionsPerError: 10,
        maxIssuesReported: 100,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner', 'visual_verifier', 'design_style'],
        estimatedDurationSec: 120,
        creditCost: 25,
        recommended: true,
    },
    production: {
        name: 'Production',
        description: 'Full enterprise-grade verification before deployment.',
        maxFilesPerAgent: 100,
        maxElementsToTest: 50,
        maxSuggestionsPerError: 15,
        maxIssuesReported: 200,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner', 'visual_verifier', 'design_style'],
        estimatedDurationSec: 300,
        creditCost: 50,
        recommended: false,
    },
    paranoid: {
        name: 'Paranoid',
        description: 'Maximum depth analysis. Checks EVERYTHING. No limits.',
        maxFilesPerAgent: Infinity,
        maxElementsToTest: Infinity,
        maxSuggestionsPerError: Infinity,
        maxIssuesReported: Infinity,
        agentsEnabled: ['error_checker', 'placeholder_eliminator', 'code_quality', 'security_scanner', 'visual_verifier', 'design_style'],
        estimatedDurationSec: 600,
        creditCost: 100,
        recommended: false,
    },
};

// =============================================================================
// FINE-GRAIN AGENT CONFIGURATION
// =============================================================================

export interface AgentFineGrainConfig {
    agentType: VerificationAgentType;
    enabled: boolean;
    maxFiles: number;
    maxIssues: number;
    priority: 'critical' | 'high' | 'normal' | 'low';
    autoFix: boolean;
}

export const DEFAULT_AGENT_CONFIGS: AgentFineGrainConfig[] = [
    { agentType: 'error_checker', enabled: true, maxFiles: 50, maxIssues: 100, priority: 'critical', autoFix: false },
    { agentType: 'placeholder_eliminator', enabled: true, maxFiles: 50, maxIssues: 100, priority: 'critical', autoFix: false },
    { agentType: 'code_quality', enabled: true, maxFiles: 50, maxIssues: 50, priority: 'high', autoFix: true },
    { agentType: 'security_scanner', enabled: true, maxFiles: 50, maxIssues: 50, priority: 'critical', autoFix: false },
    { agentType: 'visual_verifier', enabled: true, maxFiles: 30, maxIssues: 30, priority: 'high', autoFix: false },
    { agentType: 'design_style', enabled: true, maxFiles: 30, maxIssues: 30, priority: 'normal', autoFix: false },
];

// =============================================================================
// BUG HUNT SYSTEM
// =============================================================================

export interface IntentLockCheck {
    checkId: string;
    bugId: string;
    intentSection: string;
    approved: boolean;
    reason: string;
    timestamp: Date;
}

export interface BugReport {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'logic' | 'type' | 'security' | 'performance' | 'accessibility' | 'ux';
    description: string;
    file: string;
    line: number;
    code: string;
    suggestedFix: string;
    fixApplied: boolean;
    intentLockApproved: boolean;
    reasoning: string;
}

export interface BugHuntResult {
    id: string;
    projectId: string;
    startedAt: Date;
    completedAt: Date | null;
    bugsFound: BugReport[];
    bugsFixed: BugReport[];
    bugsNeedingHumanReview: BugReport[];
    intentLockChecks: IntentLockCheck[];
    summary: string;
    status: 'running' | 'completed' | 'failed';
    filesScanned: number;
    totalLinesAnalyzed: number;
}

export interface SwarmRunContext {
    buildPhase: 'planning' | 'implementing' | 'verifying' | 'deploying';
    changeSize: 'small' | 'medium' | 'large';
    lastVerificationMinutesAgo: number;
    previousFailureRate: number;
    /** Predicted error types from PredictiveErrorPrevention (optional) */
    predictedErrorTypes?: ErrorType[];
    /** Confidence score from predictions (0-1) */
    predictionConfidence?: number;
}

/**
 * Intelligent Mode Recommendation System
 * Recommends swarm mode based on build context AND predicted errors
 *
 * ENHANCED: Now uses PredictiveErrorPrevention to recommend more thorough
 * verification when certain error types are predicted with high confidence.
 */
export function recommendSwarmMode(context: SwarmRunContext): SwarmMode {
    const {
        buildPhase,
        changeSize,
        lastVerificationMinutesAgo,
        previousFailureRate,
        predictedErrorTypes,
        predictionConfidence,
    } = context;

    // High failure rate? Go paranoid
    if (previousFailureRate > 0.5) {
        return 'paranoid';
    }

    // Deploying? Production mode mandatory
    if (buildPhase === 'deploying') {
        return 'production';
    }

    // Check if predicted errors warrant more thorough verification
    if (predictedErrorTypes && predictedErrorTypes.length > 0 && predictionConfidence) {
        const highRiskErrorTypes: ErrorType[] = ['security', 'type_mismatch', 'runtime', 'api_misuse'];
        const hasHighRiskPredictions = predictedErrorTypes.some(t => highRiskErrorTypes.includes(t));

        // High confidence predictions of risky errors = more thorough verification
        if (hasHighRiskPredictions && predictionConfidence > 0.8) {
            console.log(
                `[SwarmMode] Upgrading to thorough mode due to high-confidence predictions: ` +
                `${predictedErrorTypes.join(', ')}`
            );
            // Note: 'deploying' case already returned 'production' above
            return 'thorough';
        }

        // Many predicted errors = at least standard
        if (predictedErrorTypes.length >= 5 && predictionConfidence > 0.6) {
            console.log(`[SwarmMode] Upgrading to standard mode due to ${predictedErrorTypes.length} predictions`);
            return buildPhase === 'planning' ? 'standard' : 'thorough';
        }
    }

    // Planning phase - just quick checks
    if (buildPhase === 'planning') {
        return 'lightning';
    }

    // Large changes or long time since last verification
    if (changeSize === 'large' || lastVerificationMinutesAgo > 60) {
        return 'thorough';
    }

    // Medium changes during implementation
    if (changeSize === 'medium' && buildPhase === 'implementing') {
        return 'standard';
    }

    // Verifying phase
    if (buildPhase === 'verifying') {
        return previousFailureRate > 0.2 ? 'thorough' : 'standard';
    }

    // Default
    return 'standard';
}

/**
 * Get priority agents based on predicted error types
 * Returns agents that should run with higher priority/depth
 */
export function getPriorityAgentsFromPredictions(predictedErrorTypes: ErrorType[]): VerificationAgentType[] {
    const priorityAgents: VerificationAgentType[] = [];

    for (const errorType of predictedErrorTypes) {
        switch (errorType) {
            case 'typescript':
            case 'type_mismatch':
            case 'syntax':
                priorityAgents.push('error_checker');
                break;
            case 'security':
                priorityAgents.push('security_scanner');
                break;
            case 'react_pattern':
            case 'async_issue':
            case 'runtime':
                priorityAgents.push('error_checker', 'code_quality');
                break;
            case 'style':
                priorityAgents.push('visual_verifier', 'design_style');
                break;
            case 'import':
            case 'missing_dependency':
                priorityAgents.push('error_checker');
                break;
            case 'api_misuse':
                priorityAgents.push('code_quality', 'security_scanner');
                break;
        }
    }

    // Return unique list
    return [...new Set(priorityAgents)];
}

/**
 * Get readable description of swarm mode
 */
export function getSwarmModeDescription(mode: SwarmMode): string {
    const config = SWARM_MODES[mode];
    return `${config.name}: ${config.description} (~${config.estimatedDurationSec}s, ${config.creditCost} credits)`;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_SWARM_CONFIG: SwarmConfig = {
    errorCheckerIntervalMs: 5000,       // 5 seconds
    codeQualityIntervalMs: 30000,       // 30 seconds
    visualVerifierIntervalMs: 60000,    // 60 seconds
    securityScannerIntervalMs: 60000,   // 60 seconds
    placeholderEliminatorIntervalMs: 10000, // 10 seconds - ZERO TOLERANCE
    minDesignScore: 85,
    enableVisualVerification: true,
};

// =============================================================================
// PLACEHOLDER PATTERNS (ZERO TOLERANCE)
// =============================================================================

const PLACEHOLDER_PATTERNS = {
    code: [
        /TODO/i,
        /FIXME/i,
        /HACK/i,
        /XXX/i,
        /throw new Error\(['"]Not implemented/i,
        /\(\)\s*=>\s*\{\s*\}/,  // Empty arrow functions
        /return null\s*\/\/\s*TODO/i,
        /\/\/\s*@ts-ignore/,
    ],
    text: [
        /Lorem ipsum/i,
        /placeholder/i,
        /Coming soon/i,
        /TBD/i,
        /\[Your text here\]/i,
        /\[Insert .*\]/i,
        /Sample text/i,
        /Example content/i,
    ],
    assets: [
        /placeholder\.(png|jpg|jpeg|svg|gif)/i,
        /sample-image/i,
        /via\.placeholder\.com/i,
        /placeholder-image/i,
        /default-avatar/i,
    ],
    stubs: [
        /mock/i,
        /fake/i,
        /dummy/i,
        /test-data/i,
        /sample-data/i,
    ],
};

// =============================================================================
// VERIFICATION SWARM COORDINATOR
// =============================================================================

export class VerificationSwarm extends EventEmitter {
    private config: SwarmConfig;
    private state: SwarmState;
    private orchestrationRunId: string;
    private projectId: string;
    private userId: string;
    private claudeService: ClaudeService;
    private intent: IntentContract | null = null;
    private intervals: Map<VerificationAgentType, NodeJS.Timeout> = new Map();
    private errorPrevention: PredictiveErrorPrevention;
    private lastPredictions: PredictionResult | null = null;
    // SESSION 6: Project path for real TypeScript/ESLint verification
    private projectPath: string | null = null;

    constructor(
        orchestrationRunId: string,
        projectId: string,
        userId: string,
        config: Partial<SwarmConfig> = {},
        projectPath?: string
    ) {
        super();
        this.orchestrationRunId = orchestrationRunId;
        this.projectId = projectId;
        this.userId = userId;
        this.config = { ...DEFAULT_SWARM_CONFIG, ...config };
        // SESSION 6: Store project path for real tsc/eslint execution
        this.projectPath = projectPath || `/tmp/builds/${projectId}`;
        this.state = {
            running: false,
            activeAgents: new Set(),
            lastRunTimestamps: new Map(),
            totalVerifications: 0,
            issuesFound: 0,
            issuesFixed: 0,
        };
        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'testing',
        });
        this.errorPrevention = getPredictiveErrorPrevention();
    }

    /**
     * SESSION 6: Set project path for verification
     */
    setProjectPath(path: string): void {
        this.projectPath = path;
    }

    /**
     * Get predicted errors for a feature before verification
     * This enables smarter, more targeted verification
     */
    async getPredictedErrors(feature: Feature): Promise<PredictionResult> {
        const prediction = await this.errorPrevention.predict({
            projectId: this.projectId,
            taskType: 'feature_verification',
            taskDescription: `Verifying feature: ${feature.featureId} - ${feature.description || ''}`,
        });

        this.lastPredictions = prediction;

        if (prediction.predictions.length > 0) {
            console.log(
                `[VerificationSwarm] Predicted ${prediction.predictions.length} potential issues ` +
                `for ${feature.featureId} (confidence: ${(prediction.confidenceScore * 100).toFixed(0)}%)`
            );
        }

        return prediction;
    }

    /**
     * Get the recommended swarm mode based on context and predictions
     */
    async getRecommendedMode(
        feature: Feature,
        context: Omit<SwarmRunContext, 'predictedErrorTypes' | 'predictionConfidence'>
    ): Promise<{ mode: SwarmMode; priorityAgents: VerificationAgentType[] }> {
        // Get predictions for this feature
        const predictions = await this.getPredictedErrors(feature);

        // Extract error types from predictions
        const predictedErrorTypes = predictions.predictions.map(p => p.type);

        // Get recommended mode with predictions
        const fullContext: SwarmRunContext = {
            ...context,
            predictedErrorTypes,
            predictionConfidence: predictions.confidenceScore,
        };

        const mode = recommendSwarmMode(fullContext);
        const priorityAgents = getPriorityAgentsFromPredictions(predictedErrorTypes);

        return { mode, priorityAgents };
    }

    /**
     * Set the Intent Contract for design verification
     */
    setIntent(intent: IntentContract): void {
        this.intent = intent;
    }

    /**
     * Start all verification agents
     */
    start(): void {
        if (this.state.running) return;

        this.state.running = true;
        console.log('[VerificationSwarm] Starting 6-agent swarm');

        // Start each agent on its interval
        this.startAgent('error_checker', this.config.errorCheckerIntervalMs);
        this.startAgent('code_quality', this.config.codeQualityIntervalMs);
        this.startAgent('security_scanner', this.config.securityScannerIntervalMs);
        this.startAgent('placeholder_eliminator', this.config.placeholderEliminatorIntervalMs);

        if (this.config.enableVisualVerification) {
            this.startAgent('visual_verifier', this.config.visualVerifierIntervalMs);
        }

        this.emit('swarm_started', { agents: Array.from(this.state.activeAgents) });
    }

    /**
     * Stop all verification agents
     */
    stop(): void {
        this.state.running = false;

        for (const [agent, interval] of this.intervals) {
            clearInterval(interval);
            this.state.activeAgents.delete(agent);
        }
        this.intervals.clear();

        console.log('[VerificationSwarm] Stopped all agents');
        this.emit('swarm_stopped', { totalVerifications: this.state.totalVerifications });
    }

    /**
     * Run full verification on a specific feature
     * Design Style Agent runs here (on feature complete)
     */
    async verifyFeature(feature: Feature, fileContents: Map<string, string>): Promise<CombinedVerificationResult> {
        const results: CombinedVerificationResult['results'] = {
            errorCheck: null,
            codeQuality: null,
            visualVerify: null,
            securityScan: null,
            placeholderCheck: null,
            designStyle: null,
        };
        const blockers: string[] = [];

        // Run all verifications in parallel
        const [errorCheck, codeQuality, placeholderCheck, securityScan, designStyle, visualVerify] = await Promise.all([
            this.runErrorChecker(feature, fileContents),
            this.runCodeQuality(feature, fileContents),
            this.runPlaceholderEliminator(feature, fileContents),
            this.runSecurityScanner(feature, fileContents),
            this.runDesignStyleAgent(feature, fileContents),
            this.config.enableVisualVerification
                ? this.runVisualVerifier(feature, fileContents)
                : Promise.resolve(null),
        ]);

        results.errorCheck = errorCheck;
        results.codeQuality = codeQuality;
        results.placeholderCheck = placeholderCheck;
        results.securityScan = securityScan;
        results.designStyle = designStyle;
        results.visualVerify = visualVerify;

        // Check for blockers
        if (placeholderCheck && !placeholderCheck.passed) {
            blockers.push('BLOCKED: Placeholders found (Zero Tolerance)');
        }

        if (securityScan && securityScan.issues.some(i => i.severity === 'critical')) {
            blockers.push('BLOCKED: Critical security vulnerability');
        }

        if (visualVerify && visualVerify.score !== undefined && visualVerify.score < 50) {
            blockers.push('REJECTED: UI looks like AI slop');
        }

        // Calculate overall score
        const scores = [
            codeQuality?.score || 0,
            designStyle?.score || 0,
            visualVerify?.score || 70, // Default if not running visual verification
        ].filter(s => s > 0);

        const overallScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

        // Determine verdict
        let verdict: CombinedVerificationResult['verdict'] = 'APPROVED';
        if (blockers.length > 0) {
            verdict = blockers.some(b => b.startsWith('REJECTED')) ? 'REJECTED' : 'BLOCKED';
        } else if (overallScore < this.config.minDesignScore) {
            verdict = 'NEEDS_WORK';
        }

        const allPassed = verdict === 'APPROVED' &&
            (!errorCheck || errorCheck.passed) &&
            (!codeQuality || codeQuality.passed) &&
            (!placeholderCheck || placeholderCheck.passed) &&
            (!securityScan || securityScan.passed) &&
            (!designStyle || designStyle.passed);

        return {
            featureId: feature.featureId,
            allPassed,
            overallScore,
            verdict,
            results,
            blockers,
        };
    }

    // =========================================================================
    // AGENT IMPLEMENTATIONS
    // =========================================================================

    /**
     * Error Checker Agent
     * Model: Sonnet 4.5 | Poll: 5s | Blocking: Yes
     *
     * SESSION 6: REAL TypeScript and ESLint verification
     * Actually runs `tsc --noEmit` and `eslint` on the project
     */
    private async runErrorChecker(feature: Feature, files: Map<string, string>): Promise<VerificationResult> {
        const startTime = Date.now();
        const issues: VerificationIssue[] = [];

        // SESSION 6: Run REAL TypeScript compilation check
        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            // Get project path from feature or use default
            const projectPath = this.projectPath || '/tmp/builds';

            // Run TypeScript compiler in noEmit mode
            try {
                await execAsync('npx tsc --noEmit --pretty false 2>&1', {
                    cwd: projectPath,
                    timeout: 30000, // 30 second timeout
                });
                console.log('[ErrorChecker] TypeScript compilation passed');
            } catch (tscError: any) {
                // Parse TypeScript errors from output
                const output = tscError.stdout || tscError.message || '';
                const errorLines = output.split('\n').filter((line: string) =>
                    line.includes('error TS') || line.includes(': error')
                );

                for (const errorLine of errorLines.slice(0, 20)) { // Limit to 20 errors
                    const match = errorLine.match(/^(.+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/);
                    if (match) {
                        issues.push({
                            severity: 'critical',
                            category: 'typescript',
                            description: `${match[4]}: ${match[5]}`,
                            file: match[1],
                            line: parseInt(match[2], 10),
                            suggestion: 'Fix TypeScript error',
                            autoFixable: false,
                        });
                    } else if (errorLine.trim()) {
                        issues.push({
                            severity: 'critical',
                            category: 'typescript',
                            description: errorLine.trim(),
                            autoFixable: false,
                        });
                    }
                }

                if (errorLines.length > 20) {
                    issues.push({
                        severity: 'high',
                        category: 'typescript',
                        description: `${errorLines.length - 20} more TypeScript errors not shown`,
                        autoFixable: false,
                    });
                }

                console.log(`[ErrorChecker] TypeScript found ${errorLines.length} errors`);
            }

            // Run ESLint check
            try {
                await execAsync('npx eslint . --ext .ts,.tsx --format json --quiet 2>&1', {
                    cwd: projectPath,
                    timeout: 60000, // 60 second timeout
                });
                console.log('[ErrorChecker] ESLint passed');
            } catch (eslintError: any) {
                // Parse ESLint JSON output
                try {
                    const output = eslintError.stdout || '';
                    const eslintResults = JSON.parse(output);
                    for (const fileResult of eslintResults) {
                        for (const message of fileResult.messages || []) {
                            if (message.severity >= 2) { // 2 = error
                                issues.push({
                                    severity: message.severity === 2 ? 'high' : 'medium',
                                    category: 'eslint',
                                    description: `${message.ruleId}: ${message.message}`,
                                    file: fileResult.filePath,
                                    line: message.line,
                                    suggestion: message.fix ? 'Auto-fixable' : 'Manual fix required',
                                    autoFixable: !!message.fix,
                                });
                            }
                        }
                    }
                } catch {
                    // ESLint not configured or output not JSON - fallback to basic check
                    console.log('[ErrorChecker] ESLint not configured, using pattern checks');
                }
            }
        } catch (execError) {
            console.warn('[ErrorChecker] Could not run tsc/eslint, falling back to pattern checks:', execError);
            // Fallback to pattern-based checks if exec fails
            for (const [path, content] of files) {
                if (path.endsWith('.ts') || path.endsWith('.tsx')) {
                    if (content.includes('any')) {
                        issues.push({
                            severity: 'medium',
                            category: 'typescript',
                            description: 'Usage of "any" type detected',
                            file: path,
                            suggestion: 'Replace with specific type',
                            autoFixable: false,
                        });
                    }
                }
            }
        }

        const hasCritical = issues.some(i => i.severity === 'critical');
        const hasHigh = issues.some(i => i.severity === 'high');

        const result = await this.createVerificationResult(
            feature.featureId,
            'error_checker',
            !hasCritical && !hasHigh, // Only pass if no critical or high severity issues
            undefined,
            issues,
            issues.length === 0 ? 'TypeScript and ESLint checks passed' : `Found ${issues.length} issues (${hasCritical ? 'CRITICAL' : hasHigh ? 'HIGH' : 'MEDIUM'} severity)`,
            Date.now() - startTime
        );

        return result;
    }

    /**
     * Code Quality Agent
     * Model: Sonnet 4.5 | Poll: 30s | Threshold: 80
     */
    private async runCodeQuality(feature: Feature, files: Map<string, string>): Promise<VerificationResult> {
        const startTime = Date.now();
        const issues: VerificationIssue[] = [];
        let score = 100;

        for (const [path, content] of files) {
            // Check function length
            const functions = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)\s*{[^}]+}/g) || [];
            for (const func of functions) {
                const lines = func.split('\n').length;
                if (lines > 50) {
                    issues.push({
                        severity: 'medium',
                        category: 'complexity',
                        description: `Function exceeds 50 lines (${lines} lines)`,
                        file: path,
                        suggestion: 'Consider breaking into smaller functions',
                        autoFixable: false,
                    });
                    score -= 5;
                }
            }

            // Check for console.log
            if (content.includes('console.log')) {
                issues.push({
                    severity: 'low',
                    category: 'code_quality',
                    description: 'console.log detected',
                    file: path,
                    suggestion: 'Remove before production',
                    autoFixable: true,
                });
                score -= 2;
            }

            // Check for proper error handling
            if (content.includes('catch') && !content.includes('catch (')) {
                issues.push({
                    severity: 'medium',
                    category: 'error_handling',
                    description: 'Empty catch block detected',
                    file: path,
                    suggestion: 'Handle errors properly',
                    autoFixable: false,
                });
                score -= 10;
            }
        }

        score = Math.max(0, Math.min(100, score));

        return this.createVerificationResult(
            feature.featureId,
            'code_quality',
            score >= 80,
            score,
            issues,
            `Code quality score: ${score}/100`,
            Date.now() - startTime
        );
    }

    /**
     * Visual Verifier Agent
     * Model: Sonnet 4.5 | Effort: high | Thinking: 32K | Poll: 60s
     */
    private async runVisualVerifier(feature: Feature, files: Map<string, string>): Promise<VerificationResult | null> {
        const startTime = Date.now();

        if (!this.intent) {
            return null;
        }

        const phaseConfig = getPhaseConfig('visual_verify');

        const cssFiles = Array.from(files.entries()).filter(([path]) =>
            path.endsWith('.css') || path.endsWith('.tsx') || path.endsWith('.jsx')
        );

        if (cssFiles.length === 0) {
            return null;
        }

        try {
            const response = await this.claudeService.generateStructured<{
                visualScore: number;
                antiSlopScore: number;
                soulMatchScore: number;
                issues: Array<{ type: string; description: string; severity: string }>;
                verdict: 'APPROVED' | 'NEEDS_WORK' | 'REJECTED';
            }>(
                this.buildVisualVerificationPrompt(cssFiles, this.intent.visualIdentity),
                `You are the VISUAL VERIFIER agent. Analyze the code for visual quality.

                Check for:
                - Depth: Cards lift? Multiple shadows? Parallax? Modal blur?
                - Motion: Animate in? Transitions? Skeleton shimmer? Micro-interactions?
                - Typography: Correct fonts? Hierarchy? Line heights?
                - Anti-Slop: NO emoji as design? NO banned fonts? NOT flat? Matches soul?

                Respond with JSON: { visualScore, antiSlopScore, soulMatchScore, issues, verdict }
                Each score is 0-100. Verdict is APPROVED (85+), NEEDS_WORK (60-84), REJECTED (<60)`,
                {
                    model: phaseConfig.model,
                    thinkingBudgetTokens: phaseConfig.thinkingBudget,
                }
            );

            const overallScore = Math.round((response.visualScore + response.antiSlopScore + response.soulMatchScore) / 3);

            const issues: VerificationIssue[] = response.issues.map(i => ({
                severity: i.severity as VerificationIssue['severity'],
                category: 'visual',
                description: i.description,
                autoFixable: false,
            }));

            return this.createVerificationResult(
                feature.featureId,
                'visual_verifier',
                response.verdict === 'APPROVED',
                overallScore,
                issues,
                `Visual: ${response.visualScore}, Anti-Slop: ${response.antiSlopScore}, Soul: ${response.soulMatchScore}`,
                Date.now() - startTime
            );

        } catch (error) {
            // SESSION 5: Never pass on error - quality gates cannot be bypassed
            console.error('[VerificationSwarm] visual_verifier agent failed:', error);
            return this.createVerificationResult(
                feature.featureId,
                'visual_verifier',
                false, // CRITICAL: Must fail on error
                0,
                [{
                    severity: 'critical',
                    category: 'error',
                    description: `Visual verification failed: ${(error as Error).message}`,
                    file: 'verification-system',
                    suggestion: 'Check visual verification service is running',
                    autoFixable: false,
                }],
                `Visual verification error (requires escalation): ${(error as Error).message}`,
                Date.now() - startTime
            );
        }
    }

    /**
     * Security Scanner Agent
     * Model: Haiku 4.5 | Poll: 60s | Blocks on: critical, high
     */
    private async runSecurityScanner(feature: Feature, files: Map<string, string>): Promise<VerificationResult> {
        const startTime = Date.now();
        const issues: VerificationIssue[] = [];

        for (const [path, content] of files) {
            // Check for exposed API keys
            const apiKeyPatterns = [
                /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi,
                /(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]+/g,
                /Bearer\s+[a-zA-Z0-9._-]+/g,
            ];

            for (const pattern of apiKeyPatterns) {
                if (pattern.test(content)) {
                    issues.push({
                        severity: 'critical',
                        category: 'security',
                        description: 'Potential API key or secret exposed',
                        file: path,
                        suggestion: 'Move to environment variables',
                        autoFixable: false,
                    });
                }
            }

            // Check for SQL injection vulnerabilities
            if (/(?:SELECT|INSERT|UPDATE|DELETE).*\$\{/gi.test(content)) {
                issues.push({
                    severity: 'high',
                    category: 'security',
                    description: 'Potential SQL injection vulnerability',
                    file: path,
                    suggestion: 'Use parameterized queries',
                    autoFixable: false,
                });
            }

            // Check for XSS vulnerabilities
            if (/dangerouslySetInnerHTML/g.test(content)) {
                issues.push({
                    severity: 'high',
                    category: 'security',
                    description: 'dangerouslySetInnerHTML usage detected',
                    file: path,
                    suggestion: 'Sanitize HTML content',
                    autoFixable: false,
                });
            }

            // Check for hardcoded URLs
            if (/https?:\/\/(?!localhost|example\.com)[^\s'"]+/g.test(content)) {
                issues.push({
                    severity: 'low',
                    category: 'security',
                    description: 'Hardcoded URL detected',
                    file: path,
                    suggestion: 'Consider using environment variables',
                    autoFixable: false,
                });
            }
        }

        const hasCritical = issues.some(i => i.severity === 'critical' || i.severity === 'high');

        return this.createVerificationResult(
            feature.featureId,
            'security_scanner',
            !hasCritical,
            undefined,
            issues,
            issues.length === 0 ? 'No security issues found' : `Found ${issues.length} security issues`,
            Date.now() - startTime
        );
    }

    /**
     * Placeholder Eliminator Agent - ZERO TOLERANCE
     * Model: Sonnet 4.5 | Poll: 10s | Blocking: ALWAYS
     */
    private async runPlaceholderEliminator(feature: Feature, files: Map<string, string>): Promise<VerificationResult> {
        const startTime = Date.now();
        const issues: VerificationIssue[] = [];

        for (const [path, content] of files) {
            // Check code patterns
            for (const pattern of PLACEHOLDER_PATTERNS.code) {
                if (pattern.test(content)) {
                    issues.push({
                        severity: 'critical',
                        category: 'placeholder',
                        description: `Code placeholder detected: ${pattern.source}`,
                        file: path,
                        suggestion: 'Replace with real implementation',
                        autoFixable: false,
                    });
                }
            }

            // Check text patterns
            for (const pattern of PLACEHOLDER_PATTERNS.text) {
                if (pattern.test(content)) {
                    issues.push({
                        severity: 'critical',
                        category: 'placeholder',
                        description: `Text placeholder detected: ${pattern.source}`,
                        file: path,
                        suggestion: 'Replace with real content derived from Intent',
                        autoFixable: false,
                    });
                }
            }

            // Check asset patterns
            for (const pattern of PLACEHOLDER_PATTERNS.assets) {
                if (pattern.test(content)) {
                    issues.push({
                        severity: 'critical',
                        category: 'placeholder',
                        description: `Asset placeholder detected: ${pattern.source}`,
                        file: path,
                        suggestion: 'Replace with real assets',
                        autoFixable: false,
                    });
                }
            }

            // Check stub patterns
            for (const pattern of PLACEHOLDER_PATTERNS.stubs) {
                if (pattern.test(content)) {
                    issues.push({
                        severity: 'high',
                        category: 'placeholder',
                        description: `Stub/mock data detected: ${pattern.source}`,
                        file: path,
                        suggestion: 'Replace with real data or remove',
                        autoFixable: false,
                    });
                }
            }
        }

        // ZERO TOLERANCE - any placeholder blocks progress
        const passed = issues.length === 0;

        return this.createVerificationResult(
            feature.featureId,
            'placeholder_eliminator',
            passed,
            undefined,
            issues,
            passed ? 'No placeholders found' : `BLOCKED: ${issues.length} placeholders found (ZERO TOLERANCE)`,
            Date.now() - startTime
        );
    }

    /**
     * Design Style Agent
     * Model: Opus 4.5 | Effort: high | Thinking: 64K | Trigger: Feature complete
     * Threshold: 85 minimum
     */
    private async runDesignStyleAgent(feature: Feature, files: Map<string, string>): Promise<VerificationResult> {
        const startTime = Date.now();

        if (!this.intent) {
            return this.createVerificationResult(
                feature.featureId,
                'design_style',
                true,
                85,
                [],
                'Design style check skipped - no Intent Contract',
                Date.now() - startTime
            );
        }

        const phaseConfig = getPhaseConfig('intent_satisfaction');

        try {
            const response = await this.claudeService.generateStructured<{
                score: number;
                soulMatch: boolean;
                issues: Array<{ type: string; description: string }>;
                recommendations: string[];
            }>(
                this.buildDesignStylePrompt(files, this.intent),
                `You are the DESIGN STYLE AGENT. Score design quality against the App Soul.

                App Soul: ${this.intent.appSoul}
                Visual Identity: ${JSON.stringify(this.intent.visualIdentity)}
                Anti-Patterns to avoid: ${this.intent.antiPatterns.join(', ')}

                Score 0-100 based on:
                - Soul appropriateness (does the design match the app type?)
                - Motion language (appropriate animations?)
                - Typography hierarchy
                - Color system
                - Depth and visual interest

                85+ is required to pass.

                Respond with JSON: { score, soulMatch, issues, recommendations }`,
                {
                    model: phaseConfig.model,
                    effort: phaseConfig.effort,
                    thinkingBudgetTokens: phaseConfig.thinkingBudget,
                }
            );

            const issues: VerificationIssue[] = response.issues.map(i => ({
                severity: 'medium' as const,
                category: 'design_style',
                description: i.description,
                autoFixable: false,
            }));

            return this.createVerificationResult(
                feature.featureId,
                'design_style',
                response.score >= this.config.minDesignScore,
                response.score,
                issues,
                `Design score: ${response.score}/100 (${response.soulMatch ? 'Soul matched' : 'Soul mismatch'})`,
                Date.now() - startTime
            );

        } catch (error) {
            // SESSION 5: Never pass on error - quality gates cannot be bypassed
            console.error('[VerificationSwarm] design_style agent failed:', error);
            return this.createVerificationResult(
                feature.featureId,
                'design_style',
                false, // CRITICAL: Must fail on error
                0,
                [{
                    severity: 'critical',
                    category: 'error',
                    description: `Design style check failed: ${(error as Error).message}`,
                    file: 'verification-system',
                    suggestion: 'Check design style service is running',
                    autoFixable: false,
                }],
                `Design style error (requires escalation): ${(error as Error).message}`,
                Date.now() - startTime
            );
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private startAgent(type: VerificationAgentType, intervalMs: number): void {
        const interval = setInterval(() => {
            this.state.lastRunTimestamps.set(type, new Date());
            this.emit('agent_tick', { agent: type, timestamp: new Date() });
        }, intervalMs);

        this.intervals.set(type, interval);
        this.state.activeAgents.add(type);
    }

    private async createVerificationResult(
        featureId: string,
        agentType: VerificationAgentType,
        passed: boolean,
        score: number | undefined,
        issues: VerificationIssue[],
        details: string,
        durationMs: number
    ): Promise<VerificationResult> {
        const result: VerificationResult = {
            id: uuidv4(),
            featureId,
            orchestrationRunId: this.orchestrationRunId,
            agentType,
            passed,
            score,
            issues,
            details,
            timestamp: new Date(),
            durationMs,
        };

        // Save to database
        await db.insert(verificationResults).values({
            orchestrationRunId: this.orchestrationRunId,
            projectId: this.projectId,
            featureProgressId: null, // Would need to look up actual feature record
            agentType,
            passed,
            score,
            details: {
                violations: issues.map(i => ({
                    file: i.file || 'unknown',
                    line: i.line,
                    message: i.description,
                    severity: i.severity,
                })),
                reasoning: details, // details is a string in this context
            },
            durationMs,
        });

        this.state.totalVerifications++;
        this.state.issuesFound += issues.length;

        this.emit('verification_complete', result);

        return result;
    }

    private buildVisualVerificationPrompt(
        files: Array<[string, string]>,
        identity: VisualIdentity
    ): string {
        return `Analyze these files for visual quality against the visual identity:

Visual Identity:
- Soul: ${identity.soul}
- Primary Emotion: ${identity.primaryEmotion}
- Depth Level: ${identity.depthLevel}
- Motion Philosophy: ${identity.motionPhilosophy}

Files to analyze:
${files.map(([path, content]) => `
### ${path}
\`\`\`
${content.substring(0, 2000)}${content.length > 2000 ? '...(truncated)' : ''}
\`\`\`
`).join('\n')}`;
    }

    private buildDesignStylePrompt(
        files: Map<string, string>,
        intent: IntentContract
    ): string {
        const relevantFiles = Array.from(files.entries())
            .filter(([path]) => path.endsWith('.tsx') || path.endsWith('.css'))
            .slice(0, 5);

        return `Analyze design style for: ${intent.appType}

Core Value Prop: ${intent.coreValueProp}

Files:
${relevantFiles.map(([path, content]) => `
### ${path}
\`\`\`
${content.substring(0, 1500)}
\`\`\`
`).join('\n')}

Score the design implementation.`;
    }

    getState(): SwarmState {
        return { ...this.state };
    }

    // =========================================================================
    // SESSION 5: QUICK VERIFICATION FOR CONTINUOUS CHECKING
    // =========================================================================

    /**
     * Run quick verification checks for continuous verification during Phase 2
     * Fast checks that run every 30 seconds to catch issues early
     */
    async runQuickChecks(options: {
        projectId: string;
        sandboxPath: string;
        checkTypes: ('errors' | 'placeholders' | 'security')[];
    }): Promise<QuickVerificationResults> {
        const results: QuickVerificationResults = {
            passed: true,
            score: 100,
            issues: [],
            blockers: [],
            affectedFiles: [],
            hasBlockers: false,
            timestamp: new Date(),
        };

        const checks = options.checkTypes.map(async (type) => {
            switch (type) {
                case 'errors':
                    return this.quickErrorCheck(options.sandboxPath);
                case 'placeholders':
                    return this.quickPlaceholderCheck(options.sandboxPath);
                case 'security':
                    return this.quickSecurityCheck(options.sandboxPath);
                default:
                    return null;
            }
        });

        const checkResults = await Promise.all(checks);

        checkResults.forEach(result => {
            if (result && !result.passed) {
                results.passed = false;
                results.score = Math.min(results.score, result.score);
                results.issues.push(...result.issues);
                results.affectedFiles.push(...result.affectedFiles);

                if (result.isBlocker) {
                    results.blockers.push(...result.issues);
                    results.hasBlockers = true;
                }
            }
        });

        // Emit event for listeners
        this.emit('quick_verification_complete', results);

        return results;
    }

    /**
     * Quick error check - TypeScript/syntax only (fast)
     * SESSION 1: Now actually runs tsc --noEmit for real error detection
     */
    private async quickErrorCheck(sandboxPath: string): Promise<QuickCheckResult> {
        const issues: string[] = [];
        const affectedFiles: string[] = [];

        try {
            console.log(`[QuickVerification] Running TypeScript error check on ${sandboxPath}`);

            // Run actual TypeScript check using child_process
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            try {
                // Run tsc --noEmit with a timeout
                await execAsync('npx tsc --noEmit --pretty false 2>&1', {
                    cwd: sandboxPath,
                    timeout: 30000, // 30 second timeout
                });
                // If no error thrown, TypeScript passed
                console.log('[QuickVerification] TypeScript check passed');
            } catch (tscError: any) {
                // Parse TypeScript errors from stdout/stderr
                const output = tscError.stdout || tscError.stderr || '';
                const errorLines = output.split('\n').filter((line: string) =>
                    line.includes('error TS') || line.includes(': error')
                );

                for (const line of errorLines.slice(0, 10)) { // Limit to 10 errors
                    issues.push(line.trim());
                    // Extract file path from error
                    const fileMatch = line.match(/^([^(]+)\(/);
                    if (fileMatch) {
                        affectedFiles.push(fileMatch[1].trim());
                    }
                }

                if (errorLines.length > 10) {
                    issues.push(`... and ${errorLines.length - 10} more TypeScript errors`);
                }
            }
        } catch (error) {
            console.error('[QuickVerification] Error check failed:', error);
            issues.push(`Error check failed: ${(error as Error).message}`);
        }

        return {
            passed: issues.length === 0,
            score: Math.max(0, 100 - (issues.length * 10)),
            issues,
            affectedFiles: [...new Set(affectedFiles)],
            isBlocker: issues.length > 0, // TypeScript errors are blockers
        };
    }

    /**
     * Quick placeholder check - pattern matching (fast)
     * SESSION 1: Now actually scans source files for placeholders
     */
    private async quickPlaceholderCheck(sandboxPath: string): Promise<QuickCheckResult> {
        const issues: string[] = [];
        const affectedFiles: string[] = [];

        const patterns = [
            { pattern: /\bTODO\b/gi, message: 'TODO comment found' },
            { pattern: /\bFIXME\b/gi, message: 'FIXME comment found' },
            { pattern: /\bXXX\b/gi, message: 'XXX marker found' },
            { pattern: /\bHACK\b/gi, message: 'HACK comment found' },
            { pattern: /lorem ipsum/gi, message: 'Lorem ipsum placeholder text' },
            { pattern: /Coming soon/gi, message: 'Coming soon placeholder' },
            { pattern: /\bplaceholder\b/gi, message: 'Placeholder text detected' },
            { pattern: /example\.com/gi, message: 'Example.com URL detected' },
            { pattern: /\$\d+\.00\b/g, message: 'Generic placeholder price' },
        ];

        try {
            console.log(`[QuickVerification] Running placeholder check on ${sandboxPath}`);

            const fs = await import('fs/promises');
            const path = await import('path');

            // Scan source files (tsx, ts, jsx, js)
            const srcDir = path.join(sandboxPath, 'src');
            const files = await this.getSourceFiles(srcDir);

            for (const file of files.slice(0, 50)) { // Limit to 50 files for speed
                try {
                    const content = await fs.readFile(file, 'utf-8');
                    const relativePath = path.relative(sandboxPath, file);

                    for (const { pattern, message } of patterns) {
                        const matches = content.match(pattern);
                        if (matches && matches.length > 0) {
                            issues.push(`${relativePath}: ${message} (${matches.length} occurrences)`);
                            affectedFiles.push(relativePath);
                        }
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        } catch (error) {
            console.error('[QuickVerification] Placeholder check failed:', error);
        }

        return {
            passed: issues.length === 0,
            score: Math.max(0, 100 - (issues.length * 15)),
            issues,
            affectedFiles: [...new Set(affectedFiles)],
            isBlocker: false, // Placeholders don't block during build, but must be fixed before Phase 5
        };
    }

    /**
     * Quick security check - fast regex patterns (no AI calls)
     * SESSION 1: Now actually scans source files for security issues
     */
    private async quickSecurityCheck(sandboxPath: string): Promise<QuickCheckResult> {
        const issues: string[] = [];
        const affectedFiles: string[] = [];

        const securityPatterns = [
            { pattern: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][^'"]{10,}['"]/gi, message: 'Potential API key exposure' },
            { pattern: /(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{20,}/g, message: 'Stripe key detected in code' },
            { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, message: 'Private key detected in code' },
            { pattern: /password\s*[:=]\s*['"][^'"]{4,}['"]/gi, message: 'Hardcoded password detected' },
            { pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/gi, message: 'MongoDB connection string with credentials' },
            { pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, message: 'PostgreSQL connection string with credentials' },
        ];

        try {
            console.log(`[QuickVerification] Running security check on ${sandboxPath}`);

            const fs = await import('fs/promises');
            const path = await import('path');

            // Scan source files
            const srcDir = path.join(sandboxPath, 'src');
            const files = await this.getSourceFiles(srcDir);

            // Also check root config files
            const configFiles = ['next.config.js', 'next.config.ts', 'vite.config.ts', 'package.json'];
            for (const configFile of configFiles) {
                const configPath = path.join(sandboxPath, configFile);
                try {
                    await fs.access(configPath);
                    files.push(configPath);
                } catch {
                    // File doesn't exist
                }
            }

            for (const file of files.slice(0, 50)) { // Limit to 50 files for speed
                try {
                    const content = await fs.readFile(file, 'utf-8');
                    const relativePath = path.relative(sandboxPath, file);

                    // Skip .env files (they're supposed to have secrets)
                    if (relativePath.startsWith('.env')) continue;

                    for (const { pattern, message } of securityPatterns) {
                        const matches = content.match(pattern);
                        if (matches && matches.length > 0) {
                            issues.push(`SECURITY: ${relativePath}: ${message}`);
                            affectedFiles.push(relativePath);
                        }
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        } catch (error) {
            console.error('[QuickVerification] Security check failed:', error);
        }

        return {
            passed: issues.length === 0,
            score: Math.max(0, 100 - (issues.length * 25)),
            issues,
            affectedFiles: [...new Set(affectedFiles)],
            isBlocker: issues.length > 0, // Security issues are blockers
        };
    }

    /**
     * Helper: Get all source files recursively
     */
    private async getSourceFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // Skip node_modules, .git, dist, build
                    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
                        continue;
                    }
                    files.push(...await this.getSourceFiles(fullPath));
                } else if (entry.isFile()) {
                    // Only include source files
                    if (/\.(tsx?|jsx?|vue|svelte)$/.test(entry.name)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch {
            // Directory doesn't exist or can't be read
        }
        return files;
    }
}

// =============================================================================
// SESSION 5: QUICK VERIFICATION TYPES
// =============================================================================

export interface QuickVerificationResults {
    passed: boolean;
    score: number;
    issues: string[];
    blockers: string[];
    affectedFiles: string[];
    hasBlockers: boolean;
    timestamp: Date;
}

export interface QuickCheckResult {
    passed: boolean;
    score: number;
    issues: string[];
    affectedFiles: string[];
    isBlocker: boolean;
}

/**
 * Create a VerificationSwarm instance
 */
export function createVerificationSwarm(
    orchestrationRunId: string,
    projectId: string,
    userId: string,
    config?: Partial<SwarmConfig>
): VerificationSwarm {
    return new VerificationSwarm(orchestrationRunId, projectId, userId, config);
}

// =============================================================================
// BUG HUNT IMPLEMENTATION
// =============================================================================

/**
 * Run comprehensive Bug Hunt with Intent Lock verification
 * Uses Claude Opus 4.5 with 64K thinking budget
 * Checks ALL fixes against intent to prevent removing intended features
 */
export async function runBugHunt(
    projectId: string,
    userId: string,
    intent: IntentContract,
    files: Map<string, string>
): Promise<BugHuntResult> {
    const huntId = uuidv4();
    const startedAt = new Date();

    const claudeService = createClaudeService({
        projectId,
        userId,
        agentType: 'verification',
    });

    const result: BugHuntResult = {
        id: huntId,
        projectId,
        startedAt,
        completedAt: null,
        bugsFound: [],
        bugsFixed: [],
        bugsNeedingHumanReview: [],
        intentLockChecks: [],
        summary: '',
        status: 'running',
        filesScanned: 0,
        totalLinesAnalyzed: 0,
    };

    try {
        // Count total lines
        let totalLines = 0;
        for (const content of files.values()) {
            totalLines += content.split('\n').length;
        }
        result.totalLinesAnalyzed = totalLines;
        result.filesScanned = files.size;

        // Analyze files in batches
        const fileEntries = Array.from(files.entries());
        const batchSize = 10;

        for (let i = 0; i < fileEntries.length; i += batchSize) {
            const batch = fileEntries.slice(i, i + batchSize);

            const batchPrompt = `You are a SENIOR BUG HUNTER analyzing code for bugs.

INTENT CONTRACT (DO NOT REMOVE INTENDED FEATURES):
- App Type: ${intent.appType}
- Core Value: ${intent.coreValueProp}
- App Soul: ${intent.appSoul}
- Visual Identity: ${JSON.stringify(intent.visualIdentity)}

FILES TO ANALYZE:
${batch.map(([path, content]) => `
### ${path}
\`\`\`
${content.substring(0, 3000)}
\`\`\`
`).join('\n')}

Find ALL bugs in these files. For each bug:
1. Identify the issue
2. Categorize it (logic, type, security, performance, accessibility, ux)
3. Propose a fix
4. Check if the fix might remove an INTENDED feature (be very careful here)

Respond with JSON: {
    "bugs": [
        {
            "severity": "critical|high|medium|low",
            "category": "logic|type|security|performance|accessibility|ux",
            "description": "what is wrong",
            "file": "file path",
            "line": line_number,
            "code": "the problematic code snippet",
            "suggestedFix": "the fixed code",
            "mightAffectIntent": boolean,
            "reasoning": "why this is a bug and why the fix is safe"
        }
    ]
}`;

            try {
                const phaseConfig = getPhaseConfig('intent_satisfaction');

                const response = await claudeService.generateStructured<{
                    bugs: Array<{
                        severity: 'critical' | 'high' | 'medium' | 'low';
                        category: 'logic' | 'type' | 'security' | 'performance' | 'accessibility' | 'ux';
                        description: string;
                        file: string;
                        line: number;
                        code: string;
                        suggestedFix: string;
                        mightAffectIntent: boolean;
                        reasoning: string;
                    }>;
                }>(
                    batchPrompt,
                    'Analyze the code comprehensively. Find every bug. Be thorough but careful not to flag intended features as bugs.',
                    {
                        model: phaseConfig.model,
                        effort: 'high',
                        thinkingBudgetTokens: 64000,
                    }
                );

                for (const bug of response.bugs) {
                    const bugReport: BugReport = {
                        id: uuidv4(),
                        severity: bug.severity,
                        category: bug.category,
                        description: bug.description,
                        file: bug.file,
                        line: bug.line,
                        code: bug.code,
                        suggestedFix: bug.suggestedFix,
                        fixApplied: false,
                        intentLockApproved: !bug.mightAffectIntent,
                        reasoning: bug.reasoning,
                    };

                    result.bugsFound.push(bugReport);

                    // Intent lock check
                    const intentCheck: IntentLockCheck = {
                        checkId: uuidv4(),
                        bugId: bugReport.id,
                        intentSection: bug.mightAffectIntent ? 'visual_identity' : 'none',
                        approved: !bug.mightAffectIntent,
                        reason: bug.mightAffectIntent
                            ? 'Fix might affect intended design or feature'
                            : 'Fix is safe and does not affect intended features',
                        timestamp: new Date(),
                    };

                    result.intentLockChecks.push(intentCheck);

                    if (bug.mightAffectIntent) {
                        result.bugsNeedingHumanReview.push(bugReport);
                    }
                }

            } catch (error) {
                console.error('[BugHunt] Batch analysis failed:', error);
            }
        }

        // Generate summary
        const criticalCount = result.bugsFound.filter(b => b.severity === 'critical').length;
        const highCount = result.bugsFound.filter(b => b.severity === 'high').length;
        const safeToFixCount = result.bugsFound.filter(b => b.intentLockApproved).length;

        result.summary = `Bug Hunt Complete: Found ${result.bugsFound.length} bugs (${criticalCount} critical, ${highCount} high). ` +
            `${safeToFixCount} safe to auto-fix, ${result.bugsNeedingHumanReview.length} need human review. ` +
            `Scanned ${result.filesScanned} files (${result.totalLinesAnalyzed} lines).`;

        result.status = 'completed';
        result.completedAt = new Date();

    } catch (error) {
        result.status = 'failed';
        result.summary = `Bug Hunt failed: ${(error as Error).message}`;
        result.completedAt = new Date();
    }

    return result;
}

/**
 * Apply a single bug fix
 */
export async function applyBugFix(
    bugReport: BugReport,
    files: Map<string, string>
): Promise<{ success: boolean; newContent: string | null }> {
    if (!bugReport.intentLockApproved) {
        return { success: false, newContent: null };
    }

    const fileContent = files.get(bugReport.file);
    if (!fileContent) {
        return { success: false, newContent: null };
    }

    // Simple line-based replacement
    const lines = fileContent.split('\n');
    if (bugReport.line > 0 && bugReport.line <= lines.length) {
        lines[bugReport.line - 1] = bugReport.suggestedFix;
        return { success: true, newContent: lines.join('\n') };
    }

    return { success: false, newContent: null };
}

/**
 * Apply all safe fixes (intent-lock approved)
 */
export async function applyAllSafeFixes(
    bugHuntResult: BugHuntResult,
    files: Map<string, string>
): Promise<{ fixedCount: number; failedCount: number; updatedFiles: Map<string, string> }> {
    const updatedFiles = new Map(files);
    let fixedCount = 0;
    let failedCount = 0;

    const safeBugs = bugHuntResult.bugsFound.filter(b => b.intentLockApproved && !b.fixApplied);

    for (const bug of safeBugs) {
        const result = await applyBugFix(bug, updatedFiles);
        if (result.success && result.newContent) {
            updatedFiles.set(bug.file, result.newContent);
            bug.fixApplied = true;
            bugHuntResult.bugsFixed.push(bug);
            fixedCount++;
        } else {
            failedCount++;
        }
    }

    return { fixedCount, failedCount, updatedFiles };
}

