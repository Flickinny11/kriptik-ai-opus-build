/**
 * Context Store Service
 *
 * Manages extracted context from imported apps in a searchable format.
 * Prevents context window overflow by chunking and indexing content
 * so the orchestration can search through it without consuming full context.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import type { ChatMessage, IntentSummary, ErrorTimeline } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ContextChunk {
    id: string;
    sessionId: string;
    type: 'chat' | 'code' | 'error' | 'build_log' | 'intent' | 'feature';
    content: string;
    metadata: {
        messageNumber?: number;
        filePath?: string;
        timestamp?: Date;
        importance: 'high' | 'medium' | 'low';
        keywords: string[];
        summary: string;
    };
    embedding?: number[]; // For semantic search (future)
}

export interface SearchResult {
    chunk: ContextChunk;
    relevanceScore: number;
    matchedKeywords: string[];
}

export interface ContextSummary {
    totalChunks: number;
    chatMessageCount: number;
    codeFileCount: number;
    errorCount: number;
    topKeywords: string[];
    intentSnapshot: string;
}

// ============================================================================
// CONTEXT STORE
// ============================================================================

export class ContextStore {
    private chunks: Map<string, ContextChunk[]> = new Map();
    private summaries: Map<string, ContextSummary> = new Map();
    private claudeService: ReturnType<typeof createClaudeService>;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            agentType: 'planning',
            projectId,
            userId,
            systemPrompt: 'You are an expert at summarizing and indexing development context.',
        });
    }

    // =========================================================================
    // INGEST METHODS
    // =========================================================================

    /**
     * Ingest chat history into searchable chunks
     */
    async ingestChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
        const chunks: ContextChunk[] = [];

        // Process messages in batches for efficiency
        for (let i = 0; i < messages.length; i += 5) {
            const batch = messages.slice(i, i + 5);
            const batchText = batch.map(m =>
                `[${m.role.toUpperCase()}] (Msg ${m.messageNumber}): ${m.content}`
            ).join('\n\n');

            // Extract keywords and summary for this batch
            const analysis = await this.analyzeContent(batchText, 'chat');

            chunks.push({
                id: uuidv4(),
                sessionId,
                type: 'chat',
                content: batchText,
                metadata: {
                    messageNumber: batch[0].messageNumber,
                    importance: this.determineImportance(batch),
                    keywords: analysis.keywords,
                    summary: analysis.summary,
                },
            });
        }

        this.addChunks(sessionId, chunks);
    }

    /**
     * Ingest code files into searchable chunks
     */
    async ingestCodeFiles(sessionId: string, files: Map<string, string>): Promise<void> {
        const chunks: ContextChunk[] = [];

        for (const [path, content] of files) {
            // For large files, split into chunks
            const contentChunks = this.splitContent(content, 2000);

            for (const chunk of contentChunks) {
                const analysis = await this.analyzeContent(chunk, 'code');

                chunks.push({
                    id: uuidv4(),
                    sessionId,
                    type: 'code',
                    content: chunk,
                    metadata: {
                        filePath: path,
                        importance: this.determineCodeImportance(path, chunk),
                        keywords: analysis.keywords,
                        summary: analysis.summary,
                    },
                });
            }
        }

        this.addChunks(sessionId, chunks);
    }

    /**
     * Ingest error logs into searchable chunks
     */
    async ingestErrors(sessionId: string, errors: Array<{ message: string; type: string; timestamp?: Date }>): Promise<void> {
        const chunks: ContextChunk[] = [];

        for (const error of errors) {
            chunks.push({
                id: uuidv4(),
                sessionId,
                type: 'error',
                content: `[${error.type}] ${error.message}`,
                metadata: {
                    timestamp: error.timestamp,
                    importance: 'high',
                    keywords: this.extractErrorKeywords(error.message),
                    summary: `Error: ${error.type}`,
                },
            });
        }

        this.addChunks(sessionId, chunks);
    }

    /**
     * Store intent summary as searchable context
     */
    async ingestIntentSummary(sessionId: string, intent: IntentSummary): Promise<void> {
        const chunks: ContextChunk[] = [];

        // Store core purpose
        chunks.push({
            id: uuidv4(),
            sessionId,
            type: 'intent',
            content: `CORE PURPOSE: ${intent.corePurpose}`,
            metadata: {
                importance: 'high',
                keywords: ['purpose', 'goal', 'intent', ...intent.corePurpose.toLowerCase().split(/\s+/).slice(0, 10)],
                summary: 'Application core purpose',
            },
        });

        // Store each feature
        for (const feature of [...intent.primaryFeatures, ...intent.secondaryFeatures]) {
            chunks.push({
                id: uuidv4(),
                sessionId,
                type: 'feature',
                content: `FEATURE: ${feature.name}\nDescription: ${feature.description}\nStatus: ${feature.status}\nUser Quote: "${feature.userQuote || 'N/A'}"`,
                metadata: {
                    importance: feature.importance === 'primary' ? 'high' : 'medium',
                    keywords: [feature.name.toLowerCase(), feature.status, ...feature.description.toLowerCase().split(/\s+/).slice(0, 5)],
                    summary: `Feature: ${feature.name} (${feature.status})`,
                },
            });
        }

        // Store frustration points
        for (const frustration of intent.frustrationPoints) {
            chunks.push({
                id: uuidv4(),
                sessionId,
                type: 'intent',
                content: `FRUSTRATION: ${frustration.issue}\nUser said: "${frustration.userQuote}"`,
                metadata: {
                    messageNumber: frustration.messageNumber,
                    importance: frustration.severity === 'major' ? 'high' : 'medium',
                    keywords: ['frustration', 'problem', 'issue', frustration.severity],
                    summary: `User frustration: ${frustration.issue}`,
                },
            });
        }

        this.addChunks(sessionId, chunks);
    }

    // =========================================================================
    // SEARCH METHODS
    // =========================================================================

    /**
     * Search context by natural language query
     */
    async search(sessionId: string, query: string, limit: number = 10): Promise<SearchResult[]> {
        const sessionChunks = this.chunks.get(sessionId) || [];
        if (sessionChunks.length === 0) return [];

        // Extract keywords from query
        const queryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        // Score each chunk
        const scored: SearchResult[] = sessionChunks.map(chunk => {
            const matchedKeywords = chunk.metadata.keywords.filter(k =>
                queryKeywords.some(qk => k.includes(qk) || qk.includes(k))
            );

            const keywordScore = matchedKeywords.length / Math.max(queryKeywords.length, 1);
            const importanceScore = chunk.metadata.importance === 'high' ? 0.3 :
                                   chunk.metadata.importance === 'medium' ? 0.15 : 0;
            const contentMatch = query.toLowerCase().split(/\s+/).some(w =>
                chunk.content.toLowerCase().includes(w)
            ) ? 0.2 : 0;

            return {
                chunk,
                relevanceScore: keywordScore + importanceScore + contentMatch,
                matchedKeywords,
            };
        });

        // Sort by relevance and return top results
        return scored
            .filter(s => s.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }

    /**
     * Search for specific chunk types
     */
    searchByType(sessionId: string, type: ContextChunk['type'], limit: number = 20): ContextChunk[] {
        const sessionChunks = this.chunks.get(sessionId) || [];
        return sessionChunks
            .filter(c => c.type === type)
            .slice(0, limit);
    }

    /**
     * Get high-importance chunks only (for context window management)
     */
    getHighImportanceChunks(sessionId: string): ContextChunk[] {
        const sessionChunks = this.chunks.get(sessionId) || [];
        return sessionChunks.filter(c => c.metadata.importance === 'high');
    }

    /**
     * Get context summary (lightweight overview)
     */
    getSummary(sessionId: string): ContextSummary | null {
        return this.summaries.get(sessionId) || null;
    }

    /**
     * Build a focused context string for AI consumption
     * This prevents context overflow by only including relevant chunks
     */
    async buildFocusedContext(sessionId: string, focus: string, maxTokens: number = 8000): Promise<string> {
        // Search for relevant chunks
        const relevant = await this.search(sessionId, focus, 20);

        // Always include high-importance chunks
        const highPriority = this.getHighImportanceChunks(sessionId);

        // Combine and dedupe
        const allChunks = new Map<string, ContextChunk>();
        for (const hp of highPriority) {
            allChunks.set(hp.id, hp);
        }
        for (const r of relevant) {
            allChunks.set(r.chunk.id, r.chunk);
        }

        // Build context string within token budget
        let context = '';
        let estimatedTokens = 0;
        const tokenPerChar = 0.25; // Rough estimate

        for (const chunk of allChunks.values()) {
            const chunkTokens = chunk.content.length * tokenPerChar;
            if (estimatedTokens + chunkTokens > maxTokens) break;

            context += `\n--- ${chunk.type.toUpperCase()} ---\n`;
            context += `Summary: ${chunk.metadata.summary}\n`;
            context += chunk.content + '\n';
            estimatedTokens += chunkTokens;
        }

        return context;
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private addChunks(sessionId: string, newChunks: ContextChunk[]): void {
        const existing = this.chunks.get(sessionId) || [];
        this.chunks.set(sessionId, [...existing, ...newChunks]);
        this.updateSummary(sessionId);
    }

    private updateSummary(sessionId: string): void {
        const chunks = this.chunks.get(sessionId) || [];

        // Count by type
        const chatCount = chunks.filter(c => c.type === 'chat').length;
        const codeCount = chunks.filter(c => c.type === 'code').length;
        const errorCount = chunks.filter(c => c.type === 'error').length;

        // Extract top keywords
        const keywordCounts = new Map<string, number>();
        for (const chunk of chunks) {
            for (const kw of chunk.metadata.keywords) {
                keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
            }
        }
        const topKeywords = Array.from(keywordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([kw]) => kw);

        // Get intent snapshot
        const intentChunks = chunks.filter(c => c.type === 'intent');
        const intentSnapshot = intentChunks[0]?.content || 'No intent extracted';

        this.summaries.set(sessionId, {
            totalChunks: chunks.length,
            chatMessageCount: chatCount,
            codeFileCount: codeCount,
            errorCount,
            topKeywords,
            intentSnapshot,
        });
    }

    private async analyzeContent(content: string, type: string): Promise<{ keywords: string[]; summary: string }> {
        // Quick keyword extraction without AI for speed
        const words = content.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3);

        // Count frequency
        const freq = new Map<string, number>();
        for (const w of words) {
            freq.set(w, (freq.get(w) || 0) + 1);
        }

        const keywords = Array.from(freq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([w]) => w);

        // Quick summary (first 100 chars + type)
        const summary = `${type}: ${content.substring(0, 100).replace(/\n/g, ' ')}...`;

        return { keywords, summary };
    }

    private splitContent(content: string, maxLength: number): string[] {
        if (content.length <= maxLength) return [content];

        const chunks: string[] = [];
        let start = 0;

        while (start < content.length) {
            let end = start + maxLength;

            // Try to split at newline
            if (end < content.length) {
                const lastNewline = content.lastIndexOf('\n', end);
                if (lastNewline > start) {
                    end = lastNewline;
                }
            }

            chunks.push(content.substring(start, end));
            start = end;
        }

        return chunks;
    }

    private determineImportance(messages: ChatMessage[]): 'high' | 'medium' | 'low' {
        const hasError = messages.some(m => m.hasError);
        const hasFeatureRequest = messages.some(m =>
            m.role === 'user' && /please|want|need|build|create|add|make/i.test(m.content)
        );

        if (hasError) return 'high';
        if (hasFeatureRequest) return 'high';
        return 'medium';
    }

    private determineCodeImportance(path: string, content: string): 'high' | 'medium' | 'low' {
        // Entry points are high importance
        if (/App\.(tsx?|jsx?)$/.test(path) || /main\.(tsx?|jsx?)$/.test(path) || /index\.(tsx?|jsx?)$/.test(path)) {
            return 'high';
        }
        // API routes are high importance
        if (/api\/|routes\//.test(path)) {
            return 'high';
        }
        // Components with state are medium-high
        if (/useState|useEffect|useReducer/.test(content)) {
            return 'medium';
        }
        return 'low';
    }

    private extractErrorKeywords(message: string): string[] {
        const keywords: string[] = ['error'];

        // Common error types
        if (/TypeError/i.test(message)) keywords.push('typeerror', 'type');
        if (/SyntaxError/i.test(message)) keywords.push('syntaxerror', 'syntax');
        if (/ReferenceError/i.test(message)) keywords.push('referenceerror', 'undefined');
        if (/undefined/i.test(message)) keywords.push('undefined', 'null');
        if (/cannot read/i.test(message)) keywords.push('null', 'property');
        if (/import|module/i.test(message)) keywords.push('import', 'module');
        if (/fetch|api|network/i.test(message)) keywords.push('api', 'network', 'fetch');

        return keywords;
    }

    /**
     * Clear context for a session
     */
    clear(sessionId: string): void {
        this.chunks.delete(sessionId);
        this.summaries.delete(sessionId);
    }
}

// Factory function
export function createContextStore(userId: string, projectId: string): ContextStore {
    return new ContextStore(userId, projectId);
}

