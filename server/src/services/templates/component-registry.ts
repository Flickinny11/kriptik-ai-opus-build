/**
 * Component Registry
 *
 * Caches previously generated components for instant reuse.
 * Reduces AI token costs and improves generation speed by
 * reusing high-quality components that match user requests.
 */

import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredComponent {
    id: string;
    hash: string;              // Content hash for deduplication
    prompt: string;            // Original generation prompt
    normalizedPrompt: string;  // Normalized for matching
    component: string;         // Generated code
    componentName: string;     // Extracted component name
    framework: 'react' | 'nextjs' | 'vue' | 'svelte';
    uiLibrary: 'tailwind' | 'shadcn' | 'mui' | 'chakra' | 'none';
    qualityScore: number;      // 0-100 design quality score
    usageCount: number;        // Times reused
    tokens: {
        input: number;
        output: number;
    };
    tags: string[];            // Semantic tags for matching
    createdAt: Date;
    lastUsedAt: Date;
}

export interface ComponentMatch {
    component: RegisteredComponent;
    similarity: number;        // 0-1 match score
    reason: string;
}

export interface RegistryStats {
    totalComponents: number;
    totalReuses: number;
    averageQuality: number;
    tokensSaved: number;
    hitRate: number;
}

// ============================================================================
// COMPONENT REGISTRY SERVICE
// ============================================================================

export class ComponentRegistry {
    private components: Map<string, RegisteredComponent> = new Map();
    private promptIndex: Map<string, string[]> = new Map(); // normalized prompt → component ids
    private tagIndex: Map<string, string[]> = new Map();    // tag → component ids
    private stats = {
        hits: 0,
        misses: 0,
        totalTokensSaved: 0,
    };

    // Configuration
    private readonly MAX_COMPONENTS = 5000;
    private readonly MIN_QUALITY_SCORE = 70;
    private readonly SIMILARITY_THRESHOLD = 0.75;

    /**
     * Register a new component
     */
    register(params: {
        prompt: string;
        component: string;
        framework?: 'react' | 'nextjs' | 'vue' | 'svelte';
        uiLibrary?: 'tailwind' | 'shadcn' | 'mui' | 'chakra' | 'none';
        qualityScore: number;
        tokens: { input: number; output: number };
    }): RegisteredComponent | null {
        // Don't register low-quality components
        if (params.qualityScore < this.MIN_QUALITY_SCORE) {
            return null;
        }

        const normalizedPrompt = this.normalizePrompt(params.prompt);
        const hash = this.hashContent(params.component);

        // Check for duplicate
        const existing = this.findByHash(hash);
        if (existing) {
            existing.usageCount++;
            existing.lastUsedAt = new Date();
            return existing;
        }

        // Extract component metadata
        const componentName = this.extractComponentName(params.component);
        const tags = this.extractTags(params.prompt, params.component);

        const id = this.generateId();
        const component: RegisteredComponent = {
            id,
            hash,
            prompt: params.prompt,
            normalizedPrompt,
            component: params.component,
            componentName,
            framework: params.framework || 'react',
            uiLibrary: params.uiLibrary || 'tailwind',
            qualityScore: params.qualityScore,
            usageCount: 1,
            tokens: params.tokens,
            tags,
            createdAt: new Date(),
            lastUsedAt: new Date(),
        };

        // Store component
        this.components.set(id, component);

        // Update indexes
        this.indexPrompt(normalizedPrompt, id);
        this.indexTags(tags, id);

        // Evict old components if needed
        this.evictIfNeeded();

        return component;
    }

    /**
     * Find a matching component for a prompt
     */
    find(prompt: string, options?: {
        framework?: string;
        uiLibrary?: string;
        minQuality?: number;
    }): ComponentMatch | null {
        const normalizedPrompt = this.normalizePrompt(prompt);
        const promptKeywords = this.extractKeywords(normalizedPrompt);

        let bestMatch: ComponentMatch | null = null;
        let bestSimilarity = this.SIMILARITY_THRESHOLD;

        // Search by normalized prompt similarity
        for (const component of this.components.values()) {
            // Filter by framework/uiLibrary if specified
            if (options?.framework && component.framework !== options.framework) {
                continue;
            }
            if (options?.uiLibrary && component.uiLibrary !== options.uiLibrary) {
                continue;
            }
            if (options?.minQuality && component.qualityScore < options.minQuality) {
                continue;
            }

            const similarity = this.calculateSimilarity(
                normalizedPrompt,
                component.normalizedPrompt,
                promptKeywords,
                component.tags
            );

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = {
                    component,
                    similarity,
                    reason: this.explainMatch(prompt, component),
                };
            }
        }

        if (bestMatch) {
            this.stats.hits++;
            this.stats.totalTokensSaved += bestMatch.component.tokens.input + bestMatch.component.tokens.output;
            bestMatch.component.usageCount++;
            bestMatch.component.lastUsedAt = new Date();
        } else {
            this.stats.misses++;
        }

        return bestMatch;
    }

    /**
     * Find components by tags
     */
    findByTags(tags: string[], options?: {
        limit?: number;
        minQuality?: number;
    }): RegisteredComponent[] {
        const componentIds = new Set<string>();

        for (const tag of tags) {
            const ids = this.tagIndex.get(tag.toLowerCase()) || [];
            ids.forEach(id => componentIds.add(id));
        }

        const results: RegisteredComponent[] = [];
        for (const id of componentIds) {
            const component = this.components.get(id);
            if (component) {
                if (options?.minQuality && component.qualityScore < options.minQuality) {
                    continue;
                }
                results.push(component);
            }
        }

        // Sort by relevance (tag overlap) and quality
        results.sort((a, b) => {
            const aOverlap = a.tags.filter(t => tags.includes(t)).length;
            const bOverlap = b.tags.filter(t => tags.includes(t)).length;
            if (aOverlap !== bOverlap) return bOverlap - aOverlap;
            return b.qualityScore - a.qualityScore;
        });

        return results.slice(0, options?.limit || 10);
    }

    /**
     * Get component by ID
     */
    get(id: string): RegisteredComponent | undefined {
        return this.components.get(id);
    }

    /**
     * Get registry statistics
     */
    getStats(): RegistryStats {
        const components = Array.from(this.components.values());
        const totalReuses = components.reduce((sum, c) => sum + c.usageCount - 1, 0);
        const averageQuality = components.length > 0
            ? components.reduce((sum, c) => sum + c.qualityScore, 0) / components.length
            : 0;

        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

        return {
            totalComponents: this.components.size,
            totalReuses,
            averageQuality: Math.round(averageQuality),
            tokensSaved: this.stats.totalTokensSaved,
            hitRate,
        };
    }

    /**
     * Get top components by usage
     */
    getTopComponents(limit: number = 10): RegisteredComponent[] {
        return Array.from(this.components.values())
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit);
    }

    /**
     * Clear the registry
     */
    clear(): void {
        this.components.clear();
        this.promptIndex.clear();
        this.tagIndex.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            totalTokensSaved: 0,
        };
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    private generateId(): string {
        return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private hashContent(content: string): string {
        return createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    private findByHash(hash: string): RegisteredComponent | undefined {
        for (const component of this.components.values()) {
            if (component.hash === hash) {
                return component;
            }
        }
        return undefined;
    }

    private normalizePrompt(prompt: string): string {
        return prompt
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private extractKeywords(text: string): string[] {
        const stopWords = new Set([
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'can',
            'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
            'as', 'into', 'through', 'during', 'before', 'after',
            'and', 'or', 'but', 'not', 'no', 'yes', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
            'our', 'their', 'what', 'which', 'who', 'whom', 'whose',
            'create', 'make', 'build', 'generate', 'add', 'please',
            'component', 'want', 'need', 'like', 'using', 'use',
        ]);

        return text
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }

    private extractTags(prompt: string, component: string): string[] {
        const tags = new Set<string>();
        const combined = `${prompt} ${component}`.toLowerCase();

        // Component type tags
        const typePatterns: Array<[RegExp, string]> = [
            [/button/i, 'button'],
            [/input|text.?field|form.?field/i, 'input'],
            [/form/i, 'form'],
            [/card/i, 'card'],
            [/modal|dialog/i, 'modal'],
            [/nav|navigation|menu/i, 'navigation'],
            [/header/i, 'header'],
            [/footer/i, 'footer'],
            [/sidebar/i, 'sidebar'],
            [/table|data.?table/i, 'table'],
            [/list/i, 'list'],
            [/hero/i, 'hero'],
            [/pricing/i, 'pricing'],
            [/testimonial/i, 'testimonial'],
            [/feature/i, 'feature'],
            [/cta|call.?to.?action/i, 'cta'],
            [/dashboard/i, 'dashboard'],
            [/profile/i, 'profile'],
            [/settings/i, 'settings'],
            [/auth|login|signup|sign.?in|sign.?up/i, 'auth'],
            [/chart|graph/i, 'chart'],
            [/search/i, 'search'],
            [/dropdown|select/i, 'dropdown'],
            [/accordion|collapse/i, 'accordion'],
            [/tabs/i, 'tabs'],
            [/toast|notification/i, 'notification'],
            [/tooltip/i, 'tooltip'],
            [/avatar/i, 'avatar'],
            [/badge/i, 'badge'],
            [/progress/i, 'progress'],
            [/loading|spinner/i, 'loading'],
            [/carousel|slider/i, 'carousel'],
            [/pagination/i, 'pagination'],
        ];

        for (const [pattern, tag] of typePatterns) {
            if (pattern.test(combined)) {
                tags.add(tag);
            }
        }

        // Extract meaningful keywords as tags
        const keywords = this.extractKeywords(this.normalizePrompt(prompt));
        keywords.slice(0, 5).forEach(kw => tags.add(kw));

        return Array.from(tags);
    }

    private extractComponentName(code: string): string {
        // Try to extract component name from code
        const patterns = [
            /export\s+(?:default\s+)?function\s+(\w+)/,
            /export\s+(?:default\s+)?const\s+(\w+)/,
            /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/,
            /function\s+(\w+)\s*\(/,
        ];

        for (const pattern of patterns) {
            const match = code.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return 'Component';
    }

    private calculateSimilarity(
        prompt1: string,
        prompt2: string,
        keywords1: string[],
        tags2: string[]
    ): number {
        // Jaccard similarity of keywords/tags
        const set1 = new Set(keywords1);
        const set2 = new Set(tags2);

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        const jaccardSim = union.size > 0 ? intersection.size / union.size : 0;

        // Cosine similarity of character trigrams
        const trigrams1 = this.getTrigrams(prompt1);
        const trigrams2 = this.getTrigrams(prompt2);

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        const allTrigrams = new Set([...trigrams1.keys(), ...trigrams2.keys()]);
        for (const trigram of allTrigrams) {
            const v1 = trigrams1.get(trigram) || 0;
            const v2 = trigrams2.get(trigram) || 0;
            dotProduct += v1 * v2;
            norm1 += v1 * v1;
            norm2 += v2 * v2;
        }

        const cosineSim = norm1 > 0 && norm2 > 0
            ? dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
            : 0;

        // Weighted combination
        return jaccardSim * 0.4 + cosineSim * 0.6;
    }

    private getTrigrams(text: string): Map<string, number> {
        const trigrams = new Map<string, number>();
        const padded = `  ${text}  `;

        for (let i = 0; i < padded.length - 2; i++) {
            const trigram = padded.slice(i, i + 3);
            trigrams.set(trigram, (trigrams.get(trigram) || 0) + 1);
        }

        return trigrams;
    }

    private explainMatch(prompt: string, component: RegisteredComponent): string {
        const matchingTags = component.tags.filter(tag =>
            prompt.toLowerCase().includes(tag)
        );

        if (matchingTags.length > 0) {
            return `Matched on: ${matchingTags.join(', ')}`;
        }

        return `Similar component: ${component.componentName}`;
    }

    private indexPrompt(normalizedPrompt: string, componentId: string): void {
        const existing = this.promptIndex.get(normalizedPrompt) || [];
        existing.push(componentId);
        this.promptIndex.set(normalizedPrompt, existing);
    }

    private indexTags(tags: string[], componentId: string): void {
        for (const tag of tags) {
            const existing = this.tagIndex.get(tag) || [];
            existing.push(componentId);
            this.tagIndex.set(tag, existing);
        }
    }

    private evictIfNeeded(): void {
        if (this.components.size <= this.MAX_COMPONENTS) {
            return;
        }

        // Evict least recently used, low quality components
        const components = Array.from(this.components.values())
            .sort((a, b) => {
                // Prioritize keeping high quality and frequently used
                const scoreA = a.qualityScore * 0.3 + a.usageCount * 10 + a.lastUsedAt.getTime() / 1e12;
                const scoreB = b.qualityScore * 0.3 + b.usageCount * 10 + b.lastUsedAt.getTime() / 1e12;
                return scoreA - scoreB;
            });

        // Remove bottom 10%
        const toRemove = Math.ceil(this.MAX_COMPONENTS * 0.1);
        for (let i = 0; i < toRemove && i < components.length; i++) {
            const component = components[i];
            this.components.delete(component.id);

            // Clean up indexes
            component.tags.forEach(tag => {
                const ids = this.tagIndex.get(tag) || [];
                const filtered = ids.filter(id => id !== component.id);
                if (filtered.length > 0) {
                    this.tagIndex.set(tag, filtered);
                } else {
                    this.tagIndex.delete(tag);
                }
            });
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: ComponentRegistry | null = null;

export function getComponentRegistry(): ComponentRegistry {
    if (!instance) {
        instance = new ComponentRegistry();
    }
    return instance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ComponentRegistry;

