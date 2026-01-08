/**
 * GitHub Pusher Service for External App Integration
 *
 * Handles pushing wiring changes back to GitHub repositories,
 * including creating branches and pull requests.
 */

import { v4 as uuidv4 } from 'uuid';
import { Octokit } from '@octokit/rest';
import type { FileModification } from './model-wiring.js';

// Types
export interface PushConfig {
    appId: string;
    repoUrl: string;
    branch: string;
    baseBranch?: string;
    changes: FileChange[];
    commitMessage: string;
    createPR?: boolean;
    prTitle?: string;
    prBody?: string;
}

export interface FileChange {
    path: string;
    content: string;
    operation: 'create' | 'update' | 'delete';
}

export interface PushResult {
    id: string;
    success: boolean;
    branchUrl: string;
    commitSha: string;
    prUrl?: string;
    prNumber?: number;
    error?: string;
    changedFiles: string[];
    timestamp: string;
}

export interface BranchInfo {
    name: string;
    sha: string;
    protected: boolean;
}

export interface CommitInfo {
    sha: string;
    message: string;
    author: string;
    date: string;
}

export class GitHubPusher {
    private octokit: Octokit;

    constructor(githubToken: string) {
        this.octokit = new Octokit({ auth: githubToken });
    }

    /**
     * Push changes to a GitHub repository
     */
    async pushChanges(config: PushConfig): Promise<PushResult> {
        const result: PushResult = {
            id: uuidv4(),
            success: false,
            branchUrl: '',
            commitSha: '',
            changedFiles: [],
            timestamp: new Date().toISOString(),
        };

        try {
            const { owner, repo } = this.parseRepoUrl(config.repoUrl);
            const baseBranch = config.baseBranch || 'main';
            const targetBranch = config.branch;

            console.log(`[GitHubPusher] Pushing to ${owner}/${repo} branch ${targetBranch}`);

            // Get the base branch reference
            const baseBranchRef = await this.getBranchRef(owner, repo, baseBranch);
            if (!baseBranchRef) {
                throw new Error(`Base branch '${baseBranch}' not found`);
            }

            // Check if target branch exists, if not create it
            let targetBranchRef = await this.getBranchRef(owner, repo, targetBranch);
            if (!targetBranchRef) {
                console.log(`[GitHubPusher] Creating new branch: ${targetBranch}`);
                targetBranchRef = await this.createBranch(owner, repo, targetBranch, baseBranchRef.sha);
            }

            // Get the current tree SHA
            const { data: baseCommit } = await this.octokit.git.getCommit({
                owner,
                repo,
                commit_sha: targetBranchRef.sha,
            });

            // Create blobs for each file change
            const treeItems: Array<{
                path: string;
                mode: '100644' | '100755' | '040000' | '160000' | '120000';
                type: 'blob' | 'tree' | 'commit';
                sha?: string | null;
            }> = [];

            for (const change of config.changes) {
                if (change.operation === 'delete') {
                    // For deletion, we set sha to null
                    treeItems.push({
                        path: change.path,
                        mode: '100644',
                        type: 'blob',
                        sha: null,
                    });
                } else {
                    // Create blob for the file content
                    const { data: blob } = await this.octokit.git.createBlob({
                        owner,
                        repo,
                        content: Buffer.from(change.content).toString('base64'),
                        encoding: 'base64',
                    });

                    treeItems.push({
                        path: change.path,
                        mode: '100644',
                        type: 'blob',
                        sha: blob.sha,
                    });
                }

                result.changedFiles.push(change.path);
            }

            // Create new tree
            const { data: newTree } = await this.octokit.git.createTree({
                owner,
                repo,
                base_tree: baseCommit.tree.sha,
                tree: treeItems,
            });

            // Create commit
            const { data: newCommit } = await this.octokit.git.createCommit({
                owner,
                repo,
                message: config.commitMessage,
                tree: newTree.sha,
                parents: [targetBranchRef.sha],
            });

            // Update branch reference
            await this.octokit.git.updateRef({
                owner,
                repo,
                ref: `heads/${targetBranch}`,
                sha: newCommit.sha,
            });

            result.commitSha = newCommit.sha;
            result.branchUrl = `https://github.com/${owner}/${repo}/tree/${targetBranch}`;
            result.success = true;

            console.log(`[GitHubPusher] Commit created: ${newCommit.sha}`);

            // Create pull request if requested
            if (config.createPR && targetBranch !== baseBranch) {
                try {
                    const prResult = await this.createPullRequest(
                        owner,
                        repo,
                        targetBranch,
                        baseBranch,
                        config.prTitle || config.commitMessage,
                        config.prBody || this.generatePRBody(config.changes)
                    );

                    result.prUrl = prResult.html_url;
                    result.prNumber = prResult.number;
                    console.log(`[GitHubPusher] PR created: ${prResult.html_url}`);
                } catch (prError) {
                    // PR creation failed, but changes were pushed
                    console.warn(`[GitHubPusher] PR creation failed: ${prError instanceof Error ? prError.message : 'Unknown error'}`);
                }
            }

            return result;
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[GitHubPusher] Push failed: ${result.error}`);
            return result;
        }
    }

    /**
     * Create a new branch
     */
    private async createBranch(
        owner: string,
        repo: string,
        branchName: string,
        baseSha: string
    ): Promise<{ sha: string }> {
        const { data } = await this.octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseSha,
        });

        return { sha: data.object.sha };
    }

    /**
     * Get branch reference
     */
    private async getBranchRef(
        owner: string,
        repo: string,
        branch: string
    ): Promise<{ sha: string } | null> {
        try {
            const { data } = await this.octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${branch}`,
            });

            return { sha: data.object.sha };
        } catch (error) {
            // Branch doesn't exist
            return null;
        }
    }

    /**
     * Create a pull request
     */
    private async createPullRequest(
        owner: string,
        repo: string,
        head: string,
        base: string,
        title: string,
        body: string
    ): Promise<{ html_url: string; number: number }> {
        // Check if PR already exists
        const { data: existingPRs } = await this.octokit.pulls.list({
            owner,
            repo,
            head: `${owner}:${head}`,
            base,
            state: 'open',
        });

        if (existingPRs.length > 0) {
            // Update existing PR
            return {
                html_url: existingPRs[0].html_url,
                number: existingPRs[0].number,
            };
        }

        // Create new PR
        const { data } = await this.octokit.pulls.create({
            owner,
            repo,
            title,
            body,
            head,
            base,
        });

        return {
            html_url: data.html_url,
            number: data.number,
        };
    }

    /**
     * Generate PR body from changes
     */
    private generatePRBody(changes: FileChange[]): string {
        const created = changes.filter((c) => c.operation === 'create');
        const updated = changes.filter((c) => c.operation === 'update');
        const deleted = changes.filter((c) => c.operation === 'delete');

        let body = `## 🤖 KripTik AI Model Integration

This PR was automatically generated by KripTik AI to wire a deployed model to your application.

### Changes Summary

`;

        if (created.length > 0) {
            body += `#### New Files\n`;
            created.forEach((c) => {
                body += `- \`${c.path}\`\n`;
            });
            body += '\n';
        }

        if (updated.length > 0) {
            body += `#### Modified Files\n`;
            updated.forEach((c) => {
                body += `- \`${c.path}\`\n`;
            });
            body += '\n';
        }

        if (deleted.length > 0) {
            body += `#### Deleted Files\n`;
            deleted.forEach((c) => {
                body += `- \`${c.path}\`\n`;
            });
            body += '\n';
        }

        body += `### Next Steps

1. Review the changes in this PR
2. Add the required environment variables to your deployment
3. Test the integration in your development environment
4. Merge when ready!

---
*Generated by [KripTik AI](https://kriptik.ai)*
`;

        return body;
    }

    /**
     * List branches in a repository
     */
    async listBranches(repoUrl: string): Promise<BranchInfo[]> {
        const { owner, repo } = this.parseRepoUrl(repoUrl);

        const { data } = await this.octokit.repos.listBranches({
            owner,
            repo,
            per_page: 100,
        });

        return data.map((branch) => ({
            name: branch.name,
            sha: branch.commit.sha,
            protected: branch.protected,
        }));
    }

    /**
     * Get recent commits
     */
    async getRecentCommits(repoUrl: string, branch?: string, count = 10): Promise<CommitInfo[]> {
        const { owner, repo } = this.parseRepoUrl(repoUrl);

        const { data } = await this.octokit.repos.listCommits({
            owner,
            repo,
            sha: branch,
            per_page: count,
        });

        return data.map((commit) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: commit.commit.author?.name || 'Unknown',
            date: commit.commit.author?.date || '',
        }));
    }

    /**
     * Check if user has write access to repo
     */
    async hasWriteAccess(repoUrl: string): Promise<boolean> {
        const { owner, repo } = this.parseRepoUrl(repoUrl);

        try {
            const { data } = await this.octokit.repos.get({
                owner,
                repo,
            });

            return data.permissions?.push || data.permissions?.admin || false;
        } catch {
            return false;
        }
    }

    /**
     * Convert file modifications from wiring to file changes
     */
    static fileModificationsToChanges(modifications: FileModification[]): FileChange[] {
        return modifications.map((mod) => ({
            path: mod.path,
            content: mod.modifiedContent,
            operation: mod.originalContent ? 'update' : 'create',
        }));
    }

    /**
     * Parse GitHub URL to owner and repo
     */
    private parseRepoUrl(url: string): { owner: string; repo: string } {
        const patterns = [
            /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
            /^([^/]+)\/([^/]+)$/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
            }
        }

        throw new Error(`Invalid GitHub URL: ${url}`);
    }
}

// Factory function
export function createGitHubPusher(githubToken: string): GitHubPusher {
    return new GitHubPusher(githubToken);
}
