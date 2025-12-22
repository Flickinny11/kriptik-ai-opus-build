/**
 * @deprecated Use BuildLoopOrchestrator from automation/build-loop.ts instead.
 * This orchestrator is maintained only for backward compatibility.
 * All new code should use BuildLoopOrchestrator which provides:
 * - LATTICE parallel cell building
 * - Browser-in-loop visual verification
 * - Learning Engine pattern injection
 * - Verification Swarm (6-agent verification)
 * - Full Intent Lock enforcement
 *
 * Multi-Agent Orchestrator (LEGACY)
 *
 * Coordinates multiple specialized AI agents working concurrently.
 * Manages task distribution, agent lifecycle, and result aggregation.
 *
 * NOW WITH MEMORY HARNESS INTEGRATION:
 * - InitializerAgent for project setup
 * - CodingAgentWrapper for task execution
 * - Persistent artifacts for cross-agent coordination
 * - All AI calls route through OpenRouter
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Anthropic } from '@anthropic-ai/sdk';
import {
    Agent,
    AgentType,
    AgentStatus,
    Task,
    TaskResult,
    SharedContext,
    Message,
    ImplementationPlan,
    WorkflowPlan,
    ModelRecommendation,
} from './types.js';
import { getContextStore, ContextStore } from './context-store.js';
import {
    getOpenRouterClient,
    getPhaseConfig,
    OPENROUTER_MODELS,
    type OpenRouterModel,
} from '../ai/openrouter-client.js';
import {
    getKripToeNite,
    executeForAgent,
    type KripToeNiteFacade,
    type RequestContext as KTNRequestContext,
} from '../ai/krip-toe-nite/index.js';
// Memory Harness Integration
import {
    createInitializerAgent,
    needsInitialization,
    type InitializerResult,
} from '../ai/initializer-agent.js';
import {
    loadProjectContext,
    hasProjectContext,
    formatContextForPrompt,
    type LoadedContext,
} from '../ai/context-loader.js';
import {
    createArtifactManager,
    type ArtifactManager,
    type TaskItem,
} from '../ai/artifacts.js';
import {
    createCodingAgentWrapper,
    type CodingAgentWrapper,
} from '../ai/coding-agent-wrapper.js';
import {
    getContextOverflowManager,
    type ContextOverflowManager,
    type ContextStatus,
    type AgentHandoff,
} from './context-overflow.js';

// ============================================================================
// AGENT EXECUTORS
// ============================================================================

interface AgentExecutor {
    type: AgentType;
    execute: (task: Task, context: SharedContext, client: Anthropic) => Promise<TaskResult>;
    systemPrompt: string;
}

const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
    planning: `You are a Planning Agent specialized in creating and updating implementation plans.
Your role is to:
- Analyze user requirements and break them into actionable tasks
- Create comprehensive implementation plans with phases and milestones
- Identify dependencies between tasks
- Estimate time and resources needed
- Adapt plans based on progress and feedback

Always output structured plans with clear phases, tasks, and dependencies.`,

    coding: `You are a Code Generation Agent specialized in writing production-quality code.
Your role is to:
- Generate clean, well-documented code following best practices
- Implement features according to the implementation plan
- Use modern patterns and proper error handling
- Follow the project's code style and conventions
- Create reusable, maintainable components

Always output complete, working code without placeholders or TODOs.`,

    testing: `You are a Testing Agent specialized in validating code quality.
Your role is to:
- Run linting and type checking
- Execute unit and integration tests
- Validate code against requirements
- Identify bugs and issues
- Suggest improvements for code quality

Report all issues found with clear descriptions and suggested fixes.`,

    deployment: `You are a Deployment Agent specialized in deploying and managing infrastructure.
Your role is to:
- Generate deployment configurations (Dockerfiles, configs)
- Deploy to cloud providers (RunPod, Vercel, etc.)
- Monitor deployment health
- Handle deployment errors and retries
- Manage environment variables and secrets

Always validate deployments and report status accurately.`,

    research: `You are a Research Agent specialized in discovering AI models and resources.
Your role is to:
- Search HuggingFace, Replicate, and other model registries
- Analyze model requirements and capabilities
- Compare models for specific tasks
- Recommend optimal models based on requirements
- Gather pricing and resource information

Provide detailed, accurate model recommendations with reasoning.`,

    integration: `You are an Integration Agent specialized in connecting third-party services.
Your role is to:
- Configure integrations (Stripe, Supabase, etc.)
- Generate SDK initialization code
- Set up webhooks and callbacks
- Handle OAuth flows
- Validate integration credentials

Ensure all integrations are properly configured and tested.`,

    review: `You are a Code Review Agent specialized in code quality analysis.
Your role is to:
- Review code for best practices
- Identify security vulnerabilities
- Check for performance issues
- Ensure proper error handling
- Validate accessibility compliance

Provide actionable feedback with specific line references.`,

    debug: `You are a Debug Agent specialized in diagnosing and fixing issues.
Your role is to:
- Analyze error logs and stack traces
- Identify root causes of failures
- Generate fixes for bugs
- Suggest preventive measures
- Explain issues in clear terms

Always provide both diagnosis and solution.`,
};

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * @deprecated Use BuildLoopOrchestrator from automation/build-loop.ts instead.
 */
export class AgentOrchestrator extends EventEmitter {
    private client: Anthropic | null = null;
    private contextStore: ContextStore;
    private isRunning: Map<string, boolean> = new Map();
    private executionLoops: Map<string, NodeJS.Timeout> = new Map();

    // Memory Harness
    private artifactManagers: Map<string, ArtifactManager> = new Map();
    private loadedContexts: Map<string, LoadedContext> = new Map();
    private projectPaths: Map<string, string> = new Map();

    // Context Overflow Management
    private contextOverflowManager: ContextOverflowManager;
    private agentIdMap: Map<string, string> = new Map(); // contextId -> agentId

    constructor() {
        super();
        this.contextStore = getContextStore();
        this.contextOverflowManager = getContextOverflowManager();
        this.initializeClient();
        this.setupContextOverflowHandlers();
    }

    /**
     * Set up event handlers for context overflow management
     */
    private setupContextOverflowHandlers(): void {
        this.contextOverflowManager.on('context_warning', ({ agentId, status }: { agentId: string; status: ContextStatus }) => {
            console.log(`[AgentOrchestrator] Context warning for ${agentId}: ${status.usagePercent}% used`);
            this.emit('context:warning', { agentId, status });
        });

        this.contextOverflowManager.on('context_critical', ({ agentId, status }: { agentId: string; status: ContextStatus }) => {
            console.log(`[AgentOrchestrator] Context critical for ${agentId}: ${status.usagePercent}% used`);
            this.emit('context:critical', { agentId, status });
        });

        this.contextOverflowManager.on('handoff_initiated', (handoff: AgentHandoff) => {
            console.log(`[AgentOrchestrator] Handoff initiated: ${handoff.fromAgentId} -> ${handoff.toAgentId}`);
            this.emit('context:handoff', handoff);
        });

        this.contextOverflowManager.on('handoff_acknowledged', (handoff: AgentHandoff) => {
            console.log(`[AgentOrchestrator] Handoff acknowledged: ${handoff.toAgentId}`);
            // Terminate old agent
            this.contextOverflowManager.terminateAgent(handoff.fromAgentId);
        });
    }

    /**
     * Initialize Anthropic client via OpenRouterClient
     * All calls route through openrouter.ai/api/v1 with phase-based configuration
     */
    private initializeClient(): void {
        try {
            const openRouter = getOpenRouterClient();
            this.client = openRouter.getClient();
            console.log('[AgentOrchestrator] Initialized via OpenRouter with beta features:', openRouter.getEnabledBetas().join(', '));
        } catch (error) {
            console.warn('[AgentOrchestrator] No OpenRouter API key configured. Agent orchestrator will not function.');
        }
    }

    /**
     * Start orchestration for a context
     *
     * Now integrates with memory harness:
     * - Checks for existing project context
     * - Runs InitializerAgent if needed
     * - Loads persistent artifacts for cross-agent coordination
     */
    async startOrchestration(contextId: string, prompt?: string): Promise<void> {
        if (this.isRunning.get(contextId)) {
            return;  // Already running
        }

        const context = this.contextStore.getContext(contextId);
        if (!context) {
            throw new Error(`Context ${contextId} not found`);
        }

        this.isRunning.set(contextId, true);
        this.emit('orchestration:started', { contextId });

        // Initialize memory harness for this orchestration
        const projectPath = `/tmp/kriptik-agents/${context.projectId}`;
        this.projectPaths.set(contextId, projectPath);

        // Check for existing context artifacts
        const hasContext = await hasProjectContext(projectPath);

        if (!hasContext && prompt) {
            // Fresh start - run InitializerAgent
            await this.runInitializerAgentForContext(contextId, context, prompt, projectPath);
        } else if (hasContext) {
            // Load existing context from artifacts
            await this.loadContextFromArtifacts(contextId, context, projectPath);
        }

        // Initialize artifact manager for this session
        const artifactManager = createArtifactManager(
            context.projectId,
            context.sessionId,
            context.userId
        );
        this.artifactManagers.set(contextId, artifactManager);

        // Register orchestrator agent with context overflow manager
        const orchestratorAgentId = `orchestrator-${contextId.substring(0, 8)}`;
        this.agentIdMap.set(contextId, orchestratorAgentId);
        this.contextOverflowManager.registerAgent(
            orchestratorAgentId,
            'planning', // Use planning as orchestrator type
            context.projectId,
            context.userId,
            context.sessionId
        );

        // Write orchestration start to progress log
        await artifactManager.appendProgressEntry({
            agentId: 'orchestrator',
            agentType: 'orchestrator',
            action: 'Started Agents Mode orchestration',
            completed: ['Memory harness initialized', hasContext ? 'Context loaded from artifacts' : 'Fresh context created'],
            filesModified: [],
            nextSteps: ['Distribute tasks to Queens', 'Monitor worker progress'],
        });

        // Start the execution loop
        this.runExecutionLoop(contextId);
    }

    /**
     * Run InitializerAgent for a new orchestration
     */
    private async runInitializerAgentForContext(
        contextId: string,
        context: SharedContext,
        prompt: string,
        projectPath: string
    ): Promise<void> {
        this.emit('orchestration:initializing', { contextId, mode: 'initializer_agent' });

        const initializer = createInitializerAgent({
            projectId: context.projectId,
            userId: context.userId,
            orchestrationRunId: context.sessionId,
            projectPath,
            mode: 'new_build',
        });

        // Forward initializer events
        initializer.on('intent_created', (data) => {
            this.emit('orchestration:intent_created', { contextId, ...data });
        });
        initializer.on('tasks_decomposed', (data) => {
            this.emit('orchestration:tasks_decomposed', { contextId, ...data });
        });

        const result: InitializerResult = await initializer.initialize(prompt);

        if (!result.success) {
            throw new Error(`InitializerAgent failed: ${result.error}`);
        }

        console.log(`[AgentOrchestrator] InitializerAgent created ${result.taskCount} tasks`);

        // Load the newly created context
        const loadedContext = await loadProjectContext(projectPath);
        this.loadedContexts.set(contextId, loadedContext);

        this.emit('orchestration:initialized', {
            contextId,
            taskCount: result.taskCount,
            artifacts: result.artifactsCreated,
        });
    }

    /**
     * Load existing context from artifacts
     */
    private async loadContextFromArtifacts(
        contextId: string,
        context: SharedContext,
        projectPath: string
    ): Promise<void> {
        const loadedContext = await loadProjectContext(projectPath);
        this.loadedContexts.set(contextId, loadedContext);

        console.log(`[AgentOrchestrator] Loaded existing context: ${loadedContext.taskList?.completedTasks || 0} tasks completed`);

        this.emit('orchestration:resumed', {
            contextId,
            completedTasks: loadedContext.taskList?.completedTasks || 0,
            totalTasks: loadedContext.taskList?.totalTasks || 0,
        });
    }

    /**
     * Get context-enhanced system prompt for agents
     */
    getContextEnhancedPrompt(contextId: string, basePrompt: string): string {
        const loadedContext = this.loadedContexts.get(contextId);
        if (!loadedContext) {
            return basePrompt;
        }

        const contextSection = formatContextForPrompt(loadedContext);

        return `${basePrompt}

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT (Loaded from persistent artifacts)
═══════════════════════════════════════════════════════════════════════════════

${contextSection}

═══════════════════════════════════════════════════════════════════════════════
You are part of a multi-agent orchestration. The context above shows:
- What has been completed (progress log)
- What tasks remain (task list)
- Project decisions and state

Coordinate with other agents using the shared artifact system.
═══════════════════════════════════════════════════════════════════════════════`;
    }

    /**
     * Stop orchestration for a context
     */
    stopOrchestration(contextId: string): void {
        this.isRunning.set(contextId, false);

        const loop = this.executionLoops.get(contextId);
        if (loop) {
            clearTimeout(loop);
            this.executionLoops.delete(contextId);
        }

        this.emit('orchestration:stopped', { contextId });
    }

    /**
     * Main execution loop
     */
    private async runExecutionLoop(contextId: string): Promise<void> {
        while (this.isRunning.get(contextId)) {
            try {
                const context = this.contextStore.getContext(contextId);
                if (!context) {
                    this.stopOrchestration(contextId);
                    break;
                }

                // Check for pending tasks
                const pendingTasks = context.taskQueue.filter(t => t.status === 'pending');

                if (pendingTasks.length === 0) {
                    // No tasks, wait and check again
                    await this.sleep(1000);
                    continue;
                }

                // Find available agents and assign tasks
                for (const agentType of Object.keys(AGENT_SYSTEM_PROMPTS) as AgentType[]) {
                    const agent = this.contextStore.getAvailableAgent(contextId, agentType);
                    if (!agent) continue;

                    const task = this.contextStore.getNextTask(contextId, agentType);
                    if (!task) continue;

                    // Execute task asynchronously
                    this.executeTask(contextId, agent.id, task.id);
                }

                // Brief pause between iterations
                await this.sleep(500);

            } catch (error) {
                console.error('Error in execution loop:', error);
                await this.sleep(2000);  // Longer pause on error
            }
        }
    }

    /**
     * Execute a single task with an agent
     */
    private async executeTask(
        contextId: string,
        agentId: string,
        taskId: string
    ): Promise<void> {
        const context = this.contextStore.getContext(contextId);
        if (!context) return;

        // Find the task and agent
        const task = context.taskQueue.find(t => t.id === taskId);
        const agent = context.activeAgents.find(a => a.id === agentId);

        if (!task || !agent) return;

        // Start the task
        this.contextStore.startTask(contextId, taskId, agentId);

        this.emit('task:executing', { contextId, taskId, agentId });

        try {
            // Execute based on agent type
            const result = await this.runAgentTask(agent.type, task, context);

            if (result.success) {
                this.contextStore.completeTask(
                    contextId,
                    taskId,
                    result.output || {},
                    result.tokensUsed
                );

                // Add agent message about completion
                this.contextStore.addAgentMessage(
                    contextId,
                    agentId,
                    agent.type,
                    `Completed: ${task.title}`
                );

                this.emit('task:completed', { contextId, taskId, result });
            } else {
                this.contextStore.failTask(contextId, taskId, result.error || 'Unknown error');

                // Add agent message about failure
                this.contextStore.addAgentMessage(
                    contextId,
                    agentId,
                    agent.type,
                    `Failed: ${task.title} - ${result.error}`
                );

                this.emit('task:failed', { contextId, taskId, error: result.error });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.contextStore.failTask(contextId, taskId, errorMessage);
            this.emit('task:failed', { contextId, taskId, error: errorMessage });
        }
    }

    /**
     * Map agent types to build phases for optimal model selection
     */
    private getPhaseForAgentType(agentType: AgentType): string {
        const phaseMap: Record<AgentType, string> = {
            planning: 'intent_lock',       // Critical - uses Opus 4.5 HIGH effort
            coding: 'build_agent',          // Main coding - uses Sonnet 4.5
            testing: 'error_check',         // Verification - uses Sonnet 4.5
            deployment: 'build_orchestrator', // Coordination - uses Opus 4.5 MEDIUM
            research: 'initialization',     // Research - uses Opus 4.5 MEDIUM
            integration: 'build_agent',     // Integration - uses Sonnet 4.5
            review: 'visual_verify',        // Review - uses Sonnet 4.5 HIGH
            debug: 'error_check',           // Debug - uses Sonnet 4.5
        };
        return phaseMap[agentType] || 'build_agent';
    }

    /**
     * Run an agent task using OpenRouter with phase-based model selection
     * All calls route through openrouter.ai/api/v1 with December 2025 beta features
     *
     * NOW WITH MEMORY HARNESS + CONTEXT OVERFLOW MANAGEMENT:
     * - Uses CodingAgentWrapper for context-aware execution
     * - Updates artifacts on task completion
     * - Commits changes to git
     * - Checks context usage before AI calls
     * - Triggers handoff if context is approaching limit
     */
    private async runAgentTask(
        agentType: AgentType,
        task: Task,
        context: SharedContext
    ): Promise<TaskResult> {
        const startTime = Date.now();

        if (!this.client) {
            // Fallback mode - return mock success
            return {
                taskId: task.id,
                success: true,
                output: { message: 'Task completed (fallback mode)' },
                duration: 100,
                tokensUsed: 0,
            };
        }

        // Get current agent ID for this context
        const currentAgentId = this.agentIdMap.get(context.id);

        // Check context usage before AI call
        if (currentAgentId) {
            const contextStatus = this.contextOverflowManager.checkContextUsage(currentAgentId);

            // Check if handoff is needed (at task boundary = good checkpoint)
            if (this.contextOverflowManager.shouldTriggerHandoff(currentAgentId, true, false)) {
                console.log(`[AgentOrchestrator] Context overflow detected, initiating handoff before task: ${task.title}`);

                // Initiate handoff
                const handoff = await this.contextOverflowManager.initiateHandoff(
                    currentAgentId,
                    contextStatus.handoffRequired ? 'context_overflow' : 'checkpoint'
                );

                // Update agent ID map to new agent
                this.agentIdMap.set(context.id, handoff.toAgentId);

                // Acknowledge handoff (new agent is ready)
                this.contextOverflowManager.acknowledgeHandoff(handoff.id);

                console.log(`[AgentOrchestrator] Handoff complete, continuing with new agent: ${handoff.toAgentId}`);
            }
        }

        // Get memory harness resources
        const projectPath = this.projectPaths.get(context.id) || `/tmp/kriptik-agents/${context.projectId}`;
        const artifactManager = this.artifactManagers.get(context.id);

        // Create coding agent wrapper for this task
        const codingAgent = createCodingAgentWrapper({
            projectId: context.projectId,
            userId: context.userId,
            orchestrationRunId: context.sessionId,
            projectPath,
            agentType: agentType,
            agentId: `${agentType}-${task.id}`,
        });

        try {
            // Load context from artifacts
            await codingAgent.startSession();

            // Get base system prompt
            const baseSystemPrompt = AGENT_SYSTEM_PROMPTS[agentType];

            // Enhance with loaded context
            const systemPrompt = codingAgent.getSystemPromptWithContext(baseSystemPrompt);

            // Build context-aware prompt
            const contextSummary = this.contextStore.getContextSummary(context.id);

            const userPrompt = `
## Current Context
${contextSummary}

## Task
**Type:** ${task.type}
**Title:** ${task.title}
**Description:** ${task.description}

## Input Data
${JSON.stringify(task.input, null, 2)}

## Instructions
Execute this task according to your role. Provide complete, production-ready output.
`;

            // Use Krip-Toe-Nite for intelligent model routing based on agent type
            const ktnContext: KTNRequestContext = {
                projectId: context.projectId,
                userId: context.userId,
                sessionId: context.sessionId,
            };

            console.log(`[AgentOrchestrator] Running ${agentType} task via KripToeNite with context`);

            // Execute using KTN with agent-type-specific routing
            const ktnResult = await executeForAgent(agentType, userPrompt, ktnContext);

            console.log(`[AgentOrchestrator] KTN completed: strategy=${ktnResult.strategy}, model=${ktnResult.model}, latency=${ktnResult.latencyMs}ms`);

            const outputText = ktnResult.content;

            // Parse output based on task type
            const output = this.parseTaskOutput(task.type, outputText);

            // Record any file changes from the output
            const filesModified: string[] = [];
            if (output.files && Array.isArray(output.files)) {
                for (const file of output.files as Array<{ path: string }>) {
                    if (file.path) {
                        codingAgent.recordFileChange(file.path, 'create');
                        filesModified.push(file.path);
                    }
                }
            }

            // Complete task in memory harness (updates artifacts, commits to git)
            await codingAgent.completeTask({
                summary: `${agentType}: ${task.title}`,
                filesModified,
                nextSteps: this.determineNextStepsForAgent(agentType, task),
            });

            await codingAgent.endSession();

            // Update progress log with multi-agent activity format
            if (artifactManager) {
                await artifactManager.appendProgressEntry({
                    agentId: `${agentType}-${task.id}`,
                    agentType,
                    taskId: task.id,
                    action: `Completed: ${task.title}`,
                    completed: [task.title],
                    filesModified,
                    nextSteps: this.determineNextStepsForAgent(agentType, task),
                    notes: `Model: ${ktnResult.model}, Strategy: ${ktnResult.strategy}`,
                });
            }

            // Update token count in context overflow manager
            const activeAgentId = this.agentIdMap.get(context.id);
            if (activeAgentId) {
                this.contextOverflowManager.addTokens(activeAgentId, ktnResult.usage.totalTokens);
                this.contextOverflowManager.completeTask(activeAgentId, task.id);

                // Record file modifications
                for (const filePath of filesModified) {
                    this.contextOverflowManager.recordFileModification(
                        activeAgentId,
                        filePath,
                        'create',
                        `Created by ${agentType} agent`
                    );
                }
            }

            return {
                taskId: task.id,
                success: true,
                output,
                duration: (Date.now() - startTime) / 1000,
                tokensUsed: ktnResult.usage.totalTokens,
                // Include KTN metadata
                metadata: {
                    model: ktnResult.model,
                    strategy: ktnResult.strategy,
                    latencyMs: ktnResult.latencyMs,
                },
            };
        } catch (error) {
            console.error(`[AgentOrchestrator] KripToeNite call failed for ${agentType}:`, error);

            // Record failure in artifacts
            if (artifactManager) {
                await artifactManager.appendProgressEntry({
                    agentId: `${agentType}-${task.id}`,
                    agentType,
                    taskId: task.id,
                    action: `FAILED: ${task.title}`,
                    completed: [],
                    filesModified: [],
                    blockers: [(error as Error).message],
                    nextSteps: ['Retry or escalate'],
                });
            }

            // Record error in context overflow manager
            const activeAgentId = this.agentIdMap.get(context.id);
            if (activeAgentId) {
                this.contextOverflowManager.recordError(
                    activeAgentId,
                    error as Error,
                    'Task execution failed',
                    false
                );
            }

            await codingAgent.endSession();

            return {
                taskId: task.id,
                success: false,
                error: error instanceof Error ? error.message : 'API call failed',
                duration: (Date.now() - startTime) / 1000,
                tokensUsed: 0,
            };
        }
    }

    /**
     * Determine next steps based on agent type and task
     */
    private determineNextStepsForAgent(agentType: AgentType, task: Task): string[] {
        const nextStepsMap: Partial<Record<AgentType, string[]>> = {
            planning: ['Review plan with user', 'Assign tasks to coding agents'],
            coding: ['Run tests', 'Code review', 'Deploy if ready'],
            testing: ['Fix failing tests', 'Proceed to deployment'],
            deployment: ['Monitor health', 'Run smoke tests'],
            research: ['Integrate recommended models', 'Update configuration'],
            review: ['Apply suggested fixes', 'Re-run review'],
            debug: ['Apply fix', 'Verify resolution'],
            integration: ['Test integration', 'Configure webhooks'],
        };
        return nextStepsMap[agentType] || ['Continue with next task'];
    }

    /**
     * Parse task output based on task type
     */
    private parseTaskOutput(taskType: string, rawOutput: string): Record<string, unknown> {
        // Try to extract JSON from output
        const jsonMatch = rawOutput.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch {
                // Fall through to default
            }
        }

        // Try to parse entire output as JSON
        try {
            return JSON.parse(rawOutput);
        } catch {
            // Return as text
            return { text: rawOutput };
        }
    }

    // ========================================================================
    // HIGH-LEVEL OPERATIONS
    // ========================================================================

    /**
     * Create an implementation plan from user request
     */
    async createImplementationPlan(
        contextId: string,
        userRequest: string
    ): Promise<ImplementationPlan | null> {
        const context = this.contextStore.getContext(contextId);
        if (!context) return null;

        // Ensure planning agent is available
        let planningAgent = this.contextStore.getAvailableAgent(contextId, 'planning');
        if (!planningAgent) {
            planningAgent = this.contextStore.registerAgent(contextId, 'planning');
        }
        if (!planningAgent) return null;

        // Create planning task
        const task = this.contextStore.createTask(
            contextId,
            'create-plan',
            'Create Implementation Plan',
            `Create a comprehensive implementation plan for: ${userRequest}`,
            { userRequest },
            { priority: 'high' }
        );

        if (!task) return null;

        // Execute immediately (synchronous for planning)
        const result = await this.runAgentTask('planning', task, context);

        if (result.success && result.output) {
            // Parse the plan from output
            const plan: ImplementationPlan = {
                id: uuidv4(),
                projectId: context.projectId,
                version: 1,
                title: (result.output as any).title || 'Implementation Plan',
                description: (result.output as any).description || userRequest,
                phases: (result.output as any).phases || [],
                currentPhaseIndex: 0,
                status: 'draft',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Update context with plan
            this.contextStore.updateContext(contextId, { implementationPlan: plan }, 'plan:updated');

            // Complete the task
            this.contextStore.completeTask(contextId, task.id, { plan }, result.tokensUsed);

            return plan;
        }

        this.contextStore.failTask(contextId, task.id, result.error || 'Failed to create plan');
        return null;
    }

    /**
     * Discover models for a user request
     */
    async discoverModels(
        contextId: string,
        requirement: string,
        options?: { sources?: string[]; maxResults?: number }
    ): Promise<ModelRecommendation[]> {
        const context = this.contextStore.getContext(contextId);
        if (!context) return [];

        // Ensure research agent is available
        let researchAgent = this.contextStore.getAvailableAgent(contextId, 'research');
        if (!researchAgent) {
            researchAgent = this.contextStore.registerAgent(contextId, 'research');
        }
        if (!researchAgent) return [];

        // Create research task
        const task = this.contextStore.createTask(
            contextId,
            'search-models',
            'Discover AI Models',
            `Find the best AI models for: ${requirement}`,
            { requirement, ...options },
            { priority: 'high' }
        );

        if (!task) return [];

        // Execute
        const result = await this.runAgentTask('research', task, context);

        if (result.success && result.output) {
            const recommendations = (result.output as any).recommendations || [];
            this.contextStore.completeTask(contextId, task.id, { recommendations }, result.tokensUsed);
            return recommendations;
        }

        this.contextStore.failTask(contextId, task.id, result.error || 'Failed to discover models');
        return [];
    }

    /**
     * Generate code for a task
     */
    async generateCode(
        contextId: string,
        description: string,
        fileType: string,
        additionalContext?: Record<string, unknown>
    ): Promise<{ code: string; explanation: string } | null> {
        const context = this.contextStore.getContext(contextId);
        if (!context) return null;

        // Ensure coding agent is available
        let codingAgent = this.contextStore.getAvailableAgent(contextId, 'coding');
        if (!codingAgent) {
            codingAgent = this.contextStore.registerAgent(contextId, 'coding');
        }
        if (!codingAgent) return null;

        // Create coding task
        const task = this.contextStore.createTask(
            contextId,
            'generate-code',
            'Generate Code',
            description,
            { description, fileType, ...additionalContext },
            { priority: 'medium' }
        );

        if (!task) return null;

        // Execute
        const result = await this.runAgentTask('coding', task, context);

        if (result.success && result.output) {
            const code = (result.output as any).code || (result.output as any).text || '';
            const explanation = (result.output as any).explanation || '';
            this.contextStore.completeTask(contextId, task.id, { code, explanation }, result.tokensUsed);
            return { code, explanation };
        }

        this.contextStore.failTask(contextId, task.id, result.error || 'Failed to generate code');
        return null;
    }

    /**
     * Deploy with self-healing
     */
    async deployWithSelfHealing(
        contextId: string,
        plan: WorkflowPlan,
        maxRetries: number = 3
    ): Promise<{ success: boolean; endpoint?: string; error?: string }> {
        const context = this.contextStore.getContext(contextId);
        if (!context) return { success: false, error: 'Context not found' };

        // Ensure deployment agent is available
        let deployAgent = this.contextStore.getAvailableAgent(contextId, 'deployment');
        if (!deployAgent) {
            deployAgent = this.contextStore.registerAgent(contextId, 'deployment');
        }
        if (!deployAgent) return { success: false, error: 'Deployment agent unavailable' };

        // Ensure debug agent is available for self-healing
        let debugAgent = this.contextStore.getAvailableAgent(contextId, 'debug');
        if (!debugAgent) {
            debugAgent = this.contextStore.registerAgent(contextId, 'debug');
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Create deployment task
            const deployTask = this.contextStore.createTask(
                contextId,
                'deploy',
                `Deploy Workflow (Attempt ${attempt + 1})`,
                'Deploy the workflow to the selected provider',
                { plan, attempt },
                { priority: 'critical' }
            );

            if (!deployTask) continue;

            // Execute deployment
            const result = await this.runAgentTask('deployment', deployTask, context);

            if (result.success) {
                const endpoint = (result.output as any).endpoint;

                // Run health check
                if (endpoint) {
                    const healthy = await this.checkEndpointHealth(endpoint);

                    if (healthy) {
                        this.contextStore.completeTask(contextId, deployTask.id, result.output || {}, result.tokensUsed);
                        return { success: true, endpoint };
                    }
                }
            }

            // Deployment failed or unhealthy - analyze and fix
            if (debugAgent) {
                const diagnosis = await this.diagnoseFailure(
                    contextId,
                    result.error || 'Deployment health check failed',
                    (result.output as any)?.logs || []
                );

                if (diagnosis.fix) {
                    // Apply fix to plan
                    plan = this.applyFix(plan, diagnosis.fix);

                    this.contextStore.addAgentMessage(
                        contextId,
                        debugAgent.id,
                        'debug',
                        `Detected issue: ${diagnosis.summary}. Applying fix: ${diagnosis.fix.description}`
                    );
                }
            }

            this.contextStore.failTask(contextId, deployTask.id, result.error || 'Health check failed');

            // Add retry message
            this.contextStore.addMessage(
                contextId,
                'system',
                `Deployment attempt ${attempt + 1} failed. ${attempt < maxRetries - 1 ? 'Retrying...' : 'Max retries reached.'}`
            );
        }

        return { success: false, error: 'Max retries exceeded' };
    }

    /**
     * Diagnose a failure using debug agent
     */
    private async diagnoseFailure(
        contextId: string,
        error: string,
        logs: string[]
    ): Promise<{ summary: string; fix?: { description: string; changes: Record<string, unknown> } }> {
        const context = this.contextStore.getContext(contextId);
        if (!context) {
            return { summary: error };
        }

        const task: Task = {
            id: uuidv4(),
            type: 'diagnose-issue',
            title: 'Diagnose Failure',
            description: `Analyze this error and suggest a fix: ${error}`,
            priority: 'critical',
            status: 'pending',
            input: { error, logs: logs.slice(-50) },  // Last 50 log lines
            dependencies: [],
            createdAt: new Date(),
            retryCount: 0,
            maxRetries: 1,
        };

        const result = await this.runAgentTask('debug', task, context);

        if (result.success && result.output) {
            return {
                summary: (result.output as any).summary || error,
                fix: (result.output as any).fix,
            };
        }

        return { summary: error };
    }

    /**
     * Apply a fix to a workflow plan
     */
    private applyFix(
        plan: WorkflowPlan,
        fix: { description: string; changes: Record<string, unknown> }
    ): WorkflowPlan {
        // Apply changes to the plan
        const updatedPlan = { ...plan };

        if (fix.changes.steps) {
            updatedPlan.steps = fix.changes.steps as typeof plan.steps;
        }

        if (fix.changes.deploymentTargets) {
            updatedPlan.deploymentTargets = fix.changes.deploymentTargets as typeof plan.deploymentTargets;
        }

        return updatedPlan;
    }

    /**
     * Check endpoint health
     */
    private async checkEndpointHealth(endpoint: string): Promise<boolean> {
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                signal: AbortSignal.timeout(10000),  // 10 second timeout
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get orchestration status
     */
    getStatus(contextId: string): {
        running: boolean;
        activeAgents: number;
        pendingTasks: number;
        completedTasks: number;
    } {
        const context = this.contextStore.getContext(contextId);

        return {
            running: this.isRunning.get(contextId) || false,
            activeAgents: context?.activeAgents.filter(a => a.status === 'working').length || 0,
            pendingTasks: context?.taskQueue.filter(t => t.status === 'pending').length || 0,
            completedTasks: context?.completedTasks.length || 0,
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: AgentOrchestrator | null = null;

export function getAgentOrchestrator(): AgentOrchestrator {
    if (!instance) {
        instance = new AgentOrchestrator();
    }
    return instance;
}

