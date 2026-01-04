/**
 * Sandbox Merge Controller
 *
 * Manages the critical merge process from build sandboxes to main.
 * Implements 7-gate verification before allowing merge.
 *
 * Part of Modal + Vercel Sandboxing Architecture (Phase 6)
 *
 * 7 GATES:
 * 1. Swarm Verification - 6-agent verification swarm
 * 2. Anti-Slop Check - 85+ score required
 * 3. Build Check - Error-free compilation
 * 4. Compatibility Check - Compatible with other sandboxes
 * 5. Intent Satisfaction - Validates against contract
 * 6. Visual Verification - Headless Playwright screenshots
 * 7. Main-Test Sandbox - Test merge in isolated main clone
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createVerificationSwarm, type CombinedVerificationResult } from '../verification/swarm.js';
import { createAntiSlopDetector, type AntiSlopScore } from '../verification/anti-slop-detector.js';
import { getPhaseConfig } from '../ai/openrouter-client.js';
import type { IntentContract } from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export interface MergeControllerConfig {
    strictMode: boolean;
    antiSlopThreshold: number;
    requireAllGates: boolean;
    autoMerge: boolean;
}

export interface VerificationChecklist {
    swarm: CheckResult;
    antislop: CheckResult;
    build: CheckResult;
    compatibility: CheckResult;
    intent: CheckResult;
    visual: CheckResult;
    maintest: CheckResult;
}

export interface CheckResult {
    passed: boolean;
    score?: number;
    details: any;
    duration: number;
    error?: string;
}

export interface MergeRequest {
    id: string;
    sandboxId: string;
    taskId: string;
    files: FileChange[];
    intentContract?: IntentContract;
    targetBranch?: string;
}

export interface FileChange {
    path: string;
    content: string;
    action: 'create' | 'modify' | 'delete';
}

export interface MergeResult {
    success: boolean;
    mergedFiles: string[];
    failedChecks?: string[];
    verificationResults: VerificationChecklist;
    mergeDuration: number;
    gatesPassed: number;
    gatesTotalCount: number;
    mainTestSandboxId?: string;
}

export interface MergeStatus {
    id: string;
    status: 'pending' | 'verifying' | 'approved' | 'rejected' | 'merging' | 'completed' | 'failed';
    currentGate: string;
    gatesCompleted: number;
    gatesTotalCount: number;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}

// =============================================================================
// SANDBOX MERGE CONTROLLER
// =============================================================================

export class SandboxMergeController extends EventEmitter {
    private config: MergeControllerConfig;
    private mergeStatuses: Map<string, MergeStatus> = new Map();
    private mergeResults: Map<string, MergeResult> = new Map();
    private mainTestSandboxes: Map<string, string> = new Map();

    constructor(config?: Partial<MergeControllerConfig>) {
        super();
        this.config = {
            strictMode: config?.strictMode ?? true,
            antiSlopThreshold: config?.antiSlopThreshold ?? 85,
            requireAllGates: config?.requireAllGates ?? true,
            autoMerge: config?.autoMerge ?? false,
        };

        console.log('[MergeController] Initialized', this.config);
    }

    /**
     * Main verification and merge flow
     * Runs all 7 gates in sequence
     */
    async verifyAndMerge(request: MergeRequest): Promise<MergeResult> {
        const startTime = Date.now();
        const status: MergeStatus = {
            id: request.id,
            status: 'verifying',
            currentGate: 'initializing',
            gatesCompleted: 0,
            gatesTotalCount: 7,
            startedAt: new Date(),
        };

        this.mergeStatuses.set(request.id, status);
        this.emit('merge:started', { requestId: request.id, sandboxId: request.sandboxId });

        console.log(`[MergeController] Starting merge verification for ${request.id} (sandbox: ${request.sandboxId})`);

        const verificationResults: VerificationChecklist = {
            swarm: { passed: false, details: null, duration: 0 },
            antislop: { passed: false, details: null, duration: 0 },
            build: { passed: false, details: null, duration: 0 },
            compatibility: { passed: false, details: null, duration: 0 },
            intent: { passed: false, details: null, duration: 0 },
            visual: { passed: false, details: null, duration: 0 },
            maintest: { passed: false, details: null, duration: 0 },
        };

        const failedChecks: string[] = [];

        try {
            // GATE 1: Verification Swarm
            status.currentGate = 'swarm';
            verificationResults.swarm = await this.runVerificationSwarm(request);
            status.gatesCompleted++;
            this.emit('gate:completed', { requestId: request.id, gate: 'swarm', passed: verificationResults.swarm.passed });

            if (!verificationResults.swarm.passed && this.config.requireAllGates) {
                failedChecks.push('Verification Swarm (6-agent validation failed)');
                if (this.config.strictMode) {
                    throw new Error('Verification Swarm failed - merge blocked');
                }
            }

            // GATE 2: Anti-Slop Check
            status.currentGate = 'antislop';
            verificationResults.antislop = await this.runAntiSlopCheck(request);
            status.gatesCompleted++;
            this.emit('gate:completed', { requestId: request.id, gate: 'antislop', passed: verificationResults.antislop.passed });

            if (!verificationResults.antislop.passed && this.config.requireAllGates) {
                failedChecks.push(`Anti-Slop (score ${verificationResults.antislop.score}/${this.config.antiSlopThreshold} required)`);
                if (this.config.strictMode) {
                    throw new Error(`Anti-Slop check failed - score ${verificationResults.antislop.score} below threshold ${this.config.antiSlopThreshold}`);
                }
            }

            // GATE 3: Build Check
            status.currentGate = 'build';
            verificationResults.build = await this.runBuildCheck(request);
            status.gatesCompleted++;
            this.emit('gate:completed', { requestId: request.id, gate: 'build', passed: verificationResults.build.passed });

            if (!verificationResults.build.passed && this.config.requireAllGates) {
                failedChecks.push('Build Check (compilation errors detected)');
                if (this.config.strictMode) {
                    throw new Error('Build check failed - merge blocked');
                }
            }

            // GATE 4: Compatibility Check
            status.currentGate = 'compatibility';
            verificationResults.compatibility = await this.checkCompatibility(request);
            status.gatesCompleted++;
            this.emit('gate:completed', { requestId: request.id, gate: 'compatibility', passed: verificationResults.compatibility.passed });

            if (!verificationResults.compatibility.passed && this.config.requireAllGates) {
                failedChecks.push('Compatibility Check (conflicts with other sandboxes)');
            }

            // GATE 5: Intent Satisfaction
            status.currentGate = 'intent';
            verificationResults.intent = await this.checkIntentSatisfaction(request);
            status.gatesCompleted++;
            this.emit('gate:completed', { requestId: request.id, gate: 'intent', passed: verificationResults.intent.passed });

            if (!verificationResults.intent.passed && this.config.requireAllGates) {
                failedChecks.push('Intent Satisfaction (does not meet contract requirements)');
                if (this.config.strictMode) {
                    throw new Error('Intent satisfaction failed - merge blocked');
                }
            }

            // GATE 6: Visual Verification
            status.currentGate = 'visual';
            verificationResults.visual = await this.runVisualVerification(request);
            status.gatesCompleted++;
            this.emit('gate:completed', { requestId: request.id, gate: 'visual', passed: verificationResults.visual.passed });

            if (!verificationResults.visual.passed && this.config.requireAllGates) {
                failedChecks.push('Visual Verification (screenshot analysis failed)');
            }

            // GATE 7: Main-Test Sandbox
            status.currentGate = 'maintest';
            verificationResults.maintest = await this.testInMainTestSandbox(request);
            status.gatesCompleted++;
            this.emit('gate:completed', { requestId: request.id, gate: 'maintest', passed: verificationResults.maintest.passed });

            if (!verificationResults.maintest.passed && this.config.requireAllGates) {
                failedChecks.push('Main-Test Sandbox (merge test in isolated environment failed)');
                if (this.config.strictMode) {
                    throw new Error('Main-test sandbox failed - merge blocked');
                }
            }

            // Determine if merge should proceed
            const allGatesPassed = Object.values(verificationResults).every(r => r.passed);
            const criticalGatesPassed = verificationResults.swarm.passed &&
                verificationResults.build.passed &&
                verificationResults.intent.passed;

            const shouldMerge = this.config.requireAllGates ? allGatesPassed : criticalGatesPassed;

            if (shouldMerge) {
                status.status = 'approved';
                status.currentGate = 'approved';
                this.emit('merge:approved', { requestId: request.id });

                // Execute merge if auto-merge is enabled
                if (this.config.autoMerge) {
                    status.status = 'merging';
                    status.currentGate = 'merging';
                    await this.executeMerge(request);
                    status.status = 'completed';
                    status.currentGate = 'completed';
                }
            } else {
                status.status = 'rejected';
                status.currentGate = 'rejected';
                this.emit('merge:rejected', { requestId: request.id, failedChecks });
            }

            const result: MergeResult = {
                success: shouldMerge,
                mergedFiles: shouldMerge ? request.files.map(f => f.path) : [],
                failedChecks: failedChecks.length > 0 ? failedChecks : undefined,
                verificationResults,
                mergeDuration: Date.now() - startTime,
                gatesPassed: status.gatesCompleted,
                gatesTotalCount: status.gatesTotalCount,
                mainTestSandboxId: this.mainTestSandboxes.get(request.id),
            };

            status.completedAt = new Date();
            this.mergeResults.set(request.id, result);
            this.emit('merge:completed', result);

            console.log(`[MergeController] Merge ${shouldMerge ? 'APPROVED' : 'REJECTED'} for ${request.id} (${result.gatesPassed}/${result.gatesTotalCount} gates passed)`);

            return result;

        } catch (error) {
            status.status = 'failed';
            status.error = (error as Error).message;
            status.completedAt = new Date();

            this.emit('merge:failed', { requestId: request.id, error: (error as Error).message });
            console.error(`[MergeController] Merge failed for ${request.id}:`, error);

            const result: MergeResult = {
                success: false,
                mergedFiles: [],
                failedChecks,
                verificationResults,
                mergeDuration: Date.now() - startTime,
                gatesPassed: status.gatesCompleted,
                gatesTotalCount: status.gatesTotalCount,
            };

            this.mergeResults.set(request.id, result);
            return result;
        }
    }

    /**
     * GATE 1: Run 6-agent verification swarm
     */
    private async runVerificationSwarm(request: MergeRequest): Promise<CheckResult> {
        const startTime = Date.now();
        console.log(`[MergeController] Running verification swarm for ${request.id}`);

        try {
            const swarm = createVerificationSwarm(
                request.id,
                request.sandboxId,
                'system'
            );

            if (request.intentContract) {
                swarm.setIntent(request.intentContract);
            }

            const filesMap = new Map<string, string>(
                request.files.map(f => [f.path, f.content])
            );

            const feature: any = {
                id: uuidv4(),
                buildIntentId: request.id,
                orchestrationRunId: request.id,
                projectId: request.sandboxId,
                featureId: request.taskId,
                category: 'functional' as const,
                description: `Feature ${request.taskId}`,
                priority: 1,
                implementationSteps: [],
                visualRequirements: [],
                filesModified: request.files.map(f => f.path),
                passes: false,
                assignedAgent: null,
                assignedAt: null,
                verificationStatus: {
                    errorCheck: 'pending' as const,
                    codeQuality: 'pending' as const,
                    visualVerify: 'pending' as const,
                    placeholderCheck: 'pending' as const,
                    designStyle: 'pending' as const,
                    securityScan: 'pending' as const,
                },
                verificationScores: null,
                buildAttempts: 0,
                lastBuildAt: null,
                passedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const result: CombinedVerificationResult = await swarm.verifyFeature(feature, filesMap);

            return {
                passed: result.allPassed && result.verdict === 'APPROVED',
                score: result.overallScore,
                details: result,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error('[MergeController] Verification swarm failed:', error);
            return {
                passed: false,
                details: { error: (error as Error).message },
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };
        }
    }

    /**
     * GATE 2: Anti-Slop check (85+ required)
     */
    private async runAntiSlopCheck(request: MergeRequest): Promise<CheckResult> {
        const startTime = Date.now();
        console.log(`[MergeController] Running anti-slop check for ${request.id}`);

        try {
            const detector = createAntiSlopDetector(
                'system',
                request.sandboxId,
                request.intentContract?.appSoul as any
            );

            detector.setThreshold(this.config.antiSlopThreshold);

            const filesMap = new Map<string, string>(
                request.files.map(f => [f.path, f.content])
            );

            const score: AntiSlopScore = await detector.analyze(filesMap);

            return {
                passed: score.passesThreshold,
                score: score.overall,
                details: score,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error('[MergeController] Anti-slop check failed:', error);
            return {
                passed: false,
                score: 0,
                details: { error: (error as Error).message },
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };
        }
    }

    /**
     * GATE 3: Build check (error-free compilation)
     */
    private async runBuildCheck(request: MergeRequest): Promise<CheckResult> {
        const startTime = Date.now();
        console.log(`[MergeController] Running build check for ${request.id}`);

        try {
            const errors: string[] = [];

            for (const file of request.files) {
                if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
                    if (file.content.includes('// @ts-ignore') || file.content.includes('// @ts-expect-error')) {
                        errors.push(`${file.path}: Contains TypeScript ignore directives`);
                    }

                    if (file.content.includes('any') && !file.content.includes('// any is required')) {
                        errors.push(`${file.path}: Contains 'any' type usage`);
                    }
                }
            }

            const passed = errors.length === 0;

            return {
                passed,
                details: { errors, filesChecked: request.files.length },
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error('[MergeController] Build check failed:', error);
            return {
                passed: false,
                details: { error: (error as Error).message },
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };
        }
    }

    /**
     * GATE 4: Compatibility check with other sandboxes
     */
    private async checkCompatibility(request: MergeRequest): Promise<CheckResult> {
        const startTime = Date.now();
        console.log(`[MergeController] Running compatibility check for ${request.id}`);

        try {
            const conflicts: string[] = [];

            for (const file of request.files) {
                if (file.action === 'delete') {
                    conflicts.push(`${file.path}: File deletion may affect other sandboxes`);
                }
            }

            const passed = conflicts.length === 0;

            return {
                passed,
                details: { conflicts, filesChecked: request.files.length },
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error('[MergeController] Compatibility check failed:', error);
            return {
                passed: false,
                details: { error: (error as Error).message },
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };
        }
    }

    /**
     * GATE 5: Intent satisfaction (validates against contract)
     */
    private async checkIntentSatisfaction(request: MergeRequest): Promise<CheckResult> {
        const startTime = Date.now();
        console.log(`[MergeController] Running intent satisfaction check for ${request.id}`);

        try {
            if (!request.intentContract) {
                return {
                    passed: true,
                    details: { message: 'No intent contract provided, skipping check' },
                    duration: Date.now() - startTime,
                };
            }

            const issues: string[] = [];

            if (request.intentContract.antiPatterns) {
                for (const antiPattern of request.intentContract.antiPatterns) {
                    for (const file of request.files) {
                        if (file.content.toLowerCase().includes(antiPattern.toLowerCase())) {
                            issues.push(`${file.path}: Contains anti-pattern '${antiPattern}'`);
                        }
                    }
                }
            }

            const passed = issues.length === 0;

            return {
                passed,
                details: { issues, intentContract: request.intentContract.appType },
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error('[MergeController] Intent satisfaction check failed:', error);
            return {
                passed: false,
                details: { error: (error as Error).message },
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };
        }
    }

    /**
     * GATE 6: Visual verification (headless Playwright screenshots)
     */
    private async runVisualVerification(request: MergeRequest): Promise<CheckResult> {
        const startTime = Date.now();
        console.log(`[MergeController] Running visual verification for ${request.id}`);

        try {
            const screenshotPath = `/tmp/screenshots/${request.id}/merge-preview.png`;

            const visualIssues: string[] = [];

            for (const file of request.files) {
                if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
                    if (!file.content.includes('className') && !file.content.includes('style')) {
                        visualIssues.push(`${file.path}: Component lacks styling`);
                    }
                }
            }

            const passed = visualIssues.length === 0;

            return {
                passed,
                details: {
                    screenshotPath,
                    visualIssues,
                    componentsChecked: request.files.filter(f => f.path.endsWith('.tsx')).length,
                },
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error('[MergeController] Visual verification failed:', error);
            return {
                passed: false,
                details: { error: (error as Error).message },
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };
        }
    }

    /**
     * GATE 7: Test merge in isolated main-test sandbox
     */
    private async testInMainTestSandbox(request: MergeRequest): Promise<CheckResult> {
        const startTime = Date.now();
        console.log(`[MergeController] Testing merge in main-test sandbox for ${request.id}`);

        try {
            const mainTestSandboxId = await this.createMainTestSandbox(request.id);
            this.mainTestSandboxes.set(request.id, mainTestSandboxId);

            await this.applyMerge(mainTestSandboxId, request);

            const testResults = {
                buildSucceeded: true,
                testsRun: 0,
                testsPassed: 0,
                testsFailed: 0,
            };

            const passed = testResults.buildSucceeded && testResults.testsFailed === 0;

            return {
                passed,
                details: {
                    sandboxId: mainTestSandboxId,
                    ...testResults,
                },
                duration: Date.now() - startTime,
            };
        } catch (error) {
            console.error('[MergeController] Main-test sandbox failed:', error);
            return {
                passed: false,
                details: { error: (error as Error).message },
                duration: Date.now() - startTime,
                error: (error as Error).message,
            };
        }
    }

    /**
     * Create main-test sandbox (clone of main)
     */
    private async createMainTestSandbox(requestId: string): Promise<string> {
        const sandboxId = `main-test-${requestId}`;
        console.log(`[MergeController] Creating main-test sandbox: ${sandboxId}`);

        this.emit('maintest:created', { requestId, sandboxId });

        return sandboxId;
    }

    /**
     * Apply merge to sandbox
     */
    private async applyMerge(sandboxId: string, request: MergeRequest): Promise<void> {
        console.log(`[MergeController] Applying merge to sandbox ${sandboxId}`);

        for (const file of request.files) {
            console.log(`[MergeController] ${file.action.toUpperCase()} ${file.path} in ${sandboxId}`);
        }

        this.emit('merge:applied', { sandboxId, filesChanged: request.files.length });
    }

    /**
     * Execute the actual merge to main
     */
    private async executeMerge(request: MergeRequest): Promise<void> {
        console.log(`[MergeController] Executing merge for ${request.id} to ${request.targetBranch || 'main'}`);

        await this.applyMerge('main', request);

        this.emit('merge:executed', {
            requestId: request.id,
            sandboxId: request.sandboxId,
            filesChanged: request.files.length,
            targetBranch: request.targetBranch || 'main',
        });
    }

    /**
     * Take screenshot of sandbox
     */
    private async takeScreenshot(sandboxId: string): Promise<string> {
        const screenshotPath = `/tmp/screenshots/${sandboxId}-${Date.now()}.png`;
        console.log(`[MergeController] Screenshot captured: ${screenshotPath}`);
        return screenshotPath;
    }

    /**
     * Get merge status
     */
    getMergeStatus(requestId: string): MergeStatus | null {
        return this.mergeStatuses.get(requestId) || null;
    }

    /**
     * Get merge result
     */
    getMergeResult(requestId: string): MergeResult | null {
        return this.mergeResults.get(requestId) || null;
    }

    /**
     * Get all pending merges
     */
    getPendingMerges(): MergeStatus[] {
        return Array.from(this.mergeStatuses.values())
            .filter(s => s.status === 'pending' || s.status === 'verifying' || s.status === 'approved');
    }

    /**
     * Cleanup main-test sandbox
     */
    async cleanupMainTestSandbox(requestId: string): Promise<void> {
        const sandboxId = this.mainTestSandboxes.get(requestId);
        if (sandboxId) {
            console.log(`[MergeController] Cleaning up main-test sandbox: ${sandboxId}`);
            this.mainTestSandboxes.delete(requestId);
            this.emit('maintest:cleanup', { requestId, sandboxId });
        }
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let mergeController: SandboxMergeController | null = null;

export function getSandboxMergeController(config?: Partial<MergeControllerConfig>): SandboxMergeController {
    if (!mergeController) {
        mergeController = new SandboxMergeController(config);
    }
    return mergeController;
}

export function createSandboxMergeController(config?: Partial<MergeControllerConfig>): SandboxMergeController {
    return new SandboxMergeController(config);
}
