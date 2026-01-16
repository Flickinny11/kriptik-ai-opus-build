/**
 * Continuous Learning Engine - Main Export
 *
 * The meta-integration layer that ties together:
 * - Billing/Stripe
 * - VL-JEPA/Vector Memory
 * - Hyper-Thinking (ToT, MARS)
 * - Training/Fine-Tuning
 * - Component 28 (Autonomous Learning Engine)
 */

// Core Engine
export {
  ContinuousLearningEngine,
  getContinuousLearningEngine,
  resetContinuousLearningEngine,
} from './engine.js';

// Billing-Learning Bridge
export {
  BillingLearningBridge,
  getBillingLearningBridge,
  resetBillingLearningBridge,
} from './billing-learning-bridge.js';

// Vector Context Provider
export {
  VectorContextProvider,
  getVectorContextProvider,
  resetVectorContextProvider,
} from './vector-context-provider.js';

// Hyper-Thinking Integrator
export {
  HyperThinkingIntegrator,
  getHyperThinkingIntegrator,
  resetHyperThinkingIntegrator,
} from './hyper-thinking-integrator.js';

// Model Deployment Pipeline
export {
  ModelDeploymentPipeline,
  getModelDeploymentPipeline,
  resetModelDeploymentPipeline,
} from './model-deployment-pipeline.js';

// Unified Metrics Collector
export {
  UnifiedMetricsCollector,
  getUnifiedMetricsCollector,
  resetUnifiedMetricsCollector,
} from './unified-metrics-collector.js';

// Learning Feedback Loop
export {
  LearningFeedbackLoop,
  getLearningFeedbackLoop,
  resetLearningFeedbackLoop,
} from './learning-feedback-loop.js';

// Auto-Optimization System
export {
  AutoOptimizationSystem,
  getAutoOptimizationSystem,
  resetAutoOptimizationSystem,
} from './auto-optimization.js';

// Production Health Monitor
export {
  ProductionHealthMonitor,
  getProductionHealthMonitor,
  resetProductionHealthMonitor,
} from './production-health-monitor.js';

// Speed Optimizer - Makes the system get FASTER over time
export {
  SpeedOptimizer,
  getSpeedOptimizer,
  createSpeedOptimizer,
  type LatencyData,
  type SpeedRecommendation,
  type SpeedMetrics,
} from './speed-optimizer.js';

// VL-JEPA Feedback Loop - Makes the system get HIGHER QUALITY over time
export {
  VLJEPAFeedbackLoop,
  getVLJEPAFeedbackLoop,
  createVLJEPAFeedbackLoop,
  type BuildOutcomeData,
  type SatisfactionPrediction,
  type OptimizedConfig,
} from './vl-jepa-feedback.js';

// Types
export * from './types.js';
