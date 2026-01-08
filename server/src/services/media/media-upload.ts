/**
 * Media Upload Service
 *
 * Handles media file uploads with validation, chunked upload support,
 * and integration with cloud storage (S3, local).
 * Part of KripTik AI's Training & Fine-Tuning Platform.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { MediaProcessor, getMediaProcessor } from './media-processor.js';

// =============================================================================
// TYPES
// =============================================================================

export interface UploadOptions {
  userId: string;
  projectId?: string;
  datasetId?: string;
  modality: 'image' | 'audio' | 'video' | 'text';
  maxFileSize?: number;
  allowedFormats?: string[];
  processForModel?: string;
}

export interface UploadResult {
  id: string;
  fileName: string;
  originalPath: string;
  processedPath?: string;
  size: number;
  format: string;
  mediaType: 'image' | 'audio' | 'video' | 'text' | 'unknown';
  checksum: string;
  metadata: Record<string, unknown>;
  processingInfo?: {
    resized: boolean;
    reformatted: boolean;
    originalSize?: { width: number; height: number };
    processedSize?: { width: number; height: number };
    originalSampleRate?: number;
    processedSampleRate?: number;
    duration?: number;
  };
  uploadedAt: string;
}

export interface ChunkedUploadSession {
  id: string;
  userId: string;
  fileName: string;
  totalChunks: number;
  receivedChunks: number[];
  totalSize: number;
  tempPath: string;
  expiresAt: Date;
  status: 'pending' | 'uploading' | 'complete' | 'failed';
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const UPLOAD_SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

const ALLOWED_FORMATS: Record<string, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'],
  audio: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac', 'wma'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'],
  text: ['txt', 'json', 'jsonl', 'csv', 'parquet'],
};

// =============================================================================
// MEDIA UPLOAD SERVICE
// =============================================================================

export class MediaUploadService {
  private uploadDir: string;
  private tempDir: string;
  private mediaProcessor: MediaProcessor;
  private uploadSessions: Map<string, ChunkedUploadSession> = new Map();

  constructor(
    uploadDir: string = '/data/uploads',
    tempDir: string = '/tmp/kriptik-uploads'
  ) {
    this.uploadDir = uploadDir;
    this.tempDir = tempDir;
    this.mediaProcessor = getMediaProcessor();
    this.initialize();
  }

  /**
   * Upload a single file
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    const { userId, modality, maxFileSize, allowedFormats, processForModel } = options;

    // Validate file size
    const maxSize = maxFileSize || DEFAULT_MAX_FILE_SIZE;
    if (buffer.length > maxSize) {
      throw new Error(`File too large: ${buffer.length} bytes (max: ${maxSize} bytes)`);
    }

    // Validate format
    const ext = path.extname(fileName).slice(1).toLowerCase();
    const formats = allowedFormats || ALLOWED_FORMATS[modality] || [];
    if (formats.length > 0 && !formats.includes(ext)) {
      throw new Error(`Invalid format: ${ext}. Allowed: ${formats.join(', ')}`);
    }

    // Generate unique ID and paths
    const id = crypto.randomUUID();
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const userDir = path.join(this.uploadDir, userId, modality);
    await fs.mkdir(userDir, { recursive: true });

    const originalPath = path.join(userDir, `${id}_${sanitizedFileName}`);
    
    // Write file
    await fs.writeFile(originalPath, buffer);

    // Calculate checksum
    const checksum = this.calculateChecksum(buffer);

    // Detect media type
    const mediaType = this.mediaProcessor.detectMediaType(originalPath);

    // Process for model if specified
    let processedPath: string | undefined;
    let processingInfo: UploadResult['processingInfo'];

    if (processForModel && mediaType !== 'unknown') {
      const requirements = this.mediaProcessor.getRequirementsForModel(processForModel);

      try {
        if (mediaType === 'image' && requirements.image) {
          const result = await this.mediaProcessor.processImage(originalPath, requirements.image);
          processedPath = result.outputPath;
          processingInfo = {
            resized: result.resized,
            reformatted: result.reformatted,
            originalSize: result.originalSize,
            processedSize: result.processedSize,
          };
        } else if (mediaType === 'audio' && requirements.audio) {
          const result = await this.mediaProcessor.processAudio(originalPath, requirements.audio);
          processedPath = result.outputPath;
          processingInfo = {
            resized: false,
            reformatted: false,
            originalSampleRate: result.originalSampleRate,
            processedSampleRate: result.processedSampleRate,
            duration: result.duration,
          };
        } else if (mediaType === 'video' && requirements.video) {
          const result = await this.mediaProcessor.processVideo(originalPath, requirements.video);
          processedPath = result.outputPath;
          processingInfo = {
            resized: result.resized,
            reformatted: false,
            originalSize: result.originalResolution,
            processedSize: result.processedResolution,
            duration: result.duration,
          };
        }
      } catch (error) {
        console.error('Error processing media:', error);
        // Continue without processing
      }
    }

    // Get file stats
    const stats = await fs.stat(originalPath);

    return {
      id,
      fileName: sanitizedFileName,
      originalPath,
      processedPath,
      size: stats.size,
      format: ext,
      mediaType,
      checksum,
      metadata: {
        modality,
        projectId: options.projectId,
        datasetId: options.datasetId,
        processForModel,
      },
      processingInfo,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Initialize chunked upload session
   */
  async initChunkedUpload(
    userId: string,
    fileName: string,
    totalSize: number,
    totalChunks: number
  ): Promise<ChunkedUploadSession> {
    const id = crypto.randomUUID();
    const tempPath = path.join(this.tempDir, `chunked_${id}`);
    
    await fs.mkdir(tempPath, { recursive: true });

    const session: ChunkedUploadSession = {
      id,
      userId,
      fileName,
      totalChunks,
      receivedChunks: [],
      totalSize,
      tempPath,
      expiresAt: new Date(Date.now() + UPLOAD_SESSION_EXPIRY),
      status: 'pending',
    };

    this.uploadSessions.set(id, session);

    return session;
  }

  /**
   * Upload a chunk
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    buffer: Buffer
  ): Promise<{ received: number; total: number; complete: boolean }> {
    const session = this.uploadSessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.status === 'failed' || session.status === 'complete') {
      throw new Error(`Upload session is ${session.status}`);
    }

    if (new Date() > session.expiresAt) {
      session.status = 'failed';
      throw new Error('Upload session expired');
    }

    // Write chunk to temp directory
    const chunkPath = path.join(session.tempPath, `chunk_${chunkIndex}`);
    await fs.writeFile(chunkPath, buffer);

    // Mark chunk as received
    if (!session.receivedChunks.includes(chunkIndex)) {
      session.receivedChunks.push(chunkIndex);
    }

    session.status = 'uploading';

    const complete = session.receivedChunks.length === session.totalChunks;

    return {
      received: session.receivedChunks.length,
      total: session.totalChunks,
      complete,
    };
  }

  /**
   * Complete chunked upload and assemble file
   */
  async completeChunkedUpload(
    sessionId: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    const session = this.uploadSessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.receivedChunks.length !== session.totalChunks) {
      throw new Error(`Missing chunks: received ${session.receivedChunks.length}/${session.totalChunks}`);
    }

    // Sort chunks
    session.receivedChunks.sort((a, b) => a - b);

    // Assemble file
    const chunks: Buffer[] = [];
    for (const chunkIndex of session.receivedChunks) {
      const chunkPath = path.join(session.tempPath, `chunk_${chunkIndex}`);
      const chunkData = await fs.readFile(chunkPath);
      chunks.push(chunkData);
    }

    const assembledBuffer = Buffer.concat(chunks);

    // Clean up temp files
    try {
      await fs.rm(session.tempPath, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    session.status = 'complete';
    this.uploadSessions.delete(sessionId);

    // Upload assembled file
    return this.uploadFile(assembledBuffer, session.fileName, options);
  }

  /**
   * Cancel chunked upload
   */
  async cancelChunkedUpload(sessionId: string): Promise<void> {
    const session = this.uploadSessions.get(sessionId);
    if (!session) {
      return;
    }

    // Clean up temp files
    try {
      await fs.rm(session.tempPath, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    session.status = 'failed';
    this.uploadSessions.delete(sessionId);
  }

  /**
   * Get upload session status
   */
  getUploadSession(sessionId: string): ChunkedUploadSession | null {
    return this.uploadSessions.get(sessionId) || null;
  }

  /**
   * Batch upload multiple files
   */
  async batchUpload(
    files: Array<{ buffer: Buffer; fileName: string }>,
    options: UploadOptions
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    // Process in parallel with concurrency limit
    const CONCURRENCY = 5;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((file) => this.uploadFile(file.buffer, file.fileName, options))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({
            fileName: batch[j].fileName,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          });
        }
      }
    }

    if (errors.length > 0) {
      console.warn('Some files failed to upload:', errors);
    }

    return results;
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    createdAt?: Date;
    modifiedAt?: Date;
    format?: string;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        format: path.extname(filePath).slice(1).toLowerCase(),
      };
    } catch {
      return { exists: false };
    }
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error initializing MediaUploadService:', error);
    }

    // Clean up expired sessions periodically
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000); // Every hour
  }

  private sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts and special characters
    return fileName
      .replace(/[/\\]/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 255);
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [sessionId, session] of this.uploadSessions) {
      if (now > session.expiresAt) {
        await this.cancelChunkedUpload(sessionId);
      }
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let mediaUploadServiceInstance: MediaUploadService | null = null;

export function getMediaUploadService(): MediaUploadService {
  if (!mediaUploadServiceInstance) {
    mediaUploadServiceInstance = new MediaUploadService();
  }
  return mediaUploadServiceInstance;
}

export default MediaUploadService;
