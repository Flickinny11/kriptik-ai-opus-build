/**
 * Single-Sandbox Orchestrator
 *
 * The DEFAULT orchestrator for normal builds (95% of cases).
 * Runs multiple agents CONCURRENTLY within a SINGLE sandbox.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │              SINGLE BUILD SANDBOX                           │
 * │  ┌─────────────────────────────────────────────────────┐   │
 * │  │     Work-Stealing Queue (Dynamic Load Balancing)    │   │
 * │  └─────────────────────────────────────────────────────┘   │
 * │       ↓           ↓           ↓           ↓           ↓    │
 * │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
 * │  │Agent 1 │ │Agent 2 │ │Agent 3 │ │Agent 4 │ │Agent 5 │   │
 * │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
 * │       ↓           ↓           ↓           ↓           ↓    │
 * │  ┌─────────────────────────────────────────────────────┐   │
 * │  │     Local Context Manager (Shared Memory)           │   │
 * │  │     - Zero latency (no Redis)                       │   │
 * │  │     - Atomic file ownership                         │   │
 * │  │     - Instant discovery broadcasting                │   │
 * │  └─────────────────────────────────────────────────────┘   │
 * │       ↓           ↓           ↓           ↓           ↓    │
 * │  ┌─────────────────────────────────────────────────────┐   │
 * │  │     Shared Filesystem (via Modal Volume)            │   │
 * │  └─────────────────────────────────────────────────────┘   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Benefits over Multi-Sandbox:
 * - Same speed (5 parallel agents via work-stealing)
 * - 75% lower cost (1 sandbox vs 5)
 * - No Redis latency (shared memory context)
 * - No merge conflicts (shared filesystem)
 * - Single build verification
 * - Simpler fault handling
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { BuildModeConfig } from './build-mode-config.js';
import type { IntentContract } from '../ai/intent-lock.js';
import type {
  BaseOrchestrator,
  OrchestratorStatus,
  OrchestrationResult,
  ImplementationPlan,
  PlanTask,
} from './orchestrator-factory.js';
import { getModalSnapshotClient } from '../cloud/modal-snapshot-client.js';
import { getSharedVolumeManager } from '../cloud/modal-shared-volume.js';
import { getArtifactPackager } from '../cloud/artifact-packager.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SingleSandboxOrchestratorConfig {
  buildId: string;
  modeConfig: BuildModeConfig;
  intentContract: IntentContract;
  implementationPlan: ImplementationPlan;
  credentials: Record<string, string>;
}

interface SandboxTask {
  id: string;
  originalTask: PlanTask;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  attempts: number;
  result?: TaskResult;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface TaskResult {
  success: boolean;
  filesModified: string[];
  typeCheckPassed: boolean;
  verificationScore: number;
  duration: number;
}

interface AgentState {
  id: string;
  status: 'idle' | 'working' | 'completed';
  currentTaskId?: string;
  tasksCompleted: number;
  totalDuration: number;
}

// =============================================================================
// LOCAL CONTEXT MANAGER (Inline for single-sandbox)
// =============================================================================

class LocalContextManager {
  private fileOwnership = new Map<string, string>(); // file -> agentId
  private discoveries: Array<{ type: string; agentId: string; data: unknown; timestamp: string }> = [];
  private completedFeatures = new Set<string>();

  async claimFile(agentId: string, filePath: string): Promise<boolean> {
    if (this.fileOwnership.has(filePath)) {
      return false; // Already claimed
    }
    this.fileOwnership.set(filePath, agentId);
    return true;
  }

  releaseFile(agentId: string, filePath: string): void {
    if (this.fileOwnership.get(filePath) === agentId) {
      this.fileOwnership.delete(filePath);
    }
  }

  getFileOwner(filePath: string): string | undefined {
    return this.fileOwnership.get(filePath);
  }

  broadcastDiscovery(agentId: string, type: string, data: unknown): void {
    this.discoveries.push({
      type,
      agentId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  getDiscoveries(): Array<{ type: string; agentId: string; data: unknown; timestamp: string }> {
    return [...this.discoveries];
  }

  markFeatureComplete(featureId: string): void {
    this.completedFeatures.add(featureId);
  }

  isFeatureComplete(featureId: string): boolean {
    return this.completedFeatures.has(featureId);
  }

  getCompletedFeatures(): string[] {
    return [...this.completedFeatures];
  }
}

// =============================================================================
// WORK-STEALING QUEUE (Inline for single-sandbox)
// =============================================================================

class WorkStealingQueue {
  private pending: SandboxTask[] = [];
  private inProgress = new Map<string, string>(); // taskId -> agentId
  private completed = new Set<string>();
  private failed = new Map<string, string>(); // taskId -> error
  private taskDependencies = new Map<string, string[]>(); // taskId -> [dependencyIds]

  addTasks(tasks: SandboxTask[]): void {
    // Build dependency map
    for (const task of tasks) {
      this.taskDependencies.set(task.id, task.originalTask.dependencies || []);
    }

    // Sort by dependencies (tasks with fewer deps first)
    this.pending = tasks.sort((a, b) => {
      const aDeps = a.originalTask.dependencies?.length || 0;
      const bDeps = b.originalTask.dependencies?.length || 0;
      return aDeps - bDeps;
    });
  }

  getNextTask(agentId: string): SandboxTask | null {
    // Find first task whose dependencies are all completed
    const readyIndex = this.pending.findIndex(task => {
      const deps = this.taskDependencies.get(task.id) || [];
      return deps.every(depId => this.completed.has(depId));
    });

    if (readyIndex === -1) {
      return null;
    }

    const task = this.pending.splice(readyIndex, 1)[0];
    task.status = 'in_progress';
    task.assignedAgent = agentId;
    task.attempts++;
    task.startedAt = new Date().toISOString();

    this.inProgress.set(task.id, agentId);

    return task;
  }

  completeTask(taskId: string): void {
    this.inProgress.delete(taskId);
    this.completed.add(taskId);
  }

  failTask(taskId: string, error: string, requeue: boolean = true): void {
    const agentId = this.inProgress.get(taskId);
    this.inProgress.delete(taskId);

    if (requeue) {
      // Find task and requeue if under retry limit
      const task = this.pending.find(t => t.id === taskId);
      if (!task) {
        // Task was removed, add back
        this.failed.set(taskId, error);
      }
      // Task stays in pending for retry
    } else {
      this.failed.set(taskId, error);
    }
  }

  hasMoreWork(): boolean {
    return this.pending.length > 0 || this.inProgress.size > 0;
  }

  getStats(): { pending: number; inProgress: number; completed: number; failed: number } {
    return {
      pending: this.pending.length,
      inProgress: this.inProgress.size,
      completed: this.completed.size,
      failed: this.failed.size,
    };
  }
}

// =============================================================================
// SINGLE-SANDBOX ORCHESTRATOR
// =============================================================================

export class SingleSandboxOrchestrator extends EventEmitter implements BaseOrchestrator {
  readonly buildId: string;
  readonly mode = 'single-sandbox' as const;
  readonly config: BuildModeConfig;

  private intentContract: IntentContract;
  private implementationPlan: ImplementationPlan;
  private credentials: Record<string, string>;

  private state: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' = 'initializing';
  private sandboxId: string | null = null;
  private volumeName: string | null = null;
  private contextManager: LocalContextManager;
  private taskQueue: WorkStealingQueue;
  private agents: Map<string, AgentState> = new Map();
  private errors: string[] = [];
  private startedAt: string | null = null;
  private completedAt: string | null = null;

  private snapshotClient = getModalSnapshotClient();
  private volumeManager = getSharedVolumeManager();
  private artifactPackager = getArtifactPackager();

  constructor(config: SingleSandboxOrchestratorConfig) {
    super();

    this.buildId = config.buildId;
    this.config = config.modeConfig;
    this.intentContract = config.intentContract;
    this.implementationPlan = config.implementationPlan;
    this.credentials = config.credentials;

    this.contextManager = new LocalContextManager();
    this.taskQueue = new WorkStealingQueue();

    // Initialize agents
    for (let i = 0; i < this.config.maxAgents; i++) {
      const agentId = `agent-${i + 1}`;
      this.agents.set(agentId, {
        id: agentId,
        status: 'idle',
        tasksCompleted: 0,
        totalDuration: 0,
      });
    }
  }

  // ===========================================================================
  // PUBLIC INTERFACE
  // ===========================================================================

  async orchestrate(): Promise<OrchestrationResult> {
    this.startedAt = new Date().toISOString();
    this.state = 'running';
    this.emit('started', { buildId: this.buildId, mode: this.mode });

    try {
      // Phase 1: Initialize infrastructure
      await this.initializeInfrastructure();

      // Phase 2: Partition tasks
      this.partitionTasks();

      // Phase 3: Run concurrent agents
      await this.runConcurrentAgents();

      // Phase 4: Verify build
      const verificationScore = await this.verifyBuild();

      // Phase 5: Package artifact
      const artifact = await this.packageArtifact();

      // Success!
      this.state = 'completed';
      this.completedAt = new Date().toISOString();

      const result: OrchestrationResult = {
        success: true,
        buildId: this.buildId,
        artifactId: artifact.id,
        previewUrl: artifact.webContainerUrl,
        buildDuration: Date.now() - new Date(this.startedAt).getTime(),
        verificationScore,
        costUsd: this.calculateCost(),
      };

      this.emit('completed', result);
      return result;

    } catch (error) {
      this.state = 'failed';
      this.completedAt = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errors.push(errorMessage);

      const result: OrchestrationResult = {
        success: false,
        buildId: this.buildId,
        buildDuration: Date.now() - new Date(this.startedAt!).getTime(),
        verificationScore: 0,
        errors: this.errors,
      };

      this.emit('failed', { ...result, error: errorMessage });
      return result;

    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  async pause(): Promise<void> {
    if (this.state === 'running') {
      this.state = 'paused';
      this.emit('paused', { buildId: this.buildId });
    }
  }

  async resume(): Promise<void> {
    if (this.state === 'paused') {
      this.state = 'running';
      this.emit('resumed', { buildId: this.buildId });
    }
  }

  async cancel(): Promise<void> {
    this.state = 'cancelled';
    await this.cleanup();
    this.emit('cancelled', { buildId: this.buildId });
  }

  getStatus(): OrchestratorStatus {
    const stats = this.taskQueue.getStats();

    return {
      buildId: this.buildId,
      mode: this.mode,
      state: this.state,
      progress: this.calculateProgress(),
      currentPhase: this.getCurrentPhase(),
      tasksCompleted: stats.completed,
      tasksPending: stats.pending,
      tasksInProgress: stats.inProgress,
      sandboxCount: 1,
      activeSandboxes: this.sandboxId ? 1 : 0,
      startedAt: this.startedAt || undefined,
      estimatedCompletionAt: this.estimateCompletionTime(),
      errors: this.errors,
    };
  }

  // ===========================================================================
  // PRIVATE: INFRASTRUCTURE
  // ===========================================================================

  private async initializeInfrastructure(): Promise<void> {
    this.emit('phaseStarted', { phase: 'infrastructure', buildId: this.buildId });

    // Step 1: Warm up snapshot client (if not already warm)
    if (!this.snapshotClient.isReady()) {
      console.log('[Single-Sandbox] Warming up snapshot client...');
      await this.snapshotClient.warmUp();
    }

    // Step 2: Initialize shared volume
    if (this.config.useSharedVolume) {
      console.log('[Single-Sandbox] Initializing shared volume...');
      const volumeInfo = await this.volumeManager.initializeVolume({
        buildId: this.buildId,
        repoUrl: (this.intentContract as { repoUrl?: string }).repoUrl || '',
        branch: 'main',
        packageManager: 'pnpm',
      });
      this.volumeName = volumeInfo.volumeName;
    }

    // Step 3: Create sandbox (with memory snapshot)
    console.log('[Single-Sandbox] Creating sandbox...');
    const warmUpResult = await this.snapshotClient.executeTask({
      task_id: `sandbox-init-${this.buildId}`,
      action: 'warm_up',
    });

    if (!warmUpResult.success) {
      throw new Error(`Failed to initialize sandbox: ${warmUpResult.error}`);
    }

    this.sandboxId = `sandbox-${this.buildId}`;
    console.log(`[Single-Sandbox] Sandbox ${this.sandboxId} ready`);

    this.emit('phaseCompleted', { phase: 'infrastructure', buildId: this.buildId });
  }

  // ===========================================================================
  // PRIVATE: TASK PARTITIONING
  // ===========================================================================

  private partitionTasks(): void {
    this.emit('phaseStarted', { phase: 'partitioning', buildId: this.buildId });

    const tasks: SandboxTask[] = [];

    for (const phase of this.implementationPlan.phases) {
      for (const planTask of phase.tasks) {
        tasks.push({
          id: planTask.id,
          originalTask: planTask,
          status: 'pending',
          attempts: 0,
        });
      }
    }

    this.taskQueue.addTasks(tasks);

    console.log(`[Single-Sandbox] Partitioned ${tasks.length} tasks`);
    this.emit('phaseCompleted', { phase: 'partitioning', taskCount: tasks.length });
  }

  // ===========================================================================
  // PRIVATE: CONCURRENT AGENT EXECUTION
  // ===========================================================================

  private async runConcurrentAgents(): Promise<void> {
    this.emit('phaseStarted', { phase: 'building', buildId: this.buildId });

    console.log(`[Single-Sandbox] Starting ${this.config.maxAgents} concurrent agents...`);

    // Start all agents in parallel
    const agentPromises: Promise<void>[] = [];

    for (const [agentId, agent] of this.agents) {
      agentPromises.push(this.runAgentWorkLoop(agentId));
    }

    // Wait for all agents to complete
    await Promise.all(agentPromises);

    console.log('[Single-Sandbox] All agents completed');
    this.emit('phaseCompleted', { phase: 'building', buildId: this.buildId });
  }

  private async runAgentWorkLoop(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)!;

    while (this.state === 'running') {
      // Check for pause
      if (this.state === 'paused') {
        await this.waitForResume();
        continue;
      }

      // Get next task (work-stealing)
      const task = this.taskQueue.getNextTask(agentId);

      if (!task) {
        // No more work available
        if (!this.taskQueue.hasMoreWork()) {
          break; // Truly done
        }
        // Wait for other agents to complete dependencies
        await this.delay(100);
        continue;
      }

      // Update agent state
      agent.status = 'working';
      agent.currentTaskId = task.id;

      this.emit('taskStarted', {
        buildId: this.buildId,
        agentId,
        taskId: task.id,
        taskType: task.originalTask.type,
      });

      try {
        // Execute task
        const result = await this.executeTask(agentId, task);

        // Update task
        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date().toISOString();

        // Update queue and context
        this.taskQueue.completeTask(task.id);

        // Update agent stats
        agent.tasksCompleted++;
        agent.totalDuration += result.duration;

        this.emit('taskCompleted', {
          buildId: this.buildId,
          agentId,
          taskId: task.id,
          result,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        task.status = 'failed';
        task.error = errorMessage;

        // Retry up to 3 times
        if (task.attempts < 3) {
          this.taskQueue.failTask(task.id, errorMessage, true);
          console.warn(`[Single-Sandbox] Agent ${agentId} task ${task.id} failed (attempt ${task.attempts}), requeuing`);
        } else {
          this.taskQueue.failTask(task.id, errorMessage, false);
          this.errors.push(`Task ${task.id} failed after 3 attempts: ${errorMessage}`);
        }

        this.emit('taskFailed', {
          buildId: this.buildId,
          agentId,
          taskId: task.id,
          error: errorMessage,
          willRetry: task.attempts < 3,
        });
      }

      // Reset agent state
      agent.status = 'idle';
      agent.currentTaskId = undefined;
    }

    agent.status = 'completed';
    console.log(`[Single-Sandbox] Agent ${agentId} completed (${agent.tasksCompleted} tasks)`);
  }

  private async executeTask(agentId: string, task: SandboxTask): Promise<TaskResult> {
    const startTime = Date.now();

    // Determine files this task will modify
    const filesToModify = this.inferFilesForTask(task.originalTask);

    // Claim files (atomic, prevents conflicts)
    const claimedFiles: string[] = [];
    for (const file of filesToModify) {
      const claimed = await this.contextManager.claimFile(agentId, file);
      if (claimed) {
        claimedFiles.push(file);
      } else {
        // File claimed by another agent - wait and retry
        await this.delay(100);
        // In a real implementation, we'd wait for the file to be released
      }
    }

    try {
      // Generate code for this task
      // This is where we'd call the code generator bridge
      // For now, we'll use a placeholder that writes to the sandbox
      const codeResult = await this.generateCodeForTask(task, claimedFiles);

      // Run incremental type check
      const typeCheckResult = await this.snapshotClient.typeCheck(claimedFiles);

      // Broadcast discovery if we learned something useful
      if (codeResult.pattern) {
        this.contextManager.broadcastDiscovery(agentId, 'pattern', codeResult.pattern);
      }

      return {
        success: true,
        filesModified: claimedFiles,
        typeCheckPassed: typeCheckResult.success,
        verificationScore: typeCheckResult.success ? 90 : 50,
        duration: Date.now() - startTime,
      };

    } finally {
      // Release files
      for (const file of claimedFiles) {
        this.contextManager.releaseFile(agentId, file);
      }
    }
  }

  private async generateCodeForTask(
    task: SandboxTask,
    files: string[]
  ): Promise<{ success: boolean; pattern?: { name: string; description: string } }> {
    // This is where we connect to the actual code generator
    // For now, we simulate by writing a placeholder

    for (const file of files) {
      const content = `// Generated by ${task.id}\n// Task: ${task.originalTask.description}\nexport {};\n`;

      await this.snapshotClient.writeFile(file, content);
    }

    return { success: true };
  }

  private inferFilesForTask(task: PlanTask): string[] {
    // Infer which files this task will modify based on task type
    const files: string[] = [];
    const baseName = task.id.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    switch (task.type) {
      case 'ui':
        files.push(`src/components/${baseName}.tsx`);
        break;
      case 'api':
        files.push(`src/api/${baseName}.ts`);
        break;
      case 'integration':
        files.push(`src/services/${baseName}.ts`);
        break;
      case 'test':
        files.push(`src/__tests__/${baseName}.test.ts`);
        break;
      case 'config':
        files.push(`src/config/${baseName}.ts`);
        break;
      default:
        files.push(`src/${baseName}.ts`);
    }

    return files;
  }

  // ===========================================================================
  // PRIVATE: VERIFICATION
  // ===========================================================================

  private async verifyBuild(): Promise<number> {
    this.emit('verificationStarted', { buildId: this.buildId });

    // Run full type check
    const typeCheck = await this.snapshotClient.typeCheck();

    if (!typeCheck.success) {
      console.warn(`[Single-Sandbox] Type check failed with ${typeCheck.errors.length} errors`);
    }

    // Run build
    const buildResult = await this.snapshotClient.build();

    if (!buildResult.success) {
      console.warn('[Single-Sandbox] Build failed');
    }

    // Calculate score
    let score = 100;
    if (!typeCheck.success) score -= 30;
    if (!buildResult.success) score -= 40;
    score -= Math.min(30, this.errors.length * 5);

    this.emit('verificationCompleted', {
      buildId: this.buildId,
      score,
      typeCheckPassed: typeCheck.success,
      buildPassed: buildResult.success,
    });

    return Math.max(0, score);
  }

  // ===========================================================================
  // PRIVATE: ARTIFACT PACKAGING
  // ===========================================================================

  private async packageArtifact(): Promise<{ id: string; webContainerUrl: string }> {
    this.emit('phaseStarted', { phase: 'packaging', buildId: this.buildId });

    const artifact = await this.artifactPackager.packageBuild({
      buildId: this.buildId,
      sandboxId: this.sandboxId!,
      projectName: (this.intentContract as { projectName?: string }).projectName || 'project',
      framework: 'vite-react',
      includeNodeModules: false,
      compressionLevel: 'fast',
    });

    this.emit('phaseCompleted', { phase: 'packaging', artifactId: artifact.id });

    return {
      id: artifact.id,
      webContainerUrl: artifact.webContainerUrl,
    };
  }

  // ===========================================================================
  // PRIVATE: CLEANUP
  // ===========================================================================

  private async cleanup(): Promise<void> {
    console.log('[Single-Sandbox] Cleaning up...');

    // Cleanup shared volume
    if (this.volumeName) {
      try {
        await this.volumeManager.cleanupVolume(this.volumeName);
      } catch (error) {
        console.error('[Single-Sandbox] Failed to cleanup volume:', error);
      }
    }

    // Sandbox cleanup is handled by Modal's TTL
    this.sandboxId = null;
    this.volumeName = null;
  }

  // ===========================================================================
  // PRIVATE: HELPERS
  // ===========================================================================

  private calculateProgress(): number {
    const stats = this.taskQueue.getStats();
    const total = stats.pending + stats.inProgress + stats.completed + stats.failed;

    if (total === 0) return 0;
    return Math.round((stats.completed / total) * 100);
  }

  private getCurrentPhase(): string {
    if (this.state === 'initializing') return 'infrastructure';
    if (this.state === 'running') return 'building';
    return this.state;
  }

  private estimateCompletionTime(): string | undefined {
    if (!this.startedAt || this.state !== 'running') return undefined;

    const elapsed = Date.now() - new Date(this.startedAt).getTime();
    const progress = this.calculateProgress();

    if (progress === 0) return undefined;

    const estimatedTotal = elapsed / (progress / 100);
    const remaining = estimatedTotal - elapsed;

    return new Date(Date.now() + remaining).toISOString();
  }

  private calculateCost(): number {
    if (!this.startedAt) return 0;

    const durationSeconds = (Date.now() - new Date(this.startedAt).getTime()) / 1000;
    const costPerSecond = 0.000033; // 2 cores, 4GB RAM

    return Math.round(durationSeconds * costPerSecond * 10000) / 10000;
  }

  private async waitForResume(): Promise<void> {
    while (this.state === 'paused') {
      await this.delay(1000);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
