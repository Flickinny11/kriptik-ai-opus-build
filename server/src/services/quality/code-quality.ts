/**
 * Code Quality Service
 *
 * Integrations for linting, formatting, and AI-powered code review.
 * Supports ESLint, Prettier, Biome, CodeRabbit, and more.
 */

import { v4 as uuidv4 } from 'uuid';
import { Anthropic } from '@anthropic-ai/sdk';

// ============================================================================
// TYPES
// ============================================================================

export interface LintResult {
    file: string;
    issues: LintIssue[];
    fixable: number;
    errorCount: number;
    warningCount: number;
}

export interface LintIssue {
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    ruleId: string;
    fix?: {
        range: [number, number];
        text: string;
    };
}

export interface FormatResult {
    file: string;
    original: string;
    formatted: string;
    changed: boolean;
}

export interface CodeReviewResult {
    id: string;
    summary: string;
    score: number;  // 0-100
    issues: CodeReviewIssue[];
    suggestions: CodeReviewSuggestion[];
    security: SecurityFinding[];
    performance: PerformanceFinding[];
}

export interface CodeReviewIssue {
    id: string;
    severity: 'critical' | 'major' | 'minor' | 'suggestion';
    type: 'bug' | 'style' | 'security' | 'performance' | 'maintainability';
    file: string;
    line?: number;
    message: string;
    suggestion?: string;
}

export interface CodeReviewSuggestion {
    id: string;
    file: string;
    line?: number;
    current: string;
    suggested: string;
    reason: string;
}

export interface SecurityFinding {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    file: string;
    line?: number;
    description: string;
    remediation: string;
}

export interface PerformanceFinding {
    id: string;
    impact: 'high' | 'medium' | 'low';
    type: string;
    file: string;
    description: string;
    suggestion: string;
}

export interface QualityConfig {
    eslint?: {
        enabled: boolean;
        config?: Record<string, unknown>;
    };
    prettier?: {
        enabled: boolean;
        config?: Record<string, unknown>;
    };
    biome?: {
        enabled: boolean;
        config?: Record<string, unknown>;
    };
    aiReview?: {
        enabled: boolean;
        provider: 'anthropic' | 'coderabbit';
    };
}

// ============================================================================
// CODE QUALITY SERVICE
// ============================================================================

export class CodeQualityService {
    private anthropicClient?: Anthropic;
    private codeRabbitToken?: string;

    constructor() {
        // Use the shared Anthropic client factory (supports OpenRouter)
        import('../../utils/anthropic-client.js').then(({ createAnthropicClient }) => {
            const client = createAnthropicClient();
            if (client) {
                this.anthropicClient = client;
            }
        });
        this.codeRabbitToken = process.env.CODERABBIT_API_KEY;
    }

    // ========================================================================
    // ESLINT
    // ========================================================================

    /**
     * Run ESLint on code
     */
    async runESLint(
        files: Record<string, string>,
        config?: Record<string, unknown>
    ): Promise<LintResult[]> {
        const results: LintResult[] = [];

        // Default ESLint config
        const eslintConfig = config || {
            env: { browser: true, es2022: true, node: true },
            extends: ['eslint:recommended'],
            parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
            rules: {
                'no-unused-vars': 'warn',
                'no-console': 'warn',
                'prefer-const': 'error',
                'no-var': 'error',
            },
        };

        for (const [file, content] of Object.entries(files)) {
            if (!this.isJavaScriptOrTypeScript(file)) continue;

            const issues = this.lintJavaScript(content, eslintConfig);

            results.push({
                file,
                issues,
                fixable: issues.filter(i => i.fix).length,
                errorCount: issues.filter(i => i.severity === 'error').length,
                warningCount: issues.filter(i => i.severity === 'warning').length,
            });
        }

        return results;
    }

    /**
     * Basic JavaScript linting (simplified - in production use actual ESLint)
     */
    private lintJavaScript(code: string, config: Record<string, unknown>): LintIssue[] {
        const issues: LintIssue[] = [];
        const lines = code.split('\n');

        lines.forEach((line, lineIndex) => {
            const lineNum = lineIndex + 1;

            // Check for console.log
            if (line.includes('console.log')) {
                issues.push({
                    line: lineNum,
                    column: line.indexOf('console.log') + 1,
                    severity: 'warning',
                    message: 'Unexpected console statement',
                    ruleId: 'no-console',
                });
            }

            // Check for var
            const varMatch = line.match(/\bvar\s+/);
            if (varMatch) {
                issues.push({
                    line: lineNum,
                    column: (varMatch.index || 0) + 1,
                    severity: 'error',
                    message: 'Unexpected var, use let or const instead',
                    ruleId: 'no-var',
                    fix: {
                        range: [varMatch.index || 0, (varMatch.index || 0) + 3],
                        text: 'let',
                    },
                });
            }

            // Check for == instead of ===
            const eqMatch = line.match(/[^=!]==[^=]/);
            if (eqMatch) {
                issues.push({
                    line: lineNum,
                    column: (eqMatch.index || 0) + 2,
                    severity: 'warning',
                    message: 'Expected === but saw ==',
                    ruleId: 'eqeqeq',
                });
            }

            // Check for debugger
            if (line.includes('debugger')) {
                issues.push({
                    line: lineNum,
                    column: line.indexOf('debugger') + 1,
                    severity: 'error',
                    message: 'Unexpected debugger statement',
                    ruleId: 'no-debugger',
                });
            }
        });

        return issues;
    }

    // ========================================================================
    // PRETTIER
    // ========================================================================

    /**
     * Format code with Prettier
     */
    async formatWithPrettier(
        files: Record<string, string>,
        config?: Record<string, unknown>
    ): Promise<FormatResult[]> {
        const results: FormatResult[] = [];

        // Default Prettier config
        const prettierConfig = config || {
            semi: true,
            singleQuote: true,
            tabWidth: 2,
            trailingComma: 'es5',
            printWidth: 100,
        };

        for (const [file, content] of Object.entries(files)) {
            const formatted = this.formatCode(content, file, prettierConfig);

            results.push({
                file,
                original: content,
                formatted,
                changed: content !== formatted,
            });
        }

        return results;
    }

    /**
     * Basic code formatting (simplified - in production use actual Prettier)
     */
    private formatCode(code: string, file: string, config: Record<string, unknown>): string {
        let formatted = code;

        // Normalize line endings
        formatted = formatted.replace(/\r\n/g, '\n');

        // Trim trailing whitespace
        formatted = formatted.split('\n').map(line => line.trimEnd()).join('\n');

        // Ensure single newline at end
        formatted = formatted.trimEnd() + '\n';

        // Basic indentation normalization (2 spaces)
        if (config.tabWidth === 2) {
            formatted = formatted.replace(/\t/g, '  ');
        }

        return formatted;
    }

    // ========================================================================
    // AI-POWERED CODE REVIEW
    // ========================================================================

    /**
     * Run AI-powered code review using Claude
     */
    async runAICodeReview(
        files: Record<string, string>,
        context?: string
    ): Promise<CodeReviewResult> {
        if (!this.anthropicClient) {
            return this.createEmptyReviewResult();
        }

        const filesContent = Object.entries(files)
            .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
            .join('\n\n');

        const prompt = `You are a senior code reviewer. Analyze the following code and provide a comprehensive review.

${context ? `Context: ${context}\n\n` : ''}

## Files to Review

${filesContent}

## Instructions

Provide your review in the following JSON format:
{
  "summary": "Brief overall assessment",
  "score": 0-100,
  "issues": [
    {
      "severity": "critical|major|minor|suggestion",
      "type": "bug|style|security|performance|maintainability",
      "file": "filename",
      "line": 123,
      "message": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "suggestions": [
    {
      "file": "filename",
      "line": 123,
      "current": "current code",
      "suggested": "improved code",
      "reason": "why this is better"
    }
  ],
  "security": [
    {
      "severity": "critical|high|medium|low",
      "type": "vulnerability type",
      "file": "filename",
      "description": "what's wrong",
      "remediation": "how to fix"
    }
  ],
  "performance": [
    {
      "impact": "high|medium|low",
      "type": "performance issue type",
      "file": "filename",
      "description": "what's slow",
      "suggestion": "how to improve"
    }
  ]
}`;

        try {
            const response = await this.anthropicClient.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            const text = content.type === 'text' ? content.text : '{}';

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return this.createEmptyReviewResult();
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                id: uuidv4(),
                summary: parsed.summary || 'Review completed',
                score: parsed.score || 70,
                issues: (parsed.issues || []).map((i: any) => ({
                    id: uuidv4(),
                    ...i,
                })),
                suggestions: (parsed.suggestions || []).map((s: any) => ({
                    id: uuidv4(),
                    ...s,
                })),
                security: (parsed.security || []).map((s: any) => ({
                    id: uuidv4(),
                    ...s,
                })),
                performance: (parsed.performance || []).map((p: any) => ({
                    id: uuidv4(),
                    ...p,
                })),
            };
        } catch (error) {
            console.error('Error running AI code review:', error);
            return this.createEmptyReviewResult();
        }
    }

    /**
     * Run CodeRabbit review (requires API key)
     *
     * CodeRabbit provides AI-powered code reviews with:
     * - Security vulnerability detection
     * - Code quality analysis
     * - Best practices enforcement
     * - Performance suggestions
     */
    async runCodeRabbitReview(
        files: Record<string, string>,
        options?: {
            pullRequestUrl?: string;
            repositoryContext?: string;
            language?: string;
        }
    ): Promise<CodeReviewResult> {
        if (!this.codeRabbitToken) {
            console.warn('CodeRabbit API key not configured - falling back to AI review');
            return this.runAICodeReview(files);
        }

        try {
            // CodeRabbit API endpoint for review
            const response = await fetch('https://api.coderabbit.ai/v1/review', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.codeRabbitToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: Object.entries(files).map(([path, content]) => ({
                        path,
                        content,
                    })),
                    context: options?.repositoryContext,
                    language: options?.language || 'typescript',
                    options: {
                        security: true,
                        performance: true,
                        style: true,
                        bugs: true,
                    },
                }),
            });

            if (!response.ok) {
                console.error('CodeRabbit API error:', response.status, await response.text());
                // Fall back to AI review on API error
                return this.runAICodeReview(files);
            }

            const data = await response.json();

            // Transform CodeRabbit response to our format
            return {
                id: uuidv4(),
                summary: data.summary || 'CodeRabbit review completed',
                score: data.score || this.calculateScoreFromFindings(data),
                issues: (data.issues || []).map((i: any) => ({
                    id: uuidv4(),
                    severity: this.mapCodeRabbitSeverity(i.severity),
                    type: i.category || 'maintainability',
                    file: i.file_path || i.file,
                    line: i.line_number || i.line,
                    message: i.message || i.description,
                    suggestion: i.fix_suggestion || i.suggestion,
                })),
                suggestions: (data.suggestions || data.improvements || []).map((s: any) => ({
                    id: uuidv4(),
                    file: s.file_path || s.file,
                    line: s.line_number || s.line,
                    current: s.current_code || s.current,
                    suggested: s.suggested_code || s.suggested,
                    reason: s.explanation || s.reason,
                })),
                security: (data.security_findings || data.security || []).map((s: any) => ({
                    id: uuidv4(),
                    severity: this.mapCodeRabbitSeverity(s.severity),
                    type: s.vulnerability_type || s.type,
                    file: s.file_path || s.file,
                    line: s.line_number,
                    description: s.description,
                    remediation: s.remediation || s.fix,
                })),
                performance: (data.performance_findings || data.performance || []).map((p: any) => ({
                    id: uuidv4(),
                    impact: this.mapCodeRabbitImpact(p.impact || p.severity),
                    type: p.issue_type || p.type,
                    file: p.file_path || p.file,
                    description: p.description,
                    suggestion: p.suggestion || p.fix,
                })),
            };
        } catch (error) {
            console.error('CodeRabbit review error:', error);
            // Fall back to AI review on error
            return this.runAICodeReview(files);
        }
    }

    /**
     * Map CodeRabbit severity to our format
     */
    private mapCodeRabbitSeverity(severity: string): 'critical' | 'major' | 'minor' | 'suggestion' {
        const severityMap: Record<string, 'critical' | 'major' | 'minor' | 'suggestion'> = {
            'critical': 'critical',
            'high': 'major',
            'medium': 'minor',
            'low': 'suggestion',
            'error': 'major',
            'warning': 'minor',
            'info': 'suggestion',
        };
        return severityMap[severity?.toLowerCase()] || 'minor';
    }

    /**
     * Map CodeRabbit impact to our format
     */
    private mapCodeRabbitImpact(impact: string): 'high' | 'medium' | 'low' {
        const impactMap: Record<string, 'high' | 'medium' | 'low'> = {
            'critical': 'high',
            'high': 'high',
            'medium': 'medium',
            'low': 'low',
            'minor': 'low',
        };
        return impactMap[impact?.toLowerCase()] || 'medium';
    }

    /**
     * Calculate score from findings when not provided
     */
    private calculateScoreFromFindings(data: any): number {
        let score = 100;

        // Deduct points for issues
        const issues = data.issues || [];
        const security = data.security_findings || data.security || [];
        const performance = data.performance_findings || data.performance || [];

        score -= issues.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length * 15;
        score -= issues.filter((i: any) => i.severity === 'medium').length * 5;
        score -= issues.filter((i: any) => i.severity === 'low' || i.severity === 'info').length * 2;

        score -= security.filter((s: any) => s.severity === 'critical').length * 20;
        score -= security.filter((s: any) => s.severity === 'high').length * 10;

        score -= performance.filter((p: any) => p.impact === 'high').length * 8;
        score -= performance.filter((p: any) => p.impact === 'medium').length * 4;

        return Math.max(0, Math.min(100, score));
    }

    // ========================================================================
    // SECURITY SCANNING
    // ========================================================================

    /**
     * Run basic security scan
     */
    async runSecurityScan(files: Record<string, string>): Promise<SecurityFinding[]> {
        const findings: SecurityFinding[] = [];

        for (const [file, content] of Object.entries(files)) {
            // Check for hardcoded secrets
            const secretPatterns = [
                { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/gi, type: 'Hardcoded API Key' },
                { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, type: 'Hardcoded Password' },
                { pattern: /secret\s*[:=]\s*['"][^'"]{10,}['"]/gi, type: 'Hardcoded Secret' },
                { pattern: /Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, type: 'Exposed JWT Token' },
                { pattern: /-----BEGIN (RSA |EC |)PRIVATE KEY-----/g, type: 'Exposed Private Key' },
            ];

            for (const { pattern, type } of secretPatterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    findings.push({
                        id: uuidv4(),
                        severity: 'critical',
                        type,
                        file,
                        line: lineNumber,
                        description: `Potential ${type.toLowerCase()} found`,
                        remediation: 'Move sensitive data to environment variables',
                    });
                }
            }

            // Check for SQL injection risks
            if (content.match(/\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/i) ||
                content.match(/['"`]\s*\+\s*\w+\s*\+\s*['"`].*(?:SELECT|INSERT|UPDATE|DELETE)/i)) {
                findings.push({
                    id: uuidv4(),
                    severity: 'high',
                    type: 'SQL Injection Risk',
                    file,
                    description: 'Potential SQL injection vulnerability detected',
                    remediation: 'Use parameterized queries or an ORM',
                });
            }

            // Check for XSS risks
            if (content.includes('dangerouslySetInnerHTML') ||
                content.includes('innerHTML') ||
                content.match(/document\.write\(/)) {
                findings.push({
                    id: uuidv4(),
                    severity: 'high',
                    type: 'XSS Risk',
                    file,
                    description: 'Potential cross-site scripting vulnerability',
                    remediation: 'Sanitize user input before rendering',
                });
            }
        }

        return findings;
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private isJavaScriptOrTypeScript(file: string): boolean {
        return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file);
    }

    private createEmptyReviewResult(): CodeReviewResult {
        return {
            id: uuidv4(),
            summary: 'Review could not be completed',
            score: 0,
            issues: [],
            suggestions: [],
            security: [],
            performance: [],
        };
    }

    // ========================================================================
    // COMPREHENSIVE QUALITY CHECK
    // ========================================================================

    /**
     * Run all quality checks on code
     */
    async runAllChecks(
        files: Record<string, string>,
        config?: QualityConfig
    ): Promise<{
        lint: LintResult[];
        format: FormatResult[];
        review: CodeReviewResult;
        security: SecurityFinding[];
    }> {
        const results = await Promise.all([
            config?.eslint?.enabled !== false
                ? this.runESLint(files, config?.eslint?.config)
                : Promise.resolve([]),
            config?.prettier?.enabled !== false
                ? this.formatWithPrettier(files, config?.prettier?.config)
                : Promise.resolve([]),
            config?.aiReview?.enabled !== false
                ? this.runAICodeReview(files)
                : Promise.resolve(this.createEmptyReviewResult()),
            this.runSecurityScan(files),
        ]);

        return {
            lint: results[0],
            format: results[1],
            review: results[2],
            security: results[3],
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: CodeQualityService | null = null;

export function getCodeQualityService(): CodeQualityService {
    if (!instance) {
        instance = new CodeQualityService();
    }
    return instance;
}

