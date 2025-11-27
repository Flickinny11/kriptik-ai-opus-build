/**
 * OAuth Manager
 *
 * Central service for managing OAuth flows across all providers.
 * Handles authorization, token exchange, refresh, and credential storage.
 */

import { OAuthProvider, OAuthProviderId, OAuthTokens, OAuthUserInfo } from './types.js';
import { createGitHubProvider } from './providers/github.js';
import { createVercelProvider } from './providers/vercel.js';
import { createNetlifyProvider } from './providers/netlify.js';
import { createGoogleProvider } from './providers/google.js';
import { getCredentialVault, generatePKCE } from '../security/credential-vault.js';

export interface OAuthFlowResult {
    success: boolean;
    provider: OAuthProviderId;
    userInfo?: OAuthUserInfo;
    tokens?: OAuthTokens;
    credentialId?: string;
    error?: string;
}

export class OAuthManager {
    private providers: Map<OAuthProviderId, OAuthProvider> = new Map();
    private baseRedirectUri: string;

    constructor(baseUrl: string = 'http://localhost:3001') {
        this.baseRedirectUri = `${baseUrl}/api/oauth/callback`;
        this.initializeProviders();
    }

    /**
     * Initialize all OAuth providers from environment
     */
    private initializeProviders(): void {
        // GitHub
        const github = createGitHubProvider(`${this.baseRedirectUri}/github`);
        if (github) this.providers.set('github', github);

        // Vercel
        const vercel = createVercelProvider(`${this.baseRedirectUri}/vercel`);
        if (vercel) this.providers.set('vercel', vercel);

        // Netlify
        const netlify = createNetlifyProvider(`${this.baseRedirectUri}/netlify`);
        if (netlify) this.providers.set('netlify', netlify);

        // Google
        const google = createGoogleProvider(`${this.baseRedirectUri}/google`);
        if (google) this.providers.set('google', google);

        console.log(`OAuth Manager initialized with ${this.providers.size} providers:`,
            Array.from(this.providers.keys()).join(', '));
    }

    /**
     * Get available OAuth providers
     */
    getAvailableProviders(): Array<{ id: OAuthProviderId; name: string; configured: boolean }> {
        const allProviders: Array<{ id: OAuthProviderId; name: string }> = [
            { id: 'github', name: 'GitHub' },
            { id: 'vercel', name: 'Vercel' },
            { id: 'netlify', name: 'Netlify' },
            { id: 'google', name: 'Google Cloud' },
            { id: 'cloudflare', name: 'Cloudflare' },
            { id: 'slack', name: 'Slack' },
            { id: 'discord', name: 'Discord' },
            { id: 'notion', name: 'Notion' },
        ];

        return allProviders.map(p => ({
            ...p,
            configured: this.providers.has(p.id),
        }));
    }

    /**
     * Check if a provider is configured
     */
    isProviderConfigured(providerId: OAuthProviderId): boolean {
        return this.providers.has(providerId);
    }

    /**
     * Start OAuth authorization flow
     * Returns the authorization URL and state data
     */
    async startAuthorizationFlow(
        userId: string,
        providerId: OAuthProviderId,
        options?: {
            scopes?: string[];
            metadata?: Record<string, unknown>;
        }
    ): Promise<{ authorizationUrl: string; state: string } | { error: string }> {
        const provider = this.providers.get(providerId);

        if (!provider) {
            return { error: `OAuth provider '${providerId}' is not configured` };
        }

        const vault = getCredentialVault();

        // Generate PKCE if supported
        const pkce = generatePKCE();

        // Create OAuth state
        const stateData = await vault.createOAuthState(
            userId,
            providerId,
            `${this.baseRedirectUri}/${providerId}`,
            options?.scopes?.join(' '),
            pkce.codeVerifier,
            options?.metadata
        );

        // Get authorization URL
        const authorizationUrl = provider.getAuthorizationUrl(stateData.state, pkce.codeChallenge);

        return {
            authorizationUrl,
            state: stateData.state,
        };
    }

    /**
     * Complete OAuth authorization flow
     * Called after user is redirected back from provider
     */
    async completeAuthorizationFlow(
        providerId: OAuthProviderId,
        code: string,
        state: string
    ): Promise<OAuthFlowResult> {
        const provider = this.providers.get(providerId);

        if (!provider) {
            return {
                success: false,
                provider: providerId,
                error: `OAuth provider '${providerId}' is not configured`,
            };
        }

        const vault = getCredentialVault();

        // Consume and validate state
        const stateData = await vault.consumeOAuthState(state);

        if (!stateData) {
            return {
                success: false,
                provider: providerId,
                error: 'Invalid or expired OAuth state',
            };
        }

        try {
            // Exchange code for tokens
            const tokens = await provider.exchangeCodeForTokens(code, stateData.codeVerifier);

            // Get user info
            const userInfo = await provider.getUserInfo(tokens.accessToken);

            // Store credentials
            const credential = await vault.storeCredential(
                stateData.userId,
                providerId,
                {
                    // Store useful data from the OAuth flow
                    providerUserId: userInfo.id,
                    providerEmail: userInfo.email,
                    providerUsername: userInfo.username,
                },
                {
                    connectionName: `${provider.displayName} (${userInfo.email || userInfo.username || userInfo.id})`,
                    oauthProvider: providerId,
                    oauthAccessToken: tokens.accessToken,
                    oauthRefreshToken: tokens.refreshToken,
                    oauthTokenExpiresAt: tokens.expiresAt?.toISOString(),
                    oauthScope: tokens.scope,
                }
            );

            // Mark as valid
            await vault.updateValidationStatus(stateData.userId, providerId, 'valid');

            return {
                success: true,
                provider: providerId,
                userInfo,
                tokens,
                credentialId: credential.id,
            };
        } catch (error) {
            return {
                success: false,
                provider: providerId,
                error: error instanceof Error ? error.message : 'OAuth flow failed',
            };
        }
    }

    /**
     * Refresh tokens for a credential
     */
    async refreshTokens(
        userId: string,
        providerId: OAuthProviderId
    ): Promise<{ success: boolean; error?: string }> {
        const provider = this.providers.get(providerId);

        if (!provider) {
            return { success: false, error: `OAuth provider '${providerId}' is not configured` };
        }

        const vault = getCredentialVault();
        const credential = await vault.getCredential(userId, providerId);

        if (!credential || !credential.oauthRefreshToken) {
            return { success: false, error: 'No refresh token available' };
        }

        try {
            const newTokens = await provider.refreshAccessToken(credential.oauthRefreshToken);

            await vault.refreshOAuthTokens(
                userId,
                providerId,
                newTokens.accessToken,
                newTokens.refreshToken,
                newTokens.expiresAt?.toISOString()
            );

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Token refresh failed',
            };
        }
    }

    /**
     * Revoke OAuth connection
     */
    async revokeConnection(
        userId: string,
        providerId: OAuthProviderId
    ): Promise<{ success: boolean; error?: string }> {
        const provider = this.providers.get(providerId);
        const vault = getCredentialVault();

        const credential = await vault.getCredential(userId, providerId);

        if (!credential) {
            return { success: false, error: 'Credential not found' };
        }

        try {
            // Try to revoke at provider level if supported
            if (provider?.revokeTokens && credential.oauthAccessToken) {
                await provider.revokeTokens(credential.oauthAccessToken);
            }

            // Delete from our vault
            await vault.deleteCredential(userId, providerId);

            return { success: true };
        } catch (error) {
            // Still delete locally even if provider revocation fails
            await vault.deleteCredential(userId, providerId);
            return { success: true };
        }
    }

    /**
     * Get a valid access token for a provider
     * Automatically refreshes if expired
     */
    async getAccessToken(
        userId: string,
        providerId: OAuthProviderId
    ): Promise<string | null> {
        const vault = getCredentialVault();
        const credential = await vault.getCredential(userId, providerId);

        if (!credential || !credential.oauthAccessToken) {
            return null;
        }

        // Check if token is expired or about to expire (5 min buffer)
        if (credential.oauthTokenExpiresAt) {
            const expiresAt = new Date(credential.oauthTokenExpiresAt);
            const bufferMs = 5 * 60 * 1000; // 5 minutes

            if (Date.now() > expiresAt.getTime() - bufferMs) {
                // Token expired or about to expire, try to refresh
                const result = await this.refreshTokens(userId, providerId);

                if (!result.success) {
                    return null;
                }

                // Get updated credential
                const updated = await vault.getCredential(userId, providerId);
                return updated?.oauthAccessToken || null;
            }
        }

        return credential.oauthAccessToken;
    }

    /**
     * Validate a user's connection to a provider
     */
    async validateConnection(
        userId: string,
        providerId: OAuthProviderId
    ): Promise<{ valid: boolean; error?: string }> {
        const provider = this.providers.get(providerId);

        if (!provider) {
            return { valid: false, error: 'Provider not configured' };
        }

        const accessToken = await this.getAccessToken(userId, providerId);

        if (!accessToken) {
            return { valid: false, error: 'No valid token available' };
        }

        const isValid = await provider.validateToken(accessToken);

        // Update validation status
        const vault = getCredentialVault();
        const credential = await vault.getCredential(userId, providerId);

        if (credential) {
            await vault.updateValidationStatus(
                userId,
                providerId,
                isValid ? 'valid' : 'invalid'
            );
        }

        return { valid: isValid };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: OAuthManager | null = null;

export function getOAuthManager(): OAuthManager {
    if (!instance) {
        const baseUrl = process.env.API_URL || 'http://localhost:3001';
        instance = new OAuthManager(baseUrl);
    }
    return instance;
}

