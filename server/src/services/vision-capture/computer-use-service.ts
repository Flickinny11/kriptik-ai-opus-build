/**
 * Computer Use Service - AI-Controlled Browser Automation
 *
 * Combines Playwright browser control with Gemini vision analysis
 * to autonomously capture content from AI builder platforms.
 *
 * The service:
 * 1. Opens a headless browser with user's cookies (for auth)
 * 2. Takes screenshots and sends to Gemini for analysis
 * 3. Executes recommended actions (scroll, click, type)
 * 4. Captures all chat messages by scrolling to top
 * 5. Extracts build logs, runtime logs, and project files
 * 6. Downloads project export (ZIP) when available
 *
 * Key Features:
 * - Configurable frame rate for video-like capture
 * - Platform-aware selectors and behaviors
 * - Progressive content extraction
 * - Automatic "Load more" button detection
 * - Robust error handling and recovery
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getBrowserWorker, BrowserWorker, Cookie } from './browser-worker.js';
import {
  getGeminiVision,
  GeminiVisionClient,
  ChatMessage,
  FileInfo,
  VisionAction,
  UIState,
} from './gemini-vision.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CaptureConfig {
  url: string;
  platform: 'lovable' | 'bolt' | 'v0' | 'create' | 'tempo' | 'replit' | 'cursor' | 'unknown';
  cookies?: Cookie[];
  fps?: number; // Frame rate for analysis (default 2, max 10)
  maxScrollAttempts?: number; // Max scroll attempts before stopping (default 100)
  captureTypes: ('chat' | 'logs' | 'files' | 'export')[];
  sessionId?: string; // Fix My App session ID
  userId?: string;
}

export interface CapturedMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: Array<{ language: string; code: string }>;
  timestamp?: string;
  index: number;
}

export interface CaptureResult {
  sessionId: string;
  success: boolean;
  chatMessages: CapturedMessage[];
  buildLogs: string[];
  runtimeLogs: string[];
  files: FileInfo[];
  exportZip?: Buffer;
  screenshots: Buffer[];
  error?: string;
  stats: {
    duration: number;
    scrollCount: number;
    clickCount: number;
    messagesFound: number;
    apiCalls: number;
    framesProcessed: number;
  };
}

export interface CaptureProgress {
  type: 'progress' | 'message_captured' | 'log_captured' | 'file_found' | 'export_started' | 'complete' | 'error';
  phase: 'initializing' | 'scrolling_to_top' | 'extracting_messages' | 'capturing_logs' | 'finding_files' | 'exporting' | 'complete';
  progress: number; // 0-100
  message: string;
  data?: unknown;
}

// Platform-specific configurations
const PLATFORM_CONFIGS: Record<string, {
  chatSelector?: string;
  loadMoreSelector?: string;
  logsSelector?: string;
  exportSelector?: string;
  fileTreeSelector?: string;
}> = {
  lovable: {
    chatSelector: '[data-testid="chat-container"], .chat-container, [class*="chat"]',
    loadMoreSelector: 'button:has-text("Load more"), button:has-text("earlier")',
    logsSelector: '[data-testid="terminal"], .terminal, [class*="console"]',
    exportSelector: 'button:has-text("Export"), button:has-text("Download")',
    fileTreeSelector: '[data-testid="file-tree"], .file-tree, [class*="files"]',
  },
  bolt: {
    chatSelector: '.chat-messages, [class*="conversation"]',
    loadMoreSelector: 'button:has-text("Load"), button:has-text("more")',
    logsSelector: '.terminal-output, [class*="terminal"]',
    exportSelector: 'button:has-text("Download"), [aria-label*="export"]',
    fileTreeSelector: '.file-explorer, [class*="explorer"]',
  },
  v0: {
    chatSelector: '.chat-container, [data-chat]',
    loadMoreSelector: 'button:has-text("Load"), button:has-text("Show more")',
    exportSelector: 'button:has-text("Export"), button:has-text("Download code")',
    fileTreeSelector: '.files-panel',
  },
  replit: {
    chatSelector: '.chat-view, [class*="chat"]',
    logsSelector: '.console-view, [class*="console"]',
    exportSelector: 'button:has-text("Download"), [data-cy="download"]',
    fileTreeSelector: '.file-tree-view',
  },
  cursor: {
    chatSelector: '.chat-panel',
    logsSelector: '.terminal-panel',
  },
  unknown: {
    // Generic selectors that might work
    chatSelector: '[class*="chat"], [class*="message"], [class*="conversation"]',
    logsSelector: '[class*="terminal"], [class*="console"], [class*="output"]',
  },
};

// =============================================================================
// COMPUTER USE SERVICE
// =============================================================================

export class ComputerUseService extends EventEmitter {
  private browserWorker: BrowserWorker;
  private visionClient: GeminiVisionClient;
  private activeSessions: Map<string, {
    browserSessionId: string;
    config: CaptureConfig;
    result: CaptureResult;
    aborted: boolean;
  }> = new Map();

  constructor() {
    super();
    this.browserWorker = getBrowserWorker();
    this.visionClient = getGeminiVision();
  }

  /**
   * Start a capture session
   */
  async startCapture(config: CaptureConfig): Promise<string> {
    const captureId = config.sessionId || uuidv4();
    const browserSessionId = `browser-${captureId}`;

    console.log(`[ComputerUse] Starting capture ${captureId} for ${config.url}`);
    console.log(`[ComputerUse] Platform: ${config.platform}, FPS: ${config.fps || 2}`);
    console.log(`[ComputerUse] Capture types: ${config.captureTypes.join(', ')}`);

    // Initialize result
    const result: CaptureResult = {
      sessionId: captureId,
      success: false,
      chatMessages: [],
      buildLogs: [],
      runtimeLogs: [],
      files: [],
      screenshots: [],
      stats: {
        duration: 0,
        scrollCount: 0,
        clickCount: 0,
        messagesFound: 0,
        apiCalls: 0,
        framesProcessed: 0,
      },
    };

    // Store session
    this.activeSessions.set(captureId, {
      browserSessionId,
      config,
      result,
      aborted: false,
    });

    // Start capture in background
    this.runCapture(captureId).catch(error => {
      console.error(`[ComputerUse] Capture ${captureId} failed:`, error);
      const session = this.activeSessions.get(captureId);
      if (session) {
        session.result.error = error.message;
        this.emitProgress(captureId, {
          type: 'error',
          phase: 'complete',
          progress: 100,
          message: `Capture failed: ${error.message}`,
        });
      }
    });

    return captureId;
  }

  /**
   * Run the capture process
   */
  private async runCapture(captureId: string): Promise<void> {
    const session = this.activeSessions.get(captureId);
    if (!session) throw new Error('Session not found');

    const { config, result, browserSessionId } = session;
    const startTime = Date.now();

    try {
      // Phase 1: Initialize browser session
      this.emitProgress(captureId, {
        type: 'progress',
        phase: 'initializing',
        progress: 5,
        message: 'Opening browser...',
      });

      await this.browserWorker.createSession(browserSessionId, config.url, {
        cookies: config.cookies,
        viewport: { width: 1920, height: 1080 },
      });

      // Wait for page to fully load
      await this.browserWorker.wait(browserSessionId, 2000);

      // Phase 2: Analyze initial UI state
      this.emitProgress(captureId, {
        type: 'progress',
        phase: 'initializing',
        progress: 10,
        message: 'Analyzing page structure...',
      });

      const screenshot = await this.browserWorker.screenshot(browserSessionId);
      result.screenshots.push(screenshot);

      const uiState = await this.visionClient.analyzeUIState(screenshot, config.platform);
      result.stats.apiCalls++;

      console.log(`[ComputerUse] UI State:`, uiState);

      // Phase 3: Capture chat messages (if requested)
      if (config.captureTypes.includes('chat') && uiState.hasChat) {
        await this.captureChatMessages(captureId, uiState);
      }

      // Phase 4: Capture logs (if requested)
      if (config.captureTypes.includes('logs')) {
        await this.captureLogs(captureId);
      }

      // Phase 5: Find files (if requested)
      if (config.captureTypes.includes('files')) {
        await this.captureFiles(captureId);
      }

      // Phase 6: Trigger export (if requested)
      if (config.captureTypes.includes('export')) {
        await this.triggerExport(captureId);
      }

      // Complete
      result.success = true;
      result.stats.duration = Date.now() - startTime;

      this.emitProgress(captureId, {
        type: 'complete',
        phase: 'complete',
        progress: 100,
        message: `Capture complete! Found ${result.chatMessages.length} messages.`,
        data: {
          messagesFound: result.chatMessages.length,
          duration: result.stats.duration,
        },
      });

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.stats.duration = Date.now() - startTime;
      throw error;
    } finally {
      // Clean up browser session
      await this.browserWorker.closeSession(browserSessionId);
    }
  }

  /**
   * Capture all chat messages by scrolling to top and extracting
   */
  private async captureChatMessages(captureId: string, initialUIState: UIState): Promise<void> {
    const session = this.activeSessions.get(captureId);
    if (!session || session.aborted) return;

    const { browserSessionId, config, result } = session;
    const fps = Math.min(config.fps || 2, 10);
    const frameDelay = 1000 / fps;
    const maxScrolls = config.maxScrollAttempts || 100;

    console.log(`[ComputerUse] Starting chat capture at ${fps} FPS`);

    // Phase 3A: Scroll to top to capture all messages
    this.emitProgress(captureId, {
      type: 'progress',
      phase: 'scrolling_to_top',
      progress: 15,
      message: 'Scrolling to beginning of conversation...',
    });

    let canScrollUp = initialUIState.canScrollUp;
    let scrollAttempts = 0;
    let noChangeCount = 0;
    let previousScreenshotHash = '';

    while (canScrollUp && scrollAttempts < maxScrolls && !session.aborted) {
      // Take screenshot
      const screenshot = await this.browserWorker.screenshot(browserSessionId);
      result.screenshots.push(screenshot);
      result.stats.framesProcessed++;

      // Check if screenshot changed (content loaded)
      const currentHash = this.simpleHash(screenshot);
      if (currentHash === previousScreenshotHash) {
        noChangeCount++;
        if (noChangeCount >= 3) {
          // No change after 3 frames, likely at top
          console.log(`[ComputerUse] No change detected, assuming at top`);
          break;
        }
      } else {
        noChangeCount = 0;
      }
      previousScreenshotHash = currentHash;

      // Analyze with vision
      const analysis = await this.visionClient.analyzeChatCapture(screenshot, {
        platform: config.platform,
        goal: 'scroll_to_top',
        previousActions: [`scroll_up x${scrollAttempts}`],
        messagesCollected: result.chatMessages.length,
      });
      result.stats.apiCalls++;

      // Extract any visible messages
      if (analysis.extracted?.messages) {
        this.mergeMessages(result.chatMessages, analysis.extracted.messages);
        if (analysis.extracted.messages.length > 0) {
          this.emitProgress(captureId, {
            type: 'message_captured',
            phase: 'scrolling_to_top',
            progress: 15 + Math.min((scrollAttempts / maxScrolls) * 25, 25),
            message: `Found ${result.chatMessages.length} messages...`,
            data: { count: result.chatMessages.length },
          });
        }
      }

      // Execute action
      if (analysis.action.type === 'SCROLL_UP') {
        await this.browserWorker.scroll(browserSessionId, {
          direction: 'up',
          amount: analysis.action.amount || 500,
        });
        result.stats.scrollCount++;
        scrollAttempts++;
      } else if (analysis.action.type === 'CLICK' && analysis.action.x && analysis.action.y) {
        // Click "Load more" button if found
        console.log(`[ComputerUse] Clicking at ${analysis.action.x}, ${analysis.action.y}: ${analysis.action.description}`);
        await this.browserWorker.click(browserSessionId, {
          x: analysis.action.x,
          y: analysis.action.y,
        });
        result.stats.clickCount++;
        await this.browserWorker.wait(browserSessionId, 1500); // Wait for content load
      } else if (analysis.action.type === 'DONE') {
        console.log(`[ComputerUse] Reached top: ${analysis.action.reason}`);
        canScrollUp = false;
      } else if (analysis.action.type === 'ERROR') {
        console.warn(`[ComputerUse] Vision error: ${analysis.action.message}`);
        // Continue anyway
      }

      // Wait for frame rate
      await this.browserWorker.wait(browserSessionId, frameDelay);
    }

    // Phase 3B: Now scroll down to extract all messages
    this.emitProgress(captureId, {
      type: 'progress',
      phase: 'extracting_messages',
      progress: 45,
      message: 'Extracting conversation content...',
    });

    let canScrollDown = true;
    scrollAttempts = 0;
    noChangeCount = 0;
    previousScreenshotHash = '';

    while (canScrollDown && scrollAttempts < maxScrolls && !session.aborted) {
      // Take screenshot
      const screenshot = await this.browserWorker.screenshot(browserSessionId);
      result.stats.framesProcessed++;

      // Check for changes
      const currentHash = this.simpleHash(screenshot);
      if (currentHash === previousScreenshotHash) {
        noChangeCount++;
        if (noChangeCount >= 3) {
          console.log(`[ComputerUse] No change detected, at bottom`);
          break;
        }
      } else {
        noChangeCount = 0;
      }
      previousScreenshotHash = currentHash;

      // Extract visible messages
      const messages = await this.visionClient.extractVisibleMessages(screenshot);
      result.stats.apiCalls++;

      if (messages.length > 0) {
        const beforeCount = result.chatMessages.length;
        this.mergeMessages(result.chatMessages, messages);
        const added = result.chatMessages.length - beforeCount;

        if (added > 0) {
          this.emitProgress(captureId, {
            type: 'message_captured',
            phase: 'extracting_messages',
            progress: 45 + Math.min((scrollAttempts / maxScrolls) * 30, 30),
            message: `Extracted ${result.chatMessages.length} messages...`,
            data: { count: result.chatMessages.length },
          });
        }
      }

      // Scroll down
      await this.browserWorker.scroll(browserSessionId, {
        direction: 'down',
        amount: 400, // Smaller scroll for better overlap
      });
      result.stats.scrollCount++;
      scrollAttempts++;

      // Frame rate delay
      await this.browserWorker.wait(browserSessionId, frameDelay);
    }

    result.stats.messagesFound = result.chatMessages.length;
    console.log(`[ComputerUse] Chat capture complete: ${result.chatMessages.length} messages`);
  }

  /**
   * Capture build and runtime logs
   */
  private async captureLogs(captureId: string): Promise<void> {
    const session = this.activeSessions.get(captureId);
    if (!session || session.aborted) return;

    const { browserSessionId, config, result } = session;

    this.emitProgress(captureId, {
      type: 'progress',
      phase: 'capturing_logs',
      progress: 80,
      message: 'Looking for build logs...',
    });

    // Take screenshot and analyze for log panels
    const screenshot = await this.browserWorker.screenshot(browserSessionId);
    const analysis = await this.visionClient.analyzeFileCapture(screenshot, {
      platform: config.platform,
      goal: 'find_files',
      currentPath: [],
      filesFound: [],
    });
    result.stats.apiCalls++;

    // Try platform-specific selectors to extract logs
    const platformConfig = PLATFORM_CONFIGS[config.platform] || PLATFORM_CONFIGS.unknown;

    if (platformConfig.logsSelector) {
      try {
        const logsContent = await this.browserWorker.evaluate(browserSessionId, () => {
          // Try to find terminal/console content
          const selectors = [
            '[data-testid="terminal"]',
            '.terminal-output',
            '.console-output',
            '[class*="terminal"]',
            '[class*="console"]',
            'pre.logs',
          ];

          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent) {
              return el.textContent;
            }
          }
          return null;
        });

        if (logsContent) {
          result.buildLogs = logsContent.split('\n').filter(line => line.trim());
          this.emitProgress(captureId, {
            type: 'log_captured',
            phase: 'capturing_logs',
            progress: 85,
            message: `Found ${result.buildLogs.length} log lines`,
          });
        }
      } catch (e) {
        console.warn(`[ComputerUse] Could not extract logs:`, e);
      }
    }
  }

  /**
   * Capture file structure
   */
  private async captureFiles(captureId: string): Promise<void> {
    const session = this.activeSessions.get(captureId);
    if (!session || session.aborted) return;

    const { browserSessionId, config, result } = session;

    this.emitProgress(captureId, {
      type: 'progress',
      phase: 'finding_files',
      progress: 88,
      message: 'Scanning file structure...',
    });

    // Take screenshot
    const screenshot = await this.browserWorker.screenshot(browserSessionId);

    // Analyze for file tree
    const analysis = await this.visionClient.analyzeFileCapture(screenshot, {
      platform: config.platform,
      goal: 'find_files',
      currentPath: [],
      filesFound: [],
    });
    result.stats.apiCalls++;

    if (analysis.extracted?.files) {
      result.files = analysis.extracted.files;
      this.emitProgress(captureId, {
        type: 'file_found',
        phase: 'finding_files',
        progress: 90,
        message: `Found ${result.files.length} files`,
        data: { files: result.files },
      });
    }
  }

  /**
   * Trigger project export/download
   */
  private async triggerExport(captureId: string): Promise<void> {
    const session = this.activeSessions.get(captureId);
    if (!session || session.aborted) return;

    const { browserSessionId, config, result } = session;

    this.emitProgress(captureId, {
      type: 'export_started',
      phase: 'exporting',
      progress: 92,
      message: 'Looking for export option...',
    });

    // Take screenshot and find export button
    const screenshot = await this.browserWorker.screenshot(browserSessionId);

    const analysis = await this.visionClient.analyzeFileCapture(screenshot, {
      platform: config.platform,
      goal: 'find_export',
      currentPath: [],
      filesFound: result.files.map(f => f.path),
    });
    result.stats.apiCalls++;

    if (analysis.action.type === 'CLICK' && analysis.action.x && analysis.action.y) {
      console.log(`[ComputerUse] Found export button at ${analysis.action.x}, ${analysis.action.y}`);

      // Click export button
      await this.browserWorker.click(browserSessionId, {
        x: analysis.action.x,
        y: analysis.action.y,
      });
      result.stats.clickCount++;

      // Wait for download dialog/action
      await this.browserWorker.wait(browserSessionId, 2000);

      // Try platform-specific export selectors
      const platformConfig = PLATFORM_CONFIGS[config.platform] || PLATFORM_CONFIGS.unknown;
      if (platformConfig.exportSelector) {
        try {
          const zipBuffer = await this.browserWorker.downloadFile(
            browserSessionId,
            platformConfig.exportSelector
          );
          if (zipBuffer) {
            result.exportZip = zipBuffer;
            this.emitProgress(captureId, {
              type: 'progress',
              phase: 'exporting',
              progress: 98,
              message: 'Project exported successfully!',
            });
          }
        } catch (e) {
          console.warn(`[ComputerUse] Export download failed:`, e);
        }
      }
    }
  }

  /**
   * Merge new messages into existing list, avoiding duplicates
   */
  private mergeMessages(existing: CapturedMessage[], newMessages: ChatMessage[]): void {
    for (const msg of newMessages) {
      // Check for duplicate by content similarity
      const isDuplicate = existing.some(e =>
        e.role === msg.role &&
        this.contentSimilarity(e.content, msg.content) > 0.9
      );

      if (!isDuplicate) {
        existing.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          codeBlocks: msg.codeBlocks,
          timestamp: msg.timestamp,
          index: existing.length,
        });
      }
    }
  }

  /**
   * Simple content similarity check
   */
  private contentSimilarity(a: string, b: string): number {
    const cleanA = a.toLowerCase().replace(/\s+/g, ' ').trim();
    const cleanB = b.toLowerCase().replace(/\s+/g, ' ').trim();

    if (cleanA === cleanB) return 1;

    // Check if one contains most of the other
    const shorter = cleanA.length < cleanB.length ? cleanA : cleanB;
    const longer = cleanA.length < cleanB.length ? cleanB : cleanA;

    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    return 0;
  }

  /**
   * Simple hash for screenshot comparison
   */
  private simpleHash(buffer: Buffer): string {
    // Sample every 1000th byte for quick comparison
    let hash = 0;
    for (let i = 0; i < buffer.length; i += 1000) {
      hash = ((hash << 5) - hash) + buffer[i];
      hash |= 0;
    }
    return hash.toString();
  }

  /**
   * Emit progress event
   */
  private emitProgress(captureId: string, progress: CaptureProgress): void {
    this.emit('progress', { captureId, ...progress });
    this.emit(`progress:${captureId}`, progress);
  }

  /**
   * Get capture result
   */
  getResult(captureId: string): CaptureResult | undefined {
    return this.activeSessions.get(captureId)?.result;
  }

  /**
   * Abort a capture session
   */
  async abortCapture(captureId: string): Promise<void> {
    const session = this.activeSessions.get(captureId);
    if (session) {
      session.aborted = true;
      await this.browserWorker.closeSession(session.browserSessionId);
      this.activeSessions.delete(captureId);
    }
  }

  /**
   * Check if capture is active
   */
  isActive(captureId: string): boolean {
    const session = this.activeSessions.get(captureId);
    return session !== undefined && !session.aborted;
  }

  /**
   * Get active capture count
   */
  getActiveCaptureCount(): number {
    return this.activeSessions.size;
  }
}

// Singleton instance
let computerUseInstance: ComputerUseService | null = null;

export function getComputerUseService(): ComputerUseService {
  if (!computerUseInstance) {
    computerUseInstance = new ComputerUseService();
  }
  return computerUseInstance;
}

export function resetComputerUseService(): void {
  computerUseInstance = null;
}
