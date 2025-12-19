// Lovable.dev Platform Configuration

(function () {
    const lovableConfig = {
        id: 'lovable',
        name: 'Lovable',
        provider: 'Lovable.dev',
        tier: 1,
        hostPatterns: ['lovable.dev'],
        projectUrlPattern: /lovable\.dev\/projects\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'export-button',

        features: {
            chatHistory: true,
            fileTree: true,
            livePreview: true,
            errorTracking: true,
            consoleAccess: true,
            codeBlocks: true
        },

        selectors: {
            chatContainer: '[data-testid="chat-messages"], .chat-container, [class*="ChatMessages"], [class*="conversation"]',
            chatMessage: '[data-testid="message"], .message, [class*="Message"], [class*="chat-message"]',
            messageRole: 'data-role, data-sender',
            messageContent: '.message-content, [class*="content"], p, [class*="MessageContent"]',
            loadMoreButton: '[data-testid="load-more"], button:contains("Load"), [class*="LoadMore"]',
            errorPanel: '[data-testid="error-panel"], .error-container, [class*="Error"], [class*="ErrorPanel"]',
            fileTree: '[data-testid="file-tree"], .file-explorer, [class*="FileTree"], [class*="FileExplorer"]',
            fileItem: '[data-testid="file-item"], .file-item, [class*="FileItem"]',
            previewFrame: 'iframe[src*="preview"], .preview-frame, iframe[class*="preview"]',
            exportButton: '[data-testid="export"], button:contains("Export"), [class*="Export"]',
            codeBlocks: 'pre code, [class*="code-block"], .hljs'
        },

        metadata: {
            color: '#ff00ff',
            description: 'Build full-stack apps with AI',
            url: 'https://lovable.dev'
        }
    };

    // Register this platform
    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(lovableConfig);
    }
})();
