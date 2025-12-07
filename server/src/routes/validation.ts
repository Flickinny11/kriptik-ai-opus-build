/**
 * Pre-Deployment Validation API Routes
 *
 * F047: Platform-aware building and deployment validation
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createPreFlightValidator, type DeploymentPlatform } from '../services/validation/index.js';

const router = Router();
const validator = createPreFlightValidator();

/**
 * POST /api/validation/validate
 * Run full validation for a project against a deployment platform
 */
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { projectId, platform, strictMode, ignoredChecks } = req.body;

    if (!projectId || !platform) {
      return res.status(400).json({
        success: false,
        error: 'projectId and platform are required'
      });
    }

    const report = await validator.validate(projectId, platform as DeploymentPlatform, {
      strictMode,
      ignoredChecks
    });

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate project'
    });
  }
});

/**
 * POST /api/validation/quick-check
 * Run quick validation (critical checks only)
 */
router.post('/quick-check', authMiddleware, async (req, res) => {
  try {
    const { projectId, platform } = req.body;

    if (!projectId || !platform) {
      return res.status(400).json({
        success: false,
        error: 'projectId and platform are required'
      });
    }

    const result = await validator.quickCheck(projectId, platform as DeploymentPlatform);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Quick check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run quick check'
    });
  }
});

/**
 * GET /api/validation/platforms
 * Get available deployment platforms
 */
router.get('/platforms', authMiddleware, async (_req, res) => {
  try {
    const platforms = validator.getAvailablePlatforms();

    res.json({
      success: true,
      platforms
    });
  } catch (error) {
    console.error('Error getting platforms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platforms'
    });
  }
});

/**
 * GET /api/validation/constraints/:platform
 * Get available constraints for a platform
 */
router.get('/constraints/:platform', authMiddleware, async (req, res) => {
  try {
    const { platform } = req.params;
    const constraints = validator.getConstraintsForPlatform(platform as DeploymentPlatform);

    res.json({
      success: true,
      constraints
    });
  } catch (error) {
    console.error('Error getting constraints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get constraints'
    });
  }
});

export default router;

