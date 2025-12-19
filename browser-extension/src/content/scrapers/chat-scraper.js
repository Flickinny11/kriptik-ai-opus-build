/**
 * Enhanced Chat Scraper v2
 * Captures the COMPLETE chat history with aggressive scrolling
 * Features:
 * - Heavy debug logging to diagnose issues
 * - Discovery mode for unknown DOM structures
 * - Multiple fallback strategies
 * - Handles virtual scrolling, lazy loading, and "load more" buttons
 */

const ChatScraper = {
  capturedMessages: [],
  isCapturing: false,
  seenMessageHashes: new Set(),
  scrollAttempts: 0,
  maxScrollAttempts: 300,
  debugMode: true, // Enable verbose logging

  /**
   * Debug logger
   */
  debug(...args) {
    if (this.debugMode) {
      console.log('[ChatScraper]', ...args);
    }
  },

  /**
   * Capture FULL chat history - aggressive approach
   * @param {Object} platform - Platform configuration
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array>} Array of captured messages
   */
  async captureFullHistory(platform, onProgress) {
    this.isCapturing = true;
    this.capturedMessages = [];
    this.seenMessageHashes = new Set();
    this.scrollAttempts = 0;

    this.debug('=== Starting Chat Capture ===');
    this.debug('Platform:', platform.name);
    this.debug('Platform selectors:', JSON.stringify(platform.selectors, null, 2));

    onProgress({
      phase: 'initializing',
      message: 'Analyzing page structure...',
      progress: 0
    });

    // Find chat container with discovery mode
    const chatContainer = this.findChatContainer(platform);

    if (!chatContainer) {
      this.debug('ERROR: Could not find chat container with platform selectors');
      this.debug('Attempting discovery mode...');

      // Try discovery mode
      const discoveredMessages = await this.discoveryMode(platform, onProgress);
      if (discoveredMessages.length > 0) {
        this.debug(`Discovery mode found ${discoveredMessages.length} messages`);
        onProgress({
          phase: 'complete',
          message: `Found ${discoveredMessages.length} messages via discovery`,
          progress: 100,
          count: discoveredMessages.length
        });
        this.isCapturing = false;
        return discoveredMessages;
      }

      this.debug('Discovery mode also failed');
      this.isCapturing = false;
      return [];
    }

    this.debug('Found chat container:', chatContainer.tagName, chatContainer.className);

    // Find scrollable element
    const scrollable = this.findScrollableElement(chatContainer);
    this.debug('Scrollable element:', scrollable.tagName, scrollable.className);

    onProgress({
      phase: 'scrolling',
      message: 'Loading full conversation history...',
      progress: 2
    });

    // PHASE 1: Scroll to top to load ALL history
    await this.scrollToAbsoluteTop(scrollable, platform, onProgress);

    onProgress({
      phase: 'extracting',
      message: 'Extracting messages...',
      progress: 50
    });

    // PHASE 2: Scroll down capturing everything
    await this.scrollAndCaptureAll(scrollable, platform, onProgress);

    // PHASE 3: Final cleanup
    onProgress({
      phase: 'finalizing',
      message: 'Processing captured data...',
      progress: 95
    });

    const finalMessages = this.processMessages();

    this.debug(`=== Capture Complete: ${finalMessages.length} messages ===`);

    onProgress({
      phase: 'complete',
      message: `Captured ${finalMessages.length} messages`,
      progress: 100,
      count: finalMessages.length
    });

    this.isCapturing = false;
    return finalMessages;
  },

  /**
   * Discovery mode - intelligently find messages without knowing exact selectors
   * This is the fallback when platform selectors don't work
   */
  async discoveryMode(platform, onProgress) {
    this.debug('=== Discovery Mode ===');

    const messages = [];

    // Strategy 1: Find scrollable areas and look for repeated structures
    const scrollables = this.findAllScrollableAreas();
    this.debug(`Found ${scrollables.length} scrollable areas`);

    for (const scrollable of scrollables) {
      this.debug('Checking scrollable:', scrollable.tagName, scrollable.className?.substring(0, 50));

      // Look for repeated child structures (messages are usually siblings)
      const potentialMessages = this.findRepeatedStructures(scrollable);
      this.debug(`Found ${potentialMessages.length} potential message structures`);

      if (potentialMessages.length >= 2) {
        // This looks like a message container
        for (const el of potentialMessages) {
          const msg = this.extractMessageFromDiscovery(el, messages.length);
          if (msg && msg.content && msg.content.trim().length > 10) {
            messages.push(msg);
          }
        }
      }
    }

    // Strategy 2: Look for known AI platform patterns
    if (messages.length === 0) {
      this.debug('Strategy 1 failed, trying pattern matching...');

      // Bolt.new specific patterns
      const boltPatterns = [
        // User messages often have different background
        'div[class*="bg-"][class*="rounded"]',
        // Messages in main content area
        'main div[class*="flex"][class*="flex-col"] > div',
        // Prose/markdown content
        '[class*="prose"]',
        '[class*="markdown"]',
        // Any div with substantial text
        'div[class*="message"]',
        'div[class*="Message"]',
        // React-based patterns
        '[class*="__message"]',
        '[class*="_message"]'
      ];

      for (const pattern of boltPatterns) {
        try {
          const elements = document.querySelectorAll(pattern);
          this.debug(`Pattern "${pattern}" found ${elements.length} elements`);

          if (elements.length >= 2 && elements.length < 1000) {
            for (const el of elements) {
              const text = el.textContent?.trim() || '';
              // Only include if it has substantial text
              if (text.length > 20 && text.length < 50000) {
                const msg = this.extractMessageFromDiscovery(el, messages.length);
                if (msg && !this.isDuplicate(msg, messages)) {
                  messages.push(msg);
                }
              }
            }

            if (messages.length >= 2) {
              this.debug(`Pattern "${pattern}" yielded ${messages.length} messages`);
              break;
            }
          }
        } catch (e) {
          // Invalid selector
        }
      }
    }

    // Strategy 3: Direct DOM traversal of main content
    if (messages.length === 0) {
      this.debug('Strategy 2 failed, trying main content traversal...');

      const mainContent = document.querySelector('main') || document.body;
      const walker = document.createTreeWalker(
        mainContent,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            // Look for text-heavy divs
            const text = node.textContent?.trim() || '';
            if (text.length > 50 && text.length < 20000) {
              // Check if this is a leaf-ish node (not just a container)
              const childDivs = node.querySelectorAll('div').length;
              if (childDivs < 10) {
                return NodeFilter.FILTER_ACCEPT;
              }
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      let node;
      while ((node = walker.nextNode()) && messages.length < 100) {
        const msg = this.extractMessageFromDiscovery(node, messages.length);
        if (msg && msg.content && msg.content.length > 30 && !this.isDuplicate(msg, messages)) {
          messages.push(msg);
        }
      }
    }

    this.debug(`Discovery mode total: ${messages.length} messages`);
    return messages;
  },

  /**
   * Check if message is a duplicate
   */
  isDuplicate(newMsg, existingMessages) {
    const newContent = newMsg.content?.substring(0, 100) || '';
    return existingMessages.some(msg => {
      const existingContent = msg.content?.substring(0, 100) || '';
      return existingContent === newContent;
    });
  },

  /**
   * Find all scrollable areas on the page
   */
  findAllScrollableAreas() {
    const scrollables = [];
    const allElements = document.querySelectorAll('*');

    for (const el of allElements) {
      try {
        const style = getComputedStyle(el);
        const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                            el.scrollHeight > el.clientHeight + 50;
        if (isScrollable) {
          scrollables.push(el);
        }
      } catch (e) {
        // Skip elements that cause errors
      }
    }

    // Sort by size (larger areas first - more likely to be main content)
    scrollables.sort((a, b) => (b.scrollHeight * b.clientWidth) - (a.scrollHeight * a.clientWidth));

    return scrollables.slice(0, 5); // Top 5 candidates
  },

  /**
   * Find repeated structures within an element (likely messages)
   */
  findRepeatedStructures(container) {
    const children = Array.from(container.children);
    if (children.length < 2) return [];

    // Group children by their structure signature
    const signatures = new Map();

    for (const child of children) {
      const sig = this.getStructureSignature(child);
      if (!signatures.has(sig)) {
        signatures.set(sig, []);
      }
      signatures.get(sig).push(child);
    }

    // Find the most common structure (likely messages)
    let bestMatch = [];
    for (const [sig, elements] of signatures) {
      if (elements.length > bestMatch.length && elements.length >= 2) {
        bestMatch = elements;
      }
    }

    return bestMatch;
  },

  /**
   * Get a signature of an element's structure
   */
  getStructureSignature(el) {
    const tagName = el.tagName;
    const classCount = (el.className || '').split(' ').filter(c => c).length;
    const childCount = el.children.length;
    const hasText = (el.textContent?.trim().length || 0) > 20;
    return `${tagName}-c${classCount}-ch${childCount}-t${hasText}`;
  },

  /**
   * Extract message from an element found via discovery
   */
  extractMessageFromDiscovery(el, index) {
    const content = this.getCleanTextContent(el);
    if (!content || content.length < 10) return null;

    // Try to determine role
    let role = 'unknown';
    const className = (el.className || '').toLowerCase();
    const parentClass = (el.parentElement?.className || '').toLowerCase();

    if (className.includes('user') || className.includes('human') ||
        parentClass.includes('user') || parentClass.includes('human')) {
      role = 'user';
    } else if (className.includes('assistant') || className.includes('ai') ||
               className.includes('bot') || className.includes('agent') ||
               parentClass.includes('assistant') || parentClass.includes('ai')) {
      role = 'assistant';
    } else {
      // Alternate assumption - odd = user, even = assistant (common pattern)
      role = index % 2 === 0 ? 'user' : 'assistant';
    }

    return {
      id: `disc_${index}_${Date.now()}`,
      role: role,
      content: content,
      timestamp: new Date().toISOString(),
      codeBlocks: this.extractCodeBlocks(el),
      order: index,
      source: 'discovery'
    };
  },

  /**
   * Get clean text content from element
   */
  getCleanTextContent(el) {
    if (!el) return '';

    // Clone to avoid modifying original
    const clone = el.cloneNode(true);

    // Remove scripts, styles, hidden elements
    clone.querySelectorAll('script, style, [hidden], [aria-hidden="true"]').forEach(e => e.remove());

    // Remove buttons, nav elements
    clone.querySelectorAll('button, nav, [role="navigation"]').forEach(e => e.remove());

    // Get text
    let text = clone.textContent || '';

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  },

  /**
   * Scroll to absolute top of chat
   */
  async scrollToAbsoluteTop(scrollable, platform, onProgress) {
    let previousScrollHeight = -1;
    let stableCount = 0;
    let iteration = 0;

    scrollable.scrollTop = 0;
    await this.wait(300);

    while (iteration < this.maxScrollAttempts && this.isCapturing) {
      iteration++;

      // Try clicking "Load more" button
      const loadMoreClicked = await this.tryClickLoadMore(platform);

      // Scroll to top
      scrollable.scrollTo({ top: 0, behavior: 'instant' });
      scrollable.scrollTop = 0;

      await this.wait(loadMoreClicked ? 1200 : 400);

      const currentScrollHeight = scrollable.scrollHeight;
      const currentScrollTop = scrollable.scrollTop;

      if (iteration % 10 === 0) {
        this.debug(`Scroll iteration ${iteration}: height=${currentScrollHeight}, top=${currentScrollTop}`);
        onProgress({
          phase: 'scrolling',
          message: `Loading history... (${iteration} cycles)`,
          progress: Math.min(45, 2 + (iteration / this.maxScrollAttempts) * 43)
        });
      }

      const heightStable = currentScrollHeight === previousScrollHeight;
      const positionAtTop = currentScrollTop <= 5;

      if (heightStable && positionAtTop && !loadMoreClicked) {
        stableCount++;
        if (stableCount >= 5) {
          this.debug(`Reached top after ${iteration} iterations`);
          break;
        }
      } else {
        stableCount = 0;
      }

      previousScrollHeight = currentScrollHeight;
    }
  },

  /**
   * Try to click load more buttons
   */
  async tryClickLoadMore(platform) {
    // Platform-specific selector
    if (platform.selectors?.loadMoreButton) {
      try {
        const btn = document.querySelector(platform.selectors.loadMoreButton);
        if (btn && this.isVisible(btn) && !btn.disabled) {
          btn.click();
          this.debug('Clicked platform-specific load more');
          return true;
        }
      } catch (e) {
        // Invalid selector
      }
    }

    // Generic patterns
    const loadMorePatterns = [
      'button[class*="load-more"]',
      'button[class*="load-earlier"]',
      '[class*="load-more"] button',
      '[data-testid*="load-more"]'
    ];

    for (const selector of loadMorePatterns) {
      try {
        const element = document.querySelector(selector);
        if (element && this.isVisible(element) && !element.disabled) {
          element.click();
          this.debug(`Clicked load more: ${selector}`);
          return true;
        }
      } catch (e) {
        // Selector error
      }
    }

    // Text-based search
    const textPatterns = ['load more', 'load earlier', 'show more', 'older messages'];
    const buttons = document.querySelectorAll('button, a, [role="button"]');

    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase().trim();
      for (const pattern of textPatterns) {
        if (text.includes(pattern) && this.isVisible(btn)) {
          btn.click();
          this.debug(`Clicked load more by text: "${pattern}"`);
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Scroll through chat capturing all messages
   */
  async scrollAndCaptureAll(scrollable, platform, onProgress) {
    scrollable.scrollTop = 0;
    await this.wait(500);

    this.captureVisibleMessages(platform);

    const scrollStep = Math.max(200, scrollable.clientHeight * 0.6);
    let totalScrolled = 0;
    let previousMessageCount = 0;
    let stableCount = 0;

    while (this.isCapturing) {
      scrollable.scrollBy({ top: scrollStep, behavior: 'instant' });
      totalScrolled += scrollStep;

      await this.wait(250);
      this.captureVisibleMessages(platform);

      const progress = 50 + Math.min(45, (totalScrolled / scrollable.scrollHeight) * 45);
      onProgress({
        phase: 'extracting',
        message: `Extracting... ${this.capturedMessages.length} messages found`,
        progress: progress,
        count: this.capturedMessages.length
      });

      const scrollPosition = scrollable.scrollTop + scrollable.clientHeight;
      const atBottom = scrollPosition >= scrollable.scrollHeight - 20;

      if (atBottom) {
        await this.wait(500);
        this.captureVisibleMessages(platform);
        break;
      }

      if (this.capturedMessages.length === previousMessageCount) {
        stableCount++;
        if (stableCount >= 8) break;
      } else {
        stableCount = 0;
      }

      previousMessageCount = this.capturedMessages.length;
    }

    this.debug(`Extraction complete: ${this.capturedMessages.length} messages`);
  },

  /**
   * Capture currently visible messages
   */
  captureVisibleMessages(platform) {
    const messageElements = this.findMessageElements(platform);
    let newMessages = 0;

    for (const el of messageElements) {
      const hash = this.hashElement(el);

      if (!this.seenMessageHashes.has(hash)) {
        this.seenMessageHashes.add(hash);

        const message = this.extractMessage(el, platform, this.capturedMessages.length);
        if (message && message.content && message.content.trim().length > 0) {
          this.capturedMessages.push(message);
          newMessages++;
        }
      }
    }

    return newMessages;
  },

  /**
   * Find message elements using multiple strategies
   */
  findMessageElements(platform) {
    // Try platform-specific selector first
    if (platform.selectors?.chatMessage) {
      const selectors = platform.selectors.chatMessage.split(',').map(s => s.trim());
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            this.debug(`Found ${elements.length} messages with selector: ${selector}`);
            return Array.from(elements);
          }
        } catch (e) {
          // Invalid selector
        }
      }
    }

    // Generic message selectors
    const genericSelectors = [
      '[data-testid*="message"]',
      '[data-message-id]',
      '[class*="message-container"]',
      '[class*="chat-message"]',
      '[class*="conversation-message"]',
      '[role="listitem"][class*="message"]',
      '[class*="MessageRow"]',
      '[class*="message-row"]',
      '[class*="chat-row"]',
      '.message',
      '[class*="turn"]',
      '[class*="prose"]'
    ];

    for (const selector of genericSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          this.debug(`Found ${elements.length} messages with generic selector: ${selector}`);
          return Array.from(elements);
        }
      } catch (e) {
        // Invalid selector
      }
    }

    this.debug('No message elements found with any selector');
    return [];
  },

  /**
   * Extract message data from element
   */
  extractMessage(el, platform, index) {
    return {
      id: `msg_${this.hashElement(el)}_${index}`,
      role: this.extractRole(el, platform),
      content: this.extractContent(el, platform),
      timestamp: this.extractTimestamp(el),
      codeBlocks: this.extractCodeBlocks(el),
      order: index
    };
  },

  /**
   * Extract role (user or assistant)
   */
  extractRole(el, platform) {
    const dataRole = el.getAttribute('data-role') ||
                     el.getAttribute('data-message-role') ||
                     el.getAttribute('data-author') ||
                     el.getAttribute('data-testid') || '';

    if (dataRole.toLowerCase().includes('user') || dataRole.toLowerCase().includes('human')) {
      return 'user';
    }
    if (dataRole.toLowerCase().includes('assistant') || dataRole.toLowerCase().includes('ai') || dataRole.toLowerCase().includes('bot')) {
      return 'assistant';
    }

    const className = (el.className || '').toLowerCase();
    if (className.includes('user') || className.includes('human') || className.includes('you')) {
      return 'user';
    }
    if (className.includes('assistant') || className.includes('ai') || className.includes('bot') || className.includes('agent')) {
      return 'assistant';
    }

    return 'assistant';
  },

  /**
   * Extract message content
   */
  extractContent(el, platform) {
    if (platform.selectors?.messageContent) {
      const contentEl = el.querySelector(platform.selectors.messageContent);
      if (contentEl) {
        return this.getCleanTextContent(contentEl);
      }
    }

    const contentSelectors = [
      '[class*="message-content"]',
      '[class*="message-text"]',
      '[class*="content"]',
      '[class*="markdown"]',
      '[class*="prose"]',
      'p',
      '.text'
    ];

    for (const selector of contentSelectors) {
      const contentEl = el.querySelector(selector);
      if (contentEl) {
        const text = this.getCleanTextContent(contentEl);
        if (text.length > 0) {
          return text;
        }
      }
    }

    return this.getCleanTextContent(el);
  },

  /**
   * Extract code blocks
   */
  extractCodeBlocks(el) {
    const blocks = [];
    const codeElements = el.querySelectorAll('pre code, pre, [class*="code-block"]');

    codeElements.forEach((code, i) => {
      const language = code.getAttribute('data-language') ||
                       code.className?.match(/language-(\w+)/)?.[1] ||
                       'text';

      const content = code.textContent?.trim() || '';
      if (content.length > 0) {
        blocks.push({
          id: `code_${i}`,
          language: language,
          content: content
        });
      }
    });

    return blocks;
  },

  /**
   * Extract timestamp
   */
  extractTimestamp(el) {
    const timeSelectors = ['time', '[datetime]', '[data-timestamp]', '[class*="timestamp"]'];

    for (const selector of timeSelectors) {
      const timeEl = el.querySelector(selector);
      if (timeEl) {
        return timeEl.getAttribute('datetime') ||
               timeEl.getAttribute('data-timestamp') ||
               timeEl.textContent?.trim() ||
               null;
      }
    }

    return null;
  },

  /**
   * Create stable hash of element or content
   */
  hashElement(el) {
    if (!el || typeof el.getAttribute !== 'function') {
      const content = (el?.textContent || '').slice(0, 300).trim();
      return this.hashString(content);
    }

    const content = (el.textContent || '').slice(0, 300).trim();
    const className = el.className || '';
    const dataId = el.getAttribute('data-message-id') || el.getAttribute('data-id') || '';

    if (dataId) {
      return `id_${dataId}`;
    }

    return this.hashString(content + (className ? className.slice(0, 50) : ''));
  },

  /**
   * Hash a string
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  },

  /**
   * Process and deduplicate final messages
   */
  processMessages() {
    const sorted = [...this.capturedMessages].sort((a, b) => a.order - b.order);
    const unique = [];
    const contentHashes = new Set();

    for (const msg of sorted) {
      const contentHash = this.hashString(msg.content?.substring(0, 200) || '');
      if (!contentHashes.has(contentHash) && msg.content?.trim().length > 0) {
        contentHashes.add(contentHash);
        unique.push(msg);
      }
    }

    return unique.map((msg, i) => ({
      ...msg,
      order: i
    }));
  },

  /**
   * Find chat container element
   */
  findChatContainer(platform) {
    // Platform-specific selector
    if (platform.selectors?.chatContainer) {
      const selectors = platform.selectors.chatContainer.split(',').map(s => s.trim());
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            this.debug(`Found chat container with: ${sel}`);
            return el;
          }
        } catch (e) {
          // Invalid selector
        }
      }
    }

    // Generic selectors
    const selectors = [
      '[data-testid*="chat"]',
      '[class*="chat-container"]',
      '[class*="conversation-container"]',
      '[class*="messages-container"]',
      '[class*="message-list"]',
      '[role="log"]',
      '[role="main"] [class*="chat"]',
      'main [class*="messages"]',
      'main'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          this.debug(`Found chat container with generic: ${sel}`);
          return el;
        }
      } catch (e) {
        // Invalid selector
      }
    }

    this.debug('Could not find chat container');
    return null;
  },

  /**
   * Find scrollable element
   */
  findScrollableElement(container) {
    const isScrollable = (el) => {
      try {
        const style = getComputedStyle(el);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
               el.scrollHeight > el.clientHeight;
      } catch (e) {
        return false;
      }
    };

    if (isScrollable(container)) {
      return container;
    }

    // Check children (depth 3)
    const checkChildren = (el, depth = 0) => {
      if (depth > 3) return null;
      for (const child of el.children) {
        if (isScrollable(child)) return child;
        const found = checkChildren(child, depth + 1);
        if (found) return found;
      }
      return null;
    };

    const childScrollable = checkChildren(container);
    if (childScrollable) return childScrollable;

    // Check parents
    let parent = container.parentElement;
    while (parent && parent !== document.body) {
      if (isScrollable(parent)) return parent;
      parent = parent.parentElement;
    }

    return container;
  },

  /**
   * Check if element is visible
   */
  isVisible(el) {
    if (!el) return false;
    try {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 &&
             rect.height > 0 &&
             style.visibility !== 'hidden' &&
             style.display !== 'none' &&
             style.opacity !== '0';
    } catch (e) {
      return false;
    }
  },

  /**
   * Wait helper
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Stop capturing
   */
  stop() {
    this.isCapturing = false;
  }
};

// Export to window
window.ChatScraper = ChatScraper;
