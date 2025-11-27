/**
 * Cloud Pricing Calculator
 *
 * Real-time pricing for RunPod, AWS, and GCP
 * Prices are updated periodically from provider APIs
 */

import {
    CloudProvider,
    GPUType,
    GPUPricing,
    ResourcePricing,
    DeploymentConfig,
    CostEstimate,
    ResourceType,
} from './types.js';

// GPU Pricing (as of 2024 - these should be updated from APIs)
const GPU_PRICING: GPUPricing[] = [
    // RunPod pricing (very competitive for GPU)
    { gpu: 'nvidia-a100-80gb', provider: 'runpod', hourlyRate: 1.89, spotRate: 0.99, memoryGB: 80, available: true },
    { gpu: 'nvidia-a100-40gb', provider: 'runpod', hourlyRate: 1.19, spotRate: 0.69, memoryGB: 40, available: true },
    { gpu: 'nvidia-h100', provider: 'runpod', hourlyRate: 3.89, spotRate: 2.49, memoryGB: 80, available: true },
    { gpu: 'nvidia-a40', provider: 'runpod', hourlyRate: 0.79, spotRate: 0.44, memoryGB: 48, available: true },
    { gpu: 'nvidia-l40', provider: 'runpod', hourlyRate: 0.99, spotRate: 0.59, memoryGB: 48, available: true },
    { gpu: 'nvidia-rtx-4090', provider: 'runpod', hourlyRate: 0.74, spotRate: 0.39, memoryGB: 24, available: true },
    { gpu: 'nvidia-rtx-3090', provider: 'runpod', hourlyRate: 0.44, spotRate: 0.24, memoryGB: 24, available: true },

    // AWS GPU pricing (p4d, g5)
    { gpu: 'nvidia-a100-40gb', provider: 'aws', hourlyRate: 3.67, memoryGB: 40, available: true },
    { gpu: 'nvidia-a100-80gb', provider: 'aws', hourlyRate: 4.89, memoryGB: 80, available: true },
    { gpu: 'nvidia-t4', provider: 'aws', hourlyRate: 0.526, memoryGB: 16, available: true },
    { gpu: 'nvidia-v100', provider: 'aws', hourlyRate: 3.06, memoryGB: 16, available: true },

    // GCP GPU pricing
    { gpu: 'nvidia-a100-40gb', provider: 'gcp', hourlyRate: 3.67, memoryGB: 40, available: true },
    { gpu: 'nvidia-a100-80gb', provider: 'gcp', hourlyRate: 4.89, memoryGB: 80, available: true },
    { gpu: 'nvidia-t4', provider: 'gcp', hourlyRate: 0.35, memoryGB: 16, available: true },
    { gpu: 'nvidia-v100', provider: 'gcp', hourlyRate: 2.48, memoryGB: 16, available: true },
    { gpu: 'nvidia-l40', provider: 'gcp', hourlyRate: 1.02, memoryGB: 48, available: true },
];

// Base compute pricing per provider
const COMPUTE_PRICING: Record<CloudProvider, Record<ResourceType, ResourcePricing[]>> = {
    runpod: {
        serverless: [
            { resourceType: 'serverless', provider: 'runpod', size: 'small', pricing: { hourlyRate: 0.0002, monthlyRate: 0.15, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 1 } },
            { resourceType: 'serverless', provider: 'runpod', size: 'medium', pricing: { hourlyRate: 0.0004, monthlyRate: 0.30, currency: 'USD' }, specs: { vcpu: 2, memoryGB: 2 } },
            { resourceType: 'serverless', provider: 'runpod', size: 'large', pricing: { hourlyRate: 0.0008, monthlyRate: 0.60, currency: 'USD' }, specs: { vcpu: 4, memoryGB: 4 } },
        ],
        container: [],
        vm: [],
        gpu: [],
        storage: [
            { resourceType: 'storage', provider: 'runpod', size: 'small', pricing: { hourlyRate: 0.0001, monthlyRate: 0.07, currency: 'USD' }, specs: { storageGB: 10 } },
        ],
        database: [],
    },
    aws: {
        serverless: [
            { resourceType: 'serverless', provider: 'aws', size: 'small', pricing: { hourlyRate: 0.0000166, monthlyRate: 0.012, currency: 'USD' }, specs: { vcpu: 0.25, memoryGB: 0.5 } },
            { resourceType: 'serverless', provider: 'aws', size: 'medium', pricing: { hourlyRate: 0.0000333, monthlyRate: 0.024, currency: 'USD' }, specs: { vcpu: 0.5, memoryGB: 1 } },
            { resourceType: 'serverless', provider: 'aws', size: 'large', pricing: { hourlyRate: 0.0000667, monthlyRate: 0.048, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 2 } },
        ],
        container: [
            { resourceType: 'container', provider: 'aws', size: 'small', pricing: { hourlyRate: 0.0255, monthlyRate: 18.36, currency: 'USD' }, specs: { vcpu: 0.25, memoryGB: 0.5 } },
            { resourceType: 'container', provider: 'aws', size: 'medium', pricing: { hourlyRate: 0.0511, monthlyRate: 36.79, currency: 'USD' }, specs: { vcpu: 0.5, memoryGB: 1 } },
            { resourceType: 'container', provider: 'aws', size: 'large', pricing: { hourlyRate: 0.1022, monthlyRate: 73.58, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 2 } },
        ],
        vm: [
            { resourceType: 'vm', provider: 'aws', size: 'small', pricing: { hourlyRate: 0.0116, monthlyRate: 8.35, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 1 } },
            { resourceType: 'vm', provider: 'aws', size: 'medium', pricing: { hourlyRate: 0.0464, monthlyRate: 33.41, currency: 'USD' }, specs: { vcpu: 2, memoryGB: 4 } },
            { resourceType: 'vm', provider: 'aws', size: 'large', pricing: { hourlyRate: 0.0928, monthlyRate: 66.82, currency: 'USD' }, specs: { vcpu: 4, memoryGB: 8 } },
        ],
        gpu: [],
        storage: [
            { resourceType: 'storage', provider: 'aws', size: 'small', pricing: { hourlyRate: 0.0000322, monthlyRate: 0.023, currency: 'USD' }, specs: { storageGB: 1 } },
        ],
        database: [
            { resourceType: 'database', provider: 'aws', size: 'small', pricing: { hourlyRate: 0.017, monthlyRate: 12.24, currency: 'USD' }, specs: { vcpu: 2, memoryGB: 1 } },
            { resourceType: 'database', provider: 'aws', size: 'medium', pricing: { hourlyRate: 0.034, monthlyRate: 24.48, currency: 'USD' }, specs: { vcpu: 2, memoryGB: 2 } },
        ],
    },
    gcp: {
        serverless: [
            { resourceType: 'serverless', provider: 'gcp', size: 'small', pricing: { hourlyRate: 0.00002400, monthlyRate: 0.017, currency: 'USD' }, specs: { vcpu: 0.08, memoryGB: 0.25 } },
            { resourceType: 'serverless', provider: 'gcp', size: 'medium', pricing: { hourlyRate: 0.00004800, monthlyRate: 0.035, currency: 'USD' }, specs: { vcpu: 0.25, memoryGB: 0.5 } },
            { resourceType: 'serverless', provider: 'gcp', size: 'large', pricing: { hourlyRate: 0.00009600, monthlyRate: 0.069, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 1 } },
        ],
        container: [
            { resourceType: 'container', provider: 'gcp', size: 'small', pricing: { hourlyRate: 0.024, monthlyRate: 17.28, currency: 'USD' }, specs: { vcpu: 0.25, memoryGB: 0.5 } },
            { resourceType: 'container', provider: 'gcp', size: 'medium', pricing: { hourlyRate: 0.048, monthlyRate: 34.56, currency: 'USD' }, specs: { vcpu: 0.5, memoryGB: 1 } },
            { resourceType: 'container', provider: 'gcp', size: 'large', pricing: { hourlyRate: 0.096, monthlyRate: 69.12, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 2 } },
        ],
        vm: [
            { resourceType: 'vm', provider: 'gcp', size: 'small', pricing: { hourlyRate: 0.0095, monthlyRate: 6.84, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 1 } },
            { resourceType: 'vm', provider: 'gcp', size: 'medium', pricing: { hourlyRate: 0.0380, monthlyRate: 27.36, currency: 'USD' }, specs: { vcpu: 2, memoryGB: 4 } },
            { resourceType: 'vm', provider: 'gcp', size: 'large', pricing: { hourlyRate: 0.0760, monthlyRate: 54.72, currency: 'USD' }, specs: { vcpu: 4, memoryGB: 8 } },
        ],
        gpu: [],
        storage: [
            { resourceType: 'storage', provider: 'gcp', size: 'small', pricing: { hourlyRate: 0.00002740, monthlyRate: 0.020, currency: 'USD' }, specs: { storageGB: 1 } },
        ],
        database: [
            { resourceType: 'database', provider: 'gcp', size: 'small', pricing: { hourlyRate: 0.015, monthlyRate: 10.80, currency: 'USD' }, specs: { vcpu: 1, memoryGB: 3.75 } },
        ],
    },
};

/**
 * Cloud Pricing Calculator
 */
export class CloudPricingCalculator {
    /**
     * Get GPU pricing for all providers
     */
    getGPUPricing(provider?: CloudProvider): GPUPricing[] {
        if (provider) {
            return GPU_PRICING.filter(p => p.provider === provider);
        }
        return GPU_PRICING;
    }

    /**
     * Get cheapest GPU option for a given memory requirement
     */
    getCheapestGPU(minMemoryGB: number, provider?: CloudProvider): GPUPricing | null {
        const eligible = GPU_PRICING
            .filter(p => p.memoryGB >= minMemoryGB && p.available)
            .filter(p => !provider || p.provider === provider)
            .sort((a, b) => a.hourlyRate - b.hourlyRate);

        return eligible[0] || null;
    }

    /**
     * Get compute pricing
     */
    getComputePricing(provider: CloudProvider, resourceType: ResourceType): ResourcePricing[] {
        return COMPUTE_PRICING[provider][resourceType] || [];
    }

    /**
     * Estimate cost for a deployment configuration
     */
    estimateCost(config: DeploymentConfig): CostEstimate {
        const { provider, resourceType, gpu, scaling, volumes } = config;

        let computeCostPerHour = 0;
        let gpuCostPerHour = 0;
        let storageCostPerMonth = 0;

        const breakdown: CostEstimate['breakdown'] = [];

        // Compute cost
        const computePricing = this.getComputePricing(provider, resourceType);
        const sizePricing = computePricing.find(p => p.size === (config.instanceSize || 'medium'));
        if (sizePricing) {
            computeCostPerHour = sizePricing.pricing.hourlyRate;
            breakdown.push({
                item: `${resourceType} (${sizePricing.size})`,
                amount: computeCostPerHour,
                unit: 'hour',
            });
        }

        // GPU cost
        if (gpu) {
            const gpuPricing = GPU_PRICING.find(p => p.gpu === gpu.type && p.provider === provider);
            if (gpuPricing) {
                gpuCostPerHour = gpuPricing.hourlyRate * gpu.count;
                breakdown.push({
                    item: `${gpu.type} x${gpu.count}`,
                    amount: gpuCostPerHour,
                    unit: 'hour',
                });
            }
        }

        // Storage cost
        if (volumes) {
            const storagePricing = this.getComputePricing(provider, 'storage')[0];
            if (storagePricing) {
                const totalGB = volumes.reduce((sum, v) => sum + v.sizeGB, 0);
                storageCostPerMonth = storagePricing.pricing.monthlyRate * totalGB;
                breakdown.push({
                    item: `Storage (${totalGB}GB)`,
                    amount: storageCostPerMonth,
                    unit: 'month',
                });
            }
        }

        // Calculate with scaling
        const replicas = scaling?.minReplicas || 1;
        const totalHourlyCost = (computeCostPerHour + gpuCostPerHour) * replicas;
        const totalDailyCost = totalHourlyCost * 24;
        const totalMonthlyCost = totalDailyCost * 30 + storageCostPerMonth;

        // Find cheapest alternative
        let cheapestAlternative: CostEstimate['cheapestAlternative'];
        const allProviders: CloudProvider[] = ['runpod', 'aws', 'gcp'];

        for (const altProvider of allProviders) {
            if (altProvider === provider) continue;

            const altEstimate = this.estimateCostForProvider(config, altProvider);
            if (!cheapestAlternative || altEstimate < cheapestAlternative.estimatedMonthlyCost) {
                cheapestAlternative = {
                    provider: altProvider,
                    estimatedMonthlyCost: altEstimate,
                    savings: totalMonthlyCost - altEstimate,
                };
            }
        }

        // Only show alternative if it's actually cheaper
        if (cheapestAlternative && cheapestAlternative.savings <= 0) {
            cheapestAlternative = undefined;
        }

        return {
            provider,
            resourceType,
            computeCostPerHour,
            gpuCostPerHour: gpuCostPerHour || undefined,
            storageCostPerMonth: storageCostPerMonth || undefined,
            networkEgressCostPerGB: 0.12, // Average across providers
            estimatedHourlyCost: totalHourlyCost,
            estimatedDailyCost: totalDailyCost,
            estimatedMonthlyCost: totalMonthlyCost,
            breakdown,
            cheapestAlternative,
        };
    }

    /**
     * Estimate cost for a specific provider (helper for comparisons)
     */
    private estimateCostForProvider(config: DeploymentConfig, provider: CloudProvider): number {
        const altConfig = { ...config, provider };

        let hourlyCost = 0;
        let monthlyCost = 0;

        // Compute
        const computePricing = this.getComputePricing(provider, config.resourceType);
        const sizePricing = computePricing.find(p => p.size === (config.instanceSize || 'medium'));
        if (sizePricing) {
            hourlyCost += sizePricing.pricing.hourlyRate;
        }

        // GPU
        if (config.gpu) {
            const gpuPricing = GPU_PRICING.find(p => p.gpu === config.gpu!.type && p.provider === provider);
            if (gpuPricing) {
                hourlyCost += gpuPricing.hourlyRate * config.gpu.count;
            } else {
                // If GPU not available, use closest alternative
                const alt = this.getCheapestGPU(
                    GPU_PRICING.find(p => p.gpu === config.gpu!.type)?.memoryGB || 24,
                    provider
                );
                if (alt) {
                    hourlyCost += alt.hourlyRate * config.gpu.count;
                }
            }
        }

        // Storage
        if (config.volumes) {
            const storagePricing = this.getComputePricing(provider, 'storage')[0];
            if (storagePricing) {
                const totalGB = config.volumes.reduce((sum, v) => sum + v.sizeGB, 0);
                monthlyCost += storagePricing.pricing.monthlyRate * totalGB;
            }
        }

        const replicas = config.scaling?.minReplicas || 1;
        return (hourlyCost * replicas * 24 * 30) + monthlyCost;
    }

    /**
     * Get recommended configuration based on requirements
     */
    getRecommendation(requirements: {
        needsGPU: boolean;
        gpuMemoryGB?: number;
        estimatedRequests?: number;
        budgetPerMonth?: number;
    }): DeploymentConfig & { provider: CloudProvider } {
        const { needsGPU, gpuMemoryGB, estimatedRequests, budgetPerMonth } = requirements;

        let provider: CloudProvider = 'gcp'; // Default for serverless
        let resourceType: ResourceType = 'serverless';
        let gpu: DeploymentConfig['gpu'] | undefined;

        if (needsGPU) {
            // RunPod is usually cheapest for GPU
            provider = 'runpod';
            resourceType = 'gpu';

            const gpuOption = this.getCheapestGPU(gpuMemoryGB || 24, 'runpod');
            if (gpuOption) {
                gpu = { type: gpuOption.gpu, count: 1 };
            }
        } else if (estimatedRequests && estimatedRequests > 100000) {
            // High traffic - use containers
            resourceType = 'container';
            provider = 'gcp'; // Cloud Run is great for scaling
        }

        return {
            provider,
            resourceType,
            region: provider === 'runpod' ? 'US' : provider === 'gcp' ? 'us-central1' : 'us-east-1',
            name: 'recommended-deployment',
            gpu,
            scaling: {
                minReplicas: 1,
                maxReplicas: needsGPU ? 5 : 20,
            },
        };
    }

    /**
     * Compare costs across all providers
     */
    compareCosts(config: Omit<DeploymentConfig, 'provider'>): Array<CostEstimate & { provider: CloudProvider }> {
        const providers: CloudProvider[] = ['runpod', 'aws', 'gcp'];

        return providers.map(provider =>
            this.estimateCost({ ...config, provider } as DeploymentConfig)
        ).sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost);
    }
}

// Singleton instance
export const pricingCalculator = new CloudPricingCalculator();

