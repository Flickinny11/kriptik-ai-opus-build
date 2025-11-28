/**
 * Quality Gate Service
 *
 * Enforces quality thresholds on generated code.
 * Triggers automatic refinement when quality scores are below threshold.
 */

import { getDesignValidator, ValidationResult } from './design-validator.js';
import { getDesignTokenPrompt } from './design-tokens.js';
import { getModelRouter } from './model-router.js';

// ============================================================================
// TYPES
// ============================================================================

export interface QualityThresholds {
    designScore: number;        // 0-100, minimum design quality
    accessibilityScore: number; // 0-100, WCAG compliance
    codeQualityScore: number;   // 0-100, best practices
}

export interface QualityGateResult {
    passed: boolean;
    scores: {
        design: number;
        accessibility: number;
        codeQuality: number;
        overall: number;
    };
    issues: QualityIssue[];
    refinementNeeded: boolean;
    refinementPrompt?: string;
}

export interface QualityIssue {
    category: 'design' | 'accessibility' | 'code';
    severity: 'critical' | 'warning' | 'info';
    message: string;
    suggestion: string;
    file?: string;
    line?: number;
}

export interface RefinementResult {
    success: boolean;
    originalScore: number;
    finalScore: number;
    iterations: number;
    refinedFiles: Record<string, string>;
}

// ============================================================================
// DEFAULT THRESHOLDS
// ============================================================================

const DEFAULT_THRESHOLDS: QualityThresholds = {
    designScore: 70,
    accessibilityScore: 80,
    codeQualityScore: 75,
};

// ============================================================================
// QUALITY ASSESSORS
// ============================================================================

/**
 * Assess accessibility of generated code
 */
function assessAccessibility(files: Record<string, string>): {
    score: number;
    issues: QualityIssue[];
} {
    const issues: QualityIssue[] = [];
    let score = 100;

    for (const [filePath, content] of Object.entries(files)) {
        if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) {
            continue;
        }

        // Check for missing alt attributes on images
        const imgWithoutAlt = content.match(/<img(?![^>]*alt=)[^>]*>/g);
        if (imgWithoutAlt) {
            issues.push({
                category: 'accessibility',
                severity: 'critical',
                message: `Image missing alt attribute in ${filePath}`,
                suggestion: 'Add descriptive alt text: alt="Description of image"',
                file: filePath,
            });
            score -= 15 * imgWithoutAlt.length;
        }

        // Check for missing aria-labels on buttons without text
        const buttonWithoutLabel = content.match(/<button(?![^>]*aria-label)[^>]*>\s*<(?:svg|img|Icon)/gi);
        if (buttonWithoutLabel) {
            issues.push({
                category: 'accessibility',
                severity: 'warning',
                message: `Button with icon missing aria-label in ${filePath}`,
                suggestion: 'Add aria-label="Action description" to icon buttons',
                file: filePath,
            });
            score -= 8 * buttonWithoutLabel.length;
        }

        // Check for missing form labels
        const inputWithoutLabel = content.match(/<input(?![^>]*aria-label|id=)[^>]*>/gi);
        if (inputWithoutLabel) {
            issues.push({
                category: 'accessibility',
                severity: 'warning',
                message: `Form input missing label association in ${filePath}`,
                suggestion: 'Add aria-label or associate with <label htmlFor="">',
                file: filePath,
            });
            score -= 8 * inputWithoutLabel.length;
        }

        // Check for proper heading hierarchy
        const headings = content.match(/<h[1-6][^>]*>/gi) || [];
        let lastLevel = 0;
        for (const heading of headings) {
            const level = parseInt(heading.match(/h([1-6])/i)?.[1] || '0');
            if (level > lastLevel + 1 && lastLevel !== 0) {
                issues.push({
                    category: 'accessibility',
                    severity: 'info',
                    message: `Heading hierarchy skip detected in ${filePath}`,
                    suggestion: 'Use sequential heading levels (h1 → h2 → h3)',
                    file: filePath,
                });
                score -= 3;
            }
            lastLevel = level;
        }

        // Check for keyboard accessibility on clickable divs
        const clickableDiv = content.match(/<div[^>]*onClick[^>]*(?![^>]*role=)[^>]*>/gi);
        if (clickableDiv) {
            issues.push({
                category: 'accessibility',
                severity: 'warning',
                message: `Clickable div without role in ${filePath}`,
                suggestion: 'Add role="button" tabIndex={0} onKeyDown handler',
                file: filePath,
            });
            score -= 8 * clickableDiv.length;
        }

        // Check for color contrast (basic check for text on backgrounds)
        const lowContrast = content.match(/text-(gray-[345]00|slate-[345]00).*bg-(white|gray-50)/gi);
        if (lowContrast) {
            issues.push({
                category: 'accessibility',
                severity: 'warning',
                message: `Potential low contrast text in ${filePath}`,
                suggestion: 'Use text-slate-700 or darker on light backgrounds',
                file: filePath,
            });
            score -= 5 * lowContrast.length;
        }
    }

    return { score: Math.max(0, score), issues };
}

/**
 * Assess code quality
 */
function assessCodeQuality(files: Record<string, string>): {
    score: number;
    issues: QualityIssue[];
} {
    const issues: QualityIssue[] = [];
    let score = 100;

    for (const [filePath, content] of Object.entries(files)) {
        if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') &&
            !filePath.endsWith('.js') && !filePath.endsWith('.jsx')) {
            continue;
        }

        // Check for console.log statements
        const consoleLogs = content.match(/console\.(log|warn|error|debug)\(/g);
        if (consoleLogs && consoleLogs.length > 2) {
            issues.push({
                category: 'code',
                severity: 'info',
                message: `Multiple console statements in ${filePath}`,
                suggestion: 'Remove or replace with proper logging',
                file: filePath,
            });
            score -= 3;
        }

        // Check for any type
        const anyType = content.match(/:\s*any\b/g);
        if (anyType) {
            issues.push({
                category: 'code',
                severity: 'warning',
                message: `Use of 'any' type in ${filePath}`,
                suggestion: 'Use proper TypeScript types',
                file: filePath,
            });
            score -= 5 * anyType.length;
        }

        // Check for missing error handling in async functions
        const asyncWithoutTry = content.match(/async\s+\w+\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{(?![^}]*try\s*\{)/g);
        if (asyncWithoutTry) {
            issues.push({
                category: 'code',
                severity: 'info',
                message: `Async function without error handling in ${filePath}`,
                suggestion: 'Add try-catch block for error handling',
                file: filePath,
            });
            score -= 3 * asyncWithoutTry.length;
        }

        // Check for very long functions (over 100 lines)
        const functions = content.split(/(?:function|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*\{)/);
        for (const func of functions) {
            const lines = func.split('\n').length;
            if (lines > 100) {
                issues.push({
                    category: 'code',
                    severity: 'warning',
                    message: `Very long function in ${filePath}`,
                    suggestion: 'Consider breaking into smaller functions',
                    file: filePath,
                });
                score -= 5;
            }
        }

        // Check for hardcoded strings that should be constants
        const hardcodedUrls = content.match(/['"]https?:\/\/[^'"]+['"]/g);
        if (hardcodedUrls && hardcodedUrls.length > 2) {
            issues.push({
                category: 'code',
                severity: 'info',
                message: `Multiple hardcoded URLs in ${filePath}`,
                suggestion: 'Move URLs to constants or environment variables',
                file: filePath,
            });
            score -= 2;
        }

        // Check for unused imports (basic check)
        const imports = content.match(/import\s+\{([^}]+)\}/g) || [];
        for (const importStmt of imports) {
            const importedItems = importStmt.match(/\{([^}]+)\}/)?.[1].split(',').map(s => s.trim()) || [];
            for (const item of importedItems) {
                const itemName = item.split(' as ').pop()?.trim() || item;
                if (itemName && !content.includes(itemName + '(') &&
                    !content.includes(itemName + ' ') &&
                    !content.includes('<' + itemName) &&
                    !content.includes(itemName + '>')) {
                    // Might be unused - don't deduct points, just warn
                }
            }
        }

        // Check for proper React hooks usage
        const hookOutsideComponent = content.match(/(?:^|\n)\s*(?:const|let)\s+\w+\s*=\s*use\w+\(/gm);
        const hasComponent = content.match(/(?:function|const)\s+[A-Z]\w*\s*[=(]/);
        if (hookOutsideComponent && hookOutsideComponent.length > 0 && !hasComponent) {
            issues.push({
                category: 'code',
                severity: 'critical',
                message: `React hook possibly used outside component in ${filePath}`,
                suggestion: 'Hooks must be called inside function components',
                file: filePath,
            });
            score -= 15;
        }
    }

    return { score: Math.max(0, score), issues };
}

// ============================================================================
// QUALITY GATE SERVICE
// ============================================================================

export class QualityGateService {
    private thresholds: QualityThresholds;
    private maxRefinementIterations: number = 2;

    constructor(thresholds?: Partial<QualityThresholds>) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }

    /**
     * Evaluate generated files against quality thresholds
     */
    evaluate(files: Record<string, string>): QualityGateResult {
        const validator = getDesignValidator();

        // Get design validation
        const designResult = validator.validate(files);
        const designScore = designResult.score;

        // Assess accessibility
        const accessibilityResult = assessAccessibility(files);
        const accessibilityScore = accessibilityResult.score;

        // Assess code quality
        const codeQualityResult = assessCodeQuality(files);
        const codeQualityScore = codeQualityResult.score;

        // Calculate overall score (weighted average)
        const overallScore = Math.round(
            designScore * 0.4 +
            accessibilityScore * 0.3 +
            codeQualityScore * 0.3
        );

        // Combine all issues
        const issues: QualityIssue[] = [
            ...designResult.issues.map(i => ({
                category: 'design' as const,
                severity: i.severity,
                message: i.message,
                suggestion: i.suggestion,
                file: i.file,
                line: i.line,
            })),
            ...accessibilityResult.issues,
            ...codeQualityResult.issues,
        ];

        // Determine if refinement is needed
        const refinementNeeded =
            designScore < this.thresholds.designScore ||
            accessibilityScore < this.thresholds.accessibilityScore ||
            codeQualityScore < this.thresholds.codeQualityScore;

        // Generate refinement prompt if needed
        let refinementPrompt: string | undefined;
        if (refinementNeeded) {
            refinementPrompt = this.generateRefinementPrompt(
                { design: designScore, accessibility: accessibilityScore, codeQuality: codeQualityScore },
                issues
            );
        }

        return {
            passed: !refinementNeeded,
            scores: {
                design: designScore,
                accessibility: accessibilityScore,
                codeQuality: codeQualityScore,
                overall: overallScore,
            },
            issues,
            refinementNeeded,
            refinementPrompt,
        };
    }

    /**
     * Automatically refine code until quality thresholds are met
     */
    async refine(
        files: Record<string, string>,
        originalPrompt: string
    ): Promise<RefinementResult> {
        let currentFiles = { ...files };
        let iteration = 0;
        const initialResult = this.evaluate(currentFiles);
        let currentScore = initialResult.scores.overall;

        while (iteration < this.maxRefinementIterations) {
            const result = this.evaluate(currentFiles);

            if (result.passed) {
                return {
                    success: true,
                    originalScore: initialResult.scores.overall,
                    finalScore: result.scores.overall,
                    iterations: iteration,
                    refinedFiles: currentFiles,
                };
            }

            // Generate refinement
            const refinedFiles = await this.performRefinement(
                currentFiles,
                result.refinementPrompt || '',
                originalPrompt
            );

            if (!refinedFiles) {
                break;
            }

            const newResult = this.evaluate(refinedFiles);

            // Only accept refinement if it improves score
            if (newResult.scores.overall > currentScore) {
                currentFiles = refinedFiles;
                currentScore = newResult.scores.overall;
            } else {
                // Refinement didn't help, stop trying
                break;
            }

            iteration++;
        }

        const finalResult = this.evaluate(currentFiles);
        return {
            success: finalResult.passed,
            originalScore: initialResult.scores.overall,
            finalScore: finalResult.scores.overall,
            iterations: iteration,
            refinedFiles: currentFiles,
        };
    }

    /**
     * Generate refinement prompt based on quality issues
     */
    private generateRefinementPrompt(
        scores: { design: number; accessibility: number; codeQuality: number },
        issues: QualityIssue[]
    ): string {
        let prompt = `## QUALITY IMPROVEMENT REQUIRED\n\n`;
        prompt += `Current scores:\n`;
        prompt += `- Design: ${scores.design}/100 (threshold: ${this.thresholds.designScore})\n`;
        prompt += `- Accessibility: ${scores.accessibility}/100 (threshold: ${this.thresholds.accessibilityScore})\n`;
        prompt += `- Code Quality: ${scores.codeQuality}/100 (threshold: ${this.thresholds.codeQualityScore})\n\n`;

        // Group issues by category
        const criticalIssues = issues.filter(i => i.severity === 'critical');
        const warningIssues = issues.filter(i => i.severity === 'warning');

        if (criticalIssues.length > 0) {
            prompt += `### CRITICAL ISSUES (Must Fix)\n`;
            for (const issue of criticalIssues) {
                prompt += `- [${issue.category.toUpperCase()}] ${issue.message}\n`;
                prompt += `  Fix: ${issue.suggestion}\n`;
            }
            prompt += '\n';
        }

        if (warningIssues.length > 0) {
            prompt += `### WARNINGS (Should Fix)\n`;
            for (const issue of warningIssues.slice(0, 10)) { // Limit to top 10
                prompt += `- [${issue.category.toUpperCase()}] ${issue.message}\n`;
                prompt += `  Fix: ${issue.suggestion}\n`;
            }
            prompt += '\n';
        }

        // Add design guidelines if design score is low
        if (scores.design < this.thresholds.designScore) {
            prompt += getDesignTokenPrompt();
        }

        return prompt;
    }

    /**
     * Perform refinement using AI
     */
    private async performRefinement(
        files: Record<string, string>,
        refinementPrompt: string,
        originalPrompt: string
    ): Promise<Record<string, string> | null> {
        try {
            const router = getModelRouter();

            // Only refine UI files
            const uiFiles = Object.entries(files)
                .filter(([path]) => path.endsWith('.tsx') || path.endsWith('.jsx'))
                .slice(0, 3); // Limit to 3 files at a time

            if (uiFiles.length === 0) {
                return null;
            }

            const fileContents = uiFiles
                .map(([path, content]) => `### ${path}\n\`\`\`tsx\n${content}\n\`\`\``)
                .join('\n\n');

            const prompt = `${refinementPrompt}\n\n## Original Request\n${originalPrompt}\n\n## Files to Refine\n${fileContents}\n\nPlease output the refined files in the same format.`;

            const response = await router.generate({
                prompt,
                taskType: 'refinement',
                forceTier: 'standard', // Use standard tier for refinement
                systemPrompt: `You are a code refinement specialist. Improve the code quality, design patterns, and accessibility of the provided components. Output only the refined code blocks.`,
            });

            // Parse refined files from response
            const refinedFiles = { ...files };
            const codeBlocks = response.content.match(/### ([^\n]+)\n```(?:tsx|jsx)?\n([\s\S]*?)```/g);

            if (codeBlocks) {
                for (const block of codeBlocks) {
                    const match = block.match(/### ([^\n]+)\n```(?:tsx|jsx)?\n([\s\S]*?)```/);
                    if (match) {
                        const filePath = match[1].trim();
                        const content = match[2].trim();
                        if (files[filePath]) {
                            refinedFiles[filePath] = content;
                        }
                    }
                }
            }

            return refinedFiles;
        } catch (error) {
            console.error('Refinement error:', error);
            return null;
        }
    }

    /**
     * Update thresholds
     */
    setThresholds(thresholds: Partial<QualityThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * Get current thresholds
     */
    getThresholds(): QualityThresholds {
        return { ...this.thresholds };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: QualityGateService | null = null;

export function getQualityGateService(thresholds?: Partial<QualityThresholds>): QualityGateService {
    if (!instance) {
        instance = new QualityGateService(thresholds);
    }
    return instance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_THRESHOLDS };
export default QualityGateService;

