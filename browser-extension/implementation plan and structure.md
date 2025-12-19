This is going to be fun. Let me give you the complete technical architecture and prompts to vibe code this thing.

---

## Complete Technical Architecture

### Project Structure

```
project-importer-extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   ├── content.js
│   │   ├── platforms/
│   │   │   ├── lovable.js
│   │   │   ├── bolt.js
│   │   │   └── platform-detector.js
│   │   ├── scrapers/
│   │   │   ├── chat-scraper.js
│   │   │   ├── error-scraper.js
│   │   │   ├── file-tree-scraper.js
│   │   │   └── console-capture.js
│   │   └── ui/
│   │       ├── overlay.js
│   │       ├── progress-animation.js
│   │       └── phases.js
│   ├── utils/
│   │   ├── zip-handler.js
│   │   └── storage.js
│   └── styles/
│       └── overlay.css
├── assets/
│   └── icons/
├── lib/
│   └── jszip.min.js
└── package.json
```

---

## File-by-File Specifications

### 1. manifest.json

```json
{
  "manifest_version": 3,
  "name": "Project Import Assistant",
  "version": "1.0.0",
  "description": "Capture project context from AI builders for seamless import",
  "permissions": [
    "activeTab",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "https://lovable.dev/*",
    "https://*.lovable.dev/*",
    "https://bolt.new/*",
    "https://*.bolt.new/*",
    "https://*.replit.com/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://lovable.dev/*",
        "https://*.lovable.dev/*",
        "https://bolt.new/*",
        "https://*.bolt.new/*"
      ],
      "js": [
        "lib/jszip.min.js",
        "src/content/platforms/platform-detector.js",
        "src/content/platforms/lovable.js",
        "src/content/platforms/bolt.js",
        "src/content/scrapers/chat-scraper.js",
        "src/content/scrapers/error-scraper.js",
        "src/content/scrapers/file-tree-scraper.js",
        "src/content/scrapers/console-capture.js",
        "src/content/ui/phases.js",
        "src/content/ui/progress-animation.js",
        "src/content/ui/overlay.js",
        "src/content/content.js"
      ],
      "css": ["src/styles/overlay.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["assets/*"],
      "matches": ["<all_urls>"]
    }
  ],
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  }
}
```

---

### 2. src/background/service-worker.js

```javascript
// Service worker for handling downloads and cross-tab communication

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INTERCEPT_DOWNLOAD') {
    handleDownloadIntercept(message.data, sender.tab.id);
    sendResponse({ success: true });
  }

  if (message.type === 'STORE_CAPTURED_DATA') {
    // Store captured data temporarily
    chrome.storage.local.set({
      capturedData: message.data,
      capturedAt: Date.now()
    });
    sendResponse({ success: true });
  }

  return true; // Keep channel open for async
});

// Listen for downloads from supported platforms
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const supportedDomains = ['lovable.dev', 'bolt.new'];
  const url = new URL(item.url);

  if (supportedDomains.some(d => url.hostname.includes(d)) &&
      item.filename.endsWith('.zip')) {

    // Get stored captured data
    chrome.storage.local.get(['capturedData'], async (result) => {
      if (result.capturedData) {
        // Modify the ZIP with captured metadata
        await modifyZipWithMetadata(item, result.capturedData, suggest);
      } else {
        suggest({ filename: item.filename });
      }
    });

    return true; // Async handling
  }
});

async function modifyZipWithMetadata(downloadItem, capturedData, suggest) {
  try {
    // Fetch the original ZIP
    const response = await fetch(downloadItem.url);
    const blob = await response.blob();

    // Load and modify ZIP
    const zip = await JSZip.loadAsync(blob);

    // Add metadata file
    zip.file('_import_metadata.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      platform: capturedData.platform,
      projectName: capturedData.projectName,
      chatHistory: capturedData.chatHistory,
      errors: capturedData.errors,
      consoleLogs: capturedData.consoleLogs,
      fileTree: capturedData.fileTree,
      captureStats: capturedData.stats
    }, null, 2));

    // Generate new blob
    const newBlob = await zip.generateAsync({ type: 'blob' });

    // Create object URL and trigger download
    const objectUrl = URL.createObjectURL(newBlob);

    chrome.downloads.download({
      url: objectUrl,
      filename: downloadItem.filename.replace('.zip', '_with_context.zip'),
      saveAs: true
    });

    // Cancel original download
    suggest({ cancel: true });

    // Clear stored data
    chrome.storage.local.remove(['capturedData']);

  } catch (error) {
    console.error('Failed to modify ZIP:', error);
    suggest({ filename: downloadItem.filename });
  }
}
```

---

### 3. src/content/platforms/platform-detector.js

```javascript
// Platform detection and configuration

const PlatformDetector = {
  platforms: {
    lovable: {
      name: 'Lovable',
      hostPatterns: ['lovable.dev'],
      projectUrlPattern: /lovable\.dev\/projects\/([a-zA-Z0-9-]+)/,
      selectors: {
        chatContainer: '[data-testid="chat-messages"], .chat-container, [class*="ChatMessages"]',
        chatMessage: '[data-testid="message"], .message, [class*="Message"]',
        messageRole: 'data-role',
        messageContent: '.message-content, [class*="content"], p',
        loadMoreButton: '[data-testid="load-more"], button:contains("Load"), [class*="LoadMore"]',
        errorPanel: '[data-testid="error-panel"], .error-container, [class*="Error"]',
        fileTree: '[data-testid="file-tree"], .file-explorer, [class*="FileTree"]',
        fileItem: '[data-testid="file-item"], .file-item, [class*="FileItem"]',
        previewFrame: 'iframe[src*="preview"], .preview-frame',
        exportButton: '[data-testid="export"], button:contains("Export"), [class*="Export"]'
      }
    },
    bolt: {
      name: 'Bolt',
      hostPatterns: ['bolt.new'],
      projectUrlPattern: /bolt\.new\/([a-zA-Z0-9-]+)/,
      selectors: {
        chatContainer: '.chat-messages, [class*="chat"], [class*="Messages"]',
        chatMessage: '.message, [class*="message-item"]',
        messageRole: 'data-sender',
        messageContent: '.message-text, .content, p',
        loadMoreButton: '.load-more, button[class*="load"]',
        errorPanel: '.error-display, [class*="error"]',
        fileTree: '.file-tree, [class*="files"]',
        fileItem: '.file-node, [class*="file"]',
        previewFrame: 'iframe.preview',
        exportButton: 'button:contains("Download"), [class*="download"]'
      }
    }
  },

  detect() {
    const hostname = window.location.hostname;

    for (const [key, config] of Object.entries(this.platforms)) {
      if (config.hostPatterns.some(p => hostname.includes(p))) {
        return {
          id: key,
          ...config,
          projectId: this.extractProjectId(config.projectUrlPattern)
        };
      }
    }

    return null;
  },

  extractProjectId(pattern) {
    const match = window.location.href.match(pattern);
    return match ? match[1] : null;
  },

  getSelector(platform, selectorName) {
    return platform.selectors[selectorName];
  },

  // Flexible selector finder - tries multiple strategies
  findElement(platform, selectorName) {
    const selector = this.getSelector(platform, selectorName);
    const selectors = selector.split(', ');

    for (const sel of selectors) {
      // Handle :contains() pseudo-selector
      if (sel.includes(':contains(')) {
        const match = sel.match(/(.+):contains\("(.+)"\)/);
        if (match) {
          const [, baseSelector, text] = match;
          const elements = document.querySelectorAll(baseSelector);
          const found = Array.from(elements).find(el =>
            el.textContent.includes(text)
          );
          if (found) return found;
        }
      } else {
        const element = document.querySelector(sel);
        if (element) return element;
      }
    }

    return null;
  },

  findElements(platform, selectorName) {
    const selector = this.getSelector(platform, selectorName);
    return document.querySelectorAll(selector);
  }
};

// Make available globally
window.PlatformDetector = PlatformDetector;
```

---

### 4. src/content/scrapers/chat-scraper.js

```javascript
// Complete chat history scraper with auto-scroll and load-more handling

const ChatScraper = {
  capturedMessages: [],
  isCapturing: false,

  async captureFullHistory(platform, onProgress) {
    this.isCapturing = true;
    this.capturedMessages = [];

    let previousCount = 0;
    let stableCount = 0;
    let iteration = 0;
    const maxIterations = 100; // Safety limit

    onProgress({
      phase: 'initializing',
      message: 'Initializing neural extraction matrix...',
      progress: 0
    });

    await this.wait(500);

    // Find the chat container
    const chatContainer = PlatformDetector.findElement(platform, 'chatContainer');

    if (!chatContainer) {
      throw new Error('Could not locate chat container');
    }

    onProgress({
      phase: 'scanning',
      message: 'Scanning temporal message buffers...',
      progress: 5
    });

    while (iteration < maxIterations && this.isCapturing) {
      iteration++;

      // Try to load more messages
      const loadedMore = await this.tryLoadMore(platform, chatContainer);

      // Wait for DOM to update
      await this.wait(loadedMore ? 1500 : 500);

      // Scrape currently visible messages
      const currentMessages = this.scrapeVisibleMessages(platform);
      const currentCount = currentMessages.length;

      // Calculate progress (estimate based on load-more behavior)
      const estimatedTotal = loadedMore ? currentCount * 1.5 : currentCount;
      const progress = Math.min(90, (currentCount / estimatedTotal) * 90);

      onProgress({
        phase: 'extracting',
        message: `Extracting quantum message signatures... ${currentCount} captured`,
        progress: progress,
        count: currentCount
      });

      // Check if we've stopped finding new messages
      if (currentCount === previousCount) {
        stableCount++;
        if (stableCount >= 3) {
          // No new messages after 3 attempts
          break;
        }
      } else {
        stableCount = 0;
      }

      previousCount = currentCount;
      this.capturedMessages = currentMessages;
    }

    onProgress({
      phase: 'finalizing',
      message: 'Finalizing message crystallization...',
      progress: 95
    });

    await this.wait(500);

    // Final deduplication and ordering
    const finalMessages = this.deduplicateAndSort(this.capturedMessages);

    onProgress({
      phase: 'complete',
      message: `Extraction complete: ${finalMessages.length} messages captured`,
      progress: 100,
      count: finalMessages.length
    });

    this.isCapturing = false;
    return finalMessages;
  },

  async tryLoadMore(platform, chatContainer) {
    // Strategy 1: Click "Load More" button
    const loadMoreBtn = PlatformDetector.findElement(platform, 'loadMoreButton');
    if (loadMoreBtn && loadMoreBtn.offsetParent !== null) {
      loadMoreBtn.click();
      return true;
    }

    // Strategy 2: Scroll to top of chat container
    const scrollable = this.findScrollableParent(chatContainer);
    if (scrollable && scrollable.scrollTop > 0) {
      scrollable.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }

    // Strategy 3: Dispatch scroll event to trigger virtual scroll
    chatContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

    return false;
  },

  findScrollableParent(element) {
    let current = element;
    while (current) {
      const style = window.getComputedStyle(current);
      const overflowY = style.getPropertyValue('overflow-y');
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  },

  scrapeVisibleMessages(platform) {
    const messages = [];
    const messageElements = PlatformDetector.findElements(platform, 'chatMessage');

    messageElements.forEach((el, index) => {
      const role = this.extractRole(el, platform);
      const content = this.extractContent(el, platform);
      const timestamp = this.extractTimestamp(el);

      if (content && content.trim()) {
        messages.push({
          id: this.generateMessageId(el, index),
          role: role,
          content: content.trim(),
          timestamp: timestamp,
          order: index
        });
      }
    });

    return messages;
  },

  extractRole(element, platform) {
    // Try data attribute
    const roleAttr = element.getAttribute(platform.selectors.messageRole);
    if (roleAttr) {
      return roleAttr.toLowerCase().includes('user') ? 'user' : 'assistant';
    }

    // Try class-based detection
    const className = element.className.toLowerCase();
    if (className.includes('user') || className.includes('human')) {
      return 'user';
    }
    if (className.includes('assistant') || className.includes('ai') || className.includes('bot')) {
      return 'assistant';
    }

    // Try position-based (odd/even alternation is common)
    const parent = element.parentElement;
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    return index % 2 === 0 ? 'user' : 'assistant';
  },

  extractContent(element, platform) {
    const contentSelector = platform.selectors.messageContent;
    const selectors = contentSelector.split(', ');

    for (const sel of selectors) {
      const contentEl = element.querySelector(sel);
      if (contentEl) {
        // Get text content, preserving code blocks
        return this.extractTextWithCode(contentEl);
      }
    }

    // Fallback to element's own text
    return element.textContent;
  },

  extractTextWithCode(element) {
    let result = '';

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        if (tagName === 'pre' || tagName === 'code') {
          result += '\n```\n' + node.textContent + '\n```\n';
        } else if (tagName === 'br') {
          result += '\n';
        } else {
          node.childNodes.forEach(walk);
        }
      }
    };

    walk(element);
    return result;
  },

  extractTimestamp(element) {
    // Try various timestamp patterns
    const timeEl = element.querySelector('time, [data-timestamp], .timestamp, [class*="time"]');
    if (timeEl) {
      return timeEl.getAttribute('datetime') || timeEl.textContent;
    }
    return null;
  },

  generateMessageId(element, index) {
    // Create a stable ID from content hash
    const content = element.textContent.slice(0, 100);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return `msg_${Math.abs(hash)}_${index}`;
  },

  deduplicateAndSort(messages) {
    // Deduplicate by ID
    const seen = new Set();
    const unique = messages.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });

    // Sort by order (which reflects DOM order)
    return unique.sort((a, b) => a.order - b.order);
  },

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  stop() {
    this.isCapturing = false;
  }
};

window.ChatScraper = ChatScraper;
```

---

### 5. src/content/scrapers/error-scraper.js

```javascript
// Error and console log scraper

const ErrorScraper = {
  capturedErrors: [],
  capturedConsoleLogs: [],
  originalConsole: {},

  init() {
    this.interceptConsole();
    this.watchForErrors();
  },

  interceptConsole() {
    // Store original methods
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    // Intercept console methods
    const self = this;

    console.error = function(...args) {
      self.capturedConsoleLogs.push({
        type: 'error',
        timestamp: new Date().toISOString(),
        message: args.map(a => self.stringify(a)).join(' '),
        stack: new Error().stack
      });
      self.originalConsole.error.apply(console, args);
    };

    console.warn = function(...args) {
      self.capturedConsoleLogs.push({
        type: 'warn',
        timestamp: new Date().toISOString(),
        message: args.map(a => self.stringify(a)).join(' ')
      });
      self.originalConsole.warn.apply(console, args);
    };

    console.log = function(...args) {
      // Only capture if it looks like an error or important
      const message = args.map(a => self.stringify(a)).join(' ');
      if (self.isSignificantLog(message)) {
        self.capturedConsoleLogs.push({
          type: 'log',
          timestamp: new Date().toISOString(),
          message: message
        });
      }
      self.originalConsole.log.apply(console, args);
    };
  },

  isSignificantLog(message) {
    const patterns = [
      /error/i,
      /fail/i,
      /exception/i,
      /warning/i,
      /undefined/i,
      /null/i,
      /cannot/i,
      /unable/i,
      /invalid/i,
      /missing/i
    ];
    return patterns.some(p => p.test(message));
  },

  stringify(obj) {
    if (typeof obj === 'string') return obj;
    if (obj instanceof Error) {
      return `${obj.name}: ${obj.message}\n${obj.stack}`;
    }
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  },

  watchForErrors() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.capturedErrors.push({
        type: 'runtime',
        timestamp: new Date().toISOString(),
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.capturedErrors.push({
        type: 'promise',
        timestamp: new Date().toISOString(),
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
      });
    });
  },

  scrapeVisibleErrors(platform) {
    const errors = [];

    // Look for error panels in the UI
    const errorPanel = PlatformDetector.findElement(platform, 'errorPanel');
    if (errorPanel) {
      const errorText = errorPanel.textContent;
      if (errorText && errorText.trim()) {
        errors.push({
          type: 'ui',
          timestamp: new Date().toISOString(),
          message: errorText.trim(),
          source: 'error-panel'
        });
      }
    }

    // Look for error toasts or notifications
    const toasts = document.querySelectorAll(
      '[class*="toast"][class*="error"], ' +
      '[class*="notification"][class*="error"], ' +
      '[class*="alert"][class*="error"], ' +
      '[role="alert"]'
    );

    toasts.forEach(toast => {
      const text = toast.textContent.trim();
      if (text) {
        errors.push({
          type: 'toast',
          timestamp: new Date().toISOString(),
          message: text,
          source: 'ui-toast'
        });
      }
    });

    // Try to access preview iframe errors
    const previewFrame = PlatformDetector.findElement(platform, 'previewFrame');
    if (previewFrame) {
      try {
        const frameErrors = this.scrapeIframeErrors(previewFrame);
        errors.push(...frameErrors);
      } catch (e) {
        // Cross-origin restriction, can't access iframe
      }
    }

    return errors;
  },

  scrapeIframeErrors(iframe) {
    const errors = [];
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // Look for React error boundaries
      const errorBoundary = iframeDoc.querySelector(
        '[class*="error-boundary"], ' +
        '[class*="ErrorBoundary"], ' +
        '#__next-error'
      );

      if (errorBoundary) {
        errors.push({
          type: 'react-error',
          timestamp: new Date().toISOString(),
          message: errorBoundary.textContent.trim(),
          source: 'preview-iframe'
        });
      }
    } catch (e) {
      // Cross-origin, ignore
    }
    return errors;
  },

  getAll() {
    return {
      errors: [
        ...this.capturedErrors,
        ...this.scrapeVisibleErrors(window.currentPlatform)
      ],
      consoleLogs: this.capturedConsoleLogs.slice(-500) // Last 500 logs
    };
  },

  clear() {
    this.capturedErrors = [];
    this.capturedConsoleLogs = [];
  }
};

// Initialize immediately
ErrorScraper.init();
window.ErrorScraper = ErrorScraper;
```

---

### 6. src/content/scrapers/file-tree-scraper.js

```javascript
// File tree structure scraper

const FileTreeScraper = {
  async capture(platform, onProgress) {
    onProgress({
      phase: 'scanning-files',
      message: 'Mapping directory hypercube structure...'
    });

    const fileTree = {
      files: [],
      structure: {},
      stats: {
        totalFiles: 0,
        totalFolders: 0,
        fileTypes: {}
      }
    };

    // Try to expand all folders first
    await this.expandAllFolders(platform);

    // Scrape the file tree
    const fileItems = PlatformDetector.findElements(platform, 'fileItem');

    fileItems.forEach(item => {
      const fileInfo = this.extractFileInfo(item, platform);
      if (fileInfo) {
        fileTree.files.push(fileInfo);

        // Update stats
        if (fileInfo.type === 'file') {
          fileTree.stats.totalFiles++;
          const ext = this.getExtension(fileInfo.name);
          fileTree.stats.fileTypes[ext] = (fileTree.stats.fileTypes[ext] || 0) + 1;
        } else {
          fileTree.stats.totalFolders++;
        }
      }
    });

    // Build hierarchical structure
    fileTree.structure = this.buildHierarchy(fileTree.files);

    onProgress({
      phase: 'files-complete',
      message: `Mapped ${fileTree.stats.totalFiles} files in ${fileTree.stats.totalFolders} directories`,
      count: fileTree.stats.totalFiles
    });

    return fileTree;
  },

  async expandAllFolders(platform) {
    // Click on all folder toggles to expand them
    let expanded = true;
    let iterations = 0;

    while (expanded && iterations < 20) {
      expanded = false;
      iterations++;

      const folderToggles = document.querySelectorAll(
        '[data-testid="folder-toggle"]:not([data-expanded="true"]), ' +
        '.folder-toggle:not(.expanded), ' +
        '[class*="folder"][class*="collapsed"], ' +
        '[aria-expanded="false"]'
      );

      for (const toggle of folderToggles) {
        toggle.click();
        expanded = true;
        await this.wait(100);
      }

      await this.wait(300);
    }
  },

  extractFileInfo(element, platform) {
    // Get file name
    const nameEl = element.querySelector(
      '[class*="name"], ' +
      '.file-name, ' +
      'span:not([class*="icon"])'
    );

    const name = nameEl?.textContent?.trim();
    if (!name) return null;

    // Determine if file or folder
    const isFolder = element.classList.contains('folder') ||
                     element.querySelector('[class*="folder-icon"]') ||
                     element.hasAttribute('data-folder');

    // Get path from data attributes or DOM hierarchy
    const path = this.extractPath(element, name);

    // Get depth/indentation level
    const depth = this.extractDepth(element);

    return {
      name,
      path,
      type: isFolder ? 'folder' : 'file',
      depth,
      extension: isFolder ? null : this.getExtension(name)
    };
  },

  extractPath(element, name) {
    // Try data attribute
    const dataPath = element.getAttribute('data-path') ||
                     element.getAttribute('data-filepath');
    if (dataPath) return dataPath;

    // Build path from parent folders
    const parts = [name];
    let parent = element.parentElement;

    while (parent) {
      if (parent.classList.contains('folder') ||
          parent.hasAttribute('data-folder')) {
        const parentName = parent.querySelector('[class*="name"]')?.textContent?.trim();
        if (parentName) {
          parts.unshift(parentName);
        }
      }
      parent = parent.parentElement;

      // Stop at tree root
      if (parent?.classList.contains('file-tree') ||
          parent?.hasAttribute('data-testid')?.includes('tree')) {
        break;
      }
    }

    return '/' + parts.join('/');
  },

  extractDepth(element) {
    // Try to get depth from style (padding/margin often indicates depth)
    const style = window.getComputedStyle(element);
    const paddingLeft = parseInt(style.paddingLeft);

    if (paddingLeft > 0) {
      return Math.floor(paddingLeft / 16); // Assuming 16px per level
    }

    // Count parent folders
    let depth = 0;
    let parent = element.parentElement;
    while (parent && !parent.classList.contains('file-tree')) {
      if (parent.classList.contains('folder')) depth++;
      parent = parent.parentElement;
    }

    return depth;
  },

  buildHierarchy(files) {
    const root = {};

    files.forEach(file => {
      const parts = file.path.split('/').filter(Boolean);
      let current = root;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 && file.type === 'file'
            ? null // File (leaf node)
            : {}; // Folder
        }
        if (current[part] !== null) {
          current = current[part];
        }
      });
    });

    return root;
  },

  getExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'none';
  },

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

window.FileTreeScraper = FileTreeScraper;
```

---

### 7. src/content/ui/phases.js

```javascript
// Sci-fi phase definitions for the capture process

const CapturePhases = {
  phases: [
    {
      id: 'init',
      name: 'INITIALIZATION',
      messages: [
        'Booting quantum extraction matrix...',
        'Calibrating neural interface adapters...',
        'Establishing secure memory tunnel...'
      ],
      duration: 2000,
      color: '#00ffff',
      glowColor: 'rgba(0, 255, 255, 0.5)'
    },
    {
      id: 'scan',
      name: 'DEEP SCAN',
      messages: [
        'Scanning temporal message buffers...',
        'Mapping conversation topology...',
        'Analyzing dialogue wavefront patterns...'
      ],
      duration: 3000,
      color: '#ff00ff',
      glowColor: 'rgba(255, 0, 255, 0.5)'
    },
    {
      id: 'extract',
      name: 'EXTRACTION',
      messages: [
        'Extracting quantum message signatures...',
        'Decoding autoregressive thought chains...',
        'Capturing intent crystallization data...'
      ],
      duration: null, // Variable duration
      color: '#ffff00',
      glowColor: 'rgba(255, 255, 0, 0.5)'
    },
    {
      id: 'errors',
      name: 'ERROR ANALYSIS',
      messages: [
        'Tracing exception propagation vectors...',
        'Harvesting stack trace resonance...',
        'Mapping failure cascade topology...'
      ],
      duration: 2000,
      color: '#ff3333',
      glowColor: 'rgba(255, 51, 51, 0.5)'
    },
    {
      id: 'files',
      name: 'STRUCTURE MAP',
      messages: [
        'Scanning directory hypercube...',
        'Building file dependency matrix...',
        'Indexing code artifact manifold...'
      ],
      duration: 2000,
      color: '#33ff33',
      glowColor: 'rgba(51, 255, 51, 0.5)'
    },
    {
      id: 'compile',
      name: 'COMPILATION',
      messages: [
        'Compressing captured context tensor...',
        'Encrypting metadata payload...',
        'Finalizing extraction bundle...'
      ],
      duration: 2000,
      color: '#ffffff',
      glowColor: 'rgba(255, 255, 255, 0.5)'
    },
    {
      id: 'complete',
      name: 'COMPLETE',
      messages: [
        'Extraction successful. All systems nominal.',
        'Context capture finalized.',
        'Ready for dimensional transfer.'
      ],
      duration: 1000,
      color: '#00ff88',
      glowColor: 'rgba(0, 255, 136, 0.8)'
    }
  ],

  getPhase(id) {
    return this.phases.find(p => p.id === id);
  },

  getRandomMessage(phaseId) {
    const phase = this.getPhase(phaseId);
    if (!phase) return '';
    return phase.messages[Math.floor(Math.random() * phase.messages.length)];
  },

  getPhaseIndex(id) {
    return this.phases.findIndex(p => p.id === id);
  },

  getProgressForPhase(phaseId, internalProgress = 0) {
    const index = this.getPhaseIndex(phaseId);
    const totalPhases = this.phases.length;
    const phaseSize = 100 / totalPhases;
    return (index * phaseSize) + (internalProgress * phaseSize / 100);
  }
};

window.CapturePhases = CapturePhases;
```

---

### 8. src/content/ui/progress-animation.js

```javascript
// High-tech progress animation system

const ProgressAnimation = {
  canvas: null,
  ctx: null,
  animationFrame: null,
  particles: [],
  rings: [],
  scanLines: [],
  currentPhase: null,
  targetProgress: 0,
  currentProgress: 0,

  init(container) {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 280;
    this.canvas.height = 280;
    this.canvas.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `;
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Initialize elements
    this.initParticles();
    this.initRings();
    this.initScanLines();

    // Start animation loop
    this.animate();
  },

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.2
      });
    }
  },

  initRings() {
    this.rings = [
      { radius: 80, rotation: 0, speed: 0.02, segments: 8, dashRatio: 0.6 },
      { radius: 100, rotation: Math.PI / 4, speed: -0.015, segments: 12, dashRatio: 0.5 },
      { radius: 120, rotation: 0, speed: 0.01, segments: 16, dashRatio: 0.4 }
    ];
  },

  initScanLines() {
    this.scanLines = [];
    for (let i = 0; i < 3; i++) {
      this.scanLines.push({
        y: Math.random() * this.canvas.height,
        speed: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.3
      });
    }
  },

  setPhase(phase) {
    this.currentPhase = phase;
  },

  setProgress(progress) {
    this.targetProgress = progress;
  },

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const phase = this.currentPhase || CapturePhases.getPhase('init');
    const color = phase.color;
    const glowColor = phase.glowColor;

    // Smooth progress interpolation
    this.currentProgress += (this.targetProgress - this.currentProgress) * 0.05;

    // Draw background grid
    this.drawGrid(color);

    // Draw scan lines
    this.drawScanLines(color);

    // Draw particles
    this.drawParticles(color);

    // Draw rotating rings
    this.drawRings(color, glowColor);

    // Draw center progress
    this.drawCenterProgress(color, glowColor);

    // Draw data streams
    this.drawDataStreams(color);

    this.animationFrame = requestAnimationFrame(() => this.animate());
  },

  drawGrid(color) {
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = 0.1;
    this.ctx.lineWidth = 0.5;

    const gridSize = 20;
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1;
  },

  drawScanLines(color) {
    this.scanLines.forEach(line => {
      line.y += line.speed;
      if (line.y > this.canvas.height) line.y = 0;

      const gradient = this.ctx.createLinearGradient(0, line.y - 20, 0, line.y + 20);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, 'transparent');

      this.ctx.strokeStyle = gradient;
      this.ctx.globalAlpha = line.alpha;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, line.y);
      this.ctx.lineTo(this.canvas.width, line.y);
      this.ctx.stroke();
    });
    this.ctx.globalAlpha = 1;
  },

  drawParticles(color) {
    this.ctx.fillStyle = color;

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;

      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1;
  },

  drawRings(color, glowColor) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.rings.forEach(ring => {
      ring.rotation += ring.speed;

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.6;

      // Draw segmented ring
      const segmentAngle = (Math.PI * 2) / ring.segments;
      const dashAngle = segmentAngle * ring.dashRatio;

      for (let i = 0; i < ring.segments; i++) {
        const startAngle = ring.rotation + (i * segmentAngle);
        const endAngle = startAngle + dashAngle;

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, ring.radius, startAngle, endAngle);
        this.ctx.stroke();
      }
    });
    this.ctx.globalAlpha = 1;
  },

  drawCenterProgress(color, glowColor) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const radius = 50;

    // Glow effect
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = 20;

    // Background circle
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = 0.2;
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Progress arc
    this.ctx.globalAlpha = 1;
    this.ctx.lineCap = 'round';
    const progressAngle = (this.currentProgress / 100) * Math.PI * 2;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progressAngle);
    this.ctx.stroke();

    // Center percentage
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 24px "SF Mono", Monaco, monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${Math.round(this.currentProgress)}%`, cx, cy);
  },

  drawDataStreams(color) {
    // Random binary data streams along edges
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.3;
    this.ctx.font = '10px "SF Mono", Monaco, monospace';

    const time = Date.now();
    for (let i = 0; i < 10; i++) {
      const y = (time / 50 + i * 30) % this.canvas.height;
      const binary = Math.random() > 0.5 ? '1' : '0';
      this.ctx.fillText(binary, 5, y);
      this.ctx.fillText(binary, this.canvas.width - 15, y);
    }
    this.ctx.globalAlpha = 1;
  },

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
};

window.ProgressAnimation = ProgressAnimation;
```

---

### 9. src/content/ui/overlay.js

```javascript
// Main overlay UI component

const CaptureOverlay = {
  overlay: null,
  progressAnimation: null,
  isCapturing: false,
  capturedData: null,

  show(platform) {
    if (this.overlay) this.hide();

    this.overlay = document.createElement('div');
    this.overlay.id = 'project-import-overlay';
    this.overlay.innerHTML = this.getTemplate(platform);
    document.body.appendChild(this.overlay);

    // Initialize progress animation
    const animContainer = this.overlay.querySelector('.animation-container');
    ProgressAnimation.init(animContainer);

    // Bind events
    this.bindEvents(platform);

    // Animate in
    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });
  },

  getTemplate(platform) {
    return `
      <div class="import-overlay-backdrop"></div>
      <div class="import-overlay-panel">
        <div class="panel-header">
          <div class="header-glow"></div>
          <div class="header-content">
            <div class="logo-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div class="header-text">
              <h2>PROJECT IMPORT ASSISTANT</h2>
              <p class="platform-badge">${platform.name.toUpperCase()} DETECTED</p>
            </div>
          </div>
          <button class="close-btn" title="Close">×</button>
        </div>

        <div class="panel-body">
          <div class="status-indicator">
            <div class="status-dot"></div>
            <span class="status-text">Ready to capture</span>
          </div>

          <div class="animation-container">
            <!-- Canvas will be inserted here -->
          </div>

          <div class="phase-display">
            <div class="phase-name">STANDBY</div>
            <div class="phase-message">Awaiting capture initialization...</div>
          </div>

          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value" id="stat-messages">--</span>
              <span class="stat-label">Messages</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-errors">--</span>
              <span class="stat-label">Errors</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-files">--</span>
              <span class="stat-label">Files</span>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn btn-primary" id="btn-capture">
              <span class="btn-icon">▶</span>
              <span class="btn-text">START CAPTURE</span>
            </button>
            <button class="btn btn-secondary" id="btn-download" disabled>
              <span class="btn-icon">↓</span>
              <span class="btn-text">DOWNLOAD ZIP</span>
            </button>
          </div>

          <div class="progress-log">
            <div class="log-header">
              <span class="log-indicator"></span>
              SYSTEM LOG
            </div>
            <div class="log-content" id="log-content">
              <div class="log-entry">[INIT] Import assistant activated</div>
              <div class="log-entry">[SCAN] Platform identified: ${platform.name}</div>
              <div class="log-entry">[READY] Awaiting capture command...</div>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <div class="footer-text">
            Powered by <strong>YourApp</strong> • Secure Local Processing
          </div>
        </div>
      </div>
    `;
  },

  bindEvents(platform) {
    // Close button
    this.overlay.querySelector('.close-btn').addEventListener('click', () => {
      this.hide();
    });

    // Backdrop click
    this.overlay.querySelector('.import-overlay-backdrop').addEventListener('click', () => {
      if (!this.isCapturing) this.hide();
    });

    // Start capture button
    this.overlay.querySelector('#btn-capture').addEventListener('click', () => {
      this.startCapture(platform);
    });

    // Download button
    this.overlay.querySelector('#btn-download').addEventListener('click', () => {
      this.triggerDownload(platform);
    });
  },

  async startCapture(platform) {
    if (this.isCapturing) return;
    this.isCapturing = true;

    const captureBtn = this.overlay.querySelector('#btn-capture');
    captureBtn.disabled = true;
    captureBtn.querySelector('.btn-text').textContent = 'CAPTURING...';

    this.updateStatus('capturing', 'Capture in progress');
    this.addLog('[START] Initiating capture sequence...');

    try {
      // Phase 1: Initialize
      await this.runPhase('init', async () => {
        await this.wait(1500);
      });

      // Phase 2: Scan
      await this.runPhase('scan', async () => {
        await this.wait(2000);
      });

      // Phase 3: Extract chat history
      const chatHistory = await this.runPhase('extract', async (updateProgress) => {
        return await ChatScraper.captureFullHistory(platform, (progress) => {
          updateProgress(progress.progress);
          this.updatePhaseMessage(progress.message);
          if (progress.count) {
            this.updateStat('messages', progress.count);
          }
        });
      });

      // Phase 4: Capture errors
      const errorData = await this.runPhase('errors', async () => {
        const data = ErrorScraper.getAll();
        this.updateStat('errors', data.errors.length);
        this.addLog(`[ERROR] Captured ${data.errors.length} error records`);
        return data;
      });

      // Phase 5: Capture file tree
      const fileTree = await this.runPhase('files', async (updateProgress) => {
        return await FileTreeScraper.capture(platform, (progress) => {
          this.updatePhaseMessage(progress.message);
          if (progress.count) {
            this.updateStat('files', progress.count);
          }
        });
      });

      // Phase 6: Compile
      await this.runPhase('compile', async () => {
        await this.wait(1500);
      });

      // Phase 7: Complete
      await this.runPhase('complete', async () => {
        await this.wait(500);
      });

      // Store captured data
      this.capturedData = {
        platform: platform.id,
        projectName: platform.projectId || 'unknown-project',
        capturedAt: new Date().toISOString(),
        chatHistory: chatHistory,
        errors: errorData.errors,
        consoleLogs: errorData.consoleLogs,
        fileTree: fileTree,
        stats: {
          messageCount: chatHistory.length,
          errorCount: errorData.errors.length,
          fileCount: fileTree.stats.totalFiles
        }
      };

      // Store for background script
      chrome.runtime.sendMessage({
        type: 'STORE_CAPTURED_DATA',
        data: this.capturedData
      });

      // Enable download
      this.updateStatus('complete', 'Capture complete!');
      captureBtn.querySelector('.btn-text').textContent = 'CAPTURE COMPLETE';

      const downloadBtn = this.overlay.querySelector('#btn-download');
      downloadBtn.disabled = false;
      downloadBtn.classList.add('ready');

      this.addLog('[DONE] Capture sequence complete');
      this.addLog(`[DATA] ${chatHistory.length} messages, ${errorData.errors.length} errors, ${fileTree.stats.totalFiles} files`);
      this.addLog('[READY] Click DOWNLOAD ZIP to export with context');

    } catch (error) {
      console.error('Capture failed:', error);
      this.updateStatus('error', 'Capture failed');
      this.addLog(`[ERROR] Capture failed: ${error.message}`);
      captureBtn.disabled = false;
      captureBtn.querySelector('.btn-text').textContent = 'RETRY CAPTURE';
    }

    this.isCapturing = false;
  },

  async runPhase(phaseId, executor) {
    const phase = CapturePhases.getPhase(phaseId);

    this.updatePhase(phase);
    ProgressAnimation.setPhase(phase);
    this.addLog(`[${phase.name}] ${CapturePhases.getRandomMessage(phaseId)}`);

    const updateProgress = (progress) => {
      const overallProgress = CapturePhases.getProgressForPhase(phaseId, progress);
      ProgressAnimation.setProgress(overallProgress);
    };

    updateProgress(0);
    const result = await executor(updateProgress);
    updateProgress(100);

    return result;
  },

  updatePhase(phase) {
    const nameEl = this.overlay.querySelector('.phase-name');
    const messageEl = this.overlay.querySelector('.phase-message');

    nameEl.textContent = phase.name;
    nameEl.style.color = phase.color;
    messageEl.textContent = CapturePhases.getRandomMessage(phase.id);

    // Update panel accent color
    this.overlay.style.setProperty('--accent-color', phase.color);
    this.overlay.style.setProperty('--accent-glow', phase.glowColor);
  },

  updatePhaseMessage(message) {
    const messageEl = this.overlay.querySelector('.phase-message');
    messageEl.textContent = message;
  },

  updateStatus(status, text) {
    const indicator = this.overlay.querySelector('.status-indicator');
    const textEl = this.overlay.querySelector('.status-text');

    indicator.className = `status-indicator status-${status}`;
    textEl.textContent = text;
  },

  updateStat(stat, value) {
    const el = this.overlay.querySelector(`#stat-${stat}`);
    if (el) el.textContent = value;
  },

  addLog(message) {
    const logContent = this.overlay.querySelector('#log-content');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `${this.getTimestamp()} ${message}`;
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
  },

  getTimestamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  },

  triggerDownload(platform) {
    // Find and click the platform's export/download button
    const exportBtn = PlatformDetector.findElement(platform, 'exportButton');

    if (exportBtn) {
      this.addLog('[EXPORT] Triggering platform export...');
      exportBtn.click();
    } else {
      // Fallback: instruct user
      this.addLog('[MANUAL] Please use the platform export feature');
      alert('Please use the Export/Download feature in ' + platform.name + ' to download your project ZIP. Our extension will automatically add the captured context.');
    }
  },

  hide() {
    if (!this.overlay) return;

    this.overlay.classList.remove('visible');
    ProgressAnimation.destroy();

    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
    }, 300);
  },

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

window.CaptureOverlay = CaptureOverlay;
```

---

### 10. src/styles/overlay.css

```css
/* Import Assistant Overlay Styles */

:root {
  --accent-color: #00ffff;
  --accent-glow: rgba(0, 255, 255, 0.5);
}

#project-import-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999999;
  opacity: 0;
  transition: opacity 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
}

#project-import-overlay.visible {
  opacity: 1;
}

.import-overlay-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
}

.import-overlay-panel {
  position: absolute;
  top: 50%;
  right: 30px;
  transform: translateY(-50%);
  width: 380px;
  background: linear-gradient(135deg, rgba(15, 15, 25, 0.98) 0%, rgba(25, 25, 40, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 0 60px rgba(0, 0, 0, 0.5),
    0 0 30px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Header */
.panel-header {
  position: relative;
  padding: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--accent-color) 0%, rgba(0, 255, 255, 0.3) 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px var(--accent-glow);
}

.logo-mark svg {
  width: 24px;
  height: 24px;
  color: #000;
}

.header-text h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.platform-badge {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--accent-color);
  font-weight: 600;
  letter-spacing: 1px;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* Body */
.panel-body {
  padding: 20px;
}

/* Status Indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-bottom: 20px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #666;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.status-indicator.status-capturing .status-dot {
  background: #ffff00;
  box-shadow: 0 0 10px #ffff00;
  animation: statusPulse 1s ease-in-out infinite;
}

.status-indicator.status-complete .status-dot {
  background: #00ff88;
  box-shadow: 0 0 10px #00ff88;
}

.status-indicator.status-error .status-dot {
  background: #ff3333;
  box-shadow: 0 0 10px #ff3333;
}

@keyframes statusPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.3); }
}

.status-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* Animation Container */
.animation-container {
  position: relative;
  width: 100%;
  height: 280px;
  margin-bottom: 20px;
}

/* Phase Display */
.phase-display {
  text-align: center;
  margin-bottom: 20px;
}

.phase-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-color);
  letter-spacing: 2px;
  margin-bottom: 6px;
  text-shadow: 0 0 10px var(--accent-glow);
}

.phase-message {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--accent-color);
  font-family: 'SF Mono', Monaco, monospace;
  text-shadow: 0 0 10px var(--accent-glow);
}

.stat-label {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 4px;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  border: none;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-color) 0%, rgba(0, 200, 200, 1) 100%);
  color: #000;
  box-shadow: 0 4px 20px var(--accent-glow);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 30px var(--accent-glow);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-secondary.ready {
  background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%);
  color: #000;
  border: none;
  box-shadow: 0 4px 20px rgba(0, 255, 136, 0.5);
}

.btn-secondary.ready:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 30px rgba(0, 255, 136, 0.5);
}

.btn-icon {
  font-size: 14px;
}

/* Progress Log */
.progress-log {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.log-indicator {
  width: 6px;
  height: 6px;
  background: #00ff88;
  border-radius: 50%;
  animation: statusPulse 2s ease-in-out infinite;
}

.log-content {
  height: 100px;
  overflow-y: auto;
  padding: 10px 12px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 10px;
  line-height: 1.6;
}

.log-entry {
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 2px;
}

.log-entry:last-child {
  color: var(--accent-color);
}

/* Footer */
.panel-footer {
  padding: 15px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.footer-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.footer-text strong {
  color: var(--accent-color);
}

/* Scrollbar */
.log-content::-webkit-scrollbar {
  width: 4px;
}

.log-content::-webkit-scrollbar-track {
  background: transparent;
}

.log-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* Animation keyframes */
@keyframes scanLine {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
```

---

### 11. src/content/content.js (Main Entry Point)

```javascript
// Main content script - initializes when page loads

(function() {
  'use strict';

  // Store platform globally for other scripts
  window.currentPlatform = null;

  // Detect platform on load
  function init() {
    const platform = PlatformDetector.detect();

    if (!platform) {
      console.log('[Import Assistant] No supported platform detected');
      return;
    }

    console.log(`[Import Assistant] Detected platform: ${platform.name}`);
    window.currentPlatform = platform;

    // Wait for page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => onPageReady(platform));
    } else {
      onPageReady(platform);
    }
  }

  function onPageReady(platform) {
    // Check if we're on a project page
    if (!platform.projectId) {
      console.log('[Import Assistant] Not on a project page, waiting...');
      observeForProject(platform);
      return;
    }

    // Show the overlay
    showImportUI(platform);
  }

  function observeForProject(platform) {
    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;

        // Re-detect platform with new URL
        const newPlatform = PlatformDetector.detect();
        if (newPlatform && newPlatform.projectId) {
          window.currentPlatform = newPlatform;
          showImportUI(newPlatform);
          observer.disconnect();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check on popstate
    window.addEventListener('popstate', () => {
      const newPlatform = PlatformDetector.detect();
      if (newPlatform && newPlatform.projectId) {
        window.currentPlatform = newPlatform;
        showImportUI(newPlatform);
      }
    });
  }

  function showImportUI(platform) {
    // Add floating trigger button
    addTriggerButton(platform);
  }

  function addTriggerButton(platform) {
    // Remove existing button if any
    const existing = document.getElementById('import-assistant-trigger');
    if (existing) existing.remove();

    const button = document.createElement('button');
    button.id = 'import-assistant-trigger';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>Import to YourApp</span>
    `;

    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #00ffff 0%, #00cccc 100%);
      color: #000;
      border: none;
      border-radius: 50px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 255, 255, 0.4);
      transition: all 0.3s ease;
    `;

    button.querySelector('svg').style.cssText = `
      width: 18px;
      height: 18px;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 30px rgba(0, 255, 255, 0.5)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 20px rgba(0, 255, 255, 0.4)';
    });

    button.addEventListener('click', () => {
      CaptureOverlay.show(platform);
    });

    document.body.appendChild(button);
  }

  // Start
  init();
})();
```

---

## Prompts for Vibe Coding

Here are ready-to-use prompts for Cursor or Antigravity:

---

### Prompt 1: Project Setup

```
Create a Chrome extension project called "project-import-assistant" with Manifest V3.

Project structure:
- manifest.json with permissions for activeTab, storage, downloads
- Host permissions for lovable.dev/*, bolt.new/*, replit.com/*
- Content scripts that run on these platforms
- Background service worker
- Include JSZip library

The extension should detect when users are on AI builder platforms (Lovable, Bolt) and show a floating button "Import to YourApp" in the bottom right corner.

Use modern ES6+, no build step required, vanilla JS only.
```

---

### Prompt 2: Platform Detection System

```
Create a platform detection module for a Chrome extension that:

1. Detects which AI builder platform the user is on (Lovable, Bolt, Replit)
2. Extracts the project ID from the URL using regex patterns
3. Provides flexible CSS selectors for each platform to find:
   - Chat message container
   - Individual chat messages
   - Load more button
   - Error panels
   - File tree
   - Export/download button

The selectors should try multiple fallback patterns since these platforms update their UI frequently. Include a helper function that tries each selector until one works.

Make it extensible so new platforms can be added easily.
```

---

### Prompt 3: Chat History Scraper

```
Create a comprehensive chat history scraper for a Chrome extension that:

1. Captures ALL messages from AI builder chat interfaces (Lovable, Bolt)
2. Handles pagination - automatically clicks "Load More" or scrolls up to load older messages
3. Continues until no new messages appear (3 consecutive attempts with no new content)
4. Extracts for each message:
   - Role (user vs assistant)
   - Full text content including code blocks
   - Timestamp if available
5. Deduplicates messages and maintains correct chronological order
6. Reports progress via callback: { phase, message, progress (0-100), count }

The scraper should handle:
- Virtualized lists (only visible items in DOM)
- Infinite scroll containers
- "Load more" buttons
- Messages that load asynchronously

Include realistic sci-fi progress messages like "Extracting quantum message signatures..." for the UI feedback.
```

---

### Prompt 4: High-Tech Overlay UI

```
Create a futuristic sci-fi styled overlay UI for a Chrome extension capture tool.

The overlay should:
1. Have a semi-transparent dark backdrop with blur effect
2. Feature a panel on the right side with:
   - Glowing header with animated accent line
   - Status indicator with pulsing dot (ready/capturing/complete/error states)
   - Large canvas area for animated progress visualization
   - Phase name and message display
   - Stats grid showing: Messages, Errors, Files (with animated counting)
   - Two buttons: START CAPTURE (primary), DOWNLOAD ZIP (secondary, disabled until complete)
   - Scrolling system log with monospace font

Visual style:
- Dark background (#0f0f19)
- Cyan accent color (#00ffff) that changes per phase
- Glowing effects and shadows
- Subtle grid pattern background
- Smooth transitions and animations
- SF Pro Display font for headings, SF Mono for code/logs

The accent color should change through phases:
- Init: Cyan
- Scan: Magenta
- Extract: Yellow
- Errors: Red
- Files: Green
- Complete: Bright green

All animations should be smooth and high-quality.
```

---

### Prompt 5: Canvas Progress Animation

```
Create a high-tech canvas-based progress animation for a futuristic UI.

The animation should include:
1. Background grid pattern (subtle, 20px spacing)
2. Horizontal scan lines that move down the canvas
3. Floating particles that drift around
4. Three concentric rotating rings with segmented dashes
5. Central progress circle showing percentage
6. Binary data streams along the edges
7. Glowing effects that match the current phase color

Features:
- Smooth progress interpolation (eases toward target)
- Phase-based color changes
- Constant 60fps animation
- Ring segments rotate at different speeds and directions
- Particles respond to progress changes
- Canvas size: 280x280px

The overall effect should look like a sci-fi computer interface from a movie.
```

---

### Prompt 6: ZIP Modification System

```
Create a Chrome extension background service worker that:

1. Stores captured data (chat history, errors, file tree) in chrome.storage.local
2. Intercepts ZIP downloads from Lovable and Bolt domains
3. When a ZIP is downloaded:
   - Fetch the original ZIP blob
   - Use JSZip to unzip it
   - Add a new file: _import_metadata.json containing all captured context
   - Re-zip and trigger download with modified filename (*_with_context.zip)
   - Cancel the original download

The _import_metadata.json should contain:
{
  "exportedAt": ISO timestamp,
  "platform": "lovable" | "bolt",
  "projectName": string,
  "chatHistory": array of messages,
  "errors": array of error objects,
  "consoleLogs": array of console entries,
  "fileTree": object with files array and stats,
  "captureStats": { messageCount, errorCount, fileCount }
}

Handle errors gracefully - if anything fails, let the original download proceed normally.
```

---

### Prompt 7: Error and Console Capture

```
Create an error capture module for a Chrome extension that:

1. Intercepts console.log, console.warn, console.error
   - Stores error and warning messages
   - Only stores console.log if it contains error-related keywords
   - Preserves stack traces

2. Listens for global error events and unhandled promise rejections

3. Scrapes visible error panels from the page UI:
   - Error overlays/modals
   - Toast notifications
   - Preview iframe error boundaries

4. Attempts to access preview iframe console (handle cross-origin gracefully)

Return format:
{
  errors: [{ type, timestamp, message, stack?, source? }],
  consoleLogs: [{ type, timestamp, message }]
}

Filter to keep only the last 500 console entries to prevent memory issues.
```

---

### Prompt 8: Integration Test

```
Help me test this Chrome extension:

1. Load it in Chrome developer mode
2. Navigate to a Lovable or Bolt project
3. The floating "Import to YourApp" button should appear
4. Clicking it should show the overlay
5. START CAPTURE should:
   - Animate through phases
   - Auto-scroll chat to load all messages
   - Show live counts
   - Enable DOWNLOAD ZIP when complete
6. DOWNLOAD ZIP should trigger the platform's export
7. The downloaded ZIP should contain _import_metadata.json

Create a testing checklist and help debug any issues.
```

---

## Summary

This gives you:

1. **Complete project structure** - every file you need
2. **Working code** - copy-paste ready for each module
3. **Platform detection** - flexible selector system for Lovable/Bolt
4. **Full chat capture** - handles pagination, infinite scroll, load-more
5. **Sci-fi UI** - high-tech overlay with canvas animations
6. **ZIP modification** - intercepts and adds metadata
7. **Cursor/Antigravity prompts** - break it into vibe-codeable chunks

The extension will look professional and "magical" to users. The sci-fi aesthetic with phase-based colors and animated progress makes the 30-90 second capture feel intentional rather than slow.
