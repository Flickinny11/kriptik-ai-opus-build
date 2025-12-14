/**
 * Anti-Slop Detector Service
 *
 * Implements the Anti-Slop Design Manifesto to detect and prevent
 * generic, AI-generated, low-quality UI patterns.
 *
 * 7 Core Principles:
 * 1. Depth - Real shadows, layers, glass effects
 * 2. Motion - Meaningful animations, not decorative
 * 3. Emoji Ban - Zero tolerance in production UI
 * 4. Typography - Premium fonts, proper hierarchy
 * 5. Color - Intentional palette, not defaults
 * 6. Layout - Purposeful spacing, visual rhythm
 * 7. App Soul - Design matches app's essence
 *
 * Part of Phase 7: Design System (Ultimate AI-First Builder Architecture)
 */

import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import type { AppSoul, AppSoulType } from '../ai/app-soul.js';
import { APP_SOULS } from '../ai/app-soul.js';

// ============================================================================
// ANTI-SLOP TYPES
// ============================================================================

export interface AntiSlopScore {
    overall: number;           // 0-100
    depth: number;             // Visual depth score
    motion: number;            // Animation quality score
    emojiCompliance: number;   // 100 = no emojis, 0 = emoji-infested
    typography: number;        // Font choice & hierarchy score
    color: number;             // Color palette quality score
    layout: number;            // Spacing & structure score
    soulAlignment: number;     // How well design matches app soul

    // Detailed findings
    violations: AntiSlopViolation[];
    recommendations: string[];
    passesThreshold: boolean;  // Threshold is 85
}

export interface AntiSlopViolation {
    rule: AntiSlopRule;
    severity: 'critical' | 'major' | 'minor';
    location: string;          // File path or component name
    description: string;
    suggestion: string;
    codeSnippet?: string;
}

export type AntiSlopRule =
    | 'DEPTH_FLAT_DESIGN'           // No shadows or depth
    | 'DEPTH_DEFAULT_SHADOW'        // Using shadow-sm/md without color
    | 'DEPTH_NO_BLUR'               // Missing backdrop blur on glass
    | 'MOTION_NO_ANIMATION'         // Static UI without transitions
    | 'MOTION_ABRUPT'               // No easing, jarring transitions
    | 'MOTION_DECORATIVE'           // Animation without purpose
    | 'EMOJI_IN_UI'                 // Any emoji in UI text
    | 'EMOJI_IN_HEADING'            // Emoji in h1-h6
    | 'EMOJI_IN_BUTTON'             // Emoji in button labels
    | 'TYPO_SYSTEM_FONT'            // Using system fonts only
    | 'TYPO_NO_HIERARCHY'           // All text same size/weight
    | 'TYPO_GENERIC_FONT'           // Inter/Arial/Roboto overuse
    | 'COLOR_DEFAULT_GRAY'          // gray-* without intent
    | 'COLOR_NO_PALETTE'            // Random colors, no system
    | 'COLOR_PURPLE_GRADIENT'       // The classic AI slop gradient
    | 'COLOR_LOW_CONTRAST'          // Poor accessibility
    | 'LAYOUT_NO_SPACING_SYSTEM'    // Inconsistent padding/margin
    | 'LAYOUT_CENTERED_EVERYTHING'  // Lazy center alignment
    | 'LAYOUT_NO_VISUAL_RHYTHM'     // Monotonous structure
    | 'SOUL_MISMATCH'               // Design doesn't match app type
    | 'SOUL_GENERIC'                // Could be any app
    | 'PLACEHOLDER_DETECTED';       // Lorem ipsum, TODO, etc.

// Pattern detection configurations
const SLOP_PATTERNS = {
    // Emoji patterns (strict ban)
    emojiRegex: /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,

    // Generic font patterns
    genericFonts: [
        'font-sans',
        'font-serif',
        'font-mono', // Okay for code, bad for UI
        'Arial',
        'Helvetica',
        'sans-serif',
        'system-ui',
    ],

    // Banned color patterns (AI slop signatures)
    bannedColorPatterns: [
        /from-purple-\d+ to-pink-\d+/,  // Classic AI gradient
        /from-blue-\d+ to-purple-\d+/,  // Another AI favorite
        /gray-[234]00/,                  // Generic light grays
        /bg-white(?!\s*\/)/,            // Pure white backgrounds
        /text-gray-500/,                // Generic gray text
    ],

    // Flat design indicators
    flatDesignPatterns: [
        'shadow-sm',
        'shadow-md',
        'shadow-lg', // Without color is still flat
        /border(?!-[a-z]+-\d+\/)/,     // Borders without opacity
    ],

    // No animation indicators
    staticPatterns: [
        /class="[^"]*"/, // Classes without transition/animate
    ],

    // Placeholder patterns
    placeholderPatterns: [
        /lorem ipsum/i,
        /TODO/,
        /FIXME/,
        /placeholder/i,
        /example\.com/,
        /test@test/,
        /\$\d+\.00/, // Generic pricing
        /Image \d+/i,
        /Title Here/i,
        /Description text/i,
    ],
};

// Required patterns for quality UI
const QUALITY_PATTERNS = {
    // Depth indicators
    depth: [
        'backdrop-blur',
        'shadow-.*\\/[0-9]+',       // Shadow with opacity
        'bg-.*\\/[0-9]+',           // Background with opacity
        'border-.*\\/[0-9]+',       // Border with opacity
    ],

    // Motion indicators
    motion: [
        'transition-',
        'animate-',
        'duration-',
        'ease-',
        'hover:',
        'group-hover:',
    ],

    // Typography quality
    typography: [
        'font-',
        'text-[2-9]xl',
        'tracking-',
        'leading-',
    ],

    // Layout quality
    layout: [
        'gap-',
        'space-',
        'grid-cols-',
        'flex-',
        'p-[4-9]',
        'm-[4-9]',
    ],

    // Premium fallback patterns - CSS alternatives to 3D/JS effects
    // These should NEVER be flagged as violations
    premiumFallbacks: [
        'premium-glass-fallback',
        'premium-background-fallback',
        'premium-spline-fallback',
        'scroll-animate',
        'stagger-container',
        'transition-card',
        'lottie-fallback-',
        'webgpu-fallback-',
        'view-transition-name',
        '@keyframes slide-up-fade',
        '@keyframes scale-in',
        '@keyframes stagger-fade-in',
        'animation-timeline: view()',
        'backdrop-filter: blur',
        'inset 0 1px 1px rgba',
        'inset 0 0 32px rgba',
    ],
};

// ============================================================================
// ANTI-SLOP DETECTOR CLASS
// ============================================================================

export class AntiSlopDetector {
    private claudeService: ReturnType<typeof createClaudeService>;
    private threshold: number = 85;
    private appSoul?: AppSoul;

    constructor(userId: string, projectId: string, soulType?: AppSoulType) {
        this.claudeService = createClaudeService({
            agentType: 'verification',
            projectId,
            userId,
        });

        if (soulType) {
            this.appSoul = APP_SOULS[soulType];
        }
    }

    /**
     * Set the app soul for design alignment checking
     */
    setAppSoul(soulType: AppSoulType): void {
        this.appSoul = APP_SOULS[soulType];
    }

    /**
     * Set the minimum passing threshold (default 85)
     */
    setThreshold(threshold: number): void {
        this.threshold = Math.max(0, Math.min(100, threshold));
    }

    /**
     * Analyze code for anti-slop compliance
     */
    async analyze(files: Map<string, string>): Promise<AntiSlopScore> {
        const violations: AntiSlopViolation[] = [];

        // Static analysis for each file
        for (const [path, content] of files.entries()) {
            // Skip non-UI files
            if (!this.isUIFile(path)) continue;

            // Check for emoji violations
            violations.push(...this.checkEmoji(path, content));

            // Check for placeholder violations
            violations.push(...this.checkPlaceholders(path, content));

            // Check for flat design violations
            violations.push(...this.checkDepth(path, content));

            // Check for typography violations
            violations.push(...this.checkTypography(path, content));

            // Check for color violations
            violations.push(...this.checkColors(path, content));

            // Check for layout violations
            violations.push(...this.checkLayout(path, content));

            // Check for motion violations
            violations.push(...this.checkMotion(path, content));
        }

        // Calculate scores
        const scores = this.calculateScores(files, violations);

        // AI-powered soul alignment check
        const soulAlignmentScore = await this.checkSoulAlignment(files);

        // Calculate overall score
        const overall = this.calculateOverallScore({
            ...scores,
            soulAlignment: soulAlignmentScore,
        });

        // Generate recommendations
        const recommendations = this.generateRecommendations(violations, scores);

        return {
            overall,
            ...scores,
            soulAlignment: soulAlignmentScore,
            violations,
            recommendations,
            passesThreshold: overall >= this.threshold,
        };
    }

    /**
     * Quick check for critical violations only (faster)
     */
    quickCheck(files: Map<string, string>): { pass: boolean; criticalViolations: AntiSlopViolation[] } {
        const criticalViolations: AntiSlopViolation[] = [];

        for (const [path, content] of files.entries()) {
            if (!this.isUIFile(path)) continue;

            // Only check for critical violations
            const emojiViolations = this.checkEmoji(path, content).filter(v => v.severity === 'critical');
            const placeholderViolations = this.checkPlaceholders(path, content).filter(v => v.severity === 'critical');

            criticalViolations.push(...emojiViolations, ...placeholderViolations);
        }

        return {
            pass: criticalViolations.length === 0,
            criticalViolations,
        };
    }

    // ==========================================================================
    // VIOLATION CHECKERS
    // ==========================================================================

    private checkEmoji(path: string, content: string): AntiSlopViolation[] {
        const violations: AntiSlopViolation[] = [];
        const matches = content.match(SLOP_PATTERNS.emojiRegex);

        if (matches) {
            // Check if emojis are in UI-critical locations
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (SLOP_PATTERNS.emojiRegex.test(line)) {
                    const isHeading = /<h[1-6]|className=".*text-[2-9]xl/i.test(line);
                    const isButton = /<button|<Button|type="submit"|type="button"/i.test(line);

                    violations.push({
                        rule: isHeading ? 'EMOJI_IN_HEADING' : isButton ? 'EMOJI_IN_BUTTON' : 'EMOJI_IN_UI',
                        severity: isHeading || isButton ? 'critical' : 'major',
                        location: `${path}:${index + 1}`,
                        description: `Emoji detected in ${isHeading ? 'heading' : isButton ? 'button' : 'UI text'}`,
                        suggestion: 'Remove emoji. Use Lucide icons or SVGs instead for visual elements.',
                        codeSnippet: line.trim().substring(0, 100),
                    });
                }
            });
        }

        return violations;
    }

    private checkPlaceholders(path: string, content: string): AntiSlopViolation[] {
        const violations: AntiSlopViolation[] = [];

        SLOP_PATTERNS.placeholderPatterns.forEach(pattern => {
            const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'gi');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    violations.push({
                        rule: 'PLACEHOLDER_DETECTED',
                        severity: 'critical',
                        location: `${path}:${index + 1}`,
                        description: `Placeholder content detected: ${pattern}`,
                        suggestion: 'Replace with real, contextual content that reflects the app\'s purpose.',
                        codeSnippet: line.trim().substring(0, 100),
                    });
                }
            });
        });

        return violations;
    }

    private checkDepth(path: string, content: string): AntiSlopViolation[] {
        const violations: AntiSlopViolation[] = [];

        // Check for depth-providing patterns
        const hasDepth = QUALITY_PATTERNS.depth.some(pattern =>
            new RegExp(pattern).test(content)
        );

        // Check for flat design patterns
        const hasFlatPatterns = SLOP_PATTERNS.flatDesignPatterns.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(content) && !content.includes('shadow-') && !content.includes('/');
            }
            return content.includes(pattern) && !content.includes(`${pattern}-`) && !content.includes('/');
        });

        // Count shadow usage without color
        const shadowWithoutColor = (content.match(/shadow-(sm|md|lg|xl|2xl)(?!\s*shadow-)/g) || []).length;
        const shadowWithColor = (content.match(/shadow-[a-z]+-\d+\/?\d*/g) || []).length;

        if (!hasDepth && this.isUIFile(path)) {
            violations.push({
                rule: 'DEPTH_FLAT_DESIGN',
                severity: 'major',
                location: path,
                description: 'No visual depth detected (no backdrop-blur, shadows with color, or layered backgrounds)',
                suggestion: 'Add backdrop-blur, colored shadows (shadow-violet-500/20), or semi-transparent backgrounds.',
            });
        }

        if (shadowWithoutColor > shadowWithColor && shadowWithoutColor > 0) {
            violations.push({
                rule: 'DEPTH_DEFAULT_SHADOW',
                severity: 'minor',
                location: path,
                description: `${shadowWithoutColor} generic shadows without color tinting`,
                suggestion: 'Use colored shadows like shadow-violet-500/20 instead of plain shadow-lg.',
            });
        }

        return violations;
    }

    private checkTypography(path: string, content: string): AntiSlopViolation[] {
        const violations: AntiSlopViolation[] = [];

        // Check for generic fonts
        const usesGenericFonts = SLOP_PATTERNS.genericFonts.some(font =>
            content.includes(font) || content.toLowerCase().includes(font.toLowerCase())
        );

        // Check for typography hierarchy
        const hasHierarchy =
            (content.match(/text-(xs|sm|base|lg|xl|[2-9]xl)/g) || []).length > 2;

        // Check for font weight variation
        const hasFontWeights =
            (content.match(/font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)/g) || []).length > 1;

        if (usesGenericFonts && !content.includes("font-['")) {
            violations.push({
                rule: 'TYPO_GENERIC_FONT',
                severity: 'minor',
                location: path,
                description: 'Using generic system fonts instead of custom typography',
                suggestion: 'Import and use distinctive fonts like Plus Jakarta Sans, Clash Display, or Inter with proper weights.',
            });
        }

        if (!hasHierarchy && this.hasTextContent(content)) {
            violations.push({
                rule: 'TYPO_NO_HIERARCHY',
                severity: 'major',
                location: path,
                description: 'Missing typographic hierarchy (all text appears same size)',
                suggestion: 'Establish clear hierarchy with varied text sizes: hero (6xl+), h1 (4xl), h2 (2xl), body (base).',
            });
        }

        return violations;
    }

    private checkColors(path: string, content: string): AntiSlopViolation[] {
        const violations: AntiSlopViolation[] = [];

        // Check for banned color patterns (AI slop signatures)
        SLOP_PATTERNS.bannedColorPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                const match = content.match(pattern);
                violations.push({
                    rule: 'COLOR_PURPLE_GRADIENT',
                    severity: 'major',
                    location: path,
                    description: `AI-slop color pattern detected: ${match?.[0]}`,
                    suggestion: 'Use intentional, soul-aligned color palette instead of generic gradients.',
                });
            }
        });

        // Check for default gray overuse
        const grayUsage = (content.match(/gray-\d{3}/g) || []).length;
        const coloredUsage = (content.match(/(violet|purple|rose|amber|emerald|cyan|blue|pink|orange|lime)-\d{3}/g) || []).length;

        if (grayUsage > coloredUsage * 2 && grayUsage > 5) {
            violations.push({
                rule: 'COLOR_DEFAULT_GRAY',
                severity: 'minor',
                location: path,
                description: `Overuse of generic gray (${grayUsage} uses vs ${coloredUsage} colored)`,
                suggestion: 'Use slate-* instead of gray-*, and add accent colors that match the app soul.',
            });
        }

        return violations;
    }

    private checkLayout(path: string, content: string): AntiSlopViolation[] {
        const violations: AntiSlopViolation[] = [];

        // Check for spacing system
        const hasSpacingSystem = QUALITY_PATTERNS.layout.some(pattern =>
            new RegExp(pattern).test(content)
        );

        // Check for over-centering
        const centerCount = (content.match(/text-center|items-center|justify-center|mx-auto/g) || []).length;
        const totalLayoutClasses = (content.match(/flex|grid|items-|justify-|text-(left|right|center)/g) || []).length;

        if (!hasSpacingSystem && this.hasLayoutContent(content)) {
            violations.push({
                rule: 'LAYOUT_NO_SPACING_SYSTEM',
                severity: 'minor',
                location: path,
                description: 'No consistent spacing system detected',
                suggestion: 'Use consistent gap-*, space-*, p-*, m-* with a 4px/8px grid system.',
            });
        }

        if (centerCount > totalLayoutClasses * 0.7 && centerCount > 5) {
            violations.push({
                rule: 'LAYOUT_CENTERED_EVERYTHING',
                severity: 'minor',
                location: path,
                description: 'Over-reliance on center alignment (lazy centering)',
                suggestion: 'Vary alignment. Use text-left for body copy, asymmetric layouts for visual interest.',
            });
        }

        return violations;
    }

    private checkMotion(path: string, content: string): AntiSlopViolation[] {
        const violations: AntiSlopViolation[] = [];

        // Check for motion patterns
        const hasTransitions = /transition-/.test(content);
        const hasAnimations = /animate-/.test(content);
        const hasHoverEffects = /hover:/.test(content);
        const hasDurations = /duration-/.test(content);

        // Interactive components that should have motion
        const hasInteractiveElements = /<button|<Button|<a\s|<Link|onClick|onSubmit/i.test(content);

        if (hasInteractiveElements && !hasTransitions && !hasHoverEffects) {
            violations.push({
                rule: 'MOTION_NO_ANIMATION',
                severity: 'major',
                location: path,
                description: 'Interactive elements without transitions or hover effects',
                suggestion: 'Add hover:scale-[1.02], transition-all duration-200, and hover:shadow-lg effects.',
            });
        }

        if (hasTransitions && !hasDurations) {
            violations.push({
                rule: 'MOTION_ABRUPT',
                severity: 'minor',
                location: path,
                description: 'Transitions without specified duration (may feel abrupt)',
                suggestion: 'Add duration-200 or duration-300 for smooth, polished animations.',
            });
        }

        return violations;
    }

    // ==========================================================================
    // SCORING & ANALYSIS
    // ==========================================================================

    private calculateScores(files: Map<string, string>, violations: AntiSlopViolation[]): {
        depth: number;
        motion: number;
        emojiCompliance: number;
        typography: number;
        color: number;
        layout: number;
    } {
        // Count violations by category
        const violationCounts = {
            depth: violations.filter(v => v.rule.startsWith('DEPTH_')).length,
            motion: violations.filter(v => v.rule.startsWith('MOTION_')).length,
            emoji: violations.filter(v => v.rule.startsWith('EMOJI_')).length,
            typography: violations.filter(v => v.rule.startsWith('TYPO_')).length,
            color: violations.filter(v => v.rule.startsWith('COLOR_')).length,
            layout: violations.filter(v => v.rule.startsWith('LAYOUT_')).length,
        };

        // Count quality patterns found
        let qualityPatternCounts = {
            depth: 0,
            motion: 0,
            typography: 0,
            layout: 0,
        };

        for (const [, content] of files.entries()) {
            QUALITY_PATTERNS.depth.forEach(p => {
                if (new RegExp(p).test(content)) qualityPatternCounts.depth++;
            });
            QUALITY_PATTERNS.motion.forEach(p => {
                if (new RegExp(p).test(content)) qualityPatternCounts.motion++;
            });
            QUALITY_PATTERNS.typography.forEach(p => {
                if (new RegExp(p).test(content)) qualityPatternCounts.typography++;
            });
            QUALITY_PATTERNS.layout.forEach(p => {
                if (new RegExp(p).test(content)) qualityPatternCounts.layout++;
            });
        }

        // Calculate scores (100 = perfect, penalties for violations, bonuses for quality patterns)
        const baseScore = 85;
        const criticalPenalty = 25;
        const majorPenalty = 15;
        const minorPenalty = 5;
        const patternBonus = 3;

        const penalize = (count: number, critical = 0) => {
            const criticals = violations.filter(v => v.severity === 'critical').length;
            const majors = violations.filter(v => v.severity === 'major').length;
            const minors = count - criticals - majors;
            return criticals * criticalPenalty + majors * majorPenalty + minors * minorPenalty;
        };

        return {
            depth: Math.max(0, Math.min(100, baseScore - penalize(violationCounts.depth) + qualityPatternCounts.depth * patternBonus)),
            motion: Math.max(0, Math.min(100, baseScore - penalize(violationCounts.motion) + qualityPatternCounts.motion * patternBonus)),
            emojiCompliance: violationCounts.emoji === 0 ? 100 : Math.max(0, 100 - violationCounts.emoji * criticalPenalty),
            typography: Math.max(0, Math.min(100, baseScore - penalize(violationCounts.typography) + qualityPatternCounts.typography * patternBonus)),
            color: Math.max(0, Math.min(100, baseScore - penalize(violationCounts.color))),
            layout: Math.max(0, Math.min(100, baseScore - penalize(violationCounts.layout) + qualityPatternCounts.layout * patternBonus)),
        };
    }

    private async checkSoulAlignment(files: Map<string, string>): Promise<number> {
        if (!this.appSoul) {
            return 80; // Default score if no soul defined
        }

        // Combine UI files for analysis
        const uiContent = Array.from(files.entries())
            .filter(([path]) => this.isUIFile(path))
            .map(([path, content]) => `// ${path}\n${content}`)
            .join('\n\n')
            .substring(0, 30000); // Limit for context

        const prompt = `Analyze this UI code for alignment with the "${this.appSoul.name}" design soul.

DESIGN SOUL REQUIREMENTS:
${JSON.stringify(this.appSoul, null, 2)}

UI CODE:
${uiContent}

Score from 0-100 how well this UI aligns with the design soul. Consider:
1. Color palette match
2. Typography style match
3. Depth level match
4. Motion philosophy match
5. Component pattern match
6. Avoidance of banned patterns

Respond with ONLY a number 0-100. No explanation.`;

        try {
            const response = await this.claudeService.generate(prompt, {
                model: CLAUDE_MODELS.HAIKU_3_5,
                maxTokens: 10,
                useExtendedThinking: false,
            });

            const score = parseInt(response.content.trim(), 10);
            return isNaN(score) ? 75 : Math.max(0, Math.min(100, score));
        } catch {
            return 75; // Default if AI call fails
        }
    }

    private calculateOverallScore(scores: {
        depth: number;
        motion: number;
        emojiCompliance: number;
        typography: number;
        color: number;
        layout: number;
        soulAlignment: number;
    }): number {
        // Weighted average - emoji compliance is most important (zero tolerance)
        const weights = {
            depth: 0.15,
            motion: 0.10,
            emojiCompliance: 0.20,    // Zero tolerance = high weight
            typography: 0.15,
            color: 0.15,
            layout: 0.10,
            soulAlignment: 0.15,
        };

        const weighted =
            scores.depth * weights.depth +
            scores.motion * weights.motion +
            scores.emojiCompliance * weights.emojiCompliance +
            scores.typography * weights.typography +
            scores.color * weights.color +
            scores.layout * weights.layout +
            scores.soulAlignment * weights.soulAlignment;

        return Math.round(weighted);
    }

    private generateRecommendations(violations: AntiSlopViolation[], scores: Record<string, number>): string[] {
        const recommendations: string[] = [];

        // Priority recommendations based on lowest scores
        const sortedScores = Object.entries(scores)
            .filter(([key]) => key !== 'emojiCompliance') // Handle emoji separately
            .sort(([, a], [, b]) => a - b);

        // Top 3 areas to improve
        sortedScores.slice(0, 3).forEach(([category, score]) => {
            if (score < 80) {
                recommendations.push(this.getRecommendationForCategory(category, score));
            }
        });

        // Specific violation-based recommendations
        const criticalViolations = violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0) {
            recommendations.unshift(`FIX CRITICAL: ${criticalViolations.length} critical violations must be resolved immediately.`);
        }

        // Emoji-specific recommendation
        if (scores.emojiCompliance !== undefined && scores.emojiCompliance < 100) {
            recommendations.unshift('EMOJI BAN: Remove ALL emojis from UI. Use Lucide React icons instead.');
        }

        return recommendations.slice(0, 5); // Top 5 recommendations
    }

    private getRecommendationForCategory(category: string, score: number): string {
        const recommendations: Record<string, string> = {
            depth: `ADD DEPTH (${score}/100): Use backdrop-blur-xl, shadow-violet-500/20, bg-slate-900/50 for layered glass effect.`,
            motion: `ADD MOTION (${score}/100): Add hover:scale-[1.02], transition-all duration-300, animate-in fade-in.`,
            typography: `IMPROVE TYPOGRAPHY (${score}/100): Use distinctive fonts, establish clear size hierarchy (hero→h1→body).`,
            color: `REFINE COLORS (${score}/100): Replace gray-* with slate-*, add accent colors matching the app soul.`,
            layout: `ENHANCE LAYOUT (${score}/100): Use consistent gap-6, px-8, establish visual rhythm with varied spacing.`,
            soulAlignment: `ALIGN WITH SOUL (${score}/100): Review the app soul definition and match its color, depth, and motion philosophy.`,
        };

        return recommendations[category] || `IMPROVE ${category.toUpperCase()} (${score}/100)`;
    }

    // ==========================================================================
    // HELPER METHODS
    // ==========================================================================

    private isUIFile(path: string): boolean {
        return /\.(tsx|jsx|vue|svelte|html|css)$/i.test(path) &&
            !path.includes('.test.') &&
            !path.includes('.spec.') &&
            !path.includes('node_modules');
    }

    private hasTextContent(content: string): boolean {
        return /<[^>]+>[^<]{10,}<\//.test(content) || // Has text in tags
            /className="[^"]*text-/.test(content);  // Has text styling
    }

    private hasLayoutContent(content: string): boolean {
        return /className="[^"]*(?:flex|grid|p-|m-|gap-)/.test(content);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createAntiSlopDetector(
    userId: string,
    projectId: string,
    soulType?: AppSoulType
): AntiSlopDetector {
    return new AntiSlopDetector(userId, projectId, soulType);
}

export default AntiSlopDetector;

