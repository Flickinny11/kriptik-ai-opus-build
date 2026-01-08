/**
 * Continuous Learning Engine API Routes
 *
 * REST API endpoints for the meta-integration layer.
 */

import { Router } from 'express';

import {
  getContinuousLearningEngine,
  getBillingLearningBridge,
  getVectorContextProvider,
  getHyperThinkingIntegrator,
  getModelDeploymentPipeline,
  getUnifiedMetricsCollector,
  getLearningFeedbackLoop,
  getAutoOptimizationSystem,
  getProductionHealthMonitor,
} from '../services/continuous-learning/index.js';

import type {
  SessionType,
  SessionOutcome,
  ImplicitAction,
} from '../services/continuous-learning/types.js';

const router = Router();

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * POST /api/continuous-learning/session/start
 * Start a learning session
 */
router.post('/session/start', async (req, res) => {
  try {
    const { userId, projectId, taskType, complexity, qualityRequirement, budgetLimit } = req.body;

    if (!userId || !taskType) {
      return res.status(400).json({ success: false, error: 'userId and taskType are required' });
    }

    const engine = await getContinuousLearningEngine();
    const session = await engine.startSession({
      userId,
      projectId,
      taskType: taskType as SessionType,
      complexity,
      qualityRequirement,
      budgetLimit,
    });
    return res.json({ success: true, session });
  } catch (error) {
    console.error('[ContinuousLearning] Error starting session:', error);
    return res.status(500).json({ success: false, error: 'Failed to start session' });
  }
});

/**
 * POST /api/continuous-learning/session/end
 * End a learning session
 */
router.post('/session/end', async (req, res) => {
  try {
    const { sessionId, outcome, cost, isSignificant } = req.body;

    if (!sessionId || outcome === undefined) {
      return res.status(400).json({ success: false, error: 'sessionId and outcome are required' });
    }

    const engine = await getContinuousLearningEngine();
    await engine.endSession(sessionId, {
      success: outcome === 'success',
      cost,
      isSignificant,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[ContinuousLearning] Error ending session:', error);
    return res.status(500).json({ success: false, error: 'Failed to end session' });
  }
});

/**
 * GET /api/continuous-learning/metrics
 * Get real-time metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const engine = await getContinuousLearningEngine();
    const metrics = await engine.getRealtimeMetrics();
    return res.json({ success: true, metrics });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting metrics:', error);
    return res.status(500).json({ success: false, error: 'Failed to get metrics' });
  }
});

// =============================================================================
// BILLING-LEARNING BRIDGE
// =============================================================================

/**
 * POST /api/continuous-learning/billing/select-model
 * Select optimal model for a task
 */
router.post('/billing/select-model', async (req, res) => {
  try {
    const { taskType, complexity, qualityRequirement, budgetLimit } = req.body;

    if (!taskType || complexity === undefined) {
      return res.status(400).json({ success: false, error: 'taskType and complexity are required' });
    }

    const bridge = await getBillingLearningBridge();
    const model = await bridge.selectOptimalModel({
      type: taskType,
      complexity,
      qualityRequirement,
      budgetLimit,
    });
    return res.json({ success: true, model });
  } catch (error) {
    console.error('[ContinuousLearning] Error selecting model:', error);
    return res.status(500).json({ success: false, error: 'Failed to select model' });
  }
});

/**
 * GET /api/continuous-learning/billing/insights/:userId
 * Get billing-learning insights
 */
router.get('/billing/insights/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const bridge = await getBillingLearningBridge();
    const insights = await bridge.getBillingLearningInsights(userId);
    return res.json({ success: true, insights });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting insights:', error);
    return res.status(500).json({ success: false, error: 'Failed to get insights' });
  }
});

/**
 * GET /api/continuous-learning/billing/roi
 * Calculate learning ROI
 */
router.get('/billing/roi', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'current_month';
    const bridge = await getBillingLearningBridge();
    const roi = await bridge.calculateLearningROI(period);
    return res.json({ success: true, roi });
  } catch (error) {
    console.error('[ContinuousLearning] Error calculating ROI:', error);
    return res.status(500).json({ success: false, error: 'Failed to calculate ROI' });
  }
});

// =============================================================================
// VECTOR CONTEXT
// =============================================================================

/**
 * POST /api/continuous-learning/context/get
 * Get unified context for a task
 */
router.post('/context/get', async (req, res) => {
  try {
    const { task, config } = req.body;

    if (!task || !config) {
      return res.status(400).json({ success: false, error: 'task and config are required' });
    }

    const provider = await getVectorContextProvider();
    const context = await provider.getContextForTask(task, config);
    return res.json({ success: true, context });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting context:', error);
    return res.status(500).json({ success: false, error: 'Failed to get context' });
  }
});

/**
 * POST /api/continuous-learning/context/error
 * Get error resolution context
 */
router.post('/context/error', async (req, res) => {
  try {
    const { error: errorInfo, buildContext } = req.body;

    if (!errorInfo || !buildContext) {
      return res.status(400).json({ success: false, error: 'error and buildContext are required' });
    }

    const provider = await getVectorContextProvider();
    const context = await provider.getErrorContext(errorInfo, buildContext);
    return res.json({ success: true, context });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting error context:', error);
    return res.status(500).json({ success: false, error: 'Failed to get error context' });
  }
});

// =============================================================================
// HYPER-THINKING
// =============================================================================

/**
 * POST /api/continuous-learning/thinking/assess-complexity
 * Assess task complexity
 */
router.post('/thinking/assess-complexity', async (req, res) => {
  try {
    const task = req.body;

    if (!task.description || !task.type || !task.phase) {
      return res.status(400).json({ success: false, error: 'description, type, and phase are required' });
    }

    const integrator = await getHyperThinkingIntegrator();
    const assessment = await integrator.assessComplexity(task);
    return res.json({ success: true, assessment });
  } catch (error) {
    console.error('[ContinuousLearning] Error assessing complexity:', error);
    return res.status(500).json({ success: false, error: 'Failed to assess complexity' });
  }
});

/**
 * POST /api/continuous-learning/thinking/tot
 * Apply Tree-of-Thought reasoning
 */
router.post('/thinking/tot', async (req, res) => {
  try {
    const { prompt, context, config } = req.body;

    if (!prompt || !context) {
      return res.status(400).json({ success: false, error: 'prompt and context are required' });
    }

    const integrator = await getHyperThinkingIntegrator();
    const result = await integrator.applyTreeOfThought(prompt, context, config);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('[ContinuousLearning] Error applying ToT:', error);
    return res.status(500).json({ success: false, error: 'Failed to apply ToT' });
  }
});

/**
 * POST /api/continuous-learning/thinking/mars
 * Apply MARS error resolution
 */
router.post('/thinking/mars', async (req, res) => {
  try {
    const { error, buildContext } = req.body;

    if (!error || !buildContext) {
      return res.status(400).json({ success: false, error: 'error and buildContext are required' });
    }

    const integrator = await getHyperThinkingIntegrator();
    const result = await integrator.applyMARSForErrors(error, buildContext);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('[ContinuousLearning] Error applying MARS:', error);
    return res.status(500).json({ success: false, error: 'Failed to apply MARS' });
  }
});

/**
 * GET /api/continuous-learning/thinking/history
 * Get thinking session history
 */
router.get('/thinking/history', async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || '20');
    const integrator = await getHyperThinkingIntegrator();
    const history = await integrator.getSessionHistory(limit);
    return res.json({ success: true, history });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting thinking history:', error);
    return res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

// =============================================================================
// MODEL DEPLOYMENT
// =============================================================================

/**
 * POST /api/continuous-learning/deployment/start
 * Deploy a model for testing
 */
router.post('/deployment/start', async (req, res) => {
  try {
    const { modelName, modelVersion, trafficPercentage, baselineModel } = req.body;

    if (!modelName || !modelVersion) {
      return res.status(400).json({ success: false, error: 'modelName and modelVersion are required' });
    }

    const pipeline = await getModelDeploymentPipeline();
    const deployment = await pipeline.deployForTesting({
      modelName,
      modelVersion,
      trafficPercentage,
      baselineModel,
    });
    return res.json({ success: true, deployment });
  } catch (error) {
    console.error('[ContinuousLearning] Error starting deployment:', error);
    return res.status(500).json({ success: false, error: 'Failed to start deployment' });
  }
});

/**
 * POST /api/continuous-learning/deployment/record-result
 * Record request result for A/B testing
 */
router.post('/deployment/record-result', async (req, res) => {
  try {
    const result = req.body;

    if (!result.deploymentId || result.isTestModel === undefined || result.success === undefined || result.latency === undefined) {
      return res.status(400).json({ success: false, error: 'deploymentId, isTestModel, success, and latency are required' });
    }

    const pipeline = await getModelDeploymentPipeline();
    await pipeline.recordRequestResult(result);
    return res.json({ success: true });
  } catch (error) {
    console.error('[ContinuousLearning] Error recording result:', error);
    return res.status(500).json({ success: false, error: 'Failed to record result' });
  }
});

/**
 * GET /api/continuous-learning/deployment/active
 * Get active deployments
 */
router.get('/deployment/active', async (req, res) => {
  try {
    const pipeline = await getModelDeploymentPipeline();
    const deployments = pipeline.getActiveDeployments();
    return res.json({ success: true, deployments });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting deployments:', error);
    return res.status(500).json({ success: false, error: 'Failed to get deployments' });
  }
});

/**
 * POST /api/continuous-learning/deployment/route
 * Route a request to appropriate model
 */
router.post('/deployment/route', async (req, res) => {
  try {
    const { modelType } = req.body;

    if (!modelType) {
      return res.status(400).json({ success: false, error: 'modelType is required' });
    }

    const pipeline = await getModelDeploymentPipeline();
    const routing = pipeline.routeRequest(modelType);
    return res.json({ success: true, routing });
  } catch (error) {
    console.error('[ContinuousLearning] Error routing request:', error);
    return res.status(500).json({ success: false, error: 'Failed to route request' });
  }
});

/**
 * GET /api/continuous-learning/deployment/stats
 * Get deployment stats
 */
router.get('/deployment/stats', async (req, res) => {
  try {
    const pipeline = await getModelDeploymentPipeline();
    const stats = await pipeline.getStats();
    return res.json({ success: true, stats });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting deployment stats:', error);
    return res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// =============================================================================
// FEEDBACK LOOP
// =============================================================================

/**
 * POST /api/continuous-learning/feedback/action
 * Record implicit feedback (user action)
 */
router.post('/feedback/action', async (req, res) => {
  try {
    const { action, context } = req.body;

    if (!action || !context?.userId) {
      return res.status(400).json({ success: false, error: 'action and context.userId are required' });
    }

    const feedbackLoop = getLearningFeedbackLoop();
    await feedbackLoop.onUserAction(action as ImplicitAction, context);
    return res.json({ success: true });
  } catch (error) {
    console.error('[ContinuousLearning] Error recording action:', error);
    return res.status(500).json({ success: false, error: 'Failed to record action' });
  }
});

/**
 * POST /api/continuous-learning/feedback/explicit
 * Collect explicit feedback
 */
router.post('/feedback/explicit', async (req, res) => {
  try {
    const { buildId, userId, rating, comment, context } = req.body;

    if (!buildId || !userId || !rating) {
      return res.status(400).json({ success: false, error: 'buildId, userId, and rating are required' });
    }

    const feedbackLoop = getLearningFeedbackLoop();
    await feedbackLoop.collectExplicitFeedback(buildId, userId, rating, comment, context);
    return res.json({ success: true });
  } catch (error) {
    console.error('[ContinuousLearning] Error collecting feedback:', error);
    return res.status(500).json({ success: false, error: 'Failed to collect feedback' });
  }
});

/**
 * GET /api/continuous-learning/feedback/stats
 * Get feedback statistics
 */
router.get('/feedback/stats', async (req, res) => {
  try {
    const period = (req.query.period as string) || '7d';
    const feedbackLoop = getLearningFeedbackLoop();
    const stats = await feedbackLoop.getFeedbackStats(period);
    return res.json({ success: true, stats });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting feedback stats:', error);
    return res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// =============================================================================
// AUTO-OPTIMIZATION
// =============================================================================

/**
 * GET /api/continuous-learning/optimization/params
 * Get all parameters
 */
router.get('/optimization/params', async (req, res) => {
  try {
    const system = await getAutoOptimizationSystem();
    const params = system.getAllParameters();
    return res.json({ success: true, params });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting params:', error);
    return res.status(500).json({ success: false, error: 'Failed to get params' });
  }
});

/**
 * POST /api/continuous-learning/optimization/register
 * Register a new parameter
 */
router.post('/optimization/register', async (req, res) => {
  try {
    const config = req.body;

    if (!config.name || config.defaultValue === undefined || config.minValue === undefined || config.maxValue === undefined) {
      return res.status(400).json({ success: false, error: 'name, defaultValue, minValue, and maxValue are required' });
    }

    const system = await getAutoOptimizationSystem();
    await system.registerParameter(config.name, config);
    return res.json({ success: true });
  } catch (error) {
    console.error('[ContinuousLearning] Error registering param:', error);
    return res.status(500).json({ success: false, error: 'Failed to register param' });
  }
});

/**
 * POST /api/continuous-learning/optimization/evaluate
 * Evaluate parameter change
 */
router.post('/optimization/evaluate', async (req, res) => {
  try {
    const { paramName, newValue } = req.body;

    if (!paramName || newValue === undefined) {
      return res.status(400).json({ success: false, error: 'paramName and newValue are required' });
    }

    const system = await getAutoOptimizationSystem();
    const estimate = await system.evaluateParameterChange(paramName, newValue);
    return res.json({ success: true, estimate });
  } catch (error) {
    console.error('[ContinuousLearning] Error evaluating change:', error);
    return res.status(500).json({ success: false, error: 'Failed to evaluate change' });
  }
});

/**
 * POST /api/continuous-learning/optimization/apply
 * Apply optimization
 */
router.post('/optimization/apply', async (req, res) => {
  try {
    const { paramName, newValue } = req.body;

    if (!paramName || newValue === undefined) {
      return res.status(400).json({ success: false, error: 'paramName and newValue are required' });
    }

    const system = await getAutoOptimizationSystem();
    const result = await system.applyOptimization(paramName, newValue);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('[ContinuousLearning] Error applying optimization:', error);
    return res.status(500).json({ success: false, error: 'Failed to apply optimization' });
  }
});

/**
 * POST /api/continuous-learning/optimization/cycle
 * Run optimization cycle
 */
router.post('/optimization/cycle', async (req, res) => {
  try {
    const system = await getAutoOptimizationSystem();
    const result = await system.runOptimizationCycle();
    return res.json({ success: true, result });
  } catch (error) {
    console.error('[ContinuousLearning] Error running cycle:', error);
    return res.status(500).json({ success: false, error: 'Failed to run cycle' });
  }
});

// =============================================================================
// HEALTH MONITORING
// =============================================================================

/**
 * GET /api/continuous-learning/health
 * Get current health status
 */
router.get('/health', async (req, res) => {
  try {
    const monitor = await getProductionHealthMonitor();
    const report = await monitor.runHealthCheck();
    return res.json({ success: true, health: report });
  } catch (error) {
    console.error('[ContinuousLearning] Error checking health:', error);
    return res.status(500).json({ success: false, error: 'Failed to check health' });
  }
});

/**
 * GET /api/continuous-learning/health/history
 * Get health history
 */
router.get('/health/history', async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || '24');
    const monitor = await getProductionHealthMonitor();
    const history = await monitor.getHealthHistory(limit);
    return res.json({ success: true, history });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting health history:', error);
    return res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

/**
 * GET /api/continuous-learning/health/alerts
 * Get active alerts
 */
router.get('/health/alerts', async (req, res) => {
  try {
    const monitor = await getProductionHealthMonitor();
    const alerts = await monitor.getAlerts();
    return res.json({ success: true, alerts });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting alerts:', error);
    return res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
});

/**
 * POST /api/continuous-learning/health/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/health/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const monitor = await getProductionHealthMonitor();
    await monitor.acknowledgeAlert(alertId);
    return res.json({ success: true });
  } catch (error) {
    console.error('[ContinuousLearning] Error acknowledging alert:', error);
    return res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

// =============================================================================
// UNIFIED METRICS
// =============================================================================

/**
 * GET /api/continuous-learning/dashboard
 * Get unified dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const collector = await getUnifiedMetricsCollector();
    const dashboard = await collector.getDashboardData();
    return res.json({ success: true, dashboard });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting dashboard:', error);
    return res.status(500).json({ success: false, error: 'Failed to get dashboard' });
  }
});

/**
 * GET /api/continuous-learning/correlations
 * Get correlation analysis
 */
router.get('/correlations', async (req, res) => {
  try {
    const collector = await getUnifiedMetricsCollector();
    const correlations = await collector.analyzeCorrelations();
    return res.json({ success: true, correlations });
  } catch (error) {
    console.error('[ContinuousLearning] Error analyzing correlations:', error);
    return res.status(500).json({ success: false, error: 'Failed to analyze correlations' });
  }
});

/**
 * GET /api/continuous-learning/trends
 * Get historical trends
 */
router.get('/trends', async (req, res) => {
  try {
    const period = (req.query.period as string) || '7d';
    const collector = await getUnifiedMetricsCollector();
    const trends = await collector.getHistoricalTrends(period);
    return res.json({ success: true, trends });
  } catch (error) {
    console.error('[ContinuousLearning] Error getting trends:', error);
    return res.status(500).json({ success: false, error: 'Failed to get trends' });
  }
});

export default router;
