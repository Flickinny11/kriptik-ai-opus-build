/**
 * Stripe Integration API Routes
 *
 * Allows users to integrate their own Stripe accounts.
 * Users provide their API keys, and we help them:
 * - Create products and prices
 * - Set up payment links
 * - Configure webhooks
 * - Manage subscriptions
 */

import { Router, Request, Response } from 'express';
import {
    createStripeIntegration,
    generateStripeClientCode,
    generateStripeWebhookHandler,
} from '../services/billing/stripe-integration.js';
import { getCredentialVault } from '../services/security/credential-vault.js';

const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

async function ensureStripeConfigured(req: Request, res: Response, next: Function) {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const vault = getCredentialVault();
    const creds = await vault.getCredential(userId, 'stripe');

    if (!creds?.data?.secretKey) {
        return res.status(400).json({
            error: 'Stripe not configured',
            message: 'Please add your Stripe API keys in the credentials settings',
            missingCredential: 'stripe',
        });
    }

    next();
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/stripe/status
 * Check Stripe connection status
 */
router.get('/status', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const stripe = createStripeIntegration(userId);
        const result = await stripe.testConnection();
        res.json(result);
    } catch (error) {
        res.json({ success: false, error: 'Stripe not configured' });
    }
});

/**
 * GET /api/stripe/account
 * Get Stripe account info
 */
router.get('/account', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    try {
        const stripe = createStripeIntegration(userId);
        const [account, balance] = await Promise.all([
            stripe.getAccountInfo(),
            stripe.getBalance(),
        ]);

        res.json({
            account: {
                id: account.id,
                email: account.email,
                businessName: account.business_profile?.name,
                country: account.country,
            },
            balance: {
                available: balance.available,
                pending: balance.pending,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get account info',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/stripe/products
 * Create a product with price
 */
router.post('/products', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const projectId = req.headers['x-project-id'] as string;
    const { name, description, images, price } = req.body;

    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }

    try {
        const stripe = createStripeIntegration(userId, projectId);
        const result = await stripe.createProduct({
            name,
            description,
            images,
            price: {
                amount: price.amount,
                currency: price.currency || 'usd',
                recurring: price.recurring,
            },
        });

        res.json({
            success: true,
            product: result.product,
            price: result.price,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create product',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * GET /api/stripe/products
 * List products
 */
router.get('/products', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        const stripe = createStripeIntegration(userId);
        const products = await stripe.listProducts(limit);
        res.json({ products });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list products' });
    }
});

/**
 * GET /api/stripe/products/:productId
 * Get product with prices
 */
router.get('/products/:productId', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { productId } = req.params;

    try {
        const stripe = createStripeIntegration(userId);
        const result = await stripe.getProduct(productId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get product' });
    }
});

/**
 * PATCH /api/stripe/products/:productId
 * Update product
 */
router.patch('/products/:productId', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { productId } = req.params;
    const { name, description, active } = req.body;

    try {
        const stripe = createStripeIntegration(userId);
        const product = await stripe.updateProduct(productId, { name, description, active });
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

/**
 * DELETE /api/stripe/products/:productId
 * Archive product
 */
router.delete('/products/:productId', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { productId } = req.params;

    try {
        const stripe = createStripeIntegration(userId);
        const product = await stripe.archiveProduct(productId);
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ error: 'Failed to archive product' });
    }
});

/**
 * POST /api/stripe/prices
 * Create a price for a product
 */
router.post('/prices', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { productId, amount, currency, recurring } = req.body;

    if (!productId || !amount) {
        return res.status(400).json({ error: 'productId and amount are required' });
    }

    try {
        const stripe = createStripeIntegration(userId);
        const price = await stripe.createPrice(productId, amount, currency || 'usd', recurring);
        res.json({ success: true, price });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create price' });
    }
});

/**
 * GET /api/stripe/prices
 * List prices
 */
router.get('/prices', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const productId = req.query.productId as string;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        const stripe = createStripeIntegration(userId);
        const prices = await stripe.listPrices(productId, limit);
        res.json({ prices });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list prices' });
    }
});

/**
 * POST /api/stripe/payment-links
 * Create a payment link
 */
router.post('/payment-links', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { priceId, quantity, afterCompletion, metadata } = req.body;

    if (!priceId) {
        return res.status(400).json({ error: 'priceId is required' });
    }

    try {
        const stripe = createStripeIntegration(userId);
        const paymentLink = await stripe.createPaymentLink({
            priceId,
            quantity,
            afterCompletion,
            metadata,
        });

        res.json({
            success: true,
            paymentLink,
            url: paymentLink.url,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create payment link' });
    }
});

/**
 * GET /api/stripe/payment-links
 * List payment links
 */
router.get('/payment-links', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        const stripe = createStripeIntegration(userId);
        const paymentLinks = await stripe.listPaymentLinks(limit);
        res.json({ paymentLinks });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list payment links' });
    }
});

/**
 * POST /api/stripe/checkout-sessions
 * Create a checkout session
 */
router.post('/checkout-sessions', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { priceId, successUrl, cancelUrl, mode, quantity, customerEmail, metadata } = req.body;

    if (!priceId || !successUrl || !cancelUrl) {
        return res.status(400).json({ error: 'priceId, successUrl, and cancelUrl are required' });
    }

    try {
        const stripe = createStripeIntegration(userId);
        const session = await stripe.createCheckoutSession(priceId, successUrl, cancelUrl, {
            mode,
            quantity,
            customerEmail,
            metadata,
        });

        res.json({
            success: true,
            session,
            checkoutUrl: session.url,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

/**
 * POST /api/stripe/webhooks
 * Create a webhook endpoint
 */
router.post('/webhooks', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { url, events, description } = req.body;

    if (!url || !events) {
        return res.status(400).json({ error: 'url and events are required' });
    }

    try {
        const stripe = createStripeIntegration(userId);
        const webhook = await stripe.createWebhookEndpoint({ url, events, description });
        res.json({
            success: true,
            webhook,
            secret: webhook.secret, // Important: User needs this for verification
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create webhook endpoint' });
    }
});

/**
 * GET /api/stripe/webhooks
 * List webhook endpoints
 */
router.get('/webhooks', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    try {
        const stripe = createStripeIntegration(userId);
        const webhooks = await stripe.listWebhookEndpoints();
        res.json({ webhooks });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list webhooks' });
    }
});

/**
 * DELETE /api/stripe/webhooks/:endpointId
 * Delete webhook endpoint
 */
router.delete('/webhooks/:endpointId', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { endpointId } = req.params;

    try {
        const stripe = createStripeIntegration(userId);
        await stripe.deleteWebhookEndpoint(endpointId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete webhook' });
    }
});

/**
 * POST /api/stripe/customers
 * Create a customer
 */
router.post('/customers', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { email, name, metadata } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'email is required' });
    }

    try {
        const stripe = createStripeIntegration(userId);
        const customer = await stripe.createCustomer(email, name, metadata);
        res.json({ success: true, customer });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

/**
 * GET /api/stripe/customers
 * List customers
 */
router.get('/customers', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const email = req.query.email as string;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        const stripe = createStripeIntegration(userId);
        const customers = await stripe.listCustomers(limit, email);
        res.json({ customers });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list customers' });
    }
});

/**
 * POST /api/stripe/subscriptions
 * Create a subscription
 */
router.post('/subscriptions', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { customerId, priceId, trialPeriodDays, metadata } = req.body;

    if (!customerId || !priceId) {
        return res.status(400).json({ error: 'customerId and priceId are required' });
    }

    try {
        const stripe = createStripeIntegration(userId);
        const subscription = await stripe.createSubscription(customerId, priceId, {
            trialPeriodDays,
            metadata,
        });
        res.json({ success: true, subscription });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

/**
 * GET /api/stripe/subscriptions
 * List subscriptions
 */
router.get('/subscriptions', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const customerId = req.query.customerId as string;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
        const stripe = createStripeIntegration(userId);
        const subscriptions = await stripe.listSubscriptions(customerId, limit);
        res.json({ subscriptions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list subscriptions' });
    }
});

/**
 * DELETE /api/stripe/subscriptions/:subscriptionId
 * Cancel subscription
 */
router.delete('/subscriptions/:subscriptionId', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { subscriptionId } = req.params;
    const immediately = req.query.immediately === 'true';

    try {
        const stripe = createStripeIntegration(userId);
        const subscription = await stripe.cancelSubscription(subscriptionId, immediately);
        res.json({ success: true, subscription });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

/**
 * POST /api/stripe/setup
 * Complete setup: Create product, price, and payment link
 */
router.post('/setup', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const projectId = req.headers['x-project-id'] as string;
    const { name, description, images, price } = req.body;

    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }

    try {
        const stripe = createStripeIntegration(userId, projectId);
        const result = await stripe.setupProductWithPayment({
            name,
            description,
            images,
            price: {
                amount: price.amount,
                currency: price.currency || 'usd',
                recurring: price.recurring,
            },
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to complete setup',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /api/stripe/generate-code
 * Generate client-side code for Stripe integration
 */
router.post('/generate-code', ensureStripeConfigured, async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { priceId } = req.body;

    const vault = getCredentialVault();
    const creds = await vault.getCredential(userId, 'stripe');
    const publishableKey = creds?.data?.publishableKey as string;

    if (!publishableKey) {
        return res.status(400).json({ error: 'Stripe publishable key not configured' });
    }

    const clientCode = generateStripeClientCode(publishableKey, priceId || 'price_xxx');
    const webhookCode = generateStripeWebhookHandler();

    res.json({
        clientCode,
        webhookCode,
    });
});

export default router;

