/**
 * Vision Capture Orchestrator
 *
 * Coordinates the full capture flow using vision-based browser automation.
 * Works with any AI builder platform without relying on DOM selectors.
 *
 * Phases:
 * 1. Initial Assessment - Understand the UI layout
 * 2. Chat Capture - Scroll to top, then capture all messages
 * 3. File Capture - Find and capture project structure
 * 4. Error/Console Capture - Capture any visible errors
 * 5. Export - Find and trigger project export if available
 */

import { BrowserWorker, BrowserSession, getBrowserWorker, Cookie } from './browser-worker.js';
import {
  GeminiVisionClient,
  getGeminiVision,
  ChatMessage,
  FileInfo,
  ErrorInfo,
  UIState,
  VisionAction
} from './gemini-vision.js';

export interface CaptureSession {
  id: string;
  url: string;
  platform: string;
  status: CaptureStatus;
  progress: CaptureProgress;
  result: CaptureResult | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export type CaptureStatus =
  | 'initializing'
  | 'assessing'
  | 'capturing_chat'
  | 'capturing_files'
  | 'capturing_errors'
  | 'exporting'
  | 'completed'
  | 'failed';

export interface CaptureProgress {
  phase: string;
  step: string;
  messagesFound: number;
  filesFound: number;
  errorsFound: number;
  screenshotsTaken: number;
  actionsPerformed: number;
}

export interface CaptureResult {
  chatHistory: ChatMessage[];
  files: FileInfo[];
  errors: ErrorInfo[];
  uiState: UIState;
  screenshots: Buffer[];
  exportZip: Buffer | null;
  captureStats: {
    duration: number;
    apiCalls: number;
    estimatedCost: number;
  };
}

export interface CaptureOptions {
  cookies?: Cookie[];
  maxScrollAttempts?: number;
  maxApiCalls?: number;
  captureScreenshots?: boolean;
  skipFileCapture?: boolean;
  skipErrorCapture?: boolean;
  viewport?: { width: number; height: number };
}

const DEFAULT_OPTIONS: Required<CaptureOptions> = {
  cookies: [],
  maxScrollAttempts: 50,
  maxApiCalls: 100,
  captureScreenshots: true,
  skipFileCapture: false,
  skipErrorCapture: false,
  viewport: { width: 1920, height: 1080 }
};

export class CaptureOrchestrator {
  private browserWorker: BrowserWorker;
  private visionClient: GeminiVisionClient;
  private sessions: Map<string, CaptureSession> = new Map();
  private onProgress: ((session: CaptureSession) => void) | null = null;

  constructor() {
    this.browserWorker = getBrowserWorker();
    this.visionClient = getGeminiVision();
  }

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: (session: CaptureSession) => void): void {
    this.onProgress = callback;
  }

  /**
   * Start a capture session
   */
  async startCapture(
    sessionId: string,
    url: string,
    options: CaptureOptions = {}
  ): Promise<CaptureSession> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const session: CaptureSession = {
      id: sessionId,
      url,
      platform: 'unknown',
      status: 'initializing',
      progress: {
        phase: 'initialization',
        step: 'Creating browser session',
        messagesFound: 0,
        filesFound: 0,
        errorsFound: 0,
        screenshotsTaken: 0,
        actionsPerformed: 0
      },
      result: null,
      error: null,
      startedAt: new Date(),
      completedAt: null
    };

    this.sessions.set(sessionId, session);
    this.emitProgress(session);

    try {
      // Phase 0: Create browser session
      console.log(`[CaptureOrchestrator] Starting capture for ${url}`);

      const browserSession = await this.browserWorker.createSession(sessionId, url, {
        cookies: opts.cookies,
        viewport: opts.viewport
      });

      session.platform = browserSession.platform;
      this.emitProgress(session);

      // Phase 1: Initial assessment
      session.status = 'assessing';
      session.progress.phase = 'assessment';
      session.progress.step = 'Analyzing UI layout';
      this.emitProgress(session);

      const initialScreenshot = await this.browserWorker.screenshot(sessionId);
      session.progress.screenshotsTaken++;

      const uiState = await this.visionClient.analyzeUIState(initialScreenshot, session.platform);
      console.log(`[CaptureOrchestrator] UI State:`, uiState);

      // Initialize result
      const result: CaptureResult = {
        chatHistory: [],
        files: [],
        errors: [],
        uiState,
        screenshots: opts.captureScreenshots ? [initialScreenshot] : [],
        exportZip: null,
        captureStats: {
          duration: 0,
          apiCalls: 1,
          estimatedCost: 0.0003 // Base cost for one image
        }
      };

      // Phase 2: Chat capture
      if (uiState.hasChat) {
        session.status = 'capturing_chat';
        session.progress.phase = 'chat_capture';
        this.emitProgress(session);

        const chatResult = await this.captureChatHistory(sessionId, session, opts);
        result.chatHistory = chatResult.messages;
        result.captureStats.apiCalls += chatResult.apiCalls;
        result.captureStats.estimatedCost += chatResult.cost;

        if (opts.captureScreenshots) {
          result.screenshots.push(...chatResult.screenshots);
        }
      }

      // Phase 3: File capture
      if (!opts.skipFileCapture && uiState.hasSidebar) {
        session.status = 'capturing_files';
        session.progress.phase = 'file_capture';
        this.emitProgress(session);

        const fileResult = await this.captureFiles(sessionId, session, opts);
        result.files = fileResult.files;
        result.captureStats.apiCalls += fileResult.apiCalls;
        result.captureStats.estimatedCost += fileResult.cost;
      }

      // Phase 4: Error capture
      if (!opts.skipErrorCapture && uiState.hasTerminal) {
        session.status = 'capturing_errors';
        session.progress.phase = 'error_capture';
        this.emitProgress(session);

        const errorResult = await this.captureErrors(sessionId, session, opts);
        result.errors = errorResult.errors;
        result.captureStats.apiCalls += errorResult.apiCalls;
        result.captureStats.estimatedCost += errorResult.cost;
      }

      // Phase 5: Export (try to find download/export button)
      session.status = 'exporting';
      session.progress.phase = 'export';
      session.progress.step = 'Looking for export option';
      this.emitProgress(session);

      const exportResult = await this.attemptExport(sessionId, session, opts);
      if (exportResult.zip) {
        result.exportZip = exportResult.zip;
      }
      result.captureStats.apiCalls += exportResult.apiCalls;
      result.captureStats.estimatedCost += exportResult.cost;

      // Complete
      session.status = 'completed';
      session.progress.phase = 'completed';
      session.progress.step = 'Capture complete';
      session.completedAt = new Date();
      result.captureStats.duration = session.completedAt.getTime() - session.startedAt.getTime();
      session.result = result;

      console.log(`[CaptureOrchestrator] Capture complete:`, {
        messages: result.chatHistory.length,
        files: result.files.length,
        errors: result.errors.length,
        duration: result.captureStats.duration,
        cost: result.captureStats.estimatedCost.toFixed(4)
      });

      this.emitProgress(session);
      return session;

    } catch (error: any) {
      console.error(`[CaptureOrchestrator] Capture failed:`, error);
      session.status = 'failed';
      session.error = error.message;
      session.completedAt = new Date();
      this.emitProgress(session);

      // Clean up browser session
      await this.browserWorker.closeSession(sessionId);

      return session;
    }
  }

  /**
   * Capture chat history by scrolling and extracting
   */
  private async captureChatHistory(
    sessionId: string,
    session: CaptureSession,
    opts: Required<CaptureOptions>
  ): Promise<{ messages: ChatMessage[]; screenshots: Buffer[]; apiCalls: number; cost: number }> {
    const messages: ChatMessage[] = [];
    const screenshots: Buffer[] = [];
    const seenContent = new Set<string>();
    let apiCalls = 0;
    let scrollAttempts = 0;
    const previousActions: string[] = [];

    // Step 1: Scroll to top (click load more buttons)
    session.progress.step = 'Scrolling to top of chat...';
    this.emitProgress(session);

    let atTop = false;
    while (!atTop && scrollAttempts < opts.maxScrollAttempts && apiCalls < opts.maxApiCalls) {
      const screenshot = await this.browserWorker.screenshot(sessionId);
      session.progress.screenshotsTaken++;
      screenshots.push(screenshot);

      const analysis = await this.visionClient.analyzeChatCapture(screenshot, {
        platform: session.platform,
        goal: 'scroll_to_top',
        previousActions,
        messagesCollected: messages.length
      });
      apiCalls++;

      console.log(`[CaptureOrchestrator] Scroll to top - Action: ${analysis.action.type}, Reasoning: ${analysis.reasoning}`);
      previousActions.push(analysis.action.type);

      // Extract any visible messages while scrolling
      if (analysis.extracted.messages && analysis.extracted.messages.length > 0) {
        for (const msg of analysis.extracted.messages) {
          const contentHash = this.hashContent(msg.content);
          if (!seenContent.has(contentHash)) {
            seenContent.add(contentHash);
            messages.unshift(msg); // Add to beginning since we're scrolling up
            session.progress.messagesFound = messages.length;
          }
        }
      }

      // Execute the action
      await this.executeAction(sessionId, analysis.action);
      session.progress.actionsPerformed++;
      scrollAttempts++;

      if (analysis.action.type === 'DONE' || analysis.action.type === 'ERROR') {
        atTop = true;
      }

      this.emitProgress(session);

      // Small delay to let UI settle
      await this.browserWorker.wait(sessionId, 300);
    }

    // Step 2: Scroll down and extract all messages
    session.progress.step = 'Extracting messages...';
    this.emitProgress(session);

    let atBottom = false;
    scrollAttempts = 0;
    previousActions.length = 0;

    while (!atBottom && scrollAttempts < opts.maxScrollAttempts && apiCalls < opts.maxApiCalls) {
      const screenshot = await this.browserWorker.screenshot(sessionId);
      session.progress.screenshotsTaken++;
      screenshots.push(screenshot);

      // Extract messages from current view
      const extractedMessages = await this.visionClient.extractVisibleMessages(screenshot);
      apiCalls++;

      for (const msg of extractedMessages) {
        const contentHash = this.hashContent(msg.content);
        if (!seenContent.has(contentHash)) {
          seenContent.add(contentHash);
          messages.push(msg);
          session.progress.messagesFound = messages.length;
        }
      }

      // Check if we need to scroll more
      const analysis = await this.visionClient.analyzeChatCapture(screenshot, {
        platform: session.platform,
        goal: 'extract_messages',
        previousActions,
        messagesCollected: messages.length
      });
      apiCalls++;

      console.log(`[CaptureOrchestrator] Extract - Action: ${analysis.action.type}, Messages: ${messages.length}`);
      previousActions.push(analysis.action.type);

      if (analysis.action.type === 'SCROLL_DOWN') {
        await this.browserWorker.scroll(sessionId, { direction: 'down', amount: 500 });
        session.progress.actionsPerformed++;
        scrollAttempts++;
      } else if (analysis.action.type === 'DONE' || analysis.action.type === 'ERROR') {
        atBottom = true;
      }

      this.emitProgress(session);
      await this.browserWorker.wait(sessionId, 300);
    }

    const cost = apiCalls * 0.0003; // ~$0.0003 per image analysis
    return { messages, screenshots, apiCalls, cost };
  }

  /**
   * Capture file structure
   */
  private async captureFiles(
    sessionId: string,
    session: CaptureSession,
    opts: Required<CaptureOptions>
  ): Promise<{ files: FileInfo[]; apiCalls: number; cost: number }> {
    const files: FileInfo[] = [];
    let apiCalls = 0;

    session.progress.step = 'Scanning file tree...';
    this.emitProgress(session);

    // Take screenshot and analyze for files
    const screenshot = await this.browserWorker.screenshot(sessionId);
    session.progress.screenshotsTaken++;

    const analysis = await this.visionClient.analyzeFileCapture(screenshot, {
      platform: session.platform,
      goal: 'find_files',
      currentPath: [],
      filesFound: []
    });
    apiCalls++;

    if (analysis.extracted.files) {
      files.push(...analysis.extracted.files);
      session.progress.filesFound = files.length;
    }

    this.emitProgress(session);

    const cost = apiCalls * 0.0003;
    return { files, apiCalls, cost };
  }

  /**
   * Capture errors from terminal/console
   */
  private async captureErrors(
    sessionId: string,
    session: CaptureSession,
    opts: Required<CaptureOptions>
  ): Promise<{ errors: ErrorInfo[]; apiCalls: number; cost: number }> {
    const errors: ErrorInfo[] = [];
    let apiCalls = 0;

    session.progress.step = 'Checking for errors...';
    this.emitProgress(session);

    // Look for terminal/console panel
    // This is simplified - in practice we'd click to open terminal if not visible
    const screenshot = await this.browserWorker.screenshot(sessionId);
    session.progress.screenshotsTaken++;

    // For now just return empty - we'll enhance this later
    // The chat messages often contain error context anyway

    const cost = apiCalls * 0.0003;
    return { errors, apiCalls, cost };
  }

  /**
   * Attempt to find and trigger export/download
   */
  private async attemptExport(
    sessionId: string,
    session: CaptureSession,
    opts: Required<CaptureOptions>
  ): Promise<{ zip: Buffer | null; apiCalls: number; cost: number }> {
    let apiCalls = 0;

    session.progress.step = 'Looking for export button...';
    this.emitProgress(session);

    const screenshot = await this.browserWorker.screenshot(sessionId);
    session.progress.screenshotsTaken++;

    const analysis = await this.visionClient.analyzeFileCapture(screenshot, {
      platform: session.platform,
      goal: 'find_export',
      currentPath: [],
      filesFound: []
    });
    apiCalls++;

    if (analysis.action.type === 'CLICK' && analysis.confidence > 0.7) {
      console.log(`[CaptureOrchestrator] Found export button at (${analysis.action.x}, ${analysis.action.y})`);

      // Try to download
      // This is platform-specific and may need refinement
      try {
        // Click the export button
        await this.browserWorker.click(sessionId, {
          x: analysis.action.x,
          y: analysis.action.y
        });
        session.progress.actionsPerformed++;

        // Wait for any download to start
        await this.browserWorker.wait(sessionId, 2000);

        // Check if a download modal appeared, etc.
        // This would need more sophisticated handling per platform
      } catch (e) {
        console.warn(`[CaptureOrchestrator] Export attempt failed:`, e);
      }
    }

    const cost = apiCalls * 0.0003;
    return { zip: null, apiCalls, cost };
  }

  /**
   * Execute a vision action
   */
  private async executeAction(sessionId: string, action: VisionAction): Promise<void> {
    switch (action.type) {
      case 'SCROLL_UP':
        await this.browserWorker.scroll(sessionId, {
          direction: 'up',
          amount: action.amount || 500
        });
        break;

      case 'SCROLL_DOWN':
        await this.browserWorker.scroll(sessionId, {
          direction: 'down',
          amount: action.amount || 500
        });
        break;

      case 'CLICK':
        await this.browserWorker.click(sessionId, {
          x: action.x,
          y: action.y
        });
        break;

      case 'TYPE':
        await this.browserWorker.type(sessionId, action.text);
        break;

      case 'WAIT':
        await this.browserWorker.wait(sessionId, action.ms);
        break;

      case 'SCREENSHOT':
        // Already taking screenshots
        break;

      case 'DONE':
      case 'ERROR':
        // No action needed
        break;
    }
  }

  /**
   * Hash content for deduplication
   */
  private hashContent(content: string): string {
    // Simple hash - just use first 100 chars normalized
    return content.slice(0, 100).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Emit progress update
   */
  private emitProgress(session: CaptureSession): void {
    if (this.onProgress) {
      this.onProgress(session);
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): CaptureSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Cancel a capture session
   */
  async cancelCapture(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.error = 'Cancelled by user';
      session.completedAt = new Date();
      this.emitProgress(session);
    }
    await this.browserWorker.closeSession(sessionId);
  }

  /**
   * Clean up all sessions
   */
  async cleanup(): Promise<void> {
    await this.browserWorker.closeAll();
    this.sessions.clear();
  }
}

// Singleton instance
let orchestratorInstance: CaptureOrchestrator | null = null;

export function getCaptureOrchestrator(): CaptureOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new CaptureOrchestrator();
  }
  return orchestratorInstance;
}
