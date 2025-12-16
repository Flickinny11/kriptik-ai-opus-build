/**
 * Krip-Toe-Nite Types - Intelligent Model Orchestration
 *
 * Type definitions for the Krip-Toe-Nite intelligent routing system
 * that orchestrates multiple AI models for optimal speed, quality, and cost.
 */

// =============================================================================
// TASK CLASSIFICATION
// =============================================================================

/**
 * Task types for intelligent routing decisions
 */
export enum TaskType {
    CODE_GENERATION = 'code_generation',
    CODE_FIX = 'code_fix',
    CODE_REFACTOR = 'code_refactor',
    UI_COMPONENT = 'ui_component',
    API_DESIGN = 'api_design',
    DATABASE = 'database',
    EXPLANATION = 'explanation',
    DOCUMENTATION = 'documentation',
    SIMPLE_EDIT = 'simple_edit',
    COMPLEX_REASONING = 'complex_reasoning',
    DESIGN_SYSTEM = 'design_system',
    ARCHITECTURE = 'architecture',
    TESTING = 'testing',
    DEBUGGING = 'debugging',
}

/**
 * Complexity levels that determine routing strategy
 */
export enum Complexity {
    TRIVIAL = 1,    // Single line, formatting, typos
    SIMPLE = 2,     // Standard boilerplate, basic components
    MEDIUM = 3,     // Feature implementation, multi-file
    COMPLEX = 4,    // Architecture, multi-service, design systems
    EXPERT = 5,     // Novel problems, system design, critical decisions
}

/**
 * Execution strategies for model orchestration
 */
export type ExecutionStrategy =
    | 'single'       // Single fast model (trivial/simple)
    | 'speculative'  // Fast streams, smart validates (medium)
    | 'parallel'     // Race multiple models, take best (complex)
    | 'ensemble';    // Multiple models vote/merge (expert)

// =============================================================================
// MODEL CONFIGURATION
// =============================================================================

/**
 * Model tier classification
 */
export type ModelTier = 'speed' | 'intelligence' | 'specialist';

/**
 * Model configuration for Krip-Toe-Nite routing
 */
export interface KTNModelConfig {
    /** Unique identifier for this model config */
    id: string;
    /** Direct SDK model ID (for Anthropic/OpenAI native SDKs) - optional, only for supported providers */
    directModelId?: string;
    /** OpenRouter model ID (for fallback/other providers) */
    openRouterId: string;
    /** Human-readable name */
    name: string;
    /** Model tier */
    tier: ModelTier;
    /** Average time to first token (ms) */
    avgTtftMs: number;
    /** Average tokens per second */
    avgTpsMs: number;
    /** Cost per 1M input tokens (USD) */
    costPer1MInput: number;
    /** Cost per 1M output tokens (USD) */
    costPer1MOutput: number;
    /** Maximum context window */
    maxContext: number;
    /** Maximum output tokens */
    maxOutput: number;
    /** Model strengths */
    strengths: string[];
    /** Supports vision/images */
    supportsVision: boolean;
    /** Supports streaming */
    supportsStreaming: boolean;
}

// =============================================================================
// ROUTING DECISIONS
// =============================================================================

/**
 * Analysis result for a task
 */
export interface TaskAnalysis {
    taskType: TaskType;
    complexity: Complexity;
    estimatedTokens: number;
    requiresVision: boolean;
    isDesignHeavy: boolean;
    isCritical: boolean;
    reason: string;
    signals: {
        codeKeywords: boolean;
        uiKeywords: boolean;
        fixKeywords: boolean;
        architectureKeywords: boolean;
        designKeywords: boolean;
    };
}

/**
 * Routing decision output
 */
export interface RoutingDecision {
    /** Primary model to use */
    primaryModel: KTNModelConfig;
    /** Execution strategy */
    strategy: ExecutionStrategy;
    /** Secondary model for speculative/parallel execution */
    parallelModel?: KTNModelConfig;
    /** Use semantic cache */
    useCache: boolean;
    /** Stream response */
    streamResponse: boolean;
    /** Maximum allowed latency (ms) */
    maxLatencyMs: number;
    /** Fallback model if primary fails */
    fallbackModel?: KTNModelConfig;
    /** Routing reasoning */
    reasoning: string;
}

// =============================================================================
// EXECUTION
// =============================================================================

/**
 * Build context for routing decisions
 */
export interface BuildContext {
    /** Framework being used */
    framework?: string;
    /** Programming language */
    language?: string;
    /** Number of files in project */
    fileCount?: number;
    /** Current active file */
    activeFile?: string;
    /** Styling system */
    styling?: string;
    /** State management */
    stateManagement?: string;
    /** List of project files */
    fileList?: string[];
    /** User ID for personalization */
    userId?: string;
    /** Project ID */
    projectId?: string;
    /** Session ID */
    sessionId?: string;
    /** Previous conversation context */
    conversationHistory?: Message[];
    /** Current errors in project */
    currentErrors?: string[];
}

/**
 * Message in conversation
 */
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}

/**
 * Generation request
 */
export interface GenerationRequest {
    /** User prompt */
    prompt: string;
    /** System prompt override */
    systemPrompt?: string;
    /** Images for vision tasks */
    images?: Array<{ url: string; detail?: 'low' | 'high' | 'auto' }>;
    /** Task type hint */
    taskType?: TaskType;
    /** Existing code context */
    existingCode?: string;
    /** Max tokens to generate */
    maxTokens?: number;
    /** Temperature */
    temperature?: number;
    /** Force streaming */
    stream?: boolean;
    /** Force specific model */
    forceModel?: string;
    /** Force complexity tier */
    forceComplexity?: Complexity;
    /** Build context */
    context?: BuildContext;
}

/**
 * Chunk types in streaming response
 */
export type StreamChunkType =
    | 'text'            // Content text
    | 'status'          // Status update
    | 'enhancement_start' // Enhancement beginning
    | 'tool_call'       // Tool invocation
    | 'done'            // Stream complete
    | 'error';          // Error occurred

/**
 * Streaming response chunk
 */
export interface StreamChunk {
    type: StreamChunkType;
    content: string;
    model?: string;
    strategy?: ExecutionStrategy;
    metadata?: {
        latencyMs?: number;
        ttftMs?: number;
        provider?: string;
        isEnhancement?: boolean;
        tokensGenerated?: number;
    };
}

/**
 * Execution chunk (extends StreamChunk with more context)
 */
export interface ExecutionChunk extends StreamChunk {
    /** Which model generated this chunk */
    model: string;
    /** Which strategy was used */
    strategy: ExecutionStrategy;
    /** Timestamp */
    timestamp: number;
}

/**
 * Complete generation response
 */
export interface GenerationResponse {
    id: string;
    content: string;
    model: string;
    modelConfig: KTNModelConfig;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCost: number;
    };
    taskAnalysis: TaskAnalysis;
    routingDecision: RoutingDecision;
    latencyMs: number;
    ttftMs?: number;
    strategy: ExecutionStrategy;
    wasEnhanced: boolean;
}

// =============================================================================
// CACHING
// =============================================================================

/**
 * Cache hit result
 */
export interface CacheHit {
    response: string;
    similarity: number;
    originalPrompt: string;
    cachedAt: number;
    model: string;
    context?: BuildContext;
}

/**
 * Cache metadata for storage
 */
export interface CacheMetadata {
    taskType: TaskType;
    complexity: Complexity;
    model: string;
    strategy: ExecutionStrategy;
    contextHash?: string;
}

// =============================================================================
// TELEMETRY
// =============================================================================

/**
 * Request telemetry event
 */
export interface RequestTelemetry {
    requestId: string;
    timestamp: number;
    promptHash: string;
    promptLength: number;
    promptTokens: number;
    context: {
        framework?: string;
        language?: string;
        fileCount?: number;
    };
    routing: {
        taskType: TaskType;
        complexity: Complexity;
        strategy: ExecutionStrategy;
        primaryModel: string;
        parallelModel?: string;
    };
    performance: {
        ttftMs: number;
        totalLatencyMs: number;
        outputTokens: number;
    };
    cost: {
        input: number;
        output: number;
        total: number;
    };
    outcome?: {
        success: boolean;
        userSatisfaction?: number;
        editDistance?: number;
        accepted?: boolean;
        regenerated?: boolean;
    };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Krip-Toe-Nite configuration
 */
export interface KripToeNiteConfig {
    /** Enable caching */
    enableCache?: boolean;
    /** Cache similarity threshold (0-1) */
    cacheSimilarityThreshold?: number;
    /** Enable speculative execution */
    enableSpeculative?: boolean;
    /** Default max latency (ms) */
    defaultMaxLatencyMs?: number;
    /** Enable telemetry */
    enableTelemetry?: boolean;
    /** Max retries on failure */
    maxRetries?: number;
    /** Retry delay (ms) */
    retryDelayMs?: number;
    /** Complexity threshold overrides */
    complexityThresholds?: {
        trivialMaxLength?: number;
        simpleMaxLength?: number;
        expertMinLength?: number;
    };
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type {
    KTNModelConfig as ModelConfig,
};
