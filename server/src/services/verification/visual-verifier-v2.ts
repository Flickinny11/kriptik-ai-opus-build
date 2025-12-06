/**
 * Visual Verifier V2 - Anti-Slop Enhanced
 *
 * Comprehensive visual verification that analyzes screenshots and code
 * to ensure high-quality, soul-appropriate UI that doesn't look "AI-generated".
 *
 * Part of Phase 7: Design System (Ultimate AI-First Builder Architecture)
 */

import { createClaudeService, ClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { AppSoul, APP_SOULS, AppSoulType } from '../ai/app-soul.js';

// ============================================================================
// TYPES
// ============================================================================

export interface VisualVerificationResult {
    passed: boolean;

    // Individual Scores (0-100)
    scores: {
        visual: number;           // Overall visual quality
        antiSlop: number;         // Anti-AI-slop score
        soulMatch: number;        // Match to intended soul
        depth: number;            // Visual depth/layering
        motion: number;           // Motion/interaction quality
        typography: number;       // Typography hierarchy
        colorHarmony: number;     // Color palette coherence
    };

    // Aggregated
    overallScore: number;

    // Verdict
    verdict: 'APPROVED' | 'NEEDS_WORK' | 'REJECTED';

    // Issues Found
    issues: VisualIssue[];

    // Recommendations
    recommendations: string[];

    // Details
    analysis: string;
}

export interface VisualIssue {
    category: 'slop' | 'depth' | 'motion' | 'typography' | 'color' | 'soul_mismatch';
    severity: 'critical' | 'warning' | 'suggestion';
    description: string;
    fix: string;
    location?: string;
}

export interface AntiSlopCheckResult {
    passed: boolean;
    score: number;
    violations: AntiSlopViolation[];
}

export interface AntiSlopViolation {
    pattern: string;
    description: string;
    occurrences: number;
    severity: 'critical' | 'warning';
    suggestion: string;
}

// ============================================================================
// ANTI-SLOP PATTERNS
// ============================================================================

const SLOP_PATTERNS = {
    // Typography Crimes
    typography: {
        banned_fonts: ['Arial', 'Times New Roman', 'Comic Sans', 'Papyrus', 'Impact'],
        warning_fonts: ['Inter', 'Roboto', 'Open Sans'], // Only warning, not critical
        generic_font_stack: /font-family:\s*['"]?(system-ui|sans-serif|serif|monospace)['"]?(?!\s*,)/gi,
    },

    // Color Crimes
    colors: {
        pure_white_bg: /bg-white(?![\/\-])/g,
        light_gray_bg: /bg-gray-(50|100|200)/g,
        generic_blue: /bg-blue-500(?![\/\-])/g,
        purple_gradient_slop: /from-purple-\d+.*to-indigo-\d+/g, // The classic AI slop gradient
        too_many_colors: 8, // More than this = rainbow slop
    },

    // Layout Crimes
    layout: {
        centered_everything: /text-center.*text-center.*text-center/gs,
        card_grid_soup: /grid-cols-3.*grid-cols-3.*grid-cols-3/gs,
        hero_with_just_text: /<section[^>]*>[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>[\s\S]*?<\/p>[\s\S]*?<\/section>/gi,
    },

    // Interaction Crimes
    interactions: {
        no_hover_states: /className="[^"]*"(?![^>]*hover:)/g,
        no_transitions: /className="[^"]*(?!.*transition)/g,
        no_shadows: /rounded-[^"]*"(?![^>]*shadow)/g,
    },

    // Content Crimes
    content: {
        lorem_ipsum: /lorem\s+ipsum/gi,
        placeholder_text: /\b(placeholder|TODO|FIXME|TBD|coming soon)\b/gi,
        generic_button_text: /\b(Click here|Submit|Button|Learn more)\b/gi,
        emoji_overuse: /[\u{1F300}-\u{1F9FF}]{3,}/gu, // 3+ emoji in a row
    },

    // Depth Crimes
    depth: {
        flat_cards: /bg-white[^}]*border[^}]*rounded(?![^}]*shadow)/g,
        no_blur: /<div[^>]*(?!backdrop-blur)/g,
        single_shadow: /shadow(?!-(lg|xl|2xl|inner))/g,
    },
};

// ============================================================================
// VISUAL VERIFIER CLASS
// ============================================================================

export class VisualVerifierV2 {
    private claudeService: ClaudeService;
    private targetSoul?: AppSoul;

    constructor(userId: string, projectId: string, soulType?: AppSoulType) {
        this.claudeService = createClaudeService({
            agentType: 'testing',
            projectId,
            userId,
        });

        if (soulType) {
            this.targetSoul = APP_SOULS[soulType];
        }
    }

    /**
     * Set the target soul for verification
     */
    setTargetSoul(soul: AppSoul | AppSoulType): void {
        if (typeof soul === 'string') {
            this.targetSoul = APP_SOULS[soul];
        } else {
            this.targetSoul = soul;
        }
    }

    /**
     * Run comprehensive visual verification
     */
    async verify(
        files: Map<string, string>,
        screenshot?: string // base64 screenshot for visual analysis
    ): Promise<VisualVerificationResult> {
        // Run all verification checks in parallel
        const [
            antiSlopResult,
            depthResult,
            motionResult,
            typographyResult,
            colorResult,
            soulMatchResult,
        ] = await Promise.all([
            this.checkAntiSlop(files),
            this.checkDepth(files),
            this.checkMotion(files),
            this.checkTypography(files),
            this.checkColorHarmony(files),
            this.targetSoul ? this.checkSoulMatch(files, this.targetSoul) : Promise.resolve({ score: 100, issues: [] }),
        ]);

        // AI-assisted visual analysis if screenshot provided
        let visualScore = 70; // Default if no screenshot
        let aiAnalysis = '';

        if (screenshot) {
            const aiResult = await this.runAIVisualAnalysis(screenshot);
            visualScore = aiResult.score;
            aiAnalysis = aiResult.analysis;
        }

        // Compile all issues
        const allIssues: VisualIssue[] = [
            ...antiSlopResult.violations.map(v => ({
                category: 'slop' as const,
                severity: v.severity,
                description: v.description,
                fix: v.suggestion,
            })),
            ...depthResult.issues,
            ...motionResult.issues,
            ...typographyResult.issues,
            ...colorResult.issues,
            ...soulMatchResult.issues,
        ];

        // Calculate scores
        const scores = {
            visual: visualScore,
            antiSlop: antiSlopResult.score,
            soulMatch: soulMatchResult.score,
            depth: depthResult.score,
            motion: motionResult.score,
            typography: typographyResult.score,
            colorHarmony: colorResult.score,
        };

        // Calculate overall score (weighted)
        const overallScore = Math.round(
            scores.antiSlop * 0.25 +
            scores.visual * 0.2 +
            scores.soulMatch * 0.15 +
            scores.depth * 0.15 +
            scores.motion * 0.1 +
            scores.typography * 0.1 +
            scores.colorHarmony * 0.05
        );

        // Determine verdict
        let verdict: 'APPROVED' | 'NEEDS_WORK' | 'REJECTED';
        const criticalIssues = allIssues.filter(i => i.severity === 'critical');

        if (criticalIssues.length > 0 || overallScore < 50) {
            verdict = 'REJECTED';
        } else if (overallScore < 85) {
            verdict = 'NEEDS_WORK';
        } else {
            verdict = 'APPROVED';
        }

        // Generate recommendations
        const recommendations = this.generateRecommendations(scores, allIssues);

        return {
            passed: verdict === 'APPROVED',
            scores,
            overallScore,
            verdict,
            issues: allIssues,
            recommendations,
            analysis: aiAnalysis || this.generateTextAnalysis(scores, allIssues),
        };
    }

    /**
     * Check for anti-slop patterns
     */
    async checkAntiSlop(files: Map<string, string>): Promise<AntiSlopCheckResult> {
        const violations: AntiSlopViolation[] = [];
        let deductions = 0;

        // Combine all UI files
        const uiContent = Array.from(files.entries())
            .filter(([path]) => path.endsWith('.tsx') || path.endsWith('.jsx') || path.endsWith('.css'))
            .map(([, content]) => content)
            .join('\n');

        // Check typography crimes
        for (const font of SLOP_PATTERNS.typography.banned_fonts) {
            const regex = new RegExp(font, 'gi');
            const matches = uiContent.match(regex);
            if (matches) {
                violations.push({
                    pattern: 'banned_font',
                    description: `Using banned font: ${font}`,
                    occurrences: matches.length,
                    severity: 'critical',
                    suggestion: `Replace ${font} with a premium font like Plus Jakarta Sans, Satoshi, or Clash Display`,
                });
                deductions += 20;
            }
        }

        // Check color crimes
        const whiteMatches = uiContent.match(SLOP_PATTERNS.colors.pure_white_bg);
        if (whiteMatches) {
            violations.push({
                pattern: 'pure_white_bg',
                description: 'Using pure white backgrounds (looks flat and generic)',
                occurrences: whiteMatches.length,
                severity: 'critical',
                suggestion: 'Use dark backgrounds (bg-slate-950, bg-[#0a0a0f]) or off-white with blur',
            });
            deductions += 15;
        }

        const lightGrayMatches = uiContent.match(SLOP_PATTERNS.colors.light_gray_bg);
        if (lightGrayMatches) {
            violations.push({
                pattern: 'light_gray_bg',
                description: 'Using light gray backgrounds (corporate AI slop)',
                occurrences: lightGrayMatches.length,
                severity: 'warning',
                suggestion: 'Use dark surfaces with glassmorphism',
            });
            deductions += 10;
        }

        const purpleGradient = uiContent.match(SLOP_PATTERNS.colors.purple_gradient_slop);
        if (purpleGradient) {
            violations.push({
                pattern: 'purple_gradient_slop',
                description: 'Using the classic AI purple-to-indigo gradient',
                occurrences: purpleGradient.length,
                severity: 'warning',
                suggestion: 'Use soul-appropriate gradients or warm amber/orange tones',
            });
            deductions += 10;
        }

        // Check content crimes
        const loremMatches = uiContent.match(SLOP_PATTERNS.content.lorem_ipsum);
        if (loremMatches) {
            violations.push({
                pattern: 'lorem_ipsum',
                description: 'Contains Lorem Ipsum placeholder text',
                occurrences: loremMatches.length,
                severity: 'critical',
                suggestion: 'Replace with real, contextual content',
            });
            deductions += 25;
        }

        const placeholderMatches = uiContent.match(SLOP_PATTERNS.content.placeholder_text);
        if (placeholderMatches) {
            violations.push({
                pattern: 'placeholder_content',
                description: 'Contains placeholder text (TODO, TBD, etc.)',
                occurrences: placeholderMatches.length,
                severity: 'critical',
                suggestion: 'Replace all placeholders with production content',
            });
            deductions += 25;
        }

        // Check emoji overuse
        const emojiMatches = uiContent.match(SLOP_PATTERNS.content.emoji_overuse);
        if (emojiMatches) {
            violations.push({
                pattern: 'emoji_overuse',
                description: 'Excessive emoji usage (AI slop indicator)',
                occurrences: emojiMatches.length,
                severity: 'warning',
                suggestion: 'Use icons (Lucide, Heroicons) instead of emoji',
            });
            deductions += 10;
        }

        const score = Math.max(0, 100 - deductions);

        return {
            passed: score >= 70 && violations.filter(v => v.severity === 'critical').length === 0,
            score,
            violations,
        };
    }

    /**
     * Check visual depth
     */
    private async checkDepth(files: Map<string, string>): Promise<{ score: number; issues: VisualIssue[] }> {
        const issues: VisualIssue[] = [];
        let score = 100;

        const uiContent = this.getUIContent(files);

        // Check for backdrop blur
        if (!uiContent.includes('backdrop-blur')) {
            issues.push({
                category: 'depth',
                severity: 'warning',
                description: 'No backdrop blur effects found',
                fix: 'Add backdrop-blur-xl to glass surfaces',
            });
            score -= 15;
        }

        // Check for layered shadows
        const shadowMatches = uiContent.match(/shadow-(lg|xl|2xl)/g) || [];
        if (shadowMatches.length < 3) {
            issues.push({
                category: 'depth',
                severity: 'suggestion',
                description: 'Limited shadow usage for depth',
                fix: 'Use shadow-xl or shadow-2xl on elevated elements',
            });
            score -= 10;
        }

        // Check for colored shadows
        if (!uiContent.includes('shadow-') || !uiContent.match(/shadow-[a-z]+-\d+\//)) {
            issues.push({
                category: 'depth',
                severity: 'warning',
                description: 'No colored shadows found',
                fix: 'Add colored shadows like shadow-amber-500/20 for glow effects',
            });
            score -= 10;
        }

        // Check for gradient overlays
        if (!uiContent.includes('bg-gradient')) {
            issues.push({
                category: 'depth',
                severity: 'warning',
                description: 'No gradient backgrounds found',
                fix: 'Use bg-gradient-to-br for atmospheric backgrounds',
            });
            score -= 15;
        }

        return { score: Math.max(0, score), issues };
    }

    /**
     * Check motion/interactions
     */
    private async checkMotion(files: Map<string, string>): Promise<{ score: number; issues: VisualIssue[] }> {
        const issues: VisualIssue[] = [];
        let score = 100;

        const uiContent = this.getUIContent(files);

        // Check for transitions
        const transitionMatches = uiContent.match(/transition/g) || [];
        if (transitionMatches.length < 5) {
            issues.push({
                category: 'motion',
                severity: 'warning',
                description: 'Limited transition usage',
                fix: 'Add transition-all duration-200 to interactive elements',
            });
            score -= 15;
        }

        // Check for hover states
        const hoverMatches = uiContent.match(/hover:/g) || [];
        if (hoverMatches.length < 5) {
            issues.push({
                category: 'motion',
                severity: 'warning',
                description: 'Limited hover states',
                fix: 'Add hover:scale-[1.02], hover:shadow-xl, hover:-translate-y-1',
            });
            score -= 15;
        }

        // Check for Framer Motion
        if (!uiContent.includes('framer-motion') && !uiContent.includes('motion.')) {
            issues.push({
                category: 'motion',
                severity: 'suggestion',
                description: 'No Framer Motion animations',
                fix: 'Add Framer Motion for page transitions and micro-interactions',
            });
            score -= 10;
        }

        // Check for active states
        if (!uiContent.includes('active:')) {
            issues.push({
                category: 'motion',
                severity: 'suggestion',
                description: 'No active states for buttons',
                fix: 'Add active:scale-[0.98] for tactile feedback',
            });
            score -= 5;
        }

        return { score: Math.max(0, score), issues };
    }

    /**
     * Check typography
     */
    private async checkTypography(files: Map<string, string>): Promise<{ score: number; issues: VisualIssue[] }> {
        const issues: VisualIssue[] = [];
        let score = 100;

        const uiContent = this.getUIContent(files);

        // Check for typography hierarchy
        const heroText = uiContent.match(/text-(5xl|6xl|7xl|8xl)/g) || [];
        if (heroText.length === 0) {
            issues.push({
                category: 'typography',
                severity: 'warning',
                description: 'No large hero text found',
                fix: 'Use text-5xl md:text-7xl for hero headings',
            });
            score -= 15;
        }

        // Check for font weights
        const boldText = uiContent.match(/font-(semibold|bold)/g) || [];
        if (boldText.length < 3) {
            issues.push({
                category: 'typography',
                severity: 'suggestion',
                description: 'Limited font weight variation',
                fix: 'Use font-bold for headings, font-medium for labels',
            });
            score -= 10;
        }

        // Check for text colors
        if (!uiContent.includes('text-slate-') && !uiContent.includes('text-white')) {
            issues.push({
                category: 'typography',
                severity: 'warning',
                description: 'Missing proper text color hierarchy',
                fix: 'Use text-white for primary, text-slate-300 for secondary',
            });
            score -= 10;
        }

        // Check for gradient text
        if (!uiContent.includes('bg-clip-text') && !uiContent.includes('text-transparent')) {
            issues.push({
                category: 'typography',
                severity: 'suggestion',
                description: 'No gradient text effects',
                fix: 'Use bg-gradient-to-r bg-clip-text text-transparent for accent text',
            });
            score -= 5;
        }

        return { score: Math.max(0, score), issues };
    }

    /**
     * Check color harmony
     */
    private async checkColorHarmony(files: Map<string, string>): Promise<{ score: number; issues: VisualIssue[] }> {
        const issues: VisualIssue[] = [];
        let score = 100;

        const uiContent = this.getUIContent(files);

        // Extract color usage
        const colorMatches = uiContent.match(/(?:bg|text|border|shadow)-([a-z]+)-\d+/g) || [];
        const uniqueColors = new Set(colorMatches.map(m => m.split('-')[1]));

        // Check for too many colors (rainbow slop)
        if (uniqueColors.size > 8) {
            issues.push({
                category: 'color',
                severity: 'warning',
                description: `Too many colors used (${uniqueColors.size})`,
                fix: 'Limit to 3-4 colors plus neutral palette',
            });
            score -= 20;
        }

        // Check for accent consistency
        if (!uiContent.includes('amber-') && !uiContent.includes('orange-')) {
            if (uiContent.includes('blue-500') && uiContent.includes('purple-500') && uiContent.includes('green-500')) {
                issues.push({
                    category: 'color',
                    severity: 'warning',
                    description: 'Multiple competing accent colors',
                    fix: 'Choose one primary accent color and use consistently',
                });
                score -= 15;
            }
        }

        // Check for dark mode consistency
        const darkPatterns = uiContent.match(/(slate|zinc|neutral)-(8|9)\d\d/g) || [];
        if (darkPatterns.length < 3) {
            issues.push({
                category: 'color',
                severity: 'suggestion',
                description: 'Limited dark mode surface variation',
                fix: 'Use slate-950, slate-900/50, slate-800/80 for depth',
            });
            score -= 10;
        }

        return { score: Math.max(0, score), issues };
    }

    /**
     * Check soul match
     */
    private async checkSoulMatch(files: Map<string, string>, soul: AppSoul): Promise<{ score: number; issues: VisualIssue[] }> {
        const issues: VisualIssue[] = [];
        let score = 100;

        const uiContent = this.getUIContent(files);

        // Check for banned patterns
        for (const banned of soul.bannedPatterns) {
            if (uiContent.toLowerCase().includes(banned.toLowerCase())) {
                issues.push({
                    category: 'soul_mismatch',
                    severity: 'warning',
                    description: `Using banned pattern for ${soul.name}: "${banned}"`,
                    fix: `Remove "${banned}" - it doesn't match the ${soul.name} soul`,
                });
                score -= 10;
            }
        }

        // Check for primary color presence
        if (!uiContent.includes(soul.colorPalette.primary)) {
            issues.push({
                category: 'soul_mismatch',
                severity: 'suggestion',
                description: `Primary color (${soul.colorPalette.primary}) not found`,
                fix: `Use ${soul.colorPalette.primary} as the primary accent color`,
            });
            score -= 10;
        }

        // Check depth level matches
        const blurCount = (uiContent.match(/backdrop-blur/g) || []).length;
        const expectedBlur = soul.depth.level === 'immersive' ? 5 : soul.depth.level === 'high' ? 3 : 1;

        if (blurCount < expectedBlur) {
            issues.push({
                category: 'soul_mismatch',
                severity: 'suggestion',
                description: `Depth level doesn't match ${soul.name} soul (${soul.depth.level})`,
                fix: `Add more ${soul.depth.blur} effects for ${soul.depth.level} depth`,
            });
            score -= 10;
        }

        return { score: Math.max(0, score), issues };
    }

    /**
     * Run AI-assisted visual analysis on screenshot
     */
    private async runAIVisualAnalysis(screenshot: string): Promise<{ score: number; analysis: string }> {
        const prompt = `Analyze this UI screenshot for visual quality and "AI slop" indicators.

Score the UI on these criteria (0-100 each):
1. VISUAL POLISH: Does it look professionally designed or AI-generated?
2. DEPTH: Are there shadows, blur, layering, or is it flat?
3. COLOR: Is the palette cohesive or rainbow soup?
4. TYPOGRAPHY: Is there hierarchy or just default fonts?
5. INTERACTIONS: Do buttons/cards look clickable with hover states?

AI SLOP INDICATORS TO CHECK:
- Purple-to-blue gradients (classic AI slop)
- White/gray backgrounds (boring)
- Centered everything (lazy)
- Emoji as decoration (cringe)
- Generic "Lorem ipsum" placeholder text
- Default blue buttons
- Flat cards without shadows
- Missing hover states

Return JSON:
{
    "score": 0-100,
    "analysis": "Brief description of what you see",
    "looks_ai_generated": true/false,
    "issues": ["list of problems"]
}`;

        try {
            const response = await this.claudeService.generate(prompt, {
                model: CLAUDE_MODELS.SONNET_4_5,
                maxTokens: 2000,
                useExtendedThinking: true,
                thinkingBudgetTokens: 8000,
                effort: 'medium',
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return {
                    score: result.score || 70,
                    analysis: result.analysis || 'Visual analysis completed',
                };
            }
        } catch (error) {
            console.error('[VisualVerifierV2] AI analysis failed:', error);
        }

        return { score: 70, analysis: 'AI analysis unavailable' };
    }

    /**
     * Generate recommendations based on scores
     */
    private generateRecommendations(scores: VisualVerificationResult['scores'], issues: VisualIssue[]): string[] {
        const recommendations: string[] = [];

        if (scores.antiSlop < 70) {
            recommendations.push('🚨 Critical: Fix anti-slop violations first (placeholders, banned patterns)');
        }

        if (scores.depth < 80) {
            recommendations.push('Add visual depth with backdrop-blur-xl, shadow-xl, and gradient overlays');
        }

        if (scores.motion < 80) {
            recommendations.push('Add micro-interactions: hover:scale-[1.02], transition-all, active:scale-[0.98]');
        }

        if (scores.typography < 80) {
            recommendations.push('Improve typography hierarchy with larger hero text and varied font weights');
        }

        if (scores.colorHarmony < 80) {
            recommendations.push('Simplify color palette to 3-4 colors plus neutrals');
        }

        if (scores.soulMatch < 80 && this.targetSoul) {
            recommendations.push(`Align design more closely with ${this.targetSoul.name} soul patterns`);
        }

        // Add top 3 critical issues as recommendations
        const criticalIssues = issues.filter(i => i.severity === 'critical').slice(0, 3);
        for (const issue of criticalIssues) {
            recommendations.push(`FIX: ${issue.description} → ${issue.fix}`);
        }

        return recommendations;
    }

    /**
     * Generate text analysis summary
     */
    private generateTextAnalysis(scores: VisualVerificationResult['scores'], issues: VisualIssue[]): string {
        const avgScore = Math.round(
            (scores.visual + scores.antiSlop + scores.depth + scores.motion + scores.typography + scores.colorHarmony + scores.soulMatch) / 7
        );

        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;

        if (avgScore >= 90) {
            return `Excellent visual quality! The UI demonstrates professional design with proper depth, motion, and typography. ${issues.length} minor suggestions for further polish.`;
        } else if (avgScore >= 75) {
            return `Good visual quality with room for improvement. Found ${warningCount} warnings. Focus on adding more depth and micro-interactions.`;
        } else if (avgScore >= 60) {
            return `Acceptable visual quality but shows signs of AI-generated patterns. ${criticalCount} critical issues and ${warningCount} warnings need attention.`;
        } else {
            return `Visual quality needs significant improvement. The UI appears AI-generated with ${criticalCount} critical issues. Consider applying soul-appropriate design patterns and removing slop indicators.`;
        }
    }

    /**
     * Get combined UI content from files
     */
    private getUIContent(files: Map<string, string>): string {
        return Array.from(files.entries())
            .filter(([path]) => path.endsWith('.tsx') || path.endsWith('.jsx') || path.endsWith('.css'))
            .map(([, content]) => content)
            .join('\n');
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createVisualVerifierV2(
    userId: string,
    projectId: string,
    soulType?: AppSoulType
): VisualVerifierV2 {
    return new VisualVerifierV2(userId, projectId, soulType);
}

export default VisualVerifierV2;

