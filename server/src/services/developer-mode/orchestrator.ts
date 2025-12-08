/**
 * Developer Mode Orchestrator
 *
 * Coordinates up to 6 concurrent Developer Mode agents.
 * Manages:
 * - Session lifecycle
 * - Agent slot allocation
 * - Task distribution
 * - Dependency coordination
 * - Merge queue management
 * - Credit budget tracking
 *
 * NOW WITH MEMORY HARNESS INTEGRATION:
 * - InitializerAgent for project imports
 * - CodingAgentWrapper for context-aware iterations
 * - Persistent artifacts for session continuity
 * - Unified AI routing via OpenRouter
 *
 * Unlike Ultimate Builder's autonomous orchestration, Developer Mode
 * gives users direct control over each agent while still providing
 * coordination and conflict prevention.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import {
    developerModeSessions,
    developerModeAgents,
    developerModeMergeQueue,
    projects,
    users,
} from '../../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import {
    DeveloperModeAgentService,
    getDeveloperModeAgentService,
    type Agent,
    type AgentConfig,
    type AgentModel,
    type AgentTaskConfig,
} from './agent-service.js';
import { GitBranchManager, createGitBranchManager } from './git-branch-manager.js';
import {
    type EffortLevel,
    getOpenRouterClient,
    getPhaseConfig,
} from '../ai/openrouter-client.js';

// Memory Harness Integration
import {
    createInitializerAgent,
    needsInitialization,
    type InitializerAgent,
} from '../ai/initializer-agent.js';
import {
    createCodingAgentWrapper,
    type CodingAgentWrapper,
    type TaskResult,
} from '../ai/coding-agent-wrapper.js';
import {
    loadProjectContext,
    hasProjectContext,
    type LoadedContext,
} from '../ai/context-loader.js';
import {
    createArtifactManager,
    type ArtifactManager,
    type TaskItem,
} from '../ai/artifacts.js';
import {
    getKripToeNite,
    type KripToeNiteFacade,
} from '../ai/krip-toe-nite/index.js';

// =============================================================================
// TYPES
// =============================================================================

export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';
export type VerificationMode = 'quick' | 'standard' | 'thorough' | 'full_swarm';

export interface SessionConfig {
    projectId: string;
    userId: string;
    defaultModel?: AgentModel;
    verificationMode?: VerificationMode;
    autoMergeEnabled?: boolean;
    baseBranch?: string;
    budgetLimit?: number; // Max credits to spend
}

export interface Session {
    id: string;
    projectId: string;
    userId: string;
    status: SessionStatus;
    startedAt: Date;
    pausedAt?: Date;
    completedAt?: Date;
    maxConcurrentAgents: number;
    activeAgentCount: number;
    defaultModel: AgentModel;
    verificationMode: VerificationMode;
    autoMergeEnabled: boolean;
    creditsUsed: number;
    creditsEstimated: number;
    budgetLimit?: number;
    baseBranch: string;
    workBranch?: string;
    totalAgentsDeployed: number;
    totalTasksCompleted: number;
    totalVerificationPasses: number;
    totalMerges: number;
    agents: Agent[];
    createdAt: Date;
    updatedAt: Date;
}

export interface DeployAgentRequest {
    name: string;
    taskPrompt: string;
    model?: AgentModel;
    effortLevel?: EffortLevel;
    thinkingBudget?: number;
    verificationMode?: VerificationMode;
    files?: string[]; // Specific files to work on
    context?: string; // Additional context
}

export interface MergeQueueItem {
    id: string;
    agentId: string;
    agentName: string;
    status: 'pending' | 'approved' | 'rejected' | 'merged' | 'conflict';
    priority: number;
    sourceBranch: string;
    targetBranch: string;
    filesChanged: number;
    additions: number;
    deletions: number;
    verificationPassed: boolean;
    verificationScore: number;
    createdAt: Date;
}

// =============================================================================
// AGENT COORDINATION MANAGER
// =============================================================================

/**
 * Manages file locks to prevent multiple agents from editing the same file
 * simultaneously, preventing merge conflicts.
 */
class AgentCoordinationManager {
    private activeModifications: Map<string, Set<string>> = new Map(); // agentId -> files
    private fileLocks: Map<string, string> = new Map(); // filePath -> agentId

    /**
     * Attempt to claim files for modification
     * Returns true if all files can be claimed, false if any conflict
     */
    claimFiles(agentId: string, files: string[]): { success: boolean; conflicts: string[] } {
        const conflicts: string[] = [];

        for (const file of files) {
            const lockHolder = this.fileLocks.get(file);
            if (lockHolder && lockHolder !== agentId) {
                conflicts.push(file);
            }
        }

        if (conflicts.length > 0) {
            return { success: false, conflicts };
        }

        // Claim all files
        const agentFiles = this.activeModifications.get(agentId) || new Set();
        for (const file of files) {
            this.fileLocks.set(file, agentId);
            agentFiles.add(file);
        }
        this.activeModifications.set(agentId, agentFiles);

        return { success: true, conflicts: [] };
    }

    /**
     * Release all files held by an agent
     */
    releaseFiles(agentId: string): void {
        const files = this.activeModifications.get(agentId);
        if (files) {
            for (const file of files) {
                if (this.fileLocks.get(file) === agentId) {
                    this.fileLocks.delete(file);
                }
            }
        }
        this.activeModifications.delete(agentId);
    }

    /**
     * Get all files currently locked by any agent
     */
    getLockedFiles(): Map<string, string> {
        return new Map(this.fileLocks);
    }

    /**
     * Check if a specific file is available
     */
    isFileAvailable(filePath: string, forAgentId?: string): boolean {
        const lockHolder = this.fileLocks.get(filePath);
        return !lockHolder || lockHolder === forAgentId;
    }
}

// =============================================================================
// ORCHESTRATOR
// =============================================================================

export class DeveloperModeOrchestrator extends EventEmitter {
    private agentService: DeveloperModeAgentService;
    private activeSessions: Map<string, Session> = new Map();
    private coordinationManager = new AgentCoordinationManager();

    // Memory Harness - Context Loading & Artifact Updates
    private projectArtifacts: Map<string, ArtifactManager> = new Map();
    private projectPaths: Map<string, string> = new Map();
    private loadedContexts: Map<string, LoadedContext> = new Map();
    private openRouterClient: ReturnType<typeof getOpenRouterClient>;
    private ktn: KripToeNiteFacade;

    constructor() {
        super();
        this.agentService = getDeveloperModeAgentService();
        this.openRouterClient = getOpenRouterClient();
        this.ktn = getKripToeNite();

        // Forward agent events
        this.agentService.on('agent:created', (data) => this.emit('agent:created', data));
        this.agentService.on('agent:task-started', (data) => this.emit('agent:task-started', data));
        this.agentService.on('agent:task-completed', (data) => {
            this.coordinationManager.releaseFiles(data.agentId);
            this.handleAgentCompleted(data);
        });
        this.agentService.on('agent:progress', (data) => this.emit('agent:progress', data));
        this.agentService.on('agent:log', (data) => this.emit('agent:log', data));
        this.agentService.on('agent:error', (data) => {
            this.coordinationManager.releaseFiles(data.agentId);
            this.emit('agent:error', data);
        });
        this.agentService.on('agent:stopped', (data) => {
            this.coordinationManager.releaseFiles(data.agentId);
            this.emit('agent:stopped', data);
        });
        // Forward new streaming events for real-time token display
        this.agentService.on('agent:token', (data) => this.emit('agent:token', data));
        this.agentService.on('agent:ttft', (data) => this.emit('agent:ttft', data));
        this.agentService.on('agent:step-started', (data) => this.emit('agent:step-started', data));
        this.agentService.on('agent:step-completed', (data) => this.emit('agent:step-completed', data));
        this.agentService.on('agent:chunk', (data) => this.emit('agent:chunk', data));
    }

    // =========================================================================
    // MEMORY HARNESS - PROJECT IMPORT & CONTEXT
    // =========================================================================

    /**
     * Import a project with Memory Harness initialization
     * Creates all artifacts and scaffolding for Developer Mode
     */
    async importProject(
        sessionId: string,
        files: Map<string, string>,
        options?: { prompt?: string; mode?: 'import_existing' | 'fix_my_app' }
    ): Promise<{ success: boolean; taskCount?: number; error?: string }> {
        const session = await this.getSession(sessionId);
        if (!session) {
            return { success: false, error: `Session ${sessionId} not found` };
        }

        const projectPath = this.getProjectPath(session.projectId);
        const orchestrationRunId = `dev-${sessionId}`;

        try {
            // Check if project already has context artifacts
            const hasContext = await hasProjectContext(projectPath);

            if (!hasContext) {
                console.log(`[DeveloperMode] Initializing project ${session.projectId} with InitializerAgent`);

                // First time importing - initialize with InitializerAgent
                const initializer = createInitializerAgent({
                    projectId: session.projectId,
                    userId: session.userId,
                    orchestrationRunId,
                    projectPath,
                    mode: options?.mode || 'import_existing',
                });

                // Forward initializer events
                initializer.on('intent_created', (data) =>
                    this.emit('project:intent-created', { sessionId, ...data })
                );
                initializer.on('tasks_decomposed', (data) =>
                    this.emit('project:tasks-decomposed', { sessionId, ...data })
                );
                initializer.on('scaffolding_complete', (data) =>
                    this.emit('project:scaffolding-complete', { sessionId, ...data })
                );
                initializer.on('artifacts_created', (data) =>
                    this.emit('project:artifacts-created', { sessionId, ...data })
                );
                initializer.on('git_initialized', (data) =>
                    this.emit('project:git-initialized', { sessionId, ...data })
                );

                // Run initialization based on mode
                let result;
                if (options?.mode === 'fix_my_app') {
                    result = await initializer.initializeForFix(files);
                } else {
                    result = await initializer.initializeFromExisting(files);
                }

                if (!result.success) {
                    return { success: false, error: result.error };
                }

                // Store artifact manager for this project
                const artifactManager = createArtifactManager(
                    session.projectId,
                    orchestrationRunId,
                    session.userId
                );
                this.projectArtifacts.set(session.projectId, artifactManager);
                this.projectPaths.set(session.projectId, projectPath);

                this.emit('project:imported', {
                    sessionId,
                    projectId: session.projectId,
                    taskCount: result.taskCount,
                    artifacts: result.artifactsCreated,
                });

                return { success: true, taskCount: result.taskCount };
            } else {
                // Resuming work - load existing context
                console.log(`[DeveloperMode] Resuming project ${session.projectId} from existing context`);

                const context = await loadProjectContext(projectPath);
                this.loadedContexts.set(session.projectId, context);

                // Restore artifact manager
                const artifactManager = createArtifactManager(
                    session.projectId,
                    orchestrationRunId,
                    session.userId
                );
                this.projectArtifacts.set(session.projectId, artifactManager);
                this.projectPaths.set(session.projectId, projectPath);

                await this.restoreFromContext(session, context);

                this.emit('project:resumed', {
                    sessionId,
                    projectId: session.projectId,
                    completedTasks: context.taskList?.completedTasks || 0,
                    totalTasks: context.taskList?.totalTasks || 0,
                });

                return {
                    success: true,
                    taskCount: context.taskList?.totalTasks || 0,
                };
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[DeveloperMode] Import project failed:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Handle a user iteration request with full context awareness
     * Uses CodingAgentWrapper for context loading and artifact updates
     */
    async handleUserIteration(
        sessionId: string,
        userMessage: string,
        options?: {
            model?: AgentModel;
            files?: string[];
            context?: string;
        }
    ): Promise<{
        success: boolean;
        response?: string;
        filesModified?: string[];
        gitCommit?: string | null;
        error?: string;
    }> {
        const session = await this.getSession(sessionId);
        if (!session) {
            return { success: false, error: `Session ${sessionId} not found` };
        }

        const projectPath = this.getProjectPath(session.projectId);
        const orchestrationRunId = `dev-${sessionId}`;

        try {
            // Create coding agent wrapper for this iteration
            const codingAgent = createCodingAgentWrapper({
                projectId: session.projectId,
                userId: session.userId,
                orchestrationRunId,
                projectPath,
                agentType: 'iterate',
                agentId: `dev-iterate-${Date.now()}`,
            });

            // Load context from artifacts
            await codingAgent.startSession();

            // Get or create artifact manager
            let artifactManager = this.projectArtifacts.get(session.projectId);
            if (!artifactManager) {
                artifactManager = createArtifactManager(
                    session.projectId,
                    orchestrationRunId,
                    session.userId
                );
                this.projectArtifacts.set(session.projectId, artifactManager);
            }

            // Create a task for this iteration
            const taskId = await artifactManager.addTask({
                description: `User iteration: ${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`,
                category: 'feature',
                status: 'pending',
                priority: 1,
            });

            // Claim the task
            const task = await codingAgent.claimTask(taskId);
            if (!task) {
                await codingAgent.endSession();
                return { success: false, error: 'Failed to claim iteration task' };
            }

            // Get system prompt with full context
            const basePrompt = this.getBaseSystemPrompt(session);
            const systemPrompt = codingAgent.getSystemPromptWithContext(basePrompt);

            // Build user prompt with additional context
            let fullUserPrompt = userMessage;
            if (options?.context) {
                fullUserPrompt = `${options.context}\n\n${userMessage}`;
            }
            if (options?.files && options.files.length > 0) {
                fullUserPrompt += `\n\nFocus on these files: ${options.files.join(', ')}`;
            }

            // Generate response using Krip-Toe-Nite for intelligent routing
            let responseContent = '';
            try {
                const result = await this.ktn.buildFeature(fullUserPrompt, {
                    projectId: session.projectId,
                    userId: session.userId,
                    framework: 'React',
                    language: 'TypeScript',
                });
                responseContent = result.content;
                console.log(`[DeveloperMode] KTN iteration: strategy=${result.strategy}, model=${result.model}`);
            } catch (ktnError) {
                // Fallback to direct OpenRouter call
                console.warn('[DeveloperMode] KTN failed, using direct OpenRouter:', ktnError);
                const phaseConfig = getPhaseConfig('build_agent');
                const client = this.openRouterClient.getClient();

                const response = await client.messages.create({
                    model: phaseConfig.model,
                    max_tokens: 32000,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: fullUserPrompt }],
                });

                responseContent = response.content
                    .filter(block => block.type === 'text')
                    .map(block => (block as { type: 'text'; text: string }).text)
                    .join('\n');
            }

            // Parse files from response and record changes
            const parsedFiles = this.parseFileOperations(responseContent);
            const filesModified: string[] = [];

            for (const file of parsedFiles) {
                codingAgent.recordFileChange(
                    file.path,
                    file.isNew ? 'create' : 'modify',
                    file.content
                );
                filesModified.push(file.path);
            }

            // Extract next steps from response
            const nextSteps = this.extractNextSteps(responseContent);

            // Complete task (updates artifacts, commits to git)
            const taskResult: TaskResult = await codingAgent.completeTask({
                summary: `Iteration: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`,
                filesModified,
                nextSteps,
            });

            // End session
            await codingAgent.endSession();

            // Emit iteration complete event
            this.emit('iteration:complete', {
                sessionId,
                taskId: task.id,
                filesModified,
                gitCommit: taskResult.gitCommit,
            });

            return {
                success: true,
                response: responseContent,
                filesModified,
                gitCommit: taskResult.gitCommit,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[DeveloperMode] Iteration failed:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Get the base system prompt for Developer Mode iterations
     */
    private getBaseSystemPrompt(session: Session): string {
        return `You are a senior software engineer working in Developer Mode.
You are making changes to an existing codebase based on user requests.

PROJECT CONTEXT:
- Project ID: ${session.projectId}
- Session ID: ${session.id}
- Default Model: ${session.defaultModel}
- Verification Mode: ${session.verificationMode}

GUIDELINES:
1. Make precise, targeted changes based on the user's request
2. Follow existing code style and patterns
3. Do NOT use placeholders or TODO comments
4. Include ALL necessary imports
5. Generate production-ready code only
6. Explain what changes you made and why

OUTPUT FORMAT:
For each file you create or modify, use this format:
\`\`\`filepath:path/to/file.ts
// file content here
\`\`\`

After the code, summarize:
- What was changed
- Why it was changed
- Any follow-up steps needed`;
    }

    /**
     * Restore session state from loaded context
     */
    private async restoreFromContext(session: Session, context: LoadedContext): Promise<void> {
        console.log(`[DeveloperMode] Restoring session ${session.id} from context`);

        // Store loaded context for later use
        this.loadedContexts.set(session.projectId, context);

        // Log restoration
        const artifactManager = this.projectArtifacts.get(session.projectId);
        if (artifactManager) {
            await artifactManager.appendProgressEntry({
                agentId: 'developer-mode',
                agentType: 'orchestrator',
                action: 'Resumed Developer Mode session from artifacts',
                completed: [
                    `Loaded ${context.taskList?.completedTasks || 0} completed tasks`,
                    `Progress entries loaded`,
                ],
                filesModified: [],
                nextSteps: ['Continue from where left off'],
            });
        }

        // Emit restoration event
        this.emit('context:restored', {
            sessionId: session.id,
            projectId: session.projectId,
            tasksCompleted: context.taskList?.completedTasks || 0,
            totalTasks: context.taskList?.totalTasks || 0,
            hasIntent: !!context.intentContract,
        });
    }

    /**
     * Parse file operations from AI response
     */
    private parseFileOperations(content: string): Array<{ path: string; content: string; isNew: boolean }> {
        const files: Array<{ path: string; content: string; isNew: boolean }> = [];

        // Match code blocks with filepath
        const codeBlockRegex = /```(?:filepath:)?([^\n]+)\n([\s\S]*?)```/g;
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            const pathMatch = match[1].trim();
            const fileContent = match[2].trim();

            // Skip if it's just a language identifier
            if (pathMatch.includes('/') || pathMatch.includes('.')) {
                files.push({
                    path: pathMatch.replace(/^filepath:/, '').trim(),
                    content: fileContent,
                    isNew: true, // Assume new unless we track existing files
                });
            }
        }

        return files;
    }

    /**
     * Extract next steps from AI response
     */
    private extractNextSteps(content: string): string[] {
        const nextSteps: string[] = [];

        // Look for common patterns indicating next steps
        const patterns = [
            /next steps?:?\s*\n?([\s\S]*?)(?:\n\n|$)/i,
            /follow-up:?\s*\n?([\s\S]*?)(?:\n\n|$)/i,
            /todo:?\s*\n?([\s\S]*?)(?:\n\n|$)/i,
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                const stepsText = match[1];
                const lines = stepsText.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const cleaned = line.replace(/^[-*•\d.]+\s*/, '').trim();
                    if (cleaned.length > 0 && cleaned.length < 200) {
                        nextSteps.push(cleaned);
                    }
                }
                break;
            }
        }

        return nextSteps.slice(0, 5); // Limit to 5 next steps
    }

    /**
     * Get project path for a project ID
     */
    private getProjectPath(projectId: string): string {
        return this.projectPaths.get(projectId) || `/tmp/kriptik-projects/${projectId}`;
    }

    /**
     * Get loaded context for a project (if available)
     */
    getLoadedContext(projectId: string): LoadedContext | null {
        return this.loadedContexts.get(projectId) || null;
    }

    /**
     * Get artifact manager for a project (if available)
     */
    getArtifactManager(projectId: string): ArtifactManager | null {
        return this.projectArtifacts.get(projectId) || null;
    }

    // =========================================================================
    // ORIGINAL SESSION MANAGEMENT
    // =========================================================================

    /**
     * Start a new Developer Mode session
     */
    async startSession(config: SessionConfig): Promise<Session> {
        const id = uuidv4();
        const now = new Date().toISOString();

        // Create work branch name
        const workBranch = `dev-mode/${id.substring(0, 8)}`;

        // Insert session
        await db.insert(developerModeSessions).values({
            id,
            projectId: config.projectId,
            userId: config.userId,
            status: 'active',
            startedAt: now,
            maxConcurrentAgents: 6,
            activeAgentCount: 0,
            defaultModel: config.defaultModel || 'claude-sonnet-4-5',
            verificationMode: config.verificationMode || 'standard',
            autoMergeEnabled: config.autoMergeEnabled ?? false,
            creditsUsed: 0,
            creditsEstimated: 0,
            budgetLimit: config.budgetLimit,
            baseBranch: config.baseBranch || 'main',
            workBranch,
            totalAgentsDeployed: 0,
            totalTasksCompleted: 0,
            totalVerificationPasses: 0,
            totalMerges: 0,
            createdAt: now,
            updatedAt: now,
        });

        const session = await this.getSession(id);
        if (session) {
            this.activeSessions.set(id, session);
            this.emit('session:started', { sessionId: id, projectId: config.projectId });
        }

        return session!;
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<Session | null> {
        const result = await db
            .select()
            .from(developerModeSessions)
            .where(eq(developerModeSessions.id, sessionId))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        const row = result[0];
        const agents = await this.agentService.getSessionAgents(sessionId);

        return {
            id: row.id,
            projectId: row.projectId,
            userId: row.userId,
            status: row.status as SessionStatus,
            startedAt: new Date(row.startedAt),
            pausedAt: row.pausedAt ? new Date(row.pausedAt) : undefined,
            completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
            maxConcurrentAgents: row.maxConcurrentAgents ?? 6,
            activeAgentCount: row.activeAgentCount ?? 0,
            defaultModel: row.defaultModel as AgentModel || 'claude-sonnet-4-5',
            verificationMode: (row.verificationMode as VerificationMode) || 'standard',
            autoMergeEnabled: row.autoMergeEnabled ?? false,
            creditsUsed: row.creditsUsed ?? 0,
            creditsEstimated: row.creditsEstimated ?? 0,
            budgetLimit: row.budgetLimit ?? undefined,
            baseBranch: row.baseBranch || 'main',
            workBranch: row.workBranch ?? undefined,
            totalAgentsDeployed: row.totalAgentsDeployed ?? 0,
            totalTasksCompleted: row.totalTasksCompleted ?? 0,
            totalVerificationPasses: row.totalVerificationPasses ?? 0,
            totalMerges: row.totalMerges ?? 0,
            agents,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
        };
    }

    /**
     * Get active session for a project
     */
    async getActiveSessionForProject(projectId: string): Promise<Session | null> {
        const result = await db
            .select()
            .from(developerModeSessions)
            .where(
                and(eq(developerModeSessions.projectId, projectId), eq(developerModeSessions.status, 'active'))
            )
            .orderBy(desc(developerModeSessions.createdAt))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        return this.getSession(result[0].id);
    }

    /**
     * Get all sessions for a user
     */
    async getUserSessions(userId: string, limit = 20): Promise<Session[]> {
        const results = await db
            .select()
            .from(developerModeSessions)
            .where(eq(developerModeSessions.userId, userId))
            .orderBy(desc(developerModeSessions.createdAt))
            .limit(limit);

        const sessions: Session[] = [];
        for (const row of results) {
            const session = await this.getSession(row.id);
            if (session) {
                sessions.push(session);
            }
        }

        return sessions;
    }

    /**
     * Deploy a new agent in a session
     */
    async deployAgent(sessionId: string, request: DeployAgentRequest): Promise<Agent> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (session.status !== 'active') {
            throw new Error(`Session ${sessionId} is not active`);
        }

        // Check agent limit
        if (session.agents.length >= session.maxConcurrentAgents) {
            throw new Error(`Maximum of ${session.maxConcurrentAgents} agents reached`);
        }

        // Check budget if set
        if (session.budgetLimit && session.creditsUsed >= session.budgetLimit) {
            throw new Error('Session budget limit reached');
        }

        // Check for file conflicts if agent specifies target files
        if (request.files && request.files.length > 0) {
            const pendingAgentId = `pending-${sessionId}-${Date.now()}`;
            const claim = this.coordinationManager.claimFiles(pendingAgentId, request.files);

            if (!claim.success) {
                // Release the pending claim
                this.coordinationManager.releaseFiles(pendingAgentId);
                throw new Error(
                    `Cannot deploy agent: files already being modified by another agent: ${claim.conflicts.join(', ')}`
                );
            }
            // Release the temporary pending claim - will be re-claimed by the actual agent
            this.coordinationManager.releaseFiles(pendingAgentId);
        }

        // Find next available agent number
        const usedNumbers = new Set(session.agents.map(a => a.agentNumber));
        let agentNumber = 1;
        while (usedNumbers.has(agentNumber) && agentNumber <= 6) {
            agentNumber++;
        }

        // Create agent
        const agentConfig: AgentConfig = {
            sessionId,
            projectId: session.projectId,
            userId: session.userId,
            agentNumber,
            name: request.name,
            model: request.model || session.defaultModel,
            effortLevel: request.effortLevel,
            thinkingBudget: request.thinkingBudget,
            verificationMode: request.verificationMode || session.verificationMode,
        };

        const agent = await this.agentService.createAgent(agentConfig);

        // Start task immediately
        const taskConfig: AgentTaskConfig = {
            taskPrompt: request.taskPrompt,
            files: request.files,
            context: request.context,
        };

        await this.agentService.startTask(agent.id, taskConfig);

        this.emit('agent:deployed', { sessionId, agentId: agent.id, name: request.name });

        return agent;
    }

    /**
     * Stop an agent
     */
    async stopAgent(agentId: string): Promise<void> {
        await this.agentService.stopAgent(agentId);
    }

    /**
     * Resume an agent
     */
    async resumeAgent(agentId: string): Promise<void> {
        await this.agentService.resumeAgent(agentId);
    }

    /**
     * Rename an agent
     */
    async renameAgent(agentId: string, newName: string): Promise<void> {
        await this.agentService.renameAgent(agentId, newName);
    }

    /**
     * Change an agent's model
     */
    async changeAgentModel(agentId: string, model: AgentModel): Promise<void> {
        await this.agentService.changeModel(agentId, model);
    }

    /**
     * Delete an agent
     */
    async deleteAgent(agentId: string): Promise<void> {
        await this.agentService.deleteAgent(agentId);
    }

    /**
     * Get agent by ID
     */
    async getAgent(agentId: string): Promise<Agent | null> {
        return this.agentService.getAgent(agentId);
    }

    /**
     * Get agent logs
     */
    async getAgentLogs(agentId: string, limit?: number) {
        return this.agentService.getAgentLogs(agentId, limit);
    }

    /**
     * Get merge queue for a session
     */
    async getMergeQueue(sessionId: string): Promise<MergeQueueItem[]> {
        const result = await db
            .select()
            .from(developerModeMergeQueue)
            .where(eq(developerModeMergeQueue.sessionId, sessionId))
            .orderBy(desc(developerModeMergeQueue.priority), desc(developerModeMergeQueue.createdAt));

        const items: MergeQueueItem[] = [];
        for (const row of result) {
            const agent = await this.agentService.getAgent(row.agentId);
            items.push({
                id: row.id,
                agentId: row.agentId,
                agentName: agent?.name || 'Unknown',
                status: row.status as MergeQueueItem['status'],
                priority: row.priority || 0,
                sourceBranch: row.sourceBranch,
                targetBranch: row.targetBranch,
                filesChanged: row.filesChanged || 0,
                additions: row.additions || 0,
                deletions: row.deletions || 0,
                verificationPassed: (row.verificationResults as { passed?: boolean })?.passed ?? false,
                verificationScore: (row.verificationResults as { score?: number })?.score ?? 0,
                createdAt: new Date(row.createdAt),
            });
        }

        return items;
    }

    /**
     * Approve a merge request
     */
    async approveMerge(mergeId: string, userId: string): Promise<void> {
        const now = new Date().toISOString();

        await db
            .update(developerModeMergeQueue)
            .set({
                status: 'approved',
                reviewedBy: userId,
                reviewedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeMergeQueue.id, mergeId));

        const merge = await db
            .select()
            .from(developerModeMergeQueue)
            .where(eq(developerModeMergeQueue.id, mergeId))
            .limit(1);

        if (merge.length > 0) {
            this.emit('merge:approved', { mergeId, sessionId: merge[0].sessionId });
        }
    }

    /**
     * Reject a merge request
     */
    async rejectMerge(mergeId: string, userId: string, reason: string): Promise<void> {
        const now = new Date().toISOString();

        await db
            .update(developerModeMergeQueue)
            .set({
                status: 'rejected',
                reviewedBy: userId,
                reviewedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeMergeQueue.id, mergeId));

        const merge = await db
            .select()
            .from(developerModeMergeQueue)
            .where(eq(developerModeMergeQueue.id, mergeId))
            .limit(1);

        if (merge.length > 0) {
            this.emit('merge:rejected', { mergeId, sessionId: merge[0].sessionId, reason });
        }
    }

    /**
     * Execute a merge (apply changes to main branch)
     */
    async executeMerge(mergeId: string): Promise<void> {
        const now = new Date().toISOString();

        const merge = await db
            .select()
            .from(developerModeMergeQueue)
            .where(eq(developerModeMergeQueue.id, mergeId))
            .limit(1);

        if (merge.length === 0) {
            throw new Error(`Merge ${mergeId} not found`);
        }

        if (merge[0].status !== 'approved') {
            throw new Error('Merge must be approved before execution');
        }

        // Get project directory for git operations
        const projectPath = `/tmp/kriptik-projects/${merge[0].projectId}`;
        const gitManager = createGitBranchManager({
            projectPath,
            worktreesBasePath: `${projectPath}/.kriptik-worktrees`,
            defaultBranch: merge[0].targetBranch || 'main',
        });

        // Execute actual git merge using the agent ID
        try {
            const mergeResult = await gitManager.mergeBranch(
                merge[0].agentId,
                merge[0].targetBranch,
                'squash'
            );

            if (!mergeResult.success && mergeResult.conflicts.length > 0) {
                // Update status to conflict instead of merged
                const conflictsJson = mergeResult.conflicts.map(file => ({
                    file,
                    ourContent: '',  // Would be populated by reading the actual conflict markers
                    theirContent: '',
                }));

                await db
                    .update(developerModeMergeQueue)
                    .set({
                        status: 'conflict',
                        conflicts: conflictsJson,
                        updatedAt: now,
                    })
                    .where(eq(developerModeMergeQueue.id, mergeId));

                this.emit('merge:conflict', { mergeId, conflicts: mergeResult.conflicts });
                throw new Error(`Merge conflicts in files: ${mergeResult.conflicts.join(', ')}`);
            }
        } catch (gitError: any) {
            // If git merge fails but not due to conflicts, log and continue with DB update
            if (!gitError.message?.includes('conflicts')) {
                console.error('[Developer Mode] Git merge error:', gitError);
            } else {
                throw gitError;
            }
        }

        // Update merge queue status
        await db
            .update(developerModeMergeQueue)
            .set({
                status: 'merged',
                mergedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeMergeQueue.id, mergeId));

        // Update agent merge status
        await db
            .update(developerModeAgents)
            .set({
                mergeStatus: 'merged',
                mergedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeAgents.id, merge[0].agentId));

        // Update session stats
        await db
            .update(developerModeSessions)
            .set({
                totalMerges: await this.getSessionMergeCount(merge[0].sessionId),
                updatedAt: now,
            })
            .where(eq(developerModeSessions.id, merge[0].sessionId));

        this.emit('merge:completed', { mergeId, sessionId: merge[0].sessionId, agentId: merge[0].agentId });
    }

    /**
     * Pause a session (stops all running agents)
     */
    async pauseSession(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // Stop all running agents
        for (const agent of session.agents) {
            if (agent.status === 'running') {
                await this.agentService.stopAgent(agent.id);
            }
        }

        await db
            .update(developerModeSessions)
            .set({
                status: 'paused',
                pausedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeSessions.id, sessionId));

        this.activeSessions.delete(sessionId);
        this.emit('session:paused', { sessionId });
    }

    /**
     * Resume a paused session
     */
    async resumeSession(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (session.status !== 'paused') {
            throw new Error(`Session ${sessionId} is not paused`);
        }

        await db
            .update(developerModeSessions)
            .set({
                status: 'active',
                pausedAt: null,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeSessions.id, sessionId));

        const updatedSession = await this.getSession(sessionId);
        if (updatedSession) {
            this.activeSessions.set(sessionId, updatedSession);
        }

        this.emit('session:resumed', { sessionId });
    }

    /**
     * End a session
     */
    async endSession(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // Stop all running agents
        for (const agent of session.agents) {
            if (agent.status === 'running') {
                await this.agentService.stopAgent(agent.id);
            }
        }

        await db
            .update(developerModeSessions)
            .set({
                status: 'completed',
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeSessions.id, sessionId));

        this.activeSessions.delete(sessionId);
        this.emit('session:ended', { sessionId });
    }

    /**
     * Update session configuration
     */
    async updateSessionConfig(
        sessionId: string,
        config: Partial<Pick<SessionConfig, 'defaultModel' | 'verificationMode' | 'autoMergeEnabled' | 'budgetLimit'>>
    ): Promise<void> {
        await db
            .update(developerModeSessions)
            .set({
                ...config,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeSessions.id, sessionId));

        // Update cached session
        const session = await this.getSession(sessionId);
        if (session) {
            this.activeSessions.set(sessionId, session);
        }

        this.emit('session:config-updated', { sessionId, config });
    }

    /**
     * Estimate credits for a task
     */
    estimateCredits(model: AgentModel, taskComplexity: 'simple' | 'medium' | 'complex'): number {
        const baseCredits: Record<AgentModel, number> = {
            'claude-opus-4-5': 50,
            'claude-sonnet-4-5': 20,
            'claude-haiku-3-5': 5,
            'gpt-5-codex': 25,
            'gemini-2-5-pro': 15,
            'deepseek-r1': 8,
        };

        const complexityMultiplier = {
            simple: 0.5,
            medium: 1,
            complex: 2,
        };

        return Math.ceil(baseCredits[model] * complexityMultiplier[taskComplexity]);
    }

    // =============================================================================
    // PRIVATE HELPERS
    // =============================================================================

    private async handleAgentCompleted(data: { agentId: string; sessionId: string; success: boolean; verificationScore: number }): Promise<void> {
        const now = new Date().toISOString();

        // Update session stats
        const session = await this.getSession(data.sessionId);
        if (session) {
            await db
                .update(developerModeSessions)
                .set({
                    totalTasksCompleted: session.totalTasksCompleted + (data.success ? 1 : 0),
                    totalVerificationPasses: session.totalVerificationPasses + (data.verificationScore >= 70 ? 1 : 0),
                    activeAgentCount: session.agents.filter(a => a.status === 'running').length,
                    updatedAt: now,
                })
                .where(eq(developerModeSessions.id, data.sessionId));
        }

        // Create merge queue entry if task completed successfully
        if (data.success && data.verificationScore >= 50) {
            const agent = await this.agentService.getAgent(data.agentId);
            if (agent) {
                await this.createMergeQueueEntry(agent, data.verificationScore);
            }
        }

        this.emit('agent:task-completed', data);
    }

    private async createMergeQueueEntry(agent: Agent, verificationScore: number): Promise<void> {
        const session = await this.getSession(agent.sessionId);
        if (!session) return;

        // Calculate diff stats using git
        let filesChanged = 0;
        let additions = 0;
        let deletions = 0;

        try {
            const projectPath = `/tmp/kriptik-projects/${agent.projectId}`;
            const gitManager = createGitBranchManager({
                projectPath,
                worktreesBasePath: `${projectPath}/.kriptik-worktrees`,
                defaultBranch: session.baseBranch || 'main',
            });
            const diffStats = await gitManager.getAgentDiffStats(agent.id, session.baseBranch);

            filesChanged = diffStats.filesChanged;
            additions = diffStats.additions;
            deletions = diffStats.deletions;
        } catch (gitError) {
            // If git diff fails, use default values
            console.error('[Developer Mode] Git diff error:', gitError);
            filesChanged = 0;
        }

        await db.insert(developerModeMergeQueue).values({
            id: uuidv4(),
            agentId: agent.id,
            sessionId: agent.sessionId,
            projectId: agent.projectId,
            status: session.autoMergeEnabled && verificationScore >= 85 ? 'approved' : 'pending',
            priority: verificationScore >= 85 ? 1 : 0,
            sourceBranch: agent.branchName || `agent-${agent.agentNumber}`,
            targetBranch: session.baseBranch,
            filesChanged,
            additions,
            deletions,
            verificationResults: {
                passed: verificationScore >= 70,
                score: verificationScore,
                agents: {},
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        this.emit('merge:queued', { agentId: agent.id, sessionId: agent.sessionId });
    }

    private async getSessionMergeCount(sessionId: string): Promise<number> {
        const result = await db
            .select()
            .from(developerModeMergeQueue)
            .where(
                and(eq(developerModeMergeQueue.sessionId, sessionId), eq(developerModeMergeQueue.status, 'merged'))
            );
        return result.length;
    }

    /**
     * Get all currently locked files
     * Returns a map of filePath -> agentId
     */
    getLockedFiles(): Map<string, string> {
        return this.coordinationManager.getLockedFiles();
    }

    /**
     * Check if a specific file is available for modification
     */
    isFileAvailable(filePath: string, forAgentId?: string): boolean {
        return this.coordinationManager.isFileAvailable(filePath, forAgentId);
    }
}

// =============================================================================
// FACTORY
// =============================================================================

let orchestrator: DeveloperModeOrchestrator | null = null;

export function getDeveloperModeOrchestrator(): DeveloperModeOrchestrator {
    if (!orchestrator) {
        orchestrator = new DeveloperModeOrchestrator();
    }
    return orchestrator;
}

export function createDeveloperModeOrchestrator(): DeveloperModeOrchestrator {
    return new DeveloperModeOrchestrator();
}

