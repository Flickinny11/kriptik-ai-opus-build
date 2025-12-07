/**
 * Git Branch Manager - Developer Mode Git Worktree Isolation
 *
 * Manages Git worktrees for agent isolation:
 * - Creates isolated worktrees for each agent
 * - Manages branch lifecycle (create, commit, merge)
 * - Handles conflict resolution
 * - Supports PR creation
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

// =============================================================================
// TYPES
// =============================================================================

export interface WorktreeConfig {
    projectPath: string;
    worktreesBasePath: string;
    defaultBranch: string;
}

export interface BranchInfo {
    name: string;
    isLocal: boolean;
    isRemote: boolean;
    isCurrent: boolean;
    lastCommit?: string;
    lastCommitDate?: string;
    author?: string;
}

export interface WorktreeInfo {
    path: string;
    branch: string;
    headCommit: string;
    isLocked: boolean;
    agentId?: string;
}

export interface CommitInfo {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
    filesChanged: string[];
}

export interface MergeResult {
    success: boolean;
    conflicts: string[];
    mergedFiles: string[];
    message: string;
}

export interface PRInfo {
    title: string;
    body: string;
    sourceBranch: string;
    targetBranch: string;
    commits: CommitInfo[];
    filesChanged: string[];
}

// =============================================================================
// GIT BRANCH MANAGER
// =============================================================================

export class GitBranchManager extends EventEmitter {
    private config: WorktreeConfig;
    private activeWorktrees: Map<string, WorktreeInfo> = new Map();

    constructor(config: WorktreeConfig) {
        super();
        this.config = config;
    }

    /**
     * Initialize the git branch manager
     */
    async initialize(): Promise<void> {
        // Ensure worktrees base path exists
        await fs.mkdir(this.config.worktreesBasePath, { recursive: true });

        // Load existing worktrees
        await this.refreshWorktrees();

        console.log(`[GitBranchManager] Initialized with ${this.activeWorktrees.size} active worktrees`);
    }

    /**
     * Create a new branch for an agent
     */
    async createAgentBranch(
        agentId: string,
        branchName: string,
        baseBranch?: string
    ): Promise<{ branch: string; worktreePath: string }> {
        const base = baseBranch || this.config.defaultBranch;
        const fullBranchName = branchName.startsWith('agent/') ? branchName : `agent/${branchName}`;

        try {
            // Ensure we're on the latest base branch
            await this.runGitCommand(`fetch origin ${base}`);

            // Create the new branch from base
            await this.runGitCommand(`checkout -b ${fullBranchName} origin/${base}`);

            // Create worktree for isolated work
            const worktreePath = path.join(this.config.worktreesBasePath, agentId);
            await this.runGitCommand(`worktree add ${worktreePath} ${fullBranchName}`);

            // Track the worktree
            this.activeWorktrees.set(agentId, {
                path: worktreePath,
                branch: fullBranchName,
                headCommit: await this.getHeadCommit(worktreePath),
                isLocked: false,
                agentId,
            });

            console.log(`[GitBranchManager] Created branch ${fullBranchName} with worktree at ${worktreePath}`);
            this.emit('branchCreated', { agentId, branch: fullBranchName, worktreePath });

            return { branch: fullBranchName, worktreePath };
        } catch (error: any) {
            console.error(`[GitBranchManager] Failed to create branch: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get worktree path for an agent
     */
    getAgentWorktreePath(agentId: string): string | null {
        return this.activeWorktrees.get(agentId)?.path || null;
    }

    /**
     * Get branch name for an agent
     */
    getAgentBranch(agentId: string): string | null {
        return this.activeWorktrees.get(agentId)?.branch || null;
    }

    /**
     * Commit changes in agent's worktree
     */
    async commitChanges(
        agentId: string,
        message: string,
        files?: string[]
    ): Promise<CommitInfo> {
        const worktree = this.activeWorktrees.get(agentId);
        if (!worktree) {
            throw new Error(`No worktree found for agent ${agentId}`);
        }

        try {
            // Stage files
            if (files && files.length > 0) {
                for (const file of files) {
                    await this.runGitCommandInWorktree(worktree.path, `add ${file}`);
                }
            } else {
                await this.runGitCommandInWorktree(worktree.path, 'add -A');
            }

            // Commit
            const sanitizedMessage = message.replace(/"/g, '\\"');
            await this.runGitCommandInWorktree(worktree.path, `commit -m "${sanitizedMessage}"`);

            // Get commit info
            const commitInfo = await this.getLatestCommit(worktree.path);

            console.log(`[GitBranchManager] Committed: ${commitInfo.shortHash} - ${message.substring(0, 50)}...`);
            this.emit('committed', { agentId, commit: commitInfo });

            return commitInfo;
        } catch (error: any) {
            console.error(`[GitBranchManager] Commit failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Push agent's branch to remote
     */
    async pushBranch(agentId: string): Promise<void> {
        const worktree = this.activeWorktrees.get(agentId);
        if (!worktree) {
            throw new Error(`No worktree found for agent ${agentId}`);
        }

        try {
            await this.runGitCommandInWorktree(worktree.path, `push -u origin ${worktree.branch}`);
            console.log(`[GitBranchManager] Pushed branch ${worktree.branch}`);
            this.emit('pushed', { agentId, branch: worktree.branch });
        } catch (error: any) {
            console.error(`[GitBranchManager] Push failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Merge agent's branch into target
     */
    async mergeBranch(
        agentId: string,
        targetBranch?: string,
        strategy: 'merge' | 'rebase' | 'squash' = 'squash'
    ): Promise<MergeResult> {
        const worktree = this.activeWorktrees.get(agentId);
        if (!worktree) {
            throw new Error(`No worktree found for agent ${agentId}`);
        }

        const target = targetBranch || this.config.defaultBranch;

        try {
            // Fetch latest
            await this.runGitCommand(`fetch origin ${target}`);

            // Checkout target branch
            await this.runGitCommand(`checkout ${target}`);
            await this.runGitCommand(`pull origin ${target}`);

            // Merge based on strategy
            let mergeCommand: string;
            if (strategy === 'squash') {
                mergeCommand = `merge --squash ${worktree.branch}`;
            } else if (strategy === 'rebase') {
                // For rebase, we'd need to handle differently
                mergeCommand = `merge ${worktree.branch}`;
            } else {
                mergeCommand = `merge --no-ff ${worktree.branch}`;
            }

            await this.runGitCommand(mergeCommand);

            // If squash, need to commit
            if (strategy === 'squash') {
                await this.runGitCommand(`commit -m "Merge ${worktree.branch} into ${target} (squashed)"`);
            }

            // Get merged files
            const mergedFiles = await this.getChangedFiles(worktree.path);

            console.log(`[GitBranchManager] Merged ${worktree.branch} into ${target}`);
            this.emit('merged', { agentId, sourceBranch: worktree.branch, targetBranch: target });

            return {
                success: true,
                conflicts: [],
                mergedFiles,
                message: `Successfully merged ${worktree.branch} into ${target}`,
            };
        } catch (error: any) {
            if (error.message.includes('CONFLICT')) {
                const conflicts = await this.getConflictedFiles();
                return {
                    success: false,
                    conflicts,
                    mergedFiles: [],
                    message: `Merge conflicts detected in ${conflicts.length} files`,
                };
            }
            throw error;
        }
    }

    /**
     * Create a PR info object (for use with external PR creation APIs)
     */
    async createPRInfo(
        agentId: string,
        title: string,
        bodyTemplate?: string
    ): Promise<PRInfo> {
        const worktree = this.activeWorktrees.get(agentId);
        if (!worktree) {
            throw new Error(`No worktree found for agent ${agentId}`);
        }

        // Get commits unique to this branch
        const commits = await this.getCommitsSinceBranch(worktree.path, this.config.defaultBranch);
        const filesChanged = await this.getChangedFiles(worktree.path);

        // Generate PR body
        const body = bodyTemplate || this.generatePRBody(commits, filesChanged);

        return {
            title,
            body,
            sourceBranch: worktree.branch,
            targetBranch: this.config.defaultBranch,
            commits,
            filesChanged,
        };
    }

    /**
     * Clean up agent's worktree and optionally delete branch
     */
    async cleanupAgentWorktree(
        agentId: string,
        deleteBranch: boolean = false
    ): Promise<void> {
        const worktree = this.activeWorktrees.get(agentId);
        if (!worktree) {
            return;
        }

        try {
            // Remove worktree
            await this.runGitCommand(`worktree remove ${worktree.path} --force`);

            // Optionally delete branch
            if (deleteBranch) {
                await this.runGitCommand(`branch -D ${worktree.branch}`);
            }

            this.activeWorktrees.delete(agentId);
            console.log(`[GitBranchManager] Cleaned up worktree for agent ${agentId}`);
            this.emit('worktreeRemoved', { agentId, branch: worktree.branch });
        } catch (error: any) {
            console.error(`[GitBranchManager] Cleanup failed: ${error.message}`);
        }
    }

    /**
     * Get status of agent's worktree
     */
    async getWorktreeStatus(agentId: string): Promise<{
        branch: string;
        hasChanges: boolean;
        stagedFiles: string[];
        unstagedFiles: string[];
        untrackedFiles: string[];
    } | null> {
        const worktree = this.activeWorktrees.get(agentId);
        if (!worktree) {
            return null;
        }

        try {
            const { stdout } = await execAsync('git status --porcelain', { cwd: worktree.path });

            const stagedFiles: string[] = [];
            const unstagedFiles: string[] = [];
            const untrackedFiles: string[] = [];

            for (const line of stdout.split('\n').filter(l => l.trim())) {
                const status = line.substring(0, 2);
                const file = line.substring(3);

                if (status.startsWith('?')) {
                    untrackedFiles.push(file);
                } else if (status[0] !== ' ') {
                    stagedFiles.push(file);
                } else if (status[1] !== ' ') {
                    unstagedFiles.push(file);
                }
            }

            return {
                branch: worktree.branch,
                hasChanges: stagedFiles.length + unstagedFiles.length + untrackedFiles.length > 0,
                stagedFiles,
                unstagedFiles,
                untrackedFiles,
            };
        } catch (error: any) {
            console.error(`[GitBranchManager] Failed to get status: ${error.message}`);
            return null;
        }
    }

    /**
     * List all branches
     */
    async listBranches(): Promise<BranchInfo[]> {
        try {
            const { stdout } = await execAsync(
                'git branch -a --format="%(refname:short)|%(objectname:short)|%(authordate:relative)|%(authorname)"',
                { cwd: this.config.projectPath }
            );

            const currentBranch = await this.getCurrentBranch();

            return stdout.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const [name, commit, date, author] = line.split('|');
                    return {
                        name: name.replace('origin/', ''),
                        isLocal: !name.startsWith('origin/'),
                        isRemote: name.startsWith('origin/'),
                        isCurrent: name === currentBranch,
                        lastCommit: commit,
                        lastCommitDate: date,
                        author,
                    };
                });
        } catch (error: any) {
            console.error(`[GitBranchManager] Failed to list branches: ${error.message}`);
            return [];
        }
    }

    /**
     * Refresh worktree list from git
     */
    async refreshWorktrees(): Promise<void> {
        try {
            const { stdout } = await execAsync('git worktree list --porcelain', {
                cwd: this.config.projectPath
            });

            this.activeWorktrees.clear();

            const lines = stdout.split('\n');
            let currentWorktree: Partial<WorktreeInfo> = {};

            for (const line of lines) {
                if (line.startsWith('worktree ')) {
                    if (currentWorktree.path) {
                        // Skip the main worktree
                        if (currentWorktree.path !== this.config.projectPath) {
                            const agentId = path.basename(currentWorktree.path);
                            this.activeWorktrees.set(agentId, currentWorktree as WorktreeInfo);
                        }
                    }
                    currentWorktree = { path: line.substring(9) };
                } else if (line.startsWith('HEAD ')) {
                    currentWorktree.headCommit = line.substring(5);
                } else if (line.startsWith('branch ')) {
                    currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
                } else if (line === 'locked') {
                    currentWorktree.isLocked = true;
                }
            }

            // Don't forget the last one
            if (currentWorktree.path && currentWorktree.path !== this.config.projectPath) {
                const agentId = path.basename(currentWorktree.path);
                this.activeWorktrees.set(agentId, currentWorktree as WorktreeInfo);
            }
        } catch (error: any) {
            console.error(`[GitBranchManager] Failed to refresh worktrees: ${error.message}`);
        }
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    private async runGitCommand(command: string): Promise<string> {
        const { stdout } = await execAsync(`git ${command}`, {
            cwd: this.config.projectPath,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        return stdout.trim();
    }

    private async runGitCommandInWorktree(worktreePath: string, command: string): Promise<string> {
        const { stdout } = await execAsync(`git ${command}`, {
            cwd: worktreePath,
            maxBuffer: 10 * 1024 * 1024,
        });
        return stdout.trim();
    }

    private async getHeadCommit(worktreePath: string): Promise<string> {
        return this.runGitCommandInWorktree(worktreePath, 'rev-parse HEAD');
    }

    private async getCurrentBranch(): Promise<string> {
        return this.runGitCommand('rev-parse --abbrev-ref HEAD');
    }

    private async getLatestCommit(worktreePath: string): Promise<CommitInfo> {
        const format = '%H|%h|%s|%an|%ad';
        const { stdout } = await execAsync(
            `git log -1 --format="${format}" --date=iso`,
            { cwd: worktreePath }
        );

        const [hash, shortHash, message, author, date] = stdout.trim().split('|');
        const filesChanged = await this.getChangedFiles(worktreePath);

        return {
            hash,
            shortHash,
            message,
            author,
            date,
            filesChanged,
        };
    }

    private async getChangedFiles(worktreePath: string): Promise<string[]> {
        try {
            const { stdout } = await execAsync(
                `git diff --name-only HEAD~1`,
                { cwd: worktreePath }
            );
            return stdout.trim().split('\n').filter(f => f);
        } catch {
            return [];
        }
    }

    private async getConflictedFiles(): Promise<string[]> {
        try {
            const { stdout } = await execAsync(
                'git diff --name-only --diff-filter=U',
                { cwd: this.config.projectPath }
            );
            return stdout.trim().split('\n').filter(f => f);
        } catch {
            return [];
        }
    }

    private async getCommitsSinceBranch(worktreePath: string, baseBranch: string): Promise<CommitInfo[]> {
        try {
            const format = '%H|%h|%s|%an|%ad';
            const { stdout } = await execAsync(
                `git log origin/${baseBranch}..HEAD --format="${format}" --date=iso`,
                { cwd: worktreePath }
            );

            return stdout.trim().split('\n').filter(l => l).map(line => {
                const [hash, shortHash, message, author, date] = line.split('|');
                return { hash, shortHash, message, author, date, filesChanged: [] };
            });
        } catch {
            return [];
        }
    }

    private generatePRBody(commits: CommitInfo[], filesChanged: string[]): string {
        const commitList = commits
            .map(c => `- ${c.shortHash}: ${c.message}`)
            .join('\n');

        const fileList = filesChanged
            .map(f => `- \`${f}\``)
            .join('\n');

        return `## Summary

This PR was created by a Developer Mode agent.

## Commits

${commitList}

## Files Changed

${fileList}

---
*Generated by KripTik AI Developer Mode*`;
    }
}

/**
 * Create a GitBranchManager instance
 */
export function createGitBranchManager(config: WorktreeConfig): GitBranchManager {
    return new GitBranchManager(config);
}

