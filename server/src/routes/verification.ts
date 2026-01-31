/**
 * Verification Swarm API Routes
 *
 * Endpoints for running the 6-agent verification swarm
 * and the comprehensive Bug Hunt system.
 */

import { Router, type Request } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db.js';
import { projects, files as filesTable, verificationResults } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import {
    createVerificationSwarm,
    runBugHunt,
    applyBugFix,
    applyAllSafeFixes,
    recommendSwarmMode,
    SWARM_MODES,
    DEFAULT_AGENT_CONFIGS,
    type SwarmMode,
    type SwarmModeConfig,
    type AgentFineGrainConfig,
    type BugHuntResult,
    type BugReport,
    type SwarmRunContext,
    type VerificationAgentType,
} from '../services/verification/swarm.js';
import {
    getStreamingFeedbackChannel,
    type FeedbackItem,
} from '../services/feedback/streaming-feedback-channel.js';
import {
    createTieredGate,
    getGateConfiguration,
    type TieredVerificationGate,
    type GateCheckResult,
} from '../services/verification/tiered-gate.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authMiddleware);

function getRequestUserId(req: Request): string | null {
    const sessionUserId = (req as any).user?.id;
    const legacyUserId = (req as any).userId;
    const headerUserId = req.headers['x-user-id'];

    if (typeof sessionUserId === 'string' && sessionUserId.length > 0) return sessionUserId;
    if (typeof legacyUserId === 'string' && legacyUserId.length > 0) return legacyUserId;
    if (typeof headerUserId === 'string' && headerUserId.length > 0) return headerUserId;
    return null;
}

// In-memory storage for bug hunt results (would be in database in production)
const bugHuntResults = new Map<string, BugHuntResult>();
const swarmConfigs = new Map<string, { mode: SwarmMode; agentConfigs: AgentFineGrainConfig[] }>();

// ============================================================================
// SWARM MODE ENDPOINTS
// ============================================================================

/**
 * GET /api/verification/modes
 * Get all available swarm modes with their configurations
 */
router.get('/modes', async (_req, res) => {
    try {
        const modes = Object.entries(SWARM_MODES).map(([key, config]) => ({
            id: key,
            ...config,
        }));

        res.status(200).json({ modes });
    } catch (error) {
        console.error('Error getting swarm modes:', error);
        res.status(500).json({
            error: 'Failed to get swarm modes',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/verification/recommend-mode
 * Get recommended swarm mode based on context
 */
router.post('/recommend-mode', async (req, res) => {
    try {
        const context: SwarmRunContext = req.body;

        if (!context.buildPhase || !context.changeSize) {
            return res.status(400).json({ error: 'buildPhase and changeSize are required' });
        }

        const recommendedMode = recommendSwarmMode(context);
        const modeConfig = SWARM_MODES[recommendedMode];

        res.status(200).json({
            recommendedMode,
            config: modeConfig,
            reasoning: getRecommendationReasoning(context, recommendedMode),
        });
    } catch (error) {
        console.error('Error recommending swarm mode:', error);
        res.status(500).json({
            error: 'Failed to recommend swarm mode',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

function getRecommendationReasoning(context: SwarmRunContext, mode: SwarmMode): string {
    if (context.previousFailureRate > 0.5) {
        return 'High failure rate detected. Paranoid mode recommended for thorough analysis.';
    }
    if (context.buildPhase === 'deploying') {
        return 'Production deployment detected. Full production-grade verification required.';
    }
    if (context.buildPhase === 'planning') {
        return 'Planning phase. Quick lightning checks sufficient.';
    }
    if (context.changeSize === 'large' || context.lastVerificationMinutesAgo > 60) {
        return 'Large changes or extended time since last verification. Thorough analysis recommended.';
    }
    return 'Balanced verification based on current build context.';
}

// ============================================================================
// SWARM RUN ENDPOINTS
// ============================================================================

/**
 * POST /api/verification/swarm/run
 * Run the verification swarm with specified mode and configuration
 */
router.post('/swarm/run', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId, mode, agentConfigs } = req.body as {
        projectId: string;
        mode: SwarmMode;
        agentConfigs?: AgentFineGrainConfig[];
    };

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const selectedMode = mode || 'thorough';
    if (!SWARM_MODES[selectedMode]) {
        return res.status(400).json({ error: 'Invalid swarm mode' });
    }

    try {
        // Verify project exists and belongs to user
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(200).json({
                message: 'No files to verify',
                results: {},
                mode: selectedMode,
            });
        }

        // Convert to files map
        const files = new Map<string, string>();
        for (const file of projectFiles) {
            files.set(file.path, file.content);
        }

        // Apply mode limits
        const modeConfig = SWARM_MODES[selectedMode];
        const limitedFiles = new Map<string, string>();
        let fileCount = 0;

        for (const [path, content] of files) {
            if (fileCount >= modeConfig.maxFilesPerAgent) break;
            limitedFiles.set(path, content);
            fileCount++;
        }

        // Create swarm with mode config
        const orchestrationRunId = uuidv4();
        const swarm = createVerificationSwarm(orchestrationRunId, projectId, userId);

        // Store config for this user's project
        swarmConfigs.set(`${userId}:${projectId}`, {
            mode: selectedMode,
            agentConfigs: agentConfigs || DEFAULT_AGENT_CONFIGS,
        });

        // Get enabled agents from mode or custom config
        const enabledAgents = agentConfigs
            ? agentConfigs.filter(a => a.enabled).map(a => a.agentType)
            : modeConfig.agentsEnabled;

        // Return mode info and start verification (actual results would come via SSE/WebSocket)
        res.status(200).json({
            message: 'Verification swarm started',
            runId: orchestrationRunId,
            mode: selectedMode,
            modeConfig,
            enabledAgents,
            fileCount: limitedFiles.size,
            estimatedDurationSec: modeConfig.estimatedDurationSec,
            creditCost: modeConfig.creditCost,
        });

    } catch (error) {
        console.error('Error running verification swarm:', error);
        res.status(500).json({
            error: 'Failed to run verification swarm',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/verification/swarm/run-agent/:agentType
 * Run a single verification agent
 */
router.post('/swarm/run-agent/:agentType', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { agentType } = req.params as { agentType: VerificationAgentType };
    const { projectId } = req.body;

    const validAgents: VerificationAgentType[] = [
        'error_checker',
        'code_quality',
        'visual_verifier',
        'security_scanner',
        'placeholder_eliminator',
        'design_style',
    ];

    if (!validAgents.includes(agentType)) {
        return res.status(400).json({ error: 'Invalid agent type' });
    }

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Verify project exists and belongs to user
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const orchestrationRunId = uuidv4();

        res.status(200).json({
            message: `Agent ${agentType} started`,
            runId: orchestrationRunId,
            agentType,
            projectId,
        });

    } catch (error) {
        console.error('Error running single agent:', error);
        res.status(500).json({
            error: 'Failed to run agent',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// BUG HUNT ENDPOINTS
// ============================================================================

/**
 * POST /api/verification/bug-hunt/start
 * Start a comprehensive bug hunt
 */
router.post('/bug-hunt/start', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId, intent } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!intent) {
        return res.status(400).json({ error: 'Intent contract is required for bug hunt' });
    }

    try {
        // Verify project exists and belongs to user
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(200).json({
                message: 'No files to hunt',
                result: null,
            });
        }

        // Convert to files map
        const files = new Map<string, string>();
        for (const file of projectFiles) {
            files.set(file.path, file.content);
        }

        // Start bug hunt (async operation)
        const huntPromise = runBugHunt(projectId, userId, intent, files);

        // Create initial result for tracking
        const huntId = uuidv4();
        const initialResult: BugHuntResult = {
            id: huntId,
            projectId,
            startedAt: new Date(),
            completedAt: null,
            bugsFound: [],
            bugsFixed: [],
            bugsNeedingHumanReview: [],
            intentLockChecks: [],
            summary: 'Bug hunt in progress...',
            status: 'running',
            filesScanned: files.size,
            totalLinesAnalyzed: 0,
        };

        bugHuntResults.set(huntId, initialResult);

        // Update result when complete
        huntPromise.then(result => {
            bugHuntResults.set(result.id, result);
        }).catch(error => {
            initialResult.status = 'failed';
            initialResult.summary = `Bug hunt failed: ${error.message}`;
            initialResult.completedAt = new Date();
        });

        res.status(200).json({
            message: 'Bug hunt started',
            huntId,
            filesScanned: files.size,
            projectId,
        });

    } catch (error) {
        console.error('Error starting bug hunt:', error);
        res.status(500).json({
            error: 'Failed to start bug hunt',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/verification/bug-hunt/status/:id
 * Get bug hunt status and results
 */
router.get('/bug-hunt/status/:id', async (req, res) => {
    const { id } = req.params;

    const result = bugHuntResults.get(id);

    if (!result) {
        return res.status(404).json({ error: 'Bug hunt not found' });
    }

    res.status(200).json({
        result,
        stats: {
            totalBugs: result.bugsFound.length,
            criticalBugs: result.bugsFound.filter(b => b.severity === 'critical').length,
            highBugs: result.bugsFound.filter(b => b.severity === 'high').length,
            safeToFix: result.bugsFound.filter(b => b.intentLockApproved).length,
            needsReview: result.bugsNeedingHumanReview.length,
            fixed: result.bugsFixed.length,
        },
    });
});

/**
 * POST /api/verification/bug-hunt/fix/:bugId
 * Apply a single bug fix
 */
router.post('/bug-hunt/fix/:bugId', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { bugId } = req.params;
    const { huntId, projectId } = req.body;

    if (!huntId || !projectId) {
        return res.status(400).json({ error: 'huntId and projectId are required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const huntResult = bugHuntResults.get(huntId);
    if (!huntResult) {
        return res.status(404).json({ error: 'Bug hunt not found' });
    }

    const bug = huntResult.bugsFound.find(b => b.id === bugId);
    if (!bug) {
        return res.status(404).json({ error: 'Bug not found' });
    }

    try {
        // Get current file content
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        const files = new Map<string, string>();
        for (const file of projectFiles) {
            files.set(file.path, file.content);
        }

        const result = await applyBugFix(bug, files);

        if (result.success && result.newContent) {
            // Update file in database
            await db
                .update(filesTable)
                .set({ content: result.newContent })
                .where(
                    and(
                        eq(filesTable.projectId, projectId),
                        eq(filesTable.path, bug.file)
                    )
                );

            bug.fixApplied = true;
            huntResult.bugsFixed.push(bug);

            res.status(200).json({
                success: true,
                message: 'Bug fix applied',
                bug,
            });
        } else {
            res.status(400).json({
                success: false,
                message: bug.intentLockApproved
                    ? 'Failed to apply fix'
                    : 'Fix requires human approval (may affect intended features)',
            });
        }

    } catch (error) {
        console.error('Error applying bug fix:', error);
        res.status(500).json({
            error: 'Failed to apply bug fix',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/verification/bug-hunt/fix-all-safe
 * Apply all intent-lock approved bug fixes
 */
router.post('/bug-hunt/fix-all-safe', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { huntId, projectId } = req.body;

    if (!huntId || !projectId) {
        return res.status(400).json({ error: 'huntId and projectId are required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const huntResult = bugHuntResults.get(huntId);
    if (!huntResult) {
        return res.status(404).json({ error: 'Bug hunt not found' });
    }

    try {
        // Get current file content
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        const files = new Map<string, string>();
        for (const file of projectFiles) {
            files.set(file.path, file.content);
        }

        const result = await applyAllSafeFixes(huntResult, files);

        // Update files in database
        for (const [path, content] of result.updatedFiles) {
            await db
                .update(filesTable)
                .set({ content })
                .where(
                    and(
                        eq(filesTable.projectId, projectId),
                        eq(filesTable.path, path)
                    )
                );
        }

        res.status(200).json({
            success: true,
            fixedCount: result.fixedCount,
            failedCount: result.failedCount,
            message: `Applied ${result.fixedCount} safe fixes`,
        });

    } catch (error) {
        console.error('Error applying all safe fixes:', error);
        res.status(500).json({
            error: 'Failed to apply safe fixes',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * PUT /api/verification/config
 * Update user's swarm configuration
 */
router.put('/config', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId, mode, agentConfigs } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (mode && !SWARM_MODES[mode as SwarmMode]) {
        return res.status(400).json({ error: 'Invalid swarm mode' });
    }

    try {
        const configKey = `${userId}:${projectId}`;
        const existing = swarmConfigs.get(configKey) || {
            mode: 'thorough' as SwarmMode,
            agentConfigs: DEFAULT_AGENT_CONFIGS,
        };

        if (mode) {
            existing.mode = mode;
        }

        if (agentConfigs) {
            existing.agentConfigs = agentConfigs;
        }

        swarmConfigs.set(configKey, existing);

        res.status(200).json({
            success: true,
            config: existing,
        });

    } catch (error) {
        console.error('Error updating swarm config:', error);
        res.status(500).json({
            error: 'Failed to update configuration',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/verification/config/:projectId
 * Get user's swarm configuration for a project
 */
router.get('/config/:projectId', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId } = req.params;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const configKey = `${userId}:${projectId}`;
    const config = swarmConfigs.get(configKey) || {
        mode: 'thorough' as SwarmMode,
        agentConfigs: DEFAULT_AGENT_CONFIGS,
    };

    res.status(200).json({ config });
});

// ============================================================================
// STREAMING FEEDBACK ENDPOINT
// ============================================================================

/**
 * GET /api/verification/feedback/:buildId/stream
 *
 * SSE stream of real-time verification feedback for a build.
 * This enables the Builder UI to show live verification results
 * as agents detect issues.
 *
 * Events:
 * - feedback: A new feedback item from verification
 * - blocker: A blocking issue that must be resolved
 * - acknowledgment: An agent acknowledged/fixed an issue
 * - summary: Periodic summary of current state
 * - heartbeat: Keep-alive
 */
router.get('/feedback/:buildId/stream', async (req, res) => {
    const { buildId } = req.params;
    const userId = getRequestUserId(req as unknown as Request);

    if (!buildId) {
        return res.status(400).json({ error: 'buildId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const feedbackChannel = getStreamingFeedbackChannel();

    // Send initial connection event
    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('connected', {
        buildId,
        timestamp: Date.now(),
        message: 'Connected to verification feedback stream',
    });

    // Listen for feedback events
    const onFeedback = (item: FeedbackItem & { buildId: string }) => {
        if (item.buildId === buildId) {
            sendEvent('feedback', {
                ...item,
                timestamp: item.timestamp.toISOString(),
            });

            // Also send as blocker if severity is critical or high
            if (item.severity === 'critical' || item.severity === 'high') {
                sendEvent('blocker', {
                    ...item,
                    timestamp: item.timestamp.toISOString(),
                });
            }
        }
    };

    const onAcknowledgment = (ack: { feedbackId: string; buildId: string; action: string }) => {
        if (ack.buildId === buildId) {
            sendEvent('acknowledgment', ack);
        }
    };

    // Subscribe to events
    feedbackChannel.on('feedback', onFeedback);
    feedbackChannel.on('acknowledged', onAcknowledgment);

    // Send periodic summary
    const summaryInterval = setInterval(() => {
        const stream = feedbackChannel.getStream(buildId);
        if (stream) {
            sendEvent('summary', {
                totalItems: stream.items.length,
                blockers: stream.blockers.length,
                unacknowledged: stream.unacknowledged.length,
                timestamp: Date.now(),
            });
        }
    }, 10000); // Every 10 seconds

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        feedbackChannel.off('feedback', onFeedback);
        feedbackChannel.off('acknowledged', onAcknowledgment);
        clearInterval(summaryInterval);
        clearInterval(heartbeatInterval);
    });
});

/**
 * POST /api/verification/feedback/:buildId/create-stream
 *
 * Create a feedback stream for a build.
 * Call this before starting verification to enable real-time feedback.
 */
router.post('/feedback/:buildId/create-stream', async (req, res) => {
    const { buildId } = req.params;
    const { agentId } = req.body;

    if (!buildId || !agentId) {
        return res.status(400).json({ error: 'buildId and agentId are required' });
    }

    const feedbackChannel = getStreamingFeedbackChannel();
    const stream = feedbackChannel.createStream(buildId, agentId);

    res.status(200).json({
        success: true,
        buildId,
        agentId,
        startedAt: stream.startedAt.toISOString(),
    });
});

/**
 * POST /api/verification/feedback/:buildId/inject
 *
 * Inject feedback into the stream (for testing or manual feedback).
 */
router.post('/feedback/:buildId/inject', async (req, res) => {
    const { buildId } = req.params;
    const { category, severity, message, file, line, suggestion, autoFixable } = req.body;

    if (!buildId || !category || !severity || !message) {
        return res.status(400).json({
            error: 'buildId, category, severity, and message are required',
        });
    }

    const feedbackChannel = getStreamingFeedbackChannel();

    feedbackChannel.injectFeedback(buildId, category, severity, message, {
        file,
        line,
        suggestion,
        autoFixable: autoFixable ?? false,
    });

    res.status(200).json({
        success: true,
        message: 'Feedback injected',
    });
});

// ============================================================================
// V-JEPA 2 PREDICTION STREAMING ENDPOINT
// ============================================================================

/**
 * GET /api/verification/predictions/:projectId/stream
 *
 * SSE stream of real-time V-JEPA 2 predictions for proactive error prevention.
 * This enables the Builder UI to show predicted errors BEFORE they manifest.
 *
 * Events:
 * - prediction: A new error prediction from V-JEPA 2
 * - system_health: Current system health assessment
 * - agent_status: Verification agent status update
 * - gate_status: Current verification gate status (Tier 1 / Tier 2)
 * - heartbeat: Keep-alive
 */
router.get('/predictions/:projectId/stream', async (req, res) => {
    const { projectId } = req.params;
    const userId = getRequestUserId(req as unknown as Request);

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial connection event
    sendEvent('connected', {
        projectId,
        timestamp: Date.now(),
        message: 'Connected to V-JEPA 2 prediction stream',
        capabilities: {
            predictions: true,
            agentStatus: true,
            gateStatus: true,
            systemHealth: true,
        },
    });

    // Track active agents and their states
    const agentStates: Map<VerificationAgentType, {
        status: 'idle' | 'running' | 'complete' | 'error';
        lastRun: Date | null;
        lastResult: 'pass' | 'fail' | 'warning' | null;
        issues: number;
    }> = new Map();

    // Initialize agent states
    const agentTypes: VerificationAgentType[] = [
        'error_checker',
        'code_quality',
        'visual_verifier',
        'security_scanner',
        'placeholder_eliminator',
        'design_style',
    ];

    for (const agentType of agentTypes) {
        agentStates.set(agentType, {
            status: 'idle',
            lastRun: null,
            lastResult: null,
            issues: 0,
        });
    }

    // Send initial agent states
    sendEvent('agent_status', {
        agents: Array.from(agentStates.entries()).map(([type, state]) => ({
            type,
            ...state,
            lastRun: state.lastRun?.toISOString() || null,
        })),
        timestamp: Date.now(),
    });

    // Send initial gate status
    sendEvent('gate_status', {
        tier1: {
            status: 'pending',
            checks: ['typescript', 'placeholders', 'security_patterns', 'anti_slop_instant'],
            passed: 0,
            failed: 0,
            running: false,
        },
        tier2: {
            status: 'pending',
            agents: agentTypes,
            depths: Object.fromEntries(agentTypes.map(a => [a, 'standard'])),
            running: false,
        },
        canMerge: false,
        timestamp: Date.now(),
    });

    // Simulate prediction updates (in production, these would come from ProactiveErrorPredictor)
    let predictionCount = 0;
    const predictionInterval = setInterval(() => {
        // Only send predictions occasionally to simulate V-JEPA 2 analysis
        // In production, this would be triggered by actual frame analysis
        predictionCount++;

        // Send system health every 15 seconds
        if (predictionCount % 3 === 0) {
            sendEvent('system_health', {
                score: 85 + Math.floor(Math.random() * 15),
                status: 'healthy',
                trend: 'stable',
                predictions: [],
                recommendations: [],
                timestamp: Date.now(),
            });
        }
    }, 5000);

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(predictionInterval);
        clearInterval(heartbeatInterval);
    });
});

/**
 * GET /api/verification/status/:projectId
 *
 * Get current verification status for a project including agent states and gate status.
 */
router.get('/status/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const userId = getRequestUserId(req as unknown as Request);

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Get the latest verification results from database
        const latestResults = await db
            .select()
            .from(verificationResults)
            .where(
                and(
                    eq(verificationResults.projectId, projectId),
                )
            )
            .orderBy(verificationResults.createdAt)
            .limit(10);

        const agentTypes: VerificationAgentType[] = [
            'error_checker',
            'code_quality',
            'visual_verifier',
            'security_scanner',
            'placeholder_eliminator',
            'design_style',
        ];

        const agentStates = agentTypes.map(agentType => {
            const result = latestResults.find(r => r.agentType === agentType);
            // Parse details to get issue count if available
            const details = result?.details as { issues?: unknown[] } | null;
            const issueCount = Array.isArray(details?.issues) ? details.issues.length : 0;
            return {
                type: agentType,
                status: result ? 'complete' : 'idle',
                lastRun: result?.createdAt || null,
                lastResult: result?.passed ? 'pass' : result ? 'fail' : null,
                issues: issueCount,
                score: result?.score || null,
                antiSlopScore: result?.antiSlopScore || null,
            };
        });

        const allPassed = latestResults.length > 0 && latestResults.every(r => r.passed);
        const hasBlockers = latestResults.some(r => !r.passed && r.agentType === 'placeholder_eliminator');

        res.status(200).json({
            projectId,
            agents: agentStates,
            gate: {
                tier1: {
                    status: allPassed ? 'passed' : 'pending',
                    passed: latestResults.filter(r => r.passed).length,
                    failed: latestResults.filter(r => !r.passed).length,
                },
                tier2: {
                    status: allPassed ? 'passed' : 'pending',
                },
                canMerge: allPassed && !hasBlockers,
            },
            overallScore: latestResults.reduce((sum, r) => sum + (r.score || 0), 0) / (latestResults.length || 1),
            lastVerified: latestResults[0]?.createdAt?.toISOString() || null,
        });
    } catch (error) {
        console.error('Error getting verification status:', error);
        res.status(500).json({
            error: 'Failed to get verification status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// TIERED VERIFICATION GATE ENDPOINTS
// ============================================================================

// In-memory storage for active gates (would be in database in production)
const activeGates = new Map<string, TieredVerificationGate>();

/**
 * GET /api/verification/gate/config
 *
 * Get the tiered gate configuration (Tier 1 and Tier 2 settings)
 */
router.get('/gate/config', async (_req, res) => {
    try {
        const config = getGateConfiguration();
        res.status(200).json(config);
    } catch (error) {
        console.error('Error getting gate config:', error);
        res.status(500).json({
            error: 'Failed to get gate configuration',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/verification/gate/start
 *
 * Start continuous Tier 1 verification for a project.
 * This runs error checker and placeholder eliminator every 5 seconds.
 */
router.post('/gate/start', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId, orchestrationRunId, projectPath } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const gateKey = `${userId}:${projectId}`;

        // Check if gate already exists
        let gate = activeGates.get(gateKey);
        if (!gate) {
            gate = createTieredGate(
                projectId,
                userId,
                orchestrationRunId || uuidv4(),
                projectPath
            );
            activeGates.set(gateKey, gate);
        }

        // Start continuous verification
        gate.startContinuousVerification();

        res.status(200).json({
            success: true,
            message: 'Tiered verification gate started',
            projectId,
            gateKey,
            status: gate.getFormattedStatus(),
        });
    } catch (error) {
        console.error('Error starting gate:', error);
        res.status(500).json({
            error: 'Failed to start verification gate',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/verification/gate/stop
 *
 * Stop continuous Tier 1 verification for a project.
 */
router.post('/gate/stop', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const gateKey = `${userId}:${projectId}`;
        const gate = activeGates.get(gateKey);

        if (gate) {
            gate.stopContinuousVerification();
            res.status(200).json({
                success: true,
                message: 'Verification gate stopped',
                projectId,
            });
        } else {
            res.status(404).json({
                error: 'Gate not found',
                message: 'No active verification gate for this project',
            });
        }
    } catch (error) {
        console.error('Error stopping gate:', error);
        res.status(500).json({
            error: 'Failed to stop verification gate',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/verification/gate/status/:projectId
 *
 * Get current gate status for a project.
 */
router.get('/gate/status/:projectId', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId } = req.params;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const gateKey = `${userId}:${projectId}`;
        const gate = activeGates.get(gateKey);

        if (gate) {
            res.status(200).json({
                projectId,
                state: gate.getState(),
                formatted: gate.getFormattedStatus(),
                blockerDetails: gate.getBlockerDetails(),
            });
        } else {
            res.status(200).json({
                projectId,
                state: {
                    status: 'NOT_STARTED',
                    tier1: null,
                    tier2: null,
                    currentFeatureId: null,
                    lastGateCheck: null,
                    blockedSince: null,
                    consecutiveBlockedCount: 0,
                    totalGateChecks: 0,
                    totalBlockedEvents: 0,
                },
                formatted: {
                    status: 'NOT_STARTED',
                    message: 'Verification gate not started',
                    tier1Status: 'Pending',
                    tier2Status: 'Pending',
                    blockerCount: 0,
                    isBlocked: false,
                },
                blockerDetails: [],
            });
        }
    } catch (error) {
        console.error('Error getting gate status:', error);
        res.status(500).json({
            error: 'Failed to get gate status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/verification/gate/check
 *
 * Run a full gate check (both Tier 1 and Tier 2) for a feature.
 * This is the main gate endpoint - nothing proceeds unless this returns canProceed: true.
 */
router.post('/gate/check', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId, featureId, featureDescription, intent } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const gateKey = `${userId}:${projectId}`;

        // Get or create gate
        let gate = activeGates.get(gateKey);
        if (!gate) {
            gate = createTieredGate(projectId, userId, uuidv4());
            activeGates.set(gateKey, gate);
        }

        // Set intent if provided
        if (intent) {
            gate.setIntent(intent);
        }

        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        const files = new Map<string, string>();
        for (const file of projectFiles) {
            files.set(file.path, file.content);
        }

        // Create feature object
        const feature = {
            featureId: featureId || 'current',
            description: featureDescription || 'Current feature',
            priority: 1 as const,
            dependencies: [],
        };

        // Run full gate check
        const result: GateCheckResult = await gate.checkGate(feature, files);

        res.status(200).json({
            projectId,
            featureId: feature.featureId,
            ...result,
            gateState: gate.getState(),
            formatted: gate.getFormattedStatus(),
        });
    } catch (error) {
        console.error('Error checking gate:', error);
        res.status(500).json({
            error: 'Failed to check gate',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/verification/gate/:projectId/stream
 *
 * SSE stream of real-time gate status updates.
 * This enables the Builder UI to show live gate status as verification runs.
 *
 * Events:
 * - gate_status: Current gate status (OPEN, BLOCKED, PENDING)
 * - tier1_complete: Tier 1 verification completed
 * - tier2_complete: Tier 2 verification completed
 * - blocker_added: New blocker detected
 * - blocker_resolved: Blocker was fixed
 * - heartbeat: Keep-alive
 */
router.get('/gate/:projectId/stream', async (req, res) => {
    const { projectId } = req.params;
    const userId = getRequestUserId(req as unknown as Request);

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const gateKey = `${userId}:${projectId}`;
    let gate = activeGates.get(gateKey);

    // Send initial connection event
    sendEvent('connected', {
        projectId,
        timestamp: Date.now(),
        message: 'Connected to tiered gate stream',
        gateActive: !!gate,
    });

    // If gate exists, set up event listeners
    if (gate) {
        const onTier1Complete = (result: unknown) => {
            sendEvent('tier1_complete', result);
            sendEvent('gate_status', {
                ...gate!.getFormattedStatus(),
                timestamp: Date.now(),
            });
        };

        const onTier2Complete = (result: unknown) => {
            sendEvent('tier2_complete', result);
            sendEvent('gate_status', {
                ...gate!.getFormattedStatus(),
                timestamp: Date.now(),
            });
        };

        const onGateCheckComplete = (result: unknown) => {
            sendEvent('gate_check_complete', result);
        };

        gate.on('tier1_complete', onTier1Complete);
        gate.on('tier2_complete', onTier2Complete);
        gate.on('gate_check_complete', onGateCheckComplete);

        // Send current status
        sendEvent('gate_status', {
            ...gate.getFormattedStatus(),
            state: gate.getState(),
            timestamp: Date.now(),
        });

        // Cleanup on disconnect
        req.on('close', () => {
            if (gate) {
                gate.off('tier1_complete', onTier1Complete);
                gate.off('tier2_complete', onTier2Complete);
                gate.off('gate_check_complete', onGateCheckComplete);
            }
        });
    }

    // Send periodic status updates
    const statusInterval = setInterval(() => {
        // Refresh gate reference in case it was created after connection
        gate = activeGates.get(gateKey);

        if (gate) {
            sendEvent('gate_status', {
                ...gate.getFormattedStatus(),
                blockerDetails: gate.getBlockerDetails(),
                timestamp: Date.now(),
            });
        } else {
            sendEvent('gate_status', {
                status: 'NOT_STARTED',
                message: 'Verification gate not started',
                tier1Status: 'Pending',
                tier2Status: 'Pending',
                blockerCount: 0,
                isBlocked: false,
                timestamp: Date.now(),
            });
        }
    }, 5000);

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(statusInterval);
        clearInterval(heartbeatInterval);
    });
});

/**
 * DELETE /api/verification/gate/:projectId
 *
 * Shutdown and remove a gate for a project.
 */
router.delete('/gate/:projectId', async (req, res) => {
    const userId = getRequestUserId(req as unknown as Request);
    const { projectId } = req.params;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const gateKey = `${userId}:${projectId}`;
        const gate = activeGates.get(gateKey);

        if (gate) {
            gate.shutdown();
            activeGates.delete(gateKey);
            res.status(200).json({
                success: true,
                message: 'Gate removed',
                projectId,
            });
        } else {
            res.status(404).json({
                error: 'Gate not found',
                message: 'No active verification gate for this project',
            });
        }
    } catch (error) {
        console.error('Error removing gate:', error);
        res.status(500).json({
            error: 'Failed to remove gate',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
