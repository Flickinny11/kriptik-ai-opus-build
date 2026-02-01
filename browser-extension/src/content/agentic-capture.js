/**
 * Agentic Capture Module - January 2026 Architecture
 *
 * Uses UI-TARS 1.5-7B (bytedance/ui-tars-1.5-7b) for UI understanding
 * and action planning. This model is state-of-the-art for GUI automation
 * (outperforms Claude and GPT-4o on OSWorld, WebVoyager, AndroidWorld).
 *
 * Key features:
 * - Accessibility-based element selection (not CSS selectors)
 * - Ref-based clicking for React apps (handles dynamic class names)
 * - Agent loop: screenshot -> AI analysis -> action -> repeat
 * - Works on v0.app, Lovable, Bolt, and other AI builders
 *
 * Flow:
 * 1. Capture screenshot + accessibility snapshot
 * 2. Send to UI-TARS via OpenRouter for action planning
 * 3. Execute the action (click, scroll, type)
 * 4. Capture content as we go
 * 5. Repeat until task complete
 */

const AgenticCapture = {
  // Session state
  sessionId: null,
  isRunning: false,
  aborted: false,

  // Captured data
  chatMessages: [],
  errors: [],
  files: [],
  uiElements: [],
  screenshots: [],

  // Configuration
  config: {
    apiEndpoint: null,
    sessionToken: null,
    maxIterations: 100,
    actionDelayMs: 300,  // Delay between actions for UI to update
    model: 'bytedance/ui-tars-1.5-7b',  // SOTA GUI automation model
    fallbackModel: 'google/gemini-3-flash-preview',  // Fallback with Agentic Vision
  },

  // Callbacks
  onProgress: null,
  onComplete: null,
  onError: null,

  /**
   * Initialize with session data
   */
  init(options = {}) {
    const session = window.__kriptikSession || {};
    this.config.apiEndpoint = options.apiEndpoint || session.apiEndpoint || 'https://kriptik.app';
    this.config.sessionToken = options.sessionToken || session.token || '';
    this.sessionId = `agentic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log('[AgenticCapture] Initialized with UI-TARS model');
    console.log('[AgenticCapture] Endpoint:', this.config.apiEndpoint);
  },

  /**
   * Start agentic capture for a platform
   * @param {Object} platform - Platform info { id, name }
   * @param {Object} task - Task to perform { type: 'capture_chat' | 'capture_all' | 'find_export' }
   */
  async start(platform, task = { type: 'capture_all' }) {
    if (this.isRunning) {
      return { success: false, error: 'Capture already in progress' };
    }

    this.init();
    this.isRunning = true;
    this.aborted = false;
    this.chatMessages = [];
    this.errors = [];
    this.files = [];
    this.uiElements = [];
    this.screenshots = [];

    const startTime = Date.now();
    let iteration = 0;
    let actionHistory = [];
    let taskComplete = false;

    console.log(`[AgenticCapture] Starting ${task.type} for platform: ${platform.name}`);

    try {
      // Phase 1: Initial orientation - understand the page
      this.reportProgress('starting', 'Analyzing page layout...');

      const initialState = await this.capturePageState();
      if (!initialState.success) {
        throw new Error('Failed to capture initial page state');
      }

      // Phase 2: Agentic loop
      while (
        this.isRunning &&
        !this.aborted &&
        !taskComplete &&
        iteration < this.config.maxIterations
      ) {
        iteration++;

        // Capture current state
        const pageState = await this.capturePageState();
        if (!pageState.success) {
          console.warn('[AgenticCapture] Failed to capture state, retrying...');
          await this.wait(500);
          continue;
        }

        // Ask AI what action to take
        const decision = await this.getAIDecision(
          pageState,
          platform,
          task,
          actionHistory,
          this.chatMessages.length
        );

        if (!decision.success) {
          console.warn('[AgenticCapture] AI decision failed, retrying...');
          await this.wait(500);
          continue;
        }

        // Process the AI response
        const { action, extractedData, reasoning, isTaskComplete } = decision;

        // Store any extracted data
        if (extractedData) {
          this.mergeExtractedData(extractedData);
        }

        // Log the decision
        console.log(`[AgenticCapture] Iteration ${iteration}: ${action.type} - ${reasoning}`);
        actionHistory.push({ iteration, action: action.type, reasoning });

        // Check if task is complete
        if (isTaskComplete) {
          taskComplete = true;
          this.reportProgress('completing', 'Task complete, finalizing...');
          break;
        }

        // Execute the action
        const actionResult = await this.executeAction(action);
        if (!actionResult.success) {
          console.warn(`[AgenticCapture] Action failed: ${actionResult.error}`);
          actionHistory.push({ iteration, error: actionResult.error });
        }

        // Wait for UI to update
        await this.wait(this.config.actionDelayMs);

        // Report progress
        this.reportProgress('capturing', `Iteration ${iteration}: ${this.chatMessages.length} messages found`);
      }

      // Build final result
      const duration = Date.now() - startTime;
      const result = {
        success: true,
        sessionId: this.sessionId,
        platform: { id: platform.id, name: platform.name },
        chatHistory: {
          messageCount: this.chatMessages.length,
          messages: this.chatMessages,
        },
        errors: {
          count: this.errors.length,
          entries: this.errors,
        },
        files: {
          count: this.files.length,
          entries: this.files,
        },
        uiElements: this.uiElements,
        captureStats: {
          duration,
          iterations: iteration,
          actionsPerformed: actionHistory.length,
          estimatedCost: iteration * 0.0003,  // UI-TARS is very cheap
        },
      };

      // Send to KripTik
      const importResult = await this.sendToKripTik(result);
      if (importResult.success) {
        result.projectId = importResult.projectId;
        result.projectName = importResult.projectName;
      }

      console.log('[AgenticCapture] Complete:', {
        messages: this.chatMessages.length,
        iterations: iteration,
        duration,
      });

      if (this.onComplete) {
        this.onComplete({ result });
      }

      return { success: true, result };

    } catch (error) {
      console.error('[AgenticCapture] Error:', error);
      if (this.onError) {
        this.onError({ message: error.message });
      }
      return { success: false, error: error.message };

    } finally {
      this.isRunning = false;
    }
  },

  /**
   * Capture current page state (screenshot + accessibility tree)
   */
  async capturePageState() {
    try {
      // Capture screenshot
      const screenshot = await this.captureScreenshot();
      if (!screenshot) {
        return { success: false, error: 'Screenshot capture failed' };
      }

      // Build accessibility snapshot
      const accessibilitySnapshot = this.buildAccessibilitySnapshot();

      // Get visible text content
      const visibleText = this.getVisibleText();

      // Get scroll position info
      const scrollInfo = this.getScrollInfo();

      return {
        success: true,
        screenshot,
        accessibilitySnapshot,
        visibleText,
        scrollInfo,
        timestamp: Date.now(),
      };

    } catch (error) {
      console.error('[AgenticCapture] capturePageState error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Build accessibility snapshot with ref-based element IDs
   * This is similar to what agent-browser uses - much more reliable than CSS selectors
   */
  buildAccessibilitySnapshot() {
    const elements = [];
    let refCounter = 0;

    const processNode = (node, depth = 0) => {
      if (depth > 10) return;  // Limit depth

      // Skip hidden elements
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return;

      const rect = node.getBoundingClientRect();
      // Skip off-screen elements
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      // Get element info
      const tagName = node.tagName.toLowerCase();
      const role = node.getAttribute('role') || this.getImplicitRole(tagName);
      const ariaLabel = node.getAttribute('aria-label');
      const text = this.getElementText(node);
      const isInteractive = this.isInteractiveElement(node);

      // Only include meaningful elements
      if (isInteractive || role || ariaLabel || (text && text.length < 200)) {
        const ref = `@e${refCounter++}`;

        // Store ref on the element for later use
        node.dataset.kriptikRef = ref;

        elements.push({
          ref,
          tagName,
          role,
          ariaLabel,
          text: text ? text.substring(0, 100) : null,
          isInteractive,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          attributes: {
            id: node.id || null,
            type: node.getAttribute('type'),
            href: node.getAttribute('href'),
            placeholder: node.getAttribute('placeholder'),
            value: node.value || null,
          },
        });
      }

      // Process children
      for (const child of node.children) {
        processNode(child, depth + 1);
      }
    };

    processNode(document.body);

    return {
      elementCount: elements.length,
      elements,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  },

  /**
   * Get implicit ARIA role for common elements
   */
  getImplicitRole(tagName) {
    const roleMap = {
      'button': 'button',
      'a': 'link',
      'input': 'textbox',
      'textarea': 'textbox',
      'select': 'combobox',
      'img': 'img',
      'nav': 'navigation',
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo',
      'aside': 'complementary',
      'article': 'article',
      'section': 'region',
      'form': 'form',
      'table': 'table',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem',
    };
    return roleMap[tagName] || null;
  },

  /**
   * Get text content of an element (without children's text)
   */
  getElementText(node) {
    // For inputs, return placeholder or value
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
      return node.placeholder || node.value || '';
    }

    // For buttons/links, get direct text
    if (node.tagName === 'BUTTON' || node.tagName === 'A') {
      return node.textContent?.trim().substring(0, 100) || '';
    }

    // For other elements, get immediate text nodes only
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      }
    }
    return text.trim().substring(0, 100);
  },

  /**
   * Check if element is interactive
   */
  isInteractiveElement(node) {
    const interactiveTags = ['button', 'a', 'input', 'textarea', 'select', 'details', 'summary'];
    if (interactiveTags.includes(node.tagName.toLowerCase())) return true;
    if (node.getAttribute('role') === 'button') return true;
    if (node.getAttribute('tabindex') && node.getAttribute('tabindex') !== '-1') return true;
    if (node.onclick || node.getAttribute('onclick')) return true;
    return false;
  },

  /**
   * Get visible text from the page (for context)
   */
  getVisibleText() {
    // Find chat/message containers
    const chatSelectors = [
      '[class*="message"]',
      '[class*="chat"]',
      '[class*="conversation"]',
      '[role="log"]',
      '[role="feed"]',
    ];

    let chatText = '';
    for (const selector of chatSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text && text.length > 10) {
          chatText += text + '\n\n';
        }
      }
    }

    return chatText.substring(0, 5000);  // Limit to 5KB
  },

  /**
   * Get scroll information
   */
  getScrollInfo() {
    // Check main containers
    const containers = [
      document.documentElement,
      document.body,
      document.querySelector('[class*="chat"]'),
      document.querySelector('[class*="messages"]'),
      document.querySelector('[class*="conversation"]'),
      document.querySelector('main'),
    ].filter(Boolean);

    let primaryContainer = null;
    let maxScrollHeight = 0;

    for (const container of containers) {
      if (container.scrollHeight > container.clientHeight) {
        if (container.scrollHeight > maxScrollHeight) {
          maxScrollHeight = container.scrollHeight;
          primaryContainer = container;
        }
      }
    }

    if (primaryContainer) {
      return {
        hasScroll: true,
        scrollTop: primaryContainer.scrollTop,
        scrollHeight: primaryContainer.scrollHeight,
        clientHeight: primaryContainer.clientHeight,
        canScrollUp: primaryContainer.scrollTop > 10,
        canScrollDown: primaryContainer.scrollTop < primaryContainer.scrollHeight - primaryContainer.clientHeight - 10,
        percentScrolled: Math.round((primaryContainer.scrollTop / (primaryContainer.scrollHeight - primaryContainer.clientHeight)) * 100),
      };
    }

    return {
      hasScroll: false,
      scrollTop: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: window.innerHeight,
      canScrollUp: window.scrollY > 10,
      canScrollDown: window.scrollY < document.documentElement.scrollHeight - window.innerHeight - 10,
      percentScrolled: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100),
    };
  },

  /**
   * Capture screenshot via extension API
   */
  async captureScreenshot() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AgenticCapture] Screenshot error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(response?.screenshot || null);
      });
    });
  },

  /**
   * Get AI decision on what action to take
   */
  async getAIDecision(pageState, platform, task, actionHistory, messagesFoundSoFar) {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/extension/agentic-decide`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.sessionToken ? `Bearer ${this.config.sessionToken}` : '',
        },
        body: JSON.stringify({
          screenshot: pageState.screenshot,
          accessibilitySnapshot: pageState.accessibilitySnapshot,
          visibleText: pageState.visibleText,
          scrollInfo: pageState.scrollInfo,
          platform: platform.name,
          task: task.type,
          actionHistory: actionHistory.slice(-10),  // Last 10 actions for context
          messagesFoundSoFar,
          model: this.config.model,
        }),
      });

      if (!response.ok) {
        console.error('[AgenticCapture] AI decision API error:', response.status);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();
      return {
        success: true,
        action: data.action || { type: 'wait' },
        extractedData: data.extractedData,
        reasoning: data.reasoning || '',
        isTaskComplete: data.isTaskComplete || false,
      };

    } catch (error) {
      console.error('[AgenticCapture] AI decision error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Execute an action
   */
  async executeAction(action) {
    try {
      switch (action.type) {
        case 'click':
          return await this.executeClick(action);

        case 'scroll_up':
          return await this.executeScroll('up', action.amount || 300);

        case 'scroll_down':
          return await this.executeScroll('down', action.amount || 300);

        case 'scroll_to_top':
          return await this.executeScrollToTop();

        case 'scroll_to_bottom':
          return await this.executeScrollToBottom();

        case 'type':
          return await this.executeType(action);

        case 'wait':
          await this.wait(action.duration || 500);
          return { success: true };

        case 'hover':
          return await this.executeHover(action);

        default:
          console.warn('[AgenticCapture] Unknown action type:', action.type);
          return { success: false, error: `Unknown action: ${action.type}` };
      }

    } catch (error) {
      console.error('[AgenticCapture] executeAction error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Execute click action using ref or coordinates
   */
  async executeClick(action) {
    let element = null;

    // Try to find by ref first (most reliable)
    if (action.ref) {
      element = document.querySelector(`[data-kriptik-ref="${action.ref}"]`);
    }

    // Fallback to coordinates
    if (!element && action.x !== undefined && action.y !== undefined) {
      element = document.elementFromPoint(action.x, action.y);
    }

    // Fallback to text content search
    if (!element && action.text) {
      const allElements = document.querySelectorAll('button, a, [role="button"], [onclick]');
      for (const el of allElements) {
        if (el.textContent?.includes(action.text)) {
          element = el;
          break;
        }
      }
    }

    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.wait(200);

    // Click the element
    element.click();

    // Also dispatch events for React compatibility
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    console.log('[AgenticCapture] Clicked:', action.ref || action.text || `(${action.x}, ${action.y})`);
    return { success: true };
  },

  /**
   * Execute scroll action
   */
  async executeScroll(direction, amount) {
    const delta = direction === 'up' ? -amount : amount;

    // Find scrollable container
    const containers = [
      document.querySelector('[class*="chat"]'),
      document.querySelector('[class*="messages"]'),
      document.querySelector('[class*="conversation"]'),
      document.querySelector('main'),
      document.documentElement,
    ].filter(el => el && el.scrollHeight > el.clientHeight);

    const container = containers[0] || document.documentElement;
    const scrollBefore = container.scrollTop;

    container.scrollBy({ top: delta, behavior: 'smooth' });
    await this.wait(300);

    const scrollAfter = container.scrollTop;
    const didScroll = Math.abs(scrollAfter - scrollBefore) > 5;

    console.log(`[AgenticCapture] Scroll ${direction}: ${scrollBefore} -> ${scrollAfter}`);
    return { success: true, didScroll };
  },

  /**
   * Scroll to top of scrollable container
   */
  async executeScrollToTop() {
    const containers = [
      document.querySelector('[class*="chat"]'),
      document.querySelector('[class*="messages"]'),
      document.querySelector('[class*="conversation"]'),
      document.querySelector('main'),
      document.documentElement,
    ].filter(el => el && el.scrollHeight > el.clientHeight);

    const container = containers[0] || document.documentElement;
    container.scrollTo({ top: 0, behavior: 'smooth' });
    await this.wait(500);

    console.log('[AgenticCapture] Scrolled to top');
    return { success: true };
  },

  /**
   * Scroll to bottom of scrollable container
   */
  async executeScrollToBottom() {
    const containers = [
      document.querySelector('[class*="chat"]'),
      document.querySelector('[class*="messages"]'),
      document.querySelector('[class*="conversation"]'),
      document.querySelector('main'),
      document.documentElement,
    ].filter(el => el && el.scrollHeight > el.clientHeight);

    const container = containers[0] || document.documentElement;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    await this.wait(500);

    console.log('[AgenticCapture] Scrolled to bottom');
    return { success: true };
  },

  /**
   * Execute type action
   */
  async executeType(action) {
    let element = null;

    if (action.ref) {
      element = document.querySelector(`[data-kriptik-ref="${action.ref}"]`);
    }

    if (!element && action.x !== undefined && action.y !== undefined) {
      element = document.elementFromPoint(action.x, action.y);
    }

    if (!element || !('value' in element)) {
      return { success: false, error: 'Input element not found' };
    }

    element.focus();
    element.value = action.text || '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true };
  },

  /**
   * Execute hover action
   */
  async executeHover(action) {
    let element = null;

    if (action.ref) {
      element = document.querySelector(`[data-kriptik-ref="${action.ref}"]`);
    }

    if (!element && action.x !== undefined && action.y !== undefined) {
      element = document.elementFromPoint(action.x, action.y);
    }

    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    return { success: true };
  },

  /**
   * Merge extracted data into our collections
   */
  mergeExtractedData(data) {
    if (data.messages && Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        // Deduplicate by content
        if (!this.chatMessages.some(m => m.content === msg.content)) {
          this.chatMessages.push({
            id: `msg-${Date.now()}-${this.chatMessages.length}`,
            role: msg.role || 'unknown',
            content: msg.content,
            timestamp: new Date().toISOString(),
            codeBlocks: msg.codeBlocks || [],
          });
        }
      }
    }

    if (data.errors && Array.isArray(data.errors)) {
      for (const err of data.errors) {
        if (!this.errors.some(e => e.message === err.message)) {
          this.errors.push({
            type: err.type || 'error',
            severity: err.severity || 'error',
            message: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    if (data.files && Array.isArray(data.files)) {
      for (const file of data.files) {
        if (!this.files.some(f => f.path === file.path)) {
          this.files.push(file);
        }
      }
    }

    if (data.uiElements && Array.isArray(data.uiElements)) {
      for (const elem of data.uiElements) {
        if (!this.uiElements.some(e => e.type === elem.type)) {
          this.uiElements.push(elem);
        }
      }
    }
  },

  /**
   * Send captured data to KripTik
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
          provider: 'agentic-capture',
          source: result.platform.name,
          chatHistory: result.chatHistory.messages,
          errors: result.errors.entries,
          files: result.files.entries,
          captureStats: result.captureStats,
        }),
      });

      if (!response.ok) {
        console.error('[AgenticCapture] Import failed:', response.status);
        return { success: false };
      }

      const data = await response.json();
      return {
        success: true,
        projectId: data.projectId,
        projectName: data.projectName,
      };

    } catch (error) {
      console.error('[AgenticCapture] Import error:', error);
      return { success: false };
    }
  },

  /**
   * Report progress via callback
   */
  reportProgress(phase, message) {
    if (this.onProgress) {
      this.onProgress({
        phase,
        message,
        messagesFound: this.chatMessages.length,
        errorsFound: this.errors.length,
        filesFound: this.files.length,
      });
    }
  },

  /**
   * Stop capture
   */
  stop() {
    this.aborted = true;
    this.isRunning = false;
    console.log('[AgenticCapture] Stopped');
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
window.AgenticCapture = AgenticCapture;

console.log('[AgenticCapture] Module loaded - Using UI-TARS for GUI automation');
