/**
 * Build Monitor Service
 *
 * Monitors deployment builds in real-time and provides auto-fix capabilities:
 * - Stream deployment logs from Vercel/Netlify
 * - Parse and categorize build errors
 * - Generate AI-powered fixes
 * - Detect fix loops to prevent infinite retries
 * - Track fix history for debugging
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, ClaudeService } from '../ai/claude-service.js';

export interface BuildError {
    id: string;
    type: 'typescript' | 'runtime' | 'build' | 'lint' | 'dependency' | 'env' | 'syntax' | 'import';
    message: string;
    file?: string;
    line?: number;
    column?: number;
    severity: 'error' | 'warning';
    raw: string;
    code?: string;
}

export interface Fix {
    id: string;
    errorId: string;
    type: 'code_change' | 'dependency_add' | 'env_var' | 'config_change';
    description: string;
    file?: string;
    originalCode?: string;
    fixedCode?: string;
    command?: string;
    envVar?: { key: string; value: string };
}

export interface FixAttempt {
    id: string;
    errorId: string;
    fix: Fix;
    timestamp: Date;
    successful: boolean;
    deploymentId?: string;
}

export interface BuildLog {
    timestamp: Date;
    message: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    source?: string;
}

export interface BuildResult {
    success: boolean;
    deploymentUrl?: string;
    errors: BuildError[];
    fixesApplied: Fix[];
    totalAttempts: number;
    duration: number;
}

export interface BuildMonitorConfig {
    maxRetries: number;
    maxTotalAttempts: number;
    backoffMs: number[];
    loopDetectionThreshold: number;
}

export type DeploymentProvider = 'vercel' | 'netlify';

/**
 * Build Monitor Service
 * Watches deployments and auto-fixes errors
 */
export class BuildMonitorService {
    private config: BuildMonitorConfig;
    private fixHistory: FixAttempt[] = [];
    private claudeService: ClaudeService;

    constructor(config?: Partial<BuildMonitorConfig>) {
        this.config = {
            maxRetries: config?.maxRetries ?? 3,
            maxTotalAttempts: config?.maxTotalAttempts ?? 10,
            backoffMs: config?.backoffMs ?? [2000, 5000, 10000, 20000],
            loopDetectionThreshold: config?.loopDetectionThreshold ?? 3,
        };

        this.claudeService = createClaudeService({
            projectId: 'build-monitor',
            userId: 'system',
            agentType: 'refinement',
        });
    }

    /**
     * Stream deployment logs from Vercel
     */
    async *streamVercelLogs(
        deploymentId: string,
        token: string
    ): AsyncGenerator<BuildLog> {
        const url = `https://api.vercel.com/v2/deployments/${deploymentId}/events`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to stream logs: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        try {
                            const data = JSON.parse(line.slice(5));
                            yield this.parseVercelLogEvent(data);
                        } catch {
                            // Skip malformed events
                        }
                    }
                }
            }
        } catch (error) {
            yield {
                timestamp: new Date(),
                message: `Log streaming error: ${error}`,
                level: 'error',
            };
        }
    }

    /**
     * Parse a Vercel log event
     */
    private parseVercelLogEvent(event: any): BuildLog {
        return {
            timestamp: new Date(event.created || Date.now()),
            message: event.text || event.payload?.text || JSON.stringify(event),
            level: this.determineLogLevel(event),
            source: event.type || 'vercel',
        };
    }

    /**
     * Determine log level from event
     */
    private determineLogLevel(event: any): BuildLog['level'] {
        const text = (event.text || event.payload?.text || '').toLowerCase();

        if (text.includes('error') || event.type === 'error') {
            return 'error';
        }
        if (text.includes('warning') || text.includes('warn')) {
            return 'warn';
        }
        if (text.includes('debug')) {
            return 'debug';
        }
        return 'info';
    }

    /**
     * Poll Vercel deployment status
     */
    async pollDeploymentStatus(
        deploymentId: string,
        token: string,
        interval: number = 5000,
        maxWait: number = 600000
    ): Promise<{ state: string; url?: string; error?: string }> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            try {
                const response = await fetch(
                    `https://api.vercel.com/v13/deployments/${deploymentId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();

                if (data.readyState === 'READY') {
                    return { state: 'READY', url: `https://${data.url}` };
                }

                if (data.readyState === 'ERROR') {
                    return { state: 'ERROR', error: data.errorMessage || 'Build failed' };
                }

                if (data.readyState === 'CANCELED') {
                    return { state: 'CANCELED' };
                }

                // Still building, wait and poll again
                await new Promise(resolve => setTimeout(resolve, interval));
            } catch (error) {
                return { state: 'ERROR', error: String(error) };
            }
        }

        return { state: 'TIMEOUT', error: 'Deployment timed out' };
    }

    /**
     * Get deployment build logs
     */
    async getDeploymentLogs(
        deploymentId: string,
        token: string
    ): Promise<string[]> {
        try {
            const response = await fetch(
                `https://api.vercel.com/v2/deployments/${deploymentId}/events`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const events = await response.json();
            return events.map((e: any) => e.text || e.payload?.text || '').filter(Boolean);
        } catch (error) {
            return [`Error fetching logs: ${error}`];
        }
    }

    /**
     * Parse errors from build logs
     */
    parseErrors(logs: string[]): BuildError[] {
        const errors: BuildError[] = [];
        const fullLog = logs.join('\n');

        // TypeScript errors: TS{code}: message
        const tsPattern = /(?:(.+?)\((\d+),(\d+)\): )?error TS(\d+): (.+)/g;
        let match;
        while ((match = tsPattern.exec(fullLog)) !== null) {
            errors.push({
                id: uuidv4(),
                type: 'typescript',
                file: match[1] || undefined,
                line: match[2] ? parseInt(match[2]) : undefined,
                column: match[3] ? parseInt(match[3]) : undefined,
                code: `TS${match[4]}`,
                message: match[5],
                severity: 'error',
                raw: match[0],
            });
        }

        // ESLint errors
        const eslintPattern = /(\S+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(\S+)$/gm;
        while ((match = eslintPattern.exec(fullLog)) !== null) {
            errors.push({
                id: uuidv4(),
                type: 'lint',
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                message: match[5],
                code: match[6],
                severity: match[4] === 'error' ? 'error' : 'warning',
                raw: match[0],
            });
        }

        // Module not found errors
        const modulePattern = /(?:Module not found|Cannot find module)[:\s]+['"]([^'"]+)['"]/gi;
        while ((match = modulePattern.exec(fullLog)) !== null) {
            errors.push({
                id: uuidv4(),
                type: 'dependency',
                message: `Cannot find module '${match[1]}'`,
                severity: 'error',
                raw: match[0],
            });
        }

        // Import errors
        const importPattern = /(?:SyntaxError|Error):\s*(?:Cannot|Unable to) (?:import|resolve)[^.]+/gi;
        while ((match = importPattern.exec(fullLog)) !== null) {
            errors.push({
                id: uuidv4(),
                type: 'import',
                message: match[0],
                severity: 'error',
                raw: match[0],
            });
        }

        // Environment variable errors
        const envPattern = /(?:Environment variable|process\.env).*?['"]?(\w+)['"]?\s*(?:is not defined|is undefined|missing)/gi;
        while ((match = envPattern.exec(fullLog)) !== null) {
            errors.push({
                id: uuidv4(),
                type: 'env',
                message: `Missing environment variable: ${match[1]}`,
                severity: 'error',
                raw: match[0],
            });
        }

        // Generic build errors
        const buildPattern = /(?:Build failed|Error during build|Compilation failed)[:\s]+(.+)/gi;
        while ((match = buildPattern.exec(fullLog)) !== null) {
            errors.push({
                id: uuidv4(),
                type: 'build',
                message: match[1],
                severity: 'error',
                raw: match[0],
            });
        }

        // Syntax errors
        const syntaxPattern = /SyntaxError:\s*(.+?)(?:\n|$)/gi;
        while ((match = syntaxPattern.exec(fullLog)) !== null) {
            errors.push({
                id: uuidv4(),
                type: 'syntax',
                message: match[1],
                severity: 'error',
                raw: match[0],
            });
        }

        // Deduplicate errors by message
        const seen = new Set<string>();
        return errors.filter(e => {
            const key = `${e.type}:${e.message}:${e.file}:${e.line}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Check if we're in a fix loop for an error
     */
    isInLoop(error: BuildError): boolean {
        const recentAttempts = this.fixHistory.filter(
            attempt =>
                attempt.fix.description.includes(error.message.substring(0, 50)) &&
                Date.now() - attempt.timestamp.getTime() < 3600000 // Last hour
        );

        return recentAttempts.length >= this.config.loopDetectionThreshold;
    }

    /**
     * Generate a fix for an error using AI
     */
    async generateFix(
        error: BuildError,
        projectFiles: Map<string, string>
    ): Promise<Fix> {
        const relevantFile = error.file ? projectFiles.get(error.file) : undefined;

        const prompt = `You are an expert at fixing build errors. Generate a fix for this error.

ERROR:
Type: ${error.type}
Message: ${error.message}
File: ${error.file || 'Unknown'}
Line: ${error.line || 'Unknown'}
Code: ${error.code || 'None'}

${relevantFile ? `FILE CONTENT:\n\`\`\`\n${relevantFile}\n\`\`\`` : ''}

Previous fix attempts for similar errors:
${this.fixHistory.slice(-5).map(a => `- ${a.fix.description}: ${a.successful ? 'SUCCESS' : 'FAILED'}`).join('\n') || 'None'}

Generate a fix. Respond with JSON:
{
    "type": "code_change" | "dependency_add" | "env_var" | "config_change",
    "description": "Clear description of the fix",
    "file": "file path if code change",
    "originalCode": "exact code to replace (if code_change)",
    "fixedCode": "replacement code (if code_change)",
    "command": "npm/yarn command (if dependency_add)",
    "envVar": { "key": "VAR_NAME", "value": "suggested_value" } // if env_var
}

IMPORTANT:
- For TypeScript errors, ensure type safety
- For missing modules, suggest the correct package name
- For env vars, provide reasonable placeholder values
- Do NOT suggest fixes that were already tried and failed`;

        // Error analysis and fix generation - increased for complex fixes
        const response = await this.claudeService.generate(prompt, {
            maxTokens: 16000,  // Increased from 2K - code fixes can be extensive
            useExtendedThinking: true,
            thinkingBudgetTokens: 10000,  // Increased from 5K for better reasoning
        });

        // Parse the fix from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to generate fix');
        }

        const fixData = JSON.parse(jsonMatch[0]);

        return {
            id: uuidv4(),
            errorId: error.id,
            ...fixData,
        };
    }

    /**
     * Record a fix attempt
     */
    recordAttempt(fix: Fix, successful: boolean, deploymentId?: string): void {
        this.fixHistory.push({
            id: uuidv4(),
            errorId: fix.errorId,
            fix,
            timestamp: new Date(),
            successful,
            deploymentId,
        });

        // Keep history limited
        if (this.fixHistory.length > 100) {
            this.fixHistory = this.fixHistory.slice(-50);
        }
    }

    /**
     * Get fix history
     */
    getFixHistory(): FixAttempt[] {
        return [...this.fixHistory];
    }

    /**
     * Clear fix history
     */
    clearHistory(): void {
        this.fixHistory = [];
    }

    /**
     * Monitor deployment until success or max attempts
     */
    async monitorUntilSuccess(
        deploymentId: string,
        token: string,
        projectFiles: Map<string, string>,
        onUpdate: (update: {
            type: 'log' | 'error' | 'fix' | 'status';
            data: any;
        }) => void,
        applyFix: (fix: Fix) => Promise<boolean>,
        redeploy: () => Promise<string>
    ): Promise<BuildResult> {
        const startTime = Date.now();
        let attempts = 0;
        const fixesApplied: Fix[] = [];
        let currentDeploymentId = deploymentId;

        while (attempts < this.config.maxTotalAttempts) {
            attempts++;
            onUpdate({ type: 'status', data: { attempt: attempts, deploymentId: currentDeploymentId } });

            // Poll for deployment status
            const status = await this.pollDeploymentStatus(currentDeploymentId, token);

            if (status.state === 'READY') {
                return {
                    success: true,
                    deploymentUrl: status.url,
                    errors: [],
                    fixesApplied,
                    totalAttempts: attempts,
                    duration: Date.now() - startTime,
                };
            }

            if (status.state === 'ERROR' || status.state === 'TIMEOUT') {
                // Get logs and parse errors
                const logs = await this.getDeploymentLogs(currentDeploymentId, token);
                const errors = this.parseErrors(logs);

                onUpdate({ type: 'error', data: { errors, logs: logs.slice(-20) } });

                if (errors.length === 0) {
                    // Unknown error
                    return {
                        success: false,
                        errors: [{
                            id: uuidv4(),
                            type: 'build',
                            message: status.error || 'Unknown build error',
                            severity: 'error',
                            raw: logs.join('\n'),
                        }],
                        fixesApplied,
                        totalAttempts: attempts,
                        duration: Date.now() - startTime,
                    };
                }

                // Try to fix errors
                const nonLoopingErrors = errors.filter(e => !this.isInLoop(e));

                if (nonLoopingErrors.length === 0) {
                    onUpdate({ type: 'status', data: { message: 'Fix loop detected - escalating to user' } });
                    return {
                        success: false,
                        errors,
                        fixesApplied,
                        totalAttempts: attempts,
                        duration: Date.now() - startTime,
                    };
                }

                // Generate and apply fixes
                for (const error of nonLoopingErrors.slice(0, 3)) { // Fix up to 3 errors at a time
                    try {
                        const fix = await this.generateFix(error, projectFiles);
                        onUpdate({ type: 'fix', data: { error, fix } });

                        const applied = await applyFix(fix);
                        this.recordAttempt(fix, applied, currentDeploymentId);

                        if (applied) {
                            fixesApplied.push(fix);
                        }
                    } catch (fixError) {
                        onUpdate({ type: 'log', data: { level: 'error', message: `Failed to generate fix: ${fixError}` } });
                    }
                }

                // Redeploy
                const backoffIndex = Math.min(attempts - 1, this.config.backoffMs.length - 1);
                const backoff = this.config.backoffMs[backoffIndex];

                onUpdate({ type: 'status', data: { message: `Redeploying in ${backoff / 1000}s...` } });
                await new Promise(resolve => setTimeout(resolve, backoff));

                try {
                    currentDeploymentId = await redeploy();
                    onUpdate({ type: 'status', data: { message: 'Redeployed', deploymentId: currentDeploymentId } });
                } catch (deployError) {
                    onUpdate({ type: 'log', data: { level: 'error', message: `Redeploy failed: ${deployError}` } });
                }
            }

            if (status.state === 'CANCELED') {
                return {
                    success: false,
                    errors: [{
                        id: uuidv4(),
                        type: 'build',
                        message: 'Deployment was canceled',
                        severity: 'error',
                        raw: '',
                    }],
                    fixesApplied,
                    totalAttempts: attempts,
                    duration: Date.now() - startTime,
                };
            }
        }

        return {
            success: false,
            errors: [{
                id: uuidv4(),
                type: 'build',
                message: 'Max attempts exceeded',
                severity: 'error',
                raw: '',
            }],
            fixesApplied,
            totalAttempts: attempts,
            duration: Date.now() - startTime,
        };
    }
}

/**
 * Create a new build monitor service
 */
export function createBuildMonitorService(config?: Partial<BuildMonitorConfig>): BuildMonitorService {
    return new BuildMonitorService(config);
}

