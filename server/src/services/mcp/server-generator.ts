/**
 * MCP Server Generator
 *
 * Generates Model Context Protocol (MCP) servers from app code.
 * This allows any KripTik-built app to expose its functionality
 * to AI assistants (Claude, ChatGPT, etc.)
 *
 * MCP is the industry standard for connecting AI to tools.
 * Reference: https://modelcontextprotocol.io/
 */

import { getModelRouter } from '../ai/model-router';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description: string;
            required?: boolean;
            enum?: string[];
        }>;
        required: string[];
    };
    handler: string; // Code for the handler function
}

export interface MCPResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    handler: string;
}

export interface MCPPrompt {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required?: boolean;
    }>;
    template: string;
}

export interface MCPServerConfig {
    name: string;
    version: string;
    description: string;
    tools: MCPTool[];
    resources: MCPResource[];
    prompts: MCPPrompt[];
}

export interface GeneratedMCPServer {
    config: MCPServerConfig;
    files: Array<{ path: string; content: string }>;
    installCommands: string[];
    runCommand: string;
}

// ============================================================================
// MCP SERVER GENERATOR
// ============================================================================

export class MCPServerGeneratorService {
    /**
     * Analyze code and generate MCP server
     */
    async generateFromCode(
        sourceCode: string,
        sourceFile: string,
        options?: {
            serverName?: string;
            includeResources?: boolean;
            includePrompts?: boolean;
        }
    ): Promise<GeneratedMCPServer> {
        const router = getModelRouter();

        // Step 1: Analyze the source code for MCP-exposable functionality
        const analysisPrompt = `Analyze this code and identify all functions, APIs, and data that should be exposed via MCP (Model Context Protocol):

\`\`\`typescript
${sourceCode}
\`\`\`

Identify:
1. **Tools** - Functions that perform actions (CRUD operations, API calls, computations)
2. **Resources** - Data sources that can be read (databases, files, API endpoints)
3. **Prompts** - Reusable prompt templates for common operations

For each tool, provide:
- name (snake_case)
- description (what it does)
- input parameters with types and descriptions
- return type

Respond with JSON:
{
  "tools": [...],
  "resources": [...],
  "prompts": [...]
}`;

        const analysisResponse = await router.generate({
            prompt: analysisPrompt,
            taskType: 'analysis',
            forceTier: 'standard',
            systemPrompt: MCP_ANALYSIS_SYSTEM_PROMPT,
        });

        const analysis = this.parseAnalysis(analysisResponse.content);

        // Step 2: Generate MCP server code
        const serverConfig: MCPServerConfig = {
            name: options?.serverName || this.inferServerName(sourceFile),
            version: '1.0.0',
            description: `MCP server generated from ${sourceFile}`,
            tools: analysis.tools,
            resources: options?.includeResources !== false ? analysis.resources : [],
            prompts: options?.includePrompts !== false ? analysis.prompts : [],
        };

        const files = this.generateServerFiles(serverConfig);

        return {
            config: serverConfig,
            files,
            installCommands: [
                'npm init -y',
                'npm install @modelcontextprotocol/sdk zod',
            ],
            runCommand: 'node index.js',
        };
    }

    /**
     * Generate MCP server from API spec
     */
    async generateFromOpenAPI(
        openApiSpec: Record<string, unknown>,
        options?: { serverName?: string }
    ): Promise<GeneratedMCPServer> {
        const router = getModelRouter();

        const prompt = `Convert this OpenAPI specification to MCP tools:

\`\`\`json
${JSON.stringify(openApiSpec, null, 2)}
\`\`\`

For each endpoint, create an MCP tool with:
- name: operation_id or generated from path
- description: from summary/description
- inputSchema: from request body/parameters
- handler: fetch call to the endpoint

Respond with JSON array of tools.`;

        const response = await router.generate({
            prompt,
            taskType: 'generation',
            forceTier: 'standard',
            systemPrompt: MCP_ANALYSIS_SYSTEM_PROMPT,
        });

        const tools = this.parseTools(response.content);

        const serverConfig: MCPServerConfig = {
            name: options?.serverName || 'api-mcp-server',
            version: '1.0.0',
            description: 'MCP server generated from OpenAPI spec',
            tools,
            resources: [],
            prompts: [],
        };

        return {
            config: serverConfig,
            files: this.generateServerFiles(serverConfig),
            installCommands: [
                'npm init -y',
                'npm install @modelcontextprotocol/sdk zod node-fetch',
            ],
            runCommand: 'node index.js',
        };
    }

    /**
     * Generate a preset MCP server for common integrations
     */
    async generatePreset(
        preset: 'database' | 'storage' | 'auth' | 'email' | 'payments',
        config: Record<string, string>
    ): Promise<GeneratedMCPServer> {
        const presetConfigs: Record<string, MCPServerConfig> = {
            database: this.getDatabasePreset(config),
            storage: this.getStoragePreset(config),
            auth: this.getAuthPreset(config),
            email: this.getEmailPreset(config),
            payments: this.getPaymentsPreset(config),
        };

        const serverConfig = presetConfigs[preset];
        if (!serverConfig) {
            throw new Error(`Unknown preset: ${preset}`);
        }

        return {
            config: serverConfig,
            files: this.generateServerFiles(serverConfig),
            installCommands: this.getPresetDependencies(preset),
            runCommand: 'node index.js',
        };
    }

    // ========================================================================
    // FILE GENERATION
    // ========================================================================

    private generateServerFiles(config: MCPServerConfig): Array<{ path: string; content: string }> {
        const files: Array<{ path: string; content: string }> = [];

        // Main server file
        files.push({
            path: 'index.js',
            content: this.generateMainServer(config),
        });

        // Tool handlers
        files.push({
            path: 'tools.js',
            content: this.generateToolHandlers(config.tools),
        });

        // Resource handlers
        if (config.resources.length > 0) {
            files.push({
                path: 'resources.js',
                content: this.generateResourceHandlers(config.resources),
            });
        }

        // Prompt templates
        if (config.prompts.length > 0) {
            files.push({
                path: 'prompts.js',
                content: this.generatePromptHandlers(config.prompts),
            });
        }

        // Package.json
        files.push({
            path: 'package.json',
            content: JSON.stringify({
                name: config.name,
                version: config.version,
                type: 'module',
                main: 'index.js',
                scripts: {
                    start: 'node index.js',
                },
                dependencies: {
                    '@modelcontextprotocol/sdk': '^1.0.0',
                    'zod': '^3.22.0',
                },
            }, null, 2),
        });

        // README
        files.push({
            path: 'README.md',
            content: this.generateReadme(config),
        });

        return files;
    }

    private generateMainServer(config: MCPServerConfig): string {
        return `/**
 * MCP Server: ${config.name}
 * ${config.description}
 *
 * Generated by KripTik AI
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { toolHandlers, toolDefinitions } from './tools.js';
${config.resources.length > 0 ? "import { resourceHandlers, resourceDefinitions } from './resources.js';" : ''}
${config.prompts.length > 0 ? "import { promptHandlers, promptDefinitions } from './prompts.js';" : ''}

// Create server instance
const server = new Server(
    {
        name: '${config.name}',
        version: '${config.version}',
    },
    {
        capabilities: {
            tools: {},
            ${config.resources.length > 0 ? 'resources: {},' : ''}
            ${config.prompts.length > 0 ? 'prompts: {},' : ''}
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name];
    if (!handler) {
        throw new Error(\`Unknown tool: \${name}\`);
    }

    try {
        const result = await handler(args);
        return {
            content: [
                {
                    type: 'text',
                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: \`Error: \${error.message}\`,
                },
            ],
            isError: true,
        };
    }
});

${config.resources.length > 0 ? `
// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceDefinitions,
}));

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    const handler = resourceHandlers[uri];
    if (!handler) {
        throw new Error(\`Unknown resource: \${uri}\`);
    }

    const content = await handler();
    return { contents: [content] };
});
` : ''}

${config.prompts.length > 0 ? `
// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: promptDefinitions,
}));

// Get prompt
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = promptHandlers[name];
    if (!handler) {
        throw new Error(\`Unknown prompt: \${name}\`);
    }

    return handler(args);
});
` : ''}

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('${config.name} MCP server running on stdio');
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
`;
    }

    private generateToolHandlers(tools: MCPTool[]): string {
        return `/**
 * Tool Handlers
 * Generated by KripTik AI
 */

// Tool definitions for MCP
export const toolDefinitions = ${JSON.stringify(
            tools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
            })),
            null,
            2
        )};

// Tool handler functions
export const toolHandlers = {
${tools.map(t => `    '${t.name}': async (args) => {
        ${t.handler}
    }`).join(',\n')}
};
`;
    }

    private generateResourceHandlers(resources: MCPResource[]): string {
        return `/**
 * Resource Handlers
 * Generated by KripTik AI
 */

// Resource definitions for MCP
export const resourceDefinitions = ${JSON.stringify(
            resources.map(r => ({
                uri: r.uri,
                name: r.name,
                description: r.description,
                mimeType: r.mimeType,
            })),
            null,
            2
        )};

// Resource handler functions
export const resourceHandlers = {
${resources.map(r => `    '${r.uri}': async () => {
        ${r.handler}
    }`).join(',\n')}
};
`;
    }

    private generatePromptHandlers(prompts: MCPPrompt[]): string {
        return `/**
 * Prompt Handlers
 * Generated by KripTik AI
 */

// Prompt definitions for MCP
export const promptDefinitions = ${JSON.stringify(
            prompts.map(p => ({
                name: p.name,
                description: p.description,
                arguments: p.arguments,
            })),
            null,
            2
        )};

// Prompt handler functions
export const promptHandlers = {
${prompts.map(p => `    '${p.name}': (args) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: \`${p.template}\`,
                },
            },
        ],
    })`).join(',\n')}
};
`;
    }

    private generateReadme(config: MCPServerConfig): string {
        return `# ${config.name}

${config.description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

### With Claude Desktop

Add to your \`claude_desktop_config.json\`:

\`\`\`json
{
    "mcpServers": {
        "${config.name}": {
            "command": "node",
            "args": ["${process.cwd()}/index.js"]
        }
    }
}
\`\`\`

### Standalone

\`\`\`bash
npm start
\`\`\`

## Available Tools

${config.tools.map(t => `### ${t.name}
${t.description}

**Parameters:**
${Object.entries(t.inputSchema.properties).map(([name, prop]) =>
    `- \`${name}\` (${prop.type}): ${prop.description}`
).join('\n')}
`).join('\n')}

${config.resources.length > 0 ? `## Available Resources

${config.resources.map(r => `### ${r.name}
- URI: \`${r.uri}\`
- ${r.description}
`).join('\n')}` : ''}

${config.prompts.length > 0 ? `## Available Prompts

${config.prompts.map(p => `### ${p.name}
${p.description}
`).join('\n')}` : ''}

---
Generated by [KripTik AI](https://kriptik.ai)
`;
    }

    // ========================================================================
    // PRESETS
    // ========================================================================

    private getDatabasePreset(config: Record<string, string>): MCPServerConfig {
        return {
            name: 'database-mcp-server',
            version: '1.0.0',
            description: 'MCP server for database operations',
            tools: [
                {
                    name: 'query',
                    description: 'Execute a SQL query',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sql: { type: 'string', description: 'SQL query to execute' },
                            params: { type: 'array', description: 'Query parameters' },
                        },
                        required: ['sql'],
                    },
                    handler: `
                        const { sql, params } = args;
                        // Execute query using configured database
                        return await db.query(sql, params);
                    `,
                },
                {
                    name: 'list_tables',
                    description: 'List all tables in the database',
                    inputSchema: { type: 'object', properties: {}, required: [] },
                    handler: `
                        return await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
                    `,
                },
                {
                    name: 'describe_table',
                    description: 'Get schema of a table',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            table: { type: 'string', description: 'Table name' },
                        },
                        required: ['table'],
                    },
                    handler: `
                        const { table } = args;
                        return await db.query(\`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '\${table}'\`);
                    `,
                },
            ],
            resources: [
                {
                    uri: 'db://schema',
                    name: 'Database Schema',
                    description: 'Full database schema',
                    mimeType: 'application/json',
                    handler: `
                        const tables = await db.query("SELECT * FROM information_schema.tables WHERE table_schema = 'public'");
                        return { uri: 'db://schema', mimeType: 'application/json', text: JSON.stringify(tables) };
                    `,
                },
            ],
            prompts: [],
        };
    }

    private getStoragePreset(config: Record<string, string>): MCPServerConfig {
        return {
            name: 'storage-mcp-server',
            version: '1.0.0',
            description: 'MCP server for file storage operations',
            tools: [
                {
                    name: 'upload_file',
                    description: 'Upload a file to storage',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'File path' },
                            content: { type: 'string', description: 'File content (base64 for binary)' },
                        },
                        required: ['path', 'content'],
                    },
                    handler: `
                        const { path, content } = args;
                        await storage.upload(path, content);
                        return { success: true, path };
                    `,
                },
                {
                    name: 'download_file',
                    description: 'Download a file from storage',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'File path' },
                        },
                        required: ['path'],
                    },
                    handler: `
                        const { path } = args;
                        return await storage.download(path);
                    `,
                },
                {
                    name: 'list_files',
                    description: 'List files in a directory',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            prefix: { type: 'string', description: 'Path prefix' },
                        },
                        required: [],
                    },
                    handler: `
                        const { prefix = '' } = args;
                        return await storage.list(prefix);
                    `,
                },
                {
                    name: 'delete_file',
                    description: 'Delete a file from storage',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'File path' },
                        },
                        required: ['path'],
                    },
                    handler: `
                        const { path } = args;
                        await storage.delete(path);
                        return { success: true };
                    `,
                },
            ],
            resources: [],
            prompts: [],
        };
    }

    private getAuthPreset(config: Record<string, string>): MCPServerConfig {
        return {
            name: 'auth-mcp-server',
            version: '1.0.0',
            description: 'MCP server for authentication operations',
            tools: [
                {
                    name: 'get_user',
                    description: 'Get user by ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            userId: { type: 'string', description: 'User ID' },
                        },
                        required: ['userId'],
                    },
                    handler: `
                        const { userId } = args;
                        return await auth.getUser(userId);
                    `,
                },
                {
                    name: 'list_users',
                    description: 'List all users',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: { type: 'number', description: 'Max users to return' },
                            offset: { type: 'number', description: 'Pagination offset' },
                        },
                        required: [],
                    },
                    handler: `
                        const { limit = 50, offset = 0 } = args;
                        return await auth.listUsers({ limit, offset });
                    `,
                },
            ],
            resources: [],
            prompts: [],
        };
    }

    private getEmailPreset(config: Record<string, string>): MCPServerConfig {
        return {
            name: 'email-mcp-server',
            version: '1.0.0',
            description: 'MCP server for email operations',
            tools: [
                {
                    name: 'send_email',
                    description: 'Send an email',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            to: { type: 'string', description: 'Recipient email' },
                            subject: { type: 'string', description: 'Email subject' },
                            body: { type: 'string', description: 'Email body (HTML or text)' },
                        },
                        required: ['to', 'subject', 'body'],
                    },
                    handler: `
                        const { to, subject, body } = args;
                        return await email.send({ to, subject, html: body });
                    `,
                },
            ],
            resources: [],
            prompts: [
                {
                    name: 'compose_email',
                    description: 'Help compose a professional email',
                    arguments: [
                        { name: 'purpose', description: 'Purpose of the email', required: true },
                        { name: 'tone', description: 'Tone (formal, casual, friendly)', required: false },
                    ],
                    template: 'Help me compose a ${args.tone || "professional"} email for: ${args.purpose}',
                },
            ],
        };
    }

    private getPaymentsPreset(config: Record<string, string>): MCPServerConfig {
        return {
            name: 'payments-mcp-server',
            version: '1.0.0',
            description: 'MCP server for payment operations (Stripe)',
            tools: [
                {
                    name: 'create_checkout',
                    description: 'Create a Stripe checkout session',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            priceId: { type: 'string', description: 'Stripe Price ID' },
                            successUrl: { type: 'string', description: 'Success redirect URL' },
                            cancelUrl: { type: 'string', description: 'Cancel redirect URL' },
                        },
                        required: ['priceId', 'successUrl', 'cancelUrl'],
                    },
                    handler: `
                        const { priceId, successUrl, cancelUrl } = args;
                        const session = await stripe.checkout.sessions.create({
                            mode: 'payment',
                            line_items: [{ price: priceId, quantity: 1 }],
                            success_url: successUrl,
                            cancel_url: cancelUrl,
                        });
                        return { url: session.url };
                    `,
                },
                {
                    name: 'get_customer',
                    description: 'Get Stripe customer by ID',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            customerId: { type: 'string', description: 'Stripe Customer ID' },
                        },
                        required: ['customerId'],
                    },
                    handler: `
                        const { customerId } = args;
                        return await stripe.customers.retrieve(customerId);
                    `,
                },
            ],
            resources: [],
            prompts: [],
        };
    }

    private getPresetDependencies(preset: string): string[] {
        const deps: Record<string, string[]> = {
            database: ['npm init -y', 'npm install @modelcontextprotocol/sdk zod pg'],
            storage: ['npm init -y', 'npm install @modelcontextprotocol/sdk zod @aws-sdk/client-s3'],
            auth: ['npm init -y', 'npm install @modelcontextprotocol/sdk zod'],
            email: ['npm init -y', 'npm install @modelcontextprotocol/sdk zod @sendgrid/mail'],
            payments: ['npm init -y', 'npm install @modelcontextprotocol/sdk zod stripe'],
        };
        return deps[preset] || ['npm init -y', 'npm install @modelcontextprotocol/sdk zod'];
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    private inferServerName(sourceFile: string): string {
        const name = sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '') || 'app';
        return `${name}-mcp-server`;
    }

    private parseAnalysis(content: string): {
        tools: MCPTool[];
        resources: MCPResource[];
        prompts: MCPPrompt[];
    } {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {
            // Default empty
        }
        return { tools: [], resources: [], prompts: [] };
    }

    private parseTools(content: string): MCPTool[] {
        try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch {
            // Default empty
        }
        return [];
    }
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const MCP_ANALYSIS_SYSTEM_PROMPT = `You are an expert at creating MCP (Model Context Protocol) servers.
Your job is to analyze code and identify all functionality that should be exposed via MCP.

MCP allows AI assistants to interact with external tools and data. When analyzing code, identify:
1. Tools - Functions that perform actions
2. Resources - Data that can be read
3. Prompts - Reusable prompt templates

Be thorough and precise. Use snake_case for tool names.`;

// ============================================================================
// SINGLETON
// ============================================================================

let instance: MCPServerGeneratorService | null = null;

export function getMCPServerGeneratorService(): MCPServerGeneratorService {
    if (!instance) {
        instance = new MCPServerGeneratorService();
    }
    return instance;
}

