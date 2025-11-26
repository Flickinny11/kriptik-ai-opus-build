/**
 * Vercel OAuth Provider
 *
 * Implements OAuth 2.0 flow for Vercel integration.
 * Allows users to connect their Vercel accounts for deployments.
 *
 * Documentation: https://vercel.com/docs/rest-api#oauth2
 */

import { OAuthProvider, OAuthConfig, OAuthTokens, OAuthUserInfo } from '../types';

const VERCEL_AUTH_URL = 'https://vercel.com/oauth/authorize';
const VERCEL_TOKEN_URL = 'https://api.vercel.com/v2/oauth/access_token';
const VERCEL_API_URL = 'https://api.vercel.com';

export class VercelOAuthProvider implements OAuthProvider {
    readonly providerId = 'vercel';
    readonly displayName = 'Vercel';

    private config: OAuthConfig;

    constructor(config: OAuthConfig) {
        this.config = config;
    }

    /**
     * Get the authorization URL for Vercel OAuth
     */
    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            state,
            // Vercel doesn't use scopes in the same way - permissions are set in the integration
        });

        return `${VERCEL_AUTH_URL}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
        const response = await fetch(VERCEL_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code,
                redirect_uri: this.config.redirectUri,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Vercel token exchange failed: ${error}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`Vercel OAuth error: ${data.error_description || data.error}`);
        }

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            tokenType: data.token_type || 'Bearer',
            expiresAt: data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : undefined,
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
        const response = await fetch(VERCEL_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            throw new Error(`Vercel token refresh failed: ${response.status}`);
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken,
            tokenType: data.token_type || 'Bearer',
            expiresAt: data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : undefined,
        };
    }

    /**
     * Get user information from Vercel
     */
    async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
        const response = await fetch(`${VERCEL_API_URL}/v2/user`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get Vercel user info: ${response.status}`);
        }

        const data = await response.json();
        const user = data.user;

        return {
            id: user.id || user.uid,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar,
            username: user.username,
            raw: user,
        };
    }

    /**
     * Validate if the access token is still valid
     */
    async validateToken(accessToken: string): Promise<boolean> {
        try {
            const response = await fetch(`${VERCEL_API_URL}/v2/user`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

/**
 * Create a Vercel OAuth provider instance from environment variables
 */
export function createVercelProvider(redirectUri: string): VercelOAuthProvider | null {
    const clientId = process.env.VERCEL_CLIENT_ID;
    const clientSecret = process.env.VERCEL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('Vercel OAuth not configured: missing VERCEL_CLIENT_ID or VERCEL_CLIENT_SECRET');
        return null;
    }

    return new VercelOAuthProvider({
        clientId,
        clientSecret,
        redirectUri,
        scopes: [], // Vercel doesn't use scopes
    });
}

