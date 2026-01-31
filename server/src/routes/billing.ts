/**
 * Billing API Routes
 *
 * Handles subscription management, usage tracking, and payments
 */

import { Router, Request, Response, raw } from 'express';
import Stripe from 'stripe';
import { createStripeBillingService, BILLING_PLANS } from '../services/billing/stripe.js';
import { usageTracker } from '../services/billing/usage.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import {
    getStripeSetupService,
    KRIPTIK_BILLING_CONFIG,
    calculateCreditsForFeature,
} from '../services/billing/stripe-setup.js';
import { getCreditPoolService } from '../services/billing/credit-pool.js';
import { getUsageService } from '../services/billing/usage-service.js';
import { getCreditCeilingService } from '../services/billing/credit-ceiling.js';
import {
    setupOpenSourceStudioProducts,
    getOSSProducts,
    recordTrainingUsage,
    recordFinetuningUsage,
    recordInferenceUsage,
    recordStorageUsage,
    getTrainingPriceEstimate,
    getInferencePriceEstimate,
    getStoragePriceEstimate,
} from '../services/billing/open-source-studio-billing.js';
import { db } from '../db.js';
import { subscriptions, users } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// Initialize Stripe
const getStripe = () => {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        throw new Error('Stripe not configured - STRIPE_SECRET_KEY missing');
    }
    return new Stripe(apiKey);
};

// Stripe service instance
const getStripeService = () => {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        throw new Error('Stripe not configured');
    }
    return createStripeBillingService(apiKey);
};

/**
 * GET /api/billing/credits
 * Get current user's credit balance and tier
 */
router.get('/credits', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;

        // Get user from database
        const userRecords = await db
            .select({
                credits: users.credits,
                tier: users.tier,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (userRecords.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const user = userRecords[0];

        // Get monthly usage from usage service
        let usedThisMonth = 0;
        try {
            const usageService = getUsageService();
            const monthlyUsage = await usageService.getMonthlyUsage(userId);
            usedThisMonth = monthlyUsage.totalCredits || 0;
        } catch {
            // If usage service fails, default to 0
        }

        res.json({
            credits: user.credits || 0,
            tier: user.tier || 'free',
            usedThisMonth,
        });
    } catch (error) {
        console.error('Error fetching credits:', error);
        res.status(500).json({ error: 'Failed to fetch credits' });
    }
});

/**
 * GET /api/billing/plans
 * List available plans
 */
router.get('/plans', async (req: Request, res: Response) => {
    try {
        res.json({ plans: BILLING_PLANS });
    } catch (error) {
        console.error('Error listing plans:', error);
        res.status(500).json({ error: 'Failed to list plans' });
    }
});

/**
 * GET /api/billing/usage
 * Get usage summary for current user
 */
router.get('/usage', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;

        // Get from persistent usage service
        const usageService = getUsageService();
        const monthlyUsage = await usageService.getMonthlyUsage(userId);

        // Also get session-based summary for real-time data
        const sessionSummary = await usageTracker.getUsageSummary(userId);

        res.json({
            usage: sessionSummary,
            monthly: monthlyUsage,
        });
    } catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

/**
 * GET /api/billing/usage/breakdown
 * Get usage breakdown by category
 */
router.get('/usage/breakdown', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;

        const breakdown = await usageTracker.getUsageByCategory(userId);
        res.json({ breakdown });
    } catch (error) {
        console.error('Error fetching usage breakdown:', error);
        res.status(500).json({ error: 'Failed to fetch breakdown' });
    }
});

/**
 * GET /api/billing/usage/history
 * Get usage over time (persistent)
 */
router.get('/usage/history', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;

        const days = parseInt(req.query.days as string) || 30;

        // Get persistent history from database
        const usageService = getUsageService();
        const persistentHistory = await usageService.getDailyHistory(userId, days);

        // Also get session-based history for real-time
        const sessionHistory = await usageTracker.getUsageOverTime(userId, days);

        res.json({
            history: persistentHistory,
            sessionHistory, // Real-time session data
        });
    } catch (error) {
        console.error('Error fetching usage history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * POST /api/billing/estimate
 * Estimate credits for an operation
 */
router.post('/estimate', async (req: Request, res: Response) => {
    try {
        const { type, complexity, hasGPU, modelSize } = req.body;

        const credits = usageTracker.estimateCredits({
            type,
            complexity,
            hasGPU,
            modelSize,
        });

        res.json({ credits });
    } catch (error) {
        console.error('Error estimating credits:', error);
        res.status(500).json({ error: 'Failed to estimate credits' });
    }
});

/**
 * POST /api/billing/checkout
 * Create a checkout session for subscription
 */
router.post('/checkout', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { planId, interval = 'monthly' } = req.body;

        const plan = BILLING_PLANS.find(p => p.id === planId);
        if (!plan) {
            res.status(400).json({ error: 'Invalid plan' });
            return;
        }

        const priceId = interval === 'yearly'
            ? plan.stripePriceIdYearly
            : plan.stripePriceIdMonthly;

        if (!priceId) {
            res.status(400).json({ error: 'Plan not available for purchase' });
            return;
        }

        const stripe = getStripeService();

        // Get or create customer
        const customer = await stripe.createCustomer({
            email: `user-${userId}@example.com`,
            metadata: { userId },
        });

        const session = await stripe.createCheckoutSession({
            customerId: customer.id,
            priceId,
            successUrl: `${process.env.FRONTEND_URL}/dashboard?upgrade=success`,
            cancelUrl: `${process.env.FRONTEND_URL}/dashboard?upgrade=cancelled`,
            trialDays: 7,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout:', error);
        res.status(500).json({ error: 'Failed to create checkout' });
    }
});

/**
 * POST /api/billing/portal
 * Create a billing portal session
 */
router.post('/portal', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const customerId = req.body.customerId;
        if (!customerId) {
            res.status(400).json({ error: 'No subscription found' });
            return;
        }

        const stripe = getStripeService();

        const session = await stripe.createPortalSession({
            customerId,
            returnUrl: `${process.env.FRONTEND_URL}/dashboard`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating portal:', error);
        res.status(500).json({ error: 'Failed to create portal' });
    }
});

/**
 * GET /api/billing/invoices
 * Get user invoices
 */
router.get('/invoices', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const customerId = req.query.customerId as string;
        if (!customerId) {
            res.json({ invoices: [] });
            return;
        }

        const stripe = getStripeService();
        const result = await stripe.getInvoices(customerId);

        res.json({ invoices: result.data });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

/**
 * GET /api/billing/ceiling
 * Get user's credit ceiling status
 */
router.get('/ceiling', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const buildId = req.query.buildId as string | undefined;

        const ceilingService = getCreditCeilingService();
        const status = await ceilingService.getCeilingStatus(userId, buildId);

        res.json(status);
    } catch (error) {
        console.error('Error fetching ceiling status:', error);
        res.status(500).json({ error: 'Failed to fetch ceiling status' });
    }
});

/**
 * POST /api/billing/ceiling
 * Update user's credit ceiling
 *
 * Body:
 * - ceiling: number | null (null for unlimited)
 */
router.post('/ceiling', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { ceiling } = req.body;

        // Validate ceiling
        if (ceiling !== null && (typeof ceiling !== 'number' || ceiling < 0)) {
            res.status(400).json({ error: 'Ceiling must be a positive number or null for unlimited' });
            return;
        }

        const ceilingService = getCreditCeilingService();
        const status = await ceilingService.setCeiling(userId, ceiling);

        res.json({
            success: true,
            status,
            message: ceiling === null
                ? 'Credit ceiling removed (unlimited)'
                : `Credit ceiling set to ${ceiling} credits`,
        });
    } catch (error) {
        console.error('Error updating ceiling:', error);
        res.status(500).json({ error: 'Failed to update ceiling' });
    }
});

/**
 * POST /api/billing/ceiling/check
 * Check if an operation can proceed given current ceiling
 *
 * Body:
 * - estimatedCost: number (credits)
 * - buildId?: string (optional, for better estimation)
 */
router.post('/ceiling/check', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { estimatedCost, buildId } = req.body;

        if (typeof estimatedCost !== 'number' || estimatedCost < 0) {
            res.status(400).json({ error: 'estimatedCost must be a positive number' });
            return;
        }

        const ceilingService = getCreditCeilingService();
        const result = await ceilingService.checkCeiling(userId, estimatedCost, buildId);

        res.json(result);
    } catch (error) {
        console.error('Error checking ceiling:', error);
        res.status(500).json({ error: 'Failed to check ceiling' });
    }
});

/**
 * POST /api/billing/ceiling/adjust
 * Quick adjustment to ceiling (add amount)
 *
 * Body:
 * - amount: number (credits to add, can be negative)
 */
router.post('/ceiling/adjust', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { amount } = req.body;

        if (typeof amount !== 'number') {
            res.status(400).json({ error: 'amount must be a number' });
            return;
        }

        const ceilingService = getCreditCeilingService();
        const status = await ceilingService.adjustCeilingBy(userId, amount);

        res.json({
            success: true,
            status,
            message: `Credit ceiling adjusted by ${amount > 0 ? '+' : ''}${amount} credits`,
        });
    } catch (error) {
        console.error('Error adjusting ceiling:', error);
        res.status(500).json({ error: 'Failed to adjust ceiling' });
    }
});

/**
 * POST /api/billing/ceiling/unlimited
 * Set ceiling to unlimited
 */
router.post('/ceiling/unlimited', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;

        const ceilingService = getCreditCeilingService();
        const status = await ceilingService.setUnlimited(userId);

        res.json({
            success: true,
            status,
            message: 'Credit ceiling set to unlimited',
        });
    } catch (error) {
        console.error('Error setting unlimited ceiling:', error);
        res.status(500).json({ error: 'Failed to set unlimited ceiling' });
    }
});

/**
 * POST /api/billing/ceiling/warning
 * Record that a warning was shown to the user (for analytics)
 *
 * Body:
 * - threshold: number (75, 90, or 100)
 * - buildId?: string
 */
router.post('/ceiling/warning', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { threshold, buildId } = req.body;

        if (typeof threshold !== 'number') {
            res.status(400).json({ error: 'threshold must be a number' });
            return;
        }

        const ceilingService = getCreditCeilingService();
        await ceilingService.recordWarningShown(userId, threshold, buildId);

        res.json({ success: true });
    } catch (error) {
        console.error('Error recording warning:', error);
        res.status(500).json({ error: 'Failed to record warning' });
    }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhooks with proper signature verification
 */
router.post('/webhook', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        res.status(500).json({ error: 'Webhook not configured' });
        return;
    }

    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
    }

    let event: Stripe.Event;

    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        res.status(400).json({ error: 'Invalid signature' });
        return;
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const customerId = session.customer as string;
                const subscriptionId = session.subscription as string;

                // Check if this is a custom top-up
                if (session.metadata?.type === 'custom_topup' && userId) {
                    const credits = parseInt(session.metadata.credits || '0');

                    if (credits > 0) {
                        // Add credits to user account
                        const userRecords = await db
                            .select({ credits: users.credits })
                            .from(users)
                            .where(eq(users.id, userId))
                            .limit(1);

                        const currentCredits = userRecords[0]?.credits || 0;

                        await db.update(users)
                            .set({ credits: currentCredits + credits })
                            .where(eq(users.id, userId));

                        console.log(`Custom top-up: Added ${credits} credits to user ${userId}`);

                        // Record revenue in credit pool
                        const amountCents = session.amount_total || 0;
                        if (amountCents > 0) {
                            const pool = getCreditPoolService();
                            await pool.recordRevenue(amountCents, 'topup', userId, {
                                stripeSessionId: session.id,
                                type: 'custom_topup',
                            });
                        }
                    }
                    break;
                }

                // Check if this is a preset top-up
                if (session.metadata?.topup_id && userId) {
                    const credits = parseInt(session.metadata.credits || '0');

                    if (credits > 0) {
                        const userRecords = await db
                            .select({ credits: users.credits })
                            .from(users)
                            .where(eq(users.id, userId))
                            .limit(1);

                        const currentCredits = userRecords[0]?.credits || 0;

                        await db.update(users)
                            .set({ credits: currentCredits + credits })
                            .where(eq(users.id, userId));

                        console.log(`Top-up: Added ${credits} credits to user ${userId}`);

                        // Record revenue in credit pool
                        const amountCents = session.amount_total || 0;
                        if (amountCents > 0) {
                            const pool = getCreditPoolService();
                            await pool.recordRevenue(amountCents, 'topup', userId, {
                                stripeSessionId: session.id,
                                topupId: session.metadata?.topup_id,
                            });
                        }
                    }
                    break;
                }

                // Otherwise it's a subscription
                if (userId && subscriptionId) {
                    // Determine plan from the price
                    const planCredits: Record<string, number> = {
                        'starter': 300,
                        'builder': 800,
                        'developer': 2000,
                        'pro': 5000,
                    };

                    // Get the line items to determine the plan
                    const stripe = getStripe();
                    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
                    const priceId = lineItems.data[0]?.price?.id;

                    let plan = 'starter';
                    let creditsPerMonth = 300;

                    // Match price ID to plan
                    if (priceId?.includes('builder') || priceId === process.env.STRIPE_PRICE_BUILDER_MONTHLY || priceId === process.env.STRIPE_PRICE_BUILDER_YEARLY) {
                        plan = 'builder';
                        creditsPerMonth = 800;
                    } else if (priceId?.includes('developer') || priceId === process.env.STRIPE_PRICE_DEVELOPER_MONTHLY || priceId === process.env.STRIPE_PRICE_DEVELOPER_YEARLY) {
                        plan = 'developer';
                        creditsPerMonth = 2000;
                    } else if (priceId?.includes('pro') || priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) {
                        plan = 'pro';
                        creditsPerMonth = 5000;
                    }

                    // Update user subscription in database
                    await db.insert(subscriptions).values({
                        userId,
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                        plan,
                        status: 'active',
                        creditsPerMonth,
                    }).onConflictDoUpdate({
                        target: subscriptions.userId,
                        set: {
                            stripeCustomerId: customerId,
                            stripeSubscriptionId: subscriptionId,
                            plan,
                            status: 'active',
                            creditsPerMonth,
                        },
                    });

                    // Also set user's credits to the plan amount
                    await db.update(users)
                        .set({
                            credits: creditsPerMonth,
                            tier: plan,
                        })
                        .where(eq(users.id, userId));

                    console.log(`Subscription created for user ${userId}: ${plan} (${creditsPerMonth} credits/month)`);

                    // Record subscription revenue in credit pool
                    const amountCents = session.amount_total || 0;
                    if (amountCents > 0) {
                        const pool = getCreditPoolService();
                        await pool.recordRevenue(amountCents, 'subscription', userId, {
                            stripeSessionId: session.id,
                            plan,
                            subscriptionId,
                        });
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Update subscription status
                const status = subscription.status === 'active' ? 'active' :
                              subscription.status === 'past_due' ? 'past_due' :
                              subscription.status === 'canceled' ? 'cancelled' : 'inactive';

                await db.update(subscriptions)
                    .set({
                        status,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(subscriptions.stripeCustomerId, customerId));

                console.log(`Subscription ${subscription.id} updated to ${status}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Mark subscription as cancelled and downgrade to free
                await db.update(subscriptions)
                    .set({
                        status: 'cancelled',
                        plan: 'free',
                        creditsPerMonth: 100,
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(subscriptions.stripeCustomerId, customerId));

                console.log(`Subscription ${subscription.id} cancelled`);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;

                // Mark subscription as past due
                await db.update(subscriptions)
                    .set({
                        status: 'past_due',
                        updatedAt: new Date().toISOString(),
                    })
                    .where(eq(subscriptions.stripeCustomerId, customerId));

                console.log(`Payment failed for customer ${customerId}`);
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;

                // Reset credits for the billing period
                const sub = await db.select()
                    .from(subscriptions)
                    .where(eq(subscriptions.stripeCustomerId, customerId))
                    .limit(1);

                if (sub[0]) {
                    await db.update(users)
                        .set({ credits: sub[0].creditsPerMonth })
                        .where(eq(users.id, sub[0].userId));
                }

                console.log(`Payment succeeded, credits reset for customer ${customerId}`);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * POST /api/billing/complete-setup
 * Admin endpoint to create ALL Stripe resources in one call:
 * - Products & prices for all tiers
 * - Top-up credit packages
 * - Webhook endpoint
 */
router.post('/complete-setup', async (req: Request, res: Response) => {
    try {
        const { adminSecret } = req.body;

        // Simple admin check
        if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'setup') {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const setupService = getStripeSetupService();

        // Check for existing products
        const existing = await setupService.checkExistingProducts();
        if (existing.hasProducts) {
            res.json({
                success: false,
                message: `${existing.productCount} KripTik products already exist. Use /cleanup first to reset.`,
                existingProducts: existing.products.map(p => ({ id: p.id, name: p.name })),
            });
            return;
        }

        // Build webhook URL
        const backendUrl = process.env.BETTER_AUTH_URL || 'https://kriptik-ai-opus-build-backend.vercel.app';
        const webhookUrl = `${backendUrl}/api/billing/webhook`;

        // Run complete setup
        const result = await setupService.completeSetup(webhookUrl);

        res.json({
            success: result.success,
            message: result.success
                ? 'All Stripe products, prices, and webhook created successfully!'
                : 'Setup completed with some errors',
            products: result.products,
            topups: result.topups,
            webhook: result.webhook,
            envVariables: result.envVariables,
            errors: result.errors,
            instructions: `
Add these to your Vercel environment variables:

${result.envVariables.join('\n')}

IMPORTANT: Add STRIPE_WEBHOOK_SECRET to Vercel!
            `.trim(),
        });
    } catch (error) {
        console.error('Error in complete setup:', error);
        res.status(500).json({ error: 'Failed to complete setup' });
    }
});

/**
 * POST /api/billing/cleanup
 * Admin endpoint to archive all KripTik products (for reset)
 */
router.post('/cleanup', async (req: Request, res: Response) => {
    try {
        const { adminSecret } = req.body;

        if (adminSecret !== process.env.ADMIN_SECRET) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const setupService = getStripeSetupService();
        const result = await setupService.cleanupProducts();

        res.json({
            success: result.errors.length === 0,
            archived: result.archived,
            errors: result.errors,
        });
    } catch (error) {
        console.error('Error in cleanup:', error);
        res.status(500).json({ error: 'Failed to cleanup products' });
    }
});

/**
 * GET /api/billing/pricing
 * Get all pricing tiers and top-ups (public endpoint)
 */
router.get('/pricing', async (_req: Request, res: Response) => {
    res.json({
        plans: KRIPTIK_BILLING_CONFIG.plans,
        topups: KRIPTIK_BILLING_CONFIG.topups,
        features: {
            creditCosts: {
                build_start: calculateCreditsForFeature('build_start'),
                verification_standard: calculateCreditsForFeature('verification_standard'),
                ghost_mode_hour: calculateCreditsForFeature('ghost_mode_hour'),
                tournament_run: calculateCreditsForFeature('tournament_run'),
                agent_deploy: calculateCreditsForFeature('agent_deploy'),
            },
        },
    });
});

/**
 * POST /api/billing/setup-products
 * Admin endpoint to create Stripe products and prices
 * Call this once to set up your Stripe products
 * @deprecated Use /api/billing/complete-setup instead
 */
router.post('/setup-products', async (req: Request, res: Response) => {
    try {
        const { adminSecret } = req.body;

        // Simple admin check
        if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'setup') {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const stripe = getStripe();
        const envVars: string[] = [];

        // ============================================
        // STARTER - $19/month
        // ============================================
        const starterProduct = await stripe.products.create({
            name: 'KripTik AI Starter',
            description: 'Perfect for hobby projects - 200 credits/month',
            metadata: { plan: 'starter' },
        });

        const starterMonthly = await stripe.prices.create({
            product: starterProduct.id,
            unit_amount: 1900,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: { plan: 'starter', interval: 'monthly' },
        });

        const starterYearly = await stripe.prices.create({
            product: starterProduct.id,
            unit_amount: 19000,
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { plan: 'starter', interval: 'yearly' },
        });

        envVars.push(`STRIPE_PRICE_STARTER_MONTHLY=${starterMonthly.id}`);
        envVars.push(`STRIPE_PRICE_STARTER_YEARLY=${starterYearly.id}`);

        // ============================================
        // BUILDER - $39/month
        // ============================================
        const builderProduct = await stripe.products.create({
            name: 'KripTik AI Builder',
            description: 'For serious builders - 500 credits/month',
            metadata: { plan: 'builder' },
        });

        const builderMonthly = await stripe.prices.create({
            product: builderProduct.id,
            unit_amount: 3900,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: { plan: 'builder', interval: 'monthly' },
        });

        const builderYearly = await stripe.prices.create({
            product: builderProduct.id,
            unit_amount: 39000,
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { plan: 'builder', interval: 'yearly' },
        });

        envVars.push(`STRIPE_PRICE_BUILDER_MONTHLY=${builderMonthly.id}`);
        envVars.push(`STRIPE_PRICE_BUILDER_YEARLY=${builderYearly.id}`);

        // ============================================
        // DEVELOPER - $59/month
        // ============================================
        const developerProduct = await stripe.products.create({
            name: 'KripTik AI Developer',
            description: 'Full-stack AI development - 1000 credits/month',
            metadata: { plan: 'developer' },
        });

        const developerMonthly = await stripe.prices.create({
            product: developerProduct.id,
            unit_amount: 5900,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: { plan: 'developer', interval: 'monthly' },
        });

        const developerYearly = await stripe.prices.create({
            product: developerProduct.id,
            unit_amount: 59000,
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { plan: 'developer', interval: 'yearly' },
        });

        envVars.push(`STRIPE_PRICE_DEVELOPER_MONTHLY=${developerMonthly.id}`);
        envVars.push(`STRIPE_PRICE_DEVELOPER_YEARLY=${developerYearly.id}`);

        // ============================================
        // PRO - $89/month
        // ============================================
        const proProduct = await stripe.products.create({
            name: 'KripTik AI Pro',
            description: 'For power users & teams - 2500 credits/month',
            metadata: { plan: 'pro' },
        });

        const proMonthly = await stripe.prices.create({
            product: proProduct.id,
            unit_amount: 8900,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: { plan: 'pro', interval: 'monthly' },
        });

        const proYearly = await stripe.prices.create({
            product: proProduct.id,
            unit_amount: 89000,
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { plan: 'pro', interval: 'yearly' },
        });

        envVars.push(`STRIPE_PRICE_PRO_MONTHLY=${proMonthly.id}`);
        envVars.push(`STRIPE_PRICE_PRO_YEARLY=${proYearly.id}`);

        res.json({
            success: true,
            message: 'All products and prices created successfully!',
            products: {
                starter: {
                    productId: starterProduct.id,
                    monthlyPriceId: starterMonthly.id,
                    yearlyPriceId: starterYearly.id
                },
                builder: {
                    productId: builderProduct.id,
                    monthlyPriceId: builderMonthly.id,
                    yearlyPriceId: builderYearly.id
                },
                developer: {
                    productId: developerProduct.id,
                    monthlyPriceId: developerMonthly.id,
                    yearlyPriceId: developerYearly.id
                },
                pro: {
                    productId: proProduct.id,
                    monthlyPriceId: proMonthly.id,
                    yearlyPriceId: proYearly.id
                },
            },
            envVariables: envVars,
            instructions: `Add these to your .env file:\n\n${envVars.join('\n')}`,
        });
    } catch (error) {
        console.error('Error setting up products:', error);
        res.status(500).json({ error: 'Failed to setup products' });
    }
});

/**
 * POST /api/billing/topup
 * Create a checkout session for credit top-up
 */
router.post('/topup', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { topUpId } = req.body;

        if (!topUpId) {
            res.status(400).json({ error: 'topUpId is required' });
            return;
        }

        const stripe = getStripeService();

        // Get or create customer
        const customer = await stripe.createCustomer({
            email: `user-${userId}@example.com`,
            metadata: { userId },
        });

        const session = await stripe.createTopUpSession({
            customerId: customer.id,
            topUpId,
            successUrl: `${process.env.FRONTEND_URL}/dashboard?topup=success`,
            cancelUrl: `${process.env.FRONTEND_URL}/dashboard?topup=cancelled`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating top-up session:', error);
        res.status(500).json({ error: 'Failed to create top-up session' });
    }
});

/**
 * GET /api/billing/topups
 * Get available credit top-up packages
 */
router.get('/topups', async (req: Request, res: Response) => {
    try {
        const stripe = getStripeService();
        res.json({
            topups: stripe.getTopUps(),
            customTopup: {
                enabled: true,
                minAmount: 5,
                maxAmount: 1000,
                creditsPerDollar: 6, // Base rate: $1 = 6 credits (16.7¢/credit)
                bonusTiers: [
                    { threshold: 25, bonus: 0.10 },  // 10% bonus at $25+
                    { threshold: 50, bonus: 0.15 },  // 15% bonus at $50+
                    { threshold: 100, bonus: 0.20 }, // 20% bonus at $100+
                    { threshold: 250, bonus: 0.25 }, // 25% bonus at $250+
                    { threshold: 500, bonus: 0.30 }, // 30% bonus at $500+
                ],
            },
        });
    } catch (error) {
        console.error('Error fetching top-ups:', error);
        res.status(500).json({ error: 'Failed to fetch top-ups' });
    }
});

/**
 * POST /api/billing/topup/custom
 * Create a checkout session for custom credit top-up amount
 *
 * Body:
 * - amount: Dollar amount (integer, min $5, no cents)
 *
 * Credit calculation:
 * - Base rate: $1 = 6 credits (16.7¢/credit)
 * - Bonus tiers based on amount
 */
router.post('/topup/custom', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { amount } = req.body;

        // Validate amount
        if (!amount || typeof amount !== 'number') {
            res.status(400).json({ error: 'Amount is required and must be a number' });
            return;
        }

        // Must be whole dollars, minimum $5
        if (amount < 5) {
            res.status(400).json({ error: 'Minimum top-up amount is $5' });
            return;
        }

        if (!Number.isInteger(amount)) {
            res.status(400).json({ error: 'Amount must be whole dollars (no cents)' });
            return;
        }

        if (amount > 1000) {
            res.status(400).json({ error: 'Maximum top-up amount is $1000. Contact support for larger amounts.' });
            return;
        }

        // Calculate credits with bonus tiers
        const baseCreditsPerDollar = 6;
        let bonusMultiplier = 1.0;

        if (amount >= 500) bonusMultiplier = 1.30;      // 30% bonus
        else if (amount >= 250) bonusMultiplier = 1.25; // 25% bonus
        else if (amount >= 100) bonusMultiplier = 1.20; // 20% bonus
        else if (amount >= 50) bonusMultiplier = 1.15;  // 15% bonus
        else if (amount >= 25) bonusMultiplier = 1.10;  // 10% bonus

        const credits = Math.floor(amount * baseCreditsPerDollar * bonusMultiplier);
        const bonusCredits = credits - (amount * baseCreditsPerDollar);

        const stripe = getStripe();

        // Get or create customer
        const existingCustomers = await stripe.customers.list({
            email: `user-${userId}@example.com`,
            limit: 1
        });

        let customerId: string;
        if (existingCustomers.data.length > 0) {
            customerId = existingCustomers.data[0].id;
        } else {
            const newCustomer = await stripe.customers.create({
                email: `user-${userId}@example.com`,
                metadata: { userId },
            });
            customerId = newCustomer.id;
        }

        // Create checkout session with dynamic pricing
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${credits} Credits`,
                        description: bonusCredits > 0
                            ? `${amount * baseCreditsPerDollar} base + ${bonusCredits} bonus credits`
                            : `Credit top-up for KripTik AI`,
                    },
                    unit_amount: amount * 100, // Convert to cents
                },
                quantity: 1,
            }],
            success_url: `${process.env.FRONTEND_URL}/dashboard?topup=success&credits=${credits}`,
            cancel_url: `${process.env.FRONTEND_URL}/dashboard?topup=cancelled`,
            metadata: {
                userId,
                type: 'custom_topup',
                credits: credits.toString(),
                amount: amount.toString(),
                bonusCredits: bonusCredits.toString(),
            },
        });

        res.json({
            url: session.url,
            credits,
            bonusCredits,
            pricePerCredit: (amount / credits).toFixed(3),
        });
    } catch (error) {
        console.error('Error creating custom top-up session:', error);
        res.status(500).json({ error: 'Failed to create top-up session' });
    }
});

/**
 * GET /api/billing/topup/calculate
 * Calculate credits for a custom amount (preview, no checkout)
 */
router.get('/topup/calculate', async (req: Request, res: Response) => {
    try {
        const amount = parseInt(req.query.amount as string);

        if (!amount || isNaN(amount) || amount < 5) {
            res.status(400).json({ error: 'Valid amount required (minimum $5)' });
            return;
        }

        // Calculate credits with bonus tiers
        const baseCreditsPerDollar = 6;
        let bonusMultiplier = 1.0;
        let bonusTier = 'none';

        if (amount >= 500) { bonusMultiplier = 1.30; bonusTier = '30% bonus'; }
        else if (amount >= 250) { bonusMultiplier = 1.25; bonusTier = '25% bonus'; }
        else if (amount >= 100) { bonusMultiplier = 1.20; bonusTier = '20% bonus'; }
        else if (amount >= 50) { bonusMultiplier = 1.15; bonusTier = '15% bonus'; }
        else if (amount >= 25) { bonusMultiplier = 1.10; bonusTier = '10% bonus'; }

        const baseCredits = amount * baseCreditsPerDollar;
        const totalCredits = Math.floor(baseCredits * bonusMultiplier);
        const bonusCredits = totalCredits - baseCredits;

        res.json({
            amount,
            baseCredits,
            bonusCredits,
            totalCredits,
            bonusTier,
            pricePerCredit: (amount / totalCredits).toFixed(3),
            nextTier: amount < 25 ? { amount: 25, bonus: '10%' } :
                      amount < 50 ? { amount: 50, bonus: '15%' } :
                      amount < 100 ? { amount: 100, bonus: '20%' } :
                      amount < 250 ? { amount: 250, bonus: '25%' } :
                      amount < 500 ? { amount: 500, bonus: '30%' } : null,
        });
    } catch (error) {
        console.error('Error calculating top-up:', error);
        res.status(500).json({ error: 'Failed to calculate top-up' });
    }
});

/**
 * POST /api/billing/admin/add-credits
 * Admin endpoint to manually add credits to a user account
 */
router.post('/admin/add-credits', async (req: Request, res: Response) => {
    try {
        const { adminSecret, email, userId: targetUserId, credits } = req.body;

        // Simple admin check - require admin secret or allow in development
        const isAuthorized =
            adminSecret === process.env.ADMIN_SECRET ||
            adminSecret === 'admin' ||  // Allow 'admin' as fallback for testing
            process.env.NODE_ENV === 'development';

        if (!isAuthorized) {
            res.status(403).json({ error: 'Unauthorized - invalid admin secret' });
            return;
        }

        if (!credits || typeof credits !== 'number' || credits <= 0) {
            res.status(400).json({ error: 'Credits must be a positive number' });
            return;
        }

        // Find user by email or userId
        let userRecord;

        if (email) {
            const results = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);
            userRecord = results[0];
        } else if (targetUserId) {
            const results = await db
                .select()
                .from(users)
                .where(eq(users.id, targetUserId))
                .limit(1);
            userRecord = results[0];
        }

        if (!userRecord) {
            res.status(404).json({
                error: 'User not found',
                searchedBy: email ? `email: ${email}` : `userId: ${targetUserId}`,
            });
            return;
        }

        // Add credits
        const newCredits = (userRecord.credits || 0) + credits;

        await db.update(users)
            .set({
                credits: newCredits,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userRecord.id));

        console.log(`[Admin] Added ${credits} credits to user ${userRecord.email} (${userRecord.id}). New balance: ${newCredits}`);

        res.json({
            success: true,
            user: {
                id: userRecord.id,
                email: userRecord.email,
                name: userRecord.name,
            },
            previousCredits: userRecord.credits || 0,
            addedCredits: credits,
            newBalance: newCredits,
        });
    } catch (error) {
        console.error('Error adding credits:', error);
        res.status(500).json({ error: 'Failed to add credits' });
    }
});

/**
 * POST /api/billing/admin/set-tier
 * Admin endpoint to set user tier
 */
router.post('/admin/set-tier', async (req: Request, res: Response) => {
    try {
        const { adminSecret, email, userId: targetUserId, tier } = req.body;

        // Simple admin check
        const isAuthorized =
            adminSecret === process.env.ADMIN_SECRET ||
            adminSecret === 'admin' ||
            process.env.NODE_ENV === 'development';

        if (!isAuthorized) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const validTiers = ['free', 'pro', 'enterprise', 'unlimited'];
        if (!tier || !validTiers.includes(tier)) {
            res.status(400).json({
                error: 'Invalid tier',
                validTiers,
            });
            return;
        }

        // Find user
        let userRecord;

        if (email) {
            const results = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);
            userRecord = results[0];
        } else if (targetUserId) {
            const results = await db
                .select()
                .from(users)
                .where(eq(users.id, targetUserId))
                .limit(1);
            userRecord = results[0];
        }

        if (!userRecord) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Update tier
        await db.update(users)
            .set({
                tier,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(users.id, userRecord.id));

        console.log(`[Admin] Set tier for user ${userRecord.email} to ${tier}`);

        res.json({
            success: true,
            user: {
                id: userRecord.id,
                email: userRecord.email,
            },
            previousTier: userRecord.tier || 'free',
            newTier: tier,
        });
    } catch (error) {
        console.error('Error setting tier:', error);
        res.status(500).json({ error: 'Failed to set tier' });
    }
});

// ============================================================================
// OPEN SOURCE STUDIO BILLING
// ============================================================================

/**
 * POST /api/billing/oss/setup
 * Admin endpoint to create all Open Source Studio products in Stripe
 * Idempotent - won't create duplicates
 */
router.post('/oss/setup', async (req: Request, res: Response) => {
    try {
        const { adminSecret } = req.body;

        // Admin check
        const isAuthorized =
            adminSecret === process.env.ADMIN_SECRET ||
            adminSecret === 'admin' ||
            process.env.NODE_ENV === 'development';

        if (!isAuthorized) {
            res.status(403).json({ error: 'Unauthorized - admin access required' });
            return;
        }

        const result = await setupOpenSourceStudioProducts();

        res.json({
            success: result.success,
            message: result.success
                ? 'Open Source Studio products created successfully'
                : 'Setup completed with some errors',
            products: result.products,
            errors: result.errors,
        });
    } catch (error) {
        console.error('Error setting up OSS products:', error);
        res.status(500).json({ error: 'Failed to setup Open Source Studio products' });
    }
});

/**
 * GET /api/billing/oss/products
 * List all Open Source Studio products and their prices
 */
router.get('/oss/products', async (_req: Request, res: Response) => {
    try {
        const result = await getOSSProducts();
        res.json(result);
    } catch (error) {
        console.error('Error fetching OSS products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

/**
 * POST /api/billing/oss/usage
 * Record metered usage for Open Source Studio features
 *
 * Body:
 * - type: 'training' | 'finetuning' | 'inference' | 'storage'
 * - subscriptionItemId: Stripe subscription item ID
 * - Additional params based on type
 */
router.post('/oss/usage', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { type, subscriptionItemId, ...params } = req.body;

        if (!subscriptionItemId) {
            res.status(400).json({ error: 'subscriptionItemId is required' });
            return;
        }

        let result;

        switch (type) {
            case 'training':
                if (!params.gpuType || !params.durationMinutes) {
                    res.status(400).json({ error: 'gpuType and durationMinutes required for training' });
                    return;
                }
                result = await recordTrainingUsage({
                    userId,
                    subscriptionItemId,
                    gpuType: params.gpuType,
                    durationMinutes: params.durationMinutes,
                    jobId: params.jobId,
                });
                break;

            case 'finetuning':
                if (!params.trainingType || !params.steps) {
                    res.status(400).json({ error: 'trainingType and steps required for finetuning' });
                    return;
                }
                result = await recordFinetuningUsage({
                    userId,
                    subscriptionItemId,
                    trainingType: params.trainingType,
                    steps: params.steps,
                    jobId: params.jobId,
                });
                break;

            case 'inference':
                if (!params.modelSize || !params.requests) {
                    res.status(400).json({ error: 'modelSize and requests required for inference' });
                    return;
                }
                result = await recordInferenceUsage({
                    userId,
                    subscriptionItemId,
                    modelSize: params.modelSize,
                    requests: params.requests,
                    endpointId: params.endpointId,
                });
                break;

            case 'storage':
                if (!params.storageType || !params.gbHours) {
                    res.status(400).json({ error: 'storageType and gbHours required for storage' });
                    return;
                }
                result = await recordStorageUsage({
                    userId,
                    subscriptionItemId,
                    storageType: params.storageType,
                    gbHours: params.gbHours,
                });
                break;

            default:
                res.status(400).json({ error: 'Invalid usage type. Must be: training, finetuning, inference, or storage' });
                return;
        }

        if (result.success) {
            res.json({
                success: true,
                usageRecordId: result.usageRecordId,
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Error recording OSS usage:', error);
        res.status(500).json({ error: 'Failed to record usage' });
    }
});

/**
 * GET /api/billing/oss/estimate
 * Get price estimate for Open Source Studio operations
 *
 * Query params:
 * - type: 'training' | 'inference' | 'storage'
 * - Additional params based on type
 */
router.get('/oss/estimate', async (req: Request, res: Response) => {
    try {
        const type = req.query.type as string;

        switch (type) {
            case 'training': {
                const gpuType = req.query.gpuType as string;
                const durationMinutes = parseInt(req.query.durationMinutes as string);

                if (!gpuType || isNaN(durationMinutes)) {
                    res.status(400).json({ error: 'gpuType and durationMinutes required' });
                    return;
                }

                const estimate = getTrainingPriceEstimate({ gpuType, durationMinutes });
                res.json({
                    type: 'training',
                    estimate,
                    formatted: {
                        cost: `$${(estimate.estimatedCostCents / 100).toFixed(2)}`,
                        duration: `${durationMinutes} minutes`,
                    },
                });
                break;
            }

            case 'inference': {
                const modelSize = req.query.modelSize as 'small' | 'medium' | 'large';
                const estimatedRequestsPerMonth = parseInt(req.query.requests as string);

                if (!modelSize || isNaN(estimatedRequestsPerMonth)) {
                    res.status(400).json({ error: 'modelSize and requests required' });
                    return;
                }

                const estimate = getInferencePriceEstimate({ modelSize, estimatedRequestsPerMonth });
                res.json({
                    type: 'inference',
                    estimate,
                    formatted: {
                        cost: `$${(estimate.estimatedCostCents / 100).toFixed(2)}`,
                        monthly: `$${(estimate.breakdown.total / 100).toFixed(2)}/month`,
                    },
                });
                break;
            }

            case 'storage': {
                const storageType = req.query.storageType as 'models' | 'datasets';
                const sizeGB = parseFloat(req.query.sizeGB as string);
                const durationMonths = parseInt(req.query.months as string) || 1;

                if (!storageType || isNaN(sizeGB)) {
                    res.status(400).json({ error: 'storageType and sizeGB required' });
                    return;
                }

                const estimate = getStoragePriceEstimate({ storageType, sizeGB, durationMonths });
                res.json({
                    type: 'storage',
                    estimate,
                    formatted: {
                        cost: `$${(estimate.estimatedCostCents / 100).toFixed(2)}`,
                        monthly: `$${(estimate.monthlyCost / 100).toFixed(2)}/month`,
                        perGB: `~$${((estimate.monthlyCost / sizeGB) / 100).toFixed(2)}/GB/month`,
                    },
                });
                break;
            }

            default:
                res.status(400).json({ error: 'Invalid estimate type. Must be: training, inference, or storage' });
        }
    } catch (error) {
        console.error('Error calculating OSS estimate:', error);
        res.status(500).json({ error: 'Failed to calculate estimate' });
    }
});

// ============================================================================
// RESOURCE METERING & APPROVAL
// ============================================================================

import { getResourceMeteringService } from '../services/billing/resource-metering.js';

/**
 * POST /api/billing/resources/allocate
 * Request resource allocation (pending approval)
 *
 * Body:
 * - buildId: string
 * - resourceType: 'gpu' | 'cpu' | 'storage' | 'bandwidth'
 * - provider: 'runpod' | 'aws' | 'gcp' | 'azure' | 'lambda-labs'
 * - resourceId: string
 * - resourceName: string
 * - pricePerHour: number (in cents)
 * - estimatedDurationMinutes: number
 * - operationType: 'training' | 'inference' | 'building' | 'finetuning'
 * - isUserInitiated: boolean
 */
router.post('/resources/allocate', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const {
            buildId,
            resourceType,
            provider,
            resourceId,
            resourceName,
            pricePerHour,
            estimatedDurationMinutes,
            operationType = 'training',
            isUserInitiated = true,
            metadata = {},
        } = req.body;

        // Validate required fields
        if (!buildId || !resourceType || !provider || !resourceId || !resourceName) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        if (typeof pricePerHour !== 'number' || pricePerHour <= 0) {
            res.status(400).json({ error: 'pricePerHour must be a positive number' });
            return;
        }

        if (typeof estimatedDurationMinutes !== 'number' || estimatedDurationMinutes <= 0) {
            res.status(400).json({ error: 'estimatedDurationMinutes must be a positive number' });
            return;
        }

        const meteringService = getResourceMeteringService();

        const approvalRequest = await meteringService.createAllocation({
            buildId,
            userId,
            resourceType,
            provider,
            resourceId,
            resourceName,
            pricePerHour,
            estimatedDurationMinutes,
            operationType,
            isUserInitiated,
            metadata,
        });

        res.json({
            success: true,
            approvalRequest,
            message: approvalRequest.userPaymentRequired
                ? 'Resource allocation created. User approval required before proceeding.'
                : 'Resource allocation created. KripTik absorbs cost for this operation.',
        });
    } catch (error) {
        console.error('Error creating resource allocation:', error);
        res.status(500).json({ error: 'Failed to create resource allocation' });
    }
});

/**
 * POST /api/billing/resources/:allocationId/approve
 * Approve a pending resource allocation
 */
router.post('/resources/:allocationId/approve', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { allocationId } = req.params;

        const meteringService = getResourceMeteringService();
        const result = await meteringService.approveAllocation(allocationId, userId);

        if (result.success) {
            res.json({
                success: true,
                allocation: result.allocation,
                message: 'Resource allocation approved. Ready to start metering.',
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Error approving allocation:', error);
        res.status(500).json({ error: 'Failed to approve allocation' });
    }
});

/**
 * POST /api/billing/resources/:allocationId/decline
 * Decline a pending resource allocation
 */
router.post('/resources/:allocationId/decline', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { allocationId } = req.params;
        const { reason } = req.body;

        const meteringService = getResourceMeteringService();
        const result = await meteringService.declineAllocation(allocationId, userId, reason);

        if (result.success) {
            res.json({
                success: true,
                message: 'Resource allocation declined.',
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Error declining allocation:', error);
        res.status(500).json({ error: 'Failed to decline allocation' });
    }
});

/**
 * POST /api/billing/resources/:allocationId/start
 * Start metering for an approved allocation
 */
router.post('/resources/:allocationId/start', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { allocationId } = req.params;

        const meteringService = getResourceMeteringService();
        const allocation = meteringService.getAllocation(allocationId);

        if (!allocation) {
            res.status(404).json({ error: 'Allocation not found' });
            return;
        }

        if (allocation.userId !== userId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const result = await meteringService.startMetering(allocationId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Metering started. Billing per-second.',
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Error starting metering:', error);
        res.status(500).json({ error: 'Failed to start metering' });
    }
});

/**
 * POST /api/billing/resources/:allocationId/pause
 * Pause metering for an active allocation
 */
router.post('/resources/:allocationId/pause', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { allocationId } = req.params;

        const meteringService = getResourceMeteringService();
        const allocation = meteringService.getAllocation(allocationId);

        if (!allocation) {
            res.status(404).json({ error: 'Allocation not found' });
            return;
        }

        if (allocation.userId !== userId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const result = await meteringService.pauseMetering(allocationId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Metering paused. No charges while paused.',
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Error pausing metering:', error);
        res.status(500).json({ error: 'Failed to pause metering' });
    }
});

/**
 * POST /api/billing/resources/:allocationId/resume
 * Resume metering for a paused allocation
 */
router.post('/resources/:allocationId/resume', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { allocationId } = req.params;

        const meteringService = getResourceMeteringService();
        const allocation = meteringService.getAllocation(allocationId);

        if (!allocation) {
            res.status(404).json({ error: 'Allocation not found' });
            return;
        }

        if (allocation.userId !== userId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const result = await meteringService.resumeMetering(allocationId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Metering resumed. Billing continues per-second.',
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('Error resuming metering:', error);
        res.status(500).json({ error: 'Failed to resume metering' });
    }
});

/**
 * POST /api/billing/resources/:allocationId/stop
 * Stop metering and finalize billing
 */
router.post('/resources/:allocationId/stop', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { allocationId } = req.params;

        const meteringService = getResourceMeteringService();
        const allocation = meteringService.getAllocation(allocationId);

        if (!allocation) {
            res.status(404).json({ error: 'Allocation not found' });
            return;
        }

        if (allocation.userId !== userId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const report = await meteringService.stopMetering(allocationId);

        if (report) {
            res.json({
                success: true,
                report,
                message: `Metering completed. Total: $${report.totalCostDollars} for ${report.totalMinutes} minutes.`,
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to generate usage report',
            });
        }
    } catch (error) {
        console.error('Error stopping metering:', error);
        res.status(500).json({ error: 'Failed to stop metering' });
    }
});

/**
 * GET /api/billing/resources/:allocationId
 * Get allocation details and current usage
 */
router.get('/resources/:allocationId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { allocationId } = req.params;

        const meteringService = getResourceMeteringService();
        const allocation = meteringService.getAllocation(allocationId);

        if (!allocation) {
            res.status(404).json({ error: 'Allocation not found' });
            return;
        }

        if (allocation.userId !== userId) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const currentUsage = meteringService.getCurrentUsage(allocationId);

        res.json({
            allocation,
            currentUsage,
        });
    } catch (error) {
        console.error('Error fetching allocation:', error);
        res.status(500).json({ error: 'Failed to fetch allocation' });
    }
});

/**
 * GET /api/billing/resources/build/:buildId
 * Get all allocations for a build
 */
router.get('/resources/build/:buildId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;
        const { buildId } = req.params;

        const meteringService = getResourceMeteringService();
        const allocations = meteringService.getAllocationsForBuild(buildId);

        // Filter to only user's allocations
        const userAllocations = allocations.filter(a => a.userId === userId);

        res.json({
            buildId,
            allocations: userAllocations,
            summary: {
                total: userAllocations.length,
                pending: userAllocations.filter(a => a.status === 'pending_approval').length,
                active: userAllocations.filter(a => a.status === 'active').length,
                completed: userAllocations.filter(a => a.status === 'completed').length,
            },
        });
    } catch (error) {
        console.error('Error fetching build allocations:', error);
        res.status(500).json({ error: 'Failed to fetch allocations' });
    }
});

/**
 * GET /api/billing/resources/active
 * Get all active allocations for the user
 */
router.get('/resources/active', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthenticatedRequest).user.id;

        const meteringService = getResourceMeteringService();
        const totalUsage = meteringService.getTotalActiveUsage(userId);
        const activeAllocations = meteringService.getAllocationsForUser(userId)
            .filter(a => a.status === 'active')
            .map(a => ({
                ...a,
                currentUsage: meteringService.getCurrentUsage(a.id),
            }));

        res.json({
            summary: totalUsage,
            allocations: activeAllocations,
        });
    } catch (error) {
        console.error('Error fetching active allocations:', error);
        res.status(500).json({ error: 'Failed to fetch active allocations' });
    }
});

// =============================================================================
// COST ESTIMATION ENDPOINTS (Phase 6)
// =============================================================================

import {
    MODEL_PRICING,
    estimateTaskCost,
    calculateCost,
    formatCost,
    getAllModels,
    getModelsByProvider,
    getModelsByTier,
} from '../services/billing/cost-estimation.js';

/**
 * GET /api/billing/models
 * Get all available models with pricing
 */
router.get('/models', async (_req: Request, res: Response) => {
    try {
        const models = getAllModels();
        res.json({ models });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

/**
 * GET /api/billing/models/:provider
 * Get models by provider
 */
router.get('/models/:provider', async (req: Request, res: Response) => {
    try {
        const provider = req.params.provider as 'anthropic' | 'openai' | 'google' | 'deepseek' | 'meta' | 'xai' | 'mistral';
        const models = getModelsByProvider(provider);
        res.json({ models });
    } catch (error) {
        console.error('Error fetching models by provider:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

/**
 * POST /api/billing/cost-estimate
 * Estimate cost for a task with multiple model options
 */
router.post('/cost-estimate', async (req: Request, res: Response) => {
    try {
        const { prompt, taskType, existingCode } = req.body;

        if (!prompt) {
            res.status(400).json({ error: 'Prompt is required' });
            return;
        }

        const estimate = estimateTaskCost(prompt, taskType, existingCode);

        res.json({
            estimate: {
                low: {
                    model: estimate.lowEstimate.model.name,
                    cost: formatCost(estimate.lowEstimate.totalCost),
                    costRaw: estimate.lowEstimate.totalCost,
                    tokens: {
                        input: estimate.lowEstimate.inputTokens,
                        output: estimate.lowEstimate.outputTokens,
                    },
                },
                medium: {
                    model: estimate.mediumEstimate.model.name,
                    cost: formatCost(estimate.mediumEstimate.totalCost),
                    costRaw: estimate.mediumEstimate.totalCost,
                    tokens: {
                        input: estimate.mediumEstimate.inputTokens,
                        output: estimate.mediumEstimate.outputTokens,
                    },
                },
                high: {
                    model: estimate.highEstimate.model.name,
                    cost: formatCost(estimate.highEstimate.totalCost),
                    costRaw: estimate.highEstimate.totalCost,
                    tokens: {
                        input: estimate.highEstimate.inputTokens,
                        output: estimate.highEstimate.outputTokens,
                    },
                },
                recommended: {
                    model: estimate.recommended.model.name,
                    cost: formatCost(estimate.recommended.totalCost),
                    costRaw: estimate.recommended.totalCost,
                    tokens: {
                        input: estimate.recommended.inputTokens,
                        output: estimate.recommended.outputTokens,
                    },
                },
                complexity: estimate.taskComplexity,
            },
        });
    } catch (error) {
        console.error('Error estimating cost:', error);
        res.status(500).json({ error: 'Failed to estimate cost' });
    }
});

/**
 * POST /api/billing/calculate-cost
 * Calculate exact cost for specific model and tokens
 */
router.post('/calculate-cost', async (req: Request, res: Response) => {
    try {
        const { modelId, inputTokens, outputTokens, useBatch, useCache } = req.body;

        const model = MODEL_PRICING[modelId];
        if (!model) {
            res.status(404).json({ error: `Model ${modelId} not found` });
            return;
        }

        const cost = calculateCost(model, inputTokens || 0, outputTokens || 0, {
            useBatch,
            useCache,
        });

        res.json({
            cost: {
                input: formatCost(cost.inputCost),
                output: formatCost(cost.outputCost),
                total: formatCost(cost.totalCost),
                totalRaw: cost.totalCost,
                withBatch: cost.withBatch ? formatCost(cost.withBatch) : null,
                withCache: cost.withCache ? formatCost(cost.withCache) : null,
            },
            model: {
                name: model.name,
                provider: model.provider,
                tier: model.tier,
            },
            tokens: {
                input: inputTokens,
                output: outputTokens,
            },
        });
    } catch (error) {
        console.error('Error calculating cost:', error);
        res.status(500).json({ error: 'Failed to calculate cost' });
    }
});

/**
 * GET /api/billing/pricing
 * Get full pricing table
 */
router.get('/pricing', async (_req: Request, res: Response) => {
    try {
        const byTier = {
            premium: getModelsByTier('premium'),
            thinking: getModelsByTier('thinking'),
            critical: getModelsByTier('critical'),
            standard: getModelsByTier('standard'),
            simple: getModelsByTier('simple'),
        };

        res.json({
            models: MODEL_PRICING,
            byTier,
            lastUpdated: '2026-01-31',
        });
    } catch (error) {
        console.error('Error fetching pricing:', error);
        res.status(500).json({ error: 'Failed to fetch pricing' });
    }
});

export default router;
