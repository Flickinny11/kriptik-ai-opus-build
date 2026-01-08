/**
 * Cross-Build Knowledge Transfer Service
 *
 * Enables knowledge sharing across different build sessions by:
 * 1. Creating knowledge links between related builds
 * 2. Transferring learned patterns from one build to another
 * 3. Maintaining a knowledge graph of related experiences
 */

import { db } from '../../db.js';
import {
    learningKnowledgeLinks,
    learningPatterns,
    learningStrategies,
    learningBuildSimilarity,
} from '../../schema.js';
import { eq, desc, sql, and, or, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAnthropicClient } from '../../utils/anthropic-client.js';
import { EventEmitter } from 'events';

// Local type definitions for Cross-Build Transfer
export interface KnowledgeLink {
    id: string;
    linkId: string;
    sourceBuildId: string;
    targetBuildId: string | null;
    knowledgeType: string;
    knowledgeId: string;
    relevanceScore: number | null;
    effectivenessScore: number | null;
    createdAt: Date;
}

export interface CrossBuildConfig {
    enableCrossBuild: boolean;
    maxLinksPerBuild: number;
    similarityThreshold: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: CrossBuildConfig = {
    enableCrossBuild: true,
    maxLinksPerBuild: 50,
    similarityThreshold: 0.7,
};

// =============================================================================
// SIMILARITY ANALYSIS PROMPT
// =============================================================================

const SIMILARITY_PROMPT = `You are analyzing two build sessions to determine their similarity and potential for knowledge transfer.

BUILD A (Source):
{{BUILD_A}}

BUILD B (Target):
{{BUILD_B}}

Analyze the relationship between these builds. Consider:
1. Technology stack overlap
2. Feature type similarity
3. Error patterns in common
4. Architecture similarities

RESPOND WITH JSON:
{
    "similarityScore": <0.0-1.0>,
    "transferablePatterns": ["<pattern descriptions>"],
    "transferableStrategies": ["<strategy descriptions>"],
    "linkType": "SIMILAR_TECH" | "SIMILAR_FEATURE" | "SIMILAR_ERROR" | "DEPENDENCY" | "EVOLUTION",
    "reasoning": "<brief explanation>"
}`;

// =============================================================================
// CROSS-BUILD TRANSFER SERVICE
// =============================================================================

export class CrossBuildTransferService extends EventEmitter {
    private config: CrossBuildConfig;
    private anthropic: ReturnType<typeof createAnthropicClient>;

    constructor(config?: Partial<CrossBuildConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.anthropic = createAnthropicClient();
    }

    // =========================================================================
    // KNOWLEDGE LINKING
    // =========================================================================

    /**
     * Create a knowledge link between two builds
     */
    async createLink(
        sourceBuildId: string,
        targetBuildId: string,
        linkType: string,
        metadata?: {
            similarityScore?: number;
            transferablePatterns?: string[];
            transferableStrategies?: string[];
            reasoning?: string;
        }
    ): Promise<KnowledgeLink> {
        const linkId = `kl_${uuidv4()}`;
        const knowledgeId = `knowledge_${uuidv4()}`;

        const link: KnowledgeLink = {
            id: linkId,
            linkId,
            sourceBuildId,
            targetBuildId,
            knowledgeType: linkType as 'pattern' | 'strategy' | 'reflexion' | 'preference',
            knowledgeId,
            relevanceScore: metadata?.similarityScore || 0.5,
            effectivenessScore: null,
            createdAt: new Date(),
        };

        await db.insert(learningKnowledgeLinks).values({
            linkId,
            sourceBuildId,
            targetBuildId,
            knowledgeType: linkType as 'pattern' | 'strategy' | 'reflexion' | 'preference',
            knowledgeId,
            relevanceScore: metadata?.similarityScore || 0.5,
        });

        this.emit('link_created', {
            linkId,
            sourceBuildId,
            targetBuildId,
            linkType,
        });

        return link;
    }

    /**
     * Analyze and create links based on build similarity
     */
    async analyzeSimilarity(
        buildAId: string,
        buildBId: string
    ): Promise<{
        similarityScore: number;
        shouldLink: boolean;
        analysis: Record<string, unknown>;
    }> {
        // Get build summaries
        const [buildA, buildB] = await Promise.all([
            this.getBuildSummary(buildAId),
            this.getBuildSummary(buildBId),
        ]);

        if (!buildA || !buildB) {
            return {
                similarityScore: 0,
                shouldLink: false,
                analysis: { error: 'One or both builds not found' },
            };
        }

        const prompt = SIMILARITY_PROMPT
            .replace('{{BUILD_A}}', JSON.stringify(buildA, null, 2))
            .replace('{{BUILD_B}}', JSON.stringify(buildB, null, 2));

        try {
            if (!this.anthropic) {
                throw new Error('Anthropic client not initialized');
            }

            const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (!content || content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON in response');
            }

            const analysis = JSON.parse(jsonMatch[0]);
            const shouldLink = analysis.similarityScore >= this.config.similarityThreshold;

            if (shouldLink) {
                await this.createLink(buildAId, buildBId, analysis.linkType, {
                    similarityScore: analysis.similarityScore,
                    transferablePatterns: analysis.transferablePatterns,
                    transferableStrategies: analysis.transferableStrategies,
                    reasoning: analysis.reasoning,
                });
            }

            return {
                similarityScore: analysis.similarityScore,
                shouldLink,
                analysis,
            };
        } catch (error) {
            console.error('[CrossBuild] Similarity analysis failed:', error);
            return {
                similarityScore: 0,
                shouldLink: false,
                analysis: { error: String(error) },
            };
        }
    }

    // =========================================================================
    // KNOWLEDGE TRANSFER
    // =========================================================================

    /**
     * Transfer patterns from linked builds to a target build
     */
    async transferPatterns(targetBuildId: string): Promise<{
        patternsTransferred: number;
        strategiesTransferred: number;
        sourceBuildIds: string[];
    }> {
        // Get all links where target is the destination
        const links = await db.select()
            .from(learningKnowledgeLinks)
            .where(eq(learningKnowledgeLinks.targetBuildId, targetBuildId));

        if (links.length === 0) {
            return {
                patternsTransferred: 0,
                strategiesTransferred: 0,
                sourceBuildIds: [],
            };
        }

        const sourceBuildIds = links.map(l => l.sourceBuildId);
        let patternsTransferred = 0;
        let strategiesTransferred = 0;

        // Get patterns from links by knowledge type
        const patternLinks = links.filter(l => l.knowledgeType === 'pattern');
        const strategyLinks = links.filter(l => l.knowledgeType === 'strategy');

        // Get patterns with good success rates
        const patterns = await db.select()
            .from(learningPatterns)
            .orderBy(desc(learningPatterns.successRate))
            .limit(50);

        // Get strategies with good success rates
        const strategies = await db.select()
            .from(learningStrategies)
            .orderBy(desc(learningStrategies.successRate))
            .limit(50);

        // Copy patterns (with new IDs and marking as transferred)
        for (const pattern of patterns.slice(0, patternLinks.length || 10)) {
            try {
                await db.insert(learningPatterns).values({
                    patternId: `pat_${uuidv4()}`,
                    category: pattern.category,
                    name: pattern.name,
                    problem: pattern.problem,
                    solutionTemplate: `[Transferred from ${pattern.patternId}] ${pattern.solutionTemplate}`,
                    conditions: pattern.conditions,
                    antiConditions: pattern.antiConditions,
                    codeTemplate: pattern.codeTemplate,
                    usageCount: 0,
                    successRate: Math.floor((pattern.successRate || 50) * 0.8), // Reduce confidence for transferred
                    sourceTraceId: pattern.sourceTraceId,
                });
                patternsTransferred++;
            } catch {
                // Pattern might already exist
            }
        }

        // Copy strategies
        for (const strategy of strategies.slice(0, strategyLinks.length || 10)) {
            try {
                await db.insert(learningStrategies).values({
                    strategyId: `str_${uuidv4()}`,
                    domain: strategy.domain,
                    name: strategy.name,
                    description: `[Transferred from ${strategy.strategyId}] ${strategy.description}`,
                    successRate: Math.floor((strategy.successRate || 50) * 0.8), // Slightly reduce for transferred
                    confidence: Math.floor((strategy.confidence || 50) * 0.8),
                    usageCount: 0,
                    contextsEffective: strategy.contextsEffective,
                    contextsIneffective: strategy.contextsIneffective,
                    derivedFrom: strategy.strategyId,
                    isExperimental: true,
                    isActive: true,
                });
                strategiesTransferred++;
            } catch {
                // Strategy might already exist
            }
        }

        this.emit('knowledge_transferred', {
            targetBuildId,
            sourceBuildIds,
            patternsTransferred,
            strategiesTransferred,
        });

        return {
            patternsTransferred,
            strategiesTransferred,
            sourceBuildIds,
        };
    }

    /**
     * Get transferable knowledge for a new build
     */
    async getTransferableKnowledge(
        targetBuildId: string,
        _context?: { techStack?: string[]; featureTypes?: string[] }
    ): Promise<{
        patterns: Array<{ id: string; type: string; data: Record<string, unknown>; sourceScore: number }>;
        strategies: Array<{ id: string; type: string; data: Record<string, unknown>; successRate: number }>;
    }> {
        // Find similar builds using the similarity table
        const similarBuilds = await db.select()
            .from(learningBuildSimilarity)
            .where(eq(learningBuildSimilarity.buildIdA, targetBuildId))
            .orderBy(desc(learningBuildSimilarity.overallSimilarity))
            .limit(10);

        if (similarBuilds.length === 0) {
            // Fall back to recent patterns with high success rates
            const recentPatterns = await db.select()
                .from(learningPatterns)
                .orderBy(desc(learningPatterns.successRate))
                .limit(20);

            return {
                patterns: recentPatterns.map(p => ({
                    id: p.id,
                    type: p.category,
                    data: { name: p.name, problem: p.problem, template: p.codeTemplate, solution: p.solutionTemplate },
                    sourceScore: p.successRate || 50,
                })),
                strategies: [],
            };
        }

        // Get high success rate patterns
        const patterns = await db.select()
            .from(learningPatterns)
            .orderBy(desc(learningPatterns.successRate))
            .limit(20);

        // Get high success rate strategies
        const strategies = await db.select()
            .from(learningStrategies)
            .orderBy(desc(learningStrategies.successRate))
            .limit(20);

        return {
            patterns: patterns.map(p => ({
                id: p.id,
                type: p.category,
                data: { name: p.name, problem: p.problem, template: p.codeTemplate, solution: p.solutionTemplate },
                sourceScore: p.successRate || 50,
            })),
            strategies: strategies.map(s => ({
                id: s.id,
                type: s.domain,
                data: { name: s.name, description: s.description, contexts: s.contextsEffective },
                successRate: s.successRate || 0,
            })),
        };
    }

    // =========================================================================
    // KNOWLEDGE GRAPH
    // =========================================================================

    /**
     * Get the knowledge graph around a build
     */
    async getKnowledgeGraph(buildId: string, depth: number = 2): Promise<{
        nodes: Array<{ id: string; type: 'build' | 'pattern' | 'strategy' }>;
        edges: Array<{ source: string; target: string; type: string }>;
    }> {
        const nodes: Array<{ id: string; type: 'build' | 'pattern' | 'strategy' }> = [];
        const edges: Array<{ source: string; target: string; type: string }> = [];
        const visited = new Set<string>();

        const explore = async (currentBuildId: string, currentDepth: number) => {
            if (currentDepth > depth || visited.has(currentBuildId)) {
                return;
            }
            visited.add(currentBuildId);

            nodes.push({ id: currentBuildId, type: 'build' });

            // Get links from/to this build
            const links = await db.select()
                .from(learningKnowledgeLinks)
                .where(
                    or(
                        eq(learningKnowledgeLinks.sourceBuildId, currentBuildId),
                        eq(learningKnowledgeLinks.targetBuildId, currentBuildId)
                    )
                );

            for (const link of links) {
                const targetId = link.targetBuildId || '';
                edges.push({
                    source: link.sourceBuildId,
                    target: targetId,
                    type: link.knowledgeType,
                });

                // Explore connected builds
                if (targetId) {
                    const connectedId = link.sourceBuildId === currentBuildId
                        ? targetId
                        : link.sourceBuildId;

                    await explore(connectedId, currentDepth + 1);
                }
            }

            // Get patterns with high success rates (since we can't filter by buildId)
            const patterns = await db.select()
                .from(learningPatterns)
                .orderBy(desc(learningPatterns.successRate))
                .limit(10);

            for (const pattern of patterns) {
                if (!visited.has(pattern.id)) {
                    nodes.push({ id: pattern.id, type: 'pattern' });
                    edges.push({
                        source: currentBuildId,
                        target: pattern.id,
                        type: 'HAS_PATTERN',
                    });
                    visited.add(pattern.id);
                }
            }
        };

        await explore(buildId, 0);

        return { nodes, edges };
    }

    /**
     * Get links for a build
     */
    async getLinksForBuild(buildId: string): Promise<KnowledgeLink[]> {
        const rows = await db.select()
            .from(learningKnowledgeLinks)
            .where(
                or(
                    eq(learningKnowledgeLinks.sourceBuildId, buildId),
                    eq(learningKnowledgeLinks.targetBuildId, buildId)
                )
            );

        return rows.map(row => ({
            id: row.id,
            linkId: row.linkId,
            sourceBuildId: row.sourceBuildId,
            targetBuildId: row.targetBuildId,
            knowledgeType: row.knowledgeType,
            knowledgeId: row.knowledgeId,
            relevanceScore: row.relevanceScore,
            effectivenessScore: row.effectivenessScore,
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        }));
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get statistics
     */
    async getStats(): Promise<{
        totalLinks: number;
        byLinkType: Record<string, number>;
        avgSimilarity: number;
        totalPatternsTransferred: number;
    }> {
        const links = await db.select().from(learningKnowledgeLinks);

        const byLinkType: Record<string, number> = {};
        let totalSimilarity = 0;

        for (const link of links) {
            byLinkType[link.knowledgeType] = (byLinkType[link.knowledgeType] || 0) + 1;
            totalSimilarity += link.relevanceScore || 0;
        }

        return {
            totalLinks: links.length,
            byLinkType,
            avgSimilarity: links.length > 0 ? totalSimilarity / links.length : 0,
            totalPatternsTransferred: links.filter(l => l.knowledgeType === 'pattern').length,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private async getBuildSummary(buildId: string): Promise<Record<string, unknown> | null> {
        // Get build info from similarity table or return minimal info
        const similarity = await db.select()
            .from(learningBuildSimilarity)
            .where(
                or(
                    eq(learningBuildSimilarity.buildIdA, buildId),
                    eq(learningBuildSimilarity.buildIdB, buildId)
                )
            )
            .limit(1);

        if (similarity.length === 0) {
            return {
                id: buildId,
                createdAt: new Date().toISOString(),
            };
        }

        return {
            id: buildId,
            similarityContext: similarity[0],
            computedAt: similarity[0].computedAt,
        };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: CrossBuildTransferService | null = null;

export function getCrossBuildTransfer(config?: Partial<CrossBuildConfig>): CrossBuildTransferService {
    if (!instance) {
        instance = new CrossBuildTransferService(config);
    }
    return instance;
}

export function resetCrossBuildTransfer(): void {
    instance = null;
}
