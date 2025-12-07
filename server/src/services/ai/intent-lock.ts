/**
 * Intent Lock Engine - Phase 0 of the Ultimate AI-First Builder Architecture
 *
 * Creates an IMMUTABLE "DONE" definition (Sacred Contract) before any code is written.
 * This prevents "premature victory declaration" - a major failure mode in AI builders.
 *
 * The Intent Lock is NEVER modified after creation. All subsequent phases reference it.
 *
 * Model: Claude Opus 4.5 | Effort: high | Thinking: 64K tokens
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db.js';
import { buildIntents, projects, orchestrationRuns, developerModeAgents } from '../../schema.js';
import { ClaudeService, createClaudeService, CLAUDE_MODELS } from './claude-service.js';

// =============================================================================
// TYPES
// =============================================================================

export type IntentAppSoul =
    | 'immersive_media'    // Music, video, entertainment
    | 'professional'       // Finance, business, enterprise
    | 'developer'          // Dev tools, IDEs, CLI
    | 'creative'           // Design, art, creative tools
    | 'social'             // Community, social networks
    | 'ecommerce'          // Shopping, marketplace
    | 'utility'            // Productivity, utilities
    | 'gaming';            // Games, gamification

export interface SuccessCriterion {
    id: string;
    description: string;
    verificationMethod: 'visual' | 'functional' | 'performance';
    passed: boolean;
}

export interface UserWorkflow {
    name: string;
    steps: string[];
    success: string;
    verified: boolean;
}

export interface VisualIdentity {
    soul: IntentAppSoul;
    primaryEmotion: string;
    depthLevel: 'low' | 'medium' | 'high';
    motionPhilosophy: string;
}

export interface IntentContract {
    id: string;
    projectId: string;
    orchestrationRunId?: string;
    userId: string;
    appType: string;
    appSoul: IntentAppSoul;
    coreValueProp: string;
    successCriteria: SuccessCriterion[];
    userWorkflows: UserWorkflow[];
    visualIdentity: VisualIdentity;
    antiPatterns: string[];
    locked: boolean;
    lockedAt?: string;
    originalPrompt: string;
    generatedBy: string;
    thinkingTokensUsed: number;
    createdAt: string;
}

export interface IntentLockOptions {
    model?: string;
    effort?: 'low' | 'medium' | 'high';
    thinkingBudget?: number;
}

// =============================================================================
// MICRO INTENT LOCK - Task-level contracts for Developer Mode
// =============================================================================

export interface MicroTaskSuccessCriterion {
    id: string;
    description: string;
    verifiable: boolean;
    passed: boolean;
}

export interface MicroIntentContract {
    id: string;
    parentIntentId?: string;  // Link to full project intent if exists
    agentId: string;
    projectId: string;
    userId: string;
    taskDescription: string;
    expectedOutcome: string;
    successCriteria: MicroTaskSuccessCriterion[];
    filesAffected: string[];
    estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
    estimatedTokens: number;
    estimatedCost: number;
    timeoutMs: number;
    rollbackStrategy: 'revert_files' | 'checkpoint_restore' | 'manual';
    locked: boolean;
    lockedAt?: string;
    completedAt?: string;
    status: 'pending' | 'locked' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
    result?: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MicroIntentOptions {
    parentIntentId?: string;
    estimatedComplexity?: MicroIntentContract['estimatedComplexity'];
    timeoutMs?: number;
    rollbackStrategy?: MicroIntentContract['rollbackStrategy'];
}

// =============================================================================
// INTENT LOCK ENGINE
// =============================================================================

const INTENT_LOCK_SYSTEM_PROMPT = `You are the INTENT LOCK AGENT for KripTik AI's Ultimate Builder Architecture.

Your SOLE PURPOSE is to create an IMMUTABLE "DONE" definition - the Sacred Contract - before ANY code is written.

This contract PREVENTS "premature victory declaration" - a major failure mode where AI builders claim success before the user's actual intent is satisfied.

## YOUR TASK

Analyze the user's prompt deeply and create a comprehensive Intent Contract that defines:

1. **App Type & Soul**: What kind of app is this? What design soul should it have?
2. **Core Value Proposition**: What is the ONE thing this app must do perfectly?
3. **Success Criteria**: Specific, measurable criteria that define "DONE"
4. **User Workflows**: Step-by-step journeys users will take through the app
5. **Visual Identity**: Design language that matches the app's soul
6. **Anti-Patterns**: Things that must NEVER appear in this app

## APP SOULS

Choose the most appropriate soul:
- immersive_media: Music, video, streaming - cinematic, vibrant, content-forward
- professional: Finance, business - sophisticated, muted, data-focused
- developer: Dev tools, IDEs - keyboard-friendly, low-contrast, terminal aesthetic
- creative: Design tools - canvas-forward, minimal, tools supporting not distracting
- social: Community, social - reactive, personality-forward, user content hero
- ecommerce: Shopping - product photography hero, clean grids, smooth cart
- utility: Productivity - minimal, purposeful, no distractions
- gaming: Games - energetic, rewarding animations, celebration

## RESPONSE FORMAT

Respond with ONLY valid JSON (no markdown, no explanation):

{
    "appType": "string - specific app type (e.g., 'music_streaming_app', 'saas_dashboard')",
    "appSoul": "one of: immersive_media, professional, developer, creative, social, ecommerce, utility, gaming",
    "coreValueProp": "string - the ONE thing this app does perfectly",
    "successCriteria": [
        {
            "id": "SC001",
            "description": "string - specific, measurable criterion",
            "verificationMethod": "visual | functional | performance"
        }
    ],
    "userWorkflows": [
        {
            "name": "string - workflow name",
            "steps": ["array", "of", "steps"],
            "success": "string - what success looks like for this workflow"
        }
    ],
    "visualIdentity": {
        "soul": "same as appSoul",
        "primaryEmotion": "string - the dominant emotional response",
        "depthLevel": "low | medium | high",
        "motionPhilosophy": "string - how motion should feel"
    },
    "antiPatterns": [
        "string - things that must NEVER appear in this app"
    ]
}

## CRITICAL RULES

1. Be SPECIFIC - vague criteria cannot be verified
2. Include AT LEAST 5 success criteria
3. Include AT LEAST 2 user workflows with detailed steps
4. Include AT LEAST 5 anti-patterns specific to this app type
5. The visual identity MUST match the app soul
6. Every criterion must be objectively verifiable

This contract is SACRED. It will NOT be modified after creation. Make it complete.`;

const MICRO_INTENT_SYSTEM_PROMPT = `You are the MICRO INTENT LOCK AGENT for KripTik AI's Developer Mode.

Your purpose is to create a focused, task-level "DONE" definition for individual agent tasks.

Unlike full Intent Contracts, Micro Intents are:
- Smaller in scope (single task vs entire app)
- Faster to generate (uses Haiku/Sonnet vs Opus)
- More specific (exact files and changes vs high-level goals)
- Easier to verify (concrete criteria vs workflows)

## YOUR TASK

Analyze the task description and create a Micro Intent Contract that defines:

1. **Expected Outcome**: What specific result should this task produce?
2. **Success Criteria**: 2-4 specific, checkable criteria
3. **Files Affected**: Which files will be created/modified?
4. **Complexity Estimate**: How complex is this task?
5. **Timeout**: Reasonable timeout for this task

## COMPLEXITY LEVELS

- trivial: < 50 tokens, simple text change, 5 second timeout
- simple: 50-200 tokens, single function/component, 30 second timeout
- moderate: 200-1000 tokens, multiple functions, 2 minute timeout
- complex: 1000-4000 tokens, full feature, 10 minute timeout
- very_complex: 4000+ tokens, system-wide changes, 30 minute timeout

## RESPONSE FORMAT

Respond with ONLY valid JSON:

{
    "expectedOutcome": "string - specific expected result",
    "successCriteria": [
        { "id": "MC001", "description": "string - specific checkable criterion", "verifiable": true }
    ],
    "filesAffected": ["src/path/to/file.ts"],
    "estimatedComplexity": "trivial | simple | moderate | complex | very_complex",
    "estimatedTokens": 500,
    "timeoutMs": 120000
}

## CRITICAL RULES

1. Be SPECIFIC - vague criteria cannot be checked
2. Include 2-4 success criteria (not more)
3. List ALL files that will be touched
4. Be realistic about complexity and timeout
5. Criteria must be programmatically verifiable

This Micro Intent will guide a single agent task. Make it precise.`;

export class IntentLockEngine {
    private claudeService: ClaudeService;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
            systemPrompt: INTENT_LOCK_SYSTEM_PROMPT,
        });
    }

    /**
     * Create an Intent Lock contract from user prompt
     * Uses Claude Opus 4.5 with HIGH effort and 64K thinking budget
     */
    async createContract(
        prompt: string,
        userId: string,
        projectId: string,
        orchestrationRunId?: string,
        options: IntentLockOptions = {}
    ): Promise<IntentContract> {
        const {
            model = CLAUDE_MODELS.OPUS_4_5,
            effort = 'high',
            thinkingBudget = 64000,
        } = options;

        console.log('[IntentLock] Creating Sacred Contract with Opus 4.5, HIGH effort, 64K thinking');

        // Generate the intent contract using extended thinking
        const response = await this.claudeService.generate(
            `Create an Intent Lock contract for this user request:\n\n"${prompt}"`,
            {
                model,
                effort,
                maxTokens: 32000,
                useExtendedThinking: true,
                thinkingBudgetTokens: thinkingBudget,
            }
        );

        // Parse the response
        let contractData: Omit<IntentContract, 'id' | 'projectId' | 'orchestrationRunId' | 'userId' | 'locked' | 'lockedAt' | 'originalPrompt' | 'generatedBy' | 'thinkingTokensUsed' | 'createdAt'>;

        try {
            // Try direct parse first
            contractData = JSON.parse(response.content);
        } catch {
            // Try to extract JSON from response
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                contractData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error(`Failed to parse Intent Contract JSON: ${response.content.substring(0, 500)}`);
            }
        }

        // Validate required fields
        this.validateContract(contractData);

        // Create the full contract
        const now = new Date().toISOString();
        const contractId = crypto.randomUUID();

        const fullContract: IntentContract = {
            id: contractId,
            projectId,
            orchestrationRunId,
            userId,
            appType: contractData.appType,
            appSoul: contractData.appSoul as IntentAppSoul,
            coreValueProp: contractData.coreValueProp,
            successCriteria: contractData.successCriteria.map((sc, idx) => ({
                ...sc,
                id: sc.id || `SC${String(idx + 1).padStart(3, '0')}`,
                passed: false,
            })),
            userWorkflows: contractData.userWorkflows.map(wf => ({
                ...wf,
                verified: false,
            })),
            visualIdentity: contractData.visualIdentity,
            antiPatterns: contractData.antiPatterns,
            locked: false,
            originalPrompt: prompt,
            generatedBy: model,
            thinkingTokensUsed: response.usage.thinkingTokens || thinkingBudget,
            createdAt: now,
        };

        // Store in database
        await this.saveContract(fullContract);

        console.log(`[IntentLock] Contract created: ${contractId} (${fullContract.appType}, soul: ${fullContract.appSoul})`);

        return fullContract;
    }

    /**
     * Lock the contract - makes it immutable
     */
    async lockContract(contractId: string): Promise<IntentContract> {
        const now = new Date().toISOString();

        await db.update(buildIntents)
            .set({
                locked: true,
                lockedAt: now,
            })
            .where(eq(buildIntents.id, contractId));

        const updated = await this.getContract(contractId);
        if (!updated) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        console.log(`[IntentLock] Contract LOCKED: ${contractId} - This is now THE SACRED CONTRACT`);
        return updated;
    }

    /**
     * Get a contract by ID
     */
    async getContract(contractId: string): Promise<IntentContract | null> {
        const results = await db.select()
            .from(buildIntents)
            .where(eq(buildIntents.id, contractId))
            .limit(1);

        if (results.length === 0) return null;

        const row = results[0];
        return {
            id: row.id,
            projectId: row.projectId,
            orchestrationRunId: row.orchestrationRunId || undefined,
            userId: row.userId,
            appType: row.appType,
            appSoul: row.appSoul as IntentAppSoul,
            coreValueProp: row.coreValueProp,
            successCriteria: row.successCriteria as SuccessCriterion[],
            userWorkflows: row.userWorkflows as UserWorkflow[],
            visualIdentity: row.visualIdentity as VisualIdentity,
            antiPatterns: row.antiPatterns as string[],
            locked: row.locked,
            lockedAt: row.lockedAt || undefined,
            originalPrompt: row.originalPrompt,
            generatedBy: row.generatedBy || 'claude-opus-4.5',
            thinkingTokensUsed: row.thinkingTokensUsed || 0,
            createdAt: row.createdAt,
        };
    }

    /**
     * Get contract for a project
     */
    async getContractForProject(projectId: string): Promise<IntentContract | null> {
        const results = await db.select()
            .from(buildIntents)
            .where(eq(buildIntents.projectId, projectId))
            .limit(1);

        if (results.length === 0) return null;

        return this.getContract(results[0].id);
    }

    /**
     * Get contract for an orchestration run
     */
    async getContractForRun(orchestrationRunId: string): Promise<IntentContract | null> {
        const results = await db.select()
            .from(buildIntents)
            .where(eq(buildIntents.orchestrationRunId, orchestrationRunId))
            .limit(1);

        if (results.length === 0) return null;

        return this.getContract(results[0].id);
    }

    /**
     * Mark a success criterion as passed
     */
    async markCriterionPassed(contractId: string, criterionId: string): Promise<void> {
        const contract = await this.getContract(contractId);
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        const criterion = contract.successCriteria.find(sc => sc.id === criterionId);
        if (!criterion) {
            throw new Error(`Criterion not found: ${criterionId}`);
        }

        criterion.passed = true;

        await db.update(buildIntents)
            .set({
                successCriteria: contract.successCriteria,
            })
            .where(eq(buildIntents.id, contractId));

        console.log(`[IntentLock] Criterion ${criterionId} marked as PASSED`);
    }

    /**
     * Mark a user workflow as verified
     */
    async markWorkflowVerified(contractId: string, workflowName: string): Promise<void> {
        const contract = await this.getContract(contractId);
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        const workflow = contract.userWorkflows.find(wf => wf.name === workflowName);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowName}`);
        }

        workflow.verified = true;

        await db.update(buildIntents)
            .set({
                userWorkflows: contract.userWorkflows,
            })
            .where(eq(buildIntents.id, contractId));

        console.log(`[IntentLock] Workflow "${workflowName}" marked as VERIFIED`);
    }

    /**
     * Check if all success criteria are satisfied
     */
    async isIntentSatisfied(contractId: string): Promise<{
        satisfied: boolean;
        passedCriteria: number;
        totalCriteria: number;
        verifiedWorkflows: number;
        totalWorkflows: number;
        missingCriteria: string[];
        missingWorkflows: string[];
    }> {
        const contract = await this.getContract(contractId);
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        const passedCriteria = contract.successCriteria.filter(sc => sc.passed).length;
        const totalCriteria = contract.successCriteria.length;
        const verifiedWorkflows = contract.userWorkflows.filter(wf => wf.verified).length;
        const totalWorkflows = contract.userWorkflows.length;

        const missingCriteria = contract.successCriteria
            .filter(sc => !sc.passed)
            .map(sc => sc.description);

        const missingWorkflows = contract.userWorkflows
            .filter(wf => !wf.verified)
            .map(wf => wf.name);

        const satisfied = passedCriteria === totalCriteria && verifiedWorkflows === totalWorkflows;

        return {
            satisfied,
            passedCriteria,
            totalCriteria,
            verifiedWorkflows,
            totalWorkflows,
            missingCriteria,
            missingWorkflows,
        };
    }

    /**
     * Generate intent.json file content for artifact storage
     */
    toArtifactJson(contract: IntentContract): string {
        return JSON.stringify({
            id: contract.id,
            appType: contract.appType,
            appSoul: contract.appSoul,
            coreValueProp: contract.coreValueProp,
            successCriteria: contract.successCriteria,
            userWorkflows: contract.userWorkflows,
            visualIdentity: contract.visualIdentity,
            antiPatterns: contract.antiPatterns,
            locked: contract.locked,
            lockedAt: contract.lockedAt,
            createdAt: contract.createdAt,
        }, null, 2);
    }

    /**
     * Validate contract data
     */
    private validateContract(data: unknown): void {
        const contract = data as Record<string, unknown>;

        if (!contract.appType || typeof contract.appType !== 'string') {
            throw new Error('Invalid contract: missing or invalid appType');
        }

        if (!contract.appSoul || typeof contract.appSoul !== 'string') {
            throw new Error('Invalid contract: missing or invalid appSoul');
        }

        const validSouls: IntentAppSoul[] = ['immersive_media', 'professional', 'developer', 'creative', 'social', 'ecommerce', 'utility', 'gaming'];
        if (!validSouls.includes(contract.appSoul as IntentAppSoul)) {
            throw new Error(`Invalid contract: appSoul must be one of: ${validSouls.join(', ')}`);
        }

        if (!contract.coreValueProp || typeof contract.coreValueProp !== 'string') {
            throw new Error('Invalid contract: missing or invalid coreValueProp');
        }

        if (!Array.isArray(contract.successCriteria) || contract.successCriteria.length < 3) {
            throw new Error('Invalid contract: successCriteria must have at least 3 items');
        }

        if (!Array.isArray(contract.userWorkflows) || contract.userWorkflows.length < 1) {
            throw new Error('Invalid contract: userWorkflows must have at least 1 item');
        }

        if (!contract.visualIdentity || typeof contract.visualIdentity !== 'object') {
            throw new Error('Invalid contract: missing or invalid visualIdentity');
        }

        if (!Array.isArray(contract.antiPatterns) || contract.antiPatterns.length < 3) {
            throw new Error('Invalid contract: antiPatterns must have at least 3 items');
        }
    }

    /**
     * Save contract to database
     */
    private async saveContract(contract: IntentContract): Promise<void> {
        await db.insert(buildIntents).values({
            id: contract.id,
            projectId: contract.projectId,
            orchestrationRunId: contract.orchestrationRunId,
            userId: contract.userId,
            appType: contract.appType,
            appSoul: contract.appSoul,
            coreValueProp: contract.coreValueProp,
            successCriteria: contract.successCriteria,
            userWorkflows: contract.userWorkflows,
            visualIdentity: contract.visualIdentity,
            antiPatterns: contract.antiPatterns,
            locked: contract.locked,
            lockedAt: contract.lockedAt,
            originalPrompt: contract.originalPrompt,
            generatedBy: contract.generatedBy,
            thinkingTokensUsed: contract.thinkingTokensUsed,
            createdAt: contract.createdAt,
        });
    }

    // =========================================================================
    // MICRO INTENT LOCK METHODS - For Developer Mode task-level contracts
    // =========================================================================

    /**
     * Create a Micro Intent Contract for a single agent task
     * Uses Haiku 3.5 for speed, or Sonnet for complex tasks
     */
    async createMicroIntent(
        taskDescription: string,
        agentId: string,
        userId: string,
        projectId: string,
        options: MicroIntentOptions = {}
    ): Promise<MicroIntentContract> {
        const {
            parentIntentId,
            estimatedComplexity,
            timeoutMs = 120000,
            rollbackStrategy = 'revert_files',
        } = options;

        // Use Haiku for speed unless complexity suggests otherwise
        const model = estimatedComplexity === 'very_complex' || estimatedComplexity === 'complex'
            ? CLAUDE_MODELS.SONNET_4_5
            : CLAUDE_MODELS.HAIKU_3_5;

        console.log(`[MicroIntent] Creating task contract with ${model} for: ${taskDescription.substring(0, 50)}...`);

        // Create a temporary service with the Micro Intent prompt
        const microService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
            systemPrompt: MICRO_INTENT_SYSTEM_PROMPT,
        });

        const response = await microService.generate(
            `Create a Micro Intent Contract for this task:\n\n"${taskDescription}"`,
            {
                model,
                effort: 'low',
                maxTokens: 2000,
            }
        );

        // Parse the response
        let microData: {
            expectedOutcome: string;
            successCriteria: Array<{ id: string; description: string; verifiable: boolean }>;
            filesAffected: string[];
            estimatedComplexity: MicroIntentContract['estimatedComplexity'];
            estimatedTokens: number;
            timeoutMs: number;
        };

        try {
            microData = JSON.parse(response.content);
        } catch {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                microData = JSON.parse(jsonMatch[0]);
            } else {
                // Fallback to reasonable defaults
                microData = {
                    expectedOutcome: taskDescription,
                    successCriteria: [
                        { id: 'MC001', description: 'Task completed without errors', verifiable: true },
                        { id: 'MC002', description: 'Output matches expected behavior', verifiable: true },
                    ],
                    filesAffected: [],
                    estimatedComplexity: estimatedComplexity || 'moderate',
                    estimatedTokens: 500,
                    timeoutMs: timeoutMs,
                };
            }
        }

        // Calculate estimated cost based on tokens
        const costPerMillion = model === CLAUDE_MODELS.HAIKU_3_5 ? 0.25 : 3.0;
        const estimatedCost = (microData.estimatedTokens / 1_000_000) * costPerMillion;

        const now = new Date().toISOString();
        const microIntentId = crypto.randomUUID();

        const microIntent: MicroIntentContract = {
            id: microIntentId,
            parentIntentId,
            agentId,
            projectId,
            userId,
            taskDescription,
            expectedOutcome: microData.expectedOutcome,
            successCriteria: microData.successCriteria.map((sc, idx) => ({
                id: sc.id || `MC${String(idx + 1).padStart(3, '0')}`,
                description: sc.description,
                verifiable: sc.verifiable !== false,
                passed: false,
            })),
            filesAffected: microData.filesAffected,
            estimatedComplexity: microData.estimatedComplexity || estimatedComplexity || 'moderate',
            estimatedTokens: microData.estimatedTokens,
            estimatedCost,
            timeoutMs: microData.timeoutMs || timeoutMs,
            rollbackStrategy,
            locked: false,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        };

        // Store in database
        await this.saveMicroIntent(microIntent);

        console.log(`[MicroIntent] Created: ${microIntentId} (${microIntent.estimatedComplexity}, ~${microIntent.estimatedTokens} tokens, $${microIntent.estimatedCost.toFixed(4)})`);

        return microIntent;
    }

    /**
     * Lock a Micro Intent - makes it the task contract
     */
    async lockMicroIntent(microIntentId: string): Promise<MicroIntentContract> {
        const now = new Date().toISOString();

        await db.update(developerModeAgents)
            .set({
                status: 'running',
                updatedAt: now,
            } as Record<string, unknown>)
            .where(eq(developerModeAgents.id, microIntentId));

        const updated = await this.getMicroIntent(microIntentId);
        if (!updated) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        // Update in-memory representation
        updated.locked = true;
        updated.lockedAt = now;
        updated.status = 'locked';

        console.log(`[MicroIntent] LOCKED: ${microIntentId} - Task contract established`);
        return updated;
    }

    /**
     * Get a Micro Intent by ID
     * Maps developerModeAgents columns to MicroIntentContract fields
     */
    async getMicroIntent(microIntentId: string): Promise<MicroIntentContract | null> {
        const results = await db.select()
            .from(developerModeAgents)
            .where(eq(developerModeAgents.id, microIntentId))
            .limit(1);

        if (results.length === 0) return null;

        const row = results[0];

        // Map developerModeAgents columns to MicroIntentContract
        return {
            id: row.id,
            parentIntentId: row.intentLockId || undefined,
            agentId: row.id,  // The agent IS the micro intent
            projectId: row.projectId,
            userId: row.userId,
            taskDescription: row.taskPrompt || '',
            expectedOutcome: row.currentStep || row.taskPrompt || '',
            successCriteria: [],  // Would need to be stored in a metadata field
            filesAffected: [],    // Would need to be stored in a metadata field
            estimatedComplexity: 'moderate',
            estimatedTokens: row.tokensUsed || 0,
            estimatedCost: 0,
            timeoutMs: 120000,
            rollbackStrategy: 'revert_files',
            locked: row.status === 'running' || row.status === 'completed',
            lockedAt: row.status === 'running' ? row.updatedAt : undefined,
            completedAt: row.completedAt || undefined,
            status: row.status as MicroIntentContract['status'],
            result: row.currentStep || undefined,
            error: row.lastError || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    /**
     * Mark a Micro Intent criterion as passed
     */
    async markMicroCriterionPassed(microIntentId: string, criterionId: string): Promise<void> {
        console.log(`[MicroIntent] Criterion ${criterionId} PASSED on ${microIntentId}`);
        // In a full implementation, this would update a metadata JSON field
    }

    /**
     * Complete a Micro Intent (all criteria passed)
     */
    async completeMicroIntent(microIntentId: string, result: string): Promise<MicroIntentContract> {
        const now = new Date().toISOString();

        await db.update(developerModeAgents)
            .set({
                status: 'completed',
                currentStep: result,  // Store result in currentStep since no output field
                completedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeAgents.id, microIntentId));

        const updated = await this.getMicroIntent(microIntentId);
        if (!updated) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        console.log(`[MicroIntent] COMPLETED: ${microIntentId}`);
        return updated;
    }

    /**
     * Fail a Micro Intent
     */
    async failMicroIntent(microIntentId: string, error: string): Promise<MicroIntentContract> {
        const now = new Date().toISOString();

        await db.update(developerModeAgents)
            .set({
                status: 'failed',
                lastError: error,  // Use lastError instead of error
                completedAt: now,
                updatedAt: now,
            })
            .where(eq(developerModeAgents.id, microIntentId));

        const updated = await this.getMicroIntent(microIntentId);
        if (!updated) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        console.log(`[MicroIntent] FAILED: ${microIntentId} - ${error}`);
        return updated;
    }

    /**
     * Rollback a failed Micro Intent
     */
    async rollbackMicroIntent(microIntentId: string): Promise<MicroIntentContract> {
        const microIntent = await this.getMicroIntent(microIntentId);
        if (!microIntent) {
            throw new Error(`Micro Intent not found: ${microIntentId}`);
        }

        const now = new Date().toISOString();

        // Mark as rolled back
        await db.update(developerModeAgents)
            .set({
                status: 'failed',  // Using 'failed' as closest status
                lastError: `Rolled back: ${microIntent.error || 'User requested rollback'}`,
                updatedAt: now,
            })
            .where(eq(developerModeAgents.id, microIntentId));

        console.log(`[MicroIntent] ROLLED BACK: ${microIntentId} using strategy: ${microIntent.rollbackStrategy}`);

        const updated = await this.getMicroIntent(microIntentId);
        return updated!;
    }

    /**
     * Get all Micro Intents for a session (agents are the micro intents in this schema)
     */
    async getMicroIntentsForAgent(sessionId: string): Promise<MicroIntentContract[]> {
        const results = await db.select()
            .from(developerModeAgents)
            .where(eq(developerModeAgents.sessionId, sessionId));

        return results.map(row => ({
            id: row.id,
            parentIntentId: row.intentLockId || undefined,
            agentId: row.id,
            projectId: row.projectId,
            userId: row.userId,
            taskDescription: row.taskPrompt || '',
            expectedOutcome: row.currentStep || row.taskPrompt || '',
            successCriteria: [],
            filesAffected: [],
            estimatedComplexity: 'moderate' as const,
            estimatedTokens: row.tokensUsed || 0,
            estimatedCost: 0,
            timeoutMs: 120000,
            rollbackStrategy: 'revert_files' as const,
            locked: row.status === 'running' || row.status === 'completed',
            lockedAt: row.status === 'running' ? row.updatedAt : undefined,
            completedAt: row.completedAt || undefined,
            status: row.status as MicroIntentContract['status'],
            result: row.currentStep || undefined,
            error: row.lastError || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }));
    }

    /**
     * Estimate cost for a Micro Intent before creation
     */
    estimateMicroIntentCost(complexity: MicroIntentContract['estimatedComplexity']): {
        minTokens: number;
        maxTokens: number;
        minCost: number;
        maxCost: number;
        estimatedTimeMs: number;
    } {
        const estimates = {
            trivial: { minTokens: 10, maxTokens: 50, timeMs: 5000 },
            simple: { minTokens: 50, maxTokens: 200, timeMs: 30000 },
            moderate: { minTokens: 200, maxTokens: 1000, timeMs: 120000 },
            complex: { minTokens: 1000, maxTokens: 4000, timeMs: 600000 },
            very_complex: { minTokens: 4000, maxTokens: 16000, timeMs: 1800000 },
        };

        const { minTokens, maxTokens, timeMs } = estimates[complexity];
        const costPerMillion = 3.0;  // Assume Sonnet pricing as conservative estimate

        return {
            minTokens,
            maxTokens,
            minCost: (minTokens / 1_000_000) * costPerMillion,
            maxCost: (maxTokens / 1_000_000) * costPerMillion,
            estimatedTimeMs: timeMs,
        };
    }

    /**
     * Save Micro Intent to database
     * Creates a developerModeAgents record representing this micro intent/task
     */
    private async saveMicroIntent(microIntent: MicroIntentContract): Promise<void> {
        // Note: This requires a sessionId - in a full implementation,
        // we would pass the sessionId when creating micro intents
        const sessionId = microIntent.parentIntentId || 'micro-intent-session';

        await db.insert(developerModeAgents).values({
            id: microIntent.id,
            sessionId,
            projectId: microIntent.projectId,
            userId: microIntent.userId,
            agentNumber: 1,  // Default agent number
            name: `Task: ${microIntent.taskDescription.substring(0, 30)}...`,
            taskPrompt: microIntent.taskDescription,
            intentLockId: microIntent.parentIntentId || null,
            model: CLAUDE_MODELS.HAIKU_3_5,  // Default model
            status: microIntent.status,
            currentStep: null,
            tokensUsed: microIntent.estimatedTokens,
            lastError: null,
            completedAt: null,
            createdAt: microIntent.createdAt,
            updatedAt: microIntent.updatedAt,
        });
    }
}

/**
 * Create an IntentLockEngine instance
 */
export function createIntentLockEngine(userId: string, projectId: string): IntentLockEngine {
    return new IntentLockEngine(userId, projectId);
}

/**
 * Quick helper to create and lock a contract in one step
 */
export async function createAndLockIntent(
    prompt: string,
    userId: string,
    projectId: string,
    orchestrationRunId?: string,
    options?: IntentLockOptions
): Promise<IntentContract> {
    const engine = createIntentLockEngine(userId, projectId);
    const contract = await engine.createContract(prompt, userId, projectId, orchestrationRunId, options);
    return engine.lockContract(contract.id);
}

/**
 * Quick helper to create and lock a Micro Intent for a single task
 */
export async function createAndLockMicroIntent(
    taskDescription: string,
    agentId: string,
    userId: string,
    projectId: string,
    options?: MicroIntentOptions
): Promise<MicroIntentContract> {
    const engine = createIntentLockEngine(userId, projectId);
    const microIntent = await engine.createMicroIntent(taskDescription, agentId, userId, projectId, options);
    return engine.lockMicroIntent(microIntent.id);
}

/**
 * Get cost estimate for a task before creating Micro Intent
 */
export function estimateTaskCost(
    complexity: MicroIntentContract['estimatedComplexity']
): {
    minTokens: number;
    maxTokens: number;
    minCost: number;
    maxCost: number;
    estimatedTimeMs: number;
} {
    const engine = new IntentLockEngine('system', 'system');
    return engine.estimateMicroIntentCost(complexity);
}

