/**
 * Deployment Services Index
 *
 * Barrel exports for deployment services.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

// Deployment Recommender
export {
  DeploymentRecommender,
  getDeploymentRecommender,
  type DeploymentRecommendation,
  type DeploymentProvider,
  type LatencyRequirement,
  type GPUType,
  type ScalingConfig,
  type DeploymentAlternative,
  type ModelRequirements,
} from './deployment-recommender.js';

// RunPod Deployer
export {
  RunPodDeployer,
  getRunPodDeployer,
  type RunPodDeployConfig,
  type RunPodDeployResult,
  type RunPodEndpointStatus,
} from './runpod-deployer.js';

// Modal Deployer
export {
  ModalDeployer,
  getModalDeployer,
  type ModalGPUType,
  type ModalDeployConfig,
  type ModalDeployResult,
  type ModalAppStatus,
} from './modal-deployer.js';// Unified Deployer
export {
  UnifiedDeployer,
  getUnifiedDeployer,
  type UnifiedDeployConfig,
  type UnifiedDeployResult,
  type ConnectionCode,
  type DeploymentInfo,
} from './unified-deployer.js';

// Endpoint Registry - Private user endpoints with API key management
export {
  EndpointRegistry,
  createEndpointRegistry,
  type EndpointRegistryConfig,
  type EndpointModality,
  type EndpointProvider,
  type EndpointType,
  type EndpointStatus,
  type RegisterEndpointInput,
  type EndpointInfo,
  type ApiKeyInfo,
  type ConnectionInfo,
  type UsageRecord,
  type UsageStats,
} from './endpoint-registry.js';

// Auto-Deployer - Automatic deployment after training
export {
  AutoDeployer,
  getAutoDeployer,
  type AutoDeployConfig,
  type AutoDeployResult,
} from './auto-deployer.js';

// Provider Pricing - Updated GPU pricing data (January 2026)
export {
  GPU_PRICING_2026,
  COLD_START_ESTIMATES,
  getGPUPricing,
  getGPUsByVRAM,
  calculateCostPerRequest,
  calculateMonthlyCost,
  compareProviders,
  type GPUPricing,
} from './provider-pricing.js';

// Smart Provider Selector - Intelligent cost-optimized provider selection
export {
  SmartProviderSelector,
  getSmartProviderSelector,
  type LatencyRequirement as SmartLatencyRequirement,
  type BudgetConstraint,
  type ProviderSelectionInput,
  type ProviderSelectionResult,
} from './smart-provider-selector.js';

// Endpoint Monitor - Real-time health monitoring and auto-recovery
export {
  EndpointMonitor,
  getEndpointMonitor,
  startEndpointMonitoring,
  stopEndpointMonitoring,
  type MonitoringConfig,
  type EndpointHealth,
  type ProviderHealth,
  type HealthAlert,
} from './endpoint-monitor.js';
