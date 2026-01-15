/**
 * RunPod GPU Availability Service
 * 
 * Fetches real-time GPU availability and pricing from RunPod API.
 * Caches results for 60 seconds to avoid rate limiting.
 * 
 * Features:
 * - Real-time GPU availability checking
 * - Price per hour for each GPU type
 * - VRAM and compute capability info
 * - 60-second cache for performance
 */

import { getCredentialVault } from '../security/credential-vault.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GPUType {
  id: string;
  name: string;
  displayName: string;
  vram: number; // GB
  available: boolean;
  availableCount?: number;
  pricePerHour: number; // USD
  pricePerHourSpot?: number; // Spot pricing if available
  location?: string;
  computeCapability?: string;
  cudaCores?: number;
  memoryBandwidth?: number; // GB/s
}

export interface GPUAvailabilityResponse {
  gpus: GPUType[];
  lastUpdated: Date;
  cacheExpires: Date;
}

// ============================================================================
// CACHE
// ============================================================================

const CACHE_TTL_MS = 60000; // 60 seconds
let cachedData: GPUAvailabilityResponse | null = null;
let cacheTimestamp: number = 0;

// ============================================================================
// KNOWN GPU TYPES (Fallback when API unavailable)
// ============================================================================

const KNOWN_GPU_TYPES: GPUType[] = [
  {
    id: 'NVIDIA RTX 4090',
    name: 'RTX 4090',
    displayName: 'NVIDIA GeForce RTX 4090',
    vram: 24,
    available: true,
    pricePerHour: 0.74,
    computeCapability: '8.9',
    cudaCores: 16384,
    memoryBandwidth: 1008,
  },
  {
    id: 'NVIDIA RTX A6000',
    name: 'RTX A6000',
    displayName: 'NVIDIA RTX A6000',
    vram: 48,
    available: true,
    pricePerHour: 0.79,
    computeCapability: '8.6',
    cudaCores: 10752,
    memoryBandwidth: 768,
  },
  {
    id: 'NVIDIA A100 80GB',
    name: 'A100 80GB',
    displayName: 'NVIDIA A100 80GB PCIe',
    vram: 80,
    available: true,
    pricePerHour: 1.89,
    computeCapability: '8.0',
    cudaCores: 6912,
    memoryBandwidth: 2039,
  },
  {
    id: 'NVIDIA A100 SXM',
    name: 'A100 SXM',
    displayName: 'NVIDIA A100 SXM4 80GB',
    vram: 80,
    available: true,
    pricePerHour: 2.21,
    computeCapability: '8.0',
    cudaCores: 6912,
    memoryBandwidth: 2039,
  },
  {
    id: 'NVIDIA H100 PCIe',
    name: 'H100 PCIe',
    displayName: 'NVIDIA H100 PCIe',
    vram: 80,
    available: false,
    pricePerHour: 3.59,
    computeCapability: '9.0',
    cudaCores: 14592,
    memoryBandwidth: 2039,
  },
  {
    id: 'NVIDIA H100 SXM',
    name: 'H100 SXM',
    displayName: 'NVIDIA H100 SXM5 80GB',
    vram: 80,
    available: false,
    pricePerHour: 4.49,
    computeCapability: '9.0',
    cudaCores: 16896,
    memoryBandwidth: 3352,
  },
  {
    id: 'NVIDIA L40',
    name: 'L40',
    displayName: 'NVIDIA L40',
    vram: 48,
    available: true,
    pricePerHour: 1.14,
    computeCapability: '8.9',
    cudaCores: 18176,
    memoryBandwidth: 864,
  },
  {
    id: 'NVIDIA RTX 3090',
    name: 'RTX 3090',
    displayName: 'NVIDIA GeForce RTX 3090',
    vram: 24,
    available: true,
    pricePerHour: 0.44,
    computeCapability: '8.6',
    cudaCores: 10496,
    memoryBandwidth: 936,
  },
  {
    id: 'NVIDIA RTX 3080',
    name: 'RTX 3080',
    displayName: 'NVIDIA GeForce RTX 3080',
    vram: 10,
    available: true,
    pricePerHour: 0.30,
    computeCapability: '8.6',
    cudaCores: 8704,
    memoryBandwidth: 760,
  },
];

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Get GPU availability from RunPod API
 * Returns cached data if available and not expired
 */
export async function getGPUAvailability(userId?: string): Promise<GPUAvailabilityResponse> {
  // Check cache first
  const now = Date.now();
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedData;
  }

  // Try to get API key from vault
  let apiKey: string | null = null;
  
  try {
    if (userId) {
      const vault = getCredentialVault();
      const credentials = await vault.listCredentials(userId);
      const runpodCred = credentials.find(c => c.integrationId === 'runpod');
      if (runpodCred) {
        const decrypted = await vault.getCredential(runpodCred.id, userId);
        apiKey = decrypted?.data?.apiKey as string || null;
      }
    }
    
    // Fall back to env var
    if (!apiKey) {
      apiKey = process.env.RUNPOD_API_KEY || null;
    }
  } catch (error) {
    console.warn('[RunPodAvailability] Could not get API key:', error);
  }

  // If we have an API key, fetch from RunPod
  if (apiKey) {
    try {
      const liveData = await fetchFromRunPodAPI(apiKey);
      cachedData = liveData;
      cacheTimestamp = now;
      return liveData;
    } catch (error) {
      console.error('[RunPodAvailability] API fetch failed:', error);
      // Fall through to use static data
    }
  }

  // Return static/fallback data
  const fallbackResponse: GPUAvailabilityResponse = {
    gpus: KNOWN_GPU_TYPES,
    lastUpdated: new Date(),
    cacheExpires: new Date(now + CACHE_TTL_MS),
  };

  cachedData = fallbackResponse;
  cacheTimestamp = now;
  return fallbackResponse;
}

/**
 * Fetch live GPU data from RunPod API
 */
async function fetchFromRunPodAPI(apiKey: string): Promise<GPUAvailabilityResponse> {
  // RunPod GraphQL endpoint
  const response = await fetch('https://api.runpod.io/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: `
        query gpuTypes {
          gpuTypes {
            id
            displayName
            memoryInGb
            secureCloud
            communityCloud
            lowestPrice {
              minimumBidPrice
              uninterruptablePrice
            }
          }
        }
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`RunPod API error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'RunPod API error');
  }

  const gpuTypes = result.data?.gpuTypes || [];
  const now = Date.now();

  // Transform API response to our format
  const gpus: GPUType[] = gpuTypes.map((gpu: any) => {
    // Find matching known GPU for additional info
    const knownGpu = KNOWN_GPU_TYPES.find(k => 
      k.id === gpu.id || k.name === gpu.displayName
    );

    const available = gpu.secureCloud || gpu.communityCloud;
    const price = gpu.lowestPrice?.uninterruptablePrice || gpu.lowestPrice?.minimumBidPrice;

    return {
      id: gpu.id,
      name: gpu.displayName?.replace('NVIDIA ', '').replace('GeForce ', '') || gpu.id,
      displayName: gpu.displayName || gpu.id,
      vram: gpu.memoryInGb || 0,
      available: !!available,
      pricePerHour: price || knownGpu?.pricePerHour || 0,
      pricePerHourSpot: gpu.lowestPrice?.minimumBidPrice,
      computeCapability: knownGpu?.computeCapability,
      cudaCores: knownGpu?.cudaCores,
      memoryBandwidth: knownGpu?.memoryBandwidth,
    };
  });

  return {
    gpus: gpus.length > 0 ? gpus : KNOWN_GPU_TYPES,
    lastUpdated: new Date(),
    cacheExpires: new Date(now + CACHE_TTL_MS),
  };
}

/**
 * Get GPU recommendation based on model requirements
 */
export function recommendGPU(
  requiredVRAM: number,
  preferSpeed: boolean = true
): GPUType | null {
  const cached = cachedData || { gpus: KNOWN_GPU_TYPES };
  
  // Filter to available GPUs with enough VRAM
  const suitable = cached.gpus
    .filter(gpu => gpu.available && gpu.vram >= requiredVRAM)
    .sort((a, b) => {
      if (preferSpeed) {
        // Sort by CUDA cores (performance) descending
        return (b.cudaCores || 0) - (a.cudaCores || 0);
      }
      // Sort by price ascending
      return a.pricePerHour - b.pricePerHour;
    });

  return suitable[0] || null;
}

/**
 * Estimate monthly cost for continuous operation
 */
export function estimateMonthlyCost(gpu: GPUType, hoursPerDay: number = 24): number {
  return gpu.pricePerHour * hoursPerDay * 30;
}

/**
 * Clear cache (useful for testing or forced refresh)
 */
export function clearCache(): void {
  cachedData = null;
  cacheTimestamp = 0;
}

export default {
  getGPUAvailability,
  recommendGPU,
  estimateMonthlyCost,
  clearCache,
};
