/**
 * Swarm Synthesis Engine
 *
 * Synthesizes final output from multiple agent results.
 * Handles confidence aggregation, insight merging, and coherent output generation.
 */

import type {
  AgentResult,
  ConflictResolution,
  SwarmResult,
  SwarmConfig,
  Conflict,
  ContributingAgent,
  SwarmReasoningStep,
} from './types.js';
import type { TokenUsage } from '../types.js';
import { getProvider } from '../providers/index.js';
import { HYPER_THINKING_MODELS, DEFAULT_MODEL_BY_TIER } from '../model-router.js';

// ============================================================================
// Types
// ============================================================================

export interface SynthesisInput {
  problem: string;
  results: AgentResult[];
  conflicts: Conflict[];
  resolutions: ConflictResolution[];
  sharedContext?: string;
}

export interface SynthesizedOutput {
  answer: string;
  confidence: number;
  reasoning: SwarmReasoningStep[];
  insights: string[];
  recommendations: string[];
  caveats: string[];
}

// ============================================================================
// Swarm Synthesis Engine
// ============================================================================

export class SwarmSynthesisEngine {
  private config: SwarmConfig;

  constructor(config: SwarmConfig) {
    this.config = config;
  }

  /**
   * Synthesize final output from all agent results
   */
  async synthesize(input: SynthesisInput): Promise<SwarmResult> {
    const startTime = Date.now();

    // 1. Aggregate insights from all agents
    const aggregatedInsights = this.aggregateInsights(input.results);

    // 2. Aggregate concerns
    const aggregatedConcerns = this.aggregateConcerns(input.results);

    // 3. Aggregate suggestions
    const aggregatedSuggestions = this.aggregateSuggestions(input.results);

    // 4. Calculate aggregate confidence
    const aggregateConfidence = this.calculateConfidence(input.results, input.resolutions);

    // 5. Generate coherent synthesis using AI
    const synthesized = await this.generateSynthesis(
      input.problem,
      input.results,
      input.resolutions,
      aggregatedInsights,
      aggregatedConcerns,
      input.sharedContext
    );

    // 6. Build reasoning steps from agent contributions
    const reasoning = this.buildReasoningSteps(input.results, input.resolutions);

    // 7. Calculate total token usage
    const totalTokens = this.aggregateTokenUsage(input.results);

    return {
      answer: synthesized.answer,
      confidence: Math.min(synthesized.confidence, aggregateConfidence),
      reasoning,
      contributingAgents: input.results.map(r => ({
        id: r.agentId,
        role: r.role,
        contribution: r.output.slice(0, 200) + '...',
        confidence: r.confidence,
      })),
      conflictResolutions: input.resolutions,
      insights: synthesized.insights,
      recommendations: synthesized.recommendations,
      caveats: synthesized.caveats,
      tokenUsage: totalTokens,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Aggregate insights from all agents (deduplicated and ranked)
   */
  private aggregateInsights(results: AgentResult[]): string[] {
    const insightsWithWeight: Array<{ insight: string; weight: number }> = [];

    for (const result of results) {
      for (const insight of result.insights) {
        // Check for similar existing insights
        const similar = insightsWithWeight.find(i =>
          this.isSimilar(i.insight, insight)
        );

        if (similar) {
          // Boost weight if multiple agents agree
          similar.weight += result.confidence;
        } else {
          insightsWithWeight.push({
            insight,
            weight: result.confidence,
          });
        }
      }
    }

    // Sort by weight and return top insights
    return insightsWithWeight
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .map(i => i.insight);
  }

  /**
   * Aggregate concerns from all agents
   */
  private aggregateConcerns(results: AgentResult[]): string[] {
    const concernsWithWeight: Array<{ concern: string; weight: number }> = [];

    for (const result of results) {
      for (const concern of result.concerns) {
        const similar = concernsWithWeight.find(c =>
          this.isSimilar(c.concern, concern)
        );

        if (similar) {
          similar.weight += result.confidence;
        } else {
          concernsWithWeight.push({
            concern,
            weight: result.confidence,
          });
        }
      }
    }

    return concernsWithWeight
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map(c => c.concern);
  }

  /**
   * Aggregate suggestions from all agents
   */
  private aggregateSuggestions(results: AgentResult[]): string[] {
    const suggestionsWithWeight: Array<{ suggestion: string; weight: number }> = [];

    for (const result of results) {
      for (const suggestion of result.suggestions) {
        const similar = suggestionsWithWeight.find(s =>
          this.isSimilar(s.suggestion, suggestion)
        );

        if (similar) {
          similar.weight += result.confidence;
        } else {
          suggestionsWithWeight.push({
            suggestion,
            weight: result.confidence,
          });
        }
      }
    }

    return suggestionsWithWeight
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map(s => s.suggestion);
  }

  /**
   * Check if two strings are semantically similar
   */
  private isSimilar(a: string, b: string): boolean {
    const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 3));

    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    const jaccardSimilarity = union > 0 ? intersection / union : 0;

    return jaccardSimilarity > 0.4;
  }

  /**
   * Calculate aggregate confidence
   */
  private calculateConfidence(
    results: AgentResult[],
    resolutions: ConflictResolution[]
  ): number {
    if (results.length === 0) return 0;

    // Base confidence: weighted average of agent confidences
    const totalWeight = results.reduce((sum, r) => sum + r.confidence, 0);
    const weightedSum = results.reduce((sum, r) => sum + (r.confidence * r.confidence), 0);
    const baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Penalty for unresolved or low-confidence resolutions
    let conflictPenalty = 0;
    for (const resolution of resolutions) {
      if (resolution.confidence < 0.6) {
        conflictPenalty += 0.05;
      }
      if (resolution.strategy === 'voting' && resolution.confidence < 0.7) {
        conflictPenalty += 0.03;
      }
    }

    // Agreement bonus: agents that agree boost confidence
    const confidences = results.map(r => r.confidence);
    const stdDev = this.standardDeviation(confidences);
    const agreementBonus = stdDev < 0.15 ? 0.1 : 0;

    return Math.max(0, Math.min(1, baseConfidence - conflictPenalty + agreementBonus));
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Generate coherent synthesis using AI
   */
  private async generateSynthesis(
    problem: string,
    results: AgentResult[],
    resolutions: ConflictResolution[],
    insights: string[],
    concerns: string[],
    sharedContext?: string
  ): Promise<SynthesizedOutput> {
    const agentSummaries = results.map(r => `
## ${r.role.toUpperCase()} AGENT (confidence: ${r.confidence.toFixed(2)})
Key Insights: ${r.insights.slice(0, 3).join('; ')}
Main Concerns: ${r.concerns.slice(0, 2).join('; ')}
Recommendations: ${r.suggestions.slice(0, 2).join('; ')}
`).join('\n');

    const resolutionSummaries = resolutions.length > 0
      ? resolutions.map(r => `- [${r.strategy}] ${r.outcome.slice(0, 100)}... (confidence: ${r.confidence.toFixed(2)})`).join('\n')
      : 'No conflicts to resolve';

    const prompt = `You are synthesizing outputs from multiple specialized reasoning agents into a coherent final answer.

PROBLEM: ${problem}

${sharedContext ? `CONTEXT:\n${sharedContext}\n` : ''}

AGENT CONTRIBUTIONS:
${agentSummaries}

CONFLICT RESOLUTIONS:
${resolutionSummaries}

AGGREGATED INSIGHTS:
${insights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

AGGREGATED CONCERNS:
${concerns.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}

Synthesize these perspectives into a comprehensive, coherent response that:
1. Directly addresses the original problem
2. Incorporates the strongest insights from each agent
3. Acknowledges and addresses concerns raised
4. Provides actionable recommendations
5. Notes any remaining caveats or limitations

Format your response as:
ANSWER: [Comprehensive synthesized answer]

INSIGHTS: [List 5-7 key synthesized insights]

RECOMMENDATIONS: [List 3-5 actionable recommendations]

CAVEATS: [List 2-3 important caveats or limitations]

CONFIDENCE: [0.0-1.0]`;

    const model = HYPER_THINKING_MODELS[DEFAULT_MODEL_BY_TIER.maximum];
    const provider = getProvider(model.provider);

    const response = await provider.reason({
      prompt,
      model,
      thinkingBudget: 16000,
      temperature: this.config.temperature,
    });

    // Parse response
    const answerMatch = response.content.match(/ANSWER:\s*([\s\S]*?)(?=INSIGHTS:|$)/i);
    const insightsMatch = response.content.match(/INSIGHTS:\s*([\s\S]*?)(?=RECOMMENDATIONS:|$)/i);
    const recommendationsMatch = response.content.match(/RECOMMENDATIONS:\s*([\s\S]*?)(?=CAVEATS:|$)/i);
    const caveatsMatch = response.content.match(/CAVEATS:\s*([\s\S]*?)(?=CONFIDENCE:|$)/i);
    const confidenceMatch = response.content.match(/CONFIDENCE:\s*([\d.]+)/i);

    const parseList = (text: string | undefined): string[] => {
      if (!text) return [];
      return text
        .split(/[\n•\-\d.]+/)
        .map(i => i.trim())
        .filter(i => i.length > 10)
        .slice(0, 10);
    };

    return {
      answer: answerMatch ? answerMatch[1].trim() : response.content,
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.75,
      reasoning: [],
      insights: parseList(insightsMatch?.[1]),
      recommendations: parseList(recommendationsMatch?.[1]),
      caveats: parseList(caveatsMatch?.[1]),
    };
  }

  /**
   * Build reasoning steps from agent contributions
   */
  private buildReasoningSteps(
    results: AgentResult[],
    resolutions: ConflictResolution[]
  ): SwarmReasoningStep[] {
    const steps: SwarmReasoningStep[] = [];

    // Add agent reasoning steps
    for (const result of results) {
      steps.push({
        step: steps.length + 1,
        thought: `${result.role} agent analysis`,
        reasoning: result.output.slice(0, 500),
        conclusion: result.insights[0] || 'Analysis complete',
        confidence: result.confidence,
      });
    }

    // Add conflict resolution steps
    for (const resolution of resolutions) {
      steps.push({
        step: steps.length + 1,
        thought: `Conflict resolution (${resolution.strategy})`,
        reasoning: resolution.reasoning,
        conclusion: resolution.outcome.slice(0, 200),
        confidence: resolution.confidence,
      });
    }

    // Add synthesis step
    steps.push({
      step: steps.length + 1,
      thought: 'Final synthesis',
      reasoning: 'Combined insights from all agents and resolved conflicts',
      conclusion: 'Synthesized comprehensive answer',
      confidence: Math.max(0.5, ...results.map(r => r.confidence)),
    });

    return steps;
  }

  /**
   * Aggregate token usage from all results
   */
  private aggregateTokenUsage(results: AgentResult[]): TokenUsage {
    return results.reduce(
      (acc, r) => ({
        promptTokens: acc.promptTokens + (r.tokenUsage?.promptTokens || 0),
        completionTokens: acc.completionTokens + (r.tokenUsage?.completionTokens || 0),
        thinkingTokens: acc.thinkingTokens + (r.tokenUsage?.thinkingTokens || 0),
        totalTokens: acc.totalTokens + (r.tokenUsage?.totalTokens || 0),
      }),
      { promptTokens: 0, completionTokens: 0, thinkingTokens: 0, totalTokens: 0 }
    );
  }
}

/**
 * Create swarm synthesis engine
 */
export function createSwarmSynthesisEngine(config: SwarmConfig): SwarmSynthesisEngine {
  return new SwarmSynthesisEngine(config);
}

export default SwarmSynthesisEngine;
