/**
 * OAuth Provider Types
 *
 * Common interfaces for OAuth provider implementations.
 */

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}

export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    tokenType: string;
    scope?: string;
}

export interface OAuthUserInfo {
    id: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
    username?: string;
    // Provider-specific data
    raw: Record<string, unknown>;
}

export interface OAuthProvider {
    /**
     * Provider identifier (e.g., 'vercel', 'github')
     */
    readonly providerId: string;

    /**
     * Display name for the provider
     */
    readonly displayName: string;

    /**
     * Get the authorization URL for OAuth flow
     */
    getAuthorizationUrl(state: string, codeChallenge?: string): string;

    /**
     * Exchange authorization code for tokens
     */
    exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<OAuthTokens>;

    /**
     * Refresh an expired access token
     */
    refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

    /**
     * Get user information using access token
     */
    getUserInfo(accessToken: string): Promise<OAuthUserInfo>;

    /**
     * Revoke tokens (if supported)
     */
    revokeTokens?(accessToken: string): Promise<void>;

    /**
     * Validate if the access token is still valid
     */
    validateToken(accessToken: string): Promise<boolean>;
}

/**
 * Supported OAuth providers
 */
export type OAuthProviderId =
    | 'vercel'
    | 'github'
    | 'netlify'
    | 'google'
    | 'cloudflare'
    | 'supabase'
    | 'stripe'
    | 'slack'
    | 'discord'
    | 'notion';

/**
 * OAuth provider configuration from environment
 */
export interface OAuthProviderEnvConfig {
    clientIdEnvKey: string;
    clientSecretEnvKey: string;
    defaultScopes: string[];
}

export const OAUTH_PROVIDER_CONFIGS: Record<OAuthProviderId, OAuthProviderEnvConfig> = {
    vercel: {
        clientIdEnvKey: 'VERCEL_CLIENT_ID',
        clientSecretEnvKey: 'VERCEL_CLIENT_SECRET',
        defaultScopes: [],
    },
    github: {
        clientIdEnvKey: 'GITHUB_OAUTH_CLIENT_ID',
        clientSecretEnvKey: 'GITHUB_OAUTH_CLIENT_SECRET',
        defaultScopes: ['read:user', 'user:email', 'repo'],
    },
    netlify: {
        clientIdEnvKey: 'NETLIFY_CLIENT_ID',
        clientSecretEnvKey: 'NETLIFY_CLIENT_SECRET',
        defaultScopes: [],
    },
    google: {
        clientIdEnvKey: 'GOOGLE_CLOUD_CLIENT_ID',
        clientSecretEnvKey: 'GOOGLE_CLOUD_CLIENT_SECRET',
        defaultScopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/cloud-platform'],
    },
    cloudflare: {
        clientIdEnvKey: 'CLOUDFLARE_CLIENT_ID',
        clientSecretEnvKey: 'CLOUDFLARE_CLIENT_SECRET',
        defaultScopes: [],
    },
    supabase: {
        clientIdEnvKey: 'SUPABASE_CLIENT_ID',
        clientSecretEnvKey: 'SUPABASE_CLIENT_SECRET',
        defaultScopes: [],
    },
    stripe: {
        clientIdEnvKey: 'STRIPE_CONNECT_CLIENT_ID',
        clientSecretEnvKey: 'STRIPE_SECRET_KEY',
        defaultScopes: ['read_write'],
    },
    slack: {
        clientIdEnvKey: 'SLACK_CLIENT_ID',
        clientSecretEnvKey: 'SLACK_CLIENT_SECRET',
        defaultScopes: ['chat:write', 'channels:read', 'users:read'],
    },
    discord: {
        clientIdEnvKey: 'DISCORD_CLIENT_ID',
        clientSecretEnvKey: 'DISCORD_CLIENT_SECRET',
        defaultScopes: ['identify', 'email', 'guilds'],
    },
    notion: {
        clientIdEnvKey: 'NOTION_CLIENT_ID',
        clientSecretEnvKey: 'NOTION_CLIENT_SECRET',
        defaultScopes: [],
    },
};

