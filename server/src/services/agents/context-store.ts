/**
 * Shared Context Store
 *
 * Central state management for multi-agent orchestration.
 * Provides real-time synchronization, persistence, and event broadcasting.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    SharedContext,
    Agent,
    AgentType,
    AgentStatus,
    Task,
    TaskStatus,
    TaskPriority,
    Message,
    ContextEvent,
    ContextEventType,
    ContextSubscription,
    ContextCheckpoint,
    ImplementationPlan,
    ProjectState,
    DeploymentState,
    UserPreferences,
    CredentialReference,
    WorkflowState,
} from './types';

// ============================================================================
// CONTEXT STORE
// ============================================================================

export class ContextStore extends EventEmitter {
    private contexts: Map<string, SharedContext> = new Map();
    private subscriptions: Map<string, ContextSubscription[]> = new Map();

    /**
     * Create a new shared context for a project session
     */
    createContext(
        projectId: string,
        userId: string,
        initialState?: Partial<SharedContext>
    ): SharedContext {
        const sessionId = uuidv4();
        const now = new Date();

        const context: SharedContext = {
            id: uuidv4(),
            projectId,
            userId,
            sessionId,

            implementationPlan: null,
            projectState: initialState?.projectState || this.createDefaultProjectState(projectId),

            activeAgents: [],
            taskQueue: [],
            completedTasks: [],

            userPreferences: initialState?.userPreferences || this.createDefaultPreferences(userId),
            credentialVault: [],

            deploymentState: {
                activeDeployments: [],
                pendingDeployments: [],
                deploymentHistory: [],
            },

            conversationHistory: [],
            contextCheckpoints: [],

            createdAt: now,
            updatedAt: now,
            lastActivityAt: now,
            totalTokensUsed: 0,
        };

        this.contexts.set(context.id, context);
        this.emit('context:created', context);

        return context;
    }

    /**
     * Get a context by ID
     */
    getContext(contextId: string): SharedContext | null {
        return this.contexts.get(contextId) || null;
    }

    /**
     * Get context by project and user
     */
    getContextByProject(projectId: string, userId: string): SharedContext | null {
        for (const context of this.contexts.values()) {
            if (context.projectId === projectId && context.userId === userId) {
                return context;
            }
        }
        return null;
    }

    /**
     * Update context and broadcast changes
     */
    updateContext(
        contextId: string,
        updates: Partial<SharedContext>,
        eventType?: ContextEventType
    ): SharedContext | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        const updatedContext: SharedContext = {
            ...context,
            ...updates,
            updatedAt: new Date(),
            lastActivityAt: new Date(),
        };

        this.contexts.set(contextId, updatedContext);

        // Broadcast event
        if (eventType) {
            this.broadcastEvent(contextId, {
                id: uuidv4(),
                type: eventType,
                timestamp: new Date(),
                data: updates,
            });
        }

        return updatedContext;
    }

    // ========================================================================
    // AGENT MANAGEMENT
    // ========================================================================

    /**
     * Register a new agent
     */
    registerAgent(
        contextId: string,
        type: AgentType,
        capabilities: string[] = []
    ): Agent | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        const agent: Agent = {
            id: uuidv4(),
            type,
            name: this.getAgentName(type),
            status: 'idle',
            capabilities: capabilities.map(c => ({
                id: c,
                name: c,
                description: '',
            })),
            tokensUsed: 0,
            errorCount: 0,
        };

        const updatedAgents = [...context.activeAgents, agent];
        this.updateContext(contextId, { activeAgents: updatedAgents }, 'agent:started');

        return agent;
    }

    /**
     * Update agent status
     */
    updateAgentStatus(
        contextId: string,
        agentId: string,
        status: AgentStatus,
        currentTask?: Task
    ): void {
        const context = this.contexts.get(contextId);
        if (!context) return;

        const updatedAgents = context.activeAgents.map(agent => {
            if (agent.id === agentId) {
                return {
                    ...agent,
                    status,
                    currentTask,
                    lastActivityAt: new Date(),
                };
            }
            return agent;
        });

        this.updateContext(contextId, { activeAgents: updatedAgents });
    }

    /**
     * Remove an agent
     */
    removeAgent(contextId: string, agentId: string): void {
        const context = this.contexts.get(contextId);
        if (!context) return;

        const updatedAgents = context.activeAgents.filter(a => a.id !== agentId);
        this.updateContext(contextId, { activeAgents: updatedAgents }, 'agent:completed');
    }

    /**
     * Get available agent for a task type
     */
    getAvailableAgent(contextId: string, type: AgentType): Agent | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        return context.activeAgents.find(
            a => a.type === type && a.status === 'idle'
        ) || null;
    }

    // ========================================================================
    // TASK MANAGEMENT
    // ========================================================================

    /**
     * Create a new task
     */
    createTask(
        contextId: string,
        type: string,
        title: string,
        description: string,
        input: Record<string, unknown> = {},
        options: {
            priority?: TaskPriority;
            dependencies?: string[];
            maxRetries?: number;
        } = {}
    ): Task | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        const task: Task = {
            id: uuidv4(),
            type,
            title,
            description,
            priority: options.priority || 'medium',
            status: 'pending',
            dependencies: options.dependencies || [],
            input,
            createdAt: new Date(),
            retryCount: 0,
            maxRetries: options.maxRetries || 3,
        };

        const updatedQueue = [...context.taskQueue, task];
        this.updateContext(contextId, { taskQueue: updatedQueue }, 'task:created');

        return task;
    }

    /**
     * Start a task
     */
    startTask(contextId: string, taskId: string, agentId: string): Task | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        let task: Task | null = null;

        const updatedQueue = context.taskQueue.map(t => {
            if (t.id === taskId) {
                task = {
                    ...t,
                    status: 'in_progress',
                    assignedAgent: agentId,
                    startedAt: new Date(),
                };
                return task;
            }
            return t;
        });

        if (task) {
            this.updateContext(contextId, { taskQueue: updatedQueue }, 'task:started');
            this.updateAgentStatus(contextId, agentId, 'working', task);
        }

        return task;
    }

    /**
     * Complete a task
     */
    completeTask(
        contextId: string,
        taskId: string,
        output: Record<string, unknown>,
        tokensUsed: number = 0
    ): Task | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        // Find the task to complete
        const taskIndex = context.taskQueue.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return null;

        const originalTask = context.taskQueue[taskIndex];
        
        const completedTask: Task = {
            ...originalTask,
            status: 'completed' as const,
            output,
            completedAt: new Date(),
            actualDuration: originalTask.startedAt
                ? (Date.now() - originalTask.startedAt.getTime()) / 1000
                : undefined,
        };

        // Remove from queue
        const updatedQueue = context.taskQueue.filter((_, index) => index !== taskIndex);
        const updatedCompleted = [...context.completedTasks, completedTask];
        
        this.updateContext(
            contextId,
            {
                taskQueue: updatedQueue,
                completedTasks: updatedCompleted,
                totalTokensUsed: context.totalTokensUsed + tokensUsed,
            },
            'task:completed'
        );

        // Free up the agent
        if (completedTask.assignedAgent) {
            this.updateAgentStatus(contextId, completedTask.assignedAgent, 'idle');
        }

        // Check for dependent tasks that can now start
        this.checkDependentTasks(contextId, taskId);

        return completedTask;
    }

    /**
     * Fail a task
     */
    failTask(contextId: string, taskId: string, error: string): Task | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        const taskIndex = context.taskQueue.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return null;

        const task = context.taskQueue[taskIndex];

        let failedTask: Task;
        if (task.retryCount < task.maxRetries) {
            failedTask = {
                ...task,
                status: 'pending' as const,
                retryCount: task.retryCount + 1,
                error,
            };
        } else {
            failedTask = {
                ...task,
                status: 'failed' as const,
                error,
                completedAt: new Date(),
            };
        }

        const updatedQueue = [...context.taskQueue];
        updatedQueue[taskIndex] = failedTask;

        this.updateContext(contextId, { taskQueue: updatedQueue }, 'task:failed');

        // Free up the agent
        if (failedTask.assignedAgent) {
            this.updateAgentStatus(contextId, failedTask.assignedAgent, 'idle');

            // Increment agent error count
            const ctx = this.contexts.get(contextId);
            if (ctx) {
                const updatedAgents = ctx.activeAgents.map(a => {
                    if (a.id === failedTask.assignedAgent) {
                        return { ...a, errorCount: a.errorCount + 1 };
                    }
                    return a;
                });
                this.updateContext(contextId, { activeAgents: updatedAgents });
            }
        }

        return failedTask;
    }

    /**
     * Get next task for an agent type
     */
    getNextTask(contextId: string, agentType: AgentType): Task | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        // Find pending tasks that match agent type and have no unmet dependencies
        const eligibleTasks = context.taskQueue.filter(task => {
            if (task.status !== 'pending') return false;

            // Check if task type matches agent capabilities
            const taskAgentType = this.getAgentTypeForTask(task.type);
            if (taskAgentType !== agentType) return false;

            // Check dependencies
            const unmetDependencies = task.dependencies.filter(depId => {
                const dep = context.completedTasks.find(t => t.id === depId);
                return !dep || dep.status !== 'completed';
            });

            return unmetDependencies.length === 0;
        });

        // Sort by priority
        const priorityOrder: Record<TaskPriority, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
        };

        eligibleTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return eligibleTasks[0] || null;
    }

    /**
     * Check for dependent tasks that can now be started
     */
    private checkDependentTasks(contextId: string, completedTaskId: string): void {
        const context = this.contexts.get(contextId);
        if (!context) return;

        // Find tasks waiting on this completed task
        const dependentTasks = context.taskQueue.filter(
            t => t.status === 'pending' && t.dependencies.includes(completedTaskId)
        );

        // Update their blocked status
        for (const task of dependentTasks) {
            const stillBlocked = task.dependencies.filter(depId => {
                const dep = context.completedTasks.find(t => t.id === depId);
                return !dep || dep.status !== 'completed';
            });

            if (stillBlocked.length === 0) {
                // Task is no longer blocked
                const updatedQueue = context.taskQueue.map(t => {
                    if (t.id === task.id) {
                        return { ...t, blockedBy: [] };
                    }
                    return t;
                });
                this.updateContext(contextId, { taskQueue: updatedQueue });
            }
        }
    }

    // ========================================================================
    // CONVERSATION MANAGEMENT
    // ========================================================================

    /**
     * Add a message to conversation history
     */
    addMessage(
        contextId: string,
        role: Message['role'],
        content: string,
        metadata?: Record<string, unknown>
    ): Message | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        const message: Message = {
            id: uuidv4(),
            role,
            content,
            timestamp: new Date(),
            metadata,
        };

        const updatedHistory = [...context.conversationHistory, message];
        this.updateContext(contextId, { conversationHistory: updatedHistory });

        return message;
    }

    /**
     * Add an agent message
     */
    addAgentMessage(
        contextId: string,
        agentId: string,
        agentType: AgentType,
        content: string
    ): Message | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        const message: Message = {
            id: uuidv4(),
            role: 'agent',
            content,
            agentId,
            agentType,
            timestamp: new Date(),
        };

        const updatedHistory = [...context.conversationHistory, message];
        this.updateContext(contextId, { conversationHistory: updatedHistory });

        return message;
    }

    /**
     * Get recent conversation history
     */
    getRecentHistory(contextId: string, count: number = 50): Message[] {
        const context = this.contexts.get(contextId);
        if (!context) return [];

        return context.conversationHistory.slice(-count);
    }

    // ========================================================================
    // CONTEXT CHECKPOINTS
    // ========================================================================

    /**
     * Create a context checkpoint for recovery/summarization
     */
    createCheckpoint(contextId: string, summary: string): ContextCheckpoint | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        const checkpoint: ContextCheckpoint = {
            id: uuidv4(),
            timestamp: new Date(),
            summary,
            keyDecisions: this.extractKeyDecisions(context),
            filesModified: this.extractModifiedFiles(context),
            tasksCompleted: context.completedTasks.map(t => t.title),
        };

        const updatedCheckpoints = [...context.contextCheckpoints, checkpoint];
        this.updateContext(contextId, { contextCheckpoints: updatedCheckpoints }, 'context:checkpoint');

        return checkpoint;
    }

    /**
     * Get context summary for continued conversations
     */
    getContextSummary(contextId: string): string {
        const context = this.contexts.get(contextId);
        if (!context) return '';

        const parts: string[] = [];

        // Project info
        parts.push(`Project: ${context.projectState.name} (${context.projectState.framework})`);

        // Current plan status
        if (context.implementationPlan) {
            const plan = context.implementationPlan;
            const currentPhase = plan.phases[plan.currentPhaseIndex];
            parts.push(`Implementation Plan: ${plan.title} - Phase ${plan.currentPhaseIndex + 1}/${plan.phases.length} (${currentPhase?.name || 'Unknown'})`);
        }

        // Active agents
        const workingAgents = context.activeAgents.filter(a => a.status === 'working');
        if (workingAgents.length > 0) {
            parts.push(`Active Agents: ${workingAgents.map(a => a.name).join(', ')}`);
        }

        // Pending tasks
        const pendingTasks = context.taskQueue.filter(t => t.status === 'pending');
        if (pendingTasks.length > 0) {
            parts.push(`Pending Tasks: ${pendingTasks.length}`);
        }

        // Recent checkpoints
        const recentCheckpoint = context.contextCheckpoints[context.contextCheckpoints.length - 1];
        if (recentCheckpoint) {
            parts.push(`Last Checkpoint: ${recentCheckpoint.summary}`);
        }

        // Workflow status
        if (context.activeWorkflow) {
            parts.push(`Workflow: ${context.activeWorkflow.name} (${context.activeWorkflow.status})`);
        }

        return parts.join('\n');
    }

    // ========================================================================
    // EVENT SYSTEM
    // ========================================================================

    /**
     * Subscribe to context events
     */
    subscribe(
        contextId: string,
        eventTypes: ContextEventType[],
        callback: (event: ContextEvent) => void
    ): string {
        const subscription: ContextSubscription = {
            id: uuidv4(),
            eventTypes,
            callback,
        };

        const existing = this.subscriptions.get(contextId) || [];
        this.subscriptions.set(contextId, [...existing, subscription]);

        return subscription.id;
    }

    /**
     * Unsubscribe from context events
     */
    unsubscribe(contextId: string, subscriptionId: string): void {
        const existing = this.subscriptions.get(contextId) || [];
        this.subscriptions.set(
            contextId,
            existing.filter(s => s.id !== subscriptionId)
        );
    }

    /**
     * Broadcast an event to all subscribers
     */
    broadcastEvent(contextId: string, event: ContextEvent): void {
        const subscriptions = this.subscriptions.get(contextId) || [];

        for (const sub of subscriptions) {
            if (sub.eventTypes.includes(event.type) || sub.eventTypes.includes('*' as any)) {
                try {
                    sub.callback(event);
                } catch (error) {
                    console.error('Error in context subscription callback:', error);
                }
            }
        }

        // Also emit on EventEmitter for internal use
        this.emit(event.type, { contextId, event });
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private createDefaultProjectState(projectId: string): ProjectState {
        return {
            id: projectId,
            name: 'New Project',
            framework: 'react',
            files: {},
            dependencies: {},
            environment: {},
            buildStatus: 'idle',
            lastModifiedAt: new Date(),
        };
    }

    private createDefaultPreferences(userId: string): UserPreferences {
        return {
            userId,
            defaultFramework: 'react',
            defaultDeploymentTarget: 'vercel',
            codeStyle: {
                indentation: 'spaces',
                tabSize: 2,
                semicolons: true,
                singleQuotes: true,
            },
            aiPreferences: {
                verbosity: 'detailed',
                autoApprove: false,
                confirmDeployments: true,
            },
            notifications: {
                deploymentComplete: true,
                taskComplete: false,
                errorAlerts: true,
            },
        };
    }

    private getAgentName(type: AgentType): string {
        const names: Record<AgentType, string> = {
            planning: 'Planning Agent',
            coding: 'Code Generator',
            testing: 'Test Runner',
            deployment: 'Deployment Agent',
            research: 'Research Agent',
            integration: 'Integration Agent',
            review: 'Code Reviewer',
            debug: 'Debug Agent',
        };
        return names[type] || 'Agent';
    }

    private getAgentTypeForTask(taskType: string): AgentType {
        const mapping: Record<string, AgentType> = {
            'create-plan': 'planning',
            'update-plan': 'planning',
            'generate-code': 'coding',
            'modify-code': 'coding',
            'run-tests': 'testing',
            'validate-code': 'testing',
            'deploy': 'deployment',
            'monitor-deployment': 'deployment',
            'search-models': 'research',
            'analyze-requirements': 'research',
            'setup-integration': 'integration',
            'configure-service': 'integration',
            'code-review': 'review',
            'quality-check': 'review',
            'fix-error': 'debug',
            'diagnose-issue': 'debug',
        };
        return mapping[taskType] || 'coding';
    }

    private extractKeyDecisions(context: SharedContext): string[] {
        // Extract key decisions from recent messages
        const decisions: string[] = [];
        const recentMessages = context.conversationHistory.slice(-20);

        for (const msg of recentMessages) {
            if (msg.role === 'assistant' && msg.content.includes('decision')) {
                // Simple extraction - in production, use AI summarization
                const sentence = msg.content.split('.').find(s =>
                    s.toLowerCase().includes('decid') ||
                    s.toLowerCase().includes('chose') ||
                    s.toLowerCase().includes('select')
                );
                if (sentence) {
                    decisions.push(sentence.trim());
                }
            }
        }

        return decisions.slice(-5);  // Last 5 decisions
    }

    private extractModifiedFiles(context: SharedContext): string[] {
        return Object.entries(context.projectState.files)
            .filter(([_, file]) => {
                const recentThreshold = Date.now() - 30 * 60 * 1000;  // Last 30 min
                return file.lastModifiedAt.getTime() > recentThreshold;
            })
            .map(([path]) => path);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: ContextStore | null = null;

export function getContextStore(): ContextStore {
    if (!instance) {
        instance = new ContextStore();
    }
    return instance;
}

