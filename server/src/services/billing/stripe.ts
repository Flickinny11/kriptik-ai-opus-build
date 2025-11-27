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

// KripTik AI Plans - Updated tiers
export const BILLING_PLANS: BillingPlan[] = [
    {
        id: 'free',
        name: 'Free',
        description: 'Explore AI-powered development',
        priceMonthly: 0,
        priceYearly: 0,
        credits: 25,
        features: [
            '25 credits to start',
            'Basic AI generation',
            'Frontend builds only',
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
        priceMonthly: 19,
        priceYearly: 190,
        credits: 200,
        features: [
            '200 credits/month',
            'AI code generation',
            'Frontend + basic backend',
            '3 active projects',
            'Email support',
            'Preview deployments',
            'Basic integrations (auth, database)',
            'Export to GitHub',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
    },
    {
        id: 'builder',
        name: 'Builder',
        description: 'For serious builders',
        priceMonthly: 39,
        priceYearly: 390,
        credits: 500,
        features: [
            '500 credits/month',
            'Everything in Starter',
            'Full backend development',
            '10 active projects',
            'Priority email support',
            'Production deployments',
            'Advanced integrations',
            'Image-to-code generation',
            'Custom themes',
            'API access',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_BUILDER_MONTHLY || '',
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUILDER_YEARLY || '',
        badge: 'Popular',
        highlighted: true,
    },
    {
        id: 'developer',
        name: 'Developer',
        description: 'Full-stack AI development',
        priceMonthly: 59,
        priceYearly: 590,
        credits: 1000,
        features: [
            '1,000 credits/month',
            'Everything in Builder',
            'GPU deployments (RunPod)',
            'Unlimited projects',
            'Priority support',
            'Container orchestration',
            'Multi-model workflows',
            'Self-healing apps',
            'Custom domains',
            'Team sharing (up to 3)',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_DEVELOPER_MONTHLY || '',
        stripePriceIdYearly: process.env.STRIPE_PRICE_DEVELOPER_YEARLY || '',
    },
    {
        id: 'pro',
        name: 'Pro',
        description: 'For power users & teams',
        priceMonthly: 89,
        priceYearly: 890,
        credits: 2500,
        features: [
            '2,500 credits/month',
            'Everything in Developer',
            'Dedicated GPU instances',
            'White-label option',
            '24/7 priority support',
            'Custom AI training',
            'Advanced analytics',
            'Team collaboration (unlimited)',
            'SSO/SAML',
            'SLA guarantee',
            'Early access to features',
        ],
        stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
        badge: 'Best Value',
    },
];

// Top-up credit packages
export const CREDIT_TOPUPS = [
    { id: 'topup_5', credits: 25, price: 5, label: '$5 - 25 credits' },
    { id: 'topup_10', credits: 55, price: 10, label: '$10 - 55 credits', badge: '+10% bonus' },
    { id: 'topup_25', credits: 150, price: 25, label: '$25 - 150 credits', badge: '+20% bonus' },
    { id: 'topup_50', credits: 325, price: 50, label: '$50 - 325 credits', badge: '+30% bonus' },
    { id: 'topup_100', credits: 700, price: 100, label: '$100 - 700 credits', badge: '+40% bonus' },
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

        const body = new URLSearchParams({
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

    /**
     * Get credit top-up packages
     */
    getTopUps() {
        return CREDIT_TOPUPS;
    }
}

/**
 * Create a Stripe billing service instance
 */
export function createStripeBillingService(apiKey: string): StripeBillingService {
    return new StripeBillingService(apiKey);
}
