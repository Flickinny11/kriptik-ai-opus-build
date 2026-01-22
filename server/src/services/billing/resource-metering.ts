/**
 * Resource Metering Service
 *
 * Handles real-time metered billing for GPU and cloud resources.
 * Tracks per-second usage and integrates with billing approval workflow.
 *
 * Features:
 * - Per-second granular billing
 * - Resource allocation approval workflow
 * - Real-time cost tracking
 * - Budget alerts and ceiling enforcement
 * - Integration with Stripe metered billing
 */

import { EventEmitter } from 'events';
import Stripe from 'stripe';
import { db } from '../../db.js';
import { users } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { BillingContext, determineBillingContext, isUserBillable } from './billing-context.js';
import { getCreditCeilingService } from './credit-ceiling.js';
import { getUsageService } from './usage-service.js';

// =============================================================================
// Types
// =============================================================================

export interface ResourceAllocation {
    id: string;
    buildId: string;
    userId: string;
    resourceType: 'gpu' | 'cpu' | 'storage' | 'bandwidth';
    provider: 'runpod' | 'aws' | 'gcp' | 'azure' | 'lambda-labs';
    resourceId: string;
    resourceName: string;
    pricePerHour: number; // in cents
    pricePerSecond: number; // computed
    estimatedDurationMinutes: number;
    estimatedCostCents: number;
    billingContext: BillingContext;
    status: 'pending_approval' | 'approved' | 'active' | 'paused' | 'completed' | 'cancelled';
    approvedAt?: string;
    startedAt?: string;
    pausedAt?: string;
    completedAt?: string;
    totalSecondsUsed: number;
    totalCostCents: number;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface ApprovalRequest {
    allocationId: string;
    buildId: string;
    userId: string;
    resourceName: string;
    provider: string;
    pricePerHour: number;
    estimatedDurationMinutes: number;
    estimatedCostCents: number;
    billingContext: BillingContext;
    userPaymentRequired: boolean;
    currentBalance?: number;
    hasSufficientFunds?: boolean;
}

export interface MeteringEvent {
    allocationId: string;
    eventType: 'start' | 'tick' | 'pause' | 'resume' | 'complete' | 'error';
    timestamp: string;
    secondsElapsed: number;
    costCentsSoFar: number;
    metadata?: Record<string, unknown>;
}

export interface UsageReport {
    allocationId: string;
    buildId: string;
    userId: string;
    resourceName: string;
    provider: string;
    totalSeconds: number;
    totalMinutes: number;
    totalCostCents: number;
    totalCostDollars: string;
    pricePerHour: number;
    effectiveRatePerMinute: number;
    startedAt: string;
    completedAt: string;
    billedToUser: boolean;
    billingContext: BillingContext;
}

export interface BudgetAlert {
    allocationId: string;
    userId: string;
    alertType: '50_percent' | '75_percent' | '90_percent' | '100_percent' | 'over_budget';
    currentCostCents: number;
    budgetCents: number;
    percentUsed: number;
    message: string;
    timestamp: string;
}

// =============================================================================
// In-Memory Storage (would be Redis in production)
// =============================================================================

const allocations = new Map<string, ResourceAllocation>();
const activeMetering = new Map<string, NodeJS.Timeout>();
const alertsSent = new Map<string, Set<string>>(); // allocationId -> set of alert types sent

// =============================================================================
// Resource Metering Service
// =============================================================================

export class ResourceMeteringService extends EventEmitter {
    private stripe: Stripe | null = null;

    constructor() {
        super();
        this.initStripe();
    }

    private initStripe(): void {
        const apiKey = process.env.STRIPE_SECRET_KEY;
        if (apiKey) {
            this.stripe = new Stripe(apiKey);
        }
    }

    // =========================================================================
    // Resource Allocation Management
    // =========================================================================

    /**
     * Create a new resource allocation pending approval
     */
    async createAllocation(params: {
        buildId: string;
        userId: string;
        resourceType: 'gpu' | 'cpu' | 'storage' | 'bandwidth';
        provider: 'runpod' | 'aws' | 'gcp' | 'azure' | 'lambda-labs';
        resourceId: string;
        resourceName: string;
        pricePerHour: number;
        estimatedDurationMinutes: number;
        operationType: 'training' | 'inference' | 'building' | 'finetuning';
        isUserInitiated: boolean;
        metadata?: Record<string, unknown>;
    }): Promise<ApprovalRequest> {
        const {
            buildId,
            userId,
            resourceType,
            provider,
            resourceId,
            resourceName,
            pricePerHour,
            estimatedDurationMinutes,
            operationType,
            isUserInitiated,
            metadata = {},
        } = params;

        // Determine billing context
        const billingDecision = determineBillingContext({
            operationType,
            isUserInitiated,
            deploymentTarget: 'kriptik',
        });

        // Calculate costs
        const pricePerSecond = pricePerHour / 3600;
        const estimatedCostCents = Math.ceil((estimatedDurationMinutes / 60) * pricePerHour);

        // Apply margin if user is being billed
        const finalEstimatedCost = billingDecision.billUser
            ? Math.ceil(estimatedCostCents * billingDecision.creditMultiplier)
            : estimatedCostCents;

        // Create allocation
        const allocation: ResourceAllocation = {
            id: `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            buildId,
            userId,
            resourceType,
            provider,
            resourceId,
            resourceName,
            pricePerHour,
            pricePerSecond,
            estimatedDurationMinutes,
            estimatedCostCents: finalEstimatedCost,
            billingContext: billingDecision.context,
            status: 'pending_approval',
            totalSecondsUsed: 0,
            totalCostCents: 0,
            metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        allocations.set(allocation.id, allocation);

        // Check user balance if they're being billed
        let currentBalance: number | undefined;
        let hasSufficientFunds: boolean | undefined;

        if (billingDecision.billUser) {
            const userRecords = await db
                .select({ credits: users.credits })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);

            if (userRecords.length > 0) {
                currentBalance = userRecords[0].credits || 0;
                // Convert cents to credits (1 credit = 1 cent for simplicity)
                hasSufficientFunds = currentBalance >= finalEstimatedCost;
            }
        }

        const approvalRequest: ApprovalRequest = {
            allocationId: allocation.id,
            buildId,
            userId,
            resourceName,
            provider,
            pricePerHour,
            estimatedDurationMinutes,
            estimatedCostCents: finalEstimatedCost,
            billingContext: billingDecision.context,
            userPaymentRequired: billingDecision.billUser,
            currentBalance,
            hasSufficientFunds,
        };

        this.emit('approval_required', approvalRequest);

        console.log(`[ResourceMetering] Created allocation ${allocation.id} for ${resourceName} - awaiting approval`);

        return approvalRequest;
    }

    /**
     * Approve a resource allocation
     */
    async approveAllocation(
        allocationId: string,
        userId: string
    ): Promise<{ success: boolean; allocation?: ResourceAllocation; error?: string }> {
        const allocation = allocations.get(allocationId);

        if (!allocation) {
            return { success: false, error: 'Allocation not found' };
        }

        if (allocation.userId !== userId) {
            return { success: false, error: 'Unauthorized' };
        }

        if (allocation.status !== 'pending_approval') {
            return { success: false, error: `Allocation is ${allocation.status}, not pending approval` };
        }

        // Check ceiling if user is being billed
        if (isUserBillable(allocation.billingContext)) {
            const ceilingService = getCreditCeilingService();
            const ceilingCheck = await ceilingService.checkCeiling(
                userId,
                allocation.estimatedCostCents,
                allocation.buildId
            );

            if (!ceilingCheck.allowed) {
                return {
                    success: false,
                    error: `Would exceed credit ceiling. ${ceilingCheck.reason || 'Ceiling limit reached'}`,
                };
            }
        }

        // Update allocation status
        allocation.status = 'approved';
        allocation.approvedAt = new Date().toISOString();
        allocation.updatedAt = new Date().toISOString();

        this.emit('allocation_approved', allocation);

        console.log(`[ResourceMetering] Allocation ${allocationId} approved by user ${userId}`);

        return { success: true, allocation };
    }

    /**
     * Decline/cancel a resource allocation
     */
    async declineAllocation(
        allocationId: string,
        userId: string,
        reason?: string
    ): Promise<{ success: boolean; error?: string }> {
        const allocation = allocations.get(allocationId);

        if (!allocation) {
            return { success: false, error: 'Allocation not found' };
        }

        if (allocation.userId !== userId) {
            return { success: false, error: 'Unauthorized' };
        }

        allocation.status = 'cancelled';
        allocation.metadata.cancelledReason = reason;
        allocation.updatedAt = new Date().toISOString();

        this.emit('allocation_declined', { allocationId, userId, reason });

        console.log(`[ResourceMetering] Allocation ${allocationId} declined: ${reason || 'No reason provided'}`);

        return { success: true };
    }

    // =========================================================================
    // Real-Time Metering
    // =========================================================================

    /**
     * Start metering for an approved allocation
     */
    async startMetering(allocationId: string): Promise<{ success: boolean; error?: string }> {
        const allocation = allocations.get(allocationId);

        if (!allocation) {
            return { success: false, error: 'Allocation not found' };
        }

        if (allocation.status !== 'approved') {
            return { success: false, error: `Allocation must be approved first (current: ${allocation.status})` };
        }

        if (activeMetering.has(allocationId)) {
            return { success: false, error: 'Metering already active' };
        }

        // Update allocation
        allocation.status = 'active';
        allocation.startedAt = new Date().toISOString();
        allocation.updatedAt = new Date().toISOString();

        // Initialize alerts tracking
        alertsSent.set(allocationId, new Set());

        // Emit start event
        const startEvent: MeteringEvent = {
            allocationId,
            eventType: 'start',
            timestamp: allocation.startedAt,
            secondsElapsed: 0,
            costCentsSoFar: 0,
        };
        this.emit('metering_event', startEvent);

        // Start metering interval (every second for precise billing)
        const interval = setInterval(() => {
            this.meterTick(allocationId);
        }, 1000);

        activeMetering.set(allocationId, interval);

        console.log(`[ResourceMetering] Started metering for ${allocationId}`);

        return { success: true };
    }

    /**
     * Process a metering tick (called every second)
     */
    private async meterTick(allocationId: string): Promise<void> {
        const allocation = allocations.get(allocationId);

        if (!allocation || allocation.status !== 'active') {
            this.stopMetering(allocationId);
            return;
        }

        // Increment usage
        allocation.totalSecondsUsed += 1;
        allocation.totalCostCents = Math.ceil(
            allocation.totalSecondsUsed * allocation.pricePerSecond
        );
        allocation.updatedAt = new Date().toISOString();

        // Apply margin if user billable
        const effectiveCost = isUserBillable(allocation.billingContext)
            ? Math.ceil(allocation.totalCostCents * 1.2) // 20% margin
            : allocation.totalCostCents;

        // Emit tick event every 10 seconds to reduce noise
        if (allocation.totalSecondsUsed % 10 === 0) {
            const tickEvent: MeteringEvent = {
                allocationId,
                eventType: 'tick',
                timestamp: new Date().toISOString(),
                secondsElapsed: allocation.totalSecondsUsed,
                costCentsSoFar: effectiveCost,
            };
            this.emit('metering_event', tickEvent);
        }

        // Check budget alerts
        await this.checkBudgetAlerts(allocation, effectiveCost);
    }

    /**
     * Check and emit budget alerts
     */
    private async checkBudgetAlerts(
        allocation: ResourceAllocation,
        currentCostCents: number
    ): Promise<void> {
        const sent = alertsSent.get(allocation.id) || new Set();
        const budgetCents = allocation.estimatedCostCents;
        const percentUsed = (currentCostCents / budgetCents) * 100;

        const alertThresholds: Array<{ threshold: number; type: BudgetAlert['alertType'] }> = [
            { threshold: 50, type: '50_percent' },
            { threshold: 75, type: '75_percent' },
            { threshold: 90, type: '90_percent' },
            { threshold: 100, type: '100_percent' },
        ];

        for (const { threshold, type } of alertThresholds) {
            if (percentUsed >= threshold && !sent.has(type)) {
                sent.add(type);

                const alert: BudgetAlert = {
                    allocationId: allocation.id,
                    userId: allocation.userId,
                    alertType: type,
                    currentCostCents,
                    budgetCents,
                    percentUsed: Math.round(percentUsed),
                    message: `Resource usage at ${Math.round(percentUsed)}% of estimated budget`,
                    timestamp: new Date().toISOString(),
                };

                this.emit('budget_alert', alert);

                console.log(
                    `[ResourceMetering] Budget alert for ${allocation.id}: ${type} (${Math.round(percentUsed)}%)`
                );
            }
        }

        // Check for over-budget
        if (percentUsed > 110 && !sent.has('over_budget')) {
            sent.add('over_budget');

            const alert: BudgetAlert = {
                allocationId: allocation.id,
                userId: allocation.userId,
                alertType: 'over_budget',
                currentCostCents,
                budgetCents,
                percentUsed: Math.round(percentUsed),
                message: `WARNING: Resource usage is ${Math.round(percentUsed - 100)}% OVER estimated budget`,
                timestamp: new Date().toISOString(),
            };

            this.emit('budget_alert', alert);
        }

        alertsSent.set(allocation.id, sent);
    }

    /**
     * Pause metering (e.g., when resource is paused)
     */
    async pauseMetering(allocationId: string): Promise<{ success: boolean; error?: string }> {
        const allocation = allocations.get(allocationId);

        if (!allocation) {
            return { success: false, error: 'Allocation not found' };
        }

        if (allocation.status !== 'active') {
            return { success: false, error: 'Metering not active' };
        }

        // Stop interval
        const interval = activeMetering.get(allocationId);
        if (interval) {
            clearInterval(interval);
            activeMetering.delete(allocationId);
        }

        allocation.status = 'paused';
        allocation.pausedAt = new Date().toISOString();
        allocation.updatedAt = new Date().toISOString();

        const pauseEvent: MeteringEvent = {
            allocationId,
            eventType: 'pause',
            timestamp: allocation.pausedAt,
            secondsElapsed: allocation.totalSecondsUsed,
            costCentsSoFar: allocation.totalCostCents,
        };
        this.emit('metering_event', pauseEvent);

        console.log(`[ResourceMetering] Paused metering for ${allocationId}`);

        return { success: true };
    }

    /**
     * Resume metering after pause
     */
    async resumeMetering(allocationId: string): Promise<{ success: boolean; error?: string }> {
        const allocation = allocations.get(allocationId);

        if (!allocation) {
            return { success: false, error: 'Allocation not found' };
        }

        if (allocation.status !== 'paused') {
            return { success: false, error: 'Allocation not paused' };
        }

        allocation.status = 'active';
        allocation.pausedAt = undefined;
        allocation.updatedAt = new Date().toISOString();

        // Restart interval
        const interval = setInterval(() => {
            this.meterTick(allocationId);
        }, 1000);
        activeMetering.set(allocationId, interval);

        const resumeEvent: MeteringEvent = {
            allocationId,
            eventType: 'resume',
            timestamp: new Date().toISOString(),
            secondsElapsed: allocation.totalSecondsUsed,
            costCentsSoFar: allocation.totalCostCents,
        };
        this.emit('metering_event', resumeEvent);

        console.log(`[ResourceMetering] Resumed metering for ${allocationId}`);

        return { success: true };
    }

    /**
     * Stop metering and finalize billing
     */
    async stopMetering(allocationId: string): Promise<UsageReport | null> {
        const allocation = allocations.get(allocationId);

        if (!allocation) {
            return null;
        }

        // Stop interval if active
        const interval = activeMetering.get(allocationId);
        if (interval) {
            clearInterval(interval);
            activeMetering.delete(allocationId);
        }

        // Finalize allocation
        allocation.status = 'completed';
        allocation.completedAt = new Date().toISOString();
        allocation.updatedAt = new Date().toISOString();

        // Calculate final cost with margin if applicable
        const finalCost = isUserBillable(allocation.billingContext)
            ? Math.ceil(allocation.totalCostCents * 1.2)
            : allocation.totalCostCents;

        // Create usage report
        const report: UsageReport = {
            allocationId: allocation.id,
            buildId: allocation.buildId,
            userId: allocation.userId,
            resourceName: allocation.resourceName,
            provider: allocation.provider,
            totalSeconds: allocation.totalSecondsUsed,
            totalMinutes: Math.round((allocation.totalSecondsUsed / 60) * 100) / 100,
            totalCostCents: finalCost,
            totalCostDollars: (finalCost / 100).toFixed(2),
            pricePerHour: allocation.pricePerHour,
            effectiveRatePerMinute: allocation.totalSecondsUsed > 0
                ? Math.round((finalCost / (allocation.totalSecondsUsed / 60)) * 100) / 100
                : 0,
            startedAt: allocation.startedAt || allocation.approvedAt || allocation.createdAt,
            completedAt: allocation.completedAt,
            billedToUser: isUserBillable(allocation.billingContext),
            billingContext: allocation.billingContext,
        };

        // Emit completion event
        const completeEvent: MeteringEvent = {
            allocationId,
            eventType: 'complete',
            timestamp: allocation.completedAt,
            secondsElapsed: allocation.totalSecondsUsed,
            costCentsSoFar: finalCost,
            metadata: { report },
        };
        this.emit('metering_event', completeEvent);
        this.emit('metering_complete', report);

        // Record usage if user billable
        if (report.billedToUser) {
            await this.recordFinalUsage(report);
        }

        console.log(
            `[ResourceMetering] Completed metering for ${allocationId}: ` +
            `${report.totalMinutes} min, $${report.totalCostDollars}`
        );

        return report;
    }

    /**
     * Record final usage to billing system
     */
    private async recordFinalUsage(report: UsageReport): Promise<void> {
        try {
            const usageService = getUsageService();

            // Record to usage service
            await usageService.recordUsage({
                userId: report.userId,
                category: 'deployment',
                subcategory: 'gpu_compute',
                creditsUsed: report.totalCostCents, // 1 credit = 1 cent
                metadata: {
                    allocationId: report.allocationId,
                    buildId: report.buildId,
                    resourceName: report.resourceName,
                    provider: report.provider,
                    durationMinutes: report.totalMinutes,
                    billingContext: report.billingContext,
                },
            });

            // Deduct from user credits
            const userRecords = await db
                .select({ credits: users.credits })
                .from(users)
                .where(eq(users.id, report.userId))
                .limit(1);

            if (userRecords.length > 0) {
                const currentCredits = userRecords[0].credits || 0;
                const newCredits = Math.max(0, currentCredits - report.totalCostCents);

                await db.update(users)
                    .set({
                        credits: newCredits,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(users.id, report.userId));

                console.log(
                    `[ResourceMetering] Deducted ${report.totalCostCents} credits from user ${report.userId}. ` +
                    `New balance: ${newCredits}`
                );
            }

            // Record to Stripe if available (for metered billing)
            if (this.stripe) {
                // This would be used for Stripe metered billing subscriptions
                // For now, we handle billing through credits
            }
        } catch (error) {
            console.error('[ResourceMetering] Error recording final usage:', error);
            this.emit('error', { type: 'usage_recording', error, report });
        }
    }

    // =========================================================================
    // Query Methods
    // =========================================================================

    /**
     * Get allocation by ID
     */
    getAllocation(allocationId: string): ResourceAllocation | undefined {
        return allocations.get(allocationId);
    }

    /**
     * Get all allocations for a build
     */
    getAllocationsForBuild(buildId: string): ResourceAllocation[] {
        return Array.from(allocations.values()).filter(a => a.buildId === buildId);
    }

    /**
     * Get all allocations for a user
     */
    getAllocationsForUser(userId: string): ResourceAllocation[] {
        return Array.from(allocations.values()).filter(a => a.userId === userId);
    }

    /**
     * Get active allocations
     */
    getActiveAllocations(): ResourceAllocation[] {
        return Array.from(allocations.values()).filter(a => a.status === 'active');
    }

    /**
     * Get current usage for an active allocation
     */
    getCurrentUsage(allocationId: string): {
        secondsElapsed: number;
        costCentsSoFar: number;
        costDollarsSoFar: string;
        percentOfEstimate: number;
    } | null {
        const allocation = allocations.get(allocationId);
        if (!allocation) return null;

        const effectiveCost = isUserBillable(allocation.billingContext)
            ? Math.ceil(allocation.totalCostCents * 1.2)
            : allocation.totalCostCents;

        return {
            secondsElapsed: allocation.totalSecondsUsed,
            costCentsSoFar: effectiveCost,
            costDollarsSoFar: (effectiveCost / 100).toFixed(2),
            percentOfEstimate: Math.round((effectiveCost / allocation.estimatedCostCents) * 100),
        };
    }

    /**
     * Get total active usage for a user
     */
    getTotalActiveUsage(userId: string): {
        activeAllocations: number;
        totalSecondsUsed: number;
        totalCostCents: number;
        totalCostDollars: string;
    } {
        const userAllocations = this.getAllocationsForUser(userId).filter(
            a => a.status === 'active'
        );

        let totalSeconds = 0;
        let totalCents = 0;

        for (const alloc of userAllocations) {
            totalSeconds += alloc.totalSecondsUsed;
            const effectiveCost = isUserBillable(alloc.billingContext)
                ? Math.ceil(alloc.totalCostCents * 1.2)
                : alloc.totalCostCents;
            totalCents += effectiveCost;
        }

        return {
            activeAllocations: userAllocations.length,
            totalSecondsUsed: totalSeconds,
            totalCostCents: totalCents,
            totalCostDollars: (totalCents / 100).toFixed(2),
        };
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

let meteringService: ResourceMeteringService | null = null;

export function getResourceMeteringService(): ResourceMeteringService {
    if (!meteringService) {
        meteringService = new ResourceMeteringService();
    }
    return meteringService;
}

export default ResourceMeteringService;
