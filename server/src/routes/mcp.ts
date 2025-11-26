/**
 * MCP (Model Context Protocol) API Routes
 *
 * Endpoints for MCP server generation and client management.
 */

import { Router, Request, Response } from 'express';
import { getMCPServerGeneratorService } from '../services/mcp/server-generator';
import { getMCPClient, MCP_SERVER_PRESETS } from '../services/mcp/client';
import { db } from '../db';
import { files as filesTable } from '../schema';
import { eq } from 'drizzle-orm';

const router = Router();

// ============================================================================
// MCP SERVER GENERATION
// ============================================================================

/**
 * POST /api/mcp/generate
 * Generate MCP server from source code
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const { sourceCode, sourceFile, serverName, includeResources, includePrompts } = req.body;

        if (!sourceCode || !sourceFile) {
            return res.status(400).json({ error: 'sourceCode and sourceFile are required' });
        }

        const service = getMCPServerGeneratorService();
        const result = await service.generateFromCode(sourceCode, sourceFile, {
            serverName,
            includeResources,
            includePrompts,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'MCP server generation failed',
        });
    }
});

/**
 * POST /api/mcp/generate/project/:projectId
 * Generate MCP server for a project
 */
router.post('/generate/project/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { serverName, includeResources, includePrompts } = req.body;

        // Get project files
        const projectFiles = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.projectId, projectId));

        if (projectFiles.length === 0) {
            return res.status(404).json({ error: 'No files found for project' });
        }

        // Find main entry point (index.ts, App.tsx, etc.)
        const mainFile = projectFiles.find(f =>
            f.path.includes('index.ts') ||
            f.path.includes('App.tsx') ||
            f.path.includes('main.ts')
        ) || projectFiles[0];

        // Combine relevant source files
        const relevantFiles = projectFiles.filter(f =>
            f.path.endsWith('.ts') ||
            f.path.endsWith('.tsx') ||
            f.path.endsWith('.js')
        );

        const combinedSource = relevantFiles
            .map(f => `// File: ${f.path}\n${f.content}`)
            .join('\n\n');

        const service = getMCPServerGeneratorService();
        const result = await service.generateFromCode(combinedSource, mainFile.path, {
            serverName: serverName || `${projectId}-mcp-server`,
            includeResources,
            includePrompts,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'MCP server generation failed',
        });
    }
});

/**
 * POST /api/mcp/generate/openapi
 * Generate MCP server from OpenAPI spec
 */
router.post('/generate/openapi', async (req: Request, res: Response) => {
    try {
        const { openApiSpec, serverName } = req.body;

        if (!openApiSpec) {
            return res.status(400).json({ error: 'openApiSpec is required' });
        }

        const service = getMCPServerGeneratorService();
        const result = await service.generateFromOpenAPI(openApiSpec, { serverName });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'MCP server generation failed',
        });
    }
});

/**
 * POST /api/mcp/generate/preset
 * Generate MCP server from preset
 */
router.post('/generate/preset', async (req: Request, res: Response) => {
    try {
        const { preset, config } = req.body;

        if (!preset) {
            return res.status(400).json({ error: 'preset is required' });
        }

        const validPresets = ['database', 'storage', 'auth', 'email', 'payments'];
        if (!validPresets.includes(preset)) {
            return res.status(400).json({
                error: `Invalid preset. Valid options: ${validPresets.join(', ')}`
            });
        }

        const service = getMCPServerGeneratorService();
        const result = await service.generatePreset(preset, config || {});

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'MCP server generation failed',
        });
    }
});

// ============================================================================
// MCP CLIENT MANAGEMENT
// ============================================================================

/**
 * GET /api/mcp/servers
 * List all registered MCP servers
 */
router.get('/servers', async (req: Request, res: Response) => {
    try {
        const client = getMCPClient();
        const servers = client.listServers();
        res.json({ servers });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to list servers',
        });
    }
});

/**
 * GET /api/mcp/servers/presets
 * List available MCP server presets
 */
router.get('/servers/presets', async (req: Request, res: Response) => {
    res.json({
        presets: Object.entries(MCP_SERVER_PRESETS).map(([id, config]) => ({
            id,
            name: config.name,
            description: config.description,
            command: config.command,
        })),
    });
});

/**
 * POST /api/mcp/servers
 * Register a new MCP server
 */
router.post('/servers', async (req: Request, res: Response) => {
    try {
        const { name, description, command, args, env } = req.body;

        if (!name || !command || !args) {
            return res.status(400).json({ error: 'name, command, and args are required' });
        }

        const client = getMCPClient();
        const serverId = client.registerServer({
            name,
            description,
            command,
            args,
            env,
        });

        res.json({ serverId, message: 'Server registered successfully' });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to register server',
        });
    }
});

/**
 * POST /api/mcp/servers/preset
 * Register an MCP server from preset
 */
router.post('/servers/preset', async (req: Request, res: Response) => {
    try {
        const { presetId, envOverrides } = req.body;

        const preset = MCP_SERVER_PRESETS[presetId];
        if (!preset) {
            return res.status(400).json({ error: `Unknown preset: ${presetId}` });
        }

        const client = getMCPClient();
        const serverId = client.registerServer({
            ...preset,
            env: { ...preset.env, ...envOverrides },
        });

        res.json({ serverId, message: `${preset.name} server registered successfully` });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to register server',
        });
    }
});

/**
 * POST /api/mcp/servers/:serverId/connect
 * Connect to an MCP server
 */
router.post('/servers/:serverId/connect', async (req: Request, res: Response) => {
    try {
        const { serverId } = req.params;

        const client = getMCPClient();
        await client.connect(serverId);

        const server = client.getServer(serverId);
        res.json({
            message: 'Connected successfully',
            server,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to connect',
        });
    }
});

/**
 * POST /api/mcp/servers/:serverId/disconnect
 * Disconnect from an MCP server
 */
router.post('/servers/:serverId/disconnect', async (req: Request, res: Response) => {
    try {
        const { serverId } = req.params;

        const client = getMCPClient();
        await client.disconnect(serverId);

        res.json({ message: 'Disconnected successfully' });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to disconnect',
        });
    }
});

/**
 * POST /api/mcp/servers/:serverId/tools/:toolName
 * Call a tool on an MCP server
 */
router.post('/servers/:serverId/tools/:toolName', async (req: Request, res: Response) => {
    try {
        const { serverId, toolName } = req.params;
        const args = req.body;

        const client = getMCPClient();
        const result = await client.callTool(serverId, toolName, args);

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Tool call failed',
        });
    }
});

/**
 * GET /api/mcp/servers/:serverId/resources/:uri
 * Read a resource from an MCP server
 */
router.get('/servers/:serverId/resources/*uri', async (req: Request, res: Response) => {
    try {
        const { serverId } = req.params;
        const uri = req.params.uri; // Everything after /resources/

        const client = getMCPClient();
        const result = await client.readResource(serverId, uri);

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Resource read failed',
        });
    }
});

/**
 * GET /api/mcp/tools
 * Get all tools from all connected MCP servers
 */
router.get('/tools', async (req: Request, res: Response) => {
    try {
        const client = getMCPClient();
        const tools = client.getAllTools();
        res.json({ tools });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get tools',
        });
    }
});

export default router;

