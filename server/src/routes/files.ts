/**
 * Files API Routes
 *
 * Handles file operations within projects
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { projects, files } from '../schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

interface FileBody {
    path: string;
    content: string;
    language?: string;
}

interface BulkFilesBody {
    files: FileBody[];
}

/**
 * GET /api/projects/:projectId/files
 * Get all files for a project
 */
router.get('/:projectId/files', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.projectId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, projectId));

        // Transform to file tree structure
        const fileTree = buildFileTree(projectFiles);

        res.json({
            files: projectFiles,
            tree: fileTree,
        });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

/**
 * GET /api/projects/:projectId/files/:path
 * Get a specific file
 */
router.get('/:projectId/files/*path', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.projectId;
        const filePath = req.params.path; // Everything after /files/

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const [file] = await db
            .select()
            .from(files)
            .where(
                and(
                    eq(files.projectId, projectId),
                    eq(files.path, filePath)
                )
            );

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ file });
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

/**
 * POST /api/projects/:projectId/files
 * Create a new file
 */
router.post('/:projectId/files', async (req: Request<{ projectId: string }, object, FileBody>, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.projectId;
        const { path, content, language } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!path || typeof path !== 'string') {
            return res.status(400).json({ error: 'File path is required' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if file already exists
        const [existing] = await db
            .select()
            .from(files)
            .where(
                and(
                    eq(files.projectId, projectId),
                    eq(files.path, path)
                )
            );

        if (existing) {
            return res.status(409).json({ error: 'File already exists' });
        }

        const [newFile] = await db
            .insert(files)
            .values({
                projectId,
                path,
                content: content || '',
                language: language || inferLanguage(path),
            })
            .returning();

        // Update project timestamp
        await db
            .update(projects)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(projects.id, projectId));

        res.status(201).json({ file: newFile });
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ error: 'Failed to create file' });
    }
});

/**
 * PUT /api/projects/:projectId/files
 * Update a file (or create if doesn't exist - upsert)
 */
router.put('/:projectId/files', async (req: Request<{ projectId: string }, object, FileBody>, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.projectId;
        const { path, content, language } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!path || typeof path !== 'string') {
            return res.status(400).json({ error: 'File path is required' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if file exists
        const [existing] = await db
            .select()
            .from(files)
            .where(
                and(
                    eq(files.projectId, projectId),
                    eq(files.path, path)
                )
            );

        let file;
        if (existing) {
            // Update existing file
            [file] = await db
                .update(files)
                .set({
                    content: content !== undefined ? content : existing.content,
                    language: language || existing.language,
                    version: existing.version + 1,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(files.id, existing.id))
                .returning();
        } else {
            // Create new file
            [file] = await db
                .insert(files)
                .values({
                    projectId,
                    path,
                    content: content || '',
                    language: language || inferLanguage(path),
                })
                .returning();
        }

        // Update project timestamp
        await db
            .update(projects)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(projects.id, projectId));

        res.json({ file });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

/**
 * PUT /api/projects/:projectId/files/bulk
 * Bulk update/create files
 */
router.put('/:projectId/files/bulk', async (req: Request<{ projectId: string }, object, BulkFilesBody>, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.projectId;
        const { files: fileUpdates } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!Array.isArray(fileUpdates)) {
            return res.status(400).json({ error: 'Files array is required' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const results = [];

        for (const fileUpdate of fileUpdates) {
            const { path, content, language } = fileUpdate;

            if (!path) continue;

            // Check if file exists
            const [existing] = await db
                .select()
                .from(files)
                .where(
                    and(
                        eq(files.projectId, projectId),
                        eq(files.path, path)
                    )
                );

            let file;
            if (existing) {
                [file] = await db
                    .update(files)
                    .set({
                        content: content !== undefined ? content : existing.content,
                        language: language || existing.language,
                        version: existing.version + 1,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(files.id, existing.id))
                    .returning();
            } else {
                [file] = await db
                    .insert(files)
                    .values({
                        projectId,
                        path,
                        content: content || '',
                        language: language || inferLanguage(path),
                    })
                    .returning();
            }

            results.push(file);
        }

        // Update project timestamp
        await db
            .update(projects)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(projects.id, projectId));

        res.json({ files: results });
    } catch (error) {
        console.error('Error bulk updating files:', error);
        res.status(500).json({ error: 'Failed to update files' });
    }
});

/**
 * DELETE /api/projects/:projectId/files
 * Delete a file
 */
router.delete('/:projectId/files', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.projectId;
        const { path } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!path || typeof path !== 'string') {
            return res.status(400).json({ error: 'File path is required' });
        }

        // Verify project ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            );

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const [deleted] = await db
            .delete(files)
            .where(
                and(
                    eq(files.projectId, projectId),
                    eq(files.path, path)
                )
            )
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

/**
 * Build a file tree structure from flat file list
 */
interface FileTreeNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    path: string;
    children?: FileTreeNode[];
    language?: string;
}

function buildFileTree(fileList: Array<{ id: string; path: string; language: string }>): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const map = new Map<string, FileTreeNode>();

    for (const file of fileList) {
        const parts = file.path.split('/');
        let currentPath = '';
        let currentLevel = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            let node = map.get(currentPath);

            if (!node) {
                node = {
                    id: isFile ? file.id : `folder-${currentPath}`,
                    name: part,
                    type: isFile ? 'file' : 'folder',
                    path: currentPath,
                    ...(isFile ? { language: file.language } : { children: [] }),
                };
                map.set(currentPath, node);
                currentLevel.push(node);
            }

            if (!isFile && node.children) {
                currentLevel = node.children;
            }
        }
    }

    // Sort: folders first, then alphabetically
    const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        }).map(node => ({
            ...node,
            children: node.children ? sortNodes(node.children) : undefined,
        }));
    };

    return sortNodes(root);
}

/**
 * Infer language from file extension
 */
function inferLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
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
        dockerfile: 'dockerfile',
        sh: 'shell',
    };
    return languageMap[ext || ''] || 'text';
}

export default router;

