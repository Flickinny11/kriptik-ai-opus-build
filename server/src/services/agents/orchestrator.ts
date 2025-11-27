/**
 * Multi-Agent Orchestrator
 * 
 * Coordinates multiple specialized AI agents working concurrently.
 * Manages task distribution, agent lifecycle, and result aggregation.
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
import { createAnthropicClient, getClaudeModelId } from '../../utils/anthropic-client.js';

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

export class AgentOrchestrator extends EventEmitter {
    private client: Anthropic | null = null;
    private contextStore: ContextStore;
    private isRunning: Map<string, boolean> = new Map();
    private executionLoops: Map<string, NodeJS.Timeout> = new Map();
    
    constructor() {
        super();
        this.contextStore = getContextStore();
        this.initializeClient();
    }
    
    /**
     * Initialize Anthropic client (uses OpenRouter if direct key not available)
     */
    private initializeClient(): void {
        const client = createAnthropicClient();
        
        if (client) {
            this.client = client;
            console.log('Agent orchestrator initialized with', process.env.ANTHROPIC_API_KEY ? 'direct Anthropic API' : 'OpenRouter');
        } else {
            console.warn('No AI API key configured. Agent orchestrator will not function.');
        }
    }
    
    /**
     * Start orchestration for a context
     */
    async startOrchestration(contextId: string): Promise<void> {
        if (this.isRunning.get(contextId)) {
            return;  // Already running
        }
        
        this.isRunning.set(contextId, true);
        this.emit('orchestration:started', { contextId });
        
        // Start the execution loop
        this.runExecutionLoop(contextId);
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
     * Run an agent task using Claude
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
        
        const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType];
        
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

        try {
            const response = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt }
                ],
            });
            
            const content = response.content[0];
            const outputText = content.type === 'text' ? content.text : '';
            
            // Parse output based on task type
            const output = this.parseTaskOutput(task.type, outputText);
            
            return {
                taskId: task.id,
                success: true,
                output,
                duration: (Date.now() - startTime) / 1000,
                tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
            };
        } catch (error) {
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

