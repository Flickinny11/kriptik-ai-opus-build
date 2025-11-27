/**
 * Agent Orchestration API Routes
 *
 * Endpoints for managing multi-agent orchestration sessions.
 */

import { Router, Request } from 'express';
import { getContextStore } from '../services/agents/context-store.js';
import { getAgentOrchestrator } from '../services/agents/orchestrator.js';
import { authMiddleware } from '../middleware/auth.js';

// Use Express.Request which is augmented by authMiddleware
type AuthenticatedRequest = Request;

const router = Router();
router.use(authMiddleware);

const contextStore = getContextStore();
const orchestrator = getAgentOrchestrator();

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

// Create a new context for a project
router.post('/context', async (req: AuthenticatedRequest, res) => {
    const { projectId } = req.body;
    const userId = req.user?.id || 'anonymous';

    try {
        // Check for existing context
        let context = contextStore.getContextByProject(projectId, userId);

        if (!context) {
            context = contextStore.createContext(projectId, userId);
        }

        res.status(200).json({
            contextId: context.id,
            sessionId: context.sessionId,
        });
    } catch (error) {
        console.error('Error creating context:', error);
        res.status(500).json({
            message: 'Failed to create context',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get context by ID
router.get('/context/:contextId', async (req, res) => {
    const { contextId } = req.params;

    try {
        const context = contextStore.getContext(contextId);

        if (!context) {
            return res.status(404).json({ message: 'Context not found' });
        }

        // Don't send full conversation history in API response
        res.status(200).json({
            id: context.id,
            projectId: context.projectId,
            sessionId: context.sessionId,
            implementationPlan: context.implementationPlan,
            projectState: context.projectState,
            activeAgents: context.activeAgents,
            taskQueue: context.taskQueue.map((t: { id: string; type: string; title: string; status: string; priority: string }) => ({
                id: t.id,
                type: t.type,
                title: t.title,
                status: t.status,
                priority: t.priority,
            })),
            completedTasks: context.completedTasks.length,
            deploymentState: context.deploymentState,
            activeWorkflow: context.activeWorkflow,
            totalTokensUsed: context.totalTokensUsed,
        });
    } catch (error) {
        console.error('Error getting context:', error);
        res.status(500).json({
            message: 'Failed to get context',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get context summary
router.get('/context/:contextId/summary', async (req, res) => {
    const { contextId } = req.params;

    try {
        const summary = contextStore.getContextSummary(contextId);
        res.status(200).json({ summary });
    } catch (error) {
        console.error('Error getting context summary:', error);
        res.status(500).json({
            message: 'Failed to get context summary',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// AGENT MANAGEMENT
// ============================================================================

// Register an agent
router.post('/context/:contextId/agents', async (req, res) => {
    const { contextId } = req.params;
    const { type, capabilities } = req.body;

    try {
        const agent = contextStore.registerAgent(contextId, type, capabilities);

        if (!agent) {
            return res.status(400).json({ message: 'Failed to register agent' });
        }

        res.status(201).json({ agent });
    } catch (error) {
        console.error('Error registering agent:', error);
        res.status(500).json({
            message: 'Failed to register agent',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Remove an agent
router.delete('/context/:contextId/agents/:agentId', async (req, res) => {
    const { contextId, agentId } = req.params;

    try {
        contextStore.removeAgent(contextId, agentId);
        res.status(200).json({ message: 'Agent removed' });
    } catch (error) {
        console.error('Error removing agent:', error);
        res.status(500).json({
            message: 'Failed to remove agent',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

// Create a task
router.post('/context/:contextId/tasks', async (req, res) => {
    const { contextId } = req.params;
    const { type, title, description, input, priority, dependencies } = req.body;

    try {
        const task = contextStore.createTask(
            contextId,
            type,
            title,
            description,
            input || {},
            { priority, dependencies }
        );

        if (!task) {
            return res.status(400).json({ message: 'Failed to create task' });
        }

        res.status(201).json({ task });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            message: 'Failed to create task',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get tasks
router.get('/context/:contextId/tasks', async (req, res) => {
    const { contextId } = req.params;

    try {
        const context = contextStore.getContext(contextId);

        if (!context) {
            return res.status(404).json({ message: 'Context not found' });
        }

        res.status(200).json({
            pending: context.taskQueue.filter(t => t.status === 'pending'),
            inProgress: context.taskQueue.filter(t => t.status === 'in_progress'),
            completed: context.completedTasks,
        });
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({
            message: 'Failed to get tasks',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// ORCHESTRATION CONTROL
// ============================================================================

// Start orchestration
router.post('/context/:contextId/orchestration/start', async (req, res) => {
    const { contextId } = req.params;

    try {
        await orchestrator.startOrchestration(contextId);

        const status = orchestrator.getStatus(contextId);
        res.status(200).json({ message: 'Orchestration started', status });
    } catch (error) {
        console.error('Error starting orchestration:', error);
        res.status(500).json({
            message: 'Failed to start orchestration',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Stop orchestration
router.post('/context/:contextId/orchestration/stop', async (req, res) => {
    const { contextId } = req.params;

    try {
        orchestrator.stopOrchestration(contextId);
        res.status(200).json({ message: 'Orchestration stopped' });
    } catch (error) {
        console.error('Error stopping orchestration:', error);
        res.status(500).json({
            message: 'Failed to stop orchestration',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get orchestration status
router.get('/context/:contextId/orchestration/status', async (req, res) => {
    const { contextId } = req.params;

    try {
        const status = orchestrator.getStatus(contextId);
        res.status(200).json(status);
    } catch (error) {
        console.error('Error getting orchestration status:', error);
        res.status(500).json({
            message: 'Failed to get orchestration status',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// HIGH-LEVEL OPERATIONS
// ============================================================================

// Create implementation plan
router.post('/context/:contextId/plan', async (req, res) => {
    const { contextId } = req.params;
    const { request } = req.body;

    try {
        const plan = await orchestrator.createImplementationPlan(contextId, request);

        if (!plan) {
            return res.status(400).json({ message: 'Failed to create plan' });
        }

        res.status(201).json({ plan });
    } catch (error) {
        console.error('Error creating plan:', error);
        res.status(500).json({
            message: 'Failed to create plan',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Discover models
router.post('/context/:contextId/discover-models', async (req, res) => {
    const { contextId } = req.params;
    const { requirement, sources, maxResults } = req.body;

    try {
        const recommendations = await orchestrator.discoverModels(
            contextId,
            requirement,
            { sources, maxResults }
        );

        res.status(200).json({ recommendations });
    } catch (error) {
        console.error('Error discovering models:', error);
        res.status(500).json({
            message: 'Failed to discover models',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Generate code
router.post('/context/:contextId/generate-code', async (req, res) => {
    const { contextId } = req.params;
    const { description, fileType, additionalContext } = req.body;

    try {
        const result = await orchestrator.generateCode(
            contextId,
            description,
            fileType,
            additionalContext
        );

        if (!result) {
            return res.status(400).json({ message: 'Failed to generate code' });
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error generating code:', error);
        res.status(500).json({
            message: 'Failed to generate code',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// MESSAGES
// ============================================================================

// Add message to conversation
router.post('/context/:contextId/messages', async (req, res) => {
    const { contextId } = req.params;
    const { role, content, metadata } = req.body;

    try {
        const message = contextStore.addMessage(contextId, role, content, metadata);

        if (!message) {
            return res.status(400).json({ message: 'Failed to add message' });
        }

        res.status(201).json({ message });
    } catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json({
            message: 'Failed to add message',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get recent messages
router.get('/context/:contextId/messages', async (req, res) => {
    const { contextId } = req.params;
    const count = parseInt(req.query.count as string) || 50;

    try {
        const messages = contextStore.getRecentHistory(contextId, count);
        res.status(200).json({ messages });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            message: 'Failed to get messages',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;

