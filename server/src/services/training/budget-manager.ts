/**
 * Budget Manager Service - Training Budget Tracking & Freeze/Resume
 *
 * Handles budget tracking, alerts, freeze functionality, and resume
 * for flagship training jobs. Integrates with notifications.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { trainingJobs, notifications, users } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { getTrainingMonitorService } from './training-monitor.js';

// =============================================================================
// TYPES
// =============================================================================

export type BudgetStatus = 
  | 'within_budget' 
  | 'approaching_alert' 
  | 'alert_sent' 
  | 'approaching_freeze' 
  | 'frozen' 
  | 'resumed' 
  | 'completed';

export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface BudgetState {
  jobId: string;
  userId: string;
  userEmail?: string;
  userPhone?: string;

  // Budget limits
  maxBudget: number;
  alertThreshold: number; // percentage (e.g., 80)
  freezeThreshold: number; // percentage (e.g., 95)

  // Current state
  currentSpend: number;
  estimatedTotalSpend: number;
  spendRate: number; // $/hour

  // Status
  status: BudgetStatus;

  // Notifications
  notificationChannels: NotificationChannel[];
  notificationsSent: NotificationRecord[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  type: 'alert' | 'freeze' | 'complete';
  channel: NotificationChannel;
  sentAt: string;
  success: boolean;
  error?: string;
}

export interface FreezeState {
  jobId: string;
  checkpoint: CheckpointInfo;
  frozenAt: string;
  currentSpend: number;
  percentUsed: number;
  canResume: boolean;
  resumeUrl: string;
  resumeToken: string;
  expiresAt: string;
}

export interface CheckpointInfo {
  id: string;
  step: number;
  epoch: number;
  loss: number;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ResumeResult {
  success: boolean;
  resumedAt: string;
  newBudget?: number;
  message: string;
}

export interface BudgetManagerConfig {
  pollingIntervalMs: number;
  resumeTokenExpiryHours: number;
  frontendUrl: string;
}

// =============================================================================
// BUDGET MANAGER SERVICE
// =============================================================================

export class BudgetManagerService extends EventEmitter {
  private config: BudgetManagerConfig;
  private budgetStates: Map<string, BudgetState> = new Map();
  private freezeStates: Map<string, FreezeState> = new Map();
  private activeMonitors: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<BudgetManagerConfig>) {
    super();
    this.config = {
      pollingIntervalMs: 30000, // 30 seconds
      resumeTokenExpiryHours: 72, // 3 days
      frontendUrl: process.env.FRONTEND_URL || 'https://kriptik.app',
      ...config,
    };
  }

  // =============================================================================
  // BUDGET INITIALIZATION
  // =============================================================================

  /**
   * Initialize budget tracking for a job
   */
  async initializeBudget(
    jobId: string,
    userId: string,
    maxBudget: number,
    alertThreshold: number = 80,
    freezeThreshold: number = 95,
    notificationChannels: NotificationChannel[] = ['in_app']
  ): Promise<BudgetState> {
    // Get user info for notifications
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    const state: BudgetState = {
      jobId,
      userId,
      userEmail: user?.email,
      maxBudget,
      alertThreshold,
      freezeThreshold,
      currentSpend: 0,
      estimatedTotalSpend: 0,
      spendRate: 0,
      status: 'within_budget',
      notificationChannels,
      notificationsSent: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.budgetStates.set(jobId, state);
    this.startMonitoring(jobId);

    return state;
  }

  /**
   * Get budget state for a job
   */
  getBudgetState(jobId: string): BudgetState | null {
    return this.budgetStates.get(jobId) || null;
  }

  /**
   * Update budget for a job
   */
  async updateBudget(jobId: string, newMaxBudget: number): Promise<BudgetState | null> {
    const state = this.budgetStates.get(jobId);
    if (!state) return null;

    state.maxBudget = newMaxBudget;
    state.updatedAt = new Date().toISOString();

    // Recalculate status
    const percentUsed = (state.currentSpend / state.maxBudget) * 100;
    if (percentUsed < state.alertThreshold) {
      state.status = 'within_budget';
    } else if (percentUsed < state.freezeThreshold) {
      state.status = 'approaching_alert';
    }

    this.budgetStates.set(jobId, state);
    return state;
  }

  // =============================================================================
  // BUDGET MONITORING
  // =============================================================================

  /**
   * Start monitoring budget for a job
   */
  private startMonitoring(jobId: string): void {
    if (this.activeMonitors.has(jobId)) return;

    const monitor = setInterval(async () => {
      await this.monitorBudget(jobId);
    }, this.config.pollingIntervalMs);

    this.activeMonitors.set(jobId, monitor);
  }

  /**
   * Stop monitoring budget for a job
   */
  stopMonitoring(jobId: string): void {
    const monitor = this.activeMonitors.get(jobId);
    if (monitor) {
      clearInterval(monitor);
      this.activeMonitors.delete(jobId);
    }
  }

  /**
   * Monitor budget and trigger alerts/freeze
   */
  async monitorBudget(jobId: string): Promise<void> {
    const state = this.budgetStates.get(jobId);
    if (!state) return;

    // Get current spend from training metrics
    const monitor = getTrainingMonitorService();
    const metrics = monitor.getMetrics(jobId);

    if (metrics) {
      state.currentSpend = metrics.currentCost;
      state.estimatedTotalSpend = metrics.estimatedTotalCost;
      state.spendRate = metrics.costPerHour;
    }

    const percentUsed = (state.currentSpend / state.maxBudget) * 100;

    // Check freeze threshold
    if (percentUsed >= state.freezeThreshold && state.status !== 'frozen') {
      await this.freezeTraining(jobId);
      await this.sendBudgetNotification(jobId, 'freeze', state.notificationChannels);
      state.status = 'frozen';
    }
    // Check alert threshold
    else if (percentUsed >= state.alertThreshold && state.status === 'within_budget') {
      await this.sendBudgetNotification(jobId, 'alert', state.notificationChannels);
      state.status = 'alert_sent';
    }
    // Approaching alert
    else if (percentUsed >= state.alertThreshold * 0.9 && state.status === 'within_budget') {
      state.status = 'approaching_alert';
    }

    state.updatedAt = new Date().toISOString();
    this.budgetStates.set(jobId, state);

    this.emit('budgetUpdate', jobId, state);
  }

  /**
   * Update spend for a job (called by billing service)
   */
  updateSpend(jobId: string, currentSpend: number, spendRate: number): void {
    const state = this.budgetStates.get(jobId);
    if (!state) return;

    state.currentSpend = currentSpend;
    state.spendRate = spendRate;
    state.updatedAt = new Date().toISOString();

    // Calculate estimated total
    const metrics = getTrainingMonitorService().getMetrics(jobId);
    if (metrics && metrics.percentComplete > 0) {
      state.estimatedTotalSpend = currentSpend / (metrics.percentComplete / 100);
    }

    this.budgetStates.set(jobId, state);
  }

  // =============================================================================
  // FREEZE FUNCTIONALITY
  // =============================================================================

  /**
   * Freeze training job
   */
  async freezeTraining(jobId: string): Promise<FreezeState> {
    const state = this.budgetStates.get(jobId);
    if (!state) {
      throw new Error(`No budget state for job ${jobId}`);
    }

    // 1. Save checkpoint
    const checkpoint = await this.saveCheckpoint(jobId);

    // 2. Pause training process
    await this.pauseTrainingProcess(jobId);

    // 3. Generate resume token
    const resumeToken = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.config.resumeTokenExpiryHours * 3600000).toISOString();

    // 4. Create freeze state
    const freezeState: FreezeState = {
      jobId,
      checkpoint,
      frozenAt: new Date().toISOString(),
      currentSpend: state.currentSpend,
      percentUsed: (state.currentSpend / state.maxBudget) * 100,
      canResume: true,
      resumeUrl: `${this.config.frontendUrl}/training/resume/${jobId}?token=${resumeToken}`,
      resumeToken,
      expiresAt,
    };

    this.freezeStates.set(jobId, freezeState);

    // 5. Update job status in database
    await db.update(trainingJobs)
      .set({
        status: 'paused',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, jobId));

    this.emit('trainingFrozen', jobId, freezeState);

    return freezeState;
  }

  /**
   * Get freeze state
   */
  getFreezeState(jobId: string): FreezeState | null {
    return this.freezeStates.get(jobId) || null;
  }

  /**
   * Save checkpoint before freezing
   */
  private async saveCheckpoint(jobId: string): Promise<CheckpointInfo> {
    const monitor = getTrainingMonitorService();
    const metrics = monitor.getMetrics(jobId);

    const checkpoint: CheckpointInfo = {
      id: `freeze-${jobId}-${Date.now()}`,
      step: metrics?.currentStep || 0,
      epoch: metrics?.currentEpoch || 0,
      loss: metrics?.loss || 0,
      path: `/checkpoints/${jobId}/freeze-${Date.now()}`,
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
    };

    // In production, this would trigger actual checkpoint save on GPU pod
    monitor.recordCheckpoint(jobId, checkpoint);

    return checkpoint;
  }

  /**
   * Pause training process
   */
  private async pauseTrainingProcess(jobId: string): Promise<void> {
    // Update job status to paused
    await db.update(trainingJobs)
      .set({
        status: 'paused',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, jobId));

    // Stop metrics polling but keep state
    this.stopMonitoring(jobId);
  }

  // =============================================================================
  // RESUME FUNCTIONALITY
  // =============================================================================

  /**
   * Resume training from freeze
   */
  async resumeTraining(jobId: string, resumeToken: string, newBudget?: number): Promise<ResumeResult> {
    const freezeState = this.freezeStates.get(jobId);
    if (!freezeState) {
      return { success: false, resumedAt: '', message: 'No freeze state found for job' };
    }

    // Validate token
    if (freezeState.resumeToken !== resumeToken) {
      return { success: false, resumedAt: '', message: 'Invalid resume token' };
    }

    // Check expiry
    if (new Date(freezeState.expiresAt) < new Date()) {
      return { success: false, resumedAt: '', message: 'Resume token has expired' };
    }

    const budgetState = this.budgetStates.get(jobId);
    if (!budgetState) {
      return { success: false, resumedAt: '', message: 'No budget state found for job' };
    }

    // 1. Update budget if provided
    if (newBudget !== undefined && newBudget > budgetState.currentSpend) {
      await this.updateBudget(jobId, newBudget);
    }

    // 2. Update job status to running
    await db.update(trainingJobs)
      .set({
        status: 'running',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(trainingJobs.id, jobId));

    // 3. Resume monitoring
    budgetState.status = 'resumed';
    this.budgetStates.set(jobId, budgetState);
    this.startMonitoring(jobId);

    // 4. Clear freeze state
    this.freezeStates.delete(jobId);

    const resumedAt = new Date().toISOString();

    this.emit('trainingResumed', jobId, { resumedAt, newBudget });

    return {
      success: true,
      resumedAt,
      newBudget,
      message: 'Training resumed successfully',
    };
  }

  /**
   * Validate resume token
   */
  validateResumeToken(jobId: string, token: string): boolean {
    const freezeState = this.freezeStates.get(jobId);
    if (!freezeState) return false;
    if (freezeState.resumeToken !== token) return false;
    if (new Date(freezeState.expiresAt) < new Date()) return false;
    return true;
  }

  /**
   * Generate resume URL
   */
  generateResumeUrl(jobId: string): string {
    const freezeState = this.freezeStates.get(jobId);
    if (!freezeState) {
      return `${this.config.frontendUrl}/training/jobs/${jobId}`;
    }
    return freezeState.resumeUrl;
  }

  // =============================================================================
  // NOTIFICATIONS
  // =============================================================================

  /**
   * Send budget notification
   */
  async sendBudgetNotification(
    jobId: string,
    type: 'alert' | 'freeze' | 'complete',
    channels: NotificationChannel[]
  ): Promise<void> {
    const state = this.budgetStates.get(jobId);
    if (!state) return;

    const resumeUrl = this.generateResumeUrl(jobId);
    const percentUsed = Math.round((state.currentSpend / state.maxBudget) * 100);

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(state, type, resumeUrl, percentUsed);
            break;

          case 'sms':
            await this.sendSMSNotification(state, type, resumeUrl, percentUsed);
            break;

          case 'in_app':
            await this.sendInAppNotification(state, type, resumeUrl, percentUsed);
            break;
        }

        state.notificationsSent.push({
          id: randomUUID(),
          type,
          channel,
          sentAt: new Date().toISOString(),
          success: true,
        });
      } catch (error) {
        state.notificationsSent.push({
          id: randomUUID(),
          type,
          channel,
          sentAt: new Date().toISOString(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.budgetStates.set(jobId, state);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    state: BudgetState,
    type: 'alert' | 'freeze' | 'complete',
    resumeUrl: string,
    percentUsed: number
  ): Promise<void> {
    if (!state.userEmail) return;

    // In production, integrate with email service (SendGrid, Resend, etc.)
    console.log(`[BudgetManager] Email notification to ${state.userEmail}:`, {
      type,
      jobId: state.jobId,
      spend: `$${state.currentSpend.toFixed(2)}`,
      budget: `$${state.maxBudget.toFixed(2)}`,
      percentUsed,
      resumeUrl: type === 'freeze' ? resumeUrl : undefined,
    });

    this.emit('emailSent', state.jobId, { type, email: state.userEmail });
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    state: BudgetState,
    type: 'alert' | 'freeze' | 'complete',
    resumeUrl: string,
    percentUsed: number
  ): Promise<void> {
    if (!state.userPhone) return;

    const message = type === 'freeze'
      ? `KripTik Training Frozen: $${state.currentSpend.toFixed(2)}/$${state.maxBudget.toFixed(2)} (${percentUsed}%). Resume: ${resumeUrl}`
      : `KripTik Training ${type === 'alert' ? 'Alert' : 'Complete'}: $${state.currentSpend.toFixed(2)}/$${state.maxBudget.toFixed(2)} (${percentUsed}%)`;

    // In production, integrate with SMS service (Twilio, etc.)
    console.log(`[BudgetManager] SMS to ${state.userPhone}: ${message}`);

    this.emit('smsSent', state.jobId, { type, phone: state.userPhone });
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    state: BudgetState,
    type: 'alert' | 'freeze' | 'complete',
    resumeUrl: string,
    percentUsed: number
  ): Promise<void> {
    const titles: Record<string, string> = {
      alert: 'Training Budget Alert',
      freeze: 'Training Frozen - Budget Limit Reached',
      complete: 'Training Complete',
    };

    const messages: Record<string, string> = {
      alert: `Your training job has reached ${percentUsed}% of the $${state.maxBudget.toFixed(2)} budget.`,
      freeze: `Training paused at $${state.currentSpend.toFixed(2)}. Adjust budget to continue.`,
      complete: `Training completed within budget: $${state.currentSpend.toFixed(2)}/$${state.maxBudget.toFixed(2)}.`,
    };

    // Create notification in database
    await db.insert(notifications).values({
      id: randomUUID(),
      userId: state.userId,
      type: `training_${type}`,
      title: titles[type],
      message: messages[type],
      priority: type === 'freeze' ? 'high' : 'medium',
      actionUrl: type === 'freeze' ? resumeUrl : `/training/jobs/${state.jobId}`,
      actionLabel: type === 'freeze' ? 'Adjust Budget & Resume' : 'View Training',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.emit('inAppNotificationSent', state.jobId, { type, userId: state.userId });
  }

  // =============================================================================
  // UTILITIES
  // =============================================================================

  /**
   * Generate secure token for resume URL
   */
  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Mark job as completed
   */
  async markCompleted(jobId: string): Promise<void> {
    const state = this.budgetStates.get(jobId);
    if (state) {
      state.status = 'completed';
      this.budgetStates.set(jobId, state);
      await this.sendBudgetNotification(jobId, 'complete', state.notificationChannels);
    }
    this.stopMonitoring(jobId);
    this.freezeStates.delete(jobId);
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    for (const [jobId] of this.activeMonitors) {
      this.stopMonitoring(jobId);
    }
    this.budgetStates.clear();
    this.freezeStates.clear();
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let budgetManagerInstance: BudgetManagerService | null = null;

export function getBudgetManagerService(): BudgetManagerService {
  if (!budgetManagerInstance) {
    budgetManagerInstance = new BudgetManagerService();
  }
  return budgetManagerInstance;
}

export function createBudgetManagerService(config?: Partial<BudgetManagerConfig>): BudgetManagerService {
  return new BudgetManagerService(config);
}

export default BudgetManagerService;
