/**
 * GitHub OAuth Authentication Service
 *
 * Handles GitHub OAuth flow for user authentication.
 * - Generates authorization URLs
 * - Exchanges codes for tokens
 * - Retrieves user info
 * - Encrypts/decrypts tokens for storage
 */

import { Octokit } from '@octokit/rest';
import crypto from 'crypto';
import { db } from '../../db.js';
import { githubConnections } from '../../schema.js';
import { eq } from 'drizzle-orm';

// Encryption constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

export interface GitHubTokenResponse {
    accessToken: string;
    refreshToken?: string;
    scope: string;
    tokenType: string;
}

export interface GitHubUserInfo {
    id: number;
    username: string;
    email: string;
    name: string;
    avatarUrl: string;
}

export interface GitHubConnection {
    id: string;
    userId: string;
    githubId: string;
    githubUsername: string;
    accessToken: string; // Encrypted
    refreshToken: string | null; // Encrypted
    scope: string | null;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export class GitHubAuthService {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;
    private encryptionKey: Buffer;

    constructor() {
        this.clientId = process.env.GITHUB_CLIENT_ID || '';
        this.clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
        this.redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:5173/auth/github/callback';

        // Derive encryption key from secret
        const secretKey = process.env.GITHUB_ENCRYPTION_SECRET || process.env.SESSION_SECRET || 'default-dev-secret';
        this.encryptionKey = crypto.scryptSync(secretKey, 'github-token-salt', 32);
    }

    /**
     * Check if GitHub OAuth is configured
     */
    isConfigured(): boolean {
        return Boolean(this.clientId && this.clientSecret);
    }

    /**
     * Generate authorization URL for GitHub OAuth
     */
    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: 'repo user:email read:user',
            state,
            allow_signup: 'true',
        });

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code,
                redirect_uri: this.redirectUri,
            }),
        });

        if (!response.ok) {
            throw new Error(`GitHub OAuth error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as {
            access_token?: string;
            refresh_token?: string;
            scope?: string;
            token_type?: string;
            error?: string;
            error_description?: string;
        };

        if (data.error) {
            throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
        }

        if (!data.access_token) {
            throw new Error('No access token received from GitHub');
        }

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            scope: data.scope || 'repo user:email',
            tokenType: data.token_type || 'bearer',
        };
    }

    /**
     * Get user info from GitHub using access token
     */
    async getUserInfo(accessToken: string): Promise<GitHubUserInfo> {
        const octokit = new Octokit({ auth: accessToken });

        // Get user profile
        const { data: user } = await octokit.users.getAuthenticated();

        // Get user's primary email
        let email = user.email || '';
        if (!email) {
            try {
                const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser();
                const primaryEmail = emails.find(e => e.primary);
                email = primaryEmail?.email || emails[0]?.email || '';
            } catch {
                // Email access may not be granted
            }
        }

        return {
            id: user.id,
            username: user.login,
            email,
            name: user.name || user.login,
            avatarUrl: user.avatar_url,
        };
    }

    /**
     * Encrypt a token for secure storage
     */
    encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Return IV + AuthTag + Encrypted data
        return iv.toString('hex') + authTag.toString('hex') + encrypted;
    }

    /**
     * Decrypt a token from storage
     */
    decrypt(ciphertext: string): string {
        const iv = Buffer.from(ciphertext.slice(0, IV_LENGTH * 2), 'hex');
        const authTag = Buffer.from(ciphertext.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2), 'hex');
        const encrypted = ciphertext.slice(IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);

        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Save or update a GitHub connection for a user
     */
    async saveConnection(
        userId: string,
        userInfo: GitHubUserInfo,
        tokens: GitHubTokenResponse
    ): Promise<GitHubConnection> {
        const now = new Date().toISOString();

        // Check for existing connection
        const existing = await db.select()
            .from(githubConnections)
            .where(eq(githubConnections.userId, userId))
            .limit(1);

        const encryptedAccessToken = this.encrypt(tokens.accessToken);
        const encryptedRefreshToken = tokens.refreshToken ? this.encrypt(tokens.refreshToken) : null;

        if (existing.length > 0) {
            // Update existing connection
            await db.update(githubConnections)
                .set({
                    githubId: String(userInfo.id),
                    githubUsername: userInfo.username,
                    accessToken: encryptedAccessToken,
                    refreshToken: encryptedRefreshToken,
                    scope: tokens.scope,
                    avatarUrl: userInfo.avatarUrl,
                    updatedAt: now,
                })
                .where(eq(githubConnections.userId, userId));

            return {
                ...existing[0],
                githubId: String(userInfo.id),
                githubUsername: userInfo.username,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                scope: tokens.scope,
                avatarUrl: userInfo.avatarUrl,
                updatedAt: now,
            };
        }

        // Create new connection
        const id = crypto.randomUUID();
        await db.insert(githubConnections).values({
            id,
            userId,
            githubId: String(userInfo.id),
            githubUsername: userInfo.username,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            scope: tokens.scope,
            avatarUrl: userInfo.avatarUrl,
            createdAt: now,
            updatedAt: now,
        });

        return {
            id,
            userId,
            githubId: String(userInfo.id),
            githubUsername: userInfo.username,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            scope: tokens.scope,
            avatarUrl: userInfo.avatarUrl,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Get a user's GitHub connection
     */
    async getConnection(userId: string): Promise<GitHubConnection | null> {
        const connections = await db.select()
            .from(githubConnections)
            .where(eq(githubConnections.userId, userId))
            .limit(1);

        return connections[0] || null;
    }

    /**
     * Get decrypted access token for a user
     */
    async getAccessToken(userId: string): Promise<string | null> {
        const connection = await this.getConnection(userId);
        if (!connection) return null;

        try {
            return this.decrypt(connection.accessToken);
        } catch {
            console.error('Failed to decrypt GitHub access token');
            return null;
        }
    }

    /**
     * Delete a user's GitHub connection
     */
    async deleteConnection(userId: string): Promise<boolean> {
        const result = await db.delete(githubConnections)
            .where(eq(githubConnections.userId, userId));

        return true;
    }

    /**
     * Verify if a connection is still valid
     */
    async verifyConnection(userId: string): Promise<boolean> {
        const accessToken = await this.getAccessToken(userId);
        if (!accessToken) return false;

        try {
            const octokit = new Octokit({ auth: accessToken });
            await octokit.users.getAuthenticated();
            return true;
        } catch {
            return false;
        }
    }
}

// Singleton instance
let instance: GitHubAuthService | null = null;

export function getGitHubAuthService(): GitHubAuthService {
    if (!instance) {
        instance = new GitHubAuthService();
    }
    return instance;
}

export function createGitHubAuthService(): GitHubAuthService {
    return new GitHubAuthService();
}
