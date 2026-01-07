/**
 * Visual Understanding Service
 * 
 * VL-JEPA integration for visual analysis using Gemini 3 Pro.
 * Provides semantic understanding of screenshots, designs, and UI components.
 * 
 * Features:
 * - Screenshot analysis and description
 * - Design alignment checking
 * - App Soul visual verification
 * - Anti-slop pattern detection
 * - Visual similarity search
 * - UI component recognition
 */

import { getEmbeddingService, type EmbeddingService } from './embedding-service-impl.js';
import {
  getCollectionManager,
  type CollectionManager,
} from './collection-manager.js';
import { COLLECTION_NAMES, type VisualEmbeddingPayload } from './collections.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface VisualAnalysisInput {
  /** Image as URL or base64 */
  imageUrl?: string;
  imageBase64?: string;
  /** Optional text context */
  context?: string;
  /** Project ID for storage */
  projectId?: string;
  /** Expected app soul */
  expectedAppSoul?: string;
  /** Analysis type */
  analysisType?: 'screenshot' | 'mockup' | 'design_system' | 'component';
}

export interface VisualDescription {
  /** AI-generated description of the visual */
  description: string;
  /** Detected UI components */
  components: Array<{
    type: string;
    description: string;
    location?: string;
    confidence: number;
  }>;
  /** Color palette detected */
  colorPalette: Array<{
    color: string;
    usage: string;
    percentage?: number;
  }>;
  /** Typography detected */
  typography: {
    primaryFont?: string;
    headingStyle?: string;
    bodyStyle?: string;
    hierarchy?: string;
  };
  /** Layout analysis */
  layout: {
    type: 'grid' | 'flex' | 'stack' | 'free' | 'unknown';
    structure?: string;
    spacing?: string;
  };
  /** Motion/animation indicators */
  motion?: {
    detected: boolean;
    type?: string;
  };
}

export interface DesignAlignmentResult {
  /** Overall alignment score (0-1) */
  alignmentScore: number;
  /** Is design aligned with app soul? */
  isAligned: boolean;
  /** Detected app soul */
  detectedAppSoul: string;
  /** Expected vs detected comparison */
  soulMatch: {
    expected: string;
    detected: string;
    match: boolean;
  };
  /** Design principles alignment */
  principles: Array<{
    principle: string;
    aligned: boolean;
    evidence?: string;
  }>;
  /** Anti-slop violations */
  antiSlopViolations: Array<{
    pattern: string;
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
  }>;
  /** Suggestions for improvement */
  suggestions: string[];
}

export interface SimilarVisual {
  id: string;
  imageType: string;
  projectId: string;
  appSoul?: string;
  similarity: number;
  buildId?: string;
  createdAt: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Google AI API endpoint for Gemini */
  geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  /** Model to use */
  geminiModel: 'gemini-2.0-flash',
  /** Fallback model */
  fallbackModel: 'gpt-4o',
  /** Max image size in bytes */
  maxImageSize: 10 * 1024 * 1024, // 10MB
  /** Design alignment threshold */
  alignmentThreshold: 0.75,
  /** App Soul characteristics */
  appSoulCharacteristics: {
    immersive_media: ['cinematic', 'vibrant', 'content-forward', 'dark theme', 'bold typography'],
    professional: ['sophisticated', 'muted colors', 'data-focused', 'clean lines', 'serif fonts'],
    developer: ['low-contrast', 'terminal aesthetic', 'monospace', 'dark mode', 'code-like'],
    creative: ['canvas-forward', 'minimal', 'tools-focused', 'white space', 'subtle'],
    social: ['reactive', 'personality-forward', 'user content', 'bright colors', 'rounded shapes'],
    ecommerce: ['product photography', 'clean grids', 'smooth transitions', 'trust signals'],
    utility: ['minimal', 'purposeful', 'no distractions', 'functional', 'clear hierarchy'],
    gaming: ['energetic', 'rewarding animations', 'celebration', 'bold colors', 'dynamic'],
  } as Record<string, string[]>,
  /** Anti-slop patterns */
  antiSlopPatterns: [
    { pattern: 'purple gradient on white', severity: 'severe' as const },
    { pattern: 'generic card layout', severity: 'moderate' as const },
    { pattern: 'overused Inter font', severity: 'minor' as const },
    { pattern: 'predictable hero section', severity: 'moderate' as const },
    { pattern: 'cookie-cutter component', severity: 'moderate' as const },
    { pattern: 'bland color scheme', severity: 'minor' as const },
  ],
};

// ============================================================================
// Visual Understanding Service
// ============================================================================

export class VisualUnderstandingService {
  private embeddingService: EmbeddingService;
  private collectionManager: CollectionManager;
  private apiKey: string;

  constructor() {
    this.embeddingService = getEmbeddingService();
    this.collectionManager = getCollectionManager();
    this.apiKey = process.env.GOOGLE_AI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[VisualUnderstanding] GOOGLE_AI_API_KEY not set - using fallback analysis');
    }
  }

  // ============================================================================
  // Visual Analysis
  // ============================================================================

  /**
   * Analyze a visual and generate description
   */
  async analyzeVisual(input: VisualAnalysisInput, userId: string): Promise<VisualDescription> {
    // Prepare image data
    const imageData = input.imageBase64 || input.imageUrl;
    if (!imageData) {
      throw new Error('Either imageUrl or imageBase64 is required');
    }

    // Use Gemini for analysis if available, otherwise use embedding-based analysis
    if (this.apiKey) {
      return this.analyzeWithGemini(input, userId);
    } else {
      return this.analyzeWithEmbeddings(input, userId);
    }
  }

  /**
   * Analyze using Gemini API
   */
  private async analyzeWithGemini(
    input: VisualAnalysisInput,
    _userId: string
  ): Promise<VisualDescription> {
    const imageData = input.imageBase64 || input.imageUrl;
    const isUrl = imageData?.startsWith('http');

    const prompt = `Analyze this UI/design screenshot and provide a detailed JSON response with:
1. description: A comprehensive description of the visual design
2. components: Array of detected UI components with type, description, location, confidence
3. colorPalette: Array of colors with color (hex), usage, percentage
4. typography: Object with primaryFont, headingStyle, bodyStyle, hierarchy
5. layout: Object with type (grid/flex/stack/free/unknown), structure, spacing
6. motion: Object with detected (boolean), type

Context: ${input.context || 'UI screenshot analysis'}
Analysis type: ${input.analysisType || 'screenshot'}

Respond ONLY with valid JSON, no markdown or explanation.`;

    try {
      // Server-side external API call to Google AI
      const response = await fetch(
        `${CONFIG.geminiApiUrl}/${CONFIG.geminiModel}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          credentials: 'omit', // External API - no browser cookies
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                isUrl 
                  ? { fileData: { mimeType: 'image/jpeg', fileUri: imageData } }
                  : { inlineData: { mimeType: 'image/png', data: imageData?.replace(/^data:image\/\w+;base64,/, '') } },
              ],
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VisualUnderstanding] Gemini API error:', errorText);
        return this.getDefaultDescription();
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.normalizeDescription(parsed);
      }

      return this.getDefaultDescription();
    } catch (error) {
      console.error('[VisualUnderstanding] Gemini analysis failed:', error);
      return this.getDefaultDescription();
    }
  }

  /**
   * Analyze using embeddings (fallback when Gemini not available)
   */
  private async analyzeWithEmbeddings(
    input: VisualAnalysisInput,
    userId: string
  ): Promise<VisualDescription> {
    // Generate visual embedding using SigLIP
    const embedding = await this.embeddingService.embed({
      content: input.context || 'UI screenshot',
      type: 'visual',
      userId,
      options: {
        imageBase64: input.imageBase64,
        imageUrl: input.imageUrl,
      },
    });

    // Search for similar visuals
    const similar = await this.collectionManager.searchSimilarVisuals(
      embedding.embeddings[0],
      {
        imageType: input.analysisType,
        limit: 3,
        minScore: 0.5,
        tenantId: userId,
      }
    );

    // Build description from similar matches
    return {
      description: `Visual analysis based on embedding similarity (${similar.length} similar designs found)`,
      components: [],
      colorPalette: [],
      typography: {},
      layout: {
        type: 'unknown',
      },
    };
  }

  // ============================================================================
  // Design Alignment
  // ============================================================================

  /**
   * Check if visual design aligns with app soul
   */
  async checkDesignAlignment(
    input: VisualAnalysisInput,
    userId: string
  ): Promise<DesignAlignmentResult> {
    // Analyze the visual first
    const description = await this.analyzeVisual(input, userId);
    
    // Determine detected app soul based on visual characteristics
    const detectedAppSoul = this.detectAppSoul(description);
    const expectedAppSoul = input.expectedAppSoul || 'professional';
    
    // Check soul match
    const soulMatch = detectedAppSoul === expectedAppSoul;
    
    // Check design principles
    const expectedCharacteristics = CONFIG.appSoulCharacteristics[expectedAppSoul] || [];
    const principles = expectedCharacteristics.map(char => ({
      principle: char,
      aligned: description.description.toLowerCase().includes(char.toLowerCase()),
      evidence: description.description,
    }));

    // Check for anti-slop violations
    const antiSlopViolations = this.detectAntiSlopViolations(description);
    
    // Calculate alignment score
    const principleScore = principles.filter(p => p.aligned).length / Math.max(principles.length, 1);
    const slopPenalty = antiSlopViolations.reduce((sum, v) => {
      return sum + (v.severity === 'severe' ? 0.3 : v.severity === 'moderate' ? 0.15 : 0.05);
    }, 0);
    
    const alignmentScore = Math.max(0, (soulMatch ? 0.4 : 0) + principleScore * 0.6 - slopPenalty);

    // Generate suggestions
    const suggestions = this.generateDesignSuggestions(
      input.expectedAppSoul || 'professional',
      principles,
      antiSlopViolations
    );

    return {
      alignmentScore,
      isAligned: alignmentScore >= CONFIG.alignmentThreshold,
      detectedAppSoul,
      soulMatch: {
        expected: expectedAppSoul,
        detected: detectedAppSoul,
        match: soulMatch,
      },
      principles,
      antiSlopViolations,
      suggestions,
    };
  }

  /**
   * Detect app soul from visual description
   */
  private detectAppSoul(description: VisualDescription): string {
    const descLower = description.description.toLowerCase();
    
    // Score each soul type based on characteristics
    const scores: Record<string, number> = {};
    
    for (const [soul, characteristics] of Object.entries(CONFIG.appSoulCharacteristics)) {
      scores[soul] = characteristics.filter(char => 
        descLower.includes(char.toLowerCase())
      ).length;
    }
    
    // Find highest scoring soul
    let maxSoul = 'professional';
    let maxScore = 0;
    
    for (const [soul, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxSoul = soul;
      }
    }
    
    return maxSoul;
  }

  /**
   * Detect anti-slop pattern violations
   */
  private detectAntiSlopViolations(
    description: VisualDescription
  ): DesignAlignmentResult['antiSlopViolations'] {
    const violations: DesignAlignmentResult['antiSlopViolations'] = [];
    const descLower = description.description.toLowerCase();
    
    for (const pattern of CONFIG.antiSlopPatterns) {
      if (descLower.includes(pattern.pattern.toLowerCase())) {
        violations.push({
          pattern: pattern.pattern,
          severity: pattern.severity,
          description: `Detected anti-slop pattern: ${pattern.pattern}`,
        });
      }
    }
    
    // Check color palette for problematic patterns
    for (const color of description.colorPalette || []) {
      if (color.color?.toLowerCase().includes('purple') && 
          description.layout?.type === 'unknown') {
        violations.push({
          pattern: 'purple gradient misuse',
          severity: 'moderate',
          description: 'Purple color detected without clear design intent',
        });
      }
    }
    
    return violations;
  }

  // ============================================================================
  // Visual Storage
  // ============================================================================

  /**
   * Store visual embedding for future reference
   */
  async storeVisual(
    input: VisualAnalysisInput,
    buildId: string,
    userId: string
  ): Promise<string> {
    const visualId = uuidv4();
    
    // Generate visual embedding
    const embedding = await this.embeddingService.embed({
      content: input.context || 'UI visual',
      type: 'visual',
      userId,
      options: {
        imageBase64: input.imageBase64,
        imageUrl: input.imageUrl,
      },
    });

    // Analyze the visual for metadata
    const description = await this.analyzeVisual(input, userId);
    const detectedSoul = this.detectAppSoul(description);

    const payload: VisualEmbeddingPayload = {
      project_id: input.projectId || '',
      build_id: buildId,
      image_type: input.analysisType || 'screenshot',
      app_soul: input.expectedAppSoul || detectedSoul,
      design_alignment_score: 0.8, // Will be updated after alignment check
      visual_description: description.description,
      anti_slop_passed: true, // Will be updated
      created_at: new Date().toISOString(),
    };

    await this.collectionManager.storeVisualEmbedding(
      {
        id: visualId,
        vector: embedding.embeddings[0],
        payload,
      },
      userId
    );

    return visualId;
  }

  /**
   * Find similar visuals
   */
  async findSimilarVisuals(
    input: VisualAnalysisInput,
    userId: string,
    limit = 5
  ): Promise<SimilarVisual[]> {
    // Generate visual embedding
    const embedding = await this.embeddingService.embed({
      content: input.context || 'UI visual',
      type: 'visual',
      userId,
      options: {
        imageBase64: input.imageBase64,
        imageUrl: input.imageUrl,
      },
    });

    const results = await this.collectionManager.searchSimilarVisuals(
      embedding.embeddings[0],
      {
        projectId: input.projectId,
        imageType: input.analysisType,
        appSoul: input.expectedAppSoul,
        limit,
        minScore: 0.5,
        tenantId: userId,
      }
    );

    return results.map(r => ({
      id: String(r.id),
      imageType: r.payload?.image_type || 'screenshot',
      projectId: r.payload?.project_id || '',
      appSoul: r.payload?.app_soul,
      similarity: r.score,
      buildId: r.payload?.build_id,
      createdAt: r.payload?.created_at || '',
    }));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Normalize description from various formats
   */
  private normalizeDescription(parsed: Record<string, unknown>): VisualDescription {
    return {
      description: String(parsed.description || 'No description generated'),
      components: Array.isArray(parsed.components) ? parsed.components.map((c: Record<string, unknown>) => ({
        type: String(c.type || 'unknown'),
        description: String(c.description || ''),
        location: c.location ? String(c.location) : undefined,
        confidence: Number(c.confidence) || 0.5,
      })) : [],
      colorPalette: Array.isArray(parsed.colorPalette) ? parsed.colorPalette.map((c: Record<string, unknown>) => ({
        color: String(c.color || '#000000'),
        usage: String(c.usage || 'unknown'),
        percentage: c.percentage ? Number(c.percentage) : undefined,
      })) : [],
      typography: {
        primaryFont: parsed.typography && typeof parsed.typography === 'object' 
          ? String((parsed.typography as Record<string, unknown>).primaryFont || '') || undefined
          : undefined,
        headingStyle: parsed.typography && typeof parsed.typography === 'object'
          ? String((parsed.typography as Record<string, unknown>).headingStyle || '') || undefined
          : undefined,
        bodyStyle: parsed.typography && typeof parsed.typography === 'object'
          ? String((parsed.typography as Record<string, unknown>).bodyStyle || '') || undefined
          : undefined,
        hierarchy: parsed.typography && typeof parsed.typography === 'object'
          ? String((parsed.typography as Record<string, unknown>).hierarchy || '') || undefined
          : undefined,
      },
      layout: {
        type: (parsed.layout && typeof parsed.layout === 'object' 
          ? (parsed.layout as Record<string, unknown>).type as VisualDescription['layout']['type']
          : 'unknown') || 'unknown',
        structure: parsed.layout && typeof parsed.layout === 'object'
          ? String((parsed.layout as Record<string, unknown>).structure || '') || undefined
          : undefined,
        spacing: parsed.layout && typeof parsed.layout === 'object'
          ? String((parsed.layout as Record<string, unknown>).spacing || '') || undefined
          : undefined,
      },
      motion: parsed.motion && typeof parsed.motion === 'object' ? {
        detected: Boolean((parsed.motion as Record<string, unknown>).detected),
        type: (parsed.motion as Record<string, unknown>).type 
          ? String((parsed.motion as Record<string, unknown>).type)
          : undefined,
      } : undefined,
    };
  }

  /**
   * Get default description when analysis fails
   */
  private getDefaultDescription(): VisualDescription {
    return {
      description: 'Visual analysis could not be completed',
      components: [],
      colorPalette: [],
      typography: {},
      layout: { type: 'unknown' },
    };
  }

  /**
   * Generate design suggestions
   */
  private generateDesignSuggestions(
    expectedSoul: string,
    principles: DesignAlignmentResult['principles'],
    violations: DesignAlignmentResult['antiSlopViolations']
  ): string[] {
    const suggestions: string[] = [];
    
    // Address misaligned principles
    const misaligned = principles.filter(p => !p.aligned);
    for (const p of misaligned.slice(0, 3)) {
      suggestions.push(`Consider incorporating ${p.principle} to better match ${expectedSoul} aesthetic`);
    }
    
    // Address violations
    for (const v of violations.filter(v => v.severity === 'severe')) {
      suggestions.push(`CRITICAL: Remove ${v.pattern} - this is a common AI design anti-pattern`);
    }
    
    for (const v of violations.filter(v => v.severity === 'moderate').slice(0, 2)) {
      suggestions.push(`Improve: ${v.description}`);
    }
    
    return suggestions;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    geminiAvailable: boolean;
    embeddingService: boolean;
    collection: boolean;
  }> {
    const embeddingHealth = await this.embeddingService.healthCheck();
    const collectionExists = await this.collectionManager.getClient().collectionExists(
      COLLECTION_NAMES.VISUAL_EMBEDDINGS
    );

    return {
      healthy: embeddingHealth.healthy && collectionExists,
      geminiAvailable: !!this.apiKey,
      embeddingService: embeddingHealth.healthy,
      collection: collectionExists,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let serviceInstance: VisualUnderstandingService | null = null;

export function getVisualUnderstandingService(): VisualUnderstandingService {
  if (!serviceInstance) {
    serviceInstance = new VisualUnderstandingService();
  }
  return serviceInstance;
}

export function resetVisualUnderstandingService(): void {
  serviceInstance = null;
}

export default VisualUnderstandingService;
