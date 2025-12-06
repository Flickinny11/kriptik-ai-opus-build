/**
 * Autonomous Learning Engine Types
 *
 * Core type definitions for the learning engine:
 * - Experience Capture (Layer 1)
 * - AI Judgment / RLAIF (Layer 2)
 * - Shadow Models (Layer 3)
 * - Meta-Learning (Layer 4)
 */

// =============================================================================
// COMMON TYPES
// =============================================================================

export type ISO8601 = string;

export type BuildPhase =
    | 'planning'
    | 'architecture'
    | 'components'
    | 'integration'
    | 'styling'
    | 'testing'
    | 'deployment'
    | 'verification'
    | 'fix';

export type DecisionType =
    | 'architecture_choice'
    | 'component_structure'
    | 'api_design'
    | 'styling_approach'
    | 'error_recovery'
    | 'design_choice'
    | 'motion_implementation'
    | 'placeholder_resolution'
    | 'model_selection'
    | 'deployment_strategy';

export type ErrorType =
    | 'typescript'
    | 'runtime'
    | 'build'
    | 'lint'
    | 'test'
    | 'visual'
    | 'integration'
    | 'deployment';

export type OutcomeResult = 'success' | 'failure' | 'partial';

export type PatternCategory =
    | 'react'
    | 'css'
    | 'api'
    | 'state'
    | 'animation'
    | 'auth'
    | 'database'
    | 'deployment'
    | 'error_fix'
    | 'design'
    | 'architecture';

export type JudgmentDomain = 'code' | 'design' | 'architecture' | 'error_fix';

// =============================================================================
// LAYER 1: EXPERIENCE CAPTURE
// =============================================================================

export interface VerificationScores {
    overall: number;
    typescript: number;
    lint: number;
    test: number;
    visual: number | null;
    antiSlop: number | null;
}

export interface BuildRecord {
    buildId: string;
    projectId: string;
    userId: string;
    prompt: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt: ISO8601 | null;
    completedAt: ISO8601 | null;
    totalTokensUsed: number;
    totalCost: number;
    totalDurationMs: number;
    finalVerificationScores: VerificationScores | null;
    userFeedback: {
        rating: number;
        comment: string | null;
        reportedIssues: string[];
    } | null;
    decisionTraceIds: string[];
    artifactTraceIds: string[];
    designChoiceIds: string[];
    errorRecoveryIds: string[];
    patternsExtracted: string[];
    strategiesUsed: string[];
    successPredictionId: string | null;
    createdAt: ISO8601;
}

export interface DecisionTrace {
    traceId: string;
    buildId: string;
    userId: string;
    projectId: string;
    timestamp: ISO8601;
    phase: BuildPhase;
    decisionType: DecisionType;
    context: {
        intentSnippet: string;
        currentCodeState: string;
        errorIfAny: string | null;
        previousAttempts: number;
        thinkingTrace: string | null;
        agentType: string;
        modelUsed: string;
    };
    decision: {
        chosenOption: string;
        rejectedOptions: string[];
        reasoning: string;
        confidence: number;
    };
    outcome: {
        immediateResult: OutcomeResult;
        verificationScores: VerificationScores | null;
        requiredFixes: number;
        finalInProduction: boolean;
        userSatisfaction: number | null;
    } | null;
    outcomeRecordedAt: ISO8601 | null;
}

export interface CodeArtifactVersion {
    version: number;
    code: string;
    timestamp: ISO8601;
    trigger: 'initial' | 'fix' | 'refactor' | 'verification_feedback';
    changedByAgent: string;
    modelUsed: string;
}

export interface QualityTrajectoryPoint {
    timestamp: ISO8601;
    errorCount: number;
    codeQualityScore: number;
    visualQualityScore: number | null;
    antiSlopScore: number | null;
}

export interface PatternUsage {
    patternName: string;
    patternCategory: PatternCategory;
    firstAttemptSuccess: boolean;
    iterationsToSuccess: number;
}

export interface CodeArtifactTrace {
    artifactId: string;
    buildId: string;
    projectId: string;
    userId: string;
    filePath: string;
    versions: CodeArtifactVersion[];
    qualityTrajectory: QualityTrajectoryPoint[];
    patternsUsed: PatternUsage[];
    createdAt: ISO8601;
    updatedAt: ISO8601;
}

export interface ColorPalette {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    destructive: string;
}

export interface AnimationSpec {
    name: string;
    type: 'entrance' | 'exit' | 'hover' | 'scroll' | 'micro';
    duration: string;
    easing: string;
    properties: string[];
}

export interface DesignChoiceTrace {
    choiceId: string;
    buildId: string;
    projectId: string;
    userId: string;
    appSoul: string;
    typography: {
        fontsChosen: string[];
        fontsRejected: string[];
        reasoning: string;
        antiSlopCompliant: boolean;
    };
    colorSystem: {
        paletteChosen: ColorPalette;
        alternativesConsidered: ColorPalette[];
        soulAppropriatenessScore: number;
    };
    motionLanguage: {
        animationsUsed: AnimationSpec[];
        timingFunctions: string[];
        matchesSoul: boolean;
    };
    layoutDecisions: {
        gridSystem: string;
        spacingRationale: string;
        asymmetryUsed: boolean;
    };
    visualVerifierScores: {
        depthScore: number;
        motionScore: number;
        typographyScore: number;
        soulMatchScore: number;
        overall: number;
    } | null;
    createdAt: ISO8601;
    updatedAt: ISO8601;
}

export interface RecoveryAttempt {
    attempt: number;
    level: 1 | 2 | 3 | 4;
    modelUsed: string;
    thinkingTrace: string;
    fixApplied: string;
    result: 'fixed' | 'partial' | 'failed' | 'new_error';
    timeTakenMs: number;
}

export interface SuccessfulFix {
    levelRequired: number;
    fixDescription: string;
    codeDiff: string;
    generalizablePattern: string | null;
}

export interface ErrorRecoveryTrace {
    errorId: string;
    buildId: string;
    projectId: string;
    userId: string;
    error: {
        type: ErrorType;
        message: string;
        stackTrace: string;
        fileLocation: string;
        firstOccurrence: ISO8601;
    };
    recoveryJourney: RecoveryAttempt[];
    successfulFix: SuccessfulFix | null;
    totalTimeTakenMs: number;
    wasEscalated: boolean;
    createdAt: ISO8601;
    resolvedAt: ISO8601 | null;
}

// =============================================================================
// LAYER 2: AI JUDGMENT (RLAIF)
// =============================================================================

export interface CodeQualityJudgment {
    judgmentId: string;
    artifactId: string;
    timestamp: ISO8601;
    overallScore: number;
    readabilityScore: number;
    maintainabilityScore: number;
    efficiencyScore: number;
    securityScore: number;
    testabilityScore: number;
    issues: {
        severity: 'critical' | 'major' | 'minor' | 'suggestion';
        type: 'bug' | 'style' | 'security' | 'performance' | 'maintainability';
        description: string;
        line: number | null;
        suggestion: string;
    }[];
    improvementSuggestions: string[];
    modelUsed: string;
    tokensUsed: number;
}

export interface DesignQualityJudgment {
    judgmentId: string;
    choiceId: string;
    timestamp: ISO8601;
    depthScore: number;
    motionScore: number;
    typographyScore: number;
    soulMatchScore: number;
    overallScore: number;
    bannedFontsUsed: string[];
    emojiCrimesDetected: boolean;
    verdict: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'AI-SLOP';
    reasoning: string;
    modelUsed: string;
    tokensUsed: number;
}

export interface PreferencePair {
    pairId: string;
    prompt: string;
    chosen: string;
    rejected: string;
    judgmentReasoning: string;
    margin: number; // 0-100 scale
    domain: JudgmentDomain;
    createdAt: ISO8601;
    sourceTraceId?: string;
    sourceType?: 'decision' | 'error_recovery';
    usedInTrainingBatch?: string;
}

export interface SuccessPrediction {
    predictionId: string;
    buildId: string;
    features: {
        promptComplexity: number;
        patternsAvailable: number;
        userHistoryScore: number;
        similarBuildSuccessRate: number;
    };
    successProbability: number;
    riskFactors: string[];
    recommendedInterventions: string[];
    actualOutcome: 'success' | 'failure' | null;
    predictionWasCorrect: boolean | null;
    createdAt: ISO8601;
    verifiedAt: ISO8601 | null;
}

// =============================================================================
// LAYER 3: SHADOW MODELS
// =============================================================================

export interface ShadowModelSpec {
    modelId: string;
    baseModel: string; // e.g., 'Qwen/Qwen2.5-32B-Instruct'
    specialization: 'code' | 'architecture' | 'reasoning' | 'design';
    adapterPath: string | null;
    currentVersion: string;
    isActive: boolean;
    promotedDomains: string[];
}

export interface ModelVersion {
    versionId: string;
    modelId: string;
    version: string;
    evalScore: number;
    codeQualityAvg: number;
    designQualityAvg: number;
    errorFixRate: number;
    firstAttemptSuccess: number;
    antiSlopScore: number;
    trainingDataSize: number;
    trainingDurationMs: number;
    adapterPath: string | null;
    isActive: boolean;
    promotedDomains: string[];
    createdAt: ISO8601;
}

export interface TrainingBatch {
    batchId: string;
    modelId: string;
    status: 'pending' | 'training' | 'completed' | 'failed';
    preferencePairCount: number;
    domains: JudgmentDomain[];
    startedAt: ISO8601 | null;
    completedAt: ISO8601 | null;
    resultVersionId: string | null;
    error: string | null;
    gpuType: string | null;
    computeProvider: string | null;
    computeCost: number | null;
    createdAt: ISO8601;
}

// =============================================================================
// LAYER 4: META-LEARNING
// =============================================================================

export interface Pattern {
    patternId: string;
    name: string;
    category: PatternCategory;
    problem: string;
    problemEmbedding: number[];
    solutionTemplate: string;
    codeTemplate: string | null;
    conditions: string[];
    antiConditions: string[];
    timesUsed: number;
    successRate: number; // 0-100
    avgQualityScore: number;
    extractedFromBuildId: string;
    createdAt: ISO8601;
    updatedAt: ISO8601;
}

export interface Strategy {
    strategyId: string;
    domain: string;
    name: string;
    description: string;
    successRate: number;
    avgAttempts: number;
    avgTimeMs: number;
    contextsWhereEffective: string[];
    derivedFrom: string | null;
    isExperimental: boolean;
    totalUses: number;
    createdAt: ISO8601;
    updatedAt: ISO8601;
}

export interface LearningInsight {
    insightId: string;
    category: 'improving' | 'stuck' | 'overfitting' | 'new_capability';
    insight: string;
    evidence: string;
    recommendedAction: string;
    expectedImpact: string;
    confidence: number;
    status: 'pending' | 'actioned' | 'dismissed';
    actionedAt: ISO8601 | null;
    createdAt: ISO8601;
}

// =============================================================================
// FLYWHEEL METRICS
// =============================================================================

export interface FlywheelMetrics {
    experienceCapture: {
        totalBuilds: number;
        successfulBuilds: number;
        failedBuilds: number;
        decisionTraces: number;
        errorRecoveries: number;
        avgBuildDurationMs: number;
    };
    judgment: {
        totalJudgments: number;
        avgCodeQualityScore: number;
        avgDesignQualityScore: number;
        preferencePairsGenerated: number;
        pairsPerDomain: Record<string, number>;
    };
    patterns: {
        totalPatterns: number;
        avgSuccessRate: number;
        mostUsedPatterns: Array<{ name: string; uses: number }>;
        patternsByCategory: Record<string, number>;
    };
    shadowModels: {
        activeModels: number;
        lastTrainingBatch: ISO8601 | null;
        avgEvalScore: number;
        promotedDomains: string[];
    };
    meta: {
        learningInsights: number;
        pendingInsights: number;
        systemImprovement: number; // % improvement over baseline
        lastUpdated: ISO8601;
    };
}

// =============================================================================
// EVENT TYPES FOR HOOKS
// =============================================================================

export type LearningEvent =
    | { type: 'build_started'; buildId: string; projectId: string; userId: string; prompt: string }
    | { type: 'build_completed'; buildId: string; status: 'completed' | 'failed'; scores?: VerificationScores }
    | { type: 'decision_made'; buildId: string; trace: Omit<DecisionTrace, 'traceId' | 'timestamp' | 'outcome' | 'outcomeRecordedAt'> }
    | { type: 'decision_outcome'; traceId: string; outcome: DecisionTrace['outcome'] }
    | { type: 'artifact_created'; buildId: string; filePath: string; code: string; agent: string; model: string }
    | { type: 'artifact_updated'; artifactId: string; code: string; trigger: CodeArtifactVersion['trigger']; agent: string; model: string }
    | { type: 'error_detected'; buildId: string; error: ErrorRecoveryTrace['error'] }
    | { type: 'error_fix_attempted'; errorId: string; attempt: Omit<RecoveryAttempt, 'attempt'> }
    | { type: 'error_resolved'; errorId: string; fix: SuccessfulFix }
    | { type: 'design_choices_made'; buildId: string; choices: Omit<DesignChoiceTrace, 'choiceId' | 'createdAt' | 'updatedAt' | 'visualVerifierScores'> };

export interface LearningEventHandler {
    handleEvent(event: LearningEvent): Promise<void>;
}
