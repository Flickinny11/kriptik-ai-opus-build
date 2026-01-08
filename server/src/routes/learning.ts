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
    // Component 28 v2 Enhanced Services
    getDirectRLAIF,
    getMultiJudge,
    getVisionRLAIF,
    getReflexion,
    getCrossBuildTransfer,
    getContextPriority,
    getRealtimeLearning,
    getAgentNetwork,
    getShadowModelDeployer,
} from '../services/learning/index.js';
import { getTrainingPipelineService } from '../services/learning/training-pipeline.js';
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

// =============================================================================
// TRAINING PIPELINE (Component 28 - Modal/HuggingFace Integration)
// =============================================================================

/**
 * GET /api/learning/training/status
 * Get training pipeline status
 */
router.get('/training/status', async (req, res) => {
    try {
        const pipeline = getTrainingPipelineService();
        const stats = await pipeline.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get training status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get training status'
        });
    }
});

/**
 * GET /api/learning/training/jobs
 * List all training jobs
 */
router.get('/training/jobs', async (req, res) => {
    try {
        const pipeline = getTrainingPipelineService();
        const jobs = pipeline.listJobs();
        res.json({ success: true, data: jobs });
    } catch (error) {
        console.error('[Learning API] Failed to list training jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list training jobs'
        });
    }
});

/**
 * GET /api/learning/training/jobs/:jobId
 * Get specific job status
 */
router.get('/training/jobs/:jobId', async (req, res) => {
    try {
        const pipeline = getTrainingPipelineService();
        const job = pipeline.getJobStatus(req.params.jobId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        res.json({ success: true, data: job });
    } catch (error) {
        console.error('[Learning API] Failed to get job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get job status'
        });
    }
});

/**
 * POST /api/learning/training/submit
 * Submit a new training job
 *
 * Body:
 * - modelType: 'code_specialist' | 'architecture_specialist' | 'reasoning_specialist' | 'design_specialist'
 * - preferencePairs: Array of { prompt, chosen, rejected, domain }
 * - config: Optional training config overrides
 * - priority: 'low' | 'normal' | 'high'
 */
router.post('/training/submit', async (req, res) => {
    try {
        const { modelType, preferencePairs, config, priority } = req.body;

        if (!modelType) {
            return res.status(400).json({
                success: false,
                error: 'modelType is required'
            });
        }

        if (!preferencePairs || !Array.isArray(preferencePairs) || preferencePairs.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'preferencePairs array is required'
            });
        }

        const pipeline = getTrainingPipelineService();
        const jobId = await pipeline.submitTrainingJob({
            modelType,
            preferencePairs,
            config,
            priority,
        });

        res.json({
            success: true,
            data: {
                jobId,
                message: 'Training job submitted successfully'
            }
        });
    } catch (error) {
        console.error('[Learning API] Failed to submit training job:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to submit training job'
        });
    }
});

/**
 * POST /api/learning/training/jobs/:jobId/cancel
 * Cancel a training job
 */
router.post('/training/jobs/:jobId/cancel', async (req, res) => {
    try {
        const pipeline = getTrainingPipelineService();
        const cancelled = await pipeline.cancelJob(req.params.jobId);

        if (!cancelled) {
            return res.status(404).json({
                success: false,
                error: 'Job not found or cannot be cancelled'
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Learning API] Failed to cancel job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel job'
        });
    }
});

/**
 * POST /api/learning/training/trigger
 * Trigger automatic training based on accumulated data
 * This checks if enough preference pairs have accumulated to justify training
 */
router.post('/training/trigger', async (req, res) => {
    try {
        const { modelType, minPairs = 500 } = req.body;

        if (!modelType) {
            return res.status(400).json({
                success: false,
                error: 'modelType is required'
            });
        }

        // Get unused preference pairs from AI Judgment service
        const judgment = getAIJudgmentService();

        // Filter for the model type's domain
        const domainMap: Record<string, PreferenceDomain[]> = {
            code_specialist: ['code', 'error_fix'],
            architecture_specialist: ['architecture', 'code'],
            reasoning_specialist: ['code', 'architecture', 'design', 'error_fix'],
            design_specialist: ['design'],
        };

        const relevantDomains = domainMap[modelType] || [];

        // Get unused preference pairs for each relevant domain
        const allPairs: Array<{ domain: PreferenceDomain; prompt: string; chosen: string; rejected: string }> = [];
        for (const domain of relevantDomains) {
            const pairs = await judgment.getUnusedPreferencePairs(domain, 2000);
            allPairs.push(...pairs.map((p: { domain: PreferenceDomain; prompt: string; chosen: string; rejected: string }) => ({
                domain: p.domain,
                prompt: p.prompt,
                chosen: p.chosen,
                rejected: p.rejected,
            })));
        }

        if (allPairs.length < minPairs) {
            return res.json({
                success: false,
                data: {
                    message: `Not enough data to train. Have ${allPairs.length}, need ${minPairs}`,
                    currentCount: allPairs.length,
                    required: minPairs,
                }
            });
        }

        // Submit training job
        const pipeline = getTrainingPipelineService();
        const jobId = await pipeline.submitTrainingJob({
            modelType,
            preferencePairs: allPairs as any, // Convert to full PreferencePair format
        });

        res.json({
            success: true,
            data: {
                jobId,
                pairsUsed: allPairs.length,
                message: `Training job ${jobId} submitted with ${allPairs.length} preference pairs`
            }
        });
    } catch (error) {
        console.error('[Learning API] Failed to trigger training:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to trigger training'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - DIRECT RLAIF
// =============================================================================

/**
 * POST /api/learning/direct-rlaif/evaluate
 * Get direct reward score for an artifact
 */
router.post('/direct-rlaif/evaluate', async (req, res) => {
    try {
        const { category, artifact, context } = req.body;
        if (!category || !artifact) {
            return res.status(400).json({
                success: false,
                error: 'category and artifact are required'
            });
        }

        const directRLAIF = getDirectRLAIF();
        const result = await directRLAIF.getDirectReward(category, artifact, context);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Direct-RLAIF evaluation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to evaluate artifact'
        });
    }
});

/**
 * POST /api/learning/direct-rlaif/batch
 * Batch evaluate multiple artifacts
 */
router.post('/direct-rlaif/batch', async (req, res) => {
    try {
        const { category, prompt, artifacts, context } = req.body;
        if (!category || !prompt || !Array.isArray(artifacts)) {
            return res.status(400).json({
                success: false,
                error: 'category, prompt, and artifacts array are required'
            });
        }

        const directRLAIF = getDirectRLAIF();
        const results = await directRLAIF.batchEvaluate(category, prompt, artifacts, context);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('[Learning API] Direct-RLAIF batch evaluation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to batch evaluate artifacts'
        });
    }
});

/**
 * GET /api/learning/direct-rlaif/stats
 * Get Direct-RLAIF statistics
 */
router.get('/direct-rlaif/stats', async (req, res) => {
    try {
        const directRLAIF = getDirectRLAIF();
        const stats = await directRLAIF.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get Direct-RLAIF stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Direct-RLAIF stats'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - MULTI-JUDGE CONSENSUS
// =============================================================================

/**
 * POST /api/learning/multi-judge/evaluate
 * Evaluate artifact with multiple judges
 */
router.post('/multi-judge/evaluate', async (req, res) => {
    try {
        const { category, artifact, context } = req.body;
        if (!category || !artifact) {
            return res.status(400).json({
                success: false,
                error: 'category and artifact are required'
            });
        }

        const multiJudge = getMultiJudge();
        const result = await multiJudge.evaluateWithConsensus(category, artifact, context);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Multi-judge evaluation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to evaluate with multi-judge'
        });
    }
});

/**
 * GET /api/learning/multi-judge/stats
 * Get Multi-Judge statistics
 */
router.get('/multi-judge/stats', async (req, res) => {
    try {
        const multiJudge = getMultiJudge();
        const stats = await multiJudge.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get multi-judge stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get multi-judge stats'
        });
    }
});

/**
 * GET /api/learning/multi-judge/recent
 * Get recent consensus records
 */
router.get('/multi-judge/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const multiJudge = getMultiJudge();
        const consensus = await multiJudge.getRecentConsensus(limit);
        res.json({ success: true, data: consensus });
    } catch (error) {
        console.error('[Learning API] Failed to get recent consensus:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get recent consensus'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - VISION RLAIF
// =============================================================================

/**
 * POST /api/learning/vision/evaluate
 * Evaluate a screenshot for Anti-Slop
 */
router.post('/vision/evaluate', async (req, res) => {
    try {
        const { imageSource, context } = req.body;
        if (!imageSource) {
            return res.status(400).json({
                success: false,
                error: 'imageSource is required (base64, URL, or file path)'
            });
        }

        const visionRLAIF = getVisionRLAIF();
        const result = await visionRLAIF.evaluateScreenshot(imageSource, context);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Vision evaluation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to evaluate screenshot'
        });
    }
});

/**
 * POST /api/learning/vision/compare
 * Compare two designs
 */
router.post('/vision/compare', async (req, res) => {
    try {
        const { imageA, imageB, context } = req.body;
        if (!imageA || !imageB) {
            return res.status(400).json({
                success: false,
                error: 'imageA and imageB are required'
            });
        }

        const visionRLAIF = getVisionRLAIF();
        const result = await visionRLAIF.compareDesigns(imageA, imageB, context);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Vision comparison failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to compare designs'
        });
    }
});

/**
 * GET /api/learning/vision/stats
 * Get Vision RLAIF statistics
 */
router.get('/vision/stats', async (req, res) => {
    try {
        const visionRLAIF = getVisionRLAIF();
        const stats = await visionRLAIF.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get vision stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get vision stats'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - REFLEXION
// =============================================================================

/**
 * POST /api/learning/reflexion/failure
 * Generate reflection from a failure
 */
router.post('/reflexion/failure', async (req, res) => {
    try {
        const { task, failedAttempt, error, resolution, context } = req.body;
        if (!task || !failedAttempt || !error) {
            return res.status(400).json({
                success: false,
                error: 'task, failedAttempt, and error are required'
            });
        }

        const reflexion = getReflexion();
        const note = await reflexion.reflectOnFailure(task, failedAttempt, error, resolution, context);
        res.json({ success: true, data: note });
    } catch (error) {
        console.error('[Learning API] Reflexion failure analysis failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate failure reflection'
        });
    }
});

/**
 * POST /api/learning/reflexion/auto-reflect
 * Auto-reflect on recent error recoveries
 */
router.post('/reflexion/auto-reflect', async (req, res) => {
    try {
        const { limit = 10 } = req.body;

        const reflexion = getReflexion();
        const notes = await reflexion.reflectOnRecentErrors(limit);
        res.json({ success: true, data: notes, count: notes.length });
    } catch (error) {
        console.error('[Learning API] Auto-reflection failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to auto-reflect on recent errors'
        });
    }
});

/**
 * GET /api/learning/reflexion/relevant
 * Get relevant reflection notes for a task
 */
router.get('/reflexion/relevant', async (req, res) => {
    try {
        const task = req.query.task as string;
        if (!task) {
            return res.status(400).json({
                success: false,
                error: 'task query parameter is required'
            });
        }

        const reflexion = getReflexion();
        const notes = await reflexion.getRelevantNotes(task, {
            phase: req.query.phase as string,
            errorType: req.query.errorType as string,
        });
        res.json({ success: true, data: notes });
    } catch (error) {
        console.error('[Learning API] Failed to get relevant notes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get relevant reflection notes'
        });
    }
});

/**
 * GET /api/learning/reflexion/stats
 * Get Reflexion statistics
 */
router.get('/reflexion/stats', async (req, res) => {
    try {
        const reflexion = getReflexion();
        const stats = await reflexion.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get reflexion stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get reflexion stats'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - CROSS-BUILD TRANSFER
// =============================================================================

/**
 * POST /api/learning/cross-build/link
 * Create a knowledge link between builds
 */
router.post('/cross-build/link', async (req, res) => {
    try {
        const { sourceBuildId, targetBuildId, linkType, metadata } = req.body;
        if (!sourceBuildId || !targetBuildId || !linkType) {
            return res.status(400).json({
                success: false,
                error: 'sourceBuildId, targetBuildId, and linkType are required'
            });
        }

        const crossBuild = getCrossBuildTransfer();
        const link = await crossBuild.createLink(sourceBuildId, targetBuildId, linkType, metadata);
        res.json({ success: true, data: link });
    } catch (error) {
        console.error('[Learning API] Cross-build link creation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create cross-build link'
        });
    }
});

/**
 * POST /api/learning/cross-build/transfer
 * Transfer patterns to a target build
 */
router.post('/cross-build/transfer', async (req, res) => {
    try {
        const { targetBuildId } = req.body;
        if (!targetBuildId) {
            return res.status(400).json({
                success: false,
                error: 'targetBuildId is required'
            });
        }

        const crossBuild = getCrossBuildTransfer();
        const result = await crossBuild.transferPatterns(targetBuildId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Cross-build transfer failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to transfer patterns'
        });
    }
});

/**
 * GET /api/learning/cross-build/graph/:buildId
 * Get knowledge graph around a build
 */
router.get('/cross-build/graph/:buildId', async (req, res) => {
    try {
        const depth = parseInt(req.query.depth as string) || 2;
        const crossBuild = getCrossBuildTransfer();
        const graph = await crossBuild.getKnowledgeGraph(req.params.buildId, depth);
        res.json({ success: true, data: graph });
    } catch (error) {
        console.error('[Learning API] Failed to get knowledge graph:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get knowledge graph'
        });
    }
});

/**
 * GET /api/learning/cross-build/stats
 * Get Cross-Build Transfer statistics
 */
router.get('/cross-build/stats', async (req, res) => {
    try {
        const crossBuild = getCrossBuildTransfer();
        const stats = await crossBuild.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get cross-build stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cross-build stats'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - CONTEXT PRIORITY
// =============================================================================

/**
 * GET /api/learning/context-priority/weights/:taskCategory
 * Get context weights for a task category
 */
router.get('/context-priority/weights/:taskCategory', async (req, res) => {
    try {
        const contextPriority = await getContextPriority();
        const weights = contextPriority.getWeights(req.params.taskCategory as any);
        res.json({ success: true, data: weights });
    } catch (error) {
        console.error('[Learning API] Failed to get context weights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get context weights'
        });
    }
});

/**
 * GET /api/learning/context-priority/order/:taskCategory
 * Get recommended context retrieval order
 */
router.get('/context-priority/order/:taskCategory', async (req, res) => {
    try {
        const tokenBudget = parseInt(req.query.tokenBudget as string) || 8000;
        const contextPriority = await getContextPriority();
        const order = contextPriority.getContextRetrievalOrder(req.params.taskCategory as any, tokenBudget);
        res.json({ success: true, data: order });
    } catch (error) {
        console.error('[Learning API] Failed to get context order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get context order'
        });
    }
});

/**
 * POST /api/learning/context-priority/outcome
 * Record context usage outcome
 */
router.post('/context-priority/outcome', async (req, res) => {
    try {
        const { taskId, taskCategory, outcome } = req.body;
        if (!taskId || !taskCategory || !outcome) {
            return res.status(400).json({
                success: false,
                error: 'taskId, taskCategory, and outcome are required'
            });
        }

        const contextPriority = await getContextPriority();
        await contextPriority.recordOutcome(taskId, taskCategory, outcome);
        res.json({ success: true });
    } catch (error) {
        console.error('[Learning API] Failed to record context outcome:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record context outcome'
        });
    }
});

/**
 * GET /api/learning/context-priority/stats
 * Get Context Priority statistics
 */
router.get('/context-priority/stats', async (req, res) => {
    try {
        const contextPriority = await getContextPriority();
        const stats = await contextPriority.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get context priority stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get context priority stats'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - REAL-TIME LEARNING
// =============================================================================

/**
 * POST /api/learning/realtime/event
 * Capture a real-time learning event
 */
router.post('/realtime/event', async (req, res) => {
    try {
        const { eventType, buildSessionId, data, metadata } = req.body;
        if (!eventType || !buildSessionId || !data) {
            return res.status(400).json({
                success: false,
                error: 'eventType, buildSessionId, and data are required'
            });
        }

        const realtimeLearning = getRealtimeLearning();
        const event = await realtimeLearning.captureEvent(eventType, buildSessionId, data, metadata);
        res.json({ success: true, data: event });
    } catch (error) {
        console.error('[Learning API] Failed to capture realtime event:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to capture realtime event'
        });
    }
});

/**
 * GET /api/learning/realtime/session/:buildSessionId
 * Get aggregated events for a session
 */
router.get('/realtime/session/:buildSessionId', async (req, res) => {
    try {
        const realtimeLearning = getRealtimeLearning();
        const aggregation = await realtimeLearning.getSessionAggregation(req.params.buildSessionId);
        res.json({ success: true, data: aggregation });
    } catch (error) {
        console.error('[Learning API] Failed to get session aggregation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session aggregation'
        });
    }
});

/**
 * GET /api/learning/realtime/velocity/:buildSessionId
 * Get learning velocity for a session
 */
router.get('/realtime/velocity/:buildSessionId', async (req, res) => {
    try {
        const realtimeLearning = getRealtimeLearning();
        const velocity = await realtimeLearning.getLearningVelocity(req.params.buildSessionId);
        res.json({ success: true, data: velocity });
    } catch (error) {
        console.error('[Learning API] Failed to get learning velocity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get learning velocity'
        });
    }
});

/**
 * GET /api/learning/realtime/stats
 * Get Real-Time Learning statistics
 */
router.get('/realtime/stats', async (req, res) => {
    try {
        const realtimeLearning = getRealtimeLearning();
        const stats = await realtimeLearning.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get realtime stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get realtime stats'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - AGENT NETWORK
// =============================================================================

/**
 * POST /api/learning/agent-network/register
 * Register an agent with the network
 */
router.post('/agent-network/register', async (req, res) => {
    try {
        const { agentId, buildSessionId, options } = req.body;
        if (!agentId || !buildSessionId) {
            return res.status(400).json({
                success: false,
                error: 'agentId and buildSessionId are required'
            });
        }

        const agentNetwork = getAgentNetwork();
        agentNetwork.registerAgent(agentId, buildSessionId, options);
        res.json({ success: true });
    } catch (error) {
        console.error('[Learning API] Failed to register agent:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register agent'
        });
    }
});

/**
 * POST /api/learning/agent-network/broadcast
 * Broadcast a discovery to the network
 */
router.post('/agent-network/broadcast', async (req, res) => {
    try {
        const { sourceAgentId, discovery } = req.body;
        if (!sourceAgentId || !discovery) {
            return res.status(400).json({
                success: false,
                error: 'sourceAgentId and discovery are required'
            });
        }

        const agentNetwork = getAgentNetwork();
        const result = await agentNetwork.broadcastDiscovery(sourceAgentId, discovery);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Failed to broadcast discovery:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to broadcast discovery'
        });
    }
});

/**
 * GET /api/learning/agent-network/insights/:buildSessionId
 * Get network insights for a build
 */
router.get('/agent-network/insights/:buildSessionId', async (req, res) => {
    try {
        const agentNetwork = getAgentNetwork();
        const insights = await agentNetwork.getNetworkInsights(req.params.buildSessionId);
        res.json({ success: true, data: insights });
    } catch (error) {
        console.error('[Learning API] Failed to get network insights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get network insights'
        });
    }
});

/**
 * GET /api/learning/agent-network/state
 * Get current network state
 */
router.get('/agent-network/state', async (req, res) => {
    try {
        const agentNetwork = getAgentNetwork();
        const state = agentNetwork.getNetworkState();
        res.json({ success: true, data: state });
    } catch (error) {
        console.error('[Learning API] Failed to get network state:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get network state'
        });
    }
});

// =============================================================================
// COMPONENT 28 V2 - SHADOW MODEL DEPLOYER
// =============================================================================

/**
 * POST /api/learning/deployer/check
 * Check and deploy eligible shadow models
 */
router.post('/deployer/check', async (req, res) => {
    try {
        const deployer = getShadowModelDeployer();
        const result = await deployer.checkAndDeployEligible();
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Failed to check deployments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check deployments'
        });
    }
});

/**
 * POST /api/learning/deployer/deploy
 * Deploy a specific model
 */
router.post('/deployer/deploy', async (req, res) => {
    try {
        const { shadowModelId, modelType, version, provider, modelPath } = req.body;
        if (!shadowModelId || !modelType || !version || !provider) {
            return res.status(400).json({
                success: false,
                error: 'shadowModelId, modelType, version, and provider are required'
            });
        }

        const deployer = getShadowModelDeployer();
        const deployment = await deployer.deployModel(shadowModelId, modelType, version, provider, modelPath);
        res.json({ success: true, data: deployment });
    } catch (error) {
        console.error('[Learning API] Failed to deploy model:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deploy model'
        });
    }
});

/**
 * GET /api/learning/deployer/active
 * Get active deployments
 */
router.get('/deployer/active', async (req, res) => {
    try {
        const deployer = getShadowModelDeployer();
        const deployments = await deployer.getActiveDeployments();
        res.json({ success: true, data: deployments });
    } catch (error) {
        console.error('[Learning API] Failed to get active deployments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get active deployments'
        });
    }
});

/**
 * GET /api/learning/deployer/stats
 * Get deployer statistics
 */
router.get('/deployer/stats', async (req, res) => {
    try {
        const deployer = getShadowModelDeployer();
        const stats = await deployer.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Learning API] Failed to get deployer stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get deployer stats'
        });
    }
});

// =============================================================================
// REAL-TIME DASHBOARD (Comprehensive "Wow" Endpoint)
// =============================================================================

/**
 * GET /api/learning/dashboard
 * Get comprehensive learning dashboard data in one call
 *
 * Returns everything needed for a real-time learning dashboard:
 * - System health
 * - Improvement metrics
 * - Training status
 * - Pattern/strategy counts
 * - Active learning signals
 */
router.get('/dashboard', async (req, res) => {
    try {
        const flywheel = getEvolutionFlywheel();
        const patternLibrary = getPatternLibrary();
        const strategyEvolution = getStrategyEvolution();
        const pipeline = getTrainingPipelineService();
        const registry = getShadowModelRegistry();
        const judgment = getAIJudgmentService();

        // Gather all metrics in parallel for speed
        const [
            systemStatus,
            improvementTrend,
            patternStats,
            strategyStats,
            trainingStats,
            modelStats,
            recentInsights,
        ] = await Promise.all([
            flywheel.getSystemStatus(),
            flywheel.getImprovementTrend(10),
            patternLibrary.getPatternStats(),
            strategyEvolution.getStrategyStats(),
            pipeline.getStats(),
            registry.getRegistryStats(),
            strategyEvolution.getRecentInsights(5),
        ]);

        // Calculate overall system health score (0-100)
        const healthFactors = [
            systemStatus.pairStats.total > 0 ? Math.min(systemStatus.pairStats.total / 100, 1) * 25 : 0,
            patternStats.total > 0 ? Math.min(patternStats.total / 50, 1) * 25 : 0,
            systemStatus.overallImprovement > 0 ? Math.min(systemStatus.overallImprovement / 0.5, 1) * 25 : 0,
            modelStats.totalModels > 0 ? 25 : 0,
        ];
        const healthScore = Math.round(healthFactors.reduce((a, b) => a + b, 0));

        // Build dashboard response
        const dashboard = {
            // System Health
            health: {
                score: healthScore,
                status: healthScore >= 75 ? 'excellent' : healthScore >= 50 ? 'good' : healthScore >= 25 ? 'learning' : 'initializing',
                lastCycle: systemStatus.lastCycle?.completedAt || null,
                cycleCount: systemStatus.totalCycles,
            },

            // Learning Progress
            progress: {
                overallImprovement: Math.round(systemStatus.overallImprovement * 100) / 100,
                firstAttemptSuccess: systemStatus.totalCycles > 0
                    ? Math.round((patternStats.avgSuccessRate || 0)) + '%'
                    : 'N/A',
                trend: improvementTrend.map(t => ({
                    cycle: t.cycleNumber,
                    improvement: Math.round(t.improvement * 100) / 100,
                    date: t.date,
                })),
            },

            // Pattern Library
            patterns: {
                total: patternStats.total,
                byCategory: patternStats.byCategory,
                avgSuccessRate: Math.round(patternStats.avgSuccessRate),
                topPatterns: patternStats.mostUsed.slice(0, 3).map(p => p.name),
            },

            // Strategies
            strategies: {
                total: strategyStats.total,
                byDomain: strategyStats.byDomain,
                experimental: strategyStats.experimental,
            },

            // Training Status
            training: {
                activeJobs: trainingStats.activeJobs,
                queuedJobs: trainingStats.queuedJobs,
                completedJobs: trainingStats.completedJobs,
                totalCost: Math.round(trainingStats.totalCost * 100) / 100,
                avgTrainingTime: Math.round(trainingStats.avgTrainingTime / 60) + 'm',
            },

            // Shadow Models
            models: {
                total: modelStats.totalModels,
                ready: modelStats.activeModels || 0,
                promoted: modelStats.activeModels || 0,
                training: modelStats.pendingRuns || 0,
            },

            // Data Pipeline
            data: {
                preferencePairs: {
                    total: systemStatus.pairStats.total,
                    unused: systemStatus.pairStats.unused,
                    usedInTraining: Math.max(0, systemStatus.pairStats.total - systemStatus.pairStats.unused),
                },
                readyForTraining: systemStatus.pairStats.unused >= 100,
            },

            // Recent Activity
            activity: {
                insights: recentInsights.slice(0, 5).map(i => ({
                    category: i.category,
                    title: i.observation,
                    impact: i.expectedImpact,
                    implemented: i.implemented,
                })),
            },

            // Quick Actions
            actions: {
                canTrain: systemStatus.pairStats.unused >= 100,
                canRunCycle: !systemStatus.isRunning,
                recommendedAction: systemStatus.pairStats.unused >= 100
                    ? 'Train shadow models with accumulated data'
                    : systemStatus.pairStats.total < 50
                    ? 'Run more builds to collect learning data'
                    : 'System is learning normally',
            },
        };

        res.json({ success: true, data: dashboard });
    } catch (error) {
        console.error('[Learning API] Failed to get dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get learning dashboard'
        });
    }
});

/**
 * POST /api/learning/command
 * CLI-style command endpoint for advanced operations
 *
 * Commands:
 * - train:code - Train code specialist model
 * - train:design - Train design specialist model
 * - cycle:run - Run evolution cycle
 * - patterns:export - Export pattern library
 * - status - Get full status
 */
router.post('/command', async (req, res) => {
    try {
        const { command, args = {} } = req.body;
        const userId = args.userId || 'system';

        if (!command) {
            return res.status(400).json({
                success: false,
                error: 'command is required'
            });
        }

        const [action, target] = command.split(':');
        let result: any = {};

        switch (action) {
            case 'train': {
                const modelTypeMap: Record<string, any> = {
                    code: 'code_specialist',
                    design: 'design_specialist',
                    arch: 'architecture_specialist',
                    reasoning: 'reasoning_specialist',
                };
                const modelType = modelTypeMap[target];
                if (!modelType) {
                    return res.status(400).json({
                        success: false,
                        error: `Unknown model type: ${target}. Use: code, design, arch, reasoning`
                    });
                }

                const pipeline = getTrainingPipelineService();
                const judgment = getAIJudgmentService();

                // Get preference pairs
                const pairs = await judgment.getUnusedPreferencePairs('code', 500);
                if (pairs.length < 50) {
                    return res.json({
                        success: false,
                        message: `Not enough training data: ${pairs.length} pairs (need 50+)`
                    });
                }

                const jobId = await pipeline.submitTrainingJob({
                    modelType,
                    preferencePairs: pairs as any,
                    priority: args.priority || 'normal',
                });

                result = {
                    message: `Training job submitted: ${jobId}`,
                    jobId,
                    dataPoints: pairs.length,
                };
                break;
            }

            case 'cycle': {
                if (target === 'run') {
                    const flywheel = getEvolutionFlywheel();
                    const cycle = await flywheel.runCycle(userId);
                    result = {
                        message: 'Evolution cycle completed',
                        cycleId: cycle.cycleId,
                        improvement: cycle.improvementPercent,
                    };
                }
                break;
            }

            case 'patterns': {
                if (target === 'export') {
                    const patternLibrary = getPatternLibrary();
                    const patterns = await patternLibrary.getTopPatterns(100);
                    result = {
                        message: `Exported ${patterns.length} patterns`,
                        patterns: patterns.map(p => ({
                            name: p.name,
                            problem: p.problem,
                            solution: p.solutionTemplate,
                            successRate: p.successRate,
                        })),
                    };
                }
                break;
            }

            case 'status': {
                const flywheel = getEvolutionFlywheel();
                result = await flywheel.getSystemStatus();
                break;
            }

            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown command: ${command}. Available: train:code, train:design, cycle:run, patterns:export, status`
                });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Learning API] Command failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Command execution failed'
        });
    }
});

export default router;

