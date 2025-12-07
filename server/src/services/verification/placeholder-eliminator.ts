/**
 * Placeholder Eliminator Agent
 *
 * Zero-tolerance placeholder detection and elimination.
 * BLOCKING agent - halts build on ANY placeholder content.
 *
 * Detects:
 * - TODO comments
 * - Lorem ipsum text
 * - Placeholder images
 * - Sample/example/dummy data
 * - Unfinished UI elements
 * - Stub functions
 * - Coming soon/TBD/TBA content
 *
 * Part of Phase 4: 6-Agent Verification Swarm
 */

import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type PlaceholderType =
    | 'todo_comment'
    | 'lorem_ipsum'
    | 'placeholder_image'
    | 'dummy_data'
    | 'stub_function'
    | 'coming_soon'
    | 'template_text'
    | 'unfinished_ui'
    | 'debug_code'
    | 'mock_data';

export interface PlaceholderViolation {
    id: string;
    type: PlaceholderType;
    description: string;
    file: string;
    line?: number;
    code?: string;
    suggestion?: string;
}

export interface PlaceholderScanResult {
    timestamp: Date;
    passed: boolean;
    blocking: boolean;
    violations: PlaceholderViolation[];
    summary: string;
    stats: {
        filesScanned: number;
        violationsFound: number;
        byType: Record<PlaceholderType, number>;
    };
}

export interface PlaceholderEliminatorConfig {
    zeroTolerance: boolean;        // Block on ANY placeholder
    maxViolationsAllowed: number;
    enableAISuggestions: boolean;
    ignoredFiles: string[];
    customPatterns: { pattern: RegExp; type: PlaceholderType; description: string }[];
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: PlaceholderEliminatorConfig = {
    zeroTolerance: true,
    maxViolationsAllowed: 0,
    enableAISuggestions: true,
    ignoredFiles: ['node_modules', '.git', 'dist', 'build', '*.md', 'README*'],
    customPatterns: [],
};

// ============================================================================
// PLACEHOLDER PATTERNS
// ============================================================================

const PLACEHOLDER_PATTERNS: {
    type: PlaceholderType;
    patterns: { regex: RegExp; description: string }[];
}[] = [
    {
        type: 'todo_comment',
        patterns: [
            { regex: /\/\/\s*TODO:?\s*/gi, description: 'TODO comment' },
            { regex: /\/\/\s*FIXME:?\s*/gi, description: 'FIXME comment' },
            { regex: /\/\/\s*HACK:?\s*/gi, description: 'HACK comment' },
            { regex: /\/\/\s*XXX:?\s*/gi, description: 'XXX marker' },
            { regex: /\/\/\s*BUG:?\s*/gi, description: 'BUG comment' },
            { regex: /\/\*\s*TODO[\s\S]*?\*\//gi, description: 'TODO block comment' },
            { regex: /\{\/\*\s*TODO[\s\S]*?\*\/\}/gi, description: 'JSX TODO comment' },
        ],
    },
    {
        type: 'lorem_ipsum',
        patterns: [
            { regex: /lorem\s+ipsum/gi, description: 'Lorem ipsum text' },
            { regex: /dolor\s+sit\s+amet/gi, description: 'Lorem ipsum variant' },
            { regex: /consectetur\s+adipiscing/gi, description: 'Lorem ipsum variant' },
            { regex: /tempor\s+incididunt/gi, description: 'Lorem ipsum variant' },
        ],
    },
    {
        type: 'placeholder_image',
        patterns: [
            { regex: /placeholder\.com/gi, description: 'Placeholder.com image' },
            { regex: /via\.placeholder/gi, description: 'Via placeholder image' },
            { regex: /placekitten\.com/gi, description: 'Placekitten image' },
            { regex: /placehold\.it/gi, description: 'Placehold.it image' },
            { regex: /dummyimage\.com/gi, description: 'Dummy image service' },
            { regex: /picsum\.photos/gi, description: 'Picsum photos (placeholder)' },
            { regex: /loremflickr\.com/gi, description: 'Lorem Flickr placeholder' },
            { regex: /\/placeholder\.(png|jpg|svg|gif)/gi, description: 'Local placeholder image' },
        ],
    },
    {
        type: 'dummy_data',
        patterns: [
            { regex: /['"`](?:test|dummy|sample|example|fake|mock)[-_]?(?:data|user|name|email)/gi, description: 'Dummy data variable' },
            { regex: /test@(?:test|example)\.com/gi, description: 'Test email' },
            { regex: /John\s*Doe|Jane\s*Doe/gi, description: 'Placeholder name' },
            { regex: /123[-.\s]?456[-.\s]?7890/g, description: 'Placeholder phone number' },
            { regex: /1234[-\s]?5678[-\s]?9012[-\s]?3456/g, description: 'Placeholder card number' },
            { regex: /user@example\.com/gi, description: 'Example email' },
            { regex: /['"`]foo['"`]|['"`]bar['"`]|['"`]baz['"`]/gi, description: 'Metasyntactic variable' },
        ],
    },
    {
        type: 'stub_function',
        patterns: [
            { regex: /\bthrow\s+new\s+Error\s*\(\s*['"`]Not\s+implemented/gi, description: 'Not implemented error' },
            { regex: /\breturn\s+['"`]stub['"`]/gi, description: 'Stub return' },
            { regex: /\bpass\s*#\s*(?:TODO|implement)/gi, description: 'Python pass placeholder' },
            { regex: /function\s+\w+\s*\([^)]*\)\s*{\s*}/g, description: 'Empty function body' },
            { regex: /=>\s*{\s*}\s*[;,]/g, description: 'Empty arrow function' },
            { regex: /\/\/\s*implement\s+(?:me|this|later)/gi, description: 'Implement later comment' },
        ],
    },
    {
        type: 'coming_soon',
        patterns: [
            { regex: /['"`]Coming\s+Soon['"`]/gi, description: 'Coming soon text' },
            { regex: /['"`]TBD['"`]|['"`]TBA['"`]/gi, description: 'TBD/TBA text' },
            { regex: /['"`]Under\s+Construction['"`]/gi, description: 'Under construction' },
            { regex: /['"`]Work\s+in\s+Progress['"`]/gi, description: 'Work in progress' },
            { regex: /['"`]Stay\s+Tuned['"`]/gi, description: 'Stay tuned placeholder' },
            { regex: /['"`]Check\s+Back\s+(?:Soon|Later)['"`]/gi, description: 'Check back later' },
        ],
    },
    {
        type: 'template_text',
        patterns: [
            { regex: /\[Your\s+\w+\s+Here\]/gi, description: 'Template bracket text' },
            { regex: /<Your\s+\w+\s+Here>/gi, description: 'Template angle text' },
            { regex: /\{\{.*?\}\}/g, description: 'Mustache template unfilled' },
            { regex: /%\w+%/g, description: 'Percent template token' },
            { regex: /REPLACE_(?:THIS|ME|WITH)/gi, description: 'Replace marker' },
            { regex: /INSERT_(?:HERE|YOUR)/gi, description: 'Insert marker' },
        ],
    },
    {
        type: 'unfinished_ui',
        patterns: [
            { regex: />\s*\.\.\.\s*</g, description: 'Ellipsis placeholder in JSX' },
            { regex: />\s*___+\s*</g, description: 'Underscore placeholder in JSX' },
            { regex: />\s*\?\?\?\s*</g, description: 'Question marks in JSX' },
            { regex: /['"`]\s*---\s*['"`]/g, description: 'Dash placeholder' },
            { regex: /children\s*:\s*null|children:\s*undefined/gi, description: 'Null children' },
            { regex: /\bbackground:\s*['"`]#?(?:ff0000|00ff00|0000ff|magenta|lime)['"`]/gi, description: 'Debug background color' },
        ],
    },
    {
        type: 'debug_code',
        patterns: [
            { regex: /debugger\s*;/g, description: 'Debugger statement' },
            { regex: /console\.(?:log|debug|info|warn|table)\s*\(/g, description: 'Console statement' },
            { regex: /alert\s*\(\s*['"`]/g, description: 'Alert dialog' },
            { regex: /DEBUG\s*[=:]\s*true/gi, description: 'Debug flag enabled' },
        ],
    },
    {
        type: 'mock_data',
        patterns: [
            { regex: /const\s+mock\w+\s*=/gi, description: 'Mock constant' },
            { regex: /faker\.\w+/gi, description: 'Faker.js usage' },
            { regex: /\bchance\.\w+/gi, description: 'Chance.js usage' },
            { regex: /\brandom(?:User|Name|Email|Data)/gi, description: 'Random data generator' },
        ],
    },
];

// ============================================================================
// PLACEHOLDER ELIMINATOR AGENT
// ============================================================================

export class PlaceholderEliminatorAgent extends EventEmitter {
    private projectId: string;
    private userId: string;
    private config: PlaceholderEliminatorConfig;
    private claudeService: ReturnType<typeof createClaudeService>;
    private lastResult?: PlaceholderScanResult;

    constructor(
        projectId: string,
        userId: string,
        config?: Partial<PlaceholderEliminatorConfig>
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
     * Scan for placeholder content
     */
    async scan(files: Map<string, string>): Promise<PlaceholderScanResult> {
        const startTime = Date.now();
        const violations: PlaceholderViolation[] = [];

        console.log(`[PlaceholderEliminator] Scanning ${files.size} files...`);

        // Filter out ignored files
        const filesToScan = new Map(
            Array.from(files.entries()).filter(([path]) =>
                !this.config.ignoredFiles.some(pattern => {
                    if (pattern.includes('*')) {
                        const regex = new RegExp(pattern.replace('*', '.*'));
                        return regex.test(path);
                    }
                    return path.includes(pattern);
                })
            )
        );

        // Scan each file
        for (const [filePath, content] of filesToScan.entries()) {
            const fileViolations = this.scanFile(filePath, content);
            violations.push(...fileViolations);
        }

        // Add custom pattern violations
        for (const customPattern of this.config.customPatterns) {
            for (const [filePath, content] of filesToScan.entries()) {
                const customViolations = this.scanCustomPattern(filePath, content, customPattern);
                violations.push(...customViolations);
            }
        }

        // Generate AI suggestions if enabled
        if (this.config.enableAISuggestions && violations.length > 0) {
            await this.generateSuggestions(violations, files);
        }

        // Calculate stats
        const byType: Record<PlaceholderType, number> = {
            todo_comment: 0,
            lorem_ipsum: 0,
            placeholder_image: 0,
            dummy_data: 0,
            stub_function: 0,
            coming_soon: 0,
            template_text: 0,
            unfinished_ui: 0,
            debug_code: 0,
            mock_data: 0,
        };

        for (const violation of violations) {
            byType[violation.type]++;
        }

        const stats = {
            filesScanned: filesToScan.size,
            violationsFound: violations.length,
            byType,
        };

        // Determine blocking status
        const blocking = this.config.zeroTolerance
            ? violations.length > 0
            : violations.length > this.config.maxViolationsAllowed;

        const result: PlaceholderScanResult = {
            timestamp: new Date(),
            passed: violations.length === 0,
            blocking,
            violations,
            summary: this.generateSummary(violations, stats),
            stats,
        };

        this.lastResult = result;
        this.emit('scan_complete', result);

        if (blocking) {
            this.emit('blocking', result);
        }

        console.log(`[PlaceholderEliminator] Scan complete: ${violations.length} violations (${Date.now() - startTime}ms)`);

        return result;
    }

    /**
     * Get last scan result
     */
    getLastResult(): PlaceholderScanResult | undefined {
        return this.lastResult;
    }

    // ==========================================================================
    // SCANNING METHODS
    // ==========================================================================

    private scanFile(filePath: string, content: string): PlaceholderViolation[] {
        const violations: PlaceholderViolation[] = [];
        const lines = content.split('\n');

        for (const { type, patterns } of PLACEHOLDER_PATTERNS) {
            for (const { regex, description } of patterns) {
                // Reset regex state
                regex.lastIndex = 0;

                let match;
                while ((match = regex.exec(content)) !== null) {
                    // Find line number
                    const lineNumber = this.getLineNumber(content, match.index);

                    // Skip if it looks like legitimate code
                    if (this.isLegitimateUsage(filePath, match[0], type, lines[lineNumber - 1])) {
                        continue;
                    }

                    violations.push({
                        id: uuidv4(),
                        type,
                        description,
                        file: filePath,
                        line: lineNumber,
                        code: this.truncateCode(match[0]),
                    });
                }
            }
        }

        return violations;
    }

    private scanCustomPattern(
        filePath: string,
        content: string,
        pattern: { pattern: RegExp; type: PlaceholderType; description: string }
    ): PlaceholderViolation[] {
        const violations: PlaceholderViolation[] = [];

        pattern.pattern.lastIndex = 0;
        let match;

        while ((match = pattern.pattern.exec(content)) !== null) {
            violations.push({
                id: uuidv4(),
                type: pattern.type,
                description: pattern.description,
                file: filePath,
                line: this.getLineNumber(content, match.index),
                code: this.truncateCode(match[0]),
            });
        }

        return violations;
    }

    private isLegitimateUsage(
        filePath: string,
        match: string,
        type: PlaceholderType,
        line?: string
    ): boolean {
        // Allow console in certain files
        if (type === 'debug_code' && match.includes('console')) {
            // Allow in server files, test files, and logger utilities
            if (
                filePath.includes('logger') ||
                filePath.includes('debug') ||
                filePath.includes('.test.') ||
                filePath.includes('.spec.') ||
                filePath.includes('server/')
            ) {
                return true;
            }
        }

        // Allow mock data in test files
        if (type === 'mock_data' || type === 'dummy_data') {
            if (
                filePath.includes('.test.') ||
                filePath.includes('.spec.') ||
                filePath.includes('__tests__') ||
                filePath.includes('__mocks__') ||
                filePath.includes('/fixtures/')
            ) {
                return true;
            }
        }

        // Allow TODO in comments that are documentation
        if (type === 'todo_comment' && line) {
            // Skip if it's documenting a known issue with a ticket reference
            if (/(?:JIRA|GH|#)\d+/.test(line)) {
                return true;
            }
        }

        // Allow placeholder images in development/storybook files
        if (type === 'placeholder_image') {
            if (
                filePath.includes('.stories.') ||
                filePath.includes('storybook')
            ) {
                return true;
            }
        }

        return false;
    }

    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }

    private truncateCode(code: string): string {
        if (code.length > 80) {
            return code.substring(0, 77) + '...';
        }
        return code;
    }

    // ==========================================================================
    // AI SUGGESTIONS
    // ==========================================================================

    private async generateSuggestions(
        violations: PlaceholderViolation[],
        files: Map<string, string>
    ): Promise<void> {
        // Only generate suggestions for first 10 violations
        const violationsToSuggest = violations.slice(0, 10);

        for (const violation of violationsToSuggest) {
            try {
                const fileContent = files.get(violation.file);
                if (!fileContent) continue;

                const contextLines = this.getContextLines(
                    fileContent,
                    violation.line || 1
                );

                const response = await this.claudeService.generate(
                    `Suggest a real replacement for this placeholder content:

TYPE: ${violation.type}
FOUND: ${violation.description}
CODE: ${violation.code}

CONTEXT:
\`\`\`
${contextLines}
\`\`\`

Provide a brief, production-ready replacement suggestion in 1-2 sentences.
If it's a TODO, suggest what the completed implementation should be.
If it's placeholder text, suggest appropriate real content.
If it's debug code, suggest removal or proper logging.`,
                    {
                        model: CLAUDE_MODELS.HAIKU_3_5,
                        maxTokens: 150,
                        useExtendedThinking: false,
                    }
                );

                violation.suggestion = response.content.trim();
            } catch (e) {
                // Silently skip suggestion generation on error
            }
        }
    }

    private getContextLines(content: string, line: number, context: number = 3): string {
        const lines = content.split('\n');
        const start = Math.max(0, line - context - 1);
        const end = Math.min(lines.length, line + context);

        return lines
            .slice(start, end)
            .map((l, i) => `${start + i + 1} | ${l}`)
            .join('\n');
    }

    // ==========================================================================
    // REPORTING
    // ==========================================================================

    private generateSummary(
        violations: PlaceholderViolation[],
        stats: { filesScanned: number; violationsFound: number; byType: Record<PlaceholderType, number> }
    ): string {
        if (violations.length === 0) {
            return `Placeholder scan passed. Scanned ${stats.filesScanned} files, no placeholders found.`;
        }

        // Find most common types
        const sortedTypes = Object.entries(stats.byType)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const typeBreakdown = sortedTypes
            .map(([type, count]) => `${type.replace(/_/g, ' ')}: ${count}`)
            .join(', ');

        // Find most affected files
        const fileViolations = new Map<string, number>();
        for (const v of violations) {
            fileViolations.set(v.file, (fileViolations.get(v.file) || 0) + 1);
        }

        const topFiles = Array.from(fileViolations.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([file]) => file.split('/').pop())
            .join(', ');

        return `BLOCKING: Found ${violations.length} placeholder(s) in ${fileViolations.size} file(s). ` +
               `Types: ${typeBreakdown}. ` +
               `Affected: ${topFiles}`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createPlaceholderEliminatorAgent(
    projectId: string,
    userId: string,
    config?: Partial<PlaceholderEliminatorConfig>
): PlaceholderEliminatorAgent {
    return new PlaceholderEliminatorAgent(projectId, userId, config);
}

export default PlaceholderEliminatorAgent;

