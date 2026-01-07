/**
 * Semantic Satisfaction Verification Service
 * 
 * VL-JEPA integration for intent satisfaction checking.
 * Determines if build outputs truly satisfy the original intent.
 * 
 * Features:
 * - Success criteria embedding and matching
 * - Feature completeness scoring
 * - Workflow validation
 * - Code pattern quality assessment
 * - Semantic completion gates
 */

import { getEmbeddingService, type EmbeddingService } from './embedding-service-impl.js';
import {
  getCollectionManager,
  type CollectionManager,
} from './collection-manager.js';
import {
  COLLECTION_NAMES,
  type IntentEmbeddingPayload,
  type CodePatternPayload,
  type ErrorFixPayload,
} from './collections.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface SuccessCriterion {
  id: string;
  description: string;
  verificationMethod: 'visual' | 'functional' | 'performance' | 'code' | 'semantic';
  weight?: number;
}

export interface WorkflowStep {
  name: string;
  description: string;
  expectedOutput?: string;
}

export interface UserWorkflow {
  name: string;
  steps: WorkflowStep[];
  success: string;
}

export interface SatisfactionInput {
  /** Intent ID to verify against */
  intentId: string;
  /** Build output description */
  buildDescription: string;
  /** Generated code samples */
  codeSamples?: string[];
  /** Feature descriptions */
  features?: string[];
  /** Workflow outputs */
  workflowOutputs?: Record<string, string>;
  /** Screenshots/visual descriptions */
  visualDescriptions?: string[];
}

export interface CriterionResult {
  criterionId: string;
  description: string;
  satisfied: boolean;
  confidence: number;
  semanticScore: number;
  evidence?: string;
  reason?: string;
}

export interface WorkflowResult {
  workflowName: string;
  satisfied: boolean;
  stepsCompleted: number;
  totalSteps: number;
  completionScore: number;
  blockingIssues?: string[];
}

export interface SatisfactionResult {
  /** Overall satisfaction score (0-1) */
  overallScore: number;
  /** Is the intent satisfied? */
  isSatisfied: boolean;
  /** Satisfaction level */
  satisfactionLevel: 'complete' | 'partial' | 'minimal' | 'unsatisfied';
  /** Criteria results */
  criteriaResults: CriterionResult[];
  /** Workflow results */
  workflowResults: WorkflowResult[];
  /** Code quality score */
  codeQualityScore: number;
  /** Feature completeness */
  featureCompleteness: {
    implemented: number;
    total: number;
    percentage: number;
  };
  /** Recommendations for completion */
  recommendations: string[];
  /** Confidence in the assessment */
  confidence: number;
}

export interface CompletionGateResult {
  /** Can proceed to next phase? */
  canProceed: boolean;
  /** Gate level passed */
  gatePassed: 'none' | 'minimum' | 'acceptable' | 'excellent';
  /** Blocking issues */
  blockers: Array<{
    type: 'criterion' | 'workflow' | 'code' | 'quality';
    description: string;
    severity: 'critical' | 'major' | 'minor';
  }>;
  /** Score required for next gate */
  scoreToNextGate: number;
  /** Suggestions to pass gate */
  suggestions: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Minimum score for "satisfied" */
  satisfactionThreshold: 0.8,
  /** Minimum score for "partial" satisfaction */
  partialThreshold: 0.6,
  /** Minimum score for "minimal" satisfaction */
  minimalThreshold: 0.4,
  /** Minimum criterion confidence */
  minCriterionConfidence: 0.6,
  /** Weight for criteria in overall score */
  criteriaWeight: 0.4,
  /** Weight for workflows in overall score */
  workflowWeight: 0.3,
  /** Weight for code quality in overall score */
  codeWeight: 0.3,
  /** Gate thresholds */
  gateThresholds: {
    minimum: 0.5,
    acceptable: 0.7,
    excellent: 0.9,
  },
};

// ============================================================================
// Semantic Satisfaction Service
// ============================================================================

export class SemanticSatisfactionService {
  private embeddingService: EmbeddingService;
  private collectionManager: CollectionManager;

  constructor() {
    this.embeddingService = getEmbeddingService();
    this.collectionManager = getCollectionManager();
  }

  // ============================================================================
  // Main Satisfaction Check
  // ============================================================================

  /**
   * Check if build satisfies the original intent
   */
  async checkSatisfaction(
    input: SatisfactionInput,
    userId: string
  ): Promise<SatisfactionResult> {
    // Get original intent
    const intentPoints = await this.collectionManager.getPoints<IntentEmbeddingPayload>(
      COLLECTION_NAMES.INTENT_EMBEDDINGS,
      [input.intentId],
      true
    );

    if (intentPoints.length === 0) {
      throw new Error(`Intent ${input.intentId} not found`);
    }

    const intentPayload = intentPoints[0].payload;
    const intentVector = intentPoints[0].vector;

    // Generate embedding for build output
    const buildEmbedding = await this.embeddingService.embed({
      content: input.buildDescription,
      type: 'intent',
      userId,
    });
    const buildVector = buildEmbedding.embeddings[0];

    // Check success criteria
    const criteriaResults = await this.checkCriteria(
      intentPayload.success_criteria || [],
      input,
      userId
    );

    // Check workflows (if any stored in the intent)
    const workflowResults: WorkflowResult[] = [];
    // Note: Workflow checking would need workflow definitions stored

    // Check code quality (if code samples provided)
    let codeQualityScore = 0.8; // Default
    if (input.codeSamples && input.codeSamples.length > 0) {
      codeQualityScore = await this.assessCodeQuality(input.codeSamples, userId);
    }

    // Calculate overall semantic similarity
    const semanticSimilarity = this.embeddingService.similarity(
      intentVector,
      buildVector,
      'cosine'
    ).similarity;

    // Calculate feature completeness
    const featureCompleteness = this.calculateFeatureCompleteness(
      criteriaResults,
      input.features || []
    );

    // Calculate overall score
    const criteriaScore = criteriaResults.length > 0
      ? criteriaResults.reduce((sum, r) => sum + (r.satisfied ? r.confidence : 0), 0) / criteriaResults.length
      : semanticSimilarity;
    
    const workflowScore = workflowResults.length > 0
      ? workflowResults.reduce((sum, r) => sum + r.completionScore, 0) / workflowResults.length
      : 1.0;

    const overallScore = 
      criteriaScore * CONFIG.criteriaWeight +
      workflowScore * CONFIG.workflowWeight +
      codeQualityScore * CONFIG.codeWeight;

    // Determine satisfaction level
    let satisfactionLevel: SatisfactionResult['satisfactionLevel'];
    if (overallScore >= CONFIG.satisfactionThreshold) {
      satisfactionLevel = 'complete';
    } else if (overallScore >= CONFIG.partialThreshold) {
      satisfactionLevel = 'partial';
    } else if (overallScore >= CONFIG.minimalThreshold) {
      satisfactionLevel = 'minimal';
    } else {
      satisfactionLevel = 'unsatisfied';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      criteriaResults,
      workflowResults,
      overallScore
    );

    return {
      overallScore,
      isSatisfied: satisfactionLevel === 'complete' || satisfactionLevel === 'partial',
      satisfactionLevel,
      criteriaResults,
      workflowResults,
      codeQualityScore,
      featureCompleteness,
      recommendations,
      confidence: semanticSimilarity,
    };
  }

  // ============================================================================
  // Criteria Checking
  // ============================================================================

  /**
   * Check individual success criteria
   */
  private async checkCriteria(
    criteria: string[],
    input: SatisfactionInput,
    userId: string
  ): Promise<CriterionResult[]> {
    if (!criteria || criteria.length === 0) return [];

    const results: CriterionResult[] = [];

    // Generate embedding for build description
    const buildEmbedding = await this.embeddingService.embed({
      content: input.buildDescription,
      type: 'intent',
      userId,
    });
    const buildVector = buildEmbedding.embeddings[0];

    // Check each criterion
    for (let i = 0; i < criteria.length; i++) {
      const criterion = criteria[i];
      
      // Generate embedding for criterion
      const criterionEmbedding = await this.embeddingService.embed({
        content: criterion,
        type: 'intent',
        userId,
      });
      const criterionVector = criterionEmbedding.embeddings[0];

      // Calculate semantic similarity
      const similarity = this.embeddingService.similarity(
        criterionVector,
        buildVector,
        'cosine'
      );

      const semanticScore = similarity.similarity;
      const satisfied = semanticScore >= CONFIG.minCriterionConfidence;

      results.push({
        criterionId: `SC${(i + 1).toString().padStart(3, '0')}`,
        description: criterion,
        satisfied,
        confidence: Math.min(semanticScore + 0.1, 1.0),
        semanticScore,
        evidence: satisfied ? 'Semantic match found in build description' : undefined,
        reason: !satisfied ? 'No strong semantic match found' : undefined,
      });
    }

    return results;
  }

  // ============================================================================
  // Code Quality Assessment
  // ============================================================================

  /**
   * Assess code quality using pattern matching
   */
  private async assessCodeQuality(
    codeSamples: string[],
    userId: string
  ): Promise<number> {
    if (codeSamples.length === 0) return 0.8;

    let totalScore = 0;
    let count = 0;

    for (const code of codeSamples.slice(0, 5)) { // Limit to 5 samples
      // Generate code embedding
      const codeEmbedding = await this.embeddingService.embed({
        content: code,
        type: 'code',
        userId,
      });

      // Search for similar good patterns
      const patterns = await this.collectionManager.searchSimilarCode(
        codeEmbedding.embeddings[0],
        {
          patternType: 'good_practice',
          limit: 3,
          minScore: 0.6,
          tenantId: userId,
        }
      );

      // Higher similarity to good patterns = higher quality
      if (patterns.length > 0) {
        const avgSimilarity = patterns.reduce((sum, p) => sum + p.score, 0) / patterns.length;
        totalScore += avgSimilarity;
      } else {
        totalScore += 0.5; // Default if no patterns found
      }
      count++;
    }

    return count > 0 ? totalScore / count : 0.8;
  }

  // ============================================================================
  // Feature Completeness
  // ============================================================================

  /**
   * Calculate feature completeness
   */
  private calculateFeatureCompleteness(
    criteriaResults: CriterionResult[],
    features: string[]
  ): { implemented: number; total: number; percentage: number } {
    const satisfiedCriteria = criteriaResults.filter(r => r.satisfied).length;
    const totalCriteria = criteriaResults.length || features.length || 1;
    const implemented = satisfiedCriteria || features.length;
    
    return {
      implemented,
      total: totalCriteria,
      percentage: (implemented / totalCriteria) * 100,
    };
  }

  // ============================================================================
  // Completion Gates
  // ============================================================================

  /**
   * Evaluate completion gate for phase transition
   */
  async evaluateCompletionGate(
    input: SatisfactionInput,
    requiredGate: 'minimum' | 'acceptable' | 'excellent',
    userId: string
  ): Promise<CompletionGateResult> {
    const satisfaction = await this.checkSatisfaction(input, userId);
    const requiredScore = CONFIG.gateThresholds[requiredGate];

    const blockers: CompletionGateResult['blockers'] = [];

    // Check for critical failures
    const criticalFailures = satisfaction.criteriaResults.filter(
      r => !r.satisfied && r.semanticScore < 0.3
    );

    for (const failure of criticalFailures) {
      blockers.push({
        type: 'criterion',
        description: `Critical criterion not met: ${failure.description}`,
        severity: 'critical',
      });
    }

    // Check for major issues
    if (satisfaction.codeQualityScore < 0.5) {
      blockers.push({
        type: 'code',
        description: 'Code quality is below acceptable threshold',
        severity: 'major',
      });
    }

    if (satisfaction.featureCompleteness.percentage < 50) {
      blockers.push({
        type: 'quality',
        description: 'Less than 50% of features implemented',
        severity: 'major',
      });
    }

    // Determine gate passed
    let gatePassed: CompletionGateResult['gatePassed'] = 'none';
    if (satisfaction.overallScore >= CONFIG.gateThresholds.excellent) {
      gatePassed = 'excellent';
    } else if (satisfaction.overallScore >= CONFIG.gateThresholds.acceptable) {
      gatePassed = 'acceptable';
    } else if (satisfaction.overallScore >= CONFIG.gateThresholds.minimum) {
      gatePassed = 'minimum';
    }

    const canProceed = satisfaction.overallScore >= requiredScore && 
                       blockers.filter(b => b.severity === 'critical').length === 0;

    // Calculate score needed for next gate
    const scoreToNextGate = Math.max(0, requiredScore - satisfaction.overallScore);

    // Generate suggestions
    const suggestions = this.generateGateSuggestions(
      satisfaction,
      blockers,
      scoreToNextGate
    );

    return {
      canProceed,
      gatePassed,
      blockers,
      scoreToNextGate,
      suggestions,
    };
  }

  // ============================================================================
  // Error Pattern Learning
  // ============================================================================

  /**
   * Store an error fix pattern for future learning
   */
  async storeErrorFix(
    errorPattern: {
      errorMessage: string;
      errorType: string;
      errorCode?: string;
      fixDescription: string;
      fixCode?: string;
      context: string;
    },
    userId: string
  ): Promise<string> {
    const fixId = uuidv4();
    
    // Generate embedding for error context
    const errorContext = `${errorPattern.errorType}: ${errorPattern.errorMessage}\nContext: ${errorPattern.context}`;
    const embedding = await this.embeddingService.embed({
      content: errorContext,
      type: 'error',
      userId,
    });

    const payload: ErrorFixPayload = {
      error_type: errorPattern.errorType,
      error_message: errorPattern.errorMessage,
      error_code: errorPattern.errorCode,
      fix_description: errorPattern.fixDescription,
      fix_code: errorPattern.fixCode,
      context: errorPattern.context,
      times_used: 0,
      success_rate: 0,
      created_at: new Date().toISOString(),
    };

    await this.collectionManager.storeErrorFix({
      id: fixId,
      vector: embedding.embeddings[0],
      payload,
    });

    return fixId;
  }

  /**
   * Find similar error fixes
   */
  async findSimilarErrors(
    errorMessage: string,
    errorType: string,
    context: string,
    userId: string,
    limit = 5
  ): Promise<Array<{ id: string; fix: string; similarity: number; successRate: number }>> {
    const errorContext = `${errorType}: ${errorMessage}\nContext: ${context}`;
    const embedding = await this.embeddingService.embed({
      content: errorContext,
      type: 'error',
      userId,
    });

    const results = await this.collectionManager.searchSimilarErrorFixes(
      embedding.embeddings[0],
      {
        errorType,
        limit,
        minScore: 0.5,
      }
    );

    return results.map(r => ({
      id: String(r.id),
      fix: r.payload?.fix_description || '',
      similarity: r.score,
      successRate: r.payload?.success_rate || 0,
    }));
  }

  // ============================================================================
  // Store Code Pattern
  // ============================================================================

  /**
   * Store a good code pattern for quality assessment
   */
  async storeCodePattern(
    pattern: {
      code: string;
      patternType: 'good_practice' | 'anti_pattern' | 'common' | 'framework';
      language: string;
      framework?: string;
      description: string;
    },
    projectId: string,
    userId: string
  ): Promise<string> {
    const patternId = uuidv4();
    
    const embedding = await this.embeddingService.embed({
      content: pattern.code,
      type: 'code',
      userId,
    });

    const payload: CodePatternPayload = {
      project_id: projectId,
      pattern_type: pattern.patternType,
      language: pattern.language,
      framework: pattern.framework,
      code_snippet: pattern.code,
      description: pattern.description,
      quality_score: pattern.patternType === 'good_practice' ? 0.9 : 0.3,
      times_matched: 0,
      created_at: new Date().toISOString(),
    };

    await this.collectionManager.storeCodePattern({
      id: patternId,
      vector: embedding.embeddings[0],
      payload,
    }, userId);

    return patternId;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(
    criteriaResults: CriterionResult[],
    workflowResults: WorkflowResult[],
    overallScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Check failed criteria
    const failedCriteria = criteriaResults.filter(r => !r.satisfied);
    for (const failed of failedCriteria.slice(0, 3)) {
      recommendations.push(`Address criterion: ${failed.description}`);
    }

    // Check incomplete workflows
    for (const workflow of workflowResults) {
      if (workflow.completionScore < 0.8) {
        recommendations.push(`Complete workflow "${workflow.workflowName}" (${Math.round(workflow.completionScore * 100)}% done)`);
      }
    }

    // General recommendations based on score
    if (overallScore < CONFIG.satisfactionThreshold) {
      recommendations.push('Review original intent and ensure all core features are implemented');
    }

    if (overallScore < CONFIG.partialThreshold) {
      recommendations.push('Consider breaking down remaining work into smaller tasks');
    }

    return recommendations;
  }

  /**
   * Generate gate suggestions
   */
  private generateGateSuggestions(
    satisfaction: SatisfactionResult,
    blockers: CompletionGateResult['blockers'],
    scoreNeeded: number
  ): string[] {
    const suggestions: string[] = [];

    // Address critical blockers first
    const criticalBlockers = blockers.filter(b => b.severity === 'critical');
    for (const blocker of criticalBlockers) {
      suggestions.push(`CRITICAL: ${blocker.description}`);
    }

    // Address major blockers
    const majorBlockers = blockers.filter(b => b.severity === 'major');
    for (const blocker of majorBlockers.slice(0, 2)) {
      suggestions.push(`FIX: ${blocker.description}`);
    }

    // Score-based suggestions
    if (scoreNeeded > 0) {
      suggestions.push(`Improve overall score by ${(scoreNeeded * 100).toFixed(1)}% to pass gate`);
    }

    // Add from satisfaction recommendations
    suggestions.push(...satisfaction.recommendations.slice(0, 2));

    return suggestions;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; services: Record<string, boolean> }> {
    const embeddingHealth = await this.embeddingService.healthCheck();
    const intentCollection = await this.collectionManager.getClient().collectionExists(
      COLLECTION_NAMES.INTENT_EMBEDDINGS
    );
    const codeCollection = await this.collectionManager.getClient().collectionExists(
      COLLECTION_NAMES.CODE_PATTERNS
    );
    const errorCollection = await this.collectionManager.getClient().collectionExists(
      COLLECTION_NAMES.ERROR_FIXES
    );

    return {
      healthy: embeddingHealth.healthy && intentCollection && codeCollection,
      services: {
        embedding: embeddingHealth.healthy,
        intentCollection,
        codeCollection,
        errorCollection,
      },
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let serviceInstance: SemanticSatisfactionService | null = null;

export function getSemanticSatisfactionService(): SemanticSatisfactionService {
  if (!serviceInstance) {
    serviceInstance = new SemanticSatisfactionService();
  }
  return serviceInstance;
}

export function resetSemanticSatisfactionService(): void {
  serviceInstance = null;
}

export default SemanticSatisfactionService;
