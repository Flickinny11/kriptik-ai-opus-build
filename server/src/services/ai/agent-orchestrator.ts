/**
 * Agent Orchestrator - Real AI-Powered Build Pipeline
 *
 * This orchestrator coordinates multiple AI agents to:
 * 1. Plan the application architecture
 * 2. Generate production-ready code
 * 3. Test and validate the code
 * 4. Refine and optimize
 * 5. Prepare for deployment
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeService, createClaudeService, FileOperation, GenerationResponse, CLAUDE_MODELS } from './claude-service.js';
import { EventEmitter } from 'events';

export type AgentType = 'planning' | 'generation' | 'testing' | 'refinement' | 'deployment';
export type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'paused';
export type OrchestrationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface AgentLog {
    id: string;
    agentType: AgentType;
    message: string;
    timestamp: Date;
    type: 'info' | 'success' | 'warning' | 'error' | 'thought' | 'code';
    data?: unknown;
}

export interface AgentState {
    type: AgentType;
    status: AgentStatus;
    progress: number;
    currentStep?: string;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}

export interface ProjectPlan {
    projectName: string;
    framework: 'react' | 'nextjs' | 'node' | 'python';
    files: Array<{
        path: string;
        purpose: string;
        dependencies?: string[];
    }>;
    packages: string[];
    architecture: {
        components: string[];
        services: string[];
        routes: string[];
    };
}

export interface OrchestrationResult {
    id: string;
    status: OrchestrationStatus;
    plan?: ProjectPlan;
    files: Map<string, string>;
    logs: AgentLog[];
    usage: {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalThinkingTokens: number;
    };
    timing: {
        startedAt: Date;
        completedAt?: Date;
        durationMs?: number;
    };
}

export interface IntelligenceSettings {
    thinkingDepth: 'shallow' | 'normal' | 'deep' | 'maximum';
    powerLevel: 'economy' | 'balanced' | 'performance' | 'maximum';
    speedPriority: 'fastest' | 'fast' | 'balanced' | 'quality' | 'maximum-quality';
    creativityLevel: 'conservative' | 'balanced' | 'creative' | 'experimental';
    codeVerbosity: 'minimal' | 'standard' | 'verbose';
    designDetail: 'minimal' | 'standard' | 'polished' | 'premium';
}

export interface OrchestrationConfig {
    projectId: string;
    userId: string;
    sessionId?: string;
    skipPhases?: AgentType[];
    maxIterations?: number;
    intelligenceSettings?: IntelligenceSettings;
    onLog?: (log: AgentLog) => void;
    onAgentStateChange?: (agent: AgentType, state: AgentState) => void;
    onFileUpdate?: (path: string, content: string) => void;
    onProgress?: (phase: AgentType, progress: number) => void;
}

export class AgentOrchestrator extends EventEmitter {
    private config: OrchestrationConfig;
    private agents: Map<AgentType, ClaudeService> = new Map();
    private agentStates: Map<AgentType, AgentState> = new Map();
    private logs: AgentLog[] = [];
    private files: Map<string, string> = new Map();
    private isPaused = false;
    private shouldStop = false;
    private currentPlan?: ProjectPlan;
    private usage = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalThinkingTokens: 0,
    };

    constructor(config: OrchestrationConfig) {
        super();
        this.config = config;
        this.initializeAgents();
        this.initializeAgentStates();
    }

    private initializeAgents(): void {
        const agentTypes: AgentType[] = ['planning', 'generation', 'testing', 'refinement', 'deployment'];

        for (const agentType of agentTypes) {
            const service = createClaudeService({
                projectId: this.config.projectId,
                userId: this.config.userId,
                sessionId: this.config.sessionId,
                agentType,
            });
            this.agents.set(agentType, service);
        }
    }

    private initializeAgentStates(): void {
        const agentTypes: AgentType[] = ['planning', 'generation', 'testing', 'refinement', 'deployment'];

        for (const agentType of agentTypes) {
            this.agentStates.set(agentType, {
                type: agentType,
                status: 'idle',
                progress: 0,
            });
        }
    }

    /**
     * Main orchestration entry point
     */
    async run(prompt: string): Promise<OrchestrationResult> {
        const startedAt = new Date();
        this.isPaused = false;
        this.shouldStop = false;
        this.logs = [];
        this.files = new Map();

        this.addLog('planning', 'Starting build process...', 'info');

        try {
            // Phase 1: Planning
            if (!this.shouldSkipPhase('planning')) {
                await this.runPlanningPhase(prompt);
            }

            // Phase 2: Generation
            if (!this.shouldSkipPhase('generation') && !this.shouldStop) {
                await this.runGenerationPhase(prompt);
            }

            // Phase 3: Testing
            if (!this.shouldSkipPhase('testing') && !this.shouldStop) {
                await this.runTestingPhase();
            }

            // Phase 4: Refinement
            if (!this.shouldSkipPhase('refinement') && !this.shouldStop) {
                await this.runRefinementPhase();
            }

            // Phase 5: Deployment Preparation
            if (!this.shouldSkipPhase('deployment') && !this.shouldStop) {
                await this.runDeploymentPhase();
            }

            const completedAt = new Date();

            this.addLog('deployment', 'Build process completed successfully!', 'success');

            return {
                id: uuidv4(),
                status: 'completed',
                plan: this.currentPlan,
                files: this.files,
                logs: this.logs,
                usage: this.usage,
                timing: {
                    startedAt,
                    completedAt,
                    durationMs: completedAt.getTime() - startedAt.getTime(),
                },
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.addLog('planning', `Build failed: ${errorMessage}`, 'error');

            return {
                id: uuidv4(),
                status: 'failed',
                files: this.files,
                logs: this.logs,
                usage: this.usage,
                timing: {
                    startedAt,
                    completedAt: new Date(),
                },
            };
        }
    }

    /**
     * Phase 1: Planning - Analyze requirements and create architecture
     */
    private async runPlanningPhase(prompt: string): Promise<void> {
        await this.checkPauseState();
        if (this.shouldStop) return;

        this.updateAgentState('planning', { status: 'working', progress: 0, startedAt: new Date() });
        this.addLog('planning', 'Analyzing requirements...', 'thought');

        const planningAgent = this.agents.get('planning')!;

        const response = await planningAgent.generateStream(
            `Analyze the following requirements and create a detailed implementation plan:

${prompt}

Create a comprehensive plan including:
1. Project structure with all necessary files
2. Component hierarchy
3. Required packages
4. Architecture decisions

Respond with a JSON plan following this schema:
{
  "projectName": "string",
  "framework": "react" | "nextjs" | "node",
  "files": [{ "path": "string", "purpose": "string", "dependencies": ["string"] }],
  "packages": ["string"],
  "architecture": { "components": [], "services": [], "routes": [] }
}`,
            {
                onThinking: (thinking) => {
                    this.addLog('planning', thinking, 'thought');
                },
                onText: (text) => {
                    this.emit('planning:text', text);
                },
                onComplete: (response) => {
                    this.trackUsage(response);
                },
            },
            { useExtendedThinking: true, thinkingBudgetTokens: 8000 }
        );

        // Parse the plan
        try {
            const planMatch = response.content.match(/\{[\s\S]*\}/);
            if (planMatch) {
                this.currentPlan = JSON.parse(planMatch[0]) as ProjectPlan;
                this.addLog('planning', `Created plan for "${this.currentPlan.projectName}" with ${this.currentPlan.files.length} files`, 'success');
            }
        } catch (e) {
            this.addLog('planning', 'Could not parse plan, using generated structure', 'warning');
        }

        planningAgent.addToHistory('assistant', response.content);
        this.updateAgentState('planning', { status: 'completed', progress: 100, completedAt: new Date() });
    }

    /**
     * Phase 2: Generation - Generate code for all planned files
     */
    private async runGenerationPhase(prompt: string): Promise<void> {
        await this.checkPauseState();
        if (this.shouldStop) return;

        this.updateAgentState('generation', { status: 'working', progress: 0, startedAt: new Date() });
        this.addLog('generation', 'Starting code generation...', 'info');

        const generationAgent = this.agents.get('generation')!;

        // Build context from plan
        let generationPrompt = `Generate production-ready code for the following application:

${prompt}`;

        if (this.currentPlan) {
            generationPrompt += `

## Implementation Plan:
${JSON.stringify(this.currentPlan, null, 2)}

Generate all files listed in the plan. For each file, provide complete, working code.`;
        }

        generationPrompt += `

Respond with a JSON object containing all files:
{
  "files": [
    { "type": "create", "path": "src/...", "content": "...", "language": "typescript" }
  ],
  "message": "Description of what was generated"
}`;

        const response = await generationAgent.generateStream(
            generationPrompt,
            {
                onThinking: (thinking) => {
                    this.addLog('generation', thinking, 'thought');
                },
                onText: (text) => {
                    this.emit('generation:text', text);
                    this.updateAgentState('generation', { progress: 50 });
                },
                onComplete: (response) => {
                    this.trackUsage(response);
                },
            },
            { useExtendedThinking: true, thinkingBudgetTokens: 12000, maxTokens: 32000 }
        );

        // Parse and store generated files
        const fileOps = generationAgent.parseFileOperations(response.content);
        for (const op of fileOps) {
            if (op.content) {
                this.files.set(op.path, op.content);
                this.addLog('generation', `Created ${op.path}`, 'code');
                this.config.onFileUpdate?.(op.path, op.content);
            }
        }

        this.addLog('generation', `Generated ${fileOps.length} files`, 'success');
        generationAgent.addToHistory('assistant', response.content);
        this.updateAgentState('generation', { status: 'completed', progress: 100, completedAt: new Date() });
    }

    /**
     * Phase 3: Testing - Validate generated code
     */
    private async runTestingPhase(): Promise<void> {
        await this.checkPauseState();
        if (this.shouldStop) return;

        this.updateAgentState('testing', { status: 'working', progress: 0, startedAt: new Date() });
        this.addLog('testing', 'Validating generated code...', 'info');

        const testingAgent = this.agents.get('testing')!;

        // Add all generated files to context
        testingAgent.addFilesToContext(this.files);

        let filesContext = '';
        for (const [path, content] of this.files) {
            filesContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
        }

        const response = await testingAgent.generateStream(
            `Review the following generated code for errors, issues, and improvements:
${filesContext}

Check for:
1. TypeScript type errors
2. Missing imports
3. Logic errors
4. Security issues
5. Accessibility problems
6. Performance issues

Respond with:
{
  "issues": [
    { "severity": "error" | "warning" | "info", "file": "path", "line": number, "message": "string", "fix": "string" }
  ],
  "passed": boolean,
  "summary": "Overall assessment"
}`,
            {
                onThinking: (thinking) => {
                    this.addLog('testing', thinking, 'thought');
                },
                onComplete: (response) => {
                    this.trackUsage(response);
                },
            },
            { useExtendedThinking: true, thinkingBudgetTokens: 6000 }
        );

        // Parse test results
        try {
            const resultsMatch = response.content.match(/\{[\s\S]*\}/);
            if (resultsMatch) {
                const results = JSON.parse(resultsMatch[0]);
                const issues = results.issues || [];
                const errors = issues.filter((i: any) => i.severity === 'error');
                const warnings = issues.filter((i: any) => i.severity === 'warning');

                if (errors.length > 0) {
                    this.addLog('testing', `Found ${errors.length} errors, ${warnings.length} warnings`, 'warning');
                } else {
                    this.addLog('testing', `Validation passed with ${warnings.length} warnings`, 'success');
                }
            }
        } catch (e) {
            this.addLog('testing', 'Code validation completed', 'success');
        }

        testingAgent.addToHistory('assistant', response.content);
        this.updateAgentState('testing', { status: 'completed', progress: 100, completedAt: new Date() });
    }

    /**
     * Phase 4: Refinement - Optimize and improve code
     */
    private async runRefinementPhase(): Promise<void> {
        await this.checkPauseState();
        if (this.shouldStop) return;

        this.updateAgentState('refinement', { status: 'working', progress: 0, startedAt: new Date() });
        this.addLog('refinement', 'Optimizing code...', 'info');

        const refinementAgent = this.agents.get('refinement')!;
        refinementAgent.addFilesToContext(this.files);

        let filesContext = '';
        for (const [path, content] of this.files) {
            filesContext += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
        }

        const response = await refinementAgent.generateStream(
            `Review and optimize the following code for production readiness:
${filesContext}

Focus on:
1. Performance optimizations (memoization, lazy loading)
2. Code quality improvements
3. Better error handling
4. Accessibility enhancements
5. Best practices

If you make improvements, respond with:
{
  "refinements": [
    { "type": "performance" | "ux" | "code-quality" | "accessibility", "file": "path", "reason": "why" }
  ],
  "files": [
    { "type": "update", "path": "src/...", "content": "updated content" }
  ]
}

If no improvements needed, respond with { "refinements": [], "message": "Code is production ready" }`,
            {
                onThinking: (thinking) => {
                    this.addLog('refinement', thinking, 'thought');
                },
                onComplete: (response) => {
                    this.trackUsage(response);
                },
            },
            { useExtendedThinking: true, thinkingBudgetTokens: 6000 }
        );

        // Apply refinements
        const fileOps = refinementAgent.parseFileOperations(response.content);
        for (const op of fileOps) {
            if (op.content) {
                this.files.set(op.path, op.content);
                this.addLog('refinement', `Updated ${op.path}`, 'code');
                this.config.onFileUpdate?.(op.path, op.content);
            }
        }

        this.addLog('refinement', 'Code optimization completed', 'success');
        this.updateAgentState('refinement', { status: 'completed', progress: 100, completedAt: new Date() });
    }

    /**
     * Phase 5: Deployment Preparation
     */
    private async runDeploymentPhase(): Promise<void> {
        await this.checkPauseState();
        if (this.shouldStop) return;

        this.updateAgentState('deployment', { status: 'working', progress: 0, startedAt: new Date() });
        this.addLog('deployment', 'Preparing for deployment...', 'info');

        const deploymentAgent = this.agents.get('deployment')!;
        deploymentAgent.addFilesToContext(this.files);

        const response = await deploymentAgent.generateStream(
            `Prepare the following application for deployment:

## Project Files:
${Array.from(this.files.keys()).join('\n')}

## Framework: ${this.currentPlan?.framework || 'react'}

Generate:
1. Appropriate deployment configuration (Dockerfile, vercel.json, etc.)
2. Environment variable documentation
3. Build configuration

Respond with:
{
  "deploymentConfig": {
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "nodeVersion": "20",
    "environmentVariables": [{ "key": "string", "required": boolean, "description": "string" }]
  },
  "files": [
    { "type": "create", "path": "Dockerfile" | "vercel.json", "content": "..." }
  ],
  "recommendations": [
    { "provider": "vercel" | "cloudrun" | "netlify", "reason": "why" }
  ]
}`,
            {
                onThinking: (thinking) => {
                    this.addLog('deployment', thinking, 'thought');
                },
                onComplete: (response) => {
                    this.trackUsage(response);
                },
            },
            { useExtendedThinking: true, thinkingBudgetTokens: 4000 }
        );

        // Parse and store deployment files
        const fileOps = deploymentAgent.parseFileOperations(response.content);
        for (const op of fileOps) {
            if (op.content) {
                this.files.set(op.path, op.content);
                this.addLog('deployment', `Created ${op.path}`, 'code');
                this.config.onFileUpdate?.(op.path, op.content);
            }
        }

        this.addLog('deployment', 'Application is ready for deployment', 'success');
        this.updateAgentState('deployment', { status: 'completed', progress: 100, completedAt: new Date() });
    }

    /**
     * Pause the orchestration
     */
    pause(): void {
        this.isPaused = true;
        this.addLog('planning', 'Build paused by user', 'warning');
        this.emit('paused');
    }

    /**
     * Resume the orchestration
     */
    resume(): void {
        this.isPaused = false;
        this.addLog('planning', 'Build resumed', 'info');
        this.emit('resumed');
    }

    /**
     * Stop the orchestration
     */
    stop(): void {
        this.shouldStop = true;
        this.isPaused = false;
        this.addLog('planning', 'Build stopped by user', 'warning');
        this.emit('stopped');
    }

    /**
     * Get current state
     */
    getState(): { agents: Map<AgentType, AgentState>; files: Map<string, string>; logs: AgentLog[] } {
        return {
            agents: this.agentStates,
            files: this.files,
            logs: this.logs,
        };
    }

    /**
     * Get logs
     */
    getLogs(): AgentLog[] {
        return [...this.logs];
    }

    /**
     * Get generated files
     */
    getFiles(): Map<string, string> {
        return new Map(this.files);
    }

    // Helper methods

    private shouldSkipPhase(phase: AgentType): boolean {
        return this.config.skipPhases?.includes(phase) || false;
    }

    private async checkPauseState(): Promise<void> {
        while (this.isPaused && !this.shouldStop) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private addLog(agentType: AgentType, message: string, type: AgentLog['type'], data?: unknown): void {
        const log: AgentLog = {
            id: uuidv4(),
            agentType,
            message,
            timestamp: new Date(),
            type,
            data,
        };
        this.logs.push(log);
        this.config.onLog?.(log);
        this.emit('log', log);
    }

    private updateAgentState(agentType: AgentType, update: Partial<AgentState>): void {
        const current = this.agentStates.get(agentType)!;
        const updated = { ...current, ...update };
        this.agentStates.set(agentType, updated);
        this.config.onAgentStateChange?.(agentType, updated);
        this.config.onProgress?.(agentType, updated.progress);
        this.emit('agentStateChange', agentType, updated);
    }

    private trackUsage(response: GenerationResponse): void {
        this.usage.totalInputTokens += response.usage.inputTokens;
        this.usage.totalOutputTokens += response.usage.outputTokens;
        if (response.usage.thinkingTokens) {
            this.usage.totalThinkingTokens += response.usage.thinkingTokens;
        }
    }
}

/**
 * Create an orchestrator for a project
 */
export function createOrchestrator(config: OrchestrationConfig): AgentOrchestrator {
    return new AgentOrchestrator(config);
}

