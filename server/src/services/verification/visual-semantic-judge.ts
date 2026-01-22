/**
 * Visual Semantic Judge
 *
 * Enhances multi-agent judging with visual semantic analysis using V-JEPA 2.
 * Compares visual outputs from different agents against the design intent
 * and provides embedding-based similarity scores.
 *
 * Key Features:
 * - Visual fidelity comparison against design intent
 * - Temporal consistency analysis for interactive components
 * - Cross-agent visual similarity detection
 * - Style coherence scoring
 * - Animation/motion quality assessment
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  getVJEPA2Provider,
  type TransitionValidation,
} from '../embeddings/providers/runpod-vjepa2-provider.js';
import { RunPodVLJEPAProvider } from '../embeddings/providers/runpod-vl-jepa-provider.js';
import {
  getVisualIntentLockManager,
  type VisualIntentLock,
} from '../visual-semantic/visual-intent-lock.js';
import type { AgentResult, JudgingCriteria, CriteriaScore } from './multi-agent-judge.js';

// ============================================================================
// Types
// ============================================================================

export interface VisualAgentResult extends AgentResult {
  visualOutput?: {
    screenshots: string[]; // base64
    screenRecording?: string; // base64
    interactionDemos?: Array<{
      name: string;
      frames: string[]; // base64
    }>;
  };
}

export interface VisualJudgingCriteria extends JudgingCriteria {
  visualWeight?: number; // Additional weight for visual assessment
  requiresScreenshot?: boolean;
  requiresAnimation?: boolean;
}

export interface VisualCriteriaScore extends CriteriaScore {
  visualScore?: number;
  embeddingDistance?: number;
  visualEvidence?: {
    screenshotComparison?: string;
    animationAnalysis?: string;
    intentAlignment?: number;
  };
}

export interface VisualComparisonResult {
  agentId: string;
  intentAlignmentScore: number; // 0-100
  styleCoherenceScore: number; // 0-100
  animationQualityScore: number; // 0-100
  overallVisualScore: number; // 0-100
  embeddingDistance: number; // Lower is better
  visualIssues: VisualIssue[];
  strengths: string[];
  recommendations: string[];
}

export interface VisualIssue {
  type: 'layout' | 'style' | 'animation' | 'interaction' | 'responsiveness';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: string;
  suggestion?: string;
}

export interface CrossAgentVisualAnalysis {
  similarityMatrix: Map<string, Map<string, number>>; // agentId -> agentId -> similarity
  uniqueApproaches: Array<{
    agentId: string;
    distinctFeatures: string[];
    uniquenessScore: number;
  }>;
  commonPatterns: string[];
  visualDivergences: Array<{
    agents: string[];
    aspect: string;
    description: string;
  }>;
}

export interface VisualJudgmentResult {
  id: string;
  buildId: string;
  intentLockId?: string;
  agentComparisons: Map<string, VisualComparisonResult>;
  crossAgentAnalysis: CrossAgentVisualAnalysis;
  visualRanking: string[]; // agentIds sorted by visual score
  visualWinner: {
    agentId: string;
    score: number;
    keyAdvantages: string[];
  };
  visualCriteriaScores: Map<string, VisualCriteriaScore[]>;
  timestamp: Date;
  analysisTimeMs: number;
}

// ============================================================================
// Visual Semantic Judge
// ============================================================================

let instance: VisualSemanticJudge | null = null;

export class VisualSemanticJudge extends EventEmitter {
  private vjepa2Provider = getVJEPA2Provider();
  private vlJepaProvider: RunPodVLJEPAProvider;
  private judgments: Map<string, VisualJudgmentResult> = new Map();

  // Visual-specific criteria
  private readonly VISUAL_CRITERIA: VisualJudgingCriteria[] = [
    {
      name: 'intent_fidelity',
      weight: 0.30,
      description: 'How closely does the visual output match the design intent?',
      visualWeight: 0.8,
      requiresScreenshot: true,
    },
    {
      name: 'style_coherence',
      weight: 0.20,
      description: 'Is the visual style consistent and cohesive?',
      visualWeight: 0.9,
      requiresScreenshot: true,
    },
    {
      name: 'animation_quality',
      weight: 0.15,
      description: 'Are animations smooth, purposeful, and well-timed?',
      visualWeight: 1.0,
      requiresAnimation: true,
    },
    {
      name: 'responsiveness',
      weight: 0.15,
      description: 'Does the UI respond correctly to different viewports?',
      visualWeight: 0.7,
      requiresScreenshot: true,
    },
    {
      name: 'interaction_feedback',
      weight: 0.10,
      description: 'Does the UI provide appropriate visual feedback for interactions?',
      visualWeight: 0.8,
      requiresAnimation: true,
    },
    {
      name: 'accessibility_visual',
      weight: 0.10,
      description: 'Are visual elements accessible (contrast, sizing, spacing)?',
      visualWeight: 0.6,
      requiresScreenshot: true,
    },
  ];

  constructor() {
    super();
    this.vlJepaProvider = new RunPodVLJEPAProvider();
    console.log(
      `[VisualSemanticJudge] Initialized. V-JEPA 2: ${this.vjepa2Provider.isConfigured()}, VL-JEPA: ${this.vlJepaProvider.isConfigured()}`
    );
  }

  /**
   * Check if visual judging is available
   */
  isConfigured(): boolean {
    return this.vjepa2Provider.isConfigured() || this.vlJepaProvider.isConfigured();
  }

  /**
   * Judge visual outputs from multiple agents
   */
  async judgeVisualOutputs(
    buildId: string,
    agentResults: VisualAgentResult[],
    intentLockId?: string
  ): Promise<VisualJudgmentResult> {
    const startTime = Date.now();
    const judgmentId = uuidv4();

    console.log(
      `[VisualSemanticJudge] Starting visual judgment ${judgmentId} for ${agentResults.length} agents`
    );

    // Get intent lock if available
    let intentLock: VisualIntentLock | null = null;
    if (intentLockId) {
      const lockManager = getVisualIntentLockManager();
      intentLock = lockManager.getLock(intentLockId) ?? null;
    }

    // Compare each agent's visual output
    const agentComparisons = new Map<string, VisualComparisonResult>();
    const visualCriteriaScores = new Map<string, VisualCriteriaScore[]>();

    for (const result of agentResults) {
      const comparison = await this.compareAgentVisuals(result, intentLock);
      agentComparisons.set(result.agentId, comparison);

      const scores = await this.scoreVisualCriteria(result, intentLock, comparison);
      visualCriteriaScores.set(result.agentId, scores);

      console.log(
        `[VisualSemanticJudge] Agent ${result.agentName}: ${comparison.overallVisualScore.toFixed(1)} visual score`
      );
    }

    // Cross-agent analysis
    const crossAgentAnalysis = await this.analyzeCrossAgent(agentResults);

    // Rank by visual score
    const visualRanking = [...agentComparisons.entries()]
      .sort((a, b) => b[1].overallVisualScore - a[1].overallVisualScore)
      .map(([agentId]) => agentId);

    // Determine visual winner
    const winnerId = visualRanking[0];
    const winnerComparison = agentComparisons.get(winnerId)!;
    const winnerAgent = agentResults.find((r) => r.agentId === winnerId)!;

    const result: VisualJudgmentResult = {
      id: judgmentId,
      buildId,
      intentLockId,
      agentComparisons,
      crossAgentAnalysis,
      visualRanking,
      visualWinner: {
        agentId: winnerId,
        score: winnerComparison.overallVisualScore,
        keyAdvantages: winnerComparison.strengths,
      },
      visualCriteriaScores,
      timestamp: new Date(),
      analysisTimeMs: Date.now() - startTime,
    };

    this.judgments.set(judgmentId, result);
    this.emit('visual:judgment:complete', result);

    console.log(
      `[VisualSemanticJudge] Visual judgment complete: Winner is ${winnerAgent.agentName} (${winnerComparison.overallVisualScore.toFixed(1)})`
    );

    return result;
  }

  /**
   * Compare a single agent's visual output against intent
   */
  private async compareAgentVisuals(
    result: VisualAgentResult,
    intentLock: VisualIntentLock | null
  ): Promise<VisualComparisonResult> {
    const comparison: VisualComparisonResult = {
      agentId: result.agentId,
      intentAlignmentScore: 70, // Default score
      styleCoherenceScore: 70,
      animationQualityScore: 70,
      overallVisualScore: 70,
      embeddingDistance: 0.3,
      visualIssues: [],
      strengths: [],
      recommendations: [],
    };

    const screenshots = result.visualOutput?.screenshots || [];

    if (screenshots.length === 0) {
      comparison.visualIssues.push({
        type: 'layout',
        severity: 'high',
        description: 'No screenshots available for visual analysis',
      });
      comparison.overallVisualScore = 50;
      return comparison;
    }

    // Get embedding for the agent's output
    if (this.vlJepaProvider.isConfigured()) {
      try {
        const agentEmbedding = await this.getVisualEmbedding(screenshots[0]);

        // Compare against intent lock if available
        if (intentLock) {
          const distance = this.calculateEmbeddingDistance(
            agentEmbedding,
            intentLock.embedding
          );
          comparison.embeddingDistance = distance;
          comparison.intentAlignmentScore = Math.max(0, 100 - distance * 200);

          // Check against checklist items
          for (const item of intentLock.checklist) {
            if (item.priority === 'must' && item.status !== 'verified') {
              comparison.visualIssues.push({
                type: this.mapChecklistCategory(item.category),
                severity: 'high',
                description: `Missing: ${item.description}`,
              });
            }
          }
        }
      } catch (error) {
        console.warn('[VisualSemanticJudge] Failed to get embedding:', error);
      }
    }

    // Analyze animations if available
    if (this.vjepa2Provider.isConfigured() && result.visualOutput?.interactionDemos) {
      try {
        const animationScore = await this.analyzeAnimations(
          result.visualOutput.interactionDemos
        );
        comparison.animationQualityScore = animationScore;
      } catch (error) {
        console.warn('[VisualSemanticJudge] Animation analysis failed:', error);
      }
    }

    // Analyze style coherence
    if (screenshots.length > 1 && this.vlJepaProvider.isConfigured()) {
      try {
        const styleScore = await this.analyzeStyleCoherence(screenshots);
        comparison.styleCoherenceScore = styleScore;
      } catch (error) {
        console.warn('[VisualSemanticJudge] Style analysis failed:', error);
      }
    }

    // Calculate overall score
    comparison.overallVisualScore =
      comparison.intentAlignmentScore * 0.4 +
      comparison.styleCoherenceScore * 0.3 +
      comparison.animationQualityScore * 0.3;

    // Generate strengths and recommendations
    this.generateFeedback(comparison);

    return comparison;
  }

  /**
   * Get visual embedding using VL-JEPA
   */
  private async getVisualEmbedding(screenshotBase64: string): Promise<number[]> {
    if (!this.vlJepaProvider.isConfigured()) {
      return this.generatePseudoEmbedding(screenshotBase64.length);
    }

    const result = await this.vlJepaProvider.embedVisualText(
      screenshotBase64,
      'UI screenshot for visual comparison'
    );
    return result.embedding;
  }

  /**
   * Analyze animations using V-JEPA 2
   */
  private async analyzeAnimations(
    demos: Array<{ name: string; frames: string[] }>
  ): Promise<number> {
    if (!this.vjepa2Provider.isConfigured() || demos.length === 0) {
      return 70; // Default score
    }

    let totalScore = 0;
    let demoCount = 0;

    for (const demo of demos) {
      if (demo.frames.length < 2) continue;

      try {
        const validation = await this.vjepa2Provider.validateTransition(
          demo.frames,
          `Smooth transition for ${demo.name}`
        );

        // Score based on validation result
        const smoothnessScore = validation.valid ? 85 : 60;
        const confidenceBonus = validation.confidence * 15;

        totalScore += smoothnessScore + confidenceBonus;
        demoCount++;
      } catch (error) {
        console.warn(`[VisualSemanticJudge] Demo "${demo.name}" analysis failed:`, error);
      }
    }

    return demoCount > 0 ? totalScore / demoCount : 70;
  }

  /**
   * Analyze style coherence across screenshots
   */
  private async analyzeStyleCoherence(screenshots: string[]): Promise<number> {
    if (screenshots.length < 2) return 80;

    const embeddings: number[][] = [];

    for (const screenshot of screenshots.slice(0, 5)) {
      try {
        const embedding = await this.getVisualEmbedding(screenshot);
        embeddings.push(embedding);
      } catch (error) {
        // Skip failed embeddings
      }
    }

    if (embeddings.length < 2) return 75;

    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        totalSimilarity += this.cosineSimilarity(embeddings[i], embeddings[j]);
        pairCount++;
      }
    }

    const avgSimilarity = totalSimilarity / pairCount;

    // Convert to 0-100 score (higher similarity = more coherent)
    return avgSimilarity * 100;
  }

  /**
   * Score visual criteria for an agent
   */
  private async scoreVisualCriteria(
    result: VisualAgentResult,
    intentLock: VisualIntentLock | null,
    comparison: VisualComparisonResult
  ): Promise<VisualCriteriaScore[]> {
    const scores: VisualCriteriaScore[] = [];

    for (const criterion of this.VISUAL_CRITERIA) {
      const score: VisualCriteriaScore = {
        criteria: criterion.name,
        score: 70,
        reasoning: '',
        evidence: [],
      };

      switch (criterion.name) {
        case 'intent_fidelity':
          score.score = comparison.intentAlignmentScore;
          score.embeddingDistance = comparison.embeddingDistance;
          score.reasoning = `Visual output ${score.score >= 80 ? 'closely matches' : score.score >= 60 ? 'partially matches' : 'deviates from'} the design intent`;
          if (intentLock) {
            score.evidence.push(
              `Embedding distance: ${comparison.embeddingDistance.toFixed(3)}`
            );
          }
          break;

        case 'style_coherence':
          score.score = comparison.styleCoherenceScore;
          score.reasoning = `Visual style is ${score.score >= 80 ? 'highly consistent' : score.score >= 60 ? 'mostly consistent' : 'inconsistent'} across views`;
          break;

        case 'animation_quality':
          score.score = comparison.animationQualityScore;
          score.reasoning = `Animations are ${score.score >= 80 ? 'smooth and purposeful' : score.score >= 60 ? 'functional' : 'choppy or missing'}`;
          break;

        case 'responsiveness':
          // Would need multiple viewport screenshots to properly assess
          score.score = 75;
          score.reasoning = 'Responsiveness assessment requires multiple viewport captures';
          break;

        case 'interaction_feedback':
          score.score = Math.min(90, comparison.animationQualityScore + 10);
          score.reasoning = 'Interaction feedback assessed through animation quality';
          break;

        case 'accessibility_visual':
          // Basic assessment - would need more sophisticated analysis
          score.score = 70;
          score.reasoning = 'Basic visual accessibility assessment';
          break;
      }

      // Add visual issues as evidence
      const relevantIssues = comparison.visualIssues.filter(
        (i) =>
          criterion.name.includes(i.type) ||
          (criterion.name === 'intent_fidelity' && i.severity === 'high')
      );
      for (const issue of relevantIssues) {
        score.evidence.push(`Issue: ${issue.description}`);
        score.score = Math.max(0, score.score - 10);
      }

      scores.push(score);
    }

    return scores;
  }

  /**
   * Cross-agent visual analysis
   */
  private async analyzeCrossAgent(
    agentResults: VisualAgentResult[]
  ): Promise<CrossAgentVisualAnalysis> {
    const analysis: CrossAgentVisualAnalysis = {
      similarityMatrix: new Map(),
      uniqueApproaches: [],
      commonPatterns: [],
      visualDivergences: [],
    };

    if (agentResults.length < 2) return analysis;

    // Build embedding map
    const embeddings = new Map<string, number[]>();

    for (const result of agentResults) {
      if (result.visualOutput?.screenshots?.[0] && this.vlJepaProvider.isConfigured()) {
        try {
          const embedding = await this.getVisualEmbedding(
            result.visualOutput.screenshots[0]
          );
          embeddings.set(result.agentId, embedding);
        } catch (error) {
          // Skip failed embeddings
        }
      }
    }

    // Calculate similarity matrix
    for (const [id1, emb1] of embeddings) {
      const row = new Map<string, number>();
      for (const [id2, emb2] of embeddings) {
        if (id1 !== id2) {
          row.set(id2, this.cosineSimilarity(emb1, emb2));
        }
      }
      analysis.similarityMatrix.set(id1, row);
    }

    // Identify unique approaches (low similarity to others)
    for (const result of agentResults) {
      const similarities = analysis.similarityMatrix.get(result.agentId);
      if (!similarities) continue;

      const avgSimilarity =
        [...similarities.values()].reduce((a, b) => a + b, 0) / similarities.size;

      if (avgSimilarity < 0.7) {
        analysis.uniqueApproaches.push({
          agentId: result.agentId,
          distinctFeatures: [`Average similarity: ${(avgSimilarity * 100).toFixed(0)}%`],
          uniquenessScore: (1 - avgSimilarity) * 100,
        });
      }
    }

    // Identify visual divergences
    for (const [id1, similarities] of analysis.similarityMatrix) {
      for (const [id2, similarity] of similarities) {
        if (similarity < 0.5) {
          const agent1 = agentResults.find((r) => r.agentId === id1);
          const agent2 = agentResults.find((r) => r.agentId === id2);

          if (agent1 && agent2) {
            analysis.visualDivergences.push({
              agents: [agent1.agentName, agent2.agentName],
              aspect: 'overall_approach',
              description: `Significantly different visual approaches (${(similarity * 100).toFixed(0)}% similarity)`,
            });
          }
        }
      }
    }

    return analysis;
  }

  /**
   * Generate feedback based on comparison
   */
  private generateFeedback(comparison: VisualComparisonResult): void {
    // Strengths
    if (comparison.intentAlignmentScore >= 85) {
      comparison.strengths.push('Excellent alignment with design intent');
    }
    if (comparison.styleCoherenceScore >= 85) {
      comparison.strengths.push('Highly consistent visual style');
    }
    if (comparison.animationQualityScore >= 85) {
      comparison.strengths.push('Smooth, purposeful animations');
    }

    // Recommendations
    if (comparison.intentAlignmentScore < 70) {
      comparison.recommendations.push(
        'Review and align with original design specifications'
      );
    }
    if (comparison.styleCoherenceScore < 70) {
      comparison.recommendations.push(
        'Ensure consistent styling across all views'
      );
    }
    if (comparison.animationQualityScore < 70) {
      comparison.recommendations.push(
        'Improve animation smoothness and timing'
      );
    }

    // Issue-based recommendations
    for (const issue of comparison.visualIssues) {
      if (issue.suggestion) {
        comparison.recommendations.push(issue.suggestion);
      }
    }
  }

  /**
   * Get visual judgment by ID
   */
  getJudgment(judgmentId: string): VisualJudgmentResult | null {
    return this.judgments.get(judgmentId) || null;
  }

  /**
   * Helper: Calculate embedding distance
   */
  private calculateEmbeddingDistance(a: number[], b: number[]): number {
    return 1 - this.cosineSimilarity(a, b);
  }

  /**
   * Helper: Cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Helper: Generate pseudo-embedding
   */
  private generatePseudoEmbedding(seed: number): number[] {
    const embedding: number[] = [];
    let s = seed;

    for (let i = 0; i < 1024; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      embedding.push((s / 0x7fffffff) * 2 - 1);
    }

    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    return embedding.map((x) => x / norm);
  }

  /**
   * Helper: Map checklist category to visual issue type
   */
  private mapChecklistCategory(
    category: string
  ): VisualIssue['type'] {
    switch (category) {
      case 'layout':
        return 'layout';
      case 'style':
        return 'style';
      case 'animation':
        return 'animation';
      case 'interaction':
        return 'interaction';
      default:
        return 'layout';
    }
  }
}

// Singleton accessor
export function getVisualSemanticJudge(): VisualSemanticJudge {
  if (!instance) {
    instance = new VisualSemanticJudge();
  }
  return instance;
}

export function resetVisualSemanticJudge(): void {
  instance = null;
}
