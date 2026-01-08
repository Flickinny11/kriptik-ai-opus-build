/**
 * Autonomous Learning Engine - Type Definitions
 *
 * Core types for the self-improving AI system that captures experiences,
 * generates judgments, and evolves strategies.
 */

// =============================================================================
// BUILD PHASES
// =============================================================================

export type BuildPhase =
    | 'intent_lock'
    | 'initialization'
    | 'build'
    | 'integration'
    | 'verification'
    | 'demo';

// =============================================================================
// DECISION TYPES
// =============================================================================

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
    | 'strategy_selection'
    | 'lattice_cell_build';

// =============================================================================
// DECISION TRACE
// =============================================================================

export interface DecisionContext {
    intentSnippet?: string;
    currentCodeState?: string;
    errorIfAny?: string | null;
    previousAttempts: number;
    thinkingTrace?: string;
    relatedFiles?: string[];
    buildPhase?: BuildPhase;
}

export interface DecisionMade {
    chosenOption: string;
    rejectedOptions: string[];
    reasoning: string;
    confidence: number; // 0-1
}

export interface DecisionOutcome {
    immediateResult: 'success' | 'failure' | 'partial';
    verificationScores?: Record<string, number>;
    requiredFixes: number;
    finalInProduction: boolean;
    userSatisfaction?: number | null;
}

export interface DecisionTrace {
    traceId: string;
    buildId?: string;
    projectId?: string;
    userId: string;
    phase: BuildPhase;
    decisionType: DecisionType;
    context: DecisionContext;
    decision: DecisionMade;
    outcome?: DecisionOutcome;
    createdAt: Date;
    outcomeRecordedAt?: Date;
}

// =============================================================================
// CODE ARTIFACT TRACE
// =============================================================================

export interface CodeVersion {
    version: number;
    code: string;
    timestamp: string;
    trigger: 'initial' | 'fix' | 'refactor' | 'verification_feedback';
    changedByAgent?: string;
}

export interface QualityDataPoint {
    timestamp: string;
    errorCount: number;
    codeQualityScore: number;
    visualQualityScore?: number | null;
    antiSlopScore?: number | null;
}

export interface PatternUsage {
    patternName: string;
    patternCategory: 'react' | 'css' | 'api' | 'state' | 'animation';
    firstAttemptSuccess: boolean;
    iterationsToSuccess: number;
}

export interface CodeArtifactTrace {
    artifactId: string;
    buildId?: string;
    projectId?: string;
    userId: string;
    filePath: string;
    versions: CodeVersion[];
    qualityTrajectory: QualityDataPoint[];
    patternsUsed: PatternUsage[];
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// DESIGN CHOICE TRACE
// =============================================================================

export interface TypographyChoice {
    fontsChosen: string[];
    fontsRejected: string[];
    reasoning: string;
    antiSlopCompliant: boolean;
}

export interface ColorSystemChoice {
    paletteChosen: Record<string, string>;
    alternativesConsidered: Array<Record<string, string>>;
    soulAppropriatenessScore: number;
}

export interface AnimationSpec {
    name: string;
    timing: string;
    easing: string;
}

export interface MotionLanguageChoice {
    animationsUsed: AnimationSpec[];
    timingFunctions: string[];
    matchesSoul: boolean;
}

export interface LayoutChoice {
    gridSystem: string;
    spacingRationale: string;
    asymmetryUsed: boolean;
}

export interface VisualVerifierScores {
    depthScore: number;
    motionScore: number;
    typographyScore: number;
    soulMatchScore: number;
    overall: number;
}

export interface DesignChoiceTrace {
    choiceId: string;
    buildId?: string;
    projectId?: string;
    userId: string;
    appSoul?: string;
    typography?: TypographyChoice;
    colorSystem?: ColorSystemChoice;
    motionLanguage?: MotionLanguageChoice;
    layoutDecisions?: LayoutChoice;
    visualScores?: VisualVerifierScores;
    createdAt: Date;
}

// =============================================================================
// ERROR RECOVERY TRACE
// =============================================================================

export interface ErrorInfo {
    type: string;
    message: string;
    stackTrace: string;
    fileLocation: string;
    firstOccurrence: string;
}

export interface RecoveryAttempt {
    attempt: number;
    level: 1 | 2 | 3 | 4;
    modelUsed: string;
    thinkingTrace?: string;
    fixApplied: string;
    result: 'fixed' | 'partial' | 'failed' | 'new_error';
    timeTakenMs: number;
}

export interface SuccessfulFix {
    levelRequired: number;
    fixDescription: string;
    codeDiff: string;
    generalizablePattern?: string | null;
}

export interface ErrorRecoveryTrace {
    errorId: string;
    buildId?: string;
    projectId?: string;
    userId: string;
    error: ErrorInfo;
    recoveryJourney: RecoveryAttempt[];
    successfulFix?: SuccessfulFix | null;
    createdAt: Date;
    resolvedAt?: Date;
}

// =============================================================================
// AI JUDGMENT
// =============================================================================

export type JudgeType =
    | 'code_quality'
    | 'design_quality'
    | 'success_predictor'
    | 'anti_slop';

export interface JudgmentScores {
    overall: number;
    categories: Record<string, number>;
}

export interface JudgmentIssue {
    category: string;
    severity: 'critical' | 'major' | 'minor';
    description: string;
    location?: string;
    suggestion?: string;
}

export interface Judgment {
    judgmentId: string;
    traceId?: string;
    artifactId?: string;
    choiceId?: string;
    errorId?: string;
    buildId?: string;
    projectId?: string;
    userId: string;
    judgeType: JudgeType;
    modelUsed: string;
    thinkingTrace?: string;
    scores: JudgmentScores;
    issues: JudgmentIssue[];
    recommendations: string[];
    createdAt: Date;
}

// =============================================================================
// PREFERENCE PAIR
// =============================================================================

export type PreferenceDomain = 'code' | 'design' | 'architecture' | 'error_fix';

export interface PreferencePair {
    pairId: string;
    domain: PreferenceDomain;
    prompt: string;
    chosen: string;
    rejected: string;
    judgmentReasoning: string;
    margin: number; // 0-100
    sourceTraceId?: string;
    sourceJudgmentId?: string;
    usedInTraining: boolean;
    trainingRunId?: string;
    createdAt: Date;
}

// =============================================================================
// SHADOW MODEL
// =============================================================================

export type ShadowModelStatus = 'training' | 'ready' | 'promoted' | 'deprecated';

export interface ShadowModelMetrics {
    codeQuality?: number;
    designQuality?: number;
    errorFixRate?: number;
    firstAttemptSuccess?: number;
    antiSlopScore?: number;
}

export interface ShadowModel {
    modelName: string;
    baseModel: string;
    adapterName: string;
    version: string;
    evalScore?: number;
    metrics?: ShadowModelMetrics;
    trainingDataCount?: number;
    trainingDate?: string;
    status: ShadowModelStatus;
    adapterPath?: string;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// TRAINING RUN
// =============================================================================

export type TrainingRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TrainingConfig {
    framework: 'llama-factory' | 'unsloth';
    method: 'qlora' | 'lora' | 'full';
    loraRank: number;
    loraAlpha: number;
    learningRate: number;
    batchSize: number;
    epochs: number;
    datasetPath: string;
}

export interface TrainingMetrics {
    trainLoss?: number;
    evalLoss?: number;
    evalAccuracy?: number;
    epochMetrics?: Array<{ epoch: number; loss: number }>;
}

export interface TrainingRun {
    runId: string;
    modelName: string;
    modelVersion?: string;
    config: TrainingConfig;
    computeProvider?: string;
    gpuType?: string;
    status: TrainingRunStatus;
    metrics?: TrainingMetrics;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    createdAt: Date;
}

// =============================================================================
// LEARNED STRATEGY
// =============================================================================

export type StrategyDomain = 'code_generation' | 'error_recovery' | 'design_approach';

export interface LearnedStrategy {
    strategyId: string;
    domain: StrategyDomain;
    name: string;
    description: string;
    successRate: number; // 0-100
    confidence: number; // 0-100
    usageCount: number;
    contextsEffective: string[];
    contextsIneffective: string[];
    derivedFrom?: string;
    isExperimental: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// LEARNED PATTERN (Voyager-inspired)
// =============================================================================

export type PatternCategory = 'code' | 'design' | 'architecture' | 'error_fix';

export interface LearnedPattern {
    patternId: string;
    category: PatternCategory;
    name: string;
    problem: string;
    solutionTemplate: string;
    conditions: string[];
    antiConditions: string[];
    codeTemplate?: string;
    embedding?: string; // base64 or JSON array
    usageCount: number;
    successRate: number; // 0-100
    sourceTraceId?: string;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// LEARNING INSIGHT
// =============================================================================

export type InsightCategory =
    | 'model_performance'
    | 'data_quality'
    | 'strategy_effectiveness'
    | 'pattern_usage';

export interface LearningInsight {
    insightId: string;
    category: InsightCategory;
    observation: string;
    evidence: string;
    action?: string;
    expectedImpact?: string;
    implemented: boolean;
    implementedAt?: Date;
    createdAt: Date;
}

// =============================================================================
// EVOLUTION CYCLE
// =============================================================================

export interface CycleMetrics {
    totalTraces: number;
    totalPairs: number;
    totalPatterns: number;
    avgSuccessRate: number;
    avgDesignScore: number;
}

export interface EvolutionCycle {
    cycleId: string;
    cycleNumber: number;
    startMetrics: CycleMetrics;
    endMetrics?: CycleMetrics;
    tracesCaptured: number;
    judgmentsRun: number;
    pairsGenerated: number;
    patternsExtracted: number;
    strategiesEvolved: number;
    modelsPromoted: number;
    improvementPercent?: number;
    startedAt: Date;
    completedAt?: Date;
    createdAt: Date;
}

// =============================================================================
// SERVICE INTERFACES
// =============================================================================

export interface ExperienceCaptureConfig {
    enableDecisionCapture: boolean;
    enableCodeCapture: boolean;
    enableDesignCapture: boolean;
    enableErrorCapture: boolean;
    captureThinkingTrace: boolean;
    maxCodeVersions: number;
}

export interface JudgmentConfig {
    enableCodeQualityJudge: boolean;
    enableDesignQualityJudge: boolean;
    enableSuccessPredictor: boolean;
    enableAntiSlopJudge: boolean;
    judgmentModel: string;
    thinkingBudget: number;
}

export interface EvolutionConfig {
    preferenceThreshold: number; // Train when N new pairs
    evaluationInterval: 'daily' | 'weekly' | 'monthly';
    patternUpdateInterval: 'hourly' | 'daily' | 'weekly';
    minJudgmentConfidence: number; // 0-1
    promotionImprovementThreshold: number; // 0-1
    regressionTolerance: number; // 0-1
}

// =============================================================================
// COMPONENT 28 ENHANCEMENT - NEW TYPES
// =============================================================================

// Direct RLAIF Types
export type DirectRLAIFEvaluationType = 'code' | 'design' | 'error_fix' | 'architecture';

export interface DirectRewardResult {
    evalId: string;
    rewardScore: number; // 0-100
    categoryScores: Record<string, number>;
    reasoning: string;
    labelerModel: string;
    processingTimeMs: number;
}

export interface DirectRLAIFConfig {
    labelerModel: string;
    enableCache: boolean;
    cacheTTLMs: number;
    maxConcurrentEvals: number;
}

// Multi-Judge Types
export interface JudgeConfig {
    model: string;
    weight: number;
    timeout?: number;
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

// Reflexion Types
export interface ReflexionNote {
    reflexionId: string;
    buildId?: string;
    agentId?: string;
    phase: string;

    // What happened
    failureDescription: string;
    errorType?: string;
    errorMessage?: string;
    attemptsMade: number;

    // Analysis
    rootCauseAnalysis: string;
    whatWentWrong?: string;
    whatShouldHaveDone?: string;

    // Learning
    lessonLearned: string;
    suggestedApproach: string;
    codePatternToAvoid?: string;
    codePatternToUse?: string;

    // Tracking
    appliedInBuild?: string;
    effectiveness?: number;
    timesRetrieved: number;
    timesApplied: number;

    createdAt: Date;
}

export interface ReflexionConfig {
    autoGenerateOnEscalation: boolean;
    minEscalationLevel: number;
    maxReflexionsPerBuild: number;
    retrievalLimit: number;
}

// Real-Time Learning Types
export type LearningEventType =
    | 'decision_made'
    | 'code_generated'
    | 'error_occurred'
    | 'error_fixed'
    | 'verification_passed'
    | 'verification_failed'
    | 'user_feedback'
    | 'phase_completed';

export interface LearningEvent {
    eventId: string;
    buildId: string;
    userId: string;
    eventType: LearningEventType;
    eventData: Record<string, unknown>;
    timestamp: Date;
}

export interface LearningApplication {
    patterns: LearnedPattern[];
    strategies: LearnedStrategy[];
    reflexions: ReflexionNote[];
    warnings: string[];
}

export interface RealTimeLearningConfig {
    enableQuickLearn: boolean;
    quickLearnMaxMs: number;
    enableBackgroundProcessing: boolean;
    batchSize: number;
}

// Cross-Build Transfer Types
export type KnowledgeType = 'pattern' | 'strategy' | 'reflexion' | 'preference';

export interface TransferableKnowledge {
    knowledgeId: string;
    knowledgeType: KnowledgeType;
    content: unknown;
    transferabilityScore: number;
    factors: {
        universality: number;
        successRate: number;
        contextSimilarity: number;
        recency: number;
        uniqueness: number;
    };
}

export interface KnowledgeLink {
    linkId: string;
    sourceBuildId: string;
    targetBuildId?: string;
    knowledgeType: KnowledgeType;
    knowledgeId: string;
    relevanceScore: number;
    usedAt?: Date;
    effectivenessScore?: number;
    createdAt: Date;
}

export interface BuildSimilarity {
    buildIdA: string;
    buildIdB: string;
    overallSimilarity: number;
    soulSimilarity: number;
    featureSimilarity: number;
    techStackSimilarity: number;
}

export interface CrossBuildConfig {
    enableTransfer: boolean;
    minTransferabilityScore: number;
    maxKnowledgePerBuild: number;
    similarityThreshold: number;
}

// Vision RLAIF Types
export interface VisualPair {
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
    improvement: number;

    judgmentReasoning?: string;
    categories?: Record<string, number>;

    usedInTraining: boolean;
    trainingRunId?: string;
    createdAt: Date;
}

export interface VisionRLAIFConfig {
    enableVisualCapture: boolean;
    minImprovementForPair: number;
    maxPairsPerBuild: number;
    screenshotCompression: number;
}

// Agent Network Types
export type NetworkLearningType = 'pattern' | 'error_fix' | 'strategy' | 'warning' | 'discovery';

export interface NetworkLearning {
    learningId: string;
    sourceAgentId: string;
    buildId: string;
    learningType: NetworkLearningType;
    content: {
        summary: string;
        details: unknown;
        applicability: string[];
        confidence: number;
    };
    timestamp: Date;
}

export interface AgentInfo {
    agentId: string;
    buildId: string;
    currentTask?: string;
    capabilities: string[];
    status: 'active' | 'idle' | 'completed';
}

export interface NetworkQuery {
    queryId: string;
    askingAgentId: string;
    question: string;
    context: string;
    targetCapabilities?: string[];
}

export interface NetworkResponse {
    respondingAgentId: string;
    answer: string;
    confidence: number;
    relevantLearnings: NetworkLearning[];
}

export interface AgentNetworkConfig {
    enableBroadcasting: boolean;
    enableQuerying: boolean;
    maxBroadcastAge: number;
    relevanceThreshold: number;
}

// Context Priority Types
export type ContextCategory =
    | 'intent_contract'
    | 'current_code'
    | 'error_message'
    | 'past_pattern'
    | 'past_reflexion'
    | 'past_strategy'
    | 'file_structure'
    | 'related_files'
    | 'user_preference'
    | 'verification_result';

export type TaskType =
    | 'code_generation'
    | 'error_fixing'
    | 'design'
    | 'architecture'
    | 'verification';

export interface ContextItem {
    itemId: string;
    category: ContextCategory;
    content: string;
    tokenCount: number;
    sourceFile?: string;
    recency: Date;
    relevanceScore?: number;
    usageCount?: number;
    successRate?: number;
}

export interface ContextPriority {
    priorityId: string;
    category: ContextCategory;
    taskType: TaskType;
    baseWeight: number;
    learnedWeight: number;
    usageCount: number;
    successCount: number;
    successRate: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ContextPriorityConfig {
    enableLearning: boolean;
    weightDecayRate: number;
    minWeight: number;
    maxWeight: number;
}

// Shadow Model Deployer Types
export type DeploymentProvider = 'runpod' | 'modal' | 'together';
export type DeploymentStatus = 'deploying' | 'active' | 'stopped' | 'failed' | 'scaling';
export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface DeployedModel {
    deploymentId: string;
    modelName: string;
    modelVersion: string;
    baseModel: string;
    provider: DeploymentProvider;
    endpointUrl: string;
    status: DeploymentStatus;
    deploymentConfig?: Record<string, unknown>;
    gpuType?: string;
    replicas: number;
    lastHealthCheck?: Date;
    healthStatus?: HealthStatus;
    requestCount: number;
    avgLatencyMs?: number;
    errorRate: number;
    totalCost: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeploymentConfig {
    provider: DeploymentProvider;
    gpuType: string;
    containerImage: string;
    minReplicas: number;
    maxReplicas: number;
    scaleDownDelay: number;
    healthCheckPath: string;
    envVars?: Record<string, string>;
}

export interface InferenceRequest {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
}

export interface InferenceResponse {
    response: string;
    tokensUsed: number;
    latencyMs: number;
    modelUsed: string;
}

export interface ShadowModelDeployerConfig {
    enableAutoDeploy: boolean;
    minEvalScoreForDeploy: number;
    healthCheckIntervalMs: number;
    scaleToZeroAfterMs: number;
}

// Enhanced Evolution Flywheel Types
export interface EnhancedCycleMetrics extends CycleMetrics {
    directRLAIFScores: number[];
    multiJudgeConsensus: number;
    reflexionCount: number;
    crossBuildTransfers: number;
    visionPairsGenerated: number;
    shadowModelsDeployed: number;
    agentNetworkBroadcasts: number;
    contextPriorityUpdates: number;
}

export interface EnhancedLearningStatus {
    isRunning: boolean;
    currentCycleId: string | null;
    lastCycle: EvolutionCycle | null;
    totalCycles: number;
    overallImprovement: number;
    directRLAIF: {
        totalEvals: number;
        avgScore: number;
        recentScores: number[];
    };
    multiJudge: {
        totalConsensus: number;
        avgConsensusScore: number;
        avgDisagreement: number;
    };
    reflexion: {
        totalNotes: number;
        avgEffectiveness: number;
        recentApplications: number;
    };
    realTimeLearning: {
        eventsProcessed: number;
        quickLearnings: number;
        backgroundQueued: number;
    };
    crossBuildTransfer: {
        totalLinks: number;
        successfulTransfers: number;
        avgEffectiveness: number;
    };
    visionRLAIF: {
        totalPairs: number;
        avgImprovement: number;
        pairsInTraining: number;
    };
    deployedModels: {
        activeDeployments: number;
        totalRequests: number;
        avgLatency: number;
    };
    agentNetwork: {
        activeBroadcasts: number;
        totalLearningsShared: number;
        avgConfidence: number;
    };
    contextPriority: {
        prioritiesLearned: number;
        avgSuccessRate: number;
    };
}

export interface AutoTriggerThresholds {
    newTraces: number;
    newReflexions: number;
    newVisualPairs: number;
    timeElapsedSeconds: number;
}
