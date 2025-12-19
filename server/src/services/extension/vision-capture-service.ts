/**
 * Vision Capture Service
 *
 * Server-side capture using Gemini Flash + Playwright.
 * Captures AI platform content by:
 * 1. Loading the page with user's session cookies
 * 2. Taking screenshots at intervals
 * 3. Using Gemini vision to extract chat history, errors, file tree
 * 4. Streaming progress to the extension via SSE
 * 5. Auto-importing to KripTik when capture completes
 *
 * This is the ONLY capture method - there is no "non-vision" alternative.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import OpenAI from 'openai';
import { db } from '../../db.js';
import { projects, notifications } from '../../schema.js';

// Lazy-load Playwright (not available in serverless)
let playwrightModule: typeof import('playwright') | null = null;
let playwrightAvailable = false;

async function getPlaywright(): Promise<typeof import('playwright')> {
    if (playwrightModule) return playwrightModule;

    try {
        playwrightModule = await import('playwright');
        playwrightAvailable = true;
        return playwrightModule;
    } catch (error) {
        playwrightAvailable = false;
        throw new Error('Playwright is not available. Vision capture requires full server deployment.');
    }
}

type Browser = import('playwright').Browser;
type Page = import('playwright').Page;
type BrowserContext = import('playwright').BrowserContext;

// =============================================================================
// TYPES
// =============================================================================

export interface CookieData {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface VisionCaptureOptions {
    maxScrolls?: number;           // Max number of scroll iterations (default: 10)
    captureInterval?: number;      // MS between captures (default: 2000)
    waitForSelector?: string;      // Optional selector to wait for before capture
    timeout?: number;              // Overall timeout in MS (default: 120000)
    includeFileTree?: boolean;     // Try to capture file tree (default: true)
    includeErrors?: boolean;       // Try to capture errors (default: true)
    includeConsole?: boolean;      // Try to capture console (default: true)
}

export interface CaptureProgress {
    phase: 'initializing' | 'loading' | 'capturing' | 'analyzing' | 'finalizing';
    step: string;
    percentage: number;
    messagesFound: number;
    errorsFound: number;
    filesFound: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    codeBlocks?: Array<{ language: string; code: string }>;
}

export interface ErrorEntry {
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    stack?: string;
    timestamp: string;
}

export interface FileEntry {
    path: string;
    type: 'file' | 'folder';
    language?: string;
}

export interface VisionCaptureResult {
    success: boolean;
    sessionId: string;
    platform: {
        id: string;
        name: string;
        detected: boolean;
    };
    chatHistory: {
        messageCount: number;
        messages: ChatMessage[];
    };
    errors: {
        count: number;
        entries: ErrorEntry[];
    };
    files: {
        count: number;
        entries: FileEntry[];
    };
    screenshots: {
        count: number;
        finalScreenshot?: string; // base64
    };
    captureStats: {
        duration: number;
        scrollCount: number;
        apiCalls: number;
        estimatedCost: number;
    };
    // Added after auto-import
    projectId?: string;
    projectName?: string;
}

export interface VisionCaptureSession {
    id: string;
    url: string;
    userId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: CaptureProgress;
    result?: VisionCaptureResult;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
    events: EventEmitter;
}

// =============================================================================
// PLATFORM DETECTION PATTERNS
// =============================================================================

const PLATFORM_PATTERNS: Record<string, { name: string; chatSelector: string; errorSelector?: string; fileTreeSelector?: string }> = {
    'lovable.dev': {
        name: 'Lovable',
        chatSelector: '[data-testid="chat-message"], .chat-message, .message-content',
        errorSelector: '.error-panel, .error-message, [data-error]',
        fileTreeSelector: '.file-tree, .file-explorer, [data-testid="file-tree"]',
    },
    'bolt.new': {
        name: 'Bolt',
        chatSelector: '.chat-message, .message-bubble, [data-message]',
        errorSelector: '.error-toast, .error-notification',
        fileTreeSelector: '.file-list, .explorer-tree',
    },
    'v0.dev': {
        name: 'v0',
        chatSelector: '[data-message], .prose, .chat-turn',
        errorSelector: '.error-display',
        fileTreeSelector: '.file-browser',
    },
    'cursor.sh': {
        name: 'Cursor',
        chatSelector: '.chat-panel .message',
        errorSelector: '.diagnostics-panel .error',
        fileTreeSelector: '.explorer-folders',
    },
    'cursor.com': {
        name: 'Cursor',
        chatSelector: '.chat-panel .message',
        errorSelector: '.diagnostics-panel .error',
        fileTreeSelector: '.explorer-folders',
    },
    'claude.ai': {
        name: 'Claude',
        chatSelector: '[data-testid="conversation-turn"], .prose',
        errorSelector: '.error-message',
    },
    'chatgpt.com': {
        name: 'ChatGPT',
        chatSelector: '[data-message-id], .message-content',
        errorSelector: '.error-state',
    },
    'replit.com': {
        name: 'Replit',
        chatSelector: '.chat-message, .assistant-message',
        errorSelector: '.console-error',
        fileTreeSelector: '.file-tree-node',
    },
    'create.xyz': {
        name: 'Create.xyz',
        chatSelector: '.chat-bubble, .message',
        errorSelector: '.error-panel',
        fileTreeSelector: '.file-browser',
    },
    'marblism.com': {
        name: 'Marblism',
        chatSelector: '.chat-message',
        errorSelector: '.error-display',
        fileTreeSelector: '.file-explorer',
    },
};

// =============================================================================
// VISION CAPTURE SERVICE
// =============================================================================

class VisionCaptureService {
    private sessions: Map<string, VisionCaptureSession> = new Map();
    private openai: OpenAI;

    constructor() {
        // Use OpenRouter for Gemini access
        this.openai = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined,
        });
    }

    /**
     * Start a new vision capture session
     */
    async startCapture(
        userId: string,
        url: string,
        cookies: CookieData[],
        options: VisionCaptureOptions = {}
    ): Promise<VisionCaptureSession> {
        const sessionId = uuidv4();

        const session: VisionCaptureSession = {
            id: sessionId,
            url,
            userId,
            status: 'pending',
            progress: {
                phase: 'initializing',
                step: 'Creating capture session...',
                percentage: 0,
                messagesFound: 0,
                errorsFound: 0,
                filesFound: 0,
            },
            startedAt: new Date(),
            events: new EventEmitter(),
        };

        this.sessions.set(sessionId, session);

        // Start capture in background
        this.runCapture(session, cookies, options).catch((error) => {
            session.status = 'failed';
            session.error = error.message;
            session.events.emit('error', { error: error.message });
        });

        return session;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): VisionCaptureSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Cancel a running session
     */
    async cancelSession(sessionId: string): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        if (session.status === 'running') {
            session.status = 'cancelled';
            session.events.emit('cancelled', {});
            return true;
        }

        return false;
    }

    /**
     * Main capture logic
     */
    private async runCapture(
        session: VisionCaptureSession,
        cookies: CookieData[],
        options: VisionCaptureOptions
    ): Promise<void> {
        const {
            maxScrolls = 10,
            captureInterval = 2000,
            timeout = 120000,
            includeFileTree = true,
            includeErrors = true,
        } = options;

        let browser: Browser | null = null;
        let context: BrowserContext | null = null;
        let page: Page | null = null;

        const startTime = Date.now();
        let apiCalls = 0;
        let scrollCount = 0;
        const screenshots: string[] = [];

        const allMessages: ChatMessage[] = [];
        const allErrors: ErrorEntry[] = [];
        const allFiles: FileEntry[] = [];

        try {
            session.status = 'running';
            this.updateProgress(session, 'initializing', 'Loading Playwright...', 5);

            // Check if Playwright is available
            const playwright = await getPlaywright();

            this.updateProgress(session, 'initializing', 'Launching browser...', 10);

            // Launch browser
            browser = await playwright.chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });

            // Create context with cookies
            context = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            });

            // Add cookies if provided
            if (cookies.length > 0) {
                const playwrightCookies = cookies.map((c) => ({
                    name: c.name,
                    value: c.value,
                    domain: c.domain,
                    path: c.path || '/',
                    expires: c.expires ? c.expires : undefined,
                    httpOnly: c.httpOnly,
                    secure: c.secure,
                    sameSite: c.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
                }));
                await context.addCookies(playwrightCookies);
            }

            page = await context.newPage();

            this.updateProgress(session, 'loading', `Navigating to ${session.url}...`, 15);

            // Navigate to URL
            await page.goto(session.url, {
                waitUntil: 'networkidle',
                timeout: 30000,
            });

            // Detect platform
            const platform = this.detectPlatform(session.url);
            this.updateProgress(session, 'loading', `Detected platform: ${platform.name}`, 20);

            // Wait for content to load
            await page.waitForTimeout(2000);

            if (options.waitForSelector) {
                try {
                    await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
                } catch {
                    console.log('[VisionCapture] waitForSelector timeout, continuing...');
                }
            }

            this.updateProgress(session, 'capturing', 'Taking initial screenshot...', 25);

            // Capture and analyze loop
            for (let i = 0; i < maxScrolls && session.status === 'running'; i++) {
                // Check timeout
                if (Date.now() - startTime > timeout) {
                    console.log('[VisionCapture] Timeout reached');
                    break;
                }

                // Take screenshot
                const screenshotBuffer = await page.screenshot({
                    type: 'jpeg',
                    quality: 85,
                    fullPage: false,
                });
                const screenshotBase64 = screenshotBuffer.toString('base64');
                screenshots.push(screenshotBase64);

                // Analyze with Gemini
                const analysis = await this.analyzeScreenshot(
                    screenshotBase64,
                    platform.name,
                    i === 0 // isFirst - provide more context on first
                );
                apiCalls++;

                // Merge results
                if (analysis.messages) {
                    for (const msg of analysis.messages) {
                        // Dedupe by content
                        if (!allMessages.some((m) => m.content === msg.content)) {
                            allMessages.push(msg);
                        }
                    }
                }

                if (analysis.errors && includeErrors) {
                    for (const err of analysis.errors) {
                        if (!allErrors.some((e) => e.message === err.message)) {
                            allErrors.push(err);
                        }
                    }
                }

                if (analysis.files && includeFileTree) {
                    for (const file of analysis.files) {
                        if (!allFiles.some((f) => f.path === file.path)) {
                            allFiles.push(file);
                        }
                    }
                }

                // Update progress
                const progressPct = 25 + Math.floor((i / maxScrolls) * 60);
                this.updateProgress(
                    session,
                    'capturing',
                    `Captured ${i + 1}/${maxScrolls} views...`,
                    progressPct,
                    allMessages.length,
                    allErrors.length,
                    allFiles.length
                );

                // Check if we've found enough content
                if (allMessages.length >= 50 && i >= 3) {
                    console.log('[VisionCapture] Found sufficient content, stopping early');
                    break;
                }

                // Scroll down
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight * 0.8);
                });
                scrollCount++;

                // Wait between captures
                await page.waitForTimeout(captureInterval);
            }

            this.updateProgress(session, 'finalizing', 'Processing results...', 90);

            // Take final full-page screenshot
            let finalScreenshot: string | undefined;
            try {
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.waitForTimeout(500);
                const finalBuffer = await page.screenshot({
                    type: 'jpeg',
                    quality: 90,
                    fullPage: true,
                });
                finalScreenshot = finalBuffer.toString('base64');
            } catch {
                console.log('[VisionCapture] Final screenshot failed');
            }

            // Calculate estimated cost (Gemini Flash is very cheap)
            // ~$0.35/1M input tokens, ~$1.05/1M output for Gemini 2.0 Flash
            const estimatedCost = apiCalls * 0.002; // ~$0.002 per call estimate

            // Build result
            const result: VisionCaptureResult = {
                success: true,
                sessionId: session.id,
                platform: {
                    id: platform.id,
                    name: platform.name,
                    detected: platform.detected,
                },
                chatHistory: {
                    messageCount: allMessages.length,
                    messages: allMessages,
                },
                errors: {
                    count: allErrors.length,
                    entries: allErrors,
                },
                files: {
                    count: allFiles.length,
                    entries: allFiles,
                },
                screenshots: {
                    count: screenshots.length,
                    finalScreenshot,
                },
                captureStats: {
                    duration: Date.now() - startTime,
                    scrollCount,
                    apiCalls,
                    estimatedCost,
                },
            };

            session.result = result;
            session.status = 'completed';
            session.completedAt = new Date();

            this.updateProgress(session, 'finalizing', 'Importing to KripTik...', 95);

            // Auto-import the captured data to KripTik
            const importResult = await this.autoImport(session.userId, result);
            if (importResult.success) {
                result.projectId = importResult.projectId;
                result.projectName = importResult.projectName;
            }

            this.updateProgress(session, 'finalizing', 'Capture complete!', 100);
            session.events.emit('complete', { result });

            console.log(`[VisionCapture] Session ${session.id} completed:`, {
                messages: allMessages.length,
                errors: allErrors.length,
                files: allFiles.length,
                duration: result.captureStats.duration,
                projectId: importResult.projectId,
            });

        } catch (error) {
            console.error('[VisionCapture] Error:', error);
            session.status = 'failed';
            session.error = error instanceof Error ? error.message : 'Unknown error';
            session.events.emit('error', { error: session.error });
        } finally {
            // Cleanup
            if (page) await page.close().catch(() => {});
            if (context) await context.close().catch(() => {});
            if (browser) await browser.close().catch(() => {});
        }
    }

    /**
     * Detect platform from URL
     */
    private detectPlatform(url: string): { id: string; name: string; detected: boolean } {
        try {
            const hostname = new URL(url).hostname.replace('www.', '');

            for (const [domain, config] of Object.entries(PLATFORM_PATTERNS)) {
                if (hostname.includes(domain)) {
                    return {
                        id: domain.replace('.', '-'),
                        name: config.name,
                        detected: true,
                    };
                }
            }
        } catch {
            // URL parsing failed
        }

        return {
            id: 'unknown',
            name: 'Unknown Platform',
            detected: false,
        };
    }

    /**
     * Analyze screenshot with Gemini vision
     */
    private async analyzeScreenshot(
        screenshotBase64: string,
        platformName: string,
        isFirst: boolean
    ): Promise<{
        messages?: ChatMessage[];
        errors?: ErrorEntry[];
        files?: FileEntry[];
    }> {
        const prompt = isFirst
            ? `You are analyzing a screenshot of ${platformName}, an AI code builder platform.

Extract ALL visible content from this screenshot:

1. CHAT MESSAGES: Extract every visible message in the conversation.
   - For each message, identify if it's from the user or the AI assistant
   - Include the full text content
   - Note any code blocks with their language

2. ERRORS: Look for any error messages, warnings, or failure notifications.
   - Include the error message text
   - Classify severity (error, warning, info)

3. FILE TREE: If a file explorer/tree is visible, list all visible files and folders.
   - Include the full path
   - Mark as file or folder

Return JSON in this exact format:
{
  "messages": [
    {"role": "user", "content": "message text", "codeBlocks": [{"language": "typescript", "code": "..."}]},
    {"role": "assistant", "content": "response text"}
  ],
  "errors": [
    {"type": "runtime", "severity": "error", "message": "error text"}
  ],
  "files": [
    {"path": "src/App.tsx", "type": "file", "language": "typescript"},
    {"path": "src/components", "type": "folder"}
  ]
}

Be thorough - extract EVERYTHING visible. If something is partially visible, include what you can see.`
            : `Continue extracting content from this ${platformName} screenshot.
Focus on any NEW messages, errors, or files not seen before.
Return the same JSON format: {"messages": [...], "errors": [...], "files": [...]}
Only include NEW content visible in this screenshot.`;

        try {
            // Use OpenRouter with Gemini Flash for vision
            const modelId = process.env.OPENROUTER_API_KEY
                ? 'google/gemini-2.0-flash-thinking-exp'
                : 'gpt-4o-mini'; // Fallback if no OpenRouter

            const response = await this.openai.chat.completions.create({
                model: modelId,
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${screenshotBase64}`,
                                },
                            },
                            {
                                type: 'text',
                                text: prompt,
                            },
                        ],
                    },
                ],
            });

            const content = response.choices[0]?.message?.content || '';

            // Parse JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]);

                    // Add IDs and timestamps to messages
                    const messages = (parsed.messages || []).map((m: any, i: number) => ({
                        id: `msg-${Date.now()}-${i}`,
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.content || '',
                        codeBlocks: m.codeBlocks || [],
                        timestamp: new Date().toISOString(),
                    }));

                    const errors = (parsed.errors || []).map((e: any) => ({
                        type: e.type || 'runtime',
                        severity: e.severity || 'error',
                        message: e.message || '',
                        timestamp: new Date().toISOString(),
                    }));

                    const files = (parsed.files || []).map((f: any) => ({
                        path: f.path || '',
                        type: f.type || 'file',
                        language: f.language,
                    }));

                    return { messages, errors, files };
                } catch (parseError) {
                    console.error('[VisionCapture] JSON parse error:', parseError);
                }
            }
        } catch (error) {
            console.error('[VisionCapture] Vision analysis error:', error);
        }

        return {};
    }

    /**
     * Auto-import captured data to KripTik
     * Creates a project and stores the captured chat history
     */
    private async autoImport(
        userId: string,
        result: VisionCaptureResult
    ): Promise<{ success: boolean; projectId?: string; projectName?: string }> {
        try {
            const projectId = uuidv4();
            const projectName = `${result.platform.name} Import - ${new Date().toLocaleDateString()}`;

            // Build description with metadata
            const metadataStr = JSON.stringify({
                source: 'vision-capture',
                platform: result.platform,
                captureStats: result.captureStats,
                chatHistory: result.chatHistory,
                errors: result.errors,
                files: result.files,
            });

            // Create project in database
            await db.insert(projects).values({
                id: projectId,
                name: projectName,
                ownerId: userId,
                description: `Imported from ${result.platform.name} via Vision Capture. Contains ${result.chatHistory.messageCount} messages.\n\n<!-- VISION_CAPTURE_METADATA: ${metadataStr} -->`,
                framework: 'react',
            });

            // Create notification for user
            await db.insert(notifications).values({
                id: uuidv4(),
                userId,
                type: 'import_complete',
                title: 'Project Imported Successfully',
                message: `Your ${result.platform.name} project has been imported with ${result.chatHistory.messageCount} messages. Visit Fix My App to continue.`,
                actionUrl: `/fix-my-app?project=${projectId}`,
                metadata: JSON.stringify({
                    projectId,
                    platform: result.platform.name,
                    messageCount: result.chatHistory.messageCount,
                    errorCount: result.errors.count,
                    fileCount: result.files.count,
                }),
            });

            console.log(`[VisionCapture] Auto-imported project ${projectId} for user ${userId}`);

            return {
                success: true,
                projectId,
                projectName,
            };
        } catch (error) {
            console.error('[VisionCapture] Auto-import failed:', error);
            return { success: false };
        }
    }

    /**
     * Update session progress and emit event
     */
    private updateProgress(
        session: VisionCaptureSession,
        phase: CaptureProgress['phase'],
        step: string,
        percentage: number,
        messagesFound?: number,
        errorsFound?: number,
        filesFound?: number
    ): void {
        session.progress = {
            phase,
            step,
            percentage,
            messagesFound: messagesFound ?? session.progress.messagesFound,
            errorsFound: errorsFound ?? session.progress.errorsFound,
            filesFound: filesFound ?? session.progress.filesFound,
        };

        session.events.emit('progress', { session: { ...session, events: undefined } });
    }

    /**
     * Cleanup old sessions (call periodically)
     */
    cleanupOldSessions(maxAgeMs: number = 3600000): void {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (session.completedAt && now - session.completedAt.getTime() > maxAgeMs) {
                this.sessions.delete(id);
            } else if (now - session.startedAt.getTime() > maxAgeMs * 2) {
                // Force cleanup very old sessions
                this.sessions.delete(id);
            }
        }
    }
}

// Singleton instance
let visionCaptureService: VisionCaptureService | null = null;

export function getVisionCaptureService(): VisionCaptureService {
    if (!visionCaptureService) {
        visionCaptureService = new VisionCaptureService();

        // Cleanup old sessions every 30 minutes
        setInterval(() => {
            visionCaptureService?.cleanupOldSessions();
        }, 1800000);
    }
    return visionCaptureService;
}

export { VisionCaptureService };
