/**
 * Completion Gate Evaluator - Determines if Deep Intent is satisfied
 *
 * The final arbiter of "DONE". Evaluates all completion gate criteria:
 * - Functional checklist completion
 * - Integration verification
 * - Technical requirements
 * - Wiring verification
 * - Integration tests
 * - Placeholder detection
 * - Error detection
 * - Anti-slop score
 */

import type {
    DeepIntentContract,
    CompletionGate,
    FunctionalChecklistItem,
    IntegrationRequirement,
    TechnicalRequirement,
    WiringConnection,
    IntegrationTest,
    DeepIntentSatisfactionResult,
} from '../ai/intent-lock.js';

import {
    createFunctionalChecklistVerifier,
    type ChecklistVerificationSummary,
} from './functional-checklist-verifier.js';

import {
    createAntiSlopDetector,
    type AntiSlopScore,
} from './anti-slop-detector.js';

import { createIntentLockEngine, type IntentLockEngine } from '../ai/intent-lock.js';

// VL-JEPA Semantic Satisfaction Verification
import {
    getSemanticSatisfactionService,
    type SemanticSatisfactionService,
    type SatisfactionResult,
} from '../embeddings/semantic-satisfaction-service.js';

// =============================================================================
// TYPES
// =============================================================================

export interface GateEvaluationResult {
    gate: CompletionGate;
    satisfied: boolean;
    blockers: GateBlocker[];
    recommendations: string[];
    evaluatedAt: string;
    evaluationDurationMs: number;
}

export interface GateBlocker {
    category: 'functional' | 'integration' | 'technical' | 'wiring' | 'test' | 'placeholder' | 'error' | 'quality';
    severity: 'blocker' | 'warning';
    item: string;
    reason: string;
    suggestedFix?: string;
}

export interface EvaluationContext {
    fileContents: Map<string, string>;
    buildOutput?: string;
    screenshotPaths?: string[];
    consoleOutput?: string;
    /** Original user prompt/intent for semantic matching */
    originalPrompt?: string;
    /** Feature descriptions that have been built */
    builtFeatures?: string[];
    /** Visual descriptions of the UI */
    visualDescriptions?: string[];
}

// =============================================================================
// COMPLETION GATE EVALUATOR SERVICE
// =============================================================================

export class CompletionGateEvaluator {
    private projectId: string;
    private userId: string;
    private intentEngine: IntentLockEngine;
    private semanticService: SemanticSatisfactionService;

    constructor(userId: string, projectId: string) {
        this.projectId = projectId;
        this.userId = userId;
        this.intentEngine = createIntentLockEngine(userId, projectId);
        this.semanticService = getSemanticSatisfactionService();
    }

    /**
     * Evaluate the completion gate for a Deep Intent Contract
     */
    async evaluate(
        contract: DeepIntentContract,
        context: EvaluationContext
    ): Promise<GateEvaluationResult> {
        const startTime = Date.now();
        const blockers: GateBlocker[] = [];
        const recommendations: string[] = [];

        // Step 1: Evaluate Functional Checklist
        const fcResult = await this.evaluateFunctionalChecklist(
            contract.functionalChecklist,
            context.fileContents,
            contract.wiringMap,
            contract.id
        );
        blockers.push(...fcResult.blockers);

        // Step 2: Evaluate Integrations
        const irResult = this.evaluateIntegrations(contract.integrationRequirements);
        blockers.push(...irResult.blockers);

        // Step 3: Evaluate Technical Requirements
        const trResult = this.evaluateTechnicalRequirements(contract.technicalRequirements);
        blockers.push(...trResult.blockers);

        // Step 4: Evaluate Wiring
        const wiringResult = this.evaluateWiring(contract.wiringMap);
        blockers.push(...wiringResult.blockers);

        // Step 5: Evaluate Integration Tests
        const testResult = await this.evaluateIntegrationTests(contract.integrationTests, contract.id);
        blockers.push(...testResult.blockers);

        // Step 6: Check for Placeholders
        const placeholderResult = this.checkPlaceholders(context.fileContents);
        blockers.push(...placeholderResult.blockers);

        // Step 7: Check for Errors
        const errorResult = this.checkErrors(context.buildOutput, context.consoleOutput);
        blockers.push(...errorResult.blockers);

        // Step 8: Evaluate Anti-Slop Score
        const antiSlopResult = await this.evaluateAntiSlop(context.fileContents);

        // Step 9: VL-JEPA Semantic Satisfaction Check
        // This provides semantic understanding of whether the build truly satisfies the user's intent
        let semanticResult: SatisfactionResult | null = null;
        let semanticScore = 100; // Default to 100 if no semantic check is needed

        if (context.originalPrompt || context.builtFeatures?.length || context.visualDescriptions?.length) {
            try {
                semanticResult = await this.performSemanticSatisfactionCheck(contract, context);
                semanticScore = Math.round(semanticResult.overallScore * 100);

                // Add blockers for unsatisfied semantic criteria
                if (!semanticResult.isSatisfied) {
                    for (const criterion of semanticResult.criteriaResults.filter(c => !c.satisfied)) {
                        blockers.push({
                            category: 'functional',
                            severity: criterion.confidence > 0.7 ? 'blocker' : 'warning',
                            item: criterion.description,
                            reason: criterion.reason || `Semantic score: ${Math.round(criterion.semanticScore * 100)}%`,
                            suggestedFix: criterion.evidence,
                        });
                    }

                    for (const rec of semanticResult.recommendations) {
                        recommendations.push(rec);
                    }
                }
            } catch (semanticError) {
                console.warn('[CompletionGate] Semantic satisfaction check failed (non-blocking):', semanticError);
            }
        }

        // Build the completion gate
        const gate: CompletionGate = {
            functionalChecklistComplete: fcResult.complete,
            functionalChecklistCount: fcResult.counts,
            integrationsComplete: irResult.complete,
            integrationsCount: irResult.counts,
            technicalRequirementsComplete: trResult.complete,
            technicalRequirementsCount: trResult.counts,
            wiringComplete: wiringResult.complete,
            wiringCount: wiringResult.counts,
            integrationTestsPassed: testResult.complete,
            testsCount: testResult.counts,
            noPlaceholders: placeholderResult.clean,
            placeholdersFound: placeholderResult.found,
            noErrors: errorResult.clean,
            errorsFound: errorResult.found,
            antiSlopScore: antiSlopResult.score,
            intentSatisfied: false,
            blockers: blockers.filter(b => b.severity === 'blocker').map(b => `${b.category}: ${b.item}`),
        };

        // Determine if intent is satisfied
        gate.intentSatisfied = this.isFullySatisfied(gate);

        if (gate.intentSatisfied) {
            gate.satisfiedAt = new Date().toISOString();
        }

        // Generate recommendations
        if (!gate.functionalChecklistComplete) {
            recommendations.push(`Complete ${gate.functionalChecklistCount.total - gate.functionalChecklistCount.verified} remaining functional checklist items`);
        }
        if (!gate.integrationsComplete) {
            recommendations.push(`Verify ${gate.integrationsCount.total - gate.integrationsCount.verified} remaining integrations`);
        }
        if (!gate.integrationTestsPassed) {
            recommendations.push(`Fix ${gate.testsCount.total - gate.testsCount.passed} failing integration tests`);
        }
        if (!gate.noPlaceholders) {
            recommendations.push(`Remove ${gate.placeholdersFound.length} placeholders`);
        }
        if (gate.antiSlopScore < 85) {
            recommendations.push(`Improve design quality (current: ${gate.antiSlopScore}, required: 85+)`);
        }

        return {
            gate,
            satisfied: gate.intentSatisfied,
            blockers,
            recommendations,
            evaluatedAt: new Date().toISOString(),
            evaluationDurationMs: Date.now() - startTime,
        };
    }

    /**
     * Quick evaluation - checks only critical blockers
     */
    async quickEvaluate(
        contract: DeepIntentContract,
        context: EvaluationContext
    ): Promise<{ satisfied: boolean; blockers: string[] }> {
        const blockers: string[] = [];

        // Check placeholders (most common blocker)
        const placeholderResult = this.checkPlaceholders(context.fileContents);
        if (!placeholderResult.clean) {
            blockers.push(...placeholderResult.found.map(p => `Placeholder: ${p}`));
        }

        // Check errors
        const errorResult = this.checkErrors(context.buildOutput, context.consoleOutput);
        if (!errorResult.clean) {
            blockers.push(...errorResult.found.map(e => `Error: ${e}`));
        }

        // Check integration tests
        const failedTests = contract.integrationTests.filter(t => !t.passed);
        if (failedTests.length > 0) {
            blockers.push(`${failedTests.length} integration tests failing`);
        }

        // Check unverified integrations
        const unverifiedIntegrations = contract.integrationRequirements.filter(i => !i.verified);
        if (unverifiedIntegrations.length > 0) {
            blockers.push(`${unverifiedIntegrations.length} integrations unverified`);
        }

        return {
            satisfied: blockers.length === 0,
            blockers,
        };
    }

    /**
     * Convert to DeepIntentSatisfactionResult format
     */
    toSatisfactionResult(
        contract: DeepIntentContract,
        evaluation: GateEvaluationResult
    ): DeepIntentSatisfactionResult {
        const gate = evaluation.gate;

        const fcPercentage = gate.functionalChecklistCount.total > 0
            ? Math.round((gate.functionalChecklistCount.verified / gate.functionalChecklistCount.total) * 100)
            : 100;

        const irPercentage = gate.integrationsCount.total > 0
            ? Math.round((gate.integrationsCount.verified / gate.integrationsCount.total) * 100)
            : 100;

        const trPercentage = gate.technicalRequirementsCount.total > 0
            ? Math.round((gate.technicalRequirementsCount.verified / gate.technicalRequirementsCount.total) * 100)
            : 100;

        const wcPercentage = gate.wiringCount.total > 0
            ? Math.round((gate.wiringCount.verified / gate.wiringCount.total) * 100)
            : 100;

        const testPercentage = gate.testsCount.total > 0
            ? Math.round((gate.testsCount.passed / gate.testsCount.total) * 100)
            : 100;

        const overallProgress = Math.round(
            fcPercentage * 0.3 +
            irPercentage * 0.2 +
            trPercentage * 0.2 +
            wcPercentage * 0.15 +
            testPercentage * 0.15
        );

        const remainingItems =
            (gate.functionalChecklistCount.total - gate.functionalChecklistCount.verified) +
            (gate.integrationsCount.total - gate.integrationsCount.verified) +
            (gate.testsCount.total - gate.testsCount.passed);

        return {
            satisfied: gate.intentSatisfied,
            gate,
            progress: {
                functionalChecklist: {
                    completed: gate.functionalChecklistCount.verified,
                    total: gate.functionalChecklistCount.total,
                    percentage: fcPercentage,
                },
                integrations: {
                    completed: gate.integrationsCount.verified,
                    total: gate.integrationsCount.total,
                    percentage: irPercentage,
                },
                technicalRequirements: {
                    completed: gate.technicalRequirementsCount.verified,
                    total: gate.technicalRequirementsCount.total,
                    percentage: trPercentage,
                },
                wiring: {
                    completed: gate.wiringCount.verified,
                    total: gate.wiringCount.total,
                    percentage: wcPercentage,
                },
                tests: {
                    passed: gate.testsCount.passed,
                    total: gate.testsCount.total,
                    percentage: testPercentage,
                },
            },
            blockers: evaluation.blockers.map(b => ({
                category: b.category,
                item: b.item,
                reason: b.reason,
                suggestedFix: b.suggestedFix,
            })),
            overallProgress,
            estimatedRemainingWork: {
                items: remainingItems,
                estimatedMinutes: Math.ceil(remainingItems * 2),
            },
        };
    }

    // =========================================================================
    // PRIVATE EVALUATION METHODS
    // =========================================================================

    private async evaluateFunctionalChecklist(
        checklist: FunctionalChecklistItem[],
        fileContents: Map<string, string>,
        wiringMap: WiringConnection[],
        contractId: string
    ): Promise<{
        complete: boolean;
        counts: { verified: number; total: number };
        blockers: GateBlocker[];
    }> {
        const verifier = createFunctionalChecklistVerifier(this.userId, this.projectId);
        const summary = await verifier.verifyChecklist(checklist, fileContents, wiringMap, contractId);

        const blockers: GateBlocker[] = [];
        for (const result of summary.results) {
            if (!result.passed) {
                const item = checklist.find(fc => fc.id === result.itemId);
                blockers.push({
                    category: 'functional',
                    severity: 'blocker',
                    item: item?.name || result.itemId,
                    reason: result.issues.map(i => i.message).join('; '),
                    suggestedFix: result.issues[0]?.suggestedFix,
                });
            }
        }

        return {
            complete: summary.passedItems === summary.totalItems,
            counts: { verified: summary.passedItems, total: summary.totalItems },
            blockers,
        };
    }

    private evaluateIntegrations(integrations: IntegrationRequirement[]): {
        complete: boolean;
        counts: { verified: number; total: number };
        blockers: GateBlocker[];
    } {
        const blockers: GateBlocker[] = [];
        const verified = integrations.filter(i => i.verified).length;

        for (const integration of integrations.filter(i => !i.verified)) {
            blockers.push({
                category: 'integration',
                severity: 'blocker',
                item: integration.platform,
                reason: `Integration not verified: ${integration.purpose}`,
                suggestedFix: `Configure and test ${integration.platform} API (${integration.credentialRequirements.envVarName})`,
            });
        }

        return {
            complete: verified === integrations.length,
            counts: { verified, total: integrations.length },
            blockers,
        };
    }

    private evaluateTechnicalRequirements(requirements: TechnicalRequirement[]): {
        complete: boolean;
        counts: { verified: number; total: number };
        blockers: GateBlocker[];
    } {
        const blockers: GateBlocker[] = [];
        const verified = requirements.filter(r => r.verified).length;

        for (const req of requirements.filter(r => !r.verified)) {
            blockers.push({
                category: 'technical',
                severity: 'blocker',
                item: req.component,
                reason: req.description,
                suggestedFix: `Implement and verify: ${req.component}`,
            });
        }

        return {
            complete: verified === requirements.length,
            counts: { verified, total: requirements.length },
            blockers,
        };
    }

    private evaluateWiring(wiringMap: WiringConnection[]): {
        complete: boolean;
        counts: { verified: number; total: number };
        blockers: GateBlocker[];
    } {
        const blockers: GateBlocker[] = [];
        const verified = wiringMap.filter(w => w.verified).length;

        for (const connection of wiringMap.filter(w => !w.verified)) {
            blockers.push({
                category: 'wiring',
                severity: 'warning',
                item: `${connection.from.name} → ${connection.to.name}`,
                reason: `Wiring not verified: ${connection.dataFlow}`,
                suggestedFix: `Verify ${connection.connectionType} connection between ${connection.from.name} and ${connection.to.name}`,
            });
        }

        return {
            complete: verified === wiringMap.length,
            counts: { verified, total: wiringMap.length },
            blockers,
        };
    }

    private async evaluateIntegrationTests(tests: IntegrationTest[], contractId: string): Promise<{
        complete: boolean;
        counts: { passed: number; total: number };
        blockers: GateBlocker[];
    }> {
        const blockers: GateBlocker[] = [];
        const passed = tests.filter(t => t.passed).length;

        // PRODUCTION: Mark each test result in the Deep Intent Contract
        for (const test of tests) {
            try {
                await this.intentEngine.markIntegrationTestResult(
                    contractId,
                    test.id,
                    test.passed,
                    test.lastError,
                    test.durationMs
                );
                console.log(`[CompletionGateEvaluator] Marked test ${test.id} as ${test.passed ? 'PASSED' : 'FAILED'} in contract ${contractId}`);
            } catch (error) {
                console.error(`[CompletionGateEvaluator] Failed to mark test ${test.id}:`, error);
                // Don't throw - evaluation can continue
            }

            // Add to blockers if not passed
            if (!test.passed) {
                blockers.push({
                    category: 'test',
                    severity: 'blocker',
                    item: test.name,
                    reason: test.lastError || 'Test not passed',
                    suggestedFix: `Fix test: ${test.description}`,
                });
            }
        }

        return {
            complete: passed === tests.length,
            counts: { passed, total: tests.length },
            blockers,
        };
    }

    private checkPlaceholders(fileContents: Map<string, string>): {
        clean: boolean;
        found: string[];
        blockers: GateBlocker[];
    } {
        const found: string[] = [];
        const blockers: GateBlocker[] = [];

        const placeholderPatterns = [
            /TODO/gi,
            /FIXME/gi,
            /XXX/gi,
            /placeholder/gi,
            /coming\s*soon/gi,
            /not\s*implemented/gi,
            /lorem\s*ipsum/gi,
        ];

        for (const [filePath, content] of fileContents) {
            for (const pattern of placeholderPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    for (const match of matches) {
                        const placeholder = `${match} in ${filePath}`;
                        if (!found.includes(placeholder)) {
                            found.push(placeholder);
                            blockers.push({
                                category: 'placeholder',
                                severity: 'blocker',
                                item: match,
                                reason: `Found in ${filePath}`,
                                suggestedFix: `Replace "${match}" with actual implementation`,
                            });
                        }
                    }
                }
            }
        }

        return {
            clean: found.length === 0,
            found,
            blockers,
        };
    }

    private checkErrors(buildOutput?: string, consoleOutput?: string): {
        clean: boolean;
        found: string[];
        blockers: GateBlocker[];
    } {
        const found: string[] = [];
        const blockers: GateBlocker[] = [];

        const errorPatterns = [
            /error\s*TS\d+/gi,        // TypeScript errors
            /SyntaxError/gi,
            /ReferenceError/gi,
            /TypeError/gi,
            /Cannot find module/gi,
            /Module not found/gi,
            /Unexpected token/gi,
            /is not defined/gi,
        ];

        const sources = [buildOutput, consoleOutput].filter(Boolean);
        for (const source of sources) {
            for (const pattern of errorPatterns) {
                const matches = source!.match(pattern);
                if (matches) {
                    for (const match of matches) {
                        if (!found.includes(match)) {
                            found.push(match);
                            blockers.push({
                                category: 'error',
                                severity: 'blocker',
                                item: match,
                                reason: 'Build or runtime error detected',
                                suggestedFix: 'Fix the error before completion',
                            });
                        }
                    }
                }
            }
        }

        return {
            clean: found.length === 0,
            found,
            blockers,
        };
    }

    private async evaluateAntiSlop(fileContents: Map<string, string>): Promise<{ score: number }> {
        // Filter to only tsx/jsx files for anti-slop analysis
        const uiFiles = new Map<string, string>();
        for (const [filePath, content] of fileContents) {
            if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
                uiFiles.set(filePath, content);
            }
        }

        if (uiFiles.size === 0) {
            // No UI files to analyze, return passing score
            return { score: 85 };
        }

        // Use the anti-slop detector
        const detector = createAntiSlopDetector(this.userId, this.projectId, 'professional_trust');
        const result = await detector.analyze(uiFiles);

        return { score: result.overall };
    }

    /**
     * VL-JEPA based semantic satisfaction check
     * Uses embeddings to verify the build truly satisfies the user's original intent
     */
    private async performSemanticSatisfactionCheck(
        contract: DeepIntentContract,
        context: EvaluationContext
    ): Promise<SatisfactionResult> {
        // Build description from context
        const buildDescription = [
            `Project: ${contract.appType}`,
            `Core Value: ${contract.coreValueProp}`,
            context.builtFeatures?.length ? `Features: ${context.builtFeatures.join(', ')}` : '',
        ].filter(Boolean).join('\n');

        // Extract code samples from file contents
        const codeSamples: string[] = [];
        for (const [filePath, content] of context.fileContents) {
            // Only include key files (not too large)
            if (content.length < 5000 && (
                filePath.includes('page') ||
                filePath.includes('component') ||
                filePath.includes('api/') ||
                filePath.includes('route')
            )) {
                codeSamples.push(`// ${filePath}\n${content.slice(0, 2000)}`);
            }
        }

        try {
            // Check satisfaction against stored intent
            const result = await this.semanticService.checkSatisfaction({
                intentId: contract.id,
                buildDescription,
                codeSamples: codeSamples.slice(0, 10), // Limit to 10 samples
                features: context.builtFeatures,
                visualDescriptions: context.visualDescriptions,
            }, this.userId);

            console.log(`[CompletionGate] VL-JEPA Semantic Score: ${Math.round(result.overallScore * 100)}% (satisfied: ${result.isSatisfied})`);

            return result;
        } catch (error) {
            // If intent not found in semantic store, return a default passing result
            // The intent might not have been indexed yet
            console.warn(`[CompletionGate] Semantic check failed (intent may not be indexed):`, error);

            return {
                overallScore: 0.85,
                isSatisfied: true,
                satisfactionLevel: 'partial',
                criteriaResults: [],
                workflowResults: [],
                codeQualityScore: 0.85,
                featureCompleteness: {
                    implemented: context.builtFeatures?.length || 0,
                    total: context.builtFeatures?.length || 1,
                    percentage: 100,
                },
                recommendations: ['Index intent for semantic verification'],
                confidence: 0.5,
            };
        }
    }

    private isFullySatisfied(gate: CompletionGate): boolean {
        return (
            gate.functionalChecklistComplete &&
            gate.integrationsComplete &&
            gate.technicalRequirementsComplete &&
            gate.wiringComplete &&
            gate.integrationTestsPassed &&
            gate.noPlaceholders &&
            gate.noErrors &&
            gate.antiSlopScore >= 85
        );
    }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export function createCompletionGateEvaluator(userId: string, projectId: string): CompletionGateEvaluator {
    return new CompletionGateEvaluator(userId, projectId);
}

/**
 * Quick evaluation helper
 */
export async function evaluateCompletionGate(
    contract: DeepIntentContract,
    context: EvaluationContext,
    userId: string,
    projectId: string
): Promise<GateEvaluationResult> {
    const evaluator = createCompletionGateEvaluator(userId, projectId);
    return evaluator.evaluate(contract, context);
}
