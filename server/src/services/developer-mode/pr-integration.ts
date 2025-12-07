/**
 * PR Integration Service - Developer Mode Pull Request Creation
 *
 * Integrates with GitHub/GitLab/Bitbucket for:
 * - Creating pull requests from agent branches
 * - Managing PR lifecycle
 * - Linking PRs to agent tasks
 * - Auto-generating PR descriptions
 */

import { EventEmitter } from 'events';
import { GitBranchManager, PRInfo, CommitInfo } from './git-branch-manager.js';

// =============================================================================
// TYPES
// =============================================================================

export type PRProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';

export interface PRProviderConfig {
    provider: PRProvider;
    token: string;
    owner: string;
    repo: string;
    apiUrl?: string; // For self-hosted instances
}

export interface PRCreateRequest {
    title: string;
    body: string;
    sourceBranch: string;
    targetBranch: string;
    draft?: boolean;
    labels?: string[];
    assignees?: string[];
    reviewers?: string[];
}

export interface PRResponse {
    id: string;
    number: number;
    title: string;
    url: string;
    state: 'open' | 'closed' | 'merged';
    isDraft: boolean;
    createdAt: string;
    sourceBranch: string;
    targetBranch: string;
}

export interface PRUpdateRequest {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
    assignees?: string[];
    reviewers?: string[];
}

// =============================================================================
// PR INTEGRATION SERVICE
// =============================================================================

export class PRIntegrationService extends EventEmitter {
    private config: PRProviderConfig;
    private gitManager: GitBranchManager;

    constructor(config: PRProviderConfig, gitManager: GitBranchManager) {
        super();
        this.config = config;
        this.gitManager = gitManager;
    }

    /**
     * Create a pull request from agent's work
     */
    async createPR(
        agentId: string,
        options: {
            title?: string;
            additionalBody?: string;
            draft?: boolean;
            labels?: string[];
            reviewers?: string[];
        } = {}
    ): Promise<PRResponse> {
        const branch = this.gitManager.getAgentBranch(agentId);
        if (!branch) {
            throw new Error(`No branch found for agent ${agentId}`);
        }

        // Generate PR info from git
        const prInfo = await this.gitManager.createPRInfo(
            agentId,
            options.title || `Agent ${agentId}: Automated changes`
        );

        // Combine body with any additional content
        const body = options.additionalBody
            ? `${prInfo.body}\n\n---\n\n${options.additionalBody}`
            : prInfo.body;

        const request: PRCreateRequest = {
            title: prInfo.title,
            body,
            sourceBranch: prInfo.sourceBranch,
            targetBranch: prInfo.targetBranch,
            draft: options.draft ?? false,
            labels: options.labels || ['agent-generated'],
            reviewers: options.reviewers,
        };

        const response = await this.sendPRRequest(request);

        this.emit('prCreated', { agentId, pr: response });
        console.log(`[PRIntegration] Created PR #${response.number}: ${response.url}`);

        return response;
    }

    /**
     * Get PR status
     */
    async getPRStatus(prNumber: number): Promise<PRResponse | null> {
        const url = this.buildApiUrl(`pulls/${prNumber}`);

        try {
            const response = await fetch(url, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Failed to get PR: ${response.statusText}`);
            }

            return this.parsePRResponse(await response.json());
        } catch (error: any) {
            console.error(`[PRIntegration] Failed to get PR status: ${error.message}`);
            return null;
        }
    }

    /**
     * Update an existing PR
     */
    async updatePR(prNumber: number, update: PRUpdateRequest): Promise<PRResponse> {
        const url = this.buildApiUrl(`pulls/${prNumber}`);

        const body = this.buildUpdateBody(update);

        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Failed to update PR: ${response.statusText}`);
        }

        const pr = this.parsePRResponse(await response.json());
        this.emit('prUpdated', { prNumber, pr });

        return pr;
    }

    /**
     * Close a PR without merging
     */
    async closePR(prNumber: number): Promise<void> {
        await this.updatePR(prNumber, { state: 'closed' });
        this.emit('prClosed', { prNumber });
    }

    /**
     * Merge a PR
     */
    async mergePR(
        prNumber: number,
        options: {
            mergeMethod?: 'merge' | 'squash' | 'rebase';
            commitMessage?: string;
        } = {}
    ): Promise<{ merged: boolean; message: string }> {
        const url = this.buildApiUrl(`pulls/${prNumber}/merge`);

        const body: Record<string, unknown> = {
            merge_method: options.mergeMethod || 'squash',
        };

        if (options.commitMessage) {
            body.commit_message = options.commitMessage;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                merged: false,
                message: data.message || 'Merge failed',
            };
        }

        this.emit('prMerged', { prNumber });
        return {
            merged: true,
            message: data.message || 'PR merged successfully',
        };
    }

    /**
     * Add comment to PR
     */
    async addComment(prNumber: number, comment: string): Promise<void> {
        const url = this.buildApiUrl(`issues/${prNumber}/comments`);

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ body: comment }),
        });

        if (!response.ok) {
            throw new Error(`Failed to add comment: ${response.statusText}`);
        }

        this.emit('commentAdded', { prNumber, comment });
    }

    /**
     * Request review from specific users
     */
    async requestReview(prNumber: number, reviewers: string[]): Promise<void> {
        const url = this.buildApiUrl(`pulls/${prNumber}/requested_reviewers`);

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ reviewers }),
        });

        if (!response.ok) {
            throw new Error(`Failed to request review: ${response.statusText}`);
        }

        this.emit('reviewRequested', { prNumber, reviewers });
    }

    /**
     * Generate AI-enhanced PR description
     */
    generatePRDescription(
        commits: CommitInfo[],
        filesChanged: string[],
        taskDescription: string
    ): string {
        // Categorize files
        const fileCategories: Record<string, string[]> = {
            components: [],
            services: [],
            styles: [],
            tests: [],
            config: [],
            other: [],
        };

        for (const file of filesChanged) {
            if (file.includes('/components/') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
                fileCategories.components.push(file);
            } else if (file.includes('/services/') || file.includes('/api/')) {
                fileCategories.services.push(file);
            } else if (file.endsWith('.css') || file.endsWith('.scss') || file.includes('/styles/')) {
                fileCategories.styles.push(file);
            } else if (file.includes('.test.') || file.includes('.spec.') || file.includes('/test/')) {
                fileCategories.tests.push(file);
            } else if (file.includes('.config.') || file.includes('.json') || file.includes('.yaml')) {
                fileCategories.config.push(file);
            } else {
                fileCategories.other.push(file);
            }
        }

        // Build description
        let description = `## Overview\n\n${taskDescription}\n\n`;

        description += `## Changes Summary\n\n`;
        description += `This PR includes ${commits.length} commit(s) affecting ${filesChanged.length} file(s).\n\n`;

        // Add categorized changes
        if (fileCategories.components.length > 0) {
            description += `### 🧩 Components\n`;
            description += fileCategories.components.map(f => `- \`${f}\``).join('\n') + '\n\n';
        }

        if (fileCategories.services.length > 0) {
            description += `### ⚙️ Services/API\n`;
            description += fileCategories.services.map(f => `- \`${f}\``).join('\n') + '\n\n';
        }

        if (fileCategories.styles.length > 0) {
            description += `### 🎨 Styles\n`;
            description += fileCategories.styles.map(f => `- \`${f}\``).join('\n') + '\n\n';
        }

        if (fileCategories.tests.length > 0) {
            description += `### 🧪 Tests\n`;
            description += fileCategories.tests.map(f => `- \`${f}\``).join('\n') + '\n\n';
        }

        if (fileCategories.config.length > 0) {
            description += `### ⚙️ Configuration\n`;
            description += fileCategories.config.map(f => `- \`${f}\``).join('\n') + '\n\n';
        }

        if (fileCategories.other.length > 0) {
            description += `### 📁 Other\n`;
            description += fileCategories.other.map(f => `- \`${f}\``).join('\n') + '\n\n';
        }

        description += `## Commits\n\n`;
        description += commits.map(c => `- \`${c.shortHash}\` ${c.message}`).join('\n') + '\n\n';

        description += `---\n`;
        description += `*🤖 This PR was automatically generated by KripTik AI Developer Mode*\n`;
        description += `*Please review the changes carefully before merging*`;

        return description;
    }

    /**
     * List open PRs for the repo
     */
    async listOpenPRs(): Promise<PRResponse[]> {
        const url = this.buildApiUrl('pulls?state=open');

        const response = await fetch(url, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to list PRs: ${response.statusText}`);
        }

        const data = await response.json();
        return data.map((pr: Record<string, unknown>) => this.parsePRResponse(pr));
    }

    /**
     * Find PRs created by agents
     */
    async findAgentPRs(): Promise<PRResponse[]> {
        const allPRs = await this.listOpenPRs();
        return allPRs.filter(pr =>
            pr.sourceBranch.startsWith('agent/') ||
            pr.title.toLowerCase().includes('agent')
        );
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    private async sendPRRequest(request: PRCreateRequest): Promise<PRResponse> {
        const url = this.buildApiUrl('pulls');

        const body = {
            title: request.title,
            body: request.body,
            head: request.sourceBranch,
            base: request.targetBranch,
            draft: request.draft,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Failed to create PR: ${response.statusText}`);
        }

        const pr = this.parsePRResponse(await response.json());

        // Add labels if specified
        if (request.labels && request.labels.length > 0) {
            await this.addLabels(pr.number, request.labels);
        }

        // Request reviewers if specified
        if (request.reviewers && request.reviewers.length > 0) {
            await this.requestReview(pr.number, request.reviewers);
        }

        return pr;
    }

    private async addLabels(prNumber: number, labels: string[]): Promise<void> {
        const url = this.buildApiUrl(`issues/${prNumber}/labels`);

        await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ labels }),
        });
    }

    private buildApiUrl(endpoint: string): string {
        const baseUrl = this.config.apiUrl || this.getDefaultApiUrl();
        return `${baseUrl}/repos/${this.config.owner}/${this.config.repo}/${endpoint}`;
    }

    private getDefaultApiUrl(): string {
        switch (this.config.provider) {
            case 'github':
                return 'https://api.github.com';
            case 'gitlab':
                return 'https://gitlab.com/api/v4';
            case 'bitbucket':
                return 'https://api.bitbucket.org/2.0';
            case 'azure-devops':
                return 'https://dev.azure.com';
            default:
                return 'https://api.github.com';
        }
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
        };

        if (this.config.provider === 'github') {
            headers['Authorization'] = `Bearer ${this.config.token}`;
        } else {
            headers['Authorization'] = `Bearer ${this.config.token}`;
        }

        return headers;
    }

    private buildUpdateBody(update: PRUpdateRequest): Record<string, unknown> {
        const body: Record<string, unknown> = {};

        if (update.title !== undefined) body.title = update.title;
        if (update.body !== undefined) body.body = update.body;
        if (update.state !== undefined) body.state = update.state;

        return body;
    }

    private parsePRResponse(data: Record<string, unknown>): PRResponse {
        return {
            id: String(data.id),
            number: data.number as number,
            title: data.title as string,
            url: data.html_url as string,
            state: data.state as PRResponse['state'],
            isDraft: data.draft as boolean || false,
            createdAt: data.created_at as string,
            sourceBranch: (data.head as Record<string, unknown>)?.ref as string || '',
            targetBranch: (data.base as Record<string, unknown>)?.ref as string || '',
        };
    }
}

/**
 * Create a PRIntegrationService instance
 */
export function createPRIntegrationService(
    config: PRProviderConfig,
    gitManager: GitBranchManager
): PRIntegrationService {
    return new PRIntegrationService(config, gitManager);
}

