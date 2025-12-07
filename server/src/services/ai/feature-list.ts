/**
 * Feature List Manager - Phase 1 & 2 of the Ultimate AI-First Builder Architecture
 *
 * Tracks all features with passes: true/false status.
 * Single source of truth for build progress during Phase 2 parallel building.
 *
 * Each feature has verification status from all 6 agents of the Verification Swarm:
 * - Error Checker
 * - Code Quality
 * - Visual Verifier
 * - Security Scanner
 * - Placeholder Eliminator
 * - Design Style Agent
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db.js';
import { featureProgress, buildIntents } from '../../schema.js';
import { ClaudeService, createClaudeService, CLAUDE_MODELS } from './claude-service.js';
import type { OpenRouterModel } from './openrouter-client.js';
import type { IntentContract } from './intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export type FeatureCategory = 'functional' | 'visual' | 'integration';

export type VerificationStatus = 'pending' | 'passed' | 'failed';

export interface FeatureVerificationStatus {
    errorCheck: VerificationStatus;
    codeQuality: VerificationStatus;
    visualVerify: VerificationStatus;
    placeholderCheck: VerificationStatus;
    designStyle: VerificationStatus;
    securityScan: VerificationStatus;
}

export interface FeatureVerificationScores {
    codeQualityScore?: number;
    visualScore?: number;
    antiSlopScore?: number;
    soulMatchScore?: number;
    designStyleScore?: number;
}

export interface Feature {
    id: string;
    buildIntentId: string;
    orchestrationRunId: string;
    projectId: string;
    featureId: string;
    category: FeatureCategory;
    description: string;
    priority: number;
    implementationSteps: string[];
    visualRequirements: string[];
    filesModified: string[];
    passes: boolean;
    assignedAgent: string | null;
    assignedAt: string | null;
    verificationStatus: FeatureVerificationStatus;
    verificationScores: FeatureVerificationScores | null;
    buildAttempts: number;
    lastBuildAt: string | null;
    passedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface FeatureListSummary {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    inProgress: number;
    passRate: number;
    features: Array<{
        featureId: string;
        description: string;
        passes: boolean;
        priority: number;
        assignedAgent: string | null;
    }>;
}

export interface GenerateFeatureListOptions {
    model?: OpenRouterModel;
    thinkingBudget?: number;
}

// =============================================================================
// FEATURE LIST MANAGER
// =============================================================================

const FEATURE_GENERATION_PROMPT = `You are the Feature List Generator for KripTik AI's Ultimate Builder.

Given an Intent Contract (the Sacred Contract), generate a comprehensive list of features that must be implemented to satisfy all success criteria and user workflows.

## REQUIREMENTS

1. Every success criterion must map to at least one feature
2. Every user workflow step should have supporting features
3. Features should be granular enough to be completed in one session
4. Priority 1 = critical path, 2 = important, 3 = nice-to-have

## FEATURE CATEGORIES

- functional: Core functionality, APIs, business logic
- visual: UI components, styling, animations, interactions
- integration: External services, database, authentication

## RESPONSE FORMAT

Respond with ONLY valid JSON:

{
    "features": [
        {
            "featureId": "F001",
            "category": "functional | visual | integration",
            "description": "Clear, specific feature description",
            "priority": 1 | 2 | 3,
            "implementationSteps": [
                "Step 1: ...",
                "Step 2: ..."
            ],
            "visualRequirements": [
                "Specific visual requirement if visual feature",
                "Motion/animation requirements"
            ],
            "successCriteriaIds": ["SC001", "SC002"],
            "workflowsSupported": ["Workflow Name"]
        }
    ]
}

## CRITICAL RULES

1. Generate 10-30 features depending on app complexity
2. Ensure COMPLETE coverage of all success criteria
3. No placeholder features - each must be specific and actionable
4. Visual features MUST include specific design requirements
5. Priority 1 features enable the core value proposition`;

export class FeatureListManager {
    private claudeService: ClaudeService;
    private projectId: string;
    private orchestrationRunId: string;

    constructor(projectId: string, orchestrationRunId: string, userId: string) {
        this.projectId = projectId;
        this.orchestrationRunId = orchestrationRunId;
        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'planning',
            systemPrompt: FEATURE_GENERATION_PROMPT,
        });
    }

    /**
     * Generate a feature list from an Intent Contract
     */
    async generateFromIntent(
        intent: IntentContract,
        options: GenerateFeatureListOptions = {}
    ): Promise<Feature[]> {
        const {
            model = CLAUDE_MODELS.SONNET_4_5,
            thinkingBudget = 32000,
        } = options;

        console.log('[FeatureList] Generating feature list from Intent Contract');

        const prompt = `Generate a comprehensive feature list for this Intent Contract:

## App Type: ${intent.appType}
## App Soul: ${intent.appSoul}
## Core Value Prop: ${intent.coreValueProp}

## Success Criteria:
${intent.successCriteria.map(sc => `- ${sc.id}: ${sc.description}`).join('\n')}

## User Workflows:
${intent.userWorkflows.map(wf => `- ${wf.name}: ${wf.steps.join(' -> ')}`).join('\n')}

## Visual Identity:
- Depth Level: ${intent.visualIdentity.depthLevel}
- Motion Philosophy: ${intent.visualIdentity.motionPhilosophy}
- Primary Emotion: ${intent.visualIdentity.primaryEmotion}

## Anti-Patterns to Avoid:
${intent.antiPatterns.map(ap => `- ${ap}`).join('\n')}`;

        const response = await this.claudeService.generate(prompt, {
            model,
            maxTokens: 16000,
            useExtendedThinking: true,
            thinkingBudgetTokens: thinkingBudget,
        });

        // Parse features from response
        let featuresData: { features: Array<{
            featureId: string;
            category: FeatureCategory;
            description: string;
            priority: number;
            implementationSteps: string[];
            visualRequirements: string[];
        }> };

        try {
            featuresData = JSON.parse(response.content);
        } catch {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                featuresData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error(`Failed to parse feature list: ${response.content.substring(0, 500)}`);
            }
        }

        // Create and save features
        const features: Feature[] = [];
        const now = new Date().toISOString();

        for (const f of featuresData.features) {
            const feature: Feature = {
                id: crypto.randomUUID(),
                buildIntentId: intent.id,
                orchestrationRunId: this.orchestrationRunId,
                projectId: this.projectId,
                featureId: f.featureId,
                category: f.category,
                description: f.description,
                priority: f.priority,
                implementationSteps: f.implementationSteps || [],
                visualRequirements: f.visualRequirements || [],
                filesModified: [],
                passes: false,
                assignedAgent: null,
                assignedAt: null,
                verificationStatus: {
                    errorCheck: 'pending',
                    codeQuality: 'pending',
                    visualVerify: 'pending',
                    placeholderCheck: 'pending',
                    designStyle: 'pending',
                    securityScan: 'pending',
                },
                verificationScores: null,
                buildAttempts: 0,
                lastBuildAt: null,
                passedAt: null,
                createdAt: now,
                updatedAt: now,
            };

            features.push(feature);
            await this.saveFeature(feature);
        }

        console.log(`[FeatureList] Generated ${features.length} features`);
        return features;
    }

    /**
     * Get all features for this orchestration run
     */
    async getAllFeatures(): Promise<Feature[]> {
        const results = await db.select()
            .from(featureProgress)
            .where(eq(featureProgress.orchestrationRunId, this.orchestrationRunId))
            .orderBy(featureProgress.priority, featureProgress.featureId);

        return results.map(this.rowToFeature);
    }

    /**
     * Get features by status
     */
    async getFeaturesByStatus(passed: boolean): Promise<Feature[]> {
        const results = await db.select()
            .from(featureProgress)
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.passes, passed)
            ))
            .orderBy(featureProgress.priority, featureProgress.featureId);

        return results.map(this.rowToFeature);
    }

    /**
     * Get the next feature to work on (highest priority, not passed)
     */
    async getNextFeature(): Promise<Feature | null> {
        const results = await db.select()
            .from(featureProgress)
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.passes, false)
            ))
            .orderBy(featureProgress.priority, featureProgress.featureId)
            .limit(1);

        if (results.length === 0) return null;
        return this.rowToFeature(results[0]);
    }

    /**
     * Get feature by ID
     */
    async getFeature(featureId: string): Promise<Feature | null> {
        const results = await db.select()
            .from(featureProgress)
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.featureId, featureId)
            ))
            .limit(1);

        if (results.length === 0) return null;
        return this.rowToFeature(results[0]);
    }

    /**
     * Assign a feature to an agent
     */
    async assignFeature(featureId: string, agentId: string): Promise<void> {
        const now = new Date().toISOString();

        await db.update(featureProgress)
            .set({
                assignedAgent: agentId,
                assignedAt: now,
                updatedAt: now,
            })
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.featureId, featureId)
            ));

        console.log(`[FeatureList] Feature ${featureId} assigned to ${agentId}`);
    }

    /**
     * Update verification status for a feature
     */
    async updateVerificationStatus(
        featureId: string,
        agentType: keyof FeatureVerificationStatus,
        status: VerificationStatus,
        score?: number
    ): Promise<void> {
        const feature = await this.getFeature(featureId);
        if (!feature) {
            throw new Error(`Feature not found: ${featureId}`);
        }

        const now = new Date().toISOString();
        const verificationStatus = { ...feature.verificationStatus, [agentType]: status };

        let verificationScores = feature.verificationScores || {};
        if (score !== undefined) {
            const scoreKey = this.getScoreKeyForAgent(agentType);
            if (scoreKey) {
                verificationScores = { ...verificationScores, [scoreKey]: score };
            }
        }

        await db.update(featureProgress)
            .set({
                verificationStatus: verificationStatus as any,
                verificationScores: verificationScores as any,
                updatedAt: now,
            })
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.featureId, featureId)
            ));

        console.log(`[FeatureList] Feature ${featureId} verification: ${agentType} = ${status}`);
    }

    /**
     * Mark a feature as passed (all verifications complete)
     */
    async markFeaturePassed(featureId: string): Promise<void> {
        const now = new Date().toISOString();

        await db.update(featureProgress)
            .set({
                passes: true,
                passedAt: now,
                updatedAt: now,
            })
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.featureId, featureId)
            ));

        console.log(`[FeatureList] Feature ${featureId} marked as PASSED ✓`);
    }

    /**
     * Increment build attempts for a feature
     */
    async incrementBuildAttempts(featureId: string): Promise<void> {
        const feature = await this.getFeature(featureId);
        if (!feature) {
            throw new Error(`Feature not found: ${featureId}`);
        }

        const now = new Date().toISOString();

        await db.update(featureProgress)
            .set({
                buildAttempts: feature.buildAttempts + 1,
                lastBuildAt: now,
                updatedAt: now,
            })
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.featureId, featureId)
            ));
    }

    /**
     * Add files modified during feature implementation
     */
    async addFilesModified(featureId: string, files: string[]): Promise<void> {
        const feature = await this.getFeature(featureId);
        if (!feature) {
            throw new Error(`Feature not found: ${featureId}`);
        }

        const now = new Date().toISOString();
        const filesModified = [...new Set([...feature.filesModified, ...files])];

        await db.update(featureProgress)
            .set({
                filesModified,
                updatedAt: now,
            })
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.featureId, featureId)
            ));
    }

    /**
     * Get summary of feature list progress
     */
    async getSummary(): Promise<FeatureListSummary> {
        const features = await this.getAllFeatures();

        const passed = features.filter(f => f.passes).length;
        const inProgress = features.filter(f => f.assignedAgent && !f.passes).length;
        const pending = features.filter(f => !f.assignedAgent && !f.passes).length;
        const failed = features.filter(f => {
            const status = f.verificationStatus;
            return Object.values(status).some(s => s === 'failed') && !f.passes;
        }).length;

        return {
            total: features.length,
            passed,
            failed,
            pending,
            inProgress,
            passRate: features.length > 0 ? Math.round((passed / features.length) * 100) : 0,
            features: features.map(f => ({
                featureId: f.featureId,
                description: f.description,
                passes: f.passes,
                priority: f.priority,
                assignedAgent: f.assignedAgent,
            })),
        };
    }

    /**
     * Check if all features pass (ready for next phase)
     */
    async allFeaturesPassed(): Promise<boolean> {
        const features = await this.getAllFeatures();
        return features.every(f => f.passes);
    }

    /**
     * Generate feature_list.json artifact content
     */
    async toArtifactJson(): Promise<string> {
        const features = await this.getAllFeatures();
        const summary = await this.getSummary();

        return JSON.stringify({
            orchestrationRunId: this.orchestrationRunId,
            projectId: this.projectId,
            summary: {
                total: summary.total,
                passed: summary.passed,
                pending: summary.pending,
                passRate: summary.passRate,
            },
            features: features.map(f => ({
                id: f.featureId,
                category: f.category,
                description: f.description,
                priority: f.priority,
                passes: f.passes,
                assignedAgent: f.assignedAgent,
                verificationStatus: f.verificationStatus,
                verificationScores: f.verificationScores,
                buildAttempts: f.buildAttempts,
                filesModified: f.filesModified,
            })),
            lastUpdated: new Date().toISOString(),
        }, null, 2);
    }

    /**
     * Reset all verification statuses for a feature (for retry)
     */
    async resetFeatureVerification(featureId: string): Promise<void> {
        const now = new Date().toISOString();

        await db.update(featureProgress)
            .set({
                verificationStatus: {
                    errorCheck: 'pending',
                    codeQuality: 'pending',
                    visualVerify: 'pending',
                    placeholderCheck: 'pending',
                    designStyle: 'pending',
                    securityScan: 'pending',
                },
                verificationScores: null,
                updatedAt: now,
            })
            .where(and(
                eq(featureProgress.orchestrationRunId, this.orchestrationRunId),
                eq(featureProgress.featureId, featureId)
            ));

        console.log(`[FeatureList] Feature ${featureId} verification reset`);
    }

    /**
     * Get the score key for an agent type
     */
    private getScoreKeyForAgent(agentType: keyof FeatureVerificationStatus): keyof FeatureVerificationScores | null {
        const mapping: Partial<Record<keyof FeatureVerificationStatus, keyof FeatureVerificationScores>> = {
            codeQuality: 'codeQualityScore',
            visualVerify: 'visualScore',
            designStyle: 'designStyleScore',
        };
        return mapping[agentType] || null;
    }

    /**
     * Convert database row to Feature object
     */
    private rowToFeature(row: typeof featureProgress.$inferSelect): Feature {
        return {
            id: row.id,
            buildIntentId: row.buildIntentId,
            orchestrationRunId: row.orchestrationRunId,
            projectId: row.projectId,
            featureId: row.featureId,
            category: row.category as FeatureCategory,
            description: row.description,
            priority: row.priority,
            implementationSteps: (row.implementationSteps as string[]) || [],
            visualRequirements: (row.visualRequirements as string[]) || [],
            filesModified: (row.filesModified as string[]) || [],
            passes: row.passes,
            assignedAgent: row.assignedAgent,
            assignedAt: row.assignedAt,
            verificationStatus: row.verificationStatus as unknown as FeatureVerificationStatus,
            verificationScores: row.verificationScores as unknown as FeatureVerificationScores | null,
            buildAttempts: row.buildAttempts ?? 0,
            lastBuildAt: row.lastBuildAt,
            passedAt: row.passedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    /**
     * Save a feature to the database
     */
    private async saveFeature(feature: Feature): Promise<void> {
        // Using `as any` for type assertion - Drizzle schema types don't fully match runtime behavior
        await db.insert(featureProgress).values({
            id: feature.id,
            buildIntentId: feature.buildIntentId,
            orchestrationRunId: feature.orchestrationRunId,
            projectId: feature.projectId,
            featureId: feature.featureId,
            category: feature.category,
            description: feature.description,
            priority: feature.priority,
            implementationSteps: feature.implementationSteps as any,
            visualRequirements: feature.visualRequirements as any,
            filesModified: feature.filesModified as any,
            passes: feature.passes,
            assignedAgent: feature.assignedAgent,
            assignedAt: feature.assignedAt,
            verificationStatus: feature.verificationStatus as any,
            verificationScores: feature.verificationScores as any,
            buildAttempts: feature.buildAttempts,
            lastBuildAt: feature.lastBuildAt,
            passedAt: feature.passedAt,
            createdAt: feature.createdAt,
            updatedAt: feature.updatedAt,
        } as any);
    }
}

/**
 * Create a FeatureListManager instance
 */
export function createFeatureListManager(
    projectId: string,
    orchestrationRunId: string,
    userId: string
): FeatureListManager {
    return new FeatureListManager(projectId, orchestrationRunId, userId);
}

