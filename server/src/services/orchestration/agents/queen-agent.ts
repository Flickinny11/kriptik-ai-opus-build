/**
 * Queen Agent
 *
 * Coordinates worker agents for a specific domain (infrastructure, development, design, quality).
 * Receives tasks from the orchestrator and dispatches to appropriate workers.
 *
 * NOW USING: OpenRouterClient with phase-based configuration
 * All AI calls route through openrouter.ai/api/v1
 *
 * MEMORY HARNESS INTEGRATION:
 * - Loads context from artifacts at session start
 * - Updates artifacts with task coordination
 * - Workers use CodingAgentWrapper
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    Task,
    Artifact,
    AgentType,
    AgentId,
    SharedContext,
    Agent,
} from '../types.js';
import { getAgentPrompt, getContextInjectionPrompt } from '../prompts.js';
import {
    getOpenRouterClient,
    getPhaseConfig,
    type OpenRouterClient,
    type OpenRouterModel,
} from '../../ai/openrouter-client.js';
import { getWebSocketSyncService } from '../../agents/websocket-sync.js';
import { createVerificationSwarm, type VerificationSwarm } from '../../verification/swarm.js';
import { WorkerAgent } from './worker-agent.js';
// Memory Harness Integration
import {
    loadProjectContext,
    formatContextForPrompt,
    hasProjectContext,
    type LoadedContext,
} from '../../ai/context-loader.js';
import {
    createArtifactManager,
    type ArtifactManager,
} from '../../ai/artifacts.js';

// Worker type to build phase mapping for optimal model selection
const WORKER_PHASE_MAP: Record<string, string> = {
    'vpc_architect': 'build_agent',
    'database_engineer': 'build_agent',
    'security_specialist': 'visual_verify',  // Higher reasoning for security
    'deploy_master': 'build_agent',
    'api_engineer': 'build_agent',
    'frontend_engineer': 'build_agent',
    'auth_specialist': 'build_agent',
    'integration_engineer': 'build_agent',
    'ui_architect': 'visual_verify',         // Design needs higher reasoning
    'motion_designer': 'build_agent',
    'responsive_engineer': 'build_agent',
    'a11y_specialist': 'error_check',
    'test_engineer': 'error_check',
    'e2e_tester': 'error_check',
    'code_reviewer': 'intent_satisfaction',  // Critical judgment
    'security_auditor': 'intent_satisfaction',
};

export class QueenAgent extends EventEmitter {
    private id: AgentId;
    private type: AgentType;
    private openRouter: OpenRouterClient;
    private sharedContext: SharedContext;
    private workers: Map<AgentType, WorkerAgent> = new Map();
    private systemPrompt: string;
    private verificationSwarm: VerificationSwarm | null = null;

    // Memory Harness
    private loadedContext: LoadedContext | null = null;
    private artifactManager: ArtifactManager | null = null;
    private projectPath: string;
    private projectId: string;
    private userId: string;
    private orchestrationRunId: string;

    constructor(
        id: AgentId,
        type: AgentType,
        sharedContext: SharedContext,
        projectPath?: string
    ) {
        super();
        this.id = id;
        this.type = type;
        this.openRouter = getOpenRouterClient();
        this.sharedContext = sharedContext;
        this.systemPrompt = getAgentPrompt(type);

        // Memory harness setup
        // Note: orchestration SharedContext doesn't have projectId/userId/sessionId directly
        // Generate IDs for memory harness
        this.projectId = `project-${id.substring(0, 8)}`;
        this.userId = 'system';
        this.orchestrationRunId = uuidv4();
        this.projectPath = projectPath || `/tmp/kriptik-queen-${this.projectId}`;

        // Initialize artifact manager
        this.artifactManager = createArtifactManager(
            this.projectId,
            this.orchestrationRunId,
            this.userId
        );

        // Initialize verification swarm for output validation
        this.verificationSwarm = createVerificationSwarm(
            this.orchestrationRunId,
            this.projectId,
            this.userId
        );

        // Spawn workers based on queen type
        this.spawnWorkers();

        console.log(`[QueenAgent] ${type} initialized via OpenRouter with ${this.workers.size} workers`);
    }

    /**
     * Start a new session by loading context from artifacts
     */
    async startSession(): Promise<void> {
        // Load project context from artifacts
        const hasContext = await hasProjectContext(this.projectPath);

        if (hasContext) {
            this.loadedContext = await loadProjectContext(this.projectPath);
            this.log(`Loaded context: ${this.loadedContext.taskList?.completedTasks || 0} tasks completed`);
        }

        // Build system prompt with context
        this.systemPrompt = this.buildSystemPromptWithContext(getAgentPrompt(this.type));

        // Log session start in artifacts
        await this.artifactManager?.appendProgressEntry({
            agentId: this.id,
            agentType: this.type,
            action: `${this.type} Queen session started`,
            completed: ['Context loaded', 'Workers spawned'],
            filesModified: [],
            nextSteps: ['Coordinate workers', 'Execute assigned tasks'],
        });

        this.emit('session_started', { queenType: this.type, hasContext });
    }

    /**
     * Build system prompt with injected context
     */
    private buildSystemPromptWithContext(basePrompt: string): string {
        if (!this.loadedContext) {
            return basePrompt;
        }

        const contextSection = formatContextForPrompt(this.loadedContext);

        return `${basePrompt}

═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT (Loaded from persistent artifacts)
═══════════════════════════════════════════════════════════════════════════════

${contextSection}

═══════════════════════════════════════════════════════════════════════════════
You are a ${this.type} Queen agent coordinating workers on this project.
Use the context above to understand current state and assign appropriate tasks.

ACTIVE WORKERS:
${Array.from(this.workers.keys()).map(w => `- ${w}`).join('\n')}

Your job is to coordinate workers efficiently, track progress, and ensure quality.
═══════════════════════════════════════════════════════════════════════════════`;
    }

    /**
     * Spawn worker agents based on queen type
     * Workers now use OpenRouterClient with phase-based configuration
     */
    private spawnWorkers(): void {
        const workerTypes = this.getWorkerTypes();

        for (const workerType of workerTypes) {
            const phase = WORKER_PHASE_MAP[workerType] || 'build_agent';
            const worker = new WorkerAgent(
                uuidv4(),
                workerType,
                this.sharedContext,
                phase
            );
            this.workers.set(workerType, worker);

            // Forward worker events for WebSocket broadcast
            worker.on('log', (data) => this.emit('worker_log', { ...data, queenType: this.type }));
            worker.on('artifact_created', (data) => this.emit('artifact_created', data));

            this.log(`Spawned worker: ${workerType} (phase: ${phase})`);
        }
    }

    /**
     * Get worker types for this queen
     */
    private getWorkerTypes(): AgentType[] {
        const workersByQueen: Record<string, AgentType[]> = {
            infrastructure_queen: ['vpc_architect', 'database_engineer', 'security_specialist', 'deploy_master'],
            development_queen: ['api_engineer', 'frontend_engineer', 'auth_specialist', 'integration_engineer'],
            design_queen: ['ui_architect', 'motion_designer', 'responsive_engineer', 'a11y_specialist'],
            quality_queen: ['test_engineer', 'e2e_tester', 'code_reviewer', 'security_auditor'],
        };
        return workersByQueen[this.type] || [];
    }

    /**
     * Execute a task by dispatching to appropriate worker
     *
     * Now updates artifacts with task coordination:
     * - Records task assignment
     * - Tracks worker progress
     * - Updates task list on completion
     */
    async executeTask(task: Task): Promise<Artifact[]> {
        this.log(`Received task: ${task.name}`);

        // Record task reception in artifacts
        await this.artifactManager?.appendProgressEntry({
            agentId: this.id,
            agentType: this.type,
            taskId: task.id,
            action: `Received task: ${task.name}`,
            completed: [],
            filesModified: [],
            nextSteps: ['Assign to worker or execute directly'],
        });

        // Determine best worker for this task
        const worker = this.selectWorker(task);

        if (!worker) {
            // If no specific worker, queen handles it directly
            this.log(`No suitable worker, executing directly`);
            return this.executeDirectly(task);
        }

        // Record task delegation in artifacts
        const workerType = worker.getType();
        await this.artifactManager?.appendProgressEntry({
            agentId: this.id,
            agentType: this.type,
            taskId: task.id,
            action: `Delegating to ${workerType}`,
            completed: [`Task assigned: ${task.name}`],
            filesModified: [],
            nextSteps: [`${workerType} to complete task`],
        });

        // Delegate to worker
        this.log(`Delegating to worker: ${workerType}`);
        const artifacts = await worker.execute(task);

        // Record task completion in artifacts
        await this.artifactManager?.appendProgressEntry({
            agentId: this.id,
            agentType: this.type,
            taskId: task.id,
            action: `Worker ${workerType} completed task`,
            completed: [`${task.name}: ${artifacts.length} artifacts`],
            filesModified: artifacts.map(a => a.path),
            nextSteps: ['Verify artifacts', 'Proceed to next task'],
        });

        return artifacts;
    }

    /**
     * Select the best worker for a task based on task description
     */
    private selectWorker(task: Task): WorkerAgent | null {
        const taskName = task.name.toLowerCase();
        const taskDesc = task.description.toLowerCase();
        const combined = `${taskName} ${taskDesc}`;

        // Worker selection logic based on keywords
        const workerKeywords: Record<AgentType, string[]> = {
            // Infrastructure
            vpc_architect: ['vpc', 'network', 'subnet', 'gateway', 'route'],
            database_engineer: ['database', 'schema', 'migration', 'postgres', 'mysql', 'rds'],
            security_specialist: ['iam', 'role', 'policy', 'secret', 'security', 'ssl', 'tls'],
            deploy_master: ['deploy', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes', 'github actions'],

            // Development
            api_engineer: ['api', 'route', 'endpoint', 'rest', 'graphql', 'trpc'],
            frontend_engineer: ['component', 'page', 'react', 'next', 'ui', 'frontend'],
            auth_specialist: ['auth', 'login', 'signup', 'jwt', 'session', 'oauth'],
            integration_engineer: ['stripe', 'payment', 'email', 'sendgrid', 'webhook', 'third-party'],

            // Design
            ui_architect: ['design system', 'token', 'theme', 'component library', 'shadcn'],
            motion_designer: ['animation', 'motion', 'transition', 'framer', 'gsap'],
            responsive_engineer: ['responsive', 'mobile', 'breakpoint', 'adaptive'],
            a11y_specialist: ['accessibility', 'a11y', 'aria', 'screen reader', 'wcag'],

            // Quality
            test_engineer: ['unit test', 'integration test', 'vitest', 'jest'],
            e2e_tester: ['e2e', 'playwright', 'cypress', 'end-to-end'],
            code_reviewer: ['review', 'quality', 'lint', 'best practice'],
            security_auditor: ['vulnerability', 'audit', 'scan', 'security review'],

            // Queens (not used for selection)
            infrastructure_queen: [],
            development_queen: [],
            design_queen: [],
            quality_queen: [],
        };

        let bestWorker: WorkerAgent | null = null;
        let bestScore = 0;

        for (const [type, worker] of this.workers) {
            const keywords = workerKeywords[type] || [];
            let score = 0;

            for (const keyword of keywords) {
                if (combined.includes(keyword)) {
                    score += keyword.length; // Longer matches = higher score
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestWorker = worker;
            }
        }

        return bestWorker;
    }

    /**
     * Execute task directly as queen (when no worker is appropriate)
     * Uses OpenRouter with phase-based configuration
     */
    private async executeDirectly(task: Task): Promise<Artifact[]> {
        this.log(`Executing directly: ${task.name}`);

        const contextPrompt = getContextInjectionPrompt(this.sharedContext);
        const phaseConfig = getPhaseConfig('build_agent');

        const taskPrompt = `Execute this task and generate production-ready code:

TASK: ${task.name}
DESCRIPTION: ${task.description}

${contextPrompt}

REQUIREMENTS:
1. Generate complete, functional code - NO placeholders
2. Follow established architecture patterns
3. Include proper error handling
4. Use TypeScript with strict types
5. Add appropriate comments for complex logic

OUTPUT FORMAT:
Return a JSON array of artifacts:
[
  {
    "path": "full/file/path.ts",
    "type": "file",
    "language": "typescript",
    "content": "// Complete code here..."
  }
]

Generate all necessary files to complete this task.`;

        // Use OpenRouter with phase configuration
        const client = this.openRouter.withContext({
            agentType: this.type,
            feature: 'queen_direct_execute',
            phase: 'build_agent',
        });

        const result = await client.messages.create({
            model: phaseConfig.model,
            max_tokens: 16000,
            system: this.systemPrompt,
            messages: [{ role: 'user', content: taskPrompt }],
        });

        // Parse response
        const responseText = result.content[0]?.type === 'text' ? result.content[0].text : '';
        let artifacts: Artifact[] = [];

        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as Array<{
                    path: string;
                    type: Artifact['type'];
                    language: string;
                    content: string;
                }>;

                artifacts = parsed.map(r => ({
                    id: uuidv4(),
                    taskId: task.id,
                    type: r.type,
                    path: r.path,
                    content: r.content,
                    language: r.language,
                    validated: false,
                }));
            }
        } catch (parseError) {
            this.log(`Warning: Failed to parse artifacts JSON: ${(parseError as Error).message}`);
        }

        // Run verification swarm on generated artifacts
        if (this.verificationSwarm && artifacts.length > 0) {
            await this.verifyArtifacts(artifacts, task);
        }

        // Broadcast artifact creation via WebSocket
        const wsSync = getWebSocketSyncService();
        const contextId = this.id; // Use queen's ID as context ID
        for (const artifact of artifacts) {
            wsSync.broadcast(contextId, 'artifact-created', {
                queenType: this.type,
                taskId: task.id,
                artifact: { path: artifact.path, type: artifact.type, validated: artifact.validated },
            });
        }

        return artifacts;
    }

    /**
     * Verify generated artifacts using the Verification Swarm
     */
    private async verifyArtifacts(artifacts: Artifact[], task: Task): Promise<void> {
        if (!this.verificationSwarm) return;

        // Create file map for verification
        const fileContents = new Map<string, string>();
        for (const artifact of artifacts) {
            if (artifact.content) {
                fileContents.set(artifact.path, artifact.content);
            }
        }

        // Create a pseudo-feature for verification that matches the Feature type
        const pseudoFeature = {
            featureId: task.id,
            name: task.name,
            description: task.description,
            category: 'core' as const,
            priority: 1,
            status: 'building' as const,
            implementationSteps: [] as string[],
            visualRequirements: [] as string[],
            buildAttempts: 0,
            // Additional required fields with defaults
            id: task.id,
            buildIntentId: 'temp',
            orchestrationRunId: 'temp',
            projectId: 'temp',
            isCore: true,
            dependencies: [],
            isVisuallyCritical: false,
            assignedAgent: null,
            passes: false,
            errorHistory: [],
            codeSnippets: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        try {
            const verdict = await this.verificationSwarm.verifyFeature(pseudoFeature as any, fileContents);

            // Update artifact validation status based on verdict
            for (const artifact of artifacts) {
                artifact.validated = verdict.verdict === 'APPROVED';
                if (!artifact.validated) {
                    artifact.validationErrors = verdict.blockers;
                }
            }

            this.log(`Verification result: ${verdict.verdict} (score: ${verdict.overallScore})`);

            // Broadcast verification result
            const wsSync = getWebSocketSyncService();
            const contextId = this.id;
            wsSync.broadcast(contextId, 'verification-result', {
                queenType: this.type,
                taskId: task.id,
                verdict: verdict.verdict,
                score: verdict.overallScore,
                blockers: verdict.blockers,
            });
        } catch (verifyError) {
            this.log(`Verification failed: ${(verifyError as Error).message}`);
        }
    }

    /**
     * Get agent ID
     */
    getId(): AgentId {
        return this.id;
    }

    /**
     * Get agent type
     */
    getType(): AgentType {
        return this.type;
    }

    /**
     * Get all workers
     */
    getWorkers(): WorkerAgent[] {
        return Array.from(this.workers.values());
    }

    /**
     * Log a message
     */
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.type.toUpperCase()}] ${message}`);
        this.emit('log', { agent: this.type, message, timestamp });
    }
}

