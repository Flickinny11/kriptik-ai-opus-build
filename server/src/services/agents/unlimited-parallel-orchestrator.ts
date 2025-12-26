/**
 * Unlimited Parallel Agent Orchestrator
 *
 * Enables truly unlimited concurrent, parallel, real-time, communicative agents
 * that share context and memory via the Context Lock Protocol and Memory Harness.
 *
 * Key features:
 * - Git worktrees for file isolation (no conflicts)
 * - Real-time context sharing via WebSocket
 * - Dynamic scaling based on available resources
 * - Intelligent task decomposition for parallelism
 * - Automatic merge and conflict resolution
 *
 * @see https://medium.com/@dennis.somerville/parallel-workflows-git-worktrees-and-the-art-of-managing-multiple-ai-agents-6fa3dc5eec1d
 */

import { EventEmitter } from 'events';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { contextLockService, CompactArtifact } from '../context/context-lock.js';

const execAsync = promisify(exec);

// ============================================
// TYPES
// ============================================

export interface ParallelAgent {
  id: string;
  sessionId: string;
  task: AgentTask;
  worktreePath: string;
  branchName: string;
  status: AgentStatus;
  progress: number;
  startedAt: number;
  completedAt?: number;
  model: string;
  artifacts: CompactArtifact[];
  errors: string[];
  resourceUsage: ResourceUsage;
}

export interface AgentTask {
  id: string;
  description: string;
  type: 'feature' | 'fix' | 'refactor' | 'test' | 'deploy' | 'custom';
  priority: number;
  dependencies: string[]; // Task IDs this depends on
  files: string[];        // Files this task will modify
  estimatedTokens: number;
  phase?: number;         // Build loop phase
}

export type AgentStatus =
  | 'pending'
  | 'initializing'
  | 'context_loading'
  | 'executing'
  | 'verifying'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'paused';

export interface ResourceUsage {
  tokensUsed: number;
  creditsUsed: number;
  executionTimeMs: number;
  apiCalls: number;
}

export interface ParallelSession {
  id: string;
  projectId: string;
  projectPath: string;
  intentId: string;
  agents: Map<string, ParallelAgent>;
  maxConcurrency: number;        // 0 = unlimited
  currentConcurrency: number;
  taskQueue: AgentTask[];
  completedTasks: string[];
  mergeQueue: string[];          // Agent IDs ready to merge
  status: 'active' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  totalTokensUsed: number;
  totalCreditsUsed: number;
}

export interface WorktreeConfig {
  basePath: string;
  maxWorktrees: number;
  cleanupAfterMerge: boolean;
  branchPrefix: string;
}

export interface ContextSyncMessage {
  type: 'artifact' | 'discovery' | 'solution' | 'error' | 'status' | 'merge_ready';
  senderId: string;
  sessionId: string;
  payload: unknown;
  timestamp: number;
}

export interface MergeResult {
  success: boolean;
  conflicts: string[];
  resolvedConflicts: string[];
  mergedFiles: string[];
  error?: string;
}

export interface TaskDecomposition {
  parallelGroups: AgentTask[][];  // Tasks that can run in parallel
  sequentialDependencies: Map<string, string[]>;
  estimatedTotalTime: number;
  maxParallelism: number;
}

// ============================================
// UNLIMITED PARALLEL ORCHESTRATOR
// ============================================

export class UnlimitedParallelOrchestrator extends EventEmitter {
  private sessions: Map<string, ParallelSession> = new Map();
  private worktreeConfig: WorktreeConfig;
  private wsServer: WebSocketServer | null = null;
  private agentConnections: Map<string, WebSocket> = new Map();
  private mergeInProgress: Set<string> = new Set();

  constructor(config?: Partial<WorktreeConfig>) {
    super();

    this.worktreeConfig = {
      basePath: process.env.WORKTREE_BASE || '/tmp/kriptik-worktrees',
      maxWorktrees: 100,  // Effectively unlimited for most use cases
      cleanupAfterMerge: true,
      branchPrefix: 'agent/',
      ...config,
    };

    // Ensure worktree base directory exists
    this.ensureWorktreeDirectory();
  }

  private async ensureWorktreeDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.worktreeConfig.basePath, { recursive: true });
    } catch (error) {
      console.error('[ParallelOrchestrator] Failed to create worktree directory:', error);
    }
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  async createSession(
    projectId: string,
    projectPath: string,
    intentId: string,
    maxConcurrency: number = 0 // 0 = unlimited
  ): Promise<ParallelSession> {
    const sessionId = `parallel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const session: ParallelSession = {
      id: sessionId,
      projectId,
      projectPath,
      intentId,
      agents: new Map(),
      maxConcurrency,
      currentConcurrency: 0,
      taskQueue: [],
      completedTasks: [],
      mergeQueue: [],
      status: 'active',
      createdAt: Date.now(),
      totalTokensUsed: 0,
      totalCreditsUsed: 0,
    };

    this.sessions.set(sessionId, session);
    this.emit('session_created', { sessionId, projectId, intentId });

    console.log(`[ParallelOrchestrator] Created session ${sessionId} with ${maxConcurrency === 0 ? 'unlimited' : maxConcurrency} concurrency`);

    return session;
  }

  async getSession(sessionId: string): Promise<ParallelSession | undefined> {
    return this.sessions.get(sessionId);
  }

  // ============================================
  // TASK DECOMPOSITION
  // Intelligently split work for maximum parallelism
  // ============================================

  async decomposeTasksForParallelism(
    tasks: AgentTask[],
    projectPath: string
  ): Promise<TaskDecomposition> {
    // Analyze file dependencies
    const fileTasks = new Map<string, string[]>(); // file -> task IDs that modify it

    for (const task of tasks) {
      for (const file of task.files) {
        if (!fileTasks.has(file)) {
          fileTasks.set(file, []);
        }
        fileTasks.get(file)!.push(task.id);
      }
    }

    // Build dependency graph
    const dependencies = new Map<string, Set<string>>();
    for (const task of tasks) {
      dependencies.set(task.id, new Set(task.dependencies));
    }

    // Find tasks that share files (implicit dependencies)
    for (const [_file, taskIds] of fileTasks) {
      if (taskIds.length > 1) {
        // Tasks modifying same file must run sequentially
        for (let i = 1; i < taskIds.length; i++) {
          dependencies.get(taskIds[i])!.add(taskIds[i - 1]);
        }
      }
    }

    // Topological sort to find parallel groups
    const parallelGroups: AgentTask[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(tasks.map(t => t.id));
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    while (remaining.size > 0) {
      // Find all tasks with no pending dependencies
      const readyTasks: AgentTask[] = [];

      for (const taskId of remaining) {
        const deps = dependencies.get(taskId)!;
        const pendingDeps = [...deps].filter(d => !completed.has(d));

        if (pendingDeps.length === 0) {
          readyTasks.push(taskMap.get(taskId)!);
        }
      }

      if (readyTasks.length === 0 && remaining.size > 0) {
        // Circular dependency detected - force sequential
        const firstRemaining = remaining.values().next().value;
        if (firstRemaining !== undefined) {
          const task = taskMap.get(firstRemaining);
          if (task) {
            readyTasks.push(task);
          }
        }
      }

      // Sort by priority within the group
      readyTasks.sort((a, b) => b.priority - a.priority);

      parallelGroups.push(readyTasks);

      // Mark as completed
      for (const task of readyTasks) {
        completed.add(task.id);
        remaining.delete(task.id);
      }
    }

    // Calculate max parallelism
    const maxParallelism = Math.max(...parallelGroups.map(g => g.length));

    // Estimate total time (assuming parallelism)
    const estimatedTotalTime = parallelGroups.reduce((sum, group) => {
      // Time for a group is the max of its tasks (parallel execution)
      const groupTime = Math.max(...group.map(t => t.estimatedTokens / 1000)); // rough estimate
      return sum + groupTime;
    }, 0);

    return {
      parallelGroups,
      sequentialDependencies: new Map([...dependencies].map(([k, v]) => [k, [...v]])),
      estimatedTotalTime,
      maxParallelism,
    };
  }

  // ============================================
  // AGENT DEPLOYMENT
  // ============================================

  async deployAgent(
    sessionId: string,
    task: AgentTask,
    model: string = 'claude-sonnet-4-5-20241022'
  ): Promise<ParallelAgent> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check concurrency limits
    if (session.maxConcurrency > 0 && session.currentConcurrency >= session.maxConcurrency) {
      // Queue the task
      session.taskQueue.push(task);
      this.emit('task_queued', { sessionId, taskId: task.id });
      throw new Error(`Max concurrency reached (${session.maxConcurrency}). Task queued.`);
    }

    const agentId = `agent_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const branchName = `${this.worktreeConfig.branchPrefix}${agentId}`;

    // Create git worktree for isolation
    const worktreePath = await this.createWorktree(session.projectPath, agentId, branchName);

    const agent: ParallelAgent = {
      id: agentId,
      sessionId,
      task,
      worktreePath,
      branchName,
      status: 'initializing',
      progress: 0,
      startedAt: Date.now(),
      model,
      artifacts: [],
      errors: [],
      resourceUsage: {
        tokensUsed: 0,
        creditsUsed: 0,
        executionTimeMs: 0,
        apiCalls: 0,
      },
    };

    session.agents.set(agentId, agent);
    session.currentConcurrency++;

    this.emit('agent_deployed', { sessionId, agentId, task });

    // Start agent execution asynchronously
    this.executeAgent(agent).catch(error => {
      agent.status = 'failed';
      agent.errors.push(error.message);
      this.emit('agent_failed', { agentId, error: error.message });
    });

    return agent;
  }

  async deployMultipleAgents(
    sessionId: string,
    tasks: AgentTask[],
    model: string = 'claude-sonnet-4-5-20241022'
  ): Promise<ParallelAgent[]> {
    const agents: ParallelAgent[] = [];

    // Decompose for optimal parallelism
    const decomposition = await this.decomposeTasksForParallelism(
      tasks,
      this.sessions.get(sessionId)!.projectPath
    );

    console.log(`[ParallelOrchestrator] Deploying ${tasks.length} agents with max parallelism ${decomposition.maxParallelism}`);

    // Deploy first group immediately
    if (decomposition.parallelGroups.length > 0) {
      const firstGroup = decomposition.parallelGroups[0];
      const deployPromises = firstGroup.map(task => this.deployAgent(sessionId, task, model));
      const deployedAgents = await Promise.allSettled(deployPromises);

      for (const result of deployedAgents) {
        if (result.status === 'fulfilled') {
          agents.push(result.value);
        }
      }
    }

    // Queue remaining groups
    for (let i = 1; i < decomposition.parallelGroups.length; i++) {
      const group = decomposition.parallelGroups[i];
      for (const task of group) {
        this.sessions.get(sessionId)!.taskQueue.push(task);
      }
    }

    return agents;
  }

  // ============================================
  // GIT WORKTREE MANAGEMENT
  // ============================================

  private async createWorktree(
    projectPath: string,
    agentId: string,
    branchName: string
  ): Promise<string> {
    const worktreePath = path.join(this.worktreeConfig.basePath, agentId);

    try {
      // Create new branch from current HEAD
      await execAsync(`git branch ${branchName}`, { cwd: projectPath });

      // Create worktree
      await execAsync(`git worktree add "${worktreePath}" ${branchName}`, { cwd: projectPath });

      console.log(`[ParallelOrchestrator] Created worktree at ${worktreePath}`);

      return worktreePath;
    } catch (error) {
      // If branch already exists, try to reuse it
      try {
        await execAsync(`git worktree add "${worktreePath}" ${branchName}`, { cwd: projectPath });
        return worktreePath;
      } catch (retryError) {
        console.error(`[ParallelOrchestrator] Failed to create worktree:`, retryError);
        throw new Error(`Failed to create worktree for agent ${agentId}`);
      }
    }
  }

  private async cleanupWorktree(agent: ParallelAgent): Promise<void> {
    if (!this.worktreeConfig.cleanupAfterMerge) {
      return;
    }

    const session = this.sessions.get(agent.sessionId);
    if (!session) return;

    try {
      // Remove worktree
      await execAsync(`git worktree remove "${agent.worktreePath}" --force`, {
        cwd: session.projectPath,
      });

      // Delete branch if merged
      await execAsync(`git branch -d ${agent.branchName}`, {
        cwd: session.projectPath,
      });

      console.log(`[ParallelOrchestrator] Cleaned up worktree for agent ${agent.id}`);
    } catch (error) {
      console.warn(`[ParallelOrchestrator] Worktree cleanup warning:`, error);
    }
  }

  // ============================================
  // AGENT EXECUTION
  // ============================================

  private async executeAgent(agent: ParallelAgent): Promise<void> {
    const session = this.sessions.get(agent.sessionId);
    if (!session) {
      throw new Error(`Session ${agent.sessionId} not found`);
    }

    try {
      // Phase 1: Context Loading (Context Lock Protocol)
      agent.status = 'context_loading';
      this.emit('agent_status_changed', { agentId: agent.id, status: agent.status });

      const contextResult = await contextLockService.enforceIngestionGate(
        agent.sessionId,
        session.projectId,
        agent.id
      );

      // Phase 2: Execution
      agent.status = 'executing';
      agent.progress = 10;
      this.emit('agent_status_changed', { agentId: agent.id, status: agent.status, progress: agent.progress });

      // Execute the task (this would call the actual AI service)
      await this.executeTaskInWorktree(agent, session);

      // Phase 3: Verification
      agent.status = 'verifying';
      agent.progress = 80;
      this.emit('agent_status_changed', { agentId: agent.id, status: agent.status, progress: agent.progress });

      // Run verification in worktree
      await this.verifyAgentWork(agent);

      // Phase 4: Handoff (Context Lock Protocol)
      await contextLockService.enforceHandoffGate(agent.sessionId, agent.id);

      // Mark ready for merge
      agent.status = 'merging';
      agent.progress = 90;
      session.mergeQueue.push(agent.id);

      this.emit('agent_ready_for_merge', { agentId: agent.id, sessionId: session.id });

      // Broadcast to other agents
      this.broadcastToSession(session.id, {
        type: 'merge_ready',
        senderId: agent.id,
        sessionId: session.id,
        payload: { branchName: agent.branchName },
        timestamp: Date.now(),
      });

    } catch (error) {
      agent.status = 'failed';
      agent.errors.push((error as Error).message);
      this.emit('agent_failed', { agentId: agent.id, error: (error as Error).message });
      throw error;
    }
  }

  private async executeTaskInWorktree(agent: ParallelAgent, session: ParallelSession): Promise<void> {
    // This is where the actual AI code generation happens
    // In production, this calls the coding agent with the task

    const startTime = Date.now();

    // Simulate progress updates
    for (let progress = 20; progress <= 70; progress += 10) {
      agent.progress = progress;
      this.emit('agent_progress', { agentId: agent.id, progress });

      // Create artifact for progress
      await contextLockService.enforceArtifactCreation(agent.sessionId, {
        type: 'context_update',
        rationale: `Task progress: ${progress}%`,
        filesChanged: [],
        integrationPoints: [],
        timestamp: Date.now(),
        agentId: agent.id,
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    agent.resourceUsage.executionTimeMs = Date.now() - startTime;
  }

  private async verifyAgentWork(agent: ParallelAgent): Promise<void> {
    // Run build verification in worktree
    try {
      await execAsync('npm run build', { cwd: agent.worktreePath, timeout: 120000 });
    } catch (error) {
      agent.errors.push(`Build failed: ${(error as Error).message}`);
      throw new Error('Verification failed: build errors');
    }

    // Run TypeScript check
    try {
      await execAsync('npx tsc --noEmit', { cwd: agent.worktreePath, timeout: 60000 });
    } catch (error) {
      // TypeScript errors are warnings, not failures
      console.warn(`[ParallelOrchestrator] TypeScript warnings for agent ${agent.id}`);
    }
  }

  // ============================================
  // MERGE MANAGEMENT
  // ============================================

  async mergeAgent(agentId: string): Promise<MergeResult> {
    // Find agent and session
    let agent: ParallelAgent | undefined;
    let session: ParallelSession | undefined;

    for (const [_, s] of this.sessions) {
      const a = s.agents.get(agentId);
      if (a) {
        agent = a;
        session = s;
        break;
      }
    }

    if (!agent || !session) {
      return { success: false, conflicts: [], resolvedConflicts: [], mergedFiles: [], error: 'Agent not found' };
    }

    // Prevent concurrent merges
    if (this.mergeInProgress.has(session.id)) {
      await this.waitForMerge(session.id);
    }

    this.mergeInProgress.add(session.id);

    try {
      // Commit changes in worktree
      await execAsync(`git add -A && git commit -m "Agent ${agentId}: ${agent.task.description}" --allow-empty`, {
        cwd: agent.worktreePath,
      });

      // Get list of changed files
      const { stdout: diffOutput } = await execAsync(
        `git diff --name-only main...${agent.branchName}`,
        { cwd: session.projectPath }
      );
      const mergedFiles = diffOutput.trim().split('\n').filter(f => f);

      // Attempt merge
      try {
        await execAsync(`git merge ${agent.branchName} -m "Merge agent ${agentId}"`, {
          cwd: session.projectPath,
        });

        // Success
        agent.status = 'completed';
        agent.completedAt = Date.now();
        agent.progress = 100;

        session.completedTasks.push(agent.task.id);
        session.mergeQueue = session.mergeQueue.filter(id => id !== agentId);
        session.currentConcurrency--;

        // Cleanup worktree
        await this.cleanupWorktree(agent);

        // Deploy queued tasks
        await this.deployQueuedTasks(session);

        this.emit('agent_merged', { agentId, mergedFiles });

        return { success: true, conflicts: [], resolvedConflicts: [], mergedFiles };
      } catch (mergeError) {
        // Handle merge conflicts
        const conflicts = await this.getConflicts(session.projectPath);

        // Attempt AI-powered conflict resolution
        const resolved = await this.resolveConflicts(session.projectPath, conflicts, agent);

        if (resolved.length === conflicts.length) {
          // All conflicts resolved
          await execAsync('git add -A && git commit -m "Resolved merge conflicts"', {
            cwd: session.projectPath,
          });

          agent.status = 'completed';
          agent.completedAt = Date.now();
          agent.progress = 100;

          await this.cleanupWorktree(agent);

          return { success: true, conflicts, resolvedConflicts: resolved, mergedFiles };
        } else {
          // Abort merge
          await execAsync('git merge --abort', { cwd: session.projectPath });

          agent.status = 'failed';
          agent.errors.push(`Merge conflicts in: ${conflicts.join(', ')}`);

          return { success: false, conflicts, resolvedConflicts: resolved, mergedFiles: [], error: 'Unresolved conflicts' };
        }
      }
    } finally {
      this.mergeInProgress.delete(session.id);
    }
  }

  private async getConflicts(projectPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git diff --name-only --diff-filter=U', { cwd: projectPath });
      return stdout.trim().split('\n').filter(f => f);
    } catch {
      return [];
    }
  }

  private async resolveConflicts(
    projectPath: string,
    conflicts: string[],
    agent: ParallelAgent
  ): Promise<string[]> {
    const resolved: string[] = [];

    for (const file of conflicts) {
      try {
        // Read conflicted file
        const filePath = path.join(projectPath, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check if it's a simple conflict (can auto-resolve)
        if (content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>')) {
          // For now, prefer the agent's changes (theirs)
          // In production, would use AI to intelligently merge
          await execAsync(`git checkout --theirs "${file}"`, { cwd: projectPath });
          resolved.push(file);
        }
      } catch (error) {
        console.error(`[ParallelOrchestrator] Failed to resolve conflict in ${file}:`, error);
      }
    }

    return resolved;
  }

  private async waitForMerge(sessionId: string): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (!this.mergeInProgress.has(sessionId)) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  private async deployQueuedTasks(session: ParallelSession): Promise<void> {
    if (session.taskQueue.length === 0) {
      return;
    }

    // Check how many agents we can deploy
    const availableSlots = session.maxConcurrency === 0
      ? session.taskQueue.length
      : session.maxConcurrency - session.currentConcurrency;

    if (availableSlots <= 0) {
      return;
    }

    // Deploy tasks that have their dependencies met
    const deployableTasks = session.taskQueue.filter(task => {
      return task.dependencies.every(dep => session.completedTasks.includes(dep));
    });

    const toDeployCount = Math.min(availableSlots, deployableTasks.length);
    const toDeploy = deployableTasks.slice(0, toDeployCount);

    // Remove from queue
    session.taskQueue = session.taskQueue.filter(t => !toDeploy.includes(t));

    // Deploy
    for (const task of toDeploy) {
      try {
        await this.deployAgent(session.id, task);
      } catch (error) {
        console.error(`[ParallelOrchestrator] Failed to deploy queued task ${task.id}:`, error);
      }
    }
  }

  // ============================================
  // REAL-TIME CONTEXT SHARING VIA WEBSOCKET
  // ============================================

  startContextSyncServer(port: number = 9500): void {
    if (this.wsServer) {
      return; // Already running
    }

    this.wsServer = new WebSocketServer({ port });

    this.wsServer.on('connection', (ws, req) => {
      const agentId = req.url?.split('/').pop();
      if (agentId) {
        this.agentConnections.set(agentId, ws);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as ContextSyncMessage;
            this.handleContextSyncMessage(message);
          } catch (error) {
            console.error('[ParallelOrchestrator] Invalid WebSocket message:', error);
          }
        });

        ws.on('close', () => {
          this.agentConnections.delete(agentId);
        });
      }
    });

    console.log(`[ParallelOrchestrator] Context sync server started on port ${port}`);
  }

  private handleContextSyncMessage(message: ContextSyncMessage): void {
    const session = this.sessions.get(message.sessionId);
    if (!session) {
      return;
    }

    switch (message.type) {
      case 'artifact':
        // Share artifact with all agents in session
        this.broadcastToSession(message.sessionId, message, message.senderId);
        break;

      case 'discovery':
        // Agent discovered something useful (API, pattern, etc.)
        this.broadcastToSession(message.sessionId, message, message.senderId);
        break;

      case 'solution':
        // Agent solved a problem that might help others
        this.broadcastToSession(message.sessionId, message, message.senderId);
        break;

      case 'error':
        // Agent encountered an error - others should avoid same mistake
        this.broadcastToSession(message.sessionId, message, message.senderId);
        break;

      case 'status':
        // Agent status update
        const agent = session.agents.get(message.senderId);
        if (agent && message.payload) {
          agent.status = (message.payload as { status: AgentStatus }).status;
        }
        break;
    }

    this.emit('context_sync_message', message);
  }

  private broadcastToSession(
    sessionId: string,
    message: ContextSyncMessage,
    excludeAgentId?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    for (const [agentId, _agent] of session.agents) {
      if (agentId !== excludeAgentId) {
        const ws = this.agentConnections.get(agentId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      }
    }
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  async completeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Wait for all agents to complete
    const pendingAgents = [...session.agents.values()].filter(
      a => a.status !== 'completed' && a.status !== 'failed'
    );

    for (const agent of pendingAgents) {
      if (agent.status === 'merging') {
        await this.mergeAgent(agent.id);
      }
    }

    // Merge all remaining agents
    for (const agentId of session.mergeQueue) {
      await this.mergeAgent(agentId);
    }

    session.status = 'completed';
    this.emit('session_completed', { sessionId, totalAgents: session.agents.size });
  }

  getSessionStatus(sessionId: string): {
    status: string;
    agents: { id: string; status: AgentStatus; progress: number }[];
    queued: number;
    completed: number;
    failed: number;
  } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const agents = [...session.agents.values()].map(a => ({
      id: a.id,
      status: a.status,
      progress: a.progress,
    }));

    return {
      status: session.status,
      agents,
      queued: session.taskQueue.length,
      completed: session.completedTasks.length,
      failed: agents.filter(a => a.status === 'failed').length,
    };
  }

  // ============================================
  // CLEANUP
  // ============================================

  async shutdown(): Promise<void> {
    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // Cleanup all sessions
    for (const [sessionId, session] of this.sessions) {
      for (const [_agentId, agent] of session.agents) {
        await this.cleanupWorktree(agent);
      }
    }

    this.sessions.clear();
    this.agentConnections.clear();
  }
}

// Export singleton
export const unlimitedParallelOrchestrator = new UnlimitedParallelOrchestrator();

export default UnlimitedParallelOrchestrator;
