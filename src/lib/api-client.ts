/**
 * API Client - Frontend API communication layer
 *
 * Provides typed methods for all backend API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types
export interface Project {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    framework: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectFile {
    id: string;
    projectId: string;
    path: string;
    content: string;
    language: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface Generation {
    id: string;
    projectId: string;
    userId: string;
    prompt: string;
    tokensUsed: number;
    cost: number;
    status: string;
    createdAt: string;
}

export interface AgentLog {
    id: string;
    agentType: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'thought' | 'code';
    timestamp: string;
}

export interface GenerationProgress {
    phase: string;
    progress: number;
}

export interface GenerationComplete {
    status: string;
    filesGenerated: number;
    usage: {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalThinkingTokens: number;
    };
    timing: {
        startedAt: string;
        completedAt: string;
        durationMs: number;
    };
}

// API Client
class ApiClient {
    private baseUrl: string;
    private userId: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    setUserId(userId: string | null): void {
        this.userId = userId;
    }

    private async fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(this.userId && { 'x-user-id': this.userId }),
            ...options.headers,
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Projects API
    async getProjects(): Promise<{ projects: Project[] }> {
        return this.fetch('/api/projects');
    }

    async getProject(id: string): Promise<{ project: Project; files: ProjectFile[] }> {
        return this.fetch(`/api/projects/${id}`);
    }

    async createProject(data: {
        name: string;
        description?: string;
        framework?: string;
        isPublic?: boolean;
    }): Promise<{ project: Project }> {
        return this.fetch('/api/projects', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateProject(id: string, data: {
        name?: string;
        description?: string;
        isPublic?: boolean;
    }): Promise<{ project: Project }> {
        return this.fetch(`/api/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteProject(id: string): Promise<{ success: boolean }> {
        return this.fetch(`/api/projects/${id}`, {
            method: 'DELETE',
        });
    }

    // Files API
    async getFiles(projectId: string): Promise<{ files: ProjectFile[]; tree: unknown }> {
        return this.fetch(`/api/projects/${projectId}/files`);
    }

    async updateFile(projectId: string, data: {
        path: string;
        content: string;
        language?: string;
    }): Promise<{ file: ProjectFile }> {
        return this.fetch(`/api/projects/${projectId}/files`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async updateFilesBulk(projectId: string, files: Array<{
        path: string;
        content: string;
        language?: string;
    }>): Promise<{ files: ProjectFile[] }> {
        return this.fetch(`/api/projects/${projectId}/files/bulk`, {
            method: 'PUT',
            body: JSON.stringify({ files }),
        });
    }

    async deleteFile(projectId: string, path: string): Promise<{ success: boolean }> {
        return this.fetch(`/api/projects/${projectId}/files`, {
            method: 'DELETE',
            body: JSON.stringify({ path }),
        });
    }

    // Generation API (SSE streaming)
    async *generate(
        projectId: string,
        prompt: string,
        skipPhases?: string[]
    ): AsyncGenerator<
        | { type: 'start'; data: { projectId: string; prompt: string } }
        | { type: 'log'; data: AgentLog }
        | { type: 'agent'; data: { agent: string; status: string; progress: number } }
        | { type: 'file'; data: { path: string; content: string } }
        | { type: 'progress'; data: GenerationProgress }
        | { type: 'complete'; data: GenerationComplete }
        | { type: 'error'; data: { message: string } }
    > {
        const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.userId && { 'x-user-id': this.userId }),
            },
            body: JSON.stringify({ prompt, skipPhases }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = '';
                let currentData = '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7);
                    } else if (line.startsWith('data: ')) {
                        currentData = line.slice(6);
                    } else if (line === '' && currentEvent && currentData) {
                        try {
                            const data = JSON.parse(currentData);
                            yield { type: currentEvent as any, data };
                        } catch (e) {
                            console.error('Failed to parse SSE data:', currentData);
                        }
                        currentEvent = '';
                        currentData = '';
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    // Chat API
    async chat(projectId: string, message: string, context?: {
        selectedFile?: string;
        selectedCode?: string;
    }): Promise<{ response: string; usage: { inputTokens: number; outputTokens: number } }> {
        return this.fetch(`/api/projects/${projectId}/chat`, {
            method: 'POST',
            body: JSON.stringify({ message, context }),
        });
    }

    // Generations history
    async getGenerations(projectId: string): Promise<{ generations: Generation[] }> {
        return this.fetch(`/api/projects/${projectId}/generations`);
    }

    // Health check
    async health(): Promise<{ status: string; timestamp: string; version: string }> {
        return this.fetch('/health');
    }
}

// Singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Helper to set user ID from auth
export function setApiUserId(userId: string | null): void {
    apiClient.setUserId(userId);
}

