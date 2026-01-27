/**
 * Artifact Packager Service
 *
 * Packages completed builds into WebContainer-compatible artifacts.
 * This solves the "always-on preview" billing problem by enabling
 * client-side preview hosting via WebContainers.
 *
 * Architecture:
 * 1. Build completes in Modal sandbox
 * 2. Artifact Packager extracts built files
 * 3. Creates manifest with dependency info
 * 4. Uploads to Cloudflare R2 (cheap storage)
 * 5. Frontend loads artifact into WebContainer
 * 6. Preview runs in user's browser (ZERO server cost!)
 *
 * Artifact Contents:
 * - Source files (src/, public/, etc.)
 * - Built output (dist/, .next/, etc.)
 * - Package manifest (package.json + lockfile)
 * - Dependency manifest (for WebContainer npm install)
 * - Build metadata (timestamps, checksums, etc.)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { getModalSnapshotClient, type SnapshotTaskResult } from './modal-snapshot-client.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ArtifactConfig {
  buildId: string;
  sandboxId: string;
  projectName: string;
  framework: 'vite-react' | 'next' | 'remix' | 'astro' | 'generic';
  includeNodeModules: boolean;
  compressionLevel: 'none' | 'fast' | 'best';
}

export interface ArtifactManifest {
  id: string;
  buildId: string;
  projectName: string;
  framework: string;
  version: string;
  createdAt: string;
  files: ArtifactFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  totalSize: number;
  checksum: string;
}

export interface ArtifactFile {
  path: string;
  size: number;
  checksum: string;
  type: 'source' | 'config' | 'asset' | 'build' | 'dependency';
}

export interface PackagedArtifact {
  id: string;
  manifest: ArtifactManifest;
  storageUrl: string;
  webContainerUrl: string;
  expiresAt: string;
}

export interface StorageProvider {
  upload(key: string, data: Buffer | string, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}

// =============================================================================
// ARTIFACT PACKAGER SERVICE
// =============================================================================

export class ArtifactPackagerService extends EventEmitter {
  private snapshotClient = getModalSnapshotClient();
  private storageProvider: StorageProvider | null = null;
  private artifactCache: Map<string, PackagedArtifact> = new Map();

  // Files/directories to always include
  private static INCLUDE_PATTERNS = [
    'src/**/*',
    'public/**/*',
    'app/**/*',
    'pages/**/*',
    'components/**/*',
    'lib/**/*',
    'utils/**/*',
    'styles/**/*',
    'assets/**/*',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'tsconfig.json',
    'vite.config.*',
    'next.config.*',
    'tailwind.config.*',
    'postcss.config.*',
    '.env.example',
    'index.html',
  ];

  // Files/directories to always exclude
  private static EXCLUDE_PATTERNS = [
    'node_modules/**/*',
    '.git/**/*',
    'dist/**/*',
    '.next/**/*',
    '.vercel/**/*',
    '.env',
    '.env.local',
    '.env.production',
    '*.log',
    '.DS_Store',
    'coverage/**/*',
    '.nyc_output/**/*',
  ];

  constructor(storageProvider?: StorageProvider) {
    super();
    this.storageProvider = storageProvider || null;
  }

  // ===========================================================================
  // MAIN PACKAGING METHODS
  // ===========================================================================

  /**
   * Package a build into a WebContainer-compatible artifact.
   *
   * @param config - Packaging configuration
   * @returns Packaged artifact with storage URL
   */
  async packageBuild(config: ArtifactConfig): Promise<PackagedArtifact> {
    const artifactId = uuidv4();
    const startTime = Date.now();

    this.emit('packaging:start', { artifactId, buildId: config.buildId });

    try {
      // Step 1: List files in sandbox
      const files = await this.listBuildFiles(config.sandboxId);
      this.emit('packaging:files-listed', { artifactId, fileCount: files.length });

      // Step 2: Create manifest
      const manifest = await this.createManifest(
        artifactId,
        config,
        files
      );
      this.emit('packaging:manifest-created', { artifactId });

      // Step 3: Package files into archive
      const archive = await this.createArchive(
        config.sandboxId,
        manifest,
        config.compressionLevel
      );
      this.emit('packaging:archive-created', { artifactId, size: archive.length });

      // Step 4: Upload to storage
      let storageUrl = '';
      let webContainerUrl = '';

      if (this.storageProvider) {
        storageUrl = await this.uploadArtifact(artifactId, archive, manifest);
        webContainerUrl = await this.storageProvider.getSignedUrl(
          `artifacts/${artifactId}/archive.tar.gz`,
          24 * 60 * 60 // 24 hours
        );
      } else {
        // Fallback: Store in memory (for development)
        console.warn('[Artifact Packager] No storage provider configured, using memory cache');
        storageUrl = `memory://${artifactId}`;
        webContainerUrl = storageUrl;
      }

      const artifact: PackagedArtifact = {
        id: artifactId,
        manifest,
        storageUrl,
        webContainerUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      this.artifactCache.set(artifactId, artifact);

      const duration = Date.now() - startTime;
      this.emit('packaging:complete', { artifactId, duration });

      console.log(`[Artifact Packager] Packaged build ${config.buildId} in ${duration}ms`);

      return artifact;

    } catch (error) {
      this.emit('packaging:error', {
        artifactId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get artifact by ID.
   */
  getArtifact(artifactId: string): PackagedArtifact | undefined {
    return this.artifactCache.get(artifactId);
  }

  /**
   * Get artifact URL for WebContainer loading.
   */
  async getArtifactUrl(artifactId: string): Promise<string | null> {
    const artifact = this.artifactCache.get(artifactId);

    if (!artifact) {
      return null;
    }

    // Check if URL is expired
    if (new Date(artifact.expiresAt) < new Date()) {
      // Refresh signed URL
      if (this.storageProvider) {
        artifact.webContainerUrl = await this.storageProvider.getSignedUrl(
          `artifacts/${artifactId}/archive.tar.gz`,
          24 * 60 * 60
        );
        artifact.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    }

    return artifact.webContainerUrl;
  }

  /**
   * Clean up old artifacts.
   */
  async cleanupOldArtifacts(maxAgeHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [id, artifact] of this.artifactCache) {
      const createdAt = new Date(artifact.manifest.createdAt);

      if (createdAt < cutoff) {
        // Delete from storage
        if (this.storageProvider) {
          try {
            await this.storageProvider.delete(`artifacts/${id}/archive.tar.gz`);
            await this.storageProvider.delete(`artifacts/${id}/manifest.json`);
          } catch (error) {
            console.error(`[Artifact Packager] Failed to delete artifact ${id}:`, error);
          }
        }

        // Remove from cache
        this.artifactCache.delete(id);
        deletedCount++;
      }
    }

    console.log(`[Artifact Packager] Cleaned up ${deletedCount} old artifacts`);
    return deletedCount;
  }

  // ===========================================================================
  // INTERNAL METHODS
  // ===========================================================================

  /**
   * List files in build sandbox.
   */
  private async listBuildFiles(sandboxId: string): Promise<string[]> {
    const result = await this.snapshotClient.executeTask({
      task_id: `list-files-${Date.now()}`,
      action: 'list_files',
      path: '/workspace',
    });

    if (!result.success || !result.result) {
      throw new Error(`Failed to list files: ${result.error}`);
    }

    const allFiles = result.result.files as string[];

    // Filter files based on include/exclude patterns
    return this.filterFiles(allFiles);
  }

  /**
   * Filter files based on include/exclude patterns.
   */
  private filterFiles(files: string[]): string[] {
    const filtered: string[] = [];

    for (const file of files) {
      // Check if file should be excluded
      const shouldExclude = ArtifactPackagerService.EXCLUDE_PATTERNS.some(pattern => {
        return this.matchPattern(file, pattern);
      });

      if (shouldExclude) {
        continue;
      }

      // Check if file matches include pattern
      const shouldInclude = ArtifactPackagerService.INCLUDE_PATTERNS.some(pattern => {
        return this.matchPattern(file, pattern);
      });

      if (shouldInclude) {
        filtered.push(file);
      }
    }

    return filtered;
  }

  /**
   * Simple glob pattern matching.
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Create artifact manifest.
   */
  private async createManifest(
    artifactId: string,
    config: ArtifactConfig,
    files: string[]
  ): Promise<ArtifactManifest> {
    // Read package.json to get dependency info
    const packageJsonResult = await this.snapshotClient.executeTask({
      task_id: `read-package-json-${Date.now()}`,
      action: 'read_file',
      path: '/workspace/package.json',
    });

    let dependencies: Record<string, string> = {};
    let devDependencies: Record<string, string> = {};
    let scripts: Record<string, string> = {};
    let version = '0.0.0';

    if (packageJsonResult.success && packageJsonResult.result) {
      try {
        const packageJson = JSON.parse(packageJsonResult.result.content as string);
        dependencies = packageJson.dependencies || {};
        devDependencies = packageJson.devDependencies || {};
        scripts = packageJson.scripts || {};
        version = packageJson.version || '0.0.0';
      } catch (error) {
        console.warn('[Artifact Packager] Failed to parse package.json');
      }
    }

    // Calculate file info
    const artifactFiles: ArtifactFile[] = files.map(path => ({
      path,
      size: 0, // Will be populated during archive creation
      checksum: '', // Will be populated during archive creation
      type: this.getFileType(path),
    }));

    const manifest: ArtifactManifest = {
      id: artifactId,
      buildId: config.buildId,
      projectName: config.projectName,
      framework: config.framework,
      version,
      createdAt: new Date().toISOString(),
      files: artifactFiles,
      dependencies,
      devDependencies,
      scripts,
      totalSize: 0,
      checksum: '',
    };

    return manifest;
  }

  /**
   * Get file type based on path.
   */
  private getFileType(path: string): ArtifactFile['type'] {
    if (path.startsWith('src/') || path.startsWith('app/') || path.startsWith('pages/')) {
      return 'source';
    }
    if (path.startsWith('public/') || path.startsWith('assets/')) {
      return 'asset';
    }
    if (path.startsWith('dist/') || path.startsWith('.next/') || path.startsWith('build/')) {
      return 'build';
    }
    if (path === 'package.json' || path.endsWith('.config.js') || path.endsWith('.config.ts')) {
      return 'config';
    }
    return 'source';
  }

  /**
   * Create archive from sandbox files.
   */
  private async createArchive(
    sandboxId: string,
    manifest: ArtifactManifest,
    compressionLevel: 'none' | 'fast' | 'best'
  ): Promise<Buffer> {
    // Read all files and create a JSON-based archive
    // (WebContainers can handle JSON more easily than tar)
    const archiveData: {
      manifest: ArtifactManifest;
      files: Record<string, string>;
    } = {
      manifest,
      files: {},
    };

    let totalSize = 0;
    const checksums: string[] = [];

    for (const file of manifest.files) {
      const result = await this.snapshotClient.executeTask({
        task_id: `read-file-${Date.now()}`,
        action: 'read_file',
        path: `/workspace/${file.path}`,
      });

      if (result.success && result.result) {
        const content = result.result.content as string;
        archiveData.files[file.path] = content;

        // Update file info
        file.size = content.length;
        file.checksum = createHash('md5').update(content).digest('hex');
        totalSize += content.length;
        checksums.push(file.checksum);
      }
    }

    manifest.totalSize = totalSize;
    manifest.checksum = createHash('md5').update(checksums.join('')).digest('hex');

    // Serialize to JSON
    const jsonData = JSON.stringify(archiveData);

    // Compress if requested
    if (compressionLevel !== 'none') {
      const { gzipSync } = await import('zlib');
      const level = compressionLevel === 'best' ? 9 : 6;
      return gzipSync(jsonData, { level });
    }

    return Buffer.from(jsonData, 'utf-8');
  }

  /**
   * Upload artifact to storage.
   */
  private async uploadArtifact(
    artifactId: string,
    archive: Buffer,
    manifest: ArtifactManifest
  ): Promise<string> {
    if (!this.storageProvider) {
      throw new Error('No storage provider configured');
    }

    // Upload archive
    const archiveUrl = await this.storageProvider.upload(
      `artifacts/${artifactId}/archive.tar.gz`,
      archive,
      'application/gzip'
    );

    // Upload manifest
    await this.storageProvider.upload(
      `artifacts/${artifactId}/manifest.json`,
      JSON.stringify(manifest, null, 2),
      'application/json'
    );

    return archiveUrl;
  }
}

// =============================================================================
// R2 STORAGE PROVIDER
// =============================================================================

export class R2StorageProvider implements StorageProvider {
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;
  private publicUrl: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl?: string;
  }) {
    this.accountId = config.accountId;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl || `https://${config.bucketName}.r2.cloudflarestorage.com`;
  }

  async upload(key: string, data: Buffer | string, contentType: string): Promise<string> {
    // Use AWS SDK S3 compatible API for R2
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    await client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: data,
      ContentType: contentType,
    }));

    return `${this.publicUrl}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    const response = await client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }));

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    await client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }));
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(client, command, { expiresIn });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let artifactPackagerInstance: ArtifactPackagerService | null = null;

export function getArtifactPackager(): ArtifactPackagerService {
  if (!artifactPackagerInstance) {
    // Try to create with R2 storage if configured
    const r2Config = {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: process.env.R2_BUCKET_NAME || 'kriptik-artifacts',
      publicUrl: process.env.R2_PUBLIC_URL,
    };

    const hasR2Config = r2Config.accountId && r2Config.accessKeyId && r2Config.secretAccessKey;

    artifactPackagerInstance = new ArtifactPackagerService(
      hasR2Config ? new R2StorageProvider(r2Config) : undefined
    );
  }
  return artifactPackagerInstance;
}

export function createArtifactPackager(storageProvider?: StorageProvider): ArtifactPackagerService {
  return new ArtifactPackagerService(storageProvider);
}
