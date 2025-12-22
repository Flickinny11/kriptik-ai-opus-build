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
// Real implementation uses existing Developer Mode sandbox service via sessionId, once available.
router.get('/:agentId/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const cfg = ensureOwner(req, res, agentId);
    if (!cfg) return;

    if (!cfg.sessionId) {
      return res.status(409).json({ error: 'Feature Agent has no active session yet. Start implementation first.' });
    }

    // We use the Developer Mode sandbox (sessionId is used as sandbox agentId key in that service).
    const sandboxResp = await (async () => {
      // Call underlying orchestrator-managed route behavior by reusing its sandbox key. We need the actual worktree path,
      // which is managed by Developer Mode; if not available, return a clear error.
      const session = await developerModeOrchestrator.getSession(cfg.sessionId);
      if (!session) return null;
      const worktreePath = session.workBranch ? `/tmp/developer-mode/${cfg.sessionId}` : `/tmp/developer-mode/${cfg.sessionId}`;
      return { sessionId: cfg.sessionId, worktreePath };
    })();

    if (!sandboxResp) {
      return res.status(404).json({ error: 'Session not found for sandbox preview' });
    }

    // The canonical sandbox endpoints live under /api/developer-mode/sandbox; we return the sessionId so the client can request it.
    res.json({ success: true, sessionId: sandboxResp.sessionId, note: 'Use /api/developer-mode/sandbox with this sessionId to obtain preview URL.' });
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

export default router;


