/**
 * Generate API Routes
 *
 * Handles AI generation with Server-Sent Events (SSE) for streaming
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { projects, files, generations } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { createOrchestrator, AgentLog, AgentType, AgentState } from '../services/ai/agent-orchestrator.js';
import { v4 as uuidv4 } from 'uuid';
import { getDesignTokensFile } from '../templates/design-tokens.js';
import { getDesignValidator } from '../services/ai/design-validator.js';

const router = Router();

interface GenerateBody {
    prompt: string;
    skipPhases?: AgentType[];
}

interface ChatBody {
    message: string;
    context?: {
        selectedFile?: string;
        selectedCode?: string;
    };
}

/**
 * POST /api/projects/:projectId/generate
 * Start AI generation with SSE streaming
 */
router.post('/:projectId/generate', async (req: Request<{ projectId: string }, object, GenerateBody>, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const projectId = req.params.projectId;
    const { prompt, skipPhases } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
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

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Send initial event
        sendSSE(res, 'start', { projectId, prompt });

        const sessionId = uuidv4();

        // Create orchestrator with callbacks
        const orchestrator = createOrchestrator({
            projectId,
            userId,
            sessionId,
            skipPhases,
            onLog: (log: AgentLog) => {
                sendSSE(res, 'log', {
                    id: log.id,
                    agentType: log.agentType,
                    message: log.message,
                    type: log.type,
                    timestamp: log.timestamp.toISOString(),
                });
            },
            onAgentStateChange: (agent: AgentType, state: AgentState) => {
                sendSSE(res, 'agent', {
                    agent,
                    status: state.status,
                    progress: state.progress,
                });
            },
            onFileUpdate: (path: string, content: string) => {
                sendSSE(res, 'file', { path, content });
            },
            onProgress: (phase: AgentType, progress: number) => {
                sendSSE(res, 'progress', { phase, progress });
            },
        });

        // Handle client disconnect
        req.on('close', () => {
            orchestrator.stop();
        });

        // Run the orchestration
        const result = await orchestrator.run(prompt);

        // Inject design tokens file into generated files
        const designTokens = getDesignTokensFile();
        result.files.set(designTokens.path, designTokens.content);
        sendSSE(res, 'file', { path: designTokens.path, content: designTokens.content });

        // Validate design quality
        const validator = getDesignValidator();
        const filesObject: Record<string, string> = {};
        for (const [path, content] of result.files) {
            filesObject[path] = content;
        }
        const validation = validator.validate(filesObject);

        // Send validation result
        sendSSE(res, 'validation', {
            passed: validation.passed,
            score: validation.score,
            summary: validation.summary,
            issueCount: validation.issues.length,
        });

        // Log validation issues if any
        if (validation.issues.length > 0) {
            sendSSE(res, 'log', {
                id: uuidv4(),
                agentType: 'refinement',
                message: `Design quality score: ${validation.score}/100. ${validation.issues.filter(i => i.severity === 'critical').length} critical issues found.`,
                type: validation.passed ? 'info' : 'warning',
                timestamp: new Date().toISOString(),
            });
        }

        // Save generated files to database
        for (const [path, content] of result.files) {
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
                await db
                    .update(files)
                    .set({
                        content,
                        version: existing.version + 1,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(files.id, existing.id));
            } else {
                await db.insert(files).values({
                    projectId,
                    path,
                    content,
                    language: inferLanguage(path),
                });
            }
        }

        // Record the generation
        await db.insert(generations).values({
            projectId,
            userId,
            prompt,
            output: {
                files: Array.from(result.files.entries()),
                plan: result.plan,
            },
            tokensUsed: result.usage.totalInputTokens + result.usage.totalOutputTokens,
            cost: calculateCost(result.usage),
            status: result.status === 'completed' ? 'completed' : 'failed',
        });

        // Update project timestamp
        await db
            .update(projects)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(projects.id, projectId));

        // Send completion event
        sendSSE(res, 'complete', {
            status: result.status,
            filesGenerated: result.files.size,
            usage: result.usage,
            timing: result.timing,
        });

        res.end();

    } catch (error) {
        console.error('Generation error:', error);
        sendSSE(res, 'error', {
            message: error instanceof Error ? error.message : 'Generation failed',
        });
        res.end();
    }
});

/**
 * POST /api/projects/:projectId/chat
 * Chat with AI about the project (non-streaming for simple queries)
 */
router.post('/:projectId/chat', async (req: Request<{ projectId: string }, object, ChatBody>, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const projectId = req.params.projectId;
    const { message, context } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
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

        // Get project files for context
        const projectFiles = await db
            .select()
            .from(files)
            .where(eq(files.projectId, projectId));

        // Build context from files
        let fileContext = '';
        if (context?.selectedFile) {
            const selectedFile = projectFiles.find(f => f.path === context.selectedFile);
            if (selectedFile) {
                fileContext = `\n\nCurrently viewing file: ${selectedFile.path}\n\`\`\`${selectedFile.language}\n${selectedFile.content}\n\`\`\``;
            }
        }

        if (context?.selectedCode) {
            fileContext += `\n\nSelected code:\n\`\`\`\n${context.selectedCode}\n\`\`\``;
        }

        // Import Claude service
        const { createClaudeService } = await import('../services/ai/claude-service.js');

        const claudeService = createClaudeService({
            projectId,
            userId,
            agentType: 'generation',
            existingFiles: new Map(projectFiles.map(f => [f.path, f.content])),
        });

        const response = await claudeService.generate(
            `${message}${fileContext}`,
            {
                useExtendedThinking: false,
                maxTokens: 4096,
            }
        );

        res.json({
            response: response.content,
            usage: response.usage,
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Chat failed',
        });
    }
});

/**
 * POST /api/projects/:projectId/generate/stop
 * Stop an ongoing generation
 */
router.post('/:projectId/generate/stop', async (req: Request, res: Response) => {
    // This would require storing orchestrator instances by session
    // For now, client-side disconnect handles this via SSE
    res.json({ success: true, message: 'Disconnect from SSE stream to stop generation' });
});

/**
 * GET /api/projects/:projectId/generations
 * Get generation history for a project
 */
router.get('/:projectId/generations', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const projectId = req.params.projectId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
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

        const projectGenerations = await db
            .select({
                id: generations.id,
                prompt: generations.prompt,
                tokensUsed: generations.tokensUsed,
                cost: generations.cost,
                status: generations.status,
                createdAt: generations.createdAt,
            })
            .from(generations)
            .where(eq(generations.projectId, projectId));

        res.json({ generations: projectGenerations });

    } catch (error) {
        console.error('Error fetching generations:', error);
        res.status(500).json({ error: 'Failed to fetch generations' });
    }
});

/**
 * Send SSE event
 */
function sendSSE(res: Response, event: string, data: object): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
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

/**
 * Calculate cost in credits based on token usage
 */
function calculateCost(usage: { totalInputTokens: number; totalOutputTokens: number; totalThinkingTokens: number }): number {
    // Claude Sonnet 4.5 pricing (approximate, in credits)
    // Input: ~$3 per 1M tokens
    // Output: ~$15 per 1M tokens
    // We convert to credits where 1 credit ≈ $0.01

    const inputCost = (usage.totalInputTokens / 1_000_000) * 300; // 300 credits per 1M input tokens
    const outputCost = (usage.totalOutputTokens / 1_000_000) * 1500; // 1500 credits per 1M output tokens
    const thinkingCost = (usage.totalThinkingTokens / 1_000_000) * 1500; // Same as output

    return Math.ceil(inputCost + outputCost + thinkingCost);
}

export default router;

