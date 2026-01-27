/**
 * Modal Shared Volume Manager
 *
 * Manages shared Modal Volumes for code base and dependencies.
 * All build sandboxes mount this volume, eliminating redundant clone/install operations.
 *
 * Benefits:
 * - Git clone runs once (not per-sandbox)
 * - npm install runs once (not per-sandbox)
 * - node_modules shared across all sandboxes
 * - ~60-90 seconds saved per build (5 sandboxes × 15-20s each)
 *
 * Architecture:
 * 1. Build starts → Create volume with unique ID
 * 2. Populate volume → Clone repo + install deps (ONCE)
 * 3. Spawn sandboxes → All mount the same volume at /code
 * 4. Build completes → Cleanup volume
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// TYPES
// =============================================================================

export interface VolumeConfig {
  volumeName: string;
  mountPath: string;
  buildId: string;
  repoUrl: string;
  branch: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
}

export interface VolumeInfo {
  volumeName: string;
  mountPath: string;
  status: 'creating' | 'populating' | 'ready' | 'error' | 'deleted';
  sizeBytes?: number;
  createdAt: string;
  populatedAt?: string;
}

export interface SandboxVolumeConfig {
  volumes: Record<string, string>; // mountPath -> volumeName
  workingDirectory: string;
}

// =============================================================================
// MODAL SHARED VOLUME MANAGER
// =============================================================================

export class ModalSharedVolumeManager extends EventEmitter {
  private volumePrefix = 'kriptik-code-base';
  private defaultMountPath = '/code';
  private activeVolumes: Map<string, VolumeInfo> = new Map();
  private pythonBridgePath: string;

  constructor() {
    super();
    this.pythonBridgePath = path.join(__dirname, 'modal-volume-bridge.py');
  }

  // ===========================================================================
  // VOLUME LIFECYCLE
  // ===========================================================================

  /**
   * Initialize a shared volume for a build.
   * This creates the volume and populates it with the code base.
   *
   * @param config - Volume configuration
   * @returns Volume info with name and mount path
   */
  async initializeVolume(config: {
    buildId: string;
    repoUrl: string;
    branch?: string;
    packageManager?: 'npm' | 'pnpm' | 'yarn';
  }): Promise<{ volumeName: string; mountPath: string }> {
    const volumeName = `${this.volumePrefix}-${config.buildId}`;
    const branch = config.branch || 'main';
    const packageManager = config.packageManager || 'pnpm';

    this.emit('volume:creating', { volumeName, buildId: config.buildId });

    const volumeInfo: VolumeInfo = {
      volumeName,
      mountPath: this.defaultMountPath,
      status: 'creating',
      createdAt: new Date().toISOString(),
    };

    this.activeVolumes.set(volumeName, volumeInfo);

    try {
      // Step 1: Create volume
      await this.createVolume(volumeName);
      volumeInfo.status = 'populating';

      // Step 2: Populate with code base
      if (config.repoUrl) {
        await this.populateVolume(volumeName, {
          repoUrl: config.repoUrl,
          branch,
          packageManager,
        });
      }

      volumeInfo.status = 'ready';
      volumeInfo.populatedAt = new Date().toISOString();

      this.emit('volume:ready', { volumeName, buildId: config.buildId });

      console.log(`[Shared Volume] Volume ${volumeName} ready at ${this.defaultMountPath}`);

      return {
        volumeName,
        mountPath: this.defaultMountPath,
      };

    } catch (error) {
      volumeInfo.status = 'error';
      this.emit('volume:error', {
        volumeName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create a Modal volume.
   */
  private async createVolume(volumeName: string): Promise<void> {
    console.log(`[Shared Volume] Creating volume: ${volumeName}`);

    await this.executePythonCommand({
      action: 'create_volume',
      volumeName,
    });
  }

  /**
   * Populate volume with repository and dependencies.
   */
  private async populateVolume(
    volumeName: string,
    config: {
      repoUrl: string;
      branch: string;
      packageManager: 'npm' | 'pnpm' | 'yarn';
    }
  ): Promise<void> {
    console.log(`[Shared Volume] Populating volume ${volumeName} with ${config.repoUrl}`);

    const startTime = Date.now();

    await this.executePythonCommand({
      action: 'populate_volume',
      volumeName,
      repoUrl: config.repoUrl,
      branch: config.branch,
      packageManager: config.packageManager,
      mountPath: this.defaultMountPath,
    });

    const duration = Date.now() - startTime;
    console.log(`[Shared Volume] Volume populated in ${duration}ms`);
  }

  /**
   * Get sandbox configuration with shared volume mounted.
   *
   * @param volumeName - Name of the volume to mount
   * @returns Configuration object for sandbox creation
   */
  getSandboxConfigWithVolume(volumeName: string): SandboxVolumeConfig {
    const volumeInfo = this.activeVolumes.get(volumeName);

    if (!volumeInfo) {
      throw new Error(`Volume ${volumeName} not found`);
    }

    if (volumeInfo.status !== 'ready') {
      throw new Error(`Volume ${volumeName} is not ready (status: ${volumeInfo.status})`);
    }

    return {
      volumes: {
        [volumeInfo.mountPath]: volumeName,
      },
      workingDirectory: volumeInfo.mountPath,
    };
  }

  /**
   * Clean up a volume after build completes.
   */
  async cleanupVolume(volumeName: string): Promise<void> {
    const volumeInfo = this.activeVolumes.get(volumeName);

    if (!volumeInfo) {
      console.warn(`[Shared Volume] Volume ${volumeName} not found for cleanup`);
      return;
    }

    this.emit('volume:deleting', { volumeName });

    try {
      await this.executePythonCommand({
        action: 'delete_volume',
        volumeName,
      });

      volumeInfo.status = 'deleted';
      this.activeVolumes.delete(volumeName);

      this.emit('volume:deleted', { volumeName });
      console.log(`[Shared Volume] Volume ${volumeName} deleted`);

    } catch (error) {
      console.error(`[Shared Volume] Failed to delete volume ${volumeName}:`, error);
      // Don't throw - volume cleanup is best-effort
    }
  }

  /**
   * Clean up all volumes for a build.
   */
  async cleanupBuildVolumes(buildId: string): Promise<void> {
    const volumesToDelete: string[] = [];

    for (const [name, info] of this.activeVolumes) {
      if (name.includes(buildId)) {
        volumesToDelete.push(name);
      }
    }

    await Promise.allSettled(
      volumesToDelete.map(name => this.cleanupVolume(name))
    );
  }

  /**
   * Clean up all active volumes (for shutdown).
   */
  async cleanupAllVolumes(): Promise<void> {
    const volumeNames = Array.from(this.activeVolumes.keys());

    await Promise.allSettled(
      volumeNames.map(name => this.cleanupVolume(name))
    );

    this.activeVolumes.clear();
  }

  // ===========================================================================
  // VOLUME OPERATIONS
  // ===========================================================================

  /**
   * Write a file to the volume.
   */
  async writeToVolume(
    volumeName: string,
    filePath: string,
    content: string
  ): Promise<void> {
    await this.executePythonCommand({
      action: 'write_file',
      volumeName,
      filePath,
      content,
    });
  }

  /**
   * Read a file from the volume.
   */
  async readFromVolume(
    volumeName: string,
    filePath: string
  ): Promise<string> {
    const result = await this.executePythonCommand({
      action: 'read_file',
      volumeName,
      filePath,
    });

    return result.content as string;
  }

  /**
   * List files in the volume.
   */
  async listVolumeFiles(
    volumeName: string,
    directory: string = '/'
  ): Promise<string[]> {
    const result = await this.executePythonCommand({
      action: 'list_files',
      volumeName,
      directory,
    });

    return result.files as string[];
  }

  /**
   * Get volume info.
   */
  getVolumeInfo(volumeName: string): VolumeInfo | undefined {
    return this.activeVolumes.get(volumeName);
  }

  /**
   * List all active volumes.
   */
  listActiveVolumes(): VolumeInfo[] {
    return Array.from(this.activeVolumes.values());
  }

  // ===========================================================================
  // PYTHON BRIDGE
  // ===========================================================================

  private async executePythonCommand(
    request: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        MODAL_TOKEN_ID: process.env.MODAL_TOKEN_ID,
        MODAL_TOKEN_SECRET: process.env.MODAL_TOKEN_SECRET,
      };

      const python = spawn('python3', [this.pythonBridgePath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('error', (error) => {
        reject(new Error(`Python bridge error: ${error.message}`));
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python bridge exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const response = JSON.parse(stdout);
          if (response.success) {
            resolve(response.data || {});
          } else {
            reject(new Error(response.error || 'Unknown error'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Python bridge response: ${stdout}`));
        }
      });

      python.stdin.write(JSON.stringify(request));
      python.stdin.end();
    });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let sharedVolumeManagerInstance: ModalSharedVolumeManager | null = null;

export function getSharedVolumeManager(): ModalSharedVolumeManager {
  if (!sharedVolumeManagerInstance) {
    sharedVolumeManagerInstance = new ModalSharedVolumeManager();
  }
  return sharedVolumeManagerInstance;
}

export function createSharedVolumeManager(): ModalSharedVolumeManager {
  return new ModalSharedVolumeManager();
}

export const sharedVolumeManager = getSharedVolumeManager();
