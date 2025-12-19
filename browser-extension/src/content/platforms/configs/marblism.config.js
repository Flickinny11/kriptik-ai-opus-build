// Marblism Platform Configuration

(function () {
    const marblismConfig = {
        id: 'marblism',
        name: 'Marblism',
        provider: 'Marblism',
        tier: 2,
        hostPatterns: ['marblism.com'],
        projectUrlPattern: /marblism\.com\/projects\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'download-zip',

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
            messageRole: 'data-role',
            messageContent: '[class*="content"]',
            fileTree: '[class*="file"], [class*="tree"]',
            fileItem: '[class*="file-item"]',
            previewFrame: 'iframe',
            exportButton: 'button:contains("Download"), button:contains("Export")',
            codeBlocks: 'pre code'
        },

        metadata: {
            color: '#9c27b0',
            description: 'Generate full-stack applications',
            url: 'https://marblism.com'
        }
    };

    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(marblismConfig);
    }
})();
