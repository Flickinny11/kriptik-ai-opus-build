// API Export Handler
// Handles platforms that might have export APIs

class APIExportHandler extends ExportHandlerBase {
    constructor(platform) {
        super(platform);
        this.apiEndpoint = null;
        this.authToken = null;
    }

    /**
     * Export via API
     * @returns {Promise<boolean>} Success status
     */
    async export() {
        this.log('Starting API export...');

        if (!this.validateData()) {
            return false;
        }

        try {
            // Detect API endpoint from platform
            this.detectAPIEndpoint();

            // Try to get auth token
            await this.getAuthToken();

            if (!this.apiEndpoint) {
                this.log('No API endpoint detected, falling back to download', 'warn');
                return await this.fallbackToDownload();
            }

            // Send data to API
            await this.sendToAPI();

            this.log('API export completed');
            return true;

        } catch (error) {
            return this.handleError(error, 'during API export');
        }
    }

    /**
     * Detect API endpoint from platform configuration
     */
    detectAPIEndpoint() {
        // Check if platform has API configuration
        if (this.platform.apiEndpoint) {
            this.apiEndpoint = this.platform.apiEndpoint;
            this.log(`Using configured API endpoint: ${this.apiEndpoint}`);
            return;
        }

        // Try to detect from page
        const apiMeta = document.querySelector('meta[name="api-endpoint"]');
        if (apiMeta) {
            this.apiEndpoint = apiMeta.content;
            this.log(`Detected API endpoint from meta: ${this.apiEndpoint}`);
        }
    }

    /**
     * Get authentication token
     * @returns {Promise<void>}
     */
    async getAuthToken() {
        // Try to get token from localStorage
        const tokenKeys = ['authToken', 'token', 'accessToken', 'jwt'];

        for (const key of tokenKeys) {
            const token = localStorage.getItem(key);
            if (token) {
                this.authToken = token;
                this.log('Found auth token in localStorage');
                return;
            }
        }

        // Try to get from cookies
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (tokenKeys.includes(name)) {
                this.authToken = value;
                this.log('Found auth token in cookies');
                return;
            }
        }

        this.log('No auth token found', 'warn');
    }

    /**
     * Send data to API
     * @returns {Promise<void>}
     */
    async sendToAPI() {
        const metadata = this.prepareMetadata();

        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                type: 'project_export',
                data: metadata
            })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        this.log(`API export successful: ${JSON.stringify(result)}`);
    }

    /**
     * Fallback to downloading as file
     * @returns {Promise<boolean>} Success status
     */
    async fallbackToDownload() {
        const metadata = this.prepareMetadata();
        const json = JSON.stringify(metadata, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const filename = `${this.platform.id}_export_${Date.now()}.json`;

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

        this.log(`Downloaded as: ${filename}`);
        return true;
    }
}

// Make available globally
window.APIExportHandler = APIExportHandler;
