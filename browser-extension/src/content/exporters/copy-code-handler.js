// Copy Code Handler
// Handles platforms that export via clipboard (v0, Claude, Create.xyz)

class CopyCodeHandler extends ExportHandlerBase {
    constructor(platform) {
        super(platform);
        this.copiedContent = null;
    }

    /**
     * Export by copying code to clipboard with metadata
     * @returns {Promise<boolean>} Success status
     */
    async export() {
        this.log('Starting clipboard export...');

        if (!this.validateData()) {
            return false;
        }

        try {
            // Collect all code blocks
            const codeBlocks = await this.collectCodeBlocks();

            // Prepare metadata
            const metadata = this.prepareMetadata();

            // Create export package
            const exportPackage = this.createExportPackage(codeBlocks, metadata);

            // Copy to clipboard
            await this.copyToClipboard(exportPackage);

            // Also download as file
            await this.downloadAsFile(exportPackage);

            this.log('Export completed successfully');
            return true;

        } catch (error) {
            return this.handleError(error, 'during clipboard export');
        }
    }

    /**
     * Collect all code blocks from the page
     * @returns {Promise<Array>} Array of code blocks
     */
    async collectCodeBlocks() {
        const codeBlocks = [];

        // Find all code blocks using platform selector
        const codeElements = PlatformDetector.findElements('codeBlocks');

        if (!codeElements || codeElements.length === 0) {
            this.log('No code blocks found', 'warn');
            return [];
        }

        this.log(`Found ${codeElements.length} code blocks`);

        codeElements.forEach((el, index) => {
            const language = el.getAttribute('data-language') ||
                el.className.match(/language-(\w+)/)?.[1] ||
                'text';

            codeBlocks.push({
                id: `code_${index}`,
                language: language,
                content: el.textContent || el.innerText,
                lineCount: (el.textContent || '').split('\n').length
            });
        });

        return codeBlocks;
    }

    /**
     * Create export package with code and metadata
     * @param {Array} codeBlocks - Code blocks array
     * @param {Object} metadata - Metadata object
     * @returns {Object} Export package
     */
    createExportPackage(codeBlocks, metadata) {
        return {
            metadata: metadata,
            code: codeBlocks,
            exportedAt: new Date().toISOString(),
            format: 'clipboard-export',
            platform: this.platform.name
        };
    }

    /**
     * Copy content to clipboard
     * @param {Object} exportPackage - Export package
     * @returns {Promise<void>}
     */
    async copyToClipboard(exportPackage) {
        const textContent = this.formatForClipboard(exportPackage);

        try {
            await navigator.clipboard.writeText(textContent);
            this.log('Copied to clipboard');
            this.copiedContent = textContent;
        } catch (error) {
            // Fallback to execCommand
            const textarea = document.createElement('textarea');
            textarea.value = textContent;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.log('Copied to clipboard (fallback method)');
        }
    }

    /**
     * Format export package for clipboard
     * @param {Object} exportPackage - Export package
     * @returns {string} Formatted text
     */
    formatForClipboard(exportPackage) {
        let text = `# ${this.platform.name} Export\n\n`;
        text += `Exported at: ${exportPackage.exportedAt}\n`;
        text += `Project: ${exportPackage.metadata.project.name}\n\n`;
        text += `---\n\n`;

        // Add code blocks
        exportPackage.code.forEach((block, index) => {
            text += `## Code Block ${index + 1} (${block.language})\n\n`;
            text += `\`\`\`${block.language}\n`;
            text += block.content;
            text += `\n\`\`\`\n\n`;
        });

        // Add metadata at the end
        text += `---\n\n`;
        text += `## Metadata\n\n`;
        text += `\`\`\`json\n`;
        text += JSON.stringify(exportPackage.metadata, null, 2);
        text += `\n\`\`\`\n`;

        return text;
    }

    /**
     * Download export package as JSON file
     * @param {Object} exportPackage - Export package
     * @returns {Promise<void>}
     */
    async downloadAsFile(exportPackage) {
        const json = JSON.stringify(exportPackage, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const filename = `${this.platform.id}_export_${Date.now()}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        this.log(`Downloaded as: ${filename}`);
    }

    /**
     * Get copied content
     * @returns {string|null} Copied content
     */
    getCopiedContent() {
        return this.copiedContent;
    }
}

// Make available globally
window.CopyCodeHandler = CopyCodeHandler;
