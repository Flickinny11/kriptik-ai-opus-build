/**
 * Design Style Agent
 *
 * Enforces Anti-Slop Design Manifesto principles.
 * NON-BLOCKING agent - provides design quality feedback.
 *
 * Evaluates:
 * - DEPTH: Layered, dimensional UI (no flat cards)
 * - MOTION: Physics-based animations
 * - EMOJI BAN: Zero tolerance for emojis in UI
 * - TYPOGRAPHY: Unique, non-standard fonts
 * - COLOR: Cohesive, intentional palettes
 * - LAYOUT: Asymmetric, editorial layouts
 * - APP SOUL: Design personality consistency
 *
 * Part of Phase 4: 6-Agent Verification Swarm
 */

import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { AppSoul, AppSoulMapper, APP_SOULS } from '../ai/app-soul.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type DesignPrinciple =
    | 'depth'
    | 'motion'
    | 'emoji_ban'
    | 'typography'
    | 'color'
    | 'layout'
    | 'app_soul';

export type DesignViolationSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface DesignViolation {
    id: string;
    principle: DesignPrinciple;
    severity: DesignViolationSeverity;
    title: string;
    description: string;
    file: string;
    line?: number;
    code?: string;
    recommendation: string;
}

export interface DesignScores {
    overall: number;         // 0-100
    depth: number;
    motion: number;
    typography: number;
    color: number;
    layout: number;
    appSoul: number;
}

export interface DesignStyleResult {
    timestamp: Date;
    passed: boolean;
    scores: DesignScores;
    violations: DesignViolation[];
    summary: string;
    recommendations: string[];
    detectedSoul?: string;
}

export interface DesignStyleConfig {
    minOverallScore: number;
    targetSoul?: string;             // Expected app soul type
    enableAIAnalysis: boolean;
    strictEmojiEnforcement: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: DesignStyleConfig = {
    minOverallScore: 70,
    enableAIAnalysis: true,
    strictEmojiEnforcement: true,
};

// ============================================================================
// ANTI-SLOP PATTERNS (Things to detect and flag)
// ============================================================================

const ANTI_SLOP_PATTERNS = {
    // Banned generic fonts
    genericFonts: [
        'system-ui',
        'Arial',
        'Helvetica',
        'sans-serif',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
    ],

    // Banned generic colors (AI slop indicators)
    genericColors: [
        '#f3f4f6',  // Tailwind gray-100
        '#e5e7eb',  // Tailwind gray-200
        '#6b7280',  // Tailwind gray-500
        '#374151',  // Tailwind gray-700
        '#1f2937',  // Tailwind gray-800
        '#8b5cf6',  // Generic purple (overused)
        'gray',
        'grey',
    ],

    // Flat/generic shadow patterns
    flatShadows: [
        'shadow-sm',
        'shadow-md',
        'shadow-lg',
        'shadow-xl',
        // Without color modifications
    ],

    // Emoji patterns in UI text
    emojiPatterns: [
        /[\u{1F300}-\u{1F9FF}]/gu,  // Misc symbols and pictographs
        /[\u{2600}-\u{26FF}]/gu,    // Misc symbols
        /[\u{2700}-\u{27BF}]/gu,    // Dingbats
        /[\u{1F600}-\u{1F64F}]/gu,  // Emoticons
        /[\u{1F680}-\u{1F6FF}]/gu,  // Transport/map symbols
        /:\w+:/g,                    // :emoji: syntax
    ],

    // Generic layout patterns
    genericLayouts: [
        'grid-cols-3',
        'grid-cols-4',
        'flex justify-center items-center',
        'mx-auto max-w-',
    ],

    // Missing depth indicators
    noDepthPatterns: [
        'border-gray-',
        'border-slate-',
        'bg-white',
        'bg-gray-',
        'bg-slate-',
    ],

    // Static (no motion) patterns
    noMotionPatterns: [
        // Elements that should have transitions but don't
        /className="[^"]*(?:btn|button|card|modal)[^"]*"(?![\s\S]*transition)/gi,
    ],
};

// ============================================================================
// DESIGN STYLE AGENT
// ============================================================================

export class DesignStyleAgent extends EventEmitter {
    private projectId: string;
    private userId: string;
    private config: DesignStyleConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private appSoulMapper: AppSoulMapper;
    private lastResult?: DesignStyleResult;

    constructor(
        projectId: string,
        userId: string,
        config?: Partial<DesignStyleConfig>
    ) {
        super();
        this.projectId = projectId;
        this.userId = userId;
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.claudeService = createClaudeService({
            agentType: 'verification',
            projectId,
            userId,
        });

        this.appSoulMapper = new AppSoulMapper(userId, projectId);
    }

    /**
     * Analyze design quality of codebase
     */
    async analyze(
        files: Map<string, string>,
        appDescription?: string
    ): Promise<DesignStyleResult> {
        const startTime = Date.now();
        const violations: DesignViolation[] = [];

        console.log(`[DesignStyleAgent] Analyzing ${files.size} files...`);

        // Filter to UI files only
        const uiFiles = new Map(
            Array.from(files.entries()).filter(([path]) => this.isUIFile(path))
        );

        // Detect app soul if description provided
        let detectedSoul: AppSoul | undefined;
        if (appDescription) {
            detectedSoul = await this.appSoulMapper.detectSoul(appDescription);
        }

        // Static pattern analysis
        for (const [filePath, content] of uiFiles.entries()) {
            const fileViolations = this.analyzeFile(filePath, content, detectedSoul);
            violations.push(...fileViolations);
        }

        // AI-powered analysis
        let aiRecommendations: string[] = [];
        if (this.config.enableAIAnalysis && uiFiles.size > 0) {
            const aiResult = await this.runAIAnalysis(uiFiles, detectedSoul);
            violations.push(...aiResult.violations);
            aiRecommendations = aiResult.recommendations;
        }

        // Calculate scores
        const scores = this.calculateScores(violations, uiFiles);

        const result: DesignStyleResult = {
            timestamp: new Date(),
            passed: scores.overall >= this.config.minOverallScore,
            scores,
            violations,
            summary: this.generateSummary(scores, violations),
            recommendations: aiRecommendations,
            detectedSoul: detectedSoul?.name,
        };

        this.lastResult = result;
        this.emit('analysis_complete', result);

        console.log(`[DesignStyleAgent] Analysis complete: Score ${scores.overall}/100 (${Date.now() - startTime}ms)`);

        return result;
    }

    /**
     * Get last analysis result
     */
    getLastResult(): DesignStyleResult | undefined {
        return this.lastResult;
    }

    // ==========================================================================
    // FILE ANALYSIS
    // ==========================================================================

    private isUIFile(path: string): boolean {
        return /\.(tsx|jsx|vue|svelte|css|scss)$/i.test(path) &&
               !path.includes('.test.') &&
               !path.includes('.spec.');
    }

    private analyzeFile(
        filePath: string,
        content: string,
        soul?: AppSoul
    ): DesignViolation[] {
        const violations: DesignViolation[] = [];
        const lines = content.split('\n');

        // Check for emoji violations (CRITICAL - Zero Tolerance)
        violations.push(...this.checkEmojis(filePath, content, lines));

        // Check for generic fonts
        violations.push(...this.checkFonts(filePath, content, lines));

        // Check for flat/generic styling
        violations.push(...this.checkDepth(filePath, content, lines));

        // Check for missing motion
        violations.push(...this.checkMotion(filePath, content, lines));

        // Check for generic colors
        violations.push(...this.checkColors(filePath, content, lines));

        // Check against soul-specific banned patterns
        if (soul) {
            violations.push(...this.checkSoulViolations(filePath, content, lines, soul));
        }

        return violations;
    }

    private checkEmojis(filePath: string, content: string, lines: string[]): DesignViolation[] {
        const violations: DesignViolation[] = [];

        // Skip if not JSX/TSX (might be backend)
        if (!filePath.match(/\.(tsx|jsx)$/)) return violations;

        for (const pattern of ANTI_SLOP_PATTERNS.emojiPatterns) {
            pattern.lastIndex = 0;
            let match;

            while ((match = pattern.exec(content)) !== null) {
                // Find line number
                const lineNumber = this.getLineNumber(content, match.index);
                const line = lines[lineNumber - 1] || '';

                // Skip if in a comment
                if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
                    continue;
                }

                // Skip if it's in an icon import or variable name
                if (line.includes('import') || line.includes('Icon')) {
                    continue;
                }

                violations.push({
                    id: uuidv4(),
                    principle: 'emoji_ban',
                    severity: this.config.strictEmojiEnforcement ? 'critical' : 'major',
                    title: 'Emoji detected in UI',
                    description: `Found emoji "${match[0]}" - violates Anti-Slop Design Manifesto`,
                    file: filePath,
                    line: lineNumber,
                    code: line.trim().substring(0, 80),
                    recommendation: 'Replace with a custom icon, illustration, or meaningful text',
                });
            }
        }

        return violations;
    }

    private checkFonts(filePath: string, content: string, lines: string[]): DesignViolation[] {
        const violations: DesignViolation[] = [];

        for (const font of ANTI_SLOP_PATTERNS.genericFonts) {
            const regex = new RegExp(`font-family[^;]*${font}`, 'gi');
            let match;

            while ((match = regex.exec(content)) !== null) {
                const lineNumber = this.getLineNumber(content, match.index);

                violations.push({
                    id: uuidv4(),
                    principle: 'typography',
                    severity: 'major',
                    title: 'Generic system font detected',
                    description: `Using "${font}" - apps should have unique typography`,
                    file: filePath,
                    line: lineNumber,
                    recommendation: 'Use a distinctive font like Plus Jakarta Sans, Satoshi, Clash Display, or similar',
                });
            }
        }

        // Also check for Tailwind font classes
        const tailwindFontPattern = /font-(sans|serif|mono)(?!\w)/g;
        let match;
        while ((match = tailwindFontPattern.exec(content)) !== null) {
            const lineNumber = this.getLineNumber(content, match.index);

            violations.push({
                id: uuidv4(),
                principle: 'typography',
                severity: 'minor',
                title: 'Default Tailwind font class',
                description: `Using default "${match[0]}" class - customize typography`,
                file: filePath,
                line: lineNumber,
                recommendation: 'Define custom font families in Tailwind config',
            });
        }

        return violations;
    }

    private checkDepth(filePath: string, content: string, lines: string[]): DesignViolation[] {
        const violations: DesignViolation[] = [];

        // Check for flat backgrounds
        for (const pattern of ANTI_SLOP_PATTERNS.noDepthPatterns) {
            if (content.includes(pattern)) {
                const regex = new RegExp(pattern, 'g');
                let match;

                while ((match = regex.exec(content)) !== null) {
                    const lineNumber = this.getLineNumber(content, match.index);

                    violations.push({
                        id: uuidv4(),
                        principle: 'depth',
                        severity: 'minor',
                        title: 'Flat styling detected',
                        description: `Using "${pattern}" - add depth with blur, shadows, gradients`,
                        file: filePath,
                        line: lineNumber,
                        recommendation: 'Use backdrop-blur, colored shadows, gradients, or layered surfaces',
                    });
                }
            }
        }

        // Check for shadows without color (generic)
        for (const shadow of ANTI_SLOP_PATTERNS.flatShadows) {
            const regex = new RegExp(`${shadow}(?!-[a-z]+\\/|\\s+shadow-)`, 'g');
            let match;

            while ((match = regex.exec(content)) !== null) {
                // Check if there's a colored shadow modifier nearby
                const context = content.substring(
                    Math.max(0, match.index - 50),
                    Math.min(content.length, match.index + 100)
                );

                if (!context.includes('shadow-') || !context.match(/shadow-[a-z]+-\d+/)) {
                    const lineNumber = this.getLineNumber(content, match.index);

                    violations.push({
                        id: uuidv4(),
                        principle: 'depth',
                        severity: 'minor',
                        title: 'Generic shadow',
                        description: `Using plain "${shadow}" - add color to shadows`,
                        file: filePath,
                        line: lineNumber,
                        recommendation: 'Use colored shadows like shadow-violet-500/20 or shadow-black/30',
                    });
                }
            }
        }

        return violations;
    }

    private checkMotion(filePath: string, content: string, lines: string[]): DesignViolation[] {
        const violations: DesignViolation[] = [];

        // Check for interactive elements without transitions
        const interactivePatterns = [
            { pattern: /className="[^"]*button[^"]*"/gi, name: 'button' },
            { pattern: /className="[^"]*card[^"]*"/gi, name: 'card' },
            { pattern: /className="[^"]*btn[^"]*"/gi, name: 'button' },
            { pattern: /onClick\s*=/gi, name: 'clickable element' },
            { pattern: /href\s*=/gi, name: 'link' },
        ];

        for (const { pattern, name } of interactivePatterns) {
            pattern.lastIndex = 0;
            let match;

            while ((match = pattern.exec(content)) !== null) {
                // Check surrounding context for transition/animation
                const contextStart = Math.max(0, match.index - 200);
                const contextEnd = Math.min(content.length, match.index + 200);
                const context = content.substring(contextStart, contextEnd);

                const hasMotion =
                    context.includes('transition') ||
                    context.includes('animate-') ||
                    context.includes('motion') ||
                    context.includes('Framer') ||
                    context.includes('duration-');

                if (!hasMotion) {
                    const lineNumber = this.getLineNumber(content, match.index);

                    violations.push({
                        id: uuidv4(),
                        principle: 'motion',
                        severity: 'suggestion',
                        title: `${name} without animation`,
                        description: `Interactive ${name} should have hover/active transitions`,
                        file: filePath,
                        line: lineNumber,
                        recommendation: 'Add transition-all duration-200 or use Framer Motion for complex animations',
                    });
                }
            }
        }

        return violations;
    }

    private checkColors(filePath: string, content: string, lines: string[]): DesignViolation[] {
        const violations: DesignViolation[] = [];

        // Check for overused gray palette
        const grayUsage = (content.match(/gray-\d+|slate-\d+/g) || []).length;
        const colorUsage = (content.match(/(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g) || []).length;

        if (grayUsage > colorUsage * 3 && grayUsage > 10) {
            violations.push({
                id: uuidv4(),
                principle: 'color',
                severity: 'major',
                title: 'Over-reliance on gray palette',
                description: `Found ${grayUsage} gray usages vs ${colorUsage} colorful ones - design lacks vibrancy`,
                file: filePath,
                recommendation: 'Introduce a cohesive accent color palette. Consider app soul and emotional impact.',
            });
        }

        return violations;
    }

    private checkSoulViolations(
        filePath: string,
        content: string,
        lines: string[],
        soul: AppSoul
    ): DesignViolation[] {
        const violations: DesignViolation[] = [];

        // Check for soul-specific banned patterns
        for (const banned of soul.bannedPatterns) {
            if (content.includes(banned)) {
                const regex = new RegExp(banned, 'g');
                let match;

                while ((match = regex.exec(content)) !== null) {
                    const lineNumber = this.getLineNumber(content, match.index);

                    violations.push({
                        id: uuidv4(),
                        principle: 'app_soul',
                        severity: 'major',
                        title: `Pattern banned for ${soul.name}`,
                        description: `"${banned}" violates the ${soul.name} design soul`,
                        file: filePath,
                        line: lineNumber,
                        recommendation: `For ${soul.name} apps, use: ${soul.componentPatterns.card.substring(0, 60)}...`,
                    });
                }
            }
        }

        return violations;
    }

    // ==========================================================================
    // AI ANALYSIS
    // ==========================================================================

    private async runAIAnalysis(
        files: Map<string, string>,
        soul?: AppSoul
    ): Promise<{ violations: DesignViolation[]; recommendations: string[] }> {
        const violations: DesignViolation[] = [];
        const recommendations: string[] = [];

        try {
            // Prepare code preview (limit to key UI files)
            const keyFiles = Array.from(files.entries())
                .filter(([path]) =>
                    path.includes('App.') ||
                    path.includes('page') ||
                    path.includes('layout') ||
                    path.includes('component')
                )
                .slice(0, 3);

            const codePreview = keyFiles
                .map(([path, content]) => `// ${path}\n${content.slice(0, 800)}`)
                .join('\n\n---\n\n');

            const soulContext = soul
                ? `TARGET SOUL: ${soul.name}\n${soul.description}\n`
                : '';

            const response = await this.claudeService.generate(
                `As an elite UI/UX designer enforcing the Anti-Slop Design Manifesto, analyze this code:

${soulContext}

ANTI-SLOP PRINCIPLES:
1. DEPTH: Layered, dimensional UI with blur, shadows, gradients
2. MOTION: Physics-based animations, meaningful transitions
3. EMOJI BAN: Zero tolerance for emojis (use custom icons)
4. TYPOGRAPHY: Unique, distinctive fonts (not system defaults)
5. COLOR: Cohesive, intentional palettes with personality
6. LAYOUT: Asymmetric, editorial layouts (not generic grids)
7. APP SOUL: Consistent design personality throughout

CODE:
${codePreview}

Provide analysis as JSON:
{
  "overallImpression": "brief overall design quality assessment",
  "violations": [
    {
      "principle": "depth|motion|emoji_ban|typography|color|layout|app_soul",
      "severity": "critical|major|minor|suggestion",
      "title": "Brief title",
      "description": "What's wrong",
      "recommendation": "How to fix"
    }
  ],
  "recommendations": ["Top 3 actionable improvements"]
}`,
                {
                    model: CLAUDE_MODELS.SONNET_4_5,
                    maxTokens: 1000,
                    useExtendedThinking: false,
                }
            );

            // Parse response
            const match = response.content.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);

                // Add AI violations
                for (const v of parsed.violations || []) {
                    violations.push({
                        id: uuidv4(),
                        principle: v.principle as DesignPrinciple,
                        severity: v.severity || 'suggestion',
                        title: v.title,
                        description: v.description,
                        file: 'AI Analysis',
                        recommendation: v.recommendation,
                    });
                }

                // Add recommendations
                recommendations.push(...(parsed.recommendations || []));
            }
        } catch (error) {
            console.error('[DesignStyleAgent] AI analysis failed:', error);
        }

        return { violations, recommendations };
    }

    // ==========================================================================
    // SCORING & REPORTING
    // ==========================================================================

    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }

    private calculateScores(
        violations: DesignViolation[],
        files: Map<string, string>
    ): DesignScores {
        // Start with perfect scores
        const scores: DesignScores = {
            overall: 100,
            depth: 100,
            motion: 100,
            typography: 100,
            color: 100,
            layout: 100,
            appSoul: 100,
        };

        // Deduction weights
        const weights = {
            critical: 15,
            major: 8,
            minor: 3,
            suggestion: 1,
        };

        // Apply deductions
        for (const v of violations) {
            const deduction = weights[v.severity];

            switch (v.principle) {
                case 'depth':
                    scores.depth -= deduction;
                    break;
                case 'motion':
                    scores.motion -= deduction;
                    break;
                case 'emoji_ban':
                case 'typography':
                    scores.typography -= deduction;
                    break;
                case 'color':
                    scores.color -= deduction;
                    break;
                case 'layout':
                    scores.layout -= deduction;
                    break;
                case 'app_soul':
                    scores.appSoul -= deduction;
                    break;
            }
        }

        // Clamp scores to 0-100
        scores.depth = Math.max(0, Math.min(100, scores.depth));
        scores.motion = Math.max(0, Math.min(100, scores.motion));
        scores.typography = Math.max(0, Math.min(100, scores.typography));
        scores.color = Math.max(0, Math.min(100, scores.color));
        scores.layout = Math.max(0, Math.min(100, scores.layout));
        scores.appSoul = Math.max(0, Math.min(100, scores.appSoul));

        // Calculate overall (weighted average)
        scores.overall = Math.round(
            (scores.depth * 0.15) +
            (scores.motion * 0.15) +
            (scores.typography * 0.2) +  // Typography weighted higher
            (scores.color * 0.15) +
            (scores.layout * 0.15) +
            (scores.appSoul * 0.2)       // Soul consistency weighted higher
        );

        return scores;
    }

    private generateSummary(scores: DesignScores, violations: DesignViolation[]): string {
        let status = 'Excellent';
        if (scores.overall < 90) status = 'Good';
        if (scores.overall < 80) status = 'Fair';
        if (scores.overall < 70) status = 'Needs Work';
        if (scores.overall < 50) status = 'Poor';

        const critical = violations.filter(v => v.severity === 'critical').length;
        const major = violations.filter(v => v.severity === 'major').length;

        // Find lowest scoring area
        const areas = [
            { name: 'Depth', score: scores.depth },
            { name: 'Motion', score: scores.motion },
            { name: 'Typography', score: scores.typography },
            { name: 'Color', score: scores.color },
            { name: 'Layout', score: scores.layout },
            { name: 'App Soul', score: scores.appSoul },
        ];

        const weakest = areas.sort((a, b) => a.score - b.score)[0];

        let summary = `Design Quality: ${status} (${scores.overall}/100). `;

        if (critical > 0) {
            summary += `${critical} critical violation(s) - emojis or major anti-patterns detected. `;
        }
        if (major > 0) {
            summary += `${major} major issue(s). `;
        }
        if (weakest.score < 70) {
            summary += `Focus area: ${weakest.name} (${weakest.score}/100).`;
        }

        return summary;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createDesignStyleAgent(
    projectId: string,
    userId: string,
    config?: Partial<DesignStyleConfig>
): DesignStyleAgent {
    return new DesignStyleAgent(projectId, userId, config);
}

export default DesignStyleAgent;

