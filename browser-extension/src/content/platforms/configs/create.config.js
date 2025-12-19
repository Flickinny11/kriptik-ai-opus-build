// Create.xyz Platform Configuration

(function () {
    const createConfig = {
        id: 'create',
        name: 'Create',
        provider: 'Create.xyz',
        tier: 2,
        hostPatterns: ['create.xyz'],
        projectUrlPattern: /create\.xyz\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'export-code',

        features: {
            chatHistory: true,
            fileTree: false,
            livePreview: true,
            errorTracking: true,
            consoleAccess: true,
            codeBlocks: true
        },

        selectors: {
            chatContainer: '[class*="chat"], main',
            chatMessage: '[class*="message"]',
            messageRole: 'data-role',
            messageContent: '[class*="content"]',
            codeBlocks: 'pre code, [class*="code"]',
            previewFrame: 'iframe',
            copyButton: 'button:contains("Copy")',
            exportButton: 'button:contains("Export"), button:contains("Download")'
        },

        metadata: {
            color: '#00d4ff',
            description: 'AI web app builder',
            url: 'https://create.xyz'
        }
    };

    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(createConfig);
    }
})();
