/**
 * Stripe Billing Integration
 *
 * Handles subscription management, usage-based billing, and payments
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export interface StripeCustomer {
    id: string;
    email: string;
    name?: string;
    metadata?: Record<string, string>;
}

export interface StripeSubscription {
    id: string;
    customer: string;
    status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing';
    current_period_start: number;
    current_period_end: number;
    plan: {
        id: string;
        nickname: string;
        amount: number;
        interval: 'month' | 'year';
    };
}

export interface StripeUsageRecord {
    id: string;
    subscription_item: string;
    quantity: number;
    timestamp: number;
}

export interface BillingPlan {
    id: string;
    name: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    credits: number;
    features: string[];
    stripePriceIdMonthly: string;
    stripePriceIdYearly: string;
    badge?: string;
    highlighted?: boolean;
}

// KripTik AI Plans - Production Pricing (matched with Stripe products)
export const BILLING_PLANS: BillingPlan[] = [
    {
        id: 'free',
        name: 'Free',
        description: 'Explore AI-powered development',
        priceMonthly: 0,
        priceYearly: 0,
        credits: 50,
        features: [
            '50 credits to start',
            'Basic AI generation',
            'Builder mode only',
            '1 active project',
            'Community support',
            'Preview deployments',
        ],
        stripePriceIdMonthly: '',
        stripePriceIdYearly: '',
    },
    {
        id: 'starter',
        name: 'Starter',
        description: 'Perfect for hobby projects',
        priceMonthly: 29,
        priceYearly: 279, // 20% off
        credits: 300,
        features: [
            '300 credits/month',
            'Builder + Developer modes',
            '5 active projects',
            'Basic verification',
            'Email support',
            'Preview deployments',
            'GitHub export',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_1SbdJ72KRfBV8ELzlRjJh3ok',
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || 'price_1SbdJ82KRfBV8ELzgEFGtC4J',
    },
    {
        id: 'builder',
        name: 'Builder',
        description: 'For serious builders',
        priceMonthly: 59,
        priceYearly: 569, // 20% off
        credits: 800,
        badge: 'Popular',
        highlighted: true,
        features: [
            '800 credits/month',
            'All modes (Builder, Agents, Developer)',
            '15 active projects',
            'Full verification swarm',
            'Ghost Mode (background building)',
            'Priority support',
            'All integrations',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_BUILDER_MONTHLY || 'price_1SbdJ82KRfBV8ELz6kiKK5cW',
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUILDER_YEARLY || 'price_1SbdJ82KRfBV8ELzqkvXeoQQ',
    },
    {
        id: 'developer',
        name: 'Developer',
        description: 'Full-stack AI development',
        priceMonthly: 99,
        priceYearly: 950, // 20% off
        credits: 2000,
        features: [
            '2,000 credits/month',
            'Everything in Builder',
            '6 concurrent agents',
            'Unlimited projects',
            'Tournament mode',
            'Learning engine insights',
            'Pre-deployment validation',
            'Dedicated support',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_DEVELOPER_MONTHLY || 'price_1SbdJ82KRfBV8ELz81y23bnC',
        stripePriceIdYearly: process.env.STRIPE_PRICE_DEVELOPER_YEARLY || 'price_1SbdJ92KRfBV8ELzaCdBIzEe',
    },
    {
        id: 'pro',
        name: 'Pro',
        description: 'For teams & power users',
        priceMonthly: 199,
        priceYearly: 1900, // 20% off
        credits: 5000,
        badge: 'Best Value',
        features: [
            '5,000 credits/month',
            'Everything in Developer',
            'Team collaboration',
            'Custom integrations',
            'API access',
            'Dedicated account manager',
            'SLA guarantee',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_1SbdJ92KRfBV8ELzDKKzJZM3',
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_1SbdJ92KRfBV8ELzkYeubN3K',
    },
];

// Top-up credit packages (with actual Stripe price IDs)
export interface CreditTopUp {
    id: string;
    credits: number;
    price: number;
    label: string;
    pricePerCredit: number;
    stripePriceId: string;
    badge?: string;
}

export const CREDIT_TOPUPS: CreditTopUp[] = [
    {
        id: 'topup_100',
        credits: 100,
        price: 15,
        label: '$15 - 100 credits',
        pricePerCredit: 0.15,
        stripePriceId: process.env.STRIPE_TOPUP_TOPUP_100_PRICE || 'price_1SbdJ92KRfBV8ELzG1rqpBsp',
    },
    {
        id: 'topup_300',
        credits: 300,
        price: 39,
        label: '$39 - 300 credits',
        pricePerCredit: 0.13,
        stripePriceId: process.env.STRIPE_TOPUP_TOPUP_300_PRICE || 'price_1SbdJA2KRfBV8ELzRZn1AhFQ',
        badge: 'Popular',
    },
    {
        id: 'topup_500',
        credits: 500,
        price: 59,
        label: '$59 - 500 credits',
        pricePerCredit: 0.118,
        stripePriceId: process.env.STRIPE_TOPUP_TOPUP_500_PRICE || 'price_1SbdJA2KRfBV8ELzQvjnXqrF',
    },
    {
        id: 'topup_1000',
        credits: 1000,
        price: 99,
        label: '$99 - 1000 credits',
        pricePerCredit: 0.099,
        stripePriceId: process.env.STRIPE_TOPUP_TOPUP_1000_PRICE || 'price_1SbdJA2KRfBV8ELzFAwez6U5',
        badge: 'Best Value',
    },
    {
        id: 'topup_2500',
        credits: 2500,
        price: 199,
        label: '$199 - 2500 credits',
        pricePerCredit: 0.0796,
        stripePriceId: process.env.STRIPE_TOPUP_TOPUP_2500_PRICE || 'price_1SbdJB2KRfBV8ELzwV0RiS6y',
    },
];

/**
 * Stripe Billing Service
 */
export class StripeBillingService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(`${STRIPE_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `Stripe API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Create a customer
     */
    async createCustomer(data: {
        email: string;
        name?: string;
        metadata?: Record<string, string>;
    }): Promise<StripeCustomer> {
        const body = new URLSearchParams({
            email: data.email,
            ...(data.name && { name: data.name }),
        });

        if (data.metadata) {
            for (const [key, value] of Object.entries(data.metadata)) {
                body.append(`metadata[${key}]`, value);
            }
        }

        return this.request<StripeCustomer>('/customers', {
            method: 'POST',
            body: body.toString(),
        });
    }

    /**
     * Get customer
     */
    async getCustomer(customerId: string): Promise<StripeCustomer> {
        return this.request<StripeCustomer>(`/customers/${customerId}`);
    }

    /**
     * Create a subscription
     */
    async createSubscription(data: {
        customerId: string;
        priceId: string;
        trialDays?: number;
    }): Promise<StripeSubscription> {
        const body = new URLSearchParams({
            customer: data.customerId,
            'items[0][price]': data.priceId,
        });

        if (data.trialDays) {
            body.append('trial_period_days', data.trialDays.toString());
        }

        return this.request<StripeSubscription>('/subscriptions', {
            method: 'POST',
            body: body.toString(),
        });
    }

    /**
     * Get subscription
     */
    async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
        return this.request<StripeSubscription>(`/subscriptions/${subscriptionId}`);
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId: string): Promise<StripeSubscription> {
        return this.request<StripeSubscription>(`/subscriptions/${subscriptionId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Update subscription (change plan)
     */
    async updateSubscription(
        subscriptionId: string,
        newPriceId: string
    ): Promise<StripeSubscription> {
        const sub = await this.getSubscription(subscriptionId);
        const itemId = (sub as any).items?.data?.[0]?.id;

        if (!itemId) {
            throw new Error('Subscription item not found');
        }

        const body = new URLSearchParams({
            [`items[0][id]`]: itemId,
            [`items[0][price]`]: newPriceId,
            proration_behavior: 'create_prorations',
        });

        return this.request<StripeSubscription>(`/subscriptions/${subscriptionId}`, {
            method: 'POST',
            body: body.toString(),
        });
    }

    /**
     * Create one-time payment for credit top-up
     */
    async createTopUpSession(data: {
        customerId: string;
        topUpId: string;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{ id: string; url: string }> {
        const topUp = CREDIT_TOPUPS.find(t => t.id === data.topUpId);
        if (!topUp) {
            throw new Error('Invalid top-up package');
        }

        // Use pre-created Stripe price if available, otherwise create dynamically
        const body = topUp.stripePriceId
            ? new URLSearchParams({
                customer: data.customerId,
                'line_items[0][price]': topUp.stripePriceId,
                'line_items[0][quantity]': '1',
                mode: 'payment',
                success_url: data.successUrl,
                cancel_url: data.cancelUrl,
                [`metadata[topup_id]`]: data.topUpId,
                [`metadata[credits]`]: topUp.credits.toString(),
            })
            : new URLSearchParams({
                customer: data.customerId,
                'line_items[0][price_data][currency]': 'usd',
                'line_items[0][price_data][product_data][name]': `${topUp.credits} Credits`,
                'line_items[0][price_data][product_data][description]': `Credit top-up for KripTik AI`,
                'line_items[0][price_data][unit_amount]': (topUp.price * 100).toString(),
                'line_items[0][quantity]': '1',
                mode: 'payment',
                success_url: data.successUrl,
                cancel_url: data.cancelUrl,
                [`metadata[topup_id]`]: data.topUpId,
                [`metadata[credits]`]: topUp.credits.toString(),
            });

        return this.request<{ id: string; url: string }>('/checkout/sessions', {
            method: 'POST',
            body: body.toString(),
        });
    }

    /**
     * Get available top-up packages
     */
    getTopUps(): CreditTopUp[] {
        return CREDIT_TOPUPS;
    }

    /**
     * Record usage for usage-based billing
     */
    async recordUsage(
        subscriptionItemId: string,
        quantity: number,
        timestamp?: number
    ): Promise<StripeUsageRecord> {
        const body = new URLSearchParams({
            quantity: quantity.toString(),
            timestamp: (timestamp || Math.floor(Date.now() / 1000)).toString(),
            action: 'increment',
        });

        return this.request<StripeUsageRecord>(
            `/subscription_items/${subscriptionItemId}/usage_records`,
            {
                method: 'POST',
                body: body.toString(),
            }
        );
    }

    /**
     * Create a checkout session
     */
    async createCheckoutSession(data: {
        customerId: string;
        priceId: string;
        successUrl: string;
        cancelUrl: string;
        trialDays?: number;
    }): Promise<{ id: string; url: string }> {
        const body = new URLSearchParams({
            customer: data.customerId,
            'line_items[0][price]': data.priceId,
            'line_items[0][quantity]': '1',
            mode: 'subscription',
            success_url: data.successUrl,
            cancel_url: data.cancelUrl,
        });

        if (data.trialDays) {
            body.append('subscription_data[trial_period_days]', data.trialDays.toString());
        }

        return this.request<{ id: string; url: string }>('/checkout/sessions', {
            method: 'POST',
            body: body.toString(),
        });
    }

    /**
     * Create a billing portal session
     */
    async createPortalSession(data: {
        customerId: string;
        returnUrl: string;
    }): Promise<{ id: string; url: string }> {
        const body = new URLSearchParams({
            customer: data.customerId,
            return_url: data.returnUrl,
        });

        return this.request<{ id: string; url: string }>('/billing_portal/sessions', {
            method: 'POST',
            body: body.toString(),
        });
    }

    /**
     * Get invoices
     */
    async getInvoices(customerId: string): Promise<{ data: any[] }> {
        return this.request<{ data: any[] }>(
            `/invoices?customer=${customerId}&limit=10`
        );
    }

    /**
     * Validate API key
     */
    async validateKey(): Promise<boolean> {
        try {
            await this.request('/customers?limit=1');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get plan by ID
     */
    getPlan(planId: string): BillingPlan | undefined {
        return BILLING_PLANS.find(p => p.id === planId);
    }

    /**
     * Get all plans
     */
    getPlans(): BillingPlan[] {
        return BILLING_PLANS;
    }
}

/**
 * Create a Stripe billing service instance
 */
export function createStripeBillingService(apiKey: string): StripeBillingService {
    return new StripeBillingService(apiKey);
}
