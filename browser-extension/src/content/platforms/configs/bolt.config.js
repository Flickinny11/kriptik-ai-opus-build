// Bolt.new (StackBlitz) Platform Configuration
// Updated 2025-12-17 with improved selectors for current Bolt.new DOM structure

(function () {
    const boltConfig = {
        id: 'bolt',
        name: 'Bolt.new',
        provider: 'StackBlitz',
        tier: 1,
        hostPatterns: ['bolt.new', 'stackblitz.com'],
        projectUrlPattern: /bolt\.new\/([a-zA-Z0-9-~]+)/,
        exportMechanism: 'download-zip',

        features: {
            chatHistory: true,
            fileTree: true,
            livePreview: true,
            errorTracking: true,
            consoleAccess: true,
            terminal: true,
            codeBlocks: true
        },

        selectors: {
            // Bolt.new 2024-2025 DOM structure
            // The chat is in a scrollable container, messages have specific structure
            chatContainer: [
                // Primary: look for the messages container
                '[class*="Messages"]',
                '[class*="messages"]',
                '[class*="chat-messages"]',
                '[class*="ChatMessages"]',
                // Secondary: common patterns
                '[class*="conversation"]',
                '[class*="Conversation"]',
                // Fallback: main scrollable area
                'main [class*="overflow-y-auto"]',
                'main [class*="overflow-auto"]',
                '[role="log"]',
                'main'
            ].join(', '),

            // Message elements - Bolt uses divs with specific patterns
            // Each message bubble/turn in the conversation
            chatMessage: [
                // Bolt.new specific patterns
                '[class*="UserMessage"]',
                '[class*="AssistantMessage"]',
                '[class*="user-message"]',
                '[class*="assistant-message"]',
                '[class*="MessageContainer"]',
                '[class*="message-container"]',
                // Generic turn-based patterns
                '[class*="turn"]',
                '[class*="Turn"]',
                // Role-based containers
                '[data-role="user"]',
                '[data-role="assistant"]',
                // Generic message patterns
                '[class*="chat-message"]',
                '[class*="ChatMessage"]',
                '[class*="Message"]:not([class*="Messages"])',
                // Fallback: any element with message-like content
                'article',
                '[class*="prose"]'
            ].join(', '),

            messageRole: 'data-sender, data-role, data-author, data-message-author',
            messageContent: '[class*="markdown"], [class*="Markdown"], [class*="content"], [class*="prose"], [class*="text"], p',

            // Load more button for infinite scroll
            loadMoreButton: [
                'button[class*="load-more"]',
                'button[class*="load-earlier"]',
                '[class*="load-more"]',
                '[aria-label*="load more" i]',
                '[aria-label*="earlier" i]'
            ].join(', '),

            errorPanel: '[class*="error"], [class*="Error"], [role="alert"], [class*="ErrorBoundary"]',

            // File explorer sidebar
            fileTree: '[class*="file-tree"], [class*="FileTree"], [class*="explorer"], [class*="Explorer"], [class*="sidebar"], [class*="files"]',
            fileItem: '[class*="file"], [class*="File"], [class*="item"], [class*="entry"], [class*="node"]',

            // Preview iframe
            previewFrame: 'iframe[class*="preview"], iframe[title*="Preview"], iframe[src*="webcontainer"], iframe',

            // Terminal/console
            terminal: '[class*="terminal"], [class*="Terminal"], .xterm, [class*="console"]',

            // Export/download buttons
            exportButton: '[aria-label*="Download" i], [aria-label*="Export" i], button[class*="download"], button[class*="export"]',

            // Code blocks
            codeBlocks: 'pre code, [class*="code-block"], [class*="CodeBlock"], .hljs, [class*="shiki"]'
        },

        metadata: {
            color: '#00ffff',
            description: 'AI-powered full-stack web development',
            url: 'https://bolt.new'
        }
    };

    // Register this platform
    if (window.PlatformRegistry) {
        window.PlatformRegistry.register(boltConfig);
    }
})();
