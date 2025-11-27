/**
 * Google OAuth Provider
 *
 * Implements OAuth 2.0 flow for Google Cloud integration.
 * Allows users to connect their Google Cloud accounts.
 *
 * Documentation: https://developers.google.com/identity/protocols/oauth2
 */

import { OAuthProvider, OAuthConfig, OAuthTokens, OAuthUserInfo } from '../types.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export class GoogleOAuthProvider implements OAuthProvider {
    readonly providerId = 'google';
    readonly displayName = 'Google Cloud';

    private config: OAuthConfig;

    constructor(config: OAuthConfig) {
        this.config = config;
    }

    /**
     * Get the authorization URL for Google OAuth
     * Supports PKCE for enhanced security
     */
    getAuthorizationUrl(state: string, codeChallenge?: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: this.config.scopes.join(' '),
            state,
            access_type: 'offline', // Request refresh token
            prompt: 'consent', // Force consent screen to get refresh token
        });

        if (codeChallenge) {
            params.append('code_challenge', codeChallenge);
            params.append('code_challenge_method', 'S256');
        }

        return `${GOOGLE_AUTH_URL}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<OAuthTokens> {
        const body: Record<string, string> = {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
            grant_type: 'authorization_code',
        };

        if (codeVerifier) {
            body.code_verifier = codeVerifier;
        }

        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Google token exchange failed: ${error.error_description || error.error}`);
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            tokenType: data.token_type || 'Bearer',
            scope: data.scope,
            expiresAt: data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : undefined,
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
        const response = await fetch(GOOGLE_TOKEN_URL, {
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
            const error = await response.json();
            throw new Error(`Google token refresh failed: ${error.error_description || error.error}`);
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: refreshToken, // Google doesn't return a new refresh token
            tokenType: data.token_type || 'Bearer',
            scope: data.scope,
            expiresAt: data.expires_in
                ? new Date(Date.now() + data.expires_in * 1000)
                : undefined,
        };
    }

    /**
     * Get user information from Google
     */
    async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
        const response = await fetch(GOOGLE_USERINFO_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get Google user info: ${response.status}`);
        }

        const user = await response.json();

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.picture,
            raw: user,
        };
    }

    /**
     * Revoke Google tokens
     */
    async revokeTokens(accessToken: string): Promise<void> {
        const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${accessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (!response.ok) {
            console.warn('Failed to revoke Google token:', response.status);
        }
    }

    /**
     * Validate if the access token is still valid
     */
    async validateToken(accessToken: string): Promise<boolean> {
        try {
            const response = await fetch(
                `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
            );
            return response.ok;
        } catch {
            return false;
        }
    }
}

/**
 * Create a Google OAuth provider instance from environment variables
 */
export function createGoogleProvider(redirectUri: string): GoogleOAuthProvider | null {
    const clientId = process.env.GOOGLE_CLOUD_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLOUD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('Google OAuth not configured: missing GOOGLE_CLOUD_CLIENT_ID or GOOGLE_CLOUD_CLIENT_SECRET');
        return null;
    }

    return new GoogleOAuthProvider({
        clientId,
        clientSecret,
        redirectUri,
        scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/cloud-platform',
        ],
    });
}

