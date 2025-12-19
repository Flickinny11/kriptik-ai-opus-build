// GitHub Export Handler
// Handles platforms with Git integration (GitHub Copilot Workspace)

class GitHubExportHandler extends ExportHandlerBase {
    constructor(platform) {
        super(platform);
        this.commitMessage = null;
        this.branchName = null;
    }

    /**
     * Export via GitHub (commit or PR)
     * @returns {Promise<boolean>} Success status
     */
    async export() {
        this.log('Starting GitHub export...');

        if (!this.validateData()) {
            return false;
        }

        try {
            // Prepare commit message with metadata reference
            this.prepareCommitMessage();

            // Save metadata as a file in the project
            await this.saveMetadataAsFile();

            // Trigger GitHub export (commit/PR)
            await this.triggerGitHubExport();

            this.log('GitHub export completed');
            return true;

        } catch (error) {
            return this.handleError(error, 'during GitHub export');
        }
    }

    /**
     * Prepare commit message with metadata info
     */
    prepareCommitMessage() {
        const metadata = this.prepareMetadata();

        this.commitMessage = [
            `Import from ${this.platform.name}`,
            '',
            `Project: ${metadata.project.name}`,
            `Captured: ${metadata.exportedAt}`,
            `Messages: ${metadata.chatHistory.messageCount}`,
            `Files: ${metadata.files.stats.totalFiles}`,
            '',
            'Metadata saved in .kriptik/import_metadata.json'
        ].join('\n');

        this.log('Prepared commit message');
    }

    /**
     * Save metadata as a file in the  project
     * @returns {Promise<void>}
     */
    async saveMetadataAsFile() {
        const metadata = this.prepareMetadata();
        const json = JSON.stringify(metadata, null, 2);

        // Try to create/update a file in the project
        // This depends on the platform's file creation API

        // For GitHub Copilot Workspace, we might need to:
        // 1. Create a .kriptik directory
        // 2. Add import_metadata.json file

        // Since we can't directly manipulate the GitHub repo from content script,
        // we'll download the file and instruct the user

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = '.kriptik_import_metadata.json';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        this.log('Metadata file downloaded - upload to repo as .kriptik/import_metadata.json');
    }

    /**
     * Trigger GitHub export button
     * @returns {Promise<void>}
     */
    async triggerGitHubExport() {
        // Look for commit/PR button
        const exportButton = PlatformDetector.findElement('exportButton');

        if (!exportButton) {
            this.log('Export button not found - manual export required', 'warn');
            return;
        }

        // Try to inject commit message if there's a textarea
        const commitTextarea = document.querySelector('textarea[name*="commit"], textarea[placeholder*="commit"]');
        if (commitTextarea && this.commitMessage) {
            commitTextarea.value = this.commitMessage;
            commitTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            this.log('Injected commit message');
        }

        // Click export button
        if (DOMHelpers.isVisible(exportButton)) {
            exportButton.click();
            this.log('Clicked export button');
            await this.wait(1000);
        }
    }

    /**
     * Get commit message
     * @returns {string|null} Commit message
     */
    getCommitMessage() {
        return this.commitMessage;
    }
}

// Make available globally
window.GitHubExportHandler = GitHubExportHandler;
