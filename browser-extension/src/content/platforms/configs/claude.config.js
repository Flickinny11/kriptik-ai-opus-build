// Claude Artifacts (Anthropic) Platform Configuration

(function () {
    const claudeConfig = {
        id: 'claude-artifacts',
        name: 'Claude Artifacts',
        provider: 'Anthropic',
        tier: 2,
        hostPatterns: ['claude.ai'],
        projectUrlPattern: /claude\.ai\/chat\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'copy-artifact',

        features: {
            chatHistory: true,
            fileTree: false, // Single artifact/component
            livePreview: true,
            errorTracking: false,
            consoleAccess: false,
            artifacts: true,
            codeBlocks: true,
            iterations: true
        },

        selectors: {
            chatContainer: '[data-testid="conversation"], main',
            chatMessage: '[data-testid="message"], [class*="message"]',
            messageRole: 'data-sender, data-role',
            messageContent: '[class*="content"], div[class*="prose"]',
            artifact: '[data-artifact], [class*="artifact"]',
            codeBlocks: 'pre code, [class*="code-block"]',
            previewFrame: 'iframe[title="Artifact"], iframe[class*="artifact"]',
            copyButton: 'button:contains("Copy"), button[aria-label*="Copy"]',
            artifactContainer: '[class*="artifact-container"]'
        },

        metadata: {
            color: '#d4a574',
            description: 'AI assistant with interactive artifacts',
            url: 'https://claude.ai'
        }
    };

    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(claudeConfig);
    }
})();
