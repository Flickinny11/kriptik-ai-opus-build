/**
 * Thought Generator
 *
 * Generates diverse thoughts for Tree-of-Thought reasoning.
 * Uses multiple generation strategies for diverse exploration.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  GenerationStrategy,
  ToTGenerationPrompt,
  GeneratedThought,
  ToTConfig,
} from './types.js';
import type { ModelConfig, TokenUsage, ProviderType } from '../types.js';
import { getProvider, type ReasoningResponse } from '../providers/index.js';

// ============================================================================
// Strategy Prompts
// ============================================================================

const STRATEGY_PROMPTS: Record<GenerationStrategy, (prompt: ToTGenerationPrompt) => string> = {
  direct: (prompt) => `
Problem: ${prompt.problem}

${prompt.currentPath.length > 0 ? `Previous reasoning:\n${prompt.currentPath.map((t, i) => `Step ${i + 1}: ${t}`).join('\n')}\n` : ''}
${prompt.hint ? `Hint: ${prompt.hint}\n` : ''}

Generate ${prompt.numThoughts} distinct next step(s) in reasoning, using a direct approach.
For each step, think about what logically follows from what we know.

Format each thought as:
THOUGHT 1: [Your reasoning step]
${prompt.numThoughts > 1 ? `THOUGHT 2: [Alternative reasoning step]
...` : ''}`,

  analogy: (prompt) => `
Problem: ${prompt.problem}

${prompt.currentPath.length > 0 ? `Previous reasoning:\n${prompt.currentPath.map((t, i) => `Step ${i + 1}: ${t}`).join('\n')}\n` : ''}
${prompt.hint ? `Hint: ${prompt.hint}\n` : ''}

Generate ${prompt.numThoughts} distinct next step(s) in reasoning, using ANALOGY.
Think of similar problems you've seen and how their solutions might apply here.

Format each thought as:
THOUGHT 1: [Analogy-based reasoning step]
${prompt.numThoughts > 1 ? `THOUGHT 2: [Different analogy approach]
...` : ''}`,

  decomposition: (prompt) => `
Problem: ${prompt.problem}

${prompt.currentPath.length > 0 ? `Previous reasoning:\n${prompt.currentPath.map((t, i) => `Step ${i + 1}: ${t}`).join('\n')}\n` : ''}
${prompt.hint ? `Hint: ${prompt.hint}\n` : ''}

Generate ${prompt.numThoughts} distinct next step(s) in reasoning, using DECOMPOSITION.
Break down the remaining problem into smaller, more manageable sub-problems.

Format each thought as:
THOUGHT 1: [Decomposition-based reasoning step]
${prompt.numThoughts > 1 ? `THOUGHT 2: [Different decomposition approach]
...` : ''}`,

  constraint: (prompt) => `
Problem: ${prompt.problem}

${prompt.currentPath.length > 0 ? `Previous reasoning:\n${prompt.currentPath.map((t, i) => `Step ${i + 1}: ${t}`).join('\n')}\n` : ''}
${prompt.hint ? `Hint: ${prompt.hint}\n` : ''}

Generate ${prompt.numThoughts} distinct next step(s) in reasoning, focusing on CONSTRAINTS.
Consider what limitations exist and how they shape possible solutions.

Format each thought as:
THOUGHT 1: [Constraint-focused reasoning step]
${prompt.numThoughts > 1 ? `THOUGHT 2: [Different constraint approach]
...` : ''}`,

  creative: (prompt) => `
Problem: ${prompt.problem}

${prompt.currentPath.length > 0 ? `Previous reasoning:\n${prompt.currentPath.map((t, i) => `Step ${i + 1}: ${t}`).join('\n')}\n` : ''}
${prompt.hint ? `Hint: ${prompt.hint}\n` : ''}

Generate ${prompt.numThoughts} distinct next step(s) in reasoning, using CREATIVE/UNCONVENTIONAL approaches.
Think outside the box - what novel perspectives might lead to solutions?

Format each thought as:
THOUGHT 1: [Creative reasoning step]
${prompt.numThoughts > 1 ? `THOUGHT 2: [Different creative approach]
...` : ''}`,
};

// ============================================================================
// Thought Generator Class
// ============================================================================

export class ThoughtGenerator {
  private model: ModelConfig;
  private config: ToTConfig;

  constructor(model: ModelConfig, config: ToTConfig) {
    this.model = model;
    this.config = config;
  }

  /**
   * Generate thoughts using a specific strategy
   */
  async generateThoughts(
    prompt: ToTGenerationPrompt
  ): Promise<GeneratedThought[]> {
    const strategyPrompt = STRATEGY_PROMPTS[prompt.strategy](prompt);
    const provider = getProvider(this.model.provider);

    const response = await provider.reason({
      prompt: strategyPrompt,
      systemPrompt: `You are an expert reasoner helping to explore solutions to a problem.
Generate distinct, high-quality reasoning steps. Each thought should be:
- Clear and well-reasoned
- Different from other thoughts (explore diverse approaches)
- A meaningful step forward in solving the problem
- Concise but complete`,
      model: this.model,
      thinkingBudget: Math.floor(this.config.beamWidth * 2000), // Budget per generation
      temperature: this.config.generationTemperature,
    });

    // Parse thoughts from response
    return this.parseThoughts(response, prompt.strategy);
  }

  /**
   * Generate diverse thoughts using multiple strategies
   */
  async generateDiverseThoughts(
    prompt: ToTGenerationPrompt
  ): Promise<GeneratedThought[]> {
    // Use different strategies for diversity
    const strategies: GenerationStrategy[] = ['direct', 'analogy', 'decomposition', 'constraint', 'creative'];

    // Select strategies based on depth
    let selectedStrategies: GenerationStrategy[];
    if (prompt.depth === 0) {
      // At root, use more diverse strategies
      selectedStrategies = strategies.slice(0, Math.min(prompt.numThoughts, 4)) as GenerationStrategy[];
    } else {
      // Deeper, focus on direct and decomposition
      const focusedStrategies: GenerationStrategy[] = ['direct', 'decomposition', 'constraint'];
      selectedStrategies = focusedStrategies.slice(0, prompt.numThoughts);
    }

    // Generate in parallel
    const thoughtPromises = selectedStrategies.map(strategy =>
      this.generateThoughts({
        ...prompt,
        strategy,
        numThoughts: 1, // One thought per strategy for diversity
      })
    );

    const results = await Promise.all(thoughtPromises);
    return results.flat();
  }

  /**
   * Parse thoughts from model response
   */
  private parseThoughts(response: ReasoningResponse, strategy: GenerationStrategy): GeneratedThought[] {
    const thoughts: GeneratedThought[] = [];
    const content = response.content;

    // Parse THOUGHT N: patterns
    const thoughtPattern = /THOUGHT\s*\d*:\s*(.+?)(?=THOUGHT\s*\d*:|$)/gis;
    let match;

    while ((match = thoughtPattern.exec(content)) !== null) {
      const thoughtText = match[1].trim();
      if (thoughtText.length > 10) { // Filter out very short/empty thoughts
        thoughts.push({
          thought: thoughtText,
          strategy,
          tokenUsage: {
            promptTokens: Math.floor(response.tokenUsage.promptTokens / Math.max(1, thoughts.length + 1)),
            completionTokens: Math.floor(response.tokenUsage.completionTokens / Math.max(1, thoughts.length + 1)),
            thinkingTokens: Math.floor(response.tokenUsage.thinkingTokens / Math.max(1, thoughts.length + 1)),
            totalTokens: Math.floor(response.tokenUsage.totalTokens / Math.max(1, thoughts.length + 1)),
          },
          latencyMs: Math.floor(response.latencyMs / Math.max(1, thoughts.length + 1)),
        });
      }
    }

    // If pattern didn't match, treat whole response as one thought
    if (thoughts.length === 0 && content.trim().length > 10) {
      thoughts.push({
        thought: content.trim(),
        strategy,
        tokenUsage: response.tokenUsage,
        latencyMs: response.latencyMs,
      });
    }

    return thoughts;
  }

  /**
   * Generate continuation thoughts for a specific path
   */
  async generateContinuation(
    problem: string,
    currentPath: string[],
    hint?: string
  ): Promise<GeneratedThought[]> {
    return this.generateThoughts({
      problem,
      currentPath,
      depth: currentPath.length,
      hint,
      strategy: 'direct',
      numThoughts: this.config.maxBranches,
    });
  }
}

/**
 * Create thought generator
 */
export function createThoughtGenerator(model: ModelConfig, config: ToTConfig): ThoughtGenerator {
  return new ThoughtGenerator(model, config);
}

export default ThoughtGenerator;
