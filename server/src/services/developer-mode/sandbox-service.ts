/**
 * Sandbox Service - Developer Mode Preview Environments
 *
 * Manages isolated sandbox environments for agent previews:
 * - Creates temporary dev servers for each agent
 * - Manages port allocation
 * - Handles hot module replacement
 * - Provides live preview URLs
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as net from 'net';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

// =============================================================================
// TYPES
// =============================================================================

export interface SandboxConfig {
    basePort: number;
    maxSandboxes: number;
    projectPath: string;
    framework: 'vite' | 'next' | 'create-react-app' | 'unknown';
}

export interface SandboxInstance {
    id: string;
    agentId: string;
    worktreePath: string;
    port: number;
    url: string;
    status: 'starting' | 'running' | 'error' | 'stopped';
    process?: ChildProcess;
    startedAt?: string;
    errorMessage?: string;
}

export interface SandboxStatus {
    id: string;
    agentId: string;
    port: number;
    url: string;
    status: SandboxInstance['status'];
    uptime?: number;
    lastActivity?: string;
}

// =============================================================================
// SANDBOX SERVICE
// =============================================================================

export class SandboxService extends EventEmitter {
    private config: SandboxConfig;
    private sandboxes: Map<string, SandboxInstance> = new Map();
    private usedPorts: Set<number> = new Set();

    constructor(config: SandboxConfig) {
        super();
        this.config = config;
    }

    /**
     * Initialize the sandbox service
     */
    async initialize(): Promise<void> {
        // Clean up any orphaned sandboxes from previous runs
        await this.cleanupOrphanedProcesses();
        console.log('[SandboxService] Initialized');
    }

    /**
     * Create a sandbox for an agent
     */
    async createSandbox(
        agentId: string,
        worktreePath: string
    ): Promise<SandboxInstance> {
        // Check if sandbox already exists for this agent
        const existing = this.findSandboxByAgent(agentId);
        if (existing) {
            return existing;
        }

        // Check max sandboxes limit
        if (this.sandboxes.size >= this.config.maxSandboxes) {
            throw new Error(`Maximum sandbox limit (${this.config.maxSandboxes}) reached`);
        }

        // Allocate a port
        const port = await this.allocatePort();

        const sandbox: SandboxInstance = {
            id: `sandbox-${agentId}-${Date.now()}`,
            agentId,
            worktreePath,
            port,
            url: `http://localhost:${port}`,
            status: 'starting',
        };

        this.sandboxes.set(sandbox.id, sandbox);
        this.emit('sandboxCreated', { sandboxId: sandbox.id, agentId, port });

        // Start the dev server
        try {
            await this.startDevServer(sandbox);
            sandbox.status = 'running';
            sandbox.startedAt = new Date().toISOString();
            this.emit('sandboxStarted', { sandboxId: sandbox.id, url: sandbox.url });
        } catch (error: any) {
            sandbox.status = 'error';
            sandbox.errorMessage = error.message;
            this.emit('sandboxError', { sandboxId: sandbox.id, error: error.message });
        }

        return sandbox;
    }

    /**
     * Get sandbox for an agent
     */
    getSandbox(agentId: string): SandboxInstance | null {
        return this.findSandboxByAgent(agentId);
    }

    /**
     * Get sandbox status
     */
    getSandboxStatus(sandboxId: string): SandboxStatus | null {
        const sandbox = this.sandboxes.get(sandboxId);
        if (!sandbox) return null;

        return {
            id: sandbox.id,
            agentId: sandbox.agentId,
            port: sandbox.port,
            url: sandbox.url,
            status: sandbox.status,
            uptime: sandbox.startedAt
                ? Date.now() - new Date(sandbox.startedAt).getTime()
                : undefined,
            lastActivity: sandbox.startedAt,
        };
    }

    /**
     * Restart sandbox
     */
    async restartSandbox(agentId: string): Promise<void> {
        const sandbox = this.findSandboxByAgent(agentId);
        if (!sandbox) {
            throw new Error(`No sandbox found for agent ${agentId}`);
        }

        // Stop existing process
        await this.stopDevServer(sandbox);

        // Restart
        sandbox.status = 'starting';
        this.emit('sandboxRestarting', { sandboxId: sandbox.id });

        try {
            await this.startDevServer(sandbox);
            sandbox.status = 'running';
            sandbox.startedAt = new Date().toISOString();
            this.emit('sandboxRestarted', { sandboxId: sandbox.id, url: sandbox.url });
        } catch (error: any) {
            sandbox.status = 'error';
            sandbox.errorMessage = error.message;
            this.emit('sandboxError', { sandboxId: sandbox.id, error: error.message });
        }
    }

    /**
     * Stop and remove sandbox
     */
    async removeSandbox(agentId: string): Promise<void> {
        const sandbox = this.findSandboxByAgent(agentId);
        if (!sandbox) return;

        await this.stopDevServer(sandbox);
        this.usedPorts.delete(sandbox.port);
        this.sandboxes.delete(sandbox.id);

        this.emit('sandboxRemoved', { sandboxId: sandbox.id, agentId });
        console.log(`[SandboxService] Removed sandbox for agent ${agentId}`);
    }

    /**
     * Get all active sandboxes
     */
    getAllSandboxes(): SandboxStatus[] {
        return Array.from(this.sandboxes.values()).map(sandbox => ({
            id: sandbox.id,
            agentId: sandbox.agentId,
            port: sandbox.port,
            url: sandbox.url,
            status: sandbox.status,
            uptime: sandbox.startedAt
                ? Date.now() - new Date(sandbox.startedAt).getTime()
                : undefined,
            lastActivity: sandbox.startedAt,
        }));
    }

    /**
     * Cleanup all sandboxes
     */
    async cleanup(): Promise<void> {
        console.log('[SandboxService] Cleaning up all sandboxes...');

        const promises = Array.from(this.sandboxes.values()).map(async (sandbox) => {
            await this.stopDevServer(sandbox);
        });

        await Promise.all(promises);

        this.sandboxes.clear();
        this.usedPorts.clear();

        console.log('[SandboxService] Cleanup complete');
    }

    /**
     * Trigger HMR update
     */
    async triggerHMRUpdate(agentId: string, filePath: string): Promise<void> {
        const sandbox = this.findSandboxByAgent(agentId);
        if (!sandbox || sandbox.status !== 'running') return;

        // For Vite, touching the file triggers HMR
        // For other frameworks, we might need different approaches
        try {
            const fullPath = path.join(sandbox.worktreePath, filePath);
            await fs.utimes(fullPath, new Date(), new Date());
            this.emit('hmrTriggered', { sandboxId: sandbox.id, filePath });
        } catch (error: any) {
            console.error(`[SandboxService] HMR trigger failed: ${error.message}`);
        }
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    private findSandboxByAgent(agentId: string): SandboxInstance | null {
        for (const sandbox of this.sandboxes.values()) {
            if (sandbox.agentId === agentId) {
                return sandbox;
            }
        }
        return null;
    }

    private async allocatePort(): Promise<number> {
        for (let port = this.config.basePort; port < this.config.basePort + 100; port++) {
            if (!this.usedPorts.has(port) && await this.isPortAvailable(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }
        throw new Error('No available ports for sandbox');
    }

    private async isPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.unref();
            server.on('error', () => resolve(false));
            server.listen(port, () => {
                server.close(() => resolve(true));
            });
        });
    }

    private async startDevServer(sandbox: SandboxInstance): Promise<void> {
        const { worktreePath, port } = sandbox;

        // Detect framework and build command
        const { command, args } = await this.getDevCommand(worktreePath, port);

        console.log(`[SandboxService] Starting dev server: ${command} ${args.join(' ')}`);

        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                cwd: worktreePath,
                env: { ...global.process.env, PORT: String(port) },
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true,
            });

            sandbox.process = process;

            let started = false;
            const timeout = setTimeout(() => {
                if (!started) {
                    reject(new Error('Dev server startup timeout'));
                }
            }, 60000); // 60 second timeout

            process.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log(`[Sandbox:${sandbox.id}] ${output}`);

                // Detect server ready (varies by framework)
                if (
                    output.includes('Local:') ||
                    output.includes('localhost:') ||
                    output.includes('ready') ||
                    output.includes('compiled')
                ) {
                    if (!started) {
                        started = true;
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            });

            process.stderr?.on('data', (data: Buffer) => {
                const output = data.toString();
                console.error(`[Sandbox:${sandbox.id}:err] ${output}`);
            });

            process.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            process.on('exit', (code) => {
                if (!started) {
                    clearTimeout(timeout);
                    reject(new Error(`Dev server exited with code ${code}`));
                } else {
                    sandbox.status = 'stopped';
                    this.emit('sandboxStopped', { sandboxId: sandbox.id });
                }
            });
        });
    }

    private async stopDevServer(sandbox: SandboxInstance): Promise<void> {
        if (sandbox.process) {
            sandbox.process.kill('SIGTERM');

            // Wait for graceful shutdown
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    sandbox.process?.kill('SIGKILL');
                    resolve();
                }, 5000);

                sandbox.process?.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            sandbox.process = undefined;
        }
        sandbox.status = 'stopped';
    }

    private async getDevCommand(
        projectPath: string,
        port: number
    ): Promise<{ command: string; args: string[] }> {
        // Check for package.json to determine framework
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            const scripts = packageJson.scripts || {};
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            // Vite
            if (deps.vite) {
                return {
                    command: 'npx',
                    args: ['vite', '--port', String(port), '--host'],
                };
            }

            // Next.js
            if (deps.next) {
                return {
                    command: 'npx',
                    args: ['next', 'dev', '-p', String(port)],
                };
            }

            // Create React App
            if (scripts.start?.includes('react-scripts')) {
                return {
                    command: 'npm',
                    args: ['start'],
                };
            }

            // Default to npm run dev
            if (scripts.dev) {
                return {
                    command: 'npm',
                    args: ['run', 'dev', '--', '--port', String(port)],
                };
            }

            // Fallback
            return {
                command: 'npx',
                args: ['vite', '--port', String(port)],
            };
        } catch {
            // No package.json, assume vite
            return {
                command: 'npx',
                args: ['vite', '--port', String(port)],
            };
        }
    }

    private async cleanupOrphanedProcesses(): Promise<void> {
        // Clean up any processes from previous runs that might still be holding ports
        // This is a best-effort cleanup
        try {
            for (let port = this.config.basePort; port < this.config.basePort + 20; port++) {
                if (!await this.isPortAvailable(port)) {
                    console.log(`[SandboxService] Port ${port} in use, attempting cleanup...`);
                    // On Unix systems, we could try to kill the process
                    // For now, we'll just skip these ports
                }
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Create a SandboxService instance
 */
export function createSandboxService(config: SandboxConfig): SandboxService {
    return new SandboxService(config);
}

