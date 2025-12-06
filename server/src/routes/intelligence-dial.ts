/**
 * Intelligence Dial API Routes
 *
 * Endpoints for per-request AI capability toggles:
 * - Thinking depth (shallow → maximum)
 * - Power level (economy → maximum)
 * - Speed vs quality trade-off
 * - Creativity level
 * - Code verbosity
 * - Design detail
 */

import { Router, Request, Response } from 'express';
import {
    IntelligenceDial,
    createIntelligenceDial,
    type IntelligenceSettings,
} from '../services/ai/intelligence-dial.js';

const router = Router();

// Singleton instance
let intelligenceDial: IntelligenceDial | null = null;

function getIntelligenceDial(): IntelligenceDial {
    if (!intelligenceDial) {
        intelligenceDial = createIntelligenceDial();
    }
    return intelligenceDial;
}

/**
 * GET /api/intelligence-dial/presets
 * Get all available presets
 */
router.get('/presets', async (req: Request, res: Response) => {
    try {
        const dial = getIntelligenceDial();
        const presets = dial.getPresets();

        res.json({
            success: true,
            presets,
            default: 'balanced_build',
        });
    } catch (error) {
        console.error('Failed to get presets:', error);
        res.status(500).json({
            error: 'Failed to get presets',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/intelligence-dial/preset/:name
 * Get a specific preset configuration
 */
router.get('/preset/:name', async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const dial = getIntelligenceDial();
        const presets = dial.getPresets();
        const preset = presets.find((p: { name: string }) => p.name.toLowerCase().replace(/\s+/g, '_') === name);

        if (!preset) {
            return res.status(404).json({
                error: 'Preset not found',
                available: presets.map((p: { name: string }) => p.name.toLowerCase().replace(/\s+/g, '_')),
            });
        }

        res.json({
            success: true,
            preset,
        });
    } catch (error) {
        console.error('Failed to get preset:', error);
        res.status(500).json({
            error: 'Failed to get preset',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/intelligence-dial/current
 * Get current intelligence settings
 */
router.get('/current', async (req: Request, res: Response) => {
    try {
        const dial = getIntelligenceDial();
        const settings = dial.getSettings();
        const modelConfig = dial.getModelConfig();
        const generationConfig = dial.getGenerationConfig();

        res.json({
            success: true,
            settings,
            modelConfig,
            generationConfig,
        });
    } catch (error) {
        console.error('Failed to get current settings:', error);
        res.status(500).json({
            error: 'Failed to get current settings',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/intelligence-dial/configure
 * Configure intelligence settings
 */
router.post('/configure', async (req: Request, res: Response) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                error: 'Settings object is required',
            });
        }

        const dial = getIntelligenceDial();
        dial.updateSettings(settings as Partial<IntelligenceSettings>);

        const updatedSettings = dial.getSettings();
        const modelConfig = dial.getModelConfig();
        const promptAdditions = dial.buildPromptAdditions();

        res.json({
            success: true,
            settings: updatedSettings,
            modelConfig,
            promptAdditions,
        });
    } catch (error) {
        console.error('Failed to configure settings:', error);
        res.status(500).json({
            error: 'Failed to configure settings',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/intelligence-dial/apply-preset
 * Apply a preset configuration
 */
router.post('/apply-preset', async (req: Request, res: Response) => {
    try {
        const { preset } = req.body;

        if (!preset) {
            return res.status(400).json({
                error: 'Preset name is required',
            });
        }

        const dial = getIntelligenceDial();
        const success = dial.applyPreset(preset);

        if (!success) {
            return res.status(400).json({
                error: 'Invalid preset name',
                available: dial.getPresets().map((p: { name: string }) => p.name.toLowerCase().replace(/\s+/g, '_')),
            });
        }

        const settings = dial.getSettings();
        const modelConfig = dial.getModelConfig();

        res.json({
            success: true,
            appliedPreset: preset,
            settings,
            modelConfig,
        });
    } catch (error) {
        console.error('Failed to apply preset:', error);
        res.status(500).json({
            error: 'Failed to apply preset',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/intelligence-dial/thinking-depth
 * Set thinking depth specifically
 */
router.post('/thinking-depth', async (req: Request, res: Response) => {
    try {
        const { depth } = req.body;

        const validDepths = ['shallow', 'normal', 'deep', 'maximum'] as const;
        if (!validDepths.includes(depth)) {
            return res.status(400).json({
                error: 'Invalid thinking depth',
                validDepths,
            });
        }

        const dial = getIntelligenceDial();
        dial.setThinkingDepth(depth);

        const settings = dial.getSettings();

        res.json({
            success: true,
            thinkingDepth: depth,
            thinkingBudget: settings.thinkingBudget,
            thinkingEnabled: settings.thinkingEnabled,
        });
    } catch (error) {
        console.error('Failed to set thinking depth:', error);
        res.status(500).json({
            error: 'Failed to set thinking depth',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/intelligence-dial/power-level
 * Set power level specifically
 */
router.post('/power-level', async (req: Request, res: Response) => {
    try {
        const { level } = req.body;

        const validLevels = ['economy', 'balanced', 'performance', 'maximum'] as const;
        if (!validLevels.includes(level)) {
            return res.status(400).json({
                error: 'Invalid power level',
                validLevels,
            });
        }

        const dial = getIntelligenceDial();
        dial.setPowerLevel(level);

        const modelConfig = dial.getModelConfig();

        res.json({
            success: true,
            powerLevel: level,
            modelConfig,
        });
    } catch (error) {
        console.error('Failed to set power level:', error);
        res.status(500).json({
            error: 'Failed to set power level',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/intelligence-dial/creativity
 * Set creativity level specifically
 */
router.post('/creativity', async (req: Request, res: Response) => {
    try {
        const { level } = req.body;

        const validLevels = ['conservative', 'balanced', 'creative', 'experimental'] as const;
        if (!validLevels.includes(level)) {
            return res.status(400).json({
                error: 'Invalid creativity level',
                validLevels,
            });
        }

        const dial = getIntelligenceDial();
        dial.setCreativityLevel(level);

        const settings = dial.getSettings();

        res.json({
            success: true,
            creativityLevel: level,
            temperature: settings.temperature,
        });
    } catch (error) {
        console.error('Failed to set creativity level:', error);
        res.status(500).json({
            error: 'Failed to set creativity level',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/intelligence-dial/reset
 * Reset to default settings
 */
router.post('/reset', async (req: Request, res: Response) => {
    try {
        // Create a fresh instance
        intelligenceDial = createIntelligenceDial();

        const settings = intelligenceDial.getSettings();

        res.json({
            success: true,
            message: 'Settings reset to defaults',
            settings,
        });
    } catch (error) {
        console.error('Failed to reset settings:', error);
        res.status(500).json({
            error: 'Failed to reset settings',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/intelligence-dial/model-config
 * Get current model configuration based on settings
 */
router.get('/model-config', async (req: Request, res: Response) => {
    try {
        const dial = getIntelligenceDial();
        const modelConfig = dial.getModelConfig();

        res.json({
            success: true,
            modelConfig,
        });
    } catch (error) {
        console.error('Failed to get model config:', error);
        res.status(500).json({
            error: 'Failed to get model config',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/intelligence-dial/cost-estimate
 * Estimate cost multiplier for current settings
 */
router.get('/cost-estimate', async (req: Request, res: Response) => {
    try {
        const dial = getIntelligenceDial();
        const costMultiplier = dial.estimateCostMultiplier();
        const settings = dial.getSettings();

        res.json({
            success: true,
            costMultiplier,
            breakdown: {
                powerLevel: settings.powerLevel,
                thinkingDepth: settings.thinkingDepth,
                speedPriority: settings.speedPriority,
            },
        });
    } catch (error) {
        console.error('Failed to estimate cost:', error);
        res.status(500).json({
            error: 'Failed to estimate cost',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
