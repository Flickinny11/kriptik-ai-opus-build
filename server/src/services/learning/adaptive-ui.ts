/**
 * Adaptive UI Service
 *
 * Learns from production user behavior to suggest and auto-apply UI improvements.
 * Detects friction patterns, generates suggestions, and enables A/B testing.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getOpenRouterClient, getPhaseConfig } from '../ai/openrouter-client.js';
import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// TYPES
// =============================================================================

export interface ElementIdentifier {
    selector: string;
    componentType: string;
    text?: string;
    location: { x: number; y: number };
    dimensions?: { width: number; height: number };
    visible?: boolean;
}

export interface BehaviorContext {
    pageUrl: string;
    viewportSize: { width: number; height: number };
    scrollPosition: { x: number; y: number };
    previousElement?: ElementIdentifier;
    timeOnPage: number;
    clickVelocity?: number;
    completionPercent?: number;
    abandonedField?: string;
    referrer?: string;
    deviceType: 'mobile' | 'tablet' | 'desktop';
}

export type SignalType = 
    | 'click' 
    | 'scroll' 
    | 'hover' 
    | 'rage-click' 
    | 'dead-click' 
    | 'form-abandon' 
    | 'navigation' 
    | 'time-on-element'
    | 'back-button'
    | 'hesitation';

export interface UserBehaviorSignal {
    id: string;
    projectId: string;
    sessionId: string;
    userId?: string;
    signalType: SignalType;
    element: ElementIdentifier;
    context: BehaviorContext;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

export type PatternType = 'friction' | 'engagement' | 'confusion' | 'success' | 'drop-off';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface BehaviorPattern {
    id: string;
    projectId: string;
    patternType: PatternType;
    affectedElements: ElementIdentifier[];
    frequency: number;
    severity: Severity;
    description: string;
    suggestedFix?: UISuggestion;
    firstDetected: Date;
    lastDetected: Date;
    sessionCount: number;
}

export type SuggestionType = 
    | 'reposition' 
    | 'resize' 
    | 'restyle' 
    | 'add-feedback' 
    | 'simplify' 
    | 'add-tooltip'
    | 'improve-contrast'
    | 'increase-click-area'
    | 'add-loading-state';

export interface CodeChange {
    file: string;
    selector: string;
    originalCode: string;
    suggestedCode: string;
    cssChanges?: Record<string, string>;
    addedClasses?: string[];
    removedClasses?: string[];
}

export interface UISuggestion {
    id: string;
    patternId: string;
    suggestionType: SuggestionType;
    description: string;
    rationale: string;
    codeChange: CodeChange;
    predictedImpact: number; // 0-100 improvement prediction
    autoApply: boolean; // Can be auto-applied without review
    confidence: number; // 0-100
    status: 'pending' | 'applied' | 'dismissed' | 'testing';
    appliedAt?: Date;
    testResults?: {
        improvement: number;
        sampleSize: number;
        confidence: number;
    };
}

export interface HeatmapData {
    projectId: string;
    pageUrl: string;
    points: Array<{
        x: number;
        y: number;
        intensity: number;
        type: 'click' | 'hover' | 'scroll-stop';
    }>;
    elementHeatmap: Array<{
        selector: string;
        interactions: number;
        avgTimeOnElement: number;
        clickRate: number;
    }>;
    generatedAt: Date;
}

// =============================================================================
// PATTERN DETECTION PROMPTS
// =============================================================================

const PATTERN_ANALYSIS_PROMPT = `Analyze these user behavior signals and identify UI/UX patterns.

SIGNALS:
{signals}

Identify patterns in these categories:
1. FRICTION: Users struggling with elements (rage clicks, dead clicks, hesitation)
2. CONFUSION: Users navigating back, excessive scrolling, repeated actions
3. SUCCESS: Elements with high engagement and quick completion
4. DROP-OFF: Points where users abandon the flow

For each pattern found, provide:
{
  "patterns": [
    {
      "patternType": "friction | engagement | confusion | success | drop-off",
      "affectedElements": [
        {
          "selector": "CSS selector",
          "componentType": "button | form | nav | card | etc",
          "text": "visible text if any"
        }
      ],
      "frequency": <number of occurrences>,
      "severity": "low | medium | high | critical",
      "description": "What's happening",
      "suggestedFix": {
        "suggestionType": "reposition | resize | restyle | add-feedback | simplify | add-tooltip | improve-contrast | increase-click-area | add-loading-state",
        "description": "What to do",
        "rationale": "Why this will help",
        "predictedImpact": <0-100>,
        "autoApply": <true if low-risk change>,
        "confidence": <0-100>
      }
    }
  ]
}`;

const CODE_SUGGESTION_PROMPT = `Generate specific code changes for this UI improvement suggestion.

SUGGESTION:
{suggestion}

AFFECTED ELEMENT:
{element}

CURRENT PAGE CONTEXT:
{context}

Generate the code change:
{
  "codeChange": {
    "file": "component file path",
    "selector": "CSS selector",
    "originalCode": "current code snippet",
    "suggestedCode": "improved code snippet",
    "cssChanges": { "property": "value" },
    "addedClasses": ["class1"],
    "removedClasses": ["class2"]
  }
}

Focus on:
- Minimal, targeted changes
- Preserve existing functionality
- Follow React/Tailwind best practices
- Ensure accessibility compliance`;

// =============================================================================
// SERVICE
// =============================================================================

export class AdaptiveUIService extends EventEmitter {
    private signals: Map<string, UserBehaviorSignal[]> = new Map(); // projectId -> signals
    private patterns: Map<string, BehaviorPattern[]> = new Map(); // projectId -> patterns
    private suggestions: Map<string, UISuggestion[]> = new Map(); // projectId -> suggestions
    private openRouter = getOpenRouterClient();
    private client: Anthropic;

    // Pattern detection thresholds
    private readonly RAGE_CLICK_THRESHOLD = 3; // clicks in 2 seconds
    private readonly HESITATION_THRESHOLD = 5000; // 5 seconds hover
    private readonly SIGNAL_BATCH_SIZE = 100;
    private readonly PATTERN_DETECTION_INTERVAL = 60000; // 1 minute

    constructor() {
        super();
        this.client = this.openRouter.getClient();

        // Start pattern detection loop
        setInterval(() => this.detectPatterns(), this.PATTERN_DETECTION_INTERVAL);
    }

    /**
     * Receive and store behavior signals
     */
    async recordSignals(signals: UserBehaviorSignal[]): Promise<void> {
        for (const signal of signals) {
            const projectSignals = this.signals.get(signal.projectId) || [];
            projectSignals.push(signal);

            // Keep only recent signals (last 1000)
            if (projectSignals.length > 1000) {
                projectSignals.shift();
            }

            this.signals.set(signal.projectId, projectSignals);

            // Emit for real-time tracking
            this.emit('signal:received', signal);

            // Check for immediate patterns (rage clicks, etc.)
            this.checkImmediatePatterns(signal);
        }
    }

    /**
     * Check for patterns that need immediate detection
     */
    private checkImmediatePatterns(signal: UserBehaviorSignal): void {
        const projectSignals = this.signals.get(signal.projectId) || [];

        // Detect rage clicks
        if (signal.signalType === 'click') {
            const recentClicks = projectSignals.filter(s =>
                s.signalType === 'click' &&
                s.element.selector === signal.element.selector &&
                Date.now() - new Date(s.timestamp).getTime() < 2000
            );

            if (recentClicks.length >= this.RAGE_CLICK_THRESHOLD) {
                this.createPattern({
                    projectId: signal.projectId,
                    patternType: 'friction',
                    affectedElements: [signal.element],
                    frequency: recentClicks.length,
                    severity: 'high',
                    description: `Rage clicking detected on ${signal.element.componentType || 'element'}`,
                });
            }
        }

        // Detect dead clicks
        if (signal.signalType === 'dead-click') {
            this.createPattern({
                projectId: signal.projectId,
                patternType: 'confusion',
                affectedElements: [signal.element],
                frequency: 1,
                severity: 'medium',
                description: `Users clicking non-interactive element: ${signal.element.text || signal.element.selector}`,
            });
        }

        // Detect form abandonment
        if (signal.signalType === 'form-abandon' && signal.context.completionPercent !== undefined) {
            const severity = signal.context.completionPercent < 25 ? 'high' : 
                           signal.context.completionPercent < 50 ? 'medium' : 'low';
            
            this.createPattern({
                projectId: signal.projectId,
                patternType: 'drop-off',
                affectedElements: [signal.element],
                frequency: 1,
                severity,
                description: `Form abandoned at ${signal.context.completionPercent}% completion (field: ${signal.context.abandonedField})`,
            });
        }
    }

    /**
     * Run pattern detection on accumulated signals
     */
    async detectPatterns(): Promise<void> {
        for (const [projectId, signals] of this.signals.entries()) {
            if (signals.length < 10) continue; // Need minimum signals

            try {
                const phaseConfig = getPhaseConfig('analysis');
                const signalSummary = this.summarizeSignals(signals);

                const prompt = PATTERN_ANALYSIS_PROMPT.replace('{signals}', JSON.stringify(signalSummary, null, 2));

                const response = await this.client.messages.create({
                    model: phaseConfig.model,
                    max_tokens: 4000,
                    system: 'You are a UX analytics expert. Analyze user behavior signals and identify actionable patterns. Always respond with valid JSON.',
                    messages: [{ role: 'user', content: prompt }],
                });

                const content = response.content[0];
                const text = content.type === 'text' ? content.text : '';

                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);
                    
                    if (result.patterns) {
                        for (const patternData of result.patterns) {
                            await this.createPattern({
                                projectId,
                                patternType: patternData.patternType,
                                affectedElements: patternData.affectedElements,
                                frequency: patternData.frequency,
                                severity: patternData.severity,
                                description: patternData.description,
                            }, patternData.suggestedFix);
                        }
                    }
                }
            } catch (error) {
                console.error('Pattern detection error:', error);
            }
        }
    }

    /**
     * Summarize signals for AI analysis
     */
    private summarizeSignals(signals: UserBehaviorSignal[]): object {
        const summary: Record<string, unknown> = {
            totalSignals: signals.length,
            uniqueSessions: new Set(signals.map(s => s.sessionId)).size,
            signalsByType: {} as Record<string, number>,
            topElements: [] as unknown[],
            timeRange: {
                start: signals[0]?.timestamp,
                end: signals[signals.length - 1]?.timestamp,
            },
        };

        // Count by type
        for (const signal of signals) {
            const type = signal.signalType;
            (summary.signalsByType as Record<string, number>)[type] = 
                ((summary.signalsByType as Record<string, number>)[type] || 0) + 1;
        }

        // Find top interacted elements
        const elementCounts = new Map<string, { count: number; element: ElementIdentifier; types: Set<string> }>();
        for (const signal of signals) {
            const key = signal.element.selector;
            const existing = elementCounts.get(key) || { count: 0, element: signal.element, types: new Set() };
            existing.count++;
            existing.types.add(signal.signalType);
            elementCounts.set(key, existing);
        }

        summary.topElements = Array.from(elementCounts.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([_selector, data]) => ({
                element: data.element,
                interactions: data.count,
                signalTypes: Array.from(data.types),
            }));

        // Sample of recent signals
        summary.recentSignals = signals.slice(-20).map(s => ({
            type: s.signalType,
            element: s.element.selector,
            componentType: s.element.componentType,
            text: s.element.text,
        }));

        return summary;
    }

    /**
     * Create or update a pattern
     */
    private async createPattern(
        data: Omit<BehaviorPattern, 'id' | 'firstDetected' | 'lastDetected' | 'sessionCount'>,
        suggestedFix?: Partial<UISuggestion>
    ): Promise<BehaviorPattern> {
        const projectPatterns = this.patterns.get(data.projectId) || [];

        // Check if similar pattern exists
        const existingIndex = projectPatterns.findIndex(p =>
            p.patternType === data.patternType &&
            p.affectedElements.some(e => 
                data.affectedElements.some(de => de.selector === e.selector)
            )
        );

        let pattern: BehaviorPattern;

        if (existingIndex >= 0) {
            // Update existing pattern
            pattern = projectPatterns[existingIndex];
            pattern.frequency += data.frequency;
            pattern.lastDetected = new Date();
            pattern.sessionCount++;
            
            // Upgrade severity if needed
            if (this.getSeverityLevel(data.severity) > this.getSeverityLevel(pattern.severity)) {
                pattern.severity = data.severity;
            }
        } else {
            // Create new pattern
            pattern = {
                id: uuidv4(),
                ...data,
                firstDetected: new Date(),
                lastDetected: new Date(),
                sessionCount: 1,
            };
            projectPatterns.push(pattern);
        }

        this.patterns.set(data.projectId, projectPatterns);

        // Generate suggestion if provided
        if (suggestedFix && !pattern.suggestedFix) {
            const suggestion = await this.createSuggestion(pattern, suggestedFix);
            pattern.suggestedFix = suggestion;
        }

        this.emit('pattern:detected', pattern);
        return pattern;
    }

    /**
     * Create a UI suggestion
     */
    private async createSuggestion(
        pattern: BehaviorPattern,
        suggestedFix: Partial<UISuggestion>
    ): Promise<UISuggestion> {
        const suggestion: UISuggestion = {
            id: uuidv4(),
            patternId: pattern.id,
            suggestionType: suggestedFix.suggestionType || 'restyle',
            description: suggestedFix.description || '',
            rationale: suggestedFix.rationale || '',
            codeChange: suggestedFix.codeChange || {
                file: '',
                selector: pattern.affectedElements[0]?.selector || '',
                originalCode: '',
                suggestedCode: '',
            },
            predictedImpact: suggestedFix.predictedImpact || 50,
            autoApply: suggestedFix.autoApply || false,
            confidence: suggestedFix.confidence || 50,
            status: 'pending',
        };

        // Generate code change if not provided
        if (!suggestion.codeChange.suggestedCode) {
            try {
                const codeChange = await this.generateCodeChange(suggestion, pattern.affectedElements[0]);
                suggestion.codeChange = codeChange;
            } catch (error) {
                console.error('Code generation error:', error);
            }
        }

        const projectSuggestions = this.suggestions.get(pattern.projectId) || [];
        projectSuggestions.push(suggestion);
        this.suggestions.set(pattern.projectId, projectSuggestions);

        this.emit('suggestion:created', suggestion);
        return suggestion;
    }

    /**
     * Generate code change for a suggestion
     */
    private async generateCodeChange(
        suggestion: UISuggestion,
        element?: ElementIdentifier
    ): Promise<CodeChange> {
        const phaseConfig = getPhaseConfig('build_agent');

        const prompt = CODE_SUGGESTION_PROMPT
            .replace('{suggestion}', JSON.stringify(suggestion, null, 2))
            .replace('{element}', JSON.stringify(element || {}, null, 2))
            .replace('{context}', '{}');

        const response = await this.client.messages.create({
            model: phaseConfig.model,
            max_tokens: 2000,
            system: 'You are a UI/UX developer. Generate minimal, effective code changes. Always respond with valid JSON.',
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        const text = content.type === 'text' ? content.text : '';

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return result.codeChange || suggestion.codeChange;
        }

        return suggestion.codeChange;
    }

    /**
     * Get severity level as number
     */
    private getSeverityLevel(severity: Severity): number {
        const levels: Record<Severity, number> = {
            low: 1,
            medium: 2,
            high: 3,
            critical: 4,
        };
        return levels[severity];
    }

    /**
     * Get patterns for a project
     */
    getPatterns(projectId: string): BehaviorPattern[] {
        return this.patterns.get(projectId) || [];
    }

    /**
     * Get suggestions for a project
     */
    getSuggestions(projectId: string): UISuggestion[] {
        return this.suggestions.get(projectId) || [];
    }

    /**
     * Apply a suggestion
     */
    async applySuggestion(suggestionId: string, projectId: string): Promise<UISuggestion | null> {
        const projectSuggestions = this.suggestions.get(projectId) || [];
        const suggestion = projectSuggestions.find(s => s.id === suggestionId);

        if (!suggestion) return null;

        suggestion.status = 'applied';
        suggestion.appliedAt = new Date();

        this.emit('suggestion:applied', suggestion);
        return suggestion;
    }

    /**
     * Dismiss a suggestion
     */
    dismissSuggestion(suggestionId: string, projectId: string): UISuggestion | null {
        const projectSuggestions = this.suggestions.get(projectId) || [];
        const suggestion = projectSuggestions.find(s => s.id === suggestionId);

        if (!suggestion) return null;

        suggestion.status = 'dismissed';

        this.emit('suggestion:dismissed', suggestion);
        return suggestion;
    }

    /**
     * Generate heatmap data for a project
     */
    getHeatmapData(projectId: string, pageUrl?: string): HeatmapData {
        const signals = this.signals.get(projectId) || [];
        
        const relevantSignals = pageUrl
            ? signals.filter(s => s.context.pageUrl === pageUrl)
            : signals;

        // Generate click/hover points
        const points = relevantSignals
            .filter(s => ['click', 'hover', 'rage-click'].includes(s.signalType))
            .map(s => ({
                x: s.element.location.x,
                y: s.element.location.y,
                intensity: s.signalType === 'rage-click' ? 3 : s.signalType === 'click' ? 2 : 1,
                type: s.signalType === 'hover' ? 'hover' as const : 'click' as const,
            }));

        // Generate element heatmap
        const elementStats = new Map<string, {
            interactions: number;
            totalTime: number;
            clicks: number;
        }>();

        for (const signal of relevantSignals) {
            const key = signal.element.selector;
            const existing = elementStats.get(key) || { interactions: 0, totalTime: 0, clicks: 0 };
            existing.interactions++;
            if (signal.signalType === 'click') existing.clicks++;
            if (signal.signalType === 'time-on-element' && signal.metadata?.duration) {
                existing.totalTime += signal.metadata.duration as number;
            }
            elementStats.set(key, existing);
        }

        const elementHeatmap = Array.from(elementStats.entries()).map(([selector, stats]) => ({
            selector,
            interactions: stats.interactions,
            avgTimeOnElement: stats.interactions > 0 ? stats.totalTime / stats.interactions : 0,
            clickRate: stats.interactions > 0 ? stats.clicks / stats.interactions : 0,
        }));

        return {
            projectId,
            pageUrl: pageUrl || 'all',
            points,
            elementHeatmap,
            generatedAt: new Date(),
        };
    }

    /**
     * Get statistics for a project
     */
    getStatistics(projectId: string): {
        totalSignals: number;
        totalPatterns: number;
        totalSuggestions: number;
        pendingSuggestions: number;
        appliedSuggestions: number;
        patternsByType: Record<PatternType, number>;
        patternsBySeverity: Record<Severity, number>;
    } {
        const signals = this.signals.get(projectId) || [];
        const patterns = this.patterns.get(projectId) || [];
        const suggestions = this.suggestions.get(projectId) || [];

        const patternsByType: Record<PatternType, number> = {
            friction: 0,
            engagement: 0,
            confusion: 0,
            success: 0,
            'drop-off': 0,
        };

        const patternsBySeverity: Record<Severity, number> = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };

        for (const pattern of patterns) {
            patternsByType[pattern.patternType]++;
            patternsBySeverity[pattern.severity]++;
        }

        return {
            totalSignals: signals.length,
            totalPatterns: patterns.length,
            totalSuggestions: suggestions.length,
            pendingSuggestions: suggestions.filter(s => s.status === 'pending').length,
            appliedSuggestions: suggestions.filter(s => s.status === 'applied').length,
            patternsByType,
            patternsBySeverity,
        };
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let instance: AdaptiveUIService | null = null;

export function getAdaptiveUIService(): AdaptiveUIService {
    if (!instance) {
        instance = new AdaptiveUIService();
    }
    return instance;
}

export function createAdaptiveUIService(): AdaptiveUIService {
    return new AdaptiveUIService();
}

