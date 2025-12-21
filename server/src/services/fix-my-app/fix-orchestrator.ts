/**
 * Fix My App Orchestrator
 *
 * Bridges the gap between:
 * 1. Vision Capture (Gemini 3 Flash + Playwright)
 * 2. Intent Lock creation from captured chat history
 * 3. Build Loop execution to fix the imported project
 *
 * This is the missing piece that connects auto-import to the full fix flow.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { projects, notifications, orchestrationRuns, buildIntents } from '../../schema.js';
import { eq } from 'drizzle-orm';
import {
  createAndLockIntent,
  type IntentContract,
} from '../ai/intent-lock.js';
import {
  createClaudeService,
  CLAUDE_MODELS,
} from '../ai/claude-service.js';
import {
  OPENROUTER_MODELS,
} from '../ai/openrouter-client.js';
import {
  createBuildLoopOrchestrator,
  type BuildLoopOrchestrator,
} from '../automation/build-loop.js';

// =============================================================================
// TYPES
// =============================================================================

export type FixStatus =
  | 'pending'
  | 'analyzing'
  | 'creating_intent'
  | 'building'
  | 'verifying'
  | 'completed'
  | 'failed';

export interface FixMyAppSession {
  id: string;
  projectId: string;
  userId: string;
  status: FixStatus;
  progress: number; // 0-100
  importSource: string;
  importUrl: string;
  chatHistory: ChatMessage[];
  errors: CapturedError[];
  intentContract?: IntentContract;
  orchestrationRunId?: string;
  buildLoop?: BuildLoopOrchestrator;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  codeBlocks?: Array<{ language: string; code: string }>;
}

export interface CapturedError {
  type: string;
  message: string;
  timestamp: string;
  source?: string;
  stack?: string;
}

export interface FixOrchestratorEvents {
  'status_change': { sessionId: string; status: FixStatus; progress: number };
  'intent_created': { sessionId: string; intent: IntentContract };
  'build_started': { sessionId: string; orchestrationRunId: string };
  'progress': { sessionId: string; progress: number; message: string };
  'complete': { sessionId: string; projectId: string };
  'error': { sessionId: string; error: string };
}

// =============================================================================
// PROMPTS FOR INTENT EXTRACTION FROM CHAT HISTORY
// =============================================================================

const CHAT_ANALYSIS_PROMPT = `You are analyzing a conversation between a user and an AI coding assistant to understand:
1. What the user was trying to build (core intent)
2. What went wrong (errors, issues, failures)
3. What features were attempted vs successfully implemented
4. What the user's original vision was

CONVERSATION:
{chatHistory}

CAPTURED ERRORS:
{errors}

Based on this conversation, create a comprehensive project description that captures:
1. The user's original intent and vision
2. What they were trying to achieve
3. The core functionality they needed
4. Any specific requirements mentioned
5. What went wrong that needs to be fixed

Write a detailed project description as if the user was describing their app from scratch, but incorporate learnings about what failed so we can avoid those issues.

Respond with ONLY the project description text, no JSON or formatting.`;

// =============================================================================
// FIX ORCHESTRATOR CLASS
// =============================================================================

export class FixMyAppOrchestrator extends EventEmitter {
  private sessions: Map<string, FixMyAppSession> = new Map();

  /**
   * Start a fix session for an imported project
   */
  async startFix(
    projectId: string,
    userId: string,
    chatHistory: ChatMessage[],
    errors: CapturedError[],
    importSource: string,
    importUrl: string
  ): Promise<FixMyAppSession> {
    const sessionId = uuidv4();

    const session: FixMyAppSession = {
      id: sessionId,
      projectId,
      userId,
      status: 'pending',
      progress: 0,
      importSource,
      importUrl,
      chatHistory,
      errors,
      startedAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    // Update project status in database
    await this.updateProjectStatus(projectId, 'analyzing', 0, sessionId, importSource, importUrl);

    // Start the fix process asynchronously
    this.executeFix(session).catch(error => {
      console.error(`[FixOrchestrator] Fix failed for session ${sessionId}:`, error);
      this.handleError(sessionId, error.message);
    });

    return session;
  }

  /**
   * Execute the full fix flow
   */
  private async executeFix(session: FixMyAppSession): Promise<void> {
    try {
      // Phase 1: Analyze chat history and extract intent
      await this.updateStatus(session.id, 'analyzing', 10, 'Analyzing conversation history...');
      const projectDescription = await this.extractIntentFromChat(session);

      // Phase 2: Create Intent Lock
      await this.updateStatus(session.id, 'creating_intent', 30, 'Creating Sacred Contract...');
      const intentContract = await this.createIntentLock(session, projectDescription);
      session.intentContract = intentContract;

      this.emit('intent_created', { sessionId: session.id, intent: intentContract });

      // Phase 3: Create orchestration run and start build
      await this.updateStatus(session.id, 'building', 50, 'Starting build process...');
      const orchestrationRunId = await this.startBuildLoop(session, intentContract);
      session.orchestrationRunId = orchestrationRunId;

      this.emit('build_started', { sessionId: session.id, orchestrationRunId });

      // Phase 4: Wait for build completion (this is handled by build loop events)
      // The build loop will emit its own progress events
      // For now, we mark as building and let the build loop take over

      // Note: In a full implementation, we'd subscribe to build loop events
      // and update our status accordingly. For now, we'll set to building
      // and the build loop will handle the rest.

      await this.updateStatus(session.id, 'building', 60, 'Build loop running...');

      // Create notification that fix has started
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: session.userId,
        type: 'fix_started',
        title: 'Fix My App Started',
        message: `KripTik AI is now fixing your ${session.importSource} project. We'll notify you when it's complete.`,
        metadata: JSON.stringify({
          projectId: session.projectId,
          sessionId: session.id,
          orchestrationRunId,
          intentId: intentContract.id,
        }),
        read: false,
      });

    } catch (error) {
      console.error(`[FixOrchestrator] Error in fix flow:`, error);
      throw error;
    }
  }

  /**
   * Extract intent from chat history using AI
   */
  private async extractIntentFromChat(session: FixMyAppSession): Promise<string> {
    const chatHistoryText = session.chatHistory
      .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
      .join('\n\n');

    const errorsText = session.errors.length > 0
      ? session.errors.map(err => `- ${err.type}: ${err.message}`).join('\n')
      : 'No errors captured';

    const prompt = CHAT_ANALYSIS_PROMPT
      .replace('{chatHistory}', chatHistoryText)
      .replace('{errors}', errorsText);

    // Use Claude Service with Sonnet 4.5 for analysis (good balance of quality and cost)
    const claudeService = createClaudeService({
      projectId: session.projectId,
      userId: session.userId,
      agentType: 'planning',
    });

    const response = await claudeService.generate(prompt, {
      model: CLAUDE_MODELS.SONNET_4_5,
      maxTokens: 4096,
      temperature: 0.3,
      useExtendedThinking: false,
    });

    return response.content ||
      `Fix and complete the ${session.importSource} project that the user was building.`;
  }

  /**
   * Create Intent Lock (Sacred Contract) for the fix
   */
  private async createIntentLock(
    session: FixMyAppSession,
    projectDescription: string
  ): Promise<IntentContract> {
    // Enhance the prompt with fix-specific context
    const enhancedPrompt = `FIX MY APP REQUEST

ORIGINAL PLATFORM: ${session.importSource}
ORIGINAL URL: ${session.importUrl}

PROJECT DESCRIPTION (extracted from user's conversation):
${projectDescription}

CAPTURED ISSUES TO FIX:
${session.errors.map(e => `- ${e.type}: ${e.message}`).join('\n') || 'None specified'}

GOAL: Rebuild this project to match the user's original intent, fixing all issues that caused problems on the original platform.

The user has given up on ${session.importSource} and wants KripTik AI to fix their project and make it work.`;

    // Create and lock intent using Opus 4.5 with high thinking
    const intentContract = await createAndLockIntent(
      enhancedPrompt,
      session.userId,
      session.projectId,
      undefined, // orchestrationRunId will be set when build starts
      {
        model: OPENROUTER_MODELS.OPUS_4_5,
        effort: 'high',
        thinkingBudget: 64000,
      }
    );

    // Store intent ID in project
    await db.update(projects)
      .set({
        updatedAt: new Date().toISOString(),
      })
      .where(eq(projects.id, session.projectId));

    return intentContract;
  }

  /**
   * Start the build loop for the project using BuildLoopOrchestrator
   */
  private async startBuildLoop(
    session: FixMyAppSession,
    intentContract: IntentContract
  ): Promise<string> {
    // Create orchestration run
    const runId = uuidv4();

    await db.insert(orchestrationRuns).values({
      id: runId,
      projectId: session.projectId,
      userId: session.userId,
      prompt: `Fix My App: ${intentContract.coreValueProp}`,
      status: 'running',
      startedAt: new Date().toISOString(),
      phases: JSON.stringify({
        mode: 'fix_my_app',
        currentPhase: 'intent_lock',
        intentId: intentContract.id,
      }),
    });

    // Update the intent with the orchestration run ID
    await db.update(buildIntents)
      .set({ orchestrationRunId: runId })
      .where(eq(buildIntents.id, intentContract.id));

    // Create BuildLoopOrchestrator with 'fix' mode
    const buildLoop = createBuildLoopOrchestrator(
      session.projectId,
      session.userId,
      runId,
      'fix'
    );

    // Store reference in session
    session.buildLoop = buildLoop;

    // Subscribe to build loop events for status updates
    buildLoop.on('phase_start', (event) => {
      const phase = event.data?.phase || event.data?.stage || 'unknown';
      this.updateStatus(session.id, 'building', 50 + Math.min(40, session.progress), `Building: ${phase}`);
    });

    buildLoop.on('phase_complete', (event) => {
      const phase = event.data?.phase || event.data?.stage || 'unknown';
      this.updateStatus(session.id, 'building', 50 + Math.min(40, session.progress + 5), `Completed: ${phase}`);
    });

    buildLoop.on('verification_result', (event) => {
      if (event.data?.verdict === 'APPROVED') {
        this.updateStatus(session.id, 'verifying', 95, 'Verification passed');
      } else {
        this.updateStatus(session.id, 'verifying', 90, `Verification: ${event.data?.verdict || 'running'}`);
      }
    });

    buildLoop.on('build_complete', () => {
      this.markComplete(session.id);
    });

    buildLoop.on('error', (event) => {
      console.error(`[FixOrchestrator] Build error:`, event.data?.error);
      // Don't immediately fail - let error escalation try to fix it
    });

    // Build the enhanced prompt for the fix
    const fixPrompt = `FIX MY APP - ${intentContract.coreValueProp}

ORIGINAL PLATFORM: ${session.importSource}
ORIGINAL URL: ${session.importUrl}

INTENT CONTRACT:
${JSON.stringify({
  appSoul: intentContract.appSoul,
  coreValueProp: intentContract.coreValueProp,
  successCriteria: intentContract.successCriteria,
  userWorkflows: intentContract.userWorkflows,
  visualIdentity: intentContract.visualIdentity,
}, null, 2)}

ISSUES TO FIX:
${session.errors.map(e => `- ${e.type}: ${e.message}`).join('\n') || 'None specified'}

ORIGINAL CONVERSATION CONTEXT:
${session.chatHistory.slice(-10).map(msg => `[${msg.role.toUpperCase()}]: ${msg.content.slice(0, 500)}`).join('\n\n')}

GOAL: Rebuild this project to match the intent contract, fixing all issues that caused problems on the original platform.`;

    // Start the build loop asynchronously
    buildLoop.start(fixPrompt).catch(error => {
      console.error(`[FixOrchestrator] Build loop failed:`, error);
      this.handleError(session.id, error.message);
    });

    console.log(`[FixOrchestrator] Build loop started: ${runId}`);
    console.log(`[FixOrchestrator] Intent: ${intentContract.coreValueProp}`);
    console.log(`[FixOrchestrator] App Soul: ${intentContract.appSoul}`);

    return runId;
  }

  /**
   * Update session status and emit events
   */
  private async updateStatus(
    sessionId: string,
    status: FixStatus,
    progress: number,
    message: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;
    session.progress = progress;

    // Update project in database
    await this.updateProjectStatus(
      session.projectId,
      status,
      progress,
      sessionId,
      session.importSource,
      session.importUrl
    );

    this.emit('status_change', { sessionId, status, progress });
    this.emit('progress', { sessionId, progress, message });
  }

  /**
   * Update project fixing status in database
   */
  private async updateProjectStatus(
    projectId: string,
    status: FixStatus,
    progress: number,
    sessionId: string,
    importSource?: string,
    importUrl?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      fixingStatus: status,
      fixingProgress: progress,
      fixingSessionId: sessionId,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'analyzing' || status === 'pending') {
      updates.fixingStartedAt = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updates.fixingCompletedAt = new Date().toISOString();
    }

    if (importSource) {
      updates.importSource = importSource;
    }

    if (importUrl) {
      updates.importUrl = importUrl;
    }

    await db.update(projects)
      .set(updates)
      .where(eq(projects.id, projectId));
  }

  /**
   * Handle errors in the fix process
   */
  private async handleError(sessionId: string, errorMessage: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.error = errorMessage;
    session.completedAt = new Date();

    await this.updateProjectStatus(
      session.projectId,
      'failed',
      session.progress,
      sessionId
    );

    // Create error notification
    await db.insert(notifications).values({
      id: uuidv4(),
      userId: session.userId,
      type: 'fix_error',
      title: 'Fix My App Error',
      message: `There was an error fixing your ${session.importSource} project: ${errorMessage}`,
      metadata: JSON.stringify({
        projectId: session.projectId,
        sessionId,
        error: errorMessage,
      }),
      read: false,
    });

    this.emit('error', { sessionId, error: errorMessage });
  }

  /**
   * Mark fix as complete
   */
  async markComplete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.progress = 100;
    session.completedAt = new Date();

    await this.updateProjectStatus(
      session.projectId,
      'completed',
      100,
      sessionId
    );

    // Create completion notification
    await db.insert(notifications).values({
      id: uuidv4(),
      userId: session.userId,
      type: 'fix_complete',
      title: 'Your App Has Been Fixed!',
      message: `KripTik AI has successfully fixed your ${session.importSource} project. Check your dashboard to see the results!`,
      metadata: JSON.stringify({
        projectId: session.projectId,
        sessionId,
      }),
      read: false,
    });

    this.emit('complete', { sessionId, projectId: session.projectId });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): FixMyAppSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session by project ID
   */
  getSessionByProject(projectId: string): FixMyAppSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.projectId === projectId) {
        return session;
      }
    }
    return undefined;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let orchestratorInstance: FixMyAppOrchestrator | null = null;

export function getFixOrchestrator(): FixMyAppOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new FixMyAppOrchestrator();
  }
  return orchestratorInstance;
}

export function resetFixOrchestrator(): void {
  orchestratorInstance = null;
}
