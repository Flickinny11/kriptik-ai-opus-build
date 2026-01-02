/**
 * Ceiling Notification Service
 *
 * Monitors credit usage against user-defined ceilings and sends proactive warnings:
 * - 75% threshold: Early warning
 * - 90% threshold: Critical warning
 * - 100% threshold: Ceiling reached
 *
 * Features:
 * - Multi-channel notifications (email, SMS, push)
 * - One-click action links to adjust ceiling or add funds
 * - Spam prevention (one notification per threshold per month)
 * - Usage projections and time estimates
 * - Integration with existing NotificationService infrastructure
 */

import { db } from '../../db.js';
import { users, ceilingNotificationHistory, notificationPreferences } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { getNotificationService, NotificationChannel, NotificationPayload } from './notification-service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CeilingStatus {
    userId: string;
    currentUsage: number;
    ceiling: number;
    percentageUsed: number;
    remainingCredits: number;
    hasCeiling: boolean;
    thresholdReached: 75 | 90 | 100 | null;
    shouldNotify: boolean;
}

export interface CeilingNotificationOptions {
    includeUsageProjection?: boolean;
    includeTimeEstimate?: boolean;
    forceNotify?: boolean; // Bypass spam prevention
}

export interface UsageProjection {
    estimatedDailyUsage: number;
    daysUntilCeiling: number;
    estimatedDateReached: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const THRESHOLDS = [75, 90, 100] as const;
type Threshold = typeof THRESHOLDS[number];

const THRESHOLD_TITLES: Record<Threshold, string> = {
    75: 'Credit Usage Warning',
    90: 'Critical: Credit Ceiling Approaching',
    100: 'Credit Ceiling Reached',
};

const THRESHOLD_COLORS: Record<Threshold, string> = {
    75: '#F59E0B', // Amber warning
    90: '#FF4D4D', // Red critical
    100: '#FF0000', // Full red blocked
};

// ============================================================================
// CEILING NOTIFICATION SERVICE
// ============================================================================

export class CeilingNotificationService {
    private notificationService = getNotificationService();

    /**
     * Check if user has a ceiling and calculate current status
     */
    async checkCeilingStatus(userId: string, currentUsage: number): Promise<CeilingStatus> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        const ceiling = user.creditCeiling;

        // No ceiling set = no limits
        if (!ceiling || ceiling <= 0) {
            return {
                userId,
                currentUsage,
                ceiling: 0,
                percentageUsed: 0,
                remainingCredits: Infinity,
                hasCeiling: false,
                thresholdReached: null,
                shouldNotify: false,
            };
        }

        const percentageUsed = (currentUsage / ceiling) * 100;
        const remainingCredits = Math.max(0, ceiling - currentUsage);

        // Determine which threshold was reached (highest one)
        let thresholdReached: Threshold | null = null;
        if (percentageUsed >= 100) {
            thresholdReached = 100;
        } else if (percentageUsed >= 90) {
            thresholdReached = 90;
        } else if (percentageUsed >= 75) {
            thresholdReached = 75;
        }

        // Check if we should notify (has threshold and not already notified this month)
        const shouldNotify = thresholdReached !== null && !(await this.wasNotifiedThisMonth(userId, thresholdReached));

        return {
            userId,
            currentUsage,
            ceiling,
            percentageUsed,
            remainingCredits,
            hasCeiling: true,
            thresholdReached,
            shouldNotify,
        };
    }

    /**
     * Send ceiling warning notification if threshold reached
     */
    async sendCeilingWarning(
        userId: string,
        status: CeilingStatus,
        options: CeilingNotificationOptions = {}
    ): Promise<boolean> {
        if (!status.hasCeiling || !status.thresholdReached) {
            return false;
        }

        // Check if already notified (unless forced)
        if (!options.forceNotify && !(status.shouldNotify)) {
            console.log(`[CeilingNotification] User ${userId} already notified for ${status.thresholdReached}% threshold this month`);
            return false;
        }

        // Get user's notification preferences
        const prefs = await this.getNotificationPreferences(userId);
        if (!prefs.ceilingAlertsEnabled) {
            console.log(`[CeilingNotification] User ${userId} has ceiling alerts disabled`);
            return false;
        }

        const channels = prefs.channels;
        const threshold = status.thresholdReached;

        // Build notification payload
        const payload = await this.buildNotificationPayload(userId, status, threshold, options);

        // Send notification via all enabled channels
        try {
            const results = await this.notificationService.sendNotification(userId, channels, payload);

            // Record notification in history (spam prevention)
            await this.recordNotification(userId, threshold, status.currentUsage, status.ceiling);

            const successCount = results.filter(r => r.ok).length;
            console.log(`[CeilingNotification] Sent ${threshold}% warning to ${successCount}/${results.length} channels for user ${userId}`);

            return successCount > 0;
        } catch (error) {
            console.error('[CeilingNotification] Failed to send notification:', error);
            return false;
        }
    }

    /**
     * Monitor usage and auto-send notifications when thresholds crossed
     */
    async monitorAndNotify(
        userId: string,
        currentUsage: number,
        options: CeilingNotificationOptions = {}
    ): Promise<{ notified: boolean; status: CeilingStatus }> {
        const status = await this.checkCeilingStatus(userId, currentUsage);

        if (status.shouldNotify) {
            const notified = await this.sendCeilingWarning(userId, status, options);
            return { notified, status };
        }

        return { notified: false, status };
    }

    /**
     * Build notification payload with rich information
     */
    private async buildNotificationPayload(
        userId: string,
        status: CeilingStatus,
        threshold: Threshold,
        options: CeilingNotificationOptions
    ): Promise<NotificationPayload> {
        const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik.app';
        const actionUrl = `${frontendUrl}/settings/billing?action=adjust_ceiling`;

        const title = THRESHOLD_TITLES[threshold];

        // Build message based on threshold
        let message = '';
        if (threshold === 75) {
            message = `You've used ${status.percentageUsed.toFixed(1)}% of your monthly credit ceiling (${status.currentUsage.toLocaleString()} of ${status.ceiling.toLocaleString()} credits). You have ${status.remainingCredits.toLocaleString()} credits remaining.`;
        } else if (threshold === 90) {
            message = `CRITICAL: You've used ${status.percentageUsed.toFixed(1)}% of your monthly credit ceiling (${status.currentUsage.toLocaleString()} of ${status.ceiling.toLocaleString()} credits). Only ${status.remainingCredits.toLocaleString()} credits remaining.`;
        } else {
            message = `You've reached your monthly credit ceiling of ${status.ceiling.toLocaleString()} credits. Additional credit usage will be blocked until you adjust your ceiling or your credits reset next month.`;
        }

        // Add usage projection if requested
        if (options.includeUsageProjection || options.includeTimeEstimate) {
            const projection = await this.calculateUsageProjection(userId, status);
            if (projection && threshold !== 100) {
                message += `\n\nAt your current usage rate, you'll reach your ceiling in approximately ${projection.daysUntilCeiling} days (around ${projection.estimatedDateReached.toLocaleDateString()}).`;
            }
        }

        message += `\n\nClick below to adjust your ceiling or add credits.`;

        return {
            type: 'ceiling_warning',
            title,
            message,
            featureAgentId: null,
            featureAgentName: 'Credit System',
            actionUrl,
            metadata: {
                threshold,
                currentUsage: status.currentUsage,
                ceiling: status.ceiling,
                percentageUsed: status.percentageUsed,
                remainingCredits: status.remainingCredits,
                severity: threshold === 100 ? 'critical' : threshold === 90 ? 'high' : 'medium',
            },
        };
    }

    /**
     * Calculate usage projection based on recent usage patterns
     */
    private async calculateUsageProjection(
        userId: string,
        status: CeilingStatus
    ): Promise<UsageProjection | null> {
        if (!status.hasCeiling || status.remainingCredits <= 0) {
            return null;
        }

        // Get usage from past 7 days to calculate average daily usage
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Simplified projection: assume linear usage
        // In production, you'd query generations table for actual usage pattern
        const estimatedDailyUsage = status.currentUsage / 30; // Rough monthly average

        if (estimatedDailyUsage === 0) {
            return null;
        }

        const daysUntilCeiling = Math.ceil(status.remainingCredits / estimatedDailyUsage);
        const estimatedDateReached = new Date();
        estimatedDateReached.setDate(estimatedDateReached.getDate() + daysUntilCeiling);

        return {
            estimatedDailyUsage,
            daysUntilCeiling,
            estimatedDateReached,
        };
    }

    /**
     * Check if user was already notified for this threshold this month
     */
    private async wasNotifiedThisMonth(userId: string, threshold: Threshold): Promise<boolean> {
        const monthKey = this.getCurrentMonthKey();

        const existing = await db
            .select()
            .from(ceilingNotificationHistory)
            .where(
                and(
                    eq(ceilingNotificationHistory.userId, userId),
                    eq(ceilingNotificationHistory.threshold, threshold),
                    eq(ceilingNotificationHistory.monthKey, monthKey)
                )
            )
            .limit(1);

        return existing.length > 0;
    }

    /**
     * Record notification in history (spam prevention)
     */
    private async recordNotification(
        userId: string,
        threshold: Threshold,
        usage: number,
        ceiling: number
    ): Promise<void> {
        const monthKey = this.getCurrentMonthKey();

        await db.insert(ceilingNotificationHistory).values({
            userId,
            threshold,
            usageAtNotification: usage,
            ceilingAtNotification: ceiling,
            monthKey,
        });
    }

    /**
     * Get user's ceiling notification preferences
     */
    private async getNotificationPreferences(userId: string): Promise<{
        ceilingAlertsEnabled: boolean;
        channels: NotificationChannel[];
    }> {
        const [prefs] = await db
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId))
            .limit(1);

        if (!prefs) {
            // Default preferences
            return {
                ceilingAlertsEnabled: true,
                channels: ['email'],
            };
        }

        const ceilingAlertsEnabled = prefs.ceilingAlertsEnabled ?? true;

        let channels: NotificationChannel[] = ['email'];
        try {
            const parsed = JSON.parse(prefs.ceilingAlertChannels || '["email"]');
            if (Array.isArray(parsed)) {
                channels = parsed;
            }
        } catch {
            // Use default
        }

        return {
            ceilingAlertsEnabled,
            channels,
        };
    }

    /**
     * Get current month key for tracking notifications
     */
    private getCurrentMonthKey(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    /**
     * Update user's credit ceiling
     */
    async updateCeiling(userId: string, newCeiling: number | null): Promise<void> {
        await db
            .update(users)
            .set({
                creditCeiling: newCeiling,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userId));

        console.log(`[CeilingNotification] Updated ceiling for user ${userId}: ${newCeiling}`);
    }

    /**
     * Update user's ceiling notification preferences
     */
    async updatePreferences(
        userId: string,
        enabled: boolean,
        channels: NotificationChannel[]
    ): Promise<void> {
        const existing = await db
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId))
            .limit(1);

        const payload = {
            ceilingAlertsEnabled: enabled,
            ceilingAlertChannels: JSON.stringify(channels),
            updatedAt: new Date().toISOString(),
        };

        if (existing.length > 0) {
            await db
                .update(notificationPreferences)
                .set(payload as any)
                .where(eq(notificationPreferences.userId, userId));
        } else {
            await db.insert(notificationPreferences).values({
                userId,
                ...payload,
            } as any);
        }

        console.log(`[CeilingNotification] Updated preferences for user ${userId}: enabled=${enabled}, channels=${channels.join(',')}`);
    }

    /**
     * Clear notification history for testing or manual reset
     */
    async clearNotificationHistory(userId: string, monthKey?: string): Promise<void> {
        const conditions = monthKey
            ? and(
                eq(ceilingNotificationHistory.userId, userId),
                eq(ceilingNotificationHistory.monthKey, monthKey)
            )
            : eq(ceilingNotificationHistory.userId, userId);

        await db
            .delete(ceilingNotificationHistory)
            .where(conditions);

        console.log(`[CeilingNotification] Cleared notification history for user ${userId}${monthKey ? ` (month: ${monthKey})` : ''}`);
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: CeilingNotificationService | null = null;

export function getCeilingNotificationService(): CeilingNotificationService {
    if (!instance) {
        instance = new CeilingNotificationService();
    }
    return instance;
}
