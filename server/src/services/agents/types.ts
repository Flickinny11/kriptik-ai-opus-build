/**
 * Multi-Agent Orchestration Types
 * 
 * Core type definitions for the agent orchestration system.
 * Enables multiple specialized agents to work concurrently while
 * sharing context and coordinating tasks.
 */

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentType = 
    | 'planning'      // Creates and updates implementation plans
    | 'coding'        // Generates and modifies code
    | 'testing'       // Runs tests and validates code
    | 'deployment'    // Handles deployments and infrastructure
    | 'research'      // Discovers models, searches documentation
    | 'integration'   // Manages third-party integrations
    | 'review'        // Code review and quality checks
    | 'debug';        // Debugging and error resolution

export type AgentStatus = 
    | 'idle'          // Ready for work
    | 'working'       // Actively processing a task
    | 'waiting'       // Waiting for dependencies
    | 'blocked'       // Blocked by another task
    | 'error'         // Encountered an error
    | 'completed';    // Task completed

export interface AgentCapability {
    id: string;
    name: string;
    description: string;
    requiredTools?: string[];
}

export interface Agent {
    id: string;
    type: AgentType;
    name: string;
    status: AgentStatus;
    currentTask?: Task;
    capabilities: AgentCapability[];
    startedAt?: Date;
    lastActivityAt?: Date;
    tokensUsed: number;
    errorCount: number;
}

// ============================================================================
// TASK TYPES
// ============================================================================

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface Task {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    assignedAgent?: string;
    dependencies: string[];  // Task IDs this task depends on
    blockedBy?: string[];    // Task IDs blocking this task
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    estimatedDuration?: number;  // seconds
    actualDuration?: number;     // seconds
    retryCount: number;
    maxRetries: number;
}

export interface TaskResult {
    taskId: string;
    success: boolean;
    output?: Record<string, unknown>;
    error?: string;
    duration: number;
    tokensUsed: number;
    /** KripToeNite execution metadata */
    metadata?: {
        model?: string;
        strategy?: string;
        latencyMs?: number;
    };
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface ImplementationPlan {
    id: string;
    projectId: string;
    version: number;
    title: string;
    description: string;
    phases: PlanPhase[];
    currentPhaseIndex: number;
    status: 'draft' | 'active' | 'paused' | 'completed';
    createdAt: Date;
    updatedAt: Date;
}

export interface PlanPhase {
    id: string;
    name: string;
    description: string;
    tasks: PlanTask[];
    status: 'pending' | 'in_progress' | 'completed';
    order: number;
}

export interface PlanTask {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignedAgentType?: AgentType;
    estimatedDuration?: number;
    actualDuration?: number;
    dependencies: string[];
    artifacts?: string[];  // File paths or resource IDs created
}

export interface ProjectState {
    id: string;
    name: string;
    framework: string;
    files: Record<string, FileState>;
    dependencies: Record<string, string>;
    environment: Record<string, string>;  // Non-sensitive env vars
    buildStatus: 'idle' | 'building' | 'success' | 'error';
    previewUrl?: string;
    lastModifiedAt: Date;
}

export interface FileState {
    path: string;
    content?: string;  // Only for small files
    hash: string;
    size: number;
    language: string;
    lastModifiedAt: Date;
    lastModifiedBy?: string;  // Agent ID or 'user'
}

export interface UserPreferences {
    userId: string;
    defaultFramework: string;
    defaultDeploymentTarget: string;
    codeStyle: {
        indentation: 'tabs' | 'spaces';
        tabSize: number;
        semicolons: boolean;
        singleQuotes: boolean;
    };
    aiPreferences: {
        verbosity: 'concise' | 'detailed' | 'verbose';
        autoApprove: boolean;
        confirmDeployments: boolean;
    };
    notifications: {
        deploymentComplete: boolean;
        taskComplete: boolean;
        errorAlerts: boolean;
    };
}

export interface DeploymentState {
    activeDeployments: DeploymentInfo[];
    pendingDeployments: DeploymentInfo[];
    deploymentHistory: DeploymentInfo[];
}

export interface DeploymentInfo {
    id: string;
    projectId: string;
    provider: string;
    status: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed';
    endpoint?: string;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    logs: string[];
    metrics?: DeploymentMetrics;
}

export interface DeploymentMetrics {
    requests: number;
    avgLatency: number;
    errorRate: number;
    uptime: number;
    costToDate: number;
    costPerHour: number;
}

export interface CredentialReference {
    integrationId: string;
    hasCredential: boolean;
    validationStatus: 'pending' | 'valid' | 'invalid' | 'expired';
    lastValidatedAt?: Date;
}

// ============================================================================
// SHARED CONTEXT
// ============================================================================

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'agent';
    content: string;
    agentId?: string;
    agentType?: AgentType;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

export interface ContextCheckpoint {
    id: string;
    timestamp: Date;
    summary: string;
    keyDecisions: string[];
    filesModified: string[];
    tasksCompleted: string[];
}

export interface SharedContext {
    // Core identification
    id: string;
    projectId: string;
    userId: string;
    sessionId: string;
    
    // Implementation tracking
    implementationPlan: ImplementationPlan | null;
    projectState: ProjectState;
    
    // Agent coordination
    activeAgents: Agent[];
    taskQueue: Task[];
    completedTasks: Task[];
    
    // User configuration
    userPreferences: UserPreferences;
    credentialVault: CredentialReference[];
    
    // Deployment tracking
    deploymentState: DeploymentState;
    
    // Conversation continuity
    conversationHistory: Message[];
    contextCheckpoints: ContextCheckpoint[];
    
    // Workflow state
    activeWorkflow?: WorkflowState;
    
    // Metadata
    createdAt: Date;
    updatedAt: Date;
    lastActivityAt: Date;
    totalTokensUsed: number;
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface WorkflowState {
    id: string;
    name: string;
    status: 'planning' | 'approved' | 'deploying' | 'running' | 'paused' | 'failed';
    plan: WorkflowPlan;
    deployments: WorkflowDeployment[];
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkflowPlan {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    totalEstimatedCost: CostEstimate;
    requiredCredentials: string[];
    deploymentTargets: DeploymentTarget[];
    dataFlow: DataFlowEdge[];
}

export interface WorkflowStep {
    id: string;
    type: 'model' | 'transform' | 'condition' | 'output' | 'input';
    name: string;
    description: string;
    model?: ModelRecommendation;
    config: Record<string, unknown>;
    inputs: string[];  // Step IDs
    outputs: string[];  // Output names
    dependencies: string[];  // Step IDs
    position: { x: number; y: number };  // For visualization
}

export interface WorkflowDeployment {
    stepId: string;
    deploymentId: string;
    status: DeploymentInfo['status'];
    endpoint?: string;
}

export interface DataFlowEdge {
    id: string;
    source: string;  // Step ID
    target: string;  // Step ID
    sourceOutput: string;
    targetInput: string;
    dataType: string;
}

export interface DeploymentTarget {
    id: string;
    provider: string;
    region?: string;
    gpuType?: string;
    config: Record<string, unknown>;
}

export interface CostEstimate {
    setupCost: number;
    hourlyRunningCost: number;
    estimatedMonthlyCost: number;
    breakdown: CostBreakdown[];
    currency: string;
}

export interface CostBreakdown {
    item: string;
    cost: number;
    unit: 'one-time' | 'per-hour' | 'per-request' | 'per-month';
}

// ============================================================================
// MODEL DISCOVERY TYPES
// ============================================================================

export type ModelSource = 'huggingface' | 'replicate' | 'civitai' | 'ollama' | 'together' | 'custom';

export interface ModelRecommendation {
    modelId: string;
    source: ModelSource;
    name: string;
    task: string;
    reasoning: string;
    alternatives: ModelRecommendation[];
    requirements: ModelRequirements;
    popularity: ModelPopularity;
    pricing?: ModelPricing;
}

export interface ModelRequirements {
    gpu: string;
    vram: number;  // GB
    estimatedLatency: number;  // seconds
    supportedFormats: string[];
    framework: string;
}

export interface ModelPopularity {
    downloads: number;
    likes: number;
    lastUpdated: Date;
    trending: boolean;
}

export interface ModelPricing {
    provider: string;
    costPerSecond?: number;
    costPerRequest?: number;
    costPerToken?: number;
}

// ============================================================================
// MIGRATION TYPES
// ============================================================================

export type MigrationTargetPlatform = 
    | 'vercel' 
    | 'netlify' 
    | 'cloudflare' 
    | 'aws-amplify' 
    | 'railway' 
    | 'fly' 
    | 'self-hosted' 
    | 'custom';

export type MigrationAssistanceLevel = 'full-ai' | 'guided' | 'manual';

export interface MigrationRequest {
    sourceProject: {
        id: string;
        name: string;
        currentPlatform: string;
        currentUrl?: string;
    };
    targetPlatform: MigrationTargetPlatform;
    targetUrl?: string;
    includeBackend: boolean;
    transferIntegrations: boolean;
    assistanceLevel: MigrationAssistanceLevel;
}

export interface MigrationPlan {
    id: string;
    request: MigrationRequest;
    steps: MigrationStep[];
    estimatedTime: number;  // minutes
    warnings: string[];
    requiredActions: UserAction[];
    backendChanges: BackendChange[];
    integrationMigrations: IntegrationMigration[];
    rollbackPlan: RollbackPlan;
}

export interface MigrationStep {
    id: string;
    name: string;
    description: string;
    status: TaskStatus;
    automated: boolean;
    duration?: number;
    logs: string[];
}

export interface UserAction {
    id: string;
    title: string;
    description: string;
    required: boolean;
    completed: boolean;
    helpUrl?: string;
}

export interface BackendChange {
    type: 'url' | 'env' | 'config' | 'database';
    description: string;
    before: string;
    after: string;
}

export interface IntegrationMigration {
    integrationId: string;
    name: string;
    status: 'pending' | 'migrating' | 'completed' | 'failed' | 'manual';
    newConfig?: Record<string, unknown>;
    error?: string;
}

export interface RollbackPlan {
    available: boolean;
    expiresAt?: Date;
    steps: string[];
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = 'zip' | 'git-repo' | 'docker-compose' | 'tar';

export interface ExportOptions {
    format: ExportFormat;
    includeNodeModules: boolean;
    includeEnvTemplate: boolean;
    includeDeploymentConfigs: boolean;
    includeDocs: boolean;
    targetPlatform?: MigrationTargetPlatform;
    compressionLevel?: number;
}

export interface ExportResult {
    id: string;
    format: ExportFormat;
    downloadUrl: string;
    size: number;
    expiresAt: Date;
    contents: string[];
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type ContextEventType = 
    | 'agent:started'
    | 'agent:completed'
    | 'agent:error'
    | 'task:created'
    | 'task:started'
    | 'task:completed'
    | 'task:failed'
    | 'plan:updated'
    | 'file:modified'
    | 'deployment:started'
    | 'deployment:completed'
    | 'deployment:failed'
    | 'workflow:approved'
    | 'workflow:started'
    | 'workflow:completed'
    | 'credential:added'
    | 'credential:removed'
    | 'context:checkpoint';

export interface ContextEvent {
    id: string;
    type: ContextEventType;
    timestamp: Date;
    agentId?: string;
    taskId?: string;
    data: Record<string, unknown>;
}

export interface ContextSubscription {
    id: string;
    eventTypes: ContextEventType[];
    callback: (event: ContextEvent) => void;
}

