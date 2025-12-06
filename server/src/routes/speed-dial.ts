/**
 * Speed Dial API Routes
 *
 * Endpoints for the 4-mode Speed Dial Architecture:
 * - Lightning (3-5 min): MVP focus, minimal verification
 * - Standard (15-30 min): Balanced quality & speed
 * - Tournament (30-45 min): Competing implementations
 * - Production (60-120 min): Full verification, enterprise-ready
 */

import { Router, Request, Response } from 'express';
import {
    SpeedDialService,
    createSpeedDialService,
    type BuildMode,
} from '../services/ai/speed-dial.js';

const router = Router();

// Singleton service instance
let speedDialService: SpeedDialService | null = null;

function getSpeedDialService(): SpeedDialService {
    if (!speedDialService) {
        speedDialService = createSpeedDialService();
    }
    return speedDialService;
}

/**
 * GET /api/speed-dial/modes
 * List all available build modes with their configurations
 */
router.get('/modes', async (req: Request, res: Response) => {
    try {
        const service = getSpeedDialService();
        const modes = service.getAllModes();

        res.json({
            success: true,
            modes,
            default: 'standard',
        });
    } catch (error) {
        console.error('Failed to get build modes:', error);
        res.status(500).json({
            error: 'Failed to get build modes',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/speed-dial/mode/:mode
 * Get configuration for a specific build mode
 */
router.get('/mode/:mode', async (req: Request, res: Response) => {
    try {
        const { mode } = req.params;
        const service = getSpeedDialService();

        const validModes: BuildMode[] = ['lightning', 'standard', 'tournament', 'production'];
        if (!validModes.includes(mode as BuildMode)) {
            return res.status(400).json({
                error: 'Invalid build mode',
                validModes,
            });
        }

        const config = service.getModeConfig(mode as BuildMode);

        res.json({
            success: true,
            mode,
            config,
        });
    } catch (error) {
        console.error('Failed to get mode config:', error);
        res.status(500).json({
            error: 'Failed to get mode configuration',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/speed-dial/current
 * Get the current mode and configuration
 */
router.get('/current', async (req: Request, res: Response) => {
    try {
        const service = getSpeedDialService();
        const mode = service.getMode();
        const config = service.getConfig();
        const costEstimate = service.estimateCost();
        const timeEstimate = service.estimateTime();

        res.json({
            success: true,
            mode,
            config,
            estimates: {
                cost: costEstimate,
                time: timeEstimate,
            },
        });
    } catch (error) {
        console.error('Failed to get current mode:', error);
        res.status(500).json({
            error: 'Failed to get current mode',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/speed-dial/select
 * Select a build mode for an upcoming build
 */
router.post('/select', async (req: Request, res: Response) => {
    try {
        const { mode } = req.body;
        const userId = (req as any).user?.id || 'anonymous';

        if (!mode) {
            return res.status(400).json({ error: 'Build mode is required' });
        }

        const validModes: BuildMode[] = ['lightning', 'standard', 'tournament', 'production'];
        if (!validModes.includes(mode as BuildMode)) {
            return res.status(400).json({
                error: 'Invalid build mode',
                validModes,
            });
        }

        const service = getSpeedDialService();
        service.setMode(mode as BuildMode);

        const config = service.getConfig();
        const costEstimate = service.estimateCost();
        const timeEstimate = service.estimateTime();

        res.json({
            success: true,
            selected: {
                mode,
                config,
                estimates: {
                    cost: costEstimate,
                    time: timeEstimate,
                },
                selectedAt: new Date().toISOString(),
                selectedBy: userId,
            },
        });
    } catch (error) {
        console.error('Failed to select build mode:', error);
        res.status(500).json({
            error: 'Failed to select build mode',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/speed-dial/suggest
 * Get a suggested mode based on requirements
 */
router.post('/suggest', async (req: Request, res: Response) => {
    try {
        const { hasDeadline, deadlineMinutes, requiresHighQuality, requiresSecurityAudit, budgetUSD, isProduction } = req.body;

        const service = getSpeedDialService();
        const suggestedMode = service.suggestMode({
            hasDeadline,
            deadlineMinutes,
            requiresHighQuality,
            requiresSecurityAudit,
            budgetUSD,
            isProduction,
        });

        const config = service.getModeConfig(suggestedMode);

        res.json({
            success: true,
            suggestedMode,
            config,
            reasoning: `Based on ${isProduction ? 'production requirement' : hasDeadline ? `${deadlineMinutes} minute deadline` : budgetUSD ? `$${budgetUSD} budget` : 'general requirements'}`,
        });
    } catch (error) {
        console.error('Failed to suggest mode:', error);
        res.status(500).json({
            error: 'Failed to suggest mode',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/speed-dial/customize
 * Apply custom overrides to the current mode
 */
router.post('/customize', async (req: Request, res: Response) => {
    try {
        const { overrides } = req.body;

        if (!overrides || typeof overrides !== 'object') {
            return res.status(400).json({
                error: 'Overrides object is required',
            });
        }

        const service = getSpeedDialService();
        service.customize(overrides);

        const config = service.getConfig();

        res.json({
            success: true,
            message: 'Custom overrides applied',
            config,
        });
    } catch (error) {
        console.error('Failed to customize mode:', error);
        res.status(500).json({
            error: 'Failed to customize mode',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/speed-dial/compare
 * Compare all build modes side by side
 */
router.get('/compare', async (req: Request, res: Response) => {
    try {
        const service = getSpeedDialService();

        const modes: BuildMode[] = ['lightning', 'standard', 'tournament', 'production'];
        const comparison = modes.map(mode => {
            const config = service.getModeConfig(mode);
            return {
                mode,
                name: config.name,
                targetMinutes: config.targetMinutes,
                maxMinutes: config.maxMinutes,
                estimatedCostUSD: config.estimatedCostUSD,
                description: config.description,
            };
        });

        res.json({
            success: true,
            comparison,
            recommendation: 'standard',
        });
    } catch (error) {
        console.error('Failed to compare modes:', error);
        res.status(500).json({
            error: 'Failed to compare build modes',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
