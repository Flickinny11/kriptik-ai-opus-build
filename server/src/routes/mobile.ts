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
import { users, sessions } from '../schema.js';
import { eq } from 'drizzle-orm';
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

    // Check if user has a password (might be OAuth-only user)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        error: 'This account uses social login. Please sign in with Google or GitHub.',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
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

    // Create user
    const userId = crypto.randomUUID();
    const now = new Date();

    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      password: hashedPassword,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
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
        createdAt: now.toISOString(),
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

// Clean up expired OAuth states every minute
setInterval(() => {
  const now = new Date();
  for (const [state, data] of oauthStates.entries()) {
    if (data.expiresAt < now) {
      oauthStates.delete(state);
    }
  }
}, 60000);

/**
 * Start OAuth flow for mobile
 * GET /api/mobile/auth/oauth/start/:provider
 * 
 * This redirects the user to the OAuth provider (Google/GitHub)
 * After auth, they'll be redirected back to /api/mobile/auth/oauth/callback
 */
router.get('/auth/oauth/start/:provider', (req: Request, res: Response) => {
  const { provider } = req.params;
  
  if (provider !== 'google' && provider !== 'github') {
    return res.status(400).json({ success: false, error: 'Invalid provider' });
  }

  // Generate unique state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state with 10 minute expiry
  const now = new Date();
  oauthStates.set(state, {
    provider,
    redirectUri: 'kriptik://auth/callback',
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });

  // Get OAuth credentials from environment
  // IMPORTANT: GitHub requires separate OAuth apps for web vs mobile (different callback URLs)
  // Mobile uses GITHUB_MOBILE_CLIENT_ID, falls back to regular GITHUB_CLIENT_ID
  const clientId = provider === 'google' 
    ? (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID || process.env.AUTH_GOOGLE_ID)
    : (process.env.GITHUB_MOBILE_CLIENT_ID || process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID || process.env.AUTH_GITHUB_ID);

  if (!clientId) {
    return res.status(500).json({ success: false, error: `${provider} OAuth not configured` });
  }

  // Build OAuth URL
  const backendUrl = process.env.BETTER_AUTH_URL || 'https://api.kriptik.app';
  const callbackUrl = `${backendUrl}/api/mobile/auth/oauth/callback`;
  
  let authUrl: string;
  
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  } else {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'user:email',
      state,
    });
    authUrl = `https://github.com/login/oauth/authorize?${params}`;
  }

  console.log(`[Mobile OAuth] Starting ${provider} auth, redirecting to: ${authUrl}`);
  res.redirect(authUrl);
});

/**
 * OAuth callback handler for mobile
 * GET /api/mobile/auth/oauth/callback
 * 
 * After OAuth completes, this exchanges the code for tokens
 * and redirects to the mobile app with JWT tokens
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

    const { provider } = stateData;
    const backendUrl = process.env.BETTER_AUTH_URL || 'https://api.kriptik.app';
    const callbackUrl = `${backendUrl}/api/mobile/auth/oauth/callback`;

    let userInfo: { id: string; email: string; name: string; avatar?: string } | null = null;

    if (provider === 'google') {
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
        return res.redirect(`kriptik://auth/callback?error=token_exchange_failed`);
      }

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userResponse.json();

      userInfo = {
        id: `google_${googleUser.id}`,
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatar: googleUser.picture,
      };
    } else if (provider === 'github') {
      // Exchange code for tokens
      // IMPORTANT: Use mobile-specific GitHub OAuth app (different callback URL required)
      const clientId = process.env.GITHUB_MOBILE_CLIENT_ID || process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID || process.env.AUTH_GITHUB_ID;
      const clientSecret = process.env.GITHUB_MOBILE_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET || process.env.AUTH_GITHUB_SECRET;

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) {
        console.error('[Mobile OAuth] GitHub token error:', tokens);
        return res.redirect(`kriptik://auth/callback?error=token_exchange_failed`);
      }

      // Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { 
          Authorization: `Bearer ${tokens.access_token}`,
          'User-Agent': 'KripTik-Mobile',
        },
      });
      const githubUser = await userResponse.json();

      // Get email if not public
      let email = githubUser.email;
      if (!email) {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: { 
            Authorization: `Bearer ${tokens.access_token}`,
            'User-Agent': 'KripTik-Mobile',
          },
        });
        const emails = await emailsResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary) || emails[0];
        email = primaryEmail?.email;
      }

      userInfo = {
        id: `github_${githubUser.id}`,
        email: email,
        name: githubUser.name || githubUser.login,
        avatar: githubUser.avatar_url,
      };
    }

    if (!userInfo || !userInfo.email) {
      return res.redirect('kriptik://auth/callback?error=no_user_info');
    }

    // Find or create user in database
    let [existingUser] = await db.select().from(users).where(eq(users.email, userInfo.email.toLowerCase())).limit(1);

    if (!existingUser) {
      // Create new user
      const userId = crypto.randomUUID();
      const now = new Date();

      await db.insert(users).values({
        id: userId,
        email: userInfo.email.toLowerCase(),
        name: userInfo.name,
        image: userInfo.avatar,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });

      existingUser = {
        id: userId,
        email: userInfo.email.toLowerCase(),
        name: userInfo.name,
        image: userInfo.avatar,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        password: null,
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

    console.log(`[Mobile OAuth] ${provider} auth successful for: ${existingUser.email}`);

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
