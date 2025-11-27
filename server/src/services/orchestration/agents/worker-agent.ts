/**
 * Worker Agent
 *
 * Specialized agent that performs atomic tasks within a specific domain.
 * Each worker type has specialized prompts and output formats.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    Task,
    Artifact,
    AgentType,
    AgentId,
    SharedContext,
} from '../types.js';
import { getAgentPrompt, getContextInjectionPrompt } from '../prompts.js';
import { ClaudeService } from '../../ai/claude-service.js';

export class WorkerAgent extends EventEmitter {
    private id: AgentId;
    private type: AgentType;
    private claudeService: ClaudeService;
    private sharedContext: SharedContext;
    private systemPrompt: string;
    private busy = false;

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
    }

    /**
     * Execute a task
     */
    async execute(task: Task): Promise<Artifact[]> {
        if (this.busy) {
            throw new Error(`Worker ${this.type} is busy`);
        }

        this.busy = true;
        this.log(`Starting task: ${task.name}`);

        try {
            const artifacts = await this.generateArtifacts(task);
            await this.validateArtifacts(artifacts);
            this.log(`Completed task: ${task.name} (${artifacts.length} artifacts)`);
            return artifacts;
        } finally {
            this.busy = false;
        }
    }

    /**
     * Generate artifacts for a task
     */
    private async generateArtifacts(task: Task): Promise<Artifact[]> {
        const contextPrompt = getContextInjectionPrompt(this.sharedContext);
        const workerSpecificPrompt = this.getWorkerSpecificPrompt(task);

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

        const response = await this.claudeService.generateStructured<Array<{
            path: string;
            type: string;
            language: string;
            content: string;
        }>>(prompt, this.systemPrompt);

        return response.map(r => ({
            id: uuidv4(),
            taskId: task.id,
            type: this.mapArtifactType(r.type),
            path: r.path,
            content: r.content,
            language: r.language,
            validated: false,
        }));
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

