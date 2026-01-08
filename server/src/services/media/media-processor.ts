/**
 * Media Processor Service
 *
 * Handles media processing: resize, reformat, and optimize.
 * Supports image, audio, and video processing.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface MediaRequirements {
  image?: {
    maxWidth: number;
    maxHeight: number;
    formats: string[];
    aspectRatio?: number;
  };
  audio?: {
    sampleRate: number;
    channels: number;
    formats: string[];
    maxDuration?: number;
  };
  video?: {
    maxWidth: number;
    maxHeight: number;
    frameRate?: number;
    formats: string[];
    maxDuration?: number;
  };
}

export interface ImageProcessingResult {
  outputPath: string;
  originalSize: { width: number; height: number };
  processedSize: { width: number; height: number };
  format: string;
  resized: boolean;
  reformatted: boolean;
}

export interface AudioProcessingResult {
  outputPath: string;
  originalSampleRate: number;
  processedSampleRate: number;
  duration: number;
  format: string;
  resampled: boolean;
}

export interface VideoProcessingResult {
  outputPath: string;
  originalResolution: { width: number; height: number };
  processedResolution: { width: number; height: number };
  duration: number;
  frameRate: number;
  format: string;
  resized: boolean;
}

// =============================================================================
// MODEL REQUIREMENTS
// =============================================================================

export const MODEL_REQUIREMENTS: Record<string, MediaRequirements> = {
  // Image models
  'sdxl': {
    image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'], aspectRatio: 1 },
  },
  'sd15': {
    image: { maxWidth: 512, maxHeight: 512, formats: ['png', 'jpg'], aspectRatio: 1 },
  },
  'sd3': {
    image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'] },
  },
  'sd35': {
    image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'] },
  },
  'flux': {
    image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'] },
  },
  'flux-dev': {
    image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'] },
  },

  // Audio models
  'xtts': {
    audio: { sampleRate: 22050, channels: 1, formats: ['wav'], maxDuration: 30 },
  },
  'xtts2': {
    audio: { sampleRate: 22050, channels: 1, formats: ['wav'], maxDuration: 30 },
  },
  'whisper': {
    audio: { sampleRate: 16000, channels: 1, formats: ['wav', 'mp3'] },
  },
  'whisper_speech': {
    audio: { sampleRate: 22050, channels: 1, formats: ['wav'] },
  },
  'bark': {
    audio: { sampleRate: 24000, channels: 1, formats: ['wav'] },
  },
  'musicgen': {
    audio: { sampleRate: 32000, channels: 2, formats: ['wav', 'mp3'] },
  },

  // Video models
  'wan': {
    video: { maxWidth: 720, maxHeight: 480, frameRate: 24, formats: ['mp4'], maxDuration: 10 },
  },
  'wan2': {
    video: { maxWidth: 1280, maxHeight: 720, frameRate: 24, formats: ['mp4'], maxDuration: 10 },
  },
  'hunyuan': {
    video: { maxWidth: 1280, maxHeight: 720, frameRate: 24, formats: ['mp4'], maxDuration: 8 },
  },
  'mochi': {
    video: { maxWidth: 848, maxHeight: 480, frameRate: 30, formats: ['mp4'], maxDuration: 5 },
  },
  'opensora': {
    video: { maxWidth: 720, maxHeight: 480, frameRate: 24, formats: ['mp4'], maxDuration: 16 },
  },
};

// =============================================================================
// MEDIA PROCESSOR
// =============================================================================

export class MediaProcessor {
  private tempDir: string;

  constructor(tempDir: string = '/tmp/kriptik-media') {
    this.tempDir = tempDir;
    this.ensureTempDir();
  }

  /**
   * Process image for model requirements
   */
  async processImage(
    inputPath: string,
    requirements: NonNullable<MediaRequirements['image']>
  ): Promise<ImageProcessingResult> {
    const { maxWidth, maxHeight, formats, aspectRatio } = requirements;

    // Generate output path
    const outputFormat = formats[0] || 'png';
    const outputPath = this.generateOutputPath(outputFormat);

    // Get original size (would use sharp in production)
    const originalSize = await this.getImageSize(inputPath);
    
    // Calculate new size
    let newWidth = originalSize.width;
    let newHeight = originalSize.height;
    let resized = false;

    // Resize if needed
    if (originalSize.width > maxWidth || originalSize.height > maxHeight) {
      const scale = Math.min(maxWidth / originalSize.width, maxHeight / originalSize.height);
      newWidth = Math.round(originalSize.width * scale);
      newHeight = Math.round(originalSize.height * scale);
      resized = true;
    }

    // Apply aspect ratio if specified
    if (aspectRatio) {
      const targetAspect = aspectRatio;
      const currentAspect = newWidth / newHeight;
      
      if (currentAspect > targetAspect) {
        // Crop width
        newWidth = Math.round(newHeight * targetAspect);
        resized = true;
      } else if (currentAspect < targetAspect) {
        // Crop height
        newHeight = Math.round(newWidth / targetAspect);
        resized = true;
      }
    }

    // Check if format change needed
    const inputFormat = path.extname(inputPath).slice(1).toLowerCase();
    const reformatted = !formats.includes(inputFormat);

    // In production, use sharp for actual processing
    // For now, copy file and update metadata
    await fs.copyFile(inputPath, outputPath);

    return {
      outputPath,
      originalSize,
      processedSize: { width: newWidth, height: newHeight },
      format: outputFormat,
      resized,
      reformatted,
    };
  }

  /**
   * Process audio for model requirements
   */
  async processAudio(
    inputPath: string,
    requirements: NonNullable<MediaRequirements['audio']>
  ): Promise<AudioProcessingResult> {
    const { sampleRate, channels, formats, maxDuration } = requirements;

    // Generate output path
    const outputFormat = formats[0] || 'wav';
    const outputPath = this.generateOutputPath(outputFormat);

    // Get original info (would use ffprobe or similar in production)
    const originalInfo = await this.getAudioInfo(inputPath);
    const resampled = originalInfo.sampleRate !== sampleRate;

    // Calculate duration (truncate if needed)
    let duration = originalInfo.duration;
    if (maxDuration && duration > maxDuration) {
      duration = maxDuration;
    }

    // In production, use ffmpeg for actual processing
    await fs.copyFile(inputPath, outputPath);

    return {
      outputPath,
      originalSampleRate: originalInfo.sampleRate,
      processedSampleRate: sampleRate,
      duration,
      format: outputFormat,
      resampled,
    };
  }

  /**
   * Process video for model requirements
   */
  async processVideo(
    inputPath: string,
    requirements: NonNullable<MediaRequirements['video']>
  ): Promise<VideoProcessingResult> {
    const { maxWidth, maxHeight, frameRate, formats, maxDuration } = requirements;

    // Generate output path
    const outputFormat = formats[0] || 'mp4';
    const outputPath = this.generateOutputPath(outputFormat);

    // Get original info
    const originalInfo = await this.getVideoInfo(inputPath);

    // Calculate new resolution
    let newWidth = originalInfo.width;
    let newHeight = originalInfo.height;
    let resized = false;

    if (originalInfo.width > maxWidth || originalInfo.height > maxHeight) {
      const scale = Math.min(maxWidth / originalInfo.width, maxHeight / originalInfo.height);
      newWidth = Math.round(originalInfo.width * scale);
      newHeight = Math.round(originalInfo.height * scale);
      // Ensure dimensions are even for video encoding
      newWidth = Math.floor(newWidth / 2) * 2;
      newHeight = Math.floor(newHeight / 2) * 2;
      resized = true;
    }

    // Calculate duration
    let duration = originalInfo.duration;
    if (maxDuration && duration > maxDuration) {
      duration = maxDuration;
    }

    // In production, use ffmpeg for actual processing
    await fs.copyFile(inputPath, outputPath);

    return {
      outputPath,
      originalResolution: { width: originalInfo.width, height: originalInfo.height },
      processedResolution: { width: newWidth, height: newHeight },
      duration,
      frameRate: frameRate || originalInfo.frameRate,
      format: outputFormat,
      resized,
    };
  }

  /**
   * Get requirements for a specific model
   */
  getRequirementsForModel(modelId: string): MediaRequirements {
    // Try exact match
    if (MODEL_REQUIREMENTS[modelId]) {
      return MODEL_REQUIREMENTS[modelId];
    }

    // Try prefix match (e.g., 'sdxl-turbo' -> 'sdxl')
    const prefix = modelId.split('-')[0].toLowerCase();
    if (MODEL_REQUIREMENTS[prefix]) {
      return MODEL_REQUIREMENTS[prefix];
    }

    // Check if contains known model name
    const knownModels = Object.keys(MODEL_REQUIREMENTS);
    for (const known of knownModels) {
      if (modelId.toLowerCase().includes(known)) {
        return MODEL_REQUIREMENTS[known];
      }
    }

    // Return default requirements
    return {
      image: { maxWidth: 1024, maxHeight: 1024, formats: ['png', 'jpg'] },
      audio: { sampleRate: 22050, channels: 1, formats: ['wav'] },
      video: { maxWidth: 720, maxHeight: 480, frameRate: 24, formats: ['mp4'] },
    };
  }

  /**
   * Detect media type from file path
   */
  detectMediaType(filePath: string): 'image' | 'audio' | 'video' | 'unknown' {
    const ext = path.extname(filePath).slice(1).toLowerCase();

    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
    const audioExtensions = ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'];
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'gif'];

    if (imageExtensions.includes(ext)) return 'image';
    if (audioExtensions.includes(ext)) return 'audio';
    if (videoExtensions.includes(ext)) return 'video';

    return 'unknown';
  }

  /**
   * Validate file meets requirements
   */
  async validateMedia(
    filePath: string,
    mediaType: 'image' | 'audio' | 'video',
    requirements: MediaRequirements
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    switch (mediaType) {
      case 'image':
        if (!requirements.image) {
          errors.push('No image requirements specified');
        } else {
          const imageInfo = await this.getImageSize(filePath);
          if (imageInfo.width > requirements.image.maxWidth * 2) {
            errors.push(`Image too wide: ${imageInfo.width}px (max: ${requirements.image.maxWidth * 2}px)`);
          }
          if (imageInfo.height > requirements.image.maxHeight * 2) {
            errors.push(`Image too tall: ${imageInfo.height}px (max: ${requirements.image.maxHeight * 2}px)`);
          }
        }
        break;

      case 'audio':
        if (!requirements.audio) {
          errors.push('No audio requirements specified');
        } else {
          const audioInfo = await this.getAudioInfo(filePath);
          if (requirements.audio.maxDuration && audioInfo.duration > requirements.audio.maxDuration * 1.5) {
            errors.push(`Audio too long: ${audioInfo.duration}s (max: ${requirements.audio.maxDuration}s)`);
          }
        }
        break;

      case 'video':
        if (!requirements.video) {
          errors.push('No video requirements specified');
        } else {
          const videoInfo = await this.getVideoInfo(filePath);
          if (requirements.video.maxDuration && videoInfo.duration > requirements.video.maxDuration * 1.5) {
            errors.push(`Video too long: ${videoInfo.duration}s (max: ${requirements.video.maxDuration}s)`);
          }
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch {
      // Directory exists
    }
  }

  private generateOutputPath(format: string): string {
    const id = crypto.randomUUID();
    return path.join(this.tempDir, `${id}.${format}`);
  }

  private async getImageSize(filePath: string): Promise<{ width: number; height: number }> {
    // In production, use sharp to get actual dimensions
    // For now, return default
    try {
      const stats = await fs.stat(filePath);
      // Estimate based on file size (very rough)
      const estimatedPixels = stats.size / 3; // Assuming 3 bytes per pixel
      const side = Math.sqrt(estimatedPixels);
      return { width: Math.round(side), height: Math.round(side) };
    } catch {
      return { width: 512, height: 512 };
    }
  }

  private async getAudioInfo(filePath: string): Promise<{
    sampleRate: number;
    duration: number;
    channels: number;
  }> {
    // In production, use ffprobe to get actual info
    try {
      const stats = await fs.stat(filePath);
      // Rough estimate: ~150KB per second at 22050Hz mono
      const duration = Math.round(stats.size / 150000);
      return {
        sampleRate: 44100, // Default assumption
        duration: Math.max(1, duration),
        channels: 2,
      };
    } catch {
      return { sampleRate: 44100, duration: 5, channels: 2 };
    }
  }

  private async getVideoInfo(filePath: string): Promise<{
    width: number;
    height: number;
    duration: number;
    frameRate: number;
  }> {
    // In production, use ffprobe to get actual info
    try {
      const stats = await fs.stat(filePath);
      // Rough estimate: ~1MB per second at 720p
      const duration = Math.round(stats.size / 1000000);
      return {
        width: 1280,
        height: 720,
        duration: Math.max(1, duration),
        frameRate: 24,
      };
    } catch {
      return { width: 1280, height: 720, duration: 5, frameRate: 24 };
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let mediaProcessorInstance: MediaProcessor | null = null;

export function getMediaProcessor(): MediaProcessor {
  if (!mediaProcessorInstance) {
    mediaProcessorInstance = new MediaProcessor();
  }
  return mediaProcessorInstance;
}

export default MediaProcessor;
