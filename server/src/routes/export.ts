/**
 * Export & Import API Routes
 *
 * Endpoints for exporting/importing projects to/from GitHub and other platforms.
 */

import { Router, Request, Response } from 'express';
import { createGitHubExportService, ExportConfig, ProjectFile } from '../services/export/github.js';
import { db } from '../db.js';
import { files as filesTable, projects } from '../schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

// ============================================================================
// GITHUB IMPORT
// ============================================================================

/**
 * POST /api/export/github/import
 * Import a GitHub repository into a KripTik project
 */
router.post('/github/import', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const githubToken = req.headers['x-github-token'] as string || process.env.GITHUB_TOKEN;

        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { repoUrl, branch = 'main', projectName } = req.body;

        if (!repoUrl) {
            return res.status(400).json({ error: 'repoUrl is required' });
        }

        // Parse the repo URL to get owner/repo
        const repoMatch = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (!repoMatch) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }

        const [, owner, repo] = repoMatch;

        // Fetch repository contents from GitHub API
        const contentsResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'KripTik-AI',
                },
            }
        );

        if (!contentsResponse.ok) {
            const error = await contentsResponse.json().catch(() => ({}));
            return res.status(contentsResponse.status).json({
                error: error.message || 'Failed to fetch repository contents',
            });
        }

        const treeData = await contentsResponse.json();

        // Filter to only include files (not directories)
        const fileEntries = treeData.tree.filter((item: any) => item.type === 'blob');

        // Limit file count to prevent abuse
        if (fileEntries.length > 500) {
            return res.status(400).json({
                error: 'Repository too large. Maximum 500 files supported.',
                fileCount: fileEntries.length,
            });
        }

        // Create new project
        const projectId = uuidv4();
        const finalProjectName = projectName || repo;

        await db.insert(projects).values({
            id: projectId,
            name: finalProjectName,
            description: `Imported from GitHub: ${owner}/${repo}`,
            ownerId: userId,
            framework: 'react', // Default, could be detected
        });

        // Fetch and import files (in batches to avoid rate limits)
        const importedFiles: string[] = [];
        const errors: string[] = [];

        // Filter out certain files/patterns
        const skipPatterns = [
            /^node_modules\//,
            /^\.git\//,
            /^dist\//,
            /^build\//,
            /^\.next\//,
            /\.lock$/,
            /^package-lock\.json$/,
            /^yarn\.lock$/,
            /^pnpm-lock\.yaml$/,
        ];

        const filesToImport = fileEntries.filter((entry: any) => {
            return !skipPatterns.some(pattern => pattern.test(entry.path));
        });

        // Fetch files in parallel (batches of 10)
        const batchSize = 10;
        for (let i = 0; i < filesToImport.length; i += batchSize) {
            const batch = filesToImport.slice(i, i + batchSize);

            await Promise.all(
                batch.map(async (entry: any) => {
                    try {
                        const fileResponse = await fetch(
                            `https://api.github.com/repos/${owner}/${repo}/contents/${entry.path}?ref=${branch}`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${githubToken}`,
                                    'Accept': 'application/vnd.github.v3+json',
                                    'User-Agent': 'KripTik-AI',
                                },
                            }
                        );

                        if (!fileResponse.ok) {
                            errors.push(`Failed to fetch: ${entry.path}`);
                            return;
                        }

                        const fileData = await fileResponse.json();

                        // Skip if file is too large or binary
                        if (fileData.size > 500000) { // 500KB limit
                            errors.push(`Skipped large file: ${entry.path}`);
                            return;
                        }

                        if (fileData.encoding !== 'base64' || !fileData.content) {
                            errors.push(`Skipped non-text file: ${entry.path}`);
                            return;
                        }

                        // Decode content
                        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

                        // Detect language from extension
                        const ext = entry.path.split('.').pop()?.toLowerCase() || '';
                        const languageMap: Record<string, string> = {
                            ts: 'typescript',
                            tsx: 'typescript',
                            js: 'javascript',
                            jsx: 'javascript',
                            json: 'json',
                            css: 'css',
                            scss: 'scss',
                            html: 'html',
                            md: 'markdown',
                            py: 'python',
                            yaml: 'yaml',
                            yml: 'yaml',
                        };

                        // Insert file into database
                        await db.insert(filesTable).values({
                            projectId,
                            path: entry.path,
                            content,
                            language: languageMap[ext] || 'text',
                        });

                        importedFiles.push(entry.path);
                    } catch (err) {
                        errors.push(`Error processing: ${entry.path}`);
                    }
                })
            );
        }

        // Detect framework from imported files
        let detectedFramework = 'react';
        const hasPackageJson = importedFiles.includes('package.json');
        if (hasPackageJson) {
            const pkgFile = await db
                .select()
                .from(filesTable)
                .where(eq(filesTable.projectId, projectId))
                .then(files => files.find(f => f.path === 'package.json'));

            if (pkgFile) {
                try {
                    const pkg = JSON.parse(pkgFile.content);
                    if (pkg.dependencies?.next) detectedFramework = 'nextjs';
                    else if (pkg.dependencies?.vue) detectedFramework = 'vue';
                    else if (pkg.dependencies?.svelte) detectedFramework = 'svelte';
                    else if (pkg.dependencies?.express) detectedFramework = 'node';
                } catch {
                    // Keep default
                }
            }
        }

        // Update project with detected framework
        await db
            .update(projects)
            .set({ framework: detectedFramework })
            .where(eq(projects.id, projectId));

        res.json({
            success: true,
            projectId,
            projectName: finalProjectName,
            filesImported: importedFiles.length,
            framework: detectedFramework,
            sourceRepo: `${owner}/${repo}`,
            errors: errors.length > 0 ? errors : undefined,
            message: `Successfully imported ${importedFiles.length} files from ${owner}/${repo}`,
        });
    } catch (error) {
        console.error('GitHub import error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Import failed',
        });
    }
});

/**
 * GET /api/export/github/repo-info
 * Get information about a GitHub repository
 */
router.get('/github/repo-info', async (req: Request, res: Response) => {
    try {
        const githubToken = req.headers['x-github-token'] as string || process.env.GITHUB_TOKEN;
        const { url } = req.query;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Repository URL is required' });
        }

        // Parse the repo URL
        const repoMatch = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (!repoMatch) {
            return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }

        const [, owner, repo] = repoMatch;

        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'KripTik-AI',
        };

        if (githubToken) {
            headers['Authorization'] = `Bearer ${githubToken}`;
        }

        const repoResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            { headers }
        );

        if (!repoResponse.ok) {
            return res.status(repoResponse.status).json({
                error: 'Repository not found or not accessible',
            });
        }

        const repoData = await repoResponse.json();

        res.json({
            name: repoData.name,
            fullName: repoData.full_name,
            description: repoData.description,
            defaultBranch: repoData.default_branch,
            language: repoData.language,
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            size: repoData.size,
            isPrivate: repoData.private,
            lastUpdated: repoData.updated_at,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get repository info',
        });
    }
});

export default router;

