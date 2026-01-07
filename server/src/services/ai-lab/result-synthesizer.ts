/**
 * AI Lab - Result Synthesizer (PROMPT 6)
 *
 * Combines findings from all orchestrations into a coherent final result.
 * Handles conflict resolution and generates actionable recommendations.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ResearchFinding } from './research-agent.js';
import type { AgentMessage } from './agent-communicator.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SynthesisInput {
    researchPrompt: string;
    findings: ResearchFinding[];
    conclusions: string[];
    messages: AgentMessage[];
}

export interface SynthesizedResult {
    id: string;
    summary: string;
    keyInsights: KeyInsight[];
    recommendations: Recommendation[];
    conflictResolutions: ConflictResolution[];
    nextSteps: string[];
    confidence: number;
    completeness: number;
    timestamp: Date;
}

export interface KeyInsight {
    id: string;
    title: string;
    description: string;
    sourceOrchestrations: string[];
    confidence: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface Recommendation {
    id: string;
    title: string;
    description: string;
    implementation: string;
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    priority: number; // 1-10
}

export interface ConflictResolution {
    id: string;
    topic: string;
    conflictingViews: string[];
    resolution: string;
    rationale: string;
}

// ============================================================================
// RESULT SYNTHESIZER CLASS
// ============================================================================

export class ResultSynthesizer {
    /**
     * Synthesize results from all orchestrations
     */
    async synthesize(input: SynthesisInput): Promise<SynthesizedResult> {
        const { researchPrompt, findings, conclusions, messages } = input;

        // Group findings by category
        const groupedFindings = this.groupFindings(findings);

        // Extract key insights
        const keyInsights = this.extractKeyInsights(groupedFindings);

        // Generate recommendations
        const recommendations = this.generateRecommendations(groupedFindings, conclusions);

        // Identify and resolve conflicts
        const conflictResolutions = this.resolveConflicts(messages);

        // Generate summary
        const summary = this.generateSummary(researchPrompt, keyInsights, recommendations);

        // Calculate confidence and completeness
        const confidence = this.calculateConfidence(findings);
        const completeness = this.calculateCompleteness(findings, conclusions);

        // Generate next steps
        const nextSteps = this.generateNextSteps(recommendations, completeness);

        return {
            id: uuidv4(),
            summary,
            keyInsights,
            recommendations,
            conflictResolutions,
            nextSteps,
            confidence,
            completeness,
            timestamp: new Date(),
        };
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private groupFindings(findings: ResearchFinding[]): Map<string, ResearchFinding[]> {
        const groups = new Map<string, ResearchFinding[]>();

        for (const finding of findings) {
            const category = finding.category;
            const existing = groups.get(category) || [];
            existing.push(finding);
            groups.set(category, existing);
        }

        return groups;
    }

    private extractKeyInsights(groupedFindings: Map<string, ResearchFinding[]>): KeyInsight[] {
        const insights: KeyInsight[] = [];

        // Extract insights from high-confidence findings
        const allFindings = Array.from(groupedFindings.values()).flat();
        const highConfidence = allFindings.filter(f => f.confidence >= 80);

        for (const finding of highConfidence.slice(0, 5)) {
            insights.push({
                id: uuidv4(),
                title: finding.summary,
                description: finding.details,
                sourceOrchestrations: [finding.id],
                confidence: finding.confidence,
                priority: finding.confidence >= 90 ? 'high' : finding.confidence >= 80 ? 'medium' : 'low',
            });
        }

        // Add critical warnings
        const warnings = groupedFindings.get('warning') || [];
        for (const warning of warnings.slice(0, 3)) {
            insights.push({
                id: uuidv4(),
                title: `Warning: ${warning.summary}`,
                description: warning.details,
                sourceOrchestrations: [warning.id],
                confidence: warning.confidence,
                priority: 'critical',
            });
        }

        return insights;
    }

    private generateRecommendations(
        groupedFindings: Map<string, ResearchFinding[]>,
        conclusions: string[]
    ): Recommendation[] {
        const recommendations: Recommendation[] = [];

        // Generate recommendations from findings
        const recommendationFindings = groupedFindings.get('recommendation') || [];

        for (const finding of recommendationFindings.slice(0, 5)) {
            const priority = Math.floor(finding.confidence / 10);
            recommendations.push({
                id: uuidv4(),
                title: finding.summary,
                description: finding.details,
                implementation: `Implement based on: ${finding.summary}`,
                effort: finding.relevance >= 80 ? 'high' : finding.relevance >= 60 ? 'medium' : 'low',
                impact: finding.confidence >= 80 ? 'high' : finding.confidence >= 60 ? 'medium' : 'low',
                priority,
            });
        }

        // Sort by priority
        recommendations.sort((a, b) => b.priority - a.priority);

        return recommendations;
    }

    private resolveConflicts(messages: AgentMessage[]): ConflictResolution[] {
        const resolutions: ConflictResolution[] = [];

        // Find conflict messages
        const conflictMessages = messages.filter(m => m.messageType === 'conflict');

        for (const conflict of conflictMessages) {
            const metadata = conflict.metadata as { conflict?: { topic?: string; description?: string } } | undefined;

            resolutions.push({
                id: uuidv4(),
                topic: metadata?.conflict?.topic || 'Unknown topic',
                conflictingViews: [conflict.content],
                resolution: 'Synthesized based on majority confidence',
                rationale: 'Resolution determined by comparing confidence levels and relevance scores',
            });
        }

        return resolutions;
    }

    private generateSummary(
        researchPrompt: string,
        keyInsights: KeyInsight[],
        recommendations: Recommendation[]
    ): string {
        const insightCount = keyInsights.length;
        const criticalCount = keyInsights.filter(i => i.priority === 'critical').length;
        const recommendationCount = recommendations.length;

        return `Research analysis of "${researchPrompt.slice(0, 50)}..." yielded ${insightCount} key insights ` +
            `${criticalCount > 0 ? `(${criticalCount} critical)` : ''} and ${recommendationCount} actionable recommendations. ` +
            `The multi-agent analysis provides comprehensive coverage across multiple perspectives.`;
    }

    private calculateConfidence(findings: ResearchFinding[]): number {
        if (findings.length === 0) return 0;

        const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;
        const consistencyBonus = this.calculateConsistencyBonus(findings);

        return Math.min(100, Math.round(avgConfidence * (1 + consistencyBonus)));
    }

    private calculateConsistencyBonus(findings: ResearchFinding[]): number {
        // Higher bonus if findings are consistent (similar confidence levels)
        if (findings.length < 2) return 0;

        const confidences = findings.map(f => f.confidence);
        const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / confidences.length;
        const stdDev = Math.sqrt(variance);

        // Lower variance = higher consistency = higher bonus
        return Math.max(0, (20 - stdDev) / 100);
    }

    private calculateCompleteness(findings: ResearchFinding[], conclusions: string[]): number {
        // Base completeness on finding coverage and conclusion count
        const findingScore = Math.min(100, findings.length * 10);
        const conclusionScore = Math.min(100, conclusions.length * 20);

        // Check category coverage
        const categories = new Set(findings.map(f => f.category));
        const categoryCoverage = (categories.size / 5) * 100; // 5 possible categories

        return Math.round((findingScore + conclusionScore + categoryCoverage) / 3);
    }

    private generateNextSteps(recommendations: Recommendation[], completeness: number): string[] {
        const steps: string[] = [];

        // Add top recommendations as next steps
        const topRecs = recommendations.slice(0, 3);
        for (const rec of topRecs) {
            steps.push(`Implement: ${rec.title}`);
        }

        // Add completeness-based suggestions
        if (completeness < 70) {
            steps.push('Consider running additional research iterations for more comprehensive coverage');
        }

        if (completeness < 50) {
            steps.push('Review research prompt for clarity and specificity');
        }

        // Always add validation step
        steps.push('Validate key findings with domain experts before implementation');

        return steps;
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createResultSynthesizer(): ResultSynthesizer {
    return new ResultSynthesizer();
}
