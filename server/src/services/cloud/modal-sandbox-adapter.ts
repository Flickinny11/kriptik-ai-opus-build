/**
 * Modal Sandbox Adapter
 *
 * Adapts ModalSandboxService to match the SandboxService interface.
 * This allows BuildLoopOrchestrator to use Modal sandboxes without changes.
 *
 * Key Adaptations:
 * - Maps agentId ↔ sandboxId
 * - Converts worktreePath → repo clone + file sync
 * - Maps localhost ports → Modal tunnel URLs
 * - Implements HMR via exec file touching
 * - Maintains same EventEmitter interface
 */

import { EventEmitter } from 'events';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ModalSandboxService,
  ModalSandboxCredentials,
  ModalSandbox,
  ModalSandboxConfig,
} from './modal-sandbox.js';

const exec = promisify(execCallback);

// =============================================================================
// TYPES (matching SandboxService interface)
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
  process?: never; // Modal sandboxes don't have local processes
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
// MODAL SANDBOX ADAPTER
// =============================================================================

export class ModalSandboxAdapter extends EventEmitter {
  private config: SandboxConfig;
  private modalService: ModalSandboxService;
  private sandboxes: Map<string, SandboxInstance> = new Map();
  private agentToSandboxId: Map<string, string> = new Map();
  private sandboxIdToModalId: Map<string, string> = new Map();
  private portCounter: number;

  constructor(config: SandboxConfig, modalCredentials: ModalSandboxCredentials) {
    super();
    this.config = config;
    this.modalService = new ModalSandboxService(modalCredentials);
    this.portCounter = config.basePort;

    // Forward Modal events as sandbox events
    this.setupEventForwarding();
  }

  /**
   * Initialize the sandbox service
   */
  async initialize(): Promise<void> {
    console.log('[ModalSandboxAdapter] Initialized');
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

    // Allocate a virtual port (for interface compatibility)
    const port = this.portCounter++;

    const sandboxId = `sandbox-${agentId}-${Date.now()}`;

    const sandbox: SandboxInstance = {
      id: sandboxId,
      agentId,
      worktreePath,
      port,
      url: '', // Will be set after Modal sandbox is ready
      status: 'starting',
    };

    this.sandboxes.set(sandboxId, sandbox);
    this.agentToSandboxId.set(agentId, sandboxId);
    this.emit('sandboxCreated', { sandboxId, agentId, port });

    // Create and start Modal sandbox
    try {
      await this.startModalSandbox(sandbox);
      sandbox.status = 'running';
      sandbox.startedAt = new Date().toISOString();
      this.emit('sandboxStarted', { sandboxId, url: sandbox.url });
    } catch (error: any) {
      sandbox.status = 'error';
      sandbox.errorMessage = error.message;
      this.emit('sandboxError', { sandboxId, error: error.message });
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

    this.emit('sandboxRestarting', { sandboxId: sandbox.id });

    // Terminate existing Modal sandbox
    const modalId = this.sandboxIdToModalId.get(sandbox.id);
    if (modalId) {
      try {
        await this.modalService.terminate(modalId);
      } catch (error) {
        console.error(`[ModalSandboxAdapter] Error terminating sandbox: ${error}`);
      }
      this.sandboxIdToModalId.delete(sandbox.id);
    }

    // Restart
    sandbox.status = 'starting';

    try {
      await this.startModalSandbox(sandbox);
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

    // Terminate Modal sandbox
    const modalId = this.sandboxIdToModalId.get(sandbox.id);
    if (modalId) {
      try {
        await this.modalService.terminate(modalId);
      } catch (error) {
        console.error(`[ModalSandboxAdapter] Error terminating sandbox: ${error}`);
      }
      this.sandboxIdToModalId.delete(modalId);
    }

    this.sandboxes.delete(sandbox.id);
    this.agentToSandboxId.delete(agentId);

    this.emit('sandboxRemoved', { sandboxId: sandbox.id, agentId });
    console.log(`[ModalSandboxAdapter] Removed sandbox for agent ${agentId}`);
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
    console.log('[ModalSandboxAdapter] Cleaning up all sandboxes...');

    await this.modalService.terminateAll();

    this.sandboxes.clear();
    this.agentToSandboxId.clear();
    this.sandboxIdToModalId.clear();

    console.log('[ModalSandboxAdapter] Cleanup complete');
  }

  /**
   * Trigger HMR update
   */
  async triggerHMRUpdate(agentId: string, filePath: string): Promise<void> {
    const sandbox = this.findSandboxByAgent(agentId);
    if (!sandbox || sandbox.status !== 'running') return;

    const modalId = this.sandboxIdToModalId.get(sandbox.id);
    if (!modalId) return;

    try {
      // Touch the file to trigger HMR
      const fullPath = path.join('/workspace', filePath);
      await this.modalService.exec(modalId, ['touch', fullPath], { timeout: 10 });
      this.emit('hmrTriggered', { sandboxId: sandbox.id, filePath });
    } catch (error: any) {
      console.error(`[ModalSandboxAdapter] HMR trigger failed: ${error.message}`);
    }
  }

  /**
   * Trigger HMR for multiple files after merge
   */
  async triggerMergeHMR(agentId: string, changedFiles: string[]): Promise<{
    success: boolean;
    frontendFilesUpdated: number;
    backendFilesChanged: boolean;
    needsRestart: boolean;
  }> {
    const sandbox = this.findSandboxByAgent(agentId);
    if (!sandbox || sandbox.status !== 'running') {
      return {
        success: false,
        frontendFilesUpdated: 0,
        backendFilesChanged: false,
        needsRestart: false,
      };
    }

    const modalId = this.sandboxIdToModalId.get(sandbox.id);
    if (!modalId) {
      return {
        success: false,
        frontendFilesUpdated: 0,
        backendFilesChanged: false,
        needsRestart: false,
      };
    }

    let frontendFilesUpdated = 0;
    let backendFilesChanged = false;

    // Categorize files
    const frontendExtensions = ['.tsx', '.jsx', '.ts', '.js', '.css', '.scss', '.vue', '.svelte'];
    const backendPaths = ['server/', 'api/', 'backend/'];

    for (const file of changedFiles) {
      // Check if it's a backend file
      const isBackend = backendPaths.some(p => file.startsWith(p));
      if (isBackend) {
        backendFilesChanged = true;
        continue;
      }

      // Check if it's a frontend file
      const isFrontend = frontendExtensions.some(ext => file.endsWith(ext));
      if (isFrontend) {
        try {
          const fullPath = path.join('/workspace', file);
          await this.modalService.exec(modalId, ['touch', fullPath], { timeout: 10 });
          frontendFilesUpdated++;
          this.emit('hmrTriggered', { sandboxId: sandbox.id, filePath: file });
        } catch (error: any) {
          console.error(`[ModalSandboxAdapter] HMR trigger failed for ${file}: ${error.message}`);
        }
      }
    }

    // If backend files changed, sandbox needs restart
    const needsRestart = backendFilesChanged;

    if (needsRestart) {
      console.log(`[ModalSandboxAdapter] Backend files changed, restart recommended for sandbox ${sandbox.id}`);
      this.emit('hmrBackendChanged', {
        sandboxId: sandbox.id,
        agentId,
        needsRestart: true,
        backendFiles: changedFiles.filter(f => backendPaths.some(p => f.startsWith(p))),
      });
    }

    this.emit('hmrMergeComplete', {
      sandboxId: sandbox.id,
      agentId,
      frontendFilesUpdated,
      backendFilesChanged,
      needsRestart,
      totalFiles: changedFiles.length,
    });

    return {
      success: true,
      frontendFilesUpdated,
      backendFilesChanged,
      needsRestart,
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private findSandboxByAgent(agentId: string): SandboxInstance | null {
    const sandboxId = this.agentToSandboxId.get(agentId);
    if (!sandboxId) return null;
    return this.sandboxes.get(sandboxId) || null;
  }

  /**
   * Start Modal sandbox with full workflow
   */
  private async startModalSandbox(sandbox: SandboxInstance): Promise<void> {
    // Step 1: Get git repository info from worktree
    const { repoUrl, commitHash } = await this.getWorktreeGitInfo(sandbox.worktreePath);

    // Step 2: Create Modal sandbox with encrypted ports for dev server
    const modalConfig: ModalSandboxConfig = {
      timeout: 7200, // 2 hours
      memory: 4096,
      cpu: 2,
      encrypted_ports: [5173, 3000, 8080, 4173], // Common dev server ports
      workdir: '/workspace',
      env: {
        NODE_ENV: 'development',
        PORT: '5173',
      },
    };

    const modalSandbox: ModalSandbox = await this.modalService.createSandbox(modalConfig);
    this.sandboxIdToModalId.set(sandbox.id, modalSandbox.id);

    // Step 3: Clone repository at specific commit
    await this.modalService.cloneRepo(modalSandbox.id, repoUrl, { depth: 1 });

    // Step 4: Checkout specific commit if not on HEAD
    if (commitHash) {
      await this.modalService.exec(modalSandbox.id, ['git', 'checkout', commitHash], { timeout: 60 });
    }

    // Step 5: Sync any uncommitted changes from worktree
    await this.syncWorktreeChanges(modalSandbox.id, sandbox.worktreePath);

    // Step 6: Install dependencies
    const packageManager = await this.detectPackageManager(sandbox.worktreePath);
    await this.modalService.installDeps(modalSandbox.id, packageManager);

    // Step 7: Start dev server and get tunnel URL
    const devCommand = await this.getDevCommand(sandbox.worktreePath, packageManager);
    const tunnel = await this.modalService.startDevServer(
      modalSandbox.id,
      devCommand,
      5173
    );

    // Update sandbox with tunnel URL
    sandbox.url = tunnel.url;

    console.log(`[ModalSandboxAdapter] Sandbox ${sandbox.id} ready at ${tunnel.url}`);
  }

  /**
   * Get git repository URL and current commit from worktree
   */
  private async getWorktreeGitInfo(worktreePath: string): Promise<{
    repoUrl: string;
    commitHash: string;
  }> {
    try {
      // Get remote URL
      const { stdout: remoteUrl } = await exec(
        `git -C "${worktreePath}" remote get-url origin`
      );

      // Get current commit hash
      const { stdout: commitHash } = await exec(
        `git -C "${worktreePath}" rev-parse HEAD`
      );

      return {
        repoUrl: remoteUrl.trim(),
        commitHash: commitHash.trim(),
      };
    } catch (error) {
      throw new Error(`Failed to get git info from worktree: ${error}`);
    }
  }

  /**
   * Sync uncommitted changes from worktree to Modal sandbox
   */
  private async syncWorktreeChanges(modalId: string, worktreePath: string): Promise<void> {
    try {
      // Get list of modified and untracked files
      const { stdout: statusOutput } = await exec(
        `git -C "${worktreePath}" status --porcelain`
      );

      if (!statusOutput.trim()) {
        // No changes to sync
        return;
      }

      // Create a patch of all changes (staged and unstaged)
      const { stdout: diffOutput } = await exec(
        `git -C "${worktreePath}" diff HEAD`
      );

      if (!diffOutput.trim()) {
        return;
      }

      // Write patch to temp file
      const patchPath = path.join('/tmp', `patch-${Date.now()}.patch`);
      await fs.writeFile(patchPath, diffOutput);

      // Read patch content to send to Modal
      const patchContent = await fs.readFile(patchPath, 'utf-8');

      // Apply patch in Modal sandbox via exec
      // First, create the patch file in Modal
      await this.modalService.exec(
        modalId,
        ['sh', '-c', `cat > /tmp/changes.patch << 'PATCH_EOF'\n${patchContent}\nPATCH_EOF`],
        { timeout: 30 }
      );

      // Apply the patch
      await this.modalService.exec(
        modalId,
        ['git', 'apply', '--whitespace=nowarn', '/tmp/changes.patch'],
        { timeout: 30 }
      );

      // Clean up local patch file
      await fs.unlink(patchPath);

      console.log(`[ModalSandboxAdapter] Synced uncommitted changes to Modal sandbox`);
    } catch (error) {
      console.warn(`[ModalSandboxAdapter] Could not sync worktree changes: ${error}`);
      // Non-fatal - continue with committed code
    }
  }

  /**
   * Detect package manager from worktree
   */
  private async detectPackageManager(
    worktreePath: string
  ): Promise<'npm' | 'pnpm' | 'yarn'> {
    try {
      // Check for lock files
      const files = await fs.readdir(worktreePath);

      if (files.includes('pnpm-lock.yaml')) {
        return 'pnpm';
      }
      if (files.includes('yarn.lock')) {
        return 'yarn';
      }
      return 'npm';
    } catch {
      return 'pnpm'; // Default
    }
  }

  /**
   * Get dev command for framework
   */
  private async getDevCommand(
    worktreePath: string,
    packageManager: 'npm' | 'pnpm' | 'yarn'
  ): Promise<string[]> {
    try {
      const packageJsonPath = path.join(worktreePath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const scripts = packageJson.scripts || {};
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Vite
      if (deps.vite) {
        return [packageManager, 'run', 'dev'];
      }

      // Next.js
      if (deps.next) {
        return [packageManager, 'run', 'dev'];
      }

      // Create React App
      if (scripts.start?.includes('react-scripts')) {
        return [packageManager, 'start'];
      }

      // Default to dev script
      if (scripts.dev) {
        return [packageManager, 'run', 'dev'];
      }

      // Fallback
      return [packageManager, 'run', 'dev'];
    } catch {
      // No package.json, assume vite
      return [packageManager, 'run', 'dev'];
    }
  }

  /**
   * Setup event forwarding from Modal service to match SandboxService events
   */
  private setupEventForwarding(): void {
    // Map Modal events to SandboxService events
    this.modalService.on('sandbox:creating', (data: { sandboxId: string }) => {
      const sandbox = this.findSandboxByModalId(data.sandboxId);
      if (sandbox) {
        this.emit('sandboxCreated', {
          sandboxId: sandbox.id,
          agentId: sandbox.agentId,
          port: sandbox.port,
        });
      }
    });

    this.modalService.on('sandbox:created', (data: { id: string }) => {
      const sandbox = this.findSandboxByModalId(data.id);
      if (sandbox) {
        this.emit('sandboxStarted', {
          sandboxId: sandbox.id,
          url: sandbox.url,
        });
      }
    });

    this.modalService.on('sandbox:error', (data: { sandboxId: string; error: string }) => {
      const sandbox = this.findSandboxByModalId(data.sandboxId);
      if (sandbox) {
        this.emit('sandboxError', {
          sandboxId: sandbox.id,
          error: data.error,
        });
      }
    });

    this.modalService.on('sandbox:terminated', (data: { sandboxId: string }) => {
      const sandbox = this.findSandboxByModalId(data.sandboxId);
      if (sandbox) {
        this.emit('sandboxStopped', {
          sandboxId: sandbox.id,
        });
      }
    });
  }

  /**
   * Find sandbox by Modal sandbox ID
   */
  private findSandboxByModalId(modalId: string): SandboxInstance | null {
    const entries = Array.from(this.sandboxIdToModalId.entries());
    for (const [sandboxId, modalSandboxId] of entries) {
      if (modalSandboxId === modalId) {
        return this.sandboxes.get(sandboxId) || null;
      }
    }
    return null;
  }
}

/**
 * Create a Modal-backed SandboxService adapter
 */
export function createModalSandboxAdapter(
  config: SandboxConfig,
  modalCredentials: ModalSandboxCredentials
): ModalSandboxAdapter {
  return new ModalSandboxAdapter(config, modalCredentials);
}
