/**
 * Learning System API Routes
 *
 * Endpoints for the Autonomous Learning Engine:
 * - System status and metrics
 * - Evolution cycles
 * - Patterns and strategies
 * - Training management
 * - Insights
 */

import { Router } from 'express';
import {
    getEvolutionFlywheel,
    getPatternLibrary,
    getStrategyEvolution,
    getAIJudgmentService,
    getShadowModelRegistry,
} from '../services/learning/index.js';
import type {
    PatternCategory,
    StrategyDomain,
    PreferenceDomain,
} from '../services/learning/types.js';

const router = Router();

// =============================================================================
// SYSTEM STATUS
// =============================================================================

/**
 * GET /api/learning/status
 * Get comprehensive learning system status
 */
router.get('/status', async (req, res) => {
    try {
        const flywheel = getEvolutionFlywheel();
        const status = await flywheel.getSystemStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        console.error('[Learning API] Failed to get status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get learning system status'
        });
    }
});

/**
 * GET /api/learning/trend
 * Get improvement trend over time
 */
router.get('/trend', async (req, res) => {
    try {
        const count = parseInt(req.query.count as string) || 20;
        const flywheel = getEvolutionFlywheel();
        const trend = await flywheel.getImprovementTrend(count);
        res.json({ success: true, data: trend });
    } catch (error) {
        console.error('[Learning API] Failed to get trend:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get improvement trend'
        });
    }
});

// =============================================================================
// EVOLUTION CYCLES
// =============================================================================

/**
 * POST /api/learning/cycles/run
 * Trigger a new evolution cycle
 */
router.post('/cycles/run', async (req, res) => {
    try {
        const userId = req.body.userId;
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        const flywheel = getEvolutionFlywheel();
        const cycle = await flywheel.runCycle(userId);
        res.json({ success: true, data: cycle });
    } catch (error) {
        console.error('[Learning API] Failed to run cycle:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to run evolution cycle'
        });
    }
});

/**
 * GET /api/learning/cycles
 * Get recent evolution cycles
 */
router.get('/cycles', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const flywheel = getEvolutionFlywheel();
        const cycles = await flywheel.getRecentCycles(limit);
        res.json({ success: true, data: cycles });
    } catch (error) {
        console.error('[Learning API] Failed to get cycles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get evolution cycles'
        });
    }
});

/**
 * GET /api/learning/cycles/:cycleId
 * Get a specific cycle
 */
router.get('/cycles/:cycleId', async (req, res) => {
    try {
        const flywheel = getEvolutionFlywheel();
        const cycle = await flywheel.getCycle(req.params.cycleId);
        if (!cycle) {
            return res.status(404).json({
                success: false,
                error: 'Cycle not found'
            });
        }
        res.json({ success: true, data: cycle });
    } catch (error) {
        console.error('[Learning API] Failed to get cycle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cycle'
        });
    }
});

// =============================================================================
// PATTERNS
// =============================================================================

/**
 * GET /api/learning/patterns
 * Get patterns by category
 */
router.get('/patterns', async (req, res) => {
    try {
        const category = req.query.category as PatternCategory | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        const patternLibrary = getPatternLibrary();

        const patterns = category
            ? await patternLibrary.getPatternsByCategory(category, limit)
            : await patternLibrary.getTopPatterns(limit);

        res.json({ success: true, data: patterns });
    } catch (error) {
        console.error('[Learning API] Failed to get patterns:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get patterns'
        });
    }
});

/**
 * GET /api/learning/patterns/search
 * Search for relevant patterns
 */
router.get('/patterns/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter q is required'
            });
        }

        const category = req.query.category as PatternCategory | undefined;
        const limit = parseInt(req.query.limit as string) || 5;

        const patternLibrary = getPatternLibrary();
        const patterns = await patternLibrary.findRelevantPatterns(query, category, limit);

        res.json({ success: true, data: patterns });
    } catch (error) {
        console.error('[Learning API] Failed to search patterns:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search patterns'
        });
    }
});

/**
 * POST /api/learning/patterns/:patternId/usage
 * Record pattern usage
 */
router.post('/patterns/:patternId/usage', async (req, res) => {
    try {
        const { success } = req.body;
        if (typeof success !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'success (boolean) is required'
            });
        }

        const patternLibrary = getPatternLibrary();
        await patternLibrary.recordPatternUsage(req.params.patternId, success);

        res.json({ success: true });
    } catch (error) {
        console.error('[Learning API] Failed to record pattern usage:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record pattern usage'
        });
    }
});

/**
 * GET /api/learning/patterns/stats
 * Get pattern statistics
 */
router.get('/patterns/stats', async (req, res) => {
    try {
        const patternLibrary = getPatternLibrary();
        const stats = await patternLibrary.getPatternStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get pattern stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pattern stats'
        });
    }
});

// =============================================================================
// STRATEGIES
// =============================================================================

/**
 * GET /api/learning/strategies
 * Get all strategies or by domain
 */
router.get('/strategies', async (req, res) => {
    try {
        const domain = req.query.domain as StrategyDomain | undefined;
        const strategyEvolution = getStrategyEvolution();

        const strategies = domain
            ? await strategyEvolution.getActiveStrategies(domain)
            : await strategyEvolution.getAllStrategies();

        res.json({ success: true, data: strategies });
    } catch (error) {
        console.error('[Learning API] Failed to get strategies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get strategies'
        });
    }
});

/**
 * POST /api/learning/strategies/select
 * Select best strategy for context
 */
router.post('/strategies/select', async (req, res) => {
    try {
        const { domain, context } = req.body;
        if (!domain || !context || !Array.isArray(context)) {
            return res.status(400).json({
                success: false,
                error: 'domain and context (array) are required'
            });
        }

        const strategyEvolution = getStrategyEvolution();
        const strategy = await strategyEvolution.selectStrategy(domain, context);

        res.json({ success: true, data: strategy });
    } catch (error) {
        console.error('[Learning API] Failed to select strategy:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to select strategy'
        });
    }
});

/**
 * POST /api/learning/strategies/:strategyId/outcome
 * Record strategy usage outcome
 */
router.post('/strategies/:strategyId/outcome', async (req, res) => {
    try {
        const { success, context } = req.body;
        if (typeof success !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'success (boolean) is required'
            });
        }

        const strategyEvolution = getStrategyEvolution();
        await strategyEvolution.recordStrategyOutcome(req.params.strategyId, success, context);

        res.json({ success: true });
    } catch (error) {
        console.error('[Learning API] Failed to record strategy outcome:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record strategy outcome'
        });
    }
});

/**
 * GET /api/learning/strategies/stats
 * Get strategy statistics
 */
router.get('/strategies/stats', async (req, res) => {
    try {
        const strategyEvolution = getStrategyEvolution();
        const stats = await strategyEvolution.getStrategyStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get strategy stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get strategy stats'
        });
    }
});

// =============================================================================
// PREFERENCE PAIRS
// =============================================================================

/**
 * GET /api/learning/pairs
 * Get unused preference pairs
 */
router.get('/pairs', async (req, res) => {
    try {
        const domain = req.query.domain as PreferenceDomain | undefined;
        const limit = parseInt(req.query.limit as string) || 100;

        const judgment = getAIJudgmentService();
        const pairs = await judgment.getUnusedPreferencePairs(domain, limit);

        res.json({ success: true, data: pairs });
    } catch (error) {
        console.error('[Learning API] Failed to get pairs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get preference pairs'
        });
    }
});

/**
 * GET /api/learning/pairs/stats
 * Get preference pair statistics
 */
router.get('/pairs/stats', async (req, res) => {
    try {
        const judgment = getAIJudgmentService();
        const stats = await judgment.getPreferencePairStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get pair stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pair stats'
        });
    }
});

// =============================================================================
// SHADOW MODELS
// =============================================================================

/**
 * GET /api/learning/models
 * Get shadow model registry status
 */
router.get('/models', async (req, res) => {
    try {
        const registry = getShadowModelRegistry();
        const stats = await registry.getRegistryStats();
        const activeModels = await registry.getAllActiveModels();

        res.json({
            success: true,
            data: {
                stats,
                activeModels: Object.fromEntries(activeModels),
            }
        });
    } catch (error) {
        console.error('[Learning API] Failed to get models:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get shadow models'
        });
    }
});

/**
 * GET /api/learning/models/:modelName/history
 * Get model version history
 */
router.get('/models/:modelName/history', async (req, res) => {
    try {
        const registry = getShadowModelRegistry();
        const history = await registry.getModelHistory(req.params.modelName as any);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('[Learning API] Failed to get model history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get model history'
        });
    }
});

/**
 * GET /api/learning/training-runs
 * Get recent training runs
 */
router.get('/training-runs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const registry = getShadowModelRegistry();
        const runs = await registry.getRecentTrainingRuns(limit);
        res.json({ success: true, data: runs });
    } catch (error) {
        console.error('[Learning API] Failed to get training runs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get training runs'
        });
    }
});

// =============================================================================
// INSIGHTS
// =============================================================================

/**
 * GET /api/learning/insights
 * Get recent learning insights
 */
router.get('/insights', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const strategyEvolution = getStrategyEvolution();
        const insights = await strategyEvolution.getRecentInsights(limit);
        res.json({ success: true, data: insights });
    } catch (error) {
        console.error('[Learning API] Failed to get insights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get insights'
        });
    }
});

/**
 * GET /api/learning/insights/pending
 * Get unimplemented insights
 */
router.get('/insights/pending', async (req, res) => {
    try {
        const strategyEvolution = getStrategyEvolution();
        const insights = await strategyEvolution.getUnimplementedInsights();
        res.json({ success: true, data: insights });
    } catch (error) {
        console.error('[Learning API] Failed to get pending insights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pending insights'
        });
    }
});

/**
 * POST /api/learning/insights/:insightId/implement
 * Mark an insight as implemented
 */
router.post('/insights/:insightId/implement', async (req, res) => {
    try {
        const strategyEvolution = getStrategyEvolution();
        await strategyEvolution.markInsightImplemented(req.params.insightId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Learning API] Failed to mark insight implemented:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark insight implemented'
        });
    }
});

export default router;

