/**
 * Synthesis Engine
 * 
 * Synthesizes final answer from Tree-of-Thought exploration.
 * Combines best path with insights from alternative branches.
 */

import type {
  SynthesisInput,
  SynthesisResult,
  ThoughtNode,
} from './types.js';
import type { ModelConfig, TokenUsage } from '../types.js';
import { getProvider } from '../providers/index.js';

// ============================================================================
// Synthesis Prompts
// ============================================================================

const SYNTHESIS_PROMPT = (input: SynthesisInput): string => `
You are synthesizing a final answer from a tree-of-thought exploration.

ORIGINAL PROBLEM:
${input.problem}

BEST REASONING PATH:
${input.bestPath.map((node, i) => `Step ${i + 1}: ${node.thought}`).join('\n')}

${input.alternativePaths.length > 0 ? `
ALTERNATIVE PATHS CONSIDERED:
${input.alternativePaths.map((path, pathIdx) => 
  `Alternative ${pathIdx + 1}:\n${path.map((node, i) => `  Step ${i + 1}: ${node.thought}`).join('\n')}`
).join('\n\n')}
` : ''}

${input.prunedInsights && input.prunedInsights.length > 0 ? `
INSIGHTS FROM OTHER BRANCHES:
${input.prunedInsights.map(i => `- ${i}`).join('\n')}
` : ''}

TASK:
Synthesize the best reasoning path into a comprehensive, well-structured final answer.
If relevant, incorporate useful insights from alternative paths.
Be clear, thorough, and actionable.

Provide your response in this format:
ANSWER: [Your comprehensive answer]
REASONING: [Brief summary of the key reasoning steps]
CONFIDENCE: [0.0 to 1.0]
INCORPORATED_INSIGHTS: [List any insights you incorporated from alternatives, or "none"]`;

// ============================================================================
// Synthesis Engine Class
// ============================================================================

export class SynthesisEngine {
  private model: ModelConfig;
  
  constructor(model: ModelConfig) {
    this.model = model;
  }
  
  /**
   * Synthesize final answer from tree exploration
   */
  async synthesize(input: SynthesisInput): Promise<SynthesisResult> {
    const provider = getProvider(this.model.provider);
    const startTime = Date.now();
    
    const response = await provider.reason({
      prompt: SYNTHESIS_PROMPT(input),
      systemPrompt: `You are a synthesis expert. Your job is to combine multiple lines of reasoning
into a clear, comprehensive answer. Be thorough but concise. Focus on the best
reasoning path but incorporate valuable insights from alternatives.`,
      model: this.model,
      thinkingBudget: 8000,
      temperature: 0.5,
    });
    
    const latencyMs = Date.now() - startTime;
    
    // Parse synthesis response
    const result = this.parseSynthesis(response.content);
    
    return {
      ...result,
      tokenUsage: response.tokenUsage,
      latencyMs,
    };
  }
  
  /**
   * Quick synthesis (less thorough, faster)
   */
  async quickSynthesize(
    problem: string,
    bestPath: ThoughtNode[]
  ): Promise<SynthesisResult> {
    const provider = getProvider(this.model.provider);
    const startTime = Date.now();
    
    const prompt = `Problem: ${problem}

Reasoning path:
${bestPath.map((n, i) => `${i + 1}. ${n.thought}`).join('\n')}

Synthesize a clear final answer based on this reasoning. Be concise.

ANSWER:`;
    
    const response = await provider.reason({
      prompt,
      systemPrompt: 'Synthesize the reasoning into a clear answer.',
      model: this.model,
      thinkingBudget: 4000,
      temperature: 0.5,
    });
    
    const latencyMs = Date.now() - startTime;
    
    return {
      answer: response.content.replace(/^ANSWER:\s*/i, '').trim(),
      reasoning: bestPath.map(n => n.thought).join(' → '),
      confidence: bestPath.length > 0 ? (bestPath[bestPath.length - 1].evaluation?.score || 0.7) : 0.5,
      incorporatedInsights: [],
      tokenUsage: response.tokenUsage,
      latencyMs,
    };
  }
  
  /**
   * Parse synthesis response
   */
  private parseSynthesis(content: string): Omit<SynthesisResult, 'tokenUsage' | 'latencyMs'> {
    let answer = content;
    let reasoning = '';
    let confidence = 0.7;
    let incorporatedInsights: string[] = [];
    
    // Parse ANSWER
    const answerMatch = content.match(/ANSWER:\s*(.+?)(?=REASONING:|CONFIDENCE:|INCORPORATED_INSIGHTS:|$)/is);
    if (answerMatch) {
      answer = answerMatch[1].trim();
    }
    
    // Parse REASONING
    const reasoningMatch = content.match(/REASONING:\s*(.+?)(?=CONFIDENCE:|INCORPORATED_INSIGHTS:|$)/is);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    }
    
    // Parse CONFIDENCE
    const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
    if (confidenceMatch) {
      confidence = Math.min(1, Math.max(0, parseFloat(confidenceMatch[1])));
    }
    
    // Parse INCORPORATED_INSIGHTS
    const insightsMatch = content.match(/INCORPORATED_INSIGHTS:\s*(.+?)$/is);
    if (insightsMatch) {
      const insightsText = insightsMatch[1].trim();
      if (insightsText.toLowerCase() !== 'none') {
        incorporatedInsights = insightsText
          .split(/[-•\n]/)
          .map(i => i.trim())
          .filter(i => i.length > 0);
      }
    }
    
    return {
      answer,
      reasoning,
      confidence,
      incorporatedInsights,
    };
  }
}

/**
 * Create synthesis engine
 */
export function createSynthesisEngine(model: ModelConfig): SynthesisEngine {
  return new SynthesisEngine(model);
}

export default SynthesisEngine;
