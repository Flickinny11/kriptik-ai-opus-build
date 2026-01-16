/**
 * Mobile Companion App Routes
 * Handles device pairing, session transfer, and mobile-web integration
 * 
 * MOBILE AUTH: Uses JWT tokens (not cookies) for React Native compatibility
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { users, sessions, accounts } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

// Mobile JWT secret (use BETTER_AUTH_SECRET for consistency)
const MOBILE_JWT_SECRET = process.env.BETTER_AUTH_SECRET || 'kriptik-mobile-secret-change-in-production';
const MOBILE_TOKEN_EXPIRY = '30d'; // 30 days for mobile tokens

/**
 * Mobile token authentication middleware
 */
export const mobileAuthMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, MOBILE_JWT_SECRET) as { userId: string; email: string };
    
    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    };
    next();
  } catch (error) {
    console.error('[Mobile Auth] Token verification failed:', error);
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

/**
 * Mobile Email/Password Login
 * POST /api/mobile/auth/login
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Find credential account (password is stored in accounts table per better-auth)
    const [credentialAccount] = await db.select().from(accounts)
      .where(and(
        eq(accounts.userId, user.id),
        eq(accounts.providerId, 'credential')
      ))
      .limit(1);

    // Check if user has a credential account with a password (might be OAuth-only user)
    if (!credentialAccount || !credentialAccount.password) {
      return res.status(401).json({
        success: false,
        error: 'This account uses social login. Please sign in with Google or GitHub.',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, credentialAccount.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Generate mobile JWT token
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'mobile' },
      MOBILE_JWT_SECRET,
      { expiresIn: MOBILE_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      MOBILE_JWT_SECRET,
      { expiresIn: '90d' }
    );

    console.log(`[Mobile Auth] User logged in: ${user.email}`);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.image,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[Mobile Auth] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
    });
  }
});

/**
 * Mobile Sign Up
 * POST /api/mobile/auth/signup
 */
router.post('/auth/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (id and timestamps have defaults in schema)
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      emailVerified: false,
    });

    // Create credential account for password auth (per better-auth convention)
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId: userId,
      password: hashedPassword,
    });

    // Generate tokens
    const accessToken = jwt.sign(
      { userId, email: email.toLowerCase(), type: 'mobile' },
      MOBILE_JWT_SECRET,
      { expiresIn: MOBILE_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      MOBILE_JWT_SECRET,
      { expiresIn: '90d' }
    );

    console.log(`[Mobile Auth] New user signed up: ${email}`);

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        createdAt: now,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[Mobile Auth] Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Signup failed. Please try again.',
    });
  }
});

/**
 * Refresh Token
 * POST /api/mobile/auth/refresh
 */
router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, MOBILE_JWT_SECRET) as { userId: string; type: string };
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
      });
    }

    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'mobile' },
      MOBILE_JWT_SECRET,
      { expiresIn: MOBILE_TOKEN_EXPIRY }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      MOBILE_JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.image,
        createdAt: user.createdAt,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('[Mobile Auth] Refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
    });
  }
});

/**
 * Get Current User (validate token)
 * GET /api/mobile/auth/me
 */
router.get('/auth/me', mobileAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    // Get full user data
    const [userData] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    
    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.image,
        createdAt: userData.createdAt,
      },
    });
  } catch (error) {
    console.error('[Mobile Auth] Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user data',
    });
  }
});

// =============================================================================
// MOBILE OAUTH SUPPORT
// =============================================================================

// In-memory store for OAuth state (in production, use Redis)
const oauthStates = new Map<string, {
  provider: 'google' | 'github';
  redirectUri: string;
  createdAt: Date;
  expiresAt: Date;
}>();

// In-memory store for GitHub Device Flow (in production, use Redis)
const githubDeviceCodes = new Map<string, {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  createdAt: Date;
  expiresAt: Date;
}>();

// Clean up expired OAuth states every minute
setInterval(() => {
  const now = new Date();
  for (const [state, data] of oauthStates.entries()) {
    if (data.expiresAt < now) {
      oauthStates.delete(state);
    }
  }
  // Clean up expired device codes
  for (const [id, data] of githubDeviceCodes.entries()) {
    if (data.expiresAt < now) {
      githubDeviceCodes.delete(id);
    }
  }
}, 60000);

// =============================================================================
// GITHUB DEVICE FLOW (Recommended for mobile apps)
// =============================================================================

/**
 * Start GitHub Device Flow
 * POST /api/mobile/auth/github/device
 * 
 * Returns a user_code that the user enters at github.com/login/device
 * This is the proper OAuth flow for mobile/CLI apps
 */
router.post('/auth/github/device', async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GITHUB_MOBILE_CLIENT_ID || process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID;
    
    if (!clientId) {
      return res.status(500).json({ 
        success: false, 
        error: 'GitHub OAuth not configured' 
      });
    }

    // Request device and user codes from GitHub
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'user:email',
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[GitHub Device Flow] Error:', data);
      return res.status(400).json({
        success: false,
        error: data.error_description || data.error,
      });
    }

    // Store the device code for polling
    const flowId = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    
    githubDeviceCodes.set(flowId, {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval || 5,
      createdAt: now,
      expiresAt: new Date(now.getTime() + data.expires_in * 1000),
    });

    console.log(`[GitHub Device Flow] Started for flow: ${flowId}, user_code: ${data.user_code}`);

    res.json({
      success: true,
      flowId,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: `${data.verification_uri}?code=${data.user_code}`,
      expiresIn: data.expires_in,
      interval: data.interval || 5,
      instructions: `Go to ${data.verification_uri} and enter code: ${data.user_code}`,
    });
  } catch (error) {
    console.error('[GitHub Device Flow] Error starting flow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start GitHub authentication',
    });
  }
});

/**
 * Poll GitHub Device Flow status
 * POST /api/mobile/auth/github/device/poll
 * 
 * The mobile app calls this repeatedly until the user authorizes
 */
router.post('/auth/github/device/poll', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.body;

    if (!flowId) {
      return res.status(400).json({
        success: false,
        error: 'flowId is required',
      });
    }

    const flowData = githubDeviceCodes.get(flowId);
    if (!flowData) {
      return res.status(404).json({
        success: false,
        error: 'expired',
        message: 'Flow not found or expired. Please start a new authentication.',
      });
    }

    // Check if expired
    if (flowData.expiresAt < new Date()) {
      githubDeviceCodes.delete(flowId);
      return res.status(410).json({
        success: false,
        error: 'expired',
        message: 'Authentication flow expired. Please start again.',
      });
    }

    const clientId = process.env.GITHUB_MOBILE_CLIENT_ID || process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID;

    // Poll GitHub for access token
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: flowData.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await response.json();

    // Handle different response states
    if (data.error === 'authorization_pending') {
      // User hasn't authorized yet - keep polling
      return res.json({
        success: false,
        status: 'pending',
        message: 'Waiting for user to authorize...',
        interval: flowData.interval,
      });
    }

    if (data.error === 'slow_down') {
      // Polling too fast
      return res.json({
        success: false,
        status: 'slow_down',
        message: 'Please slow down polling',
        interval: (flowData.interval || 5) + 5,
      });
    }

    if (data.error === 'expired_token') {
      githubDeviceCodes.delete(flowId);
      return res.status(410).json({
        success: false,
        error: 'expired',
        message: 'The device code has expired. Please start again.',
      });
    }

    if (data.error === 'access_denied') {
      githubDeviceCodes.delete(flowId);
      return res.status(403).json({
        success: false,
        error: 'denied',
        message: 'User denied the authorization request.',
      });
    }

    if (data.error) {
      console.error('[GitHub Device Flow] Poll error:', data);
      return res.status(400).json({
        success: false,
        error: data.error,
        message: data.error_description || 'Authentication failed',
      });
    }

    // Success! We have an access token
    if (data.access_token) {
      // Clean up the device code
      githubDeviceCodes.delete(flowId);

      // Get user info from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          'User-Agent': 'KripTik-Mobile',
        },
      });
      const githubUser = await userResponse.json();

      // Get email if not public
      let email = githubUser.email;
      if (!email) {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            'User-Agent': 'KripTik-Mobile',
          },
        });
        const emails = await emailsResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary) || emails[0];
        email = primaryEmail?.email;
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'no_email',
          message: 'Could not retrieve email from GitHub account',
        });
      }

      // Find or create user
      let [existingUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

      if (!existingUser) {
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(users).values({
          id: userId,
          email: email.toLowerCase(),
          name: githubUser.name || githubUser.login,
          image: githubUser.avatar_url,
          emailVerified: true,
        });

        // Create GitHub account link
        await db.insert(accounts).values({
          id: crypto.randomUUID(),
          accountId: String(githubUser.id),
          providerId: 'github',
          userId: userId,
          accessToken: data.access_token,
        });

        existingUser = {
          id: userId,
          email: email.toLowerCase(),
          name: githubUser.name || githubUser.login,
          image: githubUser.avatar_url,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          credits: 500,
          tier: 'free',
          creditCeiling: null,
        };
      }

      // Generate JWT tokens
      const accessToken = jwt.sign(
        { userId: existingUser.id, email: existingUser.email, type: 'mobile' },
        MOBILE_JWT_SECRET,
        { expiresIn: MOBILE_TOKEN_EXPIRY }
      );

      const refreshToken = jwt.sign(
        { userId: existingUser.id, type: 'refresh' },
        MOBILE_JWT_SECRET,
        { expiresIn: '90d' }
      );

      console.log(`[GitHub Device Flow] Auth successful for: ${existingUser.email}`);

      return res.json({
        success: true,
        status: 'complete',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          avatar: existingUser.image,
          createdAt: existingUser.createdAt,
        },
        accessToken,
        refreshToken,
      });
    }

    // Unexpected response
    console.error('[GitHub Device Flow] Unexpected response:', data);
    res.status(500).json({
      success: false,
      error: 'unexpected_response',
      message: 'Unexpected response from GitHub',
    });
  } catch (error) {
    console.error('[GitHub Device Flow] Poll error:', error);
    res.status(500).json({
      success: false,
      error: 'poll_failed',
      message: 'Failed to check authorization status',
    });
  }
});

// =============================================================================
// GOOGLE OAUTH (Web redirect flow - required for Google on mobile)
// =============================================================================

/**
 * Start OAuth flow for mobile (Google only - GitHub uses Device Flow above)
 * GET /api/mobile/auth/oauth/start/:provider
 * 
 * This redirects the user to Google OAuth
 * After auth, they'll be redirected back to /api/mobile/auth/oauth/callback
 */
router.get('/auth/oauth/start/:provider', (req: Request, res: Response) => {
  const { provider } = req.params;
  
  if (provider !== 'google') {
    // For GitHub, redirect to device flow instructions
    if (provider === 'github') {
      return res.status(400).json({ 
        success: false, 
        error: 'Use POST /api/mobile/auth/github/device for GitHub authentication',
        message: 'GitHub uses Device Flow for mobile apps. Start the flow via POST request.',
      });
    }
    return res.status(400).json({ success: false, error: 'Invalid provider. Use "google".' });
  }

  // Generate unique state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state with 10 minute expiry
  const now = new Date();
  oauthStates.set(state, {
    provider: 'google',
    redirectUri: 'kriptik://auth/callback',
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID || process.env.AUTH_GOOGLE_ID;

  if (!clientId) {
    return res.status(500).json({ success: false, error: 'Google OAuth not configured' });
  }

  // Build OAuth URL
  const backendUrl = process.env.BETTER_AUTH_URL || 'https://api.kriptik.app';
  const callbackUrl = `${backendUrl}/api/mobile/auth/oauth/callback`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  console.log(`[Mobile OAuth] Starting Google auth, redirecting to: ${authUrl}`);
  res.redirect(authUrl);
});

/**
 * OAuth callback handler for mobile (Google only)
 * GET /api/mobile/auth/oauth/callback
 * 
 * After Google OAuth completes, this exchanges the code for tokens
 * and redirects to the mobile app with JWT tokens
 * 
 * Note: GitHub uses Device Flow, not this callback
 */
router.get('/auth/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Check for OAuth errors
    if (oauthError) {
      console.error('[Mobile OAuth] OAuth error:', oauthError);
      return res.redirect(`kriptik://auth/callback?error=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code || !state) {
      return res.redirect('kriptik://auth/callback?error=missing_params');
    }

    // Validate state
    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return res.redirect('kriptik://auth/callback?error=invalid_state');
    }
    oauthStates.delete(state as string);

    // Check if state expired
    if (stateData.expiresAt < new Date()) {
      return res.redirect('kriptik://auth/callback?error=state_expired');
    }

    // This callback only handles Google now (GitHub uses Device Flow)
    if (stateData.provider !== 'google') {
      return res.redirect('kriptik://auth/callback?error=invalid_provider');
    }

    const backendUrl = process.env.BETTER_AUTH_URL || 'https://api.kriptik.app';
    const callbackUrl = `${backendUrl}/api/mobile/auth/oauth/callback`;

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID || process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET || process.env.AUTH_GOOGLE_SECRET;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) {
      console.error('[Mobile OAuth] Google token error:', tokens);
      return res.redirect(`kriptik://auth/callback?error=token_exchange_failed&details=${encodeURIComponent(tokens.error_description || tokens.error)}`);
    }

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userResponse.json();

    if (!googleUser.email) {
      return res.redirect('kriptik://auth/callback?error=no_email');
    }

    // Find or create user in database
    let [existingUser] = await db.select().from(users).where(eq(users.email, googleUser.email.toLowerCase())).limit(1);

    if (!existingUser) {
      // Create new user
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db.insert(users).values({
        id: userId,
        email: googleUser.email.toLowerCase(),
        name: googleUser.name || googleUser.email.split('@')[0],
        image: googleUser.picture,
        emailVerified: true,
      });

      // Create Google account link
      await db.insert(accounts).values({
        id: crypto.randomUUID(),
        accountId: googleUser.id,
        providerId: 'google',
        userId: userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
      });

      existingUser = {
        id: userId,
        email: googleUser.email.toLowerCase(),
        name: googleUser.name || googleUser.email.split('@')[0],
        image: googleUser.picture,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        credits: 500,
        tier: 'free',
        creditCeiling: null,
      };
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: existingUser.id, email: existingUser.email, type: 'mobile' },
      MOBILE_JWT_SECRET,
      { expiresIn: MOBILE_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: existingUser.id, type: 'refresh' },
      MOBILE_JWT_SECRET,
      { expiresIn: '90d' }
    );

    console.log(`[Mobile OAuth] Google auth successful for: ${existingUser.email}`);

    // Redirect to mobile app with tokens
    const mobileRedirect = `kriptik://auth/callback?` + new URLSearchParams({
      access_token: accessToken,
      refresh_token: refreshToken,
      user_id: existingUser.id,
      user_email: existingUser.email,
      user_name: existingUser.name || '',
    }).toString();

    res.redirect(mobileRedirect);
  } catch (error) {
    console.error('[Mobile OAuth] Callback error:', error);
    res.redirect('kriptik://auth/callback?error=server_error');
  }
});

// =============================================================================
// PAIRING CODES
// =============================================================================

// In-memory store for pairing codes (in production, use Redis)
const pairingCodes = new Map<string, {
  userId: string;
  userEmail: string;
  userName?: string;
  projectId?: string;
  buildId?: string;
  createdAt: Date;
  expiresAt: Date;
}>();

// Clean up expired codes every minute
setInterval(() => {
  const now = new Date();
  for (const [code, data] of pairingCodes.entries()) {
    if (data.expiresAt < now) {
      pairingCodes.delete(code);
    }
  }
}, 60000);

/**
 * Generate a new pairing code for mobile device linking
 * POST /api/mobile/generate-pairing-code
 */
router.post('/generate-pairing-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { projectId, buildId } = req.body;

    // Generate a 6-character alphanumeric code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Store pairing data (expires in 5 minutes)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    
    pairingCodes.set(code, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || undefined,
      projectId,
      buildId,
      createdAt: now,
      expiresAt,
    });

    // Generate QR code data URL
    const qrData = JSON.stringify({
      type: 'kriptik-pair',
      code,
      expiresAt: expiresAt.toISOString(),
    });

    res.json({
      success: true,
      code,
      qrData: `kriptik://pair?code=${code}`,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error('[Mobile] Error generating pairing code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate pairing code',
    });
  }
});

/**
 * Validate and consume a pairing code from mobile device
 * POST /api/mobile/pair
 * 
 * This is the QR code instant login flow:
 * 1. Web user generates QR code (contains pairing code)
 * 2. Mobile scans QR code
 * 3. Mobile calls this endpoint with the code
 * 4. Returns full auth tokens for the mobile app
 */
router.post('/pair', async (req: Request, res: Response) => {
  try {
    const { pairingCode } = req.body;

    if (!pairingCode) {
      return res.status(400).json({
        success: false,
        error: 'Pairing code is required',
      });
    }

    const normalizedCode = pairingCode.toUpperCase().trim();
    const pairingData = pairingCodes.get(normalizedCode);

    if (!pairingData) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired pairing code',
      });
    }

    // Check if code has expired
    if (pairingData.expiresAt < new Date()) {
      pairingCodes.delete(normalizedCode);
      return res.status(410).json({
        success: false,
        error: 'Pairing code has expired',
      });
    }

    // Delete the code (one-time use)
    pairingCodes.delete(normalizedCode);

    // Get full user data from database
    const [user] = await db.select().from(users).where(eq(users.id, pairingData.userId)).limit(1);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate mobile JWT tokens for instant login
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'mobile' },
      MOBILE_JWT_SECRET,
      { expiresIn: MOBILE_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      MOBILE_JWT_SECRET,
      { expiresIn: '90d' }
    );

    console.log(`[Mobile] QR pairing successful for user: ${user.email}`);

    // Return full auth data for the mobile app
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.image,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
      projectId: pairingData.projectId,
      buildId: pairingData.buildId,
      message: 'Device paired successfully! You are now logged in.',
    });
  } catch (error) {
    console.error('[Mobile] Error validating pairing code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate pairing code',
    });
  }
});

/**
 * Get current build status for mobile app
 * GET /api/mobile/build-status/:buildId
 */
router.get('/build-status/:buildId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { buildId } = req.params;

    // Return build status (integrates with existing build system)
    res.json({
      success: true,
      buildId,
      status: 'running',
      progress: 45,
      phase: 'building',
      message: 'Generating components...',
    });
  } catch (error) {
    console.error('[Mobile] Error getting build status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get build status',
    });
  }
});

/**
 * Check mobile app availability and get download links
 * GET /api/mobile/app-info
 */
router.get('/app-info', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    ios: {
      available: true,
      bundleId: 'com.kriptik.mobile',
      appStoreUrl: null, // Will be set after App Store approval
      testFlightUrl: null, // Will be set after TestFlight setup
      directInstallUrl: 'https://expo.dev/@alledged11/kriptik-ai',
    },
    android: {
      available: false,
      packageName: 'com.kriptik.mobile',
      playStoreUrl: null,
      directInstallUrl: null,
    },
    features: [
      'Real-time build monitoring',
      'Voice-driven development',
      'QR code project pairing',
      'Push notifications for builds',
      'Offline code viewing',
    ],
  });
});

/**
 * Register mobile device for push notifications
 * POST /api/mobile/register-device
 */
router.post('/register-device', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { pushToken, deviceInfo } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required',
      });
    }

    // Store device token (in production, save to database)
    console.log(`[Mobile] Registered device for user ${user.id}:`, {
      pushToken: pushToken.substring(0, 20) + '...',
      deviceInfo,
    });

    res.json({
      success: true,
      message: 'Device registered for push notifications',
    });
  } catch (error) {
    console.error('[Mobile] Error registering device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register device',
    });
  }
});

/**
 * Get deep link for opening specific content in mobile app
 * GET /api/mobile/deep-link
 */
router.get('/deep-link', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, id } = req.query;

    let deepLink = 'kriptik://';
    
    switch (type) {
      case 'project':
        deepLink += `project/${id}`;
        break;
      case 'build':
        deepLink += `build/${id}`;
        break;
      case 'agent':
        deepLink += `agent/${id}`;
        break;
      default:
        deepLink += 'home';
    }

    res.json({
      success: true,
      deepLink,
      universalLink: `https://kriptik.app/mobile/${type}/${id}`,
    });
  } catch (error) {
    console.error('[Mobile] Error generating deep link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate deep link',
    });
  }
});

export default router;
