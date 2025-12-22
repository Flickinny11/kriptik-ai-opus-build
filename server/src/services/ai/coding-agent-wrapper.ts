/**
 * CodingAgent Wrapper - Context Reload & Artifact Updates
 *
 * Every agent session:
 * 1. READS context from artifacts (startSession)
 * 2. Works on ONE task (claimTask → work → completeTask)
 * 3. UPDATES artifacts (completeTask)
 * 4. COMMITS to git (completeTask)
 *
 * Reference: Anthropic's "Effective Harnesses for Long-Running Agents"
 *
 * This wrapper ensures consistent context loading and artifact management
 * across ALL agent types in the system.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import {
    loadProjectContext,
    formatContextForPrompt,
    formatContextSummary,
    type LoadedContext,
} from './context-loader.js';
// SESSION 2: Import UnifiedContext for rich context with patterns, strategies, error history
import {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    formatUnifiedContextSummary,
    type UnifiedContext,
} from './unified-context.js';
import {
    getWebSocketSyncService,
    type WebSocketSyncService,
} from '../agents/websocket-sync.js';
import {
    createArtifactManager,
    type ArtifactManager,
    type TaskItem,
    type CurrentTask,
    type BuildState,
} from './artifacts.js';
import {
    commitChanges,
    hasUncommittedChanges,
    getLastCommitHash,
} from './git-helper.js';
import {
    getOpenRouterClient,
    getPhaseConfig,
} from './openrouter-client.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CodingAgentConfig {
    projectId: string;
    userId: string;
    orchestrationRunId: string;
    projectPath: string;
    agentType: string; // 'build', 'fix', 'iterate', 'test', etc.
    agentId?: string; // unique identifier for this agent instance
}

export interface TaskResult {
    success: boolean;
    taskId: string;
    filesCreated: string[];
    filesModified: string[];
    filesDeleted: string[];
    gitCommit: string | null;
    summary: string;
    nextSteps: string[];
    blockers?: string[];
    error?: string;
}

export interface FileChange {
    path: string;
    action: 'create' | 'modify' | 'delete';
    content?: string;
    previousContent?: string;
    timestamp: Date;
}

export interface DecisionRecord {
    id: string;
    phase: string;
    decisionType: string;
    chosen: string;
    alternatives: string[];
    reasoning: string;
    confidence: number;
    timestamp: Date;
}

export interface CodingAgentEvents {
    'session_start': { projectId: string; agentId: string };
    'context_loaded': LoadedContext;
    'task_claimed': TaskItem;
    'file_changed': FileChange;
    'decision_made': DecisionRecord;
    'task_complete': TaskResult;
    'task_blocked': { taskId: string; reason: string };
    'task_failed': { taskId: string; error: string };
    'session_end': { agentId: string; tasksCompleted: number };
    'error': { error: Error; phase: string };
}

/**
 * SESSION 2: Context update from other agents (real-time sharing)
 */
export interface ContextUpdate {
    type: 'agent:completed' | 'file:modified' | 'error:resolved' | 'pattern:learned' | 'visual-verification';
    data: Record<string, unknown>;
    fromAgentId?: string;
    timestamp: number;
}

// =============================================================================
// CODING AGENT WRAPPER
// =============================================================================

export class CodingAgentWrapper extends EventEmitter {
    private config: CodingAgentConfig;
    private context: LoadedContext | null = null;
    // SESSION 2: Rich unified context with patterns, strategies, error history
    private unifiedContext: UnifiedContext | null = null;
    private artifactManager: ArtifactManager;
    private openRouterClient: ReturnType<typeof getOpenRouterClient>;
    private currentTaskId: string | null = null;
    private filesModified: Set<string> = new Set();
    private filesCreated: Set<string> = new Set();
    private filesDeleted: Set<string> = new Set();
    private fileChanges: FileChange[] = [];
    private decisions: DecisionRecord[] = [];
    private tasksCompletedThisSession: number = 0;
    private sessionStartTime: Date | null = null;
    // SESSION 2: Real-time context updates from other agents
    private wsSync: WebSocketSyncService;
    private pendingContextUpdates: ContextUpdate[] = [];
    private contextSubscriptionId: string | null = null;

    constructor(config: CodingAgentConfig) {
        super();
        this.config = {
            ...config,
            agentId: config.agentId || `${config.agentType}-${uuidv4().slice(0, 8)}`,
        };
        this.artifactManager = createArtifactManager(
            config.projectId,
            config.orchestrationRunId,
            config.userId
        );
        this.openRouterClient = getOpenRouterClient();
        // SESSION 2: Initialize WebSocket sync for real-time context updates
        this.wsSync = getWebSocketSyncService();

        console.log(`[CodingAgentWrapper] Created agent ${this.config.agentId} (${config.agentType})`);
    }

    // =========================================================================
    // MAIN WORKFLOW: Load Context → Work → Update → Commit
    // =========================================================================

    /**
     * Start a coding session - ALWAYS call this first
     * SESSION 2: Now uses loadUnifiedContext for rich context with patterns, strategies, error history
     */
    async startSession(): Promise<LoadedContext> {
        this.sessionStartTime = new Date();
        console.log(`[CodingAgentWrapper] Starting session for ${this.config.agentId}`);

        this.emit('session_start', {
            projectId: this.config.projectId,
            agentId: this.config.agentId!,
        });

        try {
            // SESSION 2: Load rich unified context with patterns, strategies, error history
            // This replaces the simpler loadProjectContext for comprehensive context
            this.unifiedContext = await loadUnifiedContext(
                this.config.projectId,
                this.config.userId,
                this.config.projectPath,
                {
                    includeIntentLock: true,
                    includeVerificationResults: true,
                    includeLearningData: true,
                    includeErrorHistory: true,
                    includeProjectAnalysis: true,
                    includeUserPreferences: true,
                    progressEntries: 50,
                    gitLogEntries: 30
                }
            );

            // Extract LoadedContext for backward compatibility
            this.context = this.unifiedContext.fileContext;

            console.log(`[CodingAgentWrapper] Unified context loaded: ${this.unifiedContext.learnedPatterns.length} patterns, ${this.unifiedContext.verificationResults.length} verifications, ${this.unifiedContext.errorHistory.length} error history`);

            // 2. Update build state to show agent is active
            await this.artifactManager.saveBuildState({
                phase: `${this.config.agentType}_session`,
                status: 'in_progress',
                devServer: 'unknown',
                build: 'unknown',
                tests: { passing: 0, failing: 0, pending: 0 },
                lastCommit: this.context.gitHistory[0]?.hash || null,
            });

            // 3. Emit context loaded event
            this.emit('context_loaded', this.context);

            // SESSION 2: Subscribe to real-time context updates from other agents
            this.subscribeToContextUpdates();

            console.log(`[CodingAgentWrapper] Context loaded: ${this.context.progressLog.length} progress entries, ${this.context.taskList?.tasks.length || 0} tasks`);

            return this.context;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.emit('error', { error: err, phase: 'session_start' });
            throw err;
        }
    }

    /**
     * Get the loaded context (must call startSession first)
     */
    getContext(): LoadedContext {
        if (!this.context) {
            throw new Error('Must call startSession() before getContext()');
        }
        return this.context;
    }

    /**
     * Get system prompt with injected context
     */
    getSystemPromptWithContext(basePrompt: string): string {
        if (!this.context) {
            throw new Error('Must call startSession() before getting prompt');
        }

        const contextSection = formatContextForPrompt(this.context);

        return `${basePrompt}

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT (Loaded from persistent artifacts)
═══════════════════════════════════════════════════════════════════════════════

${contextSection}

═══════════════════════════════════════════════════════════════════════════════
IMPORTANT: You are continuing work on this project. The context above shows:
- What has been completed (progress log)
- What tasks remain (task list)
- Recent changes (git history)
- Current project state

Your job is to complete the CURRENT TASK only. After completing, your work
will be saved to artifacts for the next agent session.
═══════════════════════════════════════════════════════════════════════════════`;
    }

    /**
     * Get a condensed system prompt with summary context (for token efficiency)
     */
    getSystemPromptWithSummary(basePrompt: string): string {
        if (!this.context) {
            throw new Error('Must call startSession() before getting prompt');
        }

        const contextSummary = formatContextSummary(this.context);

        return `${basePrompt}

═══ PROJECT CONTEXT ═══
${contextSummary}
═══════════════════════`;
    }

    // =========================================================================
    // TASK MANAGEMENT
    // =========================================================================

    /**
     * Claim a task to work on
     */
    async claimTask(taskId?: string): Promise<TaskItem | null> {
        if (!this.context) {
            throw new Error('Must call startSession() before claimTask()');
        }

        // If specific taskId provided, get that task from the list
        let task: TaskItem | null = null;

        if (taskId) {
            const taskList = await this.artifactManager.getTaskList();
            task = taskList?.tasks.find(t => t.id === taskId) || null;
        } else {
            // Get next pending task with satisfied dependencies
            task = await this.artifactManager.getNextPendingTask();
        }

        if (!task) {
            console.log('[CodingAgentWrapper] No available tasks to claim');
            return null;
        }

        // Mark as in progress
        await this.artifactManager.markTaskInProgress(task.id, this.config.agentId!);

        // Build task context
        const taskContext = await this.buildTaskContext(task);

        // Set as current task
        const currentTask: CurrentTask = {
            taskId: task.id,
            description: task.description,
            assignedAgent: this.config.agentId!,
            assignedAt: new Date().toISOString(),
            context: taskContext,
            expectedOutput: this.describeExpectedOutput(task),
        };
        await this.artifactManager.setCurrentTask(currentTask);

        this.currentTaskId = task.id;
        this.emit('task_claimed', task);

        console.log(`[CodingAgentWrapper] Claimed task: ${task.id} - ${task.description}`);

        return task;
    }

    /**
     * Get the currently claimed task
     */
    getCurrentTask(): string | null {
        return this.currentTaskId;
    }

    /**
     * Get current task details from artifacts
     */
    async getCurrentTaskDetails(): Promise<CurrentTask | null> {
        return this.artifactManager.getCurrentTask();
    }

    // =========================================================================
    // FILE CHANGE TRACKING
    // =========================================================================

    /**
     * Record a file modification (call this when generating/modifying files)
     * SESSION 2: Now broadcasts to other agents for real-time awareness
     */
    recordFileChange(
        filePath: string,
        action: 'create' | 'modify' | 'delete',
        content?: string,
        previousContent?: string
    ): void {
        const change: FileChange = {
            path: filePath,
            action,
            content,
            previousContent,
            timestamp: new Date(),
        };

        this.fileChanges.push(change);

        switch (action) {
            case 'create':
                this.filesCreated.add(filePath);
                break;
            case 'modify':
                this.filesModified.add(filePath);
                break;
            case 'delete':
                this.filesDeleted.add(filePath);
                break;
        }

        this.emit('file_changed', change);

        // SESSION 2: Broadcast to other agents for real-time awareness
        this.broadcastFileModification(filePath, action);

        console.log(`[CodingAgentWrapper] Recorded ${action}: ${filePath}`);
    }

    /**
     * Batch record multiple file changes
     */
    recordFileChanges(changes: Array<{
        path: string;
        action: 'create' | 'modify' | 'delete';
        content?: string;
    }>): void {
        for (const change of changes) {
            this.recordFileChange(change.path, change.action, change.content);
        }
    }

    /**
     * Get all recorded file changes
     */
    getFileChanges(): FileChange[] {
        return [...this.fileChanges];
    }

    // =========================================================================
    // DECISION RECORDING (for learning)
    // =========================================================================

    /**
     * Record a decision made during the task
     */
    async recordDecision(
        decisionType: string,
        chosen: string,
        alternatives: string[],
        reasoning: string,
        confidence: number = 0.8
    ): Promise<void> {
        const decision: DecisionRecord = {
            id: uuidv4(),
            phase: this.config.agentType,
            decisionType,
            chosen,
            alternatives,
            reasoning,
            confidence,
            timestamp: new Date(),
        };

        this.decisions.push(decision);
        this.emit('decision_made', decision);

        console.log(`[CodingAgentWrapper] Decision: ${decisionType} -> ${chosen}`);
    }

    /**
     * Get all decisions made this session
     */
    getDecisions(): DecisionRecord[] {
        return [...this.decisions];
    }

    // =========================================================================
    // TASK COMPLETION
    // =========================================================================

    /**
     * Complete the current task - updates all artifacts and commits
     */
    async completeTask(result: {
        summary: string;
        filesCreated?: string[];
        filesModified?: string[];
        filesDeleted?: string[];
        nextSteps?: string[];
        blockers?: string[];
    }): Promise<TaskResult> {
        if (!this.currentTaskId) {
            throw new Error('No task claimed - call claimTask() first');
        }

        console.log(`[CodingAgentWrapper] Completing task: ${this.currentTaskId}`);

        try {
            // Aggregate all file changes
            const allFilesCreated = [
                ...(result.filesCreated || []),
                ...Array.from(this.filesCreated),
            ];
            const allFilesModified = [
                ...(result.filesModified || []),
                ...Array.from(this.filesModified),
            ];
            const allFilesDeleted = [
                ...(result.filesDeleted || []),
                ...Array.from(this.filesDeleted),
            ];
            const allFiles = [...allFilesCreated, ...allFilesModified];

            // 1. Mark task complete in task list
            await this.artifactManager.markTaskComplete(this.currentTaskId, result.summary);

            // 2. Clear current task
            await this.artifactManager.clearCurrentTask();

            // 3. Update progress log
            await this.artifactManager.appendProgressEntry({
                agentId: this.config.agentId!,
                agentType: this.config.agentType,
                taskId: this.currentTaskId,
                action: `Completed: ${result.summary}`,
                completed: [result.summary],
                filesModified: allFiles,
                nextSteps: result.nextSteps || [],
                blockers: result.blockers,
            });

            // 4. Commit to git
            let commitHash: string | null = null;
            if (await hasUncommittedChanges(this.config.projectPath)) {
                commitHash = await commitChanges(
                    this.config.projectPath,
                    `[${this.config.agentType}] ${result.summary}`
                );

                // Append git commit to progress
                await this.artifactManager.appendProgressEntry({
                    agentId: this.config.agentId!,
                    agentType: this.config.agentType,
                    taskId: this.currentTaskId,
                    action: 'Git commit',
                    completed: [],
                    filesModified: [],
                    gitCommit: commitHash,
                    nextSteps: [],
                });

                console.log(`[CodingAgentWrapper] Committed: ${commitHash.substring(0, 8)}`);
            }

            // 5. Update feature status if applicable
            await this.updateFeatureStatus(this.currentTaskId, allFiles);

            // 6. Update build state
            await this.artifactManager.saveBuildState({
                phase: `${this.config.agentType}_complete`,
                status: 'complete',
                devServer: 'unknown',
                build: 'unknown',
                tests: { passing: 0, failing: 0, pending: 0 },
                lastCommit: commitHash,
            });

            // 7. Build and emit result
            const taskResult: TaskResult = {
                success: true,
                taskId: this.currentTaskId,
                filesCreated: allFilesCreated,
                filesModified: allFilesModified,
                filesDeleted: allFilesDeleted,
                gitCommit: commitHash,
                summary: result.summary,
                nextSteps: result.nextSteps || [],
            };

            this.emit('task_complete', taskResult);
            this.tasksCompletedThisSession++;

            // SESSION 2: Broadcast completion to other agents
            this.broadcastTaskComplete(result.summary);

            // Reset state for next task
            const completedTaskId = this.currentTaskId;
            this.currentTaskId = null;
            this.filesCreated.clear();
            this.filesModified.clear();
            this.filesDeleted.clear();
            this.fileChanges = [];

            console.log(`[CodingAgentWrapper] Task ${completedTaskId} completed successfully`);

            return taskResult;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.emit('error', { error: err, phase: 'complete_task' });
            throw err;
        }
    }

    /**
     * Mark task as failed with error
     */
    async failTask(error: string, nextSteps?: string[]): Promise<TaskResult> {
        if (!this.currentTaskId) {
            throw new Error('No task claimed');
        }

        console.log(`[CodingAgentWrapper] Task failed: ${this.currentTaskId} - ${error}`);

        // Log the failure
        await this.artifactManager.appendProgressEntry({
            agentId: this.config.agentId!,
            agentType: this.config.agentType,
            taskId: this.currentTaskId,
            action: `FAILED: ${error}`,
            completed: [],
            filesModified: [],
            nextSteps: nextSteps || ['Investigate error', 'Retry task'],
            blockers: [error],
            notes: `Task failed at ${new Date().toISOString()}`,
        });

        // Don't mark as complete, leave as in_progress for retry
        await this.artifactManager.clearCurrentTask();

        const taskResult: TaskResult = {
            success: false,
            taskId: this.currentTaskId,
            filesCreated: Array.from(this.filesCreated),
            filesModified: Array.from(this.filesModified),
            filesDeleted: Array.from(this.filesDeleted),
            gitCommit: null,
            summary: `Task failed: ${error}`,
            nextSteps: nextSteps || [],
            error,
        };

        this.emit('task_failed', { taskId: this.currentTaskId, error });

        // Reset state
        this.currentTaskId = null;
        this.filesCreated.clear();
        this.filesModified.clear();
        this.filesDeleted.clear();
        this.fileChanges = [];

        return taskResult;
    }

    /**
     * Mark task as blocked (can't proceed)
     */
    async blockTask(reason: string, nextSteps?: string[]): Promise<void> {
        if (!this.currentTaskId) {
            console.warn('[CodingAgentWrapper] No task to block');
            return;
        }

        console.log(`[CodingAgentWrapper] Blocking task: ${this.currentTaskId} - ${reason}`);

        await this.artifactManager.markTaskBlocked(this.currentTaskId, reason);

        await this.artifactManager.appendProgressEntry({
            agentId: this.config.agentId!,
            agentType: this.config.agentType,
            taskId: this.currentTaskId,
            action: `BLOCKED: ${reason}`,
            completed: [],
            filesModified: [],
            nextSteps: nextSteps || ['Resolve blocker and retry'],
            blockers: [reason],
        });

        await this.artifactManager.clearCurrentTask();

        this.emit('task_blocked', { taskId: this.currentTaskId, reason });

        // Reset state
        this.currentTaskId = null;
        this.filesCreated.clear();
        this.filesModified.clear();
        this.filesDeleted.clear();
        this.fileChanges = [];
    }

    // =========================================================================
    // SESSION END
    // =========================================================================

    /**
     * End the coding session - finalize and cleanup
     */
    async endSession(): Promise<void> {
        console.log(`[CodingAgentWrapper] Ending session for ${this.config.agentId}`);

        // If there's an uncompleted task, mark as needs attention
        if (this.currentTaskId) {
            await this.artifactManager.appendProgressEntry({
                agentId: this.config.agentId!,
                agentType: this.config.agentType,
                taskId: this.currentTaskId,
                action: 'Session ended with task in progress',
                completed: [],
                filesModified: Array.from(this.filesModified),
                nextSteps: ['Continue task in next session'],
                blockers: ['Session ended prematurely'],
            });
        }

        // Update build state
        const lastCommit = await getLastCommitHash(this.config.projectPath);
        await this.artifactManager.saveBuildState({
            phase: 'session_end',
            status: this.tasksCompletedThisSession > 0 ? 'complete' : 'pending',
            devServer: 'unknown',
            build: 'unknown',
            tests: { passing: 0, failing: 0, pending: 0 },
            lastCommit,
        });

        // Final progress entry
        await this.artifactManager.appendProgressEntry({
            agentId: this.config.agentId!,
            agentType: this.config.agentType,
            action: `Session ended: ${this.tasksCompletedThisSession} tasks completed`,
            completed: [`Session duration: ${this.getSessionDuration()}`],
            filesModified: [],
            nextSteps: this.tasksCompletedThisSession > 0
                ? ['Continue with next task']
                : ['Retry incomplete tasks'],
        });

        this.emit('session_end', {
            agentId: this.config.agentId!,
            tasksCompleted: this.tasksCompletedThisSession,
        });

        console.log(`[CodingAgentWrapper] Session ended: ${this.tasksCompletedThisSession} tasks completed`);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Build context string for a specific task
     */
    private async buildTaskContext(task: TaskItem): Promise<string> {
        const contextParts: string[] = [];

        // Add task details
        contextParts.push(`Task: ${task.description}`);
        contextParts.push(`Category: ${task.category}`);
        contextParts.push(`Priority: ${task.priority}`);

        // Add dependencies status
        if (task.dependencies && task.dependencies.length > 0) {
            const taskList = await this.artifactManager.getTaskList();
            if (taskList) {
                const depStatuses = task.dependencies.map(depId => {
                    const dep = taskList.tasks.find(t => t.id === depId);
                    return dep ? `- ${dep.description}: ${dep.status}` : `- ${depId}: unknown`;
                });
                contextParts.push(`Dependencies:\n${depStatuses.join('\n')}`);
            }
        }

        // Add relevant progress history
        if (this.context?.progressLog) {
            const relevantProgress = this.context.progressLog
                .filter(p => p.taskId === task.id || task.dependencies?.includes(p.taskId || ''))
                .slice(-5);

            if (relevantProgress.length > 0) {
                contextParts.push('Related Progress:');
                for (const p of relevantProgress) {
                    contextParts.push(`- ${p.action} (${p.agentType})`);
                }
            }
        }

        return contextParts.join('\n');
    }

    /**
     * Describe expected output for a task
     */
    private describeExpectedOutput(task: TaskItem): string {
        const expectations: string[] = [];

        switch (task.category) {
            case 'setup':
                expectations.push('Configuration files created');
                expectations.push('Directory structure established');
                expectations.push('Dependencies installed (if applicable)');
                break;
            case 'feature':
                expectations.push('Feature fully implemented');
                expectations.push('Code follows project style');
                expectations.push('No placeholder or TODO comments');
                break;
            case 'integration':
                expectations.push('Components wired together');
                expectations.push('Routes configured');
                expectations.push('Data flows correctly');
                break;
            case 'testing':
                expectations.push('Tests passing');
                expectations.push('Coverage adequate');
                expectations.push('Edge cases handled');
                break;
            case 'deployment':
                expectations.push('Deployment configuration complete');
                expectations.push('Environment variables documented');
                expectations.push('Build succeeds');
                break;
        }

        return expectations.join('\n');
    }

    /**
     * Update feature status based on completed task
     */
    private async updateFeatureStatus(taskId: string, files: string[]): Promise<void> {
        // Get current feature list
        const featureListContent = await this.artifactManager.getArtifact('feature_list.json');
        if (!featureListContent) return;

        try {
            const featureList = JSON.parse(featureListContent);

            // Try to match task to a feature
            const taskList = await this.artifactManager.getTaskList();
            const task = taskList?.tasks.find(t => t.id === taskId);

            if (task && task.category === 'feature') {
                // Find matching feature
                const feature = featureList.features?.find(
                    (f: { name: string; description: string }) =>
                        task.description.toLowerCase().includes(f.name.toLowerCase()) ||
                        f.description.toLowerCase().includes(task.description.toLowerCase())
                );

                if (feature) {
                    feature.status = 'in_progress';
                    feature.notes = `Files: ${files.join(', ')}`;
                    featureList.lastUpdated = new Date().toISOString();

                    await this.artifactManager.saveArtifact(
                        'feature_list.json',
                        JSON.stringify(featureList, null, 2)
                    );
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    /**
     * Get session duration as string
     */
    private getSessionDuration(): string {
        if (!this.sessionStartTime) return 'unknown';

        const durationMs = Date.now() - this.sessionStartTime.getTime();
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Get the artifact manager for direct access
     */
    getArtifactManager(): ArtifactManager {
        return this.artifactManager;
    }

    /**
     * Get the OpenRouter client for direct AI calls
     */
    getOpenRouterClient() {
        return this.openRouterClient;
    }

    /**
     * Get agent configuration
     */
    getConfig(): CodingAgentConfig {
        return { ...this.config };
    }

    /**
     * Get session statistics
     */
    getSessionStats(): {
        agentId: string;
        agentType: string;
        sessionDuration: string;
        tasksCompleted: number;
        fileChanges: number;
        decisions: number;
    } {
        return {
            agentId: this.config.agentId!,
            agentType: this.config.agentType,
            sessionDuration: this.getSessionDuration(),
            tasksCompleted: this.tasksCompletedThisSession,
            fileChanges: this.fileChanges.length,
            decisions: this.decisions.length,
        };
    }

    // =========================================================================
    // SESSION 2: REAL-TIME CONTEXT UPDATES
    // =========================================================================

    /**
     * SESSION 2: Subscribe to real-time context updates from other agents
     * This enables "fingers of the same hand" awareness between parallel agents
     */
    private subscribeToContextUpdates(): void {
        // Generate unique subscription ID for this agent
        this.contextSubscriptionId = `${this.config.projectId}-${this.config.agentId}`;

        // Subscribe to local EventEmitter updates (managed by parent orchestrator)
        // Note: The orchestrator emits these events to its child agents
        console.log(`[CodingAgentWrapper] Context updates subscription ID: ${this.contextSubscriptionId}`);
        console.log(`[CodingAgentWrapper] Ready to receive context updates via parent orchestrator`);
    }

    /**
     * SESSION 2: Consume pending context updates for injection into next prompt
     */
    private consumePendingUpdates(): ContextUpdate[] {
        const updates = [...this.pendingContextUpdates];
        this.pendingContextUpdates = [];
        return updates;
    }

    /**
     * SESSION 2: Inject context updates from other agents into the prompt
     * This is called before executing each task to ensure agent awareness
     */
    public injectContextUpdates(prompt: string, updates?: ContextUpdate[]): string {
        const contextUpdates = updates || this.consumePendingUpdates();
        if (contextUpdates.length === 0) return prompt;

        const updateSummary = contextUpdates.map(u => {
            switch (u.type) {
                case 'agent:completed':
                    return `Agent ${u.fromAgentId} completed: ${(u.data as { summary?: string }).summary || 'task'}`;
                case 'file:modified':
                    return `File ${(u.data as { path?: string }).path} was modified by Agent ${u.fromAgentId}`;
                case 'error:resolved':
                    return `Error "${(u.data as { error?: string }).error}" was resolved with: ${(u.data as { solution?: string }).solution}`;
                case 'pattern:learned':
                    return `New pattern learned: ${(u.data as { pattern?: string }).pattern}`;
                case 'visual-verification':
                    return `Visual check: ${(u.data as { passed?: boolean }).passed ? 'PASSED' : 'FAILED'} (score: ${(u.data as { score?: number }).score})`;
                default:
                    return null;
            }
        }).filter(Boolean).join('\n');

        if (!updateSummary) return prompt;

        return `
## REAL-TIME CONTEXT FROM OTHER AGENTS
The following happened since your last action:
${updateSummary}

Take this into account as you work on your current task.

---

${prompt}
`;
    }

    /**
     * SESSION 2: Get the unified context (with patterns, strategies, etc.)
     */
    getUnifiedContext(): UnifiedContext | null {
        return this.unifiedContext;
    }

    /**
     * SESSION 2: Get system prompt with unified context (rich context injection)
     */
    getSystemPromptWithUnifiedContext(basePrompt: string): string {
        if (!this.unifiedContext) {
            throw new Error('Must call startSession() before getting unified prompt');
        }

        const contextSection = formatUnifiedContextForCodeGen(this.unifiedContext);
        const pendingUpdates = this.consumePendingUpdates();
        const updatesSection = pendingUpdates.length > 0 ? this.injectContextUpdates('', pendingUpdates) : '';

        return `${basePrompt}

═══════════════════════════════════════════════════════════════════════════════
UNIFIED PROJECT CONTEXT (Patterns, Strategies, Error History, Verification Results)
═══════════════════════════════════════════════════════════════════════════════

${contextSection}
${updatesSection}

═══════════════════════════════════════════════════════════════════════════════
IMPORTANT: You have access to learned patterns and strategies from previous builds.
Apply them to ensure high-quality code. Avoid patterns that have caused errors before.
═══════════════════════════════════════════════════════════════════════════════`;
    }

    /**
     * SESSION 2: Broadcast file modification to other agents
     * Emits locally for parent orchestrator to distribute
     */
    private broadcastFileModification(filePath: string, action: string): void {
        // Emit locally - parent orchestrator can distribute to other agents
        this.emit('file:modified', {
            agentId: this.config.agentId,
            path: filePath,
            action,
            timestamp: Date.now()
        });
    }

    /**
     * SESSION 2: Notify completion to other agents
     * Emits locally for parent orchestrator to distribute
     */
    private broadcastTaskComplete(summary: string): void {
        // Emit locally - parent orchestrator can distribute to other agents
        this.emit('agent:completed', {
            agentId: this.config.agentId,
            summary,
            timestamp: Date.now()
        });
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a CodingAgentWrapper instance
 */
export function createCodingAgentWrapper(config: CodingAgentConfig): CodingAgentWrapper {
    return new CodingAgentWrapper(config);
}

/**
 * Quick helper to run a single-task agent session
 */
export async function runSingleTaskSession(
    config: CodingAgentConfig,
    executor: (agent: CodingAgentWrapper, task: TaskItem) => Promise<{
        summary: string;
        filesCreated?: string[];
        filesModified?: string[];
        nextSteps?: string[];
    }>
): Promise<TaskResult> {
    const agent = createCodingAgentWrapper(config);

    try {
        // Start session
        await agent.startSession();

        // Claim task
        const task = await agent.claimTask();
        if (!task) {
            throw new Error('No tasks available');
        }

        // Execute the task
        const result = await executor(agent, task);

        // Complete the task
        return await agent.completeTask(result);

    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return {
            success: false,
            taskId: agent.getCurrentTask() || 'unknown',
            filesCreated: [],
            filesModified: [],
            filesDeleted: [],
            gitCommit: null,
            summary: 'Task failed',
            nextSteps: [],
            error: err.message,
        };
    } finally {
        await agent.endSession();
    }
}

export default CodingAgentWrapper;

