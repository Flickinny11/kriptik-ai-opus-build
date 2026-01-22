/**
 * Visual Intent Lock
 *
 * Captures and locks the user's visual intent at the start of a build.
 * Combines VL-JEPA embeddings with LLM semantic descriptions to create
 * a comprehensive specification that the build must match.
 *
 * Components:
 * - Embedding: 1024-dim VL-JEPA visual-language joint embedding
 * - Semantic Description: What the design shows (LLM-generated)
 * - Why Explanations: Design rationale for each major element
 * - Checklist: Concrete verification criteria
 */

// ============================================================================
// Types
// ============================================================================

export interface ComponentBreakdown {
  /** Component name */
  name: string;
  /** Component description */
  description: string;
  /** Importance level */
  importance: 'critical' | 'high' | 'medium' | 'low';
  /** Visual characteristics */
  visualTraits: string[];
  /** Expected behavior */
  behavior?: string;
  /** CSS/styling hints */
  styleHints?: string;
}

export interface DesignRationale {
  /** Element or aspect being explained */
  element: string;
  /** Why this design choice was made */
  why: string;
  /** What should be preserved */
  mustPreserve: string[];
  /** What can be adapted */
  canAdapt?: string[];
}

export interface ChecklistItem {
  /** Unique ID for the item */
  id: string;
  /** Description of what to verify */
  description: string;
  /** Category */
  category: 'layout' | 'style' | 'component' | 'interaction' | 'content' | 'animation';
  /** Priority */
  priority: 'must' | 'should' | 'could';
  /** Verification status */
  status: 'pending' | 'verified' | 'failed' | 'partial';
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence or notes */
  evidence?: string;
}

export interface VisualIntentLock {
  /** Unique identifier */
  id: string;
  /** Project ID this lock belongs to */
  projectId: string;
  /** Build ID if created during a build */
  buildId?: string;

  // === VL-JEPA Stream ===
  /** Combined visual-language embedding (1024-dim) */
  embedding: number[];
  /** Separate image embedding (if available) */
  imageEmbedding?: number[];
  /** Separate text embedding (if available) */
  textEmbedding?: number[];

  // === LLM Semantic Stream ===
  /** What the design shows - descriptive summary */
  what: string;
  /** Why explanations - rationale for design choices */
  why: Record<string, DesignRationale>;
  /** Component breakdown */
  components: ComponentBreakdown[];
  /** Overall design rationale */
  designRationale: string;

  // === Verification Checklist ===
  /** Concrete verification criteria */
  checklist: ChecklistItem[];

  // === Source Media ===
  /** Type of source media */
  sourceType: 'image' | 'video' | 'multiple' | 'text';
  /** URL or reference to source media */
  sourceRef?: string;
  /** Tags assigned by user (@design1, etc.) */
  tags: string[];

  // === Metadata ===
  /** Creation timestamp */
  createdAt: Date;
  /** Last verification timestamp */
  lastVerifiedAt?: Date;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Lock version for updates */
  version: number;
}

export interface VerificationResult {
  /** Does the implementation match the intent? */
  matches: boolean;
  /** Overall similarity score (0-1) */
  similarity: number;
  /** Embedding similarity (cosine distance) */
  embeddingSimilarity: number;
  /** Semantic match score (0-1) */
  semanticMatch: number;
  /** Checklist completion (0-1) */
  checklistCompletion: number;
  /** Items that passed */
  passedItems: string[];
  /** Items that failed */
  failedItems: string[];
  /** Items partially matched */
  partialItems: string[];
  /** Specific deviations found */
  deviations: Array<{
    aspect: string;
    expected: string;
    actual: string;
    severity: 'minor' | 'moderate' | 'severe';
  }>;
  /** Suggestions for fixing */
  suggestions: string[];
}

export interface DeviationReport {
  /** Overall deviation score (0 = exact match, 1 = completely different) */
  deviationScore: number;
  /** Is this deviation acceptable? */
  acceptable: boolean;
  /** Embedding deviation */
  embeddingDeviation: number;
  /** Areas of deviation */
  areas: Array<{
    area: string;
    deviation: number;
    description: string;
  }>;
  /** Trajectory direction (toward or away from intent) */
  trajectoryDirection: 'toward' | 'away' | 'stable';
}

// ============================================================================
// VisualIntentLock Class
// ============================================================================

export class VisualIntentLockManager {
  private locks: Map<string, VisualIntentLock> = new Map();

  /**
   * Create a new VisualIntentLock from analysis results
   */
  createLock(params: {
    projectId: string;
    buildId?: string;
    embedding: number[];
    imageEmbedding?: number[];
    textEmbedding?: number[];
    what: string;
    why: Record<string, DesignRationale>;
    components: ComponentBreakdown[];
    designRationale: string;
    sourceType: VisualIntentLock['sourceType'];
    sourceRef?: string;
    tags?: string[];
  }): VisualIntentLock {
    const id = `vil_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Generate checklist from components and rationale
    const checklist = this.generateChecklist(params.components, params.why);

    const lock: VisualIntentLock = {
      id,
      projectId: params.projectId,
      buildId: params.buildId,
      embedding: params.embedding,
      imageEmbedding: params.imageEmbedding,
      textEmbedding: params.textEmbedding,
      what: params.what,
      why: params.why,
      components: params.components,
      designRationale: params.designRationale,
      checklist,
      sourceType: params.sourceType,
      sourceRef: params.sourceRef,
      tags: params.tags || [],
      createdAt: new Date(),
      confidence: this.calculateInitialConfidence(params.embedding),
      version: 1,
    };

    this.locks.set(id, lock);
    return lock;
  }

  /**
   * Verify a screenshot against the lock
   */
  async verify(
    lockId: string,
    screenshotEmbedding: number[],
    screenshotDescription: string
  ): Promise<VerificationResult> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      throw new Error(`VisualIntentLock not found: ${lockId}`);
    }

    // Calculate embedding similarity (cosine)
    const embeddingSimilarity = this.cosineSimilarity(lock.embedding, screenshotEmbedding);

    // Calculate semantic match (simplified - in production use LLM)
    const semanticMatch = this.calculateSemanticMatch(lock.what, screenshotDescription);

    // Evaluate checklist
    const checklistResults = this.evaluateChecklist(lock.checklist, screenshotDescription);

    // Determine if it matches (threshold: 0.85 for embedding, 0.7 for semantic)
    const matches = embeddingSimilarity >= 0.85 && semanticMatch >= 0.7 && checklistResults.completion >= 0.9;

    // Find deviations
    const deviations = this.findDeviations(lock, screenshotEmbedding, screenshotDescription);

    // Generate suggestions if not matching
    const suggestions = matches ? [] : this.generateSuggestions(deviations);

    // Update lock verification timestamp
    lock.lastVerifiedAt = new Date();

    return {
      matches,
      similarity: (embeddingSimilarity * 0.5 + semanticMatch * 0.3 + checklistResults.completion * 0.2),
      embeddingSimilarity,
      semanticMatch,
      checklistCompletion: checklistResults.completion,
      passedItems: checklistResults.passed,
      failedItems: checklistResults.failed,
      partialItems: checklistResults.partial,
      deviations,
      suggestions,
    };
  }

  /**
   * Get deviation from intent
   */
  getDeviation(lockId: string, currentEmbedding: number[]): DeviationReport {
    const lock = this.locks.get(lockId);
    if (!lock) {
      throw new Error(`VisualIntentLock not found: ${lockId}`);
    }

    const embeddingDeviation = 1 - this.cosineSimilarity(lock.embedding, currentEmbedding);

    // Analyze component areas (simplified - compare embedding segments)
    const areas = this.analyzeDeviationAreas(lock, currentEmbedding);

    return {
      deviationScore: embeddingDeviation,
      acceptable: embeddingDeviation < 0.15,
      embeddingDeviation,
      areas,
      trajectoryDirection: embeddingDeviation < 0.1 ? 'stable' : embeddingDeviation < 0.2 ? 'toward' : 'away',
    };
  }

  /**
   * Update checklist status
   */
  updateChecklist(lockId: string, itemId: string, status: ChecklistItem['status'], evidence?: string): void {
    const lock = this.locks.get(lockId);
    if (!lock) {
      throw new Error(`VisualIntentLock not found: ${lockId}`);
    }

    const item = lock.checklist.find(c => c.id === itemId);
    if (item) {
      item.status = status;
      if (evidence) {
        item.evidence = evidence;
      }
      lock.version++;
    }
  }

  /**
   * Get a lock by ID
   */
  getLock(lockId: string): VisualIntentLock | undefined {
    return this.locks.get(lockId);
  }

  /**
   * Get all locks for a project
   */
  getProjectLocks(projectId: string): VisualIntentLock[] {
    return Array.from(this.locks.values()).filter(l => l.projectId === projectId);
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private generateChecklist(
    components: ComponentBreakdown[],
    why: Record<string, DesignRationale>
  ): ChecklistItem[] {
    const checklist: ChecklistItem[] = [];
    let idCounter = 0;

    // Add items for critical components
    for (const comp of components) {
      if (comp.importance === 'critical' || comp.importance === 'high') {
        checklist.push({
          id: `check_${++idCounter}`,
          description: `${comp.name}: ${comp.description}`,
          category: 'component',
          priority: comp.importance === 'critical' ? 'must' : 'should',
          status: 'pending',
          confidence: 0,
        });

        // Add visual traits as separate items
        for (const trait of comp.visualTraits.slice(0, 2)) {
          checklist.push({
            id: `check_${++idCounter}`,
            description: `${comp.name} has ${trait}`,
            category: 'style',
            priority: 'should',
            status: 'pending',
            confidence: 0,
          });
        }
      }
    }

    // Add items from WHY rationale
    for (const [element, rationale] of Object.entries(why)) {
      for (const preserve of rationale.mustPreserve.slice(0, 2)) {
        checklist.push({
          id: `check_${++idCounter}`,
          description: `${element}: ${preserve}`,
          category: this.categorizeMustPreserve(preserve),
          priority: 'must',
          status: 'pending',
          confidence: 0,
        });
      }
    }

    return checklist;
  }

  private categorizeMustPreserve(item: string): ChecklistItem['category'] {
    const lower = item.toLowerCase();
    if (lower.includes('layout') || lower.includes('grid') || lower.includes('position')) return 'layout';
    if (lower.includes('color') || lower.includes('font') || lower.includes('style')) return 'style';
    if (lower.includes('animation') || lower.includes('transition')) return 'animation';
    if (lower.includes('click') || lower.includes('hover') || lower.includes('interact')) return 'interaction';
    if (lower.includes('text') || lower.includes('content')) return 'content';
    return 'component';
  }

  private calculateInitialConfidence(embedding: number[]): number {
    // Confidence based on embedding quality
    if (!embedding || embedding.length === 0) return 0;
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    // Normalized embeddings should have magnitude close to 1
    return Math.min(1, Math.max(0, 0.5 + magnitude * 0.5));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  private calculateSemanticMatch(expected: string, actual: string): number {
    // Simplified semantic matching - in production, use LLM
    const expectedWords = new Set(expected.toLowerCase().split(/\s+/));
    const actualWords = new Set(actual.toLowerCase().split(/\s+/));

    const intersection = [...expectedWords].filter(w => actualWords.has(w));
    const union = new Set([...expectedWords, ...actualWords]);

    return intersection.length / union.size;
  }

  private evaluateChecklist(
    checklist: ChecklistItem[],
    description: string
  ): { completion: number; passed: string[]; failed: string[]; partial: string[] } {
    const passed: string[] = [];
    const failed: string[] = [];
    const partial: string[] = [];
    const descLower = description.toLowerCase();

    for (const item of checklist) {
      // Simple keyword matching - in production, use LLM
      const keywords = item.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchedKeywords = keywords.filter(kw => descLower.includes(kw));
      const matchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;

      if (matchRatio >= 0.7) {
        passed.push(item.id);
        item.status = 'verified';
        item.confidence = matchRatio;
      } else if (matchRatio >= 0.4) {
        partial.push(item.id);
        item.status = 'partial';
        item.confidence = matchRatio;
      } else {
        failed.push(item.id);
        item.status = 'failed';
        item.confidence = matchRatio;
      }
    }

    const completion = checklist.length > 0
      ? (passed.length + partial.length * 0.5) / checklist.length
      : 1;

    return { completion, passed, failed, partial };
  }

  private findDeviations(
    lock: VisualIntentLock,
    embedding: number[],
    description: string
  ): VerificationResult['deviations'] {
    const deviations: VerificationResult['deviations'] = [];

    // Compare embedding segments (simplified)
    const segmentSize = Math.floor(lock.embedding.length / 4);
    const segments = ['layout', 'style', 'components', 'overall'];

    for (let i = 0; i < 4; i++) {
      const start = i * segmentSize;
      const end = start + segmentSize;
      const lockSegment = lock.embedding.slice(start, end);
      const currentSegment = embedding.slice(start, end);

      const segmentSimilarity = this.cosineSimilarity(lockSegment, currentSegment);
      if (segmentSimilarity < 0.8) {
        deviations.push({
          aspect: segments[i],
          expected: `High similarity (>0.8)`,
          actual: `Similarity: ${segmentSimilarity.toFixed(2)}`,
          severity: segmentSimilarity < 0.6 ? 'severe' : segmentSimilarity < 0.75 ? 'moderate' : 'minor',
        });
      }
    }

    return deviations;
  }

  private analyzeDeviationAreas(
    lock: VisualIntentLock,
    embedding: number[]
  ): DeviationReport['areas'] {
    const areas: DeviationReport['areas'] = [];
    const components = ['header', 'navigation', 'content', 'footer', 'sidebar'];

    // Simplified area analysis based on embedding segments
    const segmentSize = Math.floor(lock.embedding.length / components.length);

    for (let i = 0; i < components.length; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, lock.embedding.length);
      const lockSegment = lock.embedding.slice(start, end);
      const currentSegment = embedding.slice(start, end);

      const deviation = 1 - this.cosineSimilarity(lockSegment, currentSegment);

      if (deviation > 0.1) {
        areas.push({
          area: components[i],
          deviation,
          description: `${components[i]} shows ${(deviation * 100).toFixed(0)}% deviation from expected`,
        });
      }
    }

    return areas;
  }

  private generateSuggestions(deviations: VerificationResult['deviations']): string[] {
    const suggestions: string[] = [];

    for (const dev of deviations) {
      if (dev.severity === 'severe') {
        suggestions.push(`Critical: ${dev.aspect} significantly differs from design - review implementation`);
      } else if (dev.severity === 'moderate') {
        suggestions.push(`Moderate: ${dev.aspect} needs adjustment - expected ${dev.expected}, found ${dev.actual}`);
      }
    }

    if (suggestions.length === 0 && deviations.length > 0) {
      suggestions.push('Minor adjustments needed to match design intent');
    }

    return suggestions;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: VisualIntentLockManager | null = null;

export function getVisualIntentLockManager(): VisualIntentLockManager {
  if (!managerInstance) {
    managerInstance = new VisualIntentLockManager();
  }
  return managerInstance;
}

export function resetVisualIntentLockManager(): void {
  managerInstance = null;
}
