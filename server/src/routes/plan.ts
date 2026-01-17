/**
 * Implementation Plan API Routes
 *
 * Generates AI-powered implementation plans for user prompts.
 * Replaces the mock data in the frontend ImplementationPlan component.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { projects } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { createClaudeService, CLAUDE_MODELS } from '../services/ai/claude-service.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Plan option interface
interface PlanOption {
    id: string;
    label: string;
    description: string;
    recommended?: boolean;
}

// Plan phase interface
interface PlanPhase {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: 'frontend' | 'backend';
    options: PlanOption[];
    selectedOption: string;
}

// Plan generation result
interface GeneratedPlan {
    phases: PlanPhase[];
    summary: string;
    estimatedTime: string;
    complexity: 'simple' | 'moderate' | 'complex';
}

// System prompt for plan generation
const PLAN_GENERATION_PROMPT = `You are an expert software architect for KripTik AI, an AI-powered app builder.

Your task is to analyze a user's prompt and generate a comprehensive implementation plan with technology choices.

For each phase, provide 3-4 options with one marked as recommended based on the project requirements.

IMPORTANT: Your response MUST be valid JSON matching this exact structure:
{
  "phases": [
    {
      "id": "framework",
      "title": "Frontend Framework",
      "description": "Choose your UI framework",
      "icon": "Code",
      "type": "frontend",
      "options": [
        { "id": "react-vite", "label": "React + Vite", "description": "Modern React with fast builds", "recommended": true },
        { "id": "nextjs", "label": "Next.js", "description": "Full-stack React framework with SSR" }
      ],
      "selectedOption": "react-vite"
    }
  ],
  "summary": "Brief summary of what will be built",
  "estimatedTime": "2-3 hours",
  "complexity": "moderate"
}

Required phases to analyze and include:
1. Frontend Framework (react-vite, nextjs, vue, svelte)
2. Styling & UI (tailwind-shadcn, chakra, mantine, custom)
3. Authentication (better-auth, clerk, auth0, custom)
4. Database (turso, postgres, mongodb, supabase)
5. API Layer (express, fastify, trpc, hono)
6. State Management (zustand, redux, jotai, context)
7. Deployment (vercel, netlify, aws, self-hosted)

For each phase:
- Analyze the user's prompt to determine the best fit
- Mark ONE option as "recommended": true based on the prompt
- Set "selectedOption" to the recommended option's id
- Provide helpful, concise descriptions

Consider these factors when recommending:
- Project complexity mentioned in the prompt
- Specific requirements (e.g., "real-time" suggests websockets)
- Performance needs
- Team size implications
- Deployment targets mentioned

Respond with ONLY valid JSON, no markdown, no code blocks.`;

/**
 * POST /api/plan/generate
 * Generate an implementation plan from a prompt
 */
router.post('/generate', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { prompt, projectId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // If projectId provided, verify ownership
        if (projectId) {
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
        }

        // Create Claude service for planning
        const claude = createClaudeService({
            agentType: 'planning',
            systemPrompt: PLAN_GENERATION_PROMPT,
            projectId: projectId || uuidv4(),
            userId,
        });

        // Generate the plan - CRITICAL: Use Opus 4.5 with full token capacity
        // Plans are foundational - truncated plans cause incomplete implementations
        const result = await claude.generate(
            `Generate an implementation plan for the following project:\n\n${prompt}`,
            {
                model: CLAUDE_MODELS.OPUS_4_5,  // Use Opus 4.5 for critical planning
                maxTokens: 64000,               // Full 64K output - plans can be extensive
                useExtendedThinking: true,      // Enable deep reasoning for architecture
                thinkingBudgetTokens: 16000,    // Generous thinking budget
                effort: 'high',                 // Maximum effort for best quality plans
            }
        );

        // Parse the response
        let plan: GeneratedPlan;
        try {
            // Try to extract JSON from the response
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                plan = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse plan response:', result.content);
            // Return a fallback plan with common defaults
            plan = generateFallbackPlan(prompt);
        }

        // Validate the plan structure
        if (!plan.phases || !Array.isArray(plan.phases)) {
            plan = generateFallbackPlan(prompt);
        }

        res.json({
            success: true,
            plan,
            usage: {
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
            },
        });

    } catch (error) {
        console.error('Plan generation error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Plan generation failed',
            // Return fallback plan even on error so UI doesn't break
            plan: generateFallbackPlan(prompt),
        });
    }
});

/**
 * POST /api/plan/generate/stream
 * Generate plan with SSE streaming for progress updates
 */
router.post('/generate/stream', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { prompt, projectId } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendSSE = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        // Send progress events
        sendSSE('progress', { stage: 'Analyzing your prompt', progress: 10 });

        const claude = createClaudeService({
            agentType: 'planning',
            systemPrompt: PLAN_GENERATION_PROMPT,
            projectId: projectId || uuidv4(),
            userId,
        });

        sendSSE('progress', { stage: 'Identifying features', progress: 30 });

        // CRITICAL: Use Opus 4.5 with full token capacity for streaming plan generation
        const result = await claude.generate(
            `Generate an implementation plan for the following project:\n\n${prompt}`,
            {
                model: CLAUDE_MODELS.OPUS_4_5,  // Use Opus 4.5 for critical planning
                maxTokens: 64000,               // Full 64K output
                useExtendedThinking: true,      // Enable deep reasoning
                thinkingBudgetTokens: 16000,
                effort: 'high',                 // Maximum effort
            }
        );

        sendSSE('progress', { stage: 'Planning architecture', progress: 60 });

        let plan: GeneratedPlan;
        try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                plan = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            plan = generateFallbackPlan(prompt);
        }

        sendSSE('progress', { stage: 'Selecting technologies', progress: 80 });

        // Validate structure
        if (!plan.phases || !Array.isArray(plan.phases)) {
            plan = generateFallbackPlan(prompt);
        }

        sendSSE('progress', { stage: 'Generating implementation plan', progress: 100 });

        sendSSE('complete', {
            plan,
            usage: {
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
            },
        });

        res.end();

    } catch (error) {
        console.error('Plan generation error:', error);
        sendSSE('error', {
            message: error instanceof Error ? error.message : 'Plan generation failed',
            plan: generateFallbackPlan(prompt),
        });
        res.end();
    }
});

/**
 * Generate a fallback plan when AI response is invalid
 */
function generateFallbackPlan(prompt: string): GeneratedPlan {
    const lowerPrompt = prompt.toLowerCase();

    // Analyze prompt for technology hints
    const hasRealtime = /real-?time|websocket|chat|live/i.test(prompt);
    const hasAuth = /auth|login|user|account/i.test(prompt);
    const hasDatabase = /database|store|save|persist/i.test(prompt);
    const isFullStack = hasAuth || hasDatabase || /api|backend|server/i.test(prompt);
    const isDashboard = /dashboard|admin|analytics/i.test(prompt);

    return {
        phases: [
            {
                id: 'framework',
                title: 'Frontend Framework',
                description: 'Choose your UI framework',
                icon: 'Code',
                type: 'frontend',
                options: [
                    { id: 'react-vite', label: 'React + Vite', description: 'Modern React with fast builds', recommended: !isFullStack },
                    { id: 'nextjs', label: 'Next.js', description: 'Full-stack React framework with SSR', recommended: isFullStack },
                    { id: 'vue', label: 'Vue 3', description: 'Progressive JavaScript framework' },
                    { id: 'svelte', label: 'SvelteKit', description: 'Compiler-based framework' },
                ],
                selectedOption: isFullStack ? 'nextjs' : 'react-vite',
            },
            {
                id: 'styling',
                title: 'Styling & UI',
                description: 'Design system and components',
                icon: 'Palette',
                type: 'frontend',
                options: [
                    { id: 'tailwind-shadcn', label: 'Tailwind + shadcn/ui', description: 'Utility-first CSS with premium components', recommended: true },
                    { id: 'chakra', label: 'Chakra UI', description: 'Component library with accessibility' },
                    { id: 'mantine', label: 'Mantine', description: 'Feature-rich React components' },
                    { id: 'custom', label: 'Custom CSS', description: 'Build from scratch' },
                ],
                selectedOption: 'tailwind-shadcn',
            },
            {
                id: 'auth',
                title: 'Authentication',
                description: 'User authentication method',
                icon: 'Shield',
                type: 'frontend',
                options: [
                    { id: 'better-auth', label: 'Better Auth', description: 'Simple, secure authentication', recommended: true },
                    { id: 'clerk', label: 'Clerk', description: 'Drop-in authentication' },
                    { id: 'auth0', label: 'Auth0', description: 'Enterprise authentication' },
                    { id: 'none', label: 'No Auth', description: 'Skip authentication' },
                ],
                selectedOption: hasAuth ? 'better-auth' : 'none',
            },
            {
                id: 'database',
                title: 'Database',
                description: 'Data persistence layer',
                icon: 'Database',
                type: 'backend',
                options: [
                    { id: 'turso', label: 'Turso (SQLite)', description: 'Edge database with libSQL', recommended: true },
                    { id: 'postgres', label: 'PostgreSQL', description: 'Powerful relational database' },
                    { id: 'mongodb', label: 'MongoDB', description: 'Document database' },
                    { id: 'supabase', label: 'Supabase', description: 'Postgres with realtime', recommended: hasRealtime },
                ],
                selectedOption: hasRealtime ? 'supabase' : 'turso',
            },
            {
                id: 'api',
                title: 'API Layer',
                description: 'Backend API architecture',
                icon: 'Server',
                type: 'backend',
                options: [
                    { id: 'express', label: 'Express.js', description: 'Flexible Node.js framework', recommended: true },
                    { id: 'fastify', label: 'Fastify', description: 'Fast and low overhead' },
                    { id: 'trpc', label: 'tRPC', description: 'Type-safe API with TypeScript' },
                    { id: 'hono', label: 'Hono', description: 'Ultrafast web framework' },
                ],
                selectedOption: 'express',
            },
            {
                id: 'state',
                title: 'State Management',
                description: 'Application state handling',
                icon: 'Package',
                type: 'frontend',
                options: [
                    { id: 'zustand', label: 'Zustand', description: 'Simple and fast store', recommended: true },
                    { id: 'redux', label: 'Redux Toolkit', description: 'Predictable state container' },
                    { id: 'jotai', label: 'Jotai', description: 'Primitive and flexible atoms' },
                    { id: 'context', label: 'React Context', description: 'Built-in React solution' },
                ],
                selectedOption: isDashboard ? 'zustand' : 'zustand',
            },
            {
                id: 'deployment',
                title: 'Deployment',
                description: 'Hosting and infrastructure',
                icon: 'Zap',
                type: 'backend',
                options: [
                    { id: 'vercel', label: 'Vercel', description: 'Zero-config deployments', recommended: true },
                    { id: 'netlify', label: 'Netlify', description: 'JAMstack platform' },
                    { id: 'aws', label: 'AWS', description: 'Full cloud infrastructure' },
                    { id: 'railway', label: 'Railway', description: 'Simple cloud deployment' },
                ],
                selectedOption: 'vercel',
            },
        ],
        summary: `Implementation plan for: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`,
        estimatedTime: isDashboard ? '3-4 hours' : isFullStack ? '2-3 hours' : '1-2 hours',
        complexity: isDashboard ? 'complex' : isFullStack ? 'moderate' : 'simple',
    };
}

/**
 * POST /api/plan/reconfigure
 * Reconfigure an implementation plan based on user modifications
 *
 * Takes the original plan and applies all user modifications (task and phase level)
 * to generate a new, updated plan that incorporates the changes.
 */
router.post('/reconfigure', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const {
        buildId,
        originalPlan,
        taskModifications,
        phaseModifications,
    } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!originalPlan || !originalPlan.phases) {
        return res.status(400).json({ error: 'Original plan is required' });
    }

    try {
        // Build modification context for Claude
        const modificationContext = buildModificationContext(
            originalPlan,
            taskModifications || [],
            phaseModifications || []
        );

        const reconfigurePrompt = `You are an expert software architect helping to reconfigure an implementation plan.

The user has made the following modifications to their plan:

${modificationContext}

Based on these modifications, generate an UPDATED implementation plan that:
1. Incorporates all the user's requested changes
2. Adjusts related phases/tasks as needed for consistency
3. Re-evaluates complexity and time estimates
4. Maintains the same JSON structure as the original plan

Original plan structure for reference:
${JSON.stringify(originalPlan, null, 2)}

IMPORTANT: Your response MUST be valid JSON matching the exact structure of the original plan.
Update phase titles, descriptions, options, and selectedOptions as needed based on the modifications.
Add or remove tasks/phases if the modifications require it.

Respond with ONLY valid JSON, no markdown, no code blocks.`;

        const claude = createClaudeService({
            agentType: 'planning',
            systemPrompt: PLAN_GENERATION_PROMPT,
            projectId: buildId || uuidv4(),
            userId,
        });

        const result = await claude.generate(reconfigurePrompt, {
            model: CLAUDE_MODELS.OPUS_4_5,
            maxTokens: 64000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 16000,
            effort: 'high',
        });

        let plan: GeneratedPlan;
        try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                plan = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse reconfigured plan:', result.content);
            // Return original plan with a note about modifications
            return res.status(500).json({
                error: 'Failed to parse reconfigured plan',
                originalPlan,
            });
        }

        // Validate plan structure
        if (!plan.phases || !Array.isArray(plan.phases)) {
            return res.status(500).json({
                error: 'Invalid plan structure',
                originalPlan,
            });
        }

        res.json({
            success: true,
            plan,
            modificationsApplied: {
                tasks: taskModifications?.length || 0,
                phases: phaseModifications?.length || 0,
            },
            usage: {
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
            },
        });

    } catch (error) {
        console.error('Plan reconfiguration error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Plan reconfiguration failed',
            originalPlan,
        });
    }
});

/**
 * Build a context string describing all modifications
 */
function buildModificationContext(
    originalPlan: { phases: Array<{ id: string; title: string; tasks?: Array<{ id: string; content: string }> }> },
    taskModifications: Array<{
        taskId: string;
        phaseId: string;
        originalContent: string;
        modificationPrompt: string;
    }>,
    phaseModifications: Array<{
        phaseId: string;
        originalTitle: string;
        modificationPrompt: string;
    }>
): string {
    const parts: string[] = [];

    // Phase-level modifications
    if (phaseModifications.length > 0) {
        parts.push('## Phase-Level Modifications:');
        for (const mod of phaseModifications) {
            const phase = originalPlan.phases.find(p => p.id === mod.phaseId);
            parts.push(`
### Phase: "${mod.originalTitle}"
User's modification request: "${mod.modificationPrompt}"
Current phase title: "${phase?.title || mod.originalTitle}"
`);
        }
    }

    // Task-level modifications
    if (taskModifications.length > 0) {
        parts.push('## Task-Level Modifications:');
        for (const mod of taskModifications) {
            const phase = originalPlan.phases.find(p => p.id === mod.phaseId);
            parts.push(`
### Task in Phase "${phase?.title || mod.phaseId}"
Original task: "${mod.originalContent}"
User's modification request: "${mod.modificationPrompt}"
`);
        }
    }

    if (parts.length === 0) {
        parts.push('No modifications were specified.');
    }

    return parts.join('\n');
}

export default router;

