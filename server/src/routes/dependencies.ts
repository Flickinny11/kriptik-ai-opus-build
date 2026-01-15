/**
 * Dependencies API Routes
 * 
 * Analyzes prompts to detect required integrations and dependencies.
 * Powers the dynamic stack selection UI.
 */

import { Router, Request, Response } from 'express';
import { 
    analyzeDependencies, 
    getIntegrationConfig,
    getIntegrationsByCategory,
    getAllIntegrationIds,
} from '../services/ai/dependency-analyzer.js';

const router = Router();

/**
 * POST /api/dependencies/analyze
 * Analyze a prompt to detect required dependencies
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid prompt' });
        }

        if (prompt.length > 10000) {
            return res.status(400).json({ error: 'Prompt too long (max 10000 characters)' });
        }

        const analysis = await analyzeDependencies(prompt);

        res.json({
            success: true,
            ...analysis,
        });
    } catch (error) {
        console.error('[Dependencies] Analysis failed:', error);
        res.status(500).json({ 
            error: 'Failed to analyze dependencies',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/dependencies/integrations
 * Get all available integrations, optionally filtered by category
 */
router.get('/integrations', async (req: Request, res: Response) => {
    try {
        const { category } = req.query;

        if (category && typeof category === 'string') {
            const integrations = getIntegrationsByCategory(category as any);
            return res.json({
                success: true,
                category,
                integrations,
            });
        }

        // Return all integrations grouped by category
        const allIds = getAllIntegrationIds();
        const integrations = allIds.map(id => {
            const config = getIntegrationConfig(id);
            return config ? { id, ...config } : null;
        }).filter(Boolean);

        res.json({
            success: true,
            integrations,
            count: integrations.length,
        });
    } catch (error) {
        console.error('[Dependencies] Get integrations failed:', error);
        res.status(500).json({ error: 'Failed to get integrations' });
    }
});

/**
 * GET /api/dependencies/integrations/:id
 * Get configuration for a specific integration
 */
router.get('/integrations/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const config = getIntegrationConfig(id);

        if (!config) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        res.json({
            success: true,
            integration: { id, ...config },
        });
    } catch (error) {
        console.error('[Dependencies] Get integration failed:', error);
        res.status(500).json({ error: 'Failed to get integration' });
    }
});

export default router;
