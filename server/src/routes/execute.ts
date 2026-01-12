/**
 * Unified Execution Router - Three-Mode Architecture
 *
 * Single entry point that routes to the appropriate mode handler:
 * - Builder Mode: Full autonomous build (6-phase loop)
 * - Developer Mode: Iterative code changes with live preview
 * - Agents Mode: Multi-agent parallel execution
 *
 * All modes share:
 * - ExecutionContext with common services
 * - WebSocket for real-time updates
 * - KripToeNite for AI routing
 * - Verification Swarm for quality
 * - Error Escalation for recovery
 */

import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    createExecutionContext,
    getOrCreateContext,
    getContext,
    shutdownAllContexts,
    type ExecutionMode,
    type ExecutionContext,
} from '../services/core/index.js';
import { BuildLoopOrchestrator } from '../services/automation/build-loop.js';
import { AgentOrchestrator } from '../services/agents/orchestrator.js';
import { getDeveloperModeOrchestrator } from '../services/developer-mode/orchestrator.js';
import { getKripToeNite } from '../services/ai/krip-toe-nite/index.js';
// Enhanced Build Loop with Cursor 2.1+ features
import {
    EnhancedBuildLoopOrchestrator,
    createEnhancedBuildLoop,
    type EnhancedBuildConfig,
} from '../services/automation/enhanced-build-loop.js';
import { Complexity } from '../services/ai/krip-toe-nite/types.js';
// Rich Context Integration
import {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    type UnifiedContext,
} from '../services/ai/unified-context.js';
import {
    getPredictiveErrorPrevention,
    type PredictionResult,
} from '../services/ai/predictive-error-prevention.js';
// Advanced Orchestration Integration
import {
    createAdvancedOrchestration,
    shutdownOrchestration,
    type AdvancedOrchestrationService,
} from '../services/integration/advanced-orchestration.js';
// P1-2: Notification Service for credential requests and build status
import { getNotificationService } from '../services/notifications/notification-service.js';
// Deep Intent Lock System
import {
    createIntentLockEngine,
    createAndLockDeepIntent,
    enrichDeepIntentWithPlan,
    checkDeepIntentSatisfaction,
    type DeepIntentContract,
    type DeepIntentOptions,
    type DeepIntentSatisfactionResult,
    type ApprovedBuildPlan,
} from '../services/ai/intent-lock.js';
// Error Escalation for Deep Intent fixes
import {
    createErrorEscalationEngine,
    type BuildError,
    type EscalationResult,
} from '../services/automation/error-escalation.js';
// Credential-to-Environment Bridge for writing credentials to .env
import {
    writeCredentialsToProjectEnv,
    type WriteCredentialsToEnvResult,
} from '../services/credentials/credential-env-bridge.js';
import { db } from '../db.js';
import { files } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// Track active advanced orchestration instances
const activeOrchestrations = new Map<string, AdvancedOrchestrationService>();

// =============================================================================
// TYPES
// =============================================================================

interface ExecuteRequest {
    mode: ExecutionMode;
    projectId?: string;
    userId: string;
    prompt: string;
    sessionId?: string;
    framework?: string;
    language?: string;
    projectPath?: string;
    options?: {
        forceModel?: string;
        forceStrategy?: string;
        enableVisualVerification?: boolean;
        enableCheckpoints?: boolean;
        // SESSION 5: Human In The Loop toggle
        // When true, enables human checkpoints at key decision points
        // When false (default), runs fully autonomous
        humanInTheLoop?: boolean;
    };
}

interface ExecuteResponse {
    success: boolean;
    sessionId: string;
    projectId: string;
    mode: ExecutionMode;
    websocketChannel: string;
    initialAnalysis?: {
        taskType: string;
        complexity: string;
        strategy: string;
        estimatedCost: number;
    };
    error?: string;
}

// =============================================================================
// EXECUTE ENDPOINT
// =============================================================================

/**
 * POST /api/execute
 *
 * Unified execution endpoint that routes to the appropriate mode handler.
 * Returns immediately with a session ID; actual execution happens via WebSocket.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as ExecuteRequest;
        const {
            mode,
            userId,
            prompt,
            sessionId = uuidv4(),
            framework = 'react',
            language = 'typescript',
            projectPath,
            options = {},
        } = body;

        // Validate required fields
        if (!mode || !['builder', 'developer', 'agents'].includes(mode)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid mode. Must be "builder", "developer", or "agents".',
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'prompt is required',
            });
        }

        // Generate or use provided project ID
        const projectId = body.projectId || `project-${uuidv4().slice(0, 8)}`;

        console.log(`[Execute] Starting ${mode} mode for project ${projectId}`);

        // Analyze prompt with KripToeNite to get routing decision
        const ktn = getKripToeNite();
        const analysis = ktn.analyzePrompt(prompt, { projectId, userId, framework, language });

        // Create or get execution context
        const context = getOrCreateContext({
            mode,
            projectId,
            userId,
            sessionId,
            framework,
            language,
            projectPath,
            enableVisualVerification: options.enableVisualVerification ?? true,
            enableCheckpoints: options.enableCheckpoints ?? true,
        });

        // Load unified context for rich code generation
        let enrichedPrompt = prompt;
        let unifiedContext: UnifiedContext | null = null;
        let errorPrediction: PredictionResult | null = null;

        try {
            // Load project context (intent lock, learned patterns, error history, etc.)
            const contextProjectPath = projectPath || `/tmp/builds/${projectId}`;
            unifiedContext = await loadUnifiedContext(projectId, userId, contextProjectPath, {
                includeIntentLock: true,
                includeVerificationResults: true,
                includeLearningData: true,
                includeErrorHistory: true,
                includeProjectAnalysis: true,
                includeUserPreferences: true,
            });

            // Get predictive error prevention analysis
            const errorPrevention = getPredictiveErrorPrevention();
            errorPrediction = await errorPrevention.predict({
                projectId,
                taskType: mode === 'builder' ? 'full_build' : 'code_generation',
                taskDescription: prompt.slice(0, 500),
                recentErrors: [],
            });

            // Enrich prompt with unified context
            const contextBlock = formatUnifiedContextForCodeGen(unifiedContext);
            const preventionGuidance = errorPrediction.predictions.length > 0
                ? `\n\n## PREDICTED ISSUES TO PREVENT:\n${errorPrediction.predictions.map(p =>
                    `- [${p.type.toUpperCase()}] ${p.description} (${Math.round(p.confidence * 100)}% likely)\n  Prevention: ${p.prevention.instruction}`
                  ).join('\n')}`
                : '';

            enrichedPrompt = `${contextBlock}${preventionGuidance}\n\n## USER REQUEST:\n${prompt}`;

            console.log(`[Execute] Loaded context: ${unifiedContext.intentLock ? 'Intent Lock' : 'No Intent'}, ${unifiedContext.learnedPatterns?.length || 0} patterns, ${errorPrediction.predictions.length} predicted issues`);
        } catch (contextError) {
            // Context loading is non-blocking - continue with original prompt
            console.warn('[Execute] Context loading failed, proceeding with basic prompt:', contextError);
        }

        // Broadcast execution start
        context.broadcast('execution-started', {
            mode,
            projectId,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            analysis: {
                taskType: analysis.analysis.taskType,
                complexity: analysis.analysis.complexity,
                strategy: analysis.decision.strategy,
            },
        });

        // Initialize advanced orchestration for continuous verification, interrupts, etc.
        const advancedOrch = createAdvancedOrchestration({
            projectId,
            userId,
            sessionId,
            enableInterrupts: true,
            enableContinuousVerification: mode === 'builder', // Only for full builds
            enableVideoStreaming: options.enableVisualVerification ?? false,
            enableShadowPatterns: true,
        });

        activeOrchestrations.set(sessionId, advancedOrch);

        // Forward advanced orchestration events to WebSocket
        advancedOrch.on('interrupt', (data) => {
            context.broadcast('interrupt-applied', data);
        });
        advancedOrch.on('verification_result', (data) => {
            context.broadcast('continuous-verification', data);
        });
        advancedOrch.on('verification_issue', (data) => {
            context.broadcast('verification-issue', data);
        });
        advancedOrch.on('video_analysis', (data) => {
            context.broadcast('video-analysis', data);
        });

        // Check if Modal is enabled for long-running builds (24h+)
        const useModal = process.env.MODAL_ENABLED === 'true' &&
                        process.env.MODAL_TOKEN_ID &&
                        process.env.MODAL_TOKEN_SECRET &&
                        mode === 'builder'; // Only use Modal for full builds

        if (useModal) {
            // Trigger Modal orchestration for long-running build
            console.log(`[Execute] Using Modal for long-running build ${sessionId}`);

            setImmediate(async () => {
                try {
                    // Trigger Modal via the orchestrate API
                    const modalResult = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3100'}/api/orchestrate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'start',
                            projectId,
                            userId,
                            intentContractId: (options as any)?.deepIntentContractId,
                            implementationPlan: (options as any)?.approvedPlan || { phases: [] },
                            credentials: (options as any)?.credentials || {},
                            config: {
                                maxParallelSandboxes: 5,
                                taskPartitionStrategy: 'by-phase',
                                tournamentMode: false,
                                budgetLimitUsd: 100,
                                timeoutHours: 24,
                                respawnOnFailure: true,
                            },
                        }),
                    }).then(res => res.json());

                    if (modalResult.success) {
                        context.broadcast('modal-started', {
                            buildId: modalResult.buildId,
                            modalFunctionId: modalResult.modalFunctionId,
                            message: 'Build started on Modal. This can run for 24+ hours.',
                        });
                    } else {
                        throw new Error(modalResult.error || 'Failed to start Modal orchestration');
                    }
                } catch (error) {
                    console.error('[Execute] Modal trigger failed, falling back to local:', error);
                    context.broadcast('modal-fallback', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        message: 'Falling back to local execution',
                    });

                    // Fall back to local execution
                    await executeBuilderMode(context, enrichedPrompt, options, advancedOrch);
                } finally {
                    advancedOrch.shutdown();
                    activeOrchestrations.delete(sessionId);
                }
            });
        } else {
            // Original local execution path
            setImmediate(async () => {
                try {
                    // Initialize advanced orchestration with the prompt
                    await advancedOrch.initialize(prompt);

                    // Get shadow pattern hints for enhanced routing
                    const routingHints = advancedOrch.getRoutingHints();
                    if (routingHints.successfulApproaches.length > 0) {
                        context.broadcast('routing-hints', routingHints);
                    }

                    switch (mode) {
                        case 'builder':
                            await executeBuilderMode(context, enrichedPrompt, options, advancedOrch);
                            break;
                        case 'developer':
                            await executeDeveloperMode(context, enrichedPrompt, options, advancedOrch);
                            break;
                        case 'agents':
                            await executeAgentsMode(context, enrichedPrompt, options, advancedOrch);
                            break;
                    }
                } catch (error) {
                    console.error(`[Execute] ${mode} mode failed:`, error);
                    context.broadcast('execution-error', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                } finally {
                    // Cleanup advanced orchestration
                    advancedOrch.shutdown();
                    activeOrchestrations.delete(sessionId);
                }
            });
        }

        // Return immediately with session info
        const response: ExecuteResponse = {
            success: true,
            sessionId,
            projectId,
            mode,
            websocketChannel: `/ws/context?contextId=${projectId}&userId=${userId}`,
            initialAnalysis: {
                taskType: analysis.analysis.taskType,
                complexity: String(analysis.analysis.complexity),
                strategy: analysis.decision.strategy,
                estimatedCost: analysis.estimatedCost,
            },
        };

        res.json(response);

    } catch (error) {
        console.error('[Execute] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// =============================================================================
// DEEP INTENT SATISFACTION VERIFICATION
// =============================================================================

/**
 * Maximum escalation attempts for Deep Intent satisfaction
 */
const MAX_DEEP_INTENT_ESCALATION_ROUNDS = 3;

/**
 * Check Deep Intent satisfaction and attempt fixes if needed.
 * This is the critical "are we DONE?" gate that prevents premature completion.
 *
 * @returns true if satisfied, false if not satisfied after all escalation attempts
 */
async function checkAndFixDeepIntentSatisfaction(
    projectId: string,
    userId: string,
    deepIntentContractId: string,
    context: ExecutionContext,
    orchestrationRunId: string
): Promise<boolean> {
    console.log(`[DeepIntent] Checking satisfaction for contract ${deepIntentContractId}`);

    context.broadcast('deep-intent-check-started', {
        deepIntentContractId,
        message: 'Verifying all requirements are satisfied...',
    });

    let escalationRound = 0;

    while (escalationRound < MAX_DEEP_INTENT_ESCALATION_ROUNDS) {
        escalationRound++;

        // Check Deep Intent satisfaction
        const satisfactionResult = await checkDeepIntentSatisfaction(
            deepIntentContractId,
            userId,
            projectId
        );

        context.broadcast('deep-intent-progress', {
            round: escalationRound,
            satisfied: satisfactionResult.satisfied,
            overallProgress: satisfactionResult.overallProgress,
            progress: satisfactionResult.progress,
            blockers: satisfactionResult.blockers.slice(0, 5), // Send top 5 blockers
            totalBlockers: satisfactionResult.blockers.length,
        });

        console.log(`[DeepIntent] Round ${escalationRound}: ${satisfactionResult.satisfied ? 'SATISFIED' : 'NOT SATISFIED'} (${satisfactionResult.overallProgress}% complete, ${satisfactionResult.blockers.length} blockers)`);

        // If satisfied, we're done!
        if (satisfactionResult.satisfied) {
            context.broadcast('deep-intent-satisfied', {
                overallProgress: satisfactionResult.overallProgress,
                progress: satisfactionResult.progress,
                message: `All requirements satisfied! Build is complete.`,
            });
            return true;
        }

        // Not satisfied - attempt to fix blockers via escalation
        context.broadcast('deep-intent-fixing', {
            round: escalationRound,
            maxRounds: MAX_DEEP_INTENT_ESCALATION_ROUNDS,
            blockers: satisfactionResult.blockers.slice(0, 10).map(b => b.reason),
            message: `${satisfactionResult.blockers.length} requirements not met. Attempting fixes...`,
        });

        // Convert blockers to BuildErrors for escalation system
        const errors: BuildError[] = satisfactionResult.blockers.slice(0, 10).map(blocker => ({
            id: uuidv4(),
            featureId: orchestrationRunId,
            category: 'integration_issues' as const,
            message: blocker.reason,
            file: undefined,
            line: undefined,
            context: {
                severity: 'critical' as const,
                deepIntent: true,
                category: blocker.category,
                item: blocker.item,
                suggestedFix: blocker.suggestedFix,
            },
            timestamp: new Date(),
        }));

        // Get current file state
        const fileRows = await db.select().from(files).where(eq(files.projectId, projectId));
        const fileMap = new Map<string, string>();
        for (const row of fileRows) {
            fileMap.set(row.path, row.content);
        }

        // Create escalation engine
        const escalationEngine = createErrorEscalationEngine(
            orchestrationRunId,
            projectId,
            userId
        );

        // Attempt to fix each blocker
        let allFixed = true;
        const updatedFiles = new Map(fileMap);

        for (const error of errors) {
            context.broadcast('deep-intent-escalating', {
                error: error.message.slice(0, 100),
                category: error.context?.category,
            });

            const escalationResult = await escalationEngine.fixError(
                error,
                updatedFiles,
                {
                    featureId: orchestrationRunId,
                    description: `Fix Deep Intent requirement: ${error.message}`,
                    category: 'feature',
                    priority: 'high',
                    implementationSteps: [error.context?.suggestedFix || 'Fix the requirement'],
                    visualRequirements: [],
                } as any
            );

            if (escalationResult.success && escalationResult.fix) {
                // Apply changes
                for (const change of escalationResult.fix.changes) {
                    if (change.action === 'delete') {
                        updatedFiles.delete(change.path);
                    } else if (change.newContent) {
                        updatedFiles.set(change.path, change.newContent);
                    }
                }

                context.broadcast('deep-intent-fix-applied', {
                    level: escalationResult.level,
                    strategy: escalationResult.fix.strategy,
                    message: `Fixed at Level ${escalationResult.level}`,
                });
            } else {
                allFixed = false;
                context.broadcast('deep-intent-fix-failed', {
                    error: error.message.slice(0, 100),
                    level: escalationResult.level,
                });
            }
        }

        // Apply file changes to database
        if (updatedFiles.size > fileMap.size || Array.from(updatedFiles.entries()).some(([path, content]) => fileMap.get(path) !== content)) {
            for (const [path, content] of updatedFiles) {
                const existing = fileRows.find(f => f.path === path);
                if (existing) {
                    await db.update(files)
                        .set({ content, updatedAt: new Date().toISOString() })
                        .where(eq(files.id, existing.id));
                } else {
                    // Infer language from extension
                    const ext = path.split('.').pop() || '';
                    const langMap: Record<string, string> = {
                        ts: 'typescript', tsx: 'typescript',
                        js: 'javascript', jsx: 'javascript',
                        css: 'css', json: 'json',
                    };

                    await db.insert(files).values({
                        projectId,
                        path,
                        content,
                        language: langMap[ext] || 'text',
                        version: 1,
                    });
                }
            }

            context.broadcast('deep-intent-files-updated', {
                filesUpdated: updatedFiles.size,
                round: escalationRound,
            });
        }

        // If fixes were applied, loop to re-check
        if (allFixed) {
            context.broadcast('deep-intent-fixes-complete', {
                round: escalationRound,
                message: 'Fixes applied. Re-checking satisfaction...',
            });
            continue;
        }

        // If this was the last round and we couldn't fix everything
        if (escalationRound >= MAX_DEEP_INTENT_ESCALATION_ROUNDS) {
            context.broadcast('deep-intent-not-satisfied', {
                overallProgress: satisfactionResult.overallProgress,
                progress: satisfactionResult.progress,
                blockers: satisfactionResult.blockers.slice(0, 10),
                totalBlockers: satisfactionResult.blockers.length,
                message: `Build incomplete: ${satisfactionResult.blockers.length} requirements not met after ${escalationRound} attempts.`,
            });
            return false;
        }
    }

    return false;
}

// =============================================================================
// ENHANCED BUILD LOOP EVENT FORWARDING
// =============================================================================

/**
 * Set up event forwarding from Enhanced Build Loop to ExecutionContext
 * This streams all Cursor 2.1+ feature events to the frontend via WebSocket
 */
function setupEnhancedBuildLoopEvents(
    context: ExecutionContext,
    loop: EnhancedBuildLoopOrchestrator
): void {
    // =============================================================================
    // 1. STREAMING FEEDBACK CHANNEL
    // =============================================================================
    loop.on('agent:feedback', (data) => {
        context.broadcast('builder-feedback', {
            type: 'feedback',
            message: data.item?.message || 'Feedback received',
            severity: data.item?.severity || 'info',
            agentId: data.agentId,
            agentName: data.agentName,
            timestamp: Date.now(),
            metadata: data,
        });
    });

    loop.on('agent:self-corrected', (data) => {
        context.broadcast('builder-self-correction', {
            type: 'self-correction',
            message: `Agent self-corrected (total: ${data.totalCorrections})`,
            agentId: data.agentId,
            totalCorrections: data.totalCorrections,
            timestamp: Date.now(),
        });
    });

    // =============================================================================
    // 2. ERROR PATTERN LIBRARY (Level 0)
    // =============================================================================
    loop.on('error:pattern-fixed', (data) => {
        context.broadcast('builder-pattern-fixed', {
            type: 'pattern-fix',
            message: `Error pattern matched and fixed: ${data.patternName}`,
            patternId: data.patternId,
            patternName: data.patternName,
            filesModified: data.filesModified,
            timestamp: Date.now(),
        });
    });

    // =============================================================================
    // 3. HUMAN VERIFICATION CHECKPOINTS
    // =============================================================================
    loop.on('checkpoint:waiting', (data) => {
        context.broadcast('builder-checkpoint-waiting', {
            type: 'checkpoint',
            status: 'waiting',
            trigger: data.trigger,
            description: data.description,
            message: `Waiting for human verification: ${data.description}`,
            timestamp: Date.now(),
        });
    });

    loop.on('checkpoint:responded', (data) => {
        context.broadcast('builder-checkpoint-response', {
            type: 'checkpoint',
            status: 'responded',
            action: data.response?.action,
            note: data.response?.note,
            message: `Human checkpoint response: ${data.response?.action}`,
            timestamp: Date.now(),
        });
    });

    // =============================================================================
    // 4. BROWSER-IN-THE-LOOP (Visual Verification)
    // =============================================================================
    loop.on('visual:check-complete', (data) => {
        context.broadcast('builder-visual-check', {
            type: 'visual-verification',
            status: 'complete',
            score: data.score,
            passed: data.passed,
            issues: data.issues,
            message: `Visual check complete. Score: ${data.score}`,
            timestamp: Date.now(),
            metadata: data,
        });
    });

    loop.on('visual:check-failed', (data) => {
        context.broadcast('builder-visual-check', {
            type: 'visual-verification',
            status: 'failed',
            error: data.error,
            message: `Visual check failed: ${data.error}`,
            timestamp: Date.now(),
        });
    });

    // =============================================================================
    // 5. MULTI-AGENT JUDGING
    // =============================================================================
    loop.on('judgment:complete', (data) => {
        context.broadcast('builder-judgment', {
            type: 'multi-agent-judgment',
            winnerId: data.winnerId,
            winnerName: data.winnerName,
            confidence: data.confidence,
            message: `Multi-agent judgment: Winner ${data.winnerName} (confidence: ${(data.confidence * 100).toFixed(1)}%)`,
            timestamp: Date.now(),
            metadata: data,
        });
    });

    // =============================================================================
    // 6. CONTINUOUS VERIFICATION
    // =============================================================================
    loop.on('verification:check-complete', (data) => {
        context.broadcast('builder-continuous-verification', {
            type: 'continuous-verification',
            checkType: data.type,
            passed: data.result?.passed,
            issues: data.result?.issues,
            message: `Verification check (${data.type}): ${data.result?.passed ? 'Passed' : 'Failed'}`,
            timestamp: Date.now(),
            metadata: data,
        });
    });

    // =============================================================================
    // 7. CRITICAL FEEDBACK (High Priority)
    // =============================================================================
    loop.on('feedback:critical', (data) => {
        context.broadcast('builder-critical-feedback', {
            type: 'critical-feedback',
            severity: 'critical',
            message: `CRITICAL: ${data.message}`,
            timestamp: Date.now(),
            metadata: data,
        });
    });

    // =============================================================================
    // AGENT REGISTRATION & STATUS
    // =============================================================================
    loop.on('agent:registered', (data) => {
        context.broadcast('builder-agent-registered', {
            type: 'agent-registered',
            agentId: data.agentId,
            agentName: data.agentName,
            task: data.task,
            message: `Agent registered: ${data.agentName}`,
            timestamp: Date.now(),
        });
    });

    // =============================================================================
    // BUILD LOOP LIFECYCLE
    // =============================================================================
    loop.on('started', (data) => {
        context.broadcast('builder-enhanced-loop-started', {
            type: 'enhanced-loop-lifecycle',
            status: 'started',
            buildId: data.buildId,
            message: 'Enhanced Build Loop started',
            timestamp: Date.now(),
        });
    });

    loop.on('stopped', (data) => {
        context.broadcast('builder-enhanced-loop-stopped', {
            type: 'enhanced-loop-lifecycle',
            status: 'stopped',
            buildId: data.buildId,
            message: 'Enhanced Build Loop stopped',
            timestamp: Date.now(),
        });
    });

    console.log('[Execute:Builder] Enhanced Build Loop event forwarding configured');
}

// =============================================================================
// MODE-SPECIFIC EXECUTION
// =============================================================================

/**
 * Execute Builder Mode - Full autonomous build
 */
async function executeBuilderMode(
    context: ExecutionContext,
    prompt: string,
    options: ExecuteRequest['options'] = {},
    advancedOrch?: AdvancedOrchestrationService
): Promise<void> {
    console.log(`[Execute:Builder] Starting 6-phase build loop with Enhanced Build Loop`);

    context.broadcast('builder-started', {
        phases: ['intent_lock', 'initialization', 'parallel_build', 'integration_check', 'functional_test', 'intent_satisfaction', 'browser_demo'],
        advancedFeatures: {
            interrupts: !!advancedOrch,
            continuousVerification: !!advancedOrch,
            shadowPatterns: !!advancedOrch,
        },
        cursor21Features: {
            streamingFeedback: true,
            continuousVerification: true,
            runtimeDebug: true,
            browserInLoop: true,
            humanCheckpoints: true,
            multiAgentJudging: true,
            patternLibrary: true,
        },
    });

    try {
        // =============================================================================
        // INITIALIZE ENHANCED BUILD LOOP (Cursor 2.1+ Features)
        // =============================================================================
        const buildId = context.sessionId;
        const projectPath = context.projectPath || `/tmp/builds/${context.projectId}`;
        const previewUrl = `http://localhost:3100`; // Will be updated by sandbox

        context.broadcast('builder-status', {
            phase: 'init',
            message: 'Initializing Enhanced Build Loop with Cursor 2.1+ features...',
            features: [
                'Streaming Feedback Channel',
                'Continuous Verification',
                'Runtime Debug Context',
                'Browser-in-the-Loop',
                'Human Verification Checkpoints',
                'Multi-Agent Judging',
                'Error Pattern Library',
            ],
        });

        const enhancedBuildLoop = createEnhancedBuildLoop({
            buildId,
            projectId: context.projectId,
            userId: context.userId,
            projectPath,
            previewUrl,
            // Enable all Cursor 2.1+ features
            enableStreamingFeedback: true,
            enableContinuousVerification: true,
            enableRuntimeDebug: true,
            enableBrowserInLoop: options?.enableVisualVerification ?? true,
            enableHumanCheckpoints: options?.enableCheckpoints ?? true,
            enableMultiAgentJudging: true,
            enablePatternLibrary: true,
            visualQualityThreshold: 85,
            humanCheckpointEscalationLevel: 2,
        });

        // =============================================================================
        // SET UP ENHANCED BUILD LOOP EVENT FORWARDING
        // =============================================================================
        setupEnhancedBuildLoopEvents(context, enhancedBuildLoop);

        // =============================================================================
        // START THE ENHANCED BUILD LOOP
        // =============================================================================
        try {
            await enhancedBuildLoop.start();

            context.broadcast('builder-status', {
                phase: 'enhanced-loop-started',
                message: 'Enhanced Build Loop started. All Cursor 2.1+ features active.',
            });
        } catch (enhancedLoopError) {
            console.warn('[Execute:Builder] Enhanced Build Loop failed to start (non-blocking):', enhancedLoopError);
            // Non-blocking - build can continue without enhanced features
        }

        // =============================================================================
        // CREATE BUILD LOOP ORCHESTRATOR (6-Phase Build)
        // =============================================================================
        // 'production' mode enables all advanced features:
        // - LATTICE parallel cell building
        // - Browser-in-loop visual verification
        // - Learning Engine pattern injection
        // - Verification Swarm (6-agent verification)
        // - Full parallelism with 6 max agents
        //
        // SESSION 5: Human In The Loop toggle
        // - humanInTheLoop: false (default) = Fully autonomous builds
        // - humanInTheLoop: true = Pause at key decision points for user approval
        const buildLoop = new BuildLoopOrchestrator(
            context.projectId,
            context.userId,
            context.orchestrationRunId,
            'production', // Use full production mode - enables LATTICE, BrowserInLoop, Learning, VerificationSwarm
            {
                humanInTheLoop: options?.humanInTheLoop ?? false,
                projectPath: context.projectPath,
            }
        );

        // Forward build loop events to context
        buildLoop.on('event', (event) => {
            context.broadcast(`builder-${event.type}`, event.data);

            // SESSION 4: Also broadcast live preview events without prefix for direct handling
            const livePreviewEvents = [
                'sandbox-ready',
                'file-modified',
                'visual-verification',
                'agent-progress',
                'build-error'
            ];
            if (livePreviewEvents.includes(event.type)) {
                context.broadcast(event.type, event.data);
            }

            // Update advanced orchestration context on phase changes
            if (advancedOrch && event.type === 'phase_change') {
                advancedOrch.updateContext(event.data.phase);
            }

            // Update files for continuous verification
            if (advancedOrch && event.type === 'file_update') {
                const files = new Map<string, string>();
                if (event.data.files) {
                    for (const [path, content] of Object.entries(event.data.files)) {
                        files.set(path, content as string);
                    }
                    advancedOrch.updateFiles(files);
                }
            }
        });

        // Check for interrupts periodically during build
        if (advancedOrch) {
            buildLoop.on('tool_boundary', async () => {
                const interruptResult = await advancedOrch.checkInterrupts();
                if (interruptResult.shouldHalt) {
                    buildLoop.pause();
                    context.broadcast('builder-halted', {
                        reason: interruptResult.interrupt?.message,
                    });
                } else if (interruptResult.contextToInject) {
                    context.broadcast('context-injected', {
                        context: interruptResult.contextToInject,
                    });
                }
            });
        }

        // Enhance prompt with shadow patterns if available
        const enhancedPrompt = advancedOrch ? advancedOrch.buildEnhancedPrompt(prompt) : prompt;

        // Start the build with enhanced prompt
        await buildLoop.start(enhancedPrompt);

        // Get build state
        const buildState = buildLoop.getState();

        context.broadcast('builder-build-complete', {
            status: buildState.status,
            message: 'Build loop finished. Verifying Deep Intent satisfaction...',
        });

        // CRITICAL: Check Deep Intent satisfaction before claiming completion
        // This is the "are we DONE?" gate that prevents premature victory
        if (buildState.status === 'complete') {
            // Check if we have a Deep Intent contract ID
            const deepIntentContractId = (options as any)?.deepIntentContractId;

            if (deepIntentContractId) {
                console.log(`[Execute:Builder] Checking Deep Intent satisfaction for contract ${deepIntentContractId}`);

                try {
                    const satisfied = await checkAndFixDeepIntentSatisfaction(
                        context.projectId,
                        context.userId,
                        deepIntentContractId,
                        context,
                        context.orchestrationRunId
                    );

                    if (satisfied) {
                        context.broadcast('builder-completed', {
                            status: 'complete',
                            deepIntentSatisfied: true,
                            message: 'Build complete! All requirements verified.',
                        });
                    } else {
                        context.broadcast('builder-completed', {
                            status: 'incomplete',
                            deepIntentSatisfied: false,
                            message: 'Build finished but not all requirements are met.',
                        });
                    }
                } catch (deepIntentError) {
                    console.error('[Execute:Builder] Deep Intent check failed:', deepIntentError);
                    context.broadcast('builder-completed', {
                        status: 'error',
                        deepIntentError: deepIntentError instanceof Error ? deepIntentError.message : 'Unknown error',
                        message: 'Build complete but Deep Intent verification failed.',
                    });
                }
            } else {
                // No Deep Intent contract - just complete normally
                console.log('[Execute:Builder] No Deep Intent contract for this build');
                context.broadcast('builder-completed', {
                    status: buildState.status,
                    message: 'Build complete (no Deep Intent verification).',
                });
            }
        } else {
            // Build failed
            context.broadcast('builder-completed', {
                status: buildState.status,
                message: `Build ${buildState.status}.`,
            });
        }

        // =============================================================================
        // CLEANUP ENHANCED BUILD LOOP
        // =============================================================================
        try {
            await enhancedBuildLoop.stop();
            console.log('[Execute:Builder] Enhanced Build Loop stopped');
        } catch (cleanupError) {
            console.warn('[Execute:Builder] Error stopping Enhanced Build Loop:', cleanupError);
        }

    } catch (error) {
        // Use error escalation
        const escalationResult = await context.escalation.fixError(
            {
                id: uuidv4(),
                featureId: 'builder-main',
                category: 'runtime_error',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
            },
            new Map()
        );

        if (!escalationResult.success) {
            throw error;
        }

        context.broadcast('builder-error-recovered', {
            level: escalationResult.level,
        });
    }
}

/**
 * Execute Developer Mode - Iterative code changes
 */
async function executeDeveloperMode(
    context: ExecutionContext,
    prompt: string,
    options: ExecuteRequest['options'] = {},
    advancedOrch?: AdvancedOrchestrationService
): Promise<void> {
    console.log(`[Execute:Developer] Starting iterative development`);

    context.broadcast('developer-started', {
        advancedFeatures: {
            interrupts: !!advancedOrch,
            shadowPatterns: !!advancedOrch,
        },
    });

    try {
        // Check for pre-existing interrupts
        if (advancedOrch) {
            const interruptResult = await advancedOrch.checkInterrupts();
            if (interruptResult.shouldHalt) {
                context.broadcast('developer-halted', {
                    reason: interruptResult.interrupt?.message,
                });
                return;
            }
        }

        // Enhance prompt with shadow patterns if available
        let enhancedPrompt = prompt;
        if (advancedOrch) {
            enhancedPrompt = advancedOrch.buildEnhancedPrompt(prompt);
        }

        // Use KTN for code generation
        const result = await context.ktn.buildFeature(enhancedPrompt, {
            projectId: context.projectId,
            userId: context.userId,
            framework: context.framework,
            language: context.language,
        });

        context.broadcast('developer-generated', {
            model: result.model,
            strategy: result.strategy,
            latencyMs: result.latencyMs,
            content: result.content,
        });

        // Update files for verification if available
        if (advancedOrch && result.content) {
            const files = new Map<string, string>();
            // Parse generated content for files (assumes code blocks with file paths)
            const fileMatches = result.content.matchAll(/```(?:typescript|tsx|jsx|javascript|ts|js)\s*\n\/\/\s*(.+?)\n([\s\S]*?)```/g);
            for (const match of fileMatches) {
                const filePath = match[1].trim();
                const fileContent = match[2];
                files.set(filePath, fileContent);
            }
            if (files.size > 0) {
                advancedOrch.updateFiles(files);
            }
        }

        // Run quick verification
        context.broadcast('developer-verifying', {});

        // Check for mid-generation interrupts
        if (advancedOrch) {
            const postGenInterrupt = await advancedOrch.checkInterrupts();
            if (postGenInterrupt.contextToInject) {
                context.broadcast('context-injected', {
                    context: postGenInterrupt.contextToInject,
                });
            }
        }

        context.broadcast('developer-completed', {
            tokensUsed: result.usage.totalTokens,
            cost: result.usage.estimatedCost,
        });

    } catch (error) {
        context.broadcast('developer-error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Execute Agents Mode - Multi-agent parallel execution
 */
async function executeAgentsMode(
    context: ExecutionContext,
    prompt: string,
    options: ExecuteRequest['options'] = {},
    advancedOrch?: AdvancedOrchestrationService
): Promise<void> {
    console.log(`[Execute:Agents] Starting multi-agent orchestration`);

    context.broadcast('agents-started', {
        hierarchy: ['queens', 'workers'],
        advancedFeatures: {
            interrupts: !!advancedOrch,
            continuousVerification: !!advancedOrch,
            shadowPatterns: !!advancedOrch,
        },
    });

    try {
        // Check for pre-existing interrupts
        if (advancedOrch) {
            const interruptResult = await advancedOrch.checkInterrupts();
            if (interruptResult.shouldHalt) {
                context.broadcast('agents-halted', {
                    reason: interruptResult.interrupt?.message,
                });
                return;
            }
        }

        // Enhance prompt with shadow patterns if available
        let enhancedPrompt = prompt;
        if (advancedOrch) {
            enhancedPrompt = advancedOrch.buildEnhancedPrompt(prompt);
        }

        // The AgentOrchestrator is designed for context store usage
        // We'll use it indirectly through the context
        const orchestrator = new AgentOrchestrator();

        // Start orchestration via context
        // For now, use KTN for the prompt analysis
        const analysisResult = await context.ktn.plan(enhancedPrompt, {
            projectId: context.projectId,
            userId: context.userId,
            framework: context.framework,
            language: context.language,
        });

        context.broadcast('agents-plan-created', {
            model: analysisResult.model,
            strategy: analysisResult.strategy,
            content: analysisResult.content.substring(0, 500),
        });

        // Check for interrupts between planning and execution
        if (advancedOrch) {
            const midInterrupt = await advancedOrch.checkInterrupts();
            if (midInterrupt.shouldHalt) {
                context.broadcast('agents-halted', {
                    reason: midInterrupt.interrupt?.message,
                    phase: 'post-planning',
                });
                return;
            }
            if (midInterrupt.contextToInject) {
                context.broadcast('context-injected', {
                    context: midInterrupt.contextToInject,
                    phase: 'post-planning',
                });
            }
        }

        // Execute the plan using KTN's buildFeature for each identified task
        const codeResult = await context.ktn.buildFeature(
            `Based on this plan:\n\n${analysisResult.content}\n\nGenerate the code for the first feature.`,
            {
                projectId: context.projectId,
                userId: context.userId,
                framework: context.framework,
                language: context.language,
            }
        );

        // Update files for continuous verification
        if (advancedOrch && codeResult.content) {
            const files = new Map<string, string>();
            const fileMatches = codeResult.content.matchAll(/```(?:typescript|tsx|jsx|javascript|ts|js)\s*\n\/\/\s*(.+?)\n([\s\S]*?)```/g);
            for (const match of fileMatches) {
                const filePath = match[1].trim();
                const fileContent = match[2];
                files.set(filePath, fileContent);
            }
            if (files.size > 0) {
                advancedOrch.updateFiles(files);
            }
        }

        context.broadcast('agents-feature-completed', {
            model: codeResult.model,
            strategy: codeResult.strategy,
        });

        context.broadcast('agents-completed', {});

    } catch (error) {
        context.broadcast('agents-error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// =============================================================================
// STATUS & CONTROL ENDPOINTS
// =============================================================================

/**
 * GET /api/execute/:sessionId/status
 *
 * Get the status of an execution session.
 */
router.get('/:sessionId/status', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: 'projectId query parameter required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        success: true,
        mode: context.mode,
        projectId: context.projectId,
        sessionId: context.sessionId,
        isActive: context.isActive,
        createdAt: context.createdAt,
    });
});

/**
 * POST /api/execute/:sessionId/interrupt
 *
 * Send an interrupt to a running execution.
 */
router.post('/:sessionId/interrupt', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId, message, type = 'CONTEXT_ADD' } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        // Submit interrupt (sessionId, message, agentId?)
        const result = await context.interrupts.submitInterrupt(
            sessionId,
            message || 'User interrupt',
            'execution-main' // agentId
        );

        context.broadcast('interrupt-submitted', {
            type: result.type,
            message,
            interruptId: result.id,
        });

        res.json({
            success: true,
            interruptId: result.id,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/:sessionId/stop
 *
 * Stop a running execution.
 */
router.post('/:sessionId/stop', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        await context.shutdown();

        res.json({
            success: true,
            message: 'Execution stopped',
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/:sessionId/checkpoint
 *
 * Create a checkpoint for the current execution.
 */
router.post('/:sessionId/checkpoint', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId, label = 'Manual checkpoint' } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        const checkpointId = await context.createCheckpoint(label);

        res.json({
            success: true,
            checkpointId,
            label,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/:sessionId/restore
 *
 * Restore a checkpoint.
 */
router.post('/:sessionId/restore', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { projectId, checkpointId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    if (!checkpointId) {
        return res.status(400).json({ error: 'checkpointId is required' });
    }

    const context = getContext(projectId, sessionId);

    if (!context) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        await context.restoreCheckpoint(checkpointId);

        res.json({
            success: true,
            message: 'Checkpoint restored',
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/execute/modes
 *
 * Get information about available execution modes.
 */
router.get('/modes', (_req: Request, res: Response) => {
    res.json({
        success: true,
        modes: [
            {
                id: 'builder',
                name: 'Builder Mode',
                description: 'Full autonomous build with 6-phase loop',
                features: ['Intent Lock', 'Verification Swarm', 'Browser Demo'],
                useCases: ['New projects', 'Complete features', 'Full stack apps'],
            },
            {
                id: 'developer',
                name: 'Developer Mode',
                description: 'Iterative code changes with live preview',
                features: ['Code Editor', 'Live Preview', 'Soft Interrupts'],
                useCases: ['Bug fixes', 'Small changes', 'Code iteration'],
            },
            {
                id: 'agents',
                name: 'Agents Mode',
                description: 'Multi-agent parallel execution',
                features: ['Queen/Worker Hierarchy', 'Parallel Sandboxes', 'Agent Control'],
                useCases: ['Complex features', 'Large refactors', 'Multi-file changes'],
            },
        ],
    });
});

// =============================================================================
// PLAN APPROVAL WORKFLOW (P0 - Builder View Parity with Feature Agent)
// =============================================================================

// In-memory store for pending builds awaiting plan approval or credentials
// In production, this would be in a database for persistence across restarts
interface PendingBuild {
    sessionId: string;
    projectId: string;
    userId: string;
    prompt: string;
    plan: BuildPlan;
    requiredCredentials: RequiredCredential[];
    createdAt: Date;
    status: 'awaiting_plan_approval' | 'awaiting_credentials' | 'building' | 'complete' | 'failed';
    approvedPlan?: BuildPlan;
    credentials?: Record<string, string>;
    deepIntentContractId?: string;
}

interface BuildPlan {
    intentSummary: string;
    phases: PlanPhase[];
    estimatedTokenUsage: number;
    estimatedCostUSD: number;
    parallelAgentsNeeded: number;
    frontendFirst: boolean;
    backendFirst: boolean;
    parallelFrontendBackend: boolean;
}

interface PlanPhase {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: 'frontend' | 'backend';
    steps: PlanStep[];
    order: number;
    approved: boolean;
}

interface PlanStep {
    id: string;
    description: string;
    type: 'code' | 'config' | 'test' | 'deploy';
    estimatedTokens: number;
}

interface RequiredCredential {
    id: string;
    name: string;
    description: string;
    envVariableName: string;
    platformName: string;
    platformUrl: string;
    required: boolean;
}

const pendingBuilds = new Map<string, PendingBuild>();

// Credential detection patterns
const CREDENTIAL_PATTERNS: Record<string, { name: string; envVar: string; platform: string; url: string }[]> = {
    // Payments
    stripe: [
        { name: 'Stripe Secret Key', envVar: 'STRIPE_SECRET_KEY', platform: 'Stripe', url: 'https://dashboard.stripe.com/apikeys' },
        { name: 'Stripe Publishable Key', envVar: 'STRIPE_PUBLISHABLE_KEY', platform: 'Stripe', url: 'https://dashboard.stripe.com/apikeys' },
        { name: 'Stripe Webhook Secret', envVar: 'STRIPE_WEBHOOK_SECRET', platform: 'Stripe', url: 'https://dashboard.stripe.com/webhooks' },
    ],
    // AI LLM Providers (for apps that use LLM APIs directly)
    openai: [
        { name: 'OpenAI API Key', envVar: 'OPENAI_API_KEY', platform: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
    ],
    anthropic: [
        { name: 'Anthropic API Key', envVar: 'ANTHROPIC_API_KEY', platform: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
    ],
    openrouter: [
        { name: 'OpenRouter API Key', envVar: 'OPENROUTER_API_KEY', platform: 'OpenRouter', url: 'https://openrouter.ai/keys' },
    ],
    // AI Model Hosting (for video/image/audio generation)
    huggingface: [
        { name: 'HuggingFace Token', envVar: 'HUGGINGFACE_TOKEN', platform: 'HuggingFace', url: 'https://huggingface.co/settings/tokens' },
    ],
    replicate: [
        { name: 'Replicate API Token', envVar: 'REPLICATE_API_TOKEN', platform: 'Replicate', url: 'https://replicate.com/account/api-tokens' },
    ],
    fal: [
        { name: 'Fal API Key', envVar: 'FAL_KEY', platform: 'Fal', url: 'https://fal.ai/dashboard/keys' },
    ],
    runpod: [
        { name: 'RunPod API Key', envVar: 'RUNPOD_API_KEY', platform: 'RunPod', url: 'https://www.runpod.io/console/user/settings' },
    ],
    modal: [
        { name: 'Modal Token ID', envVar: 'MODAL_TOKEN_ID', platform: 'Modal', url: 'https://modal.com/settings' },
        { name: 'Modal Token Secret', envVar: 'MODAL_TOKEN_SECRET', platform: 'Modal', url: 'https://modal.com/settings' },
    ],
    // Databases
    supabase: [
        { name: 'Supabase URL', envVar: 'SUPABASE_URL', platform: 'Supabase', url: 'https://supabase.com/dashboard/project/_/settings/api' },
        { name: 'Supabase Anon Key', envVar: 'SUPABASE_ANON_KEY', platform: 'Supabase', url: 'https://supabase.com/dashboard/project/_/settings/api' },
        { name: 'Supabase Service Role Key', envVar: 'SUPABASE_SERVICE_ROLE_KEY', platform: 'Supabase', url: 'https://supabase.com/dashboard/project/_/settings/api' },
    ],
    planetscale: [
        { name: 'Database URL', envVar: 'DATABASE_URL', platform: 'PlanetScale', url: 'https://app.planetscale.com/' },
    ],
    turso: [
        { name: 'Turso Database URL', envVar: 'TURSO_DATABASE_URL', platform: 'Turso', url: 'https://turso.tech/app' },
        { name: 'Turso Auth Token', envVar: 'TURSO_AUTH_TOKEN', platform: 'Turso', url: 'https://turso.tech/app' },
    ],
    neon: [
        { name: 'Neon Database URL', envVar: 'DATABASE_URL', platform: 'Neon', url: 'https://console.neon.tech/' },
    ],
    // Storage
    cloudflare: [
        { name: 'R2 Account ID', envVar: 'R2_ACCOUNT_ID', platform: 'Cloudflare R2', url: 'https://dash.cloudflare.com/?to=/:account/r2' },
        { name: 'R2 Access Key ID', envVar: 'R2_ACCESS_KEY_ID', platform: 'Cloudflare R2', url: 'https://dash.cloudflare.com/?to=/:account/r2' },
        { name: 'R2 Secret Access Key', envVar: 'R2_SECRET_ACCESS_KEY', platform: 'Cloudflare R2', url: 'https://dash.cloudflare.com/?to=/:account/r2' },
        { name: 'R2 Bucket Name', envVar: 'R2_BUCKET_NAME', platform: 'Cloudflare R2', url: 'https://dash.cloudflare.com/?to=/:account/r2' },
    ],
    aws: [
        { name: 'AWS Access Key ID', envVar: 'AWS_ACCESS_KEY_ID', platform: 'AWS', url: 'https://console.aws.amazon.com/iam/home#/security_credentials' },
        { name: 'AWS Secret Access Key', envVar: 'AWS_SECRET_ACCESS_KEY', platform: 'AWS', url: 'https://console.aws.amazon.com/iam/home#/security_credentials' },
    ],
    firebase: [
        { name: 'Firebase API Key', envVar: 'FIREBASE_API_KEY', platform: 'Firebase', url: 'https://console.firebase.google.com/project/_/settings/general' },
    ],
    // Authentication
    clerk: [
        { name: 'Clerk Publishable Key', envVar: 'CLERK_PUBLISHABLE_KEY', platform: 'Clerk', url: 'https://dashboard.clerk.com/' },
        { name: 'Clerk Secret Key', envVar: 'CLERK_SECRET_KEY', platform: 'Clerk', url: 'https://dashboard.clerk.com/' },
    ],
    auth0: [
        { name: 'Auth0 Domain', envVar: 'AUTH0_DOMAIN', platform: 'Auth0', url: 'https://manage.auth0.com/' },
        { name: 'Auth0 Client ID', envVar: 'AUTH0_CLIENT_ID', platform: 'Auth0', url: 'https://manage.auth0.com/' },
    ],
    betterauth: [
        { name: 'Better Auth Secret', envVar: 'BETTER_AUTH_SECRET', platform: 'Better Auth', url: '' }, // Auto-generated
        { name: 'Better Auth URL', envVar: 'BETTER_AUTH_URL', platform: 'Better Auth', url: '' }, // Auto-configured
    ],
    // Email
    resend: [
        { name: 'Resend API Key', envVar: 'RESEND_API_KEY', platform: 'Resend', url: 'https://resend.com/api-keys' },
    ],
    sendgrid: [
        { name: 'SendGrid API Key', envVar: 'SENDGRID_API_KEY', platform: 'SendGrid', url: 'https://app.sendgrid.com/settings/api_keys' },
    ],
    // Messaging
    twilio: [
        { name: 'Twilio Account SID', envVar: 'TWILIO_ACCOUNT_SID', platform: 'Twilio', url: 'https://console.twilio.com/' },
        { name: 'Twilio Auth Token', envVar: 'TWILIO_AUTH_TOKEN', platform: 'Twilio', url: 'https://console.twilio.com/' },
    ],
    // Source Control
    github: [
        { name: 'GitHub Token', envVar: 'GITHUB_TOKEN', platform: 'GitHub', url: 'https://github.com/settings/tokens' },
    ],
};

/**
 * CRITICAL: Extract credentials from Deep Intent Contract's integration requirements
 *
 * This uses the REAL VL-JEPA analyzed integration requirements, not naive regex.
 * The Deep Intent Contract already analyzed what the app truly needs:
 * - appType: "ai_video_generator" vs "chatbot" etc.
 * - detectedModels: Which ML models were mentioned
 * - integrationRequirements: Full API/credential requirements
 *
 * This is the correct way to determine credentials - using intelligent intent analysis,
 * not just pattern matching on the raw prompt.
 */
function extractCredentialsFromDeepIntent(
    deepIntent: {
        appType: string;
        requiresGPU?: boolean;
        gpuWorkloadType?: string;
        detectedModels?: Array<{ modelId: string; displayName: string; source: string; confidence: number }>;
        integrationRequirements?: Array<{
            id: string;
            platform: string;
            purpose: string;
            credentialRequirements?: {
                envVarName: string;
                setupUrl: string;
            };
        }>;
    },
    prompt: string
): RequiredCredential[] {
    const credentials: RequiredCredential[] = [];
    const seenEnvVars = new Set<string>();

    console.log(`[extractCredentialsFromDeepIntent] App type: ${deepIntent.appType}`);
    console.log(`[extractCredentialsFromDeepIntent] GPU workload: ${deepIntent.gpuWorkloadType}`);
    console.log(`[extractCredentialsFromDeepIntent] Integration requirements: ${deepIntent.integrationRequirements?.length || 0}`);

    // STEP 1: Use integrationRequirements from Deep Intent (the REAL analysis)
    if (deepIntent.integrationRequirements && deepIntent.integrationRequirements.length > 0) {
        for (const integration of deepIntent.integrationRequirements) {
            // Skip KripTik's internal AI requirements - we use our own keys for building
            const isInternalAI = ['OpenAI', 'Anthropic', 'OpenRouter', 'Claude'].some(
                ai => integration.platform.toLowerCase().includes(ai.toLowerCase())
            );
            const isMediaGenApp = ['video', 'image', 'audio', 'music', 'generation'].some(
                type => deepIntent.appType.toLowerCase().includes(type) ||
                        (deepIntent.gpuWorkloadType || '').toLowerCase().includes(type)
            );

            // Don't ask for LLM keys for media generation apps - KripTik uses its own
            if (isInternalAI && isMediaGenApp) {
                console.log(`[extractCredentialsFromDeepIntent] Skipping ${integration.platform} - KripTik uses own keys for building`);
                continue;
            }

            if (integration.credentialRequirements?.envVarName &&
                !seenEnvVars.has(integration.credentialRequirements.envVarName)) {
                seenEnvVars.add(integration.credentialRequirements.envVarName);
                credentials.push({
                    id: `cred-${uuidv4().slice(0, 8)}`,
                    name: integration.platform,
                    description: integration.purpose,
                    envVariableName: integration.credentialRequirements.envVarName,
                    platformName: integration.platform,
                    platformUrl: integration.credentialRequirements.setupUrl || '',
                    required: true,
                });
            }
        }
    }

    // STEP 2: If detected models include HuggingFace models, ensure HF token is requested
    if (deepIntent.detectedModels && deepIntent.detectedModels.length > 0) {
        const hasHFModels = deepIntent.detectedModels.some(
            m => m.modelId.includes('/') || // HuggingFace model IDs have format "org/model"
                 m.displayName.toLowerCase().includes('huggingface') ||
                 ['wan', 'sdxl', 'flux', 'stable', 'cogvideo', 'animatediff'].some(
                     name => m.modelId.toLowerCase().includes(name)
                 )
        );

        if (hasHFModels && !seenEnvVars.has('HUGGINGFACE_TOKEN')) {
            console.log(`[extractCredentialsFromDeepIntent] Detected HF models: ${deepIntent.detectedModels.map(m => m.modelId).join(', ')}`);
            seenEnvVars.add('HUGGINGFACE_TOKEN');
            credentials.push({
                id: `cred-${uuidv4().slice(0, 8)}`,
                name: 'HuggingFace Token',
                description: 'Required for accessing HuggingFace models',
                envVariableName: 'HUGGINGFACE_TOKEN',
                platformName: 'HuggingFace',
                platformUrl: 'https://huggingface.co/settings/tokens',
                required: true,
            });
        }
    }

    // STEP 3: If GPU workload type indicates video/image generation, ensure appropriate model hosting
    if (deepIntent.gpuWorkloadType && !seenEnvVars.has('HUGGINGFACE_TOKEN')) {
        const gpuTypes = ['video_generation', 'image_generation', 'diffusion', 'text_to_video', 'text_to_image'];
        if (gpuTypes.some(t => deepIntent.gpuWorkloadType?.toLowerCase().includes(t))) {
            seenEnvVars.add('HUGGINGFACE_TOKEN');
            credentials.push({
                id: `cred-${uuidv4().slice(0, 8)}`,
                name: 'HuggingFace Token',
                description: 'Required for GPU-accelerated model inference',
                envVariableName: 'HUGGINGFACE_TOKEN',
                platformName: 'HuggingFace',
                platformUrl: 'https://huggingface.co/settings/tokens',
                required: true,
            });
        }
    }

    // STEP 4: Fallback to minimal regex detection for common essentials NOT covered by deep intent
    // This is a safety net, but the deep intent should have caught everything
    const essentialPatterns = [
        { pattern: /\b(payment|stripe|checkout|subscription)\b/i, service: 'stripe' },
        { pattern: /\b(database|sql|postgres|mysql|turso|supabase)\b/i, service: 'database' },
    ];

    for (const { pattern, service } of essentialPatterns) {
        if (pattern.test(prompt) && CREDENTIAL_PATTERNS[service]) {
            for (const cred of CREDENTIAL_PATTERNS[service]) {
                if (!seenEnvVars.has(cred.envVar)) {
                    seenEnvVars.add(cred.envVar);
                    credentials.push({
                        id: `cred-${uuidv4().slice(0, 8)}`,
                        name: cred.name,
                        description: `Required for ${cred.platform} integration`,
                        envVariableName: cred.envVar,
                        platformName: cred.platform,
                        platformUrl: cred.url,
                        required: true,
                    });
                }
            }
        }
    }

    console.log(`[extractCredentialsFromDeepIntent] Final credentials: ${credentials.map(c => c.envVariableName).join(', ')}`);
    return credentials;
}

/**
 * DEPRECATED: Fallback credential detection from raw prompt
 * Use extractCredentialsFromDeepIntent instead when deep intent is available
 */
function detectRequiredCredentials(prompt: string): RequiredCredential[] {
    const credentials: RequiredCredential[] = [];
    const promptLower = prompt.toLowerCase();
    const seenEnvVars = new Set<string>();

    // CRITICAL: Determine what type of app is being built
    // KripTik uses its own API keys for the BUILD process
    // Only ask for user's LLM keys if their DEPLOYED APP needs them
    const isMediaGenApp = /\b(video|image|photo|audio|music|voice|3d|model.*generat|generat.*video|generat.*image|wan|cogvideo|stable.*diffusion|flux|sdxl)/i.test(prompt);
    const isLLMChatApp = /\b(chatbot|chat.*bot|ai.*assistant|gpt.*app|claude.*app|llm.*app|conversation|chat.*interface)/i.test(prompt);

    // Keywords that should NOT trigger LLM API key requests unless building a chatbot
    const llmProviderKeywords = ['openai', 'anthropic', 'openrouter'];

    for (const [keyword, creds] of Object.entries(CREDENTIAL_PATTERNS)) {
        if (promptLower.includes(keyword)) {
            // Skip LLM providers for media generation apps - KripTik uses its own keys
            if (llmProviderKeywords.includes(keyword) && isMediaGenApp && !isLLMChatApp) {
                console.log(`[detectRequiredCredentials] Skipping ${keyword} - media gen app uses KripTik's AI, not user's`);
                continue;
            }

            for (const cred of creds) {
                if (!seenEnvVars.has(cred.envVar)) {
                    seenEnvVars.add(cred.envVar);
                    credentials.push({
                        id: `cred-${uuidv4().slice(0, 8)}`,
                        name: cred.name,
                        description: `Required for ${cred.platform} integration`,
                        envVariableName: cred.envVar,
                        platformName: cred.platform,
                        platformUrl: cred.url,
                        required: true,
                    });
                }
            }
        }
    }

    // Additional pattern matching for common integrations
    // CRITICAL: KripTik uses its own API keys for building. Only ask for user's LLM keys
    // if the USER'S APP explicitly needs them (e.g., building a chatbot that uses OpenAI directly)
    // (isMediaGenApp and isLLMChatApp were already calculated above)

    const additionalPatterns: Array<{ pattern: RegExp; service: string }> = [
        // Payments - match payment keywords
        { pattern: /\b(payment|checkout|subscription|billing|stripe)\b/i, service: 'stripe' },

        // LLM APIs - ONLY ask for user's key if building a chatbot/LLM app (not for KripTik's internal AI)
        // KripTik uses its own keys for building; only the user's deployed app needs these
        ...(isLLMChatApp && !isMediaGenApp ? [
            { pattern: /\b(openai|gpt-?[345]|chatgpt)\b/i, service: 'openai' },
            { pattern: /\b(claude|anthropic)\b/i, service: 'anthropic' },
        ] : []),

        // AI Model Hosting - for video/image/audio generation
        { pattern: /\b(hugg(ing)?face|hf|transformers|diffusers)\b/i, service: 'huggingface' },
        { pattern: /\b(replicate)\b/i, service: 'replicate' },
        { pattern: /\b(fal\.ai|fal ai)\b/i, service: 'fal' },
        { pattern: /\b(runpod|serverless.*gpu)\b/i, service: 'runpod' },
        { pattern: /\b(modal\.com|modal labs)\b/i, service: 'modal' },

        // Video generation models - need HuggingFace or model hosting
        { pattern: /\b(wan|cogvideo|animatediff|stable.*video|svd|video.*generat)/i, service: 'huggingface' },

        // Image generation models - need HuggingFace or model hosting
        { pattern: /\b(stable.*diffusion|sdxl|flux|midjourney)/i, service: 'huggingface' },
        // Note: dall-e needs OpenAI, but only if building an app that uses DALL-E
        ...(isLLMChatApp ? [{ pattern: /\b(dall-?e)\b/i, service: 'openai' }] : []),

        // Email
        { pattern: /\b(email|newsletter|transactional.*mail)\b/i, service: 'resend' },

        // SMS
        { pattern: /\b(sms|text.*message|phone.*verification)\b/i, service: 'twilio' },

        // Auth - match specific auth services
        { pattern: /\b(clerk)\b/i, service: 'clerk' },
        { pattern: /\b(auth0)\b/i, service: 'auth0' },

        // Databases - be specific about which provider
        { pattern: /\b(supabase)\b/i, service: 'supabase' },
        { pattern: /\b(planetscale)\b/i, service: 'planetscale' },
        { pattern: /\b(turso)\b/i, service: 'turso' },
        { pattern: /\b(neon)\b/i, service: 'neon' },

        // Storage - match specific services
        { pattern: /\b(cloudflare.*r2|r2.*bucket)\b/i, service: 'cloudflare' },
        { pattern: /\b(aws|s3|amazon.*web.*services)\b/i, service: 'aws' },
    ];

    for (const { pattern, service } of additionalPatterns) {
        if (pattern.test(prompt) && CREDENTIAL_PATTERNS[service]) {
            for (const cred of CREDENTIAL_PATTERNS[service]) {
                if (!seenEnvVars.has(cred.envVar)) {
                    seenEnvVars.add(cred.envVar);
                    credentials.push({
                        id: `cred-${uuidv4().slice(0, 8)}`,
                        name: cred.name,
                        description: `Required for ${cred.platform} integration`,
                        envVariableName: cred.envVar,
                        platformName: cred.platform,
                        platformUrl: cred.url,
                        required: true,
                    });
                }
            }
        }
    }

    return credentials;
}

/**
 * Generate implementation plan from prompt using AI
 */
async function generateBuildPlan(prompt: string, projectId: string, userId: string): Promise<BuildPlan> {
    const ktn = getKripToeNite();
    const analysis = ktn.analyzePrompt(prompt, { projectId, userId, framework: 'react', language: 'typescript' });

    // Generate phases based on analysis
    const phases: PlanPhase[] = [];
    let order = 0;

    // Frontend phases
    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'UI Framework & Styling',
        description: 'Set up React with Tailwind CSS and premium component library',
        icon: 'Code',
        type: 'frontend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Initialize React project with Vite', type: 'code', estimatedTokens: 2000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure Tailwind CSS with custom theme', type: 'config', estimatedTokens: 1500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Set up Radix UI component library', type: 'code', estimatedTokens: 3000 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Core Components',
        description: 'Build reusable UI components following design system',
        icon: 'Palette',
        type: 'frontend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create layout components (Header, Sidebar, Footer)', type: 'code', estimatedTokens: 4000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Build form components with validation', type: 'code', estimatedTokens: 3500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Implement data display components', type: 'code', estimatedTokens: 3000 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Page Routes & Navigation',
        description: 'Set up routing and main application pages',
        icon: 'Zap',
        type: 'frontend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure React Router with protected routes', type: 'code', estimatedTokens: 2500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Build main application pages', type: 'code', estimatedTokens: 8000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Add page transitions and loading states', type: 'code', estimatedTokens: 2000 },
        ],
    });

    // Backend phases
    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Database & ORM',
        description: 'Set up Turso SQLite with Drizzle ORM',
        icon: 'Database',
        type: 'backend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure Turso connection', type: 'config', estimatedTokens: 1000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Define database schema with Drizzle', type: 'code', estimatedTokens: 4000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create migration scripts', type: 'code', estimatedTokens: 1500 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'API Routes & Services',
        description: 'Build Express API with authentication',
        icon: 'Server',
        type: 'backend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Set up Express with middleware', type: 'code', estimatedTokens: 2000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create CRUD API endpoints', type: 'code', estimatedTokens: 6000 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Implement authentication with Better Auth', type: 'code', estimatedTokens: 4000 },
        ],
    });

    phases.push({
        id: `phase-${uuidv4().slice(0, 8)}`,
        title: 'Deployment Configuration',
        description: 'Configure Vercel deployment with environment setup',
        icon: 'Shield',
        type: 'backend',
        order: order++,
        approved: false,
        steps: [
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Create Vercel configuration', type: 'config', estimatedTokens: 800 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Set up environment variables', type: 'config', estimatedTokens: 500 },
            { id: `step-${uuidv4().slice(0, 8)}`, description: 'Configure build and deploy scripts', type: 'config', estimatedTokens: 600 },
        ],
    });

    // Calculate totals
    const totalTokens = phases.reduce((sum, phase) =>
        sum + phase.steps.reduce((stepSum, step) => stepSum + step.estimatedTokens, 0), 0
    );

    return {
        intentSummary: `Building: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`,
        phases,
        estimatedTokenUsage: totalTokens,
        estimatedCostUSD: (totalTokens / 1000) * 0.015, // Approximate cost
        parallelAgentsNeeded: Math.min(5, Math.ceil(phases.length / 2)),
        frontendFirst: true,
        backendFirst: false,
        parallelFrontendBackend: analysis.analysis.complexity === Complexity.MEDIUM,
    };
}

/**
 * POST /api/execute/plan/stream
 *
 * Generate implementation plan with SSE streaming for real-time feedback.
 * This allows the frontend to show progress during plan generation.
 *
 * FAST PATH: Uses reduced thinking budget for initial plan (8K instead of 64K)
 * Full deep intent is created in background after plan is shown.
 */
router.post('/plan/stream', async (req: Request, res: Response) => {
    const { userId, projectId = `project-${uuidv4().slice(0, 8)}`, prompt } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (!prompt) {
        return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (type: string, data: Record<string, unknown>) => {
        try {
            res.write(`data: ${JSON.stringify({ type, ...data, timestamp: Date.now() })}\n\n`);
        } catch (e) {
            console.error('[Execute:Plan:Stream] Failed to send event:', e);
        }
    };

    const sessionId = uuidv4();

    // Heartbeat to keep connection alive during long operations
    const heartbeatInterval = setInterval(() => {
        sendEvent('heartbeat', { phase: 'processing' });
    }, 5000);

    try {
        // Phase 1: Immediate acknowledgment
        sendEvent('thinking', {
            content: `Analyzing: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`,
            phase: 'initialization',
        });

        console.log(`[Execute:Plan:Stream] Starting plan generation for session ${sessionId}`);

        // Phase 2: Generate the implementation plan (FAST - no AI, just analysis)
        sendEvent('thinking', {
            content: 'Decomposing requirements into phases...',
            phase: 'plan_generation',
        });

        const plan = await generateBuildPlan(prompt, projectId, userId);

        sendEvent('phase', {
            content: `${plan.phases.length} build phases identified`,
            details: plan.phases.map(p => p.title).join(', '),
        });

        // Phase 3: Create FAST Intent Contract (reduced thinking budget)
        sendEvent('thinking', {
            content: 'Creating Intent Contract...',
            phase: 'intent_lock',
        });

        const engine = createIntentLockEngine(userId, projectId);

        // Use lower thinking budget for FAST initial response (8K instead of 64K)
        // Full deep intent will be created during build phase
        const deepIntent = await engine.createDeepContract(
            prompt,
            userId,
            projectId,
            undefined,
            {
                fetchAPIDocs: false, // Skip API docs for faster response
                thinkingBudget: 8000, // Reduced from 64K for faster plan generation
            }
        );

        sendEvent('phase', {
            content: 'Intent Contract locked',
            details: `${deepIntent.functionalChecklist?.length || 0} success criteria`,
        });

        console.log(`[Execute:Plan:Stream] Fast Intent created: ${deepIntent.id}`);

        // Phase 4: Extract credentials (FAST - from analysis)
        sendEvent('thinking', {
            content: 'Detecting required credentials...',
            phase: 'credentials',
        });

        const requiredCredentials = extractCredentialsFromDeepIntent(deepIntent, prompt);

        if (requiredCredentials.length > 0) {
            sendEvent('phase', {
                content: `${requiredCredentials.length} credential(s) needed`,
                details: requiredCredentials.map(c => c.platformName).join(', '),
            });
        } else {
            sendEvent('phase', {
                content: 'No external credentials required',
                details: 'Ready to build',
            });
        }

        // Phase 5: Store pending build
        const pendingBuild: PendingBuild = {
            sessionId,
            projectId,
            userId,
            prompt,
            plan,
            requiredCredentials,
            createdAt: new Date(),
            status: 'awaiting_plan_approval',
            deepIntentContractId: deepIntent.id,
        };
        pendingBuilds.set(sessionId, pendingBuild);

        // Phase 6: Complete - send all data for frontend
        clearInterval(heartbeatInterval);
        sendEvent('complete', {
            content: 'Ready for your review',
            sessionId,
            projectId,
            plan,
            requiredCredentials,
        });

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        clearInterval(heartbeatInterval);
        console.error('[Execute:Plan:Stream] Error:', error);
        sendEvent('error', {
            content: error instanceof Error ? error.message : 'Unknown error',
        });
        res.write('data: [DONE]\n\n');
        res.end();
    }
});

/**
 * POST /api/execute/plan
 *
 * Generate implementation plan and detect required credentials.
 * This is the first step in the multi-step build workflow.
 */
router.post('/plan', async (req: Request, res: Response) => {
    try {
        const { userId, projectId = `project-${uuidv4().slice(0, 8)}`, prompt } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        if (!prompt) {
            return res.status(400).json({ success: false, error: 'prompt is required' });
        }

        const sessionId = uuidv4();
        console.log(`[Execute:Plan] Generating plan for session ${sessionId}`);

        // Generate the implementation plan
        const plan = await generateBuildPlan(prompt, projectId, userId);

        // Create Deep Intent Contract FIRST for precise DONE definition
        // This contains the REAL integration requirements from VL-JEPA analysis
        const engine = createIntentLockEngine(userId, projectId);
        const deepIntent = await engine.createDeepContract(
            prompt,
            userId,
            projectId,
            undefined,
            {
                fetchAPIDocs: true,
                thinkingBudget: 64000,
            }
        );

        console.log(`[Execute:Plan] Deep Intent created: ${deepIntent.id}`);
        console.log(`  - Functional Checklist: ${deepIntent.functionalChecklist.length} items`);
        console.log(`  - Integrations: ${deepIntent.integrationRequirements.length}`);
        console.log(`  - App Type: ${deepIntent.appType}`);
        console.log(`  - GPU Required: ${deepIntent.requiresGPU}`);
        console.log(`  - Detected Models: ${JSON.stringify(deepIntent.detectedModels || [])}`);

        // CRITICAL: Use Deep Intent's integration requirements for credentials
        // This is the REAL analysis, not naive regex matching
        const requiredCredentials = extractCredentialsFromDeepIntent(deepIntent, prompt);

        // Store the pending build
        const pendingBuild: PendingBuild = {
            sessionId,
            projectId,
            userId,
            prompt,
            plan,
            requiredCredentials,
            createdAt: new Date(),
            status: 'awaiting_plan_approval',
            deepIntentContractId: deepIntent.id,
        };
        pendingBuilds.set(sessionId, pendingBuild);

        res.json({
            success: true,
            sessionId,
            projectId,
            plan,
            requiredCredentials,
        });

    } catch (error) {
        console.error('[Execute:Plan] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/plan/:sessionId/approve
 *
 * Approve the plan and optionally provide credentials, then start the build.
 */
router.post('/plan/:sessionId/approve', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { approvedPhases, credentials } = req.body;

        const pendingBuild = pendingBuilds.get(sessionId);
        if (!pendingBuild) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        // Update phase approvals
        if (approvedPhases && Array.isArray(approvedPhases)) {
            for (const phase of pendingBuild.plan.phases) {
                phase.approved = approvedPhases.includes(phase.id);
            }
        } else {
            // Approve all phases if not specified
            for (const phase of pendingBuild.plan.phases) {
                phase.approved = true;
            }
        }

        pendingBuild.approvedPlan = pendingBuild.plan;

        // CRITICAL: Enrich Deep Intent Contract with the approved plan
        // This creates the complete functional checklist from the plan phases/steps
        if (pendingBuild.deepIntentContractId) {
            console.log(`[Execute:Approve] Enriching Deep Intent ${pendingBuild.deepIntentContractId} with approved plan`);
            try {
                const enrichedContract = await enrichDeepIntentWithPlan(
                    pendingBuild.deepIntentContractId,
                    pendingBuild.approvedPlan as ApprovedBuildPlan,
                    pendingBuild.userId,
                    pendingBuild.projectId
                );
                console.log(`[Execute:Approve] Deep Intent enriched successfully:`);
                console.log(`  - Total Checklist Items: ${enrichedContract.totalChecklistItems}`);
                console.log(`  - Technical Requirements: ${enrichedContract.technicalRequirements.length}`);
                console.log(`  - Wiring Connections: ${enrichedContract.wiringMap.length}`);
            } catch (enrichError) {
                console.error('[Execute:Approve] Failed to enrich Deep Intent (non-blocking):', enrichError);
                // Non-blocking - build can proceed without enrichment
            }
        }

        // Check if credentials are required but not provided
        if (pendingBuild.requiredCredentials.length > 0 && !credentials) {
            pendingBuild.status = 'awaiting_credentials';
            pendingBuilds.set(sessionId, pendingBuild);

            // P1-2: Create notification for credential request
            // Send to multiple channels: push, email, and SMS
            const notificationService = getNotificationService();

            // Build a list of credential platforms for the notification
            const platformList = [...new Set(pendingBuild.requiredCredentials.map(c => c.platformName))].join(', ');

            await notificationService.sendNotification(
                pendingBuild.userId,
                ['push', 'email', 'sms'], // Include SMS for mobile notifications
                {
                    type: 'credentials_needed',
                    title: 'Action Required: Connect Your Services',
                    message: `Your build needs ${pendingBuild.requiredCredentials.length} credential${pendingBuild.requiredCredentials.length > 1 ? 's' : ''} (${platformList}) to continue. Click to connect your services with one-click OAuth or follow the guided setup.`,
                    featureAgentId: sessionId,
                    featureAgentName: 'Build Orchestrator',
                    actionUrl: `/builder/${pendingBuild.projectId}?resumeBuild=${sessionId}&showCredentials=true`,
                    metadata: {
                        projectId: pendingBuild.projectId,
                        sessionId,
                        requiredCredentials: pendingBuild.requiredCredentials.map(c => ({
                            name: c.name,
                            envVar: c.envVariableName,
                            platform: c.platformName,
                            platformUrl: c.platformUrl,
                        })),
                        buildPaused: true,
                        // Include OAuth deep links for quick connect
                        oauthConnectLinks: pendingBuild.requiredCredentials
                            .filter(c => c.platformName)
                            .map(c => ({
                                platform: c.platformName,
                                connectUrl: `/api/nango/auth-url?integrationId=${encodeURIComponent(c.platformName?.toLowerCase() || '')}&userId=${pendingBuild.userId}&projectId=${pendingBuild.projectId}`,
                            })),
                    },
                }
            );

            return res.json({
                success: true,
                status: 'awaiting_credentials',
                requiredCredentials: pendingBuild.requiredCredentials,
            });
        }

        // Store credentials if provided
        if (credentials) {
            pendingBuild.credentials = credentials;

            // CRITICAL: Write credentials to .env file and credential vault
            // This ensures the sandbox can access the credentials during the build
            try {
                const envResult = await writeCredentialsToProjectEnv(
                    pendingBuild.projectId,
                    pendingBuild.userId,
                    credentials,
                    { environment: 'all', overwriteExisting: true }
                );

                console.log(`[Execute:Approve] Wrote ${envResult.credentialsWritten} credentials to .env:`, envResult.envKeys);
            } catch (envError) {
                console.error('[Execute:Approve] Failed to write credentials to .env:', envError);
                // Non-blocking - credentials are still in memory
            }
        }

        pendingBuild.status = 'building';
        pendingBuilds.set(sessionId, pendingBuild);

        // Start the actual build in the background
        const context = getOrCreateContext({
            mode: 'builder',
            projectId: pendingBuild.projectId,
            userId: pendingBuild.userId,
            sessionId,
            framework: 'react',
            language: 'typescript',
            enableVisualVerification: true,
            enableCheckpoints: true,
        });

        // Store credentials in context for the build
        if (pendingBuild.credentials) {
            (context as unknown as { credentials: Record<string, string> }).credentials = pendingBuild.credentials;
        }

        // Start build in background
        setImmediate(async () => {
            // Declare Enhanced Build Loop at function scope for cleanup access
            let enhancedBuildLoop: EnhancedBuildLoopOrchestrator | null = null;

            try {
                // Initialize Enhanced Build Loop (Cursor 2.1+ features)
                const buildId = sessionId;
                const projectPath = context.projectPath || `/tmp/builds/${pendingBuild.projectId}`;
                const previewUrl = `http://localhost:3100`;

                enhancedBuildLoop = createEnhancedBuildLoop({
                    buildId,
                    projectId: pendingBuild.projectId,
                    userId: pendingBuild.userId,
                    projectPath,
                    previewUrl,
                    enableStreamingFeedback: true,
                    enableContinuousVerification: true,
                    enableRuntimeDebug: true,
                    enableBrowserInLoop: true,
                    enableHumanCheckpoints: true,
                    enableMultiAgentJudging: true,
                    enablePatternLibrary: true,
                    visualQualityThreshold: 85,
                    humanCheckpointEscalationLevel: 2,
                });

                // Set up event forwarding
                setupEnhancedBuildLoopEvents(context, enhancedBuildLoop);

                // Start enhanced loop
                try {
                    await enhancedBuildLoop.start();
                    console.log('[Execute:PlanApprove] Enhanced Build Loop started');
                } catch (enhancedError) {
                    console.warn('[Execute:PlanApprove] Enhanced Build Loop failed (non-blocking):', enhancedError);
                }

                // Create build loop orchestrator
                const buildLoop = new BuildLoopOrchestrator(
                    context.projectId,
                    context.userId,
                    context.orchestrationRunId,
                    'production',
                    {
                        humanInTheLoop: false,
                        projectPath: context.projectPath,
                        approvedPlan: pendingBuild.approvedPlan,
                        credentials: pendingBuild.credentials,
                        deepIntentContractId: pendingBuild.deepIntentContractId,
                    } as any
                );

                buildLoop.on('event', (event) => {
                    context.broadcast(`builder-${event.type}`, event.data);
                });

                await buildLoop.start(pendingBuild.prompt);

                const buildState = buildLoop.getState();

                context.broadcast('builder-build-complete', {
                    status: buildState.status,
                    message: 'Build loop finished. Verifying Deep Intent satisfaction...',
                });

                // CRITICAL: Check Deep Intent satisfaction before claiming completion
                if (buildState.status === 'complete' && pendingBuild.deepIntentContractId) {
                    console.log(`[Execute:Approve] Checking Deep Intent satisfaction for contract ${pendingBuild.deepIntentContractId}`);

                    try {
                        const satisfied = await checkAndFixDeepIntentSatisfaction(
                            pendingBuild.projectId,
                            pendingBuild.userId,
                            pendingBuild.deepIntentContractId,
                            context,
                            context.orchestrationRunId
                        );

                        if (satisfied) {
                            pendingBuild.status = 'complete';
                            pendingBuilds.set(sessionId, pendingBuild);

                            context.broadcast('builder-completed', {
                                status: 'complete',
                                projectId: pendingBuild.projectId,
                                deepIntentSatisfied: true,
                                message: 'Build complete! All requirements verified.',
                            });
                        } else {
                            pendingBuild.status = 'failed';
                            pendingBuilds.set(sessionId, pendingBuild);

                            context.broadcast('builder-completed', {
                                status: 'incomplete',
                                projectId: pendingBuild.projectId,
                                deepIntentSatisfied: false,
                                message: 'Build finished but not all requirements are met.',
                            });
                        }
                    } catch (deepIntentError) {
                        console.error('[Execute:Approve] Deep Intent check failed:', deepIntentError);
                        pendingBuild.status = 'failed';
                        pendingBuilds.set(sessionId, pendingBuild);

                        context.broadcast('builder-error', {
                            error: deepIntentError instanceof Error ? deepIntentError.message : 'Deep Intent verification failed',
                        });
                    }
                } else {
                    // No Deep Intent or build failed
                    pendingBuild.status = buildState.status === 'complete' ? 'complete' : 'failed';
                    pendingBuilds.set(sessionId, pendingBuild);

                    context.broadcast('builder-completed', {
                        status: buildState.status,
                        projectId: pendingBuild.projectId,
                        message: buildState.status === 'complete' ? 'Build complete (no Deep Intent verification).' : `Build ${buildState.status}.`,
                    });
                }

            } catch (error) {
                console.error(`[Execute:Plan:Approve] Build failed:`, error);
                pendingBuild.status = 'failed';
                pendingBuilds.set(sessionId, pendingBuild);
                context.broadcast('builder-error', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                // Cleanup Enhanced Build Loop
                if (enhancedBuildLoop) {
                    try {
                        await enhancedBuildLoop.stop();
                        console.log('[Execute:PlanApprove] Enhanced Build Loop stopped');
                    } catch (cleanupError) {
                        console.warn('[Execute:PlanApprove] Error stopping Enhanced Build Loop:', cleanupError);
                    }
                }
            }
        });

        res.json({
            success: true,
            status: 'building',
            projectId: pendingBuild.projectId,
            websocketChannel: `/ws/context?contextId=${pendingBuild.projectId}&userId=${pendingBuild.userId}`,
        });

    } catch (error) {
        console.error('[Execute:Plan:Approve] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/execute/plan/:sessionId/credentials
 *
 * Submit credentials for a pending build and start the build.
 */
router.post('/plan/:sessionId/credentials', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { credentials } = req.body;

        const pendingBuild = pendingBuilds.get(sessionId);
        if (!pendingBuild) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        if (pendingBuild.status !== 'awaiting_credentials') {
            return res.status(400).json({
                success: false,
                error: `Build is not awaiting credentials. Current status: ${pendingBuild.status}`,
            });
        }

        // Store credentials
        pendingBuild.credentials = credentials;

        // CRITICAL: Write credentials to .env file and credential vault
        // This ensures the sandbox can access the credentials during the build
        try {
            const envResult = await writeCredentialsToProjectEnv(
                pendingBuild.projectId,
                pendingBuild.userId,
                credentials,
                { environment: 'all', overwriteExisting: true }
            );

            console.log(`[Execute:Credentials] Wrote ${envResult.credentialsWritten} credentials to .env:`, envResult.envKeys);
        } catch (envError) {
            console.error('[Execute:Credentials] Failed to write credentials to .env:', envError);
            // Non-blocking - credentials are still in memory
        }

        pendingBuild.status = 'building';
        pendingBuilds.set(sessionId, pendingBuild);

        // P1-2: Create notification that build is resuming
        const notificationService = getNotificationService();
        await notificationService.sendNotification(
            pendingBuild.userId,
            ['push'],
            {
                type: 'build_resumed',
                title: 'Build Resumed',
                message: `Credentials received! Your build "${pendingBuild.plan.intentSummary?.slice(0, 40) || 'Your app'}..." is now running.`,
                featureAgentId: sessionId,
                featureAgentName: 'Build Orchestrator',
                actionUrl: `/builder/${pendingBuild.projectId}`,
                metadata: {
                    projectId: pendingBuild.projectId,
                    sessionId,
                    credentialsProvided: Object.keys(credentials).length,
                },
            }
        );

        // Start the actual build
        const context = getOrCreateContext({
            mode: 'builder',
            projectId: pendingBuild.projectId,
            userId: pendingBuild.userId,
            sessionId,
            framework: 'react',
            language: 'typescript',
            enableVisualVerification: true,
            enableCheckpoints: true,
        });

        // Store credentials in context
        (context as unknown as { credentials: Record<string, string> }).credentials = credentials;

        // Start build in background
        setImmediate(async () => {
            // Declare Enhanced Build Loop at function scope for cleanup access
            let enhancedBuildLoop: EnhancedBuildLoopOrchestrator | null = null;

            try {
                // Initialize Enhanced Build Loop (Cursor 2.1+ features)
                const buildId = sessionId;
                const projectPath = context.projectPath || `/tmp/builds/${pendingBuild.projectId}`;
                const previewUrl = `http://localhost:3100`;

                enhancedBuildLoop = createEnhancedBuildLoop({
                    buildId,
                    projectId: pendingBuild.projectId,
                    userId: pendingBuild.userId,
                    projectPath,
                    previewUrl,
                    enableStreamingFeedback: true,
                    enableContinuousVerification: true,
                    enableRuntimeDebug: true,
                    enableBrowserInLoop: true,
                    enableHumanCheckpoints: true,
                    enableMultiAgentJudging: true,
                    enablePatternLibrary: true,
                    visualQualityThreshold: 85,
                    humanCheckpointEscalationLevel: 2,
                });

                // Set up event forwarding
                setupEnhancedBuildLoopEvents(context, enhancedBuildLoop);

                // Start enhanced loop
                try {
                    await enhancedBuildLoop.start();
                    console.log('[Execute:PlanApprove] Enhanced Build Loop started');
                } catch (enhancedError) {
                    console.warn('[Execute:PlanApprove] Enhanced Build Loop failed (non-blocking):', enhancedError);
                }

                // Create build loop orchestrator
                const buildLoop = new BuildLoopOrchestrator(
                    context.projectId,
                    context.userId,
                    context.orchestrationRunId,
                    'production',
                    {
                        humanInTheLoop: false,
                        projectPath: context.projectPath,
                        approvedPlan: pendingBuild.approvedPlan,
                        credentials: pendingBuild.credentials,
                        deepIntentContractId: pendingBuild.deepIntentContractId,
                    } as any
                );

                buildLoop.on('event', (event) => {
                    context.broadcast(`builder-${event.type}`, event.data);
                });

                await buildLoop.start(pendingBuild.prompt);

                const buildState = buildLoop.getState();

                context.broadcast('builder-build-complete', {
                    status: buildState.status,
                    message: 'Build loop finished. Verifying Deep Intent satisfaction...',
                });

                // CRITICAL: Check Deep Intent satisfaction before claiming completion
                if (buildState.status === 'complete' && pendingBuild.deepIntentContractId) {
                    console.log(`[Execute:Credentials] Checking Deep Intent satisfaction for contract ${pendingBuild.deepIntentContractId}`);

                    try {
                        const satisfied = await checkAndFixDeepIntentSatisfaction(
                            pendingBuild.projectId,
                            pendingBuild.userId,
                            pendingBuild.deepIntentContractId,
                            context,
                            context.orchestrationRunId
                        );

                        if (satisfied) {
                            pendingBuild.status = 'complete';
                            pendingBuilds.set(sessionId, pendingBuild);

                            // P1-2: Create notification for build completion (via credentials flow)
                            const notifService = getNotificationService();
                            await notifService.sendNotification(
                                pendingBuild.userId,
                                ['push', 'email'],
                                {
                                    type: 'build_complete',
                                    title: 'Build Complete!',
                                    message: `Your app "${pendingBuild.plan.intentSummary?.slice(0, 40) || 'Your app'}..." is ready. All requirements verified!`,
                                    featureAgentId: sessionId,
                                    featureAgentName: 'Build Orchestrator',
                                    actionUrl: `/builder/${pendingBuild.projectId}?showDemo=true`,
                                    metadata: {
                                        projectId: pendingBuild.projectId,
                                        sessionId,
                                        buildComplete: true,
                                        deepIntentSatisfied: true,
                                    },
                                }
                            );

                            context.broadcast('builder-completed', {
                                status: 'complete',
                                projectId: pendingBuild.projectId,
                                deepIntentSatisfied: true,
                                message: 'Build complete! All requirements verified.',
                            });
                        } else {
                            pendingBuild.status = 'failed';
                            pendingBuilds.set(sessionId, pendingBuild);

                            context.broadcast('builder-completed', {
                                status: 'incomplete',
                                projectId: pendingBuild.projectId,
                                deepIntentSatisfied: false,
                                message: 'Build finished but not all requirements are met.',
                            });
                        }
                    } catch (deepIntentError) {
                        console.error('[Execute:Credentials] Deep Intent check failed:', deepIntentError);
                        pendingBuild.status = 'failed';
                        pendingBuilds.set(sessionId, pendingBuild);

                        context.broadcast('builder-error', {
                            error: deepIntentError instanceof Error ? deepIntentError.message : 'Deep Intent verification failed',
                        });
                    }
                } else {
                    // No Deep Intent or build failed
                    pendingBuild.status = buildState.status === 'complete' ? 'complete' : 'failed';
                    pendingBuilds.set(sessionId, pendingBuild);

                    if (buildState.status === 'complete') {
                        // P1-2: Create notification for build completion without Deep Intent
                        const notifService = getNotificationService();
                        await notifService.sendNotification(
                            pendingBuild.userId,
                            ['push', 'email'],
                            {
                                type: 'build_complete',
                                title: 'Build Complete!',
                                message: `Your app "${pendingBuild.plan.intentSummary?.slice(0, 40) || 'Your app'}..." is ready. Click to see it in action!`,
                                featureAgentId: sessionId,
                                featureAgentName: 'Build Orchestrator',
                                actionUrl: `/builder/${pendingBuild.projectId}?showDemo=true`,
                                metadata: {
                                    projectId: pendingBuild.projectId,
                                    sessionId,
                                    buildComplete: true,
                                },
                            }
                        );

                        context.broadcast('builder-completed', {
                            status: 'complete',
                            projectId: pendingBuild.projectId,
                            message: 'Build complete (no Deep Intent verification).',
                        });
                    } else {
                        context.broadcast('builder-completed', {
                            status: buildState.status,
                            projectId: pendingBuild.projectId,
                            message: `Build ${buildState.status}.`,
                        });
                    }
                }

            } catch (error) {
                console.error(`[Execute:Credentials] Build failed:`, error);
                pendingBuild.status = 'failed';
                pendingBuilds.set(sessionId, pendingBuild);
                context.broadcast('builder-error', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                // Cleanup Enhanced Build Loop
                if (enhancedBuildLoop) {
                    try {
                        await enhancedBuildLoop.stop();
                        console.log('[Execute:Credentials] Enhanced Build Loop stopped');
                    } catch (cleanupError) {
                        console.warn('[Execute:Credentials] Error stopping Enhanced Build Loop:', cleanupError);
                    }
                }
            }
        });

        res.json({
            success: true,
            status: 'building',
            projectId: pendingBuild.projectId,
            websocketChannel: `/ws/context?contextId=${pendingBuild.projectId}&userId=${pendingBuild.userId}`,
        });

    } catch (error) {
        console.error('[Execute:Credentials] Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/execute/active
 *
 * Get all active builds for a user (for rejoin capability).
 */
router.get('/active', (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId query parameter required' });
    }

    // P3: Enhanced active builds response for rejoin capability
    const activeBuilds: Array<{
        sessionId: string;
        projectId: string;
        status: string;
        prompt: string;
        createdAt: Date;
        websocketChannel: string;
        requiredCredentials?: RequiredCredential[];
        intentSummary?: string;
    }> = [];

    // P3: Include all active builds (building, awaiting_credentials, awaiting_plan_approval)
    // This allows users to rejoin builds after browser closes
    for (const [sessionId, build] of pendingBuilds.entries()) {
        if (build.userId === userId && ['building', 'awaiting_credentials', 'awaiting_plan_approval'].includes(build.status)) {
            activeBuilds.push({
                sessionId,
                projectId: build.projectId,
                status: build.status,
                prompt: build.prompt.slice(0, 100) + (build.prompt.length > 100 ? '...' : ''),
                createdAt: build.createdAt,
                websocketChannel: `/ws/context?contextId=${build.projectId}&userId=${build.userId}`,
                // P3: Include additional info for rejoin
                requiredCredentials: build.status === 'awaiting_credentials' ? build.requiredCredentials : undefined,
                intentSummary: build.plan?.intentSummary,
            });
        }
    }

    res.json({
        success: true,
        activeBuilds,
    });
});

/**
 * GET /api/execute/plan/:sessionId
 *
 * Get the status of a pending build.
 */
router.get('/plan/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const pendingBuild = pendingBuilds.get(sessionId);
    if (!pendingBuild) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({
        success: true,
        sessionId,
        projectId: pendingBuild.projectId,
        status: pendingBuild.status,
        plan: pendingBuild.plan,
        requiredCredentials: pendingBuild.requiredCredentials,
        createdAt: pendingBuild.createdAt,
    });
});

export default router;

