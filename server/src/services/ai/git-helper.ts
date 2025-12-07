/**
 * Git Integration Helper - Memory Harness Support
 *
 * Git operations for the Anthropic-style memory harness.
 * Enables git-aware snapshots and context tracking.
 *
 * Reference: Anthropic's "Effective Harnesses for Long-Running Agents"
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// =============================================================================
// TYPES
// =============================================================================

export interface GitLogEntry {
    hash: string;
    shortHash: string;
    message: string;
    author?: string;
    date?: string;
}

export interface GitStatus {
    hasChanges: boolean;
    staged: string[];
    unstaged: string[];
    untracked: string[];
}

export interface GitCommitResult {
    success: boolean;
    hash: string;
    message: string;
    error?: string;
}

// =============================================================================
// GIT INITIALIZATION
// =============================================================================

/**
 * Initialize a git repository for a project
 * Creates .gitignore, initializes git, and makes initial commit
 */
export async function initializeGitRepo(projectPath: string): Promise<void> {
    try {
        // Check if already a git repo
        const isGitRepo = await hasGitRepo(projectPath);
        if (isGitRepo) {
            console.log(`[GitHelper] Git repo already exists at ${projectPath}`);
            return;
        }

        // Create .gitignore
        const gitignorePath = path.join(projectPath, '.gitignore');
        const gitignoreContent = generateGitignore();
        await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');

        // Initialize git
        await execAsync('git init', { cwd: projectPath });
        console.log(`[GitHelper] Initialized git repo at ${projectPath}`);

        // Configure user if not set (for sandboxed environments)
        try {
            await execAsync('git config user.email "kriptik@kriptik.ai"', { cwd: projectPath });
            await execAsync('git config user.name "KripTik AI"', { cwd: projectPath });
        } catch (e) {
            // May already be configured globally
        }

        // Initial commit
        await execAsync('git add -A', { cwd: projectPath });
        await execAsync('git commit -m "Initial commit by KripTik AI"', { cwd: projectPath });
        console.log(`[GitHelper] Created initial commit`);

    } catch (error) {
        console.error('[GitHelper] Failed to initialize git repo:', error);
        throw error;
    }
}

/**
 * Check if a directory is a git repository
 */
export async function hasGitRepo(projectPath: string): Promise<boolean> {
    try {
        const gitPath = path.join(projectPath, '.git');
        const stat = await fs.stat(gitPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

// =============================================================================
// GIT LOG OPERATIONS
// =============================================================================

/**
 * Get git log entries
 * @param projectPath - Path to the project
 * @param count - Number of entries to retrieve (default 20)
 */
export async function getGitLog(projectPath: string, count: number = 20): Promise<GitLogEntry[]> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return [];
        }

        // Get detailed log with format
        const { stdout } = await execAsync(
            `git log --oneline -${count} --format="%H|%h|%s|%an|%ai"`,
            { cwd: projectPath }
        );

        if (!stdout.trim()) {
            return [];
        }

        const entries: GitLogEntry[] = stdout.trim().split('\n').map(line => {
            const parts = line.split('|');
            return {
                hash: parts[0] || '',
                shortHash: parts[1] || '',
                message: parts[2] || '',
                author: parts[3] || undefined,
                date: parts[4] || undefined,
            };
        });

        return entries;

    } catch (error) {
        // Repository may have no commits yet
        console.warn('[GitHelper] Failed to get git log:', (error as Error).message);
        return [];
    }
}

/**
 * Get simple git log (oneline format)
 */
export async function getGitLogOneline(projectPath: string, count: number = 20): Promise<string[]> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return [];
        }

        const { stdout } = await execAsync(
            `git log --oneline -${count}`,
            { cwd: projectPath }
        );

        if (!stdout.trim()) {
            return [];
        }

        return stdout.trim().split('\n');

    } catch (error) {
        return [];
    }
}

// =============================================================================
// GIT DIFF OPERATIONS
// =============================================================================

/**
 * Get git diff stat for uncommitted changes
 */
export async function getGitDiff(projectPath: string): Promise<string> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return '';
        }

        const { stdout } = await execAsync(
            'git diff --stat',
            { cwd: projectPath }
        );

        return stdout.trim();

    } catch (error) {
        console.warn('[GitHelper] Failed to get git diff:', (error as Error).message);
        return '';
    }
}

/**
 * Get full git diff for uncommitted changes
 */
export async function getGitDiffFull(projectPath: string, staged: boolean = false): Promise<string> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return '';
        }

        const cmd = staged ? 'git diff --staged' : 'git diff';
        const { stdout } = await execAsync(cmd, { cwd: projectPath });

        return stdout;

    } catch (error) {
        return '';
    }
}

/**
 * Get diff for a specific file
 */
export async function getFileDiff(projectPath: string, filePath: string): Promise<string> {
    try {
        const { stdout } = await execAsync(
            `git diff -- "${filePath}"`,
            { cwd: projectPath }
        );
        return stdout;
    } catch {
        return '';
    }
}

// =============================================================================
// GIT STATUS OPERATIONS
// =============================================================================

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(projectPath: string): Promise<boolean> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return false;
        }

        const { stdout } = await execAsync(
            'git status --porcelain',
            { cwd: projectPath }
        );

        return stdout.trim().length > 0;

    } catch (error) {
        return false;
    }
}

/**
 * Get detailed git status
 */
export async function getGitStatus(projectPath: string): Promise<GitStatus> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return { hasChanges: false, staged: [], unstaged: [], untracked: [] };
        }

        const { stdout } = await execAsync(
            'git status --porcelain',
            { cwd: projectPath }
        );

        if (!stdout.trim()) {
            return { hasChanges: false, staged: [], unstaged: [], untracked: [] };
        }

        const lines = stdout.trim().split('\n');
        const staged: string[] = [];
        const unstaged: string[] = [];
        const untracked: string[] = [];

        for (const line of lines) {
            const status = line.substring(0, 2);
            const file = line.substring(3);

            if (status === '??') {
                untracked.push(file);
            } else if (status[0] !== ' ' && status[0] !== '?') {
                staged.push(file);
            }
            if (status[1] !== ' ' && status[1] !== '?') {
                unstaged.push(file);
            }
        }

        return {
            hasChanges: true,
            staged,
            unstaged,
            untracked,
        };

    } catch (error) {
        return { hasChanges: false, staged: [], unstaged: [], untracked: [] };
    }
}

// =============================================================================
// GIT COMMIT OPERATIONS
// =============================================================================

/**
 * Commit all changes
 * @param projectPath - Path to the project
 * @param message - Commit message
 * @returns Commit hash
 */
export async function commitChanges(projectPath: string, message: string): Promise<string> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            await initializeGitRepo(projectPath);
        }

        // Stage all changes
        await execAsync('git add -A', { cwd: projectPath });

        // Check if there are staged changes
        const hasStaged = await hasUncommittedChanges(projectPath);
        if (!hasStaged) {
            console.log('[GitHelper] No changes to commit');
            return await getLastCommitHash(projectPath) || '';
        }

        // Commit
        const escapedMessage = message.replace(/"/g, '\\"');
        await execAsync(`git commit -m "${escapedMessage}"`, { cwd: projectPath });

        // Get the commit hash
        const hash = await getLastCommitHash(projectPath);
        console.log(`[GitHelper] Committed: ${hash?.substring(0, 8)} - ${message}`);

        return hash || '';

    } catch (error) {
        console.error('[GitHelper] Failed to commit:', error);
        throw error;
    }
}

/**
 * Commit specific files
 */
export async function commitFiles(
    projectPath: string,
    files: string[],
    message: string
): Promise<string> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            await initializeGitRepo(projectPath);
        }

        // Stage specific files
        for (const file of files) {
            await execAsync(`git add "${file}"`, { cwd: projectPath });
        }

        // Commit
        const escapedMessage = message.replace(/"/g, '\\"');
        await execAsync(`git commit -m "${escapedMessage}"`, { cwd: projectPath });

        return await getLastCommitHash(projectPath) || '';

    } catch (error) {
        console.error('[GitHelper] Failed to commit files:', error);
        throw error;
    }
}

/**
 * Get the last commit hash
 */
export async function getLastCommitHash(projectPath: string): Promise<string | null> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return null;
        }

        const { stdout } = await execAsync(
            'git rev-parse HEAD',
            { cwd: projectPath }
        );

        return stdout.trim() || null;

    } catch (error) {
        return null;
    }
}

/**
 * Get the short commit hash
 */
export async function getLastCommitShortHash(projectPath: string): Promise<string | null> {
    try {
        const hash = await getLastCommitHash(projectPath);
        return hash ? hash.substring(0, 7) : null;
    } catch {
        return null;
    }
}

// =============================================================================
// GIT BRANCH OPERATIONS
// =============================================================================

/**
 * Get current branch name
 */
export async function getCurrentBranch(projectPath: string): Promise<string | null> {
    try {
        const isGitRepo = await hasGitRepo(projectPath);
        if (!isGitRepo) {
            return null;
        }

        const { stdout } = await execAsync(
            'git branch --show-current',
            { cwd: projectPath }
        );

        return stdout.trim() || null;

    } catch {
        return null;
    }
}

/**
 * Create a new branch
 */
export async function createBranch(projectPath: string, branchName: string): Promise<void> {
    try {
        await execAsync(`git checkout -b ${branchName}`, { cwd: projectPath });
    } catch (error) {
        console.error('[GitHelper] Failed to create branch:', error);
        throw error;
    }
}

/**
 * Checkout a branch
 */
export async function checkoutBranch(projectPath: string, branchName: string): Promise<void> {
    try {
        await execAsync(`git checkout ${branchName}`, { cwd: projectPath });
    } catch (error) {
        console.error('[GitHelper] Failed to checkout branch:', error);
        throw error;
    }
}

// =============================================================================
// GITIGNORE GENERATION
// =============================================================================

/**
 * Generate standard .gitignore for KripTik projects
 */
export function generateGitignore(): string {
    return `# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
.next/
out/
.nuxt/
.output/
.vercel/
.netlify/

# Testing
coverage/
.nyc_output/

# Environment files
.env
.env.local
.env.*.local
.env.development
.env.production
*.env

# IDE & Editor
.idea/
.vscode/
*.swp
*.swo
*~
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Cache
.cache/
.parcel-cache/
.eslintcache
.stylelintcache
*.tsbuildinfo

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db

# Temporary files
tmp/
temp/
*.tmp
*.temp

# KripTik AI specific
.kriptik-cache/
.sandbox/
*.generated.ts
*.generated.tsx

# Secrets (never commit these!)
secrets/
*.pem
*.key
*.cert
service-account.json
`;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Reset to a specific commit
 */
export async function resetToCommit(
    projectPath: string,
    commitHash: string,
    hard: boolean = false
): Promise<void> {
    try {
        const mode = hard ? '--hard' : '--soft';
        await execAsync(`git reset ${mode} ${commitHash}`, { cwd: projectPath });
    } catch (error) {
        console.error('[GitHelper] Failed to reset:', error);
        throw error;
    }
}

/**
 * Stash changes
 */
export async function stashChanges(projectPath: string, message?: string): Promise<void> {
    try {
        const cmd = message ? `git stash push -m "${message}"` : 'git stash';
        await execAsync(cmd, { cwd: projectPath });
    } catch (error) {
        console.error('[GitHelper] Failed to stash:', error);
        throw error;
    }
}

/**
 * Pop stashed changes
 */
export async function popStash(projectPath: string): Promise<void> {
    try {
        await execAsync('git stash pop', { cwd: projectPath });
    } catch (error) {
        console.error('[GitHelper] Failed to pop stash:', error);
        throw error;
    }
}

/**
 * Get file content at a specific commit
 */
export async function getFileAtCommit(
    projectPath: string,
    filePath: string,
    commitHash: string
): Promise<string | null> {
    try {
        const { stdout } = await execAsync(
            `git show ${commitHash}:"${filePath}"`,
            { cwd: projectPath }
        );
        return stdout;
    } catch {
        return null;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    initializeGitRepo,
    hasGitRepo,
    getGitLog,
    getGitLogOneline,
    getGitDiff,
    getGitDiffFull,
    getFileDiff,
    hasUncommittedChanges,
    getGitStatus,
    commitChanges,
    commitFiles,
    getLastCommitHash,
    getLastCommitShortHash,
    getCurrentBranch,
    createBranch,
    checkoutBranch,
    generateGitignore,
    resetToCommit,
    stashChanges,
    popStash,
    getFileAtCommit,
};

