/**
 * Modal File Operations
 *
 * Real file operations for Modal sandboxes.
 * Provides the FileWriter interface implementation that
 * the TaskExecutor uses to write generated code.
 *
 * Two modes:
 * 1. Direct Mode: Uses Modal snapshot client for immediate operations
 * 2. Volume Mode: Uses shared volumes for persistent storage
 *
 * Features:
 * - Atomic file writes
 * - Directory creation
 * - File existence checks
 * - Content hashing for change detection
 * - Batched operations for efficiency
 */

import { EventEmitter } from 'events';
import { ModalSnapshotClient } from '../cloud/modal-snapshot-client';
import { ModalSharedVolume } from '../cloud/modal-shared-volume';

// =============================================================================
// TYPES
// =============================================================================

export interface FileOperation {
  operationId: string;
  type: 'write' | 'read' | 'delete' | 'exists' | 'mkdir';
  filePath: string;
  content?: string;
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export interface FileWriterConfig {
  mode: 'direct' | 'volume';
  rootPath: string;
  createDirectories: boolean;
  atomicWrites: boolean;
  batchDelayMs: number;
  maxBatchSize: number;
  timeoutMs: number;
}

export interface FileStats {
  path: string;
  exists: boolean;
  size?: number;
  hash?: string;
  lastModified?: Date;
}

export interface BatchResult {
  successful: number;
  failed: number;
  operations: FileOperation[];
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_FILE_WRITER_CONFIG: FileWriterConfig = {
  mode: 'direct',
  rootPath: '/workspace',
  createDirectories: true,
  atomicWrites: true,
  batchDelayMs: 100,
  maxBatchSize: 20,
  timeoutMs: 30000,
};

// =============================================================================
// MODAL FILE OPERATIONS
// =============================================================================

export class ModalFileOperations extends EventEmitter {
  private config: FileWriterConfig;
  private snapshotClient: ModalSnapshotClient | null = null;
  private sharedVolume: ModalSharedVolume | null = null;
  private pendingWrites: Map<string, { content: string; resolve: () => void; reject: (err: Error) => void }> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private operationLog: FileOperation[] = [];
  private operationCount = 0;

  constructor(config: Partial<FileWriterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_FILE_WRITER_CONFIG, ...config };
  }

  /**
   * Initialize with a Modal snapshot client.
   */
  setSnapshotClient(client: ModalSnapshotClient): void {
    this.snapshotClient = client;
  }

  /**
   * Initialize with a shared volume.
   */
  setSharedVolume(volume: ModalSharedVolume): void {
    this.sharedVolume = volume;
    this.config.mode = 'volume';
  }

  // ===========================================================================
  // FILE OPERATIONS (FileWriter interface)
  // ===========================================================================

  /**
   * Write a file.
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const operation = this.createOperation('write', fullPath, content);

    this.emit('file:write-started', { path: fullPath });

    try {
      // Create directories if needed
      if (this.config.createDirectories) {
        await this.ensureDirectory(fullPath);
      }

      if (this.config.atomicWrites && this.config.batchDelayMs > 0) {
        // Queue for batched write
        await this.queueWrite(fullPath, content, operation);
      } else {
        // Immediate write
        await this.executeWrite(fullPath, content, operation);
      }

      operation.status = 'completed';
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      this.emit('file:write-completed', { path: fullPath, size: content.length });

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      this.emit('file:write-failed', { path: fullPath, error: operation.error });
      throw error;
    }
  }

  /**
   * Read a file.
   */
  async readFile(filePath: string): Promise<string | null> {
    const fullPath = this.resolvePath(filePath);
    const operation = this.createOperation('read', fullPath);

    this.emit('file:read-started', { path: fullPath });

    try {
      let content: string | null = null;

      if (this.config.mode === 'direct' && this.snapshotClient) {
        const result = await this.snapshotClient.readFile(fullPath);
        if (result.success && result.result) {
          content = (result.result as { content: string }).content;
        }
      } else if (this.config.mode === 'volume' && this.sharedVolume) {
        content = await this.sharedVolume.readFile(fullPath);
      }

      operation.status = 'completed';
      operation.result = content ? { size: content.length } : null;
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      this.emit('file:read-completed', {
        path: fullPath,
        found: content !== null,
        size: content?.length,
      });

      return content;

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      // Read failures might just mean file doesn't exist
      this.emit('file:read-failed', { path: fullPath, error: operation.error });
      return null;
    }
  }

  /**
   * Delete a file.
   */
  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const operation = this.createOperation('delete', fullPath);

    this.emit('file:delete-started', { path: fullPath });

    try {
      if (this.config.mode === 'direct' && this.snapshotClient) {
        await this.snapshotClient.exec(['rm', '-f', fullPath]);
      } else if (this.config.mode === 'volume' && this.sharedVolume) {
        await this.sharedVolume.deleteFile(fullPath);
      }

      operation.status = 'completed';
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      this.emit('file:delete-completed', { path: fullPath });

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      this.emit('file:delete-failed', { path: fullPath, error: operation.error });
      throw error;
    }
  }

  /**
   * Check if a file exists.
   */
  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);
    const operation = this.createOperation('exists', fullPath);

    try {
      let exists = false;

      if (this.config.mode === 'direct' && this.snapshotClient) {
        const result = await this.snapshotClient.exec(['test', '-f', fullPath]);
        exists = result.success && (result.result as { exit_code: number }).exit_code === 0;
      } else if (this.config.mode === 'volume' && this.sharedVolume) {
        exists = await this.sharedVolume.fileExists(fullPath);
      }

      operation.status = 'completed';
      operation.result = { exists };
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      return exists;

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.durationMs = Date.now() - operation.timestamp.getTime();

      return false;
    }
  }

  // ===========================================================================
  // DIRECTORY OPERATIONS
  // ===========================================================================

  /**
   * Ensure directory exists for a file path.
   */
  private async ensureDirectory(filePath: string): Promise<void> {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));

    if (!dirPath || dirPath === this.config.rootPath) {
      return;
    }

    if (this.config.mode === 'direct' && this.snapshotClient) {
      await this.snapshotClient.exec(['mkdir', '-p', dirPath]);
    } else if (this.config.mode === 'volume' && this.sharedVolume) {
      await this.sharedVolume.createDirectory(dirPath);
    }
  }

  /**
   * List files in a directory.
   */
  async listFiles(dirPath: string): Promise<string[]> {
    const fullPath = this.resolvePath(dirPath);

    if (this.config.mode === 'direct' && this.snapshotClient) {
      const result = await this.snapshotClient.exec(['ls', '-1', fullPath]);
      if (result.success) {
        const output = (result.result as { stdout: string }).stdout;
        return output.split('\n').filter(Boolean);
      }
    } else if (this.config.mode === 'volume' && this.sharedVolume) {
      return this.sharedVolume.listFiles(fullPath);
    }

    return [];
  }

  // ===========================================================================
  // BATCHED WRITES
  // ===========================================================================

  /**
   * Queue a write for batched execution.
   */
  private queueWrite(
    filePath: string,
    content: string,
    operation: FileOperation
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingWrites.set(filePath, { content, resolve, reject });

      // Schedule batch execution
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.executeBatch();
        }, this.config.batchDelayMs);
      }

      // Execute immediately if batch is full
      if (this.pendingWrites.size >= this.config.maxBatchSize) {
        if (this.batchTimeout) {
          clearTimeout(this.batchTimeout);
          this.batchTimeout = null;
        }
        this.executeBatch();
      }
    });
  }

  /**
   * Execute all pending writes as a batch.
   */
  private async executeBatch(): Promise<void> {
    this.batchTimeout = null;

    const batch = new Map(this.pendingWrites);
    this.pendingWrites.clear();

    if (batch.size === 0) {
      return;
    }

    this.emit('batch:started', { count: batch.size });

    const results: { path: string; success: boolean; error?: string }[] = [];

    for (const [filePath, { content, resolve, reject }] of batch) {
      try {
        await this.executeWrite(filePath, content, this.createOperation('write', filePath));
        results.push({ path: filePath, success: true });
        resolve();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ path: filePath, success: false, error: errorMessage });
        reject(error instanceof Error ? error : new Error(errorMessage));
      }
    }

    this.emit('batch:completed', {
      total: batch.size,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });
  }

  /**
   * Execute a single write operation.
   */
  private async executeWrite(
    filePath: string,
    content: string,
    operation: FileOperation
  ): Promise<void> {
    operation.status = 'executing';

    if (this.config.mode === 'direct' && this.snapshotClient) {
      const result = await this.snapshotClient.writeFile(filePath, content);

      if (!result.success) {
        throw new Error(result.error || 'Write failed');
      }
    } else if (this.config.mode === 'volume' && this.sharedVolume) {
      await this.sharedVolume.writeFile(filePath, content);
    } else {
      throw new Error('No file writer backend configured');
    }
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Resolve a relative path to absolute.
   */
  private resolvePath(filePath: string): string {
    if (filePath.startsWith('/')) {
      return filePath;
    }
    return `${this.config.rootPath}/${filePath}`;
  }

  /**
   * Create an operation record.
   */
  private createOperation(
    type: FileOperation['type'],
    filePath: string,
    content?: string
  ): FileOperation {
    const operation: FileOperation = {
      operationId: `op-${++this.operationCount}`,
      type,
      filePath,
      content,
      timestamp: new Date(),
      status: 'pending',
    };

    this.operationLog.push(operation);

    // Keep log bounded
    if (this.operationLog.length > 1000) {
      this.operationLog = this.operationLog.slice(-500);
    }

    return operation;
  }

  /**
   * Calculate content hash for change detection.
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // ===========================================================================
  // STATISTICS & DEBUGGING
  // ===========================================================================

  /**
   * Get operation statistics.
   */
  getStats(): {
    totalOperations: number;
    byType: Record<FileOperation['type'], number>;
    byStatus: Record<FileOperation['status'], number>;
    averageDurationMs: number;
    pendingWrites: number;
  } {
    const byType: Record<FileOperation['type'], number> = {
      write: 0,
      read: 0,
      delete: 0,
      exists: 0,
      mkdir: 0,
    };

    const byStatus: Record<FileOperation['status'], number> = {
      pending: 0,
      executing: 0,
      completed: 0,
      failed: 0,
    };

    let totalDuration = 0;
    let completedCount = 0;

    for (const op of this.operationLog) {
      byType[op.type]++;
      byStatus[op.status]++;

      if (op.durationMs !== undefined) {
        totalDuration += op.durationMs;
        completedCount++;
      }
    }

    return {
      totalOperations: this.operationLog.length,
      byType,
      byStatus,
      averageDurationMs: completedCount > 0 ? totalDuration / completedCount : 0,
      pendingWrites: this.pendingWrites.size,
    };
  }

  /**
   * Get recent operations for debugging.
   */
  getRecentOperations(limit = 50): FileOperation[] {
    return this.operationLog.slice(-limit);
  }

  /**
   * Check if backend is ready.
   */
  isReady(): boolean {
    return !!(
      (this.config.mode === 'direct' && this.snapshotClient) ||
      (this.config.mode === 'volume' && this.sharedVolume)
    );
  }

  /**
   * Flush pending operations.
   */
  async flush(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.pendingWrites.size > 0) {
      await this.executeBatch();
    }
  }

  /**
   * Clear operation log.
   */
  clearLog(): void {
    this.operationLog = [];
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create Modal file operations handler.
 */
export function createModalFileOperations(
  config?: Partial<FileWriterConfig>
): ModalFileOperations {
  return new ModalFileOperations(config);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a FileWriter adapter for TaskExecutor.
 */
export function createFileWriterAdapter(
  modalOps: ModalFileOperations
): {
  writeFile: (filePath: string, content: string) => Promise<void>;
  readFile: (filePath: string) => Promise<string | null>;
  deleteFile: (filePath: string) => Promise<void>;
  fileExists: (filePath: string) => Promise<boolean>;
} {
  return {
    writeFile: (filePath, content) => modalOps.writeFile(filePath, content),
    readFile: (filePath) => modalOps.readFile(filePath),
    deleteFile: (filePath) => modalOps.deleteFile(filePath),
    fileExists: (filePath) => modalOps.fileExists(filePath),
  };
}
