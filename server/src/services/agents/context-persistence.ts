/**
 * Context Persistence Service
 *
 * Handles saving, loading, and summarizing shared contexts.
 * Enables continuous conversations across sessions.
 * Uses in-memory cache with file-based persistence.
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Anthropic } from '@anthropic-ai/sdk';
import {
    SharedContext,
    ContextCheckpoint,
    Message,
} from './types.js';

// In-memory context cache
const contextCache = new Map<string, SharedContext>();
const CONTEXTS_DIR = path.join(process.cwd(), '.kriptik-contexts');

// Ensure contexts directory exists
async function ensureContextsDir(): Promise<void> {
    try {
        await fs.mkdir(CONTEXTS_DIR, { recursive: true });
    } catch {
        // Directory may already exist
    }
}

// ============================================================================
// PERSISTENCE OPERATIONS
// ============================================================================

/**
 * Save context to file system
 */
export async function saveContext(context: SharedContext): Promise<void> {
    await ensureContextsDir();

    const filePath = path.join(CONTEXTS_DIR, `${context.id}.json`);
    const data = {
        id: context.id,
        projectId: context.projectId,
        userId: context.userId,
        sessionId: context.sessionId,
        implementationPlan: context.implementationPlan,
        projectState: context.projectState,
        userPreferences: context.userPreferences,
        credentialVault: context.credentialVault,
        deploymentState: context.deploymentState,
        conversationHistory: context.conversationHistory,
        contextCheckpoints: context.contextCheckpoints,
        activeWorkflow: context.activeWorkflow,
        createdAt: context.createdAt,
        updatedAt: context.updatedAt,
        totalTokensUsed: context.totalTokensUsed,
    };

    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        contextCache.set(context.id, context);

        // Also save index entry
        await saveContextIndex(context);
    } catch (error) {
        console.error('Error saving context:', error);
    }
}

/**
 * Save context index for quick lookup
 */
async function saveContextIndex(context: SharedContext): Promise<void> {
    const indexPath = path.join(CONTEXTS_DIR, 'index.json');
    let index: Record<string, { projectId: string; userId: string; updatedAt: string }> = {};

    try {
        const existing = await fs.readFile(indexPath, 'utf-8');
        index = JSON.parse(existing);
    } catch {
        // Index doesn't exist yet
    }

    index[context.id] = {
        projectId: context.projectId,
        userId: context.userId,
        updatedAt: context.updatedAt.toISOString(),
    };

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
}

/**
 * Load context from file system
 */
export async function loadContext(contextId: string): Promise<SharedContext | null> {
    // Check cache first
    if (contextCache.has(contextId)) {
        return contextCache.get(contextId)!;
    }

    await ensureContextsDir();
    const filePath = path.join(CONTEXTS_DIR, `${contextId}.json`);

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(data);

        const context: SharedContext = {
            ...parsed,
            activeAgents: [],  // Agents don't persist across sessions
            taskQueue: [],     // Tasks don't persist
            completedTasks: [], // Clear completed tasks on load
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt),
            lastActivityAt: new Date(),
        };

        contextCache.set(contextId, context);
        return context;
    } catch (error) {
        return null;
    }
}

/**
 * Load most recent context for a project
 */
export async function loadLatestContext(
    projectId: string,
    userId: string
): Promise<SharedContext | null> {
    await ensureContextsDir();
    const indexPath = path.join(CONTEXTS_DIR, 'index.json');

    try {
        const indexData = await fs.readFile(indexPath, 'utf-8');
        const index: Record<string, { projectId: string; userId: string; updatedAt: string }> = JSON.parse(indexData);

        // Find matching contexts
        let latestId: string | null = null;
        let latestDate: Date | null = null;

        for (const [id, entry] of Object.entries(index)) {
            if (entry.projectId === projectId && entry.userId === userId) {
                const date = new Date(entry.updatedAt);
                if (!latestDate || date > latestDate) {
                    latestDate = date;
                    latestId = id;
                }
            }
        }

        if (latestId) {
            return loadContext(latestId);
        }

        return null;
    } catch (error) {
        return null;
    }
}

// ============================================================================
// CONTEXT SUMMARIZATION
// ============================================================================

/**
 * Summarize conversation history for context compression
 */
export async function summarizeConversation(
    messages: Message[],
    maxLength: number = 2000
): Promise<string> {
    // Use Anthropic SDK (via OpenRouter or direct) for intelligent summarization
    const { createAnthropicClient, getClaudeModelId } = await import('../../utils/anthropic-client.js');
    const client = createAnthropicClient();

    if (!client || messages.length < 10) {
        // Return simple summary for short conversations or no API key
        return createSimpleSummary(messages);
    }

    const conversationText = messages.map(m =>
        `${m.role.toUpperCase()}${m.agentType ? ` (${m.agentType})` : ''}: ${m.content}`
    ).join('\n\n');

    try {
        const response = await client.messages.create({
            model: getClaudeModelId('sonnet'),
            max_tokens: 1024,
            messages: [
                {
                    role: 'user',
                    content: `Summarize this conversation, preserving:
1. Key decisions made
2. Code/features implemented
3. Current state of the project
4. Any unresolved issues
5. Next steps discussed

Keep the summary under ${maxLength} characters.

CONVERSATION:
${conversationText}`,
                }
            ],
        });

        const content = response.content[0];
        return content.type === 'text' ? content.text : createSimpleSummary(messages);
    } catch (error) {
        console.error('Error summarizing conversation:', error);
        return createSimpleSummary(messages);
    }
}

/**
 * Create a simple summary without AI
 */
function createSimpleSummary(messages: Message[]): string {
    const parts: string[] = [];

    // Count messages by role
    const counts = messages.reduce((acc, m) => {
        acc[m.role] = (acc[m.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    parts.push(`Conversation: ${messages.length} messages (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')})`);

    // Extract key points from last few messages
    const recentMessages = messages.slice(-5);
    const keyPoints = recentMessages
        .filter(m => m.role === 'assistant' || m.role === 'agent')
        .map(m => {
            // Extract first sentence
            const firstSentence = m.content.split('.')[0];
            return firstSentence.length < 100 ? firstSentence : firstSentence.slice(0, 100) + '...';
        });

    if (keyPoints.length > 0) {
        parts.push('Recent activity: ' + keyPoints.join('; '));
    }

    return parts.join('\n');
}

/**
 * Compress context by summarizing old messages
 */
export async function compressContext(
    context: SharedContext,
    maxMessages: number = 100
): Promise<SharedContext> {
    if (context.conversationHistory.length <= maxMessages) {
        return context;
    }

    // Split into messages to keep and messages to summarize
    const messagesToSummarize = context.conversationHistory.slice(0, -maxMessages);
    const messagesToKeep = context.conversationHistory.slice(-maxMessages);

    // Summarize old messages
    const summary = await summarizeConversation(messagesToSummarize);

    // Create a checkpoint with the summary
    const checkpoint: ContextCheckpoint = {
        id: uuidv4(),
        timestamp: new Date(),
        summary,
        keyDecisions: extractKeyDecisions(messagesToSummarize),
        filesModified: [],
        tasksCompleted: [],
    };

    // Create summary message to prepend
    const summaryMessage: Message = {
        id: uuidv4(),
        role: 'system',
        content: `[Previous conversation summary (${messagesToSummarize.length} messages)]\n${summary}`,
        timestamp: new Date(),
        metadata: { type: 'context-summary', messageCount: messagesToSummarize.length },
    };

    return {
        ...context,
        conversationHistory: [summaryMessage, ...messagesToKeep],
        contextCheckpoints: [...context.contextCheckpoints, checkpoint],
    };
}

/**
 * Extract key decisions from messages
 */
function extractKeyDecisions(messages: Message[]): string[] {
    const decisions: string[] = [];

    for (const msg of messages) {
        if (msg.role !== 'assistant' && msg.role !== 'agent') continue;

        // Look for decision indicators
        const decisionPatterns = [
            /decided to (.*?)\./i,
            /chose to (.*?)\./i,
            /selecting (.*?) for/i,
            /using (.*?) because/i,
            /implementing (.*?) as/i,
        ];

        for (const pattern of decisionPatterns) {
            const match = msg.content.match(pattern);
            if (match && match[1]) {
                decisions.push(match[1].trim());
            }
        }
    }

    return [...new Set(decisions)].slice(0, 10);  // Unique, max 10
}

// ============================================================================
// CONTEXT RESTORATION
// ============================================================================

/**
 * Build context prompt for Claude from shared context
 */
export function buildContextPrompt(context: SharedContext): string {
    const parts: string[] = [];

    // Project info
    parts.push(`## Project: ${context.projectState.name}`);
    parts.push(`Framework: ${context.projectState.framework}`);
    parts.push(`Build Status: ${context.projectState.buildStatus}`);

    // Implementation plan
    if (context.implementationPlan) {
        const plan = context.implementationPlan;
        parts.push(`\n## Implementation Plan: ${plan.title}`);
        parts.push(`Status: ${plan.status}`);

        if (plan.phases.length > 0) {
            const currentPhase = plan.phases[plan.currentPhaseIndex];
            parts.push(`Current Phase: ${currentPhase?.name || 'N/A'} (${plan.currentPhaseIndex + 1}/${plan.phases.length})`);
        }
    }

    // Active workflow
    if (context.activeWorkflow) {
        parts.push(`\n## Active Workflow: ${context.activeWorkflow.name}`);
        parts.push(`Status: ${context.activeWorkflow.status}`);
    }

    // Deployments
    if (context.deploymentState.activeDeployments.length > 0) {
        parts.push('\n## Active Deployments:');
        for (const dep of context.deploymentState.activeDeployments) {
            parts.push(`- ${dep.provider}: ${dep.status}${dep.endpoint ? ` (${dep.endpoint})` : ''}`);
        }
    }

    // Recent checkpoints
    if (context.contextCheckpoints.length > 0) {
        const recentCheckpoint = context.contextCheckpoints[context.contextCheckpoints.length - 1];
        parts.push(`\n## Last Checkpoint (${recentCheckpoint.timestamp.toISOString()}):`);
        parts.push(recentCheckpoint.summary);
    }

    // Token usage
    parts.push(`\n## Session Stats:`);
    parts.push(`Tokens Used: ${context.totalTokensUsed.toLocaleString()}`);
    parts.push(`Messages: ${context.conversationHistory.length}`);

    return parts.join('\n');
}

/**
 * Build messages array for Claude API from context
 */
export function buildMessagesForClaude(
    context: SharedContext,
    systemPrompt: string,
    newUserMessage: string,
    maxMessages: number = 50
): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add context summary as first user message if we have checkpoints
    if (context.contextCheckpoints.length > 0) {
        const contextPrompt = buildContextPrompt(context);
        messages.push({
            role: 'user',
            content: `[Context from previous session]\n${contextPrompt}`,
        });
        messages.push({
            role: 'assistant',
            content: 'I understand the context. I have access to the project state, implementation plan, and conversation history. How can I help you continue?',
        });
    }

    // Add recent conversation history
    const recentHistory = context.conversationHistory.slice(-maxMessages);

    for (const msg of recentHistory) {
        if (msg.role === 'user') {
            messages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant' || msg.role === 'agent') {
            messages.push({ role: 'assistant', content: msg.content });
        }
        // Skip system messages in the middle
    }

    // Add new user message
    messages.push({ role: 'user', content: newUserMessage });

    return messages;
}

// ============================================================================
// AUTO-SAVE SERVICE
// ============================================================================

export class ContextAutoSaver {
    private saveIntervals: Map<string, NodeJS.Timeout> = new Map();
    private dirtyContexts: Set<string> = new Set();

    /**
     * Start auto-saving for a context
     */
    startAutoSave(contextId: string, context: SharedContext, intervalMs: number = 30000): void {
        // Clear existing interval if any
        this.stopAutoSave(contextId);

        const interval = setInterval(async () => {
            if (this.dirtyContexts.has(contextId)) {
                await saveContext(context);
                this.dirtyContexts.delete(contextId);
            }
        }, intervalMs);

        this.saveIntervals.set(contextId, interval);
    }

    /**
     * Stop auto-saving for a context
     */
    stopAutoSave(contextId: string): void {
        const interval = this.saveIntervals.get(contextId);
        if (interval) {
            clearInterval(interval);
            this.saveIntervals.delete(contextId);
        }
    }

    /**
     * Mark context as dirty (needs saving)
     */
    markDirty(contextId: string): void {
        this.dirtyContexts.add(contextId);
    }

    /**
     * Force save a context immediately
     */
    async forceSave(contextId: string, context: SharedContext): Promise<void> {
        await saveContext(context);
        this.dirtyContexts.delete(contextId);
    }

    /**
     * Stop all auto-saves
     */
    stopAll(): void {
        for (const [contextId, interval] of this.saveIntervals) {
            clearInterval(interval);
        }
        this.saveIntervals.clear();
        this.dirtyContexts.clear();
    }
}

// Singleton instance
let autoSaver: ContextAutoSaver | null = null;

export function getContextAutoSaver(): ContextAutoSaver {
    if (!autoSaver) {
        autoSaver = new ContextAutoSaver();
    }
    return autoSaver;
}

