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
    projects
} from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

// =============================================================================
// PROJECT RULES
// =============================================================================

/**
 * GET /api/developer-settings/project/:projectId/rules
 * Get all rules for a project
 */
router.get('/project/:projectId/rules', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
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
        const userId = req.headers['x-user-id'] as string;
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
        const userId = req.headers['x-user-id'] as string;
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
        const userId = req.headers['x-user-id'] as string;
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
        const userId = req.headers['x-user-id'] as string;

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
        const userId = req.headers['x-user-id'] as string;
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
        const userId = req.headers['x-user-id'] as string;
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
        const userId = req.headers['x-user-id'] as string;
        const { projectId } = req.params;

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

        // TODO: Trigger actual analysis in background
        // For now, return the pending context
        res.json({
            context,
            message: 'Analysis started. Context will be available shortly.'
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
        const userId = req.headers['x-user-id'] as string;
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

