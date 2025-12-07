/**
 * Adaptive UI Routes
 *
 * API endpoints for behavior tracking, pattern detection, and UI suggestions.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getAdaptiveUIService,
    type UserBehaviorSignal,
    type BehaviorPattern,
    type UISuggestion,
} from '../services/learning/adaptive-ui.js';
import { db } from '../db.js';
import { adaptiveBehaviorSignals, adaptivePatterns } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// SSE clients for real-time updates
const sseClients = new Map<string, Response[]>();

/**
 * POST /api/adaptive/signals
 * Receive behavior signals (batched)
 */
router.post('/signals', async (req: Request, res: Response) => {
    try {
        const { signals, projectId } = req.body;

        if (!signals || !Array.isArray(signals) || !projectId) {
            return res.status(400).json({
                success: false,
                error: 'signals array and projectId are required',
            });
        }

        const adaptiveService = getAdaptiveUIService();

        // Add IDs and timestamps if not present
        const processedSignals: UserBehaviorSignal[] = signals.map(signal => ({
            id: signal.id || uuidv4(),
            projectId,
            sessionId: signal.sessionId,
            userId: signal.userId,
            signalType: signal.signalType,
            element: signal.element,
            context: signal.context,
            timestamp: signal.timestamp ? new Date(signal.timestamp) : new Date(),
            metadata: signal.metadata,
        }));

        // Record signals in service
        await adaptiveService.recordSignals(processedSignals);

        // Store in database (batch insert)
        try {
            for (const signal of processedSignals) {
                await db.insert(adaptiveBehaviorSignals).values({
                    id: signal.id,
                    projectId: signal.projectId,
                    sessionId: signal.sessionId,
                    signalType: signal.signalType,
                    element: signal.element as any,
                    context: signal.context as any,
                    timestamp: signal.timestamp.toISOString(),
                });
            }
        } catch (dbError) {
            // Log but don't fail - in-memory processing is primary
            console.error('Database insert error:', dbError);
        }

        // Broadcast to SSE clients
        broadcastToProject(projectId, {
            type: 'signals:received',
            count: processedSignals.length,
        });

        res.json({
            success: true,
            processed: processedSignals.length,
        });
    } catch (error) {
        console.error('Error processing signals:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process signals',
        });
    }
});

/**
 * GET /api/adaptive/patterns/:projectId
 * Get detected patterns
 */
router.get('/patterns/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { type, severity, limit } = req.query;

        const adaptiveService = getAdaptiveUIService();
        let patterns = adaptiveService.getPatterns(projectId);

        // Filter by type
        if (type && typeof type === 'string') {
            patterns = patterns.filter(p => p.patternType === type);
        }

        // Filter by severity
        if (severity && typeof severity === 'string') {
            patterns = patterns.filter(p => p.severity === severity);
        }

        // Sort by frequency (most frequent first)
        patterns.sort((a, b) => b.frequency - a.frequency);

        // Limit
        if (limit) {
            patterns = patterns.slice(0, parseInt(limit as string, 10));
        }

        res.json({
            success: true,
            patterns,
            total: patterns.length,
        });
    } catch (error) {
        console.error('Error getting patterns:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get patterns',
        });
    }
});

/**
 * GET /api/adaptive/suggestions/:projectId
 * Get UI suggestions
 */
router.get('/suggestions/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { status, autoApply } = req.query;

        const adaptiveService = getAdaptiveUIService();
        let suggestions = adaptiveService.getSuggestions(projectId);

        // Filter by status
        if (status && typeof status === 'string') {
            suggestions = suggestions.filter(s => s.status === status);
        }

        // Filter by auto-apply
        if (autoApply === 'true') {
            suggestions = suggestions.filter(s => s.autoApply);
        }

        // Sort by predicted impact (highest first)
        suggestions.sort((a, b) => b.predictedImpact - a.predictedImpact);

        res.json({
            success: true,
            suggestions,
            total: suggestions.length,
        });
    } catch (error) {
        console.error('Error getting suggestions:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get suggestions',
        });
    }
});

/**
 * POST /api/adaptive/apply/:suggestionId
 * Apply a suggestion
 */
router.post('/apply/:suggestionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { suggestionId } = req.params;
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'projectId is required',
            });
        }

        const adaptiveService = getAdaptiveUIService();
        const suggestion = await adaptiveService.applySuggestion(suggestionId, projectId);

        if (!suggestion) {
            return res.status(404).json({
                success: false,
                error: 'Suggestion not found',
            });
        }

        // Update database
        try {
            await db.update(adaptivePatterns)
                .set({ suggestedFix: suggestion as any })
                .where(eq(adaptivePatterns.id, suggestion.patternId));
        } catch (dbError) {
            console.error('Database update error:', dbError);
        }

        // Broadcast update
        broadcastToProject(projectId, {
            type: 'suggestion:applied',
            suggestion,
        });

        res.json({
            success: true,
            suggestion,
        });
    } catch (error) {
        console.error('Error applying suggestion:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to apply suggestion',
        });
    }
});

/**
 * POST /api/adaptive/dismiss/:suggestionId
 * Dismiss a suggestion
 */
router.post('/dismiss/:suggestionId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { suggestionId } = req.params;
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'projectId is required',
            });
        }

        const adaptiveService = getAdaptiveUIService();
        const suggestion = adaptiveService.dismissSuggestion(suggestionId, projectId);

        if (!suggestion) {
            return res.status(404).json({
                success: false,
                error: 'Suggestion not found',
            });
        }

        // Broadcast update
        broadcastToProject(projectId, {
            type: 'suggestion:dismissed',
            suggestionId,
        });

        res.json({
            success: true,
            suggestion,
        });
    } catch (error) {
        console.error('Error dismissing suggestion:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to dismiss suggestion',
        });
    }
});

/**
 * GET /api/adaptive/heatmap/:projectId
 * Get interaction heatmap data
 */
router.get('/heatmap/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { pageUrl } = req.query;

        const adaptiveService = getAdaptiveUIService();
        const heatmap = adaptiveService.getHeatmapData(
            projectId,
            pageUrl ? String(pageUrl) : undefined
        );

        res.json({
            success: true,
            heatmap,
        });
    } catch (error) {
        console.error('Error getting heatmap:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get heatmap',
        });
    }
});

/**
 * GET /api/adaptive/stats/:projectId
 * Get statistics for a project
 */
router.get('/stats/:projectId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const adaptiveService = getAdaptiveUIService();
        const stats = adaptiveService.getStatistics(projectId);

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get stats',
        });
    }
});

/**
 * GET /api/adaptive/stream/:projectId
 * SSE endpoint for real-time updates
 */
router.get('/stream/:projectId', authMiddleware, (req: Request, res: Response) => {
    const { projectId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register client
    if (!sseClients.has(projectId)) {
        sseClients.set(projectId, []);
    }
    sseClients.get(projectId)!.push(res);

    // Send initial ping with current stats
    const adaptiveService = getAdaptiveUIService();
    const stats = adaptiveService.getStatistics(projectId);
    res.write(`data: ${JSON.stringify({ type: 'connected', stats })}\n\n`);

    // Handle disconnect
    req.on('close', () => {
        const clients = sseClients.get(projectId);
        if (clients) {
            const index = clients.indexOf(res);
            if (index > -1) {
                clients.splice(index, 1);
            }
            if (clients.length === 0) {
                sseClients.delete(projectId);
            }
        }
    });
});

/**
 * Broadcast to all SSE clients for a project
 */
function broadcastToProject(projectId: string, data: unknown): void {
    const clients = sseClients.get(projectId);
    if (clients) {
        const message = JSON.stringify(data);
        clients.forEach(client => {
            try {
                client.write(`data: ${message}\n\n`);
            } catch {
                // Client disconnected
            }
        });
    }
}

// Set up event listeners for broadcasting
const adaptiveService = getAdaptiveUIService();

adaptiveService.on('pattern:detected', (pattern: BehaviorPattern) => {
    broadcastToProject(pattern.projectId, { type: 'pattern:detected', pattern });
});

adaptiveService.on('suggestion:created', (suggestion: UISuggestion) => {
    // Find the pattern to get projectId
    const patterns = adaptiveService.getPatterns('*');
    const pattern = patterns.find(p => p.id === suggestion.patternId);
    if (pattern) {
        broadcastToProject(pattern.projectId, { type: 'suggestion:created', suggestion });
    }
});

export default router;

