/**
 * GitHub OAuth Provider
 *
 * Implements OAuth 2.0 flow for GitHub integration.
 * Allows users to connect their GitHub accounts for repo access.
 *
 * Documentation: https://docs.github.com/en/developers/apps/building-oauth-apps
 */

import { OAuthProvider, OAuthConfig, OAuthTokens, OAuthUserInfo } from '../types';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

export class GitHubOAuthProvider implements OAuthProvider {
    readonly providerId = 'github';
    readonly displayName = 'GitHub';

    private config: OAuthConfig;

    constructor(config: OAuthConfig) {
        this.config = config;
    }

    /**
     * Get the authorization URL for GitHub OAuth
     */
    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: this.config.scopes.join(' '),
            state,
            allow_signup: 'true',
        });

        return `${GITHUB_AUTH_URL}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
        const response = await fetch(GITHUB_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code,
                redirect_uri: this.config.redirectUri,
            }),
        });

        if (!response.ok) {
            throw new Error(`GitHub token exchange failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
        }

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            tokenType: data.token_type || 'bearer',
            scope: data.scope,
            // GitHub tokens don't expire unless revoked
        };
    }

    /**
     * GitHub doesn't support refresh tokens in standard OAuth flow
     * This is a placeholder that throws an error
     */
    async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
        // GitHub App installations support refresh tokens, but OAuth apps don't
        // For OAuth apps, users need to re-authorize
        throw new Error('GitHub OAuth tokens cannot be refreshed. User must re-authorize.');
    }

    /**
     * Get user information from GitHub
     */
    async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
        // Get basic user info
        const userResponse = await fetch(`${GITHUB_API_URL}/user`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!userResponse.ok) {
            throw new Error(`Failed to get GitHub user info: ${userResponse.status}`);
        }

        const user = await userResponse.json();

        // Get user's email (might be private)
        let email = user.email;
        if (!email) {
            const emailsResponse = await fetch(`${GITHUB_API_URL}/user/emails`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });

            if (emailsResponse.ok) {
                const emails = await emailsResponse.json();
                const primaryEmail = emails.find((e: any) => e.primary) || emails[0];
                email = primaryEmail?.email;
            }
        }

        return {
            id: String(user.id),
            email,
            name: user.name || user.login,
            avatarUrl: user.avatar_url,
            username: user.login,
            raw: user,
        };
    }

    /**
     * Revoke GitHub token
     */
    async revokeTokens(accessToken: string): Promise<void> {
        // GitHub requires using the application's client ID/secret to revoke
        const response = await fetch(
            `${GITHUB_API_URL}/applications/${this.config.clientId}/token`,
            {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ access_token: accessToken }),
            }
        );

        if (!response.ok && response.status !== 204) {
            console.warn('Failed to revoke GitHub token:', response.status);
        }
    }

    /**
     * Validate if the access token is still valid
     */
    async validateToken(accessToken: string): Promise<boolean> {
        try {
            const response = await fetch(`${GITHUB_API_URL}/user`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

/**
 * Create a GitHub OAuth provider instance from environment variables
 */
export function createGitHubProvider(redirectUri: string): GitHubOAuthProvider | null {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('GitHub OAuth not configured: missing GITHUB_OAUTH_CLIENT_ID or GITHUB_OAUTH_CLIENT_SECRET');
        return null;
    }

    return new GitHubOAuthProvider({
        clientId,
        clientSecret,
        redirectUri,
        scopes: ['read:user', 'user:email', 'repo'],
    });
}

