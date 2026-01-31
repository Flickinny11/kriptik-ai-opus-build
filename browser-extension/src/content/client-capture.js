/**
 * Client-Side Capture Module
 *
 * Captures chat history, errors, and files directly from the browser
 * using Chrome extension APIs. This approach works even when Playwright
 * is unavailable (e.g., Vercel serverless deployment).
 *
 * Flow:
 * 1. Takes screenshots using chrome.tabs.captureVisibleTab
 * 2. Sends screenshots to /api/extension/vision-extract for Gemini 3 Flash analysis
 * 3. Scrolls the page via DOM manipulation
 * 4. Continues until all content is captured
 * 5. Sends complete results to KripTik for project import
 *
 * Uses: google/gemini-3-flash-preview via OpenRouter for vision analysis
 */

const ClientCapture = {
  // Session state
  activeSession: null,
  isCapturing: false,
  aborted: false,
  
  // Capture results
  allMessages: [],
  allErrors: [],
  allFiles: [],
  uiElementsFound: [],
  screenshots: [],
  
  // Configuration
  config: {
    captureIntervalMs: 500, // 2fps
    maxScreenshots: 100,
    maxConsecutiveNoNewContent: 5,
    scrollAmount: 0.7, // 70% of viewport
    apiEndpoint: null,
    sessionToken: null,
  },
  
  // Callbacks
  onProgress: null,
  onComplete: null,
  onError: null,

  /**
   * Initialize capture with session data
   * @param {Object} options - Configuration options
   */
  init(options = {}) {
    // Get session data from storage or window
    const session = window.__kriptikSession || {};
    
    this.config.apiEndpoint = options.apiEndpoint || session.apiEndpoint || 'https://kriptik.app';
    this.config.sessionToken = options.sessionToken || session.token || '';
    
    console.log('[ClientCapture] Initialized with endpoint:', this.config.apiEndpoint);
  },

  /**
   * Start capturing the current page
   * @param {Object} platform - Platform configuration
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async start(platform) {
    if (this.isCapturing) {
      return { success: false, error: 'Capture already in progress' };
    }

    // Initialize
    this.init();
    this.isCapturing = true;
    this.aborted = false;
    this.allMessages = [];
    this.allErrors = [];
    this.allFiles = [];
    this.uiElementsFound = [];
    this.screenshots = [];

    const startTime = Date.now();
    let screenshotCount = 0;
    let consecutiveNoNewContent = 0;
    let previousMessageCount = 0;

    console.log('[ClientCapture] Starting capture for platform:', platform.name);

    try {
      // First scroll to top of the chat/conversation area
      await this.scrollToTop();
      await this.wait(1000);

      // Capture loop
      while (
        this.isCapturing &&
        !this.aborted &&
        screenshotCount < this.config.maxScreenshots &&
        consecutiveNoNewContent < this.config.maxConsecutiveNoNewContent
      ) {
        // Take screenshot
        const screenshot = await this.captureScreenshot();
        if (!screenshot) {
          console.warn('[ClientCapture] Failed to capture screenshot, retrying...');
          await this.wait(500);
          continue;
        }

        this.screenshots.push(screenshot);
        screenshotCount++;

        // Analyze with Gemini 3 Flash via OpenRouter
        const analysis = await this.analyzeScreenshot(screenshot, platform.name, screenshotCount === 1);

        if (analysis) {
          // Merge new messages (deduplicate by content)
          if (analysis.messages) {
            for (const msg of analysis.messages) {
              if (!this.allMessages.some(m => m.content === msg.content)) {
                this.allMessages.push(msg);
              }
            }
          }

          // Merge new errors
          if (analysis.errors) {
            for (const err of analysis.errors) {
              if (!this.allErrors.some(e => e.message === err.message)) {
                this.allErrors.push(err);
              }
            }
          }

          // Merge new files
          if (analysis.files) {
            for (const file of analysis.files) {
              if (!this.allFiles.some(f => f.path === file.path)) {
                this.allFiles.push(file);
              }
            }
          }

          // Track UI elements
          if (analysis.uiElements) {
            for (const elem of analysis.uiElements) {
              if (!this.uiElementsFound.some(e => e.type === elem.type)) {
                this.uiElementsFound.push(elem);
              }
            }
          }

          // Check if chat is complete
          if (analysis.chatComplete) {
            console.log('[ClientCapture] AI reports chat history is complete');
            break;
          }
        }

        // Track progress
        if (this.allMessages.length === previousMessageCount) {
          consecutiveNoNewContent++;
        } else {
          consecutiveNoNewContent = 0;
          previousMessageCount = this.allMessages.length;
        }

        // Report progress
        if (this.onProgress) {
          this.onProgress({
            screenshotCount,
            messagesFound: this.allMessages.length,
            errorsFound: this.allErrors.length,
            filesFound: this.allFiles.length,
            uiElements: this.uiElementsFound.map(e => e.type),
          });
        }

        // Scroll down
        const scrolled = await this.scrollDown();
        if (!scrolled && screenshotCount > 3) {
          consecutiveNoNewContent++;
        }

        await this.wait(this.config.captureIntervalMs);
      }

      // Calculate stats
      const duration = Date.now() - startTime;
      const estimatedCost = screenshotCount * 0.006; // ~$0.006 per API call

      // Build result
      const result = {
        success: true,
        platform: {
          id: platform.id,
          name: platform.name,
        },
        chatHistory: {
          messageCount: this.allMessages.length,
          messages: this.allMessages,
        },
        errors: {
          count: this.allErrors.length,
          entries: this.allErrors,
        },
        files: {
          count: this.allFiles.length,
          entries: this.allFiles,
        },
        uiElements: this.uiElementsFound,
        captureStats: {
          duration,
          screenshotCount,
          estimatedCost,
        },
      };

      // Send to KripTik
      const importResult = await this.sendToKripTik(result);
      if (importResult.success) {
        result.projectId = importResult.projectId;
        result.projectName = importResult.projectName;
      }

      console.log('[ClientCapture] Capture complete:', {
        messages: this.allMessages.length,
        errors: this.allErrors.length,
        files: this.allFiles.length,
        screenshots: screenshotCount,
        duration,
      });

      if (this.onComplete) {
        this.onComplete({ result });
      }

      return { success: true, result };

    } catch (error) {
      console.error('[ClientCapture] Error:', error);
      
      if (this.onError) {
        this.onError({ message: error.message });
      }

      return { success: false, error: error.message };

    } finally {
      this.isCapturing = false;
    }
  },

  /**
   * Capture screenshot using Chrome extension API
   */
  async captureScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[ClientCapture] Screenshot error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(response?.screenshot || null);
      });
    });
  },

  /**
   * Analyze screenshot with Gemini 3 Flash via backend
   * @param {string} screenshotBase64 - Base64 encoded screenshot
   * @param {string} platformName - Name of the platform
   * @param {boolean} isFirst - Whether this is the first screenshot
   */
  async analyzeScreenshot(screenshotBase64, platformName, isFirst) {
    const prompt = isFirst
      ? this.getFirstFramePrompt(platformName)
      : this.getContinuePrompt(platformName);

    try {
      // Use the vision-analyze endpoint (serverless compatible)
      const response = await fetch(`${this.config.apiEndpoint}/api/extension/vision-analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.sessionToken ? `Bearer ${this.config.sessionToken}` : '',
        },
        body: JSON.stringify({
          screenshot: screenshotBase64,
          prompt,
          context: {
            platform: platformName,
            messagesFound: this.allMessages.length,
            isFirstFrame: isFirst,
          },
        }),
      });

      if (!response.ok) {
        console.error('[ClientCapture] Vision API error:', response.status);
        return null;
      }

      const data = await response.json();
      return data.analysis || null;

    } catch (error) {
      console.error('[ClientCapture] Analysis error:', error);
      return null;
    }
  },

  /**
   * Get prompt for first frame analysis
   */
  getFirstFramePrompt(platformName) {
    return `You are analyzing a screenshot of ${platformName}, an AI code builder platform.
Your goal is to COMPLETELY capture all content. We will scroll through the entire page.

CURRENT STATUS: This is the FIRST frame. Messages found so far: 0

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
   If you see the very first message, set chatComplete: true only if ALL messages are visible.

Return JSON:
{
  "messages": [{"role": "user"|"assistant", "content": "...", "codeBlocks": [{"language": "...", "code": "..."}]}],
  "errors": [{"type": "...", "severity": "error"|"warning", "message": "..."}],
  "files": [{"path": "...", "type": "file"|"folder"}],
  "uiElements": [{"type": "export_button"|"download_button"|"build_log"|"zip_button", "location": "top-right"}],
  "chatComplete": false
}

Be thorough - extract EVERYTHING visible.`;
  },

  /**
   * Get prompt for continuation frames
   */
  getContinuePrompt(platformName) {
    return `Continue analyzing ${platformName}. Frame ${this.allMessages.length > 0 ? `(${this.allMessages.length} messages found so far)` : ''}.

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
  },

  /**
   * Scroll to top of the chat area
   */
  async scrollToTop() {
    // Try to find and scroll the chat container
    const chatSelectors = [
      '[class*="chat"]',
      '[class*="messages"]',
      '[class*="conversation"]',
      '[class*="thread"]',
      'main',
    ];

    let chatContainer = null;
    for (const selector of chatSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && el.scrollHeight > el.clientHeight) {
          chatContainer = el;
          break;
        }
      } catch (e) {}
    }

    if (chatContainer) {
      chatContainer.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }

    await this.wait(500);
  },

  /**
   * Scroll down by viewport height
   * @returns {boolean} Whether scroll was possible
   */
  async scrollDown() {
    const scrollBefore = window.scrollY;
    
    // Try chat container first
    const chatSelectors = [
      '[class*="chat"]',
      '[class*="messages"]',
      '[class*="conversation"]',
      '[class*="thread"]',
    ];

    for (const selector of chatSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && el.scrollHeight > el.clientHeight) {
          const before = el.scrollTop;
          el.scrollTop += el.clientHeight * this.config.scrollAmount;
          if (el.scrollTop !== before) {
            return true;
          }
        }
      } catch (e) {}
    }

    // Fallback to window scroll
    window.scrollBy(0, window.innerHeight * this.config.scrollAmount);
    return window.scrollY !== scrollBefore;
  },

  /**
   * Send captured results to KripTik
   */
  async sendToKripTik(result) {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/extension/import`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.sessionToken ? `Bearer ${this.config.sessionToken}` : '',
        },
        body: JSON.stringify({
          provider: 'client-capture',
          source: result.platform.name,
          chatHistory: result.chatHistory.messages,
          errors: result.errors.entries,
          files: result.files.entries,
          captureStats: result.captureStats,
        }),
      });

      if (!response.ok) {
        console.error('[ClientCapture] Import failed:', response.status);
        return { success: false };
      }

      const data = await response.json();
      return {
        success: true,
        projectId: data.projectId,
        projectName: data.projectName,
      };

    } catch (error) {
      console.error('[ClientCapture] Import error:', error);
      return { success: false };
    }
  },

  /**
   * Stop the capture
   */
  stop() {
    this.aborted = true;
    this.isCapturing = false;
  },

  /**
   * Set callbacks
   */
  setCallbacks({ onProgress, onComplete, onError }) {
    if (onProgress) this.onProgress = onProgress;
    if (onComplete) this.onComplete = onComplete;
    if (onError) this.onError = onError;
  },

  /**
   * Wait helper
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};

// Make available globally
window.ClientCapture = ClientCapture;

console.log('[ClientCapture] Module loaded');
