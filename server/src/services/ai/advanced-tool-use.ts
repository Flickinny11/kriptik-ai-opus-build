/**
 * Advanced Tool Use - Anthropic December 2025 Features
 *
 * Implements the latest Anthropic tool use capabilities:
 * - Tool Search Tool: Dynamic tool discovery for large toolkits
 * - Token-Efficient Tool Use: Up to 70% reduction in output tokens
 * - Programmatic Tool Calling: Multi-step workflows in single execution
 * - Improved Error Handling: Detailed, actionable error responses
 *
 * Based on Anthropic's Advanced Tool Use announcement (December 2025):
 * - Tool Search Tool improved Opus 4.5 from 79.5% to 88.1% accuracy
 * - Token savings of 85% by deferring unused tools
 * - 37% latency reduction with programmatic tool calling
 *
 * @see https://www.anthropic.com/engineering/advanced-tool-use
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tool definition with deferred loading support
 */
export interface DeferrableToolDefinition {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    /** If true, tool is discovered on-demand via Tool Search */
    defer_loading?: boolean;
    /** Category for Tool Search filtering */
    category?: string;
    /** Tags for Tool Search discovery */
    tags?: string[];
}

/**
 * Tool Search request
 */
export interface ToolSearchRequest {
    query: string;
    category?: string;
    maxResults?: number;
}

/**
 * Tool Search result
 */
export interface ToolSearchResult {
    tool: DeferrableToolDefinition;
    relevanceScore: number;
    matchedOn: 'name' | 'description' | 'tags';
}

/**
 * Programmatic tool call specification
 */
export interface ProgrammaticToolCall {
    id: string;
    tool: string;
    parameters: Record<string, unknown>;
    dependsOn?: string[]; // IDs of calls that must complete first
}

/**
 * Programmatic workflow definition
 */
export interface ProgrammaticWorkflow {
    id: string;
    name: string;
    description: string;
    calls: ProgrammaticToolCall[];
}

/**
 * Enhanced tool result with detailed error handling
 */
export interface EnhancedToolResult {
    tool_use_id: string;
    content: string;
    is_error?: boolean;
    error_details?: {
        code: string;
        message: string;
        suggestion?: string;
        context?: Record<string, unknown>;
    };
}

/**
 * Token-efficient tool use configuration
 */
export interface TokenEfficientConfig {
    /** Enable token-efficient mode (Claude 4 default, Claude 3.7 requires beta) */
    enabled: boolean;
    /** Beta header for Claude 3.7 Sonnet */
    betaHeader?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Beta headers for advanced tool use features
 */
export const ADVANCED_TOOL_BETAS = {
    TOKEN_EFFICIENT: 'token-efficient-tools-2025-02-19',
    TOOL_SEARCH: 'tool-search-2025-11-20',
    FINE_GRAINED_STREAMING: 'fine-grained-tool-streaming-2025-08-15',
} as const;

/**
 * KripTik AI tool categories
 */
export const TOOL_CATEGORIES = {
    FILE_OPERATIONS: 'file_operations',
    BUILD_OPERATIONS: 'build_operations',
    CLOUD_PROVISIONING: 'cloud_provisioning',
    DATABASE_OPERATIONS: 'database_operations',
    BROWSER_AUTOMATION: 'browser_automation',
    DESIGN_INTEGRATION: 'design_integration',
    VERIFICATION: 'verification',
    DEPLOYMENT: 'deployment',
} as const;

// =============================================================================
// TOOL REGISTRY
// =============================================================================

/**
 * KripTik AI Tool Registry with deferred loading configuration
 *
 * Critical tools (defer_loading: false) are always loaded
 * Specialized tools (defer_loading: true) are discovered on-demand
 */
export const KRIPTIK_TOOLS: DeferrableToolDefinition[] = [
    // =========================================================================
    // ALWAYS LOADED - Critical Path Tools
    // =========================================================================
    {
        name: 'read_file',
        description: 'Read the contents of a file at the specified path',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the file to read' },
            },
            required: ['path'],
        },
        defer_loading: false,
        category: TOOL_CATEGORIES.FILE_OPERATIONS,
        tags: ['file', 'read', 'critical'],
    },
    {
        name: 'write_file',
        description: 'Write content to a file at the specified path',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the file to write' },
                content: { type: 'string', description: 'Content to write to the file' },
            },
            required: ['path', 'content'],
        },
        defer_loading: false,
        category: TOOL_CATEGORIES.FILE_OPERATIONS,
        tags: ['file', 'write', 'critical'],
    },
    {
        name: 'run_build',
        description: 'Run the build command (npm run build) and return results',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Build command to run', default: 'npm run build' },
            },
        },
        defer_loading: false,
        category: TOOL_CATEGORIES.BUILD_OPERATIONS,
        tags: ['build', 'npm', 'critical'],
    },
    {
        name: 'run_typecheck',
        description: 'Run TypeScript type checking (tsc --noEmit)',
        input_schema: {
            type: 'object',
            properties: {},
        },
        defer_loading: false,
        category: TOOL_CATEGORIES.BUILD_OPERATIONS,
        tags: ['typescript', 'typecheck', 'critical'],
    },

    // =========================================================================
    // DEFERRED - Cloud Provisioning (AWS)
    // =========================================================================
    {
        name: 'aws_create_s3_bucket',
        description: 'Create an S3 bucket with specified configuration',
        input_schema: {
            type: 'object',
            properties: {
                bucket_name: { type: 'string', description: 'Name of the S3 bucket' },
                region: { type: 'string', description: 'AWS region', default: 'us-east-1' },
                public: { type: 'boolean', description: 'Whether bucket is public', default: false },
            },
            required: ['bucket_name'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.CLOUD_PROVISIONING,
        tags: ['aws', 's3', 'storage', 'cloud'],
    },
    {
        name: 'aws_create_lambda',
        description: 'Create a Lambda function with specified configuration',
        input_schema: {
            type: 'object',
            properties: {
                function_name: { type: 'string', description: 'Name of the Lambda function' },
                runtime: { type: 'string', description: 'Runtime', default: 'nodejs20.x' },
                handler: { type: 'string', description: 'Handler function', default: 'index.handler' },
                memory: { type: 'number', description: 'Memory in MB', default: 256 },
                timeout: { type: 'number', description: 'Timeout in seconds', default: 30 },
            },
            required: ['function_name'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.CLOUD_PROVISIONING,
        tags: ['aws', 'lambda', 'serverless', 'cloud'],
    },
    {
        name: 'aws_create_ec2',
        description: 'Create an EC2 instance with specified configuration',
        input_schema: {
            type: 'object',
            properties: {
                instance_type: { type: 'string', description: 'Instance type', default: 't3.micro' },
                ami_id: { type: 'string', description: 'AMI ID' },
                key_name: { type: 'string', description: 'SSH key pair name' },
            },
            required: ['ami_id'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.CLOUD_PROVISIONING,
        tags: ['aws', 'ec2', 'compute', 'cloud'],
    },
    {
        name: 'aws_create_cloudwatch_alarm',
        description: 'Create a CloudWatch alarm for monitoring',
        input_schema: {
            type: 'object',
            properties: {
                alarm_name: { type: 'string', description: 'Name of the alarm' },
                metric_name: { type: 'string', description: 'Metric to monitor' },
                threshold: { type: 'number', description: 'Threshold value' },
            },
            required: ['alarm_name', 'metric_name', 'threshold'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.CLOUD_PROVISIONING,
        tags: ['aws', 'cloudwatch', 'monitoring', 'cloud'],
    },

    // =========================================================================
    // DEFERRED - Database Operations (Supabase)
    // =========================================================================
    {
        name: 'supabase_create_table',
        description: 'Create a new table in Supabase database',
        input_schema: {
            type: 'object',
            properties: {
                table_name: { type: 'string', description: 'Name of the table' },
                columns: {
                    type: 'array',
                    description: 'Column definitions',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            type: { type: 'string' },
                            nullable: { type: 'boolean' },
                        },
                    },
                },
            },
            required: ['table_name', 'columns'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DATABASE_OPERATIONS,
        tags: ['supabase', 'database', 'table', 'sql'],
    },
    {
        name: 'supabase_run_migration',
        description: 'Run a database migration in Supabase',
        input_schema: {
            type: 'object',
            properties: {
                migration_sql: { type: 'string', description: 'SQL migration script' },
            },
            required: ['migration_sql'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DATABASE_OPERATIONS,
        tags: ['supabase', 'database', 'migration', 'sql'],
    },
    {
        name: 'supabase_setup_auth',
        description: 'Configure authentication in Supabase',
        input_schema: {
            type: 'object',
            properties: {
                providers: {
                    type: 'array',
                    description: 'OAuth providers to enable',
                    items: { type: 'string' },
                },
                email_auth: { type: 'boolean', description: 'Enable email auth', default: true },
            },
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DATABASE_OPERATIONS,
        tags: ['supabase', 'auth', 'authentication'],
    },

    // =========================================================================
    // DEFERRED - Browser Automation (Playwright)
    // =========================================================================
    {
        name: 'playwright_navigate',
        description: 'Navigate to a URL in the browser',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to navigate to' },
            },
            required: ['url'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.BROWSER_AUTOMATION,
        tags: ['playwright', 'browser', 'navigation'],
    },
    {
        name: 'playwright_click',
        description: 'Click an element in the browser using accessibility tree',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'Element selector or accessible name' },
            },
            required: ['selector'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.BROWSER_AUTOMATION,
        tags: ['playwright', 'browser', 'interaction', 'click'],
    },
    {
        name: 'playwright_fill',
        description: 'Fill a form field in the browser',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'Field selector or accessible name' },
                value: { type: 'string', description: 'Value to fill' },
            },
            required: ['selector', 'value'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.BROWSER_AUTOMATION,
        tags: ['playwright', 'browser', 'form', 'input'],
    },
    {
        name: 'playwright_get_accessibility_snapshot',
        description: 'Get the accessibility tree snapshot of the current page (no vision model needed)',
        input_schema: {
            type: 'object',
            properties: {},
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.BROWSER_AUTOMATION,
        tags: ['playwright', 'browser', 'accessibility', 'snapshot'],
    },
    {
        name: 'playwright_screenshot',
        description: 'Take a screenshot of the current page',
        input_schema: {
            type: 'object',
            properties: {
                full_page: { type: 'boolean', description: 'Capture full page', default: false },
            },
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.BROWSER_AUTOMATION,
        tags: ['playwright', 'browser', 'screenshot', 'visual'],
    },

    // =========================================================================
    // DEFERRED - Design Integration (Figma)
    // =========================================================================
    {
        name: 'figma_get_frame',
        description: 'Get a Figma frame design with components and styles',
        input_schema: {
            type: 'object',
            properties: {
                file_key: { type: 'string', description: 'Figma file key' },
                node_id: { type: 'string', description: 'Node/frame ID' },
            },
            required: ['file_key', 'node_id'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DESIGN_INTEGRATION,
        tags: ['figma', 'design', 'frame', 'ui'],
    },
    {
        name: 'figma_get_components',
        description: 'Get component definitions from a Figma file',
        input_schema: {
            type: 'object',
            properties: {
                file_key: { type: 'string', description: 'Figma file key' },
            },
            required: ['file_key'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DESIGN_INTEGRATION,
        tags: ['figma', 'design', 'components'],
    },
    {
        name: 'figma_get_styles',
        description: 'Get style definitions (colors, typography, effects) from Figma',
        input_schema: {
            type: 'object',
            properties: {
                file_key: { type: 'string', description: 'Figma file key' },
            },
            required: ['file_key'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DESIGN_INTEGRATION,
        tags: ['figma', 'design', 'styles', 'tokens'],
    },

    // =========================================================================
    // DEFERRED - Deployment
    // =========================================================================
    {
        name: 'vercel_deploy',
        description: 'Deploy the application to Vercel',
        input_schema: {
            type: 'object',
            properties: {
                project_name: { type: 'string', description: 'Vercel project name' },
                production: { type: 'boolean', description: 'Deploy to production', default: false },
            },
            required: ['project_name'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DEPLOYMENT,
        tags: ['vercel', 'deploy', 'hosting'],
    },
    {
        name: 'vercel_get_preview_url',
        description: 'Get the preview URL for a deployment',
        input_schema: {
            type: 'object',
            properties: {
                deployment_id: { type: 'string', description: 'Deployment ID' },
            },
            required: ['deployment_id'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.DEPLOYMENT,
        tags: ['vercel', 'preview', 'url'],
    },

    // =========================================================================
    // DEFERRED - Verification
    // =========================================================================
    {
        name: 'run_eslint',
        description: 'Run ESLint on the codebase',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to lint', default: 'src' },
                fix: { type: 'boolean', description: 'Auto-fix issues', default: false },
            },
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.VERIFICATION,
        tags: ['eslint', 'lint', 'code-quality'],
    },
    {
        name: 'run_tests',
        description: 'Run the test suite',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Test file pattern' },
                coverage: { type: 'boolean', description: 'Generate coverage report', default: false },
            },
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.VERIFICATION,
        tags: ['test', 'vitest', 'jest', 'coverage'],
    },
    {
        name: 'run_lighthouse',
        description: 'Run Lighthouse audit on a URL',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to audit' },
                categories: {
                    type: 'array',
                    description: 'Categories to audit',
                    items: { type: 'string' },
                    default: ['performance', 'accessibility', 'best-practices', 'seo'],
                },
            },
            required: ['url'],
        },
        defer_loading: true,
        category: TOOL_CATEGORIES.VERIFICATION,
        tags: ['lighthouse', 'audit', 'performance', 'accessibility'],
    },
];

// =============================================================================
// TOOL SEARCH ENGINE
// =============================================================================

/**
 * Tool Search Engine - Discovers tools on-demand
 * Saves ~85% of context tokens when working with large toolkits
 */
export class ToolSearchEngine {
    private tools: Map<string, DeferrableToolDefinition>;
    private categoryIndex: Map<string, string[]>;
    private tagIndex: Map<string, string[]>;

    constructor(tools: DeferrableToolDefinition[] = KRIPTIK_TOOLS) {
        this.tools = new Map();
        this.categoryIndex = new Map();
        this.tagIndex = new Map();

        this.indexTools(tools);
    }

    /**
     * Index tools for efficient search
     */
    private indexTools(tools: DeferrableToolDefinition[]): void {
        for (const tool of tools) {
            this.tools.set(tool.name, tool);

            // Index by category
            if (tool.category) {
                const categoryTools = this.categoryIndex.get(tool.category) || [];
                categoryTools.push(tool.name);
                this.categoryIndex.set(tool.category, categoryTools);
            }

            // Index by tags
            if (tool.tags) {
                for (const tag of tool.tags) {
                    const tagTools = this.tagIndex.get(tag) || [];
                    tagTools.push(tool.name);
                    this.tagIndex.set(tag, tagTools);
                }
            }
        }

        console.log(`[ToolSearchEngine] Indexed ${tools.length} tools across ${this.categoryIndex.size} categories`);
    }

    /**
     * Search for tools matching a query
     */
    search(request: ToolSearchRequest): ToolSearchResult[] {
        const { query, category, maxResults = 10 } = request;
        const results: ToolSearchResult[] = [];
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/);

        for (const [name, tool] of this.tools) {
            // Skip if category filter doesn't match
            if (category && tool.category !== category) {
                continue;
            }

            let relevanceScore = 0;
            let matchedOn: 'name' | 'description' | 'tags' = 'description';

            // Check name match
            if (name.toLowerCase().includes(queryLower)) {
                relevanceScore += 1.0;
                matchedOn = 'name';
            }

            // Check description match
            const descLower = tool.description.toLowerCase();
            for (const word of queryWords) {
                if (descLower.includes(word)) {
                    relevanceScore += 0.3;
                    if (matchedOn !== 'name') {
                        matchedOn = 'description';
                    }
                }
            }

            // Check tag matches
            if (tool.tags) {
                for (const tag of tool.tags) {
                    for (const word of queryWords) {
                        if (tag.toLowerCase().includes(word)) {
                            relevanceScore += 0.5;
                            if (matchedOn !== 'name') {
                                matchedOn = 'tags';
                            }
                        }
                    }
                }
            }

            if (relevanceScore > 0) {
                results.push({ tool, relevanceScore, matchedOn });
            }
        }

        // Sort by relevance and limit results
        return results
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, maxResults);
    }

    /**
     * Get tools by category
     */
    getByCategory(category: string): DeferrableToolDefinition[] {
        const toolNames = this.categoryIndex.get(category) || [];
        return toolNames
            .map(name => this.tools.get(name))
            .filter((tool): tool is DeferrableToolDefinition => tool !== undefined);
    }

    /**
     * Get critical (non-deferred) tools
     */
    getCriticalTools(): DeferrableToolDefinition[] {
        return Array.from(this.tools.values()).filter(t => !t.defer_loading);
    }

    /**
     * Get deferred tools
     */
    getDeferredTools(): DeferrableToolDefinition[] {
        return Array.from(this.tools.values()).filter(t => t.defer_loading);
    }

    /**
     * Get tool by name
     */
    getTool(name: string): DeferrableToolDefinition | undefined {
        return this.tools.get(name);
    }

    /**
     * Get token savings estimate
     */
    getTokenSavingsEstimate(): {
        criticalToolTokens: number;
        deferredToolTokens: number;
        savingsPercent: number;
    } {
        const critical = this.getCriticalTools();
        const deferred = this.getDeferredTools();

        // Rough estimate: ~100 tokens per tool definition
        const tokensPerTool = 100;
        const criticalToolTokens = critical.length * tokensPerTool;
        const deferredToolTokens = deferred.length * tokensPerTool;
        const totalTokens = criticalToolTokens + deferredToolTokens;
        const savingsPercent = Math.round((deferredToolTokens / totalTokens) * 100);

        return {
            criticalToolTokens,
            deferredToolTokens,
            savingsPercent,
        };
    }
}

// =============================================================================
// PROGRAMMATIC TOOL CALLING
// =============================================================================

/**
 * Execute a programmatic workflow
 * Runs multiple tool calls in a single orchestrated execution
 */
export async function executeProgrammaticWorkflow(
    workflow: ProgrammaticWorkflow,
    executeToolFn: (tool: string, params: Record<string, unknown>) => Promise<unknown>
): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const completed = new Set<string>();

    // Build dependency graph
    const dependencyGraph = new Map<string, Set<string>>();
    for (const call of workflow.calls) {
        dependencyGraph.set(call.id, new Set(call.dependsOn || []));
    }

    // Execute in dependency order
    while (completed.size < workflow.calls.length) {
        const ready = workflow.calls.filter(call => {
            if (completed.has(call.id)) return false;
            const deps = dependencyGraph.get(call.id) || new Set();
            return Array.from(deps).every(dep => completed.has(dep));
        });

        if (ready.length === 0 && completed.size < workflow.calls.length) {
            throw new Error('Circular dependency detected in workflow');
        }

        // Execute ready calls in parallel
        await Promise.all(
            ready.map(async call => {
                try {
                    const result = await executeToolFn(call.tool, call.parameters);
                    results.set(call.id, result);
                    completed.add(call.id);
                } catch (error) {
                    results.set(call.id, { error: String(error) });
                    completed.add(call.id);
                }
            })
        );
    }

    return results;
}

// =============================================================================
// ENHANCED ERROR HANDLING
// =============================================================================

/**
 * Create an enhanced tool result with detailed error information
 */
export function createEnhancedToolResult(
    toolUseId: string,
    success: boolean,
    content: string,
    errorDetails?: {
        code: string;
        suggestion?: string;
        context?: Record<string, unknown>;
    }
): EnhancedToolResult {
    if (success) {
        return {
            tool_use_id: toolUseId,
            content,
        };
    }

    // Create detailed error response
    const errorMessage = errorDetails
        ? `Error [${errorDetails.code}]: ${content}${errorDetails.suggestion ? `. Suggestion: ${errorDetails.suggestion}` : ''}`
        : content;

    return {
        tool_use_id: toolUseId,
        content: errorMessage,
        is_error: true,
        error_details: errorDetails
            ? {
                code: errorDetails.code,
                message: content,
                suggestion: errorDetails.suggestion,
                context: errorDetails.context,
            }
            : undefined,
    };
}

/**
 * Common error codes and suggestions
 */
export const TOOL_ERROR_SUGGESTIONS: Record<string, { code: string; suggestion: string }> = {
    file_not_found: {
        code: 'FILE_NOT_FOUND',
        suggestion: 'Check if the file path is correct. Use glob patterns to search for similar files.',
    },
    permission_denied: {
        code: 'PERMISSION_DENIED',
        suggestion: 'The file may be read-only or in a protected directory. Check file permissions.',
    },
    syntax_error: {
        code: 'SYNTAX_ERROR',
        suggestion: 'Check the code for syntax issues. Common causes: missing brackets, typos, invalid JSON.',
    },
    type_error: {
        code: 'TYPE_ERROR',
        suggestion: 'Type mismatch detected. Verify the types match the expected schema.',
    },
    network_error: {
        code: 'NETWORK_ERROR',
        suggestion: 'Network request failed. Check the URL, credentials, and network connectivity.',
    },
    timeout: {
        code: 'TIMEOUT',
        suggestion: 'Operation timed out. Consider breaking into smaller operations or increasing timeout.',
    },
    rate_limit: {
        code: 'RATE_LIMIT',
        suggestion: 'Rate limit exceeded. Wait before retrying or reduce request frequency.',
    },
    invalid_credentials: {
        code: 'INVALID_CREDENTIALS',
        suggestion: 'Authentication failed. Verify API keys and tokens are correct and not expired.',
    },
};

// =============================================================================
// TOOL CONFIGURATION BUILDER
// =============================================================================

/**
 * Build Anthropic tool configuration with deferred loading
 */
export function buildToolConfiguration(
    toolSearch: ToolSearchEngine,
    options?: {
        includeDeferred?: boolean;
        categories?: string[];
        additionalTools?: DeferrableToolDefinition[];
    }
): {
    tools: Anthropic.Tool[];
    toolSearchTool?: Anthropic.Tool;
    deferredToolCount: number;
} {
    const { includeDeferred = false, categories, additionalTools = [] } = options || {};

    // Always include critical tools
    let tools = toolSearch.getCriticalTools();

    // Add category-specific tools if requested
    if (categories) {
        for (const category of categories) {
            const categoryTools = toolSearch.getByCategory(category);
            tools = [...tools, ...categoryTools.filter(t => !tools.includes(t))];
        }
    }

    // Add deferred tools if requested
    if (includeDeferred) {
        const deferred = toolSearch.getDeferredTools();
        tools = [...tools, ...deferred.filter(t => !tools.includes(t))];
    }

    // Add additional tools
    tools = [...tools, ...additionalTools];

    // Convert to Anthropic format
    const anthropicTools: Anthropic.Tool[] = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    }));

    // Create Tool Search Tool if there are deferred tools
    const deferredCount = toolSearch.getDeferredTools().length;
    let toolSearchTool: Anthropic.Tool | undefined;

    if (deferredCount > 0 && !includeDeferred) {
        toolSearchTool = {
            name: 'search_tools',
            description: `Search for specialized tools from ${deferredCount} available tools. Use this when you need a tool that's not in your current toolkit. Categories: ${Object.values(TOOL_CATEGORIES).join(', ')}`,
            input_schema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query describing the tool you need',
                    },
                    category: {
                        type: 'string',
                        description: 'Optional category filter',
                        enum: Object.values(TOOL_CATEGORIES),
                    },
                },
                required: ['query'],
            },
        };

        anthropicTools.push(toolSearchTool);
    }

    return {
        tools: anthropicTools,
        toolSearchTool,
        deferredToolCount: deferredCount,
    };
}

// =============================================================================
// SINGLETON
// =============================================================================

let toolSearchInstance: ToolSearchEngine | null = null;

export function getToolSearchEngine(): ToolSearchEngine {
    if (!toolSearchInstance) {
        toolSearchInstance = new ToolSearchEngine();
    }
    return toolSearchInstance;
}

export function resetToolSearchEngine(): void {
    toolSearchInstance = null;
}
