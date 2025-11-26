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
}

// KripTik AI Plans
export const BILLING_PLANS: BillingPlan[] = [
    {
        id: 'free',
        name: 'Free',
        description: 'Get started with AI-powered development',
        priceMonthly: 0,
        priceYearly: 0,
        credits: 50,
        features: [
            '50 credits/month',
            'Basic AI generation',
            'Community support',
            '1 project',
        ],
        stripePriceIdMonthly: '',
        stripePriceIdYearly: '',
    },
    {
        id: 'pro',
        name: 'Pro',
        description: 'For individual developers',
        priceMonthly: 29,
        priceYearly: 290,
        credits: 1000,
        features: [
            '1,000 credits/month',
            'Advanced AI features',
            'Priority support',
            'Unlimited projects',
            'Cloud deployments',
            'Custom integrations',
        ],
        stripePriceIdMonthly: 'price_pro_monthly',
        stripePriceIdYearly: 'price_pro_yearly',
    },
    {
        id: 'team',
        name: 'Team',
        description: 'For teams and organizations',
        priceMonthly: 99,
        priceYearly: 990,
        credits: 5000,
        features: [
            '5,000 credits/month',
            'All Pro features',
            'Team collaboration',
            'Admin dashboard',
            'SSO/SAML',
            'SLA guarantee',
            'Dedicated support',
        ],
        stripePriceIdMonthly: 'price_team_monthly',
        stripePriceIdYearly: 'price_team_yearly',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Custom solutions for large organizations',
        priceMonthly: 0, // Custom pricing
        priceYearly: 0,
        credits: -1, // Unlimited
        features: [
            'Unlimited credits',
            'All Team features',
            'On-premise deployment',
            'Custom AI training',
            'Dedicated infrastructure',
            'White-label option',
            '24/7 support',
        ],
        stripePriceIdMonthly: '',
        stripePriceIdYearly: '',
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
        // First get the subscription to find the item ID
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

