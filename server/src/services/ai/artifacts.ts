/**
 * Progress Artifacts Manager - Artifact-Based Handoff System
 *
 * Manages human-readable handoff notes (claude-progress.txt) and other artifacts
 * that enable context persistence across sessions and agent handoffs.
 *
 * Core artifacts:
 * - intent.json: The Sacred Contract (from Intent Lock)
 * - feature_list.json: Feature tracking with passes: true/false
 * - style_guide.json: Design system from App Soul
 * - .cursor/progress.txt: Human-readable session log
 * - .cursor/tasks/task_list.json: Task queue management
 * - .cursor/tasks/current_task.json: Currently executing task
 * - .cursor/memory/build_state.json: Current build state
 * - .cursor/memory/verification_history.json: Verification results
 * - .cursor/memory/issue_resolutions.json: How issues were resolved
 *
 * Reference: Anthropic's "Effective Harnesses for Long-Running Agents"
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db.js';
import { files } from '../../schema.js';
import type { IntentContract } from './intent-lock.js';
import type { FeatureListSummary } from './feature-list.js';
import { commitChanges, getLastCommitHash } from './git-helper.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SessionLog {
    sessionId: string;
    agentId: string;
    projectId: string;
    orchestrationRunId: string;
    completed: string[];
    filesModified: string[];
    currentState: BuildState;
    nextSteps: string[];
    context: string;
    blockers: string[];
    timestamp: Date;
}

export interface BuildState {
    phase: string;
    status: 'pending' | 'in_progress' | 'complete' | 'failed';
    devServer: 'running' | 'stopped' | 'unknown';
    build: 'passing' | 'failing' | 'unknown';
    tests: {
        passing: number;
        failing: number;
        pending: number;
    };
    lastCommit: string | null;
}

export interface IssueResolution {
    id: string;
    errorType: string;
    errorMessage: string;
    solution: string;
    filesAffected: string[];
    resolvedAt: Date;
    resolutionMethod: 'auto_fix' | 'escalation' | 'manual';
    escalationLevel?: number;
}

export interface VerificationHistoryEntry {
    featureId: string;
    agentType: string;
    result: 'passed' | 'failed';
    score?: number;
    details?: string;
    timestamp: Date;
}

export interface ProjectArtifacts {
    intentJson: string | null;
    featureListJson: string | null;
    styleGuideJson: string | null;
    progressTxt: string | null;
    taskListJson: string | null;
    currentTaskJson: string | null;
    buildStateJson: string | null;
    verificationHistoryJson: string | null;
    issueResolutionsJson: string | null;
}

// =============================================================================
// TASK MANAGEMENT TYPES
// =============================================================================

export interface TaskItem {
    id: string;
    description: string;
    category: 'setup' | 'feature' | 'integration' | 'testing' | 'deployment';
    status: 'pending' | 'in_progress' | 'complete' | 'blocked';
    priority: number;
    assignedAgent?: string;
    startedAt?: string;
    completedAt?: string;
    blockedReason?: string;
    dependencies?: string[]; // task IDs this depends on
    summary?: string; // Completion summary
}

export interface TaskListState {
    projectId: string;
    orchestrationRunId: string;
    tasks: TaskItem[];
    currentTaskIndex: number;
    totalTasks: number;
    completedTasks: number;
    createdAt: string;
    updatedAt: string;
}

export interface CurrentTask {
    taskId: string;
    description: string;
    assignedAgent: string;
    assignedAt: string;
    context: string; // What the agent needs to know
    expectedOutput: string; // What success looks like
}

export interface ProgressEntry {
    agentId: string;
    agentType: string;
    taskId?: string;
    action: string;
    completed: string[];
    filesModified: string[];
    gitCommit?: string;
    nextSteps: string[];
    blockers?: string[];
    notes?: string;
}

export interface GitAwareSnapshot {
    snapshotId: string;
    commitHash: string;
    artifacts: ProjectArtifacts;
    timestamp: string;
}

// =============================================================================
// ARTIFACT MANAGER
// =============================================================================

export class ArtifactManager {
    private projectId: string;
    private orchestrationRunId: string;
    private userId: string;

    constructor(projectId: string, orchestrationRunId: string, userId: string) {
        this.projectId = projectId;
        this.orchestrationRunId = orchestrationRunId;
        this.userId = userId;
    }

    // =========================================================================
    // SESSION LOG (claude-progress.txt)
    // =========================================================================

    /**
     * Create a new session log entry
     */
    async createSessionLog(log: Omit<SessionLog, 'timestamp'>): Promise<void> {
        const timestamp = new Date();
        const entry = this.formatSessionLogEntry({ ...log, timestamp });

        // Get existing progress file
        const existing = await this.getArtifact('.cursor/progress.txt');
        const content = existing
            ? `${existing}\n\n${entry}`
            : this.createProgressFileHeader() + entry;

        await this.saveArtifact('.cursor/progress.txt', content);
    }

    /**
     * Format a session log entry for claude-progress.txt
     */
    private formatSessionLogEntry(log: SessionLog): string {
        return `═══ SESSION LOG ═══
Session: ${log.sessionId} (${log.agentId}) - ${log.timestamp.toISOString()}
${'─'.repeat(50)}

COMPLETED THIS SESSION:
${log.completed.map(c => `✓ ${c}`).join('\n')}

FILES MODIFIED:
${log.filesModified.map(f => `- ${f}`).join('\n')}

CURRENT STATE:
- Phase: ${log.currentState.phase} (${log.currentState.status})
- Dev server: ${log.currentState.devServer}
- Build: ${log.currentState.build}
- Tests: ${log.currentState.tests.passing}/${log.currentState.tests.passing + log.currentState.tests.failing + log.currentState.tests.pending} passing
${log.currentState.lastCommit ? `- Last commit: ${log.currentState.lastCommit}` : ''}

${log.context ? `CONTEXT:\n${log.context}\n` : ''}
${log.blockers.length > 0 ? `BLOCKERS:\n${log.blockers.map(b => `⚠️ ${b}`).join('\n')}\n` : ''}
NEXT STEPS:
${log.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${'─'.repeat(50)}`;
    }

    /**
     * Create the header for a new progress file
     */
    private createProgressFileHeader(): string {
        return `╔══════════════════════════════════════════════════════════════════╗
║               KRIPTIK AI BUILD PROGRESS LOG                       ║
║                  Ultimate Builder Architecture                     ║
╚══════════════════════════════════════════════════════════════════╝

Project ID: ${this.projectId}
Orchestration Run: ${this.orchestrationRunId}
Created: ${new Date().toISOString()}

This file contains human-readable session logs for agent handoff.
Each session records what was completed, current state, and next steps.

════════════════════════════════════════════════════════════════════

`;
    }

    // =========================================================================
    // BUILD STATE
    // =========================================================================

    /**
     * Save current build state
     */
    async saveBuildState(state: BuildState): Promise<void> {
        await this.saveArtifact('.cursor/memory/build_state.json', JSON.stringify({
            ...state,
            lastUpdated: new Date().toISOString(),
        }, null, 2));
    }

    /**
     * Get current build state
     */
    async getBuildState(): Promise<BuildState | null> {
        const content = await this.getArtifact('.cursor/memory/build_state.json');
        if (!content) return null;
        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    // =========================================================================
    // VERIFICATION HISTORY
    // =========================================================================

    /**
     * Add a verification history entry
     */
    async addVerificationEntry(entry: Omit<VerificationHistoryEntry, 'timestamp'>): Promise<void> {
        const history = await this.getVerificationHistory();
        history.push({ ...entry, timestamp: new Date() });

        await this.saveArtifact('.cursor/memory/verification_history.json', JSON.stringify(history, null, 2));
    }

    /**
     * Get verification history
     */
    async getVerificationHistory(): Promise<VerificationHistoryEntry[]> {
        const content = await this.getArtifact('.cursor/memory/verification_history.json');
        if (!content) return [];
        try {
            return JSON.parse(content);
        } catch {
            return [];
        }
    }

    // =========================================================================
    // ISSUE RESOLUTIONS
    // =========================================================================

    /**
     * Add an issue resolution
     */
    async addIssueResolution(resolution: Omit<IssueResolution, 'id' | 'resolvedAt'>): Promise<void> {
        const resolutions = await this.getIssueResolutions();
        resolutions.push({
            ...resolution,
            id: crypto.randomUUID(),
            resolvedAt: new Date(),
        });

        await this.saveArtifact('.cursor/memory/issue_resolutions.json', JSON.stringify(resolutions, null, 2));
    }

    /**
     * Get issue resolutions
     */
    async getIssueResolutions(): Promise<IssueResolution[]> {
        const content = await this.getArtifact('.cursor/memory/issue_resolutions.json');
        if (!content) return [];
        try {
            return JSON.parse(content);
        } catch {
            return [];
        }
    }

    /**
     * Find similar past issue resolution
     */
    async findSimilarResolution(errorType: string, errorMessage: string): Promise<IssueResolution | null> {
        const resolutions = await this.getIssueResolutions();

        // Simple similarity matching - could be enhanced with embeddings
        return resolutions.find(r =>
            r.errorType === errorType ||
            r.errorMessage.toLowerCase().includes(errorMessage.toLowerCase().substring(0, 50))
        ) || null;
    }

    // =========================================================================
    // ARTIFACT STORAGE
    // =========================================================================

    /**
     * Save an artifact to the project files
     */
    async saveArtifact(path: string, content: string): Promise<void> {
        const existing = await db.select()
            .from(files)
            .where(eq(files.projectId, this.projectId))
            .limit(1);

        const fileExists = existing.some(f => f.path === path);

        if (fileExists) {
            await db.update(files)
                .set({
                    content,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(files.path, path));
        } else {
            await db.insert(files).values({
                id: crypto.randomUUID(),
                projectId: this.projectId,
                path,
                content,
                language: this.inferLanguage(path),
                version: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    /**
     * Get an artifact from project files
     */
    async getArtifact(path: string): Promise<string | null> {
        const results = await db.select()
            .from(files)
            .where(eq(files.projectId, this.projectId))
            .limit(100);

        const file = results.find(f => f.path === path);
        return file?.content || null;
    }

    /**
     * Get all artifacts
     */
    async getAllArtifacts(): Promise<ProjectArtifacts> {
        return {
            intentJson: await this.getArtifact('intent.json'),
            featureListJson: await this.getArtifact('feature_list.json'),
            styleGuideJson: await this.getArtifact('style_guide.json'),
            progressTxt: await this.getArtifact('.cursor/progress.txt'),
            taskListJson: await this.getArtifact('.cursor/tasks/task_list.json'),
            currentTaskJson: await this.getArtifact('.cursor/tasks/current_task.json'),
            buildStateJson: await this.getArtifact('.cursor/memory/build_state.json'),
            verificationHistoryJson: await this.getArtifact('.cursor/memory/verification_history.json'),
            issueResolutionsJson: await this.getArtifact('.cursor/memory/issue_resolutions.json'),
        };
    }

    /**
     * Initialize all artifact files for a new build
     */
    async initializeArtifacts(intent: IntentContract): Promise<void> {
        // Create directory structure in files
        const now = new Date().toISOString();

        // Save intent.json
        await this.saveArtifact('intent.json', JSON.stringify({
            id: intent.id,
            appType: intent.appType,
            appSoul: intent.appSoul,
            coreValueProp: intent.coreValueProp,
            successCriteria: intent.successCriteria,
            userWorkflows: intent.userWorkflows,
            visualIdentity: intent.visualIdentity,
            antiPatterns: intent.antiPatterns,
            locked: intent.locked,
            createdAt: intent.createdAt,
        }, null, 2));

        // Initialize empty feature list
        await this.saveArtifact('feature_list.json', JSON.stringify({
            orchestrationRunId: this.orchestrationRunId,
            projectId: this.projectId,
            summary: { total: 0, passed: 0, pending: 0, passRate: 0 },
            features: [],
            lastUpdated: now,
        }, null, 2));

        // Initialize build state
        await this.saveBuildState({
            phase: 'initialization',
            status: 'in_progress',
            devServer: 'stopped',
            build: 'unknown',
            tests: { passing: 0, failing: 0, pending: 0 },
            lastCommit: null,
        });

        // Initialize empty verification history
        await this.saveArtifact('.cursor/memory/verification_history.json', '[]');

        // Initialize empty issue resolutions
        await this.saveArtifact('.cursor/memory/issue_resolutions.json', '[]');

        // Create progress file header
        await this.saveArtifact('.cursor/progress.txt', this.createProgressFileHeader());

        console.log('[Artifacts] Initialized all artifact files');
    }

    /**
     * Generate a commit message based on recent changes
     */
    async generateCommitMessage(completed: string[]): Promise<string> {
        if (completed.length === 0) {
            return 'chore: update build artifacts';
        }

        const main = completed[0];
        const others = completed.slice(1);

        let message = main;
        if (others.length > 0) {
            message += `\n\n- ${others.join('\n- ')}`;
        }

        return message;
    }

    /**
     * Create a snapshot of all artifacts for checkpointing
     */
    async createSnapshot(): Promise<{
        intentJson?: object;
        featureListJson?: object;
        styleGuideJson?: object;
        progressTxt?: string;
        buildStateJson?: object;
    }> {
        const artifacts = await this.getAllArtifacts();

        return {
            intentJson: artifacts.intentJson ? JSON.parse(artifacts.intentJson) : undefined,
            featureListJson: artifacts.featureListJson ? JSON.parse(artifacts.featureListJson) : undefined,
            styleGuideJson: artifacts.styleGuideJson ? JSON.parse(artifacts.styleGuideJson) : undefined,
            progressTxt: artifacts.progressTxt || undefined,
            buildStateJson: artifacts.buildStateJson ? JSON.parse(artifacts.buildStateJson) : undefined,
        };
    }

    /**
     * Restore artifacts from a snapshot
     */
    async restoreFromSnapshot(snapshot: {
        intentJson?: object;
        featureListJson?: object;
        styleGuideJson?: object;
        progressTxt?: string;
        buildStateJson?: object;
    }): Promise<void> {
        if (snapshot.intentJson) {
            await this.saveArtifact('intent.json', JSON.stringify(snapshot.intentJson, null, 2));
        }
        if (snapshot.featureListJson) {
            await this.saveArtifact('feature_list.json', JSON.stringify(snapshot.featureListJson, null, 2));
        }
        if (snapshot.styleGuideJson) {
            await this.saveArtifact('style_guide.json', JSON.stringify(snapshot.styleGuideJson, null, 2));
        }
        if (snapshot.progressTxt) {
            await this.saveArtifact('.cursor/progress.txt', snapshot.progressTxt);
        }
        if (snapshot.buildStateJson) {
            await this.saveArtifact('.cursor/memory/build_state.json', JSON.stringify(snapshot.buildStateJson, null, 2));
        }

        console.log('[Artifacts] Restored from snapshot');
    }

    /**
     * Infer file language from path
     */
    private inferLanguage(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase();
        const mapping: Record<string, string> = {
            json: 'json',
            txt: 'text',
            md: 'markdown',
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            css: 'css',
            html: 'html',
        };
        return mapping[ext || ''] || 'text';
    }

    // =========================================================================
    // TASK LIST MANAGEMENT
    // =========================================================================

    /**
     * Initialize task list with a set of tasks
     */
    async initializeTaskList(tasks: Omit<TaskItem, 'id' | 'status'>[]): Promise<void> {
        const now = new Date().toISOString();
        const taskItems: TaskItem[] = tasks.map((task, index) => ({
            ...task,
            id: `task-${index + 1}-${Date.now()}`,
            status: 'pending' as const,
        }));

        const taskList: TaskListState = {
            projectId: this.projectId,
            orchestrationRunId: this.orchestrationRunId,
            tasks: taskItems,
            currentTaskIndex: 0,
            totalTasks: taskItems.length,
            completedTasks: 0,
            createdAt: now,
            updatedAt: now,
        };

        await this.saveArtifact('.cursor/tasks/task_list.json', JSON.stringify(taskList, null, 2));
        console.log(`[Artifacts] Initialized task list with ${taskItems.length} tasks`);
    }

    /**
     * Get the current task list
     */
    async getTaskList(): Promise<TaskListState | null> {
        const content = await this.getArtifact('.cursor/tasks/task_list.json');
        if (!content) return null;
        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    /**
     * Get the next pending task that has all dependencies satisfied
     */
    async getNextPendingTask(): Promise<TaskItem | null> {
        const taskList = await this.getTaskList();
        if (!taskList) return null;

        const completedIds = new Set(
            taskList.tasks
                .filter(t => t.status === 'complete')
                .map(t => t.id)
        );

        // Find first pending task with satisfied dependencies
        const pendingTasks = taskList.tasks
            .filter(t => t.status === 'pending')
            .sort((a, b) => a.priority - b.priority);

        for (const task of pendingTasks) {
            const deps = task.dependencies || [];
            const allDepsSatisfied = deps.every(depId => completedIds.has(depId));
            if (allDepsSatisfied) {
                return task;
            }
        }

        return null;
    }

    /**
     * Mark a task as in progress
     */
    async markTaskInProgress(taskId: string, agentId: string): Promise<void> {
        const taskList = await this.getTaskList();
        if (!taskList) {
            throw new Error('Task list not found');
        }

        const task = taskList.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.status = 'in_progress';
        task.assignedAgent = agentId;
        task.startedAt = new Date().toISOString();
        taskList.updatedAt = new Date().toISOString();

        await this.saveArtifact('.cursor/tasks/task_list.json', JSON.stringify(taskList, null, 2));
        console.log(`[Artifacts] Task ${taskId} marked in progress by ${agentId}`);
    }

    /**
     * Mark a task as complete
     */
    async markTaskComplete(taskId: string, summary: string): Promise<void> {
        const taskList = await this.getTaskList();
        if (!taskList) {
            throw new Error('Task list not found');
        }

        const task = taskList.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.status = 'complete';
        task.completedAt = new Date().toISOString();
        task.summary = summary;
        taskList.completedTasks = taskList.tasks.filter(t => t.status === 'complete').length;
        taskList.updatedAt = new Date().toISOString();

        await this.saveArtifact('.cursor/tasks/task_list.json', JSON.stringify(taskList, null, 2));
        console.log(`[Artifacts] Task ${taskId} marked complete: ${summary}`);
    }

    /**
     * Mark a task as blocked
     */
    async markTaskBlocked(taskId: string, reason: string): Promise<void> {
        const taskList = await this.getTaskList();
        if (!taskList) {
            throw new Error('Task list not found');
        }

        const task = taskList.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.status = 'blocked';
        task.blockedReason = reason;
        taskList.updatedAt = new Date().toISOString();

        await this.saveArtifact('.cursor/tasks/task_list.json', JSON.stringify(taskList, null, 2));
        console.log(`[Artifacts] Task ${taskId} marked blocked: ${reason}`);
    }

    /**
     * Add a new task to the task list
     * @returns The ID of the new task
     */
    async addTask(task: Omit<TaskItem, 'id'>): Promise<string> {
        let taskList = await this.getTaskList();

        if (!taskList) {
            // Initialize empty task list first
            taskList = {
                projectId: this.projectId,
                orchestrationRunId: this.orchestrationRunId,
                tasks: [],
                currentTaskIndex: 0,
                totalTasks: 0,
                completedTasks: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
        }

        const newId = `task-${taskList.tasks.length + 1}-${Date.now()}`;
        const newTask: TaskItem = {
            ...task,
            id: newId,
        };

        taskList.tasks.push(newTask);
        taskList.totalTasks = taskList.tasks.length;
        taskList.updatedAt = new Date().toISOString();

        await this.saveArtifact('.cursor/tasks/task_list.json', JSON.stringify(taskList, null, 2));
        console.log(`[Artifacts] Added new task: ${newId} - ${task.description}`);

        return newId;
    }

    // =========================================================================
    // CURRENT TASK TRACKING
    // =========================================================================

    /**
     * Set the current task being worked on
     */
    async setCurrentTask(task: CurrentTask): Promise<void> {
        await this.saveArtifact('.cursor/tasks/current_task.json', JSON.stringify(task, null, 2));
        console.log(`[Artifacts] Current task set: ${task.taskId} - ${task.description}`);
    }

    /**
     * Get the current task being worked on
     */
    async getCurrentTask(): Promise<CurrentTask | null> {
        const content = await this.getArtifact('.cursor/tasks/current_task.json');
        if (!content) return null;
        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    /**
     * Clear the current task (when complete or reassigning)
     */
    async clearCurrentTask(): Promise<void> {
        // Save empty object to indicate no current task
        await this.saveArtifact('.cursor/tasks/current_task.json', JSON.stringify(null));
        console.log('[Artifacts] Current task cleared');
    }

    // =========================================================================
    // ENHANCED PROGRESS LOGGING (Append-only)
    // =========================================================================

    /**
     * Append a progress entry to the progress log
     * This is an append-only log for context continuity
     */
    async appendProgressEntry(entry: ProgressEntry): Promise<void> {
        const timestamp = new Date().toISOString();

        // Format the entry as a clear, parseable block
        const formattedEntry = `
═══ [${timestamp}] ═══
AGENT: ${entry.agentId} ${entry.agentType}
${entry.taskId ? `TASK: ${entry.taskId}` : ''}
COMPLETED: ${entry.action}
${entry.completed.length > 0 ? entry.completed.map(c => `- ${c}`).join('\n') : ''}
FILES MODIFIED: ${entry.filesModified.join(', ') || 'None'}
${entry.gitCommit ? `GIT COMMIT: ${entry.gitCommit}` : ''}
NEXT: ${entry.nextSteps.join(', ') || 'Continue with plan'}
${entry.blockers?.length ? `BLOCKERS: ${entry.blockers.join(', ')}` : ''}
${entry.notes ? `NOTES: ${entry.notes}` : ''}
CONTEXT: Session active, context persisted to artifacts
`;

        // Append to existing progress file
        const existing = await this.getArtifact('.cursor/progress.txt');
        const newContent = existing
            ? `${existing}\n${formattedEntry}`
            : this.createProgressFileHeader() + formattedEntry;

        await this.saveArtifact('.cursor/progress.txt', newContent);
        console.log(`[Artifacts] Appended progress entry for ${entry.agentType}`);
    }

    // =========================================================================
    // GIT-AWARE SNAPSHOTS
    // =========================================================================

    /**
     * Create a git-aware snapshot with commit
     * @param commitMessage - Message for the git commit
     * @param projectPath - Path to the project directory (for git operations)
     */
    async createGitAwareSnapshot(
        commitMessage: string,
        projectPath?: string
    ): Promise<GitAwareSnapshot> {
        const timestamp = new Date().toISOString();
        const snapshotId = `snapshot-${Date.now()}`;

        // Get all current artifacts
        const artifacts = await this.getAllArtifacts();

        // Commit changes if project path is provided
        let commitHash = '';
        if (projectPath) {
            try {
                commitHash = await commitChanges(projectPath, commitMessage);
            } catch (error) {
                console.warn('[Artifacts] Git commit failed:', error);
                // Try to get last commit hash anyway
                const lastHash = await getLastCommitHash(projectPath);
                commitHash = lastHash || '';
            }
        }

        // Create snapshot record
        const snapshot: GitAwareSnapshot = {
            snapshotId,
            commitHash,
            artifacts,
            timestamp,
        };

        // Save snapshot to memory
        const existingSnapshots = await this.getSnapshots();
        existingSnapshots.push(snapshot);

        await this.saveArtifact(
            '.cursor/memory/snapshots.json',
            JSON.stringify(existingSnapshots.slice(-10), null, 2) // Keep last 10
        );

        // Append to progress log
        await this.appendProgressEntry({
            agentId: 'system',
            agentType: 'snapshot',
            action: `Created snapshot: ${commitMessage}`,
            completed: [`Snapshot ${snapshotId} created`],
            filesModified: [],
            gitCommit: commitHash || undefined,
            nextSteps: ['Continue with build'],
        });

        console.log(`[Artifacts] Created git-aware snapshot: ${snapshotId} (${commitHash || 'no commit'})`);

        return snapshot;
    }

    /**
     * Get all snapshots
     */
    async getSnapshots(): Promise<GitAwareSnapshot[]> {
        const content = await this.getArtifact('.cursor/memory/snapshots.json');
        if (!content) return [];
        try {
            return JSON.parse(content);
        } catch {
            return [];
        }
    }

    /**
     * Get the latest snapshot
     */
    async getLatestSnapshot(): Promise<GitAwareSnapshot | null> {
        const snapshots = await this.getSnapshots();
        return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    }
}

/**
 * Create an ArtifactManager instance
 */
export function createArtifactManager(
    projectId: string,
    orchestrationRunId: string,
    userId: string
): ArtifactManager {
    return new ArtifactManager(projectId, orchestrationRunId, userId);
}

/**
 * Create a session log entry helper
 */
export function createSessionLogEntry(
    sessionId: string,
    agentId: string,
    params: {
        completed: string[];
        filesModified: string[];
        currentState: BuildState;
        nextSteps: string[];
        context?: string;
        blockers?: string[];
    }
): Omit<SessionLog, 'projectId' | 'orchestrationRunId' | 'timestamp'> {
    return {
        sessionId,
        agentId,
        completed: params.completed,
        filesModified: params.filesModified,
        currentState: params.currentState,
        nextSteps: params.nextSteps,
        context: params.context || '',
        blockers: params.blockers || [],
    };
}

