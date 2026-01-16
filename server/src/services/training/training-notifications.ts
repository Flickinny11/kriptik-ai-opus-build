/**
 * Training Notification Service
 *
 * Integrates training module with KripTik's notification system.
 * Handles budget alerts, completion notifications, freeze notifications,
 * error notifications, and stage completion notifications.
 *
 * Part of KripTik AI's Flagship Training Module
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { db } from '../../db.js';
import { notifications, notificationPreferences, users, trainingJobs } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { getNotificationService, type NotificationChannel, type NotificationPayload } from '../notifications/notification-service.js';
import type { FreezeState } from './budget-manager.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingResult {
  jobId: string;
  status: 'completed' | 'failed';
  modelPath?: string;
  huggingfaceUrl?: string;
  finalLoss?: number;
  totalEpochs: number;
  totalSteps: number;
  trainingTime: number;
  totalCost: number;
  reportUrl?: string;
  error?: string;
}

export interface StageResult {
  stageId: string;
  stageName: string;
  method: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  finalLoss: number;
  checkpointPath: string;
}

export interface TrainingNotificationPreferences {
  userId: string;

  // Channel preferences
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;

  // Event preferences
  alertOnBudgetPercent: number;
  alertOnStageComplete: boolean;
  alertOnError: boolean;
  alertOnComplete: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  // Timezone
  timezone: string;
}

export interface TrainingNotificationPayload {
  userId: string;
  jobId: string;
  type: 'training_alert' | 'training_freeze' | 'training_complete' | 'training_error' | 'training_stage_complete';
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
  metadata: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

const DEFAULT_PREFERENCES: TrainingNotificationPreferences = {
  userId: '',
  emailEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
  alertOnBudgetPercent: 80,
  alertOnStageComplete: true,
  alertOnError: true,
  alertOnComplete: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'UTC',
};

// =============================================================================
// TRAINING NOTIFICATION SERVICE
// =============================================================================

export class TrainingNotificationService extends EventEmitter {
  private notificationService = getNotificationService();
  private preferencesCache: Map<string, TrainingNotificationPreferences> = new Map();

  constructor() {
    super();
  }

  // =============================================================================
  // BUDGET ALERTS
  // =============================================================================

  /**
   * Send budget alert notification
   */
  async sendBudgetAlert(jobId: string, percentUsed: number): Promise<void> {
    const job = await this.getJobDetails(jobId);
    if (!job) return;

    const prefs = await this.getPreferences(job.userId);

    if (percentUsed < prefs.alertOnBudgetPercent) return;
    if (this.isInQuietHours(prefs)) return;

    const payload: TrainingNotificationPayload = {
      userId: job.userId,
      jobId,
      type: 'training_alert',
      title: 'Training Budget Alert',
      message: `Your training job has reached ${Math.round(percentUsed)}% of the budget limit.`,
      actionUrl: `/dashboard/training/${jobId}`,
      actionLabel: 'View Training',
      metadata: {
        jobId,
        percentUsed,
        jobName: job.name,
      },
      priority: percentUsed >= 90 ? 'high' : 'medium',
    };

    await this.sendToChannels(payload, prefs);
  }

  // =============================================================================
  // FREEZE NOTIFICATIONS
  // =============================================================================

  /**
   * Send freeze notification when training is paused due to budget
   */
  async sendFreezeNotification(jobId: string, freezeState: FreezeState): Promise<void> {
    const job = await this.getJobDetails(jobId);
    if (!job) return;

    const prefs = await this.getPreferences(job.userId);

    const payload: TrainingNotificationPayload = {
      userId: job.userId,
      jobId,
      type: 'training_freeze',
      title: 'Training Frozen - Budget Limit Reached',
      message: `Training paused at $${freezeState.currentSpend.toFixed(2)} (${Math.round(freezeState.percentUsed)}% of budget). Adjust budget to continue.`,
      actionUrl: freezeState.resumeUrl,
      actionLabel: 'Adjust Budget & Resume',
      metadata: {
        jobId,
        jobName: job.name,
        currentSpend: freezeState.currentSpend,
        percentUsed: freezeState.percentUsed,
        checkpoint: freezeState.checkpoint,
        frozenAt: freezeState.frozenAt,
        resumeUrl: freezeState.resumeUrl,
        expiresAt: freezeState.expiresAt,
      },
      priority: 'critical',
    };

    // Always notify on freeze, even in quiet hours
    await this.sendToChannels(payload, prefs, true);
  }

  // =============================================================================
  // COMPLETION NOTIFICATIONS
  // =============================================================================

  /**
   * Send completion notification when training finishes
   */
  async sendCompletionNotification(jobId: string, result: TrainingResult): Promise<void> {
    const job = await this.getJobDetails(jobId);
    if (!job) return;

    const prefs = await this.getPreferences(job.userId);

    if (!prefs.alertOnComplete) return;
    if (this.isInQuietHours(prefs)) return;

    const isSuccess = result.status === 'completed';
    const testUrl = `/dashboard/training/${jobId}/test`;

    const payload: TrainingNotificationPayload = {
      userId: job.userId,
      jobId,
      type: 'training_complete',
      title: isSuccess ? 'Training Complete' : 'Training Failed',
      message: isSuccess
        ? `Training completed successfully. Final loss: ${result.finalLoss?.toFixed(4) || 'N/A'}. Cost: $${result.totalCost.toFixed(2)}.`
        : `Training failed: ${result.error || 'Unknown error'}`,
      actionUrl: isSuccess ? testUrl : `/dashboard/training/${jobId}`,
      actionLabel: isSuccess ? 'Test Your Model' : 'View Details',
      metadata: {
        jobId,
        jobName: job.name,
        status: result.status,
        finalLoss: result.finalLoss,
        totalEpochs: result.totalEpochs,
        totalSteps: result.totalSteps,
        trainingTime: result.trainingTime,
        totalCost: result.totalCost,
        modelPath: result.modelPath,
        huggingfaceUrl: result.huggingfaceUrl,
        reportUrl: result.reportUrl,
        error: result.error,
      },
      priority: isSuccess ? 'medium' : 'high',
    };

    await this.sendToChannels(payload, prefs);
  }

  // =============================================================================
  // ERROR NOTIFICATIONS
  // =============================================================================

  /**
   * Send error notification
   */
  async sendErrorNotification(jobId: string, error: Error): Promise<void> {
    const job = await this.getJobDetails(jobId);
    if (!job) return;

    const prefs = await this.getPreferences(job.userId);

    if (!prefs.alertOnError) return;

    const payload: TrainingNotificationPayload = {
      userId: job.userId,
      jobId,
      type: 'training_error',
      title: 'Training Error',
      message: `An error occurred during training: ${error.message}`,
      actionUrl: `/dashboard/training/${jobId}`,
      actionLabel: 'View Error Details',
      metadata: {
        jobId,
        jobName: job.name,
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      },
      priority: 'high',
    };

    // Always notify on errors, even in quiet hours
    await this.sendToChannels(payload, prefs, true);
  }

  // =============================================================================
  // STAGE COMPLETION NOTIFICATIONS
  // =============================================================================

  /**
   * Send stage completion notification for multi-stage training
   */
  async sendStageCompleteNotification(jobId: string, stage: StageResult): Promise<void> {
    const job = await this.getJobDetails(jobId);
    if (!job) return;

    const prefs = await this.getPreferences(job.userId);

    if (!prefs.alertOnStageComplete) return;
    if (this.isInQuietHours(prefs)) return;

    const payload: TrainingNotificationPayload = {
      userId: job.userId,
      jobId,
      type: 'training_stage_complete',
      title: `Stage Complete: ${stage.stageName}`,
      message: `${stage.stageName} (${stage.method}) completed in ${this.formatDuration(stage.duration)}. Loss: ${stage.finalLoss.toFixed(4)}.`,
      actionUrl: `/dashboard/training/${jobId}`,
      actionLabel: 'View Progress',
      metadata: {
        jobId,
        jobName: job.name,
        stageId: stage.stageId,
        stageName: stage.stageName,
        method: stage.method,
        duration: stage.duration,
        finalLoss: stage.finalLoss,
        checkpointPath: stage.checkpointPath,
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
      },
      priority: 'low',
    };

    // Only in-app for stage completions to avoid spam
    await this.sendInAppNotification(payload);
  }

  // =============================================================================
  // CHANNEL DISPATCH
  // =============================================================================

  /**
   * Send notification to all enabled channels
   */
  private async sendToChannels(
    payload: TrainingNotificationPayload,
    prefs: TrainingNotificationPreferences,
    bypassQuietHours: boolean = false
  ): Promise<void> {
    const channels: NotificationChannel[] = [];

    if (prefs.inAppEnabled) channels.push('push');
    if (prefs.emailEnabled) channels.push('email');
    if (prefs.smsEnabled) channels.push('sms');

    // For critical notifications, always include in-app
    if (payload.priority === 'critical' && !channels.includes('push')) {
      channels.push('push');
    }

    if (channels.length === 0) {
      channels.push('push'); // Always send at least in-app
    }

    // Send via notification service
    const notificationPayload: NotificationPayload = {
      type: this.mapTypeToNotificationType(payload.type),
      title: payload.title,
      message: payload.message,
      featureAgentId: null,
      featureAgentName: 'Training System',
      actionUrl: payload.actionUrl,
      metadata: {
        ...payload.metadata,
        notificationType: payload.type,
        priority: payload.priority,
        actionLabel: payload.actionLabel,
      },
    };

    await this.notificationService.sendNotification(
      payload.userId,
      channels,
      notificationPayload
    );

    this.emit('notificationSent', { payload, channels });
  }

  /**
   * Send in-app notification only
   */
  private async sendInAppNotification(payload: TrainingNotificationPayload): Promise<void> {
    await db.insert(notifications).values({
      id: randomUUID(),
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl,
      metadata: JSON.stringify({
        ...payload.metadata,
        actionLabel: payload.actionLabel,
        priority: payload.priority,
      }),
      read: false,
      dismissed: false,
    });

    this.emit('notificationSent', { payload, channels: ['push'] });
  }

  // =============================================================================
  // PREFERENCES
  // =============================================================================

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string): Promise<TrainingNotificationPreferences> {
    const cached = this.preferencesCache.get(userId);
    if (cached) return cached;

    const [dbPrefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    const prefs: TrainingNotificationPreferences = {
      ...DEFAULT_PREFERENCES,
      userId,
      emailEnabled: !!dbPrefs?.email,
      smsEnabled: !!dbPrefs?.phone,
      inAppEnabled: dbPrefs?.pushEnabled ?? true,
    };

    this.preferencesCache.set(userId, prefs);
    return prefs;
  }

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(
    userId: string,
    updates: Partial<TrainingNotificationPreferences>
  ): Promise<void> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...updates };
    this.preferencesCache.set(userId, updated);
  }

  /**
   * Clear preferences cache for a user
   */
  clearPreferencesCache(userId: string): void {
    this.preferencesCache.delete(userId);
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Get job details from database
   */
  private async getJobDetails(jobId: string): Promise<{ userId: string; name: string } | null> {
    const [job] = await db
      .select({
        userId: trainingJobs.userId,
        modality: trainingJobs.modality,
        id: trainingJobs.id,
      })
      .from(trainingJobs)
      .where(eq(trainingJobs.id, jobId))
      .limit(1);

    if (!job) return null;

    // Generate a name from modality and ID since name column doesn't exist
    return {
      userId: job.userId,
      name: `${job.modality || 'training'}-${job.id.slice(0, 8)}`,
    };
  }

  /**
   * Check if current time is within quiet hours
   */
  private isInQuietHours(prefs: TrainingNotificationPreferences): boolean {
    if (!prefs.quietHoursEnabled) return false;

    const now = new Date();
    const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * Map training notification type to standard notification type
   */
  private mapTypeToNotificationType(type: TrainingNotificationPayload['type']): 'budget_warning' | 'feature_complete' | 'error' | 'decision_needed' {
    switch (type) {
      case 'training_alert':
        return 'budget_warning';
      case 'training_freeze':
        return 'decision_needed';
      case 'training_complete':
        return 'feature_complete';
      case 'training_error':
        return 'error';
      case 'training_stage_complete':
        return 'feature_complete';
      default:
        return 'feature_complete';
    }
  }

  /**
   * Format duration in human-readable form
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
}

// =============================================================================
// FACTORY
// =============================================================================

let notificationServiceInstance: TrainingNotificationService | null = null;

export function getTrainingNotificationService(): TrainingNotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new TrainingNotificationService();
  }
  return notificationServiceInstance;
}

export function createTrainingNotificationService(): TrainingNotificationService {
  return new TrainingNotificationService();
}

export default TrainingNotificationService;
