/**
 * Context Loader - Memory Harness for Long-Running Agents
 *
 * Loads project context from persistent artifacts for agent sessions.
 * Implements Anthropic's "Effective Harnesses for Long-Running Agents" pattern.
 *
 * CORE PRINCIPLE: Offload ALL state to persistent files.
 * Agents READ files at session start to reload context.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
    getGitLog,
    getGitDiff,
    hasGitRepo,
    type GitLogEntry,
} from './git-helper.js';

// =============================================================================
// TYPES
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

export interface FeatureItem {
    id: string;
    name: string;
    description: string;
    status: 'pending' | 'in_progress' | 'complete' | 'failed';
    passes: boolean;
    notes?: string;
    completedAt?: string;
    verifiedAt?: string;
}

export interface FeatureListState {
    projectId: string;
    features: FeatureItem[];
    completedCount: number;
    totalCount: number;
    lastUpdated: string;
}

export interface BuildState {
    phase: string;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    currentFeatureId?: string;
    progress: number;
    lastCheckpoint?: string;
    startedAt?: string;
    pausedAt?: string;
    completedAt?: string;
    errors: string[];
}

export interface IntentContract {
    version: string;
    projectName: string;
    description: string;
    primaryGoal: string;
    keyFeatures: string[];
    architecture: {
        patterns: string[];
        technologies: string[];
        stack: string[];
    };
    constraints: string[];
    successCriteria: string[];
    lockedAt: string;
    lockedBy: string;
}

export interface VerificationEntry {
    id: string;
    featureId: string;
    timestamp: string;
    agentId: string;
    type: 'error_check' | 'code_quality' | 'visual' | 'security' | 'placeholder' | 'design';
    result: 'pass' | 'fail' | 'warning';
    details: string;
    issues?: string[];
    fixes?: string[];
}

export interface IssueResolution {
    id: string;
    issueType: string;
    description: string;
    resolution: string;
    resolvedBy: string;
    resolvedAt: string;
    preventionStrategy?: string;
    affectedFiles: string[];
}

export interface ProgressEntry {
    timestamp: string;
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

export interface LoadedContext {
    progressLog: ProgressEntry[];
    progressLogRaw: string;
    currentTask: CurrentTask | null;
    taskList: TaskListState | null;
    featureList: FeatureListState | null;
    buildState: BuildState | null;
    intentContract: IntentContract | null;
    gitHistory: GitLogEntry[];
    gitDiff: string;
    verificationHistory: VerificationEntry[];
    issueResolutions: IssueResolution[];
    projectPath: string;
    hasContext: boolean;
}

export interface ContextLoadOptions {
    progressEntries?: number; // default 30
    gitLogEntries?: number; // default 20
    includeGitDiff?: boolean; // default true
    includeVerificationHistory?: boolean; // default true
    includeIssueResolutions?: boolean; // default true
}

// =============================================================================
// ARTIFACT PATHS
// =============================================================================

const ARTIFACT_PATHS = {
    progress: '.cursor/progress.txt',
    taskList: '.cursor/tasks/task_list.json',
    currentTask: '.cursor/tasks/current_task.json',
    featureList: 'feature_list.json',
    intent: 'intent.json',
    buildState: '.cursor/memory/build_state.json',
    verificationHistory: '.cursor/memory/verification_history.json',
    issueResolutions: '.cursor/memory/issue_resolutions.json',
    decisions: '.cursor/memory/decisions.json',
};

// =============================================================================
// FILE READING UTILITIES
// =============================================================================

/**
 * Read a JSON file, returning null if it doesn't exist or is invalid
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch (error) {
        // File doesn't exist or is invalid JSON
        return null;
    }
}

/**
 * Read a text file, returning empty string if it doesn't exist
 */
async function readTextFile(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch {
        return '';
    }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// =============================================================================
// PROGRESS LOG PARSING
// =============================================================================

/**
 * Parse progress.txt into structured entries
 * Format: ═══ [TIMESTAMP] ═══ followed by key: value lines
 */
function parseProgressLog(content: string, maxEntries: number = 30): ProgressEntry[] {
    if (!content.trim()) {
        return [];
    }

    const entries: ProgressEntry[] = [];
    const entryBlocks = content.split(/═{3,}\s*\[/).filter(Boolean);

    for (const block of entryBlocks.slice(-maxEntries)) {
        try {
            // Extract timestamp from first line
            const timestampMatch = block.match(/^([^\]]+)\]/);
            const timestamp = timestampMatch ? timestampMatch[1].trim() : new Date().toISOString();

            // Parse key: value lines
            const lines = block.split('\n').slice(1); // Skip timestamp line
            const entry: Partial<ProgressEntry> = {
                timestamp,
                completed: [],
                filesModified: [],
                nextSteps: [],
            };

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('═')) continue;

                // Handle multi-value fields
                if (trimmed.startsWith('COMPLETED:')) {
                    entry.action = trimmed.replace('COMPLETED:', '').trim();
                } else if (trimmed.startsWith('AGENT:')) {
                    const parts = trimmed.replace('AGENT:', '').trim().split(' ');
                    entry.agentId = parts[0] || 'unknown';
                    entry.agentType = parts[1] || 'unknown';
                } else if (trimmed.startsWith('TASK:')) {
                    entry.taskId = trimmed.replace('TASK:', '').trim();
                } else if (trimmed.startsWith('FILES MODIFIED:')) {
                    const files = trimmed.replace('FILES MODIFIED:', '').trim();
                    entry.filesModified = files.split(',').map(f => f.trim()).filter(Boolean);
                } else if (trimmed.startsWith('GIT COMMIT:')) {
                    entry.gitCommit = trimmed.replace('GIT COMMIT:', '').trim();
                } else if (trimmed.startsWith('NEXT:')) {
                    const next = trimmed.replace('NEXT:', '').trim();
                    entry.nextSteps = [next];
                } else if (trimmed.startsWith('BLOCKERS:')) {
                    const blockers = trimmed.replace('BLOCKERS:', '').trim();
                    entry.blockers = blockers.split(',').map(b => b.trim()).filter(Boolean);
                } else if (trimmed.startsWith('NOTES:') || trimmed.startsWith('CONTEXT:')) {
                    entry.notes = trimmed.split(':').slice(1).join(':').trim();
                } else if (trimmed.startsWith('- ')) {
                    // List item - add to completed
                    entry.completed?.push(trimmed.substring(2));
                }
            }

            if (entry.action || entry.completed?.length) {
                entries.push({
                    timestamp: entry.timestamp || new Date().toISOString(),
                    agentId: entry.agentId || 'system',
                    agentType: entry.agentType || 'unknown',
                    taskId: entry.taskId,
                    action: entry.action || 'progress',
                    completed: entry.completed || [],
                    filesModified: entry.filesModified || [],
                    gitCommit: entry.gitCommit,
                    nextSteps: entry.nextSteps || [],
                    blockers: entry.blockers,
                    notes: entry.notes,
                });
            }
        } catch (e) {
            // Skip malformed entries
            continue;
        }
    }

    return entries;
}

// =============================================================================
// MAIN CONTEXT LOADER
// =============================================================================

/**
 * Load all context for an agent session
 *
 * @param projectPath - Path to the project directory
 * @param options - Loading options
 * @returns Loaded context object
 */
export async function loadProjectContext(
    projectPath: string,
    options: ContextLoadOptions = {}
): Promise<LoadedContext> {
    const {
        progressEntries = 30,
        gitLogEntries = 20,
        includeGitDiff = true,
        includeVerificationHistory = true,
        includeIssueResolutions = true,
    } = options;

    console.log(`[ContextLoader] Loading context for ${projectPath}`);

    // Initialize with defaults
    const context: LoadedContext = {
        progressLog: [],
        progressLogRaw: '',
        currentTask: null,
        taskList: null,
        featureList: null,
        buildState: null,
        intentContract: null,
        gitHistory: [],
        gitDiff: '',
        verificationHistory: [],
        issueResolutions: [],
        projectPath,
        hasContext: false,
    };

    try {
        // Load progress.txt
        const progressPath = path.join(projectPath, ARTIFACT_PATHS.progress);
        context.progressLogRaw = await readTextFile(progressPath);
        context.progressLog = parseProgressLog(context.progressLogRaw, progressEntries);

        // Load task list
        const taskListPath = path.join(projectPath, ARTIFACT_PATHS.taskList);
        context.taskList = await readJsonFile<TaskListState>(taskListPath);

        // Load current task
        const currentTaskPath = path.join(projectPath, ARTIFACT_PATHS.currentTask);
        context.currentTask = await readJsonFile<CurrentTask>(currentTaskPath);

        // Load feature list
        const featureListPath = path.join(projectPath, ARTIFACT_PATHS.featureList);
        context.featureList = await readJsonFile<FeatureListState>(featureListPath);

        // Load intent contract
        const intentPath = path.join(projectPath, ARTIFACT_PATHS.intent);
        context.intentContract = await readJsonFile<IntentContract>(intentPath);

        // Load build state
        const buildStatePath = path.join(projectPath, ARTIFACT_PATHS.buildState);
        context.buildState = await readJsonFile<BuildState>(buildStatePath);

        // Load verification history
        if (includeVerificationHistory) {
            const verificationPath = path.join(projectPath, ARTIFACT_PATHS.verificationHistory);
            const history = await readJsonFile<{ entries: VerificationEntry[] }>(verificationPath);
            context.verificationHistory = history?.entries || [];
        }

        // Load issue resolutions
        if (includeIssueResolutions) {
            const issuesPath = path.join(projectPath, ARTIFACT_PATHS.issueResolutions);
            const issues = await readJsonFile<{ resolutions: IssueResolution[] }>(issuesPath);
            context.issueResolutions = issues?.resolutions || [];
        }

        // Load git history
        if (await hasGitRepo(projectPath)) {
            context.gitHistory = await getGitLog(projectPath, gitLogEntries);

            if (includeGitDiff) {
                context.gitDiff = await getGitDiff(projectPath);
            }
        }

        // Determine if context exists
        context.hasContext = !!(
            context.intentContract ||
            context.featureList ||
            context.taskList ||
            context.progressLog.length > 0
        );

        console.log(`[ContextLoader] Context loaded: hasContext=${context.hasContext}, ` +
            `progressEntries=${context.progressLog.length}, ` +
            `features=${context.featureList?.features.length || 0}, ` +
            `tasks=${context.taskList?.tasks.length || 0}`);

        return context;

    } catch (error) {
        console.error('[ContextLoader] Error loading context:', error);
        return context;
    }
}

// =============================================================================
// CONTEXT FORMATTING
// =============================================================================

/**
 * Format context for injection into agent system prompt
 * Full detailed format for comprehensive context
 */
export function formatContextForPrompt(context: LoadedContext): string {
    const sections: string[] = [];

    // Intent Contract
    if (context.intentContract) {
        sections.push(`## Project Intent (LOCKED CONTRACT)
Project: ${context.intentContract.projectName}
Goal: ${context.intentContract.primaryGoal}
Description: ${context.intentContract.description}

Key Features:
${context.intentContract.keyFeatures.map(f => `- ${f}`).join('\n')}

Architecture:
- Patterns: ${context.intentContract.architecture.patterns.join(', ')}
- Technologies: ${context.intentContract.architecture.technologies.join(', ')}
- Stack: ${context.intentContract.architecture.stack.join(', ')}

Constraints:
${context.intentContract.constraints.map(c => `- ${c}`).join('\n')}

Success Criteria:
${context.intentContract.successCriteria.map(c => `- ${c}`).join('\n')}

Locked At: ${context.intentContract.lockedAt}
`);
    }

    // Build State
    if (context.buildState) {
        sections.push(`## Current Build State
Phase: ${context.buildState.phase}
Status: ${context.buildState.status}
Progress: ${context.buildState.progress}%
${context.buildState.currentFeatureId ? `Current Feature: ${context.buildState.currentFeatureId}` : ''}
${context.buildState.lastCheckpoint ? `Last Checkpoint: ${context.buildState.lastCheckpoint}` : ''}
${context.buildState.errors.length > 0 ? `Errors: ${context.buildState.errors.join(', ')}` : ''}
`);
    }

    // Current Task
    if (context.currentTask) {
        sections.push(`## Current Task
ID: ${context.currentTask.taskId}
Description: ${context.currentTask.description}
Assigned To: ${context.currentTask.assignedAgent}
Context: ${context.currentTask.context}
Expected Output: ${context.currentTask.expectedOutput}
Started: ${context.currentTask.assignedAt}
`);
    }

    // Task List Summary
    if (context.taskList) {
        const pendingTasks = context.taskList.tasks.filter(t => t.status === 'pending');
        const inProgressTasks = context.taskList.tasks.filter(t => t.status === 'in_progress');
        const blockedTasks = context.taskList.tasks.filter(t => t.status === 'blocked');

        sections.push(`## Task List
Total: ${context.taskList.totalTasks} | Completed: ${context.taskList.completedTasks} | In Progress: ${inProgressTasks.length} | Blocked: ${blockedTasks.length}

${inProgressTasks.length > 0 ? `In Progress:
${inProgressTasks.map(t => `- [${t.id}] ${t.description} (${t.assignedAgent || 'unassigned'})`).join('\n')}` : ''}

${blockedTasks.length > 0 ? `Blocked:
${blockedTasks.map(t => `- [${t.id}] ${t.description} - ${t.blockedReason}`).join('\n')}` : ''}

Next Pending Tasks:
${pendingTasks.slice(0, 5).map(t => `- [${t.id}] ${t.description} (priority: ${t.priority})`).join('\n')}
`);
    }

    // Feature List Summary
    if (context.featureList) {
        const completedFeatures = context.featureList.features.filter(f => f.status === 'complete');
        const pendingFeatures = context.featureList.features.filter(f => f.status === 'pending');
        const inProgressFeatures = context.featureList.features.filter(f => f.status === 'in_progress');

        sections.push(`## Feature List
Total: ${context.featureList.totalCount} | Completed: ${completedFeatures.length} | In Progress: ${inProgressFeatures.length}

${inProgressFeatures.length > 0 ? `In Progress:
${inProgressFeatures.map(f => `- [${f.id}] ${f.name}: ${f.description}`).join('\n')}` : ''}

${pendingFeatures.slice(0, 5).length > 0 ? `Next Features:
${pendingFeatures.slice(0, 5).map(f => `- [${f.id}] ${f.name}`).join('\n')}` : ''}
`);
    }

    // Recent Progress
    if (context.progressLog.length > 0) {
        const recentProgress = context.progressLog.slice(-5);
        sections.push(`## Recent Progress (Last ${recentProgress.length} entries)
${recentProgress.map(p => `
[${p.timestamp}] ${p.agentType}
Action: ${p.action}
${p.filesModified.length > 0 ? `Files: ${p.filesModified.join(', ')}` : ''}
${p.gitCommit ? `Commit: ${p.gitCommit}` : ''}
${p.nextSteps.length > 0 ? `Next: ${p.nextSteps.join(', ')}` : ''}
${p.blockers?.length ? `Blockers: ${p.blockers.join(', ')}` : ''}
`).join('\n---\n')}
`);
    }

    // Git Status
    if (context.gitHistory.length > 0 || context.gitDiff) {
        sections.push(`## Git Status
${context.gitHistory.length > 0 ? `Recent Commits:
${context.gitHistory.slice(0, 5).map(c => `- ${c.shortHash} ${c.message}`).join('\n')}` : ''}

${context.gitDiff ? `Uncommitted Changes:
\`\`\`
${context.gitDiff}
\`\`\`` : 'No uncommitted changes'}
`);
    }

    // Recent Issues
    if (context.issueResolutions.length > 0) {
        const recentIssues = context.issueResolutions.slice(-3);
        sections.push(`## Recent Issue Resolutions
${recentIssues.map(i => `- [${i.issueType}] ${i.description}
  Resolution: ${i.resolution}
  ${i.preventionStrategy ? `Prevention: ${i.preventionStrategy}` : ''}`).join('\n\n')}
`);
    }

    return sections.join('\n\n---\n\n');
}

/**
 * Quick context summary for smaller prompts
 * Condensed format for token efficiency
 */
export function formatContextSummary(context: LoadedContext): string {
    const lines: string[] = [];

    if (context.intentContract) {
        lines.push(`PROJECT: ${context.intentContract.projectName} - ${context.intentContract.primaryGoal}`);
    }

    if (context.buildState) {
        lines.push(`BUILD: ${context.buildState.phase} (${context.buildState.status}) ${context.buildState.progress}%`);
    }

    if (context.currentTask) {
        lines.push(`CURRENT TASK: ${context.currentTask.description}`);
    }

    if (context.taskList) {
        lines.push(`TASKS: ${context.taskList.completedTasks}/${context.taskList.totalTasks} complete`);
    }

    if (context.featureList) {
        lines.push(`FEATURES: ${context.featureList.completedCount}/${context.featureList.totalCount} complete`);
    }

    if (context.progressLog.length > 0) {
        const lastProgress = context.progressLog[context.progressLog.length - 1];
        lines.push(`LAST ACTION: ${lastProgress.action} by ${lastProgress.agentType}`);
        if (lastProgress.nextSteps.length > 0) {
            lines.push(`NEXT: ${lastProgress.nextSteps[0]}`);
        }
    }

    if (context.gitHistory.length > 0) {
        lines.push(`LAST COMMIT: ${context.gitHistory[0].shortHash} ${context.gitHistory[0].message}`);
    }

    if (context.gitDiff) {
        lines.push(`UNCOMMITTED: Yes (see git diff --stat)`);
    }

    return lines.join('\n');
}

// =============================================================================
// CONTEXT EXISTENCE CHECK
// =============================================================================

/**
 * Check if context artifacts exist (determines if InitializerAgent needed)
 */
export async function hasProjectContext(projectPath: string): Promise<boolean> {
    // Check for key artifacts that indicate project has been initialized
    const checkPaths = [
        path.join(projectPath, ARTIFACT_PATHS.intent),
        path.join(projectPath, ARTIFACT_PATHS.featureList),
        path.join(projectPath, ARTIFACT_PATHS.buildState),
    ];

    for (const checkPath of checkPaths) {
        if (await fileExists(checkPath)) {
            return true;
        }
    }

    // Also check for progress.txt with content
    const progressPath = path.join(projectPath, ARTIFACT_PATHS.progress);
    const progressContent = await readTextFile(progressPath);
    if (progressContent.trim().length > 0) {
        return true;
    }

    return false;
}

/**
 * Get a list of missing artifacts
 */
export async function getMissingArtifacts(projectPath: string): Promise<string[]> {
    const missing: string[] = [];

    for (const [name, relativePath] of Object.entries(ARTIFACT_PATHS)) {
        const fullPath = path.join(projectPath, relativePath);
        if (!(await fileExists(fullPath))) {
            missing.push(name);
        }
    }

    return missing;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    ARTIFACT_PATHS,
    parseProgressLog,
    readJsonFile,
    readTextFile,
    fileExists,
};

export default {
    loadProjectContext,
    formatContextForPrompt,
    formatContextSummary,
    hasProjectContext,
    getMissingArtifacts,
    parseProgressLog,
    ARTIFACT_PATHS,
};

