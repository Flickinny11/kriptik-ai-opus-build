/**
 * Reasoning Memory Service
 *
 * Manages short-term and long-term memory for reasoning chains.
 * Supports memory retrieval by similarity and automatic consolidation.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type MemoryEntry,
  type MemoryContext,
  type ThoughtArtifact,
  type ConsolidationCandidate,
  type ConsolidationResult,
} from './types.js';
import {
  getEmbeddingService,
  getCollectionManager,
  COLLECTION_NAMES,
  type HyperThinkingPayload,
} from '../../embeddings/index.js';

// ============================================================================
// Configuration
// ============================================================================

export interface ReasoningMemoryConfig {
  /** Short-term memory capacity */
  shortTermCapacity: number;
  /** Working memory capacity */
  workingMemoryCapacity: number;
  /** Memory decay rate per hour */
  decayRatePerHour: number;
  /** Importance threshold for long-term promotion */
  longTermPromotionThreshold: number;
  /** Context window size for retrieval */
  contextWindowSize: number;
  /** Maximum memories to retrieve */
  maxRetrievedMemories: number;
  /** Enable automatic consolidation */
  enableAutoConsolidation: boolean;
  /** Consolidation interval in milliseconds */
  consolidationIntervalMs: number;
}

export const DEFAULT_REASONING_MEMORY_CONFIG: ReasoningMemoryConfig = {
  shortTermCapacity: 100,
  workingMemoryCapacity: 20,
  decayRatePerHour: 0.1,
  longTermPromotionThreshold: 0.7,
  contextWindowSize: 128000,
  maxRetrievedMemories: 20,
  enableAutoConsolidation: true,
  consolidationIntervalMs: 300000, // 5 minutes
};

// ============================================================================
// Reasoning Memory Class
// ============================================================================

export class ReasoningMemory {
  private config: ReasoningMemoryConfig;
  
  // In-memory storage
  private shortTermMemory: Map<string, MemoryEntry> = new Map();
  private workingMemory: Map<string, MemoryEntry> = new Map();
  
  // Consolidation tracking
  private consolidationCandidates: ConsolidationCandidate[] = [];
  private lastConsolidation: Date = new Date();
  private consolidationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ReasoningMemoryConfig> = {}) {
    this.config = { ...DEFAULT_REASONING_MEMORY_CONFIG, ...config };
    
    if (this.config.enableAutoConsolidation) {
      this.startConsolidationTimer();
    }
  }

  // ==========================================================================
  // Memory Storage
  // ==========================================================================

  /**
   * Add memory to short-term storage
   */
  addShortTerm(content: string, options: {
    importance?: number;
    sourceArtifactId?: string;
    contextSummary?: string;
  } = {}): MemoryEntry {
    const entry: MemoryEntry = {
      id: uuidv4(),
      content,
      importance: options.importance || 0.5,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      sourceArtifactId: options.sourceArtifactId,
      contextSummary: options.contextSummary,
      memoryType: 'short_term',
      decayFactor: 0,
      createdAt: new Date().toISOString(),
    };

    // Enforce capacity limit
    if (this.shortTermMemory.size >= this.config.shortTermCapacity) {
      this.pruneOldestMemory(this.shortTermMemory);
    }

    this.shortTermMemory.set(entry.id, entry);
    return entry;
  }

  /**
   * Add memory to working memory (higher priority)
   */
  addToWorking(content: string, options: {
    importance?: number;
    sourceArtifactId?: string;
    contextSummary?: string;
  } = {}): MemoryEntry {
    const entry: MemoryEntry = {
      id: uuidv4(),
      content,
      importance: options.importance || 0.7,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      sourceArtifactId: options.sourceArtifactId,
      contextSummary: options.contextSummary,
      memoryType: 'working',
      decayFactor: 0,
      createdAt: new Date().toISOString(),
    };

    // Enforce capacity limit
    if (this.workingMemory.size >= this.config.workingMemoryCapacity) {
      this.pruneLowestImportance(this.workingMemory);
    }

    this.workingMemory.set(entry.id, entry);
    return entry;
  }

  /**
   * Add artifact as memory
   */
  addFromArtifact(artifact: ThoughtArtifact): MemoryEntry {
    const importance = artifact.successful ? 0.8 : artifact.confidence;
    
    return this.addShortTerm(artifact.content, {
      importance,
      sourceArtifactId: artifact.id,
      contextSummary: artifact.problemContext,
    });
  }

  /**
   * Promote memory to long-term (Qdrant)
   */
  async promoteToLongTerm(memoryId: string): Promise<boolean> {
    // Find memory in short-term or working
    const memory = this.shortTermMemory.get(memoryId) || this.workingMemory.get(memoryId);
    if (!memory) return false;

    try {
      // Generate embedding
      const embeddingService = getEmbeddingService();
      const result = await embeddingService.embed({
        content: memory.content,
        type: 'reasoning',
      });

      // Store in Qdrant
      const collectionManager = getCollectionManager();
      const payload: HyperThinkingPayload = {
        thinking_type: 'synthesis',
        problem_domain: 'integration',
        complexity_level: 5,
        success_score: memory.importance,
        reasoning_text: memory.content,
        created_at: memory.createdAt,
      };

      await collectionManager.upsertPoints<HyperThinkingPayload>(
        COLLECTION_NAMES.HYPER_THINKING,
        [{
          id: `memory_${memoryId}`,
          vector: result.embeddings[0],
          payload,
        }]
      );

      // Update memory type
      memory.memoryType = 'long_term';
      memory.embedding = result.embeddings[0];

      // Remove from short-term/working
      this.shortTermMemory.delete(memoryId);
      this.workingMemory.delete(memoryId);

      return true;
    } catch (error) {
      console.error('[ReasoningMemory] Failed to promote to long-term:', error);
      return false;
    }
  }

  // ==========================================================================
  // Memory Retrieval
  // ==========================================================================

  /**
   * Retrieve memories relevant to a query
   */
  async retrieve(query: string, options: {
    maxResults?: number;
    includeShortTerm?: boolean;
    includeWorking?: boolean;
    includeLongTerm?: boolean;
    minImportance?: number;
  } = {}): Promise<MemoryEntry[]> {
    const {
      maxResults = this.config.maxRetrievedMemories,
      includeShortTerm = true,
      includeWorking = true,
      includeLongTerm = true,
      minImportance = 0,
    } = options;

    const results: MemoryEntry[] = [];

    // Generate query embedding
    const embeddingService = getEmbeddingService();
    const queryResult = await embeddingService.embed({
      content: query,
      type: 'reasoning',
    });
    const queryVector = queryResult.embeddings[0];

    // Search in-memory stores
    if (includeShortTerm) {
      const shortTermMatches = await this.searchInMemory(
        queryVector,
        this.shortTermMemory,
        minImportance
      );
      results.push(...shortTermMatches);
    }

    if (includeWorking) {
      const workingMatches = await this.searchInMemory(
        queryVector,
        this.workingMemory,
        minImportance
      );
      results.push(...workingMatches);
    }

    // Search Qdrant for long-term memories
    if (includeLongTerm) {
      const longTermMatches = await this.searchLongTerm(queryVector, maxResults);
      results.push(...longTermMatches);
    }

    // Sort by relevance (approximated by importance for now)
    results.sort((a, b) => b.importance - a.importance);

    // Update access counts
    const topResults = results.slice(0, maxResults);
    for (const memory of topResults) {
      this.updateAccessCount(memory.id);
    }

    return topResults;
  }

  /**
   * Search in in-memory store
   */
  private async searchInMemory(
    queryVector: number[],
    store: Map<string, MemoryEntry>,
    minImportance: number
  ): Promise<MemoryEntry[]> {
    const embeddingService = getEmbeddingService();
    const matches: Array<{ memory: MemoryEntry; score: number }> = [];

    for (const [, memory] of store) {
      if (memory.importance < minImportance) continue;

      // Generate embedding for memory if not cached
      if (!memory.embedding) {
        const result = await embeddingService.embed({
          content: memory.content,
          type: 'reasoning',
        });
        memory.embedding = result.embeddings[0];
      }

      // Calculate similarity
      const similarity = embeddingService.similarity(queryVector, memory.embedding);
      matches.push({ memory, score: similarity.similarity });
    }

    // Sort by score
    matches.sort((a, b) => b.score - a.score);

    return matches.map(m => m.memory);
  }

  /**
   * Search long-term memory in Qdrant
   */
  private async searchLongTerm(
    queryVector: number[],
    limit: number
  ): Promise<MemoryEntry[]> {
    try {
      const collectionManager = getCollectionManager();
      const results = await collectionManager.search<HyperThinkingPayload>(
        COLLECTION_NAMES.HYPER_THINKING,
        {
          vector: queryVector,
          limit,
          withPayload: true,
        }
      );

      return results.map(r => ({
        id: r.id.replace('memory_', ''),
        content: r.payload?.reasoning_text || '',
        importance: r.payload?.success_score || 0,
        accessCount: 0,
        lastAccessed: new Date().toISOString(),
        memoryType: 'long_term' as const,
        decayFactor: 0,
        createdAt: r.payload?.created_at || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[ReasoningMemory] Long-term search failed:', error);
      return [];
    }
  }

  /**
   * Update access count for memory
   */
  private updateAccessCount(memoryId: string): void {
    const memory = this.shortTermMemory.get(memoryId) || this.workingMemory.get(memoryId);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessed = new Date().toISOString();
    }
  }

  // ==========================================================================
  // Context Building
  // ==========================================================================

  /**
   * Build memory context for a query
   */
  async buildContext(query: string): Promise<MemoryContext> {
    const sessionMemories = Array.from(this.workingMemory.values());
    const relevantMemories = await this.retrieve(query);

    const allMemories = [...sessionMemories, ...relevantMemories];
    const contextTokens = allMemories.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0
    );

    return {
      sessionMemories,
      relevantMemories,
      contextTokens,
      contextLimit: this.config.contextWindowSize,
      utilization: contextTokens / this.config.contextWindowSize,
    };
  }

  // ==========================================================================
  // Memory Maintenance
  // ==========================================================================

  /**
   * Prune oldest memory from store
   */
  private pruneOldestMemory(store: Map<string, MemoryEntry>): void {
    let oldest: MemoryEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, memory] of store) {
      if (!oldest || new Date(memory.createdAt) < new Date(oldest.createdAt)) {
        oldest = memory;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      store.delete(oldestKey);
    }
  }

  /**
   * Prune lowest importance memory from store
   */
  private pruneLowestImportance(store: Map<string, MemoryEntry>): void {
    let lowest: MemoryEntry | null = null;
    let lowestKey: string | null = null;

    for (const [key, memory] of store) {
      const effectiveImportance = memory.importance * (1 - memory.decayFactor);
      if (!lowest || effectiveImportance < lowest.importance * (1 - lowest.decayFactor)) {
        lowest = memory;
        lowestKey = key;
      }
    }

    if (lowestKey) {
      store.delete(lowestKey);
    }
  }

  /**
   * Apply decay to memories
   */
  applyDecay(): void {
    const now = new Date();

    for (const [, memory] of this.shortTermMemory) {
      const hoursOld = (now.getTime() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60);
      memory.decayFactor = Math.min(1, hoursOld * this.config.decayRatePerHour);
    }
  }

  // ==========================================================================
  // Consolidation
  // ==========================================================================

  /**
   * Start automatic consolidation timer
   */
  private startConsolidationTimer(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
    }

    this.consolidationTimer = setInterval(() => {
      this.consolidate().catch(err => {
        console.error('[ReasoningMemory] Auto-consolidation failed:', err);
      });
    }, this.config.consolidationIntervalMs);
  }

  /**
   * Stop consolidation timer
   */
  stopConsolidationTimer(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = null;
    }
  }

  /**
   * Add candidate for consolidation
   */
  addConsolidationCandidate(artifact: ThoughtArtifact, successIndicators: string[]): void {
    this.consolidationCandidates.push({
      artifact,
      successIndicators,
      relatedSuccesses: [],
    });
  }

  /**
   * Run consolidation process
   */
  async consolidate(): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const result: ConsolidationResult = {
      consolidatedCount: 0,
      newSkeletons: [],
      updatedSkeletons: [],
      memoriesCreated: 0,
      processingTimeMs: 0,
    };

    // Apply decay
    this.applyDecay();

    // Promote high-importance short-term memories
    for (const [id, memory] of this.shortTermMemory) {
      if (memory.importance >= this.config.longTermPromotionThreshold) {
        const promoted = await this.promoteToLongTerm(id);
        if (promoted) {
          result.consolidatedCount++;
        }
      }
    }

    // Process consolidation candidates
    for (const candidate of this.consolidationCandidates) {
      if (candidate.artifact.successful) {
        // Create memory from successful artifact
        const memory = this.addFromArtifact(candidate.artifact);
        result.memoriesCreated++;

        // Promote if high confidence
        if (candidate.artifact.confidence >= this.config.longTermPromotionThreshold) {
          await this.promoteToLongTerm(memory.id);
          result.consolidatedCount++;
        }
      }
    }

    // Clear processed candidates
    this.consolidationCandidates = [];

    // Prune decayed memories
    this.pruneDecayedMemories();

    this.lastConsolidation = new Date();
    result.processingTimeMs = Date.now() - startTime;

    return result;
  }

  /**
   * Prune heavily decayed memories
   */
  private pruneDecayedMemories(): void {
    const decayThreshold = 0.8;

    for (const [id, memory] of this.shortTermMemory) {
      if (memory.decayFactor > decayThreshold) {
        this.shortTermMemory.delete(id);
      }
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get memory statistics
   */
  getStats(): {
    shortTermCount: number;
    workingMemoryCount: number;
    pendingConsolidation: number;
    lastConsolidation: string;
  } {
    return {
      shortTermCount: this.shortTermMemory.size,
      workingMemoryCount: this.workingMemory.size,
      pendingConsolidation: this.consolidationCandidates.length,
      lastConsolidation: this.lastConsolidation.toISOString(),
    };
  }

  /**
   * Clear all in-memory storage
   */
  clear(): void {
    this.shortTermMemory.clear();
    this.workingMemory.clear();
    this.consolidationCandidates = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReasoningMemoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup on destruction
   */
  destroy(): void {
    this.stopConsolidationTimer();
    this.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let memoryInstance: ReasoningMemory | null = null;

export function getReasoningMemory(): ReasoningMemory {
  if (!memoryInstance) {
    memoryInstance = new ReasoningMemory();
  }
  return memoryInstance;
}

export function resetReasoningMemory(): void {
  if (memoryInstance) {
    memoryInstance.destroy();
  }
  memoryInstance = null;
}

export function createReasoningMemory(
  config?: Partial<ReasoningMemoryConfig>
): ReasoningMemory {
  return new ReasoningMemory(config);
}

export default ReasoningMemory;
