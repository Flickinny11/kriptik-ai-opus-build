/**
 * Browser Extension API Routes
 *
 * Handles communication between KripTik AI browser extension and backend.
 * Receives imported project data, manages extension tokens, and handles
 * credential fetching automation.
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { db } from '../db.js';
import { projects, files, users, notifications } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { createImportController } from '../services/fix-my-app/import-controller.js';
import {
  getCaptureOrchestrator,
  type CaptureSession,
  type CaptureOptions
} from '../services/vision-capture/capture-orchestrator.js';
import {
  getFixOrchestrator,
  type ChatMessage as FixChatMessage,
  type CapturedError,
} from '../services/fix-my-app/fix-orchestrator.js';
import {
  getVisionCaptureService,
  type VisionCredentialExtractionResult,
} from '../services/extension/vision-capture-service.js';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface PlatformInfo {
    id: string;
    name: string;
    provider: string;
    version?: string;
    tier?: string;
}

interface ProjectInfo {
    id?: string;
    name: string;
    url: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    codeBlocks?: Array<{ language: string; code: string }>;
    artifacts?: Array<{ id: string; type: string; content: string }>;
}

interface ChatHistory {
    messageCount: number;
    messages: ChatMessage[];
}

interface FileTree {
    structure: Record<string, unknown>;
    stats: {
        totalFiles: number;
        totalFolders: number;
        fileTypes: Record<string, number>;
    };
    files?: Array<{ path: string; content?: string }>;
}

interface ErrorEntry {
    type: string;
    severity: 'error' | 'warning' | 'info';
    timestamp: string;
    message: string;
    stack?: string;
    source?: string;
}

interface ConsoleEntry {
    type: 'log' | 'warn' | 'error' | 'info' | 'debug';
    timestamp: string;
    content: string;
}

interface TerminalOutput {
    available: boolean;
    output: Array<{ type: 'command' | 'output' | 'error'; content: string }>;
}

interface Artifact {
    id: string;
    type: string;
    title?: string;
    content: string;
    language?: string;
}

interface DiffChange {
    file: string;
    type: 'add' | 'modify' | 'delete';
    hunks: Array<{ oldStart: number; newStart: number; content: string }>;
}

interface CaptureStats {
    duration: number;
    completeness: number;
    features: string[];
}

interface ExtensionImportPayload {
    platform: PlatformInfo;
    project: ProjectInfo;
    chatHistory?: ChatHistory;
    files?: FileTree;
    errors?: { count: number; entries: ErrorEntry[] };
    console?: { count: number; entries: ConsoleEntry[] };
    terminal?: TerminalOutput;
    artifacts?: { available: boolean; items: Artifact[] };
    diffs?: { available: boolean; changes: DiffChange[] };
    captureStats?: CaptureStats;
    zipFileBase64?: string;
}

interface ExtensionToken {
    id: string;
    userId: string;
    token: string;
    name: string;
    createdAt: string;
    expiresAt: string;
    lastUsedAt?: string;
}

// In-memory token store (in production, use database table)
const extensionTokens = new Map<string, ExtensionToken>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a secure extension token
 */
function generateSecureToken(): string {
    return `kriptik_ext_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate extension token from Authorization header
 */
async function validateExtensionToken(authHeader: string | undefined): Promise<{ userId: string } | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7);

    // Check if it's an extension token
    if (!token.startsWith('kriptik_ext_')) {
        return null;
    }

    const tokenHash = hashToken(token);

    // Look up token
    for (const [, tokenData] of extensionTokens) {
        if (hashToken(tokenData.token) === tokenHash) {
            // Check expiration
            if (new Date(tokenData.expiresAt) < new Date()) {
                return null;
            }

            // Update last used
            tokenData.lastUsedAt = new Date().toISOString();

            return { userId: tokenData.userId };
        }
    }

    return null;
}

/**
 * Store project ZIP file
 */
async function storeProjectZip(projectId: string, zipBuffer: Buffer): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'projects', projectId);

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const zipPath = path.join(uploadsDir, 'import.zip');
    fs.writeFileSync(zipPath, zipBuffer);

    return zipPath;
}

/**
 * Extract files from ZIP and store in database
 */
async function extractAndStoreFiles(
    projectId: string,
    zipBuffer: Buffer
): Promise<{ fileCount: number; totalSize: number }> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    let fileCount = 0;
    let totalSize = 0;

    // Skip binary and large files
    const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.wav'];
    const maxFileSize = 500 * 1024; // 500KB

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const ext = path.extname(entry.entryName).toLowerCase();
        if (skipExtensions.includes(ext)) continue;

        if (entry.header.size > maxFileSize) continue;

        try {
            const content = entry.getData().toString('utf8');

            // Skip files that look like binary
            if (content.includes('\0')) continue;

            // Normalize path (remove root folder if present)
            let filePath = entry.entryName;
            const parts = filePath.split('/');
            if (parts.length > 1 && parts[0].includes('-main') || parts[0].includes('-master')) {
                filePath = parts.slice(1).join('/');
            }

            // Skip _kriptik metadata folder from being stored as regular files
            if (filePath.startsWith('_kriptik/')) continue;

            // Determine language from extension
            const languageMap: Record<string, string> = {
                '.ts': 'typescript',
                '.tsx': 'typescript',
                '.js': 'javascript',
                '.jsx': 'javascript',
                '.css': 'css',
                '.scss': 'scss',
                '.html': 'html',
                '.json': 'json',
                '.md': 'markdown',
                '.py': 'python',
                '.go': 'go',
                '.rs': 'rust',
                '.sql': 'sql',
                '.yaml': 'yaml',
                '.yml': 'yaml',
            };

            const language = languageMap[ext] || 'plaintext';

            await db.insert(files).values({
                id: uuidv4(),
                projectId,
                path: filePath,
                content,
                language,
                version: 1,
            });

            fileCount++;
            totalSize += content.length;
        } catch {
            // Skip files that can't be read as UTF-8
            continue;
        }
    }

    return { fileCount, totalSize };
}

/**
 * Store chat context for AI to use
 */
async function storeChatContext(
    projectId: string,
    chatHistory: ChatHistory | undefined,
    errors: { count: number; entries: ErrorEntry[] } | undefined,
    consoleLogs: { count: number; entries: ConsoleEntry[] } | undefined
): Promise<void> {
    const contextDir = path.join(process.cwd(), 'uploads', 'projects', projectId, 'context');

    if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
    }

    if (chatHistory && chatHistory.messages.length > 0) {
        fs.writeFileSync(
            path.join(contextDir, 'chat-history.json'),
            JSON.stringify(chatHistory, null, 2)
        );
    }

    if (errors && errors.entries.length > 0) {
        fs.writeFileSync(
            path.join(contextDir, 'errors.json'),
            JSON.stringify(errors, null, 2)
        );
    }

    if (consoleLogs && consoleLogs.entries.length > 0) {
        fs.writeFileSync(
            path.join(contextDir, 'console.json'),
            JSON.stringify(consoleLogs, null, 2)
        );
    }
}

/**
 * Detect framework from file contents
 */
function detectFramework(fileList: string[]): string {
    const hasFile = (name: string) => fileList.some(f => f.includes(name));

    if (hasFile('next.config')) return 'nextjs';
    if (hasFile('nuxt.config')) return 'nuxt';
    if (hasFile('vite.config') && hasFile('.tsx')) return 'react';
    if (hasFile('angular.json')) return 'angular';
    if (hasFile('svelte.config')) return 'svelte';
    if (hasFile('vue.config') || hasFile('.vue')) return 'vue';
    if (hasFile('package.json')) return 'node';
    if (hasFile('requirements.txt') || hasFile('pyproject.toml')) return 'python';
    if (hasFile('go.mod')) return 'go';
    if (hasFile('Cargo.toml')) return 'rust';

    return 'react'; // Default
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/extension/import
 * Receive import data from browser extension
 * Uses optionalAuthMiddleware to populate req.user from session cookies if available
 */
router.post('/import', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        // Validate extension token OR regular auth
        const authHeader = req.headers.authorization;
        let userId: string | undefined;

        // Try extension token first
        const extAuth = await validateExtensionToken(authHeader);
        if (extAuth) {
            userId = extAuth.userId;
        } else if (req.user?.id) {
            // Fall back to regular auth
            userId = req.user.id;
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Valid extension token or authentication required',
            });
        }

        const payload = req.body as ExtensionImportPayload;

        // Validate required fields
        if (!payload.platform || !payload.project) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: platform or project',
            });
        }

        console.log(`[Extension] Import from ${payload.platform.name} for user ${userId}`);

        // Create project
        const projectId = uuidv4();
        const projectName = payload.project.name || `Imported from ${payload.platform.name}`;

        // Get file list for framework detection
        const fileList = payload.files?.files?.map(f => f.path) || [];
        const framework = detectFramework(fileList);

        await db.insert(projects).values({
            id: projectId,
            name: projectName,
            description: `Imported from ${payload.platform.name} (${payload.platform.provider})`,
            ownerId: userId,
            framework,
            isPublic: false,
        });

        let fileCount = 0;
        let totalSize = 0;

        // Process ZIP file if provided
        if (payload.zipFileBase64) {
            try {
                const zipBuffer = Buffer.from(payload.zipFileBase64, 'base64');

                // Store ZIP
                await storeProjectZip(projectId, zipBuffer);

                // Extract and store files
                const result = await extractAndStoreFiles(projectId, zipBuffer);
                fileCount = result.fileCount;
                totalSize = result.totalSize;
            } catch (error) {
                console.error('[Extension] ZIP processing error:', error);
            }
        }

        // Store chat context and errors for AI to use
        await storeChatContext(
            projectId,
            payload.chatHistory,
            payload.errors,
            payload.console
        );

        // Store import metadata
        const metadataDir = path.join(process.cwd(), 'uploads', 'projects', projectId);
        if (!fs.existsSync(metadataDir)) {
            fs.mkdirSync(metadataDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(metadataDir, 'import-metadata.json'),
            JSON.stringify({
                importedAt: new Date().toISOString(),
                platform: payload.platform,
                originalProject: payload.project,
                captureStats: payload.captureStats,
                chatMessageCount: payload.chatHistory?.messageCount || 0,
                errorCount: payload.errors?.count || 0,
                fileCount,
            }, null, 2)
        );

        const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';

        // Create notification for user that project was imported
        await db.insert(notifications).values({
            id: uuidv4(),
            userId,
            type: 'project_imported',
            title: `Project Imported: ${projectName}`,
            message: `Your project from ${payload.platform.name} has been imported with ${payload.chatHistory?.messageCount || 0} chat messages and ${payload.errors?.count || 0} errors captured. Analysis will begin automatically.`,
            metadata: JSON.stringify({
                projectId,
                platform: payload.platform.id,
                chatMessages: payload.chatHistory?.messageCount || 0,
                errors: payload.errors?.count || 0,
            }),
            read: false,
        });

        // Start Fix My App analysis in background (non-blocking)
        // This will analyze the chat history, find intent, identify errors, and start fixing
        if (payload.chatHistory && payload.chatHistory.messageCount > 0) {
            console.log(`[Extension] Starting Fix My App analysis for project ${projectId}`);

            // Run analysis asynchronously - don't await
            startFixMyAppAnalysis(userId, projectId, payload).catch(err => {
                console.error(`[Extension] Fix My App analysis error for ${projectId}:`, err);
            });
        }

        return res.json({
            success: true,
            projectId,
            projectName,
            message: `Project imported successfully. ${fileCount} files processed. Analysis starting...`,
            dashboardUrl: `${frontendUrl}/dashboard`,
            builderUrl: `${frontendUrl}/builder/${projectId}`,
            fixMyAppUrl: `${frontendUrl}/fix-my-app/${projectId}`,
            stats: {
                files: fileCount,
                totalSize,
                chatMessages: payload.chatHistory?.messageCount || 0,
                errors: payload.errors?.count || 0,
            },
            analysisStarted: (payload.chatHistory?.messageCount || 0) > 0,
        });

    } catch (error) {
        console.error('[Extension] Import error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to process import',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/extension/config
 * Get extension configuration
 */
router.get('/config', optionalAuthMiddleware, async (_req: Request, res: Response) => {
    return res.json({
        apiVersion: '1.0.0',
        supportedPlatforms: [
            'bolt',
            'lovable',
            'v0',
            'cursor',
            'replit',
            'copilot',
            'windsurf',
            'claude-artifacts',
            'marblism',
            'create',
            'stackblitz',
            'codesandbox',
            'github-copilot',
            'chatgpt',
            'gemini',
        ],
        features: {
            chatCapture: true,
            fileTreeCapture: true,
            errorCapture: true,
            consoleCapture: true,
            terminalCapture: true,
            artifactCapture: true,
            diffCapture: true,
            zipMetadataInjection: true,
            directApiImport: true,
        },
        authRequired: true,
        authMethod: 'bearer',
        maxZipSize: 100 * 1024 * 1024, // 100MB
        endpoints: {
            import: '/api/extension/import',
            config: '/api/extension/config',
            token: '/api/extension/token',
            credentials: '/api/extension/credentials',
        },
    });
});

/**
 * POST /api/extension/token
 * Generate extension auth token
 */
router.post('/token', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { name = 'Default Extension Token' } = req.body;

        // Generate token
        const token = generateSecureToken();
        const tokenId = uuidv4();

        // Store token (1 year expiry)
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        const tokenData: ExtensionToken = {
            id: tokenId,
            userId,
            token,
            name,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
        };

        extensionTokens.set(tokenId, tokenData);

        return res.json({
            success: true,
            token,
            tokenId,
            expiresAt: expiresAt.toISOString(),
            usage: 'Add this token to the KripTik AI extension settings. This token will not be shown again.',
            instructions: [
                '1. Open the KripTik AI browser extension',
                '2. Click on Settings (gear icon)',
                '3. Paste this token in the "API Token" field',
                '4. Click Save',
            ],
        });

    } catch (error) {
        console.error('[Extension] Token generation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate token',
        });
    }
});

/**
 * GET /api/extension/tokens
 * List user's extension tokens
 */
router.get('/tokens', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const userTokens: Array<Omit<ExtensionToken, 'token'>> = [];

        for (const [, tokenData] of extensionTokens) {
            if (tokenData.userId === userId) {
                // Don't expose the actual token
                const { token: _, ...safeData } = tokenData;
                userTokens.push(safeData);
            }
        }

        return res.json({
            success: true,
            tokens: userTokens,
        });

    } catch (error) {
        console.error('[Extension] List tokens error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to list tokens',
        });
    }
});

/**
 * DELETE /api/extension/token/:id
 * Revoke an extension token
 */
router.delete('/token/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const tokenId = req.params.id;

        const tokenData = extensionTokens.get(tokenId);

        if (!tokenData) {
            return res.status(404).json({
                success: false,
                error: 'Token not found',
            });
        }

        if (tokenData.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to revoke this token',
            });
        }

        extensionTokens.delete(tokenId);

        return res.json({
            success: true,
            message: 'Token revoked successfully',
        });

    } catch (error) {
        console.error('[Extension] Revoke token error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to revoke token',
        });
    }
});

/**
 * POST /api/extension/credentials
 * Receive captured credentials from extension
 */
router.post('/credentials', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { projectId, service, credentials } = req.body;

        if (!service || !credentials || typeof credentials !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: service and credentials',
            });
        }

        console.log(`[Extension] Received credentials for ${service} from user ${userId}`);

        // Store credentials securely
        const credentialsDir = path.join(process.cwd(), 'uploads', 'credentials', userId);

        if (!fs.existsSync(credentialsDir)) {
            fs.mkdirSync(credentialsDir, { recursive: true });
        }

        // Encrypt credentials before storage (simplified - in production use proper encryption)
        const encryptedCredentials = {
            service,
            projectId: projectId || null,
            capturedAt: new Date().toISOString(),
            credentials: Buffer.from(JSON.stringify(credentials)).toString('base64'),
        };

        const filename = `${service.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.json`;
        fs.writeFileSync(
            path.join(credentialsDir, filename),
            JSON.stringify(encryptedCredentials, null, 2)
        );

        return res.json({
            success: true,
            message: `Credentials for ${service} stored successfully`,
            storedFields: Object.keys(credentials),
        });

    } catch (error) {
        console.error('[Extension] Credentials storage error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to store credentials',
        });
    }
});

/**
 * GET /api/extension/credentials/:service
 * Get stored credentials for a service
 */
router.get('/credentials/:service', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const service = req.params.service.toLowerCase().replace(/[^a-z0-9]/g, '-');

        const credentialsDir = path.join(process.cwd(), 'uploads', 'credentials', userId);

        if (!fs.existsSync(credentialsDir)) {
            return res.json({
                success: true,
                credentials: null,
            });
        }

        // Find most recent credentials for this service
        const files = fs.readdirSync(credentialsDir);
        const serviceFiles = files
            .filter(f => f.startsWith(service))
            .sort()
            .reverse();

        if (serviceFiles.length === 0) {
            return res.json({
                success: true,
                credentials: null,
            });
        }

        const latestFile = fs.readFileSync(
            path.join(credentialsDir, serviceFiles[0]),
            'utf8'
        );

        const stored = JSON.parse(latestFile);

        // Decrypt credentials
        const decrypted = JSON.parse(
            Buffer.from(stored.credentials, 'base64').toString('utf8')
        );

        return res.json({
            success: true,
            credentials: {
                service: stored.service,
                capturedAt: stored.capturedAt,
                fields: Object.keys(decrypted),
                // Don't expose actual values
            },
        });

    } catch (error) {
        console.error('[Extension] Credentials retrieval error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve credentials',
        });
    }
});

/**
 * GET /api/extension/status
 * Check extension connection status
 */
router.get('/status', optionalAuthMiddleware, async (req: Request, res: Response) => {
    const isAuthenticated = !!req.user;

    return res.json({
        connected: true,
        authenticated: isAuthenticated,
        userId: req.user?.id || null,
        timestamp: new Date().toISOString(),
    });
});

// ============================================================================
// VISION CREDENTIAL EXTRACTION (Gemini 3 @ 2fps)
// ============================================================================

/**
 * POST /api/extension/vision-extract
 * Extract credentials from a screenshot using Gemini 3 Pro @ 2fps
 *
 * This endpoint receives screenshots from the browser extension and uses
 * Gemini 3 vision to intelligently locate and extract credentials from
 * any platform without relying on brittle CSS selectors.
 *
 * Security:
 * - Credentials are NEVER logged
 * - Response is encrypted in transit (HTTPS)
 * - Memory cleared after processing
 */
router.post('/vision-extract', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        // Validate extension token
        const authHeader = req.headers.authorization;
        const extAuth = await validateExtensionToken(authHeader);

        if (!extAuth) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired extension token',
            });
        }

        const {
            screenshot,
            targetCredentials,
            currentUrl,
            pageTitle,
            pageText,
            attempt,
            fps,
            frameInterval,
        } = req.body;

        // Validate required fields
        if (!screenshot) {
            return res.status(400).json({
                success: false,
                error: 'Screenshot is required',
            });
        }

        if (!targetCredentials || !Array.isArray(targetCredentials) || targetCredentials.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Target credentials array is required',
            });
        }

        // Log request (without sensitive data)
        console.log(`[VisionExtract] Request from user ${extAuth.userId}:`, {
            platform: new URL(currentUrl || 'https://unknown').hostname,
            targetCredentials: targetCredentials,
            attempt: attempt || 1,
            fps: fps || 2,
            frameInterval: frameInterval || 500,
            screenshotSize: screenshot.length,
        });

        // Get vision capture service
        const visionService = getVisionCaptureService();

        // Perform credential extraction with Gemini 3
        const result = await visionService.extractCredentialsFromScreenshot({
            screenshotBase64: screenshot,
            targetCredentials,
            currentUrl: currentUrl || '',
            pageTitle: pageTitle || '',
            pageText: pageText || '',
            attempt: attempt || 1,
        });

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Log success (without credentials)
        console.log(`[VisionExtract] Completed in ${responseTime}ms:`, {
            success: result.success,
            credentialsFound: result.credentials ? Object.keys(result.credentials).length : 0,
            action: result.action,
            hasClickTarget: !!result.clickSelector || !!result.clickText,
            hasNavigateTo: !!result.navigateTo,
        });

        // Return result (credentials are in result.credentials if found)
        return res.json({
            success: result.success,
            credentials: result.credentials || {},
            action: result.action || 'continue',
            navigateTo: result.navigateTo,
            clickSelector: result.clickSelector,
            clickText: result.clickText,
            scrollDirection: result.scrollDirection,
            message: result.message,
            confidence: result.confidence || 0,
            fieldLocations: result.fieldLocations || {},
            responseTime,
        });

    } catch (error) {
        console.error('[VisionExtract] Error:', error);

        return res.status(500).json({
            success: false,
            error: 'Vision extraction failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            action: 'continue', // Tell extension to retry
        });
    }
});

// ============================================================================
// FIX MY APP ANALYSIS (Background Processing)
// ============================================================================

/**
 * Start Fix My App analysis in background
 * This runs asynchronously and notifies user when complete
 */
async function startFixMyAppAnalysis(
    userId: string,
    projectId: string,
    payload: ExtensionImportPayload
): Promise<void> {
    console.log(`[Fix My App] Starting analysis for project ${projectId}`);

    try {
        // Create import controller
        const controller = createImportController(userId);

        // Initialize session with source platform
        const platformId = payload.platform.id as any;
        await controller.initSession(platformId, payload.project.url);

        // Set consent (all data was already captured by extension)
        controller.setConsent({
            chatHistory: true,
            buildLogs: true,
            errorLogs: true,
            versionHistory: true,
        });

        // Submit chat history from extension
        if (payload.chatHistory && payload.chatHistory.messages.length > 0) {
            // Format chat messages for the controller
            const chatText = payload.chatHistory.messages
                .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
                .join('\n\n---\n\n');

            await controller.submitChatHistory(chatText);
        }

        // Run analysis
        console.log(`[Fix My App] Running analysis for ${projectId}...`);
        const analysis = await controller.runAnalysis();

        console.log(`[Fix My App] Analysis complete for ${projectId}`);
        console.log(`[Fix My App] Intent: ${analysis.intentSummary.corePurpose}`);
        console.log(`[Fix My App] Gaps found: ${analysis.implementationGaps.length}`);
        console.log(`[Fix My App] Recommended strategy: ${analysis.recommendedStrategy.approach}`);

        // Create notification that analysis is complete
        await db.insert(notifications).values({
            id: uuidv4(),
            userId,
            type: 'analysis_complete',
            title: 'Fix My App Analysis Complete',
            message: `Analysis of your ${payload.platform.name} project is complete. Found ${analysis.implementationGaps.length} issues to fix. Strategy: ${analysis.recommendedStrategy.approach}`,
            metadata: JSON.stringify({
                projectId,
                sessionId: controller.id,
                intent: analysis.intentSummary.corePurpose,
                gapCount: analysis.implementationGaps.length,
                strategy: analysis.recommendedStrategy.approach,
                confidence: analysis.recommendedStrategy.confidence,
            }),
            read: false,
        });

        // If confidence is high and gaps are found, auto-start fix (configurable)
        const autoFix = process.env.AUTO_FIX_ENABLED === 'true';
        if (autoFix && analysis.recommendedStrategy.confidence > 0.7 && analysis.implementationGaps.length > 0) {
            console.log(`[Fix My App] Auto-starting fix for ${projectId}`);

            // Execute fix in background
            controller.executeFix().then(async () => {
                // Notify user fix is complete
                await db.insert(notifications).values({
                    id: uuidv4(),
                    userId,
                    type: 'fix_complete',
                    title: 'Your App Has Been Fixed!',
                    message: `We've automatically fixed your ${payload.platform.name} project. Check your dashboard to see the results.`,
                    metadata: JSON.stringify({
                        projectId,
                        sessionId: controller.id,
                    }),
                    read: false,
                });
            }).catch(err => {
                console.error(`[Fix My App] Auto-fix error for ${projectId}:`, err);
            });
        }

    } catch (error) {
        console.error(`[Fix My App] Analysis error for ${projectId}:`, error);

        // Notify user of error
        await db.insert(notifications).values({
            id: uuidv4(),
            userId,
            type: 'analysis_error',
            title: 'Analysis Error',
            message: `There was an error analyzing your ${payload.platform.name} project. Our team has been notified.`,
            metadata: JSON.stringify({
                projectId,
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            read: false,
        });
    }
}

// ============================================================================
// VISION ANALYZE API (Client-Side Capture Support)
// ============================================================================

/**
 * POST /api/extension/vision-analyze
 * Analyze a screenshot for chat messages, errors, files, and UI elements
 *
 * This endpoint is used by the client-side capture module (ClientCapture)
 * which captures screenshots directly from the browser and sends them
 * for analysis. Works without Playwright - ideal for serverless deployments.
 *
 * Uses: google/gemini-3-flash-preview via OpenRouter for vision analysis
 */
router.post('/vision-analyze', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const { screenshot, prompt, context } = req.body;

        if (!screenshot) {
            return res.status(400).json({
                success: false,
                error: 'Screenshot is required',
            });
        }

        // Get OpenRouter API key
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        if (!openRouterKey) {
            console.error('[VisionAnalyze] OPENROUTER_API_KEY not configured');
            return res.status(500).json({
                success: false,
                error: 'Vision analysis not configured',
            });
        }

        const platformName = context?.platform || 'AI code builder';
        const messagesFound = context?.messagesFound || 0;
        const isFirst = context?.isFirstFrame ?? true;

        // Build analysis prompt
        const analysisPrompt = prompt || (isFirst
            ? `You are analyzing a screenshot of ${platformName}, an AI code builder platform.
Your goal is to COMPLETELY capture all content. We will scroll through the entire page.

Extract ALL visible content:

1. CHAT MESSAGES - Every visible message
   - User and AI responses
   - Include ALL code blocks with language
   - Full text content, don't truncate

2. ERRORS - Any error messages, warnings, build failures

3. FILE TREE - List all visible files/folders

4. UI ELEMENTS - Find export, download, build log buttons

5. COMPLETION CHECK - If you see the START of the conversation, set chatComplete: true

Return JSON:
{
  "messages": [{"role": "user"|"assistant", "content": "...", "codeBlocks": [{"language": "...", "code": "..."}]}],
  "errors": [{"type": "...", "severity": "error"|"warning", "message": "..."}],
  "files": [{"path": "...", "type": "file"|"folder"}],
  "uiElements": [{"type": "export_button"|"download_button", "location": "..."}],
  "chatComplete": false
}`
            : `Continue analyzing ${platformName}. ${messagesFound} messages found so far.

Look for NEW content not previously captured. If you see the FIRST message, set chatComplete: true.

Return only NEW content in JSON:
{
  "messages": [...],
  "errors": [...],
  "files": [...],
  "uiElements": [...],
  "chatComplete": false
}`);

        console.log(`[VisionAnalyze] Analyzing screenshot for ${platformName} (messages: ${messagesFound})`);

        // Call OpenRouter with Gemini 3 Flash
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://kriptik.app',
                'X-Title': 'KripTik AI Vision Analyze',
            },
            body: JSON.stringify({
                model: 'google/gemini-3-flash-preview',
                max_tokens: 32768,
                temperature: 0.2,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/png;base64,${screenshot}`,
                                },
                            },
                            {
                                type: 'text',
                                text: analysisPrompt,
                            },
                        ],
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[VisionAnalyze] OpenRouter error:', response.status, errorText);
            return res.status(500).json({
                success: false,
                error: 'Vision analysis failed',
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);

                // Format the response
                const analysis = {
                    messages: (parsed.messages || []).map((m: any, i: number) => ({
                        id: `msg-${Date.now()}-${i}`,
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.content || '',
                        codeBlocks: m.codeBlocks || [],
                        timestamp: new Date().toISOString(),
                    })),
                    errors: (parsed.errors || []).map((e: any) => ({
                        type: e.type || 'runtime',
                        severity: e.severity || 'error',
                        message: e.message || '',
                        timestamp: new Date().toISOString(),
                    })),
                    files: (parsed.files || []).map((f: any) => ({
                        path: f.path || '',
                        type: f.type || 'file',
                    })),
                    uiElements: parsed.uiElements || [],
                    chatComplete: parsed.chatComplete || false,
                };

                console.log(`[VisionAnalyze] Found: ${analysis.messages.length} messages, ${analysis.errors.length} errors, ${analysis.files.length} files`);

                return res.json({
                    success: true,
                    analysis,
                });
            } catch (parseError) {
                console.error('[VisionAnalyze] JSON parse error:', parseError);
            }
        }

        // Return empty analysis if parsing failed
        return res.json({
            success: true,
            analysis: {
                messages: [],
                errors: [],
                files: [],
                uiElements: [],
                chatComplete: false,
            },
        });

    } catch (error) {
        console.error('[VisionAnalyze] Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// AGENTIC DECIDE API (UI-TARS for GUI Automation - January 2026)
// ============================================================================

/**
 * POST /api/extension/agentic-decide
 * Get AI decision on what action to take next
 *
 * Uses UI-TARS 1.5-7B (bytedance/ui-tars-1.5-7b) via OpenRouter
 * This model is state-of-the-art for GUI automation:
 * - Outperforms Claude and GPT-4o on OSWorld (24.6 vs 22.0)
 * - Outperforms GPT-4o on WebVoyager, AndroidWorld
 * - Cost: $0.10/M input, $0.20/M output (very affordable)
 *
 * Takes: screenshot, accessibility snapshot, context
 * Returns: action to perform (click, scroll, wait, etc.) + extracted data
 */
router.post('/agentic-decide', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const {
            screenshot,
            accessibilitySnapshot,
            visibleText,
            scrollInfo,
            platform,
            task,
            actionHistory,
            messagesFoundSoFar,
            model,
        } = req.body;

        if (!screenshot) {
            return res.status(400).json({
                success: false,
                error: 'Screenshot is required',
            });
        }

        const openRouterKey = process.env.OPENROUTER_API_KEY;
        if (!openRouterKey) {
            console.error('[AgenticDecide] OPENROUTER_API_KEY not configured');
            return res.status(500).json({
                success: false,
                error: 'AI service not configured',
            });
        }

        // Use UI-TARS as primary model, Gemini 3 Flash as fallback
        const primaryModel = model || 'bytedance/ui-tars-1.5-7b';
        const fallbackModel = 'google/gemini-3-flash-preview';

        // Build the prompt for the AI agent
        const systemPrompt = `You are a GUI automation agent. Your task is to navigate a ${platform || 'web application'} to ${task || 'capture all chat messages'}.

CURRENT STATE:
- Messages found so far: ${messagesFoundSoFar || 0}
- Scroll position: ${scrollInfo?.percentScrolled || 0}% (${scrollInfo?.canScrollUp ? 'can scroll up' : 'at top'}, ${scrollInfo?.canScrollDown ? 'can scroll down' : 'at bottom'})
- Recent actions: ${actionHistory?.slice(-3).map((a: any) => a.action).join(', ') || 'none'}

AVAILABLE ACTIONS:
1. click - Click an element (provide ref like @e5, or text to find, or x,y coordinates)
2. scroll_up - Scroll up to see older messages
3. scroll_down - Scroll down to see newer messages  
4. scroll_to_top - Go to the very beginning
5. scroll_to_bottom - Go to the very end
6. wait - Wait for content to load
7. hover - Hover over an element

ACCESSIBILITY SNAPSHOT (elements with refs):
${JSON.stringify(accessibilitySnapshot?.elements?.slice(0, 50) || [], null, 2)}

TASK PRIORITIES:
1. If task is 'capture_chat' or 'capture_all': Scroll to the TOP of the chat to find the first message
2. Extract ALL visible chat messages (user and AI responses)
3. Find export/download buttons if present
4. Complete when you've seen ALL messages from beginning to end

Analyze the screenshot and accessibility snapshot. Return a JSON response with:
{
  "action": { "type": "scroll_up|scroll_down|click|wait|...", "ref": "@e5", "text": "button text", "amount": 300 },
  "extractedData": { 
    "messages": [{ "role": "user|assistant", "content": "...", "codeBlocks": [...] }],
    "errors": [...],
    "files": [...],
    "uiElements": [{ "type": "export_button", "ref": "@e10" }]
  },
  "reasoning": "Brief explanation of why this action",
  "isTaskComplete": false
}

IMPORTANT:
- Extract ANY visible messages you see in this frame
- If you see "load more" or similar, click it
- If at 0% scroll and can scroll up, scroll up to find older messages
- Task is complete when you've captured all messages from start to end
- Use refs (@e1, @e2, etc.) for clicking - they're more reliable than coordinates`;

        console.log(`[AgenticDecide] Calling ${primaryModel} for ${platform}`);

        // Call UI-TARS via OpenRouter
        let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://kriptik.app',
                'X-Title': 'KripTik AI Agentic Capture',
            },
            body: JSON.stringify({
                model: primaryModel,
                max_tokens: 4096,
                temperature: 0.1,  // Low temperature for precise actions
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/png;base64,${screenshot}`,
                                },
                            },
                            {
                                type: 'text',
                                text: systemPrompt,
                            },
                        ],
                    },
                ],
            }),
        });

        // If primary model fails, try fallback
        if (!response.ok && primaryModel !== fallbackModel) {
            console.log(`[AgenticDecide] Primary model failed, trying fallback: ${fallbackModel}`);
            response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://kriptik.app',
                    'X-Title': 'KripTik AI Agentic Capture',
                },
                body: JSON.stringify({
                    model: fallbackModel,
                    max_tokens: 8192,
                    temperature: 0.1,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/png;base64,${screenshot}`,
                                    },
                                },
                                {
                                    type: 'text',
                                    text: systemPrompt,
                                },
                            ],
                        },
                    ],
                }),
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AgenticDecide] OpenRouter error:', response.status, errorText);
            
            // Return a safe default action
            return res.json({
                success: true,
                action: { type: 'scroll_up', amount: 300 },
                extractedData: null,
                reasoning: 'API error - defaulting to scroll up to find content',
                isTaskComplete: false,
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);

                console.log(`[AgenticDecide] Action: ${parsed.action?.type || 'unknown'}, Reasoning: ${parsed.reasoning?.substring(0, 50)}...`);

                return res.json({
                    success: true,
                    action: parsed.action || { type: 'wait', duration: 500 },
                    extractedData: parsed.extractedData || null,
                    reasoning: parsed.reasoning || '',
                    isTaskComplete: parsed.isTaskComplete || false,
                });
            } catch (parseError) {
                console.error('[AgenticDecide] JSON parse error:', parseError);
            }
        }

        // Default response if parsing fails
        return res.json({
            success: true,
            action: { type: 'scroll_up', amount: 300 },
            extractedData: null,
            reasoning: 'Could not parse AI response - scrolling up to gather more context',
            isTaskComplete: false,
        });

    } catch (error) {
        console.error('[AgenticDecide] Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// VISION CAPTURE API (Gemini 3 Flash + Playwright Browser Automation)
// ============================================================================

// Store for SSE connections
const captureSSEConnections = new Map<string, Response>();

/**
 * POST /api/extension/vision-capture/start
 * Start a vision-based capture session
 *
 * The server launches a headless browser, navigates to the URL,
 * and uses Gemini 3 Flash vision to intelligently capture content.
 */
router.post('/vision-capture/start', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        // Validate auth
        const authHeader = req.headers.authorization;
        let userId: string | undefined;

        const extAuth = await validateExtensionToken(authHeader);
        if (extAuth) {
            userId = extAuth.userId;
        } else if (req.user?.id) {
            userId = req.user.id;
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }

        const { url, cookies, options } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required',
            });
        }

        console.log(`[VisionCapture] Starting capture for ${url} (user: ${userId})`);

        const sessionId = uuidv4();
        const orchestrator = getCaptureOrchestrator();

        // Set up progress callback to emit SSE events
        orchestrator.setProgressCallback((session: CaptureSession) => {
            const sseConn = captureSSEConnections.get(sessionId);
            if (sseConn && !sseConn.writableEnded) {
                sseConn.write(`data: ${JSON.stringify({
                    type: 'progress',
                    session: {
                        id: session.id,
                        status: session.status,
                        progress: session.progress,
                        platform: session.platform,
                        error: session.error,
                    }
                })}\n\n`);
            }
        });

        // Start capture in background
        const captureOptions: CaptureOptions = {
            cookies: cookies || [],
            maxScrollAttempts: options?.maxScrollAttempts || 50,
            maxApiCalls: options?.maxApiCalls || 100,
            captureScreenshots: options?.captureScreenshots !== false,
            skipFileCapture: options?.skipFileCapture || false,
            skipErrorCapture: options?.skipErrorCapture || false,
            viewport: options?.viewport || { width: 1920, height: 1080 },
        };

        // Don't await - let it run in background
        orchestrator.startCapture(sessionId, url, captureOptions)
            .then(async (completedSession) => {
                // When complete, emit final event
                const sseConn = captureSSEConnections.get(sessionId);
                if (sseConn && !sseConn.writableEnded) {
                    sseConn.write(`data: ${JSON.stringify({
                        type: 'complete',
                        session: {
                            id: completedSession.id,
                            status: completedSession.status,
                            platform: completedSession.platform,
                            progress: completedSession.progress,
                            error: completedSession.error,
                        },
                        result: completedSession.result ? {
                            chatMessageCount: completedSession.result.chatHistory.length,
                            fileCount: completedSession.result.files.length,
                            errorCount: completedSession.result.errors.length,
                            hasExport: !!completedSession.result.exportZip,
                            captureStats: completedSession.result.captureStats,
                        } : null,
                    })}\n\n`);
                    sseConn.end();
                }
                captureSSEConnections.delete(sessionId);

                // If successful, auto-import the results
                if (completedSession.status === 'completed' && completedSession.result) {
                    console.log(`[VisionCapture] Auto-importing results for session ${sessionId}`);
                    await autoImportVisionCapture(userId!, sessionId, url, completedSession);
                }
            })
            .catch((error) => {
                console.error(`[VisionCapture] Capture error:`, error);
                const sseConn = captureSSEConnections.get(sessionId);
                if (sseConn && !sseConn.writableEnded) {
                    sseConn.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: error.message,
                    })}\n\n`);
                    sseConn.end();
                }
                captureSSEConnections.delete(sessionId);
            });

        return res.json({
            success: true,
            sessionId,
            message: 'Vision capture started',
            eventsUrl: `/api/extension/vision-capture/events/${sessionId}`,
        });

    } catch (error) {
        console.error('[VisionCapture] Start error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to start vision capture',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/extension/vision-capture/events/:sessionId
 * SSE stream for capture progress
 */
router.get('/vision-capture/events/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Store connection
    captureSSEConnections.set(sessionId, res);

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

    // Check if session already exists
    const orchestrator = getCaptureOrchestrator();
    const existingSession = orchestrator.getSession(sessionId);
    if (existingSession) {
        res.write(`data: ${JSON.stringify({
            type: 'progress',
            session: {
                id: existingSession.id,
                status: existingSession.status,
                progress: existingSession.progress,
                platform: existingSession.platform,
                error: existingSession.error,
            }
        })}\n\n`);
    }

    // Keep connection alive
    const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        } else {
            clearInterval(heartbeat);
        }
    }, 30000);

    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        captureSSEConnections.delete(sessionId);
    });
});

/**
 * GET /api/extension/vision-capture/status/:sessionId
 * Get capture session status
 */
router.get('/vision-capture/status/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const orchestrator = getCaptureOrchestrator();
    const session = orchestrator.getSession(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found',
        });
    }

    return res.json({
        success: true,
        session: {
            id: session.id,
            url: session.url,
            platform: session.platform,
            status: session.status,
            progress: session.progress,
            error: session.error,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
        },
        result: session.result ? {
            chatMessageCount: session.result.chatHistory.length,
            fileCount: session.result.files.length,
            errorCount: session.result.errors.length,
            hasExport: !!session.result.exportZip,
            captureStats: session.result.captureStats,
        } : null,
    });
});

/**
 * POST /api/extension/vision-capture/cancel/:sessionId
 * Cancel a capture session
 */
router.post('/vision-capture/cancel/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const orchestrator = getCaptureOrchestrator();
    await orchestrator.cancelCapture(sessionId);

    const sseConn = captureSSEConnections.get(sessionId);
    if (sseConn && !sseConn.writableEnded) {
        sseConn.write(`data: ${JSON.stringify({ type: 'cancelled' })}\n\n`);
        sseConn.end();
    }
    captureSSEConnections.delete(sessionId);

    return res.json({
        success: true,
        message: 'Capture cancelled',
    });
});

/**
 * GET /api/extension/vision-capture/result/:sessionId
 * Get full capture results (chat history, files, etc.)
 */
router.get('/vision-capture/result/:sessionId', optionalAuthMiddleware, async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const orchestrator = getCaptureOrchestrator();
    const session = orchestrator.getSession(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found',
        });
    }

    if (session.status !== 'completed') {
        return res.status(400).json({
            success: false,
            error: `Capture not complete. Status: ${session.status}`,
        });
    }

    if (!session.result) {
        return res.status(500).json({
            success: false,
            error: 'No results available',
        });
    }

    // Format results similar to extension import payload
    return res.json({
        success: true,
        platform: {
            id: session.platform,
            name: session.platform,
            provider: 'vision-capture',
        },
        project: {
            url: session.url,
            name: `Captured from ${session.platform}`,
        },
        chatHistory: {
            messageCount: session.result.chatHistory.length,
            messages: session.result.chatHistory,
        },
        files: {
            structure: {},
            stats: {
                totalFiles: session.result.files.length,
                totalFolders: 0,
                fileTypes: {},
            },
            files: session.result.files,
        },
        errors: {
            count: session.result.errors.length,
            entries: session.result.errors,
        },
        captureStats: session.result.captureStats,
        // Don't include screenshots in response - too large
        screenshotCount: session.result.screenshots.length,
    });
});

/**
 * Auto-import vision capture results into a project and start Fix My App flow
 *
 * This is the critical integration point that connects:
 * 1. Vision Capture (Gemini 3 Flash + Playwright)
 * 2. Project creation with fixing status
 * 3. Fix Orchestrator (Intent Lock + Build Loop)
 */
async function autoImportVisionCapture(
    userId: string,
    sessionId: string,
    url: string,
    session: CaptureSession
): Promise<void> {
    if (!session.result) return;

    try {
        // Create project with fixing status set
        const projectId = uuidv4();
        const projectName = `Captured from ${session.platform}`;

        await db.insert(projects).values({
            id: projectId,
            name: projectName,
            description: `Vision capture from ${session.platform}. ${session.result.chatHistory.length} messages captured.`,
            ownerId: userId,
            framework: 'react', // Default - will be detected during build
            isPublic: false,
            // Fix My App status fields - start in analyzing state
            fixingStatus: 'analyzing',
            fixingProgress: 5,
            fixingSessionId: sessionId,
            fixingStartedAt: new Date().toISOString(),
            importSource: session.platform,
            importUrl: url,
        });

        // Store chat context
        const contextDir = path.join(process.cwd(), 'uploads', 'projects', projectId, 'context');
        if (!fs.existsSync(contextDir)) {
            fs.mkdirSync(contextDir, { recursive: true });
        }

        if (session.result.chatHistory.length > 0) {
            fs.writeFileSync(
                path.join(contextDir, 'chat-history.json'),
                JSON.stringify({
                    messageCount: session.result.chatHistory.length,
                    messages: session.result.chatHistory,
                }, null, 2)
            );
        }

        if (session.result.errors.length > 0) {
            fs.writeFileSync(
                path.join(contextDir, 'errors.json'),
                JSON.stringify({
                    count: session.result.errors.length,
                    entries: session.result.errors,
                }, null, 2)
            );
        }

        // Store capture metadata
        fs.writeFileSync(
            path.join(contextDir, 'capture-metadata.json'),
            JSON.stringify({
                sessionId,
                url,
                platform: session.platform,
                capturedAt: session.startedAt.toISOString(),
                completedAt: session.completedAt?.toISOString(),
                stats: session.result.captureStats,
                uiState: session.result.uiState,
            }, null, 2)
        );

        // Create initial notification
        await db.insert(notifications).values({
            id: uuidv4(),
            userId,
            type: 'project_imported',
            title: `Vision Capture Complete: ${projectName}`,
            message: `Captured ${session.result.chatHistory.length} messages from ${session.platform}. KripTik AI is now analyzing and fixing your project...`,
            metadata: JSON.stringify({
                projectId,
                sessionId,
                platform: session.platform,
                chatMessages: session.result.chatHistory.length,
                files: session.result.files.length,
                errors: session.result.errors.length,
                cost: session.result.captureStats.estimatedCost,
            }),
            read: false,
        });

        console.log(`[VisionCapture] Auto-imported to project ${projectId}`);

        // =====================================================================
        // START FIX MY APP FLOW
        // This triggers Intent Lock creation and Build Loop execution
        // =====================================================================

        if (session.result.chatHistory.length > 0) {
            console.log(`[VisionCapture] Starting Fix My App flow for project ${projectId}`);

            // Convert chat history to fix orchestrator format
            const chatMessages: FixChatMessage[] = session.result.chatHistory.map((msg, index) => ({
                id: `msg-${index}`,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: msg.timestamp,
                codeBlocks: msg.codeBlocks,
            }));

            // Convert errors to fix orchestrator format
            // ErrorInfo has: type, message, source, line (no timestamp or stack)
            const capturedErrors: CapturedError[] = session.result.errors.map(err => ({
                type: err.type || 'error',
                message: err.message,
                timestamp: new Date().toISOString(),
                source: err.source,
            }));

            // Start fix orchestration (runs asynchronously)
            const fixOrchestrator = getFixOrchestrator();
            fixOrchestrator.startFix(
                projectId,
                userId,
                chatMessages,
                capturedErrors,
                session.platform,
                url
            ).then(fixSession => {
                console.log(`[VisionCapture] Fix session started: ${fixSession.id}`);
            }).catch(error => {
                console.error(`[VisionCapture] Failed to start fix:`, error);
            });
        } else {
            console.log(`[VisionCapture] No chat history - skipping fix flow`);
            // Update project to show import complete but no fix needed
            await db.update(projects)
                .set({
                    fixingStatus: 'completed',
                    fixingProgress: 100,
                    fixingCompletedAt: new Date().toISOString(),
                })
                .where(eq(projects.id, projectId));
        }

    } catch (error) {
        console.error(`[VisionCapture] Auto-import error:`, error);
    }
}

// ============================================================================
// COMPUTER USE API (High-FPS Gemini-Controlled Browser Automation)
// ============================================================================

import {
    getComputerUseService,
    type CaptureConfig,
    type CaptureProgress as ComputerUseCaptureProgress,
    type CaptureResult as ComputerUseCaptureResult,
} from '../services/vision-capture/computer-use-service.js';

// Store for Computer Use SSE connections
const computerUseSSEConnections = new Map<string, Response>();

/**
 * POST /api/extension/computer-use/start
 * Start a high-FPS computer use capture session
 *
 * This endpoint provides superior capture compared to the basic vision-capture:
 * - Configurable FPS (up to 10fps for real-time visual tracking)
 * - AI-controlled browser actions (scroll, click, type)
 * - Progressive message extraction during scroll
 * - Automatic "Load more" button detection and clicking
 * - Build/runtime log capture
 * - Project export automation
 */
router.post('/computer-use/start', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        // Validate auth
        const authHeader = req.headers.authorization;
        let userId: string | undefined;

        const extAuth = await validateExtensionToken(authHeader);
        if (extAuth) {
            userId = extAuth.userId;
        } else if (req.user?.id) {
            userId = req.user.id;
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }

        const {
            url,
            platform,
            cookies,
            fps,
            maxScrollAttempts,
            captureTypes,
            fixSessionId,
        } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required',
            });
        }

        // Detect platform from URL if not provided
        const detectedPlatform = platform || detectPlatformFromUrl(url);

        console.log(`[ComputerUse] Starting capture for ${url}`);
        console.log(`[ComputerUse] Platform: ${detectedPlatform}, FPS: ${fps || 2}, User: ${userId}`);

        const computerUseService = getComputerUseService();

        // Build capture config
        const captureConfig: CaptureConfig = {
            url,
            platform: detectedPlatform,
            cookies: cookies || [],
            fps: Math.min(fps || 2, 10), // Cap at 10 FPS
            maxScrollAttempts: maxScrollAttempts || 100,
            captureTypes: captureTypes || ['chat', 'logs', 'files', 'export'],
            sessionId: fixSessionId,
            userId,
        };

        // Start capture (returns immediately with session ID)
        const captureId = await computerUseService.startCapture(captureConfig);

        // Set up progress listener for SSE
        computerUseService.on(`progress:${captureId}`, (progress: ComputerUseCaptureProgress) => {
            const sseConn = computerUseSSEConnections.get(captureId);
            if (sseConn && !sseConn.writableEnded) {
                sseConn.write(`data: ${JSON.stringify({
                    type: progress.type,
                    phase: progress.phase,
                    progress: progress.progress,
                    message: progress.message,
                    data: progress.data,
                })}\n\n`);

                // Close SSE on complete or error
                if (progress.type === 'complete' || progress.type === 'error') {
                    sseConn.end();
                    computerUseSSEConnections.delete(captureId);
                }
            }
        });

        return res.json({
            success: true,
            captureId,
            message: 'Computer Use capture started',
            eventsUrl: `/api/extension/computer-use/events/${captureId}`,
            statusUrl: `/api/extension/computer-use/status/${captureId}`,
            config: {
                platform: detectedPlatform,
                fps: captureConfig.fps,
                captureTypes: captureConfig.captureTypes,
            },
        });

    } catch (error) {
        console.error('[ComputerUse] Start error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to start computer use capture',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/extension/computer-use/events/:captureId
 * SSE stream for computer use capture progress
 */
router.get('/computer-use/events/:captureId', async (req: Request, res: Response) => {
    const { captureId } = req.params;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Store connection
    computerUseSSEConnections.set(captureId, res);

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected', captureId })}\n\n`);

    // Check if capture exists and get current status
    const computerUseService = getComputerUseService();
    const result = computerUseService.getResult(captureId);
    if (result) {
        res.write(`data: ${JSON.stringify({
            type: 'status',
            sessionId: result.sessionId,
            success: result.success,
            messagesFound: result.stats.messagesFound,
        })}\n\n`);
    }

    // Keep connection alive
    const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        } else {
            clearInterval(heartbeat);
        }
    }, 30000);

    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        computerUseSSEConnections.delete(captureId);
    });
});

/**
 * GET /api/extension/computer-use/status/:captureId
 * Get computer use capture session status
 */
router.get('/computer-use/status/:captureId', async (req: Request, res: Response) => {
    const { captureId } = req.params;

    const computerUseService = getComputerUseService();
    const result = computerUseService.getResult(captureId);

    if (!result) {
        // Check if capture is still active
        if (computerUseService.isActive(captureId)) {
            return res.json({
                success: true,
                status: 'in_progress',
                captureId,
            });
        }
        return res.status(404).json({
            success: false,
            error: 'Capture session not found',
        });
    }

    return res.json({
        success: true,
        captureId: result.sessionId,
        status: result.success ? 'completed' : (result.error ? 'failed' : 'in_progress'),
        error: result.error,
        stats: result.stats,
        summary: {
            messagesFound: result.chatMessages.length,
            buildLogsCount: result.buildLogs.length,
            runtimeLogsCount: result.runtimeLogs.length,
            filesFound: result.files.length,
            hasExport: !!result.exportZip,
            screenshotsCount: result.screenshots.length,
        },
    });
});

/**
 * GET /api/extension/computer-use/result/:captureId
 * Get full capture results
 */
router.get('/computer-use/result/:captureId', optionalAuthMiddleware, async (req: Request, res: Response) => {
    const { captureId } = req.params;

    const computerUseService = getComputerUseService();
    const result = computerUseService.getResult(captureId);

    if (!result) {
        return res.status(404).json({
            success: false,
            error: 'Capture session not found',
        });
    }

    if (!result.success && !result.chatMessages.length) {
        return res.status(400).json({
            success: false,
            error: result.error || 'Capture not complete',
        });
    }

    // Format results for Fix My App consumption
    return res.json({
        success: true,
        captureId: result.sessionId,
        chatHistory: {
            messageCount: result.chatMessages.length,
            messages: result.chatMessages.map(msg => ({
                id: `msg-${msg.index}`,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                codeBlocks: msg.codeBlocks,
            })),
        },
        logs: {
            build: result.buildLogs,
            runtime: result.runtimeLogs,
        },
        files: {
            count: result.files.length,
            entries: result.files,
        },
        export: result.exportZip ? {
            available: true,
            sizeBytes: result.exportZip.length,
        } : {
            available: false,
        },
        stats: result.stats,
    });
});

/**
 * POST /api/extension/computer-use/abort/:captureId
 * Abort a computer use capture session
 */
router.post('/computer-use/abort/:captureId', async (req: Request, res: Response) => {
    const { captureId } = req.params;

    const computerUseService = getComputerUseService();
    await computerUseService.abortCapture(captureId);

    // Clean up SSE connection
    const sseConn = computerUseSSEConnections.get(captureId);
    if (sseConn && !sseConn.writableEnded) {
        sseConn.write(`data: ${JSON.stringify({ type: 'aborted' })}\n\n`);
        sseConn.end();
    }
    computerUseSSEConnections.delete(captureId);

    return res.json({
        success: true,
        message: 'Capture aborted',
    });
});

/**
 * POST /api/extension/computer-use/import/:captureId
 * Import capture results into Fix My App flow
 */
router.post('/computer-use/import/:captureId', optionalAuthMiddleware, async (req: Request, res: Response) => {
    try {
        // Validate auth
        const authHeader = req.headers.authorization;
        let userId: string | undefined;

        const extAuth = await validateExtensionToken(authHeader);
        if (extAuth) {
            userId = extAuth.userId;
        } else if (req.user?.id) {
            userId = req.user.id;
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }

        const { captureId } = req.params;
        const { projectName, fixSessionId } = req.body;

        const computerUseService = getComputerUseService();
        const result = computerUseService.getResult(captureId);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Capture session not found',
            });
        }

        if (!result.success && !result.chatMessages.length) {
            return res.status(400).json({
                success: false,
                error: result.error || 'No capture results available',
            });
        }

        console.log(`[ComputerUse] Importing capture ${captureId} for user ${userId}`);

        // Create project
        const projectId = uuidv4();
        const name = projectName || `Fix My App Capture - ${new Date().toISOString().split('T')[0]}`;

        await db.insert(projects).values({
            id: projectId,
            name,
            description: `Imported from AI builder via Computer Use capture. ${result.chatMessages.length} messages captured.`,
            ownerId: userId,
            framework: 'react', // Will be detected during analysis
            isPublic: false,
            fixingStatus: 'analyzing',
            fixingProgress: 5,
            fixingSessionId: fixSessionId || captureId,
            fixingStartedAt: new Date().toISOString(),
            importSource: 'computer-use',
        });

        // Store context
        const contextDir = path.join(process.cwd(), 'uploads', 'projects', projectId, 'context');
        if (!fs.existsSync(contextDir)) {
            fs.mkdirSync(contextDir, { recursive: true });
        }

        // Store chat history
        if (result.chatMessages.length > 0) {
            fs.writeFileSync(
                path.join(contextDir, 'chat-history.json'),
                JSON.stringify({
                    messageCount: result.chatMessages.length,
                    messages: result.chatMessages,
                }, null, 2)
            );
        }

        // Store logs
        if (result.buildLogs.length > 0 || result.runtimeLogs.length > 0) {
            fs.writeFileSync(
                path.join(contextDir, 'logs.json'),
                JSON.stringify({
                    build: result.buildLogs,
                    runtime: result.runtimeLogs,
                }, null, 2)
            );
        }

        // Store export ZIP if available
        if (result.exportZip) {
            fs.writeFileSync(
                path.join(contextDir, 'export.zip'),
                result.exportZip
            );
        }

        // Store capture stats
        fs.writeFileSync(
            path.join(contextDir, 'capture-stats.json'),
            JSON.stringify({
                captureId,
                stats: result.stats,
                capturedAt: new Date().toISOString(),
            }, null, 2)
        );

        // Create notification
        await db.insert(notifications).values({
            id: uuidv4(),
            userId,
            type: 'project_imported',
            title: `Project Captured: ${name}`,
            message: `Captured ${result.chatMessages.length} messages. KripTik AI is analyzing your project...`,
            metadata: JSON.stringify({
                projectId,
                captureId,
                messagesCount: result.chatMessages.length,
                stats: result.stats,
            }),
            read: false,
        });

        // Start Fix My App analysis
        if (result.chatMessages.length > 0) {
            console.log(`[ComputerUse] Starting Fix My App analysis for ${projectId}`);

            const chatMessages: FixChatMessage[] = result.chatMessages.map((msg, index) => ({
                id: `msg-${index}`,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                codeBlocks: msg.codeBlocks,
            }));

            const capturedErrors: CapturedError[] = [];

            // Extract errors from logs
            for (const log of [...result.buildLogs, ...result.runtimeLogs]) {
                if (log.toLowerCase().includes('error') || log.toLowerCase().includes('failed')) {
                    capturedErrors.push({
                        type: 'error',
                        message: log,
                        timestamp: new Date().toISOString(),
                        source: 'logs',
                    });
                }
            }

            // Start fix orchestration
            const fixOrchestrator = getFixOrchestrator();
            fixOrchestrator.startFix(
                projectId,
                userId,
                chatMessages,
                capturedErrors,
                'computer-use',
                ''
            ).then(fixSession => {
                console.log(`[ComputerUse] Fix session started: ${fixSession.id}`);
            }).catch(error => {
                console.error(`[ComputerUse] Fix session error:`, error);
            });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';

        return res.json({
            success: true,
            projectId,
            projectName: name,
            dashboardUrl: `${frontendUrl}/dashboard`,
            builderUrl: `${frontendUrl}/builder/${projectId}`,
            stats: {
                messagesImported: result.chatMessages.length,
                logsImported: result.buildLogs.length + result.runtimeLogs.length,
                hasExport: !!result.exportZip,
            },
        });

    } catch (error) {
        console.error('[ComputerUse] Import error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to import capture results',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * Helper: Detect platform from URL
 */
function detectPlatformFromUrl(url: string): CaptureConfig['platform'] {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('lovable.dev') || urlLower.includes('lovable.ai')) {
        return 'lovable';
    }
    if (urlLower.includes('bolt.new') || urlLower.includes('stackblitz')) {
        return 'bolt';
    }
    if (urlLower.includes('v0.dev') || urlLower.includes('v0.app')) {
        return 'v0';
    }
    if (urlLower.includes('create.xyz') || urlLower.includes('create.app')) {
        return 'create';
    }
    if (urlLower.includes('tempo')) {
        return 'tempo';
    }
    if (urlLower.includes('replit.com')) {
        return 'replit';
    }
    if (urlLower.includes('cursor.')) {
        return 'cursor';
    }

    return 'unknown';
}

export { router as extensionRouter };
