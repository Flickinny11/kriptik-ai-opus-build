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
 * - .cursor/memory/build_state.json: Current build state
 * - .cursor/memory/verification_history.json: Verification results
 * - .cursor/memory/issue_resolutions.json: How issues were resolved
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db.js';
import { projectContexts, files, orchestrationRuns } from '../../schema.js';
import type { IntentContract } from './intent-lock.js';
import type { FeatureListSummary } from './feature-list.js';

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
    buildStateJson: string | null;
    verificationHistoryJson: string | null;
    issueResolutionsJson: string | null;
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

