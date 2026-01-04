# Modal + Vercel Sandboxing Implementation Plan

> **Document Version**: 1.0
> **Created**: 2026-01-04
> **Author**: Claude Code (Opus 4.5)
> **Status**: PENDING APPROVAL

---

## Executive Summary

This plan transforms KripTik AI from local-only sandboxing to cloud-hosted, massively parallel sandbox orchestration using **Modal Sandboxes** for isolated code execution and **Vercel Fluid Compute** for long-running orchestration. This enables the vision described: multiple concurrent sandboxes, each running full 6-phase build loops with verification swarms, tournament mode with AI judging, and seamless merge to main with visual verification.

### Key Deliverables

1. **Modal Sandbox Service** - Cloud-hosted isolated code execution (replaces local process-based sandboxes)
2. **Multi-Sandbox Orchestrator** - Coordinates N parallel sandboxes building different phases/tasks
3. **Vercel Fluid Orchestrator** - Long-running functions for hours/days of autonomous building
4. **Sandbox Merge Controller** - Verification gating before merge to main
5. **Tournament Sandbox Manager** - Parallel competing implementations with AI judging
6. **Real-time Context Bridge** - Shared memory/context between cloud sandboxes

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                                    │
│                  (Sees ONLY the Main Live Preview)                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    VERCEL FLUID COMPUTE                                  │
│           (Long-running orchestration - hours/days)                      │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              MULTI-SANDBOX ORCHESTRATOR                          │    │
│  │                                                                  │    │
│  │  • Receives Implementation Plan from Intent Lock                 │    │
│  │  • Partitions tasks across N sandbox orchestrations              │    │
│  │  • Manages real-time context sharing via Redis/SSE               │    │
│  │  • Coordinates merge queue                                       │    │
│  │  • Runs Tournament Mode when configured                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                 │                                        │
│                 ┌───────────────┼───────────────┐                        │
│                 │               │               │                        │
│                 ▼               ▼               ▼                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│  │   SANDBOX 1     │ │   SANDBOX 2     │ │   SANDBOX N     │            │
│  │   (Phase A)     │ │   (Phase B)     │ │   (Phase C)     │            │
│  │                 │ │                 │ │                 │            │
│  │ 3-5 Agents      │ │ 3-5 Agents      │ │ 3-5 Agents      │            │
│  │ Verification    │ │ Verification    │ │ Verification    │            │
│  │ Error Escalate  │ │ Error Escalate  │ │ Error Escalate  │            │
│  │ Browser Loop    │ │ Browser Loop    │ │ Browser Loop    │            │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘            │
│           │                   │                   │                      │
│           └───────────────────┼───────────────────┘                      │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              SANDBOX MERGE CONTROLLER                            │    │
│  │                                                                  │    │
│  │  1. Verification Swarm (6 agents) per sandbox                   │    │
│  │  2. Anti-slop detection (85+ score)                             │    │
│  │  3. Error-free compilation check                                 │    │
│  │  4. Compatibility check with other sandboxes                     │    │
│  │  5. Intent satisfaction validation                               │    │
│  │  6. Visual verification (headless Playwright)                    │    │
│  │  7. Main-test sandbox validation                                 │    │
│  │  8. ONLY THEN merge to Main                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    MAIN SANDBOX                                  │    │
│  │            (User's Live Preview Window)                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘

                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MODAL SANDBOXES                                  │
│              (Cloud-hosted isolated code execution)                      │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Container 1 │  │ Container 2 │  │ Container 3 │  │ Container N │    │
│  │             │  │             │  │             │  │             │    │
│  │ • Node.js   │  │ • Node.js   │  │ • Node.js   │  │ • Node.js   │    │
│  │ • Git       │  │ • Git       │  │ • Git       │  │ • Git       │    │
│  │ • npm       │  │ • npm       │  │ • npm       │  │ • npm       │    │
│  │ • Playwright│  │ • Playwright│  │ • Playwright│  │ • Playwright│    │
│  │ • Dev server│  │ • Dev server│  │ • Dev server│  │ • Dev server│    │
│  │ • HMR ready │  │ • HMR ready │  │ • HMR ready │  │ • HMR ready │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                          │
│  Features:                                                               │
│  • Sub-second cold starts (Modal's container fabric)                    │
│  • Scale to 50,000+ concurrent sandboxes                                │
│  • Built-in tunneling for external access                               │
│  • gVisor security isolation                                            │
│  • Snapshotting for fast restore                                        │
│  • Automatic cleanup on completion/timeout                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Reference: How Lovable Uses Modal

Based on research ([Modal + Lovable Case Study](https://modal.com/blog/lovable-case-study), [Modal Sandboxes Docs](https://modal.com/docs/guide/sandboxes)):

1. **Scale**: Lovable ran 1 million sandboxes over a weekend, 20,000 concurrent at peak
2. **Architecture**: Every app generation session runs in a Modal Sandbox
3. **Features Used**:
   - `modal.Sandbox.create()` for isolated containers
   - Port tunneling via `open_ports` and `.tunnels()` method
   - Dynamic image definition at runtime
   - Sub-second cold starts
   - Snapshotting for session restoration
4. **Security**: gVisor isolation, no network by default, CIDR allowlists
5. **Why They Migrated**: Previous cloud VM provider couldn't scale fast enough

**KripTik Advantage**: We add verification swarms, tournament mode, and Intent Satisfaction gating on top of Modal's infrastructure.

---

## Phase 1: Modal Sandbox Service (Core Infrastructure)

### 1.1 New File: `server/src/services/cloud/modal-sandbox.ts`

```typescript
/**
 * Modal Sandbox Service - Cloud-hosted isolated code execution
 *
 * Unlike modal.ts (GPU deployments), this service creates ephemeral
 * sandboxes for running AI-generated code in isolation.
 */

export interface ModalSandboxConfig {
  image?: SandboxImageConfig;
  timeout?: number; // seconds (default 3600 = 1 hour)
  memory?: number; // MB (default 4096)
  cpu?: number; // CPU cores (default 2)
  encrypted_ports?: number[]; // Ports to tunnel
  workdir?: string;
  env?: Record<string, string>;
  block_network?: boolean;
  cidr_allowlist?: string[]; // Allowed outbound CIDRs
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
```

### 1.2 Modal Python Bridge

Since Modal's SDK is Python-native, we need a bridge:

**Option A**: REST API wrapper (Modal's v1 API)
**Option B**: Python subprocess with modal-client
**Option C**: Modal's experimental JS/Go SDK

**Recommended**: Option B for now (Python subprocess), migrate to Option C when stable.

Create: `server/src/services/cloud/modal-sandbox-bridge.py`

```python
"""
Modal Sandbox Bridge - Called by Node.js via subprocess
Handles sandbox lifecycle: create, exec, tunnel, terminate
"""

import modal
import json
import sys
import os

# Default sandbox image for KripTik builds
kriptik_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        "curl", "git", "build-essential", "chromium",
        "libnss3", "libatk-bridge2.0-0", "libdrm2",
        "libxkbcommon0", "libxcomposite1", "libxdamage1",
        "libxrandr2", "libgbm1", "libasound2"
    ])
    .run_commands([
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g pnpm@9 playwright@1.40",
        "npx playwright install chromium"
    ])
)

app = modal.App("kriptik-sandbox-manager")

@app.function()
def create_sandbox(config: dict) -> dict:
    """Create a new sandbox with the given configuration"""
    sb = modal.Sandbox.create(
        image=kriptik_image,
        timeout=config.get("timeout", 3600),
        cpu=config.get("cpu", 2.0),
        memory=config.get("memory", 4096),
        encrypted_ports=config.get("ports", [3000, 5173]),
        workdir="/workspace",
        app=app,
    )

    tunnels = sb.tunnels()
    return {
        "sandbox_id": sb.object_id,
        "tunnels": {port: {"url": t.url, "port": port} for port, t in tunnels.items()},
        "status": "running"
    }

@app.function()
def exec_in_sandbox(sandbox_id: str, command: list[str], timeout: int = 300) -> dict:
    """Execute a command in an existing sandbox"""
    sb = modal.Sandbox.from_id(sandbox_id)
    proc = sb.exec(*command, timeout=timeout)

    stdout = proc.stdout.read()
    stderr = proc.stderr.read()
    proc.wait()

    return {
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": proc.returncode
    }

@app.function()
def terminate_sandbox(sandbox_id: str) -> dict:
    """Terminate a sandbox"""
    sb = modal.Sandbox.from_id(sandbox_id)
    sb.terminate()
    return {"status": "terminated", "sandbox_id": sandbox_id}
```

### 1.3 TypeScript Service Wrapper

```typescript
// server/src/services/cloud/modal-sandbox.ts

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';

export class ModalSandboxService {
  private tokenId: string;
  private tokenSecret: string;
  private activeSandboxes: Map<string, ModalSandbox> = new Map();

  constructor() {
    this.tokenId = process.env.MODAL_TOKEN_ID!;
    this.tokenSecret = process.env.MODAL_TOKEN_SECRET!;

    if (!this.tokenId || !this.tokenSecret) {
      throw new Error('Modal credentials not configured');
    }
  }

  async createSandbox(config: ModalSandboxConfig): Promise<ModalSandbox> {
    // Call Python bridge via subprocess
    const result = await this.callPythonBridge('create_sandbox', config);

    const sandbox: ModalSandbox = {
      id: uuidv4(),
      app_id: result.sandbox_id,
      status: 'running',
      tunnels: result.tunnels,
      created_at: new Date().toISOString(),
      project_path: config.workdir || '/workspace'
    };

    this.activeSandboxes.set(sandbox.id, sandbox);
    return sandbox;
  }

  async exec(sandboxId: string, command: string[]): Promise<SandboxExecResult> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const startTime = Date.now();
    const result = await this.callPythonBridge('exec_in_sandbox', {
      sandbox_id: sandbox.app_id,
      command
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code,
      duration_ms: Date.now() - startTime
    };
  }

  async cloneRepo(sandboxId: string, repoUrl: string): Promise<void> {
    await this.exec(sandboxId, ['git', 'clone', repoUrl, '/workspace/project']);
  }

  async installDeps(sandboxId: string): Promise<void> {
    await this.exec(sandboxId, ['pnpm', 'install']);
  }

  async startDevServer(sandboxId: string, port: number = 5173): Promise<string> {
    // Start dev server in background
    await this.exec(sandboxId, ['pnpm', 'dev', '--host', '0.0.0.0', '--port', String(port)]);

    const sandbox = this.activeSandboxes.get(sandboxId)!;
    return sandbox.tunnels[port]?.url || '';
  }

  async runBuild(sandboxId: string): Promise<SandboxExecResult> {
    return this.exec(sandboxId, ['pnpm', 'build']);
  }

  async runTests(sandboxId: string): Promise<SandboxExecResult> {
    return this.exec(sandboxId, ['pnpm', 'test']);
  }

  async terminate(sandboxId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) return;

    await this.callPythonBridge('terminate_sandbox', { sandbox_id: sandbox.app_id });
    this.activeSandboxes.delete(sandboxId);
  }

  private async callPythonBridge(method: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python', [
        '-c',
        `
import modal
import json
from modal_sandbox_bridge import ${method}
result = ${method}(${JSON.stringify(args)})
print(json.dumps(result))
        `
      ], {
        env: {
          ...process.env,
          MODAL_TOKEN_ID: this.tokenId,
          MODAL_TOKEN_SECRET: this.tokenSecret
        }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => stdout += data);
      proc.stderr.on('data', (data) => stderr += data);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(JSON.parse(stdout));
        } else {
          reject(new Error(`Modal bridge error: ${stderr}`));
        }
      });
    });
  }
}
```

---

## Phase 2: Multi-Sandbox Orchestrator

### 2.1 New File: `server/src/services/orchestration/multi-sandbox-orchestrator.ts`

This is the brain that coordinates multiple parallel sandboxes, each running a full 6-phase build loop.

```typescript
/**
 * Multi-Sandbox Orchestrator
 *
 * Coordinates N parallel sandboxes, each building different phases/tasks
 * of the implementation plan. Shares context in real-time and manages
 * the merge queue with verification gates.
 */

export interface MultiSandboxConfig {
  maxParallelSandboxes: number; // Default: 5, Max: 20
  taskPartitionStrategy: 'by-phase' | 'by-feature' | 'by-component';
  tournamentMode: boolean;
  tournamentCompetitors: number; // How many sandboxes compete per task
  budgetLimitUsd: number;
  timeoutHours: number;
  respawnOnFailure: boolean;
}

export interface SandboxTask {
  id: string;
  phase: string; // e.g., "Phase 2: Auth System"
  features: string[];
  dependencies: string[]; // Task IDs this depends on
  assignedSandboxId?: string;
  status: 'pending' | 'assigned' | 'building' | 'verifying' | 'merged' | 'failed';
}

export interface OrchestratorState {
  buildId: string;
  intentContract: IntentContract;
  tasks: SandboxTask[];
  sandboxes: Map<string, SandboxContext>;
  mergeQueue: MergeQueueItem[];
  mainSandboxId: string;
  tournamentResults?: TournamentResult[];
}

export class MultiSandboxOrchestrator extends EventEmitter {
  private config: MultiSandboxConfig;
  private state: OrchestratorState;
  private modalService: ModalSandboxService;
  private contextBridge: ContextBridgeService;
  private verificationSwarm: VerificationSwarm;

  async orchestrate(
    intentContract: IntentContract,
    implementationPlan: ImplementationPlan,
    credentials: Map<string, string>
  ): Promise<OrchestrationResult> {

    // 1. Partition implementation plan into sandbox tasks
    const tasks = this.partitionTasks(implementationPlan);

    // 2. Create main sandbox (user's live preview)
    const mainSandbox = await this.createMainSandbox(intentContract);

    // 3. Spawn N parallel sandboxes for building
    const buildSandboxes = await this.spawnBuildSandboxes(
      tasks,
      this.config.maxParallelSandboxes
    );

    // 4. Start real-time context sharing
    await this.contextBridge.initializeSharedContext({
      buildId: this.state.buildId,
      sandboxIds: [mainSandbox.id, ...buildSandboxes.map(s => s.id)],
      intentContract
    });

    // 5. Assign tasks to sandboxes
    await this.assignTasks(tasks, buildSandboxes);

    // 6. Start parallel build loops (each sandbox runs full 6-phase)
    const buildPromises = buildSandboxes.map(sandbox =>
      this.runSandboxBuildLoop(sandbox, this.getTasksForSandbox(sandbox.id))
    );

    // 7. Monitor progress, handle failures, respawn if needed
    await this.monitorBuilds(buildPromises);

    // 8. Process merge queue with verification
    await this.processMergeQueue();

    // 9. Final Intent Satisfaction check
    const satisfaction = await this.checkIntentSatisfaction();

    if (!satisfaction.passed) {
      // Respawn and continue building
      return this.orchestrate(intentContract, satisfaction.remainingPlan, credentials);
    }

    return {
      success: true,
      mainSandboxUrl: mainSandbox.tunnels[5173]?.url,
      buildDuration: this.calculateDuration(),
      costUsd: this.calculateCost()
    };
  }

  private async runSandboxBuildLoop(
    sandbox: SandboxContext,
    tasks: SandboxTask[]
  ): Promise<SandboxBuildResult> {
    const buildLoop = new BuildLoopOrchestrator({
      sandboxId: sandbox.id,
      modalService: this.modalService,
      contextBridge: this.contextBridge,
      verificationSwarm: this.verificationSwarm
    });

    for (const task of tasks) {
      // Each task goes through full 6-phase build
      const result = await buildLoop.executePhases(task);

      if (result.passed) {
        // Add to merge queue
        await this.addToMergeQueue({
          sandboxId: sandbox.id,
          taskId: task.id,
          files: result.changedFiles,
          verificationScore: result.verificationScore
        });
      } else {
        // Emit for respawn/escalation
        this.emit('taskFailed', { sandbox, task, error: result.error });
      }
    }
  }

  private async processMergeQueue(): Promise<void> {
    while (this.state.mergeQueue.length > 0) {
      const item = this.state.mergeQueue.shift()!;

      // 1. Run verification swarm on the sandbox
      const verification = await this.verificationSwarm.verify(item.sandboxId);

      if (verification.verdict !== 'APPROVED') {
        // Reject merge, send back for fixes
        this.emit('mergeRejected', { item, verification });
        continue;
      }

      // 2. Check compatibility with other pending merges
      const compatible = await this.checkCompatibility(item);
      if (!compatible.success) {
        this.emit('mergeConflict', { item, conflicts: compatible.conflicts });
        continue;
      }

      // 3. Test merge in main-test sandbox
      const testMerge = await this.testMergeInMainTest(item);
      if (!testMerge.success) {
        this.emit('testMergeFailed', { item, error: testMerge.error });
        continue;
      }

      // 4. Visual verification in headless browser
      const visual = await this.visualVerifyMainTest();
      if (!visual.passed) {
        this.emit('visualVerificationFailed', { item, issues: visual.issues });
        continue;
      }

      // 5. Merge to main sandbox
      await this.mergeToMain(item);
      this.emit('merged', { item });
    }
  }
}
```

---

## Phase 3: Vercel Fluid Compute Integration

### 3.1 Enable Fluid Compute

Update `server/vercel.json`:

```json
{
  "version": 2,
  "framework": null,
  "functions": {
    "api/orchestrate.ts": {
      "maxDuration": 900,
      "memory": 3008,
      "runtime": "nodejs20.x"
    },
    "api/build-loop.ts": {
      "maxDuration": 900,
      "memory": 3008
    }
  },
  "builds": [
    {
      "src": "api/**/*.ts",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["src/**/*.ts", "package.json"]
      }
    }
  ],
  "routes": [
    { "src": "/api/orchestrate", "dest": "/api/orchestrate.ts" },
    { "src": "/api/build-loop/(.+)", "dest": "/api/build-loop.ts?id=$1" },
    { "src": "/(.*)", "dest": "/api/index.ts" }
  ]
}
```

### 3.2 Long-Running Orchestration Endpoint

Create: `server/api/orchestrate.ts`

```typescript
/**
 * Orchestration Endpoint - Vercel Fluid Compute
 *
 * This function can run for up to 15 minutes per invocation.
 * For longer builds, it chains itself via webhook callbacks.
 */

import { MultiSandboxOrchestrator } from '../src/services/orchestration/multi-sandbox-orchestrator';

export const config = {
  maxDuration: 900, // 15 minutes (Fluid max)
};

export default async function handler(req: Request) {
  const { buildId, checkpointId } = await req.json();

  const orchestrator = new MultiSandboxOrchestrator({
    maxParallelSandboxes: 5,
    taskPartitionStrategy: 'by-feature',
    tournamentMode: true,
    tournamentCompetitors: 3,
    budgetLimitUsd: 100,
    timeoutHours: 24,
    respawnOnFailure: true
  });

  // Load checkpoint if resuming
  if (checkpointId) {
    await orchestrator.loadCheckpoint(checkpointId);
  }

  // Run orchestration (may not complete in 15 min)
  const result = await orchestrator.orchestrate();

  if (!result.complete) {
    // Save checkpoint and schedule continuation
    const checkpoint = await orchestrator.saveCheckpoint();

    // Chain to next invocation
    await fetch(`${process.env.VERCEL_URL}/api/orchestrate`, {
      method: 'POST',
      body: JSON.stringify({ buildId, checkpointId: checkpoint.id })
    });
  }

  return new Response(JSON.stringify(result));
}
```

### 3.3 Fluid Compute Configuration

Add to project settings (via Vercel dashboard or CLI):

```bash
# Enable Fluid Compute for the project
vercel env add VERCEL_FLUID_COMPUTE 1 production

# Or via vercel.json (project-level)
{
  "functions": {
    "api/orchestrate.ts": {
      "experimentalFluid": true
    }
  }
}
```

---

## Phase 4: Real-Time Context Bridge

### 4.1 New File: `server/src/services/orchestration/context-bridge.ts`

```typescript
/**
 * Context Bridge Service
 *
 * Enables real-time context sharing between cloud sandboxes.
 * Uses Redis for pub/sub and Turso for persistent state.
 */

export interface SharedContext {
  buildId: string;
  intentContract: IntentContract;

  // Real-time shared state
  completedFeatures: string[];
  inProgressFeatures: Map<string, string>; // feature -> sandboxId
  discoveredPatterns: Pattern[];
  sharedErrors: ErrorRecord[];

  // File ownership tracking
  fileOwnership: Map<string, string>; // file path -> sandboxId

  // Merge coordination
  pendingMerges: MergeQueueItem[];
}

export class ContextBridgeService {
  private redis: Redis;
  private pubsub: RedisPubSub;

  async initializeSharedContext(config: ContextBridgeConfig): Promise<void> {
    // Create Redis channels for this build
    await this.pubsub.subscribe(`build:${config.buildId}:updates`);
    await this.pubsub.subscribe(`build:${config.buildId}:conflicts`);
    await this.pubsub.subscribe(`build:${config.buildId}:discoveries`);

    // Initialize shared state
    await this.redis.set(`build:${config.buildId}:context`, JSON.stringify({
      intentContract: config.intentContract,
      completedFeatures: [],
      inProgressFeatures: {},
      discoveredPatterns: [],
      sharedErrors: []
    }));
  }

  async claimFile(sandboxId: string, filePath: string): Promise<boolean> {
    // Atomic file claiming to prevent conflicts
    const result = await this.redis.setnx(
      `build:${this.buildId}:file:${filePath}`,
      sandboxId
    );
    return result === 1;
  }

  async broadcastDiscovery(discovery: Discovery): Promise<void> {
    await this.pubsub.publish(
      `build:${this.buildId}:discoveries`,
      JSON.stringify(discovery)
    );
  }

  async onDiscovery(callback: (discovery: Discovery) => void): void {
    this.pubsub.on('message', (channel, message) => {
      if (channel.endsWith(':discoveries')) {
        callback(JSON.parse(message));
      }
    });
  }

  async getFileOwnership(): Promise<Map<string, string>> {
    const keys = await this.redis.keys(`build:${this.buildId}:file:*`);
    const ownership = new Map();

    for (const key of keys) {
      const filePath = key.replace(`build:${this.buildId}:file:`, '');
      const owner = await this.redis.get(key);
      ownership.set(filePath, owner);
    }

    return ownership;
  }
}
```

---

## Phase 5: Tournament Mode

### 5.1 New File: `server/src/services/orchestration/tournament-manager.ts`

```typescript
/**
 * Tournament Manager
 *
 * Runs multiple competing sandboxes for the same task,
 * uses AI judging to select the best implementation.
 */

export class TournamentManager {
  private judge: MultiAgentJudgeService;

  async runTournament(
    task: SandboxTask,
    competitorCount: number
  ): Promise<TournamentResult> {

    // 1. Spawn N sandboxes all building the same task
    const competitors: SandboxContext[] = [];
    for (let i = 0; i < competitorCount; i++) {
      const sandbox = await this.modalService.createSandbox({
        timeout: 3600,
        memory: 4096,
        encrypted_ports: [5173]
      });
      competitors.push(sandbox);
    }

    // 2. Run builds in parallel
    const results = await Promise.all(
      competitors.map(c => this.buildLoop.executeTask(c, task))
    );

    // 3. AI Judge evaluates all implementations
    const judgments = await this.judge.evaluateCompetitors(
      results.map(r => ({
        sandboxId: r.sandboxId,
        code: r.generatedCode,
        testResults: r.testResults,
        verificationScore: r.verificationScore
      }))
    );

    // 4. Select winner
    const winner = judgments.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    // 5. Terminate losers
    for (const result of results) {
      if (result.sandboxId !== winner.sandboxId) {
        await this.modalService.terminate(result.sandboxId);
      }
    }

    return {
      task,
      winner: winner.sandboxId,
      winnerCode: results.find(r => r.sandboxId === winner.sandboxId)!.generatedCode,
      allScores: judgments
    };
  }
}
```

---

## Phase 6: Sandbox Merge Controller

### 6.1 New File: `server/src/services/orchestration/merge-controller.ts`

```typescript
/**
 * Sandbox Merge Controller
 *
 * Manages the critical merge process from build sandboxes to main.
 * Implements all verification gates before allowing merge.
 */

export class SandboxMergeController {
  async verifyAndMerge(item: MergeQueueItem): Promise<MergeResult> {
    const checks = new VerificationChecklist();

    // 1. Verification Swarm (6 agents)
    checks.add('swarm', await this.runVerificationSwarm(item));

    // 2. Anti-slop Detection (85+ required)
    checks.add('antislop', await this.runAntiSlopCheck(item));

    // 3. Error-free Compilation
    checks.add('build', await this.runBuildCheck(item));

    // 4. Compatibility with Other Sandboxes
    checks.add('compatibility', await this.checkCompatibility(item));

    // 5. Intent Satisfaction Validation
    checks.add('intent', await this.checkIntentSatisfaction(item));

    // 6. Visual Verification (Headless Playwright)
    checks.add('visual', await this.runVisualVerification(item));

    // 7. Main-Test Sandbox Validation
    checks.add('maintest', await this.testInMainTestSandbox(item));

    // All checks must pass
    if (!checks.allPassed()) {
      return {
        success: false,
        failedChecks: checks.getFailures()
      };
    }

    // 8. Execute merge to main
    return this.executeMerge(item);
  }

  private async runVisualVerification(item: MergeQueueItem): Promise<CheckResult> {
    // Use Playwright in the sandbox for headless visual verification
    const result = await this.modalService.exec(item.sandboxId, [
      'npx', 'playwright', 'test', '--project=visual-verification'
    ]);

    // Additionally, use AI vision to verify UI matches intent
    const screenshot = await this.takeScreenshot(item.sandboxId);
    const aiVerification = await this.visualVerifier.verifyAgainstIntent(
      screenshot,
      item.intentContract.visualIdentity
    );

    return {
      passed: result.exit_code === 0 && aiVerification.score >= 85,
      details: { playwright: result, aiScore: aiVerification.score }
    };
  }

  private async testInMainTestSandbox(item: MergeQueueItem): Promise<CheckResult> {
    // 1. Clone main sandbox to main-test
    const mainTest = await this.createMainTestSandbox();

    // 2. Apply the merge
    await this.applyMerge(mainTest.id, item);

    // 3. Run full test suite
    const tests = await this.modalService.exec(mainTest.id, ['pnpm', 'test']);

    // 4. Run build
    const build = await this.modalService.exec(mainTest.id, ['pnpm', 'build']);

    // 5. Visual check
    const visual = await this.runVisualCheck(mainTest.id);

    // 6. Cleanup
    await this.modalService.terminate(mainTest.id);

    return {
      passed: tests.exit_code === 0 && build.exit_code === 0 && visual.passed,
      details: { tests, build, visual }
    };
  }
}
```

---

## Phase 7: Integration with Existing Build Loop

### 7.1 Modify: `server/src/services/automation/build-loop.ts`

Add Modal sandbox support as an alternative to local sandboxes:

```typescript
// Add to existing BuildLoopOrchestrator class

async selectSandboxProvider(): Promise<'local' | 'modal'> {
  // Use Modal for production, local for development
  if (process.env.NODE_ENV === 'production') {
    return 'modal';
  }

  // Check if Modal credentials are available
  if (process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET) {
    return 'modal';
  }

  return 'local';
}

async createSandboxForPhase2(
  provider: 'local' | 'modal'
): Promise<SandboxInstance | ModalSandbox> {
  if (provider === 'modal') {
    const modalService = new ModalSandboxService();
    return modalService.createSandbox({
      timeout: 3600,
      memory: 4096,
      encrypted_ports: [5173, 3000],
      env: this.buildEnv
    });
  }

  // Existing local sandbox logic
  return this.sandboxService.createSandbox(this.agentId, this.worktreePath);
}
```

---

## Database Schema Updates

### 8.1 Add to: `server/src/schema.ts`

```typescript
// Cloud Sandboxes table
export const cloudSandboxes = sqliteTable('cloud_sandboxes', {
  id: text('id').primaryKey(),
  buildId: text('build_id').references(() => orchestrationRuns.id),
  modalSandboxId: text('modal_sandbox_id'),
  status: text('status').$type<'creating' | 'running' | 'stopped' | 'error'>(),
  tunnelUrl: text('tunnel_url'),
  assignedTasks: text('assigned_tasks'), // JSON array
  verificationScore: integer('verification_score'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  terminatedAt: text('terminated_at'),
  costUsd: real('cost_usd').default(0),
  metadata: text('metadata'), // JSON
});

// Sandbox Merge Queue
export const sandboxMergeQueue = sqliteTable('sandbox_merge_queue', {
  id: text('id').primaryKey(),
  buildId: text('build_id').references(() => orchestrationRuns.id),
  sandboxId: text('sandbox_id').references(() => cloudSandboxes.id),
  taskId: text('task_id'),
  status: text('status').$type<'pending' | 'verifying' | 'approved' | 'merged' | 'rejected'>(),
  verificationResults: text('verification_results'), // JSON
  changedFiles: text('changed_files'), // JSON array
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  mergedAt: text('merged_at'),
});

// Tournament Results
export const tournamentResults = sqliteTable('tournament_results', {
  id: text('id').primaryKey(),
  buildId: text('build_id').references(() => orchestrationRuns.id),
  taskId: text('task_id'),
  winningSandboxId: text('winning_sandbox_id'),
  competitorCount: integer('competitor_count'),
  winningScore: real('winning_score'),
  allScores: text('all_scores'), // JSON
  judgmentRationale: text('judgment_rationale'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

---

## Environment Variables Required

```bash
# Modal Sandbox Configuration
MODAL_TOKEN_ID=                    # Modal workspace token ID
MODAL_TOKEN_SECRET=                # Modal workspace secret
MODAL_WORKSPACE=kriptik            # Modal workspace name

# Vercel Fluid Configuration
VERCEL_TOKEN=                      # Vercel API token
KRIPTIK_VERCEL_TOKEN=              # KripTik's team token (preferred)
KRIPTIK_VERCEL_TEAM_ID=            # Team ID for managed hosting
VERCEL_FLUID_COMPUTE=1             # Enable Fluid Compute

# Redis (for real-time context sharing)
REDIS_URL=                         # Redis connection URL
REDIS_TOKEN=                       # Redis auth token (if using Upstash)

# Build Configuration
MAX_PARALLEL_SANDBOXES=5           # Default parallel sandbox count
TOURNAMENT_COMPETITORS=3           # Sandboxes per tournament
BUILD_TIMEOUT_HOURS=24             # Max build duration
BUILD_BUDGET_USD=100               # Cost limit per build
```

---

## Implementation Order

### Sprint 1: Core Modal Sandbox (Days 1-3)
1. Create `modal-sandbox.ts` service
2. Create Python bridge for Modal SDK
3. Test sandbox creation, exec, and tunneling
4. Integrate with existing SandboxService interface

### Sprint 2: Multi-Sandbox Orchestrator (Days 4-6)
1. Create `multi-sandbox-orchestrator.ts`
2. Implement task partitioning logic
3. Implement parallel sandbox spawning
4. Add real-time context sharing (basic)

### Sprint 3: Merge Controller (Days 7-9)
1. Create `merge-controller.ts`
2. Implement 7-gate verification pipeline
3. Integrate with existing VerificationSwarm
4. Add visual verification with Playwright

### Sprint 4: Vercel Fluid (Days 10-11)
1. Update vercel.json for Fluid Compute
2. Create long-running orchestration endpoint
3. Implement checkpoint/resume logic
4. Test multi-hour builds

### Sprint 5: Tournament Mode (Days 12-13)
1. Create `tournament-manager.ts`
2. Integrate with MultiAgentJudge
3. Implement winner selection logic
4. Add cost tracking for tournaments

### Sprint 6: Integration & Testing (Days 14-15)
1. Wire up to existing build loop
2. Update UI for multi-sandbox status
3. End-to-end testing
4. Performance optimization

---

## Success Criteria

1. **Scale**: Can run 20+ concurrent sandboxes per build
2. **Duration**: Builds can run autonomously for 24+ hours
3. **Verification**: All 7 gates pass before merge to main
4. **Tournament**: AI judge selects best implementation
5. **Cost**: Tracks and respects budget limits
6. **User Experience**: User only sees clean main sandbox
7. **Respawn**: Failed sandboxes automatically respawn
8. **Context**: All sandboxes share real-time context

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Modal API limits | Implement backoff, use workspace limits |
| Vercel Fluid timeout | Checkpoint/resume architecture |
| Redis failure | Fallback to Turso for state |
| Cost overrun | Hard budget limits with alerts |
| Network isolation | Modal's gVisor + CIDR allowlists |
| Merge conflicts | Atomic file claiming via Redis |

---

## Dependencies

### NPM Packages to Add
```json
{
  "ioredis": "^5.3.2",
  "@upstash/redis": "^1.28.0",
  "bullmq": "^5.1.0"
}
```

### Python Packages (for Modal bridge)
```
modal>=1.0.0
```

---

## References

- [Modal Sandboxes Documentation](https://modal.com/docs/guide/sandboxes)
- [Modal + Lovable Case Study](https://modal.com/blog/lovable-case-study)
- [Modal Networking Guide](https://modal.com/docs/guide/sandbox-networking)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Vercel Fluid Blog Post](https://vercel.com/blog/fluid-compute-evolving-serverless-for-ai-workloads)

---

## Approval

This plan requires approval before implementation. Once approved:
1. I will implement each phase in order
2. Each phase will be committed and pushed
3. Build verification after each phase
4. Update memory files with progress

**Awaiting your review and approval.**
