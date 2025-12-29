/**
 * Provisioning Agent Service
 *
 * The main orchestrator for autonomous browser-based provisioning:
 * - Coordinates research, permissions, and browser agents
 * - Manages the complete provisioning flow
 * - Integrates credentials into project environment
 *
 * This is the core service that replaces manual credential fetching.
 */

import { db } from '../../db.js';
import {
    provisioningSessions,
    browserAgentTasks,
    externalServiceCredentials,
    projectEnvVars,
} from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { getTaskIntentLockService, type TaskIntentDefinition } from './task-intent-lock.js';
import { getBrowserbaseClient } from './browserbase-client.js';
import { getOnePasswordClient } from './onepassword-client.js';
import { getResearchAgentService, type ServiceRequirement, type ResearchResult } from './research-agent.js';
import { getPermissionManagerService, type PermissionSnapshot, type ServiceCategory } from './permission-manager.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface ProvisioningRequest {
    projectId: string;
    userId: string;
    orchestrationRunId?: string;
    requirements: ServiceRequirement[];
    forceRecreate?: boolean; // Re-create accounts even if credentials exist
}

export interface ProvisioningResult {
    success: boolean;
    sessionId: string;
    credentialsIntegrated: number;
    credentialsFailed: number;
    totalCost: number; // cents
    errors: string[];
    credentials: {
        serviceName: string;
        envVarName: string;
        integrated: boolean;
    }[];
}

export interface TaskExecutionResult {
    taskId: string;
    success: boolean;
    credentialsFetched: string[];
    error?: string;
    durationMs: number;
}

// ============================================================================
// ENCRYPTION HELPERS
// ============================================================================

const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY ||
    'default-dev-key-32-chars-long!'; // Must be 32 chars for AES-256

function encryptCredential(value: string): { encrypted: string; iv: string; authTag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);

    let encrypted = cipher.update(value, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
    };
}

function decryptCredential(encrypted: string, iv: string, authTag: string): string {
    const decipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from(ENCRYPTION_KEY, 'utf-8'),
        Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
}

// ============================================================================
// PROVISIONING AGENT SERVICE
// ============================================================================

export class ProvisioningAgentService {
    private taskIntentService = getTaskIntentLockService();
    private browserbaseClient = getBrowserbaseClient();
    private onePasswordClient = getOnePasswordClient();
    private researchAgent = getResearchAgentService();
    private permissionManager = getPermissionManagerService();

    /**
     * Start a complete provisioning flow
     */
    async startProvisioning(request: ProvisioningRequest): Promise<ProvisioningResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        const integratedCredentials: ProvisioningResult['credentials'] = [];

        // 1. Create provisioning session
        const [session] = await db.insert(provisioningSessions).values({
            projectId: request.projectId,
            userId: request.userId,
            orchestrationRunId: request.orchestrationRunId,
            status: 'pending',
            requiredServices: request.requirements,
            totalTasks: 0,
        }).returning();

        const sessionId = session.id;

        try {
            // 2. Phase 0.25: Research
            console.log(`[Provisioning] Starting research phase for session ${sessionId}`);
            const researchResults = await this.researchAgent.researchServices({
                provisioningSessionId: sessionId,
                projectId: request.projectId,
                userId: request.userId,
                requirements: request.requirements,
            });

            // 3. Phase 0.5: Permission capture
            console.log(`[Provisioning] Checking permissions for session ${sessionId}`);
            const permissionCheck = await this.permissionManager.requiresConfirmation(
                request.userId,
                {
                    sessionId,
                    requiredServices: researchResults.map(r => ({
                        service: r.provider,
                        category: this.mapToServiceCategory(r.serviceName),
                        requiresPayment: !r.hasFreeTier,
                        estimatedCost: r.estimatedCost,
                    })),
                    requiredPermissions: {
                        email: true,
                        oauth: researchResults.filter(r => r.oauthAvailable).map(() => 'github' as const),
                    },
                }
            );

            if (permissionCheck.requiresConfirmation) {
                // Update session to await permissions
                await db.update(provisioningSessions)
                    .set({
                        status: 'awaiting_permissions',
                        phase: 'permission_capture',
                    })
                    .where(eq(provisioningSessions.id, sessionId));

                // Return early - frontend will handle permission UI
                return {
                    success: false,
                    sessionId,
                    credentialsIntegrated: 0,
                    credentialsFailed: 0,
                    totalCost: 0,
                    errors: permissionCheck.reasons,
                    credentials: [],
                };
            }

            // 4. Create permission snapshot
            const permissionSnapshot = await this.permissionManager.createPermissionSnapshot(
                request.userId,
                sessionId,
                researchResults.map(r => r.provider)
            );

            // 5. Phase 0.75: Execute provisioning tasks
            console.log(`[Provisioning] Starting provisioning phase for session ${sessionId}`);
            const taskResults = await this.executeProvisioningTasks(
                sessionId,
                request.projectId,
                request.userId,
                researchResults,
                permissionSnapshot
            );

            // 6. Integrate credentials into project
            console.log(`[Provisioning] Integrating credentials for session ${sessionId}`);
            for (const result of taskResults) {
                if (result.success && result.credentialsFetched.length > 0) {
                    for (const credentialId of result.credentialsFetched) {
                        const integrated = await this.integrateCredential(
                            credentialId,
                            request.projectId
                        );

                        // Get credential details for result
                        const [credential] = await db.select()
                            .from(externalServiceCredentials)
                            .where(eq(externalServiceCredentials.id, credentialId));

                        if (credential) {
                            integratedCredentials.push({
                                serviceName: credential.serviceName,
                                envVarName: credential.envVarName,
                                integrated,
                            });
                        }

                        if (!integrated) {
                            errors.push(`Failed to integrate ${credential?.envVarName || credentialId}`);
                        }
                    }
                } else if (!result.success) {
                    errors.push(result.error || `Task ${result.taskId} failed`);
                }
            }

            // 7. Calculate totals
            const credentialsIntegrated = integratedCredentials.filter(c => c.integrated).length;
            const credentialsFailed = integratedCredentials.filter(c => !c.integrated).length;

            // 8. Update session status
            const totalCost = researchResults.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

            await db.update(provisioningSessions)
                .set({
                    status: credentialsFailed === 0 ? 'completed' : 'failed',
                    phase: 'integration',
                    completedTasks: credentialsIntegrated,
                    failedTasks: credentialsFailed,
                    actualCost: totalCost,
                    completedAt: new Date().toISOString(),
                })
                .where(eq(provisioningSessions.id, sessionId));

            // 9. Record spending
            if (totalCost > 0) {
                await this.permissionManager.recordSpending(request.userId, totalCost);
            }

            return {
                success: credentialsFailed === 0,
                sessionId,
                credentialsIntegrated,
                credentialsFailed,
                totalCost,
                errors,
                credentials: integratedCredentials,
            };

        } catch (error) {
            console.error(`[Provisioning] Error in session ${sessionId}:`, error);

            await db.update(provisioningSessions)
                .set({
                    status: 'failed',
                    lastError: error instanceof Error ? error.message : 'Unknown error',
                    errorCount: (session.errorCount || 0) + 1,
                })
                .where(eq(provisioningSessions.id, sessionId));

            return {
                success: false,
                sessionId,
                credentialsIntegrated: 0,
                credentialsFailed: request.requirements.length,
                totalCost: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                credentials: [],
            };
        }
    }

    /**
     * Resume provisioning after user approves permissions
     */
    async resumeProvisioning(
        sessionId: string,
        approvedServices: string[]
    ): Promise<ProvisioningResult> {
        const [session] = await db.select()
            .from(provisioningSessions)
            .where(eq(provisioningSessions.id, sessionId));

        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        if (session.status !== 'awaiting_permissions') {
            throw new Error(`Session is not awaiting permissions: ${session.status}`);
        }

        // Create permission snapshot
        const permissionSnapshot = await this.permissionManager.createPermissionSnapshot(
            session.userId,
            sessionId,
            approvedServices
        );

        // Get research results
        const researchResults = (session.researchResults as ResearchResult[]) || [];

        // Filter to only approved services
        const filteredResults = researchResults.filter(r =>
            approvedServices.includes(r.provider)
        );

        // Execute tasks
        const taskResults = await this.executeProvisioningTasks(
            sessionId,
            session.projectId,
            session.userId,
            filteredResults,
            permissionSnapshot
        );

        // Process results
        const integratedCredentials: ProvisioningResult['credentials'] = [];
        const errors: string[] = [];

        for (const result of taskResults) {
            if (result.success && result.credentialsFetched.length > 0) {
                for (const credentialId of result.credentialsFetched) {
                    const integrated = await this.integrateCredential(
                        credentialId,
                        session.projectId
                    );

                    const [credential] = await db.select()
                        .from(externalServiceCredentials)
                        .where(eq(externalServiceCredentials.id, credentialId));

                    if (credential) {
                        integratedCredentials.push({
                            serviceName: credential.serviceName,
                            envVarName: credential.envVarName,
                            integrated,
                        });
                    }
                }
            } else if (!result.success) {
                errors.push(result.error || `Task ${result.taskId} failed`);
            }
        }

        const credentialsIntegrated = integratedCredentials.filter(c => c.integrated).length;
        const credentialsFailed = integratedCredentials.filter(c => !c.integrated).length;

        await db.update(provisioningSessions)
            .set({
                status: credentialsFailed === 0 ? 'completed' : 'failed',
                completedTasks: credentialsIntegrated,
                failedTasks: credentialsFailed,
                completedAt: new Date().toISOString(),
            })
            .where(eq(provisioningSessions.id, sessionId));

        return {
            success: credentialsFailed === 0,
            sessionId,
            credentialsIntegrated,
            credentialsFailed,
            totalCost: 0,
            errors,
            credentials: integratedCredentials,
        };
    }

    /**
     * Execute all provisioning tasks for a session
     */
    private async executeProvisioningTasks(
        sessionId: string,
        projectId: string,
        userId: string,
        researchResults: ResearchResult[],
        permissionSnapshot: PermissionSnapshot
    ): Promise<TaskExecutionResult[]> {
        const results: TaskExecutionResult[] = [];

        // Create tasks for each service
        for (const research of researchResults) {
            // Create intent lock for this task
            const taskDefinition: TaskIntentDefinition = {
                serviceName: research.provider,
                taskType: 'signup',
                goal: `Create account on ${research.provider} and fetch all required credentials: ${research.credentialsToFetch.join(', ')}`,
            };

            const intentLock = await this.taskIntentService.createTaskIntent(
                sessionId,
                taskDefinition
            );

            // Create the browser agent task
            const [task] = await db.insert(browserAgentTasks).values({
                provisioningSessionId: sessionId,
                projectId,
                userId,
                taskType: 'signup',
                serviceName: research.provider,
                targetUrl: research.signupUrl,
                goal: taskDefinition.goal,
                intentLockId: intentLock.id,
                status: 'pending',
            }).returning();

            // Link intent to task
            await this.taskIntentService.linkToTask(intentLock.id, task.id);

            // Execute the task
            try {
                const result = await this.executeTask(
                    task.id,
                    research,
                    userId,
                    sessionId,
                    permissionSnapshot
                );
                results.push(result);
            } catch (error) {
                results.push({
                    taskId: task.id,
                    success: false,
                    credentialsFetched: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                    durationMs: 0,
                });
            }
        }

        return results;
    }

    /**
     * Execute a single browser agent task
     */
    private async executeTask(
        taskId: string,
        research: ResearchResult,
        userId: string,
        sessionId: string,
        permissionSnapshot: PermissionSnapshot
    ): Promise<TaskExecutionResult> {
        const startTime = Date.now();
        const credentialsFetched: string[] = [];

        try {
            // Check if Browserbase is available
            if (!this.browserbaseClient.isConfigured()) {
                // Fallback: create placeholder credentials that user must fill
                console.log(`[Provisioning] Browserbase not configured, creating placeholders for ${research.provider}`);

                for (const envVar of research.credentialsToFetch) {
                    const { encrypted, iv, authTag } = encryptCredential('');

                    const [credential] = await db.insert(externalServiceCredentials).values({
                        provisioningSessionId: sessionId,
                        browserAgentTaskId: taskId,
                        projectId: '', // Will be set on integration
                        userId,
                        serviceName: research.provider,
                        credentialType: this.inferCredentialType(envVar),
                        credentialName: envVar,
                        envVarName: envVar,
                        encryptedValue: encrypted,
                        encryptionIv: iv,
                        encryptionAuthTag: authTag,
                        fetchedVia: 'manual',
                        dashboardUrl: research.dashboardUrl,
                    }).returning();

                    credentialsFetched.push(credential.id);
                }

                await db.update(browserAgentTasks)
                    .set({
                        status: 'completed',
                        completedAt: new Date().toISOString(),
                        actualDurationMs: Date.now() - startTime,
                        credentialsFetched,
                    })
                    .where(eq(browserAgentTasks.id, taskId));

                return {
                    taskId,
                    success: true,
                    credentialsFetched,
                    durationMs: Date.now() - startTime,
                };
            }

            // Create browser session
            const session = await this.browserbaseClient.createSession(taskId);
            const auditContext = { userId, provisioningSessionId: sessionId };

            // Navigate to signup URL
            await this.browserbaseClient.navigateTo(taskId, research.signupUrl, auditContext);

            // Execute signup flow using AI navigation
            // This is a simplified example - real implementation would have more steps
            if (research.oauthAvailable && permissionSnapshot.oauthProviders.length > 0) {
                // Try OAuth signup
                await this.browserbaseClient.executeNaturalLanguage(
                    taskId,
                    `Click the "Sign up with ${permissionSnapshot.oauthProviders[0]}" or similar OAuth button`,
                    auditContext
                );

                // Wait for OAuth flow
                await this.browserbaseClient.waitFor(taskId, '[data-testid="dashboard"]', 30000);
            } else {
                // Email signup
                await this.browserbaseClient.executeNaturalLanguage(
                    taskId,
                    `Enter email "${permissionSnapshot.emailUsed}" in the email field`,
                    auditContext
                );

                // Continue with signup steps...
                // This would be more detailed in production
            }

            // Navigate to API keys / credentials page
            await this.browserbaseClient.executeNaturalLanguage(
                taskId,
                'Navigate to API keys, settings, or credentials section',
                auditContext
            );

            // Extract credentials
            for (const envVar of research.credentialsToFetch) {
                const keyName = this.getKeyDisplayName(envVar);

                // Try to find and extract the credential
                const result = await this.browserbaseClient.executeNaturalLanguage(
                    taskId,
                    `Find and copy the ${keyName} value`,
                    auditContext
                );

                if (result.success && result.extractedData) {
                    const value = Object.values(result.extractedData)[0] || '';

                    const { encrypted, iv, authTag } = encryptCredential(value);

                    const [credential] = await db.insert(externalServiceCredentials).values({
                        provisioningSessionId: sessionId,
                        browserAgentTaskId: taskId,
                        projectId: '', // Will be set on integration
                        userId,
                        serviceName: research.provider,
                        credentialType: this.inferCredentialType(envVar),
                        credentialName: envVar,
                        envVarName: envVar,
                        encryptedValue: encrypted,
                        encryptionIv: iv,
                        encryptionAuthTag: authTag,
                        isValidated: value.length > 0,
                        fetchedVia: 'browser_agent',
                        dashboardUrl: research.dashboardUrl,
                    }).returning();

                    credentialsFetched.push(credential.id);
                }
            }

            // Close browser session
            await this.browserbaseClient.closeSession(taskId);

            // Update task
            await db.update(browserAgentTasks)
                .set({
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    actualDurationMs: Date.now() - startTime,
                    credentialsFetched,
                    progress: 100,
                })
                .where(eq(browserAgentTasks.id, taskId));

            return {
                taskId,
                success: true,
                credentialsFetched,
                durationMs: Date.now() - startTime,
            };

        } catch (error) {
            console.error(`[Provisioning] Task ${taskId} failed:`, error);

            await this.browserbaseClient.closeSession(taskId);

            await db.update(browserAgentTasks)
                .set({
                    status: 'failed',
                    lastAttemptError: error instanceof Error ? error.message : 'Unknown error',
                    attempts: 1,
                    actualDurationMs: Date.now() - startTime,
                })
                .where(eq(browserAgentTasks.id, taskId));

            return {
                taskId,
                success: false,
                credentialsFetched,
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startTime,
            };
        }
    }

    /**
     * Integrate a credential into the project's environment
     */
    private async integrateCredential(credentialId: string, projectId: string): Promise<boolean> {
        try {
            const [credential] = await db.select()
                .from(externalServiceCredentials)
                .where(eq(externalServiceCredentials.id, credentialId));

            if (!credential) {
                return false;
            }

            // Check if env var already exists
            const [existing] = await db.select()
                .from(projectEnvVars)
                .where(and(
                    eq(projectEnvVars.projectId, projectId),
                    eq(projectEnvVars.envKey, credential.envVarName)
                ));

            if (existing) {
                // Update existing
                await db.update(projectEnvVars)
                    .set({
                        staticValue: credential.encryptedValue,
                        staticValueIv: credential.encryptionIv,
                        staticValueAuthTag: credential.encryptionAuthTag,
                        isSecret: true,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(projectEnvVars.id, existing.id));

                await db.update(externalServiceCredentials)
                    .set({
                        projectId,
                        isIntegrated: true,
                        integratedAt: new Date().toISOString(),
                        projectEnvVarId: existing.id,
                    })
                    .where(eq(externalServiceCredentials.id, credentialId));
            } else {
                // Create new env var
                const [envVar] = await db.insert(projectEnvVars).values({
                    projectId,
                    envKey: credential.envVarName,
                    sourceKey: credential.credentialName,
                    staticValue: credential.encryptedValue,
                    staticValueIv: credential.encryptionIv,
                    staticValueAuthTag: credential.encryptionAuthTag,
                    isSecret: true,
                    environment: 'all',
                }).returning();

                await db.update(externalServiceCredentials)
                    .set({
                        projectId,
                        isIntegrated: true,
                        integratedAt: new Date().toISOString(),
                        projectEnvVarId: envVar.id,
                    })
                    .where(eq(externalServiceCredentials.id, credentialId));
            }

            return true;
        } catch (error) {
            console.error(`[Provisioning] Failed to integrate credential ${credentialId}:`, error);
            return false;
        }
    }

    /**
     * Get session status
     */
    async getSessionStatus(sessionId: string): Promise<{
        status: string;
        phase?: string;
        progress: number;
        tasks: {
            id: string;
            service: string;
            status: string;
            progress: number;
        }[];
    }> {
        const [session] = await db.select()
            .from(provisioningSessions)
            .where(eq(provisioningSessions.id, sessionId));

        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const tasks = await db.select()
            .from(browserAgentTasks)
            .where(eq(browserAgentTasks.provisioningSessionId, sessionId));

        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const totalTasks = tasks.length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
            status: session.status,
            phase: session.phase || undefined,
            progress,
            tasks: tasks.map(t => ({
                id: t.id,
                service: t.serviceName,
                status: t.status,
                progress: t.progress || 0,
            })),
        };
    }

    /**
     * Cancel a provisioning session
     */
    async cancelSession(sessionId: string): Promise<void> {
        const tasks = await db.select()
            .from(browserAgentTasks)
            .where(eq(browserAgentTasks.provisioningSessionId, sessionId));

        // Close any active browser sessions
        for (const task of tasks) {
            if (task.status === 'running') {
                await this.browserbaseClient.closeSession(task.id);
            }
        }

        // Update session
        await db.update(provisioningSessions)
            .set({
                status: 'cancelled',
                completedAt: new Date().toISOString(),
            })
            .where(eq(provisioningSessions.id, sessionId));

        // Update tasks
        await db.update(browserAgentTasks)
            .set({ status: 'cancelled' })
            .where(and(
                eq(browserAgentTasks.provisioningSessionId, sessionId),
                eq(browserAgentTasks.status, 'pending')
            ));
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    private mapToServiceCategory(serviceName: string): ServiceCategory {
        const categoryMap: Record<string, ServiceCategory> = {
            database: 'database',
            auth: 'auth',
            authentication: 'auth',
            storage: 'storage',
            email: 'email',
            payments: 'payments',
            payment: 'payments',
            hosting: 'hosting',
            analytics: 'analytics',
            ai: 'ai',
        };

        return categoryMap[serviceName.toLowerCase()] || 'other';
    }

    private inferCredentialType(envVarName: string): 'api_key' | 'secret_key' | 'connection_string' | 'oauth_token' | 'webhook_secret' | 'public_key' | 'private_key' | 'other' {
        const name = envVarName.toLowerCase();

        if (name.includes('secret') || name.includes('private')) {
            return name.includes('webhook') ? 'webhook_secret' : 'secret_key';
        }
        if (name.includes('public') || name.includes('publishable') || name.includes('anon')) {
            return 'public_key';
        }
        if (name.includes('url') || name.includes('connection') || name.includes('database')) {
            return 'connection_string';
        }
        if (name.includes('token') || name.includes('auth')) {
            return 'oauth_token';
        }
        if (name.includes('key') || name.includes('api')) {
            return 'api_key';
        }

        return 'other';
    }

    private getKeyDisplayName(envVarName: string): string {
        // Convert ENV_VAR_NAME to readable format
        return envVarName
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase());
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: ProvisioningAgentService | null = null;

export function getProvisioningAgentService(): ProvisioningAgentService {
    if (!instance) {
        instance = new ProvisioningAgentService();
    }
    return instance;
}
