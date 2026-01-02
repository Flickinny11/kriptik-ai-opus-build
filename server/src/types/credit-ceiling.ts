/**
 * Credit Ceiling Types - Shared between frontend and backend
 *
 * These types define the contract for the credit ceiling system.
 * Safe to import in frontend code.
 */

// ============================================================================
// CEILING STATUS
// ============================================================================

export interface CreditCeilingSettings {
    userId: string;
    ceiling: number | null; // null = unlimited
    currentUsage: number;
    remainingCredits: number;
    percentUsed: number;
    status: 'ok' | 'warning' | 'critical' | 'exceeded';
    estimatedToComplete?: number;
    canProceed: boolean;
}

// ============================================================================
// WARNINGS
// ============================================================================

export interface CeilingWarning {
    threshold: number; // 75, 90, or 100
    currentUsage: number;
    ceiling: number;
    percentUsed: number;
    estimatedToComplete?: number;
    remainingCredits: number;
    message: string;
    suggestedActions: SuggestedAction[];
}

export interface SuggestedAction {
    type: 'adjust_ceiling' | 'add_funds' | 'pause_build' | 'continue';
    label: string;
    value?: number; // For adjust_ceiling
    url?: string; // For add_funds
}

// ============================================================================
// CHECK RESULTS
// ============================================================================

export interface CeilingCheckResult {
    allowed: boolean;
    warning?: CeilingWarning;
    shouldPause: boolean;
    reason?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface SetCeilingRequest {
    ceiling: number | null;
}

export interface SetCeilingResponse {
    success: boolean;
    status: CreditCeilingSettings;
    message: string;
}

export interface CheckCeilingRequest {
    estimatedCost: number;
    buildId?: string;
}

export interface AdjustCeilingRequest {
    amount: number;
}

export interface RecordWarningRequest {
    threshold: number;
    buildId?: string;
}

// ============================================================================
// UI POPUP DATA
// ============================================================================

/**
 * Data structure for the ceiling warning popup
 *
 * This is what the UI should display when showing the warning modal.
 */
export interface CeilingWarningPopupData {
    title: string;
    message: string;
    severity: 'warning' | 'critical' | 'error';
    currentUsage: number;
    ceiling: number;
    percentUsed: number;
    remainingCredits: number;
    estimatedToComplete?: number;
    needsMoreFunds: boolean;
    quickActions: QuickAction[];
}

export interface QuickAction {
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger';
    action: QuickActionType;
    value?: number | string;
}

export type QuickActionType =
    | 'increase_by_10'
    | 'increase_by_25'
    | 'increase_by_50'
    | 'set_unlimited'
    | 'add_funds'
    | 'pause_build'
    | 'continue';

// ============================================================================
// HELPER FUNCTIONS FOR UI
// ============================================================================

/**
 * Convert CeilingWarning to popup data (backend utility)
 */
export function warningToPopupData(warning: CeilingWarning): CeilingWarningPopupData {
    const severity: 'warning' | 'critical' | 'error' =
        warning.threshold === 100 ? 'error' :
        warning.threshold === 90 ? 'critical' : 'warning';

    const title =
        warning.threshold === 100 ? 'Credit Ceiling Reached' :
        warning.threshold === 90 ? 'Approaching Credit Ceiling' :
        'Credit Usage Warning';

    const needsMoreFunds = warning.estimatedToComplete
        ? warning.remainingCredits < warning.estimatedToComplete
        : false;

    const quickActions: QuickAction[] = warning.suggestedActions.map((action, index) => {
        let id: string;
        let type: 'primary' | 'secondary' | 'danger' = 'secondary';
        let actionType: QuickActionType = 'continue';

        switch (action.type) {
            case 'adjust_ceiling':
                if (action.value === 0) {
                    id = 'unlimited';
                    actionType = 'set_unlimited';
                    type = 'primary';
                } else {
                    const increase = action.value! - warning.ceiling;
                    if (increase === 1000) {
                        id = 'increase_10';
                        actionType = 'increase_by_10';
                    } else if (increase === 2500) {
                        id = 'increase_25';
                        actionType = 'increase_by_25';
                    } else if (increase === 5000) {
                        id = 'increase_50';
                        actionType = 'increase_by_50';
                    } else {
                        id = `adjust_${index}`;
                        actionType = 'continue';
                    }
                    type = index === 0 ? 'primary' : 'secondary';
                }
                break;
            case 'add_funds':
                id = 'add_funds';
                actionType = 'add_funds';
                type = 'primary';
                break;
            case 'pause_build':
                id = 'pause';
                actionType = 'pause_build';
                type = 'danger';
                break;
            case 'continue':
                id = 'continue';
                actionType = 'continue';
                type = 'secondary';
                break;
        }

        return {
            id,
            label: action.label,
            type,
            action: actionType,
            value: action.value || action.url,
        };
    });

    return {
        title,
        message: warning.message,
        severity,
        currentUsage: warning.currentUsage,
        ceiling: warning.ceiling,
        percentUsed: warning.percentUsed,
        remainingCredits: warning.remainingCredits,
        estimatedToComplete: warning.estimatedToComplete,
        needsMoreFunds,
        quickActions,
    };
}

// Types are already exported via interface/type declarations above
