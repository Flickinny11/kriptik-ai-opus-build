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
import { projects, files, users } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

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
 */
router.post('/import', async (req: Request, res: Response) => {
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

        return res.json({
            success: true,
            projectId,
            projectName,
            message: `Project imported successfully. ${fileCount} files processed.`,
            dashboardUrl: `${frontendUrl}/dashboard`,
            builderUrl: `${frontendUrl}/builder/${projectId}`,
            stats: {
                files: fileCount,
                totalSize,
                chatMessages: payload.chatHistory?.messageCount || 0,
                errors: payload.errors?.count || 0,
            },
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
// VISION-BASED CREDENTIAL EXTRACTION
// ============================================================================

interface VisionExtractRequest {
    screenshot: string; // Base64 PNG
    targetCredentials: string[]; // e.g., ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
    currentUrl: string;
    pageTitle: string;
    pageText?: string;
    attempt: number;
}

interface VisionExtractResponse {
    success: boolean;
    credentials?: Record<string, string>;
    action: 'none' | 'navigate' | 'click' | 'scroll';
    navigateTo?: string;
    clickSelector?: string;
    clickText?: string;
    scrollDirection?: 'up' | 'down';
    message?: string;
}

/**
 * Credential extraction hints for common platforms
 * Helps the AI understand where to find credentials
 */
const PLATFORM_HINTS: Record<string, {
    credentials: Record<string, { hints: string[]; format?: RegExp; navigation?: string }>;
    navigationTips: string[];
}> = {
    'console.cloud.google.com': {
        credentials: {
            'GOOGLE_CLIENT_ID': {
                hints: ['OAuth 2.0 Client IDs', 'Client ID', 'ends with .apps.googleusercontent.com'],
                format: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
                navigation: 'APIs & Services > Credentials'
            },
            'GOOGLE_CLIENT_SECRET': {
                hints: ['Client secret', 'Secret', 'GOCSPX-'],
                format: /^GOCSPX-[A-Za-z0-9_-]+$/,
                navigation: 'APIs & Services > Credentials > OAuth client'
            }
        },
        navigationTips: [
            'Click on "APIs & Services" in the left menu',
            'Then click on "Credentials"',
            'Look for "OAuth 2.0 Client IDs" section',
            'Click on the client name to see the secret'
        ]
    },
    'dashboard.stripe.com': {
        credentials: {
            'STRIPE_PUBLISHABLE_KEY': {
                hints: ['Publishable key', 'pk_live_', 'pk_test_'],
                format: /^pk_(live|test)_[A-Za-z0-9]+$/,
                navigation: 'Developers > API keys'
            },
            'STRIPE_SECRET_KEY': {
                hints: ['Secret key', 'sk_live_', 'sk_test_', 'Reveal key'],
                format: /^sk_(live|test)_[A-Za-z0-9]+$/,
                navigation: 'Developers > API keys'
            }
        },
        navigationTips: [
            'Click on "Developers" in the left sidebar',
            'Then click on "API keys"',
            'You may need to click "Reveal key" to see the secret key'
        ]
    },
    'supabase.com': {
        credentials: {
            'SUPABASE_URL': {
                hints: ['Project URL', 'https://', '.supabase.co'],
                format: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
                navigation: 'Settings > API'
            },
            'SUPABASE_ANON_KEY': {
                hints: ['anon', 'public', 'anon key'],
                format: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
                navigation: 'Settings > API'
            },
            'SUPABASE_SERVICE_ROLE_KEY': {
                hints: ['service_role', 'service role', 'secret'],
                format: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
                navigation: 'Settings > API'
            }
        },
        navigationTips: [
            'Go to your project dashboard',
            'Click on "Settings" (gear icon)',
            'Then click on "API" in the settings menu',
            'All keys are listed on this page'
        ]
    },
    'platform.openai.com': {
        credentials: {
            'OPENAI_API_KEY': {
                hints: ['API key', 'sk-', 'Secret key'],
                format: /^sk-[A-Za-z0-9]+$/,
                navigation: 'API keys'
            }
        },
        navigationTips: [
            'Click on your profile in the top right',
            'Go to "API keys"',
            'You may need to create a new key if none exist'
        ]
    },
    'console.anthropic.com': {
        credentials: {
            'ANTHROPIC_API_KEY': {
                hints: ['API key', 'sk-ant-', 'Secret key'],
                format: /^sk-ant-[A-Za-z0-9-]+$/,
                navigation: 'API Keys'
            }
        },
        navigationTips: [
            'Go to Settings > API Keys',
            'Create a new key if needed'
        ]
    },
    'vercel.com': {
        credentials: {
            'VERCEL_TOKEN': {
                hints: ['Token', 'API token'],
                navigation: 'Settings > Tokens'
            }
        },
        navigationTips: [
            'Click on your avatar',
            'Go to Settings',
            'Click on Tokens'
        ]
    }
};

/**
 * POST /api/extension/vision-extract
 * Use AI vision to extract credentials from a screenshot
 */
router.post('/vision-extract', authMiddleware, async (req: Request, res: Response) => {
    try {
        const {
            screenshot,
            targetCredentials,
            currentUrl,
            pageTitle,
            pageText,
            attempt
        } = req.body as VisionExtractRequest;

        if (!screenshot || !targetCredentials || targetCredentials.length === 0) {
            return res.status(400).json({
                success: false,
                action: 'none',
                message: 'Missing required fields: screenshot and targetCredentials'
            });
        }

        // Determine platform from URL
        const urlObj = new URL(currentUrl);
        const hostname = urlObj.hostname;
        const platformHints = Object.entries(PLATFORM_HINTS).find(
            ([domain]) => hostname.includes(domain)
        )?.[1];

        // Build context for the AI
        const credentialHints = targetCredentials.map(cred => {
            const hint = platformHints?.credentials[cred];
            return hint ? `- ${cred}: Look for ${hint.hints.join(', ')}${hint.navigation ? ` (usually at: ${hint.navigation})` : ''}` : `- ${cred}`;
        }).join('\n');

        const navigationTips = platformHints?.navigationTips?.join('\n- ') || '';

        // Import OpenRouter client dynamically to avoid circular deps
        const { createOpenRouterClient, OPENROUTER_MODELS } = await import('../services/ai/openrouter-client.js');
        const openRouter = createOpenRouterClient();

        // Call vision model
        const response = await openRouter.messages.create({
            model: OPENROUTER_MODELS.SONNET_4_5,
            max_tokens: 2000,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: screenshot
                            }
                        },
                        {
                            type: 'text',
                            text: `You are a credential extraction assistant. Analyze this screenshot to find API keys and credentials.

**Current URL:** ${currentUrl}
**Page Title:** ${pageTitle}
**Extraction Attempt:** ${attempt}

**Credentials Needed:**
${credentialHints}

${navigationTips ? `**Navigation Tips for this Platform:**\n- ${navigationTips}` : ''}

${pageText ? `**Visible Text (partial):** ${pageText.slice(0, 1000)}...` : ''}

**Your Task:**
1. Look at the screenshot carefully
2. If you can see any of the requested credentials, extract them EXACTLY as shown
3. If credentials are not visible, determine what navigation or action is needed

**Response Format (JSON only):**
{
  "success": true/false,
  "credentials": {
    "CREDENTIAL_NAME": "actual_value_from_screenshot"
  },
  "action": "none" | "navigate" | "click" | "scroll",
  "navigateTo": "URL or menu item to click",
  "clickText": "text of button/link to click",
  "scrollDirection": "up" | "down",
  "message": "explanation of what you found or what action to take"
}

**Important Rules:**
- Only extract credentials you can ACTUALLY SEE in the screenshot
- Never guess or make up credential values
- If you see a "Show" or "Reveal" button next to a hidden credential, set action to "click"
- If credentials are on a different page, set action to "navigate"
- Include the full credential value, not truncated
- Return ONLY valid JSON, no markdown code blocks`
                        }
                    ]
                }
            ]
        });

        // Parse the AI response
        const content = response.content[0];
        if (content.type !== 'text') {
            return res.json({
                success: false,
                action: 'none',
                message: 'Unexpected response format from AI'
            });
        }

        // Extract JSON from response (handle potential markdown wrapping)
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }

        const result: VisionExtractResponse = JSON.parse(jsonText);

        // Validate extracted credentials against known formats
        if (result.success && result.credentials && platformHints) {
            for (const [key, value] of Object.entries(result.credentials)) {
                const hint = platformHints.credentials[key];
                if (hint?.format && !hint.format.test(value)) {
                    console.warn(`[Vision Extract] Credential ${key} doesn't match expected format`);
                    // Don't reject, but log for debugging
                }
            }
        }

        console.log(`[Vision Extract] Attempt ${attempt}: ${result.success ? 'Found credentials' : result.action}`);

        return res.json(result);

    } catch (error) {
        console.error('[Vision Extract] Error:', error);

        // Try to determine if it's a parsing error
        const isParseError = error instanceof SyntaxError;

        return res.status(isParseError ? 422 : 500).json({
            success: false,
            action: 'none',
            message: isParseError
                ? 'Failed to parse AI response'
                : 'Vision extraction failed'
        });
    }
});

export { router as extensionRouter };
