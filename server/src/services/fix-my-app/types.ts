/**
 * Fix My App - Type Definitions
 *
 * Comprehensive types for the context archaeology system that analyzes
 * broken apps from other AI builders and fixes them intelligently.
 */

// =============================================================================
// SOURCE TYPES
// =============================================================================

/**
 * All supported AI-first builder platforms for "Fix My App" feature.
 *
 * Categories:
 * - AI Builders (full context): lovable, bolt, v0, create, tempo, gptengineer, databutton
 * - AI Assistants (paste chat): claude, chatgpt, cursor, windsurf, cody, codeium
 * - Dev Platforms (limited context): replit, codesandbox, stackblitz
 * - Code Only: github, gitlab, bitbucket, zip
 */
export type ImportSource =
    // Full AI Builders (web-based, full context extraction)
    | 'lovable'        // Lovable.dev - Full-stack AI builder
    | 'bolt'           // Bolt.new - Stackblitz AI builder
    | 'v0'             // v0.dev - Vercel's component builder
    | 'create'         // Create.xyz - AI app builder
    | 'tempo'          // Tempo Labs - AI development platform
    | 'gptengineer'    // gptengineer.app - GPT Engineer web
    | 'databutton'     // Databutton - AI data app builder
    | 'magic_patterns' // Magic Patterns - Design-to-code

    // AI Chat Assistants (user pastes code + conversation)
    | 'claude'         // Claude.ai - Anthropic's assistant + Artifacts
    | 'chatgpt'        // ChatGPT - OpenAI + Canvas
    | 'gemini'         // Google Gemini
    | 'copilot'        // GitHub Copilot Chat

    // AI Code Editors (export project + chat history)
    | 'cursor'         // Cursor IDE - AI-first editor
    | 'windsurf'       // Windsurf - Codeium's AI IDE
    | 'cody'           // Sourcegraph Cody
    | 'continue'       // Continue.dev

    // Dev Platforms (code + limited context)
    | 'replit'         // Replit - Online IDE with AI
    | 'codesandbox'    // CodeSandbox - Browser IDE
    | 'stackblitz'     // Stackblitz - WebContainers

    // Code Repositories (code only, no context)
    | 'github'         // GitHub repository
    | 'gitlab'         // GitLab repository
    | 'bitbucket'      // Bitbucket repository

    // File Upload (code only)
    | 'zip';           // ZIP file upload

/**
 * Metadata about each import source for UI and processing
 */
export interface SourceMetadata {
    id: ImportSource;
    name: string;
    icon: string;
    description: string;
    category: 'ai_builder' | 'ai_assistant' | 'ai_editor' | 'dev_platform' | 'repository' | 'file_upload';
    contextAvailable: boolean;
    requiresUrl: boolean;
    requiresPaste: boolean;
    urlPlaceholder?: string;
    chatInstructions?: string[];
    chatParserKey: string; // Key for chat parsing logic
}

/**
 * Complete source configuration registry
 */
export const SOURCE_REGISTRY: Record<ImportSource, SourceMetadata> = {
    // =========================================================================
    // AI BUILDERS - Full context extraction, web-based
    // =========================================================================
    lovable: {
        id: 'lovable',
        name: 'Lovable.dev',
        icon: '💜',
        description: 'Full-stack AI app builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open your Lovable project',
            'Scroll to the top of the chat',
            'Select all messages (Cmd/Ctrl + A)',
            'Copy (Cmd/Ctrl + C) and paste below',
        ],
        chatParserKey: 'lovable',
    },
    bolt: {
        id: 'bolt',
        name: 'Bolt.new',
        icon: '⚡',
        description: 'Stackblitz-powered AI builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open your Bolt.new project',
            'Click the chat history icon',
            'Select and copy all messages',
            'Paste the conversation below',
        ],
        chatParserKey: 'bolt',
    },
    v0: {
        id: 'v0',
        name: 'v0.dev',
        icon: '▲',
        description: 'Vercel\'s AI component builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        requiresPaste: true,
        urlPlaceholder: 'https://v0.dev/chat/...',
        chatInstructions: [
            'Open your v0 conversation',
            'Copy the shareable link (for code)',
            'Also copy/paste the full conversation',
        ],
        chatParserKey: 'v0',
    },
    create: {
        id: 'create',
        name: 'Create.xyz',
        icon: '🎨',
        description: 'AI-powered app creation',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        requiresPaste: true,
        urlPlaceholder: 'https://create.xyz/project/...',
        chatInstructions: [
            'Open your Create.xyz project',
            'Copy the project URL',
            'Export or copy the chat history',
        ],
        chatParserKey: 'create',
    },
    tempo: {
        id: 'tempo',
        name: 'Tempo Labs',
        icon: '🎵',
        description: 'AI development platform',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        requiresPaste: true,
        urlPlaceholder: 'https://tempo.new/...',
        chatInstructions: [
            'Open your Tempo project',
            'Copy the project URL',
            'Copy the conversation from the chat panel',
        ],
        chatParserKey: 'tempo',
    },
    gptengineer: {
        id: 'gptengineer',
        name: 'GPT Engineer',
        icon: '🤖',
        description: 'gptengineer.app - AI coding',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        requiresPaste: true,
        urlPlaceholder: 'https://gptengineer.app/projects/...',
        chatInstructions: [
            'Open your GPT Engineer project',
            'Copy the project URL',
            'Copy the full conversation history',
        ],
        chatParserKey: 'gptengineer',
    },
    databutton: {
        id: 'databutton',
        name: 'Databutton',
        icon: '📊',
        description: 'AI data app builder',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: true,
        requiresPaste: true,
        urlPlaceholder: 'https://databutton.com/app/...',
        chatInstructions: [
            'Open your Databutton project',
            'Copy the app URL',
            'Export or copy the build conversation',
        ],
        chatParserKey: 'databutton',
    },
    magic_patterns: {
        id: 'magic_patterns',
        name: 'Magic Patterns',
        icon: '✨',
        description: 'Design-to-code AI',
        category: 'ai_builder',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open Magic Patterns',
            'Export your generated components',
            'Copy the design conversation',
        ],
        chatParserKey: 'magic_patterns',
    },

    // =========================================================================
    // AI ASSISTANTS - Paste code + conversation
    // =========================================================================
    claude: {
        id: 'claude',
        name: 'Claude (Artifacts)',
        icon: '🧠',
        description: 'Anthropic Claude + Artifacts',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open your Claude conversation',
            'Click "Share" or export conversation',
            'Or: Select all messages and copy',
            'Include all artifact code in the paste',
        ],
        chatParserKey: 'claude',
    },
    chatgpt: {
        id: 'chatgpt',
        name: 'ChatGPT (Canvas)',
        icon: '💚',
        description: 'OpenAI ChatGPT + Canvas',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open your ChatGPT conversation',
            'Click the share button and copy link',
            'Or: Select all and copy the conversation',
            'Include any Canvas code outputs',
        ],
        chatParserKey: 'chatgpt',
    },
    gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        icon: '💎',
        description: 'Google\'s AI assistant',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open your Gemini conversation',
            'Select and copy all messages',
            'Include any code blocks generated',
        ],
        chatParserKey: 'gemini',
    },
    copilot: {
        id: 'copilot',
        name: 'GitHub Copilot Chat',
        icon: '🐙',
        description: 'GitHub Copilot conversations',
        category: 'ai_assistant',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open VS Code or GitHub.com',
            'Find your Copilot chat history',
            'Copy the relevant conversation',
        ],
        chatParserKey: 'copilot',
    },

    // =========================================================================
    // AI CODE EDITORS - Export project + chat
    // =========================================================================
    cursor: {
        id: 'cursor',
        name: 'Cursor IDE',
        icon: '🖱️',
        description: 'AI-first code editor',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'In Cursor, open the Composer panel',
            'Copy the conversation history',
            'Upload your project folder as ZIP',
            'Paste the Composer conversation below',
        ],
        chatParserKey: 'cursor',
    },
    windsurf: {
        id: 'windsurf',
        name: 'Windsurf IDE',
        icon: '🏄',
        description: 'Codeium\'s AI editor',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'In Windsurf, open Cascade chat',
            'Export or copy the chat history',
            'Upload your project folder as ZIP',
            'Paste the Cascade conversation below',
        ],
        chatParserKey: 'windsurf',
    },
    cody: {
        id: 'cody',
        name: 'Sourcegraph Cody',
        icon: '🔍',
        description: 'Sourcegraph\'s AI assistant',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open your IDE with Cody',
            'Copy the Cody chat history',
            'Upload your project folder',
            'Paste the conversation below',
        ],
        chatParserKey: 'cody',
    },
    continue: {
        id: 'continue',
        name: 'Continue.dev',
        icon: '▶️',
        description: 'Open-source AI assistant',
        category: 'ai_editor',
        contextAvailable: true,
        requiresUrl: false,
        requiresPaste: true,
        chatInstructions: [
            'Open your IDE with Continue',
            'Export the session history',
            'Upload your project folder',
            'Paste the conversation below',
        ],
        chatParserKey: 'continue',
    },

    // =========================================================================
    // DEV PLATFORMS - Code + limited context
    // =========================================================================
    replit: {
        id: 'replit',
        name: 'Replit',
        icon: '🔄',
        description: 'Online IDE with AI assistant',
        category: 'dev_platform',
        contextAvailable: true,
        requiresUrl: true,
        requiresPaste: true,
        urlPlaceholder: 'https://replit.com/@username/project',
        chatInstructions: [
            'Open your Replit project',
            'Copy the Repl URL',
            'Open AI assistant chat, copy conversation',
            'Or: Download project as ZIP',
        ],
        chatParserKey: 'replit',
    },
    codesandbox: {
        id: 'codesandbox',
        name: 'CodeSandbox',
        icon: '📦',
        description: 'Browser-based IDE',
        category: 'dev_platform',
        contextAvailable: false,
        requiresUrl: true,
        requiresPaste: false,
        urlPlaceholder: 'https://codesandbox.io/s/...',
        chatParserKey: 'codesandbox',
    },
    stackblitz: {
        id: 'stackblitz',
        name: 'StackBlitz',
        icon: '⚡',
        description: 'WebContainers IDE',
        category: 'dev_platform',
        contextAvailable: false,
        requiresUrl: true,
        requiresPaste: false,
        urlPlaceholder: 'https://stackblitz.com/edit/...',
        chatParserKey: 'stackblitz',
    },

    // =========================================================================
    // REPOSITORIES - Code only
    // =========================================================================
    github: {
        id: 'github',
        name: 'GitHub',
        icon: '🐙',
        description: 'GitHub repository',
        category: 'repository',
        contextAvailable: false,
        requiresUrl: true,
        requiresPaste: false,
        urlPlaceholder: 'https://github.com/username/repo',
        chatParserKey: 'none',
    },
    gitlab: {
        id: 'gitlab',
        name: 'GitLab',
        icon: '🦊',
        description: 'GitLab repository',
        category: 'repository',
        contextAvailable: false,
        requiresUrl: true,
        requiresPaste: false,
        urlPlaceholder: 'https://gitlab.com/username/repo',
        chatParserKey: 'none',
    },
    bitbucket: {
        id: 'bitbucket',
        name: 'Bitbucket',
        icon: '🪣',
        description: 'Bitbucket repository',
        category: 'repository',
        contextAvailable: false,
        requiresUrl: true,
        requiresPaste: false,
        urlPlaceholder: 'https://bitbucket.org/username/repo',
        chatParserKey: 'none',
    },

    // =========================================================================
    // FILE UPLOAD
    // =========================================================================
    zip: {
        id: 'zip',
        name: 'ZIP Upload',
        icon: '📁',
        description: 'Upload project as ZIP file',
        category: 'file_upload',
        contextAvailable: false,
        requiresUrl: false,
        requiresPaste: false,
        chatParserKey: 'none',
    },
};

/**
 * Get sources by category for UI organization
 */
export function getSourcesByCategory(): Record<string, SourceMetadata[]> {
    const categories: Record<string, SourceMetadata[]> = {
        ai_builder: [],
        ai_assistant: [],
        ai_editor: [],
        dev_platform: [],
        repository: [],
        file_upload: [],
    };

    for (const source of Object.values(SOURCE_REGISTRY)) {
        categories[source.category].push(source);
    }

    return categories;
}

/**
 * Check if source supports context extraction
 */
export function sourceHasContext(source: ImportSource): boolean {
    return SOURCE_REGISTRY[source]?.contextAvailable ?? false;
}

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

