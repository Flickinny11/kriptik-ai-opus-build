/**
 * Security Scanner Agent
 *
 * SAST (Static Application Security Testing) scanner.
 * NON-BLOCKING agent - provides security warnings without halting build.
 *
 * Checks:
 * - Exposed credentials (API keys, secrets)
 * - SQL injection vulnerabilities
 * - XSS vulnerabilities
 * - Insecure dependencies patterns
 * - Unsafe eval/innerHTML usage
 * - Hardcoded sensitive data
 *
 * Part of Phase 4: 6-Agent Verification Swarm
 */

import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type SecurityVulnerabilityType =
    | 'exposed_secret'
    | 'sql_injection'
    | 'xss'
    | 'insecure_dependency'
    | 'unsafe_eval'
    | 'unsafe_html'
    | 'hardcoded_credential'
    | 'insecure_crypto'
    | 'path_traversal'
    | 'open_redirect'
    | 'sensitive_data_exposure';

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityVulnerability {
    id: string;
    type: SecurityVulnerabilityType;
    severity: SecuritySeverity;
    title: string;
    description: string;
    file: string;
    line?: number;
    code?: string;
    remediation: string;
    cweId?: string;        // Common Weakness Enumeration ID
}

export interface SecurityScanResult {
    timestamp: Date;
    passed: boolean;
    vulnerabilityCount: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    vulnerabilities: SecurityVulnerability[];
    summary: string;
    riskScore: number;     // 0-100 (100 = high risk)
}

export interface SecurityScannerConfig {
    maxCriticalAllowed: number;
    maxHighAllowed: number;
    enableAIAnalysis: boolean;
    scanPatterns: boolean;
    scanDependencies: boolean;
    ignoredFiles: string[];
    allowedDomains: string[];
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: SecurityScannerConfig = {
    maxCriticalAllowed: 0,
    maxHighAllowed: 0,
    enableAIAnalysis: true,
    scanPatterns: true,
    scanDependencies: true,
    ignoredFiles: ['node_modules', '.git', 'dist', 'build', '*.test.ts', '*.spec.ts'],
    allowedDomains: ['localhost', '127.0.0.1'],
};

// ============================================================================
// SECURITY PATTERNS
// ============================================================================

const SECURITY_PATTERNS = {
    // Exposed secrets
    exposed_secret: {
        patterns: [
            // API Keys
            { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`]([a-zA-Z0-9_-]{20,})['"`]/gi, name: 'API Key' },
            { regex: /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"`]([a-zA-Z0-9_-]{20,})['"`]/gi, name: 'Secret Key' },
            // AWS
            { regex: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key' },
            { regex: /(?:aws[_-]?secret|aws_secret_access_key)\s*[:=]\s*['"`]([a-zA-Z0-9/+=]{40})['"`]/gi, name: 'AWS Secret' },
            // Firebase
            { regex: /AIza[0-9A-Za-z_-]{35}/g, name: 'Firebase API Key' },
            // Stripe
            { regex: /sk_live_[0-9a-zA-Z]{24}/g, name: 'Stripe Secret Key' },
            { regex: /pk_live_[0-9a-zA-Z]{24}/g, name: 'Stripe Publishable Key' },
            // GitHub
            { regex: /ghp_[0-9a-zA-Z]{36}/g, name: 'GitHub Personal Access Token' },
            { regex: /gho_[0-9a-zA-Z]{36}/g, name: 'GitHub OAuth Token' },
            // Private keys
            { regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, name: 'Private Key' },
            // JWT
            { regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, name: 'JWT Token' },
        ],
        severity: 'critical' as SecuritySeverity,
        cweId: 'CWE-798',
        remediation: 'Remove hardcoded credentials. Use environment variables or a secrets manager.',
    },
    
    // SQL Injection
    sql_injection: {
        patterns: [
            { regex: /(?:query|execute)\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/gi, name: 'Template literal in SQL' },
            { regex: /(?:query|execute)\s*\(\s*['"`].*\+\s*(?:req\.|params\.|query\.)/gi, name: 'Concatenated SQL' },
            { regex: /(?:query|execute)\s*\(\s*`[^`]*\$\{(?:req|params|query|body)\./gi, name: 'User input in SQL template' },
        ],
        severity: 'critical' as SecuritySeverity,
        cweId: 'CWE-89',
        remediation: 'Use parameterized queries or an ORM. Never concatenate user input into SQL strings.',
    },
    
    // XSS
    xss: {
        patterns: [
            { regex: /innerHTML\s*=\s*(?!['"`]<)/g, name: 'innerHTML assignment' },
            { regex: /dangerouslySetInnerHTML/g, name: 'dangerouslySetInnerHTML' },
            { regex: /document\.write\s*\(/g, name: 'document.write' },
            { regex: /\.html\s*\(\s*(?:req\.|params\.|query\.|body\.)/g, name: 'User input in HTML' },
        ],
        severity: 'high' as SecuritySeverity,
        cweId: 'CWE-79',
        remediation: 'Sanitize user input before rendering. Use textContent instead of innerHTML when possible.',
    },
    
    // Unsafe eval
    unsafe_eval: {
        patterns: [
            { regex: /\beval\s*\(/g, name: 'eval()' },
            { regex: /new\s+Function\s*\(/g, name: 'new Function()' },
            { regex: /setTimeout\s*\(\s*['"`]/g, name: 'setTimeout with string' },
            { regex: /setInterval\s*\(\s*['"`]/g, name: 'setInterval with string' },
        ],
        severity: 'high' as SecuritySeverity,
        cweId: 'CWE-95',
        remediation: 'Avoid eval() and dynamic code execution. Use safer alternatives.',
    },
    
    // Hardcoded credentials
    hardcoded_credential: {
        patterns: [
            { regex: /(?:password|passwd|pwd)\s*[:=]\s*['"`](?!<|process\.env|import\.meta)[^'"`]{4,}['"`]/gi, name: 'Hardcoded password' },
            { regex: /(?:username|user)\s*[:=]\s*['"`](?!process\.env)[a-zA-Z0-9_]{3,}['"`].*(?:password|pwd)/gi, name: 'Hardcoded credentials' },
        ],
        severity: 'high' as SecuritySeverity,
        cweId: 'CWE-798',
        remediation: 'Never hardcode credentials. Use environment variables or a secrets manager.',
    },
    
    // Insecure crypto
    insecure_crypto: {
        patterns: [
            { regex: /createHash\s*\(\s*['"`](?:md5|sha1)['"`]\s*\)/gi, name: 'Weak hash algorithm' },
            { regex: /createCipher\s*\(\s*['"`](?:des|rc4|blowfish)['"`]/gi, name: 'Weak cipher' },
            { regex: /Math\.random\s*\(\s*\).*(?:token|secret|key|password|session)/gi, name: 'Math.random for security' },
        ],
        severity: 'medium' as SecuritySeverity,
        cweId: 'CWE-327',
        remediation: 'Use strong cryptographic algorithms (SHA-256+, AES-256). Use crypto.randomBytes() for secure random values.',
    },
    
    // Path traversal
    path_traversal: {
        patterns: [
            { regex: /(?:readFile|writeFile|access|open)\s*\([^)]*(?:req\.|params\.|query\.)/gi, name: 'User input in file path' },
            { regex: /path\.join\s*\([^)]*(?:req\.|params\.|query\.)/gi, name: 'User input in path.join' },
        ],
        severity: 'high' as SecuritySeverity,
        cweId: 'CWE-22',
        remediation: 'Validate and sanitize file paths. Use path.resolve() and verify the result is within expected directories.',
    },
    
    // Open redirect
    open_redirect: {
        patterns: [
            { regex: /(?:redirect|location\.href)\s*=\s*(?:req\.|params\.|query\.)/gi, name: 'User input in redirect' },
            { regex: /res\.redirect\s*\([^)]*(?:req\.|params\.|query\.)/gi, name: 'User input in redirect' },
        ],
        severity: 'medium' as SecuritySeverity,
        cweId: 'CWE-601',
        remediation: 'Validate redirect URLs against an allowlist. Do not use user input directly in redirects.',
    },
    
    // Sensitive data exposure
    sensitive_data_exposure: {
        patterns: [
            { regex: /console\.log\s*\([^)]*(?:password|secret|token|key|credential)/gi, name: 'Logging sensitive data' },
            { regex: /JSON\.stringify\s*\([^)]*(?:password|secret|token|key)/gi, name: 'Serializing sensitive data' },
        ],
        severity: 'medium' as SecuritySeverity,
        cweId: 'CWE-200',
        remediation: 'Remove logging of sensitive data. Implement proper data masking.',
    },
};

// ============================================================================
// SECURITY SCANNER AGENT
// ============================================================================

export class SecurityScannerAgent extends EventEmitter {
    private projectId: string;
    private userId: string;
    private config: SecurityScannerConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private lastResult?: SecurityScanResult;

    constructor(
        projectId: string,
        userId: string,
        config?: Partial<SecurityScannerConfig>
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
    }

    /**
     * Run security scan on codebase
     */
    async scan(files: Map<string, string>): Promise<SecurityScanResult> {
        const startTime = Date.now();
        const vulnerabilities: SecurityVulnerability[] = [];
        
        console.log(`[SecurityScanner] Scanning ${files.size} files...`);
        
        // Filter out ignored files
        const filesToScan = new Map(
            Array.from(files.entries()).filter(([path]) => 
                !this.config.ignoredFiles.some(pattern => 
                    path.includes(pattern.replace('*', ''))
                )
            )
        );
        
        // Pattern-based scanning
        if (this.config.scanPatterns) {
            for (const [filePath, content] of filesToScan.entries()) {
                const fileVulns = this.scanFilePatterns(filePath, content);
                vulnerabilities.push(...fileVulns);
            }
        }
        
        // AI-powered deep analysis for critical files
        if (this.config.enableAIAnalysis) {
            const criticalFiles = Array.from(filesToScan.entries())
                .filter(([path]) => this.isCriticalFile(path))
                .slice(0, 5); // Limit to 5 files for AI analysis
            
            for (const [filePath, content] of criticalFiles) {
                const aiVulns = await this.aiSecurityAnalysis(filePath, content);
                vulnerabilities.push(...aiVulns);
            }
        }
        
        // Deduplicate vulnerabilities
        const uniqueVulns = this.deduplicateVulnerabilities(vulnerabilities);
        
        // Calculate counts
        const counts = {
            critical: uniqueVulns.filter(v => v.severity === 'critical').length,
            high: uniqueVulns.filter(v => v.severity === 'high').length,
            medium: uniqueVulns.filter(v => v.severity === 'medium').length,
            low: uniqueVulns.filter(v => v.severity === 'low').length,
        };
        
        // Calculate risk score
        const riskScore = this.calculateRiskScore(counts);
        
        // Determine pass/fail
        const passed = counts.critical <= this.config.maxCriticalAllowed &&
                      counts.high <= this.config.maxHighAllowed;
        
        const result: SecurityScanResult = {
            timestamp: new Date(),
            passed,
            vulnerabilityCount: counts,
            vulnerabilities: uniqueVulns,
            summary: this.generateSummary(counts, uniqueVulns),
            riskScore,
        };
        
        this.lastResult = result;
        this.emit('scan_complete', result);
        
        console.log(`[SecurityScanner] Scan complete: ${uniqueVulns.length} vulnerabilities, Risk Score: ${riskScore} (${Date.now() - startTime}ms)`);
        
        return result;
    }

    /**
     * Get last scan result
     */
    getLastResult(): SecurityScanResult | undefined {
        return this.lastResult;
    }

    // ==========================================================================
    // PATTERN SCANNING
    // ==========================================================================

    private scanFilePatterns(filePath: string, content: string): SecurityVulnerability[] {
        const vulnerabilities: SecurityVulnerability[] = [];
        const lines = content.split('\n');
        
        // Check each security pattern category
        for (const [vulnType, config] of Object.entries(SECURITY_PATTERNS)) {
            for (const patternConfig of config.patterns) {
                // Reset regex lastIndex
                patternConfig.regex.lastIndex = 0;
                
                let match;
                while ((match = patternConfig.regex.exec(content)) !== null) {
                    // Find line number
                    const matchIndex = match.index;
                    let lineNumber = 1;
                    let charCount = 0;
                    
                    for (let i = 0; i < lines.length; i++) {
                        charCount += lines[i].length + 1; // +1 for newline
                        if (charCount > matchIndex) {
                            lineNumber = i + 1;
                            break;
                        }
                    }
                    
                    // Skip false positives
                    if (this.isFalsePositive(filePath, match[0], vulnType)) {
                        continue;
                    }
                    
                    vulnerabilities.push({
                        id: uuidv4(),
                        type: vulnType as SecurityVulnerabilityType,
                        severity: config.severity,
                        title: patternConfig.name,
                        description: `Potential ${patternConfig.name} detected`,
                        file: filePath,
                        line: lineNumber,
                        code: this.sanitizeCodeSnippet(match[0]),
                        remediation: config.remediation,
                        cweId: config.cweId,
                    });
                }
            }
        }
        
        return vulnerabilities;
    }

    private isFalsePositive(filePath: string, match: string, vulnType: string): boolean {
        // Skip test files for most checks
        if (filePath.includes('.test.') || filePath.includes('.spec.')) {
            return vulnType !== 'exposed_secret';
        }
        
        // Skip example/placeholder values
        const placeholders = [
            'your-api-key',
            'YOUR_API_KEY',
            'xxx',
            'placeholder',
            'example',
            'test-key',
            'demo',
            'REPLACE_ME',
        ];
        
        if (placeholders.some(p => match.toLowerCase().includes(p))) {
            return true;
        }
        
        // Skip environment variable references
        if (match.includes('process.env') || match.includes('import.meta.env')) {
            return true;
        }
        
        return false;
    }

    private isCriticalFile(path: string): boolean {
        const criticalPatterns = [
            /auth/i,
            /login/i,
            /password/i,
            /payment/i,
            /checkout/i,
            /api.*route/i,
            /middleware/i,
            /config/i,
            /database/i,
            /credential/i,
        ];
        
        return criticalPatterns.some(p => p.test(path));
    }

    private sanitizeCodeSnippet(code: string): string {
        // Truncate long matches
        if (code.length > 100) {
            return code.substring(0, 50) + '...' + code.substring(code.length - 20);
        }
        return code;
    }

    // ==========================================================================
    // AI ANALYSIS
    // ==========================================================================

    private async aiSecurityAnalysis(
        filePath: string,
        content: string
    ): Promise<SecurityVulnerability[]> {
        try {
            // Truncate very long files
            const truncatedContent = content.length > 4000 
                ? content.substring(0, 4000) + '\n// ... truncated ...'
                : content;
            
            const response = await this.claudeService.generate(
                `As a security expert, analyze this code for vulnerabilities:

FILE: ${filePath}

CODE:
\`\`\`
${truncatedContent}
\`\`\`

Look for:
1. Injection vulnerabilities (SQL, XSS, command)
2. Authentication/authorization issues
3. Sensitive data exposure
4. Insecure cryptography
5. Security misconfigurations

Return a JSON array of vulnerabilities found:
[{
  "type": "sql_injection|xss|exposed_secret|...",
  "severity": "critical|high|medium|low",
  "title": "Brief title",
  "description": "Detailed description",
  "line": <line number if known>,
  "remediation": "How to fix"
}]

Return empty array [] if no issues found.`,
                {
                    model: CLAUDE_MODELS.SONNET_4_5,
                    maxTokens: 1000,
                    useExtendedThinking: false,
                }
            );
            
            // Parse response
            const match = response.content.match(/\[[\s\S]*\]/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return parsed.map((v: any) => ({
                    id: uuidv4(),
                    type: v.type || 'sensitive_data_exposure',
                    severity: v.severity || 'medium',
                    title: v.title,
                    description: v.description,
                    file: filePath,
                    line: v.line,
                    remediation: v.remediation || 'Review and fix the security issue',
                }));
            }
        } catch (error) {
            console.error('[SecurityScanner] AI analysis failed:', error);
        }
        
        return [];
    }

    // ==========================================================================
    // HELPERS
    // ==========================================================================

    private deduplicateVulnerabilities(vulnerabilities: SecurityVulnerability[]): SecurityVulnerability[] {
        const seen = new Set<string>();
        return vulnerabilities.filter(v => {
            const key = `${v.type}:${v.file}:${v.line}:${v.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private calculateRiskScore(counts: { critical: number; high: number; medium: number; low: number }): number {
        // Weighted risk score
        const score = 
            (counts.critical * 25) +
            (counts.high * 15) +
            (counts.medium * 5) +
            (counts.low * 1);
        
        // Cap at 100
        return Math.min(100, score);
    }

    private generateSummary(
        counts: { critical: number; high: number; medium: number; low: number },
        vulnerabilities: SecurityVulnerability[]
    ): string {
        const total = counts.critical + counts.high + counts.medium + counts.low;
        
        if (total === 0) {
            return 'Security scan passed. No vulnerabilities detected.';
        }
        
        const parts: string[] = [];
        if (counts.critical > 0) parts.push(`${counts.critical} critical`);
        if (counts.high > 0) parts.push(`${counts.high} high`);
        if (counts.medium > 0) parts.push(`${counts.medium} medium`);
        if (counts.low > 0) parts.push(`${counts.low} low`);
        
        // Most common vulnerability types
        const typeCounts = new Map<string, number>();
        for (const v of vulnerabilities) {
            typeCounts.set(v.type, (typeCounts.get(v.type) || 0) + 1);
        }
        
        const topTypes = Array.from(typeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type]) => type.replace(/_/g, ' '))
            .join(', ');
        
        return `Found ${total} security issue(s): ${parts.join(', ')}. ` +
               `Main concerns: ${topTypes || 'various issues'}`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createSecurityScannerAgent(
    projectId: string,
    userId: string,
    config?: Partial<SecurityScannerConfig>
): SecurityScannerAgent {
    return new SecurityScannerAgent(projectId, userId, config);
}

export default SecurityScannerAgent;

