/**
 * Development Orchestrator
 *
 * The master orchestrator that:
 * 1. Understands natural language project requirements
 * 2. Architects complete system designs
 * 3. Decomposes work into parallelizable tasks
 * 4. Spawns and coordinates specialist agents
 * 5. Enforces quality at every checkpoint
 * 6. Deploys production-ready infrastructure
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    ProjectAnalysis,
    ArchitectureDecisionRecord,
    ExecutionPlan,
    ExecutionPhase,
    Epic,
    Story,
    Task,
    TaskType,
    TaskStatus,
    Agent,
    AgentType,
    AgentId,
    SharedContext,
    OrchestratorEvent,
    OrchestratorEventType,
    Artifact,
    RecoveryAction,
    ErrorRecoveryConfig,
    QualityIssue,
} from './types.js';
import { getAgentPrompt, getContextInjectionPrompt } from './prompts.js';
import { QueenAgent } from './agents/queen-agent.js';
import { ClaudeService } from '../ai/claude-service.js';
import { getKripToeNiteService, type KripToeNiteService } from '../ai/krip-toe-nite/index.js';

export interface OrchestratorConfig {
    maxConcurrentTasks: number;
    qualityGateEnabled: boolean;
    autoDeployEnabled: boolean;
    errorRecovery: ErrorRecoveryConfig;
}

export interface ProjectRequest {
    prompt: string;
    projectName?: string;
    projectId?: string;
    constraints?: Partial<ProjectAnalysis['constraints']>;
}

export class DevelopmentOrchestrator extends EventEmitter {
    private config: OrchestratorConfig;
    private claudeService: ClaudeService;
    private ktnService: KripToeNiteService;
    private agents: Map<AgentId, Agent> = new Map();
    private queens: Map<TaskType, QueenAgent> = new Map();
    private currentPlan: ExecutionPlan | null = null;
    private sharedContext: SharedContext;
    private taskQueue: Task[] = [];
    private activeTaskCount = 0;
    private isRunning = false;

    constructor(claudeService: ClaudeService, config?: Partial<OrchestratorConfig>) {
        super();
        this.claudeService = claudeService;
        this.ktnService = getKripToeNiteService();
        this.config = {
            maxConcurrentTasks: config?.maxConcurrentTasks ?? 4,
            qualityGateEnabled: config?.qualityGateEnabled ?? true,
            autoDeployEnabled: config?.autoDeployEnabled ?? false,
            errorRecovery: config?.errorRecovery ?? {
                maxRetries: 3,
                backoffMs: [1000, 5000, 15000],
                escalateAfter: 3,
                criticalFailureThreshold: 5,
            },
        };
        this.sharedContext = this.initializeContext();
    }

    private initializeContext(): SharedContext {
        return {
            infrastructure: {
                subnetIds: [],
                deploymentTargets: [],
            },
            design: {
                designTokens: {},
                componentRegistry: [],
                animationVariants: {},
                colorScheme: 'system',
                fonts: [],
            },
            development: {
                apiRoutes: [],
                schemas: {},
                envVariables: [],
                packages: [],
            },
            quality: {
                testCoverage: 0,
                lintingPassed: false,
                securityScore: 0,
                accessibilityScore: 0,
                performanceScore: 0,
                bundleSizeKB: 0,
                criticalIssues: [],
                warnings: [],
            },
        };
    }

    /**
     * Main entry point: Process a project request
     */
    async processRequest(request: ProjectRequest): Promise<ExecutionPlan> {
        this.emit('started', { projectName: request.projectName });
        this.log('info', `Processing project request: ${request.prompt.substring(0, 100)}...`);
        console.log('[Orchestrator] processRequest started with prompt:', request.prompt.substring(0, 100));

        try {
            // Phase 1: Requirement Extraction
            console.log('[Orchestrator] Phase 1: Starting requirement extraction');
            this.emitEvent('phase_started', { phase: 'requirement_extraction' });
            const analysis = await this.extractRequirements(request.prompt);
            console.log('[Orchestrator] Phase 1 complete. Analysis:', JSON.stringify({
                corePurpose: analysis.corePurpose?.substring(0, 50),
                criticalFeaturesCount: analysis.criticalFeatures?.length ?? 0,
                userPersonasCount: analysis.userPersonas?.length ?? 0,
            }));
            this.log('info', `Extracted ${analysis.criticalFeatures.length} critical features`);

            // Phase 2: Architecture Decisions
            console.log('[Orchestrator] Phase 2: Starting architecture decisions');
            this.emitEvent('phase_started', { phase: 'architecture_decisions' });
            const adrs = await this.generateArchitectureDecisions(analysis);
            console.log('[Orchestrator] Phase 2 complete. ADRs count:', adrs?.length ?? 0);
            this.log('info', `Generated ${adrs.length} architecture decision records`);

            // Phase 3: Task Decomposition
            console.log('[Orchestrator] Phase 3: Starting task decomposition');
            this.emitEvent('phase_started', { phase: 'task_decomposition' });
            const epics = await this.decomposeIntoTasks(analysis, adrs);
            console.log('[Orchestrator] Phase 3 complete. Epics count:', epics?.length ?? 0);
            this.log('info', `Decomposed into ${epics.length} epics`);

            // Phase 4: Create Execution Plan
            console.log('[Orchestrator] Phase 4: Creating execution plan');
            this.emitEvent('phase_started', { phase: 'execution_planning' });
            const plan = await this.createExecutionPlan(request, epics, analysis);
            console.log('[Orchestrator] Phase 4 complete. Plan phases:', plan?.phases?.length ?? 0);
            this.currentPlan = plan;
            this.emitEvent('plan_created', { plan });

            // Phase 5: Spawn Queen Agents
            console.log('[Orchestrator] Phase 5: Spawning queen agents');
            this.emitEvent('phase_started', { phase: 'agent_spawning' });
            await this.spawnQueenAgents();
            console.log('[Orchestrator] Phase 5 complete');

            return plan;
        } catch (error) {
            console.error('[Orchestrator] Error in processRequest:', error);
            this.log('error', `Failed to process request: ${error}`);
            this.emitEvent('error', { error: String(error) });
            throw error;
        }
    }

    /**
     * Execute the current plan
     */
    async executePlan(): Promise<void> {
        if (!this.currentPlan) {
            throw new Error('No execution plan available. Call processRequest first.');
        }

        this.isRunning = true;
        this.currentPlan.status = 'in_progress';
        this.log('info', `Starting execution of plan: ${this.currentPlan.projectName}`);

        try {
            for (const phase of this.currentPlan.phases) {
                if (!this.isRunning) break;

                await this.executePhase(phase);

                // Quality gate check after each phase
                if (this.config.qualityGateEnabled) {
                    await this.runQualityGate(phase);
                }
            }

            this.currentPlan.status = 'completed';
            this.emitEvent('phase_completed', { phase: 'all', status: 'completed' });
        } catch (error) {
            this.currentPlan.status = 'failed';
            this.log('error', `Execution failed: ${error}`);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Extract requirements from natural language prompt
     */
    private async extractRequirements(prompt: string): Promise<ProjectAnalysis> {
        console.log('[Orchestrator.extractRequirements] Starting extraction');
        const systemPrompt = getAgentPrompt('orchestrator');
        console.log('[Orchestrator.extractRequirements] Got system prompt, length:', systemPrompt?.length ?? 0);

        const extractionPrompt = `Analyze this project request and extract structured requirements:

USER REQUEST:
${prompt}

Extract and return a JSON object with:
- corePurpose: What problem does this solve?
- userPersonas: Who uses this? (name, description, technicalLevel, primaryGoals)
- criticalFeatures: Must-have features for MVP (id, name, description, priority, complexity, dependencies, estimatedEffort)
- niceToHave: Phase 2+ features
- scaleExpectations: (estimatedUsers, requestsPerSecond, dataVolumeGB, growthRate)
- constraints: (budget, timeline, compliance, technicalRequirements)
- integrationNeeds: Third-party services needed (name, type, provider, required)

IMPORTANT: Provide realistic, production-ready analysis. No placeholders.`;

        console.log('[Orchestrator.extractRequirements] Calling claudeService.generateStructured');
        try {
            // Disable extended thinking for faster responses (stay within Vercel timeout)
            const response = await this.claudeService.generateStructured<ProjectAnalysis>(
                extractionPrompt,
                systemPrompt,
                { useExtendedThinking: false, maxTokens: 8000 }
            );
            console.log('[Orchestrator.extractRequirements] Got response, type:', typeof response);
            console.log('[Orchestrator.extractRequirements] Response keys:', response ? Object.keys(response) : 'null');

            // Validate and provide defaults for required array fields
            // This prevents "Cannot read properties of undefined" errors
            const result = {
                corePurpose: response.corePurpose || 'Project purpose not specified',
                userPersonas: Array.isArray(response.userPersonas) ? response.userPersonas : [],
                criticalFeatures: Array.isArray(response.criticalFeatures) ? response.criticalFeatures : [],
                niceToHave: Array.isArray(response.niceToHave) ? response.niceToHave : [],
                scaleExpectations: response.scaleExpectations || {
                    estimatedUsers: '1000',
                    requestsPerSecond: '10',
                    dataVolumeGB: '1',
                    growthRate: 'steady',
                },
                constraints: response.constraints || {
                    budget: 'moderate',
                    timeline: 'flexible',
                    compliance: [],
                    technicalRequirements: [],
                },
                integrationNeeds: Array.isArray(response.integrationNeeds) ? response.integrationNeeds : [],
            };
            console.log('[Orchestrator.extractRequirements] Validated result, criticalFeatures count:', result.criticalFeatures.length);
            return result;
        } catch (error) {
            console.error('[Orchestrator.extractRequirements] Error calling claudeService:', error);
            throw error;
        }
    }

    /**
     * Generate Architecture Decision Records
     */
    private async generateArchitectureDecisions(
        analysis: ProjectAnalysis
    ): Promise<ArchitectureDecisionRecord[]> {
        const systemPrompt = getAgentPrompt('orchestrator');

        const adrPrompt = `Based on this project analysis, generate Architecture Decision Records (ADRs):

PROJECT ANALYSIS:
${JSON.stringify(analysis, null, 2)}

Generate ADRs for:
1. Frontend Stack (framework, styling, state management)
2. Backend Architecture (monolith vs microservices, API style)
3. Database Strategy (SQL vs NoSQL, managed vs self-hosted)
4. Authentication (auth provider choice)
5. Infrastructure (cloud provider, deployment strategy)
6. Design System (component library, animation strategy)

For each ADR include:
- id, title, category
- context: Why this decision matters
- decision: What we're choosing
- consequences: Trade-offs accepted
- alternativesConsidered: What we rejected and why
- status: 'accepted'

Return as a JSON array of ADRs. Make real, production-appropriate decisions.`;

        // Disable extended thinking for faster responses (stay within Vercel timeout)
        const response = await this.claudeService.generateStructured<ArchitectureDecisionRecord[]>(
            adrPrompt,
            systemPrompt,
            { useExtendedThinking: false, maxTokens: 8000 }
        );

        // Ensure we always return an array
        return Array.isArray(response) ? response : [];
    }

    /**
     * Decompose project into Epic → Story → Task hierarchy
     */
    private async decomposeIntoTasks(
        analysis: ProjectAnalysis,
        adrs: ArchitectureDecisionRecord[]
    ): Promise<Epic[]> {
        const systemPrompt = getAgentPrompt('orchestrator');

        const decompositionPrompt = `Decompose this project into a hierarchical task structure:

PROJECT ANALYSIS:
${JSON.stringify(analysis, null, 2)}

ARCHITECTURE DECISIONS:
${JSON.stringify(adrs, null, 2)}

Create a hierarchy of:
- Epics (major work streams)
  - Stories (deliverable features)
    - Tasks (atomic, assignable work units)

Include these Epics:
1. Infrastructure Foundation (cloud setup, networking, secrets)
2. Database Layer (schema, migrations, connections)
3. Backend Services (API routes, auth, business logic)
4. Frontend Application (design system, pages, components)
5. Quality & Testing (tests, CI/CD, monitoring)
6. Deployment (production setup, DNS, CDN)

For each Task, specify:
- id, storyId, name, description
- type: 'infrastructure' | 'development' | 'design' | 'quality'
- priority: 'critical' | 'high' | 'medium' | 'low'
- dependencies: Array of task IDs
- estimatedMinutes: number

Return as JSON array of Epics. Be thorough and realistic.`;

        // Disable extended thinking for faster responses (stay within Vercel timeout)
        const response = await this.claudeService.generateStructured<Epic[]>(
            decompositionPrompt,
            systemPrompt,
            { useExtendedThinking: false, maxTokens: 16000 }
        );

        // Ensure we always return an array
        return Array.isArray(response) ? response : [];
    }

    /**
     * Create the execution plan
     */
    private async createExecutionPlan(
        request: ProjectRequest,
        epics: Epic[],
        analysis: ProjectAnalysis
    ): Promise<ExecutionPlan> {
        const phases = this.organizePhasesFromEpics(epics);
        const totalTasks = phases.reduce((acc, phase) => acc + phase.tasks.length, 0);
        const totalMinutes = phases.reduce(
            (acc, phase) => acc + phase.tasks.reduce((t, task) => t + task.estimatedMinutes, 0),
            0
        );

        return {
            projectId: request.projectId || uuidv4(),
            projectName: request.projectName || `Project ${Date.now()}`,
            phases,
            estimatedDurationMinutes: Math.ceil(totalMinutes / this.config.maxConcurrentTasks),
            resourceRequirements: {
                estimatedAgents: Math.min(totalTasks, 12),
                maxConcurrency: this.config.maxConcurrentTasks,
                estimatedTokens: totalTasks * 50000, // Rough estimate
                estimatedCredits: Math.ceil((totalTasks * 50000) / 1000000), // $1 per 1M tokens
            },
            createdAt: new Date(),
            status: 'pending',
        };
    }

    /**
     * Organize epics into execution phases
     */
    private organizePhasesFromEpics(epics: Epic[]): ExecutionPhase[] {
        const phases: ExecutionPhase[] = [];
        const allTasks: Task[] = [];

        // Flatten all tasks
        for (const epic of epics) {
            for (const story of epic.stories) {
                allTasks.push(...story.tasks);
            }
        }

        // Group tasks by type for parallel execution
        const tasksByType: Record<TaskType, Task[]> = {
            infrastructure: [],
            development: [],
            design: [],
            quality: [],
        };

        for (const task of allTasks) {
            tasksByType[task.type].push(task);
        }

        // Phase 1: Foundation (Infrastructure + Design Tokens in parallel)
        phases.push({
            id: uuidv4(),
            name: 'Foundation',
            description: 'Infrastructure setup and design system foundation',
            order: 1,
            parallel: true,
            tasks: [
                ...tasksByType.infrastructure.filter(t =>
                    t.name.toLowerCase().includes('vpc') ||
                    t.name.toLowerCase().includes('iam') ||
                    t.name.toLowerCase().includes('secret')
                ),
                ...tasksByType.design.filter(t =>
                    t.name.toLowerCase().includes('token') ||
                    t.name.toLowerCase().includes('theme')
                ),
            ],
            status: 'pending',
            dependencies: [],
        });

        // Phase 2: Core Services (Database + API Setup)
        phases.push({
            id: uuidv4(),
            name: 'Core Services',
            description: 'Database provisioning and API scaffolding',
            order: 2,
            parallel: true,
            tasks: [
                ...tasksByType.infrastructure.filter(t =>
                    t.name.toLowerCase().includes('database') ||
                    t.name.toLowerCase().includes('cache')
                ),
                ...tasksByType.development.filter(t =>
                    t.name.toLowerCase().includes('api') ||
                    t.name.toLowerCase().includes('route') ||
                    t.name.toLowerCase().includes('auth')
                ),
            ],
            status: 'pending',
            dependencies: [phases[0]?.id].filter(Boolean),
        });

        // Phase 3: Features (Frontend + Backend features in parallel)
        phases.push({
            id: uuidv4(),
            name: 'Feature Development',
            description: 'Frontend components and backend business logic',
            order: 3,
            parallel: true,
            tasks: [
                ...tasksByType.development.filter(t =>
                    !t.name.toLowerCase().includes('api') &&
                    !t.name.toLowerCase().includes('route') &&
                    !t.name.toLowerCase().includes('auth')
                ),
                ...tasksByType.design.filter(t =>
                    !t.name.toLowerCase().includes('token') &&
                    !t.name.toLowerCase().includes('theme')
                ),
            ],
            status: 'pending',
            dependencies: [phases[1]?.id].filter(Boolean),
        });

        // Phase 4: Quality (Testing + Review)
        phases.push({
            id: uuidv4(),
            name: 'Quality Assurance',
            description: 'Testing, code review, and security audit',
            order: 4,
            parallel: true,
            tasks: tasksByType.quality,
            status: 'pending',
            dependencies: [phases[2]?.id].filter(Boolean),
        });

        // Phase 5: Deployment
        phases.push({
            id: uuidv4(),
            name: 'Deployment',
            description: 'Production deployment and monitoring setup',
            order: 5,
            parallel: false,
            tasks: tasksByType.infrastructure.filter(t =>
                t.name.toLowerCase().includes('deploy') ||
                t.name.toLowerCase().includes('cdn') ||
                t.name.toLowerCase().includes('dns')
            ),
            status: 'pending',
            dependencies: [phases[3]?.id].filter(Boolean),
        });

        return phases.filter(phase => phase.tasks.length > 0);
    }

    /**
     * Spawn Queen agents for each task type
     */
    private async spawnQueenAgents(): Promise<void> {
        const queenTypes: Array<{ type: TaskType; agentType: AgentType }> = [
            { type: 'infrastructure', agentType: 'infrastructure_queen' },
            { type: 'development', agentType: 'development_queen' },
            { type: 'design', agentType: 'design_queen' },
            { type: 'quality', agentType: 'quality_queen' },
        ];

        for (const { type, agentType } of queenTypes) {
            // QueenAgent now uses OpenRouter internally, no need to pass ClaudeService
            const queen = new QueenAgent(
                uuidv4(),
                agentType,
                this.sharedContext
            );

            this.queens.set(type, queen);

            const agentInfo: Agent = {
                id: queen.getId(),
                name: agentType.replace('_', ' ').toUpperCase(),
                role: 'queen',
                type: agentType,
                status: 'idle',
                capabilities: this.getQueenCapabilities(agentType),
                completedTasks: 0,
                failedTasks: 0,
                childrenIds: [],
            };

            this.agents.set(queen.getId(), agentInfo);
            this.emitEvent('agent_spawned', { agent: agentInfo });
            this.log('info', `Spawned ${agentType} agent`);
        }
    }

    /**
     * Execute a single phase
     */
    private async executePhase(phase: ExecutionPhase): Promise<void> {
        this.emitEvent('phase_started', { phaseId: phase.id, phaseName: phase.name });
        phase.status = 'in_progress';
        phase.startedAt = new Date();

        this.log('info', `Executing phase: ${phase.name} (${phase.tasks.length} tasks)`);

        if (phase.parallel) {
            await this.executeTasksInParallel(phase.tasks);
        } else {
            await this.executeTasksSequentially(phase.tasks);
        }

        phase.status = 'complete';
        phase.completedAt = new Date();
        this.emitEvent('phase_completed', { phaseId: phase.id, phaseName: phase.name });
    }

    /**
     * Execute tasks in parallel with concurrency limit
     */
    private async executeTasksInParallel(tasks: Task[]): Promise<void> {
        const pendingTasks = [...tasks];
        const inFlight: Promise<void>[] = [];

        while (pendingTasks.length > 0 || inFlight.length > 0) {
            // Start new tasks up to concurrency limit
            while (
                pendingTasks.length > 0 &&
                this.activeTaskCount < this.config.maxConcurrentTasks
            ) {
                const task = pendingTasks.shift();
                if (task && this.canExecuteTask(task)) {
                    const promise = this.executeTask(task).finally(() => {
                        const index = inFlight.indexOf(promise);
                        if (index > -1) inFlight.splice(index, 1);
                    });
                    inFlight.push(promise);
                } else if (task) {
                    // Re-queue if dependencies not met
                    pendingTasks.push(task);
                }
            }

            // Wait for at least one task to complete
            if (inFlight.length > 0) {
                await Promise.race(inFlight);
            }
        }
    }

    /**
     * Execute tasks sequentially
     */
    private async executeTasksSequentially(tasks: Task[]): Promise<void> {
        for (const task of tasks) {
            await this.executeTask(task);
        }
    }

    /**
     * Check if a task can be executed (dependencies met)
     */
    private canExecuteTask(task: Task): boolean {
        if (task.dependencies.length === 0) return true;

        return task.dependencies.every(depId => {
            const depTask = this.findTaskById(depId);
            return depTask?.status === 'complete';
        });
    }

    /**
     * Execute a single task
     */
    private async executeTask(task: Task): Promise<void> {
        this.activeTaskCount++;
        task.status = 'in_progress';
        task.startedAt = new Date();
        this.emitEvent('task_started', { taskId: task.id, taskName: task.name });

        try {
            // Get the appropriate Queen agent
            const queen = this.queens.get(task.type);
            if (!queen) {
                throw new Error(`No queen agent available for task type: ${task.type}`);
            }

            // Inject shared context
            task.context = this.sharedContext;

            // Dispatch to Queen
            const artifacts = await queen.executeTask(task);

            // Validate artifacts
            await this.validateArtifacts(artifacts);

            // Update shared context
            this.updateSharedContext(artifacts);

            task.artifacts = artifacts;
            task.status = 'complete';
            task.completedAt = new Date();
            this.emitEvent('task_completed', { taskId: task.id, taskName: task.name, artifacts });
            this.log('info', `Task completed: ${task.name}`);
        } catch (error) {
            const recovery = await this.handleTaskError(task, error as Error);

            if (recovery.action === 'retry') {
                await new Promise(resolve => setTimeout(resolve, recovery.delay));
                task.retryCount++;
                this.activeTaskCount--;
                await this.executeTask(task);
                return;
            } else if (recovery.action === 'abort') {
                task.status = 'failed';
                task.error = String(error);
                this.emitEvent('task_failed', { taskId: task.id, error: String(error) });
                throw error;
            }
        } finally {
            this.activeTaskCount--;
        }
    }

    /**
     * Handle task execution error
     */
    private async handleTaskError(task: Task, error: Error): Promise<RecoveryAction> {
        this.log('error', `Task ${task.name} failed: ${error.message}`);

        if (task.retryCount < this.config.errorRecovery.maxRetries) {
            const delay = this.config.errorRecovery.backoffMs[task.retryCount] || 15000;
            return { action: 'retry', delay };
        }

        return { action: 'abort', reason: error.message };
    }

    /**
     * Validate generated artifacts
     */
    private async validateArtifacts(artifacts: Artifact[]): Promise<void> {
        for (const artifact of artifacts) {
            // Check for placeholder patterns
            const placeholderPatterns = [
                /TODO:/i,
                /FIXME:/i,
                /PLACEHOLDER/i,
                /\[\[.*?\]\]/,
                /{{.*?}}/,
                /<your-.*?>/i,
                /example\.com/,
                /test-key/i,
                /mock-.*-id/i,
            ];

            for (const pattern of placeholderPatterns) {
                if (pattern.test(artifact.content)) {
                    artifact.validated = false;
                    artifact.validationErrors = artifact.validationErrors || [];
                    artifact.validationErrors.push(
                        `Placeholder detected: ${pattern.source}`
                    );
                }
            }

            // Check for hallucinated imports
            if (artifact.language === 'typescript' || artifact.language === 'javascript') {
                const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
                let match;
                while ((match = importPattern.exec(artifact.content)) !== null) {
                    const pkg = match[1];
                    // Skip relative imports
                    if (pkg.startsWith('.') || pkg.startsWith('/')) continue;

                    // Check if package exists in context
                    const knownPackages = this.sharedContext.development.packages.map(p => p.name);
                    if (!knownPackages.includes(pkg.split('/')[0])) {
                        // Package needs to be added
                        this.sharedContext.development.packages.push({
                            name: pkg.split('/')[0],
                            version: 'latest',
                            dev: false,
                        });
                    }
                }
            }

            artifact.validated = artifact.validated ?? true;
        }
    }

    /**
     * Update shared context with new artifacts
     */
    private updateSharedContext(artifacts: Artifact[]): void {
        for (const artifact of artifacts) {
            // Extract and update context based on artifact type
            if (artifact.type === 'config' && artifact.path.includes('design-tokens')) {
                // Parse design tokens
                try {
                    const tokens = JSON.parse(artifact.content);
                    this.sharedContext.design.designTokens = {
                        ...this.sharedContext.design.designTokens,
                        ...tokens,
                    };
                } catch {
                    // Not JSON, might be CSS
                }
            }

            if (artifact.type === 'schema') {
                this.sharedContext.development.schemas[artifact.path] = artifact.content;
            }

            if (artifact.path.includes('routes') || artifact.path.includes('api')) {
                // Extract route definitions (simplified)
                const routePattern = /router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/gi;
                let match;
                while ((match = routePattern.exec(artifact.content)) !== null) {
                    this.sharedContext.development.apiRoutes.push({
                        method: match[1].toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
                        path: match[2],
                        handler: artifact.path,
                        middleware: [],
                        authenticated: artifact.content.includes('auth'),
                    });
                }
            }
        }

        this.emitEvent('context_updated', { context: this.sharedContext });
    }

    /**
     * Run quality gate check
     */
    private async runQualityGate(phase: ExecutionPhase): Promise<void> {
        const qualityQueen = this.queens.get('quality');
        if (!qualityQueen) return;

        this.log('info', `Running quality gate for phase: ${phase.name}`);

        const allArtifacts = phase.tasks.flatMap(t => t.artifacts);

        const issues: QualityIssue[] = [];

        for (const artifact of allArtifacts) {
            if (!artifact.validated) {
                issues.push({
                    id: uuidv4(),
                    severity: 'high',
                    category: 'code-quality',
                    message: `Artifact ${artifact.path} failed validation`,
                    file: artifact.path,
                    suggestion: artifact.validationErrors?.join(', '),
                });
            }
        }

        this.sharedContext.quality.criticalIssues = issues.filter(i => i.severity === 'critical');
        this.sharedContext.quality.warnings = issues.filter(i => i.severity !== 'critical');

        if (issues.some(i => i.severity === 'critical')) {
            this.emitEvent('quality_gate_failed', { phase: phase.name, issues });
            throw new Error(`Quality gate failed for phase ${phase.name}`);
        }

        this.emitEvent('quality_gate_passed', { phase: phase.name });
    }

    /**
     * Find a task by ID
     */
    private findTaskById(taskId: string): Task | undefined {
        for (const phase of this.currentPlan?.phases || []) {
            for (const task of phase.tasks) {
                if (task.id === taskId) return task;
            }
        }
        return undefined;
    }

    /**
     * Get capabilities for a queen agent type
     */
    private getQueenCapabilities(type: AgentType): string[] {
        const capabilities: Record<AgentType, string[]> = {
            infrastructure_queen: ['vpc_provisioning', 'database_setup', 'security_config', 'ci_cd'],
            development_queen: ['api_development', 'frontend_components', 'auth_integration', 'testing'],
            design_queen: ['design_system', 'animations', 'responsive_design', 'accessibility'],
            quality_queen: ['code_review', 'testing', 'security_audit', 'performance_analysis'],
            // Workers inherit from queens
            vpc_architect: ['vpc_design', 'networking'],
            database_engineer: ['schema_design', 'migrations'],
            security_specialist: ['iam_policies', 'secrets_management'],
            deploy_master: ['ci_cd', 'docker', 'kubernetes'],
            api_engineer: ['rest_api', 'graphql', 'validation'],
            frontend_engineer: ['react', 'nextjs', 'state_management'],
            auth_specialist: ['oauth', 'jwt', 'rbac'],
            integration_engineer: ['third_party_apis', 'webhooks'],
            ui_architect: ['component_library', 'design_tokens'],
            motion_designer: ['framer_motion', 'transitions'],
            responsive_engineer: ['mobile_first', 'breakpoints'],
            a11y_specialist: ['wcag', 'screen_readers', 'keyboard_nav'],
            test_engineer: ['unit_tests', 'integration_tests'],
            e2e_tester: ['playwright', 'cypress'],
            code_reviewer: ['code_quality', 'best_practices'],
            security_auditor: ['vulnerability_scanning', 'penetration_testing'],
        };
        return capabilities[type] || [];
    }

    /**
     * Emit an orchestrator event
     */
    private emitEvent(type: OrchestratorEventType, data: unknown): void {
        const event: OrchestratorEvent = {
            id: uuidv4(),
            type,
            timestamp: new Date(),
            data,
        };
        this.emit('event', event);
        this.emit(type, event);
    }

    /**
     * Log a message
     */
    private log(level: 'info' | 'error' | 'warning', message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [ORCHESTRATOR] [${level.toUpperCase()}] ${message}`);
        this.emit('log', { level, message, timestamp });
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Get current execution plan
     */
    getPlan(): ExecutionPlan | null {
        return this.currentPlan;
    }

    /**
     * Get all agents
     */
    getAgents(): Agent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get shared context
     */
    getContext(): SharedContext {
        return this.sharedContext;
    }

    /**
     * Pause execution
     */
    pause(): void {
        this.isRunning = false;
        this.log('info', 'Execution paused');
    }

    /**
     * Resume execution
     */
    async resume(): Promise<void> {
        if (this.currentPlan && this.currentPlan.status === 'in_progress') {
            this.isRunning = true;
            this.log('info', 'Execution resumed');
            await this.executePlan();
        }
    }

    /**
     * Stop and cleanup
     */
    async stop(): Promise<void> {
        this.isRunning = false;
        this.agents.clear();
        this.queens.clear();
        this.taskQueue = [];
        this.log('info', 'Orchestrator stopped');
    }
}

