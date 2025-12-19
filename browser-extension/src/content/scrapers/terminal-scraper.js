// Terminal Scraper
// Captures terminal output from platforms like Replit and Bolt

const TerminalScraper = {
    capturedOutput: [],
    observer: null,

    /**
     * Capture terminal output
     * @param {Object} platform - Platform configuration
     * @param {function} onProgress - Progress callback
     * @returns {Promise<Object>} Terminal data
     */
    async capture(platform, onProgress) {
        this.capturedOutput = [];

        if (!PlatformRegistry.hasFeature(platform, 'terminal')) {
            return { available: false, output: [] };
        }

        onProgress({
            phase: 'terminal',
            message: 'Searching for terminal...',
            progress: 0
        });

        try {
            // Find terminal element
            const terminal = this.findTerminal(platform);

            if (!terminal) {
                onProgress({
                    phase: 'terminal',
                    message: 'No terminal found',
                    progress: 100
                });
                return { available: false, output: [] };
            }

            onProgress({
                phase: 'terminal',
                message: 'Terminal found, extracting output...',
                progress: 30
            });

            // Extract current terminal content
            const output = await this.extractOutput(terminal);

            onProgress({
                phase: 'terminal',
                message: `Captured ${output.length} lines from terminal`,
                progress: 100
            });

            return {
                available: true,
                output: output,
                workingDirectory: this.extractWorkingDirectory(terminal),
                shell: this.detectShell(terminal)
            };

        } catch (error) {
            console.error('[Terminal Scraper] Error:', error);
            return { available: false, output: [], error: error.message };
        }
    },

    /**
     * Find terminal element
     * @param {Object} platform - Platform configuration
     * @returns {Element|null} Terminal element
     */
    findTerminal(platform) {
        // Try platform-specific terminal selector
        let terminal = PlatformDetector.findElement('terminal');

        if (!terminal) {
            // Try common terminal selectors
            const selectors = [
                '.xterm, [class*="xterm"]',
                '.terminal, [class*="terminal"]',
                '[class*="console"]',
                '[data-terminal], [data-console]'
            ];

            for (const selector of selectors) {
                terminal = document.querySelector(selector);
                if (terminal) break;
            }
        }

        return terminal;
    },

    /**
     * Extract terminal output
     * @param {Element} terminal - Terminal element
     * @returns {Promise<Array>} Terminal output lines
     */
    async extractOutput(terminal) {
        const output = [];

        // Check if it's an xterm.js terminal
        if (terminal.classList.contains('xterm') || terminal.querySelector('.xterm-rows')) {
            return this.extractXtermOutput(terminal);
        }

        // Try to extract from text content
        const lines = terminal.textContent.split('\n');

        lines.forEach((line, i) => {
            if (line.trim()) {
                output.push({
                    lineNumber: i + 1,
                    content: line,
                    type: this.detectLineType(line)
                });
            }
        });

        return output;
    },

    /**
     * Extract output from xterm.js terminal
     * @param {Element} terminal - Xterm terminal element
     * @returns {Array} Terminal output lines
     */
    extractXtermOutput(terminal) {
        const output = [];

        // xterm.js stores lines in .xterm-rows
        const rows = terminal.querySelectorAll('.xterm-rows > div');

        rows.forEach((row, i) => {
            const text = row.textContent || row.innerText;
            if (text && text.trim()) {
                output.push({
                    lineNumber: i + 1,
                    content: text,
                    type: this.detectLineType(text),
                    timestamp: null // xterm doesn't typically have timestamps
                });
            }
        });

        // If no rows found, try alternative methods
        if (output.length === 0) {
            const buffer = terminal.textContent.split('\n');
            buffer.forEach((line, i) => {
                if (line.trim()) {
                    output.push({
                        lineNumber: i + 1,
                        content: line,
                        type: this.detectLineType(line)
                    });
                }
            });
        }

        return output;
    },

    /**
     * Detect line type (command, output, error, etc.)
     * @param {string} line - Terminal line
     * @returns {string} Line type
     */
    detectLineType(line) {
        const trimmed = line.trim();

        // Check for common shell prompts
        if (trimmed.startsWith('$') || trimmed.startsWith('>') ||
            trimmed.startsWith('#') || trimmed.match(/^[\w@~]+[#$]/)) {
            return 'command';
        }

        // Check for errors
        if (trimmed.toLowerCase().includes('error') ||
            trimmed.toLowerCase().includes('failed') ||
            trimmed.toLowerCase().includes('exception')) {
            return 'error';
        }

        // Check for warnings
        if (trimmed.toLowerCase().includes('warn') ||
            trimmed.toLowerCase().includes('warning')) {
            return 'warning';
        }

        // Check for success messages
        if (trimmed.toLowerCase().includes('success') ||
            trimmed.toLowerCase().includes('complete') ||
            trimmed.match(/✓|✔|√/)) {
            return 'success';
        }

        return 'output';
    },

    /**
     * Extract working directory from terminal
     * @param {Element} terminal - Terminal element
     * @returns {string|null} Working directory
     */
    extractWorkingDirectory(terminal) {
        // Try to find pwd command in terminal
        const text = terminal.textContent;
        const pwdMatch = text.match(/(?:^|\n)\$?\s*pwd\s*\n([^\n]+)/m);
        if (pwdMatch) {
            return pwdMatch[1].trim();
        }

        // Try to extract from prompt
        const promptMatch = text.match(/[\w@-]+:([~\/][\w\/./-]+)[#$]/);
        if (promptMatch) {
            return promptMatch[1].trim();
        }

        return null;
    },

    /**
     * Detect shell type
     * @param {Element} terminal - Terminal element
     * @returns {string} Shell type
     */
    detectShell(terminal) {
        const text = terminal.textContent;

        // Check for shell indicators
        if (text.includes('bash')) return 'bash';
        if (text.includes('zsh')) return 'zsh';
        if (text.includes('fish')) return 'fish';
        if (text.includes('powershell') || text.includes('PS>')) return 'powershell';
        if (text.includes('cmd.exe') || text.match(/C:\\>/)) return 'cmd';

        // Default to bash
        return 'bash';
    },

    /**
     * Start observing terminal for new output
     * @param {Element} terminal - Terminal element
     * @param {function} callback - Callback for new output
     */
    observeTerminal(terminal, callback) {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const newOutput = this.extractOutput(terminal);
                    callback(newOutput);
                }
            });
        });

        this.observer.observe(terminal, {
            childList: true,
            subtree: true,
            characterData: true
        });
    },

    /**
     * Stop observing terminal
     */
    stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
};

window.TerminalScraper = TerminalScraper;
