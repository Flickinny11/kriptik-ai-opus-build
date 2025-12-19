/**
 * Vision Capture Service - Live Video Streaming Analysis
 *
 * Uses Gemini Live API for real-time streaming video analysis.
 * This is NOT screenshot-by-screenshot - it's continuous video monitoring.
 *
 * How it works:
 * 1. Opens the page with user's session cookies via Playwright
 * 2. Establishes a WebSocket connection to Gemini Live API
 * 3. Continuously streams video frames (1-5 FPS) as we scroll
 * 4. The AI sees the page in real-time and guides the capture:
 *    - Tells us where to scroll
 *    - Identifies chat messages, errors, file trees
 *    - Finds export/zip buttons and build logs
 *    - Keeps scrolling until entire chat history is captured
 * 5. Auto-imports to KripTik when capture completes
 *
 * Requires: GOOGLE_AI_API_KEY environment variable for Live API access
 * Fallback: Uses OpenRouter with enhanced vision if Google AI key not set
 *
 * Model: gemini-2.0-flash-live-001 (Live API GA, Dec 2025)
 * - Real-time bidirectional streaming
 * - Video processing at 1-60 FPS
 * - WebSocket-based session
 * - Supports system instructions and function calling
 *
 * This is the ONLY capture method - there is no "non-vision" alternative.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { db } from '../../db.js';
import { projects, notifications } from '../../schema.js';
import { OPENROUTER_MODELS } from '../ai/openrouter-client.js';

// =============================================================================
// LAZY IMPORTS
// =============================================================================

// Lazy-load Google GenAI SDK
let GoogleGenAI: typeof import('@google/genai').GoogleGenAI | null = null;
let Modality: typeof import('@google/genai').Modality | null = null;

async function getGoogleGenAI() {
    if (GoogleGenAI) return { GoogleGenAI, Modality };

    try {
        const genai = await import('@google/genai');
        GoogleGenAI = genai.GoogleGenAI;
        Modality = genai.Modality;
        return { GoogleGenAI, Modality };
    } catch (error) {
        console.error('[VisionCapture] Failed to load @google/genai:', error);
        throw new Error('Google GenAI SDK not available');
    }
}

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
// CONFIGURATION
// =============================================================================

// Live API configuration for complex video analysis
const LIVE_API_CONFIG = {
    // Live API model - GA December 2025
    model: 'gemini-2.0-flash-live-001',
    // Frames per second for video streaming (1-60 supported)
    fps: 2,
    // Maximum session duration (Live API default is 10 min, we extend via reconnection)
    maxSessionDurationMs: 8 * 60 * 1000, // 8 minutes to allow buffer before 10 min limit
    // Viewport for capture
    viewport: { width: 1920, height: 1080 },
};

// OpenRouter fallback configuration (if no Google AI key)
const OPENROUTER_FALLBACK_CONFIG = {
    model: OPENROUTER_MODELS.GEMINI_3_FLASH,
    // HIGH thinking for complex analysis (not 'low')
    thinkingLevel: 'high' as const,
    // Large token limit for comprehensive extraction
    maxTokens: 32768,
    temperature: 0.2,
};

// System instructions for the Live API vision agent
const VISION_AGENT_INSTRUCTIONS = `You are an AI vision agent for KripTik AI's project import system.
Your job is to COMPLETELY capture the content from an AI code builder platform.

You will receive a continuous stream of video frames as the page scrolls.

YOUR TASKS:
1. EXTRACT CHAT HISTORY - Find and extract EVERY message in the conversation
   - User messages and AI assistant responses
   - Include ALL code blocks with their language
   - Continue scrolling until you've seen the ENTIRE chat history

2. FIND ERRORS - Look for error messages, warnings, build failures
   - Terminal/console output
   - Error toasts and notifications
   - Build logs with errors

3. MAP FILE TREE - If a file explorer is visible, capture the structure
   - All files and folders
   - Note the programming languages used

4. LOCATE UI ELEMENTS - Find important interactive elements
   - Export/Download/ZIP buttons (for downloading project files)
   - Build/Deploy buttons
   - Settings or configuration panels

RESPONSE FORMAT:
After each frame or batch of frames, respond with JSON:
{
  "action": "continue" | "scroll_down" | "scroll_up" | "click" | "complete",
  "reason": "why this action",
  "new_messages": [{"role": "user"|"assistant", "content": "...", "codeBlocks": [...]}],
  "new_errors": [{"type": "...", "severity": "error"|"warning", "message": "..."}],
  "new_files": [{"path": "...", "type": "file"|"folder"}],
  "ui_elements_found": [{"type": "export_button"|"download_button"|"build_log", "location": "..."}],
  "progress": {"chat_complete": false, "estimated_remaining_messages": 10}
}

IMPORTANT:
- Keep scrolling until progress.chat_complete is true
- Don't stop early - capture EVERYTHING
- If you see a loading spinner, wait for content to load
- Track what you've already extracted to avoid duplicates`;

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
    maxScrolls?: number;           // Max scroll iterations (unlimited if not set)
    captureInterval?: number;      // MS between frames (default: 500 = 2 FPS)
    waitForSelector?: string;      // Optional selector to wait for
    timeout?: number;              // Overall timeout (default: 300000 = 5 min)
    includeFileTree?: boolean;     // Capture file tree (default: true)
    includeErrors?: boolean;       // Capture errors (default: true)
    maxApiCalls?: number;          // Max API calls for fallback mode (default: 100)
}

export interface CaptureProgress {
    phase: 'initializing' | 'connecting' | 'streaming' | 'analyzing' | 'finalizing';
    step: string;
    percentage: number;
    messagesFound: number;
    errorsFound: number;
    filesFound: number;
    uiElementsFound: string[];
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

export interface UIElement {
    type: 'export_button' | 'download_button' | 'build_log' | 'zip_button' | 'other';
    location: string;
    selector?: string;
}

export interface VisionCaptureResult {
    success: boolean;
    sessionId: string;
    captureMode: 'live_api' | 'openrouter_fallback';
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
    uiElements: UIElement[];
    screenshots: {
        count: number;
        finalScreenshot?: string;
    };
    captureStats: {
        duration: number;
        scrollCount: number;
        frameCount: number;
        apiCalls: number;
        estimatedCost: number;
    };
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
// PLATFORM DETECTION
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
    private googleApiKey: string;
    private openRouterApiKey: string;
    private useLiveApi: boolean;

    constructor() {
        this.googleApiKey = process.env.GOOGLE_AI_API_KEY || '';
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || '';

        // Use Live API if Google AI key is available
        this.useLiveApi = !!this.googleApiKey;

        if (!this.googleApiKey && !this.openRouterApiKey) {
            console.warn('[VisionCapture] No API keys configured - vision capture will fail');
        }

        if (this.useLiveApi) {
            console.log('[VisionCapture] Using Gemini Live API for streaming video analysis');
        } else {
            console.log('[VisionCapture] Using OpenRouter fallback (no GOOGLE_AI_API_KEY)');
        }
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
                uiElementsFound: [],
            },
            startedAt: new Date(),
            events: new EventEmitter(),
        };

        this.sessions.set(sessionId, session);

        // Start capture in background
        if (this.useLiveApi) {
            this.runLiveApiCapture(session, cookies, options).catch((error) => {
                console.error('[VisionCapture] Live API capture failed, trying fallback:', error);
                // Fallback to OpenRouter
                this.runOpenRouterCapture(session, cookies, options).catch((err) => {
                    session.status = 'failed';
                    session.error = err.message;
                    session.events.emit('error', { error: err.message });
                });
            });
        } else {
            this.runOpenRouterCapture(session, cookies, options).catch((error) => {
                session.status = 'failed';
                session.error = error.message;
                session.events.emit('error', { error: error.message });
            });
        }

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

    // =========================================================================
    // LIVE API STREAMING CAPTURE
    // =========================================================================

    /**
     * Run capture using Gemini Live API with real-time video streaming
     * This provides continuous video analysis as we scroll through the page
     */
    private async runLiveApiCapture(
        session: VisionCaptureSession,
        cookies: CookieData[],
        options: VisionCaptureOptions
    ): Promise<void> {
        const {
            captureInterval = 500, // 2 FPS default
            timeout = 300000,      // 5 minutes
            includeFileTree = true,
            includeErrors = true,
        } = options;

        let browser: Browser | null = null;
        let context: BrowserContext | null = null;
        let page: Page | null = null;
        let liveSession: any = null;

        const startTime = Date.now();
        let frameCount = 0;
        let scrollCount = 0;

        const allMessages: ChatMessage[] = [];
        const allErrors: ErrorEntry[] = [];
        const allFiles: FileEntry[] = [];
        const allUIElements: UIElement[] = [];
        const screenshots: string[] = [];

        try {
            session.status = 'running';
            this.updateProgress(session, 'initializing', 'Loading browser...', 5);

            // Load dependencies
            const playwright = await getPlaywright();
            const { GoogleGenAI: GenAI, Modality: Mod } = await getGoogleGenAI();

            this.updateProgress(session, 'initializing', 'Launching browser...', 10);

            // Launch browser
            browser = await playwright.chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });

            context = await browser.newContext({
                viewport: LIVE_API_CONFIG.viewport,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            });

            // Add cookies
            if (cookies.length > 0) {
                const playwrightCookies = cookies.map((c) => ({
                    name: c.name,
                    value: c.value,
                    domain: c.domain,
                    path: c.path || '/',
                    expires: c.expires || undefined,
                    httpOnly: c.httpOnly,
                    secure: c.secure,
                    sameSite: c.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
                }));
                await context.addCookies(playwrightCookies);
            }

            page = await context.newPage();

            this.updateProgress(session, 'initializing', `Navigating to page...`, 15);

            // Navigate
            await page.goto(session.url, {
                waitUntil: 'networkidle',
                timeout: 30000,
            });

            const platform = this.detectPlatform(session.url);
            this.updateProgress(session, 'initializing', `Detected: ${platform.name}`, 20);

            await page.waitForTimeout(2000);

            // Initialize Google GenAI and Live API
            this.updateProgress(session, 'connecting', 'Connecting to Gemini Live API...', 25);

            const ai = new GenAI!({ apiKey: this.googleApiKey });

            // Track AI responses
            let lastAIResponse: any = null;
            let chatComplete = false;
            let consecutiveNoNewContent = 0;
            const maxNoNewContent = 5; // Stop after 5 frames with no new content

            // Connect to Live API
            liveSession = await ai.live.connect({
                model: LIVE_API_CONFIG.model,
                config: {
                    responseModalities: [Mod!.TEXT],
                    systemInstruction: VISION_AGENT_INSTRUCTIONS,
                },
                callbacks: {
                    onopen: () => {
                        console.log('[VisionCapture] Live API connected');
                    },
                    onmessage: (message: any) => {
                        // Handle text responses from the AI
                        if (message.serverContent?.modelTurn?.parts) {
                            for (const part of message.serverContent.modelTurn.parts) {
                                if (part.text) {
                                    try {
                                        // Parse JSON response
                                        const jsonMatch = part.text.match(/\{[\s\S]*\}/);
                                        if (jsonMatch) {
                                            lastAIResponse = JSON.parse(jsonMatch[0]);
                                        }
                                    } catch (e) {
                                        console.log('[VisionCapture] Non-JSON response:', part.text.substring(0, 100));
                                    }
                                }
                            }
                        }
                    },
                    onerror: (event: ErrorEvent) => {
                        console.error('[VisionCapture] Live API error:', event.message);
                    },
                    onclose: () => {
                        console.log('[VisionCapture] Live API disconnected');
                    },
                },
            });

            this.updateProgress(session, 'streaming', 'Streaming video to AI...', 30);

            // Main capture loop - continuously stream frames and follow AI instructions
            while (session.status === 'running' && !chatComplete) {
                // Check timeout
                if (Date.now() - startTime > timeout) {
                    console.log('[VisionCapture] Timeout reached');
                    break;
                }

                // Capture frame
                const screenshotBuffer = await page.screenshot({
                    type: 'jpeg',
                    quality: 80,
                    fullPage: false,
                });
                const base64Frame = screenshotBuffer.toString('base64');
                frameCount++;

                // Send frame to Live API
                await liveSession.sendRealtimeInput({
                    media: {
                        mimeType: 'image/jpeg',
                        data: base64Frame,
                    },
                });

                // Wait for AI to process
                await new Promise(resolve => setTimeout(resolve, captureInterval));

                // Process AI response
                if (lastAIResponse) {
                    const response = lastAIResponse;
                    lastAIResponse = null;

                    // Extract new content
                    let hasNewContent = false;

                    if (response.new_messages?.length > 0) {
                        for (const msg of response.new_messages) {
                            if (!allMessages.some(m => m.content === msg.content)) {
                                allMessages.push({
                                    id: `msg-${Date.now()}-${allMessages.length}`,
                                    role: msg.role || 'assistant',
                                    content: msg.content || '',
                                    codeBlocks: msg.codeBlocks || [],
                                    timestamp: new Date().toISOString(),
                                });
                                hasNewContent = true;
                            }
                        }
                    }

                    if (response.new_errors?.length > 0 && includeErrors) {
                        for (const err of response.new_errors) {
                            if (!allErrors.some(e => e.message === err.message)) {
                                allErrors.push({
                                    type: err.type || 'runtime',
                                    severity: err.severity || 'error',
                                    message: err.message || '',
                                    timestamp: new Date().toISOString(),
                                });
                                hasNewContent = true;
                            }
                        }
                    }

                    if (response.new_files?.length > 0 && includeFileTree) {
                        for (const file of response.new_files) {
                            if (!allFiles.some(f => f.path === file.path)) {
                                allFiles.push({
                                    path: file.path || '',
                                    type: file.type || 'file',
                                    language: file.language,
                                });
                                hasNewContent = true;
                            }
                        }
                    }

                    if (response.ui_elements_found?.length > 0) {
                        for (const elem of response.ui_elements_found) {
                            if (!allUIElements.some(e => e.type === elem.type && e.location === elem.location)) {
                                allUIElements.push({
                                    type: elem.type,
                                    location: elem.location,
                                });
                            }
                        }
                    }

                    // Check if chat is complete
                    if (response.progress?.chat_complete) {
                        chatComplete = true;
                        console.log('[VisionCapture] AI reports chat history is complete');
                    }

                    // Track consecutive frames with no new content
                    if (hasNewContent) {
                        consecutiveNoNewContent = 0;
                    } else {
                        consecutiveNoNewContent++;
                        if (consecutiveNoNewContent >= maxNoNewContent) {
                            console.log('[VisionCapture] No new content for multiple frames, considering complete');
                            chatComplete = true;
                        }
                    }

                    // Execute action based on AI response
                    if (response.action === 'scroll_down') {
                        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
                        scrollCount++;
                    } else if (response.action === 'scroll_up') {
                        await page.evaluate(() => window.scrollBy(0, -window.innerHeight * 0.5));
                        scrollCount++;
                    } else if (response.action === 'complete') {
                        chatComplete = true;
                    }
                    // 'continue' means keep streaming without scrolling

                    // Update progress
                    const progressPct = Math.min(90, 30 + (allMessages.length / 10) * 3);
                    this.updateProgress(
                        session,
                        'streaming',
                        `Found ${allMessages.length} messages, ${allErrors.length} errors, ${allFiles.length} files...`,
                        progressPct,
                        allMessages.length,
                        allErrors.length,
                        allFiles.length,
                        allUIElements.map(e => e.type)
                    );
                } else {
                    // No response yet, scroll down to show more content
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.5));
                    scrollCount++;
                }

                // Store final screenshot
                screenshots.push(base64Frame);
                if (screenshots.length > 5) {
                    screenshots.shift(); // Keep only last 5
                }
            }

            // Close Live API session
            if (liveSession) {
                try {
                    await liveSession.close();
                } catch (e) {
                    // Ignore close errors
                }
            }

            this.updateProgress(session, 'finalizing', 'Processing results...', 92);

            // Take final screenshot
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
                finalScreenshot = screenshots[screenshots.length - 1];
            }

            // Calculate cost (Live API pricing)
            // Approximately $0.0001 per second of video streaming
            const durationSec = (Date.now() - startTime) / 1000;
            const estimatedCost = durationSec * 0.0001;

            // Build result
            const result: VisionCaptureResult = {
                success: true,
                sessionId: session.id,
                captureMode: 'live_api',
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
                uiElements: allUIElements,
                screenshots: {
                    count: frameCount,
                    finalScreenshot,
                },
                captureStats: {
                    duration: Date.now() - startTime,
                    scrollCount,
                    frameCount,
                    apiCalls: 1, // Live API is one continuous session
                    estimatedCost,
                },
            };

            session.result = result;
            session.status = 'completed';
            session.completedAt = new Date();

            this.updateProgress(session, 'finalizing', 'Importing to KripTik...', 95);

            // Auto-import
            const importResult = await this.autoImport(session.userId, result);
            if (importResult.success) {
                result.projectId = importResult.projectId;
                result.projectName = importResult.projectName;
            }

            this.updateProgress(session, 'finalizing', 'Capture complete!', 100);
            session.events.emit('complete', { result });

            console.log(`[VisionCapture] Live API session ${session.id} completed:`, {
                mode: 'live_api',
                messages: allMessages.length,
                errors: allErrors.length,
                files: allFiles.length,
                uiElements: allUIElements.length,
                frames: frameCount,
                duration: result.captureStats.duration,
            });

        } catch (error) {
            console.error('[VisionCapture] Live API error:', error);
            throw error; // Will trigger fallback to OpenRouter
        } finally {
            if (liveSession) {
                try { await liveSession.close(); } catch {}
            }
            if (page) await page.close().catch(() => {});
            if (context) await context.close().catch(() => {});
            if (browser) await browser.close().catch(() => {});
        }
    }

    // =========================================================================
    // OPENROUTER FALLBACK CAPTURE
    // =========================================================================

    /**
     * Fallback capture using OpenRouter with enhanced vision analysis
     * Uses higher thinking levels and token limits for thorough extraction
     */
    private async runOpenRouterCapture(
        session: VisionCaptureSession,
        cookies: CookieData[],
        options: VisionCaptureOptions
    ): Promise<void> {
        const {
            captureInterval = 1500,
            timeout = 300000,
            maxApiCalls = 100,
            includeFileTree = true,
            includeErrors = true,
        } = options;

        let browser: Browser | null = null;
        let context: BrowserContext | null = null;
        let page: Page | null = null;

        const startTime = Date.now();
        let apiCalls = 0;
        let scrollCount = 0;
        let frameCount = 0;
        const screenshots: string[] = [];

        const allMessages: ChatMessage[] = [];
        const allErrors: ErrorEntry[] = [];
        const allFiles: FileEntry[] = [];
        const allUIElements: UIElement[] = [];

        try {
            session.status = 'running';
            this.updateProgress(session, 'initializing', 'Loading browser (fallback mode)...', 5);

            const playwright = await getPlaywright();

            this.updateProgress(session, 'initializing', 'Launching browser...', 10);

            browser = await playwright.chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });

            context = await browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            });

            if (cookies.length > 0) {
                const playwrightCookies = cookies.map((c) => ({
                    name: c.name,
                    value: c.value,
                    domain: c.domain,
                    path: c.path || '/',
                    expires: c.expires || undefined,
                    httpOnly: c.httpOnly,
                    secure: c.secure,
                    sameSite: c.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
                }));
                await context.addCookies(playwrightCookies);
            }

            page = await context.newPage();

            this.updateProgress(session, 'initializing', 'Navigating to page...', 15);

            await page.goto(session.url, {
                waitUntil: 'networkidle',
                timeout: 30000,
            });

            const platform = this.detectPlatform(session.url);
            this.updateProgress(session, 'analyzing', `Detected: ${platform.name}`, 20);

            await page.waitForTimeout(2000);

            // Continuous capture with intelligent scrolling
            let chatComplete = false;
            let consecutiveNoNewContent = 0;
            let previousMessageCount = 0;

            while (
                session.status === 'running' &&
                !chatComplete &&
                apiCalls < maxApiCalls &&
                Date.now() - startTime < timeout
            ) {
                // Take screenshot
                const screenshotBuffer = await page.screenshot({
                    type: 'jpeg',
                    quality: 85,
                    fullPage: false,
                });
                const screenshotBase64 = screenshotBuffer.toString('base64');
                screenshots.push(screenshotBase64);
                frameCount++;

                // Analyze with OpenRouter
                const analysis = await this.analyzeWithOpenRouter(
                    screenshotBase64,
                    platform.name,
                    apiCalls === 0,
                    allMessages.length,
                    allUIElements
                );
                apiCalls++;

                // Merge results
                if (analysis.messages) {
                    for (const msg of analysis.messages) {
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

                if (analysis.uiElements) {
                    for (const elem of analysis.uiElements) {
                        if (!allUIElements.some((e) => e.type === elem.type)) {
                            allUIElements.push(elem);
                        }
                    }
                }

                // Check for completion
                if (analysis.chatComplete) {
                    chatComplete = true;
                    console.log('[VisionCapture] OpenRouter reports chat history complete');
                }

                // Track if we're finding new content
                if (allMessages.length === previousMessageCount) {
                    consecutiveNoNewContent++;
                    if (consecutiveNoNewContent >= 5) {
                        chatComplete = true;
                        console.log('[VisionCapture] No new messages found, considering complete');
                    }
                } else {
                    consecutiveNoNewContent = 0;
                    previousMessageCount = allMessages.length;
                }

                // Update progress
                const progressPct = Math.min(90, 20 + Math.floor((apiCalls / maxApiCalls) * 70));
                this.updateProgress(
                    session,
                    'analyzing',
                    `Captured ${allMessages.length} messages (call ${apiCalls}/${maxApiCalls})...`,
                    progressPct,
                    allMessages.length,
                    allErrors.length,
                    allFiles.length,
                    allUIElements.map(e => e.type)
                );

                // Scroll down
                const scrolled = await page.evaluate(() => {
                    const before = window.scrollY;
                    window.scrollBy(0, window.innerHeight * 0.7);
                    return window.scrollY !== before;
                });
                scrollCount++;

                // If can't scroll anymore, we're at the bottom
                if (!scrolled && apiCalls > 3) {
                    consecutiveNoNewContent++;
                }

                await page.waitForTimeout(captureInterval);
            }

            this.updateProgress(session, 'finalizing', 'Processing results...', 92);

            // Final screenshot
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
                finalScreenshot = screenshots[screenshots.length - 1];
            }

            // Cost calculation for Gemini 3 Flash via OpenRouter
            // ~$0.006 per call average (image + text)
            const estimatedCost = apiCalls * 0.006;

            // Build result
            const result: VisionCaptureResult = {
                success: true,
                sessionId: session.id,
                captureMode: 'openrouter_fallback',
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
                uiElements: allUIElements,
                screenshots: {
                    count: frameCount,
                    finalScreenshot,
                },
                captureStats: {
                    duration: Date.now() - startTime,
                    scrollCount,
                    frameCount,
                    apiCalls,
                    estimatedCost,
                },
            };

            session.result = result;
            session.status = 'completed';
            session.completedAt = new Date();

            this.updateProgress(session, 'finalizing', 'Importing to KripTik...', 95);

            const importResult = await this.autoImport(session.userId, result);
            if (importResult.success) {
                result.projectId = importResult.projectId;
                result.projectName = importResult.projectName;
            }

            this.updateProgress(session, 'finalizing', 'Capture complete!', 100);
            session.events.emit('complete', { result });

            console.log(`[VisionCapture] OpenRouter session ${session.id} completed:`, {
                mode: 'openrouter_fallback',
                messages: allMessages.length,
                errors: allErrors.length,
                files: allFiles.length,
                apiCalls,
                duration: result.captureStats.duration,
            });

        } catch (error) {
            console.error('[VisionCapture] OpenRouter error:', error);
            session.status = 'failed';
            session.error = error instanceof Error ? error.message : 'Unknown error';
            session.events.emit('error', { error: session.error });
        } finally {
            if (page) await page.close().catch(() => {});
            if (context) await context.close().catch(() => {});
            if (browser) await browser.close().catch(() => {});
        }
    }

    /**
     * Analyze screenshot with OpenRouter using HIGH thinking and large token limit
     */
    private async analyzeWithOpenRouter(
        screenshotBase64: string,
        platformName: string,
        isFirst: boolean,
        currentMessageCount: number,
        foundUIElements: UIElement[]
    ): Promise<{
        messages?: ChatMessage[];
        errors?: ErrorEntry[];
        files?: FileEntry[];
        uiElements?: UIElement[];
        chatComplete?: boolean;
    }> {
        const foundElementsStr = foundUIElements.length > 0
            ? `\n\nUI elements already found: ${foundUIElements.map(e => e.type).join(', ')}`
            : '';

        const prompt = isFirst
            ? `You are analyzing a screenshot of ${platformName}, an AI code builder platform.
Your goal is to COMPLETELY capture all content. We will scroll through the entire page.

CURRENT STATUS: This is the FIRST frame. Messages found so far: 0${foundElementsStr}

Extract ALL visible content:

1. CHAT MESSAGES - Every visible message
   - User and AI responses
   - Include ALL code blocks with language
   - Full text content, don't truncate

2. ERRORS - Any error messages, warnings, build failures
   - Console errors
   - Toast notifications
   - Build log errors

3. FILE TREE - List all visible files/folders

4. UI ELEMENTS - IMPORTANT: Find these buttons/sections:
   - Export button
   - Download/ZIP button
   - Build logs section
   - Settings panel

5. COMPLETION CHECK - Can you see the START of the conversation?
   If you see the very first message (often a greeting or project description),
   set chatComplete: true only if ALL messages are visible without scrolling.

Return JSON:
{
  "messages": [{"role": "user"|"assistant", "content": "...", "codeBlocks": [{"language": "...", "code": "..."}]}],
  "errors": [{"type": "...", "severity": "error"|"warning", "message": "..."}],
  "files": [{"path": "...", "type": "file"|"folder"}],
  "uiElements": [{"type": "export_button"|"download_button"|"build_log"|"zip_button", "location": "top-right"}],
  "chatComplete": false
}

Be thorough - extract EVERYTHING visible.`
            : `Continue analyzing ${platformName}. Frame ${currentMessageCount > 0 ? `(${currentMessageCount} messages found so far)` : ''}.${foundElementsStr}

Look for NEW content not previously captured:
- New chat messages (especially older ones as we scroll)
- New errors
- New files in file tree
- Export/Download buttons

If you see the VERY FIRST message of the conversation (the beginning), set chatComplete: true.

Return only NEW content in JSON format:
{
  "messages": [...only new messages...],
  "errors": [...only new errors...],
  "files": [...only new files...],
  "uiElements": [...any newly visible buttons...],
  "chatComplete": false
}`;

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://kriptik.app',
                    'X-Title': 'KripTik AI Vision Capture',
                },
                body: JSON.stringify({
                    model: OPENROUTER_FALLBACK_CONFIG.model,
                    max_tokens: OPENROUTER_FALLBACK_CONFIG.maxTokens,
                    temperature: OPENROUTER_FALLBACK_CONFIG.temperature,
                    // HIGH thinking for complex analysis
                    thinking: {
                        type: 'enabled',
                        level: OPENROUTER_FALLBACK_CONFIG.thinkingLevel,
                    },
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
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[VisionCapture] OpenRouter error:', response.status, errorText);
                return {};
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]);

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

                    const uiElements = (parsed.uiElements || []).map((u: any) => ({
                        type: u.type || 'other',
                        location: u.location || 'unknown',
                    }));

                    return {
                        messages,
                        errors,
                        files,
                        uiElements,
                        chatComplete: parsed.chatComplete === true,
                    };
                } catch (parseError) {
                    console.error('[VisionCapture] JSON parse error:', parseError);
                }
            }
        } catch (error) {
            console.error('[VisionCapture] Analysis error:', error);
        }

        return {};
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

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
        } catch {}

        return {
            id: 'unknown',
            name: 'Unknown Platform',
            detected: false,
        };
    }

    /**
     * Auto-import captured data to KripTik
     */
    private async autoImport(
        userId: string,
        result: VisionCaptureResult
    ): Promise<{ success: boolean; projectId?: string; projectName?: string }> {
        try {
            const projectId = uuidv4();
            const projectName = `${result.platform.name} Import - ${new Date().toLocaleDateString()}`;

            const metadataStr = JSON.stringify({
                source: 'vision-capture',
                captureMode: result.captureMode,
                platform: result.platform,
                captureStats: result.captureStats,
                chatHistory: result.chatHistory,
                errors: result.errors,
                files: result.files,
                uiElements: result.uiElements,
            });

            await db.insert(projects).values({
                id: projectId,
                name: projectName,
                ownerId: userId,
                description: `Imported from ${result.platform.name} via Vision Capture (${result.captureMode}). Contains ${result.chatHistory.messageCount} messages.\n\n<!-- VISION_CAPTURE_METADATA: ${metadataStr} -->`,
                framework: 'react',
            });

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
                    captureMode: result.captureMode,
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
     * Update session progress
     */
    private updateProgress(
        session: VisionCaptureSession,
        phase: CaptureProgress['phase'],
        step: string,
        percentage: number,
        messagesFound?: number,
        errorsFound?: number,
        filesFound?: number,
        uiElementsFound?: string[]
    ): void {
        session.progress = {
            phase,
            step,
            percentage,
            messagesFound: messagesFound ?? session.progress.messagesFound,
            errorsFound: errorsFound ?? session.progress.errorsFound,
            filesFound: filesFound ?? session.progress.filesFound,
            uiElementsFound: uiElementsFound ?? session.progress.uiElementsFound,
        };

        session.events.emit('progress', { session: { ...session, events: undefined } });
    }

    /**
     * Cleanup old sessions
     */
    cleanupOldSessions(maxAgeMs: number = 3600000): void {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (session.completedAt && now - session.completedAt.getTime() > maxAgeMs) {
                this.sessions.delete(id);
            } else if (now - session.startedAt.getTime() > maxAgeMs * 2) {
                this.sessions.delete(id);
            }
        }
    }
}

// Singleton
let visionCaptureService: VisionCaptureService | null = null;

export function getVisionCaptureService(): VisionCaptureService {
    if (!visionCaptureService) {
        visionCaptureService = new VisionCaptureService();

        setInterval(() => {
            visionCaptureService?.cleanupOldSessions();
        }, 1800000);
    }
    return visionCaptureService;
}

export { VisionCaptureService };
