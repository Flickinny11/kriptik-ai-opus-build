// Windsurf (Codeium) Platform Configuration

(function () {
    const windsurfConfig = {
        id: 'windsurf',
        name: 'Windsurf',
        provider: 'Codeium',
        tier: 2,
        hostPatterns: ['codeium.com/windsurf', 'windsurf.codeium.com'],
        projectUrlPattern: /(?:codeium\.com\/windsurf|windsurf\.codeium\.com)\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'export-project',

        features: {
            chatHistory: true,
            fileTree: true,
            livePreview: true,
            errorTracking: true,
            consoleAccess: true,
            codeBlocks: true
        },

        selectors: {
            chatContainer: '[class*="chat"], [class*="conversation"]',
            chatMessage: '[class*="message"]',
            messageRole: 'data-role, data-sender',
            messageContent: '[class*="content"], [class*="text"]',
            fileTree: '[class*="explorer"], [class*="file-tree"]',
            fileItem: '[class*="file-item"], [class*="tree-item"]',
            previewFrame: 'iframe, [class*="preview"]',
            exportButton: 'button:contains("Export"), [aria-label*="Export"]',
            codeBlocks: 'pre code, [class*="code-block"]'
        },

        metadata: {
            color: '#4fc3f7',
            description: 'AI-powered coding assistant',
            url: 'https://codeium.com/windsurf'
        }
    };

    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(windsurfConfig);
    }
})();
