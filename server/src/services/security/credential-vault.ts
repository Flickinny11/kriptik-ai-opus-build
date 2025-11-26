/**
 * Credential Vault Service
 *
 * Provides enterprise-grade encryption for storing user integration credentials.
 * Uses AES-256-GCM encryption with per-credential IVs for maximum security.
 */

import * as crypto from 'crypto';
import { db } from '../../db';
import { userCredentials, oauthStates, credentialAuditLogs } from '../../schema';
import { eq, and, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { nowSQLite, addMinutesSQLite } from '../../utils/dates';

// ============================================================================
// TYPES
// ============================================================================

export interface CredentialData {
    [key: string]: string | number | boolean | undefined;
}

export interface StoredCredential {
    id: string;
    userId: string;
    integrationId: string;
    connectionName?: string;
    isActive: boolean;
    validationStatus: string;
    lastUsedAt?: string;
    lastValidatedAt?: string;
    createdAt: string;
    updatedAt: string;
    oauthProvider?: string;
    oauthTokenExpiresAt?: string;
    oauthScope?: string;
}

export interface DecryptedCredential extends StoredCredential {
    data: CredentialData;
    oauthAccessToken?: string;
    oauthRefreshToken?: string;
}

export interface OAuthStateData {
    id: string;
    userId: string;
    provider: string;
    state: string;
    codeVerifier?: string;
    redirectUri: string;
    scopes?: string;
    metadata?: Record<string, unknown>;
    expiresAt: string;
}

export interface AuditLogEntry {
    userId: string;
    credentialId?: string;
    integrationId: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'validate' | 'use' | 'refresh';
    status: 'success' | 'failure' | 'pending';
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    details?: Record<string, unknown>;
}

// ============================================================================
// ENCRYPTION ENGINE
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const keyHex = process.env.VAULT_ENCRYPTION_KEY;
    if (!keyHex) {
        const devSecret = process.env.BETTER_AUTH_SECRET || 'dev-secret-key-do-not-use-in-production';
        return crypto.createHash('sha256').update(devSecret).digest();
    }
    if (keyHex.length !== 64) {
        throw new Error('VAULT_ENCRYPTION_KEY must be a 64-character hex string');
    }
    return Buffer.from(keyHex, 'hex');
}

function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
        encrypted,
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
    };
}

function decrypt(encrypted: string, iv: string, authTag: string): string {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

function encryptCredentialData(data: CredentialData): { encrypted: string; iv: string; authTag: string } {
    return encrypt(JSON.stringify(data));
}

function decryptCredentialData(encrypted: string, iv: string, authTag: string): CredentialData {
    return JSON.parse(decrypt(encrypted, iv, authTag));
}

// ============================================================================
// CREDENTIAL VAULT CLASS
// ============================================================================

export class CredentialVault {
    private mapToStoredCredential(row: typeof userCredentials.$inferSelect): StoredCredential {
        return {
            id: row.id,
            userId: row.userId,
            integrationId: row.integrationId,
            connectionName: row.connectionName || undefined,
            isActive: row.isActive,
            validationStatus: row.validationStatus || 'pending',
            lastUsedAt: row.lastUsedAt || undefined,
            lastValidatedAt: row.lastValidatedAt || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            oauthProvider: row.oauthProvider || undefined,
            oauthTokenExpiresAt: row.oauthTokenExpiresAt || undefined,
            oauthScope: row.oauthScope || undefined,
        };
    }

    async storeCredential(
        userId: string,
        integrationId: string,
        data: CredentialData,
        options?: {
            connectionName?: string;
            oauthProvider?: string;
            oauthAccessToken?: string;
            oauthRefreshToken?: string;
            oauthTokenExpiresAt?: string;
            oauthScope?: string;
        }
    ): Promise<StoredCredential> {
        const { encrypted, iv, authTag } = encryptCredentialData(data);

        let encryptedAccessToken: string | undefined;
        let encryptedRefreshToken: string | undefined;

        if (options?.oauthAccessToken) {
            const tokenEnc = encrypt(options.oauthAccessToken);
            encryptedAccessToken = JSON.stringify(tokenEnc);
        }
        if (options?.oauthRefreshToken) {
            const tokenEnc = encrypt(options.oauthRefreshToken);
            encryptedRefreshToken = JSON.stringify(tokenEnc);
        }

        const existing = await db.select()
            .from(userCredentials)
            .where(and(
                eq(userCredentials.userId, userId),
                eq(userCredentials.integrationId, integrationId)
            ))
            .limit(1);

        const now = nowSQLite();

        if (existing.length > 0) {
            await db.update(userCredentials)
                .set({
                    encryptedData: encrypted,
                    iv,
                    authTag,
                    connectionName: options?.connectionName,
                    oauthProvider: options?.oauthProvider,
                    oauthAccessToken: encryptedAccessToken,
                    oauthRefreshToken: encryptedRefreshToken,
                    oauthTokenExpiresAt: options?.oauthTokenExpiresAt,
                    oauthScope: options?.oauthScope,
                    isActive: true,
                    validationStatus: 'pending',
                    updatedAt: now,
                })
                .where(eq(userCredentials.id, existing[0].id));

            await this.logAudit({
                userId,
                credentialId: existing[0].id,
                integrationId,
                action: 'update',
                status: 'success',
            });

            const [updated] = await db.select()
                .from(userCredentials)
                .where(eq(userCredentials.id, existing[0].id))
                .limit(1);

            return this.mapToStoredCredential(updated);
        }

        const [credential] = await db.insert(userCredentials)
            .values({
                userId,
                integrationId,
                encryptedData: encrypted,
                iv,
                authTag,
                connectionName: options?.connectionName,
                oauthProvider: options?.oauthProvider,
                oauthAccessToken: encryptedAccessToken,
                oauthRefreshToken: encryptedRefreshToken,
                oauthTokenExpiresAt: options?.oauthTokenExpiresAt,
                oauthScope: options?.oauthScope,
                isActive: true,
                validationStatus: 'pending',
            })
            .returning();

        await this.logAudit({
            userId,
            credentialId: credential.id,
            integrationId,
            action: 'create',
            status: 'success',
        });

        return this.mapToStoredCredential(credential);
    }

    async getCredential(
        userId: string,
        integrationId: string
    ): Promise<DecryptedCredential | null> {
        const [credential] = await db.select()
            .from(userCredentials)
            .where(and(
                eq(userCredentials.userId, userId),
                eq(userCredentials.integrationId, integrationId),
                eq(userCredentials.isActive, true)
            ))
            .limit(1);

        if (!credential) {
            return null;
        }

        const data = decryptCredentialData(
            credential.encryptedData,
            credential.iv,
            credential.authTag
        );

        let oauthAccessToken: string | undefined;
        let oauthRefreshToken: string | undefined;

        if (credential.oauthAccessToken) {
            const tokenData = JSON.parse(credential.oauthAccessToken);
            oauthAccessToken = decrypt(tokenData.encrypted, tokenData.iv, tokenData.authTag);
        }

        if (credential.oauthRefreshToken) {
            const tokenData = JSON.parse(credential.oauthRefreshToken);
            oauthRefreshToken = decrypt(tokenData.encrypted, tokenData.iv, tokenData.authTag);
        }

        await db.update(userCredentials)
            .set({ lastUsedAt: nowSQLite() })
            .where(eq(userCredentials.id, credential.id));

        await this.logAudit({
            userId,
            credentialId: credential.id,
            integrationId,
            action: 'read',
            status: 'success',
        });

        return {
            ...this.mapToStoredCredential(credential),
            data,
            oauthAccessToken,
            oauthRefreshToken,
        };
    }

    async listCredentials(userId: string): Promise<StoredCredential[]> {
        const credentials = await db.select()
            .from(userCredentials)
            .where(eq(userCredentials.userId, userId));

        return credentials.map(c => this.mapToStoredCredential(c));
    }

    async deleteCredential(userId: string, integrationId: string): Promise<boolean> {
        const [credential] = await db.select()
            .from(userCredentials)
            .where(and(
                eq(userCredentials.userId, userId),
                eq(userCredentials.integrationId, integrationId)
            ))
            .limit(1);

        if (!credential) {
            return false;
        }

        await db.update(userCredentials)
            .set({
                isActive: false,
                updatedAt: nowSQLite(),
            })
            .where(eq(userCredentials.id, credential.id));

        await this.logAudit({
            userId,
            credentialId: credential.id,
            integrationId,
            action: 'delete',
            status: 'success',
        });

        return true;
    }

    async updateValidationStatus(
        userId: string,
        integrationId: string,
        status: 'valid' | 'invalid' | 'expired'
    ): Promise<void> {
        await db.update(userCredentials)
            .set({
                validationStatus: status,
                lastValidatedAt: nowSQLite(),
                updatedAt: nowSQLite(),
            })
            .where(and(
                eq(userCredentials.userId, userId),
                eq(userCredentials.integrationId, integrationId)
            ));
    }

    async refreshOAuthTokens(
        userId: string,
        integrationId: string,
        newAccessToken: string,
        newRefreshToken?: string,
        newExpiresAt?: string
    ): Promise<void> {
        const tokenEnc = encrypt(newAccessToken);
        const encryptedAccessToken = JSON.stringify(tokenEnc);

        let encryptedRefreshToken: string | undefined;
        if (newRefreshToken) {
            const refreshEnc = encrypt(newRefreshToken);
            encryptedRefreshToken = JSON.stringify(refreshEnc);
        }

        await db.update(userCredentials)
            .set({
                oauthAccessToken: encryptedAccessToken,
                oauthRefreshToken: encryptedRefreshToken,
                oauthTokenExpiresAt: newExpiresAt,
                updatedAt: nowSQLite(),
            })
            .where(and(
                eq(userCredentials.userId, userId),
                eq(userCredentials.integrationId, integrationId)
            ));

        await this.logAudit({
            userId,
            integrationId,
            action: 'refresh',
            status: 'success',
        });
    }

    // OAuth State Management
    async createOAuthState(
        userId: string,
        provider: string,
        redirectUri: string,
        scopes?: string,
        codeVerifier?: string,
        metadata?: Record<string, unknown>
    ): Promise<OAuthStateData> {
        const state = uuidv4();
        const expiresAt = addMinutesSQLite(new Date(), 10);

        const [oauthState] = await db.insert(oauthStates)
            .values({
                userId,
                provider,
                state,
                redirectUri,
                scopes,
                codeVerifier,
                metadata,
                expiresAt,
            })
            .returning();

        return {
            id: oauthState.id,
            userId: oauthState.userId,
            provider: oauthState.provider,
            state: oauthState.state,
            codeVerifier: oauthState.codeVerifier || undefined,
            redirectUri: oauthState.redirectUri,
            scopes: oauthState.scopes || undefined,
            metadata: oauthState.metadata as Record<string, unknown> | undefined,
            expiresAt: oauthState.expiresAt,
        };
    }

    async consumeOAuthState(state: string): Promise<OAuthStateData | null> {
        const [oauthState] = await db.select()
            .from(oauthStates)
            .where(eq(oauthStates.state, state))
            .limit(1);

        if (!oauthState) {
            return null;
        }

        // Check if expired
        if (new Date(oauthState.expiresAt) < new Date()) {
            await db.delete(oauthStates).where(eq(oauthStates.id, oauthState.id));
            return null;
        }

        // Check if already used
        if (oauthState.usedAt) {
            return null;
        }

        // Mark as used
        await db.update(oauthStates)
            .set({ usedAt: nowSQLite() })
            .where(eq(oauthStates.id, oauthState.id));

        return {
            id: oauthState.id,
            userId: oauthState.userId,
            provider: oauthState.provider,
            state: oauthState.state,
            codeVerifier: oauthState.codeVerifier || undefined,
            redirectUri: oauthState.redirectUri,
            scopes: oauthState.scopes || undefined,
            metadata: oauthState.metadata as Record<string, unknown> | undefined,
            expiresAt: oauthState.expiresAt,
        };
    }

    async cleanupExpiredStates(): Promise<number> {
        const result = await db.delete(oauthStates)
            .where(lt(oauthStates.expiresAt, nowSQLite()));
        return 0; // LibSQL doesn't return affected count easily
    }

    // Audit Logging
    private async logAudit(entry: AuditLogEntry): Promise<void> {
        await db.insert(credentialAuditLogs).values({
            id: uuidv4(),
            userId: entry.userId,
            credentialId: entry.credentialId,
            integrationId: entry.integrationId,
            action: entry.action,
            status: entry.status,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            requestId: entry.requestId,
            details: entry.details,
        });
    }

    async getAuditLogs(
        userId: string,
        integrationId?: string,
        limit: number = 50
    ): Promise<Array<{
        id: string;
        integrationId: string;
        action: string;
        status: string;
        createdAt: string;
        details?: Record<string, unknown>;
    }>> {
        const logs = await db.select()
            .from(credentialAuditLogs)
            .where(
                integrationId
                    ? and(
                        eq(credentialAuditLogs.userId, userId),
                        eq(credentialAuditLogs.integrationId, integrationId)
                    )
                    : eq(credentialAuditLogs.userId, userId)
            )
            .limit(limit);

        return logs.map(log => ({
            id: log.id,
            integrationId: log.integrationId,
            action: log.action,
            status: log.status,
            createdAt: log.createdAt,
            details: log.details as Record<string, unknown> | undefined,
        }));
    }

    // Validation
    async validateCredential(
        userId: string,
        integrationId: string,
        validator: (data: CredentialData) => Promise<boolean>
    ): Promise<boolean> {
        const credential = await this.getCredential(userId, integrationId);
        if (!credential) {
            return false;
        }

        try {
            const isValid = await validator(credential.data);
            await this.updateValidationStatus(userId, integrationId, isValid ? 'valid' : 'invalid');
            
            await this.logAudit({
                userId,
                credentialId: credential.id,
                integrationId,
                action: 'validate',
                status: isValid ? 'success' : 'failure',
            });
            
            return isValid;
        } catch (error) {
            await this.updateValidationStatus(userId, integrationId, 'invalid');
            return false;
        }
    }
}

// Singleton instance
let vaultInstance: CredentialVault | null = null;

export function getCredentialVault(): CredentialVault {
    if (!vaultInstance) {
        vaultInstance = new CredentialVault();
    }
    return vaultInstance;
}

// ============================================================================
// PKCE UTILITIES
// ============================================================================

/**
 * Generate PKCE code verifier and challenge
 * Used for OAuth flows that support PKCE (Proof Key for Code Exchange)
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    // Generate a random 43-128 character code verifier
    const codeVerifier = crypto.randomBytes(32)
        .toString('base64url')
        .substring(0, 43);
    
    // Generate SHA-256 hash as code challenge
    const codeChallenge = crypto.createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    
    return { codeVerifier, codeChallenge };
}
