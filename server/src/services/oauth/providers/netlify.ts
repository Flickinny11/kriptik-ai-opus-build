/**
 * Netlify OAuth Provider
 *
 * Implements OAuth 2.0 flow for Netlify integration.
 * Allows users to connect their Netlify accounts for deployments.
 *
 * Documentation: https://docs.netlify.com/api/get-started/#oauth2
 */

import { OAuthProvider, OAuthConfig, OAuthTokens, OAuthUserInfo } from '../types';

const NETLIFY_AUTH_URL = 'https://app.netlify.com/authorize';
const NETLIFY_TOKEN_URL = 'https://api.netlify.com/oauth/token';
const NETLIFY_API_URL = 'https://api.netlify.com/api/v1';

export class NetlifyOAuthProvider implements OAuthProvider {
    readonly providerId = 'netlify';
    readonly displayName = 'Netlify';

    private config: OAuthConfig;

    constructor(config: OAuthConfig) {
        this.config = config;
    }

    /**
     * Get the authorization URL for Netlify OAuth
     */
    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            state,
        });

        return `${NETLIFY_AUTH_URL}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
        const response = await fetch(NETLIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code,
                redirect_uri: this.config.redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Netlify token exchange failed: ${error}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`Netlify OAuth error: ${data.error_description || data.error}`);
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
        const response = await fetch(NETLIFY_TOKEN_URL, {
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
            throw new Error(`Netlify token refresh failed: ${response.status}`);
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
     * Get user information from Netlify
     */
    async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
        const response = await fetch(`${NETLIFY_API_URL}/user`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get Netlify user info: ${response.status}`);
        }

        const user = await response.json();

        return {
            id: user.id,
            email: user.email,
            name: user.full_name,
            avatarUrl: user.avatar_url,
            username: user.slug,
            raw: user,
        };
    }

    /**
     * Validate if the access token is still valid
     */
    async validateToken(accessToken: string): Promise<boolean> {
        try {
            const response = await fetch(`${NETLIFY_API_URL}/user`, {
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
 * Create a Netlify OAuth provider instance from environment variables
 */
export function createNetlifyProvider(redirectUri: string): NetlifyOAuthProvider | null {
    const clientId = process.env.NETLIFY_CLIENT_ID;
    const clientSecret = process.env.NETLIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('Netlify OAuth not configured: missing NETLIFY_CLIENT_ID or NETLIFY_CLIENT_SECRET');
        return null;
    }

    return new NetlifyOAuthProvider({
        clientId,
        clientSecret,
        redirectUri,
        scopes: [],
    });
}

