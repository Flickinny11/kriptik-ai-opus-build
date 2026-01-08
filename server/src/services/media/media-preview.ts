/**
 * Media Preview Service
 *
 * Generates thumbnails, previews, and waveforms for media files.
 * Supports image, audio, and video previews.
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface PreviewOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpg' | 'webp';
  quality?: number;
}

export interface ImagePreview {
  thumbnailPath: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface AudioPreview {
  waveformPath: string;
  duration: number;
  sampleRate: number;
  channels: number;
  peaks: number[];
}

export interface VideoPreview {
  thumbnailPath: string;
  width: number;
  height: number;
  duration: number;
  frameCount: number;
  frames: string[];
}

export interface PreviewResult {
  type: 'image' | 'audio' | 'video';
  preview: ImagePreview | AudioPreview | VideoPreview;
  generatedAt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_THUMBNAIL_WIDTH = 256;
const DEFAULT_THUMBNAIL_HEIGHT = 256;
const DEFAULT_WAVEFORM_SAMPLES = 100;
const DEFAULT_VIDEO_FRAMES = 4;

// =============================================================================
// MEDIA PREVIEW SERVICE
// =============================================================================

export class MediaPreviewService {
  private cacheDir: string;
  private previewCache: Map<string, PreviewResult> = new Map();

  constructor(cacheDir: string = '/tmp/kriptik-previews') {
    this.cacheDir = cacheDir;
    this.initialize();
  }

  /**
   * Generate preview for any media type
   */
  async generatePreview(
    filePath: string,
    mediaType: 'image' | 'audio' | 'video',
    options: PreviewOptions = {}
  ): Promise<PreviewResult> {
    // Check cache
    const cacheKey = this.getCacheKey(filePath, options);
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let result: PreviewResult;

    switch (mediaType) {
      case 'image':
        result = {
          type: 'image',
          preview: await this.generateImagePreview(filePath, options),
          generatedAt: new Date().toISOString(),
        };
        break;
      case 'audio':
        result = {
          type: 'audio',
          preview: await this.generateAudioPreview(filePath, options),
          generatedAt: new Date().toISOString(),
        };
        break;
      case 'video':
        result = {
          type: 'video',
          preview: await this.generateVideoPreview(filePath, options),
          generatedAt: new Date().toISOString(),
        };
        break;
    }

    // Cache result
    this.previewCache.set(cacheKey, result);

    return result;
  }

  /**
   * Generate image thumbnail
   */
  async generateImagePreview(
    filePath: string,
    options: PreviewOptions = {}
  ): Promise<ImagePreview> {
    const width = options.width || DEFAULT_THUMBNAIL_WIDTH;
    const height = options.height || DEFAULT_THUMBNAIL_HEIGHT;
    const format = options.format || 'png';

    // Generate thumbnail path
    const thumbnailPath = this.generatePreviewPath(filePath, `thumb_${width}x${height}.${format}`);

    // In production, use sharp for actual thumbnail generation
    // For now, create a placeholder
    try {
      // Copy original as "thumbnail" (in production, resize)
      await fs.copyFile(filePath, thumbnailPath);
      const stats = await fs.stat(thumbnailPath);

      return {
        thumbnailPath,
        width,
        height,
        format,
        size: stats.size,
      };
    } catch (error) {
      // Return placeholder
      return {
        thumbnailPath: '',
        width,
        height,
        format,
        size: 0,
      };
    }
  }

  /**
   * Generate audio waveform
   */
  async generateAudioPreview(
    filePath: string,
    options: PreviewOptions = {}
  ): Promise<AudioPreview> {
    const width = options.width || 800;
    const numSamples = Math.min(width, DEFAULT_WAVEFORM_SAMPLES * 4);

    // Generate waveform image path
    const waveformPath = this.generatePreviewPath(filePath, `waveform_${numSamples}.png`);

    // In production, use audiowaveform or similar for actual waveform generation
    // For now, generate simulated data
    try {
      const stats = await fs.stat(filePath);
      const estimatedDuration = Math.max(1, Math.round(stats.size / 150000));

      // Generate simulated waveform peaks
      const peaks: number[] = [];
      for (let i = 0; i < numSamples; i++) {
        // Generate smooth random waveform
        const base = Math.sin(i * 0.1) * 0.3;
        const noise = (Math.random() - 0.5) * 0.4;
        peaks.push(Math.abs(base + noise + 0.5));
      }

      // Create simple SVG waveform
      const svg = this.generateWaveformSVG(peaks, width, 100);
      await fs.writeFile(waveformPath, svg);

      return {
        waveformPath,
        duration: estimatedDuration,
        sampleRate: 44100,
        channels: 2,
        peaks,
      };
    } catch (error) {
      return {
        waveformPath: '',
        duration: 0,
        sampleRate: 44100,
        channels: 2,
        peaks: [],
      };
    }
  }

  /**
   * Generate video thumbnails
   */
  async generateVideoPreview(
    filePath: string,
    options: PreviewOptions = {}
  ): Promise<VideoPreview> {
    const width = options.width || DEFAULT_THUMBNAIL_WIDTH;
    const height = options.height || DEFAULT_THUMBNAIL_HEIGHT;
    const numFrames = DEFAULT_VIDEO_FRAMES;

    // Generate thumbnail path
    const thumbnailPath = this.generatePreviewPath(filePath, `thumb_${width}x${height}.png`);

    // In production, use ffmpeg for actual frame extraction
    // For now, return placeholder data
    try {
      const stats = await fs.stat(filePath);
      const estimatedDuration = Math.max(1, Math.round(stats.size / 1000000));

      // Generate placeholder frame paths
      const frames: string[] = [];
      for (let i = 0; i < numFrames; i++) {
        const framePath = this.generatePreviewPath(filePath, `frame_${i}_${width}x${height}.png`);
        frames.push(framePath);
      }

      return {
        thumbnailPath,
        width,
        height,
        duration: estimatedDuration,
        frameCount: numFrames,
        frames,
      };
    } catch (error) {
      return {
        thumbnailPath: '',
        width,
        height,
        duration: 0,
        frameCount: 0,
        frames: [],
      };
    }
  }

  /**
   * Generate comparison preview (before/after)
   */
  async generateComparisonPreview(
    originalPath: string,
    processedPath: string,
    mediaType: 'image' | 'audio' | 'video',
    options: PreviewOptions = {}
  ): Promise<{
    original: PreviewResult;
    processed: PreviewResult;
  }> {
    const [original, processed] = await Promise.all([
      this.generatePreview(originalPath, mediaType, options),
      this.generatePreview(processedPath, mediaType, options),
    ]);

    return { original, processed };
  }

  /**
   * Get dataset preview (sample of files)
   */
  async generateDatasetPreview(
    filePaths: string[],
    mediaType: 'image' | 'audio' | 'video',
    sampleSize: number = 9,
    options: PreviewOptions = {}
  ): Promise<PreviewResult[]> {
    // Sample files
    const sampled = this.sampleArray(filePaths, sampleSize);

    // Generate previews in parallel
    const previews = await Promise.all(
      sampled.map((filePath) =>
        this.generatePreview(filePath, mediaType, options).catch(() => null)
      )
    );

    return previews.filter((p): p is PreviewResult => p !== null);
  }

  /**
   * Clear preview cache
   */
  async clearCache(filePath?: string): Promise<void> {
    if (filePath) {
      // Clear cache for specific file
      const keysToDelete: string[] = [];
      for (const key of this.previewCache.keys()) {
        if (key.includes(filePath)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.previewCache.delete(key));
    } else {
      // Clear all cache
      this.previewCache.clear();
    }
  }

  /**
   * Get preview info
   */
  async getPreviewInfo(filePath: string): Promise<{
    hasCachedPreview: boolean;
    previewTypes: string[];
    lastGenerated?: string;
  }> {
    const previewTypes: string[] = [];
    let lastGenerated: string | undefined;

    for (const [key, value] of this.previewCache) {
      if (key.includes(filePath)) {
        previewTypes.push(value.type);
        if (!lastGenerated || value.generatedAt > lastGenerated) {
          lastGenerated = value.generatedAt;
        }
      }
    }

    return {
      hasCachedPreview: previewTypes.length > 0,
      previewTypes,
      lastGenerated,
    };
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Error initializing MediaPreviewService:', error);
    }
  }

  private getCacheKey(filePath: string, options: PreviewOptions): string {
    const optStr = JSON.stringify(options);
    return crypto.createHash('md5').update(`${filePath}:${optStr}`).digest('hex');
  }

  private generatePreviewPath(originalPath: string, suffix: string): string {
    const hash = crypto.createHash('md5').update(originalPath).digest('hex');
    return path.join(this.cacheDir, `${hash}_${suffix}`);
  }

  private generateWaveformSVG(peaks: number[], width: number, height: number): string {
    const barWidth = width / peaks.length;
    const bars = peaks
      .map((peak, i) => {
        const barHeight = peak * height;
        const x = i * barWidth;
        const y = (height - barHeight) / 2;
        return `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" fill="#4CAF50"/>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1a1a2e"/>
  ${bars}
</svg>`;
  }

  private sampleArray<T>(array: T[], size: number): T[] {
    if (array.length <= size) {
      return array;
    }

    const sampled: T[] = [];
    const step = array.length / size;
    
    for (let i = 0; i < size; i++) {
      const index = Math.floor(i * step);
      sampled.push(array[index]);
    }

    return sampled;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let mediaPreviewServiceInstance: MediaPreviewService | null = null;

export function getMediaPreviewService(): MediaPreviewService {
  if (!mediaPreviewServiceInstance) {
    mediaPreviewServiceInstance = new MediaPreviewService();
  }
  return mediaPreviewServiceInstance;
}

export default MediaPreviewService;
