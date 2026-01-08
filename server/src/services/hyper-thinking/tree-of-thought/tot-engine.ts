/**
 * Tree-of-Thought Engine
 *
 * Main orchestrator for ToT reasoning.
 * Coordinates search, evaluation, and synthesis.
 */

import type {
  ToTConfig,
  ToTResult,
  ToTProgressEvent,
  ThoughtTree,
  ThoughtNode,
  DEFAULT_TOT_CONFIG,
} from './types.js';
import { DEFAULT_TOT_CONFIG as defaultConfig } from './types.js';
import type { ModelConfig, TokenUsage } from '../types.js';
import { createSearchStrategy, type SearchStrategy } from './search-strategies.js';
import { SynthesisEngine } from './synthesis-engine.js';

// ============================================================================
// ToT Engine Class
// ============================================================================

export class ToTEngine {
  private model: ModelConfig;
  private config: ToTConfig;
  private searchStrategy: SearchStrategy;
  private synthesisEngine: SynthesisEngine;
  private currentTree: ThoughtTree | null = null;

  constructor(model: ModelConfig, config?: Partial<ToTConfig>) {
    this.model = model;
    this.config = { ...defaultConfig, ...config };
    this.searchStrategy = createSearchStrategy(this.config.strategy);
    this.synthesisEngine = new SynthesisEngine(model);
  }

  /**
   * Solve a problem using Tree-of-Thought
   */
  async solve(problem: string, successCriteria?: string[]): Promise<ToTResult> {
    const startTime = Date.now();

    // Execute search
    const searchGen = this.searchStrategy.search(problem, this.config, this.model);

    let tree: ThoughtTree | undefined;
    for await (const _event of searchGen) {
      // Collect events but don't emit (non-streaming mode)
      const result = await searchGen.next();
      if (result.done) {
        tree = result.value;
      }
    }

    if (!tree) {
      throw new Error('Search did not produce a tree');
    }

    this.currentTree = tree;

    // Synthesize answer
    const bestPathNodes = this.getBestPathNodes(tree);
    const alternativePaths = this.getAlternativePaths(tree, 2);

    const synthesisResult = await this.synthesisEngine.synthesize({
      problem,
      tree,
      bestPath: bestPathNodes,
      alternativePaths,
      prunedInsights: this.getPrunedInsights(tree),
    });

    const totalLatencyMs = Date.now() - startTime;

    // Calculate total tokens
    const totalTokens = this.calculateTotalTokens(tree, synthesisResult.tokenUsage);

    return {
      success: tree.bestScore >= this.config.minSuccessScore,
      tree,
      finalAnswer: synthesisResult.answer,
      confidence: synthesisResult.confidence,
      totalTokens,
      totalLatencyMs,
      modelsUsed: [this.model.modelId],
      bestReasoningPath: bestPathNodes.map(n => n.thought),
      alternativePaths: alternativePaths.map(path => ({
        path: path.map(n => n.thought),
        score: path.length > 0 ? (path[path.length - 1].evaluation?.score || 0) : 0,
      })),
      metadata: {
        nodesGenerated: tree.totalNodes,
        nodesEvaluated: tree.evaluatedNodes,
        nodesPruned: Array.from(tree.nodes.values()).filter(n => n.pruned).length,
        maxDepthReached: Math.max(...Array.from(tree.nodes.values()).map(n => n.depth)),
        strategyUsed: this.config.strategy,
        beamWidth: this.config.beamWidth,
      },
    };
  }

  /**
   * Solve with streaming progress events
   */
  async *solveStream(
    problem: string,
    successCriteria?: string[]
  ): AsyncGenerator<ToTProgressEvent, ToTResult> {
    const startTime = Date.now();

    // Execute search with streaming
    const searchGen = this.searchStrategy.search(problem, this.config, this.model);

    let tree: ThoughtTree | undefined;

    while (true) {
      const result = await searchGen.next();
      if (result.done) {
        tree = result.value;
        break;
      }
      yield result.value;
    }

    if (!tree) {
      throw new Error('Search did not produce a tree');
    }

    this.currentTree = tree;

    // Synthesis phase
    yield {
      type: 'synthesis_start',
      message: 'Starting synthesis of final answer',
      state: {
        nodesGenerated: tree.totalNodes,
        nodesEvaluated: tree.evaluatedNodes,
        currentDepth: this.config.maxDepth,
        bestScore: tree.bestScore,
        progress: 0.9,
      },
      timestamp: new Date(),
    };

    const bestPathNodes = this.getBestPathNodes(tree);
    const alternativePaths = this.getAlternativePaths(tree, 2);

    const synthesisResult = await this.synthesisEngine.synthesize({
      problem,
      tree,
      bestPath: bestPathNodes,
      alternativePaths,
      prunedInsights: this.getPrunedInsights(tree),
    });

    const totalLatencyMs = Date.now() - startTime;
    const totalTokens = this.calculateTotalTokens(tree, synthesisResult.tokenUsage);

    yield {
      type: 'tree_complete',
      message: `ToT complete. Final confidence: ${synthesisResult.confidence}`,
      state: {
        nodesGenerated: tree.totalNodes,
        nodesEvaluated: tree.evaluatedNodes,
        currentDepth: this.config.maxDepth,
        bestScore: tree.bestScore,
        progress: 1.0,
      },
      timestamp: new Date(),
    };

    return {
      success: tree.bestScore >= this.config.minSuccessScore,
      tree,
      finalAnswer: synthesisResult.answer,
      confidence: synthesisResult.confidence,
      totalTokens,
      totalLatencyMs,
      modelsUsed: [this.model.modelId],
      bestReasoningPath: bestPathNodes.map(n => n.thought),
      alternativePaths: alternativePaths.map(path => ({
        path: path.map(n => n.thought),
        score: path.length > 0 ? (path[path.length - 1].evaluation?.score || 0) : 0,
      })),
      metadata: {
        nodesGenerated: tree.totalNodes,
        nodesEvaluated: tree.evaluatedNodes,
        nodesPruned: Array.from(tree.nodes.values()).filter(n => n.pruned).length,
        maxDepthReached: Math.max(...Array.from(tree.nodes.values()).map(n => n.depth)),
        strategyUsed: this.config.strategy,
        beamWidth: this.config.beamWidth,
      },
    };
  }

  /**
   * Get current tree (if available)
   */
  getTree(): ThoughtTree | null {
    return this.currentTree;
  }

  /**
   * Continue from a partial tree
   */
  async continueFrom(
    tree: ThoughtTree,
    problem: string
  ): Promise<ToTResult> {
    // Find expandable leaf nodes
    const leafNodes = Array.from(tree.nodes.values()).filter(
      n => n.children.length === 0 && !n.pruned && n.evaluation?.shouldExpand
    );

    if (leafNodes.length === 0) {
      // No more expansion possible, just synthesize
      const bestPathNodes = this.getBestPathNodes(tree);
      const synthesisResult = await this.synthesisEngine.quickSynthesize(
        problem,
        bestPathNodes
      );

      return {
        success: tree.bestScore >= this.config.minSuccessScore,
        tree,
        finalAnswer: synthesisResult.answer,
        confidence: synthesisResult.confidence,
        totalTokens: synthesisResult.tokenUsage,
        totalLatencyMs: synthesisResult.latencyMs,
        modelsUsed: [this.model.modelId],
        bestReasoningPath: bestPathNodes.map(n => n.thought),
        alternativePaths: [],
        metadata: {
          nodesGenerated: tree.totalNodes,
          nodesEvaluated: tree.evaluatedNodes,
          nodesPruned: Array.from(tree.nodes.values()).filter(n => n.pruned).length,
          maxDepthReached: Math.max(...Array.from(tree.nodes.values()).map(n => n.depth)),
          strategyUsed: this.config.strategy,
          beamWidth: this.config.beamWidth,
        },
      };
    }

    // Continue search with existing tree
    // For simplicity, start fresh but could be optimized to continue
    return this.solve(problem);
  }

  /**
   * Get best path nodes from tree
   */
  private getBestPathNodes(tree: ThoughtTree): ThoughtNode[] {
    return tree.bestPath.map(id => tree.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Get alternative paths (top paths excluding best)
   */
  private getAlternativePaths(tree: ThoughtTree, count: number): ThoughtNode[][] {
    // Get all leaf nodes
    const leafNodes = Array.from(tree.nodes.values()).filter(
      n => n.children.length === 0 && !n.pruned && n.evaluation
    );

    // Sort by score
    leafNodes.sort((a, b) => (b.evaluation?.score || 0) - (a.evaluation?.score || 0));

    // Get paths for top nodes (excluding best path)
    const paths: ThoughtNode[][] = [];
    const bestPathSet = new Set(tree.bestPath);

    for (const leaf of leafNodes) {
      if (paths.length >= count) break;
      if (bestPathSet.has(leaf.id)) continue;

      // Build path to this leaf
      const path: ThoughtNode[] = [];
      let current: ThoughtNode | undefined = leaf;
      while (current) {
        path.unshift(current);
        current = current.parentId ? tree.nodes.get(current.parentId) : undefined;
      }

      paths.push(path);
    }

    return paths;
  }

  /**
   * Get insights from pruned but interesting branches
   */
  private getPrunedInsights(tree: ThoughtTree): string[] {
    const prunedNodes = Array.from(tree.nodes.values()).filter(
      n => n.pruned && n.evaluation && n.evaluation.score >= 0.4
    );

    // Get suggestions from pruned nodes
    const insights: string[] = [];
    for (const node of prunedNodes) {
      if (node.evaluation?.suggestions) {
        insights.push(...node.evaluation.suggestions);
      }
      // Also include the thought itself if it had decent score
      if (node.evaluation && node.evaluation.score >= 0.5) {
        insights.push(`Alternative approach: ${node.thought.slice(0, 200)}...`);
      }
    }

    // Deduplicate and limit
    return [...new Set(insights)].slice(0, 5);
  }

  /**
   * Calculate total token usage
   */
  private calculateTotalTokens(tree: ThoughtTree, synthesisTokens: TokenUsage): TokenUsage {
    let promptTokens = synthesisTokens.promptTokens;
    let completionTokens = synthesisTokens.completionTokens;
    let thinkingTokens = synthesisTokens.thinkingTokens;

    for (const node of tree.nodes.values()) {
      promptTokens += node.tokenUsage.promptTokens;
      completionTokens += node.tokenUsage.completionTokens;
      thinkingTokens += node.tokenUsage.thinkingTokens;
    }

    return {
      promptTokens,
      completionTokens,
      thinkingTokens,
      totalTokens: promptTokens + completionTokens + thinkingTokens,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ToTConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.strategy) {
      this.searchStrategy = createSearchStrategy(config.strategy);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ToTConfig {
    return { ...this.config };
  }
}

/**
 * Create ToT engine
 */
export function createToTEngine(model: ModelConfig, config?: Partial<ToTConfig>): ToTEngine {
  return new ToTEngine(model, config);
}

export default ToTEngine;
