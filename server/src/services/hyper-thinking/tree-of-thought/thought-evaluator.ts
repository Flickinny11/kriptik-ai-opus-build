/**
 * Thought Evaluator
 *
 * Evaluates thoughts in the Tree-of-Thought reasoning process.
 * Provides scoring, consistency voting, and expansion decisions.
 */

import type {
  ThoughtEvaluation,
  ToTEvaluationPrompt,
  ToTConfig,
} from './types.js';
import type { ModelConfig, TokenUsage } from '../types.js';
import { getProvider } from '../providers/index.js';

// ============================================================================
// Evaluation Prompts
// ============================================================================

const EVALUATION_PROMPT = (prompt: ToTEvaluationPrompt): string => `
You are evaluating a step in a reasoning chain. Be rigorous but fair.

PROBLEM:
${prompt.problem}

REASONING PATH SO FAR:
${prompt.path.length > 0 ? prompt.path.map((t, i) => `Step ${i + 1}: ${t}`).join('\n') : 'This is the first step.'}

THOUGHT TO EVALUATE:
${prompt.thought}

${prompt.successCriteria ? `SUCCESS CRITERIA:\n${prompt.successCriteria.map(c => `- ${c}`).join('\n')}\n` : ''}

Evaluate this thought on the following dimensions:

1. CORRECTNESS: Is the reasoning logically valid? Are there any errors?
2. PROGRESS: Does this move us closer to solving the problem?
3. COMPLETENESS: Is this a complete answer (terminal) or does it need expansion?
4. QUALITY: Is this well-articulated and clear?

Provide your evaluation in this EXACT format:
SCORE: [0.0 to 1.0, with 0.7+ being good, 0.9+ being excellent]
CONFIDENCE: [0.0 to 1.0, how confident are you in this evaluation]
IS_TERMINAL: [true/false - is this a complete final answer?]
SHOULD_EXPAND: [true/false - should we explore this branch further?]
REASONING: [Your reasoning for this evaluation in 1-3 sentences]
CONCERNS: [Any issues or concerns, or "none"]
SUGGESTIONS: [Suggestions for improvement, or "none"]`;

// ============================================================================
// Thought Evaluator Class
// ============================================================================

export class ThoughtEvaluator {
  private model: ModelConfig;
  private config: ToTConfig;

  constructor(model: ModelConfig, config: ToTConfig) {
    this.model = model;
    this.config = config;
  }

  /**
   * Evaluate a single thought
   */
  async evaluate(prompt: ToTEvaluationPrompt): Promise<{
    evaluation: ThoughtEvaluation;
    tokenUsage: TokenUsage;
    latencyMs: number;
  }> {
    const provider = getProvider(this.model.provider);

    const response = await provider.reason({
      prompt: EVALUATION_PROMPT(prompt),
      systemPrompt: `You are a critical evaluator of reasoning steps.
Be objective and thorough. A score of 0.7+ means the thought is good,
0.9+ means excellent. Be honest about concerns and don't over-praise.`,
      model: this.model,
      thinkingBudget: 4000, // Smaller budget for evaluation
      temperature: this.config.evaluationTemperature,
    });

    const evaluation = this.parseEvaluation(response.content);

    return {
      evaluation,
      tokenUsage: response.tokenUsage,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * Evaluate multiple thoughts in batch
   */
  async evaluateBatch(prompts: ToTEvaluationPrompt[]): Promise<Array<{
    evaluation: ThoughtEvaluation;
    tokenUsage: TokenUsage;
    latencyMs: number;
  }>> {
    // Evaluate in parallel for efficiency
    const results = await Promise.all(prompts.map(p => this.evaluate(p)));
    return results;
  }

  /**
   * Evaluate with consistency voting (multiple evaluations)
   */
  async evaluateWithConsistency(
    prompt: ToTEvaluationPrompt,
    numVotes: number = this.config.consistencyVotes
  ): Promise<{
    evaluation: ThoughtEvaluation;
    tokenUsage: TokenUsage;
    latencyMs: number;
    votes: ThoughtEvaluation[];
  }> {
    // Generate multiple evaluations
    const votePromises = Array.from({ length: numVotes }, () => this.evaluate(prompt));
    const voteResults = await Promise.all(votePromises);

    const votes = voteResults.map(r => r.evaluation);

    // Aggregate scores
    const avgScore = votes.reduce((sum, v) => sum + v.score, 0) / votes.length;
    const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;

    // Majority vote for boolean fields
    const terminalVotes = votes.filter(v => v.isTerminal).length;
    const expandVotes = votes.filter(v => v.shouldExpand).length;

    // Combine concerns and suggestions
    const allConcerns = votes.flatMap(v => v.concerns || []);
    const allSuggestions = votes.flatMap(v => v.suggestions || []);

    // Total token usage
    const totalTokens: TokenUsage = {
      promptTokens: voteResults.reduce((sum, r) => sum + r.tokenUsage.promptTokens, 0),
      completionTokens: voteResults.reduce((sum, r) => sum + r.tokenUsage.completionTokens, 0),
      thinkingTokens: voteResults.reduce((sum, r) => sum + r.tokenUsage.thinkingTokens, 0),
      totalTokens: voteResults.reduce((sum, r) => sum + r.tokenUsage.totalTokens, 0),
    };

    const totalLatency = voteResults.reduce((sum, r) => sum + r.latencyMs, 0);

    const evaluation: ThoughtEvaluation = {
      score: avgScore,
      confidence: avgConfidence,
      isTerminal: terminalVotes > numVotes / 2,
      shouldExpand: expandVotes > numVotes / 2,
      reasoning: `Aggregated from ${numVotes} evaluations with average score ${avgScore.toFixed(2)}`,
      concerns: [...new Set(allConcerns)],
      suggestions: [...new Set(allSuggestions)],
    };

    return {
      evaluation,
      tokenUsage: totalTokens,
      latencyMs: totalLatency,
      votes,
    };
  }

  /**
   * Quick evaluation (for pruning decisions)
   */
  async quickEvaluate(thought: string, problem: string): Promise<{
    worthExpanding: boolean;
    score: number;
  }> {
    const provider = getProvider(this.model.provider);

    const response = await provider.reason({
      prompt: `Problem: ${problem}

Thought: ${thought}

Rate this thought from 0-10 and decide if it's worth exploring further.
Reply with ONLY: SCORE: [0-10] EXPLORE: [yes/no]`,
      systemPrompt: 'Be concise. Rate thoughts quickly.',
      model: this.model,
      thinkingBudget: 1000,
      temperature: 0.2,
    });

    // Parse quick response
    const scoreMatch = response.content.match(/SCORE:\s*(\d+)/i);
    const exploreMatch = response.content.match(/EXPLORE:\s*(yes|no)/i);

    const score = scoreMatch ? parseInt(scoreMatch[1], 10) / 10 : 0.5;
    const worthExpanding = exploreMatch ? exploreMatch[1].toLowerCase() === 'yes' : score >= 0.5;

    return { worthExpanding, score };
  }

  /**
   * Parse evaluation from model response
   */
  private parseEvaluation(content: string): ThoughtEvaluation {
    // Default values
    let score = 0.5;
    let confidence = 0.5;
    let isTerminal = false;
    let shouldExpand = true;
    let reasoning = 'Unable to parse evaluation';
    let concerns: string[] = [];
    let suggestions: string[] = [];

    // Parse SCORE
    const scoreMatch = content.match(/SCORE:\s*([\d.]+)/i);
    if (scoreMatch) {
      score = Math.min(1, Math.max(0, parseFloat(scoreMatch[1])));
    }

    // Parse CONFIDENCE
    const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
    if (confidenceMatch) {
      confidence = Math.min(1, Math.max(0, parseFloat(confidenceMatch[1])));
    }

    // Parse IS_TERMINAL
    const terminalMatch = content.match(/IS_TERMINAL:\s*(true|false)/i);
    if (terminalMatch) {
      isTerminal = terminalMatch[1].toLowerCase() === 'true';
    }

    // Parse SHOULD_EXPAND
    const expandMatch = content.match(/SHOULD_EXPAND:\s*(true|false)/i);
    if (expandMatch) {
      shouldExpand = expandMatch[1].toLowerCase() === 'true';
    }

    // Parse REASONING
    const reasoningMatch = content.match(/REASONING:\s*(.+?)(?=CONCERNS:|SUGGESTIONS:|$)/is);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    }

    // Parse CONCERNS
    const concernsMatch = content.match(/CONCERNS:\s*(.+?)(?=SUGGESTIONS:|$)/is);
    if (concernsMatch) {
      const concernsText = concernsMatch[1].trim();
      if (concernsText.toLowerCase() !== 'none') {
        concerns = concernsText.split(/[-•]/).map(c => c.trim()).filter(c => c.length > 0);
      }
    }

    // Parse SUGGESTIONS
    const suggestionsMatch = content.match(/SUGGESTIONS:\s*(.+?)$/is);
    if (suggestionsMatch) {
      const suggestionsText = suggestionsMatch[1].trim();
      if (suggestionsText.toLowerCase() !== 'none') {
        suggestions = suggestionsText.split(/[-•]/).map(s => s.trim()).filter(s => s.length > 0);
      }
    }

    // Auto-determine shouldExpand based on score if not explicitly set
    if (!expandMatch) {
      shouldExpand = score >= this.config.evaluationThreshold && !isTerminal;
    }

    return {
      score,
      confidence,
      isTerminal,
      shouldExpand,
      reasoning,
      concerns: concerns.length > 0 ? concerns : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }
}

/**
 * Create thought evaluator
 */
export function createThoughtEvaluator(model: ModelConfig, config: ToTConfig): ThoughtEvaluator {
  return new ThoughtEvaluator(model, config);
}

export default ThoughtEvaluator;
