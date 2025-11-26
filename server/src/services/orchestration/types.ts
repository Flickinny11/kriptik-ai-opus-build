/**
 * Multi-Agent Orchestration Types
 *
 * Defines the complete type system for the Development Orchestrator
 * and Agent Swarm architecture.
 */

// ============================================================================
// PROJECT ANALYSIS TYPES
// ============================================================================

export interface ProjectAnalysis {
    corePurpose: string;
    userPersonas: UserPersona[];
    criticalFeatures: Feature[];
    niceToHave: Feature[];
    scaleExpectations: ScaleExpectations;
    constraints: ProjectConstraints;
    integrationNeeds: IntegrationNeed[];
}

export interface UserPersona {
    name: string;
    description: string;
    technicalLevel: 'non-technical' | 'basic' | 'intermediate' | 'advanced' | 'expert';
    primaryGoals: string[];
}

export interface Feature {
    id: string;
    name: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
    dependencies: string[];
    estimatedEffort: string;
}

export interface ScaleExpectations {
    estimatedUsers: string;
    requestsPerSecond: string;
    dataVolumeGB: string;
    growthRate: 'stable' | 'moderate' | 'rapid' | 'explosive';
}

export interface ProjectConstraints {
    budget: 'bootstrap' | 'startup' | 'growth' | 'enterprise' | 'unlimited';
    timeline: string;
    compliance: string[];
    technicalRequirements: string[];
}

export interface IntegrationNeed {
    name: string;
    type: 'auth' | 'payment' | 'storage' | 'email' | 'analytics' | 'api' | 'database' | 'other';
    provider?: string;
    required: boolean;
}

// ============================================================================
// ARCHITECTURE DECISION RECORDS
// ============================================================================

export interface ArchitectureDecisionRecord {
    id: string;
    title: string;
    category: 'frontend' | 'backend' | 'database' | 'auth' | 'infrastructure' | 'design';
    context: string;
    decision: string;
    consequences: string[];
    alternativesConsidered: Alternative[];
    status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
}

export interface Alternative {
    option: string;
    reason: string;
    rejected: boolean;
}

// ============================================================================
// TASK HIERARCHY
// ============================================================================

export type TaskStatus = 'pending' | 'queued' | 'in_progress' | 'review' | 'complete' | 'blocked' | 'failed';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'infrastructure' | 'development' | 'design' | 'quality';

export interface Epic {
    id: string;
    name: string;
    description: string;
    stories: Story[];
    status: TaskStatus;
    dependencies: string[];
}

export interface Story {
    id: string;
    epicId: string;
    name: string;
    description: string;
    tasks: Task[];
    acceptanceCriteria: string[];
    status: TaskStatus;
    dependencies: string[];
}

export interface Task {
    id: string;
    storyId: string;
    name: string;
    description: string;
    type: TaskType;
    priority: TaskPriority;
    dependencies: string[];
    assignedAgent?: AgentId;
    status: TaskStatus;
    artifacts: Artifact[];
    context: SharedContext;
    estimatedMinutes: number;
    actualMinutes?: number;
    retryCount: number;
    maxRetries: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}

export interface Artifact {
    id: string;
    taskId: string;
    type: 'file' | 'config' | 'schema' | 'migration' | 'test' | 'documentation';
    path: string;
    content: string;
    language: string;
    validated: boolean;
    validationErrors?: string[];
}

// ============================================================================
// AGENT HIERARCHY
// ============================================================================

export type AgentRole = 'orchestrator' | 'queen' | 'worker';
export type AgentId = string;

export interface Agent {
    id: AgentId;
    name: string;
    role: AgentRole;
    type: AgentType;
    status: 'idle' | 'busy' | 'error' | 'offline';
    capabilities: string[];
    currentTask?: string;
    completedTasks: number;
    failedTasks: number;
    parentId?: AgentId;
    childrenIds: AgentId[];
}

export type AgentType =
    // Queen agents
    | 'infrastructure_queen'
    | 'development_queen'
    | 'design_queen'
    | 'quality_queen'
    // Infrastructure workers
    | 'vpc_architect'
    | 'database_engineer'
    | 'security_specialist'
    | 'deploy_master'
    // Development workers
    | 'api_engineer'
    | 'frontend_engineer'
    | 'auth_specialist'
    | 'integration_engineer'
    // Design workers
    | 'ui_architect'
    | 'motion_designer'
    | 'responsive_engineer'
    | 'a11y_specialist'
    // Quality workers
    | 'test_engineer'
    | 'e2e_tester'
    | 'code_reviewer'
    | 'security_auditor';

// ============================================================================
// INTER-AGENT COMMUNICATION
// ============================================================================

export interface SharedContext {
    infrastructure: InfrastructureContext;
    design: DesignContext;
    development: DevelopmentContext;
    quality: QualityContext;
}

export interface InfrastructureContext {
    vpcId?: string;
    subnetIds: string[];
    databaseEndpoint?: string;
    apiEndpoint?: string;
    cdnEndpoint?: string;
    secretsArn?: string;
    deploymentTargets: DeploymentTarget[];
}

export interface DeploymentTarget {
    name: string;
    provider: 'vercel' | 'netlify' | 'cloudflare' | 'aws' | 'gcp' | 'runpod';
    region: string;
    url?: string;
    status: 'pending' | 'deploying' | 'active' | 'failed';
}

export interface DesignContext {
    designTokens: Record<string, string>;
    componentRegistry: ComponentDefinition[];
    animationVariants: Record<string, any>;
    colorScheme: 'light' | 'dark' | 'system';
    fonts: FontDefinition[];
}

export interface ComponentDefinition {
    name: string;
    path: string;
    variants: string[];
    props: Record<string, string>;
}

export interface FontDefinition {
    name: string;
    family: string;
    weights: number[];
    variable: boolean;
}

export interface DevelopmentContext {
    apiRoutes: RouteDefinition[];
    schemas: Record<string, any>;
    envVariables: EnvVariable[];
    packages: PackageDependency[];
}

export interface RouteDefinition {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    handler: string;
    middleware: string[];
    authenticated: boolean;
}

export interface EnvVariable {
    key: string;
    description: string;
    required: boolean;
    sensitive: boolean;
    defaultValue?: string;
}

export interface PackageDependency {
    name: string;
    version: string;
    dev: boolean;
}

export interface QualityContext {
    testCoverage: number;
    lintingPassed: boolean;
    securityScore: number;
    accessibilityScore: number;
    performanceScore: number;
    bundleSizeKB: number;
    criticalIssues: QualityIssue[];
    warnings: QualityIssue[];
}

export interface QualityIssue {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'security' | 'performance' | 'accessibility' | 'code-quality' | 'design';
    message: string;
    file?: string;
    line?: number;
    suggestion?: string;
}

// ============================================================================
// AGENT MESSAGES
// ============================================================================

export interface AgentMessage {
    id: string;
    from: AgentId;
    to: AgentId | 'broadcast';
    type: 'artifact' | 'request' | 'response' | 'error' | 'status' | 'complete';
    payload: unknown;
    timestamp: Date;
    correlationId?: string;
}

// ============================================================================
// EXECUTION PLAN
// ============================================================================

export interface ExecutionPlan {
    projectId: string;
    projectName: string;
    phases: ExecutionPhase[];
    estimatedDurationMinutes: number;
    resourceRequirements: ResourceRequirements;
    createdAt: Date;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
}

export interface ExecutionPhase {
    id: string;
    name: string;
    description: string;
    order: number;
    parallel: boolean;
    tasks: Task[];
    status: TaskStatus;
    dependencies: string[];
    startedAt?: Date;
    completedAt?: Date;
}

export interface ResourceRequirements {
    estimatedAgents: number;
    maxConcurrency: number;
    estimatedTokens: number;
    estimatedCredits: number;
}

// ============================================================================
// ORCHESTRATOR EVENTS
// ============================================================================

export type OrchestratorEventType =
    | 'plan_created'
    | 'phase_started'
    | 'phase_completed'
    | 'task_dispatched'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'artifact_created'
    | 'agent_spawned'
    | 'agent_terminated'
    | 'context_updated'
    | 'quality_gate_passed'
    | 'quality_gate_failed'
    | 'deployment_started'
    | 'deployment_completed'
    | 'error';

export interface OrchestratorEvent {
    id: string;
    type: OrchestratorEventType;
    timestamp: Date;
    data: unknown;
    agentId?: AgentId;
    taskId?: string;
    phaseId?: string;
}

// ============================================================================
// ERROR RECOVERY
// ============================================================================

export type RecoveryAction =
    | { action: 'retry'; delay: number }
    | { action: 'reassign'; to: AgentId }
    | { action: 'escalate'; to: 'human_operator' }
    | { action: 'skip'; reason: string }
    | { action: 'abort'; reason: string };

export interface ErrorRecoveryConfig {
    maxRetries: number;
    backoffMs: number[];
    escalateAfter: number;
    criticalFailureThreshold: number;
}

