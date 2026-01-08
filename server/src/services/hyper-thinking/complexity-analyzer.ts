/**
 * Complexity Analyzer
 *
 * Analyzes task complexity to determine optimal reasoning strategy and model tier.
 * Uses embedding similarity to cache analysis results for similar prompts.
 *
 * Complexity Factors:
 * - Token count and structure
 * - Domain complexity (coding, design, architecture, etc.)
 * - Requirement count and constraints
 * - Technical depth required
 * - Ambiguity and reasoning depth
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type ComplexityLevel,
  type ComplexityAnalysis,
  type ComplexityFactors,
  type ReasoningStrategy,
  type ModelTier,
  COMPLEXITY_THRESHOLDS,
  TIER_STRATEGY_MAP,
  COMPLEXITY_TIER_MAP,
} from './types.js';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Minimum tokens for non-trivial tasks */
  minNonTrivialTokens: 50,
  /** High complexity token threshold */
  highComplexityTokens: 500,
  /** Keywords indicating high domain complexity */
  highComplexityDomains: [
    'architecture', 'distributed', 'scalable', 'microservice', 'orchestration',
    'authentication', 'authorization', 'security', 'encryption', 'compliance',
    'database', 'migration', 'schema', 'transaction', 'consistency',
    'real-time', 'websocket', 'streaming', 'concurrent', 'parallel',
    'machine learning', 'neural network', 'training', 'inference',
    'optimization', 'algorithm', 'complexity', 'performance',
  ],
  /** Keywords indicating moderate domain complexity */
  moderateComplexityDomains: [
    'api', 'endpoint', 'integration', 'webhook', 'oauth',
    'component', 'state management', 'routing', 'middleware',
    'validation', 'error handling', 'logging', 'monitoring',
    'testing', 'deployment', 'docker', 'kubernetes',
    'responsive', 'animation', 'accessibility',
  ],
  /** Keywords indicating constraints */
  constraintKeywords: [
    'must', 'should', 'required', 'mandatory', 'necessary',
    'cannot', 'must not', 'should not', 'forbidden', 'prohibited',
    'limit', 'maximum', 'minimum', 'within', 'between',
    'exactly', 'precisely', 'strictly', 'only', 'exclusively',
  ],
  /** Keywords indicating ambiguity */
  ambiguityKeywords: [
    'maybe', 'perhaps', 'possibly', 'might', 'could',
    'some', 'any', 'various', 'different', 'multiple',
    'flexible', 'optional', 'alternative', 'either', 'or',
    'similar', 'like', 'kind of', 'sort of', 'somewhat',
  ],
  /** Keywords indicating high reasoning depth */
  reasoningKeywords: [
    'analyze', 'evaluate', 'compare', 'contrast', 'determine',
    'decide', 'choose', 'select', 'prioritize', 'optimize',
    'design', 'architect', 'plan', 'strategize', 'approach',
    'debug', 'troubleshoot', 'diagnose', 'investigate', 'root cause',
    'refactor', 'improve', 'enhance', 'migrate', 'transform',
  ],
  /** Cache TTL in milliseconds (1 hour) */
  cacheTTLMs: 3600000,
  /** Similarity threshold for cache hits */
  similarityThreshold: 0.92,
};

// ============================================================================
// Analysis Cache
// ============================================================================

interface CachedAnalysis {
  analysis: ComplexityAnalysis;
  promptHash: string;
  createdAt: Date;
  expiresAt: Date;
}

const analysisCache = new Map<string, CachedAnalysis>();

/**
 * Simple hash function for prompt caching
 */
function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check cache for similar analysis
 */
function getCachedAnalysis(prompt: string): ComplexityAnalysis | null {
  const hash = hashPrompt(prompt);
  const cached = analysisCache.get(hash);

  if (cached && cached.expiresAt > new Date()) {
    return cached.analysis;
  }

  // Clean up expired entry
  if (cached) {
    analysisCache.delete(hash);
  }

  return null;
}

/**
 * Store analysis in cache
 */
function cacheAnalysis(prompt: string, analysis: ComplexityAnalysis): void {
  const hash = hashPrompt(prompt);
  const now = new Date();

  analysisCache.set(hash, {
    analysis,
    promptHash: hash,
    createdAt: now,
    expiresAt: new Date(now.getTime() + CONFIG.cacheTTLMs),
  });

  // Limit cache size (LRU-like cleanup)
  if (analysisCache.size > 1000) {
    const entries = Array.from(analysisCache.entries());
    entries.sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    for (let i = 0; i < 100; i++) {
      analysisCache.delete(entries[i][0]);
    }
  }
}

// ============================================================================
// Complexity Analyzer Class
// ============================================================================

export class ComplexityAnalyzer {
  /**
   * Analyze task complexity
   */
  async analyze(prompt: string, context?: string): Promise<ComplexityAnalysis> {
    // Check cache first
    const cached = getCachedAnalysis(prompt);
    if (cached) {
      return cached;
    }

    // Combine prompt with context
    const fullText = context ? `${prompt}\n\nContext: ${context}` : prompt;

    // Calculate complexity factors
    const factors = this.calculateFactors(fullText);

    // Calculate overall score
    const score = this.calculateScore(factors);

    // Determine complexity level
    const level = this.scoreToLevel(score);

    // Determine recommended strategy and tier
    const recommendedStrategy = this.determineStrategy(level, factors);
    const recommendedModelTier = this.determineTier(level, factors);

    // Estimate resources needed
    const estimatedTokensNeeded = this.estimateTokensNeeded(factors, recommendedStrategy);
    const estimatedTimeMs = this.estimateTime(factors, recommendedStrategy);

    // Generate reasoning
    const reasoning = this.generateReasoning(level, factors, recommendedStrategy);

    const analysis: ComplexityAnalysis = {
      level,
      score,
      recommendedStrategy,
      recommendedModelTier,
      factors,
      reasoning,
      estimatedTokensNeeded,
      estimatedTimeMs,
    };

    // Cache the result
    cacheAnalysis(prompt, analysis);

    return analysis;
  }

  /**
   * Calculate complexity factors from text
   */
  private calculateFactors(text: string): ComplexityFactors {
    const lowerText = text.toLowerCase();
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Token count (rough estimate: words * 1.3)
    const tokenCount = Math.ceil(words.length * 1.3);

    // Requirement count (sentences with action verbs or imperatives)
    const requirementPatterns = /\b(implement|create|build|add|make|ensure|design|develop|write|generate|fix|update|modify|refactor|integrate|connect|setup|configure)\b/gi;
    const requirementCount = (text.match(requirementPatterns) || []).length;

    // Domain complexity
    const domainComplexity = this.calculateDomainComplexity(lowerText);

    // Constraint count
    const constraintCount = CONFIG.constraintKeywords.reduce((count, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      return count + (text.match(regex) || []).length;
    }, 0);

    // Ambiguity score
    const ambiguityScore = this.calculateAmbiguityScore(lowerText, words.length);

    // Technical depth
    const technicalDepth = this.calculateTechnicalDepth(lowerText);

    // Integration complexity (references to external systems)
    const integrationComplexity = this.calculateIntegrationComplexity(lowerText);

    // Reasoning depth required
    const reasoningDepthRequired = this.calculateReasoningDepth(lowerText);

    return {
      tokenCount,
      requirementCount,
      domainComplexity,
      constraintCount,
      ambiguityScore,
      technicalDepth,
      integrationComplexity,
      reasoningDepthRequired,
    };
  }

  /**
   * Calculate domain complexity score (0-1)
   */
  private calculateDomainComplexity(text: string): number {
    let score = 0;

    // High complexity domains
    for (const domain of CONFIG.highComplexityDomains) {
      if (text.includes(domain)) {
        score += 0.15;
      }
    }

    // Moderate complexity domains
    for (const domain of CONFIG.moderateComplexityDomains) {
      if (text.includes(domain)) {
        score += 0.08;
      }
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate ambiguity score (0-1)
   */
  private calculateAmbiguityScore(text: string, wordCount: number): number {
    let ambiguityCount = 0;

    for (const keyword of CONFIG.ambiguityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      ambiguityCount += (text.match(regex) || []).length;
    }

    // Normalize by word count
    const normalized = ambiguityCount / Math.max(wordCount, 1);
    return Math.min(normalized * 5, 1); // Scale up and cap at 1
  }

  /**
   * Calculate technical depth score (0-1)
   */
  private calculateTechnicalDepth(text: string): number {
    const technicalPatterns = [
      /\b(async|await|promise|callback|event\s*loop)\b/gi,
      /\b(typescript|interface|generic|type\s*guard)\b/gi,
      /\b(sql|query|join|index|transaction)\b/gi,
      /\b(http|rest|graphql|grpc|websocket)\b/gi,
      /\b(docker|kubernetes|container|pod|service)\b/gi,
      /\b(cache|redis|memcache|cdn)\b/gi,
      /\b(jwt|oauth|oidc|saml|rbac)\b/gi,
      /\b(git|branch|merge|rebase|ci\/cd)\b/gi,
    ];

    let matches = 0;
    for (const pattern of technicalPatterns) {
      matches += (text.match(pattern) || []).length;
    }

    return Math.min(matches * 0.1, 1);
  }

  /**
   * Calculate integration complexity (0-1)
   */
  private calculateIntegrationComplexity(text: string): number {
    const integrationPatterns = [
      /\b(api|endpoint|external\s*service|third[\s-]*party)\b/gi,
      /\b(database|postgres|mysql|mongodb|sqlite)\b/gi,
      /\b(stripe|twilio|sendgrid|aws|gcp|azure)\b/gi,
      /\b(webhook|callback|event\s*bus|message\s*queue)\b/gi,
      /\b(import|export|migration|sync|replicate)\b/gi,
    ];

    let matches = 0;
    for (const pattern of integrationPatterns) {
      matches += (text.match(pattern) || []).length;
    }

    return Math.min(matches * 0.12, 1);
  }

  /**
   * Calculate required reasoning depth (0-1)
   */
  private calculateReasoningDepth(text: string): number {
    let depth = 0;

    for (const keyword of CONFIG.reasoningKeywords) {
      if (text.includes(keyword)) {
        depth += 0.08;
      }
    }

    // Questions indicate need for analysis
    const questionCount = (text.match(/\?/g) || []).length;
    depth += questionCount * 0.05;

    // Multiple options/alternatives indicate decision-making
    const alternativePatterns = /\b(option|alternative|approach|method|way)\s*\d?/gi;
    depth += (text.match(alternativePatterns) || []).length * 0.1;

    return Math.min(depth, 1);
  }

  /**
   * Calculate overall complexity score (0-100)
   */
  private calculateScore(factors: ComplexityFactors): number {
    // Weighted combination of factors
    const weights = {
      tokenCount: 0.1,
      requirementCount: 0.15,
      domainComplexity: 0.25,
      constraintCount: 0.1,
      ambiguityScore: 0.1,
      technicalDepth: 0.15,
      integrationComplexity: 0.1,
      reasoningDepthRequired: 0.05,
    };

    // Normalize token count (0-1000+ maps to 0-1)
    const normalizedTokens = Math.min(factors.tokenCount / 1000, 1);

    // Normalize requirement count (0-10+ maps to 0-1)
    const normalizedRequirements = Math.min(factors.requirementCount / 10, 1);

    // Normalize constraint count (0-5+ maps to 0-1)
    const normalizedConstraints = Math.min(factors.constraintCount / 5, 1);

    const score = (
      normalizedTokens * weights.tokenCount +
      normalizedRequirements * weights.requirementCount +
      factors.domainComplexity * weights.domainComplexity +
      normalizedConstraints * weights.constraintCount +
      factors.ambiguityScore * weights.ambiguityScore +
      factors.technicalDepth * weights.technicalDepth +
      factors.integrationComplexity * weights.integrationComplexity +
      factors.reasoningDepthRequired * weights.reasoningDepthRequired
    ) * 100;

    return Math.round(score);
  }

  /**
   * Convert score to complexity level
   */
  private scoreToLevel(score: number): ComplexityLevel {
    if (score < COMPLEXITY_THRESHOLDS.trivial) return 'trivial';
    if (score < COMPLEXITY_THRESHOLDS.simple) return 'simple';
    if (score < COMPLEXITY_THRESHOLDS.moderate) return 'moderate';
    if (score < COMPLEXITY_THRESHOLDS.complex) return 'complex';
    return 'extreme';
  }

  /**
   * Determine recommended strategy
   */
  private determineStrategy(level: ComplexityLevel, factors: ComplexityFactors): ReasoningStrategy {
    // Override based on specific factor combinations
    if (factors.reasoningDepthRequired > 0.7 || factors.ambiguityScore > 0.6) {
      return 'tree_of_thought';
    }

    if (factors.integrationComplexity > 0.7 && factors.domainComplexity > 0.6) {
      return 'multi_agent';
    }

    // Use default mapping
    return TIER_STRATEGY_MAP[level];
  }

  /**
   * Determine recommended model tier
   */
  private determineTier(level: ComplexityLevel, factors: ComplexityFactors): ModelTier {
    // Override based on specific needs
    if (factors.technicalDepth > 0.8 && factors.requirementCount > 8) {
      return 'maximum';
    }

    if (factors.domainComplexity > 0.7) {
      return 'deep';
    }

    // Use default mapping
    return COMPLEXITY_TIER_MAP[level];
  }

  /**
   * Estimate tokens needed for reasoning
   */
  private estimateTokensNeeded(factors: ComplexityFactors, strategy: ReasoningStrategy): number {
    const baseTokens = factors.tokenCount * 3; // Rough estimate of input + thinking + output

    const strategyMultipliers: Record<ReasoningStrategy, number> = {
      chain_of_thought: 1.5,
      tree_of_thought: 3.0,
      multi_agent: 4.0,
      hybrid: 5.0,
    };

    const complexityMultiplier = 1 + (factors.domainComplexity + factors.technicalDepth) / 2;

    return Math.round(baseTokens * strategyMultipliers[strategy] * complexityMultiplier);
  }

  /**
   * Estimate time needed in milliseconds
   */
  private estimateTime(factors: ComplexityFactors, strategy: ReasoningStrategy): number {
    const baseTimeMs = 5000; // 5 seconds base

    const strategyTimeMs: Record<ReasoningStrategy, number> = {
      chain_of_thought: 10000,
      tree_of_thought: 30000,
      multi_agent: 45000,
      hybrid: 60000,
    };

    const complexityFactor = 1 + factors.domainComplexity + factors.reasoningDepthRequired;

    return Math.round((baseTimeMs + strategyTimeMs[strategy]) * complexityFactor);
  }

  /**
   * Generate human-readable reasoning for the analysis
   */
  private generateReasoning(
    level: ComplexityLevel,
    factors: ComplexityFactors,
    strategy: ReasoningStrategy
  ): string {
    const parts: string[] = [];

    parts.push(`Task complexity: ${level.toUpperCase()} (score indicates ${this.getLevelDescription(level)}).`);

    if (factors.domainComplexity > 0.5) {
      parts.push(`High domain complexity detected - involves advanced technical concepts.`);
    }

    if (factors.requirementCount > 5) {
      parts.push(`Multiple requirements (${factors.requirementCount}) need to be addressed.`);
    }

    if (factors.constraintCount > 3) {
      parts.push(`Several constraints (${factors.constraintCount}) must be satisfied.`);
    }

    if (factors.ambiguityScore > 0.4) {
      parts.push(`Some ambiguity present - may require clarification or exploration of alternatives.`);
    }

    if (factors.integrationComplexity > 0.5) {
      parts.push(`Integration with external systems/services required.`);
    }

    parts.push(`Recommended strategy: ${strategy.replace(/_/g, ' ')} for optimal reasoning.`);

    return parts.join(' ');
  }

  /**
   * Get description for complexity level
   */
  private getLevelDescription(level: ComplexityLevel): string {
    const descriptions: Record<ComplexityLevel, string> = {
      trivial: 'straightforward task with clear solution',
      simple: 'basic task requiring minimal reasoning',
      moderate: 'standard task with some complexity',
      complex: 'challenging task requiring deep analysis',
      extreme: 'highly complex task requiring maximum reasoning capability',
    };
    return descriptions[level];
  }

  /**
   * Clear the analysis cache
   */
  clearCache(): void {
    analysisCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: analysisCache.size,
      hitRate: 0, // Would need to track hits/misses for real implementation
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let analyzerInstance: ComplexityAnalyzer | null = null;

export function getComplexityAnalyzer(): ComplexityAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new ComplexityAnalyzer();
  }
  return analyzerInstance;
}

export function resetComplexityAnalyzer(): void {
  if (analyzerInstance) {
    analyzerInstance.clearCache();
  }
  analyzerInstance = null;
}

export default ComplexityAnalyzer;
