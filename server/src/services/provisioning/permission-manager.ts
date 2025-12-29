/**
 * Permission Manager Service
 *
 * Phase 0.5 of the BuildLoop - User permission capture before provisioning:
 * - Manages what personal info browser agents can access
 * - Tracks spending limits and approvals
 * - Ensures users are in control of their data at all times
 *
 * This is the critical trust layer between users and autonomous agents.
 */

import { db } from '../../db.js';
import { userBrowserPermissions, provisioningSessions } from '../../schema.js';
import { eq } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export type ApprovalMode = 'auto_approve' | 'confirm_each' | 'confirm_paid' | 'manual_only';

export type ServiceCategory =
    | 'database'
    | 'auth'
    | 'storage'
    | 'email'
    | 'payments'
    | 'hosting'
    | 'analytics'
    | 'ai'
    | 'other';

export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'apple' | 'facebook';

export interface PaymentMethod {
    id: string;
    type: 'credit_card' | 'bank_account' | 'paypal';
    lastFour?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
}

export interface BrowserPermissions {
    id: string;
    userId: string;

    // Emails
    primaryEmail?: string;
    allowedEmails: string[];

    // 1Password
    allow1PasswordAutofill: boolean;
    onePasswordVaultId?: string;
    allowedPaymentMethods: PaymentMethod[];

    // OAuth
    allowedOAuthProviders: OAuthProvider[];

    // Personal info
    allowPersonalName: boolean;
    allowAddress: boolean;
    allowPhone: boolean;

    // Spending
    maxSpendPerSession: number; // cents
    maxSpendPerMonth: number; // cents
    spentThisMonth: number;
    monthResetDate?: string;

    // Service categories
    allowedServiceCategories: ServiceCategory[];
    blockedServices: string[];

    // Approval mode
    approvalMode: ApprovalMode;

    // Audit
    recordAllActions: boolean;
    notifyOnAccountCreate: boolean;
    notifyOnPaymentUse: boolean;

    createdAt: string;
    updatedAt: string;
}

export interface PermissionRequest {
    sessionId: string;
    requiredServices: {
        service: string;
        category: ServiceCategory;
        requiresPayment: boolean;
        estimatedCost: number;
    }[];
    requiredPermissions: {
        email?: boolean;
        oauth?: OAuthProvider[];
        payment?: boolean;
        personalInfo?: ('name' | 'address' | 'phone')[];
    };
}

export interface PermissionSnapshot {
    approvedAt: string;
    emailUsed: string;
    oauthProviders: string[];
    paymentMethodId?: string;
    maxSpend: number;
    servicesApproved: string[];
}

// ============================================================================
// PERMISSION MANAGER SERVICE
// ============================================================================

export class PermissionManagerService {
    /**
     * Get a user's current permissions
     */
    async getUserPermissions(userId: string): Promise<BrowserPermissions | null> {
        const [permissions] = await db.select()
            .from(userBrowserPermissions)
            .where(eq(userBrowserPermissions.userId, userId));

        if (!permissions) {
            return null;
        }

        return this.mapToPermissions(permissions);
    }

    /**
     * Create default permissions for a new user
     */
    async createDefaultPermissions(userId: string, email: string): Promise<BrowserPermissions> {
        const [existing] = await db.select()
            .from(userBrowserPermissions)
            .where(eq(userBrowserPermissions.userId, userId));

        if (existing) {
            return this.mapToPermissions(existing);
        }

        const [created] = await db.insert(userBrowserPermissions).values({
            userId,
            primaryEmail: email,
            allowedEmails: [email],
            allow1PasswordAutofill: false,
            allowedOAuthProviders: [],
            allowPersonalName: false,
            allowAddress: false,
            allowPhone: false,
            maxSpendPerSession: 500, // $5 default
            maxSpendPerMonth: 5000, // $50 default
            spentThisMonth: 0,
            allowedServiceCategories: ['database', 'auth', 'storage', 'email', 'hosting'],
            blockedServices: [],
            approvalMode: 'confirm_each',
            recordAllActions: true,
            notifyOnAccountCreate: true,
            notifyOnPaymentUse: true,
        }).returning();

        return this.mapToPermissions(created);
    }

    /**
     * Update a user's permissions
     */
    async updatePermissions(
        userId: string,
        updates: Partial<Omit<BrowserPermissions, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
    ): Promise<BrowserPermissions> {
        // Build the update object
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (updates.primaryEmail !== undefined) updateData.primaryEmail = updates.primaryEmail;
        if (updates.allowedEmails !== undefined) updateData.allowedEmails = updates.allowedEmails;
        if (updates.allow1PasswordAutofill !== undefined) updateData.allow1PasswordAutofill = updates.allow1PasswordAutofill;
        if (updates.onePasswordVaultId !== undefined) updateData.onePasswordVaultId = updates.onePasswordVaultId;
        if (updates.allowedPaymentMethods !== undefined) updateData.allowedPaymentMethods = updates.allowedPaymentMethods;
        if (updates.allowedOAuthProviders !== undefined) updateData.allowedOAuthProviders = updates.allowedOAuthProviders;
        if (updates.allowPersonalName !== undefined) updateData.allowPersonalName = updates.allowPersonalName;
        if (updates.allowAddress !== undefined) updateData.allowAddress = updates.allowAddress;
        if (updates.allowPhone !== undefined) updateData.allowPhone = updates.allowPhone;
        if (updates.maxSpendPerSession !== undefined) updateData.maxSpendPerSession = updates.maxSpendPerSession;
        if (updates.maxSpendPerMonth !== undefined) updateData.maxSpendPerMonth = updates.maxSpendPerMonth;
        if (updates.allowedServiceCategories !== undefined) updateData.allowedServiceCategories = updates.allowedServiceCategories;
        if (updates.blockedServices !== undefined) updateData.blockedServices = updates.blockedServices;
        if (updates.approvalMode !== undefined) updateData.approvalMode = updates.approvalMode;
        if (updates.recordAllActions !== undefined) updateData.recordAllActions = updates.recordAllActions;
        if (updates.notifyOnAccountCreate !== undefined) updateData.notifyOnAccountCreate = updates.notifyOnAccountCreate;
        if (updates.notifyOnPaymentUse !== undefined) updateData.notifyOnPaymentUse = updates.notifyOnPaymentUse;

        const [updated] = await db.update(userBrowserPermissions)
            .set(updateData)
            .where(eq(userBrowserPermissions.userId, userId))
            .returning();

        return this.mapToPermissions(updated);
    }

    /**
     * Check if a user has permission for a specific action
     */
    async checkPermission(
        userId: string,
        action: {
            type: 'email' | 'oauth' | 'payment' | 'personal_info' | 'service_signup';
            service?: string;
            category?: ServiceCategory;
            oauthProvider?: OAuthProvider;
            personalInfoType?: 'name' | 'address' | 'phone';
            estimatedCost?: number;
        }
    ): Promise<{ allowed: boolean; reason?: string }> {
        const permissions = await this.getUserPermissions(userId);

        if (!permissions) {
            return { allowed: false, reason: 'No permissions configured. Please set up your browser agent permissions.' };
        }

        switch (action.type) {
            case 'email':
                if (!permissions.primaryEmail && permissions.allowedEmails.length === 0) {
                    return { allowed: false, reason: 'No email addresses configured for agent use.' };
                }
                return { allowed: true };

            case 'oauth':
                if (!action.oauthProvider) {
                    return { allowed: false, reason: 'OAuth provider not specified.' };
                }
                if (!permissions.allowedOAuthProviders.includes(action.oauthProvider)) {
                    return { allowed: false, reason: `OAuth with ${action.oauthProvider} is not enabled.` };
                }
                return { allowed: true };

            case 'payment':
                if (!permissions.allow1PasswordAutofill && permissions.allowedPaymentMethods.length === 0) {
                    return { allowed: false, reason: 'No payment methods configured.' };
                }
                // Check spending limits
                if (action.estimatedCost) {
                    if (action.estimatedCost > permissions.maxSpendPerSession) {
                        return {
                            allowed: false,
                            reason: `Estimated cost ($${(action.estimatedCost / 100).toFixed(2)}) exceeds session limit ($${(permissions.maxSpendPerSession / 100).toFixed(2)}).`
                        };
                    }
                    const remainingMonthly = permissions.maxSpendPerMonth - permissions.spentThisMonth;
                    if (action.estimatedCost > remainingMonthly) {
                        return {
                            allowed: false,
                            reason: `Estimated cost ($${(action.estimatedCost / 100).toFixed(2)}) exceeds remaining monthly budget ($${(remainingMonthly / 100).toFixed(2)}).`
                        };
                    }
                }
                return { allowed: true };

            case 'personal_info':
                if (!action.personalInfoType) {
                    return { allowed: false, reason: 'Personal info type not specified.' };
                }
                switch (action.personalInfoType) {
                    case 'name':
                        if (!permissions.allowPersonalName) {
                            return { allowed: false, reason: 'Using your name is not enabled.' };
                        }
                        break;
                    case 'address':
                        if (!permissions.allowAddress) {
                            return { allowed: false, reason: 'Using your address is not enabled.' };
                        }
                        break;
                    case 'phone':
                        if (!permissions.allowPhone) {
                            return { allowed: false, reason: 'Using your phone number is not enabled.' };
                        }
                        break;
                }
                return { allowed: true };

            case 'service_signup':
                if (!action.service || !action.category) {
                    return { allowed: false, reason: 'Service details not specified.' };
                }
                // Check if service is blocked
                if (permissions.blockedServices.includes(action.service.toLowerCase())) {
                    return { allowed: false, reason: `${action.service} is in your blocked services list.` };
                }
                // Check if category is allowed
                if (!permissions.allowedServiceCategories.includes(action.category)) {
                    return { allowed: false, reason: `Service category "${action.category}" is not enabled.` };
                }
                return { allowed: true };

            default:
                return { allowed: false, reason: 'Unknown action type.' };
        }
    }

    /**
     * Create a permission snapshot for a provisioning session
     * This locks in what was approved for audit purposes
     */
    async createPermissionSnapshot(
        userId: string,
        sessionId: string,
        approvedServices: string[]
    ): Promise<PermissionSnapshot> {
        const permissions = await this.getUserPermissions(userId);

        if (!permissions) {
            throw new Error('No permissions configured for user.');
        }

        const snapshot: PermissionSnapshot = {
            approvedAt: new Date().toISOString(),
            emailUsed: permissions.primaryEmail || permissions.allowedEmails[0] || '',
            oauthProviders: permissions.allowedOAuthProviders,
            paymentMethodId: permissions.allowedPaymentMethods.find(pm => pm.isDefault)?.id,
            maxSpend: permissions.maxSpendPerSession,
            servicesApproved: approvedServices,
        };

        // Save to session
        await db.update(provisioningSessions)
            .set({
                permissionSnapshot: snapshot,
                status: 'provisioning',
                phase: 'account_creation',
            })
            .where(eq(provisioningSessions.id, sessionId));

        return snapshot;
    }

    /**
     * Record spending against user's limits
     */
    async recordSpending(userId: string, amount: number): Promise<void> {
        const permissions = await this.getUserPermissions(userId);

        if (!permissions) {
            throw new Error('No permissions configured for user.');
        }

        // Reset monthly spending if we're in a new month
        const now = new Date();
        const resetDate = permissions.monthResetDate ? new Date(permissions.monthResetDate) : null;

        if (!resetDate || now > resetDate) {
            // Reset and set new reset date
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            await db.update(userBrowserPermissions)
                .set({
                    spentThisMonth: amount,
                    monthResetDate: nextMonth.toISOString(),
                    updatedAt: now.toISOString(),
                })
                .where(eq(userBrowserPermissions.userId, userId));
        } else {
            // Add to current spending
            await db.update(userBrowserPermissions)
                .set({
                    spentThisMonth: permissions.spentThisMonth + amount,
                    updatedAt: now.toISOString(),
                })
                .where(eq(userBrowserPermissions.userId, userId));
        }
    }

    /**
     * Check if session requires user confirmation
     */
    async requiresConfirmation(
        userId: string,
        request: PermissionRequest
    ): Promise<{
        requiresConfirmation: boolean;
        reasons: string[];
        hasPaidServices: boolean;
    }> {
        const permissions = await this.getUserPermissions(userId);

        if (!permissions) {
            return {
                requiresConfirmation: true,
                reasons: ['No permissions configured.'],
                hasPaidServices: false,
            };
        }

        const reasons: string[] = [];
        const hasPaidServices = request.requiredServices.some(s => s.requiresPayment);

        switch (permissions.approvalMode) {
            case 'auto_approve':
                // Still confirm if there are paid services
                if (hasPaidServices) {
                    reasons.push('Paid services require confirmation.');
                }
                break;

            case 'confirm_paid':
                if (hasPaidServices) {
                    reasons.push('Paid services require confirmation.');
                }
                break;

            case 'confirm_each':
                reasons.push('Your approval mode requires confirmation for each session.');
                break;

            case 'manual_only':
                reasons.push('Manual mode: no automatic actions allowed.');
                break;
        }

        // Check for new service categories
        for (const service of request.requiredServices) {
            if (!permissions.allowedServiceCategories.includes(service.category)) {
                reasons.push(`New service category: ${service.category}`);
            }
        }

        // Check for OAuth requirements
        if (request.requiredPermissions.oauth) {
            for (const provider of request.requiredPermissions.oauth) {
                if (!permissions.allowedOAuthProviders.includes(provider)) {
                    reasons.push(`OAuth with ${provider} not enabled.`);
                }
            }
        }

        return {
            requiresConfirmation: reasons.length > 0,
            reasons,
            hasPaidServices,
        };
    }

    /**
     * Get a summary of user's permission setup for UI display
     */
    async getPermissionsSummary(userId: string): Promise<{
        configured: boolean;
        emailConfigured: boolean;
        paymentConfigured: boolean;
        oauthProviders: OAuthProvider[];
        allowedCategories: ServiceCategory[];
        approvalMode: ApprovalMode;
        monthlyBudget: number;
        monthlySpent: number;
    }> {
        const permissions = await this.getUserPermissions(userId);

        if (!permissions) {
            return {
                configured: false,
                emailConfigured: false,
                paymentConfigured: false,
                oauthProviders: [],
                allowedCategories: [],
                approvalMode: 'manual_only',
                monthlyBudget: 0,
                monthlySpent: 0,
            };
        }

        return {
            configured: true,
            emailConfigured: !!permissions.primaryEmail || permissions.allowedEmails.length > 0,
            paymentConfigured: permissions.allow1PasswordAutofill || permissions.allowedPaymentMethods.length > 0,
            oauthProviders: permissions.allowedOAuthProviders,
            allowedCategories: permissions.allowedServiceCategories,
            approvalMode: permissions.approvalMode,
            monthlyBudget: permissions.maxSpendPerMonth,
            monthlySpent: permissions.spentThisMonth,
        };
    }

    /**
     * Map database row to typed permissions object
     */
    private mapToPermissions(row: typeof userBrowserPermissions.$inferSelect): BrowserPermissions {
        return {
            id: row.id,
            userId: row.userId,
            primaryEmail: row.primaryEmail || undefined,
            allowedEmails: (row.allowedEmails as string[]) || [],
            allow1PasswordAutofill: row.allow1PasswordAutofill ?? false,
            onePasswordVaultId: row.onePasswordVaultId || undefined,
            allowedPaymentMethods: (row.allowedPaymentMethods as PaymentMethod[]) || [],
            allowedOAuthProviders: (row.allowedOAuthProviders as OAuthProvider[]) || [],
            allowPersonalName: row.allowPersonalName ?? false,
            allowAddress: row.allowAddress ?? false,
            allowPhone: row.allowPhone ?? false,
            maxSpendPerSession: row.maxSpendPerSession ?? 500,
            maxSpendPerMonth: row.maxSpendPerMonth ?? 5000,
            spentThisMonth: row.spentThisMonth ?? 0,
            monthResetDate: row.monthResetDate || undefined,
            allowedServiceCategories: (row.allowedServiceCategories as ServiceCategory[]) || [],
            blockedServices: (row.blockedServices as string[]) || [],
            approvalMode: (row.approvalMode as ApprovalMode) || 'confirm_each',
            recordAllActions: row.recordAllActions ?? true,
            notifyOnAccountCreate: row.notifyOnAccountCreate ?? true,
            notifyOnPaymentUse: row.notifyOnPaymentUse ?? true,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: PermissionManagerService | null = null;

export function getPermissionManagerService(): PermissionManagerService {
    if (!instance) {
        instance = new PermissionManagerService();
    }
    return instance;
}
