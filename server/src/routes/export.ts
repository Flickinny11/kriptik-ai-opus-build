/**
 * Export API Routes
 *
 * Endpoints for exporting projects to GitHub and other platforms.
 */

import { Router, Request, Response } from 'express';
import { createGitHubExportService, ExportConfig, ProjectFile } from '../services/export/github.js';
import { db } from '../db.js';
import { files as filesTable } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/export/github
 * Export project to GitHub
 */
router.post('/github', async (req: Request, res: Response) => {
    try {
        const { projectId, repoName, description, isPrivate, includeCI, deployTarget } = req.body;

        // Get GitHub token from user session or request
        const githubToken = req.headers['x-github-token'] as string || process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        if (!projectId || !repoName) {
            return res.status(400).json({ error: 'projectId and repoName are required' });
        }

        // Get project files from database
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(404).json({ error: 'No files found for project' });
        }

        // Convert to export format
        const exportFiles: ProjectFile[] = projectFiles.map(f => ({
            path: f.path,
            content: f.content,
            language: f.language,
        }));

        // Create export service and export
        const exportService = createGitHubExportService(githubToken);

        const exportConfig: ExportConfig = {
            repoName,
            description,
            isPrivate: isPrivate ?? false,
            includeCI: includeCI ?? true,
            includeDeploy: !!deployTarget,
            deployTarget,
            framework: 'react', // Could be inferred from project
        };

        const result = await exportService.exportProject(exportFiles, exportConfig);

        if (result.success) {
            res.json({
                success: true,
                repoUrl: result.repoUrl,
                cloneUrl: result.cloneUrl,
                filesCreated: result.filesCreated,
                message: `Successfully exported to ${result.repoUrl}`,
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Export failed',
        });
    }
});

/**
 * GET /api/export/github/repos
 * List user's GitHub repositories
 */
router.get('/github/repos', async (req: Request, res: Response) => {
    try {
        const githubToken = req.headers['x-github-token'] as string || process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        const exportService = createGitHubExportService(githubToken);
        const repos = await exportService.listRepositories();

        res.json({ repos });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to list repositories',
        });
    }
});

/**
 * GET /api/export/github/check-name/:name
 * Check if repository name is available
 */
router.get('/github/check-name/:name', async (req: Request, res: Response) => {
    try {
        const githubToken = req.headers['x-github-token'] as string || process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        const { name } = req.params;
        const exportService = createGitHubExportService(githubToken);
        const available = await exportService.isRepoNameAvailable(name);

        res.json({ available, name });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to check name',
        });
    }
});

export default router;

