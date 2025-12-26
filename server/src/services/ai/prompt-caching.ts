/**
 * Prompt Caching System
 *
 * Implements Anthropic's prompt caching for 50% token discount and 80% latency reduction.
 *
 * Features:
 * - Automatic cache_control injection for static context
 * - Tiered caching strategy (Intent > Architecture > Rules)
 * - Cache hit/miss analytics
 * - TTL-based cache management (5 min for ephemeral)
 *
 * @see https://www.prompthub.us/blog/prompt-caching-with-openai-anthropic-and-google-models
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// ============================================
// TYPES
// ============================================

export interface CacheableContent {
  id: string;
  content: string;
  priority: CachePriority;
  type: CacheContentType;
  minTokens: number;      // Minimum tokens to be cacheable (1024 for most, 2048 for Haiku)
  estimatedTokens: number;
  hash: string;
  lastCached?: number;
}

export type CachePriority = 'critical' | 'high' | 'medium' | 'low';

export type CacheContentType =
  | 'intent_contract'
  | 'system_prompt'
  | 'architecture'
  | 'anti_slop_rules'
  | 'tool_definitions'
  | 'project_context'
  | 'session_context';

export interface CacheStrategy {
  maxBreakpoints: number;       // Claude supports up to 4 cache breakpoints
  priorityOrder: CachePriority[];
  minTokensPerBreakpoint: number;
  ttlMs: number;                // 5 minutes default
}

export interface CacheMetrics {
  cacheCreationTokens: number;
  cacheReadTokens: number;
  uncachedTokens: number;
  cacheHitRate: number;
  estimatedSavings: number;     // In dollars
  latencyReduction: number;     // Percentage
}

export interface CachedSystemPrompt {
  blocks: Array<{
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
  }>;
  totalTokens: number;
  cachedTokens: number;
  breakpointCount: number;
}

// ============================================
// PROMPT CACHE MANAGER
// ============================================

export class PromptCacheManager extends EventEmitter {
  private cacheableContents: Map<string, CacheableContent> = new Map();
  private metrics: CacheMetrics = {
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    uncachedTokens: 0,
    cacheHitRate: 0,
    estimatedSavings: 0,
    latencyReduction: 0,
  };
  private strategy: CacheStrategy;

  constructor(strategy?: Partial<CacheStrategy>) {
    super();

    this.strategy = {
      maxBreakpoints: 4,
      priorityOrder: ['critical', 'high', 'medium', 'low'],
      minTokensPerBreakpoint: 1024,
      ttlMs: 5 * 60 * 1000, // 5 minutes
      ...strategy,
    };
  }

  // ============================================
  // CONTENT REGISTRATION
  // ============================================

  registerContent(
    id: string,
    content: string,
    type: CacheContentType,
    priority: CachePriority = 'medium'
  ): CacheableContent {
    const estimatedTokens = this.estimateTokens(content);
    const minTokens = this.getMinTokensForType(type);

    const cacheableContent: CacheableContent = {
      id,
      content,
      priority,
      type,
      minTokens,
      estimatedTokens,
      hash: this.hashContent(content),
    };

    this.cacheableContents.set(id, cacheableContent);
    this.emit('content_registered', { id, type, estimatedTokens });

    return cacheableContent;
  }

  updateContent(id: string, newContent: string): boolean {
    const existing = this.cacheableContents.get(id);
    if (!existing) {
      return false;
    }

    const newHash = this.hashContent(newContent);
    if (newHash === existing.hash) {
      return false; // No change
    }

    existing.content = newContent;
    existing.hash = newHash;
    existing.estimatedTokens = this.estimateTokens(newContent);
    existing.lastCached = undefined; // Invalidate cache

    this.emit('content_updated', { id, previousHash: existing.hash, newHash });
    return true;
  }

  // ============================================
  // KRIPTIK STANDARD CONTENTS
  // Pre-register common cacheable contents
  // ============================================

  registerKriptikDefaults(context: {
    intentContract?: string;
    antiSlopRules?: string;
    architectureGuide?: string;
    projectContext?: string;
  }): void {
    if (context.intentContract) {
      this.registerContent(
        'intent_contract',
        context.intentContract,
        'intent_contract',
        'critical'
      );
    }

    if (context.antiSlopRules) {
      this.registerContent(
        'anti_slop_rules',
        context.antiSlopRules,
        'anti_slop_rules',
        'high'
      );
    }

    if (context.architectureGuide) {
      this.registerContent(
        'architecture_guide',
        context.architectureGuide,
        'architecture',
        'high'
      );
    }

    if (context.projectContext) {
      this.registerContent(
        'project_context',
        context.projectContext,
        'project_context',
        'medium'
      );
    }
  }

  // ============================================
  // CACHED SYSTEM PROMPT GENERATION
  // ============================================

  buildCachedSystemPrompt(
    contentIds?: string[]
  ): CachedSystemPrompt {
    // Get contents to cache
    let contents: CacheableContent[];

    if (contentIds) {
      contents = contentIds
        .map(id => this.cacheableContents.get(id))
        .filter((c): c is CacheableContent => c !== undefined);
    } else {
      contents = [...this.cacheableContents.values()];
    }

    // Sort by priority
    contents.sort((a, b) => {
      const priorityOrder = this.strategy.priorityOrder;
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    // Build blocks with cache_control
    const blocks: CachedSystemPrompt['blocks'] = [];
    let totalTokens = 0;
    let cachedTokens = 0;
    let breakpointCount = 0;

    for (const content of contents) {
      const shouldCache =
        content.estimatedTokens >= content.minTokens &&
        breakpointCount < this.strategy.maxBreakpoints;

      const block: CachedSystemPrompt['blocks'][0] = {
        type: 'text',
        text: content.content,
      };

      if (shouldCache) {
        block.cache_control = { type: 'ephemeral' };
        cachedTokens += content.estimatedTokens;
        breakpointCount++;
        content.lastCached = Date.now();
      }

      blocks.push(block);
      totalTokens += content.estimatedTokens;
    }

    this.emit('system_prompt_built', { totalTokens, cachedTokens, breakpointCount });

    return {
      blocks,
      totalTokens,
      cachedTokens,
      breakpointCount,
    };
  }

  // ============================================
  // API REQUEST HELPERS
  // ============================================

  createAnthropicSystemParam(
    cachedPrompt: CachedSystemPrompt
  ): Anthropic.MessageCreateParams['system'] {
    return cachedPrompt.blocks;
  }

  wrapWithCacheHeaders(
    request: Anthropic.MessageCreateParams
  ): Anthropic.MessageCreateParams {
    // The anthropic-beta header is needed for prompt caching
    // This is typically set at the client level
    return request;
  }

  // ============================================
  // METRICS TRACKING
  // ============================================

  updateMetricsFromResponse(usage: {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    input_tokens: number;
  }): void {
    if (usage.cache_creation_input_tokens) {
      this.metrics.cacheCreationTokens += usage.cache_creation_input_tokens;
    }

    if (usage.cache_read_input_tokens) {
      this.metrics.cacheReadTokens += usage.cache_read_input_tokens;
    }

    const uncached = usage.input_tokens -
      (usage.cache_creation_input_tokens || 0) -
      (usage.cache_read_input_tokens || 0);
    this.metrics.uncachedTokens += uncached;

    // Calculate hit rate
    const totalCacheableTokens = this.metrics.cacheCreationTokens + this.metrics.cacheReadTokens;
    if (totalCacheableTokens > 0) {
      this.metrics.cacheHitRate = this.metrics.cacheReadTokens / totalCacheableTokens;
    }

    // Estimate savings (50% discount on cached reads)
    const cacheReadSavings = this.metrics.cacheReadTokens * 0.5;
    // Rough estimate: $0.003 per 1K tokens for Claude Sonnet
    this.metrics.estimatedSavings = (cacheReadSavings / 1000) * 0.003;

    // Estimate latency reduction (up to 80% for cached content)
    this.metrics.latencyReduction = this.metrics.cacheHitRate * 0.8;

    this.emit('metrics_updated', this.metrics);
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      uncachedTokens: 0,
      cacheHitRate: 0,
      estimatedSavings: 0,
      latencyReduction: 0,
    };
  }

  // ============================================
  // OPTIMIZATION SUGGESTIONS
  // ============================================

  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];

    // Check for underutilized cache breakpoints
    const usedBreakpoints = [...this.cacheableContents.values()]
      .filter(c => c.lastCached !== undefined).length;

    if (usedBreakpoints < this.strategy.maxBreakpoints) {
      suggestions.push(
        `You're using ${usedBreakpoints}/${this.strategy.maxBreakpoints} cache breakpoints. ` +
        `Consider adding more static content to utilize all breakpoints.`
      );
    }

    // Check for contents below minimum threshold
    const belowThreshold = [...this.cacheableContents.values()]
      .filter(c => c.estimatedTokens < c.minTokens);

    if (belowThreshold.length > 0) {
      suggestions.push(
        `${belowThreshold.length} content blocks are below the minimum token threshold for caching. ` +
        `Consider combining small blocks or expanding their content.`
      );
    }

    // Check cache hit rate
    if (this.metrics.cacheHitRate < 0.5 && this.metrics.cacheCreationTokens > 0) {
      suggestions.push(
        `Cache hit rate is ${(this.metrics.cacheHitRate * 100).toFixed(1)}%. ` +
        `Consider stabilizing your system prompts to improve cache reuse.`
      );
    }

    // Check for stale caches
    const now = Date.now();
    const staleCaches = [...this.cacheableContents.values()]
      .filter(c => c.lastCached && (now - c.lastCached > this.strategy.ttlMs));

    if (staleCaches.length > 0) {
      suggestions.push(
        `${staleCaches.length} cached contents have expired. ` +
        `They will be re-cached on next use.`
      );
    }

    return suggestions;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private estimateTokens(content: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(content.length / 4);
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private getMinTokensForType(type: CacheContentType): number {
    // Different models have different minimums
    // Using 1024 as default (Claude 3.5 Sonnet, Opus)
    // Haiku requires 2048
    const minimums: Record<CacheContentType, number> = {
      intent_contract: 1024,
      system_prompt: 1024,
      architecture: 1024,
      anti_slop_rules: 1024,
      tool_definitions: 1024,
      project_context: 1024,
      session_context: 1024,
    };

    return minimums[type] || 1024;
  }

  // ============================================
  // CACHE INVALIDATION
  // ============================================

  invalidateContent(id: string): boolean {
    const content = this.cacheableContents.get(id);
    if (!content) {
      return false;
    }

    content.lastCached = undefined;
    this.emit('cache_invalidated', { id });
    return true;
  }

  invalidateAll(): void {
    for (const content of this.cacheableContents.values()) {
      content.lastCached = undefined;
    }
    this.emit('all_caches_invalidated');
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  exportState(): {
    contents: Array<{ id: string; hash: string; lastCached?: number }>;
    metrics: CacheMetrics;
  } {
    return {
      contents: [...this.cacheableContents.values()].map(c => ({
        id: c.id,
        hash: c.hash,
        lastCached: c.lastCached,
      })),
      metrics: this.metrics,
    };
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export function createKriptikCachedPrompt(context: {
  intentContract: string;
  antiSlopRules: string;
  architectureGuide: string;
  currentTask: string;
}): CachedSystemPrompt {
  const manager = new PromptCacheManager();

  manager.registerKriptikDefaults({
    intentContract: context.intentContract,
    antiSlopRules: context.antiSlopRules,
    architectureGuide: context.architectureGuide,
  });

  // Task is not cached (changes frequently)
  manager.registerContent(
    'current_task',
    context.currentTask,
    'session_context',
    'low'
  );

  return manager.buildCachedSystemPrompt();
}

// Export singleton
let promptCacheManagerInstance: PromptCacheManager | null = null;

export function getPromptCacheManager(): PromptCacheManager {
  if (!promptCacheManagerInstance) {
    promptCacheManagerInstance = new PromptCacheManager();
  }
  return promptCacheManagerInstance;
}

export default PromptCacheManager;
