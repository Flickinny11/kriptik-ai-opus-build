/**
 * Hybrid Visual-Semantic Analysis Engine
 *
 * Orchestrates parallel analysis across three streams:
 * 1. VL-JEPA Stream: Visual-language joint embeddings for intent matching
 * 2. V-JEPA 2 Stream: Temporal understanding and state prediction
 * 3. LLM Stream: Semantic descriptions with WHY explanations
 *
 * Fuses results into:
 * - VisualIntentLock: Combined specification for build verification
 * - TemporalExpectations: Predicted state transitions for proactive error detection
 */

import {
  getVisualIntentLockManager,
  type VisualIntentLock,
  type ComponentBreakdown,
  type DesignRationale,
} from './visual-intent-lock.js';
import {
  getTemporalExpectationsManager,
  type TemporalExpectations,
  type StateTransition,
  type MotionPattern,
  type AnticipatedAction,
} from './temporal-expectations.js';
import { RunPodVLJEPAProvider } from '../embeddings/providers/runpod-vl-jepa-provider.js';
import { getVJEPA2Provider } from '../embeddings/providers/runpod-vjepa2-provider.js';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface AnalysisInput {
  /** Media content - base64 or URL */
  media: string | Buffer;
  /** Media type */
  mediaType: 'image' | 'video' | 'multiple';
  /** Additional images (for multiple type) */
  additionalMedia?: Array<string | Buffer>;
  /** Text context from user */
  userContext?: string;
  /** Project ID */
  projectId: string;
  /** Build ID (optional) */
  buildId?: string;
  /** Tags assigned by user */
  tags?: string[];
}

export interface VLJEPAResult {
  /** Joint embedding (1024-dim) */
  embedding: number[];
  /** Image-only embedding */
  imageEmbedding?: number[];
  /** Text embedding (from context) */
  textEmbedding?: number[];
  /** Processing time in ms */
  latencyMs: number;
}

export interface VJEPA2Result {
  /** Temporal embedding (1024-dim) */
  temporalEmbedding: number[];
  /** Per-frame embeddings */
  frameEmbeddings?: number[][];
  /** Detected state transitions */
  stateTransitions: StateTransition[];
  /** Motion patterns */
  motionPatterns: MotionPattern[];
  /** Anticipated actions */
  anticipatedActions: AnticipatedAction[];
  /** Key moments */
  keyMoments: Array<{
    frameIndex: number;
    timestamp: number;
    type: 'error' | 'success' | 'pivot' | 'frustration' | 'breakthrough';
    description: string;
    confidence: number;
  }>;
  /** Physics context description */
  physicsContext: string;
  /** Processing time in ms */
  latencyMs: number;
}

export interface LLMResult {
  /** What the design shows */
  what: string;
  /** Why explanations for design choices */
  why: Record<string, DesignRationale>;
  /** Component breakdown */
  components: ComponentBreakdown[];
  /** Overall design rationale */
  designRationale: string;
  /** Processing time in ms */
  latencyMs: number;
}

export interface HybridAnalysisResult {
  /** VL-JEPA stream results */
  embedding: {
    vector: number[];
    imageEmbedding?: number[];
    textEmbedding?: number[];
  };

  /** V-JEPA 2 stream results */
  temporal: {
    stateTransitions: StateTransition[];
    anticipatedActions: AnticipatedAction[];
    motionPatterns: MotionPattern[];
    physicsContext: string;
  };

  /** LLM stream results */
  semantic: {
    what: string;
    why: Record<string, DesignRationale>;
    components: ComponentBreakdown[];
    designRationale: string;
  };

  /** Fused outputs */
  visualIntentLock: VisualIntentLock;
  temporalExpectations: TemporalExpectations;

  /** Metadata */
  analysisTime: number;
  confidence: number;
  cacheKey: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Gemini API for LLM analysis */
  geminiApiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  geminiModel: 'gemini-2.0-flash',
  /** Frame extraction settings */
  frameExtractionFps: 2,
  maxFrames: 30,
  /** Cache settings */
  enableCache: true,
  cacheDir: path.join(os.tmpdir(), 'kriptik-analysis-cache'),
  cacheTtlMs: 30 * 60 * 1000, // 30 minutes
};

// Simple in-memory cache
const analysisCache = new Map<string, { result: HybridAnalysisResult; timestamp: number }>();

// ============================================================================
// Hybrid Analysis Engine
// ============================================================================

export class HybridAnalysisEngine {
  private vlJepaProvider: RunPodVLJEPAProvider;

  constructor() {
    this.vlJepaProvider = new RunPodVLJEPAProvider();
  }

  /**
   * Run full hybrid analysis on media input
   * Executes VL-JEPA, V-JEPA 2, and LLM streams in parallel
   */
  async analyzeMedia(input: AnalysisInput): Promise<HybridAnalysisResult> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.generateCacheKey(input);
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('[HybridAnalysis] Cache hit:', cacheKey.substring(0, 16));
      return cached;
    }

    console.log('[HybridAnalysis] Starting parallel analysis...');

    // Extract frames if video
    let frames: string[] = [];
    let primaryImage: string;

    if (input.mediaType === 'video') {
      frames = await this.extractFrames(input.media);
      primaryImage = frames[0]; // Use first frame for VL-JEPA
    } else if (input.mediaType === 'multiple' && input.additionalMedia) {
      primaryImage = this.mediaToBase64(input.media);
      frames = [primaryImage, ...input.additionalMedia.map(m => this.mediaToBase64(m))];
    } else {
      primaryImage = this.mediaToBase64(input.media);
      frames = [primaryImage];
    }

    // Run ALL THREE streams in parallel
    const [vlJepaResult, vJepa2Result, llmResult] = await Promise.all([
      this.runVLJEPAAnalysis(primaryImage, input.userContext),
      this.runVJEPA2Analysis(frames, input.mediaType),
      this.runLLMAnalysis(primaryImage, input.userContext),
    ]);

    // Create VisualIntentLock from VL-JEPA + LLM results
    const intentLockManager = getVisualIntentLockManager();
    const visualIntentLock = intentLockManager.createLock({
      projectId: input.projectId,
      buildId: input.buildId,
      embedding: vlJepaResult.embedding,
      imageEmbedding: vlJepaResult.imageEmbedding,
      textEmbedding: vlJepaResult.textEmbedding,
      what: llmResult.what,
      why: llmResult.why,
      components: llmResult.components,
      designRationale: llmResult.designRationale,
      sourceType: input.mediaType === 'video' ? 'video' : input.mediaType === 'multiple' ? 'multiple' : 'image',
      tags: input.tags,
    });

    // Create TemporalExpectations from V-JEPA 2 results
    const expectationsManager = getTemporalExpectationsManager();
    const temporalExpectations = await expectationsManager.createExpectations({
      intentLockId: visualIntentLock.id,
      projectId: input.projectId,
      temporalEmbedding: vJepa2Result.temporalEmbedding,
      frameEmbeddings: vJepa2Result.frameEmbeddings,
      stateTransitions: vJepa2Result.stateTransitions,
      motionPatterns: vJepa2Result.motionPatterns,
      anticipatedActions: vJepa2Result.anticipatedActions,
      physicsContext: vJepa2Result.physicsContext,
      keyMoments: vJepa2Result.keyMoments,
      sourceType: input.mediaType === 'video' ? 'video' : frames.length > 1 ? 'image_sequence' : 'single_image',
    });

    const analysisTime = Date.now() - startTime;
    console.log(`[HybridAnalysis] Complete in ${analysisTime}ms`);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(vlJepaResult, vJepa2Result, llmResult);

    const result: HybridAnalysisResult = {
      embedding: {
        vector: vlJepaResult.embedding,
        imageEmbedding: vlJepaResult.imageEmbedding,
        textEmbedding: vlJepaResult.textEmbedding,
      },
      temporal: {
        stateTransitions: vJepa2Result.stateTransitions,
        anticipatedActions: vJepa2Result.anticipatedActions,
        motionPatterns: vJepa2Result.motionPatterns,
        physicsContext: vJepa2Result.physicsContext,
      },
      semantic: {
        what: llmResult.what,
        why: llmResult.why,
        components: llmResult.components,
        designRationale: llmResult.designRationale,
      },
      visualIntentLock,
      temporalExpectations,
      analysisTime,
      confidence,
      cacheKey,
    };

    // Cache result
    this.setCached(cacheKey, result);

    return result;
  }

  // =========================================================================
  // VL-JEPA Stream
  // =========================================================================

  private async runVLJEPAAnalysis(imageData: string, context?: string): Promise<VLJEPAResult> {
    const startTime = Date.now();
    console.log('[VL-JEPA] Starting visual-text embedding...');

    try {
      if (!this.vlJepaProvider.isConfigured()) {
        console.warn('[VL-JEPA] Provider not configured, using fallback');
        return this.vlJepaFallback(context);
      }

      const result = await this.vlJepaProvider.embedVisualText(
        imageData,
        context || 'Analyze this UI design for implementation'
      );

      console.log(`[VL-JEPA] Complete in ${result.latencyMs}ms`);

      return {
        embedding: result.embedding,
        imageEmbedding: result.imageEmbedding,
        textEmbedding: result.textEmbedding,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      console.error('[VL-JEPA] Error:', error);
      return this.vlJepaFallback(context);
    }
  }

  private vlJepaFallback(context?: string): VLJEPAResult {
    // Generate deterministic pseudo-embedding from context
    const seed = context ? this.hashToNumber(context) : Date.now();
    const embedding = this.generatePseudoEmbedding(seed, 1024);

    return {
      embedding,
      latencyMs: 0,
    };
  }

  // =========================================================================
  // V-JEPA 2 Stream
  // =========================================================================

  private async runVJEPA2Analysis(frames: string[], mediaType: string): Promise<VJEPA2Result> {
    const startTime = Date.now();
    console.log(`[V-JEPA 2] Starting temporal analysis of ${frames.length} frames...`);

    try {
      const provider = getVJEPA2Provider();

      if (!provider.isConfigured()) {
        console.warn('[V-JEPA 2] Provider not configured, using fallback');
        return this.vjepa2Fallback(frames.length);
      }

      // Analyze temporal sequence
      const temporalAnalysis = await provider.analyzeTemporalSequence(frames, {
        context: 'Analyze UI design for implementation and predict state transitions',
        fps: CONFIG.frameExtractionFps,
      });

      // Get embeddings
      const { temporalEmbedding, frameEmbeddings } = await provider.embedTemporal(frames);

      // Extract state transitions from key moments
      const stateTransitions = this.extractStateTransitions(temporalAnalysis.keyMoments);

      // Extract motion patterns
      const motionPatterns = this.extractMotionPatterns(temporalAnalysis.patterns);

      // Get action predictions
      const prediction = await provider.predictNextAction(frames, []);

      const latencyMs = Date.now() - startTime;
      console.log(`[V-JEPA 2] Complete in ${latencyMs}ms`);

      return {
        temporalEmbedding,
        frameEmbeddings,
        stateTransitions,
        motionPatterns,
        anticipatedActions: [{
          action: prediction.predictedAction,
          probability: prediction.confidence,
          expectedChange: 'Based on trajectory analysis',
          triggerType: 'load',
          alternatives: prediction.alternatives,
        }],
        keyMoments: temporalAnalysis.keyMoments.map(km => ({
          frameIndex: km.frameIndex,
          timestamp: km.timestamp,
          type: km.type as 'error' | 'success' | 'pivot' | 'frustration' | 'breakthrough',
          description: km.description,
          confidence: km.confidence,
        })),
        physicsContext: temporalAnalysis.flowSummary || 'UI design analysis',
        latencyMs,
      };
    } catch (error) {
      console.error('[V-JEPA 2] Error:', error);
      return this.vjepa2Fallback(frames.length);
    }
  }

  private vjepa2Fallback(frameCount: number): VJEPA2Result {
    const embedding = this.generatePseudoEmbedding(Date.now(), 1024);

    return {
      temporalEmbedding: embedding,
      stateTransitions: [],
      motionPatterns: [],
      anticipatedActions: [],
      keyMoments: [],
      physicsContext: 'Fallback: Provider not available',
      latencyMs: 0,
    };
  }

  private extractStateTransitions(keyMoments: Array<{
    frameIndex: number;
    timestamp: number;
    type: string;
    description: string;
    confidence: number;
  }>): StateTransition[] {
    const transitions: StateTransition[] = [];

    for (let i = 0; i < keyMoments.length; i++) {
      const moment = keyMoments[i];
      const nextMoment = keyMoments[i + 1];

      transitions.push({
        id: `st_${i}`,
        from: i === 0 ? 'initial' : `state_${i}`,
        to: nextMoment ? `state_${i + 1}` : 'final',
        trigger: this.inferTrigger(moment.type),
        type: 'instant',
        confidence: moment.confidence,
      });
    }

    return transitions;
  }

  private inferTrigger(momentType: string): StateTransition['trigger'] {
    switch (momentType) {
      case 'error':
      case 'success':
        return 'code_change';
      case 'pivot':
        return 'user_action';
      default:
        return 'data_load';
    }
  }

  private extractMotionPatterns(patterns: string[]): MotionPattern[] {
    return patterns.map((pattern, i) => ({
      name: pattern,
      description: `Detected pattern: ${pattern}`,
      type: 'linear' as const,
      durationMs: 300,
      affectedElements: ['main'],
      smoothness: 0.8,
    }));
  }

  // =========================================================================
  // LLM Stream
  // =========================================================================

  private async runLLMAnalysis(imageData: string, context?: string): Promise<LLMResult> {
    const startTime = Date.now();
    console.log('[LLM] Starting semantic analysis...');

    try {
      if (!CONFIG.geminiApiKey) {
        console.warn('[LLM] Gemini API key not configured, using fallback');
        return this.llmFallback();
      }

      const prompt = this.buildLLMPrompt(context);
      const response = await this.callGeminiVision(imageData, prompt);

      const parsed = this.parseLLMResponse(response);
      parsed.latencyMs = Date.now() - startTime;

      console.log(`[LLM] Complete in ${parsed.latencyMs}ms`);
      return parsed;
    } catch (error) {
      console.error('[LLM] Error:', error);
      return this.llmFallback();
    }
  }

  private buildLLMPrompt(context?: string): string {
    return `Analyze this UI design image for implementation. Provide a detailed breakdown in JSON format.

${context ? `User context: ${context}\n` : ''}

Return a JSON object with these fields:
{
  "what": "A 2-3 sentence description of what this design shows",
  "why": {
    "layout": {
      "element": "layout",
      "why": "Explanation of layout choices",
      "mustPreserve": ["list of layout elements that must be preserved"],
      "canAdapt": ["list of layout elements that can be adapted"]
    },
    "colors": {
      "element": "colors",
      "why": "Explanation of color choices",
      "mustPreserve": ["color elements to preserve"],
      "canAdapt": ["color elements that can adapt"]
    },
    "typography": {
      "element": "typography",
      "why": "Explanation of typography choices",
      "mustPreserve": ["typography elements to preserve"],
      "canAdapt": ["typography elements that can adapt"]
    }
  },
  "components": [
    {
      "name": "component name",
      "description": "component description",
      "importance": "critical|high|medium|low",
      "visualTraits": ["trait1", "trait2"],
      "behavior": "expected behavior",
      "styleHints": "CSS/styling hints"
    }
  ],
  "designRationale": "Overall design rationale and philosophy"
}

Be specific and actionable. Focus on implementation details.`;
  }

  private async callGeminiVision(imageData: string, prompt: string): Promise<string> {
    const url = `${CONFIG.geminiApiUrl}/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageData.replace(/^data:image\/\w+;base64,/, ''),
              },
            },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private parseLLMResponse(response: string): LLMResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        what: parsed.what || 'UI design analysis',
        why: parsed.why || {},
        components: (parsed.components || []).map((c: Partial<ComponentBreakdown>) => ({
          name: c.name || 'Unknown',
          description: c.description || '',
          importance: c.importance || 'medium',
          visualTraits: c.visualTraits || [],
          behavior: c.behavior,
          styleHints: c.styleHints,
        })),
        designRationale: parsed.designRationale || '',
        latencyMs: 0,
      };
    } catch {
      return this.llmFallback();
    }
  }

  private llmFallback(): LLMResult {
    return {
      what: 'UI design requiring implementation',
      why: {},
      components: [],
      designRationale: 'Fallback: LLM analysis not available',
      latencyMs: 0,
    };
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private async extractFrames(video: string | Buffer): Promise<string[]> {
    // For now, if already base64, treat as single frame
    // In production, use ffmpeg to extract frames
    const base64 = this.mediaToBase64(video);
    return [base64];
  }

  private mediaToBase64(media: string | Buffer): string {
    if (Buffer.isBuffer(media)) {
      return media.toString('base64');
    }
    if (media.startsWith('data:')) {
      return media.split(',')[1] || media;
    }
    return media;
  }

  private generateCacheKey(input: AnalysisInput): string {
    const data = JSON.stringify({
      media: typeof input.media === 'string' ? input.media.substring(0, 100) : 'buffer',
      mediaType: input.mediaType,
      context: input.userContext,
      projectId: input.projectId,
    });

    return createHash('sha256').update(data).digest('hex');
  }

  private getCached(key: string): HybridAnalysisResult | null {
    if (!CONFIG.enableCache) return null;

    const cached = analysisCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CONFIG.cacheTtlMs) {
      analysisCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCached(key: string, result: HybridAnalysisResult): void {
    if (!CONFIG.enableCache) return;

    analysisCache.set(key, {
      result,
      timestamp: Date.now(),
    });

    // Limit cache size
    if (analysisCache.size > 100) {
      const oldest = analysisCache.keys().next().value;
      if (oldest) analysisCache.delete(oldest);
    }
  }

  private calculateOverallConfidence(
    vlJepa: VLJEPAResult,
    vJepa2: VJEPA2Result,
    llm: LLMResult
  ): number {
    let confidence = 0.5;

    // VL-JEPA contribution
    if (vlJepa.embedding && vlJepa.embedding.length > 0) {
      confidence += 0.2;
    }

    // V-JEPA 2 contribution
    if (vJepa2.temporalEmbedding && vJepa2.temporalEmbedding.length > 0) {
      confidence += 0.15;
    }
    if (vJepa2.stateTransitions.length > 0) {
      confidence += 0.05;
    }

    // LLM contribution
    if (llm.components.length > 0) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private hashToNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private generatePseudoEmbedding(seed: number, dimensions: number): number[] {
    const embedding: number[] = [];
    let s = seed;

    for (let i = 0; i < dimensions; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      embedding.push((s / 0x7fffffff) * 2 - 1);
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / magnitude);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let engineInstance: HybridAnalysisEngine | null = null;

export function getHybridAnalysisEngine(): HybridAnalysisEngine {
  if (!engineInstance) {
    engineInstance = new HybridAnalysisEngine();
  }
  return engineInstance;
}

export function resetHybridAnalysisEngine(): void {
  engineInstance = null;
}
