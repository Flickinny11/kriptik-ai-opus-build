/**
 * Virtual File System - Real-time sync between frontend and backend
 *
 * This module provides:
 * - In-memory file storage synced with Sandpack
 * - Backend persistence via API
 * - Real-time updates via SSE
 * - File versioning for undo/redo
 */

import { SandpackFiles } from '@codesandbox/sandpack-react';
import { getApiBaseUrl } from './runtime-urls';

export interface FileVersion {
    version: number;
    content: string;
    timestamp: Date;
}

export interface VirtualFile {
    id?: string;
    path: string;
    content: string;
    language: string;
    versions: FileVersion[];
    currentVersion: number;
    isDirty: boolean;
    lastSaved?: Date;
}

export interface FileOperation {
    type: 'create' | 'update' | 'delete' | 'rename';
    path: string;
    newPath?: string;
    content?: string;
    timestamp: Date;
}

export interface VFSState {
    files: Map<string, VirtualFile>;
    operations: FileOperation[];
    lastSync?: Date;
}

const API_BASE_URL = getApiBaseUrl();

/**
 * Virtual File System class
 */
export class VirtualFileSystem {
    private files: Map<string, VirtualFile> = new Map();
    private operations: FileOperation[] = [];
    private projectId: string | null = null;
    private userId: string | null = null;
    private eventSource: EventSource | null = null;
    private syncTimeout: ReturnType<typeof setTimeout> | null = null;
    private onChangeCallbacks: Set<(files: Map<string, VirtualFile>) => void> = new Set();

    constructor() {}

    /**
     * Initialize the VFS for a project
     */
    async initialize(projectId: string, userId: string): Promise<void> {
        this.projectId = projectId;
        this.userId = userId;
        await this.loadFromBackend();
    }

    /**
     * Load files from backend
     */
    private async loadFromBackend(): Promise<void> {
        if (!this.projectId || !this.userId) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/projects/${this.projectId}/files`,
                {
                    headers: {
                        'x-user-id': this.userId,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load files');
            }

            const data = await response.json();

            this.files.clear();
            for (const file of data.files) {
                this.files.set(file.path, {
                    id: file.id,
                    path: file.path,
                    content: file.content,
                    language: file.language,
                    versions: [{
                        version: file.version,
                        content: file.content,
                        timestamp: new Date(file.updatedAt),
                    }],
                    currentVersion: file.version,
                    isDirty: false,
                    lastSaved: new Date(file.updatedAt),
                });
            }

            this.notifyChange();
        } catch (error) {
            console.error('Failed to load files from backend:', error);
        }
    }

    /**
     * Get file by path
     */
    getFile(path: string): VirtualFile | undefined {
        return this.files.get(path);
    }

    /**
     * Get all files
     */
    getAllFiles(): Map<string, VirtualFile> {
        return new Map(this.files);
    }

    /**
     * Convert to Sandpack format
     */
    toSandpackFiles(): SandpackFiles {
        const sandpackFiles: SandpackFiles = {};

        for (const [path, file] of this.files) {
            sandpackFiles[path] = {
                code: file.content,
            };
        }

        return sandpackFiles;
    }

    /**
     * Create or update a file
     */
    async updateFile(path: string, content: string): Promise<void> {
        const existing = this.files.get(path);

        if (existing) {
            // Add to version history
            const newVersion = existing.currentVersion + 1;
            existing.versions.push({
                version: newVersion,
                content,
                timestamp: new Date(),
            });

            // Keep only last 50 versions
            if (existing.versions.length > 50) {
                existing.versions = existing.versions.slice(-50);
            }

            existing.content = content;
            existing.currentVersion = newVersion;
            existing.isDirty = true;
        } else {
            // Create new file
            this.files.set(path, {
                path,
                content,
                language: this.inferLanguage(path),
                versions: [{
                    version: 1,
                    content,
                    timestamp: new Date(),
                }],
                currentVersion: 1,
                isDirty: true,
            });
        }

        this.operations.push({
            type: existing ? 'update' : 'create',
            path,
            content,
            timestamp: new Date(),
        });

        this.notifyChange();
        this.debouncedSync();
    }

    /**
     * Delete a file
     */
    async deleteFile(path: string): Promise<void> {
        this.files.delete(path);

        this.operations.push({
            type: 'delete',
            path,
            timestamp: new Date(),
        });

        this.notifyChange();
        await this.syncToBackend();
    }

    /**
     * Rename a file
     */
    async renameFile(oldPath: string, newPath: string): Promise<void> {
        const file = this.files.get(oldPath);
        if (!file) return;

        this.files.delete(oldPath);
        file.path = newPath;
        file.language = this.inferLanguage(newPath);
        file.isDirty = true;
        this.files.set(newPath, file);

        this.operations.push({
            type: 'rename',
            path: oldPath,
            newPath,
            timestamp: new Date(),
        });

        this.notifyChange();
        await this.syncToBackend();
    }

    /**
     * Undo last change for a file
     */
    undo(path: string): boolean {
        const file = this.files.get(path);
        if (!file || file.versions.length < 2) return false;

        const prevVersion = file.versions[file.versions.length - 2];
        file.content = prevVersion.content;
        file.currentVersion = prevVersion.version;
        file.isDirty = true;
        file.versions.pop();

        this.notifyChange();
        this.debouncedSync();
        return true;
    }

    /**
     * Sync files to backend
     */
    private async syncToBackend(): Promise<void> {
        if (!this.projectId || !this.userId) return;

        const dirtyFiles = Array.from(this.files.values()).filter(f => f.isDirty);
        if (dirtyFiles.length === 0) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/projects/${this.projectId}/files/bulk`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': this.userId,
                    },
                    body: JSON.stringify({
                        files: dirtyFiles.map(f => ({
                            path: f.path,
                            content: f.content,
                            language: f.language,
                        })),
                    }),
                }
            );

            if (response.ok) {
                // Mark files as clean
                for (const file of dirtyFiles) {
                    file.isDirty = false;
                    file.lastSaved = new Date();
                }
            }
        } catch (error) {
            console.error('Failed to sync files to backend:', error);
        }
    }

    /**
     * Debounced sync to avoid too many API calls
     */
    private debouncedSync(): void {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        this.syncTimeout = setTimeout(() => {
            this.syncToBackend();
        }, 1000);
    }

    /**
     * Apply file operations from AI generation
     */
    async applyOperations(operations: Array<{
        type: 'create' | 'update' | 'delete';
        path: string;
        content?: string
    }>): Promise<void> {
        for (const op of operations) {
            if (op.type === 'delete') {
                await this.deleteFile(op.path);
            } else if (op.content !== undefined) {
                await this.updateFile(op.path, op.content);
            }
        }
    }

    /**
     * Subscribe to file changes
     */
    onChange(callback: (files: Map<string, VirtualFile>) => void): () => void {
        this.onChangeCallbacks.add(callback);
        return () => this.onChangeCallbacks.delete(callback);
    }

    /**
     * Notify subscribers of changes
     */
    private notifyChange(): void {
        const files = this.getAllFiles();
        for (const callback of this.onChangeCallbacks) {
            callback(files);
        }
    }

    /**
     * Infer language from file path
     */
    private inferLanguage(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase();
        const languageMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            json: 'json',
            css: 'css',
            scss: 'scss',
            html: 'html',
            md: 'markdown',
            py: 'python',
            yaml: 'yaml',
            yml: 'yaml',
            dockerfile: 'dockerfile',
            sh: 'shell',
        };
        return languageMap[ext || ''] || 'text';
    }

    /**
     * Get file tree structure
     */
    getFileTree(): FileTreeNode[] {
        return buildFileTree(Array.from(this.files.values()));
    }

    /**
     * Reset the VFS
     */
    reset(): void {
        this.files.clear();
        this.operations = [];
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        if (this.eventSource) {
            this.eventSource.close();
        }
        this.notifyChange();
    }

    /**
     * Get operations history
     */
    getOperations(): FileOperation[] {
        return [...this.operations];
    }
}

// File tree types
export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileTreeNode[];
    language?: string;
}

/**
 * Build file tree from flat file list
 */
function buildFileTree(files: VirtualFile[]): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const map = new Map<string, FileTreeNode>();

    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    for (const file of sortedFiles) {
        const parts = file.path.split('/').filter(Boolean);
        let currentPath = '';
        let currentLevel = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

            let node = map.get(currentPath);

            if (!node) {
                node = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'folder',
                    ...(isFile ? { language: file.language } : { children: [] }),
                };
                map.set(currentPath, node);
                currentLevel.push(node);
            }

            if (!isFile && node.children) {
                currentLevel = node.children;
            }
        }
    }

    // Sort: folders first, then alphabetically
    const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        }).map(node => ({
            ...node,
            children: node.children ? sortNodes(node.children) : undefined,
        }));
    };

    return sortNodes(root);
}

// Singleton instance
export const vfs = new VirtualFileSystem();

