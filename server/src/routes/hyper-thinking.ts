/**
 * Hyper-Thinking API Routes
 *
 * REST endpoints for advanced multi-model reasoning capabilities.
 *
 * Endpoints:
 *   POST /api/hyper-thinking/solve - Solve problem with hyper-thinking
 *   POST /api/hyper-thinking/solve/stream - Streaming solve (SSE)
 *   GET /api/hyper-thinking/strategies - List available strategies
 *   POST /api/hyper-thinking/analyze - Analyze task complexity
 *   POST /api/hyper-thinking/decompose - Decompose task into subtasks
 *   GET /api/hyper-thinking/artifacts - Get stored artifacts
 *   POST /api/hyper-thinking/artifacts/search - Search similar artifacts
 *   POST /api/hyper-thinking/tree-of-thought - Execute Tree-of-Thought reasoning
 *   POST /api/hyper-thinking/multi-agent - Execute Multi-Agent Reasoning Swarm
 *   GET /api/hyper-thinking/sessions - List reasoning sessions
 *   GET /api/hyper-thinking/sessions/:sessionId - Get session details
 *   GET /api/hyper-thinking/health - Service health check
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { hyperThinkingSessions, hyperThinkingArtifacts } from '../schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
    getHyperThinkingOrchestrator,
    ComplexityAnalyzer,
    type HyperThinkingConfig,
    type HyperThinkingInput,
    type ReasoningStrategy,
    type ModelTier,
    type ComplexityLevel,
    type TokenUsage,
} from '../services/hyper-thinking/index.js';
import { createToTEngine } from '../services/hyper-thinking/tree-of-thought/index.js';
import { createSwarmEngine, getSwarmEngine } from '../services/hyper-thinking/multi-agent/index.js';
import { createDecompositionEngine } from '../services/hyper-thinking/decomposition/index.js';
import { createArtifactStorage } from '../services/hyper-thinking/artifacts/index.js';
import { getCreditService } from '../services/billing/credits.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface SolveRequestBody {
    problem: string;
    context?: string;
    strategy?: ReasoningStrategy;
    modelTier?: ModelTier;
    maxThinkingBudget?: number;
    projectId?: string;
    enableStreaming?: boolean;
}

interface AnalyzeRequestBody {
    problem: string;
    context?: string;
}

interface DecomposeRequestBody {
    task: string;
    strategy?: 'functional' | 'data_flow' | 'architectural' | 'temporal' | 'hybrid';
    maxDepth?: number;
    projectId?: string;
}

interface ToTRequestBody {
    problem: string;
    context?: string;
    strategy?: 'bfs' | 'dfs' | 'beam';
    maxDepth?: number;
    beamWidth?: number;
    evaluationThreshold?: number;
}

interface MultiAgentRequestBody {
    problem: string;
    context?: string;
    maxAgents?: number;
    enableDebate?: boolean;
    debateRounds?: number;
}

interface ArtifactSearchBody {
    query: string;
    artifactType?: string;
    domain?: string;
    limit?: number;
    minScore?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getUserId(req: Request): string | null {
    return (req as Request & { user?: { id: string } }).user?.id || null;
}

function getTotalTokens(usage: TokenUsage | number | undefined): number {
    if (typeof usage === 'number') return usage;
    if (usage && typeof usage === 'object') {
        return usage.totalTokens || (usage.promptTokens || 0) + (usage.completionTokens || 0);
    }
    return 0;
}

async function trackCreditsUsage(
    userId: string,
    tokensUsed: number,
    operation: string
): Promise<{ success: boolean; creditsDeducted: number }> {
    try {
        const creditService = getCreditService();
        // Estimate credits: roughly 1000 tokens = 1 credit for hyper-thinking
        const creditsNeeded = Math.ceil(tokensUsed / 1000);
        
        const result = await creditService.deductCredits(
            userId,
            creditsNeeded,
            `hyper-thinking:${operation}`,
            { tokensUsed }
        );
        
        return {
            success: result.success,
            creditsDeducted: result.success ? creditsNeeded : 0,
        };
    } catch (error) {
        console.error('[HyperThinking] Credit tracking failed:', error);
        return { success: false, creditsDeducted: 0 };
    }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/hyper-thinking/solve
 *
 * Solve a problem using hyper-thinking (non-streaming)
 */
router.post('/solve', async (req: Request, res: Response) => {
    try {
        const body = req.body as SolveRequestBody;
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        if (!body.problem) {
            res.status(400).json({
                error: 'Missing required field: problem',
                code: 'MISSING_PROBLEM',
            });
            return;
        }

        const sessionId = uuidv4();
        const startTime = Date.now();

        // Get the orchestrator
        const orchestrator = getHyperThinkingOrchestrator();

        // Build configuration
        const config: Partial<HyperThinkingConfig> = {};
        if (body.strategy) config.strategy = body.strategy;
        if (body.modelTier) config.modelTier = body.modelTier;
        if (body.maxThinkingBudget) config.maxThinkingBudget = body.maxThinkingBudget;

        // Build input
        const input: HyperThinkingInput = {
            prompt: body.problem,
            context: body.context,
            config,
        };

        // Execute hyper-thinking
        const result = await orchestrator.think(input);

        const latencyMs = Date.now() - startTime;
        const tokensUsed = getTotalTokens(result.totalTokens);

        // Track credits
        const creditsResult = await trackCreditsUsage(userId, tokensUsed, 'solve');

        // Store session in database
        await db.insert(hyperThinkingSessions).values({
            userId,
            projectId: body.projectId || null,
            strategy: result.strategy,
            status: result.success ? 'completed' : 'failed',
            problem: body.problem,
            context: body.context || null,
            result: {
                success: result.success,
                strategy: result.strategy,
                finalAnswer: result.finalAnswer,
                confidence: result.confidence,
                reasoningPath: result.reasoningPath?.map(step => ({
                    id: step.id,
                    thought: step.thought,
                    evaluation: step.evaluation,
                })),
                metadata: result.metadata,
            },
            tokensUsed,
            latencyMs,
            creditsUsed: creditsResult.creditsDeducted,
        });

        res.json({
            success: true,
            data: {
                sessionId,
                strategy: result.strategy,
                answer: result.finalAnswer,
                confidence: result.confidence,
                reasoningPath: result.reasoningPath,
                metadata: result.metadata,
                tokensUsed,
                latencyMs,
                creditsUsed: creditsResult.creditsDeducted,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Solve error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to solve problem',
            code: 'SOLVE_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * POST /api/hyper-thinking/solve/stream
 *
 * Solve a problem with streaming (Server-Sent Events)
 */
router.post('/solve/stream', async (req: Request, res: Response) => {
    try {
        const body = req.body as SolveRequestBody;
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        if (!body.problem) {
            res.status(400).json({
                error: 'Missing required field: problem',
                code: 'MISSING_PROBLEM',
            });
            return;
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        const sessionId = uuidv4();
        const startTime = Date.now();
        let totalTokens = 0;

        // Send session start event
        res.write(`event: start\ndata: ${JSON.stringify({ sessionId, timestamp: new Date().toISOString() })}\n\n`);

        const orchestrator = getHyperThinkingOrchestrator();

        // Build configuration
        const config: Partial<HyperThinkingConfig> = {
            enableStreaming: true,
        };
        if (body.strategy) config.strategy = body.strategy;
        if (body.modelTier) config.modelTier = body.modelTier;
        if (body.maxThinkingBudget) config.maxThinkingBudget = body.maxThinkingBudget;

        // Build input
        const input: HyperThinkingInput = {
            prompt: body.problem,
            context: body.context,
            config,
        };

        // Execute with streaming
        const result = await orchestrator.think(input);

        const latencyMs = Date.now() - startTime;
        totalTokens = getTotalTokens(result.totalTokens) || totalTokens;

        // Track credits
        const creditsResult = await trackCreditsUsage(userId, totalTokens, 'solve_stream');

        // Store session in database
        await db.insert(hyperThinkingSessions).values({
            userId,
            projectId: body.projectId || null,
            strategy: result.strategy,
            status: result.success ? 'completed' : 'failed',
            problem: body.problem,
            context: body.context || null,
            result: {
                success: result.success,
                strategy: result.strategy,
                finalAnswer: result.finalAnswer,
                confidence: result.confidence,
            },
            tokensUsed: totalTokens,
            latencyMs,
            creditsUsed: creditsResult.creditsDeducted,
        });

        // Send final result
        res.write(`event: complete\ndata: ${JSON.stringify({
            sessionId,
            strategy: result.strategy,
            answer: result.finalAnswer,
            confidence: result.confidence,
            tokensUsed: totalTokens,
            latencyMs,
            creditsUsed: creditsResult.creditsDeducted,
            timestamp: new Date().toISOString(),
        })}\n\n`);

        res.end();
    } catch (error) {
        console.error('[HyperThinking] Stream error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({
            error: error instanceof Error ? error.message : 'Streaming failed',
            code: 'STREAM_FAILED',
        })}\n\n`);
        res.end();
    }
});

/**
 * GET /api/hyper-thinking/strategies
 *
 * List available reasoning strategies with descriptions
 */
router.get('/strategies', (_req: Request, res: Response) => {
    const strategies = [
        {
            id: 'chain_of_thought',
            name: 'Chain of Thought',
            description: 'Sequential reasoning through a problem step by step. Best for straightforward tasks.',
            complexity: 'simple' as ComplexityLevel,
            estimatedTokens: 8000,
        },
        {
            id: 'tree_of_thought',
            name: 'Tree of Thought',
            description: 'Parallel exploration of multiple solution paths with self-evaluation. 70% improvement on complex tasks.',
            complexity: 'complex' as ComplexityLevel,
            estimatedTokens: 32000,
        },
        {
            id: 'multi_agent',
            name: 'Multi-Agent Swarm',
            description: '3-5 parallel reasoning agents with debate and synthesis. Best for complex multi-faceted problems.',
            complexity: 'extreme' as ComplexityLevel,
            estimatedTokens: 64000,
        },
        {
            id: 'hybrid',
            name: 'Hybrid Strategy',
            description: 'Dynamically combines multiple strategies based on problem characteristics.',
            complexity: 'complex' as ComplexityLevel,
            estimatedTokens: 48000,
        },
    ];

    const modelTiers = [
        {
            id: 'maximum',
            name: 'Maximum Reasoning',
            description: 'Claude Opus 4.5 (64K thinking), o3-pro, GPT-5.2 Pro. For critical decisions.',
            models: ['claude-opus-4-5', 'o3-pro', 'gpt-5.2-pro'],
            costMultiplier: 5,
        },
        {
            id: 'deep',
            name: 'Deep Reasoning',
            description: 'o3, GPT-5.2 Thinking, Gemini 3 Pro. For complex tasks.',
            models: ['o3', 'gpt-5.2-thinking', 'gemini-3-pro', 'deepseek-r1-0528'],
            costMultiplier: 2,
        },
        {
            id: 'standard',
            name: 'Standard Reasoning',
            description: 'Claude Sonnet 4.5 (32K), o3-mini (high). For regular tasks.',
            models: ['claude-sonnet-4-5', 'o3-mini-high', 'qwen3-235b-thinking'],
            costMultiplier: 1,
        },
        {
            id: 'fast',
            name: 'Fast Reasoning',
            description: 'Gemini 3 Flash, o3-mini (medium). For time-sensitive tasks.',
            models: ['gemini-3-flash', 'o3-mini-medium', 'deepseek-r1'],
            costMultiplier: 0.5,
        },
    ];

    res.json({
        success: true,
        data: {
            strategies,
            modelTiers,
        },
        timestamp: new Date().toISOString(),
    });
});

/**
 * POST /api/hyper-thinking/analyze
 *
 * Analyze task complexity and get recommendations
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const body = req.body as AnalyzeRequestBody;

        if (!body.problem) {
            res.status(400).json({
                error: 'Missing required field: problem',
                code: 'MISSING_PROBLEM',
            });
            return;
        }

        const analyzer = new ComplexityAnalyzer();
        const analysis = await analyzer.analyze(body.problem, body.context);

        res.json({
            success: true,
            data: {
                complexity: analysis.level,
                recommendedStrategy: analysis.recommendedStrategy,
                recommendedModelTier: analysis.recommendedModelTier,
                factors: analysis.factors,
                reasoning: analysis.reasoning,
                estimatedTimeMs: analysis.estimatedTimeMs,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Analyze error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Analysis failed',
            code: 'ANALYZE_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * POST /api/hyper-thinking/decompose
 *
 * Decompose a task into subtasks with dependencies
 */
router.post('/decompose', async (req: Request, res: Response) => {
    try {
        const body = req.body as DecomposeRequestBody;
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        if (!body.task) {
            res.status(400).json({
                error: 'Missing required field: task',
                code: 'MISSING_TASK',
            });
            return;
        }

        const startTime = Date.now();

        const engine = createDecompositionEngine({
            strategy: body.strategy || 'hybrid',
            maxDepth: body.maxDepth || 4,
        });

        const result = await engine.decompose(body.task);

        if (!result.success || !result.tree) {
            res.status(500).json({
                error: result.error || 'Decomposition failed',
                code: 'DECOMPOSITION_FAILED',
            });
            return;
        }

        const latencyMs = Date.now() - startTime;

        // Track credits (decomposition uses about 4000-8000 tokens)
        await trackCreditsUsage(userId, 6000, 'decompose');

        // Convert Map to object for JSON serialization
        const subtasksObj: Record<string, unknown> = {};
        result.tree.subtasks.forEach((value, key) => {
            subtasksObj[key] = value;
        });

        res.json({
            success: true,
            data: {
                strategy: result.tree.strategy,
                rootTaskId: result.tree.rootTaskId,
                originalTask: result.tree.originalTask,
                subtasks: subtasksObj,
                dependencyGraph: result.tree.dependencyGraph,
                latencyMs,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Decompose error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Decomposition failed',
            code: 'DECOMPOSITION_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * POST /api/hyper-thinking/tree-of-thought
 *
 * Execute Tree-of-Thought reasoning
 */
router.post('/tree-of-thought', async (req: Request, res: Response) => {
    try {
        const body = req.body as ToTRequestBody;
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        if (!body.problem) {
            res.status(400).json({
                error: 'Missing required field: problem',
                code: 'MISSING_PROBLEM',
            });
            return;
        }

        const startTime = Date.now();
        const sessionId = uuidv4();

        // Create a model config for ToT
        const modelConfig = {
            modelId: 'claude-sonnet-4-5',
            provider: 'anthropic' as const,
            displayName: 'Claude Sonnet 4.5',
            maxContextTokens: 200000,
            maxThinkingBudget: 32000,
            supportsExtendedThinking: true,
            supportsStreaming: true,
            costPerInputK: 0.003,
            costPerOutputK: 0.015,
            costPerThinkingK: 0.015,
            bestFor: ['reasoning', 'complex-tasks'],
            tier: 'standard' as const,
        };

        const engine = createToTEngine(modelConfig, {
            strategy: (body.strategy as 'bfs' | 'dfs' | 'beam') || 'beam',
            maxDepth: body.maxDepth || 4,
            beamWidth: body.beamWidth || 5,
            evaluationThreshold: body.evaluationThreshold || 0.6,
        });

        const result = await engine.solve(body.problem);

        const latencyMs = Date.now() - startTime;
        const tokensUsed = getTotalTokens(result.totalTokens);

        // Track credits
        const creditsResult = await trackCreditsUsage(userId, tokensUsed, 'tree_of_thought');

        // Store session
        await db.insert(hyperThinkingSessions).values({
            userId,
            strategy: 'tree_of_thought',
            status: result.success ? 'completed' : 'failed',
            problem: body.problem,
            context: body.context || null,
            result: {
                success: result.success,
                strategy: 'tree_of_thought',
                finalAnswer: result.finalAnswer,
                confidence: result.confidence,
            },
            tokensUsed,
            latencyMs,
            creditsUsed: creditsResult.creditsDeducted,
        });

        res.json({
            success: result.success,
            data: {
                sessionId,
                answer: result.finalAnswer,
                confidence: result.confidence,
                tree: result.tree,
                modelsUsed: result.modelsUsed,
                tokensUsed,
                latencyMs,
                creditsUsed: creditsResult.creditsDeducted,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] ToT error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Tree-of-Thought failed',
            code: 'TOT_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * POST /api/hyper-thinking/multi-agent
 *
 * Execute Multi-Agent Reasoning Swarm
 */
router.post('/multi-agent', async (req: Request, res: Response) => {
    try {
        const body = req.body as MultiAgentRequestBody;
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        if (!body.problem) {
            res.status(400).json({
                error: 'Missing required field: problem',
                code: 'MISSING_PROBLEM',
            });
            return;
        }

        const startTime = Date.now();
        const sessionId = uuidv4();

        // Get or create swarm engine
        const engine = getSwarmEngine();

        const result = await engine.reason({
            problem: body.problem,
            context: body.context,
        });

        const latencyMs = Date.now() - startTime;
        const tokensUsed = getTotalTokens(result.tokenUsage);

        // Track credits
        const creditsResult = await trackCreditsUsage(userId, tokensUsed, 'multi_agent');

        // Store session
        await db.insert(hyperThinkingSessions).values({
            userId,
            strategy: 'multi_agent',
            status: result.confidence > 0.5 ? 'completed' : 'failed',
            problem: body.problem,
            context: body.context || null,
            result: {
                success: result.confidence > 0.5,
                strategy: 'multi_agent',
                finalAnswer: result.answer,
                confidence: result.confidence,
            },
            tokensUsed,
            latencyMs,
            creditsUsed: creditsResult.creditsDeducted,
        });

        res.json({
            success: result.confidence > 0.5,
            data: {
                sessionId,
                answer: result.answer,
                confidence: result.confidence,
                contributingAgents: result.contributingAgents,
                conflictResolutions: result.conflictResolutions,
                insights: result.insights,
                reasoning: result.reasoning,
                tokensUsed,
                latencyMs,
                creditsUsed: creditsResult.creditsDeducted,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Multi-agent error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Multi-agent reasoning failed',
            code: 'MULTI_AGENT_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * GET /api/hyper-thinking/artifacts
 *
 * Get stored reasoning artifacts
 */
router.get('/artifacts', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        const limit = parseInt(req.query.limit as string) || 20;
        const artifactType = req.query.type as string | undefined;

        const artifacts = await db.select()
            .from(hyperThinkingArtifacts)
            .where(artifactType 
                ? eq(hyperThinkingArtifacts.type, artifactType as 'thought' | 'decision' | 'insight' | 'pattern' | 'skeleton' | 'decomposition')
                : undefined
            )
            .orderBy(desc(hyperThinkingArtifacts.createdAt))
            .limit(limit);

        res.json({
            success: true,
            data: {
                count: artifacts.length,
                artifacts: artifacts.map(a => ({
                    id: a.id,
                    qdrantId: a.qdrantId,
                    type: a.type,
                    problemContext: a.problemContext,
                    strategy: a.strategy,
                    successRate: a.successRate,
                    usageCount: a.usageCount,
                    createdAt: a.createdAt,
                })),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Artifacts error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get artifacts',
            code: 'ARTIFACTS_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * POST /api/hyper-thinking/artifacts/search
 *
 * Search for similar reasoning artifacts using vector similarity
 */
router.post('/artifacts/search', async (req: Request, res: Response) => {
    try {
        const body = req.body as ArtifactSearchBody;
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        if (!body.query) {
            res.status(400).json({
                error: 'Missing required field: query',
                code: 'MISSING_QUERY',
            });
            return;
        }

        const storage = createArtifactStorage();

        const results = await storage.searchSimilar(body.query, {
            limit: body.limit || 10,
            minScore: body.minScore || 0.7,
        });

        res.json({
            success: true,
            data: {
                query: body.query,
                count: results.length,
                artifacts: results.map(r => ({
                    id: r.item.id,
                    type: r.item.type,
                    content: r.item.content,
                    confidence: r.item.confidence,
                    similarity: r.score,
                })),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Artifact search error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Artifact search failed',
            code: 'SEARCH_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * GET /api/hyper-thinking/sessions
 *
 * List reasoning sessions for the current user
 */
router.get('/sessions', async (req: Request, res: Response) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        const limit = parseInt(req.query.limit as string) || 20;
        const projectId = req.query.projectId as string;

        let sessions;
        if (projectId) {
            sessions = await db.select()
                .from(hyperThinkingSessions)
                .where(and(
                    eq(hyperThinkingSessions.userId, userId),
                    eq(hyperThinkingSessions.projectId, projectId)
                ))
                .orderBy(desc(hyperThinkingSessions.createdAt))
                .limit(limit);
        } else {
            sessions = await db.select()
                .from(hyperThinkingSessions)
                .where(eq(hyperThinkingSessions.userId, userId))
                .orderBy(desc(hyperThinkingSessions.createdAt))
                .limit(limit);
        }

        res.json({
            success: true,
            data: {
                count: sessions.length,
                sessions: sessions.map(s => ({
                    id: s.id,
                    strategy: s.strategy,
                    status: s.status,
                    problemPreview: s.problem?.substring(0, 100) + (s.problem && s.problem.length > 100 ? '...' : ''),
                    tokensUsed: s.tokensUsed,
                    latencyMs: s.latencyMs,
                    creditsUsed: s.creditsUsed,
                    createdAt: s.createdAt,
                })),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Sessions error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get sessions',
            code: 'SESSIONS_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * GET /api/hyper-thinking/sessions/:sessionId
 *
 * Get details for a specific session
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const userId = getUserId(req);

        if (!userId) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
            });
            return;
        }

        const sessions = await db.select()
            .from(hyperThinkingSessions)
            .where(and(
                eq(hyperThinkingSessions.id, sessionId),
                eq(hyperThinkingSessions.userId, userId)
            ))
            .limit(1);

        if (sessions.length === 0) {
            res.status(404).json({
                error: 'Session not found',
                code: 'NOT_FOUND',
            });
            return;
        }

        const session = sessions[0];

        res.json({
            success: true,
            data: {
                id: session.id,
                strategy: session.strategy,
                status: session.status,
                problem: session.problem,
                context: session.context,
                result: session.result,
                tokensUsed: session.tokensUsed,
                latencyMs: session.latencyMs,
                creditsUsed: session.creditsUsed,
                projectId: session.projectId,
                createdAt: session.createdAt,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Session detail error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get session',
            code: 'SESSION_FAILED',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * GET /api/hyper-thinking/health
 *
 * Health check for hyper-thinking service
 */
router.get('/health', async (_req: Request, res: Response) => {
    try {
        const orchestrator = getHyperThinkingOrchestrator();
        const storage = createArtifactStorage();

        // Check storage health
        let storageHealthy = false;
        try {
            await storage.searchSimilar('test', { limit: 1 });
            storageHealthy = true;
        } catch {
            storageHealthy = false;
        }

        const status = orchestrator && storageHealthy ? 'healthy' : 'degraded';
        const statusCode = status === 'healthy' ? 200 : 503;

        res.status(statusCode).json({
            success: status === 'healthy',
            data: {
                status,
                orchestrator: !!orchestrator,
                artifactStorage: storageHealthy,
                availableStrategies: ['chain_of_thought', 'tree_of_thought', 'multi_agent', 'hybrid'],
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[HyperThinking] Health check error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Health check failed',
            timestamp: new Date().toISOString(),
        });
    }
});

export default router;
