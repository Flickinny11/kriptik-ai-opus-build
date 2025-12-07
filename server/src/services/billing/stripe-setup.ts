/**
 * Stripe Complete Setup Service
 * 
 * Creates all Stripe products, prices, webhooks, and top-ups
 * programmatically. Run once to initialize, then use the generated IDs.
 * 
 * KripTik AI Billing Tiers:
 * - Free: 50 credits/month (for trial)
 * - Starter: $29/month - 300 credits (hobby projects)
 * - Builder: $59/month - 800 credits (serious builders)
 * - Developer: $99/month - 2000 credits (full-stack AI dev)
 * - Pro: $199/month - 5000 credits (teams & power users)
 * - Enterprise: Custom pricing
 * 
 * Top-ups:
 * - 100 credits: $15 (15¢/credit)
 * - 300 credits: $39 (13¢/credit)
 * - 500 credits: $59 (12¢/credit)
 * - 1000 credits: $99 (10¢/credit)
 * - 2500 credits: $199 (8¢/credit)
 */

import Stripe from 'stripe';

// =============================================================================
// BILLING CONFIGURATION
// =============================================================================

export const KRIPTIK_BILLING_CONFIG = {
    plans: [
        {
            id: 'free',
            name: 'KripTik AI Free',
            description: 'Get started with AI development - 50 credits/month',
            monthlyPrice: 0,
            yearlyPrice: 0,
            creditsPerMonth: 50,
            features: [
                '50 credits/month',
                'Basic Builder mode',
                '1 project',
                'Community support',
            ],
        },
        {
            id: 'starter',
            name: 'KripTik AI Starter',
            description: 'Perfect for hobby projects - 300 credits/month',
            monthlyPrice: 2900, // $29
            yearlyPrice: 27900, // $279 (20% off)
            creditsPerMonth: 300,
            features: [
                '300 credits/month',
                'Builder + Developer modes',
                '5 projects',
                'Basic verification',
                'Email support',
            ],
        },
        {
            id: 'builder',
            name: 'KripTik AI Builder',
            description: 'For serious builders - 800 credits/month',
            monthlyPrice: 5900, // $59
            yearlyPrice: 56900, // $569 (20% off)
            creditsPerMonth: 800,
            features: [
                '800 credits/month',
                'All modes (Builder, Agents, Developer)',
                '15 projects',
                'Full verification swarm',
                'Ghost Mode (background building)',
                'Priority support',
            ],
        },
        {
            id: 'developer',
            name: 'KripTik AI Developer',
            description: 'Full-stack AI development - 2000 credits/month',
            monthlyPrice: 9900, // $99
            yearlyPrice: 95000, // $950 (20% off)
            creditsPerMonth: 2000,
            features: [
                '2000 credits/month',
                'All modes + 6 concurrent agents',
                'Unlimited projects',
                'Tournament mode',
                'Learning engine insights',
                'Pre-deployment validation',
                'Dedicated support',
            ],
        },
        {
            id: 'pro',
            name: 'KripTik AI Pro',
            description: 'For teams & power users - 5000 credits/month',
            monthlyPrice: 19900, // $199
            yearlyPrice: 190000, // $1900 (20% off)
            creditsPerMonth: 5000,
            features: [
                '5000 credits/month',
                'Everything in Developer',
                'Team collaboration',
                'Custom integrations',
                'API access',
                'Dedicated account manager',
            ],
        },
    ],
    topups: [
        {
            id: 'topup_100',
            name: '100 Credits',
            description: 'Quick top-up for small tasks',
            price: 1500, // $15
            credits: 100,
            pricePerCredit: 0.15,
        },
        {
            id: 'topup_300',
            name: '300 Credits',
            description: 'Popular choice for active builders',
            price: 3900, // $39
            credits: 300,
            pricePerCredit: 0.13,
            badge: 'Popular',
        },
        {
            id: 'topup_500',
            name: '500 Credits',
            description: 'Best for serious projects',
            price: 5900, // $59
            credits: 500,
            pricePerCredit: 0.118,
        },
        {
            id: 'topup_1000',
            name: '1000 Credits',
            description: 'Great value for power users',
            price: 9900, // $99
            credits: 1000,
            pricePerCredit: 0.099,
            badge: 'Best Value',
        },
        {
            id: 'topup_2500',
            name: '2500 Credits',
            description: 'Maximum savings for teams',
            price: 19900, // $199
            credits: 2500,
            pricePerCredit: 0.0796,
        },
    ],
};

// =============================================================================
// SETUP SERVICE
// =============================================================================

export interface StripeSetupResult {
    success: boolean;
    products: Record<string, {
        productId: string;
        monthlyPriceId?: string;
        yearlyPriceId?: string;
    }>;
    topups: Record<string, {
        productId: string;
        priceId: string;
    }>;
    webhook?: {
        id: string;
        secret: string;
        url: string;
    };
    envVariables: string[];
    errors: string[];
}

export class StripeSetupService {
    private stripe: Stripe;

    constructor(secretKey: string) {
        this.stripe = new Stripe(secretKey);
    }

    /**
     * Complete setup: Create all products, prices, and webhook
     */
    async completeSetup(webhookUrl: string): Promise<StripeSetupResult> {
        const result: StripeSetupResult = {
            success: false,
            products: {},
            topups: {},
            envVariables: [],
            errors: [],
        };

        try {
            // 1. Create subscription products and prices
            console.log('[Stripe Setup] Creating subscription products...');
            for (const plan of KRIPTIK_BILLING_CONFIG.plans) {
                if (plan.monthlyPrice === 0) continue; // Skip free tier

                try {
                    const product = await this.stripe.products.create({
                        name: plan.name,
                        description: plan.description,
                        metadata: {
                            plan_id: plan.id,
                            credits_per_month: String(plan.creditsPerMonth),
                            features: JSON.stringify(plan.features),
                            created_by: 'kriptik_ai_setup',
                        },
                    });

                    const monthlyPrice = await this.stripe.prices.create({
                        product: product.id,
                        unit_amount: plan.monthlyPrice,
                        currency: 'usd',
                        recurring: { interval: 'month' },
                        metadata: {
                            plan_id: plan.id,
                            interval: 'monthly',
                        },
                    });

                    const yearlyPrice = await this.stripe.prices.create({
                        product: product.id,
                        unit_amount: plan.yearlyPrice,
                        currency: 'usd',
                        recurring: { interval: 'year' },
                        metadata: {
                            plan_id: plan.id,
                            interval: 'yearly',
                        },
                    });

                    result.products[plan.id] = {
                        productId: product.id,
                        monthlyPriceId: monthlyPrice.id,
                        yearlyPriceId: yearlyPrice.id,
                    };

                    result.envVariables.push(
                        `STRIPE_PRODUCT_${plan.id.toUpperCase()}=${product.id}`,
                        `STRIPE_PRICE_${plan.id.toUpperCase()}_MONTHLY=${monthlyPrice.id}`,
                        `STRIPE_PRICE_${plan.id.toUpperCase()}_YEARLY=${yearlyPrice.id}`,
                    );

                    console.log(`[Stripe Setup] Created ${plan.name}`);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    result.errors.push(`Failed to create ${plan.name}: ${msg}`);
                }
            }

            // 2. Create top-up products and prices
            console.log('[Stripe Setup] Creating top-up products...');
            for (const topup of KRIPTIK_BILLING_CONFIG.topups) {
                try {
                    const product = await this.stripe.products.create({
                        name: `KripTik AI ${topup.name}`,
                        description: topup.description,
                        metadata: {
                            topup_id: topup.id,
                            credits: String(topup.credits),
                            price_per_credit: String(topup.pricePerCredit),
                            badge: topup.badge || '',
                            created_by: 'kriptik_ai_setup',
                        },
                    });

                    const price = await this.stripe.prices.create({
                        product: product.id,
                        unit_amount: topup.price,
                        currency: 'usd',
                        metadata: {
                            topup_id: topup.id,
                            credits: String(topup.credits),
                        },
                    });

                    result.topups[topup.id] = {
                        productId: product.id,
                        priceId: price.id,
                    };

                    result.envVariables.push(
                        `STRIPE_TOPUP_${topup.id.toUpperCase()}_PRICE=${price.id}`,
                    );

                    console.log(`[Stripe Setup] Created ${topup.name}`);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    result.errors.push(`Failed to create top-up ${topup.name}: ${msg}`);
                }
            }

            // 3. Create webhook endpoint
            console.log('[Stripe Setup] Creating webhook endpoint...');
            try {
                const webhook = await this.stripe.webhookEndpoints.create({
                    url: webhookUrl,
                    enabled_events: [
                        'checkout.session.completed',
                        'customer.subscription.created',
                        'customer.subscription.updated',
                        'customer.subscription.deleted',
                        'invoice.payment_succeeded',
                        'invoice.payment_failed',
                        'payment_intent.succeeded',
                        'payment_intent.payment_failed',
                    ],
                    description: 'KripTik AI Billing Webhook',
                    metadata: {
                        created_by: 'kriptik_ai_setup',
                    },
                });

                result.webhook = {
                    id: webhook.id,
                    secret: webhook.secret || '',
                    url: webhookUrl,
                };

                result.envVariables.push(
                    `STRIPE_WEBHOOK_ID=${webhook.id}`,
                    `STRIPE_WEBHOOK_SECRET=${webhook.secret}`,
                );

                console.log(`[Stripe Setup] Created webhook: ${webhook.id}`);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                result.errors.push(`Failed to create webhook: ${msg}`);
            }

            result.success = result.errors.length === 0;

            console.log('[Stripe Setup] Complete!');
            console.log(`Products created: ${Object.keys(result.products).length}`);
            console.log(`Top-ups created: ${Object.keys(result.topups).length}`);
            console.log(`Errors: ${result.errors.length}`);

            return result;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Setup failed: ${msg}`);
            return result;
        }
    }

    /**
     * Check if products already exist
     */
    async checkExistingProducts(): Promise<{
        hasProducts: boolean;
        productCount: number;
        products: Stripe.Product[];
    }> {
        const products = await this.stripe.products.list({
            limit: 100,
            active: true,
        });

        const kriptikProducts = products.data.filter(p =>
            p.metadata?.created_by === 'kriptik_ai_setup'
        );

        return {
            hasProducts: kriptikProducts.length > 0,
            productCount: kriptikProducts.length,
            products: kriptikProducts,
        };
    }

    /**
     * Clean up all KripTik products (for reset)
     */
    async cleanupProducts(): Promise<{ archived: number; errors: string[] }> {
        const errors: string[] = [];
        let archived = 0;

        const products = await this.stripe.products.list({
            limit: 100,
            active: true,
        });

        for (const product of products.data) {
            if (product.metadata?.created_by === 'kriptik_ai_setup') {
                try {
                    // Archive all prices first
                    const prices = await this.stripe.prices.list({
                        product: product.id,
                        active: true,
                    });

                    for (const price of prices.data) {
                        await this.stripe.prices.update(price.id, { active: false });
                    }

                    // Archive product
                    await this.stripe.products.update(product.id, { active: false });
                    archived++;
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    errors.push(`Failed to archive ${product.name}: ${msg}`);
                }
            }
        }

        return { archived, errors };
    }
}

// =============================================================================
// CREDIT COST CALCULATION (for accurate billing)
// =============================================================================

export const CREDIT_COSTS = {
    // AI Model Costs (per 1K tokens, converted to credits)
    ai: {
        'claude-opus-4.5': { input: 15, output: 75 },      // Premium model
        'claude-sonnet-4.5': { input: 3, output: 15 },     // Standard model
        'claude-haiku-3.5': { input: 0.25, output: 1.25 }, // Economy model
        'gpt-4o': { input: 2.5, output: 10 },
        'gemini-2-pro': { input: 1.25, output: 5 },
        'deepseek-v3': { input: 0.14, output: 0.28 },      // Very economical
    },
    // Feature Costs (flat credits)
    features: {
        'build_start': 10,              // Starting a new build
        'verification_quick': 5,        // Quick verification
        'verification_standard': 15,    // Standard 6-agent swarm
        'verification_thorough': 30,    // Thorough verification
        'ghost_mode_hour': 50,          // Ghost mode per hour
        'tournament_run': 100,          // Tournament with 3 competing agents
        'deploy_preview': 5,            // Deploy to preview
        'deploy_production': 20,        // Deploy to production
        'agent_deploy': 20,             // Deploy a Developer Mode agent
        'sandbox_hour': 10,             // Sandbox preview per hour
    },
    // Profit margin (1.5x = 50% markup)
    margin: 1.5,
};

export function calculateCreditsForTokens(
    model: keyof typeof CREDIT_COSTS.ai,
    inputTokens: number,
    outputTokens: number
): number {
    const costs = CREDIT_COSTS.ai[model] || CREDIT_COSTS.ai['claude-sonnet-4.5'];
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    return Math.ceil((inputCost + outputCost) * CREDIT_COSTS.margin);
}

export function calculateCreditsForFeature(
    feature: keyof typeof CREDIT_COSTS.features
): number {
    return CREDIT_COSTS.features[feature] || 10;
}

// =============================================================================
// SINGLETON
// =============================================================================

let setupInstance: StripeSetupService | null = null;

export function getStripeSetupService(): StripeSetupService {
    if (!setupInstance) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY not configured');
        }
        setupInstance = new StripeSetupService(secretKey);
    }
    return setupInstance;
}

