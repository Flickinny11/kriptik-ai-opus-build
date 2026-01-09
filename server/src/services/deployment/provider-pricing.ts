/**
 * Provider Pricing & GPU Specifications
 *
 * Current pricing data for RunPod and Modal (January 2026).
 * Used by SmartProviderSelector for cost optimization.
 *
 * Part of KripTik AI's Auto-Deploy Private Endpoints feature (PROMPT 6).
 */

// =============================================================================
// TYPES
// =============================================================================

export interface GPUPricing {
  gpuType: string;
  vram: number;
  runpod: {
    serverlessPerSecond: number;
    podPerHour: number;
    available: boolean;
  };
  modal: {
    perSecond: number;
    available: boolean;
  };
}

export interface ColdStartEstimates {
  p50: number; // ms
  p95: number;
  p99: number;
  withOptimization: number; // FlashBoot (RunPod) or Warm Pools (Modal)
}

// =============================================================================
// GPU PRICING (January 2026)
// =============================================================================

export const GPU_PRICING_2026: GPUPricing[] = [
  {
    gpuType: 'T4',
    vram: 16,
    runpod: { serverlessPerSecond: 0.000055, podPerHour: 0.20, available: true },
    modal: { perSecond: 0.000164, available: true },
  },
  {
    gpuType: 'L4',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000097, podPerHour: 0.35, available: true },
    modal: { perSecond: 0.000222, available: true },
  },
  {
    gpuType: 'A10G',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000139, podPerHour: 0.50, available: true },
    modal: { perSecond: 0.000306, available: true },
  },
  {
    gpuType: 'RTX3090',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000122, podPerHour: 0.44, available: true },
    modal: { perSecond: 0, available: false },
  },
  {
    gpuType: 'RTX4090',
    vram: 24,
    runpod: { serverlessPerSecond: 0.000192, podPerHour: 0.69, available: true },
    modal: { perSecond: 0, available: false },
  },
  {
    gpuType: 'A100-40GB',
    vram: 40,
    runpod: { serverlessPerSecond: 0.000389, podPerHour: 1.40, available: true },
    modal: { perSecond: 0.000772, available: true },
  },
  {
    gpuType: 'A100-80GB',
    vram: 80,
    runpod: { serverlessPerSecond: 0.000611, podPerHour: 2.20, available: true },
    modal: { perSecond: 0.001172, available: true },
  },
  {
    gpuType: 'H100',
    vram: 80,
    runpod: { serverlessPerSecond: 0.001247, podPerHour: 4.49, available: true },
    modal: { perSecond: 0.001527, available: true },
  },
];

// =============================================================================
// COLD START ESTIMATES
// =============================================================================

export const COLD_START_ESTIMATES: Record<'runpod' | 'modal', ColdStartEstimates> = {
  runpod: {
    p50: 200,
    p95: 6000,
    p99: 12000,
    withOptimization: 100, // FlashBoot
  },
  modal: {
    p50: 500,
    p95: 2000,
    p99: 5000,
    withOptimization: 100, // Warm Pools
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get GPU pricing by type
 */
export function getGPUPricing(gpuType: string): GPUPricing | undefined {
  return GPU_PRICING_2026.find((g) => g.gpuType === gpuType);
}

/**
 * Get all GPUs that meet VRAM requirement
 */
export function getGPUsByVRAM(minVRAM: number): GPUPricing[] {
  return GPU_PRICING_2026.filter((g) => g.vram >= minVRAM);
}

/**
 * Calculate cost per request
 */
export function calculateCostPerRequest(
  gpu: GPUPricing,
  provider: 'runpod' | 'modal',
  avgDurationSeconds: number
): number {
  const rate = provider === 'runpod'
    ? gpu.runpod.serverlessPerSecond
    : gpu.modal.perSecond;

  return rate * avgDurationSeconds;
}

/**
 * Calculate monthly cost estimate
 */
export function calculateMonthlyCost(
  gpu: GPUPricing,
  provider: 'runpod' | 'modal',
  requestsPerDay: number,
  avgDurationSeconds: number
): number {
  const costPerRequest = calculateCostPerRequest(gpu, provider, avgDurationSeconds);
  return costPerRequest * requestsPerDay * 30;
}

/**
 * Compare providers for a given GPU type
 */
export function compareProviders(
  gpuType: string,
  requestsPerDay: number,
  avgDurationSeconds: number
): {
  runpod: { available: boolean; monthlyCost: number; costPerRequest: number };
  modal: { available: boolean; monthlyCost: number; costPerRequest: number };
  recommendation: 'runpod' | 'modal';
  savings: number;
  savingsPercent: number;
} {
  const gpu = getGPUPricing(gpuType);
  if (!gpu) {
    throw new Error(`Unknown GPU type: ${gpuType}`);
  }

  const runpodCost = calculateMonthlyCost(gpu, 'runpod', requestsPerDay, avgDurationSeconds);
  const modalCost = calculateMonthlyCost(gpu, 'modal', requestsPerDay, avgDurationSeconds);

  const runpodAvailable = gpu.runpod.available;
  const modalAvailable = gpu.modal.available;

  let recommendation: 'runpod' | 'modal' = 'runpod';
  let savings = 0;
  let savingsPercent = 0;

  if (runpodAvailable && modalAvailable) {
    if (runpodCost < modalCost) {
      recommendation = 'runpod';
      savings = modalCost - runpodCost;
      savingsPercent = (savings / modalCost) * 100;
    } else {
      recommendation = 'modal';
      savings = runpodCost - modalCost;
      savingsPercent = (savings / runpodCost) * 100;
    }
  } else if (runpodAvailable) {
    recommendation = 'runpod';
  } else if (modalAvailable) {
    recommendation = 'modal';
  }

  return {
    runpod: {
      available: runpodAvailable,
      monthlyCost: runpodCost,
      costPerRequest: calculateCostPerRequest(gpu, 'runpod', avgDurationSeconds),
    },
    modal: {
      available: modalAvailable,
      monthlyCost: modalCost,
      costPerRequest: calculateCostPerRequest(gpu, 'modal', avgDurationSeconds),
    },
    recommendation,
    savings,
    savingsPercent,
  };
}
