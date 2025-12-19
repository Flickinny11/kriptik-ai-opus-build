// Storage Utility
// Helper for chrome.storage operations

const Storage = {
    /**
     * Save data to chrome.storage.local
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    },

    /**
     * Get data from chrome.storage.local
     * @param {string} key - Storage key
     * @returns {Promise<*>} Stored value
     */
    async get(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result[key]);
                }
            });
        });
    },

    /**
     * Remove data from chrome.storage.local
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    async remove(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove([key], () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    },

    /**
     * Clear all storage
     * @returns {Promise<void>}
     */
    async clear() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.clear(() => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    },

    /**
     * Get all stored data
     * @returns {Promise<Object>} All stored data
     */
    async getAll() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(null, (items) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(items);
                }
            });
        });
    }
};

window.Storage = Storage;
