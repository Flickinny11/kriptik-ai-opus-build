/**
 * Ghost Mode Controller - Autonomous Background Building
 *
 * Enables KripTik AI to continue building while the user is away.
 * Features persistent sessions, smart checkpointing, failure recovery,
 * and "wake me if..." conditions.
 *
 * F048: Ghost Mode Controller
 */

// @ts-nocheck - Pending full schema alignment
import { db } from '../../db.js';
import { eq, and, desc, gt, lt, isNull } from 'drizzle-orm';
import {
  developerModeSessions,
  developerModeAgents,
  developerModeAgentLogs,
  buildCheckpoints,
  projects,
  orchestrationRuns
} from '../../schema.js';
import { v4 as uuidv4 } from 'uuid';
import { getOpenRouterClient } from '../ai/openrouter-client.js';
import { createTimeMachine } from '../checkpoints/time-machine.js';
import { createSoftInterruptManager } from '../soft-interrupt/index.js';
import { getNotificationService } from '../notifications/notification-service.js';
import type { NotificationType, NotificationChannel } from '../notifications/notification-service.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Ghost Mode session states
 */
export type GhostSessionState =
  | 'idle'              // Not running
  | 'active'            // Running autonomously
  | 'paused'            // User requested pause
  | 'waiting_approval'  // Needs user approval for something
  | 'error_recovery'    // Handling an error
  | 'completed'         // Task finished
  | 'wake_triggered';   // Wake condition met

/**
 * Wake condition types
 */
export type WakeConditionType =
  | 'completion'        // Wake when task is done
  | 'error'             // Wake on any error
  | 'critical_error'    // Wake on critical errors only
  | 'decision_needed'   // Wake when AI needs human decision
  | 'cost_threshold'    // Wake when credits reach threshold
  | 'time_elapsed'      // Wake after specific time
  | 'feature_complete'  // Wake when specific feature is done
  | 'quality_threshold' // Wake when quality score drops below threshold
  | 'custom';           // Custom condition

/**
 * Wake condition definition
 */
export interface WakeCondition {
  id: string;
  type: WakeConditionType;
  description: string;
  threshold?: number;
  featureId?: string;
  customCheck?: string;
  priority: 'high' | 'normal' | 'low';
  notificationChannels: NotificationChannel[];
}

/**
 * Notification channels for wake alerts
 */
export type NotificationChannel = 'email' | 'sms' | 'slack' | 'discord' | 'webhook' | 'push';

/**
 * Ghost session configuration
 */
export interface GhostSessionConfig {
  sessionId: string;
  projectId: string;
  userId: string;
  tasks: GhostTask[];
  wakeConditions: WakeCondition[];
  maxRuntime: number; // Maximum runtime in minutes
  maxCredits: number; // Maximum credits to spend
  checkpointInterval: number; // Minutes between checkpoints
  retryPolicy: RetryPolicy;
  pauseOnFirstError: boolean;
  autonomyLevel: 'conservative' | 'moderate' | 'aggressive';
}

/**
 * Ghost task definition
 */
export interface GhostTask {
  id: string;
  description: string;
  priority: number;
  estimatedCredits: number;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Retry policy for errors
 */
export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

/**
 * Ghost session event
 */
export interface GhostEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: GhostEventType;
  data: Record<string, unknown>;
  description: string;
}

/**
 * Ghost event types for replay
 */
export type GhostEventType =
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_completed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'checkpoint_created'
  | 'error_occurred'
  | 'error_recovered'
  | 'wake_condition_triggered'
  | 'decision_required'
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'agent_deployed'
  | 'agent_completed'
  | 'code_generated'
  | 'test_run'
  | 'build_started'
  | 'build_completed';

/**
 * Ghost session summary for display
 */
export interface GhostSessionSummary {
  sessionId: string;
  state: GhostSessionState;
  progress: {
    tasksCompleted: number;
    totalTasks: number;
    percentage: number;
  };
  runtime: number;
  creditsUsed: number;
  eventsCount: number;
  lastActivity: Date;
  currentTask?: GhostTask;
  pendingDecisions: string[];
}

// =============================================================================
// GHOST MODE CONTROLLER
// =============================================================================

export class GhostModeController {
  private openRouterClient = getOpenRouterClient();
  private timeMachine = createTimeMachine();
  private interruptManager = createSoftInterruptManager();
  private notificationService = getNotificationService();

  private activeSessions: Map<string, GhostSessionRuntime> = new Map();
  private eventStore: Map<string, GhostEvent[]> = new Map();
  private eventSubscribers: Map<string, ((event: GhostEvent) => void)[]> = new Map();

  // Default retry policy
  private readonly DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    retryableErrors: ['timeout', 'rate_limit', 'temporary_failure', 'network_error']
  };

  // =============================================================================
  // SESSION MANAGEMENT
  // =============================================================================

  /**
   * Start a new Ghost Mode session
   */
  async startSession(config: GhostSessionConfig): Promise<string> {
    // Validate configuration
    this.validateConfig(config);

    // Create session in database
    const session = await db.insert(developerModeSessions).values({
      id: config.sessionId,
      projectId: config.projectId,
      userId: config.userId,
      status: 'active',
      mode: 'ghost',
      startedAt: new Date(),
      config: JSON.stringify({
        tasks: config.tasks,
        wakeConditions: config.wakeConditions,
        maxRuntime: config.maxRuntime,
        maxCredits: config.maxCredits,
        checkpointInterval: config.checkpointInterval,
        retryPolicy: config.retryPolicy,
        autonomyLevel: config.autonomyLevel
      })
    }).returning();

    // Initialize runtime
    const runtime: GhostSessionRuntime = {
      sessionId: config.sessionId,
      config,
      state: 'active',
      startTime: Date.now(),
      creditsUsed: 0,
      taskIndex: 0,
      retryCount: 0,
      lastCheckpointTime: Date.now(),
      events: [],
      timers: {
        checkpointTimer: null,
        runtimeTimer: null
      }
    };

    this.activeSessions.set(config.sessionId, runtime);
    this.eventStore.set(config.sessionId, []);

    // Record start event
    await this.recordEvent(config.sessionId, 'session_started', {
      config: config,
      projectId: config.projectId
    }, 'Ghost Mode session started');

    // Create initial checkpoint
    await this.createCheckpoint(config.sessionId, 'session_start');

    // Start the execution loop
    this.executeSessionLoop(config.sessionId);

    // Set up periodic checkpoint timer
    runtime.timers.checkpointTimer = setInterval(
      () => this.createCheckpoint(config.sessionId, 'periodic'),
      config.checkpointInterval * 60 * 1000
    );

    // Set up max runtime timer
    runtime.timers.runtimeTimer = setTimeout(
      () => this.handleMaxRuntimeReached(config.sessionId),
      config.maxRuntime * 60 * 1000
    );

    return config.sessionId;
  }

  /**
   * Pause a Ghost Mode session
   */
  async pauseSession(sessionId: string, reason?: string): Promise<void> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime) {
      throw new Error(`Session ${sessionId} not found`);
    }

    runtime.state = 'paused';

    await db.update(developerModeSessions)
      .set({ status: 'paused' })
      .where(eq(developerModeSessions.id, sessionId));

    // Create checkpoint before pausing
    await this.createCheckpoint(sessionId, 'manual_pause');

    await this.recordEvent(sessionId, 'session_paused', { reason },
      `Session paused${reason ? `: ${reason}` : ''}`);
  }

  /**
   * Resume a paused Ghost Mode session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime) {
      // Try to restore from database
      const session = await db.query.developerModeSessions.findFirst({
        where: eq(developerModeSessions.id, sessionId)
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Restore runtime from saved config
      const config = JSON.parse(session.config || '{}');
      const restoredRuntime: GhostSessionRuntime = {
        sessionId,
        config: {
          sessionId,
          projectId: session.projectId,
          userId: session.userId,
          ...config
        },
        state: 'active',
        startTime: new Date(session.startedAt || Date.now()).getTime(),
        creditsUsed: 0, // Would need to calculate from transactions
        taskIndex: 0, // Would need to restore from events
        retryCount: 0,
        lastCheckpointTime: Date.now(),
        events: [],
        timers: { checkpointTimer: null, runtimeTimer: null }
      };

      this.activeSessions.set(sessionId, restoredRuntime);
    }

    const activeRuntime = this.activeSessions.get(sessionId)!;
    activeRuntime.state = 'active';

    await db.update(developerModeSessions)
      .set({ status: 'active' })
      .where(eq(developerModeSessions.id, sessionId));

    await this.recordEvent(sessionId, 'session_resumed', {}, 'Session resumed');

    // Restart execution loop
    this.executeSessionLoop(sessionId);
  }

  /**
   * Stop a Ghost Mode session
   */
  async stopSession(sessionId: string, reason?: string): Promise<GhostSessionSummary> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Clear timers
    if (runtime.timers.checkpointTimer) {
      clearInterval(runtime.timers.checkpointTimer);
    }
    if (runtime.timers.runtimeTimer) {
      clearTimeout(runtime.timers.runtimeTimer);
    }

    runtime.state = 'completed';

    // Final checkpoint
    await this.createCheckpoint(sessionId, 'session_end');

    await db.update(developerModeSessions)
      .set({
        status: 'completed',
        completedAt: new Date()
      })
      .where(eq(developerModeSessions.id, sessionId));

    await this.recordEvent(sessionId, 'session_completed', { reason },
      `Session completed${reason ? `: ${reason}` : ''}`);

    // Generate summary
    const summary = await this.getSessionSummary(sessionId);

    // Clean up runtime
    this.activeSessions.delete(sessionId);

    return summary;
  }

  // =============================================================================
  // EXECUTION LOOP
  // =============================================================================

  /**
   * Main execution loop for Ghost Mode
   */
  private async executeSessionLoop(sessionId: string): Promise<void> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime || runtime.state !== 'active') {
      return;
    }

    while (runtime.state === 'active' && runtime.taskIndex < runtime.config.tasks.length) {
      const task = runtime.config.tasks[runtime.taskIndex];

      // Check wake conditions before each task
      const triggeredCondition = await this.checkWakeConditions(sessionId);
      if (triggeredCondition) {
        await this.handleWakeCondition(sessionId, triggeredCondition);
        return;
      }

      // Check if dependencies are met
      if (!this.areDependenciesMet(task, runtime.config.tasks)) {
        runtime.taskIndex++;
        continue;
      }

      // Execute task
      try {
        task.status = 'in_progress';
        task.startedAt = new Date();

        await this.recordEvent(sessionId, 'task_started', {
          taskId: task.id,
          description: task.description
        }, `Starting task: ${task.description}`);

        await this.executeTask(sessionId, task);

        task.status = 'completed';
        task.completedAt = new Date();

        await this.recordEvent(sessionId, 'task_completed', {
          taskId: task.id
        }, `Completed task: ${task.description}`);

        runtime.retryCount = 0; // Reset retry count on success

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        task.error = errorMessage;

        await this.recordEvent(sessionId, 'task_failed', {
          taskId: task.id,
          error: errorMessage
        }, `Task failed: ${errorMessage}`);

        // Handle error based on retry policy
        if (await this.handleTaskError(sessionId, task, error)) {
          continue; // Retry the task
        }

        task.status = 'failed';

        if (runtime.config.pauseOnFirstError) {
          runtime.state = 'error_recovery';
          await this.triggerWake(sessionId, {
            id: uuidv4(),
            type: 'error',
            description: `Task failed: ${errorMessage}`,
            priority: 'high',
            notificationChannels: ['email']
          });
          return;
        }
      }

      runtime.taskIndex++;

      // Small delay between tasks
      await this.delay(500);
    }

    // All tasks completed
    if (runtime.state === 'active') {
      await this.stopSession(sessionId, 'All tasks completed');
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(sessionId: string, task: GhostTask): Promise<void> {
    const runtime = this.activeSessions.get(sessionId)!;

    // Determine execution strategy based on autonomy level
    const strategy = this.getExecutionStrategy(runtime.config.autonomyLevel, task);

    // Create an agent for the task
    const agentId = uuidv4();

    await db.insert(developerModeAgents).values({
      id: agentId,
      sessionId,
      name: `Ghost Agent - ${task.description.substring(0, 30)}`,
      taskDescription: task.description,
      model: strategy.model,
      verificationLevel: strategy.verificationLevel,
      status: 'active',
      currentPhase: 'initializing',
      branch: `ghost/${sessionId}/${task.id}`,
      startedAt: new Date()
    });

    await this.recordEvent(sessionId, 'agent_deployed', {
      agentId,
      taskId: task.id,
      model: strategy.model
    }, `Deployed agent for: ${task.description}`);

    // Execute using the appropriate AI model
    const result = await this.openRouterClient.chat({
      model: strategy.model,
      messages: [{
        role: 'system',
        content: this.buildAgentSystemPrompt(runtime.config, task)
      }, {
        role: 'user',
        content: task.description
      }],
      max_tokens: strategy.maxTokens,
      temperature: strategy.temperature
    });

    // Update agent status
    await db.update(developerModeAgents)
      .set({
        status: 'completed',
        currentPhase: 'completed',
        completedAt: new Date()
      })
      .where(eq(developerModeAgents.id, agentId));

    await this.recordEvent(sessionId, 'agent_completed', {
      agentId,
      taskId: task.id
    }, `Agent completed task`);

    // Track credits used (simplified - would need actual token counting)
    const creditsUsed = this.estimateCredits(strategy.model, result.usage?.total_tokens || 0);
    runtime.creditsUsed += creditsUsed;

    // Check credit threshold
    if (runtime.creditsUsed >= runtime.config.maxCredits) {
      runtime.state = 'paused';
      await this.triggerWake(sessionId, {
        id: uuidv4(),
        type: 'cost_threshold',
        description: `Credit threshold reached: ${runtime.creditsUsed}`,
        threshold: runtime.config.maxCredits,
        priority: 'high',
        notificationChannels: ['email']
      });
    }
  }

  /**
   * Get execution strategy based on autonomy level
   */
  private getExecutionStrategy(
    level: 'conservative' | 'moderate' | 'aggressive',
    _task: GhostTask
  ): {
    model: string;
    maxTokens: number;
    temperature: number;
    verificationLevel: string;
  } {
    switch (level) {
      case 'conservative':
        return {
          model: 'anthropic/claude-3.5-haiku',
          maxTokens: 4096,
          temperature: 0.3,
          verificationLevel: 'thorough'
        };
      case 'moderate':
        return {
          model: 'anthropic/claude-sonnet-4-20250514',
          maxTokens: 8192,
          temperature: 0.5,
          verificationLevel: 'standard'
        };
      case 'aggressive':
        return {
          model: 'anthropic/claude-opus-4-20250514',
          maxTokens: 16384,
          temperature: 0.7,
          verificationLevel: 'quick'
        };
    }
  }

  /**
   * Build system prompt for ghost agent
   */
  private buildAgentSystemPrompt(config: GhostSessionConfig, task: GhostTask): string {
    return `You are an autonomous AI agent working in "Ghost Mode" for KripTik AI.

The user is away and trusts you to continue building their application independently.

CRITICAL RULES:
1. NEVER use placeholder code, mock data, or TODO comments
2. All code must be production-ready and functional
3. Make decisions autonomously, but document your reasoning
4. If you encounter a decision that significantly impacts architecture, pause and flag it
5. Create checkpoints before making major changes
6. Test your work thoroughly before marking complete

CURRENT TASK: ${task.description}

AUTONOMY LEVEL: ${config.autonomyLevel}
- Conservative: Make safe, well-tested changes only
- Moderate: Balance speed with safety, make reasonable assumptions
- Aggressive: Move fast, prioritize completion, accept higher risk

Your decisions will be reviewed when the user returns. Document everything.`;
  }

  // =============================================================================
  // WAKE CONDITIONS
  // =============================================================================

  /**
   * Check if any wake conditions are triggered
   */
  private async checkWakeConditions(sessionId: string): Promise<WakeCondition | null> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime) return null;

    for (const condition of runtime.config.wakeConditions) {
      if (await this.isConditionMet(sessionId, condition)) {
        return condition;
      }
    }

    return null;
  }

  /**
   * Check if a specific condition is met
   */
  private async isConditionMet(sessionId: string, condition: WakeCondition): Promise<boolean> {
    const runtime = this.activeSessions.get(sessionId)!;

    switch (condition.type) {
      case 'completion':
        return runtime.taskIndex >= runtime.config.tasks.length;

      case 'cost_threshold':
        return runtime.creditsUsed >= (condition.threshold || Infinity);

      case 'time_elapsed':
        const elapsedMinutes = (Date.now() - runtime.startTime) / 60000;
        return elapsedMinutes >= (condition.threshold || Infinity);

      case 'feature_complete':
        const task = runtime.config.tasks.find(t => t.id === condition.featureId);
        return task?.status === 'completed';

      case 'quality_threshold':
        // Would integrate with quality scanner
        return false;

      case 'custom':
        // Custom conditions would be evaluated by AI
        return false;

      default:
        return false;
    }
  }

  /**
   * Handle a triggered wake condition
   */
  private async handleWakeCondition(sessionId: string, condition: WakeCondition): Promise<void> {
    const runtime = this.activeSessions.get(sessionId)!;
    runtime.state = 'wake_triggered';

    await this.recordEvent(sessionId, 'wake_condition_triggered', {
      condition
    }, `Wake condition triggered: ${condition.description}`);

    await this.triggerWake(sessionId, condition);
  }

  /**
   * Trigger wake notification
   */
  private async triggerWake(sessionId: string, condition: WakeCondition): Promise<void> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime) return;

    // Send notifications through each channel
    for (const channel of condition.notificationChannels) {
      await this.sendNotification(runtime.config.userId, channel, {
        sessionId,
        condition,
        summary: await this.getSessionSummary(sessionId)
      });
    }

    // Update session status
    await db.update(developerModeSessions)
      .set({ status: 'wake_triggered' })
      .where(eq(developerModeSessions.id, sessionId));
  }

  /**
   * Send notification through specified channel
   */
  private async sendNotification(
    userId: string,
    channel: NotificationChannel,
    data: Record<string, unknown>
  ): Promise<void> {
    const { sessionId, condition, summary } = data as {
      sessionId: string;
      condition: WakeCondition;
      summary: GhostSessionSummary;
    };

    // Build notification payload based on wake condition type
    const payload = await this.buildNotificationPayload(userId, sessionId, condition, summary);

    if (!payload) {
      console.warn(`[Ghost Mode] Failed to build notification payload for condition: ${condition.type}`);
      return;
    }

    // Send via NotificationService
    try {
      await this.notificationService.sendNotification(
        userId,
        [channel],
        payload
      );
    } catch (error) {
      console.error(`[Ghost Mode] Failed to send ${channel} notification:`, error);
    }
  }

  /**
   * Build notification payload based on wake condition type
   */
  private async buildNotificationPayload(
    userId: string,
    sessionId: string,
    condition: WakeCondition,
    summary: GhostSessionSummary
  ): Promise<any> {
    // Get project info for better notification context
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime) return null;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, runtime.config.projectId)
    });

    const projectName = project?.name || 'Your Project';
    const baseUrl = process.env.FRONTEND_URL || 'https://kriptik.app';
    const actionUrl = `${baseUrl}/projects/${runtime.config.projectId}?ghost=${sessionId}`;

    // Map wake condition type to notification type and build specific payload
    switch (condition.type) {
      case 'completion':
        return {
          type: 'build_complete' as NotificationType,
          title: `Ghost Mode Complete - ${projectName}`,
          message: `All tasks completed successfully. ${summary.progress.tasksCompleted} of ${summary.progress.totalTasks} tasks finished. Runtime: ${this.formatDuration(summary.runtime)}. Credits used: ${summary.creditsUsed.toFixed(2)}.`,
          featureAgentId: null,
          featureAgentName: 'Ghost Mode',
          actionUrl,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            tasksCompleted: summary.progress.tasksCompleted,
            creditsUsed: summary.creditsUsed,
            runtime: summary.runtime
          }
        };

      case 'error':
      case 'critical_error':
        const currentTask = summary.currentTask;
        const errorMessage = currentTask?.error || 'An error occurred during autonomous building';
        return {
          type: 'error' as NotificationType,
          title: `Ghost Mode Error - ${projectName}`,
          message: `Building paused due to error: ${errorMessage}. Task: ${currentTask?.description || 'Unknown'}. Click to review and resume.`,
          featureAgentId: null,
          featureAgentName: 'Ghost Mode',
          actionUrl: `${actionUrl}&action=review-error`,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            error: errorMessage,
            taskId: currentTask?.id,
            taskDescription: currentTask?.description,
            isCritical: condition.type === 'critical_error'
          }
        };

      case 'decision_needed':
        return {
          type: 'decision_needed' as NotificationType,
          title: `Decision Needed - ${projectName}`,
          message: `Ghost Mode needs your input to continue. ${condition.description}. Current progress: ${summary.progress.percentage}% complete.`,
          featureAgentId: null,
          featureAgentName: 'Ghost Mode',
          actionUrl: `${actionUrl}&action=make-decision`,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            decisionDescription: condition.description,
            progress: summary.progress.percentage,
            currentTask: summary.currentTask?.description
          }
        };

      case 'cost_threshold':
        const remaining = (condition.threshold || 0) - summary.creditsUsed;
        return {
          type: 'ceiling_warning' as NotificationType,
          title: `Credit Limit Reached - ${projectName}`,
          message: `Ghost Mode has used ${summary.creditsUsed.toFixed(2)} credits (limit: ${condition.threshold}). Building paused. ${remaining < 0 ? 'Limit exceeded' : `${remaining.toFixed(2)} credits remaining`}. Adjust budget or review progress.`,
          featureAgentId: null,
          featureAgentName: 'Ghost Mode',
          actionUrl: `${actionUrl}&action=adjust-budget`,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            creditsUsed: summary.creditsUsed,
            creditLimit: condition.threshold,
            progress: summary.progress.percentage
          }
        };

      case 'time_elapsed':
        return {
          type: 'build_paused' as NotificationType,
          title: `Time Limit Reached - ${projectName}`,
          message: `Ghost Mode has reached the ${condition.threshold} minute time limit. Progress: ${summary.progress.percentage}% (${summary.progress.tasksCompleted}/${summary.progress.totalTasks} tasks). Click to extend or review.`,
          featureAgentId: null,
          featureAgentName: 'Ghost Mode',
          actionUrl: `${actionUrl}&action=extend-time`,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            timeLimit: condition.threshold,
            runtime: summary.runtime,
            progress: summary.progress.percentage,
            tasksCompleted: summary.progress.tasksCompleted,
            totalTasks: summary.progress.totalTasks
          }
        };

      case 'feature_complete':
        const completedTask = runtime.config.tasks.find(t => t.id === condition.featureId);
        return {
          type: 'feature_complete' as NotificationType,
          title: `Feature Complete - ${projectName}`,
          message: `Ghost Mode completed: ${completedTask?.description || 'Feature'}. Overall progress: ${summary.progress.percentage}%. ${summary.progress.totalTasks - summary.progress.tasksCompleted} tasks remaining.`,
          featureAgentId: condition.featureId || null,
          featureAgentName: 'Ghost Mode',
          actionUrl,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            featureId: condition.featureId,
            featureDescription: completedTask?.description,
            progress: summary.progress.percentage
          }
        };

      case 'quality_threshold':
        return {
          type: 'error' as NotificationType,
          title: `Quality Alert - ${projectName}`,
          message: `Ghost Mode detected quality degradation below threshold. Building paused for review. ${condition.description}.`,
          featureAgentId: null,
          featureAgentName: 'Ghost Mode',
          actionUrl: `${actionUrl}&action=review-quality`,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            qualityThreshold: condition.threshold,
            alertDescription: condition.description
          }
        };

      default:
        return {
          type: 'build_paused' as NotificationType,
          title: `Ghost Mode Alert - ${projectName}`,
          message: condition.description,
          featureAgentId: null,
          featureAgentName: 'Ghost Mode',
          actionUrl,
          metadata: {
            sessionId,
            projectId: runtime.config.projectId,
            projectName,
            conditionType: condition.type
          }
        };
    }
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  /**
   * Handle task error with retry logic
   */
  private async handleTaskError(
    sessionId: string,
    task: GhostTask,
    error: unknown
  ): Promise<boolean> {
    const runtime = this.activeSessions.get(sessionId)!;
    const policy = runtime.config.retryPolicy || this.DEFAULT_RETRY_POLICY;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if error is retryable
    const isRetryable = policy.retryableErrors.some(e =>
      errorMessage.toLowerCase().includes(e.toLowerCase())
    );

    if (!isRetryable || runtime.retryCount >= policy.maxRetries) {
      return false;
    }

    runtime.retryCount++;

    // Calculate backoff delay
    const delay = Math.min(
      policy.initialDelayMs * Math.pow(policy.backoffMultiplier, runtime.retryCount - 1),
      policy.maxDelayMs
    );

    await this.recordEvent(sessionId, 'error_occurred', {
      taskId: task.id,
      error: errorMessage,
      retryCount: runtime.retryCount,
      delay
    }, `Error occurred, retrying in ${delay}ms (attempt ${runtime.retryCount}/${policy.maxRetries})`);

    await this.delay(delay);

    return true;
  }

  /**
   * Handle max runtime reached
   */
  private async handleMaxRuntimeReached(sessionId: string): Promise<void> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime || runtime.state !== 'active') return;

    runtime.state = 'paused';

    await this.recordEvent(sessionId, 'session_paused', {
      reason: 'max_runtime_reached'
    }, 'Maximum runtime reached, session paused');

    await this.triggerWake(sessionId, {
      id: uuidv4(),
      type: 'time_elapsed',
      description: 'Maximum runtime reached',
      threshold: runtime.config.maxRuntime,
      priority: 'normal',
      notificationChannels: ['email']
    });
  }

  // =============================================================================
  // CHECKPOINTS
  // =============================================================================

  /**
   * Create a checkpoint for the session
   */
  private async createCheckpoint(sessionId: string, type: string): Promise<void> {
    const runtime = this.activeSessions.get(sessionId);
    if (!runtime) return;

    // Use time machine service
    await this.timeMachine.createCheckpoint(
      runtime.config.projectId,
      `ghost_${sessionId}_${type}`,
      `Ghost Mode checkpoint: ${type}`
    );

    runtime.lastCheckpointTime = Date.now();

    await this.recordEvent(sessionId, 'checkpoint_created', {
      type
    }, `Checkpoint created: ${type}`);
  }

  // =============================================================================
  // EVENT RECORDING
  // =============================================================================

  /**
   * Record a Ghost Mode event
   */
  async recordEvent(
    sessionId: string,
    type: GhostEventType,
    data: Record<string, unknown>,
    description: string
  ): Promise<void> {
    const event: GhostEvent = {
      id: uuidv4(),
      sessionId,
      timestamp: new Date(),
      type,
      data,
      description
    };

    // Store in memory
    const events = this.eventStore.get(sessionId) || [];
    events.push(event);
    this.eventStore.set(sessionId, events);

    // Also log to database
    await db.insert(developerModeAgentLogs).values({
      id: event.id,
      agentId: sessionId, // Using sessionId as parent
      type: 'ghost_event',
      message: description,
      metadata: JSON.stringify({ type, data }),
      timestamp: event.timestamp
    });

    // Notify subscribers
    const subscribers = this.eventSubscribers.get(sessionId) || [];
    for (const callback of subscribers) {
      try {
        callback(event);
      } catch (e) {
        console.error('Event subscriber error:', e);
      }
    }
  }

  /**
   * Subscribe to session events
   */
  subscribeToEvents(sessionId: string, callback: (event: GhostEvent) => void): () => void {
    const subscribers = this.eventSubscribers.get(sessionId) || [];
    subscribers.push(callback);
    this.eventSubscribers.set(sessionId, subscribers);

    return () => {
      const subs = this.eventSubscribers.get(sessionId) || [];
      const index = subs.indexOf(callback);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  /**
   * Get events for a session
   */
  async getEvents(sessionId: string, limit?: number): Promise<GhostEvent[]> {
    const events = this.eventStore.get(sessionId) || [];
    return limit ? events.slice(-limit) : events;
  }

  // =============================================================================
  // SESSION QUERIES
  // =============================================================================

  /**
   * Get session summary
   */
  async getSessionSummary(sessionId: string): Promise<GhostSessionSummary> {
    const runtime = this.activeSessions.get(sessionId);
    const events = this.eventStore.get(sessionId) || [];

    if (!runtime) {
      // Try to reconstruct from database
      const session = await db.query.developerModeSessions.findFirst({
        where: eq(developerModeSessions.id, sessionId)
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const config = JSON.parse(session.config || '{}');

      return {
        sessionId,
        state: session.status as GhostSessionState,
        progress: {
          tasksCompleted: config.tasks?.filter((t: GhostTask) => t.status === 'completed').length || 0,
          totalTasks: config.tasks?.length || 0,
          percentage: 0
        },
        runtime: 0,
        creditsUsed: 0,
        eventsCount: events.length,
        lastActivity: session.startedAt || new Date(),
        pendingDecisions: []
      };
    }

    const tasksCompleted = runtime.config.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = runtime.config.tasks.length;
    const currentTask = runtime.config.tasks[runtime.taskIndex];

    return {
      sessionId,
      state: runtime.state,
      progress: {
        tasksCompleted,
        totalTasks,
        percentage: totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0
      },
      runtime: Date.now() - runtime.startTime,
      creditsUsed: runtime.creditsUsed,
      eventsCount: events.length,
      lastActivity: events.length > 0 ? events[events.length - 1].timestamp : new Date(),
      currentTask,
      pendingDecisions: []
    };
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessionsForUser(userId: string): Promise<GhostSessionSummary[]> {
    const sessions = await db.query.developerModeSessions.findMany({
      where: and(
        eq(developerModeSessions.userId, userId),
        eq(developerModeSessions.mode, 'ghost')
      )
    });

    const summaries: GhostSessionSummary[] = [];

    for (const session of sessions) {
      try {
        const summary = await this.getSessionSummary(session.id);
        summaries.push(summary);
      } catch (e) {
        // Skip sessions that can't be summarized
      }
    }

    return summaries;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private validateConfig(config: GhostSessionConfig): void {
    if (!config.sessionId) throw new Error('sessionId is required');
    if (!config.projectId) throw new Error('projectId is required');
    if (!config.userId) throw new Error('userId is required');
    if (!config.tasks || config.tasks.length === 0) throw new Error('At least one task is required');
    if (config.maxRuntime <= 0) throw new Error('maxRuntime must be positive');
    if (config.maxCredits <= 0) throw new Error('maxCredits must be positive');
  }

  private areDependenciesMet(task: GhostTask, allTasks: GhostTask[]): boolean {
    if (!task.dependencies || task.dependencies.length === 0) return true;

    return task.dependencies.every(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask?.status === 'completed';
    });
  }

  private estimateCredits(model: string, tokens: number): number {
    // Simplified credit calculation
    const rates: Record<string, number> = {
      'anthropic/claude-opus-4-20250514': 0.003,
      'anthropic/claude-sonnet-4-20250514': 0.001,
      'anthropic/claude-3.5-haiku': 0.0002
    };

    const rate = rates[model] || 0.001;
    return tokens * rate;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// RUNTIME TYPES
// =============================================================================

interface GhostSessionRuntime {
  sessionId: string;
  config: GhostSessionConfig;
  state: GhostSessionState;
  startTime: number;
  creditsUsed: number;
  taskIndex: number;
  retryCount: number;
  lastCheckpointTime: number;
  events: GhostEvent[];
  timers: {
    checkpointTimer: NodeJS.Timeout | null;
    runtimeTimer: NodeJS.Timeout | null;
  };
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

let ghostModeController: GhostModeController | null = null;

export function createGhostModeController(): GhostModeController {
  if (!ghostModeController) {
    ghostModeController = new GhostModeController();
  }
  return ghostModeController;
}

export function getGhostModeController(): GhostModeController {
  if (!ghostModeController) {
    throw new Error('GhostModeController not initialized. Call createGhostModeController first.');
  }
  return ghostModeController;
}

