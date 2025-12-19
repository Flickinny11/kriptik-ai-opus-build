/**
 * KripTik AI Extension - Background Service Worker
 * Handles:
 * - Download interception and ZIP modification
 * - Screenshot capture for credential extraction
 * - Tab management for credential capture flow
 * - Communication between tabs and KripTik
 */

// ============================================================================
// State Management
// ============================================================================

let storedMetadata = null;
let pendingDownloadId = null;
let credentialCaptureSessions = new Map(); // tabId -> session config

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.type];
  if (handler) {
    // Handle async responses
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch(err => {
        console.error('[Service Worker] Handler error:', err);
        sendResponse({ error: err.message });
      });
      return true; // Keep channel open for async
    }
    sendResponse(result);
    return true;
  }

  console.warn('[Service Worker] Unknown message type:', message.type);
  return false;
});

const messageHandlers = {
  // -------------------------------------------------------------------------
  // Fix My App - Data Storage
  // -------------------------------------------------------------------------

  STORE_CAPTURED_DATA: (message) => {
    storedMetadata = message.data;
    console.log('[Service Worker] Stored captured data');
    return { success: true };
  },

  GET_STORED_DATA: () => {
    return { data: storedMetadata };
  },

  CLEAR_STORED_DATA: () => {
    storedMetadata = null;
    return { success: true };
  },

  // -------------------------------------------------------------------------
  // Screenshot Capture (for credential extraction)
  // -------------------------------------------------------------------------

  CAPTURE_SCREENSHOT: async (message, sender) => {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 90
      });

      // Remove data URL prefix to get just base64
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      return { screenshot: base64 };
    } catch (error) {
      console.error('[Service Worker] Screenshot capture error:', error);
      return { screenshot: null, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Credential Capture Flow
  // -------------------------------------------------------------------------

  START_CREDENTIAL_CAPTURE: async (message) => {
    const { platformUrl, requiredCredentials, sessionToken, apiEndpoint, originTabId } = message;

    try {
      // Open new tab to the credential platform
      const tab = await chrome.tabs.create({
        url: platformUrl,
        active: true
      });

      // Store session config for this tab
      credentialCaptureSessions.set(tab.id, {
        requiredCredentials,
        sessionToken,
        apiEndpoint,
        originTabId,
        startedAt: Date.now()
      });

      // Inject credential capture script once page loads
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          const session = credentialCaptureSessions.get(tabId);
          if (session) {
            // Send message to content script to start capture
            chrome.tabs.sendMessage(tabId, {
              type: 'START_CREDENTIAL_CAPTURE',
              config: {
                requiredCredentials: session.requiredCredentials,
                sessionToken: session.sessionToken,
                apiEndpoint: session.apiEndpoint,
                originTabId: session.originTabId
              }
            });
          }
        }
      });

      return { success: true, tabId: tab.id };
    } catch (error) {
      console.error('[Service Worker] Failed to start credential capture:', error);
      return { success: false, error: error.message };
    }
  },

  CREDENTIALS_CAPTURED: async (message) => {
    const { credentials, originTabId } = message;

    // Send credentials back to the KripTik tab
    if (originTabId) {
      try {
        await chrome.tabs.sendMessage(originTabId, {
          type: 'CREDENTIALS_RECEIVED',
          credentials
        });
      } catch (error) {
        console.error('[Service Worker] Failed to send credentials to origin tab:', error);
      }
    }

    return { success: true };
  },

  CREDENTIALS_CANCELLED: async (message) => {
    const { originTabId } = message;

    if (originTabId) {
      try {
        await chrome.tabs.sendMessage(originTabId, {
          type: 'CREDENTIALS_CAPTURE_CANCELLED'
        });
      } catch (error) {
        // Origin tab might be closed, ignore
      }
    }

    return { success: true };
  },

  // -------------------------------------------------------------------------
  // KripTik API Proxy (to avoid CORS issues from content scripts)
  // -------------------------------------------------------------------------

  SEND_TO_KRIPTIK_API: async (message) => {
    const { endpoint, token, payload } = message;

    // Detailed validation with specific error messages
    if (!endpoint) {
      console.error('[Service Worker] SEND_TO_KRIPTIK_API: No endpoint provided');
      return { success: false, error: 'No API endpoint configured. Please configure in extension settings.' };
    }

    if (!token) {
      console.error('[Service Worker] SEND_TO_KRIPTIK_API: No token provided');
      return { success: false, error: 'No API token configured. Please configure in extension settings.' };
    }

    const apiUrl = `${endpoint}/api/extension/import`;
    console.log('[Service Worker] Sending to KripTik API:', apiUrl);
    console.log('[Service Worker] Payload summary:', {
      platform: payload?.platform?.name,
      chatMessages: payload?.chatHistory?.messageCount || 0,
      errors: payload?.errors?.count || 0,
      hasFiles: !!payload?.files
    });

    try {
      // Build headers - only include Authorization for extension tokens
      const headers = {
        'Content-Type': 'application/json',
      };

      // Only add Authorization header if we have a valid extension token
      // Regular session auth uses cookies via credentials: 'include'
      if (token && token.startsWith('kriptik_ext_')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        // Include credentials to send cookies for session-based auth
        // This allows the request to use the user's existing session
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      console.log('[Service Worker] API response status:', response.status);

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('[Service Worker] Failed to parse response as JSON:', parseError);
        const text = await response.text();
        console.error('[Service Worker] Response body:', text.substring(0, 500));
        return { success: false, error: `Invalid JSON response from server (HTTP ${response.status})` };
      }

      if (!response.ok) {
        console.error('[Service Worker] API error response:', result);
        return {
          success: false,
          error: result.error || result.message || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      console.log('[Service Worker] API success:', result);
      return {
        success: true,
        projectId: result.projectId,
        projectName: result.projectName,
        dashboardUrl: result.dashboardUrl,
        builderUrl: result.builderUrl,
        fixMyAppUrl: result.fixMyAppUrl,
        stats: result.stats,
        analysisStarted: result.analysisStarted
      };
    } catch (error) {
      console.error('[Service Worker] API request failed:', error);
      // Provide more specific error messages
      if (error.message.includes('Failed to fetch')) {
        return {
          success: false,
          error: `Network error: Cannot reach ${endpoint}. Check if the URL is correct and the server is running.`
        };
      }
      return { success: false, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Extension Status
  // -------------------------------------------------------------------------

  GET_STATUS: async () => {
    const config = await chrome.storage.sync.get(['apiEndpoint', 'apiToken']);
    return {
      configured: !!(config.apiEndpoint && config.apiToken),
      hasStoredMetadata: !!storedMetadata,
      activeCaptureSessions: credentialCaptureSessions.size
    };
  },

  // -------------------------------------------------------------------------
  // Tab Management
  // -------------------------------------------------------------------------

  GET_CURRENT_TAB_ID: async (message, sender) => {
    // Return the sender tab's ID
    return { tabId: sender.tab?.id || null };
  },

  // -------------------------------------------------------------------------
  // Vision Capture (Server-side Gemini 3 Flash + Playwright)
  // -------------------------------------------------------------------------

  START_VISION_CAPTURE: async (message) => {
    const { url, options } = message;

    // Get API config from storage
    const config = await chrome.storage.sync.get(['apiEndpoint', 'apiToken']);
    const session = await chrome.storage.local.get(['fixMyAppSession']);

    const apiEndpoint = config.apiEndpoint || session.fixMyAppSession?.apiEndpoint;
    const token = config.apiToken || session.fixMyAppSession?.token;

    if (!apiEndpoint) {
      return { success: false, error: 'API endpoint not configured' };
    }

    console.log('[Service Worker] Starting vision capture for:', url);

    try {
      // Get cookies for the target URL to pass to the server
      const cookies = await chrome.cookies.getAll({ url });
      const formattedCookies = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expirationDate,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite === 'strict' ? 'Strict' : c.sameSite === 'lax' ? 'Lax' : 'None'
      }));

      const headers = {
        'Content-Type': 'application/json',
      };

      if (token && token.startsWith('kriptik_ext_')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiEndpoint}/api/extension/vision-capture/start`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          url,
          cookies: formattedCookies,
          options: options || {}
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || `HTTP ${response.status}` };
      }

      const result = await response.json();
      console.log('[Service Worker] Vision capture started:', result);

      return {
        success: true,
        sessionId: result.sessionId,
        eventsUrl: `${apiEndpoint}${result.eventsUrl}`
      };
    } catch (error) {
      console.error('[Service Worker] Vision capture error:', error);
      return { success: false, error: error.message };
    }
  },

  GET_VISION_CAPTURE_STATUS: async (message) => {
    const { sessionId } = message;

    const config = await chrome.storage.sync.get(['apiEndpoint', 'apiToken']);
    const session = await chrome.storage.local.get(['fixMyAppSession']);

    const apiEndpoint = config.apiEndpoint || session.fixMyAppSession?.apiEndpoint;
    const token = config.apiToken || session.fixMyAppSession?.token;

    if (!apiEndpoint || !sessionId) {
      return { success: false, error: 'Missing endpoint or session ID' };
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token && token.startsWith('kriptik_ext_')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiEndpoint}/api/extension/vision-capture/status/${sessionId}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error('[Service Worker] Get status error:', error);
      return { success: false, error: error.message };
    }
  },

  CANCEL_VISION_CAPTURE: async (message) => {
    const { sessionId } = message;

    const config = await chrome.storage.sync.get(['apiEndpoint', 'apiToken']);
    const session = await chrome.storage.local.get(['fixMyAppSession']);

    const apiEndpoint = config.apiEndpoint || session.fixMyAppSession?.apiEndpoint;
    const token = config.apiToken || session.fixMyAppSession?.token;

    if (!apiEndpoint || !sessionId) {
      return { success: false, error: 'Missing endpoint or session ID' };
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token && token.startsWith('kriptik_ext_')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiEndpoint}/api/extension/vision-capture/cancel/${sessionId}`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error('[Service Worker] Cancel capture error:', error);
      return { success: false, error: error.message };
    }
  },

  GET_VISION_CAPTURE_RESULT: async (message) => {
    const { sessionId } = message;

    const config = await chrome.storage.sync.get(['apiEndpoint', 'apiToken']);
    const session = await chrome.storage.local.get(['fixMyAppSession']);

    const apiEndpoint = config.apiEndpoint || session.fixMyAppSession?.apiEndpoint;
    const token = config.apiToken || session.fixMyAppSession?.token;

    if (!apiEndpoint || !sessionId) {
      return { success: false, error: 'Missing endpoint or session ID' };
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token && token.startsWith('kriptik_ext_')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiEndpoint}/api/extension/vision-capture/result/${sessionId}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error('[Service Worker] Get result error:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// Download Interception for ZIP Modification
// ============================================================================

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  const isZip = downloadItem.filename.toLowerCase().endsWith('.zip');

  if (!isZip || !storedMetadata) {
    suggest({ filename: downloadItem.filename });
    return;
  }

  console.log('[Service Worker] Intercepting ZIP download:', downloadItem.filename);
  pendingDownloadId = downloadItem.id;

  suggest({
    filename: downloadItem.filename,
    conflictAction: 'uniquify'
  });
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state && delta.state.current === 'complete' && delta.id === pendingDownloadId) {
    try {
      console.log('[Service Worker] Download complete, preparing ZIP modification...');

      const downloads = await chrome.downloads.search({ id: delta.id });
      if (downloads.length === 0) return;

      const download = downloads[0];
      if (!download.filename) return;

      // Fetch the downloaded file
      const response = await fetch(`file://${download.filename}`);
      if (!response.ok) {
        // Can't read local files directly in service worker
        // Instead, we'll create a new ZIP with the metadata
        await createEnhancedZip(storedMetadata, download.filename);
      } else {
        const zipData = await response.arrayBuffer();
        const modifiedZip = await modifyZipWithMetadata(zipData, storedMetadata);
        await saveModifiedZip(modifiedZip, download.filename);
      }

      console.log('[Service Worker] ZIP modification complete');
      storedMetadata = null;
      pendingDownloadId = null;

    } catch (error) {
      console.error('[Service Worker] Error modifying ZIP:', error);
      // Fallback: save metadata as separate file
      await saveMetadataAsSeparateFile(storedMetadata);
      storedMetadata = null;
      pendingDownloadId = null;
    }
  }
});

// ============================================================================
// ZIP Modification Functions
// ============================================================================

/**
 * Modify ZIP with metadata
 */
async function modifyZipWithMetadata(zipData, metadata) {
  // Dynamic import for JSZip
  const { default: JSZip } = await import(chrome.runtime.getURL('lib/jszip.min.js'));

  const zip = await JSZip.loadAsync(zipData);
  const kriptikFolder = zip.folder('_kriptik');

  // Add main metadata
  kriptikFolder.file('import_metadata.json', JSON.stringify(metadata, null, 2));

  // Chat history
  if (metadata.chatHistory?.length > 0) {
    const chatData = {
      messageCount: metadata.chatHistory.length,
      messages: metadata.chatHistory,
      exportedAt: metadata.exportedAt
    };
    kriptikFolder.file('chat/conversation.json', JSON.stringify(chatData, null, 2));
    kriptikFolder.file('chat/conversation.md', generateChatMarkdown(metadata));
  }

  // Errors
  if (metadata.errors?.length > 0) {
    kriptikFolder.file('errors/errors.json', JSON.stringify(metadata.errors, null, 2));
  }

  // Console logs
  if (metadata.consoleLogs?.length > 0) {
    kriptikFolder.file('logs/console.json', JSON.stringify(metadata.consoleLogs, null, 2));
  }

  // Terminal output
  if (metadata.terminal?.available) {
    kriptikFolder.file('terminal/output.json', JSON.stringify(metadata.terminal, null, 2));
    if (metadata.terminal.output) {
      const terminalText = metadata.terminal.output
        .map(line => `[${line.type}] ${line.content}`)
        .join('\n');
      kriptikFolder.file('terminal/output.txt', terminalText);
    }
  }

  // Artifacts
  if (metadata.artifacts?.items?.length > 0) {
    kriptikFolder.file('artifacts/artifacts.json', JSON.stringify(metadata.artifacts, null, 2));
  }

  // Diffs
  if (metadata.diffs?.changes?.length > 0) {
    kriptikFolder.file('diffs/changes.json', JSON.stringify(metadata.diffs, null, 2));
  }

  // File structure
  if (metadata.files) {
    kriptikFolder.file('files/structure.json', JSON.stringify(metadata.files, null, 2));
  }

  // README
  kriptikFolder.file('README.md', generateReadme(metadata));

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Create a new enhanced ZIP with metadata (fallback when can't read original)
 */
async function createEnhancedZip(metadata, originalFilename) {
  const { default: JSZip } = await import(chrome.runtime.getURL('lib/jszip.min.js'));

  const zip = new JSZip();
  const kriptikFolder = zip.folder('_kriptik');

  // Add all metadata files
  kriptikFolder.file('import_metadata.json', JSON.stringify(metadata, null, 2));

  if (metadata.chatHistory?.length > 0) {
    kriptikFolder.file('chat/conversation.json', JSON.stringify({
      messageCount: metadata.chatHistory.length,
      messages: metadata.chatHistory,
      exportedAt: metadata.exportedAt
    }, null, 2));
    kriptikFolder.file('chat/conversation.md', generateChatMarkdown(metadata));
  }

  if (metadata.errors?.length > 0) {
    kriptikFolder.file('errors/errors.json', JSON.stringify(metadata.errors, null, 2));
  }

  if (metadata.consoleLogs?.length > 0) {
    kriptikFolder.file('logs/console.json', JSON.stringify(metadata.consoleLogs, null, 2));
  }

  kriptikFolder.file('README.md', generateReadme(metadata));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const filename = originalFilename.split('/').pop().replace('.zip', '_kriptik_metadata.zip');

  await chrome.downloads.download({
    url: URL.createObjectURL(zipBlob),
    filename: filename,
    saveAs: false
  });
}

/**
 * Save metadata as separate JSON file (last resort fallback)
 */
async function saveMetadataAsSeparateFile(metadata) {
  const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  await chrome.downloads.download({
    url: url,
    filename: `kriptik_import_metadata_${Date.now()}.json`,
    saveAs: false
  });

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Save modified ZIP
 */
async function saveModifiedZip(zipBlob, originalPath) {
  const url = URL.createObjectURL(zipBlob);
  const filename = originalPath.split('/').pop().replace('.zip', '_kriptik.zip');

  await chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false
  });

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate chat history markdown
 */
function generateChatMarkdown(metadata) {
  let md = `# Chat History Export\n\n`;
  md += `**Platform:** ${metadata.platform?.name || 'Unknown'}\n`;
  md += `**Exported:** ${metadata.exportedAt || new Date().toISOString()}\n`;
  md += `**Total Messages:** ${metadata.chatHistory?.length || 0}\n\n`;
  md += `---\n\n`;

  if (metadata.chatHistory) {
    metadata.chatHistory.forEach((msg, i) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      md += `## Message ${i + 1} - ${role}\n\n`;
      md += `${msg.content}\n\n`;
      if (msg.timestamp) {
        md += `*${msg.timestamp}*\n\n`;
      }
      md += `---\n\n`;
    });
  }

  return md;
}

/**
 * Generate README for the export
 */
function generateReadme(metadata) {
  return `# KripTik AI Import Package

This project was exported with **KripTik AI Import Assistant**.

## What's Included

### _kriptik Folder
- \`import_metadata.json\` - Complete metadata
- \`chat/\` - Full conversation history (JSON + Markdown)
- \`errors/\` - Error logs and stack traces
- \`logs/\` - Console output
- \`terminal/\` - Terminal commands (if available)
- \`artifacts/\` - Code artifacts (if available)
- \`diffs/\` - File changes (if available)
- \`files/\` - Project structure

## Import to KripTik AI
1. Go to KripTik AI
2. Click "Fix My App" or "Import Project"
3. Upload this ZIP file
4. KripTik AI will restore your project with full context

## Capture Statistics
- Platform: ${metadata.platform?.name || 'Unknown'}
- Messages: ${metadata.chatHistory?.length || 0}
- Errors: ${metadata.errors?.length || 0}
- Files: ${metadata.files?.stats?.totalFiles || 0}
- Exported: ${metadata.exportedAt || new Date().toISOString()}

---
Powered by **KripTik AI**
https://kriptik.ai
`;
}

// ============================================================================
// Cleanup
// ============================================================================

// Clean up stale credential capture sessions (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [tabId, session] of credentialCaptureSessions) {
    if (now - session.startedAt > 600000) { // 10 minutes
      credentialCaptureSessions.delete(tabId);
    }
  }
}, 60000);

// Clean up sessions when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  credentialCaptureSessions.delete(tabId);
});

// ============================================================================
// Initialization
// ============================================================================

console.log('[Service Worker] KripTik AI Extension initialized');
