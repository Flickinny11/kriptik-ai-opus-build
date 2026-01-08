/**
 * Test Session Manager
 *
 * Manages test sessions for model comparison.
 * Tracks tests, accumulates costs, and stores results.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import { db } from '../../db.js';
import { eq, and } from 'drizzle-orm';
import { testSessions, testResults, trainingJobs } from '../../schema.js';
import { ModelInferenceService, getModelInferenceService } from './model-inference.js';
import { ComparisonEngine, getComparisonEngine } from './comparison-engine.js';
import { TestBillingService, getTestBillingService } from './test-billing.js';
import type { ModelModality } from './types.js';
import type { InferenceRequest, InferenceResponse } from './model-inference.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TestSession {
  id: string;
  userId: string;
  trainingJobId: string;
  pretrainedModelId: string;
  finetunedModelId: string;
  modality: ModelModality;
  tests: TestResult[];
  totalCost: number;
  status: 'active' | 'ended';
  createdAt: string;
  endedAt?: string;
}

export interface TestResult {
  id: string;
  sessionId: string;
  input: InferenceRequest['input'];
  pretrainedOutput: InferenceResponse;
  finetunedOutput: InferenceResponse;
  comparison?: {
    qualityImprovement?: number;
    latencyDiff: number;
    costDiff: number;
  };
  timestamp: string;
}

export interface SessionSummary {
  totalTests: number;
  totalCost: number;
  averageLatencyPretrained: number;
  averageLatencyFinetuned: number;
  qualityImprovement?: number;
}

// =============================================================================
// TEST SESSION MANAGER
// =============================================================================

export class TestSessionManager {
  private inferenceService: ModelInferenceService;
  private comparisonEngine: ComparisonEngine;
  private billingService: TestBillingService;

  constructor() {
    this.inferenceService = getModelInferenceService();
    this.comparisonEngine = getComparisonEngine();
    this.billingService = getTestBillingService();
  }

  /**
   * Create a new test session
   */
  async createSession(
    userId: string,
    trainingJobId: string
  ): Promise<TestSession> {
    // Get training job to extract model info
    const job = await db.query.trainingJobs.findFirst({
      where: eq(trainingJobs.id, trainingJobId),
    });

    if (!job) {
      throw new Error(`Training job ${trainingJobId} not found`);
    }

    if (job.userId !== userId) {
      throw new Error('Access denied to training job');
    }

    const config = job.config as { 
      modality: ModelModality; 
      baseModelId: string;
      outputModelName: string;
      hubRepoName?: string;
    };

    // Create session in database
    const sessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await db.insert(testSessions).values({
      id: sessionId,
      userId,
      trainingJobId,
      pretrainedModelId: config.baseModelId,
      finetunedModelId: config.hubRepoName || config.outputModelName,
      modality: config.modality,
      totalCost: 0,
      status: 'active',
      createdAt: now,
    });

    return {
      id: sessionId,
      userId,
      trainingJobId,
      pretrainedModelId: config.baseModelId,
      finetunedModelId: config.hubRepoName || config.outputModelName,
      modality: config.modality,
      tests: [],
      totalCost: 0,
      status: 'active',
      createdAt: now,
    };
  }

  /**
   * Run a test within a session
   */
  async runTest(
    sessionId: string,
    input: InferenceRequest['input'],
    parameters?: Record<string, unknown>
  ): Promise<TestResult> {
    // Get session
    const session = await this.getSessionFromDb(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error('Session has ended');
    }

    // Check if user has enough credits
    const hasCredits = await this.billingService.checkCredits(session.userId, session.modality);
    if (!hasCredits) {
      throw new Error('Insufficient credits for testing');
    }

    // Run comparison inference
    const comparison = await this.inferenceService.runComparison(
      session.pretrainedModelId,
      session.finetunedModelId,
      session.modality,
      input,
      parameters
    );

    // Calculate total cost for this test
    const testCost = comparison.pretrained.cost + comparison.finetuned.cost;

    // Charge for the inference
    await this.billingService.chargeForInference(
      session.userId,
      session.modality,
      {
        inputTokens: comparison.pretrained.tokensUsed,
        outputTokens: comparison.finetuned.tokensUsed,
        generationCount: session.modality === 'image' ? 2 : undefined,
        durationSeconds: session.modality === 'audio' || session.modality === 'video' ? 10 : undefined,
      }
    );

    // Create test result
    const testId = `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const result: TestResult = {
      id: testId,
      sessionId,
      input,
      pretrainedOutput: comparison.pretrained,
      finetunedOutput: comparison.finetuned,
      comparison: comparison.comparison,
      timestamp,
    };

    // Save test result to database
    await db.insert(testResults).values({
      id: testId,
      sessionId,
      input: input as Record<string, unknown>,
      pretrainedOutput: comparison.pretrained as unknown as Record<string, unknown>,
      finetunedOutput: comparison.finetuned as unknown as Record<string, unknown>,
      comparison: comparison.comparison as unknown as Record<string, unknown>,
      createdAt: timestamp,
    });

    // Update session total cost
    await db.update(testSessions)
      .set({
        totalCost: session.totalCost + testCost,
      })
      .where(eq(testSessions.id, sessionId));

    return result;
  }

  /**
   * Get session with all results
   */
  async getSession(sessionId: string): Promise<TestSession | null> {
    const session = await this.getSessionFromDb(sessionId);
    if (!session) {
      return null;
    }

    // Get all test results for this session
    const results = await db.query.testResults.findMany({
      where: eq(testResults.sessionId, sessionId),
    });

    return {
      ...session,
      tests: results.map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        input: r.input as InferenceRequest['input'],
        pretrainedOutput: r.pretrainedOutput as unknown as InferenceResponse,
        finetunedOutput: r.finetunedOutput as unknown as InferenceResponse,
        comparison: r.comparison as TestResult['comparison'],
        timestamp: r.createdAt,
      })),
    };
  }

  /**
   * End a test session
   */
  async endSession(sessionId: string): Promise<SessionSummary> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update session status
    await db.update(testSessions)
      .set({
        status: 'ended',
        endedAt: new Date().toISOString(),
      })
      .where(eq(testSessions.id, sessionId));

    // Calculate summary
    const summary = this.calculateSessionSummary(session);

    return summary;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<TestSession[]> {
    const sessions = await db.query.testSessions.findMany({
      where: eq(testSessions.userId, userId),
    });

    return Promise.all(
      sessions.map(async (s) => {
        const results = await db.query.testResults.findMany({
          where: eq(testResults.sessionId, s.id),
        });

        return {
          id: s.id,
          userId: s.userId,
          trainingJobId: s.trainingJobId,
          pretrainedModelId: s.pretrainedModelId,
          finetunedModelId: s.finetunedModelId,
          modality: s.modality as ModelModality,
          tests: results.map(r => ({
            id: r.id,
            sessionId: r.sessionId,
            input: r.input as InferenceRequest['input'],
            pretrainedOutput: r.pretrainedOutput as unknown as InferenceResponse,
            finetunedOutput: r.finetunedOutput as unknown as InferenceResponse,
            comparison: r.comparison as TestResult['comparison'],
            timestamp: r.createdAt,
          })),
          totalCost: s.totalCost,
          status: s.status as 'active' | 'ended',
          createdAt: s.createdAt,
          endedAt: s.endedAt || undefined,
        };
      })
    );
  }

  /**
   * Delete a session and its results
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const session = await db.query.testSessions.findFirst({
      where: and(
        eq(testSessions.id, sessionId),
        eq(testSessions.userId, userId)
      ),
    });

    if (!session) {
      return false;
    }

    // Delete results first
    await db.delete(testResults).where(eq(testResults.sessionId, sessionId));

    // Delete session
    await db.delete(testSessions).where(eq(testSessions.id, sessionId));

    return true;
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private async getSessionFromDb(sessionId: string): Promise<Omit<TestSession, 'tests'> | null> {
    const session = await db.query.testSessions.findFirst({
      where: eq(testSessions.id, sessionId),
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      trainingJobId: session.trainingJobId,
      pretrainedModelId: session.pretrainedModelId,
      finetunedModelId: session.finetunedModelId,
      modality: session.modality as ModelModality,
      totalCost: session.totalCost,
      status: session.status as 'active' | 'ended',
      createdAt: session.createdAt,
      endedAt: session.endedAt || undefined,
    };
  }

  private calculateSessionSummary(session: TestSession): SessionSummary {
    const tests = session.tests;
    
    if (tests.length === 0) {
      return {
        totalTests: 0,
        totalCost: session.totalCost,
        averageLatencyPretrained: 0,
        averageLatencyFinetuned: 0,
      };
    }

    const totalPretrainedLatency = tests.reduce(
      (sum, t) => sum + t.pretrainedOutput.latencyMs,
      0
    );
    const totalFinetunedLatency = tests.reduce(
      (sum, t) => sum + t.finetunedOutput.latencyMs,
      0
    );

    // Calculate average quality improvement if available
    const testsWithQuality = tests.filter(t => t.comparison?.qualityImprovement !== undefined);
    const avgQualityImprovement = testsWithQuality.length > 0
      ? testsWithQuality.reduce((sum, t) => sum + (t.comparison?.qualityImprovement || 0), 0) / testsWithQuality.length
      : undefined;

    return {
      totalTests: tests.length,
      totalCost: session.totalCost,
      averageLatencyPretrained: totalPretrainedLatency / tests.length,
      averageLatencyFinetuned: totalFinetunedLatency / tests.length,
      qualityImprovement: avgQualityImprovement,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let testSessionManagerInstance: TestSessionManager | null = null;

export function getTestSessionManager(): TestSessionManager {
  if (!testSessionManagerInstance) {
    testSessionManagerInstance = new TestSessionManager();
  }
  return testSessionManagerInstance;
}

export default TestSessionManager;
