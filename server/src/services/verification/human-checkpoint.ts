/**
 * Human Verification Checkpoints - Like Cursor's Debug Mode "Verify Fix"
 *
 * From Cursor's Debug Mode documentation:
 * > "Debug Mode asks you to reproduce the bug one more time with the
 * > proposed fix in place. If the bug is gone, you mark it as fixed."
 *
 * This service provides:
 * 1. Automatic pause points for critical fixes
 * 2. User verification requests before committing fixes
 * 3. Integration with Ghost Mode wake conditions
 * 4. Fix confidence scoring to determine when to ask
 *
 * The key insight: Don't assume fixes work. VERIFY they work.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export type CheckpointTrigger =
    | 'critical_fix'           // Fix for critical/blocking issue
    | 'architectural_change'   // Significant structural change
    | 'security_fix'           // Security-related fix
    | 'escalation_level_2_plus' // Error required Level 2+ escalation
    | 'multiple_files_changed' // Fix touched many files
    | 'intent_contract_related' // Change affects intent satisfaction
    | 'user_workflow_affected'  // Change affects user workflow
    | 'manual';                // User-requested checkpoint

export type CheckpointStatus =
    | 'pending'      // Waiting for user
    | 'approved'     // User approved
    | 'rejected'     // User rejected
    | 'modified'     // User made changes
    | 'timeout'      // Timed out waiting
    | 'skipped';     // Auto-skipped (low priority)

export interface VerificationCheckpoint {
    id: string;
    buildId: string;
    trigger: CheckpointTrigger;
    status: CheckpointStatus;

    // Context about what needs verification
    description: string;
    affectedFiles: string[];
    fixSummary: string;
    beforeState: string;
    afterState: string;

    // Verification details
    confidenceScore: number;  // 0-100, how confident we are the fix works
    riskLevel: 'low' | 'medium' | 'high' | 'critical';

    // User actions
    verificationSteps: string[];  // Steps for user to verify
    expectedOutcome: string;

    // Timestamps
    createdAt: Date;
    respondedAt?: Date;
    responseNote?: string;

    // Metrics
    waitTimeMs?: number;
    retryCount: number;
}

export interface CheckpointConfig {
    // Auto-checkpoint triggers
    minEscalationLevelForCheckpoint: number;  // 2 = Level 2+
    minFilesChangedForCheckpoint: number;     // e.g., 5 files
    maxConfidenceForAutoApprove: number;      // e.g., 95 = auto-approve if 95%+ confident

    // Timeouts
    defaultTimeoutMs: number;    // How long to wait for user
    criticalTimeoutMs: number;   // Longer wait for critical issues

    // Notifications
    notifyOnCheckpoint: boolean;
    notificationChannels: ('email' | 'push' | 'slack' | 'discord')[];
}

export interface CheckpointResponse {
    checkpointId: string;
    action: 'approve' | 'reject' | 'modify' | 'retry';
    note?: string;
    modifications?: {
        file: string;
        changes: string;
    }[];
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: CheckpointConfig = {
    minEscalationLevelForCheckpoint: 2,
    minFilesChangedForCheckpoint: 5,
    maxConfidenceForAutoApprove: 95,
    defaultTimeoutMs: 5 * 60 * 1000,    // 5 minutes
    criticalTimeoutMs: 30 * 60 * 1000,  // 30 minutes for critical
    notifyOnCheckpoint: true,
    notificationChannels: ['push'],
};

// =============================================================================
// HUMAN CHECKPOINT SERVICE
// =============================================================================

export class HumanCheckpointService extends EventEmitter {
    private config: CheckpointConfig;
    private checkpoints: Map<string, VerificationCheckpoint> = new Map();
    private buildCheckpoints: Map<string, string[]> = new Map(); // buildId -> checkpointIds
    private pendingCallbacks: Map<string, {
        resolve: (response: CheckpointResponse) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();

    constructor(config?: Partial<CheckpointConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // =========================================================================
    // CHECKPOINT CREATION
    // =========================================================================

    /**
     * Create a verification checkpoint - THE CORE METHOD
     * Returns a promise that resolves when user responds
     */
    async createCheckpoint(
        buildId: string,
        trigger: CheckpointTrigger,
        context: {
            description: string;
            affectedFiles: string[];
            fixSummary: string;
            beforeState: string;
            afterState: string;
            confidenceScore: number;
            verificationSteps: string[];
            expectedOutcome: string;
            escalationLevel?: number;
        }
    ): Promise<CheckpointResponse> {
        // Determine risk level
        const riskLevel = this.calculateRiskLevel(trigger, context);

        // Check if we should auto-approve
        if (this.shouldAutoApprove(context.confidenceScore, riskLevel)) {
            console.log(`[HumanCheckpoint] Auto-approving checkpoint (confidence: ${context.confidenceScore}%, risk: ${riskLevel})`);
            return {
                checkpointId: 'auto-approved',
                action: 'approve',
                note: 'Auto-approved due to high confidence and low risk',
            };
        }

        const checkpoint: VerificationCheckpoint = {
            id: uuidv4(),
            buildId,
            trigger,
            status: 'pending',
            description: context.description,
            affectedFiles: context.affectedFiles,
            fixSummary: context.fixSummary,
            beforeState: context.beforeState,
            afterState: context.afterState,
            confidenceScore: context.confidenceScore,
            riskLevel,
            verificationSteps: context.verificationSteps,
            expectedOutcome: context.expectedOutcome,
            createdAt: new Date(),
            retryCount: 0,
        };

        this.checkpoints.set(checkpoint.id, checkpoint);

        // Track by build
        const buildCheckpointIds = this.buildCheckpoints.get(buildId) || [];
        buildCheckpointIds.push(checkpoint.id);
        this.buildCheckpoints.set(buildId, buildCheckpointIds);

        console.log(`[HumanCheckpoint] Created checkpoint ${checkpoint.id} (${trigger}, risk: ${riskLevel})`);

        // Emit event for UI/notifications
        this.emit('checkpoint:created', checkpoint);

        // Send notification if configured
        if (this.config.notifyOnCheckpoint) {
            this.sendNotification(checkpoint);
        }

        // Wait for user response
        return this.waitForResponse(checkpoint);
    }

    /**
     * Quick checkpoint for simple confirmations
     */
    async confirmFix(
        buildId: string,
        fixDescription: string,
        affectedFiles: string[],
        escalationLevel: number
    ): Promise<boolean> {
        // Only checkpoint if escalation level meets threshold
        if (escalationLevel < this.config.minEscalationLevelForCheckpoint) {
            return true; // Auto-approve
        }

        const response = await this.createCheckpoint(buildId, 'escalation_level_2_plus', {
            description: `Verify fix: ${fixDescription}`,
            affectedFiles,
            fixSummary: fixDescription,
            beforeState: 'Error state',
            afterState: 'Fixed state',
            confidenceScore: 70, // Moderate confidence for escalated fixes
            verificationSteps: [
                'Review the changed files',
                'Test the affected functionality',
                'Confirm the original issue is resolved',
            ],
            expectedOutcome: 'Issue should be resolved without new errors',
            escalationLevel,
        });

        return response.action === 'approve';
    }

    // =========================================================================
    // RESPONSE HANDLING
    // =========================================================================

    /**
     * Wait for user response with timeout
     */
    private waitForResponse(checkpoint: VerificationCheckpoint): Promise<CheckpointResponse> {
        const timeoutMs = checkpoint.riskLevel === 'critical'
            ? this.config.criticalTimeoutMs
            : this.config.defaultTimeoutMs;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                // Timeout - auto-action based on risk level
                const autoAction = this.getTimeoutAction(checkpoint);
                checkpoint.status = autoAction === 'approve' ? 'timeout' : 'rejected';
                checkpoint.waitTimeMs = timeoutMs;

                this.pendingCallbacks.delete(checkpoint.id);
                this.emit('checkpoint:timeout', checkpoint);

                console.log(`[HumanCheckpoint] Checkpoint ${checkpoint.id} timed out, action: ${autoAction}`);

                resolve({
                    checkpointId: checkpoint.id,
                    action: autoAction,
                    note: `Auto-${autoAction} after ${timeoutMs / 1000}s timeout`,
                });
            }, timeoutMs);

            this.pendingCallbacks.set(checkpoint.id, { resolve, timeout });
        });
    }

    /**
     * Handle user response to a checkpoint
     */
    respond(checkpointId: string, response: Omit<CheckpointResponse, 'checkpointId'>): void {
        const checkpoint = this.checkpoints.get(checkpointId);
        if (!checkpoint) {
            console.warn(`[HumanCheckpoint] Checkpoint ${checkpointId} not found`);
            return;
        }

        const pending = this.pendingCallbacks.get(checkpointId);
        if (!pending) {
            console.warn(`[HumanCheckpoint] No pending callback for ${checkpointId}`);
            return;
        }

        // Clear timeout
        clearTimeout(pending.timeout);

        // Update checkpoint
        checkpoint.status = this.actionToStatus(response.action);
        checkpoint.respondedAt = new Date();
        checkpoint.responseNote = response.note;
        checkpoint.waitTimeMs = Date.now() - checkpoint.createdAt.getTime();

        this.emit('checkpoint:responded', { checkpoint, response });

        console.log(`[HumanCheckpoint] Checkpoint ${checkpointId} responded: ${response.action}`);

        // Resolve the promise
        pending.resolve({ checkpointId, ...response });
        this.pendingCallbacks.delete(checkpointId);
    }

    /**
     * Retry a rejected checkpoint
     */
    async retry(checkpointId: string, newFixSummary: string): Promise<CheckpointResponse> {
        const original = this.checkpoints.get(checkpointId);
        if (!original) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }

        original.retryCount++;

        // Create new checkpoint for retry
        return this.createCheckpoint(original.buildId, original.trigger, {
            description: `[Retry ${original.retryCount}] ${original.description}`,
            affectedFiles: original.affectedFiles,
            fixSummary: newFixSummary,
            beforeState: original.beforeState,
            afterState: original.afterState,
            confidenceScore: Math.min(original.confidenceScore + 10, 100), // Increase confidence on retry
            verificationSteps: original.verificationSteps,
            expectedOutcome: original.expectedOutcome,
        });
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private calculateRiskLevel(
        trigger: CheckpointTrigger,
        context: { confidenceScore: number; affectedFiles: string[]; escalationLevel?: number }
    ): 'low' | 'medium' | 'high' | 'critical' {
        // Critical triggers
        if (trigger === 'security_fix' || trigger === 'intent_contract_related') {
            return 'critical';
        }

        // High risk based on escalation level
        if (context.escalationLevel && context.escalationLevel >= 3) {
            return 'high';
        }

        // High risk based on files changed
        if (context.affectedFiles.length >= 10) {
            return 'high';
        }

        // Medium risk based on confidence
        if (context.confidenceScore < 70) {
            return 'medium';
        }

        // Architectural changes are at least medium
        if (trigger === 'architectural_change') {
            return 'medium';
        }

        return 'low';
    }

    private shouldAutoApprove(confidenceScore: number, riskLevel: string): boolean {
        // Never auto-approve critical or high risk
        if (riskLevel === 'critical' || riskLevel === 'high') {
            return false;
        }

        // Auto-approve if confidence is very high
        return confidenceScore >= this.config.maxConfidenceForAutoApprove;
    }

    private getTimeoutAction(checkpoint: VerificationCheckpoint): 'approve' | 'reject' {
        // Critical/high risk - reject on timeout (safer)
        if (checkpoint.riskLevel === 'critical' || checkpoint.riskLevel === 'high') {
            return 'reject';
        }

        // Low/medium risk with high confidence - approve on timeout
        if (checkpoint.confidenceScore >= 80) {
            return 'approve';
        }

        return 'reject';
    }

    private actionToStatus(action: string): CheckpointStatus {
        switch (action) {
            case 'approve': return 'approved';
            case 'reject': return 'rejected';
            case 'modify': return 'modified';
            default: return 'pending';
        }
    }

    private sendNotification(checkpoint: VerificationCheckpoint): void {
        // In production, this would send actual notifications
        console.log(`[HumanCheckpoint] Notification: Verification needed for ${checkpoint.description}`);
        this.emit('notification:sent', {
            checkpointId: checkpoint.id,
            channels: this.config.notificationChannels,
        });
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    /**
     * Get checkpoint by ID
     */
    getCheckpoint(checkpointId: string): VerificationCheckpoint | null {
        return this.checkpoints.get(checkpointId) || null;
    }

    /**
     * Get all checkpoints for a build
     */
    getBuildCheckpoints(buildId: string): VerificationCheckpoint[] {
        const checkpointIds = this.buildCheckpoints.get(buildId) || [];
        return checkpointIds
            .map(id => this.checkpoints.get(id))
            .filter((c): c is VerificationCheckpoint => c !== undefined);
    }

    /**
     * Get pending checkpoints for a build
     */
    getPendingCheckpoints(buildId: string): VerificationCheckpoint[] {
        return this.getBuildCheckpoints(buildId).filter(c => c.status === 'pending');
    }

    /**
     * Check if build has pending checkpoints
     */
    hasPendingCheckpoints(buildId: string): boolean {
        return this.getPendingCheckpoints(buildId).length > 0;
    }

    /**
     * Get checkpoint statistics
     */
    getStats(buildId: string): {
        total: number;
        approved: number;
        rejected: number;
        pending: number;
        avgWaitTimeMs: number;
    } {
        const checkpoints = this.getBuildCheckpoints(buildId);
        const approved = checkpoints.filter(c => c.status === 'approved').length;
        const rejected = checkpoints.filter(c => c.status === 'rejected').length;
        const pending = checkpoints.filter(c => c.status === 'pending').length;

        const completedWithTime = checkpoints.filter(c => c.waitTimeMs !== undefined);
        const avgWaitTimeMs = completedWithTime.length > 0
            ? completedWithTime.reduce((sum, c) => sum + (c.waitTimeMs || 0), 0) / completedWithTime.length
            : 0;

        return {
            total: checkpoints.length,
            approved,
            rejected,
            pending,
            avgWaitTimeMs,
        };
    }

    /**
     * Clean up checkpoints for a completed build
     */
    cleanup(buildId: string): void {
        const checkpointIds = this.buildCheckpoints.get(buildId) || [];

        for (const id of checkpointIds) {
            // Cancel any pending timeouts
            const pending = this.pendingCallbacks.get(id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingCallbacks.delete(id);
            }

            this.checkpoints.delete(id);
        }

        this.buildCheckpoints.delete(buildId);
        console.log(`[HumanCheckpoint] Cleaned up ${checkpointIds.length} checkpoints for build ${buildId}`);
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let checkpointService: HumanCheckpointService | null = null;

export function getHumanCheckpointService(): HumanCheckpointService {
    if (!checkpointService) {
        checkpointService = new HumanCheckpointService();
    }
    return checkpointService;
}

export function createHumanCheckpointService(
    config?: Partial<CheckpointConfig>
): HumanCheckpointService {
    return new HumanCheckpointService(config);
}
