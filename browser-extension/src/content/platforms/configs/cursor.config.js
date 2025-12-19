// Cursor AI Platform Configuration

(function () {
    const cursorConfig = {
        id: 'cursor',
        name: 'Cursor',
        provider: 'Cursor',
        tier: 1,
        hostPatterns: ['cursor.sh', 'cursor.com'],
        projectUrlPattern: /cursor\.(sh|com)\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'chat-export',

        features: {
            chatHistory: true,
            fileTree: true,
            livePreview: false,
            errorTracking: true,
            consoleAccess: false,
            diffTracking: true,
            codeBlocks: true,
            fileChanges: true
        },

        selectors: {
            chatContainer: '[class*="chat-container"], [class*="chat"], main',
            chatMessage: '[class*="chat-message"], [class*="message"]',
            messageRole: 'data-author, data-role',
            messageContent: '[class*="message-content"], [class*="content"]',
            codeBlocks: 'pre code, [class*="code-block"]',
            fileTree: '[class*="file-explorer"], [class*="sidebar"]',
            fileItem: '[class*="file-item"], [class*="tree-item"]',
            diffView: '[class*="diff"], [class*="changes"]',
            exportButton: 'button:contains("Export"), [class*="export"]'
        },

        metadata: {
            color: '#33ff33',
            description: 'AI-first code editor',
            url: 'https://cursor.sh'
        }
    };

    // Register this platform
    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(cursorConfig);
    }
})();
