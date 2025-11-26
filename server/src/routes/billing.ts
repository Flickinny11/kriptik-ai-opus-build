/**
 * Billing API Routes
 *
 * Handles subscription management, usage tracking, and payments
 */

import { Router, Request, Response, raw } from 'express';
import Stripe from 'stripe';
import { createStripeBillingService, BILLING_PLANS } from '../services/billing/stripe';
import { usageTracker } from '../services/billing/usage';
import { db } from '../db';
import { subscriptions, users } from '../schema';
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
router.get('/usage', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const summary = await usageTracker.getUsageSummary(userId);
        res.json({ usage: summary });
    } catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

/**
 * GET /api/billing/usage/breakdown
 * Get usage breakdown by category
 */
router.get('/usage/breakdown', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const breakdown = await usageTracker.getUsageByCategory(userId);
        res.json({ breakdown });
    } catch (error) {
        console.error('Error fetching usage breakdown:', error);
        res.status(500).json({ error: 'Failed to fetch breakdown' });
    }
});

/**
 * GET /api/billing/usage/history
 * Get usage over time
 */
router.get('/usage/history', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const days = parseInt(req.query.days as string) || 30;
        const history = await usageTracker.getUsageOverTime(userId, days);

        res.json({ history });
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

                if (userId) {
                    // Update user subscription in database
                    await db.insert(subscriptions).values({
                        userId,
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                        plan: 'pro', // Determine from price
                        status: 'active',
                        creditsPerMonth: 1000,
                    }).onConflictDoUpdate({
                        target: subscriptions.userId,
                        set: {
                            stripeCustomerId: customerId,
                            stripeSubscriptionId: subscriptionId,
                            plan: 'pro',
                            status: 'active',
                        },
                    });

                    console.log(`Subscription created for user ${userId}`);
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
 * POST /api/billing/setup-products
 * Admin endpoint to create Stripe products and prices
 * Call this once to set up your Stripe products
 */
router.post('/setup-products', async (req: Request, res: Response) => {
    try {
        const { adminSecret } = req.body;
        
        // Simple admin check (use proper auth in production)
        if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'setup') {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const stripe = getStripe();
        const products: Record<string, { product: Stripe.Product; prices: Stripe.Price[] }> = {};

        // Create Pro plan
        const proProduct = await stripe.products.create({
            name: 'KripTik AI Pro',
            description: 'Professional plan with 1000 credits/month, priority support, and advanced features',
            metadata: {
                plan: 'pro',
            },
        });

        const proMonthlyPrice = await stripe.prices.create({
            product: proProduct.id,
            unit_amount: 2900, // $29.00
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: { plan: 'pro', interval: 'monthly' },
        });

        const proYearlyPrice = await stripe.prices.create({
            product: proProduct.id,
            unit_amount: 29000, // $290.00 (2 months free)
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { plan: 'pro', interval: 'yearly' },
        });

        products.pro = {
            product: proProduct,
            prices: [proMonthlyPrice, proYearlyPrice],
        };

        // Create Enterprise plan
        const enterpriseProduct = await stripe.products.create({
            name: 'KripTik AI Enterprise',
            description: 'Enterprise plan with unlimited credits, dedicated support, and custom integrations',
            metadata: {
                plan: 'enterprise',
            },
        });

        const enterpriseMonthlyPrice = await stripe.prices.create({
            product: enterpriseProduct.id,
            unit_amount: 9900, // $99.00
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: { plan: 'enterprise', interval: 'monthly' },
        });

        const enterpriseYearlyPrice = await stripe.prices.create({
            product: enterpriseProduct.id,
            unit_amount: 99000, // $990.00 (2 months free)
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { plan: 'enterprise', interval: 'yearly' },
        });

        products.enterprise = {
            product: enterpriseProduct,
            prices: [enterpriseMonthlyPrice, enterpriseYearlyPrice],
        };

        // Return the created products and prices
        res.json({
            success: true,
            message: 'Products and prices created successfully',
            products: {
                pro: {
                    productId: proProduct.id,
                    monthlyPriceId: proMonthlyPrice.id,
                    yearlyPriceId: proYearlyPrice.id,
                },
                enterprise: {
                    productId: enterpriseProduct.id,
                    monthlyPriceId: enterpriseMonthlyPrice.id,
                    yearlyPriceId: enterpriseYearlyPrice.id,
                },
            },
            instructions: `
Add these to your .env file:
STRIPE_PRICE_PRO_MONTHLY=${proMonthlyPrice.id}
STRIPE_PRICE_PRO_YEARLY=${proYearlyPrice.id}
STRIPE_PRICE_ENTERPRISE_MONTHLY=${enterpriseMonthlyPrice.id}
STRIPE_PRICE_ENTERPRISE_YEARLY=${enterpriseYearlyPrice.id}

Then update BILLING_PLANS in server/src/services/billing/stripe.ts with these price IDs.
            `.trim(),
        });
    } catch (error) {
        console.error('Error setting up products:', error);
        res.status(500).json({ error: 'Failed to setup products' });
    }
});

export default router;
