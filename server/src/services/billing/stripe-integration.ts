/**
 * Stripe Integration Service
 *
 * Allows KripTik AI users to integrate their own Stripe accounts.
 * Users provide their API keys, and we help them:
 * - Create products and prices
 * - Set up payment links
 * - Configure webhooks
 * - Manage subscriptions
 *
 * This is NOT for KripTik's billing - it's for users' projects.
 */

import Stripe from 'stripe';
import { getCredentialVault } from '../security/credential-vault.js';

// ============================================================================
// TYPES
// ============================================================================

export interface StripeCredentials {
    secretKey: string;
    publishableKey: string;
    webhookSecret?: string;
}

export interface CreateProductRequest {
    name: string;
    description?: string;
    images?: string[];
    metadata?: Record<string, string>;
    // Price configuration
    price: {
        amount: number; // In cents
        currency: string;
        recurring?: {
            interval: 'day' | 'week' | 'month' | 'year';
            interval_count?: number;
        };
    };
}

export interface CreatePaymentLinkRequest {
    priceId: string;
    quantity?: number;
    afterCompletion?: {
        type: 'redirect' | 'hosted_confirmation';
        redirect?: { url: string };
    };
    metadata?: Record<string, string>;
}

export interface WebhookEndpointRequest {
    url: string;
    events: string[];
    description?: string;
}

export interface StripeSetupResult {
    success: boolean;
    product?: Stripe.Product;
    price?: Stripe.Price;
    paymentLink?: Stripe.PaymentLink;
    webhookEndpoint?: Stripe.WebhookEndpoint;
    checkoutUrl?: string;
    errors?: string[];
}

// ============================================================================
// SERVICE
// ============================================================================

export class StripeIntegrationService {
    private userId: string;
    private projectId?: string;

    constructor(userId: string, projectId?: string) {
        this.userId = userId;
        this.projectId = projectId;
    }

    /**
     * Get Stripe client for user's credentials
     */
    private async getStripeClient(): Promise<Stripe> {
        const vault = getCredentialVault();
        const creds = await vault.getCredential(this.userId, 'stripe');

        if (!creds?.data?.secretKey) {
            throw new Error('Stripe credentials not configured. Please add your Stripe secret key.');
        }

        return new Stripe(creds.data.secretKey as string);
    }

    // ========================================================================
    // PRODUCTS
    // ========================================================================

    /**
     * Create a product with associated price
     */
    async createProduct(request: CreateProductRequest): Promise<{
        product: Stripe.Product;
        price: Stripe.Price;
    }> {
        const stripe = await this.getStripeClient();

        // Create product
        const product = await stripe.products.create({
            name: request.name,
            description: request.description,
            images: request.images,
            metadata: {
                ...request.metadata,
                created_by: 'kriptik_ai',
                project_id: this.projectId || '',
            },
        });

        // Create price
        const priceParams: Stripe.PriceCreateParams = {
            product: product.id,
            unit_amount: request.price.amount,
            currency: request.price.currency,
            metadata: {
                created_by: 'kriptik_ai',
            },
        };

        if (request.price.recurring) {
            priceParams.recurring = {
                interval: request.price.recurring.interval,
                interval_count: request.price.recurring.interval_count,
            };
        }

        const price = await stripe.prices.create(priceParams);

        return { product, price };
    }

    /**
     * List products
     */
    async listProducts(limit = 10): Promise<Stripe.Product[]> {
        const stripe = await this.getStripeClient();
        const products = await stripe.products.list({ limit, active: true });
        return products.data;
    }

    /**
     * Get product with prices
     */
    async getProduct(productId: string): Promise<{
        product: Stripe.Product;
        prices: Stripe.Price[];
    }> {
        const stripe = await this.getStripeClient();
        const product = await stripe.products.retrieve(productId);
        const prices = await stripe.prices.list({ product: productId, active: true });
        return { product, prices: prices.data };
    }

    /**
     * Update product
     */
    async updateProduct(
        productId: string,
        updates: { name?: string; description?: string; active?: boolean }
    ): Promise<Stripe.Product> {
        const stripe = await this.getStripeClient();
        return stripe.products.update(productId, updates);
    }

    /**
     * Archive product
     */
    async archiveProduct(productId: string): Promise<Stripe.Product> {
        const stripe = await this.getStripeClient();
        return stripe.products.update(productId, { active: false });
    }

    // ========================================================================
    // PRICES
    // ========================================================================

    /**
     * Create a new price for existing product
     */
    async createPrice(
        productId: string,
        amount: number,
        currency: string,
        recurring?: { interval: 'day' | 'week' | 'month' | 'year'; interval_count?: number }
    ): Promise<Stripe.Price> {
        const stripe = await this.getStripeClient();

        const params: Stripe.PriceCreateParams = {
            product: productId,
            unit_amount: amount,
            currency,
        };

        if (recurring) {
            params.recurring = {
                interval: recurring.interval,
                interval_count: recurring.interval_count,
            };
        }

        return stripe.prices.create(params);
    }

    /**
     * List prices for a product
     */
    async listPrices(productId?: string, limit = 10): Promise<Stripe.Price[]> {
        const stripe = await this.getStripeClient();
        const params: Stripe.PriceListParams = { limit, active: true };
        if (productId) params.product = productId;
        const prices = await stripe.prices.list(params);
        return prices.data;
    }

    // ========================================================================
    // PAYMENT LINKS
    // ========================================================================

    /**
     * Create a payment link
     */
    async createPaymentLink(request: CreatePaymentLinkRequest): Promise<Stripe.PaymentLink> {
        const stripe = await this.getStripeClient();

        const params: Stripe.PaymentLinkCreateParams = {
            line_items: [{
                price: request.priceId,
                quantity: request.quantity || 1,
            }],
            metadata: {
                ...request.metadata,
                created_by: 'kriptik_ai',
            },
        };

        if (request.afterCompletion) {
            params.after_completion = {
                type: request.afterCompletion.type,
            };
            if (request.afterCompletion.redirect) {
                params.after_completion.redirect = request.afterCompletion.redirect;
            }
        }

        return stripe.paymentLinks.create(params);
    }

    /**
     * List payment links
     */
    async listPaymentLinks(limit = 10): Promise<Stripe.PaymentLink[]> {
        const stripe = await this.getStripeClient();
        const links = await stripe.paymentLinks.list({ limit, active: true });
        return links.data;
    }

    /**
     * Deactivate payment link
     */
    async deactivatePaymentLink(linkId: string): Promise<Stripe.PaymentLink> {
        const stripe = await this.getStripeClient();
        return stripe.paymentLinks.update(linkId, { active: false });
    }

    // ========================================================================
    // CHECKOUT SESSIONS
    // ========================================================================

    /**
     * Create a checkout session
     */
    async createCheckoutSession(
        priceId: string,
        successUrl: string,
        cancelUrl: string,
        options?: {
            mode?: 'payment' | 'subscription';
            quantity?: number;
            customerEmail?: string;
            metadata?: Record<string, string>;
        }
    ): Promise<Stripe.Checkout.Session> {
        const stripe = await this.getStripeClient();

        return stripe.checkout.sessions.create({
            mode: options?.mode || 'payment',
            line_items: [{
                price: priceId,
                quantity: options?.quantity || 1,
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: options?.customerEmail,
            metadata: {
                ...options?.metadata,
                created_by: 'kriptik_ai',
            },
        });
    }

    // ========================================================================
    // WEBHOOKS
    // ========================================================================

    /**
     * Create a webhook endpoint
     */
    async createWebhookEndpoint(request: WebhookEndpointRequest): Promise<Stripe.WebhookEndpoint> {
        const stripe = await this.getStripeClient();

        return stripe.webhookEndpoints.create({
            url: request.url,
            enabled_events: request.events as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
            description: request.description,
            metadata: {
                created_by: 'kriptik_ai',
            },
        });
    }

    /**
     * List webhook endpoints
     */
    async listWebhookEndpoints(limit = 10): Promise<Stripe.WebhookEndpoint[]> {
        const stripe = await this.getStripeClient();
        const endpoints = await stripe.webhookEndpoints.list({ limit });
        return endpoints.data;
    }

    /**
     * Delete webhook endpoint
     */
    async deleteWebhookEndpoint(endpointId: string): Promise<void> {
        const stripe = await this.getStripeClient();
        await stripe.webhookEndpoints.del(endpointId);
    }

    // ========================================================================
    // CUSTOMERS
    // ========================================================================

    /**
     * Create a customer
     */
    async createCustomer(
        email: string,
        name?: string,
        metadata?: Record<string, string>
    ): Promise<Stripe.Customer> {
        const stripe = await this.getStripeClient();
        return stripe.customers.create({
            email,
            name,
            metadata: {
                ...metadata,
                created_by: 'kriptik_ai',
            },
        });
    }

    /**
     * List customers
     */
    async listCustomers(limit = 10, email?: string): Promise<Stripe.Customer[]> {
        const stripe = await this.getStripeClient();
        const params: Stripe.CustomerListParams = { limit };
        if (email) params.email = email;
        const customers = await stripe.customers.list(params);
        return customers.data;
    }

    // ========================================================================
    // SUBSCRIPTIONS
    // ========================================================================

    /**
     * Create a subscription
     */
    async createSubscription(
        customerId: string,
        priceId: string,
        options?: {
            trialPeriodDays?: number;
            metadata?: Record<string, string>;
        }
    ): Promise<Stripe.Subscription> {
        const stripe = await this.getStripeClient();

        return stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            trial_period_days: options?.trialPeriodDays,
            metadata: {
                ...options?.metadata,
                created_by: 'kriptik_ai',
            },
        });
    }

    /**
     * List subscriptions for a customer
     */
    async listSubscriptions(customerId?: string, limit = 10): Promise<Stripe.Subscription[]> {
        const stripe = await this.getStripeClient();
        const params: Stripe.SubscriptionListParams = { limit };
        if (customerId) params.customer = customerId;
        const subs = await stripe.subscriptions.list(params);
        return subs.data;
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(
        subscriptionId: string,
        immediately = false
    ): Promise<Stripe.Subscription> {
        const stripe = await this.getStripeClient();

        if (immediately) {
            return stripe.subscriptions.cancel(subscriptionId);
        }

        return stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true,
        });
    }

    // ========================================================================
    // COMPLETE SETUP FLOW
    // ========================================================================

    /**
     * Complete setup: Create product, price, and payment link in one call
     */
    async setupProductWithPayment(request: CreateProductRequest): Promise<StripeSetupResult> {
        const errors: string[] = [];
        let product: Stripe.Product | undefined;
        let price: Stripe.Price | undefined;
        let paymentLink: Stripe.PaymentLink | undefined;

        try {
            // Create product and price
            const created = await this.createProduct(request);
            product = created.product;
            price = created.price;

            // Create payment link
            paymentLink = await this.createPaymentLink({
                priceId: price.id,
                afterCompletion: {
                    type: 'hosted_confirmation',
                },
            });

            return {
                success: true,
                product,
                price,
                paymentLink,
                checkoutUrl: paymentLink.url,
            };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
            return {
                success: false,
                product,
                price,
                paymentLink,
                errors,
            };
        }
    }

    /**
     * Setup subscription product with checkout
     */
    async setupSubscription(
        productName: string,
        monthlyPriceCents: number,
        currency: string,
        successUrl: string,
        cancelUrl: string
    ): Promise<{
        product: Stripe.Product;
        price: Stripe.Price;
        checkoutSession: Stripe.Checkout.Session;
    }> {
        // Create product with recurring price
        const { product, price } = await this.createProduct({
            name: productName,
            price: {
                amount: monthlyPriceCents,
                currency,
                recurring: { interval: 'month' },
            },
        });

        // Create checkout session
        const checkoutSession = await this.createCheckoutSession(
            price.id,
            successUrl,
            cancelUrl,
            { mode: 'subscription' }
        );

        return { product, price, checkoutSession };
    }

    // ========================================================================
    // ACCOUNT INFO
    // ========================================================================

    /**
     * Get account information
     */
    async getAccountInfo(): Promise<Stripe.Account> {
        const stripe = await this.getStripeClient();
        return stripe.accounts.retrieve();
    }

    /**
     * Get balance
     */
    async getBalance(): Promise<Stripe.Balance> {
        const stripe = await this.getStripeClient();
        return stripe.balance.retrieve();
    }

    /**
     * Test connection
     */
    async testConnection(): Promise<{ success: boolean; accountName?: string; error?: string }> {
        try {
            const account = await this.getAccountInfo();
            return {
                success: true,
                accountName: account.business_profile?.name || account.email || 'Connected',
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createStripeIntegration(userId: string, projectId?: string): StripeIntegrationService {
    return new StripeIntegrationService(userId, projectId);
}

// ============================================================================
// CODE GENERATION (for user's frontend integration)
// ============================================================================

export function generateStripeClientCode(publishableKey: string, priceId: string): string {
    return `
// Stripe Client Integration
// Generated by KripTik AI

import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('${publishableKey}');

export async function redirectToCheckout() {
  const stripe = await stripePromise;
  if (!stripe) throw new Error('Stripe not loaded');

  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: '${priceId}', quantity: 1 }],
    mode: 'payment',
    successUrl: window.location.origin + '/success',
    cancelUrl: window.location.origin + '/cancel',
  });

  if (error) {
    console.error('Checkout error:', error);
    throw error;
  }
}

// Usage in your component:
// <button onClick={redirectToCheckout}>Buy Now</button>
`.trim();
}

export function generateStripeWebhookHandler(): string {
    return `
// Stripe Webhook Handler
// Generated by KripTik AI

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function handleStripeWebhook(
  body: string | Buffer,
  signature: string
): Promise<{ received: boolean; event?: string }> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    throw new Error(\`Webhook signature verification failed: \${err}\`);
  }

  // Handle specific events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // Handle successful checkout
      console.log('Payment successful:', session.id);
      // TODO: Fulfill order, update database, send confirmation
      break;
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;
      // Handle new subscription
      console.log('Subscription created:', subscription.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      // Handle subscription cancellation
      console.log('Subscription cancelled:', subscription.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      // Handle failed payment
      console.log('Payment failed:', invoice.id);
      break;
    }

    default:
      console.log(\`Unhandled event type: \${event.type}\`);
  }

  return { received: true, event: event.type };
}
`.trim();
}

