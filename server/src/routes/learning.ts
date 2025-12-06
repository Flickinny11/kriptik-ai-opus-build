/**
 * Learning Engine Routes
 *
 * API endpoints for the Autonomous Learning Engine:
 * - Metrics and statistics
 * - Admin operations
 * - Pattern and strategy management
 */

import { Router } from 'express';
import {
    getLearningEngine,
    getPatternLibraryService,
    getStrategyEvolutionService,
    getAIJudgmentService,
    getExperienceCaptureService,
} from '../services/learning/index.js';

const router = Router();
const learningEngine = getLearningEngine();
const patternLibrary = getPatternLibraryService();
const strategyEvolution = getStrategyEvolutionService();
const aiJudgment = getAIJudgmentService();
const experienceCapture = getExperienceCaptureService();

// =============================================================================
// METRICS & DASHBOARD
// =============================================================================

/**
 * Get comprehensive flywheel metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await learningEngine.getFlywheelMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('[Learning API] Failed to get metrics:', error);
        res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
});

/**
 * Get build statistics
 */
router.get('/stats/builds', async (req, res) => {
    try {
        const stats = await experienceCapture.getBuildStatistics();
        res.json(stats);
    } catch (error) {
        console.error('[Learning API] Failed to get build stats:', error);
        res.status(500).json({ error: 'Failed to retrieve build statistics' });
    }
});

/**
 * Get judgment statistics
 */
router.get('/stats/judgments', async (req, res) => {
    try {
        const stats = await aiJudgment.getStatistics();
        res.json(stats);
    } catch (error) {
        console.error('[Learning API] Failed to get judgment stats:', error);
        res.status(500).json({ error: 'Failed to retrieve judgment statistics' });
    }
});

// =============================================================================
// PATTERNS
// =============================================================================

/**
 * Get pattern library statistics
 */
router.get('/patterns/stats', async (req, res) => {
    try {
        const stats = await patternLibrary.getStatistics();
        res.json(stats);
    } catch (error) {
        console.error('[Learning API] Failed to get pattern stats:', error);
        res.status(500).json({ error: 'Failed to retrieve pattern statistics' });
    }
});

/**
 * Search for relevant patterns
 */
router.post('/patterns/search', async (req, res) => {
    try {
        const { context, category, limit, minSuccessRate } = req.body;

        if (!context) {
            res.status(400).json({ error: 'Context is required' });
            return;
        }

        const patterns = await patternLibrary.retrievePatterns({
            context,
            category,
            limit: limit || 5,
            minSuccessRate: minSuccessRate || 60,
        });

        res.json({ patterns });
    } catch (error) {
        console.error('[Learning API] Failed to search patterns:', error);
        res.status(500).json({ error: 'Failed to search patterns' });
    }
});

/**
 * Manually trigger pattern extraction
 */
router.post('/patterns/extract', async (req, res) => {
    try {
        const { limit } = req.body;
        const extracted = await learningEngine.extractPatternsFromSuccessfulBuilds(limit || 100);
        res.json({ extracted, message: `Extracted ${extracted} patterns from successful builds` });
    } catch (error) {
        console.error('[Learning API] Failed to extract patterns:', error);
        res.status(500).json({ error: 'Failed to extract patterns' });
    }
});

/**
 * Prune unsuccessful patterns
 */
router.post('/patterns/prune', async (req, res) => {
    try {
        const { minSuccessRate } = req.body;
        const pruned = await learningEngine.prunePatterns(minSuccessRate || 40);
        res.json({ pruned, message: `Pruned ${pruned} unsuccessful patterns` });
    } catch (error) {
        console.error('[Learning API] Failed to prune patterns:', error);
        res.status(500).json({ error: 'Failed to prune patterns' });
    }
});

// =============================================================================
// STRATEGIES
// =============================================================================

/**
 * Get strategy statistics
 */
router.get('/strategies/stats', async (req, res) => {
    try {
        const stats = await strategyEvolution.getStatistics();
        res.json(stats);
    } catch (error) {
        console.error('[Learning API] Failed to get strategy stats:', error);
        res.status(500).json({ error: 'Failed to retrieve strategy statistics' });
    }
});

/**
 * Get recommended strategy for a context
 */
router.post('/strategies/recommend', async (req, res) => {
    try {
        const { domain, context, fallbackStrategy } = req.body;

        if (!domain || !context) {
            res.status(400).json({ error: 'Domain and context are required' });
            return;
        }

        const strategy = await strategyEvolution.selectStrategy({
            domain,
            context,
            fallbackStrategy,
        });

        res.json({ strategy });
    } catch (error) {
        console.error('[Learning API] Failed to recommend strategy:', error);
        res.status(500).json({ error: 'Failed to recommend strategy' });
    }
});

/**
 * Trigger strategy evolution
 */
router.post('/strategies/evolve', async (req, res) => {
    try {
        const results = await strategyEvolution.evolveStrategies();
        res.json(results);
    } catch (error) {
        console.error('[Learning API] Failed to evolve strategies:', error);
        res.status(500).json({ error: 'Failed to evolve strategies' });
    }
});

/**
 * Get curriculum for a domain
 */
router.get('/strategies/curriculum/:domain', async (req, res) => {
    try {
        const { domain } = req.params;
        const { limit } = req.query;

        const curriculum = await strategyEvolution.getCurriculum({
            domain,
            limit: limit ? parseInt(limit as string) : undefined,
        });

        res.json({ curriculum });
    } catch (error) {
        console.error('[Learning API] Failed to get curriculum:', error);
        res.status(500).json({ error: 'Failed to get curriculum' });
    }
});

// =============================================================================
// INSIGHTS
// =============================================================================

/**
 * Get pending learning insights
 */
router.get('/insights/pending', async (req, res) => {
    try {
        const insights = await learningEngine.getPendingInsights();
        res.json({ insights });
    } catch (error) {
        console.error('[Learning API] Failed to get insights:', error);
        res.status(500).json({ error: 'Failed to get insights' });
    }
});

/**
 * Action a learning insight
 */
router.post('/insights/:insightId/action', async (req, res) => {
    try {
        const { insightId } = req.params;
        await learningEngine.actionInsight(insightId);
        res.json({ success: true, message: 'Insight actioned' });
    } catch (error) {
        console.error('[Learning API] Failed to action insight:', error);
        res.status(500).json({ error: 'Failed to action insight' });
    }
});

// =============================================================================
// JUDGMENTS
// =============================================================================

/**
 * Run batch judgments
 */
router.post('/judgments/batch', async (req, res) => {
    try {
        const results = await learningEngine.runBatchJudgments();
        res.json(results);
    } catch (error) {
        console.error('[Learning API] Failed to run batch judgments:', error);
        res.status(500).json({ error: 'Failed to run batch judgments' });
    }
});

// =============================================================================
// AGENT CONTEXT
// =============================================================================

/**
 * Get enhanced context for an agent
 */
router.post('/context/agent', async (req, res) => {
    try {
        const { taskDescription, phase, agentType } = req.body;

        if (!taskDescription || !phase || !agentType) {
            res.status(400).json({ error: 'taskDescription, phase, and agentType are required' });
            return;
        }

        const context = await learningEngine.getAgentContext({
            taskDescription,
            phase,
            agentType,
        });

        res.json(context);
    } catch (error) {
        console.error('[Learning API] Failed to get agent context:', error);
        res.status(500).json({ error: 'Failed to get agent context' });
    }
});

export default router;

