/**
 * KripTik VL-JEPA Integration Service
 *
 * Provides visual understanding capabilities for symbiotic model training:
 * - Image similarity checking for dataset deduplication
 * - Mockup-to-code validation for training feedback
 * - Semantic element extraction for UI understanding
 *
 * Integration points:
 * - FLUX training: Deduplicate dataset, ensure unique outputs
 * - UICoder training: Validate generated code matches mockups
 * - BuildLoop: Visual verification of generated UIs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getVisualUnderstandingService } from './visual-understanding-service.js';
import type { VisualUnderstandingService } from './visual-understanding-service.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SimilarityResult {
  /** Similarity score 0-1, higher = more similar */
  score: number;
  /** True if score < threshold (unique enough to include in dataset) */
  isUnique: boolean;
  /** Details about the closest match if found */
  closestMatch?: {
    imageId: string;
    similarity: number;
    imagePath?: string;
  };
}

export interface ValidationResult {
  /** 0-1, how visually close the rendered code is to the mockup */
  visualMatch: number;
  /** 0-1, how well structural elements (buttons, inputs, etc.) match */
  structuralMatch: number;
  /** True if both scores exceed threshold */
  passesThreshold: boolean;
  /** Detailed feedback for training */
  feedback: string;
  /** Specific mismatches found */
  mismatches?: {
    type: 'missing_component' | 'wrong_position' | 'style_mismatch';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

export interface DeduplicationResult {
  /** Images kept in dataset */
  kept: string[];
  /** Images removed as duplicates */
  removed: string[];
  /** Pairs of duplicates found */
  duplicatePairs: Array<{
    kept: string;
    removed: string;
    similarity: number;
  }>;
  /** Statistics */
  stats: {
    totalInput: number;
    totalKept: number;
    totalRemoved: number;
    deduplicationRate: number;
  };
}

export interface TrainingValidationResult {
  /** Whether the generated code is acceptable */
  valid: boolean;
  /** Human-readable feedback for debugging */
  feedback: string;
  /** Scores for logging */
  scores: {
    visual: number;
    structural: number;
    overall: number;
  };
  /** Suggestions for improvement */
  suggestions?: string[];
}

export interface SemanticElement {
  id: string;
  type: 'button' | 'input' | 'text' | 'image' | 'card' | 'navigation' | 'form' | 'chart' | 'unknown';
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  label?: string;
  embedding?: number[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// VL-JEPA INTEGRATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class VLJEPAIntegration {
  private visualService: VisualUnderstandingService | null = null;
  private embeddingsCache: Map<string, number[]> = new Map();
  private readonly cacheFile: string;

  constructor(cacheDir: string = '/tmp/vl-jepa-cache') {
    this.cacheFile = path.join(cacheDir, 'embeddings-cache.json');
    this.loadCache();
  }

  /**
   * Initialize the visual understanding service
   */
  async initialize(): Promise<void> {
    if (!this.visualService) {
      this.visualService = await getVisualUnderstandingService();
      console.log('[VL-JEPA] Visual understanding service initialized');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE SIMILARITY CHECKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if an image is unique compared to existing embeddings
   * Used for dataset deduplication during FLUX training
   */
  async checkUniqueness(
    newImage: Buffer | string,
    existingEmbeddings: number[][] | string[],
    threshold: number = 0.8
  ): Promise<SimilarityResult> {
    await this.initialize();

    // Get embedding for new image
    const imageBuffer = typeof newImage === 'string'
      ? fs.readFileSync(newImage)
      : newImage;

    const newEmbedding = await this.getEmbedding(imageBuffer);

    // Compare against all existing embeddings
    let maxSimilarity = 0;
    let closestMatchIdx = -1;

    for (let i = 0; i < existingEmbeddings.length; i++) {
      const existing = Array.isArray(existingEmbeddings[i])
        ? existingEmbeddings[i] as number[]
        : await this.getEmbeddingFromPath(existingEmbeddings[i] as string);

      const similarity = this.cosineSimilarity(newEmbedding, existing);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        closestMatchIdx = i;
      }
    }

    const isUnique = maxSimilarity < threshold;

    return {
      score: maxSimilarity,
      isUnique,
      closestMatch: closestMatchIdx >= 0
        ? {
            imageId: `image_${closestMatchIdx}`,
            similarity: maxSimilarity,
            imagePath: typeof existingEmbeddings[closestMatchIdx] === 'string'
              ? existingEmbeddings[closestMatchIdx] as string
              : undefined,
          }
        : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOCKUP-TO-CODE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate that generated code renders match the original mockup
   * Used during UICoder training for feedback loop
   */
  async validateCodeOutput(
    mockupImage: Buffer | string,
    renderedScreenshot: Buffer | string,
    minThreshold: number = 0.85
  ): Promise<ValidationResult> {
    await this.initialize();

    // Get embeddings for both images
    const mockupBuffer = typeof mockupImage === 'string'
      ? fs.readFileSync(mockupImage)
      : mockupImage;

    const renderedBuffer = typeof renderedScreenshot === 'string'
      ? fs.readFileSync(renderedScreenshot)
      : renderedScreenshot;

    const mockupEmbedding = await this.getEmbedding(mockupBuffer);
    const renderedEmbedding = await this.getEmbedding(renderedBuffer);

    // Calculate visual similarity
    const visualMatch = this.cosineSimilarity(mockupEmbedding, renderedEmbedding);

    // Extract semantic elements from both
    const mockupElements = await this.extractSemanticElements(mockupBuffer);
    const renderedElements = await this.extractSemanticElements(renderedBuffer);

    // Calculate structural match
    const structuralMatch = this.calculateStructuralMatch(mockupElements, renderedElements);

    // Determine if it passes
    const passesThreshold = visualMatch >= minThreshold && structuralMatch >= minThreshold * 0.9;

    // Find mismatches
    const mismatches = this.findMismatches(mockupElements, renderedElements);

    // Generate feedback
    const feedback = this.generateValidationFeedback(visualMatch, structuralMatch, mismatches);

    return {
      visualMatch,
      structuralMatch,
      passesThreshold,
      feedback,
      mismatches,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATASET DEDUPLICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Remove near-duplicates from training dataset
   * Ensures FLUX produces diverse outputs
   */
  async deduplicateDataset(
    imageDir: string,
    threshold: number = 0.8,
    extensions: string[] = ['.png', '.jpg', '.jpeg', '.webp']
  ): Promise<DeduplicationResult> {
    await this.initialize();

    console.log(`[VL-JEPA] Starting deduplication of ${imageDir}`);

    // Get all image files
    const files = fs.readdirSync(imageDir)
      .filter(f => extensions.some(ext => f.toLowerCase().endsWith(ext)))
      .map(f => path.join(imageDir, f));

    console.log(`[VL-JEPA] Found ${files.length} images to process`);

    // Get embeddings for all images
    const embeddings: Map<string, number[]> = new Map();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const embedding = await this.getEmbeddingFromPath(file);
        embeddings.set(file, embedding);
        if ((i + 1) % 10 === 0) {
          console.log(`[VL-JEPA] Processed ${i + 1}/${files.length} images`);
        }
      } catch (error) {
        console.warn(`[VL-JEPA] Failed to process ${file}: ${error}`);
      }
    }

    // Find duplicates using greedy clustering
    const kept: string[] = [];
    const removed: string[] = [];
    const duplicatePairs: Array<{ kept: string; removed: string; similarity: number }> = [];

    const embeddingsList = Array.from(embeddings.entries());

    for (let i = 0; i < embeddingsList.length; i++) {
      const [file, embedding] = embeddingsList[i];

      // Check if this image is similar to any already kept
      let isDuplicate = false;
      let duplicateOf = '';
      let maxSim = 0;

      for (const keptFile of kept) {
        const keptEmbedding = embeddings.get(keptFile)!;
        const similarity = this.cosineSimilarity(embedding, keptEmbedding);

        if (similarity > threshold && similarity > maxSim) {
          isDuplicate = true;
          duplicateOf = keptFile;
          maxSim = similarity;
        }
      }

      if (isDuplicate) {
        removed.push(file);
        duplicatePairs.push({
          kept: duplicateOf,
          removed: file,
          similarity: maxSim,
        });
      } else {
        kept.push(file);
      }
    }

    const stats = {
      totalInput: files.length,
      totalKept: kept.length,
      totalRemoved: removed.length,
      deduplicationRate: removed.length / files.length,
    };

    console.log(`[VL-JEPA] Deduplication complete:`);
    console.log(`  - Kept: ${stats.totalKept}`);
    console.log(`  - Removed: ${stats.totalRemoved}`);
    console.log(`  - Rate: ${(stats.deduplicationRate * 100).toFixed(1)}%`);

    return {
      kept,
      removed,
      duplicatePairs,
      stats,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYMBIOTIC TRAINING HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Called during UICoder training to validate generated code
   * Provides feedback for the training loop
   */
  async validateTrainingExample(
    inputMockup: string,
    generatedCode: string,
    renderScreenshot: string
  ): Promise<TrainingValidationResult> {
    // Validate the rendered output matches the mockup
    const validation = await this.validateCodeOutput(
      inputMockup,
      renderScreenshot,
      0.85
    );

    // Determine overall validity
    const overallScore = (validation.visualMatch * 0.6 + validation.structuralMatch * 0.4);
    const valid = overallScore >= 0.85;

    // Generate suggestions based on mismatches
    const suggestions: string[] = [];

    if (validation.mismatches) {
      for (const mismatch of validation.mismatches) {
        switch (mismatch.type) {
          case 'missing_component':
            suggestions.push(`Add missing ${mismatch.description}`);
            break;
          case 'wrong_position':
            suggestions.push(`Reposition ${mismatch.description}`);
            break;
          case 'style_mismatch':
            suggestions.push(`Fix styling of ${mismatch.description}`);
            break;
        }
      }
    }

    if (validation.visualMatch < 0.8) {
      suggestions.push('Consider color scheme and overall visual styling');
    }

    if (validation.structuralMatch < 0.8) {
      suggestions.push('Verify all UI components are present and properly positioned');
    }

    return {
      valid,
      feedback: validation.feedback,
      scores: {
        visual: validation.visualMatch,
        structural: validation.structuralMatch,
        overall: overallScore,
      },
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get embedding for an image buffer
   */
  private async getEmbedding(imageBuffer: Buffer): Promise<number[]> {
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

    // Check cache
    if (this.embeddingsCache.has(hash)) {
      return this.embeddingsCache.get(hash)!;
    }

    // Generate embedding using visual understanding service
    if (this.visualService) {
      const imageBase64 = imageBuffer.toString('base64');
      const embedding = await this.visualService.generateEmbedding(imageBase64);
      if (embedding && embedding.length > 0) {
        this.embeddingsCache.set(hash, embedding);
        this.saveCache();
        return embedding;
      }
    }

    // Fallback: Generate simple perceptual hash embedding
    // This is a placeholder - in production, use actual VL-JEPA
    return this.generateSimpleEmbedding(imageBuffer);
  }

  /**
   * Get embedding from file path
   */
  private async getEmbeddingFromPath(imagePath: string): Promise<number[]> {
    const buffer = fs.readFileSync(imagePath);
    return this.getEmbedding(buffer);
  }

  /**
   * Generate a simple embedding for fallback
   * In production, this should use VL-JEPA or CLIP
   */
  private generateSimpleEmbedding(imageBuffer: Buffer): number[] {
    // Simple hash-based embedding (placeholder)
    const hash = crypto.createHash('sha256').update(imageBuffer).digest();
    const embedding: number[] = [];

    for (let i = 0; i < 256; i++) {
      embedding.push((hash[i % hash.length] / 255) * 2 - 1);
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Extract semantic elements from an image
   */
  private async extractSemanticElements(imageBuffer: Buffer): Promise<SemanticElement[]> {
    // In production, this would use VL-JEPA or a UI detection model
    // For now, return empty array as placeholder
    if (this.visualService) {
      try {
        const imageBase64 = imageBuffer.toString('base64');
        const elements = await this.visualService.analyzeUIElements(imageBase64);
        if (elements && elements.length > 0) {
          return elements.map(el => ({
            id: el.id || crypto.randomUUID(),
            type: el.type as SemanticElement['type'],
            boundingBox: el.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
            label: el.label || '',
            confidence: el.confidence || 0.8,
          }));
        }
      } catch (error) {
        console.warn('[VL-JEPA] Element extraction failed:', error);
      }
    }

    return [];
  }

  /**
   * Calculate structural match between two sets of elements
   */
  private calculateStructuralMatch(
    expected: SemanticElement[],
    actual: SemanticElement[]
  ): number {
    if (expected.length === 0 && actual.length === 0) {
      return 1.0;
    }

    if (expected.length === 0 || actual.length === 0) {
      return 0.5; // Partial match if one is empty
    }

    // Count matching elements by type
    const expectedTypes = new Map<string, number>();
    const actualTypes = new Map<string, number>();

    for (const el of expected) {
      expectedTypes.set(el.type, (expectedTypes.get(el.type) || 0) + 1);
    }

    for (const el of actual) {
      actualTypes.set(el.type, (actualTypes.get(el.type) || 0) + 1);
    }

    // Calculate overlap
    let matches = 0;
    let total = 0;

    for (const [type, count] of expectedTypes) {
      const actualCount = actualTypes.get(type) || 0;
      matches += Math.min(count, actualCount);
      total += count;
    }

    return total > 0 ? matches / total : 0;
  }

  /**
   * Find mismatches between expected and actual elements
   */
  private findMismatches(
    expected: SemanticElement[],
    actual: SemanticElement[]
  ): ValidationResult['mismatches'] {
    const mismatches: ValidationResult['mismatches'] = [];

    // Check for missing components
    const actualTypes = new Set(actual.map(el => el.type));
    for (const el of expected) {
      if (!actualTypes.has(el.type)) {
        mismatches.push({
          type: 'missing_component',
          description: `${el.type} element`,
          severity: 'high',
        });
      }
    }

    return mismatches;
  }

  /**
   * Generate human-readable feedback from validation results
   */
  private generateValidationFeedback(
    visualMatch: number,
    structuralMatch: number,
    mismatches: ValidationResult['mismatches']
  ): string {
    const parts: string[] = [];

    if (visualMatch >= 0.9) {
      parts.push('Excellent visual match');
    } else if (visualMatch >= 0.8) {
      parts.push('Good visual match');
    } else if (visualMatch >= 0.7) {
      parts.push('Acceptable visual match');
    } else {
      parts.push('Poor visual match - significant styling differences');
    }

    if (structuralMatch >= 0.9) {
      parts.push('all components present');
    } else if (structuralMatch >= 0.8) {
      parts.push('most components present');
    } else {
      parts.push('missing some components');
    }

    if (mismatches && mismatches.length > 0) {
      const highSeverity = mismatches.filter(m => m.severity === 'high').length;
      if (highSeverity > 0) {
        parts.push(`${highSeverity} critical issues found`);
      }
    }

    return parts.join(', ') + '.';
  }

  /**
   * Load embeddings cache from disk
   */
  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
        this.embeddingsCache = new Map(Object.entries(data));
        console.log(`[VL-JEPA] Loaded ${this.embeddingsCache.size} cached embeddings`);
      }
    } catch (error) {
      console.warn('[VL-JEPA] Failed to load cache:', error);
    }
  }

  /**
   * Save embeddings cache to disk
   */
  private saveCache(): void {
    try {
      const cacheDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const data = Object.fromEntries(this.embeddingsCache);
      fs.writeFileSync(this.cacheFile, JSON.stringify(data));
    } catch (error) {
      console.warn('[VL-JEPA] Failed to save cache:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let vljepaInstance: VLJEPAIntegration | null = null;

export function getVLJEPAIntegration(): VLJEPAIntegration {
  if (!vljepaInstance) {
    vljepaInstance = new VLJEPAIntegration();
  }
  return vljepaInstance;
}

export default VLJEPAIntegration;
