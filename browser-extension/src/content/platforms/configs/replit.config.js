// Replit Agent Platform Configuration

(function () {
    const replitConfig = {
        id: 'replit',
        name: 'Replit Agent',
        provider: 'Replit',
        tier: 1,
        hostPatterns: ['replit.com'],
        projectUrlPattern: /replit\.com\/@([^/]+)\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'download-zip',

        features: {
            chatHistory: true,
            fileTree: true,
            livePreview: true,
            errorTracking: true,
            consoleAccess: true,
            terminal: true,
            codeBlocks: true,
            packageManager: true
        },

        selectors: {
            chatContainer: '[class*="ai-chat"], [data-cy="ai-panel"], [class*="chat"]',
            chatMessage: '[class*="message"], [data-cy="message"]',
            messageRole: 'data-role, data-author',
            messageContent: '[class*="content"], [class*="message-text"]',
            fileTree: '[class*="filetree"], [class*="file-tree"], nav[aria-label*="Files"]',
            fileItem: '[class*="file"], [class*="tree-item"], li[role="treeitem"]',
            previewFrame: 'iframe[class*="webview"], iframe[title*="preview"]',
            terminal: '[class*="terminal"], .xterm, [class*="console"]',
            exportButton: 'button:contains("Download"), [aria-label*="Download"]',
            codeBlocks: 'pre code, [class*="code-block"]'
        },

        metadata: {
            color: '#ff6600',
            description: 'Collaborative browser-based IDE with AI',
            url: 'https://replit.com'
        }
    };

    // Register this platform
    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(replitConfig);
    }
})();
