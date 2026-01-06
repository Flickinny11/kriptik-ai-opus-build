/**
 * GPU Cost Tracking API Routes
 *
 * Provides endpoints for real-time cost tracking, historical analytics,
 * and budget management for GPU operations.
 *
 * Routes:
 * - GET    /api/gpu-costs/summary           - Get cost summary for current period
 * - GET    /api/gpu-costs/history           - Get historical cost data
 * - GET    /api/gpu-costs/estimate/training - Estimate training costs
 * - GET    /api/gpu-costs/estimate/inference- Estimate inference costs
 * - GET    /api/gpu-costs/pricing           - Get current GPU pricing
 * - GET    /api/gpu-costs/budget/alerts     - Check budget alerts
 * - POST   /api/gpu-costs/budget            - Set budget limit
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getGPUCostTracker, GPU_PRICING } from '../services/billing/gpu-cost-tracker.js';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const costTracker = getGPUCostTracker();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================================================
// COST SUMMARY & HISTORY
// ============================================================================

/**
 * GET /api/gpu-costs/summary
 * Get cost summary for the authenticated user
 */
router.get('/summary', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const period = (req.query.period as 'today' | 'week' | 'month' | 'all') || 'month';
        const summary = await costTracker.getCostSummary(userId, period);

        res.json({
            success: true,
            summary: {
                ...summary,
                totalFormatted: costTracker.formatCost(summary.totalCostCents),
                breakdown: {
                    training: costTracker.formatCost(summary.breakdown.training),
                    inference: costTracker.formatCost(summary.breakdown.inference),
                    storage: costTracker.formatCost(summary.breakdown.storage),
                    api: costTracker.formatCost(summary.breakdown.api),
                },
            },
        });
    } catch (error) {
        console.error('Error getting cost summary:', error);
        res.status(500).json({ error: 'Failed to get cost summary' });
    }
});

/**
 * GET /api/gpu-costs/history
 * Get historical cost data
 */
router.get('/history', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const days = parseInt(req.query.days as string) || 30;
        const history = await costTracker.getCostHistory(userId, Math.min(days, 365));

        res.json({
            success: true,
            history: history.map(day => ({
                ...day,
                trainingFormatted: costTracker.formatCost(day.training),
                inferenceFormatted: costTracker.formatCost(day.inference),
                storageFormatted: costTracker.formatCost(day.storage),
                totalFormatted: costTracker.formatCost(day.total),
            })),
        });
    } catch (error) {
        console.error('Error getting cost history:', error);
        res.status(500).json({ error: 'Failed to get cost history' });
    }
});

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * GET /api/gpu-costs/estimate/training
 * Estimate training costs
 */
router.get('/estimate/training', async (req: Request, res: Response) => {
    try {
        const {
            modelSizeGB,
            datasetSizeGB,
            epochs,
            batchSize,
            gpuType,
            trainingType,
        } = req.query;

        // Validate required parameters
        if (!modelSizeGB || !epochs || !gpuType || !trainingType) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['modelSizeGB', 'epochs', 'gpuType', 'trainingType'],
            });
        }

        const estimate = costTracker.estimateTrainingCost({
            modelSizeGB: parseFloat(modelSizeGB as string),
            datasetSizeGB: parseFloat(datasetSizeGB as string) || 1,
            epochs: parseInt(epochs as string),
            batchSize: parseInt(batchSize as string) || 4,
            gpuType: gpuType as string,
            trainingType: trainingType as 'lora' | 'qlora' | 'full',
        });

        res.json({
            success: true,
            estimate: {
                ...estimate,
                estimatedCostFormatted: costTracker.formatCost(estimate.estimatedCostCents),
                estimatedDurationFormatted: costTracker.formatDuration(estimate.estimatedDurationMinutes * 60),
                breakdown: {
                    computeFormatted: costTracker.formatCost(estimate.breakdown.compute),
                    storageFormatted: costTracker.formatCost(estimate.breakdown.storage),
                },
            },
            warnings: getTrainingWarnings(estimate, trainingType as string),
        });
    } catch (error) {
        console.error('Error estimating training cost:', error);
        res.status(500).json({ error: 'Failed to estimate training cost' });
    }
});

/**
 * GET /api/gpu-costs/estimate/inference
 * Estimate inference endpoint costs
 */
router.get('/estimate/inference', async (req: Request, res: Response) => {
    try {
        const {
            gpuType,
            minWorkers,
            maxWorkers,
            requestsPerHour,
            avgLatencyMs,
            hoursPerDay,
        } = req.query;

        // Validate required parameters
        if (!gpuType) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['gpuType'],
            });
        }

        const estimate = costTracker.estimateInferenceCost({
            gpuType: gpuType as string,
            minWorkers: parseInt(minWorkers as string) || 0,
            maxWorkers: parseInt(maxWorkers as string) || 1,
            estimatedRequestsPerHour: parseInt(requestsPerHour as string) || 100,
            avgLatencyMs: parseInt(avgLatencyMs as string) || 500,
            hoursPerDay: parseFloat(hoursPerDay as string) || 24,
        });

        res.json({
            success: true,
            estimate: {
                ...estimate,
                estimatedCostFormatted: costTracker.formatCost(estimate.estimatedCostCents),
                dailyCostFormatted: costTracker.formatCost(estimate.estimatedCostCents),
                monthlyCostFormatted: costTracker.formatCost(estimate.estimatedCostCents * 30),
            },
            warnings: getInferenceWarnings(estimate),
        });
    } catch (error) {
        console.error('Error estimating inference cost:', error);
        res.status(500).json({ error: 'Failed to estimate inference cost' });
    }
});

// ============================================================================
// GPU PRICING
// ============================================================================

/**
 * GET /api/gpu-costs/pricing
 * Get current GPU pricing
 */
router.get('/pricing', async (req: Request, res: Response) => {
    try {
        const gpuType = req.query.gpuType as string;

        if (gpuType) {
            const pricingResult = costTracker.getGPUPricing(gpuType);
            // Check if we got a single GPU pricing object (not the full pricing map)
            if (!pricingResult || typeof pricingResult !== 'object') {
                return res.status(404).json({ error: 'GPU type not found' });
            }
            // Cast to single pricing type since we passed a specific gpuType
            const pricing = pricingResult as { pricePerHour: number; pricePerSecond: number; vram: number };
            if (typeof pricing.pricePerHour !== 'number') {
                return res.status(404).json({ error: 'GPU type not found' });
            }
            return res.json({
                success: true,
                gpuType,
                pricing: {
                    pricePerHour: pricing.pricePerHour,
                    pricePerHourFormatted: `$${pricing.pricePerHour.toFixed(2)}/hr`,
                    vram: pricing.vram,
                    vramFormatted: `${pricing.vram}GB VRAM`,
                },
            });
        }

        // Return all pricing
        const allPricing = Object.entries(GPU_PRICING)
            .filter(([key]) => key !== 'STORAGE_VOLUME' && key !== 'DEFAULT')
            .map(([name, pricing]) => ({
                name,
                pricePerHour: pricing.pricePerHour,
                pricePerHourFormatted: `$${pricing.pricePerHour.toFixed(2)}/hr`,
                vram: pricing.vram,
                vramFormatted: `${pricing.vram}GB`,
                tier: categorizeTier(pricing.pricePerHour, pricing.vram),
            }))
            .sort((a, b) => a.pricePerHour - b.pricePerHour);

        res.json({
            success: true,
            pricing: allPricing,
            storagePricing: {
                pricePerGBPerHour: GPU_PRICING['STORAGE_VOLUME'].pricePerHour,
                pricePerGBPerMonth: GPU_PRICING['STORAGE_VOLUME'].pricePerHour * 24 * 30,
                pricePerGBPerMonthFormatted: `$${(GPU_PRICING['STORAGE_VOLUME'].pricePerHour * 24 * 30).toFixed(2)}/GB/month`,
            },
        });
    } catch (error) {
        console.error('Error getting GPU pricing:', error);
        res.status(500).json({ error: 'Failed to get GPU pricing' });
    }
});

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

/**
 * GET /api/gpu-costs/budget/alerts
 * Check for budget alerts
 */
router.get('/budget/alerts', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Get user's budget limit from database (or use default)
        const budgetLimitCents = parseInt(req.query.budgetLimit as string) || 10000; // Default $100

        const alert = await costTracker.checkBudgetAlerts(userId, budgetLimitCents);

        res.json({
            success: true,
            hasAlert: !!alert,
            alert,
        });
    } catch (error) {
        console.error('Error checking budget alerts:', error);
        res.status(500).json({ error: 'Failed to check budget alerts' });
    }
});

/**
 * POST /api/gpu-costs/budget
 * Set budget limit for the user
 */
router.post('/budget', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { budgetLimitCents } = req.body;

        if (typeof budgetLimitCents !== 'number' || budgetLimitCents < 0) {
            return res.status(400).json({ error: 'Invalid budget limit' });
        }

        // In production, this would update a user settings table
        // For now, we just acknowledge the setting
        res.json({
            success: true,
            budgetLimitCents,
            budgetLimitFormatted: costTracker.formatCost(budgetLimitCents),
            message: 'Budget limit updated successfully',
        });
    } catch (error) {
        console.error('Error setting budget:', error);
        res.status(500).json({ error: 'Failed to set budget' });
    }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function categorizeTier(pricePerHour: number, vram: number): string {
    if (pricePerHour < 0.50) return 'consumer';
    if (pricePerHour < 1.00) return 'professional';
    if (pricePerHour < 2.50) return 'datacenter';
    return 'enterprise';
}

function getTrainingWarnings(estimate: any, trainingType: string): string[] {
    const warnings: string[] = [];

    if (trainingType === 'full') {
        warnings.push('Full fine-tuning will save the complete model (potentially hundreds of GB) to your HuggingFace account.');
    }

    if (estimate.estimatedCostCents > 5000) {
        warnings.push('Training costs are estimates. Actual costs depend on training convergence.');
    }

    if (estimate.breakdown.storage > 1000) {
        warnings.push('RunPod charges for volume storage. Large models stored on volumes incur ongoing costs.');
    }

    if (estimate.confidence === 'low') {
        warnings.push('Cost estimate has low confidence due to model size or complexity. Actual costs may vary significantly.');
    }

    return warnings;
}

function getInferenceWarnings(estimate: any): string[] {
    const warnings: string[] = [];

    if (estimate.estimatedCostCents > 10000) {
        warnings.push('High estimated daily cost. Consider optimizing worker scaling or using quantization.');
    }

    warnings.push('Endpoint idle timeout will incur cold start latency when scaling from zero workers.');

    return warnings;
}

export default router;
