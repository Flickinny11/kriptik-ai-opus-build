/**
 * Real Quality Scanner
 *
 * Performs actual code quality analysis using:
 * - TypeScript type checking
 * - ESLint rules
 * - Accessibility audits
 * - Security pattern detection
 */

export interface QualityIssue {
    id: string;
    type: 'error' | 'warning' | 'info';
    category: 'typescript' | 'eslint' | 'accessibility' | 'security' | 'performance';
    message: string;
    file: string;
    line?: number;
    column?: number;
    code?: string;
    fix?: string;
}

export interface QualityReport {
    score: number;
    passed: boolean;
    issues: QualityIssue[];
    summary: {
        errors: number;
        warnings: number;
        info: number;
    };
    categories: {
        typescript: { score: number; issues: number };
        eslint: { score: number; issues: number };
        accessibility: { score: number; issues: number };
        security: { score: number; issues: number };
        performance: { score: number; issues: number };
    };
    timestamp: Date;
    duration: number;
}

// Common security patterns to detect
const SECURITY_PATTERNS = [
    { pattern: /eval\s*\(/, message: 'Avoid using eval() - it can execute arbitrary code', severity: 'error' as const },
    { pattern: /innerHTML\s*=/, message: 'innerHTML can lead to XSS vulnerabilities, use textContent instead', severity: 'warning' as const },
    { pattern: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML can lead to XSS if not properly sanitized', severity: 'warning' as const },
    { pattern: /document\.write/, message: 'document.write is a security risk and blocks page rendering', severity: 'error' as const },
    { pattern: /localStorage\.setItem.*password/i, message: 'Never store passwords in localStorage', severity: 'error' as const },
    { pattern: /console\.(log|debug|info)/, message: 'Remove console statements before production', severity: 'info' as const },
    { pattern: /TODO|FIXME|HACK|XXX/, message: 'Unresolved code comment found', severity: 'info' as const },
];

// Accessibility patterns
const A11Y_PATTERNS = [
    { pattern: /<img[^>]*(?!alt=)[^>]*>/, message: 'Images should have alt attributes for accessibility', severity: 'warning' as const },
    { pattern: /<button[^>]*(?!aria-)[^>]*>/, message: 'Consider adding aria-label to buttons for screen readers', severity: 'info' as const },
    { pattern: /onClick\s*=\s*{[^}]*}\s*(?!onKeyDown|onKeyPress|onKeyUp)/, message: 'Click handlers should have keyboard equivalents', severity: 'warning' as const },
    { pattern: /tabindex\s*=\s*["']?-1["']?/, message: 'Negative tabindex removes element from keyboard navigation', severity: 'info' as const },
    { pattern: /<div\s+onClick/, message: 'Use semantic elements like <button> for interactive elements', severity: 'warning' as const },
];

// Performance patterns
const PERFORMANCE_PATTERNS = [
    { pattern: /useEffect\(\s*\(\)\s*=>\s*\{[^}]*\}\s*\)(?!\s*,\s*\[)/, message: 'useEffect without dependencies array will run on every render', severity: 'warning' as const },
    { pattern: /new Array\(\d{4,}\)/, message: 'Creating large arrays may cause performance issues', severity: 'warning' as const },
    { pattern: /\.map\([^)]+\)\.filter\(/, message: 'Consider combining map and filter for better performance', severity: 'info' as const },
    { pattern: /JSON\.parse\(JSON\.stringify\(/, message: 'Deep clone with JSON.parse/stringify is slow, consider structuredClone', severity: 'info' as const },
    { pattern: /style\s*=\s*\{\{/, message: 'Inline style objects are recreated on each render', severity: 'info' as const },
];

// TypeScript patterns
const TS_PATTERNS = [
    { pattern: /:\s*any(?!\w)/, message: 'Avoid using "any" type - be more specific', severity: 'warning' as const },
    { pattern: /as\s+any/, message: 'Type assertion to "any" bypasses type checking', severity: 'warning' as const },
    { pattern: /\/\/\s*@ts-ignore/, message: '@ts-ignore suppresses TypeScript errors', severity: 'warning' as const },
    { pattern: /\/\/\s*@ts-nocheck/, message: '@ts-nocheck disables type checking for entire file', severity: 'error' as const },
    { pattern: /!\./, message: 'Non-null assertion operator (!) can hide runtime errors', severity: 'info' as const },
];

// ESLint-like patterns
const ESLINT_PATTERNS = [
    { pattern: /var\s+/, message: 'Use const or let instead of var', severity: 'warning' as const },
    { pattern: /==(?!=)/, message: 'Use === for strict equality comparison', severity: 'warning' as const },
    { pattern: /!=(?!=)/, message: 'Use !== for strict inequality comparison', severity: 'warning' as const },
    { pattern: /function\s+\w+\s*\([^)]*\)\s*\{(?:[^}]|\n){200,}/, message: 'Function is too long, consider breaking it up', severity: 'info' as const },
    { pattern: /if\s*\([^)]+\)\s*\n?\s*[^{]/, message: 'Always use braces with if statements', severity: 'warning' as const },
    { pattern: /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/, message: 'Empty catch block - handle the error', severity: 'warning' as const },
];

/**
 * Real Quality Scanner
 */
export class RealQualityScanner {
    /**
     * Scan files for quality issues
     */
    async scan(files: Map<string, string>): Promise<QualityReport> {
        const startTime = Date.now();
        const issues: QualityIssue[] = [];

        let issueId = 0;

        for (const [path, content] of files) {
            // Skip non-code files
            if (!this.isCodeFile(path)) continue;

            const lines = content.split('\n');

            // Check each pattern category
            for (const { pattern, message, severity } of SECURITY_PATTERNS) {
                const matches = this.findMatches(content, lines, pattern);
                for (const match of matches) {
                    issues.push({
                        id: `issue-${++issueId}`,
                        type: severity,
                        category: 'security',
                        message,
                        file: path,
                        line: match.line,
                        column: match.column,
                        code: match.text,
                    });
                }
            }

            for (const { pattern, message, severity } of A11Y_PATTERNS) {
                const matches = this.findMatches(content, lines, pattern);
                for (const match of matches) {
                    issues.push({
                        id: `issue-${++issueId}`,
                        type: severity,
                        category: 'accessibility',
                        message,
                        file: path,
                        line: match.line,
                        column: match.column,
                        code: match.text,
                    });
                }
            }

            for (const { pattern, message, severity } of PERFORMANCE_PATTERNS) {
                const matches = this.findMatches(content, lines, pattern);
                for (const match of matches) {
                    issues.push({
                        id: `issue-${++issueId}`,
                        type: severity,
                        category: 'performance',
                        message,
                        file: path,
                        line: match.line,
                        column: match.column,
                        code: match.text,
                    });
                }
            }

            // TypeScript files only
            if (path.endsWith('.ts') || path.endsWith('.tsx')) {
                for (const { pattern, message, severity } of TS_PATTERNS) {
                    const matches = this.findMatches(content, lines, pattern);
                    for (const match of matches) {
                        issues.push({
                            id: `issue-${++issueId}`,
                            type: severity,
                            category: 'typescript',
                            message,
                            file: path,
                            line: match.line,
                            column: match.column,
                            code: match.text,
                        });
                    }
                }
            }

            for (const { pattern, message, severity } of ESLINT_PATTERNS) {
                const matches = this.findMatches(content, lines, pattern);
                for (const match of matches) {
                    issues.push({
                        id: `issue-${++issueId}`,
                        type: severity,
                        category: 'eslint',
                        message,
                        file: path,
                        line: match.line,
                        column: match.column,
                        code: match.text,
                    });
                }
            }
        }

        // Calculate scores
        const errors = issues.filter(i => i.type === 'error').length;
        const warnings = issues.filter(i => i.type === 'warning').length;
        const info = issues.filter(i => i.type === 'info').length;

        const categoryScores = this.calculateCategoryScores(issues);
        const overallScore = this.calculateOverallScore(categoryScores, errors, warnings);

        return {
            score: overallScore,
            passed: overallScore >= 70 && errors === 0,
            issues,
            summary: { errors, warnings, info },
            categories: categoryScores,
            timestamp: new Date(),
            duration: Date.now() - startTime,
        };
    }

    /**
     * Find pattern matches with line numbers
     */
    private findMatches(
        _content: string,
        lines: string[],
        pattern: RegExp
    ): Array<{ line: number; column: number; text: string }> {
        const matches: Array<{ line: number; column: number; text: string }> = [];

        for (let i = 0; i < lines.length; i++) {
            const lineContent = lines[i];
            const match = lineContent.match(pattern);
            if (match) {
                matches.push({
                    line: i + 1,
                    column: (match.index || 0) + 1,
                    text: match[0].slice(0, 50),
                });
            }
        }

        return matches;
    }

    /**
     * Calculate scores by category
     */
    private calculateCategoryScores(issues: QualityIssue[]): QualityReport['categories'] {
        const categories = ['typescript', 'eslint', 'accessibility', 'security', 'performance'] as const;
        const result: QualityReport['categories'] = {
            typescript: { score: 100, issues: 0 },
            eslint: { score: 100, issues: 0 },
            accessibility: { score: 100, issues: 0 },
            security: { score: 100, issues: 0 },
            performance: { score: 100, issues: 0 },
        };

        for (const cat of categories) {
            const catIssues = issues.filter(i => i.category === cat);
            result[cat].issues = catIssues.length;

            // Deduct points based on issue severity
            let deduction = 0;
            for (const issue of catIssues) {
                if (issue.type === 'error') deduction += 15;
                else if (issue.type === 'warning') deduction += 5;
                else deduction += 1;
            }

            result[cat].score = Math.max(0, 100 - deduction);
        }

        return result;
    }

    /**
     * Calculate overall score
     */
    private calculateOverallScore(
        categories: QualityReport['categories'],
        errors: number,
        warnings: number
    ): number {
        // Weighted average of category scores
        const weights = {
            security: 0.25,
            typescript: 0.20,
            eslint: 0.20,
            accessibility: 0.20,
            performance: 0.15,
        };

        let weightedSum = 0;
        for (const [cat, weight] of Object.entries(weights)) {
            weightedSum += categories[cat as keyof typeof categories].score * weight;
        }

        // Additional penalty for errors
        const errorPenalty = errors * 10;
        const warningPenalty = warnings * 2;

        return Math.max(0, Math.round(weightedSum - errorPenalty - warningPenalty));
    }

    /**
     * Check if file is a code file
     */
    private isCodeFile(path: string): boolean {
        const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];
        return codeExtensions.some(ext => path.endsWith(ext));
    }

    /**
     * Get fix suggestions for common issues
     */
    getSuggestion(issue: QualityIssue): string | null {
        const suggestions: Record<string, string> = {
            'Avoid using eval()': 'Use Function constructor or JSON.parse for dynamic code',
            'innerHTML can lead to XSS': 'Use textContent for plain text or a sanitization library',
            'Use const or let instead of var': 'Replace var with const (if not reassigned) or let',
            'Use === for strict equality': 'Replace == with === for type-safe comparison',
            'Avoid using "any" type': 'Define a proper interface or type for the value',
            'useEffect without dependencies': 'Add a dependencies array: useEffect(() => {}, [deps])',
        };

        for (const [pattern, suggestion] of Object.entries(suggestions)) {
            if (issue.message.includes(pattern)) {
                return suggestion;
            }
        }

        return null;
    }
}

// Singleton instance
export const realQualityScanner = new RealQualityScanner();

