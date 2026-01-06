/**
 * 4-Level Error Escalation System - Ultimate AI-First Builder Architecture
 *
 * NEVER GIVES UP. Always escalates until fixed.
 *
 * Level 1: SIMPLE FIXES
 * - Model: Sonnet 4.5, medium effort
 * - Max Attempts: 3
 * - Handles: syntax_error, import_missing, type_mismatch, undefined_variable
 * - Process: Direct fix based on error message
 *
 * Level 2: DEEP ANALYSIS
 * - Model: Opus 4.5, HIGH effort, 64K thinking
 * - Max Attempts: 3
 * - Handles: architectural_review, dependency_conflicts, integration_issues
 * - Process: Extended thinking, review related files, check past resolutions
 *
 * Level 3: COMPONENT REWRITE
 * - Model: Opus 4.5, HIGH effort, 64K thinking
 * - Max Attempts: 2
 * - Handles: targeted_rewrite, dependency_update, approach_change
 * - Process: Identify minimum scope, fresh implementation, preserve interfaces
 *
 * Level 4: FEATURE REBUILD
 * - Model: Opus 4.5, HIGH effort, 64K thinking
 * - Max Attempts: 1
 * - Handles: full_feature_rebuild_from_intent
 * - Process: Nuclear option - rebuild entire feature from Intent Contract
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { errorEscalationHistory } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { ClaudeService, createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { getPhaseConfig, OPENROUTER_MODELS } from '../ai/openrouter-client.js';
import { ArtifactManager, createArtifactManager } from '../ai/artifacts.js';
import type { IntentContract } from '../ai/intent-lock.js';
import type { Feature } from '../ai/feature-list.js';
import { selectFallback, type FallbackCategory, type DeviceCapabilities } from '../ai/premium-fallback.js';

// =============================================================================
// TYPES
// =============================================================================

export type EscalationLevel = 1 | 2 | 3 | 4;

export type ErrorCategory =
    | 'syntax_error'
    | 'import_missing'
    | 'type_mismatch'
    | 'undefined_variable'
    | 'runtime_error'
    | 'architectural_review'
    | 'dependency_conflicts'
    | 'integration_issues'
    | 'targeted_rewrite'
    | 'dependency_update'
    | 'approach_change'
    | 'full_feature_rebuild'
    // Styling error categories
    | 'styling_webgl_unavailable'
    | 'styling_dependency_load_failure'
    | 'styling_animation_performance'
    | 'styling_font_not_loaded'
    | 'styling_3d_render_failure'
    // GPU error categories (PROMPT 7)
    | 'gpu_deployment_failed'
    | 'gpu_endpoint_unavailable'
    | 'gpu_memory_exceeded'
    | 'gpu_cost_overrun'
    | 'gpu_performance_degraded'
    | 'gpu_quantization_incompatible';

export interface BuildError {
    id: string;
    featureId: string;
    category: ErrorCategory;
    message: string;
    file?: string;
    line?: number;
    column?: number;
    stack?: string;
    context?: Record<string, unknown>;
    timestamp: Date;
}

export interface Fix {
    id: string;
    errorId: string;
    level: EscalationLevel;
    strategy: string;
    changes: FileChange[];
    successful: boolean;
    durationMs: number;
    tokensUsed: number;
    thinkingTokens: number;
    timestamp: Date;
}

export interface FileChange {
    path: string;
    action: 'create' | 'update' | 'delete';
    originalContent?: string;
    newContent?: string;
    diff?: string;
}

export interface EscalationConfig {
    level1MaxAttempts: number;
    level2MaxAttempts: number;
    level3MaxAttempts: number;
    level4MaxAttempts: number;
    autoEscalate: boolean;
    preserveInterfacesByDefault: boolean;
}

export interface EscalationState {
    currentLevel: EscalationLevel;
    attemptsPerLevel: Map<EscalationLevel, number>;
    totalAttempts: number;
    errorsFixed: number;
    errorsFailed: number;
    escalationHistory: Array<{
        level: EscalationLevel;
        errorId: string;
        success: boolean;
        timestamp: Date;
    }>;
}

export interface EscalationResult {
    success: boolean;
    level: EscalationLevel;
    fix: Fix | null;
    escalated: boolean;
    message: string;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: EscalationConfig = {
    level1MaxAttempts: 3,
    level2MaxAttempts: 3,
    level3MaxAttempts: 2,
    level4MaxAttempts: 1,
    autoEscalate: true,
    preserveInterfacesByDefault: true,
};

// =============================================================================
// ERROR CATEGORIZATION
// =============================================================================

const LEVEL_1_CATEGORIES: ErrorCategory[] = [
    'syntax_error',
    'import_missing',
    'type_mismatch',
    'undefined_variable',
    // Styling errors are Level 1 - use premium CSS fallbacks first
    'styling_webgl_unavailable',
    'styling_dependency_load_failure',
    'styling_animation_performance',
    'styling_font_not_loaded',
    'styling_3d_render_failure',
];

const LEVEL_2_CATEGORIES: ErrorCategory[] = [
    'runtime_error',
    'architectural_review',
    'dependency_conflicts',
    'integration_issues',
];

const LEVEL_3_CATEGORIES: ErrorCategory[] = [
    'targeted_rewrite',
    'dependency_update',
    'approach_change',
];

const LEVEL_4_CATEGORIES: ErrorCategory[] = [
    'full_feature_rebuild',
];

// =============================================================================
// ERROR ESCALATION ENGINE
// =============================================================================

export class ErrorEscalationEngine extends EventEmitter {
    private config: EscalationConfig;
    private state: EscalationState;
    private claudeService: ClaudeService;
    private artifactManager: ArtifactManager;
    private orchestrationRunId: string;
    private projectId: string;
    private userId: string;
    private intent: IntentContract | null = null;

    constructor(
        orchestrationRunId: string,
        projectId: string,
        userId: string,
        config: Partial<EscalationConfig> = {}
    ) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.orchestrationRunId = orchestrationRunId;
        this.projectId = projectId;
        this.userId = userId;

        this.state = {
            currentLevel: 1,
            attemptsPerLevel: new Map([
                [1, 0], [2, 0], [3, 0], [4, 0],
            ]),
            totalAttempts: 0,
            errorsFixed: 0,
            errorsFailed: 0,
            escalationHistory: [],
        };

        this.claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'refinement',
        });

        this.artifactManager = createArtifactManager(projectId, orchestrationRunId, userId);
    }

    /**
     * Set the Intent Contract for Level 4 rebuilds
     */
    setIntent(intent: IntentContract): void {
        this.intent = intent;
    }

    /**
     * Attempt to fix an error with automatic escalation
     * NEVER GIVES UP - escalates through all 4 levels
     */
    async fixError(
        error: BuildError,
        fileContents: Map<string, string>,
        feature?: Feature
    ): Promise<EscalationResult> {
        // Determine starting level based on error category
        let level = this.categorizeError(error);

        while (level <= 4) {
            const attempts = this.state.attemptsPerLevel.get(level) || 0;
            const maxAttempts = this.getMaxAttempts(level);

            if (attempts < maxAttempts) {
                // Attempt fix at this level
                const result = await this.attemptFix(error, fileContents, level, feature);

                this.state.attemptsPerLevel.set(level, attempts + 1);
                this.state.totalAttempts++;

                // Log escalation history
                this.state.escalationHistory.push({
                    level,
                    errorId: error.id,
                    success: result.success,
                    timestamp: new Date(),
                });

                // Save to database
                await this.saveEscalationRecord(error, level, result);

                if (result.success) {
                    this.state.errorsFixed++;
                    this.emit('error_fixed', {
                        errorId: error.id,
                        level,
                        fix: result.fix,
                    });
                    return {
                        success: true,
                        level,
                        fix: result.fix,
                        escalated: level > this.categorizeError(error),
                        message: `Fixed at Level ${level}`,
                    };
                }

                // Check if should escalate
                if (!this.config.autoEscalate) {
                    return {
                        success: false,
                        level,
                        fix: null,
                        escalated: false,
                        message: `Failed at Level ${level}, auto-escalate disabled`,
                    };
                }
            }

            // Escalate to next level
            level++;
            this.state.currentLevel = level as EscalationLevel;
            this.emit('escalating', { from: level - 1, to: level });
        }

        // All levels exhausted
        this.state.errorsFailed++;
        return {
            success: false,
            level: 4,
            fix: null,
            escalated: true,
            message: 'Maximum escalation reached - all 4 levels exhausted',
        };
    }

    /**
     * Attempt to fix an error at a specific level
     */
    private async attemptFix(
        error: BuildError,
        fileContents: Map<string, string>,
        level: EscalationLevel,
        feature?: Feature
    ): Promise<{ success: boolean; fix: Fix | null }> {
        const startTime = Date.now();
        const fixId = uuidv4();

        try {
            let result: { changes: FileChange[]; strategy: string; tokensUsed: number; thinkingTokens: number };

            switch (level) {
                case 1:
                    result = await this.level1SimpleFix(error, fileContents);
                    break;
                case 2:
                    result = await this.level2DeepAnalysis(error, fileContents);
                    break;
                case 3:
                    result = await this.level3ComponentRewrite(error, fileContents);
                    break;
                case 4:
                    if (!this.intent || !feature) {
                        throw new Error('Intent Contract and Feature required for Level 4');
                    }
                    result = await this.level4FeatureRebuild(error, fileContents, feature);
                    break;
                default:
                    throw new Error(`Invalid escalation level: ${level}`);
            }

            const fix: Fix = {
                id: fixId,
                errorId: error.id,
                level,
                strategy: result.strategy,
                changes: result.changes,
                successful: true,
                durationMs: Date.now() - startTime,
                tokensUsed: result.tokensUsed,
                thinkingTokens: result.thinkingTokens,
                timestamp: new Date(),
            };

            // Log to artifact manager
            await this.artifactManager.addIssueResolution({
                errorType: error.category,
                errorMessage: error.message,
                solution: result.strategy,
                filesAffected: result.changes.map(c => c.path),
                resolutionMethod: level <= 2 ? 'auto_fix' : 'escalation',
                escalationLevel: level,
            });

            return { success: true, fix };

        } catch (err) {
            console.error(`[ErrorEscalation] Level ${level} fix failed:`, err);
            return { success: false, fix: null };
        }
    }

    /**
     * Level 1: SIMPLE FIXES
     * Model: Sonnet 4.5, medium effort | Max Attempts: 3
     */
    private async level1SimpleFix(
        error: BuildError,
        fileContents: Map<string, string>
    ): Promise<{ changes: FileChange[]; strategy: string; tokensUsed: number; thinkingTokens: number }> {
        const phaseConfig = getPhaseConfig('error_check');

        const prompt = `Fix this simple error:

Error: ${error.message}
${error.file ? `File: ${error.file}` : ''}
${error.line ? `Line: ${error.line}` : ''}

Current file content:
\`\`\`
${error.file ? fileContents.get(error.file)?.substring(0, 3000) || 'File not found' : 'No file specified'}
\`\`\`

Provide a direct fix. Respond with JSON:
{
  "strategy": "Brief description of the fix",
  "changes": [
    {
      "path": "file path",
      "action": "update",
      "newContent": "complete fixed file content"
    }
  ]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: phaseConfig.model,
            maxTokens: 8000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 8000,
        });

        const result = this.parseFixResponse(response.content);

        return {
            changes: result.changes,
            strategy: result.strategy || 'Level 1 simple fix',
            tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
            thinkingTokens: response.usage.thinkingTokens || 0,
        };
    }

    /**
     * Level 2: DEEP ANALYSIS
     * Model: Opus 4.5, HIGH effort, 64K thinking | Max Attempts: 3
     */
    private async level2DeepAnalysis(
        error: BuildError,
        fileContents: Map<string, string>
    ): Promise<{ changes: FileChange[]; strategy: string; tokensUsed: number; thinkingTokens: number }> {
        // Check for similar past resolutions
        const pastResolution = await this.artifactManager.findSimilarResolution(
            error.category,
            error.message
        );

        const phaseConfig = getPhaseConfig('intent_satisfaction');

        const prompt = `Deep analysis required for this error:

Error: ${error.message}
Category: ${error.category}
${error.file ? `File: ${error.file}` : ''}
${error.stack ? `Stack: ${error.stack.substring(0, 500)}` : ''}

${pastResolution ? `
Similar past resolution found:
- Solution: ${pastResolution.solution}
- Files affected: ${pastResolution.filesAffected.join(', ')}
Consider applying a similar approach.
` : ''}

Related files:
${Array.from(fileContents.entries()).slice(0, 5).map(([path, content]) => `
### ${path}
\`\`\`
${content.substring(0, 2000)}
\`\`\`
`).join('\n')}

Think deeply about:
1. The root cause of this error
2. How it relates to other files
3. The best fix approach
4. Potential side effects

Respond with JSON:
{
  "analysis": "Deep analysis of the issue",
  "rootCause": "The actual root cause",
  "strategy": "Comprehensive fix strategy",
  "changes": [
    {
      "path": "file path",
      "action": "create | update | delete",
      "newContent": "complete fixed file content"
    }
  ]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: phaseConfig.model,
            effort: 'high',
            maxTokens: 16000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 64000,
        });

        const result = this.parseFixResponse(response.content);

        return {
            changes: result.changes,
            strategy: result.strategy || result.analysis || 'Deep analysis fix',
            tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
            thinkingTokens: response.usage.thinkingTokens || 0,
        };
    }

    /**
     * Level 3: COMPONENT REWRITE
     * Model: Opus 4.5, HIGH effort, 64K thinking | Max Attempts: 2
     */
    private async level3ComponentRewrite(
        error: BuildError,
        fileContents: Map<string, string>
    ): Promise<{ changes: FileChange[]; strategy: string; tokensUsed: number; thinkingTokens: number }> {
        const phaseConfig = getPhaseConfig('intent_satisfaction');

        const prompt = `Component rewrite required. Error persisted through Level 2.

Error: ${error.message}
Category: ${error.category}
File: ${error.file || 'Unknown'}

The error could not be fixed with simple changes. A targeted rewrite is needed.

Current component:
\`\`\`
${error.file ? fileContents.get(error.file) || 'File not found' : 'No file specified'}
\`\`\`

Requirements:
1. Identify the MINIMUM scope for rewrite (don't rewrite more than necessary)
2. PRESERVE all interfaces to avoid breaking other code
3. Create a fresh implementation that avoids the error
4. Document what was changed and why

Respond with JSON:
{
  "scope": "Minimum files/components to rewrite",
  "preservedInterfaces": ["List of interfaces kept"],
  "strategy": "Rewrite approach",
  "changes": [
    {
      "path": "file path",
      "action": "create | update | delete",
      "newContent": "complete new file content"
    }
  ]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: phaseConfig.model,
            effort: 'high',
            maxTokens: 32000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 64000,
        });

        const result = this.parseFixResponse(response.content);

        return {
            changes: result.changes,
            strategy: result.strategy || 'Component rewrite',
            tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
            thinkingTokens: response.usage.thinkingTokens || 0,
        };
    }

    /**
     * Level 4: FEATURE REBUILD (Nuclear Option)
     * Model: Opus 4.5, HIGH effort, 64K thinking | Max Attempts: 1
     * Rebuilds entire feature from Intent Contract
     */
    private async level4FeatureRebuild(
        error: BuildError,
        fileContents: Map<string, string>,
        feature: Feature
    ): Promise<{ changes: FileChange[]; strategy: string; tokensUsed: number; thinkingTokens: number }> {
        if (!this.intent) {
            throw new Error('Intent Contract required for Level 4 rebuild');
        }

        const phaseConfig = getPhaseConfig('intent_satisfaction');

        const prompt = `NUCLEAR OPTION: Full feature rebuild required.

Previous fix attempts at Levels 1-3 have failed. This feature needs to be rebuilt from scratch.

## Original Intent Contract (Sacred Contract):
App Type: ${this.intent.appType}
Core Value Prop: ${this.intent.coreValueProp}
App Soul: ${this.intent.appSoul}

## Feature to Rebuild:
ID: ${feature.featureId}
Description: ${feature.description}
Category: ${feature.category}
Priority: ${feature.priority}

Implementation Steps:
${feature.implementationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Visual Requirements:
${feature.visualRequirements.map(r => `- ${r}`).join('\n')}

## Previous Error:
${error.message}

## Instructions:
1. Completely rebuild this feature from scratch
2. Use ONLY the Intent Contract as your guide
3. Ignore any previous implementation
4. Create production-ready code that satisfies the feature requirements
5. Follow the Anti-Slop Design Manifesto

Respond with JSON:
{
  "strategy": "Complete rebuild from Intent Contract",
  "reasoning": "Why previous implementations failed",
  "changes": [
    {
      "path": "file path",
      "action": "create | update | delete",
      "newContent": "complete new file content"
    }
  ]
}`;

        const response = await this.claudeService.generate(prompt, {
            model: phaseConfig.model,
            effort: 'high',
            maxTokens: 64000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 64000,
        });

        const result = this.parseFixResponse(response.content);

        return {
            changes: result.changes,
            strategy: 'Full feature rebuild from Intent Contract (Level 4 nuclear option)',
            tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
            thinkingTokens: response.usage.thinkingTokens || 0,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Categorize an error to determine starting escalation level
     */
    private categorizeError(error: BuildError): EscalationLevel {
        if (LEVEL_1_CATEGORIES.includes(error.category)) return 1;
        if (LEVEL_2_CATEGORIES.includes(error.category)) return 2;
        if (LEVEL_3_CATEGORIES.includes(error.category)) return 3;
        if (LEVEL_4_CATEGORIES.includes(error.category)) return 4;
        return 1; // Default to Level 1
    }

    /**
     * Get max attempts for a level
     */
    private getMaxAttempts(level: EscalationLevel): number {
        switch (level) {
            case 1: return this.config.level1MaxAttempts;
            case 2: return this.config.level2MaxAttempts;
            case 3: return this.config.level3MaxAttempts;
            case 4: return this.config.level4MaxAttempts;
        }
    }

    /**
     * Parse fix response from Claude
     */
    private parseFixResponse(content: string): {
        changes: FileChange[];
        strategy?: string;
        analysis?: string;
    } {
        try {
            const json = JSON.parse(content);
            return {
                changes: json.changes || [],
                strategy: json.strategy,
                analysis: json.analysis,
            };
        } catch {
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const json = JSON.parse(jsonMatch[0]);
                return {
                    changes: json.changes || [],
                    strategy: json.strategy,
                    analysis: json.analysis,
                };
            }
            throw new Error('Could not parse fix response');
        }
    }

    /**
     * Save escalation record to database
     */
    private async saveEscalationRecord(
        error: BuildError,
        level: EscalationLevel,
        result: { success: boolean; fix: Fix | null }
    ): Promise<void> {
        // Build attempt record for the JSON array
        const attemptRecord = {
            level,
            attempt: (this.state.attemptsPerLevel.get(level) || 0) + 1,
            model: level >= 2 ? 'claude-opus-4-5' : 'claude-sonnet-4-5',
            effort: level >= 2 ? 'high' : 'medium',
            thinkingBudget: level >= 2 ? 65536 : undefined,
            fixApplied: result.fix?.strategy || 'No fix applied',
            result: result.success ? 'success' as const : 'failure' as const,
            durationMs: result.fix?.durationMs || 0,
            tokensUsed: result.fix?.tokensUsed || 0,
            timestamp: new Date().toISOString(),
        };

        // Use type assertion to work around Drizzle ORM type inference issues
        const insertData = {
            orchestrationRunId: this.orchestrationRunId,
            projectId: this.projectId,
            errorType: error.category,
            errorMessage: error.message,
            errorFile: error.file,
            errorLine: error.line,
            currentLevel: level,
            totalAttempts: this.state.totalAttempts,
            attempts: [attemptRecord],
            resolved: result.success,
            resolvedAt: result.success ? new Date().toISOString() : undefined,
            resolvedAtLevel: result.success ? level : undefined,
            finalFix: result.success ? result.fix?.strategy : undefined,
            wasRebuiltFromIntent: level === 4 && result.success,
        } as typeof errorEscalationHistory.$inferInsert;

        await db.insert(errorEscalationHistory).values(insertData);
    }

    /**
     * Reset escalation state for a new error
     */
    reset(): void {
        this.state = {
            currentLevel: 1,
            attemptsPerLevel: new Map([
                [1, 0], [2, 0], [3, 0], [4, 0],
            ]),
            totalAttempts: 0,
            errorsFixed: 0,
            errorsFailed: 0,
            escalationHistory: [],
        };
    }

    /**
     * Get current state
     */
    getState(): EscalationState {
        return {
            ...this.state,
            attemptsPerLevel: new Map(this.state.attemptsPerLevel),
            escalationHistory: [...this.state.escalationHistory],
        };
    }

    /**
     * Check if human escalation is required
     * Returns true when all 4 levels have been exhausted
     */
    needsHumanEscalation(): boolean {
        const level4Attempts = this.state.attemptsPerLevel.get(4) || 0;
        return level4Attempts >= this.config.level4MaxAttempts;
    }

    /**
     * Get a summary of escalation history for human review
     */
    getEscalationSummary(): {
        totalAttempts: number;
        levelsExhausted: EscalationLevel[];
        lastErrorMessage: string;
        history: Array<{
            level: EscalationLevel;
            errorId: string;
            success: boolean;
            timestamp: Date;
        }>;
    } {
        const levelsExhausted: EscalationLevel[] = [];
        for (const level of [1, 2, 3, 4] as EscalationLevel[]) {
            const attempts = this.state.attemptsPerLevel.get(level) || 0;
            const maxAttempts = this.getMaxAttempts(level);
            if (attempts >= maxAttempts) {
                levelsExhausted.push(level);
            }
        }

        const lastEntry = this.state.escalationHistory[this.state.escalationHistory.length - 1];
        const lastErrorMessage = lastEntry?.errorId || 'Unknown';

        return {
            totalAttempts: this.state.totalAttempts,
            levelsExhausted,
            lastErrorMessage,
            history: this.state.escalationHistory,
        };
    }

    /**
     * Generate a human-readable escalation report
     */
    generateHumanEscalationReport(error: BuildError): string {
        const summary = this.getEscalationSummary();

        return `
# HUMAN ESCALATION REQUIRED

The 4-Level Error Escalation System has exhausted all automatic fix attempts.

## Error Details
- **Error ID**: ${error.id}
- **Category**: ${error.category}
- **Message**: ${error.message}
- **File**: ${error.file || 'Unknown'}
- **Line**: ${error.line || 'Unknown'}

## Escalation History
- **Total Attempts**: ${summary.totalAttempts}
- **Levels Exhausted**: ${summary.levelsExhausted.join(', ') || 'None'}

### Attempt Timeline
${summary.history.map((h, i) => `${i + 1}. Level ${h.level}: ${h.success ? 'SUCCESS' : 'FAILED'} at ${h.timestamp.toISOString()}`).join('\n')}

## Stack Trace
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

## Context
\`\`\`json
${JSON.stringify(error.context, null, 2)}
\`\`\`

## Recommended Actions
1. Review the error message and stack trace
2. Check for environmental issues (missing dependencies, configuration)
3. Review recent code changes that might have caused this issue
4. Consider reverting to a previous checkpoint if available
5. Manually fix the issue and resume the build
`;
    }

    /**
     * Emit human escalation event with full context
     */
    emitHumanEscalation(error: BuildError): void {
        const report = this.generateHumanEscalationReport(error);
        this.emit('human_escalation_required', {
            error,
            report,
            summary: this.getEscalationSummary(),
        });
    }
}

/**
 * Create an ErrorEscalationEngine instance
 */
export function createErrorEscalationEngine(
    orchestrationRunId: string,
    projectId: string,
    userId: string,
    config?: Partial<EscalationConfig>
): ErrorEscalationEngine {
    return new ErrorEscalationEngine(orchestrationRunId, projectId, userId, config);
}

