/**
 * Code Quality Service
 * 
 * Integrations for linting, formatting, and AI-powered code review.
 * Supports ESLint, Prettier, Biome, CodeRabbit, and more.
 */

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

// Type for the Anthropic client instance
type AnthropicClient = InstanceType<typeof Anthropic>;

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
    private anthropicClient?: AnthropicClient;
    private codeRabbitToken?: string;
    
    constructor() {
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
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
     */
    async runCodeRabbitReview(
        files: Record<string, string>,
        pullRequestUrl?: string
    ): Promise<CodeReviewResult> {
        if (!this.codeRabbitToken) {
            console.warn('CodeRabbit API key not configured');
            return this.createEmptyReviewResult();
        }
        
        // CodeRabbit integration would go here
        // For now, fall back to AI review
        return this.runAICodeReview(files);
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

