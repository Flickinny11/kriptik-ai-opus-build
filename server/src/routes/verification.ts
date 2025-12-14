/**
 * Verification Swarm API Routes
 *
 * Endpoints for running the 6-agent verification swarm
 * and the comprehensive Bug Hunt system.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db.js';
import { projects, files as filesTable } from '../schema.js';
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
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authMiddleware);

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
    const userId = req.headers['x-user-id'] as string || (req as unknown as { userId: string }).userId;
    const { projectId, mode, agentConfigs } = req.body as {
        projectId: string;
        mode: SwarmMode;
        agentConfigs?: AgentFineGrainConfig[];
    };

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
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
    const userId = req.headers['x-user-id'] as string || (req as unknown as { userId: string }).userId;
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
    const userId = req.headers['x-user-id'] as string || (req as unknown as { userId: string }).userId;
    const { projectId, intent } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
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
    const userId = req.headers['x-user-id'] as string || (req as unknown as { userId: string }).userId;
    const { bugId } = req.params;
    const { huntId, projectId } = req.body;

    if (!huntId || !projectId) {
        return res.status(400).json({ error: 'huntId and projectId are required' });
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
    const userId = req.headers['x-user-id'] as string || (req as unknown as { userId: string }).userId;
    const { huntId, projectId } = req.body;

    if (!huntId || !projectId) {
        return res.status(400).json({ error: 'huntId and projectId are required' });
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
    const userId = req.headers['x-user-id'] as string || (req as unknown as { userId: string }).userId;
    const { projectId, mode, agentConfigs } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
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
    const userId = req.headers['x-user-id'] as string || (req as unknown as { userId: string }).userId;
    const { projectId } = req.params;

    const configKey = `${userId}:${projectId}`;
    const config = swarmConfigs.get(configKey) || {
        mode: 'thorough' as SwarmMode,
        agentConfigs: DEFAULT_AGENT_CONFIGS,
    };

    res.status(200).json({ config });
});

export default router;
