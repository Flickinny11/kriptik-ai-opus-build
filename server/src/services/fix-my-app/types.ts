/**
 * Fix My App - Type Definitions
 * 
 * Comprehensive types for the context archaeology system that analyzes
 * broken apps from other AI builders and fixes them intelligently.
 */

// =============================================================================
// SOURCE TYPES
// =============================================================================

export type ImportSource = 'lovable' | 'bolt' | 'v0' | 'github' | 'zip';

export type FixSessionStatus = 
    | 'initializing'
    | 'awaiting_consent'
    | 'importing'
    | 'processing_context'
    | 'analyzing'
    | 'strategy_selection'
    | 'fixing'
    | 'verifying'
    | 'complete'
    | 'failed';

// =============================================================================
// CHAT & CONTEXT TYPES
// =============================================================================

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
    messageNumber: number;
    hasError?: boolean;
    hasCode?: boolean;
}

export interface BuildLog {
    id: string;
    timestamp: Date;
    type: 'info' | 'warning' | 'error';
    message: string;
    source?: string;
    stackTrace?: string;
}

export interface ErrorLog {
    id: string;
    timestamp: Date;
    errorType: string;
    message: string;
    file?: string;
    line?: number;
    column?: number;
    stackTrace?: string;
}

export interface Version {
    id: string;
    messageNumber: number;
    timestamp: Date;
    description: string;
    wasWorking: boolean;
    files: Map<string, string>;
}

// =============================================================================
// INTENT TYPES
// =============================================================================

export interface Feature {
    id: string;
    name: string;
    description: string;
    mentionedAtMessage: number;
    importance: 'primary' | 'secondary';
    status: 'implemented' | 'partial' | 'missing' | 'broken';
    userQuote?: string;
}

export interface DesignPreference {
    theme: 'dark' | 'light' | 'custom';
    colors: string[];
    style: string;
    mentions: string[];
}

export interface TechnicalRequirement {
    requirement: string;
    context: string;
    messageNumber: number;
}

export interface FrustrationPoint {
    messageNumber: number;
    issue: string;
    userQuote: string;
    severity: 'minor' | 'moderate' | 'major';
}

export interface IntentSummary {
    corePurpose: string;
    primaryFeatures: Feature[];
    secondaryFeatures: Feature[];
    designPreferences: DesignPreference;
    technicalRequirements: TechnicalRequirement[];
    frustrationPoints: FrustrationPoint[];
    extractedAt: Date;
}

// =============================================================================
// ERROR TIMELINE TYPES
// =============================================================================

export interface ErrorEvent {
    messageNumber: number;
    errorType: string;
    description: string;
    causedBy?: string;
    resolution?: string;
}

export interface BadFix {
    messageNumber: number;
    whatAiTried: string;
    whyItWasBad: string;
    consequences: string[];
}

export interface LastKnownGoodState {
    messageNumber: number;
    whatWasWorking: string[];
    files?: Map<string, string>;
}

export interface ErrorTimeline {
    firstError: ErrorEvent | null;
    errorChain: ErrorEvent[];
    lastKnownGoodState: LastKnownGoodState | null;
    badFixes: BadFix[];
    rootCause: string;
    cascadingFailures: boolean;
    errorCount: number;
}

// =============================================================================
// IMPLEMENTATION GAP TYPES
// =============================================================================

export interface ImplementationGap {
    featureId: string;
    featureName: string;
    status: 'missing' | 'partial' | 'broken' | 'incorrect';
    severity: 'critical' | 'major' | 'minor';
    details: string;
    suggestedFix: string;
    affectedFiles: string[];
}

// =============================================================================
// FIX STRATEGY TYPES
// =============================================================================

export type FixApproach = 'repair' | 'rebuild_partial' | 'rebuild_full';
export type StartingPoint = 'current' | 'rollback_version' | 'clean_slate';

export interface PreserveConfig {
    uiDesign: boolean;
    componentStructure: boolean;
    styling: boolean;
    workingFeatures: string[];
}

export interface FeatureFix {
    featureId: string;
    featureName: string;
    fixType: 'repair' | 'rewrite' | 'implement';
    description: string;
    estimatedMinutes: number;
}

export interface FixStrategy {
    approach: FixApproach;
    startingPoint: StartingPoint;
    rollbackTo?: number; // message number
    preserve: PreserveConfig;
    featuresToFix: FeatureFix[];
    estimatedTimeMinutes: number;
    estimatedCost: number;
    confidence: number; // 0-1
    reasoning: string;
}

// =============================================================================
// VERIFICATION TYPES
// =============================================================================

export interface FeatureVerification {
    featureId: string;
    featureName: string;
    implemented: boolean;
    working: boolean;
    testResults: string[];
    issues: string[];
}

export interface VisualVerification {
    matches: boolean;
    designScore: number;
    differences: string[];
    screenshots: {
        original?: string;
        fixed: string;
    };
}

export interface FrustrationResolution {
    pointId: string;
    issue: string;
    resolved: boolean;
    resolution: string;
}

export interface MissedItem {
    quote: string;
    context: string;
    importance: 'critical' | 'medium' | 'low';
    implemented: boolean;
}

export interface FinalScanResult {
    missedItems: MissedItem[];
    nothingMissed: boolean;
}

export interface IntentVerificationReport {
    passed: boolean;
    overallScore: number;
    featureVerifications: FeatureVerification[];
    missedRequests: MissedItem[];
    visualVerification: VisualVerification;
    frustrationResolutions: FrustrationResolution[];
    finalScan: FinalScanResult;
    summary: string;
}

// =============================================================================
// CODE ANALYSIS TYPES
// =============================================================================

export interface CodeAnalysis {
    qualityScore: number;
    hasTypeErrors: boolean;
    hasSyntaxErrors: boolean;
    hasPlaceholders: boolean;
    fileCount: number;
    issues: {
        type: string;
        file: string;
        message: string;
        severity: 'error' | 'warning' | 'info';
    }[];
}

// =============================================================================
// SESSION TYPES
// =============================================================================

export interface ConsentPermissions {
    chatHistory: boolean;
    buildLogs: boolean;
    errorLogs: boolean;
    versionHistory: boolean;
}

export interface ImportedProjectContext {
    // Raw storage
    raw: {
        chatHistory: ChatMessage[];
        buildLogs: BuildLog[];
        errorLogs: ErrorLog[];
        versionHistory: Version[];
    };
    
    // Processed storage
    processed: {
        intentSummary: IntentSummary | null;
        featureManifest: Feature[];
        implementationGaps: ImplementationGap[];
        errorTimeline: ErrorTimeline | null;
        codeAnalysis: CodeAnalysis | null;
    };
}

export interface FixSession {
    id: string;
    userId: string;
    projectId?: string;
    source: ImportSource;
    sourceUrl?: string;
    previewUrl?: string;
    status: FixSessionStatus;
    
    // Consent
    consent: ConsentPermissions;
    
    // Context
    context: ImportedProjectContext;
    
    // Strategy
    selectedStrategy?: FixStrategy;
    
    // Results
    verificationReport?: IntentVerificationReport;
    
    // Progress
    progress: number;
    currentStep: string;
    logs: string[];
    
    // Timing
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    
    // Error tracking
    error?: string;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface InitSessionRequest {
    source: ImportSource;
    sourceUrl?: string;
    previewUrl?: string;
}

export interface InitSessionResponse {
    sessionId: string;
    consentRequired: boolean;
}

export interface ConsentRequest {
    chatHistory: boolean;
    buildLogs: boolean;
    errorLogs: boolean;
    versionHistory: boolean;
}

export interface UploadRequest {
    files?: { path: string; content: string }[];
    githubUrl?: string;
    zipFile?: Buffer;
}

export interface ContextSubmitRequest {
    chatHistory?: string;
    buildLogs?: string;
    errorLogs?: string;
}

export interface AnalysisResponse {
    intentSummary: IntentSummary;
    featureManifest: Feature[];
    implementationGaps: ImplementationGap[];
    errorTimeline: ErrorTimeline;
    recommendedStrategy: FixStrategy;
    alternativeStrategies: FixStrategy[];
}

export interface StartFixRequest {
    strategy: FixStrategy;
    modifications?: string[];
}

// =============================================================================
// EVENT TYPES (for SSE streaming)
// =============================================================================

export type FixEventType = 
    | 'progress'
    | 'log'
    | 'phase_start'
    | 'phase_complete'
    | 'file_generated'
    | 'file_fixed'
    | 'error'
    | 'verification_start'
    | 'verification_result'
    | 'complete'
    | 'failed';

export interface FixEvent {
    type: FixEventType;
    timestamp: Date;
    data: unknown;
}

export interface ProgressEvent {
    type: 'progress';
    progress: number;
    stage: string;
    detail?: string;
}

export interface PhaseEvent {
    type: 'phase_start' | 'phase_complete';
    phase: string;
    timestamp: Date;
}

export interface FileEvent {
    type: 'file_generated' | 'file_fixed';
    path: string;
    action: 'create' | 'update' | 'delete';
    preview?: string;
}

export interface CompleteEvent {
    type: 'complete';
    projectId: string;
    verificationPassed: boolean;
    summary: string;
}

