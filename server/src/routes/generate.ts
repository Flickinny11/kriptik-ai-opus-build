/**
 * Generate API Routes
 *
 * Handles AI generation with Server-Sent Events (SSE) for streaming
 * Includes Quality Gate integration for automatic refinement loops
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { projects, files, generations, users } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { createOrchestrator, AgentLog, AgentType, AgentState } from '../services/ai/agent-orchestrator.js';
import { v4 as uuidv4 } from 'uuid';
import { getDesignTokensFile } from '../templates/design-tokens.js';
import { getQualityGateService } from '../services/ai/quality-gate.js';
import { getComponentRegistry } from '../services/templates/component-registry.js';
import { getCreditService, calculateCreditsForGeneration } from '../services/billing/credits.js';
import { getContentAnalyzer } from '../services/moderation/content-analyzer.js';
import { getUsageService } from '../services/billing/usage-service.js';
import { getCreditPoolService } from '../services/billing/credit-pool.js';
// Rich Context Integration
import {
    loadUnifiedContext,
    formatUnifiedContextForCodeGen,
    type UnifiedContext,
} from '../services/ai/unified-context.js';
import {
    getPredictiveErrorPrevention,
    type PredictionResult,
} from '../services/ai/predictive-error-prevention.js';

const router = Router();

function getRequestUserId(req: Request): string | null {
    const sessionUserId = (req as any).user?.id;
    const legacyUserId = (req as any).userId;
    const headerUserId = req.headers['x-user-id'];

    if (typeof sessionUserId === 'string' && sessionUserId.length > 0) return sessionUserId;
    if (typeof legacyUserId === 'string' && legacyUserId.length > 0) return legacyUserId;
    if (typeof headerUserId === 'string' && headerUserId.length > 0) return headerUserId;
    return null;
}

interface IntelligenceSettings {
    thinkingDepth: 'shallow' | 'normal' | 'deep' | 'maximum';
    powerLevel: 'economy' | 'balanced' | 'performance' | 'maximum';
    speedPriority: 'fastest' | 'fast' | 'balanced' | 'quality' | 'maximum-quality';
    creativityLevel: 'conservative' | 'balanced' | 'creative' | 'experimental';
    codeVerbosity: 'minimal' | 'standard' | 'verbose';
    designDetail: 'minimal' | 'standard' | 'polished' | 'premium';
}

interface GenerateBody {
    prompt: string;
    skipPhases?: AgentType[];
    intelligenceSettings?: IntelligenceSettings;
    acknowledgedWarningId?: string;
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
    const userId = getRequestUserId(req as unknown as Request);
    const projectId = req.params.projectId;
    const { prompt, skipPhases, intelligenceSettings } = req.body;

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

        // Content analysis for competitor protection
        const contentAnalyzer = getContentAnalyzer();
        const analysis = contentAnalyzer.analyze(prompt);

        if (analysis.flagged && analysis.requiresAcknowledgment) {
            // Check if user already acknowledged this warning
            const acknowledgedWarningId = req.body.acknowledgedWarningId;

            if (!acknowledgedWarningId) {
                // Log the flag
                await contentAnalyzer.logFlag(userId, prompt, analysis, false);

                // Return warning - user must acknowledge to proceed
                const warningId = uuidv4();
                return res.json({
                    success: false,
                    requiresAcknowledgment: true,
                    warning: {
                        type: analysis.category === 'competitor_clone' ? 'ip_warning' : 'competitor_warning',
                        message: analysis.warningMessage,
                        requiresAcknowledgment: true,
                        warningId,
                        category: analysis.category,
                        confidence: analysis.confidence,
                    },
                });
            }

            // User acknowledged - log and proceed
            await contentAnalyzer.logFlag(userId, prompt, analysis, true);
        } else if (analysis.flagged && !analysis.requiresAcknowledgment) {
            // Soft warning - just log, don't block
            await contentAnalyzer.logFlag(userId, prompt, analysis, true);
        }

        // Get user tier for credit pool tracking
        const [user] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId));
        const isFreeTier = !user || user.tier === 'free';

        // Check credit pool can afford this call
        const pool = getCreditPoolService();
        const estimatedCostCents = 50; // Rough estimate - adjust based on model
        const affordCheck = await pool.canAffordApiCall(estimatedCostCents, isFreeTier);

        if (!affordCheck.allowed) {
            return res.status(503).json({
                error: 'service_capacity_reached',
                message: 'Our AI services are temporarily at capacity. Please try again in a few minutes.',
                retryAfter: 60,
            });
        }

        // Load unified context for rich code generation
        let unifiedContext: UnifiedContext | null = null;
        let errorPrediction: PredictionResult | null = null;
        let enrichedPrompt = prompt;

        try {
            // Load project context (intent lock, learned patterns, error history, etc.)
            const contextProjectPath = `/tmp/builds/${projectId}`;
            unifiedContext = await loadUnifiedContext(projectId, userId, contextProjectPath, {
                includeIntentLock: true,
                includeVerificationResults: true,
                includeLearningData: true,
                includeErrorHistory: true,
                includeProjectAnalysis: true,
                includeUserPreferences: true,
            });

            // Get predictive error prevention analysis
            const errorPrevention = getPredictiveErrorPrevention();
            errorPrediction = await errorPrevention.predict({
                projectId,
                taskType: 'code_generation',
                taskDescription: prompt.slice(0, 500),
                recentErrors: [], // Could load from error history if needed
            });

            // Enrich prompt with unified context
            const contextBlock = formatUnifiedContextForCodeGen(unifiedContext);
            const preventionGuidance = errorPrediction.predictions.length > 0
                ? `\n\n## PREDICTED ISSUES TO PREVENT:\n${errorPrediction.predictions.map(p =>
                    `- [${p.type.toUpperCase()}] ${p.description} (${Math.round(p.confidence * 100)}% likely)\n  Prevention: ${p.prevention.instruction}`
                  ).join('\n')}`
                : '';

            enrichedPrompt = `${contextBlock}${preventionGuidance}\n\n## USER REQUEST:\n${prompt}`;

            sendSSE(res, 'log', {
                id: uuidv4(),
                agentType: 'context',
                message: `Loaded unified context: ${unifiedContext.intentLock ? 'Intent Lock' : ''} ${unifiedContext.learnedPatterns?.length || 0} patterns, ${errorPrediction.predictions.length} predicted issues`,
                type: 'info',
                timestamp: new Date().toISOString(),
            });
        } catch (contextError) {
            // Context loading is non-blocking - continue with original prompt
            console.warn('Context loading failed, proceeding with basic prompt:', contextError);
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Send initial event
        sendSSE(res, 'start', { projectId, prompt });

        const sessionId = uuidv4();

        // Create orchestrator with callbacks and intelligence settings
        const orchestrator = createOrchestrator({
            projectId,
            userId,
            sessionId,
            skipPhases,
            intelligenceSettings,  // Pass intelligence settings for model/thinking configuration
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

        // Run the orchestration with enriched prompt (includes unified context + error prevention)
        const result = await orchestrator.run(enrichedPrompt);

        // Inject design tokens file into generated files
        const designTokens = getDesignTokensFile();
        result.files.set(designTokens.path, designTokens.content);
        sendSSE(res, 'file', { path: designTokens.path, content: designTokens.content });

        // Quality Gate: Evaluate and auto-refine if needed
        const qualityGate = getQualityGateService();
        let filesObject: Record<string, string> = {};
        for (const [path, content] of result.files) {
            filesObject[path] = content;
        }

        // Initial quality evaluation
        let qualityResult = qualityGate.evaluate(filesObject);

        sendSSE(res, 'log', {
            id: uuidv4(),
            agentType: 'refinement',
            message: `Quality Gate: Design=${qualityResult.scores.design}%, Accessibility=${qualityResult.scores.accessibility}%, Code=${qualityResult.scores.codeQuality}%`,
            type: 'info',
            timestamp: new Date().toISOString(),
        });

        // Auto-refine if quality is below threshold
        if (qualityResult.refinementNeeded) {
            sendSSE(res, 'log', {
                id: uuidv4(),
                agentType: 'refinement',
                message: `Quality below threshold. Starting automatic refinement...`,
                type: 'warning',
                timestamp: new Date().toISOString(),
            });

            try {
                const refinementResult = await qualityGate.refine(filesObject, prompt);

                if (refinementResult.success) {
                    // Update files with refined versions
                    for (const [path, content] of Object.entries(refinementResult.refinedFiles)) {
                        result.files.set(path, content);
                        sendSSE(res, 'file', { path, content });
                    }
                    filesObject = refinementResult.refinedFiles;
                    qualityResult = qualityGate.evaluate(filesObject);

                    sendSSE(res, 'log', {
                        id: uuidv4(),
                        agentType: 'refinement',
                        message: `Refinement complete! Score improved: ${refinementResult.originalScore}% → ${refinementResult.finalScore}% (${refinementResult.iterations} iterations)`,
                        type: 'success',
                        timestamp: new Date().toISOString(),
                    });
                }
            } catch (refinementError) {
                sendSSE(res, 'log', {
                    id: uuidv4(),
                    agentType: 'refinement',
                    message: `Auto-refinement failed: ${refinementError instanceof Error ? refinementError.message : 'Unknown error'}`,
                    type: 'error',
                    timestamp: new Date().toISOString(),
                });
            }
        }

        // Cache high-quality components in the registry
        if (qualityResult.scores.overall >= 70) {
            const registry = getComponentRegistry();
            for (const [path, content] of Object.entries(filesObject)) {
                if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
                    registry.register({
                        prompt: prompt,
                        component: content,
                        qualityScore: qualityResult.scores.overall,
                        tokens: {
                            input: result.usage.totalInputTokens,
                            output: result.usage.totalOutputTokens,
                        },
                    });
                }
            }
        }

        // Send validation result
        sendSSE(res, 'validation', {
            passed: qualityResult.passed,
            score: qualityResult.scores.overall,
            scores: qualityResult.scores,
            summary: `Design: ${qualityResult.scores.design}%, Accessibility: ${qualityResult.scores.accessibility}%, Code: ${qualityResult.scores.codeQuality}%`,
            issueCount: qualityResult.issues.length,
        });

        // Log validation issues if any
        if (qualityResult.issues.length > 0) {
            const criticalCount = qualityResult.issues.filter(i => i.severity === 'critical').length;
            const warningCount = qualityResult.issues.filter(i => i.severity === 'warning').length;
            sendSSE(res, 'log', {
                id: uuidv4(),
                agentType: 'refinement',
                message: `Quality Gate: ${criticalCount} critical, ${warningCount} warnings. Overall: ${qualityResult.scores.overall}/100`,
                type: qualityResult.passed ? 'info' : 'warning',
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

        // Deduct credits based on actual usage
        const actualCredits = calculateCreditsForGeneration(
            'claude-sonnet-4-5', // Default model
            result.usage.totalInputTokens,
            result.usage.totalOutputTokens
        );

        try {
            const creditService = getCreditService();
            await creditService.deductCredits(
                userId,
                actualCredits,
                `Code generation for project: ${project.name}`,
                { projectId, generationId: sessionId, tokensUsed: result.usage.totalInputTokens + result.usage.totalOutputTokens }
            );

            sendSSE(res, 'credits', {
                deducted: actualCredits,
                reason: 'AI code generation',
            });

            // Record usage in persistent storage
            const usageService = getUsageService();
            await usageService.recordUsage({
                userId,
                projectId,
                category: 'generation',
                subcategory: 'code_generation',
                creditsUsed: actualCredits,
                tokensUsed: result.usage.totalInputTokens + result.usage.totalOutputTokens,
                model: 'claude-sonnet-4-5',
                endpoint: '/api/generate',
                metadata: {
                    promptLength: prompt.length,
                    filesGenerated: result.files.size,
                },
            });

            // Deduct actual cost from credit pool (estimate API cost in cents)
            const apiCostCents = Math.ceil((result.usage.totalInputTokens * 0.003 + result.usage.totalOutputTokens * 0.015) / 10);
            await pool.deductApiCost(apiCostCents, isFreeTier, userId, {
                model: 'claude-sonnet-4-5',
                tokens: result.usage.totalInputTokens + result.usage.totalOutputTokens,
                endpoint: '/api/generate',
            });
        } catch (creditError) {
            // Log but don't fail the request
            console.error('Credit deduction failed:', creditError);
        }

        // Send completion event
        sendSSE(res, 'complete', {
            status: result.status,
            filesGenerated: result.files.size,
            usage: result.usage,
            timing: result.timing,
            creditsUsed: actualCredits,
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
    const userId = getRequestUserId(req as unknown as Request);
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
    const userId = getRequestUserId(req as unknown as Request);
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

