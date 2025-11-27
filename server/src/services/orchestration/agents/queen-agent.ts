/**
 * Queen Agent
 *
 * Coordinates worker agents for a specific domain (infrastructure, development, design, quality).
 * Receives tasks from the orchestrator and dispatches to appropriate workers.
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
import { ClaudeService } from '../../ai/claude-service.js';
import { WorkerAgent } from './worker-agent.js';

export class QueenAgent extends EventEmitter {
    private id: AgentId;
    private type: AgentType;
    private claudeService: ClaudeService;
    private sharedContext: SharedContext;
    private workers: Map<AgentType, WorkerAgent> = new Map();
    private systemPrompt: string;

    constructor(
        id: AgentId,
        type: AgentType,
        claudeService: ClaudeService,
        sharedContext: SharedContext
    ) {
        super();
        this.id = id;
        this.type = type;
        this.claudeService = claudeService;
        this.sharedContext = sharedContext;
        this.systemPrompt = getAgentPrompt(type);

        // Spawn workers based on queen type
        this.spawnWorkers();
    }

    /**
     * Spawn worker agents based on queen type
     */
    private spawnWorkers(): void {
        const workerTypes = this.getWorkerTypes();

        for (const workerType of workerTypes) {
            const worker = new WorkerAgent(
                uuidv4(),
                workerType,
                this.claudeService,
                this.sharedContext
            );
            this.workers.set(workerType, worker);
            this.log(`Spawned worker: ${workerType}`);
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
     */
    async executeTask(task: Task): Promise<Artifact[]> {
        this.log(`Received task: ${task.name}`);

        // Determine best worker for this task
        const worker = this.selectWorker(task);

        if (!worker) {
            // If no specific worker, queen handles it directly
            return this.executeDirectly(task);
        }

        // Delegate to worker
        this.log(`Delegating to worker: ${worker.getType()}`);
        return worker.execute(task);
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
     */
    private async executeDirectly(task: Task): Promise<Artifact[]> {
        this.log(`Executing directly: ${task.name}`);

        const contextPrompt = getContextInjectionPrompt(this.sharedContext);

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

        const response = await this.claudeService.generateStructured<Array<{
            path: string;
            type: Artifact['type'];
            language: string;
            content: string;
        }>>(taskPrompt, this.systemPrompt);

        return response.map(r => ({
            id: uuidv4(),
            taskId: task.id,
            type: r.type,
            path: r.path,
            content: r.content,
            language: r.language,
            validated: false,
        }));
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

