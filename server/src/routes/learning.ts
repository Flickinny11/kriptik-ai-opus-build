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
                cycleCount: systemStatus.cycleStats.total,
            },

            // Learning Progress
            progress: {
                overallImprovement: Math.round(systemStatus.overallImprovement * 100) / 100,
                firstAttemptSuccess: systemStatus.cycleStats.total > 0
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
                ready: modelStats.readyModels || 0,
                promoted: modelStats.promotedModels || 0,
                training: modelStats.trainingModels || 0,
            },

            // Data Pipeline
            data: {
                preferencePairs: {
                    total: systemStatus.pairStats.total,
                    unused: systemStatus.pairStats.unused,
                    usedInTraining: systemStatus.pairStats.used,
                },
                readyForTraining: systemStatus.pairStats.unused >= 100,
            },

            // Recent Activity
            activity: {
                insights: recentInsights.slice(0, 5).map(i => ({
                    category: i.category,
                    title: i.title,
                    impact: i.impact,
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
                        improvement: cycle.metrics?.improvement,
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

