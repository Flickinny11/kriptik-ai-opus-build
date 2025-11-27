/**
 * Design Validator Service
 *
 * Detects "AI slop" patterns in generated code and ensures
 * high-quality UI output. Part of the design quality gate.
 */

export interface SlopPattern {
    pattern: RegExp;
    name: string;
    severity: 'critical' | 'warning' | 'info';
    suggestion: string;
}

export interface ValidationResult {
    passed: boolean;
    score: number; // 0-100
    issues: ValidationIssue[];
    summary: string;
}

export interface ValidationIssue {
    file: string;
    line?: number;
    pattern: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    suggestion: string;
}

/**
 * Patterns that indicate low-quality "AI slop" UIs
 * These are banned and should trigger refinement
 */
const SLOP_PATTERNS: SlopPattern[] = [
    // Plain white/gray backgrounds
    {
        pattern: /bg-white(?![\/\-])/g,
        name: 'plain-white-bg',
        severity: 'critical',
        suggestion: 'Use bg-slate-900/50 or bg-[#0a0a0f] instead of plain white',
    },
    {
        pattern: /bg-gray-100/g,
        name: 'generic-gray-100',
        severity: 'critical',
        suggestion: 'Use bg-slate-800/50 or a dark surface color',
    },
    {
        pattern: /bg-gray-50/g,
        name: 'generic-gray-50',
        severity: 'critical',
        suggestion: 'Use a dark atmospheric background instead',
    },

    // Generic text colors
    {
        pattern: /text-gray-700/g,
        name: 'generic-text-gray',
        severity: 'warning',
        suggestion: 'Use text-slate-300 or text-white for better contrast',
    },
    {
        pattern: /text-gray-500/g,
        name: 'generic-text-gray-500',
        severity: 'warning',
        suggestion: 'Use text-slate-400 for secondary text',
    },

    // Default blue (the most common AI slop indicator)
    {
        pattern: /bg-blue-500(?![\/\-])/g,
        name: 'default-blue-bg',
        severity: 'warning',
        suggestion: 'Use branded gradient: bg-gradient-to-r from-amber-500 to-orange-500',
    },
    {
        pattern: /text-blue-500/g,
        name: 'default-blue-text',
        severity: 'info',
        suggestion: 'Use text-amber-400 or a custom brand color',
    },

    // Flat cards without depth
    {
        pattern: /className="[^"]*rounded[^"]*"(?![^>]*shadow)/g,
        name: 'flat-card',
        severity: 'info',
        suggestion: 'Add shadow-lg or shadow-xl for depth',
    },

    // Generic borders
    {
        pattern: /border-gray-200/g,
        name: 'generic-border',
        severity: 'info',
        suggestion: 'Use border-white/10 or border-slate-700 for subtle borders',
    },
    {
        pattern: /border-gray-300/g,
        name: 'generic-border-300',
        severity: 'info',
        suggestion: 'Use border-slate-600 or border-white/20',
    },

    // Small border radius (looks dated)
    {
        pattern: /rounded(?!-[2xl]|full)/g,
        name: 'small-border-radius',
        severity: 'info',
        suggestion: 'Use rounded-xl or rounded-2xl for modern look',
    },

    // Plain shadows
    {
        pattern: /shadow(?!-[xlg2]|amber|slate|-lg|-xl|-2xl)/g,
        name: 'small-shadow',
        severity: 'info',
        suggestion: 'Use shadow-lg or shadow-xl with color: shadow-amber-500/20',
    },
];

/**
 * Patterns that indicate good design quality
 */
const QUALITY_PATTERNS: RegExp[] = [
    // Glassmorphism
    /backdrop-blur/,
    /bg-[^"]*\/[0-9]+/, // Transparency in bg colors

    // Proper gradients
    /bg-gradient/,
    /from-.*to-/,

    // Good shadows
    /shadow-(lg|xl|2xl)/,
    /shadow-[a-z]+-[0-9]+\//, // Colored shadows

    // Animations/transitions
    /transition/,
    /duration-/,
    /hover:/,
    /animate-/,

    // Modern spacing
    /space-(x|y)-[468]/,
    /gap-[468]/,

    // Typography hierarchy
    /text-(2xl|3xl|4xl|5xl)/,
    /font-(semibold|bold)/,

    // Dark mode patterns
    /dark:/,
    /slate-[89]00/,
    /#0a0a/,
];

/**
 * Design Validator Class
 */
export class DesignValidator {
    /**
     * Validate generated code for design quality
     */
    validate(files: Record<string, string>): ValidationResult {
        const issues: ValidationIssue[] = [];
        let qualityScore = 50; // Start at baseline

        // Only check UI-related files
        const uiFiles = Object.entries(files).filter(([path]) =>
            path.endsWith('.tsx') || path.endsWith('.jsx') ||
            (path.endsWith('.css') && !path.includes('tailwind'))
        );

        for (const [filePath, content] of uiFiles) {
            // Check for slop patterns
            for (const slopPattern of SLOP_PATTERNS) {
                const matches = content.matchAll(slopPattern.pattern);
                for (const match of matches) {
                    const lineNumber = this.getLineNumber(content, match.index || 0);
                    issues.push({
                        file: filePath,
                        line: lineNumber,
                        pattern: slopPattern.name,
                        severity: slopPattern.severity,
                        message: `Found low-quality pattern: ${slopPattern.name}`,
                        suggestion: slopPattern.suggestion,
                    });

                    // Deduct points based on severity
                    if (slopPattern.severity === 'critical') {
                        qualityScore -= 15;
                    } else if (slopPattern.severity === 'warning') {
                        qualityScore -= 8;
                    } else {
                        qualityScore -= 3;
                    }
                }
            }

            // Add points for quality patterns
            for (const qualityPattern of QUALITY_PATTERNS) {
                if (qualityPattern.test(content)) {
                    qualityScore += 5;
                }
            }
        }

        // Clamp score
        qualityScore = Math.max(0, Math.min(100, qualityScore));

        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;

        return {
            passed: criticalCount === 0 && qualityScore >= 60,
            score: qualityScore,
            issues,
            summary: this.generateSummary(qualityScore, criticalCount, warningCount),
        };
    }

    /**
     * Get line number from string index
     */
    private getLineNumber(content: string, index: number): number {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }

    /**
     * Generate a human-readable summary
     */
    private generateSummary(score: number, critical: number, warnings: number): string {
        if (score >= 90) {
            return 'Excellent design quality! The UI follows modern best practices.';
        } else if (score >= 75) {
            return `Good design quality with minor improvements possible. ${warnings} warning(s) found.`;
        } else if (score >= 60) {
            return `Acceptable design quality but could be improved. ${critical} critical issue(s), ${warnings} warning(s).`;
        } else {
            return `Design quality needs improvement. Found ${critical} critical pattern(s) that should be fixed. Consider using glassmorphism, gradients, and proper dark theme colors.`;
        }
    }

    /**
     * Generate refinement prompt for fixing slop patterns
     */
    generateRefinementPrompt(result: ValidationResult): string {
        if (result.passed) {
            return '';
        }

        const criticalIssues = result.issues.filter(i => i.severity === 'critical');
        const warningIssues = result.issues.filter(i => i.severity === 'warning');

        let prompt = `## Design Quality Refinement Required\n\n`;
        prompt += `The generated UI has a quality score of ${result.score}/100. `;
        prompt += `Please fix the following issues:\n\n`;

        if (criticalIssues.length > 0) {
            prompt += `### Critical Issues (Must Fix)\n`;
            for (const issue of criticalIssues) {
                prompt += `- **${issue.file}:${issue.line}** - ${issue.message}\n`;
                prompt += `  Fix: ${issue.suggestion}\n`;
            }
            prompt += '\n';
        }

        if (warningIssues.length > 0) {
            prompt += `### Warnings (Recommended Fixes)\n`;
            for (const issue of warningIssues) {
                prompt += `- **${issue.file}:${issue.line}** - ${issue.message}\n`;
                prompt += `  Fix: ${issue.suggestion}\n`;
            }
            prompt += '\n';
        }

        prompt += `### Design Guidelines\n`;
        prompt += `- Use dark backgrounds: bg-[#0a0a0f], bg-slate-900\n`;
        prompt += `- Use glassmorphism: backdrop-blur-xl bg-slate-800/50\n`;
        prompt += `- Use gradients: bg-gradient-to-r from-amber-500 to-orange-500\n`;
        prompt += `- Use colored shadows: shadow-lg shadow-amber-500/20\n`;
        prompt += `- Use modern border radius: rounded-xl, rounded-2xl\n`;
        prompt += `- Add transitions: transition-all duration-200\n`;
        prompt += `- Add hover states: hover:scale-[1.02] hover:shadow-xl\n`;

        return prompt;
    }
}

// Singleton instance
let validatorInstance: DesignValidator | null = null;

export function getDesignValidator(): DesignValidator {
    if (!validatorInstance) {
        validatorInstance = new DesignValidator();
    }
    return validatorInstance;
}

