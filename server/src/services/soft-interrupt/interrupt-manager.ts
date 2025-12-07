/**
 * Soft Interrupt System - Non-Blocking Agent Input Manager
 *
 * Enables users to communicate with agents mid-execution without
 * hard-stopping them. Uses priority queue and classification to
 * inject context at tool boundaries.
 *
 * F046: Soft Interrupt System
 */

// @ts-nocheck - Pending full schema alignment
import { db } from '../../db.js';
import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm';
import {
  developerModeAgents,
  developerModeAgentLogs,
  developerModeSessions
} from '../../schema.js';
import { v4 as uuidv4 } from 'uuid';
import { createOpenRouterClient } from '../ai/openrouter-client.js';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Interrupt classification types - determines how the system handles user input
 */
export type InterruptType =
  | 'HALT'           // Stop immediately, user wants to take over
  | 'CONTEXT_ADD'    // Add information without stopping
  | 'COURSE_CORRECT' // Redirect current work, don't restart
  | 'BACKTRACK'      // Undo recent work, go back to checkpoint
  | 'QUEUE'          // Schedule for later, after current task
  | 'CLARIFICATION'  // Agent needs to respond before continuing
  | 'URGENT_FIX'     // Critical fix needed immediately
  | 'APPRECIATION'   // User showing approval, no action needed
  | 'IGNORE';        // Not relevant to current task

/**
 * Priority levels for the interrupt queue
 */
export type InterruptPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred';

/**
 * User interrupt input
 */
export interface UserInterrupt {
  id: string;
  sessionId: string;
  agentId?: string;
  message: string;
  timestamp: Date;
  rawInput: string;
}

/**
 * Classified interrupt with processing metadata
 */
export interface ClassifiedInterrupt extends UserInterrupt {
  type: InterruptType;
  priority: InterruptPriority;
  confidence: number;
  extractedContext: string | null;
  targetAgentId: string | null;
  processingNotes: string | null;
  status: 'pending' | 'processing' | 'applied' | 'rejected' | 'expired';
  appliedAt?: Date;
}

/**
 * Agent execution context for injection
 */
export interface AgentExecutionContext {
  agentId: string;
  sessionId: string;
  currentPhase: string;
  currentTool?: string;
  pendingInterrupts: ClassifiedInterrupt[];
  lastCheckpoint?: string;
}

/**
 * Interrupt application result
 */
export interface InterruptApplicationResult {
  success: boolean;
  interruptId: string;
  action: 'applied' | 'queued' | 'rejected' | 'requires_response';
  agentResponse?: string;
  contextInjected?: string;
  stateChanges?: Record<string, unknown>;
}

// =============================================================================
// SOFT INTERRUPT MANAGER
// =============================================================================

export class SoftInterruptManager {
  private openRouterClient = createOpenRouterClient();
  private interruptQueue: Map<string, ClassifiedInterrupt[]> = new Map();
  private activeContexts: Map<string, AgentExecutionContext> = new Map();
  private processingLocks: Set<string> = new Set();

  // Classification prompts for AI-based interrupt analysis
  private readonly CLASSIFICATION_PROMPT = `You are an AI interrupt classifier for a code-building agent system.

Analyze the user's message and classify it into one of these types:
- HALT: User wants to stop the agent immediately (e.g., "stop", "wait", "hold on", "cancel")
- CONTEXT_ADD: User is adding helpful information without wanting to stop (e.g., "also remember...", "by the way...", "the API key is...")
- COURSE_CORRECT: User wants to redirect without restarting (e.g., "actually use React instead", "change the color to blue", "skip that feature")
- BACKTRACK: User wants to undo recent work (e.g., "go back", "undo that", "revert to before...")
- QUEUE: User is requesting something for later (e.g., "when you're done...", "next, add...", "after this...")
- CLARIFICATION: Agent should respond/ask before continuing (e.g., "what do you think about...", "should I...", questions)
- URGENT_FIX: Critical fix needed now (e.g., "bug!", "that's wrong!", "error in...")
- APPRECIATION: User showing approval, no action needed (e.g., "nice!", "looks good", "perfect")
- IGNORE: Not relevant to the task (e.g., random chat, off-topic)

Also extract:
1. Priority: critical (needs immediate action), high (soon), normal (default), low (when convenient), deferred (can wait)
2. Any specific context that should be injected into the agent's working memory
3. If the message targets a specific agent (by name or task reference)

Current agent context:
{{AGENT_CONTEXT}}

User message: "{{MESSAGE}}"

Respond in JSON:
{
  "type": "INTERRUPT_TYPE",
  "priority": "PRIORITY_LEVEL",
  "confidence": 0.0-1.0,
  "extractedContext": "relevant context to inject or null",
  "targetAgent": "agent name/id or null if for all",
  "processingNotes": "brief explanation of classification"
}`;

  // =============================================================================
  // CORE METHODS
  // =============================================================================

  /**
   * Submit a user interrupt for classification and queuing
   */
  async submitInterrupt(
    sessionId: string,
    message: string,
    agentId?: string
  ): Promise<ClassifiedInterrupt> {
    const interrupt: UserInterrupt = {
      id: uuidv4(),
      sessionId,
      agentId,
      message,
      timestamp: new Date(),
      rawInput: message
    };

    // Get current agent context for classification
    const context = await this.getAgentContext(sessionId, agentId);

    // Classify the interrupt using AI
    const classified = await this.classifyInterrupt(interrupt, context);

    // Add to priority queue
    await this.queueInterrupt(classified);

    // Log the interrupt
    await this.logInterrupt(classified);

    // If HALT type, trigger immediate processing
    if (classified.type === 'HALT') {
      await this.processHaltInterrupt(classified);
    }

    return classified;
  }

  /**
   * Classify user input using AI
   */
  private async classifyInterrupt(
    interrupt: UserInterrupt,
    context: AgentExecutionContext | null
  ): Promise<ClassifiedInterrupt> {
    const contextStr = context
      ? `Agent: ${context.agentId}, Phase: ${context.currentPhase}, Tool: ${context.currentTool || 'none'}`
      : 'No active agent context';

    const prompt = this.CLASSIFICATION_PROMPT
      .replace('{{AGENT_CONTEXT}}', contextStr)
      .replace('{{MESSAGE}}', interrupt.message);

    try {
      const response = await this.openRouterClient.chat({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());

      return {
        ...interrupt,
        type: parsed.type as InterruptType || 'CONTEXT_ADD',
        priority: parsed.priority as InterruptPriority || 'normal',
        confidence: parsed.confidence || 0.5,
        extractedContext: parsed.extractedContext || null,
        targetAgentId: parsed.targetAgent || interrupt.agentId || null,
        processingNotes: parsed.processingNotes || null,
        status: 'pending'
      };
    } catch (error) {
      // Fallback classification based on keywords
      return this.fallbackClassification(interrupt);
    }
  }

  /**
   * Fallback classification using keyword matching
   */
  private fallbackClassification(interrupt: UserInterrupt): ClassifiedInterrupt {
    const msg = interrupt.message.toLowerCase();

    let type: InterruptType = 'CONTEXT_ADD';
    let priority: InterruptPriority = 'normal';

    // HALT keywords
    if (/\b(stop|halt|wait|hold|cancel|abort|pause)\b/.test(msg)) {
      type = 'HALT';
      priority = 'critical';
    }
    // BACKTRACK keywords
    else if (/\b(undo|revert|go back|roll back|previous)\b/.test(msg)) {
      type = 'BACKTRACK';
      priority = 'high';
    }
    // URGENT_FIX keywords
    else if (/\b(bug|error|wrong|fix|broken|crash|fail)\b/.test(msg)) {
      type = 'URGENT_FIX';
      priority = 'critical';
    }
    // COURSE_CORRECT keywords
    else if (/\b(instead|change|actually|rather|switch to|use .* instead)\b/.test(msg)) {
      type = 'COURSE_CORRECT';
      priority = 'high';
    }
    // QUEUE keywords
    else if (/\b(next|after|when.*done|later|then|also add)\b/.test(msg)) {
      type = 'QUEUE';
      priority = 'low';
    }
    // CLARIFICATION keywords (questions)
    else if (/\?$|\b(should|would|could|what|how|why)\b/.test(msg)) {
      type = 'CLARIFICATION';
      priority = 'high';
    }
    // APPRECIATION keywords
    else if (/\b(nice|good|great|perfect|awesome|thanks|love it)\b/.test(msg)) {
      type = 'APPRECIATION';
      priority = 'low';
    }

    return {
      ...interrupt,
      type,
      priority,
      confidence: 0.6, // Lower confidence for fallback
      extractedContext: null,
      targetAgentId: interrupt.agentId || null,
      processingNotes: 'Classified via keyword fallback',
      status: 'pending'
    };
  }

  /**
   * Add classified interrupt to the priority queue
   */
  private async queueInterrupt(interrupt: ClassifiedInterrupt): Promise<void> {
    const queueKey = interrupt.sessionId;

    if (!this.interruptQueue.has(queueKey)) {
      this.interruptQueue.set(queueKey, []);
    }

    const queue = this.interruptQueue.get(queueKey)!;
    queue.push(interrupt);

    // Sort by priority
    const priorityOrder: Record<InterruptPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
      deferred: 4
    };

    queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Process a HALT interrupt immediately
   */
  private async processHaltInterrupt(interrupt: ClassifiedInterrupt): Promise<void> {
    // Update all agents in the session to paused state
    if (interrupt.targetAgentId) {
      await db.update(developerModeAgents)
        .set({
          status: 'paused',
          currentPhase: 'halted_by_user'
        })
        .where(eq(developerModeAgents.id, interrupt.targetAgentId));
    } else {
      // Halt all agents in session
      const session = await db.query.developerModeSessions.findFirst({
        where: eq(developerModeSessions.id, interrupt.sessionId)
      });

      if (session) {
        await db.update(developerModeAgents)
          .set({
            status: 'paused',
            currentPhase: 'halted_by_user'
          })
          .where(eq(developerModeAgents.sessionId, session.id));
      }
    }

    interrupt.status = 'applied';
    interrupt.appliedAt = new Date();
  }

  /**
   * Get pending interrupts for an agent at a tool boundary
   */
  async getInterruptsAtToolBoundary(
    sessionId: string,
    agentId: string
  ): Promise<ClassifiedInterrupt[]> {
    const queue = this.interruptQueue.get(sessionId) || [];

    return queue.filter(interrupt =>
      interrupt.status === 'pending' &&
      (interrupt.targetAgentId === null || interrupt.targetAgentId === agentId)
    );
  }

  /**
   * Apply an interrupt to an agent's context
   */
  async applyInterrupt(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    const lockKey = `${interrupt.sessionId}:${agentId}`;

    // Prevent concurrent processing
    if (this.processingLocks.has(lockKey)) {
      return {
        success: false,
        interruptId: interrupt.id,
        action: 'rejected'
      };
    }

    this.processingLocks.add(lockKey);

    try {
      let result: InterruptApplicationResult;

      switch (interrupt.type) {
        case 'HALT':
          result = await this.applyHalt(interrupt, agentId);
          break;
        case 'CONTEXT_ADD':
          result = await this.applyContextAdd(interrupt, agentId);
          break;
        case 'COURSE_CORRECT':
          result = await this.applyCourseCorrect(interrupt, agentId);
          break;
        case 'BACKTRACK':
          result = await this.applyBacktrack(interrupt, agentId);
          break;
        case 'QUEUE':
          result = await this.applyQueue(interrupt, agentId);
          break;
        case 'CLARIFICATION':
          result = await this.applyClarification(interrupt, agentId);
          break;
        case 'URGENT_FIX':
          result = await this.applyUrgentFix(interrupt, agentId);
          break;
        case 'APPRECIATION':
          result = { success: true, interruptId: interrupt.id, action: 'applied' };
          break;
        case 'IGNORE':
          result = { success: true, interruptId: interrupt.id, action: 'rejected' };
          break;
        default:
          result = { success: false, interruptId: interrupt.id, action: 'rejected' };
      }

      // Update interrupt status
      interrupt.status = result.success ? 'applied' : 'rejected';
      interrupt.appliedAt = new Date();

      return result;
    } finally {
      this.processingLocks.delete(lockKey);
    }
  }

  // =============================================================================
  // INTERRUPT TYPE HANDLERS
  // =============================================================================

  private async applyHalt(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    await db.update(developerModeAgents)
      .set({
        status: 'paused',
        currentPhase: 'halted_by_user'
      })
      .where(eq(developerModeAgents.id, agentId));

    await this.logAgentAction(agentId, 'HALT', interrupt.message);

    return {
      success: true,
      interruptId: interrupt.id,
      action: 'applied',
      agentResponse: 'Agent paused. Ready to resume on your command.',
      stateChanges: { status: 'paused' }
    };
  }

  private async applyContextAdd(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    // Get current agent
    const agent = await db.query.developerModeAgents.findFirst({
      where: eq(developerModeAgents.id, agentId)
    });

    if (!agent) {
      return { success: false, interruptId: interrupt.id, action: 'rejected' };
    }

    // Append context to agent's task description or create context field
    const currentContext = agent.taskDescription || '';
    const newContext = `${currentContext}\n\n[USER CONTEXT ADDED]: ${interrupt.extractedContext || interrupt.message}`;

    await db.update(developerModeAgents)
      .set({ taskDescription: newContext })
      .where(eq(developerModeAgents.id, agentId));

    await this.logAgentAction(agentId, 'CONTEXT_ADD', interrupt.message);

    return {
      success: true,
      interruptId: interrupt.id,
      action: 'applied',
      contextInjected: interrupt.extractedContext || interrupt.message,
      agentResponse: 'Context noted. Incorporating into current work.'
    };
  }

  private async applyCourseCorrect(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    // Get current agent
    const agent = await db.query.developerModeAgents.findFirst({
      where: eq(developerModeAgents.id, agentId)
    });

    if (!agent) {
      return { success: false, interruptId: interrupt.id, action: 'rejected' };
    }

    // Update task description with correction
    const correctionNote = `\n\n[COURSE CORRECTION]: ${interrupt.message}`;
    const updatedTask = (agent.taskDescription || '') + correctionNote;

    await db.update(developerModeAgents)
      .set({
        taskDescription: updatedTask,
        currentPhase: 'course_corrected'
      })
      .where(eq(developerModeAgents.id, agentId));

    await this.logAgentAction(agentId, 'COURSE_CORRECT', interrupt.message);

    return {
      success: true,
      interruptId: interrupt.id,
      action: 'applied',
      agentResponse: 'Course corrected. Adjusting approach without restarting.',
      stateChanges: { courseCorrection: interrupt.message }
    };
  }

  private async applyBacktrack(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    // This would integrate with the Time Machine checkpoint system
    // For now, we mark the agent for backtrack
    await db.update(developerModeAgents)
      .set({
        status: 'paused',
        currentPhase: 'backtrack_requested'
      })
      .where(eq(developerModeAgents.id, agentId));

    await this.logAgentAction(agentId, 'BACKTRACK', interrupt.message);

    return {
      success: true,
      interruptId: interrupt.id,
      action: 'applied',
      agentResponse: 'Backtrack requested. Preparing to revert to previous state.',
      stateChanges: { backtrackRequested: true }
    };
  }

  private async applyQueue(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    // Queue the request for after current task
    interrupt.status = 'pending';
    interrupt.priority = 'deferred';

    await this.logAgentAction(agentId, 'QUEUE', interrupt.message);

    return {
      success: true,
      interruptId: interrupt.id,
      action: 'queued',
      agentResponse: 'Noted for later. Will address after current task completes.'
    };
  }

  private async applyClarification(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    // Pause agent and request response
    await db.update(developerModeAgents)
      .set({
        status: 'paused',
        currentPhase: 'awaiting_clarification'
      })
      .where(eq(developerModeAgents.id, agentId));

    await this.logAgentAction(agentId, 'CLARIFICATION', interrupt.message);

    return {
      success: true,
      interruptId: interrupt.id,
      action: 'requires_response',
      agentResponse: 'Processing your question. Agent paused pending response.'
    };
  }

  private async applyUrgentFix(
    interrupt: ClassifiedInterrupt,
    agentId: string
  ): Promise<InterruptApplicationResult> {
    // Elevate to high priority and inject fix request
    const agent = await db.query.developerModeAgents.findFirst({
      where: eq(developerModeAgents.id, agentId)
    });

    if (!agent) {
      return { success: false, interruptId: interrupt.id, action: 'rejected' };
    }

    const urgentNote = `\n\n[URGENT FIX REQUIRED]: ${interrupt.message}`;

    await db.update(developerModeAgents)
      .set({
        taskDescription: (agent.taskDescription || '') + urgentNote,
        currentPhase: 'urgent_fix'
      })
      .where(eq(developerModeAgents.id, agentId));

    await this.logAgentAction(agentId, 'URGENT_FIX', interrupt.message);

    return {
      success: true,
      interruptId: interrupt.id,
      action: 'applied',
      agentResponse: 'Urgent fix acknowledged. Prioritizing immediately.',
      stateChanges: { urgentFix: interrupt.message }
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async getAgentContext(
    sessionId: string,
    agentId?: string
  ): Promise<AgentExecutionContext | null> {
    if (this.activeContexts.has(sessionId)) {
      return this.activeContexts.get(sessionId)!;
    }

    // Build context from database
    if (agentId) {
      const agent = await db.query.developerModeAgents.findFirst({
        where: eq(developerModeAgents.id, agentId)
      });

      if (agent) {
        const context: AgentExecutionContext = {
          agentId: agent.id,
          sessionId: agent.sessionId,
          currentPhase: agent.currentPhase || 'unknown',
          currentTool: undefined,
          pendingInterrupts: []
        };
        this.activeContexts.set(sessionId, context);
        return context;
      }
    }

    return null;
  }

  /**
   * Update active agent context (called by agent execution)
   */
  updateAgentContext(
    sessionId: string,
    agentId: string,
    phase: string,
    tool?: string
  ): void {
    const context: AgentExecutionContext = {
      agentId,
      sessionId,
      currentPhase: phase,
      currentTool: tool,
      pendingInterrupts: this.interruptQueue.get(sessionId) || []
    };
    this.activeContexts.set(sessionId, context);
  }

  private async logInterrupt(interrupt: ClassifiedInterrupt): Promise<void> {
    // Log to developer mode agent logs if there's a target agent
    if (interrupt.targetAgentId) {
      await db.insert(developerModeAgentLogs).values({
        id: uuidv4(),
        agentId: interrupt.targetAgentId,
        type: 'user_interrupt',
        message: `[${interrupt.type}] ${interrupt.message}`,
        metadata: JSON.stringify({
          interruptId: interrupt.id,
          type: interrupt.type,
          priority: interrupt.priority,
          confidence: interrupt.confidence
        }),
        timestamp: new Date()
      });
    }
  }

  private async logAgentAction(
    agentId: string,
    action: InterruptType,
    message: string
  ): Promise<void> {
    await db.insert(developerModeAgentLogs).values({
      id: uuidv4(),
      agentId,
      type: 'interrupt_applied',
      message: `Applied ${action}: ${message}`,
      metadata: JSON.stringify({ action }),
      timestamp: new Date()
    });
  }

  /**
   * Get interrupt history for a session
   */
  async getInterruptHistory(sessionId: string): Promise<ClassifiedInterrupt[]> {
    return this.interruptQueue.get(sessionId) || [];
  }

  /**
   * Clear processed interrupts from queue
   */
  clearProcessedInterrupts(sessionId: string): void {
    const queue = this.interruptQueue.get(sessionId);
    if (queue) {
      const filtered = queue.filter(i => i.status === 'pending');
      this.interruptQueue.set(sessionId, filtered);
    }
  }

  /**
   * Resume an agent after clarification
   */
  async resumeAfterClarification(
    agentId: string,
    response: string
  ): Promise<void> {
    const agent = await db.query.developerModeAgents.findFirst({
      where: eq(developerModeAgents.id, agentId)
    });

    if (agent && agent.currentPhase === 'awaiting_clarification') {
      const responseNote = `\n\n[CLARIFICATION RESPONSE]: ${response}`;

      await db.update(developerModeAgents)
        .set({
          taskDescription: (agent.taskDescription || '') + responseNote,
          status: 'active',
          currentPhase: 'resumed_with_clarification'
        })
        .where(eq(developerModeAgents.id, agentId));
    }
  }
}

// =============================================================================
// FACTORY & EXPORTS
// =============================================================================

let softInterruptManager: SoftInterruptManager | null = null;

export function createSoftInterruptManager(): SoftInterruptManager {
  if (!softInterruptManager) {
    softInterruptManager = new SoftInterruptManager();
  }
  return softInterruptManager;
}

export function getSoftInterruptManager(): SoftInterruptManager {
  if (!softInterruptManager) {
    throw new Error('SoftInterruptManager not initialized. Call createSoftInterruptManager first.');
  }
  return softInterruptManager;
}

