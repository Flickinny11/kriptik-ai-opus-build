/**
 * IONOS Domain Reseller Integration
 *
 * Search, purchase, and manage domains via IONOS Reseller API.
 * Domains are purchased on behalf of users and managed by KripTik.
 */

interface DomainSearchResult {
    domain: string;
    tld: string;
    available: boolean;
    premium: boolean;
    price: {
        registration: number; // in cents
        renewal: number;
        currency: string;
    };
}

interface DomainRegistration {
    domain: string;
    registrantContact: {
        firstName: string;
        lastName: string;
        email: string;
        address?: string;
        city?: string;
        country?: string;
        postalCode?: string;
        phone?: string;
    };
    autoRenew?: boolean;
}

interface DomainInfo {
    domain: string;
    status: 'active' | 'pending' | 'expired' | 'locked';
    expiresAt: string;
    autoRenew: boolean;
    nameservers: string[];
}

// Default TLD pricing (in cents)
const TLD_PRICING: Record<string, { registration: number; renewal: number }> = {
    'com': { registration: 1299, renewal: 1699 },
    'io': { registration: 3999, renewal: 5999 },
    'app': { registration: 1499, renewal: 1999 },
    'dev': { registration: 1299, renewal: 1699 },
    'co': { registration: 2999, renewal: 3499 },
    'net': { registration: 1299, renewal: 1699 },
    'org': { registration: 1299, renewal: 1699 },
    'ai': { registration: 8999, renewal: 8999 },
    'xyz': { registration: 999, renewal: 1299 },
    'tech': { registration: 4999, renewal: 5999 },
};

export class IONOSResellerService {
    private apiKey: string;
    private apiSecret: string;
    private contractNumber: string;
    private baseUrl = 'https://api.ionos.com/reseller/v2';

    constructor() {
        this.apiKey = process.env.IONOS_API_KEY || '';
        this.apiSecret = process.env.IONOS_API_SECRET || '';
        this.contractNumber = process.env.IONOS_CONTRACT_NUMBER || '';
    }

    /**
     * Check if IONOS is configured
     */
    isConfigured(): boolean {
        return !!(this.apiKey && this.apiSecret);
    }

    /**
     * Get authorization header
     */
    private getAuthHeader(): string {
        // IONOS uses Bearer token authentication
        return `Bearer ${this.apiKey}.${this.apiSecret}`;
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({})) as { message?: string };
            throw new Error(error.message || `IONOS API error: ${response.status}`);
        }

        // Handle empty responses (204 No Content)
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    /**
     * Search for available domains
     */
    async searchDomains(query: string, tlds?: string[]): Promise<DomainSearchResult[]> {
        // Default TLDs to check
        const targetTlds = tlds || ['com', 'io', 'app', 'dev', 'co', 'net', 'org', 'ai'];

        const results: DomainSearchResult[] = [];

        // Clean the query (remove any TLD if included)
        const cleanQuery = query.split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');

        if (!cleanQuery || cleanQuery.length < 2) {
            return results;
        }

        // Check each TLD
        for (const tld of targetTlds) {
            const domain = `${cleanQuery}.${tld}`;
            const pricing = TLD_PRICING[tld] || { registration: 1999, renewal: 2499 };

            // For production, you would make actual IONOS API calls here
            // For now, we simulate availability (IONOS requires reseller account)
            if (this.isConfigured()) {
                try {
                    // Try to check domain availability via IONOS
                    // This would be the actual API call:
                    // const availability = await this.request<{ available: boolean }>(`/domains/${domain}/check`);

                    // Since IONOS reseller API requires specific setup, we'll use a heuristic
                    // In production, replace this with actual API calls
                    const isLikelyAvailable = !['google', 'facebook', 'amazon', 'apple', 'microsoft'].some(
                        reserved => cleanQuery.includes(reserved)
                    );

                    results.push({
                        domain,
                        tld,
                        available: isLikelyAvailable,
                        premium: ['ai', 'io'].includes(tld) && cleanQuery.length <= 4,
                        price: {
                            registration: pricing.registration,
                            renewal: pricing.renewal,
                            currency: 'USD',
                        },
                    });
                } catch {
                    results.push({
                        domain,
                        tld,
                        available: false,
                        premium: false,
                        price: {
                            registration: pricing.registration,
                            renewal: pricing.renewal,
                            currency: 'USD',
                        },
                    });
                }
            } else {
                // If IONOS is not configured, still show pricing but mark as unavailable
                results.push({
                    domain,
                    tld,
                    available: false,
                    premium: false,
                    price: {
                        registration: pricing.registration,
                        renewal: pricing.renewal,
                        currency: 'USD',
                    },
                });
            }
        }

        // Sort: available first, then by price
        return results.sort((a, b) => {
            if (a.available !== b.available) return a.available ? -1 : 1;
            return a.price.registration - b.price.registration;
        });
    }

    /**
     * Register a domain
     */
    async registerDomain(registration: DomainRegistration): Promise<{
        orderId: string;
        domainId: string;
        status: string;
    }> {
        if (!this.isConfigured()) {
            throw new Error('IONOS not configured');
        }

        // This would be the actual IONOS API call
        // For now, we return a simulated response
        const result = await this.request<{
            id: string;
            href: string;
        }>(`/contracts/${this.contractNumber}/domains`, {
            method: 'POST',
            body: JSON.stringify({
                domain: registration.domain,
                registrant: {
                    firstName: registration.registrantContact.firstName,
                    lastName: registration.registrantContact.lastName,
                    email: registration.registrantContact.email,
                    address: registration.registrantContact.address || 'Not Provided',
                    city: registration.registrantContact.city || 'Not Provided',
                    country: registration.registrantContact.country || 'US',
                    postalCode: registration.registrantContact.postalCode || '00000',
                    phone: registration.registrantContact.phone || '+1.0000000000',
                },
                autoRenew: registration.autoRenew ?? true,
            }),
        });

        return {
            orderId: result.id,
            domainId: result.id,
            status: 'pending',
        };
    }

    /**
     * Get domain info
     */
    async getDomain(domain: string): Promise<DomainInfo> {
        if (!this.isConfigured()) {
            throw new Error('IONOS not configured');
        }

        const result = await this.request<{
            status: string;
            expiresAt: string;
            autoRenew: boolean;
            nameservers: string[];
        }>(`/contracts/${this.contractNumber}/domains/${domain}`);

        return {
            domain,
            status: result.status as 'active' | 'pending' | 'expired' | 'locked',
            expiresAt: result.expiresAt,
            autoRenew: result.autoRenew,
            nameservers: result.nameservers || [],
        };
    }

    /**
     * Configure DNS for Cloudflare Pages or Vercel
     */
    async configureDNSForHosting(
        domain: string,
        target: string,
        _provider: 'cloudflare' | 'vercel'
    ): Promise<void> {
        if (!this.isConfigured()) {
            throw new Error('IONOS not configured');
        }

        // Add CNAME for root
        await this.request(`/contracts/${this.contractNumber}/domains/${domain}/dns/records`, {
            method: 'POST',
            body: JSON.stringify({
                type: 'CNAME',
                name: '@',
                content: target,
                ttl: 3600,
            }),
        });

        // Add CNAME for www
        await this.request(`/contracts/${this.contractNumber}/domains/${domain}/dns/records`, {
            method: 'POST',
            body: JSON.stringify({
                type: 'CNAME',
                name: 'www',
                content: target,
                ttl: 3600,
            }),
        });
    }

    /**
     * Get transfer auth code (for no lock-in)
     */
    async getTransferAuthCode(domain: string): Promise<string> {
        if (!this.isConfigured()) {
            throw new Error('IONOS not configured');
        }

        const result = await this.request<{ authCode: string }>(
            `/contracts/${this.contractNumber}/domains/${domain}/transfer-auth-code`
        );
        return result.authCode;
    }

    /**
     * Get default pricing by TLD
     */
    getDefaultPrice(tld: string): { registration: number; renewal: number; currency: string } {
        const pricing = TLD_PRICING[tld] || { registration: 1999, renewal: 2499 };
        return {
            ...pricing,
            currency: 'USD',
        };
    }

    /**
     * Validate credentials
     */
    async validateCredentials(): Promise<boolean> {
        if (!this.isConfigured()) return false;

        try {
            await this.request('/contracts?limit=1');
            return true;
        } catch {
            return false;
        }
    }
}

// Singleton
let instance: IONOSResellerService | null = null;

export function getIONOSReseller(): IONOSResellerService {
    if (!instance) {
        instance = new IONOSResellerService();
    }
    return instance;
}

export const ionosReseller = new IONOSResellerService();

