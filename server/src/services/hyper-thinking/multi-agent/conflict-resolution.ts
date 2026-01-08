/**
 * Conflict Resolution
 *
 * Detects and resolves conflicts between agent outputs.
 * Uses multiple strategies: voting, synthesis, arbitration.
 */

import type {
  AgentResult,
  Conflict,
  ConflictResolution,
  ConflictResolutionStrategy,
  SwarmConfig,
} from './types.js';
import type { TokenUsage } from '../types.js';
import { getProvider } from '../providers/index.js';
import { HYPER_THINKING_MODELS, DEFAULT_MODEL_BY_TIER } from '../model-router.js';

// Alias for convenient access
const MODEL_TIER_MAP = {
  platinum: 'maximum',
  gold: 'deep',
  silver: 'standard',
  bronze: 'fast',
} as const;

// ============================================================================
// Types
// ============================================================================

export interface ConflictDetectionResult {
  conflicts: Conflict[];
  severity: 'none' | 'minor' | 'moderate' | 'major';
  summary: string;
}

export type ResolutionStrategy = 'voting' | 'synthesis' | 'arbitration' | 'hybrid';

// ============================================================================
// Conflict Detector
// ============================================================================

export class ConflictDetector {
  private config: SwarmConfig;

  constructor(config: SwarmConfig) {
    this.config = config;
  }

  /**
   * Detect conflicts between agent results
   */
  async detectConflicts(results: AgentResult[]): Promise<ConflictDetectionResult> {
    if (results.length < 2) {
      return { conflicts: [], severity: 'none', summary: 'Single agent, no conflicts possible' };
    }

    const conflicts: Conflict[] = [];

    // Compare each pair of agents
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const pairConflicts = await this.detectPairConflicts(results[i], results[j]);
        conflicts.push(...pairConflicts);
      }
    }

    // Determine overall severity
    const severity = this.calculateSeverity(conflicts);

    return {
      conflicts,
      severity,
      summary: this.summarizeConflicts(conflicts, severity),
    };
  }

  /**
   * Detect conflicts between two agents
   */
  private async detectPairConflicts(
    resultA: AgentResult,
    resultB: AgentResult
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // 1. Check for contradictory insights
    for (const insightA of resultA.insights) {
      for (const insightB of resultB.insights) {
        if (this.areContradictory(insightA, insightB)) {
          conflicts.push({
            id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'contradiction',
            agents: [resultA.agentId, resultB.agentId],
            description: `Contradictory insights: "${insightA.slice(0, 50)}..." vs "${insightB.slice(0, 50)}..."`,
            severity: this.assessContradictionSeverity(insightA, insightB),
            points: [
              { agentId: resultA.agentId, position: insightA, support: resultA.confidence },
              { agentId: resultB.agentId, position: insightB, support: resultB.confidence },
            ],
          });
        }
      }
    }

    // 2. Check for significant confidence disparity
    const confidenceDiff = Math.abs(resultA.confidence - resultB.confidence);
    if (confidenceDiff > 0.3) {
      conflicts.push({
        id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'confidence_disparity',
        agents: [resultA.agentId, resultB.agentId],
        description: `Significant confidence difference: ${resultA.role} (${resultA.confidence.toFixed(2)}) vs ${resultB.role} (${resultB.confidence.toFixed(2)})`,
        severity: confidenceDiff > 0.5 ? 'high' : 'medium',
        points: [
          { agentId: resultA.agentId, position: `Confidence: ${resultA.confidence}`, support: resultA.confidence },
          { agentId: resultB.agentId, position: `Confidence: ${resultB.confidence}`, support: resultB.confidence },
        ],
      });
    }

    // 3. Check for approach conflicts
    const approachConflict = this.detectApproachConflict(resultA, resultB);
    if (approachConflict) {
      conflicts.push(approachConflict);
    }

    // 4. Check for missing coverage
    const coverageConflict = this.detectCoverageConflict(resultA, resultB);
    if (coverageConflict) {
      conflicts.push(coverageConflict);
    }

    return conflicts;
  }

  /**
   * Check if two statements are contradictory
   */
  private areContradictory(stmtA: string, stmtB: string): boolean {
    const contradictionPatterns = [
      { positive: /\bshould\b/i, negative: /\bshould not\b/i },
      { positive: /\bmust\b/i, negative: /\bmust not\b/i },
      { positive: /\bis\b/i, negative: /\bis not\b|\bisn't\b/i },
      { positive: /\bcan\b/i, negative: /\bcannot\b|\bcan't\b/i },
      { positive: /\bwill\b/i, negative: /\bwill not\b|\bwon't\b/i },
      { positive: /\brecommend\b/i, negative: /\bavoid\b/i },
      { positive: /\bbetter\b/i, negative: /\bworse\b/i },
      { positive: /\befficient\b/i, negative: /\binefficient\b/i },
    ];

    for (const pattern of contradictionPatterns) {
      if (
        (pattern.positive.test(stmtA) && pattern.negative.test(stmtB)) ||
        (pattern.negative.test(stmtA) && pattern.positive.test(stmtB))
      ) {
        // Check if they're talking about similar topics
        const wordsA = new Set(stmtA.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        const wordsB = new Set(stmtB.toLowerCase().split(/\W+/).filter(w => w.length > 3));

        const commonWords = [...wordsA].filter(w => wordsB.has(w));

        if (commonWords.length >= 2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Assess severity of contradiction
   */
  private assessContradictionSeverity(stmtA: string, stmtB: string): 'low' | 'medium' | 'high' {
    const criticalKeywords = ['security', 'critical', 'must', 'never', 'always', 'essential', 'required'];

    const hasA = criticalKeywords.some(k => stmtA.toLowerCase().includes(k));
    const hasB = criticalKeywords.some(k => stmtB.toLowerCase().includes(k));

    if (hasA && hasB) return 'high';
    if (hasA || hasB) return 'medium';
    return 'low';
  }

  /**
   * Detect approach conflicts
   */
  private detectApproachConflict(resultA: AgentResult, resultB: AgentResult): Conflict | null {
    // Check if suggestions are fundamentally different
    if (resultA.suggestions.length > 0 && resultB.suggestions.length > 0) {
      const approachKeywords = {
        incremental: ['incremental', 'step by step', 'gradual', 'iterative'],
        radical: ['complete', 'full', 'rewrite', 'replace', 'overhaul'],
        conservative: ['minimal', 'careful', 'safe', 'preserve'],
        aggressive: ['aggressive', 'fast', 'quick', 'immediate'],
      };

      const getApproach = (suggestions: string[]): string | null => {
        const combined = suggestions.join(' ').toLowerCase();
        for (const [approach, keywords] of Object.entries(approachKeywords)) {
          if (keywords.some(k => combined.includes(k))) return approach;
        }
        return null;
      };

      const approachA = getApproach(resultA.suggestions);
      const approachB = getApproach(resultB.suggestions);

      if (approachA && approachB && approachA !== approachB) {
        const conflictingPairs = [
          ['incremental', 'radical'],
          ['conservative', 'aggressive'],
        ];

        for (const pair of conflictingPairs) {
          if (pair.includes(approachA) && pair.includes(approachB)) {
            return {
              id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'approach',
              agents: [resultA.agentId, resultB.agentId],
              description: `Different approaches: ${resultA.role} suggests ${approachA}, ${resultB.role} suggests ${approachB}`,
              severity: 'medium',
              points: [
                { agentId: resultA.agentId, position: approachA, support: resultA.confidence },
                { agentId: resultB.agentId, position: approachB, support: resultB.confidence },
              ],
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Detect coverage conflicts (one agent covers what another misses)
   */
  private detectCoverageConflict(resultA: AgentResult, resultB: AgentResult): Conflict | null {
    // Check if one agent raised concerns the other didn't address
    for (const concernA of resultA.concerns) {
      const addressed = resultB.insights.some(i =>
        this.topicsOverlap(concernA, i) ||
        resultB.suggestions.some(s => this.topicsOverlap(concernA, s))
      );

      if (!addressed) {
        // Check if it's a significant concern
        const significantKeywords = ['risk', 'problem', 'issue', 'danger', 'vulnerability', 'flaw'];
        const isSignificant = significantKeywords.some(k => concernA.toLowerCase().includes(k));

        if (isSignificant) {
          return {
            id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'coverage',
            agents: [resultA.agentId, resultB.agentId],
            description: `Coverage gap: ${resultA.role} raised concern not addressed by ${resultB.role}: "${concernA.slice(0, 60)}..."`,
            severity: 'medium',
            points: [
              { agentId: resultA.agentId, position: concernA, support: resultA.confidence },
            ],
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if two statements have overlapping topics
   */
  private topicsOverlap(stmtA: string, stmtB: string): boolean {
    const extractKeywords = (s: string): Set<string> => {
      return new Set(
        s.toLowerCase()
          .split(/\W+/)
          .filter(w => w.length > 4)
      );
    };

    const keywordsA = extractKeywords(stmtA);
    const keywordsB = extractKeywords(stmtB);

    const overlap = [...keywordsA].filter(w => keywordsB.has(w)).length;

    return overlap >= 2;
  }

  /**
   * Calculate overall severity
   */
  private calculateSeverity(conflicts: Conflict[]): 'none' | 'minor' | 'moderate' | 'major' {
    if (conflicts.length === 0) return 'none';

    const highCount = conflicts.filter(c => c.severity === 'high').length;
    const mediumCount = conflicts.filter(c => c.severity === 'medium').length;

    if (highCount >= 2) return 'major';
    if (highCount >= 1 || mediumCount >= 3) return 'moderate';
    if (mediumCount >= 1 || conflicts.length >= 2) return 'minor';
    return 'minor';
  }

  /**
   * Summarize conflicts
   */
  private summarizeConflicts(conflicts: Conflict[], severity: string): string {
    if (conflicts.length === 0) {
      return 'No conflicts detected between agents';
    }

    const byType = conflicts.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeSummary = Object.entries(byType)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    return `${conflicts.length} conflicts detected (${severity} severity): ${typeSummary}`;
  }
}

// ============================================================================
// Conflict Resolver
// ============================================================================

export class ConflictResolver {
  private config: SwarmConfig;

  constructor(config: SwarmConfig) {
    this.config = config;
  }

  /**
   * Resolve conflicts using specified strategy
   */
  async resolveConflicts(
    conflicts: Conflict[],
    results: AgentResult[],
    problem: string,
    strategy: ResolutionStrategy = 'hybrid'
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(
        conflict,
        results,
        problem,
        strategy
      );
      resolutions.push(resolution);
    }

    return resolutions;
  }

  /**
   * Resolve a single conflict
   */
  private async resolveConflict(
    conflict: Conflict,
    results: AgentResult[],
    problem: string,
    strategy: ResolutionStrategy
  ): Promise<ConflictResolution> {
    // Choose strategy based on conflict type and severity
    const effectiveStrategy = this.chooseStrategy(conflict, strategy);

    switch (effectiveStrategy) {
      case 'voting':
        return this.resolveByVoting(conflict, results);
      case 'synthesis':
        return this.resolveBySynthesis(conflict, results, problem);
      case 'arbitration':
        return this.resolveByArbitration(conflict, results, problem);
      default:
        return this.resolveBySynthesis(conflict, results, problem);
    }
  }

  /**
   * Choose best resolution strategy
   */
  private chooseStrategy(conflict: Conflict, preferred: ResolutionStrategy): ResolutionStrategy {
    // For hybrid, choose based on conflict characteristics
    if (preferred !== 'hybrid') return preferred;

    // High severity or contradictions need arbitration
    if (conflict.severity === 'high' || conflict.type === 'contradiction') {
      return 'arbitration';
    }

    // Approach conflicts benefit from synthesis
    if (conflict.type === 'approach') {
      return 'synthesis';
    }

    // Coverage and confidence conflicts can use voting
    if (conflict.type === 'coverage' || conflict.type === 'confidence_disparity') {
      return 'voting';
    }

    return 'synthesis';
  }

  /**
   * Resolve by voting (confidence-weighted)
   */
  private resolveByVoting(conflict: Conflict, results: AgentResult[]): ConflictResolution {
    // Weight votes by confidence
    const votes = conflict.points.map(point => {
      const result = results.find(r => r.agentId === point.agentId);
      return {
        position: point.position,
        weight: result ? result.confidence : 0.5,
      };
    });

    // Find highest weighted position
    const winner = votes.reduce((a, b) => a.weight > b.weight ? a : b);

    return {
      conflictId: conflict.id,
      strategy: 'voting',
      outcome: winner.position,
      confidence: winner.weight,
      reasoning: `Resolved by confidence-weighted voting. Winner: ${winner.position.slice(0, 50)}... with weight ${winner.weight.toFixed(2)}`,
    };
  }

  /**
   * Resolve by synthesis (combine perspectives)
   */
  private async resolveBySynthesis(
    conflict: Conflict,
    results: AgentResult[],
    problem: string
  ): Promise<ConflictResolution> {
    const positions = conflict.points.map(p => {
      const result = results.find(r => r.agentId === p.agentId);
      return `${result?.role || 'Agent'}: ${p.position}`;
    }).join('\n');

    const prompt = `You are resolving a conflict between AI reasoning agents.

PROBLEM: ${problem}

CONFLICT TYPE: ${conflict.type}
DESCRIPTION: ${conflict.description}

POSITIONS:
${positions}

Synthesize these perspectives into a unified position that:
1. Preserves valid insights from all parties
2. Addresses the core disagreement
3. Provides actionable guidance

Respond with:
SYNTHESIS: [Your unified position]
CONFIDENCE: [0.0-1.0]
REASONING: [Why this synthesis works]`;

    const model = HYPER_THINKING_MODELS[DEFAULT_MODEL_BY_TIER.maximum];
    const provider = getProvider(model.provider);

    const response = await provider.reason({
      prompt,
      model,
      thinkingBudget: 8000,
      temperature: 0.7,
    });

    const synthesisMatch = response.content.match(/SYNTHESIS:\s*([\s\S]*?)(?=CONFIDENCE:|$)/i);
    const confidenceMatch = response.content.match(/CONFIDENCE:\s*([\d.]+)/i);
    const reasoningMatch = response.content.match(/REASONING:\s*([\s\S]*?)$/i);

    return {
      conflictId: conflict.id,
      strategy: 'synthesis',
      outcome: synthesisMatch ? synthesisMatch[1].trim() : response.content,
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.75,
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'Synthesized from multiple perspectives',
    };
  }

  /**
   * Resolve by arbitration (use higher-tier model)
   */
  private async resolveByArbitration(
    conflict: Conflict,
    results: AgentResult[],
    problem: string
  ): Promise<ConflictResolution> {
    const positions = conflict.points.map(p => {
      const result = results.find(r => r.agentId === p.agentId);
      return {
        role: result?.role || 'Agent',
        position: p.position,
        confidence: result?.confidence || 0.5,
        insights: result?.insights || [],
        concerns: result?.concerns || [],
      };
    });

    const prompt = `You are a senior arbitrator resolving a disagreement between AI reasoning agents.

PROBLEM: ${problem}

CONFLICT:
Type: ${conflict.type}
Severity: ${conflict.severity}
Description: ${conflict.description}

POSITIONS:
${positions.map((p, i) => `
Agent ${i + 1} (${p.role}, confidence: ${p.confidence.toFixed(2)}):
  Position: ${p.position}
  Supporting Insights: ${p.insights.slice(0, 3).join('; ')}
  Concerns Raised: ${p.concerns.slice(0, 3).join('; ')}
`).join('\n')}

As arbitrator, you must:
1. Evaluate each position objectively
2. Consider the confidence levels
3. Identify the strongest arguments
4. Make a binding decision

Respond with:
DECISION: [Your final ruling]
WINNER: [Which position is more correct, if applicable]
CONFIDENCE: [0.0-1.0 in your decision]
REASONING: [Detailed justification]`;

    // Use highest tier model for arbitration
    const model = HYPER_THINKING_MODELS[DEFAULT_MODEL_BY_TIER.maximum];
    const provider = getProvider(model.provider);

    const response = await provider.reason({
      prompt,
      model,
      thinkingBudget: 16000,
      temperature: 0.5, // Lower for more decisive arbitration
    });

    const decisionMatch = response.content.match(/DECISION:\s*([\s\S]*?)(?=WINNER:|CONFIDENCE:|$)/i);
    const confidenceMatch = response.content.match(/CONFIDENCE:\s*([\d.]+)/i);
    const reasoningMatch = response.content.match(/REASONING:\s*([\s\S]*?)$/i);

    return {
      conflictId: conflict.id,
      strategy: 'arbitration',
      outcome: decisionMatch ? decisionMatch[1].trim() : response.content,
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.85,
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'Arbitrated by senior model',
    };
  }
}

/**
 * Create conflict detector
 */
export function createConflictDetector(config: SwarmConfig): ConflictDetector {
  return new ConflictDetector(config);
}

/**
 * Create conflict resolver
 */
export function createConflictResolver(config: SwarmConfig): ConflictResolver {
  return new ConflictResolver(config);
}

export default {
  ConflictDetector,
  ConflictResolver,
  createConflictDetector,
  createConflictResolver,
};
