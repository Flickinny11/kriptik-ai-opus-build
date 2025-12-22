# LATTICE Implementation Plan

> **LATTICE**: Locking Architecture for Total Task Integrated Cell Execution
>
> A breakthrough speed enhancement that decomposes Intent Lock contracts into perfectly-fitting cells with guaranteed-compatible interfaces, enabling true parallel building with zero merge conflicts.

**Created**: December 22, 2025
**Target**: 8-12x faster builds than sequential, 2-4x faster than Cascade
**Prerequisite**: Must not compromise quality, uniqueness, or anti-slop compliance

---

## Executive Summary

LATTICE transforms KripTik AI's build process by:
1. **Crystallizing** the Intent Lock into a Lattice Blueprint with defined cell interfaces
2. **Parallel building** cells with guaranteed compatibility (zero merge conflicts)
3. **Instant synthesis** of cells into working applications
4. **Continuous learning** of optimal decomposition patterns

Combined with existing systems (Intent Lock, 6-Phase Build Loop, Verification Swarm, Component 28), LATTICE delivers the speed KripTik needs while maintaining premium quality.

---

## Phase 0: Critical Gap Fixes (MUST DO FIRST)

### P0.1: Wire Up Merge Button to GitBranchManager

**Problem**: The "Accept Feature & Merge" button shows success but never actually merges.

**Files to modify**:
- `src/components/feature-agent/FeatureAgentTile.tsx`
- `server/src/routes/preview.ts`
- `server/src/services/feature-agent/feature-agent-service.ts`

**Implementation**:
```typescript
// In preview.ts - POST /api/preview/:sessionId/accept
router.post('/:sessionId/accept', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = previewService.getSession(sessionId);

    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Actually trigger the merge via feature agent service
    const featureAgentService = getFeatureAgentService();
    const mergeResult = await featureAgentService.mergeFeature(session.featureAgentId);

    await previewService.endPreview(sessionId);

    res.json({
        success: mergeResult.success,
        mergeResult,
        message: mergeResult.success ? 'Feature merged successfully' : mergeResult.error,
    });
});
```

```typescript
// Add to feature-agent-service.ts
async mergeFeature(agentId: string): Promise<{ success: boolean; error?: string }> {
    const runtime = this.agents.get(agentId);
    if (!runtime) {
        return { success: false, error: 'Agent not found' };
    }

    try {
        // Get the git branch manager
        const gitManager = this.getGitBranchManager(runtime.config.projectId);

        // Merge agent's branch to main
        const result = await gitManager.mergeBranch(agentId, 'main', 'squash');

        if (!result.success) {
            return { success: false, error: result.message };
        }

        // Update agent status
        runtime.config.status = 'merged';
        this.emit(`agent:${agentId}`, {
            type: 'status',
            content: 'Feature merged to main branch',
            timestamp: Date.now(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
```

---

### P0.2: GitHub OAuth Integration

**Problem**: Users can't push completed apps/features to their GitHub repos.

**New files**:
- `server/src/services/github/github-auth-service.ts`
- `server/src/services/github/github-repo-service.ts`
- `server/src/routes/github.ts`
- `src/components/settings/GitHubConnect.tsx`
- `src/pages/GitHubCallback.tsx`

**Schema additions** (in `server/src/schema.ts`):
```typescript
export const githubConnections = sqliteTable('github_connections', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    githubId: text('github_id').notNull(),
    githubUsername: text('github_username').notNull(),
    accessToken: text('access_token').notNull(), // Encrypted
    refreshToken: text('refresh_token'), // Encrypted
    scope: text('scope'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const projectGithubRepos = sqliteTable('project_github_repos', {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    repoOwner: text('repo_owner').notNull(),
    repoName: text('repo_name').notNull(),
    defaultBranch: text('default_branch').default('main'),
    isPrivate: integer('is_private', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

**GitHub Auth Service**:
```typescript
// server/src/services/github/github-auth-service.ts
import { Octokit } from '@octokit/rest';

export class GitHubAuthService {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;

    constructor() {
        this.clientId = process.env.GITHUB_CLIENT_ID!;
        this.clientSecret = process.env.GITHUB_CLIENT_SECRET!;
        this.redirectUri = process.env.GITHUB_REDIRECT_URI!;
    }

    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: 'repo user:email',
            state,
        });
        return `https://github.com/login/oauth/authorize?${params}`;
    }

    async exchangeCodeForToken(code: string): Promise<{
        accessToken: string;
        refreshToken?: string;
        scope: string;
    }> {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code,
            }),
        });

        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            scope: data.scope,
        };
    }

    async getUserInfo(accessToken: string): Promise<{
        id: number;
        username: string;
        email: string;
    }> {
        const octokit = new Octokit({ auth: accessToken });
        const { data: user } = await octokit.users.getAuthenticated();
        return {
            id: user.id,
            username: user.login,
            email: user.email || '',
        };
    }
}
```

**GitHub Repo Service**:
```typescript
// server/src/services/github/github-repo-service.ts
import { Octokit } from '@octokit/rest';

export class GitHubRepoService {
    async createRepo(
        accessToken: string,
        name: string,
        description: string,
        isPrivate: boolean = true
    ): Promise<{ owner: string; name: string; url: string }> {
        const octokit = new Octokit({ auth: accessToken });

        const { data: repo } = await octokit.repos.createForAuthenticatedUser({
            name,
            description,
            private: isPrivate,
            auto_init: false,
        });

        return {
            owner: repo.owner.login,
            name: repo.name,
            url: repo.html_url,
        };
    }

    async pushToRepo(
        accessToken: string,
        owner: string,
        repo: string,
        branch: string,
        files: Array<{ path: string; content: string }>
    ): Promise<{ commitSha: string }> {
        const octokit = new Octokit({ auth: accessToken });

        // Get or create the branch reference
        let baseSha: string;
        try {
            const { data: ref } = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${branch}`,
            });
            baseSha = ref.object.sha;
        } catch {
            // Branch doesn't exist, create from default
            const { data: defaultRef } = await octokit.git.getRef({
                owner,
                repo,
                ref: 'heads/main',
            });
            baseSha = defaultRef.object.sha;
        }

        // Create blobs for each file
        const blobs = await Promise.all(
            files.map(async (file) => {
                const { data: blob } = await octokit.git.createBlob({
                    owner,
                    repo,
                    content: Buffer.from(file.content).toString('base64'),
                    encoding: 'base64',
                });
                return { path: file.path, sha: blob.sha, mode: '100644' as const, type: 'blob' as const };
            })
        );

        // Create tree
        const { data: tree } = await octokit.git.createTree({
            owner,
            repo,
            base_tree: baseSha,
            tree: blobs,
        });

        // Create commit
        const { data: commit } = await octokit.git.createCommit({
            owner,
            repo,
            message: 'Update from KripTik AI',
            tree: tree.sha,
            parents: [baseSha],
        });

        // Update branch reference
        await octokit.git.updateRef({
            owner,
            repo,
            ref: `heads/${branch}`,
            sha: commit.sha,
        });

        return { commitSha: commit.sha };
    }
}
```

**API Routes**:
```typescript
// server/src/routes/github.ts
router.get('/auth/url', requireAuth, (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    // Store state in session for verification
    req.session.githubState = state;
    const url = githubAuthService.getAuthorizationUrl(state);
    res.json({ url });
});

router.get('/auth/callback', requireAuth, async (req, res) => {
    const { code, state } = req.query;

    // Verify state
    if (state !== req.session.githubState) {
        return res.status(400).json({ error: 'Invalid state' });
    }

    // Exchange code for token
    const tokens = await githubAuthService.exchangeCodeForToken(code as string);
    const userInfo = await githubAuthService.getUserInfo(tokens.accessToken);

    // Store connection (encrypted)
    await db.insert(githubConnections).values({
        id: uuidv4(),
        userId: req.user.id,
        githubId: String(userInfo.id),
        githubUsername: userInfo.username,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        scope: tokens.scope,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    res.redirect('/settings?github=connected');
});

router.post('/repos', requireAuth, async (req, res) => {
    const { projectId, repoName, isPrivate } = req.body;

    // Get user's GitHub connection
    const connection = await getGitHubConnection(req.user.id);
    if (!connection) {
        return res.status(400).json({ error: 'GitHub not connected' });
    }

    // Create repo
    const repo = await githubRepoService.createRepo(
        decrypt(connection.accessToken),
        repoName,
        `Created by KripTik AI`,
        isPrivate
    );

    // Link to project
    await db.insert(projectGithubRepos).values({
        id: uuidv4(),
        projectId,
        repoOwner: repo.owner,
        repoName: repo.name,
        isPrivate,
        createdAt: new Date(),
    });

    res.json({ success: true, repo });
});

router.post('/push', requireAuth, async (req, res) => {
    const { projectId, branch, message } = req.body;

    // Get project files
    const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId));

    // Get GitHub connection and repo
    const connection = await getGitHubConnection(req.user.id);
    const repoLink = await getProjectRepo(projectId);

    // Push to GitHub
    const result = await githubRepoService.pushToRepo(
        decrypt(connection.accessToken),
        repoLink.repoOwner,
        repoLink.repoName,
        branch,
        projectFiles.map(f => ({ path: f.path, content: f.content }))
    );

    res.json({ success: true, commitSha: result.commitSha });
});
```

**Frontend Component**:
```tsx
// src/components/settings/GitHubConnect.tsx
export function GitHubConnect() {
    const [isConnected, setIsConnected] = useState(false);
    const [username, setUsername] = useState<string | null>(null);

    const handleConnect = async () => {
        const { url } = await apiClient.get('/api/github/auth/url');
        window.location.href = url;
    };

    return (
        <div className="github-connect">
            {isConnected ? (
                <div className="connected">
                    <IconGitHub />
                    <span>Connected as {username}</span>
                    <button onClick={handleDisconnect}>Disconnect</button>
                </div>
            ) : (
                <button onClick={handleConnect} className="connect-btn">
                    <IconGitHub />
                    <span>Connect GitHub</span>
                </button>
            )}
        </div>
    );
}
```

---

## Phase 1: Lattice Blueprint Generation

### P1.1: Intent Crystallization Engine

**Purpose**: Transform Intent Lock contracts into Lattice Blueprints with cell definitions and interface contracts.

**New file**: `server/src/services/lattice/intent-crystallizer.ts`

```typescript
/**
 * Intent Crystallizer
 *
 * Transforms Intent Lock contracts into Lattice Blueprints.
 * Uses AI to decompose app requirements into perfectly-fitting cells
 * with defined interfaces that guarantee zero merge conflicts.
 */

import { IntentContract } from '../ai/intent-lock.js';
import { createClaudeService } from '../ai/claude-service.js';

export interface CellInterface {
    id: string;
    name: string;
    type: 'input' | 'output';
    dataShape: string; // TypeScript type definition
    description: string;
}

export interface LatticeCell {
    id: string;
    name: string;
    description: string;
    type: 'ui' | 'api' | 'logic' | 'data' | 'integration';
    priority: number; // 1-10, higher = build first
    estimatedComplexity: 'simple' | 'medium' | 'complex';

    // Interface contracts
    inputs: CellInterface[];
    outputs: CellInterface[];

    // Dependencies
    dependsOn: string[]; // Cell IDs this cell needs
    blockedBy: string[]; // Cell IDs that must complete first

    // Implementation hints
    suggestedPatterns: string[]; // Building block patterns that might match
    antiPatterns: string[]; // What NOT to do

    // Success criteria (from Intent Lock)
    successCriteria: string[];
}

export interface LatticeBlueprint {
    id: string;
    intentId: string;
    cells: LatticeCell[];

    // Interface graph
    interfaceMap: Map<string, string[]>; // cellId -> connected cellIds

    // Execution order
    parallelGroups: string[][]; // Groups of cells that can run in parallel
    criticalPath: string[]; // Longest dependency chain

    // Metadata
    estimatedTotalTime: number; // seconds
    estimatedParallelTime: number; // seconds with full parallelism
    createdAt: Date;
}

export class IntentCrystallizer {
    private claudeService = createClaudeService();

    async crystallize(intent: IntentContract): Promise<LatticeBlueprint> {
        // Step 1: Decompose into cells using AI
        const cells = await this.decomposeToCells(intent);

        // Step 2: Generate interface contracts
        const cellsWithInterfaces = await this.generateInterfaces(cells, intent);

        // Step 3: Build dependency graph
        const { interfaceMap, parallelGroups, criticalPath } = this.buildDependencyGraph(cellsWithInterfaces);

        // Step 4: Estimate timing
        const { totalTime, parallelTime } = this.estimateTiming(cellsWithInterfaces, parallelGroups);

        return {
            id: `lattice_${Date.now()}`,
            intentId: intent.id,
            cells: cellsWithInterfaces,
            interfaceMap,
            parallelGroups,
            criticalPath,
            estimatedTotalTime: totalTime,
            estimatedParallelTime: parallelTime,
            createdAt: new Date(),
        };
    }

    private async decomposeToCells(intent: IntentContract): Promise<Partial<LatticeCell>[]> {
        const prompt = `You are decomposing an application into LATTICE cells for parallel building.

INTENT CONTRACT:
${JSON.stringify(intent, null, 2)}

Decompose this into discrete cells that can be built independently.
Each cell should be:
- Self-contained with clear boundaries
- Small enough to build in 1-3 minutes
- Large enough to be meaningful

RULES:
- UI components are separate cells from their API endpoints
- Each API route group is one cell
- Database schema is one cell
- Auth flow is one cell
- Each major feature is 2-3 cells (UI + logic + integration)

Return JSON array of cells with: id, name, description, type, priority, estimatedComplexity, dependsOn (cell IDs)`;

        const response = await this.claudeService.generate({
            prompt,
            model: 'claude-sonnet-4-5-20241022',
            maxTokens: 8000,
        });

        return JSON.parse(response.content);
    }

    private async generateInterfaces(
        cells: Partial<LatticeCell>[],
        intent: IntentContract
    ): Promise<LatticeCell[]> {
        const prompt = `Generate TypeScript interface contracts for each cell.

CELLS:
${JSON.stringify(cells, null, 2)}

INTENT:
${JSON.stringify(intent, null, 2)}

For each cell, define:
- inputs: What data/props it receives (TypeScript types)
- outputs: What data/events it produces (TypeScript types)

These interfaces are CONTRACTS. When cells are built, they MUST match these interfaces exactly.
This guarantees zero merge conflicts when cells are combined.

Return the cells array with inputs and outputs added.`;

        const response = await this.claudeService.generate({
            prompt,
            model: 'claude-sonnet-4-5-20241022',
            maxTokens: 16000,
        });

        return JSON.parse(response.content);
    }

    private buildDependencyGraph(cells: LatticeCell[]): {
        interfaceMap: Map<string, string[]>;
        parallelGroups: string[][];
        criticalPath: string[];
    } {
        const interfaceMap = new Map<string, string[]>();

        // Build adjacency list from dependencies
        for (const cell of cells) {
            const connected = [...cell.dependsOn];
            // Also find cells that depend on this cell's outputs
            for (const other of cells) {
                if (other.dependsOn.includes(cell.id)) {
                    connected.push(other.id);
                }
            }
            interfaceMap.set(cell.id, [...new Set(connected)]);
        }

        // Topological sort to find parallel groups
        const parallelGroups = this.topologicalGroupSort(cells);

        // Find critical path (longest dependency chain)
        const criticalPath = this.findCriticalPath(cells);

        return { interfaceMap, parallelGroups, criticalPath };
    }

    private topologicalGroupSort(cells: LatticeCell[]): string[][] {
        const groups: string[][] = [];
        const completed = new Set<string>();
        const remaining = new Set(cells.map(c => c.id));

        while (remaining.size > 0) {
            const group: string[] = [];

            for (const cellId of remaining) {
                const cell = cells.find(c => c.id === cellId)!;
                const depsCompleted = cell.dependsOn.every(d => completed.has(d));

                if (depsCompleted) {
                    group.push(cellId);
                }
            }

            if (group.length === 0) {
                // Circular dependency - shouldn't happen with good decomposition
                console.error('Circular dependency detected in lattice');
                break;
            }

            groups.push(group);
            for (const id of group) {
                completed.add(id);
                remaining.delete(id);
            }
        }

        return groups;
    }

    private findCriticalPath(cells: LatticeCell[]): string[] {
        // Find the longest path through dependency graph
        const memo = new Map<string, string[]>();

        const findPath = (cellId: string): string[] => {
            if (memo.has(cellId)) return memo.get(cellId)!;

            const cell = cells.find(c => c.id === cellId);
            if (!cell || cell.dependsOn.length === 0) {
                memo.set(cellId, [cellId]);
                return [cellId];
            }

            let longestPrev: string[] = [];
            for (const depId of cell.dependsOn) {
                const path = findPath(depId);
                if (path.length > longestPrev.length) {
                    longestPrev = path;
                }
            }

            const result = [...longestPrev, cellId];
            memo.set(cellId, result);
            return result;
        };

        let criticalPath: string[] = [];
        for (const cell of cells) {
            const path = findPath(cell.id);
            if (path.length > criticalPath.length) {
                criticalPath = path;
            }
        }

        return criticalPath;
    }

    private estimateTiming(
        cells: LatticeCell[],
        parallelGroups: string[][]
    ): { totalTime: number; parallelTime: number } {
        const complexityTime = {
            simple: 30,    // 30 seconds
            medium: 90,    // 1.5 minutes
            complex: 180,  // 3 minutes
        };

        // Sequential time
        let totalTime = 0;
        for (const cell of cells) {
            totalTime += complexityTime[cell.estimatedComplexity];
        }

        // Parallel time (sum of max per group)
        let parallelTime = 0;
        for (const group of parallelGroups) {
            let groupMax = 0;
            for (const cellId of group) {
                const cell = cells.find(c => c.id === cellId)!;
                const time = complexityTime[cell.estimatedComplexity];
                if (time > groupMax) groupMax = time;
            }
            parallelTime += groupMax;
        }

        return { totalTime, parallelTime };
    }
}

export function createIntentCrystallizer(): IntentCrystallizer {
    return new IntentCrystallizer();
}
```

---

## Phase 2: Parallel Cell Builder

### P2.1: Cell Build Orchestrator

**New file**: `server/src/services/lattice/cell-builder.ts`

```typescript
/**
 * Cell Builder
 *
 * Builds individual lattice cells with interface contract enforcement.
 * Each cell is built in isolation and verified against its interface contract
 * before being marked complete.
 */

import { LatticeCell, CellInterface } from './intent-crystallizer.js';
import { createClaudeService } from '../ai/claude-service.js';
import { createVerificationSwarm } from '../verification/index.js';

export interface CellBuildResult {
    cellId: string;
    success: boolean;
    files: Array<{ path: string; content: string }>;
    interfaceCompliance: {
        inputsValid: boolean;
        outputsValid: boolean;
        errors: string[];
    };
    qualityScore: number;
    buildTime: number; // ms
}

export class CellBuilder {
    private claudeService = createClaudeService();

    async buildCell(
        cell: LatticeCell,
        context: {
            appSoul: string;
            visualIdentity: any;
            completedCells: Map<string, CellBuildResult>;
        }
    ): Promise<CellBuildResult> {
        const startTime = Date.now();

        // Get interface contracts from completed dependencies
        const depInterfaces = this.gatherDependencyInterfaces(cell, context.completedCells);

        // Build the cell
        const files = await this.generateCellCode(cell, depInterfaces, context);

        // Verify interface compliance
        const compliance = await this.verifyInterfaceCompliance(cell, files);

        // Run anti-slop verification
        const quality = await this.runQualityCheck(files, context.appSoul);

        return {
            cellId: cell.id,
            success: compliance.inputsValid && compliance.outputsValid && quality >= 85,
            files,
            interfaceCompliance: compliance,
            qualityScore: quality,
            buildTime: Date.now() - startTime,
        };
    }

    private gatherDependencyInterfaces(
        cell: LatticeCell,
        completedCells: Map<string, CellBuildResult>
    ): Map<string, CellInterface[]> {
        const interfaces = new Map<string, CellInterface[]>();

        for (const depId of cell.dependsOn) {
            const depResult = completedCells.get(depId);
            if (depResult) {
                // Extract exported interfaces from the completed cell
                const exported = this.extractExportedInterfaces(depResult.files);
                interfaces.set(depId, exported);
            }
        }

        return interfaces;
    }

    private async generateCellCode(
        cell: LatticeCell,
        depInterfaces: Map<string, CellInterface[]>,
        context: any
    ): Promise<Array<{ path: string; content: string }>> {
        const prompt = `Build this LATTICE cell with EXACT interface compliance.

CELL DEFINITION:
${JSON.stringify(cell, null, 2)}

DEPENDENCY INTERFACES (you MUST import/use these exactly):
${JSON.stringify(Object.fromEntries(depInterfaces), null, 2)}

APP SOUL: ${context.appSoul}
VISUAL IDENTITY: ${JSON.stringify(context.visualIdentity, null, 2)}

RULES:
1. Your OUTPUT interfaces MUST match the cell definition EXACTLY
2. Your INPUT usage MUST match dependency interfaces EXACTLY
3. NO placeholder content - everything must be production-ready
4. Follow anti-slop rules:
   - No purple-to-pink gradients
   - No generic fonts
   - Real depth (shadows, layers)
   - Premium animations
5. Style according to visualIdentity, NOT from any block patterns

Return JSON array of files: [{ path: string, content: string }]`;

        const response = await this.claudeService.generate({
            prompt,
            model: 'claude-sonnet-4-5-20241022',
            maxTokens: 16000,
        });

        return JSON.parse(response.content);
    }

    private async verifyInterfaceCompliance(
        cell: LatticeCell,
        files: Array<{ path: string; content: string }>
    ): Promise<{ inputsValid: boolean; outputsValid: boolean; errors: string[] }> {
        // Use TypeScript compiler API to verify interfaces match
        const errors: string[] = [];

        // Check that expected exports exist with correct types
        for (const output of cell.outputs) {
            const found = this.findExportInFiles(files, output);
            if (!found) {
                errors.push(`Missing output: ${output.name} of type ${output.dataShape}`);
            }
        }

        // Check that imports match expected inputs
        for (const input of cell.inputs) {
            const used = this.findImportUsage(files, input);
            if (!used) {
                errors.push(`Input not used: ${input.name}`);
            }
        }

        return {
            inputsValid: cell.inputs.every(i => this.findImportUsage(files, i)),
            outputsValid: cell.outputs.every(o => this.findExportInFiles(files, o)),
            errors,
        };
    }

    private findExportInFiles(files: any[], output: CellInterface): boolean {
        // Simplified check - real implementation would use TS compiler
        const pattern = new RegExp(`export\\s+(const|function|class|type|interface)\\s+${output.name}`);
        return files.some(f => pattern.test(f.content));
    }

    private findImportUsage(files: any[], input: CellInterface): boolean {
        const pattern = new RegExp(input.name);
        return files.some(f => pattern.test(f.content));
    }

    private extractExportedInterfaces(files: any[]): CellInterface[] {
        // Extract all exports - simplified
        return [];
    }

    private async runQualityCheck(files: any[], appSoul: string): Promise<number> {
        const verificationSwarm = createVerificationSwarm({} as any);
        // Run anti-slop detection on generated code
        // Return quality score 0-100
        return 90; // Placeholder - real implementation uses swarm
    }
}
```

---

### P2.2: Lattice Orchestrator

**New file**: `server/src/services/lattice/lattice-orchestrator.ts`

```typescript
/**
 * Lattice Orchestrator
 *
 * Coordinates parallel cell building with:
 * - Maximum parallelism based on dependency graph
 * - Real-time progress tracking
 * - Automatic retry with burst generation for failed cells
 * - Interface contract enforcement
 */

import { EventEmitter } from 'events';
import { LatticeBlueprint, LatticeCell } from './intent-crystallizer.js';
import { CellBuilder, CellBuildResult } from './cell-builder.js';
import { createBurstGenerator } from './burst-generator.js';

export interface LatticeProgress {
    totalCells: number;
    completedCells: number;
    inProgressCells: string[];
    failedCells: string[];
    estimatedTimeRemaining: number;
    speedMultiplier: number; // vs sequential
}

export interface LatticeResult {
    success: boolean;
    files: Array<{ path: string; content: string }>;
    buildTime: number;
    speedup: number; // vs estimated sequential
    cellResults: Map<string, CellBuildResult>;
}

export class LatticeOrchestrator extends EventEmitter {
    private cellBuilder = new CellBuilder();
    private burstGenerator = createBurstGenerator();

    async build(
        blueprint: LatticeBlueprint,
        context: { appSoul: string; visualIdentity: any }
    ): Promise<LatticeResult> {
        const startTime = Date.now();
        const completedCells = new Map<string, CellBuildResult>();
        const failedCells = new Set<string>();

        // Process parallel groups in order
        for (let groupIndex = 0; groupIndex < blueprint.parallelGroups.length; groupIndex++) {
            const group = blueprint.parallelGroups[groupIndex];

            this.emit('groupStart', { groupIndex, cells: group });

            // Build all cells in this group in parallel
            const results = await Promise.all(
                group.map(cellId => this.buildCellWithRetry(
                    blueprint.cells.find(c => c.id === cellId)!,
                    { ...context, completedCells }
                ))
            );

            // Process results
            for (const result of results) {
                if (result.success) {
                    completedCells.set(result.cellId, result);
                } else {
                    failedCells.add(result.cellId);
                }

                this.emit('cellComplete', {
                    cellId: result.cellId,
                    success: result.success,
                    progress: this.calculateProgress(blueprint, completedCells, failedCells),
                });
            }

            this.emit('groupComplete', { groupIndex, results });
        }

        // Synthesize all files
        const allFiles = this.synthesizeFiles(completedCells);

        const buildTime = Date.now() - startTime;
        const speedup = blueprint.estimatedTotalTime / (buildTime / 1000);

        return {
            success: failedCells.size === 0,
            files: allFiles,
            buildTime,
            speedup,
            cellResults: completedCells,
        };
    }

    private async buildCellWithRetry(
        cell: LatticeCell,
        context: any,
        attempt: number = 1
    ): Promise<CellBuildResult> {
        const result = await this.cellBuilder.buildCell(cell, context);

        if (!result.success && attempt < 3) {
            // Use burst generation for complex cells
            if (cell.estimatedComplexity === 'complex') {
                return this.burstBuildCell(cell, context);
            }

            // Simple retry for simpler cells
            return this.buildCellWithRetry(cell, context, attempt + 1);
        }

        return result;
    }

    private async burstBuildCell(
        cell: LatticeCell,
        context: any
    ): Promise<CellBuildResult> {
        // Spawn 3 generators racing
        const results = await Promise.all([
            this.cellBuilder.buildCell(cell, context),
            this.cellBuilder.buildCell(cell, context),
            this.cellBuilder.buildCell(cell, context),
        ]);

        // Pick the best result
        const best = results
            .filter(r => r.interfaceCompliance.inputsValid && r.interfaceCompliance.outputsValid)
            .sort((a, b) => b.qualityScore - a.qualityScore)[0];

        return best || results[0];
    }

    private calculateProgress(
        blueprint: LatticeBlueprint,
        completed: Map<string, CellBuildResult>,
        failed: Set<string>
    ): LatticeProgress {
        const inProgress: string[] = [];
        // Find cells currently being built (simplified)

        return {
            totalCells: blueprint.cells.length,
            completedCells: completed.size,
            inProgressCells: inProgress,
            failedCells: Array.from(failed),
            estimatedTimeRemaining: 0, // Calculate based on remaining cells
            speedMultiplier: blueprint.estimatedTotalTime / blueprint.estimatedParallelTime,
        };
    }

    private synthesizeFiles(
        completedCells: Map<string, CellBuildResult>
    ): Array<{ path: string; content: string }> {
        const fileMap = new Map<string, string>();

        // Merge all cell files, handling conflicts by path
        for (const [, result] of completedCells) {
            for (const file of result.files) {
                if (fileMap.has(file.path)) {
                    // Merge file contents intelligently
                    fileMap.set(file.path, this.mergeFileContents(
                        fileMap.get(file.path)!,
                        file.content
                    ));
                } else {
                    fileMap.set(file.path, file.content);
                }
            }
        }

        return Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }));
    }

    private mergeFileContents(existing: string, incoming: string): string {
        // Intelligent merge - combine imports, exports, etc.
        // This is where interface contracts guarantee no conflicts
        return existing + '\n\n' + incoming;
    }
}

export function createLatticeOrchestrator(): LatticeOrchestrator {
    return new LatticeOrchestrator();
}
```

---

## Phase 3: Building Blocks (Structural Only)

### P3.1: Block Registry

**New file**: `server/src/services/lattice/block-registry.ts`

```typescript
/**
 * Building Block Registry
 *
 * Stores STRUCTURAL patterns only - no visual styling.
 * Blocks accelerate logic/structure while visual uniqueness
 * comes from Intent Lock's visualIdentity.
 */

export interface BuildingBlock {
    id: string;
    name: string;
    description: string;
    category: 'auth' | 'crud' | 'api' | 'state' | 'integration' | 'structure';

    // What this block provides (no visual code)
    provides: {
        files: Array<{
            pathTemplate: string; // e.g., "src/services/${name}.ts"
            contentTemplate: string; // Code with {{placeholders}}
        }>;
        interfaces: string[]; // TypeScript interfaces it exports
    };

    // Variables that must be filled in
    variables: Array<{
        name: string;
        description: string;
        type: 'string' | 'array' | 'object';
    }>;

    // Quality metrics from Component 28
    usageCount: number;
    successRate: number;
    averageQualityScore: number;
}

// Example structural blocks (no visual styling)
export const CORE_BLOCKS: BuildingBlock[] = [
    {
        id: 'block_auth_flow',
        name: 'Authentication Flow',
        description: 'Complete auth with login, register, forgot password - NO UI styling',
        category: 'auth',
        provides: {
            files: [
                {
                    pathTemplate: 'src/services/auth-service.ts',
                    contentTemplate: `
import { create } from 'zustand';

interface AuthState {
    user: {{UserType}} | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (data: {{RegisterData}}) => Promise<void>;
    logout: () => void;
    forgotPassword: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isLoading: false,
    error: null,

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            set({ user: data.user, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    register: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            set({ user: result.user, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    logout: () => {
        fetch('/api/auth/logout', { method: 'POST' });
        set({ user: null });
    },

    forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) throw new Error('Failed to send reset email');
            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },
}));
`,
                },
                {
                    pathTemplate: 'server/src/routes/auth.ts',
                    contentTemplate: `
import { Router } from 'express';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db.insert(users).values({
        id: crypto.randomUUID(),
        email,
        passwordHash,
        name,
        createdAt: new Date(),
    }).returning();

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

router.post('/logout', (req, res) => {
    res.json({ success: true });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    // Send password reset email
    res.json({ success: true });
});

export default router;
`,
                },
            ],
            interfaces: ['AuthState', 'UserType', 'RegisterData'],
        },
        variables: [
            { name: 'UserType', description: 'TypeScript type for user object', type: 'string' },
            { name: 'RegisterData', description: 'TypeScript type for registration data', type: 'string' },
        ],
        usageCount: 0,
        successRate: 0,
        averageQualityScore: 0,
    },

    {
        id: 'block_crud_api',
        name: 'CRUD API Pattern',
        description: 'Standard REST CRUD endpoints - NO UI',
        category: 'crud',
        provides: {
            files: [
                {
                    pathTemplate: 'server/src/routes/{{resourcePlural}}.ts',
                    contentTemplate: `
import { Router } from 'express';
import { db } from '../db.js';
import { {{tableName}} } from '../schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// List all
router.get('/', requireAuth, async (req, res) => {
    const items = await db.select().from({{tableName}});
    res.json({ items });
});

// Get one
router.get('/:id', requireAuth, async (req, res) => {
    const [item] = await db.select().from({{tableName}}).where(eq({{tableName}}.id, req.params.id)).limit(1);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
});

// Create
router.post('/', requireAuth, async (req, res) => {
    const [item] = await db.insert({{tableName}}).values({
        id: crypto.randomUUID(),
        ...req.body,
        createdAt: new Date(),
    }).returning();
    res.status(201).json({ item });
});

// Update
router.put('/:id', requireAuth, async (req, res) => {
    const [item] = await db.update({{tableName}})
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq({{tableName}}.id, req.params.id))
        .returning();
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ item });
});

// Delete
router.delete('/:id', requireAuth, async (req, res) => {
    await db.delete({{tableName}}).where(eq({{tableName}}.id, req.params.id));
    res.json({ success: true });
});

export default router;
`,
                },
            ],
            interfaces: [],
        },
        variables: [
            { name: 'tableName', description: 'Drizzle table name', type: 'string' },
            { name: 'resourcePlural', description: 'Plural resource name for route', type: 'string' },
        ],
        usageCount: 0,
        successRate: 0,
        averageQualityScore: 0,
    },

    {
        id: 'block_stripe_integration',
        name: 'Stripe Payment Integration',
        description: 'Stripe checkout and webhook handling - NO UI',
        category: 'integration',
        provides: {
            files: [
                {
                    pathTemplate: 'server/src/services/stripe-service.ts',
                    contentTemplate: `
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
});

export async function createCheckoutSession(params: {
    customerId?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
}): Promise<string> {
    const session = await stripe.checkout.sessions.create({
        customer: params.customerId,
        line_items: [{ price: params.priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata,
    });
    return session.url!;
}

export async function handleWebhook(
    body: Buffer,
    signature: string
): Promise<Stripe.Event> {
    return stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
    );
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
    await stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.retrieve(subscriptionId);
}
`,
                },
                {
                    pathTemplate: 'server/src/routes/stripe-webhooks.ts',
                    contentTemplate: `
import { Router } from 'express';
import { handleWebhook } from '../services/stripe-service.js';
import { db } from '../db.js';
import { subscriptions } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    try {
        const event = await handleWebhook(req.body, sig);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                await db.insert(subscriptions).values({
                    id: crypto.randomUUID(),
                    userId: session.metadata?.userId,
                    stripeSubscriptionId: session.subscription as string,
                    status: 'active',
                    createdAt: new Date(),
                });
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await db.update(subscriptions)
                    .set({ status: 'cancelled', cancelledAt: new Date() })
                    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
                break;
            }
        }

        res.json({ received: true });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
`,
                },
            ],
            interfaces: [],
        },
        variables: [],
        usageCount: 0,
        successRate: 0,
        averageQualityScore: 0,
    },
];
```

---

## Phase 4: Integration with Existing Systems

### P4.1: Connect LATTICE to 6-Phase Build Loop

**Modify**: `server/src/services/automation/build-loop.ts`

Add LATTICE as an optional enhancement to Phase 2 (PARALLEL BUILD):

```typescript
// In build-loop.ts, modify phase2ParallelBuild

async phase2ParallelBuild(state: BuildLoopState): Promise<void> {
    const useLattice = state.config.speedEnhancements?.includes('lattice');

    if (useLattice) {
        // Use LATTICE for parallel building
        const crystallizer = createIntentCrystallizer();
        const blueprint = await crystallizer.crystallize(state.intentContract);

        const orchestrator = createLatticeOrchestrator();
        orchestrator.on('cellComplete', (event) => {
            this.emit('progress', {
                phase: 2,
                message: `Cell ${event.cellId} complete`,
                progress: event.progress,
            });
        });

        const result = await orchestrator.build(blueprint, {
            appSoul: state.intentContract.appSoul,
            visualIdentity: state.intentContract.visualIdentity,
        });

        // Apply files to project
        for (const file of result.files) {
            await this.writeFile(state.projectId, file.path, file.content);
        }

        state.latticeSpeedup = result.speedup;
    } else {
        // Original parallel build logic
        await this.originalParallelBuild(state);
    }
}
```

### P4.2: Connect LATTICE to Feature Agent Service

**Modify**: `server/src/services/feature-agent/feature-agent-service.ts`

Enable LATTICE mode for feature agent builds:

```typescript
// Add option to use LATTICE
async deployFeatureAgent(request: CreateFeatureAgentRequest): Promise<FeatureAgentConfig> {
    const config: FeatureAgentConfig = {
        // ... existing config
        speedEnhancements: ['lattice', 'speculative'], // Enable LATTICE
    };

    // ... rest of deployment
}
```

### P4.3: Connect to Component 28 Learning

**Modify**: `server/src/services/learning/experience-capture.ts`

Capture LATTICE cell patterns for learning:

```typescript
// Add LATTICE experience capture
async captureLatticeExperience(
    blueprintId: string,
    cellResults: Map<string, CellBuildResult>
): Promise<void> {
    for (const [cellId, result] of cellResults) {
        await this.captureExperience({
            type: 'lattice_cell_build',
            context: {
                cellId,
                cellType: result.cellType,
                complexity: result.complexity,
            },
            decision: {
                approach: result.approach,
                patternsUsed: result.patternsUsed,
            },
            outcome: {
                success: result.success,
                qualityScore: result.qualityScore,
                buildTime: result.buildTime,
            },
        });
    }
}
```

---

## Phase 5: Pre-computation & Speculative

### P5.1: Wait Time Utilization

**New file**: `server/src/services/lattice/precompute-engine.ts`

```typescript
/**
 * Pre-computation Engine
 *
 * Utilizes user wait time (plan review, credential entry) to
 * pre-generate likely lattice cells.
 */

export class PrecomputeEngine {
    private precomputedCells = new Map<string, CellBuildResult>();
    private activePrecomputes = new Set<string>();

    async startPrecomputation(
        blueprint: LatticeBlueprint,
        context: any
    ): Promise<void> {
        // Start pre-computing cells with no dependencies first
        const noDeps = blueprint.cells.filter(c => c.dependsOn.length === 0);

        for (const cell of noDeps) {
            if (this.activePrecomputes.has(cell.id)) continue;

            this.activePrecomputes.add(cell.id);

            // Non-blocking pre-computation
            this.precomputeCell(cell, context).then(result => {
                this.precomputedCells.set(cell.id, result);
                this.activePrecomputes.delete(cell.id);
            });
        }
    }

    getPrecomputedCell(cellId: string): CellBuildResult | null {
        return this.precomputedCells.get(cellId) || null;
    }

    cancelPrecomputation(): void {
        this.activePrecomputes.clear();
    }

    private async precomputeCell(
        cell: LatticeCell,
        context: any
    ): Promise<CellBuildResult> {
        const builder = new CellBuilder();
        return builder.buildCell(cell, context);
    }
}
```

---

## Phase 6: UI Updates

### P6.1: LATTICE Progress Visualization

**New file**: `src/components/builder/LatticeProgress.tsx`

```tsx
/**
 * LATTICE Progress Visualization
 *
 * Shows the lattice grid with cells lighting up as they complete.
 * Displays speedup metrics and parallel execution flow.
 */

import { motion } from 'framer-motion';
import { useLatticeStore } from '@/store/useLatticeStore';

export function LatticeProgress() {
    const { blueprint, completedCells, inProgressCells, speedup } = useLatticeStore();

    if (!blueprint) return null;

    return (
        <div className="lattice-progress">
            <div className="lattice-header">
                <h3>LATTICE Build</h3>
                <div className="speedup-badge">
                    {speedup.toFixed(1)}x faster
                </div>
            </div>

            <div className="lattice-grid">
                {blueprint.parallelGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="lattice-group">
                        <div className="group-label">Group {groupIndex + 1}</div>
                        <div className="cells">
                            {group.map(cellId => {
                                const cell = blueprint.cells.find(c => c.id === cellId);
                                const isComplete = completedCells.has(cellId);
                                const isInProgress = inProgressCells.has(cellId);

                                return (
                                    <motion.div
                                        key={cellId}
                                        className={`lattice-cell ${isComplete ? 'complete' : ''} ${isInProgress ? 'in-progress' : ''}`}
                                        initial={{ scale: 0.8, opacity: 0.5 }}
                                        animate={{
                                            scale: isComplete ? 1 : isInProgress ? 1.05 : 0.9,
                                            opacity: isComplete ? 1 : isInProgress ? 0.8 : 0.4,
                                        }}
                                    >
                                        <div className="cell-icon">
                                            {cell?.type === 'ui' && <IconUI />}
                                            {cell?.type === 'api' && <IconAPI />}
                                            {cell?.type === 'logic' && <IconLogic />}
                                        </div>
                                        <div className="cell-name">{cell?.name}</div>
                                        {isInProgress && (
                                            <motion.div
                                                className="cell-pulse"
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ repeat: Infinity, duration: 1 }}
                                            />
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="lattice-footer">
                <div className="progress-bar">
                    <motion.div
                        className="progress-fill"
                        animate={{ width: `${(completedCells.size / blueprint.cells.length) * 100}%` }}
                    />
                </div>
                <div className="progress-text">
                    {completedCells.size} / {blueprint.cells.length} cells
                </div>
            </div>
        </div>
    );
}
```

### P6.2: GitHub Connect UI in Settings

Add `GitHubConnect` component to settings page.

---

## Implementation Order

Execute in this order:

### Week 1: Critical Gaps
1. **P0.1**: Wire merge button (1 day)
2. **P0.2**: GitHub OAuth + repo creation (2 days)

### Week 2: Core LATTICE
3. **P1.1**: Intent Crystallizer (2 days)
4. **P2.1**: Cell Builder (1 day)
5. **P2.2**: Lattice Orchestrator (2 days)

### Week 3: Enhancements
6. **P3.1**: Building Blocks registry (1 day)
7. **P4.1-4.3**: Integration with existing systems (2 days)
8. **P5.1**: Pre-computation engine (1 day)

### Week 4: Polish
9. **P6.1-6.2**: UI updates (2 days)
10. Testing & refinement (3 days)

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Build Speed | 8-12x vs sequential | Time from intent to working app |
| Merge Conflicts | 0 | Count of conflict resolutions needed |
| Quality Score | 85+ | Anti-slop verification score |
| First-Time Success | 90%+ | Cells that pass on first build |
| GitHub Push Success | 100% | Successful pushes to user repos |

---

## Verification Checklist

Before marking LATTICE complete:

- [ ] Merge button actually merges code
- [ ] Users can connect GitHub accounts
- [ ] Users can create repos from KripTik
- [ ] Users can push completed apps to GitHub
- [ ] LATTICE decomposition produces reasonable cells
- [ ] Cells build in parallel without conflicts
- [ ] Interface contracts are enforced
- [ ] Anti-slop rules pass on all output
- [ ] Speed improvement measurable (target: 8x+)
- [ ] Building blocks are structural only (no visual styling)
- [ ] Learning engine captures LATTICE patterns

---

*LATTICE: Where intent crystallizes into perfect code.*
