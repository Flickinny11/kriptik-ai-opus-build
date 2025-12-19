// ZIP Handler Utility
// Helper functions for ZIP file operations

const ZipHandler = {
    /**
     * Create a ZIP file from captured data
     * @param {Object} metadata - Metadata object
     * @param {Object} files - Optional files to include
     * @returns {Promise<Blob>} ZIP file blob
     */
    async createZip(metadata, files = {}) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }

        const zip = new JSZip();

        // Add metadata file
        zip.file('_import_metadata.json', JSON.stringify(metadata, null, 2));

        // Add any additional files
        Object.keys(files).forEach(filename => {
            zip.file(filename, files[filename]);
        });

        // Generate ZIP
        return await zip.generateAsync({ type: 'blob' });
    },

    /**
     * Add metadata to existing ZIP
     * @param {Blob} zipBlob - Existing ZIP blob
     * @param {Object} metadata - Metadata to add
     * @returns {Promise<Blob>} Modified ZIP blob
     */
    async addMetadataToZip(zipBlob, metadata) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }

        const zip = await JSZip.loadAsync(zipBlob);

        // Add or update metadata file
        zip.file('_import_metadata.json', JSON.stringify(metadata, null, 2));

        // Generate new ZIP
        return await zip.generateAsync({ type: 'blob' });
    },

    /**
     * Extract metadata from ZIP
     * @param {Blob} zipBlob - ZIP file blob
     * @returns {Promise<Object|null>} Metadata object or null
     */
    async extractMetadata(zipBlob) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }

        const zip = await JSZip.loadAsync(zipBlob);

        const metadataFile = zip.file('_import_metadata.json');
        if (!metadataFile) {
            return null;
        }

        const metadataText = await metadataFile.async('text');
        return JSON.parse(metadataText);
    },

    /**
     * Download ZIP file
     * @param {Blob} zipBlob - ZIP blob
     * @param {string} filename - Filename for download
     */
    downloadZip(zipBlob, filename) {
        const url = URL.createObjectURL(zipBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
};

window.ZipHandler = ZipHandler;
