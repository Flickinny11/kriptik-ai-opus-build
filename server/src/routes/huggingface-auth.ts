/**
 * HuggingFace Authentication Routes
 *
 * Handles HuggingFace token validation, storage, and management.
 * Required for Open Source Studio training/fine-tuning features.
 *
 * Part of KripTik AI's GPU & AI Lab Implementation (PROMPT 3)
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { userCredentials } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import crypto from 'crypto';
import { getCredentialVault } from '../services/security/credential-vault.js';

// Use singleton credential vault for consistent encryption/decryption
const getVault = () => getCredentialVault();

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface HuggingFaceWhoAmI {
  id: string;
  type: 'user' | 'org';
  name: string;
  fullname: string;
  email?: string;
  emailVerified?: boolean;
  plan?: string;
  isPro?: boolean;
  canPay?: boolean;
  avatarUrl?: string;
  orgs?: Array<{
    id: string;
    name: string;
    fullname: string;
    isEnterprise: boolean;
  }>;
  auth?: {
    type: string;
    accessToken: {
      displayName: string;
      createdAt: string;
      role: string;
      fineGrained?: {
        global?: string[];
        scoped?: Array<{
          entity: { type: string; name: string };
          permissions: string[];
        }>;
      };
    };
  };
}

interface TokenValidationResult {
  valid: boolean;
  username?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  canWrite: boolean;
  isPro: boolean;
  error?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get encryption key from environment or generate a consistent one
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (envKey) {
    return crypto.scryptSync(envKey, 'salt', 32);
  }
  // Fallback to a deterministic key (not ideal for production)
  return crypto.scryptSync('kriptik-ai-default-key', 'salt', 32);
}

/**
 * Encrypt a token for secure storage
 */
function encryptToken(token: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted: encrypted + ':' + authTag,
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypt a stored token
 */
function decryptToken(encryptedData: string, ivHex: string, authTagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Validate a HuggingFace token by calling the whoami endpoint
 */
async function validateHuggingFaceToken(token: string): Promise<TokenValidationResult> {
  try {
    // Server-to-server call to HuggingFace API
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, canWrite: false, isPro: false, error: 'Invalid or expired token' };
      }
      return { valid: false, canWrite: false, isPro: false, error: `HuggingFace API error: ${response.status}` };
    }

    const data: HuggingFaceWhoAmI = await response.json();

    // Check for write access
    let canWrite = false;

    // Check fine-grained permissions
    if (data.auth?.accessToken?.fineGrained) {
      const globalPerms = data.auth.accessToken.fineGrained.global || [];
      // Check for write permissions
      canWrite = globalPerms.some(p =>
        p === 'write-repos' ||
        p === 'manage-repos' ||
        p === 'write' ||
        p.includes('write')
      );

      // Also check if role indicates write access
      if (!canWrite && data.auth.accessToken.role) {
        canWrite = data.auth.accessToken.role === 'write' || data.auth.accessToken.role === 'admin';
      }
    } else {
      // Older token format - check role
      canWrite = data.auth?.accessToken?.role === 'write' || data.auth?.accessToken?.role === 'admin';
    }

    // If we can't determine write access from fine-grained, assume write if not read-only
    if (!canWrite && data.auth?.accessToken?.role !== 'read') {
      // For older tokens without explicit permissions, assume write access
      canWrite = true;
    }

    return {
      valid: true,
      username: data.name,
      fullName: data.fullname || data.name,
      email: data.email,
      avatarUrl: data.avatarUrl,
      canWrite,
      isPro: data.plan === 'pro' || data.isPro === true,
    };
  } catch (error) {
    console.error('[HuggingFace Auth] Token validation error:', error);
    return {
      valid: false,
      canWrite: false,
      isPro: false,
      error: error instanceof Error ? error.message : 'Failed to validate token',
    };
  }
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/huggingface/validate-token
 * Validate a HuggingFace token and optionally store it
 */
router.post('/validate-token', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  console.log('[HuggingFace Auth] Received validate-token request');
  try {
    const { token, store = true } = req.body;
    const userId = req.user?.id;

    console.log('[HuggingFace Auth] User ID:', userId ? 'present' : 'missing');
    console.log('[HuggingFace Auth] Token:', token ? `hf_...${token.slice(-4)} (${token.length} chars)` : 'missing');

    if (!token) {
      console.log('[HuggingFace Auth] Error: Token is required');
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    if (!userId) {
      console.log('[HuggingFace Auth] Error: No user ID (not authenticated)');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Basic format validation
    if (!token.startsWith('hf_') || token.length < 30) {
      console.log('[HuggingFace Auth] Error: Invalid token format');
      res.status(400).json({ error: 'Invalid token format. HuggingFace tokens start with "hf_"' });
      return;
    }

    // Validate with HuggingFace API
    console.log('[HuggingFace Auth] Calling HuggingFace API...');
    const result = await validateHuggingFaceToken(token);
    console.log('[HuggingFace Auth] HuggingFace API result:', { valid: result.valid, canWrite: result.canWrite, username: result.username, error: result.error });

    if (!result.valid) {
      res.status(400).json({ error: result.error || 'Invalid token' });
      return;
    }

    if (!result.canWrite) {
      res.status(400).json({
        error: 'This token does not have write access. Please create a new token with write permissions.',
        username: result.username,
        canWrite: false,
      });
      return;
    }

    // Store the token if requested - use credential vault for proper encryption
    // This ensures the token is stored in oauthAccessToken for services to retrieve
    if (store) {
      try {
        // Store metadata in the credential data field
        const credentialData = {
          username: result.username,
          fullName: result.fullName,
          avatarUrl: result.avatarUrl,
          canWrite: result.canWrite,
          isPro: result.isPro,
          validatedAt: new Date().toISOString(),
        };

        // Use the credential vault to properly store with oauthAccessToken
        // This allows services to retrieve via getVault().getCredential(userId, 'huggingface').oauthAccessToken
        await getVault().storeCredential(userId, 'huggingface', credentialData, {
          connectionName: result.username || 'HuggingFace',
          oauthProvider: 'huggingface',
          oauthAccessToken: token, // Store the actual token here for retrieval
        });

        console.log(`[HuggingFace Auth] Token stored successfully for user ${userId}`);
      } catch (storeError) {
        // Log the error but don't fail the request - token was validated successfully
        // Storage failure shouldn't block the user from using the validated token
        console.error('[HuggingFace Auth] Failed to store token:', storeError);
        console.error('[HuggingFace Auth] Storage error details:', {
          message: storeError instanceof Error ? storeError.message : 'Unknown',
          stack: storeError instanceof Error ? storeError.stack : undefined,
        });
        // Continue - we'll return success since the token is valid
        // User can re-try storage or use the token for this session
      }
    }

    res.json({
      valid: true,
      username: result.username,
      fullName: result.fullName,
      email: result.email,
      avatarUrl: result.avatarUrl,
      canWrite: result.canWrite,
      isPro: result.isPro,
    });
  } catch (error) {
    console.error('[HuggingFace Auth] Validation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[HuggingFace Auth] Error details:', { message: errorMessage, stack: errorStack });
    res.status(500).json({ error: 'Failed to validate token', details: errorMessage });
  }
});

/**
 * GET /api/huggingface/status
 * Get current HuggingFace connection status for the user
 */
router.get('/status', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  console.log('[HuggingFace Auth] Status check started');
  try {
    const userId = req.user?.id;
    console.log('[HuggingFace Auth] User ID:', userId);

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Use the credential vault to properly retrieve and decrypt the token
    console.log('[HuggingFace Auth] Getting credential from vault...');
    try {
      const credential = await getVault().getCredential(userId, 'huggingface');

      if (!credential) {
        console.log('[HuggingFace Auth] No credential found in vault');
        res.json({ connected: false });
        return;
      }

      console.log('[HuggingFace Auth] Credential found:', {
        id: credential.id,
        hasOAuthToken: !!credential.oauthAccessToken,
        connectionName: credential.connectionName,
      });

      // Get the token from oauthAccessToken (stored via vault.storeCredential)
      const token = credential.oauthAccessToken;

      if (!token) {
        console.log('[HuggingFace Auth] No OAuth token in credential');
        // Return basic info from stored data
        const data = credential.data as { username?: string; fullName?: string; avatarUrl?: string; canWrite?: boolean; isPro?: boolean };
        res.json({
          connected: true,
          username: data.username || credential.connectionName,
          fullName: data.fullName,
          avatarUrl: data.avatarUrl,
          canWrite: data.canWrite,
          isPro: data.isPro,
          connectedAt: credential.lastValidatedAt || credential.createdAt,
        });
        return;
      }

      // Re-validate token is still good
      console.log('[HuggingFace Auth] Validating token with HuggingFace...');
      const validation = await validateHuggingFaceToken(token);
      console.log('[HuggingFace Auth] Validation result:', { valid: validation.valid, username: validation.username });

      res.json({
        connected: validation.valid,
        username: validation.username || credential.connectionName,
        fullName: validation.fullName,
        avatarUrl: validation.avatarUrl,
        canWrite: validation.canWrite,
        isPro: validation.isPro,
        connectedAt: credential.lastValidatedAt || credential.createdAt,
      });
    } catch (vaultError) {
      console.error('[HuggingFace Auth] Vault error:', vaultError);
      res.json({ connected: false, error: 'Failed to retrieve credentials' });
    }
  } catch (error) {
    console.error('[HuggingFace Auth] Status check error:', error);
    res.status(500).json({ error: 'Failed to get status', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/huggingface/disconnect
 * Remove HuggingFace connection for the user
 */
router.post('/disconnect', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Soft delete by setting isActive to false
    await db.update(userCredentials)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(and(
        eq(userCredentials.userId, userId),
        eq(userCredentials.integrationId, 'huggingface')
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('[HuggingFace Auth] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * GET /api/huggingface/token
 * Get the decrypted HuggingFace token (for internal use during training/upload)
 * Uses credential vault for proper decryption - returns oauthAccessToken
 */
router.get('/token', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // First, try the credential vault (preferred method with oauthAccessToken)
    const credential = await getVault().getCredential(userId, 'huggingface');

    if (credential && credential.oauthAccessToken) {
      res.json({
        token: credential.oauthAccessToken,
        username: credential.connectionName || credential.data?.username,
        isPro: credential.data?.isPro,
        canWrite: credential.data?.canWrite,
      });
      return;
    }

    // Fallback: Try legacy method with encryptedData for backwards compatibility
    const credentials = await db.select()
      .from(userCredentials)
      .where(and(
        eq(userCredentials.userId, userId),
        eq(userCredentials.integrationId, 'huggingface'),
        eq(userCredentials.isActive, true)
      ))
      .limit(1);

    if (credentials.length === 0) {
      res.status(404).json({ error: 'HuggingFace not connected' });
      return;
    }

    const cred = credentials[0];

    if (!cred.encryptedData || !cred.iv || !cred.authTag) {
      res.status(500).json({ error: 'Invalid credential data' });
      return;
    }

    // Try legacy decryption
    try {
      const token = decryptToken(cred.encryptedData, cred.iv, cred.authTag);
      res.json({
        token,
        username: cred.connectionName,
      });
    } catch (decryptError) {
      console.error('[HuggingFace Auth] Legacy decryption failed:', decryptError);
      res.status(500).json({ error: 'Token decryption failed - please reconnect your HuggingFace account' });
    }
  } catch (error) {
    console.error('[HuggingFace Auth] Token retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve token' });
  }
});

export default router;
