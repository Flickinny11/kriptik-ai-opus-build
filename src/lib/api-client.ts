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

    getUserId(): string | null {
        return this.userId;
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

    // Generic REST methods for new routes
    async get<T = unknown>(endpoint: string): Promise<{ data: T }> {
        const result = await this.fetch<T>(endpoint);
        return { data: result };
    }

    async post<T = unknown>(endpoint: string, body?: unknown): Promise<{ data: T }> {
        const result = await this.fetch<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
        return { data: result };
    }

    async patch<T = unknown>(endpoint: string, body?: unknown): Promise<{ data: T }> {
        const result = await this.fetch<T>(endpoint, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        });
        return { data: result };
    }

    async delete<T = unknown>(endpoint: string): Promise<{ data: T }> {
        const result = await this.fetch<T>(endpoint, {
            method: 'DELETE',
        });
        return { data: result };
    }

    // =========================================================================
    // IMAGE-TO-CODE API
    // =========================================================================

    /**
     * Convert images to code with SSE streaming progress
     */
    async *imageToCode(
        images: string[],
        options?: {
            framework?: 'react' | 'react-native' | 'vue' | 'html';
            styling?: 'tailwind' | 'css-modules' | 'styled-components' | 'inline';
            componentName?: string;
            includeResponsive?: boolean;
            includeAccessibility?: boolean;
            includeInteractions?: boolean;
            additionalInstructions?: string;
        }
    ): AsyncGenerator<
        | { type: 'progress'; data: { stage: string; content: string } }
        | { type: 'complete'; data: ImageToCodeResult }
        | { type: 'error'; data: { error: string } }
    > {
        const response = await fetch(`${this.baseUrl}/api/ai/image-to-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.userId && { 'x-user-id': this.userId }),
            },
            body: JSON.stringify({
                images,
                framework: options?.framework || 'react',
                styling: options?.styling || 'tailwind',
                componentName: options?.componentName,
                includeResponsive: options?.includeResponsive ?? true,
                includeAccessibility: options?.includeAccessibility ?? true,
                includeInteractions: options?.includeInteractions ?? true,
                additionalInstructions: options?.additionalInstructions,
            }),
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
                            yield { type: currentEvent as 'progress' | 'complete' | 'error', data };
                        } catch {
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

    /**
     * Convert images to code (non-streaming, simpler)
     */
    async imageToCodeSimple(
        images: string[],
        options?: {
            framework?: 'react' | 'react-native' | 'vue' | 'html';
            styling?: 'tailwind' | 'css-modules' | 'styled-components' | 'inline';
            componentName?: string;
        }
    ): Promise<ImageToCodeResult> {
        return this.fetch('/api/ai/image-to-code/simple', {
            method: 'POST',
            body: JSON.stringify({
                images,
                framework: options?.framework || 'react',
                styling: options?.styling || 'tailwind',
                componentName: options?.componentName,
            }),
        });
    }

    // =========================================================================
    // CODE QUALITY API
    // =========================================================================

    /**
     * Run quality checks on project files
     */
    async runQualityCheck(projectId: string): Promise<QualityCheckResult> {
        return this.fetch(`/api/quality/${projectId}/check`, {
            method: 'POST',
        });
    }

    /**
     * Get quality report for a project
     */
    async getQualityReport(projectId: string): Promise<QualityCheckResult> {
        return this.fetch(`/api/quality/${projectId}/report`);
    }

    // =========================================================================
    // PROJECT IMPORT API (Developer Mode)
    // =========================================================================

    /**
     * Import a project from various sources
     */
    async importProject(data: {
        name: string;
        source: 'zip' | 'github' | 'external';
        file?: File;
        url?: string;
    }): Promise<ImportProjectResult> {
        // For file uploads, use FormData
        if (data.file) {
            const formData = new FormData();
            formData.append('file', data.file);
            formData.append('name', data.name);
            formData.append('source', data.source);

            const response = await fetch(`${this.baseUrl}/api/projects/import`, {
                method: 'POST',
                headers: {
                    ...(this.userId && { 'x-user-id': this.userId }),
                },
                body: formData,
                credentials: 'include',
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return response.json();
        }

        // For URL-based imports
        return this.fetch('/api/projects/import', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Import a project from GitHub repository
     */
    async importFromGitHub(data: {
        url: string;
        branch?: string;
        name?: string;
    }): Promise<ImportProjectResult> {
        return this.fetch('/api/projects/import/github', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // =========================================================================
    // BILLING & CREDITS API
    // =========================================================================

    /**
     * Get user's credit balance
     */
    async getCredits(): Promise<{ credits: number; tier: string; usedThisMonth: number }> {
        return this.fetch('/api/billing/credits');
    }

    /**
     * Get available pricing plans
     */
    async getPricing(): Promise<{
        plans: Array<{
            id: string;
            name: string;
            monthlyPrice: number;
            creditsPerMonth: number;
            features: string[];
        }>;
        topups: Array<{
            id: string;
            name: string;
            price: number;
            credits: number;
        }>;
    }> {
        return this.fetch('/api/billing/pricing');
    }

    /**
     * Create checkout session for subscription
     */
    async createCheckout(planId: string, interval: 'monthly' | 'yearly' = 'monthly'): Promise<{ url: string }> {
        return this.fetch('/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ planId, interval }),
        });
    }

    /**
     * Create checkout session for credit top-up
     */
    async createTopUp(topUpId: string): Promise<{ url: string }> {
        return this.fetch('/api/billing/topup', {
            method: 'POST',
            body: JSON.stringify({ topUpId }),
        });
    }

    // =========================================================================
    // DEVELOPER MODE API
    // =========================================================================

    /**
     * Start a developer mode session
     */
    async startDeveloperSession(data: {
        projectId: string;
        initialPrompt?: string;
        model?: string;
        agentCount?: number;
    }): Promise<{ sessionId: string; status: string }> {
        return this.fetch('/api/developer-mode/sessions', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Get developer mode session status
     */
    async getDeveloperSession(sessionId: string): Promise<{
        session: {
            id: string;
            status: string;
            agents: Array<{ id: string; role: string; status: string }>;
        };
    }> {
        return this.fetch(`/api/developer-mode/sessions/${sessionId}`);
    }

    /**
     * Send input to developer mode session
     */
    async sendToDevSession(sessionId: string, message: string): Promise<{ received: boolean }> {
        return this.fetch(`/api/developer-mode/sessions/${sessionId}/input`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }

    /**
     * Generate code using Developer Mode with model selection
     */
    async generateDeveloperMode(data: {
        prompt: string;
        selectedModel: string;
        systemPrompt?: string;
        context?: Record<string, unknown>;
        sessionId?: string;
        projectId?: string;
        maxTokens?: number;
    }): Promise<{
        success: boolean;
        content: string;
        model: string;
        ttftMs?: number;
        strategy?: string;
        designIssues: Array<{
            type: string;
            description: string;
            severity: 'critical' | 'warning' | 'suggestion';
        }>;
        slopDetected: boolean;
        halted?: boolean;
        reason?: string;
    }> {
        return this.fetch('/api/developer-mode/generate', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Create or get sandbox for Developer Mode session
     */
    async createDevSandbox(sessionId: string, projectPath?: string): Promise<{
        success: boolean;
        sandbox: {
            id: string;
            url: string;
            status: string;
            port: number;
        } | null;
    }> {
        return this.fetch('/api/developer-mode/sandbox', {
            method: 'POST',
            body: JSON.stringify({ sessionId, projectPath }),
        });
    }

    /**
     * Get sandbox status
     */
    async getDevSandbox(sessionId: string): Promise<{
        success: boolean;
        sandbox: {
            id: string;
            url: string;
            status: string;
            port: number;
        } | null;
    }> {
        return this.fetch(`/api/developer-mode/sandbox/${sessionId}`);
    }

    /**
     * Trigger HMR update in sandbox
     */
    async triggerHMR(sessionId: string, filePath: string): Promise<{ success: boolean }> {
        return this.fetch(`/api/developer-mode/sandbox/${sessionId}/hmr`, {
            method: 'POST',
            body: JSON.stringify({ filePath }),
        });
    }

    /**
     * Submit a soft interrupt
     */
    async submitInterrupt(data: {
        sessionId: string;
        message: string;
        agentId?: string;
    }): Promise<{
        success: boolean;
        interrupt: {
            id: string;
            type: string;
            priority: string;
            confidence: number;
            status: string;
        };
    }> {
        return this.fetch('/api/developer-mode/interrupt', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Run visual verification
     */
    async verifyVisual(screenshot: string, designRequirements?: string): Promise<{
        success: boolean;
        verification: {
            passed: boolean;
            designScore: number;
            issues: Array<{ type: string; description: string }>;
            recommendations: string[];
        };
    }> {
        return this.fetch('/api/developer-mode/verify', {
            method: 'POST',
            body: JSON.stringify({ screenshot, designRequirements }),
        });
    }

    /**
     * Detect AI slop patterns
     */
    async detectSlop(screenshot: string): Promise<{
        success: boolean;
        slopDetected: boolean;
        issues: Array<{ pattern: string; description: string }>;
    }> {
        return this.fetch('/api/developer-mode/verify/slop', {
            method: 'POST',
            body: JSON.stringify({ screenshot }),
        });
    }

    /**
     * Get available models for Developer Mode
     */
    async getDeveloperModeModels(): Promise<{
        success: boolean;
        models: Array<{
            id: string;
            name: string;
            provider: string;
            description: string;
            creditsPerTask: number;
            recommended: string[];
            isDefault?: boolean;
            features?: string[];
        }>;
    }> {
        return this.fetch('/api/developer-mode/models');
    }

    // =========================================================================
    // LEARNING ENGINE API
    // =========================================================================

    /**
     * Get learning system status
     */
    async getLearningStatus(): Promise<{
        data: {
            health: string;
            cycles: { total: number; successful: number };
            patterns: { total: number };
            models: { active: number };
        };
    }> {
        return this.fetch('/api/learning/status');
    }

    /**
     * Get training pipeline status
     */
    async getTrainingStatus(): Promise<{
        data: {
            totalJobs: number;
            activeJobs: number;
            completedJobs: number;
        };
    }> {
        return this.fetch('/api/learning/training/status');
    }

    // =========================================================================
    // KRIP-TOE-NITE API (Intelligent Model Orchestration)
    // =========================================================================

    /**
     * Generate response with Krip-Toe-Nite intelligent routing
     * Returns SSE stream - use streamKripToeNite for streaming
     */
    async generateKripToeNite(data: {
        prompt: string;
        systemPrompt?: string;
        context?: {
            framework?: string;
            language?: string;
            fileCount?: number;
            buildPhase?: string;
            complexity?: string;
        };
        maxTokens?: number;
        temperature?: number;
    }): Promise<KripToeNiteResponse> {
        return this.fetch('/api/krip-toe-nite/generate/sync', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Stream Krip-Toe-Nite generation via SSE
     * Callback receives chunks as they arrive
     */
    streamKripToeNite(
        data: {
            prompt: string;
            systemPrompt?: string;
            context?: {
                framework?: string;
                language?: string;
                fileCount?: number;
                buildPhase?: string;
                complexity?: string;
            };
            maxTokens?: number;
            temperature?: number;
        },
        onChunk: (chunk: KripToeNiteChunk) => void,
        onComplete?: () => void,
        onError?: (error: Error) => void
    ): AbortController {
        const controller = new AbortController();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(this.userId && { 'x-user-id': this.userId }),
        };

        fetch(`${this.baseUrl}/api/krip-toe-nite/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            signal: controller.signal,
        }).then(async (response) => {
            if (!response.ok) {
                throw new Error(`KTN error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                onComplete?.();
                                return;
                            }
                            try {
                                const chunk = JSON.parse(data) as KripToeNiteChunk;
                                onChunk(chunk);
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }
                onComplete?.();
            } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    onError?.(err);
                }
            }
        }).catch((err) => {
            if (err.name !== 'AbortError') {
                onError?.(err);
            }
        });

        return controller;
    }

    /**
     * Analyze prompt to see routing decision without generating
     */
    async analyzeKripToeNite(prompt: string, context?: Record<string, unknown>): Promise<{
        success: boolean;
        analysis: {
            taskType: string;
            complexity: string;
            isDesignHeavy: boolean;
            isCritical: boolean;
            reason: string;
        };
        routing: {
            strategy: string;
            primaryModel: string;
            parallelModel?: string;
            reasoning: string;
        };
        estimatedCost: number;
    }> {
        return this.fetch('/api/krip-toe-nite/analyze', {
            method: 'POST',
            body: JSON.stringify({ prompt, context }),
        });
    }

    /**
     * Get available models from Krip-Toe-Nite
     */
    async getKripToeNiteModels(): Promise<{
        success: boolean;
        models: Array<{
            id: string;
            name: string;
            tier: string;
            maxTokens: number;
            costPer1MInput: number;
            costPer1MOutput: number;
            supportsStreaming: boolean;
            capabilities: string[];
        }>;
        recommended: string;
    }> {
        return this.fetch('/api/krip-toe-nite/models');
    }

    /**
     * Get Krip-Toe-Nite service statistics
     */
    async getKripToeNiteStats(): Promise<{
        success: boolean;
        stats: {
            requestCount: number;
            totalCost: number;
            totalTokens: number;
            averageCostPerRequest: number;
            averageTokensPerRequest: number;
        };
    }> {
        return this.fetch('/api/krip-toe-nite/stats');
    }

    /**
     * Health check for Krip-Toe-Nite service
     */
    async checkKripToeNiteHealth(): Promise<{
        status: string;
        service: string;
        version: string;
        requestCount: number;
        uptime: number;
    }> {
        return this.fetch('/api/krip-toe-nite/health');
    }
}

// Image-to-Code result type
export interface ImageToCodeResult {
    components: Array<{
        name: string;
        code: string;
        styles?: string;
        path: string;
        dependencies: string[];
    }>;
    entryPoint: string;
    analysis: {
        detectedElements: string[];
        layout: string;
        colorPalette: string[];
        typography: string[];
        interactions: string[];
    };
    usage: {
        inputTokens: number;
        outputTokens: number;
        estimatedCost: number;
    };
}

// Krip-Toe-Nite types
export interface KripToeNiteChunk {
    type: 'text' | 'status' | 'error' | 'metadata' | 'complete';
    content: string;
    model?: string;
    strategy?: string;
    timestamp?: number;
    metadata?: {
        ttftMs?: number;
        isEnhancement?: boolean;
        modelSwitched?: boolean;
        [key: string]: unknown;
    };
}

export interface KripToeNiteResponse {
    success: boolean;
    response: {
        id: string;
        content: string;
        model: string;
        modelConfig: {
            id: string;
            name: string;
            tier: string;
        };
        usage: {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            estimatedCost: number;
        };
        taskAnalysis: {
            taskType: string;
            complexity: string;
        };
        routingDecision: {
            strategy: string;
            primaryModel: { id: string; name: string };
            reasoning: string;
        };
        latencyMs: number;
        strategy: string;
        wasEnhanced: boolean;
    };
}

// Import project result type
export interface ImportProjectResult {
    project?: Project;
    files?: string[];
    message?: string;
    success: boolean;
}

// Quality check result type
export interface QualityCheckResult {
    lint: Array<{
        file: string;
        issues: Array<{
            line: number;
            column: number;
            severity: 'error' | 'warning' | 'info';
            message: string;
            ruleId: string;
        }>;
        errorCount: number;
        warningCount: number;
    }>;
    review: {
        id: string;
        summary: string;
        score: number;
        issues: Array<{
            severity: string;
            type: string;
            file: string;
            message: string;
        }>;
    };
    security: Array<{
        severity: string;
        type: string;
        file: string;
        description: string;
        remediation: string;
    }>;
}

// =============================================================================
// UNIFIED EXECUTION API - Three-Mode Architecture
// =============================================================================

export type ExecutionMode = 'builder' | 'developer' | 'agents';

export interface ExecuteRequest {
    mode: ExecutionMode;
    projectId?: string;
    userId: string;
    prompt: string;
    sessionId?: string;
    framework?: string;
    language?: string;
    projectPath?: string;
    options?: {
        forceModel?: string;
        forceStrategy?: string;
        enableVisualVerification?: boolean;
        enableCheckpoints?: boolean;
    };
}

export interface ExecuteResponse {
    success: boolean;
    sessionId: string;
    projectId: string;
    mode: ExecutionMode;
    websocketChannel: string;
    initialAnalysis?: {
        taskType: string;
        complexity: string;
        strategy: string;
        estimatedCost: number;
    };
    error?: string;
}

export interface ExecutionStatusResponse {
    success: boolean;
    mode: ExecutionMode;
    projectId: string;
    sessionId: string;
    isActive: boolean;
    createdAt: string;
}

export interface ExecutionModesResponse {
    success: boolean;
    modes: Array<{
        id: ExecutionMode;
        name: string;
        description: string;
        features: string[];
        useCases: string[];
    }>;
}

class UnifiedExecutionApi {
    private baseUrl: string;
    private getUserId: () => string | null;

    constructor(baseUrl: string, getUserId: () => string | null) {
        this.baseUrl = baseUrl;
        this.getUserId = getUserId;
    }

    private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(this.getUserId() && { 'x-user-id': this.getUserId()! }),
        };

        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: { ...headers, ...options.headers },
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * Start execution in any mode
     * Returns immediately with session info; subscribe to WebSocket for updates
     */
    async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
        return this.fetch('/api/execute', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Get status of an execution session
     */
    async getStatus(sessionId: string, projectId: string): Promise<ExecutionStatusResponse> {
        return this.fetch(`/api/execute/${sessionId}/status?projectId=${encodeURIComponent(projectId)}`);
    }

    /**
     * Send an interrupt to a running execution
     */
    async interrupt(
        sessionId: string,
        projectId: string,
        message: string,
        type: 'HALT' | 'CONTEXT_ADD' | 'COURSE_CORRECT' | 'BACKTRACK' | 'QUEUE' | 'CLARIFICATION' = 'CONTEXT_ADD'
    ): Promise<{ success: boolean; interruptId: string }> {
        return this.fetch(`/api/execute/${sessionId}/interrupt`, {
            method: 'POST',
            body: JSON.stringify({ projectId, message, type }),
        });
    }

    /**
     * Stop a running execution
     */
    async stop(sessionId: string, projectId: string): Promise<{ success: boolean; message: string }> {
        return this.fetch(`/api/execute/${sessionId}/stop`, {
            method: 'POST',
            body: JSON.stringify({ projectId }),
        });
    }

    /**
     * Create a checkpoint
     */
    async createCheckpoint(sessionId: string, projectId: string, label?: string): Promise<{ success: boolean; checkpointId: string; label: string }> {
        return this.fetch(`/api/execute/${sessionId}/checkpoint`, {
            method: 'POST',
            body: JSON.stringify({ projectId, label }),
        });
    }

    /**
     * Restore a checkpoint
     */
    async restoreCheckpoint(sessionId: string, projectId: string, checkpointId: string): Promise<{ success: boolean; message: string }> {
        return this.fetch(`/api/execute/${sessionId}/restore`, {
            method: 'POST',
            body: JSON.stringify({ projectId, checkpointId }),
        });
    }

    /**
     * Get available execution modes
     */
    async getModes(): Promise<ExecutionModesResponse> {
        return this.fetch('/api/execute/modes');
    }

    /**
     * Execute in Builder Mode (shorthand)
     */
    async executeBuilder(prompt: string, projectId?: string, options?: ExecuteRequest['options']): Promise<ExecuteResponse> {
        const userId = this.getUserId();
        if (!userId) throw new Error('User ID required');
        
        return this.execute({
            mode: 'builder',
            prompt,
            projectId,
            userId,
            options,
        });
    }

    /**
     * Execute in Developer Mode (shorthand)
     */
    async executeDeveloper(prompt: string, projectId?: string, options?: ExecuteRequest['options']): Promise<ExecuteResponse> {
        const userId = this.getUserId();
        if (!userId) throw new Error('User ID required');
        
        return this.execute({
            mode: 'developer',
            prompt,
            projectId,
            userId,
            options,
        });
    }

    /**
     * Execute in Agents Mode (shorthand)
     */
    async executeAgents(prompt: string, projectId?: string, options?: ExecuteRequest['options']): Promise<ExecuteResponse> {
        const userId = this.getUserId();
        if (!userId) throw new Error('User ID required');
        
        return this.execute({
            mode: 'agents',
            prompt,
            projectId,
            userId,
            options,
        });
    }
}

// Singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Unified Execution API
export const executeApi = new UnifiedExecutionApi(API_BASE_URL, () => apiClient.getUserId());

// Helper to set user ID from auth
export function setApiUserId(userId: string | null): void {
    apiClient.setUserId(userId);
}

