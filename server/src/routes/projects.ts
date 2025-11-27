/**
 * Projects API Routes
 *
 * Handles project CRUD operations
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { projects, files } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Type definitions
interface CreateProjectBody {
    name: string;
    description?: string;
    framework?: 'react' | 'nextjs' | 'node' | 'python';
    isPublic?: boolean;
}

interface UpdateProjectBody {
    name?: string;
    description?: string;
    isPublic?: boolean;
}

/**
 * GET /api/projects
 * List all projects for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userProjects = await db
            .select()
            .from(projects)
            .where(eq(projects.ownerId, userId))
            .orderBy(desc(projects.updatedAt));

        res.json({ projects: userProjects });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req: Request<object, object, CreateProjectBody>, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, description, framework = 'react', isPublic = false } = req.body;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const [newProject] = await db
            .insert(projects)
            .values({
                name,
                description: description || null,
                ownerId: userId,
                framework,
                isPublic,
            })
            .returning();

        // Create initial project files based on framework
        const initialFiles = getInitialFiles(framework, name);

        for (const file of initialFiles) {
            await db.insert(files).values({
                projectId: newProject.id,
                path: file.path,
                content: file.content,
                language: file.language,
            });
        }

        res.status(201).json({ project: newProject });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

/**
 * GET /api/projects/:id
 * Get a specific project
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

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

        // Get project files
        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, projectId));

        res.json({
            project,
            files: projectFiles,
        });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', async (req: Request<{ id: string }, object, UpdateProjectBody>, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, description, isPublic } = req.body;

        const [updated] = await db
            .update(projects)
            .set({
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(isPublic !== undefined && { isPublic }),
                updatedAt: new Date().toISOString(),
            })
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            )
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ project: updated });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and all its files
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const projectId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Delete all project files first
        await db
            .delete(files)
            .where(eq(files.projectId, projectId));

        // Delete the project
        const [deleted] = await db
            .delete(projects)
            .where(
                and(
                    eq(projects.id, projectId),
                    eq(projects.ownerId, userId)
                )
            )
            .returning();

        if (!deleted) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

/**
 * Get initial files for a new project based on framework
 */
function getInitialFiles(framework: string, projectName: string): Array<{ path: string; content: string; language: string }> {
    const baseFiles = [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: projectName.toLowerCase().replace(/\s+/g, '-'),
                private: true,
                version: '0.0.1',
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'tsc && vite build',
                    preview: 'vite preview',
                },
                dependencies: {
                    react: '^18.3.1',
                    'react-dom': '^18.3.1',
                },
                devDependencies: {
                    '@types/react': '^18.3.12',
                    '@types/react-dom': '^18.3.1',
                    '@vitejs/plugin-react': '^4.3.3',
                    typescript: '~5.6.2',
                    vite: '^5.4.10',
                },
            }, null, 2),
            language: 'json',
        },
        {
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
            language: 'html',
        },
        {
            path: 'src/main.tsx',
            content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js';
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
            language: 'typescript',
        },
        {
            path: 'src/App.tsx',
            content: `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold text-gray-900">
        ${projectName}
      </h1>
    </div>
  )
}`,
            language: 'typescript',
        },
        {
            path: 'src/index.css',
            content: `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}`,
            language: 'css',
        },
        {
            path: 'vite.config.ts',
            content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
            language: 'typescript',
        },
        {
            path: 'tsconfig.json',
            content: JSON.stringify({
                compilerOptions: {
                    target: 'ES2020',
                    useDefineForClassFields: true,
                    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                    module: 'ESNext',
                    skipLibCheck: true,
                    moduleResolution: 'bundler',
                    allowImportingTsExtensions: true,
                    resolveJsonModule: true,
                    isolatedModules: true,
                    noEmit: true,
                    jsx: 'react-jsx',
                    strict: true,
                    noUnusedLocals: true,
                    noUnusedParameters: true,
                    noFallthroughCasesInSwitch: true,
                },
                include: ['src'],
            }, null, 2),
            language: 'json',
        },
    ];

    return baseFiles;
}

export default router;

