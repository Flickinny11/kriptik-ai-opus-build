/**
 * Feature Agent API Routes
 *
 * Prompt 2.2: Dedicated route module (in addition to Developer Mode routes).
 * These endpoints are thin, real wrappers over the single FeatureAgentService instance.
 *
 * Notes:
 * - Auth is enforced (same `authMiddleware` used elsewhere).
 * - No secrets are ever returned; credentials are only accepted for secure storage.
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getFeatureAgentService } from '../services/feature-agent/index.js';
import { getDeveloperModeOrchestrator } from '../services/developer-mode/orchestrator.js';
// Unified Context Integration
import {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
} from '../services/ai/unified-context.js';
import {
    getPredictiveErrorPrevention,
} from '../services/ai/predictive-error-prevention.js';
// Database imports for agent limit enforcement
import { db } from '../db.js';
import { developerModeAgents } from '../schema.js';
import { eq, inArray, and } from 'drizzle-orm';

const router = Router();
const requireAuth = authMiddleware;
const featureAgentService = getFeatureAgentService();
const developerModeOrchestrator = getDeveloperModeOrchestrator();

function ensureOwner(req: Request, res: Response, agentId: string) {
  const cfg = featureAgentService.getAgentConfig(agentId);
  if (!cfg) {
    res.status(404).json({ error: 'Feature Agent not found' });
    return null;
  }
  if (cfg.userId !== req.user!.id) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  return cfg;
}

// POST /api/feature-agent/create
router.post('/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { taskPrompt, model, projectId, sessionId, name } = req.body || {};

    if (!projectId || typeof projectId !== 'string') return res.status(400).json({ error: 'projectId is required' });
    if (!taskPrompt || typeof taskPrompt !== 'string') return res.status(400).json({ error: 'taskPrompt is required' });
    if (!model || typeof model !== 'string') return res.status(400).json({ error: 'model is required' });

    // Enforce server-side 6-agent limit
    const activeAgents = await db.select()
      .from(developerModeAgents)
      .where(and(
        eq(developerModeAgents.userId, userId),
        inArray(developerModeAgents.status, ['pending', 'running', 'building', 'verifying', 'idle'])
      ));

    if (activeAgents.length >= 6) {
      return res.status(429).json({
        error: 'Maximum 6 concurrent agents allowed',
        activeCount: activeAgents.length,
        suggestion: 'Wait for an agent to complete or cancel one'
      });
    }

    // Load unified context for rich code generation
    let enrichedTaskPrompt = taskPrompt;
    try {
      const contextProjectPath = `/tmp/builds/${projectId}`;
      const unifiedContext = await loadUnifiedContext(projectId, userId, contextProjectPath, {
        includeIntentLock: true,
        includeVerificationResults: true,
        includeLearningData: true,
        includeErrorHistory: true,
        includeProjectAnalysis: true,
        includeUserPreferences: true,
      });

      // Get predictive error prevention analysis
      const errorPrevention = getPredictiveErrorPrevention();
      const errorPrediction = await errorPrevention.predict({
        projectId,
        taskType: 'feature_implementation',
        taskDescription: taskPrompt.slice(0, 500),
        recentErrors: [],
      });

      // Enrich prompt with unified context
      const contextBlock = formatUnifiedContextForCodeGen(unifiedContext);
      const preventionGuidance = errorPrediction.predictions.length > 0
        ? `\n\n## PREDICTED ISSUES TO PREVENT:\n${errorPrediction.predictions.map(p =>
            `- [${p.type.toUpperCase()}] ${p.description} (${Math.round(p.confidence * 100)}% likely)\n  Prevention: ${p.prevention.instruction}`
          ).join('\n')}`
        : '';

      enrichedTaskPrompt = `${contextBlock}${preventionGuidance}\n\n## FEATURE REQUEST:\n${taskPrompt}`;

      console.log(`[Feature Agent] Loaded context: ${unifiedContext.intentLock ? 'Intent Lock' : 'No Intent'}, ${unifiedContext.learnedPatterns?.length || 0} patterns, ${errorPrediction.predictions.length} predicted issues`);
    } catch (contextError) {
      // Context loading is non-blocking - continue with original prompt
      console.warn('[Feature Agent] Context loading failed, proceeding with basic prompt:', contextError);
    }

    const agent = await featureAgentService.createFeatureAgent({
      projectId,
      userId,
      taskPrompt: enrichedTaskPrompt,
      model,
      name: typeof name === 'string' ? name : undefined,
    });

    // sessionId is accepted for compatibility but the service manages its own execution session lifecycle.
    void sessionId;

    res.json({ success: true, agent });
  } catch (error) {
    console.error('[Feature Agent] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create feature agent' });
  }
});

// GET /api/feature-agent/:agentId/stream
router.get('/:agentId/stream', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const cfg = ensureOwner(req, res, agentId);
    if (!cfg) return;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const write = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    write({ type: 'status', content: 'connected', timestamp: Date.now(), metadata: { agentId, status: cfg.status } });

    let closed = false;
    const heartbeat = setInterval(() => {
      if (!closed) res.write(`: heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
    });

    (async () => {
      try {
        for await (const msg of featureAgentService.streamFeatureAgent(agentId)) {
          if (closed) break;
          write(msg);
        }
      } catch (e) {
        if (!closed) {
          write({ type: 'result', content: `SSE stream failed: ${e instanceof Error ? e.message : 'Unknown error'}`, timestamp: Date.now() });
        }
      }
    })();
  } catch (error) {
    console.error('[Feature Agent] SSE error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'SSE failed' });
  }
});

router.post('/:agentId/plan/approve-phase', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const { phaseId } = req.body || {};
    if (!phaseId || typeof phaseId !== 'string') return res.status(400).json({ error: 'phaseId is required' });
    await featureAgentService.approvePhase(agentId, phaseId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Feature Agent] Approve phase error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to approve phase' });
  }
});

router.post('/:agentId/plan/modify-phase', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const { phaseId, modifications } = req.body || {};
    if (!phaseId || typeof phaseId !== 'string') return res.status(400).json({ error: 'phaseId is required' });
    if (!Array.isArray(modifications)) return res.status(400).json({ error: 'modifications must be an array' });
    const plan = await featureAgentService.modifyPhase(agentId, phaseId, modifications);
    res.json({ success: true, plan });
  } catch (error) {
    console.error('[Feature Agent] Modify phase error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to modify phase' });
  }
});

router.post('/:agentId/plan/approve-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    await featureAgentService.approveAllPhases(agentId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Feature Agent] Approve all error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to approve all' });
  }
});

// POST /api/feature-agent/:agentId/plan/reject
// Reject the current plan and regenerate it with optional feedback
router.post('/:agentId/plan/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const { feedback } = req.body || {};
    const plan = await featureAgentService.rejectPlan(agentId, typeof feedback === 'string' ? feedback : undefined);
    res.json({ success: true, plan });
  } catch (error) {
    console.error('[Feature Agent] Reject plan error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reject plan' });
  }
});

router.post('/:agentId/credentials', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const { credentials } = req.body || {};
    if (!credentials || typeof credentials !== 'object') return res.status(400).json({ error: 'credentials object is required' });
    await featureAgentService.storeCredentials(agentId, credentials);
    res.json({ success: true });
  } catch (error) {
    console.error('[Feature Agent] Store credentials error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to store credentials' });
  }
});

// POST /api/feature-agent/:agentId/start
router.post('/:agentId/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    await featureAgentService.startImplementation(agentId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Feature Agent] Start error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start' });
  }
});

router.post('/:agentId/stop', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    await featureAgentService.stopFeatureAgent(agentId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Feature Agent] Stop error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to stop' });
  }
});

router.post('/:agentId/ghost-mode', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const { config } = req.body || {};
    if (!config || typeof config !== 'object') return res.status(400).json({ error: 'config is required' });
    await featureAgentService.enableGhostMode(agentId, config);
    res.json({ success: true });
  } catch (error) {
    console.error('[Feature Agent] Ghost Mode error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to enable ghost mode' });
  }
});

// GET /api/feature-agent/:agentId/status
router.get('/:agentId/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const cfg = ensureOwner(req, res, agentId);
    if (!cfg) return;
    const status = await featureAgentService.getFeatureAgentStatus(agentId);
    res.json({ success: true, status });
  } catch (error) {
    console.error('[Feature Agent] Status error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get status' });
  }
});

// POST /api/feature-agent/:agentId/accept-merge
router.post('/:agentId/accept-merge', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const result = await featureAgentService.acceptAndMerge(agentId);
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Feature Agent] Accept merge error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to accept merge' });
  }
});

// GET /api/feature-agent/:agentId/preview
// Returns the live sandbox URL for the feature agent's preview environment.
router.get('/:agentId/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const cfg = ensureOwner(req, res, agentId);
    if (!cfg) return;

    // First check if the feature agent has a direct sandbox URL
    const sandboxUrl = featureAgentService.getSandboxUrl(agentId);
    if (sandboxUrl) {
      const sandboxInfo = featureAgentService.getSandboxInfo(agentId);
      return res.json({
        success: true,
        sandboxUrl,
        port: sandboxInfo?.port,
        status: sandboxInfo?.status || 'running',
        source: 'feature-agent-sandbox',
      });
    }

    // Fallback to Developer Mode session if no direct sandbox
    if (!cfg.sessionId) {
      return res.status(409).json({
        error: 'Feature Agent has no active sandbox yet. Start implementation first.',
        hint: 'Call POST /api/feature-agent/:agentId/start to begin implementation and create a sandbox.',
      });
    }

    // Try to get sandbox from Developer Mode orchestrator
    const session = await developerModeOrchestrator.getSession(cfg.sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found for sandbox preview',
        sessionId: cfg.sessionId,
      });
    }

    // Return session info for fallback sandbox lookup
    res.json({
      success: true,
      sessionId: cfg.sessionId,
      workBranch: session.workBranch,
      source: 'developer-mode-session',
      hint: 'Use /api/developer-mode/sandbox with this sessionId to obtain preview URL.',
    });
  } catch (error) {
    console.error('[Feature Agent] Preview error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get preview' });
  }
});

// GET /api/feature-agent/running
router.get('/running', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const agents = featureAgentService.getRunningAgentsForUser(userId);
    res.json({ success: true, agents });
  } catch (error) {
    console.error('[Feature Agent] Running agents error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get running agents' });
  }
});

// ============================================================================
// CHECKPOINT / ROLLBACK ENDPOINTS (Time Machine Integration)
// ============================================================================

// GET /api/feature-agent/:agentId/checkpoints
// Get all checkpoints for a feature agent
router.get('/:agentId/checkpoints', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const checkpoints = await featureAgentService.getCheckpoints(agentId);
    res.json({ success: true, checkpoints });
  } catch (error) {
    console.error('[Feature Agent] Get checkpoints error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get checkpoints' });
  }
});

// POST /api/feature-agent/:agentId/checkpoint
// Create a new checkpoint for a feature agent
router.post('/:agentId/checkpoint', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const { phase, description } = req.body || {};
    if (!phase || typeof phase !== 'string') {
      return res.status(400).json({ error: 'phase is required' });
    }
    const checkpoint = await featureAgentService.createCheckpoint(
      agentId,
      phase,
      typeof description === 'string' ? description : undefined
    );
    if (!checkpoint) {
      return res.status(500).json({ error: 'Failed to create checkpoint - no Time Machine available' });
    }
    res.json({ success: true, checkpoint });
  } catch (error) {
    console.error('[Feature Agent] Create checkpoint error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create checkpoint' });
  }
});

// POST /api/feature-agent/:agentId/rollback
// Rollback a feature agent to a specific checkpoint
router.post('/:agentId/rollback', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    if (!ensureOwner(req, res, agentId)) return;
    const { checkpointId } = req.body || {};
    if (!checkpointId || typeof checkpointId !== 'string') {
      return res.status(400).json({ error: 'checkpointId is required' });
    }
    const result = await featureAgentService.rollbackToCheckpoint(agentId, checkpointId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message, result });
    }
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Feature Agent] Rollback error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to rollback' });
  }
});

export default router;


