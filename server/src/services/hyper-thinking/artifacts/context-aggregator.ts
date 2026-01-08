/**
 * Context Aggregator
 *
 * Aggregates context from multiple reasoning steps and manages context window limits.
 * Supports various aggregation strategies for optimal context composition.
 */

import {
  type ContextChunk,
  type AggregatedContext,
  type ContextAggregationStrategy,
  type ThoughtArtifact,
  type MemoryEntry,
} from './types.js';
import { getEmbeddingService } from '../../embeddings/index.js';

// ============================================================================
// Configuration
// ============================================================================

export interface ContextAggregatorConfig {
  /** Default context window size in tokens */
  defaultContextLimit: number;
  /** Reserve tokens for response */
  responseReserve: number;
  /** Default aggregation strategy */
  defaultStrategy: ContextAggregationStrategy;
  /** Enable context summarization */
  enableSummarization: boolean;
  /** Summary ratio when exceeding context */
  summaryRatio: number;
  /** Minimum relevance score to include */
  minRelevanceThreshold: number;
  /** Maximum chunks to process */
  maxChunks: number;
}

export const DEFAULT_CONTEXT_AGGREGATOR_CONFIG: ContextAggregatorConfig = {
  defaultContextLimit: 128000,
  responseReserve: 16000,
  defaultStrategy: 'importance_weighted',
  enableSummarization: true,
  summaryRatio: 0.3,
  minRelevanceThreshold: 0.3,
  maxChunks: 500,
};

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for text (approximate)
 */
function estimateTokens(text: string): number {
  // Rough estimate: 4 characters per token
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Context Aggregator Class
// ============================================================================

export class ContextAggregator {
  private config: ContextAggregatorConfig;
  private chunks: ContextChunk[] = [];

  constructor(config: Partial<ContextAggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_AGGREGATOR_CONFIG, ...config };
  }

  // ==========================================================================
  // Adding Context
  // ==========================================================================

  /**
   * Add artifact as context chunk
   */
  addArtifact(artifact: ThoughtArtifact, relevance: number = 1.0): void {
    const chunk: ContextChunk = {
      id: artifact.id,
      content: artifact.content,
      sourceId: artifact.id,
      relevance,
      priority: this.calculatePriority(artifact, relevance),
      tokenCount: estimateTokens(artifact.content),
      type: 'artifact',
      order: this.chunks.length,
    };

    this.chunks.push(chunk);
  }

  /**
   * Add memory as context chunk
   */
  addMemory(memory: MemoryEntry, relevance: number = 1.0): void {
    const chunk: ContextChunk = {
      id: memory.id,
      content: memory.content,
      sourceId: memory.id,
      relevance,
      priority: this.calculateMemoryPriority(memory, relevance),
      tokenCount: estimateTokens(memory.content),
      type: 'memory',
      order: this.chunks.length,
    };

    this.chunks.push(chunk);
  }

  /**
   * Add raw text as context chunk
   */
  addText(
    id: string,
    content: string,
    type: ContextChunk['type'] = 'instruction',
    priority: number = 0.5
  ): void {
    const chunk: ContextChunk = {
      id,
      content,
      sourceId: id,
      relevance: 1.0,
      priority,
      tokenCount: estimateTokens(content),
      type,
      order: this.chunks.length,
    };

    this.chunks.push(chunk);
  }

  /**
   * Add summary as context chunk
   */
  addSummary(id: string, content: string, priority: number = 0.8): void {
    this.addText(id, content, 'summary', priority);
  }

  // ==========================================================================
  // Priority Calculation
  // ==========================================================================

  /**
   * Calculate priority for artifact
   */
  private calculatePriority(artifact: ThoughtArtifact, relevance: number): number {
    let priority = relevance * 0.4; // 40% from relevance

    // Boost for successful artifacts
    if (artifact.successful) {
      priority += 0.2;
    }

    // Boost for high confidence
    priority += artifact.confidence * 0.2;

    // Boost for recent artifacts (decay based on depth)
    const depthFactor = 1 / (1 + artifact.depth * 0.1);
    priority += depthFactor * 0.2;

    return Math.min(1, priority);
  }

  /**
   * Calculate priority for memory
   */
  private calculateMemoryPriority(memory: MemoryEntry, relevance: number): number {
    let priority = relevance * 0.4; // 40% from relevance

    // Importance factor
    priority += memory.importance * 0.3;

    // Access frequency bonus
    const accessBonus = Math.min(0.2, memory.accessCount * 0.02);
    priority += accessBonus;

    // Decay penalty
    priority -= memory.decayFactor * 0.1;

    return Math.max(0, Math.min(1, priority));
  }

  // ==========================================================================
  // Aggregation Strategies
  // ==========================================================================

  /**
   * Aggregate context with specified strategy
   */
  aggregate(
    contextLimit?: number,
    strategy?: ContextAggregationStrategy
  ): AggregatedContext {
    const limit = contextLimit || this.config.defaultContextLimit - this.config.responseReserve;
    const selectedStrategy = strategy || this.config.defaultStrategy;

    // Sort chunks based on strategy
    const sortedChunks = this.sortChunks(selectedStrategy);

    // Select chunks within limit
    const { selected, excluded } = this.selectChunks(sortedChunks, limit);

    // Create summary of excluded if needed
    let excludedSummary: string | undefined;
    if (excluded.length > 0 && this.config.enableSummarization) {
      excludedSummary = this.createExcludedSummary(excluded);
    }

    const totalTokens = selected.reduce((sum, c) => sum + c.tokenCount, 0);

    return {
      chunks: selected,
      totalTokens,
      limit,
      truncated: excluded.length > 0,
      excludedSummary,
      strategy: selectedStrategy,
    };
  }

  /**
   * Sort chunks based on strategy
   */
  private sortChunks(strategy: ContextAggregationStrategy): ContextChunk[] {
    const chunks = [...this.chunks];

    switch (strategy) {
      case 'relevance_first':
        return chunks.sort((a, b) => b.relevance - a.relevance);

      case 'recency_first':
        return chunks.sort((a, b) => b.order - a.order);

      case 'importance_weighted':
        return chunks.sort((a, b) => b.priority - a.priority);

      case 'hybrid':
        return chunks.sort((a, b) => {
          // Combine relevance, priority, and recency
          const scoreA = a.relevance * 0.4 + a.priority * 0.4 + (a.order / chunks.length) * 0.2;
          const scoreB = b.relevance * 0.4 + b.priority * 0.4 + (b.order / chunks.length) * 0.2;
          return scoreB - scoreA;
        });

      default:
        return chunks;
    }
  }

  /**
   * Select chunks within token limit
   */
  private selectChunks(
    sortedChunks: ContextChunk[],
    limit: number
  ): { selected: ContextChunk[]; excluded: ContextChunk[] } {
    const selected: ContextChunk[] = [];
    const excluded: ContextChunk[] = [];
    let currentTokens = 0;

    for (const chunk of sortedChunks) {
      // Skip if below relevance threshold
      if (chunk.relevance < this.config.minRelevanceThreshold) {
        excluded.push(chunk);
        continue;
      }

      // Check if adding this chunk exceeds limit
      if (currentTokens + chunk.tokenCount <= limit) {
        selected.push(chunk);
        currentTokens += chunk.tokenCount;
      } else {
        excluded.push(chunk);
      }

      // Enforce max chunks
      if (selected.length >= this.config.maxChunks) {
        excluded.push(...sortedChunks.slice(sortedChunks.indexOf(chunk) + 1));
        break;
      }
    }

    // Re-sort selected by original order for coherent output
    selected.sort((a, b) => a.order - b.order);

    return { selected, excluded };
  }

  /**
   * Create summary of excluded content
   */
  private createExcludedSummary(excluded: ContextChunk[]): string {
    const totalExcluded = excluded.length;
    const totalTokens = excluded.reduce((sum, c) => sum + c.tokenCount, 0);
    
    const typeBreakdown = excluded.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `[EXCLUDED CONTEXT: ${totalExcluded} items, ${totalTokens} tokens. ` +
      `Breakdown: ${Object.entries(typeBreakdown).map(([k, v]) => `${k}=${v}`).join(', ')}]`;
  }

  // ==========================================================================
  // Query-Based Aggregation
  // ==========================================================================

  /**
   * Aggregate context based on query relevance
   */
  async aggregateForQuery(
    query: string,
    contextLimit?: number
  ): Promise<AggregatedContext> {
    // Generate query embedding
    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.embed({
      content: query,
      type: 'reasoning',
    });
    const queryVector = queryEmbedding.embeddings[0];

    // Re-score chunks based on query relevance
    const scoredChunks = await Promise.all(
      this.chunks.map(async (chunk) => {
        // Generate chunk embedding if not cached
        const chunkEmbedding = await embeddingService.embed({
          content: chunk.content,
          type: 'reasoning',
        });
        const chunkVector = chunkEmbedding.embeddings[0];

        // Calculate cosine similarity
        const similarity = embeddingService.similarity(queryVector, chunkVector);
        
        return {
          ...chunk,
          relevance: similarity.similarity,
          priority: this.recalculatePriority(chunk, similarity.similarity),
        };
      })
    );

    // Replace chunks with scored versions
    this.chunks = scoredChunks;

    // Aggregate with importance weighting
    return this.aggregate(contextLimit, 'importance_weighted');
  }

  /**
   * Recalculate priority with new relevance
   */
  private recalculatePriority(chunk: ContextChunk, relevance: number): number {
    // Base priority from relevance
    let priority = relevance * 0.5;

    // Keep some of the original priority
    priority += chunk.priority * 0.3;

    // Type-based bonus
    switch (chunk.type) {
      case 'instruction':
        priority += 0.15;
        break;
      case 'summary':
        priority += 0.1;
        break;
      case 'artifact':
        priority += 0.05;
        break;
      default:
        break;
    }

    return Math.min(1, priority);
  }

  // ==========================================================================
  // Context Output
  // ==========================================================================

  /**
   * Get aggregated context as single string
   */
  toText(aggregated?: AggregatedContext): string {
    const context = aggregated || this.aggregate();
    
    const sections: string[] = [];

    // Group by type
    const byType = new Map<ContextChunk['type'], ContextChunk[]>();
    for (const chunk of context.chunks) {
      const existing = byType.get(chunk.type) || [];
      existing.push(chunk);
      byType.set(chunk.type, existing);
    }

    // Instructions first
    const instructions = byType.get('instruction');
    if (instructions) {
      sections.push('## Instructions\n' + instructions.map(c => c.content).join('\n\n'));
    }

    // Then summaries
    const summaries = byType.get('summary');
    if (summaries) {
      sections.push('## Context Summary\n' + summaries.map(c => c.content).join('\n\n'));
    }

    // Then artifacts
    const artifacts = byType.get('artifact');
    if (artifacts) {
      sections.push('## Reasoning Context\n' + artifacts.map(c => c.content).join('\n\n---\n\n'));
    }

    // Then memories
    const memories = byType.get('memory');
    if (memories) {
      sections.push('## Relevant Memories\n' + memories.map(c => c.content).join('\n\n'));
    }

    // Add excluded summary if present
    if (context.excludedSummary) {
      sections.push('\n' + context.excludedSummary);
    }

    return sections.join('\n\n');
  }

  /**
   * Get aggregated context as structured object
   */
  toStructured(aggregated?: AggregatedContext): {
    instructions: string[];
    summaries: string[];
    artifacts: string[];
    memories: string[];
    totalTokens: number;
    truncated: boolean;
  } {
    const context = aggregated || this.aggregate();

    const result = {
      instructions: [] as string[],
      summaries: [] as string[],
      artifacts: [] as string[],
      memories: [] as string[],
      totalTokens: context.totalTokens,
      truncated: context.truncated,
    };

    for (const chunk of context.chunks) {
      switch (chunk.type) {
        case 'instruction':
          result.instructions.push(chunk.content);
          break;
        case 'summary':
          result.summaries.push(chunk.content);
          break;
        case 'artifact':
          result.artifacts.push(chunk.content);
          break;
        case 'memory':
          result.memories.push(chunk.content);
          break;
      }
    }

    return result;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * Get current chunk count
   */
  getChunkCount(): number {
    return this.chunks.length;
  }

  /**
   * Get estimated total tokens
   */
  getTotalTokens(): number {
    return this.chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextAggregatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createContextAggregator(
  config?: Partial<ContextAggregatorConfig>
): ContextAggregator {
  return new ContextAggregator(config);
}

export default ContextAggregator;
