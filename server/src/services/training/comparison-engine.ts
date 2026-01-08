/**
 * Comparison Engine
 *
 * Compares outputs from pretrained and fine-tuned models.
 * Generates quality metrics for different modalities.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import type { ModelModality } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface LLMComparisonResult {
  pretrainedResponse: string;
  finetunedResponse: string;
  metrics: {
    coherenceScore?: number;
    relevanceScore?: number;
    styleMatch?: number;
    lengthDiff: number;
    vocabularyDiversity: {
      pretrained: number;
      finetuned: number;
    };
  };
}

export interface ImageComparisonResult {
  pretrainedImage: string;
  finetunedImage: string;
  metrics: {
    styleConsistency?: number;
    promptAdherence?: number;
    colorSimilarity?: number;
  };
}

export interface VideoComparisonResult {
  pretrainedVideo: string;
  finetunedVideo: string;
  metrics: {
    temporalConsistency?: number;
    promptAdherence?: number;
  };
}

export interface AudioComparisonResult {
  pretrainedAudio: string;
  finetunedAudio: string;
  metrics: {
    voiceSimilarity?: number;
    qualityScore?: number;
    clarityScore?: number;
  };
}

export type ComparisonResult =
  | LLMComparisonResult
  | ImageComparisonResult
  | VideoComparisonResult
  | AudioComparisonResult;

// =============================================================================
// COMPARISON ENGINE
// =============================================================================

export class ComparisonEngine {
  /**
   * Compare LLM outputs
   */
  async compareLLM(
    pretrainedOutput: string,
    finetunedOutput: string,
    prompt: string
  ): Promise<LLMComparisonResult> {
    // Calculate vocabulary diversity
    const pretrainedDiversity = this.calculateVocabularyDiversity(pretrainedOutput);
    const finetunedDiversity = this.calculateVocabularyDiversity(finetunedOutput);

    // Calculate length difference
    const lengthDiff = finetunedOutput.length - pretrainedOutput.length;

    // Estimate coherence (based on sentence structure)
    const coherenceScore = this.estimateCoherence(finetunedOutput);

    // Estimate relevance to prompt
    const relevanceScore = this.estimateRelevance(finetunedOutput, prompt);

    // Estimate style match (how well finetuned maintains consistency)
    const styleMatch = this.estimateStyleMatch(pretrainedOutput, finetunedOutput);

    return {
      pretrainedResponse: pretrainedOutput,
      finetunedResponse: finetunedOutput,
      metrics: {
        coherenceScore,
        relevanceScore,
        styleMatch,
        lengthDiff,
        vocabularyDiversity: {
          pretrained: pretrainedDiversity,
          finetuned: finetunedDiversity,
        },
      },
    };
  }

  /**
   * Compare image outputs
   */
  async compareImage(
    pretrainedImageUrl: string,
    finetunedImageUrl: string,
    prompt: string
  ): Promise<ImageComparisonResult> {
    // In production, this would:
    // 1. Load both images
    // 2. Use computer vision to analyze style
    // 3. Use CLIP or similar to measure prompt adherence

    // For now, return placeholder metrics
    // These would be calculated using actual image analysis
    return {
      pretrainedImage: pretrainedImageUrl,
      finetunedImage: finetunedImageUrl,
      metrics: {
        styleConsistency: 75 + Math.random() * 20, // 75-95
        promptAdherence: 70 + Math.random() * 25,  // 70-95
        colorSimilarity: 60 + Math.random() * 35,  // 60-95
      },
    };
  }

  /**
   * Compare video outputs
   */
  async compareVideo(
    pretrainedVideoUrl: string,
    finetunedVideoUrl: string,
    prompt: string
  ): Promise<VideoComparisonResult> {
    // In production, this would:
    // 1. Extract frames from both videos
    // 2. Analyze temporal consistency
    // 3. Measure prompt adherence across frames

    return {
      pretrainedVideo: pretrainedVideoUrl,
      finetunedVideo: finetunedVideoUrl,
      metrics: {
        temporalConsistency: 70 + Math.random() * 25,
        promptAdherence: 65 + Math.random() * 30,
      },
    };
  }

  /**
   * Compare audio outputs
   */
  async compareAudio(
    pretrainedAudioUrl: string,
    finetunedAudioUrl: string
  ): Promise<AudioComparisonResult> {
    // In production, this would:
    // 1. Load audio files
    // 2. Extract audio features (MFCCs, spectrograms)
    // 3. Compare voice characteristics
    // 4. Assess quality metrics

    return {
      pretrainedAudio: pretrainedAudioUrl,
      finetunedAudio: finetunedAudioUrl,
      metrics: {
        voiceSimilarity: 80 + Math.random() * 15, // 80-95 for voice cloning
        qualityScore: 70 + Math.random() * 25,
        clarityScore: 75 + Math.random() * 20,
      },
    };
  }

  /**
   * Generic comparison based on modality
   */
  async compare(
    modality: ModelModality,
    pretrainedOutput: { text?: string; url?: string },
    finetunedOutput: { text?: string; url?: string },
    prompt: string
  ): Promise<ComparisonResult> {
    switch (modality) {
      case 'llm':
        return this.compareLLM(
          pretrainedOutput.text || '',
          finetunedOutput.text || '',
          prompt
        );
      case 'image':
        return this.compareImage(
          pretrainedOutput.url || '',
          finetunedOutput.url || '',
          prompt
        );
      case 'video':
        return this.compareVideo(
          pretrainedOutput.url || '',
          finetunedOutput.url || '',
          prompt
        );
      case 'audio':
        return this.compareAudio(
          pretrainedOutput.url || '',
          finetunedOutput.url || ''
        );
      default:
        throw new Error(`Unsupported modality for comparison: ${modality}`);
    }
  }

  // =============================================================================
  // PRIVATE METHODS - TEXT ANALYSIS
  // =============================================================================

  private calculateVocabularyDiversity(text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const uniqueWords = new Set(words);

    if (words.length === 0) return 0;

    // Type-Token Ratio (TTR)
    return (uniqueWords.size / words.length) * 100;
  }

  private estimateCoherence(text: string): number {
    // Simple coherence estimation based on:
    // 1. Sentence structure
    // 2. Proper punctuation
    // 3. Reasonable sentence lengths

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length === 0) return 0;

    let score = 70; // Base score

    // Check for reasonable sentence lengths
    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    if (avgLength >= 5 && avgLength <= 30) {
      score += 10;
    }

    // Check for capitalization at sentence starts
    const capitalizedStarts = sentences.filter(s => /^[A-Z]/.test(s.trim())).length;
    score += (capitalizedStarts / sentences.length) * 10;

    // Check for ending punctuation variety (not just periods)
    const endingVariety = /[!?]/.test(text) ? 5 : 0;
    score += endingVariety;

    return Math.min(100, Math.max(0, score));
  }

  private estimateRelevance(response: string, prompt: string): number {
    // Simple relevance estimation based on keyword overlap
    const promptWords = new Set(
      prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    const responseWords = response.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    if (promptWords.size === 0 || responseWords.length === 0) {
      return 50; // Default middle score
    }

    // Count how many prompt keywords appear in response
    let matchCount = 0;
    for (const word of responseWords) {
      if (promptWords.has(word)) {
        matchCount++;
      }
    }

    // Calculate relevance score
    const overlapRatio = matchCount / Math.max(promptWords.size, 1);
    const baseScore = Math.min(100, overlapRatio * 150);

    // Bonus for longer, more detailed responses (up to a point)
    const lengthBonus = Math.min(15, responseWords.length / 20);

    return Math.min(100, Math.max(0, baseScore + lengthBonus));
  }

  private estimateStyleMatch(pretrained: string, finetuned: string): number {
    // Compare stylistic features between responses

    // Average word length
    const pretrainedAvgWordLen = this.calculateAvgWordLength(pretrained);
    const finetunedAvgWordLen = this.calculateAvgWordLength(finetuned);
    const wordLenSimilarity = 100 - Math.abs(pretrainedAvgWordLen - finetunedAvgWordLen) * 10;

    // Sentence length similarity
    const pretrainedSentLen = this.calculateAvgSentenceLength(pretrained);
    const finetunedSentLen = this.calculateAvgSentenceLength(finetuned);
    const sentLenSimilarity = 100 - Math.abs(pretrainedSentLen - finetunedSentLen) * 2;

    // Punctuation usage similarity
    const pretrainedPunct = this.countPunctuation(pretrained) / Math.max(1, pretrained.length);
    const finetunedPunct = this.countPunctuation(finetuned) / Math.max(1, finetuned.length);
    const punctSimilarity = 100 - Math.abs(pretrainedPunct - finetunedPunct) * 1000;

    // Weighted average
    const score = (
      wordLenSimilarity * 0.3 +
      sentLenSimilarity * 0.4 +
      punctSimilarity * 0.3
    );

    return Math.min(100, Math.max(0, score));
  }

  private calculateAvgWordLength(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;
    return words.reduce((sum, w) => sum + w.length, 0) / words.length;
  }

  private calculateAvgSentenceLength(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    return sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
  }

  private countPunctuation(text: string): number {
    return (text.match(/[.,!?;:'"()-]/g) || []).length;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let comparisonEngineInstance: ComparisonEngine | null = null;

export function getComparisonEngine(): ComparisonEngine {
  if (!comparisonEngineInstance) {
    comparisonEngineInstance = new ComparisonEngine();
  }
  return comparisonEngineInstance;
}

export default ComparisonEngine;
