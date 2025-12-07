/**
 * Developer Mode Agent Service
 *
 * Manages individual AI agents for Developer Mode.
 * Each agent:
 * - Has its own task, model, and configuration
 * - Works in isolated git worktree
 * - Has sandbox preview environment
 * - Tracks progress and logs in real-time
 * - Goes through verification before merge
 *
 * Uses existing OpenRouter client and integrates with
 * the Verification Swarm for quality assurance.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import {
    developerModeAgents,
    developerModeAgentLogs,
    developerModeSessions,
    developerModeCreditTransactions,
    buildIntents,
    projects,
    files,
} from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { OpenRouterClient, OPENROUTER_MODELS, EffortLevel } from '../ai/openrouter-client.js';
import { Anthropic } from '@anthropic-ai/sdk';

// =============================================================================
// TYPES
// =============================================================================

export type AgentStatus = 'idle' | 'running' | 'completed' | 'waiting' | 'failed' | 'paused';

export type AgentModel =
    | 'claude-opus-4-5'
    | 'claude-sonnet-4-5'
    | 'claude-haiku-3-5'
    | 'gpt-5-codex'
    | 'gemini-2-5-pro'
    | 'deepseek-r1';

export interface AgentConfig {
    sessionId: string;
    projectId: string;
    userId: string;
    agentNumber: number;
    name: string;
    model: AgentModel;
    effortLevel?: EffortLevel;
    thinkingBudget?: number;
    verificationMode?: 'quick' | 'standard' | 'thorough' | 'full_swarm';
}

export interface AgentTaskConfig {
    taskPrompt: string;
    createIntentLock?: boolean;
    files?: string[]; // Specific files to work on
    context?: string; // Additional context
}

export interface AgentProgress {
    progress: number;
    currentStep: string;
    stepsCompleted: number;
    stepsTotal: number;
    tokensUsed: number;
    creditsUsed: number;
}

export interface AgentLogEntry {
    id: string;
    agentId: string;
    logType: 'action' | 'thought' | 'code' | 'verification' | 'error' | 'warning' | 'info' | 'debug';
    level: 'debug' | 'info' | 'warning' | 'error';
    message: string;
    details?: {
        code?: string;
        file?: string;
        line?: number;
        thinking?: string;
        toolCall?: string;
        toolResult?: string;
        verification?: object;
    };
    phase?: string;
    stepNumber?: number;
    durationMs?: number;
    createdAt: Date;
}

export interface Agent {
    id: string;
    sessionId: string;
    projectId: string;
    userId: string;
    agentNumber: number;
    name: string;
    status: AgentStatus;
    model: AgentModel;
    effortLevel: EffortLevel;
    thinkingBudget: number;
    taskPrompt?: string;
    intentLockId?: string;
    progress: AgentProgress;
    verificationMode?: string;
    verificationPassed?: boolean;
    verificationScore?: number;
    mergeStatus?: string;
    worktreePath?: string;
    branchName?: string;
    sandboxId?: string;
    sandboxUrl?: string;
    lastError?: string;
    errorCount: number;
    escalationLevel: number;
    createdAt: Date;
    updatedAt: Date;
}

// Map our model names to OpenRouter model IDs
const MODEL_MAP: Record<AgentModel, string> = {
    'claude-opus-4-5': OPENROUTER_MODELS.OPUS_4_5,
    'claude-sonnet-4-5': OPENROUTER_MODELS.SONNET_4_5,
    'claude-haiku-3-5': OPENROUTER_MODELS.HAIKU_3_5,
    'gpt-5-codex': OPENROUTER_MODELS.GPT_4O, // Fallback for now
    'gemini-2-5-pro': OPENROUTER_MODELS.GEMINI_2_FLASH,
    'deepseek-r1': OPENROUTER_MODELS.DEEPSEEK_V3,
};

// Default thinking budgets by model
const MODEL_THINKING_BUDGETS: Record<AgentModel, number> = {
    'claude-opus-4-5': 64000,
    'claude-sonnet-4-5': 32000,
    'claude-haiku-3-5': 4000,
    'gpt-5-codex': 0, // GPT doesn't use thinking
    'gemini-2-5-pro': 0,
    'deepseek-r1': 16000,
};

// Credit costs per 1M tokens (approximate)
const MODEL_CREDIT_RATES: Record<AgentModel, { input: number; output: number }> = {
    'claude-opus-4-5': { input: 15, output: 75 },
    'claude-sonnet-4-5': { input: 3, output: 15 },
    'claude-haiku-3-5': { input: 0.8, output: 4 },
    'gpt-5-codex': { input: 5, output: 15 },
    'gemini-2-5-pro': { input: 2.5, output: 10 },
    'deepseek-r1': { input: 0.5, output: 2 },
};

// =============================================================================
// AGENT SYSTEM PROMPT
// =============================================================================

const DEVELOPER_MODE_AGENT_SYSTEM_PROMPT = `You are a specialized Developer Mode Agent for KripTik AI.

Your role is to implement specific features or fix issues in an existing codebase.
You work autonomously but your code will be verified before merging.

CRITICAL RULES:
1. NO PLACEHOLDERS - Every piece of code must be complete and functional
2. NO MOCK DATA - Use real implementations, not dummy data
3. NO TODOS - Don't leave any TODO comments, implement everything now
4. PRODUCTION QUALITY - Write code as if it's going straight to production
5. FOLLOW EXISTING PATTERNS - Match the codebase's style and conventions

When implementing:
1. First analyze the existing code structure
2. Plan your changes carefully
3. Implement complete, working code
4. Consider edge cases and error handling
5. Add appropriate TypeScript types

For each file change, provide:
- The file path
- The complete new content or specific changes
- Explanation of what was changed and why

Remember: Your code will go through a 6-agent verification swarm before merge.
Quality matters more than speed.`;

// =============================================================================
// AGENT SERVICE
// =============================================================================

export class DeveloperModeAgentService extends EventEmitter {
    private openRouterClient: OpenRouterClient;
    private runningAgents: Map<string, AbortController> = new Map();

    constructor() {
        super();
        this.openRouterClient = new OpenRouterClient();
    }

    /**
     * Create a new agent in a Developer Mode session
     */
    async createAgent(config: AgentConfig): Promise<Agent> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const thinkingBudget = config.thinkingBudget ?? MODEL_THINKING_BUDGETS[config.model];
        const effortLevel = config.effortLevel ?? 'medium';
        const verificationMode = config.verificationMode ?? 'standard';

        // Insert into database
        await db.insert(developerModeAgents).values({
            id,
            sessionId: config.sessionId,
            projectId: config.projectId,
            userId: config.userId,
            agentNumber: config.agentNumber,
            name: config.name,
            status: 'idle',
            model: config.model,
            effortLevel,
            thinkingBudget,
            verificationMode,
            progress: 0,
            stepsCompleted: 0,
            stepsTotal: 0,
            tokensUsed: 0,
            creditsUsed: 0,
            estimatedCredits: 0,
            errorCount: 0,
            escalationLevel: 0,
            createdAt: now,
            updatedAt: now,
        });

        // Update session agent count
        await db
            .update(developerModeSessions)
            .set({
                activeAgentCount: await this.getSessionAgentCount(config.sessionId),
                totalAgentsDeployed: await this.getSessionTotalAgents(config.sessionId),
                updatedAt: now,
            })
            .where(eq(developerModeSessions.id, config.sessionId));

        // Log creation
        await this.addLog(id, config.sessionId, {
            logType: 'info',
            level: 'info',
            message: `Agent "${config.name}" created with model ${config.model}`,
            phase: 'initialization',
        });

        // Emit event
        this.emit('agent:created', { agentId: id, sessionId: config.sessionId });

        return this.getAgent(id) as Promise<Agent>;
    }

    /**
     * Start an agent's task execution
     */
    async startTask(agentId: string, taskConfig: AgentTaskConfig): Promise<void> {
        const agent = await this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        if (agent.status === 'running') {
            throw new Error(`Agent ${agentId} is already running`);
        }

        // Update agent with task
        await db
            .update(developerModeAgents)
            .set({
                taskPrompt: taskConfig.taskPrompt,
                status: 'running',
                progress: 0,
                currentStep: 'Analyzing task...',
                stepsCompleted: 0,
                stepsTotal: 5, // Analyze, Plan, Implement, Verify, Complete
                startedAt: new Date().toISOString(),
                lastActivityAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeAgents.id, agentId));

        // Log task start
        await this.addLog(agentId, agent.sessionId, {
            logType: 'action',
            level: 'info',
            message: `Starting task: ${taskConfig.taskPrompt.substring(0, 100)}...`,
            phase: 'planning',
            stepNumber: 1,
        });

        // Create abort controller for cancellation
        const abortController = new AbortController();
        this.runningAgents.set(agentId, abortController);

        // Emit event
        this.emit('agent:task-started', { agentId, sessionId: agent.sessionId, task: taskConfig.taskPrompt });

        // Execute task in background
        this.executeTask(agentId, agent, taskConfig, abortController.signal).catch(async (error) => {
            console.error(`[DeveloperModeAgentService] Task execution error for ${agentId}:`, error);
            await this.handleError(agentId, error);
        });
    }

    /**
     * Execute the agent's task
     */
    private async executeTask(
        agentId: string,
        agent: Agent,
        taskConfig: AgentTaskConfig,
        signal: AbortSignal
    ): Promise<void> {
        try {
            // Step 1: Analyze existing code
            await this.updateProgress(agentId, 10, 'Analyzing codebase...', 1);
            const projectFiles = await this.getProjectFiles(agent.projectId, taskConfig.files);

            if (signal.aborted) return;

            // Log thought process
            await this.addLog(agentId, agent.sessionId, {
                logType: 'thought',
                level: 'info',
                message: `Analyzing ${projectFiles.length} files to understand the codebase structure`,
                phase: 'analyzing',
            });

            // Step 2: Create implementation plan
            await this.updateProgress(agentId, 20, 'Creating implementation plan...', 2);
            const plan = await this.createImplementationPlan(agent, taskConfig, projectFiles, signal);

            if (signal.aborted) return;

            await this.addLog(agentId, agent.sessionId, {
                logType: 'thought',
                level: 'info',
                message: `Implementation plan: ${plan.steps.length} steps identified`,
                details: { thinking: plan.reasoning },
                phase: 'planning',
            });

            // Step 3: Implement changes
            await this.updateProgress(agentId, 30, 'Implementing changes...', 3);

            const totalSteps = plan.steps.length;
            let completedSteps = 0;

            for (const step of plan.steps) {
                if (signal.aborted) return;

                completedSteps++;
                const stepProgress = 30 + ((completedSteps / totalSteps) * 50);
                await this.updateProgress(
                    agentId,
                    stepProgress,
                    `Implementing: ${step.description}`,
                    3,
                    totalSteps + 2, // +2 for verify and complete
                    completedSteps + 2  // +2 for analyze and plan
                );

                const result = await this.implementStep(agent, step, projectFiles, signal);

                await this.addLog(agentId, agent.sessionId, {
                    logType: 'code',
                    level: 'info',
                    message: `Implemented: ${step.description}`,
                    details: {
                        file: result.file,
                        code: result.code.substring(0, 500) + (result.code.length > 500 ? '...' : ''),
                    },
                    phase: 'implementing',
                    stepNumber: completedSteps,
                });

                // Update file in project
                await this.updateProjectFile(agent.projectId, result.file, result.code);
            }

            if (signal.aborted) return;

            // Step 4: Self-verification
            await this.updateProgress(agentId, 85, 'Running self-verification...', 4);
            const verificationResult = await this.runSelfVerification(agent, taskConfig, signal);

            await this.addLog(agentId, agent.sessionId, {
                logType: 'verification',
                level: verificationResult.passed ? 'info' : 'warning',
                message: verificationResult.passed
                    ? `Self-verification passed with score ${verificationResult.score}`
                    : `Self-verification found ${verificationResult.issues.length} issues`,
                details: { verification: verificationResult },
                phase: 'verifying',
            });

            // Step 5: Complete
            await this.updateProgress(agentId, 100, 'Task completed', 5, 5, 5);

            // Calculate final tokens and credits
            const tokenUsage = this.calculateTokenUsage(plan, completedSteps);
            const credits = this.calculateCredits(agent.model, tokenUsage);

            // Record credit transaction
            await this.recordCreditTransaction(agent, tokenUsage, credits, taskConfig.taskPrompt);

            // Update agent status
            await db
                .update(developerModeAgents)
                .set({
                    status: 'completed',
                    progress: 100,
                    currentStep: 'Task completed',
                    stepsCompleted: 5,
                    completedAt: new Date().toISOString(),
                    lastActivityAt: new Date().toISOString(),
                    tokensUsed: tokenUsage.total,
                    creditsUsed: credits,
                    verificationPassed: verificationResult.passed,
                    verificationScore: verificationResult.score,
                    lastVerificationAt: new Date().toISOString(),
                    mergeStatus: 'pending',
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(developerModeAgents.id, agentId));

            // Emit completion event
            this.emit('agent:task-completed', {
                agentId,
                sessionId: agent.sessionId,
                success: true,
                verificationScore: verificationResult.score,
            });

            await this.addLog(agentId, agent.sessionId, {
                logType: 'info',
                level: 'info',
                message: `Task completed successfully. Credits used: ${credits}`,
                phase: 'completed',
            });

        } finally {
            this.runningAgents.delete(agentId);
        }
    }

    /**
     * Create implementation plan using AI
     */
    private async createImplementationPlan(
        agent: Agent,
        taskConfig: AgentTaskConfig,
        projectFiles: Array<{ path: string; content: string }>,
        signal: AbortSignal
    ): Promise<{ steps: Array<{ description: string; file: string; type: string }>; reasoning: string }> {
        const client = this.openRouterClient.withContext({
            userId: agent.userId,
            projectId: agent.projectId,
            agentType: 'developer_mode',
            phase: 'planning',
        });

        const fileList = projectFiles.map(f => f.path).join('\n');
        const relevantFiles = projectFiles.slice(0, 10).map(f => `--- ${f.path} ---\n${f.content.substring(0, 1000)}`).join('\n\n');

        const response = await client.messages.create({
            model: MODEL_MAP[agent.model],
            max_tokens: 4096,
            system: DEVELOPER_MODE_AGENT_SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `Create an implementation plan for this task:

TASK: ${taskConfig.taskPrompt}

${taskConfig.context ? `ADDITIONAL CONTEXT: ${taskConfig.context}` : ''}

PROJECT FILES:
${fileList}

SAMPLE FILE CONTENTS:
${relevantFiles}

Respond with a JSON object containing:
{
  "reasoning": "Your analysis of the task and approach",
  "steps": [
    {
      "description": "What this step does",
      "file": "path/to/file.ts",
      "type": "create" | "modify" | "delete"
    }
  ]
}

Keep steps focused and minimal. Each step should modify exactly one file.`,
                },
            ],
        });

        // Parse response
        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type');
        }

        try {
            // Extract JSON from response (might be wrapped in markdown)
            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            // Fallback plan
            return {
                reasoning: 'Could not parse detailed plan, using fallback',
                steps: [
                    {
                        description: 'Implement requested changes',
                        file: 'src/index.ts',
                        type: 'modify',
                    },
                ],
            };
        }
    }

    /**
     * Implement a single step using AI
     */
    private async implementStep(
        agent: Agent,
        step: { description: string; file: string; type: string },
        projectFiles: Array<{ path: string; content: string }>,
        signal: AbortSignal
    ): Promise<{ file: string; code: string }> {
        const client = this.openRouterClient.withContext({
            userId: agent.userId,
            projectId: agent.projectId,
            agentType: 'developer_mode',
            phase: 'implementing',
        });

        const existingFile = projectFiles.find(f => f.path === step.file);
        const existingContent = existingFile?.content || '';

        const response = await client.messages.create({
            model: MODEL_MAP[agent.model],
            max_tokens: 8192,
            system: DEVELOPER_MODE_AGENT_SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `Implement this step:

STEP: ${step.description}
FILE: ${step.file}
ACTION: ${step.type}

${existingContent ? `EXISTING FILE CONTENT:\n\`\`\`\n${existingContent}\n\`\`\`` : 'This is a new file.'}

Provide the complete file content. Do not use placeholders or TODOs.
Respond with ONLY the file content, no explanations or markdown.`,
                },
            ],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type');
        }

        // Clean up response - remove markdown code blocks if present
        let code = content.text;
        const codeBlockMatch = code.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            code = codeBlockMatch[1];
        }

        return { file: step.file, code: code.trim() };
    }

    /**
     * Run self-verification on completed work
     */
    private async runSelfVerification(
        agent: Agent,
        taskConfig: AgentTaskConfig,
        signal: AbortSignal
    ): Promise<{ passed: boolean; score: number; issues: string[] }> {
        const client = this.openRouterClient.withContext({
            userId: agent.userId,
            projectId: agent.projectId,
            agentType: 'developer_mode',
            phase: 'verification',
        });

        // Get updated project files
        const projectFiles = await this.getProjectFiles(agent.projectId, taskConfig.files);

        const response = await client.messages.create({
            model: MODEL_MAP['claude-haiku-3-5'], // Use Haiku for quick verification
            max_tokens: 2048,
            system: `You are a code verification agent. Analyze code for:
1. Completeness - No TODOs, placeholders, or unfinished code
2. Correctness - Code matches the intended functionality
3. Quality - Follows best practices and conventions
4. Security - No exposed secrets or vulnerabilities

Respond with JSON: { "passed": boolean, "score": 0-100, "issues": ["issue1", "issue2"] }`,
            messages: [
                {
                    role: 'user',
                    content: `Verify this implementation:

TASK: ${taskConfig.taskPrompt}

FILES:
${projectFiles.map(f => `--- ${f.path} ---\n${f.content.substring(0, 2000)}`).join('\n\n')}`,
                },
            ],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            return { passed: false, score: 0, issues: ['Verification failed'] };
        }

        try {
            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { passed: false, score: 0, issues: ['Could not parse verification'] };
            }
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            return { passed: false, score: 50, issues: ['Could not parse verification result'] };
        }
    }

    /**
     * Stop a running agent
     */
    async stopAgent(agentId: string): Promise<void> {
        const controller = this.runningAgents.get(agentId);
        if (controller) {
            controller.abort();
            this.runningAgents.delete(agentId);
        }

        await db
            .update(developerModeAgents)
            .set({
                status: 'paused',
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeAgents.id, agentId));

        const agent = await this.getAgent(agentId);
        if (agent) {
            await this.addLog(agentId, agent.sessionId, {
                logType: 'warning',
                level: 'warning',
                message: 'Agent stopped by user',
            });

            this.emit('agent:stopped', { agentId, sessionId: agent.sessionId });
        }
    }

    /**
     * Resume a paused agent
     */
    async resumeAgent(agentId: string): Promise<void> {
        const agent = await this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        if (agent.status !== 'paused') {
            throw new Error(`Agent ${agentId} is not paused`);
        }

        if (!agent.taskPrompt) {
            throw new Error(`Agent ${agentId} has no task to resume`);
        }

        // Restart the task
        await this.startTask(agentId, { taskPrompt: agent.taskPrompt });
    }

    /**
     * Rename an agent
     */
    async renameAgent(agentId: string, newName: string): Promise<void> {
        await db
            .update(developerModeAgents)
            .set({
                name: newName,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeAgents.id, agentId));

        this.emit('agent:renamed', { agentId, name: newName });
    }

    /**
     * Change an agent's model
     */
    async changeModel(agentId: string, model: AgentModel): Promise<void> {
        const thinkingBudget = MODEL_THINKING_BUDGETS[model];

        await db
            .update(developerModeAgents)
            .set({
                model,
                thinkingBudget,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeAgents.id, agentId));

        this.emit('agent:model-changed', { agentId, model });
    }

    /**
     * Delete an agent
     */
    async deleteAgent(agentId: string): Promise<void> {
        // Stop if running
        await this.stopAgent(agentId);

        // Delete logs first (foreign key)
        await db.delete(developerModeAgentLogs).where(eq(developerModeAgentLogs.agentId, agentId));

        // Delete agent
        await db.delete(developerModeAgents).where(eq(developerModeAgents.id, agentId));

        this.emit('agent:deleted', { agentId });
    }

    /**
     * Get an agent by ID
     */
    async getAgent(agentId: string): Promise<Agent | null> {
        const result = await db.select().from(developerModeAgents).where(eq(developerModeAgents.id, agentId)).limit(1);

        if (result.length === 0) {
            return null;
        }

        const row = result[0];
        return this.mapDbRowToAgent(row);
    }

    /**
     * Get all agents in a session
     */
    async getSessionAgents(sessionId: string): Promise<Agent[]> {
        const results = await db
            .select()
            .from(developerModeAgents)
            .where(eq(developerModeAgents.sessionId, sessionId))
            .orderBy(developerModeAgents.agentNumber);

        return results.map(row => this.mapDbRowToAgent(row));
    }

    /**
     * Get agent logs
     */
    async getAgentLogs(agentId: string, limit = 100): Promise<AgentLogEntry[]> {
        const results = await db
            .select()
            .from(developerModeAgentLogs)
            .where(eq(developerModeAgentLogs.agentId, agentId))
            .orderBy(desc(developerModeAgentLogs.createdAt))
            .limit(limit);

        return results.map(row => ({
            id: row.id,
            agentId: row.agentId,
            logType: row.logType as AgentLogEntry['logType'],
            level: (row.level || 'info') as AgentLogEntry['level'],
            message: row.message,
            details: row.details as AgentLogEntry['details'],
            phase: row.phase ?? undefined,
            stepNumber: row.stepNumber ?? undefined,
            durationMs: row.durationMs ?? undefined,
            createdAt: new Date(row.createdAt),
        }));
    }

    // =============================================================================
    // PRIVATE HELPERS
    // =============================================================================

    private mapDbRowToAgent(row: typeof developerModeAgents.$inferSelect): Agent {
        return {
            id: row.id,
            sessionId: row.sessionId,
            projectId: row.projectId,
            userId: row.userId,
            agentNumber: row.agentNumber,
            name: row.name,
            status: row.status as AgentStatus,
            model: row.model as AgentModel,
            effortLevel: (row.effortLevel || 'medium') as EffortLevel,
            thinkingBudget: row.thinkingBudget || 8000,
            taskPrompt: row.taskPrompt ?? undefined,
            intentLockId: row.intentLockId ?? undefined,
            progress: {
                progress: row.progress || 0,
                currentStep: row.currentStep || '',
                stepsCompleted: row.stepsCompleted || 0,
                stepsTotal: row.stepsTotal || 0,
                tokensUsed: row.tokensUsed || 0,
                creditsUsed: row.creditsUsed || 0,
            },
            verificationMode: row.verificationMode ?? undefined,
            verificationPassed: row.verificationPassed ?? undefined,
            verificationScore: row.verificationScore ?? undefined,
            mergeStatus: row.mergeStatus ?? undefined,
            worktreePath: row.worktreePath ?? undefined,
            branchName: row.branchName ?? undefined,
            sandboxId: row.sandboxId ?? undefined,
            sandboxUrl: row.sandboxUrl ?? undefined,
            lastError: row.lastError ?? undefined,
            errorCount: row.errorCount || 0,
            escalationLevel: row.escalationLevel || 0,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        };
    }

    private async updateProgress(
        agentId: string,
        progress: number,
        currentStep: string,
        stepNumber: number,
        stepsTotal = 5,
        stepsCompleted = stepNumber
    ): Promise<void> {
        await db
            .update(developerModeAgents)
            .set({
                progress,
                currentStep,
                stepsCompleted,
                stepsTotal,
                lastActivityAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeAgents.id, agentId));

        this.emit('agent:progress', { agentId, progress, currentStep, stepsCompleted, stepsTotal });
    }

    private async addLog(
        agentId: string,
        sessionId: string,
        log: Omit<AgentLogEntry, 'id' | 'agentId' | 'createdAt'>
    ): Promise<void> {
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.insert(developerModeAgentLogs).values({
            id,
            agentId,
            sessionId,
            logType: log.logType,
            level: log.level,
            message: log.message,
            details: log.details as object,
            phase: log.phase,
            stepNumber: log.stepNumber,
            durationMs: log.durationMs,
            createdAt: now,
        });

        this.emit('agent:log', { agentId, sessionId, log: { ...log, id, agentId, createdAt: new Date(now) } });
    }

    private async handleError(agentId: string, error: Error): Promise<void> {
        const agent = await this.getAgent(agentId);
        if (!agent) return;

        const errorCount = agent.errorCount + 1;

        await db
            .update(developerModeAgents)
            .set({
                status: 'failed',
                lastError: error.message,
                errorCount,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeAgents.id, agentId));

        await this.addLog(agentId, agent.sessionId, {
            logType: 'error',
            level: 'error',
            message: `Task failed: ${error.message}`,
            details: { thinking: error.stack },
        });

        this.emit('agent:error', { agentId, sessionId: agent.sessionId, error: error.message });
    }

    private async getProjectFiles(
        projectId: string,
        specificFiles?: string[]
    ): Promise<Array<{ path: string; content: string }>> {
        let query = db.select().from(files).where(eq(files.projectId, projectId));

        const results = await query;
        let fileList = results.map(f => ({ path: f.path, content: f.content }));

        // Filter to specific files if provided
        if (specificFiles && specificFiles.length > 0) {
            fileList = fileList.filter(f => specificFiles.some(sf => f.path.includes(sf)));
        }

        return fileList;
    }

    private async updateProjectFile(projectId: string, filePath: string, content: string): Promise<void> {
        const existing = await db
            .select()
            .from(files)
            .where(and(eq(files.projectId, projectId), eq(files.path, filePath)))
            .limit(1);

        if (existing.length > 0) {
            await db
                .update(files)
                .set({
                    content,
                    version: existing[0].version + 1,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(files.id, existing[0].id));
        } else {
            await db.insert(files).values({
                id: uuidv4(),
                projectId,
                path: filePath,
                content,
                language: this.detectLanguage(filePath),
                version: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    private detectLanguage(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const langMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescriptreact',
            js: 'javascript',
            jsx: 'javascriptreact',
            css: 'css',
            html: 'html',
            json: 'json',
            md: 'markdown',
        };
        return langMap[ext || ''] || 'plaintext';
    }

    private async getSessionAgentCount(sessionId: string): Promise<number> {
        const result = await db
            .select()
            .from(developerModeAgents)
            .where(
                and(
                    eq(developerModeAgents.sessionId, sessionId),
                    eq(developerModeAgents.status, 'running')
                )
            );
        return result.length;
    }

    private async getSessionTotalAgents(sessionId: string): Promise<number> {
        const result = await db.select().from(developerModeAgents).where(eq(developerModeAgents.sessionId, sessionId));
        return result.length;
    }

    private calculateTokenUsage(
        plan: { steps: Array<{ description: string }> },
        completedSteps: number
    ): { input: number; output: number; thinking: number; total: number } {
        // Rough estimates based on typical usage
        const inputPerStep = 2000;
        const outputPerStep = 3000;
        const planningTokens = 5000;

        return {
            input: planningTokens + completedSteps * inputPerStep,
            output: completedSteps * outputPerStep,
            thinking: 0, // Will add thinking tokens if using extended thinking
            total: planningTokens + completedSteps * (inputPerStep + outputPerStep),
        };
    }

    private calculateCredits(
        model: AgentModel,
        tokens: { input: number; output: number; thinking: number; total: number }
    ): number {
        const rates = MODEL_CREDIT_RATES[model];
        const inputCredits = (tokens.input / 1000000) * rates.input;
        const outputCredits = (tokens.output / 1000000) * rates.output;
        return Math.ceil((inputCredits + outputCredits) * 100); // Credits in cents
    }

    private async recordCreditTransaction(
        agent: Agent,
        tokens: { input: number; output: number; thinking: number; total: number },
        credits: number,
        taskDescription: string
    ): Promise<void> {
        await db.insert(developerModeCreditTransactions).values({
            id: uuidv4(),
            sessionId: agent.sessionId,
            agentId: agent.id,
            userId: agent.userId,
            transactionType: 'agent_call',
            model: agent.model,
            inputTokens: tokens.input,
            outputTokens: tokens.output,
            thinkingTokens: tokens.thinking,
            totalTokens: tokens.total,
            creditsCharged: credits,
            creditRate: JSON.stringify(MODEL_CREDIT_RATES[agent.model]),
            taskDescription: taskDescription.substring(0, 200),
            createdAt: new Date().toISOString(),
        });

        // Update session total
        await db
            .update(developerModeSessions)
            .set({
                creditsUsed: await this.getSessionCredits(agent.sessionId),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeSessions.id, agent.sessionId));
    }

    private async getSessionCredits(sessionId: string): Promise<number> {
        const results = await db
            .select()
            .from(developerModeCreditTransactions)
            .where(eq(developerModeCreditTransactions.sessionId, sessionId));
        return results.reduce((sum, t) => sum + t.creditsCharged, 0);
    }
}

// =============================================================================
// FACTORY
// =============================================================================

let agentService: DeveloperModeAgentService | null = null;

export function getDeveloperModeAgentService(): DeveloperModeAgentService {
    if (!agentService) {
        agentService = new DeveloperModeAgentService();
    }
    return agentService;
}

export function createDeveloperModeAgentService(): DeveloperModeAgentService {
    return new DeveloperModeAgentService();
}

