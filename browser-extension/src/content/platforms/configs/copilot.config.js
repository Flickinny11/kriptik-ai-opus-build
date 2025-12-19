// GitHub Copilot Workspace Platform Configuration

(function () {
    const copilotConfig = {
        id: 'copilot-workspace',
        name: 'GitHub Copilot Workspace',
        provider: 'GitHub',
        tier: 1,
        hostPatterns: ['githubnext.com', 'github.com/copilot'],
        projectUrlPattern: /githubnext\.com\/projects\/([a-zA-Z0-9-]+)/,
        exportMechanism: 'github-export',

        features: {
            chatHistory: true,
            fileTree: true,
            livePreview: false,
            errorTracking: true,
            consoleAccess: false,
            gitIntegration: true,
            diffTracking: true,
            pullRequests: true
        },

        selectors: {
            chatContainer: '[class*="conversation"], [class*="chat"]',
            chatMessage: '[class*="message"], [data-testid*="message"]',
            messageRole: 'data-actor, data-role',
            messageContent: '[class*="body"], [class*="content"]',
            fileTree: '[aria-label="Files"], [class*="file-tree"]',
            fileItem: '[role="treeitem"], [class*="file-item"]',
            diffView: '[class*="diff"], [class*="changes"]',
            codeBlocks: 'pre code, [class*="code-block"]',
            exportButton: 'button:contains("Create PR"), button:contains("Commit")'
        },

        metadata: {
            color: '#6e40c9',
            description: 'AI-powered development workspace',
            url: 'https://githubnext.com'
        }
    };

    // Register this platform
    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(copilotConfig);
    }
})();
