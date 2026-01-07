/**
 * Billing Context Service
 * 
 * Determines who pays for GPU/compute usage in different scenarios:
 * - KripTik absorbs cost when building user's apps
 * - Users pay when training/fine-tuning their own models
 * - Users pay when using inference on KripTik infrastructure
 * - No billing when running on user's own cloud account
 */

// ============================================================================
// BILLING CONTEXT ENUM
// ============================================================================

/**
 * Billing context determines who pays for compute resources
 */
export enum BillingContext {
    // KripTik absorbs cost (building user's app)
    KRIPTIK_BUILDING = 'kriptik_building',

    // KripTik absorbs cost (quality verification)
    KRIPTIK_VERIFICATION = 'kriptik_verification',

    // KripTik absorbs cost (sandbox preview)
    KRIPTIK_SANDBOX = 'kriptik_sandbox',

    // User pays via credits (training their models)
    USER_TRAINING = 'user_training',

    // User pays via credits (fine-tuning)
    USER_FINETUNING = 'user_finetuning',

    // User pays via credits (inference on KripTik infrastructure)
    USER_INFERENCE = 'user_inference',

    // User's own account (deployed backend)
    USER_DEPLOYED = 'user_deployed',
}

// ============================================================================
// BILLING DECISION INTERFACE
// ============================================================================

export interface BillingDecision {
    context: BillingContext;
    billUser: boolean;
    creditMultiplier: number; // 1.0 = at cost, 1.2 = 20% margin
    reason: string;
}

// ============================================================================
// BILLING CONTEXT DETERMINATION
// ============================================================================

export interface BillingContextParams {
    operationType: 'training' | 'inference' | 'building' | 'verification' | 'sandbox' | 'deployed' | 'finetuning' | 'storage';
    isUserInitiated: boolean;
    deploymentTarget: 'kriptik' | 'user_account';
}

/**
 * Determine the billing context for an operation
 * 
 * @param params - Parameters describing the operation
 * @returns BillingDecision indicating who pays and margin
 */
export function determineBillingContext(params: BillingContextParams): BillingDecision {
    const { operationType, isUserInitiated, deploymentTarget } = params;

    // Building apps = KripTik cost (included in subscription)
    if (operationType === 'building') {
        return {
            context: BillingContext.KRIPTIK_BUILDING,
            billUser: false,
            creditMultiplier: 0,
            reason: 'App building is included in subscription',
        };
    }

    // Verification swarm = KripTik cost (quality assurance)
    if (operationType === 'verification') {
        return {
            context: BillingContext.KRIPTIK_VERIFICATION,
            billUser: false,
            creditMultiplier: 0,
            reason: 'Quality verification is included',
        };
    }

    // Sandbox previews = KripTik cost (testing/previewing)
    if (operationType === 'sandbox') {
        return {
            context: BillingContext.KRIPTIK_SANDBOX,
            billUser: false,
            creditMultiplier: 0,
            reason: 'Sandbox previews are included',
        };
    }

    // Deployed to user's account = no KripTik billing (user pays provider directly)
    if (deploymentTarget === 'user_account' || operationType === 'deployed') {
        return {
            context: BillingContext.USER_DEPLOYED,
            billUser: false,
            creditMultiplier: 0,
            reason: "Running on user's own cloud account",
        };
    }

    // User-initiated training = bill user with margin
    if (operationType === 'training' && isUserInitiated) {
        return {
            context: BillingContext.USER_TRAINING,
            billUser: true,
            creditMultiplier: 1.2, // 20% margin
            reason: 'User-initiated training on KripTik infrastructure',
        };
    }

    // User-initiated fine-tuning = bill user with margin
    if (operationType === 'finetuning' && isUserInitiated) {
        return {
            context: BillingContext.USER_FINETUNING,
            billUser: true,
            creditMultiplier: 1.2, // 20% margin
            reason: 'User-initiated fine-tuning on KripTik infrastructure',
        };
    }

    // User inference on KripTik = bill user with margin
    if (operationType === 'inference' && deploymentTarget === 'kriptik') {
        return {
            context: BillingContext.USER_INFERENCE,
            billUser: true,
            creditMultiplier: 1.2, // 20% margin
            reason: 'Inference on KripTik-hosted endpoint',
        };
    }

    // Storage = bill user with smaller margin
    if (operationType === 'storage') {
        return {
            context: BillingContext.USER_TRAINING, // Use training context for storage
            billUser: true,
            creditMultiplier: 1.15, // 15% margin for storage
            reason: 'Storage on KripTik infrastructure',
        };
    }

    // Default: bill user for any other user-initiated operation
    if (isUserInitiated) {
        return {
            context: BillingContext.USER_TRAINING,
            billUser: true,
            creditMultiplier: 1.2,
            reason: 'Default: user-initiated operation',
        };
    }

    // Default for non-user-initiated: KripTik pays
    return {
        context: BillingContext.KRIPTIK_BUILDING,
        billUser: false,
        creditMultiplier: 0,
        reason: 'Default: KripTik-initiated operation',
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a billing context means the user pays
 */
export function isUserBillable(context: BillingContext): boolean {
    return [
        BillingContext.USER_TRAINING,
        BillingContext.USER_FINETUNING,
        BillingContext.USER_INFERENCE,
    ].includes(context);
}

/**
 * Get the margin percentage for a billing context
 */
export function getMarginPercent(context: BillingContext): number {
    const decision = {
        [BillingContext.KRIPTIK_BUILDING]: 0,
        [BillingContext.KRIPTIK_VERIFICATION]: 0,
        [BillingContext.KRIPTIK_SANDBOX]: 0,
        [BillingContext.USER_TRAINING]: 20,
        [BillingContext.USER_FINETUNING]: 20,
        [BillingContext.USER_INFERENCE]: 20,
        [BillingContext.USER_DEPLOYED]: 0,
    };
    return decision[context] || 0;
}

/**
 * Format billing context for display
 */
export function formatBillingContext(context: BillingContext): string {
    const labels: Record<BillingContext, string> = {
        [BillingContext.KRIPTIK_BUILDING]: 'Included (App Building)',
        [BillingContext.KRIPTIK_VERIFICATION]: 'Included (Verification)',
        [BillingContext.KRIPTIK_SANDBOX]: 'Included (Sandbox)',
        [BillingContext.USER_TRAINING]: 'User Credits (Training)',
        [BillingContext.USER_FINETUNING]: 'User Credits (Fine-tuning)',
        [BillingContext.USER_INFERENCE]: 'User Credits (Inference)',
        [BillingContext.USER_DEPLOYED]: 'User Account (Direct)',
    };
    return labels[context] || 'Unknown';
}
