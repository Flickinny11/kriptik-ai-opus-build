// Storage Infrastructure Service
// Vercel Blob storage for production file management

import { put, del, list, head } from '@vercel/blob';
import { createWriteStream, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

// Storage configuration
const USE_BLOB = process.env.BLOB_READ_WRITE_TOKEN ? true : false;
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || './storage';

// File metadata interface
interface FileMetadata {
    size: number;
    contentType: string;
    uploadedAt: string;
    pathname: string;
    url: string;
}

// List result interface
interface ListResult {
    blobs: FileMetadata[];
    cursor?: string;
    hasMore: boolean;
}

/**
 * Upload file to storage
 * Note: Vercel Blob only supports 'public' access
 */
export async function uploadFile(
    pathname: string,
    content: Buffer | Blob | string | ReadableStream,
    options?: {
        contentType?: string;
        addRandomSuffix?: boolean;
    }
): Promise<FileMetadata> {
    if (USE_BLOB) {
        // Use Vercel Blob in production
        const blob = await put(pathname, content, {
            access: 'public',
            contentType: options?.contentType,
            addRandomSuffix: options?.addRandomSuffix ?? false,
        });

        // Calculate size from content since blob doesn't have size property
        let size = 0;
        if (Buffer.isBuffer(content)) {
            size = content.length;
        } else if (typeof content === 'string') {
            size = Buffer.byteLength(content);
        } else if (content instanceof Blob) {
            size = content.size;
        }

        return {
            size,
            contentType: blob.contentType,
            uploadedAt: new Date().toISOString(),
            pathname: blob.pathname,
            url: blob.url,
        };
    } else {
        // Use local filesystem in development
        const fullPath = join(LOCAL_STORAGE_PATH, pathname);
        const dir = dirname(fullPath);

        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        let data: Buffer;
        if (Buffer.isBuffer(content)) {
            data = content;
        } else if (typeof content === 'string') {
            data = Buffer.from(content);
        } else if (content instanceof Blob) {
            data = Buffer.from(await content.arrayBuffer());
        } else {
            // ReadableStream
            const chunks: Uint8Array[] = [];
            const reader = content.getReader();
            let result = await reader.read();
            while (!result.done) {
                chunks.push(result.value);
                result = await reader.read();
            }
            data = Buffer.concat(chunks);
        }

        const { writeFileSync } = await import('fs');
        writeFileSync(fullPath, data);

        return {
            size: data.length,
            contentType: options?.contentType || 'application/octet-stream',
            uploadedAt: new Date().toISOString(),
            pathname: pathname,
            url: `file://${fullPath}`,
        };
    }
}

/**
 * Download file from storage
 */
export async function downloadFile(pathname: string): Promise<Buffer> {
    if (USE_BLOB) {
        // Fetch from Vercel Blob
        const metadata = await head(pathname);
        if (!metadata) {
            throw new Error(`File not found: ${pathname}`);
        }

        const response = await fetch(metadata.url);
        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        return Buffer.from(await response.arrayBuffer());
    } else {
        // Read from local filesystem
        const fullPath = join(LOCAL_STORAGE_PATH, pathname);
        const { readFileSync } = await import('fs');

        if (!existsSync(fullPath)) {
            throw new Error(`File not found: ${pathname}`);
        }

        return readFileSync(fullPath);
    }
}

/**
 * Delete file from storage
 */
export async function deleteFile(pathname: string): Promise<boolean> {
    if (USE_BLOB) {
        try {
            await del(pathname);
            return true;
        } catch (error) {
            console.error('[Storage] Delete failed:', error);
            return false;
        }
    } else {
        const fullPath = join(LOCAL_STORAGE_PATH, pathname);

        if (existsSync(fullPath)) {
            unlinkSync(fullPath);
            return true;
        }

        return false;
    }
}

/**
 * Check if file exists
 */
export async function fileExists(pathname: string): Promise<boolean> {
    if (USE_BLOB) {
        try {
            const metadata = await head(pathname);
            return metadata !== null;
        } catch {
            return false;
        }
    } else {
        const fullPath = join(LOCAL_STORAGE_PATH, pathname);
        return existsSync(fullPath);
    }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(pathname: string): Promise<FileMetadata | null> {
    if (USE_BLOB) {
        try {
            const blob = await head(pathname);
            if (!blob) return null;

            return {
                size: blob.size,
                contentType: blob.contentType,
                uploadedAt: blob.uploadedAt.toISOString(),
                pathname: blob.pathname,
                url: blob.url,
            };
        } catch {
            return null;
        }
    } else {
        const fullPath = join(LOCAL_STORAGE_PATH, pathname);

        if (!existsSync(fullPath)) {
            return null;
        }

        const stats = statSync(fullPath);
        return {
            size: stats.size,
            contentType: 'application/octet-stream',
            uploadedAt: stats.mtime.toISOString(),
            pathname: pathname,
            url: `file://${fullPath}`,
        };
    }
}

/**
 * List files in storage
 */
export async function listFiles(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
}): Promise<ListResult> {
    if (USE_BLOB) {
        const result = await list({
            prefix: options?.prefix,
            cursor: options?.cursor,
            limit: options?.limit || 100,
        });

        return {
            blobs: result.blobs.map(blob => ({
                size: blob.size,
                contentType: 'application/octet-stream', // Blob list doesn't include contentType
                uploadedAt: blob.uploadedAt.toISOString(),
                pathname: blob.pathname,
                url: blob.url,
            })),
            cursor: result.cursor,
            hasMore: result.hasMore,
        };
    } else {
        const prefix = options?.prefix || '';
        const basePath = join(LOCAL_STORAGE_PATH, prefix);

        if (!existsSync(basePath)) {
            return { blobs: [], hasMore: false };
        }

        const files: FileMetadata[] = [];
        const scanDir = (dir: string, relativePath: string = '') => {
            const entries = readdirSync(dir);

            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const entryRelativePath = relativePath ? `${relativePath}/${entry}` : entry;
                const stats = statSync(fullPath);

                if (stats.isDirectory()) {
                    scanDir(fullPath, entryRelativePath);
                } else {
                    files.push({
                        size: stats.size,
                        contentType: 'application/octet-stream',
                        uploadedAt: stats.mtime.toISOString(),
                        pathname: prefix ? `${prefix}/${entryRelativePath}` : entryRelativePath,
                        url: `file://${fullPath}`,
                    });
                }
            }
        };

        try {
            scanDir(basePath);
        } catch {
            return { blobs: [], hasMore: false };
        }

        const limit = options?.limit || 100;
        const cursorIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
        const sliced = files.slice(cursorIndex, cursorIndex + limit);

        return {
            blobs: sliced,
            cursor: cursorIndex + limit < files.length ? String(cursorIndex + limit) : undefined,
            hasMore: cursorIndex + limit < files.length,
        };
    }
}

/**
 * Upload project files (ZIP or directory)
 */
export async function uploadProjectFiles(
    projectId: string,
    files: { path: string; content: Buffer }[]
): Promise<{ uploaded: number; failed: number; errors: string[] }> {
    const results = {
        uploaded: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (const file of files) {
        try {
            const pathname = `projects/${projectId}/${file.path}`;
            await uploadFile(pathname, file.content);
            results.uploaded++;
        } catch (error) {
            results.failed++;
            results.errors.push(`${file.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return results;
}

/**
 * Delete all project files
 */
export async function deleteProjectFiles(projectId: string): Promise<boolean> {
    try {
        const prefix = `projects/${projectId}/`;
        const result = await listFiles({ prefix });

        for (const file of result.blobs) {
            await deleteFile(file.pathname);
        }

        return true;
    } catch (error) {
        console.error('[Storage] Failed to delete project files:', error);
        return false;
    }
}

/**
 * Get storage health status
 */
export async function checkStorageHealth(): Promise<{
    healthy: boolean;
    type: 'blob' | 'local';
    error?: string;
}> {
    try {
        const testPath = `_health_check_${Date.now()}.txt`;
        const testContent = 'health check';

        await uploadFile(testPath, testContent);
        await deleteFile(testPath);

        return {
            healthy: true,
            type: USE_BLOB ? 'blob' : 'local',
        };
    } catch (error) {
        return {
            healthy: false,
            type: USE_BLOB ? 'blob' : 'local',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
    type: 'blob' | 'local';
    filesCount: number;
    totalSize: number;
}> {
    const result = await listFiles({ limit: 1000 });
    const totalSize = result.blobs.reduce((sum, blob) => sum + blob.size, 0);

    return {
        type: USE_BLOB ? 'blob' : 'local',
        filesCount: result.blobs.length,
        totalSize,
    };
}

export default {
    uploadFile,
    downloadFile,
    deleteFile,
    fileExists,
    getFileMetadata,
    listFiles,
    uploadProjectFiles,
    deleteProjectFiles,
    checkStorageHealth,
    getStorageStats,
};
