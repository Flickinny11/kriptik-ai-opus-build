/**
 * AI Services API Routes
 *
 * Endpoints for AI-powered features:
 * - Image-to-code
 * - Self-healing
 * - Test generation
 */

import { Router, Request, Response } from 'express';
import { getImageToCodeService } from '../services/ai/image-to-code';
import { getSelfHealingService, detectErrors } from '../services/ai/self-healing';
import { getTestGeneratorService } from '../services/ai/test-generator';
import { db } from '../db';
import { files as filesTable } from '../schema';
import { eq } from 'drizzle-orm';

const router = Router();

// ============================================================================
// IMAGE-TO-CODE
// ============================================================================

/**
 * POST /api/ai/image-to-code
 * Convert image(s) to code
 */
router.post('/image-to-code', async (req: Request, res: Response) => {
    try {
        const { images, framework, styling, componentName, includeResponsive, includeAccessibility } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'At least one image is required' });
        }

        const service = getImageToCodeService();

        // For SSE streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const result = await service.convertWithStreaming(
            {
                images: images.map((img: string) => ({ type: 'url' as const, url: img })),
                framework: framework || 'react',
                styling: styling || 'tailwind',
                componentName,
                includeResponsive: includeResponsive ?? true,
                includeAccessibility: includeAccessibility ?? true,
            },
            (update) => {
                res.write(`event: progress\n`);
                res.write(`data: ${JSON.stringify(update)}\n\n`);
            }
        );

        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(result)}\n\n`);
        res.end();
    } catch (error) {
        console.error('Image-to-code error:', error);
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Conversion failed' })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/ai/image-to-code/simple
 * Convert image(s) to code (non-streaming)
 */
router.post('/image-to-code/simple', async (req: Request, res: Response) => {
    try {
        const { images, framework, styling, componentName } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'At least one image is required' });
        }

        const service = getImageToCodeService();
        const result = await service.convert({
            images: images.map((img: string) => ({ type: 'url' as const, url: img })),
            framework: framework || 'react',
            styling: styling || 'tailwind',
            componentName,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Conversion failed',
        });
    }
});

// ============================================================================
// SELF-HEALING
// ============================================================================

/**
 * POST /api/ai/heal/:projectId
 * Run self-healing on project files
 */
router.post('/heal/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { autoApply, maxFixes } = req.body;

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

        // SSE streaming for progress
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const service = getSelfHealingService();
        const result = await service.heal(files, {
            autoApply: autoApply ?? false,
            maxFixes: maxFixes ?? 10,
            onProgress: (update) => {
                res.write(`event: progress\n`);
                res.write(`data: ${JSON.stringify(update)}\n\n`);
            },
        });

        // If autoApply, save fixed files to database
        if (autoApply && result.fixes.length > 0) {
            for (const fix of result.fixes) {
                if (fix.validated) {
                    const file = projectFiles.find(f => f.path === fix.file);
                    if (file) {
                        await db
                            .update(filesTable)
                            .set({ content: fix.fixedCode, updatedAt: new Date().toISOString() })
                            .where(eq(filesTable.id, file.id));
                    }
                }
            }
        }

        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(result)}\n\n`);
        res.end();
    } catch (error) {
        console.error('Healing error:', error);
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Healing failed' })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/ai/detect-errors
 * Detect errors in code (without fixing)
 */
router.post('/detect-errors', async (req: Request, res: Response) => {
    try {
        const { files } = req.body;

        if (!files || typeof files !== 'object') {
            return res.status(400).json({ error: 'files object is required' });
        }

        const errors = await detectErrors(files);
        res.json({ errors });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Error detection failed',
        });
    }
});

// ============================================================================
// TEST GENERATION
// ============================================================================

/**
 * POST /api/ai/generate-tests
 * Generate tests for source code
 */
router.post('/generate-tests', async (req: Request, res: Response) => {
    try {
        const { sourceFile, sourceCode, testTypes, framework, coverageTarget, focusAreas } = req.body;

        if (!sourceFile || !sourceCode) {
            return res.status(400).json({ error: 'sourceFile and sourceCode are required' });
        }

        const service = getTestGeneratorService();
        const result = await service.generateTests({
            sourceFile,
            sourceCode,
            testTypes,
            framework,
            coverageTarget,
            focusAreas,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Test generation failed',
        });
    }
});

/**
 * POST /api/ai/generate-tests/:projectId
 * Generate tests for a project file
 */
router.post('/generate-tests/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { filePath, testTypes, framework, coverageTarget } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'filePath is required' });
        }

        // Get file from database
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        const file = projectFiles.find(f => f.path === filePath);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Get existing tests if any
        const testFile = projectFiles.find(f =>
            f.path.includes('__tests__') && f.path.includes(file.path.split('/').pop()?.replace(/\.[^.]+$/, '') || '')
        );

        const service = getTestGeneratorService();
        const result = await service.generateTests({
            sourceFile: file.path,
            sourceCode: file.content,
            testTypes,
            framework,
            coverageTarget,
            existingTests: testFile?.content,
        });

        // Save generated test files to database
        for (const testFileData of result.testFiles) {
            const existing = projectFiles.find(f => f.path === testFileData.path);
            if (existing) {
                await db
                    .update(filesTable)
                    .set({ content: testFileData.content, updatedAt: new Date().toISOString() })
                    .where(eq(filesTable.id, existing.id));
            } else {
                await db.insert(filesTable).values({
                    projectId,
                    path: testFileData.path,
                    content: testFileData.content,
                    language: 'typescript',
                });
            }
        }

        res.json({
            ...result,
            message: `Generated ${result.summary.totalTests} tests across ${result.testFiles.length} files`,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Test generation failed',
        });
    }
});

export default router;

