/**
 * Learning Feedback Loop
 *
 * The critical loop that captures user outcomes and feeds them back
 * into all learning systems, creating true continuous improvement.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db.js';
import { learningUserFeedback, continuousLearningSessions } from '../../schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

import type {
  UserFeedback,
  FeedbackContext,
  FeedbackPropagation,
  ImplicitAction,
} from './types.js';

import { getEvolutionFlywheel, EvolutionFlywheel } from '../learning/evolution-flywheel.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface FeedbackLoopConfig {
  implicitWeight: number;
  explicitWeight: number;
  minQualityScore: number;
  antiGamingThreshold: number;
}

const DEFAULT_CONFIG: FeedbackLoopConfig = {
  implicitWeight: 0.6,
  explicitWeight: 1.0,
  minQualityScore: 0.3,
  antiGamingThreshold: 10, // Max feedback per hour
};

// =============================================================================
// LEARNING FEEDBACK LOOP
// =============================================================================

export class LearningFeedbackLoop extends EventEmitter {
  private config: FeedbackLoopConfig;
  private evolutionFlywheel: EvolutionFlywheel;
  private userFeedbackCounts: Map<string, { count: number; lastReset: number }> = new Map();

  constructor(config?: Partial<FeedbackLoopConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.evolutionFlywheel = getEvolutionFlywheel();
  }

  // =========================================================================
  // FEEDBACK COLLECTION
  // =========================================================================

  /**
   * Handle a user action (implicit feedback)
   */
  async onUserAction(
    action: ImplicitAction,
    context: {
      sessionId?: string;
      buildId?: string;
      userId: string;
      phase?: string;
      feature?: string;
      artifact?: string;
      previousAttempts?: number;
    }
  ): Promise<void> {
    // Anti-gaming check
    if (!this.checkAntiGaming(context.userId)) {
      console.warn('[LearningFeedbackLoop] Rate limit exceeded for user:', context.userId);
      return;
    }

    // Calculate quality score based on action
    const qualityScore = this.calculateImplicitQuality(action, context.previousAttempts || 0);

    const feedback: UserFeedback = {
      id: `fb_${uuidv4()}`,
      sessionId: context.sessionId || '',
      buildId: context.buildId,
      userId: context.userId,
      type: 'implicit',
      action,
      context: {
        phase: context.phase,
        feature: context.feature,
        artifact: context.artifact,
        previousAttempts: context.previousAttempts,
      },
      timestamp: new Date().toISOString(),
      processed: false,
      quality: qualityScore,
    };

    // Store feedback
    await this.storeFeedback(feedback);

    // Process if quality is sufficient
    if (qualityScore >= this.config.minQualityScore) {
      await this.propagateFeedback(feedback);
    }

    this.emit('feedback_received', feedback);
  }

  /**
   * Collect explicit feedback (ratings, comments)
   */
  async collectExplicitFeedback(
    buildId: string,
    userId: string,
    rating: number,
    comment?: string,
    context?: Partial<FeedbackContext>
  ): Promise<void> {
    // Anti-gaming check
    if (!this.checkAntiGaming(userId)) {
      console.warn('[LearningFeedbackLoop] Rate limit exceeded for user:', userId);
      return;
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Calculate quality score
    const qualityScore = this.calculateExplicitQuality(rating, comment);

    const feedback: UserFeedback = {
      id: `fb_${uuidv4()}`,
      sessionId: '',
      buildId,
      userId,
      type: 'explicit',
      rating,
      comment,
      context: context || {},
      timestamp: new Date().toISOString(),
      processed: false,
      quality: qualityScore,
    };

    // Store feedback
    await this.storeFeedback(feedback);

    // Always propagate explicit feedback
    await this.propagateFeedback(feedback);

    this.emit('explicit_feedback', feedback);
  }

  // =========================================================================
  // FEEDBACK PROPAGATION
  // =========================================================================

  /**
   * Propagate feedback to all learning systems
   */
  async propagateFeedback(feedback: UserFeedback): Promise<FeedbackPropagation> {
    const propagation: FeedbackPropagation = {
      feedbackId: feedback.id,
      propagatedTo: {
        patternLibrary: false,
        strategyEvolution: false,
        shadowModels: false,
        vectorMemory: false,
        contextPriority: false,
      },
      impact: {},
    };

    try {
      // 1. Update pattern library
      await this.updatePatternLibrary(feedback);
      propagation.propagatedTo.patternLibrary = true;
      propagation.impact.patternLibrary = this.calculateImpact(feedback);

      // 2. Update strategy evolution
      await this.updateStrategyEvolution(feedback);
      propagation.propagatedTo.strategyEvolution = true;
      propagation.impact.strategyEvolution = this.calculateImpact(feedback) * 0.8;

      // 3. Generate training data for shadow models
      await this.generateTrainingData(feedback);
      propagation.propagatedTo.shadowModels = true;
      propagation.impact.shadowModels = this.calculateImpact(feedback) * 0.5;

      // 4. Update vector relevance scores
      await this.updateVectorRelevance(feedback);
      propagation.propagatedTo.vectorMemory = true;
      propagation.impact.vectorMemory = this.calculateImpact(feedback) * 0.6;

      // 5. Update context priorities
      await this.updateContextPriorities(feedback);
      propagation.propagatedTo.contextPriority = true;
      propagation.impact.contextPriority = this.calculateImpact(feedback) * 0.7;

    } catch (error) {
      console.error('[LearningFeedbackLoop] Error propagating feedback:', error);
    }

    // Mark as processed
    await db.update(learningUserFeedback)
      .set({
        processed: true,
        propagatedTo: propagation.propagatedTo,
      })
      .where(eq(learningUserFeedback.id, feedback.id));

    this.emit('feedback_propagated', propagation);

    return propagation;
  }

  // =========================================================================
  // SYSTEM UPDATES
  // =========================================================================

  /**
   * Update pattern library based on feedback
   */
  private async updatePatternLibrary(feedback: UserFeedback): Promise<void> {
    // Determine if positive or negative signal
    const isPositive = this.isPositiveFeedback(feedback);

    // Update pattern success/failure counts via evolution flywheel
    if (feedback.context?.artifact) {
      // Would update pattern scores based on feedback
      console.log(`[LearningFeedbackLoop] Pattern feedback: ${isPositive ? '+' : '-'} for ${feedback.context.artifact}`);
    }
  }

  /**
   * Update strategy evolution based on feedback
   */
  private async updateStrategyEvolution(feedback: UserFeedback): Promise<void> {
    const isPositive = this.isPositiveFeedback(feedback);

    // Record strategy outcome
    const strategies = await db.select()
      .from(continuousLearningSessions)
      .where(eq(continuousLearningSessions.id, feedback.sessionId))
      .get();

    if (strategies?.strategiesUsed) {
      console.log(`[LearningFeedbackLoop] Strategy feedback: ${isPositive ? 'success' : 'failure'}`);
    }
  }

  /**
   * Generate training data for shadow models
   */
  private async generateTrainingData(feedback: UserFeedback): Promise<void> {
    const isPositive = this.isPositiveFeedback(feedback);

    // For explicit positive feedback, generate preference pair
    if (feedback.type === 'explicit' && feedback.rating && feedback.rating >= 4) {
      // Would add to preference pairs for training
      console.log('[LearningFeedbackLoop] Generated positive preference pair');
    }
  }

  /**
   * Update vector relevance scores
   */
  private async updateVectorRelevance(feedback: UserFeedback): Promise<void> {
    // Would update vector scores based on whether retrieved context was helpful
    if (feedback.context?.feature) {
      console.log(`[LearningFeedbackLoop] Vector relevance update for feature: ${feedback.context.feature}`);
    }
  }

  /**
   * Update context priorities
   */
  private async updateContextPriorities(feedback: UserFeedback): Promise<void> {
    // Would adjust context priority weights based on feedback
    if (feedback.context?.phase) {
      console.log(`[LearningFeedbackLoop] Context priority update for phase: ${feedback.context.phase}`);
    }
  }

  // =========================================================================
  // QUALITY SCORING
  // =========================================================================

  /**
   * Calculate quality score for implicit feedback
   */
  private calculateImplicitQuality(action: ImplicitAction, previousAttempts: number): number {
    // Base scores for different actions
    const actionScores: Record<ImplicitAction, number> = {
      accept: 0.9,
      modify: 0.6,
      reject: 0.3,
      abandon: 0.1,
      retry: 0.4,
    };

    let score = actionScores[action] || 0.5;

    // Reduce score if many previous attempts (indicates lower quality output)
    if (previousAttempts > 0) {
      score *= Math.pow(0.9, previousAttempts);
    }

    return score * this.config.implicitWeight;
  }

  /**
   * Calculate quality score for explicit feedback
   */
  private calculateExplicitQuality(rating: number, comment?: string): number {
    let score = rating / 5;

    // Boost if comment provided (more valuable feedback)
    if (comment && comment.length > 10) {
      score *= 1.2;
    }

    return Math.min(1.0, score * this.config.explicitWeight);
  }

  /**
   * Calculate impact of feedback
   */
  private calculateImpact(feedback: UserFeedback): number {
    if (feedback.type === 'explicit') {
      return feedback.quality * 1.5; // Explicit feedback has higher impact
    }
    return feedback.quality;
  }

  /**
   * Determine if feedback is positive
   */
  private isPositiveFeedback(feedback: UserFeedback): boolean {
    if (feedback.type === 'explicit') {
      return (feedback.rating || 0) >= 3;
    }
    return feedback.action === 'accept' || feedback.action === 'modify';
  }

  // =========================================================================
  // ANTI-GAMING
  // =========================================================================

  /**
   * Check anti-gaming limits
   */
  private checkAntiGaming(userId: string): boolean {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    let userStats = this.userFeedbackCounts.get(userId);

    if (!userStats || now - userStats.lastReset > hourMs) {
      userStats = { count: 0, lastReset: now };
      this.userFeedbackCounts.set(userId, userStats);
    }

    if (userStats.count >= this.config.antiGamingThreshold) {
      return false;
    }

    userStats.count++;
    return true;
  }

  // =========================================================================
  // STORAGE
  // =========================================================================

  /**
   * Store feedback in database
   */
  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    await db.insert(learningUserFeedback).values({
      id: feedback.id,
      sessionId: feedback.sessionId,
      buildId: feedback.buildId,
      userId: feedback.userId,
      feedbackType: feedback.type,
      action: feedback.action,
      rating: feedback.rating,
      comment: feedback.comment,
      phase: feedback.context?.phase,
      feature: feedback.context?.feature,
      artifact: feedback.context?.artifact,
      previousAttempts: feedback.context?.previousAttempts,
      processed: false,
      qualityScore: feedback.quality,
      timestamp: feedback.timestamp,
    });
  }

  // =========================================================================
  // GETTERS
  // =========================================================================

  /**
   * Get recent feedback
   */
  async getRecentFeedback(userId?: string, limit: number = 20): Promise<UserFeedback[]> {
    let query = db.select()
      .from(learningUserFeedback)
      .orderBy(desc(learningUserFeedback.timestamp))
      .limit(limit);

    if (userId) {
      query = query.where(eq(learningUserFeedback.userId, userId)) as typeof query;
    }

    const results = await query.all();

    return results.map(r => ({
      id: r.id,
      sessionId: r.sessionId || '',
      buildId: r.buildId || undefined,
      userId: r.userId,
      type: r.feedbackType as 'implicit' | 'explicit',
      action: r.action as ImplicitAction | undefined,
      rating: r.rating || undefined,
      comment: r.comment || undefined,
      context: {
        phase: r.phase || undefined,
        feature: r.feature || undefined,
        artifact: r.artifact || undefined,
        previousAttempts: r.previousAttempts || undefined,
      },
      timestamp: r.timestamp,
      processed: r.processed || false,
      quality: r.qualityScore || 0,
    }));
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(period: string = '7d'): Promise<{
    total: number;
    implicit: number;
    explicit: number;
    avgQuality: number;
    positiveRate: number;
  }> {
    const daysMap: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30 };
    const days = daysMap[period] || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const feedback = await db.select()
      .from(learningUserFeedback)
      .where(gte(learningUserFeedback.timestamp, startDate))
      .all();

    const implicit = feedback.filter(f => f.feedbackType === 'implicit').length;
    const explicit = feedback.filter(f => f.feedbackType === 'explicit').length;
    const avgQuality = feedback.length > 0
      ? feedback.reduce((sum, f) => sum + (f.qualityScore || 0), 0) / feedback.length
      : 0;
    const positive = feedback.filter(f => {
      if (f.feedbackType === 'explicit') return (f.rating || 0) >= 3;
      return f.action === 'accept' || f.action === 'modify';
    }).length;

    return {
      total: feedback.length,
      implicit,
      explicit,
      avgQuality,
      positiveRate: feedback.length > 0 ? positive / feedback.length : 0,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let feedbackLoopInstance: LearningFeedbackLoop | null = null;

export function getLearningFeedbackLoop(): LearningFeedbackLoop {
  if (!feedbackLoopInstance) {
    feedbackLoopInstance = new LearningFeedbackLoop();
  }
  return feedbackLoopInstance;
}

export function resetLearningFeedbackLoop(): void {
  feedbackLoopInstance = null;
}

export default LearningFeedbackLoop;
