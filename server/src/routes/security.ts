/**
 * Security API Routes
 *
 * Pre-deployment security scanning endpoints.
 */

import { Router, Request, Response } from 'express';
import { getSecurityScannerService } from '../services/security/scanner';
import { db } from '../db';
import { files as filesTable } from '../schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/security/scan/:projectId
 * Scan a project for security vulnerabilities
 */
router.post('/scan/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { includeDependencies, aiEnhanced } = req.body;

        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(404).json({ error: 'No files found for project' });
        }

        // Convert to file map
        const files: Record<string, string> = {};
        projectFiles.forEach(f => {
            files[f.path] = f.content;
        });

        // Run scan
        const scanner = getSecurityScannerService();
        const result = await scanner.scan(projectId, files, {
            includeDependencies: includeDependencies ?? true,
            aiEnhanced: aiEnhanced ?? false,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Security scan failed',
        });
    }
});

/**
 * POST /api/security/scan
 * Scan provided files for security vulnerabilities (without project)
 */
router.post('/scan', async (req: Request, res: Response) => {
    try {
        const { files, includeDependencies, aiEnhanced } = req.body;

        if (!files || typeof files !== 'object') {
            return res.status(400).json({ error: 'files object is required' });
        }

        const scanner = getSecurityScannerService();
        const result = await scanner.scan('inline-scan', files, {
            includeDependencies: includeDependencies ?? true,
            aiEnhanced: aiEnhanced ?? false,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Security scan failed',
        });
    }
});

/**
 * POST /api/security/gate/:projectId
 * Check if project passes deployment security gate
 */
router.post('/gate/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(404).json({ error: 'No files found for project' });
        }

        // Convert to file map
        const files: Record<string, string> = {};
        projectFiles.forEach(f => {
            files[f.path] = f.content;
        });

        // Run quick scan (no AI enhancement for speed)
        const scanner = getSecurityScannerService();
        const result = await scanner.scan(projectId, files, {
            includeDependencies: true,
            aiEnhanced: false,
        });

        if (result.passesDeploymentGate) {
            res.json({
                passes: true,
                grade: result.grade,
                score: result.overallScore,
                message: 'Project passes security gate for deployment',
            });
        } else {
            res.status(403).json({
                passes: false,
                grade: result.grade,
                score: result.overallScore,
                message: 'Project has critical/high severity issues that must be fixed before deployment',
                blockers: result.vulnerabilities.filter(v =>
                    v.severity === 'critical' || v.severity === 'high'
                ),
            });
        }
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Security gate check failed',
        });
    }
});

export default router;

