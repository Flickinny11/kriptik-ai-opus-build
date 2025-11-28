/**
 * Hosting API Routes
 *
 * Managed hosting with Cloudflare Pages and Vercel,
 * plus IONOS domain integration.
 */

import { Router, Request, Response } from 'express';
import { hostingOrchestrator } from '../services/hosting/hosting-orchestrator.js';
import { domainManager } from '../services/domains/domain-manager.js';
import { db } from '../db.js';
import { hostedDeployments, domains, projects } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
});

// =============================================================================
// PROJECT ANALYSIS
// =============================================================================

/**
 * POST /api/hosting/analyze/:projectId
 * Analyze project to determine hosting recommendation
 */
router.post('/analyze/:projectId', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId } = req.params;

        // Verify ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(and(
                eq(projects.id, projectId),
                eq(projects.ownerId, userId)
            ))
            .limit(1);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const analysis = await hostingOrchestrator.analyzeProject(projectId);

        res.json({
            appType: analysis.appType,
            framework: analysis.framework,
            recommendedProvider: analysis.recommendedProvider,
            hasApiRoutes: analysis.hasApiRoutes,
            hasServerComponents: analysis.hasServerComponents,
            providerInfo: {
                cloudflare: {
                    name: 'Cloudflare Pages',
                    features: ['Unlimited bandwidth', 'Global CDN', 'Automatic SSL'],
                    bestFor: 'Static sites, SPAs',
                    cost: 'Free',
                },
                vercel: {
                    name: 'Vercel',
                    features: ['Server-side rendering', 'API routes', 'Edge functions'],
                    bestFor: 'Full-stack apps, Next.js',
                    cost: 'Included in plan',
                },
            },
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze project' });
    }
});

// =============================================================================
// DEPLOYMENT
// =============================================================================

/**
 * POST /api/hosting/deploy
 * Deploy project to managed hosting
 */
router.post('/deploy', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId, subdomain, customDomain, environmentVariables } = req.body;

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID required' });
        }

        // Verify ownership
        const [project] = await db
            .select()
            .from(projects)
            .where(and(
                eq(projects.id, projectId),
                eq(projects.ownerId, userId)
            ))
            .limit(1);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // If using subdomain, validate and reserve it
        let finalSubdomain: string | undefined;
        if (subdomain) {
            finalSubdomain = await domainManager.reserveSubdomain(projectId, userId, subdomain);
        }

        const result = await hostingOrchestrator.deploy({
            projectId,
            userId,
            subdomain: finalSubdomain,
            customDomain,
            environmentVariables,
        });

        res.json({
            success: true,
            deployment: {
                id: result.hostedDeploymentId,
                deploymentId: result.deploymentId,
                provider: result.provider,
                url: result.providerUrl,
                customDomain: result.customDomain,
                subdomain: result.subdomain ? `https://${result.subdomain}` : undefined,
                appType: result.appType,
            },
        });
    } catch (error) {
        console.error('Deployment error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Deployment failed',
        });
    }
});

/**
 * POST /api/hosting/redeploy/:deploymentId
 * Redeploy an existing hosted app
 */
router.post('/redeploy/:deploymentId', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { deploymentId } = req.params;

        // Verify ownership
        const [deployment] = await db
            .select()
            .from(hostedDeployments)
            .where(and(
                eq(hostedDeployments.id, deploymentId),
                eq(hostedDeployments.userId, userId)
            ))
            .limit(1);

        if (!deployment) {
            return res.status(404).json({ error: 'Deployment not found' });
        }

        const result = await hostingOrchestrator.redeploy(deploymentId);

        res.json({
            success: true,
            deployment: {
                id: result.hostedDeploymentId,
                url: result.providerUrl,
                customDomain: result.customDomain,
            },
        });
    } catch (error) {
        console.error('Redeploy error:', error);
        res.status(500).json({ error: 'Redeployment failed' });
    }
});

/**
 * GET /api/hosting/deployments
 * List user's hosted deployments
 */
router.get('/deployments', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const deployments = await db
            .select()
            .from(hostedDeployments)
            .where(eq(hostedDeployments.userId, userId));

        res.json({ deployments });
    } catch (error) {
        console.error('List deployments error:', error);
        res.status(500).json({ error: 'Failed to list deployments' });
    }
});

/**
 * GET /api/hosting/deployments/:projectId
 * Get deployment for a specific project
 */
router.get('/deployments/:projectId', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId } = req.params;

        const [deployment] = await db
            .select()
            .from(hostedDeployments)
            .where(and(
                eq(hostedDeployments.projectId, projectId),
                eq(hostedDeployments.userId, userId)
            ))
            .limit(1);

        if (!deployment) {
            return res.json({ deployment: null });
        }

        res.json({ deployment });
    } catch (error) {
        console.error('Get deployment error:', error);
        res.status(500).json({ error: 'Failed to get deployment' });
    }
});

/**
 * GET /api/hosting/status/:deploymentId
 * Get deployment status and logs
 */
router.get('/status/:deploymentId', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { deploymentId } = req.params;

        // Verify ownership
        const [deployment] = await db
            .select()
            .from(hostedDeployments)
            .where(and(
                eq(hostedDeployments.id, deploymentId),
                eq(hostedDeployments.userId, userId)
            ))
            .limit(1);

        if (!deployment) {
            return res.status(404).json({ error: 'Deployment not found' });
        }

        const status = await hostingOrchestrator.getDeploymentStatus(deploymentId);
        const logs = await hostingOrchestrator.getDeploymentLogs(deploymentId);

        res.json({
            ...status,
            logs,
            deployment,
        });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ error: 'Failed to get deployment status' });
    }
});

// =============================================================================
// DOMAINS
// =============================================================================

/**
 * GET /api/hosting/domains/search
 * Search for available domains
 */
router.get('/domains/search', async (req: Request, res: Response) => {
    try {
        const { q, tlds } = req.query;

        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Search query required' });
        }

        const tldList = tlds ? (tlds as string).split(',') : undefined;
        const results = await domainManager.searchDomains(q, tldList);

        res.json({ results });
    } catch (error) {
        console.error('Domain search error:', error);
        res.status(500).json({ error: 'Domain search failed' });
    }
});

/**
 * POST /api/hosting/domains/checkout
 * Create Stripe checkout for domain purchase
 */
router.post('/domains/checkout', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId, domain, priceInCents, successUrl, cancelUrl } = req.body;

        if (!projectId || !domain || !priceInCents) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://kriptik-ai-opus-build.vercel.app';

        const checkout = await domainManager.createDomainCheckout(
            userId,
            projectId,
            domain,
            priceInCents,
            successUrl || `${frontendUrl}/dashboard?domain_success=true`,
            cancelUrl || `${frontendUrl}/dashboard?domain_cancelled=true`
        );

        res.json(checkout);
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout' });
    }
});

/**
 * GET /api/hosting/domains
 * List user's domains
 */
router.get('/domains', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userDomains = await domainManager.getUserDomains(userId);
        res.json({ domains: userDomains });
    } catch (error) {
        console.error('List domains error:', error);
        res.status(500).json({ error: 'Failed to list domains' });
    }
});

/**
 * POST /api/hosting/domains/:domainId/connect
 * Connect domain to a deployment
 */
router.post('/domains/:domainId/connect', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { domainId } = req.params;
        const { deploymentId } = req.body;

        // Verify ownership
        const [domain] = await db
            .select()
            .from(domains)
            .where(and(
                eq(domains.id, domainId),
                eq(domains.userId, userId)
            ))
            .limit(1);

        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }

        await domainManager.connectDomainToDeployment(domainId, deploymentId);

        res.json({
            success: true,
            message: 'Domain connected. DNS may take up to 48 hours to propagate.',
        });
    } catch (error) {
        console.error('Connect domain error:', error);
        res.status(500).json({ error: 'Failed to connect domain' });
    }
});

/**
 * POST /api/hosting/domains/:domainId/transfer
 * Get transfer auth code (no lock-in)
 */
router.post('/domains/:domainId/transfer', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { domainId } = req.params;
        const authCode = await domainManager.getTransferCode(domainId, userId);

        res.json({
            authCode,
            message: 'Use this auth code to transfer your domain to another registrar.',
            instructions: [
                '1. Go to your new registrar and start a domain transfer',
                '2. Enter this auth code when prompted',
                '3. The transfer typically takes 5-7 days',
                '4. Your domain will continue working during the transfer',
            ],
        });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Failed to get transfer code' });
    }
});

// =============================================================================
// SUBDOMAINS
// =============================================================================

/**
 * GET /api/hosting/subdomain/check
 * Check if subdomain is available
 */
router.get('/subdomain/check', async (req: Request, res: Response) => {
    try {
        const { subdomain } = req.query;

        if (!subdomain || typeof subdomain !== 'string') {
            return res.status(400).json({ error: 'Subdomain required' });
        }

        const available = await domainManager.isSubdomainAvailable(subdomain);

        res.json({
            subdomain,
            available,
            fullDomain: `${subdomain}.kriptik.app`,
        });
    } catch (error) {
        console.error('Subdomain check error:', error);
        res.status(500).json({ error: 'Failed to check subdomain' });
    }
});

// =============================================================================
// WEBHOOKS
// =============================================================================

/**
 * POST /api/hosting/webhooks/stripe
 * Handle Stripe webhooks for domain purchases
 */
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
    try {
        const sig = req.headers['stripe-signature'] as string;

        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            console.warn('STRIPE_WEBHOOK_SECRET not configured');
            return res.status(400).json({ error: 'Webhook not configured' });
        }

        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            if (session.metadata?.type === 'domain_purchase') {
                await domainManager.completeDomainPurchase(session.id);
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: 'Webhook failed' });
    }
});

export default router;

