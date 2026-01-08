/**
 * Search Strategies for Tree-of-Thought
 *
 * Implements different search algorithms for traversing the thought tree:
 * - BFS (Breadth-First Search): Explore all nodes at current depth before going deeper
 * - DFS (Depth-First Search): Explore one path fully before backtracking
 * - Beam Search: Keep top-k nodes at each level (best balance of exploration/exploitation)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ThoughtNode,
  ThoughtTree,
  ToTConfig,
  ToTProgressEvent,
  GeneratedThought,
} from './types.js';
import type { ModelConfig, TokenUsage, ProviderType } from '../types.js';
import { ThoughtGenerator } from './thought-generator.js';
import { ThoughtEvaluator } from './thought-evaluator.js';

// ============================================================================
// Search Strategy Interface
// ============================================================================

export interface SearchStrategy {
  /** Strategy name */
  readonly name: string;

  /** Execute search and yield progress events */
  search(
    problem: string,
    config: ToTConfig,
    model: ModelConfig,
    callbacks?: {
      onProgress?: (event: ToTProgressEvent) => void;
    }
  ): AsyncGenerator<ToTProgressEvent, ThoughtTree>;
}

// ============================================================================
// Base Search Strategy
// ============================================================================

abstract class BaseSearchStrategy implements SearchStrategy {
  abstract readonly name: string;

  protected generator!: ThoughtGenerator;
  protected evaluator!: ThoughtEvaluator;
  protected tree!: ThoughtTree;
  protected config!: ToTConfig;
  protected model!: ModelConfig;

  protected createNode(
    thought: string,
    parentId: string | null,
    depth: number,
    generatedThought: GeneratedThought
  ): ThoughtNode {
    return {
      id: uuidv4(),
      parentId,
      depth,
      thought,
      generationStrategy: generatedThought.strategy,
      children: [],
      model: this.model.modelId,
      provider: this.model.provider,
      tokenUsage: generatedThought.tokenUsage,
      latencyMs: generatedThought.latencyMs,
      createdAt: new Date(),
      pruned: false,
      metadata: {},
    };
  }

  protected initializeTree(problem: string): ThoughtTree {
    return {
      rootId: '',
      nodes: new Map(),
      problem,
      strategy: this.config.strategy,
      beamWidth: this.config.beamWidth,
      maxDepth: this.config.maxDepth,
      totalNodes: 0,
      evaluatedNodes: 0,
      bestPath: [],
      bestScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  protected addNode(node: ThoughtNode): void {
    this.tree.nodes.set(node.id, node);
    this.tree.totalNodes++;

    // Link to parent
    if (node.parentId) {
      const parent = this.tree.nodes.get(node.parentId);
      if (parent) {
        parent.children.push(node.id);
      }
    } else {
      // This is root
      this.tree.rootId = node.id;
    }

    this.tree.updatedAt = new Date();
  }

  protected getPathToNode(nodeId: string): string[] {
    const path: string[] = [];
    let current = this.tree.nodes.get(nodeId);

    while (current) {
      path.unshift(current.thought);
      current = current.parentId ? this.tree.nodes.get(current.parentId) : undefined;
    }

    return path;
  }

  protected getPathNodeIds(nodeId: string): string[] {
    const path: string[] = [];
    let current = this.tree.nodes.get(nodeId);

    while (current) {
      path.unshift(current.id);
      current = current.parentId ? this.tree.nodes.get(current.parentId) : undefined;
    }

    return path;
  }

  protected updateBestPath(nodeId: string, score: number): void {
    if (score > this.tree.bestScore) {
      this.tree.bestScore = score;
      this.tree.bestPath = this.getPathNodeIds(nodeId);
    }
  }

  protected progressEvent(
    type: ToTProgressEvent['type'],
    message: string,
    node?: ThoughtNode
  ): ToTProgressEvent {
    return {
      type,
      message,
      state: {
        nodesGenerated: this.tree.totalNodes,
        nodesEvaluated: this.tree.evaluatedNodes,
        currentDepth: node?.depth || 0,
        bestScore: this.tree.bestScore,
        progress: Math.min(1, this.tree.totalNodes / (this.config.maxDepth * this.config.beamWidth * this.config.maxBranches)),
      },
      node,
      timestamp: new Date(),
    };
  }

  abstract search(
    problem: string,
    config: ToTConfig,
    model: ModelConfig,
    callbacks?: { onProgress?: (event: ToTProgressEvent) => void }
  ): AsyncGenerator<ToTProgressEvent, ThoughtTree>;
}

// ============================================================================
// Beam Search Strategy (Recommended)
// ============================================================================

class BeamSearchStrategy extends BaseSearchStrategy {
  readonly name = 'beam';

  async *search(
    problem: string,
    config: ToTConfig,
    model: ModelConfig,
    callbacks?: { onProgress?: (event: ToTProgressEvent) => void }
  ): AsyncGenerator<ToTProgressEvent, ThoughtTree> {
    this.config = config;
    this.model = model;
    this.generator = new ThoughtGenerator(model, config);
    this.evaluator = new ThoughtEvaluator(model, config);
    this.tree = this.initializeTree(problem);

    yield this.progressEvent('tree_start', `Starting beam search with width ${config.beamWidth}`);

    // Generate initial thoughts (level 0)
    const initialThoughts = await this.generator.generateDiverseThoughts({
      problem,
      currentPath: [],
      depth: 0,
      strategy: 'direct',
      numThoughts: config.beamWidth,
    });

    // Create root nodes
    const currentLevel: ThoughtNode[] = [];
    for (const thought of initialThoughts) {
      const node = this.createNode(thought.thought, null, 0, thought);
      this.addNode(node);
      currentLevel.push(node);

      yield this.progressEvent('node_generated', `Generated initial thought`, node);
    }

    // Evaluate initial nodes
    await this.evaluateNodes(currentLevel, problem);
    yield this.progressEvent('depth_complete', `Completed depth 0 with ${currentLevel.length} nodes`);

    // Keep top-k nodes (beam)
    let beam = this.selectTopK(currentLevel, config.beamWidth);

    // Search remaining depths
    for (let depth = 1; depth < config.maxDepth; depth++) {
      if (beam.length === 0) break;

      // Check if any node is terminal
      const terminalNode = beam.find(n => n.evaluation?.isTerminal);
      if (terminalNode && terminalNode.evaluation!.score >= config.minSuccessScore) {
        yield this.progressEvent('best_path_updated', `Found terminal node with score ${terminalNode.evaluation!.score}`, terminalNode);
        break;
      }

      // Expand each node in beam
      const nextLevel: ThoughtNode[] = [];

      for (const node of beam) {
        if (node.evaluation?.shouldExpand === false || node.pruned) continue;

        const path = this.getPathToNode(node.id);
        const childThoughts = await this.generator.generateThoughts({
          problem,
          currentPath: path,
          depth,
          strategy: 'direct',
          numThoughts: config.maxBranches,
        });

        for (const thought of childThoughts) {
          const childNode = this.createNode(thought.thought, node.id, depth, thought);
          this.addNode(childNode);
          nextLevel.push(childNode);

          yield this.progressEvent('node_generated', `Generated thought at depth ${depth}`, childNode);
        }

        yield this.progressEvent('branch_expanded', `Expanded node at depth ${depth - 1}`, node);
      }

      // Evaluate new level
      await this.evaluateNodes(nextLevel, problem);
      yield this.progressEvent('depth_complete', `Completed depth ${depth} with ${nextLevel.length} nodes`);

      // Prune and select top-k
      beam = this.selectTopK(nextLevel, config.beamWidth);

      // Update best path
      for (const node of beam) {
        if (node.evaluation) {
          this.updateBestPath(node.id, node.evaluation.score);
        }
      }
    }

    yield this.progressEvent('tree_complete', `Beam search complete. Best score: ${this.tree.bestScore}`);

    return this.tree;
  }

  private async evaluateNodes(nodes: ThoughtNode[], problem: string): Promise<void> {
    const evaluationPromises = nodes.map(async node => {
      const path = this.getPathToNode(node.id);
      path.pop(); // Remove current thought from path

      const result = await this.evaluator.evaluate({
        problem,
        thought: node.thought,
        path,
        depth: node.depth,
      });

      node.evaluation = result.evaluation;
      node.tokenUsage.promptTokens += result.tokenUsage.promptTokens;
      node.tokenUsage.completionTokens += result.tokenUsage.completionTokens;
      node.tokenUsage.thinkingTokens += result.tokenUsage.thinkingTokens;
      node.tokenUsage.totalTokens += result.tokenUsage.totalTokens;
      this.tree.evaluatedNodes++;
    });

    await Promise.all(evaluationPromises);
  }

  private selectTopK(nodes: ThoughtNode[], k: number): ThoughtNode[] {
    // Filter out pruned nodes
    const validNodes = nodes.filter(n => !n.pruned && n.evaluation);

    // Sort by score (descending)
    validNodes.sort((a, b) => (b.evaluation?.score || 0) - (a.evaluation?.score || 0));

    // Prune low-scoring nodes
    for (let i = k; i < validNodes.length; i++) {
      if (validNodes[i].evaluation && validNodes[i].evaluation!.score < this.config.pruningThreshold) {
        validNodes[i].pruned = true;
      }
    }

    // Return top-k
    return validNodes.slice(0, k);
  }
}

// ============================================================================
// BFS Strategy
// ============================================================================

class BFSStrategy extends BaseSearchStrategy {
  readonly name = 'bfs';

  async *search(
    problem: string,
    config: ToTConfig,
    model: ModelConfig,
    callbacks?: { onProgress?: (event: ToTProgressEvent) => void }
  ): AsyncGenerator<ToTProgressEvent, ThoughtTree> {
    this.config = config;
    this.model = model;
    this.generator = new ThoughtGenerator(model, config);
    this.evaluator = new ThoughtEvaluator(model, config);
    this.tree = this.initializeTree(problem);

    yield this.progressEvent('tree_start', 'Starting BFS search');

    // Queue of nodes to expand
    const queue: ThoughtNode[] = [];

    // Generate initial thoughts
    const initialThoughts = await this.generator.generateDiverseThoughts({
      problem,
      currentPath: [],
      depth: 0,
      strategy: 'direct',
      numThoughts: config.maxBranches,
    });

    for (const thought of initialThoughts) {
      const node = this.createNode(thought.thought, null, 0, thought);
      this.addNode(node);
      queue.push(node);
      yield this.progressEvent('node_generated', 'Generated initial thought', node);
    }

    // BFS loop
    while (queue.length > 0) {
      const node = queue.shift()!;

      if (node.depth >= config.maxDepth) continue;
      if (node.pruned) continue;

      // Evaluate node
      const path = this.getPathToNode(node.id);
      path.pop();

      const evalResult = await this.evaluator.evaluate({
        problem,
        thought: node.thought,
        path,
        depth: node.depth,
      });

      node.evaluation = evalResult.evaluation;
      this.tree.evaluatedNodes++;

      yield this.progressEvent('node_evaluated', `Evaluated node with score ${evalResult.evaluation.score}`, node);

      // Check for terminal or pruning
      if (evalResult.evaluation.isTerminal && evalResult.evaluation.score >= config.minSuccessScore) {
        this.updateBestPath(node.id, evalResult.evaluation.score);
        yield this.progressEvent('best_path_updated', 'Found terminal solution', node);
        break;
      }

      if (evalResult.evaluation.score < config.pruningThreshold) {
        node.pruned = true;
        yield this.progressEvent('node_pruned', 'Pruned low-scoring node', node);
        continue;
      }

      this.updateBestPath(node.id, evalResult.evaluation.score);

      // Expand if should
      if (evalResult.evaluation.shouldExpand) {
        const childThoughts = await this.generator.generateThoughts({
          problem,
          currentPath: this.getPathToNode(node.id),
          depth: node.depth + 1,
          strategy: 'direct',
          numThoughts: config.maxBranches,
        });

        for (const thought of childThoughts) {
          const childNode = this.createNode(thought.thought, node.id, node.depth + 1, thought);
          this.addNode(childNode);
          queue.push(childNode);
          yield this.progressEvent('node_generated', 'Generated child thought', childNode);
        }
      }
    }

    yield this.progressEvent('tree_complete', `BFS complete. Best score: ${this.tree.bestScore}`);

    return this.tree;
  }
}

// ============================================================================
// DFS Strategy
// ============================================================================

class DFSStrategy extends BaseSearchStrategy {
  readonly name = 'dfs';

  async *search(
    problem: string,
    config: ToTConfig,
    model: ModelConfig,
    callbacks?: { onProgress?: (event: ToTProgressEvent) => void }
  ): AsyncGenerator<ToTProgressEvent, ThoughtTree> {
    this.config = config;
    this.model = model;
    this.generator = new ThoughtGenerator(model, config);
    this.evaluator = new ThoughtEvaluator(model, config);
    this.tree = this.initializeTree(problem);

    yield this.progressEvent('tree_start', 'Starting DFS search');

    // Generate initial thoughts
    const initialThoughts = await this.generator.generateDiverseThoughts({
      problem,
      currentPath: [],
      depth: 0,
      strategy: 'direct',
      numThoughts: config.maxBranches,
    });

    // DFS from each initial thought
    for (const thought of initialThoughts) {
      const node = this.createNode(thought.thought, null, 0, thought);
      this.addNode(node);

      yield this.progressEvent('node_generated', 'Generated initial thought', node);

      // Recursive DFS
      const events = this.dfsRecursive(node, problem);
      for await (const event of events) {
        yield event;

        // Early termination if found good solution
        if (event.type === 'best_path_updated' && this.tree.bestScore >= config.minSuccessScore) {
          yield this.progressEvent('tree_complete', 'Found satisfactory solution');
          return this.tree;
        }
      }
    }

    yield this.progressEvent('tree_complete', `DFS complete. Best score: ${this.tree.bestScore}`);

    return this.tree;
  }

  private async *dfsRecursive(
    node: ThoughtNode,
    problem: string
  ): AsyncGenerator<ToTProgressEvent> {
    // Evaluate node
    const path = this.getPathToNode(node.id);
    path.pop();

    const evalResult = await this.evaluator.evaluate({
      problem,
      thought: node.thought,
      path,
      depth: node.depth,
    });

    node.evaluation = evalResult.evaluation;
    this.tree.evaluatedNodes++;

    yield this.progressEvent('node_evaluated', `Evaluated with score ${evalResult.evaluation.score}`, node);

    // Update best path
    this.updateBestPath(node.id, evalResult.evaluation.score);

    // Check termination conditions
    if (evalResult.evaluation.isTerminal && evalResult.evaluation.score >= this.config.minSuccessScore) {
      yield this.progressEvent('best_path_updated', 'Found terminal solution', node);
      return;
    }

    if (node.depth >= this.config.maxDepth) {
      return;
    }

    if (evalResult.evaluation.score < this.config.pruningThreshold) {
      node.pruned = true;
      yield this.progressEvent('node_pruned', 'Pruned low-scoring node', node);
      return;
    }

    if (!evalResult.evaluation.shouldExpand) {
      return;
    }

    // Generate children
    const childThoughts = await this.generator.generateThoughts({
      problem,
      currentPath: this.getPathToNode(node.id),
      depth: node.depth + 1,
      strategy: 'direct',
      numThoughts: this.config.maxBranches,
    });

    // DFS into each child
    for (const thought of childThoughts) {
      const childNode = this.createNode(thought.thought, node.id, node.depth + 1, thought);
      this.addNode(childNode);

      yield this.progressEvent('node_generated', 'Generated child thought', childNode);

      // Recurse
      const childEvents = this.dfsRecursive(childNode, problem);
      for await (const event of childEvents) {
        yield event;

        // Early termination
        if (this.tree.bestScore >= this.config.minSuccessScore) {
          return;
        }
      }
    }
  }
}

// ============================================================================
// Strategy Factory
// ============================================================================

export function createSearchStrategy(strategy: 'bfs' | 'dfs' | 'beam'): SearchStrategy {
  switch (strategy) {
    case 'bfs':
      return new BFSStrategy();
    case 'dfs':
      return new DFSStrategy();
    case 'beam':
    default:
      return new BeamSearchStrategy();
  }
}

export { BeamSearchStrategy, BFSStrategy, DFSStrategy };
