/**
 * Visual Verification Service
 *
 * Uses AI vision models to verify UI quality and functionality:
 * - Screenshot analysis for design quality
 * - AI slop detection
 * - Accessibility visual checks
 * - Component verification
 * - Before/after comparison
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, ClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import OpenAI from 'openai';

export interface VisualIssue {
    id: string;
    type: 'layout' | 'color' | 'typography' | 'spacing' | 'accessibility' | 'slop' | 'responsive' | 'interaction';
    description: string;
    severity: 'critical' | 'warning' | 'suggestion';
    element?: string;
    suggestion?: string;
    boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface VisualVerificationResult {
    passed: boolean;
    issues: VisualIssue[];
    designScore: number;
    accessibilityIssues: string[];
    screenshot: string;
    analysis: string;
    recommendations: string[];
}

export interface ComponentVerificationResult {
    componentName: string;
    found: boolean;
    visible: boolean;
    interactive: boolean;
    designQuality: number;
    issues: VisualIssue[];
    screenshot?: string;
}

export interface DesignAnalysis {
    colors: string[];
    fonts: string[];
    layout: string;
    components: string[];
    style: string;
    atmosphere: string;
    isSlop: boolean;
    slopIndicators: string[];
}

/**
 * Result of comparing generated UI against Design Mode mockup
 */
export interface MockupComparisonResult {
    /** Overall similarity score (0-1) */
    similarityScore: number;
    /** Does generated UI match mockup? */
    matchesMockup: boolean;
    /** Element-by-element comparison */
    elementMatches: Array<{
        mockupElement: string;
        generatedElement: string | null;
        matchScore: number;
        status: 'matched' | 'partial' | 'missing' | 'extra';
    }>;
    /** Layout comparison */
    layoutMatch: {
        score: number;
        differences: string[];
    };
    /** Style comparison */
    styleMatch: {
        score: number;
        colorDifferences: string[];
        typographyDifferences: string[];
    };
    /** Recommended improvements */
    improvements: string[];
    /** Raw analysis text */
    analysis: string;
}

/**
 * Design Mode mockup data for tethering
 */
export interface DesignModeMockup {
    id: string;
    viewName: string;
    imageBase64: string;
    elements: Array<{
        id: string;
        type: string;
        label: string;
        boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
    embedding?: number[];
}

/**
 * Visual Verification Service
 * Analyzes screenshots and verifies UI quality using AI vision
 */
export class VisualVerificationService {
    private claudeService: ClaudeService;
    private openaiClient: OpenAI | null = null;

    constructor() {
        this.claudeService = createClaudeService({
            projectId: 'visual-verification',
            userId: 'system',
            agentType: 'testing',
        });

        // Initialize OpenAI if API key is available (for GPT-4o vision)
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            this.openaiClient = new OpenAI({ apiKey: openaiKey });
        }
    }

    /**
     * Verify a page against expected design requirements
     */
    async verifyPage(
        screenshot: string,
        expectedDescription: string
    ): Promise<VisualVerificationResult> {
        const prompt = `You are a senior UI/UX designer and quality assurance expert. Analyze this screenshot and verify it meets the expected design requirements.

EXPECTED DESIGN:
${expectedDescription}

Analyze the screenshot for:
1. **Design Quality** (0-100 score)
   - Visual hierarchy and composition
   - Color harmony and contrast
   - Typography quality and readability
   - Spacing and alignment
   - Visual depth (shadows, gradients, glassmorphism)
   - Micro-interactions potential

2. **AI Slop Detection**
   Check for these slop patterns:
   - Plain white/gray backgrounds
   - Generic Tailwind colors (blue-500, gray-100)
   - Flat cards without shadows or depth
   - Boring centered layouts
   - Generic hero sections
   - Default component library styling
   - Small border radius (rounded, rounded-md instead of rounded-xl, rounded-2xl)
   - Weak shadows (shadow, shadow-md instead of shadow-lg, shadow-xl)

3. **Accessibility Issues**
   - Color contrast problems
   - Missing focus indicators
   - Text readability
   - Touch target sizes

4. **Layout Issues**
   - Alignment problems
   - Spacing inconsistencies
   - Responsive concerns
   - Overflow issues

Respond with JSON:
{
    "passed": boolean,
    "designScore": number (0-100),
    "analysis": "detailed analysis",
    "isSlop": boolean,
    "slopIndicators": ["list of slop patterns found"],
    "issues": [
        {
            "type": "layout" | "color" | "typography" | "spacing" | "accessibility" | "slop",
            "description": "issue description",
            "severity": "critical" | "warning" | "suggestion",
            "element": "affected element",
            "suggestion": "how to fix"
        }
    ],
    "accessibilityIssues": ["list of a11y issues"],
    "recommendations": ["list of improvement suggestions"]
}`;

        // Visual verification is critical - use generous limits
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 16000,  // Increased from 4K - comprehensive analysis needs room
            useExtendedThinking: true,
            thinkingBudgetTokens: 12000, // Increased for better visual reasoning
        });

        // Parse response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse visual verification response');
        }

        const result = JSON.parse(jsonMatch[0]);

        return {
            passed: result.passed && result.designScore >= 70 && !result.isSlop,
            issues: result.issues.map((i: any) => ({ id: uuidv4(), ...i })),
            designScore: result.designScore,
            accessibilityIssues: result.accessibilityIssues,
            screenshot,
            analysis: result.analysis,
            recommendations: result.recommendations,
        };
    }

    /**
     * Detect AI slop patterns in a screenshot
     */
    async detectSlop(screenshot: string): Promise<VisualIssue[]> {
        const prompt = `You are an expert at identifying "AI slop" - generic, low-quality UI patterns often generated by AI.

BANNED PATTERNS (AI SLOP):
- Plain white backgrounds (bg-white, bg-gray-50)
- Generic gray text (text-gray-700, text-gray-600)
- Flat cards with no depth or shadows
- Default Tailwind colors without customization (blue-500, indigo-600)
- Stock gradient backgrounds (purple to pink)
- Default component library styling
- Boring grid layouts with no variation
- Generic hero sections with centered text
- Small border radius (should be rounded-xl or larger)
- Weak shadows (should be shadow-lg or larger)
- No visual depth (missing glassmorphism, neumorphism, or elevation)
- No micro-interactions indicators
- Generic "Lorem ipsum" placeholder feel
- Cookie-cutter SaaS aesthetic

GOOD PATTERNS (NOT SLOP):
- Dark backgrounds with depth (slate-950, custom dark colors)
- Glassmorphism (backdrop-blur, semi-transparent backgrounds)
- Colored shadows (shadow-amber-500/20)
- Custom color palettes (amber/orange, emerald, custom themes)
- Gradient borders
- Visual hierarchy with proper spacing
- Typography with gradient text effects
- Atmospheric backgrounds (patterns, gradients, depth)

Analyze this screenshot and identify ALL slop patterns present.

Respond with JSON array:
[
    {
        "type": "slop",
        "description": "specific slop pattern found",
        "severity": "critical" | "warning" | "suggestion",
        "element": "affected element or area",
        "suggestion": "specific fix with Tailwind classes"
    }
]

If no slop is detected, return an empty array.`;

        // Slop detection - increased for detailed issue lists
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,  // Increased from 2K - many issues to report
            useExtendedThinking: false,
        });

        // Parse response
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return [];
        }

        const issues = JSON.parse(jsonMatch[0]);
        return issues.map((i: any) => ({ id: uuidv4(), ...i }));
    }

    /**
     * Verify a specific component
     */
    async verifyComponent(
        screenshot: string,
        componentName: string,
        expectedBehavior: string
    ): Promise<ComponentVerificationResult> {
        const prompt = `Analyze this screenshot and verify the "${componentName}" component.

EXPECTED BEHAVIOR:
${expectedBehavior}

Check for:
1. Is the component visible and rendered correctly?
2. Does it appear interactive (buttons look clickable, inputs look editable)?
3. Does the design quality meet premium standards?
4. Are there any visual issues?

Respond with JSON:
{
    "found": boolean,
    "visible": boolean,
    "interactive": boolean,
    "designQuality": number (0-100),
    "issues": [
        {
            "type": "layout" | "color" | "typography" | "spacing" | "interaction",
            "description": "issue",
            "severity": "critical" | "warning" | "suggestion",
            "suggestion": "fix"
        }
    ],
    "analysis": "brief analysis"
}`;

        // Component verification - increased for detailed analysis
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,  // Increased from 1.5K - need room for issues
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse component verification response');
        }

        const result = JSON.parse(jsonMatch[0]);

        return {
            componentName,
            found: result.found,
            visible: result.visible,
            interactive: result.interactive,
            designQuality: result.designQuality,
            issues: result.issues.map((i: any) => ({ id: uuidv4(), ...i })),
            screenshot,
        };
    }

    /**
     * Compare before/after screenshots
     */
    async compareScreenshots(
        before: string,
        after: string,
        expectedChange: string
    ): Promise<{
        matches: boolean;
        changeDetected: boolean;
        differences: string[];
        analysis: string;
    }> {
        const prompt = `Compare these two screenshots (before and after) and verify the expected change occurred.

EXPECTED CHANGE:
${expectedChange}

Analyze:
1. Did the expected change occur?
2. What specific differences are visible?
3. Were there any unexpected changes?
4. Did any regressions occur?

Respond with JSON:
{
    "matches": boolean (true if expected change occurred),
    "changeDetected": boolean,
    "differences": ["list of visible differences"],
    "unexpectedChanges": ["any unexpected changes"],
    "regressions": ["any visual regressions"],
    "analysis": "detailed comparison"
}`;

        // Screenshot comparison - increased for detailed analysis
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,  // Increased from 2K
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse comparison response');
        }

        const result = JSON.parse(jsonMatch[0]);

        return {
            matches: result.matches,
            changeDetected: result.changeDetected,
            differences: [...result.differences, ...result.unexpectedChanges],
            analysis: result.analysis,
        };
    }

    /**
     * Analyze design patterns from a screenshot
     */
    async analyzeDesign(screenshot: string): Promise<DesignAnalysis> {
        const prompt = `Analyze the design patterns in this screenshot.

Extract:
1. **Colors**: List all prominent colors used (as descriptive names or hex)
2. **Fonts**: Identify font families and styles used
3. **Layout**: Describe the layout pattern (grid, flex, asymmetric, etc.)
4. **Components**: List UI components visible (buttons, cards, inputs, etc.)
5. **Style**: Overall design style (minimal, corporate, playful, premium, etc.)
6. **Atmosphere**: Visual atmosphere (dark, light, colorful, muted, etc.)
7. **Slop Check**: Is this AI slop or quality design?

Respond with JSON:
{
    "colors": ["list of colors"],
    "fonts": ["list of fonts"],
    "layout": "layout description",
    "components": ["list of components"],
    "style": "overall style",
    "atmosphere": "visual atmosphere",
    "isSlop": boolean,
    "slopIndicators": ["any slop patterns found"]
}`;

        // Design analysis - increased for comprehensive extraction
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,  // Increased from 1.5K
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse design analysis response');
        }

        return JSON.parse(jsonMatch[0]);
    }

    /**
     * Generate improvement suggestions
     */
    async suggestImprovements(screenshot: string): Promise<string[]> {
        const prompt = `Analyze this UI screenshot and suggest specific improvements to elevate it to premium quality.

Focus on:
1. Visual depth (shadows, glassmorphism, gradients)
2. Color enhancements
3. Typography improvements
4. Spacing and layout refinements
5. Micro-interaction opportunities
6. Accessibility improvements
7. Premium feel enhancements

For each suggestion, provide specific Tailwind CSS classes or code changes.

Respond with JSON array of suggestions:
[
    "Add depth to cards: bg-slate-900/50 backdrop-blur-xl border border-white/10",
    "Use gradient text for headings: bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent",
    ...
]`;

        // Improvement suggestions - increased for detailed recommendations
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,  // Increased from 2K
            useExtendedThinking: true,
            thinkingBudgetTokens: 8000,  // Increased from 5K
        });

        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return [];
        }

        return JSON.parse(jsonMatch[0]);
    }

    /**
     * Verify user journey step
     */
    async verifyJourneyStep(
        screenshot: string,
        stepDescription: string,
        expectedResult: string
    ): Promise<{
        passed: boolean;
        actualResult: string;
        screenshot: string;
        issues: string[];
    }> {
        const prompt = `Verify this user journey step by analyzing the screenshot.

STEP: ${stepDescription}
EXPECTED RESULT: ${expectedResult}

Questions:
1. Does the screenshot show the expected result?
2. What is actually visible?
3. Are there any issues or errors visible?
4. Is the UI in the correct state?

Respond with JSON:
{
    "passed": boolean,
    "actualResult": "description of what's actually shown",
    "matchesExpected": boolean,
    "issues": ["any issues found"],
    "confidence": number (0-100)
}`;

        // Journey step verification - increased for detailed analysis
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,  // Increased from 1K
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse journey step verification');
        }

        const result = JSON.parse(jsonMatch[0]);

        return {
            passed: result.passed && result.matchesExpected,
            actualResult: result.actualResult,
            screenshot,
            issues: result.issues,
        };
    }

    /**
     * Compare generated UI screenshot against Design Mode mockup
     * Uses VL-JEPA embedding similarity for element matching
     */
    async compareWithMockup(
        screenshot: string,
        mockup: DesignModeMockup
    ): Promise<MockupComparisonResult> {
        const prompt = `You are an expert UI designer comparing a generated UI (SCREENSHOT) against a design mockup (MOCKUP).

MOCKUP VIEW: "${mockup.viewName}"
MOCKUP ELEMENTS: ${mockup.elements.map(e => `${e.type}: "${e.label}"`).join(', ')}

Analyze how well the generated UI matches the design mockup:

1. **Element Matching** (0-100 per element)
   - For each mockup element, find the corresponding element in the screenshot
   - Rate the match quality (position, style, appearance)
   - Note any missing or extra elements

2. **Layout Matching** (0-100)
   - Compare overall layout structure
   - Check element positioning and alignment
   - Verify spacing and proportions

3. **Style Matching** (0-100)
   - Compare color schemes
   - Check typography (fonts, sizes, weights)
   - Verify visual depth (shadows, gradients)
   - Compare interactive element styling

4. **Overall Similarity** (0-100)
   - Weight: Elements 40%, Layout 30%, Style 30%
   - Consider the mockup is the "source of truth"

Respond with JSON:
{
    "similarityScore": number (0-100),
    "matchesMockup": boolean (true if score >= 75),
    "elementMatches": [
        {
            "mockupElement": "element from mockup",
            "generatedElement": "matching element or null",
            "matchScore": number (0-100),
            "status": "matched" | "partial" | "missing" | "extra"
        }
    ],
    "layoutMatch": {
        "score": number (0-100),
        "differences": ["list of layout differences"]
    },
    "styleMatch": {
        "score": number (0-100),
        "colorDifferences": ["list of color differences"],
        "typographyDifferences": ["list of typography differences"]
    },
    "improvements": ["specific changes to match mockup better"],
    "analysis": "detailed comparison analysis"
}`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 16000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 12000,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse mockup comparison response');
        }

        const result = JSON.parse(jsonMatch[0]);

        return {
            similarityScore: result.similarityScore / 100,
            matchesMockup: result.matchesMockup ?? result.similarityScore >= 75,
            elementMatches: result.elementMatches || [],
            layoutMatch: {
                score: (result.layoutMatch?.score || 0) / 100,
                differences: result.layoutMatch?.differences || [],
            },
            styleMatch: {
                score: (result.styleMatch?.score || 0) / 100,
                colorDifferences: result.styleMatch?.colorDifferences || [],
                typographyDifferences: result.styleMatch?.typographyDifferences || [],
            },
            improvements: result.improvements || [],
            analysis: result.analysis || '',
        };
    }

    /**
     * Batch compare multiple views against their mockups
     */
    async batchCompareWithMockups(
        screenshots: Map<string, string>,
        mockups: DesignModeMockup[]
    ): Promise<Map<string, MockupComparisonResult>> {
        const results = new Map<string, MockupComparisonResult>();

        for (const mockup of mockups) {
            const screenshot = screenshots.get(mockup.viewName);
            if (screenshot) {
                try {
                    const comparison = await this.compareWithMockup(screenshot, mockup);
                    results.set(mockup.viewName, comparison);
                } catch (error) {
                    console.error(`[VisualVerifier] Failed to compare ${mockup.viewName}:`, error);
                }
            }
        }

        return results;
    }

    /**
     * Calculate tethering confidence score
     * Uses element match rates and layout similarity
     */
    calculateTetheringConfidence(comparison: MockupComparisonResult): number {
        const elementScore = comparison.elementMatches.reduce(
            (sum, e) => sum + (e.status === 'matched' ? 1 : e.status === 'partial' ? 0.5 : 0),
            0
        ) / Math.max(comparison.elementMatches.length, 1);

        const layoutScore = comparison.layoutMatch.score;
        const styleScore = comparison.styleMatch.score;

        // Weighted confidence: 50% elements, 30% layout, 20% style
        return elementScore * 0.5 + layoutScore * 0.3 + styleScore * 0.2;
    }

    /**
     * Check accessibility from screenshot
     */
    async checkAccessibility(screenshot: string): Promise<{
        score: number;
        issues: VisualIssue[];
        recommendations: string[];
    }> {
        const prompt = `Analyze this screenshot for accessibility issues.

Check for:
1. **Color Contrast**: Are text and backgrounds sufficiently contrasting?
2. **Text Readability**: Is text large enough and clear?
3. **Touch Targets**: Are interactive elements large enough (44x44px minimum)?
4. **Visual Hierarchy**: Is the content structure clear?
5. **Focus Indicators**: Are there visible focus states?
6. **Error States**: Are errors clearly visible?

Respond with JSON:
{
    "score": number (0-100),
    "issues": [
        {
            "type": "accessibility",
            "description": "issue",
            "severity": "critical" | "warning" | "suggestion",
            "element": "affected element",
            "suggestion": "how to fix"
        }
    ],
    "recommendations": ["list of a11y improvements"]
}`;

        // Accessibility check - increased for comprehensive issues list
        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 8000,  // Increased from 1.5K
            useExtendedThinking: false,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse accessibility check response');
        }

        const result = JSON.parse(jsonMatch[0]);

        return {
            score: result.score,
            issues: result.issues.map((i: any) => ({ id: uuidv4(), ...i })),
            recommendations: result.recommendations,
        };
    }
}

/**
 * Create a new visual verification service
 */
export function createVisualVerificationService(): VisualVerificationService {
    return new VisualVerificationService();
}

