/**
 * MCP Client
 *
 * Connects to external MCP servers to give AI assistants access to
 * user's existing tools (Slack, GitHub, Salesforce, etc.)
 *
 * This is the CLIENT side - consuming MCP servers.
 */

import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface MCPServerConnection {
    id: string;
    name: string;
    description?: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    error?: string;
    tools?: MCPToolInfo[];
    resources?: MCPResourceInfo[];
    prompts?: MCPPromptInfo[];
}

export interface MCPToolInfo {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

export interface MCPResourceInfo {
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}

export interface MCPPromptInfo {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required?: boolean;
    }>;
}

export interface MCPCallResult {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}

// ============================================================================
// MCP CLIENT
// ============================================================================

export class MCPClient {
    private connections: Map<string, MCPServerConnection> = new Map();
    private processes: Map<string, ChildProcess> = new Map();
    private messageQueues: Map<string, Map<string, (response: unknown) => void>> = new Map();

    /**
     * Register an MCP server
     */
    registerServer(config: Omit<MCPServerConnection, 'id' | 'status'>): string {
        const id = uuidv4();
        const connection: MCPServerConnection = {
            ...config,
            id,
            status: 'disconnected',
        };
        this.connections.set(id, connection);
        return id;
    }

    /**
     * Connect to an MCP server
     */
    async connect(serverId: string): Promise<void> {
        const connection = this.connections.get(serverId);
        if (!connection) {
            throw new Error(`Server not found: ${serverId}`);
        }

        if (connection.status === 'connected') {
            return;
        }

        connection.status = 'connecting';

        try {
            // Spawn the MCP server process
            const childProcess = spawn(connection.command, connection.args, {
                env: { ...globalThis.process.env, ...connection.env },
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.processes.set(serverId, childProcess);
            this.messageQueues.set(serverId, new Map());

            // Handle stdout (JSON-RPC responses)
            let buffer = '';
            childProcess.stdout?.on('data', (data: Buffer) => {
                buffer += data.toString();

                // Try to parse complete JSON messages
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const message = JSON.parse(line);
                            this.handleResponse(serverId, message);
                        } catch {
                            // Invalid JSON, ignore
                        }
                    }
                }
            });

            childProcess.stderr?.on('data', (data: Buffer) => {
                console.error(`[MCP ${connection.name}]`, data.toString());
            });

            childProcess.on('error', (error: Error) => {
                connection.status = 'error';
                connection.error = error.message;
            });

            childProcess.on('close', (_code: number | null) => {
                connection.status = 'disconnected';
                this.processes.delete(serverId);
            });

            // Initialize the connection
            await this.initialize(serverId);

            // Fetch capabilities
            const [tools, resources, prompts] = await Promise.all([
                this.listTools(serverId),
                this.listResources(serverId),
                this.listPrompts(serverId),
            ]);

            connection.tools = tools;
            connection.resources = resources;
            connection.prompts = prompts;
            connection.status = 'connected';
        } catch (error) {
            connection.status = 'error';
            connection.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    /**
     * Disconnect from an MCP server
     */
    async disconnect(serverId: string): Promise<void> {
        const process = this.processes.get(serverId);
        if (process) {
            process.kill();
            this.processes.delete(serverId);
        }

        const connection = this.connections.get(serverId);
        if (connection) {
            connection.status = 'disconnected';
        }

        this.messageQueues.delete(serverId);
    }

    /**
     * Call a tool on an MCP server
     */
    async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPCallResult> {
        const connection = this.connections.get(serverId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Server not connected: ${serverId}`);
        }

        const response = await this.sendRequest(serverId, 'tools/call', {
            name: toolName,
            arguments: args,
        });

        return response as MCPCallResult;
    }

    /**
     * Read a resource from an MCP server
     */
    async readResource(serverId: string, uri: string): Promise<MCPCallResult> {
        const connection = this.connections.get(serverId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Server not connected: ${serverId}`);
        }

        const response = await this.sendRequest(serverId, 'resources/read', { uri });
        return response as MCPCallResult;
    }

    /**
     * Get a prompt from an MCP server
     */
    async getPrompt(serverId: string, promptName: string, args?: Record<string, string>): Promise<{
        messages: Array<{ role: string; content: { type: string; text: string } }>;
    }> {
        const connection = this.connections.get(serverId);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Server not connected: ${serverId}`);
        }

        const response = await this.sendRequest(serverId, 'prompts/get', {
            name: promptName,
            arguments: args,
        });

        return response as { messages: Array<{ role: string; content: { type: string; text: string } }> };
    }

    /**
     * List all registered servers
     */
    listServers(): MCPServerConnection[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get a specific server
     */
    getServer(serverId: string): MCPServerConnection | undefined {
        return this.connections.get(serverId);
    }

    /**
     * Get all tools from all connected servers
     */
    getAllTools(): Array<{ serverId: string; serverName: string; tool: MCPToolInfo }> {
        const tools: Array<{ serverId: string; serverName: string; tool: MCPToolInfo }> = [];

        for (const connection of this.connections.values()) {
            if (connection.status === 'connected' && connection.tools) {
                for (const tool of connection.tools) {
                    tools.push({
                        serverId: connection.id,
                        serverName: connection.name,
                        tool,
                    });
                }
            }
        }

        return tools;
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    private async initialize(serverId: string): Promise<void> {
        await this.sendRequest(serverId, 'initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {},
                resources: {},
                prompts: {},
            },
            clientInfo: {
                name: 'KripTik AI',
                version: '1.0.0',
            },
        });

        await this.sendNotification(serverId, 'notifications/initialized', {});
    }

    private async listTools(serverId: string): Promise<MCPToolInfo[]> {
        try {
            const response = await this.sendRequest(serverId, 'tools/list', {});
            return (response as { tools: MCPToolInfo[] }).tools || [];
        } catch {
            return [];
        }
    }

    private async listResources(serverId: string): Promise<MCPResourceInfo[]> {
        try {
            const response = await this.sendRequest(serverId, 'resources/list', {});
            return (response as { resources: MCPResourceInfo[] }).resources || [];
        } catch {
            return [];
        }
    }

    private async listPrompts(serverId: string): Promise<MCPPromptInfo[]> {
        try {
            const response = await this.sendRequest(serverId, 'prompts/list', {});
            return (response as { prompts: MCPPromptInfo[] }).prompts || [];
        } catch {
            return [];
        }
    }

    private sendRequest(serverId: string, method: string, params: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const process = this.processes.get(serverId);
            const queue = this.messageQueues.get(serverId);

            if (!process || !queue) {
                reject(new Error('Server not connected'));
                return;
            }

            const id = uuidv4();
            const message = {
                jsonrpc: '2.0',
                id,
                method,
                params,
            };

            queue.set(id, (response: unknown) => {
                const r = response as { result?: unknown; error?: { message: string } };
                if (r.error) {
                    reject(new Error(r.error.message));
                } else {
                    resolve(r.result);
                }
            });

            process.stdin?.write(JSON.stringify(message) + '\n');

            // Timeout after 30 seconds
            setTimeout(() => {
                if (queue.has(id)) {
                    queue.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    private sendNotification(serverId: string, method: string, params: unknown): void {
        const process = this.processes.get(serverId);
        if (!process) return;

        const message = {
            jsonrpc: '2.0',
            method,
            params,
        };

        process.stdin?.write(JSON.stringify(message) + '\n');
    }

    private handleResponse(serverId: string, message: { id?: string; result?: unknown; error?: unknown }): void {
        if (!message.id) return;

        const queue = this.messageQueues.get(serverId);
        const handler = queue?.get(message.id);

        if (handler) {
            queue?.delete(message.id);
            handler(message);
        }
    }
}

// ============================================================================
// PRESET MCP SERVER CONFIGS
// ============================================================================

export const MCP_SERVER_PRESETS: Record<string, Omit<MCPServerConnection, 'id' | 'status'>> = {
    'github': {
        name: 'GitHub',
        description: 'Access GitHub repositories, issues, and PRs',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}',
        },
    },
    'slack': {
        name: 'Slack',
        description: 'Send messages and read channels',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: {
            SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}',
        },
    },
    'filesystem': {
        name: 'Filesystem',
        description: 'Read and write local files',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
    },
    'postgres': {
        name: 'PostgreSQL',
        description: 'Query PostgreSQL databases',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: {
            POSTGRES_CONNECTION_STRING: '${DATABASE_URL}',
        },
    },
    'brave-search': {
        name: 'Brave Search',
        description: 'Web search using Brave',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
            BRAVE_API_KEY: '${BRAVE_API_KEY}',
        },
    },
};

// ============================================================================
// SINGLETON
// ============================================================================

let instance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
    if (!instance) {
        instance = new MCPClient();
    }
    return instance;
}

