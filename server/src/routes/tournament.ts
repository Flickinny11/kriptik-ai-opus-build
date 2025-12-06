/**
 * Tournament Mode API Routes
 *
 * Endpoints for competing AI implementations:
 * - Start tournament builds
 * - Monitor competitor progress
 * - Get judge verdicts
 * - Select and merge winners
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================================
// TOURNAMENT STATE TYPES
// ============================================================================

interface TournamentCompetitor {
    id: string;
    name: string;
    status: 'pending' | 'building' | 'judging' | 'complete' | 'failed';
    scores?: {
        codeQuality?: number;
        visual?: number;
        antiSlop?: number;
        security?: number;
        creativity?: number;
        efficiency?: number;
    };
    buildTimeMs?: number;
    tokensUsed?: number;
    files: Map<string, string>;
    logs: string[];
}

interface TournamentState {
    id: string;
    status: 'pending' | 'running' | 'judging' | 'complete' | 'cancelled';
    phase: 'init' | 'building' | 'judging' | 'selecting' | 'complete';
    featureId: string;
    featureName: string;
    competitors: TournamentCompetitor[];
    winner: TournamentCompetitor | null;
    verdicts: Array<{
        judgeId: string;
        winnerId: string;
        reasoning: string;
    }>;
    startTime: Date;
    endTime?: Date;
}

// Active tournament sessions
const activeTournaments = new Map<string, TournamentState>();

/**
 * POST /api/tournament/start
 * Start a new tournament build
 */
router.post('/start', async (req: Request, res: Response) => {
    try {
        const {
            featureId,
            featureName,
            featureRequirements,
            competitorCount = 3,
            judgeCount = 3,
            buildTimeoutMs = 300000,
        } = req.body;

        const userId = (req as any).user?.id || 'anonymous';

        if (!featureId || !featureName || !featureRequirements) {
            return res.status(400).json({
                error: 'featureId, featureName, and featureRequirements are required',
            });
        }

        const tournamentId = `tournament-${uuidv4()}`;

        // Initialize competitors
        const competitors: TournamentCompetitor[] = Array.from({ length: competitorCount }, (_, i) => ({
            id: `competitor-${i + 1}`,
            name: `AI Agent ${i + 1}`,
            status: 'pending',
            files: new Map(),
            logs: [],
        }));

        const state: TournamentState = {
            id: tournamentId,
            status: 'pending',
            phase: 'init',
            featureId,
            featureName,
            competitors,
            winner: null,
            verdicts: [],
            startTime: new Date(),
        };

        activeTournaments.set(tournamentId, state);

        // Simulate tournament start (in production, this would be async)
        state.status = 'running';
        state.phase = 'building';
        competitors.forEach(c => c.status = 'building');

        res.json({
            success: true,
            tournamentId,
            config: {
                competitorCount,
                featureId,
                featureName,
                judgeCount,
                buildTimeoutMs,
            },
            status: 'started',
        });
    } catch (error) {
        console.error('Failed to start tournament:', error);
        res.status(500).json({
            error: 'Failed to start tournament',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/tournament/:id/status
 * Get tournament status and progress
 */
router.get('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const state = activeTournaments.get(id);

        if (!state) {
            return res.status(404).json({
                error: 'Tournament not found',
                tournamentId: id,
            });
        }

        res.json({
            success: true,
            tournamentId: id,
            status: state.status,
            phase: state.phase,
            competitors: state.competitors.map(c => ({
                id: c.id,
                name: c.name,
                status: c.status,
                scores: c.scores,
                buildTimeMs: c.buildTimeMs,
            })),
            winner: state.winner ? {
                id: state.winner.id,
                name: state.winner.name,
                scores: state.winner.scores,
            } : null,
            startTime: state.startTime,
            endTime: state.endTime,
        });
    } catch (error) {
        console.error('Failed to get tournament status:', error);
        res.status(500).json({
            error: 'Failed to get tournament status',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/tournament/:id/competitors
 * Get detailed competitor information
 */
router.get('/:id/competitors', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const state = activeTournaments.get(id);

        if (!state) {
            return res.status(404).json({
                error: 'Tournament not found',
                tournamentId: id,
            });
        }

        res.json({
            success: true,
            tournamentId: id,
            competitors: state.competitors.map(c => ({
                id: c.id,
                name: c.name,
                status: c.status,
                scores: c.scores,
                buildTimeMs: c.buildTimeMs,
                tokensUsed: c.tokensUsed,
                logs: c.logs.slice(-10),
            })),
        });
    } catch (error) {
        console.error('Failed to get competitors:', error);
        res.status(500).json({
            error: 'Failed to get competitors',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/tournament/:id/verdicts
 * Get judge verdicts
 */
router.get('/:id/verdicts', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const state = activeTournaments.get(id);

        if (!state) {
            return res.status(404).json({
                error: 'Tournament not found',
                tournamentId: id,
            });
        }

        res.json({
            success: true,
            tournamentId: id,
            verdicts: state.verdicts,
            winner: state.winner ? {
                id: state.winner.id,
                name: state.winner.name,
                scores: state.winner.scores,
            } : null,
        });
    } catch (error) {
        console.error('Failed to get verdicts:', error);
        res.status(500).json({
            error: 'Failed to get verdicts',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/tournament/:id/winner/files
 * Get winning implementation files
 */
router.get('/:id/winner/files', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const state = activeTournaments.get(id);

        if (!state) {
            return res.status(404).json({
                error: 'Tournament not found',
                tournamentId: id,
            });
        }

        if (!state.winner) {
            return res.status(400).json({
                error: 'No winner yet',
                status: state.status,
            });
        }

        // Convert Map to object for JSON
        const files: Record<string, string> = {};
        state.winner.files.forEach((content, path) => {
            files[path] = content;
        });

        res.json({
            success: true,
            tournamentId: id,
            winner: {
                id: state.winner.id,
                name: state.winner.name,
            },
            files,
        });
    } catch (error) {
        console.error('Failed to get winner files:', error);
        res.status(500).json({
            error: 'Failed to get winner files',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/tournament/:id/stop
 * Stop an active tournament
 */
router.post('/:id/stop', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const state = activeTournaments.get(id);

        if (!state) {
            return res.status(404).json({
                error: 'Tournament not found',
                tournamentId: id,
            });
        }

        state.status = 'cancelled';
        state.endTime = new Date();

        res.json({
            success: true,
            tournamentId: id,
            message: 'Tournament stopped',
        });
    } catch (error) {
        console.error('Failed to stop tournament:', error);
        res.status(500).json({
            error: 'Failed to stop tournament',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * DELETE /api/tournament/:id
 * Remove a completed tournament from memory
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!activeTournaments.has(id)) {
            return res.status(404).json({
                error: 'Tournament not found',
                tournamentId: id,
            });
        }

        activeTournaments.delete(id);

        res.json({
            success: true,
            tournamentId: id,
            message: 'Tournament removed',
        });
    } catch (error) {
        console.error('Failed to delete tournament:', error);
        res.status(500).json({
            error: 'Failed to delete tournament',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/tournament/active
 * List all active tournaments
 */
router.get('/active', async (_req: Request, res: Response) => {
    try {
        const tournaments = Array.from(activeTournaments.entries()).map(([id, state]) => ({
            tournamentId: id,
            status: state.status,
            phase: state.phase,
            competitorCount: state.competitors.length,
            hasWinner: !!state.winner,
        }));

        res.json({
            success: true,
            count: tournaments.length,
            tournaments,
        });
    } catch (error) {
        console.error('Failed to list tournaments:', error);
        res.status(500).json({
            error: 'Failed to list tournaments',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;
