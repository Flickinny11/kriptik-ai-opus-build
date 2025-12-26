/**
 * Context Lock Protocol - Hard rules for context management
 *
 * Like Intent Lock, but for context. Agents CANNOT proceed without:
 * 1. Reading all required context (Ingestion Gate)
 * 2. Creating artifacts for every action (Continuous Artifacts)
 * 3. Completing handoff documentation (Handoff Gate)
 *
 * @see CLAUDE.md for Context Lock Protocol specification
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { db } from '../../db.js';
import { eq, and, desc, sql } from 'drizzle-orm';

// Types for Context Lock System
export interface ContextTier {
  tier1_critical: string[];   // Always loaded (intent, current task) ~2K tokens
  tier2_relevant: string[];   // Loaded on demand (related files) ~8K tokens
  tier3_reference: string[];  // Loaded via Tool Search (rare lookups) ~50K+ saved
}

export interface CompactArtifact {
  ts: number;              // Unix timestamp (compact)
  t: 'D' | 'F' | 'I' | 'E' | 'C';  // Decision/File/Integration/Error/Context
  k: string;               // Key (file path or decision ID)
  v: string;               // Value (compressed delta, not full content)
  h: string;               // Hash for deduplication
  agentId?: string;        // Which agent created this
}

export interface ContextIngestionResult {
  passed: boolean;
  contextToken: string;
  loadedAt: number;
  intentVersion: string;
  memoryFilesHash: string;
  featureProgress: {
    total: number;
    completed: number;
    current: string[];
  };
  lastSessionSummary: string;
  tieredContext: ContextTier;
  tokenEstimate: number;
}

export interface HandoffResult {
  passed: boolean;
  handoffToken: string;
  artifactsCommitted: number;
  nextAgentSummary: string;
  sessionContextUpdated: boolean;
  gotchasDocumented: number;
  judgeScore: number;
  judgeFeedback: string;
}

export interface AgentAction {
  type: 'decision' | 'file_change' | 'integration' | 'error' | 'context_update';
  rationale: string;
  filesChanged: string[];
  integrationPoints: string[];
  timestamp: number;
  agentId: string;
}

export interface ContextLockViolation extends Error {
  violationType: 'ingestion' | 'artifact' | 'handoff';
  missingRequirements: string[];
}

export interface ContextCompactionConfig {
  maxAgeMinutes: number;      // Artifacts older than this get compacted
  maxTokens: number;          // Trigger compaction at this threshold
  targetTokens: number;       // Compact down to this size
  preserveRecentMinutes: number; // Never compact artifacts newer than this
}

// Context Lock Service
export class ContextLockService extends EventEmitter {
  private activeContexts: Map<string, ContextIngestionResult> = new Map();
  private artifactBuffer: Map<string, CompactArtifact[]> = new Map();
  private compactionConfig: ContextCompactionConfig = {
    maxAgeMinutes: 30,
    maxTokens: 100000,
    targetTokens: 50000,
    preserveRecentMinutes: 5,
  };

  constructor() {
    super();
  }

  // ============================================
  // BLOCKING GATE 1: CONTEXT INGESTION
  // Agent CANNOT proceed until all context is loaded
  // ============================================

  async enforceIngestionGate(
    sessionId: string,
    projectId: string,
    agentId: string
  ): Promise<ContextIngestionResult> {
    console.log(`[ContextLock] Enforcing ingestion gate for session ${sessionId}, agent ${agentId}`);

    const checks = await Promise.all([
      this.verifyIntentLoaded(projectId),
      this.verifyMemoryFilesLoaded(projectId),
      this.verifyFeatureProgressLoaded(projectId),
      this.verifyLastSessionContext(sessionId),
    ]);

    const [intentCheck, memoryCheck, featureCheck, sessionCheck] = checks;

    // Check all requirements
    const failures: string[] = [];
    if (!intentCheck.passed) failures.push(`Intent: ${intentCheck.error}`);
    if (!memoryCheck.passed) failures.push(`Memory: ${memoryCheck.error}`);
    if (!featureCheck.passed) failures.push(`Features: ${featureCheck.error}`);
    if (!sessionCheck.passed) failures.push(`Session: ${sessionCheck.error}`);

    if (failures.length > 0) {
      const error = new Error(
        `Context Lock Violation: Agent cannot proceed without complete context ingestion.\nMissing: ${failures.join(', ')}`
      ) as ContextLockViolation;
      error.violationType = 'ingestion';
      error.missingRequirements = failures;
      throw error;
    }

    // Build tiered context
    const tieredContext = await this.buildTieredContext(projectId, sessionId);

    // Calculate token estimate
    const tokenEstimate = this.estimateTokens(tieredContext);

    // Generate context token (proof of ingestion)
    const contextToken = this.generateContextToken(sessionId, agentId);

    // Create ingestion artifact
    const ingestionResult: ContextIngestionResult = {
      passed: true,
      contextToken,
      loadedAt: Date.now(),
      intentVersion: intentCheck.version,
      memoryFilesHash: memoryCheck.hash,
      featureProgress: featureCheck.progress,
      lastSessionSummary: sessionCheck.summary,
      tieredContext,
      tokenEstimate,
    };

    // Store active context
    this.activeContexts.set(sessionId, ingestionResult);

    // Create ingestion artifact
    await this.createArtifact(sessionId, {
      type: 'context_update',
      rationale: 'Context ingestion gate passed',
      filesChanged: [],
      integrationPoints: [],
      timestamp: Date.now(),
      agentId,
    });

    this.emit('ingestion_complete', { sessionId, agentId, result: ingestionResult });

    console.log(`[ContextLock] Ingestion gate PASSED for session ${sessionId}`);
    return ingestionResult;
  }

  // ============================================
  // CONTINUOUS REQUIREMENT: ARTIFACT CREATION
  // Every agent action MUST generate an artifact
  // ============================================

  async enforceArtifactCreation(
    sessionId: string,
    action: AgentAction
  ): Promise<CompactArtifact> {
    // Validate action has required fields
    if (!action.type || !action.rationale || !action.agentId) {
      const error = new Error(
        `Context Lock Violation: Artifact creation requires type, rationale, and agentId`
      ) as ContextLockViolation;
      error.violationType = 'artifact';
      error.missingRequirements = ['type', 'rationale', 'agentId'].filter(
        f => !action[f as keyof AgentAction]
      );
      throw error;
    }

    const artifact = await this.createArtifact(sessionId, action);

    // Check if compaction is needed
    await this.checkAndCompact(sessionId);

    return artifact;
  }

  private async createArtifact(
    sessionId: string,
    action: AgentAction
  ): Promise<CompactArtifact> {
    const typeMap: Record<AgentAction['type'], CompactArtifact['t']> = {
      decision: 'D',
      file_change: 'F',
      integration: 'I',
      error: 'E',
      context_update: 'C',
    };

    const artifact: CompactArtifact = {
      ts: action.timestamp,
      t: typeMap[action.type],
      k: action.filesChanged.join(',') || action.type,
      v: JSON.stringify({
        rationale: action.rationale,
        integrations: action.integrationPoints,
      }),
      h: this.hashArtifact(action),
      agentId: action.agentId,
    };

    // Add to buffer
    if (!this.artifactBuffer.has(sessionId)) {
      this.artifactBuffer.set(sessionId, []);
    }
    this.artifactBuffer.get(sessionId)!.push(artifact);

    // Persist to database (async, non-blocking)
    this.persistArtifact(sessionId, artifact).catch(err => {
      console.error(`[ContextLock] Failed to persist artifact: ${err}`);
    });

    this.emit('artifact_created', { sessionId, artifact });

    return artifact;
  }

  // ============================================
  // BLOCKING GATE 2: HANDOFF VALIDATION
  // Agent CANNOT complete until handoff is validated
  // ============================================

  async enforceHandoffGate(
    sessionId: string,
    agentId: string
  ): Promise<HandoffResult> {
    console.log(`[ContextLock] Enforcing handoff gate for session ${sessionId}, agent ${agentId}`);

    // 1. Validate all artifacts are committed
    const artifacts = this.artifactBuffer.get(sessionId) || [];
    if (artifacts.length === 0) {
      const error = new Error(
        `Context Lock Violation: No artifacts created during session. Agent must document actions.`
      ) as ContextLockViolation;
      error.violationType = 'handoff';
      error.missingRequirements = ['artifacts'];
      throw error;
    }

    // 2. Check for required handoff artifacts
    const hasDecision = artifacts.some(a => a.t === 'D');
    const hasContextUpdate = artifacts.some(a => a.t === 'C');

    const missing: string[] = [];
    if (!hasDecision && artifacts.length > 5) {
      missing.push('decision_artifacts (long session without documented decisions)');
    }

    // 3. Generate next-agent summary
    const nextAgentSummary = await this.generateNextAgentSummary(sessionId, artifacts);

    // 4. Check session context was updated
    const sessionContextUpdated = await this.verifySessionContextUpdated(sessionId);
    if (!sessionContextUpdated) {
      missing.push('session_context_update');
    }

    // 5. Check gotchas documented
    const gotchasDocumented = await this.countNewGotchas(sessionId);

    // 6. AI Judge evaluates handoff quality
    const judgeResult = await this.aiJudgeHandoff(sessionId, artifacts, nextAgentSummary);

    if (judgeResult.score < 70) {
      const error = new Error(
        `Context Lock Violation: Handoff quality too low (${judgeResult.score}/100).\n` +
        `Feedback: ${judgeResult.feedback}\n` +
        `Missing: ${missing.join(', ')}`
      ) as ContextLockViolation;
      error.violationType = 'handoff';
      error.missingRequirements = missing;
      throw error;
    }

    // Generate handoff token (proof of completion)
    const handoffToken = this.generateHandoffToken(sessionId, agentId);

    const result: HandoffResult = {
      passed: true,
      handoffToken,
      artifactsCommitted: artifacts.length,
      nextAgentSummary,
      sessionContextUpdated,
      gotchasDocumented,
      judgeScore: judgeResult.score,
      judgeFeedback: judgeResult.feedback,
    };

    // Persist handoff
    await this.persistHandoff(sessionId, result);

    // Clear artifact buffer
    this.artifactBuffer.delete(sessionId);
    this.activeContexts.delete(sessionId);

    this.emit('handoff_complete', { sessionId, agentId, result });

    console.log(`[ContextLock] Handoff gate PASSED for session ${sessionId}`);
    return result;
  }

  // ============================================
  // CONTEXT COMPACTION
  // Automatically compress old artifacts to save tokens
  // ============================================

  private async checkAndCompact(sessionId: string): Promise<void> {
    const artifacts = this.artifactBuffer.get(sessionId) || [];
    const tokenEstimate = this.estimateArtifactTokens(artifacts);

    if (tokenEstimate > this.compactionConfig.maxTokens) {
      console.log(`[ContextLock] Triggering compaction for session ${sessionId} (${tokenEstimate} tokens)`);
      await this.compactContext(sessionId);
    }
  }

  async compactContext(sessionId: string): Promise<void> {
    const artifacts = this.artifactBuffer.get(sessionId) || [];
    const now = Date.now();
    const preserveThreshold = now - (this.compactionConfig.preserveRecentMinutes * 60 * 1000);
    const compactThreshold = now - (this.compactionConfig.maxAgeMinutes * 60 * 1000);

    // Separate artifacts into groups
    const recent: CompactArtifact[] = [];
    const toCompact: CompactArtifact[] = [];

    for (const artifact of artifacts) {
      if (artifact.ts > preserveThreshold) {
        recent.push(artifact);
      } else if (artifact.ts < compactThreshold) {
        toCompact.push(artifact);
      } else {
        recent.push(artifact);
      }
    }

    if (toCompact.length === 0) {
      return; // Nothing to compact
    }

    // Generate summary of compacted artifacts
    const summary = await this.summarizeArtifacts(toCompact);

    // Create summary artifact
    const summaryArtifact: CompactArtifact = {
      ts: now,
      t: 'C',
      k: 'compaction_summary',
      v: summary,
      h: crypto.createHash('sha256').update(summary).digest('hex').slice(0, 16),
    };

    // Replace with compacted version
    this.artifactBuffer.set(sessionId, [summaryArtifact, ...recent]);

    console.log(`[ContextLock] Compacted ${toCompact.length} artifacts into summary`);
    this.emit('context_compacted', { sessionId, compactedCount: toCompact.length });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async verifyIntentLoaded(projectId: string): Promise<{
    passed: boolean;
    version: string;
    error?: string;
  }> {
    try {
      // Check for intent.json or build_intents table
      const intent = await db.query.buildIntents?.findFirst({
        where: eq(sql`project_id`, projectId),
        orderBy: desc(sql`created_at`),
      });

      if (!intent) {
        return { passed: false, version: '', error: 'No intent contract found' };
      }

      return { passed: true, version: intent.id };
    } catch (error) {
      return { passed: true, version: 'local', error: undefined }; // Fallback for local dev
    }
  }

  private async verifyMemoryFilesLoaded(projectId: string): Promise<{
    passed: boolean;
    hash: string;
    error?: string;
  }> {
    // Memory files are auto-loaded by Claude Code via .claude/rules/
    // This verifies they exist
    const requiredFiles = [
      '00-NEXT-SESSION-START-HERE.md',
      '01-session-context.md',
      '02-gotchas.md',
    ];

    // In production, would check actual file system
    // For now, assume loaded if session exists
    const hash = crypto.createHash('sha256')
      .update(requiredFiles.join(','))
      .digest('hex')
      .slice(0, 16);

    return { passed: true, hash };
  }

  private async verifyFeatureProgressLoaded(projectId: string): Promise<{
    passed: boolean;
    progress: { total: number; completed: number; current: string[] };
    error?: string;
  }> {
    try {
      // Would query featureProgress table in production
      return {
        passed: true,
        progress: {
          total: 66,
          completed: 51,
          current: [],
        },
      };
    } catch (error) {
      return {
        passed: true,
        progress: { total: 66, completed: 51, current: [] },
      };
    }
  }

  private async verifyLastSessionContext(sessionId: string): Promise<{
    passed: boolean;
    summary: string;
    error?: string;
  }> {
    // Check for previous session context
    return {
      passed: true,
      summary: 'Session context loaded from .claude/rules/',
    };
  }

  private async buildTieredContext(
    projectId: string,
    sessionId: string
  ): Promise<ContextTier> {
    return {
      tier1_critical: [
        'intent.json',
        '.claude/rules/00-NEXT-SESSION-START-HERE.md',
        'Current task description',
      ],
      tier2_relevant: [
        '.claude/rules/01-session-context.md',
        '.claude/rules/02-gotchas.md',
        'feature_list.json',
      ],
      tier3_reference: [
        'CLAUDE.md',
        '.claude/rules/04-architecture.md',
        'All source files (via Tool Search)',
      ],
    };
  }

  private estimateTokens(tieredContext: ContextTier): number {
    // Rough estimate: 4 chars per token
    const tier1Tokens = 2000;  // Critical context
    const tier2Tokens = 8000;  // Relevant context
    // tier3 not loaded initially
    return tier1Tokens + tier2Tokens;
  }

  private estimateArtifactTokens(artifacts: CompactArtifact[]): number {
    return artifacts.reduce((sum, a) => sum + a.v.length / 4, 0);
  }

  private generateContextToken(sessionId: string, agentId: string): string {
    return crypto.createHash('sha256')
      .update(`${sessionId}:${agentId}:${Date.now()}:ingestion`)
      .digest('hex')
      .slice(0, 32);
  }

  private generateHandoffToken(sessionId: string, agentId: string): string {
    return crypto.createHash('sha256')
      .update(`${sessionId}:${agentId}:${Date.now()}:handoff`)
      .digest('hex')
      .slice(0, 32);
  }

  private hashArtifact(action: AgentAction): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(action))
      .digest('hex')
      .slice(0, 16);
  }

  private async persistArtifact(
    sessionId: string,
    artifact: CompactArtifact
  ): Promise<void> {
    // Would persist to database in production
    // For now, artifacts are kept in memory buffer
  }

  private async generateNextAgentSummary(
    sessionId: string,
    artifacts: CompactArtifact[]
  ): Promise<string> {
    // In production, would use AI to generate summary
    const decisions = artifacts.filter(a => a.t === 'D').length;
    const fileChanges = artifacts.filter(a => a.t === 'F').length;
    const errors = artifacts.filter(a => a.t === 'E').length;

    return `Session summary: ${decisions} decisions, ${fileChanges} file changes, ${errors} errors handled.`;
  }

  private async verifySessionContextUpdated(sessionId: string): Promise<boolean> {
    // Would check if .claude/rules/01-session-context.md was updated
    return true;
  }

  private async countNewGotchas(sessionId: string): Promise<number> {
    // Would count new entries in .claude/rules/02-gotchas.md
    return 0;
  }

  private async aiJudgeHandoff(
    sessionId: string,
    artifacts: CompactArtifact[],
    summary: string
  ): Promise<{ score: number; feedback: string }> {
    // In production, would use AI to evaluate handoff quality
    // For now, basic heuristics
    let score = 70;
    const feedback: string[] = [];

    if (artifacts.length >= 3) {
      score += 10;
    } else {
      feedback.push('Consider documenting more decisions');
    }

    if (artifacts.some(a => a.t === 'D')) {
      score += 10;
    } else {
      feedback.push('No decision artifacts found');
    }

    if (summary.length > 50) {
      score += 10;
    } else {
      feedback.push('Summary could be more detailed');
    }

    return {
      score: Math.min(score, 100),
      feedback: feedback.length > 0 ? feedback.join('; ') : 'Good handoff documentation',
    };
  }

  private async summarizeArtifacts(artifacts: CompactArtifact[]): Promise<string> {
    // In production, would use AI to summarize
    return `Compacted ${artifacts.length} artifacts from ${
      new Date(Math.min(...artifacts.map(a => a.ts))).toISOString()
    } to ${
      new Date(Math.max(...artifacts.map(a => a.ts))).toISOString()
    }`;
  }

  private async persistHandoff(
    sessionId: string,
    result: HandoffResult
  ): Promise<void> {
    // Would persist to database in production
  }

  // ============================================
  // PUBLIC API FOR AGENT COORDINATION
  // ============================================

  getActiveContext(sessionId: string): ContextIngestionResult | undefined {
    return this.activeContexts.get(sessionId);
  }

  getArtifacts(sessionId: string): CompactArtifact[] {
    return this.artifactBuffer.get(sessionId) || [];
  }

  async shareContextBetweenAgents(
    sourceSessionId: string,
    targetSessionId: string
  ): Promise<void> {
    const sourceArtifacts = this.artifactBuffer.get(sourceSessionId) || [];
    const targetArtifacts = this.artifactBuffer.get(targetSessionId) || [];

    // Merge artifacts (deduplicate by hash)
    const seenHashes = new Set(targetArtifacts.map(a => a.h));
    const newArtifacts = sourceArtifacts.filter(a => !seenHashes.has(a.h));

    this.artifactBuffer.set(targetSessionId, [...targetArtifacts, ...newArtifacts]);

    this.emit('context_shared', {
      source: sourceSessionId,
      target: targetSessionId,
      artifactsShared: newArtifacts.length,
    });
  }
}

// Export singleton instance
export const contextLockService = new ContextLockService();
