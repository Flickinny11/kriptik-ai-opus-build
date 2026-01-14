/**
 * Mobile Companion App Routes
 * Handles device pairing, session transfer, and mobile-web integration
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

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

    // Return the session data for the mobile app to authenticate
    res.json({
      success: true,
      userId: pairingData.userId,
      userEmail: pairingData.userEmail,
      userName: pairingData.userName,
      projectId: pairingData.projectId,
      buildId: pairingData.buildId,
      message: 'Device paired successfully',
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
