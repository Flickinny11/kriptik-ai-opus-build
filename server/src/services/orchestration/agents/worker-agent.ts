/**
 * Worker Agent
 *
 * Specialized agent that performs atomic tasks within a specific domain.
 * Each worker type has specialized prompts and output formats.
 *
 * NOW USING: OpenRouterClient with phase-based configuration
 * All AI calls route through openrouter.ai/api/v1
 *
 * MEMORY HARNESS INTEGRATION:
 * - Uses CodingAgentWrapper for context-aware execution
 * - Updates artifacts on task completion
 * - Commits changes to git
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    Task,
    Artifact,
    AgentType,
    AgentId,
    SharedContext,
} from '../types.js';
import { getAgentPrompt, getContextInjectionPrompt } from '../prompts.js';
import {
    getOpenRouterClient,
    getPhaseConfig,
    type OpenRouterClient,
} from '../../ai/openrouter-client.js';
import { getWebSocketSyncService } from '../../agents/websocket-sync.js';
import {
    createSandboxService,
    type SandboxService,
    type SandboxInstance,
} from '../../developer-mode/sandbox-service.js';
import {
    createErrorEscalationEngine,
    type ErrorEscalationEngine,
    type BuildError,
} from '../../automation/error-escalation.js';
// Memory Harness Integration
import {
    createCodingAgentWrapper,
    type CodingAgentWrapper,
} from '../../ai/coding-agent-wrapper.js';
import {
    createArtifactManager,
    type ArtifactManager,
} from '../../ai/artifacts.js';

export class WorkerAgent extends EventEmitter {
    private id: AgentId;
    private type: AgentType;
    private openRouter: OpenRouterClient;
    private sharedContext: SharedContext;
    private systemPrompt: string;
    private busy = false;
    private phase: string;
    private sandbox: SandboxInstance | null = null;
    private sandboxService: SandboxService | null = null;
    private errorEscalation: ErrorEscalationEngine | null = null;

    // Memory Harness
    private projectPath: string;
    private projectId: string;
    private userId: string;
    private orchestrationRunId: string;
    private artifactManager: ArtifactManager | null = null;

    constructor(
        id: AgentId,
        type: AgentType,
        sharedContext: SharedContext,
        phase: string = 'build_agent'
    ) {
        super();
        this.id = id;
        this.type = type;
        this.openRouter = getOpenRouterClient();
        this.sharedContext = sharedContext;
        this.systemPrompt = getAgentPrompt(type);
        this.phase = phase;

        // Memory harness setup
        // Note: orchestration SharedContext doesn't have projectId/userId/sessionId directly
        // Generate IDs for memory harness
        this.projectId = `project-${id.substring(0, 8)}`;
        this.userId = 'system';
        this.orchestrationRunId = uuidv4();
        this.projectPath = `/tmp/kriptik-worker-${this.projectId}`;

        // Initialize artifact manager
        this.artifactManager = createArtifactManager(
            this.projectId,
            this.orchestrationRunId,
            this.userId
        );

        // Initialize sandbox service for isolated testing
        try {
            this.sandboxService = createSandboxService({
                basePort: 3300 + Math.floor(Math.random() * 100),
                maxSandboxes: 5,
                projectPath: this.projectPath,
                framework: 'vite',
            });
        } catch (e) {
            // Sandbox creation is optional
        }

        console.log(`[WorkerAgent] ${type} initialized via OpenRouter (phase: ${phase})`);
    }

    /**
     * Execute a task using CodingAgentWrapper for memory harness integration
     * Uses Error Escalation for automatic retry on failures
     */
    async execute(task: Task): Promise<Artifact[]> {
        if (this.busy) {
            throw new Error(`Worker ${this.type} is busy`);
        }

        this.busy = true;
        this.log(`Starting task: ${task.name}`);

        // Create CodingAgentWrapper for this task
        const codingAgent = createCodingAgentWrapper({
            projectId: this.projectId,
            userId: this.userId,
            orchestrationRunId: this.orchestrationRunId,
            projectPath: this.projectPath,
            agentType: `worker-${this.type}`,
            agentId: `${this.type}-${task.id}`,
        });

        // Broadcast task start via WebSocket
        const wsSync = getWebSocketSyncService();
        const contextId = this.id; // Use worker's ID as context ID
        wsSync.broadcast(contextId, 'worker-task-started', {
            workerId: this.id,
            workerType: this.type,
            taskId: task.id,
            taskName: task.name,
        });

        try {
            // Load context from artifacts
            await codingAgent.startSession();

            // Initialize sandbox for this worker if available
            if (this.sandboxService) {
                try {
                    await this.sandboxService.initialize();
                    this.sandbox = await this.sandboxService.createSandbox(this.id, this.projectPath);

                    wsSync.broadcast(contextId, 'worker-sandbox-ready', {
                        workerId: this.id,
                        sandboxUrl: this.sandbox.url,
                    });
                } catch (e) {
                    this.log(`Sandbox init skipped: ${(e as Error).message}`);
                }
            }

            // Generate artifacts using context-aware prompts
            const artifacts = await this.generateArtifactsWithContext(task, codingAgent);
            await this.validateArtifacts(artifacts);

            // Record file changes in memory harness
            for (const artifact of artifacts) {
                codingAgent.recordFileChange(artifact.path, 'create');
            }

            // CRITICAL: Write artifacts to disk
            // This was the missing piece - artifacts existed in memory but were never written
            for (const artifact of artifacts) {
                try {
                    const fullPath = path.join(this.projectPath, artifact.path);
                    const dir = path.dirname(fullPath);

                    // Create directory if it doesn't exist
                    await fs.mkdir(dir, { recursive: true });

                    // Write the file content
                    await fs.writeFile(fullPath, artifact.content, 'utf-8');

                    this.log(`Wrote file: ${artifact.path}`);
                } catch (writeError) {
                    this.log(`Failed to write ${artifact.path}: ${(writeError as Error).message}`);
                    // Don't fail the whole task - log and continue
                    // The file might already exist or have permission issues
                }
            }

            // Test in sandbox if available
            if (this.sandbox && this.sandbox.status === 'running') {
                await this.testInSandbox(artifacts);
            }

            // Complete task in memory harness (updates artifacts, commits to git)
            await codingAgent.completeTask({
                summary: `${this.type}: ${task.name}`,
                filesCreated: artifacts.map(a => a.path),
                nextSteps: ['Validate artifacts', 'Proceed to next task'],
            });

            await codingAgent.endSession();

            // Broadcast task complete
            wsSync.broadcast(contextId, 'worker-task-completed', {
                workerId: this.id,
                workerType: this.type,
                taskId: task.id,
                artifactCount: artifacts.length,
                validated: artifacts.every(a => a.validated),
            });

            this.log(`Completed task: ${task.name} (${artifacts.length} artifacts)`);
            return artifacts;

        } catch (error) {
            // Record failure in memory harness
            await codingAgent.blockTask((error as Error).message, ['Retry or escalate']);
            await codingAgent.endSession();

            // Use Error Escalation for automatic retry
            if (!this.errorEscalation) {
                this.errorEscalation = createErrorEscalationEngine(
                    this.orchestrationRunId,
                    this.projectId,
                    this.userId
                );
            }

            this.log(`Task failed, escalating: ${(error as Error).message}`);

            wsSync.broadcast(contextId, 'worker-task-error', {
                workerId: this.id,
                workerType: this.type,
                taskId: task.id,
                error: (error as Error).message,
                escalating: true,
            });

            try {
                // Create a BuildError for escalation
                const buildError: BuildError = {
                    id: uuidv4(),
                    featureId: task.id,
                    category: 'runtime_error',
                    message: (error as Error).message,
                    stack: (error as Error).stack,
                    timestamp: new Date(),
                };

                // Create file contents map from task context
                const fileContents = new Map<string, string>();

                const escalationResult = await this.errorEscalation.fixError(buildError, fileContents);

                if (escalationResult.success && escalationResult.fix) {
                    // Retry with the fix
                    this.log(`Escalation resolved at Level ${escalationResult.level}, retrying task`);

                    // Create new coding agent for retry
                    const retryCodingAgent = createCodingAgentWrapper({
                        projectId: this.projectId,
                        userId: this.userId,
                        orchestrationRunId: this.orchestrationRunId,
                        projectPath: this.projectPath,
                        agentType: `worker-${this.type}`,
                        agentId: `${this.type}-${task.id}-retry`,
                    });

                    await retryCodingAgent.startSession();
                    const artifacts = await this.generateArtifactsWithContext(task, retryCodingAgent);
                    await this.validateArtifacts(artifacts);

                    await retryCodingAgent.completeTask({
                        summary: `${this.type}: ${task.name} (retry after escalation)`,
                        filesCreated: artifacts.map(a => a.path),
                        nextSteps: ['Validate artifacts', 'Proceed to next task'],
                    });
                    await retryCodingAgent.endSession();

                    return artifacts;
                }
            } catch (escalationError) {
                this.log(`Escalation failed: ${(escalationError as Error).message}`);
            }

            throw error;
        } finally {
            this.busy = false;

            // Cleanup sandbox
            if (this.sandbox && this.sandboxService) {
                try {
                    await this.sandboxService.removeSandbox(this.id);
                    this.sandbox = null;
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }
    }

    /**
     * Generate artifacts using CodingAgentWrapper for context-aware prompts
     */
    private async generateArtifactsWithContext(task: Task, codingAgent: CodingAgentWrapper): Promise<Artifact[]> {
        const workerSpecificPrompt = this.getWorkerSpecificPrompt(task);
        const phaseConfig = getPhaseConfig(this.phase);

        // Get system prompt with context injected
        const systemPrompt = codingAgent.getSystemPromptWithContext(this.systemPrompt);

        const prompt = `${workerSpecificPrompt}

TASK: ${task.name}
DESCRIPTION: ${task.description}

CRITICAL REQUIREMENTS:
1. Generate PRODUCTION-READY code only
2. NO placeholders (TODO, FIXME, example.com, test-key, etc.)
3. NO mock data or hardcoded values that should be config
4. Include comprehensive error handling
5. Use TypeScript with strict types
6. Follow the project's established patterns

OUTPUT FORMAT:
Return a JSON array of complete file artifacts:
\`\`\`json
[
  {
    "path": "src/path/to/file.ts",
    "type": "file",
    "language": "typescript",
    "content": "// Complete implementation..."
  }
]
\`\`\`

Generate all files needed to fully implement this task.`;

        // Use OpenRouter with phase configuration
        const client = this.openRouter.withContext({
            agentType: this.type,
            feature: task.name,
            phase: this.phase,
        });

        const result = await client.messages.create({
            model: phaseConfig.model,
            max_tokens: 16000,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
        });

        // Parse response
        const responseText = result.content[0]?.type === 'text' ? result.content[0].text : '';
        let artifacts: Artifact[] = [];

        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                             responseText.match(/\[[\s\S]*\]/);

            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr) as Array<{
                    path: string;
                    type: string;
                    language: string;
                    content: string;
                }>;

                artifacts = parsed.map(r => ({
                    id: uuidv4(),
                    taskId: task.id,
                    type: this.mapArtifactType(r.type),
                    path: r.path,
                    content: r.content,
                    language: r.language,
                    validated: false,
                }));

                // Emit artifact creation events
                for (const artifact of artifacts) {
                    this.emit('artifact_created', {
                        workerId: this.id,
                        workerType: this.type,
                        artifact: { path: artifact.path, type: artifact.type },
                    });
                }
            }
        } catch (parseError) {
            this.log(`Warning: Failed to parse artifacts JSON: ${(parseError as Error).message}`);
        }

        return artifacts;
    }

    /**
     * Generate artifacts for a task
     * Uses OpenRouterClient with phase-based configuration
     */
    private async generateArtifacts(task: Task): Promise<Artifact[]> {
        const contextPrompt = getContextInjectionPrompt(this.sharedContext);
        const workerSpecificPrompt = this.getWorkerSpecificPrompt(task);
        const phaseConfig = getPhaseConfig(this.phase);

        const prompt = `${workerSpecificPrompt}

${contextPrompt}

TASK: ${task.name}
DESCRIPTION: ${task.description}

CRITICAL REQUIREMENTS:
1. Generate PRODUCTION-READY code only
2. NO placeholders (TODO, FIXME, example.com, test-key, etc.)
3. NO mock data or hardcoded values that should be config
4. Include comprehensive error handling
5. Use TypeScript with strict types
6. Follow the project's established patterns

OUTPUT FORMAT:
Return a JSON array of complete file artifacts:
\`\`\`json
[
  {
    "path": "src/path/to/file.ts",
    "type": "file",
    "language": "typescript",
    "content": "// Complete implementation..."
  }
]
\`\`\`

Generate all files needed to fully implement this task.`;

        // Use OpenRouter with phase configuration
        const client = this.openRouter.withContext({
            agentType: this.type,
            feature: task.name,
            phase: this.phase,
        });

        const result = await client.messages.create({
            model: phaseConfig.model,
            max_tokens: 16000,
            system: this.systemPrompt,
            messages: [{ role: 'user', content: prompt }],
        });

        // Parse response
        const responseText = result.content[0]?.type === 'text' ? result.content[0].text : '';
        let artifacts: Artifact[] = [];

        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                             responseText.match(/\[[\s\S]*\]/);

            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr) as Array<{
                    path: string;
                    type: string;
                    language: string;
                    content: string;
                }>;

                artifacts = parsed.map(r => ({
                    id: uuidv4(),
                    taskId: task.id,
                    type: this.mapArtifactType(r.type),
                    path: r.path,
                    content: r.content,
                    language: r.language,
                    validated: false,
                }));

                // Emit artifact creation events
                for (const artifact of artifacts) {
                    this.emit('artifact_created', {
                        workerId: this.id,
                        workerType: this.type,
                        artifact: { path: artifact.path, type: artifact.type },
                    });
                }
            }
        } catch (parseError) {
            this.log(`Warning: Failed to parse artifacts JSON: ${(parseError as Error).message}`);
        }

        return artifacts;
    }

    /**
     * Test generated artifacts in the sandbox
     */
    private async testInSandbox(artifacts: Artifact[]): Promise<void> {
        if (!this.sandbox || !this.sandboxService) return;

        try {
            // Trigger HMR update for each changed file
            for (const artifact of artifacts) {
                if (artifact.path.endsWith('.ts') || artifact.path.endsWith('.tsx')) {
                    await this.sandboxService.triggerHMRUpdate(this.id, artifact.path);
                }
            }

            this.log(`Sandbox test triggered for ${artifacts.length} artifacts`);
        } catch (e) {
            this.log(`Sandbox test failed: ${(e as Error).message}`);
        }
    }

    /**
     * Get worker-specific prompt additions
     */
    private getWorkerSpecificPrompt(task: Task): string {
        const prompts: Partial<Record<AgentType, string>> = {
            // Infrastructure workers
            vpc_architect: `You are generating cloud infrastructure code using Pulumi TypeScript.
Include proper resource naming, tagging, and output exports.
Always create security groups with least-privilege rules.`,

            database_engineer: `You are generating database schemas and infrastructure.
Use Drizzle ORM for schema definitions.
Include proper indexes, constraints, and relationships.
Generate migration files when needed.`,

            security_specialist: `You are implementing security configurations.
Generate IAM policies with least-privilege access.
Never hardcode secrets - use environment variables or secrets manager.
Include proper encryption configurations.`,

            deploy_master: `You are generating CI/CD pipelines and deployment configurations.
Use GitHub Actions for workflows.
Include proper caching, artifact handling, and rollback strategies.
Generate Docker configurations when needed.`,

            // Development workers
            api_engineer: `You are building backend API routes.
Use Express with TypeScript.
Include Zod validation for all inputs.
Add proper error responses and HTTP status codes.
Include rate limiting and authentication middleware where appropriate.`,

            frontend_engineer: `You are building React components with TypeScript.
Use modern React patterns (hooks, composition).
Import from shadcn/ui component library.
Use Tailwind CSS for styling with design tokens.
Include proper loading and error states.`,

            auth_specialist: `You are implementing authentication flows.
Use better-auth for the auth library.
Include proper session management.
Add role-based access control where needed.
Generate protected route middleware.`,

            integration_engineer: `You are integrating third-party services.
Use official SDKs when available.
Include proper error handling for API failures.
Add retry logic for transient errors.
Generate webhook handlers with signature verification.`,

            // Design workers
            ui_architect: `You are building a premium design system.
Define CSS custom properties for all design tokens.
Create customized shadcn/ui components - NEVER use defaults.
Include glassmorphism, depth, and modern aesthetics.
Follow the anti-slop manifesto - no generic UI patterns.`,

            motion_designer: `You are creating animations and micro-interactions.
Use Framer Motion for React animations.
Define reusable animation variants.
Include page transitions and element entrances.
Add hover and tap interactions to all buttons.`,

            responsive_engineer: `You are implementing responsive layouts.
Use mobile-first CSS approach.
Define breakpoints using Tailwind conventions.
Use container queries where appropriate.
Ensure touch-friendly interactions on mobile.`,

            a11y_specialist: `You are ensuring accessibility compliance.
Add proper ARIA attributes.
Include keyboard navigation support.
Use semantic HTML elements.
Add focus management for modals and dialogs.
Ensure color contrast meets WCAG 2.1 AA.`,

            // Quality workers
            test_engineer: `You are writing tests using Vitest.
Include unit tests for functions and components.
Use React Testing Library for component tests.
Generate test fixtures and mocks.
Aim for high coverage of critical paths.`,

            e2e_tester: `You are writing end-to-end tests using Playwright.
Create user flow tests for critical paths.
Include page object models for reusability.
Add visual regression tests.
Generate test data fixtures.`,

            code_reviewer: `You are reviewing code for quality.
Check for TypeScript errors and any types.
Verify error handling is comprehensive.
Ensure design system compliance.
Look for security vulnerabilities.
Check for placeholder patterns.`,

            security_auditor: `You are auditing code for security issues.
Check for injection vulnerabilities.
Verify authentication and authorization.
Look for exposed secrets or credentials.
Check dependency vulnerabilities.
Generate security report with remediation steps.`,
        };

        return prompts[this.type] || '';
    }

    /**
     * Validate generated artifacts
     */
    private async validateArtifacts(artifacts: Artifact[]): Promise<void> {
        for (const artifact of artifacts) {
            const issues: string[] = [];

            // Check for placeholder patterns
            const placeholderPatterns = [
                { pattern: /TODO:/gi, message: 'Contains TODO comment' },
                { pattern: /FIXME:/gi, message: 'Contains FIXME comment' },
                { pattern: /PLACEHOLDER/gi, message: 'Contains PLACEHOLDER' },
                { pattern: /\[\[.*?\]\]/g, message: 'Contains [[placeholder]] pattern' },
                { pattern: /{{.*?}}/g, message: 'Contains {{placeholder}} pattern' },
                { pattern: /<your-.*?>/gi, message: 'Contains <your-xxx> placeholder' },
                { pattern: /example\.com/gi, message: 'Contains example.com' },
                { pattern: /test-key/gi, message: 'Contains test-key' },
                { pattern: /mock-.*-id/gi, message: 'Contains mock ID' },
                { pattern: /sk_test_/gi, message: 'Contains test API key' },
                { pattern: /pk_test_/gi, message: 'Contains test API key' },
                { pattern: /password123/gi, message: 'Contains hardcoded password' },
                { pattern: /secret123/gi, message: 'Contains hardcoded secret' },
                { pattern: /lorem ipsum/gi, message: 'Contains lorem ipsum' },
            ];

            for (const { pattern, message } of placeholderPatterns) {
                if (pattern.test(artifact.content)) {
                    issues.push(message);
                }
            }

            // Check for TypeScript any types (warn but don't fail)
            if (artifact.language === 'typescript') {
                const anyPattern = /:\s*any\b/g;
                if (anyPattern.test(artifact.content)) {
                    issues.push('Contains `any` type (should be avoided)');
                }
            }

            artifact.validated = issues.length === 0;
            artifact.validationErrors = issues.length > 0 ? issues : undefined;

            if (!artifact.validated) {
                this.log(`Validation issues in ${artifact.path}: ${issues.join(', ')}`);
            }
        }
    }

    /**
     * Map string type to Artifact type
     */
    private mapArtifactType(type: string): Artifact['type'] {
        const typeMap: Record<string, Artifact['type']> = {
            file: 'file',
            config: 'config',
            schema: 'schema',
            migration: 'migration',
            test: 'test',
            documentation: 'documentation',
            doc: 'documentation',
        };
        return typeMap[type.toLowerCase()] || 'file';
    }

    /**
     * Check if worker is busy
     */
    isBusy(): boolean {
        return this.busy;
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
     * Log a message
     */
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.type.toUpperCase()}] ${message}`);
        this.emit('log', { agent: this.type, message, timestamp });
    }
}

