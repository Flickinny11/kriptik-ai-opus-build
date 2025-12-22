/**
 * GitHub Repository Service
 *
 * Manages GitHub repository operations:
 * - Create repositories
 * - Push files to repos
 * - Manage branches
 * - Get repo information
 */

import { Octokit } from '@octokit/rest';
import crypto from 'crypto';
import { db } from '../../db.js';
import { projectGithubRepos, files } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { getGitHubAuthService } from './github-auth-service.js';

export interface RepoInfo {
    owner: string;
    name: string;
    url: string;
    defaultBranch: string;
    isPrivate: boolean;
}

export interface PushResult {
    success: boolean;
    commitSha: string;
    commitUrl: string;
    filesChanged: number;
}

export interface ProjectRepoLink {
    id: string;
    projectId: string;
    repoOwner: string;
    repoName: string;
    defaultBranch: string | null;
    isPrivate: boolean | null;
    repoUrl: string | null;
    lastPushedAt: string | null;
    lastPushCommitSha: string | null;
    createdAt: string;
    updatedAt: string;
}

export class GitHubRepoService {
    private authService = getGitHubAuthService();

    /**
     * Create a new GitHub repository
     */
    async createRepo(
        accessToken: string,
        name: string,
        description: string,
        isPrivate: boolean = true
    ): Promise<RepoInfo> {
        const octokit = new Octokit({ auth: accessToken });

        // Sanitize repo name (GitHub requirements)
        const sanitizedName = name
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 100);

        const { data: repo } = await octokit.repos.createForAuthenticatedUser({
            name: sanitizedName,
            description,
            private: isPrivate,
            auto_init: true, // Initialize with README
            gitignore_template: 'Node',
            license_template: 'mit',
        });

        return {
            owner: repo.owner.login,
            name: repo.name,
            url: repo.html_url,
            defaultBranch: repo.default_branch || 'main',
            isPrivate: repo.private,
        };
    }

    /**
     * Push files to a GitHub repository
     */
    async pushToRepo(
        accessToken: string,
        owner: string,
        repo: string,
        branch: string,
        filesToPush: Array<{ path: string; content: string }>,
        commitMessage: string = 'Update from KripTik AI'
    ): Promise<PushResult> {
        const octokit = new Octokit({ auth: accessToken });

        // Get the latest commit SHA on the branch
        let baseSha: string;
        let baseTreeSha: string;

        try {
            const { data: ref } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${branch}`,
            });
            baseSha = ref.object.sha;

            // Get the tree for the base commit
            const { data: commit } = await octokit.git.getCommit({
                owner,
                repo,
                commit_sha: baseSha,
            });
            baseTreeSha = commit.tree.sha;
        } catch (error: any) {
            // Branch doesn't exist, try to get default branch
            if (error.status === 404) {
                try {
                    const { data: defaultRef } = await octokit.git.getRef({
                        owner,
                        repo,
                        ref: 'heads/main',
                    });
                    baseSha = defaultRef.object.sha;

                    const { data: commit } = await octokit.git.getCommit({
                        owner,
                        repo,
                        commit_sha: baseSha,
                    });
                    baseTreeSha = commit.tree.sha;
                } catch {
                    // Try master as fallback
                    const { data: masterRef } = await octokit.git.getRef({
                        owner,
                        repo,
                        ref: 'heads/master',
                    });
                    baseSha = masterRef.object.sha;

                    const { data: commit } = await octokit.git.getCommit({
                        owner,
                        repo,
                        commit_sha: baseSha,
                    });
                    baseTreeSha = commit.tree.sha;
                }
            } else {
                throw error;
            }
        }

        // Create blobs for each file
        const blobs = await Promise.all(
            filesToPush.map(async (file) => {
                const { data: blob } = await octokit.git.createBlob({
                    owner,
                    repo,
                    content: Buffer.from(file.content).toString('base64'),
                    encoding: 'base64',
                });
                return {
                    path: file.path.replace(/^\//, ''), // Remove leading slash
                    sha: blob.sha,
                    mode: '100644' as const,
                    type: 'blob' as const,
                };
            })
        );

        // Create a new tree
        const { data: tree } = await octokit.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: blobs,
        });

        // Create a commit
        const { data: commit } = await octokit.git.createCommit({
            owner,
            repo,
            message: commitMessage,
            tree: tree.sha,
            parents: [baseSha],
        });

        // Update the branch reference (or create it if it doesn't exist)
        try {
            await octokit.git.updateRef({
                owner,
                repo,
                ref: `heads/${branch}`,
                sha: commit.sha,
            });
        } catch (error: any) {
            if (error.status === 422) {
                // Branch doesn't exist, create it
                await octokit.git.createRef({
                    owner,
                    repo,
                    ref: `refs/heads/${branch}`,
                    sha: commit.sha,
                });
            } else {
                throw error;
            }
        }

        return {
            success: true,
            commitSha: commit.sha,
            commitUrl: commit.html_url,
            filesChanged: filesToPush.length,
        };
    }

    /**
     * Get repository information
     */
    async getRepoInfo(accessToken: string, owner: string, repo: string): Promise<RepoInfo | null> {
        try {
            const octokit = new Octokit({ auth: accessToken });
            const { data } = await octokit.repos.get({ owner, repo });

            return {
                owner: data.owner.login,
                name: data.name,
                url: data.html_url,
                defaultBranch: data.default_branch || 'main',
                isPrivate: data.private,
            };
        } catch {
            return null;
        }
    }

    /**
     * List user's repositories
     */
    async listUserRepos(
        accessToken: string,
        page: number = 1,
        perPage: number = 30
    ): Promise<RepoInfo[]> {
        const octokit = new Octokit({ auth: accessToken });

        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            sort: 'updated',
            direction: 'desc',
            page,
            per_page: perPage,
        });

        return repos.map(repo => ({
            owner: repo.owner.login,
            name: repo.name,
            url: repo.html_url,
            defaultBranch: repo.default_branch || 'main',
            isPrivate: repo.private,
        }));
    }

    /**
     * Link a project to a GitHub repository
     */
    async linkProjectToRepo(
        projectId: string,
        repoInfo: RepoInfo
    ): Promise<ProjectRepoLink> {
        const now = new Date().toISOString();

        // Check for existing link
        const existing = await db.select()
            .from(projectGithubRepos)
            .where(eq(projectGithubRepos.projectId, projectId))
            .limit(1);

        if (existing.length > 0) {
            // Update existing link
            await db.update(projectGithubRepos)
                .set({
                    repoOwner: repoInfo.owner,
                    repoName: repoInfo.name,
                    defaultBranch: repoInfo.defaultBranch,
                    isPrivate: repoInfo.isPrivate,
                    repoUrl: repoInfo.url,
                    updatedAt: now,
                })
                .where(eq(projectGithubRepos.projectId, projectId));

            return {
                ...existing[0],
                repoOwner: repoInfo.owner,
                repoName: repoInfo.name,
                defaultBranch: repoInfo.defaultBranch,
                isPrivate: repoInfo.isPrivate,
                repoUrl: repoInfo.url,
                updatedAt: now,
            };
        }

        // Create new link
        const id = crypto.randomUUID();
        await db.insert(projectGithubRepos).values({
            id,
            projectId,
            repoOwner: repoInfo.owner,
            repoName: repoInfo.name,
            defaultBranch: repoInfo.defaultBranch,
            isPrivate: repoInfo.isPrivate,
            repoUrl: repoInfo.url,
            createdAt: now,
            updatedAt: now,
        });

        return {
            id,
            projectId,
            repoOwner: repoInfo.owner,
            repoName: repoInfo.name,
            defaultBranch: repoInfo.defaultBranch,
            isPrivate: repoInfo.isPrivate,
            repoUrl: repoInfo.url,
            lastPushedAt: null,
            lastPushCommitSha: null,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Get project's linked repository
     */
    async getProjectRepo(projectId: string): Promise<ProjectRepoLink | null> {
        const repos = await db.select()
            .from(projectGithubRepos)
            .where(eq(projectGithubRepos.projectId, projectId))
            .limit(1);

        return repos[0] || null;
    }

    /**
     * Unlink a project from its GitHub repository
     */
    async unlinkProjectRepo(projectId: string): Promise<boolean> {
        await db.delete(projectGithubRepos)
            .where(eq(projectGithubRepos.projectId, projectId));
        return true;
    }

    /**
     * Push project files to linked GitHub repository
     */
    async pushProjectToGitHub(
        userId: string,
        projectId: string,
        branch?: string,
        commitMessage?: string
    ): Promise<PushResult> {
        // Get user's GitHub access token
        const accessToken = await this.authService.getAccessToken(userId);
        if (!accessToken) {
            throw new Error('GitHub not connected. Please connect your GitHub account.');
        }

        // Get project's linked repo
        const repoLink = await this.getProjectRepo(projectId);
        if (!repoLink) {
            throw new Error('No GitHub repository linked to this project.');
        }

        // Get project files
        const projectFiles = await db.select()
            .from(files)
            .where(eq(files.projectId, projectId));

        if (projectFiles.length === 0) {
            throw new Error('No files found in project.');
        }

        // Prepare files for push
        const filesToPush = projectFiles.map(file => ({
            path: file.path,
            content: file.content,
        }));

        // Push to GitHub
        const targetBranch = branch || repoLink.defaultBranch || 'main';
        const message = commitMessage || `Update from KripTik AI - ${new Date().toISOString()}`;

        const result = await this.pushToRepo(
            accessToken,
            repoLink.repoOwner,
            repoLink.repoName,
            targetBranch,
            filesToPush,
            message
        );

        // Update last pushed info
        const now = new Date().toISOString();
        await db.update(projectGithubRepos)
            .set({
                lastPushedAt: now,
                lastPushCommitSha: result.commitSha,
                updatedAt: now,
            })
            .where(eq(projectGithubRepos.projectId, projectId));

        return result;
    }

    /**
     * Create a new repo and link it to a project
     */
    async createAndLinkRepo(
        userId: string,
        projectId: string,
        repoName: string,
        description: string,
        isPrivate: boolean = true
    ): Promise<{ repo: RepoInfo; link: ProjectRepoLink }> {
        // Get user's GitHub access token
        const accessToken = await this.authService.getAccessToken(userId);
        if (!accessToken) {
            throw new Error('GitHub not connected. Please connect your GitHub account.');
        }

        // Create the repository
        const repo = await this.createRepo(accessToken, repoName, description, isPrivate);

        // Link it to the project
        const link = await this.linkProjectToRepo(projectId, repo);

        return { repo, link };
    }
}

// Singleton instance
let instance: GitHubRepoService | null = null;

export function getGitHubRepoService(): GitHubRepoService {
    if (!instance) {
        instance = new GitHubRepoService();
    }
    return instance;
}

export function createGitHubRepoService(): GitHubRepoService {
    return new GitHubRepoService();
}
