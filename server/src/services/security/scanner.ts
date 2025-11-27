/**
 * Security Scanner Service
 *
 * Pre-deployment security analysis:
 * - SAST (Static Application Security Testing)
 * - Dependency vulnerability scanning
 * - Secret detection
 * - Code quality and security patterns
 *
 * This ensures code is production-ready before deployment.
 */

import { getModelRouter } from '../ai/model-router.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type VulnerabilityCategory =
    | 'injection'
    | 'authentication'
    | 'xss'
    | 'sensitive-data'
    | 'secrets'
    | 'dependencies'
    | 'misconfiguration'
    | 'cryptography'
    | 'access-control';

export interface SecurityVulnerability {
    id: string;
    title: string;
    description: string;
    category: VulnerabilityCategory;
    severity: SeverityLevel;
    file: string;
    line?: number;
    code?: string;
    cwe?: string; // Common Weakness Enumeration
    owasp?: string; // OWASP Top 10 reference
    remediation: string;
    autoFixable: boolean;
    fix?: string;
}

export interface DependencyVulnerability {
    package: string;
    version: string;
    vulnerability: string;
    severity: SeverityLevel;
    fixedIn?: string;
    cve?: string;
}

export interface SecurityScanResult {
    id: string;
    timestamp: Date;
    projectId: string;
    overallScore: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    vulnerabilities: SecurityVulnerability[];
    dependencyVulnerabilities: DependencyVulnerability[];
    secretsFound: Array<{
        type: string;
        file: string;
        line: number;
        masked: string;
    }>;
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
        totalIssues: number;
        autoFixable: number;
    };
    recommendations: string[];
    passesDeploymentGate: boolean;
}

// ============================================================================
// SECURITY PATTERNS
// ============================================================================

const SECURITY_PATTERNS = {
    // SQL Injection
    sqlInjection: {
        pattern: /(?:execute|query|raw)\s*\(\s*[`'"]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER).*\$\{/gi,
        category: 'injection' as VulnerabilityCategory,
        severity: 'critical' as SeverityLevel,
        title: 'Potential SQL Injection',
        cwe: 'CWE-89',
        owasp: 'A03:2021 – Injection',
        remediation: 'Use parameterized queries or an ORM instead of string interpolation.',
    },

    // XSS
    dangerousHtml: {
        pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/gi,
        category: 'xss' as VulnerabilityCategory,
        severity: 'high' as SeverityLevel,
        title: 'Potential XSS via dangerouslySetInnerHTML',
        cwe: 'CWE-79',
        owasp: 'A07:2021 – Cross-Site Scripting',
        remediation: 'Sanitize HTML content using DOMPurify before rendering.',
    },

    // Hardcoded secrets
    hardcodedApiKey: {
        pattern: /(?:api[_-]?key|apikey|secret|password|token|auth)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi,
        category: 'secrets' as VulnerabilityCategory,
        severity: 'critical' as SeverityLevel,
        title: 'Hardcoded API Key or Secret',
        cwe: 'CWE-798',
        owasp: 'A07:2021 – Identification and Authentication Failures',
        remediation: 'Move secrets to environment variables. Never commit secrets to code.',
    },

    // AWS credentials
    awsCredentials: {
        pattern: /(?:AKIA[0-9A-Z]{16}|aws[_-]?(?:access[_-]?key|secret)[_-]?(?:id|key)?\s*[:=]\s*['"][A-Za-z0-9\/+=]{20,}['"])/gi,
        category: 'secrets' as VulnerabilityCategory,
        severity: 'critical' as SeverityLevel,
        title: 'AWS Credentials Exposed',
        cwe: 'CWE-798',
        remediation: 'Remove AWS credentials immediately and rotate them. Use IAM roles or environment variables.',
    },

    // Weak cryptography
    weakCrypto: {
        pattern: /(?:createHash|createCipher)\s*\(\s*['"](?:md5|sha1|des|rc4)['"]/gi,
        category: 'cryptography' as VulnerabilityCategory,
        severity: 'high' as SeverityLevel,
        title: 'Weak Cryptographic Algorithm',
        cwe: 'CWE-327',
        remediation: 'Use SHA-256 or higher for hashing, AES-256 for encryption.',
    },

    // Eval usage
    evalUsage: {
        pattern: /\beval\s*\(/gi,
        category: 'injection' as VulnerabilityCategory,
        severity: 'high' as SeverityLevel,
        title: 'Dangerous eval() Usage',
        cwe: 'CWE-95',
        remediation: 'Avoid eval(). Use JSON.parse() for JSON or safer alternatives.',
    },

    // Missing authentication
    noAuthCheck: {
        pattern: /app\.(get|post|put|delete|patch)\s*\(\s*['"][^'"]+['"]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{(?:(?!auth|session|token|user|verify|protect).)*\}/gi,
        category: 'authentication' as VulnerabilityCategory,
        severity: 'medium' as SeverityLevel,
        title: 'API Endpoint Without Visible Authentication',
        cwe: 'CWE-306',
        owasp: 'A01:2021 – Broken Access Control',
        remediation: 'Add authentication middleware to protect sensitive endpoints.',
    },

    // Insecure HTTP
    insecureHttp: {
        pattern: /['"]http:\/\/(?!localhost|127\.0\.0\.1)/gi,
        category: 'misconfiguration' as VulnerabilityCategory,
        severity: 'medium' as SeverityLevel,
        title: 'Insecure HTTP URL',
        cwe: 'CWE-319',
        remediation: 'Use HTTPS for all external URLs.',
    },

    // CORS wildcard
    corsWildcard: {
        pattern: /cors\s*\(\s*\{[^}]*origin\s*:\s*['"]?\*['"]?/gi,
        category: 'misconfiguration' as VulnerabilityCategory,
        severity: 'medium' as SeverityLevel,
        title: 'CORS Wildcard Configuration',
        cwe: 'CWE-942',
        remediation: 'Specify allowed origins instead of using wildcard.',
    },

    // Debug mode in production
    debugMode: {
        pattern: /(?:debug|DEBUG)\s*[:=]\s*(?:true|1|['"]true['"])/gi,
        category: 'misconfiguration' as VulnerabilityCategory,
        severity: 'medium' as SeverityLevel,
        title: 'Debug Mode Enabled',
        remediation: 'Disable debug mode in production environments.',
    },

    // Path traversal
    pathTraversal: {
        pattern: /(?:readFile|writeFile|unlink|rmdir|mkdir)\s*\([^)]*(?:req\.|params\.|query\.)/gi,
        category: 'injection' as VulnerabilityCategory,
        severity: 'high' as SeverityLevel,
        title: 'Potential Path Traversal',
        cwe: 'CWE-22',
        remediation: 'Validate and sanitize file paths. Use path.resolve() and check against allowed directories.',
    },

    // Command injection
    commandInjection: {
        pattern: /(?:exec|spawn|execSync)\s*\([^)]*(?:\+|`|\$\{)/gi,
        category: 'injection' as VulnerabilityCategory,
        severity: 'critical' as SeverityLevel,
        title: 'Potential Command Injection',
        cwe: 'CWE-78',
        remediation: 'Avoid shell commands with user input. Use spawn() with arguments array.',
    },

    // Sensitive data logging
    sensitiveLogging: {
        pattern: /console\.(?:log|info|debug|warn|error)\s*\([^)]*(?:password|secret|token|apiKey|creditCard)/gi,
        category: 'sensitive-data' as VulnerabilityCategory,
        severity: 'medium' as SeverityLevel,
        title: 'Sensitive Data in Logs',
        cwe: 'CWE-532',
        remediation: 'Remove or mask sensitive data before logging.',
    },
};

// ============================================================================
// SECRET PATTERNS
// ============================================================================

const SECRET_PATTERNS = [
    { type: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
    { type: 'AWS Secret Key', pattern: /[A-Za-z0-9\/+=]{40}/g },
    { type: 'GitHub Token', pattern: /ghp_[A-Za-z0-9]{36}/g },
    { type: 'GitHub OAuth', pattern: /gho_[A-Za-z0-9]{36}/g },
    { type: 'Slack Token', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
    { type: 'Stripe API Key', pattern: /sk_(?:live|test)_[A-Za-z0-9]{24,}/g },
    { type: 'Stripe Publishable', pattern: /pk_(?:live|test)_[A-Za-z0-9]{24,}/g },
    { type: 'OpenAI API Key', pattern: /sk-[A-Za-z0-9]{48}/g },
    { type: 'Anthropic API Key', pattern: /sk-ant-[A-Za-z0-9-]{80,}/g },
    { type: 'Google API Key', pattern: /AIza[A-Za-z0-9_-]{35}/g },
    { type: 'Private Key', pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
    { type: 'JWT', pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g },
    { type: 'Generic API Key', pattern: /api[_-]?key['"]\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/gi },
];

// ============================================================================
// SCANNER SERVICE
// ============================================================================

export class SecurityScannerService {
    /**
     * Scan project files for security vulnerabilities
     */
    async scan(
        projectId: string,
        files: Record<string, string>,
        options?: {
            includeDependencies?: boolean;
            aiEnhanced?: boolean;
        }
    ): Promise<SecurityScanResult> {
        const vulnerabilities: SecurityVulnerability[] = [];
        const secretsFound: SecurityScanResult['secretsFound'] = [];
        const dependencyVulnerabilities: DependencyVulnerability[] = [];

        // 1. Pattern-based scanning
        for (const [filePath, content] of Object.entries(files)) {
            // Skip non-code files
            if (!this.isCodeFile(filePath)) continue;

            const lines = content.split('\n');

            // Check each security pattern
            for (const [patternName, config] of Object.entries(SECURITY_PATTERNS)) {
                const matches = content.matchAll(new RegExp(config.pattern));
                for (const match of matches) {
                    const lineIndex = content.substring(0, match.index).split('\n').length - 1;

                    vulnerabilities.push({
                        id: uuidv4(),
                        title: config.title,
                        description: `Found ${patternName} pattern in ${filePath}`,
                        category: config.category,
                        severity: config.severity,
                        file: filePath,
                        line: lineIndex + 1,
                        code: lines[lineIndex]?.trim(),
                        cwe: 'cwe' in config ? config.cwe : undefined,
                        owasp: 'owasp' in config ? config.owasp : undefined,
                        remediation: config.remediation,
                        autoFixable: false,
                    });
                }
            }

            // Check for secrets
            for (const secretPattern of SECRET_PATTERNS) {
                const matches = content.matchAll(secretPattern.pattern);
                for (const match of matches) {
                    const lineIndex = content.substring(0, match.index).split('\n').length - 1;
                    const value = match[0];

                    // Mask the secret
                    const masked = value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);

                    secretsFound.push({
                        type: secretPattern.type,
                        file: filePath,
                        line: lineIndex + 1,
                        masked,
                    });

                    vulnerabilities.push({
                        id: uuidv4(),
                        title: `${secretPattern.type} Detected`,
                        description: `Found a ${secretPattern.type} in ${filePath}`,
                        category: 'secrets',
                        severity: 'critical',
                        file: filePath,
                        line: lineIndex + 1,
                        code: masked,
                        cwe: 'CWE-798',
                        remediation: 'Remove this secret and use environment variables instead.',
                        autoFixable: false,
                    });
                }
            }
        }

        // 2. Dependency scanning (if package.json exists)
        if (options?.includeDependencies && files['package.json']) {
            const depVulns = await this.scanDependencies(files['package.json']);
            dependencyVulnerabilities.push(...depVulns);
        }

        // 3. AI-enhanced scanning for complex patterns
        if (options?.aiEnhanced) {
            const aiVulns = await this.aiEnhancedScan(files);
            vulnerabilities.push(...aiVulns);
        }

        // Calculate summary
        const summary = {
            critical: vulnerabilities.filter(v => v.severity === 'critical').length,
            high: vulnerabilities.filter(v => v.severity === 'high').length,
            medium: vulnerabilities.filter(v => v.severity === 'medium').length,
            low: vulnerabilities.filter(v => v.severity === 'low').length,
            info: vulnerabilities.filter(v => v.severity === 'info').length,
            totalIssues: vulnerabilities.length + dependencyVulnerabilities.length,
            autoFixable: vulnerabilities.filter(v => v.autoFixable).length,
        };

        // Calculate score
        const score = this.calculateScore(summary, dependencyVulnerabilities);
        const grade = this.calculateGrade(score);

        // Generate recommendations
        const recommendations = this.generateRecommendations(vulnerabilities, dependencyVulnerabilities);

        // Determine if deployment should proceed
        const passesDeploymentGate = summary.critical === 0 && summary.high === 0;

        return {
            id: uuidv4(),
            timestamp: new Date(),
            projectId,
            overallScore: score,
            grade,
            vulnerabilities,
            dependencyVulnerabilities,
            secretsFound,
            summary,
            recommendations,
            passesDeploymentGate,
        };
    }

    /**
     * Check if file is a code file
     */
    private isCodeFile(path: string): boolean {
        const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb'];
        return codeExtensions.some(ext => path.endsWith(ext));
    }

    /**
     * Scan dependencies for known vulnerabilities
     */
    private async scanDependencies(packageJson: string): Promise<DependencyVulnerability[]> {
        const vulnerabilities: DependencyVulnerability[] = [];

        try {
            const pkg = JSON.parse(packageJson);
            const allDeps = {
                ...pkg.dependencies,
                ...pkg.devDependencies,
            };

            // Known vulnerable packages (this would ideally use npm audit or Snyk API)
            const knownVulnerabilities: Record<string, { severity: SeverityLevel; description: string; fixedIn?: string }> = {
                'lodash': { severity: 'high', description: 'Prototype pollution in versions < 4.17.21', fixedIn: '4.17.21' },
                'axios': { severity: 'medium', description: 'SSRF vulnerability in versions < 0.21.1', fixedIn: '0.21.1' },
                'express': { severity: 'medium', description: 'Open redirect in versions < 4.18.2', fixedIn: '4.18.2' },
                'jsonwebtoken': { severity: 'high', description: 'Algorithm confusion in versions < 9.0.0', fixedIn: '9.0.0' },
            };

            for (const [pkg, version] of Object.entries(allDeps)) {
                const vuln = knownVulnerabilities[pkg];
                if (vuln) {
                    vulnerabilities.push({
                        package: pkg,
                        version: version as string,
                        vulnerability: vuln.description,
                        severity: vuln.severity,
                        fixedIn: vuln.fixedIn,
                    });
                }
            }
        } catch {
            // Invalid package.json
        }

        return vulnerabilities;
    }

    /**
     * AI-enhanced security scanning for complex patterns
     */
    private async aiEnhancedScan(files: Record<string, string>): Promise<SecurityVulnerability[]> {
        const router = getModelRouter();
        const vulnerabilities: SecurityVulnerability[] = [];

        // Combine files for analysis (limit size)
        const relevantFiles = Object.entries(files)
            .filter(([path]) => this.isCodeFile(path))
            .slice(0, 10); // Limit to 10 files

        const codeContext = relevantFiles
            .map(([path, content]) => `// File: ${path}\n${content.substring(0, 2000)}`)
            .join('\n\n');

        try {
            const response = await router.generate({
                prompt: `Analyze this code for security vulnerabilities not caught by pattern matching:

${codeContext}

Look for:
1. Logic flaws in authentication/authorization
2. Race conditions
3. Insecure deserialization
4. Business logic vulnerabilities
5. IDOR (Insecure Direct Object References)
6. Missing rate limiting
7. Insufficient input validation

Respond with JSON array of vulnerabilities found:
[
  {
    "title": "string",
    "description": "string",
    "category": "string",
    "severity": "critical|high|medium|low",
    "file": "string",
    "remediation": "string"
  }
]

Only return real vulnerabilities, not potential issues.`,
                taskType: 'analysis',
                forceTier: 'standard',
                systemPrompt: `You are a security expert specializing in application security testing.
Only report real vulnerabilities with high confidence. Avoid false positives.`,
            });

            // Parse AI response
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const aiVulns = JSON.parse(jsonMatch[0]);
                for (const vuln of aiVulns) {
                    vulnerabilities.push({
                        id: uuidv4(),
                        title: vuln.title,
                        description: vuln.description,
                        category: vuln.category as VulnerabilityCategory,
                        severity: vuln.severity as SeverityLevel,
                        file: vuln.file,
                        remediation: vuln.remediation,
                        autoFixable: false,
                    });
                }
            }
        } catch (error) {
            console.error('AI security scan failed:', error);
        }

        return vulnerabilities;
    }

    /**
     * Calculate security score (0-100)
     */
    private calculateScore(
        summary: SecurityScanResult['summary'],
        depVulns: DependencyVulnerability[]
    ): number {
        let score = 100;

        // Deduct points for vulnerabilities
        score -= summary.critical * 25;
        score -= summary.high * 15;
        score -= summary.medium * 5;
        score -= summary.low * 2;
        score -= summary.info * 0.5;

        // Deduct for dependency vulnerabilities
        score -= depVulns.filter(v => v.severity === 'critical').length * 20;
        score -= depVulns.filter(v => v.severity === 'high').length * 10;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Calculate grade from score
     */
    private calculateGrade(score: number): SecurityScanResult['grade'] {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    /**
     * Generate recommendations
     */
    private generateRecommendations(
        vulnerabilities: SecurityVulnerability[],
        depVulns: DependencyVulnerability[]
    ): string[] {
        const recommendations: string[] = [];

        // Check for secrets
        if (vulnerabilities.some(v => v.category === 'secrets')) {
            recommendations.push('🔑 Move all secrets to environment variables and use a secrets manager');
        }

        // Check for injection vulnerabilities
        if (vulnerabilities.some(v => v.category === 'injection')) {
            recommendations.push('💉 Review all database queries and shell commands for injection risks');
        }

        // Check for auth issues
        if (vulnerabilities.some(v => v.category === 'authentication')) {
            recommendations.push('🔐 Implement authentication middleware on all protected routes');
        }

        // Check for XSS
        if (vulnerabilities.some(v => v.category === 'xss')) {
            recommendations.push('🛡️ Sanitize all user input before rendering HTML');
        }

        // Dependency updates
        if (depVulns.length > 0) {
            recommendations.push(`📦 Update ${depVulns.length} vulnerable dependencies`);
        }

        // General recommendations
        if (vulnerabilities.some(v => v.category === 'misconfiguration')) {
            recommendations.push('⚙️ Review security configurations before deployment');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ No critical security issues found');
        }

        return recommendations;
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: SecurityScannerService | null = null;

export function getSecurityScannerService(): SecurityScannerService {
    if (!instance) {
        instance = new SecurityScannerService();
    }
    return instance;
}

