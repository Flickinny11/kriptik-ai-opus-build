/**
 * Content Analyzer - Soft Competitor Protection
 *
 * Provides a warning system (not hard blocking) when users attempt
 * to build KripTik clones or direct competitors.
 *
 * Design Principles:
 * - Warn, don't block
 * - User can acknowledge and proceed
 * - Log for review
 * - No false positives on legitimate apps
 */

import { db } from '../../db.js';
import { contentFlags } from '../../schema.js';
import { randomUUID } from 'crypto';

export interface ContentAnalysisResult {
    flagged: boolean;
    category: 'competitor_clone' | 'platform_replica' | 'ip_concern' | 'none';
    confidence: number; // 0-1
    matchedPatterns: string[];
    warningMessage?: string;
    requiresAcknowledgment: boolean;
}

export interface ContentFlag {
    id: string;
    userId: string;
    prompt: string;
    category: string;
    confidence: number;
    userAcknowledged: boolean;
    timestamp: Date;
}

// Patterns that suggest building a KripTik clone
const KRIPTIK_CLONE_PATTERNS = [
    /build\s+(me\s+)?(a\s+)?kriptik/i,
    /clone\s+(of\s+)?kriptik/i,
    /replicate\s+kriptik/i,
    /copy\s+(of\s+)?kriptik/i,
    /kriptik\s+alternative/i,
    /like\s+kriptik/i,
    /similar\s+to\s+kriptik/i,
];

// Patterns for general AI builder clones
const AI_BUILDER_CLONE_PATTERNS = [
    /build\s+(me\s+)?(a\s+)?(ai|artificial intelligence)\s+(code\s+)?(builder|generator|platform)/i,
    /create\s+(an?\s+)?ai\s+that\s+(writes|generates|builds)\s+code/i,
    /multi-agent\s+(ai\s+)?orchestration\s+(platform|system)/i,
    /ai\s+agents?\s+that\s+(build|generate|write)\s+(apps?|applications?|code)/i,
    /autonomous\s+(ai\s+)?(code|app)\s+(generation|building)/i,
];

// Specific competitor mentions (softer handling)
const COMPETITOR_PATTERNS = [
    { pattern: /clone\s+(of\s+)?(bolt|bolt\.new)/i, name: 'Bolt' },
    { pattern: /clone\s+(of\s+)?lovable/i, name: 'Lovable' },
    { pattern: /clone\s+(of\s+)?cursor/i, name: 'Cursor' },
    { pattern: /clone\s+(of\s+)?replit/i, name: 'Replit' },
    { pattern: /clone\s+(of\s+)?v0/i, name: 'v0' },
    { pattern: /replicate\s+(bolt|lovable|cursor|replit|v0)/i, name: 'competitor' },
];

// Patterns that suggest legitimate use (reduce false positives)
const LEGITIMATE_PATTERNS = [
    /integrate\s+with\s+(bolt|lovable|cursor)/i, // Integration, not cloning
    /export\s+to\s+(bolt|lovable|cursor)/i,
    /import\s+from\s+(bolt|lovable|cursor)/i,
    /fix\s+(my\s+)?(bolt|lovable)\s+(app|project)/i, // Fix My App feature
    /migrate\s+from\s+(bolt|lovable)/i,
];

export class ContentAnalyzer {
    /**
     * Analyze a prompt for potential IP/competitor concerns
     */
    analyze(prompt: string): ContentAnalysisResult {
        const normalizedPrompt = prompt.toLowerCase().trim();
        const matchedPatterns: string[] = [];

        // Check for legitimate patterns first (early exit)
        for (const pattern of LEGITIMATE_PATTERNS) {
            if (pattern.test(normalizedPrompt)) {
                return {
                    flagged: false,
                    category: 'none',
                    confidence: 0,
                    matchedPatterns: [],
                    requiresAcknowledgment: false,
                };
            }
        }

        // Check for KripTik-specific cloning (highest concern)
        for (const pattern of KRIPTIK_CLONE_PATTERNS) {
            if (pattern.test(normalizedPrompt)) {
                matchedPatterns.push(pattern.source);
                return {
                    flagged: true,
                    category: 'competitor_clone',
                    confidence: 0.95,
                    matchedPatterns,
                    warningMessage: this.getWarningMessage('kriptik_clone'),
                    requiresAcknowledgment: true,
                };
            }
        }

        // Check for general AI builder cloning
        for (const pattern of AI_BUILDER_CLONE_PATTERNS) {
            if (pattern.test(normalizedPrompt)) {
                matchedPatterns.push(pattern.source);
            }
        }

        if (matchedPatterns.length >= 2) {
            // Multiple AI builder patterns = likely trying to build competitor
            return {
                flagged: true,
                category: 'platform_replica',
                confidence: 0.8,
                matchedPatterns,
                warningMessage: this.getWarningMessage('ai_builder'),
                requiresAcknowledgment: true,
            };
        }

        // Check for specific competitor cloning
        for (const { pattern, name } of COMPETITOR_PATTERNS) {
            if (pattern.test(normalizedPrompt)) {
                matchedPatterns.push(pattern.source);
                return {
                    flagged: true,
                    category: 'ip_concern',
                    confidence: 0.7,
                    matchedPatterns,
                    warningMessage: this.getWarningMessage('competitor', name),
                    requiresAcknowledgment: false, // Softer - just inform
                };
            }
        }

        // Single AI builder pattern - low confidence, just note it
        if (matchedPatterns.length === 1) {
            return {
                flagged: true,
                category: 'ip_concern',
                confidence: 0.4,
                matchedPatterns,
                warningMessage: this.getWarningMessage('general'),
                requiresAcknowledgment: false,
            };
        }

        return {
            flagged: false,
            category: 'none',
            confidence: 0,
            matchedPatterns: [],
            requiresAcknowledgment: false,
        };
    }

    private getWarningMessage(type: string, name?: string): string {
        switch (type) {
            case 'kriptik_clone':
                return `This prompt appears to describe building a platform similar to KripTik AI. While we support innovation, we ask that you respect intellectual property. You may proceed, but please ensure your project doesn't infringe on KripTik's unique features and branding.`;

            case 'ai_builder':
                return `This prompt describes building an AI code generation platform. These are complex systems with significant intellectual property considerations. You may proceed, but please be mindful of existing patents and proprietary technologies in this space.`;

            case 'competitor':
                return `This prompt mentions cloning ${name}. While KripTik can help build many types of applications, directly replicating another company's product may raise legal concerns. Consider building something unique instead.`;

            case 'general':
                return `This prompt touches on AI-assisted development tools. No concerns, but we recommend focusing on unique value propositions rather than replicating existing solutions.`;

            default:
                return `Please review your prompt to ensure it doesn't infringe on existing intellectual property.`;
        }
    }

    /**
     * Log a flagged prompt for review
     */
    async logFlag(
        userId: string,
        prompt: string,
        analysis: ContentAnalysisResult,
        acknowledged: boolean
    ): Promise<void> {
        // Log to console
        console.log('[Content Flag]', {
            userId,
            category: analysis.category,
            confidence: analysis.confidence,
            acknowledged,
            promptPreview: prompt.substring(0, 100) + '...',
            timestamp: new Date().toISOString(),
        });

        // Store in database
        await db.insert(contentFlags).values({
            id: randomUUID(),
            userId,
            prompt: prompt.substring(0, 2000), // Limit prompt storage
            category: analysis.category,
            confidence: Math.round(analysis.confidence * 100),
            matchedPatterns: analysis.matchedPatterns,
            userAcknowledged: acknowledged,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Get flagged content for admin review
     */
    async getFlaggedContent(limit: number = 100): Promise<Array<{
        id: string;
        userId: string;
        category: string;
        confidence: number;
        userAcknowledged: boolean;
        timestamp: string;
    }>> {
        const flags = await db.select({
            id: contentFlags.id,
            userId: contentFlags.userId,
            category: contentFlags.category,
            confidence: contentFlags.confidence,
            userAcknowledged: contentFlags.userAcknowledged,
            timestamp: contentFlags.timestamp,
        })
            .from(contentFlags)
            .limit(limit);

        return flags.map(f => ({
            ...f,
            userAcknowledged: Boolean(f.userAcknowledged),
        }));
    }
}

// Singleton
let analyzer: ContentAnalyzer | null = null;

export function getContentAnalyzer(): ContentAnalyzer {
    if (!analyzer) {
        analyzer = new ContentAnalyzer();
    }
    return analyzer;
}

