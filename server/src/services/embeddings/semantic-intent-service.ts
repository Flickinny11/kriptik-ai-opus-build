/**
 * Semantic Intent Verification Service
 * 
 * VL-JEPA integration for intent lock system.
 * Provides semantic understanding and verification of user intents.
 * 
 * Features:
 * - Intent embedding generation and storage
 * - Semantic similarity matching
 * - Drift detection during builds
 * - Intent alignment verification
 * - Similar intent retrieval for learning
 */

import { getEmbeddingService, type EmbeddingService } from './embedding-service-impl.js';
import {
  getCollectionManager,
  type CollectionManager,
} from './collection-manager.js';
import { COLLECTION_NAMES, type IntentEmbeddingPayload } from './collections.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface SemanticIntent {
  /** Unique identifier */
  id: string;
  /** Original user prompt */
  originalPrompt: string;
  /** Processed intent text (cleaned, expanded) */
  intentText: string;
  /** Intent type */
  intentType: 'feature' | 'bugfix' | 'refactor' | 'enhancement' | 'migration' | 'build';
  /** Associated project ID */
  projectId: string;
  /** User ID */
  userId: string;
  /** Build intent ID (if exists) */
  buildIntentId?: string;
  /** App soul type */
  appSoul?: string;
  /** Success criteria (for alignment checking) */
  successCriteria?: string[];
  /** Embedding vector */
  embedding?: number[];
  /** When created */
  createdAt: string;
}

export interface SemanticAlignmentResult {
  /** Overall alignment score (0-1) */
  alignmentScore: number;
  /** Is the output aligned with intent? */
  isAligned: boolean;
  /** Alignment level */
  alignmentLevel: 'strong' | 'moderate' | 'weak' | 'misaligned';
  /** Specific alignment details */
  details: {
    /** Intent-output similarity */
    intentSimilarity: number;
    /** Success criteria coverage */
    criteriaCoverage: number;
    /** Drift from original intent */
    driftScore: number;
    /** Confidence in alignment */
    confidence: number;
  };
  /** Suggestions for better alignment */
  suggestions: string[];
}

export interface SemanticDriftResult {
  /** Current drift score (0-1, higher = more drift) */
  driftScore: number;
  /** Has significant drift occurred? */
  hasDrift: boolean;
  /** Drift severity */
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  /** Areas of drift */
  driftAreas: Array<{
    area: string;
    originalIntent: string;
    currentState: string;
    driftAmount: number;
  }>;
  /** When drift started (if detected) */
  driftStartedAt?: string;
}

export interface SimilarIntent {
  id: string;
  intentText: string;
  intentType: string;
  projectId: string;
  appSoul?: string;
  similarity: number;
  createdAt: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Minimum similarity for "aligned" classification */
  alignmentThreshold: 0.85,
  /** Minimum similarity for "moderately aligned" */
  moderateAlignmentThreshold: 0.7,
  /** Maximum drift before flagging */
  driftThreshold: 0.3,
  /** Severe drift threshold */
  severeDriftThreshold: 0.5,
  /** Default number of similar intents to retrieve */
  defaultSimilarLimit: 5,
};

// ============================================================================
// Semantic Intent Service
// ============================================================================

export class SemanticIntentService {
  private embeddingService: EmbeddingService;
  private collectionManager: CollectionManager;

  constructor() {
    this.embeddingService = getEmbeddingService();
    this.collectionManager = getCollectionManager();
  }

  // ============================================================================
  // Intent Storage
  // ============================================================================

  /**
   * Store a new intent with its embedding
   */
  async storeIntent(intent: Omit<SemanticIntent, 'id' | 'embedding' | 'createdAt'>): Promise<SemanticIntent> {
    const intentId = uuidv4();
    const createdAt = new Date().toISOString();
    
    // Generate embedding for the intent
    const embeddingResult = await this.embeddingService.embed({
      content: this.buildIntentText(intent),
      type: 'intent',
      projectId: intent.projectId,
      userId: intent.userId,
    });

    const embedding = embeddingResult.embeddings[0];
    
    // Store in Qdrant
    const payload: IntentEmbeddingPayload = {
      project_id: intent.projectId,
      user_id: intent.userId,
      intent_text: intent.intentText,
      intent_type: intent.intentType,
      original_text: intent.originalPrompt,
      original_prompt: intent.originalPrompt,
      app_soul: intent.appSoul,
      success_criteria: intent.successCriteria,
      build_intent_id: intent.buildIntentId,
      created_at: createdAt,
    };

    await this.collectionManager.storeIntentEmbedding(
      {
        id: intentId,
        vector: embedding,
        payload,
      },
      intent.userId // tenant_id
    );

    return {
      id: intentId,
      ...intent,
      embedding,
      createdAt,
    };
  }

  /**
   * Update an existing intent's embedding
   */
  async updateIntentEmbedding(intentId: string, userId: string): Promise<boolean> {
    const points = await this.collectionManager.getPoints<IntentEmbeddingPayload>(
      COLLECTION_NAMES.INTENT_EMBEDDINGS,
      [intentId]
    );

    if (points.length === 0) return false;

    const point = points[0];
    const intentText = point.payload.intent_text || point.payload.original_text;
    
    // Re-generate embedding
    const embeddingResult = await this.embeddingService.embed({
      content: intentText,
      type: 'intent',
      userId,
    });

    const newEmbedding = embeddingResult.embeddings[0];
    
    // Update in Qdrant
    await this.collectionManager.upsertPoints<IntentEmbeddingPayload>(
      COLLECTION_NAMES.INTENT_EMBEDDINGS,
      [{
        id: intentId,
        vector: newEmbedding,
        payload: {
          ...point.payload,
          updated_at: new Date().toISOString(),
        } as IntentEmbeddingPayload,
      }],
      userId
    );

    return true;
  }

  // ============================================================================
  // Semantic Verification
  // ============================================================================

  /**
   * Verify alignment between current output and original intent
   */
  async verifyAlignment(
    intentId: string,
    currentOutputDescription: string,
    userId: string
  ): Promise<SemanticAlignmentResult> {
    // Get the original intent
    const points = await this.collectionManager.getPoints<IntentEmbeddingPayload>(
      COLLECTION_NAMES.INTENT_EMBEDDINGS,
      [intentId],
      true // with vector
    );

    if (points.length === 0) {
      throw new Error(`Intent ${intentId} not found`);
    }

    const originalPoint = points[0];
    const originalVector = originalPoint.vector;

    // Generate embedding for current output
    const outputEmbedding = await this.embeddingService.embed({
      content: currentOutputDescription,
      type: 'intent',
      userId,
    });

    const outputVector = outputEmbedding.embeddings[0];

    // Calculate similarity
    const similarity = this.embeddingService.similarity(originalVector, outputVector, 'cosine');
    const intentSimilarity = similarity.similarity;

    // Calculate criteria coverage (if success criteria exist)
    let criteriaCoverage = 1.0;
    const successCriteria = originalPoint.payload.success_criteria;
    
    if (successCriteria && successCriteria.length > 0) {
      // Check how many criteria seem addressed in the output
      const criteriaChecks = await Promise.all(
        successCriteria.slice(0, 5).map(async (criterion: string) => {
          const criterionEmbedding = await this.embeddingService.embed({
            content: criterion,
            type: 'intent',
            userId,
          });
          const sim = this.embeddingService.similarity(
            criterionEmbedding.embeddings[0],
            outputVector,
            'cosine'
          );
          return sim.similarity >= 0.6 ? 1 : 0;
        })
      );
      criteriaCoverage = criteriaChecks.reduce((a: number, b: number) => a + b, 0) / criteriaChecks.length;
    }

    // Calculate overall alignment
    const alignmentScore = intentSimilarity * 0.6 + criteriaCoverage * 0.4;
    const driftScore = 1 - intentSimilarity;

    // Determine alignment level
    let alignmentLevel: SemanticAlignmentResult['alignmentLevel'];
    if (alignmentScore >= CONFIG.alignmentThreshold) {
      alignmentLevel = 'strong';
    } else if (alignmentScore >= CONFIG.moderateAlignmentThreshold) {
      alignmentLevel = 'moderate';
    } else if (alignmentScore >= 0.5) {
      alignmentLevel = 'weak';
    } else {
      alignmentLevel = 'misaligned';
    }

    // Generate suggestions
    const suggestions: string[] = [];
    if (intentSimilarity < 0.7) {
      suggestions.push('Output appears to diverge from original intent. Review the core purpose.');
    }
    if (criteriaCoverage < 0.7) {
      suggestions.push('Some success criteria may not be addressed. Check completion checklist.');
    }
    if (driftScore > CONFIG.driftThreshold) {
      suggestions.push('Significant drift detected. Consider realigning with original goals.');
    }

    return {
      alignmentScore,
      isAligned: alignmentLevel === 'strong' || alignmentLevel === 'moderate',
      alignmentLevel,
      details: {
        intentSimilarity,
        criteriaCoverage,
        driftScore,
        confidence: Math.min(intentSimilarity + 0.1, 1.0),
      },
      suggestions,
    };
  }

  /**
   * Detect drift from original intent
   */
  async detectDrift(
    intentId: string,
    intermediateOutputs: string[],
    userId: string
  ): Promise<SemanticDriftResult> {
    // Get original intent
    const points = await this.collectionManager.getPoints<IntentEmbeddingPayload>(
      COLLECTION_NAMES.INTENT_EMBEDDINGS,
      [intentId],
      true
    );

    if (points.length === 0) {
      throw new Error(`Intent ${intentId} not found`);
    }

    const originalVector = points[0].vector;
    const driftAreas: SemanticDriftResult['driftAreas'] = [];
    let maxDrift = 0;
    let driftStartIndex = -1;

    // Check each intermediate output for drift
    for (let i = 0; i < intermediateOutputs.length; i++) {
      const outputEmbedding = await this.embeddingService.embed({
        content: intermediateOutputs[i],
        type: 'intent',
        userId,
      });

      const similarity = this.embeddingService.similarity(
        originalVector,
        outputEmbedding.embeddings[0],
        'cosine'
      );

      const drift = 1 - similarity.similarity;
      
      if (drift > maxDrift) {
        maxDrift = drift;
        if (drift > CONFIG.driftThreshold && driftStartIndex === -1) {
          driftStartIndex = i;
        }
      }

      if (drift > CONFIG.driftThreshold) {
        const intentTextValue = points[0].payload.intent_text || points[0].payload.original_text;
        driftAreas.push({
          area: `Step ${i + 1}`,
          originalIntent: intentTextValue.substring(0, 100) + '...',
          currentState: intermediateOutputs[i].substring(0, 100) + '...',
          driftAmount: drift,
        });
      }
    }

    // Determine severity
    let severity: SemanticDriftResult['severity'];
    if (maxDrift <= CONFIG.driftThreshold * 0.5) {
      severity = 'none';
    } else if (maxDrift <= CONFIG.driftThreshold) {
      severity = 'minor';
    } else if (maxDrift <= CONFIG.severeDriftThreshold) {
      severity = 'moderate';
    } else {
      severity = 'severe';
    }

    return {
      driftScore: maxDrift,
      hasDrift: maxDrift > CONFIG.driftThreshold,
      severity,
      driftAreas,
      driftStartedAt: driftStartIndex >= 0 ? `Step ${driftStartIndex + 1}` : undefined,
    };
  }

  // ============================================================================
  // Similar Intent Search
  // ============================================================================

  /**
   * Find similar intents from history
   */
  async findSimilarIntents(
    query: string,
    options: {
      projectId?: string;
      userId?: string;
      intentType?: string;
      appSoul?: string;
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<SimilarIntent[]> {
    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.embed({
      content: query,
      type: 'intent',
      userId: options.userId,
    });

    const vector = queryEmbedding.embeddings[0];

    // Search for similar intents
    const results = await this.collectionManager.searchSimilarIntents(
      vector,
      {
        projectId: options.projectId,
        intentType: options.intentType,
        limit: options.limit || CONFIG.defaultSimilarLimit,
        minScore: options.minScore || 0.5,
        tenantId: options.userId,
      }
    );

    return results.map(r => ({
      id: String(r.id),
      intentText: r.payload?.intent_text || r.payload?.original_text || '',
      intentType: r.payload?.intent_type || 'feature',
      projectId: r.payload?.project_id || '',
      appSoul: r.payload?.app_soul,
      similarity: r.score,
      createdAt: r.payload?.created_at || '',
    }));
  }

  /**
   * Find intents related to the same project
   */
  async getProjectIntents(
    projectId: string,
    userId: string,
    limit = 20
  ): Promise<SimilarIntent[]> {
    // Get project name/description embedding to find related intents
    const results = await this.collectionManager.search<IntentEmbeddingPayload>(
      COLLECTION_NAMES.INTENT_EMBEDDINGS,
      {
        vector: new Array(1024).fill(0), // Dummy vector for filter-only search
        limit,
        filter: {
          must: [{ key: 'project_id', match: { value: projectId } }],
        },
        withPayload: true,
      },
      userId
    );

    return results.map(r => ({
      id: String(r.id),
      intentText: r.payload?.intent_text || r.payload?.original_text || '',
      intentType: r.payload?.intent_type || 'feature',
      projectId: r.payload?.project_id || '',
      appSoul: r.payload?.app_soul,
      similarity: r.score,
      createdAt: r.payload?.created_at || '',
    }));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Build comprehensive intent text for embedding
   */
  private buildIntentText(intent: Omit<SemanticIntent, 'id' | 'embedding' | 'createdAt'>): string {
    const parts = [
      intent.intentText,
      `Type: ${intent.intentType}`,
    ];

    if (intent.appSoul) {
      parts.push(`App Soul: ${intent.appSoul}`);
    }

    if (intent.successCriteria && intent.successCriteria.length > 0) {
      parts.push('Success Criteria:');
      parts.push(...intent.successCriteria.slice(0, 5).map(c => `- ${c}`));
    }

    if (intent.originalPrompt && intent.originalPrompt !== intent.intentText) {
      parts.push(`Original: ${intent.originalPrompt.substring(0, 200)}`);
    }

    return parts.join('\n');
  }

  /**
   * Get embedding for text (utility for external use)
   */
  async getEmbedding(text: string, userId?: string): Promise<number[]> {
    const result = await this.embeddingService.embed({
      content: text,
      type: 'intent',
      userId,
    });
    return result.embeddings[0];
  }

  /**
   * Calculate raw similarity between two texts
   */
  async calculateTextSimilarity(text1: string, text2: string, userId?: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.embeddingService.embed({ content: text1, type: 'intent', userId }),
      this.embeddingService.embed({ content: text2, type: 'intent', userId }),
    ]);

    const similarity = this.embeddingService.similarity(
      emb1.embeddings[0],
      emb2.embeddings[0],
      'cosine'
    );

    return similarity.similarity;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; embeddingService: boolean; collection: boolean }> {
    const embeddingHealth = await this.embeddingService.healthCheck();
    const collectionExists = await this.collectionManager.getClient().collectionExists(
      COLLECTION_NAMES.INTENT_EMBEDDINGS
    );

    return {
      healthy: embeddingHealth.healthy && collectionExists,
      embeddingService: embeddingHealth.healthy,
      collection: collectionExists,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let serviceInstance: SemanticIntentService | null = null;

export function getSemanticIntentService(): SemanticIntentService {
  if (!serviceInstance) {
    serviceInstance = new SemanticIntentService();
  }
  return serviceInstance;
}

export function resetSemanticIntentService(): void {
  serviceInstance = null;
}

export default SemanticIntentService;
