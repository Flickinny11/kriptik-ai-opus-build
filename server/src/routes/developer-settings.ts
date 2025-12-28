/**
 * Developer Settings API Routes
 *
 * Manages project rules, user rules, and developer mode preferences
 * that are wired to the orchestration system.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import {
    developerModeProjectRules,
    developerModeUserRules,
    developerModeAgentFeedback,
    developerModeProjectContext,
    developerModeAgents,
    projects,
    files
} from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

function getRequestUserId(req: Request): string | undefined {
    const headerUserId = req.headers['x-user-id'] as string | undefined;
    return req.user?.id || headerUserId;
}

// =============================================================================
// PROJECT RULES
// =============================================================================

/**
 * GET /api/developer-settings/project/:projectId/rules
 * Get all rules for a project
 */
router.get('/project/:projectId/rules', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { projectId } = req.params;

        const rules = await db.select()
            .from(developerModeProjectRules)
            .where(and(
                eq(developerModeProjectRules.projectId, projectId),
                eq(developerModeProjectRules.userId, userId)
            ))
            .orderBy(desc(developerModeProjectRules.priority));

        res.json({ rules });
    } catch (error) {
        console.error('Get project rules error:', error);
        res.status(500).json({ error: 'Failed to get project rules' });
    }
});

/**
 * POST /api/developer-settings/project/:projectId/rules
 * Create or update project rules
 */
router.post('/project/:projectId/rules', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { projectId } = req.params;
        const { rulesContent, rulesJson, priority = 0 } = req.body;

        if (!rulesContent) {
            return res.status(400).json({ error: 'rulesContent is required' });
        }

        // Check if rules already exist for this project/user combo
        const [existing] = await db.select()
            .from(developerModeProjectRules)
            .where(and(
                eq(developerModeProjectRules.projectId, projectId),
                eq(developerModeProjectRules.userId, userId)
            ))
            .limit(1);

        let rule;
        if (existing) {
            // Update existing
            [rule] = await db.update(developerModeProjectRules)
                .set({
                    rulesContent,
                    rulesJson: rulesJson || null,
                    priority,
                    updatedAt: new Date().toISOString()
                })
                .where(eq(developerModeProjectRules.id, existing.id))
                .returning();
        } else {
            // Create new
            [rule] = await db.insert(developerModeProjectRules)
                .values({
                    projectId,
                    userId,
                    rulesContent,
                    rulesJson: rulesJson || null,
                    priority,
                    isActive: true
                })
                .returning();
        }

        res.json({ rule });
    } catch (error) {
        console.error('Save project rules error:', error);
        res.status(500).json({ error: 'Failed to save project rules' });
    }
});

/**
 * DELETE /api/developer-settings/project/:projectId/rules
 * Delete project rules
 */
router.delete('/project/:projectId/rules', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { projectId } = req.params;

        await db.delete(developerModeProjectRules)
            .where(and(
                eq(developerModeProjectRules.projectId, projectId),
                eq(developerModeProjectRules.userId, userId)
            ));

        res.json({ success: true });
    } catch (error) {
        console.error('Delete project rules error:', error);
        res.status(500).json({ error: 'Failed to delete project rules' });
    }
});

/**
 * POST /api/developer-settings/project/:projectId/rules/import
 * Import rules from .cursorrules or .clinerules file
 */
router.post('/project/:projectId/rules/import', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { projectId } = req.params;
        const { fileContent, fileName } = req.body;

        if (!fileContent) {
            return res.status(400).json({ error: 'fileContent is required' });
        }

        // Parse and format the rules content
        let formattedContent = fileContent;
        if (fileName?.endsWith('.json')) {
            try {
                const parsed = JSON.parse(fileContent);
                formattedContent = typeof parsed === 'string'
                    ? parsed
                    : JSON.stringify(parsed, null, 2);
            } catch {
                // Keep as-is if not valid JSON
            }
        }

        // Upsert the rules
        const [existing] = await db.select()
            .from(developerModeProjectRules)
            .where(and(
                eq(developerModeProjectRules.projectId, projectId),
                eq(developerModeProjectRules.userId, userId)
            ))
            .limit(1);

        let rule;
        if (existing) {
            [rule] = await db.update(developerModeProjectRules)
                .set({
                    rulesContent: formattedContent,
                    updatedAt: new Date().toISOString()
                })
                .where(eq(developerModeProjectRules.id, existing.id))
                .returning();
        } else {
            [rule] = await db.insert(developerModeProjectRules)
                .values({
                    projectId,
                    userId,
                    rulesContent: formattedContent,
                    isActive: true
                })
                .returning();
        }

        res.json({
            rule,
            imported: true,
            source: fileName || 'unknown'
        });
    } catch (error) {
        console.error('Import rules error:', error);
        res.status(500).json({ error: 'Failed to import rules' });
    }
});

// =============================================================================
// USER RULES & PREFERENCES
// =============================================================================

/**
 * GET /api/developer-settings/user/rules
 * Get user rules and preferences
 */
router.get('/user/rules', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        let [userRules] = await db.select()
            .from(developerModeUserRules)
            .where(eq(developerModeUserRules.userId, userId))
            .limit(1);

        // Return defaults if no rules exist
        if (!userRules) {
            userRules = {
                id: '',
                userId,
                globalRulesContent: null,
                defaultModel: 'claude-sonnet-4-5',
                defaultVerificationMode: 'standard',
                autoCreateBranches: true,
                autoRunVerification: true,
                extendedThinkingDefault: false,
                autoFixOnFailure: true,
                maxAutoFixAttempts: 3,
                includeTestsInContext: true,
                requireScreenshotProof: false,
                notifyOnAgentComplete: true,
                notifyOnVerificationFail: true,
                notifyOnMergeReady: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        res.json({ userRules });
    } catch (error) {
        console.error('Get user rules error:', error);
        res.status(500).json({ error: 'Failed to get user rules' });
    }
});

/**
 * PATCH /api/developer-settings/user/rules
 * Update user rules and preferences
 */
router.patch('/user/rules', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const updates = req.body;

        // Allowed fields
        const allowedFields = [
            'globalRulesContent',
            'defaultModel',
            'defaultVerificationMode',
            'autoCreateBranches',
            'autoRunVerification',
            'extendedThinkingDefault',
            'autoFixOnFailure',
            'maxAutoFixAttempts',
            'includeTestsInContext',
            'requireScreenshotProof',
            'notifyOnAgentComplete',
            'notifyOnVerificationFail',
            'notifyOnMergeReady'
        ];

        const sanitizedUpdates: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                sanitizedUpdates[field] = updates[field];
            }
        }
        sanitizedUpdates.updatedAt = new Date().toISOString();

        // Upsert
        const [existing] = await db.select()
            .from(developerModeUserRules)
            .where(eq(developerModeUserRules.userId, userId))
            .limit(1);

        let userRules;
        if (existing) {
            [userRules] = await db.update(developerModeUserRules)
                .set(sanitizedUpdates)
                .where(eq(developerModeUserRules.id, existing.id))
                .returning();
        } else {
            [userRules] = await db.insert(developerModeUserRules)
                .values({
                    userId,
                    ...sanitizedUpdates
                })
                .returning();
        }

        res.json({ userRules });
    } catch (error) {
        console.error('Update user rules error:', error);
        res.status(500).json({ error: 'Failed to update user rules' });
    }
});

// =============================================================================
// AGENT FEEDBACK
// =============================================================================

/**
 * POST /api/developer-settings/agents/:agentId/feedback
 * Submit feedback for an agent (Request Changes flow)
 */
router.post('/agents/:agentId/feedback', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { agentId } = req.params;
        const { feedbackContent, feedbackType, priority = 'medium', tags = [] } = req.body;

        if (!feedbackContent || !feedbackType) {
            return res.status(400).json({ error: 'feedbackContent and feedbackType are required' });
        }

        // Get the agent
        const [agent] = await db.select()
            .from(developerModeAgents)
            .where(eq(developerModeAgents.id, agentId))
            .limit(1);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Store the feedback
        const [feedback] = await db.insert(developerModeAgentFeedback)
            .values({
                agentId,
                sessionId: agent.sessionId,
                projectId: agent.projectId,
                userId,
                feedbackContent,
                feedbackType,
                priority,
                tags: tags as string[],
                iterationNumber: (agent.buildAttempts || 0) + 1
            })
            .returning();

        // If feedback type is 'request_changes', update agent status and prompt
        if (feedbackType === 'request_changes') {
            const updatedPrompt = `${agent.taskPrompt}

## ADDITIONAL REQUIREMENTS (From User Feedback - Iteration ${feedback.iterationNumber})
Priority: ${priority}
${feedbackContent}`;

            await db.update(developerModeAgents)
                .set({
                    taskPrompt: updatedPrompt,
                    status: 'idle', // Reset to idle so it can be re-run
                    buildAttempts: (agent.buildAttempts || 0) + 1,
                    updatedAt: new Date().toISOString()
                })
                .where(eq(developerModeAgents.id, agentId));
        }

        res.json({
            feedback,
            iterationNumber: feedback.iterationNumber
        });
    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

/**
 * GET /api/developer-settings/agents/:agentId/feedback
 * Get feedback history for an agent
 */
router.get('/agents/:agentId/feedback', async (req: Request, res: Response) => {
    try {
        const { agentId } = req.params;

        const feedbackList = await db.select()
            .from(developerModeAgentFeedback)
            .where(eq(developerModeAgentFeedback.agentId, agentId))
            .orderBy(desc(developerModeAgentFeedback.createdAt));

        res.json({ feedback: feedbackList });
    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ error: 'Failed to get feedback' });
    }
});

// =============================================================================
// PROJECT CONTEXT
// =============================================================================

/**
 * GET /api/developer-settings/project/:projectId/context
 * Get auto-generated project context
 */
router.get('/project/:projectId/context', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        const [context] = await db.select()
            .from(developerModeProjectContext)
            .where(eq(developerModeProjectContext.projectId, projectId))
            .limit(1);

        res.json({ context: context || null });
    } catch (error) {
        console.error('Get project context error:', error);
        res.status(500).json({ error: 'Failed to get project context' });
    }
});

/**
 * POST /api/developer-settings/project/:projectId/context/analyze
 * Trigger project analysis to generate context
 */
router.post('/project/:projectId/context/analyze', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id as string | undefined;
        const { projectId } = req.params;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Ensure the project belongs to the authenticated user
        const [project] = await db.select()
            .from(projects)
            .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
            .limit(1);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Mark as analyzing
        const [existing] = await db.select()
            .from(developerModeProjectContext)
            .where(eq(developerModeProjectContext.projectId, projectId))
            .limit(1);

        let context;
        if (existing) {
            [context] = await db.update(developerModeProjectContext)
                .set({
                    status: 'analyzing',
                    updatedAt: new Date().toISOString()
                })
                .where(eq(developerModeProjectContext.id, existing.id))
                .returning();
        } else {
            [context] = await db.insert(developerModeProjectContext)
                .values({
                    projectId,
                    userId,
                    status: 'analyzing'
                })
                .returning();
        }

        // Analyze synchronously (fast path) — this generates real context used by orchestration.
        const projectFiles = await db.select({
            path: files.path,
            content: files.content,
        })
            .from(files)
            .where(eq(files.projectId, projectId));

        const packageJsonFile = projectFiles.find(f => f.path === 'package.json');
        let dependencies: Record<string, string> | undefined;
        let devDependencies: Record<string, string> | undefined;
        if (packageJsonFile?.content) {
            try {
                const parsed = JSON.parse(packageJsonFile.content);
                if (parsed && typeof parsed === 'object') {
                    dependencies = parsed.dependencies && typeof parsed.dependencies === 'object' ? parsed.dependencies : undefined;
                    devDependencies = parsed.devDependencies && typeof parsed.devDependencies === 'object' ? parsed.devDependencies : undefined;
                }
            } catch {
                // leave deps undefined if invalid JSON
            }
        }

        const paths = projectFiles.map(f => f.path);
        const hasTS = paths.some(p => p.endsWith('.ts') || p.endsWith('.tsx'));
        const hasJS = paths.some(p => p.endsWith('.js') || p.endsWith('.jsx'));
        const hasPY = paths.some(p => p.endsWith('.py'));

        const language =
            hasTS ? 'TypeScript' :
                hasJS ? 'JavaScript' :
                    hasPY ? 'Python' :
                        (project.framework ? String(project.framework) : 'Unknown');

        const sourceDirectory =
            paths.some(p => p.startsWith('src/')) ? 'src' :
                paths.some(p => p.startsWith('app/')) ? 'app' :
                    undefined;

        const componentPaths = paths.filter(p => /(^|\/)(components|component)\//i.test(p));
        const testPaths = paths.filter(p => /(^|\/)(__tests__|test|tests)\//i.test(p) || /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(p));
        const configFiles = paths.filter(p => /(vite\.config|next\.config|tailwind\.config|postcss\.config|tsconfig|eslint|prettier|drizzle|vercel)\./i.test(p) || p.endsWith('.env') || p.endsWith('.env.example'));

        const contentSample = projectFiles
            .filter(f => /\.(ts|tsx|js|jsx)$/.test(f.path))
            .slice(0, 25)
            .map(f => f.content || '')
            .join('\n');

        const detect = (needle: string) => contentSample.includes(needle) || !!(dependencies && Object.keys(dependencies).some(k => k === needle));
        const patterns = {
            stateManagement: detect('zustand') ? 'zustand' : (detect('redux') ? 'redux' : undefined),
            styling: detect('tailwindcss') ? 'tailwind' : (detect('styled-components') ? 'styled-components' : undefined),
            routing: detect('react-router') || detect('react-router-dom') ? 'react-router' : undefined,
            apiClient: detect('axios') ? 'axios' : (detect('fetch(') ? 'fetch' : undefined),
            testing: detect('vitest') ? 'vitest' : (detect('jest') ? 'jest' : undefined),
        } as const;

        const conventions = (() => {
            const semicolons = (contentSample.match(/;\s*$/gm) || []).length;
            const totalLines = (contentSample.match(/\n/g) || []).length + 1;
            const quotesSingle = (contentSample.match(/'[^']*'/g) || []).length;
            const quotesDouble = (contentSample.match(/"[^"]*"/g) || []).length;
            const tabs = (contentSample.match(/^\t+/gm) || []).length;
            const spaces2 = (contentSample.match(/^ {2}\S/gm) || []).length;
            const spaces4 = (contentSample.match(/^ {4}\S/gm) || []).length;

            const indentation = (tabs > Math.max(spaces2, spaces4) ? 'tabs' : 'spaces') as 'tabs' | 'spaces';
            const indentSize = indentation === 'tabs' ? undefined : (spaces4 > spaces2 ? 4 : 2);
            const quotes = (quotesDouble > quotesSingle ? 'double' : 'single') as 'double' | 'single';
            return {
                indentation,
                indentSize,
                quotes,
                semicolons: semicolons > totalLines * 0.25,
                componentStyle: 'functional' as const,
            };
        })();

        const [updated] = await db.update(developerModeProjectContext)
            .set({
                framework: project.framework,
                language,
                dependencies,
                devDependencies,
                sourceDirectory,
                componentPaths,
                testPaths,
                configFiles,
                patterns,
                conventions,
                analyzedAt: new Date().toISOString(),
                status: 'completed',
                updatedAt: new Date().toISOString(),
            })
            .where(eq(developerModeProjectContext.id, context.id))
            .returning();

        res.json({
            context: updated || context,
            message: 'Analysis completed.'
        });
    } catch (error) {
        console.error('Analyze project error:', error);
        res.status(500).json({ error: 'Failed to start analysis' });
    }
});

// =============================================================================
// HELPER: Get combined rules for orchestration
// =============================================================================

/**
 * GET /api/developer-settings/project/:projectId/combined-rules
 * Get all rules (project + user) formatted for agent injection
 */
router.get('/project/:projectId/combined-rules', async (req: Request, res: Response) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { projectId } = req.params;

        // Get project rules
        const projectRules = await db.select()
            .from(developerModeProjectRules)
            .where(and(
                eq(developerModeProjectRules.projectId, projectId),
                eq(developerModeProjectRules.userId, userId),
                eq(developerModeProjectRules.isActive, true)
            ))
            .orderBy(desc(developerModeProjectRules.priority));

        // Get user rules
        const [userRules] = await db.select()
            .from(developerModeUserRules)
            .where(eq(developerModeUserRules.userId, userId))
            .limit(1);

        // Get project context
        const [context] = await db.select()
            .from(developerModeProjectContext)
            .where(eq(developerModeProjectContext.projectId, projectId))
            .limit(1);

        // Format combined rules for agent prompt injection
        let combinedRules = '';

        if (context && context.status === 'completed') {
            combinedRules += `## PROJECT CONTEXT
Framework: ${context.framework || 'Unknown'}
Language: ${context.language || 'Unknown'}
${context.patterns ? `Patterns: ${JSON.stringify(context.patterns)}` : ''}
${context.conventions ? `Conventions: ${JSON.stringify(context.conventions)}` : ''}

`;
        }

        if (projectRules.length > 0) {
            combinedRules += `## PROJECT RULES (MUST FOLLOW)
These rules are set by the project owner. Follow them strictly.

${projectRules.map(r => r.rulesContent).join('\n\n')}

`;
        }

        if (userRules?.globalRulesContent) {
            combinedRules += `## USER PREFERENCES (Follow these coding preferences)
${userRules.globalRulesContent}

`;
        }

        res.json({
            combinedRules,
            hasProjectRules: projectRules.length > 0,
            hasUserRules: !!userRules?.globalRulesContent,
            hasContext: context?.status === 'completed',
            preferences: userRules ? {
                defaultModel: userRules.defaultModel,
                defaultVerificationMode: userRules.defaultVerificationMode,
                autoCreateBranches: userRules.autoCreateBranches,
                autoRunVerification: userRules.autoRunVerification,
                extendedThinkingDefault: userRules.extendedThinkingDefault,
                autoFixOnFailure: userRules.autoFixOnFailure,
                maxAutoFixAttempts: userRules.maxAutoFixAttempts,
                includeTestsInContext: userRules.includeTestsInContext,
                requireScreenshotProof: userRules.requireScreenshotProof
            } : null
        });
    } catch (error) {
        console.error('Get combined rules error:', error);
        res.status(500).json({ error: 'Failed to get combined rules' });
    }
});

export default router;

