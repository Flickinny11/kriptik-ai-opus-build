/**
 * Task Intent Lock Service
 *
 * Implements the Cascading Intent Lock System for browser agent tasks:
 * - Project Intent (from build_intents) → Phase Intent → Task Intent
 *
 * Each task has an immutable "done" definition created BEFORE execution,
 * ensuring agents know exactly what success looks like and can verify it.
 */

import { db } from '../../db.js';
import { taskIntentLocks, browserAgentTasks, provisioningSessions, buildIntents } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { getModelRouter } from '../ai/model-router.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TaskIntentDefinition {
    serviceName: string;
    taskType: 'research' | 'signup' | 'oauth_connect' | 'fetch_credentials' | 'configure_settings' | 'verify_connection' | 'enable_feature';
    goal: string;
    context?: string;
}

export interface SuccessCriterion {
    type: 'credential_exists' | 'api_responds' | 'dashboard_accessible' | 'feature_enabled' | 'custom';
    key?: string;
    expectedValue?: string;
    validationEndpoint?: string;
    description?: string;
}

export interface TaskIntentLock {
    id: string;
    provisioningSessionId: string;
    browserAgentTaskId?: string;
    buildIntentId?: string;
    scope: 'phase' | 'task' | 'subtask';
    serviceName: string;
    taskType: string;
    expectedOutcomes: string[];
    successCriteria: SuccessCriterion[];
    antiPatterns: string[];
    locked: boolean;
    lockedAt?: string;
    verified: boolean;
    verifiedAt?: string;
    verificationDetails?: {
        criterionIndex: number;
        passed: boolean;
        actualValue?: string;
        error?: string;
    }[];
    generatedBy: string;
    tokensUsed: number;
    createdAt: string;
}

export interface VerificationResult {
    passed: boolean;
    details: {
        criterionIndex: number;
        criterion: SuccessCriterion;
        passed: boolean;
        actualValue?: string;
        error?: string;
    }[];
    overallScore: number; // 0-100
}

// ============================================================================
// INTENT GENERATION PROMPTS
// ============================================================================

const TASK_INTENT_SYSTEM_PROMPT = `You are an expert at defining precise success criteria for browser automation tasks.

Your job is to create an "Intent Lock" - an IMMUTABLE definition of what "done" looks like for a task.
This Intent Lock will be used to:
1. Guide the browser agent on exactly what to accomplish
2. Verify that the task was completed successfully

Be SPECIFIC and MEASURABLE. Vague success criteria lead to failed tasks.

For each task type, consider:
- SIGNUP: Account creation confirmed, email verified if needed, API keys generated
- FETCH_CREDENTIALS: Specific keys/secrets extracted, format validated
- CONFIGURE_SETTINGS: Settings verified via API call or page state
- OAUTH_CONNECT: OAuth flow completed, tokens stored, refresh capability confirmed
- VERIFY_CONNECTION: API responds correctly, authentication works

Output ONLY valid JSON matching this schema:
{
    "expectedOutcomes": ["Specific outcome 1", "Specific outcome 2"],
    "successCriteria": [
        {
            "type": "credential_exists" | "api_responds" | "dashboard_accessible" | "feature_enabled" | "custom",
            "key": "credential key name if applicable",
            "expectedValue": "expected value or pattern if applicable",
            "validationEndpoint": "API endpoint to call for validation if applicable",
            "description": "Human-readable description of this criterion"
        }
    ],
    "antiPatterns": ["What NOT to do 1", "What NOT to do 2"]
}`;

// ============================================================================
// TASK INTENT LOCK SERVICE
// ============================================================================

export class TaskIntentLockService {
    private modelRouter = getModelRouter();

    /**
     * Create and lock a task intent before execution begins
     * This ensures the agent knows exactly what "done" looks like
     */
    async createTaskIntent(
        provisioningSessionId: string,
        taskDefinition: TaskIntentDefinition,
        parentBuildIntentId?: string
    ): Promise<TaskIntentLock> {
        // Generate the intent lock using AI
        const generatedIntent = await this.generateIntentLock(taskDefinition);

        // Insert into database
        const [intent] = await db.insert(taskIntentLocks).values({
            provisioningSessionId,
            buildIntentId: parentBuildIntentId,
            scope: 'task',
            serviceName: taskDefinition.serviceName,
            taskType: taskDefinition.taskType,
            expectedOutcomes: generatedIntent.expectedOutcomes,
            successCriteria: generatedIntent.successCriteria,
            antiPatterns: generatedIntent.antiPatterns,
            locked: true, // Lock immediately - no modifications allowed
            lockedAt: new Date().toISOString(),
            generatedBy: 'claude-sonnet-4-5',
            tokensUsed: generatedIntent.tokensUsed,
        }).returning();

        return this.mapToTaskIntentLock(intent);
    }

    /**
     * Create a phase-level intent lock (higher abstraction than task)
     */
    async createPhaseIntent(
        provisioningSessionId: string,
        phase: 'research' | 'permission_capture' | 'account_creation' | 'credential_fetch' | 'verification' | 'integration',
        services: string[],
        parentBuildIntentId?: string
    ): Promise<TaskIntentLock> {
        const phaseDescriptions: Record<string, string> = {
            research: 'Research all required services, identify signup URLs, free tiers, and required credentials',
            permission_capture: 'Capture user permission for accessing personal info and payment methods',
            account_creation: 'Create accounts on all required services using approved credentials',
            credential_fetch: 'Extract all API keys, secrets, and connection strings from service dashboards',
            verification: 'Verify all credentials work by making test API calls',
            integration: 'Integrate all credentials into project environment variables',
        };

        const expectedOutcomes: string[] = [];
        const successCriteria: SuccessCriterion[] = [];
        const antiPatterns: string[] = [];

        // Build phase-level criteria based on the phase type
        switch (phase) {
            case 'research':
                expectedOutcomes.push(
                    'All required services identified with signup URLs',
                    'Free tier availability confirmed for each service',
                    'Required credentials list compiled for each service'
                );
                successCriteria.push({
                    type: 'custom',
                    description: `Research results contain entries for: ${services.join(', ')}`,
                });
                antiPatterns.push(
                    'Do not skip any required services',
                    'Do not assume free tier availability without verification'
                );
                break;

            case 'account_creation':
                services.forEach(service => {
                    expectedOutcomes.push(`${service} account created successfully`);
                    successCriteria.push({
                        type: 'dashboard_accessible',
                        key: service,
                        description: `${service} dashboard is accessible after login`,
                    });
                });
                antiPatterns.push(
                    'Do not use credentials without user permission',
                    'Do not sign up for paid plans without explicit approval'
                );
                break;

            case 'credential_fetch':
                services.forEach(service => {
                    expectedOutcomes.push(`${service} credentials extracted`);
                    successCriteria.push({
                        type: 'credential_exists',
                        key: service,
                        description: `All required credentials for ${service} are stored`,
                    });
                });
                antiPatterns.push(
                    'Do not store credentials in plaintext',
                    'Do not skip credential validation'
                );
                break;

            case 'verification':
                services.forEach(service => {
                    expectedOutcomes.push(`${service} credentials verified`);
                    successCriteria.push({
                        type: 'api_responds',
                        key: service,
                        description: `API call to ${service} succeeds with stored credentials`,
                    });
                });
                break;

            case 'integration':
                expectedOutcomes.push(
                    'All credentials added to project environment',
                    'Dependencies installed if required',
                    'Integration verified with build test'
                );
                successCriteria.push({
                    type: 'custom',
                    description: 'Project builds successfully with all environment variables',
                });
                break;
        }

        const [intent] = await db.insert(taskIntentLocks).values({
            provisioningSessionId,
            buildIntentId: parentBuildIntentId,
            scope: 'phase',
            serviceName: services.join(','),
            taskType: phase,
            expectedOutcomes,
            successCriteria,
            antiPatterns,
            locked: true,
            lockedAt: new Date().toISOString(),
            generatedBy: 'system',
            tokensUsed: 0,
        }).returning();

        return this.mapToTaskIntentLock(intent);
    }

    /**
     * Generate intent lock using AI
     */
    private async generateIntentLock(taskDefinition: TaskIntentDefinition): Promise<{
        expectedOutcomes: string[];
        successCriteria: SuccessCriterion[];
        antiPatterns: string[];
        tokensUsed: number;
    }> {
        const prompt = `Generate an Intent Lock for this browser automation task:

Service: ${taskDefinition.serviceName}
Task Type: ${taskDefinition.taskType}
Goal: ${taskDefinition.goal}
${taskDefinition.context ? `Context: ${taskDefinition.context}` : ''}

Create specific, measurable success criteria that can be verified programmatically.`;

        try {
            const response = await this.modelRouter.generate({
                prompt,
                systemPrompt: TASK_INTENT_SYSTEM_PROMPT,
                taskType: 'planning',
                forceTier: 'standard', // Use Sonnet for fast, quality generation
                maxTokens: 1000,
            });

            // Parse the JSON response
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                expectedOutcomes: parsed.expectedOutcomes || [],
                successCriteria: parsed.successCriteria || [],
                antiPatterns: parsed.antiPatterns || [],
                tokensUsed: response.usage?.totalTokens || 0,
            };
        } catch (error) {
            console.error('[TaskIntentLock] Error generating intent:', error);
            // Fallback to basic intent
            return this.generateFallbackIntent(taskDefinition);
        }
    }

    /**
     * Fallback intent generation when AI fails
     */
    private generateFallbackIntent(taskDefinition: TaskIntentDefinition): {
        expectedOutcomes: string[];
        successCriteria: SuccessCriterion[];
        antiPatterns: string[];
        tokensUsed: number;
    } {
        const outcomes: string[] = [];
        const criteria: SuccessCriterion[] = [];
        const antiPatterns: string[] = ['Do not proceed without verification', 'Do not store unencrypted credentials'];

        switch (taskDefinition.taskType) {
            case 'signup':
                outcomes.push(
                    `${taskDefinition.serviceName} account created`,
                    'Account email verified if required',
                    'Initial API key or credentials generated'
                );
                criteria.push(
                    { type: 'dashboard_accessible', key: taskDefinition.serviceName, description: 'Dashboard is accessible' },
                    { type: 'credential_exists', key: `${taskDefinition.serviceName}_API_KEY`, description: 'API key exists' }
                );
                break;

            case 'fetch_credentials':
                outcomes.push(`${taskDefinition.serviceName} credentials extracted`);
                criteria.push(
                    { type: 'credential_exists', key: taskDefinition.serviceName, description: 'Credentials are stored' }
                );
                break;

            case 'oauth_connect':
                outcomes.push(`OAuth connection to ${taskDefinition.serviceName} established`);
                criteria.push(
                    { type: 'api_responds', key: taskDefinition.serviceName, description: 'OAuth token is valid' }
                );
                break;

            case 'verify_connection':
                outcomes.push(`${taskDefinition.serviceName} connection verified`);
                criteria.push(
                    { type: 'api_responds', key: taskDefinition.serviceName, description: 'API responds correctly' }
                );
                break;

            default:
                outcomes.push(`${taskDefinition.goal}`);
                criteria.push({ type: 'custom', description: taskDefinition.goal });
        }

        return { expectedOutcomes: outcomes, successCriteria: criteria, antiPatterns, tokensUsed: 0 };
    }

    /**
     * Verify a task against its intent lock
     */
    async verifyTaskCompletion(
        intentLockId: string,
        actualResults: {
            credentials?: { key: string; value?: string }[];
            apiResponses?: { service: string; success: boolean; error?: string }[];
            dashboardUrls?: { service: string; accessible: boolean }[];
            customChecks?: { description: string; passed: boolean; actualValue?: string }[];
        }
    ): Promise<VerificationResult> {
        // Get the intent lock
        const [intent] = await db.select().from(taskIntentLocks).where(eq(taskIntentLocks.id, intentLockId));

        if (!intent) {
            throw new Error(`Intent lock not found: ${intentLockId}`);
        }

        if (!intent.locked) {
            throw new Error(`Intent lock is not locked: ${intentLockId}`);
        }

        const successCriteria = intent.successCriteria as SuccessCriterion[];
        const verificationDetails: VerificationResult['details'] = [];

        for (let i = 0; i < successCriteria.length; i++) {
            const criterion = successCriteria[i];
            let passed = false;
            let actualValue: string | undefined;
            let error: string | undefined;

            switch (criterion.type) {
                case 'credential_exists':
                    const credential = actualResults.credentials?.find(c =>
                        c.key.toLowerCase().includes(criterion.key?.toLowerCase() || '')
                    );
                    passed = !!credential && !!credential.value;
                    actualValue = credential ? 'EXISTS' : 'NOT_FOUND';
                    break;

                case 'api_responds':
                    const apiResult = actualResults.apiResponses?.find(r =>
                        r.service.toLowerCase().includes(criterion.key?.toLowerCase() || '')
                    );
                    passed = apiResult?.success || false;
                    actualValue = apiResult?.success ? 'SUCCESS' : 'FAILED';
                    error = apiResult?.error;
                    break;

                case 'dashboard_accessible':
                    const dashboard = actualResults.dashboardUrls?.find(d =>
                        d.service.toLowerCase().includes(criterion.key?.toLowerCase() || '')
                    );
                    passed = dashboard?.accessible || false;
                    actualValue = dashboard?.accessible ? 'ACCESSIBLE' : 'NOT_ACCESSIBLE';
                    break;

                case 'feature_enabled':
                    // Custom check for feature enablement
                    const featureCheck = actualResults.customChecks?.find(c =>
                        c.description.toLowerCase().includes(criterion.key?.toLowerCase() || 'feature')
                    );
                    passed = featureCheck?.passed || false;
                    actualValue = featureCheck?.actualValue;
                    break;

                case 'custom':
                    const customCheck = actualResults.customChecks?.find(c =>
                        c.description.toLowerCase().includes(criterion.description?.toLowerCase() || '')
                    );
                    passed = customCheck?.passed || false;
                    actualValue = customCheck?.actualValue;
                    break;
            }

            verificationDetails.push({
                criterionIndex: i,
                criterion,
                passed,
                actualValue,
                error,
            });
        }

        const passedCount = verificationDetails.filter(d => d.passed).length;
        const overallScore = successCriteria.length > 0
            ? Math.round((passedCount / successCriteria.length) * 100)
            : 0;
        const allPassed = passedCount === successCriteria.length;

        // Update the intent lock with verification results
        await db.update(taskIntentLocks)
            .set({
                verified: allPassed,
                verifiedAt: new Date().toISOString(),
                verificationDetails: verificationDetails.map(d => ({
                    criterionIndex: d.criterionIndex,
                    passed: d.passed,
                    actualValue: d.actualValue,
                    error: d.error,
                })),
            })
            .where(eq(taskIntentLocks.id, intentLockId));

        return {
            passed: allPassed,
            details: verificationDetails,
            overallScore,
        };
    }

    /**
     * Get an intent lock by ID
     */
    async getIntentLock(intentLockId: string): Promise<TaskIntentLock | null> {
        const [intent] = await db.select().from(taskIntentLocks).where(eq(taskIntentLocks.id, intentLockId));
        return intent ? this.mapToTaskIntentLock(intent) : null;
    }

    /**
     * Get all intent locks for a provisioning session
     */
    async getSessionIntentLocks(provisioningSessionId: string): Promise<TaskIntentLock[]> {
        const intents = await db.select()
            .from(taskIntentLocks)
            .where(eq(taskIntentLocks.provisioningSessionId, provisioningSessionId));

        return intents.map(i => this.mapToTaskIntentLock(i));
    }

    /**
     * Link an intent lock to a browser agent task
     */
    async linkToTask(intentLockId: string, browserAgentTaskId: string): Promise<void> {
        await db.update(taskIntentLocks)
            .set({ browserAgentTaskId })
            .where(eq(taskIntentLocks.id, intentLockId));
    }

    /**
     * Map database row to TaskIntentLock type
     */
    private mapToTaskIntentLock(row: typeof taskIntentLocks.$inferSelect): TaskIntentLock {
        return {
            id: row.id,
            provisioningSessionId: row.provisioningSessionId,
            browserAgentTaskId: row.browserAgentTaskId || undefined,
            buildIntentId: row.buildIntentId || undefined,
            scope: row.scope as 'phase' | 'task' | 'subtask',
            serviceName: row.serviceName,
            taskType: row.taskType,
            expectedOutcomes: (row.expectedOutcomes as string[]) || [],
            successCriteria: (row.successCriteria as SuccessCriterion[]) || [],
            antiPatterns: (row.antiPatterns as string[]) || [],
            locked: row.locked ?? false,
            lockedAt: row.lockedAt || undefined,
            verified: row.verified ?? false,
            verifiedAt: row.verifiedAt || undefined,
            verificationDetails: row.verificationDetails as TaskIntentLock['verificationDetails'],
            generatedBy: row.generatedBy || 'unknown',
            tokensUsed: row.tokensUsed || 0,
            createdAt: row.createdAt,
        };
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: TaskIntentLockService | null = null;

export function getTaskIntentLockService(): TaskIntentLockService {
    if (!instance) {
        instance = new TaskIntentLockService();
    }
    return instance;
}
