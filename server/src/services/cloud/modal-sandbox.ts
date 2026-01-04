/**
 * Modal Sandbox Service
 *
 * Provides cloud-hosted isolated code execution using Modal Labs sandboxes.
 *
 * This service manages ephemeral sandboxes for:
 * - Isolated code execution
 * - Repository cloning and building
 * - Development server hosting with tunneled access
 * - Test execution in isolated environments
 *
 * Uses Modal's REST API where available, and a Python bridge for advanced operations.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TYPES
// ============================================================================

export interface ModalSandboxConfig {
  image?: SandboxImageConfig;
  timeout?: number;
  memory?: number;
  cpu?: number;
  encrypted_ports?: number[];
  workdir?: string;
  env?: Record<string, string>;
  block_network?: boolean;
  cidr_allowlist?: string[];
}

export interface SandboxImageConfig {
  base: 'node20' | 'node18' | 'debian' | 'custom';
  pip_packages?: string[];
  apt_packages?: string[];
  npm_global?: string[];
  custom_commands?: string[];
}

export interface ModalSandbox {
  id: string;
  app_id: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  tunnels: Record<number, { url: string; port: number }>;
  created_at: string;
  project_path: string;
}

export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

export interface ModalSandboxCredentials {
  tokenId: string;
  tokenSecret: string;
}

interface PythonBridgeRequest {
  action: 'create' | 'exec' | 'terminate' | 'get_tunnel';
  sandboxId?: string;
  config?: ModalSandboxConfig;
  command?: string[];
  timeout?: number;
  port?: number;
}

interface PythonBridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_SANDBOX_CONFIG: Partial<ModalSandboxConfig> = {
  timeout: 3600,
  memory: 4096,
  cpu: 2,
  workdir: '/workspace',
  block_network: false,
};

const KRIPTIK_BUILD_IMAGE: SandboxImageConfig = {
  base: 'debian',
  apt_packages: [
    'curl',
    'git',
    'build-essential',
    'chromium',
    'libnss3',
    'libatk-bridge2.0-0',
    'libdrm2',
    'libxkbcommon0',
    'libxcomposite1',
    'libxdamage1',
    'libxrandr2',
    'libgbm1',
    'libasound2',
  ],
  custom_commands: [
    'curl -fsSL https://deb.nodesource.com/setup_20.x | bash -',
    'apt-get install -y nodejs',
    'npm install -g pnpm@9 playwright@1.40',
    'npx playwright install chromium',
  ],
  pip_packages: [],
  npm_global: ['pnpm'],
};

// ============================================================================
// MODAL SANDBOX SERVICE
// ============================================================================

export class ModalSandboxService extends EventEmitter {
  private tokenId: string;
  private tokenSecret: string;
  private activeSandboxes: Map<string, ModalSandbox>;
  private pythonBridgePath: string;
  private baseUrl = 'https://api.modal.com/v1';

  constructor(credentials: ModalSandboxCredentials) {
    super();
    this.tokenId = credentials.tokenId;
    this.tokenSecret = credentials.tokenSecret;
    this.activeSandboxes = new Map();
    this.pythonBridgePath = path.join(__dirname, 'modal-sandbox-bridge.py');
  }

  /**
   * Make authenticated request to Modal REST API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: 'omit', // Server-to-server API call, no browser cookies needed
      headers: {
        'Authorization': `Bearer ${this.tokenId}:${this.tokenSecret}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Modal API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Execute Python bridge command
   */
  private async executePythonBridge(request: PythonBridgeRequest): Promise<PythonBridgeResponse> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        MODAL_TOKEN_ID: this.tokenId,
        MODAL_TOKEN_SECRET: this.tokenSecret,
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
          const response: PythonBridgeResponse = JSON.parse(stdout);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse Python bridge response: ${stdout}`));
        }
      });

      python.stdin.write(JSON.stringify(request));
      python.stdin.end();
    });
  }

  // ========================================================================
  // SANDBOX LIFECYCLE
  // ========================================================================

  /**
   * Create a new sandbox instance
   */
  async createSandbox(config: ModalSandboxConfig = {}): Promise<ModalSandbox> {
    const sandboxId = uuidv4();
    const fullConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config };

    if (!fullConfig.image) {
      fullConfig.image = KRIPTIK_BUILD_IMAGE;
    }

    this.emit('sandbox:creating', { sandboxId, config: fullConfig });

    try {
      const response = await this.executePythonBridge({
        action: 'create',
        sandboxId,
        config: fullConfig,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create sandbox');
      }

      const sandbox: ModalSandbox = {
        id: sandboxId,
        app_id: response.data.app_id,
        status: 'running',
        tunnels: {},
        created_at: new Date().toISOString(),
        project_path: fullConfig.workdir || '/workspace',
      };

      this.activeSandboxes.set(sandboxId, sandbox);
      this.emit('sandbox:created', sandbox);

      return sandbox;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sandbox:error', { sandboxId, error: errorMessage });
      throw new Error(`Failed to create sandbox: ${errorMessage}`);
    }
  }

  /**
   * Execute command in sandbox
   */
  async exec(
    sandboxId: string,
    command: string[],
    options: { timeout?: number; env?: Record<string, string> } = {}
  ): Promise<SandboxExecResult> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    if (sandbox.status !== 'running') {
      throw new Error(`Sandbox ${sandboxId} is not running (status: ${sandbox.status})`);
    }

    this.emit('sandbox:exec', { sandboxId, command });

    const startTime = Date.now();

    try {
      const response = await this.executePythonBridge({
        action: 'exec',
        sandboxId,
        command,
        timeout: options.timeout || 300,
      });

      if (!response.success) {
        throw new Error(response.error || 'Command execution failed');
      }

      const result: SandboxExecResult = {
        stdout: response.data.stdout || '',
        stderr: response.data.stderr || '',
        exit_code: response.data.exit_code || 0,
        duration_ms: Date.now() - startTime,
      };

      this.emit('sandbox:exec:complete', { sandboxId, result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sandbox:exec:error', { sandboxId, error: errorMessage });
      throw new Error(`Command execution failed: ${errorMessage}`);
    }
  }

  /**
   * Terminate sandbox
   */
  async terminate(sandboxId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    this.emit('sandbox:terminating', { sandboxId });

    try {
      const response = await this.executePythonBridge({
        action: 'terminate',
        sandboxId,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to terminate sandbox');
      }

      sandbox.status = 'stopped';
      this.activeSandboxes.delete(sandboxId);
      this.emit('sandbox:terminated', { sandboxId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sandbox.status = 'error';
      this.emit('sandbox:error', { sandboxId, error: errorMessage });
      throw new Error(`Failed to terminate sandbox: ${errorMessage}`);
    }
  }

  // ========================================================================
  // HIGH-LEVEL OPERATIONS
  // ========================================================================

  /**
   * Clone repository into sandbox
   */
  async cloneRepo(
    sandboxId: string,
    repoUrl: string,
    options: { branch?: string; depth?: number } = {}
  ): Promise<SandboxExecResult> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    const cloneArgs = ['git', 'clone'];

    if (options.depth) {
      cloneArgs.push('--depth', options.depth.toString());
    }

    if (options.branch) {
      cloneArgs.push('-b', options.branch);
    }

    cloneArgs.push(repoUrl, sandbox.project_path);

    this.emit('sandbox:clone:start', { sandboxId, repoUrl, options });

    try {
      const result = await this.exec(sandboxId, cloneArgs, { timeout: 600 });

      if (result.exit_code !== 0) {
        throw new Error(`Git clone failed: ${result.stderr}`);
      }

      this.emit('sandbox:clone:complete', { sandboxId, repoUrl });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sandbox:clone:error', { sandboxId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Install dependencies
   */
  async installDeps(
    sandboxId: string,
    packageManager: 'npm' | 'pnpm' | 'yarn' = 'pnpm'
  ): Promise<SandboxExecResult> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    this.emit('sandbox:install:start', { sandboxId, packageManager });

    try {
      const result = await this.exec(
        sandboxId,
        [packageManager, 'install'],
        { timeout: 900 }
      );

      if (result.exit_code !== 0) {
        throw new Error(`Dependency installation failed: ${result.stderr}`);
      }

      this.emit('sandbox:install:complete', { sandboxId });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sandbox:install:error', { sandboxId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Start development server with tunnel
   */
  async startDevServer(
    sandboxId: string,
    command: string[] = ['pnpm', 'dev'],
    port: number = 5173
  ): Promise<{ url: string; port: number }> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    this.emit('sandbox:dev:start', { sandboxId, command, port });

    try {
      const execPromise = this.exec(sandboxId, command, { timeout: 7200 });

      await new Promise(resolve => setTimeout(resolve, 5000));

      const tunnelResponse = await this.executePythonBridge({
        action: 'get_tunnel',
        sandboxId,
        port,
      });

      if (!tunnelResponse.success) {
        throw new Error(tunnelResponse.error || 'Failed to get tunnel URL');
      }

      const tunnel = {
        url: tunnelResponse.data.url,
        port,
      };

      sandbox.tunnels[port] = tunnel;
      this.emit('sandbox:dev:ready', { sandboxId, tunnel });

      return tunnel;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sandbox:dev:error', { sandboxId, error: errorMessage });
      throw new Error(`Failed to start dev server: ${errorMessage}`);
    }
  }

  /**
   * Run build command
   */
  async runBuild(
    sandboxId: string,
    buildCommand: string[] = ['pnpm', 'build']
  ): Promise<SandboxExecResult> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    this.emit('sandbox:build:start', { sandboxId, buildCommand });

    try {
      const result = await this.exec(sandboxId, buildCommand, { timeout: 1800 });

      if (result.exit_code !== 0) {
        throw new Error(`Build failed: ${result.stderr}`);
      }

      this.emit('sandbox:build:complete', { sandboxId });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sandbox:build:error', { sandboxId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Run tests
   */
  async runTests(
    sandboxId: string,
    testCommand: string[] = ['pnpm', 'test']
  ): Promise<SandboxExecResult> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    this.emit('sandbox:test:start', { sandboxId, testCommand });

    try {
      const result = await this.exec(sandboxId, testCommand, { timeout: 1800 });

      this.emit('sandbox:test:complete', { sandboxId, result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('sandbox:test:error', { sandboxId, error: errorMessage });
      throw error;
    }
  }

  // ========================================================================
  // MANAGEMENT
  // ========================================================================

  /**
   * Get sandbox by ID
   */
  getSandbox(sandboxId: string): ModalSandbox | undefined {
    return this.activeSandboxes.get(sandboxId);
  }

  /**
   * List all active sandboxes
   */
  listSandboxes(): ModalSandbox[] {
    return Array.from(this.activeSandboxes.values());
  }

  /**
   * Get tunnel URL for sandbox port
   */
  getTunnelUrl(sandboxId: string, port: number): string | undefined {
    const sandbox = this.activeSandboxes.get(sandboxId);
    return sandbox?.tunnels[port]?.url;
  }

  /**
   * Terminate all active sandboxes
   */
  async terminateAll(): Promise<void> {
    const sandboxIds = Array.from(this.activeSandboxes.keys());

    await Promise.allSettled(
      sandboxIds.map(id => this.terminate(id))
    );

    this.activeSandboxes.clear();
    this.emit('sandboxes:all:terminated');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let sandboxServiceInstance: ModalSandboxService | null = null;

export function getModalSandboxService(credentials?: ModalSandboxCredentials): ModalSandboxService {
  if (!sandboxServiceInstance && credentials) {
    sandboxServiceInstance = new ModalSandboxService(credentials);
  }
  if (!sandboxServiceInstance) {
    throw new Error('Modal Sandbox service not initialized');
  }
  return sandboxServiceInstance;
}

export function createModalSandboxService(credentials: ModalSandboxCredentials): ModalSandboxService {
  return new ModalSandboxService(credentials);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a pre-configured sandbox for KripTik builds
 */
export async function createKripTikBuildSandbox(
  service: ModalSandboxService,
  options: Partial<ModalSandboxConfig> = {}
): Promise<ModalSandbox> {
  const config: ModalSandboxConfig = {
    ...DEFAULT_SANDBOX_CONFIG,
    ...options,
    image: KRIPTIK_BUILD_IMAGE,
    encrypted_ports: [5173, 3000, 8080, 4173],
  };

  return service.createSandbox(config);
}

/**
 * Full build workflow: clone → install → build → test
 */
export async function executeFullBuildWorkflow(
  service: ModalSandboxService,
  sandboxId: string,
  repoUrl: string,
  options: {
    branch?: string;
    packageManager?: 'npm' | 'pnpm' | 'yarn';
    buildCommand?: string[];
    testCommand?: string[];
    skipTests?: boolean;
  } = {}
): Promise<{
  clone: SandboxExecResult;
  install: SandboxExecResult;
  build: SandboxExecResult;
  test?: SandboxExecResult;
}> {
  const clone = await service.cloneRepo(sandboxId, repoUrl, {
    branch: options.branch,
    depth: 1,
  });

  const install = await service.installDeps(
    sandboxId,
    options.packageManager || 'pnpm'
  );

  const build = await service.runBuild(
    sandboxId,
    options.buildCommand || ['pnpm', 'build']
  );

  let test: SandboxExecResult | undefined;
  if (!options.skipTests) {
    test = await service.runTests(
      sandboxId,
      options.testCommand || ['pnpm', 'test']
    );
  }

  return { clone, install, build, test };
}
