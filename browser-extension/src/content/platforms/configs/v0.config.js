// v0.dev (Vercel) Platform Configuration

(function () {
    const v0Config = {
        id: 'v0',
        name: 'v0',
        provider: 'Vercel',
        tier: 1,
        hostPatterns: ['v0.dev'],
        projectUrlPattern: /v0\.dev\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'copy-code',

        features: {
            chatHistory: true,
            fileTree: false, // Single component focus
            livePreview: true,
            errorTracking: true,
            consoleAccess: true,
            codeBlocks: true,
            artifacts: true, // Multiple iterations shown
            iterations: true
        },

        selectors: {
            chatContainer: '[class*="chat"], main, [class*="conversation"]',
            chatMessage: '[class*="message"], article',
            messageRole: 'data-role, data-message-role',
            messageContent: '[class*="content"], [class*="prose"]',
            codeBlocks: 'pre code, [class*="code-block"], [data-language]',
            previewFrame: 'iframe, [class*="preview"]',
            copyButton: 'button[class*="copy"], button:contains("Copy"), button[aria-label*="Copy"]',
            exportButton: 'button:contains("Export"), button[class*="export"], button[aria-label*="Export"]',
            iterationSelector: '[class*="iteration"], [class*="version"]',
            artifactContainer: '[class*="artifact"], [class*="preview-container"]'
        },

        metadata: {
            color: '#ffff00',
            description: 'Generative UI by Vercel',
            url: 'https://v0.dev'
        }
    };

    // Register this platform
    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(v0Config);
    }
})();
